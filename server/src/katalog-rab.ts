/**
 * Katalog uraian RAB RNR (Money Monkey): uraian rutin yang dicentang pemohon di
 * form belanja, lengkap dengan kode WBS. Semua anggota membaca; Admin/Supervisor mengubah.
 */

import type { Env, Pengguna } from './tipe';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);
const bolehKelola = (p: Pengguna) => p.peran === 'admin' || p.peran === 'supervisor';

export async function ruteKatalogRab(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (!jalur.startsWith('/api/katalog-rab')) return null;

  if (jalur === '/api/katalog-rab' && req.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, kelompok, nama, satuan, harga, urutan, wbs FROM katalog_rab WHERE aktif = 1 ORDER BY urutan, nama',
    ).all();
    return json({ katalog: results });
  }

  if (jalur === '/api/katalog-rab' && req.method === 'POST') {
    if (!bolehKelola(pengguna)) return galat('Hanya Admin/Supervisor yang boleh mengubah katalog.', 403);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const nama = String(b?.nama ?? '').trim().slice(0, 120);
    const wbs = String(b?.wbs ?? '').trim().slice(0, 40) || 'AB3.11-06.02.22.04';
    if (!nama) return galat('Nama uraian wajib diisi.');
    const id = String(b?.id ?? '').replace(/[^\w-]/g, '').slice(0, 60) || `kat-${Date.now().toString(36)}`;
    await env.DB.prepare(
      `INSERT INTO katalog_rab (id, kategori, kelompok, nama, satuan, harga, urutan, diubah_oleh, diubah_pada, wbs)
       VALUES (?1,'rnr',?2,?3,?4,?5,?6,?7, datetime('now'), ?8)
       ON CONFLICT(id) DO UPDATE SET wbs = excluded.wbs, kelompok = excluded.kelompok, nama = excluded.nama,
         satuan = excluded.satuan, harga = excluded.harga, urutan = excluded.urutan, aktif = 1,
         diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada`,
    ).bind(
      id, String(b?.kelompok ?? '').trim().slice(0, 60) || 'Pengajuan Rutin', nama,
      String(b?.satuan ?? '').trim().slice(0, 20) || 'Paket', Math.max(0, Number(b?.harga) || 0),
      Math.round(Number(b?.urutan) || 99), pengguna.id, wbs,
    ).run();
    return json({ id }, 201);
  }

  const cocok = jalur.match(/^\/api\/katalog-rab\/([\w-]+)$/);
  if (cocok && req.method === 'DELETE') {
    if (!bolehKelola(pengguna)) return galat('Hanya Admin/Supervisor yang boleh mengubah katalog.', 403);
    // Hapus lunak: RAB lama yang memakai barang ini tidak terpengaruh.
    await env.DB.prepare("UPDATE katalog_rab SET aktif = 0, diubah_oleh = ?2, diubah_pada = datetime('now') WHERE id = ?1")
      .bind(cocok[1], pengguna.id).run();
    return json({ ok: true });
  }

  return null;
}
