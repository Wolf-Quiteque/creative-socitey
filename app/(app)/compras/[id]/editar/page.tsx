import { notFound, redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { col, getDb } from "@/lib/db";
import { PurchaseFormPage } from "../../form-page";

export const metadata = { title: "Editar compra" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ObjectId.isValid(id)) notFound();
  const p = await col.purchases(await getDb()).findOne({ _id: new ObjectId(id) });
  if (!p) notFound();
  if (p.status !== "rascunho") redirect(`/compras/${id}`);
  return (
    <PurchaseFormPage
      title={`Editar ${p.number}`}
      initial={{
        id,
        supplierId: p.supplierId?.toHexString() ?? "",
        storeId: p.storeId.toHexString(),
        currency: p.currency,
        rate: p.rate,
        lines: p.lines.map((l) => ({ variantId: l.variantId.toHexString(), qty: l.qty, unitCostForeign: l.unitCostForeign })),
        extraCosts: p.extraCosts,
        allocation: p.allocation,
        invoiceRef: p.invoiceRef,
        note: p.note,
      }}
    />
  );
}
