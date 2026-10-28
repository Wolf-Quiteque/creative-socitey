import "server-only";
import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { col, getDb, type UserDoc } from "../db";
import { buildActor, type Actor } from "../actor";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-cs_session" : "cs_session";
const ISSUER = "creative-society";
const AUDIENCE = "cs-gestao";
const OWNER_MAX_AGE = 60 * 60 * 24 * 30; // 30 dias
const STAFF_MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET em falta ou com menos de 32 caracteres no ficheiro .env");
  return new TextEncoder().encode(s);
}

export async function createSession(user: Pick<UserDoc, "_id" | "sessionVersion" | "isOwner">) {
  const maxAge = user.isOwner ? OWNER_MAX_AGE : STAFF_MAX_AGE;
  const token = await new SignJWT({ sv: user.sessionVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(user._id.toHexString())
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type SessionInfo = { user: UserDoc; actor: Actor };

/** Utilizador da sessão, confirmado na base de dados (cargo e permissões vêm sempre da BD) */
export async function getSession(): Promise<SessionInfo | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let sub: string | undefined;
  let sv: unknown;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    sub = payload.sub;
    sv = payload.sv;
  } catch {
    return null;
  }
  if (!sub || !ObjectId.isValid(sub)) return null;
  const db = await getDb();
  const user = await col.users(db).findOne({ _id: new ObjectId(sub) });
  if (!user || !user.active || (user.sessionVersion ?? 0) !== sv) return null;
  const role = user.roleId ? await col.roles(db).findOne({ _id: user.roleId }) : null;
  return { user, actor: buildActor(user, role) };
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
