import { Download, Info } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { resolvePeriod } from "@/lib/time";
import { cashFlowReport, profitReport, salesBreakdown, stockValue } from "@/lib/domain/reports";
import { storeNames } from "@/lib/queries";
import { cn, formatDay, formatDayShort, formatKz, formatNumber, formatPct } from "@/lib/format";
import { CATEGORY_KINDS, MOVEMENT_TYPES, PAYMENT_METHODS, type MovementType } from "@/lib/types";
import { Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/filters/Filters";
import { BarList, ColumnChart, InOutChart } from "@/components/charts/charts";
import { FinanceTabs } from "../tabs";

export const metadata = { title: "Relatórios" };

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage("financas.relatorios");
  const { actor, storeId } = ctx;
  const get = await readParams(searchParams);
  const { from, to, period } = resolvePeriod(get("periodo", "mes"), get("de"), get("ate"));
  const scope = { from, to, storeId };
  const db = await getDb();
  const [profit, flow, sales, value, names] = await Promise.all([
    profitReport(db, actor, scope),
    cashFlowReport(db, actor, scope),
    salesBreakdown(db, actor, scope),
    stockValue(db, actor, storeId),
    storeNames(db),
  ]);
  const single = from === to;
  const exportQs = `de=${from}&ate=${to}${storeId ? `&loja=${storeId.toHexString()}` : ""}`;

  return (
    <>
      <PageHeader
        title="Finanças"
        description={`${single ? formatDay(from) : `${formatDay(from)} a ${formatDay(to)}`} · ${ctx.store ? ctx.store.name : "todas as lojas"}`}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/exportar?tipo=vendas&${exportQs}`}>
                <Download /> Vendas (CSV)
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/exportar?tipo=caixa&${exportQs}`}>
                <Download /> Entradas e saídas (CSV)
              </a>
            </Button>
          </>
        }
      />
      <FinanceTabs actor={actor} />
      <div className="mb-5">
        <PeriodFilter period={period} from={from} to={to} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vendas líquidas" value={formatKz(profit.revenue)} hint={`${formatNumber(profit.salesCount)} venda(s)`} />
        <Stat label="Lucro bruto" value={formatKz(profit.grossProfit)} hint={`Margem ${formatPct(profit.margin, 0)}`} tone={profit.grossProfit >= 0 ? "up" : "down"} />
        <Stat label="Despesas" value={formatKz(profit.expenses)} />
        <Stat label="Lucro líquido" value={formatKz(profit.netProfit)} tone={profit.netProfit >= 0 ? "up" : "down"} hint={profit.netProfit >= 0 ? "Ganho no período" : "Prejuízo no período"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Os seus ganhos" description="Do que vendeu ao que realmente ganhou" />
          <CardBody className="pt-4">
            <dl className="flex flex-col text-[15px]">
              <Line k="Vendas (preço de tabela)" v={profit.grossSales} />
              <Line k="Descontos" v={-profit.discounts} />
              <Line k="Devoluções" v={-profit.refunds} />
              <Line k="Vendas líquidas" v={profit.revenue} total />
              <Line k="Custo da mercadoria vendida" hint="Preço do fornecedor + transporte + alfândega" v={-profit.cogs} />
              <Line k="Lucro bruto" v={profit.grossProfit} total />
              <Line k="Outras receitas" v={profit.otherIncome} />
              <Line k="Despesas" v={-profit.expenses} />
              <Line k="Perdas de stock" hint="Quebras, ofertas, uso interno, faltas em trânsito" v={-profit.losses} />
              <Line k="Lucro líquido" v={profit.netProfit} total strong />
            </dl>
            <p className="mt-4 flex gap-2 rounded-2xl bg-info-soft p-3 text-[13px] leading-relaxed text-info">
              <Info className="mt-0.5 size-4 shrink-0" />
              Comprar mercadoria é dinheiro que sai, mas não é perda: vira stock. Só conta no lucro quando o artigo é vendido, pelo custo de chegada. Os levantamentos do dono também não contam como despesa.
            </p>
          </CardBody>
        </Card>
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card>
            <CardHeader title="Vendas por dia" description="Vendas líquidas, em Kwanza" />
            <CardBody className="pt-3">
              <ColumnChart data={sales.byDay.map((d) => ({ x: d.day.slice(8), y: d.revenue, title: formatDayShort(d.day) }))} label="Vendas por dia" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Entradas e saídas de dinheiro" description="Inclui compras de mercadoria e levantamentos" />
            <CardBody className="pt-3">
              <InOutChart data={flow.byDay.map((d) => ({ x: d.day.slice(8), title: formatDayShort(d.day), in: d.in, out: d.out }))} />
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Despesas por categoria" />
          <CardBody className="pt-4">
            <BarList items={profit.expensesByCategory.map((c) => ({ label: c.name, value: c.amount }))} empty="Sem despesas no período." />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Fluxo de caixa" description={`Entrou ${formatKz(flow.totalIn)} · saiu ${formatKz(flow.totalOut)}`} />
          <CardBody className="pt-3">
            <ul className="divide-y divide-line/70 text-sm">
              {flow.byKind.map((k, i) => (
                <li key={i} className="flex justify-between py-2.5">
                  <span className="text-ink-soft">{CATEGORY_KINDS[k.kind]}</span>
                  <span className={cn("font-semibold tabular", k.type === "entrada" ? "text-success" : "text-danger")}>{`${k.type === "entrada" ? "+" : "−"}${formatKz(k.amount)}`}</span>
                </li>
              ))}
              <li className="flex justify-between py-2.5 font-semibold text-ink">
                <span>Saldo do período</span>
                <span className="tabular">{formatKz(flow.net)}</span>
              </li>
            </ul>
          </CardBody>
        </Card>
        {!ctx.store && sales.byStore.length > 1 && (
          <Card>
            <CardHeader title="Por loja" description="Vendas líquidas e lucro bruto" />
            <CardBody className="pt-4">
              <BarList items={sales.byStore.map((s) => ({ label: names[s.storeId], value: s.revenue, hint: `· lucro ${formatKz(s.profit)}` }))} />
            </CardBody>
          </Card>
        )}
        <Card>
          <CardHeader title="Por vendedor" />
          <CardBody className="pt-4">
            <BarList items={sales.bySeller.map((s) => ({ label: s.name, value: s.revenue, hint: `· ${s.count}` }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Métodos de pagamento" />
          <CardBody className="pt-4">
            <BarList items={sales.byMethod.map((m) => ({ label: PAYMENT_METHODS[m.method] ?? m.method, value: m.amount }))} />
          </CardBody>
        </Card>
        {profit.lossesByType.length > 0 && (
          <Card>
            <CardHeader title="Perdas de stock" description="Valorizadas ao custo" />
            <CardBody className="pt-4">
              <BarList items={profit.lossesByType.filter((l) => l.amount !== 0).map((l) => ({ label: MOVEMENT_TYPES[l.type as MovementType] ?? l.type, value: l.amount }))} />
            </CardBody>
          </Card>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader title="Produtos mais vendidos" description="Com o lucro e a margem de cada um" />
        <CardBody className="overflow-x-auto pt-3">
          {sales.topProducts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Sem vendas no período.</p>
          ) : (
            <table className="w-full min-w-[520px] text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-[13px] text-muted">
                  <th className="pb-2 font-medium">Artigo</th>
                  <th className="pb-2 text-right font-medium">Qtd.</th>
                  <th className="pb-2 text-right font-medium">Vendas</th>
                  <th className="pb-2 text-right font-medium">Lucro</th>
                  <th className="pb-2 text-right font-medium">Margem</th>
                </tr>
              </thead>
              <tbody>
                {sales.topProducts.map((p) => (
                  <tr key={p.name} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5 font-medium text-ink">{p.name}</td>
                    <td className="py-2.5 text-right tabular">{formatNumber(p.qty)}</td>
                    <td className="py-2.5 text-right tabular">{formatKz(p.revenue)}</td>
                    <td className="py-2.5 text-right tabular">{formatKz(p.profit)}</td>
                    <td className="py-2.5 text-right tabular">{p.revenue ? formatPct((p.profit / p.revenue) * 100, 0) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {value.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Valor do stock hoje" description="Quanto vale a mercadoria nas prateleiras" />
          <CardBody className="pt-3">
            <ul className="divide-y divide-line/70 text-sm">
              {value.map((v) => (
                <li key={v.storeId} className="flex flex-wrap justify-between gap-2 py-3">
                  <span className="font-medium text-ink">{names[v.storeId]}</span>
                  <span className="text-ink-soft">
                    {formatNumber(v.units)} un. · ao custo <b className="text-ink">{formatKz(v.cost)}</b> · à venda <b className="text-ink">{formatKz(v.retail)}</b>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </>
  );
}

function Line({ k, v, hint, total, strong }: { k: string; v: number; hint?: string; total?: boolean; strong?: boolean }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 py-2", total && "border-t border-line", strong && "text-lg")}>
      <dt className={cn(total ? "font-semibold text-ink" : "text-ink-soft")}>
        {k}
        {hint && <span className="block text-xs font-normal text-muted">{hint}</span>}
      </dt>
      <dd className={cn("tabular", total ? "font-semibold" : "", strong && (v >= 0 ? "text-success" : "text-danger"))}>{v < 0 ? `−${formatKz(-v)}` : formatKz(v)}</dd>
    </div>
  );
}
