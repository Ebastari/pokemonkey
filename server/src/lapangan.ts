/**
 * Rute API Data Lapangan: Smart Nursery & Geotagging Pohon.
 * 
 *   GET /api/lapangan/nursery?bibit=&tujuan=&dari=&sampai=
 *   GET /api/lapangan/geotag?lokasi=&tanaman=&vendor=&pengawas=&dari=&sampai=
 *   GET /api/lapangan/geotag/foto/:id
 * 
 * Hak akses: Semua anggota tim terautentikasi dapat membaca.
 * Cache: Ringkasan disimpan 10 menit (600 detik) agar membuka memo berulang kali
 * tidak membebani query D1 atau Worker sumber.
 */

import type { Env, Pengguna } from './tipe';
import {
  ambilDataNursery,
  ambilDataGeotag,
  type HasilNursery,
  type HasilGeotag,
  type SaringanNursery,
  type SaringanGeotag,
} from './sumber-lapangan';

function json(data: unknown, status = 200, maxAge = 600): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': `private, max-age=${maxAge}`,
    },
  });
}

function galat(pesan: string, status = 400): Response {
  return new Response(JSON.stringify({ ok: false, galat: pesan }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}

// In-memory cache ringkasan (10 menit)
const JEDA_CACHE_MS = 10 * 60 * 1000;
const cacheNursery = new Map<string, { waktu: number; data: HasilNursery }>();
const cacheGeotag = new Map<string, { waktu: number; data: HasilGeotag }>();

/** Rute GET /api/lapangan/nursery */
export async function ruteNursery(req: Request, env: Env, _pengguna: Pengguna): Promise<Response> {
  const url = new URL(req.url);
  const saring: SaringanNursery = {
    bibit: url.searchParams.get('bibit') || undefined,
    tujuan: url.searchParams.get('tujuan') || undefined,
    dari: url.searchParams.get('dari') || undefined,
    sampai: url.searchParams.get('sampai') || undefined,
  };
  const paksaSegar = url.searchParams.get('segar') === '1';

  const kunciCache = JSON.stringify(saring);
  const adaCache = cacheNursery.get(kunciCache);
  const sekarang = Date.now();

  if (!paksaSegar && adaCache && sekarang - adaCache.waktu < JEDA_CACHE_MS) {
    return json(adaCache.data);
  }

  try {
    const data = await ambilDataNursery(env, saring);
    cacheNursery.set(kunciCache, { waktu: sekarang, data });
    return json(data);
  } catch (err: any) {
    return galat(err?.message || 'Gagal memuat data Smart Nursery', 500);
  }
}

/** Rute GET /api/lapangan/geotag */
export async function ruteGeotag(req: Request, env: Env, _pengguna: Pengguna): Promise<Response> {
  const url = new URL(req.url);
  const saring: SaringanGeotag = {
    lokasi: url.searchParams.get('lokasi') || undefined,
    tanaman: url.searchParams.get('tanaman') || undefined,
    vendor: url.searchParams.get('vendor') || undefined,
    pengawas: url.searchParams.get('pengawas') || undefined,
    dari: url.searchParams.get('dari') || undefined,
    sampai: url.searchParams.get('sampai') || undefined,
  };
  const paksaSegar = url.searchParams.get('segar') === '1';

  const kunciCache = JSON.stringify(saring);
  const adaCache = cacheGeotag.get(kunciCache);
  const sekarang = Date.now();

  if (!paksaSegar && adaCache && sekarang - adaCache.waktu < JEDA_CACHE_MS) {
    return json(adaCache.data);
  }

  try {
    const data = await ambilDataGeotag(env, saring);
    cacheGeotag.set(kunciCache, { waktu: sekarang, data });
    return json(data);
  } catch (err: any) {
    return galat(err?.message || 'Gagal memuat data Geotagging Lapangan', 500);
  }
}

/** Rute GET /api/lapangan/geotag/foto/:id (teruskan foto bukti pohon) */
export async function ruteGeotagFoto(idFoto: string, env: Env): Promise<Response> {
  const apiUrl = env.GEOTAG_URL || 'https://montana-ecology-summary.montana-camera.workers.dev';
  const apiKey = env.GEOTAG_KEY || 'agunglaksono2026';

  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/photo/${encodeURIComponent(idFoto)}`, {
      headers: { 'X-Api-Key': apiKey },
    });
    if (!res.ok) {
      return new Response('Foto tidak ditemukan', { status: 404 });
    }
    const headers = new Headers();
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    headers.set('Content-Type', contentType);
    headers.set('Cache-Control', 'public, max-age=86400');
    return new Response(res.body, { headers });
  } catch (err: any) {
    return new Response('Gagal memuat foto', { status: 502 });
  }
}
