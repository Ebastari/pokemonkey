/**
 * Mode DEMO — seluruh API dijalankan di dalam browser, tanpa server.
 *
 * Dipakai untuk melihat aplikasi sebelum Worker Cloudflare disambungkan,
 * untuk presentasi, dan untuk mencoba di lapangan tanpa sinyal. Datanya
 * sama dengan seed di server/migrations (10 PICA periode 26W36), aturannya
 * pun ditiru (kunci periode, bukti sebelum tutup, nomor otomatis).
 * Perubahan tersimpan di localStorage browser ini saja.
 */

import { GalatApi } from './galat';
import { hariIniWita, geserHari, selisihHari, jamWita } from './waktu';
import { LIBUR_BAWAAN } from './libur';
import { dataContohDemo, barisContoh, AWALAN_CONTOH } from './demo-contoh';
import { susunJawabanCuaca, type SlotCuaca } from '../server/src/cuaca-bmkg';
import {
  susunNotifPagi, susunNotifSiang, susunNotifSore, susunRekapPica,
  susunPengingatAcara,
  type BarisJadwal, type NotifSiap, type Slot,
} from '../server/src/ringkasan';
import {
  susunJadwalMemo, tandaJadwalMemo, setCentangTugas, lepasTenggatTugas, hakMemo, hanyaCentangTugasSendiri, type BarisJadwalMemo,
  kepalaSampah, pohonMemo, memoKosong, gantiLabelHalaman, HARI_SAMPAH,
} from '../server/src/memo-blok';

const KUNCI_DEMO = 'pokemonkey_demo';
const KUNCI_DB = 'pokemonkey_demo_db';
/** Naikkan bila bentuk data berubah, agar demo lama di browser dibangun ulang. */
const VERSI = 16;

export function demoAktif(): boolean {
  try { return localStorage.getItem(KUNCI_DEMO) === '1'; } catch { return false; }
}
export function aktifkanDemo(): void {
  try { localStorage.setItem(KUNCI_DEMO, '1'); } catch { /* abaikan */ }
}
export function matikanDemo(): void {
  try {
    localStorage.removeItem(KUNCI_DEMO);
    // CATATAN: KUNCI_DB sengaja TIDAK dihapus agar data demo mandiri
    // tetap tersimpan di perangkat pengguna dan tidak hilang saat logout.
  } catch { /* abaikan */ }
}
/**
 * Buang seluruh data contoh (id berawalan `contoh-`) tanpa menyentuh data yang
 * dibuat pemakai sendiri. Dipakai tombol "Hapus data contoh" di pita mode demo.
 */
export function hapusDataContohDemo(): void {
  const d = db();
  const bukanContoh = <T extends { id?: string; user_id?: string; pica_id?: string }>(x: T) => !barisContoh(x);
  d.tim = d.tim.filter((t) => !String(t.id).startsWith(AWALAN_CONTOH));
  for (const kunci of Object.keys(d.profil)) {
    if (kunci.startsWith(AWALAN_CONTOH)) delete d.profil[kunci];
  }
  d.pica = d.pica.filter(bukanContoh);
  d.riwayat = d.riwayat.filter(bukanContoh);
  d.updates = d.updates.filter(bukanContoh);
  d.jadwal = d.jadwal.filter(bukanContoh);
  d.memo = d.memo.filter(bukanContoh);
  d.pengumuman = d.pengumuman.filter(bukanContoh);
  d.laporan = d.laporan.filter(bukanContoh);
  d.misi = d.misi.filter(bukanContoh);
  d.surat = d.surat.filter(bukanContoh);
  d.roster = d.roster.filter((r) => !String(r.user_id).startsWith(AWALAN_CONTOH));
  simpan();
}

/** Masih ada data contoh yang tersisa? */
export function adaDataContohDemo(): boolean {
  try {
    const d = db();
    return d.pica.some(barisContoh) || d.jadwal.some(barisContoh) || d.memo.some(barisContoh);
  } catch {
    return false;
  }
}

export function resetDemoDb(): void {
  try {
    localStorage.removeItem(KUNCI_DB);
    cache = null;
  } catch { /* abaikan */ }
}
export function adaDataDemo(): boolean {
  try {
    const s = localStorage.getItem(KUNCI_DB);
    if (!s) return false;
    const parsed = JSON.parse(s);
    return Boolean(parsed && parsed.versi === VERSI);
  } catch {
    return false;
  }
}
export function hitungDataDemo(): { pica: number; jadwal: number; memo: number; laporan: number; tim: number } {
  try {
    const s = localStorage.getItem(KUNCI_DB);
    if (!s) return { pica: 0, jadwal: 0, memo: 0, laporan: 0, tim: 0 };
    const parsed = JSON.parse(s);
    if (!parsed || parsed.versi !== VERSI) return { pica: 0, jadwal: 0, memo: 0, laporan: 0, tim: 0 };
    return {
      pica: Array.isArray(parsed.pica) ? parsed.pica.filter((p: any) => !p.dihapus).length : 0,
      jadwal: Array.isArray(parsed.jadwal) ? parsed.jadwal.length : 0,
      memo: Array.isArray(parsed.memo) ? parsed.memo.length : 0,
      laporan: Array.isArray(parsed.laporan) ? parsed.laporan.length : 0,
      tim: Array.isArray(parsed.tim) ? parsed.tim.length : 0,
    };
  } catch {
    return { pica: 0, jadwal: 0, memo: 0, laporan: 0, tim: 0 };
  }
}

// ---------- Bentuk data ----------

type Baris = Record<string, any>;

interface Db {
  sesi: string;
  tim: Baris[];
  profil: Record<string, Baris>;
  pica: Baris[];
  riwayat: Baris[];
  updates: Baris[];
  lampiran: Baris[];
  pengumuman: Baris[];
  baca: { pengumuman_id: string; user_id: string }[];
  jadwal: Baris[];
  laporan: Baris[];
  misi: Baris[];
  roster: Baris[];
  memo: Baris[];
  /** Dokumen administrasi (sejak 0017): nomor surat, Internal Memo dinas, MoM. */
  /** Alarm tenggat PICA (sejak 0018). */
  picaAlarm: Baris[];
  surat: Baris[];
  memoDinas: Baris[];
  mom: Baris[];
  /** Foto profil demo: data URL per user, tidak pernah ke server mana pun. */
  foto: Record<string, string>;
  libur: Baris[];
  revegetasi: Baris[];
  katalog: Baris[];
  versi: number;
  opsi: Baris[];
  properti: Baris[];
  periode: Baris[];
  pengaturan: Record<string, string>;
  bagi: string[];
  urut: number;
}

const kini = () => new Date().toISOString();
const idBaru = (awalan: string) => `${awalan}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ---------- Data awal (Kosongan & Umum untuk semua bidang kerja) ----------

/**
 * Katalog RAB RNR contoh. `kategori` = lembar rincian Excel (bbm, atk, pantry, …);
 * 'rnr' = tanpa kategori (hanya di rekap), sama seperti katalog di server.
 */
function katalogDemo(): Baris[] {
  const w = 'AB3.11-06.02.22.04';
  const perdin = 'AB3.11-06.02.22.02';
  // Barang lembar BBM–KHL mengikuti "Contoh RAB HCGA Site.xlsx"; harga perkiraan contoh.
  return [
    ['kat-rtn-01', 'kunjungan', 'Kunjungan Eksternal', 'Kunjungan Verifikasi PNBP PKH SK 966', 'Paket', 7200000],
    ['kat-rtn-02', 'kunjungan', 'Kunjungan Eksternal', 'Kunjungan Verifikasi PNBP PKH SK 892', 'Paket', 7200000],
    ['kat-rtn-03', 'kunjungan', 'Kunjungan Eksternal', 'Kunjungan Verifikasi PNBP PKH SK 78', 'Paket', 7200000],
    ['kat-rtn-04', 'rnr', 'Pengajuan Rutin', 'Operasional Tahura', 'Paket', 2000000],
    ['kat-bbm-01', 'bbm', 'BBM Operasional Tahura', 'Pertalite kendaraan operasional Tahura', 'Liter', 10000],
    ['kat-bbm-02', 'bbm', 'BBM Operasional Tahura', 'Solar kendaraan / alat operasional Tahura', 'Liter', 6800],
    ['kat-bbm-11', 'bbm', 'BBM Kendaraan', 'BBM Honda CRF motor operasional', 'Liter', 10000],
    ['kat-bbm-12', 'bbm', 'BBM Kendaraan', 'BBM Toyota Hilux vendor 1', 'Liter', 6800],
    ['kat-bbm-13', 'bbm', 'BBM Kendaraan', 'BBM Toyota Hilux vendor 2', 'Liter', 6800],
    ['kat-atk-01', 'atk', 'ATK', 'Kertas HVS A4 70 gr', 'Rim', 55000],
    ['kat-atk-05', 'atk', 'ATK', 'Tinta printer (botol)', 'Botol', 90000],
    ['kat-cat-01', 'catering', 'Catering', 'Catering Staff (7 Orang)', 'Pack', 20000],
    ['kat-cat-02', 'catering', 'Catering', 'Catering KHL (3 Orang)', 'Pack', 20000],
    ['kat-prd-01', 'perdin', 'Perdin & Cuti', 'Lumpsum Cuti Periodik Karyawan', 'Orang', 1500000, perdin],
    ['kat-prd-02', 'perdin', 'Perdin & Cuti', 'Perjalanan Dinas Karyawan', 'Paket', 2500000, perdin],
    ['kat-lst-01', 'listrik', 'Listrik PLN', 'Listrik Stockpile EBL', 'Bulan', 1500000],
    ['kat-lst-02', 'listrik', 'Listrik PLN', 'Listrik Mess Kupang', 'Bulan', 750000],
    ['kat-lst-03', 'listrik', 'Listrik PLN', 'Listrik Kantor & Mess EBL', 'Bulan', 1250000],
    ['kat-air-01', 'air', 'Air PDAM', 'Air PDAM Stockpile EBL', 'Bulan', 250000],
    ['kat-air-02', 'air', 'Air PDAM', 'Air PDAM Kantor & Mess EBL', 'Bulan', 200000],
    ['kat-tlp-01', 'telp', 'Telp & Internet', 'Pembayaran Indihome (Mess Kantor)', 'Bulan', 450000],
    ['kat-tlp-02', 'telp', 'Telp & Internet', 'Pembayaran Telkom Speedy (Kantor)', 'Bulan', 550000],
    ['kat-ptr-01', 'pantry', 'Pantry', 'Air Galon', 'Galon', 20000],
    ['kat-ptr-02', 'pantry', 'Pantry', 'Gas LPG', 'Tabung', 25000],
    ['kat-keb-05', 'pantry', 'Pantry', 'Sabun cuci piring', 'Pouch', 15000],
    ['kat-keb-08', 'pantry', 'Pantry', 'Tisu gulung', 'Pack', 20000],
    ['kat-khl-01', 'khl', 'KHL', 'Upah ART Mess & Kantor', 'Orang', 3000000],
    ['kat-khl-02', 'khl', 'KHL', 'Upah KHL Security Mess', 'Orang', 3000000],
  ].map(([id, kategori, kelompok, nama, satuan, harga, wbs], i) => ({ id, kategori, kelompok, nama, satuan, harga, urutan: i + 1, wbs: wbs ?? w, aktif: 1 }));
}

function bentukAwal(): Db {
  // Mode demo dibekali contoh fiktif berlabel "CONTOH ·" agar orang di luar
  // departemen langsung melihat aplikasinya bekerja. Semuanya bisa dibuang
  // sekaligus lewat hapusDataContohDemo().
  const c = dataContohDemo();
  return {
    sesi: 'demo',
    tim: c.tim,
    profil: c.profil,
    pica: c.pica,
    riwayat: [],
    updates: [],
    lampiran: [],
    pengumuman: c.pengumuman,
    baca: [],
    jadwal: c.jadwal,
    laporan: c.laporan,
    misi: c.misi,
    roster: c.roster,
    memo: c.memo,
    picaAlarm: [],
    surat: c.surat,
    memoDinas: [],
    mom: [],
    foto: {},
    versi: VERSI,
    libur: LIBUR_BAWAAN.map((l, i) => ({ id: i + 1, tanggal: l.tanggal, nama: l.nama, jenis: l.jenis, perkiraan: l.perkiraan ? 1 : 0 })),
    revegetasi: [],
    katalog: katalogDemo(),
    opsi: [
      { grup: 'memo_kategori', nilai: 'Operasional', label: 'Operasional', warna: 'emerald', urutan: 1 },
      { grup: 'memo_kategori', nilai: 'Lapangan', label: 'Lapangan', warna: 'cyan', urutan: 2 },
      { grup: 'memo_kategori', nilai: 'Perencanaan', label: 'Perencanaan', warna: 'purple', urutan: 3 },
      { grup: 'memo_kategori', nilai: 'Administrasi', label: 'Administrasi', warna: 'zinc', urutan: 4 },
      { grup: 'memo_kategori', nilai: 'K3 & Lingkungan', label: 'K3 & Lingkungan', warna: 'orange', urutan: 5 },
      { grup: 'memo_kategori', nilai: 'Umum', label: 'Umum', warna: 'blue', urutan: 6 },
      { grup: 'memo_tipe', nilai: 'Perubahan Kebijakan', label: 'Perubahan Kebijakan', warna: 'purple', urutan: 1 },
      { grup: 'memo_tipe', nilai: 'Rekap Rapat', label: 'Rekap Rapat', warna: 'blue', urutan: 2 },
      { grup: 'memo_tipe', nilai: 'Pengumuman', label: 'Pengumuman', warna: 'indigo', urutan: 3 },
      { grup: 'memo_tipe', nilai: 'Pembaruan', label: 'Pembaruan', warna: 'cyan', urutan: 4 },
      { grup: 'memo_tipe', nilai: 'Keputusan', label: 'Keputusan', warna: 'amber', urutan: 5 },
      { grup: 'memo_status', nilai: 'Draf', label: 'Draf', warna: 'zinc', urutan: 1 },
      { grup: 'memo_status', nilai: 'Sedang berlangsung', label: 'Sedang berlangsung', warna: 'amber', urutan: 2 },
      { grup: 'memo_status', nilai: 'Selesai', label: 'Selesai', warna: 'emerald', urutan: 3 },
      { grup: 'roster', nilai: 'D', label: 'Shift Siang', warna: 'cyan', urutan: 1 },
      { grup: 'roster', nilai: 'N', label: 'Shift Malam', warna: 'indigo', urutan: 2 },
      { grup: 'roster', nilai: 'OFF', label: 'Libur', warna: 'red', urutan: 3 },
      { grup: 'roster', nilai: 'FB', label: 'Field Break / Cuti Tahunan', warna: 'yellow', urutan: 4 },
      { grup: 'roster', nilai: 'IK', label: 'Ijin Khusus', warna: 'emerald', urutan: 5 },
      { grup: 'bidang', nilai: 'Operasional', label: 'Operasional', warna: 'emerald', urutan: 1 },
      { grup: 'bidang', nilai: 'Lapangan', label: 'Lapangan', warna: 'cyan', urutan: 2 },
      { grup: 'bidang', nilai: 'Perencanaan', label: 'Perencanaan', warna: 'indigo', urutan: 3 },
      { grup: 'bidang', nilai: 'Administrasi', label: 'Administrasi', warna: 'zinc', urutan: 4 },
      { grup: 'bidang', nilai: 'K3 & Lingkungan', label: 'K3 & Lingkungan', warna: 'orange', urutan: 5 },
      { grup: 'bidang', nilai: 'Logistik', label: 'Logistik & Pengadaan', warna: 'amber', urutan: 6 },
      { grup: 'bidang', nilai: 'Umum', label: 'Umum', warna: 'purple', urutan: 7 },
      { grup: 'prioritas', nilai: 'Tinggi', label: 'Tinggi', warna: 'red', urutan: 1 },
      { grup: 'prioritas', nilai: 'Sedang', label: 'Sedang', warna: 'amber', urutan: 2 },
      { grup: 'prioritas', nilai: 'Rendah', label: 'Rendah', warna: 'zinc', urutan: 3 },
      { grup: 'status', nilai: 'Open', label: 'Open', warna: 'amber', urutan: 1 },
      { grup: 'status', nilai: 'In Progress', label: 'Dikerjakan', warna: 'blue', urutan: 2 },
      { grup: 'status', nilai: 'Continue', label: 'Continue', warna: 'indigo', urutan: 3 },
      { grup: 'status', nilai: 'Verifikasi', label: 'Menunggu Verifikasi', warna: 'purple', urutan: 4 },
      { grup: 'status', nilai: 'Closed', label: 'Selesai', warna: 'emerald', urutan: 5 },
      { grup: 'satuan', nilai: 'unit', label: 'unit', warna: 'zinc', urutan: 1 },
      { grup: 'satuan', nilai: 'titik', label: 'titik', warna: 'zinc', urutan: 2 },
      { grup: 'satuan', nilai: 'ha', label: 'Ha', warna: 'zinc', urutan: 3 },
      { grup: 'satuan', nilai: 'meter', label: 'meter', warna: 'zinc', urutan: 4 },
      { grup: 'satuan', nilai: 'kg', label: 'kg', warna: 'zinc', urutan: 5 },
      { grup: 'satuan', nilai: 'ton', label: 'ton', warna: 'zinc', urutan: 6 },
      { grup: 'satuan', nilai: 'bibit', label: 'bibit', warna: 'zinc', urutan: 7 },
      { grup: 'satuan', nilai: 'pohon', label: 'pohon', warna: 'zinc', urutan: 8 },
      { grup: 'satuan', nilai: 'jam', label: 'jam', warna: 'zinc', urutan: 9 },
      { grup: 'satuan', nilai: 'hari', label: 'hari', warna: 'zinc', urutan: 10 },
      { grup: 'satuan', nilai: 'orang', label: 'orang', warna: 'zinc', urutan: 11 },
      { grup: 'satuan', nilai: 'berkas', label: 'berkas', warna: 'zinc', urutan: 12 },
      { grup: 'satuan', nilai: '%', label: '%', warna: 'zinc', urutan: 13 },
    ],
    properti: [
      { id: 'lokasi', label: 'Lokasi / Area', tipe: 'teks', opsi_json: null, urutan: 1, tampil_di_tabel: 1, aktif: 1 },
      { id: 'kategori', label: 'Kategori Kegiatan', tipe: 'teks', opsi_json: null, urutan: 2, tampil_di_tabel: 1, aktif: 1 },
      { id: 'volume', label: 'Volume Target', tipe: 'angka', opsi_json: null, urutan: 3, tampil_di_tabel: 0, aktif: 1 },
      { id: 'no_dokumen', label: 'Nomor Dokumen / Surat', tipe: 'teks', opsi_json: null, urutan: 4, tampil_di_tabel: 0, aktif: 1 },
    ],
    periode: [{ id: 'PERIODE-AKTIF', mulai: '2026-09-01', selesai: '2026-12-31', judul: 'Periode Berjalan 2026', sumber: 'Ruang Kerja Mandiri', terkunci: 0, dikunci_oleh: null, dikunci_pada: null }],
    pengaturan: { zona_waktu: 'WITA', tz_offset_menit: '480', jam_pengingat: '07:00', jam_rekap_sore: '16:00', wa_grup_id: '', wa_aktif: '0', wa_jeda: '5-10', periode_aktif: 'PERIODE-AKTIF', ambang_kpi_persen: '60', wa_pengingat_pribadi: '0', jam_notif_pagi: '07:00', jam_notif_siang: '12:00', jam_notif_sore: '17:00', cuaca_adm4: '63.05.09.2012' },
    bagi: [],
    urut: 100,
  };
}

// ---------- Penyimpanan ----------

let cache: Db | null = null;

/**
 * Sama dengan migrasi 0021: nomor PICA berjalan sepanjang waktu (PICA-001, …),
 * dari yang terlama. PICA yang belum bernomor (data lama/contoh) diberi nomor lanjutan.
 */
function pastikanNoUrut(d: Db): boolean {
  const belum = d.pica.filter((p) => !p.no_urut)
    .sort((a, b) => String(a.dibuat_pada).localeCompare(String(b.dibuat_pada)) || String(a.id).localeCompare(String(b.id)));
  if (!belum.length) return false;
  let n = Math.max(0, ...d.pica.map((p) => Number(p.no_urut) || 0));
  belum.forEach((p) => { p.no_urut = ++n; });
  return true;
}

/** Sama dengan migrasi 0019: kode roster lama → kode berkas Excel. Kode buatan sendiri dibiarkan. */
const KODE_LAMA: Record<string, string> = { M: 'D', S1: 'D', S2: 'N', L: 'OFF', C: 'FB', I: 'IK' };

function naikkanKodeRoster(d: Db): boolean {
  if (!d.opsi.some((o) => o.grup === 'roster' && o.nilai in KODE_LAMA)) return false;
  const baru = bentukAwal().opsi.filter((o) => o.grup === 'roster');
  d.opsi = [...d.opsi.filter((o) => !(o.grup === 'roster' && (o.nilai in KODE_LAMA || baru.some((b) => b.nilai === o.nilai)))), ...baru];
  d.roster.forEach((r) => { r.kode = KODE_LAMA[r.kode] ?? r.kode; });
  return true;
}

function db(): Db {
  if (cache) return cache;
  try {
    const s = localStorage.getItem(KUNCI_DB);
    if (s) {
      const tersimpan = JSON.parse(s) as Db;
      if (tersimpan.versi === VERSI) {
        // Lengkapi kunci yang belum ada — mis. data tersimpan saat aplikasi
        // dimuat ulang di tengah pembaruan kode. Data yang sudah ada tidak diubah.
        const awal = bentukAwal() as unknown as Record<string, unknown>;
        const t = tersimpan as unknown as Record<string, unknown>;
        let berubah = false;
        for (const k of Object.keys(awal)) if (t[k] === undefined) { t[k] = awal[k]; berubah = true; }
        if (naikkanKodeRoster(tersimpan)) berubah = true;
        cache = tersimpan;
        if (berubah) simpan();
        return cache;
      }
    }
  } catch { /* mulai dari awal */ }
  cache = bentukAwal();
  simpan();
  return cache;
}

function simpan(): void {
  try { localStorage.setItem(KUNCI_DB, JSON.stringify(cache)); } catch { /* abaikan */ }
}

const tidur = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Pembantu ----------

function pengguna(d: Db) {
  const t = d.tim.find((x) => x.id === d.sesi) ?? d.tim[0];
  return { id: t.id, nama: t.nama, jabatan: t.jabatan, bidang: t.bidang, wa: t.wa, peran: t.peran };
}
const bolehKelola = (p: Baris) => p.peran === 'admin' || p.peran === 'supervisor';
const namaTim = (d: Db, id: string | null) => d.tim.find((t) => t.id === id)?.nama ?? null;
const gagal = (pesan: string, status = 400, data: Record<string, unknown> = {}): never => { throw new GalatApi(pesan, status, data); };

function bentukPica(d: Db, p: Baris, hariIni: string) {
  return { ...p, pic_nama: namaTim(d, p.pic_id), sisa_hari: p.due_date ? selisihHari(p.due_date, hariIni) : null };
}

function daftarJadwal(d: Db, dari: string, sampai: string, sembunyikanId: boolean) {
  const hariIni = hariIniWita();
  const jadwal = d.jadwal
    .filter((j) => j.tanggal <= sampai && (j.rrule || (j.tanggal_selesai ?? j.tanggal) >= dari))
    .map((j): Baris => ({ ...j, pemilik_nama: namaTim(d, j.pemilik_id), pemilik_id: sembunyikanId && j.pemilik_id ? 'anggota' : j.pemilik_id }))
    .sort((a, b) => (a.tanggal + (a.jam_mulai ?? '')).localeCompare(b.tanggal + (b.jam_mulai ?? '')));
  const tenggat = d.pica
    .filter((p) => !p.dihapus && p.status !== 'Closed' && p.due_date && p.due_date >= dari && p.due_date <= sampai)
    .map((p) => ({ id: p.id, judul: p.judul, due_date: p.due_date, status: p.status, pic_nama: namaTim(d, p.pic_id) }));
  const libur = d.libur.filter((l) => l.tanggal >= dari && l.tanggal <= sampai);
  return { jadwal, tenggat, libur, hariIni };
}

// ---------- Memo: tiruan server/src/personal.ts ----------

/** Nilai properti kustom memo → JSON aman (sama dengan server). */
function bersihkanPropsDemo(v: unknown): string {
  let isi: unknown = v;
  if (typeof v === 'string') { try { isi = JSON.parse(v); } catch { isi = null; } }
  if (!isi || typeof isi !== 'object' || Array.isArray(isi)) return '{}';
  const hasil: Record<string, string | number | boolean | null> = {};
  for (const [k, x] of Object.entries(isi as Record<string, unknown>).slice(0, 40)) {
    if (!/^[a-z0-9_]{1,40}$/.test(k)) continue;
    if (typeof x === 'string') hasil[k] = x.slice(0, 500);
    else if (typeof x === 'number' && Number.isFinite(x)) hasil[k] = x;
    else if (typeof x === 'boolean' || x === null) hasil[k] = x as boolean | null;
  }
  return JSON.stringify(hasil);
}

const picaSahDemo = (d: Db, id: unknown): string | null => {
  const p = typeof id === 'string' && id ? d.pica.find((x) => x.id === id && !x.dihapus) : null;
  return p ? p.id : null;
};

/** Ceklis bertenggat → baris jadwal (jenis 'tenggat', memo_id terisi). */
function sinkronJadwalMemoDemo(d: Db, m: Baris): void {
  const baru = susunJadwalMemo(String(m.isi ?? ''), {
    judulMemo: String(m.judul ?? ''),
    lingkup: m.lingkup === 'tim' ? 'tim' : 'pribadi',
    penulisId: m.user_id,
    idTim: new Set(d.tim.map((t) => String(t.id))),
  });
  const lama = d.jadwal.filter((j) => j.memo_id === m.id);
  if (tandaJadwalMemo(lama as BarisJadwalMemo[]) === tandaJadwalMemo(baru)) return;
  d.jadwal = d.jadwal.filter((j) => j.memo_id !== m.id);
  for (const r of baru) {
    d.jadwal.push({
      id: idBaru('jdw'), judul: r.judul, keterangan: r.keterangan, tanggal: r.tanggal, tanggal_selesai: null,
      jam_mulai: r.jam_mulai, jam_selesai: null, jenis: 'tenggat', pica_id: null, pemilik_id: r.pemilik_id, rrule: null,
      ingatkan_menit: r.ingatkan_menit, gcal_id: null, selesai: r.selesai, memo_id: m.id, dibuat_pada: kini(),
    });
  }
}

/** Memo dihapus: jadwal buatannya dan lampirannya ikut dibuang. */
function hapusIsiTerkaitMemoDemo(d: Db, memoId: string): void {
  d.jadwal = d.jadwal.filter((j) => j.memo_id !== memoId);
  d.lampiran = d.lampiran.filter((l) => !(l.entitas === 'memo' && l.entitas_id === memoId));
}

/** Centang/hapus di Kalender dicerminkan ke teks memo asalnya. */
function cerminkanJadwalKeMemoDemo(d: Db, j: Baris, aksi: { selesai: boolean } | 'lepas'): void {
  if (!j.memo_id) return;
  const memo = d.memo.find((x) => x.id === j.memo_id);
  if (!memo) return;
  const baru = aksi === 'lepas' ? lepasTenggatTugas(memo.isi, j as never) : setCentangTugas(memo.isi, j as never, aksi.selesai);
  if (baru === null) return;
  memo.isi = baru;
  memo.diubah_pada = kini();
}

/** Berkas lampiran memo yang tersimpan di mode demo (data URL di dalam database demo). */
export function demoBerkas(kunci: string): Blob | null {
  const l = db().lampiran.find((x) => x.kunci_r2 === kunci && typeof x.data === 'string');
  if (!l) return null;
  const [kepala, isi] = String(l.data).split(',');
  const mime = /^data:([^;]+);base64$/.exec(kepala)?.[1] ?? 'application/octet-stream';
  const bin = atob(isi ?? '');
  const byte = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) byte[i] = bin.charCodeAt(i);
  return new Blob([byte], { type: mime });
}

const bacaSebagaiDataUrl = (f: File): Promise<string> =>
  new Promise((ok, gagalBaca) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => gagalBaca(new Error('Berkas gagal dibaca'));
    r.readAsDataURL(f);
  });

// ---------- Notifikasi & rekap: tiruan server/src/sumber.ts ----------

/** Tanggal WITA dari cap waktu ISO (UTC). */
const hariWita = (iso: string | null | undefined) => (iso ? new Date(Date.parse(iso) + 480 * 60000).toISOString().slice(0, 10) : '');
const urutTenggat = (a: Baris, b: Baris) => String(a.due_date ?? '9999').localeCompare(String(b.due_date ?? '9999'));

function siapkanNotifDemo(d: Db, saya: Baris, slot: Slot, hariIni: string): NotifSiap {
  const aktif = d.pica.filter((p) => !p.dihapus);

  if (slot === 'pagi') {
    const milik = aktif
      .filter((p) => p.status === 'Open' && p.pic_id === saya.id)
      .sort(urutTenggat)
      .map((p) => ({ id: p.id, judul: p.judul, status: p.status, due_date: p.due_date, bidang: p.bidang, pic_nama: namaTim(d, p.pic_id) }));
    const tim = bolehKelola(saya)
      ? { open: aktif.filter((p) => p.status === 'Open').length, telat: aktif.filter((p) => p.status !== 'Closed' && p.due_date && p.due_date < hariIni).length }
      : undefined;
    return susunNotifPagi({ milik, hariIni, tim });
  }

  if (slot === 'siang') {
    const batas = geserHari(hariIni, -14);
    const belum = d.pengumuman
      .filter((p) => hariWita(p.dibuat_pada) >= batas && !d.baca.some((b) => b.pengumuman_id === p.id && b.user_id === saya.id))
      .sort((a, b) => String(b.dibuat_pada).localeCompare(String(a.dibuat_pada)))
      .map((p) => ({ judul: p.judul, penting: p.penting }));
    return susunNotifSiang({ belum });
  }

  const laporanHariIni = d.laporan.filter((l) => l.user_id === saya.id && hariWita(l.dibuat_pada) === hariIni);
  const profil = d.profil[saya.id] ?? {};
  return susunNotifSore({
    xpHariIni: laporanHariIni.reduce((n, l) => n + Number(l.xp || 0), 0),
    laporanHariIni: laporanHariIni.length,
    xp: Number(profil.xp ?? 0),
    level: Number(profil.level ?? 1),
    stamina: Number(profil.stamina ?? 100),
  });
}

function siapkanRekapDemo(d: Db, jenis: 'harian' | 'mingguan', hariIni: string): string {
  const aktif = d.pica.filter((p) => !p.dihapus);
  const terbuka = aktif.filter((p) => p.status !== 'Closed').map((p) => ({
    id: p.id, judul: p.judul, judul_singkat: p.judul_singkat ?? null, bidang: p.bidang, status: p.status,
    due_date: p.due_date, pic_id: p.pic_id, pic_nama: namaTim(d, p.pic_id), target: p.target, realisasi: p.realisasi,
    satuan: p.satuan, tindakan: p.tindakan,
  }));
  const bergerak = [
    ...d.updates.filter((u) => hariWita(u.pada) === hariIni).map((u) => ({ pica_id: u.pica_id, oleh: namaTim(d, u.oleh) })),
    ...d.riwayat.filter((r) => r.kolom === 'status' && hariWita(r.pada) === hariIni).map((r) => ({ pica_id: r.pica_id, oleh: namaTim(d, r.oleh) })),
  ];

  let mingguan: { dari: string; baru: number; ditutup: number } | undefined;
  if (jenis === 'mingguan') {
    const dari = geserHari(hariIni, -((new Date(`${hariIni}T00:00:00Z`).getUTCDay() + 6) % 7));
    const pekanIni = (iso: string | null) => Boolean(iso) && hariWita(iso) >= dari && hariWita(iso) <= hariIni;
    mingguan = { dari, baru: aktif.filter((p) => pekanIni(p.dibuat_pada)).length, ditutup: aktif.filter((p) => pekanIni(p.ditutup_pada)).length };
  }

  // Tautan hanya-baca hanya ada di server sungguhan.
  return susunRekapPica({
    jenis, hariIni, terbuka, bergerak, mingguan, tautan: null,
    selesaiHariIni: aktif.filter((p) => hariWita(p.ditutup_pada) === hariIni).length,
  });
}

// ---------- Router ----------

export async function demoApi(jalur: string, method: string, body: any, form?: FormData): Promise<unknown> {
  await tidur(90 + Math.random() * 120);
  const d = db();
  const url = new URL(jalur, 'http://demo');
  const path = url.pathname.replace(/\/+$/, '');
  const q = url.searchParams;
  const hariIni = hariIniWita();
  const saya = pengguna(d);
  let m: RegExpMatchArray | null;

  // ----- auth -----
  if (path === '/api/auth/login') {
    const id = String(body?.userId ?? '').toLowerCase().trim();
    let t = d.tim.find((x) => x.id === id);
    if (!t && (id === 'demo' || id === 'admin' || !id || d.tim.length === 1)) {
      t = d.tim[0];
    }
    if (!t) {
      const daftarTim = d.tim.map((x) => x.id).join(', ');
      gagal(`User ID "${id}" tidak ditemukan di database demo lokal. Pilihan akun yang ada: ${daftarTim || 'demo'}`, 401);
    }
    d.sesi = t.id; simpan();
    return { token: 'demo-token', pengguna: pengguna(d), passwordBaruDibuat: false };
  }
  if (path === '/api/auth/logout') return { ok: true };
  if (path === '/api/me') return { pengguna: { ...saya, foto: d.foto[saya.id] ?? null } };

  if (path === '/api/bootstrap') {
    return {
      pengguna: { ...saya, foto: d.foto[saya.id] ?? null },
      opsi: d.opsi,
      properti: d.properti.filter((p) => p.aktif && (p.entitas ?? 'pica') === 'pica'),
      propertiMemo: d.properti.filter((p) => p.aktif && p.entitas === 'memo'),
      tim: d.tim.map(({ id, nama, jabatan, bidang, peran }) => ({ id, nama, jabatan, bidang, peran, foto: d.foto[id] ?? null })),
      periode: d.periode, pengaturan: d.pengaturan, hariIni,
    };
  }

  // ----- lapisan kalender (layar + widget) -----
  if (path === "/api/kalender/lapisan" && method === "GET") {
    let lapisan = {};
    try { lapisan = JSON.parse(d.pengaturan["kalender_lapisan"] ?? "{}"); } catch { lapisan = {}; }
    return { lapisan };
  }
  if (path === "/api/kalender/lapisan" && method === "POST") {
    d.pengaturan["kalender_lapisan"] = JSON.stringify(body?.lapisan ?? {});
    simpan(); return { ok: true };
  }

  // ----- impor CSV PICA (mode demo: seluruhnya di perangkat ini, tidak ke server) -----
  if (path === '/api/pica/impor' && method === 'POST') {
    if (!bolehKelola(saya)) gagal('Hanya Admin/Supervisor.', 403);
    const masuk: Baris[] = Array.isArray(body?.items) ? body.items : [];
    if (!masuk.length) gagal('Daftar PICA untuk diimpor tidak boleh kosong.', 400);
    if (masuk.length > 200) gagal('Maksimal 200 baris sekali impor.', 400);

    const periodeId = body?.periode_id || d.pengaturan.periode_aktif || null;
    let nomor = d.pica.filter((p: Baris) => p.periode_id === periodeId)
      .reduce((n: number, p: Baris) => Math.max(n, Number(p.nomor) || 0), 0);
    const ids: string[] = [];
    for (const it of masuk) {
      const judul = String(it.judul ?? '').trim();
      const bidang = String(it.bidang ?? '').trim();
      if (!judul || !bidang) continue;
      nomor += 1;
      const id = `PICA-${periodeId ?? 'UMUM'}-${String(nomor).padStart(2, '0')}`;
      ids.push(id);
      pastikanNoUrut(d);
      d.pica.push({
        id, nomor, no_urut: Math.max(0, ...d.pica.map((p: Baris) => Number(p.no_urut) || 0)) + 1, periode_id: periodeId, bidang, prioritas: it.prioritas ?? 'Sedang', judul,
        akar: it.akar ?? null, tindakan: it.tindakan ?? null, pic_id: it.pic_id ?? null,
        due_date: it.due_date ?? null, status: it.status ?? 'Open', terkait_id: null,
        target: it.target ?? null, realisasi: it.realisasi ?? null, satuan: it.satuan ?? null,
        judul_singkat: it.judul_singkat ?? null, terkunci: 0, props: {}, dihapus: 0,
        dibuat_oleh: saya.id, dibuat_pada: kini(), ditutup_pada: null,
      });
      d.riwayat.push({ pica_id: id, kolom: 'dibuat', nilai_lama: null, nilai_baru: `Diimpor via CSV: ${judul}`, oleh: saya.id, pada: kini() });
    }
    if (!ids.length) gagal('Tidak ada data PICA yang valid untuk disimpan.', 400);
    simpan(); return { ok: true, jumlah: ids.length, ids };
  }

  // ----- alarm tenggat PICA -----
  if (path === "/api/pica-alarm" && method === "GET") {
    return { alarm: d.picaAlarm ?? [], jamBawaan: d.pengaturan["alarm_pica_jam"] ?? "07:00" };
  }
  if (path === "/api/pica-alarm" && method === "POST") {
    d.picaAlarm = (d.picaAlarm ?? []).filter((a: Baris) => a.pica_id !== body?.pica_id);
    d.picaAlarm.push({ pica_id: body?.pica_id, jam: body?.jam || d.pengaturan["alarm_pica_jam"] || "07:00", aktif: body?.aktif === false ? 0 : 1 });
    simpan(); return { ok: true };
  }
  if (path === "/api/pica-alarm/jam" && method === "POST") {
    d.pengaturan["alarm_pica_jam"] = String(body?.jam ?? "07:00");
    simpan(); return { ok: true, jamBawaan: d.pengaturan["alarm_pica_jam"] };
  }

  // ----- dokumen administrasi: nomor surat, Internal Memo dinas, MoM -----
  const DOKUMEN: Record<string, { daftar: () => Baris[]; kunci: string; pasang: (x: Baris[]) => void }> = {
    '/api/surat': { daftar: () => d.surat, kunci: 'surat', pasang: (x) => { d.surat = x; } },
    '/api/memo-dinas': { daftar: () => d.memoDinas, kunci: 'memoDinas', pasang: (x) => { d.memoDinas = x; } },
    '/api/mom': { daftar: () => d.mom, kunci: 'mom', pasang: (x) => { d.mom = x; } },
  };
  for (const [jalurDok, dok] of Object.entries(DOKUMEN)) {
    if (path === jalurDok && method === 'GET') return { [dok.kunci]: dok.daftar(), awalTerisi: dok.daftar().length > 0 };
    if (path === jalurDok && method === 'POST') {
      const isi = { ...body, dibuatPada: body?.dibuatPada ?? kini(), dibuatOleh: saya.id, dibuatOlehNama: saya.nama };
      const ada = dok.daftar().some((x) => x.id === isi.id);
      dok.pasang(ada ? dok.daftar().map((x) => (x.id === isi.id ? isi : x)) : [isi, ...dok.daftar()]);
      simpan(); return { ok: true, id: isi.id };
    }
    if (path === jalurDok + '/impor' && method === 'POST') {
      const masuk: Baris[] = Array.isArray(body?.daftar) ? body.daftar : [];
      const adaId = new Set(dok.daftar().map((x) => x.id));
      dok.pasang([...masuk.filter((x) => x?.id && !adaId.has(x.id)), ...dok.daftar()]);
      simpan(); return { jumlah: masuk.length };
    }
    if (path.startsWith(jalurDok + '/') && method === 'DELETE') {
      const id = decodeURIComponent(path.slice(jalurDok.length + 1));
      dok.pasang(dok.daftar().filter((x) => x.id !== id));
      simpan(); return { ok: true };
    }
  }

  if (path === '/api/profil/foto' && method === 'POST') {
    d.foto[saya.id] = String(body?.foto ?? '');
    simpan(); return { foto: d.foto[saya.id] };
  }
  if (path === '/api/profil/foto' && method === 'DELETE') {
    delete d.foto[saya.id];
    simpan(); return { foto: null };
  }

  // ----- game -----
  if (path === '/api/profil' && method === 'GET') return { profil: d.profil[saya.id] ?? null };
  if (path === '/api/profil' && method === 'POST') {
    const isi = { ...body };
    if ('status_teks' in isi) isi.status_teks = String(isi.status_teks ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || null;
    d.profil[saya.id] = { ...(d.profil[saya.id] ?? { user_id: saya.id, xp: 0, level: 1, skin_aktif: 'classic', skin_dimiliki: ['classic'], luas_tanam: 0 }), ...isi, terakhir_aktif: kini() };
    simpan(); return { ok: true };
  }
  if (path === '/api/kehadiran') {
    return { aktif: d.tim.map((t) => { const p = d.profil[t.id]; return p ? { userId: t.id, name: t.nama, skinId: p.skin_aktif, posX: p.pos_x ?? 50, posY: p.pos_y ?? 50, stamina: p.stamina ?? 100, level: p.level, status: p.status_teks ?? null } : null; }).filter(Boolean) };
  }
  if (path === '/api/peringkat') {
    return { peringkat: d.tim.map((t) => { const p = d.profil[t.id]; return { id: t.id, name: t.nama, xp: p?.xp ?? 0, level: p?.level ?? 1, totalHa: p?.luas_tanam ?? 0, lastActive: p?.terakhir_aktif ?? null }; }).sort((a, b) => b.xp - a.xp) };
  }
  if (path === '/api/misi' && method === 'GET') return { misi: d.misi.filter((x) => x.aktif !== 0).sort((a, b) => a.urutan - b.urutan) };
  if (path === '/api/misi' && method === 'POST') {
    if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh menambah misi.', 403);
    if (!body.judul) gagal('Judul misi wajib diisi.');
    const id = `m_${Date.now().toString(36)}`;
    d.misi.push({ id, judul: body.judul, tipe: body.tipe ?? 'NURSERY', deskripsi: body.deskripsi ?? null, target: Number(body.target ?? 100), satuan: body.satuan ?? 'Ha', xp: Number(body.xp ?? 500), kapasitas: Number(body.kapasitas ?? 1.66), urutan: d.misi.length + 1, aktif: 1, status: 'AVAILABLE', current: 0 });
    simpan(); return { id };
  }
  if ((m = path.match(/^\/api\/misi\/([\w-]+)\/mulai$/))) {
    const s = d.misi.find((x) => x.id === m![1]); if (s && s.status === 'AVAILABLE') s.status = 'IN_PROGRESS';
    simpan(); return { ok: true };
  }
  if ((m = path.match(/^\/api\/misi\/([\w-]+)\/tambah$/))) {
    const s = d.misi.find((x) => x.id === m![1]);
    if (s) {
      s.current = Math.min(Number(body.target ?? s.target), s.current + Number(body.nilai ?? 0));
      if (s.current >= Number(body.target ?? s.target)) s.status = 'COMPLETED';
    }
    const p = d.profil[saya.id];
    if (p) { p.xp += Math.floor(body.xp ?? 0); p.level = Math.floor(p.xp / 1000) + 1; p.luas_tanam += Number(body.luas ?? 0); }
    simpan(); return { ok: true, misi: s };
  }
  if ((m = path.match(/^\/api\/misi\/([\w-]+)$/))) {
    if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh mengubah misi.', 403);
    const s = d.misi.find((x) => x.id === m![1]); if (!s) gagal('Misi tidak ditemukan.', 404);
    if (method === 'DELETE') { (s as Baris).aktif = 0; simpan(); return { ok: true }; }
    for (const k of ['judul', 'tipe', 'deskripsi', 'target', 'satuan', 'xp', 'kapasitas', 'urutan', 'status', 'current']) if (k in body) (s as Baris)[k] = body[k];
    simpan(); return { ok: true };
  }

  // ----- roster -----
  if (path === '/api/roster' && method === 'GET') {
    const bulan = q.get('bulan') ?? hariIni.slice(0, 7);
    return { roster: d.roster.filter((r) => r.tanggal.startsWith(bulan)), bulan };
  }
  if (path === '/api/roster' && method === 'POST') {
    if (!body.user_id || !body.tanggal) gagal('user_id dan tanggal wajib diisi.');
    if (!bolehKelola(saya) && body.user_id !== saya.id) gagal('Hanya boleh mengubah roster sendiri.', 403);
    d.roster = d.roster.filter((r) => !(r.user_id === body.user_id && r.tanggal === body.tanggal));
    if (body.kode) d.roster.push({ user_id: body.user_id, tanggal: body.tanggal, kode: body.kode, catatan: body.catatan ?? null });
    simpan(); return { ok: true };
  }
  if (path === '/api/roster/isi' && method === 'POST') {
    if (!bolehKelola(saya)) gagal('Hanya Admin/Supervisor.', 403);
    let jumlah = 0;
    // Mode siklus (mis. 8 minggu kerja + 2 minggu libur): Minggu dan tanggal merah
    // di masa kerja tetap dihitung, tetapi diisi kode libur — sama dengan server.
    if (body.mode === 'siklus') {
      const hariKerja = Math.max(1, Math.round(body.mingguKerja ?? 8)) * 7;
      const panjang = hariKerja + Math.max(0, Math.round(body.mingguLibur ?? 2)) * 7;
      for (let t = body.dari; t <= body.sampai && jumlah < 400; t = geserHari(t, 1)) {
        const ke = ((selisihHari(t, body.dari) % panjang) + panjang) % panjang;
        const merah = d.libur.some((l) => l.tanggal === t);
        const minggu = new Date(t + 'T00:00:00Z').getUTCDay() === 0;
        const kode = ke < hariKerja && !minggu && !merah ? body.kode : (body.kodeLibur || 'OFF');
        d.roster = d.roster.filter((r) => !(r.user_id === body.user_id && r.tanggal === t));
        d.roster.push({ user_id: body.user_id, tanggal: t, kode, catatan: null });
        jumlah++;
      }
      simpan(); return { ok: true, jumlah };
    }
    for (let t = body.dari; t <= body.sampai && jumlah < 400; t = geserHari(t, 1)) {
      const hari = new Date(t + 'T00:00:00Z').getUTCDay();
      if (body.hari?.length && !body.hari.includes(hari)) continue;
      if (body.lewatiLibur && d.libur.some((l) => l.tanggal === t)) continue;
      d.roster = d.roster.filter((r) => !(r.user_id === body.user_id && r.tanggal === t));
      d.roster.push({ user_id: body.user_id, tanggal: t, kode: body.kode, catatan: null });
      jumlah++;
    }
    simpan(); return { ok: true, jumlah };
  }

  // ----- libur -----
  if (path === '/api/libur' && method === 'GET') {
    const tahun = q.get('tahun');
    const dari = q.get('dari') ?? (tahun ? `${tahun}-01-01` : '0000');
    const sampai = q.get('sampai') ?? (tahun ? `${tahun}-12-31` : '9999');
    return { libur: d.libur.filter((l) => l.tanggal >= dari && l.tanggal <= sampai).sort((a, b) => a.tanggal.localeCompare(b.tanggal)) };
  }
  if (path === '/api/libur' && method === 'POST') {
    if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh mengatur hari libur.', 403);
    if (!body.tanggal || !body.nama) gagal('Tanggal dan nama libur wajib diisi.');
    d.libur = d.libur.filter((l) => !(l.tanggal === body.tanggal && l.nama === body.nama));
    d.libur.push({ id: ++d.urut, tanggal: body.tanggal, nama: body.nama, jenis: body.jenis ?? 'perusahaan', perkiraan: 0 });
    simpan(); return { ok: true };
  }
  if ((m = path.match(/^\/api\/libur\/(\d+)$/)) && method === 'DELETE') {
    if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh mengatur hari libur.', 403);
    d.libur = d.libur.filter((l) => String(l.id) !== m![1]);
    simpan(); return { ok: true };
  }

  // ----- memo: pribadi & Memo Internal tim -----
  if (path === '/api/memo' && method === 'GET') {
    const lingkup = q.get('lingkup') === 'tim' ? 'tim' : 'pribadi';
    const daftar = d.memo
      .filter((x) => !x.dihapus_pada && (x.lingkup ?? 'pribadi') === lingkup && (lingkup === 'tim' || x.user_id === saya.id))
      .map((x): Baris => {
        const p = x.pica_id ? d.pica.find((y) => y.id === x.pica_id) : null;
        return {
          lingkup: 'pribadi', kategori: null, tipe: null, status: null, ringkasan: null, tanggal: null, pica_id: null, props: '{}',
          ...x, penulis: namaTim(d, x.user_id),
          pica_no: p?.no_urut ?? null, pica_judul: p?.judul ?? null, pica_status: p?.status ?? null,
        };
      })
      .sort((a, b) => (lingkup === 'tim'
        ? String(b.tanggal ?? b.dibuat_pada).localeCompare(String(a.tanggal ?? a.dibuat_pada))
        : (b.disematkan - a.disematkan) || String(b.diubah_pada ?? b.dibuat_pada).localeCompare(String(a.diubah_pada ?? a.dibuat_pada))));
    return { memo: daftar, lingkup };
  }
  if (path === '/api/memo' && method === 'POST') {
    let lingkup = body.lingkup === 'tim' ? 'tim' : 'pribadi';
    let akses = body.akses === 'baca' ? 'baca' : 'edit';
    // Sub-halaman: ikut lingkup & akses induknya; butuh hak edit di induk (sama dengan server).
    let indukId: string | null = null;
    if (typeof body.induk_id === 'string' && body.induk_id) {
      const induk = d.memo.find((y) => y.id === body.induk_id && !y.dihapus_pada) as Baris | undefined;
      const hakInduk = induk ? hakMemo({ user_id: induk.user_id, lingkup: induk.lingkup ?? 'pribadi', akses: induk.akses }, saya) : null;
      if (!induk || !hakInduk) gagal('Halaman induk tidak ditemukan.', 404);
      if (hakInduk === 'baca') gagal('Halaman induk diatur "Baca saja": sub-halaman tidak bisa ditambahkan.', 403);
      indukId = induk!.id;
      lingkup = induk!.lingkup === 'tim' ? 'tim' : 'pribadi';
      if (!('akses' in body)) akses = induk!.akses === 'baca' ? 'baca' : 'edit';
    }
    if (lingkup === 'tim' && saya.peran === 'pemantau') gagal('Peran Pemantau hanya bisa membaca memo tim.', 403);
    const id = idBaru('memo');
    const baru: Baris = {
      id, user_id: saya.id, lingkup, judul: body.judul ?? '', isi: body.isi ?? '', ringkasan: body.ringkasan ?? null,
      kategori: body.kategori ?? null, tipe: body.tipe ?? null, status: body.status ?? null,
      tanggal: body.tanggal ?? (lingkup === 'tim' ? hariIni : null), disematkan: 0, warna: body.warna ?? null,
      pica_id: picaSahDemo(d, body.pica_id), props: bersihkanPropsDemo(body.props),
      akses, induk_id: indukId, dihapus_pada: null, dihapus_oleh: null,
      dibuat_pada: kini(), diubah_pada: null,
    };
    d.memo.push(baru);
    if (baru.isi) sinkronJadwalMemoDemo(d, baru);
    simpan(); return { id, lingkup, akses, induk_id: indukId };
  }
  // ----- Sampah memo (sama dengan server/src/personal.ts) -----
  if (path === '/api/memo/sampah' && method === 'GET') {
    const batas = new Date(Date.now() - HARI_SAMPAH * 86_400_000).toISOString();
    const lama = d.memo.filter((y) => y.dihapus_pada && String(y.dihapus_pada) < batas);
    if (lama.length) {
      for (const y of lama) hapusIsiTerkaitMemoDemo(d, y.id);
      d.memo = d.memo.filter((y) => !lama.includes(y));
      simpan();
    }
    const terbuang = d.memo.filter((y) => y.dihapus_pada && ((y.lingkup ?? 'pribadi') === 'tim' || y.user_id === saya.id)) as (Baris & { id: string })[];
    const daftar = kepalaSampah(terbuang)
      .filter((y) => hakMemo({ user_id: y.user_id, lingkup: y.lingkup ?? 'pribadi', akses: y.akses }, saya) === 'penuh')
      .map((y): Baris => {
        const induk = y.induk_id ? d.memo.find((z) => z.id === y.induk_id && !z.dihapus_pada) : null;
        return { ...y, penulis: namaTim(d, y.user_id), penghapus: y.dihapus_oleh ? namaTim(d, y.dihapus_oleh) : null, induk_judul: induk?.judul ?? null };
      })
      .sort((a, b) => String(b.dihapus_pada).localeCompare(String(a.dihapus_pada)));
    return { memo: daftar, hari: HARI_SAMPAH };
  }
  if ((m = path.match(/^\/api\/memo\/([\w-]+)\/(pulihkan|permanen)$/))) {
    const x = d.memo.find((y) => y.id === m![1] && y.dihapus_pada) as Baris | undefined;
    const hak = x ? hakMemo({ user_id: x.user_id, lingkup: x.lingkup ?? 'pribadi', akses: x.akses }, saya) : null;
    if (!x || !hak) gagal('Memo tidak ada di Sampah.', 404);
    if (hak !== 'penuh') gagal('Hanya pembuat memo, Supervisor, atau Admin yang boleh mengatur memo ini di Sampah.', 403);
    if (m[2] === 'pulihkan' && method === 'POST') {
      const kelompok = pohonMemo(d.memo as (Baris & { id: string })[], x!.id, (c) => c.dihapus_pada === x!.dihapus_pada);
      const indukAda = x!.induk_id ? d.memo.some((z) => z.id === x!.induk_id && !z.dihapus_pada) : false;
      for (const y of kelompok) { y.dihapus_pada = null; y.dihapus_oleh = null; }
      if (x!.induk_id && !indukAda) x!.induk_id = null;
      for (const y of kelompok) if (y.isi) sinkronJadwalMemoDemo(d, y);
      simpan(); return { ok: true, jumlah: kelompok.length, induk_id: x!.induk_id ?? null };
    }
    if (m[2] === 'permanen' && method === 'DELETE') {
      const hapus = pohonMemo(d.memo as (Baris & { id: string })[], x!.id).filter((y) => y.dihapus_pada);
      for (const y of hapus) hapusIsiTerkaitMemoDemo(d, y.id);
      const ids = new Set(hapus.map((y) => y.id));
      d.memo = d.memo.filter((y) => !ids.has(y.id));
      for (const y of d.memo) if (y.induk_id && ids.has(y.induk_id)) y.induk_id = null;
      simpan(); return { ok: true, jumlah: ids.size };
    }
  }
  if ((m = path.match(/^\/api\/memo\/([\w-]+)$/))) {
    const x = d.memo.find((y) => y.id === m![1] && !y.dihapus_pada) as Baris | undefined;
    const hak = x ? hakMemo({ user_id: x.user_id, lingkup: x.lingkup ?? 'pribadi', akses: x.akses }, saya) : null;
    if (!x || !hak) gagal('Memo tidak ditemukan.', 404);
    if (method === 'DELETE') {
      if (hak !== 'penuh') gagal('Hanya pembuat memo, Supervisor, atau Admin yang boleh menghapus memo ini.', 403);
      // Halaman baru yang kosong dibuang langsung; selain itu pindah ke Sampah beserta sub-halamannya.
      if (q.get('kosong') === '1') {
        if (!memoKosong(x!) || d.memo.some((y) => y.induk_id === x!.id)) return { ok: true, dihapus: false };
        hapusIsiTerkaitMemoDemo(d, m![1]); d.memo = d.memo.filter((y) => y.id !== m![1]); simpan(); return { ok: true, dihapus: true };
      }
      const pohon = pohonMemo(d.memo as (Baris & { id: string })[], x!.id, (c) => !c.dihapus_pada);
      const waktu = kini();
      for (const y of pohon) {
        y.dihapus_pada = waktu; y.dihapus_oleh = saya.id;
        d.jadwal = d.jadwal.filter((j) => j.memo_id !== y.id);
      }
      simpan(); return { ok: true, sampah: true, jumlah: pohon.length };
    }
    if (hak === 'baca' && (!Object.keys(body ?? {}).every((k) => k === 'isi') || typeof body.isi !== 'string' || !hanyaCentangTugasSendiri(String(x!.isi ?? ''), body.isi, saya.id))) {
      gagal('Memo ini diatur "Baca saja" oleh pembuatnya. Anda hanya bisa mencentang tugas Anda sendiri.', 403);
    }
    if ('akses' in body && hak !== 'penuh') gagal('Hanya pembuat memo, Supervisor, atau Admin yang boleh mengatur akses.', 403);
    for (const k of ['judul', 'isi', 'disematkan', 'warna', 'ringkasan', 'kategori', 'tipe', 'status', 'tanggal', 'pica_id', 'props', 'akses']) {
      if (!(k in body)) continue;
      x![k] = k === 'disematkan' ? (body[k] ? 1 : 0) : k === 'pica_id' ? picaSahDemo(d, body[k]) : k === 'props' ? bersihkanPropsDemo(body[k])
        : k === 'akses' ? (body[k] === 'baca' ? 'baca' : 'edit') : body[k];
    }
    x!.diubah_pada = kini();
    if ('isi' in body || 'judul' in body) sinkronJadwalMemoDemo(d, x!);
    if (typeof body.judul === 'string') for (const y of d.memo) y.isi = gantiLabelHalaman(String(y.isi ?? ''), x!.id, body.judul);
    simpan(); return { ok: true };
  }

  // ----- PICA -----
  if (path === '/api/pica' && method === 'GET') {
    if (pastikanNoUrut(d)) simpan();
    const cari = (q.get('q') ?? '').toLowerCase();
    const daftar = d.pica.filter((p) => !p.dihapus
      && (!q.get('status') || p.status === q.get('status'))
      && (!q.get('bidang') || p.bidang === q.get('bidang'))
      && (!q.get('pic') || p.pic_id === q.get('pic'))
      && (!cari || `${p.judul} ${p.akar ?? ''} ${p.id}`.toLowerCase().includes(cari)))
      .sort((a, b) => (Number(b.no_urut) || 0) - (Number(a.no_urut) || 0))
      .map((p) => bentukPica(d, p, hariIni));
    return { pica: daftar, hariIni };
  }
  if (path === '/api/pica' && method === 'POST') {
    if (!body.judul || !body.bidang) gagal('Bidang dan uraian masalah wajib diisi.');
    const periode = d.pengaturan.periode_aktif;
    const nomor = Math.max(0, ...d.pica.filter((p) => p.periode_id === periode).map((p) => p.nomor)) + 1;
    const id = `PICA-${periode}-${String(nomor).padStart(2, '0')}`;
    pastikanNoUrut(d);
    const no_urut = Math.max(0, ...d.pica.map((p) => Number(p.no_urut) || 0)) + 1;
    d.pica.push({ id, nomor, no_urut, periode_id: periode, bidang: body.bidang, prioritas: body.prioritas ?? 'Sedang', judul: body.judul, akar: body.akar ?? null, tindakan: body.tindakan ?? null, pic_id: body.pic_id ?? null, due_date: body.due_date ?? null, status: body.status ?? 'Open', terkait_id: body.terkait_id ?? null, target: body.target ?? null, realisasi: body.realisasi ?? null, satuan: body.satuan ?? null, terkunci: 0, props: body.props ?? {}, ditutup_pada: null, dibuat_oleh: saya.id, dibuat_pada: kini(), diubah_oleh: null, diubah_pada: null, dihapus: 0 });
    d.riwayat.push({ id: ++d.urut, pica_id: id, kolom: 'dibuat', nilai_lama: null, nilai_baru: body.judul, alasan: null, oleh: saya.id, pada: kini() });
    simpan(); return { id, nomor };
  }
  if ((m = path.match(/^\/api\/pica\/([\w-]+)\/update$/))) {
    if (!body.catatan) gagal('Catatan perkembangan tidak boleh kosong.');
    d.updates.push({ id: ++d.urut, pica_id: m[1], periode_id: d.pengaturan.periode_aktif, catatan: body.catatan, realisasi: body.realisasi ?? null, oleh: saya.id, pada: kini() });
    if (typeof body.realisasi === 'number') { const p = d.pica.find((x) => x.id === m![1]); if (p) p.realisasi = body.realisasi; }
    simpan(); return { ok: true };
  }
  if ((m = path.match(/^\/api\/pica\/([\w-]+)$/))) {
    const p = d.pica.find((x) => x.id === m![1] && !x.dihapus);
    if (!p) gagal('PICA tidak ditemukan.', 404);
    const pica = p as Baris;
    if (method === 'GET') {
      return {
        pica: bentukPica(d, pica, hariIni),
        riwayat: d.riwayat.filter((r) => r.pica_id === pica.id).map((r) => ({ ...r, oleh_nama: namaTim(d, r.oleh) })).reverse(),
        updates: d.updates.filter((u) => u.pica_id === pica.id).map((u) => ({ ...u, oleh_nama: namaTim(d, u.oleh) })).reverse(),
        lampiran: d.lampiran.filter((l) => (l.entitas === 'pica' && l.entitas_id === pica.id)
          || (l.entitas === 'laporan' && d.laporan.some((x) => x.id === l.entitas_id && x.pica_id === pica.id))),
      };
    }
    if (method === 'DELETE') {
      if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh menghapus PICA.', 403);
      pica.dihapus = 1; simpan(); return { ok: true };
    }
    if (method === 'PATCH') {
      const terkunci = pica.terkunci === 1 || d.periode.find((x) => x.id === pica.periode_id)?.terkunci === 1;
      const kolom = ['bidang', 'prioritas', 'judul', 'akar', 'tindakan', 'pic_id', 'due_date', 'status', 'terkait_id', 'target', 'realisasi', 'satuan', 'props'];
      const perubahan: { k: string; dari: unknown; ke: unknown }[] = [];
      for (const k of kolom) {
        if (!(k in body)) continue;
        const baru = body[k];
        if (JSON.stringify(baru ?? null) === JSON.stringify(pica[k] ?? null)) continue;
        if (terkunci && (k === 'pic_id' || k === 'due_date')) {
          if (!bolehKelola(saya)) gagal(`${k === 'pic_id' ? 'PIC' : 'Due date'} sudah dikunci di rapat mingguan. Minta Admin atau Supervisor untuk mengubahnya.`, 409);
          if (!body.alasan) gagal('Kolom terkunci — isi alasan perubahan terlebih dulu.', 409);
        }
        perubahan.push({ k, dari: pica[k], ke: baru });
      }
      const tutup = perubahan.find((x) => x.k === 'status' && x.ke === 'Closed');
      if (tutup) {
        if (!d.lampiran.some((l) => l.entitas === 'pica' && l.entitas_id === pica.id)) gagal('Unggah bukti (foto/PDF) dulu sebelum menutup PICA ini.', 409);
        if (!bolehKelola(saya)) gagal('Penutupan harus diverifikasi Supervisor atau Admin. Ubah status ke "Verifikasi".', 409);
        pica.ditutup_pada = kini();
      }
      for (const x of perubahan) {
        pica[x.k] = x.ke;
        d.riwayat.push({ id: ++d.urut, pica_id: pica.id, kolom: x.k, nilai_lama: x.dari == null ? null : String(typeof x.dari === 'object' ? JSON.stringify(x.dari) : x.dari), nilai_baru: x.ke == null ? null : String(typeof x.ke === 'object' ? JSON.stringify(x.ke) : x.ke), alasan: body.alasan ?? null, oleh: saya.id, pada: kini() });
      }
      pica.diubah_oleh = saya.id; pica.diubah_pada = kini();
      simpan(); return { ok: true, perubahan: perubahan.length };
    }
  }
  if ((m = path.match(/^\/api\/periode\/([\w-]+)\/kunci$/))) {
    if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh mengunci periode.', 403);
    const per = d.periode.find((x) => x.id === m![1]);
    if (per) { per.terkunci = 1; per.dikunci_oleh = saya.id; per.dikunci_pada = kini(); }
    d.pica.forEach((p) => { if (p.periode_id === m![1]) p.terkunci = 1; });
    simpan(); return { ok: true, pesan: `Periode ${m[1]} dikunci. PIC dan due date kini butuh alasan untuk diubah.` };
  }
  if (path === '/api/properti' && method === 'POST') {
    if (!bolehKelola(saya)) gagal('Hanya Admin/Supervisor yang boleh menambah kolom.', 403);
    if (d.properti.some((p) => p.id === body.id)) gagal(`Kolom "${body.id}" sudah ada.`, 409);
    const entitas = body.entitas === 'memo' ? 'memo' : 'pica';
    if (entitas === 'memo' && !String(body.id).startsWith('m_')) gagal('id kolom memo harus berawalan m_.');
    d.properti.push({ id: body.id, label: body.label, tipe: body.tipe, opsi_json: body.opsi ? JSON.stringify(body.opsi) : null, urutan: d.properti.length + 1, tampil_di_tabel: 1, aktif: 1, entitas });
    simpan(); return { ok: true };
  }
  if (path === '/api/opsi' && method === 'POST') {
    if (!bolehKelola(saya)) gagal('Hanya Admin/Supervisor yang boleh menambah pilihan.', 403);
    d.opsi = d.opsi.filter((o) => !(o.grup === body.grup && o.nilai === body.nilai));
    d.opsi.push({ grup: body.grup, nilai: body.nilai, label: body.label ?? body.nilai, warna: body.warna ?? 'zinc', urutan: d.opsi.filter((o) => o.grup === body.grup).length + 1 });
    simpan(); return { ok: true };
  }

  // ----- pengumuman -----
  if (path === '/api/pengumuman' && method === 'GET') {
    return { pengumuman: [...d.pengumuman].reverse().map((p) => ({ ...p, oleh_nama: namaTim(d, p.oleh), jumlah_baca: d.baca.filter((b) => b.pengumuman_id === p.id).length, sudah_baca: d.baca.some((b) => b.pengumuman_id === p.id && b.user_id === saya.id) ? 1 : 0 })) };
  }
  if (path === '/api/pengumuman' && method === 'POST') {
    if (!bolehKelola(saya)) gagal('Hanya Admin/Supervisor yang boleh membuat pengumuman.', 403);
    const id = idBaru('peng');
    d.pengumuman.push({ id, judul: body.judul, isi: body.isi, penting: body.penting ? 1 : 0, kirim_wa: body.kirim_wa === false ? 0 : 1, oleh: saya.id, dibuat_pada: kini() });
    simpan(); return { id };
  }
  if ((m = path.match(/^\/api\/pengumuman\/([\w-]+)\/baca$/))) {
    if (!d.baca.some((b) => b.pengumuman_id === m![1] && b.user_id === saya.id)) d.baca.push({ pengumuman_id: m[1], user_id: saya.id });
    simpan(); return { ok: true };
  }

  // ----- jadwal & berbagi -----
  if (path === '/api/jadwal' && method === 'GET') return daftarJadwal(d, q.get('dari') ?? geserHari(hariIni, -7), q.get('sampai') ?? geserHari(hariIni, 60), false);
  if (path === '/api/jadwal' && method === 'POST') {
    if (!body.judul || !body.tanggal) gagal('Judul dan tanggal wajib diisi.');
    const id = idBaru('jdw');
    if (body.tanggal_selesai && body.tanggal_selesai < body.tanggal) gagal('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    d.jadwal.push({ id, judul: body.judul, keterangan: body.keterangan ?? null, tanggal: body.tanggal, tanggal_selesai: body.tanggal_selesai && body.tanggal_selesai !== body.tanggal ? body.tanggal_selesai : null, jam_mulai: body.jam_mulai ?? null, jam_selesai: body.jam_selesai ?? null, jenis: body.jenis ?? 'rencana', pica_id: body.pica_id ?? null, pemilik_id: body.untuk_semua ? null : (body.pemilik_id ?? saya.id), rrule: body.rrule ?? null, ingatkan_menit: body.ingatkan_menit ? Number(body.ingatkan_menit) : null, gcal_id: null, selesai: 0, dibuat_pada: kini() });
    simpan(); return { id };
  }
  if ((m = path.match(/^\/api\/jadwal\/([\w-]+)$/))) {
    if (method === 'DELETE') {
      const lama = d.jadwal.find((j) => j.id === m![1]);
      d.jadwal = d.jadwal.filter((j) => j.id !== m![1]);
      if (lama?.memo_id) cerminkanJadwalKeMemoDemo(d, lama, 'lepas');
      simpan(); return { ok: true };
    }
    const j = d.jadwal.find((x) => x.id === m![1]);
    if (!j) gagal('Jadwal tidak ditemukan.', 404);
    const jd = j as Baris;
    const hanyaCentang = Object.keys(body).every((k) => k === 'selesai');
    if (!hanyaCentang && jd.pemilik_id !== saya.id && !bolehKelola(saya)) gagal('Hanya pemilik jadwal, Supervisor, atau Admin yang boleh mengubahnya.', 403);
    if ('untuk_semua' in body) { jd.pemilik_id = body.untuk_semua ? null : (jd.pemilik_id ?? saya.id); }
    for (const k of ['judul', 'keterangan', 'tanggal', 'tanggal_selesai', 'jam_mulai', 'jam_selesai', 'jenis', 'rrule', 'ingatkan_menit']) if (k in body) jd[k] = body[k] ?? null;
    if ('selesai' in body) {
      jd.selesai = body.selesai ? 1 : 0;
      // Centang di Kalender dicerminkan ke teks memo asal (judul/tanggal/jam belum diubah di atas).
      if (jd.memo_id) cerminkanJadwalKeMemoDemo(d, jd, { selesai: Boolean(body.selesai) });
    }
    if (jd.tanggal_selesai && jd.tanggal_selesai < jd.tanggal) gagal('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    if (jd.tanggal_selesai === jd.tanggal) jd.tanggal_selesai = null;
    simpan(); return { ok: true };
  }
  if (path === '/api/bagi' && method === 'POST') {
    if (!bolehKelola(saya)) gagal('Hanya Admin/Supervisor yang boleh membagikan tautan.', 403);
    const token = 'demo-' + Math.random().toString(36).slice(2, 10);
    d.bagi.push(token); simpan();
    return { token, jalur: `/bagi/${token}`, kedaluwarsa: null };
  }
  if ((m = path.match(/^\/api\/bagi\/([\w-]+)\/kalender$/))) {
    return { ...daftarJadwal(d, q.get('dari') ?? geserHari(hariIni, -7), q.get('sampai') ?? geserHari(hariIni, 60), true), bacaSaja: true };
  }

  // ----- laporan & lampiran -----
  if (path === '/api/galeri' && method === 'GET') {
    const foto = d.lampiran
      .filter((l) => String(l.tipe_mime ?? '').startsWith('image/') && (l.entitas === 'laporan' || l.entitas === 'pica'))
      .map((l) => {
        const lap = l.entitas === 'laporan' ? d.laporan.find((x) => x.id === l.entitas_id) : null;
        const p = l.entitas === 'pica' ? d.pica.find((x) => x.id === l.entitas_id) : null;
        return {
          kunci: l.kunci_r2, sumber: l.entitas, pada: l.pada,
          ref: p ? p.id : (lap?.pica_id ?? lap?.jenis ?? null),
          judul: p ? (p.judul_singkat ?? p.judul) : (lap?.jenis ?? 'Laporan lapangan'),
          keterangan: p ? p.tindakan : (lap?.catatan ?? null),
          oleh: p ? namaTim(d, p.pic_id) : (lap?.user_nama ?? null),
        };
      })
      .sort((a, b) => String(b.pada).localeCompare(String(a.pada)))
      .slice(0, 12);
    return { foto };
  }
  if (path === '/api/laporan' && method === 'GET') {
    const foto = (id: string) => d.lampiran.find((l) => l.entitas === 'laporan' && l.entitas_id === id)?.kunci_r2 ?? null;
    return { laporan: [...d.laporan].reverse().map((l) => ({ ...l, foto: foto(l.id) })) };
  }
  if (path === '/api/laporan' && method === 'POST') {
    const capaian = Number(body.capaian ?? 0);
    const id = idBaru('lap');
    d.laporan.push({ id, user_id: saya.id, user_nama: saya.nama, pica_id: body.pica_id ?? null, jenis: body.jenis ?? 'Pekerjaan Rutin', capaian, satuan: body.satuan ?? 'ha', catatan: body.catatan ?? '', xp: 500 + Math.floor(capaian * 10), dibuat_pada: kini() });
    const pica = body.pica_id ? d.pica.find((x) => x.id === body.pica_id) : null;
    if (pica && capaian > 0) {
      const lama = Number(pica.realisasi ?? 0);
      pica.realisasi = Math.round((lama + capaian) * 1000) / 1000;
      pica.diubah_pada = kini();
      const catatan = [`${body.jenis ?? 'Laporan lapangan'}: +${capaian} ${body.satuan ?? pica.satuan ?? ''}`.trim(), String(body.catatan ?? '').trim()].filter(Boolean).join(' — ');
      d.updates.push({ id: ++d.urut, pica_id: pica.id, periode_id: pica.periode_id, catatan, realisasi: pica.realisasi, oleh: saya.id, pada: kini() });
      d.riwayat.push({ id: ++d.urut, pica_id: pica.id, kolom: 'realisasi', nilai_lama: String(lama), nilai_baru: String(pica.realisasi), alasan: 'laporan lapangan', oleh: saya.id, pada: kini() });
    }
    simpan(); return { id, xp: 500 + Math.floor(capaian * 10) };
  }
  if (path === '/api/lampiran' && method === 'POST') {
    const berkas = form?.get('berkas');
    const nama = berkas instanceof File ? berkas.name : 'berkas';
    const id = idBaru('lmp');
    const entitas = String(form?.get('entitas') ?? 'pica');
    const kunci = `demo/${form?.get('entitas_id')}/${Date.now()}`;
    if (berkas instanceof File && berkas.size > 8 * 1024 * 1024) gagal('Ukuran berkas maksimal 8 MB.');
    // Lampiran memo disimpan utuh di database demo supaya gambarnya tetap tampil.
    const data = entitas === 'memo' && berkas instanceof File ? await bacaSebagaiDataUrl(berkas) : undefined;
    d.lampiran.push({ id, entitas, entitas_id: String(form?.get('entitas_id') ?? ''), kunci_r2: kunci, nama, tipe_mime: berkas instanceof File ? berkas.type : null, ukuran: berkas instanceof File ? berkas.size : null, oleh: saya.id, pada: kini(), ...(data ? { data } : {}) });
    simpan(); return { id, kunci, url: `/api/berkas/${encodeURIComponent(kunci)}` };
  }

  // ----- realisasi revegetasi -----
  if (path === '/api/revegetasi' && method === 'GET') return { revegetasi: d.revegetasi ?? [], satuan: 'Ha' };
  if (path === '/api/revegetasi' && method === 'POST') {
    if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh mengubah angka realisasi.', 403);
    const tahun = Number(body?.tahun);
    if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) gagal('Tahun harus antara 2000 dan 2100.');
    const n = (x: unknown) => Math.max(0, Math.round((Number(x) || 0) * 1000) / 1000);
    const blok = Object.fromEntries(Object.entries(body?.blok ?? {}).map(([nama, luas]) => [nama, n(luas)]));
    const isi = { tahun, apl: n(body.apl), hutan: n(body.hutan), ipd: n(body.ipd), opd: n(body.opd), timbunan_soil: n(body.timbunan_soil), fasilitas: n(body.fasilitas), blok };
    d.revegetasi = [...(d.revegetasi ?? []).filter((r) => r.tahun !== tahun), isi].sort((a, b) => a.tahun - b.tahun);
    simpan(); return { ok: true, tahun };
  }

  if (path === '/api/notif/acara' && method === 'GET') {
    const tanggal = q.get('tanggal') || hariIni;
    const milik = d.jadwal.filter((j) => j.ingatkan_menit && !j.selesai && (!j.pemilik_id || j.pemilik_id === saya.id));
    return { acara: susunPengingatAcara(milik as BarisJadwal[], tanggal), tanggal };
  }

  // ----- pengaturan (Admin) -----
  if (path === '/api/pengaturan' && method === 'GET') {
    if (saya.peran !== 'admin') gagal('Hanya Admin.', 403);
    // Tanpa fonnte_terpasang: demo tidak tahu keadaan server sungguhan.
    return { pengaturan: Object.entries(d.pengaturan).map(([kunci, nilai]) => ({ kunci, nilai, catatan: null })) };
  }
  if (path === '/api/pengaturan' && method === 'POST') {
    if (saya.peran !== 'admin') gagal('Hanya Admin.', 403);
    // Seperti server: hanya kunci yang sudah ada yang diperbarui.
    for (const [kunci, nilai] of Object.entries(body ?? {})) if (kunci in d.pengaturan) d.pengaturan[kunci] = String(nilai);
    simpan(); return { ok: true };
  }

  // ----- notifikasi HP & rekap grup WA -----
  if (path === '/api/notif/ringkas' && method === 'GET') {
    const slot = q.get('slot');
    if (slot !== 'pagi' && slot !== 'siang' && slot !== 'sore') gagal('slot harus pagi, siang, atau sore.');
    return siapkanNotifDemo(d, saya, slot as Slot, hariIni);
  }
  if (path === '/api/notify/rekap-pica' && method === 'POST') {
    if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh mengirim rekap ke grup.', 403);
    const pesan = siapkanRekapDemo(d, q.get('jenis') === 'mingguan' ? 'mingguan' : 'harian', hariIni);
    if (q.get('dryRun') === '1') return { pesan, terkirim: false };
    if (!d.pengaturan.wa_grup_id) gagal('ID grup WhatsApp belum diisi di Pengaturan.');
    if (d.pengaturan.wa_aktif !== '1') gagal('Pengiriman WhatsApp masih dimatikan (pengaturan wa_aktif = 0).', 409);
    return { pesan, terkirim: false, demo: true };
  }
  // Cuaca contoh
  if (path === '/api/cuaca' && method === 'GET') return cuacaDemo(d.pengaturan.cuaca_adm4 || '63.05.09.2012');

  // Titik api (dalam mode demo dimulai dari kondisi bersih 0 titik)
  if (path === '/api/titik-api' && method === 'GET') {
    return {
      terpasang: false, aktif: false, kirim_wa: false, terakhir: null, galat: null, radius: { waspada: 2, pantau: 5 }, hari: 7,
      titik: [],
    };
  }
  if (path.startsWith('/api/titik-api/')) return { ok: true, baru: 0, diperingatkan: 0, galat: [] };

  // Fonnte hanya ada di server sungguhan; demo menjawab apa adanya.
  if (path === '/api/wa/status' && method === 'GET') {
    if (saya.peran !== 'admin') gagal('Hanya Admin.', 403);
    return { terpasang: false, galat: 'Mode demo tidak terhubung ke Fonnte.' };
  }
  if (path === '/api/wa/grup' && method === 'GET') {
    if (saya.peran !== 'admin') gagal('Hanya Admin.', 403);
    return { grup: [{ id: '120363000000000001@g.us', nama: 'Grup Koordinasi Lapangan' }] };
  }
  if (path === '/api/wa/uji' && method === 'POST') {
    if (saya.peran !== 'admin') gagal('Hanya Admin.', 403);
    gagal('Mode demo tidak mengirim WhatsApp. Uji kirim di aplikasi yang tersambung ke server.', 409);
  }
  // Web Push butuh server sungguhan (kunci VAPID); demo memakai notifikasi browser biasa.
  if (path === '/api/push/vapid') return { publicKey: '', aktif: false };

  // ----- katalog RAB RNR -----
  if (path === '/api/katalog-rab' && method === 'GET') {
    if (!Array.isArray(d.katalog)) d.katalog = [];
    // Lengkapi barang contoh yang belum ada (katalog demo lama tersimpan di perangkat);
    // barang yang dihapus pemakai tetap tercatat (aktif 0) sehingga tidak muncul lagi.
    const tambahan = katalogDemo().filter((k) => !d.katalog.some((x) => x.id === k.id));
    if (tambahan.length) {
      d.katalog.push(...tambahan);
      simpan();
    }
    return {
      katalog: d.katalog
        .filter((k) => k.aktif !== 0)
        .sort((a, b) => (Number(a.urutan) || 0) - (Number(b.urutan) || 0) || String(a.nama).localeCompare(String(b.nama))),
    };
  }
  if (path === '/api/katalog-rab' && method === 'POST') {
    if (!bolehKelola(saya)) gagal('Hanya Admin/Supervisor yang boleh mengubah katalog.', 403);
    if (!Array.isArray(d.katalog)) d.katalog = [];
    const nama = String(body?.nama ?? '').trim().slice(0, 120);
    if (!nama) gagal('Nama uraian wajib diisi.');
    const id = String(body?.id ?? '').replace(/[^\w-]/g, '').slice(0, 60) || `kat-${Date.now().toString(36)}`;
    const idx = d.katalog.findIndex((k) => k.id === id);
    const item = {
      id,
      kelompok: String(body?.kelompok ?? '').trim().slice(0, 60) || 'Pengajuan Rutin',
      nama,
      satuan: String(body?.satuan ?? '').trim().slice(0, 20) || 'Paket',
      harga: Math.max(0, Number(body?.harga) || 0),
      urutan: Math.round(Number(body?.urutan) || 50),
      wbs: String(body?.wbs ?? '').trim().slice(0, 40) || 'AB3.11-06.02.22.04',
      aktif: 1,
      // Kategori hanya diubah bila dikirim, sama seperti server.
      ...(body && 'kategori' in body ? { kategori: String(body.kategori || 'rnr') } : {}),
    };
    if (idx >= 0) d.katalog[idx] = { ...d.katalog[idx], ...item };
    else d.katalog.push(item);
    simpan();
    return { id };
  }
  if ((m = path.match(/^\/api\/katalog-rab\/([\w-]+)$/)) && method === 'DELETE') {
    if (!bolehKelola(saya)) gagal('Hanya Admin/Supervisor yang boleh mengubah katalog.', 403);
    if (Array.isArray(d.katalog)) {
      const item = d.katalog.find((k) => k.id === m![1]);
      if (item) item.aktif = 0;
      simpan();
    }
    return { ok: true };
  }

  // ----- tim -----
  if (/^\/api\/tim\/[\w-]+\/reset-password$/.test(path) && method === 'POST') {
    if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh mereset password.', 403);
    return { ok: true, pesan: 'Mode demo: password tidak disimpan, reset tidak berpengaruh.' };
  }
  if (path === '/api/tim' && method === 'GET') {
    return { tim: d.tim.map((t) => { const milik = d.pica.filter((p) => p.pic_id === t.id && !p.dihapus && p.status !== 'Closed'); return { id: t.id, nama: t.nama, jabatan: t.jabatan, bidang: t.bidang, peran: t.peran, aktif: 1, punya_wa: t.wa ? 1 : 0, pica_terbuka: milik.length, pica_telat: milik.filter((p) => p.due_date && p.due_date < hariIni).length, xp: d.profil[t.id]?.xp ?? 0 }; }).sort((a, b) => b.pica_telat - a.pica_telat || b.pica_terbuka - a.pica_terbuka) };
  }
  if (path === '/api/tim' && method === 'POST') {
    if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh menambah anggota.', 403);
    const id = String(body.id ?? '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!id || !body.nama) gagal('User ID (huruf kecil) dan nama wajib diisi.');
    if (d.tim.some((t) => t.id === id)) gagal(`User ID "${id}" sudah dipakai.`, 409);
    let wa = String(body.wa ?? '').replace(/[^0-9]/g, ''); if (wa.startsWith('0')) wa = '62' + wa.slice(1);
    d.tim.push({ id, nama: body.nama, jabatan: body.jabatan || null, bidang: body.bidang || null, wa: wa || null, peran: body.peran ?? 'anggota', aktif: 1 });
    d.profil[id] = { user_id: id, xp: 0, level: 1, skin_aktif: 'classic', skin_dimiliki: ['classic'], luas_tanam: 0, pos_x: 50, pos_y: 50, stamina: 100, terakhir_aktif: null };
    simpan(); return { id, pesan: `Anggota ${body.nama} dibuat. Bagikan kode undangan agar ia bisa membuat password.` };
  }
  if ((m = path.match(/^\/api\/tim\/([\w-]+)\/profil$/)) && method === 'GET') {
    const t = d.tim.find((x) => x.id === m![1]);
    if (!t) gagal('Anggota tidak ditemukan.', 404);
    const anggota = t as Baris;
    const sampai = geserHari(hariIni, 6);
    return {
      anggota: { id: anggota.id, nama: anggota.nama, jabatan: anggota.jabatan, bidang: anggota.bidang, peran: anggota.peran, wa: anggota.wa },
      profil: d.profil[anggota.id] ?? null,
      pica: d.pica
        .filter((p) => p.pic_id === anggota.id && !p.dihapus && p.status !== 'Closed')
        .sort(urutTenggat)
        .map((p) => ({ id: p.id, judul: p.judul, status: p.status, due_date: p.due_date, bidang: p.bidang })),
      roster: d.roster.filter((r) => r.user_id === anggota.id && r.tanggal >= hariIni && r.tanggal <= sampai),
      memo: d.memo
        .filter((x) => x.user_id === anggota.id && x.lingkup === 'tim')
        .sort((a, b) => String(b.tanggal ?? b.dibuat_pada).localeCompare(String(a.tanggal ?? a.dibuat_pada)))
        .slice(0, 3)
        .map(({ id, judul, ringkasan, kategori, status, tanggal }) => ({ id, judul, ringkasan, kategori, status, tanggal })),
      laporan: [...d.laporan].filter((l) => l.user_id === anggota.id).reverse().slice(0, 5),
      hariIni,
    };
  }
  if ((m = path.match(/^\/api\/tim\/([\w-]+)$/)) && method === 'PATCH') {
    const t = d.tim.find((x) => x.id === m![1]); if (!t) gagal('Anggota tidak ditemukan.', 404);
    if (saya.peran !== 'admin' && saya.id !== m[1]) gagal('Tidak berhak mengubah data anggota lain.', 403);
    if ('wa' in body) { let wa = String(body.wa ?? '').replace(/[^0-9]/g, ''); if (wa.startsWith('0')) wa = '62' + wa.slice(1); (t as Baris).wa = wa || null; }
    for (const k of ['jabatan', 'bidang', 'peran', 'nama']) if (k in body && saya.peran === 'admin') (t as Baris)[k] = body[k];
    simpan(); return { ok: true };
  }

  // ----- lapangan: nursery & geotag -----
  if (path === '/api/lapangan/nursery' && method === 'GET') {
    return {
      ok: true,
      ringkasan: {
        stok: 45200,
        stok_sahih: true,
        saringan: [],
        masuk: 62000,
        keluar: 15500,
        mati: 1300,
        mortalitas: 2.1,
        jml_jenis: 4,
        jml_baris: 128,
        masuk_hari_ini: 500,
        keluar_hari_ini: 0,
        mati_hari_ini: 5,
        hari_aktif: 45,
        dari: '2026-08-01',
        sampai: '2026-09-28',
      },
      jenis: [
        { nama: 'SENGON POTTING', masuk: 35000, keluar: 8000, mati: 600, stok: 26400, mortalitas: 1.71, status: 'Sehat', terakhir: '2026-09-28' },
        { nama: 'INDIGOFERA', masuk: 18000, keluar: 4500, mati: 400, stok: 13100, mortalitas: 2.22, status: 'Sehat', terakhir: '2026-09-28' },
        { nama: 'BUNGA SEPATU', masuk: 6000, keluar: 2000, mati: 200, stok: 3800, mortalitas: 3.33, status: 'Sehat', terakhir: '2026-09-28' },
        { nama: 'MALAPARI', masuk: 3000, keluar: 1000, mati: 100, stok: 1900, mortalitas: 3.33, status: 'Sehat', terakhir: '2026-09-25' },
      ],
      tujuan: [
        { tujuan: 'Blok 1 Pit Barat', total: 6500, persen: 41.9 },
        { tujuan: 'Blok 2 Lereng Utara', total: 4800, persen: 31.0 },
        { tujuan: 'Rehab DAS Riam Kanan', total: 4200, persen: 27.1 },
      ],
      tren: [
        { tanggal: '2026-09-24', masuk: 1200, keluar: 0, mati: 10, stok: 43500 },
        { tanggal: '2026-09-25', masuk: 0, keluar: 1000, mati: 20, stok: 42480 },
        { tanggal: '2026-09-26', masuk: 2000, keluar: 500, mati: 15, stok: 43965 },
        { tanggal: '2026-09-27', masuk: 800, keluar: 0, mati: 10, stok: 44755 },
        { tanggal: '2026-09-28', masuk: 500, keluar: 0, mati: 5, stok: 45200 },
      ],
      proyeksi: {
        ada: true,
        stok: 45200,
        laju_harian: 350.0,
        hari_tersisa: 129,
        perkiraan_habis: '2027-02-05',
      },
      diambil: `${jamWita()} WITA`,
      sumber: 'demo',
    };
  }

  if (path === '/api/lapangan/geotag' && method === 'GET') {
    return {
      ok: true,
      ringkasan: {
        total: 12450,
        sehat: 11200,
        merana: 530,
        mati: 720,
        persen_hidup: 94.2,
        persen_sehat: 89.9,
        berkoordinat: 12450,
        berfoto: 12100,
        tinggi_avg: 74.5,
        tinggi_min: 25.0,
        tinggi_max: 320.0,
      },
      karbon: {
        agb_kg: 17870,
        agb_ton: 17.87,
        karbon_kg: 8400,
        karbon_ton: 8.4,
        co2e_kg: 30800,
        co2e_ton: 30.8,
        batas: [
          'Diameter TIDAK diukur di lapangan; diduga dari tinggi pohon (allometrik).',
          'Kerapatan kayu dipukul rata 0,60 g/cm³ untuk semua jenis.',
          'Hanya biomassa ATAS TANAH (AGB). Akar, serasah, dan tanah tidak terhitung.',
          'Luas cakupan survei, bukan luas tutupan tanam riil.',
        ],
      },
      per_lokasi: [
        { lokasi: 'Blok 1 Reklamasi Pit Barat', total: 4200, sehat: 3950, merana: 150, mati: 100, persen_hidup: 97.6 },
        { lokasi: 'Blok 2 Lereng Utara', total: 3850, sehat: 3400, merana: 250, mati: 200, persen_hidup: 94.8 },
        { lokasi: 'Area Revegetasi DAS Riam Kanan', total: 2900, sehat: 2500, merana: 100, mati: 300, persen_hidup: 89.6 },
        { lokasi: 'Buffer Zone Selatan', total: 1500, sehat: 1350, merana: 30, mati: 120, persen_hidup: 92.0 },
      ],
      per_tanaman: [
        { tanaman: 'Sengon', total: 5800, persen: 46.6 },
        { tanaman: 'Johar', total: 2600, persen: 20.9 },
        { tanaman: 'Trembesi', total: 2100, persen: 16.9 },
        { tanaman: 'Malapari', total: 1200, persen: 9.6 },
        { tanaman: 'Lainnya', total: 750, persen: 6.0 },
      ],
      diambil: `${jamWita()} WITA`,
      sumber: 'demo',
    };
  }

  gagal(`Rute demo belum tersedia: ${method} ${path}`, 404);
}

/** Prakiraan tiruan 3 hari per 3 jam dalam bentuk yang sama dengan jawaban server. */
function cuacaDemo(adm4: string) {
  const POLA: [number, string, number, number][] = [ // kode, keterangan, suhu, mm hujan — per jam lokal 00,03,…,21
    [10, 'Udara Kabur', 23, 0], [10, 'Udara Kabur', 22, 0], [1, 'Cerah Berawan', 24, 0], [3, 'Berawan', 30, 0],
    [61, 'Hujan Sedang', 29, 4.2], [60, 'Hujan Ringan', 27, 1.1], [3, 'Berawan', 26, 0], [1, 'Cerah Berawan', 24, 0],
  ];
  const kini = Date.now();
  const tigaJam = 3 * 3600_000;
  const WITA = 480 * 60_000;
  const awal = Math.floor((kini + WITA) / tigaJam) * tigaJam - WITA; // awal slot berjalan (UTC)
  const slot: SlotCuaca[] = Array.from({ length: 24 }, (_, i) => {
    const t = awal + i * tigaJam;
    const lokal = new Date(t + WITA).toISOString().replace('T', ' ').slice(0, 16);
    const [kode, ket, suhu, mm] = i === 0 ? [61, 'Hujan Sedang', 26, 3.4] as const : POLA[Number(lokal.slice(11, 13)) / 3];
    return { utc: new Date(t).toISOString(), lokal, suhu, lembap: kode >= 60 ? 92 : 70, hujanMm: mm, awan: kode >= 60 ? 95 : 40, kode, ket, angin: 6, arah: 'SE' };
  });
  const lokasi = { adm4, desa: 'Pusat Proyek', kecamatan: 'Wilayah Operasional', kotkab: 'Area Lapangan', provinsi: 'Indonesia', lat: -2.983, lon: 115.238 };
  return susunJawabanCuaca({ lokasi, slot }, new Date(kini).toISOString(), kini);
}
