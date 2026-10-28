import { ObjectId, type Db } from "mongodb";
import { col, withTx, type PurchaseLine } from "../db";
import { assertCan, oid, optOid, UserError, who, type Actor } from "../actor";
import { audit } from "../audit";
import { nextNumber } from "../numbering";
import { paymentSchema, purchaseSchema, supplierSchema } from "../validation";
import { luandaDay } from "../time";
import { formatKz } from "../format";
import { applyMovements, displayName, loadVariants, needVariant } from "./stock";
import { systemCategory } from "./finance";
import { allocateLandedCost, weightedAverage } from "../costing";

export { allocateLandedCost, weightedAverage };

export async function saveSupplier(db: Db, actor: Actor, idRaw: unknown, input: unknown) {
  assertCan(actor, "fornecedores.gerir");
  const data = supplierSchema.parse(input);
  if (idRaw) {
    const id = oid(idRaw);
    await col.suppliers(db).updateOne({ _id: id }, { $set: data });
    return { id: id.toHexString() };
  }
  const _id = new ObjectId();
  await col.suppliers(db).insertOne({ _id, ...data, createdAt: new Date() });
  await audit(db, actor, "fornecedor.criar", "supplier", `Fornecedor ${data.name} criado`, { entityId: _id });
  return { id: _id.toHexString() };
}

export async function savePurchase(db: Db, actor: Actor, idRaw: unknown, input: unknown) {
  const data = purchaseSchema.parse(input);
  const storeId = oid(data.storeId);
  assertCan(actor, "compras.criar", storeId);
  const store = await col.stores(db).findOne({ _id: storeId });
  if (!store || !store.active) throw new UserError("Loja de destino inválida.");
  const supplierId = optOid(data.supplierId);
  const supplier = supplierId ? await col.suppliers(db).findOne({ _id: supplierId }) : null;
  if (supplierId && !supplier) throw new UserError("Fornecedor não encontrado.");

  const refs = await loadVariants(db, data.lines.map((l) => oid(l.variantId)));
  const rate = data.currency === "AOA" ? 1 : data.rate;
  const extraCosts = data.extraCosts.filter((c) => c.amount > 0).map((c) => ({ ...c, amount: Math.round(c.amount) }));
  const extraTotal = extraCosts.reduce((s, c) => s + c.amount, 0);
  const calc = allocateLandedCost(data.lines, rate, extraTotal, data.allocation);
  const lines: PurchaseLine[] = data.lines.map((l, i) => {
    const r = needVariant(refs, l.variantId);
    return {
      productId: r.product._id,
      variantId: r.variant._id,
      name: displayName(r),
      sku: r.variant.sku,
      qty: l.qty,
      unitCostForeign: l.unitCostForeign,
      unitCostKz: calc.unitCostKz[i],
      landedUnitCost: calc.landed[i],
    };
  });
  const fields = {
    supplierId,
    supplierName: supplier?.name ?? "Sem fornecedor",
    storeId,
    currency: data.currency,
    rate,
    lines,
    extraCosts,
    allocation: data.allocation,
    goodsTotal: calc.goodsTotal,
    extraTotal,
    total: calc.total,
    invoiceRef: data.invoiceRef,
    note: data.note,
    updatedAt: new Date(),
  };

  if (idRaw) {
    const id = oid(idRaw);
    const before = await col.purchases(db).findOne({ _id: id });
    if (!before) throw new UserError("Compra não encontrada.");
    if (before.status !== "rascunho") throw new UserError("Só é possível editar compras que ainda não deram entrada.");
    assertCan(actor, "compras.criar", before.storeId);
    if (fields.total < before.paid) throw new UserError(`O total não pode ficar abaixo do que já foi pago (${formatKz(before.paid)}).`);
    await col.purchases(db).updateOne({ _id: id }, { $set: fields });
    return { id: id.toHexString(), number: before.number };
  }
  const _id = new ObjectId();
  const number = await nextNumber(db, "CMP", 4);
  await col.purchases(db).insertOne({ _id, number, status: "rascunho", payments: [], paid: 0, createdBy: who(actor), createdAt: new Date(), ...fields });
  await audit(db, actor, "compra.criar", "purchase", `Compra ${number} a ${fields.supplierName}: ${formatKz(fields.total)}`, { entityId: _id, storeId });
  return { id: _id.toHexString(), number };
}

/** Dá entrada da mercadoria: soma ao stock da loja e atualiza o custo médio de cada variante */
export async function receivePurchase(_db: Db, actor: Actor, idRaw: unknown) {
  const id = oid(idRaw);
  return withTx(async (db, session) => {
    const p = await col.purchases(db).findOne({ _id: id }, { session });
    if (!p) throw new UserError("Compra não encontrada.");
    assertCan(actor, "compras.receber", p.storeId);
    if (p.status !== "rascunho") throw new UserError("Esta compra já deu entrada ou foi cancelada.");
    const refs = await loadVariants(db, p.lines.map((l) => l.variantId), session);
    for (const l of p.lines) {
      const r = needVariant(refs, l.variantId);
      const [onHand] = await col
        .stock(db)
        .aggregate<{ q: number }>([{ $match: { variantId: l.variantId } }, { $group: { _id: null, q: { $sum: "$qty" } } }], { session })
        .toArray();
      const product = await col.products(db).findOne({ _id: r.product._id }, { session });
      const v = product!.variants.find((x) => x._id.equals(l.variantId))!;
      const avg = weightedAverage(onHand?.q ?? 0, v.avgCost, l.qty, l.landedUnitCost);
      await col.products(db).updateOne(
        { _id: r.product._id, "variants._id": l.variantId },
        { $set: { "variants.$.avgCost": avg, "variants.$.lastCost": l.landedUnitCost, updatedAt: new Date() } },
        { session },
      );
      await applyMovements(
        db,
        session,
        [{ ...l, storeId: p.storeId, qty: l.qty, type: "compra", unitCost: l.landedUnitCost, ref: { kind: "compra", id: p._id, number: p.number } }],
        who(actor),
      );
    }
    await col.purchases(db).updateOne({ _id: p._id }, { $set: { status: "recebida", receivedBy: who(actor), receivedAt: new Date(), updatedAt: new Date() } }, { session });
    await audit(db, actor, "compra.receber", "purchase", `Entrada da compra ${p.number} (${p.lines.length} artigo(s))`, { entityId: p._id, storeId: p.storeId, session });
    return {};
  });
}

export async function payPurchase(_db: Db, actor: Actor, idRaw: unknown, input: unknown) {
  const id = oid(idRaw);
  const data = paymentSchema.parse(input);
  assertCan(actor, "compras.pagar");
  return withTx(async (db, session) => {
    const p = await col.purchases(db).findOne({ _id: id }, { session });
    if (!p) throw new UserError("Compra não encontrada.");
    if (p.status === "cancelada") throw new UserError("Esta compra foi cancelada.");
    const amount = Math.round(data.amount);
    if (amount > p.total - p.paid) throw new UserError(`Falta pagar apenas ${formatKz(p.total - p.paid)}.`);
    const account = await col.accounts(db).findOne({ _id: oid(data.accountId) }, { session });
    if (!account || !account.active) throw new UserError("Conta inválida.");
    if (account.storeId ? !(actor.allStores || actor.storeIds.includes(account.storeId.toHexString())) : !actor.allStores)
      throw new UserError("Não tem acesso a esta conta.");
    const now = new Date();
    const paymentId = new ObjectId();
    await col.purchases(db).updateOne(
      { _id: p._id },
      { $push: { payments: { _id: paymentId, at: now, amount, accountId: account._id, method: data.method, note: data.note, by: who(actor) } }, $inc: { paid: amount }, $set: { updatedAt: now } },
      { session },
    );
    const cat = await systemCategory(db, "compra_mercadoria", session);
    await col.cashbook(db).insertOne(
      {
        _id: new ObjectId(),
        type: "saida",
        amount,
        at: now,
        day: luandaDay(now),
        category: { id: cat._id, name: cat.name, kind: cat.kind },
        accountId: account._id,
        storeId: account.storeId,
        method: data.method,
        description: `Pagamento da compra ${p.number} a ${p.supplierName}${data.note ? ` — ${data.note}` : ""}`,
        source: "compra",
        ref: { id: p._id, number: p.number },
        by: who(actor),
        createdAt: now,
      },
      { session },
    );
    await audit(db, actor, "compra.pagar", "purchase", `Pagamento de ${formatKz(amount)} da compra ${p.number}`, { entityId: p._id, storeId: p.storeId, session });
    return {};
  });
}

export async function cancelPurchase(db: Db, actor: Actor, idRaw: unknown) {
  const id = oid(idRaw);
  const p = await col.purchases(db).findOne({ _id: id });
  if (!p) throw new UserError("Compra não encontrada.");
  assertCan(actor, "compras.criar", p.storeId);
  if (p.status !== "rascunho") throw new UserError("Só é possível cancelar compras que ainda não deram entrada.");
  if (p.paid > 0) throw new UserError("Esta compra já tem pagamentos registados.");
  await col.purchases(db).updateOne({ _id: id }, { $set: { status: "cancelada", updatedAt: new Date() } });
  await audit(db, actor, "compra.cancelar", "purchase", `Compra ${p.number} cancelada`, { entityId: id, storeId: p.storeId });
  return {};
}
