import { appContext } from "@/lib/auth/guards";
import { getDb, getSettings } from "@/lib/db";
import { AppShell } from "@/components/shell/AppShell";
import { ConfirmHost } from "@/components/ui/confirm";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await appContext();
  const settings = await getSettings(await getDb());
  return (
    <AppShell
      perms={[...ctx.actor.perms]}
      user={{ name: ctx.user.name, role: ctx.actor.roleName }}
      business={settings.businessName}
      stores={ctx.stores.map((s) => ({ id: s._id.toHexString(), name: s.name, code: s.code }))}
      currentStoreId={ctx.storeId?.toHexString() ?? null}
      canAll={ctx.actor.allStores && ctx.stores.length > 1}
    >
      {children}
      <ConfirmHost />
    </AppShell>
  );
}
