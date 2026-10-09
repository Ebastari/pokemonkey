/**
 * Rute untuk fitur game yang sudah ada di aplikasi:
 *   - profil XP, level, dan skin milik tiap orang
 *   - kehadiran pemain lain di layar KEBUN
 *   - misi global yang dikerjakan bersama
 *
 * Mengembalikan null bila jalur bukan milik modul ini, supaya router utama
 * bisa lanjut mencocokkan rute lain.
 */

import type { Env, Pengguna } from './tipe';
import { sekarangUtcIso } from './waktu';
import { adalahAdmin, bolehUbahKunci } from './auth';
import { beriXpSemua, sahkanSkin } from './xp';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

interface BarisProfil {
  user_id: string;
  xp: number;
  level: number;
  skin_aktif: string;
  skin_dimiliki: string;
  luas_tanam: number;
  pos_x: number | null;
  pos_y: number | null;
  stamina: number | null;
  terakhir_aktif: string | null;
  status_teks: string | null;
}

/** Teks di atas kepala monyet: satu baris, maksimal 60 karakter; kosong = sapaan bawaan. */
const BATAS_STATUS = 60;
function rapikanStatus(v: unknown): string | null {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, BATAS_STATUS);
  return t || null;
}

function bentukProfil(p: BarisProfil) {
  return { ...p, skin_dimiliki: JSON.parse(p.skin_dimiliki || '["classic"]') as string[] };
}

export async function ruteGame(
  jalur: string,
  req: Request,
  env: Env,
  pengguna: Pengguna,
): Promise<Response | null> {
  // ---------- Profil ----------
  if (jalur === '/api/profil' && req.method === 'GET') {
    await env.DB.prepare('INSERT OR IGNORE INTO profil_game (user_id) VALUES (?1)').bind(pengguna.id).run();
    const p = await env.DB.prepare('SELECT * FROM profil_game WHERE user_id = ?1')
      .bind(pengguna.id)
      .first<BarisProfil>();
    return json({ profil: p ? bentukProfil(p) : null });
  }

  if (jalur === '/api/profil' && req.method === 'POST') {
    const b = (await req.json()) as Partial<{
      xp: number;
      level: number;
      skin_aktif: string;
      skin_dimiliki: string[];
      luas_tanam: number;
      pos_x: number;
      pos_y: number;
      stamina: number;
      status_teks: string | null;
    }>;
    // Kolom ini boleh dikosongkan, jadi dibedakan "tidak dikirim" dari "dikirim kosong".
    const ubahStatus = 'status_teks' in b ? 1 : 0;

    // XP dan level dihitung server (docs/sistem-xp.md): angka dari aplikasi diabaikan.
    // Skin baru (termasuk dari APK lama yang membeli dengan mengurangi XP sendiri) hanya
    // diterima bila saldo cukup; skin aktif harus skin yang dimiliki.
    b.xp = undefined;
    b.level = undefined;
    const skinSah = b.skin_dimiliki ? await sahkanSkin(env, pengguna.id, b.skin_dimiliki.map(String)) : null;
    if (b.skin_aktif) {
      const milik = skinSah ?? (await sahkanSkin(env, pengguna.id, []));
      if (!milik.includes(b.skin_aktif)) b.skin_aktif = undefined;
    }

    await env.DB.prepare(
      `INSERT INTO profil_game (user_id, xp, level, skin_aktif, skin_dimiliki, luas_tanam, pos_x, pos_y, stamina, terakhir_aktif, status_teks)
       VALUES (?1, COALESCE(?2,0), COALESCE(?3,1), COALESCE(?4,'classic'), COALESCE(?5,'["classic"]'), COALESCE(?6,0), ?7, ?8, ?9, ?10, ?12)
       ON CONFLICT(user_id) DO UPDATE SET
         xp             = COALESCE(?2, xp),
         level          = COALESCE(?3, level),
         skin_aktif     = COALESCE(?4, skin_aktif),
         skin_dimiliki  = COALESCE(?5, skin_dimiliki),
         luas_tanam     = COALESCE(?6, luas_tanam),
         pos_x          = COALESCE(?7, pos_x),
         pos_y          = COALESCE(?8, pos_y),
         stamina        = COALESCE(?9, stamina),
         terakhir_aktif = ?10,
         status_teks    = CASE WHEN ?11 = 1 THEN ?12 ELSE status_teks END`,
    )
      .bind(
        pengguna.id,
        b.xp ?? null,
        b.level ?? null,
        b.skin_aktif ?? null,
        skinSah ? JSON.stringify(skinSah) : null,
        b.luas_tanam ?? null,
        b.pos_x ?? null,
        b.pos_y ?? null,
        b.stamina ?? null,
        sekarangUtcIso(),
        ubahStatus,
        ubahStatus ? rapikanStatus(b.status_teks) : null,
      )
      .run();

    return json({ ok: true });
  }

  // ---------- Pemain lain yang aktif 24 jam terakhir ----------
  if (jalur === '/api/kehadiran' && req.method === 'GET') {
    // Yang sedang membuka KEBUN otomatis tercatat hadir (juga untuk APK lama
    // yang detak berkalanya tidak jalan).
    await env.DB.prepare('UPDATE profil_game SET terakhir_aktif = ?2 WHERE user_id = ?1')
      .bind(pengguna.id, sekarangUtcIso())
      .run();
    const batas = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { results } = await env.DB.prepare(
      `SELECT p.user_id AS userId, t.nama AS name, p.skin_aktif AS skinId,
              COALESCE(p.pos_x, 50) AS posX, COALESCE(p.pos_y, 50) AS posY,
              COALESCE(p.stamina, 100) AS stamina, p.level, p.status_teks AS status
         FROM profil_game p JOIN tim t ON t.id = p.user_id
        WHERE p.terakhir_aktif >= ?1 AND t.aktif = 1`,
    )
      .bind(batas)
      .all();
    return json({ aktif: results });
  }

  // ---------- Papan peringkat ----------
  if (jalur === '/api/peringkat' && req.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT t.id, t.nama AS name, COALESCE(p.xp,0) AS xp, COALESCE(p.level,1) AS level,
              COALESCE(p.luas_tanam,0) AS totalHa, p.terakhir_aktif AS lastActive
         FROM tim t LEFT JOIN profil_game p ON p.user_id = t.id
        WHERE t.aktif = 1 ORDER BY xp DESC`,
    ).all();
    return json({ peringkat: results });
  }

  // ---------- Misi global (Quest Journal) — kini data yang bisa diubah Admin ----------
  if (jalur === '/api/misi' && req.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM misi_global WHERE aktif = 1 ORDER BY urutan, id',
    ).all();
    return json({ misi: results });
  }

  if (jalur === '/api/misi' && req.method === 'POST') {
    if (!bolehUbahKunci(pengguna)) return json({ galat: 'Hanya Admin dan Supervisor yang boleh menambah misi.' }, 403);
    const b = (await req.json()) as Record<string, unknown>;
    if (!b.judul) return json({ galat: 'Judul misi wajib diisi.' }, 400);
    const id = `m_${Date.now().toString(36)}`;
    await env.DB.prepare(
      `INSERT INTO misi_global (id, judul, tipe, deskripsi, target, satuan, xp, kapasitas, urutan, aktif, status, current)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,(SELECT COALESCE(MAX(urutan),0)+1 FROM misi_global),1,'AVAILABLE',0)`,
    )
      .bind(id, b.judul, b.tipe ?? 'NURSERY', b.deskripsi ?? null, Number(b.target ?? 100), b.satuan ?? 'Ha',
            Number(b.xp ?? 500), Number(b.kapasitas ?? 1.66))
      .run();
    return json({ id }, 201);
  }

  const cocokMisi = jalur.match(/^\/api\/misi\/([\w-]+)$/);
  if (cocokMisi && req.method === 'PATCH') {
    if (!bolehUbahKunci(pengguna)) return json({ galat: 'Hanya Admin dan Supervisor yang boleh mengubah misi.' }, 403);
    const b = (await req.json()) as Record<string, unknown>;
    const kolom = ['judul', 'tipe', 'deskripsi', 'target', 'satuan', 'xp', 'kapasitas', 'urutan', 'status', 'current'].filter((k) => k in b);
    if (kolom.length === 0) return json({ ok: true });
    const set = kolom.map((k, i) => `${k} = ?${i + 2}`).join(', ');
    await env.DB.prepare(`UPDATE misi_global SET ${set}, diubah_pada = ?${kolom.length + 2} WHERE id = ?1`)
      .bind(cocokMisi[1], ...kolom.map((k) => b[k]), sekarangUtcIso())
      .run();
    return json({ ok: true });
  }
  if (cocokMisi && req.method === 'DELETE') {
    if (!bolehUbahKunci(pengguna)) return json({ galat: 'Hanya Admin dan Supervisor yang boleh menghapus misi.' }, 403);
    await env.DB.prepare('UPDATE misi_global SET aktif = 0, diubah_pada = ?2 WHERE id = ?1')
      .bind(cocokMisi[1], sekarangUtcIso()).run();
    return json({ ok: true });
  }

  const cocokMulai = jalur.match(/^\/api\/misi\/([\w-]+)\/mulai$/);
  if (cocokMulai && req.method === 'POST') {
    await env.DB.prepare(
      `UPDATE misi_global SET status = 'IN_PROGRESS', diubah_pada = ?2
        WHERE id = ?1 AND status = 'AVAILABLE'`,
    )
      .bind(cocokMulai[1], sekarangUtcIso())
      .run();
    return json({ ok: true });
  }

  const cocokTambah = jalur.match(/^\/api\/misi\/([\w-]+)\/tambah$/);
  if (cocokTambah && req.method === 'POST') {
    const b = (await req.json()) as { nilai?: number; target?: number; luas?: number; xp?: number };
    const nilai = Number(b.nilai ?? 0);
    const target = Number(b.target ?? 0);
    const statusSebelum = await env.DB.prepare('SELECT status FROM misi_global WHERE id = ?1').bind(cocokTambah[1]).first<{ status: string }>();

    const hasil = await env.DB.prepare(
      `UPDATE misi_global
          SET current = MIN(?3, current + ?2),
              status  = CASE WHEN current + ?2 >= ?3 THEN 'COMPLETED' ELSE status END,
              diubah_pada = ?4
        WHERE id = ?1
        RETURNING status, current`,
    )
      .bind(cocokTambah[1], nilai, target, sekarangUtcIso())
      .first<{ status: string; current: number }>();

    // Luas tanam dijumlah di server. XP laporan sudah dicatat oleh /api/laporan (buku besar XP).
    if (b.luas) {
      await env.DB.prepare('UPDATE profil_game SET luas_tanam = luas_tanam + ?2, terakhir_aktif = ?3 WHERE user_id = ?1')
        .bind(pengguna.id, b.luas, sekarangUtcIso())
        .run();
    }
    if (hasil?.status === 'COMPLETED' && statusSebelum?.status !== 'COMPLETED') {
      await beriXpSemua(env, 'quest_selesai', cocokTambah[1], pengguna);
    }

    return json({ ok: true, misi: hasil });
  }

  return null;
}
