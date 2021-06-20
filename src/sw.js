const VERSION = '0.2.0';
const CACHE_NAME = `MyCity_v${VERSION}`;

self.addEventListener('install', event => {
  const path = location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1);
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache =>
        cache.addAll([
          `${path}cities.json`,
          `${path}data-manager.js`,
          `${path}favicon.png`,
          `${path}game.js`,
          `${path}index.html`,
          `${path}input.js`,
          `${path}manifest.json`,
          `${path}my-city_192.png`,
          `${path}my-city_192_maskable.png`,
          `${path}my-city_512.png`,
          `${path}my-city_512_maskable.png`,
          `${path}my-city.css`,
          `${path}my-city.js`,
          `${path}serialize.js`,
          `${path}storage.js`,
          `${path}utils.js`
        ])
      )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keyList => Promise.all(keyList.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
});

self.addEventListener('message', ({ data }) => {
  if (data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(
      response =>
        response ||
        fetch(event.request).then(response => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, cloned);
          });
          return response;
        })
    )
  );
});
