import { cn, initials } from "@/lib/format";

const TINTS = ["#f6e3d9", "#f5e4e2", "#efe6d6", "#e8ece0", "#e9e4ef", "#f3e7d3"];

/** Foto do produto ou, sem foto, um quadrado com as iniciais em tom quente */
export function ProductThumb({ name, imageId, className }: { name: string; imageId?: string; className?: string }) {
  if (imageId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/imagens/${imageId}`} alt="" loading="lazy" className={cn("bg-sand object-cover", className)} />;
  }
  const tint = TINTS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % TINTS.length];
  return (
    <span className={cn("grid place-items-center font-display text-2xl font-semibold text-ink/50", className)} style={{ background: tint }}>
      {initials(name)}
    </span>
  );
}
