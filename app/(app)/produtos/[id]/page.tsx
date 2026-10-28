import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { formatKz, formatNumber } from "@/lib/format";
import { Card, CardBody, CardHeader, DescList, PageHeader } from "@/components/ui/card";
import { ProductForm } from "@/components/products/ProductForm";
import { ProductThumb } from "@/components/pos/ProductThumb";

export const metadata = { title: "Produto" };

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePage("produtos.ver");
  if (!ObjectId.isValid(id)) notFound();
  const db = await getDb();
  const p = await col.products(db).findOne({ _id: new ObjectId(id) });
  if (!p) notFound();
  const [categories, stock] = await Promise.all([col.categories(db).find().sort({ order: 1 }).toArray(), col.stock(db).find({ productId: p._id, storeId: { $in: ctx.stores.map((s) => s._id) } }).toArray()]);
  const qty = (storeId: ObjectId, variantId: ObjectId) => stock.find((s) => s.storeId.equals(storeId) && s.variantId.equals(variantId))?.qty ?? 0;
  const manage = can(ctx.actor, "produtos.gerir");
  const costs = can(ctx.actor, "stock.custos");
  const active = p.variants.filter((v) => v.active);

  return (
    <>
      <Link href="/produtos" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Produtos
      </Link>
      <PageHeader title={p.name} description={p.brand} />
      <Card className="mb-5">
        <CardHeader title="Stock por loja" />
        <CardBody className="overflow-x-auto pt-3">
          <table className="w-full min-w-[480px] text-[15px]">
            <thead>
              <tr className="border-b border-line text-left text-[13px] text-muted">
                <th className="pb-2 font-medium">{p.hasVariants ? "Variante" : "Artigo"}</th>
                {ctx.stores.map((s) => (
                  <th key={s._id.toHexString()} className="pb-2 text-right font-medium">
                    {s.name}
                  </th>
                ))}
                <th className="pb-2 text-right font-medium">Preço</th>
                {costs && <th className="pb-2 text-right font-medium">Custo médio</th>}
              </tr>
            </thead>
            <tbody>
              {active.map((v) => (
                <tr key={v._id.toHexString()} className="border-b border-line/60 last:border-0">
                  <td className="py-2.5">
                    <div className="font-medium text-ink">{v.label || p.name}</div>
                    <div className="text-[13px] text-muted">{v.sku}</div>
                  </td>
                  {ctx.stores.map((s) => (
                    <td key={s._id.toHexString()} className="py-2.5 text-right tabular">
                      {formatNumber(qty(s._id, v._id))}
                    </td>
                  ))}
                  <td className="py-2.5 text-right tabular">{formatKz(v.price)}</td>
                  {costs && <td className="py-2.5 text-right text-ink-soft tabular">{formatKz(v.avgCost)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
      {manage ? (
        <ProductForm
          initial={{
            id: p._id.toHexString(),
            name: p.name,
            brand: p.brand,
            categoryId: p.categoryId?.toHexString() ?? "",
            description: p.description,
            imageId: p.imageId?.toHexString(),
            active: p.active,
            hasVariants: p.hasVariants,
            variants: p.variants.map((v) => ({
              id: v._id.toHexString(),
              sku: v.sku,
              barcode: v.barcode,
              label: v.label,
              price: v.price,
              cost: costs ? v.avgCost : 0,
              minQty: v.minQty,
              attrs: v.attrs ?? {},
              storePrices: v.storePrices ?? {},
              initialStock: {},
              active: v.active,
            })),
          }}
          categories={categories.map((c) => ({ id: c._id.toHexString(), name: c.name, type: c.type }))}
          stores={ctx.stores.map((s) => ({ id: s._id.toHexString(), name: s.name }))}
          perms={{ prices: can(ctx.actor, "produtos.precos"), costs }}
        />
      ) : (
        <Card>
          <CardBody className="flex flex-col gap-5 sm:flex-row">
            <ProductThumb name={p.name} imageId={p.imageId?.toHexString()} className="size-40 shrink-0 rounded-2xl" />
            <DescList items={[["Categoria", categories.find((c) => p.categoryId?.equals(c._id))?.name ?? "—"], ["Descrição", p.description ?? "—"]]} />
          </CardBody>
        </Card>
      )}
    </>
  );
}
