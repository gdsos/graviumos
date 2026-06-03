const CACHE_NAME = "gravium-os-cache-v4-no-api-cache";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/favicon-v2.png",
  "/brand/gravium-wordmark-dark.png",
  "/brand/gravium-wordmark-light.png",
  "/brand/gravium-icon-dark.png",
  "/brand/gravium-icon-light.png",
];

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", event => {
  self.clients.claim();

  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      )
    )
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  // Never cache external/API requests such as Supabase.
  // Cached API reads can make live app data disappear after normal refresh.
  if (requestUrl.origin !== self.location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  const acceptsHtml =
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html");

  if (acceptsHtml) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });

          return response;
        })
        .catch(() =>
          caches.match(request).then(cachedResponse =>
            cachedResponse || caches.match("/offline.html")
          )
        )
    );

    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then(response => {
        const responseClone = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });

        return response;
      });
    })
  );
});


self.addEventListener("push", event => {
  let payload = {
    title: "Gravium OS",
    body: "You have a new notification.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: "/portal/overview",
  };

  if (event.data) {
    try {
      payload = {
        ...payload,
        ...event.data.json(),
      };
    } catch (error) {
      payload.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-192.png",
    data: {
      url: payload.url || "/portal/overview",
    },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "Gravium OS", notificationOptions)
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/portal/overview";

  event.waitUntil(
    self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    }).then(clientList => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
