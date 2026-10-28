import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { Wallet } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { readParams, type SearchParams } from "@/lib/params";
import { rangeOf, resolvePeriod, luandaDay } from "@/lib/time";
import { usableAccounts } from "@/lib/queries";
import { formatDate, formatKz } from "@/lib/format";
import { CATEGORY_KINDS, MANUAL_IN_KINDS, MANUAL_OUT_KINDS } from "@/lib/types";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/ui/table";
import { ParamSelect, PeriodFilter } from "@/components/filters/Filters";
import { EntryButtons, VoidEntryButton } from "@/components/finance/EntryForm";
import { FinanceTabs } from "./tabs";

export const metadata = { title: "Entradas e saídas" };

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requirePage(["financas.ver", "financas.relatorios", "financas.contas", "financas.saida", "financas.entrada"]);
  const { actor, storeId } = ctx;
  if (!can(actor, "financas.ver")) redirect(can(actor, "financas.relatorios") ? "/financas/relatorios" : "/financas/contas");
  const get = await readParams(searchParams);
  const { from, to, period } = resolvePeriod(get("periodo", "7d"), get("de"), get("ate"));
  const { start, end } = rangeOf(from, to);
  const type = get("tipo");
  const kind = get("natureza");
  const account = get("conta");
  const db = await getDb();
  const match: Record<string, unknown> = { at: { $gte: start, $lt: end } };
  if (storeId) match.storeId = storeId;
  else if (!actor.allStores) match.storeId = { $in: actor.storeIds.map((s) => new ObjectId(s)) };
  if (type === "entrada" || type === "saida") match.type = type;
  if (kind && kind in CATEGORY_KINDS) match["category.kind"] = kind;
  if (/^[a-f0-9]{24}$/i.test(account)) match.accountId = new ObjectId(account);

  const [entries, accounts, categories] = await Promise.all([
    col.cashbook(db).find(match).sort({ at: -1 }).limit(400).toArray(),
    usableAccounts(db, actor),
    col.finCategories(db).find({ active: true, key: { $exists: false } }).sort({ name: 1 }).toArray(),
  ]);
  const live = entries.filter((e) => !e.voided && e.category.kind !== "transferencia");
  const totalIn = live.filter((e) => e.type === "entrada").reduce((s, e) => s + e.amount, 0);
  const totalOut = live.filter((e) => e.type === "saida").reduce((s, e) => s + e.amount, 0);
  const accName = new Map(accounts.map((a) => [a.id, a.name]));
  const canVoid = can(actor, "financas.anular");

  return (
    <>
      <PageHeader
        title="Finanças"
        description="Todo o dinheiro que entra e sai: vendas, despesas, compras de mercadoria e levantamentos."
        actions={
          <EntryButtons
            canIn={can(actor, "financas.entrada")}
            canOut={can(actor, "financas.saida")}
            accounts={accounts}
            defaultStoreId={ctx.store?._id.toHexString()}
            today={luandaDay()}
            categories={categories.map((c) => ({ id: c._id.toHexString(), name: c.name, type: c.type, kind: c.kind })).filter((c) => (c.type === "entrada" ? MANUAL_IN_KINDS : MANUAL_OUT_KINDS).includes(c.kind))}
          />
        }
      />
      <FinanceTabs actor={actor} />
      <div className="mb-4 flex flex-wrap gap-2">
        <PeriodFilter period={period} from={from} to={to} />
        <ParamSelect
          name="tipo"
          label="Sentido"
          value={type}
          options={[
            { value: "", label: "Entradas e saídas" },
            { value: "entrada", label: "Só entradas" },
            { value: "saida", label: "Só saídas" },
          ]}
        />
        <ParamSelect name="natureza" label="Natureza" value={kind} options={[{ value: "", label: "Todas as naturezas" }, ...Object.entries(CATEGORY_KINDS).map(([value, label]) => ({ value, label }))]} />
        <ParamSelect name="conta" label="Conta" value={account} options={[{ value: "", label: "Todas as contas" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]} />
      </div>
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Entrou" value={formatKz(totalIn)} tone="up" />
        <Stat label="Saiu" value={formatKz(totalOut)} tone="down" />
        <Stat className="col-span-2 md:col-span-1" label="Diferença" value={formatKz(totalIn - totalOut)} hint="Transferências entre contas não contam" />
      </div>
      <Card>
        <ResponsiveTable
          rows={entries}
          rowKey={(e) => e._id.toHexString()}
          empty={<EmptyState icon={<Wallet />} title="Sem movimentos" description="Não há entradas nem saídas neste período." />}
          columns={[
            { header: "Data", cell: (e) => <span className="whitespace-nowrap text-ink-soft">{formatDate(e.at)}</span> },
            {
              header: "Descrição",
              cell: (e) => (
                <span className={e.voided ? "text-muted line-through" : "text-ink"}>
                  {e.description}
                  {e.attachmentId && (
                    <a href={`/api/imagens/${e.attachmentId}`} target="_blank" className="ml-2 text-xs font-medium text-primary">
                      recibo
                    </a>
                  )}
                </span>
              ),
            },
            { header: "Categoria", cell: (e) => <Badge tone={e.category.kind === "despesa" ? "rose" : e.category.kind === "venda" ? "success" : "neutral"}>{e.category.name}</Badge> },
            { header: "Conta", cell: (e) => <span className="text-ink-soft">{accName.get(e.accountId.toHexString()) ?? "—"}</span> },
            { header: "Por", cell: (e) => <span className="text-ink-soft">{e.by.name}</span> },
            {
              header: "Valor",
              align: "right",
              cell: (e) => <span className={`font-semibold ${e.voided ? "text-muted line-through" : e.type === "entrada" ? "text-success" : "text-danger"}`}>{`${e.type === "entrada" ? "+" : "−"}${formatKz(e.amount)}`}</span>,
            },
            ...(canVoid ? [{ header: "", cell: (e: (typeof entries)[number]) => (!e.voided && (e.source === "manual" || e.source === "contas") ? <VoidEntryButton id={e._id.toHexString()} /> : e.voided ? <Badge>Anulado</Badge> : null) }] : []),
          ]}
          mobile={(e) => (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className={e.voided ? "text-muted line-through" : "font-medium text-ink"}>{e.description}</div>
                <div className="text-[13px] text-muted">
                  {formatDate(e.at)} · {e.category.name} · {accName.get(e.accountId.toHexString())}
                </div>
                {canVoid && !e.voided && e.source === "manual" && (
                  <div className="relative z-10 mt-1">
                    <VoidEntryButton id={e._id.toHexString()} />
                  </div>
                )}
              </div>
              <div className={`shrink-0 font-semibold tabular ${e.voided ? "text-muted line-through" : e.type === "entrada" ? "text-success" : "text-danger"}`}>{`${e.type === "entrada" ? "+" : "−"}${formatKz(e.amount)}`}</div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
