"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { deleteRoleAction, saveRoleAction } from "@/app/actions/app";
import { PERMISSION_GROUPS, ROLE_PRESETS, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, NumberInput, Select, Textarea, Toggle } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/confirm";
import { StickyActions } from "@/components/ui/sticky-actions";

const COLORS = ["#B4593C", "#8C6A4F", "#C98C8C", "#7A8C6A", "#A5814E", "#6F7F8F", "#9C5B7A", "#4F7D73"];
type RoleState = { id?: string; name: string; description: string; color: string; permissions: Permission[]; maxDiscountPct: number };

export function RoleEditor({ initial, users, actorPerms, isOwner }: { initial: RoleState | null; users: number; actorPerms: string[]; isOwner: boolean }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [r, setR] = React.useState<RoleState>(initial ?? { name: "", description: "", color: COLORS[2], permissions: [], maxDiscountPct: 0 });
  const set = (patch: Partial<RoleState>) => setR((x) => ({ ...x, ...patch }));
  const mine = new Set(actorPerms);
  const has = new Set(r.permissions);
  const allowed = (p: Permission) => isOwner || mine.has(p);
  const save = () =>
    run(() => saveRoleAction(r.id ?? null, { name: r.name, description: r.description || undefined, color: r.color, permissions: r.permissions, maxDiscountPct: r.maxDiscountPct }), {
      onSuccess: (res) => {
        if (!r.id) router.push(`/equipa/cargos/${(res as { id: string }).id}`);
      },
    });
  const toggle = (p: Permission, on: boolean) => set({ permissions: on ? [...new Set([...r.permissions, p])] : r.permissions.filter((x) => x !== p) });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-4">
        {!r.id && (
          <Card>
            <CardBody className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="text-sm font-medium text-ink-soft">Começar a partir de</span>
              <Select
                className="sm:w-72"
                defaultValue=""
                onChange={(e) => {
                  const p = ROLE_PRESETS.find((x) => x.name === e.target.value);
                  if (p) set({ permissions: p.permissions.filter(allowed), maxDiscountPct: p.maxDiscountPct, description: r.description || p.description, color: p.color });
                }}
              >
                <option value="">Um modelo pronto…</option>
                {ROLE_PRESETS.map((p) => (
                  <option key={p.name}>{p.name}</option>
                ))}
              </Select>
            </CardBody>
          </Card>
        )}
        {PERMISSION_GROUPS.map((g) => {
          const all = g.items.every((i) => has.has(i.key));
          return (
            <Card key={g.id}>
              <div className="flex items-center justify-between px-5 pt-5 md:px-6">
                <h2 className="font-display text-lg font-semibold text-ink">{g.label}</h2>
                <button
                  className="text-sm font-medium text-primary"
                  onClick={() => {
                    const keys = g.items.map((i) => i.key).filter(allowed);
                    set({ permissions: all ? r.permissions.filter((p) => !keys.includes(p)) : [...new Set([...r.permissions, ...keys])] });
                  }}
                >
                  {all ? "Tirar todas" : "Dar todas"}
                </button>
              </div>
              <CardBody className="flex flex-col gap-1 pt-2">
                {g.items.map((i) => (
                  <div key={i.key} className={cn(!allowed(i.key) && "opacity-50")} title={!allowed(i.key) ? "Não pode dar uma permissão que não tem" : undefined}>
                    <Toggle checked={has.has(i.key)} disabled={!allowed(i.key)} onChange={(v) => toggle(i.key, v)} label={i.label} description={i.desc} />
                  </div>
                ))}
              </CardBody>
            </Card>
          );
        })}
      </div>
      <div className="order-first lg:order-none">
        <div className="flex flex-col gap-4 lg:sticky lg:top-6">
          <Card>
            <CardBody className="flex flex-col gap-4">
              <Field label="Nome do cargo">
                <Input value={r.name} onChange={(e) => set({ name: e.target.value })} placeholder="ex.: Vendedora sénior" />
              </Field>
              <Field label="Descrição">
                <Textarea value={r.description} onChange={(e) => set({ description: e.target.value })} className="min-h-16" />
              </Field>
              <Field label="Cor">
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button key={c} aria-label={c} onClick={() => set({ color: c })} className={cn("size-9 rounded-full transition", r.color.toLowerCase() === c.toLowerCase() && "ring-3 ring-offset-2 ring-offset-surface")} style={{ background: c, ["--tw-ring-color" as string]: c }} />
                  ))}
                </div>
              </Field>
              <Field label="Desconto máximo no ponto de venda (%)" hint={has.has("pos.desconto") ? "Acima disto o sistema recusa." : "Só conta se o cargo puder dar descontos."}>
                <NumberInput value={r.maxDiscountPct} min={0} max={100} onChange={(v) => set({ maxDiscountPct: v })} />
              </Field>
              <div className="text-sm text-muted">{r.permissions.length} permissões escolhidas</div>
              <Button
                size="lg"
                className="hidden lg:inline-flex"
                loading={pending}
                disabled={!r.name.trim()}
                onClick={() =>
                  run(() => saveRoleAction(r.id ?? null, { name: r.name, description: r.description || undefined, color: r.color, permissions: r.permissions, maxDiscountPct: r.maxDiscountPct }), {
                    onSuccess: (res) => {
                      if (!r.id) router.push(`/equipa/cargos/${(res as { id: string }).id}`);
                    },
                  })
                }
              >
                {r.id ? "Guardar cargo" : "Criar cargo"}
              </Button>
              {r.id && (
                <>
                  <Button variant="outline" onClick={() => router.push(`/equipa/cargos/novo?copiar=${r.id}`)}>
                    <Copy /> Duplicar
                  </Button>
                  <Button
                    variant="danger-soft"
                    disabled={users > 0}
                    title={users > 0 ? "Mude primeiro as pessoas para outro cargo" : undefined}
                    onClick={async () => {
                      if ((await confirmAction({ title: `Apagar o cargo «${r.name}»?`, confirm: "Apagar", danger: true })) !== false)
                        run(() => deleteRoleAction(r.id!), { onSuccess: () => router.push("/equipa/cargos") });
                    }}
                  >
                    <Trash2 /> Apagar
                  </Button>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
      <StickyActions>
        <Button size="lg" loading={pending} disabled={!r.name.trim()} onClick={save}>
          {r.id ? "Guardar cargo" : "Criar cargo"} · {r.permissions.length} permissões
        </Button>
      </StickyActions>
    </div>
  );
}
