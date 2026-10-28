"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, KeyRound, ShieldCheck } from "lucide-react";
import { useAction } from "@/lib/use-action";
import { saveUserAction, setUserActiveAction } from "@/app/actions/app";
import { PERMISSION_GROUPS, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, Textarea, Toggle } from "@/components/ui/field";
import { confirmAction } from "@/components/ui/confirm";
import { StickyActions } from "@/components/ui/sticky-actions";

type Role = { id: string; name: string; color: string; description?: string; permissions: Permission[]; maxDiscountPct: number };
type UserState = {
  id?: string;
  name: string;
  username: string;
  phone: string;
  jobTitle: string;
  notes: string;
  roleId: string;
  allStores: boolean;
  storeIds: string[];
  extraPermissions: Permission[];
  removedPermissions: Permission[];
  active: boolean;
  locked: boolean;
};

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(".")
    .replace(/[^a-z0-9.]/g, "");

export function UserForm({ initial, roles, stores, actorPerms, actorAllStores, isOwner }: { initial: UserState | null; roles: Role[]; stores: { id: string; name: string }[]; actorPerms: string[]; actorAllStores: boolean; isOwner: boolean }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [u, setU] = React.useState<UserState>(
    initial ?? {
      name: "",
      username: "",
      phone: "",
      jobTitle: "",
      notes: "",
      roleId: roles.find((r) => r.name.startsWith("Caixa"))?.id ?? roles[0]?.id ?? "",
      allStores: false,
      storeIds: stores.length === 1 ? [stores[0].id] : [],
      extraPermissions: [],
      removedPermissions: [],
      active: true,
      locked: false,
    },
  );
  const [pin, setPin] = React.useState("");
  const [userTouched, setUserTouched] = React.useState(!!initial);
  const [advanced, setAdvanced] = React.useState(!!(initial?.extraPermissions.length || initial?.removedPermissions.length));
  const set = (patch: Partial<UserState>) => setU((x) => ({ ...x, ...patch }));
  const role = roles.find((r) => r.id === u.roleId);
  const mine = new Set(actorPerms);
  const fromRole = new Set(role?.permissions ?? []);
  const effective = new Set([...fromRole, ...u.extraPermissions].filter((p) => !u.removedPermissions.includes(p)));

  const toggle = (p: Permission, on: boolean) => {
    const extra = new Set(u.extraPermissions);
    const removed = new Set(u.removedPermissions);
    if (on) {
      removed.delete(p);
      if (!fromRole.has(p)) extra.add(p);
    } else {
      extra.delete(p);
      if (fromRole.has(p)) removed.add(p);
    }
    set({ extraPermissions: [...extra], removedPermissions: [...removed] });
  };

  const save = () =>
    run(
      () =>
        saveUserAction(u.id ?? null, {
          name: u.name,
          username: u.username,
          phone: u.phone,
          roleId: u.roleId || null,
          allStores: u.allStores,
          storeIds: u.allStores ? [] : u.storeIds,
          extraPermissions: u.extraPermissions,
          removedPermissions: u.removedPermissions,
          jobTitle: u.jobTitle,
          notes: u.notes,
          pin,
        }),
      {
        onSuccess: (r) => {
          setPin("");
          if (!u.id) router.push(`/equipa/${(r as { id: string }).id}`);
        },
      },
    );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-5">
        <Card>
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome completo" className="sm:col-span-2">
              <Input value={u.name} onChange={(e) => set({ name: e.target.value, ...(userTouched ? {} : { username: slug(e.target.value) }) })} />
            </Field>
            <Field label="Utilizador" hint="Para entrar. Letras minúsculas, sem espaços.">
              <Input
                value={u.username}
                autoCapitalize="none"
                onChange={(e) => {
                  setUserTouched(true);
                  set({ username: e.target.value.toLowerCase().replace(/\s/g, "") });
                }}
              />
            </Field>
            <Field label="Telefone (opcional)" hint="Também serve para entrar.">
              <Input value={u.phone} inputMode="tel" placeholder="923 000 000" onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="Função (opcional)">
              <Input value={u.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} placeholder="ex.: Vendedora" />
            </Field>
            <Field label={u.id ? "Novo PIN (deixe vazio para manter)" : "PIN"} hint="4 a 6 algarismos. Diga-o à pessoa em privado.">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input className="pl-10 tracking-[0.3em]" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} autoComplete="new-password" />
              </div>
            </Field>
            <Field label="Notas (só para gestores)" className="sm:col-span-2">
              <Textarea value={u.notes} onChange={(e) => set({ notes: e.target.value })} className="min-h-16" />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Cargo e lojas" description="O cargo define o que pode fazer. As lojas definem onde." />
          <CardBody className="flex flex-col gap-4">
            <Field label="Cargo">
              <Select value={u.roleId} onChange={(e) => set({ roleId: e.target.value })}>
                <option value="">Sem cargo (só vê o próprio horário)</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id} disabled={!isOwner && r.permissions.some((p) => !mine.has(p))}>
                    {r.name}
                    {!isOwner && r.permissions.some((p) => !mine.has(p)) ? " (acima do seu acesso)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {role?.description && <p className="-mt-2 text-sm text-muted">{role.description}</p>}
            {actorAllStores && <Toggle checked={u.allStores} onChange={(v) => set({ allStores: v })} label="Acesso a todas as lojas" description="Inclui lojas que venham a abrir. Ideal para gerentes gerais e contabilidade." />}
            {!u.allStores && (
              <div className="grid gap-3 sm:grid-cols-2">
                {stores.map((s) => (
                  <Checkbox key={s.id} checked={u.storeIds.includes(s.id)} onChange={(v) => set({ storeIds: v ? [...u.storeIds, s.id] : u.storeIds.filter((x) => x !== s.id) })} label={s.name} />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <button type="button" onClick={() => setAdvanced((a) => !a)} className="flex w-full items-center justify-between px-5 py-5 text-left md:px-6">
            <span>
              <span className="block font-display text-lg font-semibold text-ink">Ajustar permissões desta pessoa</span>
              <span className="text-sm text-muted">Dar ou tirar algo só a esta pessoa, sem mudar o cargo.</span>
            </span>
            <ChevronDown className={cn("size-5 text-muted transition-transform", advanced && "rotate-180")} />
          </button>
          {advanced && (
            <CardBody className="flex flex-col gap-6 pt-0">
              {PERMISSION_GROUPS.map((g) => (
                <div key={g.id}>
                  <div className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">{g.label}</div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {g.items.map((i) => {
                      const on = effective.has(i.key);
                      const changed = u.extraPermissions.includes(i.key) || u.removedPermissions.includes(i.key);
                      return (
                        <Checkbox
                          key={i.key}
                          checked={on}
                          disabled={!isOwner && !mine.has(i.key)}
                          onChange={(v) => toggle(i.key, v)}
                          label={
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              {i.label}
                              {changed && <Badge tone={u.extraPermissions.includes(i.key) ? "success" : "danger"}>{u.extraPermissions.includes(i.key) ? "extra" : "retirada"}</Badge>}
                            </span>
                          }
                          description={i.desc}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardBody>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-ink-soft">
              <ShieldCheck className="size-4 text-primary" /> {effective.size} permissões
              {role && <span className="text-muted">· desconto até {role.maxDiscountPct}%</span>}
            </div>
            {u.locked && <Badge tone="danger">Bloqueada por PIN errado — um PIN novo desbloqueia</Badge>}
            <Button size="lg" className="hidden lg:inline-flex" loading={pending} onClick={save} disabled={!u.name.trim() || !u.username.trim() || (!u.id && pin.length < 4)}>
              {u.id ? "Guardar alterações" : "Criar conta"}
            </Button>
            {u.id && (
              <Button
                variant={u.active ? "danger-soft" : "success"}
                loading={pending}
                onClick={async () => {
                  if (
                    (await confirmAction({
                      title: u.active ? `Desativar a conta de ${u.name}?` : `Reativar a conta de ${u.name}?`,
                      description: u.active ? "A pessoa sai de todos os aparelhos e deixa de conseguir entrar. O histórico fica guardado." : undefined,
                      confirm: u.active ? "Desativar" : "Reativar",
                      danger: u.active,
                    })) !== false
                  )
                    run(() => setUserActiveAction(u.id!, !u.active), { success: u.active ? "Conta desativada." : "Conta reativada.", onSuccess: () => set({ active: !u.active }) });
                }}
              >
                {u.active ? "Desativar conta" : "Reativar conta"}
              </Button>
            )}
          </CardBody>
        </Card>
      </div>
      <StickyActions>
        <Button size="lg" loading={pending} onClick={save} disabled={!u.name.trim() || !u.username.trim() || (!u.id && pin.length < 4)}>
          {u.id ? "Guardar alterações" : "Criar conta"}
        </Button>
      </StickyActions>
    </div>
  );
}
