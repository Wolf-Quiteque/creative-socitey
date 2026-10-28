"use client";

import * as React from "react";
import Link from "next/link";
import { Coins, Receipt, ShoppingBag, TrendingUp } from "lucide-react";
import type { LiveStats } from "@/lib/domain/reports";
import { formatKz, formatNumber, formatPct, formatTime } from "@/lib/format";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { BarList, ColumnChart } from "@/components/charts/charts";

const POLL_MS = 15_000;

/** Números do dia, atualizados sozinhos de 15 em 15 segundos (pausa com o separador escondido) */
export function LiveDashboard({ initial, storeId, storeNames, showProfit }: { initial: LiveStats; storeId: string; storeNames: Record<string, string>; showProfit: boolean }) {
  const [stats, setStats] = React.useState(initial);
  const [stale, setStale] = React.useState(false);
  React.useEffect(() => setStats(initial), [initial]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "visible") {
        try {
          const r = await fetch(`/api/painel?loja=${storeId}`, { cache: "no-store" });
          if (r.ok) {
            setStats(await r.json());
            setStale(false);
          } else setStale(true);
        } catch {
          setStale(true);
        }
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [storeId]);

  const delta = stats.yesterdayRevenue ? ((stats.revenue - stats.yesterdayRevenue) / stats.yesterdayRevenue) * 100 : null;
  const nowHour = Number(formatTime(stats.updatedAt).slice(0, 2));
  const hours = stats.byHour.filter((h) => h.hour >= 7 && h.hour <= Math.max(20, nowHour)).map((h) => ({ x: `${h.hour}h`, y: h.revenue, title: `${h.hour}:00 – ${h.hour}:59` }));
  const multiStore = storeId === "all" && Object.keys(storeNames).length > 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className={`size-2 rounded-full ${stale ? "bg-warning" : "bg-success animate-pulse-soft"}`} />
        {stale ? "Sem ligação — a mostrar os últimos números" : `Ao vivo · atualizado às ${formatTime(stats.updatedAt)}`}
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat
          className="col-span-2 lg:col-span-1"
          label="Vendas de hoje"
          value={formatKz(stats.revenue)}
          icon={<Coins />}
          hint={delta === null ? "Sem vendas ontem a esta hora" : `${delta >= 0 ? "+" : ""}${formatPct(delta, 0)} vs ontem à mesma hora`}
          tone={delta === null ? "neutral" : delta >= 0 ? "up" : "down"}
        />
        <Stat label="Nº de vendas" value={formatNumber(stats.count)} icon={<Receipt />} />
        <Stat label="Ticket médio" value={formatKz(stats.avgTicket)} icon={<ShoppingBag />} />
        {showProfit ? (
          <Stat className="col-span-2 lg:col-span-1" label="Lucro bruto estimado" value={formatKz(stats.profit)} icon={<TrendingUp />} hint={stats.revenue ? `Margem ${formatPct((stats.profit / stats.revenue) * 100, 0)}` : undefined} />
        ) : (
          <Stat className="col-span-2 lg:col-span-1" label="Artigos vendidos" value={formatNumber(stats.latest.reduce((s, l) => s + l.items, 0))} hint="Nas últimas vendas" icon={<TrendingUp />} />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Vendas por hora" description="Hoje, em Kwanza" />
          <CardBody className="pt-3">
            <ColumnChart data={hours} label="Vendas por hora hoje" />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          {multiStore ? (
            <>
              <CardHeader title="Por loja" description="Vendas de hoje" />
              <CardBody className="pt-4">
                <BarList
                  items={Object.entries(storeNames)
                    .map(([id, name]) => {
                      const s = stats.byStore.find((b) => b.storeId === id);
                      return { label: name, value: s?.revenue ?? 0, hint: s ? `· ${s.count}` : undefined };
                    })
                    .sort((a, b) => b.value - a.value)}
                />
              </CardBody>
            </>
          ) : (
            <>
              <CardHeader title="Últimas vendas" />
              <LatestList stats={stats} storeNames={storeNames} showStore={false} />
            </>
          )}
        </Card>
      </div>
      {multiStore && (
        <Card>
          <CardHeader title="Últimas vendas" />
          <LatestList stats={stats} storeNames={storeNames} showStore />
        </Card>
      )}
    </div>
  );
}

function LatestList({ stats, storeNames, showStore }: { stats: LiveStats; storeNames: Record<string, string>; showStore: boolean }) {
  if (!stats.latest.length) return <p className="px-6 py-10 text-center text-sm text-muted">Ainda não há vendas hoje.</p>;
  return (
    <ul className="divide-y divide-line/70 px-2 pb-2 pt-2">
      {stats.latest.map((s) => (
        <li key={s.id}>
          <Link href={`/vendas/${s.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 hover:bg-sand/60">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">
                {s.seller}
                {showStore && <span className="font-normal text-muted"> · {storeNames[s.storeId]}</span>}
              </span>
              <span className="text-[13px] text-muted">
                {formatTime(s.at)} · {s.items} artigo(s) · {s.number}
              </span>
            </span>
            <span className="shrink-0 font-semibold text-ink tabular">{formatKz(s.total)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
