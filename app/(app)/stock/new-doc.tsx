import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can, canAccessStore } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { stockMap, usableAccounts } from "@/lib/queries";
import type { Permission } from "@/lib/permissions";
import { PageHeader } from "@/components/ui/card";
import { StockDocForm } from "@/components/stock/StockDocForm";
import { catalogForForms } from "./shared";

export async function NewDocPage({ mode, perm, title, description, back }: { mode: "transferencia" | "saida" | "ajuste"; perm: Permission; title: string; description: string; back: string }) {
  const ctx = await requirePage(perm);
  const { actor } = ctx;
  const db = await getDb();
  const allStores = await col.stores(db).find({ active: true }).sort({ name: 1 }).toArray();
  const mine = ctx.stores.filter((s) => can(actor, perm, s._id));
  const [items, map, accounts] = await Promise.all([
    catalogForForms(db, actor),
    stockMap(db, mine.map((s) => s._id)),
    mode === "transferencia" && can(actor, "financas.saida") ? usableAccounts(db, actor) : Promise.resolve(undefined),
  ]);
  const def = ctx.store && canAccessStore(actor, ctx.store._id) ? ctx.store._id.toHexString() : (mine[0]?._id.toHexString() ?? "");
  return (
    <>
      <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <PageHeader title={title} description={description} />
      {mine.length === 0 ? (
        <p className="text-muted">Não tem lojas onde possa fazer isto.</p>
      ) : (
        <StockDocForm
          mode={mode}
          items={items}
          stores={mine.map((s) => ({ id: s._id.toHexString(), name: s.name }))}
          destinations={allStores.map((s) => ({ id: s._id.toHexString(), name: s.name }))}
          stock={map}
          defaultStoreId={def}
          accounts={accounts?.map((a) => ({ id: a.id, name: a.name }))}
        />
      )}
    </>
  );
}
