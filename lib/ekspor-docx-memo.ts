/**
 * Ekspor halaman memo ke Microsoft Word (.docx) — dibuat langsung di HP/peramban
 * (WordprocessingML di dalam zip), tanpa server dan tanpa layanan luar.
 *
 * Yang ikut: judul halaman, judul 1–4, paragraf (tebal/miring/garis bawah/coret,
 * warna sorot), daftar berpoin & bernomor, ceklis (☐/☑), kutipan, callout,
 * toggle (beserta isinya), divider, kode, rumus (teks), tabel (dengan baris
 * hitung), gambar (disematkan), berkas & tautan (sebagai teks), formulir (judul).
 */

import { ambilBerkas } from './api';
import { simpanBerkas } from './unduh';
import { uraiBlok, uraiInline, type Inline } from '../server/src/memo-blok';
import { hitungKolom, LABEL_HITUNG } from './rumus-tabel';
import type { AnggotaRingkas } from './tipe-api';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Run { v: string; b?: boolean; i?: boolean; u?: boolean; s?: boolean; kode?: boolean; sorot?: boolean; warna?: string }

const WARNA_HEX: Record<string, string> = {
  merah: 'DC2626', oranye: 'EA580C', kuning: 'CA8A04', hijau: '16A34A', biru: '2563EB', ungu: '9333EA', pink: 'DB2777', abu: '71717A',
};

function runsDari(teks: string, tim: AnggotaRingkas[], gaya: Omit<Run, 'v'> = {}): Run[] {
  const hasil: Run[] = [];
  for (const x of uraiInline(teks) as Inline[]) {
    switch (x.t) {
      case 'teks': hasil.push({ ...gaya, v: x.v }); break;
      case 'tebal': hasil.push({ ...gaya, v: x.v, b: true }); break;
      case 'miring': hasil.push({ ...gaya, v: x.v, i: true }); break;
      case 'coret': hasil.push({ ...gaya, v: x.v, s: true }); break;
      case 'garisbawah': hasil.push({ ...gaya, v: x.v, u: true }); break;
      case 'kode': hasil.push({ ...gaya, v: x.v, kode: true }); break;
      case 'tautan': hasil.push({ ...gaya, v: `${x.v} (${x.url})`, u: true }); break;
      case 'berkas': hasil.push({ ...gaya, v: `📎 ${x.v}` }); break;
      case 'tenggat': hasil.push({ ...gaya, v: `📅 ${x.tanggal.split('-').reverse().join('/')}${x.jam ? ` ${x.jam}` : ''}`, b: true }); break;
      case 'orang': hasil.push({ ...gaya, v: `@${tim.find((t) => t.id === x.id)?.nama ?? x.id}`, b: true }); break;
      case 'pica': hasil.push({ ...gaya, v: x.id, b: true }); break;
      case 'halaman': hasil.push({ ...gaya, v: x.v || 'Halaman', u: true }); break;
      case 'rumus': hasil.push({ ...gaya, v: x.v, i: true }); break;
      case 'baris': hasil.push({ ...gaya, v: '\n' }); break;
      case 'warna': {
        const v = x.isi.map((y) => ('v' in y ? String(y.v) : y.t === 'tenggat' ? y.tanggal : '')).join('');
        hasil.push({ ...gaya, v, ...(x.jenis === 'l' ? { sorot: true } : { warna: WARNA_HEX[x.warna] }) });
        break;
      }
    }
  }
  return hasil;
}

function runXml(r: Run): string {
  const pr = [
    r.b ? '<w:b/>' : '', r.i ? '<w:i/>' : '', r.u ? '<w:u w:val="single"/>' : '', r.s ? '<w:strike/>' : '',
    r.kode ? '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:shd w:val="clear" w:color="auto" w:fill="F4F4F5"/>' : '',
    r.sorot ? '<w:highlight w:val="yellow"/>' : '', r.warna ? `<w:color w:val="${r.warna}"/>` : '',
  ].join('');
  return r.v.split('\n').map((bagian, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(bagian)}</w:t></w:r>`).join('');
}

const para = (isi: string, opsi: { gaya?: string; kiri?: number; shd?: string; garisKiri?: string; garisBawah?: boolean; rata?: string; spasiSetelah?: number } = {}) => {
  const pPr = [
    opsi.gaya ? `<w:pStyle w:val="${opsi.gaya}"/>` : '',
    opsi.garisKiri || opsi.garisBawah ? `<w:pBdr>${opsi.garisKiri ? `<w:left w:val="single" w:sz="18" w:space="8" w:color="${opsi.garisKiri}"/>` : ''}${opsi.garisBawah ? '<w:bottom w:val="single" w:sz="6" w:space="1" w:color="A1A1AA"/>' : ''}</w:pBdr>` : '',
    opsi.shd ? `<w:shd w:val="clear" w:color="auto" w:fill="${opsi.shd}"/>` : '',
    opsi.spasiSetelah !== undefined ? `<w:spacing w:after="${opsi.spasiSetelah}"/>` : '',
    opsi.kiri ? `<w:ind w:left="${opsi.kiri}"/>` : '',
    opsi.rata ? `<w:jc w:val="${opsi.rata}"/>` : '',
  ].join('');
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ''}${isi}</w:p>`;
};

interface Gambar { rid: string; nama: string; data: Uint8Array; lebar: number; tinggi: number }

/** Gambar memo → PNG (format paling aman di Word), lebar maksimal 1200 px. */
async function gambarPng(kunci: string): Promise<{ data: Uint8Array; lebar: number; tinggi: number } | null> {
  try {
    const blob = await ambilBerkas(kunci);
    const bmp = await createImageBitmap(blob);
    const skala = Math.min(1, 1200 / bmp.width);
    const k = document.createElement('canvas');
    k.width = Math.round(bmp.width * skala);
    k.height = Math.round(bmp.height * skala);
    k.getContext('2d')!.drawImage(bmp, 0, 0, k.width, k.height);
    const png = await new Promise<Blob | null>((ok) => k.toBlob(ok, 'image/png'));
    if (!png) return null;
    return { data: new Uint8Array(await png.arrayBuffer()), lebar: k.width, tinggi: k.height };
  } catch { return null; }
}

function gambarXml(g: Gambar, no: number, persen = 100): string {
  const maksEmu = 5_760_000 * (persen / 100); // ±16 cm lebar isi halaman A4
  const lebar = Math.min(maksEmu, g.lebar * 9525);
  const tinggi = Math.round(lebar * (g.tinggi / g.lebar));
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${Math.round(lebar)}" cy="${tinggi}"/><wp:docPr id="${no}" name="Gambar ${no}"/>`
    + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${no}" name="${esc(g.nama)}"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${g.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${Math.round(lebar)}" cy="${tinggi}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>`
    + '</a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
}

function tabelXml(baris: string[][], kepala: boolean, hitung?: (string | null)[] | undefined, kolom?: ({ t: string } | null)[]): string {
  const lebar = baris[0]?.length ?? 1;
  const w = Math.floor(9000 / lebar);
  const sel = (teks: string, judul: boolean) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${judul ? '<w:shd w:val="clear" w:color="auto" w:fill="E4E4E7"/>' : ''}</w:tcPr>${para(runXml({ v: teks, b: judul }), { spasiSetelah: 0 })}</w:tc>`;
  const rows = baris.map((r, i) => `<w:tr>${r.map((c) => sel(c, kepala && i === 0)).join('')}</w:tr>`);
  if (hitung?.some(Boolean)) {
    const data = baris.slice(kepala ? 1 : 0);
    rows.push(`<w:tr>${baris[0].map((_, j) => {
      const f = hitung[j] as Parameters<typeof hitungKolom>[1] | null;
      return sel(f ? `${LABEL_HITUNG[f]}: ${hitungKolom(data.map((r) => r[j] ?? ''), f, kolom?.[j]?.t as Parameters<typeof hitungKolom>[2])}` : '', true);
    }).join('')}</w:tr>`);
  }
  const garis = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="6" w:space="0" w:color="A1A1AA"/>`).join('') + '</w:tblBorders>';
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${garis}<w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${baris[0].map(() => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.join('')}</w:tbl>${para('', { spasiSetelah: 0 })}`;
}

const GAYA_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="id-ID"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="44"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1F3864"/><w:sz w:val="34"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="2F5496"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:b/><w:i/></w:rPr></w:style>
</w:styles>`;

/** Susun dokumen .docx dari isi memo. */
export async function buatDocxMemo(m: { judul: string; isi: string; penulis?: string | null }, tim: AnggotaRingkas[]): Promise<Blob> {
  const JSZip = (await import('jszip')).default;
  const blok = uraiBlok(m.isi);
  const gambar: Gambar[] = [];
  const isi: string[] = [];
  isi.push(para(runXml({ v: m.judul.trim() || 'Tanpa judul' }), { gaya: 'Title' }));
  if (m.penulis) isi.push(para(runXml({ v: `Penulis: ${m.penulis} · Diekspor dari POKEMONKEY ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, i: true, warna: '71717A' })));

  for (const b of blok) {
    const kiri = b.kedalaman * 360;
    switch (b.jenis) {
      case 'judul': isi.push(para(runsDari(b.teks, tim).map(runXml).join(''), { gaya: `Heading${b.tingkat}`, kiri })); break;
      case 'teks': isi.push(para(runsDari(b.teks, tim).map(runXml).join(''), { kiri })); break;
      case 'butir': isi.push(para(runXml({ v: '•\t' }) + runsDari(b.teks, tim).map(runXml).join(''), { kiri: kiri + 360, spasiSetelah: 40 })); break;
      case 'nomor': isi.push(para(runXml({ v: `${b.no}.\t` }) + runsDari(b.teks, tim).map(runXml).join(''), { kiri: kiri + 360, spasiSetelah: 40 })); break;
      case 'ceklis': isi.push(para(runXml({ v: `${b.selesai ? '☑' : '☐'} ` }) + runsDari(b.teks, tim, b.selesai ? { s: true } : {}).map(runXml).join(''), { kiri: kiri + 360, spasiSetelah: 40 })); break;
      case 'toggle': isi.push(para(runXml({ v: '▸ ', b: true }) + runsDari(b.teks, tim, { b: true }).map(runXml).join(''), { kiri })); break;
      case 'kutipan': isi.push(para(runsDari(b.teks, tim, { i: true }).map(runXml).join(''), { kiri: kiri + 240, garisKiri: '65A30D' })); break;
      case 'penting': isi.push(para(runXml({ v: 'ℹ ' }) + runsDari(b.teks, tim).map(runXml).join(''), { kiri, shd: 'FEF3C7', garisKiri: 'F59E0B' })); break;
      case 'garis': isi.push(para('', { garisBawah: true })); break;
      case 'kode': isi.push(...b.isi.split('\n').map((baris) => para(runXml({ v: baris || ' ', kode: true }), { shd: 'F4F4F5', spasiSetelah: 0, kiri }))); isi.push(para('')); break;
      case 'rumus': isi.push(para(runXml({ v: b.isi, i: true }), { rata: 'center' })); break;
      case 'tabel': isi.push(tabelXml(b.baris, b.kepala, b.hitung, b.kolom)); break;
      case 'gambar': {
        const g = await gambarPng(b.kunci);
        if (g) {
          const satu: Gambar = { rid: `rIdGbr${gambar.length + 1}`, nama: b.nama || `gambar${gambar.length + 1}`, ...g };
          gambar.push(satu);
          isi.push(para(gambarXml(satu, gambar.length, b.lebar ?? 100), { rata: b.rata === 'tengah' ? 'center' : b.rata === 'kanan' ? 'right' : undefined }));
          if (b.nama && b.nama !== 'foto') isi.push(para(runXml({ v: b.nama, i: true, warna: '71717A' }), { rata: 'center' }));
        } else isi.push(para(runXml({ v: `[Gambar: ${b.nama}]`, i: true })));
        break;
      }
      case 'berkas': isi.push(para(runXml({ v: `📎 ${b.nama}` }))); break;
      case 'video': isi.push(para(runXml({ v: `▶ ${b.judul || 'Video'} — ${b.url}`, u: true }))); break;
      case 'penanda': isi.push(para(runXml({ v: `🔗 ${b.judul || b.url} — ${b.url}`, u: true }))); break;
      case 'formulir': isi.push(para(runXml({ v: `📋 Formulir: ${b.judul || 'Formulir'} (diisi di aplikasi POKEMONKEY)`, i: true }), { shd: 'E0F2FE' })); break;
      case 'grafik': isi.push(para(runXml({ v: '[Grafik realisasi reklamasi — lihat di aplikasi]', i: true }))); break;
      case 'data': isi.push(para(runXml({ v: `[Data lapangan ${b.sumber} — lihat di aplikasi]`, i: true }))); break;
      case 'kosong': isi.push(para('')); break;
      default: break;
    }
  }

  const dokumen = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>${isi.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(m.judul || 'Memo')}</dc:title><dc:creator>${esc(m.penulis ?? 'POKEMONKEY')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0, 19)}Z</dcterms:created></cp:coreProperties>`);
  zip.file('word/document.xml', dokumen);
  zip.file('word/styles.xml', GAYA_XML);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdGaya" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${gambar.map((g, i) => `<Relationship Id="${g.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/gambar${i + 1}.png"/>`).join('')}</Relationships>`);
  gambar.forEach((g, i) => zip.file(`word/media/gambar${i + 1}.png`, g.data));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

/** Ekspor lalu simpan/bagikan (APK: folder POKEMONKEY + lembar bagikan). */
export async function eksporDocxMemo(m: { judul: string; isi: string; penulis?: string | null }, tim: AnggotaRingkas[]): Promise<'dibagikan' | 'diunduh'> {
  const blob = await buatDocxMemo(m, tim);
  const nama = `${(m.judul.trim() || 'Memo').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 80)}.docx`;
  return simpanBerkas(blob, nama, 'Ekspor memo ke Word');
}
