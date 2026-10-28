import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb, getSettings } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { ProductForm } from "@/components/products/ProductForm";

export const metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  const ctx = await requirePage("produtos.gerir");
  const db = await getDb();
  const [categories, settings] = await Promise.all([col.categories(db).find().sort({ order: 1 }).toArray(), getSettings(db)]);
  return (
    <>
      <Link href="/produtos" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Produtos
      </Link>
      <PageHeader title="Novo produto" />
      <ProductForm
        initial={null}
        defaultMinQty={settings.lowStockDefault}
        categories={categories.map((c) => ({ id: c._id.toHexString(), name: c.name, type: c.type }))}
        stores={ctx.stores.map((s) => ({ id: s._id.toHexString(), name: s.name }))}
        perms={{ prices: can(ctx.actor, "produtos.precos"), costs: can(ctx.actor, "stock.custos") }}
      />
    </>
  );
}
