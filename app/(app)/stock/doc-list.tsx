import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can, storeMatch } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { storeNames } from "@/lib/queries";
import { formatDateTime, formatNumber } from "@/lib/format";
import { SAIDA_REASONS, type StockDocType } from "@/lib/types";
import type { Permission } from "@/lib/permissions";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTable } from "@/components/ui/table";
import { DocStatus, StockTabs } from "./shared";

export async function DocListPage({ type, newHref, newLabel, newPerm, emptyText }: { type: StockDocType; newHref: string; newLabel: string; newPerm: Permission; emptyText: string }) {
  const ctx = await requirePage("stock.ver");
  const { actor, storeId } = ctx;
  const db = await getDb();
  const scope =
    type === "transferencia"
      ? { $or: [storeMatch(actor, "storeId", storeId), storeMatch(actor, "toStoreId", storeId)] }
      : storeMatch(actor, "storeId", storeId);
  const [docs, names] = await Promise.all([col.stockDocs(db).find({ type, ...scope }).sort({ createdAt: -1 }).limit(150).toArray(), storeNames(db)]);
  const where = (d: (typeof docs)[number]) => (d.toStoreId ? `${names[d.storeId.toHexString()]} → ${names[d.toStoreId.toHexString()]}` : names[d.storeId.toHexString()]);
  const what = (d: (typeof docs)[number]) => (d.reason ? SAIDA_REASONS[d.reason] : type === "ajuste" ? `${d.lines.filter((l) => l.qty !== l.systemQty).length} diferença(s)` : "");
  return (
    <>
      <PageHeader
        title="Stock"
        description={ctx.store ? ctx.store.name : "Todas as lojas"}
        actions={
          can(actor, newPerm) ? (
            <Button asChild>
              <Link href={newHref}>
                <Plus /> {newLabel}
              </Link>
            </Button>
          ) : null
        }
      />
      <StockTabs actor={actor} />
      <Card>
        <ResponsiveTable
          rows={docs}
          rowKey={(d) => d._id.toHexString()}
          rowHref={(d) => `/stock/documentos/${d._id.toHexString()}`}
          empty={<EmptyState icon={<FileText />} title="Ainda não há documentos" description={emptyText} />}
          columns={[
            { header: "Número", cell: (d) => <span className="font-medium text-ink">{d.number}</span> },
            { header: "Data", cell: (d) => formatDateTime(d.createdAt) },
            { header: type === "transferencia" ? "De → Para" : "Loja", cell: where },
            ...(type !== "transferencia" ? [{ header: type === "saida" ? "Motivo" : "Resultado", cell: what }] : []),
            { header: "Unidades", align: "right" as const, cell: (d) => formatNumber(d.lines.reduce((s, l) => s + l.qty, 0)) },
            { header: "Por", cell: (d) => d.createdBy.name },
            { header: "Estado", cell: (d) => <DocStatus status={d.status} /> },
          ]}
          mobile={(d) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-ink">{d.number}</div>
                <div className="truncate text-[13px] text-muted">{where(d)}</div>
                <div className="text-[13px] text-muted">
                  {formatDateTime(d.createdAt)} · {d.createdBy.name}
                </div>
              </div>
              <DocStatus status={d.status} />
            </div>
          )}
        />
      </Card>
    </>
  );
}
