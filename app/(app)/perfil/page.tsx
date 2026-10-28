import { appContext } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { storeNames } from "@/lib/queries";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { Avatar, Badge, Card, CardBody, CardHeader, DescList, PageHeader } from "@/components/ui/card";
import { ProfileForms } from "@/components/admin/ProfileForms";

export const metadata = { title: "O meu perfil" };

export default async function ProfilePage() {
  const ctx = await appContext();
  const names = await storeNames(await getDb());
  const u = ctx.user;
  return (
    <>
      <PageHeader title="O meu perfil" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Avatar name={u.name} size="lg" />
              <div>
                <div className="font-display text-xl font-semibold text-ink">{u.name}</div>
                <div className="text-sm text-muted">@{u.username}</div>
              </div>
            </div>
            <DescList
              items={[
                ["Cargo", ctx.actor.roleName],
                ["Lojas", ctx.actor.allStores ? "Todas" : u.storeIds.map((s) => names[s.toHexString()]).join(", ") || "—"],
                ["Telefone", u.phone ?? "—"],
                ["Função", u.jobTitle ?? "—"],
              ]}
            />
          </CardBody>
        </Card>
        <ProfileForms usesPin={!!u.pinHash} usesPassword={!!u.passwordHash} />
        <Card className="lg:col-span-2">
          <CardHeader title="O que posso fazer" description="Definido pelo seu cargo. Se precisar de mais, fale com o responsável." />
          <CardBody className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERMISSION_GROUPS.map((g) => {
              const mine = g.items.filter((i) => ctx.actor.perms.has(i.key));
              if (!mine.length) return null;
              return (
                <div key={g.id}>
                  <div className="mb-2 text-sm font-semibold text-ink">{g.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {mine.map((i) => (
                      <Badge key={i.key} tone="primary">
                        {i.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
