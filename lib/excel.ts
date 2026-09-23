/**
 * Ekspor Excel bergaya aplikasi (ExcelJS, dimuat hanya saat tombol Excel ditekan).
 *
 * Semua ekspor (PICA, Roster, Memo) memakai kerangka yang sama: baris judul
 * (Press Start 2P), keterangan saringan + waktu ekspor, baris kepala berwarna yang
 * dibekukan, dan sel berwarna sesuai warna opsi di layar (padanan tema terang).
 * Huruf Pixelify Sans / Press Start 2P tampil bila terpasang di komputer; bila
 * tidak, Excel memakai huruf bawaan dan warnanya tetap sama.
 */

import type { Cell, Row, Workbook, Worksheet } from 'exceljs';
import { simpanBerkas } from './unduh';
import * as W from './waktu';

export const HURUF_ISI = 'Pixelify Sans';
export const HURUF_JUDUL = 'Press Start 2P';

export interface WarnaSel { latar: string; teks: string; garis: string }

/** Nama warna di tabel `opsi` → warna sel Excel (latar terang, teks gelap), sama dengan chip tema terang. */
const PALET: Record<string, WarnaSel> = {
  emerald: { latar: 'D1FAE5', teks: '065F46', garis: '10B981' },
  cyan: { latar: 'CFFAFE', teks: '155E75', garis: '06B6D4' },
  blue: { latar: 'DBEAFE', teks: '1E40AF', garis: '3B82F6' },
  indigo: { latar: 'E0E7FF', teks: '3730A3', garis: '6366F1' },
  purple: { latar: 'F3E8FF', teks: '6B21A8', garis: 'A855F7' },
  amber: { latar: 'FEF3C7', teks: '92400E', garis: 'F59E0B' },
  orange: { latar: 'FFEDD5', teks: '9A3412', garis: 'F97316' },
  red: { latar: 'FEE2E2', teks: '991B1B', garis: 'EF4444' },
  yellow: { latar: 'FEF9C3', teks: '854D0E', garis: 'EAB308' },
  zinc: { latar: 'F4F4F5', teks: '3F3F46', garis: 'A1A1AA' },
};
export const paletExcel = (nama?: string | null): WarnaSel => PALET[nama ?? ''] ?? PALET.zinc;

export const TINTA = '15181C';
export const MERAH = 'DC2626';
export const HIJAU = '059669';
export const JINGGA = 'D97706';
export const ABU = '71717A';

const argb = (hex: string) => ({ argb: `FF${hex}` });
const garis = (hex: string) => ({ style: 'thin' as const, color: argb(hex) });

export interface GayaSel {
  latar?: string;
  teks?: string;
  tebal?: boolean;
  miring?: boolean;
  ukuran?: number;
  huruf?: string;
  rata?: 'left' | 'center' | 'right';
  bungkus?: boolean;
  bingkai?: string;
}

/** Terapkan gaya ke satu sel; yang tidak disebut memakai gaya isi bawaan. */
export function gayakan(cell: Cell, g: GayaSel = {}): void {
  cell.font = { name: g.huruf ?? HURUF_ISI, size: g.ukuran ?? 11, bold: g.tebal, italic: g.miring, color: argb(g.teks ?? TINTA) };
  if (g.latar) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: argb(g.latar) };
  const b = garis(g.bingkai ?? 'D4D4D8');
  cell.border = { top: b, left: b, bottom: b, right: b };
  cell.alignment = { vertical: 'top', horizontal: g.rata ?? 'left', wrapText: g.bungkus ?? false };
}

/** Sel "chip" berwarna sesuai opsi (status, prioritas, kategori, kode roster). */
export function gayakanChip(cell: Cell, warnaNama: string | null | undefined, g: GayaSel = {}): void {
  const p = paletExcel(warnaNama);
  gayakan(cell, { latar: p.latar, teks: p.teks, bingkai: p.garis, tebal: true, ...g });
}

export interface KolomExcel { judul: string; lebar: number; rata?: 'left' | 'center' | 'right'; bungkus?: boolean }

export interface KerangkaLembar {
  ws: Worksheet;
  /** Nomor baris kepala kolom (data dimulai di baris berikutnya). */
  barisKepala: number;
  kolom: KolomExcel[];
  /** Tambah satu baris data dengan gaya isi bawaan per kolom; kembalikan barisnya untuk diwarnai. */
  tambah: (nilai: unknown[], g?: GayaSel) => Row;
  /** Baris judul kelompok selebar tabel (mis. "OPEN · 5 PICA"). */
  kelompok: (teks: string, warnaNama: string | null | undefined) => Row;
}

/**
 * Lembar baru: judul, keterangan + waktu ekspor, baris kepala (dibekukan).
 * `bekuKolom` = jumlah kolom kiri yang ikut dibekukan (mis. nama anggota di roster).
 */
export function lembarBaru(
  wb: Workbook,
  nama: string,
  o: { judul: string; keterangan?: string; kolom: KolomExcel[]; latarKepala?: string; bekuKolom?: number },
): KerangkaLembar {
  const ws = wb.addWorksheet(nama);
  const n = o.kolom.length;
  o.kolom.forEach((k, i) => { ws.getColumn(i + 1).width = k.lebar; });

  const judul = ws.getCell(1, 1);
  judul.value = o.judul.toUpperCase();
  judul.font = { name: HURUF_JUDUL, size: 12, color: argb('14532D') };
  ws.mergeCells(1, 1, 1, n);
  ws.getRow(1).height = 26;
  const ket = ws.getCell(2, 1);
  ket.value = [o.keterangan, `Diekspor ${W.capWaktuWita()} · POKEMONKEY`].filter(Boolean).join('  ·  ');
  ket.font = { name: HURUF_ISI, size: 10, color: argb(ABU) };
  ws.mergeCells(2, 1, 2, n);

  const barisKepala = 4;
  const kepala = ws.getRow(barisKepala);
  o.kolom.forEach((k, i) => {
    const c = kepala.getCell(i + 1);
    c.value = k.judul;
    gayakan(c, { latar: o.latarKepala ?? TINTA, teks: 'FFFFFF', tebal: true, rata: k.rata, bungkus: true, bingkai: '52525B' });
    c.alignment = { ...c.alignment, vertical: 'middle' };
  });
  kepala.height = 22;
  ws.views = [{ state: 'frozen', xSplit: o.bekuKolom ?? 0, ySplit: barisKepala }];

  const tambah = (nilai: unknown[], g: GayaSel = {}) => {
    const row = ws.addRow(nilai);
    o.kolom.forEach((k, i) => gayakan(row.getCell(i + 1), { rata: k.rata, bungkus: k.bungkus, ...g }));
    return row;
  };
  const kelompok = (teks: string, warnaNama: string | null | undefined) => {
    const row = ws.addRow([teks]);
    const p = paletExcel(warnaNama);
    ws.mergeCells(row.number, 1, row.number, n);
    gayakan(row.getCell(1), { latar: p.latar, teks: p.teks, bingkai: p.garis, tebal: true, ukuran: 12 });
    row.height = 20;
    return row;
  };
  return { ws, barisKepala, kolom: o.kolom, tambah, kelompok };
}

/** Saringan otomatis Excel pada baris kepala (hanya untuk tabel tanpa baris kelompok). */
export function pasangSaringan(k: KerangkaLembar): void {
  k.ws.autoFilter = { from: { row: k.barisKepala, column: 1 }, to: { row: k.barisKepala, column: k.kolom.length } };
}

export async function bukuBaru(): Promise<Workbook> {
  const mod = await import('exceljs');
  const ExcelJS = ((mod as unknown as { default?: typeof mod }).default ?? mod);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'POKEMONKEY';
  wb.created = new Date();
  return wb;
}

export async function simpanBuku(wb: Workbook, nama: string, judul: string): Promise<'dibagikan' | 'diunduh'> {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return simpanBerkas(blob, nama, judul);
}

/** Tanggal ISO (YYYY-MM-DD) → Date Excel (tanpa geser zona), atau '' bila kosong. */
export const tanggalExcel = (s: string | null | undefined): Date | string => (s ? W.keTanggal(s.slice(0, 10)) : '');
export const FORMAT_TANGGAL = 'd mmm yyyy';
