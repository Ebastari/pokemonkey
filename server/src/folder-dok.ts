/**
 * Folder Dokumen (di sidebar Memo, di atas Sampah). Hanya dokumen kerja —
 * PDF, Word, Excel, PowerPoint, CSV, TXT — disimpan di R2 (`dok/…`).
 *
 *   GET    /api/folder?lingkup=tim|pribadi      { folder, berkas }
 *   POST   /api/folder                          { nama, lingkup, induk_id? }
 *   PATCH  /api/folder/:id                      { nama }
 *   DELETE /api/folder/:id                      hanya folder kosong
 *   POST   /api/folder/unggah                   form: berkas, lingkup, folder_id?
 *   PATCH  /api/folder/berkas/:id               { nama?, folder_id? }
 *   DELETE /api/folder/berkas/:id
 *
 * Folder Tim: semua anggota melihat & mengunduh; anggota (bukan Pemantau) mengunggah dan
 * mengubah/menghapus berkasnya sendiri; Admin/SPV mengatur folder dan semua berkas.
 * Folder Pribadi: hanya pemiliknya, dengan semua hak.
 */

import type { Env, Pengguna } from './tipe';
import { bolehUbahKunci } from './auth';
import { sekarangUtcIso } from './waktu';
import { beriXp } from './xp';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);
const idBaru = (awal: string) => `${awal}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Ekstensi dokumen yang diterima (foto, video, program, dan arsip ditolak). */
export const EKSTENSI_DOKUMEN = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'odt', 'ods', 'odp', 'rtf', 'md'];
const MAKS_BYTE = 25 * 1024 * 1024;

interface BarisFolder { id: string; nama: string; lingkup: string; user_id: string; induk_id: string | null }
interface BarisBerkas { id: string; folder_id: string | null; lingkup: string; user_id: string; nama: string; kunci: string }

const lingkupDari = (v: unknown) => (v === 'pribadi' ? 'pribadi' : 'tim');

export async function ruteFolderDok(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (!jalur.startsWith('/api/folder')) return null;
  const kelola = bolehUbahKunci(pengguna);
  const pemantau = pengguna.peran === 'pemantau';

  if (jalur === '/api/folder' && req.method === 'GET') {
    const lingkup = lingkupDari(new URL(req.url).searchParams.get('lingkup'));
    // ?1 = id saya; Folder Tim tidak memakai syarat pemilik.
    const milik = (a: string) => (lingkup === 'tim' ? `${a}.lingkup = 'tim'` : `${a}.lingkup = 'pribadi' AND ${a}.user_id = ?1`);
    const [folder, berkas] = await Promise.all([
      env.DB.prepare(`SELECT f.*, t.nama AS pembuat FROM folder_dok f LEFT JOIN tim t ON t.id = f.user_id WHERE ${milik('f')} AND ?1 IS NOT NULL ORDER BY f.nama`)
        .bind(pengguna.id).all(),
      env.DB.prepare(`SELECT b.*, t.nama AS pengunggah FROM berkas_dok b LEFT JOIN tim t ON t.id = b.user_id WHERE ${milik('b')} AND ?1 IS NOT NULL ORDER BY b.nama`)
        .bind(pengguna.id).all(),
    ]);
    return json({ folder: folder.results, berkas: berkas.results, lingkup, boleh_folder: lingkup === 'pribadi' || kelola, boleh_unggah: lingkup === 'pribadi' || !pemantau });
  }

  if (jalur === '/api/folder' && req.method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { nama?: string; lingkup?: string; induk_id?: string | null };
    const lingkup = lingkupDari(b.lingkup);
    if (lingkup === 'tim' && !kelola) return galat('Folder Tim dibuat oleh Admin atau Supervisor. Anda tetap bisa mengunggah dokumen.', 403);
    const nama = String(b.nama ?? '').trim().slice(0, 80);
    if (!nama) return galat('Nama folder masih kosong.');
    let induk: string | null = null;
    if (b.induk_id) {
      const f = await env.DB.prepare('SELECT * FROM folder_dok WHERE id = ?1').bind(b.induk_id).first<BarisFolder>();
      if (!f || f.lingkup !== lingkup || (lingkup === 'pribadi' && f.user_id !== pengguna.id)) return galat('Folder induk tidak ditemukan.', 404);
      induk = f.id;
    }
    const id = idBaru('fld');
    await env.DB.prepare('INSERT INTO folder_dok (id, nama, lingkup, user_id, induk_id, dibuat_pada) VALUES (?1,?2,?3,?4,?5,?6)')
      .bind(id, nama, lingkup, pengguna.id, induk, sekarangUtcIso()).run();
    return json({ id }, 201);
  }

  if (jalur === '/api/folder/unggah' && req.method === 'POST') {
    const form = await req.formData();
    const berkas = form.get('berkas');
    const lingkup = lingkupDari(form.get('lingkup'));
    const folderId = String(form.get('folder_id') ?? '') || null;
    if (!(berkas instanceof File)) return galat('Berkas tidak ditemukan.');
    if (lingkup === 'tim' && pemantau) return galat('Peran Pemantau hanya bisa melihat Folder Tim.', 403);
    const ext = (berkas.name.split('.').pop() ?? '').toLowerCase();
    if (!EKSTENSI_DOKUMEN.includes(ext)) return galat(`Folder Dokumen hanya untuk dokumen (${EKSTENSI_DOKUMEN.join(', ')}). Foto & video simpan di memo.`);
    if (berkas.size > MAKS_BYTE) return galat('Ukuran dokumen maksimal 25 MB.');
    if (folderId) {
      const f = await env.DB.prepare('SELECT * FROM folder_dok WHERE id = ?1').bind(folderId).first<BarisFolder>();
      if (!f || f.lingkup !== lingkup || (lingkup === 'pribadi' && f.user_id !== pengguna.id)) return galat('Folder tidak ditemukan.', 404);
    }
    const id = idBaru('dok');
    const kunci = `dok/${lingkup}/${pengguna.id}/${id}.${ext}`;
    await env.BUKET.put(kunci, berkas.stream(), { httpMetadata: { contentType: berkas.type || 'application/octet-stream' } });
    const nama = berkas.name.replace(/[\\/]/g, '_').slice(0, 160);
    await env.DB.prepare(
      'INSERT INTO berkas_dok (id, folder_id, lingkup, user_id, nama, kunci, tipe, ukuran, dibuat_pada) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)',
    ).bind(id, folderId, lingkup, pengguna.id, nama, kunci, berkas.type || null, berkas.size, sekarangUtcIso()).run();
    if (lingkup === 'tim') await beriXp(env, pengguna, 'dokumen_unggah', id, { pelaku: pengguna });
    return json({ id, kunci, nama }, 201);
  }

  const cocokBerkas = jalur.match(/^\/api\/folder\/berkas\/([\w-]+)$/);
  if (cocokBerkas) {
    const b = await env.DB.prepare('SELECT * FROM berkas_dok WHERE id = ?1').bind(cocokBerkas[1]).first<BarisBerkas>();
    if (!b || (b.lingkup === 'pribadi' && b.user_id !== pengguna.id)) return galat('Berkas tidak ditemukan.', 404);
    const boleh = b.user_id === pengguna.id || (b.lingkup === 'tim' && kelola);
    if (!boleh) return galat('Hanya pengunggah, Supervisor, atau Admin yang boleh mengubah berkas ini.', 403);
    if (req.method === 'PATCH') {
      const d = (await req.json().catch(() => ({}))) as { nama?: string; folder_id?: string | null };
      if (typeof d.nama === 'string' && d.nama.trim()) {
        await env.DB.prepare('UPDATE berkas_dok SET nama = ?2, diubah_pada = ?3 WHERE id = ?1').bind(b.id, d.nama.trim().slice(0, 160), sekarangUtcIso()).run();
      }
      if ('folder_id' in d) {
        if (d.folder_id) {
          const f = await env.DB.prepare('SELECT * FROM folder_dok WHERE id = ?1').bind(d.folder_id).first<BarisFolder>();
          if (!f || f.lingkup !== b.lingkup || (b.lingkup === 'pribadi' && f.user_id !== pengguna.id)) return galat('Folder tujuan tidak ditemukan.', 404);
        }
        await env.DB.prepare('UPDATE berkas_dok SET folder_id = ?2, diubah_pada = ?3 WHERE id = ?1').bind(b.id, d.folder_id || null, sekarangUtcIso()).run();
      }
      return json({ ok: true });
    }
    if (req.method === 'DELETE') {
      await env.BUKET.delete(b.kunci);
      await env.DB.prepare('DELETE FROM berkas_dok WHERE id = ?1').bind(b.id).run();
      return json({ ok: true });
    }
    return galat('Metode tidak didukung.', 405);
  }

  const cocokFolder = jalur.match(/^\/api\/folder\/([\w-]+)$/);
  if (cocokFolder) {
    const f = await env.DB.prepare('SELECT * FROM folder_dok WHERE id = ?1').bind(cocokFolder[1]).first<BarisFolder>();
    if (!f || (f.lingkup === 'pribadi' && f.user_id !== pengguna.id)) return galat('Folder tidak ditemukan.', 404);
    if (f.lingkup === 'tim' && !kelola) return galat('Folder Tim diatur oleh Admin atau Supervisor.', 403);
    if (req.method === 'PATCH') {
      const d = (await req.json().catch(() => ({}))) as { nama?: string };
      const nama = String(d.nama ?? '').trim().slice(0, 80);
      if (!nama) return galat('Nama folder masih kosong.');
      await env.DB.prepare('UPDATE folder_dok SET nama = ?2 WHERE id = ?1').bind(f.id, nama).run();
      return json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const isi = await env.DB.prepare(
        'SELECT (SELECT COUNT(*) FROM berkas_dok WHERE folder_id = ?1) + (SELECT COUNT(*) FROM folder_dok WHERE induk_id = ?1) AS n',
      ).bind(f.id).first<{ n: number }>();
      if (Number(isi?.n ?? 0) > 0) return galat('Folder masih berisi. Pindahkan atau hapus isinya dulu.', 409);
      await env.DB.prepare('DELETE FROM folder_dok WHERE id = ?1').bind(f.id).run();
      return json({ ok: true });
    }
    return galat('Metode tidak didukung.', 405);
  }

  return null;
}
