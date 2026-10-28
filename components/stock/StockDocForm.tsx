"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, PackageOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "@/lib/use-action";
import { createAdjustmentAction, createSaidaAction, sendTransferAction } from "@/app/actions/app";
import { SAIDA_REASONS, type SaidaReason } from "@/lib/types";
import { cn, formatKz, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody, EmptyState } from "@/components/ui/card";
import { Field, MoneyInput, NumberInput, Select, Stepper, Textarea } from "@/components/ui/field";
import { VariantPicker, type CatalogItem } from "./VariantPicker";
import { StickyActions } from "@/components/ui/sticky-actions";

type Mode = "transferencia" | "saida" | "ajuste";
type Line = { variantId: string; qty: number; note?: string };

export function StockDocForm({
  mode,
  items,
  stores,
  destinations,
  stock,
  defaultStoreId,
  accounts,
}: {
  mode: Mode;
  items: CatalogItem[];
  stores: { id: string; name: string }[];
  destinations?: { id: string; name: string }[];
  stock: Record<string, Record<string, number>>;
  defaultStoreId: string;
  accounts?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [storeId, setStoreId] = React.useState(defaultStoreId);
  const [toStoreId, setToStoreId] = React.useState(() => destinations?.find((s) => s.id !== defaultStoreId)?.id ?? "");
  const [reason, setReason] = React.useState<SaidaReason>("quebra");
  const [lines, setLines] = React.useState<Line[]>([]);
  const [note, setNote] = React.useState("");
  const [transportCost, setTransportCost] = React.useState(0);
  const [accountId, setAccountId] = React.useState("");
  const byId = React.useMemo(() => new Map(items.map((i) => [i.variantId, i])), [items]);
  const here = stock[storeId] ?? {};

  const add = (i: CatalogItem) => {
    if (lines.some((l) => l.variantId === i.variantId)) return toast.info("Esse artigo já está na lista.");
    setLines((ls) => [...ls, { variantId: i.variantId, qty: mode === "ajuste" ? Math.max(0, here[i.variantId] ?? 0) : 1 }]);
  };
  const addAllInStock = () => {
    const ids = Object.entries(here)
      .filter(([id, q]) => q !== 0 && byId.has(id) && !lines.some((l) => l.variantId === id))
      .map(([id, q]) => ({ variantId: id, qty: Math.max(0, q) }));
    setLines((ls) => [...ls, ...ids]);
  };

  const over = mode !== "ajuste" ? lines.filter((l) => l.qty > (here[l.variantId] ?? 0)) : [];
  const value = lines.reduce((s, l) => s + (byId.get(l.variantId)?.cost ?? 0) * l.qty, 0);
  const showValue = items.some((i) => i.cost !== undefined);

  const submit = () => {
    if (!lines.length) return toast.error("Adicione pelo menos um artigo.");
    const done = (r: { id?: string }) => router.push(r.id ? `/stock/documentos/${r.id}` : "/stock");
    if (mode === "transferencia")
      run(() => sendTransferAction({ fromStoreId: storeId, toStoreId, lines, transportCost, transportAccountId: transportCost > 0 ? accountId : null, note: note || undefined }), { onSuccess: done });
    else if (mode === "saida") run(() => createSaidaAction({ storeId, reason, lines, note: note || undefined }), { onSuccess: done });
    else run(() => createAdjustmentAction({ storeId, lines: lines.map((l) => ({ variantId: l.variantId, counted: l.qty })), note: note || undefined }), { onSuccess: done });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <VariantPicker items={items} stock={here} onPick={add} exclude={new Set(lines.map((l) => l.variantId))} />
            </div>
            {mode === "ajuste" && (
              <Button variant="secondary" onClick={addAllInStock}>
                Contar tudo o que há na loja
              </Button>
            )}
          </div>
          {lines.length === 0 ? (
            <EmptyState
              icon={<PackageOpen />}
              title="Sem artigos"
              description={mode === "ajuste" ? "Procure os artigos que contou, ou carregue todos os que a loja tem em stock." : "Procure os artigos acima. Pode usar o leitor de código de barras."}
              className="py-10"
            />
          ) : (
            <ul className="divide-y divide-line/70">
              {lines.map((l, idx) => {
                const i = byId.get(l.variantId)!;
                const system = here[l.variantId] ?? 0;
                const diff = l.qty - system;
                return (
                  <li key={l.variantId} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <div className="font-medium text-ink">
                        {i.name}
                        {i.label && <span className="font-normal text-ink-soft"> — {i.label}</span>}
                      </div>
                      <div className="text-[13px] text-muted">
                        {i.sku} · {mode === "ajuste" ? "sistema diz" : "disponível"} {formatNumber(system)}
                        {mode === "ajuste" && diff !== 0 && (
                          <span className={cn("ml-1 font-medium", diff < 0 ? "text-danger" : "text-success")}>
                            ({diff > 0 ? "+" : ""}
                            {diff})
                          </span>
                        )}
                      </div>
                    </div>
                    {mode === "ajuste" ? (
                      <div className="w-28">
                        <NumberInput aria-label="Contado" value={l.qty} min={0} onChange={(v) => setLines((ls) => ls.map((x, j) => (j === idx ? { ...x, qty: v } : x)))} />
                      </div>
                    ) : (
                      <Stepper value={l.qty} min={1} max={100000} onChange={(v) => setLines((ls) => ls.map((x, j) => (j === idx ? { ...x, qty: v } : x)))} />
                    )}
                    <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== idx))} className="grid size-10 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" aria-label="Remover">
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="order-first flex flex-col gap-4 lg:order-none">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <Field label={mode === "transferencia" ? "Sai da loja" : "Loja"}>
              <Select
                value={storeId}
                onChange={(e) => {
                  setStoreId(e.target.value);
                  if (e.target.value === toStoreId) setToStoreId(destinations?.find((s) => s.id !== e.target.value)?.id ?? "");
                }}
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            {mode === "transferencia" && (
              <>
                <div className="-my-1 flex justify-center text-muted">
                  <ArrowRight className="size-5 rotate-90" />
                </div>
                <Field label="Vai para a loja">
                  <Select value={toStoreId} onChange={(e) => setToStoreId(e.target.value)}>
                    {destinations?.filter((s) => s.id !== storeId).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                {accounts && (
                  <>
                    <Field label="Custo do transporte (opcional)" hint="Fica registado como despesa de transporte entre lojas.">
                      <MoneyInput value={transportCost} onChange={setTransportCost} />
                    </Field>
                    {transportCost > 0 && (
                      <Field label="Pago a partir de">
                        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                          <option value="">Não registar pagamento</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}
                  </>
                )}
              </>
            )}
            {mode === "saida" && (
              <Field label="Motivo">
                <Select value={reason} onChange={(e) => setReason(e.target.value as SaidaReason)}>
                  {Object.entries(SAIDA_REASONS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field label="Observações">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" placeholder={mode === "transferencia" ? "ex.: entregue pelo Paulo" : mode === "saida" ? "ex.: caiu da prateleira" : "ex.: contagem de fim de mês"} />
            </Field>
            {over.length > 0 && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">Há {over.length} artigo(s) com mais unidades do que existem nesta loja.</p>}
            <div className="flex justify-between text-sm text-ink-soft">
              <span>{lines.reduce((s, l) => s + l.qty, 0)} unidade(s)</span>
              {showValue && mode !== "ajuste" && <span>Valor ao custo {formatKz(value)}</span>}
            </div>
            <Button size="lg" className="hidden lg:inline-flex" loading={pending} onClick={submit} disabled={!lines.length || (mode === "transferencia" && !toStoreId)}>
              {mode === "transferencia" ? "Enviar transferência" : mode === "saida" ? "Registar nota de saída" : "Guardar contagem"}
            </Button>
          </CardBody>
        </Card>
      </div>
      <StickyActions>
        <Button size="lg" loading={pending} onClick={submit} disabled={!lines.length || (mode === "transferencia" && !toStoreId)}>
          {mode === "transferencia" ? `Enviar (${lines.reduce((s, l) => s + l.qty, 0)} un.)` : mode === "saida" ? "Registar nota de saída" : "Guardar contagem"}
        </Button>
      </StickyActions>
    </div>
  );
}
