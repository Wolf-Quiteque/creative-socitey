"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, CreditCard, Lock, MessageCircle, Minus, PackageX, Plus, Printer, Search, ShoppingBag, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import type { PickItem } from "@/lib/queries";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { cn, formatKz, formatNumber, formatPct, formatTime } from "@/lib/format";
import { normalize } from "@/lib/text";
import { useAction } from "@/lib/use-action";
import { closeTillAction, createSaleAction, openTillAction } from "@/app/actions/app";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, Input, MoneyInput, Stepper, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";
import { Segmented } from "@/components/ui/nav-tabs";
import { ProductThumb } from "@/components/pos/ProductThumb";
import { useIsOffline } from "@/components/pwa/pwa";

type Item = Omit<PickItem, "cost">;
type CartLine = { variantId: string; qty: number; unitPrice?: number };
type Pay = { method: PaymentMethod; amount: number };

type Props = {
  store: { id: string; name: string; allowNegative: boolean; requireTill: boolean };
  business: string;
  items: Item[];
  categories: { id: string; name: string }[];
  till: { id: string; openedBy: string; openedAt: string; float: number } | null;
  tillSummary: { sales: number; count: number; expectedCash: number; byMethod: Record<string, number>; cashIn: number; cashOut: number } | null;
  perms: { discount: boolean; maxDiscountPct: number; manualPrice: boolean; till: boolean };
};

function uuid(): string {
  // randomUUID só existe em https; em http (rede local) usamos getRandomValues
  const c: Crypto = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function Pos(props: Props) {
  const { store, items, categories, till, perms } = props;
  const router = useRouter();
  const storageKey = `cs:pos:${store.id}`;
  const byId = React.useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);

  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [discount, setDiscount] = React.useState<{ type: "pct" | "kz"; value: number }>({ type: "pct", value: 0 });
  const [customer, setCustomer] = React.useState({ name: "", phone: "" });
  const [requestId, setRequestId] = React.useState("");
  const [sold, setSold] = React.useState<Record<string, number>>({});
  const [loaded, setLoaded] = React.useState(false);

  // O carrinho fica guardado no aparelho: uma falha de rede ou um recarregar não o perdem
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw);
        setCart((s.cart ?? []).filter((l: CartLine) => byId.has(l.variantId)));
        if (s.discount) setDiscount(s.discount);
        if (s.customer) setCustomer(s.customer);
        setRequestId(s.requestId || uuid());
      } else setRequestId(uuid());
    } catch {
      setRequestId(uuid());
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  React.useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ cart, discount, customer, requestId }));
    } catch {}
  }, [cart, discount, customer, requestId, loaded, storageKey]);
  // Os números do servidor chegaram: o stock local volta a ser o real
  React.useEffect(() => setSold({}), [items]);

  const stockOf = (id: string) => (byId.get(id)?.stock ?? 0) - (sold[id] ?? 0);
  const inCart = (id: string) => cart.filter((l) => l.variantId === id).reduce((s, l) => s + l.qty, 0);

  const add = (item: Item, qty = 1) => {
    const available = stockOf(item.variantId) - inCart(item.variantId);
    if (!store.allowNegative && available < qty) {
      toast.error(available > 0 ? `Só restam ${available} de «${item.name}».` : `«${item.name}${item.label ? ` — ${item.label}` : ""}» está esgotado nesta loja.`);
      return;
    }
    setCart((c) => {
      const i = c.findIndex((l) => l.variantId === item.variantId && l.unitPrice === undefined);
      if (i >= 0) return c.map((l, j) => (j === i ? { ...l, qty: l.qty + qty } : l));
      return [...c, { variantId: item.variantId, qty }];
    });
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(15);
  };

  const lines = cart.map((l) => {
    const item = byId.get(l.variantId)!;
    const price = l.unitPrice ?? item.price;
    return { ...l, item, price, total: price * l.qty };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const discountKz = Math.min(subtotal, Math.round(discount.type === "pct" ? (subtotal * Math.min(discount.value, 100)) / 100 : discount.value));
  const discountPct = subtotal ? (discountKz / subtotal) * 100 : 0;
  const discountTooHigh = discountKz > 0 && (!perms.discount || discountPct > perms.maxDiscountPct + 0.001);
  const total = subtotal - discountKz;
  const units = cart.reduce((s, l) => s + l.qty, 0);

  const [cartOpen, setCartOpen] = React.useState(false);
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [done, setDone] = React.useState<null | { id: string; number: string; total: number; change: number; phone?: string; text: string }>(null);

  const clear = () => {
    setCart([]);
    setDiscount({ type: "pct", value: 0 });
    setCustomer({ name: "", phone: "" });
  };

  if (store.requireTill && !till) return <TillGate store={store} canOpen={perms.till} />;

  const cartPanel = (
    <CartPanel
      lines={lines}
      setCart={setCart}
      perms={perms}
      discount={discount}
      setDiscount={setDiscount}
      discountKz={discountKz}
      discountTooHigh={discountTooHigh}
      subtotal={subtotal}
      total={total}
      customer={customer}
      setCustomer={setCustomer}
      onClear={clear}
      onCheckout={() => {
        if (discountTooHigh) return toast.error(perms.discount ? `O desconto máximo do seu cargo é ${formatPct(perms.maxDiscountPct, 0)}.` : "Não tem permissão para dar descontos.");
        setCartOpen(false);
        setCheckoutOpen(true);
      }}
      stockOf={stockOf}
      allowNegative={store.allowNegative}
    />
  );

  return (
    <div className="-mt-1">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl">Vender</h1>
          <p className="text-sm text-muted">{store.name}</p>
        </div>
        {till && <TillChip till={till} summary={props.tillSummary} canClose={perms.till} cartEmpty={!cart.length} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Catalog items={items} categories={categories} stockOf={stockOf} onPick={add} allowNegative={store.allowNegative} />
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <Card className="flex max-h-[calc(100dvh-3rem)] flex-col overflow-hidden">{cartPanel}</Card>
          </div>
        </aside>
      </div>

      {/* Barra do carrinho no telemóvel/tablet */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 px-3 pb-2 md:bottom-4 md:pl-28 md:pr-8 lg:hidden">
          <button onClick={() => setCartOpen(true)} className="flex h-16 w-full items-center gap-3 rounded-2xl bg-ink px-4 text-left text-bg shadow-lift active:scale-[0.99]">
            <span className="grid size-10 place-items-center rounded-xl bg-white/15">
              <ShoppingBag className="size-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm opacity-80">Carrinho · {units} artigo(s)</span>
              <span className="block text-lg font-semibold tabular">{formatKz(total)}</span>
            </span>
            <span className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary">Ver</span>
          </button>
        </div>
      )}
      <Sheet open={cartOpen} onOpenChange={setCartOpen} title="Carrinho" size="md">
        <div className="-mx-5 -mb-5 flex flex-col md:-mx-7">{cartPanel}</div>
      </Sheet>

      <Checkout
        open={checkoutOpen}
        onOpenChange={(o) => {
          setCheckoutOpen(o);
          if (!o) setDone(null);
        }}
        total={total}
        done={done}
        onSubmit={(payments, cashGiven) =>
          createSaleAction({
            storeId: store.id,
            clientRequestId: requestId,
            lines: cart.map((l) => ({ variantId: l.variantId, qty: l.qty, ...(l.unitPrice !== undefined ? { unitPrice: l.unitPrice } : {}) })),
            discount,
            payments,
            customer: customer.name || customer.phone ? customer : undefined,
          }).then((r) => {
            if (r.ok) {
              const change = Math.max(0, cashGiven - (total - payments.filter((p) => p.method !== "dinheiro").reduce((s, p) => s + p.amount, 0)));
              const text = [
                `*${props.business}* — ${store.name}`,
                `Venda ${r.number}`,
                ...lines.map((l) => `${l.qty} × ${l.item.name}${l.item.label ? ` (${l.item.label})` : ""} — ${formatKz(l.total)}`),
                discountKz ? `Desconto: −${formatKz(discountKz)}` : "",
                `*Total: ${formatKz(total)}*`,
                "Obrigado pela preferência!",
              ]
                .filter(Boolean)
                .join("\n");
              setDone({ id: r.id, number: r.number, total, change, phone: customer.phone, text });
              setSold((s) => {
                const n = { ...s };
                for (const l of cart) n[l.variantId] = (n[l.variantId] ?? 0) + l.qty;
                return n;
              });
              clear();
              setRequestId(uuid());
              router.refresh();
            }
            return r;
          })
        }
        onNewSale={() => {
          setDone(null);
          setCheckoutOpen(false);
        }}
      />
    </div>
  );
}

// ── Catálogo ────────────────────────────────────────────────

function Catalog({ items, categories, stockOf, onPick, allowNegative }: { items: Item[]; categories: { id: string; name: string }[]; stockOf: (id: string) => number; onPick: (i: Item) => void; allowNegative: boolean }) {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<string>("all");
  const [onlyStock, setOnlyStock] = React.useState(false);
  const [variantsOf, setVariantsOf] = React.useState<Item[] | null>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) searchRef.current?.focus();
  }, []);

  const tokens = normalize(q).split(" ").filter(Boolean);
  const filtered = items.filter((i) => (cat === "all" || i.categoryId === cat) && tokens.every((t) => i.search.includes(t)) && (!onlyStock || stockOf(i.variantId) > 0));
  const groups = React.useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const i of filtered) map.set(i.productId, [...(map.get(i.productId) ?? []), i]);
    return [...map.values()];
  }, [filtered]);
  const usedCats = categories.filter((c) => items.some((i) => i.categoryId === c.id));

  const pickGroup = (g: Item[]) => {
    if (g.length === 1) onPick(g[0]);
    else setVariantsOf(g);
  };

  return (
    <div className="min-w-0">
      <div className="sticky top-16 z-10 -mx-4 bg-bg/90 px-4 pb-3 pt-1 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <Input
            ref={searchRef}
            className="h-13 rounded-2xl pl-12 pr-11 text-base shadow-soft"
            placeholder="Procurar por nome, cor, SKU ou código de barras"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const code = q.trim().toUpperCase();
              const exact = items.find((i) => i.sku === code || (i.barcode && i.barcode.toUpperCase() === code));
              if (exact) {
                onPick(exact);
                setQ("");
              } else if (groups.length === 1) {
                pickGroup(groups[0]);
                setQ("");
              }
            }}
            enterKeyHint="search"
          />
          {q && (
            <button className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-sand" onClick={() => setQ("")} aria-label="Limpar">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 scrollbar-none md:mx-0 md:flex-wrap md:px-0">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            Tudo
          </Chip>
          {usedCats.map((c) => (
            <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
              {c.name}
            </Chip>
          ))}
          <Chip active={onlyStock} onClick={() => setOnlyStock((v) => !v)}>
            Só com stock
          </Chip>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted">
          <PackageX className="size-8" />
          <p>{items.length ? "Nada encontrado. Experimente outra palavra." : "Ainda não há produtos no catálogo."}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 pb-24 sm:grid-cols-3 xl:grid-cols-4 lg:pb-0">
          {groups.map((g) => {
            const first = g[0];
            const stock = g.reduce((s, i) => s + Math.max(0, stockOf(i.variantId)), 0);
            const prices = g.map((i) => i.price);
            const min = Math.min(...prices);
            const out = stock <= 0 && !allowNegative;
            return (
              <li key={first.productId}>
                <button
                  onClick={() => pickGroup(g)}
                  className={cn(
                    "group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line/70 bg-surface text-left shadow-soft transition active:scale-[0.98] hover:border-primary/40 hover:shadow-lift",
                    out && "opacity-55",
                  )}
                >
                  <ProductThumb name={first.name} imageId={first.imageId} className="aspect-[4/3] w-full" />
                  <span className="flex flex-1 flex-col gap-1 p-3">
                    <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{first.name}</span>
                    {g.length === 1 && first.label && <span className="truncate text-[13px] text-muted">{first.label}</span>}
                    {g.length > 1 && <span className="text-[13px] text-muted">{g.length} opções</span>}
                    <span className="mt-auto flex items-end justify-between gap-2 pt-1">
                      <span className="font-semibold text-primary tabular">
                        {prices.some((p) => p !== min) && <span className="text-xs font-normal text-muted">desde </span>}
                        {formatKz(min)}
                      </span>
                      <span className={cn("text-xs font-medium", stock <= 0 ? "text-danger" : "text-muted")}>{stock <= 0 ? "Esgotado" : `${formatNumber(stock)} un.`}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={!!variantsOf} onOpenChange={(o) => !o && setVariantsOf(null)} title={variantsOf?.[0]?.name ?? ""} description="Escolha a opção">
        <ul className="flex flex-col gap-2 pb-2">
          {variantsOf?.map((v) => {
            const s = stockOf(v.variantId);
            const out = s <= 0 && !allowNegative;
            return (
              <li key={v.variantId}>
                <button
                  disabled={out}
                  onClick={() => {
                    onPick(v);
                    setVariantsOf(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-primary/50 active:scale-[0.99] disabled:opacity-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">{v.label || v.sku}</span>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-[13px] text-muted">
                      <span>{v.sku}</span>
                      {v.attrs?.hairType && <span>· {v.attrs.hairType === "humano" ? "Humano" : v.attrs.hairType === "sintetico" ? "Sintético" : "Misto"}</span>}
                      {v.attrs?.lace && <span>· {v.attrs.lace}</span>}
                      {v.attrs?.density && <span>· {v.attrs.density}</span>}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-semibold text-primary tabular">{formatKz(v.price)}</span>
                    <span className={cn("text-xs", s <= 0 ? "text-danger" : "text-muted")}>{s <= 0 ? "Esgotado" : `${formatNumber(s)} em stock`}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors", active ? "bg-ink text-bg" : "bg-sand text-ink-soft hover:bg-sand-strong")}>
      {children}
    </button>
  );
}

// ── Carrinho ────────────────────────────────────────────────

function CartPanel(p: {
  lines: (CartLine & { item: Item; price: number; total: number })[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  perms: Props["perms"];
  discount: { type: "pct" | "kz"; value: number };
  setDiscount: (d: { type: "pct" | "kz"; value: number }) => void;
  discountKz: number;
  discountTooHigh: boolean;
  subtotal: number;
  total: number;
  customer: { name: string; phone: string };
  setCustomer: (c: { name: string; phone: string }) => void;
  onClear: () => void;
  onCheckout: () => void;
  stockOf: (id: string) => number;
  allowNegative: boolean;
}) {
  const [showCustomer, setShowCustomer] = React.useState(!!(p.customer.name || p.customer.phone));
  const [editPrice, setEditPrice] = React.useState<number | null>(null);
  if (!p.lines.length) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-sand text-primary">
          <ShoppingBag className="size-6" />
        </span>
        <p className="font-display text-lg font-semibold">Carrinho vazio</p>
        <p className="text-sm text-muted">Toque num produto para o adicionar.</p>
      </div>
    );
  }
  const update = (i: number, patch: Partial<CartLine>) => p.setCart((c) => c.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <>
      <div className="flex items-center justify-between px-5 pt-4 md:px-6">
        <span className="font-display text-lg font-semibold">
          <span className="hidden lg:inline">Carrinho</span>
        </span>
        <button onClick={p.onClear} className="text-sm font-medium text-muted hover:text-danger">
          Limpar
        </button>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto px-5 md:px-6">
        {p.lines.map((l, i) => {
          const max = p.allowNegative ? 100000 : Math.max(l.qty, p.stockOf(l.variantId) - p.lines.filter((x, j) => j !== i && x.variantId === l.variantId).reduce((s, x) => s + x.qty, 0));
          return (
            <li key={`${l.variantId}-${i}`} className="py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium leading-snug text-ink">{l.item.name}</div>
                  {l.item.label && <div className="text-[13px] text-muted">{l.item.label}</div>}
                </div>
                <button onClick={() => p.setCart((c) => c.filter((_, j) => j !== i))} className="-mr-2 grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remover">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <Stepper size="sm" value={l.qty} min={1} max={max} onChange={(v) => update(i, { qty: v })} />
                {editPrice === i ? (
                  <div className="w-36">
                    <MoneyInput autoFocus value={l.price} onChange={(v) => update(i, { unitPrice: v === l.item.price ? undefined : v })} onBlur={() => setEditPrice(null)} className="h-9" />
                  </div>
                ) : (
                  <button
                    disabled={!p.perms.manualPrice}
                    onClick={() => setEditPrice(i)}
                    className={cn("text-right", p.perms.manualPrice && "rounded-lg px-1.5 hover:bg-sand")}
                    title={p.perms.manualPrice ? "Alterar preço" : undefined}
                  >
                    <span className="block font-semibold text-ink tabular">{formatKz(l.total)}</span>
                    <span className={cn("text-xs tabular", l.unitPrice !== undefined ? "text-warning" : "text-muted")}>
                      {l.qty} × {formatKz(l.price)}
                    </span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-line bg-sand/40 px-5 py-4 md:px-6">
        {p.perms.discount && (
          <div className="mb-3 flex items-center gap-2">
            <Segmented
              value={p.discount.type}
              onChange={(t) => p.setDiscount({ type: t, value: 0 })}
              options={[
                { value: "pct", label: "%" },
                { value: "kz", label: "Kz" },
              ]}
            />
            <div className="flex-1">
              {p.discount.type === "pct" ? (
                <Input inputMode="numeric" placeholder={`Desconto (máx. ${p.perms.maxDiscountPct}%)`} value={p.discount.value || ""} onChange={(e) => p.setDiscount({ type: "pct", value: Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0) })} />
              ) : (
                <MoneyInput placeholder="Desconto" value={p.discount.value} onChange={(v) => p.setDiscount({ type: "kz", value: v })} />
              )}
            </div>
          </div>
        )}
        {showCustomer ? (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Input placeholder="Nome do cliente" value={p.customer.name} onChange={(e) => p.setCustomer({ ...p.customer, name: e.target.value })} />
            <Input placeholder="Telefone" inputMode="tel" value={p.customer.phone} onChange={(e) => p.setCustomer({ ...p.customer, phone: e.target.value })} />
          </div>
        ) : (
          <button onClick={() => setShowCustomer(true)} className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
            <UserRound className="size-4" /> Adicionar cliente (opcional)
          </button>
        )}
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between text-ink-soft">
            <dt>Subtotal</dt>
            <dd className="tabular">{formatKz(p.subtotal)}</dd>
          </div>
          {p.discountKz > 0 && (
            <div className={cn("flex justify-between", p.discountTooHigh ? "text-danger" : "text-success")}>
              <dt>Desconto{p.discountTooHigh ? " (acima do permitido)" : ""}</dt>
              <dd className="tabular">−{formatKz(p.discountKz)}</dd>
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between">
            <dt className="font-medium text-ink">Total</dt>
            <dd className="text-2xl font-semibold text-ink tabular">{formatKz(p.total)}</dd>
          </div>
        </dl>
        <Button size="xl" className="mt-4 w-full" onClick={p.onCheckout}>
          Cobrar {formatKz(p.total)}
        </Button>
      </div>
    </>
  );
}

// ── Pagamento ───────────────────────────────────────────────

const METHOD_ICON: Partial<Record<PaymentMethod, React.ReactNode>> = { dinheiro: <Banknote />, tpa: <CreditCard /> };

function Checkout({
  open,
  onOpenChange,
  total,
  done,
  onSubmit,
  onNewSale,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  total: number;
  done: null | { id: string; number: string; total: number; change: number; phone?: string; text: string };
  onSubmit: (payments: Pay[], cashGiven: number) => Promise<{ ok: boolean; error?: string }>;
  onNewSale: () => void;
}) {
  const [split, setSplit] = React.useState(false);
  const [method, setMethod] = React.useState<PaymentMethod>("dinheiro");
  const [received, setReceived] = React.useState(0);
  const [rows, setRows] = React.useState<Pay[]>([]);
  const [pending, start] = React.useTransition();
  const offline = useIsOffline();

  React.useEffect(() => {
    if (open && !done) {
      setSplit(false);
      setMethod("dinheiro");
      setReceived(total);
      setRows([
        { method: "dinheiro", amount: total },
        { method: "tpa", amount: 0 },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const payments: Pay[] = split ? rows.filter((r) => r.amount > 0) : [{ method, amount: method === "dinheiro" ? received : total }];
  const cashGiven = payments.filter((p) => p.method === "dinheiro").reduce((s, p) => s + p.amount, 0);
  const nonCash = payments.filter((p) => p.method !== "dinheiro").reduce((s, p) => s + p.amount, 0);
  const missing = Math.max(0, total - nonCash - cashGiven);
  const change = Math.max(0, cashGiven - Math.max(0, total - nonCash));
  const invalid = missing > 0 || nonCash > total;
  const quick = [...new Set([total, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000])].filter((v) => v >= total).slice(0, 4);

  const submit = () =>
    start(async () => {
      try {
        const r = await onSubmit(payments, cashGiven);
        if (!r.ok) toast.error(r.error);
      } catch {
        toast.error("Sem ligação. A venda NÃO foi registada — o carrinho está guardado, tente de novo.");
      }
    });

  if (done) {
    const phone = done.phone?.replace(/\D/g, "").replace(/^(?=9\d{8}$)/, "244");
    return (
      <Sheet open={open} onOpenChange={onOpenChange} title="Venda concluída" size="sm">
        <div className="flex flex-col items-center gap-2 pb-2 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-8" />
          </span>
          <div className="text-sm text-muted">{done.number}</div>
          <div className="text-3xl font-semibold text-ink">{formatKz(done.total)}</div>
          {done.change > 0 && (
            <div className="mt-2 w-full rounded-2xl bg-warning-soft p-4 text-warning">
              <div className="text-sm font-medium">Troco a dar</div>
              <div className="text-3xl font-semibold tabular">{formatKz(done.change)}</div>
            </div>
          )}
          <div className="mt-4 grid w-full grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => window.open(`/recibo/${done.id}`, "_blank")}>
              <Printer /> Talão
            </Button>
            <Button variant="outline" onClick={() => window.open(`https://wa.me/${phone ?? ""}?text=${encodeURIComponent(done.text)}`, "_blank")}>
              <MessageCircle /> WhatsApp
            </Button>
          </div>
          <Button size="lg" className="mt-2 w-full" onClick={onNewSale}>
            Nova venda
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      // Com a venda a caminho não se fecha: se a rede cair, ela fica à espera e conclui-se sozinha
      onOpenChange={(o) => (pending && !o ? toast.info("A venda está a ser enviada. Aguarde a confirmação.") : onOpenChange(o))}
      title="Pagamento"
      size="sm"
      footer={
        <div className="flex w-full flex-col gap-2">
          {pending && offline && (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-center text-sm text-warning">Sem internet. A venda fica à espera e conclui-se sozinha quando a ligação voltar. Não feche esta janela.</p>
          )}
          {!pending && offline && <p className="rounded-xl bg-warning-soft px-3 py-2 text-center text-sm text-warning">Está sem internet. Pode carregar em concluir: a venda segue quando a ligação voltar.</p>}
          <Button size="xl" className="w-full" loading={pending} disabled={invalid} onClick={submit}>
            {pending ? (offline ? "À espera de ligação…" : "A enviar…") : missing > 0 ? `Falta ${formatKz(missing)}` : "Concluir venda"}
          </Button>
        </div>
      }
    >
      <div className="mb-5 rounded-2xl bg-sand p-4 text-center">
        <div className="text-sm text-muted">Total a pagar</div>
        <div className="text-4xl font-semibold text-ink tabular">{formatKz(total)}</div>
      </div>
      {!split ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setMethod(m)}
                className={cn(
                  "flex h-14 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition [&_svg]:size-5",
                  method === m ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink-soft hover:bg-sand",
                  m === "outro" && "col-span-2 h-11",
                )}
              >
                {METHOD_ICON[m]}
                {PAYMENT_METHODS[m]}
              </button>
            ))}
          </div>
          {method === "dinheiro" && (
            <div className="mt-5">
              <Field label="Valor recebido">
                <MoneyInput value={received} onChange={setReceived} className="h-14 text-xl font-semibold" />
              </Field>
              <div className="mt-2 flex flex-wrap gap-2">
                {quick.map((v) => (
                  <button key={v} onClick={() => setReceived(v)} className={cn("h-10 rounded-full px-4 text-sm font-medium", received === v ? "bg-ink text-bg" : "bg-sand text-ink-soft")}>
                    {v === total ? "Exato" : formatKz(v)}
                  </button>
                ))}
              </div>
              {change > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-warning-soft px-4 py-3 text-warning">
                  <span className="font-medium">Troco</span>
                  <span className="text-2xl font-semibold tabular">{formatKz(change)}</span>
                </div>
              )}
            </div>
          )}
          <button onClick={() => setSplit(true)} className="mt-5 text-sm font-medium text-primary">
            Pagar com mais do que um método
          </button>
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  className="h-11 rounded-xl border border-line bg-surface px-3 text-sm"
                  value={r.method}
                  onChange={(e) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, method: e.target.value as PaymentMethod } : x)))}
                >
                  {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHODS[m]}
                    </option>
                  ))}
                </select>
                <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-xl text-muted hover:bg-sand" aria-label="Remover">
                  <Minus className="size-4" />
                </button>
                <div className="col-span-2">
                  <MoneyInput value={r.amount} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, amount: v } : x)))} />
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between">
            <button onClick={() => setRows((rs) => [...rs, { method: "transferencia", amount: Math.max(0, missing) }])} className="flex items-center gap-1 text-sm font-medium text-primary">
              <Plus className="size-4" /> Outro método
            </button>
            <button onClick={() => setSplit(false)} className="text-sm text-muted">
              Só um método
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-1 rounded-2xl bg-sand p-4 text-sm">
            <div className="flex justify-between">
              <span>Recebido</span>
              <span className="font-semibold tabular">{formatKz(cashGiven + nonCash)}</span>
            </div>
            {missing > 0 && (
              <div className="flex justify-between text-danger">
                <span>Falta</span>
                <span className="font-semibold tabular">{formatKz(missing)}</span>
              </div>
            )}
            {change > 0 && (
              <div className="flex justify-between text-warning">
                <span>Troco</span>
                <span className="font-semibold tabular">{formatKz(change)}</span>
              </div>
            )}
            {nonCash > total && <div className="text-danger">Cartão/transferência não podem passar do total.</div>}
          </div>
        </>
      )}
    </Sheet>
  );
}

// ── Caixa ───────────────────────────────────────────────────

function TillGate({ store, canOpen }: { store: Props["store"]; canOpen: boolean }) {
  const [float, setFloat] = React.useState(0);
  const { pending, run } = useAction();
  return (
    <div className="mx-auto max-w-md py-6 md:py-12">
      <Card className="p-6 text-center md:p-8">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-warning-soft text-warning">
          <Lock className="size-7" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold">A caixa está fechada</h1>
        <p className="mt-2 text-muted">{store.name}</p>
        {canOpen ? (
          <div className="mt-6 text-left">
            <Field label="Fundo de caixa" hint="Quanto dinheiro está na gaveta antes de começar (para o troco).">
              <MoneyInput value={float} onChange={setFloat} className="h-13 text-lg" />
            </Field>
            <Button size="xl" className="mt-5 w-full" loading={pending} onClick={() => run(() => openTillAction(store.id, float))}>
              Abrir caixa
            </Button>
          </div>
        ) : (
          <p className="mt-6 rounded-2xl bg-sand p-4 text-sm text-ink-soft">Peça ao responsável da loja para abrir a caixa antes de começar a vender.</p>
        )}
      </Card>
    </div>
  );
}

function TillChip({ till, summary, canClose, cartEmpty }: { till: NonNullable<Props["till"]>; summary: Props["tillSummary"]; canClose: boolean; cartEmpty: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [counted, setCounted] = React.useState(0);
  const [note, setNote] = React.useState("");
  const { pending, run } = useAction();
  const diff = summary ? counted - summary.expectedCash : 0;
  return (
    <>
      <div className="flex items-center gap-2">
        <Badge tone="success" dot>
          Caixa aberta · {till.openedBy} · {formatTime(till.openedAt)}
        </Badge>
        {canClose && (
          <Button size="sm" variant="outline" onClick={() => (cartEmpty ? setOpen(true) : toast.error("Termine ou limpe o carrinho antes de fechar a caixa."))}>
            Fechar caixa
          </Button>
        )}
      </div>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Fechar caixa"
        description="Conte o dinheiro na gaveta e escreva o total."
        size="sm"
        footer={
          <Button size="lg" loading={pending} onClick={() => run(() => closeTillAction(till.id, counted, note || undefined), { onSuccess: () => setOpen(false) })}>
            Confirmar fecho
          </Button>
        }
      >
        {summary && (
          <dl className="mb-5 flex flex-col gap-2 rounded-2xl bg-sand p-4 text-sm">
            <Row k="Vendas desta caixa" v={`${formatKz(summary.sales)} (${summary.count})`} />
            {Object.entries(summary.byMethod).map(([m, v]) => (
              <Row key={m} k={`· ${PAYMENT_METHODS[m as PaymentMethod] ?? m}`} v={formatKz(v)} muted />
            ))}
            <div className="my-1 h-px bg-line" />
            <Row k="Fundo inicial" v={formatKz(till.float)} />
            <Row k="Entradas em dinheiro" v={`+${formatKz(summary.cashIn)}`} />
            <Row k="Saídas em dinheiro" v={`−${formatKz(summary.cashOut)}`} />
            <div className="flex justify-between text-base font-semibold text-ink">
              <dt>Deve haver na gaveta</dt>
              <dd className="tabular">{formatKz(summary.expectedCash)}</dd>
            </div>
          </dl>
        )}
        <Field label="Dinheiro contado">
          <MoneyInput value={counted} onChange={setCounted} className="h-13 text-lg" />
        </Field>
        {summary && counted > 0 && (
          <div className={cn("mt-3 rounded-2xl px-4 py-3 text-sm font-medium", diff === 0 ? "bg-success-soft text-success" : diff < 0 ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning")}>
            {diff === 0 ? "Certo. Não há diferenças." : diff < 0 ? `Falta ${formatKz(-diff)} na gaveta.` : `Sobra ${formatKz(diff)} na gaveta.`}
          </div>
        )}
        <Field label="Observações (opcional)" className="mt-4">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </Field>
      </Sheet>
    </>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between", muted ? "text-muted" : "text-ink-soft")}>
      <dt>{k}</dt>
      <dd className="tabular">{v}</dd>
    </div>
  );
}
