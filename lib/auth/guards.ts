import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { col, getDb, type StoreDoc } from "../db";
import { can, canAccessStore, type Actor } from "../actor";
import type { Permission } from "../permissions";
import { getSession, type SessionInfo } from "./session";

export const STORE_COOKIE = "cs_store";

/** Sessão do pedido atual (memorizada durante o render) */
export const currentSession = cache(async (): Promise<SessionInfo | null> => getSession());

export async function requireSession(): Promise<SessionInfo> {
  const s = await currentSession();
  if (!s) redirect("/entrar");
  return s;
}

export type AppContext = SessionInfo & {
  stores: StoreDoc[];
  /** Loja escolhida no seletor; null = todas as lojas */
  storeId: ObjectId | null;
  store: StoreDoc | null;
};

/** Sessão + lojas acessíveis + loja escolhida no seletor */
export const appContext = cache(async (): Promise<AppContext> => {
  const session = await requireSession();
  const { actor } = session;
  const db = await getDb();
  const all = await col.stores(db).find({ active: true }).sort({ name: 1 }).toArray();
  const stores = all.filter((s) => canAccessStore(actor, s._id));
  const chosen = (await cookies()).get(STORE_COOKIE)?.value;
  let store: StoreDoc | null = stores.find((s) => s._id.toHexString() === chosen) ?? null;
  // Quem vê todas as lojas começa em "Todas"; os outros trabalham sempre numa loja concreta
  if (!store && !(actor.allStores && stores.length > 1)) store = stores[0] ?? null;
  return { ...session, stores, store, storeId: store?._id ?? null };
});

/** Para páginas: exige a permissão (ou uma de várias), senão mostra a página "sem acesso" */
export async function requirePage(perm: Permission | Permission[]): Promise<AppContext> {
  const ctx = await appContext();
  const list = Array.isArray(perm) ? perm : [perm];
  if (!list.some((p) => can(ctx.actor, p))) redirect("/sem-acesso");
  return ctx;
}

export function hasPerm(actor: Actor, perm: Permission) {
  return actor.perms.has(perm);
}
