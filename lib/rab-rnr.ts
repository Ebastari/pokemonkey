/**
 * RAB RNR (Money Monkey): Rencana Anggaran Bulanan Departemen RNR.
 *
 * Satu baris = satu uraian (mis. "Kunjungan Verifikasi PNBP PKH SK 892") dengan
 * kode WBS, satuan, harga satuan, dan jumlah per minggu (I–IV). Uraian yang
 * sama di beberapa minggu tetap satu baris. Ekspor hanya lembar rekap
 * (public/template-rab-rnr.xlsx, disiapkan dari template RAB HCGA).
 *
 * Data disimpan di perangkat; nomor RAB dicatat di Data Surat (kategori RAB).
 */

import { TemplatXlsx } from './xlsx-templat';
import { DAFTAR_BULAN } from './rab-hcga';

export type StatusRab = 'Draf' | 'Diajukan' | 'Verifikasi' | 'Disetujui' | 'Dicairkan' | 'Ditolak';
export const DAFTAR_STATUS_RAB: StatusRab[] = ['Draf', 'Diajukan', 'Verifikasi', 'Disetujui', 'Dicairkan', 'Ditolak'];

/** Kode WBS dari lembar WBS template (deskripsi ditulis langsung di rekap). */
export const DAFTAR_WBS: { kode: string; deskripsi: string }[] = [
  ['AB3.11-06.02.22.04', 'Revegetasi R&R/Divisi/Operational Expense'],
  ['AB3.11-06.02.22.02', 'Revegetasi R&R/Divisi/Perjalanan Dinas'],
  ['AB3.11-06.02.22.01', 'Revegetasi R&R/Divisi/Training'],
  ['AB3.11-06.02.11.04', 'Operation/Divisi/Operational Expense'],
  ['AB3.11-06.02.11.05', 'Operation/Divisi/Perizinan'],
  ['AB3.11-06.02.11.03', 'Operation/Divisi/Konsultan/Eksternal'],
  ['AB3.11-06.02.11.02', 'Operation/Divisi/Perjalanan Dinas'],
  ['AB3.11-06.02.11.01', 'Operation/Divisi/Training'],
  ['AB3.11-06.02.13.04', 'SHE/Divisi/Operational Expense'],
  ['AB3.11-06.02.13.05', 'SHE/Divisi/Perizinan'],
  ['AB3.11-06.02.13.03', 'SHE/Divisi/Konsultan/Eksternal'],
  ['AB3.11-06.02.13.02', 'SHE/Divisi/Perjalanan Dinas'],
  ['AB3.11-06.02.13.01', 'SHE/Divisi/Training'],
  ['AB3.11-06.02.15.04', 'CSR/Divisi/Operational Expense'],
  ['AB3.11-06.02.15.02', 'CSR/Divisi/Perjalanan Dinas'],
  ['AB3.11-06.02.15.01', 'CSR/Divisi/Training'],
  ['AB3.11-06.02.10.04', 'HRGS Site/Divisi/Operational Expense'],
  ['AB3.11-06.02.10.02', 'HRGS Site/Divisi/Perjalanan Dinas'],
  ['AB3.11-06.02.10.01', 'HRGS Site/Divisi/Training'],
  ['AB3.11-06.02.09.04', 'PPIC/Divisi/Operational Expense'],
  ['AB3.11-06.02.09.02', 'PPIC/Divisi/Perjalanan Dinas'],
  ['AB3.11-06.02.09.01', 'PPIC/Divisi/Training'],
  ['AB3.11-06.02.12.04', 'Gudang Handak/Divisi/Operational Expense'],
  ['AB3.11-06.02.12.02', 'Gudang Handak/Divisi/Perjalanan Dinas'],
  ['AB3.11-06.02.12.01', 'Gudang Handak/Divisi/Training'],
].map(([kode, deskripsi]) => ({ kode, deskripsi }));
export const WBS_BAWAAN = 'AB3.11-06.02.22.04';
export const deskripsiWbs = (kode: string) => DAFTAR_WBS.find((w) => w.kode === kode.trim())?.deskripsi ?? '';

export interface UraianRab {
  id: string;
  uraian: string;
  wbs: string;
  satuan: string;
  harga: number;
  /** Jumlah per minggu I–IV. */
  qty: [number, number, number, number];
}

/**
 * Satu ajuan di papan RAB: uraian + minggu pengajuannya + qty.
 * minggu 0 = masih di keranjang (belum disusun); 1–4 = Minggu I–IV.
 */
export interface KartuRab {
  id: string;
  uraian: string;
  wbs: string;
  satuan: string;
  harga: number;
  minggu: 0 | 1 | 2 | 3 | 4;
  qty: number;
}

export interface RabRnr {
  id: string;
  nomorRab: string;
  nomorUrut: number;
  judul: string;
  bulan: string;
  tahun: number;
  lokasi: string;
  kepada: string;
  up: string;
  tanggal: string;
  /** Penyetuju utama (selalu): Eng & Opr. Div Head. */
  penyetujuDivHead?: string;
  jabatanDivHead?: string;
  /** Verifikasi: Finance Site. */
  verifikasiNama?: string;
  jabatanVerifikasi?: string;
  /** Disetujui oleh Pimpinan Site. */
  pimpinanNama?: string;
  jabatanPimpinan?: string;
  /** Penyetuju kedua, hanya bila total > Rp 25 juta. */
  penyetuju: string;
  jabatanPenyetuju: string;
  catatan: string;
  status: StatusRab;
  /** Cara mengisi: otomatis (katalog → keranjang → papan minggu) atau manual (tabel). */
  mode?: 'otomatis' | 'manual';
  /** Ajuan per minggu (papan) — sumber data utama. */
  kartu?: KartuRab[];
  /** Bentuk lama (satu baris per uraian, qty per minggu); dibaca bila `kartu` belum ada. */
  uraian: UraianRab[];
  pemohonId: string;
  pemohonNama: string;
  dibuatPada: string;
  diubahPada: string;
}

/** Di atas batas ini (lebih dari Rp 25 juta) RAB juga harus disetujui Operation & HCA Director. */
export const BATAS_PERSETUJUAN = 25_000_000;
export const PENYETUJU_DIV_HEAD = { nama: 'Cecep H. Setiadi', jabatan: 'Eng & Opr. Div Head' };
export const PENYETUJU_DIREKTUR = { nama: 'Rahmad Pudjotomo', jabatan: 'Operation & HCA Director' };
export const PENYETUJU_VERIFIKASI = { nama: 'Azmi Rahmadi & M.', jabatan: 'Finance Site' };
export const PENYETUJU_PIMPINAN = { nama: 'Bambang Octaryono', jabatan: 'Pimpinan Site' };

const hariIni = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
export const idUraian = () => `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function rabBaru(p: { bulan: string; tahun: number; nomorRab: string; nomorUrut: number; lokasi: string; judul: string; pemohonId: string; pemohonNama: string }): RabRnr {
  const kini = new Date().toISOString();
  return {
    id: `rabrnr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nomorRab: p.nomorRab, nomorUrut: p.nomorUrut, judul: p.judul, bulan: p.bulan, tahun: p.tahun, lokasi: p.lokasi,
    kepada: 'Finance HO', up: 'Operation & HCA Director', tanggal: hariIni(),
    penyetujuDivHead: PENYETUJU_DIV_HEAD.nama, jabatanDivHead: PENYETUJU_DIV_HEAD.jabatan,
    verifikasiNama: PENYETUJU_VERIFIKASI.nama, jabatanVerifikasi: PENYETUJU_VERIFIKASI.jabatan,
    pimpinanNama: PENYETUJU_PIMPINAN.nama, jabatanPimpinan: PENYETUJU_PIMPINAN.jabatan,
    penyetuju: PENYETUJU_DIREKTUR.nama, jabatanPenyetuju: PENYETUJU_DIREKTUR.jabatan, catatan: '',
    status: 'Draf', kartu: [], uraian: [], pemohonId: p.pemohonId, pemohonNama: p.pemohonNama, dibuatPada: kini, diubahPada: kini,
  };
}

const samaUraian = (a: { uraian: string; wbs: string; satuan: string; harga: number }, b: typeof a) =>
  a.uraian.trim().toLowerCase() === b.uraian.trim().toLowerCase() && a.wbs === b.wbs && a.satuan === b.satuan && a.harga === b.harga;

/** Kartu papan; RAB bentuk lama diubah jadi kartu per minggu. */
export function kartuRab(r: RabRnr): KartuRab[] {
  if (r.kartu) return r.kartu;
  return r.uraian.flatMap((u) => u.qty.flatMap((q, m) => (q ? [{
    id: `${u.id}-m${m + 1}`, uraian: u.uraian, wbs: u.wbs, satuan: u.satuan, harga: u.harga, minggu: (m + 1) as KartuRab['minggu'], qty: q,
  }] : [])));
}

/**
 * Baris rekap Excel: kartu yang sudah disusun (minggu 1–4) dengan uraian sama
 * (nama, WBS, satuan, harga) digabung jadi satu baris, qty per minggu dijumlah.
 */
export function barisRekap(r: RabRnr): UraianRab[] {
  const baris: UraianRab[] = [];
  for (const k of kartuRab(r)) {
    if (!k.minggu) continue;
    // Baris kosong (uraian belum diisi) tidak digabung dengan baris lain.
    let b = k.uraian.trim() ? baris.find((x) => x.uraian.trim() && samaUraian(x, k)) : undefined;
    if (!b) {
      b = { id: k.id, uraian: k.uraian, wbs: k.wbs || WBS_BAWAAN, satuan: k.satuan, harga: k.harga, qty: [0, 0, 0, 0] };
      baris.push(b);
    }
    b.qty[k.minggu - 1] += k.qty;
  }
  return baris;
}

export const nilaiMinggu = (u: UraianRab, m: number) => (u.qty[m] ?? 0) * (u.harga ?? 0);
export const totalUraian = (u: UraianRab) => [0, 1, 2, 3].reduce((n, m) => n + nilaiMinggu(u, m), 0);
export const totalMinggu = (r: RabRnr, m: number) => barisRekap(r).reduce((n, u) => n + nilaiMinggu(u, m), 0);
export const totalRab = (r: RabRnr) => barisRekap(r).reduce((n, u) => n + totalUraian(u), 0);
export const isiKeranjang = (r: RabRnr) => kartuRab(r).filter((k) => !k.minggu);
/** true bila total lebih dari Rp 25 juta: kotak persetujuan kedua (Pak Rahmad) ikut diisi. */
export const perluDirektur = (r: RabRnr) => totalRab(r) > BATAS_PERSETUJUAN;

export const idKartu = () => `k-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

/** ADD dari katalog: masuk keranjang dengan qty 1; uraian yang sudah di keranjang qty-nya bertambah. */
export function tambahKeKeranjang(r: RabRnr, x: { uraian: string; wbs: string; satuan: string; harga: number; qty?: number }): RabRnr {
  const kartu = kartuRab(r).map((k) => ({ ...k }));
  const ada = kartu.find((k) => !k.minggu && samaUraian(k, x));
  if (ada) ada.qty += x.qty ?? 1;
  else kartu.push({ id: idKartu(), uraian: x.uraian.trim(), wbs: x.wbs || WBS_BAWAAN, satuan: x.satuan || 'Paket', harga: x.harga, minggu: 0, qty: x.qty ?? 1 });
  return { ...r, kartu };
}

/** Pindahkan kartu ke minggu lain (0 = keranjang); kartu sama di minggu tujuan digabung. */
export function pindahKartu(r: RabRnr, id: string, minggu: KartuRab['minggu']): RabRnr {
  const kartu = kartuRab(r).map((k) => ({ ...k }));
  const k = kartu.find((x) => x.id === id);
  if (!k || k.minggu === minggu) return r;
  const tujuan = kartu.find((x) => x.id !== id && x.minggu === minggu && samaUraian(x, k));
  if (tujuan) {
    tujuan.qty += k.qty;
    return { ...r, kartu: kartu.filter((x) => x.id !== id) };
  }
  k.minggu = minggu;
  return { ...r, kartu };
}

/** Susun RAB: semua isi keranjang masuk Minggu I (lalu pengguna menyesuaikan). */
export function susunRab(r: RabRnr): RabRnr {
  let hasil: RabRnr = { ...r, kartu: kartuRab(r) };
  for (const k of isiKeranjang(hasil)) hasil = pindahKartu(hasil, k.id, 1);
  return hasil;
}

export const ubahKartu = (r: RabRnr, id: string, patch: Partial<KartuRab>): RabRnr =>
  ({ ...r, kartu: kartuRab(r).map((k) => (k.id === id ? { ...k, ...patch } : k)) });
export const hapusKartu = (r: RabRnr, id: string): RabRnr => ({ ...r, kartu: kartuRab(r).filter((k) => k.id !== id) });

// ------------------------------------------------------------------ tabel isian (sinkron dengan papan)

/** Kartu yang membentuk satu baris tabel (baris diwakili id kartu pertamanya). */
function anggotaBaris(r: RabRnr, idBaris: string): KartuRab[] {
  const semua = kartuRab(r);
  const wakil = semua.find((k) => k.id === idBaris);
  if (!wakil) return [];
  if (!wakil.uraian.trim()) return [wakil];
  return semua.filter((k) => k.minggu && k.uraian.trim() && samaUraian(k, wakil));
}

/** Ubah uraian/WBS/satuan/harga satu baris tabel → semua kotaknya di papan ikut berubah. */
export function ubahBaris(r: RabRnr, idBaris: string, patch: Partial<Pick<KartuRab, 'uraian' | 'wbs' | 'satuan' | 'harga'>>): RabRnr {
  const ids = new Set(anggotaBaris(r, idBaris).map((k) => k.id));
  return { ...r, kartu: kartuRab(r).map((k) => (ids.has(k.id) ? { ...k, ...patch } : k)) };
}

/** Atur qty satu baris tabel di minggu m (1–4): kotak minggu itu dibuat, diubah, atau dihapus. */
export function aturQtyBaris(r: RabRnr, idBaris: string, m: 1 | 2 | 3 | 4, qty: number): RabRnr {
  const anggota = anggotaBaris(r, idBaris);
  if (!anggota.length) return r;
  const diMinggu = anggota.filter((k) => k.minggu === m);
  let kartu = kartuRab(r).filter((k) => !diMinggu.slice(1).some((x) => x.id === k.id));
  if (diMinggu.length) {
    const utama = diMinggu[0];
    // Kotak terakhir sebuah baris tidak dihapus supaya barisnya tetap ada (qty 0).
    const sisa = anggota.filter((k) => k.minggu !== m).length;
    kartu = qty > 0 || !sisa ? kartu.map((k) => (k.id === utama.id ? { ...k, qty: Math.max(0, qty) } : k)) : kartu.filter((k) => k.id !== utama.id);
  } else if (qty > 0) {
    const w = anggota[0];
    kartu = [...kartu, { id: idKartu(), uraian: w.uraian, wbs: w.wbs, satuan: w.satuan, harga: w.harga, minggu: m, qty }];
  }
  return { ...r, kartu };
}

/** "+ Baris kosong": uraian baru langsung di Minggu I, diisi di tabel. */
export const tambahBarisKosong = (r: RabRnr): RabRnr =>
  ({ ...r, kartu: [...kartuRab(r), { id: idKartu(), uraian: '', wbs: WBS_BAWAAN, satuan: 'Paket', harga: 0, minggu: 1, qty: 1 }] });

/** Hapus satu baris tabel beserta semua kotaknya di papan. */
export function hapusBaris(r: RabRnr, idBaris: string): RabRnr {
  const ids = new Set(anggotaBaris(r, idBaris).map((k) => k.id));
  return { ...r, kartu: kartuRab(r).filter((k) => !ids.has(k.id)) };
}

/** Salin ke bulan depan: semua ajuan RAB lama masuk keranjang RAB baru untuk dipilah. */
export const salinKeKeranjang = (dari: RabRnr, ke: RabRnr): RabRnr =>
  ({ ...ke, kartu: barisRekap(dari).filter((u) => u.uraian.trim()).map((u) => ({ id: idKartu(), uraian: u.uraian.trim(), wbs: u.wbs, satuan: u.satuan, harga: u.harga, minggu: 0 as const, qty: 1 })) });

/** Lebar kolom C, D, E lembar RAB RNR (satuan lebar kolom Excel), dipakai juga oleh pratinjau. */
export const LEBAR_KOLOM_TEKS = { kode: 19.27, desk: 33.9, uraian: 32.5 } as const;

// Lebar huruf Arial per 1000 em untuk karakter ASCII 32–126 (metrik Helvetica/Arial baku).
const LEBAR_ARIAL = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const lebarTeks = (t: string) => Array.from(t).reduce((n, c) => {
  const k = c.charCodeAt(0);
  return n + (k >= 32 && k < 127 ? LEBAR_ARIAL[k - 32] : 556);
}, 0);

/**
 * Perkiraan jumlah baris teks Arial 10 yang dibungkus di kolom selebar `lebar`
 * (satuan lebar kolom Excel ≈ 535/1000 em, dikurangi jarak tepi sel), dipotong
 * per kata seperti Excel, supaya tinggi baris cukup dan teks tidak terpotong.
 */
export function jumlahBarisTeks(teks: string, lebar: number): number {
  const muat = lebar * 535 - 450;
  const spasi = LEBAR_ARIAL[0];
  let baris = 1;
  let isi = 0;
  for (const kata of teks.trim().split(/\s+/).filter(Boolean)) {
    const p = lebarTeks(kata);
    if (isi && isi + spasi + p > muat) { baris++; isi = 0; }
    if (p > muat) { baris += Math.ceil(p / muat) - 1; isi = p % muat; }
    else isi += (isi ? spasi : 0) + p;
  }
  return baris;
}

/** Tinggi baris uraian (poin): satu baris teks 20 pt, tiap baris tambahan 13 pt. */
export function tinggiBarisRab(u: UraianRab): number {
  const n = Math.max(
    jumlahBarisTeks(u.wbs, LEBAR_KOLOM_TEKS.kode),
    jumlahBarisTeks(deskripsiWbs(u.wbs), LEBAR_KOLOM_TEKS.desk),
    jumlahBarisTeks(u.uraian, LEBAR_KOLOM_TEKS.uraian),
  );
  return 20 + (n - 1) * 13;
}

/** Ekspor lembar rekap RAB RNR (satu lembar, baris uraian 19–32 menyesuaikan jumlah uraian). */
export async function eksporRabRnr(r: RabRnr): Promise<'dibagikan' | 'diunduh'> {
  const t = await TemplatXlsx.buka('/template-rab-rnr.xlsx');
  const isi = barisRekap(r).filter((u) => u.uraian.trim() && totalUraian(u) > 0);
  const n = Math.max(1, isi.length);
  const tgl = r.tanggal ? `${Number(r.tanggal.slice(8, 10))} ${DAFTAR_BULAN[Number(r.tanggal.slice(5, 7)) - 1]} ${r.tanggal.slice(0, 4)}` : '';
  t.isi('D2', 'PT ENERGI BATUBARA LESTARI\nRENCANA ANGGARAN BULANAN (RAB)\nDepartemen RNR')
    .isi('E7', `: ${r.lokasi}`)
    .isi('G8', `Bulan : ${r.bulan}                                          Tahun : ${r.tahun}`)
    .isi('D10', r.kepada).isi('D11', r.up).isi('D12', r.nomorRab).isi('D14', tgl);
  // Hapus gabungan sel di area persetujuan agar 4 kotak terpisah (F, G, H, I, masing-masing 1 kolom).
  for (const ref of ['F10:G10', 'F11:G11', 'F12:G14', 'F15:G15', 'H10:I10', 'H11:I11', 'H12:I14', 'H15:I15']) {
    t.hapusGabungan(ref);
  }
  // Salin gaya kotak F ke G, H, I agar semua kotak persetujuan bergaris rapi.
  for (let b = 10; b <= 15; b++) {
    for (const col of ['G', 'H', 'I']) t.salinGaya(`F${b}`, `${col}${b}`);
  }
  // Kotak 1: Dibuat (kolom F)
  t.isi('F10', 'Dibuat').isi('F11', 'Diisi Di Form').isi('F14', 'Diisi DI form').isi('F15', '');
  // Kotak 2: Diverifikasi (kolom G)
  t.isi('G10', 'Diverifikasi').isi('G11', r.jabatanVerifikasi || PENYETUJU_VERIFIKASI.jabatan)
    .isi('G14', r.verifikasiNama || PENYETUJU_VERIFIKASI.nama).isi('G15', 'Tanggal :');
  // Kotak 3: Disetujui Oleh — Pimpinan Site (kolom H)
  t.isi('H10', 'Disetujui Oleh,').isi('H11', r.jabatanPimpinan || PENYETUJU_PIMPINAN.jabatan)
    .isi('H14', r.pimpinanNama || PENYETUJU_PIMPINAN.nama).isi('H15', 'Tanggal :');
  // Kotak 4: Disetujui Oleh — Eng & Opr. Div Head (kolom I)
  t.isi('I10', 'Disetujui Oleh,').isi('I11', r.jabatanDivHead || PENYETUJU_DIV_HEAD.jabatan)
    .isi('I14', r.penyetujuDivHead || PENYETUJU_DIV_HEAD.nama).isi('I15', 'Tanggal :');
  // Kolom J (kanan): dikosongkan agar tetap rapi sebagai batas kanan tabel
  for (let b = 10; b <= 15; b++) t.isi(`J${b}`, '');

  // Kotak 5: Approval s/d Pak Rahmad (kolom N) — HANYA JIKA TOTAL > 25 JUTA
  if (perluDirektur(r)) {
    t.isi('N9', 'jika total nilai >25jt (Approval s/d Pak Rahmad)')
      .isi('N10', 'Disetujui Oleh,')
      .isi('N11', r.jabatanPenyetuju || PENYETUJU_DIREKTUR.jabatan)
      .isi('N14', r.penyetuju || PENYETUJU_DIREKTUR.nama)
      .isi('N15', 'Tanggal :');
  } else {
    // Bila total <= 25 juta, kolom TTD Pak Rahmad dihilangkan / dibersihkan
    for (const ref of ['N9', 'O9', 'N10', 'O10', 'N11', 'O11', 'N12', 'N13', 'N14', 'N15']) t.bersihkan(ref);
    t.hapusGabungan('O10:O11');
  }
  // Template: uraian di baris 19–32 (14 baris), total di baris 33.
  t.aturJumlahBaris(19, 14, n);
  isi.forEach((u, i) => {
    const b = 19 + i;
    t.isi(`B${b}`, i + 1).isi(`C${b}`, u.wbs.trim()).isi(`D${b}`, deskripsiWbs(u.wbs)).isi(`E${b}`, u.uraian.trim());
    ['F', 'G', 'H', 'I'].forEach((k, m) => t.isi(`${k}${b}`, nilaiMinggu(u, m) || ''));
    t.rumus(`J${b}`, `SUM(F${b}:I${b})`, totalUraian(u));
    t.tinggi(b, tinggiBarisRab(u));
  });
  const rt = 19 + n;
  ['F', 'G', 'H', 'I'].forEach((k, m) => t.rumus(`${k}${rt}`, `SUM(${k}19:${k}${rt - 1})`, totalMinggu(r, m)));
  t.rumus(`J${rt}`, `SUM(J19:J${rt - 1})`, totalRab(r));
  return t.simpan(`RAB RNR ${r.bulan} ${r.tahun} ${r.nomorRab.replace(/\//g, '-')}.xlsx`, r.judul);
}

// ------------------------------------------------------------------ simpanan perangkat

const KUNCI = 'pokemonkey_rab_rnr_v1';

export function muatRabRnr(): RabRnr[] {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI) || '[]');
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

export function simpanRabRnr(daftar: RabRnr[]): void {
  try { localStorage.setItem(KUNCI, JSON.stringify(daftar)); } catch { /* penyimpanan penuh */ }
}
