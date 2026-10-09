/**
 * Enkripsi isi memo Rahasia di database (AES-GCM 256).
 *
 * Kunci diturunkan (SHA-256) dari secret Worker `KUNCI_RAHASIA_MEMO` yang dipasang
 * sendiri oleh pengelola: `npx wrangler secret put KUNCI_RAHASIA_MEMO`.
 * Teks tersandi berawalan "enc1:" sehingga isi lama/polos tetap terbaca.
 *
 * Melindungi dari salinan/ekspor database; orang yang mengendalikan Worker
 * tetap bisa membuka. Tanpa secret, isi disimpan apa adanya (memo tetap
 * terbatas aksesnya) — aplikasi menampilkan peringatan kepada pembuat.
 */

import type { Env } from './tipe';

const AWAL = 'enc1:';
let simpanan: { rahasia: string; kunci: CryptoKey } | null = null;

async function kunciDari(env: Env): Promise<CryptoKey | null> {
  const rahasia = env.KUNCI_RAHASIA_MEMO;
  if (!rahasia) return null;
  if (simpanan?.rahasia === rahasia) return simpanan.kunci;
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rahasia));
  const kunci = await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  simpanan = { rahasia, kunci };
  return kunci;
}

function keB64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
function dariB64(s: string): Uint8Array {
  const t = atob(s);
  const b = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i += 1) b[i] = t.charCodeAt(i);
  return b;
}

export const tersandi = (teks: string | null | undefined): boolean => typeof teks === 'string' && teks.startsWith(AWAL);
export const sandiAktif = (env: Env): boolean => Boolean(env.KUNCI_RAHASIA_MEMO);

/** Sandikan teks (tanpa secret: dikembalikan apa adanya). */
export async function sandikan(env: Env, teks: string): Promise<string> {
  if (!teks || tersandi(teks)) return teks;
  const kunci = await kunciDari(env);
  if (!kunci) return teks;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kunci, new TextEncoder().encode(teks)));
  return `${AWAL}${keB64(iv)}:${keB64(ct)}`;
}

/** Buka teks tersandi; teks polos dikembalikan apa adanya. Kunci salah/hilang = teks kosong. */
export async function bukaSandi(env: Env, teks: string | null | undefined): Promise<string> {
  if (!teks) return '';
  if (!tersandi(teks)) return teks;
  const kunci = await kunciDari(env);
  if (!kunci) return '';
  try {
    const [iv, ct] = teks.slice(AWAL.length).split(':');
    const polos = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: dariB64(iv) }, kunci, dariB64(ct));
    return new TextDecoder().decode(polos);
  } catch {
    return '';
  }
}

/** Isi memo untuk disimpan: hanya memo rahasia yang disandikan. */
export const isiUntukDisimpan = (env: Env, lingkup: string | null | undefined, isi: string): Promise<string> =>
  lingkup === 'rahasia' ? sandikan(env, isi) : Promise.resolve(isi);

/** Buka kolom `isi` pada baris memo rahasia (baris lain tidak disentuh). */
export async function bukaBarisMemo<T extends { lingkup?: string | null; isi?: string | null }>(env: Env, m: T): Promise<T> {
  if (m.lingkup !== 'rahasia' || !tersandi(m.isi)) return m;
  return { ...m, isi: await bukaSandi(env, m.isi) };
}
