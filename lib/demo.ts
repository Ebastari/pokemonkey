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
import { hariIniWita, geserHari, selisihHari } from './waktu';
import { LIBUR_BAWAAN } from './libur';
import { REVEGETASI_BAWAAN } from './revegetasi';
import { susunJawabanCuaca, type SlotCuaca } from '../server/src/cuaca-bmkg';
import {
  susunNotifPagi, susunNotifSiang, susunNotifSore, susunRekapPica,
  susunPengingatAcara,
  type BarisJadwal, type NotifSiap, type Slot,
} from '../server/src/ringkasan';

const KUNCI_DEMO = 'pokemonkey_demo';
const KUNCI_DB = 'pokemonkey_demo_db';
/** Naikkan bila bentuk data berubah, agar demo lama di browser dibangun ulang. */
const VERSI = 12;

export function demoAktif(): boolean {
  try { return localStorage.getItem(KUNCI_DEMO) === '1'; } catch { return false; }
}
export function aktifkanDemo(): void {
  try { localStorage.setItem(KUNCI_DEMO, '1'); } catch { /* abaikan */ }
}
export function matikanDemo(): void {
  try { localStorage.removeItem(KUNCI_DEMO); localStorage.removeItem(KUNCI_DB); } catch { /* abaikan */ }
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
  surat: Baris[];
  memoDinas: Baris[];
  mom: Baris[];
  /** Foto profil demo: data URL per user, tidak pernah ke server mana pun. */
  foto: Record<string, string>;
  libur: Baris[];
  revegetasi: Baris[];
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

// ---------- Data awal: sama dengan server/migrations/0002_seed.sql ----------

function bentukAwal(): Db {
  const dibuat = '2026-09-05T02:00:00Z';
  const P = (nomor: number, bidang: string, prioritas: string, judul: string, akar: string, tindakan: string,
    pic_id: string, due_date: string, status: string, terkait_id: string | null,
    target: number | null, realisasi: number | null, satuan: string | null, props: Baris) => ({
    id: `PICA-26W36-${String(nomor).padStart(2, '0')}`, nomor, periode_id: '26W36', bidang, prioritas, judul, akar, tindakan,
    pic_id, due_date, status, terkait_id, target, realisasi, satuan, terkunci: 0, props,
    ditutup_pada: null, dibuat_oleh: 'agung', dibuat_pada: dibuat, diubah_oleh: null, diubah_pada: null, dihapus: 0,
  });

  const JUDUL_SINGKAT: Record<number, string> = {
    1: 'lahan siap untuk target tanam MT Okt–Des 2026', 2: 'bibit nangka', 3: 'sengon potting', 4: 'tabur LCC',
    5: 'bibit hidup di lapangan', 6: 'bibit indigofera hidup',
    7: 'komitmen 5.000 bibit lokal untuk satgas', 8: 'surat jalan distribusi bibit belum ditutup',
    9: 'target polybag potting belum diisi', 10: 'temuan titik api di area IPPKH',
  };
  const pica = [
    P(1, 'Revegetasi', 'Tinggi',
      'Target tanam MT Okt-Des 2026 dipangkas dari 47.120 batang (75,39 Ha) menjadi 19.125 batang (30,6 Ha). Area final OPD Blok III hanya 4 blok: 18,01 + 2,39 + 7,62 + 2,58 Ha.',
      'Ketersediaan lahan siap tanam tidak cukup (tertulis di slide 3).',
      'Minta jadwal pelepasan lahan tertulis dari Mine Plan/Engineering; usulkan area alternatif; ajukan revisi target resmi agar sisa 27.995 batang tidak hangus tanpa catatan.',
      'mariano', '2026-09-30', 'Open', null, 47120, 19125, 'batang', { blok: 'OPD Blok III', luas_ha: 30.6 }),
    P(2, 'Nursery', 'Tinggi',
      'Nangka baru 27% - realisasi 7.013 dari target 26.250 batang, kekurangan 19.237 batang. Deviasi T1 mencapai -97%.',
      'Nangka tidak ada sama sekali di 10 jenis stok persemaian (Smart Nursery per 04-09-2026).',
      'Tetapkan sumber bibit nangka (semai sendiri atau beli). Bila tidak layak, ajukan substitusi jenis secara formal - jangan dibiarkan menggantung.',
      'daniel', '2026-09-19', 'Open', null, 26250, 7013, 'batang', { jenis: 'Nangka' }),
    P(3, 'Revegetasi', 'Tinggi',
      'Sengon potting baru 55% - realisasi 34.312 dari 62.195 batang, kekurangan 27.883 batang. Deviasi T2 (-54%) lebih dalam daripada T1 (-34%).',
      'Terkait ketersediaan lahan (PICA no. 1); perlu konfirmasi apakah murni lahan atau juga kapasitas tanam.',
      'Pisahkan kekurangan akibat lahan dan akibat pasokan bibit/tenaga tanam, tampilkan terpisah di laporan minggu depan.',
      'agung', '2026-09-12', 'Open', 'PICA-26W36-01', 62195, 34312, 'batang', { jenis: 'Sengon' }),
    P(4, 'Revegetasi', 'Tinggi',
      'LCC baru 11% - realisasi 10,95 dari 100 Ha, kekurangan 89,05 Ha. Realisasi T2 -100% (tidak ada penanaman sama sekali).',
      'Belum dikonfirmasi: benih, alat tabur, atau kesiapan lahan.',
      'Tetapkan rencana tabur LCC per blok reklamasi berikut kebutuhan benihnya. LCC penutup tanah menahan erosi, tidak bisa digeser ke 2027.',
      'agung', '2026-09-30', 'Open', null, 100, 10.95, 'Ha', { jenis: 'LCC' }),
    P(5, 'Revegetasi', 'Sedang',
      'Persentase hidup bibit di lapangan 88% - dari 41.325 batang tertanam, 4.762 batang mati.',
      'Belum ada jadwal penyulaman untuk tanaman musim tanam Jan-Jun 2026.',
      'Susun rencana penyulaman 4.762 batang berikut kebutuhan bibitnya, masukkan ke musim tanam Okt-Des 2026.',
      'daniel', '2026-09-30', 'Open', null, 41325, 36563, 'batang', { mati: 4762, hidup_persen: 88 }),
    P(6, 'Nursery', 'Sedang',
      'Mortalitas indogofera 22,2% dari 2.000 batang, sementara sembilan jenis lain 0,0%.',
      'Belum dikonfirmasi: media semai, naungan, atau penyiraman.',
      'Periksa media dan naungan bedeng indogofera, catat penyebab kematian, laporkan di weekly berikutnya.',
      'daniel', '2026-09-12', 'Open', null, 2000, 1556, 'batang', { jenis: 'Indogofera', mortalitas_persen: 22.2 }),
    P(7, 'Nursery', 'Tinggi',
      'Komitmen 5.000 bibit lokal untuk satgas jatuh tempo 07-Sep-26, sedangkan stok jenis lokal non-sengon hanya 2.181 batang (malapari 918, tanjung 438, mahoni 302, pucuk merah 218, mangga 202, bunga sepatu 75, pete 28). Ditambah indogofera 2.000 pun baru 4.181.',
      'Stok persemaian tidak dipetakan ke komitmen sebelum tanggalnya ditetapkan.',
      'Konfirmasi ulang jumlah dan tanggal ke satgas hari ini, atau geser due date dengan pemberitahuan resmi.',
      'agung', '2026-09-07', 'Open', null, 5000, 4181, 'batang', { penerima: 'Satgas' }),
    P(8, 'Nursery', 'Rendah',
      'Administrasi distribusi bibit belum tertutup: 1 surat jalan menggantung (0 diterima) dan PDF siap 0 dari 1.',
      'Berkas serah terima bibit belum diunggah/ditutup di sistem.',
      'Tutup surat jalan yang menggantung dan unggah PDF-nya.',
      'daniel', '2026-09-12', 'Open', null, 1, 0, 'berkas', {}),
    P(9, 'Administrasi', 'Sedang',
      'PICA berjalan no. 2 (pengisian media polybag potting) jatuh tempo 31-Ago-26 dan sudah lewat, tanpa angka target dan tanpa status.',
      'Format tabel PICA di deck tidak punya kolom status/realisasi.',
      'Isi angka target polybag dan statusnya; tambahkan kolom Status pada tabel PICA di deck.',
      'daniel', '2026-09-12', 'Open', 'PICA-26W36-02', null, null, null, {}),
    P(10, 'Pemantauan titik Api Sipongi', 'Tinggi',
      'Temuan titk api di area IPPKH',
      'Banyak sumber api awal kebakaran berasal PPKH ATS',
      'Melaporkan ke dinas terkait berkordinasi dengan KPH dan PT Dwima Intiga',
      'daniel', '2026-09-13', 'Continue', null, null, null, null, {}),
  ];

  const J = (id: string, judul: string, tanggal: string, jam_mulai: string | null, jam_selesai: string | null,
    jenis: string, pemilik_id: string | null, rrule: string | null, keterangan: string | null = null, pica_id: string | null = null,
    ingatkan_menit: number | null = null) =>
    ({ id, judul, keterangan, tanggal, tanggal_selesai: null as string | null, jam_mulai, jam_selesai, jenis, pica_id, pemilik_id, rrule, ingatkan_menit, gcal_id: null, selesai: 0, dibuat_pada: dibuat });

  return {
    sesi: 'agung',
    tim: [
      { id: 'agung', nama: 'Agung Laksono', jabatan: 'Supervisor Revegetasi', bidang: 'Revegetasi', wa: '6281200000001', peran: 'admin', aktif: 1 },
      { id: 'daniel', nama: 'Daniel', jabatan: 'Staf Nursery', bidang: 'Nursery', wa: null, peran: 'anggota', aktif: 1 },
      { id: 'mariano', nama: 'Mariano A. Simamora', jabatan: 'Koordinator Lahan', bidang: 'Revegetasi', wa: '6281200000003', peran: 'supervisor', aktif: 1 },
    ],
    profil: {
      agung: { user_id: 'agung', xp: 1500, level: 2, skin_aktif: 'classic', skin_dimiliki: ['classic', 'manager'], luas_tanam: 5.2, pos_x: 40, pos_y: 55, stamina: 80, terakhir_aktif: kini() },
      daniel: { user_id: 'daniel', xp: 4200, level: 5, skin_aktif: 'botanist', skin_dimiliki: ['classic', 'botanist'], luas_tanam: 12.5, pos_x: 70, pos_y: 35, stamina: 60, terakhir_aktif: kini(), status_teks: 'Di blok 4, cek bibit sengon' },
      mariano: { user_id: 'mariano', xp: 2600, level: 3, skin_aktif: 'manager', skin_dimiliki: ['classic', 'manager'], luas_tanam: 8.1, pos_x: 25, pos_y: 70, stamina: 45, terakhir_aktif: kini(), status_teks: 'Rapat jam 2, jangan telat!' },
    },
    pica: pica.map((p) => ({ ...p, judul_singkat: JUDUL_SINGKAT[p.nomor] ?? null })),
    riwayat: pica.map((p, i) => ({ id: i + 1, pica_id: p.id, kolom: 'dibuat', nilai_lama: null, nilai_baru: p.judul, alasan: null, oleh: 'agung', pada: dibuat })),
    updates: [
      { id: 1, pica_id: 'PICA-26W36-10', periode_id: '26W36', catatan: 'Sudah lapor ke KPH lewat WA, menunggu jadwal patroli bersama PT Dwima Intiga.', realisasi: null, oleh: 'daniel', pada: '2026-09-10T03:20:00Z' },
    ],
    lampiran: [],
    pengumuman: [
      { id: 'peng_1', judul: 'Rapat mingguan pindah ke Jumat 07:30 WITA', isi: 'Mulai minggu ini weekly Rev DAS dilaksanakan Jumat pukul 07:30 di kantor nursery. Bawa update PICA masing-masing — kolom PIC dan due date akan dikunci saat rapat.', penting: 1, kirim_wa: 1, oleh: 'agung', dibuat_pada: '2026-09-14T01:00:00Z' },
      { id: 'peng_2', judul: 'Stok bibit lokal untuk satgas', isi: 'Konfirmasi jumlah bibit lokal non-sengon ke satgas paling lambat hari ini. Stok saat ini 2.181 batang + 2.000 indigofera.', penting: 0, kirim_wa: 1, oleh: 'agung', dibuat_pada: '2026-09-15T00:30:00Z' },
    ],
    baca: [{ pengumuman_id: 'peng_1', user_id: 'agung' }, { pengumuman_id: 'peng_1', user_id: 'mariano' }],
    jadwal: [
      J('jdw_apel', 'Apel pagi Senin', '2026-09-07', '07:00', '07:30', 'rencana', null, 'FREQ=WEEKLY', 'Lapangan nursery · seluruh tim', null, 15),
      J('jdw_weekly', 'Weekly Rev DAS', '2026-09-04', '07:30', '09:00', 'rapat', null, 'FREQ=WEEKLY', 'Kantor nursery. Bahas PICA lewat tenggat lebih dulu.', null, 30),
      J('jdw_1', 'Konfirmasi satgas bibit lokal', '2026-09-15', '10:00', '11:00', 'rencana', 'agung', null, 'Telepon satgas, sepakati jumlah & tanggal', 'PICA-26W36-07'),
      J('jdw_2', 'Cek bedeng indigofera', '2026-09-16', '09:00', '11:00', 'rencana', 'daniel', null, 'Periksa media & naungan, foto bukti', 'PICA-26W36-06'),
      J('jdw_3', 'Koordinasi Mine Plan: pelepasan lahan', '2026-09-17', '13:00', '14:30', 'rapat', 'mariano', null, 'Minta jadwal tertulis pelepasan lahan Blok III', 'PICA-26W36-01', 30),
      J('jdw_4', 'Tabur LCC Blok III', '2026-09-18', '08:00', '12:00', 'rencana', 'agung', null, 'Bawa benih 25 kg, tim 6 orang', 'PICA-26W36-04'),
      J('jdw_5', 'Patroli titik api bersama KPH', '2026-09-19', null, null, 'rencana', 'daniel', null, 'Sepanjang hari, area IPPKH', 'PICA-26W36-10', 1440),
      J('jdw_6', 'Penyulaman Blok II', '2026-09-22', '08:00', '15:00', 'rencana', null, null, 'Seluruh tim'),
      { ...J('jdw_7', 'Pelatihan K3 & P3K tim lapangan', '2026-09-21', null, null, 'rapat', null, null, 'Balai diklat, 08:00–16:00 setiap hari. Wajib untuk seluruh tim lapangan.'), tanggal_selesai: '2026-09-25' },
      { ...J('jdw_8', 'Dinas luar: koordinasi KPH & dinas kehutanan', '2026-09-28', null, null, 'rencana', 'daniel', null, 'Laporan titik api IPPKH', 'PICA-26W36-10'), tanggal_selesai: '2026-09-30' },
      { ...J('jdw_9', 'Audit reklamasi internal', '2026-10-05', null, null, 'rapat', null, null, 'Persiapan dokumen PICA & bukti penutupan'), tanggal_selesai: '2026-10-07' },
      J('jdw_10', 'Tutup laporan bulanan September', '2026-09-30', '13:00', '15:00', 'rencana', 'agung', null, 'Rekap realisasi & PICA'),
    ],
    laporan: [
      { id: 'lap_1', user_id: 'agung', user_nama: 'Agung Laksono', pica_id: 'PICA-26W36-04', jenis: 'Tabur LCC', capaian: 1.2, satuan: 'ha', catatan: 'Blok III sisi utara', xp: 512, dibuat_pada: '2026-09-11T08:00:00Z' },
      { id: 'lap_2', user_id: 'daniel', user_nama: 'Daniel', pica_id: null, jenis: 'Penyiraman', capaian: 1, satuan: 'hari', catatan: 'Rutin pagi-sore', xp: 516, dibuat_pada: '2026-09-12T09:30:00Z' },
    ],
    misi: [
      { id: 'm1', judul: 'Penataan Lahan (3 Bulan)', tipe: 'LAND_PREP', deskripsi: 'Menata 150ha lahan kritis agar siap ditanami. Membutuhkan waktu dan ketelitian.', target: 150, satuan: 'Ha', xp: 1000, kapasitas: 1.66, urutan: 1, aktif: 1, status: 'IN_PROGRESS', current: 23.4 },
      { id: 'm2_1', judul: '1. Persiapan Pekerja', tipe: 'NURSERY', deskripsi: 'Rekrut dan latih tim khusus persemaian.', target: 10000, satuan: 'bibit', xp: 200, kapasitas: 2000, urutan: 2, aktif: 1, status: 'COMPLETED', current: 10000 },
      { id: 'm2_2', judul: '2. Media Tanam', tipe: 'NURSERY', deskripsi: 'Mixing tanah topsoil, kompos, dan pasir.', target: 10000, satuan: 'bibit', xp: 300, kapasitas: 500, urutan: 3, aktif: 1, status: 'IN_PROGRESS', current: 6200 },
      { id: 'm2_3', judul: '3. Pengisian Polybag', tipe: 'NURSERY', deskripsi: 'Mengisi polybag dengan media yang telah disiapkan.', target: 10000, satuan: 'bibit', xp: 400, kapasitas: 400, urutan: 4, aktif: 1, status: 'AVAILABLE', current: 0 },
      { id: 'm2_6', judul: '6. Penyemaian Benih', tipe: 'NURSERY', deskripsi: 'Penanaman benih unggul Sengon ke tiap polybag.', target: 10000, satuan: 'bibit', xp: 500, kapasitas: 800, urutan: 5, aktif: 1, status: 'AVAILABLE', current: 0 },
      { id: 'm2_7', judul: '7. Pemeliharaan Rutin', tipe: 'NURSERY', deskripsi: 'Penyiraman intensif pagi dan sore.', target: 10000, satuan: 'bibit', xp: 450, kapasitas: 10000, urutan: 6, aktif: 1, status: 'AVAILABLE', current: 0 },
      { id: 'm2_10', judul: '10. Sertifikasi Bibit', tipe: 'NURSERY', deskripsi: 'Pemeriksaan akhir kesiapan bibit sebelum distribusi.', target: 10000, satuan: 'bibit', xp: 800, kapasitas: 2500, urutan: 7, aktif: 1, status: 'AVAILABLE', current: 0 },
      { id: 'm3', judul: 'Penanaman Masif', tipe: 'PLANTING', deskripsi: 'Menanam seluruh bibit ke 150ha lahan yang sudah siap.', target: 150, satuan: 'Ha', xp: 2500, kapasitas: 1.66, urutan: 8, aktif: 1, status: 'IN_PROGRESS', current: 12.5 },
    ],
    roster: bentukRoster(),
    memo: [
      { id: 'memo_1', user_id: 'agung', judul: 'Rencana minggu ini', isi: '# Fokus\n- [x] Konfirmasi satgas bibit lokal\n- [ ] Rencana tabur LCC per blok\n- [ ] Pisahkan kekurangan sengon: lahan vs bibit\n\n## Catatan\nMinta jadwal pelepasan lahan tertulis ke Mine Plan sebelum Rabu.', disematkan: 1, warna: 'amber', dibuat_pada: '2026-09-14T00:00:00Z', diubah_pada: '2026-09-15T01:00:00Z' },
      { id: 'memo_2', user_id: 'agung', judul: 'Catatan rapat 11 Sep', isi: '- Daniel: bedeng indigofera diperiksa Rabu\n- Mariano: koordinasi Mine Plan Rabu 13:00\n- Kolom PIC & due date dikunci Jumat\n\n**Ide**: XP besar untuk tutup PICA sebelum tenggat, bukan volume laporan.', disematkan: 0, warna: null, dibuat_pada: '2026-09-11T03:00:00Z', diubah_pada: null },
      { id: 'memo_3', user_id: 'daniel', judul: 'Cek harian nursery', isi: '- [ ] Siram pagi\n- [ ] Cek naungan bedeng 3\n- [ ] Foto stok nangka', disematkan: 1, warna: 'cyan', dibuat_pada: '2026-09-15T00:00:00Z', diubah_pada: null },
      // ---- Memo Internal (tim) ----
      { id: 'mtim_1', user_id: 'agung', lingkup: 'tim', kategori: 'Revegetasi', tipe: 'Keputusan', status: 'Sedang berlangsung', tanggal: '2026-09-05', judul: 'Revisi target tanam MT Okt–Des 2026', ringkasan: 'Target dipangkas ke 19.125 batang karena lahan siap tanam terbatas. Sisa 27.995 batang diajukan revisi resmi.', isi: '# Keputusan\n- Target MT Okt–Des 2026: **19.125 batang (30,6 Ha)**\n- Area final OPD Blok III: 4 blok\n\n# Tindak lanjut\n- [x] Minta jadwal pelepasan lahan ke Mine Plan\n- [ ] Ajukan revisi target resmi\n- [ ] Usulkan area alternatif', disematkan: 0, warna: null, dibuat_pada: '2026-09-05T02:00:00Z', diubah_pada: null },
      { id: 'mtim_2', user_id: 'daniel', lingkup: 'tim', kategori: 'Nursery', tipe: 'Pembaruan', status: 'Sedang berlangsung', tanggal: '2026-09-10', judul: 'Rencana sumber bibit nangka', ringkasan: 'Semai sendiri 12.000 batang, sisanya dari dua pemasok lokal. Keputusan substitusi paling lambat 19 September.', isi: '# Opsi\n- Semai sendiri: 12.000 batang (siap 10 minggu)\n- Pemasok A & B: penawaran 14.250 batang\n\n# Tenggat\nKeputusan substitusi jenis paling lambat **19 Sep 2026**.', disematkan: 0, warna: null, dibuat_pada: '2026-09-10T03:00:00Z', diubah_pada: null },
      { id: 'mtim_3', user_id: 'agung', lingkup: 'tim', kategori: 'Administrasi', tipe: 'Perubahan Kebijakan', status: 'Selesai', tanggal: '2026-09-08', judul: 'Tabel PICA wajib kolom Status & Realisasi', ringkasan: 'Mulai weekly 26W37, setiap PICA di deck mencantumkan status, target, dan realisasi.', isi: 'Berlaku mulai weekly **26W37**.\n\n- Kolom Status wajib diisi\n- Target & realisasi ditulis sebagai angka, bukan kalimat\n- PIC dan due date dikunci saat rapat', disematkan: 0, warna: null, dibuat_pada: '2026-09-08T01:00:00Z', diubah_pada: null },
      { id: 'mtim_4', user_id: 'mariano', lingkup: 'tim', kategori: 'Operasi & K3', tipe: 'Pengumuman', status: null, tanggal: '2026-09-12', judul: 'Pelatihan K3 & P3K 21–25 September', ringkasan: 'Wajib untuk seluruh tim lapangan di balai diklat. Bawa APD lengkap setiap hari.', isi: '# Jadwal\n21–25 Sep 2026, 08.00–16.00 WITA\n\n# Wajib dibawa\n- [ ] Helm & rompi\n- [ ] Sepatu safety\n- [ ] Buku catatan', disematkan: 0, warna: null, dibuat_pada: '2026-09-12T00:30:00Z', diubah_pada: null },
      { id: 'mtim_5', user_id: 'daniel', lingkup: 'tim', kategori: 'Operasi & K3', tipe: 'Rekap Rapat', status: 'Selesai', tanggal: '2026-09-11', judul: 'Rekap koordinasi titik api dengan KPH', ringkasan: 'Patroli bersama PT Dwima Intiga dijadwalkan 19 September; laporan ke dinas terkait lewat KPH.', isi: '# Peserta\n- KPH\n- PT Dwima Intiga\n- Tim Rev & Rehab\n\n# Hasil\n- Sumber api awal banyak berasal dari area PPKH ATS\n- Patroli bersama **19 Sep 2026**', disematkan: 0, warna: null, dibuat_pada: '2026-09-11T06:00:00Z', diubah_pada: null },
      { id: 'mtim_6', user_id: 'agung', lingkup: 'tim', kategori: 'Revegetasi', tipe: 'Rekap Rapat', status: 'Sedang berlangsung', tanggal: '2026-09-04', judul: 'Rekap weekly Rev DAS 4 September', ringkasan: '10 PICA diangkat. PIC dan due date masih usulan, dikunci pada rapat berikutnya.', isi: '- 10 PICA periode 26W36\n- 6 berprioritas tinggi\n- PIC & due date dikunci pada weekly 26W37', disematkan: 0, warna: null, dibuat_pada: '2026-09-04T08:00:00Z', diubah_pada: null },
    ],
    surat: [],
    memoDinas: [],
    mom: [],
    foto: {},
    versi: VERSI,
    libur: LIBUR_BAWAAN.map((l, i) => ({ id: i + 1, tanggal: l.tanggal, nama: l.nama, jenis: l.jenis, perkiraan: l.perkiraan ? 1 : 0 })),
    revegetasi: REVEGETASI_BAWAAN,
    opsi: [
      { grup: 'memo_kategori', nilai: 'Revegetasi', label: 'Revegetasi', warna: 'emerald', urutan: 1 },
      { grup: 'memo_kategori', nilai: 'Nursery', label: 'Nursery', warna: 'cyan', urutan: 2 },
      { grup: 'memo_kategori', nilai: 'Administrasi', label: 'Administrasi', warna: 'zinc', urutan: 3 },
      { grup: 'memo_kategori', nilai: 'Operasi & K3', label: 'Operasi & K3', warna: 'orange', urutan: 4 },
      { grup: 'memo_tipe', nilai: 'Perubahan Kebijakan', label: 'Perubahan Kebijakan', warna: 'purple', urutan: 1 },
      { grup: 'memo_tipe', nilai: 'Rekap Rapat', label: 'Rekap Rapat', warna: 'blue', urutan: 2 },
      { grup: 'memo_tipe', nilai: 'Pengumuman', label: 'Pengumuman', warna: 'indigo', urutan: 3 },
      { grup: 'memo_tipe', nilai: 'Pembaruan', label: 'Pembaruan', warna: 'cyan', urutan: 4 },
      { grup: 'memo_tipe', nilai: 'Keputusan', label: 'Keputusan', warna: 'amber', urutan: 5 },
      { grup: 'memo_status', nilai: 'Draf', label: 'Draf', warna: 'zinc', urutan: 1 },
      { grup: 'memo_status', nilai: 'Sedang berlangsung', label: 'Sedang berlangsung', warna: 'amber', urutan: 2 },
      { grup: 'memo_status', nilai: 'Selesai', label: 'Selesai', warna: 'emerald', urutan: 3 },
      { grup: 'roster', nilai: 'M', label: 'Masuk', warna: 'emerald', urutan: 1 },
      { grup: 'roster', nilai: 'S1', label: 'Shift 1', warna: 'cyan', urutan: 2 },
      { grup: 'roster', nilai: 'S2', label: 'Shift 2', warna: 'indigo', urutan: 3 },
      { grup: 'roster', nilai: 'L', label: 'Libur', warna: 'zinc', urutan: 4 },
      { grup: 'roster', nilai: 'C', label: 'Cuti', warna: 'amber', urutan: 5 },
      { grup: 'roster', nilai: 'I', label: 'Izin/Sakit', warna: 'red', urutan: 6 },
      { grup: 'bidang', nilai: 'Revegetasi', label: 'Revegetasi', warna: 'emerald', urutan: 1 },
      { grup: 'bidang', nilai: 'Nursery', label: 'Nursery', warna: 'cyan', urutan: 2 },
      { grup: 'bidang', nilai: 'Administrasi', label: 'Administrasi', warna: 'zinc', urutan: 3 },
      { grup: 'bidang', nilai: 'Pemantauan titik Api Sipongi', label: 'Pemantauan Titik Api', warna: 'orange', urutan: 4 },
      { grup: 'prioritas', nilai: 'Tinggi', label: 'Tinggi', warna: 'red', urutan: 1 },
      { grup: 'prioritas', nilai: 'Sedang', label: 'Sedang', warna: 'amber', urutan: 2 },
      { grup: 'prioritas', nilai: 'Rendah', label: 'Rendah', warna: 'zinc', urutan: 3 },
      { grup: 'status', nilai: 'Open', label: 'Open', warna: 'amber', urutan: 1 },
      { grup: 'status', nilai: 'In Progress', label: 'Dikerjakan', warna: 'blue', urutan: 2 },
      { grup: 'status', nilai: 'Continue', label: 'Continue', warna: 'indigo', urutan: 3 },
      { grup: 'status', nilai: 'Verifikasi', label: 'Menunggu Verifikasi', warna: 'purple', urutan: 4 },
      { grup: 'status', nilai: 'Closed', label: 'Selesai', warna: 'emerald', urutan: 5 },
      { grup: 'satuan', nilai: 'batang', label: 'batang', warna: 'zinc', urutan: 1 },
      { grup: 'satuan', nilai: 'Ha', label: 'Ha', warna: 'zinc', urutan: 2 },
      { grup: 'satuan', nilai: '%', label: '%', warna: 'zinc', urutan: 3 },
      { grup: 'satuan', nilai: 'berkas', label: 'berkas', warna: 'zinc', urutan: 4 },
    ],
    properti: [
      { id: 'blok', label: 'Blok reklamasi', tipe: 'teks', opsi_json: null, urutan: 1, tampil_di_tabel: 1, aktif: 1 },
      { id: 'jenis', label: 'Jenis tanaman', tipe: 'teks', opsi_json: null, urutan: 2, tampil_di_tabel: 1, aktif: 1 },
      { id: 'luas_ha', label: 'Luas (Ha)', tipe: 'angka', opsi_json: null, urutan: 3, tampil_di_tabel: 0, aktif: 1 },
      { id: 'no_surat', label: 'Nomor surat', tipe: 'teks', opsi_json: null, urutan: 4, tampil_di_tabel: 0, aktif: 1 },
    ],
    periode: [{ id: '26W36', mulai: '2026-08-31', selesai: '2026-09-04', judul: 'Weekly Rev DAS 31 Agt - 4 Sep 2026', sumber: 'LAPORAN KINERJA REV DAS WEEKLY 05-09-26.pptx', terkunci: 0, dikunci_oleh: null, dikunci_pada: null }],
    pengaturan: { zona_waktu: 'WITA', tz_offset_menit: '480', jam_pengingat: '07:00', jam_rekap_sore: '16:00', wa_grup_id: '', wa_aktif: '0', wa_jeda: '5-10', periode_aktif: '26W36', ambang_kpi_persen: '60', wa_pengingat_pribadi: '0', jam_notif_pagi: '07:00', jam_notif_siang: '12:00', jam_notif_sore: '17:00', cuaca_adm4: '63.05.09.2012' },
    bagi: [],
    urut: 100,
  };
}

/** Roster contoh September 2026: akhir pekan libur, Daniel bergilir shift, cuti 24–25. */
function bentukRoster(): Baris[] {
  const hasil: Baris[] = [];
  for (let h = 1; h <= 30; h++) {
    const tanggal = `2026-09-${String(h).padStart(2, '0')}`;
    const hari = new Date(tanggal + 'T00:00:00Z').getUTCDay();
    const minggu = Math.ceil(h / 7);
    for (const id of ['agung', 'daniel', 'mariano']) {
      let kode = hari === 0 || hari === 6 ? 'L' : 'M';
      if (id === 'daniel' && kode === 'M') kode = minggu % 2 ? 'S1' : 'S2';
      if (id === 'daniel' && (h === 24 || h === 25)) kode = 'C';
      if (id === 'mariano' && h === 17) kode = 'I';
      hasil.push({ user_id: id, tanggal, kode, catatan: id === 'mariano' && h === 17 ? 'Sakit' : null });
    }
  }
  return hasil;
}

// ---------- Penyimpanan ----------

let cache: Db | null = null;

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
    const id = String(body?.userId ?? '').toLowerCase();
    const t = d.tim.find((x) => x.id === id);
    if (!t) gagal('User ID atau password salah. (Demo: coba agung, daniel, atau mariano)', 401);
    d.sesi = id; simpan();
    return { token: 'demo-token', pengguna: pengguna(d), passwordBaruDibuat: false };
  }
  if (path === '/api/auth/logout') return { ok: true };
  if (path === '/api/me') return { pengguna: { ...saya, foto: d.foto[saya.id] ?? null } };

  if (path === '/api/bootstrap') {
    return {
      pengguna: { ...saya, foto: d.foto[saya.id] ?? null },
      opsi: d.opsi,
      properti: d.properti.filter((p) => p.aktif),
      tim: d.tim.map(({ id, nama, jabatan, bidang, peran }) => ({ id, nama, jabatan, bidang, peran, foto: d.foto[id] ?? null })),
      periode: d.periode, pengaturan: d.pengaturan, hariIni,
    };
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
      .filter((x) => (x.lingkup ?? 'pribadi') === lingkup && (lingkup === 'tim' || x.user_id === saya.id))
      .map((x): Baris => ({ lingkup: 'pribadi', kategori: null, tipe: null, status: null, ringkasan: null, tanggal: null, ...x, penulis: namaTim(d, x.user_id) }))
      .sort((a, b) => (lingkup === 'tim'
        ? String(b.tanggal ?? b.dibuat_pada).localeCompare(String(a.tanggal ?? a.dibuat_pada))
        : (b.disematkan - a.disematkan) || String(b.diubah_pada ?? b.dibuat_pada).localeCompare(String(a.diubah_pada ?? a.dibuat_pada))));
    return { memo: daftar, lingkup };
  }
  if (path === '/api/memo' && method === 'POST') {
    const lingkup = body.lingkup === 'tim' ? 'tim' : 'pribadi';
    if (lingkup === 'tim' && saya.peran === 'pemantau') gagal('Peran Pemantau hanya bisa membaca memo tim.', 403);
    const id = idBaru('memo');
    d.memo.push({
      id, user_id: saya.id, lingkup, judul: body.judul ?? '', isi: body.isi ?? '', ringkasan: body.ringkasan ?? null,
      kategori: body.kategori ?? null, tipe: body.tipe ?? null, status: body.status ?? null,
      tanggal: body.tanggal ?? (lingkup === 'tim' ? hariIni : null), disematkan: 0, warna: body.warna ?? null,
      dibuat_pada: kini(), diubah_pada: null,
    });
    simpan(); return { id };
  }
  if ((m = path.match(/^\/api\/memo\/([\w-]+)$/))) {
    const x = d.memo.find((y) => y.id === m![1]) as Baris | undefined;
    const tim = (x?.lingkup ?? 'pribadi') === 'tim';
    if (!x || (!tim && x.user_id !== saya.id)) gagal('Memo tidak ditemukan.', 404);
    if (x!.user_id !== saya.id && !(tim && bolehKelola(saya))) gagal('Hanya penulis, Supervisor, atau Admin yang boleh mengubah memo tim.', 403);
    if (method === 'DELETE') { d.memo = d.memo.filter((y) => y.id !== m![1]); simpan(); return { ok: true }; }
    for (const k of ['judul', 'isi', 'disematkan', 'warna', 'ringkasan', 'kategori', 'tipe', 'status', 'tanggal']) {
      if (k in body) x![k] = k === 'disematkan' ? (body[k] ? 1 : 0) : body[k];
    }
    x!.diubah_pada = kini();
    simpan(); return { ok: true };
  }

  // ----- PICA -----
  if (path === '/api/pica' && method === 'GET') {
    const cari = (q.get('q') ?? '').toLowerCase();
    const daftar = d.pica.filter((p) => !p.dihapus
      && (!q.get('status') || p.status === q.get('status'))
      && (!q.get('bidang') || p.bidang === q.get('bidang'))
      && (!q.get('pic') || p.pic_id === q.get('pic'))
      && (!cari || `${p.judul} ${p.akar ?? ''} ${p.id}`.toLowerCase().includes(cari)))
      .sort((a, b) => Number(a.status === 'Closed') - Number(b.status === 'Closed') || Number(!a.due_date) - Number(!b.due_date) || String(a.due_date).localeCompare(String(b.due_date)) || a.nomor - b.nomor)
      .map((p) => bentukPica(d, p, hariIni));
    return { pica: daftar, hariIni };
  }
  if (path === '/api/pica' && method === 'POST') {
    if (!body.judul || !body.bidang) gagal('Bidang dan uraian masalah wajib diisi.');
    const periode = d.pengaturan.periode_aktif;
    const nomor = Math.max(0, ...d.pica.filter((p) => p.periode_id === periode).map((p) => p.nomor)) + 1;
    const id = `PICA-${periode}-${String(nomor).padStart(2, '0')}`;
    d.pica.push({ id, nomor, periode_id: periode, bidang: body.bidang, prioritas: body.prioritas ?? 'Sedang', judul: body.judul, akar: body.akar ?? null, tindakan: body.tindakan ?? null, pic_id: body.pic_id ?? null, due_date: body.due_date ?? null, status: body.status ?? 'Open', terkait_id: body.terkait_id ?? null, target: body.target ?? null, realisasi: body.realisasi ?? null, satuan: body.satuan ?? null, terkunci: 0, props: body.props ?? {}, ditutup_pada: null, dibuat_oleh: saya.id, dibuat_pada: kini(), diubah_oleh: null, diubah_pada: null, dihapus: 0 });
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
    d.properti.push({ id: body.id, label: body.label, tipe: body.tipe, opsi_json: body.opsi ? JSON.stringify(body.opsi) : null, urutan: d.properti.length + 1, tampil_di_tabel: 1, aktif: 1 });
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
    if (method === 'DELETE') { d.jadwal = d.jadwal.filter((j) => j.id !== m![1]); simpan(); return { ok: true }; }
    const j = d.jadwal.find((x) => x.id === m![1]);
    if (!j) gagal('Jadwal tidak ditemukan.', 404);
    const jd = j as Baris;
    const hanyaCentang = Object.keys(body).every((k) => k === 'selesai');
    if (!hanyaCentang && jd.pemilik_id !== saya.id && !bolehKelola(saya)) gagal('Hanya pemilik jadwal, Supervisor, atau Admin yang boleh mengubahnya.', 403);
    if ('untuk_semua' in body) { jd.pemilik_id = body.untuk_semua ? null : (jd.pemilik_id ?? saya.id); }
    for (const k of ['judul', 'keterangan', 'tanggal', 'tanggal_selesai', 'jam_mulai', 'jam_selesai', 'jenis', 'rrule', 'ingatkan_menit']) if (k in body) jd[k] = body[k] ?? null;
    if ('selesai' in body) jd.selesai = body.selesai ? 1 : 0;
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
    const kunci = `demo/${form?.get('entitas_id')}/${Date.now()}`;
    d.lampiran.push({ id, entitas: String(form?.get('entitas') ?? 'pica'), entitas_id: String(form?.get('entitas_id') ?? ''), kunci_r2: kunci, nama, tipe_mime: berkas instanceof File ? berkas.type : null, ukuran: berkas instanceof File ? berkas.size : null, oleh: saya.id, pada: kini() });
    simpan(); return { id, kunci, url: `/api/berkas/${encodeURIComponent(kunci)}` };
  }

  // ----- realisasi revegetasi -----
  if (path === '/api/revegetasi' && method === 'GET') return { revegetasi: d.revegetasi ?? REVEGETASI_BAWAAN, satuan: 'Ha' };
  if (path === '/api/revegetasi' && method === 'POST') {
    if (saya.peran !== 'admin') gagal('Hanya Admin yang boleh mengubah angka realisasi.', 403);
    const tahun = Number(body?.tahun);
    if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) gagal('Tahun harus antara 2000 dan 2100.');
    const n = (x: unknown) => Math.max(0, Math.round((Number(x) || 0) * 1000) / 1000);
    const blok = Object.fromEntries(Object.entries(body?.blok ?? {}).map(([nama, luas]) => [nama, n(luas)]));
    const isi = { tahun, apl: n(body.apl), hutan: n(body.hutan), ipd: n(body.ipd), opd: n(body.opd), timbunan_soil: n(body.timbunan_soil), fasilitas: n(body.fasilitas), blok };
    d.revegetasi = [...(d.revegetasi ?? REVEGETASI_BAWAAN).filter((r) => r.tahun !== tahun), isi].sort((a, b) => a.tahun - b.tahun);
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
  // Cuaca contoh: pola khas Tapin musim hujan (siang-sore hujan). Slot yang
  // sedang berjalan sengaja dibuat hujan agar animasi hujan di KEBUN terlihat.
  if (path === '/api/cuaca' && method === 'GET') return cuacaDemo(d.pengaturan.cuaca_adm4 || '63.05.09.2012');

  // Titik api contoh (data FIRMS hanya ada di server sungguhan).
  if (path === '/api/titik-api' && method === 'GET') {
    const jamLalu = (j: number) => new Date(Date.now() - j * 3600_000).toISOString();
    return {
      terpasang: true, aktif: true, kirim_wa: true, terakhir: jamLalu(0.3), galat: null, radius: { waspada: 2, pantau: 5 }, hari: 7,
      titik: [
        { id: 'demo-1', sumber: 'VIIRS_NOAA20_NRT', lat: -2.9735, lon: 115.2175, waktu: jamLalu(5), keyakinan: 'tinggi', frp: 6.1, zona: 'ippkh', jarak_km: 0, bidang: 'SK.892', status: 'baru' },
        { id: 'demo-2', sumber: 'VIIRS_SNPP_NRT', lat: -3.0095, lon: 115.1890, waktu: jamLalu(29), keyakinan: 'sedang', frp: 3.4, zona: 'waspada', jarak_km: 1.8, bidang: null, status: 'padam', dicek_nama: 'Daniel' },
        { id: 'demo-3', sumber: 'VIIRS_NOAA21_NRT', lat: -3.5349, lon: 114.9410, waktu: jamLalu(3), keyakinan: 'tinggi', frp: 8.2, area: 'das', zona: 'petak', jarak_km: 0, bidang: 'PETAK 8 (2)', status: 'baru' },
      ],
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
    return { grup: [{ id: '120363000000000001@g.us', nama: 'Revegetasi EBL (contoh)' }, { id: '120363000000000002@g.us', nama: 'Nursery EBL (contoh)' }] };
  }
  if (path === '/api/wa/uji' && method === 'POST') {
    if (saya.peran !== 'admin') gagal('Hanya Admin.', 403);
    gagal('Mode demo tidak mengirim WhatsApp. Uji kirim di aplikasi yang tersambung ke server.', 409);
  }
  // Web Push butuh server sungguhan (kunci VAPID); demo memakai notifikasi browser biasa.
  if (path === '/api/push/vapid') return { publicKey: '', aktif: false };

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
  const lokasi = { adm4, desa: 'Linuh (contoh)', kecamatan: 'Bungur', kotkab: 'Tapin', provinsi: 'Kalimantan Selatan', lat: -2.983, lon: 115.238 };
  return susunJawabanCuaca({ lokasi, slot }, new Date(kini).toISOString(), kini);
}
