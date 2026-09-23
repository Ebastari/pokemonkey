import type { Workbook, Worksheet } from 'exceljs';
import { bukuBaru, simpanBuku } from './excel';
import type { ItemSurat } from './tipe-surat';
import * as W from './waktu';

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: 'FFD4D4D8' } },
  left: { style: 'thin' as const, color: { argb: 'FFD4D4D8' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFD4D4D8' } },
  right: { style: 'thin' as const, color: { argb: 'FFD4D4D8' } },
};

const headerFill = {
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: 'FFF4F4F5' },
};

function formatTgl(s?: string): Date | string {
  if (!s) return '';
  try {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return s;
    return new Date(Date.UTC(y, m - 1, d));
  } catch {
    return s;
  }
}

/**
 * Mengekspor seluruh data nomor surat ke dalam file Excel (.xlsx) dengan 4 sheet
 * yang format, nama sheet, judul, dan kolomnya sama persis dengan "Nomer IM Dinas.xlsx":
 * 1. Sheet 'IM'
 * 2. Sheet 'Surat Keluar'
 * 3. Sheet 'Sheet1' (Kontrak Pekerjaan)
 * 4. Sheet 'Berita Acara'
 */
export async function eksporSemuaNomorSuratKeExcel(daftar: ItemSurat[]): Promise<'dibagikan' | 'diunduh'> {
  const wb = await bukuBaru();

  // ==========================================
  // 1. SHEET 'IM' (Internal Memo Departemen RNR)
  // ==========================================
  const wsIM: Worksheet = wb.addWorksheet('IM');
  const itemsIM = daftar.filter((x) => x.kategori === 'im');

  // Baris 1: Judul
  wsIM.getCell('A1').value = 'Internal Memo Departemen RNR';
  wsIM.getCell('A1').font = { name: 'Calibri', size: 11, bold: true };

  // Baris 3: Header Tabel
  const headersIM = [
    'No.',
    'Nomor IM',
    'Nama Yang Ditugaskan',
    'Mulai Tanggal',
    'Berakhir',
    'Lama Hari',
    'Tujuan Dinas',
    'Keperluan ',
    'Nama Pembuat',
  ];
  const rowH_IM = wsIM.getRow(3);
  headersIM.forEach((h, i) => {
    const cell = rowH_IM.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Data Baris 4+
  itemsIM.forEach((it, idx) => {
    const r = wsIM.getRow(4 + idx);
    r.getCell(1).value = it.nomorUrut || idx + 1;
    r.getCell(2).value = it.nomorSurat || '';
    r.getCell(3).value = it.namaYangDitugaskan || '';
    
    const tMulai = formatTgl(it.tanggalMulai);
    r.getCell(4).value = tMulai;
    if (tMulai instanceof Date) r.getCell(4).numFmt = 'dd/mm/yyyy';

    const tAkhir = formatTgl(it.tanggalBerakhir);
    r.getCell(5).value = tAkhir;
    if (tAkhir instanceof Date) r.getCell(5).numFmt = 'dd/mm/yyyy';

    r.getCell(6).value = it.lamaHari ?? '';
    r.getCell(7).value = it.tujuanDinas || '';
    r.getCell(8).value = it.keperluan || it.namaSurat || '';
    r.getCell(9).value = it.namaPembuat || '';

    // Gaya baris
    for (let col = 1; col <= 9; col++) {
      const c = r.getCell(col);
      c.font = { name: 'Calibri', size: 11 };
      c.border = thinBorder;
      if (col === 1 || col === 2 || col === 4 || col === 5 || col === 6) {
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  });

  // Lebar kolom IM
  wsIM.getColumn(1).width = 6;
  wsIM.getColumn(2).width = 22;
  wsIM.getColumn(3).width = 26;
  wsIM.getColumn(4).width = 14;
  wsIM.getColumn(5).width = 14;
  wsIM.getColumn(6).width = 10;
  wsIM.getColumn(7).width = 20;
  wsIM.getColumn(8).width = 35;
  wsIM.getColumn(9).width = 18;

  // ==========================================
  // 2. SHEET 'Surat Keluar'
  // ==========================================
  const wsSK: Worksheet = wb.addWorksheet('Surat Keluar');
  const itemsSK = daftar.filter((x) => x.kategori === 'surat_keluar');

  // Baris 3: Judul
  wsSK.getCell('A3').value = 'Internal Memo Departemen RNR';
  wsSK.getCell('A3').font = { name: 'Calibri', size: 11, bold: true };

  // Baris 5: Header Tabel
  const headersSK = ['No.', 'Nomor Surat', 'Nama Surat', 'Tanggal', 'Tujuan Surat', 'Author'];
  const rowH_SK = wsSK.getRow(5);
  headersSK.forEach((h, i) => {
    const cell = rowH_SK.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Data Baris 6+
  itemsSK.forEach((it, idx) => {
    const r = wsSK.getRow(6 + idx);
    r.getCell(1).value = it.nomorUrut || idx + 1;
    r.getCell(2).value = it.nomorSurat || '';
    r.getCell(3).value = it.namaSurat || '';
    
    const tgl = formatTgl(it.tanggal);
    r.getCell(4).value = tgl;
    if (tgl instanceof Date) r.getCell(4).numFmt = 'dd/mm/yyyy';

    r.getCell(5).value = it.tujuanSurat || '';
    r.getCell(6).value = it.author || it.namaPembuat || '';

    for (let col = 1; col <= 6; col++) {
      const c = r.getCell(col);
      c.font = { name: 'Calibri', size: 11 };
      c.border = thinBorder;
      if (col === 1 || col === 2 || col === 4) {
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  });

  // Lebar kolom Surat Keluar
  wsSK.getColumn(1).width = 6;
  wsSK.getColumn(2).width = 24;
  wsSK.getColumn(3).width = 45;
  wsSK.getColumn(4).width = 14;
  wsSK.getColumn(5).width = 30;
  wsSK.getColumn(6).width = 18;

  // ==========================================
  // 3. SHEET 'Sheet1' (Kontrak Pekerjaan)
  // ==========================================
  const wsKK: Worksheet = wb.addWorksheet('Sheet1');
  const itemsKK = daftar.filter((x) => x.kategori === 'kontrak');

  // Baris 1: Judul
  wsKK.getCell('A1').value = 'Kontrak Pekerjaan';
  wsKK.getCell('A1').font = { name: 'Calibri', size: 11, bold: true };

  // Baris 3: Header Tabel
  const headersKK = ['No.', 'Nomor Surat', 'Nama Surat', 'Tanggal', 'Sistem Pelaksanaan', 'Pelaksana', 'Keterangan'];
  const rowH_KK = wsKK.getRow(3);
  headersKK.forEach((h, i) => {
    const cell = rowH_KK.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Data Baris 4+
  itemsKK.forEach((it, idx) => {
    const r = wsKK.getRow(4 + idx);
    r.getCell(1).value = it.nomorUrut || idx + 1;
    r.getCell(2).value = it.nomorSurat || '';
    r.getCell(3).value = it.namaSurat || '';
    
    const tgl = formatTgl(it.tanggal);
    r.getCell(4).value = tgl;
    if (tgl instanceof Date) r.getCell(4).numFmt = 'dd/mm/yyyy';

    r.getCell(5).value = it.sistemPelaksanaan || '';
    r.getCell(6).value = it.pelaksana || '';
    r.getCell(7).value = it.keterangan || '';

    for (let col = 1; col <= 7; col++) {
      const c = r.getCell(col);
      c.font = { name: 'Calibri', size: 11 };
      c.border = thinBorder;
      if (col === 1 || col === 2 || col === 4) {
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  });

  // Lebar kolom Kontrak
  wsKK.getColumn(1).width = 6;
  wsKK.getColumn(2).width = 24;
  wsKK.getColumn(3).width = 40;
  wsKK.getColumn(4).width = 16;
  wsKK.getColumn(5).width = 20;
  wsKK.getColumn(6).width = 22;
  wsKK.getColumn(7).width = 20;

  // ==========================================
  // 4. SHEET 'Berita Acara'
  // ==========================================
  const wsBA: Worksheet = wb.addWorksheet('Berita Acara');
  const itemsBA = daftar.filter((x) => x.kategori === 'berita_acara');

  // Baris 2: Judul
  wsBA.getCell('A2').value = 'BA Departemen RNR';
  wsBA.getCell('A2').font = { name: 'Calibri', size: 11, bold: true };

  // Baris 4: Header Tabel
  const headersBA = ['No.', 'Nomor Surat', 'Nama Surat', 'Tanggal', 'Tujuan Surat', 'Pembuat'];
  const rowH_BA = wsBA.getRow(4);
  headersBA.forEach((h, i) => {
    const cell = rowH_BA.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.fill = headerFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Data Baris 5+
  itemsBA.forEach((it, idx) => {
    const r = wsBA.getRow(5 + idx);
    r.getCell(1).value = it.nomorUrut || idx + 1;
    r.getCell(2).value = it.nomorSurat || '';
    r.getCell(3).value = it.namaSurat || '';
    
    const tgl = formatTgl(it.tanggal);
    r.getCell(4).value = tgl;
    if (tgl instanceof Date) r.getCell(4).numFmt = 'dd/mm/yyyy';

    r.getCell(5).value = it.tujuanSurat || '';
    r.getCell(6).value = it.author || it.namaPembuat || '';

    for (let col = 1; col <= 6; col++) {
      const c = r.getCell(col);
      c.font = { name: 'Calibri', size: 11 };
      c.border = thinBorder;
      if (col === 1 || col === 2 || col === 4) {
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        c.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    }
  });

  // Lebar kolom Berita Acara
  wsBA.getColumn(1).width = 6;
  wsBA.getColumn(2).width = 28;
  wsBA.getColumn(3).width = 45;
  wsBA.getColumn(4).width = 14;
  wsBA.getColumn(5).width = 30;
  wsBA.getColumn(6).width = 18;

  const namaBerkas = `Nomer-IM-Dinas-${W.hariIniWita()}.xlsx`;
  return simpanBuku(wb, namaBerkas, 'Manajemen Nomor Surat Dinas');
}
