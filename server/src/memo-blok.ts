/**
 * Penguraian teks memo — murni (tanpa akses tabel), dipakai penampil memo,
 * poster gambar, server (menyusun Jadwal dari ceklis bertenggat), dan mode demo.
 *
 * Isi memo tetap teks biasa, satu blok per baris:
 *   # Judul   ## Subjudul   ### Anak judul
 *   - butir   1. bernomor   - [ ] tugas   - [x] selesai
 *   > kutipan   !! kotak penting   ---
 *   ![nama](kunci)        gambar
 *   [nama](memo/…)        berkas
 * Di dalam baris:
 *   **tebal**  *miring*  ~~coret~~  `kode`  [teks](https://…)
 *   @2026-10-05  atau  @2026-10-05 14:00   tenggat
 *   @id                                    orang (id anggota tim; tanda hubung boleh di tengah)
 *   #PICA-26W36-07                         tautan ke PICA
 *
 * Satu blok = satu baris, jadi nomor baris selalu sama dengan teks aslinya
 * dan kotak centang cukup mengganti baris itu.
 */

export type Blok =
  | { jenis: 'judul'; tingkat: 1 | 2 | 3; teks: string }
  | { jenis: 'ceklis'; selesai: boolean; teks: string }
  | { jenis: 'butir'; teks: string }
  | { jenis: 'nomor'; no: number; teks: string }
  | { jenis: 'kutipan'; teks: string }
  | { jenis: 'penting'; teks: string }
  | { jenis: 'garis' }
  | { jenis: 'gambar'; nama: string; kunci: string }
  | { jenis: 'berkas'; nama: string; kunci: string }
  | { jenis: 'kosong' }
  | { jenis: 'teks'; teks: string };

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
  | { t: 'pica'; id: string };

const POLA_CEKLIS = /^- \[([ xX])\] ?(.*)$/;

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

export function uraiBlok(isi: string): Blok[] {
  const hasil: Blok[] = [];
  let urut = 0;
  for (const b of isi.split('\n')) {
    let blok: Blok;
    let m: RegExpMatchArray | null;
    if ((m = b.match(/^(#{1,3}) (.*)$/))) {
      blok = { jenis: 'judul', tingkat: m[1].length as 1 | 2 | 3, teks: m[2] };
    } else if ((m = b.match(POLA_CEKLIS))) {
      blok = { jenis: 'ceklis', selesai: m[1] !== ' ', teks: m[2] };
    } else if (/^---+\s*$/.test(b)) {
      blok = { jenis: 'garis' };
    } else if ((m = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
      blok = { jenis: 'gambar', nama: m[1], kunci: m[2] };
    } else if ((m = b.match(/^\[([^\]]+)\]\(((?:memo|demo)\/[^)\s]+)\)\s*$/))) {
      blok = { jenis: 'berkas', nama: m[1], kunci: m[2] };
    } else if (b.startsWith('- ')) {
      blok = { jenis: 'butir', teks: b.slice(2) };
    } else if ((m = b.match(/^(\d{1,3})\. (.*)$/))) {
      urut += 1;
      blok = { jenis: 'nomor', no: urut, teks: m[2] };
    } else if (b.startsWith('> ')) {
      blok = { jenis: 'kutipan', teks: b.slice(2) };
    } else if (b.startsWith('!! ')) {
      blok = { jenis: 'penting', teks: b.slice(3) };
    } else if (!b.trim()) {
      blok = { jenis: 'kosong' };
    } else {
      blok = { jenis: 'teks', teks: b };
    }
    if (blok.jenis !== 'nomor') urut = 0;
    hasil.push(blok);
  }
  return hasil;
}

// Urutan alternatif menentukan prioritas pada indeks yang sama (** sebelum *).
const POLA_INLINE = new RegExp(
  [
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

    if (g.kode !== undefined) hasil.push({ t: 'kode', v: g.kode });
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
    const m = baris.match(POLA_CEKLIS);
    if (!m) return;
    let tanggal: string | null = null;
    let jam: string | null = null;
    let pic: string | null = null;
    const potong: string[] = [];
    for (const x of uraiInline(m[2])) {
      if (x.t === 'tenggat') { if (!tanggal) { tanggal = x.tanggal; jam = x.jam; } continue; }
      if (x.t === 'orang') { if (!pic) pic = x.id; continue; }
      if (x.t === 'teks' || x.t === 'tebal' || x.t === 'miring' || x.t === 'coret' || x.t === 'kode') potong.push(x.v);
      else if (x.t === 'tautan' || x.t === 'berkas') potong.push(x.v);
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
  const b = baris[indeks] ?? '';
  const m = b.match(POLA_CEKLIS);
  if (!m) return isi;
  baris[indeks] = `- [${m[1] === ' ' ? 'x' : ' '}] ${m[2]}`;
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
  const m = baris[indeks].match(POLA_CEKLIS);
  if (!m) return null;
  baris[indeks] = `- [${selesai ? 'x' : ' '}] ${m[2]}`;
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
    if (b.jenis === 'kutipan' || b.jenis === 'penting' || b.jenis === 'teks') {
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
