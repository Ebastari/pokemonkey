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
 * Di dalam baris:
 *   **tebal**  *miring*  ~~coret~~  `kode`  [teks](https://…)
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
  | { jenis: 'gambar'; nama: string; kunci: string }
  | { jenis: 'video'; judul: string; url: string }
  | { jenis: 'tabel'; baris: string[][]; kepala: boolean }
  | { jenis: 'berkas'; nama: string; kunci: string }
  | BlokData
  | { jenis: 'kosong' }
  | { jenis: 'teks'; teks: string };

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
  | { t: 'halaman'; id: string; v: string };

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

/** Batas tabel agar satu memo tetap ringan. */
export const MAKS_BARIS_TABEL = 60;
export const MAKS_KOLOM_TABEL = 12;

/** Sel tabel: teks satu baris, tanpa ganti baris. */
const bersihSel = (x: unknown) => String(x ?? '').replace(/[\r\n]+/g, ' ').slice(0, 500);

/** Baca baris `!tabel{…}`; null bila rusak (baris itu lalu tampil sebagai teks biasa). */
export function bacaTabel(b: string): { jenis: 'tabel'; baris: string[][]; kepala: boolean } | null {
  try {
    const d = JSON.parse(b.slice('!tabel'.length)) as { baris?: unknown; kepala?: unknown };
    if (!Array.isArray(d.baris) || d.baris.length === 0) return null;
    const lebar = Math.min(MAKS_KOLOM_TABEL, Math.max(1, ...d.baris.map((r) => (Array.isArray(r) ? r.length : 0))));
    const baris = d.baris.slice(0, MAKS_BARIS_TABEL).map((r) => {
      const sel = Array.isArray(r) ? r.slice(0, lebar).map(bersihSel) : [];
      while (sel.length < lebar) sel.push('');
      return sel;
    });
    return { jenis: 'tabel', baris, kepala: d.kepala !== false };
  } catch {
    return null;
  }
}

/** Tulis tabel sebagai satu baris memo. */
export const rakitTabel = (baris: string[][], kepala: boolean): string =>
  `!tabel${JSON.stringify({ kepala, baris: baris.map((r) => r.map(bersihSel)) })}`;

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
    if ((m = b.match(/^(#{1,4}) (.*)$/))) {
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
    '`(?<kode>[^`\\n]+)`',
    '\\*\\*(?<tebal>[^*\\n]+)\\*\\*',
    '~~(?<coret>[^~\\n]+)~~',
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
    for (const x of uraiInline(m[2])) {
      if (x.t === 'tenggat') { if (!tanggal) { tanggal = x.tanggal; jam = x.jam; } continue; }
      if (x.t === 'orang') { if (!pic) pic = x.id; continue; }
      if (x.t === 'teks' || x.t === 'tebal' || x.t === 'miring' || x.t === 'coret' || x.t === 'kode') potong.push(x.v);
      else if (x.t === 'tautan' || x.t === 'berkas' || x.t === 'halaman') potong.push(x.v);
      else if (x.t === 'pica') potong.push(`#${x.id}`);
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

/** Teks polos satu baris (tanda format dibuang). */
export function ringkasInline(teks: string): string {
  return uraiInline(teks)
    .map((x) => {
      if (x.t === 'tenggat') return `@${x.tanggal}${x.jam ? ` ${x.jam}` : ''}`;
      if (x.t === 'orang') return `@${x.id}`;
      if (x.t === 'pica') return `#${x.id}`;
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

/**
 * Memo pribadi: hanya pemiliknya. Memo tim: pembuat, Admin, dan Supervisor
 * selalu penuh; Pemantau selalu baca; anggota lain mengikuti `akses` memo
 * ('edit' atau 'baca', diatur pembuat). null = tidak boleh melihat.
 */
export function hakMemo(
  memo: { user_id?: string | null; lingkup?: string | null; akses?: string | null },
  p: { id: string; peran: string },
): HakMemo | null {
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

