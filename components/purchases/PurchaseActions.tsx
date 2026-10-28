"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, PackageCheck, Pencil, Wallet } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { cancelPurchaseAction, payPurchaseAction, receivePurchaseAction } from "@/app/actions/app";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { formatKz } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/confirm";

export function PurchaseActions({ id, owed, canEdit, canReceive, canPay, canCancel, accounts }: { id: string; owed: number; canEdit: boolean; canReceive: boolean; canPay: boolean; canCancel: boolean; accounts: { id: string; name: string; type: string }[] }) {
  const { pending, run } = useAction();
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(owed);
  const [accountId, setAccountId] = React.useState(accounts.find((a) => a.type === "banco")?.id ?? accounts[0]?.id ?? "");
  const [method, setMethod] = React.useState<PaymentMethod>("transferencia");
  const [note, setNote] = React.useState("");
  return (
    <>
      {canEdit && (
        <Button asChild variant="outline">
          <Link href={`/compras/${id}/editar`}>
            <Pencil /> Editar
          </Link>
        </Button>
      )}
      {canCancel && (
        <Button
          variant="ghost"
          onClick={async () => {
            if ((await confirmAction({ title: "Cancelar esta compra?", confirm: "Cancelar compra", danger: true })) !== false) run(() => cancelPurchaseAction(id));
          }}
        >
          <Ban /> Cancelar
        </Button>
      )}
      {canPay && (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Wallet /> Registar pagamento
        </Button>
      )}
      {canReceive && (
        <Button
          loading={pending}
          onClick={async () => {
            if ((await confirmAction({ title: "Dar entrada da mercadoria?", description: "As quantidades entram no stock da loja e o custo médio de cada artigo é atualizado.", confirm: "Dar entrada" })) !== false)
              run(() => receivePurchaseAction(id));
          }}
        >
          <PackageCheck /> Dar entrada
        </Button>
      )}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Pagamento ao fornecedor"
        description={`Falta pagar ${formatKz(owed)}. Fica registado como saída de dinheiro (compra de mercadoria).`}
        size="sm"
        footer={
          <Button loading={pending} disabled={!amount || !accountId} onClick={() => run(() => payPurchaseAction(id, { amount, accountId, method, note: note || undefined }), { onSuccess: () => setOpen(false) })}>
            Registar {formatKz(amount)}
          </Button>
        }
      >
        <div className="grid gap-4">
          <Field label="Valor">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Sai da conta">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Método">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nota (opcional)">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex.: 2ª prestação" />
          </Field>
        </div>
      </Sheet>
    </>
  );
}
