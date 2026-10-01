/**
 * Klien API POKEMONKEY.
 *
 * Menggantikan panggilan Apps Script lama. Perbedaan penting:
 *  - Setiap permintaan membaca jawaban server; kegagalan dilempar sebagai
 *    GalatApi dengan pesan yang bisa langsung ditampilkan.
 *  - Password dikirim lewat body POST, tidak pernah lewat URL.
 *  - Laporan lapangan yang gagal terkirim (tanpa sinyal) disimpan di antrean
 *    lokal dan dikirim ulang otomatis.
 *  - Mode DEMO mengalihkan semua permintaan ke lib/demo.ts (tanpa server).
 */

import { GalatApi } from './galat';
import { demoAktif, demoApi, demoBerkas } from './demo';

export { GalatApi } from './galat';
export { demoAktif, aktifkanDemo, matikanDemo, adaDataDemo, resetDemoDb, hitungDataDemo } from './demo';

const KUNCI_TOKEN = 'pokemonkey_token';
const KUNCI_SERVER = 'pokemonkey_server';
const KUNCI_ANTREAN = 'pokemonkey_antrean_offline';

/** Alamat server bawaan; bisa diganti lewat layar login (ikon gerigi). */
export const SERVER_BAWAAN: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787';

function bacaLokal(kunci: string): string | null {
  try {
    return localStorage.getItem(kunci);
  } catch {
    return null;
  }
}

function tulisLokal(kunci: string, nilai: string | null): void {
  try {
    if (nilai === null) localStorage.removeItem(kunci);
    else localStorage.setItem(kunci, nilai);
  } catch {
    /* penyimpanan diblokir — aplikasi tetap jalan tanpa mengingat */
  }
}

export const ambilServer = () => (bacaLokal(KUNCI_SERVER) || SERVER_BAWAAN).replace(/\/+$/, '');
export const simpanServer = (url: string) => tulisLokal(KUNCI_SERVER, url.trim() || null);
export const ambilToken = () => bacaLokal(KUNCI_TOKEN);
export const simpanToken = (token: string) => tulisLokal(KUNCI_TOKEN, token);
export const hapusToken = () => tulisLokal(KUNCI_TOKEN, null);

interface OpsiPermintaan {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
}

export async function api<T = any>(jalur: string, opsi: OpsiPermintaan = {}): Promise<T> {
  const method = opsi.method ?? (opsi.body !== undefined || opsi.form ? 'POST' : 'GET');

  if (demoAktif()) {
    return (await demoApi(jalur, method, opsi.body, opsi.form)) as T;
  }

  const headers: Record<string, string> = {};
  const token = ambilToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opsi.form) {
    body = opsi.form;
  } else if (opsi.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opsi.body);
  }

  let res: Response;
  try {
    res = await fetch(ambilServer() + jalur, { method, headers, body });
  } catch {
    throw new GalatApi('Tidak dapat terhubung ke server. Periksa sinyal atau alamat server.', 0);
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    if (res.status === 401) {
      hapusToken();
      window.dispatchEvent(new CustomEvent('pokemonkey:sesi-berakhir'));
    }
    throw new GalatApi(String(data.galat ?? `Server menjawab ${res.status}`), res.status, data);
  }

  return data as T;
}

/** Berkas lampiran butuh header Authorization, jadi selalu diambil sebagai blob. */
export async function ambilBerkas(kunci: string): Promise<Blob> {
  if (demoAktif()) {
    const tersimpan = demoBerkas(kunci); // lampiran memo disimpan utuh di database demo
    if (tersimpan) return tersimpan;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><rect width="100%" height="100%" fill="#225599"/><text x="50%" y="50%" fill="#fff" font-family="monospace" font-size="20" text-anchor="middle">DEMO · ${kunci.split('/').pop()}</text></svg>`;
    return new Blob([svg], { type: 'image/svg+xml' });
  }
  const token = ambilToken();
  const res = await fetch(`${ambilServer()}/api/berkas/${encodeURIComponent(kunci)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new GalatApi('Berkas tidak dapat dimuat.', res.status);
  return res.blob();
}

/** Alamat blob untuk <img>. */
export async function urlBerkas(kunci: string): Promise<string> {
  return URL.createObjectURL(await ambilBerkas(kunci));
}

// ---------- Antrean offline untuk lapangan tanpa sinyal ----------

interface ItemAntrean {
  jalur: string;
  body: unknown;
  dibuat: number;
}

function bacaAntrean(): ItemAntrean[] {
  try {
    return JSON.parse(bacaLokal(KUNCI_ANTREAN) || '[]');
  } catch {
    return [];
  }
}

export function jumlahAntreanOffline(): number {
  return bacaAntrean().length;
}

export function antreOffline(jalur: string, body: unknown): void {
  const daftar = bacaAntrean();
  daftar.push({ jalur, body, dibuat: Date.now() });
  tulisLokal(KUNCI_ANTREAN, JSON.stringify(daftar));
}

/** Kirim ulang antrean. Item yang ditolak server (bukan masalah jaringan) dibuang. */
export async function kirimAntreanOffline(): Promise<number> {
  const daftar = bacaAntrean();
  if (daftar.length === 0) return 0;

  const sisa: ItemAntrean[] = [];
  let terkirim = 0;

  for (const item of daftar) {
    try {
      await api(item.jalur, { method: 'POST', body: item.body });
      terkirim++;
    } catch (e) {
      if (e instanceof GalatApi && e.status === 0) sisa.push(item);
    }
  }

  tulisLokal(KUNCI_ANTREAN, JSON.stringify(sisa));
  return terkirim;
}
