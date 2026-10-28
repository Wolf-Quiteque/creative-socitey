"use client";

import * as React from "react";
import { useOffline } from "next/offline";
import { Download, PlusSquare, Share, Smartphone, WifiOff, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { cn } from "@/lib/format";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

declare global {
  interface Window {
    __bip?: BeforeInstallPromptEvent | null;
  }
}

// ── Service worker ─────────────────────────────────────────

/** Regista o service worker e avisa quando há uma versão nova da app */
export function PwaRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let devOptIn = false;
    try {
      devOptIn = localStorage.getItem("cs:sw-dev") === "1";
    } catch {}
    if (process.env.NODE_ENV !== "production" && !devOptIn) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const offerUpdate = (worker: ServiceWorker) => {
      toast("Há uma versão nova da app", {
        description: "Atualize quando não estiver a meio de uma venda.",
        duration: Infinity,
        action: {
          label: "Atualizar",
          onClick: () => {
            navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
            worker.postMessage("SKIP_WAITING");
          },
        },
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller) offerUpdate(w);
          });
        });
        // Procura atualizações quando a app volta a estar visível
        const check = () => document.visibilityState === "visible" && reg.update().catch(() => {});
        document.addEventListener("visibilitychange", check);
      })
      .catch(() => {});
  }, []);
  return null;
}

// ── Instalação ─────────────────────────────────────────────

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: minimal-ui)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function useInstall() {
  const [state, setState] = React.useState({ ready: false, standalone: false, canPrompt: false, ios: false });
  React.useEffect(() => {
    const update = () => setState({ ready: true, standalone: isStandalone(), canPrompt: !!window.__bip, ios: isIOS() });
    update();
    window.addEventListener("cs:bip", update);
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", update);
    return () => {
      window.removeEventListener("cs:bip", update);
      mq.removeEventListener("change", update);
    };
  }, []);
  const prompt = React.useCallback(async () => {
    const e = window.__bip;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    window.__bip = null;
    window.dispatchEvent(new Event("cs:bip"));
    if (outcome === "accepted") toast.success("App instalada. Abra-a a partir do ecrã principal.");
    return outcome === "accepted";
  }, []);
  const available = state.ready && !state.standalone && (state.canPrompt || state.ios);
  return { ...state, available, prompt };
}

function IosSteps() {
  return (
    <ol className="flex flex-col gap-4 pb-2">
      <li className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sand text-primary">
          <Share className="size-5" />
        </span>
        <span className="pt-2 text-ink">
          Toque em <b>Partilhar</b> na barra do Safari (o quadrado com a seta para cima).
        </span>
      </li>
      <li className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sand text-primary">
          <PlusSquare className="size-5" />
        </span>
        <span className="pt-2 text-ink">
          Escolha <b>Adicionar ao ecrã principal</b> e depois <b>Adicionar</b>.
        </span>
      </li>
      <li className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary font-display text-sm font-semibold text-on-primary">CS</span>
        <span className="pt-2 text-ink">
          Abra a <b>CS Gestão</b> pelo ícone. Na primeira vez, entre de novo com o seu utilizador e PIN.
        </span>
      </li>
    </ol>
  );
}

/** Botão que instala (Android/computador) ou explica como instalar (iPhone/iPad) */
export function InstallButton({ className, variant = "soft", label = "Instalar a app" }: { className?: string; variant?: "soft" | "primary" | "outline" | "ghost"; label?: string }) {
  const { available, canPrompt, prompt } = useInstall();
  const [open, setOpen] = React.useState(false);
  if (!available) return null;
  return (
    <>
      <Button variant={variant} className={className} onClick={() => (canPrompt ? void prompt() : setOpen(true))}>
        <Download /> {label}
      </Button>
      <Sheet open={open} onOpenChange={setOpen} title="Instalar no iPhone / iPad" description="Fica com um ícone no ecrã principal e abre em ecrã inteiro, como uma app." size="sm">
        <IosSteps />
      </Sheet>
    </>
  );
}

const SNOOZE_KEY = "cs:install-snooze";

/** Cartão no Início a convidar a instalar (pode ser adiado 14 dias) */
export function InstallCard() {
  const { available, canPrompt, prompt } = useInstall();
  const [hidden, setHidden] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
      setHidden(until > Date.now());
    } catch {
      setHidden(false);
    }
  }, []);
  if (!available || hidden) return null;
  const snooze = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + 14 * 86_400_000));
    } catch {}
    setHidden(true);
  };
  return (
    <div className="mb-6 flex items-start gap-4 rounded-2xl border border-primary/20 bg-primary-soft/70 p-4 md:items-center md:p-5">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-on-primary">
        <Smartphone className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-ink">Instale a app neste aparelho</div>
        <p className="mt-0.5 text-sm leading-snug text-ink-soft">Abre num toque a partir do ecrã principal, em ecrã inteiro e mais rápida.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => (canPrompt ? void prompt() : setOpen(true))}>
            <Download /> {canPrompt ? "Instalar" : "Como instalar"}
          </Button>
          <Button size="sm" variant="ghost" onClick={snooze}>
            Agora não
          </Button>
        </div>
      </div>
      <button onClick={snooze} className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-sand" aria-label="Fechar">
        <X className="size-4" />
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Instalar no iPhone / iPad" description="Fica com um ícone no ecrã principal e abre em ecrã inteiro, como uma app." size="sm">
        <IosSteps />
      </Sheet>
    </div>
  );
}

// ── Sem ligação ────────────────────────────────────────────

/** Faixa fixa quando a internet cai. Os pedidos ficam à espera e seguem sozinhos quando a ligação volta. */
export function OfflineBanner() {
  const offline = useOffline();
  const [back, setBack] = React.useState(false);
  const was = React.useRef(false);
  React.useEffect(() => {
    if (offline) was.current = true;
    else if (was.current) {
      was.current = false;
      setBack(true);
      const t = setTimeout(() => setBack(false), 2500);
      return () => clearTimeout(t);
    }
  }, [offline]);
  if (!offline && !back) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "no-print fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-center text-sm font-medium shadow-soft",
        offline ? "bg-warning text-white" : "bg-success text-white",
      )}
    >
      {offline ? (
        <>
          <WifiOff className="size-4 shrink-0" /> Sem internet. O que fizer agora fica à espera e é enviado quando a ligação voltar.
        </>
      ) : (
        "Ligação restabelecida."
      )}
    </div>
  );
}

export function useIsOffline() {
  return useOffline();
}
