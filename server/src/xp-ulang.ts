/**
 * Hitung ulang XP: riwayat sebelum sistem baru (pengaturan 'xp_mulai') dihitung
 * dengan aturan baru, lalu XP lama dikonversi sekali. Lihat docs/sistem-xp.md §6.
 *
 *   POST /api/xp/hitung-ulang            Admin: pratinjau per orang (tidak menulis apa pun)
 *   POST /api/xp/hitung-ulang?terapkan=1 Admin: menulis baris XP riwayat, warisan, saldo — sekali saja
 *
 * Yang bisa ditelusuri (punya pelaku + waktu): penutupan & status PICA, catatan
 * update, bukti, laporan FEED + fotonya, titik api, laporan karhutla, memo,
 * komentar, dokumen formal, pengumuman dibuat/dibaca, roster, RAB, misi, foto
 * profil, notifikasi web. Hadir diambil dari hari yang punya aktivitas tercatat.
 * Yang tidak berjejak (centang jadwal, pisang, Monkey Run) tetap terwakili oleh
 * "warisan" sehingga tidak ada yang XP-nya berkurang.
 */

import type { Env, Pengguna } from './tipe';
import { adalahAdmin } from './auth';
import { sekarangUtcIso } from './waktu';
import { periksaPrestasi } from './prestasi';
import {
  ATURAN_XP, hariWitaDari, isoDari, konversiAkun, levelDari, susunRiwayatXp, type BarisXpBaru, type KejadianXp, type SumberXp,
} from './xp-aturan';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);

/** Jam WITA (0–23) dari waktu tabel. */
const jamWitaDari = (waktu: string) => new Date(Date.parse(isoDari(waktu)) + 8 * 3_600_000).getUTCHours();

const bacaJson = (s: string | null | undefined): string[] => {
  try { const a = JSON.parse(s || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; }
};

const bulanSebelum = (bulan: string) => {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Semua kejadian lama yang punya pelaku dan waktu, sebelum `batas`. */
async function kumpulkanKejadian(env: Env, batas: string, idAktif: string[]): Promise<KejadianXp[]> {
  const k: KejadianXp[] = [];
  const sebelum = (w: string | null | undefined): w is string => Boolean(w) && isoDari(String(w)) < batas;
  const q = <T>(sql: string) => env.DB.prepare(sql).all<T>().then((r) => r.results);

  const [
    picaBuat, statusPica, tutup, update, bukti, laporan, fotoLaporan, titik, karhutla,
    memo, komentar, surat, dinas, mom, pengumuman, baca, roster, rab, misi, foto, push,
  ] = await Promise.all([
    q<{ id: string; dibuat_oleh: string; dibuat_pada: string }>("SELECT id, dibuat_oleh, dibuat_pada FROM pica WHERE dihapus = 0 AND dibuat_oleh IS NOT NULL"),
    q<{ pica_id: string; nilai_baru: string; oleh: string; pada: string }>("SELECT r.pica_id, r.nilai_baru, r.oleh, r.pada FROM pica_riwayat r JOIN pica p ON p.id = r.pica_id WHERE p.dihapus = 0 AND r.kolom = 'status' AND r.nilai_baru IN ('In Progress', 'Verifikasi')"),
    q<{ id: string; pic_id: string | null; due_date: string | null; ditutup_oleh: string | null; ditutup_pada: string }>("SELECT id, pic_id, due_date, ditutup_oleh, ditutup_pada FROM pica WHERE dihapus = 0 AND status = 'Closed' AND ditutup_pada IS NOT NULL"),
    // Catatan update yang dibuat otomatis oleh laporan FEED tidak dihitung dua kali (laporan sudah dihargai sendiri).
    q<{ pica_id: string; oleh: string; pada: string }>(`SELECT u.pica_id, u.oleh, u.pada FROM pica_update u JOIN pica p ON p.id = u.pica_id
       WHERE p.dihapus = 0 AND u.oleh IS NOT NULL AND length(trim(u.catatan)) >= 15
         AND NOT EXISTS (SELECT 1 FROM laporan l WHERE l.pica_id = u.pica_id AND l.user_id = u.oleh
                          AND abs(julianday(l.dibuat_pada) - julianday(u.pada)) < 0.002)`),
    q<{ entitas_id: string; oleh: string; pada: string }>("SELECT entitas_id, oleh, pada FROM lampiran WHERE entitas = 'pica' AND oleh IS NOT NULL"),
    q<{ id: string; user_id: string; pica_id: string | null; capaian: number | null; dibuat_pada: string }>('SELECT id, user_id, pica_id, capaian, dibuat_pada FROM laporan'),
    q<{ laporan_id: string; user_id: string; dibuat_pada: string; pertama: string }>(`SELECT l.id AS laporan_id, l.user_id, l.dibuat_pada, MIN(m.pada) AS pertama
       FROM lampiran m JOIN laporan l ON l.id = m.entitas_id WHERE m.entitas = 'laporan' GROUP BY l.id`),
    q<{ id: string; dicek_oleh: string; dicek_pada: string }>("SELECT id, dicek_oleh, dicek_pada FROM titik_api WHERE dicek_oleh IS NOT NULL AND dicek_pada IS NOT NULL AND status <> 'baru'"),
    q<{ id: string; dibuat_oleh: string | null; dibuat_pada: string; dikirim_oleh: string | null; dikirim_pada: string | null }>('SELECT id, dibuat_oleh, dibuat_pada, dikirim_oleh, dikirim_pada FROM laporan_karhutla'),
    q<{ id: string; user_id: string; dibuat_pada: string }>('SELECT id, user_id, dibuat_pada FROM memo WHERE dihapus_pada IS NULL AND length(trim(isi)) >= 50'),
    q<{ id: string; user_id: string; dibuat_pada: string }>('SELECT id, user_id, dibuat_pada FROM memo_komentar'),
    q<{ id: string; dibuat_oleh: string | null; dibuat_pada: string }>('SELECT id, dibuat_oleh, dibuat_pada FROM nomor_surat'),
    q<{ id: string; dibuat_oleh: string | null; dibuat_pada: string }>('SELECT id, dibuat_oleh, dibuat_pada FROM memo_dinas'),
    q<{ id: string; dibuat_oleh: string | null; dibuat_pada: string }>('SELECT id, dibuat_oleh, dibuat_pada FROM mom'),
    q<{ id: string; oleh: string; dibuat_pada: string }>('SELECT id, oleh, dibuat_pada FROM pengumuman'),
    q<{ pengumuman_id: string; user_id: string; pada: string; dibuat_pada: string; penting: number }>(`SELECT b.pengumuman_id, b.user_id, b.pada, p.dibuat_pada, p.penting
       FROM pengumuman_baca b JOIN pengumuman p ON p.id = b.pengumuman_id`),
    q<{ diubah_oleh: string; bulan: string; pertama: string }>(`SELECT r.diubah_oleh, substr(r.tanggal, 1, 7) AS bulan, MIN(r.diubah_pada) AS pertama
       FROM roster r JOIN tim t ON t.id = r.diubah_oleh WHERE t.peran IN ('admin', 'supervisor') GROUP BY r.diubah_oleh, bulan`),
    q<{ id: string; pemohon_id: string; diubah_pada: string }>("SELECT id, pemohon_id, diubah_pada FROM rab_rnr WHERE dihapus = 0 AND status <> 'Draf' AND status <> 'Ditolak'"),
    q<{ id: string; diubah_pada: string }>("SELECT id, diubah_pada FROM misi_global WHERE status = 'COMPLETED' AND diubah_pada IS NOT NULL"),
    q<{ id: string }>('SELECT id FROM tim WHERE foto IS NOT NULL'),
    q<{ user_id: string; pertama: string }>('SELECT user_id, MIN(dibuat_pada) AS pertama FROM push_langganan GROUP BY user_id'),
  ]);

  const dorong = (user: string | null | undefined, sumber: SumberXp, ref: string, pada: string | null | undefined, nilai?: number) => {
    if (user && sebelum(pada)) k.push({ user, sumber, ref, pada, nilai, catatan: 'hitung ulang riwayat' });
  };

  for (const p of picaBuat) dorong(p.dibuat_oleh, 'pica_buat', p.id, p.dibuat_pada);
  for (const r of statusPica) dorong(r.oleh, r.nilai_baru === 'Verifikasi' ? 'pica_ajukan' : 'pica_mulai', r.pica_id, r.pada);
  for (const p of tutup) {
    dorong(p.pic_id, 'pica_tutup', p.id, p.ditutup_pada);
    if (p.due_date && hariWitaDari(p.ditutup_pada) <= p.due_date) dorong(p.pic_id, 'pica_tepat_waktu', p.id, p.ditutup_pada);
    if (p.ditutup_oleh && p.ditutup_oleh !== p.pic_id) dorong(p.ditutup_oleh, 'pica_verifikasi', p.id, p.ditutup_pada);
  }
  for (const u of update) dorong(u.oleh, 'pica_update', `${u.pica_id}:${hariWitaDari(u.pada)}`, u.pada);
  for (const b of bukti) dorong(b.oleh, 'pica_bukti', `${b.entitas_id}:${hariWitaDari(b.pada)}`, b.pada);
  for (const l of laporan) {
    dorong(l.user_id, 'laporan_kirim', l.id, l.dibuat_pada);
    if (Number(l.capaian) > 0) dorong(l.user_id, 'laporan_capaian', l.id, l.dibuat_pada);
    if (l.pica_id) dorong(l.user_id, 'laporan_pica', l.id, l.dibuat_pada);
    if (jamWitaDari(l.dibuat_pada) < 12) dorong(l.user_id, 'laporan_pagi', hariWitaDari(l.dibuat_pada), l.dibuat_pada);
  }
  for (const f of fotoLaporan) {
    const hariSama = hariWitaDari(f.pertama) === hariWitaDari(f.dibuat_pada);
    dorong(f.user_id, hariSama ? 'laporan_foto' : 'laporan_foto_susulan', f.laporan_id, f.pertama);
  }
  for (const t of titik) dorong(t.dicek_oleh, 'titik_cek', t.id, t.dicek_pada);
  for (const r of karhutla) {
    dorong(r.dibuat_oleh, 'karhutla_laporan', r.id, r.dibuat_pada);
    dorong(r.dikirim_oleh, 'karhutla_kirim', r.id, r.dikirim_pada);
  }
  for (const m of memo) dorong(m.user_id, 'memo_tulis', `${m.id}:${hariWitaDari(m.dibuat_pada)}`, m.dibuat_pada);
  for (const c of komentar) dorong(c.user_id, 'memo_komentar', c.id, c.dibuat_pada);
  for (const s of surat) dorong(s.dibuat_oleh, 'dokumen_buat', `surat:${s.id}`, s.dibuat_pada);
  for (const s of dinas) dorong(s.dibuat_oleh, 'dokumen_buat', `memo_dinas:${s.id}`, s.dibuat_pada);
  for (const s of mom) dorong(s.dibuat_oleh, 'dokumen_buat', `mom:${s.id}`, s.dibuat_pada);
  for (const p of pengumuman) dorong(p.oleh, 'info_buat', p.id, p.dibuat_pada);
  for (const b of baca) {
    const jeda = Date.parse(isoDari(b.pada)) - Date.parse(isoDari(b.dibuat_pada));
    if (jeda >= 0 && jeda <= 24 * 3_600_000) dorong(b.user_id, 'info_baca', b.pengumuman_id, b.pada, b.penting ? 40 : undefined);
  }
  for (const r of roster) {
    // Roster bulan M terisi paling lambat tanggal 25 bulan sebelumnya.
    if (hariWitaDari(r.pertama) <= `${bulanSebelum(r.bulan)}-25`) dorong(r.diubah_oleh, 'roster_tim', r.bulan, r.pertama);
  }
  for (const r of rab) dorong(r.pemohon_id, 'rab_ajukan', r.id, r.diubah_pada);
  for (const m of misi) for (const id of idAktif) dorong(id, 'quest_selesai', m.id, m.diubah_pada);
  // Foto profil tidak punya cap waktu: dicatat tepat sebelum sistem baru mulai.
  const sesaatSebelum = new Date(Date.parse(batas) - 1000).toISOString();
  for (const t of foto) dorong(t.id, 'profil_foto', 'sekali', sesaatSebelum);
  for (const p of push) dorong(p.user_id, 'notif_aktif', 'sekali', p.pertama);
  return k;
}

interface Pratinjau {
  id: string; nama: string;
  xpLama: number; levelLama: number;
  riwayat: number; warisan: number; total: number; levelBaru: number; saldo: number;
  rincian: { sumber: SumberXp; label: string; jumlah: number; xp: number }[];
}

export async function ruteHitungUlangXp(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (jalur !== '/api/xp/hitung-ulang' || req.method !== 'POST') return null;
  if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh menghitung ulang XP.', 403);
  const terapkan = new URL(req.url).searchParams.get('terapkan') === '1';

  const atur = await env.DB.prepare("SELECT kunci, nilai FROM pengaturan WHERE kunci IN ('xp_mulai', 'xp_konversi')").all<{ kunci: string; nilai: string }>();
  const xpMulai = atur.results.find((r) => r.kunci === 'xp_mulai')?.nilai ?? sekarangUtcIso();
  const sudahKonversi = atur.results.find((r) => r.kunci === 'xp_konversi')?.nilai ?? null;
  if (terapkan && sudahKonversi) return galat(`XP sudah dikonversi pada ${sudahKonversi}. Konversi hanya sekali agar KPI tidak berubah-ubah.`, 409);

  const [tim, profil, ada] = await Promise.all([
    env.DB.prepare('SELECT id, nama, peran, aktif FROM tim').all<{ id: string; nama: string; peran: string; aktif: number }>(),
    env.DB.prepare('SELECT user_id, xp, level, xp_lama, skin_lama, skin_dimiliki FROM profil_game')
      .all<{ user_id: string; xp: number; level: number; xp_lama: number | null; skin_lama: string | null; skin_dimiliki: string | null }>(),
    env.DB.prepare("SELECT user_id, sumber, ref, xp, pada FROM xp_log WHERE dibatalkan_pada IS NULL").all<{ user_id: string; sumber: string; ref: string; xp: number; pada: string }>(),
  ]);
  const peran = new Map(tim.results.map((t) => [t.id, t.peran]));
  const idAktif = tim.results.filter((t) => t.aktif === 1 && t.peran !== 'pemantau').map((t) => t.id);
  const sudahAda = new Set(ada.results.map((r) => `${r.user_id}|${r.sumber}|${r.ref}`));

  const kejadian = await kumpulkanKejadian(env, xpMulai, idAktif);
  const baris = susunRiwayatXp(kejadian, (id) => peran.get(id), sudahAda, { hadirDariAktivitas: true });

  // Riwayat per orang = baris lama (sebelum xp_mulai, bukan warisan) yang sudah tercatat + baris baru.
  const riwayatPer = new Map<string, number>();
  const rincianPer = new Map<string, Map<SumberXp, { jumlah: number; xp: number }>>();
  const catat = (id: string, sumber: string, xp: number) => {
    riwayatPer.set(id, (riwayatPer.get(id) ?? 0) + xp);
    const r = rincianPer.get(id) ?? new Map();
    const s = r.get(sumber as SumberXp) ?? { jumlah: 0, xp: 0 };
    r.set(sumber as SumberXp, { jumlah: s.jumlah + 1, xp: s.xp + xp });
    rincianPer.set(id, r);
  };
  for (const r of ada.results) if (r.sumber !== 'warisan' && isoDari(r.pada) < xpMulai) catat(r.user_id, r.sumber, Number(r.xp));
  for (const r of baris) catat(r.user_id, r.sumber, r.xp);

  const pratinjau: Pratinjau[] = tim.results.map((t) => {
    const p = profil.results.find((x) => x.user_id === t.id);
    const xpLama = Number(p?.xp_lama ?? p?.xp ?? 0);
    const skinLama = bacaJson(p?.skin_lama ?? p?.skin_dimiliki ?? '["classic"]');
    const riwayat = riwayatPer.get(t.id) ?? 0;
    const k = konversiAkun({ xpLama, skinLama, riwayat });
    // XP yang didapat sesudah sistem baru mulai (sebelum konversi) tetap ikut di total.
    const sesudah = ada.results.filter((r) => r.user_id === t.id && r.sumber !== 'warisan' && isoDari(r.pada) >= xpMulai).reduce((n, r) => n + Number(r.xp), 0);
    const total = k.total + sesudah;
    return {
      id: t.id, nama: t.nama, xpLama, levelLama: Number(p?.level ?? 1),
      riwayat, warisan: k.warisan, total,
      levelBaru: Math.max(Number(p?.level ?? 1), levelDari(total)),
      saldo: total - k.terpakai,
      rincian: [...(rincianPer.get(t.id) ?? new Map<SumberXp, { jumlah: number; xp: number }>()).entries()]
        .map(([sumber, v]) => ({ sumber, label: ATURAN_XP[sumber].label, ...v }))
        .sort((a, b) => b.xp - a.xp),
    };
  }).filter((x) => x.xpLama > 0 || x.riwayat > 0);

  if (!terapkan) return json({ terapkan: false, xpMulai, sudahKonversi, barisBaru: baris.length, pratinjau });

  await tulisBaris(env, baris);
  const hariMulai = hariWitaDari(xpMulai);
  for (const x of pratinjau) {
    const p = profil.results.find((y) => y.user_id === x.id);
    const terpakaiLama = konversiAkun({ xpLama: x.xpLama, skinLama: bacaJson(p?.skin_lama ?? p?.skin_dimiliki ?? '["classic"]'), riwayat: x.riwayat }).terpakai;
    const perintah = [env.DB.prepare('INSERT OR IGNORE INTO profil_game (user_id) VALUES (?1)').bind(x.id)];
    perintah.push(x.warisan > 0
      ? env.DB.prepare(
        `INSERT INTO xp_log (user_id, sumber, ref, xp, wilayah, hari, pada, catatan)
         VALUES (?1, 'warisan', 'awal', ?2, 'warisan', ?3, ?4, 'XP lama yang tidak terbentuk dari riwayat')
         ON CONFLICT(user_id, sumber, ref) DO UPDATE SET xp = excluded.xp`,
      ).bind(x.id, x.warisan, hariMulai, xpMulai)
      : env.DB.prepare("DELETE FROM xp_log WHERE user_id = ?1 AND sumber = 'warisan' AND ref = 'awal'").bind(x.id));
    perintah.push(env.DB.prepare(
      `UPDATE profil_game SET
         xp = (SELECT COALESCE(SUM(xp), 0) FROM xp_log WHERE user_id = ?1 AND dibatalkan_pada IS NULL),
         level = MAX(level, ?2),
         xp_terpakai = xp_terpakai + ?3
       WHERE user_id = ?1`,
    ).bind(x.id, x.levelBaru, terpakaiLama));
    await env.DB.batch(perintah);
  }
  await env.DB.prepare("INSERT OR REPLACE INTO pengaturan (kunci, nilai, catatan) VALUES ('xp_konversi', ?1, 'Hitung ulang XP diterapkan')")
    .bind(sekarangUtcIso()).run();
  // Riwayat lama ikut membuka Skin Prestasi (mis. sudah menutup 10 PICA sebelum sistem baru).
  for (const id of idAktif) await periksaPrestasi(env, id, pengguna);
  return json({ terapkan: true, xpMulai, barisBaru: baris.length, pratinjau });
}

async function tulisBaris(env: Env, baris: BarisXpBaru[]): Promise<void> {
  const perintah = baris.map((r) => env.DB.prepare(
    `INSERT OR IGNORE INTO xp_log (user_id, sumber, ref, xp, wilayah, hari, pada, catatan)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  ).bind(r.user_id, r.sumber, r.ref.slice(0, 160), r.xp, r.wilayah, r.hari, r.pada, r.catatan));
  for (let i = 0; i < perintah.length; i += 50) await env.DB.batch(perintah.slice(i, i + 50));
}
