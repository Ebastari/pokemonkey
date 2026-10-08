import type { Workbook } from 'exceljs';
import { bukuBaru, simpanBuku } from './excel';
import * as W from './waktu';
import { TEMPLATE_MEMO_BASE64 } from './template-memo-base64';

export interface ItemBiayaTambahan {
  id: string;
  nama: string;
  nominal: number | null;
}

export interface DataMemoDinas {
  id?: string;
  nomor?: string;
  kepada: string;
  divisiKepada: string;
  jabatanKepada: string;
  dari: string;
  divisiDari: string;
  jabatanDari: string;
  perihal: string;
  // Karyawan ditugaskan
  namaKaryawan: string;
  divisiKaryawan: string;
  jabatanKaryawan: string;
  tanggalBerangkat: string; // YYYY-MM-DD
  tanggalKembali: string;   // YYYY-MM-DD
  tempatTujuan: string;
  keperluan: string;
  // Kebutuhan Biaya
  biayaTransportasi?: number | null;
  biayaPenginapan?: number | null;
  biayaUangMakan?: number | null;
  biayaLainLain?: number | null;
  keteranganLainLain?: string; // Uraian/keterangan biaya lain-lain
  biayaTambahan?: ItemBiayaTambahan[]; // Daftar biaya tambahan manual
  // Penutup
  hormatSaya?: string;
  namaPenandatangan?: string;
  tembusan?: string;
  dibuatPada?: string;
  terkunci?: boolean;
}

export const MEMO_DINAS_DEFAULT: DataMemoDinas = {
  nomor: '001/EBL-IM/IX/2026',
  kepada: 'M. Yusriani',
  divisiKepada: 'HCA Department',
  jabatanKepada: 'HCA Section Head',
  dari: 'Bambang Octaryono',
  divisiDari: 'Kepala Teknik Tambang',
  jabatanDari: 'Kepala Teknik Tambang',
  perihal: 'Permohonan Perjalanan Dinas',
  namaKaryawan: 'Agung Laksono',
  divisiKaryawan: 'Revegetasi dan Rehabilitasi',
  jabatanKaryawan: 'Crew Revegetasi',
  tanggalBerangkat: '2026-09-10',
  tanggalKembali: '2026-09-11',
  tempatTujuan: 'Aeris Hotel Banjarbaru',
  keperluan: 'Bimbingan Teknis Aplikasi SINERGY BPKH V',
  biayaTransportasi: 300000,
  biayaPenginapan: null,
  biayaUangMakan: 140000,
  biayaLainLain: null,
  keteranganLainLain: '',
  biayaTambahan: [],
  hormatSaya: 'Hormat saya,',
  namaPenandatangan: 'Bambang Octaryono',
  tembusan: 'Tembusan : Karyawan yang ditugaskan.',
};

/**
 * Mengisi template Excel asli "01. Form Internal Memo Perjalanan Dinas - new.xlsx"
 * dan mengunduhnya ke perangkat pengguna.
 */
export async function eksporMemoDinasKeExcel(data: DataMemoDinas): Promise<'dibagikan' | 'diunduh'> {
  let wb: Workbook;
  try {
    const mod = await import('exceljs');
    const ExcelJS = ((mod as unknown as { default?: typeof mod }).default ?? mod);
    wb = new ExcelJS.Workbook();
    
    // Konversi base64 template asli ke ArrayBuffer
    const binaryString = atob(TEMPLATE_MEMO_BASE64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    await wb.xlsx.load(bytes.buffer);
  } catch {
    try {
      const res = await fetch('/template-memo-dinas.xlsx');
      if (!res.ok) throw new Error('Gagal memuat template');
      const buf = await res.arrayBuffer();
      const mod = await import('exceljs');
      const ExcelJS = ((mod as unknown as { default?: typeof mod }).default ?? mod);
      wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf);
    } catch {
      wb = await bukuBaru();
    }
  }

  const sheet = wb.getWorksheet(1) || wb.addWorksheet('Internal Memo');

  // 1. Bagian Kepala Memo (Metadata)
  sheet.getCell('E8').value = data.nomor || null;
  sheet.getCell('E9').value = data.kepada || null;
  sheet.getCell('E10').value = data.divisiKepada || null;
  sheet.getCell('E11').value = data.jabatanKepada || null;
  sheet.getCell('E12').value = data.dari || null;
  sheet.getCell('E13').value = data.divisiDari || null;
  sheet.getCell('E14').value = data.jabatanDari || null;
  sheet.getCell('E15').value = data.perihal || null;

  // 2. Data Karyawan yang Ditugaskan
  sheet.getCell('E20').value = data.namaKaryawan || null;
  sheet.getCell('E21').value = data.divisiKaryawan || null;
  sheet.getCell('E22').value = data.jabatanKaryawan || null;
  if (data.tanggalBerangkat) {
    const [y, m, d] = data.tanggalBerangkat.split('-').map(Number);
    sheet.getCell('E23').value = new Date(Date.UTC(y, m - 1, d));
    sheet.getCell('E23').numFmt = 'd-mmm-yy';
  } else {
    sheet.getCell('E23').value = null;
  }
  if (data.tanggalKembali) {
    const [y, m, d] = data.tanggalKembali.split('-').map(Number);
    sheet.getCell('E24').value = new Date(Date.UTC(y, m - 1, d));
    sheet.getCell('E24').numFmt = 'd-mmm-yy';
  } else {
    sheet.getCell('E24').value = null;
  }
  sheet.getCell('E25').value = data.tempatTujuan || null;
  sheet.getCell('E26').value = data.keperluan || null;

  // 3. Rincian Kebutuhan Biaya Dinas
  sheet.getCell('D29').value = data.biayaTransportasi != null && Number(data.biayaTransportasi) > 0 ? Number(data.biayaTransportasi) : null;
  sheet.getCell('D31').value = data.biayaPenginapan != null && Number(data.biayaPenginapan) > 0 ? Number(data.biayaPenginapan) : null;
  sheet.getCell('D33').value = data.biayaUangMakan != null && Number(data.biayaUangMakan) > 0 ? Number(data.biayaUangMakan) : null;

  // Hitung total biaya lain-lain & biaya tambahan manual
  const totalTambahan = (data.biayaTambahan || []).reduce((acc, c) => acc + (Number(c.nominal) || 0), 0);
  const totalLainLain = (Number(data.biayaLainLain) || 0) + totalTambahan;

  const rincianTambahan: string[] = [];
  if (data.keteranganLainLain?.trim()) rincianTambahan.push(data.keteranganLainLain.trim());
  (data.biayaTambahan || []).forEach((tb) => {
    if (tb.nama?.trim()) rincianTambahan.push(tb.nama.trim());
  });

  const labelLainLain = rincianTambahan.length > 0 ? `Lain-lain (${rincianTambahan.join(', ')})` : 'Lain-lain';
  sheet.getCell('B35').value = labelLainLain;
  sheet.getCell('D35').value = totalLainLain > 0 ? totalLainLain : null;

  // 4. Penutup & Tanda Tangan
  sheet.getCell('B40').value = data.hormatSaya ?? 'Hormat saya,';
  sheet.getCell('B45').value = data.namaPenandatangan || data.dari;
  sheet.getCell('B47').value = data.tembusan ?? 'Tembusan : Karyawan yang ditugaskan.';

  const sanitizeName = (data.namaKaryawan || 'Dinas').replace(/[^a-zA-Z0-9_-]/g, '_');
  const namaBerkas = `Internal-Memo-Dinas-${sanitizeName}-${data.tanggalBerangkat || '2026'}.xlsx`;

  return simpanBuku(wb, namaBerkas, 'Internal Memo Perjalanan Dinas');
}
