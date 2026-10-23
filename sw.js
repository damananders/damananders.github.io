// Retired: the old site's service worker. Anyone who still has it installed gets it removed.
self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(k){ return Promise.all(k.map(function(x){ return caches.delete(x); })); })
    .then(function(){ return self.registration.unregister(); })
    .then(function(){ return self.clients.matchAll(); })
    .then(function(cs){ cs.forEach(function(c){ c.navigate(c.url); }); }));
});
