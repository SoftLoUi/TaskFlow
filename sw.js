
const CACHE_NAME = "taskflow-cache-v1";
const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./assets/icon.svg",
    "./css/styles.css",
    "./js/database.js",
    "./js/notifications.js",
    "./js/sync.js",
    "./js/app.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(FILES_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then(response => {
                if (
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            }).catch(() => {
                if (event.request.mode === "navigate") {
                    return caches.match("./index.html");
                }
                return new Response(
                    "Recurso no disponible sin conexión.",
                    {
                        status: 503,
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8"
                        }
                    }
                );
            });
        })
    );
});

self.addEventListener("sync", event => {
    if (event.tag === "taskflow-sync") {
        event.waitUntil(
            self.clients.matchAll({
                type: "window",
                includeUncontrolled: true
            }).then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: "SYNC_REQUEST"
                    });
                });
            })
        );
    }
});

self.addEventListener("push", event => {
    let data = {
        title: "TaskFlow",
        body: "Tienes un nuevo recordatorio."
    };
    if (event.data) {
        try {
            data = {
                ...data,
                ...event.data.json()
            };
        } catch (error) {
            data.body = event.data.text();
        }
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: "./assets/icon.svg",
            data: {
                url: data.url || "./"
            }
        })
    );
});

self.addEventListener("notificationclick", event => {
    event.notification.close();
    const targetUrl = new URL(
        event.notification.data?.url || "./",
        self.registration.scope
    );
    if (targetUrl.origin !== self.location.origin) return;
    event.waitUntil(
        self.clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(clients => {
            for (const client of clients) {
                if (
                    client.url === targetUrl.href &&
                    "focus" in client
                ) {
                    return client.focus();
                }
            }
            return self.clients.openWindow(targetUrl.href);
        })
    );
});
