import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { getDb, getSettings } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { SettingsTabs } from "./tabs";

export const metadata = { title: "Definições" };

export default async function SettingsPage() {
  const ctx = await requirePage(["definicoes.gerir", "auditoria.ver"]);
  if (!can(ctx.actor, "definicoes.gerir")) redirect("/definicoes/atividade");
  const s = await getSettings(await getDb());
  return (
    <>
      <PageHeader title="Definições" description="Dados da empresa, talão e regras gerais." />
      <SettingsTabs actor={ctx.actor} />
      <SettingsForm
        initial={{
          businessName: s.businessName,
          nif: s.nif ?? "",
          phone: s.phone ?? "",
          address: s.address ?? "",
          receiptNote: s.receiptNote ?? "",
          lateToleranceMin: s.lateToleranceMin,
          lowStockDefault: s.lowStockDefault,
          ivaEnabled: s.ivaEnabled,
          ivaRate: s.ivaRate,
        }}
      />
    </>
  );
}
