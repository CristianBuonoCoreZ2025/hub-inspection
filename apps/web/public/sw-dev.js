// Service worker para desarrollo.
// Estrategia: NO cachea assets de Next.js (/_next/*) para que HMR y Turbopack
// siempre sirvan código fresco. Solo cachea offline.html para modo offline.
const CACHE = "dev-cache-v6";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(["/offline.html"]).catch(() => {})
    )
  );
  self.skipWaiting();
});

// Permitir que la página fuerce la activación inmediata
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", (event) => {
  // Borrar TODOS los caches viejos (incluido dev-cache-v5 y anteriores)
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo GET
  if (req.method !== "GET") return;

  // Ignorar HMR de Next.js
  if (url.pathname.startsWith("/_next/webpack-hmr") || url.pathname.includes("hot-update")) {
    return;
  }

  // Ignorar dominios externos (Supabase, R2, Mapbox, etc.)
  if (url.origin !== self.location.origin) return;

  // ── NO interceptar assets de Next.js en desarrollo ──
  // Dejar que Turbopack/Webpack manejen sus propios chunks sin caché del SW.
  // Esto evita que el SW sirva chunks viejos cuando el código cambia.
  if (url.pathname.startsWith("/_next/")) {
    return; // El navegador hace el fetch normal, sin pasar por el SW
  }

  // Navegaciones (HTML) — network-first, fallback a cache
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached;
            return caches.match("/offline.html").then((o) =>
              o || new Response(
                '<html><body><h1>Sin conexión</h1><p>Revisa tu conexión.</p></body></html>',
                { headers: { "Content-Type": "text/html" } }
              )
            );
          })
        )
    );
    return;
  }

  // API GET y otros recursos locales — network-first (no stale-while-revalidate)
  // En desarrollo siempre queremos datos frescos.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Response.error()))
  );
});
