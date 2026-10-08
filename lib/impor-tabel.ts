/**
 * Utilitas Impor Berkas Excel (.xlsx, .xls) dan CSV (.csv) ke Tabel Memo.
 *
 * Mengurai berkas spreadsheet menjadi matriks 2D (string[][]) yang siap
 * disisipkan sebagai blok tabel memo interaktif lengkap dengan deteksi
 * kolom status/ceklis dan opsi grafik otomatis.
 */

import JSZip from 'jszip';
import { MAKS_BARIS_TABEL, MAKS_KOLOM_TABEL } from '../server/src/memo-blok';
import { cekNilaiSelesai } from './tabel-interaktif';

/** Konversi huruf kolom Excel ke indeks 0-based: 'A' -> 0, 'B' -> 1, 'AA' -> 26 */
export function colLetterToIndex(colStr: string): number {
  let idx = 0;
  for (let i = 0; i < colStr.length; i++) {
    idx = idx * 26 + (colStr.charCodeAt(i) - 64);
  }
  return idx - 1;
}

/** Urai teks berformat CSV atau TSV dengan penanganan tanda kutip dan pembatas koma/titik koma/tab */
export function uraiCsvKeMatriks(teks: string): string[][] {
  if (!teks || !teks.trim()) return [];

  // 1. Deteksi pembatas (delimiter) paling dominan pada 5 baris pertama
  const cuplikan = teks.split('\n').slice(0, 5).join('\n');
  const countTab = (cuplikan.match(/\t/g) || []).length;
  const countSemi = (cuplikan.match(/;/g) || []).length;
  const countComma = (cuplikan.match(/,/g) || []).length;

  let delimiter = ',';
  if (countTab > countComma && countTab > countSemi) delimiter = '\t';
  else if (countSemi > countComma) delimiter = ';';

  // 2. Parser CSV yang tangguh menangani tanda kutip ganda dan karakter pemisah baris di dalam sel
  const barisHasil: string[][] = [];
  let barisSekarang: string[] = [];
  let selSekarang = '';
  let diDalamKutip = false;

  const bersih = teks.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < bersih.length; i++) {
    const c = bersih[i];
    const next = bersih[i + 1];

    if (c === '"') {
      if (diDalamKutip && next === '"') {
        selSekarang += '"';
        i++; // lewati kutip kedua
      } else {
        diDalamKutip = !diDalamKutip;
      }
    } else if (c === delimiter && !diDalamKutip) {
      barisSekarang.push(selSekarang.trim());
      selSekarang = '';
    } else if (c === '\n' && !diDalamKutip) {
      barisSekarang.push(selSekarang.trim());
      if (barisSekarang.some((s) => s.length > 0)) {
        barisHasil.push(barisSekarang);
      }
      barisSekarang = [];
      selSekarang = '';
    } else {
      selSekarang += c;
    }
  }

  if (selSekarang.length > 0 || barisSekarang.length > 0) {
    barisSekarang.push(selSekarang.trim());
    if (barisSekarang.some((s) => s.length > 0)) {
      barisHasil.push(barisSekarang);
    }
  }

  if (barisHasil.length === 0) return [];

  // Ratakan panjang kolom
  const maxKol = Math.min(MAKS_KOLOM_TABEL, Math.max(1, ...barisHasil.map((r) => r.length)));
  return barisHasil.slice(0, MAKS_BARIS_TABEL).map((r) => {
    const row = r.slice(0, maxKol);
    while (row.length < maxKol) row.push('');
    return row;
  });
}

/** Urai ArrayBuffer berkas .xlsx menggunakan JSZip & DOMParser bawaan peramban */
export async function uraiXlsxKeMatriks(buffer: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(buffer);

  // 1. Ambil tabel shared strings jika ada
  let sharedStrings: string[] = [];
  const sstFile = zip.file('xl/sharedStrings.xml');
  if (sstFile) {
    const sstXml = await sstFile.async('text');
    const parser = new DOMParser();
    const sstDoc = parser.parseFromString(sstXml, 'application/xml');
    const siElements = Array.from(sstDoc.getElementsByTagName('si'));
    sharedStrings = siElements.map((si) => {
      const tElements = Array.from(si.getElementsByTagName('t'));
      return tElements.map((t) => t.textContent || '').join('');
    });
  }

  // 2. Ambil worksheet pertama
  const sheetFile = zip.file('xl/worksheets/sheet1.xml') || Object.values(zip.files).find((f) => f.name.startsWith('xl/worksheets/sheet'));
  if (!sheetFile) {
    throw new Error('Tidak ditemukan lembar kerja (worksheet) di dalam berkas Excel');
  }

  const sheetXml = await sheetFile.async('text');
  const parser = new DOMParser();
  const sheetDoc = parser.parseFromString(sheetXml, 'application/xml');

  // 3. Baca semua baris dan sel
  const rowElements = Array.from(sheetDoc.getElementsByTagName('row'));
  const rawRows: { rowNum: number; cells: Map<number, string> }[] = [];

  for (const rowEl of rowElements) {
    const rowNum = parseInt(rowEl.getAttribute('r') || '0', 10);
    const cellElements = Array.from(rowEl.getElementsByTagName('c'));
    const cells = new Map<number, string>();

    for (const cEl of cellElements) {
      const rAttr = cEl.getAttribute('r') || '';
      const colLetters = (rAttr.match(/^([A-Z]+)/) || [])[1];
      if (!colLetters) continue;

      const colIdx = colLetterToIndex(colLetters);
      const tAttr = cEl.getAttribute('t') || '';

      let val = '';
      if (tAttr === 's') {
        const vEl = cEl.getElementsByTagName('v')[0];
        if (vEl && vEl.textContent) {
          const sIdx = parseInt(vEl.textContent, 10);
          val = sharedStrings[sIdx] || '';
        }
      } else if (tAttr === 'inlineStr') {
        const isEl = cEl.getElementsByTagName('is')[0];
        const tEl = isEl ? isEl.getElementsByTagName('t')[0] : cEl.getElementsByTagName('t')[0];
        if (tEl) val = tEl.textContent || '';
      } else {
        const vEl = cEl.getElementsByTagName('v')[0];
        if (vEl && vEl.textContent) {
          val = vEl.textContent;
        } else {
          const tEl = cEl.getElementsByTagName('t')[0];
          if (tEl) val = tEl.textContent || '';
        }
      }

      // Bersihkan teks entitas HTML
      val = val
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#10003;/g, '✓')
        .trim();

      cells.set(colIdx, val);
    }

    if (cells.size > 0) {
      rawRows.push({ rowNum, cells });
    }
  }

  // -------------------------------------------------------------------------
  // Deteksi Cerdas Kasus Khusus: Tracker Horizontal seperti YOLO (H-01..H-30)
  // Baris FASE, HARI KE, TOPIK, CEKLIS melintang di kolom C sampai AF
  // -------------------------------------------------------------------------
  const rowHari = rawRows.find((r) => Array.from(r.cells.values()).some((v) => /^H-0?1$/i.test(v)));
  if (rowHari) {
    const rowFase = rawRows.find((r) => r.rowNum < rowHari.rowNum && Array.from(r.cells.values()).some((v) => /fase|minggu/i.test(v)));
    const rowTopik = rawRows.find((r) => r.rowNum > rowHari.rowNum && Array.from(r.cells.values()).some((v) => /topik|materi/i.test(v)));
    const rowCeklis = rawRows.find((r) => r.rowNum > rowHari.rowNum && Array.from(r.cells.values()).some((v) => /ceklis|status|selesai/i.test(v)));

    if (rowTopik) {
      const kepala = ['Hari', 'Fase', 'Topik / Materi', 'Status', 'Kumulatif'];
      const hasilTranspos: string[][] = [kepala];

      let kumulatif = 0;
      // Urutkan kolom hari dari H-01 sampai H-30
      const colIndices = Array.from(rowHari.cells.keys()).sort((a, b) => a - b);

      for (const cIdx of colIndices) {
        const hariVal = rowHari.cells.get(cIdx) || '';
        if (!/^H-\d+/i.test(hariVal)) continue;

        const faseVal = rowFase?.cells.get(cIdx) || 'Fase 1';
        const topikVal = rowTopik?.cells.get(cIdx) || '—';
        const ceklisVal = rowCeklis?.cells.get(cIdx) || 'Belum';

        const isSelesai = cekNilaiSelesai(ceklisVal);
        if (isSelesai) kumulatif++;

        hasilTranspos.push([
          hariVal,
          faseVal,
          topikVal,
          isSelesai ? '✓ Selesai' : 'Belum',
          String(kumulatif),
        ]);
      }

      if (hasilTranspos.length > 2) {
        return hasilTranspos;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Penanganan Standar Tabel Vertikal (Kasus Umum)
  // -------------------------------------------------------------------------
  // Cari baris awal (header) yang memiliki minimal 2 kolom terisi
  let idxMulai = rawRows.findIndex((r) => r.cells.size >= 2);
  if (idxMulai === -1) idxMulai = 0;

  const barisPilihan = rawRows.slice(idxMulai, idxMulai + MAKS_BARIS_TABEL);
  if (barisPilihan.length === 0) return [];

  // Tentukan batas kolom min & max yang aktif
  let minCol = Infinity;
  let maxCol = -1;
  for (const r of barisPilihan) {
    for (const c of r.cells.keys()) {
      if (c < minCol) minCol = c;
      if (c > maxCol) maxCol = c;
    }
  }
  if (minCol === Infinity) minCol = 0;
  if (maxCol === -1) maxCol = 1;

  const jmlKolom = Math.min(MAKS_KOLOM_TABEL, maxCol - minCol + 1);

  const matriks: string[][] = [];
  for (const r of barisPilihan) {
    const baris: string[] = [];
    for (let c = minCol; c < minCol + jmlKolom; c++) {
      baris.push(r.cells.get(c) || '');
    }
    // Hanya simpan baris yang tidak sepenuhnya kosong
    if (baris.some((s) => s.length > 0)) {
      matriks.push(baris);
    }
  }

  return matriks;
}

/** Fungsi utama: baca berkas file (File object dari peramban) dan kembalikan matriks tabel */
export async function bacaBerkasTabel(file: File): Promise<{ baris: string[][]; nama: string }> {
  const nama = file.name;
  const ekstensi = nama.slice(nama.lastIndexOf('.')).toLowerCase();

  if (ekstensi === '.csv' || ekstensi === '.tsv' || ekstensi === '.txt') {
    const teks = await file.text();
    const baris = uraiCsvKeMatriks(teks);
    return { baris, nama };
  }

  if (ekstensi === '.xlsx' || ekstensi === '.xls') {
    const buffer = await file.arrayBuffer();
    const baris = await uraiXlsxKeMatriks(buffer);
    return { baris, nama };
  }

  throw new Error(`Format berkas "${ekstensi}" tidak didukung. Harap gunakan .xlsx, .xls, atau .csv.`);
}
