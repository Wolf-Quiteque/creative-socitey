"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { normalize } from "@/lib/text";
import { cn, formatKz, formatNumber } from "@/lib/format";
import { Input } from "@/components/ui/field";

export type CatalogItem = { variantId: string; name: string; label: string; sku: string; barcode?: string; price: number; cost?: number; search: string };

/** Campo de pesquisa que mostra artigos do catálogo e devolve o escolhido */
export function VariantPicker({ items, onPick, stock, placeholder = "Procurar artigo por nome, SKU ou código", exclude }: { items: CatalogItem[]; onPick: (i: CatalogItem) => void; stock?: Record<string, number>; placeholder?: string; exclude?: Set<string> }) {
  const [q, setQ] = React.useState("");
  const [focus, setFocus] = React.useState(false);
  const tokens = normalize(q).split(" ").filter(Boolean);
  const results = tokens.length ? items.filter((i) => !exclude?.has(i.variantId) && tokens.every((t) => i.search.includes(t))).slice(0, 30) : [];
  const choose = (i: CatalogItem) => {
    onPick(i);
    setQ("");
  };
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted" />
      <Input
        className="pl-10"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const code = q.trim().toUpperCase();
          const exact = items.find((i) => i.sku === code || i.barcode?.toUpperCase() === code);
          if (exact) choose(exact);
          else if (results.length === 1) choose(results[0]);
        }}
      />
      {focus && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-80 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-lift">
          {results.map((i) => {
            const s = stock?.[i.variantId];
            return (
              <li key={i.variantId}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-sand">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">
                      {i.name}
                      {i.label && <span className="font-normal text-ink-soft"> — {i.label}</span>}
                    </span>
                    <span className="text-xs text-muted">
                      {i.sku} · {formatKz(i.price)}
                    </span>
                  </span>
                  {stock && <span className={cn("shrink-0 text-xs font-medium", (s ?? 0) > 0 ? "text-muted" : "text-danger")}>{formatNumber(s ?? 0)} em stock</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {focus && tokens.length > 0 && results.length === 0 && <div className="absolute inset-x-0 top-full z-20 mt-1.5 rounded-2xl border border-line bg-surface p-4 text-sm text-muted shadow-lift">Nenhum artigo encontrado.</div>}
    </div>
  );
}
