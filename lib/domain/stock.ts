import { ObjectId, type ClientSession, type Db } from "mongodb";
import { col, withTx, type MovementDoc, type ProductDoc, type VariantDoc, type Who, type DocLine } from "../db";
import { assertCan, oid, UserError, who, type Actor } from "../actor";
import { audit } from "../audit";
import { nextNumber } from "../numbering";
import { adjustSchema, receiveSchema, saidaSchema, transferSchema } from "../validation";
import type { MovementType } from "../types";
import { formatNumber } from "../format";
import { luandaDay } from "../time";
import { systemCategory } from "./finance";

export type VariantRef = { product: ProductDoc; variant: VariantDoc };

/** Carrega produtos+variantes pelos ids das variantes */
export async function loadVariants(db: Db, variantIds: ObjectId[], session?: ClientSession): Promise<Map<string, VariantRef>> {
  const products = await col.products(db).find({ "variants._id": { $in: variantIds } }, { session }).toArray();
  const map = new Map<string, VariantRef>();
  for (const p of products) for (const v of p.variants) map.set(v._id.toHexString(), { product: p, variant: v });
  return map;
}

export function displayName(ref: VariantRef): string {
  return ref.variant.label ? `${ref.product.name} — ${ref.variant.label}` : ref.product.name;
}

export function needVariant(map: Map<string, VariantRef>, id: ObjectId | string): VariantRef {
  const ref = map.get(typeof id === "string" ? id : id.toHexString());
  if (!ref) throw new UserError("Um dos artigos já não existe no catálogo.");
  return ref;
}

export type MoveInput = {
  storeId: ObjectId;
  productId: ObjectId;
  variantId: ObjectId;
  name: string;
  qty: number;
  type: MovementType;
  unitCost: number;
  ref: MovementDoc["ref"];
  note?: string;
};

/**
 * Aplica movimentos de stock (dentro de uma transação). Cada linha altera a quantidade da loja
 * e fica registada no histórico. Saídas só passam se houver stock, salvo se a loja o permitir.
 */
export async function applyMovements(
  db: Db,
  session: ClientSession,
  moves: MoveInput[],
  by: Who,
  allowNegative: (storeId: ObjectId) => boolean = () => false,
): Promise<void> {
  const now = new Date();
  const docs: MovementDoc[] = [];
  for (const m of moves) {
    if (!m.qty) continue;
    const filter: Record<string, unknown> = { storeId: m.storeId, variantId: m.variantId };
    if (m.qty < 0 && !allowNegative(m.storeId)) filter.qty = { $gte: -m.qty };
    let after;
    try {
      after = await col.stock(db).findOneAndUpdate(
        filter,
        { $inc: { qty: m.qty }, $set: { updatedAt: now }, $setOnInsert: { productId: m.productId } },
        { upsert: m.qty > 0 || allowNegative(m.storeId), returnDocument: "after", session },
      );
    } catch (err) {
      // Upsert falhado por chave duplicada = a linha existe mas não tem stock suficiente
      if ((err as { code?: number }).code !== 11000) throw err;
      after = null;
    }
    if (!after) {
      const cur = await col.stock(db).findOne({ storeId: m.storeId, variantId: m.variantId }, { session });
      const left = cur?.qty ?? 0;
      throw new UserError(`Stock insuficiente de «${m.name}»: ${left > 0 ? `só restam ${formatNumber(left)}` : "não há unidades"} nesta loja.`);
    }
    docs.push({
      _id: new ObjectId(),
      at: now,
      storeId: m.storeId,
      productId: m.productId,
      variantId: m.variantId,
      name: m.name,
      qty: m.qty,
      type: m.type,
      unitCost: m.unitCost,
      balanceAfter: after.qty,
      ref: m.ref,
      by,
      note: m.note,
    });
  }
  if (docs.length) await col.movements(db).insertMany(docs, { session });
}

async function activeStore(db: Db, id: ObjectId, session?: ClientSession) {
  const s = await col.stores(db).findOne({ _id: id }, { session });
  if (!s || !s.active) throw new UserError("Loja não encontrada ou inativa.");
  return s;
}

function mergeLines<T extends { variantId: string; qty: number }>(lines: T[]): T[] {
  const map = new Map<string, T>();
  for (const l of lines) {
    const prev = map.get(l.variantId);
    map.set(l.variantId, prev ? { ...prev, qty: prev.qty + l.qty } : { ...l });
  }
  return [...map.values()];
}

// ── Nota de saída ───────────────────────────────────────────

export async function createSaida(_db: Db, actor: Actor, input: unknown) {
  const data = saidaSchema.parse(input);
  const storeId = oid(data.storeId);
  assertCan(actor, "stock.nota_saida", storeId);
  const lines = mergeLines(data.lines);
  return withTx(async (db, session) => {
    const store = await activeStore(db, storeId, session);
    const refs = await loadVariants(db, lines.map((l) => oid(l.variantId)), session);
    const number = await nextNumber(db, "NS", 4, session);
    const _id = new ObjectId();
    const docLines: DocLine[] = lines.map((l) => {
      const r = needVariant(refs, l.variantId);
      return { productId: r.product._id, variantId: r.variant._id, name: displayName(r), sku: r.variant.sku, qty: l.qty, unitCost: r.variant.avgCost, note: l.note };
    });
    await col.stockDocs(db).insertOne(
      { _id, number, type: "saida", storeId, reason: data.reason, status: "concluida", lines: docLines, note: data.note, createdBy: who(actor), createdAt: new Date() },
      { session },
    );
    await applyMovements(
      db,
      session,
      docLines.map((l) => ({ ...l, storeId, qty: -l.qty, type: data.reason, ref: { kind: "doc", id: _id, number } })),
      who(actor),
      () => store.allowNegativeStock,
    );
    await audit(db, actor, "nota_saida.criar", "stockDoc", `Nota de saída ${number} (${docLines.length} artigo(s))`, { entityId: _id, storeId, session });
    return { id: _id.toHexString(), number };
  });
}

// ── Transferências ──────────────────────────────────────────

export async function sendTransfer(_db: Db, actor: Actor, input: unknown) {
  const data = transferSchema.parse(input);
  const fromId = oid(data.fromStoreId);
  const toId = oid(data.toStoreId);
  if (fromId.equals(toId)) throw new UserError("Escolha uma loja de destino diferente da origem.");
  assertCan(actor, "stock.transf_enviar", fromId);
  if (data.transportCost > 0 && data.transportAccountId) assertCan(actor, "financas.saida");
  const lines = mergeLines(data.lines);
  return withTx(async (db, session) => {
    const from = await activeStore(db, fromId, session);
    const to = await activeStore(db, toId, session);
    const refs = await loadVariants(db, lines.map((l) => oid(l.variantId)), session);
    const number = await nextNumber(db, "TRF", 4, session);
    const _id = new ObjectId();
    const docLines: DocLine[] = lines.map((l) => {
      const r = needVariant(refs, l.variantId);
      return { productId: r.product._id, variantId: r.variant._id, name: displayName(r), sku: r.variant.sku, qty: l.qty, unitCost: r.variant.avgCost, note: l.note };
    });
    const now = new Date();
    await col.stockDocs(db).insertOne(
      {
        _id,
        number,
        type: "transferencia",
        storeId: fromId,
        toStoreId: toId,
        status: "em_transito",
        lines: docLines,
        transportCost: data.transportCost || undefined,
        note: data.note,
        createdBy: who(actor),
        createdAt: now,
      },
      { session },
    );
    await applyMovements(
      db,
      session,
      docLines.map((l) => ({ ...l, storeId: fromId, qty: -l.qty, type: "transf_saida", ref: { kind: "doc", id: _id, number }, note: `Para ${to.name}` })),
      who(actor),
      () => from.allowNegativeStock,
    );
    if (data.transportCost > 0 && data.transportAccountId) {
      const account = await col.accounts(db).findOne({ _id: oid(data.transportAccountId) }, { session });
      if (!account || !account.active) throw new UserError("Conta de pagamento do transporte inválida.");
      if (account.storeId && !actor.allStores && !actor.storeIds.includes(account.storeId.toHexString())) throw new UserError("Não tem acesso a esta conta.");
      const cat = await systemCategory(db, "transporte_stock", session);
      await col.cashbook(db).insertOne(
        {
          _id: new ObjectId(),
          type: "saida",
          amount: Math.round(data.transportCost),
          at: now,
          day: luandaDay(now),
          category: { id: cat._id, name: cat.name, kind: cat.kind },
          accountId: account._id,
          storeId: account.storeId ?? fromId,
          description: `Transporte da transferência ${number} (${from.name} → ${to.name})`,
          source: "transferencia",
          ref: { id: _id, number },
          by: who(actor),
          createdAt: now,
        },
        { session },
      );
    }
    await audit(db, actor, "transferencia.enviar", "stockDoc", `Transferência ${number}: ${from.name} → ${to.name}`, { entityId: _id, storeId: fromId, session });
    return { id: _id.toHexString(), number };
  });
}

export async function receiveTransfer(_db: Db, actor: Actor, input: unknown) {
  const data = receiveSchema.parse(input);
  const docId = oid(data.docId);
  return withTx(async (db, session) => {
    const doc = await col.stockDocs(db).findOne({ _id: docId, type: "transferencia" }, { session });
    if (!doc) throw new UserError("Transferência não encontrada.");
    assertCan(actor, "stock.transf_receber", doc.toStoreId!);
    if (doc.status !== "em_transito") throw new UserError("Esta transferência já foi recebida ou cancelada.");
    const received = new Map(data.lines.map((l) => [l.variantId, l]));
    let differences = false;
    const lines: DocLine[] = doc.lines.map((l) => {
      const r = received.get(l.variantId.toHexString());
      const got = r ? Math.min(r.qtyReceived, l.qty) : l.qty;
      if (got !== l.qty) differences = true;
      return { ...l, qtyReceived: got, note: r?.note ?? l.note };
    });
    const ref = { kind: "doc" as const, id: doc._id, number: doc.number };
    const moves: MoveInput[] = [];
    for (const l of lines) {
      moves.push({ ...l, storeId: doc.toStoreId!, qty: l.qty, type: "transf_entrada", ref });
      const missing = l.qty - (l.qtyReceived ?? l.qty);
      if (missing > 0) moves.push({ ...l, storeId: doc.toStoreId!, qty: -missing, type: "perda_transito", ref, note: l.note ?? "Não chegou ou chegou danificado" });
    }
    await applyMovements(db, session, moves, who(actor), () => true);
    const status = differences ? "recebida_com_diferencas" : "recebida";
    await col.stockDocs(db).updateOne(
      { _id: doc._id },
      { $set: { lines, status, receivedBy: who(actor), receivedAt: new Date(), receiveNote: data.note } },
      { session },
    );
    await audit(db, actor, "transferencia.receber", "stockDoc", `Transferência ${doc.number} recebida${differences ? " com diferenças" : ""}`, {
      entityId: doc._id,
      storeId: doc.toStoreId,
      session,
    });
    return { status };
  });
}

export async function cancelTransfer(_db: Db, actor: Actor, docIdRaw: unknown) {
  const docId = oid(docIdRaw);
  return withTx(async (db, session) => {
    const doc = await col.stockDocs(db).findOne({ _id: docId, type: "transferencia" }, { session });
    if (!doc) throw new UserError("Transferência não encontrada.");
    assertCan(actor, "stock.transf_enviar", doc.storeId);
    if (doc.status !== "em_transito") throw new UserError("Só é possível cancelar transferências em trânsito.");
    const ref = { kind: "doc" as const, id: doc._id, number: doc.number };
    await applyMovements(
      db,
      session,
      doc.lines.map((l) => ({ ...l, storeId: doc.storeId, qty: l.qty, type: "transf_entrada", ref, note: "Transferência cancelada — stock devolvido" })),
      who(actor),
    );
    await col.stockDocs(db).updateOne({ _id: doc._id }, { $set: { status: "cancelada", cancelledBy: who(actor), cancelledAt: new Date() } }, { session });
    await audit(db, actor, "transferencia.cancelar", "stockDoc", `Transferência ${doc.number} cancelada`, { entityId: doc._id, storeId: doc.storeId, session });
    return {};
  });
}

// ── Contagem / ajuste ───────────────────────────────────────

export async function createAdjustment(_db: Db, actor: Actor, input: unknown) {
  const data = adjustSchema.parse(input);
  const storeId = oid(data.storeId);
  assertCan(actor, "stock.ajustar", storeId);
  return withTx(async (db, session) => {
    await activeStore(db, storeId, session);
    const ids = data.lines.map((l) => oid(l.variantId));
    const refs = await loadVariants(db, ids, session);
    const current = await col.stock(db).find({ storeId, variantId: { $in: ids } }, { session }).toArray();
    const qtyOf = new Map(current.map((s) => [s.variantId.toHexString(), s.qty]));
    const number = await nextNumber(db, "AJ", 4, session);
    const _id = new ObjectId();
    const docLines: DocLine[] = data.lines.map((l) => {
      const r = needVariant(refs, l.variantId);
      return {
        productId: r.product._id,
        variantId: r.variant._id,
        name: displayName(r),
        sku: r.variant.sku,
        qty: l.counted,
        systemQty: qtyOf.get(l.variantId) ?? 0,
        unitCost: r.variant.avgCost,
      };
    });
    const changed = docLines.filter((l) => l.qty !== l.systemQty);
    await col.stockDocs(db).insertOne(
      { _id, number, type: "ajuste", storeId, status: "concluida", lines: docLines, note: data.note, createdBy: who(actor), createdAt: new Date() },
      { session },
    );
    await applyMovements(
      db,
      session,
      changed.map((l) => ({ ...l, storeId, qty: l.qty - (l.systemQty ?? 0), type: "ajuste", ref: { kind: "doc", id: _id, number } })),
      who(actor),
      () => true,
    );
    await audit(db, actor, "stock.ajustar", "stockDoc", `Contagem ${number}: ${changed.length} artigo(s) corrigido(s)`, { entityId: _id, storeId, session });
    return { id: _id.toHexString(), number, changed: changed.length };
  });
}
