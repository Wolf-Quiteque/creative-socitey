import { notFound, redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { getSession } from "@/lib/auth/session";
import { canAccessStore } from "@/lib/actor";
import { col, getDb, getSettings } from "@/lib/db";
import { formatDateTime, formatKz } from "@/lib/format";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/types";
import { PrintButton } from "@/components/ui/print-button";

export const metadata = { title: "Talão" };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s) redirect("/entrar");
  if (!ObjectId.isValid(id)) notFound();
  const db = await getDb();
  const sale = await col.sales(db).findOne({ _id: new ObjectId(id) });
  if (!sale || !canAccessStore(s.actor, sale.storeId)) notFound();
  const [store, settings] = await Promise.all([col.stores(db).findOne({ _id: sale.storeId }), getSettings(db)]);
  const net = sale.total - sale.refunded;
  const iva = settings.ivaEnabled ? Math.round(net - net / (1 + settings.ivaRate / 100)) : 0;

  return (
    <div className="min-h-dvh bg-sand py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex w-[80mm] max-w-full justify-center">
        <PrintButton autoPrint />
      </div>
      <article className="mx-auto w-[80mm] max-w-full bg-white px-4 py-5 font-mono text-[12px] leading-snug text-black shadow-soft print:shadow-none">
        <header className="text-center">
          <div className="text-[15px] font-bold">{settings.businessName}</div>
          {settings.nif && <div>NIF {settings.nif}</div>}
          <div>{store?.name}</div>
          {store?.address && <div>{store.address}</div>}
          {store?.phone && <div>Tel. {store.phone}</div>}
        </header>
        <hr className="my-3 border-dashed border-black/40" />
        <div className="flex justify-between">
          <span>{sale.number}</span>
          <span>{formatDateTime(sale.createdAt)}</span>
        </div>
        <div>Atendido por: {sale.seller.name}</div>
        {sale.customer?.name && <div>Cliente: {sale.customer.name}</div>}
        {sale.status === "anulada" && <div className="mt-2 text-center font-bold">*** VENDA ANULADA ***</div>}
        <hr className="my-3 border-dashed border-black/40" />
        {sale.lines.map((l, i) => (
          <div key={i} className="mb-1.5">
            <div>{l.name}</div>
            <div className="flex justify-between">
              <span>
                {l.qty} x {formatKz(l.unitPrice)}
              </span>
              <span>{formatKz(l.qty * l.unitPrice)}</span>
            </div>
          </div>
        ))}
        <hr className="my-3 border-dashed border-black/40" />
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatKz(sale.subtotal)}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span>Desconto</span>
            <span>-{formatKz(sale.discount)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between text-[15px] font-bold">
          <span>TOTAL</span>
          <span>{formatKz(sale.total)}</span>
        </div>
        {sale.payments.map((p, i) => (
          <div key={i} className="flex justify-between">
            <span>{PAYMENT_METHODS[p.method as PaymentMethod]}</span>
            <span>{formatKz(p.method === "dinheiro" && sale.cashReceived ? sale.cashReceived : p.amount)}</span>
          </div>
        ))}
        {sale.change > 0 && (
          <div className="flex justify-between">
            <span>Troco</span>
            <span>{formatKz(sale.change)}</span>
          </div>
        )}
        {sale.refunded > 0 && (
          <div className="flex justify-between">
            <span>Devolvido</span>
            <span>-{formatKz(sale.refunded)}</span>
          </div>
        )}
        {iva > 0 && <div className="mt-2">IVA incluído ({settings.ivaRate}%): {formatKz(iva)}</div>}
        <hr className="my-3 border-dashed border-black/40" />
        <footer className="text-center">
          {store?.receiptFooter && <div>{store.receiptFooter}</div>}
          {settings.receiptNote && <div>{settings.receiptNote}</div>}
          <div className="mt-2 text-[10px]">Documento interno. Não serve de fatura.</div>
        </footer>
      </article>
    </div>
  );
}
