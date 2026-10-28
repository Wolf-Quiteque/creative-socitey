import { Wallet } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { storeMatch } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { formatDateTime, formatKz, formatTime } from "@/lib/format";
import { storeNames } from "@/lib/queries";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/table";
import { SalesTabs } from "../tabs";

export const metadata = { title: "Caixas" };

export default async function TillsPage() {
  const ctx = await requirePage(["pos.caixa", "vendas.ver_loja"]);
  const db = await getDb();
  const [tills, names] = await Promise.all([col.tills(db).find(storeMatch(ctx.actor, "storeId", ctx.storeId)).sort({ openedAt: -1 }).limit(100).toArray(), storeNames(db)]);
  const diffBadge = (d?: number) =>
    d === undefined ? null : d === 0 ? <Badge tone="success">Certa</Badge> : d < 0 ? <Badge tone="danger">Falta {formatKz(-d)}</Badge> : <Badge tone="warning">Sobra {formatKz(d)}</Badge>;
  return (
    <>
      <PageHeader title="Vendas" description="Aberturas e fechos de caixa: quanto devia haver e quanto foi contado." />
      <SalesTabs actor={ctx.actor} />
      <Card>
        <ResponsiveTable
          rows={tills}
          rowKey={(t) => t._id.toHexString()}
          empty={<EmptyState icon={<Wallet />} title="Ainda não há caixas" description="As caixas abrem-se no ecrã Vender." />}
          columns={[
            { header: "Loja", cell: (t) => <span className="font-medium text-ink">{names[t.storeId.toHexString()]}</span> },
            { header: "Abertura", cell: (t) => `${formatDateTime(t.openedAt)} · ${t.openedBy.name}` },
            { header: "Fecho", cell: (t) => (t.closedAt ? `${formatTime(t.closedAt)} · ${t.closedBy?.name}` : <Badge tone="success" dot>Aberta</Badge>) },
            { header: "Vendas", align: "right", cell: (t) => (t.summary ? formatKz(t.summary.sales) : "—") },
            { header: "Esperado", align: "right", cell: (t) => (t.expectedCash !== undefined ? formatKz(t.expectedCash) : "—") },
            { header: "Contado", align: "right", cell: (t) => (t.countedCash !== undefined ? formatKz(t.countedCash) : "—") },
            { header: "Diferença", align: "right", cell: (t) => diffBadge(t.difference) },
          ]}
          mobile={(t) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-ink">{names[t.storeId.toHexString()]}</div>
                <div className="text-[13px] text-muted">
                  {formatDateTime(t.openedAt)} · {t.openedBy.name}
                </div>
                {t.countedCash !== undefined && (
                  <div className="text-[13px] text-muted">
                    Esperado {formatKz(t.expectedCash)} · contado {formatKz(t.countedCash)}
                  </div>
                )}
              </div>
              {t.status === "aberta" ? <Badge tone="success" dot>Aberta</Badge> : diffBadge(t.difference)}
            </div>
          )}
        />
      </Card>
    </>
  );
}
