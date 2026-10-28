"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Delete } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Segmented } from "@/components/ui/nav-tabs";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/format";
import { loginWithPassword, loginWithPin } from "@/app/actions/session";

const LAST_USER_KEY = "cs:last-user";

export function LoginForm() {
  const [mode, setMode] = React.useState<"equipa" | "admin">("equipa");
  return (
    <Card className="p-5 md:p-7">
      <Segmented
        className="mb-6 grid w-full grid-cols-2"
        value={mode}
        onChange={setMode}
        options={[
          { value: "equipa", label: "Equipa" },
          { value: "admin", label: "Administrador" },
        ]}
      />
      {mode === "equipa" ? <PinLogin /> : <PasswordLogin />}
    </Card>
  );
}

function PinLogin() {
  const router = useRouter();
  const [user, setUser] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [pending, start] = React.useTransition();
  const pinRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_USER_KEY);
      if (last) setUser(last);
    } catch {}
  }, []);

  const submit = () => {
    if (!user.trim()) return toast.error("Escreva o utilizador ou o telefone.");
    if (pin.length < 4) return toast.error("O PIN tem pelo menos 4 algarismos.");
    start(async () => {
      try {
        const r = await loginWithPin(user, pin);
        if (!r.ok) {
          toast.error(r.error);
          setPin("");
          return;
        }
        try {
          localStorage.setItem(LAST_USER_KEY, user.trim());
        } catch {}
        router.replace("/");
        router.refresh();
      } catch {
        toast.error("Sem ligação ao servidor. Verifique a internet.");
      }
    });
  };

  const press = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Utilizador ou telefone" htmlFor="user">
        <Input id="user" autoComplete="username" autoCapitalize="none" placeholder="ex.: joana ou 923 000 000" value={user} onChange={(e) => setUser(e.target.value)} />
      </Field>
      <div>
        <div className="mb-3 text-sm font-medium text-ink-soft">PIN</div>
        <button type="button" onClick={() => pinRef.current?.focus()} className="flex w-full justify-center gap-3 py-2" aria-label="Escrever PIN">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={cn("size-4 rounded-full border-2 transition-colors", i < pin.length ? "border-primary bg-primary" : i < 4 ? "border-sand-strong" : "border-dashed border-sand-strong")} />
          ))}
        </button>
        <input
          ref={pinRef}
          className="sr-only"
          inputMode="numeric"
          autoComplete="current-password"
          aria-label="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
        />
        <div className="mt-4 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <PadKey key={d} onClick={() => press(d)}>
              {d}
            </PadKey>
          ))}
          <PadKey onClick={() => setPin("")} muted>
            Limpar
          </PadKey>
          <PadKey onClick={() => press("0")}>0</PadKey>
          <PadKey onClick={() => setPin((p) => p.slice(0, -1))} muted aria-label="Apagar">
            <Delete className="size-5" />
          </PadKey>
        </div>
      </div>
      <Button type="submit" size="lg" loading={pending} disabled={pin.length < 4}>
        Entrar
      </Button>
    </form>
  );
}

function PadKey({ children, onClick, muted, ...rest }: { children: React.ReactNode; onClick: () => void; muted?: boolean; "aria-label"?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-14 place-items-center rounded-2xl text-xl font-semibold transition-colors active:scale-95",
        muted ? "text-sm font-medium text-muted hover:bg-sand" : "bg-sand/70 text-ink hover:bg-sand-strong",
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function PasswordLogin() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [pending, start] = React.useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          try {
            const r = await loginWithPassword(email, password);
            if (!r.ok) return void toast.error(r.error);
            router.replace("/");
            router.refresh();
          } catch {
            toast.error("Sem ligação ao servidor. Verifique a internet.");
          }
        });
      }}
    >
      <Field label="Email ou utilizador" htmlFor="email">
        <Input id="email" autoCapitalize="none" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Palavra-passe" htmlFor="password">
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="mt-2">
        Entrar
      </Button>
    </form>
  );
}
