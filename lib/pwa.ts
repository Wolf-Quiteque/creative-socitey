// Ecrãs de arranque do iOS: [largura, altura, densidade] em pontos (gerados por scripts/pwa-assets.mjs)
const SPLASH: [number, number, number][] = [
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

export const IOS_STARTUP_IMAGES = SPLASH.map(([w, h, r]) => ({
  url: `/splash/splash-${w * r}x${h * r}.png`,
  media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
}));

/** Guarda o evento de instalação o mais cedo possível (antes do React arrancar) */
export const CAPTURE_INSTALL_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__bip=e;window.dispatchEvent(new Event("cs:bip"))});window.addEventListener("appinstalled",function(){window.__bip=null;window.dispatchEvent(new Event("cs:bip"))});`;
