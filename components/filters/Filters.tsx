"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { PERIOD_LABELS } from "@/lib/time";
import { cn } from "@/lib/format";
import { Input, Select } from "@/components/ui/field";

function useParamSetter() {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = React.useTransition();
  const set = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
    },
    [params, path, router],
  );
  return { params, set, pending };
}

/** Período: atalhos (hoje, 7 dias, mês…) ou datas à escolha */
export function PeriodFilter({ period, from, to, presets }: { period: string; from: string; to: string; presets?: (keyof typeof PERIOD_LABELS)[] }) {
  const { set, pending } = useParamSetter();
  const keys = presets ?? (Object.keys(PERIOD_LABELS) as (keyof typeof PERIOD_LABELS)[]);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", pending && "opacity-60")}>
      <div className="relative">
        <CalendarRange className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary" />
        <Select className="w-auto min-w-44 pl-10" value={period} onChange={(e) => set({ periodo: e.target.value, de: null, ate: null })} aria-label="Período">
          {keys.map((k) => (
            <option key={k} value={k}>
              {PERIOD_LABELS[k]}
            </option>
          ))}
          <option value="personalizado">Escolher datas…</option>
        </Select>
      </div>
      {period === "personalizado" && (
        <div className="flex items-center gap-2">
          <Input type="date" className="w-auto" value={from} max={to} onChange={(e) => set({ periodo: "personalizado", de: e.target.value, ate: to })} aria-label="De" />
          <span className="text-muted">até</span>
          <Input type="date" className="w-auto" value={to} min={from} onChange={(e) => set({ periodo: "personalizado", de: from, ate: e.target.value })} aria-label="Até" />
        </div>
      )}
    </div>
  );
}

/** Filtro simples por um parâmetro (select) */
export function ParamSelect({ name, value, options, label, className }: { name: string; value: string; options: { value: string; label: string }[]; label: string; className?: string }) {
  const { set, pending } = useParamSetter();
  return (
    <Select aria-label={label} className={cn("w-auto min-w-40", pending && "opacity-60", className)} value={value} onChange={(e) => set({ [name]: e.target.value || null })}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/** Pesquisa por texto num parâmetro, com pequena espera enquanto se escreve */
export function ParamSearch({ name = "q", value, placeholder }: { name?: string; value: string; placeholder: string }) {
  const { set } = useParamSetter();
  const [text, setText] = React.useState(value);
  React.useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => set({ [name]: text || null }), 300);
    return () => clearTimeout(t);
  }, [text, value, name, set]);
  return <Input type="search" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} className="w-full sm:w-72" />;
}
