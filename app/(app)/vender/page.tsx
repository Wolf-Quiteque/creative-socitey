import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb, getSettings } from "@/lib/db";
import { pickItems } from "@/lib/queries";
import { tillSummary } from "@/lib/domain/sales";
import { toPlain } from "@/lib/plain";
import { PageHeader } from "@/components/ui/card";
import { StorePicker } from "@/components/shell/StorePicker";
import { Pos } from "@/components/pos/Pos";

export const metadata = { title: "Vender" };

export default async function VenderPage() {
  const ctx = await requirePage("pos.vender");
  const { actor, store } = ctx;
  if (!store) {
    return (
      <>
        <PageHeader title="Vender" description="Escolha a loja onde está a vender." />
        <StorePicker stores={ctx.stores.map((s) => ({ id: s._id.toHexString(), name: s.name, city: s.city }))} />
      </>
    );
  }
  const db = await getDb();
  const [items, categories, till, settings] = await Promise.all([
    pickItems(db, actor, store._id),
    col.categories(db).find().sort({ order: 1 }).toArray(),
    col.tills(db).findOne({ storeId: store._id, status: "aberta" }),
    getSettings(db),
  ]);
  const summary = till && can(actor, "pos.caixa") ? await tillSummary(db, till._id) : null;
  return (
    <Pos
      store={{ id: store._id.toHexString(), name: store.name, allowNegative: store.allowNegativeStock, requireTill: store.requireOpenTill }}
      business={settings.businessName}
      items={items.map(({ cost: _cost, ...i }) => i)}
      categories={categories.map((c) => ({ id: c._id.toHexString(), name: c.name }))}
      till={till ? toPlain({ id: till._id, openedBy: till.openedBy.name, openedAt: till.openedAt, float: till.openingFloat }) : null}
      tillSummary={summary ? { sales: summary.sales, count: summary.count, expectedCash: summary.expectedCash, byMethod: summary.byMethod, cashIn: summary.cashIn, cashOut: summary.cashOut } : null}
      perms={{
        discount: can(actor, "pos.desconto"),
        maxDiscountPct: actor.maxDiscountPct,
        manualPrice: can(actor, "pos.preco_manual"),
        till: can(actor, "pos.caixa"),
      }}
    />
  );
}
