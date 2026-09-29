/**
 * RAB RNR (Money Monkey) di server, supaya tidak hilang saat pindah perangkat
 * atau aplikasi dipasang ulang. Aplikasi mengirim RAB utuh setiap kali berubah;
 * versi yang lebih baru (diubahPada) menang. Semua anggota membaca; pembuat,
 * Admin, dan Supervisor mengubah; pembuat dan Admin menghapus (hapus lunak).
 */

import type { Env, Pengguna } from './tipe';
import { sekarangUtcIso } from './waktu';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);
const bolehKelola = (p: Pengguna) => p.peran === 'admin' || p.peran === 'supervisor';

interface BarisRab {
  pemohon_id: string;
  diubah_pada: string;
  dihapus: number;
  data: string;
}

const teks = (v: unknown, maks: number) => String(v ?? '').slice(0, maks);

export async function ruteRabRnr(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (!jalur.startsWith('/api/rab-rnr')) return null;

  if (jalur === '/api/rab-rnr' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, data, dihapus FROM rab_rnr ORDER BY dibuat_pada DESC')
      .all<{ id: string; data: string; dihapus: number }>();
    const rab: unknown[] = [];
    const dihapus: string[] = [];
    for (const r of results) {
      if (r.dihapus) dihapus.push(r.id);
      else {
        try { rab.push(JSON.parse(r.data)); } catch { /* baris rusak dilewati */ }
      }
    }
    return json({ rab, dihapus });
  }

  const cocok = jalur.match(/^\/api\/rab-rnr\/([\w-]{1,80})$/);
  if (!cocok) return null;
  const id = cocok[1];
  const lama = await env.DB.prepare('SELECT pemohon_id, diubah_pada, dihapus, data FROM rab_rnr WHERE id = ?1')
    .bind(id)
    .first<BarisRab>();

  // Simpan (buat atau ubah) satu RAB.
  if (req.method === 'POST') {
    const b = (await req.json().catch(() => null)) as { rab?: Record<string, unknown> } | null;
    const rab = b?.rab;
    if (!rab || rab.id !== id) return galat('Data RAB tidak sah.');
    const isi = JSON.stringify(rab);
    if (isi.length > 900_000) return galat('RAB terlalu besar untuk disimpan.', 413);
    const diubahPada = teks(rab.diubahPada, 40) || sekarangUtcIso();

    if (lama) {
      if (lama.dihapus) return galat('RAB ini sudah dihapus.', 410);
      if (lama.pemohon_id !== pengguna.id && !bolehKelola(pengguna)) {
        return galat('Hanya pembuat RAB, Admin, atau Supervisor yang boleh mengubah RAB ini.', 403);
      }
      // Versi di server lebih baru (diubah dari perangkat lain): jangan ditimpa.
      if (diubahPada < lama.diubah_pada) return json({ basi: true, rab: JSON.parse(lama.data) }, 409);
    }

    await env.DB.prepare(
      `INSERT INTO rab_rnr (id, nomor_rab, judul, bulan, tahun, status, pemohon_id, data, dibuat_pada, diubah_pada, diubah_oleh)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
       ON CONFLICT(id) DO UPDATE SET
         nomor_rab = excluded.nomor_rab, judul = excluded.judul, bulan = excluded.bulan, tahun = excluded.tahun,
         status = excluded.status, data = excluded.data, diubah_pada = excluded.diubah_pada, diubah_oleh = excluded.diubah_oleh`,
    )
      .bind(
        id,
        teks(rab.nomorRab, 60),
        teks(rab.judul, 120),
        teks(rab.bulan, 20),
        Math.round(Number(rab.tahun) || 0),
        teks(rab.status, 20) || 'Draf',
        // Pemilik tetap pengunggah pertama; RAB lama dari perangkat diunggah oleh pembuatnya sendiri.
        lama?.pemohon_id ?? pengguna.id,
        isi,
        teks(rab.dibuatPada, 40) || diubahPada,
        diubahPada,
        pengguna.id,
      )
      .run();
    return json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (!lama || lama.dihapus) return json({ ok: true });
    if (lama.pemohon_id !== pengguna.id && pengguna.peran !== 'admin') {
      return galat('Hanya pembuat RAB atau Admin yang boleh menghapus RAB ini.', 403);
    }
    await env.DB.prepare('UPDATE rab_rnr SET dihapus = 1, diubah_pada = ?2, diubah_oleh = ?3 WHERE id = ?1')
      .bind(id, sekarangUtcIso(), pengguna.id)
      .run();
    return json({ ok: true });
  }

  return null;
}
