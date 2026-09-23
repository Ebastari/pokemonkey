/**
 * ============================================================================
 * MONKEY POINT — Generator Laporan Presentasi PowerPoint (.pptx) Otomatis
 * ============================================================================
 * 
 * Modul ini mengekstrak dan memformat seluruh data operasional dari POKEMONKEY:
 * 1. Register PICA Lengkap (Ditampilkan secara UTUH tanpa terpotong)
 * 2. Prakiraan Cuaca 3 Hari (BMKG - prakiraan desa acuan di Tapin, lewat /api/cuaca)
 * 3. Monitoring & Histori Deteksi Titik Api (NASA FIRMS Satelit VIIRS & NOAA)
 * 4. Agenda & Rapat Kalender Tim (WITA)
 * 5. Memo Operasional yang Tersimpan (K3L, Teknis, Arahan Pengawas)
 * 6. Roster Kerja Tim (Jadwal shift 7 hari)
 * 
 * Desain & Tata Letak:
 * - Menggunakan template resmi korporat Hasnur Group (`public/template-ppt.pptx`).
 * - Layout 1: Title Slide (Cover dengan logo Hasnur Group & PT EBL)
 * - Layout 2: Title and Content (Slide isi dengan header & footer resmi)
 * - Layout 4: Sanggahan / Disclaimer resmi Hasnur Group
 * - Tanpa tombol interaktif/detail (khusus untuk presentasi & pencetakan eksekutif)
 */

import JSZip from 'jszip';
import { simpanBerkas } from './unduh';
import { ambilBerkas } from './api';
import { ringkasRevegetasi, totalTahun, jumlah, ha, type BarisRevegetasi } from './revegetasi';
import * as W from './waktu';

// ---------------------------------------------------------------------------
// 1. Tipe Data (Interfaces)
// ---------------------------------------------------------------------------

export interface MonkeyPointPicaItem {
  id: string;
  nomor: number;
  bidang: string;
  prioritas: string;
  judul: string;
  judul_singkat?: string | null;
  akar?: string | null;
  tindakan?: string | null;
  pic_nama?: string | null;
  due_date?: string | null;
  status: string;
  target?: number | null;
  realisasi?: number | null;
  satuan?: string | null;
  sisa_hari?: number | null;
}

export interface MonkeyPointRosterItem {
  user_id: string;
  nama: string;
  tanggal: string;
  kode: string;
  catatan?: string | null;
}

export interface MonkeyPointMemoItem {
  id: string;
  judul: string;
  ringkasan?: string | null;
  kategori?: string | null;
  status?: string | null;
  tanggal?: string | null;
  dibuat_pada?: string | null;
  oleh_nama?: string | null;
}

export interface MonkeyPointCuacaSlot {
  waktu: string;
  kondisi: string;
  suhu: number;
  lembap: number;
  angin: string;
  hujanMm?: number;
  rekomendasi?: string;
}

export interface MonkeyPointCuacaData {
  desa?: string;
  suhuSekarang?: number;
  kondisiSekarang?: string;
  kelembapan?: number;
  angin?: string;
  hujanMm?: number;
  kesesuaianTanam?: string;
  slot?: MonkeyPointCuacaSlot[];
}

export interface MonkeyPointTitikApiItem {
  id: string;
  waktu: string;
  lat: number;
  lon: number;
  satelit: string;
  confidence: string;
  zona: string;
  status: string;
  catatan?: string | null;
}

export interface MonkeyPointTitikApiData {
  /** false = data gagal dimuat / pemantauan belum aktif: slide menulis "tidak tersedia", tidak pernah "aman". */
  tersedia: boolean;
  alasan?: string | null;
  radiusWaspadaKm?: number;
  titikWaspada: number;
  /** Titik di dalam IUP/IPPKH ditambah di dalam petak Rehab DAS (7 hari). */
  titikDalam?: number;
  /** Jumlah seluruh titik 7 hari (tabel hanya memuat 10 terpenting). */
  total?: number;
  statusKonsesi: string;
  daftar: MonkeyPointTitikApiItem[];
}

export interface MonkeyPointJadwalItem {
  id: string;
  judul: string;
  tanggal: string;
  jamMulai?: string | null;
  jamSelesai?: string | null;
  pic?: string | null;
  lokasi?: string | null;
  selesai?: boolean;
}

export interface MonkeyPointGaleriItem {
  tag: string;
  tgl: string;
  judul: string;
  desc: string;
  pic: string;
  foto?: string | null;
}

export interface MonkeyPointData {
  pica: MonkeyPointPicaItem[];
  roster: MonkeyPointRosterItem[];
  memo: MonkeyPointMemoItem[];
  cuaca?: MonkeyPointCuacaData | null;
  titikApi?: MonkeyPointTitikApiData | null;
  jadwal?: MonkeyPointJadwalItem[];
  galeri?: MonkeyPointGaleriItem[];
  periode?: { id: string; judul?: string | null };
  namaPengguna?: string;
  hariIni?: string;
  /** Sumber data yang gagal dimuat saat laporan dibuat. */
  sumberGagal?: string[];
  /** Realisasi revegetasi per tahun (sama dengan panel KEBUN). */
  revegetasi?: BarisRevegetasi[];
  /** true = server tidak terjangkau, memakai salinan lokal lib/revegetasi.ts. */
  revegetasiCadangan?: boolean;
}

// ---------------------------------------------------------------------------
// 2. Fungsi Pembantu XML & Ukuran (OpenXML Helpers)
// ---------------------------------------------------------------------------

function escXml(t: unknown): string {
  return String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const sz = (pt: number) => Math.round(pt * 100);

/**
 * Gaya POKEMONKEY di dalam PPT (sama dengan index.css): Pixelify Sans untuk isi,
 * Press Start 2P hanya untuk judul & angka besar, kotak piksel bersudut tajam
 * dengan bingkai tebal dan bayangan keras. Latar & tata letak tetap dari template.
 * Kedua huruf gratis di Google Fonts; pasang di komputer penayang agar tampil.
 */
const HURUF_ISI = 'Pixelify Sans';
const HURUF_JUDUL = 'Press Start 2P';
const BAYANGAN_PIKSEL = '<a:effectLst><a:outerShdw blurRad="0" dist="50800" dir="2700000" algn="tl" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="55000"/></a:srgbClr></a:outerShdw></a:effectLst>';

const KONTEN_X = 800000;
const KONTEN_Y = 1400000;
const KONTEN_W = 10592000;

// Posisi judul slide agar tidak menabrak pita atas kiri (image2.png) dan logo kanan (image3.png)
const JUDUL_X = 2200000;
const JUDUL_Y = 400000;
const JUDUL_W = 7600000;

/** Foto galeri yang sudah dimasukkan ke ppt/media dan punya relasi di slide galeri. */
interface FotoSiap { rId: string; nama: string; lebar: number; tinggi: number }

/** Kecilkan foto ke sisi terpanjang 1280 px, JPEG 85% — PPT tetap ringan untuk dikirim lewat WA. */
async function siapkanFoto(blob: Blob): Promise<{ bytes: Uint8Array; lebar: number; tinggi: number } | null> {
  try {
    const bmp = await createImageBitmap(blob);
    const skala = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
    const lebar = Math.max(1, Math.round(bmp.width * skala));
    const tinggi = Math.max(1, Math.round(bmp.height * skala));
    const kanvas = document.createElement('canvas');
    kanvas.width = lebar;
    kanvas.height = tinggi;
    kanvas.getContext('2d')?.drawImage(bmp, 0, 0, lebar, tinggi);
    bmp.close?.();
    const jpeg = await new Promise<Blob | null>((r) => kanvas.toBlob(r, 'image/jpeg', 0.85));
    return jpeg ? { bytes: new Uint8Array(await jpeg.arrayBuffer()), lebar, tinggi } : null;
  } catch {
    return null; // bukan gambar yang bisa dibaca (mis. SVG contoh di mode demo): kartu tampil tanpa foto
  }
}

// ---------------------------------------------------------------------------
// Grafik realisasi reklamasi: batang piksel dari bentuk persegi (tanpa objek chart)
// ---------------------------------------------------------------------------

interface GayaTeks { sz?: number; warna?: string; tebal?: boolean; huruf?: string; rata?: 'l' | 'ctr' | 'r' }

function paragraf(teks: string, g: GayaTeks = {}): string {
  return `<a:p><a:pPr algn="${g.rata ?? 'l'}"/><a:r><a:rPr lang="id-ID" sz="${sz(g.sz ?? 11)}"${g.tebal ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${g.warna ?? '1F2937'}"/></a:solidFill><a:latin typeface="${g.huruf ?? HURUF_ISI}"/></a:rPr><a:t>${escXml(teks)}</a:t></a:r></a:p>`;
}

interface GayaKotak { latar?: string | null; garis?: string | null; tebalGaris?: number; bayangan?: boolean; anchor?: 't' | 'ctr' | 'b'; inset?: number }

/** Satu bentuk persegi (kotak piksel / batang grafik / label), id unik per slide. */
function bentuk(id: number, x: number, y: number, w: number, h: number, isi = '', g: GayaKotak = {}): string {
  const inset = g.inset ?? 60000;
  return `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="${id}" name="Bentuk ${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${Math.round(x)}" y="${Math.round(y)}"/><a:ext cx="${Math.max(1, Math.round(w))}" cy="${Math.max(1, Math.round(h))}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          ${g.latar ? `<a:solidFill><a:srgbClr val="${g.latar}"/></a:solidFill>` : '<a:noFill/>'}
          ${g.garis ? `<a:ln w="${g.tebalGaris ?? 25400}"><a:solidFill><a:srgbClr val="${g.garis}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>'}
          ${g.bayangan ? BAYANGAN_PIKSEL : ''}
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="${inset}" tIns="${inset}" rIns="${inset}" bIns="${inset}" anchor="${g.anchor ?? 'ctr'}" wrap="square"><a:noAutofit/></a:bodyPr>
          <a:lstStyle/>
          ${isi || '<a:p><a:endParaRPr lang="id-ID"/></a:p>'}
        </p:txBody>
      </p:sp>`;
}

const bungkusSlide = (judul: string, subjudul: string, isi: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${xmlJudulSlide(judul, subjudul)}
      ${isi}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;

const WARNA_APL = '16A34A';
const WARNA_HUTAN = '065F46';

function catatanSumberRealisasi(data: MonkeyPointData): string {
  return data.revegetasiCadangan
    ? 'Server tidak terjangkau: memakai salinan lokal data realisasi (Realisasi Permintaan Amdal, Summary)'
    : 'Sumber: Realisasi Permintaan Amdal (Summary) · satuan hektare';
}

/** Slide realisasi 1: total, APL vs Hutan, dan batang bertumpuk per tahun. */
function buatSlideRealisasiTahun(data: MonkeyPointData): string {
  const baris = [...(data.revegetasi ?? [])].sort((a, b) => a.tahun - b.tahun);
  let id = 100;
  if (!baris.length) {
    return bungkusSlide('REALISASI PROGRES REKLAMASI', 'Data realisasi tidak tersedia',
      bentuk(id++, KONTEN_X + 1500000, KONTEN_Y + 1000000, 7592000, 1600000,
        paragraf('Data realisasi revegetasi tidak tersedia saat laporan dibuat.', { sz: 14, tebal: true, rata: 'ctr', warna: '92400E' }),
        { latar: 'FEF3C7', garis: '1F2937', tebalGaris: 38100, bayangan: true }));
  }
  const r = ringkasRevegetasi(baris);
  const bagian: string[] = [];

  // Kolom angka (kotak piksel).
  const statW = 2550000;
  const statH = 900000;
  const stat: [string, string, string][] = [
    ['TOTAL REALISASI', `${ha(r.total)} HA`, '14532D'],
    ['KAWASAN APL', `${ha(r.apl)} HA`, WARNA_APL],
    ['KAWASAN HUTAN (PPKH)', `${ha(r.hutan)} HA`, WARNA_HUTAN],
    [`TAHUN ${r.terakhir?.tahun ?? '—'}`, r.terakhir ? `${ha(totalTahun(r.terakhir))} HA` : '—', '92400E'],
  ];
  stat.forEach(([label, nilai, warna], i) => {
    bagian.push(bentuk(id++, KONTEN_X, KONTEN_Y + i * (statH + 140000), statW, statH,
      paragraf(label, { sz: 11, tebal: true, warna: '4B5563' }) + paragraf(nilai, { sz: 13, huruf: HURUF_JUDUL, warna }),
      { latar: 'FFFFFF', garis: warna, tebalGaris: 38100, bayangan: true, anchor: 'ctr', inset: 110000 }));
  });

  // Grafik batang bertumpuk: APL (bawah) + Hutan (atas), label total di atas batang.
  const x0 = KONTEN_X + statW + 350000;
  const lebar = KONTEN_W - statW - 350000;
  const atas = KONTEN_Y + 380000;
  const tinggi = 3350000;
  const dasar = atas + tinggi;
  const ruangLabel = 330000;
  const maks = r.maks || 1;
  const slot = lebar / baris.length;
  const bw = slot * 0.58;

  // Legenda.
  bagian.push(bentuk(id++, x0, KONTEN_Y, 160000, 160000, '', { latar: WARNA_APL, garis: '111827', tebalGaris: 12700 }));
  bagian.push(bentuk(id++, x0 + 190000, KONTEN_Y - 60000, 1100000, 280000, paragraf('APL', { sz: 10, tebal: true }), { inset: 0 }));
  bagian.push(bentuk(id++, x0 + 1100000, KONTEN_Y, 160000, 160000, '', { latar: WARNA_HUTAN, garis: '111827', tebalGaris: 12700 }));
  bagian.push(bentuk(id++, x0 + 1290000, KONTEN_Y - 60000, 1800000, 280000, paragraf('Hutan (PPKH)', { sz: 10, tebal: true }), { inset: 0 }));

  baris.forEach((b, i) => {
    const bx = x0 + i * slot + (slot - bw) / 2;
    const skala = (tinggi - ruangLabel) / maks;
    const hApl = b.apl * skala;
    const hHutan = b.hutan * skala;
    if (hApl > 0) bagian.push(bentuk(id++, bx, dasar - hApl, bw, hApl, '', { latar: WARNA_APL, garis: '111827', tebalGaris: 12700 }));
    if (hHutan > 0) bagian.push(bentuk(id++, bx, dasar - hApl - hHutan, bw, hHutan, '', { latar: WARNA_HUTAN, garis: '111827', tebalGaris: 12700 }));
    const total = totalTahun(b);
    bagian.push(bentuk(id++, x0 + i * slot, dasar - hApl - hHutan - 300000, slot, 280000,
      paragraf(total > 0 ? ha(total) : '0', { sz: 9, tebal: true, rata: 'ctr' }), { inset: 0, anchor: 'b' }));
    bagian.push(bentuk(id++, x0 + i * slot, dasar + 50000, slot, 260000,
      paragraf(String(b.tahun), { sz: 8, huruf: HURUF_JUDUL, rata: 'ctr' }), { inset: 0, anchor: 't' }));
  });
  // Garis dasar.
  bagian.push(bentuk(id++, x0, dasar, lebar, 25400, '', { latar: '111827' }));
  bagian.push(bentuk(id++, x0, dasar + 380000, lebar, 280000,
    paragraf(catatanSumberRealisasi(data), { sz: 9, warna: '6B7280', rata: 'r' }), { inset: 0 }));

  return bungkusSlide('REALISASI PROGRES REKLAMASI',
    `Per tahun ${baris[0].tahun}–${baris[baris.length - 1].tahun}, status kawasan APL dan Hutan (PPKH)`, bagian.join(''));
}

/** Slide realisasi 2: batang mendatar per jenis kegiatan dan per blok (akumulasi semua tahun). */
function buatSlideRealisasiRincian(data: MonkeyPointData): string {
  const baris = data.revegetasi ?? [];
  let id = 100;
  if (!baris.length) {
    return bungkusSlide('RINCIAN REALISASI REKLAMASI', 'Data realisasi tidak tersedia',
      bentuk(id++, KONTEN_X + 1500000, KONTEN_Y + 1000000, 7592000, 1600000,
        paragraf('Data realisasi revegetasi tidak tersedia saat laporan dibuat.', { sz: 14, tebal: true, rata: 'ctr', warna: '92400E' }),
        { latar: 'FEF3C7', garis: '1F2937', tebalGaris: 38100, bayangan: true }));
  }
  const r = ringkasRevegetasi(baris);
  const kegiatan: [string, number][] = [
    ['IPD', jumlah(baris.map((b) => b.ipd))],
    ['OPD', jumlah(baris.map((b) => b.opd))],
    ['Timbunan Soil', jumlah(baris.map((b) => b.timbunan_soil))],
    ['Fasilitas Penunjang', jumlah(baris.map((b) => b.fasilitas))],
  ];
  const blok: [string, number][] = r.perBlok.map((b) => [b.nama, b.luas]);
  const bagian: string[] = [];

  const panelW = (KONTEN_W - 300000) / 2;
  const panelH = 4300000;
  const panel = (x: number, judul: string, isi: [string, number][], warna: string) => {
    bagian.push(bentuk(id++, x, KONTEN_Y, panelW, panelH, '', { latar: 'FFFFFF', garis: '111827', tebalGaris: 38100, bayangan: true }));
    bagian.push(bentuk(id++, x + 150000, KONTEN_Y + 110000, panelW - 300000, 360000, paragraf(judul, { sz: 10, huruf: HURUF_JUDUL, warna }), { inset: 0 }));
    const maks = Math.max(...isi.map(([, n]) => n), 0.001);
    const barisH = Math.min(620000, (panelH - 700000) / Math.max(isi.length, 1));
    const labelW = 1500000;
    const nilaiW = 1000000;
    const batangMaks = panelW - 300000 - labelW - nilaiW;
    isi.forEach(([nama, n], i) => {
      const y = KONTEN_Y + 600000 + i * barisH;
      const bh = barisH * 0.55;
      bagian.push(bentuk(id++, x + 150000, y, labelW, barisH, paragraf(nama, { sz: 11, tebal: true }), { inset: 0 }));
      const w = Math.max(0, (n / maks) * batangMaks);
      if (w > 0) bagian.push(bentuk(id++, x + 150000 + labelW, y + (barisH - bh) / 2, w, bh, '', { latar: warna, garis: '111827', tebalGaris: 12700 }));
      bagian.push(bentuk(id++, x + 150000 + labelW + w + 60000, y, nilaiW, barisH, paragraf(`${ha(n)} ha`, { sz: 10, tebal: true }), { inset: 0 }));
    });
    if (!isi.length) bagian.push(bentuk(id++, x + 150000, KONTEN_Y + 800000, panelW - 300000, 500000, paragraf('Belum ada data.', { sz: 11, warna: '6B7280' }), { inset: 0 }));
  };
  panel(KONTEN_X, 'PER JENIS KEGIATAN', kegiatan, 'B45309');
  panel(KONTEN_X + panelW + 300000, 'PER BLOK', blok, '0369A1');
  bagian.push(bentuk(id++, KONTEN_X, KONTEN_Y + panelH + 120000, KONTEN_W, 280000,
    paragraf(`Akumulasi ${baris.length} tahun · total ${ha(r.total)} ha · ${catatanSumberRealisasi(data)}`, { sz: 9, warna: '6B7280', rata: 'r' }), { inset: 0 }));

  return bungkusSlide('RINCIAN REALISASI REKLAMASI', 'Per jenis kegiatan (IPD, OPD, Timbunan Soil, Fasilitas) dan per blok', bagian.join(''));
}

/** Satu baris tabel selebar `kolom` berisi keterangan (mis. data tidak tersedia). */
function barisKeterangan(kolom: number, teks: string, warna = '92400E', latar = 'FEF3C7'): string {
  const gabung = '<a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></a:txBody><a:tcPr/></a:tc>'.repeat(kolom - 1);
  return `
    <a:tr h="700000">
      <a:tc gridSpan="${kolom}">
        <a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="${sz(11)}" b="1"><a:solidFill><a:srgbClr val="${warna}"/></a:solidFill></a:rPr><a:t>${escXml(teks)}</a:t></a:r></a:p></a:txBody>
        <a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="${latar}"/></a:solidFill></a:tcPr>
      </a:tc>${gabung}
    </a:tr>`;
}

function xmlJudulSlide(judul: string, subjudul?: string): string {
  return `
    <p:sp>
      <p:nvSpPr>
        <p:cNvPr id="2" name="Title 1"/>
        <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
        <p:nvPr><p:ph type="title"/></p:nvPr>
      </p:nvSpPr>
      <p:spPr>
        <a:xfrm>
          <a:off x="${JUDUL_X}" y="${JUDUL_Y}"/>
          <a:ext cx="${JUDUL_W}" cy="850000"/>
        </a:xfrm>
      </p:spPr>
      <p:txBody>
        <a:bodyPr anchor="b"/>
        <a:lstStyle/>
        <a:p>
          <a:r>
            <a:rPr lang="id-ID" sz="${sz(14)}">
              <a:solidFill><a:srgbClr val="166534"/></a:solidFill>
              <a:latin typeface="${HURUF_JUDUL}"/>
            </a:rPr>
            <a:t>${escXml(judul)}</a:t>
          </a:r>
          ${
            subjudul
              ? `<a:br/><a:r>
                  <a:rPr lang="id-ID" sz="${sz(12)}">
                    <a:solidFill><a:srgbClr val="555555"/></a:solidFill>
                    <a:latin typeface="${HURUF_ISI}"/>
                  </a:rPr>
                  <a:t>${escXml(subjudul)}</a:t>
                </a:r>`
              : ''
          }
        </a:p>
      </p:txBody>
    </p:sp>
  `;
}

// ---------------------------------------------------------------------------
// 3. Generator Slide per Slide (Slide Builders)
// ---------------------------------------------------------------------------

/**
 * Slide 1: Cover / Halaman Judul
 * Layout 1 (Title Slide dengan branding Hasnur Group)
 */
function buatSlideCover(data: MonkeyPointData): string {
  const periode = data.periode?.id ?? (data.hariIni ?? W.hariIniWita()).slice(0, 7);
  const hariIni = data.hariIni ?? W.hariIniWita();
  const penyusun = data.namaPengguna ?? 'Departemen Revegetasi & Rehabilitasi';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>

      <!-- Main Title -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1000000" y="1900000"/><a:ext cx="10192000" cy="1250000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="id-ID" sz="${sz(18)}">
                <a:solidFill><a:srgbClr val="14532D"/></a:solidFill>
                <a:latin typeface="${HURUF_JUDUL}"/>
              </a:rPr>
              <a:t>LAPORAN OPERASIONAL &amp; KEPATUHAN</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="id-ID" sz="${sz(18)}" b="1">
                <a:solidFill><a:srgbClr val="D97706"/></a:solidFill>
                <a:latin typeface="${HURUF_ISI}"/>
              </a:rPr>
              <a:t>REVEGETASI &amp; REHABILITASI PT ENERGI BATUBARA LESTARI</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

      <!-- Subtitle & Meta -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Subtitle"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1500000" y="3250000"/><a:ext cx="9192000" cy="1150000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="t"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="id-ID" sz="${sz(14)}" b="1">
                <a:solidFill><a:srgbClr val="166534"/></a:solidFill>
                <a:latin typeface="${HURUF_ISI}"/>
              </a:rPr>
              <a:t>MONKEY POINT · CUACA, TITIK API, PICA, AGENDA &amp; MEMO</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="id-ID" sz="${sz(12)}">
                <a:solidFill><a:srgbClr val="555555"/></a:solidFill>
                <a:latin typeface="${HURUF_ISI}"/>
              </a:rPr>
              <a:t>Periode: ${escXml(periode)} · Data per ${escXml(hariIni)} WITA</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="id-ID" sz="${sz(11)}" i="1">
                <a:solidFill><a:srgbClr val="777777"/></a:solidFill>
                <a:latin typeface="${HURUF_ISI}"/>
              </a:rPr>
              <a:t>Disusun oleh: ${escXml(penyusun)} · PT EBL (Hasnur Group)</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

/**
 * Slide 2: Ringkasan Eksekutif (Executive Summary)
 */
function buatSlideSummary(data: MonkeyPointData): string {
  const totalPica = data.pica.length;
  const picaOpen = data.pica.filter((p) => p.status !== 'Closed').length;
  const picaTelat = data.pica.filter((p) => p.status !== 'Closed' && (p.sisa_hari ?? 1) < 0).length;
  const picaSelesai = data.pica.filter((p) => p.status === 'Closed').length;

  const teksWaspada = data.titikApi?.tersedia
    ? `${data.titikApi.titikWaspada} titik (≤${data.titikApi.radiusWaspadaKm ?? 2} km)`
    : 'data tidak tersedia';
  const teksKonsesi = data.titikApi?.tersedia ? data.titikApi.statusKonsesi : 'data titik api tidak tersedia';
  const teksCuaca = data.cuaca?.kondisiSekarang
    ? `${data.cuaca.kondisiSekarang} (${data.cuaca.suhuSekarang ?? '—'}°C)`
    : 'data cuaca tidak tersedia';
  const lokasiCuaca = data.cuaca?.desa ?? 'lokasi BMKG';
  const teksAgenda = data.jadwal ? `${data.jadwal.length} agenda mendatang` : 'data agenda tidak tersedia';
  const barisAgenda = !data.jadwal ? []
    : data.jadwal.length === 0 ? ['• Tidak ada agenda mendatang']
      : data.jadwal.slice(0, 2).map((j) => `• ${j.tanggal.slice(8, 10)}/${j.tanggal.slice(5, 7)} ${j.jamMulai ?? 'seharian'}: ${j.judul}`);
  const barisAgendaXml = barisAgenda
    .map((b) => `<a:p><a:r><a:rPr sz="${sz(11)}"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>${escXml(b)}</a:t></a:r></a:p>`)
    .join('');
  const totalMemo = data.memo.length;
  const barisCuacaDetail = data.cuaca?.kondisiSekarang
    ? `• Kelembapan: ${data.cuaca.kelembapan ?? '—'}% · Angin: ${data.cuaca.angin ?? '—'}`
    : '• Kelembapan dan angin: tidak tersedia';
  const saranCuaca = data.cuaca?.slot?.[0]?.rekomendasi ?? (data.cuaca ? 'Operasi normal' : 'tidak tersedia');
  const judulMemoXml = (totalMemo ? data.memo.slice(0, 2).map((m) => `• ${m.judul}`) : ['• Belum ada memo tim'])
    .map((b) => `<a:p><a:r><a:rPr sz="${sz(11)}"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>${escXml(b)}</a:t></a:r></a:p>`)
    .join('');
  const nPeringatanApi = (data.titikApi?.titikDalam ?? 0) + (data.titikApi?.titikWaspada ?? 0);
  const kesimpulan = [
    picaTelat > 0 ? `1. Percepat ${picaTelat} PICA yang lewat tenggat` : '1. Tidak ada PICA yang lewat tenggat',
    !data.titikApi?.tersedia ? '2. Data titik api tidak tersedia'
      : nPeringatanApi > 0 ? `2. Cek lapangan ${nPeringatanApi} titik api di zona peringatan` : '2. Tidak ada titik api di zona peringatan (7 hari)',
    !data.cuaca ? '3. Data cuaca tidak tersedia'
      : (data.cuaca.slot ?? []).some((c) => /hujan/i.test(c.kondisi)) ? '3. Hujan diprakirakan: jadwalkan penanaman'
        : '3. Cuaca kering: siram bibit pagi/sore',
  ];

  const cardW = 3300000;
  const cardH = 2100000;
  const gapX = 346000;
  const gapY = 200000;
  const y1 = KONTEN_Y + 100000;
  const y2 = y1 + cardH + gapY;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      ${xmlJudulSlide('RINGKASAN OPERASIONAL (EXECUTIVE SUMMARY)', 'Ikhtisar capaian PICA, pemantauan cuaca, titik api, agenda, dan memo')}

      <!-- Card 1: PICA STATUS -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="10" name="Card PICA"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${KONTEN_X}" y="${y1}"/><a:ext cx="${cardW}" cy="${cardH}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
          <a:ln w="38100"><a:solidFill><a:srgbClr val="166534"/></a:solidFill></a:ln>${BAYANGAN_PIKSEL}
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="150000" tIns="150000" rIns="150000" bIns="150000"/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr sz="${sz(9)}"><a:solidFill><a:srgbClr val="166534"/></a:solidFill><a:latin typeface="${HURUF_JUDUL}"/></a:rPr><a:t>PICA REGISTER</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Total ${totalPica} tugas audit operasional</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(11)}" b="1"><a:solidFill><a:srgbClr val="15803D"/></a:solidFill></a:rPr><a:t>• Selesai (Closed): ${picaSelesai} Tugas</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(11)}" b="1"><a:solidFill><a:srgbClr val="D97706"/></a:solidFill></a:rPr><a:t>• Open: ${picaOpen} Tugas</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(11)}" b="1"><a:solidFill><a:srgbClr val="DC2626"/></a:solidFill></a:rPr><a:t>• Telat: ${picaTelat} Tugas</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>

      <!-- Card 2: CUACA BMKG -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="11" name="Card Cuaca"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${KONTEN_X + cardW + gapX}" y="${y1}"/><a:ext cx="${cardW}" cy="${cardH}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
          <a:ln w="38100"><a:solidFill><a:srgbClr val="0284C7"/></a:solidFill></a:ln>${BAYANGAN_PIKSEL}
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="150000" tIns="150000" rIns="150000" bIns="150000"/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr sz="${sz(9)}"><a:solidFill><a:srgbClr val="0284C7"/></a:solidFill><a:latin typeface="${HURUF_JUDUL}"/></a:rPr><a:t>CUACA BMKG (DESA TAPIN)</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Prakiraan BMKG · ${escXml(lokasiCuaca)}</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(11)}" b="1"><a:solidFill><a:srgbClr val="0369A1"/></a:solidFill></a:rPr><a:t>• Kondisi: ${escXml(teksCuaca)}</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(11)}"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>${escXml(barisCuacaDetail)}</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}" i="1"><a:solidFill><a:srgbClr val="16A34A"/></a:solidFill></a:rPr><a:t>${escXml(`Saran: ${saranCuaca}`)}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>

      <!-- Card 3: TITIK API -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="12" name="Card Api"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${KONTEN_X + (cardW + gapX) * 2}" y="${y1}"/><a:ext cx="${cardW}" cy="${cardH}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
          <a:ln w="38100"><a:solidFill><a:srgbClr val="DC2626"/></a:solidFill></a:ln>${BAYANGAN_PIKSEL}
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="150000" tIns="150000" rIns="150000" bIns="150000"/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr sz="${sz(9)}"><a:solidFill><a:srgbClr val="DC2626"/></a:solidFill><a:latin typeface="${HURUF_JUDUL}"/></a:rPr><a:t>TITIK API (NASA FIRMS)</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>NASA FIRMS · area tambang dan Rehab DAS</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(11)}" b="1"><a:solidFill><a:srgbClr val="B91C1C"/></a:solidFill></a:rPr><a:t>• Titik Waspada: ${escXml(teksWaspada)}</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(11)}"><a:solidFill><a:srgbClr val="15803D"/></a:solidFill></a:rPr><a:t>• ${escXml(teksKonsesi)}</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}" i="1"><a:solidFill><a:srgbClr val="D97706"/></a:solidFill></a:rPr><a:t>${escXml(data.titikApi?.tersedia ? `${data.titikApi.total ?? 0} deteksi dalam 7 hari` : 'Status: data tidak tersedia')}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>

      <!-- Card 4: AGENDA & RAPAT -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="13" name="Card Agenda"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${KONTEN_X}" y="${y2}"/><a:ext cx="${cardW}" cy="${cardH}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
          <a:ln w="38100"><a:solidFill><a:srgbClr val="D97706"/></a:solidFill></a:ln>${BAYANGAN_PIKSEL}
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="150000" tIns="150000" rIns="150000" bIns="150000"/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr sz="${sz(9)}"><a:solidFill><a:srgbClr val="D97706"/></a:solidFill><a:latin typeface="${HURUF_JUDUL}"/></a:rPr><a:t>AGENDA &amp; RAPAT HARI INI</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>${escXml(teksAgenda)}</a:t></a:r></a:p>
          ${barisAgendaXml}
        </p:txBody>
      </p:sp>

      <!-- Card 5: MEMO OPERASIONAL -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="14" name="Card Memo Summary"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${KONTEN_X + cardW + gapX}" y="${y2}"/><a:ext cx="${cardW}" cy="${cardH}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
          <a:ln w="38100"><a:solidFill><a:srgbClr val="4F46E5"/></a:solidFill></a:ln>${BAYANGAN_PIKSEL}
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="150000" tIns="150000" rIns="150000" bIns="150000"/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr sz="${sz(9)}"><a:solidFill><a:srgbClr val="4F46E5"/></a:solidFill><a:latin typeface="${HURUF_JUDUL}"/></a:rPr><a:t>MEMO OPERASIONAL TIM</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>${totalMemo} memo tersimpan</a:t></a:r></a:p>
          ${judulMemoXml}
        </p:txBody>
      </p:sp>

      <!-- Card 6: KESIMPULAN / TINDAKAN -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="15" name="Card Kesimpulan"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${KONTEN_X + (cardW + gapX) * 2}" y="${y2}"/><a:ext cx="${cardW}" cy="${cardH}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="F0FDF4"/></a:solidFill>
          <a:ln w="38100"><a:solidFill><a:srgbClr val="16A34A"/></a:solidFill></a:ln>${BAYANGAN_PIKSEL}
        </p:spPr>
        <p:txBody>
          <a:bodyPr lIns="150000" tIns="150000" rIns="150000" bIns="150000"/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr sz="${sz(9)}"><a:solidFill><a:srgbClr val="166534"/></a:solidFill><a:latin typeface="${HURUF_JUDUL}"/></a:rPr><a:t>KESIMPULAN OPERASIONAL</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Rekomendasi tindakan pimpinan</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>${escXml(kesimpulan[0])}</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>${escXml(kesimpulan[1])}</a:t></a:r></a:p>
          <a:p><a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>${escXml(kesimpulan[2])}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>

    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

/**
 * Slide 3: Prakiraan Cuaca 3 Hari (BMKG)
 */
function buatSlideCuaca(data: MonkeyPointData): string {
  const desa = data.cuaca?.desa ?? 'data cuaca tidak tersedia';
  const slots: MonkeyPointCuacaSlot[] = data.cuaca?.slot?.length
    ? data.cuaca.slot.slice(0, 6)
    : [];

  const cols = [
    { w: 2200000, label: 'Waktu (WITA)' },
    { w: 2200000, label: 'Kondisi Cuaca' },
    { w: 1200000, label: 'Suhu' },
    { w: 1400000, label: 'Kelembapan' },
    { w: 1800000, label: 'Angin' },
    { w: 1792000, label: 'Rekomendasi Lapangan' },
  ];

  const barisXml = slots.length === 0
    ? barisKeterangan(cols.length, 'Data prakiraan BMKG tidak tersedia saat laporan dibuat.')
    : slots.map((s) => `
    <a:tr h="450000">
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}" b="1"/><a:t>${escXml(s.waktu)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}"/><a:t>${escXml(s.kondisi)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="${sz(10)}" b="1"/><a:t>${s.suhu}°C</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="${sz(10)}"/><a:t>${s.lembap}%</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${escXml(s.angin)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}" i="1"/><a:t>${escXml(s.rekomendasi ?? '—')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
    </a:tr>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      ${xmlJudulSlide('PRAKIRAAN CUACA BMKG 3 HARI KE DEPAN', `Prakiraan BMKG · ${desa}`)}

      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="21" name="Table Cuaca"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="${KONTEN_X}" y="${KONTEN_Y}"/><a:ext cx="${KONTEN_W}" cy="4600000"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tblPr firstRow="1" bandRow="1"/>
              <a:tblGrid>
                ${cols.map((c) => `<a:gridCol w="${c.w}"/>`).join('')}
              </a:tblGrid>
              <a:tr h="450000">
                ${cols.map((c) => `
                  <a:tc>
                    <a:txBody>
                      <a:bodyPr anchor="ctr"/>
                      <a:lstStyle/>
                      <a:p>
                        <a:pPr algn="${c.label === 'Suhu' || c.label === 'Kelembapan' ? 'ctr' : 'l'}"/>
                        <a:r>
                          <a:rPr sz="${sz(10)}" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="${HURUF_ISI}"/></a:rPr>
                          <a:t>${escXml(c.label)}</a:t>
                        </a:r>
                      </a:p>
                    </a:txBody>
                    <a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="0284C7"/></a:solidFill></a:tcPr>
                  </a:tc>
                `).join('')}
              </a:tr>
              ${barisXml}
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>

    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

/**
 * Slide 4: Histori & Deteksi Titik Api (NASA FIRMS)
 */
function buatSlideTitikApi(data: MonkeyPointData): string {
  const items: MonkeyPointTitikApiItem[] = data.titikApi?.daftar ?? [];
  const subjudulApi = !data.titikApi?.tersedia
    ? (data.titikApi?.alasan ?? 'Data titik api tidak tersedia saat laporan dibuat.')
    : `NASA FIRMS 7 hari, area tambang dan Rehab DAS · ${data.titikApi.total ?? items.length} titik${(data.titikApi.total ?? 0) > items.length ? `, tabel memuat ${items.length} terpenting` : ''}`;

  const cols = [
    { w: 1400000, label: 'Waktu Deteksi' },
    { w: 1800000, label: 'Koordinat (Lat, Lon)' },
    { w: 1300000, label: 'Satelit' },
    { w: 1200000, label: 'Tingkat' },
    { w: 2200000, label: 'Radius & Zona' },
    { w: 1400000, label: 'Status' },
    { w: 1292000, label: 'Keterangan' },
  ];

  const barisXml = items.length > 0
    ? items.map((t) => {
        const bg = t.status.includes('Padam') ? 'DCFCE7' : t.status.includes('Bukan') ? 'F1F5F9' : 'FEE2E2';
        const clr = t.status.includes('Padam') ? '166534' : t.status.includes('Bukan') ? '475569' : '991B1B';
        return `
          <a:tr h="450000">
            <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${escXml(t.waktu)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
            <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}" b="1"/><a:t>${t.lat.toFixed(4)}, ${t.lon.toFixed(4)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
            <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${escXml(t.satelit)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
            <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${escXml(t.confidence)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
            <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${escXml(t.zona)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
            <a:tc>
              <a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="${sz(9)}" b="1"><a:solidFill><a:srgbClr val="${clr}"/></a:solidFill></a:rPr><a:t>${escXml(t.status)}</a:t></a:r></a:p></a:txBody>
              <a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="${bg}"/></a:solidFill></a:tcPr>
            </a:tc>
            <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${escXml(t.catatan ?? '—')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
          </a:tr>
        `;
      }).join('')
    : `
      <a:tr h="800000">
        <a:tc gridSpan="7">
          <a:txBody>
            <a:bodyPr anchor="ctr"/>
            <a:lstStyle/>
            <a:p>
              <a:pPr algn="ctr"/>
              <a:r><a:rPr sz="${sz(12)}" b="1"><a:solidFill><a:srgbClr val="166534"/></a:solidFill></a:rPr><a:t>${data.titikApi?.tersedia ? 'TIDAK ADA TITIK API TERDETEKSI' : 'DATA TITIK API TIDAK TERSEDIA'}</a:t></a:r>
            </a:p>
            <a:p>
              <a:pPr algn="ctr"/>
              <a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="15803D"/></a:solidFill></a:rPr><a:t>${escXml(data.titikApi?.tersedia ? 'Tidak ada deteksi satelit NASA FIRMS di area tambang maupun Rehab DAS selama 7 hari terakhir.' : (data.titikApi?.alasan ?? 'Data titik api gagal dimuat saat laporan dibuat.'))}</a:t></a:r>
            </a:p>
          </a:txBody>
          <a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="F0FDF4"/></a:solidFill></a:tcPr>
        </a:tc><a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></a:txBody><a:tcPr/></a:tc><a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></a:txBody><a:tcPr/></a:tc><a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></a:txBody><a:tcPr/></a:tc><a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></a:txBody><a:tcPr/></a:tc><a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></a:txBody><a:tcPr/></a:tc><a:tc hMerge="1"><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr/></a:p></a:txBody><a:tcPr/></a:tc>
      </a:tr>
    `;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      ${xmlJudulSlide('MONITORING & HISTORI TITIK API (NASA FIRMS)', escXml(subjudulApi))}

      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="22" name="Table Api"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="${KONTEN_X}" y="${KONTEN_Y}"/><a:ext cx="${KONTEN_W}" cy="4600000"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tblPr firstRow="1" bandRow="1"/>
              <a:tblGrid>
                ${cols.map((c) => `<a:gridCol w="${c.w}"/>`).join('')}
              </a:tblGrid>
              <a:tr h="450000">
                ${cols.map((c) => `
                  <a:tc>
                    <a:txBody>
                      <a:bodyPr anchor="ctr"/>
                      <a:lstStyle/>
                      <a:p>
                        <a:pPr algn="ctr"/>
                        <a:r>
                          <a:rPr sz="${sz(10)}" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="${HURUF_ISI}"/></a:rPr>
                          <a:t>${escXml(c.label)}</a:t>
                        </a:r>
                      </a:p>
                    </a:txBody>
                    <a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="DC2626"/></a:solidFill></a:tcPr>
                  </a:tc>
                `).join('')}
              </a:tr>
              ${barisXml}
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>

    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

/**
 * Slide 5+: Tabel PICA Register Utuh (Dipaginasi per 5 item agar tampil LENGKAP tanpa terpotong)
 */
function buatSlidesPicaUtuh(data: MonkeyPointData): { xml: string; layoutTarget: string }[] {
  const picaSemua = data.pica;
  const ITEMS_PER_SLIDE = 5;

  if (picaSemua.length === 0) {
    // 1 slide kosong
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${xmlJudulSlide('REGISTER PICA LENGKAP', 'Tidak ada data PICA tercatat pada periode ini.')}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
    return [{ xml, layoutTarget: '../slideLayouts/slideLayout2.xml' }];
  }

  const totalSlides = Math.ceil(picaSemua.length / ITEMS_PER_SLIDE);
  const slides: { xml: string; layoutTarget: string }[] = [];

  const cols = [
    { w: 500000, label: 'No' },
    { w: 1000000, label: 'Bidang' },
    { w: 2600000, label: 'Masalah (Fakta Lapangan)' },
    { w: 1800000, label: 'Akar Masalah' },
    { w: 1800000, label: 'Tindakan Korektif' },
    { w: 1400000, label: 'Target & Realisasi' },
    { w: 800000, label: 'PIC' },
    { w: 792000, label: 'Due Date' },
    { w: 1300000, label: 'Status' },
  ];

  for (let page = 0; page < totalSlides; page++) {
    const chunk = picaSemua.slice(page * ITEMS_PER_SLIDE, (page + 1) * ITEMS_PER_SLIDE);

    const barisXml = chunk.map((p, idx) => {
      const isClosed = p.status === 'Closed';
      const sudahProg = p.status === 'In Progress' || p.status === 'Continue' || (p.realisasi !== null && p.realisasi > 0);
      const pct = p.target && p.realisasi !== null ? Math.round((p.realisasi / p.target) * 100) : null;
      const telat = !isClosed && !sudahProg && (p.sisa_hari ?? 1) < 0;
      const statusTeks = isClosed
        ? 'CLOSED'
        : sudahProg
        ? `PROGRES ${pct !== null ? `${pct}%` : ''}`
        : telat
        ? `TELAT (${Math.abs(p.sisa_hari!)} hr)`
        : 'OPEN';
      const statusBg = isClosed ? 'DCFCE7' : sudahProg ? 'E0F2FE' : telat ? 'FEE2E2' : 'FEF3C7';
      const statusColor = isClosed ? '166534' : sudahProg ? '0369A1' : telat ? '991B1B' : '92400E';

      const teksTarget = p.target !== null ? `${p.realisasi ?? 0}/${p.target} ${p.satuan ?? ''}` : '—';

      return `
        <a:tr h="550000">
          <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="${sz(9)}"/><a:t>${p.nomor || page * ITEMS_PER_SLIDE + idx + 1}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
          <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}" b="1"/><a:t>${escXml(p.bidang)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
          <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${escXml(p.judul)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
          <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${escXml(p.akar || '—')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
          <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${escXml(p.tindakan || '—')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
          <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(8)}"/><a:t>${escXml(teksTarget)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
          <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${escXml(p.pic_nama ?? '—')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
          <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(9)}"/><a:t>${p.due_date ? escXml(p.due_date) : '—'}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
          <a:tc>
            <a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="${sz(9)}" b="1"><a:solidFill><a:srgbClr val="${statusColor}"/></a:solidFill></a:rPr><a:t>${statusTeks}</a:t></a:r></a:p></a:txBody>
            <a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="${statusBg}"/></a:solidFill></a:tcPr>
          </a:tc>
        </a:tr>
      `;
    }).join('');

    const subjudul = `Daftar lengkap PICA Register (Halaman ${page + 1} dari ${totalSlides}) · Total ${picaSemua.length} tugas`;

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      ${xmlJudulSlide(`REGISTER PICA LENGKAP (${page + 1}/${totalSlides})`, subjudul)}

      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="${30 + page}" name="Table PICA Page ${page + 1}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="${KONTEN_X}" y="${KONTEN_Y}"/><a:ext cx="${KONTEN_W}" cy="4600000"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tblPr firstRow="1" bandRow="1"/>
              <a:tblGrid>
                ${cols.map((c) => `<a:gridCol w="${c.w}"/>`).join('')}
              </a:tblGrid>
              <a:tr h="450000">
                ${cols.map((c) => `
                  <a:tc>
                    <a:txBody>
                      <a:bodyPr anchor="ctr"/>
                      <a:lstStyle/>
                      <a:p>
                        <a:pPr algn="${c.label === 'No' || c.label === 'Status' ? 'ctr' : 'l'}"/>
                        <a:r>
                          <a:rPr sz="${sz(10)}" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="${HURUF_ISI}"/></a:rPr>
                          <a:t>${escXml(c.label)}</a:t>
                        </a:r>
                      </a:p>
                    </a:txBody>
                    <a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="166534"/></a:solidFill></a:tcPr>
                  </a:tc>
                `).join('')}
              </a:tr>
              ${barisXml}
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>

    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;

    slides.push({ xml, layoutTarget: '../slideLayouts/slideLayout2.xml' });
  }

  return slides;
}

/**
 * Slide: Agenda & Rapat Terjadwal (Kalender)
 */
function buatSlideJadwal(data: MonkeyPointData): string {
  const jadwal = data.jadwal ?? [];

  const cols = [
    { w: 1500000, label: 'Tanggal' },
    { w: 1800000, label: 'Waktu (WITA)' },
    { w: 3500000, label: 'Agenda / Rapat' },
    { w: 1600000, label: 'PIC' },
    { w: 2192000, label: 'Keterangan' },
  ];

  const barisXml = jadwal.length === 0
    ? barisKeterangan(cols.length, data.jadwal ? 'Tidak ada agenda mendatang.' : 'Data agenda tidak tersedia saat laporan dibuat.')
    : jadwal.map((j) => `
    <a:tr h="500000">
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}"/><a:t>${escXml(j.tanggal)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}" b="1"/><a:t>${escXml(j.jamMulai ? `${j.jamMulai}${j.jamSelesai ? ` - ${j.jamSelesai}` : ''}` : 'Seharian')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}" b="1"/><a:t>${escXml(j.judul)}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}"/><a:t>${escXml(j.pic ?? '—')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}"/><a:t>${escXml(j.lokasi ?? '—')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
    </a:tr>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      ${xmlJudulSlide('AGENDA & JADWAL RAPAT OPERASIONAL', 'Jadwal pertemuan koordinasi, briefing keselamatan, dan rapat evaluasi tim')}

      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="50" name="Table Agenda"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="${KONTEN_X}" y="${KONTEN_Y}"/><a:ext cx="${KONTEN_W}" cy="4600000"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tblPr firstRow="1" bandRow="1"/>
              <a:tblGrid>
                ${cols.map((c) => `<a:gridCol w="${c.w}"/>`).join('')}
              </a:tblGrid>
              <a:tr h="450000">
                ${cols.map((c) => `
                  <a:tc>
                    <a:txBody>
                      <a:bodyPr anchor="ctr"/>
                      <a:lstStyle/>
                      <a:p>
                        <a:pPr algn="l"/>
                        <a:r>
                          <a:rPr sz="${sz(10)}" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="${HURUF_ISI}"/></a:rPr>
                          <a:t>${escXml(c.label)}</a:t>
                        </a:r>
                      </a:p>
                    </a:txBody>
                    <a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="D97706"/></a:solidFill></a:tcPr>
                  </a:tc>
                `).join('')}
              </a:tr>
              ${barisXml}
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>

    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

/**
 * Slide: Memo Operasional yang Tersimpan
 */
function buatSlideMemo(data: MonkeyPointData): string {
  const memos = data.memo.slice(0, 5);

  const cols = [
    { w: 600000, label: 'No' },
    { w: 1400000, label: 'Kategori' },
    { w: 4592000, label: 'Judul & Arahan Operasional' },
    { w: 2200000, label: 'Dibuat Oleh' },
    { w: 1800000, label: 'Tanggal' },
  ];

  const barisXml = memos.map((m, idx) => `
    <a:tr h="550000">
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="${sz(10)}"/><a:t>${idx + 1}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}" b="1"/><a:t>${escXml(m.kategori ?? '—')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}" b="1"/><a:t>${escXml(m.judul)}</a:t></a:r></a:p>${m.ringkasan ? `<a:p><a:r><a:rPr sz="${sz(9)}" i="1"/><a:t>${escXml(m.ringkasan)}</a:t></a:r></a:p>` : ''}</a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}"/><a:t>${escXml(m.oleh_nama ?? '—')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
      <a:tc><a:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:r><a:rPr sz="${sz(10)}"/><a:t>${m.tanggal ? escXml(m.tanggal) : (m.dibuat_pada ? escXml(m.dibuat_pada.slice(0, 10)) : '—')}</a:t></a:r></a:p></a:txBody><a:tcPr anchor="ctr"/></a:tc>
    </a:tr>
  `).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      ${xmlJudulSlide('MEMO OPERASIONAL & KEBIJAKAN LAPANGAN', 'Instruksi kerja, catatan keselamatan K3L, dan arahan teknis tersimpan')}

      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="60" name="Table Memo"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="${KONTEN_X}" y="${KONTEN_Y}"/><a:ext cx="${KONTEN_W}" cy="4600000"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tblPr firstRow="1" bandRow="1"/>
              <a:tblGrid>
                ${cols.map((c) => `<a:gridCol w="${c.w}"/>`).join('')}
              </a:tblGrid>
              <a:tr h="450000">
                ${cols.map((c) => `
                  <a:tc>
                    <a:txBody>
                      <a:bodyPr anchor="ctr"/>
                      <a:lstStyle/>
                      <a:p>
                        <a:pPr algn="l"/>
                        <a:r>
                          <a:rPr sz="${sz(10)}" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="${HURUF_ISI}"/></a:rPr>
                          <a:t>${escXml(c.label)}</a:t>
                        </a:r>
                      </a:p>
                    </a:txBody>
                    <a:tcPr anchor="ctr"><a:solidFill><a:srgbClr val="4F46E5"/></a:solidFill></a:tcPr>
                  </a:tc>
                `).join('')}
              </a:tr>
              ${barisXml}
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>

    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

/**
 * Slide: Sanggahan / Disclaimer resmi Hasnur Group (Layout 4)
 */
function buatSlideDisclaimer(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>

      <p:sp>
        <p:nvSpPr><p:cNvPr id="100" name="Disclaimer Text"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1500000" y="2400000"/><a:ext cx="9192000" cy="2400000"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="id-ID" sz="${sz(14)}">
                <a:solidFill><a:srgbClr val="166534"/></a:solidFill>
                <a:latin typeface="${HURUF_JUDUL}"/>
              </a:rPr>
              <a:t>SANGGAHAN (DISCLAIMER)</a:t>
            </a:r>
          </a:p>
          <a:p><a:endParaRPr sz="${sz(14)}"/></a:p>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="id-ID" sz="${sz(11)}">
                <a:solidFill><a:srgbClr val="475569"/></a:solidFill>
              </a:rPr>
              <a:t>Dokumen presentasi ini disusun secara otomatis oleh sistem POKEMONKEY untuk kebutuhan internal operasional PT ENERGI BATUBARA LESTARI (HASNUR GROUP).</a:t>
            </a:r>
          </a:p>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="id-ID" sz="${sz(11)}">
                <a:solidFill><a:srgbClr val="64748B"/></a:solidFill>
              </a:rPr>
              <a:t>Dokumen ini tidak untuk didistribusikan ke luar HASNUR GROUP baik keseluruhan dokumen maupun sebagian dokumen tanpa persetujuan dari pihak HASNUR GROUP yang berwenang.</a:t>
            </a:r>
          </a:p>
          <a:p><a:endParaRPr sz="${sz(12)}"/></a:p>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="id-ID" sz="${sz(11)}" i="1">
                <a:solidFill><a:srgbClr val="94A3B8"/></a:solidFill>
              </a:rPr>
              <a:t>Segala bentuk pelanggaran dan penyalahgunaan dokumen ini akan ditindak sesuai dengan ketentuan hukum yang berlaku.</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>

    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

/**
 * Slide: Galeri Dokumentasi Foto Lapangan & PICA
 */
function buatSlideGaleri(data: MonkeyPointData, foto: (FotoSiap | null)[] = []): string {
  const cardW = 3300000;
  const cardH = 2100000;
  const gapX = 346000;
  const gapY = 200000;
  const y1 = KONTEN_Y + 100000;
  const y2 = y1 + cardH + gapY;

  const galeriItems = (data.galeri && data.galeri.length > 0)
    ? data.galeri.slice(0, 6)
    : [];

  const cardsXml = galeriItems.length > 0
    ? galeriItems.map((g, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const x = KONTEN_X + col * (cardW + gapX);
        const y = row === 0 ? y1 : y2;
        const f = foto[idx] ?? null;
        const pad = 110000;
        const kotakW = cardW - 2 * pad;
        const kotakH = Math.round(cardH * 0.56);
        const skala = f ? Math.min(kotakW / f.lebar, kotakH / f.tinggi) : 0;
        const fotoW = f ? Math.round(f.lebar * skala) : 0;
        const fotoH = f ? Math.round(f.tinggi * skala) : 0;
        const fotoXml = f ? `
          <p:pic>
            <p:nvPicPr><p:cNvPr id="${90 + idx}" name="Foto Galeri ${idx + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
            <p:blipFill><a:blip r:embed="${f.rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
            <p:spPr>
              <a:xfrm><a:off x="${x + pad + Math.round((kotakW - fotoW) / 2)}" y="${y + pad + Math.round((kotakH - fotoH) / 2)}"/><a:ext cx="${fotoW}" cy="${fotoH}"/></a:xfrm>
              <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
            </p:spPr>
          </p:pic>` : '';
        const insetAtas = f ? pad + kotakH + 60000 : 150000;
        const deskripsi = f && g.desc.length > 90 ? `${g.desc.slice(0, 89)}…` : g.desc;

        return `
          <p:sp>
            <p:nvSpPr><p:cNvPr id="${70 + idx}" name="Card Galeri ${idx + 1}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
            <p:spPr>
              <a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cardW}" cy="${cardH}"/></a:xfrm>
              <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
              <a:ln w="38100"><a:solidFill><a:srgbClr val="0D9488"/></a:solidFill></a:ln>${BAYANGAN_PIKSEL}
            </p:spPr>
            <p:txBody>
              <a:bodyPr lIns="150000" tIns="${insetAtas}" rIns="150000" bIns="120000"/>
              <a:lstStyle/>
              <a:p>
                <a:r><a:rPr sz="${sz(10)}" b="1"><a:solidFill><a:srgbClr val="0F766E"/></a:solidFill></a:rPr><a:t>[${escXml(g.tag)}] · ${escXml(g.tgl)}</a:t></a:r>
              </a:p>
              <a:p>
                <a:r><a:rPr sz="${sz(11)}" b="1"><a:solidFill><a:srgbClr val="0F172A"/></a:solidFill><a:latin typeface="${HURUF_ISI}"/></a:rPr><a:t>${escXml(g.judul)}</a:t></a:r>
              </a:p>
              <a:p>
                <a:r><a:rPr sz="${sz(10)}"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>${escXml(deskripsi)}</a:t></a:r>
              </a:p>
              <a:p>
                <a:r><a:rPr sz="${sz(9)}" i="1"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>PIC: ${escXml(g.pic)} · Dokumentasi Lapangan</a:t></a:r>
              </a:p>
            </p:txBody>
          </p:sp>${fotoXml}
        `;
      }).join('')
    : `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="71" name="Empty Galeri"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${KONTEN_X + 1500000}" y="${KONTEN_Y + 1000000}"/><a:ext cx="7592000" cy="2400000"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="F8FAFC"/></a:solidFill>
          <a:ln w="38100"><a:solidFill><a:srgbClr val="CBD5E1"/></a:solidFill></a:ln>${BAYANGAN_PIKSEL}
        </p:spPr>
        <p:txBody>
          <a:bodyPr anchor="ctr" lIns="300000" tIns="300000" rIns="300000" bIns="300000"/>
          <a:lstStyle/>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r><a:rPr sz="${sz(14)}" b="1"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>BELUM ADA FOTO DOKUMENTASI TERUNGGAH</a:t></a:r>
          </a:p>
          <a:p><a:endParaRPr sz="${sz(8)}"/></a:p>
          <a:p>
            <a:pPr algn="ctr"/>
            <a:r><a:rPr sz="${sz(11)}"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>Foto dokumentasi yang diunggah oleh pengawas melalui menu Laporan Lapangan atau Bukti PICA akan otomatis tersimpan di Cloudflare R2 dan ditampilkan di slide ini.</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    `;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      
      ${xmlJudulSlide('GALERI DOKUMENTASI FOTO LAPANGAN & PICA', 'Foto 30 hari terakhir dari laporan FEED dan lampiran bukti PICA')}

      ${cardsXml}

    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

// ---------------------------------------------------------------------------
// 4. Fungsi Utama Ekspor Monkey Point (.pptx)
// ---------------------------------------------------------------------------

export async function eksporMonkeyPoint(data: MonkeyPointData): Promise<'dibagikan' | 'diunduh'> {
  // 1. Ambil berkas template PPTX dari folder public
  let templateBuffer: ArrayBuffer;
  try {
    const res = await fetch('/template-ppt.pptx');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    templateBuffer = await res.arrayBuffer();
  } catch (e) {
    const res = await fetch('template-ppt.pptx');
    templateBuffer = await res.arrayBuffer();
  }

  // 2. Buka ZIP PPTX dengan JSZip
  const zip = await JSZip.loadAsync(templateBuffer);

  // 2a. Huruf tema template → huruf aplikasi; teks tanpa huruf eksplisit ikut Pixelify Sans.
  for (const nama of Object.keys(zip.files).filter((n) => /^ppt\/theme\/theme\d+\.xml$/.test(n))) {
    const xml = await zip.file(nama)!.async('text');
    zip.file(nama, xml.replace(/(<a:(?:major|minor)Font>\s*<a:latin typeface=")[^"]*"/g, `$1${HURUF_ISI}"`));
  }

  // 2b. Foto galeri: unduh dari server (butuh login), kecilkan, simpan di ppt/media.
  const fotoSiap: (FotoSiap | null)[] = await Promise.all((data.galeri ?? []).slice(0, 6).map(async (g, i) => {
    if (!g.foto) return null;
    try {
      const hasil = await siapkanFoto(await ambilBerkas(g.foto));
      if (!hasil) return null;
      const nama = `pokemonkey-galeri-${i + 1}.jpg`;
      zip.file(`ppt/media/${nama}`, hasil.bytes);
      return { rId: `rIdFoto${i + 1}`, nama, lebar: hasil.lebar, tinggi: hasil.tinggi };
    } catch {
      return null;
    }
  }));
  const relasiFoto = fotoSiap
    .filter((f): f is FotoSiap => f !== null)
    .map((f) => `<Relationship Id="${f.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${f.nama}"/>`)
    .join('');

  // 3. Susun daftar slide secara dinamis:
  // - Cover
  // - Executive Summary
  // - Prakiraan Cuaca 3 Hari (BMKG)
  // - Histori & Deteksi Titik Api (NASA FIRMS)
  // - PICA Register Utuh (Semua baris dipaginasi rapi per 5 item)
  // - Galeri Dokumentasi Foto Lapangan & PICA
  // - Agenda & Rapat Terjadwal
  // - Memo Operasional
  // - Sanggahan / Disclaimer
  const slides: { xml: string; layoutTarget: string; relasi?: string }[] = [
    { xml: buatSlideCover(data), layoutTarget: '../slideLayouts/slideLayout1.xml' },
    { xml: buatSlideRealisasiTahun(data), layoutTarget: '../slideLayouts/slideLayout2.xml' },
    { xml: buatSlideRealisasiRincian(data), layoutTarget: '../slideLayouts/slideLayout2.xml' },
    { xml: buatSlideSummary(data), layoutTarget: '../slideLayouts/slideLayout2.xml' },
    { xml: buatSlideCuaca(data), layoutTarget: '../slideLayouts/slideLayout2.xml' },
    { xml: buatSlideTitikApi(data), layoutTarget: '../slideLayouts/slideLayout2.xml' },
    ...buatSlidesPicaUtuh(data),
    { xml: buatSlideGaleri(data, fotoSiap), layoutTarget: '../slideLayouts/slideLayout2.xml', relasi: relasiFoto },
    { xml: buatSlideJadwal(data), layoutTarget: '../slideLayouts/slideLayout2.xml' },
    { xml: buatSlideMemo(data), layoutTarget: '../slideLayouts/slideLayout2.xml' },
    { xml: buatSlideDisclaimer(), layoutTarget: '../slideLayouts/slideLayout4.xml' },
  ];

  // 4. Masukkan tiap slide ke dalam ZIP
  slides.forEach((s, idx) => {
    const slideNum = idx + 1;
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;

    zip.file(slidePath, s.xml);

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="${s.layoutTarget}"/>${s.relasi ?? ''}
</Relationships>`;
    zip.file(relsPath, relsXml);
  });

  // 5. Perbarui [Content_Types].xml
  const contentTypesPath = '[Content_Types].xml';
  let contentTypesXml = await zip.file(contentTypesPath)!.async('text');
  contentTypesXml = contentTypesXml.replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, '');
  const slideOverrides = slides
    .map(
      (_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
    .join('');
  contentTypesXml = contentTypesXml.replace('</Types>', `${slideOverrides}</Types>`);
  if (!/<Default Extension="jpg"/i.test(contentTypesXml)) {
    contentTypesXml = contentTypesXml.replace('</Types>', '<Default Extension="jpg" ContentType="image/jpeg"/></Types>');
  }
  zip.file(contentTypesPath, contentTypesXml);

  // 6. Perbarui ppt/presentation.xml (Daftar Slide)
  const presPath = 'ppt/presentation.xml';
  let presXml = await zip.file(presPath)!.async('text');
  const sldIdEntries = slides
    .map((_, i) => `<p:sldId id="${270 + i}" r:id="rId${10 + i}"/>`)
    .join('');
  presXml = presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${sldIdEntries}</p:sldIdLst>`);
  zip.file(presPath, presXml);

  // 7. Perbarui ppt/_rels/presentation.xml.rels (Relasi Slide)
  const presRelsPath = 'ppt/_rels/presentation.xml.rels';
  let presRelsXml = await zip.file(presRelsPath)!.async('text');
  presRelsXml = presRelsXml.replace(/<Relationship [^>]*Target="slides\/slide\d+\.xml"[^>]*\/>/g, '');
  const slideRels = slides
    .map(
      (_, i) =>
        `<Relationship Id="rId${10 + i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    )
    .join('');
  presRelsXml = presRelsXml.replace('</Relationships>', `${slideRels}</Relationships>`);
  zip.file(presRelsPath, presRelsXml);

  // 8. Generate file PPTX (Blob)
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });

  // 9. Simpan / Bagikan berkas ke pengguna (Browser / Android)
  const periodeStr = data.periode?.id ?? (data.hariIni ?? W.hariIniWita()).slice(0, 7);
  const hariIniStr = data.hariIni ?? W.hariIniWita();
  const namaFile = `MONKEY-POINT-${periodeStr}-${hariIniStr}.pptx`;

  return simpanBerkas(blob, namaFile, 'Laporan Monkey Point POKEMONKEY');
}
