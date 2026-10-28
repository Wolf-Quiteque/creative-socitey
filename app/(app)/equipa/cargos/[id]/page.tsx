import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { col, getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { RoleEditor } from "@/components/team/RoleEditor";

export const metadata = { title: "Cargo" };

export default async function RolePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ copiar?: string }> }) {
  const { id } = await params;
  const { copiar } = await searchParams;
  const ctx = await requirePage("cargos.gerir");
  const db = await getDb();
  const isNew = id === "novo";
  if (!isNew && !ObjectId.isValid(id)) notFound();
  const r = isNew ? (copiar && ObjectId.isValid(copiar) ? await col.roles(db).findOne({ _id: new ObjectId(copiar) }) : null) : await col.roles(db).findOne({ _id: new ObjectId(id) });
  if (!isNew && !r) notFound();
  const users = isNew ? 0 : await col.users(db).countDocuments({ roleId: r!._id, active: true });
  return (
    <>
      <Link href="/equipa/cargos" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Cargos
      </Link>
      <PageHeader title={isNew ? (r ? `Cópia de ${r.name}` : "Novo cargo") : r!.name} description={isNew ? "Escolha o que este cargo pode fazer." : `${users} pessoa(s) com este cargo.`} />
      <RoleEditor
        initial={
          r
            ? { id: isNew ? undefined : r._id.toHexString(), name: isNew ? `${r.name} (cópia)` : r.name, description: r.description ?? "", color: r.color, permissions: r.permissions, maxDiscountPct: r.maxDiscountPct }
            : null
        }
        users={users}
        actorPerms={[...ctx.actor.perms]}
        isOwner={ctx.actor.isOwner}
      />
    </>
  );
}
