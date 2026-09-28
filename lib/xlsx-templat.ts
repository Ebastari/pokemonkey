/**
 * Isi template Excel resmi (public/template-*.xlsx) tanpa merusak tampilannya.
 *
 * exceljs membuang bentuk/gambar di drawing saat menyimpan ulang, jadi di sini
 * berkas diolah langsung sebagai XML (JSZip + DOMParser): logo, garis, sel
 * gabungan, lebar kolom, dan gaya sel tetap persis seperti template.
 *
 * Teks ditulis sebagai inline string (sharedStrings tidak disentuh). Menyisip
 * atau menghapus baris ikut menggeser nomor baris, rumus, sel gabungan, print
 * area, dan jangkar gambar. Excel diminta menghitung ulang rumus saat dibuka
 * (template disiapkan dengan fullCalcOnLoad dan tanpa calcChain).
 *
 * Template harus satu lembar (lihat skrip penyiapan di riwayat commit).
 */

import JSZip from 'jszip';
import { simpanBerkas } from './unduh';

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_XDR = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type Peta = (baris: number, akhir: boolean) => number;

const angkaKolom = (k: string) => [...k].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
const pisahRef = (ref: string) => {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref);
  if (!m) throw new Error(`Alamat sel tidak sah: ${ref}`);
  return { kol: m[1], baris: Number(m[2]) };
};

/** Geser nomor baris di teks rumus/alamat; isi di dalam tanda kutip dibiarkan. */
function geserTeks(teks: string, peta: Peta): string {
  return teks.split(/("[^"]*")/).map((bagian) => {
    if (bagian.startsWith('"')) return bagian;
    return bagian.replace(/(\$?[A-Z]{1,3}\$?)(\d+)(?::(\$?[A-Z]{1,3}\$?)(\d+))?(?![\d(])/g, (_m, k1, b1, k2, b2) => {
      const awal = `${k1}${peta(Number(b1), false)}`;
      return k2 ? `${awal}:${k2}${peta(Number(b2), true)}` : awal;
    });
  }).join('');
}

/** Tanggal "YYYY-MM-DD" → nomor seri tanggal Excel. */
export function seriTanggal(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86_400_000;
}

export class TemplatXlsx {
  private constructor(
    private zip: JSZip,
    private jalurLembar: string,
    private lembar: Document,
    private buku: Document,
    private jalurGambar: string | null,
    private gambar: Document | null,
  ) {}

  static async buka(url: string): Promise<TemplatXlsx> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Template ${url} tidak ditemukan (${res.status}).`);
    const zip = await JSZip.loadAsync(await res.arrayBuffer());
    const baca = async (p: string) => new DOMParser().parseFromString(await zip.file(p)!.async('text'), 'application/xml');
    const relBuku = await zip.file('xl/_rels/workbook.xml.rels')!.async('text');
    const tgt = /Type="[^"]*\/worksheet" Target="([^"]+)"/.exec(relBuku)?.[1];
    if (!tgt) throw new Error('Template tidak berisi lembar kerja.');
    const jalurLembar = `xl/${tgt.replace(/^\//, '').replace(/^xl\//, '')}`;
    const relLembar = zip.file(jalurLembar.replace('worksheets/', 'worksheets/_rels/') + '.rels');
    const tgtGambar = relLembar ? /Type="[^"]*\/drawing" Target="\.\.\/drawings\/([^"]+)"/.exec(await relLembar.async('text'))?.[1] : undefined;
    const jalurGambar = tgtGambar ? `xl/drawings/${tgtGambar}` : null;
    return new TemplatXlsx(zip, jalurLembar, await baca(jalurLembar), await baca('xl/workbook.xml'), jalurGambar, jalurGambar ? await baca(jalurGambar) : null);
  }

  private get dataLembar(): Element {
    return this.lembar.getElementsByTagNameNS(NS, 'sheetData')[0];
  }

  private baris(nomor: number, buat = true): Element | null {
    const data = this.dataLembar;
    const semua = Array.from(data.getElementsByTagNameNS(NS, 'row'));
    const ada = semua.find((r) => Number(r.getAttribute('r')) === nomor);
    if (ada || !buat) return ada ?? null;
    const baru = this.lembar.createElementNS(NS, 'row');
    baru.setAttribute('r', String(nomor));
    data.insertBefore(baru, semua.find((r) => Number(r.getAttribute('r')) > nomor) ?? null);
    return baru;
  }

  private sel(ref: string): Element {
    const { kol, baris } = pisahRef(ref);
    const row = this.baris(baris)!;
    const semua = Array.from(row.getElementsByTagNameNS(NS, 'c'));
    const ada = semua.find((c) => c.getAttribute('r') === `${kol}${baris}`);
    if (ada) return ada;
    const baru = this.lembar.createElementNS(NS, 'c');
    baru.setAttribute('r', `${kol}${baris}`);
    // Gaya mengikuti sel di kirinya bila ada (baris hasil sisipan).
    row.insertBefore(baru, semua.find((c) => angkaKolom(pisahRef(c.getAttribute('r')!).kol) > angkaKolom(kol)) ?? null);
    return baru;
  }

  private kosongkan(c: Element) {
    while (c.firstChild) c.removeChild(c.firstChild);
    c.removeAttribute('t');
  }

  /** Tulis teks, angka, atau kosongkan sel. Gaya sel dari template dipertahankan. */
  isi(ref: string, nilai: string | number | null | undefined): this {
    const c = this.sel(ref);
    this.kosongkan(c);
    if (nilai === null || nilai === undefined || nilai === '') return this;
    if (typeof nilai === 'number') {
      const v = this.lembar.createElementNS(NS, 'v');
      v.textContent = String(nilai);
      c.appendChild(v);
      return this;
    }
    c.setAttribute('t', 'inlineStr');
    const is = this.lembar.createElementNS(NS, 'is');
    const t = this.lembar.createElementNS(NS, 't');
    t.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve');
    t.textContent = nilai;
    is.appendChild(t);
    c.appendChild(is);
    return this;
  }

  /** Tulis rumus (tanpa "="); `hasil` = nilai sementara sebelum Excel menghitung ulang. */
  rumus(ref: string, f: string, hasil?: number): this {
    const c = this.sel(ref);
    this.kosongkan(c);
    const el = this.lembar.createElementNS(NS, 'f');
    el.textContent = f;
    c.appendChild(el);
    if (hasil !== undefined) {
      const v = this.lembar.createElementNS(NS, 'v');
      v.textContent = String(hasil);
      c.appendChild(v);
    }
    return this;
  }

  /** Kosongkan sel sekaligus buang gayanya (warna, garis) — untuk blok template yang tidak dipakai. */
  bersihkan(ref: string): this {
    const c = this.sel(ref);
    this.kosongkan(c);
    c.removeAttribute('s');
    return this;
  }

  /** Pakai gaya (garis, huruf, format) sel `dari` untuk sel `ke`; isi sel tujuan tidak berubah. */
  salinGaya(dari: string, ke: string): this {
    const s = this.sel(dari).getAttribute('s');
    const c = this.sel(ke);
    if (s) c.setAttribute('s', s);
    else c.removeAttribute('s');
    return this;
  }

  /** Hapus gabungan sel (mergeCell) dengan alamat ref tertentu. */
  hapusGabungan(ref: string): this {
    const gabungan = this.lembar.getElementsByTagNameNS(NS, 'mergeCells')[0];
    if (!gabungan) return this;
    for (const m of Array.from(gabungan.getElementsByTagNameNS(NS, 'mergeCell'))) {
      if (m.getAttribute('ref') === ref) { gabungan.removeChild(m); break; }
    }
    gabungan.setAttribute('count', String(gabungan.getElementsByTagNameNS(NS, 'mergeCell').length));
    return this;
  }

  /** Tambahkan gabungan sel (mergeCell) baru. */
  gabungSel(ref: string): this {
    let gabungan = this.lembar.getElementsByTagNameNS(NS, 'mergeCells')[0];
    if (!gabungan) {
      gabungan = this.lembar.createElementNS(NS, 'mergeCells');
      this.lembar.documentElement.appendChild(gabungan);
    }
    const m = this.lembar.createElementNS(NS, 'mergeCell');
    m.setAttribute('ref', ref);
    gabungan.appendChild(m);
    gabungan.setAttribute('count', String(gabungan.getElementsByTagNameNS(NS, 'mergeCell').length));
    return this;
  }

  /** Atur tinggi baris (poin). */
  tinggi(nomor: number, pt: number): this {
    const r = this.baris(nomor)!;
    r.setAttribute('ht', String(Math.round(pt * 100) / 100));
    r.setAttribute('customHeight', '1');
    return this;
  }

  tinggiSekarang(nomor: number): number {
    return Number(this.baris(nomor, false)?.getAttribute('ht')) || 13.2;
  }

  /** Geser semua nomor baris lembar, rumus, gabungan, print area, dan jangkar gambar. */
  private geser(peta: Peta, buangBaris?: (r: number) => boolean) {
    const L = this.lembar;
    for (const row of Array.from(this.dataLembar.getElementsByTagNameNS(NS, 'row'))) {
      const r = Number(row.getAttribute('r'));
      if (buangBaris?.(r)) { row.parentNode!.removeChild(row); continue; }
      const baru = peta(r, false);
      row.setAttribute('r', String(baru));
      for (const c of Array.from(row.getElementsByTagNameNS(NS, 'c'))) {
        c.setAttribute('r', `${pisahRef(c.getAttribute('r')!).kol}${baru}`);
      }
    }
    for (const f of Array.from(L.getElementsByTagNameNS(NS, 'f'))) {
      if (f.textContent) f.textContent = geserTeks(f.textContent, peta);
      const ref = f.getAttribute('ref');
      if (ref) f.setAttribute('ref', geserTeks(ref, peta));
    }
    const gabungan = L.getElementsByTagNameNS(NS, 'mergeCells')[0];
    if (gabungan) {
      for (const m of Array.from(gabungan.getElementsByTagNameNS(NS, 'mergeCell'))) {
        const [a, b] = m.getAttribute('ref')!.split(':');
        const ra = pisahRef(a).baris;
        const rb = pisahRef(b ?? a).baris;
        if (buangBaris && buangBaris(ra) && buangBaris(rb)) { gabungan.removeChild(m); continue; }
        m.setAttribute('ref', geserTeks(m.getAttribute('ref')!, peta));
      }
      gabungan.setAttribute('count', String(gabungan.getElementsByTagNameNS(NS, 'mergeCell').length));
    }
    for (const [tag, attr] of [['dimension', 'ref'], ['conditionalFormatting', 'sqref'], ['dataValidation', 'sqref'], ['hyperlink', 'ref']] as const) {
      for (const el of Array.from(L.getElementsByTagNameNS(NS, tag))) {
        const v = el.getAttribute(attr);
        if (v) el.setAttribute(attr, v.split(' ').map((x) => geserTeks(x, peta)).join(' '));
      }
    }
    for (const brk of Array.from(L.getElementsByTagNameNS(NS, 'brk'))) {
      const id = Number(brk.getAttribute('id'));
      if (id) brk.setAttribute('id', String(peta(id, false)));
    }
    for (const dn of Array.from(this.buku.getElementsByTagNameNS(NS, 'definedName'))) {
      if (dn.textContent) dn.textContent = geserTeks(dn.textContent, peta);
    }
    if (this.gambar) {
      for (const tag of ['from', 'to']) {
        for (const titik of Array.from(this.gambar.getElementsByTagNameNS(NS_XDR, tag))) {
          const r = titik.getElementsByTagNameNS(NS_XDR, 'row')[0];
          if (r?.textContent) r.textContent = String(peta(Number(r.textContent) + 1, tag === 'to') - 1);
        }
      }
    }
  }

  /**
   * Sisipkan `n` baris sebelum baris `pos`, meniru baris `contoh` (gaya, tinggi,
   * dan gabungan sel satu baris). Rentang rumus yang melewati `pos` ikut melebar.
   */
  sisipBaris(pos: number, n: number, contoh: number): this {
    if (n <= 0) return this;
    const acuan = this.baris(contoh, false);
    const gabunganContoh = Array.from(this.lembar.getElementsByTagNameNS(NS, 'mergeCell'))
      .map((m) => m.getAttribute('ref')!)
      .filter((ref) => { const [a, b] = ref.split(':'); return pisahRef(a).baris === contoh && pisahRef(b ?? a).baris === contoh; });
    this.geser((r) => (r >= pos ? r + n : r));
    const berikut = this.baris(pos + n, false);
    for (let i = 0; i < n; i++) {
      const nomor = pos + i;
      const row = acuan ? (acuan.cloneNode(true) as Element) : this.lembar.createElementNS(NS, 'row');
      row.setAttribute('r', String(nomor));
      for (const c of Array.from(row.getElementsByTagNameNS(NS, 'c'))) {
        c.setAttribute('r', `${pisahRef(c.getAttribute('r')!).kol}${nomor}`);
        this.kosongkan(c);
      }
      this.dataLembar.insertBefore(row, berikut);
      const gabungan = this.lembar.getElementsByTagNameNS(NS, 'mergeCells')[0];
      for (const ref of gabunganContoh) {
        const m = this.lembar.createElementNS(NS, 'mergeCell');
        m.setAttribute('ref', ref.replace(/\d+/g, String(nomor)));
        gabungan.appendChild(m);
      }
      if (gabungan) gabungan.setAttribute('count', String(gabungan.getElementsByTagNameNS(NS, 'mergeCell').length));
    }
    return this;
  }

  /** Hapus `n` baris mulai `pos`; baris di bawahnya naik, rentang rumus menyusut. */
  hapusBaris(pos: number, n: number): this {
    if (n <= 0) return this;
    const akhir = pos + n;
    this.geser(
      (r, ujung) => (r < pos ? r : r >= akhir ? r - n : ujung ? pos - 1 : pos),
      (r) => r >= pos && r < akhir,
    );
    return this;
  }

  /** Sesuaikan jumlah baris isian: template punya `slot` baris mulai `awal`. */
  aturJumlahBaris(awal: number, slot: number, jumlah: number): this {
    const perlu = Math.max(1, jumlah);
    if (perlu > slot) this.sisipBaris(awal + slot - 1, perlu - slot, awal + (slot > 1 ? slot - 2 : 0));
    else if (perlu < slot) this.hapusBaris(awal + (slot > 1 ? 1 : 0), slot - perlu);
    return this;
  }

  async simpan(nama: string, judul: string): Promise<'dibagikan' | 'diunduh'> {
    const tulis = (d: Document) => new XMLSerializer().serializeToString(d);
    this.zip.file(this.jalurLembar, tulis(this.lembar));
    this.zip.file('xl/workbook.xml', tulis(this.buku));
    if (this.jalurGambar && this.gambar) this.zip.file(this.jalurGambar, tulis(this.gambar));
    const blob = await this.zip.generateAsync({ type: 'blob', mimeType: MIME, compression: 'DEFLATE' });
    return simpanBerkas(blob, nama, judul);
  }
}

// ------------------------------------------------------------------ terbilang

const SATUAN = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

function eja(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${SATUAN[n - 10]} Belas`;
  if (n < 100) return `${SATUAN[Math.floor(n / 10)]} Puluh ${eja(n % 10)}`;
  if (n < 200) return `Seratus ${eja(n - 100)}`;
  if (n < 1000) return `${SATUAN[Math.floor(n / 100)]} Ratus ${eja(n % 100)}`;
  if (n < 2000) return `Seribu ${eja(n - 1000)}`;
  if (n < 1e6) return `${eja(Math.floor(n / 1000))} Ribu ${eja(n % 1000)}`;
  if (n < 1e9) return `${eja(Math.floor(n / 1e6))} Juta ${eja(n % 1e6)}`;
  if (n < 1e12) return `${eja(Math.floor(n / 1e9))} Miliar ${eja(n % 1e9)}`;
  return `${eja(Math.floor(n / 1e12))} Triliun ${eja(n % 1e12)}`;
}

/** 21600000 → "Dua Puluh Satu Juta Enam Ratus Ribu Rupiah". */
export function terbilang(nilai: number): string {
  const n = Math.round(Math.abs(nilai));
  if (!n) return 'Nol Rupiah';
  return `${eja(n).replace(/\s+/g, ' ').trim()} Rupiah`;
}
