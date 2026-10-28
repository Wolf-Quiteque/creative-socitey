import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can, canAccessStore } from "@/lib/actor";
import { col, getDb, getSettings } from "@/lib/db";
import { storeNames } from "@/lib/queries";
import { formatDateTime, formatKz, formatNumber } from "@/lib/format";
import { SAIDA_REASONS, STOCK_DOC_TYPES } from "@/lib/types";
import { toPlain } from "@/lib/plain";
import { Card, CardBody, DescList, PageHeader } from "@/components/ui/card";
import { DocStatus } from "../../shared";
import { DocActions } from "./DocActions";

export const metadata = { title: "Documento de stock" };

export default async function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePage("stock.ver");
  if (!ObjectId.isValid(id)) notFound();
  const db = await getDb();
  const doc = await col.stockDocs(db).findOne({ _id: new ObjectId(id) });
  if (!doc || !(canAccessStore(ctx.actor, doc.storeId) || (doc.toStoreId && canAccessStore(ctx.actor, doc.toStoreId)))) notFound();
  const [names, settings] = await Promise.all([storeNames(db), getSettings(db)]);
  const showCost = can(ctx.actor, "stock.custos");
  const isTransfer = doc.type === "transferencia";
  const received = doc.status === "recebida" || doc.status === "recebida_com_diferencas";
  const value = doc.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  return (
    <>
      <Link href={isTransfer ? "/stock/transferencias" : doc.type === "saida" ? "/stock/notas-saida" : "/stock/ajustes"} className="no-print mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <div className="mb-2 hidden print:block">
        <div className="text-lg font-bold">{settings.businessName}</div>
        {settings.nif && <div className="text-sm">NIF {settings.nif}</div>}
      </div>
      <PageHeader
        eyebrow={STOCK_DOC_TYPES[doc.type]}
        title={doc.number}
        description={isTransfer ? `${names[doc.storeId.toHexString()]} → ${names[doc.toStoreId!.toHexString()]}` : names[doc.storeId.toHexString()]}
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <DocActions
              doc={toPlain({ id: doc._id, status: doc.status, type: doc.type, lines: doc.lines.map((l) => ({ variantId: l.variantId, name: l.name, sku: l.sku, qty: l.qty })) })}
              canReceive={isTransfer && doc.status === "em_transito" && can(ctx.actor, "stock.transf_receber", doc.toStoreId!)}
              canCancel={isTransfer && doc.status === "em_transito" && can(ctx.actor, "stock.transf_enviar", doc.storeId)}
            />
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardBody>
            <table className="w-full text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-[13px] text-muted">
                  <th className="pb-3 font-medium">Artigo</th>
                  {doc.type === "ajuste" && <th className="pb-3 pl-3 text-right font-medium">Sistema</th>}
                  <th className="pb-3 pl-3 text-right font-medium">{doc.type === "ajuste" ? "Contado" : isTransfer ? "Enviado" : "Qtd."}</th>
                  {isTransfer && received && <th className="pb-3 pl-3 text-right font-medium">Recebido</th>}
                  {doc.type === "ajuste" && <th className="pb-3 pl-3 text-right font-medium">Diferença</th>}
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => {
                  const diff = doc.type === "ajuste" ? l.qty - (l.systemQty ?? 0) : isTransfer && received ? (l.qtyReceived ?? l.qty) - l.qty : 0;
                  return (
                    <tr key={i} className="border-b border-line/60 last:border-0 align-top">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-ink">{l.name}</div>
                        <div className="text-[13px] text-muted">
                          {l.sku}
                          {showCost && ` · custo ${formatKz(l.unitCost)}`}
                          {l.note && ` · ${l.note}`}
                        </div>
                      </td>
                      {doc.type === "ajuste" && <td className="py-3 text-right tabular">{formatNumber(l.systemQty ?? 0)}</td>}
                      <td className="py-3 text-right font-medium tabular">{formatNumber(l.qty)}</td>
                      {isTransfer && received && <td className={`py-3 text-right font-medium tabular ${diff ? "text-danger" : ""}`}>{formatNumber(l.qtyReceived ?? l.qty)}</td>}
                      {doc.type === "ajuste" && <td className={`py-3 text-right font-medium tabular ${diff < 0 ? "text-danger" : diff > 0 ? "text-success" : "text-muted"}`}>{diff > 0 ? `+${diff}` : diff}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {showCost && doc.type !== "ajuste" && <div className="mt-4 text-right text-sm text-ink-soft">Valor ao custo: {formatKz(value)}</div>}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div>
              <DocStatus status={doc.status} />
            </div>
            <DescList
              className="sm:grid-cols-1"
              items={[
                ...(doc.reason ? ([["Motivo", SAIDA_REASONS[doc.reason]]] as [string, string][]) : []),
                [isTransfer ? "Enviado por" : "Registado por", `${doc.createdBy.name} · ${formatDateTime(doc.createdAt)}`],
                ...(doc.receivedBy ? ([["Recebido por", `${doc.receivedBy.name} · ${formatDateTime(doc.receivedAt)}`]] as [string, string][]) : []),
                ...(doc.cancelledBy ? ([["Cancelado por", `${doc.cancelledBy.name} · ${formatDateTime(doc.cancelledAt)}`]] as [string, string][]) : []),
                ...(doc.transportCost ? ([["Custo de transporte", formatKz(doc.transportCost)]] as [string, string][]) : []),
                ...(doc.note ? ([["Observações", doc.note]] as [string, string][]) : []),
                ...(doc.receiveNote ? ([["Nota da receção", doc.receiveNote]] as [string, string][]) : []),
              ]}
            />
          </CardBody>
        </Card>
      </div>
      <div className="mt-16 hidden grid-cols-2 gap-16 text-sm print:grid">
        <div className="border-t border-black pt-2">{isTransfer ? "Entregue por" : "Responsável"}</div>
        <div className="border-t border-black pt-2">{isTransfer ? "Recebido por" : "Visto"}</div>
      </div>
    </>
  );
}
