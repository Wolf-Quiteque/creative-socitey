import { NavTabs } from "@/components/ui/nav-tabs";
import { can, type Actor } from "@/lib/actor";

export function SettingsTabs({ actor }: { actor: Actor }) {
  const items = [];
  if (can(actor, "definicoes.gerir")) items.push({ href: "/definicoes", label: "Geral", exact: true });
  if (can(actor, "auditoria.ver")) items.push({ href: "/definicoes/atividade", label: "Registo de atividade" });
  return <NavTabs items={items} />;
}
