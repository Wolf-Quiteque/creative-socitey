"use client";

import * as React from "react";
import { Camera, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "@/lib/use-action";
import { createEntryAction, voidEntryAction } from "@/app/actions/app";
import { CATEGORY_KIND_HINTS, type CategoryKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/confirm";

type Cat = { id: string; name: string; type: string; kind: CategoryKind };
type Acc = { id: string; name: string; type: string; storeId: string | null };

export function EntryButtons({ canIn, canOut, accounts, categories, defaultStoreId, today }: { canIn: boolean; canOut: boolean; accounts: Acc[]; categories: Cat[]; defaultStoreId?: string; today: string }) {
  const [open, setOpen] = React.useState<null | "entrada" | "saida">(null);
  if (!canIn && !canOut) return null;
  return (
    <>
      {canIn && (
        <Button variant="outline" onClick={() => setOpen("entrada")}>
          <Plus /> Entrada
        </Button>
      )}
      {canOut && (
        <Button onClick={() => setOpen("saida")}>
          <Minus /> Registar despesa
        </Button>
      )}
      {open && <EntrySheet type={open} onClose={() => setOpen(null)} accounts={accounts} categories={categories.filter((c) => c.type === open)} defaultStoreId={defaultStoreId} today={today} />}
    </>
  );
}

function EntrySheet({ type, onClose, accounts, categories, defaultStoreId, today }: { type: "entrada" | "saida"; onClose: () => void; accounts: Acc[]; categories: Cat[]; defaultStoreId?: string; today: string }) {
  const { pending, run } = useAction();
  const storeCash = accounts.find((a) => a.type === "caixa" && a.storeId === defaultStoreId);
  const [amount, setAmount] = React.useState(0);
  const [categoryId, setCategoryId] = React.useState(categories.find((c) => c.kind === (type === "saida" ? "despesa" : "receita"))?.id ?? categories[0]?.id ?? "");
  const [accountId, setAccountId] = React.useState(storeCash?.id ?? accounts[0]?.id ?? "");
  const [description, setDescription] = React.useState("");
  const [day, setDay] = React.useState(today);
  const [attachmentId, setAttachmentId] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const cat = categories.find((c) => c.id === categoryId);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/imagens?tipo=recibo", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setAttachmentId(j.id);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={type === "saida" ? "Registar despesa" : "Registar entrada"}
      description={type === "saida" ? "Dinheiro que sai: água, cadeiras, renda, salários, compras avulsas…" : "Dinheiro que entra fora das vendas: serviços, capital do dono…"}
      footer={
        <Button
          size="lg"
          loading={pending}
          disabled={!amount || !categoryId || !accountId || description.trim().length < 2}
          onClick={() => run(() => createEntryAction({ type, amount, categoryId, accountId, description, day, attachmentId }), { onSuccess: onClose })}
        >
          Registar
        </Button>
      }
    >
      <div className="grid gap-4">
        <Field label="Valor">
          <MoneyInput value={amount} onChange={setAmount} className="h-13 text-lg font-semibold" />
        </Field>
        <Field label="Descrição">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === "saida" ? "ex.: 2 garrafões de água" : "ex.: instalação de peruca"} />
        </Field>
        <Field label="Categoria" hint={cat ? CATEGORY_KIND_HINTS[cat.kind] : undefined}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={type === "saida" ? "Sai de" : "Entra em"}>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Data">
            <Input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
          </Field>
        </div>
        {type === "saida" && (
          <div className="flex items-center gap-3">
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-4 text-sm font-medium text-ink-soft hover:bg-sand">
              <Camera className="size-4" /> {uploading ? "A enviar…" : attachmentId ? "Foto do recibo adicionada" : "Foto do recibo (opcional)"}
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </label>
            {attachmentId && (
              <button className="grid size-9 place-items-center rounded-full text-muted hover:bg-sand" onClick={() => setAttachmentId(null)} aria-label="Remover foto">
                <X className="size-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

export function VoidEntryButton({ id }: { id: string }) {
  const { pending, run } = useAction();
  return (
    <button
      disabled={pending}
      className="text-xs font-medium text-muted hover:text-danger"
      onClick={async () => {
        const why = await confirmAction({ title: "Anular este movimento?", description: "Fica no histórico riscado, com o motivo e quem anulou.", confirm: "Anular", danger: true, reason: "Motivo" });
        if (why) run(() => voidEntryAction(id, why));
      }}
    >
      Anular
    </button>
  );
}
