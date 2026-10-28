import { ObjectId } from "mongodb";
import { History } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { col, getDb } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { rangeOf, resolvePeriod } from "@/lib/time";
import { storeNames } from "@/lib/queries";
import { formatDateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/table";
import { ParamSelect, PeriodFilter } from "@/components/filters/Filters";
import { SettingsTabs } from "../tabs";

export const metadata = { title: "Registo de atividade" };

const AREAS: Record<string, string> = {
  sale: "Vendas",
  till: "Caixa",
  stockDoc: "Stock",
  purchase: "Compras",
  supplier: "Fornecedores",
  cashbook: "Finanças",
  account: "Contas",
  product: "Produtos",
  user: "Equipa",
  role: "Cargos",
  store: "Lojas",
  settings: "Definições",
  shift: "Horários",
  attendance: "Presenças",
};

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage("auditoria.ver");
  const get = await readParams(searchParams);
  const { from, to, period } = resolvePeriod(get("periodo", "7d"), get("de"), get("ate"));
  const { start, end } = rangeOf(from, to);
  const who = get("pessoa");
  const area = get("area");
  const db = await getDb();
  const match: Record<string, unknown> = { at: { $gte: start, $lt: end } };
  if (!ctx.actor.allStores) match.storeId = { $in: ctx.stores.map((s) => s._id) };
  else if (ctx.storeId) match.storeId = ctx.storeId;
  if (/^[a-f0-9]{24}$/i.test(who)) match["by.id"] = new ObjectId(who);
  if (area in AREAS) match.entity = area;
  const [rows, names, people] = await Promise.all([
    col.audit(db).find(match).sort({ at: -1 }).limit(400).toArray(),
    storeNames(db),
    col.users(db).find({}, { projection: { name: 1 } }).sort({ name: 1 }).toArray(),
  ]);
  return (
    <>
      <PageHeader title="Definições" description="Quem fez o quê e quando: anulações, ajustes de stock, mudanças de preços, contas e permissões." />
      <SettingsTabs actor={ctx.actor} />
      <div className="mb-4 flex flex-wrap gap-2">
        <PeriodFilter period={period} from={from} to={to} />
        <ParamSelect name="pessoa" label="Pessoa" value={who} options={[{ value: "", label: "Todas as pessoas" }, ...people.map((p) => ({ value: p._id.toHexString(), label: p.name }))]} />
        <ParamSelect name="area" label="Área" value={area} options={[{ value: "", label: "Todas as áreas" }, ...Object.entries(AREAS).map(([value, label]) => ({ value, label }))]} />
      </div>
      <Card>
        <ResponsiveTable
          rows={rows}
          rowKey={(r) => r._id.toHexString()}
          empty={<EmptyState icon={<History />} title="Sem atividade" description="Nada registado neste período." />}
          columns={[
            { header: "Quando", cell: (r) => <span className="whitespace-nowrap text-ink-soft">{formatDateTime(r.at)}</span> },
            { header: "Quem", cell: (r) => <span className="font-medium text-ink">{r.by.name}</span> },
            { header: "Área", cell: (r) => AREAS[r.entity] ?? r.entity },
            { header: "O quê", cell: (r) => r.summary },
            { header: "Loja", cell: (r) => (r.storeId ? names[r.storeId.toHexString()] : "—") },
          ]}
          mobile={(r) => (
            <div>
              <div className="text-ink">{r.summary}</div>
              <div className="text-[13px] text-muted">
                {r.by.name} · {formatDateTime(r.at)}
                {r.storeId && ` · ${names[r.storeId.toHexString()]}`}
              </div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
