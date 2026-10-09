/**
 * Kalkulator tabel memo (seperti rumus & "Calculate" di Notion), murni dan tanpa eval.
 *
 * Rumus per baris memakai nama kolom: `[Anggaran] - [Realisasi]`, `Realisasi / Anggaran * 100`,
 * `jika([Hidup] >= 80, "Baik", "Sulam")`, `bulat([Luas] * 1.66, 2)`, `jumlah([Volume])` (total kolom).
 * Fungsi: jumlah, rata, min, maks, bulat, abs, jika, akar. Operator: + − × ÷ ^ % ( ) = <> < > <= >= & (gabung teks).
 * Angka Indonesia dibaca benar: "Rp 12.500.000", "12,5", "1.234,56", "80%".
 */

import type { FungsiHitung, KolomTabel, TipeKolom } from '../server/src/memo-blok';

// ---------------------------------------------------------------------------
// Angka
// ---------------------------------------------------------------------------

/** Teks sel → angka (null bila bukan angka). */
export function bacaAngka(teks: string | null | undefined): number | null {
  if (teks === null || teks === undefined) return null;
  let s = String(teks).trim().replace(/^rp\.?\s*/i, '').replace(/\s/g, '').replace(/%$/, '');
  if (!s || !/^-?[\d.,]+$/.test(s)) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const ANGKA = (n: number, maks = 2) => n.toLocaleString('id-ID', { maximumFractionDigits: maks });

/** Tampilan angka menurut tipe kolom. */
export function formatNilai(n: number, tipe: TipeKolom | undefined): string {
  if (tipe === 'rupiah') return `Rp ${ANGKA(Math.round(n), 0)}`;
  if (tipe === 'persen') return `${ANGKA(n, 1)}%`;
  return ANGKA(n, 2);
}

/** Sel kolom ceklis dicentang? */
export const tercentang = (v: string) => /^(✓|✔|☑|x|ya|true|1|selesai|sudah)$/i.test(v.trim());

// ---------------------------------------------------------------------------
// Baris hitung (footer)
// ---------------------------------------------------------------------------

export const LABEL_HITUNG: Record<FungsiHitung, string> = {
  jumlah: 'Jumlah', rata: 'Rata-rata', min: 'Terkecil', maks: 'Terbesar', median: 'Median',
  terisi: 'Terisi', kosong: 'Kosong', tercentang: 'Dicentang', persen_centang: '% dicentang',
};

/** Hitung satu kolom (nilai sudah tanpa baris judul). Hasil berupa teks siap tampil. */
export function hitungKolom(nilai: string[], f: FungsiHitung, tipe?: TipeKolom): string {
  const angka = nilai.map(bacaAngka).filter((x): x is number => x !== null);
  const isi = nilai.filter((v) => v.trim() !== '');
  switch (f) {
    case 'jumlah': return formatNilai(angka.reduce((a, b) => a + b, 0), tipe);
    case 'rata': return angka.length ? formatNilai(angka.reduce((a, b) => a + b, 0) / angka.length, tipe) : '—';
    case 'min': return angka.length ? formatNilai(Math.min(...angka), tipe) : '—';
    case 'maks': return angka.length ? formatNilai(Math.max(...angka), tipe) : '—';
    case 'median': {
      if (!angka.length) return '—';
      const u = [...angka].sort((a, b) => a - b);
      const m = Math.floor(u.length / 2);
      return formatNilai(u.length % 2 ? u[m] : (u[m - 1] + u[m]) / 2, tipe);
    }
    case 'terisi': return String(isi.length);
    case 'kosong': return String(nilai.length - isi.length);
    case 'tercentang': return `${nilai.filter(tercentang).length}/${nilai.length}`;
    case 'persen_centang': return nilai.length ? `${ANGKA((nilai.filter(tercentang).length / nilai.length) * 100, 1)}%` : '—';
  }
}

// ---------------------------------------------------------------------------
// Rumus per baris
// ---------------------------------------------------------------------------

type Token =
  | { t: 'angka'; v: number } | { t: 'teks'; v: string } | { t: 'nama'; v: string } | { t: 'kolom'; v: string }
  | { t: 'op'; v: string } | { t: '('; } | { t: ')'; } | { t: ','; };

function pecah(src: string): Token[] {
  const hasil: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i += 1; continue; }
    if (c === '[') { const j = src.indexOf(']', i); if (j < 0) throw new Error('Kurung [ ] tidak ditutup'); hasil.push({ t: 'kolom', v: src.slice(i + 1, j).trim() }); i = j + 1; continue; }
    if (c === '"') { const j = src.indexOf('"', i + 1); if (j < 0) throw new Error('Tanda kutip tidak ditutup'); hasil.push({ t: 'teks', v: src.slice(i + 1, j) }); i = j + 1; continue; }
    if (/[\d]/.test(c) || (c === '.' && /\d/.test(src[i + 1] ?? ''))) {
      let j = i;
      while (j < src.length && /[\d.]/.test(src[j])) j += 1;
      hasil.push({ t: 'angka', v: Number(src.slice(i, j)) });
      i = j; continue;
    }
    const dua = src.slice(i, i + 2);
    if (['<=', '>=', '<>', '!='].includes(dua)) { hasil.push({ t: 'op', v: dua === '!=' ? '<>' : dua }); i += 2; continue; }
    if ('+-*/^%<>=&×÷'.includes(c)) { hasil.push({ t: 'op', v: c === '×' ? '*' : c === '÷' ? '/' : c }); i += 1; continue; }
    if (c === '(') { hasil.push({ t: '(' }); i += 1; continue; }
    if (c === ')') { hasil.push({ t: ')' }); i += 1; continue; }
    if (c === ',' || c === ';') { hasil.push({ t: ',' }); i += 1; continue; }
    if (/[A-Za-z_À-ɏ]/.test(c)) {
      let j = i;
      while (j < src.length && /[\wÀ-ɏ]/.test(src[j])) j += 1;
      hasil.push({ t: 'nama', v: src.slice(i, j) });
      i = j; continue;
    }
    throw new Error(`Tanda "${c}" tidak dikenal`);
  }
  return hasil;
}

type Nilai = number | string | boolean;
interface Konteks { sel: (nama: string) => Nilai; kolom: (nama: string) => number[] }

const keAngka = (v: Nilai): number => (typeof v === 'number' ? v : typeof v === 'boolean' ? Number(v) : bacaAngka(v) ?? 0);

function evaluasi(token: Token[], k: Konteks): Nilai {
  let p = 0;
  const lihat = () => token[p];
  const ambil = () => token[p++];
  const harap = (t: Token['t']) => { if (lihat()?.t !== t) throw new Error(`Diharapkan ${t}`); return ambil(); };

  const PRIORITAS: Record<string, number> = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '%': 4, '^': 5 };
  const ekspresi = (min = 0): Nilai => {
    let kiri = unary();
    for (;;) {
      const t = lihat();
      if (!t || t.t !== 'op' || PRIORITAS[t.v] === undefined || PRIORITAS[t.v] < min) break;
      ambil();
      const kanan = ekspresi(PRIORITAS[t.v] + (t.v === '^' ? 0 : 1));
      kiri = operasi(t.v, kiri, kanan);
    }
    return kiri;
  };
  const unary = (): Nilai => {
    const t = lihat();
    if (t?.t === 'op' && t.v === '-') { ambil(); return -keAngka(unary()); }
    if (t?.t === 'op' && t.v === '+') { ambil(); return keAngka(unary()); }
    return primer();
  };
  const primer = (): Nilai => {
    const t = ambil();
    if (!t) throw new Error('Rumus belum lengkap');
    if (t.t === 'angka' || t.t === 'teks') return t.v;
    if (t.t === 'kolom') return k.sel(t.v);
    if (t.t === '(') { const v = ekspresi(); harap(')'); return v; }
    if (t.t === 'nama') {
      if (lihat()?.t === '(') {
        ambil();
        const arg: Token[][] = [];
        let dalam = 0;
        let awal = p;
        while (p < token.length) {
          const x = token[p];
          if (x.t === '(') dalam += 1;
          if (x.t === ')') { if (dalam === 0) break; dalam -= 1; }
          if (x.t === ',' && dalam === 0) { arg.push(token.slice(awal, p)); awal = p + 1; }
          p += 1;
        }
        if (p > awal || arg.length) arg.push(token.slice(awal, p));
        harap(')');
        return fungsi(t.v.toLowerCase(), arg);
      }
      const n = t.v.toLowerCase();
      if (n === 'benar' || n === 'true') return true;
      if (n === 'salah' || n === 'false') return false;
      return k.sel(t.v);
    }
    throw new Error('Rumus tidak sah');
  };
  const fungsi = (nama: string, arg: Token[][]): Nilai => {
    const nilaiArg = () => arg.map((a) => evaluasi(a, k));
    // Agregat kolom: jumlah([Kolom]) / rata([Kolom]) — atau beberapa nilai biasa.
    const daftarAngka = (): number[] => arg.flatMap((a) => (a.length === 1 && (a[0].t === 'kolom' || a[0].t === 'nama') && ['jumlah', 'rata', 'min', 'maks'].includes(nama) && arg.length === 1
      ? k.kolom(a[0].v)
      : [keAngka(evaluasi(a, k))]));
    switch (nama) {
      case 'jumlah': case 'sum': return daftarAngka().reduce((a, b) => a + b, 0);
      case 'rata': case 'average': { const d = daftarAngka(); return d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0; }
      case 'min': { const d = daftarAngka(); return d.length ? Math.min(...d) : 0; }
      case 'maks': case 'max': { const d = daftarAngka(); return d.length ? Math.max(...d) : 0; }
      case 'bulat': case 'round': { const [x, n] = nilaiArg(); const f = 10 ** Math.max(0, Math.min(6, keAngka(n ?? 0))); return Math.round(keAngka(x) * f) / f; }
      case 'abs': return Math.abs(keAngka(nilaiArg()[0]));
      case 'akar': case 'sqrt': return Math.sqrt(keAngka(nilaiArg()[0]));
      case 'jika': case 'if': {
        const syarat = evaluasi(arg[0] ?? [], k);
        const ya = typeof syarat === 'boolean' ? syarat : keAngka(syarat) !== 0;
        return arg[ya ? 1 : 2] ? evaluasi(arg[ya ? 1 : 2], k) : '';
      }
      default: throw new Error(`Fungsi "${nama}" tidak dikenal`);
    }
  };
  const operasi = (op: string, a: Nilai, b: Nilai): Nilai => {
    switch (op) {
      case '+': return keAngka(a) + keAngka(b);
      case '-': return keAngka(a) - keAngka(b);
      case '*': return keAngka(a) * keAngka(b);
      case '/': { const d = keAngka(b); if (d === 0) throw new Error('Pembagian dengan nol'); return keAngka(a) / d; }
      case '%': return keAngka(a) % keAngka(b);
      case '^': return keAngka(a) ** keAngka(b);
      case '&': return `${a}${b}`;
      case '=': return typeof a === 'string' || typeof b === 'string' ? String(a) === String(b) : keAngka(a) === keAngka(b);
      case '<>': return typeof a === 'string' || typeof b === 'string' ? String(a) !== String(b) : keAngka(a) !== keAngka(b);
      case '<': return keAngka(a) < keAngka(b);
      case '>': return keAngka(a) > keAngka(b);
      case '<=': return keAngka(a) <= keAngka(b);
      case '>=': return keAngka(a) >= keAngka(b);
      default: throw new Error(`Operator ${op}`);
    }
  };
  const v = ekspresi();
  if (p < token.length) throw new Error('Ada sisa rumus yang tidak terbaca');
  return v;
}

const normal = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Hitung semua kolom rumus pada tabel. Hasil ditulis kembali ke sel (supaya ekspor,
 * halaman bagikan, grafik, dan AI ikut melihat angkanya). Galat ditulis "#galat: …".
 */
export function terapkanRumus(baris: string[][], kepala: boolean, kolom: (KolomTabel | null)[] | undefined): string[][] {
  if (!kolom?.some((k) => k?.t === 'rumus' && k.rumus)) return baris;
  const judul = kepala ? baris[0] : baris[0].map((_, j) => `K${j + 1}`);
  const indeksNama = new Map<string, number>();
  judul.forEach((n, j) => { indeksNama.set(normal(n), j); indeksNama.set(normal(n).replace(/\s/g, '_'), j); indeksNama.set(`k${j + 1}`, j); });
  const mulai = kepala ? 1 : 0;
  const hasil = baris.map((r) => [...r]);
  // Dua putaran: rumus boleh memakai hasil rumus kolom lain (urutan kiri → kanan).
  for (let putaran = 0; putaran < 2; putaran += 1) {
    kolom.forEach((k, j) => {
      if (k?.t !== 'rumus' || !k.rumus) return;
      let token: Token[];
      try { token = pecah(k.rumus); } catch (e) { for (let i = mulai; i < hasil.length; i += 1) hasil[i][j] = `#galat: ${(e as Error).message}`; return; }
      const kolomAngka = (nama: string) => {
        const x = indeksNama.get(normal(nama));
        if (x === undefined) throw new Error(`Kolom "${nama}" tidak ada`);
        return hasil.slice(mulai).map((r) => bacaAngka(r[x])).filter((n): n is number => n !== null);
      };
      for (let i = mulai; i < hasil.length; i += 1) {
        if (hasil[i].every((c, x) => x === j || !c.trim())) { hasil[i][j] = ''; continue; } // baris kosong
        try {
          const v = evaluasi(token, {
            sel: (nama) => {
              const x = indeksNama.get(normal(nama));
              if (x === undefined) throw new Error(`Kolom "${nama}" tidak ada`);
              if (x === j) throw new Error('Rumus memakai kolomnya sendiri');
              const c = hasil[i][x];
              const n = bacaAngka(c);
              return n ?? c;
            },
            kolom: kolomAngka,
          });
          hasil[i][j] = typeof v === 'number' ? (Number.isFinite(v) ? ANGKA(v, 2) : '#galat: hasil tak hingga') : typeof v === 'boolean' ? (v ? 'Ya' : 'Tidak') : v;
        } catch (e) {
          hasil[i][j] = `#galat: ${(e as Error).message}`;
        }
      }
    });
  }
  return hasil;
}

/** Contoh rumus untuk bantuan di layar. */
export const CONTOH_RUMUS = [
  '[Anggaran] - [Realisasi]',
  '[Realisasi] / [Anggaran] * 100',
  '[Hidup] / [Ditanam] * 100',
  'bulat([Luas] * 1.66, 2)',
  'jika([Persen] >= 80, "Baik", "Sulam")',
];
