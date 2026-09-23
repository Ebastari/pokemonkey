/**
 * Utilitas untuk manipulasi dan ekspor data Minutes of Meeting (MoM)
 * Berdasarkan template resmi: MOM tempelate.doc
 */

import { LOGO_HASNUR_BASE64 } from './logo-hasnur';

export interface PoinMOM {
  id: string;
  no: number;
  minutesOfMeeting: string;
  pic: string;
  dueDate: string;
  remark: string;
}

export interface PesertaMOM {
  id: string;
  nama: string;
  jabatan: string;
  instansi: string;
  ttdUrl?: string;
}

export interface FotoDokumentasiMOM {
  id: string;
  url: string;
  keterangan?: string;
}

export interface DataMOM {
  id?: string;
  judul: string;
  tanggal: string;
  waktu: string;
  tempat: string;
  pesertaRingkasan: string;
  poinList: PoinMOM[];
  pesertaList: PesertaMOM[];
  fotoList: FotoDokumentasiMOM[];
  orientasi?: 'landscape' | 'portrait';
  dibuatPada?: string;
}

export const MOM_DEFAULT: DataMOM = {
  judul: 'MINUTES OF MEETING',
  tanggal: new Date().toISOString().slice(0, 10),
  waktu: '09:00 - Selesai WITA',
  tempat: 'Ruang Rapat Site / Kantor EBL',
  pesertaRingkasan: 'Tim Revegetasi, Nursery & Departemen Terkait',
  orientasi: 'landscape',
  poinList: [
    {
      id: 'p-1',
      no: 1,
      minutesOfMeeting: 'Koordinasi rencana kerja lapangan dan evaluasi progres mingguan.',
      pic: 'Agung L.',
      dueDate: '2026-09-30',
      remark: 'Prioritas tinggi',
    },
    {
      id: 'p-2',
      no: 2,
      minutesOfMeeting: 'Pemeriksaan stok bibit dan material nursery untuk persiapan tanam.',
      pic: 'Tim Nursery',
      dueDate: '2026-10-05',
      remark: 'Perlu verifikasi fisik',
    },
  ],
  pesertaList: [
    { id: 'peserta-1', nama: 'Bambang Octaryono', jabatan: 'KTT', instansi: 'PT EBL' },
    { id: 'peserta-2', nama: 'M. Yusriani', jabatan: 'HCA Section Head', instansi: 'PT EBL' },
    { id: 'peserta-3', nama: 'Agung Laksono', jabatan: 'Crew Revegetasi', instansi: 'PT EBL' },
    { id: 'peserta-4', nama: 'Peserta 4', jabatan: 'Staff', instansi: 'PT EBL' },
  ],
  fotoList: [],
};

/**
 * Ekspor dokumen Minutes of Meeting ke format Word (.doc)
 * Mendukung tata letak Landscape / Portrait adaptif dengan tabel presisi sesuai template asli.
 */
export const eksporMOMKeWord = async (data: DataMOM): Promise<void> => {
  const isLandscape = (data.orientasi ?? 'landscape') === 'landscape';

  // Format tanggal Indonesia
  let tglFormatted = data.tanggal;
  try {
    const [y, m, d] = data.tanggal.split('-').map(Number);
    const namaBulan = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    if (y && m && d) {
      tglFormatted = `${d} ${namaBulan[m - 1]} ${y}`;
    }
  } catch {
    /* abaikan */
  }

  // Bangun baris tabel poin rapat
  const barisPoin = data.poinList.map((p, idx) => `
    <tr style="mso-yfti-irow:${idx + 1}; page-break-inside:avoid;">
      <td style="border:1.0pt solid black; padding:6px 8px; text-align:center; vertical-align:top; font-size:10pt; font-family:Arial, sans-serif;">
        ${p.no || idx + 1}
      </td>
      <td style="border:1.0pt solid black; padding:6px 8px; text-align:left; vertical-align:top; font-size:10pt; font-family:Arial, sans-serif;">
        ${escapeHtml(p.minutesOfMeeting || '')}
      </td>
      <td style="border:1.0pt solid black; padding:6px 8px; text-align:center; vertical-align:top; font-size:10pt; font-family:Arial, sans-serif;">
        ${escapeHtml(p.pic || '')}
      </td>
      <td style="border:1.0pt solid black; padding:6px 8px; text-align:center; vertical-align:top; font-size:10pt; font-family:Arial, sans-serif;">
        ${escapeHtml(p.dueDate || '')}
      </td>
      <td style="border:1.0pt solid black; padding:6px 8px; text-align:left; vertical-align:top; font-size:10pt; font-family:Arial, sans-serif;">
        ${escapeHtml(p.remark || '')}
      </td>
    </tr>
  `).join('');

  // Bangun baris peserta (grid 4 kolom per kelompok peserta)
  const pesertaChunks: PesertaMOM[][] = [];
  for (let i = 0; i < data.pesertaList.length; i += 4) {
    pesertaChunks.push(data.pesertaList.slice(i, i + 4));
  }

  let tabelPesertaHtml = '';
  pesertaChunks.forEach((chunk, chunkIdx) => {
    // Pad to 4 columns if needed
    const padded = [...chunk];
    while (padded.length < 4) {
      padded.push({ id: `empty-${padded.length}`, nama: '', jabatan: '', instansi: '' });
    }

    tabelPesertaHtml += `
      <table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse; width:100%; border:1.0pt solid black; margin-bottom:12pt; page-break-inside:avoid; mso-table-lspace:0pt; mso-table-rspace:0pt;">
        <!-- Baris Nama -->
        <tr style="height:24pt;">
          ${padded.map((peserta) => `
            <td style="width:25%; border:1.0pt solid black; padding:5px 8px; text-align:center; font-family:Arial, sans-serif; font-size:10pt; font-weight:bold; background-color:#f9f9f9;">
              ${escapeHtml(peserta.nama || 'Nama')}
            </td>
          `).join('')}
        </tr>
        <!-- Baris Tanda Tangan -->
        <tr style="height:65pt;">
          ${padded.map((peserta) => `
            <td style="width:25%; border:1.0pt solid black; padding:8px; text-align:center; vertical-align:bottom; font-family:Arial, sans-serif; font-size:9pt; color:#666;">
              ${peserta.ttdUrl ? `<img src="${peserta.ttdUrl}" style="max-height:50pt; max-width:80%;" />` : (peserta.nama ? '( ttd )' : '')}
            </td>
          `).join('')}
        </tr>
        <!-- Baris Jabatan -->
        <tr style="height:22pt;">
          ${padded.map((peserta) => `
            <td style="width:25%; border:1.0pt solid black; padding:5px 8px; text-align:center; font-family:Arial, sans-serif; font-size:9.5pt;">
              ${escapeHtml(peserta.jabatan || 'Jabatan')}
            </td>
          `).join('')}
        </tr>
        <!-- Baris Instansi -->
        <tr style="height:22pt;">
          ${padded.map((peserta) => `
            <td style="width:25%; border:1.0pt solid black; padding:5px 8px; text-align:center; font-family:Arial, sans-serif; font-size:9.5pt;">
              ${escapeHtml(peserta.instansi || 'Instansi')}
            </td>
          `).join('')}
        </tr>
      </table>
    `;
  });

  // Dokumentasi foto
  let dokumentasiFotoHtml = '';
  if (data.fotoList && data.fotoList.length > 0) {
    dokumentasiFotoHtml = `
      <div style="page-break-before:auto; margin-top:16pt;">
        <h4 style="font-family:Arial, sans-serif; font-size:11pt; font-weight:bold; margin-bottom:8pt;">
          Dokumentasi Pertemuan
        </h4>
        <div style="display:flex; flex-wrap:wrap; gap:12pt;">
          ${data.fotoList.map((f, i) => `
            <div style="text-align:center; margin-bottom:12pt; display:inline-block; vertical-align:top; width:45%;">
              <img src="${f.url}" style="max-width:100%; height:auto; max-height:220pt; border:1pt solid #ccc; object-fit:contain;" />
              ${f.keterangan ? `<p style="font-family:Arial, sans-serif; font-size:9pt; color:#555; margin-top:4pt;">${escapeHtml(f.keterangan)}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    dokumentasiFotoHtml = `
      <div style="margin-top:16pt; font-family:Arial, sans-serif; font-size:10pt; color:#777; font-style:italic;">
        Foto, foto, foto
      </div>
    `;
  }

  // Dimensi Word & CSS @page
  const pageDef = isLandscape
    ? `@page Section1 {
        size: 11in 8.5in;
        mso-page-orientation: landscape;
        margin: 0.5in 0.6in 0.6in 0.5in;
        mso-header-margin: 0.3in;
        mso-footer-margin: 0.3in;
      }
      div.Section1 { page: Section1; }`
    : `@page Section1 {
        size: 8.5in 11in;
        mso-page-orientation: portrait;
        margin: 0.6in 0.6in 0.6in 0.6in;
        mso-header-margin: 0.3in;
        mso-footer-margin: 0.3in;
      }
      div.Section1 { page: Section1; }`;

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${escapeHtml(data.judul || 'MINUTES OF MEETING')}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        ${pageDef}
        body {
          font-family: Arial, sans-serif;
          font-size: 10pt;
          line-height: 1.35;
          color: #000;
        }
        table {
          mso-displayed-decimal-separator: ".";
          mso-displayed-thousand-separator: ",";
        }
      </style>
    </head>
    <body lang="ID">
      <div class="Section1">
        <!-- Kop Surat Resmi: Logo Hasnur Group & PT Energi Batubara Lestari (Sesuai P0 Template Asli) -->
        <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse; width:100%; margin-bottom:6pt; font-family:Arial, sans-serif;">
          <tr>
            <td style="width:70pt; vertical-align:middle; padding-right:12pt;">
              <img src="${LOGO_HASNUR_BASE64}" style="height:50pt; width:auto;" />
            </td>
            <td style="vertical-align:middle;">
              <p style="font-size:13pt; font-weight:bold; margin:0; line-height:1.2; text-transform:uppercase;">PT. ENERGI BATUBARA LESTARI</p>
              <p style="font-size:9pt; margin:2pt 0 0 0; line-height:1.2;">Mine Site Office : Jl. Jend Sudirman - Tapin, Kalimantan Selatan</p>
              <p style="font-size:9pt; margin:1pt 0 0 0; line-height:1.2;">Telp. 0517-2034058 Fax. 0517-2034058</p>
            </td>
          </tr>
        </table>
        <div style="border-bottom:1.5pt solid black; margin-bottom:14pt;"></div>

        <!-- Judul Dokumen -->
        <p align="center" style="text-align:center; font-family:Arial, sans-serif; font-size:14pt; font-weight:bold; margin-top:0pt; margin-bottom:14pt; letter-spacing:0.5pt;">
          ${escapeHtml(data.judul || 'MINUTES OF MEETING')}
        </p>

        <!-- Informasi / Metadata Pertemuan -->
        <table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse; width:100%; margin-bottom:12pt; font-family:Arial, sans-serif; font-size:10pt;">
          <tr style="height:18pt;">
            <td style="width:14%; padding:2px 4px; font-weight:normal;">Tanggal</td>
            <td style="width:2%; text-align:center;">:</td>
            <td style="width:84%; padding:2px 4px;">${escapeHtml(tglFormatted || '')}</td>
          </tr>
          <tr style="height:18pt;">
            <td style="width:14%; padding:2px 4px; font-weight:normal;">Waktu</td>
            <td style="width:2%; text-align:center;">:</td>
            <td style="width:84%; padding:2px 4px;">${escapeHtml(data.waktu || '')}</td>
          </tr>
          <tr style="height:18pt;">
            <td style="width:14%; padding:2px 4px; font-weight:normal;">Tempat</td>
            <td style="width:2%; text-align:center;">:</td>
            <td style="width:84%; padding:2px 4px;">${escapeHtml(data.tempat || '')}</td>
          </tr>
          <tr style="height:18pt;">
            <td style="width:14%; padding:2px 4px; font-weight:normal;">Peserta</td>
            <td style="width:2%; text-align:center;">:</td>
            <td style="width:84%; padding:2px 4px;">${escapeHtml(data.pesertaRingkasan || '')}</td>
          </tr>
        </table>

        <!-- Tabel 1: Poin Pertemuan (Minutes of Meeting) -->
        <table border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse; width:100%; border:1.0pt solid black; margin-bottom:16pt;">
          <thead>
            <tr style="background-color:#eaeaea; font-weight:bold; text-align:center; font-family:Arial, sans-serif; font-size:10pt; height:24pt;">
              <th style="border:1.0pt solid black; padding:6px 4px; width:5%;">No</th>
              <th style="border:1.0pt solid black; padding:6px 8px; width:52%;">Minutes of Meeting</th>
              <th style="border:1.0pt solid black; padding:6px 4px; width:14%;">Pic</th>
              <th style="border:1.0pt solid black; padding:6px 4px; width:12%;">Due Date</th>
              <th style="border:1.0pt solid black; padding:6px 6px; width:17%;">Remark</th>
            </tr>
          </thead>
          <tbody>
            ${barisPoin}
          </tbody>
        </table>

        <!-- Header Seksi Peserta -->
        <p style="font-family:Arial, sans-serif; font-size:11pt; font-weight:bold; margin-top:10pt; margin-bottom:6pt;">
          Peserta
        </p>

        <!-- Tabel 2: Daftar Hadir & Tanda Tangan Peserta -->
        ${tabelPesertaHtml}

        <!-- Seksi Foto Dokumentasi -->
        ${dokumentasiFotoHtml}
      </div>
    </body>
    </html>
  `;

  // Unduh dokumen sebagai file .doc
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const tglFile = data.tanggal ? data.tanggal.replace(/-/g, '') : 'draf';
  link.href = url;
  link.download = `MOM-${tglFile}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

import { bukuBaru, simpanBuku } from './excel';

/**
 * Ekspor dokumen Minutes of Meeting ke format Excel (.xlsx)
 * Menata tabel notulen, daftar hadir peserta 4 kolom, dan metadata secara rapi.
 */
export const eksporMOMKeExcel = async (data: DataMOM): Promise<'dibagikan' | 'diunduh'> => {
  const wb = await bukuBaru();
  const ws = wb.addWorksheet('Minutes of Meeting', {
    pageSetup: {
      orientation: data.orientasi === 'portrait' ? 'portrait' : 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });

  // Kolom
  ws.columns = [
    { width: 6 },   // Col A: No
    { width: 48 },  // Col B: Minutes of Meeting
    { width: 18 },  // Col C: PIC
    { width: 16 },  // Col D: Due Date
    { width: 22 },  // Col E: Remark
  ];

  // Judul
  ws.mergeCells('A2:E2');
  const cellJudul = ws.getCell('A2');
  cellJudul.value = data.judul || 'MINUTES OF MEETING';
  cellJudul.font = { name: 'Arial', size: 14, bold: true };
  cellJudul.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 26;

  // Metadata
  let r = 4;
  const meta: [string, string][] = [
    ['Tanggal', data.tanggal || ''],
    ['Waktu', data.waktu || ''],
    ['Tempat', data.tempat || ''],
    ['Peserta', data.pesertaRingkasan || ''],
  ];

  meta.forEach(([k, v]) => {
    ws.getCell(`A${r}`).value = k;
    ws.getCell(`A${r}`).font = { name: 'Arial', size: 10 };
    ws.getCell(`B${r}`).value = `:  ${v}`;
    ws.getCell(`B${r}`).font = { name: 'Arial', size: 10 };
    r++;
  });
  r++; // Spasi

  // Header Tabel 1
  ws.getRow(r).values = ['No', 'Minutes of Meeting', 'Pic', 'Due Date', 'Remark'];
  ws.getRow(r).height = 24;
  for (let c = 1; c <= 5; c++) {
    const cell = ws.getRow(r).getCell(c);
    cell.font = { name: 'Arial', size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAEAEA' } };
    cell.alignment = { horizontal: c === 2 || c === 5 ? 'left' : 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };
  }
  r++;

  // Data Tabel 1
  data.poinList.forEach((p, idx) => {
    const row = ws.getRow(r);
    row.values = [p.no || idx + 1, p.minutesOfMeeting || '', p.pic || '', p.dueDate || '', p.remark || ''];
    for (let c = 1; c <= 5; c++) {
      const cell = row.getCell(c);
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = {
        horizontal: c === 2 || c === 5 ? 'left' : 'center',
        vertical: 'top',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
    r++;
  });

  r += 2; // Spasi

  // Header Seksi Peserta
  ws.getCell(`A${r}`).value = 'Peserta';
  ws.getCell(`A${r}`).font = { name: 'Arial', size: 11, bold: true };
  r++;

  // Tabel 2: Peserta (Grid 4 kolom)
  const chunks: PesertaMOM[][] = [];
  for (let i = 0; i < data.pesertaList.length; i += 4) {
    chunks.push(data.pesertaList.slice(i, i + 4));
  }

  chunks.forEach((chunk) => {
    const padded = [...chunk];
    while (padded.length < 4) {
      padded.push({ id: '', nama: '', jabatan: '', instansi: '' });
    }

    const rNama = r;
    const rTtd = r + 1;
    const rJab = r + 2;
    const rInst = r + 3;

    ws.getRow(rNama).height = 22;
    ws.getRow(rTtd).height = 45;
    ws.getRow(rJab).height = 20;
    ws.getRow(rInst).height = 20;

    padded.forEach((p, i) => {
      const col = i + 1;
      const cNama = ws.getRow(rNama).getCell(col);
      cNama.value = p.nama || '';
      cNama.font = { name: 'Arial', size: 10, bold: true };
      cNama.alignment = { horizontal: 'center', vertical: 'middle' };
      cNama.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F9F9' } };
      cNama.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

      const cTtd = ws.getRow(rTtd).getCell(col);
      cTtd.value = p.nama ? '( ttd )' : '';
      cTtd.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF888888' } };
      cTtd.alignment = { horizontal: 'center', vertical: 'bottom' };
      cTtd.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

      const cJab = ws.getRow(rJab).getCell(col);
      cJab.value = p.jabatan || '';
      cJab.font = { name: 'Arial', size: 9.5 };
      cJab.alignment = { horizontal: 'center', vertical: 'middle' };
      cJab.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

      const cInst = ws.getRow(rInst).getCell(col);
      cInst.value = p.instansi || '';
      cInst.font = { name: 'Arial', size: 9.5 };
      cInst.alignment = { horizontal: 'center', vertical: 'middle' };
      cInst.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    r += 5;
  });

  const tglFile = data.tanggal ? data.tanggal.replace(/-/g, '') : 'draf';
  return simpanBuku(wb, `MOM-${tglFile}.xlsx`, 'Minutes of Meeting');
};

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
