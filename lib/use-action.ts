"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "./types";

/** Corre uma Server Action com estado de "a carregar" e avisos (toast) */
export function useAction() {
  const [pending, start] = useTransition();
  const run = useCallback(
    <T extends object>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onSuccess?: (r: T & { message?: string }) => void; onError?: (e: string) => void } = {}) => {
      start(async () => {
        try {
          const r = await fn();
          if (r.ok) {
            const msg = opts.success ?? r.message;
            if (msg) toast.success(msg);
            opts.onSuccess?.(r as T & { message?: string });
          } else {
            toast.error(r.error);
            opts.onError?.(r.error);
          }
        } catch {
          const e = typeof navigator !== "undefined" && !navigator.onLine ? "Sem ligação à internet. Verifique a rede e tente de novo." : "Não foi possível falar com o servidor. Tente de novo.";
          toast.error(e);
          opts.onError?.(e);
        }
      });
    },
    [],
  );
  return { pending, run };
}
