"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { deleteCategoryAction, saveCategoryAction } from "@/app/actions/app";
import { CATEGORY_TYPES, type ProductCategoryType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";
import { confirmAction } from "@/components/ui/confirm";

type Cat = { id: string; name: string; type: string; count: number };

export function CategoriesEditor({ categories, canEdit }: { categories: Cat[]; canEdit: boolean }) {
  const { pending, run } = useAction();
  const [edit, setEdit] = React.useState<null | { id: string | null; name: string; type: ProductCategoryType }>(null);
  return (
    <>
      {canEdit && (
        <Button className="mb-4" onClick={() => setEdit({ id: null, name: "", type: "beleza" })}>
          <Plus /> Nova categoria
        </Button>
      )}
      <Card>
        <ul className="divide-y divide-line/70">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5 md:px-6">
              <div>
                <div className="font-medium text-ink">{c.name}</div>
                <div className="text-[13px] text-muted">
                  {CATEGORY_TYPES[c.type as ProductCategoryType]} · {c.count} produto(s)
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEdit({ id: c.id, name: c.name, type: c.type as ProductCategoryType })}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Apagar"
                    onClick={async () => {
                      if ((await confirmAction({ title: `Apagar «${c.name}»?`, confirm: "Apagar", danger: true })) !== false) run(() => deleteCategoryAction(c.id));
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              )}
            </li>
          ))}
          {!categories.length && <li className="px-6 py-10 text-center text-muted">Ainda não há categorias.</li>}
        </ul>
      </Card>
      <Sheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? "Editar categoria" : "Nova categoria"}
        size="sm"
        footer={
          <Button loading={pending} disabled={!edit?.name.trim()} onClick={() => edit && run(() => saveCategoryAction(edit.id, { name: edit.name, type: edit.type }), { onSuccess: () => setEdit(null) })}>
            Guardar
          </Button>
        }
      >
        {edit && (
          <div className="grid gap-4">
            <Field label="Nome">
              <Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Tipo" hint="«Cabelo / perucas» mostra os campos de comprimento, lace e densidade nos produtos.">
              <Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as ProductCategoryType })}>
                {Object.entries(CATEGORY_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Badge tone="info" className="w-fit">
              Pode reorganizar produtos entre categorias a qualquer momento
            </Badge>
          </div>
        )}
      </Sheet>
    </>
  );
}
