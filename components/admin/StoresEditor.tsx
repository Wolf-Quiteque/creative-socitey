"use client";

import * as React from "react";
import { MapPin, Pencil, Phone, Plus, Store, Users } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { saveStoreAction } from "@/app/actions/app";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Field, Input, Select, Textarea, Toggle } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";

type S = { id: string | null; name: string; code: string; address: string; city: string; phone: string; receiptFooter: string; allowNegativeStock: boolean; requireOpenTill: boolean; bankAccountId: string; active: boolean };

export function StoresEditor({ stores, banks, canCreate }: { stores: (S & { id: string; staff: number })[]; banks: { id: string; name: string }[]; canCreate: boolean }) {
  const { pending, run } = useAction();
  const [edit, setEdit] = React.useState<S | null>(null);
  const blank: S = { id: null, name: "", code: "", address: "", city: "", phone: "", receiptFooter: "", allowNegativeStock: false, requireOpenTill: true, bankAccountId: banks[0]?.id ?? "", active: true };
  return (
    <>
      {canCreate && (
        <Button className="mb-4" onClick={() => setEdit(blank)}>
          <Plus /> Abrir loja nova
        </Button>
      )}
      {stores.length === 0 ? (
        <Card>
          <EmptyState icon={<Store />} title="Ainda não há lojas" description="Abra a primeira loja para começar a vender e a controlar stock." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <Card key={s.id} className={s.active ? "p-5" : "p-5 opacity-60"}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft font-display text-sm font-semibold text-primary">{s.code}</span>
                <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEdit(s)}>
                  <Pencil />
                </Button>
              </div>
              <div className="mt-3 font-display text-lg font-semibold text-ink">{s.name}</div>
              <div className="mt-2 flex flex-col gap-1 text-sm text-muted">
                {(s.address || s.city) && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" /> {[s.address, s.city].filter(Boolean).join(", ")}
                  </span>
                )}
                {s.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="size-3.5" /> {s.phone}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" /> {s.staff} pessoa(s)
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.requireOpenTill && <Badge tone="info">Exige caixa aberta</Badge>}
                {s.allowNegativeStock && <Badge tone="warning">Vende sem stock</Badge>}
                {!s.active && <Badge>Fechada</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <Sheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? `Editar ${edit.name}` : "Abrir loja nova"}
        description={edit?.id ? undefined : "É criada também a caixa (dinheiro) desta loja."}
        size="lg"
        footer={
          <Button loading={pending} disabled={!edit?.name.trim() || !edit?.code.trim()} onClick={() => edit && run(() => saveStoreAction(edit.id, { ...edit, bankAccountId: edit.bankAccountId || null }), { onSuccess: () => setEdit(null) })}>
            Guardar
          </Button>
        }
      >
        {edit && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="ex.: Loja Talatona" />
            </Field>
            <Field label="Código (2 a 5 letras)" hint="Aparece no número das vendas: TAL-26-00042">
              <Input value={edit.code} maxLength={5} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
            </Field>
            <Field label="Morada">
              <Input value={edit.address} onChange={(e) => setEdit({ ...edit, address: e.target.value })} />
            </Field>
            <Field label="Cidade / bairro">
              <Input value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} />
            </Field>
            <Field label="Telefone">
              <Input value={edit.phone} inputMode="tel" onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </Field>
            <Field label="Conta para TPA e transferências" hint="Onde entram os pagamentos que não são em dinheiro.">
              <Select value={edit.bankAccountId} onChange={(e) => setEdit({ ...edit, bankAccountId: e.target.value })}>
                <option value="">A própria caixa da loja</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Rodapé do talão" className="sm:col-span-2">
              <Textarea value={edit.receiptFooter} onChange={(e) => setEdit({ ...edit, receiptFooter: e.target.value })} className="min-h-16" placeholder="ex.: Trocas em 7 dias com talão." />
            </Field>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <Toggle checked={edit.requireOpenTill} onChange={(v) => setEdit({ ...edit, requireOpenTill: v })} label="Exigir caixa aberta para vender" description="Obriga a declarar o fundo de caixa no início e a contar o dinheiro no fim." />
              <Toggle checked={edit.allowNegativeStock} onChange={(v) => setEdit({ ...edit, allowNegativeStock: v })} label="Permitir vender sem stock no sistema" description="Útil se a mercadoria ainda não foi registada. O stock fica negativo até corrigir." />
              {edit.id && <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Loja aberta" description="Uma loja fechada deixa de aparecer nas vendas e no stock, mas o histórico fica." />}
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}
