import type { Db } from "mongodb";
import { NavTabs } from "@/components/ui/nav-tabs";
import { can, type Actor } from "@/lib/actor";
import type { AppContext } from "@/lib/auth/guards";
import type { Permission } from "@/lib/permissions";

export function HrTabs({ actor }: { actor: Actor }) {
  const items = [];
  if (can(actor, "rh.presencas_confirmar") || can(actor, "rh.presencas_editar")) items.push({ href: "/rh/presencas", label: "Presenças" });
  if (can(actor, "rh.horarios_ver")) items.push({ href: "/rh/horarios", label: "Horários" });
  if (can(actor, "rh.relatorios")) items.push({ href: "/rh/relatorios", label: "Relatórios" });
  return <NavTabs items={items} />;
}

/** RH trabalha sempre numa loja: a do seletor, a do parâmetro ?loja=, ou a primeira com permissão */
export function hrStore(ctx: AppContext, perm: Permission, param: string) {
  const allowed = ctx.stores.filter((s) => can(ctx.actor, perm, s._id));
  return allowed.find((s) => s._id.toHexString() === param) ?? (ctx.store && allowed.find((s) => s._id.equals(ctx.store!._id))) ?? allowed[0] ?? null;
}

export type { Db };
