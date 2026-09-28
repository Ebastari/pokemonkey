/**
 * Notifikasi terjadwal POKEMONKEY — 07.00 PICA · 12.00 Info · 17.00 XP (WITA).
 *
 * Isinya selalu dihitung server (GET /api/notif/ringkas, disusun
 * server/src/ringkasan.ts). Yang berbeda hanya siapa yang membunyikannya:
 *
 * - **APK Android** → Background Runner (runner/index.ts), pola Smart Nursery.
 *   WebView berhenti begitu aplikasi ditutup, jadi penjadwalnya hidup di runner.
 *   Berkas ini hanya menitipkan alamat server, token, jam, dan saklar slot, serta
 *   meminta izin notifikasi Android 13+.
 * - **iPhone (dipasang di Layar Utama) & browser** → Web Push. Cron Worker yang
 *   mengirim; berkas ini mendaftarkan public/sw.js dan menyimpan langganannya.
 * - **Mode demo** → tidak ada server, jadi contoh ditampilkan langsung sebagai
 *   notifikasi browser.
 *
 * Plugin Capacitor diambil lewat `registerPlugin`, bukan dengan mengimpor
 * paketnya: versi web tidak ikut membawa kode Android dan tetap berjalan walau
 * paket native belum terpasang. Paket npm-nya tetap wajib untuk `npx cap sync`.
 */

import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api, ambilServer, ambilToken, demoAktif } from './api';
import type { NotifSiap, Slot } from '../server/src/ringkasan';

export type { NotifSiap, Slot };

/**
 * Harus sama dengan `plugins.BackgroundRunner.label` di capacitor.config.ts.
 * Label itu juga nama penyimpanan CapacitorKV runner; menggantinya berarti
 * melupakan token dan catatan jadwal yang sudah dititipkan.
 */
export const LABEL_RUNNER = 'id.ebl.pokemonkey.notifikasi';

export const SEMUA_SLOT: Slot[] = ['pagi', 'siang', 'sore'];
/** Saklar tambahan di luar tiga slot harian: pengingat acara kalender. */
export type SaklarNotif = Record<string, boolean>;
export const JAM_BAWAAN: Record<Slot, string> = { pagi: '07:00', siang: '12:00', sore: '17:00' };

const KUNCI_SLOT = 'pokemonkey_notif_slot';

/**
 * Batas tunggu jawaban runner. dispatchEvent bisa tidak pernah selesai saat
 * aplikasi sedang di depan layar; titipan konfigurasi ikut dalam jalur login dan
 * logout, jadi janji yang menggantung berarti layar yang membeku.
 */
const BATAS_TUNGGU_RUNNER_MS = 5000;

// -- Plugin native (hanya bentuk yang dipakai) --

interface PluginRunner {
  dispatchEvent<T = void>(opsi: { label: string; event: string; details: Record<string, unknown> }): Promise<T>;
  checkPermissions(): Promise<{ notifications?: string }>;
  requestPermissions(opsi: { apis: string[] }): Promise<{ notifications?: string }>;
}

interface PluginApp {
  addListener(nama: 'appStateChange', penangan: (s: { isActive: boolean }) => void): Promise<{ remove: () => Promise<void> }>;
}

interface PluginWidgetBridge {
  bukaPengaturanNotifikasi?(): Promise<void>;
  bukaPengaturanBaterai?(): Promise<void>;
}

const BackgroundRunner = registerPlugin<PluginRunner>('BackgroundRunner');
const AplikasiNative = registerPlugin<PluginApp>('App');
const WidgetBridge = registerPlugin<PluginWidgetBridge>('WidgetBridge');

export async function bukaSetelanNotifikasiHp(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await WidgetBridge.bukaPengaturanNotifikasi?.();
    } catch (e) {
      console.warn('Gagal membuka setelan notifikasi', e);
    }
  }
}

export async function bukaSetelanBateraiHp(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await WidgetBridge.bukaPengaturanBaterai?.();
    } catch (e) {
      console.warn('Gagal membuka setelan baterai', e);
    }
  }
}

// -- Jalur --

export type Jalur = 'native' | 'push' | 'browser' | 'tidak-ada';

export function jalurNotifikasi(): Jalur {
  if (Capacitor.isNativePlatform()) return 'native';
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'tidak-ada';
  if (!demoAktif() && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext) return 'push';
  return 'browser';
}

/** iPhone/iPad di Safari biasa: Web Push baru ada setelah dipasang ke Layar Utama (iOS 16.4+). */
export function perluPasangKeLayarUtama(): boolean {
  if (Capacitor.isNativePlatform() || typeof navigator === 'undefined') return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const terpasang = (navigator as Navigator & { standalone?: boolean }).standalone === true
    || Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
  return ios && !terpasang;
}

// -- Jam & saklar per slot --

let jam: Record<Slot, string> = { ...JAM_BAWAAN };

/** Jam diatur Admin di tabel pengaturan server (jam_notif_pagi/siang/sore). */
export const jamDariPengaturan = (p?: Record<string, string>): Record<Slot, string> => ({
  pagi: p?.jam_notif_pagi || JAM_BAWAAN.pagi,
  siang: p?.jam_notif_siang || JAM_BAWAAN.siang,
  sore: p?.jam_notif_sore || JAM_BAWAAN.sore,
});

/** Saklar per perangkat: orang boleh mematikan notifikasi siang di HP tanpa mematikannya di laptop. */
export function bacaSlot(): SaklarNotif {
  try {
    return { pagi: true, siang: true, sore: true, acara: true, ...JSON.parse(localStorage.getItem(KUNCI_SLOT) || '{}') };
  } catch {
    return { pagi: true, siang: true, sore: true, acara: true };
  }
}

/** Simpan lalu teruskan ke tempat pengingat benar-benar dijadwalkan (runner atau server). */
export async function simpanSlot(slot: SaklarNotif): Promise<void> {
  try {
    localStorage.setItem(KUNCI_SLOT, JSON.stringify(slot));
  } catch {
    /* penyimpanan ditolak — tetap berlaku untuk sesi ini */
  }
  const jalur = jalurNotifikasi();
  if (jalur === 'native') await dorongKonfigurasi();
  if (jalur === 'push' && Notification.permission === 'granted') await perbaruiLangganan();
}

// -- Izin & Channel --

export type Izin = 'granted' | 'denied' | 'prompt';

const keIzin = (nilai?: string): Izin => (nilai === 'granted' ? 'granted' : nilai === 'denied' ? 'denied' : 'prompt');

let channelSudahDibuat = false;
export async function pastikanChannelNotif(): Promise<void> {
  if (!Capacitor.isNativePlatform() || channelSudahDibuat) return;
  try {
    await LocalNotifications.createChannel({
      id: 'default',
      name: 'Pengingat POKEMONKEY',
      description: 'Pengingat harian dan notifikasi pop-up layar HP',
      importance: 5, // IMPORTANCE_HIGH: banner muncul di atas layar HP (heads-up notification)
      visibility: 1, // VISIBILITY_PUBLIC: muncul di layar kunci
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: 'alarm_channel',
      name: 'Alarm & Pengingat Meeting',
      description: 'Alarm suara dan banner yang muncul di atas layar saat meeting tiba',
      importance: 5, // IMPORTANCE_HIGH: muncul di atas layar (heads-up notification)
      visibility: 1, // VISIBILITY_PUBLIC: muncul di layar kunci
      vibration: true,
    });
    await LocalNotifications.createChannel({
      id: 'harian_channel',
      name: 'Pengingat Harian (PICA, Info, XP)',
      description: 'Notifikasi terjadwal 07.00, 12.00, 17.00 WITA',
      importance: 5, // IMPORTANCE_HIGH
      visibility: 1,
      vibration: true,
    });
    channelSudahDibuat = true;
  } catch (e) {
    console.warn('[notifikasi] gagal membuat channel', e);
  }
}

export async function statusIzin(): Promise<Izin> {
  const jalur = jalurNotifikasi();
  if (jalur === 'tidak-ada') return 'denied';
  if (jalur === 'native') {
    try {
      const res = await LocalNotifications.checkPermissions();
      return keIzin(res.display);
    } catch {
      try {
        return keIzin((await BackgroundRunner.checkPermissions()).notifications);
      } catch {
        return 'prompt';
      }
    }
  }
  return keIzin(Notification.permission === 'default' ? 'prompt' : Notification.permission);
}

/**
 * Minta izin — selalu dari tombol, tidak pernah otomatis saat aplikasi dibuka.
 * Dialog tanpa konteks hampir selalu ditolak, dan penolakan di Android 13 maupun
 * iOS tidak bisa ditanyakan ulang tanpa masuk ke Setelan.
 */
export async function mintaIzin(): Promise<Izin> {
  const jalur = jalurNotifikasi();
  if (jalur === 'tidak-ada') return 'denied';

  if (jalur === 'native') {
    let hasil: Izin = 'denied';
    try {
      const res = await LocalNotifications.requestPermissions();
      hasil = keIzin(res.display);
    } catch {
      try {
        hasil = keIzin((await BackgroundRunner.requestPermissions({ apis: ['notifications'] })).notifications);
      } catch {
        /* tetap ditolak */
      }
    }
    if (hasil === 'granted') {
      await pastikanChannelNotif();
      await dorongKonfigurasi();
    }
    return hasil;
  }

  let hasil: Izin = 'denied';
  try {
    hasil = keIzin(await Notification.requestPermission());
  } catch {
    /* tetap ditolak */
  }
  if (hasil === 'granted' && jalur === 'push') await perbaruiLangganan();
  return hasil;
}

// -- APK Android: titipan ke runner --

async function keRunner<T = void>(event: string, details: Record<string, unknown> = {}): Promise<T | null> {
  if (jalurNotifikasi() !== 'native') return null;
  try {
    return await Promise.race([
      BackgroundRunner.dispatchEvent<T>({ label: LABEL_RUNNER, event, details }),
      new Promise<null>((selesai) => setTimeout(() => selesai(null), BATAS_TUNGGU_RUNNER_MS)),
    ]);
  } catch (galat) {
    // APK lama tanpa runner tidak boleh menjatuhkan layar mana pun.
    console.warn('[notifikasi] runner tidak menjawab', event, galat);
    return null;
  }
}

/** Titipkan alamat server, token sesi, jam, dan saklar slot ke runner. */
export async function dorongKonfigurasi(): Promise<void> {
  const token = ambilToken();
  if (jalurNotifikasi() !== 'native' || !token || demoAktif()) return;
  await keRunner('simpanKonfigurasi', { base: ambilServer(), token, jam, slot: bacaSlot() });
}

export interface Diagnosa {
  terakhirPeriksa: number;
  terakhirKirim: number;
  tanggal: string;
  slot: Partial<Record<Slot, 'terjadwal' | 'selesai'>>;
  punyaKonfigurasi: boolean;
}

export const ambilDiagnosa = (): Promise<Diagnosa | null> => keRunner<Diagnosa>('ambilDiagnosa');

// -- iPhone & browser: Web Push --

let pendaftaranSw: Promise<ServiceWorkerRegistration | null> | null = null;

/** public/sw.js hanya menangani push & ketukan notifikasi; halaman tidak di-cache. Dilewati di APK. */
export function daftarkanServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (pendaftaranSw) return pendaftaranSw;
  pendaftaranSw = (async () => {
    if (Capacitor.isNativePlatform() || typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !window.isSecureContext) {
      return null;
    }
    try {
      return await navigator.serviceWorker.register('/sw.js');
    } catch (galat) {
      console.warn('[notifikasi] service worker gagal didaftarkan', galat);
      return null;
    }
  })();
  return pendaftaranSw;
}

const bitDariBase64Url = (teks: string): Uint8Array => {
  const b64 = (teks + '='.repeat((4 - (teks.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const samaBit = (a: ArrayBuffer | null, b: Uint8Array): boolean => {
  if (!a || a.byteLength !== b.length) return false;
  const x = new Uint8Array(a);
  return x.every((v, i) => v === b[i]);
};

export type HasilLangganan = 'aktif' | 'server-belum-siap' | 'tanpa-izin' | 'tidak-didukung' | 'gagal';

export const PESAN_LANGGANAN: Record<HasilLangganan, string> = {
  aktif: 'Perangkat ini terdaftar. Pengingat datang walau aplikasi ditutup.',
  'server-belum-siap': 'Server belum memasang kunci VAPID, jadi pengingat terjadwal belum bisa dikirim ke perangkat ini.',
  'tanpa-izin': 'Izinkan notifikasi terlebih dahulu.',
  'tidak-didukung': 'Browser ini tidak mendukung Web Push.',
  gagal: 'Pendaftaran perangkat gagal. Periksa sinyal, lalu ketuk Periksa sekarang.',
};

/**
 * Pastikan perangkat berlangganan dan server mengetahuinya. Dipanggil setiap
 * aplikasi dibuka: endpoint dari Apple/Google bisa berganti tanpa pemberitahuan,
 * dan service worker tidak bisa mendaftar ulang sendiri karena tidak memegang token.
 */
export async function perbaruiLangganan(): Promise<HasilLangganan> {
  if (jalurNotifikasi() !== 'push') return 'tidak-didukung';
  if (Notification.permission !== 'granted') return 'tanpa-izin';
  const reg = await daftarkanServiceWorker();
  if (!reg) return 'tidak-didukung';

  try {
    const { publicKey, aktif } = await api<{ publicKey: string | null; aktif: boolean }>('/api/push/vapid');
    if (!aktif || !publicKey) return 'server-belum-siap';

    const kunci = bitDariBase64Url(publicKey);
    await navigator.serviceWorker.ready;
    let langganan = await reg.pushManager.getSubscription();
    // Kunci server diganti → langganan lama tidak akan pernah diterima lagi.
    if (langganan && !samaBit(langganan.options.applicationServerKey, kunci)) {
      await langganan.unsubscribe();
      langganan = null;
    }
    langganan ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunci.buffer as ArrayBuffer });

    const j = langganan.toJSON();
    const ua = navigator.userAgent;
    await api('/api/push/langganan', {
      body: {
        endpoint: j.endpoint,
        keys: j.keys,
        platform: /iPhone|iPad|iPod/.test(ua) ? 'ios' : /Android/.test(ua) ? 'android-web' : 'web',
        slot: bacaSlot(),
      },
    });
    return 'aktif';
  } catch (galat) {
    console.warn('[notifikasi] langganan push gagal', galat);
    return 'gagal';
  }
}

async function hentikanLangganan(): Promise<void> {
  if (jalurNotifikasi() !== 'push') return;
  const reg = await daftarkanServiceWorker();
  const langganan = await reg?.pushManager.getSubscription();
  if (!langganan) return;
  await api('/api/push/langganan', { method: 'DELETE', body: { endpoint: langganan.endpoint } }).catch(() => undefined);
  await langganan.unsubscribe().catch(() => false);
}

/** Notifikasi yang diketuk saat aplikasi sudah terbuka: service worker meminta pindah tab. */
export function dengarBukaTab(penangan: (tab: string) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => undefined;
  const tangani = (e: MessageEvent) => {
    if (e.data?.tipe === 'pokemonkey:buka-tab' && typeof e.data.tab === 'string') penangan(e.data.tab);
  };
  navigator.serviceWorker.addEventListener('message', tangani);
  return () => navigator.serviceWorker.removeEventListener('message', tangani);
}

// -- Contoh & pemeriksaan --

async function tampilkanLokal(judul: string, isi: string, tag: string, tab: string): Promise<boolean> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
  const opsi: NotificationOptions = { body: isi, tag: `pokemonkey-${tag}`, icon: '/ikon.svg', data: { tab } };
  try {
    // Chrome Android menolak `new Notification`; lewat service worker bila ada.
    const reg = await daftarkanServiceWorker();
    if (reg) {
      await reg.showNotification(judul, opsi);
      return true;
    }
    const kotak = new Notification(judul, opsi);
    kotak.onclick = () => {
      window.focus();
      kotak.close();
    };
    return true;
  } catch (galat) {
    console.warn('[notifikasi] gagal menampilkan', galat);
    return false;
  }
}

export const ID_SLOT: Record<Slot, number> = { pagi: 4101, siang: 4102, sore: 4103 };

/** Satu notifikasi contoh — cara tercepat membuktikan izin dan jalurnya benar. */
export async function kirimContoh(): Promise<{ ok: boolean; pesan: string }> {
  const jalur = jalurNotifikasi();
  if (jalur === 'tidak-ada') return { ok: false, pesan: 'Perangkat ini belum bisa menerima notifikasi.' };
  if ((await statusIzin()) !== 'granted') return { ok: false, pesan: 'Izinkan notifikasi terlebih dahulu.' };

  if (jalur === 'native') {
    try {
      await pastikanChannelNotif();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 4199,
            title: '🔔 Notifikasi POKEMONKEY Aktif',
            body: 'Pengingat harian: 07.00 PICA · 12.00 Info · 17.00 XP (WITA). Notifikasi ini muncul di layar HP Anda!',
            channelId: 'harian_channel',
            schedule: { at: new Date(Date.now() + 100) },
            foreground: true,
            isExactNotification: false,
            autoCancel: true,
          },
        ],
      });
      await keRunner('notifikasiUji').catch(() => undefined);
      return { ok: true, pesan: 'Notifikasi berhasil dimunculkan di layar HP!' };
    } catch (e) {
      console.warn('Gagal memunculkan notifikasi native di layar HP', e);
      return { ok: false, pesan: 'Gagal memunculkan notifikasi di layar HP.' };
    }
  }

  if (jalur === 'push' && (await perbaruiLangganan()) === 'aktif') {
    try {
      await api('/api/push/uji', { method: 'POST', body: {} });
      return { ok: true, pesan: 'Contoh dikirim lewat server.' };
    } catch (e) {
      return { ok: false, pesan: e instanceof Error ? e.message : 'Gagal mengirim contoh.' };
    }
  }

  const ok = await tampilkanLokal('Notifikasi POKEMONKEY aktif', 'Pengingat datang pukul 07.00, 12.00, dan 17.00 WITA.', 'uji', 'habitat');
  return { ok, pesan: ok ? 'Contoh ditampilkan.' : 'Gagal menampilkan contoh.' };
}

/** Tampilkan isi satu slot sekarang juga, persis seperti yang akan muncul di jamnya. */
export async function tampilkanSlot(n: NotifSiap): Promise<boolean> {
  if ((await statusIzin()) !== 'granted') return false;
  if (jalurNotifikasi() === 'native') {
    try {
      await pastikanChannelNotif();
      await LocalNotifications.schedule({
        notifications: [
          {
            id: ID_SLOT[n.slot] || 4101,
            title: n.judul,
            body: n.isi,
            channelId: 'harian_channel',
            schedule: { at: new Date(Date.now() + 100) },
            foreground: true,
            isExactNotification: false,
            autoCancel: true,
            extra: { tab: n.tab, slot: n.slot },
          },
        ],
      });
      return true;
    } catch (e) {
      console.warn('Gagal tampilkan slot native di layar HP', e);
      return false;
    }
  }
  return tampilkanLokal(n.judul, n.isi, n.slot, n.tab);
}

/**
 * Jalankan satu putaran penjadwal sekarang (APK). WorkManager tidak menerima
 * jadwal di bawah 15 menit; tanpa tombol ini tidak ada cara cepat membedakan
 * izin yang salah, token yang basi, atau memang belum waktunya.
 */
export async function periksaSekarang(): Promise<void> {
  if (jalurNotifikasi() !== 'native') return;
  await dorongKonfigurasi();
  await keRunner('periksaJadwal');
}

// -- Daur hidup --

let lepasAppState: (() => void) | null = null;
/** Penanda pemanggilan: StrictMode bisa memanggil mulaiNotifikasi dua kali berurutan. */
let generasi = 0;

/** Dipanggil App setiap sesi dimuat. Aman dipanggil berulang. */
export async function mulaiNotifikasi(pengaturan?: Record<string, string>): Promise<void> {
  hentikanNotifikasi();
  jam = jamDariPengaturan(pengaturan);
  const milikku = generasi;
  const jalur = jalurNotifikasi();

  if (jalur === 'native') {
    await dorongKonfigurasi();
    if (milikku !== generasi) return;
    try {
      const langganan = await AplikasiNative.addListener('appStateChange', ({ isActive }) => {
        // Token bisa berganti selagi aplikasi tertidur; titip ulang setiap kembali ke layar.
        if (isActive) void dorongKonfigurasi();
      });
      if (milikku !== generasi) {
        void langganan.remove();
        return;
      }
      lepasAppState = () => void langganan.remove();
    } catch {
      /* @capacitor/app belum terpasang: titipan tetap diperbarui setiap aplikasi dibuka */
    }
    return;
  }

  if (jalur === 'push' && Notification.permission === 'granted') void perbaruiLangganan();
}

export function hentikanNotifikasi(): void {
  generasi += 1;
  if (lepasAppState) {
    lepasAppState();
    lepasAppState = null;
  }
}

/**
 * Hapus jejak saat keluar akun. Token yang tertinggal di runner atau langganan
 * yang tertinggal di server akan terus mengirim pengingat atas nama orang yang
 * sudah keluar ke HP orang berikutnya.
 */
export async function lupakanSesiNotifikasi(): Promise<void> {
  hentikanNotifikasi();
  await keRunner('lupakanSesi');
  await hentikanLangganan().catch(() => undefined);
}

/** Menangani ketukan notifikasi baik di native (LocalNotifications) maupun di web (Service Worker) */
export function dengarKetukanNotifikasi(penangan: (tab: string) => void): () => void {
  const lepasSw = dengarBukaTab(penangan);
  let lepasNative: (() => void) | null = null;

  if (Capacitor.isNativePlatform()) {
    void LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      const tab = notification.notification.extra?.tab;
      if (typeof tab === 'string') penangan(tab);
    }).then((h) => {
      lepasNative = () => void h.remove();
    });
  }

  return () => {
    lepasSw();
    if (lepasNative) lepasNative();
  };
}
