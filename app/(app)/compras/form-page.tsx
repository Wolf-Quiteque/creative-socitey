import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { PurchaseForm, type PurchaseState } from "@/components/purchases/PurchaseForm";
import { catalogForForms } from "../stock/shared";

export async function PurchaseFormPage({ initial, title }: { initial: PurchaseState | null; title: string }) {
  const ctx = await requirePage("compras.criar");
  const db = await getDb();
  const stores = ctx.stores.filter((s) => can(ctx.actor, "compras.criar", s._id));
  const [items, suppliers] = await Promise.all([catalogForForms(db, ctx.actor), col.suppliers(db).find({ active: true }).sort({ name: 1 }).toArray()]);
  return (
    <>
      <Link href={initial?.id ? `/compras/${initial.id}` : "/compras"} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <PageHeader title={title} />
      <PurchaseForm
        initial={initial ?? { supplierId: "", storeId: (ctx.store ?? stores[0])?._id.toHexString() ?? "", currency: "AOA", rate: 1, lines: [], extraCosts: [], allocation: "valor" }}
        items={items}
        suppliers={suppliers.map((s) => ({ id: s._id.toHexString(), name: s.name }))}
        stores={stores.map((s) => ({ id: s._id.toHexString(), name: s.name }))}
      />
    </>
  );
}
