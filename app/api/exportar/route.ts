import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth/session";
import { can, canAccessStore, storeMatch } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { rangeOf, resolvePeriod, luandaDay } from "@/lib/time";
import { formatDateTime } from "@/lib/format";
import { storeNames } from "@/lib/queries";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";

const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  // Evita que o Excel execute fórmulas vindas de dados
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const toCsv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !can(s.actor, "financas.relatorios")) return new NextResponse("Sem acesso.", { status: 403 });
  const p = req.nextUrl.searchParams;
  const { from, to } = resolvePeriod("personalizado", p.get("de") ?? undefined, p.get("ate") ?? undefined);
  const { start, end } = rangeOf(from, to);
  const loja = p.get("loja");
  let storeId: ObjectId | null = null;
  if (loja) {
    if (!ObjectId.isValid(loja) || !canAccessStore(s.actor, loja)) return new NextResponse("Sem acesso.", { status: 403 });
    storeId = new ObjectId(loja);
  }
  const db = await getDb();
  const names = await storeNames(db);
  const tipo = p.get("tipo");
  let rows: unknown[][];
  if (tipo === "vendas") {
    const sales = await col.sales(db).find({ createdAt: { $gte: start, $lt: end }, ...storeMatch(s.actor, "storeId", storeId) }).sort({ createdAt: 1 }).toArray();
    rows = [["Número", "Data", "Loja", "Vendedor", "Estado", "Artigo", "SKU", "Qtd", "Devolvido", "Preço unit.", "Total linha", "Custo unit.", "Pagamento"]];
    for (const x of sales)
      for (const l of x.lines)
        rows.push([x.number, formatDateTime(x.createdAt), names[x.storeId.toHexString()], x.seller.name, x.status, l.name, l.sku, l.qty, l.returnedQty, l.unitPrice, l.lineTotal, l.unitCost, x.payments.map((m) => PAYMENT_METHODS[m.method as PaymentMethod]).join(" + ")]);
  } else {
    const match: Record<string, unknown> = { at: { $gte: start, $lt: end } };
    if (storeId) match.storeId = storeId;
    else if (!s.actor.allStores) match.storeId = { $in: s.actor.storeIds.map((x) => new ObjectId(x)) };
    const entries = await col.cashbook(db).find(match).sort({ at: 1 }).toArray();
    const accounts = new Map((await col.accounts(db).find().toArray()).map((a) => [a._id.toHexString(), a.name]));
    rows = [["Data", "Sentido", "Valor", "Categoria", "Natureza", "Conta", "Loja", "Descrição", "Registado por", "Anulado"]];
    for (const e of entries)
      rows.push([formatDateTime(e.at), e.type, e.amount, e.category.name, e.category.kind, accounts.get(e.accountId.toHexString()), e.storeId ? names[e.storeId.toHexString()] : "Geral", e.description, e.by.name, e.voided ? `Sim: ${e.voided.reason}` : ""]);
  }
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo === "vendas" ? "vendas" : "entradas-saidas"}_${from}_${to}_${luandaDay()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
