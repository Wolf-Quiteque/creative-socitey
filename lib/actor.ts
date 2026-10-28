import { ObjectId, type Db, type ClientSession } from "mongodb";
import { ALL_PERMISSIONS, PERMISSION_LABEL, type Permission } from "./permissions";
import { col, type RoleDoc, type UserDoc, type Who } from "./db";

/** Erro com mensagem pensada para mostrar ao utilizador */
export class UserError extends Error {}

/** Quem está a fazer a ação, com as permissões já calculadas */
export type Actor = {
  id: ObjectId;
  name: string;
  isOwner: boolean;
  perms: ReadonlySet<Permission>;
  allStores: boolean;
  storeIds: string[];
  maxDiscountPct: number;
  roleName: string;
};

export function effectivePermissions(user: Pick<UserDoc, "isOwner" | "extraPermissions" | "removedPermissions">, role: Pick<RoleDoc, "permissions"> | null): Set<Permission> {
  if (user.isOwner) return new Set(ALL_PERMISSIONS);
  const set = new Set<Permission>([...(role?.permissions ?? []), ...(user.extraPermissions ?? [])]);
  for (const p of user.removedPermissions ?? []) set.delete(p);
  return set;
}

export function buildActor(user: UserDoc, role: RoleDoc | null): Actor {
  return {
    id: user._id,
    name: user.name,
    isOwner: user.isOwner,
    perms: effectivePermissions(user, role),
    allStores: user.isOwner || user.allStores,
    storeIds: user.storeIds.map((s) => s.toHexString()),
    maxDiscountPct: user.isOwner ? 100 : (role?.maxDiscountPct ?? 0),
    roleName: user.isOwner ? "Dono" : (role?.name ?? "Sem cargo"),
  };
}

export async function loadActor(db: Db, userId: ObjectId, session?: ClientSession): Promise<Actor | null> {
  const user = await col.users(db).findOne({ _id: userId }, { session });
  if (!user || !user.active) return null;
  const role = user.roleId ? await col.roles(db).findOne({ _id: user.roleId }, { session }) : null;
  return buildActor(user, role);
}

export const who = (a: Actor): Who => ({ id: a.id, name: a.name });

const hex = (v: ObjectId | string) => (typeof v === "string" ? v : v.toHexString());

export function canAccessStore(a: Actor, storeId: ObjectId | string | null | undefined): boolean {
  if (a.allStores) return true;
  if (!storeId) return false;
  return a.storeIds.includes(hex(storeId));
}

/** Tem a permissão (e, se indicada, acesso à loja) */
export function can(a: Actor, perm: Permission, storeId?: ObjectId | string | null): boolean {
  if (!a.perms.has(perm)) return false;
  if (storeId !== undefined) return canAccessStore(a, storeId);
  return true;
}

export function canAny(a: Actor, perms: Permission[]): boolean {
  return perms.some((p) => a.perms.has(p));
}

export function assertCan(a: Actor, perm: Permission, storeId?: ObjectId | string | null) {
  if (!a.perms.has(perm)) throw new UserError(`Sem permissão: ${PERMISSION_LABEL[perm]}.`);
  if (storeId !== undefined && !canAccessStore(a, storeId)) throw new UserError("Não tem acesso a esta loja.");
}

export function assertStore(a: Actor, storeId: ObjectId | string | null | undefined) {
  if (!canAccessStore(a, storeId)) throw new UserError("Não tem acesso a esta loja.");
}

/** Lojas visíveis para o utilizador (null = todas) */
export function storeScope(a: Actor): ObjectId[] | null {
  return a.allStores ? null : a.storeIds.map((s) => new ObjectId(s));
}

/** Filtro Mongo por loja, já limitado ao que o utilizador pode ver */
export function storeMatch(a: Actor, field: string, selected?: ObjectId | null): Record<string, unknown> {
  if (selected) {
    if (!canAccessStore(a, selected)) return { [field]: { $in: [] } };
    return { [field]: selected };
  }
  const scope = storeScope(a);
  return scope ? { [field]: { $in: scope } } : {};
}

export function oid(id: unknown, what = "Identificador"): ObjectId {
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)) throw new UserError(`${what} inválido.`);
  return new ObjectId(id);
}

export function optOid(id: unknown): ObjectId | null {
  if (id === null || id === undefined || id === "") return null;
  return oid(id);
}
