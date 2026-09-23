/**
 * Pengambil data untuk notifikasi & rekap.
 *
 * Satu-satunya berkas alur notifikasi yang tahu nama tabel dan kolom. Saat
 * desain database final datang, sesuaikan query di sini — penyusun pesan
 * (ringkasan.ts), jadwal cron, dan Background Runner tidak perlu disentuh.
 *
 * Kolom waktu bisa tersimpan dalam dua bentuk (`2026-09-15 07:00:00` dari
 * `datetime('now')`, atau ISO `2026-09-15T07:00:00Z`). Semua pembandingan waktu
 * lewat `W(kolom)` supaya keduanya sejajar.
 */

import type { Env, Pengguna } from './tipe';
import { bolehUbahKunci } from './auth';
import { geserHari, utcDariWita } from './waktu';
import {
  susunNotifPagi, susunNotifSiang, susunNotifSore, susunRekapPica, susunPengingatAcara,
  type AcaraSiap, type BarisJadwal, type NotifSiap, type PicaRekap, type PicaRingkas, type Slot,
} from './ringkasan';

/** Normalkan kolom waktu ke 'YYYY-MM-DD HH:MM:SS' di dalam SQL. */
const W = (kolom: string) => `replace(substr(${kolom}, 1, 19), 'T', ' ')`;

/** Instant UTC (ISO) -> 'YYYY-MM-DD HH:MM:SS' untuk di-bind. */
const keSql = (iso: string) => iso.slice(0, 19).replace('T', ' ');

/** Rentang satu hari WITA dalam format pembanding SQL. */
const rentangHari = (tanggal: string) => ({
  awal: keSql(utcDariWita(tanggal, '00:00')),
  akhir: keSql(utcDariWita(geserHari(tanggal, 1), '00:00')),
});

// ---------- Kueri dasar ----------

export async function picaOpenMilik(env: Env, userId: string): Promise<PicaRingkas[]> {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.judul, p.status, p.due_date, p.bidang, t.nama AS pic_nama
       FROM pica p LEFT JOIN tim t ON t.id = p.pic_id
      WHERE p.dihapus = 0 AND p.status = 'Open' AND p.pic_id = ?1
      ORDER BY p.due_date IS NULL, p.due_date LIMIT 20`,
  ).bind(userId).all<PicaRingkas>();
  return results;
}

export async function angkaPicaTim(env: Env, hariIni: string) {
  const { awal, akhir } = rentangHari(hariIni);
  const r = await env.DB.prepare(
    `SELECT
        COALESCE(SUM(CASE WHEN status <> 'Closed' THEN 1 ELSE 0 END), 0)                    AS terbuka,
        COALESCE(SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END), 0)                       AS open,
        COALESCE(SUM(CASE WHEN status <> 'Closed' AND due_date < ?1 THEN 1 ELSE 0 END), 0)  AS telat,
        COALESCE(SUM(CASE WHEN status = 'Closed' AND ${W('ditutup_pada')} >= ?2 AND ${W('ditutup_pada')} < ?3 THEN 1 ELSE 0 END), 0) AS selesaiHariIni
       FROM pica WHERE dihapus = 0`,
  ).bind(hariIni, awal, akhir).first<{ terbuka: number; open: number; telat: number; selesaiHariIni: number }>();
  return r ?? { terbuka: 0, open: 0, telat: 0, selesaiHariIni: 0 };
}

export async function pengumumanBelumDibaca(env: Env, userId: string, hariIni: string) {
  // Pengumuman lebih dari 14 hari tidak lagi dikejar lewat notifikasi.
  const batas = keSql(utcDariWita(geserHari(hariIni, -14), '00:00'));
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.judul, p.penting, p.dibuat_pada FROM pengumuman p
      WHERE ${W('p.dibuat_pada')} >= ?2
        AND NOT EXISTS (SELECT 1 FROM pengumuman_baca b WHERE b.pengumuman_id = p.id AND b.user_id = ?1)
      ORDER BY p.dibuat_pada DESC LIMIT 10`,
  ).bind(userId, batas).all<{ id: string; judul: string; penting: number; dibuat_pada: string }>();
  return results;
}

export async function xpHariIni(env: Env, userId: string, hariIni: string) {
  const { awal, akhir } = rentangHari(hariIni);
  const [lap, profil] = await Promise.all([
    env.DB.prepare(
      `SELECT COALESCE(SUM(xp), 0) AS xp, COUNT(*) AS jumlah FROM laporan
        WHERE user_id = ?1 AND ${W('dibuat_pada')} >= ?2 AND ${W('dibuat_pada')} < ?3`,
    ).bind(userId, awal, akhir).first<{ xp: number; jumlah: number }>(),
    env.DB.prepare('SELECT xp, level, stamina FROM profil_game WHERE user_id = ?1')
      .bind(userId).first<{ xp: number; level: number; stamina: number | null }>(),
  ]);
  return {
    xpHariIni: lap?.xp ?? 0,
    laporanHariIni: lap?.jumlah ?? 0,
    xp: profil?.xp ?? 0,
    level: profil?.level ?? 1,
    stamina: profil?.stamina ?? 100,
  };
}

export async function liburPada(env: Env, tanggal: string): Promise<string | null> {
  const r = await env.DB.prepare(
    `SELECT nama FROM libur WHERE tanggal = ?1 AND jenis IN ('nasional', 'cuti') LIMIT 1`,
  ).bind(tanggal).first<{ nama: string }>();
  return r?.nama ?? null;
}

// ---------- Alur lengkap ----------

/** Isi satu notifikasi terjadwal untuk satu pemakai. */
export async function siapkanNotif(env: Env, pengguna: Pengguna, slot: Slot, hariIni: string): Promise<NotifSiap> {
  if (slot === 'pagi') {
    const [milik, tim] = await Promise.all([
      picaOpenMilik(env, pengguna.id),
      bolehUbahKunci(pengguna) ? angkaPicaTim(env, hariIni) : Promise.resolve(null),
    ]);
    return susunNotifPagi({ milik, hariIni, tim: tim ? { open: tim.open, telat: tim.telat } : undefined });
  }
  if (slot === 'siang') {
    return susunNotifSiang({ belum: await pengumumanBelumDibaca(env, pengguna.id, hariIni) });
  }
  return susunNotifSore(await xpHariIni(env, pengguna.id, hariIni));
}

/**
 * Teks rekap PICA untuk grup WhatsApp: semua PICA yang belum Closed,
 * dikelompokkan per PIC oleh penyusun murni di ringkasan.ts.
 * `tautan` = alamat papan PICA hanya-baca (lihat lihat.ts), boleh null.
 */
export async function siapkanRekapPica(
  env: Env,
  jenis: 'harian' | 'mingguan',
  hariIni: string,
  tautan: string | null = null,
): Promise<string> {
  const { awal, akhir } = rentangHari(hariIni);
  const [terbuka, angka, updates, perubahan] = await Promise.all([
    env.DB.prepare(
      `SELECT p.id, p.judul, p.judul_singkat, p.bidang, p.status, p.due_date, p.pic_id, t.nama AS pic_nama,
              p.target, p.realisasi, p.satuan, p.tindakan
         FROM pica p LEFT JOIN tim t ON t.id = p.pic_id
        WHERE p.dihapus = 0 AND p.status <> 'Closed'`,
    ).all<PicaRekap>(),
    angkaPicaTim(env, hariIni),
    env.DB.prepare(
      `SELECT u.pica_id, t.nama AS oleh FROM pica_update u LEFT JOIN tim t ON t.id = u.oleh
        WHERE ${W('u.pada')} >= ?1 AND ${W('u.pada')} < ?2`,
    ).bind(awal, akhir).all<{ pica_id: string; oleh: string | null }>(),
    env.DB.prepare(
      `SELECT r.pica_id, t.nama AS oleh FROM pica_riwayat r LEFT JOIN tim t ON t.id = r.oleh
        WHERE r.kolom = 'status' AND ${W('r.pada')} >= ?1 AND ${W('r.pada')} < ?2`,
    ).bind(awal, akhir).all<{ pica_id: string; oleh: string | null }>(),
  ]);

  let mingguan: { dari: string; baru: number; ditutup: number } | undefined;
  if (jenis === 'mingguan') {
    // Senin sampai hari ini (Jumat saat dipanggil cron).
    const hari = new Date(`${hariIni}T00:00:00Z`).getUTCDay();
    const dari = geserHari(hariIni, -((hari + 6) % 7));
    const mulai = keSql(utcDariWita(dari, '00:00'));
    const [baru, ditutup] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) AS n FROM pica WHERE dihapus = 0 AND ${W('dibuat_pada')} >= ?1 AND ${W('dibuat_pada')} < ?2`)
        .bind(mulai, akhir).first<{ n: number }>(),
      env.DB.prepare(`SELECT COUNT(*) AS n FROM pica WHERE dihapus = 0 AND status = 'Closed' AND ${W('ditutup_pada')} >= ?1 AND ${W('ditutup_pada')} < ?2`)
        .bind(mulai, akhir).first<{ n: number }>(),
    ]);
    mingguan = { dari, baru: baru?.n ?? 0, ditutup: ditutup?.n ?? 0 };
  }

  return susunRekapPica({
    jenis,
    hariIni,
    terbuka: terbuka.results,
    selesaiHariIni: angka.selesaiHariIni,
    bergerak: [...updates.results, ...perubahan.results],
    mingguan,
    tautan,
  });
}

/**
 * Acara yang perlu diingatkan pada satu tanggal WITA, untuk satu pemakai.
 *
 * Jadwal milik semua orang (pemilik_id NULL) ikut; jadwal milik orang lain
 * tidak. Barisnya sedikit, jadi penyaringan tanggal dan pengulangan dikerjakan
 * penyusun murni yang sama dengan mode demo.
 */
export async function acaraPengingat(env: Env, pengguna: Pengguna, tanggal: string): Promise<AcaraSiap[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, judul, keterangan, tanggal, tanggal_selesai, jam_mulai, jam_selesai, jenis, rrule, ingatkan_menit
       FROM jadwal
      WHERE ingatkan_menit IS NOT NULL AND selesai = 0
        AND (pemilik_id IS NULL OR pemilik_id = ?1)`,
  ).bind(pengguna.id).all<BarisJadwal>();

  return susunPengingatAcara(results, tanggal);
}
