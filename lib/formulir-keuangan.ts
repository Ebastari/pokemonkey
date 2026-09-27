/**
 * Tiga formulir keuangan Money Monkey yang diekspor ke template Excel resmi:
 *  - Disposisi PNBP PKH (Formulir Permintaan Kas dan Pembayaran) — isi keterangan & nilai.
 *  - RAB Insidental (Form Rencana Anggaran Biaya, mis. kunjungan Satgas).
 *  - LBPD (Laporan Biaya Perjalanan Dinas).
 *
 * Posisi sel mengikuti public/template-*.xlsx (disiapkan dari berkas asli pengguna).
 * Data disimpan di perangkat seperti RAB HCGA.
 */

import { TemplatXlsx, seriTanggal, terbilang } from './xlsx-templat';

export type JenisFormulir = 'disposisi' | 'insidental' | 'lbpd';

const idBaru = (awalan: string) => `${awalan}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const hariIni = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const tglPanjang = (iso: string) => (iso ? `${Number(iso.slice(8, 10))} ${BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : '');
const tglGaris = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');
/** Perkiraan tinggi baris untuk teks panjang yang dibungkus. */
const tinggiTeks = (teks: string, lebarKar: number, min: number, perBaris = 13.5) =>
  Math.max(min, Math.ceil(Math.max(1, teks.length) / lebarKar) * perBaris + 4);

export interface Penanda { nama: string; jabatan: string }

// ------------------------------------------------------------------ Disposisi

export interface BarisDisposisi { id: string; keterangan: string; nilai: number | null; jatuhTempo: string; kodeBudget: string }
export interface Disposisi {
  jenis: 'disposisi';
  id: string;
  judul: string;
  tanggal: string;
  nomor: string;
  baris: BarisDisposisi[];
  dibuatPada: string;
  diubahPada: string;
}

export const barisDisposisiBaru = (): BarisDisposisi => ({ id: idBaru('d'), keterangan: '', nilai: null, jatuhTempo: '', kodeBudget: '' });

export function disposisiBaru(): Disposisi {
  const kini = new Date().toISOString();
  return { jenis: 'disposisi', id: idBaru('dsp'), judul: 'Disposisi PNBP PKH', tanggal: hariIni(), nomor: '', baris: [barisDisposisiBaru()], dibuatPada: kini, diubahPada: kini };
}

export const totalDisposisi = (d: Disposisi) => d.baris.reduce((n, b) => n + (b.nilai ?? 0), 0);

export async function eksporDisposisi(d: Disposisi): Promise<'dibagikan' | 'diunduh'> {
  const t = await TemplatXlsx.buka('/template-disposisi.xlsx');
  const baris = d.baris.filter((b) => b.keterangan.trim() || b.nilai);
  const n = Math.max(1, baris.length);
  const [y, m, h] = d.tanggal.split('-');
  t.isi('C3', `Tanggal\n${h}-${BULAN_EN[Number(m) - 1]}-${y.slice(2)}`);
  if (d.nomor.trim()) t.isi('C2', `Nomor : ${d.nomor.trim()}`);
  // Template: baris isian 7–9, total di baris 10.
  t.aturJumlahBaris(7, 3, n);
  baris.forEach((b, i) => {
    const r = 7 + i;
    t.isi(`A${r}`, b.keterangan.trim())
      .isi(`E${r}`, b.jatuhTempo ? tglPanjang(b.jatuhTempo) : '')
      .isi(`G${r}`, b.kodeBudget.trim())
      .isi(`H${r}`, 'Rp')
      .isi(`I${r}`, b.nilai ?? 0)
      .tinggi(r, tinggiTeks(b.keterangan, 52, 27.6));
  });
  const total = totalDisposisi(d);
  const rTotal = 7 + n;
  t.rumus(`I${rTotal}`, `SUM(I7:I${rTotal - 1})`, total).isi(`B${rTotal}`, terbilang(total));
  return t.simpan(`${d.judul.trim() || 'Disposisi PNBP PKH'} ${d.tanggal}.xlsx`.replace(/[\\/:*?"<>|]/g, '-'), d.judul);
}

// ------------------------------------------------------------------ RAB Insidental

export interface BarisInsidental { id: string; kegiatan: string; keterangan: string; banyak: number | null; harga: number | null; wbs: string }
export interface RabInsidental {
  jenis: 'insidental';
  id: string;
  nama: string;
  departemen: string;
  tanggal: string;
  kegiatan: string;
  baris: BarisInsidental[];
  dibuat: Penanda;
  diperiksa: Penanda;
  disetujui: Penanda;
  dibuatPada: string;
  diubahPada: string;
}

export const barisInsidentalBaru = (): BarisInsidental => ({ id: idBaru('i'), kegiatan: '', keterangan: '', banyak: 1, harga: null, wbs: '' });

export function insidentalBaru(): RabInsidental {
  const kini = new Date().toISOString();
  return {
    jenis: 'insidental', id: idBaru('ins'),
    nama: 'Mariano A Simamora', departemen: 'Revegetasi dan Rehabilitasi', tanggal: hariIni(), kegiatan: '',
    baris: [barisInsidentalBaru()],
    dibuat: { nama: 'Agung Laksono', jabatan: 'GL Revegetasi' },
    diperiksa: { nama: 'Mariano Alvarado Simamora', jabatan: 'Section Head Revegetasi dan Rehabilitasi' },
    disetujui: { nama: 'Bambang Octaryono', jabatan: 'Mine Manager- KTT' },
    dibuatPada: kini, diubahPada: kini,
  };
}

export const totalInsidental = (r: RabInsidental) => r.baris.reduce((n, b) => n + (b.banyak ?? 0) * (b.harga ?? 0), 0);

export async function eksporInsidental(r: RabInsidental): Promise<'dibagikan' | 'diunduh'> {
  const t = await TemplatXlsx.buka('/template-rab-insidental.xlsx');
  const baris = r.baris.filter((b) => b.kegiatan.trim() || b.harga);
  const n = Math.max(1, baris.length);
  t.isi('C2', `:${r.nama}`).isi('C3', `:${r.departemen}`).isi('C4', `:${tglGaris(r.tanggal)}`).isi('C5', `: ${r.kegiatan}`);
  // Template: baris isian 8–10, total di baris 11, tanda tangan di bawahnya.
  t.aturJumlahBaris(8, 3, n);
  baris.forEach((b, i) => {
    const x = 8 + i;
    t.isi(`A${x}`, i + 1).isi(`B${x}`, b.kegiatan.trim()).isi(`C${x}`, b.keterangan.trim())
      .isi(`D${x}`, b.banyak ?? 0).isi(`E${x}`, b.harga ?? 0)
      .rumus(`F${x}`, `D${x}*E${x}`, (b.banyak ?? 0) * (b.harga ?? 0))
      .isi(`G${x}`, b.wbs.trim());
    const panjang = Math.max(b.kegiatan.length / 22, b.keterangan.length / 34);
    if (panjang > 1) t.tinggi(x, Math.max(t.tinggiSekarang(x), Math.ceil(panjang) * 14 + 4));
  });
  const d = n - 3; // pergeseran baris di bawah tabel
  t.rumus(`F${11 + d}`, `SUM(F8:F${10 + d})`, totalInsidental(r));
  t.isi(`B${18 + d}`, r.dibuat.nama).isi(`B${19 + d}`, r.dibuat.jabatan)
    .isi(`E${17 + d}`, r.diperiksa.nama).isi(`E${18 + d}`, r.diperiksa.jabatan)
    .isi(`C${29 + d}`, r.disetujui.nama).isi(`C${30 + d}`, r.disetujui.jabatan);
  return t.simpan(`RAB Insidental ${r.kegiatan || ''} ${r.tanggal}.xlsx`.replace(/\s+/g, ' ').replace(/[\\/:*?"<>|]/g, '-'), 'RAB Insidental');
}

// ------------------------------------------------------------------ LBPD

export type AlokasiLbpd = 'transport' | 'akomodasi' | 'makan' | 'uangSaku' | 'lain';
export const ALOKASI_LBPD: { id: AlokasiLbpd; label: string; kolom: string }[] = [
  { id: 'transport', label: 'Transport', kolom: 'E' },
  { id: 'akomodasi', label: 'Akomodasi/Hotel', kolom: 'F' },
  { id: 'makan', label: 'Entertain/Makan', kolom: 'G' },
  { id: 'uangSaku', label: 'Uang Saku', kolom: 'H' },
  { id: 'lain', label: 'Lain-lain', kolom: 'I' },
];

export interface BarisLbpd { id: string; tanggal: string; uraian: string; ref: string; nilai: number | null; alokasi: AlokasiLbpd }
export interface Lbpd {
  jenis: 'lbpd';
  id: string;
  nama: string;
  divisi: string;
  noSppd: string;
  periode: string;
  baris: BarisLbpd[];
  kasRbpd: number | null;
  tempat: string;
  tanggal: string;
  dibuat: string;
  diketahuiSdm: string;
  diperiksa: string;
  disetujui: string;
  dibuatPada: string;
  diubahPada: string;
}

export const barisLbpdBaru = (tanggal = hariIni()): BarisLbpd => ({ id: idBaru('l'), tanggal, uraian: '', ref: '', nilai: null, alokasi: 'transport' });

export function lbpdBaru(nama = 'Agung Laksono'): Lbpd {
  const kini = new Date().toISOString();
  return {
    jenis: 'lbpd', id: idBaru('lbpd'), nama, divisi: 'Revegetation and Rehabilitation', noSppd: '', periode: hariIni().slice(0, 4),
    baris: [barisLbpdBaru()], kasRbpd: 0, tempat: 'Rantau', tanggal: hariIni(),
    dibuat: nama, diketahuiSdm: 'M. Yusriani', diperiksa: '', disetujui: '',
    dibuatPada: kini, diubahPada: kini,
  };
}

export const totalLbpd = (l: Lbpd) => l.baris.reduce((n, b) => n + (b.nilai ?? 0), 0);

export async function eksporLbpd(l: Lbpd): Promise<'dibagikan' | 'diunduh'> {
  const t = await TemplatXlsx.buka('/template-lbpd.xlsx');
  const baris = l.baris.filter((b) => b.uraian.trim() || b.nilai);
  const n = Math.max(1, baris.length);
  t.isi('H2', `: ${l.nama}`).isi('H3', `: ${l.divisi}`).isi('H4', `: ${l.noSppd}`).isi('H5', `: ${l.periode}`);
  // Template: baris isian 10–13, jumlah di baris 14.
  t.aturJumlahBaris(10, 4, n);
  baris.forEach((b, i) => {
    const r = 10 + i;
    t.isi(`A${r}`, b.tanggal ? seriTanggal(b.tanggal) : '').isi(`B${r}`, b.uraian.trim()).isi(`C${r}`, b.ref.trim()).isi(`D${r}`, b.nilai ?? 0);
    for (const a of ALOKASI_LBPD) t.isi(`${a.kolom}${r}`, a.id === b.alokasi ? (b.nilai ?? 0) : '');
  });
  const d = n - 4;
  const rJumlah = 14 + d;
  t.rumus(`D${rJumlah}`, `SUM(D10:D${rJumlah - 1})`, totalLbpd(l));
  for (const a of ALOKASI_LBPD) {
    const sub = baris.filter((b) => b.alokasi === a.id).reduce((x, b) => x + (b.nilai ?? 0), 0);
    t.rumus(`${a.kolom}${rJumlah}`, `SUM(${a.kolom}10:${a.kolom}${rJumlah - 1})`, sub);
  }
  t.isi(`D${16 + d}`, l.kasRbpd ?? 0);
  t.isi(`A${20 + d}`, `${l.tempat}, ${tglGaris(l.tanggal)}`);
  t.isi(`A${26 + d}`, l.dibuat).isi(`C${26 + d}`, l.diketahuiSdm).isi(`E${26 + d}`, l.diperiksa).isi(`G${26 + d}`, l.disetujui);
  return t.simpan(`LBPD ${l.nama} ${l.noSppd || l.tanggal}.xlsx`.replace(/[\\/:*?"<>|]/g, '-'), 'LBPD');
}

// ------------------------------------------------------------------ simpanan perangkat

export type Formulir = Disposisi | RabInsidental | Lbpd;

const kunci = (j: JenisFormulir) => `pokemonkey_money_${j}_v1`;

export function muatFormulir<T extends Formulir>(j: JenisFormulir): T[] {
  try {
    const d = JSON.parse(localStorage.getItem(kunci(j)) || '[]');
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

export function simpanFormulir(j: JenisFormulir, daftar: Formulir[]): void {
  try { localStorage.setItem(kunci(j), JSON.stringify(daftar)); } catch { /* penyimpanan penuh */ }
}
