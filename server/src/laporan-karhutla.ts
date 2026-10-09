/**
 * FIRE: rekap titik api per bulan dan arsip laporan karhutla yang sudah diekspor.
 *
 * Alur di layar: tabel harian (titik sebulan) → form → PDF → unggah ke sini →
 * kirim manual lewat WhatsApp (layar mencatatnya dengan /kirim).
 *
 * PDF dan isi laporan (JSON, termasuk foto) ada di R2; tabel laporan_karhutla
 * hanya menyimpan ringkasan untuk daftar dan status kirim. Mengekspor ulang
 * laporan yang sama menimpa berkasnya (id tetap).
 */

import type { Env, Pengguna } from './tipe';
import { beriXp } from './xp';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);

const bolehTulis = (p: Pengguna) => p.peran !== 'pemantau';
const bolehKelola = (p: Pengguna) => p.peran === 'admin' || p.peran === 'supervisor';
const polaBulan = /^\d{4}-\d{2}$/;

/** Batas UTC satu bulan WITA: 1 Sep 00.00 WITA = 31 Agu 16.00 UTC. */
function rentangBulanWita(bulan: string): [string, string] {
  const [y, m] = bulan.split('-').map(Number);
  const awal = new Date(Date.UTC(y, m - 1, 1) - 8 * 3600_000).toISOString();
  const akhir = new Date(Date.UTC(y, m, 1) - 8 * 3600_000).toISOString();
  return [awal, akhir];
}

const SELECT_LAPORAN = `SELECT k.*, t1.nama AS dibuat_nama, t2.nama AS dikirim_nama
  FROM laporan_karhutla k
  LEFT JOIN tim t1 ON t1.id = k.dibuat_oleh
  LEFT JOIN tim t2 ON t2.id = k.dikirim_oleh`;

async function simpanLaporan(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!bolehTulis(pengguna)) return galat('Akun pemantau tidak boleh mengunggah laporan.', 403);
  const form = await req.formData();
  const pdf = form.get('pdf');
  const data = form.get('data');
  let meta: Record<string, unknown>;
  try { meta = JSON.parse(String(form.get('meta') ?? '{}')); } catch { return galat('meta bukan JSON.'); }

  if (!(pdf instanceof File)) return galat('Berkas PDF tidak ditemukan.');
  if (pdf.size > 15 * 1024 * 1024) return galat('Ukuran PDF maksimal 15 MB.');
  if (typeof data !== 'string' || !data.startsWith('{')) return galat('Isi laporan tidak ditemukan.');

  const id = String(meta.id ?? '').replace(/[^\w-]/g, '').slice(0, 80);
  const hari = String(meta.hari_titik ?? '');
  if (!id) return galat('id laporan wajib diisi.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hari)) return galat('hari_titik harus YYYY-MM-DD.');

  const lama = await env.DB.prepare('SELECT dibuat_oleh FROM laporan_karhutla WHERE id = ?1').bind(id).first<{ dibuat_oleh: string | null }>();
  if (lama && lama.dibuat_oleh !== pengguna.id && !bolehKelola(pengguna)) return galat('Laporan ini milik anggota lain.', 403);

  const pdfKunci = `karhutla/${id}/laporan.pdf`;
  const dataKunci = `karhutla/${id}/data.json`;
  await Promise.all([
    env.BUKET.put(pdfKunci, pdf.stream(), { httpMetadata: { contentType: 'application/pdf' } }),
    env.BUKET.put(dataKunci, data, { httpMetadata: { contentType: 'application/json' } }),
  ]);

  const teks = (v: unknown, maks = 300) => String(v ?? '').slice(0, maks);
  const kini = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO laporan_karhutla (id, nomor, judul, hari_titik, tanggal_lapor, jenis_izin, area, jumlah_titik, titik_ids,
       pdf_kunci, data_kunci, dibuat_oleh, dibuat_pada, diekspor_pada)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?13)
     ON CONFLICT(id) DO UPDATE SET nomor = excluded.nomor, judul = excluded.judul, hari_titik = excluded.hari_titik,
       tanggal_lapor = excluded.tanggal_lapor, jenis_izin = excluded.jenis_izin, area = excluded.area,
       jumlah_titik = excluded.jumlah_titik, titik_ids = excluded.titik_ids, diekspor_pada = excluded.diekspor_pada`,
  ).bind(
    id, teks(meta.nomor, 120), teks(meta.judul), hari, teks(meta.tanggal_lapor, 10) || hari, teks(meta.jenis_izin, 40),
    teks(meta.area, 80), Math.max(0, Math.round(Number(meta.jumlah_titik) || 0)),
    JSON.stringify(Array.isArray(meta.titik_ids) ? meta.titik_ids.slice(0, 200).map(String) : []),
    pdfKunci, dataKunci, pengguna.id, kini,
  ).run();
  await beriXp(env, pengguna, 'karhutla_laporan', id, { pelaku: pengguna });

  return json({ laporan: await env.DB.prepare(`${SELECT_LAPORAN} WHERE k.id = ?1`).bind(id).first() }, 201);
}

export async function ruteLaporanKarhutla(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (!jalur.startsWith('/api/karhutla')) return null;
  const url = new URL(req.url);

  // Titik sebulan (untuk tabel harian) + laporan bulan itu.
  if (jalur === '/api/karhutla/bulan' && req.method === 'GET') {
    const bulan = url.searchParams.get('bulan') ?? '';
    if (!polaBulan.test(bulan)) return galat('bulan harus YYYY-MM.');
    const [awal, akhir] = rentangBulanWita(bulan);
    const [titik, laporan] = await Promise.all([
      env.DB.prepare(
        `SELECT id, sumber, lat, lon, waktu, keyakinan, frp, zona, bidang, area, status, catatan
           FROM titik_api WHERE waktu >= ?1 AND waktu < ?2 ORDER BY waktu DESC LIMIT 2000`,
      ).bind(awal, akhir).all(),
      env.DB.prepare(`${SELECT_LAPORAN} WHERE k.hari_titik LIKE ?1 ORDER BY k.hari_titik DESC, k.diekspor_pada DESC`)
        .bind(`${bulan}%`).all(),
    ]);
    return json({ bulan, titik: titik.results, laporan: laporan.results });
  }

  if (jalur === '/api/karhutla/laporan' && req.method === 'GET') {
    const bulan = url.searchParams.get('bulan');
    const q = bulan && polaBulan.test(bulan)
      ? env.DB.prepare(`${SELECT_LAPORAN} WHERE k.hari_titik LIKE ?1 ORDER BY k.hari_titik DESC, k.diekspor_pada DESC`).bind(`${bulan}%`)
      : env.DB.prepare(`${SELECT_LAPORAN} ORDER BY k.hari_titik DESC, k.diekspor_pada DESC LIMIT 300`);
    return json({ laporan: (await q.all()).results });
  }

  if (jalur === '/api/karhutla/laporan' && req.method === 'POST') return simpanLaporan(req, env, pengguna);

  const cocokKirim = jalur.match(/^\/api\/karhutla\/laporan\/([\w-]+)\/kirim$/);
  if (cocokKirim && req.method === 'POST') {
    if (!bolehTulis(pengguna)) return galat('Akun pemantau tidak boleh menandai kiriman.', 403);
    const r = await env.DB.prepare(
      `UPDATE laporan_karhutla SET dikirim_pada = ?2, dikirim_oleh = ?3, jumlah_kirim = jumlah_kirim + 1 WHERE id = ?1`,
    ).bind(cocokKirim[1], new Date().toISOString(), pengguna.id).run();
    if (!r.meta.changes) return galat('Laporan tidak ditemukan.', 404);
    await beriXp(env, pengguna, 'karhutla_kirim', cocokKirim[1], { pelaku: pengguna });
    return json({ laporan: await env.DB.prepare(`${SELECT_LAPORAN} WHERE k.id = ?1`).bind(cocokKirim[1]).first() });
  }

  const cocokId = jalur.match(/^\/api\/karhutla\/laporan\/([\w-]+)$/);
  if (cocokId && req.method === 'DELETE') {
    const baris = await env.DB.prepare('SELECT dibuat_oleh, pdf_kunci, data_kunci FROM laporan_karhutla WHERE id = ?1')
      .bind(cocokId[1]).first<{ dibuat_oleh: string | null; pdf_kunci: string; data_kunci: string }>();
    if (!baris) return galat('Laporan tidak ditemukan.', 404);
    if (baris.dibuat_oleh !== pengguna.id && !bolehKelola(pengguna)) return galat('Hanya pembuat atau Admin/Supervisor yang boleh menghapus.', 403);
    await env.DB.prepare('DELETE FROM laporan_karhutla WHERE id = ?1').bind(cocokId[1]).run();
    await env.BUKET.delete([baris.pdf_kunci, baris.data_kunci]).catch(() => undefined);
    return json({ ok: true });
  }

  return null;
}
