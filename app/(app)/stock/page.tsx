import Link from "next/link";
import { ArrowLeftRight, ClipboardCheck, FileMinus, Boxes } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { pickItems, stockMap } from "@/lib/queries";
import { normalize } from "@/lib/text";
import { cn, formatKz, formatNumber } from "@/lib/format";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ParamSearch, ParamSelect } from "@/components/filters/Filters";
import { StockTabs } from "./shared";

export const metadata = { title: "Stock" };

export default async function StockPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage("stock.ver");
  const { actor } = ctx;
  const get = await readParams(searchParams);
  const q = get("q");
  const filter = get("filtro");
  const cat = get("categoria");
  const db = await getDb();
  const stores = ctx.store ? [ctx.store] : ctx.stores;
  const [items, map, categories] = await Promise.all([pickItems(db, actor, null), stockMap(db, stores.map((s) => s._id)), col.categories(db).find().sort({ order: 1 }).toArray()]);
  const showCost = can(actor, "stock.custos");
  const tokens = normalize(q).split(" ").filter(Boolean);

  const rows = items
    .map((i) => {
      const per = stores.map((s) => map[s._id.toHexString()][i.variantId] ?? 0);
      return { ...i, per, total: per.reduce((a, b) => a + b, 0) };
    })
    .filter((r) => (!cat || r.categoryId === cat) && tokens.every((t) => r.search.includes(t)))
    .filter((r) => (filter === "baixo" ? r.per.some((q) => r.minQty > 0 && q <= r.minQty) : filter === "esgotado" ? r.per.some((q) => q <= 0) : filter === "com" ? r.total > 0 : true));

  const units = rows.reduce((s, r) => s + Math.max(0, r.total), 0);
  const value = rows.reduce((s, r) => s + Math.max(0, r.total) * (r.cost ?? 0), 0);
  const retail = rows.reduce((s, r) => s + Math.max(0, r.total) * r.price, 0);
  const low = rows.filter((r) => r.per.some((q) => r.minQty > 0 && q <= r.minQty)).length;

  return (
    <>
      <PageHeader
        title="Stock"
        description={ctx.store ? `Quantidades em ${ctx.store.name}.` : "Quantidades em todas as lojas."}
        actions={
          <>
            {can(actor, "stock.transf_enviar") && (
              <Button asChild variant="outline">
                <Link href="/stock/transferencias/nova">
                  <ArrowLeftRight /> Transferir
                </Link>
              </Button>
            )}
            {can(actor, "stock.nota_saida") && (
              <Button asChild variant="outline">
                <Link href="/stock/notas-saida/nova">
                  <FileMinus /> Nota de saída
                </Link>
              </Button>
            )}
            {can(actor, "stock.ajustar") && (
              <Button asChild variant="outline">
                <Link href="/stock/ajustes/nova">
                  <ClipboardCheck /> Contagem
                </Link>
              </Button>
            )}
          </>
        }
      />
      <StockTabs actor={actor} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Unidades" value={formatNumber(units)} />
        <Stat label="Artigos com stock baixo" value={formatNumber(low)} tone={low ? "down" : "neutral"} />
        {showCost && <Stat label="Valor ao custo" value={formatKz(value)} />}
        <Stat label="Valor à venda" value={formatKz(retail)} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <ParamSearch value={q} placeholder="Procurar artigo, cor, SKU…" />
        <ParamSelect
          name="filtro"
          label="Filtro"
          value={filter}
          options={[
            { value: "", label: "Todos os artigos" },
            { value: "com", label: "Só com stock" },
            { value: "baixo", label: "Stock baixo" },
            { value: "esgotado", label: "Esgotados" },
          ]}
        />
        <ParamSelect name="categoria" label="Categoria" value={cat} options={[{ value: "", label: "Todas as categorias" }, ...categories.map((c) => ({ value: c._id.toHexString(), label: c.name }))]} />
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<Boxes />} title="Nada para mostrar" description={items.length ? "Mude a pesquisa ou o filtro." : "Crie produtos e dê entrada de uma compra para ter stock."} />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="border-b border-line text-left text-[13px] text-muted">
                    <th className="py-3 pl-6 pr-4 font-medium">Artigo</th>
                    {stores.map((s) => (
                      <th key={s._id.toHexString()} className="px-4 py-3 text-right font-medium">
                        {s.name}
                      </th>
                    ))}
                    {stores.length > 1 && <th className="px-4 py-3 text-right font-medium">Total</th>}
                    {showCost && <th className="py-3 pl-4 pr-6 text-right font-medium">Custo médio</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.variantId} className="border-b border-line/60 last:border-0">
                      <td className="py-3 pl-6 pr-4">
                        <div className="font-medium text-ink">{r.name}</div>
                        <div className="text-[13px] text-muted">
                          {r.label ? `${r.label} · ` : ""}
                          {r.sku}
                          {r.minQty > 0 && ` · mín. ${r.minQty}`}
                        </div>
                      </td>
                      {r.per.map((q, i) => (
                        <td key={i} className="px-4 py-3 text-right tabular">
                          <Qty q={q} min={r.minQty} />
                        </td>
                      ))}
                      {stores.length > 1 && <td className="px-4 py-3 text-right font-semibold tabular">{formatNumber(r.total)}</td>}
                      {showCost && <td className="py-3 pl-4 pr-6 text-right text-ink-soft tabular">{formatKz(r.cost ?? 0)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line/70 md:hidden">
              {rows.map((r) => (
                <li key={r.variantId} className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-ink">{r.name}</div>
                      <div className="text-[13px] text-muted">
                        {r.label ? `${r.label} · ` : ""}
                        {r.sku}
                      </div>
                    </div>
                    {stores.length === 1 && <Qty q={r.per[0]} min={r.minQty} big />}
                  </div>
                  {stores.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {stores.map((s, i) => (
                        <span key={s._id.toHexString()} className="text-muted">
                          {s.code}: <Qty q={r.per[i]} min={r.minQty} />
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}

function Qty({ q, min, big }: { q: number; min: number; big?: boolean }) {
  if (q <= 0) return <Badge tone="danger">{formatNumber(q)}</Badge>;
  if (min > 0 && q <= min) return <Badge tone="warning">{formatNumber(q)}</Badge>;
  return <span className={cn("font-medium text-ink tabular", big && "text-lg font-semibold")}>{formatNumber(q)}</span>;
}
