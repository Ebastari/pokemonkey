/**
 * Sistem hati: disiplin membuka aplikasi.
 *
 * - GET  /api/hati            dipanggil layar aplikasi saat dibuka. Bila sejak
 *                             terakhir membuka ada ≥ 1 hari kerja (menurut roster)
 *                             yang terlewat, hati mati. Hari libur/cuti/izin tidak dihitung.
 * - POST /api/hati/ajukan     pemilik hati mati memilih alasan; pesan permintaan maaf
 *                             + tautan "hidupkan" dikirim ke grup WhatsApp tim.
 * - GET  /api/hati/permohonan daftar hati mati (Admin/Supervisor), atau satu lewat ?token=.
 * - POST /api/hati/hidupkan   Admin/Supervisor menghidupkan kembali (lewat token atau id).
 *
 * Hanya rute ini yang dihitung sebagai "membuka aplikasi": penjadwal notifikasi
 * di latar dan widget memakai rute lain, jadi tidak ikut menjaga hati tetap hidup.
 */

import type { Env, Pengguna } from './tipe';
import { sekarangUtcIso, tanggalWita, geserHari, tanggalIndonesia } from './waktu';
import { antre, ambilPengaturan, prosesAntrean } from './wa';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);
const bolehMenghidupkan = (p: Pengguna) => p.peran === 'admin' || p.peran === 'supervisor';

/** Kode roster yang bukan hari kerja: libur, field break/cuti, izin (kode baru dan lama). */
const KODE_BUKAN_KERJA = ['OFF', 'FB', 'IK', 'L', 'C', 'I'];
/** Paling lama ditelusuri ke belakang; lebih dari ini tetap dihitung dari batas ini. */
const MAKS_HARI_TELUSUR = 60;
/** Jeda minimal kirim ulang pesan ke grup. */
const JEDA_KIRIM_ULANG_MENIT = 10;

export const ALASAN_HATI: Record<string, { label: string; kalimat: (ket: string) => string }> = {
  lalai: { label: 'Lalai', kalimat: () => 'sehingga saya lalai' },
  sakit: { label: 'Sakit', kalimat: () => 'karena saya sakit' },
  sinyal: { label: 'Tidak ada sinyal / HP bermasalah', kalimat: () => 'karena tidak ada sinyal atau HP saya bermasalah' },
  tugas: { label: 'Tugas di luar site', kalimat: () => 'karena saya bertugas di luar site' },
  lain: { label: 'Lainnya', kalimat: (ket) => (ket ? `karena ${ket.replace(/[.\s]+$/, '')}` : 'karena alasan lain') },
};

interface BarisMati {
  id: string;
  user_id: string;
  mati_pada: string;
  buka_terakhir: string;
  hari_absen: number;
  tanggal_absen: string;
  alasan: string | null;
  keterangan: string | null;
  token: string | null;
  diajukan_pada: string | null;
  dihidupkan_oleh: string | null;
  dihidupkan_pada: string | null;
}

const idBaru = () => `hm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const tokenBaru = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 28);

const daftarTanggal = (json_: string): string[] => {
  try { const d = JSON.parse(json_); return Array.isArray(d) ? d.map(String) : []; } catch { return []; }
};

/** "28 Sep 2026" atau "28 Sep – 2 Okt 2026" untuk rentang hari yang terlewat. */
function rentangTanggal(tgl: string[]): string {
  if (!tgl.length) return '-';
  if (tgl.length === 1) return tanggalIndonesia(tgl[0]);
  return `${tanggalIndonesia(tgl[0])} – ${tanggalIndonesia(tgl[tgl.length - 1])}`;
}

/** Kalimat permintaan maaf yang dikirim ke grup. */
export function kalimatMaaf(hari: number, alasan: string, keterangan: string): string {
  const a = ALASAN_HATI[alasan] ?? ALASAN_HATI.lalai;
  return `Maaf, ${hari} hari saya tidak membuka PICA ${a.kalimat(keterangan.trim())}.`;
}

function bentukStatus(b: BarisMati) {
  return {
    status: 'mati' as const,
    id: b.id,
    hariAbsen: b.hari_absen,
    tanggalAbsen: daftarTanggal(b.tanggal_absen),
    bukaTerakhir: b.buka_terakhir,
    matiPada: b.mati_pada,
    alasan: b.alasan,
    keterangan: b.keterangan,
    diajukanPada: b.diajukan_pada,
  };
}

const matiAktif = (env: Env, userId: string) =>
  env.DB.prepare('SELECT * FROM hati_mati WHERE user_id = ?1 AND dihidupkan_pada IS NULL ORDER BY mati_pada DESC LIMIT 1')
    .bind(userId)
    .first<BarisMati>();

/** Periksa hati pemilik akun saat aplikasi dibuka; mencatat "hari ini dibuka" bila masih hidup. */
async function periksa(env: Env, pengguna: Pengguna) {
  const aktif = await matiAktif(env, pengguna.id);
  if (aktif) return bentukStatus(aktif);

  const hariIni = tanggalWita();
  await env.DB.prepare('INSERT OR IGNORE INTO profil_game (user_id) VALUES (?1)').bind(pengguna.id).run();
  const p = await env.DB.prepare('SELECT hati_buka_terakhir AS t FROM profil_game WHERE user_id = ?1')
    .bind(pengguna.id)
    .first<{ t: string | null }>();
  const terakhir = p?.t ?? null;

  const catatHariIni = () =>
    env.DB.prepare('UPDATE profil_game SET hati_buka_terakhir = ?2 WHERE user_id = ?1').bind(pengguna.id, hariIni).run();

  // Belum pernah tercatat, atau sudah membuka hari ini / kemarin: tidak ada hari yang terlewat.
  if (!terakhir || terakhir >= geserHari(hariIni, -1)) {
    if (terakhir !== hariIni) await catatHariIni();
    return { status: 'hidup' as const };
  }

  // Hari di antara terakhir membuka dan hari ini (keduanya tidak termasuk) yang rosternya hari kerja.
  const dari = terakhir < geserHari(hariIni, -MAKS_HARI_TELUSUR) ? geserHari(hariIni, -MAKS_HARI_TELUSUR) : geserHari(terakhir, 1);
  const sampai = geserHari(hariIni, -1);
  const { results } = await env.DB.prepare(
    `SELECT tanggal FROM roster
      WHERE user_id = ?1 AND tanggal BETWEEN ?2 AND ?3
        AND UPPER(kode) NOT IN (${KODE_BUKAN_KERJA.map((k) => `'${k}'`).join(',')})
      ORDER BY tanggal`,
  )
    .bind(pengguna.id, dari, sampai)
    .all<{ tanggal: string }>();
  const terlewat = results.map((r) => r.tanggal);

  if (!terlewat.length) {
    await catatHariIni();
    return { status: 'hidup' as const };
  }

  const baris: BarisMati = {
    id: idBaru(), user_id: pengguna.id, mati_pada: sekarangUtcIso(), buka_terakhir: terakhir,
    hari_absen: terlewat.length, tanggal_absen: JSON.stringify(terlewat),
    alasan: null, keterangan: null, token: null, diajukan_pada: null, dihidupkan_oleh: null, dihidupkan_pada: null,
  };
  await env.DB.prepare(
    `INSERT INTO hati_mati (id, user_id, mati_pada, buka_terakhir, hari_absen, tanggal_absen)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(baris.id, baris.user_id, baris.mati_pada, baris.buka_terakhir, baris.hari_absen, baris.tanggal_absen)
    .run();
  return bentukStatus(baris);
}

async function kirimKeGrup(env: Env, isi: string, ref: string): Promise<boolean> {
  const aktif = (await ambilPengaturan(env, 'wa_aktif')) === '1';
  const grup = await ambilPengaturan(env, 'wa_grup_id');
  if (!aktif || !grup) return false;
  await antre(env, { tujuan: grup, isi, jenis: 'hati', ref_id: ref });
  await prosesAntrean(env, 3);
  return true;
}

export async function ruteHati(jalur: string, req: Request, env: Env, pengguna: Pengguna, asal: string): Promise<Response | null> {
  if (!jalur.startsWith('/api/hati')) return null;

  if (jalur === '/api/hati' && req.method === 'GET') return json(await periksa(env, pengguna));

  // ---------- pemilik hati mati mengirim permohonan ke grup
  if (jalur === '/api/hati/ajukan' && req.method === 'POST') {
    const mati = await matiAktif(env, pengguna.id);
    if (!mati) return galat('Hati Anda tidak sedang mati.', 409);
    const b = (await req.json().catch(() => null)) as { alasan?: string; keterangan?: string } | null;
    const alasan = String(b?.alasan ?? '');
    const keterangan = String(b?.keterangan ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!ALASAN_HATI[alasan]) return galat('Pilih alasan terlebih dahulu.');
    if (alasan === 'lain' && !keterangan) return galat('Tuliskan alasannya di kolom keterangan.');

    if (mati.diajukan_pada && Date.now() - Date.parse(mati.diajukan_pada) < JEDA_KIRIM_ULANG_MENIT * 60_000) {
      return galat(`Permohonan baru saja dikirim. Kirim ulang bisa dilakukan setelah ${JEDA_KIRIM_ULANG_MENIT} menit.`, 429);
    }

    const token = mati.token ?? tokenBaru();
    const kini = sekarangUtcIso();
    await env.DB.prepare('UPDATE hati_mati SET alasan = ?2, keterangan = ?3, token = ?4, diajukan_pada = ?5 WHERE id = ?1')
      .bind(mati.id, alasan, keterangan || null, token, kini)
      .run();

    const dasar = (env.ALAMAT_PUBLIK || asal || '').replace(/\/+$/, '');
    const tgl = daftarTanggal(mati.tanggal_absen);
    const isi =
      `💔 *HATI MATI · POKEMONKEY*\n\n` +
      `*${pengguna.nama}* menulis:\n` +
      `"${kalimatMaaf(mati.hari_absen, alasan, keterangan)}"\n\n` +
      `📅 *Tidak membuka aplikasi:* ${rentangTanggal(tgl)} (${mati.hari_absen} hari kerja)\n` +
      `📝 *Alasan:* ${ALASAN_HATI[alasan].label}\n` +
      (keterangan ? `💬 *Keterangan:* ${keterangan}\n` : '') +
      `\nAdmin/Supervisor, hidupkan kembali hatinya lewat tautan ini:\n${dasar}/?hidupkan=${token}\n\n` +
      `— Sistem POKEMONKEY`;
    const terkirim = await kirimKeGrup(env, isi, `hati-${mati.id}-${Date.now()}`);
    return json({
      ok: true,
      wa: terkirim,
      pesan: terkirim
        ? 'Permohonan terkirim ke grup WhatsApp. Menunggu Admin/Supervisor menghidupkan.'
        : 'Permohonan tersimpan, tetapi WhatsApp belum aktif. Minta Admin/Supervisor menghidupkan dari menu TEAM.',
      status: bentukStatus({ ...mati, alasan, keterangan: keterangan || null, token, diajukan_pada: kini }),
    });
  }

  // ---------- Admin/Supervisor: daftar hati mati, atau satu lewat token dari tautan
  if (jalur === '/api/hati/permohonan' && req.method === 'GET') {
    if (!bolehMenghidupkan(pengguna)) return galat('Hanya Admin/Supervisor yang boleh melihat permohonan.', 403);
    const token = new URL(req.url).searchParams.get('token');
    const { results } = await env.DB.prepare(
      `SELECT h.*, t.nama, t.jabatan, o.nama AS oleh_nama
         FROM hati_mati h JOIN tim t ON t.id = h.user_id LEFT JOIN tim o ON o.id = h.dihidupkan_oleh
        WHERE ${token ? 'h.token = ?1' : 'h.dihidupkan_pada IS NULL'}
        ORDER BY h.mati_pada DESC LIMIT 50`,
    )
      .bind(...(token ? [token] : []))
      .all<BarisMati & { nama: string; jabatan: string | null; oleh_nama: string | null }>();
    return json({
      permohonan: results.map((r) => ({
        ...bentukStatus(r),
        userId: r.user_id,
        nama: r.nama,
        jabatan: r.jabatan,
        kalimat: r.alasan ? kalimatMaaf(r.hari_absen, r.alasan, r.keterangan ?? '') : null,
        labelAlasan: r.alasan ? ALASAN_HATI[r.alasan]?.label ?? r.alasan : null,
        dihidupkanPada: r.dihidupkan_pada,
        dihidupkanOleh: r.oleh_nama,
      })),
    });
  }

  // ---------- Admin/Supervisor menghidupkan kembali
  if (jalur === '/api/hati/hidupkan' && req.method === 'POST') {
    if (!bolehMenghidupkan(pengguna)) return galat('Hanya Admin/Supervisor yang boleh menghidupkan hati.', 403);
    const b = (await req.json().catch(() => null)) as { token?: string; id?: string } | null;
    const mati = b?.token
      ? await env.DB.prepare('SELECT * FROM hati_mati WHERE token = ?1').bind(String(b.token)).first<BarisMati>()
      : b?.id
        ? await env.DB.prepare('SELECT * FROM hati_mati WHERE id = ?1').bind(String(b.id)).first<BarisMati>()
        : null;
    if (!mati) return galat('Permohonan tidak ditemukan atau tautannya sudah tidak berlaku.', 404);
    const pemilik = await env.DB.prepare('SELECT nama FROM tim WHERE id = ?1').bind(mati.user_id).first<{ nama: string }>();
    if (mati.dihidupkan_pada) return json({ ok: true, sudah: true, nama: pemilik?.nama ?? mati.user_id });
    // Tidak menghidupkan diri sendiri; Admin dikecualikan supaya tidak buntu bila tidak ada penyetuju lain.
    if (mati.user_id === pengguna.id && pengguna.peran !== 'admin') {
      return galat('Hati sendiri harus dihidupkan oleh Admin atau Supervisor lain.', 403);
    }

    const kini = sekarangUtcIso();
    await env.DB.batch([
      env.DB.prepare('UPDATE hati_mati SET dihidupkan_oleh = ?2, dihidupkan_pada = ?3 WHERE id = ?1').bind(mati.id, pengguna.id, kini),
      // Hitungan hari dimulai lagi dari hari ini.
      env.DB.prepare('UPDATE profil_game SET hati_buka_terakhir = ?2 WHERE user_id = ?1').bind(mati.user_id, tanggalWita()),
    ]);
    await kirimKeGrup(
      env,
      `❤️ *HATI HIDUP KEMBALI*\n\nHati *${pemilik?.nama ?? mati.user_id}* dihidupkan oleh *${pengguna.nama}*.\n\n— Sistem POKEMONKEY`,
      `hati-hidup-${mati.id}`,
    ).catch(() => false);
    return json({ ok: true, nama: pemilik?.nama ?? mati.user_id });
  }

  return null;
}
