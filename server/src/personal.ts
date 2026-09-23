/**
 * Rute roster bulanan dan memo pribadi.
 *
 * Roster: Admin/Supervisor mengatur semua orang; anggota boleh mengisi
 * miliknya sendiri (mis. mengajukan cuti) — setiap perubahan mencatat siapa
 * yang mengubah. Memo: sepenuhnya pribadi per akun.
 */

import type { Env, Pengguna } from './tipe';
import { bolehUbahKunci, adalahAdmin } from './auth';
import { sekarangUtcIso, geserHari, tanggalWita } from './waktu';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);

export async function rutePersonal(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  const url = new URL(req.url);

  // ---------- Roster ----------
  if (jalur === '/api/roster' && req.method === 'GET') {
    const bulan = url.searchParams.get('bulan') ?? sekarangUtcIso().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(bulan)) return galat('Format bulan: YYYY-MM');
    const { results } = await env.DB.prepare(
      `SELECT user_id, tanggal, kode, catatan FROM roster WHERE tanggal LIKE ?1 ORDER BY tanggal`,
    ).bind(`${bulan}-%`).all();
    return json({ roster: results, bulan });
  }

  if (jalur === '/api/roster' && req.method === 'POST') {
    const b = (await req.json()) as { user_id?: string; tanggal?: string; kode?: string; catatan?: string };
    if (!b.user_id || !b.tanggal) return galat('user_id dan tanggal wajib diisi.');
    if (!bolehUbahKunci(pengguna) && b.user_id !== pengguna.id) return galat('Hanya boleh mengubah roster sendiri.', 403);

    if (!b.kode) {
      await env.DB.prepare('DELETE FROM roster WHERE user_id = ?1 AND tanggal = ?2').bind(b.user_id, b.tanggal).run();
      return json({ ok: true });
    }
    await env.DB.prepare(
      `INSERT INTO roster (user_id, tanggal, kode, catatan, diubah_oleh, diubah_pada) VALUES (?1,?2,?3,?4,?5,?6)
       ON CONFLICT(user_id, tanggal) DO UPDATE SET kode = ?3, catatan = ?4, diubah_oleh = ?5, diubah_pada = ?6`,
    ).bind(b.user_id, b.tanggal, b.kode, b.catatan ?? null, pengguna.id, sekarangUtcIso()).run();
    return json({ ok: true });
  }

  // Isi cepat: satu kode untuk rentang tanggal, opsional hanya hari tertentu (0=Minggu).
  if (jalur === '/api/roster/isi' && req.method === 'POST') {
    if (!bolehUbahKunci(pengguna)) return galat('Hanya Admin/Supervisor.', 403);
    const b = (await req.json()) as {
      user_id?: string; dari?: string; sampai?: string; kode?: string; hari?: number[];
      /** Lewati tanggal merah (libur nasional & cuti bersama) di rentang ini. */
      lewatiLibur?: boolean;
    };
    if (!b.user_id || !b.dari || !b.sampai || !b.kode) return galat('user_id, dari, sampai, dan kode wajib diisi.');

    const tanggalMerah = new Set<string>();
    if (b.lewatiLibur) {
      const { results } = await env.DB.prepare(
        `SELECT tanggal FROM libur WHERE tanggal BETWEEN ?1 AND ?2 AND jenis IN ('nasional','cuti','perusahaan')`,
      ).bind(b.dari, b.sampai).all<{ tanggal: string }>();
      results.forEach((r) => tanggalMerah.add(r.tanggal));
    }

    const batch: D1PreparedStatement[] = [];
    for (let t = b.dari; t <= b.sampai && batch.length < 400; t = geserHari(t, 1)) {
      const hari = new Date(t + 'T00:00:00Z').getUTCDay();
      if (b.hari && b.hari.length && !b.hari.includes(hari)) continue;
      if (tanggalMerah.has(t)) continue;
      batch.push(
        env.DB.prepare(
          `INSERT INTO roster (user_id, tanggal, kode, diubah_oleh, diubah_pada) VALUES (?1,?2,?3,?4,?5)
           ON CONFLICT(user_id, tanggal) DO UPDATE SET kode = ?3, diubah_oleh = ?4, diubah_pada = ?5`,
        ).bind(b.user_id, t, b.kode, pengguna.id, sekarangUtcIso()),
      );
    }
    if (batch.length) await env.DB.batch(batch);
    return json({ ok: true, jumlah: batch.length });
  }

  // ---------- Libur ----------
  if (jalur === '/api/libur' && req.method === 'GET') {
    const tahun = url.searchParams.get('tahun');
    const dari = url.searchParams.get('dari') ?? (tahun ? `${tahun}-01-01` : '0000-01-01');
    const sampai = url.searchParams.get('sampai') ?? (tahun ? `${tahun}-12-31` : '9999-12-31');
    const { results } = await env.DB.prepare(
      'SELECT id, tanggal, nama, jenis, perkiraan FROM libur WHERE tanggal BETWEEN ?1 AND ?2 ORDER BY tanggal',
    ).bind(dari, sampai).all();
    return json({ libur: results });
  }

  if (jalur === '/api/libur' && req.method === 'POST') {
    if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh mengatur hari libur.', 403);
    const b = (await req.json()) as { tanggal?: string; nama?: string; jenis?: string };
    if (!b.tanggal || !b.nama) return galat('Tanggal dan nama libur wajib diisi.');
    const jenis = ['nasional', 'cuti', 'perusahaan'].includes(b.jenis ?? '') ? b.jenis : 'perusahaan';
    await env.DB.prepare(
      `INSERT INTO libur (tanggal, nama, jenis, sumber) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(tanggal, nama) DO UPDATE SET jenis = ?3, sumber = ?4`,
    ).bind(b.tanggal, b.nama, jenis, `ditambah ${pengguna.nama}`).run();
    return json({ ok: true }, 201);
  }

  const cocokLibur = jalur.match(/^\/api\/libur\/(\d+)$/);
  if (cocokLibur && req.method === 'DELETE') {
    if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh mengatur hari libur.', 403);
    await env.DB.prepare('DELETE FROM libur WHERE id = ?1').bind(Number(cocokLibur[1])).run();
    return json({ ok: true });
  }

  // ---------- Realisasi revegetasi ----------
  // Data acuan dari "Realisasi Permintaan Amdal.xlsx" (sheet Summary); dibaca
  // semua peran. Pembaruan tahunan lewat migrasi/SQL sampai layar penyuntingnya ada.
  if (jalur === '/api/revegetasi' && req.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT tahun, apl, hutan, ipd, opd, timbunan_soil, fasilitas, blok FROM revegetasi ORDER BY tahun',
    ).all<Record<string, unknown> & { blok: string }>();
    return json({
      revegetasi: results.map((b) => ({ ...b, blok: JSON.parse(b.blok || '{}') })),
      satuan: 'Ha',
    });
  }

  if (jalur === '/api/revegetasi' && req.method === 'POST') {
    if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh mengubah angka realisasi.', 403);
    const b = (await req.json()) as Record<string, unknown>;
    const tahun = Number(b.tahun);
    if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) return galat('Tahun harus antara 2000 dan 2100.');

    const n = (x: unknown) => Math.max(0, Math.round((Number(x) || 0) * 1000) / 1000);
    const isiBlok = (b.blok && typeof b.blok === 'object') ? b.blok as Record<string, unknown> : {};
    const blok = JSON.stringify(Object.fromEntries(Object.entries(isiBlok).map(([nama, luas]) => [nama, n(luas)])));

    await env.DB.prepare(
      `INSERT INTO revegetasi (tahun, apl, hutan, ipd, opd, timbunan_soil, fasilitas, blok, catatan, diubah_pada)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
       ON CONFLICT(tahun) DO UPDATE SET
         apl = ?2, hutan = ?3, ipd = ?4, opd = ?5, timbunan_soil = ?6, fasilitas = ?7,
         blok = ?8, catatan = ?9, diubah_pada = ?10`,
    ).bind(
      tahun, n(b.apl), n(b.hutan), n(b.ipd), n(b.opd), n(b.timbunan_soil), n(b.fasilitas),
      blok, (b.catatan as string) || `diisi ${pengguna.nama}`, sekarangUtcIso(),
    ).run();
    return json({ ok: true, tahun }, 201);
  }

  // ---------- Memo: pribadi & Memo Internal tim ----------
  if (jalur === '/api/memo' && req.method === 'GET') {
    const lingkup = url.searchParams.get('lingkup') === 'tim' ? 'tim' : 'pribadi';
    const { results } = lingkup === 'tim'
      ? await env.DB.prepare(
          `SELECT m.*, t.nama AS penulis FROM memo m LEFT JOIN tim t ON t.id = m.user_id
            WHERE m.lingkup = 'tim'
            ORDER BY COALESCE(m.tanggal, substr(m.dibuat_pada, 1, 10)) DESC, m.dibuat_pada DESC`,
        ).all()
      : await env.DB.prepare(
          `SELECT m.*, t.nama AS penulis FROM memo m LEFT JOIN tim t ON t.id = m.user_id
            WHERE m.lingkup = 'pribadi' AND m.user_id = ?1
            ORDER BY m.disematkan DESC, COALESCE(m.diubah_pada, m.dibuat_pada) DESC`,
        ).bind(pengguna.id).all();
    return json({ memo: results, lingkup });
  }

  if (jalur === '/api/memo' && req.method === 'POST') {
    const b = (await req.json()) as Record<string, string | undefined>;
    const lingkup = b.lingkup === 'tim' ? 'tim' : 'pribadi';
    if (lingkup === 'tim' && pengguna.peran === 'pemantau') return galat('Peran Pemantau hanya bisa membaca memo tim.', 403);

    const id = `memo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    await env.DB.prepare(
      `INSERT INTO memo (id, user_id, lingkup, judul, isi, ringkasan, kategori, tipe, status, tanggal, warna, dibuat_pada)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
    ).bind(
      id, pengguna.id, lingkup, b.judul ?? '', b.isi ?? '', b.ringkasan ?? null,
      b.kategori ?? null, b.tipe ?? null, b.status ?? null,
      b.tanggal ?? (lingkup === 'tim' ? tanggalWita() : null), b.warna ?? null, sekarangUtcIso(),
    ).run();
    return json({ id }, 201);
  }

  const cocokMemo = jalur.match(/^\/api\/memo\/([\w-]+)$/);
  if (cocokMemo) {
    const memo = await env.DB.prepare('SELECT id, user_id, lingkup FROM memo WHERE id = ?1')
      .bind(cocokMemo[1]).first<{ id: string; user_id: string; lingkup: string }>();
    // Memo pribadi milik orang lain diperlakukan seolah tidak ada.
    if (!memo || (memo.lingkup !== 'tim' && memo.user_id !== pengguna.id)) return galat('Memo tidak ditemukan.', 404);
    const bolehUbah = memo.user_id === pengguna.id || (memo.lingkup === 'tim' && bolehUbahKunci(pengguna));
    if (!bolehUbah) return galat('Hanya penulis, Supervisor, atau Admin yang boleh mengubah memo tim.', 403);

    if (req.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM memo WHERE id = ?1').bind(cocokMemo[1]).run();
      return json({ ok: true });
    }
    if (req.method === 'PATCH') {
      const b = (await req.json()) as Record<string, unknown>;
      const kolom = ['judul', 'isi', 'disematkan', 'warna', 'ringkasan', 'kategori', 'tipe', 'status', 'tanggal'].filter((k) => k in b);
      if (kolom.length === 0) return json({ ok: true });
      const set = kolom.map((k, i) => `${k} = ?${i + 2}`).join(', ');
      await env.DB.prepare(`UPDATE memo SET ${set}, diubah_pada = ?${kolom.length + 2} WHERE id = ?1`)
        .bind(cocokMemo[1], ...kolom.map((k) => (k === 'disematkan' ? (b[k] ? 1 : 0) : b[k])), sekarangUtcIso())
        .run();
      return json({ ok: true });
    }
  }

  return null;
}
