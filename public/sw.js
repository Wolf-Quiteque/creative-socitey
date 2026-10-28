/* Service worker da Creative Society.
 *
 * Regras (pensadas para aparelhos partilhados e dados privados):
 * - Páginas e /api nunca ficam em cache: vêm sempre da rede, com os dados de quem está ligado.
 * - Ficheiros estáticos com hash (/_next/static), ícones e fontes ficam em cache: a app abre rápido.
 * - Sem rede, uma navegação mostra /offline.html em vez do erro do browser.
 * - Pedidos que não são GET (Server Actions, envios) passam sempre direto à rede.
 */
const VERSION = "cs-v1";
const STATIC = `${VERSION}-static`;
const ASSETS = `${VERSION}-assets`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png", "/icon.svg"];
const MAX_ASSETS = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const isAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname.startsWith("/splash/") ||
  url.pathname.startsWith("/screenshots/") ||
  url.pathname === "/icon.svg" ||
  url.pathname === "/apple-icon.png";

async function trim(cacheName) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Ficheiros estáticos: cache primeiro (têm hash no nome, nunca mudam)
  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") {
          const copy = res.clone();
          caches.open(ASSETS).then((c) => c.put(req, copy).then(() => trim(ASSETS)));
        }
        return res;
      })(),
    );
    return;
  }

  // Navegações: sempre da rede; sem rede, página "sem ligação"
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          return await fetch(req);
        } catch {
          return (await caches.match("/offline.html", { cacheName: STATIC })) || Response.error();
        }
      })(),
    );
  }
  // Tudo o resto (dados, /api, RSC) vai direto à rede, sem cache.
});
