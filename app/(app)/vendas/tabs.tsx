import { NavTabs } from "@/components/ui/nav-tabs";
import { Badge } from "@/components/ui/card";
import { can, type Actor } from "@/lib/actor";

export function SalesTabs({ actor }: { actor: Actor }) {
  const items = [{ href: "/vendas", label: "Vendas", exact: true }];
  if (can(actor, "pos.caixa") || can(actor, "vendas.ver_loja")) items.push({ href: "/vendas/caixas", label: "Caixas", exact: false });
  return <NavTabs items={items} />;
}

export function SaleStatus({ status, refunded, small }: { status: string; refunded: number; small?: boolean }) {
  if (status === "anulada") return <Badge tone="danger">Anulada</Badge>;
  if (refunded > 0) return <Badge tone="warning">Devolução</Badge>;
  return small ? null : <Badge tone="success">Concluída</Badge>;
}
