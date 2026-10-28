"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn, formatNumber } from "@/lib/format";

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:opacity-60";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "h-auto min-h-24 py-3", className)} {...props} />;
}

/** Select nativo: no telemóvel abre a roda do sistema, que é o mais cómodo */
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        inputClass,
        "appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238a7465%22 stroke-width=%222.5%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[right_0.9rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium text-ink-soft", className)} {...props} />;
}

export function Field({ label, hint, error, children, className, htmlFor }: { label?: React.ReactNode; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? <p className="text-sm text-danger">{error}</p> : hint ? <p className="text-[13px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}

/** Campo de valores em Kwanza com separador de milhares enquanto se escreve */
export function MoneyInput({
  value,
  onChange,
  className,
  allowDecimals,
  suffix = "Kz",
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & { value: number | null; onChange: (v: number) => void; allowDecimals?: boolean; suffix?: string }) {
  const [text, setText] = React.useState(value ? (allowDecimals ? String(value).replace(".", ",") : formatNumber(value)) : "");
  const last = React.useRef(value);
  React.useEffect(() => {
    if (value !== last.current) {
      setText(value ? (allowDecimals ? String(value).replace(".", ",") : formatNumber(value)) : "");
      last.current = value;
    }
  }, [value, allowDecimals]);
  return (
    <div className="relative">
      <input
        inputMode={allowDecimals ? "decimal" : "numeric"}
        className={cn(inputClass, "pr-11 tabular", className)}
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          let v: number;
          if (allowDecimals) {
            const cleaned = raw.replace(/[^\d,.]/g, "");
            v = Number(cleaned.replace(",", ".")) || 0;
            setText(cleaned);
          } else {
            const digits = raw.replace(/\D/g, "").slice(0, 13);
            v = digits ? Number(digits) : 0;
            setText(digits ? formatNumber(v) : "");
          }
          last.current = v;
          onChange(v);
        }}
        {...props}
      />
      <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>
    </div>
  );
}

export function NumberInput({ value, onChange, min = 0, max, className, ...props }: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className={cn(inputClass, "tabular", className)}
      value={Number.isFinite(value) ? value : ""}
      min={min}
      max={max}
      onChange={(e) => {
        const n = e.target.value === "" ? min : Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.max(min, max !== undefined ? Math.min(max, n) : n));
      }}
      {...props}
    />
  );
}

/** − 3 + : grande o suficiente para dedos */
export function Stepper({ value, onChange, min = 0, max = 100000, size = "md" }: { value: number; onChange: (v: number) => void; min?: number; max?: number; size?: "sm" | "md" }) {
  const btn = size === "sm" ? "size-9" : "size-11";
  return (
    <div className="inline-flex items-center rounded-xl border border-line bg-surface">
      <button type="button" aria-label="Menos" className={cn(btn, "grid place-items-center rounded-l-xl text-ink-soft hover:bg-sand disabled:opacity-40")} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus className="size-4" />
      </button>
      <input
        inputMode="numeric"
        aria-label="Quantidade"
        className={cn("w-12 bg-transparent text-center font-semibold tabular focus:outline-none", size === "sm" ? "h-9" : "h-11")}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button type="button" aria-label="Mais" className={cn(btn, "grid place-items-center rounded-r-xl text-ink-soft hover:bg-sand disabled:opacity-40")} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; description?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 rounded-xl py-2", disabled && "cursor-not-allowed opacity-60")}>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-ink">{label}</span>
        {description && <span className="text-sm leading-snug text-muted">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-sand-strong")}
      >
        <span className={cn("absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform", checked && "translate-x-5")} />
      </button>
    </label>
  );
}

export function Checkbox({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; description?: React.ReactNode; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl p-2 -m-2 hover:bg-sand/60", disabled && "cursor-not-allowed opacity-60")}>
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium leading-snug text-ink">{label}</span>
        {description && <span className="text-sm leading-snug text-muted">{description}</span>}
      </span>
    </label>
  );
}
