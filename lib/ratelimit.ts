import type { Db } from "mongodb";

type Bucket = { _id: string; count: number; expiresAt: Date };

/** Limite de pedidos por chave numa janela (guardado no Mongo, funciona com várias instâncias) */
export async function rateLimit(db: Db, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const coll = db.collection<Bucket>("ratelimits");
  const now = new Date();
  const hit = await coll.findOneAndUpdate({ _id: key, expiresAt: { $gt: now } }, { $inc: { count: 1 } }, { returnDocument: "after" });
  if (hit) return hit.count <= limit;
  await coll.updateOne({ _id: key }, { $set: { count: 1, expiresAt: new Date(now.getTime() + windowSeconds * 1000) } }, { upsert: true });
  return true;
}

export const TOO_MANY = "Demasiadas tentativas. Aguarde alguns minutos e tente de novo.";
