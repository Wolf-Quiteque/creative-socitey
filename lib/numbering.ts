import type { ClientSession, Db } from "mongodb";
import { col } from "./db";
import { luandaDay } from "./time";

/** Próximo número de um documento, ex.: TAL-26-00042 ou TRF-26-0007 */
export async function nextNumber(db: Db, prefix: string, digits: number, session?: ClientSession): Promise<string> {
  const yy = luandaDay().slice(2, 4);
  const key = `${prefix}-${yy}`;
  const res = await col.counters(db).findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after", session },
  );
  return `${key}-${String(res!.seq).padStart(digits, "0")}`;
}
