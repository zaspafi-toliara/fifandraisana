/* ZA SPaFi Toliara – service worker
   Keeps the site's own files on the phone so the entry app opens offline.
   Network first (always the latest version when online), cache as fallback.
   Requests to Google (Apps Script, fonts) are not touched. */
const CACHE = "zaspafi-v9";
const SHELL = [
  "fampidirana.html", "karatra.html", "mpikambana.html", "index.html",
  "assets/css/style.css",
  "assets/js/config.js", "assets/js/content.js", "assets/js/app.js",
  "assets/js/entry.js", "assets/js/cards.js", "assets/js/members.js",
  "assets/vendor/html5-qrcode.min.js", "assets/vendor/qrcode.js",
  "assets/img/logo-192.png", "assets/img/favicon.png",
  "i18n/strings.csv", "manifest.webmanifest", "manifest-mpikambana.webmanifest"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
