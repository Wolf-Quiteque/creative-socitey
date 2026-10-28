"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { cn, formatKz, formatKzCompact } from "@/lib/format";

const axis = { stroke: "var(--muted)", fontSize: 12, tickLine: false, axisLine: false } as const;

function TooltipBox({ title, rows }: { title: React.ReactNode; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lift">
      <div className="mb-1 font-medium text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-ink-soft">
          {r.color && <span className="size-2.5 rounded-sm" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-semibold text-ink tabular">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Colunas de uma só série (vendas por hora, por dia). Sem legenda: o título diz o que é. */
export function ColumnChart({ data, label, height = 220, valueLabel = "Vendas" }: { data: { x: string; y: number; title?: string }[]; label?: string; height?: number; valueLabel?: string }) {
  return (
    <div style={{ height }} aria-label={label} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="x" {...axis} interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...axis} width={68} tickFormatter={(v: number) => formatKzCompact(v)} />
          <Tooltip
            cursor={{ fill: "var(--sand)", opacity: 0.6 }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox title={(payload[0].payload as { title?: string; x: string }).title ?? (payload[0].payload as { x: string }).x} rows={[{ label: valueLabel, value: formatKz(Number(payload[0].value)), color: "var(--chart-1)" }]} />
              ) : null
            }
          />
          <Bar dataKey="y" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Entradas vs saídas por dia (duas séries com legenda) */
export function InOutChart({ data, height = 240 }: { data: { x: string; title: string; in: number; out: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Entradas e saídas por dia">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="x" {...axis} interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...axis} width={68} tickFormatter={(v: number) => formatKzCompact(v)} />
          <Legend
            verticalAlign="top"
            align="left"
            height={32}
            iconType="square"
            iconSize={10}
            formatter={(v: string) => <span className="text-sm text-ink-soft">{v}</span>}
          />
          <Tooltip
            cursor={{ fill: "var(--sand)", opacity: 0.6 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { title: string; in: number; out: number };
              return (
                <TooltipBox
                  title={p.title}
                  rows={[
                    { label: "Entradas", value: formatKz(p.in), color: "var(--chart-2)" },
                    { label: "Saídas", value: formatKz(p.out), color: "var(--chart-1)" },
                  ]}
                />
              );
            }}
          />
          <Bar name="Entradas" dataKey="in" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={16} />
          <Bar name="Saídas" dataKey="out" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Lista de barras horizontais em HTML (rankings: lojas, categorias, métodos) */
export function BarList({ items, format = formatKz, empty = "Sem dados no período.", className }: { items: { label: React.ReactNode; value: number; hint?: React.ReactNode }[]; format?: (v: number) => string; empty?: string; className?: string }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  if (!items.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className={cn("flex flex-col gap-3.5", className)}>
      {items.map((i, idx) => (
        <li key={idx} className="group" title={`${typeof i.label === "string" ? i.label : ""}: ${format(i.value)}`}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink-soft">{i.label}</span>
            <span className="shrink-0 font-semibold text-ink tabular">
              {format(i.value)}
              {i.hint && <span className="ml-1.5 font-normal text-muted">{i.hint}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-sand">
            <div className="h-2 rounded-full bg-[var(--chart-1)] transition-[width] duration-500 group-hover:brightness-110" style={{ width: `${Math.max(2, (Math.abs(i.value) / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
