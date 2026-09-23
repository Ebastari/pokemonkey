/**
 * Pemantauan titik api dari NASA FIRMS.
 *
 * Cron (tiap jam) → periksaTitikApi:
 *   ambil CSV 24 jam terakhir dari 4 satelit untuk kotak IUP + penyangga
 *   → hitung zona tiap titik (titik-api-murni.ts) → buang yang di luar radius pantau
 *   → INSERT OR IGNORE ke titik_api: yang benar-benar tersimpan = titik BARU
 *   → titik di zona IPPKH/IUP/waspada yang terdeteksi < 24 jam lalu dan belum diperingatkan
 *     (api yang sama dari satelit lain, ≤ 1 km dalam 24 jam, tidak dihitung lagi)
 *     → SATU pesan ke grup WA; titiknya ditandai dengan ref pesan itu.
 *   → Bila pesan itu akhirnya gagal (Fonnte gagal 4× / kedaluwarsa), titiknya dikembalikan
 *     dan dicoba lagi selama deteksinya masih < 24 jam. Yang sudah terkirim tidak pernah diulang.
 *   → Maksimal `titik_api_batas_harian` pesan per hari WITA (bawaan 4) agar nomor tidak diblokir;
 *     sisanya hanya tercatat di aplikasi.
 *
 * Kolom diperingatkan: 0 = menunggu dikirim · 1 = masuk pesan WA · 2 = sengaja tidak dikirim
 * (WA mati saat terdeteksi, deteksi sudah > 24 jam, api yang sama, atau batas harian).
 *
 * MAP_KEY hidup sebagai secret Worker (wrangler secret put FIRMS_MAP_KEY).
 */

import type { Env, Pengguna } from './tipe';
import { ambilPengaturan, antre, prosesAntrean } from './wa';
import { tanggalWita, utcDariWita } from './waktu';
import { adalahAdmin } from './auth';
import {
  SUMBER_FIRMS, RADIUS_BAWAAN, ZONA_PERINGATAN, kotakPantau, tentukanZonaArea, uraiCsvFirms, pilihUntukPeringatan,
  susunPeringatanTitikApi, susunPeringatanTitikApiDas, susunRekapTitikApi7Hari, namaSatelit,
  type RadiusZona, type TitikApi, type TitikFirms, type RingkasanRiwayat7Hari, type RingkasanDas7Hari, type InfoPetak,
} from './titik-api-murni';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}

async function simpanPengaturan(env: Env, kunci: string, nilai: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO pengaturan (kunci, nilai) VALUES (?1, ?2) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai`,
  ).bind(kunci, nilai).run();
}

export async function bacaRadius(env: Env): Promise<RadiusZona> {
  const [w, p] = await Promise.all([
    ambilPengaturan(env, 'titik_api_radius_waspada_km'),
    ambilPengaturan(env, 'titik_api_radius_pantau_km'),
  ]);
  const waspada = Number(w) > 0 ? Number(w) : RADIUS_BAWAAN.waspada;
  const pantau = Number(p) > 0 ? Math.max(Number(p), waspada) : Math.max(RADIUS_BAWAAN.pantau, waspada);
  return { waspada, pantau };
}

export interface HasilPeriksa {
  diperiksa: number;
  tercatat: number;
  baru: number;
  diperingatkan: number;
  galat: string[];
}

export async function periksaTitikApi(env: Env): Promise<HasilPeriksa> {
  const kini = new Date().toISOString();
  if (!env.FIRMS_MAP_KEY) {
    await simpanPengaturan(env, 'titik_api_galat', 'FIRMS_MAP_KEY belum dipasang');
    return { diperiksa: 0, tercatat: 0, baru: 0, diperingatkan: 0, galat: ['FIRMS_MAP_KEY belum dipasang'] };
  }

  const radius = await bacaRadius(env);
  const kotak = kotakPantau(radius.pantau + 0.5).join(',');
  const galat: string[] = [];
  const semua: TitikFirms[] = [];
  const tgl7HariLalu = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  for (const sumber of SUMBER_FIRMS) {
    // NASA FIRMS Area API mendukung rentang 1..5 hari.
    // Panggil 5 hari terakhir + 3 hari sebelumnya agar 7 hari penuh tercakup.
    const urls = [
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${env.FIRMS_MAP_KEY}/${sumber}/${kotak}/5`,
      `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${env.FIRMS_MAP_KEY}/${sumber}/${kotak}/3/${tgl7HariLalu}`,
    ];
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
        const teks = await res.text();
        // Jawaban sah selalu diawali judul kolom; selain itu pesan galat FIRMS (mis. "Invalid MAP_KEY.").
        if (!res.ok || !teks.trimStart().toLowerCase().startsWith('latitude')) {
          if (!teks.includes('No fires') && !teks.includes('No hotspots')) {
            galat.push(`${namaSatelit(sumber)}: ${teks.trim().slice(0, 80) || `HTTP ${res.status}`}`);
          }
          continue;
        }
        semua.push(...uraiCsvFirms(teks, sumber));
      } catch (e) {
        galat.push(`${namaSatelit(sumber)}: ${e instanceof Error ? e.message : 'gangguan jaringan'}`);
      }
    }
  }

  // Deduplikasi ID titik satelit sebelum pemrosesan zona
  const mapUnik = new Map<string, TitikFirms>();
  for (const t of semua) mapUnik.set(t.id, t);
  const titikUnik = Array.from(mapUnik.values());

  const kandidat: TitikApi[] = titikUnik.flatMap((t) => {
    const z = tentukanZonaArea(t.lon, t.lat, radius);
    return z.zona === 'luar' ? [] : [{ ...t, ...z, zona: z.zona, status: 'baru' as const }];
  });

  // INSERT OR IGNORE: hanya yang benar-benar tersimpan dihitung sebagai titik baru.
  const baru: TitikApi[] = [];
  if (kandidat.length) {
    const hasil = await env.DB.batch(kandidat.map((t) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO titik_api (id, sumber, lat, lon, waktu, keyakinan, frp, zona, jarak_km, bidang, dibuat_pada, area)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
      ).bind(t.id, t.sumber, t.lat, t.lon, t.waktu, t.keyakinan, t.frp, t.zona, t.jarak_km, t.bidang, kini, t.area ?? 'tambang')));
    hasil.forEach((h, i) => { if ((h.meta?.changes ?? 0) > 0) baru.push(kandidat[i]); });
  }

  const diperingatkan = await kirimPeringatanBaru(env, baru, kini);

  await simpanPengaturan(env, 'titik_api_terakhir', kini);
  await simpanPengaturan(env, 'titik_api_galat', galat.join(' · '));
  return { diperiksa: semua.length, tercatat: kandidat.length, baru: baru.length, diperingatkan, galat };
}

const JENDELA_PERINGATAN_MS = 24 * 3600_000;

const tandai = (env: Env, ids: string[], nilai: 0 | 1 | 2, ref: string | null = null) =>
  ids.length
    ? env.DB.batch(ids.map((id) => env.DB.prepare('UPDATE titik_api SET diperingatkan = ?2, pesan_ref = ?3 WHERE id = ?1').bind(id, nilai, ref)))
    : Promise.resolve([]);

/**
 * Dua area, dua pesan: area tambang dan Rehab DAS dikirim TERPISAH dengan batas harian
 * masing-masing, supaya titik tambang (sering swabakar) tidak menghabiskan jatah Rehab DAS.
 * Ref pesan diberi awalan area; pesan tambang lama (awalan titik-api- tanpa -das-) ikut dihitung tambang.
 */
const AREA_PERINGATAN = [
  { area: 'tambang', awalanRef: 'titik-api-tambang-', kunciBatas: 'titik_api_batas_harian', saringRef: `ref_id NOT LIKE 'titik-api-das-%'` },
  { area: 'das', awalanRef: 'titik-api-das-', kunciBatas: 'titik_api_das_batas_harian', saringRef: `ref_id LIKE 'titik-api-das-%'` },
] as const;

const SQL_STATUS = `
  COALESCE(SUM(CASE WHEN status = 'baru' THEN 1 ELSE 0 END), 0) AS belum_dicek,
  COALESCE(SUM(CASE WHEN status = 'dicek' THEN 1 ELSE 0 END), 0) AS sedang_dicek,
  COALESCE(SUM(CASE WHEN status = 'padam' THEN 1 ELSE 0 END), 0) AS padam,
  COALESCE(SUM(CASE WHEN status = 'bukan_api' THEN 1 ELSE 0 END), 0) AS bukan_api`;

const tujuhHariLalu = () => new Date(Date.now() - 7 * 86_400_000).toISOString();

async function riwayatTambang(env: Env): Promise<RingkasanRiwayat7Hari> {
  const r = await env.DB.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN zona = 'ippkh' THEN 1 ELSE 0 END), 0) AS ippkh,
      COALESCE(SUM(CASE WHEN zona = 'iup' THEN 1 ELSE 0 END), 0) AS iup,
      COALESCE(SUM(CASE WHEN zona = 'waspada' THEN 1 ELSE 0 END), 0) AS waspada,${SQL_STATUS}
    FROM titik_api WHERE waktu >= ?1 AND area = 'tambang' AND zona != 'pantau'`).bind(tujuhHariLalu()).first<RingkasanRiwayat7Hari>();
  return r ?? { total: 0, ippkh: 0, iup: 0, waspada: 0, belum_dicek: 0, sedang_dicek: 0, padam: 0, bukan_api: 0 };
}

async function riwayatDas(env: Env): Promise<RingkasanDas7Hari> {
  const r = await env.DB.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN zona = 'petak' THEN 1 ELSE 0 END), 0) AS petak,
      COALESCE(SUM(CASE WHEN zona = 'waspada' THEN 1 ELSE 0 END), 0) AS waspada,${SQL_STATUS}
    FROM titik_api WHERE waktu >= ?1 AND area = 'das' AND zona != 'pantau'`).bind(tujuhHariLalu()).first<RingkasanDas7Hari>();
  return r ?? { total: 0, petak: 0, waspada: 0, belum_dicek: 0, sedang_dicek: 0, padam: 0, bukan_api: 0 };
}

async function infoPetak(env: Env): Promise<Map<string, InfoPetak>> {
  const { results } = await env.DB.prepare('SELECT nama, luas_ha, vendor, status FROM das_petak')
    .all<InfoPetak & { nama: string }>();
  return new Map(results.map((p) => [p.nama, p]));
}

/** Antrekan pesan WA per area untuk titik yang layak diperingatkan; kembalikan jumlah titik terkirim. */
async function kirimPeringatanBaru(env: Env, baru: TitikApi[], kini: string): Promise<number> {
  const sejak = new Date(Date.now() - JENDELA_PERINGATAN_MS).toISOString();

  // 1) Pesan titik api yang akhirnya gagal: kembalikan titiknya supaya dicoba lagi (masih < 24 jam).
  await env.DB.prepare(
    `UPDATE titik_api SET diperingatkan = 0, pesan_ref = NULL
      WHERE diperingatkan = 1 AND waktu >= ?1
        AND pesan_ref IN (SELECT ref_id FROM pesan_wa WHERE jenis = 'titik_api' AND status = 'gagal')`,
  ).bind(sejak).run();

  // 2) Titik baru di zona pantau atau yang deteksinya sudah > 24 jam hanya dicatat, tidak pernah dikirim.
  await tandai(env, baru.filter((t) => !ZONA_PERINGATAN.includes(t.zona) || t.waktu < sejak).map((t) => t.id), 2);

  // 3) Calon: belum diperingatkan, zona peringatan, < 24 jam.
  const calon = await env.DB.prepare(
    `SELECT * FROM titik_api WHERE diperingatkan = 0 AND zona IN ('ippkh', 'iup', 'petak', 'waspada') AND waktu >= ?1`,
  ).bind(sejak).all<TitikApi>();
  if (!calon.results.length) return 0;

  const [grup, waAktif, titikWa, sudah] = await Promise.all([
    ambilPengaturan(env, 'wa_grup_id'),
    ambilPengaturan(env, 'wa_aktif'),
    ambilPengaturan(env, 'titik_api_wa'),
    env.DB.prepare('SELECT lat, lon, waktu FROM titik_api WHERE diperingatkan = 1 AND waktu >= ?1')
      .bind(new Date(Date.now() - 48 * 3600_000).toISOString())
      .all<{ lat: number; lon: number; waktu: string }>(),
  ]);

  // WA mati / peringatan titik api dimatikan: dicatat saja, tidak dikirim belakangan.
  if (!grup || waAktif !== '1' || titikWa === '0') {
    await tandai(env, calon.results.map((t) => t.id), 2);
    return 0;
  }

  const awalHari = utcDariWita(tanggalWita(), '00:00');
  let terkirim = 0;
  for (const a of AREA_PERINGATAN) {
    const calonArea = calon.results.filter((t) => (t.area ?? 'tambang') === a.area);
    if (!calonArea.length) continue;

    const pilih = pilihUntukPeringatan(calonArea, sudah.results);
    const dipilih = new Set(pilih.map((t) => t.id));
    // Api yang sama dengan yang sudah diperingatkan: tidak dikirim lagi.
    await tandai(env, calonArea.filter((t) => !dipilih.has(t.id)).map((t) => t.id), 2);
    if (!pilih.length) continue;

    const [batasTeks, pesanHariIni] = await Promise.all([
      ambilPengaturan(env, a.kunciBatas),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM pesan_wa WHERE jenis = 'titik_api' AND status <> 'gagal' AND kirim_pada >= ?1 AND ${a.saringRef}`)
        .bind(awalHari).first<{ n: number }>(),
    ]);
    const batas = Number(batasTeks) > 0 ? Number(batasTeks) : 4;
    const sudahHariIni = pesanHariIni?.n ?? 0;
    if (sudahHariIni >= batas) {
      await tandai(env, [...dipilih], 2);
      continue;
    }

    let isi = a.area === 'das'
      ? susunPeringatanTitikApiDas(pilih, kini, await infoPetak(env))
      : susunPeringatanTitikApi(pilih, kini, await riwayatTambang(env));
    if (sudahHariIni + 1 >= batas) {
      isi += `\n_Ini peringatan ke-${batas} hari ini untuk area ini (batas harian). Titik baru berikutnya hanya tercatat di aplikasi sampai besok._`;
    }
    const ref = `${a.awalanRef}${kini}`;
    await antre(env, { tujuan: grup, isi, jenis: 'titik_api', ref_id: ref });
    await tandai(env, [...dipilih], 1, ref);
    terkirim += pilih.length;
  }
  return terkirim;
}


const STATUS_SAH = ['baru', 'dicek', 'padam', 'bukan_api'];

export async function ruteTitikApi(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (!jalur.startsWith('/api/titik-api')) return null;
  const url = new URL(req.url);

  if (jalur === '/api/titik-api' && req.method === 'GET') {
    const hari = Math.min(30, Math.max(1, Number(url.searchParams.get('hari')) || 7));
    const [titik, terakhir, galat, radius, aktif, wa] = await Promise.all([
      env.DB.prepare(
        `SELECT a.*, t.nama AS dicek_nama FROM titik_api a LEFT JOIN tim t ON t.id = a.dicek_oleh
          WHERE a.waktu >= ?1 ORDER BY a.waktu DESC LIMIT 200`,
      ).bind(new Date(Date.now() - hari * 86_400_000).toISOString()).all(),
      ambilPengaturan(env, 'titik_api_terakhir'),
      ambilPengaturan(env, 'titik_api_galat'),
      bacaRadius(env),
      ambilPengaturan(env, 'titik_api_aktif'),
      ambilPengaturan(env, 'titik_api_wa'),
    ]);
    return json({
      terpasang: Boolean(env.FIRMS_MAP_KEY),
      aktif: aktif !== '0',
      kirim_wa: wa !== '0',
      terakhir: terakhir || null,
      galat: galat || null,
      radius,
      hari,
      titik: titik.results,
    });
  }

  if (jalur === '/api/titik-api/periksa' && req.method === 'POST') {
    if (!adalahAdmin(pengguna)) return json({ galat: 'Hanya Admin.' }, 403);
    const hasil = await periksaTitikApi(env);
    // Pemeriksaan manual: peringatan yang baru diantre langsung dikirim, tidak menunggu cron.
    if (hasil.diperingatkan) await prosesAntrean(env, 3);
    return json(hasil);
  }

  if (jalur === '/api/titik-api/rekap-wa' && req.method === 'POST') {
    if (!adalahAdmin(pengguna)) return json({ galat: 'Hanya Admin.' }, 403);
    const grup = (await ambilPengaturan(env, 'wa_grup_id')) || '';
    if (!grup) return json({ galat: 'ID grup WhatsApp belum diatur di Pengaturan.' }, 400);

    const terbaru = (area: string) => env.DB.prepare(
      `SELECT * FROM titik_api WHERE waktu >= ?1 AND area = ?2 AND zona != 'pantau' ORDER BY waktu DESC LIMIT 3`,
    ).bind(tujuhHariLalu(), area).all<TitikApi>();
    const [rTambang, tTambang, rDas, tDas] = await Promise.all([riwayatTambang(env), terbaru('tambang'), riwayatDas(env), terbaru('das')]);
    const isi = susunRekapTitikApi7Hari(new Date().toISOString(), { riwayat: rTambang, titik: tTambang.results }, { riwayat: rDas, titik: tDas.results });

    await antre(env, {
      tujuan: grup,
      isi,
      jenis: 'rekap',
      ref_id: `rekap-titik-api-${Date.now()}`,
    });
    // Dikirim seketika (seperti kirim manual rekap PICA), tidak menunggu putaran cron.
    const kirim = await prosesAntrean(env, 3);
    return json({ ok: true, pesan: isi, terkirim: kirim.terkirim > 0 });
  }

  const cocok = jalur.match(/^\/api\/titik-api\/([^/]+)$/);
  if (cocok && req.method === 'PATCH') {
    const id = decodeURIComponent(cocok[1]);
    const b = (await req.json()) as { status?: string; catatan?: string | null; pica_id?: string | null };
    if (b.status !== undefined && !STATUS_SAH.includes(b.status)) return json({ galat: 'Status tidak dikenal.' }, 400);
    const r = await env.DB.prepare(
      `UPDATE titik_api SET
         status     = COALESCE(?2, status),
         catatan    = CASE WHEN ?3 = 1 THEN ?4 ELSE catatan END,
         pica_id    = COALESCE(?5, pica_id),
         dicek_oleh = ?6,
         dicek_pada = ?7
       WHERE id = ?1`,
    ).bind(
      id,
      b.status ?? null,
      'catatan' in b ? 1 : 0,
      b.catatan ? String(b.catatan).slice(0, 500) : null,
      b.pica_id ?? null,
      pengguna.id,
      new Date().toISOString(),
    ).run();
    if (!r.meta.changes) return json({ galat: 'Titik api tidak ditemukan.' }, 404);
    return json({ ok: true });
  }

  return null;
}
