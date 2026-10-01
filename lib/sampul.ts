/**
 * Sampul halaman memo (seperti "cover" di Notion). Nilai disimpan di memo.props:
 *   sampul   — 'pk:<kode>' (galeri POKEMONKEY), 'resmi:<kode>' (kop resmi),
 *              'warna:<kode>' (gradasi), atau kunci R2 hasil unggah ('memo/…').
 *   sampul_y — posisi tegak 0–100 (%) hasil "Ubah posisi".
 * Gambar galeri ikut di dalam aplikasi (public/sampul), jadi tampil tanpa sinyal.
 */

const dasar = (jalur: string) => `${import.meta.env.BASE_URL}${jalur}`;

export interface SampulGambar {
  kode: string;
  nama: string;
  /** Satu kalimat cerita stage (galeri POKEMONKEY). */
  cerita?: string;
  src: string;
  /** Posisi tegak bawaan (0–100 %): bagian gambar yang dijaga tetap terlihat. */
  fokusY: number;
  /** 'utuh' = gambar kecil/kop ditampilkan utuh di latar putih, tidak dipotong. */
  muat?: 'penuh' | 'utuh';
}

export const GALERI_POKEMONKEY: SampulGambar[] = [
  {
    kode: 'pk:lembah-jungle',
    nama: 'Stage 1-1 · Lembah Jungle',
    cerita: 'Petualangan dimulai: sang monyet memandang tanah yang akan dijaga.',
    src: dasar('sampul/lembah-jungle.webp'),
    fokusY: 45,
  },
];

export const SAMPUL_RESMI: SampulGambar[] = [
  { kode: 'resmi:ebl', nama: 'Kop PT Energi Batubara Lestari', src: dasar('sampul/resmi-ebl.jpg'), fokusY: 50, muat: 'utuh' },
];

export const SAMPUL_WARNA: Record<string, { label: string; kelas?: string; gaya?: { [k: string]: string } }> = {
  'warna:hutan': { label: 'Hutan', kelas: 'bg-gradient-to-r from-emerald-950 via-lime-700 to-emerald-950' },
  'warna:langit': { label: 'Langit', kelas: 'bg-gradient-to-r from-sky-950 via-sky-600 to-indigo-950' },
  'warna:senja': { label: 'Senja', kelas: 'bg-gradient-to-r from-amber-800 via-orange-600 to-rose-900' },
  'warna:tanah': { label: 'Tanah', kelas: 'bg-gradient-to-r from-stone-900 via-amber-900 to-stone-900' },
  'warna:malam': { label: 'Malam', kelas: 'bg-gradient-to-r from-zinc-950 via-indigo-950 to-zinc-950' },
  'warna:piksel': {
    label: 'Piksel',
    gaya: {
      backgroundColor: '#1a2e05',
      backgroundImage: 'linear-gradient(45deg,#365314 25%,transparent 25%,transparent 75%,#365314 75%),linear-gradient(45deg,#365314 25%,transparent 25%,transparent 75%,#365314 75%)',
      backgroundSize: '24px 24px',
      backgroundPosition: '0 0,12px 12px',
    },
  },
};

/** Sampul bawaan untuk memo baru, seperti halaman baru di Notion yang langsung bersampul. */
export const SAMPUL_BAWAAN = 'pk:lembah-jungle';

export type JenisSampul =
  | { jenis: 'gambar'; gambar: SampulGambar }
  | { jenis: 'warna'; kode: string }
  | { jenis: 'unggahan'; kunci: string }
  | { jenis: 'tidak-ada' };

export function bacaSampul(nilai: unknown): JenisSampul {
  if (typeof nilai !== 'string' || !nilai) return { jenis: 'tidak-ada' };
  const gambar = [...GALERI_POKEMONKEY, ...SAMPUL_RESMI].find((g) => g.kode === nilai);
  if (gambar) return { jenis: 'gambar', gambar };
  if (SAMPUL_WARNA[nilai]) return { jenis: 'warna', kode: nilai };
  if (/^(memo|demo)\//.test(nilai)) return { jenis: 'unggahan', kunci: nilai };
  return { jenis: 'tidak-ada' };
}

/** Posisi tegak tersimpan, atau titik fokus bawaan gambar. */
export function posisiSampul(nilaiY: unknown, s: JenisSampul): number {
  const y = typeof nilaiY === 'number' ? nilaiY : Number(nilaiY);
  if (Number.isFinite(y) && nilaiY !== null && nilaiY !== '' && nilaiY !== undefined) return Math.min(100, Math.max(0, y));
  return s.jenis === 'gambar' ? s.gambar.fokusY : 50;
}
