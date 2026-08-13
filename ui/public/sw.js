/* Service worker de asis.chat: shell offline mínimo + notificaciones push.
 * App realtime: nunca cachear /api, socket.io ni datos; solo el fallback offline. */

/* Bumpear al cambiar cualquier archivo de PRECACHE: el handler de activate
 * borra las caches "asis-shell-*" que no sean esta, y es la unica forma de que
 * una PWA ya instalada deje de servir el icono viejo.
 *
 * El prefijo "asis-shell-" no se toca nunca: el filtro de activate borra POR
 * PREFIJO, asi que renombrarlo dejaria la cache vieja huerfana para siempre y
 * las PWA ya instaladas seguirian sirviendo el icono viejo sin forma de
 * limpiarlas. Si alguna vez hay que cambiarlo, primero hay que agregar el
 * prefijo viejo al filtro y recien despues renombrar. */
const SHELL_CACHE = "asis-shell-v15";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/badge-72.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("asis-shell-") && key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  // Solo navegaciones: si no hay red, mostrar el fallback offline.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "asis.chat", body: event.data.text() };
  }

  event.waitUntil(
    (async () => {
      // Con la app enfocada, la UI (socket + badges) ya avisa: no duplicar.
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clients.some((client) => client.focused)) return;

      await self.registration.showNotification(data.title || "asis.chat", {
        body: data.body || "",
        icon: data.icon || "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        tag: data.tag || undefined,
        data: { url: data.url || "/conversations" },
        vibrate: [100, 50, 100],
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/conversations";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
