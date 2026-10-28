import { ObjectId, type Db } from "mongodb";
import { z } from "zod";
import { col, withTx, type CashEntryDoc, type SaleDoc, type SaleLine } from "../db";
import { assertCan, can, oid, UserError, who, type Actor } from "../actor";
import { audit } from "../audit";
import { nextNumber } from "../numbering";
import { returnSchema, saleSchema, zKz, zOptText } from "../validation";
import { luandaDay } from "../time";
import { formatKz, formatPct } from "../format";
import { PAYMENT_METHODS, type PaymentMethod } from "../types";
import { applyMovements, displayName, loadVariants, needVariant } from "./stock";
import { accountForMethod, ensureStoreCashAccount, systemCategory } from "./finance";

export function priceFor(variant: { price: number; storePrices?: Record<string, number> }, storeId: ObjectId | string): number {
  const key = typeof storeId === "string" ? storeId : storeId.toHexString();
  return variant.storePrices?.[key] ?? variant.price;
}

/** Reparte o desconto pelas linhas, proporcionalmente (o resto do arredondamento vai para a última) */
function distribute(lines: { gross: number }[], discount: number): number[] {
  const subtotal = lines.reduce((s, l) => s + l.gross, 0);
  if (!discount || !subtotal) return lines.map((l) => l.gross);
  let left = discount;
  return lines.map((l, i) => {
    if (i === lines.length - 1) return l.gross - left;
    const share = Math.round((discount * l.gross) / subtotal);
    left -= share;
    return l.gross - share;
  });
}

export async function createSale(_db: Db, actor: Actor, input: unknown): Promise<{ id: string; number: string; duplicate?: boolean }> {
  const data = saleSchema.parse(input);
  const storeId = oid(data.storeId);
  assertCan(actor, "pos.vender", storeId);

  const existing = await col.sales(_db).findOne({ clientRequestId: data.clientRequestId });
  if (existing) return { id: existing._id.toHexString(), number: existing.number, duplicate: true };

  try {
    return await withTx(async (db, session) => {
      const store = await col.stores(db).findOne({ _id: storeId }, { session });
      if (!store || !store.active) throw new UserError("Loja não encontrada ou inativa.");
      await ensureStoreCashAccount(db, store, session);

      let tillId: ObjectId | null = null;
      const till = await col.tills(db).findOne({ storeId, status: "aberta" }, { session });
      if (till) tillId = till._id;
      else if (store.requireOpenTill) throw new UserError("A caixa está fechada. Abra a caixa antes de vender.");

      // Junta linhas repetidas da mesma variante e preço
      const merged = new Map<string, { variantId: string; qty: number; unitPrice?: number }>();
      for (const l of data.lines) {
        const k = `${l.variantId}:${l.unitPrice ?? ""}`;
        const prev = merged.get(k);
        merged.set(k, prev ? { ...prev, qty: prev.qty + l.qty } : { ...l });
      }
      const inLines = [...merged.values()];
      const refs = await loadVariants(db, inLines.map((l) => oid(l.variantId)), session);

      const priced = inLines.map((l) => {
        const r = needVariant(refs, l.variantId);
        if (!r.product.active || !r.variant.active) throw new UserError(`«${displayName(r)}» já não está à venda.`);
        const listPrice = priceFor(r.variant, storeId);
        const unitPrice = l.unitPrice === undefined ? listPrice : Math.round(l.unitPrice);
        if (unitPrice !== listPrice && !can(actor, "pos.preco_manual")) throw new UserError("Não tem permissão para alterar preços na venda.");
        return { r, qty: l.qty, listPrice, unitPrice, gross: unitPrice * l.qty };
      });

      const subtotal = priced.reduce((s, l) => s + l.gross, 0);
      const discount = Math.round(data.discount.type === "pct" ? (subtotal * Math.min(data.discount.value, 100)) / 100 : data.discount.value);
      if (discount > subtotal) throw new UserError("O desconto não pode ser maior que o total.");
      if (discount > 0) {
        if (!can(actor, "pos.desconto")) throw new UserError("Não tem permissão para dar descontos.");
        const pct = subtotal ? (discount / subtotal) * 100 : 0;
        if (pct > actor.maxDiscountPct + 0.001) throw new UserError(`O desconto máximo do seu cargo é ${formatPct(actor.maxDiscountPct, 0)}.`);
      }
      const total = subtotal - discount;

      // Pagamentos: só o dinheiro pode ter troco
      const nonCash = data.payments.filter((p) => p.method !== "dinheiro" && p.amount > 0);
      const cashGiven = data.payments.filter((p) => p.method === "dinheiro").reduce((s, p) => s + Math.round(p.amount), 0);
      const nonCashTotal = nonCash.reduce((s, p) => s + Math.round(p.amount), 0);
      if (nonCashTotal > total) throw new UserError("Os pagamentos por cartão/transferência excedem o total.");
      const cashNeeded = total - nonCashTotal;
      if (cashGiven < cashNeeded) throw new UserError(`Falta receber ${formatKz(cashNeeded - cashGiven)}.`);
      const change = cashGiven - cashNeeded;
      const payments: { method: PaymentMethod; amount: number }[] = [];
      const byMethod = new Map<PaymentMethod, number>();
      for (const p of nonCash) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + Math.round(p.amount));
      if (cashNeeded > 0) byMethod.set("dinheiro", cashNeeded);
      for (const [method, amount] of byMethod) payments.push({ method, amount });

      const finals = distribute(priced, discount);
      const lines: SaleLine[] = priced.map((l, i) => ({
        productId: l.r.product._id,
        variantId: l.r.variant._id,
        name: displayName(l.r),
        sku: l.r.variant.sku,
        qty: l.qty,
        listPrice: l.listPrice,
        unitPrice: l.unitPrice,
        lineTotal: finals[i],
        unitCost: l.r.variant.avgCost,
        returnedQty: 0,
      }));
      const cost = Math.round(lines.reduce((s, l) => s + l.qty * l.unitCost, 0) * 100) / 100;

      const number = await nextNumber(db, store.code, 5, session);
      const _id = new ObjectId();
      const now = new Date();
      const sale: SaleDoc = {
        _id,
        number,
        storeId,
        tillId,
        seller: who(actor),
        customer: data.customer,
        lines,
        subtotal,
        discount,
        total,
        cost,
        payments,
        cashReceived: cashGiven || undefined,
        change,
        status: "concluida",
        returns: [],
        refunded: 0,
        returnedCost: 0,
        note: data.note,
        clientRequestId: data.clientRequestId,
        createdAt: now,
      };
      await col.sales(db).insertOne(sale, { session });

      await applyMovements(
        db,
        session,
        lines.map((l) => ({ ...l, storeId, qty: -l.qty, type: "venda", ref: { kind: "venda", id: _id, number } })),
        who(actor),
        () => store.allowNegativeStock,
      );

      if (payments.length) {
        const cat = await systemCategory(db, "venda", session);
        const entries: CashEntryDoc[] = payments.map((p) => ({
          _id: new ObjectId(),
          type: "entrada",
          amount: p.amount,
          at: now,
          day: luandaDay(now),
          category: { id: cat._id, name: cat.name, kind: cat.kind },
          accountId: accountForMethod(store, p.method),
          storeId,
          method: p.method,
          description: `Venda ${number}`,
          source: "venda",
          ref: { id: _id, number },
          by: who(actor),
          createdAt: now,
        }));
        await col.cashbook(db).insertMany(entries, { session });
      }

      if (data.customer?.phone) {
        await col.customers(db).updateOne(
          { phone: data.customer.phone },
          {
            $set: { lastPurchaseAt: now, ...(data.customer.name ? { name: data.customer.name } : {}) },
            $inc: { totalSpent: total, visits: 1 },
            $setOnInsert: { createdAt: now },
          },
          { upsert: true, session },
        );
      }
      return { id: _id.toHexString(), number };
    });
  } catch (err) {
    // Dois toques no botão ao mesmo tempo: a segunda venda colide no clientRequestId
    if ((err as { code?: number }).code === 11000) {
      const dup = await col.sales(_db).findOne({ clientRequestId: data.clientRequestId });
      if (dup) return { id: dup._id.toHexString(), number: dup.number, duplicate: true };
    }
    throw err;
  }
}

export async function voidSale(_db: Db, actor: Actor, saleIdRaw: unknown, reasonRaw: unknown) {
  const reason = z.string().trim().min(3, "Indique o motivo da anulação.").max(200).parse(reasonRaw);
  const saleId = oid(saleIdRaw);
  return withTx(async (db, session) => {
    const sale = await col.sales(db).findOne({ _id: saleId }, { session });
    if (!sale) throw new UserError("Venda não encontrada.");
    assertCan(actor, "pos.anular", sale.storeId);
    if (sale.status === "anulada") throw new UserError("Esta venda já foi anulada.");
    if (sale.refunded > 0) throw new UserError("Esta venda já tem devoluções. Use a devolução para o resto dos artigos.");
    const store = (await col.stores(db).findOne({ _id: sale.storeId }, { session }))!;
    await ensureStoreCashAccount(db, store, session);
    const now = new Date();
    await col.sales(db).updateOne({ _id: sale._id }, { $set: { status: "anulada", voidedAt: now, voidedBy: who(actor), voidReason: reason } }, { session });
    const ref = { kind: "venda" as const, id: sale._id, number: sale.number };
    await applyMovements(
      db,
      session,
      sale.lines.map((l) => ({ ...l, storeId: sale.storeId, qty: l.qty - l.returnedQty, type: "anulacao", ref })),
      who(actor),
    );
    if (sale.payments.length) {
      const cat = await systemCategory(db, "estorno_venda", session);
      await col.cashbook(db).insertMany(
        sale.payments.map((p) => ({
          _id: new ObjectId(),
          type: "saida" as const,
          amount: p.amount,
          at: now,
          day: luandaDay(now),
          category: { id: cat._id, name: cat.name, kind: cat.kind },
          accountId: accountForMethod(store, p.method),
          storeId: sale.storeId,
          method: p.method,
          description: `Anulação da venda ${sale.number}: ${reason}`,
          source: "anulacao" as const,
          ref: { id: sale._id, number: sale.number },
          by: who(actor),
          createdAt: now,
        })),
        { session },
      );
    }
    await audit(db, actor, "venda.anular", "sale", `Venda ${sale.number} (${formatKz(sale.total)}) anulada: ${reason}`, { entityId: sale._id, storeId: sale.storeId, session });
    return {};
  });
}

export async function returnSale(_db: Db, actor: Actor, input: unknown) {
  const data = returnSchema.parse(input);
  const saleId = oid(data.saleId);
  return withTx(async (db, session) => {
    const sale = await col.sales(db).findOne({ _id: saleId }, { session });
    if (!sale) throw new UserError("Venda não encontrada.");
    assertCan(actor, "pos.devolucao", sale.storeId);
    if (sale.status === "anulada") throw new UserError("Esta venda foi anulada.");
    const store = (await col.stores(db).findOne({ _id: sale.storeId }, { session }))!;
    await ensureStoreCashAccount(db, store, session);

    const lines = sale.lines.map((l) => ({ ...l }));
    const retLines: { variantId: ObjectId; qty: number; amount: number }[] = [];
    let amount = 0;
    let cost = 0;
    for (const r of data.lines) {
      const line = lines.find((l) => l.variantId.toHexString() === r.variantId && l.qty - l.returnedQty > 0);
      if (!line) throw new UserError("Esse artigo não faz parte da venda.");
      const left = line.qty - line.returnedQty;
      if (r.qty > left) throw new UserError(`Só pode devolver ${left} unidade(s) de «${line.name}».`);
      const value = Math.round((line.lineTotal / line.qty) * r.qty);
      line.returnedQty += r.qty;
      amount += value;
      cost += r.qty * line.unitCost;
      retLines.push({ variantId: line.variantId, qty: r.qty, amount: value });
    }
    const now = new Date();
    await col.sales(db).updateOne(
      { _id: sale._id },
      {
        $set: { lines },
        $inc: { refunded: amount, returnedCost: Math.round(cost * 100) / 100 },
        $push: { returns: { at: now, by: who(actor), lines: retLines, amount, method: data.method, reason: data.reason } },
      },
      { session },
    );
    const ref = { kind: "venda" as const, id: sale._id, number: sale.number };
    await applyMovements(
      db,
      session,
      retLines.map((r) => {
        const l = lines.find((x) => x.variantId.equals(r.variantId))!;
        return { productId: l.productId, variantId: l.variantId, name: l.name, unitCost: l.unitCost, storeId: sale.storeId, qty: r.qty, type: "devolucao", ref };
      }),
      who(actor),
    );
    if (amount > 0) {
      const cat = await systemCategory(db, "estorno_venda", session);
      await col.cashbook(db).insertOne(
        {
          _id: new ObjectId(),
          type: "saida",
          amount,
          at: now,
          day: luandaDay(now),
          category: { id: cat._id, name: cat.name, kind: cat.kind },
          accountId: accountForMethod(store, data.method),
          storeId: sale.storeId,
          method: data.method,
          description: `Devolução da venda ${sale.number}: ${data.reason}`,
          source: "devolucao",
          ref: { id: sale._id, number: sale.number },
          by: who(actor),
          createdAt: now,
        },
        { session },
      );
    }
    await audit(db, actor, "venda.devolucao", "sale", `Devolução de ${formatKz(amount)} na venda ${sale.number} (${PAYMENT_METHODS[data.method]})`, {
      entityId: sale._id,
      storeId: sale.storeId,
      session,
    });
    return { amount };
  });
}

// ── Caixa (abertura e fecho) ────────────────────────────────

export async function openTill(_db: Db, actor: Actor, storeIdRaw: unknown, floatRaw: unknown) {
  const storeId = oid(storeIdRaw);
  const openingFloat = Math.round(zKz("O fundo de caixa").parse(floatRaw));
  assertCan(actor, "pos.caixa", storeId);
  return withTx(async (db, session) => {
    const store = await col.stores(db).findOne({ _id: storeId }, { session });
    if (!store || !store.active) throw new UserError("Loja não encontrada.");
    const open = await col.tills(db).findOne({ storeId, status: "aberta" }, { session });
    if (open) throw new UserError(`A caixa já foi aberta por ${open.openedBy.name}.`);
    const _id = new ObjectId();
    await col.tills(db).insertOne({ _id, storeId, status: "aberta", openedBy: who(actor), openedAt: new Date(), openingFloat }, { session });
    await audit(db, actor, "caixa.abrir", "till", `Caixa aberta em ${store.name} com ${formatKz(openingFloat)}`, { entityId: _id, storeId, session });
    return { id: _id.toHexString() };
  });
}

/** Resumo de uma caixa aberta: vendas e dinheiro esperado na gaveta */
export async function tillSummary(db: Db, tillId: ObjectId) {
  const till = await col.tills(db).findOne({ _id: tillId });
  if (!till) throw new UserError("Caixa não encontrada.");
  const store = await col.stores(db).findOne({ _id: till.storeId });
  const end = till.closedAt ?? new Date();
  const sales = await col.sales(db).find({ tillId: till._id, status: "concluida" }).project<{ total: number; refunded: number; payments: SaleDoc["payments"] }>({ total: 1, refunded: 1, payments: 1 }).toArray();
  const byMethod: Record<string, number> = {};
  for (const s of sales) for (const p of s.payments) byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amount;
  let cashIn = 0;
  let cashOut = 0;
  if (store?.cashAccountId) {
    const rows = await col
      .cashbook(db)
      .aggregate<{ _id: string; sum: number }>([
        { $match: { accountId: store.cashAccountId, at: { $gte: till.openedAt, $lte: end }, voided: { $exists: false }, source: { $ne: "caixa" } } },
        { $group: { _id: "$type", sum: { $sum: "$amount" } } },
      ])
      .toArray();
    cashIn = rows.find((r) => r._id === "entrada")?.sum ?? 0;
    cashOut = rows.find((r) => r._id === "saida")?.sum ?? 0;
  }
  return {
    till,
    store,
    sales: sales.reduce((s, x) => s + x.total - x.refunded, 0),
    count: sales.length,
    byMethod,
    cashIn,
    cashOut,
    expectedCash: till.openingFloat + cashIn - cashOut,
  };
}

export async function closeTill(db: Db, actor: Actor, tillIdRaw: unknown, countedRaw: unknown, noteRaw?: unknown) {
  const tillId = oid(tillIdRaw);
  const countedCash = Math.round(zKz("O dinheiro contado").parse(countedRaw));
  const note = zOptText(300).parse(noteRaw ?? undefined);
  const sum = await tillSummary(db, tillId);
  assertCan(actor, "pos.caixa", sum.till.storeId);
  if (sum.till.status !== "aberta") throw new UserError("Esta caixa já está fechada.");
  const difference = countedCash - sum.expectedCash;
  return withTx(async (db, session) => {
    const now = new Date();
    const res = await col.tills(db).updateOne(
      { _id: tillId, status: "aberta" },
      {
        $set: {
          status: "fechada",
          closedBy: who(actor),
          closedAt: now,
          expectedCash: sum.expectedCash,
          countedCash,
          difference,
          note,
          summary: { sales: sum.sales, count: sum.count, byMethod: sum.byMethod, cashIn: sum.cashIn, cashOut: sum.cashOut },
        },
      },
      { session },
    );
    if (!res.modifiedCount) throw new UserError("Esta caixa já está fechada.");
    if (difference !== 0 && sum.store?.cashAccountId) {
      const cat = await systemCategory(db, difference < 0 ? "caixa_falta" : "caixa_sobra", session);
      await col.cashbook(db).insertOne(
        {
          _id: new ObjectId(),
          type: difference < 0 ? "saida" : "entrada",
          amount: Math.abs(difference),
          at: now,
          day: luandaDay(now),
          category: { id: cat._id, name: cat.name, kind: cat.kind },
          accountId: sum.store.cashAccountId,
          storeId: sum.till.storeId,
          method: "dinheiro",
          description: `${difference < 0 ? "Falta" : "Sobra"} no fecho de caixa (${sum.store.name})`,
          source: "caixa",
          ref: { id: tillId, number: "Fecho de caixa" },
          by: who(actor),
          createdAt: now,
        },
        { session },
      );
    }
    await audit(
      db,
      actor,
      "caixa.fechar",
      "till",
      `Caixa fechada em ${sum.store?.name}: esperado ${formatKz(sum.expectedCash)}, contado ${formatKz(countedCash)}${difference ? ` (diferença ${formatKz(difference)})` : ""}`,
      { entityId: tillId, storeId: sum.till.storeId, session },
    );
    return { difference, expectedCash: sum.expectedCash };
  });
}
