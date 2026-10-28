"use client";

import * as React from "react";
import { Printer, RotateCcw, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Select, Stepper, Textarea } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/confirm";
import { useAction } from "@/lib/use-action";
import { returnSaleAction, voidSaleAction } from "@/app/actions/app";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { formatKz } from "@/lib/format";

type Sale = { id: string; number: string; status: string; total: number; refunded: number; phone?: string; lines: { variantId: string; name: string; qty: number; returnedQty: number; lineTotal: number }[] };

export function SaleActions({ sale, canVoid, canReturn }: { sale: Sale; canVoid: boolean; canReturn: boolean }) {
  const { pending, run } = useAction();
  const [open, setOpen] = React.useState(false);
  const [qty, setQty] = React.useState<Record<string, number>>({});
  const [method, setMethod] = React.useState<PaymentMethod>("dinheiro");
  const [reason, setReason] = React.useState("");
  const active = sale.status === "concluida";
  const returnable = sale.lines.filter((l) => l.qty - l.returnedQty > 0);
  const amount = returnable.reduce((s, l) => s + Math.round((l.lineTotal / l.qty) * (qty[l.variantId] ?? 0)), 0);

  return (
    <>
      <Button variant="outline" onClick={() => window.open(`/recibo/${sale.id}`, "_blank")}>
        <Printer /> Talão
      </Button>
      {active && canReturn && returnable.length > 0 && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <RotateCcw /> Devolução
        </Button>
      )}
      {active && canVoid && sale.refunded === 0 && (
        <Button
          variant="danger-soft"
          loading={pending}
          onClick={async () => {
            const why = await confirmAction({
              title: `Anular a venda ${sale.number}?`,
              description: `O stock volta à loja e é registada a saída de ${formatKz(sale.total)}. Fica registado quem anulou.`,
              confirm: "Anular venda",
              danger: true,
              reason: "Motivo da anulação",
            });
            if (why) run(() => voidSaleAction(sale.id, why));
          }}
        >
          <Ban /> Anular
        </Button>
      )}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Devolução"
        description="Escolha o que o cliente devolveu. O stock volta à loja e o valor sai da conta escolhida."
        footer={
          <Button
            size="lg"
            loading={pending}
            disabled={!amount || reason.trim().length < 3}
            onClick={() =>
              run(
                () =>
                  returnSaleAction({
                    saleId: sale.id,
                    lines: Object.entries(qty)
                      .filter(([, q]) => q > 0)
                      .map(([variantId, q]) => ({ variantId, qty: q })),
                    method,
                    reason,
                  }),
                {
                  onSuccess: () => {
                    setOpen(false);
                    setQty({});
                    setReason("");
                  },
                },
              )
            }
          >
            Devolver {formatKz(amount)}
          </Button>
        }
      >
        <ul className="flex flex-col divide-y divide-line/70">
          {returnable.map((l) => (
            <li key={l.variantId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="font-medium text-ink">{l.name}</div>
                <div className="text-[13px] text-muted">
                  Pode devolver até {l.qty - l.returnedQty} · {formatKz(l.lineTotal / l.qty)}/un.
                </div>
              </div>
              <Stepper size="sm" value={qty[l.variantId] ?? 0} min={0} max={l.qty - l.returnedQty} onChange={(v) => setQty((q) => ({ ...q, [l.variantId]: v }))} />
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-4">
          <Field label="Como devolve o dinheiro">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Motivo">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ex.: tamanho errado, defeito na lace" className="min-h-20" />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
