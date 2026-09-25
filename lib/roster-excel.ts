/**
 * Ekspor roster ke format berkas resmi "ROSTER KERJA RNR 2026" milik PT EBL.
 *
 * Tata letaknya mengikuti berkas itu: judul tiga baris, kepala No | NAMA | JABATAN
 * diikuti tanggal 1–31 beserta nama hari (bahasa Indonesia), satu baris per orang,
 * kolom rekap D/N/OFF/FB/IK + TOTAL HARI KERJA + DAY/MONTH berisi rumus COUNTIF,
 * rekap harian DAY SHIFT / NIGHT SHIFT / TOTAL / OFF / FIELD BREAK, blok "Dibuat,",
 * lalu baris keterangan berwarna.
 *
 * Anggota dikelompokkan per perusahaan (PT EBL/Tahura lalu CV KBS) dengan baris
 * judul kelompok, seperti permintaan lapangan.
 *
 * Kode roster aplikasi (M, S1, S2, L, C, I) dipetakan ke kode berkas
 * (D, N, OFF, FB, IK). Kode aslinya tetap tercatat sebagai komentar sel.
 */

import type { Workbook, Worksheet } from 'exceljs';
import { bukuBaru, simpanBuku } from './excel';
import * as W from './waktu';

const HURUF = 'Tahoma';

/** Kode roster aplikasi → kode berkas resmi. Kode lain dipakai apa adanya. */
export const KODE_TEMPLATE: Record<string, string> = {
  M: 'D',    // Masuk → shift siang
  S1: 'D',   // Shift 1 → shift siang
  S2: 'N',   // Shift 2 → shift malam
  L: 'OFF',  // Libur
  C: 'FB',   // Cuti → field break
  I: 'IK',   // Izin/sakit → ijin khusus
};

/** Warna latar per kode, sama dengan baris keterangan di berkas asli. */
const WARNA_KODE: Record<string, { latar: string; teks: string }> = {
  D: { latar: 'FFFFFF', teks: '000000' },
  N: { latar: 'D9D9D9', teks: '000000' },
  OFF: { latar: 'FF0000', teks: 'FFFFFF' },
  FB: { latar: 'FFFF00', teks: '000000' },
  IK: { latar: '92D050', teks: '000000' },
};

const HARI_ID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
const REKAP_KODE = ['D', 'N', 'OFF', 'FB', 'IK'];
const KETERANGAN: [string, string][] = [
  ['D', 'SHIFT SIANG'], ['N', 'SHIFT MALAM'], ['OFF', 'LIBUR'],
  ['FB', 'Field Break / Cuti Tahunan'], ['IK', 'Ijin Khusus'],
];

const argb = (hex: string) => ({ argb: `FF${hex}` });
const garisTipis = { style: 'thin' as const, color: argb('808080') };
const kotak = { top: garisTipis, left: garisTipis, bottom: garisTipis, right: garisTipis };

interface Gaya { tebal?: boolean; ukuran?: number; latar?: string; teks?: string; rata?: 'left' | 'center' | 'right'; bingkai?: boolean; bungkus?: boolean }

function gaya(ws: Worksheet, baris: number, kolom: number, o: Gaya = {}) {
  const c = ws.getCell(baris, kolom);
  c.font = { name: HURUF, size: o.ukuran ?? 11, bold: o.tebal, color: argb(o.teks ?? '000000') };
  if (o.latar) c.fill = { type: 'pattern', pattern: 'solid', fgColor: argb(o.latar) };
  if (o.bingkai !== false) c.border = kotak;
  c.alignment = { horizontal: o.rata ?? 'center', vertical: 'middle', wrapText: o.bungkus ?? false };
  return c;
}

export interface AnggotaRoster {
  id: string;
  nama: string;
  jabatan?: string | null;
  /** Nama kelompok/perusahaan, mis. "CV KBS". Kosong = kelompok utama. */
  kelompok?: string | null;
}

export interface OpsiEksporRoster {
  /** Bulan yang diekspor, format YYYY-MM. */
  bulan: string;
  /** Semua tanggal bulan itu, urut. */
  tanggalList: string[];
  /** Anggota, sudah urut; yang berkelompok sama ditulis berurutan. */
  tim: AnggotaRoster[];
  /** Kunci `${user_id}|${tanggal}` → kode roster aplikasi beserta catatannya. */
  peta: Map<string, { kode: string; catatan?: string | null }>;
  /** Label kode aplikasi, untuk komentar sel. */
  labelKode: (kode: string) => string;
  /** Tanggal merah pada bulan itu. */
  libur: Map<string, { nama: string; jenis: string }[]>;
  /** Nama pembuat, ditulis di blok tanda tangan. */
  dibuatOleh: string;
  /** Nama kelompok utama pada baris judul kelompok pertama. */
  kelompokUtama?: string;
  departemen?: string;
}

export async function eksporRosterKerja(o: OpsiEksporRoster): Promise<'dibagikan' | 'diunduh'> {
  const wb: Workbook = await bukuBaru();
  const ws = wb.addWorksheet(`ROSTER ${o.bulan}`, {
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const KOL_HARI = 4;                                   // kolom D, sama dengan berkas asli
  const kolAkhirHari = KOL_HARI + o.tanggalList.length - 1;
  const kolRekap = kolAkhirHari + 1;
  const kolTotalKerja = kolRekap + REKAP_KODE.length;
  const kolTotalBulan = kolTotalKerja + 1;
  const kolAkhir = kolTotalBulan;

  ws.getColumn(1).width = 5;    // No
  ws.getColumn(2).width = 34;   // NAMA
  ws.getColumn(3).width = 28;   // JABATAN
  for (let c = KOL_HARI; c <= kolAkhirHari; c++) ws.getColumn(c).width = 5.4;
  for (let c = kolRekap; c < kolTotalKerja; c++) ws.getColumn(c).width = 5.6;
  ws.getColumn(kolTotalKerja).width = 10;
  ws.getColumn(kolTotalBulan).width = 9;

  // ---------- Judul ----------
  const judul = [
    `ROSTER KERJA ${(o.departemen ?? 'REVEGETASI & REHABILITASI').toUpperCase()}`,
    'PT. ENERGI BATUBARA LESTARI - SITE RANTAU',
    `${W.NAMA_BULAN[+o.bulan.slice(5, 7) - 1].toUpperCase()} ${o.bulan.slice(0, 4)}`,
  ];
  judul.forEach((teks, i) => {
    const b = i + 1;
    ws.mergeCells(b, 1, b, kolAkhir);
    ws.getCell(b, 1).value = teks;
    gaya(ws, b, 1, { tebal: true, ukuran: i === 2 ? 13 : 15, bingkai: false });
    ws.getRow(b).height = 20;
  });

  // ---------- Kepala (baris 4–5) ----------
  ([[1, 'No'], [2, 'NAMA'], [3, 'JABATAN']] as [number, string][]).forEach(([kol, teks]) => {
    ws.mergeCells(4, kol, 5, kol);
    ws.getCell(4, kol).value = teks;
    gaya(ws, 4, kol, { tebal: true, latar: 'D9D9D9' });
    gaya(ws, 5, kol, { latar: 'D9D9D9' });
  });
  o.tanggalList.forEach((tg, i) => {
    const kol = KOL_HARI + i;
    const hari = W.hariKe(tg);
    const lbr = o.libur.get(tg);
    const merah = hari === 0 || Boolean(lbr?.some((l) => l.jenis === 'nasional'));
    ws.getCell(4, kol).value = +tg.slice(8);
    ws.getCell(5, kol).value = HARI_ID[hari];
    gaya(ws, 4, kol, { tebal: true, latar: merah ? 'FFC7CE' : 'D9D9D9', teks: merah ? '9C0006' : '000000' });
    const sel = gaya(ws, 5, kol, { ukuran: 8, latar: merah ? 'FFC7CE' : 'D9D9D9', teks: merah ? '9C0006' : '000000' });
    sel.alignment = { ...sel.alignment, textRotation: 90 };
    if (lbr) ws.getCell(4, kol).note = lbr.map((l) => l.nama).join(' · ');
  });
  ws.mergeCells(4, kolRekap, 4, kolAkhir);
  ws.getCell(4, kolRekap).value = 'HARI KERJA';
  gaya(ws, 4, kolRekap, { tebal: true, latar: 'D9D9D9' });
  [...REKAP_KODE, 'TOTAL HARI KERJA', 'DAY/MONTH'].forEach((teks, i) => {
    ws.getCell(5, kolRekap + i).value = teks;
    gaya(ws, 5, kolRekap + i, { tebal: true, ukuran: 8, latar: 'D9D9D9', bungkus: true });
  });
  ws.getRow(4).height = 16;
  ws.getRow(5).height = 58;

  // ---------- Baris anggota, dikelompokkan per perusahaan ----------
  const barisAwal = 6;
  let baris = barisAwal;
  let nomor = 0;
  let kelompokTerakhir: string | null = null;
  const barisOrang: number[] = [];

  for (const t of o.tim) {
    const kelompok = t.kelompok || o.kelompokUtama || 'PT EBL';
    if (kelompok !== kelompokTerakhir) {
      ws.mergeCells(baris, 1, baris, kolAkhir);
      ws.getCell(baris, 1).value = kelompok.toUpperCase();
      gaya(ws, baris, 1, { tebal: true, ukuran: 11, latar: 'BFBFBF', rata: 'left' });
      ws.getRow(baris).height = 18;
      kelompokTerakhir = kelompok;
      baris++;
    }

    nomor++;
    ws.getRow(baris).height = 20;
    ws.getCell(baris, 1).value = nomor;
    ws.getCell(baris, 2).value = t.nama.toUpperCase();
    ws.getCell(baris, 3).value = (t.jabatan ?? '').toUpperCase();
    gaya(ws, baris, 1);
    gaya(ws, baris, 2, { rata: 'left', tebal: true, ukuran: 10 });
    gaya(ws, baris, 3, { rata: 'left', ukuran: 9 });

    o.tanggalList.forEach((tg, j) => {
      const kol = KOL_HARI + j;
      const isi = o.peta.get(`${t.id}|${tg}`);
      const kodeBerkas = isi ? KODE_TEMPLATE[isi.kode] ?? isi.kode : '';
      const w = WARNA_KODE[kodeBerkas];
      ws.getCell(baris, kol).value = kodeBerkas;
      gaya(ws, baris, kol, { tebal: true, ukuran: 9, latar: w?.latar, teks: w?.teks });
      if (isi) {
        ws.getCell(baris, kol).note = [`${o.labelKode(isi.kode)} (${isi.kode})`, isi.catatan].filter(Boolean).join(' — ');
      }
    });

    const K = (n: number) => ws.getColumn(n).letter;
    const dari = `${K(KOL_HARI)}${baris}`;
    const sampai = `${K(kolAkhirHari)}${baris}`;
    REKAP_KODE.forEach((k, j) => {
      ws.getCell(baris, kolRekap + j).value = { formula: `COUNTIF(${dari}:${sampai},"${k}")` };
      gaya(ws, baris, kolRekap + j, { ukuran: 9 });
    });
    ws.getCell(baris, kolTotalKerja).value = { formula: `${K(kolRekap)}${baris}+${K(kolRekap + 1)}${baris}` };
    ws.getCell(baris, kolTotalBulan).value = { formula: `SUM(${K(kolRekap)}${baris}:${K(kolRekap + 4)}${baris})` };
    gaya(ws, baris, kolTotalKerja, { tebal: true, ukuran: 9 });
    gaya(ws, baris, kolTotalBulan, { tebal: true, ukuran: 9 });

    barisOrang.push(baris);
    baris++;
  }

  // ---------- Rekap harian ----------
  const awalOrang = barisOrang[0] ?? barisAwal;
  const akhirOrang = barisOrang[barisOrang.length - 1] ?? barisAwal;
  const rekapHarian: [string, string | null][] = [
    ['DAY SHIFT', 'D'], ['NIGHT SHIFT', 'N'], ['TOTAL', null], ['OFF', 'OFF'], ['FIELD BREAK', 'FB'],
  ];
  const barisRekap = baris + 1;
  rekapHarian.forEach(([label, kode], i) => {
    const b = barisRekap + i;
    ws.mergeCells(b, 1, b, 3);
    ws.getCell(b, 1).value = label;
    gaya(ws, b, 1, { tebal: true, rata: 'left', latar: 'F2F2F2' });
    for (let kol = KOL_HARI; kol <= kolAkhirHari; kol++) {
      const K = ws.getColumn(kol).letter;
      ws.getCell(b, kol).value = kode
        ? { formula: `COUNTIF(${K}${awalOrang}:${K}${akhirOrang},"${kode}")` }
        : { formula: `SUM(${K}${barisRekap}:${K}${barisRekap + 1})` };
      gaya(ws, b, kol, { tebal: true, ukuran: 9 });
    }
    ws.getRow(b).height = 17;
  });

  // Blok tanda tangan di kanan, sejajar rekap harian.
  ws.mergeCells(barisRekap, kolRekap, barisRekap + 2, kolAkhir);
  ws.getCell(barisRekap, kolRekap).value = `Dibuat,\n\n\n${o.dibuatOleh}`;
  gaya(ws, barisRekap, kolRekap, { ukuran: 10, bungkus: true });

  // ---------- Keterangan ----------
  const barisKet = barisRekap + rekapHarian.length + 1;
  ws.getCell(barisKet, 2).value = 'Keterangan';
  gaya(ws, barisKet, 2, { tebal: true, ukuran: 10, rata: 'left', bingkai: false });
  KETERANGAN.forEach(([kode, arti], i) => {
    const b = barisKet + 1 + i;
    ws.getCell(b, 2).value = kode;
    const w = WARNA_KODE[kode];
    gaya(ws, b, 2, { tebal: true, ukuran: 10, latar: w.latar, teks: w.teks });
    const asal = Object.entries(KODE_TEMPLATE).filter(([, v]) => v === kode).map(([k]) => k).join(', ');
    ws.getCell(b, 3).value = asal ? `${arti}  (kode aplikasi: ${asal})` : arti;
    gaya(ws, b, 3, { ukuran: 10, rata: 'left', bingkai: false });
  });

  ws.views = [{ state: 'frozen', xSplit: 3, ySplit: 5 }];
  return simpanBuku(wb, `ROSTER KERJA ${o.bulan}.xlsx`, `Roster kerja ${o.bulan}`);
}
