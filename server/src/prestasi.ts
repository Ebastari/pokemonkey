/**
 * Skin Prestasi (aturan: prestasi-aturan.ts).
 *
 *   GET /api/prestasi?user=<id>     kemajuan semua prestasi (milik sendiri bila tanpa user)
 *   GET /api/skin/pemilik           berapa anggota memiliki tiap skin ("dimiliki N dari M")
 *
 * periksaPrestasi() dipanggil setelah kejadian yang relevan (titik api pertama, foto
 * laporan, PICA ditutup, hitung ulang XP) dan saat aplikasi membuka daftar prestasi.
 */

import type { Env, Pengguna } from './tipe';
import { sekarangUtcIso } from './waktu';
import { PRESTASI, type KodePrestasi } from './prestasi-aturan';
import { kirimSuratSistem } from './surat';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}

/** Nilai kemajuan tiap prestasi untuk satu orang. */
export async function kemajuanPrestasi(env: Env, userId: string): Promise<Record<KodePrestasi, number>> {
  const n = (r: { n: number } | null) => Number(r?.n ?? 0);
  const [titik, tutup, selamat, foto] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM xp_log WHERE user_id = ?1 AND sumber = 'titik_pertama' AND dibatalkan_pada IS NULL").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM pica WHERE pic_id = ?1 AND status = 'Closed' AND dihapus = 0").bind(userId).first<{ n: number }>(),
    // PICA orang lain yang sudah lewat tenggat saat dibantu (update atau bukti), lalu ditutup.
    env.DB.prepare(
      `SELECT COUNT(DISTINCT p.id) AS n FROM pica p
        WHERE p.status = 'Closed' AND p.dihapus = 0 AND p.due_date IS NOT NULL AND COALESCE(p.pic_id, '') <> ?1
          AND (EXISTS (SELECT 1 FROM pica_update u WHERE u.pica_id = p.id AND u.oleh = ?1
                         AND substr(datetime(u.pada, '+8 hours'), 1, 10) > p.due_date)
            OR EXISTS (SELECT 1 FROM lampiran l WHERE l.entitas = 'pica' AND l.entitas_id = p.id AND l.oleh = ?1
                         AND substr(datetime(l.pada, '+8 hours'), 1, 10) > p.due_date))`,
    ).bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM xp_log WHERE user_id = ?1 AND sumber = 'laporan_foto' AND dibatalkan_pada IS NULL").bind(userId).first<{ n: number }>(),
  ]);
  return { first_responder: n(titik), pemburu_pica: n(tutup), penyelamat_tim: n(selamat), fotografer: n(foto) };
}

/**
 * Buka prestasi yang syaratnya sudah tercapai: catat, tambahkan skinnya ke koleksi,
 * kirim surat, dan kabarkan ke layar bila pemiliknya yang sedang meminta.
 * Tidak pernah melempar galat.
 */
export async function periksaPrestasi(env: Env, userId: string | null | undefined, pelaku?: Pengguna): Promise<string[]> {
  if (!userId) return [];
  try {
    const [nilai, sudah] = await Promise.all([
      kemajuanPrestasi(env, userId),
      env.DB.prepare('SELECT kode FROM prestasi WHERE user_id = ?1').bind(userId).all<{ kode: string }>(),
    ]);
    const punya = new Set(sudah.results.map((r) => r.kode));
    const baru = PRESTASI.filter((p) => !punya.has(p.kode) && nilai[p.kode] >= p.target);
    if (!baru.length) return [];
    await env.DB.prepare('INSERT OR IGNORE INTO profil_game (user_id) VALUES (?1)').bind(userId).run();
    const prof = await env.DB.prepare('SELECT skin_dimiliki FROM profil_game WHERE user_id = ?1').bind(userId).first<{ skin_dimiliki: string | null }>();
    let milik: string[] = [];
    try { milik = JSON.parse(prof?.skin_dimiliki || '["classic"]'); } catch { milik = ['classic']; }
    for (const p of baru) if (!milik.includes(p.skin)) milik.push(p.skin);
    const kini = sekarangUtcIso();
    await env.DB.batch([
      ...baru.map((p) => env.DB.prepare('INSERT OR IGNORE INTO prestasi (user_id, kode, didapat_pada) VALUES (?1, ?2, ?3)').bind(userId, p.kode, kini)),
      env.DB.prepare('UPDATE profil_game SET skin_dimiliki = ?2 WHERE user_id = ?1').bind(userId, JSON.stringify(milik)),
    ]);
    for (const p of baru) {
      await kirimSuratSistem(env, userId, {
        jenis: 'prestasi', judul: `🏆 Prestasi terbuka: ${p.nama}`,
        isi: `${p.syarat} Skin "${p.nama}" kini ada di koleksi Anda — pakai di SHOP.`, tautan: { jenis: 'tab', id: 'market', label: 'Buka SHOP' },
      });
    }
    const k = (pelaku as (Pengguna & { _xp?: { tambah: number; total: number; level: number; naik: boolean; rincian: unknown[]; prestasi?: string[] } }) | undefined);
    if (k && k.id === userId) {
      k._xp = k._xp ?? { tambah: 0, total: 0, level: 1, naik: false, rincian: [] };
      k._xp.prestasi = [...(k._xp.prestasi ?? []), ...baru.map((p) => p.skin)];
    }
    return baru.map((p) => p.skin);
  } catch (e) {
    console.error('Prestasi gagal diperiksa', userId, e);
    return [];
  }
}

export async function rutePrestasi(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (jalur === '/api/prestasi' && req.method === 'GET') {
    const user = new URL(req.url).searchParams.get('user') || pengguna.id;
    if (user === pengguna.id) await periksaPrestasi(env, user, pengguna);
    const [nilai, sudah] = await Promise.all([
      kemajuanPrestasi(env, user),
      env.DB.prepare('SELECT kode, didapat_pada FROM prestasi WHERE user_id = ?1').bind(user).all<{ kode: string; didapat_pada: string }>(),
    ]);
    return json({
      prestasi: PRESTASI.map((p) => ({ ...p, nilai: nilai[p.kode], didapat_pada: sudah.results.find((r) => r.kode === p.kode)?.didapat_pada ?? null })),
    });
  }
  if (jalur === '/api/skin/pemilik' && req.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT s.value AS skin, COUNT(*) AS n FROM profil_game g JOIN tim t ON t.id = g.user_id, json_each(COALESCE(g.skin_dimiliki, '["classic"]')) s
        WHERE t.aktif = 1 GROUP BY s.value`,
    ).all<{ skin: string; n: number }>();
    const total = await env.DB.prepare("SELECT COUNT(*) AS n FROM tim WHERE aktif = 1 AND peran <> 'pemantau'").first<{ n: number }>();
    return json({ pemilik: Object.fromEntries(results.map((r) => [r.skin, Number(r.n)])), anggota: Number(total?.n ?? 0) });
  }
  return null;
}
