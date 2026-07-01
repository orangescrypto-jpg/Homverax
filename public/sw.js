/// <reference lib="webworker" />
const sw = self;

const CACHE_VERSION = "homverax-v2";
const STATIC_ASSETS = [
  "/",
  "/listings",
  "/find-property",
  "/manifest.json",
  "/favicon.ico",
  "/icon-192.png",
  "/icon-512.png",
];

// ── Install — cache static shell ──────────────────────────────────────────────
sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => sw.skipWaiting())
  );
});

// ── Activate — clean old caches ───────────────────────────────────────────────
sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => sw.clients.claim())
  );
});

// ── Fetch strategy ────────────────────────────────────────────────────────────
sw.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Never cache: API calls, Firebase, payment providers, auth
  const skipCache =
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("paystack") ||
    url.hostname.includes("flutterwave") ||
    url.hostname.includes("firebaseio") ||
    url.hostname.includes("cloudfunctions");

  if (skipCache) return;

  // Static assets (images, fonts, JS, CSS) — cache first
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.startsWith("/favicon") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|woff2?|ttf|otf)$/);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML pages — stale-while-revalidate
  // Serve from cache immediately, update cache in background
  if (
    event.request.headers.get("accept")?.includes("text/html") ||
    url.pathname === "/" ||
    url.pathname.startsWith("/listings") ||
    url.pathname.startsWith("/find-property") ||
    url.pathname.startsWith("/blog")
  ) {
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached ?? Response.error());

          // Return cached immediately if available, else wait for network
          return cached ?? fetchPromise;
        })
      )
    );
    return;
  }

  // Everything else — network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached ?? Response.error())
      )
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────
sw.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    sw.registration.showNotification(data.title ?? "HomveraX", {
      body:    data.body ?? "",
      icon:    data.icon  ?? "/icon-192.png",
      badge:   "/icon-192.png",
      tag:     data.tag   ?? "homverax-notification",
      vibrate: [200, 100, 200],
      data:    { url: data.url ?? "/" },
      actions: data.actions ?? [],
    })
  );
});

// ── Notification click — focus existing window or open new ───────────────────
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data?.url) ?? "/";

  event.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus existing tab at target URL if one is open
        const existing = clients.find(
          (c) => c.url === targetUrl || c.url.startsWith(targetUrl)
        );
        if (existing) return existing.focus();
        // Otherwise open a new window
        return sw.clients.openWindow(targetUrl);
      })
  );
});

// ── Background sync (future use) ─────────────────────────────────────────────
sw.addEventListener("sync", (event) => {
  // Reserved for offline form submissions (e.g. message drafts)
  console.log("[HomveraX SW] Background sync:", event.tag);
});
