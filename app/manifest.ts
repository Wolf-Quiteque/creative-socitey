import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Creative Society — Gestão",
    short_name: "CS Gestão",
    description: "Vendas, stock, finanças e equipa das lojas Creative Society.",
    lang: "pt-AO",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#fbf7f2",
    theme_color: "#fbf7f2",
    categories: ["business", "productivity", "finance"],
    prefer_related_applications: false,
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Vender", short_name: "Vender", description: "Abrir o ponto de venda", url: "/vender", icons: [{ src: "/icons/shortcut-vender.png", sizes: "96x96", type: "image/png" }] },
      { name: "Stock", short_name: "Stock", description: "Ver o stock da loja", url: "/stock", icons: [{ src: "/icons/shortcut-stock.png", sizes: "96x96", type: "image/png" }] },
      { name: "Meu horário", short_name: "Horário", description: "Os meus turnos", url: "/meu-horario", icons: [{ src: "/icons/shortcut-horario.png", sizes: "96x96", type: "image/png" }] },
      { name: "Finanças", short_name: "Finanças", description: "Entradas e saídas", url: "/financas", icons: [{ src: "/icons/shortcut-financas.png", sizes: "96x96", type: "image/png" }] },
    ],
    screenshots: [
      { src: "/screenshots/telemovel-inicio.webp", sizes: "390x844", type: "image/webp", form_factor: "narrow", label: "Vendas do dia ao vivo" },
      { src: "/screenshots/telemovel-vender.webp", sizes: "390x844", type: "image/webp", form_factor: "narrow", label: "Ponto de venda no telemóvel" },
      { src: "/screenshots/computador-inicio.webp", sizes: "1440x900", type: "image/webp", form_factor: "wide", label: "Painel de todas as lojas" },
      { src: "/screenshots/computador-relatorios.webp", sizes: "1440x900", type: "image/webp", form_factor: "wide", label: "Lucros e relatórios" },
    ],
  };
}
