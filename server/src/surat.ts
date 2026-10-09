/**
 * Kotak Surat: pesan antar anggota (seperti email) dan pemberitahuan sistem.
 *
 *   GET  /api/surat/jumlah                 { pesan, sistem, belum } surat belum dibaca
 *   GET  /api/surat?kotak=masuk|terkirim|sistem
 *   GET  /api/surat/pesan/:id              satu utas (pesan + balasannya); menandai dibaca
 *   POST /api/surat/pesan                  { penerima[], subjek, isi, tautan?, penting?, jenis?, induk_id?, lampiran? }
 *   POST /api/surat/pesan/:id/arsip        sembunyikan dari kotak masuk saya
 *   POST /api/surat/sistem/:id/baca        · POST /api/surat/sistem/baca-semua
 *   GET  /api/surat/ringkasan-saya         draf "Kirim progres saya" dari kerja hari ini
 *
 * Pesan bersifat pribadi antara pengirim dan penerimanya — Admin pun tidak bisa
 * membaca pesan orang lain. Surat biasa ikut ringkasan notifikasi 12.00; hanya yang
 * bertanda Penting yang langsung dikirim ke HP (Web Push).
 */

import type { Env, Pengguna } from './tipe';
import { sekarangUtcIso, tanggalWita } from './waktu';
import { beriXp } from './xp';
import { kirimPushLangsung } from './push';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);
const idBaru = (awal: string) => `${awal}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export interface TautanSurat { jenis: 'pica' | 'memo' | 'tab'; id: string; label?: string }

const tautanSah = (v: unknown): TautanSurat | null => {
  if (!v || typeof v !== 'object') return null;
  const t = v as Record<string, unknown>;
  if (!['pica', 'memo', 'tab'].includes(String(t.jenis)) || typeof t.id !== 'string' || !t.id) return null;
  return { jenis: t.jenis as TautanSurat['jenis'], id: t.id.slice(0, 80), label: typeof t.label === 'string' ? t.label.slice(0, 160) : undefined };
};

// ---------------------------------------------------------------------------
// Pemberitahuan sistem (dipakai modul lain)
// ---------------------------------------------------------------------------

/** Satu surat sistem ke satu orang. Penting = juga langsung ke HP (Web Push). Tidak pernah melempar galat. */
export async function kirimSuratSistem(
  env: Env,
  userId: string | null | undefined,
  s: { jenis: string; judul: string; isi?: string; tautan?: TautanSurat | null; penting?: boolean },
): Promise<void> {
  if (!userId) return;
  try {
    await env.DB.prepare(
      `INSERT INTO kotak_surat (id, user_id, jenis, judul, isi, tautan, penting, dibuat_pada) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
    ).bind(idBaru('srt'), userId, s.jenis, s.judul.slice(0, 200), s.isi?.slice(0, 1000) ?? null, s.tautan ? JSON.stringify(s.tautan) : null, s.penting ? 1 : 0, sekarangUtcIso()).run();
    if (s.penting) await kirimPushLangsung(env, userId, { judul: s.judul, isi: s.isi ?? 'Buka Kotak Surat di POKEMONKEY', tab: 'habitat' });
  } catch { /* surat gagal tidak boleh menggagalkan aksi utama */ }
}

/** Jumlah surat belum dibaca (dipakai juga ringkasan notifikasi 12.00). */
export async function jumlahSuratBelum(env: Env, userId: string): Promise<{ pesan: number; sistem: number; belum: number }> {
  const [p, s] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM pesan_penerima WHERE user_id = ?1 AND dibaca_pada IS NULL AND diarsip = 0').bind(userId).first<{ n: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM kotak_surat WHERE user_id = ?1 AND dibaca_pada IS NULL').bind(userId).first<{ n: number }>(),
  ]);
  const pesan = Number(p?.n ?? 0);
  const sistem = Number(s?.n ?? 0);
  return { pesan, sistem, belum: pesan + sistem };
}

/** Cron: surat sistem lebih dari 90 hari dibersihkan. */
export async function bersihkanKotakSurat(env: Env): Promise<void> {
  const batas = new Date(Date.now() - 90 * 86_400_000).toISOString();
  await env.DB.prepare('DELETE FROM kotak_surat WHERE dibuat_pada < ?1').bind(batas).run();
}

/**
 * Anggota menulis update pada PICA: permintaan progres untuk PICA itu yang ditujukan
 * kepadanya dijawab otomatis — peminta menerima update itu di Kotak Surat.
 */
export async function jawabMintaProgres(env: Env, pengguna: Pengguna, picaId: string, catatan: string): Promise<void> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.pengirim, p.subjek FROM pesan p JOIN pesan_penerima r ON r.pesan_id = p.id
        WHERE r.user_id = ?1 AND p.jenis = 'minta_progres' AND json_extract(p.tautan, '$.id') = ?2
          AND NOT EXISTS (SELECT 1 FROM pesan b WHERE b.induk_id = p.id AND b.pengirim = ?1 AND b.jenis = 'progres')
        LIMIT 5`,
    ).bind(pengguna.id, picaId).all<{ id: string; pengirim: string; subjek: string }>();
    for (const m of results) {
      await simpanPesan(env, pengguna, {
        penerima: [m.pengirim], subjek: `Re: ${m.subjek}`, isi: `Progres terbaru:\n${catatan}`,
        jenis: 'progres', induk_id: m.id, tautan: { jenis: 'pica', id: picaId }, penting: false, lampiran: [],
      });
    }
  } catch { /* abaikan */ }
}

// ---------------------------------------------------------------------------
// Pesan
// ---------------------------------------------------------------------------

interface PesanBaru {
  penerima: string[]; subjek: string; isi: string; tautan: TautanSurat | null; penting: boolean;
  jenis: 'pesan' | 'minta_progres' | 'progres'; induk_id: string | null; lampiran: { nama: string; kunci: string }[];
}

async function simpanPesan(env: Env, pengguna: Pengguna, p: PesanBaru): Promise<string> {
  const id = idBaru('psn');
  const kini = sekarangUtcIso();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO pesan (id, pengirim, subjek, isi, tautan, jenis, penting, induk_id, lampiran, dibuat_pada)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`,
    ).bind(id, pengguna.id, p.subjek, p.isi, p.tautan ? JSON.stringify(p.tautan) : null, p.jenis, p.penting ? 1 : 0, p.induk_id,
      p.lampiran.length ? JSON.stringify(p.lampiran) : null, kini),
    ...p.penerima.map((u) => env.DB.prepare('INSERT OR IGNORE INTO pesan_penerima (pesan_id, user_id) VALUES (?1, ?2)').bind(id, u)),
  ]);
  if (p.penting) {
    for (const u of p.penerima) await kirimPushLangsung(env, u, { judul: `✉ ${pengguna.nama}: ${p.subjek}`, isi: p.isi.slice(0, 140) });
  }
  return id;
}

/** Akar utas sebuah pesan. */
async function akarUtas(env: Env, id: string): Promise<string> {
  const r = await env.DB.prepare('SELECT induk_id FROM pesan WHERE id = ?1').bind(id).first<{ induk_id: string | null }>();
  return r?.induk_id ?? id;
}

/** Saya boleh melihat utas bila saya pengirim atau penerima salah satu pesannya. */
async function bolehUtas(env: Env, akar: string, userId: string): Promise<boolean> {
  const r = await env.DB.prepare(
    `SELECT 1 FROM pesan p LEFT JOIN pesan_penerima r ON r.pesan_id = p.id
      WHERE (p.id = ?1 OR p.induk_id = ?1) AND (p.pengirim = ?2 OR r.user_id = ?2) LIMIT 1`,
  ).bind(akar, userId).first();
  return Boolean(r);
}

export async function ruteSurat(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (!jalur.startsWith('/api/surat')) return null;
  const url = new URL(req.url);

  if (jalur === '/api/surat/jumlah' && req.method === 'GET') return json(await jumlahSuratBelum(env, pengguna.id));

  if (jalur === '/api/surat' && req.method === 'GET') {
    const kotak = url.searchParams.get('kotak') ?? 'masuk';
    if (kotak === 'sistem') {
      const { results } = await env.DB.prepare(
        'SELECT id, jenis, judul, isi, tautan, penting, dibuat_pada, dibaca_pada FROM kotak_surat WHERE user_id = ?1 ORDER BY dibuat_pada DESC LIMIT 200',
      ).bind(pengguna.id).all();
      return json({ surat: results });
    }
    if (kotak === 'terkirim') {
      const { results } = await env.DB.prepare(
        `SELECT p.id, p.pengirim, p.subjek, substr(p.isi, 1, 160) AS cuplikan, p.jenis, p.penting, p.induk_id, p.tautan, p.dibuat_pada,
                (SELECT group_concat(t.nama, ', ') FROM pesan_penerima r JOIN tim t ON t.id = r.user_id WHERE r.pesan_id = p.id) AS penerima_nama,
                1 AS dibaca
           FROM pesan p WHERE p.pengirim = ?1 ORDER BY p.dibuat_pada DESC LIMIT 200`,
      ).bind(pengguna.id).all();
      return json({ surat: results });
    }
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.pengirim, t.nama AS pengirim_nama, p.subjek, substr(p.isi, 1, 160) AS cuplikan, p.jenis, p.penting, p.induk_id, p.tautan,
              p.dibuat_pada, CASE WHEN r.dibaca_pada IS NULL THEN 0 ELSE 1 END AS dibaca
         FROM pesan_penerima r JOIN pesan p ON p.id = r.pesan_id LEFT JOIN tim t ON t.id = p.pengirim
        WHERE r.user_id = ?1 AND r.diarsip = 0 ORDER BY p.dibuat_pada DESC LIMIT 200`,
    ).bind(pengguna.id).all();
    return json({ surat: results });
  }

  const cocokUtas = jalur.match(/^\/api\/surat\/pesan\/([\w-]+)$/);
  if (cocokUtas && req.method === 'GET') {
    const akar = await akarUtas(env, cocokUtas[1]);
    if (!(await bolehUtas(env, akar, pengguna.id))) return galat('Pesan tidak ditemukan.', 404);
    const { results } = await env.DB.prepare(
      `SELECT p.*, t.nama AS pengirim_nama,
              (SELECT json_group_array(json_object('id', r.user_id, 'nama', u.nama, 'dibaca_pada', r.dibaca_pada))
                 FROM pesan_penerima r LEFT JOIN tim u ON u.id = r.user_id WHERE r.pesan_id = p.id) AS penerima
         FROM pesan p LEFT JOIN tim t ON t.id = p.pengirim
        WHERE p.id = ?1 OR p.induk_id = ?1 ORDER BY p.dibuat_pada`,
    ).bind(akar).all<Record<string, unknown>>();
    await env.DB.prepare(
      `UPDATE pesan_penerima SET dibaca_pada = ?2
        WHERE user_id = ?1 AND dibaca_pada IS NULL AND pesan_id IN (SELECT id FROM pesan WHERE id = ?3 OR induk_id = ?3)`,
    ).bind(pengguna.id, sekarangUtcIso(), akar).run();
    return json({ utas: results.map((r) => ({ ...r, penerima: JSON.parse(String(r.penerima ?? '[]')) })) });
  }

  if (jalur === '/api/surat/pesan' && req.method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const subjek = String(b.subjek ?? '').trim().slice(0, 160);
    const isi = String(b.isi ?? '').trim().slice(0, 8000);
    if (!isi) return galat('Isi pesan masih kosong.');
    const jenis = b.jenis === 'minta_progres' || b.jenis === 'progres' ? b.jenis : 'pesan';
    let induk: string | null = null;
    let penerima = Array.isArray(b.penerima) ? [...new Set(b.penerima.map(String))].slice(0, 30) : [];
    if (typeof b.induk_id === 'string' && b.induk_id) {
      induk = await akarUtas(env, b.induk_id);
      if (!(await bolehUtas(env, induk, pengguna.id))) return galat('Pesan yang dibalas tidak ditemukan.', 404);
      // Balas: ke semua peserta utas selain saya.
      const { results } = await env.DB.prepare(
        `SELECT p.pengirim AS u FROM pesan p WHERE p.id = ?1 OR p.induk_id = ?1
         UNION SELECT r.user_id FROM pesan_penerima r JOIN pesan p ON p.id = r.pesan_id WHERE p.id = ?1 OR p.induk_id = ?1`,
      ).bind(induk).all<{ u: string }>();
      if (penerima.length === 0) penerima = results.map((r) => r.u);
    }
    penerima = penerima.filter((u) => u !== pengguna.id);
    if (penerima.length === 0) return galat('Pilih paling sedikit satu penerima.');
    const { results: ada } = await env.DB.prepare('SELECT id FROM tim WHERE aktif = 1 AND id IN (SELECT value FROM json_each(?1))')
      .bind(JSON.stringify(penerima)).all<{ id: string }>();
    penerima = ada.map((r) => r.id);
    if (penerima.length === 0) return galat('Penerima tidak ditemukan.');
    const lampiran = Array.isArray(b.lampiran)
      ? (b.lampiran as { nama?: unknown; kunci?: unknown }[]).filter((x) => typeof x?.kunci === 'string').slice(0, 10)
        .map((x) => ({ nama: String(x.nama ?? 'berkas').slice(0, 120), kunci: String(x.kunci) }))
      : [];
    const id = await simpanPesan(env, pengguna, {
      penerima, subjek: subjek || (induk ? 'Balasan' : '(tanpa subjek)'), isi, jenis, induk_id: induk,
      tautan: tautanSah(b.tautan), penting: Boolean(b.penting), lampiran,
    });
    await beriXp(env, pengguna, 'pesan_kirim', id, { pelaku: pengguna });
    return json({ id, induk_id: induk }, 201);
  }

  const cocokArsip = jalur.match(/^\/api\/surat\/pesan\/([\w-]+)\/arsip$/);
  if (cocokArsip && req.method === 'POST') {
    await env.DB.prepare('UPDATE pesan_penerima SET diarsip = 1, dibaca_pada = COALESCE(dibaca_pada, ?3) WHERE pesan_id = ?1 AND user_id = ?2')
      .bind(cocokArsip[1], pengguna.id, sekarangUtcIso()).run();
    return json({ ok: true });
  }

  if (jalur === '/api/surat/sistem/baca-semua' && req.method === 'POST') {
    await env.DB.prepare('UPDATE kotak_surat SET dibaca_pada = ?2 WHERE user_id = ?1 AND dibaca_pada IS NULL').bind(pengguna.id, sekarangUtcIso()).run();
    return json({ ok: true });
  }
  const cocokBaca = jalur.match(/^\/api\/surat\/sistem\/([\w-]+)\/baca$/);
  if (cocokBaca && req.method === 'POST') {
    await env.DB.prepare('UPDATE kotak_surat SET dibaca_pada = COALESCE(dibaca_pada, ?3) WHERE id = ?1 AND user_id = ?2')
      .bind(cocokBaca[1], pengguna.id, sekarangUtcIso()).run();
    return json({ ok: true });
  }

  if (jalur === '/api/surat/ringkasan-saya' && req.method === 'GET') {
    const hari = tanggalWita();
    const [lap, upd, tutup] = await Promise.all([
      env.DB.prepare(
        `SELECT jenis, capaian, satuan, catatan FROM laporan WHERE user_id = ?1 AND substr(datetime(dibuat_pada, '+8 hours'), 1, 10) = ?2 ORDER BY dibuat_pada`,
      ).bind(pengguna.id, hari).all<{ jenis: string | null; capaian: number | null; satuan: string | null; catatan: string | null }>(),
      env.DB.prepare(
        `SELECT p.judul, u.catatan FROM pica_update u JOIN pica p ON p.id = u.pica_id
          WHERE u.oleh = ?1 AND substr(datetime(u.pada, '+8 hours'), 1, 10) = ?2 ORDER BY u.pada`,
      ).bind(pengguna.id, hari).all<{ judul: string; catatan: string }>(),
      env.DB.prepare(
        `SELECT judul FROM pica WHERE pic_id = ?1 AND status = 'Closed' AND substr(datetime(ditutup_pada, '+8 hours'), 1, 10) = ?2`,
      ).bind(pengguna.id, hari).all<{ judul: string }>(),
    ]);
    const baris: string[] = [`Progres kerja ${hari}:`];
    if (lap.results.length) {
      baris.push('', 'Laporan lapangan:');
      for (const l of lap.results) baris.push(`- ${l.jenis ?? 'Kegiatan'}${l.capaian ? ` · ${l.capaian} ${l.satuan ?? ''}` : ''}${l.catatan ? ` — ${l.catatan}` : ''}`);
    }
    if (upd.results.length) {
      baris.push('', 'Update PICA:');
      for (const u of upd.results) baris.push(`- ${u.judul}: ${u.catatan}`);
    }
    if (tutup.results.length) {
      baris.push('', 'PICA ditutup:');
      for (const t of tutup.results) baris.push(`- ${t.judul}`);
    }
    if (baris.length === 1) baris.push('', '(Belum ada laporan atau update PICA hari ini — tulis progresnya di sini.)');
    return json({ subjek: `Progres kerja ${hari}`, isi: baris.join('\n') });
  }

  return null;
}
