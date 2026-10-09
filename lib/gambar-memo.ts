/**
 * Satu memo sebagai gambar poster (PNG) berisi SELURUH isinya, sama dengan
 * halaman memo di aplikasi: sampul (utuh, tidak dipotong), ikon, judul, semua
 * properti, dan semua blok — judul 1–4, butir, bernomor, tugas, toggle (tampil
 * terbuka), kutipan, callout, divider, gambar, video, tabel, berkas, beserta
 * chip tenggat/orang/PICA/halaman — untuk diunduh atau langsung dibagikan (WhatsApp).
 *
 * Poster disusun sendiri (bukan tangkapan layar) dengan warna dan huruf yang
 * ditulis langsung di tiap elemen, sehingga hasilnya sama di tema aplikasi
 * terang maupun gelap. Tiga gaya:
 *   - 'retro-gelap'  : khas POKEMONKEY (huruf piksel, kotak berbingkai tebal), latar gelap seperti aplikasi;
 *   - 'retro-terang' : gaya yang sama di atas kertas terang — tetap santai, lebih hemat baterai/tinta;
 *   - 'resmi'        : kertas resmi (logo Hasnur, huruf biasa, aksen hijau) untuk diteruskan/dicetak.
 * Tidak ada yang dipotong: teks panjang dan tabel lebar dibungkus ke baris berikutnya.
 */

import { daftarJudul, hitungTugas, uraiBlok, uraiInline, type Blok, type Inline } from '../server/src/memo-blok';
import { CSS_SAMPUL_WARNA, WARNA_KODE, gayaWarna, sorotKode, warnaTenggat } from '../server/src/tampil-memo';
import { barisMendatang, cssTemaGrafik, hitungGrafikTabel, htmlKartuGrafikTabel, kolomPendek, kolomStatusTabel, kontras, labelStatus, statusBaku } from '../server/src/grafik-tabel';
import { muatKatex, rumusHtml } from './rumus';
import { ha, ringkasRevegetasi, totalTahun, type BarisRevegetasi } from './revegetasi';
import { SUMBER_REVEGETASI, barisGrafik, kegiatanRevegetasi, muatRevegetasi } from './revegetasi-muat';
import { bacaSampul } from './sampul';
import { urlFoto } from './foto';
import { ambilBerkas } from './api';
import { simpanBerkas, bagikanBerkas } from './unduh';
import * as W from './waktu';
import logoHasnur from '../aset/logo-hasnur-memo.png';

export type GayaGambarMemo = 'retro-gelap' | 'retro-terang' | 'resmi';
/**
 * Ukuran gambar: 'hp' = tegak 540 px (dipotret 1080 px) untuk layar HP & WhatsApp;
 * 'komputer' = lebar 1040 px (±2080 px) seperti halaman memo di monitor — tabel jarang
 * terlipat, kolom berdampingan, grafik besar.
 */
export type UkuranGambarMemo = 'hp' | 'komputer';
const LEBAR_UKURAN: Record<UkuranGambarMemo, number> = { hp: 540, komputer: 1040 };

/** Layar komputer: tetikus (bukan sentuh) dan jendela cukup lebar. */
export const layarKomputer = () => {
  try { return window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 1024; } catch { return false; }
};

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
  /** Ikon halaman (emoji) dan nilai sampulnya (props.sampul): galeri, warna, atau kunci unggahan. */
  ikon?: string;
  sampul?: string;
  /** Baris properti lain seperti di halaman: PICA dan properti kustom yang terisi. */
  properti?: { label: string; nilai: string }[];
  /** Nama anggota untuk chip @orang. */
  tim?: { id: string; nama: string }[];
}

// Nama warna opsi (tabel `opsi`) → warna nyata; sama dengan palet di lib/warna.ts.
const HEX: Record<string, string> = {
  emerald: '#10b981', cyan: '#06b6d4', blue: '#3b82f6', indigo: '#6366f1', purple: '#a855f7',
  amber: '#f59e0b', orange: '#f97316', red: '#ef4444', yellow: '#eab308', zinc: '#71717a',
};
const hex = (nama?: string | null) => HEX[nama ?? ''] ?? HEX.zinc;

const PIKSEL = "'Pixelify Sans', 'Segoe UI', system-ui, sans-serif";
const JUDUL_PIKSEL = "'Press Start 2P', monospace";
const BIASA = "'Segoe UI', Roboto, Arial, sans-serif";

interface Tema {
  /** Retro = huruf piksel, sudut siku, bingkai tebal berbayang. */
  retro: boolean;
  /** Latar gelap: chip memakai warna aplikasi (mode gelap). */
  gelap: boolean;
  luar: string; kertas: string; teks: string; redup: string; judul: string; aksen: string;
  garis: string; hurufIsi: string; latarRingkas: string; teksTebal: string; tautan: string; latarKode: string;
  /** Bingkai & bayangan kertas (retro) dan latar pita kaki. */
  bingkai: string; bayangan: string; latarKaki: string;
  /** Kepekatan latar chip (akhiran alfa heksa). */
  alfaChip: string;
}
const TEMA: Record<GayaGambarMemo, Tema> = {
  'retro-gelap': {
    retro: true, gelap: true, luar: '#0b0d10', kertas: '#09090b', teks: '#f4f4f5', redup: '#a1a1aa', judul: '#ffffff', aksen: '#bef264',
    garis: '#3f3f46', hurufIsi: PIKSEL, latarRingkas: '#1a2e05', teksTebal: '#ffffff', tautan: '#7dd3fc', latarKode: 'rgba(0,0,0,.4)',
    bingkai: '#ffffff', bayangan: '#000000', latarKaki: '#0b0d10', alfaChip: '33',
  },
  'retro-terang': {
    retro: true, gelap: false, luar: '#e6eae3', kertas: '#ffffff', teks: '#27272a', redup: '#6b7280', judul: '#15181c', aksen: '#3f6212',
    garis: '#a1a1aa', hurufIsi: PIKSEL, latarRingkas: '#ecfccb', teksTebal: '#0b0d10', tautan: '#0369a1', latarKode: '#f4f4f5',
    bingkai: '#15181c', bayangan: '#15181c', latarKaki: '#f4f4f5', alfaChip: '2e',
  },
  resmi: {
    retro: false, gelap: false, luar: '#eef1ea', kertas: '#ffffff', teks: '#1f2937', redup: '#6b7280', judul: '#15181c', aksen: '#2f5d33',
    garis: '#d1d5db', hurufIsi: BIASA, latarRingkas: '#eef6ea', teksTebal: '#111827', tautan: '#1d4ed8', latarKode: '#f3f4f6',
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

/** Konteks penyusunan: tema, gambar yang sudah dimuat (kunci → URL), dan nama anggota. */
interface Ktx {
  /** Ukuran gambar: HP (tegak) atau komputer (lebar). */
  ukuran: UkuranGambarMemo;
  t: Tema; gambar: Map<string, string>; nama: Map<string, string>; hariIni: string;
  /** Judul-judul memo untuk blok daftar isi. */
  judul: { indeks: number; tingkat: number; teks: string }[];
  /** Data realisasi revegetasi untuk blok grafik (dimuat bila memo memuat grafik). */
  revegetasi?: { baris: BarisRevegetasi[]; cadangan: boolean };
}

/**
 * Grafik realisasi reklamasi untuk gambar unduhan — gaya slide Monkey Point:
 * kartu putih berbingkai hitam, kotak angka, batang bertumpuk APL + Hutan per tahun,
 * batang mendatar per kegiatan/blok. Tetap putih di ketiga gaya poster.
 */
function grafikEl(b: { tampil: string; dari?: number; sampai?: number }, k: Ktx): HTMLElement {
  const HITAM = '#0f172a';
  const kotak = (isi: (Node | string)[], gaya: Gaya = {}) => el('div', { background: '#ffffff', border: `2px solid ${HITAM}`, boxShadow: `3px 3px 0 ${HITAM}`, ...gaya }, isi);
  const data = k.revegetasi;
  const baris = barisGrafik(data?.baris ?? [], b);
  const r = ringkasRevegetasi(baris);
  const tahunan = b.tampil === 'tahun' || b.tampil === 'lengkap';
  const rentang = baris.length ? `${baris[0].tahun}–${baris[baris.length - 1].tahun}` : '';
  const isi: HTMLElement[] = [
    el('div', { borderBottom: '2px solid #047857', paddingBottom: '6px', marginBottom: '10px' }, [
      el('div', { fontFamily: JUDUL_PIKSEL, fontSize: '10px', color: '#022c22' }, tahunan ? 'REALISASI PROGRES REKLAMASI' : 'RINCIAN REALISASI REKLAMASI'),
      el('div', { fontSize: '11px', color: '#475569', marginTop: '3px' }, !baris.length ? 'Data realisasi tidak tersedia' : tahunan ? `Per tahun ${rentang}, status kawasan APL dan Hutan (PPKH)` : `Akumulasi ${rentang} · per jenis kegiatan dan per blok`),
    ]),
  ];
  if (tahunan && baris.length) {
    const stat = el('div', { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px', marginBottom: '10px' },
      ([['TOTAL REALISASI', r.total, '#064e3b'], ['KAWASAN APL', r.apl, '#16a34a'], ['KAWASAN HUTAN (PPKH)', r.hutan, '#065f46']] as [string, number, string][])
        .concat(r.terakhir ? [[`TAHUN ${r.terakhir.tahun}`, totalTahun(r.terakhir), '#92400e']] : [])
        .map(([label, n, warna]) => kotak([
          el('div', { fontSize: '9px', fontWeight: '700', color: '#64748b' }, label),
          el('div', { fontFamily: JUDUL_PIKSEL, fontSize: '10px', color: warna, marginTop: '2px' }, `${ha(n)} HA`),
        ], { padding: '5px 7px', ...(label.startsWith('TAHUN') ? { borderColor: '#b45309' } : {}) })));
    const legenda = el('div', { display: 'flex', gap: '12px', fontSize: '10px', fontWeight: '700', color: '#334155', marginBottom: '4px' }, [
      el('span', { display: 'flex', alignItems: 'center', gap: '4px' }, [el('span', { width: '9px', height: '9px', background: '#16a34a', border: `1px solid ${HITAM}` }), 'APL']),
      el('span', { display: 'flex', alignItems: 'center', gap: '4px' }, [el('span', { width: '9px', height: '9px', background: '#065f46', border: `1px solid ${HITAM}` }), 'Hutan (PPKH)']),
    ]);
    const skala = 88 / (r.maks || 1);
    const batang = el('div', { display: 'flex', alignItems: 'flex-end', gap: '4px', height: '170px', borderBottom: `2px solid ${HITAM}` }, baris.map((x) => el('div', {
      flex: '1 1 0', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', minWidth: '0',
    }, [
      el('span', { fontSize: '8px', fontWeight: '700', color: '#1e293b', marginBottom: '2px' }, ha(totalTahun(x))),
      el('div', { width: '60%', height: `${x.hutan * skala}%`, background: '#065f46', border: `1px solid ${HITAM}` }),
      el('div', { width: '60%', height: `${x.apl * skala}%`, background: '#16a34a', border: `1px solid ${HITAM}`, borderTop: '0' }),
    ])));
    const tahun = el('div', { display: 'flex', gap: '4px', marginTop: '3px' }, baris.map((x) => el('span', { flex: '1 1 0', textAlign: 'center', fontFamily: JUDUL_PIKSEL, fontSize: '6px', color: '#334155' }, String(x.tahun))));
    isi.push(stat, legenda, batang, tahun);
  }
  if (b.tampil !== 'tahun' && baris.length) {
    const panel = (judul: string, data2: [string, number][], warna: string, warnaJudul: string) => {
      const maks = Math.max(...data2.map(([, n]) => n), 0.001);
      return kotak([
        el('div', { fontFamily: JUDUL_PIKSEL, fontSize: '9px', color: warnaJudul, marginBottom: '6px' }, judul),
        ...data2.map(([nama, n]) => el('div', { display: 'flex', alignItems: 'center', gap: '6px', margin: '3px 0' }, [
          el('span', { width: '92px', flex: '0 0 auto', fontSize: '10px', fontWeight: '700', color: '#1e293b' }, nama),
          el('div', { height: '11px', width: `${Math.max(0, (n / maks) * 60)}%`, background: warna, border: `1px solid ${HITAM}` }),
          el('span', { fontSize: '9px', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }, `${ha(n)} ha`),
        ])),
      ], { padding: '8px', marginTop: '10px' });
    };
    if (b.tampil === 'kegiatan' || b.tampil === 'lengkap') isi.push(panel('PER JENIS KEGIATAN', kegiatanRevegetasi(baris), '#d97706', '#92400e'));
    if (b.tampil === 'blok' || b.tampil === 'lengkap') isi.push(panel('PER BLOK', r.perBlok.map((x) => [x.nama, x.luas] as [string, number]), '#0284c7', '#075985'));
  }
  if (data) isi.push(el('div', { fontSize: '9px', color: '#64748b', textAlign: 'right', marginTop: '6px' }, SUMBER_REVEGETASI(data.cadangan)));
  return el('div', { margin: '8px 0', background: '#f8fafc', border: `2px solid ${HITAM}`, boxShadow: `4px 4px 0 ${HITAM}`, padding: '10px', color: '#0f172a', fontFamily: BIASA }, isi);
}

/** Rumus (MathML dari KaTeX) sebagai elemen; KaTeX sudah dimuat sebelum poster disusun. */
function rumusEl(tex: string, blok: boolean, t: Tema): HTMLElement {
  const n = el(blok ? 'div' : 'span', blok ? { textAlign: 'center', margin: '8px 0', fontSize: '1.15em', color: t.teks } : { color: t.teks });
  const html = rumusHtml(tex, blok);
  if (html) n.innerHTML = html;
  else n.append(el('code', { fontFamily: 'ui-monospace, Menlo, monospace' }, tex));
  return n;
}

function chipSebaris(teks: string, warna: { garis: string; teks: string; latar: string }): HTMLElement {
  return el('span', {
    display: 'inline-block', padding: '0 6px', margin: '0 1px', border: `1px solid ${warna.garis}`, color: warna.teks, background: warna.latar,
    fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', lineHeight: '1.5',
  }, teks);
}

/** Isi satu baris (sama dengan TeksInline di aplikasi). */
function sebaris(teks: string, k: Ktx, selesai = false): Node[] {
  return potongan(uraiInline(teks), k, selesai);
}

function potongan(daftar: Inline[], k: Ktx, selesai: boolean): Node[] {
  const { t } = k;
  return daftar.map((x): Node => {
    switch (x.t) {
      case 'teks': return document.createTextNode(x.v);
      case 'baris': return document.createElement('br');
      case 'garisbawah': return el('u', {}, x.v);
      case 'warna': {
        const w = gayaWarna(x.jenis, x.warna, t.gelap);
        return el('span', { ...(w.color ? { color: w.color } : {}), ...(w.background ? { background: w.background, padding: '0 2px' } : {}) }, potongan(x.isi, k, selesai));
      }
      case 'rumus': return rumusEl(x.v, false, t);
      case 'tebal': return el('b', { color: t.teksTebal, fontWeight: '700' }, x.v);
      case 'miring': return el('i', {}, x.v);
      case 'coret': return el('s', { color: t.redup }, x.v);
      case 'kode': return el('code', { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.92em', padding: '0 4px', background: t.latarKode, border: `1px solid ${t.garis}`, color: t.gelap ? '#d9f99d' : t.teks }, x.v);
      case 'tautan': return el('span', { color: t.tautan, textDecoration: 'underline' }, x.v);
      case 'berkas': return chipSebaris(`📎 ${x.v}`, { garis: t.garis, teks: t.teks, latar: 'transparent' });
      case 'tenggat': {
        const sisa = W.selisihHari(x.tanggal, k.hariIni);
        const w = t.gelap ? warnaTenggat(sisa, selesai)
          : selesai ? { garis: t.garis, teks: t.redup, latar: 'transparent' }
            : sisa < 0 ? { garis: '#dc2626', teks: '#b91c1c', latar: '#fef2f2' }
              : sisa === 0 ? { garis: '#d97706', teks: '#92400e', latar: '#fffbeb' }
                : { garis: '#0284c7', teks: '#075985', latar: '#f0f9ff' };
        return chipSebaris(`📅 ${W.formatPendek(x.tanggal)}${x.jam ? ` ${x.jam}` : ''}`, w);
      }
      case 'orang': {
        const nama = k.nama.get(x.id);
        if (!nama) return document.createTextNode(`@${x.id}`);
        return chipSebaris(`@${nama.split(' ')[0]}`, t.gelap
          ? { garis: 'rgba(132,204,22,.5)', teks: '#d9f99d', latar: 'rgba(26,46,5,.3)' }
          : { garis: '#65a30d', teks: '#3f6212', latar: '#f7fee7' });
      }
      case 'pica': return chipSebaris(x.id, t.gelap
        ? { garis: 'rgba(251,191,36,.6)', teks: '#fde68a', latar: 'rgba(69,26,3,.3)' }
        : { garis: '#d97706', teks: '#92400e', latar: '#fffbeb' });
      case 'halaman': return chipSebaris(`📄 ${x.v.trim() || 'Tanpa judul'}`, { garis: t.garis, teks: t.teks, latar: 'transparent' });
    }
    return document.createTextNode('');
  });
}

/** Satu blok (seperti IsiMemo di aplikasi); toggle tampil terbuka supaya isinya ikut tercetak. */
function satuBlok(b: Blok, k: Ktx): HTMLElement {
  const { t } = k;
  switch (b.jenis) {
    case 'judul': {
      const ukuran = ['28px', '22px', '18.5px', '16px'][b.tingkat - 1];
      return el('div', {
        fontSize: ukuran, fontWeight: '700', lineHeight: '1.3', color: b.tingkat === 1 ? t.aksen : t.judul,
        margin: b.tingkat === 1 ? '18px 0 2px' : b.tingkat === 2 ? '14px 0 0' : '8px 0 0', padding: '3px 0',
      }, sebaris(b.teks, k));
    }
    case 'toggle':
      return el('div', { display: 'flex', gap: '6px', padding: '3px 0' }, [el('span', { color: t.redup, flex: '0 0 auto' }, '▾'), el('span', {}, sebaris(b.teks, k))]);
    case 'ceklis': {
      const kotak = el('span', {
        flex: '0 0 auto', width: '14px', height: '14px', marginTop: '5px', boxSizing: 'border-box',
        border: `2px solid ${b.selesai ? t.aksen : t.redup}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }, b.selesai ? [el('span', { width: '6px', height: '6px', background: t.aksen })] : []);
      return el('div', { display: 'flex', gap: '8px', padding: '2px 0' }, [
        kotak,
        el('span', { color: b.selesai ? t.redup : t.teks, textDecoration: b.selesai ? 'line-through' : 'none' }, sebaris(b.teks, k, b.selesai)),
      ]);
    }
    case 'butir':
      return el('div', { display: 'flex', gap: '8px' }, [
        el('span', { flex: '0 0 auto', width: '6px', height: '6px', marginTop: '9px', marginLeft: '4px', background: t.retro ? t.aksen : t.teks }),
        el('span', {}, sebaris(b.teks, k)),
      ]);
    case 'nomor':
      return el('div', { paddingLeft: '10px' }, [el('span', { color: t.redup, marginRight: '4px' }, `${b.no}.`), ...sebaris(b.teks, k)]);
    case 'kutipan':
      return el('div', { borderLeft: `4px solid ${t.aksen}`, paddingLeft: '12px', margin: '2px 0', fontStyle: 'italic', color: t.redup }, sebaris(b.teks, k));
    case 'penting':
      return el('div', {
        display: 'flex', gap: '8px', margin: '4px 0', padding: '8px 12px',
        border: `2px solid ${t.gelap ? 'rgba(251,191,36,.7)' : '#f59e0b'}`, background: t.gelap ? 'rgba(69,26,3,.3)' : '#fffbeb',
      }, [el('span', { color: t.gelap ? '#fcd34d' : '#b45309', fontWeight: '700', flex: '0 0 auto' }, 'ⓘ'), el('span', {}, sebaris(b.teks, k))]);
    case 'garis':
      return el('div', { borderTop: `2px dashed ${t.garis}`, margin: '8px 0' });
    case 'gambar': {
      const src = k.gambar.get(b.kunci);
      const isi: HTMLElement[] = [];
      if (src) {
        const g = document.createElement('img');
        g.src = src;
        g.alt = b.nama;
        Object.assign(g.style, { display: 'block', width: b.lebar ? '100%' : 'auto', maxWidth: '100%', height: 'auto', border: `2px solid ${t.garis}` });
        isi.push(g);
      } else {
        isi.push(el('div', { padding: '16px', border: `2px dashed ${t.garis}`, color: t.redup, fontSize: '12px', textAlign: 'center' }, `Gambar tidak dapat dimuat: ${b.nama}`));
      }
      const rata = b.rata === 'tengah' ? 'center' : b.rata === 'kanan' ? 'right' : 'left';
      if (b.nama && b.nama !== 'foto') isi.push(el('div', { fontSize: '11px', color: t.redup, marginTop: '2px', textAlign: rata }, b.nama));
      // Lebar & perataan sama dengan halaman memo.
      return el('div', {
        margin: '6px 0', width: b.lebar ? `${b.lebar}%` : 'auto', maxWidth: '100%',
        ...(b.rata === 'tengah' ? { marginLeft: 'auto', marginRight: 'auto' } : b.rata === 'kanan' ? { marginLeft: 'auto' } : {}),
      }, isi);
    }
    case 'kode': {
      // Dibungkus (bukan digulir) supaya baris panjang tidak terpotong di gambar.
      const pre = el('pre', {
        margin: '0', padding: '8px 10px', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px', lineHeight: '1.55',
        whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: t.gelap ? WARNA_KODE.teks.gelap : WARNA_KODE.teks.terang,
      }, sorotKode(b.isi, b.bahasa).map((x) => el('span', { color: t.gelap ? WARNA_KODE[x.t].gelap : WARNA_KODE[x.t].terang }, x.v)));
      return el('div', { margin: '6px 0', border: `2px solid ${t.garis}`, background: t.gelap ? 'rgba(0,0,0,.45)' : '#f4f4f5' }, [
        el('div', { padding: '2px 10px', fontSize: '11px', color: t.redup, borderBottom: `1px solid ${t.garis}` }, b.bahasa === 'teks' ? 'Kode' : b.bahasa.toUpperCase()),
        pre,
      ]);
    }
    case 'rumus':
      return rumusEl(b.isi, true, t);
    case 'daftarisi':
      return el('div', { margin: '6px 0', paddingLeft: '10px', borderLeft: `2px solid ${t.garis}` }, k.judul.length
        ? k.judul.map((j) => el('div', { paddingLeft: `${(j.tingkat - 1) * 16}px`, textDecoration: 'underline', color: t.teks }, j.teks || 'Tanpa judul'))
        : [el('div', { color: t.redup }, 'Daftar isi (belum ada judul)')]);
    case 'penanda': {
      return el('div', { margin: '6px 0', border: `2px solid ${t.garis}`, padding: '8px 10px' }, [
        el('div', { fontWeight: '700', color: t.judul }, b.judul || b.url),
        ...(b.ket ? [el('div', { fontSize: '12px', color: t.redup, marginTop: '2px' }, b.ket)] : []),
        el('div', { fontSize: '11px', color: t.tautan, marginTop: '4px', wordBreak: 'break-all' }, `🔗 ${b.situs ? `${b.situs} · ` : ''}${b.url}`),
      ]);
    }
    case 'kolom':
      return el('div', {});
    case 'grafik':
      return grafikEl(b, k);
    case 'video': {
      let situs = b.url;
      try { situs = new URL(b.url).hostname.replace(/^www\./, ''); } catch { /* biarkan alamat utuh */ }
      return el('div', { margin: '6px 0', border: `2px solid ${t.garis}`, padding: '8px 10px', display: 'flex', gap: '8px', alignItems: 'center' }, [
        el('span', { flex: '0 0 auto', width: '30px', height: '22px', background: '#dc2626', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }, '▶'),
        el('span', { flex: '1 1 auto', minWidth: '0' }, [
          el('div', { fontWeight: '700', color: t.judul }, b.judul || 'Video'),
          el('div', { fontSize: '11px', color: t.redup, wordBreak: 'break-all' }, `${situs} · ${b.url}`),
        ]),
      ]);
    }
    case 'tabel': {
      // Tabel asli dengan lebar penuh: kolom menyesuaikan dan teks panjang dibungkus, tidak terpotong.
      const tabel = el('table', { width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' });
      // Kolom status: lencana berwarna sama dengan aplikasi & grafik (label baku untuk tabel PICA).
      const kolomStatus = kolomStatusTabel(b.baris, b.kepala);
      const pendek = kolomPendek(b.baris, k.ukuran === 'komputer' ? 12 : 4);
      // Gambar HP sempit: tulisan lencana boleh turun baris agar kolom uraian tidak terhimpit.
      const lencanaUtuh = k.ukuran === 'komputer' ? 'nowrap' : 'normal';
      // Habit: hari yang belum tiba ditulis "Belum waktunya", sama dengan aplikasi.
      const mendatang = b.grafik ? barisMendatang(b.baris, b.kepala, b.grafik) : new Set<number>();
      b.baris.forEach((r, i) => {
        const tr = document.createElement('tr');
        r.forEach((c, j) => {
          const judul = b.kepala && i === 0;
          const st = !judul && j === kolomStatus ? statusBaku(c) : null;
          const nanti = !judul && j === kolomStatus && mendatang.has(i) && st?.kunci !== 'selesai';
          const isi = nanti
            ? [el('span', { display: 'inline-block', padding: '1px 7px', border: `2px dashed ${t.redup}`, color: t.redup, fontWeight: '700', fontSize: '12px', whiteSpace: lencanaUtuh, wordBreak: 'normal', overflowWrap: 'normal' }, 'Belum waktunya')]
            : st
              ? [el('span', { display: 'inline-block', padding: '1px 7px', border: '2px solid #0f172a', background: st.warna, color: kontras(st.warna), fontWeight: '700', fontSize: '12px', whiteSpace: lencanaUtuh, wordBreak: 'normal', overflowWrap: 'normal' }, b.pica ? st.label : labelStatus(c))]
              : sebaris(c, k);
          tr.append(el(judul ? 'th' : 'td', {
            border: `1px solid ${t.garis}`, padding: '3px 6px', textAlign: 'left', verticalAlign: 'top',
            ...(pendek[j] ? { whiteSpace: 'nowrap' } : { wordBreak: 'break-word' }),
            fontWeight: judul ? '700' : '400', background: judul ? (t.gelap ? 'rgba(255,255,255,.07)' : '#f4f4f5') : 'transparent',
          }, isi));
        });
        tabel.append(tr);
      });
      const wadahTabel = el('div', { margin: '6px 0' }, [tabel]);
      // Grafik yang tersambung ke tabel: HTML yang sama dengan aplikasi & halaman bagikan.
      const dg = b.grafik?.aktif ? hitungGrafikTabel(b.baris, b.kepala, b.grafik, Boolean(b.pica)) : null;
      if (dg) {
        const kartu = document.createElement('div');
        // Grafik mengikuti gaya gambar: gelap di "Retro gelap", terang di "Retro terang" / "Resmi".
        kartu.setAttribute('style', cssTemaGrafik(t.gelap));
        kartu.innerHTML = htmlKartuGrafikTabel(dg);
        wadahTabel.append(kartu);
      }
      return wadahTabel;
    }
    case 'data': {
      const beku = b.beku;
      const r = beku?.ringkasan;
      const carb = beku?.karbon;
      const wadah = el('div', {
        margin: '8px 0', padding: '10px 12px', border: `2px solid ${t.garis}`,
        background: t.gelap ? 'rgba(255,255,255,.05)' : '#f8fafc',
      });
      const judul = b.sumber === 'nursery' ? '🌱 SMART NURSERY' : '📍 GEOTAGGING REKLAMASI';
      const statusBeku = beku ? ` [Beku: ${beku.pada}]` : ' [Data Lapangan]';
      const kepala = el('div', { fontWeight: '700', fontSize: '13px', color: b.sumber === 'nursery' ? '#a3e635' : '#38bdf8', marginBottom: '6px' }, `${judul}${statusBeku}`);
      wadah.append(kepala);

      if (r) {
        if (b.sumber === 'nursery') {
          const barisKpi = el('div', { fontSize: '12px', color: t.teks, lineHeight: '1.5' }, [
            el('div', { fontWeight: '700', fontSize: '15px' }, `Stok: ${(r.stok || 0).toLocaleString('id-ID')} btg · Mortalitas: ${r.mortalitas || 0}%`),
            el('div', { fontSize: '11px', color: t.redup }, `Hari ini: +${(r.masuk_hari_ini || 0).toLocaleString('id-ID')} masuk · -${(r.keluar_hari_ini || 0).toLocaleString('id-ID')} keluar · ${(r.mati_hari_ini || 0).toLocaleString('id-ID')} mati`),
          ]);
          wadah.append(barisKpi);
        } else {
          const barisKpi = el('div', { fontSize: '12px', color: t.teks, lineHeight: '1.5' }, [
            el('div', { fontWeight: '700', fontSize: '15px' }, `Total: ${(r.total || 0).toLocaleString('id-ID')} titik · Hidup: ${r.persen_hidup || 0}%`),
            el('div', { fontSize: '11px', color: t.redup }, `Tinggi rata-rata: ${r.tinggi_avg || 0} cm · Karbon: ${carb?.karbon_ton || 0} t C (≈ ${carb?.co2e_ton || 0} t CO₂e)`),
          ]);
          wadah.append(barisKpi);
        }
      } else {
        wadah.append(el('div', { fontSize: '12px', color: t.redup }, `Data ${b.sumber === 'nursery' ? 'Smart Nursery' : 'Geotagging'} terhubung.`));
      }
      return wadah;
    }
    case 'berkas':
      return el('div', { margin: '4px 0' }, [chipSebaris(`📎 ${b.nama}`, { garis: t.garis, teks: t.teks, latar: 'transparent' })]);
    case 'kosong':
      return el('div', { height: '8px' });
    case 'formulir':
      return el('div', { margin: '4px 0' }, [chipSebaris(`📋 Formulir: ${b.judul || 'Formulir'}`, { garis: t.garis, teks: t.teks, latar: 'transparent' })]);
    default:
      return el('div', { padding: '3px 0' }, sebaris(b.teks, k));
  }
}

function susunIsi(isi: string, k: Ktx): HTMLElement {
  const wadah = el('div', { fontFamily: k.t.hurufIsi, fontSize: '15px', lineHeight: '1.6', color: k.t.teks, overflowWrap: 'anywhere' });
  const daftar = uraiBlok(isi);
  // Blok [dari, sampai) relatif ke kedalaman `dasar`; kolom bersebelahan tampil berdampingan seperti di aplikasi.
  const susun = (dari: number, sampai: number, dasar: number, ke: HTMLElement) => {
    const akhirAnak = (j: number) => { let x = j + 1; while (x < sampai && daftar[x].kedalaman > daftar[j].kedalaman) x += 1; return x; };
    let i = dari;
    while (i < sampai) {
      const b = daftar[i];
      if (b.jenis === 'kolom') {
        const baris = el('div', { display: 'flex', gap: '16px', margin: '4px 0' });
        if (b.kedalaman > dasar) baris.style.marginLeft = `${(b.kedalaman - dasar) * 22}px`;
        let j = i;
        while (j < sampai && daftar[j].jenis === 'kolom' && daftar[j].kedalaman === b.kedalaman) {
          const z = akhirAnak(j);
          const kolom = el('div', { flex: '1 1 0', minWidth: '0' });
          susun(j + 1, z, b.kedalaman + 1, kolom);
          baris.append(kolom);
          j = z;
        }
        ke.append(baris);
        i = j;
        continue;
      }
      const n = satuBlok(b, k);
      // Anak digeser ke kanan seperti di aplikasi (1,5em per tingkat).
      if (b.kedalaman > dasar) n.style.marginLeft = `${(b.kedalaman - dasar) * 22}px`;
      ke.append(n);
      i += 1;
    }
  };
  susun(0, daftar.length, 0, wadah);
  if (!isi.trim()) wadah.append(el('div', { color: k.t.redup, fontStyle: 'italic' }, 'Belum ada isi.'));
  return wadah;
}

function chip(c: Chip, t: Tema, bertitik: boolean): HTMLElement {
  const w = hex(c.warna);
  return el('span', {
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 9px', fontFamily: t.hurufIsi, fontSize: '12px', fontWeight: '700',
    color: t.judul, background: `${w}${t.alfaChip}`, border: `2px solid ${w}`, borderRadius: t.retro ? '0' : '999px', whiteSpace: 'nowrap',
  }, [...(bertitik ? [el('span', { width: '8px', height: '8px', background: w, borderRadius: t.retro ? '0' : '50%' })] : []), c.label]);
}

/** Sampul utuh selebar kertas (gambar tidak dipotong); sampul warna = pita gradasi. */
function susunSampul(d: DataGambarMemo, k: Ktx): HTMLElement | null {
  const s = bacaSampul(d.sampul);
  if (s.jenis === 'warna') {
    const pita = el('div', { height: '110px' });
    pita.style.cssText += `;${CSS_SAMPUL_WARNA[s.kode] ?? ''}`;
    return pita;
  }
  const src = s.jenis === 'gambar' ? (k.gambar.get(s.gambar.src) ?? s.gambar.src) : s.jenis === 'unggahan' ? k.gambar.get(s.kunci) : undefined;
  if (!src) return null;
  const g = document.createElement('img');
  g.src = src;
  g.alt = '';
  Object.assign(g.style, { display: 'block', width: '100%', height: 'auto' });
  const utuh = s.jenis === 'gambar' && s.gambar.muat === 'utuh';
  return el('div', { background: utuh ? '#ffffff' : 'transparent', borderBottom: `${k.t.retro ? 4 : 1}px solid ${k.t.bingkai}` }, [g]);
}

function susunPoster(d: DataGambarMemo, gaya: GayaGambarMemo, k: Ktx): HTMLElement {
  const { t } = k;
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
    logo.src = k.gambar.get('__logo_hasnur__') ?? logoHasnur;
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

  // ---- ikon & judul (ikon menumpang di tepi bawah sampul, seperti di halaman memo)
  const sampul = susunSampul(d, k);
  const pc = k.ukuran === 'komputer';
  const badan = el('div', { padding: pc ? '30px 44px' : t.retro ? '18px' : '22px', display: 'flex', flexDirection: 'column', gap: pc ? '18px' : '14px', overflowWrap: 'anywhere' });
  if (d.ikon) badan.append(el('div', { fontSize: pc ? '64px' : '52px', lineHeight: '1', marginTop: sampul ? (pc ? '-56px' : '-44px') : '0' }, d.ikon));
  badan.append(el('div', { fontFamily: t.hurufIsi, fontSize: pc ? '34px' : '25px', fontWeight: '700', lineHeight: '1.25', color: t.judul, wordBreak: 'break-word', marginTop: d.ikon ? '-6px' : '0' }, d.judul.trim() || 'Tanpa judul'));

  // ---- properti: chip kategori/tipe/status, lalu baris "Nama  Nilai" seperti di halaman
  const chips = [d.kategori && chip(d.kategori, t, true), d.tipe && chip(d.tipe, t, false), d.status && chip(d.status, t, true)]
    .filter((x): x is HTMLElement => Boolean(x));
  if (chips.length) badan.append(el('div', { display: 'flex', flexWrap: 'wrap', gap: '6px' }, chips));
  const { selesai, total } = hitungTugas(d.isi);
  const baris: [string, string][] = [
    ...(d.tanggal ? [['Tanggal', d.tanggal] as [string, string]] : []),
    ...(d.penulis ? [['Penulis', d.penulis] as [string, string]] : []),
    ...(total ? [['Tugas', `${selesai} dari ${total} selesai`] as [string, string]] : []),
    ...(d.properti ?? []).filter((p) => p.nilai.trim()).map((p) => [p.label, p.nilai] as [string, string]),
  ];
  if (baris.length) {
    badan.append(el('div', { display: 'grid', gridTemplateColumns: pc ? '160px 1fr' : 'max-content 1fr', gap: pc ? '6px 24px' : '3px 16px', fontFamily: t.hurufIsi, fontSize: pc ? '14px' : '13px' },
      baris.flatMap(([a, b]) => [el('span', { color: t.redup }, a), el('span', { color: t.teks, fontWeight: '700', wordBreak: 'break-word' }, b)])));
  }

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
  badan.append(el('div', { borderTop: t.retro ? `2px dashed ${t.garis}` : `1px solid ${t.garis}`, paddingTop: '12px' }, [susunIsi(d.isi, k)]));

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
  }, [kepala, ...(sampul ? [sampul] : []), badan, kaki]);

  return el('div', { width: `${LEBAR_UKURAN[k.ukuran]}px`, boxSizing: 'border-box', padding: t.retro ? '18px 26px 26px 18px' : '20px', background: t.luar }, [kertas]);
}

const namaBerkas = (judul: string) => (judul.trim() || 'memo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'memo';

function blobKeDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function fetchKeDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const b = await res.blob();
    return await blobKeDataUrl(b);
  } catch {
    return null;
  }
}

async function muatSatuGambar(kunci: string): Promise<string | null> {
  if (kunci.startsWith('data:')) return kunci;
  try {
    const b = await ambilBerkas(kunci);
    return await blobKeDataUrl(b);
  } catch {
    const jalurStatis = kunci.startsWith('/') ? kunci : kunci.startsWith('memo/') ? `/panduan/${kunci.split('/').pop()}` : null;
    if (jalurStatis) {
      const d = await fetchKeDataUrl(jalurStatis);
      if (d) return d;
    }
    try {
      const u = await urlFoto(kunci);
      if (u) {
        const res = await fetch(u);
        if (res.ok) return await blobKeDataUrl(await res.blob());
      }
    } catch { /* abaikan */ }
    return null;
  }
}

/** Gambar memo (blok gambar dan sampul unggahan) diambil dan dikonversi ke Base64 Data URL, supaya kanvas tidak tertahan CORS atau kegagalan fetch. */
async function muatGambar(d: DataGambarMemo): Promise<Map<string, string>> {
  const kunci = uraiBlok(d.isi).flatMap((b) => (b.jenis === 'gambar' ? [b.kunci] : []));
  const s = bacaSampul(d.sampul);
  if (s.jenis === 'unggahan') kunci.push(s.kunci);
  const hasil = new Map<string, string>();

  // Muat logo Hasnur
  try {
    const logoData = await fetchKeDataUrl(logoHasnur);
    if (logoData) hasil.set('__logo_hasnur__', logoData);
  } catch { /* abaikan */ }

  // Muat sampul gambar galeri/resmi jika ada
  if (s.jenis === 'gambar') {
    const dUrl = await fetchKeDataUrl(s.gambar.src);
    if (dUrl) hasil.set(s.gambar.src, dUrl);
  }

  await Promise.all([...new Set(kunci)].map(async (k) => {
    const u = await muatSatuGambar(k);
    if (u) hasil.set(k, u);
  }));

  return hasil;
}

/** Susun poster di luar layar lalu potret jadi PNG. */
export async function buatGambarMemo(d: DataGambarMemo, gaya: GayaGambarMemo, ukuran: UkuranGambarMemo = 'hp'): Promise<{ blob: Blob; nama: string }> {
  const { toCanvas } = await import('html-to-image');
  if (/\$\$|!rumus\{/.test(d.isi)) await muatKatex();
  const k: Ktx = {
    t: TEMA[gaya], ukuran, gambar: await muatGambar(d), nama: new Map((d.tim ?? []).map((a) => [a.id, a.nama])), hariIni: W.hariIniWita(),
    judul: daftarJudul(d.isi),
    revegetasi: /!grafik\{/.test(d.isi) ? await muatRevegetasi() : undefined,
  };
  // Yang dipotret hanya posternya, bukan pembungkus yang digeser keluar layar.
  const pembungkus = el('div', { position: 'fixed', left: '-20000px', top: '0', pointerEvents: 'none' });
  const poster = susunPoster(d, gaya, k);
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
    // 2× supaya tajam; memo sangat panjang diturunkan agar kanvas tidak melebihi batas memori
    // (WebView HP lebih ketat; peramban komputer longgar tetapi tinggi kanvas dibatasi ±16.000 px).
    const rasio = ukuran === 'komputer'
      ? (w * h * 4 <= 48_000_000 && h * 2 <= 16_000 ? 2 : 1)
      : (w * h * 4 <= 16_000_000 ? 2 : 1);
    const kanvas = await toCanvas(poster, {
      width: w,
      height: h,
      pixelRatio: rasio,
      backgroundColor: TEMA[gaya].luar,
      cacheBust: false,
      onImageErrorHandler: () => '',
    });
    const blob = await new Promise<Blob>((ok, gagal) => kanvas.toBlob((b) => (b ? ok(b) : gagal(new Error('Gambar gagal dibuat'))), 'image/png'));
    return { blob, nama: `memo-${namaBerkas(d.judul)}-${gaya}${ukuran === 'komputer' ? '-lebar' : ''}.png` };
  } finally {
    pembungkus.remove();
  }
}

export async function unduhGambarMemo(d: DataGambarMemo, gaya: GayaGambarMemo, ukuran: UkuranGambarMemo = 'hp'): Promise<'dibagikan' | 'diunduh'> {
  const { blob, nama } = await buatGambarMemo(d, gaya, ukuran);
  return simpanBerkas(blob, nama, d.judul || 'Memo');
}

/** Bagikan langsung lewat lembar bagikan (pilih WhatsApp); bila perangkat tidak mendukung, gambar diunduh. */
export async function bagikanGambarMemo(d: DataGambarMemo, gaya: GayaGambarMemo): Promise<'dibagikan' | 'diunduh' | 'dibatalkan'> {
  const { blob, nama } = await buatGambarMemo(d, gaya);
  const judul = d.judul.trim() || 'Memo';
  return bagikanBerkas(blob, nama, judul, `${d.jenis ?? 'Memo Internal'}: ${judul}`);
}
