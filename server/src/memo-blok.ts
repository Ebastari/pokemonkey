/**
 * Penguraian teks memo — murni (tanpa akses tabel), dipakai penampil memo,
 * poster gambar, server (menyusun Jadwal dari ceklis bertenggat), dan mode demo.
 *
 * Isi memo tetap teks biasa, satu blok per baris:
 *   # Judul 1   ## Judul 2   ### Judul 3   #### Judul 4
 *   - berpoin   1. bernomor   - [ ] tugas   - [x] selesai
 *   > kutipan   >> toggle   !! callout   ---
 *   ![nama](kunci)              gambar
 *   !video[judul](https://…)    video (tautan, mis. YouTube)
 *   !tabel{"kepala":true,"baris":[["A","B"],["1","2"]]}   tabel (satu baris, isi sel teks biasa)
 *   [nama](memo/…)              berkas
 *   ![nama](kunci){"lebar":60,"rata":"tengah"}   gambar berukuran (lebar % & perataan, opsional)
 *   !kode{"bahasa":"js","isi":"…"}   blok kode (banyak baris di dalam JSON)
 *   !rumus{"isi":"E = mc^2"}         rumus (LaTeX)
 *   !daftarisi                      daftar isi otomatis dari judul
 *   !kolom                          satu kolom; kolom bersebelahan = tata letak kolom (isinya = anak)
 *   !penanda{"url":"…","judul":"…","ket":"…","situs":"…"}   kartu tautan web
 *   !grafik{"sumber":"reklamasi","tampil":"tahun"}   grafik realisasi reklamasi (gaya Monkey Point; tampil: tahun|kegiatan|blok|lengkap)
 *   !formulir{"id":"frm_…","judul":"…"}   formulir (pertanyaan & jawaban di server: server/src/formulir.ts)
 * Tabel boleh membawa tipe kolom & baris hitung:
 *   !tabel{"kepala":true,"baris":[…],"kolom":[{"t":"ceklis"},{"t":"rupiah"},{"t":"rumus","rumus":"[A]*[B]"}],"hitung":[null,"jumlah"]}
 * Di dalam baris:
 *   **tebal**  *miring*  ~~coret~~  ++garis bawah++  `kode`  [teks](https://…)
 *   {w:merah|teks}  warna teks   {l:kuning|teks}  stabilo/latar   $$x^2$$  rumus sebaris   <br>  baris baru di dalam blok
 *   @2026-10-05  atau  @2026-10-05 14:00   tenggat
 *   @id                                    orang (id anggota tim; tanda hubung boleh di tengah)
 *   #PICA-26W36-07                         tautan ke PICA
 *   [[memo:<id>|Judul]]                    tautan ke halaman (memo lain)
 *
 * Satu blok = satu baris, jadi nomor baris selalu sama dengan teks aslinya
 * dan kotak centang cukup mengganti baris itu.
 *
 * Bersarang (seperti Notion: blok punya anak): baris yang diawali 2 spasi per
 * tingkat adalah anak dari blok di atasnya. Anak toggle tersembunyi saat dilipat.
 *   >> Detail perawatan
 *     - [ ] Ganti oli @2026-10-02
 *       Catatan untuk tugas di atas
 */

import { adaWarna } from './tampil-memo';

export interface InfoBekuData {
  pada: string;
  ringkasan: Record<string, any>;
  karbon?: Record<string, any>;
}

export interface BlokData {
  jenis: 'data';
  sumber: 'nursery' | 'geotag';
  saring: Record<string, string>;
  tampil: 'kpi' | 'jenis' | 'tujuan' | 'lokasi';
  beku?: InfoBekuData;
}

type BlokDasar =
  | { jenis: 'judul'; tingkat: 1 | 2 | 3 | 4; teks: string }
  | { jenis: 'toggle'; teks: string }
  | { jenis: 'ceklis'; selesai: boolean; teks: string }
  | { jenis: 'butir'; teks: string }
  | { jenis: 'nomor'; no: number; teks: string }
  | { jenis: 'kutipan'; teks: string }
  | { jenis: 'penting'; teks: string }
  | { jenis: 'garis' }
  | { jenis: 'gambar'; nama: string; kunci: string; lebar?: number; rata?: RataGambar }
  | { jenis: 'video'; judul: string; url: string }
  | { jenis: 'tabel'; baris: string[][]; kepala: boolean; grafik?: OpsiGrafikTabel; pica?: InfoPicaLive; kolom?: (KolomTabel | null)[]; hitung?: (FungsiHitung | null)[] }
  | { jenis: 'formulir'; id: string; judul: string }
  | { jenis: 'berkas'; nama: string; kunci: string }
  | BlokData
  | { jenis: 'kode'; bahasa: string; isi: string }
  | { jenis: 'rumus'; isi: string }
  | { jenis: 'daftarisi' }
  | { jenis: 'kolom' }
  | BlokPenanda
  | BlokGrafik
  | { jenis: 'kosong' }
  | { jenis: 'teks'; teks: string };

export type RataGambar = 'kiri' | 'tengah' | 'kanan';
export interface BlokPenanda { jenis: 'penanda'; url: string; judul: string; ket: string; situs: string }

/** Grafik data realisasi (sumber: tabel revegetasi). `dari`/`sampai` = rentang tahun (opsional). */
export type TampilGrafik = 'tahun' | 'kegiatan' | 'blok' | 'lengkap';
export interface BlokGrafik { jenis: 'grafik'; sumber: 'reklamasi'; tampil: TampilGrafik; dari?: number; sampai?: number }

/** Satu blok beserta kedalamannya (0 = paling luar; n = anak tingkat ke-n). */
export type Blok = BlokDasar & { kedalaman: number };

export type Inline =
  | { t: 'teks'; v: string }
  | { t: 'tebal'; v: string }
  | { t: 'miring'; v: string }
  | { t: 'coret'; v: string }
  | { t: 'kode'; v: string }
  | { t: 'tautan'; v: string; url: string }
  | { t: 'berkas'; v: string; kunci: string }
  | { t: 'tenggat'; tanggal: string; jam: string | null }
  | { t: 'orang'; id: string }
  | { t: 'pica'; id: string }
  | { t: 'halaman'; id: string; v: string }
  | { t: 'garisbawah'; v: string }
  /** Warna teks (w) atau stabilo/latar (l); isinya boleh berformat (tebal, tenggat, …). */
  | { t: 'warna'; jenis: 'w' | 'l'; warna: string; isi: Inline[] }
  | { t: 'rumus'; v: string }
  /** Baris baru di dalam satu blok (Shift+Enter). */
  | { t: 'baris' };

/** Ceklis tanpa indentasi (setelah pisahIndent). */
const POLA_CEKLIS = /^- \[([ xX])\] ?(.*)$/;

/** Indentasi satu tingkat sarang. */
export const INDENT = '  ';

/** Pisahkan indentasi (2 spasi per tingkat) dari isi baris. */
export function pisahIndent(baris: string): { kedalaman: number; isi: string } {
  const m = baris.match(/^((?: {2})*)/);
  const n = m ? m[1].length : 0;
  return { kedalaman: n / 2, isi: baris.slice(n) };
}

export function tanggalSah(s: string | null | undefined): s is string {
  if (!s) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

export function jamSah(s: string | null | undefined): s is string {
  return !!s && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Kunci berkas milik memo: R2 (`memo/…`) atau penyimpanan mode demo (`demo/…`). */
export const adaKunciBerkas = (k: string) => /^(memo|demo)\/[\w./-]+$/.test(k);

/** Batas tabel agar satu memo tetap ringan dan memuat tabel besar tanpa terpotong. */
export const MAKS_BARIS_TABEL = 100;
export const MAKS_KOLOM_TABEL = 25;

/** Pengaturan grafik dinamis yang terkoneksi pada tabel memo. */
export interface OpsiGrafikTabel {
  aktif: boolean;
  /** 'progres' = kurva progres harian (ceklis + kumulatif vs target), mis. habit 1 bulan. */
  tipe: 'batang' | 'garis' | 'pie' | 'progres';
  sumbuX?: number;
  seriY?: number[];
  judul?: string;
  /** Mode hitung: 'nilai' (angka sel langsung) atau 'hitung' (hitung frekuensi / jumlah data / pivot rekap) */
  mode?: 'nilai' | 'hitung';
  /** Kolom kedua untuk pengelompokan (breakdown) pada mode hitung (misal: kolom Status saat sumbuX = PIC) */
  kolomPecah?: number;
  /** Tanggal mulai (YYYY-MM-DD) untuk grafik progres bila tabel tidak punya kolom tanggal. */
  mulai?: string;
  /** Tabel habit: hari yang belum tiba tidak bisa dicentang dan tidak dihitung. */
  habit?: boolean;
}

/**
 * Tipe kolom tabel (seperti properti database Notion). Tanpa tipe = teks biasa
 * (tabel lama tetap terbaca; kolom status masih terdeteksi otomatis).
 */
export type TipeKolom = 'teks' | 'angka' | 'rupiah' | 'persen' | 'ceklis' | 'tanggal' | 'pilihan' | 'rumus';
export interface KolomTabel { t: TipeKolom; rumus?: string; opsi?: string[] }
/** Baris hitung di bawah tabel (seperti "Calculate" di Notion). */
export type FungsiHitung = 'jumlah' | 'rata' | 'min' | 'maks' | 'median' | 'terisi' | 'kosong' | 'tercentang' | 'persen_centang';
const TIPE_KOLOM: TipeKolom[] = ['teks', 'angka', 'rupiah', 'persen', 'ceklis', 'tanggal', 'pilihan', 'rumus'];
const FUNGSI_HITUNG: FungsiHitung[] = ['jumlah', 'rata', 'min', 'maks', 'median', 'terisi', 'kosong', 'tercentang', 'persen_centang'];

function bersihKolom(v: unknown, lebar: number): (KolomTabel | null)[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const hasil = v.slice(0, lebar).map((k): KolomTabel | null => {
    if (!k || typeof k !== 'object') return null;
    const o = k as Record<string, unknown>;
    if (!TIPE_KOLOM.includes(o.t as TipeKolom) || o.t === 'teks') return null;
    return {
      t: o.t as TipeKolom,
      ...(o.t === 'rumus' && typeof o.rumus === 'string' ? { rumus: o.rumus.slice(0, 300) } : {}),
      ...(o.t === 'pilihan' && Array.isArray(o.opsi) ? { opsi: o.opsi.map((x) => String(x).slice(0, 40)).slice(0, 20) } : {}),
    };
  });
  return hasil.some(Boolean) ? hasil : undefined;
}
function bersihHitung(v: unknown, lebar: number): (FungsiHitung | null)[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const hasil = v.slice(0, lebar).map((x) => (FUNGSI_HITUNG.includes(x as FungsiHitung) ? (x as FungsiHitung) : null));
  return hasil.some(Boolean) ? hasil : undefined;
}

/** Pengaturan sinkronisasi tabel dinamis PICA di memo. */
export interface InfoPicaLive {
  /** Apakah mode live sync aktif (selalu update data terbaru) atau statis (ditetapkan) */
  aktif: boolean;
  /** Sumber filter: 'filter' (berdasarkan status PICA) atau 'pilihan' (daftar ID PICA tertentu) */
  mode: 'filter' | 'pilihan';
  filterStatus?: 'semua' | 'open' | 'continue' | 'selesai';
  picaIds?: string[];
  /** Label / catatan kapan ditetapkan (dibekukan sebagai statis) */
  ditetapkanPada?: string;
  /** Kapan terakhir disinkronkan dari database PICA */
  terakhirUpdate?: string;
}

/** Sel tabel: teks satu baris, tanpa ganti baris (maks 2000 karakter agar tidak terpotong). */
const bersihSel = (x: unknown) => String(x ?? '').replace(/[\r\n]+/g, ' ').slice(0, 2000);

/** Baca baris `!tabel{…}`; null bila rusak (baris itu lalu tampil sebagai teks biasa). */
export function bacaTabel(b: string): {
  jenis: 'tabel';
  baris: string[][];
  kepala: boolean;
  grafik?: OpsiGrafikTabel;
  pica?: InfoPicaLive;
  kolom?: (KolomTabel | null)[];
  hitung?: (FungsiHitung | null)[];
} | null {
  try {
    const d = JSON.parse(b.slice('!tabel'.length)) as {
      baris?: unknown;
      kepala?: unknown;
      grafik?: unknown;
      pica?: unknown;
      kolom?: unknown;
      hitung?: unknown;
    };
    if (!Array.isArray(d.baris) || d.baris.length === 0) return null;
    const lebar = Math.min(MAKS_KOLOM_TABEL, Math.max(1, ...d.baris.map((r) => (Array.isArray(r) ? r.length : 0))));
    const baris = d.baris.slice(0, MAKS_BARIS_TABEL).map((r) => {
      const sel = Array.isArray(r) ? r.slice(0, lebar).map(bersihSel) : [];
      while (sel.length < lebar) sel.push('');
      return sel;
    });
    const grafik = d.grafik && typeof d.grafik === 'object' && (d.grafik as OpsiGrafikTabel).aktif ? (d.grafik as OpsiGrafikTabel) : undefined;
    const pica = d.pica && typeof d.pica === 'object' ? (d.pica as InfoPicaLive) : undefined;
    const kolom = bersihKolom(d.kolom, lebar);
    const hitung = bersihHitung(d.hitung, lebar);
    return { jenis: 'tabel', baris, kepala: d.kepala !== false, grafik, pica, ...(kolom ? { kolom } : {}), ...(hitung ? { hitung } : {}) };
  } catch {
    return null;
  }
}

/** Tulis tabel sebagai satu baris memo. */
export const rakitTabel = (
  baris: string[][],
  kepala: boolean,
  grafik?: OpsiGrafikTabel,
  pica?: InfoPicaLive,
  ext?: { kolom?: (KolomTabel | null)[]; hitung?: (FungsiHitung | null)[] },
): string => {
  const lebar = baris[0]?.length ?? 0;
  const kolom = bersihKolom(ext?.kolom, lebar);
  const hitung = bersihHitung(ext?.hitung, lebar);
  return `!tabel${JSON.stringify({
    kepala,
    baris: baris.map((r) => r.map(bersihSel)),
    ...(grafik?.aktif ? { grafik } : {}),
    ...(pica ? { pica } : {}),
    ...(kolom ? { kolom } : {}),
    ...(hitung ? { hitung } : {}),
  })}`;
};

/** Tulis blok formulir sebagai satu baris memo. */
export const rakitFormulir = (id: string, judul: string): string => `!formulir${JSON.stringify({ id, judul: judul.slice(0, 160) })}`;

/** Baca baris `!data{…}`; null bila rusak. */
export function bacaData(b: string): BlokData | null {
  if (!b.startsWith('!data{')) return null;
  try {
    const d = JSON.parse(b.slice('!data'.length)) as Partial<BlokData>;
    if (d && (d.sumber === 'nursery' || d.sumber === 'geotag')) {
      return {
        jenis: 'data',
        sumber: d.sumber,
        saring: typeof d.saring === 'object' && d.saring !== null ? (d.saring as Record<string, string>) : {},
        tampil: d.tampil || 'kpi',
        beku: d.beku,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Tulis blok data sebagai satu baris memo. */
export const rakitData = (d: Omit<BlokData, 'jenis'>): string =>
  `!data${JSON.stringify({
    sumber: d.sumber,
    saring: d.saring || {},
    tampil: d.tampil || 'kpi',
    ...(d.beku ? { beku: d.beku } : {}),
  })}`;

/** JSON setelah awalan (`!kode{…}`), atau null bila rusak. */
function jsonSetelah(b: string, awalan: string): Record<string, unknown> | null {
  if (!b.startsWith(`${awalan}{`)) return null;
  try {
    const d = JSON.parse(b.slice(awalan.length));
    return d && typeof d === 'object' && !Array.isArray(d) ? d as Record<string, unknown> : null;
  } catch { return null; }
}
const teksAman = (v: unknown, maks: number) => String(v ?? '').slice(0, maks);

export const MAKS_KODE = 20_000;
export const rakitKode = (bahasa: string, isi: string): string => `!kode${JSON.stringify({ bahasa: bahasa || 'teks', isi: isi.slice(0, MAKS_KODE) })}`;
export const rakitGrafik = (g: Omit<BlokGrafik, 'jenis'>): string =>
  `!grafik${JSON.stringify({ sumber: g.sumber, tampil: g.tampil, ...(g.dari ? { dari: g.dari } : {}), ...(g.sampai ? { sampai: g.sampai } : {}) })}`;
export const rakitRumus = (isi: string): string => `!rumus${JSON.stringify({ isi: isi.replace(/\n/g, ' ').slice(0, 2000) })}`;
export const rakitPenanda = (p: Omit<BlokPenanda, 'jenis'>): string =>
  `!penanda${JSON.stringify({ url: p.url, judul: p.judul.slice(0, 200), ket: p.ket.slice(0, 400), situs: p.situs.slice(0, 100) })}`;
/** Gambar dengan ukuran/perataan opsional (lebar 100 % dan rata kiri = bawaan, tidak ditulis). */
export function rakitGambar(nama: string, kunci: string, lebar?: number, rata?: RataGambar): string {
  const opsi: Record<string, unknown> = {};
  if (lebar && lebar < 100) opsi.lebar = Math.max(20, Math.round(lebar));
  if (rata && rata !== 'kiri') opsi.rata = rata;
  return `![${nama.replace(/[\]\n]/g, ' ')}](${kunci})${Object.keys(opsi).length ? JSON.stringify(opsi) : ''}`;
}

/** Blok satu baris berawalan "!" selain tabel/data (kode, rumus, daftar isi, kolom, penanda, gambar). */
function blokKhusus(b: string): BlokDasar | null {
  if (b === '!daftarisi') return { jenis: 'daftarisi' };
  if (b === '!kolom') return { jenis: 'kolom' };
  let d: Record<string, unknown> | null;
  if ((d = jsonSetelah(b, '!kode'))) return { jenis: 'kode', bahasa: teksAman(d.bahasa || 'teks', 20), isi: teksAman(d.isi, MAKS_KODE) };
  if ((d = jsonSetelah(b, '!rumus'))) return { jenis: 'rumus', isi: teksAman(d.isi, 2000) };
  if ((d = jsonSetelah(b, '!formulir')) && typeof d.id === 'string' && /^[\w-]{1,60}$/.test(d.id)) {
    return { jenis: 'formulir', id: d.id, judul: teksAman(d.judul, 160) };
  }
  if ((d = jsonSetelah(b, '!grafik')) && d.sumber === 'reklamasi') {
    const tampil = (['tahun', 'kegiatan', 'blok', 'lengkap'] as const).find((x) => x === d!.tampil) ?? 'tahun';
    const tahun = (v: unknown) => (Number.isInteger(v) && Number(v) >= 2000 && Number(v) <= 2100 ? Number(v) : undefined);
    return { jenis: 'grafik', sumber: 'reklamasi', tampil, dari: tahun(d.dari), sampai: tahun(d.sampai) };
  }
  if ((d = jsonSetelah(b, '!penanda')) && /^https?:\/\//.test(String(d.url ?? ''))) {
    return { jenis: 'penanda', url: teksAman(d.url, 2000), judul: teksAman(d.judul, 200), ket: teksAman(d.ket, 400), situs: teksAman(d.situs, 100) };
  }
  const m = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)(\{[^\n]*\})?\s*$/);
  if (m) {
    let opsi: Record<string, unknown> = {};
    try { opsi = m[3] ? JSON.parse(m[3]) as Record<string, unknown> : {}; } catch { /* abaikan opsi rusak */ }
    const lebar = Number(opsi.lebar);
    const rata = opsi.rata === 'tengah' || opsi.rata === 'kanan' ? opsi.rata : undefined;
    return { jenis: 'gambar', nama: m[1], kunci: m[2], ...(lebar >= 20 && lebar < 100 ? { lebar } : {}), ...(rata ? { rata } : {}) };
  }
  return null;
}

/** Judul-judul memo untuk daftar isi: nomor blok, tingkat, dan teks polosnya. */
export function daftarJudul(isi: string): { indeks: number; tingkat: number; teks: string }[] {
  return uraiBlok(isi).flatMap((b, indeks) => (b.jenis === 'judul' ? [{ indeks, tingkat: b.tingkat, teks: ringkasInline(b.teks) }] : []));
}

export function uraiBlok(isi: string): Blok[] {
  const hasil: Blok[] = [];
  // Nomor urut per kedalaman: daftar bernomor di dalam anak mulai lagi dari 1.
  const urut: number[] = [];
  for (const baris of isi.split('\n')) {
    const { kedalaman, isi: b } = pisahIndent(baris);
    let blok: BlokDasar;
    let m: RegExpMatchArray | null;
    let blokTabel: BlokDasar | null;
    let blokData: BlokDasar | null;
    let khusus: BlokDasar | null;
    if (b.startsWith('!') && (khusus = blokKhusus(b))) {
      blok = khusus;
    } else if ((m = b.match(/^(#{1,4}) (.*)$/))) {
      blok = { jenis: 'judul', tingkat: m[1].length as 1 | 2 | 3 | 4, teks: m[2] };
    } else if ((m = b.match(POLA_CEKLIS))) {
      blok = { jenis: 'ceklis', selesai: m[1] !== ' ', teks: m[2] };
    } else if (/^---+\s*$/.test(b)) {
      blok = { jenis: 'garis' };
    } else if (b.startsWith('!tabel{') && (blokTabel = bacaTabel(b))) {
      blok = blokTabel;
    } else if (b.startsWith('!data{') && (blokData = bacaData(b))) {
      blok = blokData;
    } else if ((m = b.match(/^!video\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\s*$/))) {
      blok = { jenis: 'video', judul: m[1], url: m[2] };
    } else if ((m = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
      blok = { jenis: 'gambar', nama: m[1], kunci: m[2] };
    } else if ((m = b.match(/^\[([^\]]+)\]\(((?:memo|demo)\/[^)\s]+)\)\s*$/))) {
      blok = { jenis: 'berkas', nama: m[1], kunci: m[2] };
    } else if (b.startsWith('- ')) {
      blok = { jenis: 'butir', teks: b.slice(2) };
    } else if ((m = b.match(/^(\d{1,3})\. (.*)$/))) {
      urut[kedalaman] = (urut[kedalaman] ?? 0) + 1;
      blok = { jenis: 'nomor', no: urut[kedalaman], teks: m[2] };
    } else if (b.startsWith('>> ')) {
      blok = { jenis: 'toggle', teks: b.slice(3) };
    } else if (b.startsWith('> ')) {
      blok = { jenis: 'kutipan', teks: b.slice(2) };
    } else if (b.startsWith('!! ')) {
      blok = { jenis: 'penting', teks: b.slice(3) };
    } else if (!b.trim()) {
      blok = { jenis: 'kosong' };
    } else {
      blok = { jenis: 'teks', teks: b };
    }
    if (blok.jenis !== 'nomor') urut[kedalaman] = 0;
    urut.length = kedalaman + 1; // anak yang lebih dalam mulai lagi
    hasil.push({ ...blok, kedalaman });
  }
  return hasil;
}

// Urutan alternatif menentukan prioritas pada indeks yang sama (** sebelum *).
const POLA_INLINE = new RegExp(
  [
    '\\[\\[memo:(?<halId>[\\w-]+)\\|(?<halJudul>[^\\]\\n]*)\\]\\]',
    // Warna dulu: isinya diurai lagi, jadi tebal/tenggat di dalam warna tetap terbaca.
    '\\{(?<wJenis>[wl]):(?<wNama>[a-z]+)\\|(?<wIsi>[^{}\\n]+)\\}',
    '`(?<kode>[^`\\n]+)`',
    '\\$\\$(?<rumus>[^$\\n]+)\\$\\$',
    '(?<baris><br>)',
    '\\*\\*(?<tebal>[^*\\n]+)\\*\\*',
    '~~(?<coret>[^~\\n]+)~~',
    '\\+\\+(?<garisbawah>[^+\\n]+)\\+\\+',
    '\\*(?=\\S)(?<miring>[^*\\n]*?\\S)\\*',
    '\\[(?<teksTaut>[^\\]\\n]+)\\]\\((?<url>https?:\\/\\/[^)\\s]+)\\)',
    '\\[(?<namaBerkas>[^\\]\\n]+)\\]\\((?<kunci>(?:memo|demo)\\/[^)\\s]+)\\)',
    '@(?<tgl>\\d{4}-\\d{2}-\\d{2})(?:[ T](?<jam>\\d{2}:\\d{2}))?',
    '@(?<orang>[a-z][a-z0-9_-]{0,29}[a-z0-9_])(?![\\w@-])',
    '#(?<pica>PICA-[0-9A-Za-z-]+)',
  ].join('|'),
  'g',
);

export function uraiInline(teks: string): Inline[] {
  const hasil: Inline[] = [];
  let akhir = 0;
  const tambahTeks = (v: string) => {
    if (!v) return;
    const l = hasil[hasil.length - 1];
    if (l && l.t === 'teks') l.v += v;
    else hasil.push({ t: 'teks', v });
  };

  for (const m of teks.matchAll(POLA_INLINE)) {
    const g = m.groups ?? {};
    const i = m.index ?? 0;
    tambahTeks(teks.slice(akhir, i));
    akhir = i + m[0].length;

    if (g.halId !== undefined) hasil.push({ t: 'halaman', id: g.halId, v: g.halJudul || 'Tanpa judul' });
    else if (g.wNama !== undefined) {
      const jenis = g.wJenis === 'l' ? 'l' : 'w';
      if (adaWarna(jenis, g.wNama)) hasil.push({ t: 'warna', jenis, warna: g.wNama, isi: uraiInline(g.wIsi) });
      else tambahTeks(m[0]);
    } else if (g.rumus !== undefined) hasil.push({ t: 'rumus', v: g.rumus });
    else if (g.baris !== undefined) hasil.push({ t: 'baris' });
    else if (g.garisbawah !== undefined) hasil.push({ t: 'garisbawah', v: g.garisbawah });
    else if (g.kode !== undefined) hasil.push({ t: 'kode', v: g.kode });
    else if (g.tebal !== undefined) hasil.push({ t: 'tebal', v: g.tebal });
    else if (g.coret !== undefined) hasil.push({ t: 'coret', v: g.coret });
    else if (g.miring !== undefined) hasil.push({ t: 'miring', v: g.miring });
    else if (g.url !== undefined) hasil.push({ t: 'tautan', v: g.teksTaut, url: g.url });
    else if (g.kunci !== undefined) hasil.push({ t: 'berkas', v: g.namaBerkas, kunci: g.kunci });
    else if (g.tgl !== undefined) {
      if (!tanggalSah(g.tgl)) tambahTeks(m[0]);
      else if (g.jam === undefined || jamSah(g.jam)) hasil.push({ t: 'tenggat', tanggal: g.tgl, jam: g.jam ?? null });
      else {
        // Tanggal benar, jam salah ketik: tanggalnya dipakai, sisanya tetap teks.
        hasil.push({ t: 'tenggat', tanggal: g.tgl, jam: null });
        akhir -= String(g.jam).length + 1;
      }
    } else if (g.orang !== undefined) {
      // "a@b.com" bukan sebutan orang: harus diawali spasi, kurung, atau awal baris.
      const sebelum = i > 0 ? teks[i - 1] : ' ';
      if (/[\s(]/.test(sebelum)) hasil.push({ t: 'orang', id: g.orang });
      else tambahTeks(m[0]);
    } else if (g.pica !== undefined) hasil.push({ t: 'pica', id: g.pica });
  }
  tambahTeks(teks.slice(akhir));
  return hasil;
}

// ---------------------------------------------------------------------------
// Tugas (ceklis)
// ---------------------------------------------------------------------------

export interface Tugas {
  /** Nomor baris di teks asli (mulai 0). */
  indeks: number;
  selesai: boolean;
  /** Teks tugas tanpa penanda tenggat dan sebutan orang. */
  judul: string;
  tanggal: string | null;
  jam: string | null;
  /** Id anggota yang disebut dengan @id (yang pertama). */
  pic: string | null;
}

export function ambilTugas(isi: string): Tugas[] {
  const hasil: Tugas[] = [];
  isi.split('\n').forEach((baris, indeks) => {
    const m = pisahIndent(baris).isi.match(POLA_CEKLIS);
    if (!m) return;
    let tanggal: string | null = null;
    let jam: string | null = null;
    let pic: string | null = null;
    const potong: string[] = [];
    for (const x of rataInline(uraiInline(m[2]))) {
      if (x.t === 'tenggat') { if (!tanggal) { tanggal = x.tanggal; jam = x.jam; } continue; }
      if (x.t === 'orang') { if (!pic) pic = x.id; continue; }
      if (x.t === 'teks' || x.t === 'tebal' || x.t === 'miring' || x.t === 'coret' || x.t === 'kode' || x.t === 'garisbawah' || x.t === 'rumus') potong.push(x.v);
      else if (x.t === 'tautan' || x.t === 'berkas' || x.t === 'halaman') potong.push(x.v);
      else if (x.t === 'pica') potong.push(`#${x.id}`);
      else if (x.t === 'baris') potong.push(' ');
    }
    hasil.push({ indeks, selesai: m[1] !== ' ', judul: potong.join('').replace(/\s+/g, ' ').trim(), tanggal, jam, pic });
  });
  return hasil;
}

export const hitungTugas = (isi: string): { selesai: number; total: number } => {
  const t = ambilTugas(isi);
  return { selesai: t.filter((x) => x.selesai).length, total: t.length };
};

/** Ganti "- [ ]" ↔ "- [x]" pada satu baris. */
export function toggleBaris(isi: string, indeks: number): string {
  const baris = isi.split('\n');
  const { kedalaman, isi: b } = pisahIndent(baris[indeks] ?? '');
  const m = b.match(POLA_CEKLIS);
  if (!m) return isi;
  baris[indeks] = `${INDENT.repeat(kedalaman)}- [${m[1] === ' ' ? 'x' : ' '}] ${m[2]}`;
  return baris.join('\n');
}

/** Pasang, ganti, atau (tanggal = null) buang penanda tenggat pada satu baris ceklis. */
export function ubahTenggatBaris(baris: string, tanggal: string | null, jam: string | null = null): string {
  const bersih = baris.replace(/\s*@\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?/g, '').replace(/\s+$/, '');
  if (!tanggalSah(tanggal)) return bersih;
  return `${bersih}${bersih.endsWith(' ') ? '' : ' '}@${tanggal}${jamSah(jam) ? ` ${jam}` : ''}`;
}

/** Judul baris Jadwal untuk satu tugas (kosong diberi nama, panjang dipotong). */
const judulJadwal = (t: Tugas) => (t.judul || 'Tugas memo').slice(0, 120);

/** Nomor baris ceklis yang cocok dengan satu baris Jadwal buatan memo (judul + tanggal + jam). */
export function cariBarisTugas(isi: string, j: { judul: string; tanggal: string; jam_mulai?: string | null }): number {
  const cocok = ambilTugas(isi).find((t) => t.tanggal === j.tanggal && t.jam === (j.jam_mulai ?? null) && judulJadwal(t) === j.judul);
  return cocok ? cocok.indeks : -1;
}

/**
 * Centang di Kalender dicerminkan ke teks memo agar keduanya tidak berselisih.
 * Mengembalikan teks baru, atau null bila barisnya tidak ditemukan / sudah sama.
 */
export function setCentangTugas(isi: string, j: { judul: string; tanggal: string; jam_mulai?: string | null }, selesai: boolean): string | null {
  const baris = isi.split('\n');
  const indeks = ambilTugas(isi).find((t) => t.tanggal === j.tanggal && t.jam === (j.jam_mulai ?? null) && judulJadwal(t) === j.judul && t.selesai !== selesai)?.indeks;
  if (indeks === undefined) return null;
  const { kedalaman, isi: b } = pisahIndent(baris[indeks]);
  const m = b.match(POLA_CEKLIS);
  if (!m) return null;
  baris[indeks] = `${INDENT.repeat(kedalaman)}- [${selesai ? 'x' : ' '}] ${m[2]}`;
  return baris.join('\n');
}

/** Jadwal buatan memo dihapus di Kalender: tugasnya tetap ada di memo, hanya tenggatnya dilepas. */
export function lepasTenggatTugas(isi: string, j: { judul: string; tanggal: string; jam_mulai?: string | null }): string | null {
  const indeks = cariBarisTugas(isi, j);
  if (indeks < 0) return null;
  const baris = isi.split('\n');
  baris[indeks] = ubahTenggatBaris(baris[indeks], null);
  return baris.join('\n');
}

export function hapusBaris(isi: string, indeks: number): string {
  const baris = isi.split('\n');
  baris.splice(indeks, 1);
  return baris.join('\n');
}

export function gambarDalam(isi: string): { indeks: number; nama: string; kunci: string }[] {
  const hasil: { indeks: number; nama: string; kunci: string }[] = [];
  uraiBlok(isi).forEach((b, indeks) => { if (b.jenis === 'gambar') hasil.push({ indeks, nama: b.nama, kunci: b.kunci }); });
  return hasil;
}

/** Baris pertama yang layak jadi cuplikan di daftar (bukan judul, garis, atau gambar). */
export function cuplikanMemo(isi: string): string {
  for (const b of uraiBlok(isi)) {
    if (b.jenis === 'ceklis') return `${b.selesai ? '☑' : '☐'} ${ringkasInline(b.teks)}`;
    if (b.jenis === 'butir') return `• ${ringkasInline(b.teks)}`;
    if (b.jenis === 'nomor') return `${b.no}. ${ringkasInline(b.teks)}`;
    if (b.jenis === 'kutipan' || b.jenis === 'penting' || b.jenis === 'teks' || b.jenis === 'toggle') {
      const t = ringkasInline(b.teks);
      if (t) return t;
    }
  }
  return '';
}

/** Potongan berwarna dibuka jadi isinya (untuk membaca tugas, tenggat, dan teks polos). */
export function rataInline(daftar: Inline[]): Inline[] {
  return daftar.flatMap((x) => (x.t === 'warna' ? rataInline(x.isi) : [x]));
}

/** Teks polos satu baris (tanda format dibuang). */
export function ringkasInline(teks: string): string {
  return rataInline(uraiInline(teks))
    .map((x) => {
      if (x.t === 'tenggat') return `@${x.tanggal}${x.jam ? ` ${x.jam}` : ''}`;
      if (x.t === 'orang') return `@${x.id}`;
      if (x.t === 'pica') return `#${x.id}`;
      if (x.t === 'baris') return ' ';
      if (x.t === 'warna') return '';
      return x.v;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Jadwal dari ceklis bertenggat
// ---------------------------------------------------------------------------

export interface BarisJadwalMemo {
  judul: string;
  keterangan: string;
  tanggal: string;
  jam_mulai: string | null;
  selesai: 0 | 1;
  pemilik_id: string;
  ingatkan_menit: number | null;
}

/** Pengingat bawaan untuk tugas memo yang belum selesai. */
export const INGATKAN_MENIT_MEMO = 30;
export const MAKS_TUGAS_JADWAL = 60;

/**
 * Ceklis yang punya tenggat menjadi baris Jadwal.
 *
 * Pemilik jadwal = orang yang disebut (@id) bila memo tim dan anggotanya ada,
 * selain itu penulis memo. Memo pribadi tidak pernah menugaskan orang lain.
 */
export function susunJadwalMemo(
  isi: string,
  o: { judulMemo: string; lingkup: 'pribadi' | 'tim'; penulisId: string; idTim: ReadonlySet<string> },
): BarisJadwalMemo[] {
  const keterangan = `Dari memo: ${o.judulMemo.trim() || 'Tanpa judul'}`;
  return ambilTugas(isi)
    .filter((t): t is Tugas & { tanggal: string } => Boolean(t.tanggal))
    .slice(0, MAKS_TUGAS_JADWAL)
    .map((t) => ({
      judul: judulJadwal(t),
      keterangan,
      tanggal: t.tanggal,
      jam_mulai: t.jam,
      selesai: t.selesai ? 1 : 0,
      pemilik_id: o.lingkup === 'tim' && t.pic && o.idTim.has(t.pic) ? t.pic : o.penulisId,
      ingatkan_menit: t.selesai ? null : INGATKAN_MENIT_MEMO,
    }));
}

/** Tanda tangan baris jadwal; dua daftar yang sama tidak perlu menulis ulang tabel. */
export const tandaJadwalMemo = (b: BarisJadwalMemo[]): string =>
  JSON.stringify(b.map((x) => [x.judul, x.keterangan, x.tanggal, x.jam_mulai, x.selesai, x.pemilik_id, x.ingatkan_menit]));

// ---------------------------------------------------------------------------
// Hak akses memo (seperti Share di Notion) — satu aturan untuk server, demo, dan aplikasi
// ---------------------------------------------------------------------------

/** penuh = sunting, hapus, bagikan, atur akses · edit = sunting isi & properti · baca = hanya baca. */
export type HakMemo = 'penuh' | 'edit' | 'baca';

/** Daftar id anggota yang dituju memo Rahasia (kolom `izin`, JSON array). */
export function izinMemo(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v !== 'string' || !v) return [];
  try { const a = JSON.parse(v); return Array.isArray(a) ? a.map(String).slice(0, 50) : []; } catch { return []; }
}

/**
 * Memo pribadi: hanya pemiliknya. Memo rahasia: pembuat (penuh) dan orang yang
 * dituju (`izin`, semuanya boleh menyunting) — Admin/Supervisor TIDAK otomatis
 * melihat. Memo tim: pembuat, Admin, dan Supervisor selalu penuh; Pemantau
 * selalu baca; anggota lain mengikuti `akses` memo ('edit' atau 'baca', diatur
 * pembuat). null = tidak boleh melihat.
 */
export function hakMemo(
  memo: { user_id?: string | null; lingkup?: string | null; akses?: string | null; izin?: unknown },
  p: { id: string; peran: string },
): HakMemo | null {
  if (memo.lingkup === 'rahasia') {
    if (memo.user_id === p.id) return 'penuh';
    return izinMemo(memo.izin).includes(p.id) ? 'edit' : null;
  }
  if (memo.lingkup !== 'tim') return memo.user_id === p.id ? 'penuh' : null;
  if (memo.user_id === p.id || p.peran === 'admin' || p.peran === 'supervisor') return 'penuh';
  if (p.peran === 'pemantau') return 'baca';
  return memo.akses === 'edit' ? 'edit' : 'baca';
}

/**
 * Perubahan dari pembaca (hak 'baca') hanya sah bila berupa centang pada tugas
 * yang menyebut dirinya (`@id`): baris lain dan jumlah baris tidak berubah.
 */
export function hanyaCentangTugasSendiri(lama: string, baru: string, idPengguna: string): boolean {
  const a = lama.split('\n');
  const b = baru.split('\n');
  if (a.length !== b.length) return false;
  const milik = new Set(ambilTugas(lama).filter((t) => t.pic === idPengguna).map((t) => t.indeks));
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) continue;
    if (!milik.has(i) || toggleBaris(a[i], 0) !== b[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Halaman di dalam halaman & Sampah (dipakai server dan mode demo)
// ---------------------------------------------------------------------------

/** Lama memo tinggal di Sampah sebelum dihapus permanen oleh cron. */
export const HARI_SAMPAH = 30;

interface SimpulMemo { id: string; induk_id?: string | null; dihapus_pada?: string | null }

/** Memo `akarId` beserta semua keturunannya (induk lebih dulu); `ikut` menyaring anak yang ditelusuri. */
export function pohonMemo<T extends SimpulMemo>(semua: T[], akarId: string, ikut: (m: T) => boolean = () => true): T[] {
  const anak = new Map<string, T[]>();
  for (const m of semua) {
    if (!m.induk_id) continue;
    const d = anak.get(m.induk_id) ?? [];
    d.push(m);
    anak.set(m.induk_id, d);
  }
  const akar = semua.find((m) => m.id === akarId);
  if (!akar) return [];
  const hasil: T[] = [akar];
  const dilihat = new Set([akar.id]);
  for (let i = 0; i < hasil.length; i += 1) {
    for (const c of anak.get(hasil[i].id) ?? []) {
      if (dilihat.has(c.id) || !ikut(c)) continue;
      dilihat.add(c.id);
      hasil.push(c);
    }
  }
  return hasil;
}

/**
 * Isi Sampah seperti Notion: hanya "kepala" tiap kelompok yang dibuang bersamaan
 * (induknya tidak ikut terbuang pada saat yang sama), dengan jumlah sub-halaman yang ikut.
 */
export function kepalaSampah<T extends SimpulMemo>(terbuang: T[]): (T & { jumlah_anak: number })[] {
  const per = new Map(terbuang.map((m) => [m.id, m]));
  return terbuang
    .filter((m) => {
      const induk = m.induk_id ? per.get(m.induk_id) : undefined;
      return !induk || induk.dihapus_pada !== m.dihapus_pada;
    })
    .map((m) => ({ ...m, jumlah_anak: pohonMemo(terbuang, m.id, (c) => c.dihapus_pada === m.dihapus_pada).length - 1 }));
}

/**
 * Judul halaman `id` berubah: label `[[memo:id|…]]` di teks memo lain ikut diganti, supaya
 * tampilan yang membaca teks apa adanya (halaman bagikan, gambar, Sampah) sama dengan aplikasi.
 */
export function gantiLabelHalaman(isi: string, id: string, judul: string): string {
  const awal = `[[memo:${id}|`;
  if (!isi.includes(awal)) return isi;
  const label = (judul.trim() || 'Tanpa judul').replace(/[\]|\n]/g, ' ');
  const pola = new RegExp(`\\[\\[memo:${id.replace(/[^\w-]/g, '')}\\|[^\\]\\n]*\\]\\]`, 'g');
  return isi.replace(pola, () => `${awal}${label}]]`);
}

/** Halaman baru yang dibiarkan kosong boleh dibuang permanen tanpa lewat Sampah. */
export const memoKosong = (m: { judul?: string | null; isi?: string | null; ringkasan?: string | null }): boolean =>
  !(m.judul ?? '').trim() && !(m.isi ?? '').trim() && !(m.ringkasan ?? '').trim();

