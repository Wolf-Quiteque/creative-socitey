"use client";

import { RotateCcw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-3xl bg-warning-soft text-warning">
        <WifiOff className="size-7" />
      </span>
      <h1 className="font-display text-2xl font-semibold">Não foi possível carregar</h1>
      <p className="text-muted">Pode ser a ligação à internet. Verifique a rede e tente de novo.</p>
      <Button onClick={reset}>
        <RotateCcw /> Tentar de novo
      </Button>
    </div>
  );
}
