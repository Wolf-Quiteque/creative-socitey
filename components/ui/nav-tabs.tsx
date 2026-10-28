"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

export type TabItem = { href: string; label: string; exact?: boolean };

/** Separadores de secção (ligações). Deslizam na horizontal no telemóvel. */
export function NavTabs({ items, className }: { items: TabItem[]; className?: string }) {
  const path = usePathname();
  if (items.length < 2) return null;
  return (
    <nav className={cn("-mx-4 mb-6 overflow-x-auto px-4 scrollbar-none md:mx-0 md:px-0", className)}>
      <div className="inline-flex gap-1 rounded-2xl bg-sand p-1">
        {items.map((t) => {
          const active = t.exact ? path === t.href : path === t.href || path.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors",
                active ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Botões de escolha (como separadores, mas sem navegar) */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn("inline-flex flex-wrap gap-1 rounded-2xl bg-sand p-1", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn("rounded-xl px-3.5 py-2 text-sm font-medium transition-colors", value === o.value ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
