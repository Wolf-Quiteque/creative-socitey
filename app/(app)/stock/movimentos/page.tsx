import Link from "next/link";
import { History } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { storeMatch } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { rangeOf, resolvePeriod } from "@/lib/time";
import { storeNames } from "@/lib/queries";
import { formatDateTime, formatNumber } from "@/lib/format";
import { MOVEMENT_TYPES, type MovementType } from "@/lib/types";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/table";
import { ParamSearch, ParamSelect, PeriodFilter } from "@/components/filters/Filters";
import { StockTabs } from "../shared";

export const metadata = { title: "Movimentos de stock" };

export default async function MovementsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage("stock.ver");
  const get = await readParams(searchParams);
  const { from, to, period } = resolvePeriod(get("periodo", "7d"), get("de"), get("ate"));
  const { start, end } = rangeOf(from, to);
  const type = get("tipo");
  const q = get("q").trim();
  const db = await getDb();
  const match: Record<string, unknown> = { at: { $gte: start, $lt: end }, ...storeMatch(ctx.actor, "storeId", ctx.storeId) };
  if (type && type in MOVEMENT_TYPES) match.type = type;
  if (q) match.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
  const [moves, names] = await Promise.all([col.movements(db).find(match).sort({ at: -1 }).limit(400).toArray(), storeNames(db)]);
  const refHref = (m: (typeof moves)[number]) => (m.ref.kind === "venda" ? `/vendas/${m.ref.id}` : m.ref.kind === "compra" ? `/compras/${m.ref.id}` : m.ref.kind === "doc" ? `/stock/documentos/${m.ref.id}` : undefined);
  const Delta = ({ q }: { q: number }) => <span className={`font-semibold tabular ${q < 0 ? "text-danger" : "text-success"}`}>{q > 0 ? `+${formatNumber(q)}` : formatNumber(q)}</span>;
  return (
    <>
      <PageHeader title="Stock" description="Cada entrada e saída de mercadoria, com quem a fez e porquê." />
      <StockTabs actor={ctx.actor} />
      <div className="mb-4 flex flex-wrap gap-2">
        <PeriodFilter period={period} from={from} to={to} />
        <ParamSelect name="tipo" label="Tipo" value={type} options={[{ value: "", label: "Todos os tipos" }, ...Object.entries(MOVEMENT_TYPES).map(([value, label]) => ({ value, label }))]} />
        <ParamSearch value={q} placeholder="Procurar artigo…" />
      </div>
      <Card>
        <ResponsiveTable
          rows={moves}
          rowKey={(m) => m._id.toHexString()}
          empty={<EmptyState icon={<History />} title="Sem movimentos" description="Não houve movimentos de stock neste período." />}
          columns={[
            { header: "Data", cell: (m) => <span className="whitespace-nowrap text-ink-soft">{formatDateTime(m.at)}</span> },
            { header: "Artigo", cell: (m) => <span className="font-medium text-ink">{m.name}</span> },
            ...(ctx.store ? [] : [{ header: "Loja", cell: (m: (typeof moves)[number]) => names[m.storeId.toHexString()] }]),
            { header: "Tipo", cell: (m) => MOVEMENT_TYPES[m.type as MovementType] },
            { header: "Qtd.", align: "right", cell: (m) => <Delta q={m.qty} /> },
            { header: "Fica", align: "right", cell: (m) => formatNumber(m.balanceAfter) },
            {
              header: "Documento",
              cell: (m) => {
                const href = refHref(m);
                return href ? (
                  <Link href={href} className="font-medium text-primary hover:underline">
                    {m.ref.number}
                  </Link>
                ) : (
                  "—"
                );
              },
            },
            { header: "Por", cell: (m) => m.by.name },
          ]}
          mobile={(m) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-ink">{m.name}</div>
                <div className="text-[13px] text-muted">
                  {MOVEMENT_TYPES[m.type as MovementType]} · {m.ref.number ?? ""} · {m.by.name}
                </div>
                <div className="text-[13px] text-muted">
                  {formatDateTime(m.at)}
                  {!ctx.store && ` · ${names[m.storeId.toHexString()]}`}
                </div>
              </div>
              <div className="text-right">
                <Delta q={m.qty} />
                <div className="text-xs text-muted">fica {formatNumber(m.balanceAfter)}</div>
              </div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
