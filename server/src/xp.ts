/**
 * Buku besar XP & Nilai Keaktifan (KPI). Aturannya di xp-aturan.ts, penjelasannya
 * di docs/sistem-xp.md.
 *
 *   beriXp()   dipanggil dari rute lain sesudah aksi berhasil. Tidak pernah
 *              menggagalkan aksinya: galat XP hanya dicatat di log.
 *   tempelXp() menempelkan header X-XP pada jawaban bila pemakai yang meminta
 *              mendapat XP, supaya aplikasi bisa menampilkan "+N XP · sebab".
 *
 * Rute:
 *   GET  /api/xp/riwayat?hari=30&user=   baris XP (milik sendiri; Admin/SPV boleh orang lain)
 *   GET  /api/xp/skor                    level, XP, Meter hari ini, Skor 7 hari, KPI semester — semua anggota
 *   POST /api/xp/main                    { jenis: 'pisang' | 'monkey_run', nilai }
 *   POST /api/xp/klaim                   { sumber: 'notif_aktif' }
 *   POST /api/xp/beli-skin               { skin }
 *   POST /api/xp/batal                   Admin/SPV: { id, alasan }
 */

import type { Env, Pengguna } from './tipe';
import { bolehUbahKunci } from './auth';
import { tanggalWita, sekarangUtcIso, geserHari } from './waktu';
import {
  ATURAN_XP, HARGA_SKIN, hariKerjaRoster, hitungXp, kemajuanLevel, levelDari, meterHarian, nilaiKeaktifan,
  semesterDari, wilayahUntuk, type SumberXp,
} from './xp-aturan';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);

export interface KabarXp {
  tambah: number;
  total: number;
  level: number;
  naik: boolean;
  rincian: { sumber: SumberXp; xp: number; label: string }[];
  /** Skin Prestasi yang baru terbuka selama permintaan ini (lihat prestasi.ts). */
  prestasi?: string[];
}

/** Satu objek pengguna per permintaan: XP yang ia dapat dikumpulkan di sini untuk header X-XP. */
type PenggunaXp = Pengguna & { _xp?: KabarXp };

interface OpsiBeri {
  /** Mengganti XP dasar (pengumuman penting, skor Monkey Run). */
  nilai?: number;
  catatan?: string;
  /** Pemakai yang sedang meminta; bila sama dengan penerima, XP-nya dikabarkan lewat header. */
  pelaku?: Pengguna;
}

/**
 * Beri XP sekali untuk satu kejadian. `ref` membuat kejadian unik per penerima
 * dan sumber (mis. id PICA, atau id PICA + tanggal untuk "sekali sehari").
 * Mengembalikan XP yang benar-benar diberikan (0 bila sudah pernah, kena batas, atau galat).
 */
export async function beriXp(
  env: Env,
  penerima: string | { id: string; peran?: string | null },
  sumber: SumberXp,
  ref: string,
  opsi: OpsiBeri = {},
): Promise<number> {
  const id = typeof penerima === 'string' ? penerima : penerima.id;
  if (!id || !ref) return 0;
  try {
    const aturan = ATURAN_XP[sumber];
    const hari = tanggalWita();
    const kunciRef = ref.slice(0, 160);
    const ada = await env.DB.prepare('SELECT 1 AS x FROM xp_log WHERE user_id = ?1 AND sumber = ?2 AND ref = ?3')
      .bind(id, sumber, kunciRef).first();
    if (ada) return 0;

    const sudah = await env.DB.prepare(
      `SELECT COUNT(*) AS jumlah, COALESCE(SUM(xp), 0) AS xp FROM xp_log
        WHERE user_id = ?1 AND sumber = ?2 AND hari = ?3 AND dibatalkan_pada IS NULL`,
    ).bind(id, sumber, hari).first<{ jumlah: number; xp: number }>();
    const xp = hitungXp(aturan, { jumlah: Number(sudah?.jumlah ?? 0), xp: Number(sudah?.xp ?? 0) }, opsi.nilai);
    if (xp <= 0) return 0;

    let peran = typeof penerima === 'string' ? undefined : penerima.peran;
    if (peran === undefined) {
      const t = await env.DB.prepare('SELECT peran FROM tim WHERE id = ?1').bind(id).first<{ peran: string }>();
      peran = t?.peran ?? null;
    }
    const r = await env.DB.prepare(
      `INSERT OR IGNORE INTO xp_log (user_id, sumber, ref, xp, wilayah, hari, pada, catatan)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    ).bind(id, sumber, kunciRef, xp, wilayahUntuk(aturan, peran), hari, sekarangUtcIso(), opsi.catatan?.slice(0, 200) ?? null).run();
    if (!r.meta.changes) return 0;

    const p = await tambahKeProfil(env, id, xp);
    const pelaku = opsi.pelaku as PenggunaXp | undefined;
    if (pelaku && pelaku.id === id) {
      const k = pelaku._xp ?? { tambah: 0, total: 0, level: 1, naik: false, rincian: [] };
      k.tambah += xp;
      k.total = p.xp;
      k.level = p.level;
      k.naik = k.naik || p.naik;
      k.rincian.push({ sumber, xp, label: aturan.label });
      pelaku._xp = k;
    }
    return xp;
  } catch (e) {
    console.error('XP gagal dicatat', sumber, ref, e);
    return 0;
  }
}

/** Beri XP yang sama kepada semua anggota aktif (misi tim). */
export async function beriXpSemua(env: Env, sumber: SumberXp, ref: string, pelaku?: Pengguna): Promise<void> {
  const { results } = await env.DB.prepare("SELECT id, peran FROM tim WHERE aktif = 1 AND peran <> 'pemantau'").all<{ id: string; peran: string }>();
  for (const t of results) await beriXp(env, t, sumber, ref, { pelaku });
}

/** XP total bertambah; level dihitung ulang dan tidak pernah turun. */
async function tambahKeProfil(env: Env, id: string, xp: number): Promise<{ xp: number; level: number; naik: boolean }> {
  await env.DB.prepare('INSERT OR IGNORE INTO profil_game (user_id) VALUES (?1)').bind(id).run();
  const p = await env.DB.prepare('UPDATE profil_game SET xp = xp + ?2 WHERE user_id = ?1 RETURNING xp, level')
    .bind(id, xp).first<{ xp: number; level: number }>();
  const total = Number(p?.xp ?? 0);
  const lama = Number(p?.level ?? 1);
  const baru = Math.max(lama, levelDari(total));
  if (baru !== lama) await env.DB.prepare('UPDATE profil_game SET level = ?2 WHERE user_id = ?1').bind(id, baru).run();
  return { xp: total, level: baru, naik: baru > lama };
}

/** Header X-XP pada jawaban bila pemakai yang meminta mendapat XP selama permintaan ini. */
export function tempelXp(res: Response, pengguna: Pengguna): Response {
  const k = (pengguna as PenggunaXp)._xp;
  if (!k || (k.tambah <= 0 && !k.prestasi?.length)) return res;
  const baru = new Response(res.body, res);
  baru.headers.set('X-XP', encodeURIComponent(JSON.stringify(k)));
  baru.headers.set('Access-Control-Expose-Headers', 'X-XP');
  return baru;
}

// ---------------------------------------------------------------------------
// SHOP: belanja skin memakai saldo (xp − xp_terpakai)
// ---------------------------------------------------------------------------

interface BarisProfil { xp: number; level: number; xp_terpakai: number; skin_dimiliki: string | null; skin_aktif: string | null }

async function ambilProfil(env: Env, id: string): Promise<BarisProfil> {
  await env.DB.prepare('INSERT OR IGNORE INTO profil_game (user_id) VALUES (?1)').bind(id).run();
  const p = await env.DB.prepare('SELECT xp, level, xp_terpakai, skin_dimiliki, skin_aktif FROM profil_game WHERE user_id = ?1')
    .bind(id).first<BarisProfil>();
  return p ?? { xp: 0, level: 1, xp_terpakai: 0, skin_dimiliki: '["classic"]', skin_aktif: 'classic' };
}

const bacaSkin = (s: string | null) => {
  try { const a = JSON.parse(s || '["classic"]'); return Array.isArray(a) ? a.map(String) : ['classic']; } catch { return ['classic']; }
};

/**
 * Daftar skin yang dikirim aplikasi (termasuk APK lama yang membeli dengan
 * mengurangi XP sendiri): skin baru hanya diterima bila saldo cukup, dan
 * harganya dicatat di xp_terpakai. Mengembalikan daftar yang sah.
 */
export async function sahkanSkin(env: Env, id: string, diminta: string[]): Promise<string[]> {
  const p = await ambilProfil(env, id);
  const milik = bacaSkin(p.skin_dimiliki);
  let saldo = Number(p.xp) - Number(p.xp_terpakai);
  let belanja = 0;
  for (const s of diminta) {
    if (milik.includes(s)) continue;
    const harga = HARGA_SKIN[s];
    if (harga === undefined || harga > saldo) continue;
    milik.push(s);
    saldo -= harga;
    belanja += harga;
  }
  if (belanja > 0) {
    await env.DB.prepare('UPDATE profil_game SET xp_terpakai = xp_terpakai + ?2 WHERE user_id = ?1').bind(id, belanja).run();
  }
  return milik;
}

const ringkasProfil = (p: BarisProfil) => ({
  xp: Number(p.xp), level: Number(p.level), xp_terpakai: Number(p.xp_terpakai),
  saldo: Number(p.xp) - Number(p.xp_terpakai), skin_dimiliki: bacaSkin(p.skin_dimiliki), skin_aktif: p.skin_aktif ?? 'classic',
});

// ---------------------------------------------------------------------------
// Skor & KPI
// ---------------------------------------------------------------------------

async function hitungSkor(env: Env) {
  const hariIni = tanggalWita();
  const kemarin = geserHari(hariIni, -1);
  const awal7 = geserHari(hariIni, -7);
  const awalXp7 = geserHari(hariIni, -6);
  const semester = semesterDari(hariIni);
  const dari = semester.dari < awal7 ? semester.dari : awal7;

  const [tim, profil, log, roster] = await Promise.all([
    env.DB.prepare("SELECT id, nama, jabatan, peran FROM tim WHERE aktif = 1 AND peran <> 'pemantau' ORDER BY nama")
      .all<{ id: string; nama: string; jabatan: string | null; peran: string }>(),
    env.DB.prepare('SELECT user_id, xp, level, xp_terpakai FROM profil_game').all<{ user_id: string; xp: number; level: number; xp_terpakai: number }>(),
    env.DB.prepare(
      `SELECT user_id, hari, wilayah, SUM(xp) AS xp FROM xp_log
        WHERE hari >= ?1 AND dibatalkan_pada IS NULL GROUP BY user_id, hari, wilayah`,
    ).bind(dari).all<{ user_id: string; hari: string; wilayah: string; xp: number }>(),
    env.DB.prepare('SELECT user_id, tanggal, kode FROM roster WHERE tanggal BETWEEN ?1 AND ?2')
      .bind(dari, hariIni).all<{ user_id: string; tanggal: string; kode: string }>(),
  ]);

  const anggota = tim.results.map((t) => {
    const p = profil.results.find((x) => x.user_id === t.id);
    const wilayahPerHari = new Map<string, Set<string>>();
    let xp7 = 0;
    for (const b of log.results) {
      if (b.user_id !== t.id) continue;
      let w = wilayahPerHari.get(b.hari);
      if (!w) { w = new Set(); wilayahPerHari.set(b.hari, w); }
      w.add(b.wilayah);
      if (b.hari >= awalXp7) xp7 += Number(b.xp);
    }
    const kerja = roster.results.filter((r) => r.user_id === t.id && hariKerjaRoster(r.kode)).map((r) => r.tanggal);
    const skor7 = nilaiKeaktifan(kerja.filter((h) => h >= awal7 && h <= kemarin), wilayahPerHari);
    const kpi = nilaiKeaktifan(kerja.filter((h) => h >= semester.dari && h <= kemarin), wilayahPerHari);
    const xp = Number(p?.xp ?? 0);
    const lv = kemajuanLevel(xp, Number(p?.level ?? 1));
    return {
      id: t.id, nama: t.nama, jabatan: t.jabatan, peran: t.peran,
      xp, level: lv.level, xpDiLevel: lv.di, xpButuh: lv.butuh, saldo: xp - Number(p?.xp_terpakai ?? 0), xp7,
      meterHariIni: meterHarian(wilayahPerHari.get(hariIni) ?? []),
      wilayahHariIni: [...(wilayahPerHari.get(hariIni) ?? [])],
      hariIniKerja: kerja.includes(hariIni),
      skor7, kpi,
    };
  });
  return { hariIni, semester, anggota };
}

// ---------------------------------------------------------------------------
// Rute
// ---------------------------------------------------------------------------

export async function ruteXp(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (!jalur.startsWith('/api/xp')) return null;
  const url = new URL(req.url);

  if (jalur === '/api/xp/riwayat' && req.method === 'GET') {
    const user = url.searchParams.get('user') || pengguna.id;
    if (user !== pengguna.id && !bolehUbahKunci(pengguna)) return galat('Riwayat XP orang lain hanya untuk Admin/Supervisor.', 403);
    const hari = Math.min(186, Math.max(1, Number(url.searchParams.get('hari')) || 30));
    const { results } = await env.DB.prepare(
      `SELECT id, sumber, ref, xp, wilayah, hari, pada, catatan, dibatalkan_pada, alasan_batal
         FROM xp_log WHERE user_id = ?1 AND hari >= ?2 ORDER BY id DESC LIMIT 500`,
    ).bind(user, geserHari(tanggalWita(), -(hari - 1))).all<{ sumber: string }>();
    const riwayat = results.map((r) => ({ ...r, label: (ATURAN_XP as Record<string, { label: string; menu: string }>)[r.sumber]?.label ?? r.sumber, menu: (ATURAN_XP as Record<string, { menu: string }>)[r.sumber]?.menu ?? '' }));
    return json({ riwayat });
  }

  if (jalur === '/api/xp/skor' && req.method === 'GET') return json(await hitungSkor(env));

  if (jalur === '/api/xp/main' && req.method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { jenis?: string; nilai?: number };
    if (b.jenis !== 'pisang' && b.jenis !== 'monkey_run') return galat('Jenis tidak dikenal.');
    const ref = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const nilai = b.jenis === 'monkey_run' ? Math.max(0, Math.floor(Number(b.nilai) || 0)) : undefined;
    const xp = await beriXp(env, pengguna, b.jenis, ref, { nilai, pelaku: pengguna });
    return json({ xp, profil: ringkasProfil(await ambilProfil(env, pengguna.id)) });
  }

  if (jalur === '/api/xp/klaim' && req.method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { sumber?: string };
    // Hanya hadiah sekali yang memang tidak terlihat dari server.
    if (b.sumber !== 'notif_aktif') return galat('Hadiah ini tidak bisa diklaim dari aplikasi.');
    const xp = await beriXp(env, pengguna, 'notif_aktif', 'sekali', { pelaku: pengguna });
    return json({ xp });
  }

  if (jalur === '/api/xp/beli-skin' && req.method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { skin?: string };
    const skin = String(b.skin ?? '');
    const harga = HARGA_SKIN[skin];
    if (harga === undefined) return galat('Skin tidak dikenal.');
    const p = await ambilProfil(env, pengguna.id);
    const milik = bacaSkin(p.skin_dimiliki);
    if (!milik.includes(skin)) {
      if (Number(p.xp) - Number(p.xp_terpakai) < harga) return galat('Saldo XP tidak cukup.', 409);
      milik.push(skin);
      const r = await env.DB.prepare(
        `UPDATE profil_game SET xp_terpakai = xp_terpakai + ?2, skin_dimiliki = ?3, skin_aktif = ?4
          WHERE user_id = ?1 AND xp - xp_terpakai >= ?2`,
      ).bind(pengguna.id, harga, JSON.stringify(milik), skin).run();
      if (!r.meta.changes) return galat('Saldo XP tidak cukup.', 409);
    } else {
      await env.DB.prepare('UPDATE profil_game SET skin_aktif = ?2 WHERE user_id = ?1').bind(pengguna.id, skin).run();
    }
    return json({ ok: true, profil: ringkasProfil(await ambilProfil(env, pengguna.id)) });
  }

  if (jalur === '/api/xp/batal' && req.method === 'POST') {
    if (!bolehUbahKunci(pengguna)) return galat('Hanya Admin/Supervisor yang boleh membatalkan XP.', 403);
    const b = (await req.json().catch(() => ({}))) as { id?: number; alasan?: string };
    const alasan = String(b.alasan ?? '').trim();
    if (alasan.length < 5) return galat('Tulis alasan pembatalan (paling sedikit 5 huruf).');
    const baris = await env.DB.prepare('SELECT id, user_id, xp, dibatalkan_pada FROM xp_log WHERE id = ?1')
      .bind(Number(b.id)).first<{ id: number; user_id: string; xp: number; dibatalkan_pada: string | null }>();
    if (!baris) return galat('Baris XP tidak ditemukan.', 404);
    if (baris.dibatalkan_pada) return json({ ok: true });
    await env.DB.batch([
      env.DB.prepare('UPDATE xp_log SET dibatalkan_oleh = ?2, dibatalkan_pada = ?3, alasan_batal = ?4 WHERE id = ?1')
        .bind(baris.id, pengguna.id, sekarangUtcIso(), alasan.slice(0, 200)),
      // Level tidak ikut turun (aturan "level tidak pernah turun"); hanya XP total.
      env.DB.prepare('UPDATE profil_game SET xp = MAX(0, xp - ?2) WHERE user_id = ?1').bind(baris.user_id, baris.xp),
    ]);
    return json({ ok: true });
  }

  return null;
}
