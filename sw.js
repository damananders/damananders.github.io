/* sw.js — service worker for instant repeat visits and a basic offline mode.
 *
 *   Pages (HTML)                    network first, cached copy when offline
 *   config.js, site-config.js,
 *   assets/data/*.json              network first (so downloads, news and settings are never stale)
 *   Everything else on this site    cached copy at once, refreshed in the background for next time
 *   Other sites (Twitch, Discord,
 *   Supabase, GitHub, Drive ...)    never touched
 *
 * Bump VERSION to throw away every cached file. To retire the worker, set features.serviceWorker = false in
 * assets/site-config.js: pages then unregister it on their next visit.
 */
var VERSION = "v1", CACHE = "site-" + VERSION;
var SHELL = ["/", "/assets/fonts/space-grotesk-latin.woff2", "/assets/fonts/inter-latin.woff2", "/assets/fonts/fonts.css", "/assets/icons/icon-192.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL).catch(function () {}); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function put(req, res) {
  if (res && res.ok && res.type === "basic") { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {}); }
  return res;
}
function networkFirst(req) {
  return fetch(req).then(function (res) { return put(req, res); }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit;
      if (req.mode === "navigate") return caches.match("/").then(function (home) {
        return home || new Response("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Offline</title><body style='font:16px system-ui;background:#07090b;color:#eef0f3;display:grid;place-items:center;min-height:100vh;margin:0'><p>You are offline. Try again when the connection is back.</p>", { headers: { "Content-Type": "text/html; charset=utf-8" } });
      });
      return Response.error();
    });
  });
}
function staleWhileRevalidate(req) {
  return caches.match(req).then(function (hit) {
    var fresh = fetch(req).then(function (res) { return put(req, res); }).catch(function () { return hit || Response.error(); });
    return hit || fresh;
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url; try { url = new URL(req.url); } catch (x) { return; }
  if (url.origin !== self.location.origin) return;
  if (req.headers.get("range")) return;                                   /* video seeking: leave to the browser */
  var p = url.pathname;
  if (/\.(mp4|webm|7z|zip|exe)$/i.test(p)) return;
  if (req.mode === "navigate" || /\.html$/.test(p) || /\/$/.test(p)) { e.respondWith(networkFirst(req)); return; }
  if (/\/assets\/(config|site-config)\.js$/.test(p) || /\/assets\/data\//.test(p) || p === "/sw.js") { e.respondWith(networkFirst(req)); return; }
  e.respondWith(staleWhileRevalidate(req));
});
