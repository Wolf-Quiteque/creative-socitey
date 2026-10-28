import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { can } from "@/lib/actor";
import { col, getDb } from "@/lib/db";
import { storeNames } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { Avatar, Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTable } from "@/components/ui/table";
import { TeamTabs } from "./tabs";

export const metadata = { title: "Equipa" };

export default async function TeamPage() {
  const ctx = await requirePage(["equipa.ver", "cargos.gerir"]);
  if (!can(ctx.actor, "equipa.ver")) redirect("/equipa/cargos");
  const db = await getDb();
  const filter = ctx.actor.allStores ? {} : { $or: [{ storeIds: { $in: ctx.stores.map((s) => s._id) } }, { allStores: true }] };
  const [users, roles, names] = await Promise.all([col.users(db).find(filter).sort({ active: -1, name: 1 }).toArray(), col.roles(db).find().toArray(), storeNames(db)]);
  const role = new Map(roles.map((r) => [r._id.toHexString(), r]));
  const now = new Date();
  const status = (u: (typeof users)[number]) =>
    !u.active ? <Badge>Desativada</Badge> : u.lockedUntil && u.lockedUntil > now ? <Badge tone="danger">Bloqueada</Badge> : <Badge tone="success">Ativa</Badge>;
  const roleBadge = (u: (typeof users)[number]) => {
    if (u.isOwner) return <Badge tone="primary">Dono</Badge>;
    const r = u.roleId ? role.get(u.roleId.toHexString()) : null;
    return r ? (
      <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
        <span className="size-2.5 rounded-full" style={{ background: r.color }} />
        {r.name}
      </span>
    ) : (
      <span className="text-sm text-muted">Sem cargo</span>
    );
  };
  const where = (u: (typeof users)[number]) => (u.isOwner || u.allStores ? "Todas as lojas" : u.storeIds.map((s) => names[s.toHexString()]).join(", "));
  return (
    <>
      <PageHeader
        title="Equipa"
        description="Contas de acesso, cargos e lojas de cada pessoa."
        actions={
          can(ctx.actor, "equipa.gerir") ? (
            <Button asChild>
              <Link href="/equipa/nova">
                <Plus /> Nova pessoa
              </Link>
            </Button>
          ) : null
        }
      />
      <TeamTabs actor={ctx.actor} />
      <Card>
        <ResponsiveTable
          rows={users}
          rowKey={(u) => u._id.toHexString()}
          rowHref={(u) => (can(ctx.actor, "equipa.gerir") && !u.isOwner ? `/equipa/${u._id.toHexString()}` : undefined)}
          empty={<EmptyState icon={<Users />} title="Ainda não há pessoas" description="Crie contas para a equipa entrar com telefone e PIN." />}
          columns={[
            {
              header: "Pessoa",
              cell: (u) => (
                <span className="flex items-center gap-3">
                  <Avatar name={u.name} size="sm" color={u.roleId ? role.get(u.roleId.toHexString())?.color : undefined} />
                  <span>
                    <span className="block font-medium text-ink">{u.name}</span>
                    <span className="text-[13px] text-muted">
                      @{u.username}
                      {u.phone && ` · ${u.phone}`}
                    </span>
                  </span>
                </span>
              ),
            },
            { header: "Cargo", cell: roleBadge },
            { header: "Lojas", cell: (u) => <span className="text-ink-soft">{where(u)}</span> },
            { header: "Última entrada", cell: (u) => <span className="text-ink-soft">{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Nunca"}</span> },
            { header: "Estado", cell: status },
          ]}
          mobile={(u) => (
            <div className="flex items-center gap-3">
              <Avatar name={u.name} color={u.roleId ? role.get(u.roleId.toHexString())?.color : undefined} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-ink">{u.name}</div>
                <div className="truncate text-[13px] text-muted">{where(u)}</div>
                <div className="mt-0.5">{roleBadge(u)}</div>
              </div>
              {status(u)}
            </div>
          )}
        />
      </Card>
    </>
  );
}
