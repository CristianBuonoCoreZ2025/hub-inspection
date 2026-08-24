// Service worker para desarrollo.
// Estrategia: cachea todo lo que se carga exitosamente (stale-while-revalidate).
// Cuando offline, sirve desde cache. Cuando online, actualiza en background.
const CACHE = "dev-cache-v5";

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
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE && k.startsWith("dev-")).map((k) => caches.delete(k))
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

  // Navegaciones (HTML)
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
            // Fallback: probar solo el pathname (sin query)
            return caches.match(url.pathname).then((c) =>
              c || caches.match("/offline.html").then((o) =>
                o || new Response(
                  '<html><body><h1>Sin conexión</h1><p>Revisa tu conexión.</p></body></html>',
                  { headers: { "Content-Type": "text/html" } }
                )
              )
            );
          })
        )
    );
    return;
  }

  // Todo lo demás (JS, CSS, imágenes, API GET) — stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached || Response.error());
      // Devolver cache inmediatamente si existe, sino esperar a la red
      return cached || fetchPromise;
    })
  );
});
