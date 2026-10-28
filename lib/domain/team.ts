import { ObjectId, type Db } from "mongodb";
import bcrypt from "bcryptjs";
import { col, type UserDoc } from "../db";
import { assertCan, oid, optOid, UserError, type Actor } from "../actor";
import { audit } from "../audit";
import { roleSchema, userSchema, zPin } from "../validation";
import { PERMISSION_LABEL, type Permission } from "../permissions";

export const PIN_ROUNDS = 10;

/** Ninguém pode dar permissões que não tem */
function assertGrantable(actor: Actor, perms: Permission[]) {
  if (actor.isOwner) return;
  const missing = perms.filter((p) => !actor.perms.has(p));
  if (missing.length) throw new UserError(`Não pode dar permissões que não tem: ${missing.map((p) => PERMISSION_LABEL[p]).join(", ")}.`);
}

function assertStoresGrantable(actor: Actor, allStores: boolean, storeIds: string[]) {
  if (actor.allStores) return;
  if (allStores) throw new UserError("Só quem vê todas as lojas pode dar acesso a todas as lojas.");
  const outside = storeIds.filter((s) => !actor.storeIds.includes(s));
  if (outside.length) throw new UserError("Só pode dar acesso às lojas a que também tem acesso.");
}

export async function saveUser(db: Db, actor: Actor, idRaw: unknown, input: unknown) {
  assertCan(actor, "equipa.gerir");
  const data = userSchema.parse(input);
  const id = optOid(idRaw);
  const before = id ? await col.users(db).findOne({ _id: id }) : null;
  if (id && !before) throw new UserError("Pessoa não encontrada.");
  if (before?.isOwner && !actor.isOwner) throw new UserError("Só o dono pode alterar a conta do dono.");
  if (before && before._id.equals(actor.id) && !actor.isOwner) throw new UserError("Não pode alterar o próprio cargo ou acessos. Peça a outra pessoa.");

  const roleId = optOid(data.roleId);
  const role = roleId ? await col.roles(db).findOne({ _id: roleId }) : null;
  if (roleId && !role) throw new UserError("Cargo inválido.");
  if (!before?.isOwner) {
    assertGrantable(actor, [...(role?.permissions ?? []), ...data.extraPermissions]);
    assertStoresGrantable(actor, data.allStores, data.storeIds);
  }
  if (!data.allStores && !data.storeIds.length && !before?.isOwner) throw new UserError("Escolha pelo menos uma loja para esta pessoa.");

  const clash = await col.users(db).findOne({
    $or: [{ username: data.username }, ...(data.phone ? [{ phone: data.phone }] : [])],
    ...(id ? { _id: { $ne: id } } : {}),
  });
  if (clash) throw new UserError(clash.username === data.username ? `O utilizador «${data.username}» já existe.` : "Esse telefone já está associado a outra pessoa.");

  const now = new Date();
  const fields: Partial<UserDoc> = {
    name: data.name,
    username: data.username,
    phone: data.phone,
    roleId,
    allStores: data.allStores,
    storeIds: data.storeIds.map((s) => new ObjectId(s)),
    extraPermissions: data.extraPermissions,
    removedPermissions: data.removedPermissions,
    jobTitle: data.jobTitle,
    notes: data.notes,
    updatedAt: now,
  };

  if (before) {
    const unset: Record<string, ""> = {};
    if (!data.phone) unset.phone = "";
    const set = { ...fields };
    delete set.phone;
    if (data.phone) set.phone = data.phone;
    if (data.pin) {
      set.pinHash = await bcrypt.hash(data.pin, PIN_ROUNDS);
      set.sessionVersion = (before.sessionVersion ?? 0) + 1;
      set.pinFailures = 0;
      unset.lockedUntil = "";
    }
    // Mudar cargo/lojas termina as sessões abertas para aplicar já as novas regras
    const accessChanged =
      String(before.roleId) !== String(roleId) || before.allStores !== data.allStores || before.storeIds.map(String).sort().join() !== [...data.storeIds].sort().join();
    if (accessChanged && !data.pin) set.sessionVersion = (before.sessionVersion ?? 0) + 1;
    await col.users(db).updateOne({ _id: before._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
    await audit(db, actor, "pessoa.editar", "user", `Conta de ${data.name} alterada${data.pin ? " (PIN novo)" : ""}`, { entityId: before._id });
    return { id: before._id.toHexString() };
  }

  if (!data.pin) throw new UserError("Defina um PIN de 4 a 6 algarismos para a primeira entrada.");
  const _id = new ObjectId();
  await col.users(db).insertOne({
    _id,
    ...(fields as Omit<UserDoc, "_id">),
    isOwner: false,
    pinHash: await bcrypt.hash(data.pin, PIN_ROUNDS),
    active: true,
    sessionVersion: 0,
    createdAt: now,
  });
  await audit(db, actor, "pessoa.criar", "user", `Conta criada para ${data.name} (${role?.name ?? "sem cargo"})`, { entityId: _id });
  return { id: _id.toHexString() };
}

export async function setUserActive(db: Db, actor: Actor, idRaw: unknown, active: unknown) {
  assertCan(actor, "equipa.gerir");
  if (typeof active !== "boolean") throw new UserError("Valor inválido.");
  const id = oid(idRaw);
  const u = await col.users(db).findOne({ _id: id });
  if (!u) throw new UserError("Pessoa não encontrada.");
  if (u.isOwner) throw new UserError("A conta do dono não pode ser desativada.");
  if (u._id.equals(actor.id)) throw new UserError("Não pode desativar a própria conta.");
  if (!actor.allStores && (u.allStores || u.storeIds.some((s) => !actor.storeIds.includes(s.toHexString())))) throw new UserError("Esta pessoa trabalha em lojas a que não tem acesso.");
  await col.users(db).updateOne({ _id: id }, { $set: { active, updatedAt: new Date() }, $inc: { sessionVersion: 1 } });
  await audit(db, actor, active ? "pessoa.ativar" : "pessoa.desativar", "user", `${u.name} ${active ? "reativado(a)" : "desativado(a)"}`, { entityId: id });
  return {};
}

export async function changeOwnPin(db: Db, actor: Actor, currentRaw: unknown, nextRaw: unknown) {
  const next = zPin.parse(nextRaw);
  const u = await col.users(db).findOne({ _id: actor.id });
  if (!u?.pinHash) throw new UserError("Esta conta não usa PIN.");
  if (typeof currentRaw !== "string" || !(await bcrypt.compare(currentRaw, u.pinHash))) throw new UserError("O PIN atual está errado.");
  await col.users(db).updateOne({ _id: u._id }, { $set: { pinHash: await bcrypt.hash(next, PIN_ROUNDS), updatedAt: new Date() } });
  return {};
}

export async function saveRole(db: Db, actor: Actor, idRaw: unknown, input: unknown) {
  assertCan(actor, "cargos.gerir");
  const data = roleSchema.parse(input);
  assertGrantable(actor, data.permissions);
  if (!actor.isOwner && data.maxDiscountPct > actor.maxDiscountPct) throw new UserError("Não pode dar um desconto máximo maior que o seu.");
  const now = new Date();
  const id = optOid(idRaw);
  const clash = await col.roles(db).findOne({ name: data.name, ...(id ? { _id: { $ne: id } } : {}) });
  if (clash) throw new UserError(`Já existe um cargo chamado «${data.name}».`);
  if (id) {
    const before = await col.roles(db).findOne({ _id: id });
    if (!before) throw new UserError("Cargo não encontrado.");
    // Não deixar retirar permissões que o próprio não tem (seria dar a volta à regra)
    assertGrantable(actor, before.permissions.filter((p) => !data.permissions.includes(p)));
    await col.roles(db).updateOne({ _id: id }, { $set: { ...data, updatedAt: now } });
    await audit(db, actor, "cargo.editar", "role", `Cargo «${data.name}» alterado (${data.permissions.length} permissões)`, { entityId: id });
    return { id: id.toHexString() };
  }
  const _id = new ObjectId();
  await col.roles(db).insertOne({ _id, ...data, createdAt: now, updatedAt: now });
  await audit(db, actor, "cargo.criar", "role", `Cargo «${data.name}» criado`, { entityId: _id });
  return { id: _id.toHexString() };
}

export async function deleteRole(db: Db, actor: Actor, idRaw: unknown) {
  assertCan(actor, "cargos.gerir");
  const id = oid(idRaw);
  const used = await col.users(db).countDocuments({ roleId: id });
  if (used) throw new UserError(`Há ${used} pessoa(s) com este cargo. Mude-as de cargo primeiro.`);
  const role = await col.roles(db).findOne({ _id: id });
  await col.roles(db).deleteOne({ _id: id });
  await audit(db, actor, "cargo.apagar", "role", `Cargo «${role?.name}» apagado`, { entityId: id });
  return {};
}
