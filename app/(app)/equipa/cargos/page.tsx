import Link from "next/link";
import { Plus, ShieldCheck } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { col, getDb } from "@/lib/db";
import { ALL_PERMISSIONS } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TeamTabs } from "../tabs";

export const metadata = { title: "Cargos" };

export default async function RolesPage() {
  const ctx = await requirePage("cargos.gerir");
  const db = await getDb();
  const [roles, counts] = await Promise.all([
    col.roles(db).find().sort({ name: 1 }).toArray(),
    col.users(db).aggregate<{ _id: string; n: number }>([{ $match: { active: true, roleId: { $ne: null } } }, { $group: { _id: { $toString: "$roleId" }, n: { $sum: 1 } } }]).toArray(),
  ]);
  const n = new Map(counts.map((c) => [c._id, c.n]));
  return (
    <>
      <PageHeader
        title="Equipa"
        description="Cada cargo é um conjunto de permissões. Mude um cargo e todas as pessoas com ele ficam logo com as novas regras."
        actions={
          <Button asChild>
            <Link href="/equipa/cargos/novo">
              <Plus /> Novo cargo
            </Link>
          </Button>
        }
      />
      <TeamTabs actor={ctx.actor} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <Link key={r._id.toHexString()} href={`/equipa/cargos/${r._id.toHexString()}`}>
            <Card className="h-full p-5 transition hover:border-primary/40 hover:shadow-lift">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl text-white" style={{ background: r.color }}>
                  <ShieldCheck className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-semibold text-ink">{r.name}</div>
                  <div className="text-[13px] text-muted">{n.get(r._id.toHexString()) ?? 0} pessoa(s)</div>
                </div>
              </div>
              {r.description && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{r.description}</p>}
              <div className="mt-4 h-1.5 rounded-full bg-sand">
                <div className="h-1.5 rounded-full" style={{ width: `${(r.permissions.length / ALL_PERMISSIONS.length) * 100}%`, background: r.color }} />
              </div>
              <div className="mt-2 text-[13px] text-muted">
                {r.permissions.length} de {ALL_PERMISSIONS.length} permissões · desconto até {r.maxDiscountPct}%
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
