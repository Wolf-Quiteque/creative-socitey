"use client";

import * as React from "react";
import { Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

/**
 * No telemóvel abre como folha que sobe do fundo; no computador, como janela ao centro.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  trigger?: React.ReactNode;
}) {
  const widths = { sm: "md:max-w-md", md: "md:max-w-xl", lg: "md:max-w-3xl", xl: "md:max-w-5xl" };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <D.Trigger asChild>{trigger}</D.Trigger>}
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-[rgb(40_26_20/0.45)] backdrop-blur-[2px] animate-fade-in" />
        <D.Content
          className={cn(
            "fixed z-50 flex flex-col bg-surface shadow-lift focus:outline-none",
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl animate-sheet-up",
            "md:inset-auto md:left-1/2 md:top-1/2 md:bottom-auto md:max-h-[88dvh] md:w-[calc(100%-3rem)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-3xl md:animate-pop-in",
            widths[size],
          )}
          onOpenAutoFocus={(e) => {
            // No telemóvel não abrir logo o teclado
            if (window.matchMedia("(max-width: 767px)").matches) e.preventDefault();
          }}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-11 shrink-0 rounded-full bg-sand-strong md:hidden" />
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 md:px-7 md:pt-6">
            <div className="min-w-0">
              <D.Title className="font-display text-xl font-semibold text-ink md:text-2xl">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm leading-relaxed text-muted">{description}</D.Description> : <D.Description className="sr-only">{typeof title === "string" ? title : ""}</D.Description>}
            </div>
            <D.Close className="-mr-2 grid size-10 shrink-0 place-items-center rounded-full text-muted hover:bg-sand hover:text-ink" aria-label="Fechar">
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 md:px-7">{children}</div>
          {footer && <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-4 pb-safe sm:flex-row sm:justify-end md:px-7">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export const SheetClose = D.Close;
