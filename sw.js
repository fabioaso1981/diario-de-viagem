'use strict';
/* Service worker: guarda o app inteiro para uso 100% offline.
   Ao publicar uma nova versão dos arquivos, aumente VERSION para os aparelhos atualizarem. */
const VERSION = 'v1.1.0';
const CACHE = 'ushuaia-' + VERSION;
const SHELL = [
  './', 'index.html', 'style.css', 'data.js', 'core.js', 'app.js', 'modals.js', 'trips.js', 'ocr.js', 'io.js', 'actions.js', 'boot.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];
/* Leitor de fotos offline (opcional): só entra no cache se os arquivos existirem em vendor/tesseract/ */
const VENDOR = [
  'vendor/tesseract/tesseract.min.js', 'vendor/tesseract/worker.min.js',
  'vendor/tesseract/core/tesseract-core-simd-lstm.wasm.js', 'vendor/tesseract/core/tesseract-core-lstm.wasm.js',
  'vendor/tesseract/lang/eng.traineddata.gz'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' }))));
    await Promise.allSettled(VENDOR.map(u => c.add(new Request(u, { cache: 'reload' }))));
  }));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('ushuaia-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(r, { ignoreSearch: true }).then(hit => hit ||
      fetch(r).catch(() => (r.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
