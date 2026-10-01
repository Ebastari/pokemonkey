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

import { hitungTugas, uraiBlok, uraiInline, type Blok } from '../server/src/memo-blok';
import { CSS_SAMPUL_WARNA, warnaTenggat } from '../server/src/tampil-memo';
import { bacaSampul } from './sampul';
import { urlFoto } from './foto';
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

const LEBAR = 540; // px CSS; dipotret 2× → 1080 px, tajam di layar HP
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
interface Ktx { t: Tema; gambar: Map<string, string>; nama: Map<string, string>; hariIni: string }

function chipSebaris(teks: string, warna: { garis: string; teks: string; latar: string }): HTMLElement {
  return el('span', {
    display: 'inline-block', padding: '0 6px', margin: '0 1px', border: `1px solid ${warna.garis}`, color: warna.teks, background: warna.latar,
    fontSize: '12px', fontWeight: '700', whiteSpace: 'nowrap', lineHeight: '1.5',
  }, teks);
}

/** Isi satu baris (sama dengan TeksInline di aplikasi). */
function sebaris(teks: string, k: Ktx, selesai = false): Node[] {
  const { t } = k;
  return uraiInline(teks).map((x): Node => {
    switch (x.t) {
      case 'teks': return document.createTextNode(x.v);
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
        Object.assign(g.style, { display: 'block', maxWidth: '100%', height: 'auto', border: `2px solid ${t.garis}` });
        isi.push(g);
      } else {
        isi.push(el('div', { padding: '16px', border: `2px dashed ${t.garis}`, color: t.redup, fontSize: '12px', textAlign: 'center' }, `Gambar tidak dapat dimuat: ${b.nama}`));
      }
      if (b.nama && b.nama !== 'foto') isi.push(el('div', { fontSize: '11px', color: t.redup, marginTop: '2px' }, b.nama));
      return el('div', { margin: '6px 0' }, isi);
    }
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
      b.baris.forEach((r, i) => {
        const tr = document.createElement('tr');
        r.forEach((c) => tr.append(el(b.kepala && i === 0 ? 'th' : 'td', {
          border: `1px solid ${t.garis}`, padding: '3px 6px', textAlign: 'left', verticalAlign: 'top', wordBreak: 'break-word',
          fontWeight: b.kepala && i === 0 ? '700' : '400', background: b.kepala && i === 0 ? (t.gelap ? 'rgba(255,255,255,.07)' : '#f4f4f5') : 'transparent',
        }, sebaris(c, k))));
        tabel.append(tr);
      });
      return el('div', { margin: '6px 0' }, [tabel]);
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
    default:
      return el('div', { padding: '3px 0' }, sebaris(b.teks, k));
  }
}

function susunIsi(isi: string, k: Ktx): HTMLElement {
  const wadah = el('div', { fontFamily: k.t.hurufIsi, fontSize: '15px', lineHeight: '1.6', color: k.t.teks, overflowWrap: 'anywhere' });
  for (const b of uraiBlok(isi)) {
    const n = satuBlok(b, k);
    // Anak digeser ke kanan seperti di aplikasi (1,5em per tingkat).
    if (b.kedalaman) n.style.marginLeft = `${b.kedalaman * 22}px`;
    wadah.append(n);
  }
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
  const src = s.jenis === 'gambar' ? s.gambar.src : s.jenis === 'unggahan' ? k.gambar.get(s.kunci) : undefined;
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

  // ---- ikon & judul (ikon menumpang di tepi bawah sampul, seperti di halaman memo)
  const sampul = susunSampul(d, k);
  const badan = el('div', { padding: t.retro ? '18px' : '22px', display: 'flex', flexDirection: 'column', gap: '14px', overflowWrap: 'anywhere' });
  if (d.ikon) badan.append(el('div', { fontSize: '52px', lineHeight: '1', marginTop: sampul ? '-44px' : '0' }, d.ikon));
  badan.append(el('div', { fontFamily: t.hurufIsi, fontSize: '25px', fontWeight: '700', lineHeight: '1.25', color: t.judul, wordBreak: 'break-word', marginTop: d.ikon ? '-6px' : '0' }, d.judul.trim() || 'Tanpa judul'));

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
    badan.append(el('div', { display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '3px 16px', fontFamily: t.hurufIsi, fontSize: '13px' },
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

  return el('div', { width: `${LEBAR}px`, boxSizing: 'border-box', padding: t.retro ? '18px 26px 26px 18px' : '20px', background: t.luar }, [kertas]);
}

const namaBerkas = (judul: string) => (judul.trim() || 'memo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'memo';

/** Gambar memo (blok gambar dan sampul unggahan) diambil dulu, supaya ikut terpotret. */
async function muatGambar(d: DataGambarMemo): Promise<Map<string, string>> {
  const kunci = uraiBlok(d.isi).flatMap((b) => (b.jenis === 'gambar' ? [b.kunci] : []));
  const s = bacaSampul(d.sampul);
  if (s.jenis === 'unggahan') kunci.push(s.kunci);
  const hasil = new Map<string, string>();
  await Promise.all([...new Set(kunci)].map(async (k) => { const u = await urlFoto(k); if (u) hasil.set(k, u); }));
  return hasil;
}

/** Susun poster di luar layar lalu potret jadi PNG. */
export async function buatGambarMemo(d: DataGambarMemo, gaya: GayaGambarMemo): Promise<{ blob: Blob; nama: string }> {
  const { toCanvas } = await import('html-to-image');
  const k: Ktx = {
    t: TEMA[gaya], gambar: await muatGambar(d), nama: new Map((d.tim ?? []).map((a) => [a.id, a.nama])), hariIni: W.hariIniWita(),
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
