/**
 * Lapisan editor blok memo (gaya Notion) di atas teks memo.
 *
 * Penyimpanan tetap teks satu-blok-per-baris (lihat server/src/memo-blok.ts);
 * modul ini hanya menerjemahkan:
 *   - satu baris  <-> { jenis, isi }       (bacaBaris / rakitBaris)
 *   - isi inline  <-> HTML yang disunting  (keHtml / dariDom)
 * serta posisi kursor di dalam satu blok yang bisa disunting.
 */

import { bacaData, bacaTabel, uraiBlok, uraiInline, type Inline } from '../server/src/memo-blok';
import { rumusHtml } from './rumus';
import type { AnggotaRingkas } from './tipe-api';
import * as W from './waktu';

export type JenisBlok =
  | 'teks' | 'h1' | 'h2' | 'h3' | 'h4' | 'butir' | 'nomor' | 'ceklis' | 'toggle' | 'kutipan' | 'penting'
  | 'garis' | 'gambar' | 'video' | 'tabel' | 'berkas' | 'data' | 'kode' | 'rumus' | 'daftarisi' | 'kolom' | 'penanda' | 'grafik';

/** Blok khusus berawalan "!" yang dikenali uraiBlok (bukan teks yang diketik langsung). */
const JENIS_KHUSUS: ReadonlySet<string> = new Set(['kode', 'rumus', 'daftarisi', 'kolom', 'penanda', 'gambar', 'grafik']);

/** Blok yang isinya diketik langsung (bukan garis, gambar, berkas). */
export const BLOK_TEKS: ReadonlySet<JenisBlok> = new Set(['teks', 'h1', 'h2', 'h3', 'h4', 'butir', 'nomor', 'ceklis', 'toggle', 'kutipan', 'penting']);

/** Enter pada blok ini membuat blok baru berjenis sama (daftar berlanjut). */
const BERLANJUT: ReadonlySet<JenisBlok> = new Set(['butir', 'nomor', 'ceklis']);
export const jenisLanjutan = (j: JenisBlok): JenisBlok => (BERLANJUT.has(j) ? j : 'teks');

export interface InfoBaris { jenis: JenisBlok; isi: string; selesai: boolean }

/** Urutan pemeriksaan sama dengan uraiBlok, agar penyunting dan penampil sepakat. */
export function bacaBaris(raw: string): InfoBaris {
  let m: RegExpMatchArray | null;
  if ((m = raw.match(/^(#{1,4}) (.*)$/))) return { jenis: (['h1', 'h2', 'h3', 'h4'] as const)[m[1].length - 1], isi: m[2], selesai: false };
  if ((m = raw.match(/^- \[([ xX])\] ?(.*)$/))) return { jenis: 'ceklis', isi: m[2], selesai: m[1] !== ' ' };
  if (/^---+\s*$/.test(raw)) return { jenis: 'garis', isi: '', selesai: false };
  if (/^!video\[[^\]]*\]\(https?:\/\/[^)\s]+\)\s*$/.test(raw)) return { jenis: 'video', isi: raw, selesai: false };
  if (raw.startsWith('!tabel{') && bacaTabel(raw)) return { jenis: 'tabel', isi: raw, selesai: false };
  if (raw.startsWith('!data{') && bacaData(raw)) return { jenis: 'data', isi: raw, selesai: false };
  if (raw.startsWith('!')) {
    const khusus = uraiBlok(raw)[0];
    if (khusus && JENIS_KHUSUS.has(khusus.jenis)) return { jenis: khusus.jenis as JenisBlok, isi: raw, selesai: false };
  }
  if (/^!\[[^\]]*\]\([^)\s]+\)\s*$/.test(raw)) return { jenis: 'gambar', isi: raw, selesai: false };
  if (/^\[[^\]]+\]\((?:memo|demo)\/[^)\s]+\)\s*$/.test(raw)) return { jenis: 'berkas', isi: raw, selesai: false };
  if (raw.startsWith('- ')) return { jenis: 'butir', isi: raw.slice(2), selesai: false };
  if ((m = raw.match(/^\d{1,3}\. (.*)$/))) return { jenis: 'nomor', isi: m[1], selesai: false };
  if (raw.startsWith('>> ')) return { jenis: 'toggle', isi: raw.slice(3), selesai: false };
  if (raw.startsWith('> ')) return { jenis: 'kutipan', isi: raw.slice(2), selesai: false };
  if (raw.startsWith('!! ')) return { jenis: 'penting', isi: raw.slice(3), selesai: false };
  return { jenis: 'teks', isi: raw, selesai: false };
}

export function rakitBaris(jenis: JenisBlok, isi: string, selesai = false): string {
  switch (jenis) {
    case 'h1': return `# ${isi}`;
    case 'h2': return `## ${isi}`;
    case 'h3': return `### ${isi}`;
    case 'h4': return `#### ${isi}`;
    case 'butir': return `- ${isi}`;
    case 'nomor': return `1. ${isi}`;
    case 'ceklis': return `- [${selesai ? 'x' : ' '}] ${isi}`;
    case 'toggle': return `>> ${isi}`;
    case 'kutipan': return `> ${isi}`;
    case 'penting': return `!! ${isi}`;
    case 'garis': return '---';
    case 'data': return isi;
    default: return isi;
  }
}

/**
 * Pintasan ketik ala Notion di awal blok: "# " judul, "- " butir, "[] " ceklis,
 * "1. " bernomor, "> " toggle, "\" " kutipan, "!! " callout, "---" divider.
 * (Kutipan lama tetap disimpan sebagai "> " — lihat bacaBaris; hanya pintasan
 * ketiknya yang mengikuti Notion.)
 */
export function cekPintasan(md: string): { jenis: JenisBlok; sisa: string; selesai: boolean } | null {
  if (/^---$/.test(md)) return { jenis: 'garis', sisa: '', selesai: false };
  const m = md.match(/^(#{1,4}|[-*+]|\[ ?\]|\[[xX]\]|\d{1,3}\.|["“]|>|!!) ([\s\S]*)$/);
  if (!m) return null;
  const p = m[1];
  const jenis: JenisBlok = p.startsWith('#') ? (['h1', 'h2', 'h3', 'h4'] as const)[p.length - 1]
    : p.startsWith('[') ? 'ceklis'
      : /^\d/.test(p) ? 'nomor'
        : p === '!!' ? 'penting'
          : p === '>' ? 'toggle'
          : /^["“]$/.test(p) ? 'kutipan'
            : 'butir';
  return { jenis, sisa: m[2], selesai: /x/i.test(p) };
}

// ---------------------------------------------------------------------------
// Isi inline -> HTML
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const IKON_KALENDER = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" style="display:inline;vertical-align:-1px;margin-right:3px"><rect x="3" y="4" width="18" height="18"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const IKON_KLIP = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" style="display:inline;vertical-align:-1px;margin-right:3px"><path d="m21.4 11.6-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>';

/** Kelas chip: tidak bisa disunting per huruf, dihapus utuh dengan Backspace. */
const CHIP = 'inline-block px-1.5 mx-px border text-[12px] font-bold whitespace-nowrap align-baseline cursor-pointer select-none';

function kelasTenggat(tanggal: string, selesai: boolean): string {
  if (selesai) return 'border-white/15 text-zinc-500';
  const sisa = W.selisihHari(tanggal, W.hariIniWita());
  return sisa < 0 ? 'border-red-400 text-red-300 bg-red-950/40'
    : sisa === 0 ? 'border-amber-400 text-amber-200 bg-amber-950/40'
      : 'border-sky-400/60 text-sky-200 bg-sky-950/30';
}

/** Judul & ikon terkini halaman yang ditautkan (judul di teks hanya cadangan, seperti Notion). */
export type PetaHalaman = ReadonlyMap<string, { judul: string; ikon?: string }>;

export interface KonteksHtml {
  tim?: AnggotaRingkas[]; selesai?: boolean;
  /** Bila diberikan, tautan ke halaman yang tidak ada di peta ditandai "di Sampah / dihapus". */
  halaman?: PetaHalaman;
}

/** Judul tampil chip halaman + penanda hilang (di Sampah atau sudah dihapus). */
export function infoHalaman(id: string, judulSimpan: string, peta?: PetaHalaman): { judul: string; ikon: string; hilang: boolean } {
  const h = peta?.get(id);
  if (h) return { judul: h.judul.trim() || 'Tanpa judul', ikon: h.ikon || '📄', hilang: false };
  return { judul: judulSimpan.trim() || 'Tanpa judul', ikon: '📄', hilang: Boolean(peta) };
}

export function keHtml(md: string, k: KonteksHtml = {}): string {
  const potong = uraiInline(md);
  // Baris baru di akhir blok perlu satu huruf penahan agar barisnya tampil (dibuang lagi saat disimpan).
  const ekor = potong[potong.length - 1]?.t === 'baris' ? '\u200B' : '';
  return htmlInline(potong, k) + ekor;
}

function htmlInline(potong: Inline[], k: KonteksHtml): string {
  return potong.map((x) => {
    switch (x.t) {
      case 'teks': return esc(x.v);
      // Baris baru di dalam blok = huruf "\n" (whitespace-pre-wrap), jadi posisi kursor tetap terhitung.
      case 'baris': return '\n';
      case 'garisbawah': return `<u>${esc(x.v)}</u>`;
      case 'warna': return `<span data-warna="${x.jenis}:${x.warna}" class="m${x.jenis}-${x.warna}">${htmlInline(x.isi, k)}</span>`;
      case 'rumus': {
        const html = rumusHtml(x.v);
        return `<span contenteditable="false" data-raw="${esc(`$$${x.v}$$`)}" data-rumus="${esc(x.v)}" class="inline-block px-0.5 mx-px cursor-pointer hover:bg-white/10 align-baseline" title="Rumus — ketuk untuk mengubah">${html ?? `<code class="text-lime-200">${esc(x.v)}</code>`}</span>`;
      }
      case 'tebal': return `<b>${esc(x.v)}</b>`;
      case 'miring': return `<i>${esc(x.v)}</i>`;
      case 'coret': return `<s>${esc(x.v)}</s>`;
      case 'kode': return `<code class="px-1 bg-black/40 border border-white/15 text-lime-200 text-[0.92em]">${esc(x.v)}</code>`;
      case 'tautan':
        return `<a contenteditable="false" data-raw="${esc(`[${x.v}](${x.url})`)}" data-tautan="${esc(x.url)}" href="${esc(x.url)}" class="text-sky-300 underline cursor-pointer" title="${esc(x.url)}">${esc(x.v)}</a>`;
      case 'berkas':
        return `<span contenteditable="false" data-raw="${esc(`[${x.v}](${x.kunci})`)}" data-berkas="${esc(x.kunci)}" data-nama="${esc(x.v)}" class="${CHIP} border-white/25 text-zinc-100 bg-white/5" title="Simpan atau bagikan berkas">${IKON_KLIP}${esc(x.v)}</span>`;
      case 'tenggat': {
        const raw = `@${x.tanggal}${x.jam ? ` ${x.jam}` : ''}`;
        return `<span contenteditable="false" data-raw="${raw}" data-tenggat="${x.tanggal}" data-jam="${x.jam ?? ''}" class="${CHIP} ${kelasTenggat(x.tanggal, Boolean(k.selesai))}" title="Tenggat ${esc(W.formatPanjang(x.tanggal))}${x.jam ? ` ${x.jam}` : ''} — ketuk untuk mengubah">${IKON_KALENDER}${esc(W.formatPendek(x.tanggal))}${x.jam ? ` ${x.jam}` : ''}</span>`;
      }
      case 'orang': {
        const t = k.tim?.find((a) => a.id === x.id);
        if (!t) return esc(`@${x.id}`);
        return `<span contenteditable="false" data-raw="@${esc(x.id)}" class="${CHIP} border-lime-500/50 text-lime-200 bg-lime-950/30" title="Penanggung jawab: ${esc(t.nama)}">@${esc(t.nama.split(' ')[0])}</span>`;
      }
      case 'halaman': {
        // Judul terkini ikut tersimpan lagi saat baris ini disunting.
        const h = infoHalaman(x.id, x.v, k.halaman);
        const raw = `[[memo:${x.id}|${h.hilang ? x.v : h.judul.replace(/[\]|\n]/g, ' ')}]]`;
        const kelas = h.hilang ? 'border-white/15 text-zinc-500 line-through' : 'border-white/30 text-zinc-100 bg-white/5 underline decoration-white/30';
        return `<span contenteditable="false" data-raw="${esc(raw)}" data-halaman="${esc(x.id)}" class="${CHIP} ${kelas}" title="${h.hilang ? 'Halaman ada di Sampah atau sudah dihapus' : 'Buka halaman'}">${esc(h.ikon)} ${esc(h.judul)}</span>`;
      }
      case 'pica':
        return `<span contenteditable="false" data-raw="#${esc(x.id)}" data-pica="${esc(x.id)}" class="${CHIP} border-amber-400/60 text-amber-200 bg-amber-950/30" title="Buka PICA">#${esc(x.id)}</span>`;
    }
    return '';
  }).join('');
}

// ---------------------------------------------------------------------------
// HTML -> isi inline
// ---------------------------------------------------------------------------

/** Tanda format dipasang di luar spasi: "** a**" tidak terbaca sebagai tebal. */
function bungkusTanda(isi: string, tanda: string, tutup = tanda): string {
  const m = isi.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m || !m[2]) return isi;
  return `${m[1]}${tanda}${m[2]}${tutup}${m[3]}`;
}

function serial(n: Node, dalamFormat: boolean): string {
  // "\n" di teks = baris baru di dalam blok (Shift+Enter) -> disimpan sebagai <br>.
  if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').replace(/[ ]/g, ' ').replace(/[​\r]/g, '').replace(/\n/g, '<br>');
  if (n.nodeType !== Node.ELEMENT_NODE && n.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return '';
  if (n.nodeType === Node.ELEMENT_NODE) {
    const el = n as HTMLElement;
    const raw = el.getAttribute('data-raw');
    if (raw !== null) return raw;
    // <br> sisipan peramban: yang masih diikuti isi = baris baru; yang di ujung hanya penahan.
    if (el.tagName === 'BR') return el.nextSibling ? '<br>' : '';
  }
  const el = n as HTMLElement;
  const tag = n.nodeType === Node.ELEMENT_NODE ? el.tagName : '';
  const gaya = n.nodeType === Node.ELEMENT_NODE ? el.style : null;
  const tebal = tag === 'B' || tag === 'STRONG' || (gaya && (gaya.fontWeight === 'bold' || Number(gaya.fontWeight) >= 600));
  const miring = tag === 'I' || tag === 'EM' || (gaya && gaya.fontStyle === 'italic');
  const coret = tag === 'S' || tag === 'STRIKE' || tag === 'DEL' || (gaya && gaya.textDecoration.includes('line-through'));
  const kode = tag === 'CODE';
  const garisBawah = tag === 'U' || Boolean(gaya && gaya.textDecoration.includes('underline'));
  // Warna/stabilo membungkus format lain ({l:kuning|**tebal**}); di dalam format lain warnanya dilepas.
  const warna = n.nodeType === Node.ELEMENT_NODE ? el.getAttribute('data-warna') : null;
  if (warna && /^[wl]:[a-z]+$/.test(warna)) {
    const dalam = Array.from(n.childNodes).map((c) => serial(c, dalamFormat)).join('');
    if (dalamFormat || !dalam.trim()) return dalam;
    const m = dalam.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return m ? `${m[1]}{${warna}|${m[2].replace(/\{[wl]:[a-z]+\|([^{}\n]*)\}/g, '$1').replace(/[{}]/g, '')}}${m[3]}` : dalam;
  }
  const format = !dalamFormat && (tebal || miring || coret || kode || garisBawah);
  // Format bertumpuk (tebal+miring) disederhanakan ke yang terluar: teks memo tidak mengenal tumpukan.
  const isi = Array.from(n.childNodes).map((c) => serial(c, dalamFormat || Boolean(format))).join('');
  if (!format) return isi;
  if (kode) return bungkusTanda(isi, '`');
  if (tebal) return bungkusTanda(isi, '**');
  if (miring) return bungkusTanda(isi, '*');
  if (garisBawah && !coret) return bungkusTanda(isi, '++');
  return bungkusTanda(isi, '~~');
}

export const dariDom = (n: Node): string => serial(n, false);

// ---------------------------------------------------------------------------
// Kursor di dalam satu blok (posisi = jumlah huruf yang tampil sebelum kursor)
// ---------------------------------------------------------------------------

const atomik = (n: Node) => n.nodeType === Node.ELEMENT_NODE && (n as HTMLElement).getAttribute('contenteditable') === 'false';

/** Posisi awal pilihan di dalam `root`, atau null bila pilihan di luar. */
export function offsetKursor(root: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!root.contains(r.startContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}

/** Titik DOM untuk posisi huruf `pos`; chip dilompati utuh. */
function titikDi(root: HTMLElement, pos: number): { node: Node; offset: number } {
  let sisa = Math.max(0, pos);
  const jalan = (n: Node): { node: Node; offset: number } | null => {
    for (let i = 0; i < n.childNodes.length; i++) {
      const c = n.childNodes[i];
      if (c.nodeType === Node.TEXT_NODE) {
        const p = c.textContent?.length ?? 0;
        if (sisa <= p) return { node: c, offset: sisa };
        sisa -= p;
      } else if (atomik(c)) {
        const p = c.textContent?.length ?? 0;
        if (sisa === 0) return { node: n, offset: i };
        if (sisa <= p) return { node: n, offset: i + 1 };
        sisa -= p;
      } else {
        const h = jalan(c);
        if (h) return h;
      }
    }
    return null;
  };
  return jalan(root) ?? { node: root, offset: root.childNodes.length };
}

export function pasangKursor(root: HTMLElement, pos: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const t = titikDi(root, pos);
  const r = document.createRange();
  r.setStart(t.node, t.offset);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

export function rentang(root: HTMLElement, dari: number, sampai: number): Range {
  const a = titikDi(root, dari);
  const b = titikDi(root, sampai);
  const r = document.createRange();
  r.setStart(a.node, a.offset);
  r.setEnd(b.node, b.offset);
  return r;
}

/** Isi inline sebelum dan sesudah pilihan (pilihan sendiri dibuang). */
export function potongDiKursor(root: HTMLElement): { sebelum: string; sesudah: string } {
  const sel = window.getSelection();
  const semua = dariDom(root);
  if (!sel || sel.rangeCount === 0 || !root.contains(sel.getRangeAt(0).startContainer)) return { sebelum: semua, sesudah: '' };
  const r = sel.getRangeAt(0);
  const a = document.createRange();
  a.selectNodeContents(root);
  a.setEnd(r.startContainer, r.startOffset);
  const b = document.createRange();
  b.selectNodeContents(root);
  b.setStart(r.endContainer, r.endOffset);
  return { sebelum: dariDom(a.cloneContents()), sesudah: dariDom(b.cloneContents()) };
}

/** Panjang tampilan isi inline (chip dihitung sesuai teksnya), untuk menaruh kursor. */
export function panjangTampil(md: string, k: KonteksHtml = {}): number {
  const d = document.createElement('div');
  d.innerHTML = keHtml(md, k);
  return d.textContent?.length ?? 0;
}

/** Kursor berada di baris pertama / terakhir blok (untuk panah atas/bawah antarblok). */
export function kursorDiTepi(root: HTMLElement, arah: 'atas' | 'bawah'): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return true;
  const r = sel.getRangeAt(0).cloneRange();
  r.collapse(arah === 'atas');
  const rects = r.getClientRects();
  const kotak = root.getBoundingClientRect();
  if (!rects.length) return true;
  const garis = parseFloat(getComputedStyle(root).lineHeight) || 22;
  const k = rects[0];
  return arah === 'atas' ? k.top - kotak.top < garis * 0.8 : kotak.bottom - k.bottom < garis * 0.8;
}
