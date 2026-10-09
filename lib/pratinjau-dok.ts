/**
 * Membaca isi dokumen untuk dipratinjau di dalam aplikasi (tanpa mengunduh):
 * PDF (pdf.js, dimuat hanya saat dibutuhkan), Word .docx & PowerPoint .pptx
 * (XML di dalam zip), Excel .xlsx (exceljs), CSV, dan teks.
 */

export type JenisPratinjau = 'pdf' | 'gambar' | 'docx' | 'pptx' | 'xlsx' | 'csv' | 'teks' | 'lain';

export function jenisDari(nama: string, mime?: string | null): JenisPratinjau {
  const ext = (nama.split('.').pop() ?? '').toLowerCase();
  if (ext === 'pdf' || mime === 'application/pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext) || mime?.startsWith('image/')) return 'gambar';
  if (ext === 'docx') return 'docx';
  if (ext === 'pptx') return 'pptx';
  if (ext === 'xlsx' || ext === 'xlsm') return 'xlsx';
  if (ext === 'csv') return 'csv';
  if (['txt', 'md', 'json', 'log'].includes(ext) || mime?.startsWith('text/')) return 'teks';
  return 'lain';
}

// ---------- PDF ----------

export interface DokumenPdf { halaman: number; gambar: (no: number, lebar: number) => Promise<HTMLCanvasElement> }

export async function bukaPdf(blob: Blob): Promise<DokumenPdf> {
  const pdfjs = await import('pdfjs-dist');
  const pekerja = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = pekerja;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  return {
    halaman: doc.numPages,
    gambar: async (no, lebar) => {
      const hal = await doc.getPage(no);
      const v1 = hal.getViewport({ scale: 1 });
      const skala = (lebar * (window.devicePixelRatio || 1)) / v1.width;
      const vp = hal.getViewport({ scale: skala });
      const kanvas = document.createElement('canvas');
      kanvas.width = Math.floor(vp.width);
      kanvas.height = Math.floor(vp.height);
      kanvas.style.width = '100%';
      await hal.render({ canvasContext: kanvas.getContext('2d')!, viewport: vp }).promise;
      return kanvas;
    },
  };
}

// ---------- Word (.docx) ----------

export type BlokDok =
  | { t: 'p'; gaya: 'judul1' | 'judul2' | 'judul3' | 'biasa' | 'daftar'; runs: { v: string; b?: boolean; i?: boolean; u?: boolean }[] }
  | { t: 'tabel'; baris: string[][] };

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function paragrafDocx(p: Element): BlokDok {
  const gayaEl = p.getElementsByTagNameNS(W_NS, 'pStyle')[0];
  const gaya = (gayaEl?.getAttributeNS(W_NS, 'val') ?? gayaEl?.getAttribute('w:val') ?? '').toLowerCase();
  const daftar = p.getElementsByTagNameNS(W_NS, 'numPr').length > 0;
  const runs: { v: string; b?: boolean; i?: boolean; u?: boolean }[] = [];
  for (const r of Array.from(p.getElementsByTagNameNS(W_NS, 'r'))) {
    const v = Array.from(r.childNodes).map((n) => {
      const el = n as Element;
      if (el.localName === 't') return el.textContent ?? '';
      if (el.localName === 'tab') return '\t';
      if (el.localName === 'br') return '\n';
      return '';
    }).join('');
    if (!v) continue;
    const rPr = r.getElementsByTagNameNS(W_NS, 'rPr')[0];
    runs.push({ v, b: Boolean(rPr?.getElementsByTagNameNS(W_NS, 'b').length), i: Boolean(rPr?.getElementsByTagNameNS(W_NS, 'i').length), u: Boolean(rPr?.getElementsByTagNameNS(W_NS, 'u').length) });
  }
  return {
    t: 'p',
    gaya: /heading1|judul1|^title$/.test(gaya) ? 'judul1' : /heading2|judul2/.test(gaya) ? 'judul2' : /heading[3-9]|judul3/.test(gaya) ? 'judul3' : daftar ? 'daftar' : 'biasa',
    runs,
  };
}

export async function bacaDocx(blob: Blob): Promise<BlokDok[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('Isi dokumen Word tidak ditemukan.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = doc.getElementsByTagNameNS(W_NS, 'body')[0];
  const hasil: BlokDok[] = [];
  for (const el of Array.from(body?.children ?? [])) {
    if (el.localName === 'p') hasil.push(paragrafDocx(el));
    else if (el.localName === 'tbl') {
      const baris = Array.from(el.getElementsByTagNameNS(W_NS, 'tr')).map((tr) =>
        Array.from(tr.getElementsByTagNameNS(W_NS, 'tc')).map((tc) => Array.from(tc.getElementsByTagNameNS(W_NS, 't')).map((t) => t.textContent ?? '').join(' ')));
      hasil.push({ t: 'tabel', baris });
    }
  }
  return hasil;
}

// ---------- PowerPoint (.pptx): teks per slide ----------

export async function bacaPptx(blob: Blob): Promise<{ no: number; judul: string; teks: string[] }[]> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const nama = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const hasil: { no: number; judul: string; teks: string[] }[] = [];
  for (const n of nama) {
    const doc = new DOMParser().parseFromString(await zip.file(n)!.async('string'), 'application/xml');
    const paragraf = Array.from(doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 'p'))
      .map((p) => Array.from(p.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 't')).map((t) => t.textContent ?? '').join(''))
      .filter((t) => t.trim());
    hasil.push({ no: Number(n.match(/\d+/)![0]), judul: paragraf[0] ?? '', teks: paragraf.slice(1) });
  }
  return hasil;
}

// ---------- Excel / CSV ----------

export async function bacaXlsx(blob: Blob): Promise<{ nama: string; baris: string[][] }[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  return wb.worksheets.map((ws) => {
    const baris: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (baris.length >= 300) return;
      const sel: string[] = [];
      for (let c = 1; c <= Math.min(ws.columnCount, 40); c += 1) {
        const v = row.getCell(c).value as unknown;
        sel.push(v === null || v === undefined ? '' : typeof v === 'object'
          ? String((v as { result?: unknown; text?: unknown; richText?: { text: string }[] }).result
            ?? (v as { text?: unknown }).text
            ?? (v as { richText?: { text: string }[] }).richText?.map((r) => r.text).join('')
            ?? (v instanceof Date ? v.toLocaleDateString('id-ID') : ''))
          : String(v));
      }
      baris.push(sel);
    });
    return { nama: ws.name, baris };
  });
}

export function bacaCsv(teks: string): string[][] {
  const pemisah = (teks.split('\n')[0].match(/;/g)?.length ?? 0) > (teks.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const hasil: string[][] = [];
  let baris: string[] = [];
  let sel = '';
  let kutip = false;
  for (let i = 0; i < teks.length && hasil.length < 1000; i += 1) {
    const c = teks[i];
    if (kutip) {
      if (c === '"' && teks[i + 1] === '"') { sel += '"'; i += 1; } else if (c === '"') kutip = false; else sel += c;
    } else if (c === '"') kutip = true;
    else if (c === pemisah) { baris.push(sel); sel = ''; }
    else if (c === '\n') { baris.push(sel.replace(/\r$/, '')); hasil.push(baris); baris = []; sel = ''; }
    else sel += c;
  }
  if (sel || baris.length) { baris.push(sel); hasil.push(baris); }
  return hasil;
}
