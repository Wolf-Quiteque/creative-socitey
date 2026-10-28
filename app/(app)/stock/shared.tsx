import type { Db } from "mongodb";
import { NavTabs } from "@/components/ui/nav-tabs";
import { Badge } from "@/components/ui/card";
import { can, type Actor } from "@/lib/actor";
import { pickItems } from "@/lib/queries";
import type { CatalogItem } from "@/components/stock/VariantPicker";
import type { StockDocStatus } from "@/lib/types";
import { STOCK_DOC_STATUS } from "@/lib/types";

export function StockTabs({ actor }: { actor: Actor }) {
  const items = [{ href: "/stock", label: "Níveis", exact: true }];
  items.push({ href: "/stock/transferencias", label: "Transferências", exact: false });
  items.push({ href: "/stock/notas-saida", label: "Notas de saída", exact: false });
  if (can(actor, "stock.ajustar") || can(actor, "stock.ver")) items.push({ href: "/stock/ajustes", label: "Contagens", exact: false });
  items.push({ href: "/stock/movimentos", label: "Movimentos", exact: false });
  return <NavTabs items={items} />;
}

export function DocStatus({ status }: { status: StockDocStatus }) {
  const tone = status === "em_transito" ? "info" : status === "recebida_com_diferencas" ? "warning" : status === "cancelada" ? "danger" : "success";
  return (
    <Badge tone={tone} dot={status === "em_transito"}>
      {STOCK_DOC_STATUS[status]}
    </Badge>
  );
}

export async function catalogForForms(db: Db, actor: Actor): Promise<CatalogItem[]> {
  const items = await pickItems(db, actor, null);
  return items.map((i) => ({ variantId: i.variantId, name: i.name, label: i.label, sku: i.sku, barcode: i.barcode, price: i.price, cost: i.cost, search: i.search }));
}
