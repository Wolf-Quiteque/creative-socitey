import "server-only";
import { refresh } from "next/cache";
import { ZodError } from "zod";
import type { Db } from "mongodb";
import { getDb, type UserDoc } from "./db";
import { UserError, type Actor } from "./actor";
import { getSession } from "./auth/session";
import type { ActionResult } from "./types";

type Ctx = { db: Db; actor: Actor; user: UserDoc };

/**
 * Envolve uma Server Action: confirma a sessão, corre a ação, converte erros em mensagens
 * claras e atualiza a página no fim. As ações são endpoints públicos: as regras ficam no domínio.
 */
export async function act<T extends object>(fn: (ctx: Ctx) => Promise<T>, opts: { message?: string; refresh?: boolean } = {}): Promise<ActionResult<T>> {
  try {
    const session = await getSession();
    if (!session) return { ok: false, error: "A sessão terminou. Entre de novo." };
    const db = await getDb();
    const out = await fn({ db, actor: session.actor, user: session.user });
    if (opts.refresh !== false) refresh();
    return { ok: true, ...(opts.message ? { message: opts.message } : {}), ...out };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof UserError) return err.message;
  if (err instanceof ZodError) return err.issues[0]?.message ?? "Dados inválidos.";
  if ((err as { code?: number })?.code === 11000) return "Já existe um registo com esses dados.";
  console.error("[ação]", err);
  return "Ocorreu um erro inesperado. Tente de novo.";
}
