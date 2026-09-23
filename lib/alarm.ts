/**
 * Sistem Alarm & Nada Dering POKEMONKEY
 *
 * Mendukung:
 * 1. Alarm otomatis untuk agenda kalender (meeting, kegiatan lapangan, dll.) berdasarkan `jam_mulai` dan `ingatkan_menit`.
 * 2. Pemutaran nada dering bawaan retro 8-bit (Web Audio API synth) tanpa perlu file eksternal.
 * 3. Unggah dan simpan nada dering kustom dari file lokal pengguna (.mp3, .wav, .ogg, .m4a) ke IndexedDB.
 * 4. Pengujian nada dering, penundaan (snooze), dan pematian alarm.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { JadwalItem } from './tipe-api';

const DB_NAME = 'pokemonkey_alarm_db';
const STORE_NAME = 'ringtone_store';
const KEY_RINGTONE = 'custom_ringtone';

export interface InfoNadaDering {
  nama: string;
  tipe: string;
  dataUrl: string;
}

export interface AlarmItem {
  id: string;
  judul: string;
  jamMulai: string;
  menitSebelum: number;
  waktuTargetMs: number;
  keterangan?: string | null;
}

// ---------------------------------------------------------------------------
// 1. Penyimpanan Nada Dering Kustom (IndexedDB)
// ---------------------------------------------------------------------------

function bukaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB tidak didukung'));
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function simpanNadaDeringKustom(file: File): Promise<InfoNadaDering> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const info: InfoNadaDering = {
    nama: file.name,
    tipe: file.type || 'audio/mpeg',
    dataUrl,
  };

  try {
    const db = await bukaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(info, KEY_RINGTONE);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    // Cadangan ke localStorage jika IndexedDB bermasalah
    try {
      localStorage.setItem('pk_ringtone_info', JSON.stringify({ nama: info.nama, tipe: info.tipe }));
      localStorage.setItem('pk_ringtone_data', dataUrl);
    } catch {
      console.warn('Gagal menyimpan ke localStorage cadangan', e);
    }
  }

  return info;
}

export async function ambilNadaDeringKustom(): Promise<InfoNadaDering | null> {
  try {
    const db = await bukaDb();
    const info = await new Promise<InfoNadaDering | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_RINGTONE);
      req.onsuccess = () => resolve((req.result as InfoNadaDering) || null);
      req.onerror = () => reject(req.error);
    });
    if (info) return info;
  } catch {
    // Cek cadangan localStorage
    try {
      const raw = localStorage.getItem('pk_ringtone_info');
      const data = localStorage.getItem('pk_ringtone_data');
      if (raw && data) {
        const parsed = JSON.parse(raw);
        return { nama: parsed.nama, tipe: parsed.tipe, dataUrl: data };
      }
    } catch {
      /* abaikan */
    }
  }
  return null;
}

export async function hapusNadaDeringKustom(): Promise<void> {
  try {
    const db = await bukaDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(KEY_RINGTONE);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* abaikan */
  }
  try {
    localStorage.removeItem('pk_ringtone_info');
    localStorage.removeItem('pk_ringtone_data');
  } catch {
    /* abaikan */
  }
}

// ---------------------------------------------------------------------------
// 2. Mesin Audio (Web Audio API Synthesizer & Audio Element)
// ---------------------------------------------------------------------------

let audioEl: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let synthTimer: ReturnType<typeof setInterval> | null = null;
let sedangBunyi = false;

/** Memainkan melodi arpeggio retro 8-bit menggunakan Web Audio API */
function mulaiRetroSynth(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const nada = [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25]; // C5, E5, G5, C6, G5, E5
    let index = 0;

    const mainkanSatuNada = () => {
      if (!sedangBunyi || !audioCtx || audioCtx.state === 'closed') return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(nada[index % nada.length], audioCtx.currentTime);

      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.19);
      index++;
    };

    mainkanSatuNada();
    synthTimer = setInterval(mainkanSatuNada, 200);
  } catch (e) {
    console.warn('Retro synth gagal', e);
  }
}

function hentikanRetroSynth(): void {
  if (synthTimer) {
    clearInterval(synthTimer);
    synthTimer = null;
  }
  if (audioCtx && audioCtx.state !== 'closed') {
    void audioCtx.close().catch(() => undefined);
    audioCtx = null;
  }
}

/** Mengirim notifikasi alarm native yang muncul langsung di atas layar HP (heads-up banner) */
export async function kirimNotifikasiAlarmHp(alarm: AlarmItem): Promise<void> {
  // 1. Android Native via LocalNotifications (Muncul di layar HP / heads-up notification)
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.createChannel({
        id: 'alarm_channel',
        name: 'Alarm & Pengingat Meeting',
        description: 'Pemberitahuan mendesak untuk agenda kalender & meeting',
        importance: 5, // IMPORTANCE_HIGH: banner muncul di atas layar HP + suara/getar
        visibility: 1, // VISIBILITY_PUBLIC: tampil di lockscreen
        vibration: true,
      });

      const notifId = Math.abs(alarm.id.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0)) % 100000;

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notifId || 9001,
            title: `⏰ ALARM: ${alarm.judul}`,
            body: `Pukul ${alarm.jamMulai} WITA (${alarm.menitSebelum} menit sebelum acara). ${alarm.keterangan ? `"${alarm.keterangan}"` : ''}`.trim(),
            channelId: 'alarm_channel',
            schedule: { at: new Date(Date.now() + 100) },
            foreground: true,
            isExactNotification: false,
            autoCancel: true,
            extra: {
              tab: 'jadwal',
              alarmId: alarm.id,
            },
          },
        ],
      });
      return;
    } catch (e) {
      console.warn('Gagal menampilkan notifikasi alarm native di layar HP', e);
    }
  }

  // 2. Web Browser Fallback
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(`⏰ ALARM: ${alarm.judul}`, {
        body: `Pukul ${alarm.jamMulai} WITA (${alarm.menitSebelum} menit sebelum acara). ${alarm.keterangan || ''}`.trim(),
        icon: '/ikon.svg',
        tag: `alarm-${alarm.id}`,
      });
    } catch (e) {
      console.warn('Gagal menampilkan notifikasi alarm di browser', e);
    }
  }
}

/** Membunyikan alarm (nada kustom atau bawaan retro) dan memunculkan notifikasi di layar HP */
export async function bunyikanAlarm(alarm?: AlarmItem): Promise<void> {
  hentikanAlarm();
  sedangBunyi = true;

  if (alarm) {
    void kirimNotifikasiAlarmHp(alarm);
  }

  const kustom = await ambilNadaDeringKustom();
  if (kustom?.dataUrl) {
    try {
      audioEl = new Audio(kustom.dataUrl);
      audioEl.loop = true;
      audioEl.volume = 1.0;
      await audioEl.play();
      return;
    } catch (e) {
      console.warn('Gagal memutar audio kustom, beralih ke retro synth', e);
    }
  }

  // Bawaan: Retro synth
  mulaiRetroSynth();
}

/** Menghentikan suara alarm yang sedang berbunyi */
export function hentikanAlarm(): void {
  sedangBunyi = false;
  if (audioEl) {
    audioEl.pause();
    audioEl.currentTime = 0;
    audioEl = null;
  }
  hentikanRetroSynth();
}

export function apakahSedangBunyi(): boolean {
  return sedangBunyi;
}

// ---------------------------------------------------------------------------
// 3. Logika Penjadwalan & Pemeriksaan Alarm Acara
// ---------------------------------------------------------------------------

const KUNCI_DISMISSED = 'pk_alarm_dismissed';
const KUNCI_SNOOZED = 'pk_alarm_snoozed';

function ambilDismissed(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_DISMISSED) || '{}');
  } catch {
    return {};
  }
}

function ambilSnoozed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KUNCI_SNOOZED) || '{}');
  } catch {
    return {};
  }
}

export function matikanAlarmAcara(id: string): void {
  hentikanAlarm();
  const dismissed = ambilDismissed();
  dismissed[id] = new Date().toISOString().slice(0, 10);
  try {
    localStorage.setItem(KUNCI_DISMISSED, JSON.stringify(dismissed));
  } catch {
    /* abaikan */
  }

  // Hapus dari snoozed jika ada
  const snoozed = ambilSnoozed();
  delete snoozed[id];
  try {
    localStorage.setItem(KUNCI_SNOOZED, JSON.stringify(snoozed));
  } catch {
    /* abaikan */
  }

  // Bersihkan notifikasi dari status bar Android
  if (Capacitor.isNativePlatform()) {
    const notifId = Math.abs(id.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 0)) % 100000;
    LocalNotifications.cancel({
      notifications: [{ id: notifId || 9001 }],
    }).catch(() => undefined);
  }
}

export function tundaAlarmAcara(id: string, menit = 5): void {
  hentikanAlarm();
  const snoozed = ambilSnoozed();
  snoozed[id] = Date.now() + menit * 60_000;
  try {
    localStorage.setItem(KUNCI_SNOOZED, JSON.stringify(snoozed));
  } catch {
    /* abaikan */
  }
}

/** Hitung waktu target alarm dalam milidetik (epoch), selalu mengacu pada WITA (UTC+8) */
export function hitungTargetAlarmMs(tanggal: string, jamMulai: string, menitSebelum: number): number {
  // Format tanggal: YYYY-MM-DD, jam: HH:MM atau HH.MM
  const [tahun, bulan, hari] = tanggal.split('-').map(Number);
  const [jam, menit] = jamMulai.replace('.', ':').split(':').map(Number);
  // WITA adalah UTC+8: konversikan ke epoch UTC dengan mengurangi 8 jam
  const waktuAcaraMs = Date.UTC(tahun, (bulan || 1) - 1, hari || 1, jam || 0, menit || 0, 0, 0) - (8 * 3600_000);
  return waktuAcaraMs - (menitSebelum * 60_000);
}

/** Mendapatkan daftar alarm yang aktif / dijadwalkan untuk hari ini */
export function daftarAlarmHariIni(jadwal: JadwalItem[], tanggalHariIni: string): AlarmItem[] {
  const dismissed = ambilDismissed();
  const hasil: AlarmItem[] = [];

  for (const j of jadwal) {
    if (j.selesai) continue;
    if (j.tanggal !== tanggalHariIni && j.tanggal_selesai !== tanggalHariIni) continue;
    if (!j.jam_mulai) continue;

    // Default 15 menit jika ingatkan_menit tidak diset tetapi ada jam
    const menitSebelum = typeof j.ingatkan_menit === 'number' ? j.ingatkan_menit : 15;
    const targetMs = hitungTargetAlarmMs(tanggalHariIni, j.jam_mulai, menitSebelum);

    hasil.push({
      id: j.id,
      judul: j.judul,
      jamMulai: j.jam_mulai,
      menitSebelum,
      waktuTargetMs: targetMs,
      keterangan: j.keterangan,
    });
  }

  return hasil.sort((a, b) => a.waktuTargetMs - b.waktuTargetMs);
}

/**
 * Memeriksa apakah ada alarm yang harus berbunyi sekarang.
 * Dipanggil secara berkala (misal tiap 5 detik).
 */
export function periksaAlarmHarusBunyi(jadwal: JadwalItem[], tanggalHariIni: string): AlarmItem | null {
  const sekarang = Date.now();
  const dismissed = ambilDismissed();
  const snoozed = ambilSnoozed();

  const daftar = daftarAlarmHariIni(jadwal, tanggalHariIni);

  for (const item of daftar) {
    // Jika sudah dimatikan hari ini dan tidak sedang di-snooze, lewati
    if (dismissed[item.id] === tanggalHariIni && !snoozed[item.id]) {
      continue;
    }

    // Jika sedang di-snooze
    if (snoozed[item.id]) {
      if (sekarang >= snoozed[item.id]) {
        return item;
      }
      continue;
    }

    // Jika belum dimatikan: periksa apakah sudah saatnya berbunyi
    // Toleransi: dari waktu target hingga 30 menit setelahnya
    if (sekarang >= item.waktuTargetMs && sekarang <= item.waktuTargetMs + 30 * 60_000) {
      return item;
    }
  }

  return null;
}
