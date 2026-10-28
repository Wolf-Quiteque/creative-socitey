import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <div className="font-display text-6xl font-semibold text-primary">404</div>
        <h1 className="font-display text-2xl font-semibold">Página não encontrada</h1>
        <p className="text-muted">O endereço pode estar errado ou o registo já não existe.</p>
        <Button asChild>
          <Link href="/">Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
