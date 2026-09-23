/**
 * Service worker POKEMONKEY — hanya untuk notifikasi.
 *
 * Tidak ada `fetch` handler dan tidak ada cache: halaman selalu diambil segar
 * dari server, jadi pembaruan aplikasi tidak pernah tertahan versi lama.
 *
 * Isi push dikirim server/src/push.ts sebagai JSON:
 *   { judul, isi, tab, slot }   slot = pagi | siang | sore | uji
 *
 * Tidak menangani `pushsubscriptionchange`: service worker tidak memegang token
 * sesi, jadi pendaftaran ulang dilakukan aplikasi setiap kali dibuka
 * (lib/notifikasi.ts → perbaruiLangganan).
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { isi: event.data ? event.data.text() : '' };
  }

  const judul = data.judul || 'POKEMONKEY';
  event.waitUntil(
    self.registration.showNotification(judul, {
      body: data.isi || '',
      // Satu tag per slot: pengingat pagi yang datang lagi menimpa, bukan menumpuk.
      tag: `pokemonkey-${data.slot || 'umum'}`,
      renotify: true,
      icon: '/ikon.svg',
      badge: '/ikon.svg',
      data: { tab: data.tab || 'habitat' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const tab = (event.notification.data && event.notification.data.tab) || 'habitat';

  event.waitUntil(
    (async () => {
      const jendela = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const klien of jendela) {
        if (new URL(klien.url).origin === self.location.origin) {
          klien.postMessage({ tipe: 'pokemonkey:buka-tab', tab });
          return klien.focus();
        }
      }
      return self.clients.openWindow(`/?tab=${encodeURIComponent(tab)}`);
    })(),
  );
});
