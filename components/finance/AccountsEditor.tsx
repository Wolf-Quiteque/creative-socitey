"use client";

import * as React from "react";
import { ArrowLeftRight, Banknote, Landmark, Pencil, Plus, Wallet } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { saveAccountAction, transferAccountsAction } from "@/app/actions/app";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/types";
import { formatKz } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, Input, MoneyInput, Select, Toggle } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";

type Acc = { id: string; name: string; type: AccountType; storeId: string | null; storeName: string | null; openingBalance: number; active: boolean; balance: number };
type Edit = { id: string | null; name: string; type: AccountType; storeId: string; openingBalance: number; active: boolean };

export function AccountsEditor({ accounts, stores, canManage, canGeneral }: { accounts: Acc[]; stores: { id: string; name: string }[]; canManage: boolean; canGeneral: boolean }) {
  const { pending, run } = useAction();
  const [edit, setEdit] = React.useState<Edit | null>(null);
  const [move, setMove] = React.useState<null | { fromId: string; toId: string; amount: number; description: string }>(null);
  const active = accounts.filter((a) => a.active);
  const Icon = ({ t }: { t: AccountType }) => (t === "caixa" ? <Banknote className="size-5" /> : t === "banco" ? <Landmark className="size-5" /> : <Wallet className="size-5" />);
  return (
    <>
      {canManage && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button onClick={() => setMove({ fromId: active.find((a) => a.type === "caixa")?.id ?? "", toId: active.find((a) => a.type === "banco")?.id ?? "", amount: 0, description: "" })}>
            <ArrowLeftRight /> Mover dinheiro
          </Button>
          <Button variant="outline" onClick={() => setEdit({ id: null, name: "", type: "banco", storeId: canGeneral ? "" : (stores[0]?.id ?? ""), openingBalance: 0, active: true })}>
            <Plus /> Nova conta
          </Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((a) => (
          <Card key={a.id} className={a.active ? "p-5" : "p-5 opacity-60"}>
            <div className="flex items-start justify-between gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Icon t={a.type} />
              </span>
              {canManage && (
                <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEdit({ id: a.id, name: a.name, type: a.type, storeId: a.storeId ?? "", openingBalance: a.openingBalance, active: a.active })}>
                  <Pencil />
                </Button>
              )}
            </div>
            <div className="mt-3 font-medium text-ink">{a.name}</div>
            <div className="text-[13px] text-muted">
              {ACCOUNT_TYPES[a.type]} · {a.storeName ?? "Geral"}
            </div>
            <div className={`mt-3 text-2xl font-semibold ${a.balance < 0 ? "text-danger" : "text-ink"}`}>{formatKz(a.balance)}</div>
            {!a.active && <Badge className="mt-2">Inativa</Badge>}
          </Card>
        ))}
      </div>

      <Sheet
        open={!!move}
        onOpenChange={(o) => !o && setMove(null)}
        title="Mover dinheiro entre contas"
        description="ex.: depositar a caixa da loja no banco. Não conta como entrada nem saída."
        size="sm"
        footer={
          <Button loading={pending} disabled={!move?.amount || !move.fromId || !move.toId || move.fromId === move.toId} onClick={() => move && run(() => transferAccountsAction({ ...move, description: move.description || undefined }), { onSuccess: () => setMove(null) })}>
            Mover {formatKz(move?.amount ?? 0)}
          </Button>
        }
      >
        {move && (
          <div className="grid gap-4">
            <Field label="De">
              <Select value={move.fromId} onChange={(e) => setMove({ ...move, fromId: e.target.value })}>
                {active.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatKz(a.balance)})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Para">
              <Select value={move.toId} onChange={(e) => setMove({ ...move, toId: e.target.value })}>
                {active.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valor">
              <MoneyInput value={move.amount} onChange={(v) => setMove({ ...move, amount: v })} />
            </Field>
            <Field label="Descrição (opcional)">
              <Input value={move.description} onChange={(e) => setMove({ ...move, description: e.target.value })} placeholder="ex.: depósito no BAI" />
            </Field>
          </div>
        )}
      </Sheet>

      <Sheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? "Editar conta" : "Nova conta"}
        size="sm"
        footer={
          <Button loading={pending} disabled={!edit?.name.trim()} onClick={() => edit && run(() => saveAccountAction(edit.id, { ...edit, storeId: edit.storeId || null }), { onSuccess: () => setEdit(null) })}>
            Guardar
          </Button>
        }
      >
        {edit && (
          <div className="grid gap-4">
            <Field label="Nome">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="ex.: BAI — conta da empresa" />
            </Field>
            <Field label="Tipo">
              <Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as AccountType })}>
                {Object.entries(ACCOUNT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Loja">
              <Select value={edit.storeId} onChange={(e) => setEdit({ ...edit, storeId: e.target.value })}>
                {canGeneral && <option value="">Geral (da empresa)</option>}
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Saldo inicial" hint="O dinheiro que já lá estava antes de começar a usar o sistema.">
              <MoneyInput value={edit.openingBalance} onChange={(v) => setEdit({ ...edit, openingBalance: v })} />
            </Field>
            <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Ativa" />
          </div>
        )}
      </Sheet>
    </>
  );
}
