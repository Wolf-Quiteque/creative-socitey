import { requirePage } from "@/lib/auth/guards";
import { col, getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { StoresEditor } from "@/components/admin/StoresEditor";

export const metadata = { title: "Lojas" };

export default async function StoresPage() {
  const ctx = await requirePage("lojas.gerir");
  const db = await getDb();
  const [stores, banks, staff] = await Promise.all([
    col.stores(db).find(ctx.actor.allStores ? {} : { _id: { $in: ctx.stores.map((s) => s._id) } }).sort({ active: -1, name: 1 }).toArray(),
    col.accounts(db).find({ type: { $ne: "caixa" }, active: true }).sort({ name: 1 }).toArray(),
    col.users(db).aggregate<{ _id: string; n: number }>([{ $match: { active: true, isOwner: false } }, { $unwind: "$storeIds" }, { $group: { _id: { $toString: "$storeIds" }, n: { $sum: 1 } } }]).toArray(),
  ]);
  const n = new Map(staff.map((s) => [s._id, s.n]));
  return (
    <>
      <PageHeader title="Lojas" description="Cada loja tem o seu stock, a sua caixa e a sua equipa." />
      <StoresEditor
        canCreate={ctx.actor.allStores}
        banks={banks.map((b) => ({ id: b._id.toHexString(), name: b.name }))}
        stores={stores.map((s) => ({
          id: s._id.toHexString(),
          name: s.name,
          code: s.code,
          address: s.address ?? "",
          city: s.city ?? "",
          phone: s.phone ?? "",
          receiptFooter: s.receiptFooter ?? "",
          allowNegativeStock: s.allowNegativeStock,
          requireOpenTill: s.requireOpenTill,
          bankAccountId: s.bankAccountId?.toHexString() ?? "",
          active: s.active,
          staff: n.get(s._id.toHexString()) ?? 0,
        }))}
      />
    </>
  );
}
