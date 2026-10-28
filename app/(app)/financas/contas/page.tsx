import { requirePage } from "@/lib/auth/guards";
import { can, storeMatch } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { accountBalances } from "@/lib/domain/finance";
import { storeNames } from "@/lib/queries";
import { formatKz } from "@/lib/format";
import { PageHeader, Stat } from "@/components/ui/card";
import { AccountsEditor } from "@/components/finance/AccountsEditor";
import { FinanceTabs } from "../tabs";

export const metadata = { title: "Contas" };

export default async function AccountsPage() {
  const ctx = await requirePage(["financas.contas", "financas.ver"]);
  const db = await getDb();
  const filter = ctx.actor.allStores ? {} : storeMatch(ctx.actor, "storeId");
  const [accounts, names] = await Promise.all([col.accounts(db).find(filter).sort({ type: 1, name: 1 }).toArray(), storeNames(db)]);
  const balances = await accountBalances(db, accounts.map((a) => a._id));
  const rows = accounts.map((a) => ({
    id: a._id.toHexString(),
    name: a.name,
    type: a.type,
    storeId: a.storeId?.toHexString() ?? null,
    storeName: a.storeId ? names[a.storeId.toHexString()] : null,
    openingBalance: a.openingBalance,
    active: a.active,
    balance: a.openingBalance + (balances.get(a._id.toHexString()) ?? 0),
  }));
  const total = rows.filter((r) => r.active).reduce((s, r) => s + r.balance, 0);
  return (
    <>
      <PageHeader title="Finanças" description="Onde está o dinheiro: a caixa de cada loja e as contas bancárias." />
      <FinanceTabs actor={ctx.actor} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Saldo total" value={formatKz(total)} />
        <Stat label="Em caixas" value={formatKz(rows.filter((r) => r.type === "caixa" && r.active).reduce((s, r) => s + r.balance, 0))} />
      </div>
      <AccountsEditor
        accounts={rows}
        stores={ctx.stores.map((s) => ({ id: s._id.toHexString(), name: s.name }))}
        canManage={can(ctx.actor, "financas.contas")}
        canGeneral={ctx.actor.allStores}
      />
    </>
  );
}
