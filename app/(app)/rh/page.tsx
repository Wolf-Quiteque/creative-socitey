import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";

export default async function HrIndex() {
  const ctx = await requirePage(["rh.horarios_ver", "rh.presencas_confirmar", "rh.relatorios"]);
  redirect(can(ctx.actor, "rh.presencas_confirmar") ? "/rh/presencas" : can(ctx.actor, "rh.horarios_ver") ? "/rh/horarios" : "/rh/relatorios");
}
