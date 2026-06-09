// Service Worker — Gas LPG PWA
// Strategi:
//   • HTML / navigasi (index.html)  → NETWORK-FIRST  (selalu ambil versi terbaru,
//     cache hanya dipakai saat offline). Ini membuat update patch langsung kebaca
//     tanpa user perlu hapus cache.
//   • Aset statis (Leaflet, font)   → CACHE-FIRST     (URL sudah ber-versi).
//   • Firebase                      → selalu network  (tidak di-cache).
//
// Naikkan CACHE_VERSION setiap kali logika SW berubah agar cache lama dibuang.
const CACHE_VERSION = 'v2';
const CACHE_NAME = 'gas-lpg-' + CACHE_VERSION;

const STATIC_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/index.html', '/manifest.json']).catch(() => {})
    )
  );
  // Aktifkan SW baru segera, jangan tunggu tab lama ditutup
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Izinkan halaman memaksa SW baru langsung aktif
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function isHtmlRequest(request) {
  return request.mode === 'navigate' ||
    request.destination === 'document' ||
    (request.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Hanya tangani GET
  if (request.method !== 'GET') return;

  // Firebase / Google API → selalu network, jangan di-cache
  if (url.hostname.includes('firebase') || url.hostname.includes('google') ||
      url.hostname.includes('gstatic') || url.hostname.includes('firestore')) {
    return;
  }

  // ── HTML / navigasi → NETWORK-FIRST ──────────────────────────
  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          // Simpan salinan terbaru untuk fallback offline
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(() =>
          // Offline → pakai cache
          caches.match(request).then((c) => c || caches.match('/index.html'))
        )
    );
    return;
  }

  // ── Aset lain → CACHE-FIRST ──────────────────────────────────
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Gas LPG', {
      body: data.body || '',
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      tag: data.tag || 'gas-lpg',
      data: data.url ? { url: data.url } : {},
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
