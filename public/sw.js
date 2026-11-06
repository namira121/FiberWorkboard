/* Service worker minimal: syarat supaya "Tambah ke Layar Utama" jadi aplikasi (standalone).
   Sengaja TIDAK menyimpan halaman di cache, supaya status login & data selalu dari server. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* biarkan jaringan yang menjawab */ });
