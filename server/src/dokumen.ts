/**
 * Dokumen administrasi: nomor surat, Internal Memo perjalanan dinas, dan
 * Minutes of Meeting — dulu hanya di localStorage ponsel, sekarang di D1 supaya
 * satu tim melihat data yang sama.
 *
 * Bentuk formulirnya ditentukan layar (lib/tipe-surat.ts, lib/ekspor-*.ts), jadi
 * isi utuhnya disimpan apa adanya sebagai JSON; kolom di luar JSON hanya dipakai
 * untuk mengurutkan, menyaring, dan merekap.
 *
 * Foto profil ikut di sini: gambarnya ke R2, kuncinya ke kolom `tim.foto`.
 */

import type { Env, Pengguna } from './tipe';
import { beriXp } from './xp';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);

const sekarang = () => new Date().toISOString();
const bolehTulis = (p: Pengguna) => p.peran !== 'pemantau';
const bolehKelola = (p: Pengguna) => p.peran === 'admin' || p.peran === 'supervisor';

/** Teks seadanya dari JSON yang dikirim layar. */
const teks = (v: unknown, maks = 300): string => (typeof v === 'string' ? v.slice(0, maks) : '');
const angka = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const tanggalAtauHariIni = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : sekarang().slice(0, 10));

interface BarisDokumen { id: string; data_json?: string; data_tambahan?: string; dibuat_oleh: string | null; dibuat_pada: string; diubah_pada: string | null }

/** Baris D1 → objek yang dikenal layar (JSON utuh + jejak siapa & kapan). */
function keObjek(b: BarisDokumen, oleh: string | null): Record<string, unknown> {
  let isi: Record<string, unknown> = {};
  try { isi = JSON.parse(b.data_json ?? b.data_tambahan ?? '{}') as Record<string, unknown>; } catch { isi = {}; }
  return { ...isi, id: b.id, dibuatPada: b.dibuat_pada, diubahPada: b.diubah_pada, dibuatOleh: b.dibuat_oleh, dibuatOlehNama: oleh };
}

/** Hanya pembuat, admin, atau supervisor yang boleh mengubah/menghapus milik orang lain. */
async function bolehUbahBaris(env: Env, tabel: 'nomor_surat' | 'memo_dinas' | 'mom', id: string, pengguna: Pengguna): Promise<boolean> {
  if (bolehKelola(pengguna)) return true;
  const b = await env.DB.prepare(`SELECT dibuat_oleh FROM ${tabel} WHERE id = ?1`).bind(id).first<{ dibuat_oleh: string | null }>();
  return !b || !b.dibuat_oleh || b.dibuat_oleh === pengguna.id;
}

// ---------------------------------------------------------------- nomor surat

/** Penanda agar daftar surat bawaan hanya diisikan sekali, walau nanti dikosongkan lagi. */
const KUNCI_AWAL = 'surat_awal_terisi';

async function daftarSurat(env: Env): Promise<Response> {
  const [d, awal] = await Promise.all([
    env.DB.prepare(
      `SELECT s.*, t.nama AS oleh_nama FROM nomor_surat s LEFT JOIN tim t ON t.id = s.dibuat_oleh
        ORDER BY s.tanggal DESC, s.dibuat_pada DESC LIMIT 1000`,
    ).all<BarisDokumen & { oleh_nama: string | null }>(),
    env.DB.prepare('SELECT nilai FROM pengaturan WHERE kunci = ?1').bind(KUNCI_AWAL).first<{ nilai: string }>(),
  ]);
  return json({ surat: (d.results ?? []).map((b) => keObjek(b, b.oleh_nama)), awalTerisi: awal?.nilai === '1' });
}

/** Simpan satu nomor surat (baru atau perubahan); id ditentukan layar. */
async function simpanSurat(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!bolehTulis(pengguna)) return galat('Peran Anda hanya bisa memantau.', 403);
  const b = await req.json<Record<string, unknown>>().catch(() => null);
  if (!b || typeof b.id !== 'string' || !b.id) return galat('Data surat tidak lengkap.');
  const nomor = teks(b.nomorSurat, 120).trim();
  if (!nomor) return galat('Nomor surat wajib diisi.');
  if (!(await bolehUbahBaris(env, 'nomor_surat', b.id, pengguna))) return galat('Surat ini dibuat anggota lain.', 403);

  const kategori = teks(b.kategori, 30) || 'lain';
  const bentrok = await env.DB.prepare('SELECT id FROM nomor_surat WHERE kategori = ?1 AND nomor_surat = ?2 AND id <> ?3')
    .bind(kategori, nomor, b.id).first<{ id: string }>();
  if (bentrok) return galat(`Nomor ${nomor} sudah dipakai surat lain.`, 409);

  await env.DB.prepare(
    `INSERT INTO nomor_surat (id, nomor_surat, kategori, perihal, tujuan, pemohon, tanggal, status, memo_dinas_id, dibuat_oleh, data_tambahan)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
     ON CONFLICT(id) DO UPDATE SET
       nomor_surat = excluded.nomor_surat, kategori = excluded.kategori, perihal = excluded.perihal,
       tujuan = excluded.tujuan, pemohon = excluded.pemohon, tanggal = excluded.tanggal, status = excluded.status,
       memo_dinas_id = excluded.memo_dinas_id, data_tambahan = excluded.data_tambahan, diubah_pada = ?12`,
  ).bind(
    b.id, nomor, kategori, teks(b.namaSurat) || nomor,
    teks(b.tujuanSurat) || teks(b.tujuanDinas) || null,
    teks(b.namaYangDitugaskan) || teks(b.namaPembuat) || null,
    tanggalAtauHariIni(b.tanggal ?? b.tanggalMulai),
    teks(b.status, 30) || 'Aktif',
    teks(b.internalMemoId, 60) || null,
    pengguna.id, JSON.stringify(b), sekarang(),
  ).run();
  await beriXp(env, pengguna, 'dokumen_buat', `surat:${b.id}`, { pelaku: pengguna });
  return json({ ok: true, id: b.id });
}

// ------------------------------------------------------- memo dinas & MoM

const RINGKAS = {
  memo_dinas: (b: Record<string, unknown>) => ({
    kolom: 'nomor_surat_id, nomor_memo, perihal, tanggal, tujuan, pemohon, total_biaya, status',
    nilai: [
      teks(b.nomorSuratId, 60) || null,
      teks(b.nomor, 120) || null,
      teks(b.perihal) || '',
      tanggalAtauHariIni(b.tanggalBerangkat),
      teks(b.tempatTujuan) || null,
      teks(b.namaKaryawan) || null,
      angka(b.biayaTransportasi) + angka(b.biayaPenginapan) + angka(b.biayaUangMakan) + angka(b.biayaLainLain)
        + (Array.isArray(b.biayaTambahan) ? (b.biayaTambahan as { jumlah?: unknown }[]).reduce((s, x) => s + angka(x?.jumlah), 0) : 0),
      teks(b.status, 30) || 'Draft',
    ],
  }),
  mom: (b: Record<string, unknown>) => ({
    kolom: 'nomor_surat_id, nomor_mom, judul_rapat, tanggal, tempat, pimpinan_rapat, notulis, status',
    nilai: [
      teks(b.nomorSuratId, 60) || null,
      teks(b.nomor, 120) || null,
      teks(b.judul) || '',
      tanggalAtauHariIni(b.tanggal),
      teks(b.tempat) || null,
      teks(b.pimpinanRapat) || null,
      teks(b.notulis) || null,
      teks(b.status, 30) || 'Draft',
    ],
  }),
} as const;

async function daftarDokumen(env: Env, tabel: 'memo_dinas' | 'mom', kunci: string): Promise<Response> {
  const d = await env.DB.prepare(
    `SELECT x.*, t.nama AS oleh_nama FROM ${tabel} x LEFT JOIN tim t ON t.id = x.dibuat_oleh
      ORDER BY x.tanggal DESC, x.dibuat_pada DESC LIMIT 500`,
  ).all<BarisDokumen & { oleh_nama: string | null }>();
  return json({ [kunci]: (d.results ?? []).map((b) => keObjek(b, b.oleh_nama)) });
}

async function simpanDokumen(req: Request, env: Env, pengguna: Pengguna, tabel: 'memo_dinas' | 'mom'): Promise<Response> {
  if (!bolehTulis(pengguna)) return galat('Peran Anda hanya bisa memantau.', 403);
  const b = await req.json<Record<string, unknown>>().catch(() => null);
  if (!b || typeof b.id !== 'string' || !b.id) return galat('Data dokumen tidak lengkap.');
  if (!(await bolehUbahBaris(env, tabel, b.id, pengguna))) return galat('Dokumen ini dibuat anggota lain.', 403);

  const r = RINGKAS[tabel](b);
  const kolom = r.kolom.split(', ');
  const nomorParam = kolom.map((_, i) => `?${i + 2}`).join(', ');
  const setBagian = kolom.map((k) => `${k} = excluded.${k}`).join(', ');
  await env.DB.prepare(
    `INSERT INTO ${tabel} (id, ${r.kolom}, dibuat_oleh, data_json)
     VALUES (?1, ${nomorParam}, ?${kolom.length + 2}, ?${kolom.length + 3})
     ON CONFLICT(id) DO UPDATE SET ${setBagian}, data_json = excluded.data_json, diubah_pada = ?${kolom.length + 4}`,
  ).bind(b.id, ...r.nilai, pengguna.id, JSON.stringify(b), sekarang()).run();
  await beriXp(env, pengguna, 'dokumen_buat', `${tabel}:${b.id}`, { pelaku: pengguna });
  return json({ ok: true, id: b.id });
}

async function hapusDokumen(env: Env, tabel: 'nomor_surat' | 'memo_dinas' | 'mom', id: string, pengguna: Pengguna): Promise<Response> {
  if (!bolehTulis(pengguna)) return galat('Peran Anda hanya bisa memantau.', 403);
  if (!(await bolehUbahBaris(env, tabel, id, pengguna))) return galat('Dokumen ini dibuat anggota lain.', 403);
  await env.DB.prepare(`DELETE FROM ${tabel} WHERE id = ?1`).bind(id).run();
  return json({ ok: true });
}

// -------------------------------------------------------------- pindahan

const MAKS_IMPOR = 250;

/**
 * Pindahan sekali jalan dari localStorage ponsel (atau daftar bawaan aplikasi) ke D1.
 * Baris yang sudah ada dilewati, jadi aman bila terkirim dua kali.
 */
async function impor(req: Request, env: Env, pengguna: Pengguna, tabel: 'nomor_surat' | 'memo_dinas' | 'mom'): Promise<Response> {
  if (!bolehTulis(pengguna)) return galat('Peran Anda hanya bisa memantau.', 403);
  const b = await req.json<{ daftar?: Record<string, unknown>[] }>().catch(() => null);
  const daftar = (Array.isArray(b?.daftar) ? b.daftar : []).filter((x) => x && typeof x.id === 'string').slice(0, MAKS_IMPOR);
  if (!daftar.length) return galat('Tidak ada data untuk dipindahkan.');

  const pernyataan = daftar.map((x) => {
    if (tabel === 'nomor_surat') {
      return env.DB.prepare(
        `INSERT OR IGNORE INTO nomor_surat (id, nomor_surat, kategori, perihal, tujuan, pemohon, tanggal, status, memo_dinas_id, dibuat_oleh, data_tambahan)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      ).bind(
        x.id, teks(x.nomorSurat, 120).trim() || String(x.id), teks(x.kategori, 30) || 'lain',
        teks(x.namaSurat) || teks(x.nomorSurat, 120), teks(x.tujuanSurat) || teks(x.tujuanDinas) || null,
        teks(x.namaYangDitugaskan) || teks(x.namaPembuat) || null, tanggalAtauHariIni(x.tanggal ?? x.tanggalMulai),
        teks(x.status, 30) || 'Aktif', teks(x.internalMemoId, 60) || null, pengguna.id, JSON.stringify(x),
      );
    }
    const r = RINGKAS[tabel](x);
    const kolom = r.kolom.split(', ');
    return env.DB.prepare(
      `INSERT OR IGNORE INTO ${tabel} (id, ${r.kolom}, dibuat_oleh, data_json)
       VALUES (?1, ${kolom.map((_, i) => `?${i + 2}`).join(', ')}, ?${kolom.length + 2}, ?${kolom.length + 3})`,
    ).bind(x.id, ...r.nilai, pengguna.id, JSON.stringify(x));
  });

  if (tabel === 'nomor_surat') {
    pernyataan.push(env.DB.prepare(
      `INSERT INTO pengaturan (kunci, nilai) VALUES (?1, '1') ON CONFLICT(kunci) DO UPDATE SET nilai = '1'`,
    ).bind(KUNCI_AWAL));
  }
  await env.DB.batch(pernyataan);
  return json({ jumlah: daftar.length });
}

// ------------------------------------------------------------- foto profil

/** Terima data URL dari layar (sudah dikecilkan di sana), simpan ke R2, kuncinya ke tim.foto. */
async function simpanFoto(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  const b = await req.json<{ foto?: string }>().catch(() => null);
  const cocok = b?.foto?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!cocok) return galat('Foto harus berupa data URL gambar (JPEG, PNG, atau WebP).');
  const biner = Uint8Array.from(atob(cocok[2]), (c) => c.charCodeAt(0));
  if (biner.byteLength > 1_500_000) return galat('Ukuran foto maksimal 1,5 MB setelah dikecilkan.');

  const lama = await env.DB.prepare('SELECT foto FROM tim WHERE id = ?1').bind(pengguna.id).first<{ foto: string | null }>();
  const ekstensi = cocok[1] === 'image/png' ? 'png' : cocok[1] === 'image/webp' ? 'webp' : 'jpg';
  const kunci = `profil/${pengguna.id}-${Date.now().toString(36)}.${ekstensi}`;
  await env.BUKET.put(kunci, biner, { httpMetadata: { contentType: cocok[1] } });
  await env.DB.prepare('UPDATE tim SET foto = ?1 WHERE id = ?2').bind(kunci, pengguna.id).run();
  if (lama?.foto) await env.BUKET.delete(lama.foto).catch(() => undefined);
  await beriXp(env, pengguna, 'profil_foto', 'sekali', { pelaku: pengguna });
  return json({ foto: kunci });
}

async function hapusFoto(env: Env, pengguna: Pengguna): Promise<Response> {
  const lama = await env.DB.prepare('SELECT foto FROM tim WHERE id = ?1').bind(pengguna.id).first<{ foto: string | null }>();
  await env.DB.prepare('UPDATE tim SET foto = NULL WHERE id = ?1').bind(pengguna.id).run();
  if (lama?.foto) await env.BUKET.delete(lama.foto).catch(() => undefined);
  return json({ foto: null });
}

// ------------------------------------------------------------------- rute

export async function ruteDokumen(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (jalur === '/api/surat' && req.method === 'GET') return daftarSurat(env);
  if (jalur === '/api/surat' && req.method === 'POST') return simpanSurat(req, env, pengguna);
  if (jalur === '/api/memo-dinas' && req.method === 'GET') return daftarDokumen(env, 'memo_dinas', 'memoDinas');
  if (jalur === '/api/memo-dinas' && req.method === 'POST') return simpanDokumen(req, env, pengguna, 'memo_dinas');
  if (jalur === '/api/mom' && req.method === 'GET') return daftarDokumen(env, 'mom', 'mom');
  if (jalur === '/api/mom' && req.method === 'POST') return simpanDokumen(req, env, pengguna, 'mom');

  const imporCocok = jalur.match(/^\/api\/(surat|memo-dinas|mom)\/impor$/);
  if (imporCocok && req.method === 'POST') {
    return impor(req, env, pengguna, imporCocok[1] === 'surat' ? 'nomor_surat' : imporCocok[1] === 'memo-dinas' ? 'memo_dinas' : 'mom');
  }

  const hapus = jalur.match(/^\/api\/(surat|memo-dinas|mom)\/(.+)$/);
  if (hapus && req.method === 'DELETE') {
    const tabel = hapus[1] === 'surat' ? 'nomor_surat' : hapus[1] === 'memo-dinas' ? 'memo_dinas' : 'mom';
    return hapusDokumen(env, tabel, decodeURIComponent(hapus[2]), pengguna);
  }

  if (jalur === '/api/profil/foto' && req.method === 'POST') return simpanFoto(req, env, pengguna);
  if (jalur === '/api/profil/foto' && req.method === 'DELETE') return hapusFoto(env, pengguna);
  return null;
}
