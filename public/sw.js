// Arth app-shell cache, so the app can be reopened with no connection.
// - It only stores the app's own files (the page and the hashed /assets). It never touches the network calls to the
//   cloud (they are cross-origin), never handles non-GET requests, and never stores anything the person entered.
// - The page itself is network first: whenever there is a connection the newest deployment is used and re-cached.
//   Offline, the last cached copy is used.
// - To stop using it, deploy a build that no longer registers it; unregistering is also possible from the browser.
const CACHE = "arth-shell-v1";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch("/", { cache: "reload" });
    const html = await res.clone().text();
    await cache.put("/", res);
    // Everything the page loads from its own origin (hashed scripts and styles, icons).
    const urls = new Set();
    for (const m of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g)) urls.add(m[1]);
    await Promise.all([...urls].map(u => fetch(u, { cache: "reload" }).then(r => r.ok ? cache.put(u, r) : null).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(CACHE)).put("/", res.clone());
        return res;
      } catch {
        const cached = await caches.match("/", { ignoreSearch: true });
        return cached || Response.error();
      }
    })());
    return;
  }
  if (url.pathname.startsWith("/assets/") || url.pathname === "/favicon.svg" || url.pathname === "/icons.svg") {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })());
  }
});
