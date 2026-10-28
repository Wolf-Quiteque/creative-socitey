import { NavTabs } from "@/components/ui/nav-tabs";
import { can, type Actor } from "@/lib/actor";

export function FinanceTabs({ actor }: { actor: Actor }) {
  const items = [];
  if (can(actor, "financas.ver")) items.push({ href: "/financas", label: "Entradas e saídas", exact: true });
  if (can(actor, "financas.relatorios")) items.push({ href: "/financas/relatorios", label: "Relatórios" });
  if (can(actor, "financas.contas") || can(actor, "financas.ver")) items.push({ href: "/financas/contas", label: "Contas" });
  if (can(actor, "financas.contas")) items.push({ href: "/financas/categorias", label: "Categorias" });
  return <NavTabs items={items} />;
}
