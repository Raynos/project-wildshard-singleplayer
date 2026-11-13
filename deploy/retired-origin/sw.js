// Kill switch for a retired origin (wildshard-singleplayer.vercel.app).
//
// Until 2026-10 this origin served the game, and the game's service worker
// (scope '/', script '/sw.js') kept the page and its code in Cache Storage
// and served them cache-first. When the origin went away, a phone that had
// it installed kept booting that cached October build, which then failed
// fetching rapier.wasm (WILDSHARD-GAME-8C / 8D, 2026-11-13). The old worker
// re-fetches '/sw.js' on every boot, so this file replaces it: it takes
// over at once, deletes the game's caches, unregisters itself and sends
// every open window to play.wildshard.io. Player saves (localStorage) are
// not touched. Safe to delete once no device has run it for a long while.
const TO = 'https://play.wildshard.io/';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try { await self.clients.claim(); } catch { /* keep going */ }
    try {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('ws-')).map((n) => caches.delete(n)));
    } catch { /* keep going */ }
    // navigate first: it needs the window still controlled by this worker
    try {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(windows.map((w) => Promise.resolve().then(() => w.navigate(TO)).catch(() => undefined)));
    } catch { /* an old WebKit without navigate: the next launch gets index.html, which redirects */ }
    try { await self.registration.unregister(); } catch { /* keep going */ }
  })());
});
