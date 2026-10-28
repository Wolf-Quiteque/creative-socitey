"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DropdownMenu as DM } from "radix-ui";
import { useTheme } from "next-themes";
import {
  Boxes,
  CalendarDays,
  Clock,
  Home,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Settings,
  ShoppingBag,
  Store,
  Sun,
  Tag,
  Truck,
  UserRound,
  Users,
  Wallet,
  ChevronsUpDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/format";
import { allowedNav, type NavIcon, type NavItem } from "@/lib/nav";
import { Avatar } from "@/components/ui/card";
import { logout, setCurrentStore } from "@/app/actions/session";
import { OfflineBanner, useInstall } from "@/components/pwa/pwa";
import { Download } from "lucide-react";
import { toast } from "sonner";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  home: Home,
  pos: ShoppingBag,
  receipt: Receipt,
  boxes: Boxes,
  tag: Tag,
  truck: Truck,
  wallet: Wallet,
  calendar: CalendarDays,
  clock: Clock,
  users: Users,
  store: Store,
  settings: Settings,
};

export type ShellProps = {
  perms: string[];
  user: { name: string; role: string };
  business: string;
  stores: { id: string; name: string; code: string }[];
  currentStoreId: string | null;
  canAll: boolean;
  children: React.ReactNode;
};

function isActive(path: string, item: NavItem) {
  return item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/");
}

export function AppShell({ perms, user, business, stores, currentStoreId, canAll, children }: ShellProps) {
  const path = usePathname();
  const nav = React.useMemo(() => allowedNav(new Set(perms)), [perms]);
  const groups = React.useMemo(() => {
    const map = new Map<string, NavItem[]>();
    for (const n of nav) map.set(n.group, [...(map.get(n.group) ?? []), n]);
    return [...map];
  }, [nav]);
  const bottom = React.useMemo(() => [...nav].sort((a, b) => a.mobile - b.mobile).slice(0, nav.length > 5 ? 4 : 5), [nav]);
  const rest = nav.filter((n) => !bottom.includes(n));
  const [moreOpen, setMoreOpen] = React.useState(false);
  React.useEffect(() => setMoreOpen(false), [path]);

  return (
    <div className="min-h-dvh">
      <OfflineBanner />
      {/* Barra lateral (tablet: só ícones; computador: completa) */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-20 flex-col border-r border-line/70 bg-surface/80 backdrop-blur md:flex lg:w-72">
        <div className="flex h-20 items-center gap-3 px-5 lg:px-6">
          <BrandMark />
          <div className="hidden min-w-0 lg:block">
            <div className="truncate font-display text-lg font-semibold leading-tight text-ink">{business}</div>
            <div className="text-xs text-muted">Gestão</div>
          </div>
        </div>
        <div className="hidden px-4 pb-3 lg:block">
          <StoreSwitcher stores={stores} currentStoreId={currentStoreId} canAll={canAll} />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4 scrollbar-none lg:px-4">
          {groups.map(([group, items]) => (
            <div key={group} className="mt-2.5 first:mt-0">
              <div className="mb-1 hidden px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted/80 lg:block">{group}</div>
              <ul className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = isActive(path, item);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.label}
                        className={cn(
                          "flex h-11 items-center justify-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors lg:h-10 lg:justify-start",
                          active ? "bg-primary-soft text-primary" : "text-ink-soft hover:bg-sand hover:text-ink",
                        )}
                      >
                        <Icon className="size-5 shrink-0" />
                        <span className="hidden truncate lg:inline">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-line/70 p-3 lg:p-4">
          <UserMenu user={user} />
        </div>
      </aside>

      {/* Topo no telemóvel */}
      <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line/60 bg-bg/85 px-4 backdrop-blur-md md:hidden">
        <BrandMark small />
        <div className="min-w-0 flex-1">
          <StoreSwitcher stores={stores} currentStoreId={currentStoreId} canAll={canAll} compact />
        </div>
        <UserMenu user={user} compact />
      </header>

      {/* Tablet: seletor de loja no topo do conteúdo */}
      <div className="no-print hidden px-8 pt-5 md:block md:pl-28 lg:hidden">
        <div className="max-w-xs">
          <StoreSwitcher stores={stores} currentStoreId={currentStoreId} canAll={canAll} />
        </div>
      </div>

      <main className="px-4 pt-5 pb-28 md:pl-28 md:pr-8 md:pt-8 md:pb-12 lg:pl-80 lg:pr-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      {/* Barra de baixo no telemóvel */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-surface/95 backdrop-blur-md pb-safe md:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${bottom.length + (rest.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {bottom.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(path, item);
            return (
              <li key={item.href}>
                <Link href={item.href} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-primary" : "text-muted")}>
                  <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors", active && "bg-primary-soft")}>
                    <Icon className="size-[22px]" />
                  </span>
                  <span className="max-w-full truncate px-1">{item.short ?? item.label}</span>
                </Link>
              </li>
            );
          })}
          {rest.length > 0 && (
            <li>
              <button onClick={() => setMoreOpen(true)} className={cn("flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium", rest.some((r) => isActive(path, r)) ? "text-primary" : "text-muted")}>
                <span className="grid h-8 w-14 place-items-center rounded-full">
                  <Menu className="size-[22px]" />
                </span>
                Mais
              </button>
            </li>
          )}
        </ul>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Mais secções">
          <button className="absolute inset-0 bg-[rgb(40_26_20/0.45)] animate-fade-in" aria-label="Fechar" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface p-4 pb-safe shadow-lift animate-sheet-up">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="font-display text-lg font-semibold">Mais</div>
              <button className="grid size-10 place-items-center rounded-full hover:bg-sand" onClick={() => setMoreOpen(false)} aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-2 pb-3">
              {rest.map((item) => {
                const Icon = ICONS[item.icon];
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn("flex h-24 flex-col items-center justify-center gap-2 rounded-2xl bg-sand/70 p-2 text-center text-[13px] font-medium leading-tight", isActive(path, item) ? "text-primary ring-2 ring-primary/30" : "text-ink-soft")}
                    >
                      <Icon className="size-6" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function BrandMark({ small }: { small?: boolean }) {
  return (
    <Link href="/" aria-label="Início" className={cn("grid shrink-0 place-items-center rounded-2xl bg-primary font-display font-semibold text-on-primary shadow-soft", small ? "size-10 text-base" : "size-11 text-lg")}>
      CS
    </Link>
  );
}

function StoreSwitcher({ stores, currentStoreId, canAll, compact }: { stores: ShellProps["stores"]; currentStoreId: string | null; canAll: boolean; compact?: boolean }) {
  const [pending, start] = React.useTransition();
  if (!stores.length) return compact ? <div className="truncate text-sm text-muted">Sem lojas</div> : null;
  const single = stores.length === 1 && !canAll;
  const current = stores.find((s) => s.id === currentStoreId);
  return (
    <label className={cn("relative flex items-center gap-2 rounded-xl border border-line bg-surface", compact ? "h-10 px-3" : "h-11 px-3.5", pending && "opacity-60")}>
      <Store className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{current ? current.name : "Todas as lojas"}</span>
      {!single && <ChevronsUpDown className="size-4 shrink-0 text-muted" />}
      {!single && (
        <select
          aria-label="Loja"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={currentStoreId ?? "all"}
          onChange={(e) =>
            start(async () => {
              const r = await setCurrentStore(e.target.value);
              if (!r.ok) toast.error(r.error);
            })
          }
        >
          {canAll && <option value="all">Todas as lojas</option>}
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}

function UserMenu({ user, compact }: { user: ShellProps["user"]; compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const install = useInstall();
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button className={cn("flex items-center gap-3 rounded-xl text-left hover:bg-sand", compact ? "p-0.5" : "w-full justify-center p-1.5 lg:justify-start lg:p-2")} aria-label="Conta">
          <Avatar name={user.name} size={compact ? "sm" : "md"} />
          {!compact && (
            <span className="hidden min-w-0 lg:block">
              <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
              <span className="block truncate text-xs text-muted">{user.role}</span>
            </span>
          )}
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" side={compact ? "bottom" : "top"} sideOffset={8} className="z-50 min-w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-lift animate-fade-in">
          <div className="px-3 py-2">
            <div className="text-sm font-semibold text-ink">{user.name}</div>
            <div className="text-xs text-muted">{user.role}</div>
          </div>
          <DM.Separator className="my-1 h-px bg-line" />
          <DM.Item asChild>
            <Link href="/perfil" className="flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-ink outline-none data-[highlighted]:bg-sand">
              <UserRound className="size-[18px] text-muted" /> O meu perfil
            </Link>
          </DM.Item>
          <DM.Item onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-ink outline-none data-[highlighted]:bg-sand">
            {resolvedTheme === "dark" ? <Sun className="size-[18px] text-muted" /> : <Moon className="size-[18px] text-muted" />}
            {resolvedTheme === "dark" ? "Tema claro" : "Tema escuro"}
          </DM.Item>
          {install.available && install.canPrompt && (
            <DM.Item onSelect={() => void install.prompt()} className="flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-ink outline-none data-[highlighted]:bg-sand">
              <Download className="size-[18px] text-muted" /> Instalar a app
            </DM.Item>
          )}
          <DM.Separator className="my-1 h-px bg-line" />
          <DM.Item onSelect={() => void logout()} className="flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft">
            <LogOut className="size-[18px]" /> Sair
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
