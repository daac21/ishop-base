// Solo guarda los archivos de la app. Firebase tiene su propia caché; aquí no se toca.
const C = "ishop-base-v1";
const A = ["./index.html","./css/style.css","./js/app.js","./js/db.js","./js/firebase-config.js","./manifest.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(A))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;            // Firebase y CDN: directo a la red
  e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
