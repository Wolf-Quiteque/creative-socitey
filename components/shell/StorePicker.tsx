"use client";

import { useTransition } from "react";
import { Store } from "lucide-react";
import { toast } from "sonner";
import { setCurrentStore } from "@/app/actions/session";
import { EmptyState } from "@/components/ui/card";

export function StorePicker({ stores }: { stores: { id: string; name: string; city?: string }[] }) {
  const [pending, start] = useTransition();
  if (!stores.length) return <EmptyState icon={<Store />} title="Ainda não há lojas" description="Abra a primeira loja em Lojas para começar." />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stores.map((s) => (
        <button
          key={s.id}
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setCurrentStore(s.id);
              if (!r.ok) toast.error(r.error);
            })
          }
          className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5 text-left shadow-soft transition hover:border-primary/40 hover:shadow-lift disabled:opacity-60"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Store className="size-6" />
          </span>
          <span>
            <span className="block font-display text-lg font-semibold text-ink">{s.name}</span>
            {s.city && <span className="text-sm text-muted">{s.city}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
