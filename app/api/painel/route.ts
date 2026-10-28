import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { can, canAccessStore } from "@/lib/actor";
import { liveStats } from "@/lib/domain/reports";

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !can(s.actor, "painel.ver")) return NextResponse.json({ error: "Sem acesso." }, { status: 401 });
  const store = req.nextUrl.searchParams.get("loja");
  let storeId: ObjectId | null = null;
  if (store && store !== "all") {
    if (!ObjectId.isValid(store) || !canAccessStore(s.actor, store)) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    storeId = new ObjectId(store);
  }
  const stats = await liveStats(await getDb(), s.actor, storeId);
  if (!can(s.actor, "painel.lucros")) stats.profit = 0;
  return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
}
