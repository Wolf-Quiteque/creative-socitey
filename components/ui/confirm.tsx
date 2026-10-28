"use client";

import * as React from "react";
import { Sheet } from "./dialog";
import { Button } from "./button";
import { Textarea } from "./field";

type ConfirmOpts = { title: string; description?: React.ReactNode; confirm?: string; danger?: boolean; reason?: string };
type Pending = ConfirmOpts & { resolve: (v: string | false) => void };

let push: ((p: Pending) => void) | null = null;

/**
 * Pergunta de confirmação. Com `reason`, pede também um motivo e devolve-o.
 * Devolve false se a pessoa cancelar.
 */
export function confirmAction(opts: ConfirmOpts): Promise<string | false> {
  return new Promise((resolve) => {
    if (!push) return resolve(window.confirm(opts.title) ? "" : false);
    push({ ...opts, resolve });
  });
}

export function ConfirmHost() {
  const [p, setP] = React.useState<Pending | null>(null);
  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    push = (x) => {
      setReason("");
      setP(x);
    };
    return () => {
      push = null;
    };
  }, []);
  const close = (v: string | false) => {
    p?.resolve(v);
    setP(null);
  };
  return (
    <Sheet
      open={!!p}
      onOpenChange={(o) => !o && close(false)}
      title={p?.title ?? ""}
      description={p?.description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button variant={p?.danger ? "danger" : "primary"} disabled={!!p?.reason && reason.trim().length < 3} onClick={() => close(reason.trim())}>
            {p?.confirm ?? "Confirmar"}
          </Button>
        </>
      }
    >
      {p?.reason ? <Textarea autoFocus placeholder={p.reason} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-20" /> : <div />}
    </Sheet>
  );
}
