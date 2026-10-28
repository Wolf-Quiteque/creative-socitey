import { NextResponse, type NextRequest } from "next/server";
import { Binary, ObjectId } from "mongodb";
import sharp, { type OutputInfo } from "sharp";
import { col, getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/actor";
import { rateLimit } from "@/lib/ratelimit";

const MAX_BYTES = 8 * 1024 * 1024;

/** Recebe uma foto, converte em WebP pequeno e guarda no Mongo */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sessão terminada." }, { status: 401 });
  const kind = req.nextUrl.searchParams.get("tipo") === "recibo" ? "recibo" : "produto";
  const allowed = kind === "produto" ? can(session.actor, "produtos.gerir") : can(session.actor, "financas.saida") || can(session.actor, "financas.entrada");
  if (!allowed) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return NextResponse.json({ error: "A foto é demasiado grande (máx. 8 MB)." }, { status: 413 });
  const db = await getDb();
  if (!(await rateLimit(db, `upload:${session.user._id.toHexString()}`, 60, 3600))) return NextResponse.json({ error: "Demasiados envios. Tente mais tarde." }, { status: 429 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Escolha uma foto." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "A foto é demasiado grande (máx. 8 MB)." }, { status: 413 });
  let out: { data: Buffer; info: OutputInfo };
  try {
    const max = kind === "produto" ? 800 : 1400;
    out = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: max, height: max, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível ler esta imagem." }, { status: 400 });
  }
  const _id = new ObjectId();
  await col.images(db).insertOne({
    _id,
    kind,
    data: new Binary(out.data),
    contentType: "image/webp",
    width: out.info.width,
    height: out.info.height,
    size: out.data.length,
    createdBy: session.user._id,
    createdAt: new Date(),
  });
  return NextResponse.json({ id: _id.toHexString() });
}
