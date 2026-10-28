import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can, canAccessStore } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { formatDateTime, formatKz } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { toPlain } from "@/lib/plain";
import { Card, CardBody, CardHeader, DescList, PageHeader } from "@/components/ui/card";
import { SaleStatus } from "../tabs";
import { SaleActions } from "./SaleActions";

export const metadata = { title: "Venda" };

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePage(["vendas.ver_proprias", "vendas.ver_loja", "pos.anular", "pos.devolucao"]);
  if (!ObjectId.isValid(id)) notFound();
  const db = await getDb();
  const sale = await col.sales(db).findOne({ _id: new ObjectId(id) });
  if (!sale || !canAccessStore(ctx.actor, sale.storeId)) notFound();
  const own = sale.seller.id.equals(ctx.actor.id);
  if (!own && !can(ctx.actor, "vendas.ver_loja") && !can(ctx.actor, "pos.anular") && !can(ctx.actor, "pos.devolucao")) notFound();
  const store = await col.stores(db).findOne({ _id: sale.storeId });
  const showCost = can(ctx.actor, "painel.lucros");

  return (
    <>
      <Link href="/vendas" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Vendas
      </Link>
      <PageHeader
        title={sale.number}
        description={`${store?.name} · ${formatDateTime(sale.createdAt)}`}
        actions={
          <SaleActions
            sale={toPlain({ id: sale._id, number: sale.number, status: sale.status, total: sale.total, refunded: sale.refunded, phone: sale.customer?.phone, lines: sale.lines.map((l) => ({ variantId: l.variantId, name: l.name, qty: l.qty, returnedQty: l.returnedQty, lineTotal: l.lineTotal })) })}
            canVoid={can(ctx.actor, "pos.anular", sale.storeId)}
            canReturn={can(ctx.actor, "pos.devolucao", sale.storeId)}
          />
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Artigos" action={<SaleStatus status={sale.status} refunded={sale.refunded} />} />
          <CardBody className="pt-3">
            <ul className="divide-y divide-line/70">
              {sale.lines.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="font-medium text-ink">{l.name}</div>
                    <div className="text-[13px] text-muted">
                      {l.qty} × {formatKz(l.unitPrice)} · {l.sku}
                      {l.unitPrice !== l.listPrice && <span className="text-warning"> · preço alterado (tabela {formatKz(l.listPrice)})</span>}
                      {l.returnedQty > 0 && <span className="text-warning"> · {l.returnedQty} devolvido(s)</span>}
                      {showCost && <span> · custo {formatKz(l.unitCost)}/un.</span>}
                    </div>
                  </div>
                  <div className="font-semibold text-ink tabular">{formatKz(l.lineTotal)}</div>
                </li>
              ))}
            </ul>
            <dl className="mt-3 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
              <Row k="Subtotal" v={formatKz(sale.subtotal)} />
              {sale.discount > 0 && <Row k="Desconto" v={`−${formatKz(sale.discount)}`} />}
              <Row k="Total" v={formatKz(sale.total)} strong />
              {sale.refunded > 0 && <Row k="Devolvido ao cliente" v={`−${formatKz(sale.refunded)}`} />}
              {showCost && sale.status === "concluida" && <Row k="Lucro bruto" v={formatKz(sale.total - sale.refunded - (sale.cost - sale.returnedCost))} />}
            </dl>
          </CardBody>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Detalhes" />
            <CardBody className="pt-4">
              <DescList
                className="sm:grid-cols-1"
                items={[
                  ["Vendedor", sale.seller.name],
                  ["Pagamento", sale.payments.map((p) => `${PAYMENT_METHODS[p.method as PaymentMethod]}: ${formatKz(p.amount)}`).join(" · ") || "—"],
                  ...(sale.change ? ([["Troco", formatKz(sale.change)]] as [string, string][]) : []),
                  ...(sale.customer ? ([["Cliente", [sale.customer.name, sale.customer.phone].filter(Boolean).join(" · ")]] as [string, string][]) : []),
                  ...(sale.note ? ([["Nota", sale.note]] as [string, string][]) : []),
                ]}
              />
            </CardBody>
          </Card>
          {(sale.status === "anulada" || sale.returns.length > 0) && (
            <Card>
              <CardHeader title="Histórico" />
              <CardBody className="flex flex-col gap-3 pt-4 text-sm">
                {sale.status === "anulada" && (
                  <div className="rounded-xl bg-danger-soft p-3 text-danger">
                    Anulada por {sale.voidedBy?.name} em {formatDateTime(sale.voidedAt)}: {sale.voidReason}
                  </div>
                )}
                {sale.returns.map((r, i) => (
                  <div key={i} className="rounded-xl bg-warning-soft p-3 text-warning">
                    Devolução de {formatKz(r.amount)} ({PAYMENT_METHODS[r.method as PaymentMethod]}) por {r.by.name} em {formatDateTime(r.at)}: {r.reason}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={strong ? "flex justify-between text-base font-semibold text-ink" : "flex justify-between text-ink-soft"}>
      <dt>{k}</dt>
      <dd className="tabular">{v}</dd>
    </div>
  );
}
