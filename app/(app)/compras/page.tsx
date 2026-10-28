import Link from "next/link";
import { Plus, Truck } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can, storeMatch } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { storeNames } from "@/lib/queries";
import { formatDate, formatKz } from "@/lib/format";
import { Card, EmptyState, PageHeader, Stat } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTable } from "@/components/ui/table";
import { ParamSelect } from "@/components/filters/Filters";
import { PaidBadge, PurchaseStatus, PurchaseTabs } from "./shared";

export const metadata = { title: "Compras" };

export default async function PurchasesPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage(["compras.ver", "fornecedores.gerir"]);
  const get = await readParams(searchParams);
  const status = get("estado");
  const pay = get("pagamento");
  const db = await getDb();
  const match: Record<string, unknown> = storeMatch(ctx.actor, "storeId", ctx.storeId);
  if (status) match.status = status;
  if (pay === "por_pagar") Object.assign(match, { status: { $ne: "cancelada" }, $expr: { $lt: ["$paid", "$total"] } });
  const [list, names] = await Promise.all([col.purchases(db).find(match).sort({ createdAt: -1 }).limit(200).toArray(), storeNames(db)]);
  const open = list.filter((p) => p.status !== "cancelada");
  const owed = open.reduce((s, p) => s + Math.max(0, p.total - p.paid), 0);
  return (
    <>
      <PageHeader
        title="Compras"
        description="Mercadoria comprada a fornecedores, com transporte e alfândega incluídos no custo."
        actions={
          can(ctx.actor, "compras.criar") ? (
            <Button asChild>
              <Link href="/compras/nova">
                <Plus /> Nova compra
              </Link>
            </Button>
          ) : null
        }
      />
      <PurchaseTabs />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Por receber" value={String(open.filter((p) => p.status === "rascunho").length)} />
        <Stat label="Falta pagar" value={formatKz(owed)} tone={owed ? "down" : "neutral"} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <ParamSelect
          name="estado"
          label="Estado"
          value={status}
          options={[
            { value: "", label: "Todos os estados" },
            { value: "rascunho", label: "Por receber" },
            { value: "recebida", label: "Recebidas" },
            { value: "cancelada", label: "Canceladas" },
          ]}
        />
        <ParamSelect
          name="pagamento"
          label="Pagamento"
          value={pay}
          options={[
            { value: "", label: "Pagas e por pagar" },
            { value: "por_pagar", label: "Só por pagar" },
          ]}
        />
      </div>
      <Card>
        <ResponsiveTable
          rows={list}
          rowKey={(p) => p._id.toHexString()}
          rowHref={(p) => `/compras/${p._id.toHexString()}`}
          empty={<EmptyState icon={<Truck />} title="Sem compras" description="Registe a mercadoria que compra para saber o custo real de cada artigo." />}
          columns={[
            { header: "Número", cell: (p) => <span className="font-medium text-ink">{p.number}</span> },
            { header: "Data", cell: (p) => formatDate(p.createdAt) },
            { header: "Fornecedor", cell: (p) => p.supplierName },
            { header: "Loja", cell: (p) => names[p.storeId.toHexString()] },
            { header: "Estado", cell: (p) => <PurchaseStatus status={p.status} /> },
            { header: "Pagamento", cell: (p) => (p.status === "cancelada" ? null : <PaidBadge paid={p.paid} total={p.total} />) },
            { header: "Total", align: "right", cell: (p) => <span className="font-semibold">{formatKz(p.total)}</span> },
          ]}
          mobile={(p) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-ink">
                  {p.number} · {p.supplierName}
                </div>
                <div className="text-[13px] text-muted">
                  {formatDate(p.createdAt)} · {names[p.storeId.toHexString()]}
                </div>
                <div className="mt-1 flex gap-1.5">
                  <PurchaseStatus status={p.status} />
                  {p.status !== "cancelada" && <PaidBadge paid={p.paid} total={p.total} />}
                </div>
              </div>
              <div className="font-semibold text-ink tabular">{formatKz(p.total)}</div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
