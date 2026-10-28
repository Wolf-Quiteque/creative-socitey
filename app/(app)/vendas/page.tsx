import { Receipt } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can, storeMatch } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { rangeOf, resolvePeriod } from "@/lib/time";
import { formatDateTime, formatKz, formatNumber } from "@/lib/format";
import { storeNames } from "@/lib/queries";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/table";
import { ParamSelect, PeriodFilter } from "@/components/filters/Filters";
import { SalesTabs, SaleStatus } from "./tabs";

export const metadata = { title: "Vendas" };

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage(["vendas.ver_proprias", "vendas.ver_loja", "pos.caixa"]);
  const { actor, storeId } = ctx;
  const get = await readParams(searchParams);
  const { from, to, period } = resolvePeriod(get("periodo", "hoje"), get("de"), get("ate"));
  const { start, end } = rangeOf(from, to);
  const all = can(actor, "vendas.ver_loja");
  const method = get("metodo");
  const status = get("estado");
  const seller = get("vendedor");

  const db = await getDb();
  const match: Record<string, unknown> = { createdAt: { $gte: start, $lt: end }, ...storeMatch(actor, "storeId", storeId) };
  if (!all) match["seller.id"] = actor.id;
  else if (seller) match["seller.name"] = seller;
  if (method && method in PAYMENT_METHODS) match["payments.method"] = method;
  if (status === "anulada" || status === "concluida") match.status = status;
  if (status === "devolucao") match.refunded = { $gt: 0 };

  const [sales, names, sellers] = await Promise.all([
    col.sales(db).find(match).sort({ createdAt: -1 }).limit(300).toArray(),
    storeNames(db),
    all ? col.sales(db).distinct("seller.name", { createdAt: { $gte: start, $lt: end }, ...storeMatch(actor, "storeId", storeId) }) : Promise.resolve([] as string[]),
  ]);
  const done = sales.filter((s) => s.status === "concluida");
  const revenue = done.reduce((s, x) => s + x.total - x.refunded, 0);

  return (
    <>
      <PageHeader title="Vendas" description={all ? "Todas as vendas das lojas a que tem acesso." : "As suas vendas."} />
      <SalesTabs actor={actor} />
      <div className="mb-5 flex flex-wrap gap-2">
        <PeriodFilter period={period} from={from} to={to} />
        <ParamSelect
          name="metodo"
          label="Método"
          value={method}
          options={[{ value: "", label: "Todos os métodos" }, ...Object.entries(PAYMENT_METHODS).map(([value, label]) => ({ value, label }))]}
        />
        <ParamSelect
          name="estado"
          label="Estado"
          value={status}
          options={[
            { value: "", label: "Todos os estados" },
            { value: "concluida", label: "Concluídas" },
            { value: "devolucao", label: "Com devolução" },
            { value: "anulada", label: "Anuladas" },
          ]}
        />
        {all && sellers.length > 1 && <ParamSelect name="vendedor" label="Vendedor" value={seller} options={[{ value: "", label: "Todos os vendedores" }, ...sellers.sort().map((s) => ({ value: s, label: s }))]} />}
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat className="col-span-2 md:col-span-1" label="Total vendido" value={formatKz(revenue)} />
        <Stat label="Vendas" value={formatNumber(done.length)} />
        <Stat label="Ticket médio" value={formatKz(done.length ? revenue / done.length : 0)} />
      </div>
      <Card>
        <ResponsiveTable
          rows={sales}
          rowKey={(s) => s._id.toHexString()}
          rowHref={(s) => `/vendas/${s._id.toHexString()}`}
          empty={<EmptyState icon={<Receipt />} title="Sem vendas neste período" description="Experimente outro período ou outra loja." />}
          columns={[
            { header: "Número", cell: (s) => <span className="font-medium text-ink">{s.number}</span> },
            { header: "Data", cell: (s) => <span className="text-ink-soft">{formatDateTime(s.createdAt)}</span> },
            { header: "Vendedor", cell: (s) => s.seller.name },
            ...(ctx.store ? [] : [{ header: "Loja", cell: (s: (typeof sales)[number]) => names[s.storeId.toHexString()] }]),
            { header: "Pagamento", cell: (s) => <span className="text-ink-soft">{s.payments.map((p) => PAYMENT_METHODS[p.method as PaymentMethod]).join(" + ") || "—"}</span> },
            { header: "Estado", cell: (s) => <SaleStatus status={s.status} refunded={s.refunded} /> },
            { header: "Total", align: "right", cell: (s) => <span className={s.status === "anulada" ? "text-muted line-through" : "font-semibold text-ink"}>{formatKz(s.total)}</span> },
          ]}
          mobile={(s) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-ink">{s.number}</div>
                <div className="truncate text-[13px] text-muted">
                  {formatDateTime(s.createdAt)} · {s.seller.name}
                </div>
              </div>
              <div className="text-right">
                <div className={s.status === "anulada" ? "text-muted line-through" : "font-semibold text-ink tabular"}>{formatKz(s.total)}</div>
                <SaleStatus status={s.status} refunded={s.refunded} small />
              </div>
            </div>
          )}
        />
      </Card>
      {sales.length === 300 && <p className="mt-3 text-center text-sm text-muted">A mostrar as 300 vendas mais recentes. Escolha um período mais curto para ver o resto.</p>}
    </>
  );
}
