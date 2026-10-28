import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ArrowLeft } from "lucide-react";
import { requirePage } from "@/lib/auth/guards";
import { col, getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui/card";
import { UserForm } from "@/components/team/UserForm";

export const metadata = { title: "Pessoa" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePage("equipa.gerir");
  const db = await getDb();
  const isNew = id === "nova";
  if (!isNew && !ObjectId.isValid(id)) notFound();
  const u = isNew ? null : await col.users(db).findOne({ _id: new ObjectId(id) });
  if (!isNew && (!u || u.isOwner)) notFound();
  const roles = await col.roles(db).find().sort({ name: 1 }).toArray();
  return (
    <>
      <Link href="/equipa" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" /> Equipa
      </Link>
      <PageHeader title={u ? u.name : "Nova pessoa"} description={u ? `@${u.username}` : "A pessoa entra com o utilizador (ou telefone) e um PIN de 4 a 6 algarismos."} />
      <UserForm
        initial={
          u
            ? {
                id: u._id.toHexString(),
                name: u.name,
                username: u.username,
                phone: u.phone ?? "",
                jobTitle: u.jobTitle ?? "",
                notes: u.notes ?? "",
                roleId: u.roleId?.toHexString() ?? "",
                allStores: u.allStores,
                storeIds: u.storeIds.map((s) => s.toHexString()),
                extraPermissions: u.extraPermissions,
                removedPermissions: u.removedPermissions,
                active: u.active,
                locked: !!u.lockedUntil && u.lockedUntil > new Date(),
              }
            : null
        }
        roles={roles.map((r) => ({ id: r._id.toHexString(), name: r.name, color: r.color, description: r.description, permissions: r.permissions, maxDiscountPct: r.maxDiscountPct }))}
        stores={ctx.stores.map((s) => ({ id: s._id.toHexString(), name: s.name }))}
        actorPerms={[...ctx.actor.perms]}
        actorAllStores={ctx.actor.allStores}
        isOwner={ctx.actor.isOwner}
      />
    </>
  );
}
