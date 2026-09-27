/**
 * Katalog barang RAB (Money Monkey): daftar yang dicentang pemohon di form
 * belanja. Semua anggota membaca; Admin/Supervisor mengubah.
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
const KATEGORI = ['atk', 'bbm', 'catering', 'perdin', 'listrik', 'air', 'telp', 'pantry', 'khl'];

export async function ruteKatalogRab(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (!jalur.startsWith('/api/katalog-rab')) return null;

  if (jalur === '/api/katalog-rab' && req.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, kategori, kelompok, nama, satuan, harga, urutan FROM katalog_rab WHERE aktif = 1 ORDER BY urutan, nama',
    ).all();
    return json({ katalog: results });
  }

  if (jalur === '/api/katalog-rab' && req.method === 'POST') {
    if (!bolehKelola(pengguna)) return galat('Hanya Admin/Supervisor yang boleh mengubah katalog.', 403);
    const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const nama = String(b?.nama ?? '').trim().slice(0, 120);
    const kategori = String(b?.kategori ?? '');
    if (!nama) return galat('Nama barang wajib diisi.');
    if (!KATEGORI.includes(kategori)) return galat('Kategori harus salah satu lembar RAB.');
    const id = String(b?.id ?? '').replace(/[^\w-]/g, '').slice(0, 60) || `kat-${Date.now().toString(36)}`;
    await env.DB.prepare(
      `INSERT INTO katalog_rab (id, kategori, kelompok, nama, satuan, harga, urutan, diubah_oleh, diubah_pada)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET kategori = excluded.kategori, kelompok = excluded.kelompok, nama = excluded.nama,
         satuan = excluded.satuan, harga = excluded.harga, urutan = excluded.urutan, aktif = 1,
         diubah_oleh = excluded.diubah_oleh, diubah_pada = excluded.diubah_pada`,
    ).bind(
      id, kategori, String(b?.kelompok ?? '').trim().slice(0, 60) || 'Lainnya', nama,
      String(b?.satuan ?? '').trim().slice(0, 20) || 'Pcs', Math.max(0, Number(b?.harga) || 0),
      Math.round(Number(b?.urutan) || 99), pengguna.id,
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
