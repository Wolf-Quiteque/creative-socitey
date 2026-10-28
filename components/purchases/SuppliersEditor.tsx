"use client";

import * as React from "react";
import { Pencil, Plus, Truck } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { saveSupplierAction } from "@/app/actions/app";
import { formatKz } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Field, Input, Textarea, Toggle } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";

type Supplier = { id: string; name: string; contact?: string; phone?: string; country?: string; notes?: string; active: boolean; total: number; owed: number; count: number };
type Edit = { id: string | null; name: string; contact?: string; phone?: string; country?: string; notes?: string; active: boolean };

export function SuppliersEditor({ suppliers, canEdit }: { suppliers: Supplier[]; canEdit: boolean }) {
  const { pending, run } = useAction();
  const [edit, setEdit] = React.useState<Edit | null>(null);
  return (
    <>
      {canEdit && (
        <Button className="mb-4" onClick={() => setEdit({ id: null, name: "", active: true })}>
          <Plus /> Novo fornecedor
        </Button>
      )}
      <Card>
        {suppliers.length === 0 ? (
          <EmptyState icon={<Truck />} title="Sem fornecedores" description="Registe de quem compra cabelo e cosméticos." />
        ) : (
          <ul className="divide-y divide-line/70">
            {suppliers.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3.5 md:px-6">
                <div className="min-w-0">
                  <div className="font-medium text-ink">
                    {s.name} {!s.active && <Badge className="ml-1">Inativo</Badge>}
                  </div>
                  <div className="text-[13px] text-muted">{[s.country, s.contact, s.phone].filter(Boolean).join(" · ") || "—"}</div>
                  <div className="text-[13px] text-muted">
                    {s.count} compra(s) · {formatKz(s.total)}
                    {s.owed > 0 && <span className="font-medium text-danger"> · falta pagar {formatKz(s.owed)}</span>}
                  </div>
                </div>
                {canEdit && (
                  <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEdit({ ...s })}>
                    <Pencil />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Sheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? "Editar fornecedor" : "Novo fornecedor"}
        footer={
          <Button
            loading={pending}
            disabled={!edit?.name.trim()}
            onClick={() => edit && run(() => saveSupplierAction(edit.id, { name: edit.name, contact: edit.contact, phone: edit.phone, country: edit.country, notes: edit.notes, active: edit.active }), { onSuccess: () => setEdit(null) })}
          >
            Guardar
          </Button>
        }
      >
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Pessoa de contacto">
              <Input value={edit.contact ?? ""} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} inputMode="tel" />
            </Field>
            <Field label="País">
              <Input value={edit.country ?? ""} onChange={(e) => setEdit({ ...edit, country: e.target.value })} />
            </Field>
            <Field label="Notas" className="sm:col-span-2">
              <Textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} className="min-h-20" />
            </Field>
            <div className="sm:col-span-2">
              <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Ativo" />
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
