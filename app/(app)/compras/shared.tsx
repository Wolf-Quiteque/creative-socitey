import { NavTabs } from "@/components/ui/nav-tabs";
import { Badge } from "@/components/ui/card";

export function PurchaseTabs() {
  return (
    <NavTabs
      items={[
        { href: "/compras", label: "Compras", exact: true },
        { href: "/compras/fornecedores", label: "Fornecedores" },
      ]}
    />
  );
}

export function PurchaseStatus({ status }: { status: string }) {
  if (status === "rascunho") return <Badge tone="info">Por receber</Badge>;
  if (status === "cancelada") return <Badge tone="danger">Cancelada</Badge>;
  return <Badge tone="success">Recebida</Badge>;
}

export function PaidBadge({ paid, total }: { paid: number; total: number }) {
  if (paid >= total) return <Badge tone="success">Paga</Badge>;
  if (paid > 0) return <Badge tone="warning">Parcial</Badge>;
  return <Badge tone="danger">Por pagar</Badge>;
}
