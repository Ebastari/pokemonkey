import { Capacitor, registerPlugin } from '@capacitor/core';

export interface WidgetPicaItem {
  id: string;
  judul: string;
  pic: string;
  due_date: string;
  /** Label sisa waktu bergaya alarm: "TELAT 3 HARI", "HARI INI", "H-2". */
  sisa?: string;
  /** Jam alarm bila dinyalakan, atau tanggal tenggatnya. */
  waktu?: string;
  /** true bila alarm tenggat PICA ini dinyalakan pemiliknya. */
  alarm?: boolean;
  telat: boolean;
}

export interface WidgetJadwalItem {
  id: string;
  judul: string;
  jam: string;
  selesai: boolean;
}

export interface WidgetPayload {
  cuaca?: string;
  titikApi?: string;
  titikApiBahaya?: boolean;
  picaTotal?: number;
  picaTelat?: number;
  picaIsi?: string;
  picaItems?: WidgetPicaItem[];
  jadwalIsi?: string;
  jadwalItems?: WidgetJadwalItem[];
  alarmStatus?: string;
  /** Widget kalender: peta tanggal → kode lapisan ("L" libur, "T" tenggat, "R" rapat, "M" tim, "S" saya, "A" anggota lain, "O" roster). */
  kalenderTitik?: Record<string, string>;
  /** Tanggal hari ini (WITA) untuk menyorot sel dan menghitung bulan. */
  kalenderHariIni?: string;
  /** Ringkasan satu baris di bawah kotak bulan. */
  kalenderRingkas?: string;
}

interface WidgetBridgePlugin {
  perbaruiDataWidget(data: WidgetPayload): Promise<void>;
  ambilTabAwal(): Promise<{ tab?: string }>;
  layarAman(opsi: { aktif: boolean }): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

/**
 * Memo Rahasia: blokir tangkapan & rekam layar di APK Android (FLAG_SECURE).
 * Di peramban tidak ada cara menolak tangkapan layar; aplikasi memakai watermark nama.
 */
export async function layarAman(aktif: boolean): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try { await WidgetBridge.layarAman({ aktif }); return true; } catch { return false; }
}

let cacheWidget: WidgetPayload = {};

/**
 * Memperbarui data untuk semua widget layar beranda HP (Home Screen Widgets).
 * Otomatis menggabungkan pembaruan sebagian (partial updates) dengan data sebelumnya.
 */
export async function perbaruiDataWidgetHp(bagian: Partial<WidgetPayload>): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  cacheWidget = { ...cacheWidget, ...bagian };
  try {
    await WidgetBridge.perbaruiDataWidget(cacheWidget);
  } catch (e) {
    console.warn('[widget] gagal memperbarui data widget HP', e);
  }
}

/**
 * Membaca tab awal jika aplikasi diluncurkan dari ketukan widget layar HP.
 */
export async function ambilTabDariWidget(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const res = await WidgetBridge.ambilTabAwal();
    return res?.tab || null;
  } catch {
    return null;
  }
}

/**
 * Mendengarkan ketukan widget ketika aplikasi sedang terbuka di latar belakang / latar depan.
 */
export function dengarKetukanWidget(callback: (tab: string) => void): () => void {
  const handler = (event: Event) => {
    const custom = event as CustomEvent<string>;
    if (custom.detail && typeof custom.detail === 'string') {
      callback(custom.detail);
    }
  };
  window.addEventListener('pokemonkey:buka-tab', handler);
  return () => window.removeEventListener('pokemonkey:buka-tab', handler);
}

