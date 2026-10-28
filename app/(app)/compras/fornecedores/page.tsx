import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { SuppliersEditor } from "@/components/purchases/SuppliersEditor";
import { PurchaseTabs } from "../shared";

export const metadata = { title: "Fornecedores" };

export default async function SuppliersPage() {
  const ctx = await requirePage(["compras.ver", "fornecedores.gerir"]);
  const db = await getDb();
  const [list, totals] = await Promise.all([
    col.suppliers(db).find().sort({ name: 1 }).toArray(),
    col
      .purchases(db)
      .aggregate<{ _id: string; total: number; owed: number; n: number }>([
        { $match: { status: { $ne: "cancelada" }, supplierId: { $ne: null } } },
        { $group: { _id: { $toString: "$supplierId" }, total: { $sum: "$total" }, owed: { $sum: { $subtract: ["$total", "$paid"] } }, n: { $sum: 1 } } },
      ])
      .toArray(),
  ]);
  const t = new Map(totals.map((x) => [x._id, x]));
  return (
    <>
      <PageHeader title="Compras" description="Fornecedores, quanto já lhes comprou e quanto falta pagar." />
      <PurchaseTabs />
      <SuppliersEditor
        canEdit={can(ctx.actor, "fornecedores.gerir")}
        suppliers={list.map((s) => ({
          id: s._id.toHexString(),
          name: s.name,
          contact: s.contact,
          phone: s.phone,
          country: s.country,
          notes: s.notes,
          active: s.active,
          total: t.get(s._id.toHexString())?.total ?? 0,
          owed: t.get(s._id.toHexString())?.owed ?? 0,
          count: t.get(s._id.toHexString())?.n ?? 0,
        }))}
      />
    </>
  );
}
