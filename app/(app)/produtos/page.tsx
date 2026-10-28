import Link from "next/link";
import { ObjectId } from "mongodb";
import { Plus, Tag } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can, storeMatch } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { normalize } from "@/lib/text";
import { formatKz, formatNumber } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTable } from "@/components/ui/table";
import { ParamSearch, ParamSelect } from "@/components/filters/Filters";
import { ProductThumb } from "@/components/pos/ProductThumb";
import { ProductTabs } from "./tabs";

export const metadata = { title: "Produtos" };

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage("produtos.ver");
  const get = await readParams(searchParams);
  const q = get("q");
  const cat = get("categoria");
  const state = get("estado", "ativos");
  const db = await getDb();
  const filter: Record<string, unknown> = {};
  if (state === "ativos") filter.active = true;
  if (state === "inativos") filter.active = false;
  if (/^[a-f0-9]{24}$/i.test(cat)) filter.categoryId = new ObjectId(cat);
  const tokens = normalize(q).split(" ").filter(Boolean);
  if (tokens.length) filter.$and = tokens.map((t) => ({ search: { $regex: t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } }));
  const [products, categories, stock] = await Promise.all([
    col.products(db).find(filter).sort({ name: 1 }).limit(500).toArray(),
    col.categories(db).find().sort({ order: 1 }).toArray(),
    col
      .stock(db)
      .aggregate<{ _id: string; qty: number }>([{ $match: storeMatch(ctx.actor, "storeId", ctx.storeId) }, { $group: { _id: { $toString: "$productId" }, qty: { $sum: "$qty" } } }])
      .toArray(),
  ]);
  const qty = new Map(stock.map((s) => [s._id, s.qty]));
  const catName = new Map(categories.map((c) => [c._id.toHexString(), c.name]));
  const priceRange = (p: (typeof products)[number]) => {
    const prices = p.variants.filter((v) => v.active).map((v) => v.price);
    if (!prices.length) return "—";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max ? formatKz(min) : `${formatKz(min)} – ${formatKz(max)}`;
  };

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Perucas, cabelo e produtos de beleza, com variantes e preços."
        actions={
          can(ctx.actor, "produtos.gerir") ? (
            <Button asChild>
              <Link href="/produtos/novo">
                <Plus /> Novo produto
              </Link>
            </Button>
          ) : null
        }
      />
      <ProductTabs />
      <div className="mb-4 flex flex-wrap gap-2">
        <ParamSearch value={q} placeholder="Procurar produto, SKU, cor…" />
        <ParamSelect name="categoria" label="Categoria" value={cat} options={[{ value: "", label: "Todas as categorias" }, ...categories.map((c) => ({ value: c._id.toHexString(), label: c.name }))]} />
        <ParamSelect
          name="estado"
          label="Estado"
          value={state}
          options={[
            { value: "ativos", label: "À venda" },
            { value: "inativos", label: "Fora de venda" },
            { value: "todos", label: "Todos" },
          ]}
        />
      </div>
      <Card>
        <ResponsiveTable
          rows={products}
          rowKey={(p) => p._id.toHexString()}
          rowHref={(p) => `/produtos/${p._id.toHexString()}`}
          empty={<EmptyState icon={<Tag />} title="Sem produtos" description="Crie o primeiro produto para começar a vender." />}
          columns={[
            {
              header: "Produto",
              cell: (p) => (
                <span className="flex items-center gap-3">
                  <ProductThumb name={p.name} imageId={p.imageId?.toHexString()} className="size-11 shrink-0 rounded-xl text-sm" />
                  <span>
                    <span className="block font-medium text-ink">{p.name}</span>
                    <span className="text-[13px] text-muted">{[p.brand, p.hasVariants ? `${p.variants.filter((v) => v.active).length} variantes` : p.variants[0]?.sku].filter(Boolean).join(" · ")}</span>
                  </span>
                </span>
              ),
            },
            { header: "Categoria", cell: (p) => (p.categoryId ? catName.get(p.categoryId.toHexString()) : "—") },
            { header: "Preço", cell: (p) => <span className="tabular">{priceRange(p)}</span> },
            { header: "Stock", align: "right", cell: (p) => formatNumber(qty.get(p._id.toHexString()) ?? 0) },
            { header: "", cell: (p) => (p.active ? null : <Badge>Fora de venda</Badge>) },
          ]}
          mobile={(p) => (
            <div className="flex items-center gap-3">
              <ProductThumb name={p.name} imageId={p.imageId?.toHexString()} className="size-14 shrink-0 rounded-xl text-base" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{p.name}</div>
                <div className="text-[13px] text-muted">{priceRange(p)}</div>
                <div className="text-[13px] text-muted">
                  {formatNumber(qty.get(p._id.toHexString()) ?? 0)} em stock{p.active ? "" : " · fora de venda"}
                </div>
              </div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
