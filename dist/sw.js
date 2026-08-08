// Service worker v3 — solo cachea assets locales; las APIs externas (Supabase) pasan directo a red.
const CACHE_NAME = "diamantina-v3";
const STATIC_ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => undefined)
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // No interceptar peticiones cross-origin (Supabase REST, Realtime, Auth, etc.)
  if (url.origin !== self.location.origin) return;

  // Network-first para el HTML principal y módulos JS (siempre la versión más nueva)
  if (
    event.request.mode === "navigate" ||
    event.request.destination === "script" ||
    event.request.destination === "style" ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/@")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((c) => c || new Response("Offline", { status: 503 })))
    );
    return;
  }

  // Cache-first solo para assets estáticos del mismo origen
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached ?? new Response("Offline", { status: 503 }));
    })
  );
});
