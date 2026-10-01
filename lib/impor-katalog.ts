/**
 * Impor katalog RAB RNR dari Excel pengajuan (Money Monkey · Kelola katalog).
 *
 * Bentuk lembar dikenali dari judul kolom, bukan posisi sel:
 *  - Rekap RAB RNR: Kode WBS · Uraian · Minggu I–IV. Nilai minggu = qty × harga,
 *    jadi harga satuan disimpulkan saat dicocokkan dengan katalog (lihat usulanKatalog).
 *  - Rincian per kategori (template RAB HCGA): Nama Barang/Jasa · Qty · Satuan ·
 *    Harga Satuan; kategori dari nama lembar (ATK, BBM, …).
 *  - Form RAB: Kegiatan · Banyak · Estimasi Harga · WBS.
 * Baris setelah "Total" diabaikan sampai kepala kolom berikutnya (blok W1–W4,
 * kolom tanda tangan). Hasilnya dicocokkan ke katalog berdasarkan nama untuk
 * dipratinjau sebelum disimpan; harga dari berkas menggantikan harga katalog.
 */

import type { CellValue } from 'exceljs';
import type { BarangKatalog } from './katalog-rab';
import { DAFTAR_KATEGORI, WBS_BAWAAN, kategoriSah, namaKategori, type KategoriRab } from './rab-rnr';

/** Satu baris barang di berkas. */
export interface BarisImpor {
  nama: string;
  /** Harga satuan tertulis (rincian / form RAB). */
  harga?: number;
  /** Nilai per minggu I–IV (rekap RAB RNR) = qty × harga. */
  nilai?: number[];
  satuan?: string;
  wbs?: string;
  kategori?: KategoriRab;
  /** "Lembar!baris" untuk keterangan pratinjau. */
  asal: string;
}

export type StatusUsulan = 'baru' | 'berubah' | 'sama';

/** Usulan perubahan satu barang katalog (bisa diubah di pratinjau). */
export interface UsulanKatalog {
  kunci: string;
  lama?: BarangKatalog;
  nama: string;
  satuan: string;
  harga: number;
  wbs: string;
  kategori?: KategoriRab;
  /** Penjelasan asal harga, mis. "150.000 = 10 × 15.000". */
  catatan: string;
  pilih: boolean;
}

export const kunciNama = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
const rp = (n: number) => n.toLocaleString('id-ID');

/** Isi sel exceljs → teks/angka biasa (hasil rumus, rich text, tautan). */
function nilaiSel(v: CellValue): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if ('result' in v) return nilaiSel(v.result as CellValue);
  if ('richText' in v) return v.richText.map((r) => r.text).join('');
  if ('text' in v) return String(v.text);
  return null;
}

const teks = (v: string | number | null) => (v === null ? '' : String(v).replace(/\s+/g, ' ').trim());

/** 7200000, "7.200.000", "Rp 7.200.000" → 7200000; selain itu 0. */
function angka(v: string | number | null): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const t = teks(v).replace(/rp/i, '').replace(/\s/g, '');
  if (!t || !/^-?[\d.,]+$/.test(t)) return 0;
  // Format Indonesia: titik = ribuan, koma = desimal.
  return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
}

type Kolom = { nama: number; qty?: number; satuan?: number; harga?: number; wbs?: number; ket?: number; minggu: number[] };
const ROMAWI = ['i', 'ii', 'iii', 'iv'];

/** Kenali baris kepala kolom; null bila bukan. */
function kenaliKepala(sel: string[]): Kolom | null {
  const k: Partial<Kolom> & { minggu: number[] } = { minggu: [] };
  sel.forEach((s, i) => {
    const t = s.toLowerCase();
    if (!t) return;
    if (t === 'uraian' || t.startsWith('nama barang') || t === 'kegiatan') k.nama ??= i;
    else if (t === 'qty' || t === 'banyak' || t === 'jumlah') k.qty ??= i;
    else if (t === 'satuan') k.satuan ??= i;
    else if (t.startsWith('harga satuan') || t.startsWith('estimasi harga')) k.harga ??= i;
    else if (t.includes('wbs') && !t.startsWith('desc')) k.wbs ??= i;
    else if (t.startsWith('keterangan')) k.ket ??= i;
    else {
      const m = /^minggu\s+(i{1,3}|iv)$/.exec(t);
      if (m) k.minggu[ROMAWI.indexOf(m[1])] = i;
    }
  });
  if (k.nama === undefined) return null;
  const adaMinggu = k.minggu.filter((x) => x !== undefined).length === 4;
  return adaMinggu || k.harga !== undefined ? (k as Kolom) : null;
}

const kategoriLembar = (nama: string): KategoriRab | undefined =>
  DAFTAR_KATEGORI.find((k) => k.nama.toLowerCase() === nama.trim().toLowerCase())?.id;

/** Baca semua barang dari berkas .xlsx. */
export async function bacaBerkasImpor(data: ArrayBuffer): Promise<BarisImpor[]> {
  const mod = await import('exceljs');
  const ExcelJS = ((mod as unknown as { default?: typeof mod }).default ?? mod);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data);
  const hasil: BarisImpor[] = [];
  wb.eachSheet((ws) => {
    const kategori = kategoriLembar(ws.name);
    let kol: Kolom | null = null;
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const sel: string[] = [];
      const mentah: (string | number | null)[] = [];
      for (let c = 1; c <= Math.max(ws.columnCount, row.cellCount); c++) {
        const v = nilaiSel(row.getCell(c).value);
        mentah[c] = v;
        sel[c] = teks(v);
      }
      const kepala = kenaliKepala(sel);
      if (kepala) { kol = kepala; continue; }
      if (!kol) continue;
      // "Total", "Total Biaya", "Grand Total": blok selesai sampai kepala kolom berikutnya.
      if (sel.some((s) => /^(grand\s*)?total\b/i.test(s))) { kol = null; continue; }
      const nama = sel[kol.nama];
      if (!nama || /^\d+$/.test(nama)) continue;
      const b: BarisImpor = { nama, asal: `${ws.name}!${r}`, kategori };
      if (kol.minggu.length === 4) b.nilai = kol.minggu.map((c) => angka(mentah[c]));
      if (kol.harga !== undefined && angka(mentah[kol.harga]) > 0) b.harga = angka(mentah[kol.harga]);
      // Form RAB menaruh satuan di kolom Keterangan bila pendek ("Paket", "Orang").
      const satuan = kol.satuan !== undefined ? sel[kol.satuan] : kol.ket !== undefined && sel[kol.ket].length <= 15 ? sel[kol.ket] : '';
      if (satuan) b.satuan = satuan;
      const wbs = kol.wbs !== undefined ? sel[kol.wbs] : '';
      if (/^[A-Z]{2}\d/.test(wbs)) b.wbs = wbs;
      // Baris tanpa nilai maupun harga bukan ajuan (baris kosong bernomor di template).
      if (!b.harga && !(b.nilai ?? []).some(Boolean)) continue;
      hasil.push(b);
    }
  });
  return hasil;
}

/**
 * Cocokkan barang berkas dengan katalog (nama sama, abaikan huruf besar/spasi).
 * Harga dari berkas menggantikan harga katalog. Untuk rekap RAB RNR (hanya nilai
 * qty × harga): bila semua nilai kelipatan pas harga katalog, harga katalog tetap
 * (qty-nya yang berbeda); selain itu harga = nilai di berkas.
 */
export function usulanKatalog(baris: BarisImpor[], katalog: BarangKatalog[]): UsulanKatalog[] {
  const kelompok = new Map<string, BarisImpor[]>();
  for (const b of baris) {
    const k = kunciNama(b.nama);
    kelompok.set(k, [...(kelompok.get(k) ?? []), b]);
  }
  const hasil: UsulanKatalog[] = [];
  for (const [kunci, daftar] of kelompok) {
    const lama = katalog.find((x) => kunciNama(x.nama) === kunci);
    const akhir = daftar[daftar.length - 1];
    const ambil = <T,>(f: (b: BarisImpor) => T | undefined) => daftar.map(f).filter((x): x is T => x !== undefined && x !== '').pop();

    let harga = ambil((b) => b.harga);
    let catatan = '';
    if (harga === undefined) {
      const nilai = daftar.flatMap((b) => b.nilai ?? []).filter((n) => n > 0);
      const hl = lama?.harga ?? 0;
      if (hl > 0 && nilai.every((n) => n % hl === 0)) {
        harga = hl;
        const qty = nilai.map((n) => n / hl);
        if (qty.some((q) => q !== 1)) catatan = nilai.map((n, i) => `${rp(n)} = ${qty[i]} × ${rp(hl)}`).join('; ');
      } else {
        harga = Math.min(...nilai);
        if (new Set(nilai).size > 1) catatan = `nilai di berkas: ${nilai.map(rp).join(', ')}`;
      }
    }
    const kategori = ambil((b) => b.kategori) ?? kategoriSah(lama?.kategori);
    const u: UsulanKatalog = {
      kunci,
      lama,
      nama: lama?.nama ?? akhir.nama,
      satuan: ambil((b) => b.satuan) ?? lama?.satuan ?? 'Paket',
      harga,
      wbs: ambil((b) => b.wbs) ?? lama?.wbs ?? WBS_BAWAAN,
      kategori,
      catatan,
      pilih: false,
    };
    u.pilih = statusUsulan(u) !== 'sama' && u.harga > 0;
    hasil.push(u);
  }
  return hasil;
}

export function statusUsulan(u: UsulanKatalog): StatusUsulan {
  const l = u.lama;
  if (!l) return 'baru';
  const sama = l.nama === u.nama && l.satuan === u.satuan && l.harga === u.harga && l.wbs === u.wbs && kategoriSah(l.kategori) === u.kategori;
  return sama ? 'sama' : 'berubah';
}

/** Data untuk simpanBarangKatalog: barang lama diperbarui (id sama), barang baru diberi id. */
export function dataSimpan(u: UsulanKatalog, urutan: number): Partial<BarangKatalog> & { nama: string } {
  const isi = { nama: u.nama.trim(), satuan: u.satuan.trim() || 'Paket', harga: Math.max(0, u.harga), wbs: u.wbs, kategori: u.kategori ?? 'rnr' };
  if (u.lama) return { ...u.lama, ...isi };
  return {
    ...isi,
    id: `kat-imp-${Date.now().toString(36)}${urutan}`,
    kelompok: u.kategori ? namaKategori(u.kategori) : 'Pengajuan Rutin',
    urutan: 60 + urutan,
  };
}
