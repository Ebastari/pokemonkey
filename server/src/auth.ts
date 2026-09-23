/**
 * Auth — pengganti mekanisme lama yang mengirim password lewat URL.
 *
 * Password tidak pernah disimpan, hanya turunannya (PBKDF2-SHA256 + salt acak).
 * Token sesi juga tidak disimpan mentah: yang masuk database adalah SHA-256-nya,
 * sehingga bocornya isi tabel tidak langsung berarti bocornya sesi.
 */

import type { Env, Pengguna } from './tipe';

/**
 * Jumlah iterasi PBKDF2. Nilai ini ikut tersimpan di dalam string hash,
 * jadi menaikkannya nanti tidak membatalkan password yang sudah ada.
 *
 * 25.000 dipilih agar muat di batas CPU 10 ms paket Workers gratis.
 * Setelah pindah ke Workers Paid (CPU 30 detik), naikkan ke 210.000.
 */
const ITERASI = 25_000;
const UMUR_SESI_HARI = 30;

const enc = new TextEncoder();

function keBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function dariBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function pbkdf2(password: string, salt: Uint8Array, iterasi: number): Promise<string> {
  const kunci = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bit = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iterasi },
    kunci,
    256,
  );
  return keBase64(bit);
}

/** Bandingkan tanpa membocorkan posisi perbedaan lewat lama waktu eksekusi. */
function samaAman(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

/** Hasil: 'pbkdf2$25000$<salt>$<hash>' */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERASI);
  return `pbkdf2$${ITERASI}$${keBase64(salt.buffer)}$${hash}`;
}

export async function cekPassword(password: string, tersimpan: string): Promise<boolean> {
  const [algo, iterasiStr, saltB64, hashB64] = tersimpan.split('$');
  if (algo !== 'pbkdf2') return false;
  const hash = await pbkdf2(password, dariBase64(saltB64), Number(iterasiStr));
  return samaAman(hash, hashB64);
}

async function sha256Hex(teks: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(teks));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Buat sesi baru; yang dikembalikan ke aplikasi adalah token mentah. */
export async function buatSesi(env: Env, userId: string): Promise<string> {
  const token = keBase64(crypto.getRandomValues(new Uint8Array(32)).buffer)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  const kedaluwarsa = new Date(Date.now() + UMUR_SESI_HARI * 86_400_000).toISOString();

  await env.DB.prepare('INSERT INTO sesi (token_hash, user_id, kedaluwarsa) VALUES (?1, ?2, ?3)')
    .bind(await sha256Hex(token), userId, kedaluwarsa)
    .run();

  return token;
}

export async function hapusSesi(env: Env, token: string): Promise<void> {
  await env.DB.prepare('DELETE FROM sesi WHERE token_hash = ?1').bind(await sha256Hex(token)).run();
}

/** Ambil pengguna dari header Authorization. NULL bila tidak sah / kedaluwarsa. */
export async function penggunaDariHeader(req: Request, env: Env): Promise<Pengguna | null> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;

  const baris = await env.DB.prepare(
    `SELECT t.id, t.nama, t.jabatan, t.bidang, t.wa, t.peran, t.foto, s.kedaluwarsa
       FROM sesi s JOIN tim t ON t.id = s.user_id
      WHERE s.token_hash = ?1 AND t.aktif = 1`,
  )
    .bind(await sha256Hex(token))
    .first<Pengguna & { kedaluwarsa: string }>();

  if (!baris) return null;
  const sisa = Date.parse(baris.kedaluwarsa) - Date.now();
  if (sisa < 0) {
    await hapusSesi(env, token);
    return null;
  }
  // Sesi yang masih dipakai diperpanjang, supaya penjadwal notifikasi di HP dan
  // langganan Web Push (yang ikut memakai token ini) tidak berhenti diam-diam
  // tepat 30 hari setelah login.
  if (sisa < 7 * 86_400_000) {
    const baru = new Date(Date.now() + UMUR_SESI_HARI * 86_400_000).toISOString();
    await env.DB.prepare('UPDATE sesi SET kedaluwarsa = ?2 WHERE token_hash = ?1')
      .bind(await sha256Hex(token), baru)
      .run();
  }
  return baris;
}

export function bolehUbahKunci(pengguna: Pengguna): boolean {
  return pengguna.peran === 'admin' || pengguna.peran === 'supervisor';
}

export function adalahAdmin(pengguna: Pengguna): boolean {
  return pengguna.peran === 'admin';
}
