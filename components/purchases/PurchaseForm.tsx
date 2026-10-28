"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "@/lib/use-action";
import { savePurchaseAction } from "@/app/actions/app";
import { allocateLandedCost } from "@/lib/costing";
import { CURRENCIES, EXTRA_COST_KINDS, type Currency, type ExtraCostKind } from "@/lib/types";
import { cn, formatKz, formatNumber, formatPct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select, Stepper, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/nav-tabs";
import { VariantPicker, type CatalogItem } from "@/components/stock/VariantPicker";
import { StickyActions } from "@/components/ui/sticky-actions";

export type PurchaseState = {
  id?: string;
  supplierId: string;
  storeId: string;
  currency: Currency;
  rate: number;
  lines: { variantId: string; qty: number; unitCostForeign: number }[];
  extraCosts: { kind: ExtraCostKind; description?: string; amount: number }[];
  allocation: "valor" | "quantidade";
  invoiceRef?: string;
  note?: string;
};

export function PurchaseForm({ initial, items, suppliers, stores }: { initial: PurchaseState; items: CatalogItem[]; suppliers: { id: string; name: string }[]; stores: { id: string; name: string }[] }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [p, setP] = React.useState<PurchaseState>(initial);
  const set = (patch: Partial<PurchaseState>) => setP((x) => ({ ...x, ...patch }));
  const byId = React.useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);
  const rate = p.currency === "AOA" ? 1 : p.rate;
  const extraTotal = p.extraCosts.reduce((s, c) => s + (c.amount || 0), 0);
  const calc = allocateLandedCost(p.lines, rate, extraTotal, p.allocation);
  const foreign = p.currency !== "AOA";

  const add = (i: CatalogItem) => {
    if (p.lines.some((l) => l.variantId === i.variantId)) return toast.info("Esse artigo já está na compra.");
    set({ lines: [...p.lines, { variantId: i.variantId, qty: 1, unitCostForeign: i.cost && !foreign ? Math.round(i.cost) : 0 }] });
  };
  const setLine = (idx: number, patch: Partial<PurchaseState["lines"][number]>) => set({ lines: p.lines.map((l, j) => (j === idx ? { ...l, ...patch } : l)) });

  const save = () =>
    run(() => savePurchaseAction(p.id ?? null, { ...p, supplierId: p.supplierId || null, rate, invoiceRef: p.invoiceRef || undefined, note: p.note || undefined }), {
      onSuccess: (r) => router.push(`/compras/${(r as { id: string }).id}`),
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader title="Artigos" description={foreign ? `Custo unitário em ${p.currency}. Convertido a ${formatNumber(rate, 2)} Kz.` : "Custo unitário pago ao fornecedor."} />
          <CardBody className="flex flex-col gap-4">
            <VariantPicker items={items} onPick={add} exclude={new Set(p.lines.map((l) => l.variantId))} />
            {p.lines.length === 0 ? (
              <EmptyState icon={<PackagePlus />} title="Sem artigos" description="Procure os artigos que comprou. Se for um produto novo, crie-o primeiro em Produtos." className="py-8" />
            ) : (
              <ul className="divide-y divide-line/70">
                {p.lines.map((l, idx) => {
                  const i = byId.get(l.variantId);
                  const landed = calc.landed[idx];
                  const margin = i && i.price ? ((i.price - landed) / i.price) * 100 : 0;
                  return (
                    <li key={l.variantId} className="py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-ink">
                            {i?.name}
                            {i?.label && <span className="font-normal text-ink-soft"> — {i.label}</span>}
                          </div>
                          <div className="text-[13px] text-muted">
                            {i?.sku} · vende a {formatKz(i?.price)}
                          </div>
                        </div>
                        <button onClick={() => set({ lines: p.lines.filter((_, j) => j !== idx) })} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remover">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-end gap-3">
                        <Field label="Quantidade">
                          <Stepper value={l.qty} min={1} onChange={(v) => setLine(idx, { qty: v })} />
                        </Field>
                        <Field label={`Custo unitário (${p.currency})`} className="w-44">
                          <MoneyInput allowDecimals={foreign} suffix={foreign ? p.currency : "Kz"} value={l.unitCostForeign} onChange={(v) => setLine(idx, { unitCostForeign: v })} />
                        </Field>
                        <div className="ml-auto text-right text-sm">
                          <div className="text-muted">Custo de chegada</div>
                          <div className="font-semibold text-ink tabular">{formatKz(landed)}/un.</div>
                          {l.unitCostForeign > 0 && i?.price ? <div className={cn("text-xs", margin < 20 ? "text-danger" : "text-success")}>Margem {formatPct(margin, 0)}</div> : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Custos extra" description="Transporte, alfândega, despachante… São repartidos pelos artigos para dar o custo real de cada um." />
          <CardBody className="flex flex-col gap-3">
            {p.extraCosts.map((c, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[160px_1fr_160px_auto]">
                <Select value={c.kind} onChange={(e) => set({ extraCosts: p.extraCosts.map((x, j) => (j === idx ? { ...x, kind: e.target.value as ExtraCostKind } : x)) })}>
                  {Object.entries(EXTRA_COST_KINDS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
                <button onClick={() => set({ extraCosts: p.extraCosts.filter((_, j) => j !== idx) })} className="grid size-11 place-items-center rounded-xl text-muted hover:bg-danger-soft hover:text-danger sm:order-last" aria-label="Remover">
                  <Trash2 className="size-4" />
                </button>
                <Input className="col-span-2 sm:col-span-1" placeholder="Descrição (opcional)" value={c.description ?? ""} onChange={(e) => set({ extraCosts: p.extraCosts.map((x, j) => (j === idx ? { ...x, description: e.target.value } : x)) })} />
                <div className="col-span-2 sm:col-span-1">
                  <MoneyInput value={c.amount} onChange={(v) => set({ extraCosts: p.extraCosts.map((x, j) => (j === idx ? { ...x, amount: v } : x)) })} />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="soft" size="sm" onClick={() => set({ extraCosts: [...p.extraCosts, { kind: p.extraCosts.length ? "alfandega" : "transporte", amount: 0 }] })}>
                <Plus /> Adicionar custo
              </Button>
              <div className="flex items-center gap-2 text-sm text-muted">
                Repartir por
                <Segmented
                  value={p.allocation}
                  onChange={(v) => set({ allocation: v })}
                  options={[
                    { value: "valor", label: "Valor" },
                    { value: "quantidade", label: "Quantidade" },
                  ]}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="order-first flex flex-col gap-4 lg:order-none">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <Field label="Fornecedor">
              <Select value={p.supplierId} onChange={(e) => set({ supplierId: e.target.value })}>
                <option value="">Sem fornecedor</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Entra na loja">
              <Select value={p.storeId} onChange={(e) => set({ storeId: e.target.value })}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Moeda">
                <Select value={p.currency} onChange={(e) => set({ currency: e.target.value as Currency, rate: e.target.value === "AOA" ? 1 : p.rate === 1 ? 0 : p.rate })}>
                  {Object.keys(CURRENCIES).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              {foreign && (
                <Field label={`1 ${p.currency} =`}>
                  <MoneyInput allowDecimals value={p.rate} onChange={(v) => set({ rate: v })} />
                </Field>
              )}
            </div>
            <Field label="Nº da fatura do fornecedor">
              <Input value={p.invoiceRef ?? ""} onChange={(e) => set({ invoiceRef: e.target.value })} />
            </Field>
            <Field label="Observações">
              <Textarea value={p.note ?? ""} onChange={(e) => set({ note: e.target.value })} className="min-h-16" />
            </Field>
            <dl className="flex flex-col gap-1.5 rounded-2xl bg-sand p-4 text-sm">
              <div className="flex justify-between text-ink-soft">
                <dt>Mercadoria</dt>
                <dd className="tabular">{formatKz(calc.goodsTotal)}</dd>
              </div>
              <div className="flex justify-between text-ink-soft">
                <dt>Custos extra</dt>
                <dd className="tabular">{formatKz(extraTotal)}</dd>
              </div>
              <div className="mt-1 flex justify-between text-base font-semibold text-ink">
                <dt>Total</dt>
                <dd className="tabular">{formatKz(calc.total)}</dd>
              </div>
            </dl>
            <Button size="lg" className="hidden lg:inline-flex" loading={pending} onClick={save} disabled={!p.lines.length || (foreign && !p.rate)}>
              Guardar compra
            </Button>
            <p className="text-[13px] leading-snug text-muted">Fica como rascunho. O stock só entra quando carregar em «Dar entrada», depois de a mercadoria chegar.</p>
          </CardBody>
        </Card>
      </div>
      <StickyActions>
        <Button size="lg" loading={pending} onClick={save} disabled={!p.lines.length || (foreign && !p.rate)}>
          Guardar compra · {formatKz(calc.total)}
        </Button>
      </StickyActions>
    </div>
  );
}
