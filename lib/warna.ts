/**
 * Peta nama warna (tersimpan di tabel `opsi`) ke kelas Tailwind lengkap.
 * Harus berupa string utuh — Tailwind hanya menyertakan kelas yang tertulis
 * apa adanya di kode, bukan yang dirangkai saat runtime.
 */

export interface Palet {
  latar: string;
  garis: string;
  teks: string;
  padat: string;
  titik: string;
}

export const WARNA: Record<string, Palet> = {
  emerald: { latar: 'bg-emerald-950/50', garis: 'border-emerald-500', teks: 'text-emerald-300', padat: 'bg-emerald-600', titik: 'bg-emerald-500' },
  cyan:    { latar: 'bg-cyan-950/50',    garis: 'border-cyan-500',    teks: 'text-cyan-300',    padat: 'bg-cyan-600',    titik: 'bg-cyan-500' },
  blue:    { latar: 'bg-blue-950/50',    garis: 'border-blue-500',    teks: 'text-blue-300',    padat: 'bg-blue-600',    titik: 'bg-blue-500' },
  indigo:  { latar: 'bg-indigo-950/50',  garis: 'border-indigo-500',  teks: 'text-indigo-300',  padat: 'bg-indigo-600',  titik: 'bg-indigo-500' },
  purple:  { latar: 'bg-purple-950/50',  garis: 'border-purple-500',  teks: 'text-purple-300',  padat: 'bg-purple-600',  titik: 'bg-purple-500' },
  amber:   { latar: 'bg-amber-950/50',   garis: 'border-amber-500',   teks: 'text-amber-300',   padat: 'bg-amber-600',   titik: 'bg-amber-500' },
  orange:  { latar: 'bg-orange-950/50',  garis: 'border-orange-500',  teks: 'text-orange-300',  padat: 'bg-orange-600',  titik: 'bg-orange-500' },
  red:     { latar: 'bg-red-950/50',     garis: 'border-red-500',     teks: 'text-red-300',     padat: 'bg-red-600',     titik: 'bg-red-500' },
  yellow:  { latar: 'bg-yellow-950/50',  garis: 'border-yellow-500',  teks: 'text-yellow-300',  padat: 'bg-yellow-600',  titik: 'bg-yellow-500' },
  zinc:    { latar: 'bg-zinc-900/60',    garis: 'border-zinc-500',    teks: 'text-zinc-300',    padat: 'bg-zinc-600',    titik: 'bg-zinc-500' },
};

export const warna = (nama?: string | null): Palet => WARNA[nama ?? ''] ?? WARNA.zinc;
