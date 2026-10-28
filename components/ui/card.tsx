import * as React from "react";
import { cn, initials } from "@/lib/format";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border border-line/70 bg-surface shadow-soft", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5 md:px-6", className)}>
      <div className="min-w-0">
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("p-5 md:p-6", className)} {...props} />;
}

const tones = {
  neutral: "bg-sand text-ink-soft",
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  rose: "bg-rose-soft text-rose",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, children, dot }: { tone?: Tone; className?: string; children: React.ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-sm font-medium text-primary">{eyebrow}</div>}
        <h1 className="font-display text-[28px] leading-tight font-semibold tracking-tight text-ink md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 md:shrink-0">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      {icon && <div className="grid size-14 place-items-center rounded-2xl bg-sand text-primary [&_svg]:size-6">{icon}</div>}
      <div className="font-display text-lg font-semibold text-ink">{title}</div>
      {description && <p className="max-w-sm text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone, icon, className }: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode; tone?: "up" | "down" | "neutral"; icon?: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("flex flex-col gap-2 p-4 md:p-5", className)}>
      <div className="flex items-center justify-between gap-2 text-sm font-medium text-muted">
        <span>{label}</span>
        {icon && <span className="text-primary/80 [&_svg]:size-[18px]">{icon}</span>}
      </div>
      <div className="text-2xl font-semibold tracking-tight text-ink md:text-[28px]">{value}</div>
      {hint && <div className={cn("text-[13px]", tone === "up" ? "text-success" : tone === "down" ? "text-danger" : "text-muted")}>{hint}</div>}
    </Card>
  );
}

export function Avatar({ name, color, size = "md" }: { name: string; color?: string; size?: "sm" | "md" | "lg" }) {
  const s = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-lg" }[size];
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-semibold text-white", s)} style={{ background: color ?? "var(--rose)" }}>
      {initials(name) || "?"}
    </span>
  );
}

/** Lista de pares rótulo/valor (detalhes de documentos) */
export function DescList({ items, className }: { items: [React.ReactNode, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <dt className="text-[13px] text-muted">{k}</dt>
          <dd className="font-medium text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
