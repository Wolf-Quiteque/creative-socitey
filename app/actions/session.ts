"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { col, getDb } from "@/lib/db";
import { canAccessStore, UserError } from "@/lib/actor";
import { clearSessionCookie, clientIp, createSession, getSession } from "@/lib/auth/session";
import { STORE_COOKIE } from "@/lib/auth/guards";
import { rateLimit, TOO_MANY } from "@/lib/ratelimit";
import { act } from "@/lib/action";
import { changeOwnPin } from "@/lib/domain/team";
import type { ActionResult } from "@/lib/types";

// Hash fixo para comparar quando a conta não existe (o tempo de resposta não denuncia nada)
const DUMMY_HASH = bcrypt.hashSync("conta-inexistente", 10);
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;

export async function loginWithPin(identifier: string, pin: string): Promise<ActionResult> {
  const id = String(identifier ?? "").trim().toLowerCase();
  if (!id || !/^\d{4,6}$/.test(String(pin ?? ""))) return { ok: false, error: "Escreva o utilizador ou telefone e o PIN." };
  const db = await getDb();
  const ip = await clientIp();
  if (!(await rateLimit(db, `pin-ip:${ip}`, 40, 15 * 60))) return { ok: false, error: TOO_MANY };

  const phone = id.replace(/\D/g, "").replace(/^244(?=9\d{8}$)/, "");
  const user = await col.users(db).findOne({ $or: [{ username: id }, ...(/^9\d{8}$/.test(phone) ? [{ phone }] : [])] });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const min = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Conta bloqueada por demasiadas tentativas. Tente daqui a ${min} min ou peça ao responsável para mudar o PIN.` };
  }
  const ok = await bcrypt.compare(String(pin), user?.pinHash ?? DUMMY_HASH);
  if (!user || !user.pinHash || !ok || !user.active) {
    if (user?.pinHash) {
      const failures = (user.pinFailures ?? 0) + 1;
      await col.users(db).updateOne(
        { _id: user._id },
        failures >= LOCK_AFTER ? { $set: { pinFailures: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000) } } : { $set: { pinFailures: failures } },
      );
      if (failures >= LOCK_AFTER) return { ok: false, error: `PIN errado ${LOCK_AFTER} vezes. A conta ficou bloqueada ${LOCK_MINUTES} minutos.` };
    }
    if (user && !user.active) return { ok: false, error: "Esta conta está desativada." };
    return { ok: false, error: "Utilizador ou PIN errado." };
  }
  await col.users(db).updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), pinFailures: 0 }, $unset: { lockedUntil: "" } });
  await createSession(user);
  return { ok: true };
}

export async function loginWithPassword(email: string, password: string): Promise<ActionResult> {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e || !password) return { ok: false, error: "Escreva o email (ou utilizador) e a palavra-passe." };
  if (String(password).length > 72) return { ok: false, error: "Email ou palavra-passe errados." };
  const db = await getDb();
  const ip = await clientIp();
  if (!(await rateLimit(db, `pw-ip:${ip}`, 20, 15 * 60)) || !(await rateLimit(db, `pw-email:${e}`, 10, 15 * 60))) return { ok: false, error: TOO_MANY };
  const user = await col.users(db).findOne({ passwordHash: { $exists: true }, $or: [{ email: e }, { username: e }] });
  const ok = await bcrypt.compare(String(password), user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok || !user.active) return { ok: false, error: "Email ou palavra-passe errados." };
  await col.users(db).updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  await createSession(user);
  return { ok: true };
}

export async function logout() {
  const s = await getSession();
  if (s) {
    const db = await getDb();
    await col.users(db).updateOne({ _id: s.user._id }, { $inc: { sessionVersion: 1 } });
  }
  await clearSessionCookie();
  redirect("/entrar");
}

/** Escolhe a loja com que se está a trabalhar ("all" = todas) */
export async function setCurrentStore(storeId: string): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return { ok: false, error: "Sessão terminada." };
  if (storeId === "all") {
    if (!s.actor.allStores) return { ok: false, error: "Sem acesso a todas as lojas." };
  } else if (!ObjectId.isValid(storeId) || !canAccessStore(s.actor, storeId)) {
    return { ok: false, error: "Sem acesso a esta loja." };
  }
  (await cookies()).set(STORE_COOKIE, storeId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365, secure: process.env.NODE_ENV === "production" });
  refresh();
  return { ok: true };
}

export async function changePinAction(current: string, next: string) {
  return act(({ db, actor }) => changeOwnPin(db, actor, current, next), { message: "PIN alterado." });
}

export async function changePasswordAction(current: string, next: string): Promise<ActionResult> {
  return act(async ({ db, user }) => {
    if (!user.passwordHash) throw new UserError("Esta conta usa PIN.");
    if (!(await bcrypt.compare(String(current), user.passwordHash))) throw new UserError("A palavra-passe atual está errada.");
    if (typeof next !== "string" || next.length < 10 || next.length > 72) throw new UserError("A nova palavra-passe deve ter entre 10 e 72 caracteres.");
    await col.users(db).updateOne({ _id: user._id }, { $set: { passwordHash: await bcrypt.hash(next, 12), updatedAt: new Date() } });
    return {};
  }, { message: "Palavra-passe alterada." });
}
