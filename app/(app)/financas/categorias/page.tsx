import { requirePage } from "@/lib/auth/guards";
import { col, getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { FinCategoriesEditor } from "@/components/finance/FinCategoriesEditor";
import { FinanceTabs } from "../tabs";

export const metadata = { title: "Categorias de finanças" };

export default async function FinCategoriesPage() {
  const ctx = await requirePage("financas.contas");
  const db = await getDb();
  const cats = await col.finCategories(db).find().sort({ type: 1, name: 1 }).toArray();
  return (
    <>
      <PageHeader title="Finanças" description="As categorias organizam as entradas e saídas. A natureza decide como contam no lucro." />
      <FinanceTabs actor={ctx.actor} />
      <FinCategoriesEditor categories={cats.map((c) => ({ id: c._id.toHexString(), name: c.name, type: c.type, kind: c.kind, active: c.active, system: !!c.key }))} />
    </>
  );
}
