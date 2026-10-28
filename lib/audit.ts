import type { ClientSession, Db, ObjectId } from "mongodb";
import { col } from "./db";
import { who, type Actor } from "./actor";

export async function audit(
  db: Db,
  actor: Actor,
  action: string,
  entity: string,
  summary: string,
  opts: { entityId?: ObjectId; storeId?: ObjectId | null; session?: ClientSession } = {},
) {
  await col.audit(db).insertOne(
    { at: new Date(), by: who(actor), action, entity, entityId: opts.entityId, storeId: opts.storeId ?? null, summary } as never,
    { session: opts.session },
  );
}
