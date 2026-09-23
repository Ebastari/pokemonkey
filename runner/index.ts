/**
 * Penjadwal notifikasi POKEMONKEY untuk APK Android.
 *
 * Berkas ini TIDAK berjalan di WebView. Ia dibundel terpisah menjadi
 * `dist/runner.js` (lihat vite.runner.config.ts) dan dijalankan mesin JavaScript
 * milik @capacitor/background-runner, yang dibangunkan WorkManager sekitar tiap
 * 15 menit walau aplikasinya tertutup — pola yang sama dengan Smart Nursery.
 *
 * Di mesin ini tidak ada window, document, localStorage, maupun Intl. Yang ada:
 * fetch, console, CapacitorKV, dan CapacitorNotifications.
 *
 * Alur tiap kali bangun, untuk slot 07.00 (PICA), 12.00 (Info), 17.00 (XP):
 *   a) slot ≤ 90 menit lagi → ambil isi terbaru dari server lalu jadwalkan tepat
 *      di jam slot. Bangun berikutnya menjadwal ulang dengan id yang sama, jadi
 *      isi yang muncul adalah isi paling baru sebelum jamnya.
 *   b) slot sudah lewat < 3 jam dan belum pernah terjadwal (HP tertidur sepanjang
 *      jendela) → tampilkan sekarang sebagai susulan.
 *   c) server bilang tidak ada yang perlu diberitahukan → lewati.
 */

// Modul tanpa ekspor: isinya tidak bocor ke lingkup global proyek TypeScript.
export {};

// -- API mesin runner (hanya deklarasi tipe) --

type Selesai = (nilai?: unknown) => void;
type Gagal = (galat?: unknown) => void;

declare function addEventListener(
  nama: string,
  penangan: (resolve: Selesai, reject: Gagal, args: Record<string, unknown>) => void,
): void;

declare const CapacitorKV: {
  set(kunci: string, nilai: string): void;
  get(kunci: string): { value: string };
  remove(kunci: string): void;
};

declare const CapacitorNotifications: {
  schedule(
    daftar: Array<{ id: number; title: string; body: string; autoCancel?: boolean; scheduleAt?: Date; extra?: Record<string, unknown> }>,
  ): void;
};

// -- Konstanta --

type Slot = 'pagi' | 'siang' | 'sore';
const SEMUA_SLOT: Slot[] = ['pagi', 'siang', 'sore'];

const KUNCI_KONFIG = 'pokemonkey.konfigurasi';
const KUNCI_STATUS = 'pokemonkey.jadwal';
const KUNCI_PERIKSA = 'pokemonkey.terakhirPeriksa';

/** WITA, UTC+8 — dipatok, karena mesin runner tidak menjamin zona waktu perangkat. */
const OFFSET_MENIT = 480;
/** Id tetap per slot: notifikasi yang dijadwal ulang menimpa, bukan menumpuk. */
const ID_SLOT: Record<Slot, number> = { pagi: 4101, siang: 4102, sore: 4103 };
const JENDELA_MAJU_MENIT = 90;
const JENDELA_SUSULAN_MENIT = 180;

const JAM_BAWAAN: Record<Slot, string> = { pagi: '07:00', siang: '12:00', sore: '17:00' };

interface Konfigurasi {
  /** Alamat Worker, tanpa garis miring di akhir. */
  base: string;
  token: string;
  jam: Record<Slot, string>;
  /** pagi/siang/sore, plus 'acara' untuk pengingat kalender. */
  slot: Record<string, boolean>;
}

interface AcaraNotif {
  id: string;
  kunci: string;
  judul: string;
  isi: string;
  ingatkanPada: string;
}

interface StatusHari {
  tanggal: string;
  slot: Partial<Record<Slot, 'terjadwal' | 'selesai'>>;
  terakhirKirim?: number;
}

interface IsiNotif {
  judul: string;
  isi: string;
  tampil: boolean;
  tab: string;
}

// -- Penyimpanan --

const bacaKV = (kunci: string): string => {
  try {
    const hasil = CapacitorKV.get(kunci);
    return hasil && typeof hasil.value === 'string' ? hasil.value : '';
  } catch {
    return '';
  }
};

const tulisKV = (kunci: string, nilai: string): void => {
  try {
    CapacitorKV.set(kunci, nilai);
  } catch (galat) {
    console.error('[pokemonkey] gagal menulis KV', String(galat));
  }
};

const bacaKonfigurasi = (): Konfigurasi | null => {
  try {
    const isi = JSON.parse(bacaKV(KUNCI_KONFIG) || '{}') as Partial<Konfigurasi>;
    const base = String(isi.base || '').replace(/\/+$/, '');
    if (!base || !isi.token) return null;
    return {
      base,
      token: String(isi.token),
      jam: { ...JAM_BAWAAN, ...(isi.jam || {}) },
      slot: { pagi: true, siang: true, sore: true, acara: true, ...(isi.slot || {}) },
    };
  } catch {
    return null;
  }
};

const bacaStatus = (): StatusHari => {
  try {
    const s = JSON.parse(bacaKV(KUNCI_STATUS) || '{}') as StatusHari;
    return { tanggal: s.tanggal || '', slot: s.slot || {}, terakhirKirim: s.terakhirKirim };
  } catch {
    return { tanggal: '', slot: {} };
  }
};

// -- Waktu WITA tanpa Intl --

const dindingWita = () => new Date(Date.now() + OFFSET_MENIT * 60000);
const tanggalWita = () => dindingWita().toISOString().slice(0, 10);
const menitWita = () => {
  const d = dindingWita();
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const menitDariJam = (jam: string) => {
  const [j, m] = jam.split(':').map(Number);
  return (j || 0) * 60 + (m || 0);
};
/** Instant sebenarnya dari "tanggal WITA + jam WITA". */
const instantWita = (tanggal: string, jam: string) => {
  const [t, b, g] = tanggal.split('-').map(Number);
  const [j, m] = jam.split(':').map(Number);
  return new Date(Date.UTC(t, b - 1, g, j || 0, m || 0) - OFFSET_MENIT * 60000);
};

// -- Jaringan --

async function ambilIsi(k: Konfigurasi, slot: Slot): Promise<IsiNotif | null> {
  try {
    const res = await fetch(`${k.base}/api/notif/ringkas?slot=${slot}`, {
      headers: { Authorization: `Bearer ${k.token}` },
    });
    if (!res.ok) {
      console.error('[pokemonkey] ringkas', slot, res.status);
      return null;
    }
    return (await res.json()) as IsiNotif;
  } catch (galat) {
    // Tanpa sinyal: coba lagi di putaran berikutnya.
    console.error('[pokemonkey] jaringan', String(galat));
    return null;
  }
}

/**
 * Id notifikasi tetap per acara+tanggal: penjadwalan ulang menimpa alarm lama,
 * bukan menumpuknya. Rentangnya sengaja dipisah dari id slot harian (4101–4103).
 */
const idAcara = (kunci: string): number => {
  let n = 0;
  for (let i = 0; i < kunci.length; i++) n = (n * 31 + kunci.charCodeAt(i)) % 50_000;
  return 5000 + n;
};

/**
 * Pasang alarm untuk acara kalender hari ini.
 *
 * Alarmnya dijadwalkan Android, bukan ditunggu putaran 15 menit, jadi jamnya
 * mengikuti jam acara — bukan jam bangunnya penjadwal. Dipanggil setiap putaran
 * supaya perubahan jadwal dari aplikasi ikut terbawa; id yang sama membuat
 * jadwal lama tertimpa.
 */
async function jadwalkanAcara(k: Konfigurasi, hari: string): Promise<void> {
  try {
    const res = await fetch(`${k.base}/api/notif/acara?tanggal=${hari}`, {
      headers: { Authorization: `Bearer ${k.token}` },
    });
    if (!res.ok) return;

    const data = (await res.json()) as { acara?: AcaraNotif[] };
    const sekarang = Date.now();

    for (const a of data.acara || []) {
      const pada = Date.parse(a.ingatkanPada);
      // Lewat lebih dari dua menit: biarkan. Lebih dari sehari ke depan: tunggu putaran berikutnya.
      if (!pada || pada < sekarang - 120_000 || pada > sekarang + 26 * 3_600_000) continue;
      CapacitorNotifications.schedule([{
        id: idAcara(a.kunci),
        title: a.judul,
        body: a.isi,
        autoCancel: true,
        scheduleAt: new Date(pada),
        extra: { tab: 'jadwal', acara: a.id },
      }]);
    }
  } catch (galat) {
    console.error('[pokemonkey] pengingat acara', String(galat));
  }
}

// -- Putaran utama --

async function periksaJadwal(): Promise<void> {
  tulisKV(KUNCI_PERIKSA, String(Date.now()));

  const k = bacaKonfigurasi();
  if (!k) return;

  const hari = tanggalWita();
  const kini = menitWita();
  let status = bacaStatus();
  if (status.tanggal !== hari) status = { tanggal: hari, slot: {}, terakhirKirim: status.terakhirKirim };

  for (const slot of SEMUA_SLOT) {
    if (!k.slot[slot] || status.slot[slot] === 'selesai') continue;

    const selisih = menitDariJam(k.jam[slot]) - kini; // positif = masih akan datang
    if (selisih > JENDELA_MAJU_MENIT) continue;
    if (selisih < -JENDELA_SUSULAN_MENIT) {
      status.slot[slot] = 'selesai';
      continue;
    }

    // Sudah terjadwal dan jamnya sudah lewat: Android sudah memunculkannya.
    if (selisih <= 0 && status.slot[slot] === 'terjadwal') {
      status.slot[slot] = 'selesai';
      continue;
    }

    const isi = await ambilIsi(k, slot);
    if (!isi) continue;

    if (!isi.tampil) {
      // Masih jauh dari jamnya: periksa lagi nanti, siapa tahu keadaan berubah.
      if (selisih <= 15) status.slot[slot] = 'selesai';
      continue;
    }

    const notif = { id: ID_SLOT[slot], title: isi.judul, body: isi.isi, autoCancel: true, extra: { tab: isi.tab, slot } };

    if (selisih > 0) {
      CapacitorNotifications.schedule([{ ...notif, scheduleAt: instantWita(hari, k.jam[slot]) }]);
      status.slot[slot] = 'terjadwal';
    } else {
      CapacitorNotifications.schedule([notif]);
      status.slot[slot] = 'selesai';
    }
    status.terakhirKirim = Date.now();
  }

  if (k.slot.acara !== false) await jadwalkanAcara(k, hari);

  tulisKV(KUNCI_STATUS, JSON.stringify(status));
}

// -- Peristiwa dari aplikasi --

/** Titipan alamat server, token sesi, jam, dan saklar slot. Dipanggil tiap aplikasi dibuka/login/pengaturan diubah. */
addEventListener('simpanKonfigurasi', (resolve, reject, args) => {
  try {
    tulisKV(KUNCI_KONFIG, JSON.stringify(args || {}));
    resolve();
  } catch (galat) {
    reject(galat);
  }
});

/** Keluar akun: lupakan token dan jadwal. */
addEventListener('lupakanSesi', (resolve, reject) => {
  try {
    tulisKV(KUNCI_KONFIG, '');
    tulisKV(KUNCI_STATUS, '');
    resolve();
  } catch (galat) {
    reject(galat);
  }
});

/** Tanpa isi: contoh baku. Dengan { judul, isi }: pratinjau satu slot dari layar Notifikasi. */
addEventListener('notifikasiUji', (resolve, reject, args) => {
  try {
    const judul = typeof args?.judul === 'string' && args.judul ? args.judul : 'Notifikasi POKEMONKEY aktif';
    const isi = typeof args?.isi === 'string' ? args.isi : 'Pengingat datang pukul 07.00, 12.00, dan 17.00 WITA.';
    CapacitorNotifications.schedule([{ id: 4199, title: judul, body: isi, autoCancel: true }]);
    resolve();
  } catch (galat) {
    reject(galat);
  }
});

addEventListener('ambilDiagnosa', (resolve, reject) => {
  try {
    const status = bacaStatus();
    resolve({
      terakhirPeriksa: Number(bacaKV(KUNCI_PERIKSA)) || 0,
      terakhirKirim: status.terakhirKirim || 0,
      tanggal: status.tanggal,
      slot: status.slot,
      punyaKonfigurasi: Boolean(bacaKonfigurasi()),
    });
  } catch (galat) {
    reject(galat);
  }
});

/** Dipanggil WorkManager tiap ±15 menit, dan tombol "Periksa sekarang". */
addEventListener('periksaJadwal', (resolve) => {
  periksaJadwal()
    .then(() => resolve())
    .catch((galat) => {
      console.error('[pokemonkey] putaran gagal', String(galat));
      resolve();
    });
});
