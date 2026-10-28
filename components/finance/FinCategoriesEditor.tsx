"use client";

import * as React from "react";
import { Lock, Pencil, Plus } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { saveFinCategoryAction } from "@/app/actions/app";
import { CATEGORY_KIND_HINTS, CATEGORY_KINDS, MANUAL_IN_KINDS, MANUAL_OUT_KINDS, type CategoryKind } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Toggle } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";

type Cat = { id: string; name: string; type: "entrada" | "saida"; kind: CategoryKind; active: boolean; system: boolean };
type Edit = { id: string | null; name: string; type: "entrada" | "saida"; kind: CategoryKind; active: boolean };

export function FinCategoriesEditor({ categories }: { categories: Cat[] }) {
  const { pending, run } = useAction();
  const [edit, setEdit] = React.useState<Edit | null>(null);
  const kinds = edit ? (edit.type === "entrada" ? MANUAL_IN_KINDS : MANUAL_OUT_KINDS) : [];
  return (
    <>
      <div className="mb-4 flex gap-2">
        <Button onClick={() => setEdit({ id: null, name: "", type: "saida", kind: "despesa", active: true })}>
          <Plus /> Nova categoria
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(["saida", "entrada"] as const).map((t) => (
          <Card key={t}>
            <CardHeader title={t === "saida" ? "Saídas" : "Entradas"} />
            <ul className="mt-2 divide-y divide-line/70">
              {categories
                .filter((c) => c.type === t)
                .map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 md:px-6">
                    <div className="min-w-0">
                      <div className={c.active ? "font-medium text-ink" : "font-medium text-muted line-through"}>{c.name}</div>
                      <Badge tone={c.kind === "despesa" ? "rose" : c.kind === "receita" || c.kind === "venda" ? "success" : "neutral"} className="mt-1">
                        {CATEGORY_KINDS[c.kind]}
                      </Badge>
                    </div>
                    {c.system ? (
                      <span title="Automática" className="text-muted">
                        <Lock className="size-4" />
                      </span>
                    ) : (
                      <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEdit({ id: c.id, name: c.name, type: c.type, kind: c.kind, active: c.active })}>
                        <Pencil />
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </Card>
        ))}
      </div>
      <Sheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? "Editar categoria" : "Nova categoria"}
        size="sm"
        footer={
          <Button loading={pending} disabled={!edit?.name.trim()} onClick={() => edit && run(() => saveFinCategoryAction(edit.id, { name: edit.name, type: edit.type, kind: edit.kind, active: edit.active }), { onSuccess: () => setEdit(null) })}>
            Guardar
          </Button>
        }
      >
        {edit && (
          <div className="grid gap-4">
            <Field label="Nome">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Sentido">
              <Select value={edit.type} disabled={!!edit.id} onChange={(e) => setEdit({ ...edit, type: e.target.value as "entrada" | "saida", kind: e.target.value === "entrada" ? "receita" : "despesa" })}>
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
              </Select>
            </Field>
            <Field label="Natureza" hint={CATEGORY_KIND_HINTS[edit.kind]}>
              <Select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as CategoryKind })}>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {CATEGORY_KINDS[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Toggle checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label="Ativa" />
          </div>
        )}
      </Sheet>
    </>
  );
}
