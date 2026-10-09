/**
 * Memo: dilihat oleh, suka, dan sematan.
 *
 *   POST /api/memo/:id/lihat      catat "saya membuka memo ini" (sekali per pembukaan halaman)
 *   GET  /api/memo/:id/sosial     { suka: [...], dilihat: [...], saya_suka }
 *   POST /api/memo/:id/suka       suka / batal suka
 *   POST /api/memo/:id/sematkan   { untuk: 'saya' | 'semua', nilai: boolean }
 *        'saya'  = sematan pribadi (tabel memo_sematan), siapa pun yang bisa melihat memo
 *        'semua' = kolom memo.disematkan; memo tim: pembuat/Admin/SPV · memo pribadi/rahasia: pemiliknya
 */

import type { Env, Pengguna } from './tipe';
import { hakMemo } from './memo-blok';
import { sekarangUtcIso } from './waktu';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);

export async function ruteSosialMemo(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  const m = jalur.match(/^\/api\/memo\/([\w-]+)\/(lihat|sosial|suka|sematkan)$/);
  if (!m) return null;
  const memo = await env.DB.prepare('SELECT id, user_id, lingkup, akses, izin FROM memo WHERE id = ?1 AND dihapus_pada IS NULL')
    .bind(m[1]).first<{ id: string; user_id: string; lingkup: string; akses: string | null; izin: string | null }>();
  const hak = memo ? hakMemo(memo, pengguna) : null;
  if (!memo || !hak) return galat('Memo tidak ditemukan.', 404);
  const aksi = m[2];
  const kini = sekarangUtcIso();

  if (aksi === 'lihat' && req.method === 'POST') {
    await env.DB.prepare(
      `INSERT INTO memo_lihat (memo_id, user_id, pertama, terakhir, kali) VALUES (?1, ?2, ?3, ?3, 1)
       ON CONFLICT(memo_id, user_id) DO UPDATE SET terakhir = ?3, kali = kali + 1`,
    ).bind(memo.id, pengguna.id, kini).run();
    return json({ ok: true });
  }

  if (aksi === 'sosial' && req.method === 'GET') {
    const [suka, lihat] = await Promise.all([
      env.DB.prepare(
        `SELECT s.user_id, t.nama, s.pada FROM memo_suka s LEFT JOIN tim t ON t.id = s.user_id
          WHERE s.memo_id = ?1 ORDER BY s.pada DESC`,
      ).bind(memo.id).all<{ user_id: string; nama: string | null; pada: string }>(),
      env.DB.prepare(
        `SELECT l.user_id, t.nama, l.pertama, l.terakhir, l.kali FROM memo_lihat l LEFT JOIN tim t ON t.id = l.user_id
          WHERE l.memo_id = ?1 ORDER BY l.terakhir DESC`,
      ).bind(memo.id).all<{ user_id: string; nama: string | null; pertama: string; terakhir: string; kali: number }>(),
    ]);
    return json({
      suka: suka.results,
      dilihat: lihat.results,
      saya_suka: suka.results.some((s) => s.user_id === pengguna.id),
    });
  }

  if (aksi === 'suka' && req.method === 'POST') {
    const ada = await env.DB.prepare('SELECT 1 FROM memo_suka WHERE memo_id = ?1 AND user_id = ?2').bind(memo.id, pengguna.id).first();
    if (ada) await env.DB.prepare('DELETE FROM memo_suka WHERE memo_id = ?1 AND user_id = ?2').bind(memo.id, pengguna.id).run();
    else await env.DB.prepare('INSERT INTO memo_suka (memo_id, user_id, pada) VALUES (?1, ?2, ?3)').bind(memo.id, pengguna.id, kini).run();
    const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM memo_suka WHERE memo_id = ?1').bind(memo.id).first<{ n: number }>();
    return json({ suka: !ada, jumlah: Number(n?.n ?? 0) });
  }

  if (aksi === 'sematkan' && req.method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { untuk?: string; nilai?: boolean };
    if (b.untuk === 'semua') {
      if (hak !== 'penuh') return galat('Hanya pembuat memo, Supervisor, atau Admin yang boleh menyematkan untuk semua orang.', 403);
      await env.DB.prepare('UPDATE memo SET disematkan = ?2 WHERE id = ?1').bind(memo.id, b.nilai ? 1 : 0).run();
      return json({ ok: true, disematkan: b.nilai ? 1 : 0 });
    }
    if (b.nilai) {
      await env.DB.prepare('INSERT OR REPLACE INTO memo_sematan (user_id, memo_id, pada) VALUES (?1, ?2, ?3)').bind(pengguna.id, memo.id, kini).run();
    } else {
      await env.DB.prepare('DELETE FROM memo_sematan WHERE user_id = ?1 AND memo_id = ?2').bind(pengguna.id, memo.id).run();
    }
    return json({ ok: true, sematan_saya: b.nilai ? 1 : 0 });
  }

  return galat('Metode tidak didukung.', 405);
}

/** Memo dihapus permanen: jejak sosialnya ikut dibersihkan. */
export async function hapusSosialMemo(env: Env, memoId: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM memo_lihat WHERE memo_id = ?1').bind(memoId),
    env.DB.prepare('DELETE FROM memo_suka WHERE memo_id = ?1').bind(memoId),
    env.DB.prepare('DELETE FROM memo_sematan WHERE memo_id = ?1').bind(memoId),
  ]);
}
