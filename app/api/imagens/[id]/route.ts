import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { col, getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/actor";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) return new NextResponse(null, { status: 404 });
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401 });
  const img = await col.images(await getDb()).findOne({ _id: new ObjectId(id) });
  if (!img) return new NextResponse(null, { status: 404 });
  // Fotos de recibos de despesas só para quem vê finanças
  if (img.kind === "recibo" && !can(session.actor, "financas.ver")) return new NextResponse(null, { status: 403 });
  return new NextResponse(Buffer.from(img.data.buffer), {
    headers: { "Content-Type": img.contentType, "Cache-Control": "private, max-age=31536000, immutable", "Content-Length": String(img.size) },
  });
}
