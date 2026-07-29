// Minimal service worker. This app needs a live connection to be useful
// (shared, real-time data across the team), so it deliberately does NOT
// cache pages or API responses. Its only job is satisfying Android/Chrome's
// installability check, which historically wants a service worker present.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(
      () => new Response("You're offline. This app needs a connection to work.", { status: 503 })
    )
  );
});
