/**
 * XVARY Service Worker — cache-first for static assets, network-first for data.
 * Enables offline browsing of previously visited pages.
 */
var CACHE_NAME = 'xvary-v1'
var STATIC_ASSETS = [
  '/css/brutalist.css',
  '/css/pulse-page.css',
  '/css/stacks-page.css',
  '/css/home-page.css',
  '/js/vendor/pretext.js',
  '/js/pretext-utils.js',
  '/js/config.js',
  '/js/site-chrome.js',
  '/js/library-summary.js',
  '/js/library-version.js',
  '/js/library-page.js',
  '/js/library-virtual.js',
  '/js/library-loader.js',
  '/js/blog-data.js',
  '/assets/favicon.svg',
  '/assets/xvary-logo.svg'
]

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME })
          .map(function (n) { return caches.delete(n) })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url)

  if (url.pathname.endsWith('.json')) {
    e.respondWith(networkFirst(e.request))
    return
  }

  if (e.request.method === 'GET' && url.origin === self.location.origin) {
    e.respondWith(cacheFirst(e.request))
    return
  }
})

function cacheFirst(req) {
  return caches.match(req).then(function (cached) {
    if (cached) return cached
    return fetch(req).then(function (res) {
      if (res.ok) {
        var clone = res.clone()
        caches.open(CACHE_NAME).then(function (c) { c.put(req, clone) })
      }
      return res
    })
  }).catch(function () {
    return new Response('Offline', { status: 503, statusText: 'Offline' })
  })
}

function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res.ok) {
      var clone = res.clone()
      caches.open(CACHE_NAME).then(function (c) { c.put(req, clone) })
    }
    return res
  }).catch(function () {
    return caches.match(req).then(function (cached) {
      return cached || new Response('{}', { headers: { 'Content-Type': 'application/json' } })
    })
  })
}
