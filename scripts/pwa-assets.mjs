// Gera os ícones e ecrãs de arranque da app (PWA). Correr com: npm run pwa:assets
// Os ficheiros gerados ficam em public/ e app/apple-icon.png e vão para o repositório.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = (p) => path.join(root, p);

const TERRA = "#b4593c";
const CREAM = "#fbf7f2";
const COCOA = "#3b2a22";
const LIGHT = "#fff8f3";

/** "CS" em serifa, centrado. `scale` = altura das letras em relação ao lado */
const mark = (size, scale, color = LIGHT) =>
  `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${size * scale}" letter-spacing="${size * 0.01}" fill="${color}">CS</text>`;

const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);

async function png(file, w, h, body) {
  await fs.mkdir(path.dirname(out(file)), { recursive: true });
  await sharp(svg(w, h, body)).png({ compressionLevel: 9 }).toFile(out(file));
  console.log("✓", file);
}

// Ícone "any": quadrado arredondado com cantos transparentes
const anyIcon = (s) => `<rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${TERRA}"/>${mark(s, 0.42)}`;
// Ícone "maskable": fundo até às bordas, letras dentro da zona segura (círculo de 80%)
const maskable = (s) => `<rect width="${s}" height="${s}" fill="${TERRA}"/>${mark(s, 0.32)}`;

await png("public/icons/icon-192.png", 192, 192, anyIcon(192));
await png("public/icons/icon-512.png", 512, 512, anyIcon(512));
await png("public/icons/maskable-192.png", 192, 192, maskable(192));
await png("public/icons/maskable-512.png", 512, 512, maskable(512));
// iOS arredonda sozinho; tem de ser opaco
await png("app/apple-icon.png", 180, 180, `<rect width="180" height="180" fill="${TERRA}"/>${mark(180, 0.38)}`);

// Atalhos (pressão longa no ícone): glifos do lucide sobre o terracota
async function lucideNode(name) {
  const mod = await import(path.join(root, `node_modules/lucide-react/dist/esm/icons/${name}.mjs`));
  return mod.__iconData.node
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== "key").map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
}
for (const [file, icon] of [
  ["vender", "shopping-bag"],
  ["stock", "boxes"],
  ["horario", "clock"],
  ["financas", "wallet"],
]) {
  const s = 96;
  const glyph = await lucideNode(icon);
  await png(
    `public/icons/shortcut-${file}.png`,
    s,
    s,
    `<rect width="${s}" height="${s}" rx="${s * 0.22}" fill="${TERRA}"/><g transform="translate(${s * 0.25} ${s * 0.25}) scale(${(s * 0.5) / 24})" fill="none" stroke="${LIGHT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`,
  );
}

// Ecrãs de arranque do iOS (sem eles aparece um ecrã branco ao abrir a app)
export const SPLASH = [
  [430, 932, 3],
  [440, 956, 3],
  [402, 874, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [375, 812, 3],
  [414, 896, 3],
  [414, 896, 2],
  [375, 667, 2],
  [1024, 1366, 2],
  [834, 1194, 2],
  [820, 1180, 2],
  [810, 1080, 2],
];
for (const [w, h, r] of SPLASH) {
  const W = w * r;
  const H = h * r;
  const tile = Math.round(Math.min(W, H) * 0.24);
  const x = (W - tile) / 2;
  const y = H / 2 - tile * 0.75;
  await png(
    `public/splash/splash-${W}x${H}.png`,
    W,
    H,
    `<rect width="${W}" height="${H}" fill="${CREAM}"/>
     <svg x="${x}" y="${y}" width="${tile}" height="${tile}" viewBox="0 0 ${tile} ${tile}">${anyIcon(tile)}</svg>
     <text x="50%" y="${y + tile * 1.45}" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="${tile * 0.2}" fill="${COCOA}">Creative Society</text>`,
  );
}
