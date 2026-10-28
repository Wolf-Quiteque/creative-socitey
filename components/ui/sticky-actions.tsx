import * as React from "react";

/** Barra de ação fixa no fundo (só telemóvel/tablet), para formulários compridos */
export function StickyActions({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="h-20 lg:hidden" aria-hidden />
      <div className="no-print fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-line/70 bg-surface/95 px-4 py-3 backdrop-blur-md md:bottom-0 md:pl-28 md:pr-8 lg:hidden">
        <div className="mx-auto flex max-w-6xl gap-2 [&>*]:flex-1">{children}</div>
      </div>
    </>
  );
}
