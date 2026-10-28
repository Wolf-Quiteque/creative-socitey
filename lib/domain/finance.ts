import { ObjectId, type ClientSession, type Db } from "mongodb";
import { col, withTx, type FinCategoryDoc, type StoreDoc } from "../db";
import { assertCan, canAccessStore, oid, optOid, UserError, who, type Actor } from "../actor";
import { audit } from "../audit";
import { accountSchema, accountTransferSchema, entrySchema, finCategorySchema } from "../validation";
import { MANUAL_IN_KINDS, MANUAL_OUT_KINDS, type CategoryKind, type PaymentMethod } from "../types";
import { luandaDay, luandaInstant } from "../time";
import { formatKz } from "../format";

/** Categorias usadas automaticamente pelo sistema (criadas se faltarem) */
export const SYSTEM_CATEGORIES: Record<string, { name: string; type: "entrada" | "saida"; kind: CategoryKind }> = {
  venda: { name: "Vendas", type: "entrada", kind: "venda" },
  estorno_venda: { name: "Anulações e devoluções", type: "saida", kind: "estorno" },
  compra_mercadoria: { name: "Compra de mercadoria", type: "saida", kind: "compra_stock" },
  transporte_stock: { name: "Transporte entre lojas", type: "saida", kind: "despesa" },
  transferencia_saida: { name: "Transferência entre contas (saída)", type: "saida", kind: "transferencia" },
  transferencia_entrada: { name: "Transferência entre contas (entrada)", type: "entrada", kind: "transferencia" },
  caixa_falta: { name: "Falta na caixa", type: "saida", kind: "despesa" },
  caixa_sobra: { name: "Sobra na caixa", type: "entrada", kind: "receita" },
};

/** Categorias sugeridas na primeira utilização (o dono pode editar, desativar ou criar mais) */
export const DEFAULT_CATEGORIES: { name: string; type: "entrada" | "saida"; kind: CategoryKind }[] = [
  { name: "Água e alimentação da equipa", type: "saida", kind: "despesa" },
  { name: "Mobiliário e equipamento", type: "saida", kind: "despesa" },
  { name: "Renda", type: "saida", kind: "despesa" },
  { name: "Salários", type: "saida", kind: "despesa" },
  { name: "Energia e água", type: "saida", kind: "despesa" },
  { name: "Internet e telefone", type: "saida", kind: "despesa" },
  { name: "Transporte e combustível", type: "saida", kind: "despesa" },
  { name: "Publicidade e redes sociais", type: "saida", kind: "despesa" },
  { name: "Limpeza e manutenção", type: "saida", kind: "despesa" },
  { name: "Impostos e taxas", type: "saida", kind: "despesa" },
  { name: "Outras despesas", type: "saida", kind: "despesa" },
  { name: "Compra de mercadoria (avulsa)", type: "saida", kind: "compra_stock" },
  { name: "Levantamento do dono", type: "saida", kind: "retirada_dono" },
  { name: "Serviços (instalação, penteados)", type: "entrada", kind: "receita" },
  { name: "Outras receitas", type: "entrada", kind: "receita" },
  { name: "Entrada de capital", type: "entrada", kind: "capital" },
];

export async function systemCategory(db: Db, key: string, session?: ClientSession): Promise<FinCategoryDoc> {
  const found = await col.finCategories(db).findOne({ key }, { session });
  if (found) return found;
  const def = SYSTEM_CATEGORIES[key];
  if (!def) throw new Error(`Categoria de sistema desconhecida: ${key}`);
  const doc: FinCategoryDoc = { _id: new ObjectId(), key, active: true, createdAt: new Date(), ...def };
  await col.finCategories(db).updateOne({ key }, { $setOnInsert: doc }, { upsert: true, session });
  return (await col.finCategories(db).findOne({ key }, { session }))!;
}

/** Conta onde entra o dinheiro de uma venda, conforme o método de pagamento */
export function accountForMethod(store: StoreDoc, method: PaymentMethod): ObjectId {
  const id = method === "dinheiro" ? store.cashAccountId : (store.bankAccountId ?? store.cashAccountId);
  if (!id) throw new UserError(`A loja ${store.name} não tem conta de caixa configurada.`);
  return id;
}

/** Garante que a loja tem uma conta "Caixa" própria */
export async function ensureStoreCashAccount(db: Db, store: StoreDoc, session?: ClientSession): Promise<ObjectId> {
  if (store.cashAccountId) return store.cashAccountId;
  const _id = new ObjectId();
  await col.accounts(db).insertOne(
    { _id, name: `Caixa — ${store.name}`, type: "caixa", storeId: store._id, openingBalance: 0, active: true, createdAt: new Date() },
    { session },
  );
  await col.stores(db).updateOne({ _id: store._id }, { $set: { cashAccountId: _id } }, { session });
  store.cashAccountId = _id;
  return _id;
}

function assertAccountAccess(actor: Actor, account: { storeId: ObjectId | null }) {
  if (account.storeId ? !canAccessStore(actor, account.storeId) : !actor.allStores) throw new UserError("Não tem acesso a esta conta.");
}

export async function createEntry(db: Db, actor: Actor, input: unknown) {
  const data = entrySchema.parse(input);
  assertCan(actor, data.type === "entrada" ? "financas.entrada" : "financas.saida");
  const category = await col.finCategories(db).findOne({ _id: oid(data.categoryId) });
  if (!category || !category.active) throw new UserError("Categoria inválida.");
  const allowed = data.type === "entrada" ? MANUAL_IN_KINDS : MANUAL_OUT_KINDS;
  if (category.type !== data.type || !allowed.includes(category.kind)) throw new UserError("Essa categoria não pode ser usada aqui.");
  const account = await col.accounts(db).findOne({ _id: oid(data.accountId) });
  if (!account || !account.active) throw new UserError("Conta inválida.");
  assertAccountAccess(actor, account);
  const today = luandaDay();
  const day = data.day ?? today;
  if (day > today) throw new UserError("A data não pode ser no futuro.");
  const now = new Date();
  const _id = new ObjectId();
  await col.cashbook(db).insertOne({
    _id,
    type: data.type,
    amount: Math.round(data.amount),
    at: day === today ? now : luandaInstant(day, "12:00"),
    day,
    category: { id: category._id, name: category.name, kind: category.kind },
    accountId: account._id,
    storeId: account.storeId,
    method: data.method ?? (account.type === "caixa" ? "dinheiro" : undefined),
    description: data.description,
    source: "manual",
    attachmentId: data.attachmentId ? new ObjectId(data.attachmentId) : undefined,
    by: who(actor),
    createdAt: now,
  });
  await audit(db, actor, `financas.${data.type}`, "cashbook", `${data.type === "entrada" ? "Entrada" : "Saída"} de ${formatKz(data.amount)} — ${category.name}: ${data.description}`, {
    entityId: _id,
    storeId: account.storeId,
  });
  return { id: _id.toHexString() };
}

export async function voidEntry(db: Db, actor: Actor, idRaw: unknown, reasonRaw: unknown) {
  assertCan(actor, "financas.anular");
  const reason = typeof reasonRaw === "string" ? reasonRaw.trim().slice(0, 200) : "";
  if (!reason) throw new UserError("Indique o motivo da anulação.");
  const entry = await col.cashbook(db).findOne({ _id: oid(idRaw) });
  if (!entry) throw new UserError("Movimento não encontrado.");
  if (entry.voided) throw new UserError("Este movimento já foi anulado.");
  if (entry.source !== "manual" && entry.source !== "contas") throw new UserError("Este movimento é automático. Anule a venda, compra ou documento de origem.");
  assertAccountAccess(actor, entry);
  const voided = { at: new Date(), by: who(actor), reason };
  const filter = entry.transferId ? { transferId: entry.transferId } : { _id: entry._id };
  await col.cashbook(db).updateMany(filter, { $set: { voided } });
  await audit(db, actor, "financas.anular", "cashbook", `Movimento de ${formatKz(entry.amount)} anulado: ${reason}`, { entityId: entry._id, storeId: entry.storeId });
  return {};
}

export async function transferBetweenAccounts(_db: Db, actor: Actor, input: unknown) {
  const data = accountTransferSchema.parse(input);
  assertCan(actor, "financas.contas");
  if (data.fromId === data.toId) throw new UserError("Escolha contas diferentes.");
  return withTx(async (db, session) => {
    const [from, to] = await Promise.all([
      col.accounts(db).findOne({ _id: oid(data.fromId) }, { session }),
      col.accounts(db).findOne({ _id: oid(data.toId) }, { session }),
    ]);
    if (!from || !to || !from.active || !to.active) throw new UserError("Conta inválida.");
    assertAccountAccess(actor, from);
    assertAccountAccess(actor, to);
    const [outCat, inCat] = await Promise.all([systemCategory(db, "transferencia_saida", session), systemCategory(db, "transferencia_entrada", session)]);
    const today = luandaDay();
    const day = data.day ?? today;
    const at = day === today ? new Date() : luandaInstant(day, "12:00");
    const transferId = new ObjectId();
    const desc = data.description || `${from.name} → ${to.name}`;
    const base = { amount: Math.round(data.amount), at, day, source: "contas" as const, transferId, by: who(actor), createdAt: new Date(), description: desc };
    await col.cashbook(db).insertMany(
      [
        { ...base, _id: new ObjectId(), type: "saida", category: { id: outCat._id, name: outCat.name, kind: outCat.kind }, accountId: from._id, storeId: from.storeId },
        { ...base, _id: new ObjectId(), type: "entrada", category: { id: inCat._id, name: inCat.name, kind: inCat.kind }, accountId: to._id, storeId: to.storeId },
      ],
      { session },
    );
    await audit(db, actor, "financas.transferir", "cashbook", `Transferência de ${formatKz(data.amount)}: ${from.name} → ${to.name}`, { entityId: transferId, session });
    return {};
  });
}

export async function saveAccount(db: Db, actor: Actor, idRaw: unknown, input: unknown) {
  assertCan(actor, "financas.contas");
  const data = accountSchema.parse(input);
  const storeId = optOid(data.storeId);
  if (storeId && !canAccessStore(actor, storeId)) throw new UserError("Não tem acesso a esta loja.");
  if (!storeId && !actor.allStores) throw new UserError("Só quem vê todas as lojas pode criar contas gerais.");
  const fields = { name: data.name, type: data.type, storeId, openingBalance: Math.round(data.openingBalance), active: data.active };
  if (idRaw) {
    const id = oid(idRaw);
    const before = await col.accounts(db).findOne({ _id: id });
    if (!before) throw new UserError("Conta não encontrada.");
    assertAccountAccess(actor, before);
    await col.accounts(db).updateOne({ _id: id }, { $set: fields });
    await audit(db, actor, "conta.editar", "account", `Conta ${data.name} alterada`, { entityId: id });
    return { id: id.toHexString() };
  }
  const _id = new ObjectId();
  await col.accounts(db).insertOne({ _id, ...fields, createdAt: new Date() });
  await audit(db, actor, "conta.criar", "account", `Conta ${data.name} criada`, { entityId: _id });
  return { id: _id.toHexString() };
}

export async function saveFinCategory(db: Db, actor: Actor, idRaw: unknown, input: unknown) {
  assertCan(actor, "financas.contas");
  const data = finCategorySchema.parse(input);
  const allowed = data.type === "entrada" ? MANUAL_IN_KINDS : MANUAL_OUT_KINDS;
  if (!allowed.includes(data.kind)) throw new UserError("Tipo de categoria inválido para este sentido.");
  if (idRaw) {
    const id = oid(idRaw);
    const before = await col.finCategories(db).findOne({ _id: id });
    if (!before) throw new UserError("Categoria não encontrada.");
    if (before.key) throw new UserError("As categorias automáticas não podem ser alteradas.");
    await col.finCategories(db).updateOne({ _id: id }, { $set: data });
    return { id: id.toHexString() };
  }
  const _id = new ObjectId();
  await col.finCategories(db).insertOne({ _id, ...data, createdAt: new Date() });
  return { id: _id.toHexString() };
}

/** Saldo de cada conta (saldo inicial + entradas − saídas, ignorando anulados) */
export async function accountBalances(db: Db, accountIds?: ObjectId[]): Promise<Map<string, number>> {
  const match: Record<string, unknown> = { voided: { $exists: false } };
  if (accountIds) match.accountId = { $in: accountIds };
  const rows = await col
    .cashbook(db)
    .aggregate<{ _id: ObjectId; net: number }>([
      { $match: match },
      { $group: { _id: "$accountId", net: { $sum: { $cond: [{ $eq: ["$type", "entrada"] }, "$amount", { $multiply: ["$amount", -1] }] } } } },
    ])
    .toArray();
  return new Map(rows.map((r) => [r._id.toHexString(), r.net]));
}
