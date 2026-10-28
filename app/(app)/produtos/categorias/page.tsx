import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { CategoriesEditor } from "@/components/products/CategoriesEditor";
import { ProductTabs } from "../tabs";

export const metadata = { title: "Categorias" };

export default async function CategoriesPage() {
  const ctx = await requirePage("produtos.ver");
  const db = await getDb();
  const [cats, counts] = await Promise.all([
    col.categories(db).find().sort({ order: 1 }).toArray(),
    col.products(db).aggregate<{ _id: string; n: number }>([{ $group: { _id: { $toString: "$categoryId" }, n: { $sum: 1 } } }]).toArray(),
  ]);
  const n = new Map(counts.map((c) => [c._id, c.n]));
  return (
    <>
      <PageHeader title="Produtos" description="As categorias organizam o catálogo e os filtros do ponto de venda." />
      <ProductTabs />
      <CategoriesEditor categories={cats.map((c) => ({ id: c._id.toHexString(), name: c.name, type: c.type, count: n.get(c._id.toHexString()) ?? 0 }))} canEdit={can(ctx.actor, "produtos.gerir")} />
    </>
  );
}
