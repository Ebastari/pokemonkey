/**
 * Satu memo sebagai gambar poster (PNG) berisi seluruh isinya: judul, chip
 * kategori/tipe/status, tanggal, penulis, ringkasan, dan isi lengkap — untuk
 * diunduh atau langsung dibagikan (WhatsApp).
 *
 * Poster disusun sendiri (bukan tangkapan layar) dengan warna dan huruf yang
 * ditulis langsung di tiap elemen, sehingga hasilnya sama di tema aplikasi
 * terang maupun gelap. Tiga gaya:
 *   - 'retro-gelap'  : khas POKEMONKEY (huruf piksel, kotak berbingkai tebal), latar gelap;
 *   - 'retro-terang' : gaya yang sama di atas kertas terang — tetap santai, lebih hemat baterai/tinta;
 *   - 'resmi'        : kertas resmi (logo Hasnur, huruf biasa, aksen hijau) untuk diteruskan/dicetak.
 */

import { simpanBerkas, bagikanBerkas } from './unduh';
import * as W from './waktu';
import logoHasnur from '../aset/logo-hasnur-memo.png';

export type GayaGambarMemo = 'retro-gelap' | 'retro-terang' | 'resmi';

export const GAYA_GAMBAR_MEMO: { id: GayaGambarMemo; label: string; ket: string }[] = [
  { id: 'retro-gelap', label: 'Retro gelap', ket: 'Santai · khas aplikasi' },
  { id: 'retro-terang', label: 'Retro terang', ket: 'Santai · latar terang' },
  { id: 'resmi', label: 'Resmi', ket: 'Formal · logo Hasnur' },
];

interface Chip { label: string; warna?: string | null }

export interface DataGambarMemo {
  judul: string;
  ringkasan?: string | null;
  isi: string;
  /** Tanggal memo siap tampil, mis. "30 Sep 2026". */
  tanggal?: string;
  penulis?: string | null;
  kategori?: Chip | null;
  tipe?: Chip | null;
  status?: Chip | null;
  /** "Memo Internal" atau "Catatan Pribadi". */
  jenis?: string;
  pengunduh?: string;
}

// Nama warna opsi (tabel `opsi`) → warna nyata; sama dengan palet di lib/warna.ts.
const HEX: Record<string, string> = {
  emerald: '#10b981', cyan: '#06b6d4', blue: '#3b82f6', indigo: '#6366f1', purple: '#a855f7',
  amber: '#f59e0b', orange: '#f97316', red: '#ef4444', yellow: '#eab308', zinc: '#71717a',
};
const hex = (nama?: string | null) => HEX[nama ?? ''] ?? HEX.zinc;

const LEBAR = 540; // px CSS; dipotret 2× → 1080 px, tajam di layar HP
const PIKSEL = "'Pixelify Sans', 'Segoe UI', system-ui, sans-serif";
const JUDUL_PIKSEL = "'Press Start 2P', monospace";
const BIASA = "'Segoe UI', Roboto, Arial, sans-serif";

interface Tema {
  /** Retro = huruf piksel, sudut siku, bingkai tebal berbayang. */
  retro: boolean;
  luar: string; kertas: string; teks: string; redup: string; judul: string; aksen: string;
  garis: string; hurufIsi: string; latarRingkas: string; teksTebal: string;
  /** Bingkai & bayangan kertas (retro) dan latar pita kaki. */
  bingkai: string; bayangan: string; latarKaki: string;
  /** Kepekatan latar chip (akhiran alfa heksa). */
  alfaChip: string;
}
const TEMA: Record<GayaGambarMemo, Tema> = {
  'retro-gelap': {
    retro: true, luar: '#0b0d10', kertas: '#18181b', teks: '#e4e4e7', redup: '#a1a1aa', judul: '#ffffff', aksen: '#bef264',
    garis: '#3f3f46', hurufIsi: PIKSEL, latarRingkas: '#1a2e05', teksTebal: '#ffffff',
    bingkai: '#ffffff', bayangan: '#000000', latarKaki: '#0b0d10', alfaChip: '33',
  },
  'retro-terang': {
    retro: true, luar: '#e6eae3', kertas: '#ffffff', teks: '#27272a', redup: '#6b7280', judul: '#15181c', aksen: '#3f6212',
    garis: '#a1a1aa', hurufIsi: PIKSEL, latarRingkas: '#ecfccb', teksTebal: '#0b0d10',
    bingkai: '#15181c', bayangan: '#15181c', latarKaki: '#f4f4f5', alfaChip: '2e',
  },
  resmi: {
    retro: false, luar: '#eef1ea', kertas: '#ffffff', teks: '#1f2937', redup: '#6b7280', judul: '#15181c', aksen: '#2f5d33',
    garis: '#d1d5db', hurufIsi: BIASA, latarRingkas: '#eef6ea', teksTebal: '#111827',
    bingkai: '#d1d5db', bayangan: 'rgba(0,0,0,0.10)', latarKaki: '#f6f8f4', alfaChip: '1f',
  },
};

type Gaya = Partial<CSSStyleDeclaration>;
function el(tag: string, gaya: Gaya, isi?: (Node | string)[] | string): HTMLElement {
  const n = document.createElement(tag);
  Object.assign(n.style, gaya);
  if (typeof isi === 'string') n.textContent = isi;
  else isi?.forEach((c) => n.append(c));
  return n;
}

/** "**tebal**" → <b>; sisanya teks biasa (tanpa HTML mentah). */
function denganTebal(teks: string, t: Tema): Node[] {
  return teks.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((b) =>
    b.startsWith('**') && b.endsWith('**') && b.length > 4
      ? el('b', { color: t.teksTebal, fontWeight: '700' }, b.slice(2, -2))
      : document.createTextNode(b),
  );
}

/** Isi memo: # judul · ## subjudul · - butir · - [ ] tugas · - [x] selesai · **tebal**. */
function susunIsi(isi: string, t: Tema): HTMLElement {
  const wadah = el('div', { fontFamily: t.hurufIsi, fontSize: '15px', lineHeight: '1.6', color: t.teks });
  for (const b of isi.split('\n')) {
    if (b.startsWith('# ')) {
      wadah.append(el('div', {
        fontSize: '18px', fontWeight: '700', color: t.aksen, margin: '14px 0 6px', paddingBottom: '4px',
        borderBottom: t.retro ? `2px dashed ${t.garis}` : `1px solid ${t.garis}`,
      }, denganTebal(b.slice(2), t)));
    } else if (b.startsWith('## ')) {
      wadah.append(el('div', { fontSize: '16px', fontWeight: '700', color: t.judul, margin: '10px 0 3px' }, denganTebal(b.slice(3), t)));
    } else if (/^- \[[ x]\] /.test(b)) {
      const selesai = b.startsWith('- [x]');
      const kotak = el('span', {
        flex: '0 0 auto', width: '14px', height: '14px', marginTop: '5px', boxSizing: 'border-box',
        border: `2px solid ${selesai ? t.aksen : t.redup}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }, selesai ? [el('span', { width: '6px', height: '6px', background: t.aksen })] : []);
      wadah.append(el('div', { display: 'flex', gap: '8px', padding: '1px 0' }, [
        kotak,
        el('span', { color: selesai ? t.redup : t.teks, textDecoration: selesai ? 'line-through' : 'none' }, denganTebal(b.slice(6), t)),
      ]));
    } else if (b.startsWith('- ')) {
      wadah.append(el('div', { display: 'flex', gap: '8px', paddingLeft: '4px' }, [
        el('span', { flex: '0 0 auto', width: '6px', height: '6px', marginTop: '9px', background: t.aksen }),
        el('span', {}, denganTebal(b.slice(2), t)),
      ]));
    } else if (!b.trim()) {
      wadah.append(el('div', { height: '8px' }));
    } else {
      wadah.append(el('div', {}, denganTebal(b, t)));
    }
  }
  if (!isi.trim()) wadah.append(el('div', { color: t.redup, fontStyle: 'italic' }, 'Belum ada isi.'));
  return wadah;
}

function chip(c: Chip, t: Tema, bertitik: boolean): HTMLElement {
  const w = hex(c.warna);
  return el('span', {
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 9px', fontFamily: t.hurufIsi, fontSize: '12px', fontWeight: '700',
    color: t.judul, background: `${w}${t.alfaChip}`, border: `2px solid ${w}`, borderRadius: t.retro ? '0' : '999px', whiteSpace: 'nowrap',
  }, [...(bertitik ? [el('span', { width: '8px', height: '8px', background: w, borderRadius: t.retro ? '0' : '50%' })] : []), c.label]);
}

function susunPoster(d: DataGambarMemo, gaya: GayaGambarMemo): HTMLElement {
  const t = TEMA[gaya];
  const jenis = d.jenis ?? 'Memo Internal';

  // ---- kepala: pita hijau POKEMONKEY (retro) atau kop ber-logo (resmi)
  let kepala: HTMLElement;
  if (t.retro) {
    kepala = el('div', { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', background: '#2f5d33', borderBottom: `4px solid ${t.bingkai}` }, [
      el('div', { flex: '1 1 auto' }, [
        el('div', { fontFamily: JUDUL_PIKSEL, fontSize: '13px', color: '#fde047', letterSpacing: '1px' }, 'POKEMONKEY'),
        el('div', { fontFamily: PIKSEL, fontSize: '12px', color: '#d9f99d', marginTop: '6px' }, 'Departemen RNR · PT Energi Batubara Lestari'),
      ]),
      el('div', { fontFamily: JUDUL_PIKSEL, fontSize: '8px', color: '#0b0d10', background: '#fde047', padding: '6px 8px', border: '2px solid #0b0d10', whiteSpace: 'nowrap' }, jenis.toUpperCase()),
    ]);
  } else {
    const logo = document.createElement('img');
    logo.src = logoHasnur;
    logo.alt = '';
    Object.assign(logo.style, { height: '40px', width: 'auto', flex: '0 0 auto' });
    kepala = el('div', { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 22px', borderBottom: `3px solid ${t.aksen}` }, [
      logo,
      el('div', { flex: '1 1 auto', fontFamily: BIASA }, [
        el('div', { fontSize: '16px', fontWeight: '700', color: t.aksen, letterSpacing: '0.5px' }, jenis.toUpperCase()),
        el('div', { fontSize: '12px', color: t.redup, marginTop: '2px' }, 'Departemen RNR · PT Energi Batubara Lestari'),
      ]),
    ]);
  }

  // ---- judul, chip, info
  const chips = [d.kategori && chip(d.kategori, t, true), d.tipe && chip(d.tipe, t, false), d.status && chip(d.status, t, true)]
    .filter((x): x is HTMLElement => Boolean(x));
  const info = [d.tanggal && ['Tanggal', d.tanggal], d.penulis && ['Penulis', d.penulis]].filter((x): x is string[] => Boolean(x));
  const badan = el('div', { padding: t.retro ? '18px' : '22px', display: 'flex', flexDirection: 'column', gap: '14px' }, [
    el('div', { fontFamily: t.hurufIsi, fontSize: '25px', fontWeight: '700', lineHeight: '1.25', color: t.judul, wordBreak: 'break-word' }, d.judul.trim() || 'Tanpa judul'),
    ...(chips.length ? [el('div', { display: 'flex', flexWrap: 'wrap', gap: '6px' }, chips)] : []),
    ...(info.length ? [el('div', { display: 'flex', flexWrap: 'wrap', gap: '4px 22px', fontFamily: t.hurufIsi, fontSize: '13px', color: t.redup }, info.map(([k, v]) =>
      el('span', {}, [`${k}: `, el('b', { color: t.teks, fontWeight: '700' }, v)])))] : []),
  ]);

  // ---- ringkasan
  if (d.ringkasan?.trim()) {
    badan.append(el('div', {
      background: t.latarRingkas, padding: '12px 14px',
      ...(t.retro ? { border: `2px solid ${t.aksen}`, borderLeftWidth: '5px' } : { borderLeft: `5px solid ${t.aksen}` }),
    }, [
      el('div', { fontFamily: t.retro ? JUDUL_PIKSEL : BIASA, fontSize: t.retro ? '8px' : '11px', fontWeight: '700', letterSpacing: '1px', color: t.aksen, marginBottom: '7px' }, 'RINGKASAN'),
      el('div', { fontFamily: t.hurufIsi, fontSize: '15px', lineHeight: '1.55', color: t.judul, whiteSpace: 'pre-wrap' }, d.ringkasan.trim()),
    ]));
  }

  // ---- isi lengkap
  badan.append(el('div', { borderTop: t.retro ? `2px dashed ${t.garis}` : `1px solid ${t.garis}`, paddingTop: '12px' }, [susunIsi(d.isi, t)]));

  // ---- kaki
  const kaki = el('div', {
    display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '4px 12px', padding: '10px 18px',
    fontFamily: t.hurufIsi, fontSize: '11px', color: t.redup, background: t.latarKaki,
    borderTop: t.retro ? `4px solid ${t.bingkai}` : `1px solid ${t.garis}`,
  }, [
    el('span', {}, 'Dibuat dengan POKEMONKEY'),
    el('span', {}, `Diunduh ${W.capWaktuWita()}${d.pengunduh ? ` · ${d.pengunduh}` : ''}`),
  ]);

  const kertas = el('div', {
    background: t.kertas, overflow: 'hidden',
    border: t.retro ? `4px solid ${t.bingkai}` : `1px solid ${t.bingkai}`,
    boxShadow: t.retro ? `8px 8px 0 ${t.bayangan}` : `0 2px 10px ${t.bayangan}`,
    borderRadius: t.retro ? '0' : '6px',
  }, [kepala, badan, kaki]);

  return el('div', { width: `${LEBAR}px`, boxSizing: 'border-box', padding: t.retro ? '18px 26px 26px 18px' : '20px', background: t.luar }, [kertas]);
}

const namaBerkas = (judul: string) => (judul.trim() || 'memo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'memo';

/** Susun poster di luar layar lalu potret jadi PNG. */
export async function buatGambarMemo(d: DataGambarMemo, gaya: GayaGambarMemo): Promise<{ blob: Blob; nama: string }> {
  const { toCanvas } = await import('html-to-image');
  // Yang dipotret hanya posternya, bukan pembungkus yang digeser keluar layar.
  const pembungkus = el('div', { position: 'fixed', left: '-20000px', top: '0', pointerEvents: 'none' });
  const poster = susunPoster(d, gaya);
  pembungkus.append(poster);
  document.body.append(pembungkus);
  try {
    await Promise.all([
      document.fonts.load(`13px "Press Start 2P"`),
      document.fonts.load(`700 15px "Pixelify Sans"`),
      document.fonts.load(`15px "Pixelify Sans"`),
      ...Array.from(poster.querySelectorAll('img')).map((g) => g.decode().catch(() => undefined)),
    ]).catch(() => undefined);
    const w = poster.offsetWidth;
    const h = poster.offsetHeight;
    // 2× supaya tajam; memo sangat panjang diturunkan agar kanvas tidak melebihi batas memori WebView.
    const rasio = w * h * 4 <= 16_000_000 ? 2 : 1;
    const kanvas = await toCanvas(poster, { width: w, height: h, pixelRatio: rasio, backgroundColor: TEMA[gaya].luar, cacheBust: true });
    const blob = await new Promise<Blob>((ok, gagal) => kanvas.toBlob((b) => (b ? ok(b) : gagal(new Error('Gambar gagal dibuat'))), 'image/png'));
    return { blob, nama: `memo-${namaBerkas(d.judul)}-${gaya}.png` };
  } finally {
    pembungkus.remove();
  }
}

export async function unduhGambarMemo(d: DataGambarMemo, gaya: GayaGambarMemo): Promise<'dibagikan' | 'diunduh'> {
  const { blob, nama } = await buatGambarMemo(d, gaya);
  return simpanBerkas(blob, nama, d.judul || 'Memo');
}

/** Bagikan langsung lewat lembar bagikan (pilih WhatsApp); bila perangkat tidak mendukung, gambar diunduh. */
export async function bagikanGambarMemo(d: DataGambarMemo, gaya: GayaGambarMemo): Promise<'dibagikan' | 'diunduh' | 'dibatalkan'> {
  const { blob, nama } = await buatGambarMemo(d, gaya);
  const judul = d.judul.trim() || 'Memo';
  return bagikanBerkas(blob, nama, judul, `${d.jenis ?? 'Memo Internal'}: ${judul}`);
}
