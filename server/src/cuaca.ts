/**
 * GET /api/cuaca — prakiraan BMKG untuk lokasi kebun (pengaturan `cuaca_adm4`).
 *
 * Worker menjadi perantara supaya: (1) HP tidak memanggil BMKG langsung,
 * (2) hasilnya disimpan 30 menit di tabel cuaca_cache sehingga tiga pemakai
 * yang membuka KEBUN bergantian hanya memicu satu permintaan ke BMKG, dan
 * (3) saat BMKG sedang tidak bisa dihubungi, data terakhir tetap tampil.
 */

import type { Env } from './tipe';
import { ambilPengaturan } from './wa';
import { ADM4_BAWAAN, polaAdm4, susunJawabanCuaca, uraiBmkg, type DataCuaca } from './cuaca-bmkg';

const UMUR_CACHE_MS = 30 * 60_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function ruteCuaca(jalur: string, req: Request, env: Env): Promise<Response | null> {
  if (jalur !== '/api/cuaca' || req.method !== 'GET') return null;

  const tersimpan = (await ambilPengaturan(env, 'cuaca_adm4')).trim();
  const adm4 = polaAdm4.test(tersimpan) ? tersimpan : ADM4_BAWAAN;
  const kini = Date.now();

  const cache = await env.DB.prepare('SELECT data, diambil FROM cuaca_cache WHERE adm4 = ?1')
    .bind(adm4)
    .first<{ data: string; diambil: string }>();
  if (cache && kini - Date.parse(cache.diambil) < UMUR_CACHE_MS) {
    return json(susunJawabanCuaca(JSON.parse(cache.data) as DataCuaca, cache.diambil, kini));
  }

  try {
    const res = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${adm4}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'POKEMONKEY/1.0 (revegetasi internal)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`BMKG menjawab ${res.status}`);
    const data = uraiBmkg(await res.json(), adm4);
    if (!data.slot.length) throw new Error('BMKG tidak mengirim prakiraan untuk kode wilayah ini');

    const diambil = new Date(kini).toISOString();
    await env.DB.prepare(
      `INSERT INTO cuaca_cache (adm4, data, diambil) VALUES (?1, ?2, ?3)
       ON CONFLICT(adm4) DO UPDATE SET data = excluded.data, diambil = excluded.diambil`,
    )
      .bind(adm4, JSON.stringify(data), diambil)
      .run();
    return json(susunJawabanCuaca(data, diambil, kini));
  } catch (e) {
    if (cache) return json(susunJawabanCuaca(JSON.parse(cache.data) as DataCuaca, cache.diambil, kini, true));
    return json({ galat: `Cuaca BMKG belum bisa diambil: ${e instanceof Error ? e.message : 'gangguan jaringan'}` }, 502);
  }
}
