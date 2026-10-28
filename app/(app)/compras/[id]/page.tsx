import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can, canAccessStore } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { storeNames, usableAccounts } from "@/lib/queries";
import { formatDate, formatDateTime, formatKz, formatNumber } from "@/lib/format";
import { EXTRA_COST_KINDS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { Card, CardBody, CardHeader, DescList, PageHeader } from "@/components/ui/card";
import { PurchaseActions } from "@/components/purchases/PurchaseActions";
import { PaidBadge, PurchaseStatus } from "../shared";

export const metadata = { title: "Compra" };

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePage("compras.ver");
  if (!ObjectId.isValid(id)) notFound();
  const db = await getDb();
  const p = await col.purchases(db).findOne({ _id: new ObjectId(id) });
  if (!p || !canAccessStore(ctx.actor, p.storeId)) notFound();
  const [names, accounts] = await Promise.all([storeNames(db), can(ctx.actor, "compras.pagar") ? usableAccounts(db, ctx.actor) : Promise.resolve([])]);
  const draft = p.status === "rascunho";
  return (
    <>
      <Link href="/compras" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Compras
      </Link>
      <PageHeader
        title={p.number}
        description={`${p.supplierName} · ${names[p.storeId.toHexString()]}`}
        actions={
          <PurchaseActions
            id={id}
            owed={p.status === "cancelada" ? 0 : p.total - p.paid}
            canEdit={draft && can(ctx.actor, "compras.criar", p.storeId)}
            canReceive={draft && can(ctx.actor, "compras.receber", p.storeId)}
            canPay={p.status !== "cancelada" && p.paid < p.total && can(ctx.actor, "compras.pagar")}
            canCancel={draft && p.paid === 0 && can(ctx.actor, "compras.criar", p.storeId)}
            accounts={accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
          />
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Artigos" description={p.currency !== "AOA" ? `Câmbio: 1 ${p.currency} = ${formatNumber(p.rate, 2)} Kz` : undefined} />
          <CardBody className="overflow-x-auto pt-3">
            <table className="w-full min-w-[520px] text-[15px]">
              <thead>
                <tr className="border-b border-line text-left text-[13px] text-muted">
                  <th className="pb-2 font-medium">Artigo</th>
                  <th className="pb-2 text-right font-medium">Qtd.</th>
                  <th className="pb-2 text-right font-medium">Preço fornecedor</th>
                  <th className="pb-2 text-right font-medium">Custo de chegada</th>
                </tr>
              </thead>
              <tbody>
                {p.lines.map((l) => (
                  <tr key={l.variantId.toHexString()} className="border-b border-line/60 last:border-0">
                    <td className="py-2.5">
                      <div className="font-medium text-ink">{l.name}</div>
                      <div className="text-[13px] text-muted">{l.sku}</div>
                    </td>
                    <td className="py-2.5 text-right tabular">{formatNumber(l.qty)}</td>
                    <td className="py-2.5 text-right tabular">
                      {p.currency !== "AOA" && <div className="text-[13px] text-muted">{`${formatNumber(l.unitCostForeign, 2)} ${p.currency}`}</div>}
                      {formatKz(l.unitCostKz)}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular">{formatKz(l.landedUnitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {p.extraCosts.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 text-sm font-semibold text-ink">Custos extra (repartidos por {p.allocation === "valor" ? "valor" : "quantidade"})</div>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {p.extraCosts.map((c, i) => (
                    <li key={i} className="flex justify-between text-ink-soft">
                      <span>
                        {EXTRA_COST_KINDS[c.kind]}
                        {c.description ? ` — ${c.description}` : ""}
                      </span>
                      <span className="tabular">{formatKz(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <dl className="mt-5 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between text-ink-soft">
                <dt>Mercadoria</dt>
                <dd className="tabular">{formatKz(p.goodsTotal)}</dd>
              </div>
              <div className="flex justify-between text-ink-soft">
                <dt>Custos extra</dt>
                <dd className="tabular">{formatKz(p.extraTotal)}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold text-ink">
                <dt>Total</dt>
                <dd className="tabular">{formatKz(p.total)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardBody className="flex flex-col gap-4">
              <div className="flex gap-2">
                <PurchaseStatus status={p.status} />
                {p.status !== "cancelada" && <PaidBadge paid={p.paid} total={p.total} />}
              </div>
              <DescList
                className="sm:grid-cols-1"
                items={[
                  ["Criada", `${formatDate(p.createdAt)} · ${p.createdBy.name}`],
                  ...(p.receivedAt ? ([["Deu entrada", `${formatDateTime(p.receivedAt)} · ${p.receivedBy?.name}`]] as [string, string][]) : []),
                  ...(p.invoiceRef ? ([["Fatura do fornecedor", p.invoiceRef]] as [string, string][]) : []),
                  ["Pago", `${formatKz(p.paid)} de ${formatKz(p.total)}`],
                  ...(p.note ? ([["Observações", p.note]] as [string, string][]) : []),
                ]}
              />
            </CardBody>
          </Card>
          {p.payments.length > 0 && (
            <Card>
              <CardHeader title="Pagamentos" />
              <CardBody className="pt-3">
                <ul className="divide-y divide-line/70 text-sm">
                  {p.payments.map((x) => (
                    <li key={x._id.toHexString()} className="flex justify-between gap-3 py-2.5">
                      <span className="text-ink-soft">
                        {formatDate(x.at)} · {PAYMENT_METHODS[x.method as PaymentMethod]}
                        {x.note && <span className="block text-muted">{x.note}</span>}
                      </span>
                      <span className="font-semibold tabular">{formatKz(x.amount)}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
