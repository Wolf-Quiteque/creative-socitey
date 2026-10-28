import { NavTabs } from "@/components/ui/nav-tabs";
import { can, type Actor } from "@/lib/actor";

export function TeamTabs({ actor }: { actor: Actor }) {
  const items = [];
  if (can(actor, "equipa.ver")) items.push({ href: "/equipa", label: "Pessoas", exact: true });
  if (can(actor, "cargos.gerir")) items.push({ href: "/equipa/cargos", label: "Cargos e permissões" });
  return <NavTabs items={items} />;
}
