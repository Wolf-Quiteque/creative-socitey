import { ObjectId, type Db } from "mongodb";
import { col } from "../db";
import { assertCan, oid, optOid, UserError, type Actor } from "../actor";
import { audit } from "../audit";
import { settingsSchema, storeSchema } from "../validation";
import { ensureStoreCashAccount } from "./finance";

export async function saveStore(db: Db, actor: Actor, idRaw: unknown, input: unknown) {
  assertCan(actor, "lojas.gerir");
  const data = storeSchema.parse(input);
  const id = optOid(idRaw);
  const clash = await col.stores(db).findOne({ code: data.code, ...(id ? { _id: { $ne: id } } : {}) });
  if (clash) throw new UserError(`O código ${data.code} já é usado pela loja ${clash.name}.`);
  const bankAccountId = optOid(data.bankAccountId);
  if (bankAccountId && !(await col.accounts(db).findOne({ _id: bankAccountId }))) throw new UserError("Conta bancária inválida.");
  const now = new Date();
  const fields = { ...data, bankAccountId: bankAccountId ?? undefined, updatedAt: now };
  if (id) {
    const before = await col.stores(db).findOne({ _id: id });
    if (!before) throw new UserError("Loja não encontrada.");
    if (!actor.allStores && !actor.storeIds.includes(id.toHexString())) throw new UserError("Não tem acesso a esta loja.");
    await col.stores(db).updateOne({ _id: id }, { $set: fields });
    await ensureStoreCashAccount(db, { ...before, ...fields });
    await audit(db, actor, "loja.editar", "store", `Loja ${data.name} alterada`, { entityId: id, storeId: id });
    return { id: id.toHexString() };
  }
  if (!actor.allStores) throw new UserError("Só quem vê todas as lojas pode abrir lojas novas.");
  const _id = new ObjectId();
  const store = { _id, ...fields, createdAt: now };
  await col.stores(db).insertOne(store);
  await ensureStoreCashAccount(db, store);
  await audit(db, actor, "loja.criar", "store", `Loja ${data.name} (${data.code}) aberta`, { entityId: _id, storeId: _id });
  return { id: _id.toHexString() };
}

export async function saveSettings(db: Db, actor: Actor, input: unknown) {
  assertCan(actor, "definicoes.gerir");
  const data = settingsSchema.parse(input);
  await col.settings(db).updateOne({ _id: "app" }, { $set: { ...data, updatedAt: new Date() } }, { upsert: true });
  await audit(db, actor, "definicoes.editar", "settings", "Definições gerais alteradas");
  return {};
}

