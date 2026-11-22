const V = "manna-v1";
const PRE = ["/", "/invoice", "/items.json", "/sql-wasm.wasm", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(V).then((c) => Promise.allSettled(PRE.map((u) => c.add(u)))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (r, res) => { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); };

self.addEventListener("fetch", (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;

  // Network-first: pages and the item list (so edits to items.json reach clients)
  if (r.mode === "navigate" || u.pathname === "/items.json") {
    e.respondWith(
      fetch(r)
        .then((res) => { if (res.ok) put(r, res); return res; })
        .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match("/")))
    );
    return;
  }
  // Cache-first: static assets
  e.respondWith(
    caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) put(r, res); return res; }))
  );
});
