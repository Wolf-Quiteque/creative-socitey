import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sem acesso" };

export default function NoAccess() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="grid size-16 place-items-center rounded-3xl bg-warning-soft text-warning">
          <ShieldAlert className="size-7" />
        </div>
        <h1 className="font-display text-2xl font-semibold">Sem acesso a esta página</h1>
        <p className="text-muted">O seu cargo não inclui esta área. Se precisar dela, peça ao responsável para ajustar as suas permissões.</p>
        <Button asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
