"use client";

import * as React from "react";
import { PackageCheck, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Stepper, Input, Textarea } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/confirm";
import { useAction } from "@/lib/use-action";
import { cancelTransferAction, receiveTransferAction } from "@/app/actions/app";

type Doc = { id: string; status: string; type: string; lines: { variantId: string; name: string; sku: string; qty: number }[] };

export function DocActions({ doc, canReceive, canCancel }: { doc: Doc; canReceive: boolean; canCancel: boolean }) {
  const { pending, run } = useAction();
  const [open, setOpen] = React.useState(false);
  const [got, setGot] = React.useState<Record<string, number>>(() => Object.fromEntries(doc.lines.map((l) => [l.variantId, l.qty])));
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [note, setNote] = React.useState("");
  const missing = doc.lines.reduce((s, l) => s + (l.qty - (got[l.variantId] ?? 0)), 0);
  return (
    <>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer /> Imprimir
      </Button>
      {canCancel && (
        <Button
          variant="danger-soft"
          loading={pending}
          onClick={async () => {
            if ((await confirmAction({ title: "Cancelar a transferência?", description: "A mercadoria volta ao stock da loja de origem.", confirm: "Cancelar transferência", danger: true })) !== false)
              run(() => cancelTransferAction(doc.id));
          }}
        >
          <X /> Cancelar
        </Button>
      )}
      {canReceive && (
        <Button onClick={() => setOpen(true)}>
          <PackageCheck /> Receber
        </Button>
      )}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Receber transferência"
        description="Confirme quantas unidades chegaram de cada artigo. O que faltar fica registado como perda em trânsito."
        size="lg"
        footer={
          <Button
            size="lg"
            loading={pending}
            onClick={() =>
              run(() => receiveTransferAction({ docId: doc.id, lines: doc.lines.map((l) => ({ variantId: l.variantId, qtyReceived: got[l.variantId] ?? 0, note: notes[l.variantId] || undefined })), note: note || undefined }), {
                onSuccess: () => setOpen(false),
              })
            }
          >
            {missing > 0 ? `Confirmar (faltam ${missing})` : "Chegou tudo — confirmar"}
          </Button>
        }
      >
        <ul className="divide-y divide-line/70">
          {doc.lines.map((l) => (
            <li key={l.variantId} className="flex flex-col gap-2 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{l.name}</div>
                  <div className="text-[13px] text-muted">
                    {l.sku} · enviados {l.qty}
                  </div>
                </div>
                <Stepper size="sm" value={got[l.variantId] ?? 0} min={0} max={l.qty} onChange={(v) => setGot((g) => ({ ...g, [l.variantId]: v }))} />
              </div>
              {(got[l.variantId] ?? 0) < l.qty && <Input placeholder="O que aconteceu? (ex.: chegou danificado)" value={notes[l.variantId] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [l.variantId]: e.target.value }))} />}
            </li>
          ))}
        </ul>
        <Field label="Observações" className="mt-3">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </Field>
      </Sheet>
    </>
  );
}
