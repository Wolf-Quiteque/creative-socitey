import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDb, getSettings } from "@/lib/db";
import { LoginForm } from "./LoginForm";
import { InstallButton } from "@/components/pwa/pwa";

export const metadata = { title: "Entrar" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  const settings = await getSettings(await getDb());
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-bg px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-32 size-[28rem] rounded-full bg-primary-soft blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-32 size-[26rem] rounded-full bg-rose-soft blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid size-16 place-items-center rounded-3xl bg-primary font-display text-2xl font-semibold text-on-primary shadow-lift">CS</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">{settings.businessName}</h1>
          <p className="text-muted">Entre para começar o dia.</p>
        </div>
        <LoginForm />
        <div className="mt-4 flex justify-center">
          <InstallButton variant="ghost" label="Instalar a app neste aparelho" />
        </div>
      </div>
    </div>
  );
}
