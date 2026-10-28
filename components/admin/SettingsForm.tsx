"use client";

import * as React from "react";
import { useAction } from "@/lib/use-action";
import { saveSettingsAction } from "@/app/actions/app";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, NumberInput, Textarea, Toggle } from "@/components/ui/field";

type S = { businessName: string; nif: string; phone: string; address: string; receiptNote: string; lateToleranceMin: number; lowStockDefault: number; ivaEnabled: boolean; ivaRate: number };

export function SettingsForm({ initial }: { initial: S }) {
  const { pending, run } = useAction();
  const [s, setS] = React.useState(initial);
  const set = (p: Partial<S>) => setS((x) => ({ ...x, ...p }));
  return (
    <div className="grid max-w-3xl gap-5">
      <Card>
        <CardHeader title="Empresa" description="Aparece nos talões e documentos impressos." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da empresa">
            <Input value={s.businessName} onChange={(e) => set({ businessName: e.target.value })} />
          </Field>
          <Field label="NIF">
            <Input value={s.nif} onChange={(e) => set({ nif: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <Input value={s.phone} onChange={(e) => set({ phone: e.target.value })} />
          </Field>
          <Field label="Morada da sede">
            <Input value={s.address} onChange={(e) => set({ address: e.target.value })} />
          </Field>
          <Field label="Mensagem no fim do talão" className="sm:col-span-2">
            <Textarea value={s.receiptNote} onChange={(e) => set({ receiptNote: e.target.value })} className="min-h-16" />
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Regras" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Tolerância de atraso (minutos)" hint="Quem chegar até este tempo depois do início do turno conta como presente.">
            <NumberInput value={s.lateToleranceMin} max={240} onChange={(v) => set({ lateToleranceMin: v })} />
          </Field>
          <Field label="Stock mínimo sugerido" hint="Valor proposto ao criar produtos novos.">
            <NumberInput value={s.lowStockDefault} onChange={(v) => set({ lowStockDefault: v })} />
          </Field>
          <div className="sm:col-span-2">
            <Toggle checked={s.ivaEnabled} onChange={(v) => set({ ivaEnabled: v })} label="Mostrar IVA incluído no talão" description="Os preços já incluem IVA; o talão mostra quanto é imposto. Confirme com o contabilista." />
          </div>
          {s.ivaEnabled && (
            <Field label="Taxa de IVA (%)">
              <NumberInput value={s.ivaRate} max={100} onChange={(v) => set({ ivaRate: v })} />
            </Field>
          )}
        </CardBody>
      </Card>
      <div>
        <Button size="lg" loading={pending} onClick={() => run(() => saveSettingsAction({ ...s, nif: s.nif || undefined, phone: s.phone || undefined, address: s.address || undefined, receiptNote: s.receiptNote || undefined }))}>
          Guardar definições
        </Button>
      </div>
    </div>
  );
}
