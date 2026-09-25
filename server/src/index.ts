/**
 * POKEMONKEY API — Cloudflare Worker
 *
 * Satu berkas berisi seluruh rute supaya mudah dibaca dari atas ke bawah.
 * Prinsip yang dipegang:
 *   - Setiap penulisan menjawab dengan hasilnya (tidak ada lagi 'no-cors' buta).
 *   - Capaian dijumlah di server, bukan dikirim sebagai nilai akhir oleh aplikasi.
 *   - Setiap perubahan PICA meninggalkan jejak di pica_riwayat.
 *   - Cron tunggal mengurus seluruh tangga pengingat.
 */

import type { Env, Pengguna } from './tipe';
import {
  hashPassword,
  cekPassword,
  buatSesi,
  hapusSesi,
  penggunaDariHeader,
  bolehUbahKunci,
  adalahAdmin,
} from './auth';
import {
  antre,
  prosesAntrean,
  kirimLangsung,
  ambilPengaturan,
  pesanPengingat,
  pesanRekap,
  statusWa,
  daftarGrupWa,
} from './wa';
import { ruteGame } from './game';
import { rutePersonal } from './personal';
import { ruteCuaca } from './cuaca';
import { halamanLihatPica, tautanLihatPica } from './lihat';
import { periksaTitikApi, ruteTitikApi } from './titik-api';
import { ruteLaporanKarhutla } from './laporan-karhutla';
import { ruteDokumen } from './dokumen';
import { siapkanNotif, siapkanRekapPica, liburPada, acaraPengingat } from './sumber';
import { rutePush, kirimPushTerjadwal, kirimPushAcara } from './push';
import {
  tanggalWita,
  jamWita,
  sekarangUtcIso,
  selisihHari,
  geserHari,
  utcDariWita,
} from './waktu';

// ---------- Pembantu jawaban ----------

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

function galat(pesan: string, status = 400): Response {
  return json({ galat: pesan }, status);
}

/** Buat id pendek yang urut waktu, untuk entitas selain PICA. */
function idBaru(awalan: string): string {
  return `${awalan}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ---------- Router ----------

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(req.url);
    const jalur = url.pathname.replace(/\/+$/, '') || '/';

    try {
      // Webhook Fonnte tidak memakai sesi pengguna, tetapi wajib membawa kunci rahasia
      // di URL-nya. Daftarkan di dasbor Fonnte sebagai: https://<worker>/wa/webhook?kunci=<WEBHOOK_KUNCI>
      if (jalur === '/wa/webhook' && req.method === 'POST') {
        if (!env.WEBHOOK_KUNCI || url.searchParams.get('kunci') !== env.WEBHOOK_KUNCI) {
          return galat('Kunci webhook tidak sah.', 403);
        }
        return webhookWa(req, env);
      }
      if (jalur === '/' || jalur === '/api') return json({ nama: env.APP_NAMA, siap: true });

      // Tautan berbagi baca-saja: dibuka di komputer tanpa login.
      const cocokBagiPublik = jalur.match(/^\/api\/bagi\/([\w-]+)\/kalender$/);
      if (cocokBagiPublik && req.method === 'GET') return kalenderBagi(cocokBagiPublik[1], url, env);

      // Papan PICA hanya-baca dari tautan di rekap WhatsApp (kunci berganti tiap Senin).
      if (jalur === '/lihat/pica' && req.method === 'GET') return halamanLihatPica(url, env);

      // Login adalah satu-satunya rute lain yang boleh tanpa token.
      if (jalur === '/api/auth/login' && req.method === 'POST') return login(req, env);

      const pengguna = await penggunaDariHeader(req, env);
      if (!pengguna) return galat('Sesi tidak sah. Silakan masuk kembali.', 401);

      if (jalur === '/api/auth/logout' && req.method === 'POST') {
        const h = req.headers.get('Authorization') ?? '';
        await hapusSesi(env, h.slice(7));
        return json({ ok: true });
      }
      if (jalur === '/api/me') return json({ pengguna });
      if (jalur === '/api/bootstrap') return bootstrap(env, pengguna);
      if (jalur === '/api/dasbor') return dasbor(env);

      // Fitur game yang sudah ada: profil XP/skin, pemain lain di KEBUN, misi global.
      const hasilGame = await ruteGame(jalur, req, env, pengguna);
      if (hasilGame) return hasilGame;

      // Roster bulanan dan memo pribadi.
      const hasilPersonal = await rutePersonal(jalur, req, env, pengguna);
      if (hasilPersonal) return hasilPersonal;

      // Prakiraan cuaca BMKG untuk KEBUN (hujan di layar + panel prakiraan).
      const hasilCuaca = await ruteCuaca(jalur, req, env);
      if (hasilCuaca) return hasilCuaca;

      // Titik api NASA FIRMS: daftar, ubah status hasil cek lapangan, periksa manual (Admin).
      const hasilTitikApi = await ruteTitikApi(jalur, req, env, pengguna);
      if (hasilTitikApi) return hasilTitikApi;

      // FIRE: titik sebulan untuk tabel harian dan arsip laporan karhutla (PDF di R2).
      const hasilKarhutla = await ruteLaporanKarhutla(jalur, req, env, pengguna);
      if (hasilKarhutla) return hasilKarhutla;

      // Dokumen administrasi (nomor surat, Internal Memo dinas, MoM) dan foto profil.
      const hasilDokumen = await ruteDokumen(jalur, req, env, pengguna);
      if (hasilDokumen) return hasilDokumen;

      // Isi notifikasi terjadwal untuk pemakai ini: pagi (PICA Open), siang (Info), sore (XP).
      // Dipakai Background Runner Android dan pratinjau di layar Notifikasi.
      if (jalur === '/api/notif/ringkas' && req.method === 'GET') {
        const slot = url.searchParams.get('slot');
        if (slot !== 'pagi' && slot !== 'siang' && slot !== 'sore') return galat('slot harus pagi, siang, atau sore.');
        return json(await siapkanNotif(env, pengguna, slot, tanggalWita()));
      }

      // Pengingat acara kalender pada satu tanggal WITA. Dipakai penjadwal di HP
      // untuk memasang alarmnya sendiri, dan layar NOTIF untuk pratinjau.
      if (jalur === '/api/notif/acara' && req.method === 'GET') {
        const tanggal = url.searchParams.get('tanggal') || tanggalWita();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return galat('Format tanggal: YYYY-MM-DD');
        return json({ acara: await acaraPengingat(env, pengguna, tanggal), tanggal });
      }

      // Rekap progres PICA untuk grup WhatsApp: ?dryRun=1 hanya menampilkan teksnya.
      if (jalur === '/api/notify/rekap-pica' && req.method === 'POST') {
        if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh mengirim rekap ke grup.', 403);
        const jenis = url.searchParams.get('jenis') === 'mingguan' ? 'mingguan' : 'harian';
        const tautan = await tautanLihatPica(env, tanggalWita(), url.origin);
        const pesan = await siapkanRekapPica(env, jenis, tanggalWita(), tautan);
        if (url.searchParams.get('dryRun') === '1') return json({ pesan, terkirim: false });

        const grup = await ambilPengaturan(env, 'wa_grup_id');
        if (!grup) return galat('ID grup WhatsApp belum diisi di Pengaturan.');
        const waAktif = (await ambilPengaturan(env, 'wa_aktif')) === '1';
        if (!waAktif) return galat('Pengiriman WhatsApp masih dimatikan (pengaturan wa_aktif = 0).', 409);

        await antre(env, { tujuan: grup, isi: pesan, jenis: 'rekap', ref_id: `rekap-pica-manual-${Date.now()}` });
        const hasil = await prosesAntrean(env, 3);
        return json({ pesan, ...hasil, terkirim: hasil.terkirim > 0 });
      }

      // Web Push (iPhone PWA & browser): kunci publik, langganan, uji kirim.
      const hasilPush = await rutePush(jalur, req, env, pengguna);
      if (hasilPush) return hasilPush;

      // --- PICA ---
      if (jalur === '/api/pica' && req.method === 'GET') return daftarPica(url, env);
      if (jalur === '/api/pica/impor' && req.method === 'POST') return imporPicaBatch(req, env, pengguna);
      if (jalur === '/api/pica' && req.method === 'POST') return buatPica(req, env, pengguna);

      const cocokPica = jalur.match(/^\/api\/pica\/([\w-]+)$/);
      if (cocokPica) {
        if (req.method === 'GET') return detailPica(cocokPica[1], env);
        if (req.method === 'PATCH') return ubahPica(cocokPica[1], req, env, pengguna);
        if (req.method === 'DELETE') return hapusPica(cocokPica[1], env, pengguna);
      }

      const cocokUpdate = jalur.match(/^\/api\/pica\/([\w-]+)\/update$/);
      if (cocokUpdate && req.method === 'POST') return tambahUpdate(cocokUpdate[1], req, env, pengguna);

      const cocokKunci = jalur.match(/^\/api\/periode\/([\w-]+)\/kunci$/);
      if (cocokKunci && req.method === 'POST') return kunciPeriode(cocokKunci[1], env, pengguna);

      // --- Kolom & pilihan dinamis ---
      if (jalur === '/api/properti' && req.method === 'POST') return tambahProperti(req, env, pengguna);
      if (jalur === '/api/opsi' && req.method === 'POST') return tambahOpsi(req, env, pengguna);

      // --- Pengumuman ---
      if (jalur === '/api/pengumuman' && req.method === 'GET') return daftarPengumuman(env, pengguna);
      if (jalur === '/api/pengumuman' && req.method === 'POST') return buatPengumuman(req, env, pengguna);
      const cocokBaca = jalur.match(/^\/api\/pengumuman\/([\w-]+)\/baca$/);
      if (cocokBaca && req.method === 'POST') {
        await env.DB.prepare(
          'INSERT OR IGNORE INTO pengumuman_baca (pengumuman_id, user_id) VALUES (?1, ?2)',
        )
          .bind(cocokBaca[1], pengguna.id)
          .run();
        return json({ ok: true });
      }

      // --- Jadwal ---
      if (jalur === '/api/jadwal' && req.method === 'GET') return daftarJadwal(url, env);
      if (jalur === '/api/jadwal' && req.method === 'POST') return buatJadwal(req, env, pengguna);
      const cocokJadwal = jalur.match(/^\/api\/jadwal\/([\w-]+)$/);
      if (cocokJadwal && req.method === 'PATCH') return ubahJadwal(cocokJadwal[1], req, env, pengguna);
      if (cocokJadwal && req.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM jadwal WHERE id = ?1').bind(cocokJadwal[1]).run();
        return json({ ok: true });
      }

      // --- Laporan lapangan ---
      if (jalur === '/api/laporan' && req.method === 'GET') return daftarLaporan(env);
      if (jalur === '/api/laporan' && req.method === 'POST') return buatLaporan(req, env, pengguna);

      // --- Lampiran ---
      if (jalur === '/api/lampiran' && req.method === 'POST') return unggahLampiran(req, env, pengguna);
      // Foto dokumentasi terbaru dari laporan FEED dan bukti PICA (untuk galeri Monkey Point).
      if (jalur === '/api/galeri' && req.method === 'GET') {
        const hari = Math.min(90, Math.max(1, Number(url.searchParams.get('hari')) || 30));
        const { results } = await env.DB.prepare(
          `SELECT m.kunci_r2 AS kunci, m.entitas AS sumber, m.pada,
                  CASE WHEN m.entitas = 'pica' THEN p.id ELSE COALESCE(l.pica_id, l.jenis) END AS ref,
                  CASE WHEN m.entitas = 'pica' THEN COALESCE(p.judul_singkat, p.judul) ELSE COALESCE(l.jenis, 'Laporan lapangan') END AS judul,
                  CASE WHEN m.entitas = 'pica' THEN p.tindakan ELSE l.catatan END AS keterangan,
                  CASE WHEN m.entitas = 'pica' THEN tp.nama ELSE tl.nama END AS oleh
             FROM lampiran m
             LEFT JOIN pica p ON m.entitas = 'pica' AND p.id = m.entitas_id
             LEFT JOIN tim tp ON tp.id = p.pic_id
             LEFT JOIN laporan l ON m.entitas = 'laporan' AND l.id = m.entitas_id
             LEFT JOIN tim tl ON tl.id = l.user_id
            WHERE m.tipe_mime LIKE 'image/%' AND m.entitas IN ('pica', 'laporan')
              AND (m.entitas <> 'pica' OR p.dihapus = 0)
              AND m.pada >= datetime('now', ?1)
            ORDER BY m.pada DESC LIMIT 12`,
        ).bind(`-${hari} days`).all();
        return json({ foto: results });
      }
      const cocokBerkas = jalur.match(/^\/api\/berkas\/(.+)$/);
      if (cocokBerkas && req.method === 'GET') return ambilBerkas(decodeURIComponent(cocokBerkas[1]), env);

      // --- Tautan berbagi ---
      if (jalur === '/api/bagi' && req.method === 'GET') return daftarTautanBagi(env, pengguna);
      if (jalur === '/api/bagi' && req.method === 'POST') return buatTautanBagi(req, env, pengguna);
      const cocokBagi = jalur.match(/^\/api\/bagi\/([\w-]+)$/);
      if (cocokBagi && req.method === 'DELETE') {
        if (!bolehUbahKunci(pengguna)) return galat('Hanya Admin/Supervisor.', 403);
        await env.DB.prepare('UPDATE tautan_bagi SET aktif = 0 WHERE token = ?1').bind(cocokBagi[1]).run();
        return json({ ok: true });
      }

      // --- Tim & pengaturan ---
      if (jalur === '/api/tim' && req.method === 'GET') return daftarTim(env);
      const cocokProfilTim = jalur.match(/^\/api\/tim\/([\w-]+)\/profil$/);
      if (cocokProfilTim && req.method === 'GET') return profilAnggota(cocokProfilTim[1], env);
      if (jalur === '/api/tim' && req.method === 'POST') return tambahTim(req, env, pengguna);
      // Admin mengosongkan password anggota; login berikutnya membuat password baru dengan kode undangan.
      const cocokReset = jalur.match(/^\/api\/tim\/([\w-]+)\/reset-password$/);
      if (cocokReset && req.method === 'POST') {
        if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh mereset password.', 403);
        if (cocokReset[1] === pengguna.id) return galat('Password akun sendiri tidak bisa direset dari sini.', 400);
        const r = await env.DB.prepare('UPDATE tim SET password_hash = NULL WHERE id = ?1').bind(cocokReset[1]).run();
        if (!r.meta.changes) return galat('Anggota tidak ditemukan.', 404);
        await env.DB.prepare('DELETE FROM sesi WHERE user_id = ?1').bind(cocokReset[1]).run();
        return json({ ok: true, pesan: 'Password direset. Anggota membuat password baru saat login berikutnya dengan kode undangan.' });
      }
      const cocokTim = jalur.match(/^\/api\/tim\/([\w-]+)$/);
      if (cocokTim && req.method === 'PATCH') return ubahTim(cocokTim[1], req, env, pengguna);
      if (jalur === '/api/pengaturan' && req.method === 'GET') return daftarPengaturan(env, pengguna);
      if (jalur === '/api/pengaturan' && req.method === 'POST') return simpanPengaturan(req, env, pengguna);

      // --- WhatsApp ---
      if (jalur === '/api/wa/uji' && req.method === 'POST') return ujiWa(req, env, pengguna);
      if (jalur === '/api/wa/status' && req.method === 'GET') {
        if (!adalahAdmin(pengguna)) return galat('Hanya Admin.', 403);
        return json(await statusWa(env));
      }
      if (jalur === '/api/wa/grup' && req.method === 'GET') {
        if (!adalahAdmin(pengguna)) return galat('Hanya Admin.', 403);
        return json(await daftarGrupWa(env, url.searchParams.get('segarkan') === '1'));
      }
      if (jalur === '/api/wa/antrean' && req.method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT id, tujuan, jenis, status, percobaan, galat, kirim_pada, substr(isi,1,90) AS cuplikan
             FROM pesan_wa ORDER BY id DESC LIMIT 50`,
        ).all();
        return json({ antrean: results });
      }

      return galat('Rute tidak ditemukan: ' + jalur, 404);
    } catch (e) {
      console.error('Galat tak tertangani', e);
      return galat(e instanceof Error ? e.message : 'Galat server', 500);
    }
  },

  /** Satu cron untuk semuanya. Berjalan tiap 15 menit (UTC). */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(jalankanTerjadwal(env));
  },
};

// ============================================================
// Auth
// ============================================================

async function login(req: Request, env: Env): Promise<Response> {
  const b = (await req.json()) as { userId?: string; password?: string };
  const userId = (b.userId ?? '').trim().toLowerCase();
  const password = b.password ?? '';

  if (!userId || password.length < 6) return galat('User ID dan password (min. 6 karakter) wajib diisi.');

  const baris = await env.DB.prepare(
    'SELECT id, nama, jabatan, bidang, wa, peran, foto, password_hash FROM tim WHERE id = ?1 AND aktif = 1',
  )
    .bind(userId)
    .first<Pengguna & { password_hash: string | null }>();

  // Jawaban yang sama untuk user tidak ada maupun password salah.
  if (!baris) return galat('User ID atau password salah.', 401);

  let baruSaja = false;
  if (!baris.password_hash) {
    // Login pertama: password yang diketik menjadi password akun — tetapi hanya
    // dengan kode undangan dari Admin. Tanpa ini, siapa pun yang tahu user ID
    // bisa mengklaim akun lebih dulu dari pemiliknya.
    // Keyboard HP sering mengkapitalkan huruf pertama atau menambah spasi di akhir,
    // jadi kode dicocokkan tanpa spasi tepi dan tanpa membedakan huruf besar/kecil.
    const kode = String((b as { kodeUndangan?: string }).kodeUndangan ?? '').trim().toLowerCase();
    const kodeServer = (env.KODE_UNDANGAN ?? '').trim().toLowerCase();
    if (!kodeServer) {
      return galat('Kode undangan belum dipasang di server. Admin menjalankan: npx wrangler secret put KODE_UNDANGAN', 503);
    }
    if (kode !== kodeServer) {
      return json(
        {
          galat: kode
            ? 'Kode undangan tidak cocok. Periksa lagi kodenya, atau minta ulang ke Admin.'
            : 'Akun ini belum punya password. Masukkan kode undangan dari Admin untuk membuatnya.',
          perluKodeUndangan: true,
          kodeSalah: Boolean(kode),
        },
        403,
      );
    }
    await env.DB.prepare('UPDATE tim SET password_hash = ?2 WHERE id = ?1')
      .bind(userId, await hashPassword(password))
      .run();
    baruSaja = true;
  } else if (!(await cekPassword(password, baris.password_hash))) {
    return galat('User ID atau password salah.', 401);
  }

  const token = await buatSesi(env, userId);
  const { password_hash, ...pengguna } = baris;
  return json({ token, pengguna, passwordBaruDibuat: baruSaja });
}

// ============================================================
// Bootstrap & dasbor
// ============================================================

async function bootstrap(env: Env, pengguna: Pengguna): Promise<Response> {
  const [opsi, properti, tim, periode, pengaturan] = await Promise.all([
    env.DB.prepare('SELECT grup, nilai, label, warna, urutan FROM opsi WHERE aktif = 1 ORDER BY grup, urutan').all(),
    env.DB.prepare('SELECT * FROM properti WHERE aktif = 1 ORDER BY urutan').all(),
    env.DB.prepare('SELECT id, nama, jabatan, bidang, peran, foto FROM tim WHERE aktif = 1 ORDER BY nama').all(),
    env.DB.prepare('SELECT * FROM periode ORDER BY mulai DESC LIMIT 12').all(),
    env.DB.prepare("SELECT kunci, nilai FROM pengaturan WHERE kunci NOT LIKE '%token%'").all(),
  ]);

  return json({
    pengguna,
    opsi: opsi.results,
    properti: properti.results,
    tim: tim.results,
    periode: periode.results,
    pengaturan: Object.fromEntries(
      (pengaturan.results as { kunci: string; nilai: string }[]).map((p) => [p.kunci, p.nilai]),
    ),
    hariIni: tanggalWita(),
  });
}

async function dasbor(env: Env): Promise<Response> {
  const hariIni = tanggalWita();
  const ringkas = await env.DB.prepare(
    `SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('Closed'))                          AS terbuka,
        COUNT(*) FILTER (WHERE status NOT IN ('Closed') AND due_date < ?1)        AS telat,
        COUNT(*) FILTER (WHERE status NOT IN ('Closed') AND due_date = ?1)        AS hari_ini,
        COUNT(*) FILTER (WHERE status = 'Closed')                                 AS selesai
       FROM pica WHERE dihapus = 0`,
  )
    .bind(hariIni)
    .first();

  const { results: perPic } = await env.DB.prepare(
    `SELECT t.id, t.nama,
            COUNT(p.id) AS jumlah,
            SUM(CASE WHEN p.due_date < ?1 THEN 1 ELSE 0 END) AS telat
       FROM tim t LEFT JOIN pica p
         ON p.pic_id = t.id AND p.dihapus = 0 AND p.status <> 'Closed'
      WHERE t.aktif = 1
      GROUP BY t.id ORDER BY jumlah DESC`,
  )
    .bind(hariIni)
    .all();

  return json({ ringkas, perPic, hariIni });
}

// ============================================================
// PICA
// ============================================================

async function daftarPica(url: URL, env: Env): Promise<Response> {
  const syarat: string[] = ['p.dihapus = 0'];
  const nilai: unknown[] = [];

  const tambah = (kolom: string, param: string | null) => {
    if (param) {
      nilai.push(param);
      syarat.push(`${kolom} = ?${nilai.length}`);
    }
  };

  tambah('p.status', url.searchParams.get('status'));
  tambah('p.bidang', url.searchParams.get('bidang'));
  tambah('p.pic_id', url.searchParams.get('pic'));
  tambah('p.periode_id', url.searchParams.get('periode'));

  const cari = url.searchParams.get('q');
  if (cari) {
    nilai.push(`%${cari}%`);
    syarat.push(`(p.judul LIKE ?${nilai.length} OR p.akar LIKE ?${nilai.length} OR p.id LIKE ?${nilai.length})`);
  }

  const { results } = await env.DB.prepare(
    `SELECT p.*, t.nama AS pic_nama,
            (SELECT u.catatan FROM pica_update u WHERE u.pica_id = p.id ORDER BY u.pada DESC LIMIT 1) AS update_terakhir,
            (SELECT u.pada FROM pica_update u WHERE u.pica_id = p.id ORDER BY u.pada DESC LIMIT 1) AS update_terakhir_pada,
            (SELECT COUNT(*) FROM lampiran l WHERE (l.entitas = 'pica' AND l.entitas_id = p.id) OR (l.entitas = 'laporan' AND l.entitas_id IN (SELECT id FROM laporan WHERE pica_id = p.id))) AS jumlah_lampiran
       FROM pica p LEFT JOIN tim t ON t.id = p.pic_id
      WHERE ${syarat.join(' AND ')}
      ORDER BY (p.status = 'Closed'), p.due_date IS NULL, p.due_date, p.nomor`,
  )
    .bind(...nilai)
    .all();

  const hariIni = tanggalWita();
  const daftar = (results as Record<string, unknown>[]).map((r) => ({
    ...r,
    props: JSON.parse((r.props as string) || '{}'),
    sisa_hari: r.due_date ? selisihHari(r.due_date as string, hariIni) : null,
  }));

  return json({ pica: daftar, hariIni });
}

async function detailPica(id: string, env: Env): Promise<Response> {
  const pica = await env.DB.prepare(
    `SELECT p.*, t.nama AS pic_nama FROM pica p LEFT JOIN tim t ON t.id = p.pic_id WHERE p.id = ?1`,
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!pica) return galat('PICA tidak ditemukan.', 404);

  const [riwayat, updates, lampiran] = await Promise.all([
    env.DB.prepare(
      `SELECT r.*, t.nama AS oleh_nama FROM pica_riwayat r LEFT JOIN tim t ON t.id = r.oleh
        WHERE r.pica_id = ?1 ORDER BY r.pada DESC`,
    ).bind(id).all(),
    env.DB.prepare(
      `SELECT u.*, t.nama AS oleh_nama FROM pica_update u LEFT JOIN tim t ON t.id = u.oleh
        WHERE u.pica_id = ?1 ORDER BY u.pada DESC`,
    ).bind(id).all(),
    // Foto dari laporan lapangan ikut dihitung sebagai bukti PICA ini — sebelumnya
    // foto terunggah tetapi tidak pernah terlihat di mana pun.
    env.DB.prepare(
      `SELECT * FROM lampiran
        WHERE (entitas = 'pica' AND entitas_id = ?1)
           OR (entitas = 'laporan' AND entitas_id IN (SELECT id FROM laporan WHERE pica_id = ?1))
        ORDER BY pada DESC`,
    ).bind(id).all(),
  ]);

  return json({
    pica: { ...pica, props: JSON.parse((pica.props as string) || '{}') },
    riwayat: riwayat.results,
    updates: updates.results,
    lampiran: lampiran.results,
  });
}

async function buatPica(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (pengguna.peran === 'pemantau') return galat('Peran Anda hanya bisa memantau.', 403);

  const b = (await req.json()) as Record<string, any>;
  if (!b.judul || !b.bidang) return galat('Bidang dan uraian masalah wajib diisi.');

  const periodeId = b.periode_id || (await ambilPengaturan(env, 'periode_aktif')) || null;

  const urut = await env.DB.prepare(
    'SELECT COALESCE(MAX(nomor), 0) + 1 AS n FROM pica WHERE periode_id = ?1',
  )
    .bind(periodeId)
    .first<{ n: number }>();

  const nomor = urut?.n ?? 1;
  const id = `PICA-${periodeId ?? 'UMUM'}-${String(nomor).padStart(2, '0')}`;

  await env.DB.prepare(
    `INSERT INTO pica (id, nomor, periode_id, bidang, prioritas, judul, akar, tindakan,
                       pic_id, due_date, status, terkait_id, target, realisasi, satuan,
                       props, dibuat_oleh, dibuat_pada, judul_singkat)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)`,
  )
    .bind(
      id, nomor, periodeId, b.bidang, b.prioritas ?? 'Sedang', b.judul,
      b.akar ?? null, b.tindakan ?? null, b.pic_id ?? null, b.due_date ?? null,
      b.status ?? 'Open', b.terkait_id ?? null,
      b.target ?? null, b.realisasi ?? null, b.satuan ?? null,
      JSON.stringify(b.props ?? {}), pengguna.id, sekarangUtcIso(),
      String(b.judul_singkat ?? '').trim().slice(0, 80) || null,
    )
    .run();

  await env.DB.prepare(
    `INSERT INTO pica_riwayat (pica_id, kolom, nilai_lama, nilai_baru, oleh)
     VALUES (?1, 'dibuat', NULL, ?2, ?3)`,
  )
    .bind(id, b.judul, pengguna.id)
    .run();

  return json({ id, nomor }, 201);
}

async function imporPicaBatch(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  // Menambah PICA massal hanya boleh oleh Admin/Supervisor, dan dibatasi agar satu
  // berkas keliru tidak membanjiri papan PICA.
  if (!bolehUbahKunci(pengguna)) return galat('Hanya Admin/Supervisor yang boleh mengimpor PICA.', 403);

  const b = (await req.json()) as { periode_id?: string; items?: Record<string, any>[] };
  if (!b.items || !Array.isArray(b.items) || b.items.length === 0) {
    return galat('Daftar PICA untuk diimpor tidak boleh kosong.');
  }
  if (b.items.length > 200) return galat('Maksimal 200 baris sekali impor.');

  const periodeId = b.periode_id || (await ambilPengaturan(env, 'periode_aktif')) || null;

  // Ambil nomor urut tertinggi saat ini untuk periode target
  const urut = await env.DB.prepare(
    'SELECT COALESCE(MAX(nomor), 0) AS n FROM pica WHERE periode_id = ?1',
  )
    .bind(periodeId)
    .first<{ n: number }>();

  let nomorSekarang = urut?.n ?? 0;
  const dibuatPada = sekarangUtcIso();
  const pernyataan: any[] = [];
  const ids: string[] = [];

  for (const item of b.items) {
    const judul = String(item.judul ?? '').trim();
    const bidang = String(item.bidang ?? '').trim();
    if (!judul || !bidang) continue;

    nomorSekarang += 1;
    const id = `PICA-${periodeId ?? 'UMUM'}-${String(nomorSekarang).padStart(2, '0')}`;
    ids.push(id);

    pernyataan.push(
      env.DB.prepare(
        `INSERT INTO pica (id, nomor, periode_id, bidang, prioritas, judul, akar, tindakan,
                           pic_id, due_date, status, terkait_id, target, realisasi, satuan,
                           props, dibuat_oleh, dibuat_pada, judul_singkat)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19)`,
      ).bind(
        id,
        nomorSekarang,
        periodeId,
        bidang,
        item.prioritas ?? 'Sedang',
        judul,
        item.akar ? String(item.akar).trim() : null,
        item.tindakan ? String(item.tindakan).trim() : null,
        item.pic_id ? String(item.pic_id).trim() : null,
        item.due_date ? String(item.due_date).trim() : null,
        item.status ?? 'Open',
        item.terkait_id ? String(item.terkait_id).trim() : null,
        item.target !== undefined && item.target !== null && item.target !== '' ? Number(item.target) : null,
        item.realisasi !== undefined && item.realisasi !== null && item.realisasi !== '' ? Number(item.realisasi) : null,
        item.satuan ? String(item.satuan).trim() : null,
        JSON.stringify(item.props ?? {}),
        pengguna.id,
        dibuatPada,
        String(item.judul_singkat ?? '').trim().slice(0, 80) || null,
      ),
    );

    pernyataan.push(
      env.DB.prepare(
        `INSERT INTO pica_riwayat (pica_id, kolom, nilai_lama, nilai_baru, oleh)
         VALUES (?1, 'dibuat', NULL, ?2, ?3)`,
      ).bind(id, `Diimpor via CSV: ${judul}`, pengguna.id),
    );
  }

  if (pernyataan.length === 0) {
    return galat('Tidak ada data PICA yang valid untuk disimpan.');
  }

  // Cloudflare D1 batch chunking
  const UKURAN_CHUNK = 50;
  for (let i = 0; i < pernyataan.length; i += UKURAN_CHUNK) {
    await env.DB.batch(pernyataan.slice(i, i + UKURAN_CHUNK));
  }

  return json({ ok: true, jumlah: ids.length, ids }, 201);
}

const KOLOM_BOLEH_UBAH = [
  'bidang', 'prioritas', 'judul', 'judul_singkat', 'akar', 'tindakan', 'pic_id', 'due_date',
  'status', 'terkait_id', 'target', 'realisasi', 'satuan', 'props',
] as const;

/** Kolom yang dibekukan setelah periode dikunci di rapat mingguan. */
const KOLOM_TERKUNCI = ['pic_id', 'due_date'];

async function ubahPica(id: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  const b = (await req.json()) as Record<string, any>;
  const alasan: string | null = b.alasan ?? null;

  const lama = await env.DB.prepare(
    `SELECT p.*, per.terkunci AS periode_terkunci
       FROM pica p LEFT JOIN periode per ON per.id = p.periode_id
      WHERE p.id = ?1 AND p.dihapus = 0`,
  )
    .bind(id)
    .first<Record<string, any>>();
  if (!lama) return galat('PICA tidak ditemukan.', 404);

  const terkunci = lama.terkunci === 1 || lama.periode_terkunci === 1;
  const perubahan: { kolom: string; dari: unknown; ke: unknown }[] = [];

  for (const kolom of KOLOM_BOLEH_UBAH) {
    if (!(kolom in b)) continue;
    const nilaiBaru = kolom === 'props' ? JSON.stringify(b.props) : b[kolom];
    if (String(nilaiBaru ?? '') === String(lama[kolom] ?? '')) continue;

    if (terkunci && KOLOM_TERKUNCI.includes(kolom)) {
      if (!bolehUbahKunci(pengguna)) {
        return galat(
          `${kolom === 'pic_id' ? 'PIC' : 'Due date'} sudah dikunci di rapat mingguan. Minta Admin atau Supervisor untuk mengubahnya.`,
          409,
        );
      }
      if (!alasan) return galat('Kolom terkunci — isi alasan perubahan terlebih dulu.', 409);
    }
    perubahan.push({ kolom, dari: lama[kolom], ke: nilaiBaru });
  }

  if (perubahan.length === 0) return json({ ok: true, perubahan: 0 });

  // Menutup PICA wajib meninggalkan bukti.
  const jadiTutup = perubahan.find((p) => p.kolom === 'status' && p.ke === 'Closed');
  if (jadiTutup) {
    const bukti = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM lampiran WHERE entitas = ?1 AND entitas_id = ?2',
    )
      .bind('pica', id)
      .first<{ n: number }>();
    if ((bukti?.n ?? 0) === 0) {
      return galat('Unggah bukti (foto/PDF) dulu sebelum menutup PICA ini.', 409);
    }
    if (!bolehUbahKunci(pengguna)) {
      return galat('Penutupan harus diverifikasi Supervisor atau Admin. Ubah status ke "Verifikasi".', 409);
    }
  }

  const set = perubahan.map((p, i) => `${p.kolom} = ?${i + 2}`).join(', ');
  await env.DB.prepare(
    `UPDATE pica SET ${set}, diubah_oleh = ?${perubahan.length + 2},
            diubah_pada = ?${perubahan.length + 3},
            ditutup_pada = CASE WHEN ?${perubahan.length + 4} = 1 THEN ?${perubahan.length + 3} ELSE ditutup_pada END,
            ditutup_oleh = CASE WHEN ?${perubahan.length + 4} = 1 THEN ?${perubahan.length + 2} ELSE ditutup_oleh END
      WHERE id = ?1`,
  )
    .bind(id, ...perubahan.map((p) => p.ke), pengguna.id, sekarangUtcIso(), jadiTutup ? 1 : 0)
    .run();

  const batch = perubahan.map((p) =>
    env.DB.prepare(
      `INSERT INTO pica_riwayat (pica_id, kolom, nilai_lama, nilai_baru, alasan, oleh)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    ).bind(id, p.kolom, String(p.dari ?? ''), String(p.ke ?? ''), alasan, pengguna.id),
  );
  await env.DB.batch(batch);

  return json({ ok: true, perubahan: perubahan.length });
}

async function hapusPica(id: string, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh menghapus PICA.', 403);
  await env.DB.prepare('UPDATE pica SET dihapus = 1, diubah_oleh = ?2, diubah_pada = ?3 WHERE id = ?1')
    .bind(id, pengguna.id, sekarangUtcIso())
    .run();
  await env.DB.prepare(
    `INSERT INTO pica_riwayat (pica_id, kolom, nilai_lama, nilai_baru, oleh) VALUES (?1,'dihapus','0','1',?2)`,
  )
    .bind(id, pengguna.id)
    .run();
  return json({ ok: true });
}

async function tambahUpdate(id: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  const b = (await req.json()) as { catatan?: string; realisasi?: number };
  if (!b.catatan) return galat('Catatan perkembangan tidak boleh kosong.');

  const periode = await ambilPengaturan(env, 'periode_aktif');
  await env.DB.prepare(
    `INSERT INTO pica_update (pica_id, periode_id, catatan, realisasi, oleh) VALUES (?1,?2,?3,?4,?5)`,
  )
    .bind(id, periode || null, b.catatan, b.realisasi ?? null, pengguna.id)
    .run();

  if (typeof b.realisasi === 'number') {
    await env.DB.prepare('UPDATE pica SET realisasi = ?2, diubah_pada = ?3 WHERE id = ?1')
      .bind(id, b.realisasi, sekarangUtcIso())
      .run();
  }
  return json({ ok: true }, 201);
}

async function kunciPeriode(id: string, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh mengunci periode.', 403);

  await env.DB.prepare(
    'UPDATE periode SET terkunci = 1, dikunci_oleh = ?2, dikunci_pada = ?3 WHERE id = ?1',
  )
    .bind(id, pengguna.id, sekarangUtcIso())
    .run();
  await env.DB.prepare('UPDATE pica SET terkunci = 1 WHERE periode_id = ?1 AND dihapus = 0')
    .bind(id)
    .run();

  return json({ ok: true, pesan: `Periode ${id} dikunci. PIC dan due date kini butuh alasan untuk diubah.` });
}

// ============================================================
// Kolom & pilihan dinamis
// ============================================================

async function tambahProperti(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!bolehUbahKunci(pengguna)) return galat('Hanya Admin/Supervisor yang boleh menambah kolom.', 403);
  const b = (await req.json()) as { id?: string; label?: string; tipe?: string; opsi?: string[] };
  if (!b.id || !b.label || !b.tipe) return galat('id, label, dan tipe wajib diisi.');
  if (!/^[a-z0-9_]+$/.test(b.id)) return galat('id kolom hanya boleh huruf kecil, angka, dan garis bawah.');

  await env.DB.prepare(
    `INSERT INTO properti (id, label, tipe, opsi_json, urutan)
     VALUES (?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(urutan),0)+1 FROM properti))`,
  )
    .bind(b.id, b.label, b.tipe, b.opsi ? JSON.stringify(b.opsi) : null)
    .run();

  return json({ ok: true }, 201);
}

async function tambahOpsi(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!bolehUbahKunci(pengguna)) return galat('Hanya Admin/Supervisor yang boleh menambah pilihan.', 403);
  const b = (await req.json()) as { grup?: string; nilai?: string; label?: string; warna?: string };
  if (!b.grup || !b.nilai) return galat('grup dan nilai wajib diisi.');

  await env.DB.prepare(
    `INSERT OR REPLACE INTO opsi (grup, nilai, label, warna, urutan)
     VALUES (?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(urutan),0)+1 FROM opsi WHERE grup = ?1))`,
  )
    .bind(b.grup, b.nilai, b.label ?? b.nilai, b.warna ?? 'zinc')
    .run();

  return json({ ok: true }, 201);
}

// ============================================================
// Pengumuman
// ============================================================

async function daftarPengumuman(env: Env, pengguna: Pengguna): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT p.*, t.nama AS oleh_nama,
            (SELECT COUNT(*) FROM pengumuman_baca b WHERE b.pengumuman_id = p.id) AS jumlah_baca,
            EXISTS(SELECT 1 FROM pengumuman_baca b WHERE b.pengumuman_id = p.id AND b.user_id = ?1) AS sudah_baca
       FROM pengumuman p LEFT JOIN tim t ON t.id = p.oleh
      ORDER BY p.dibuat_pada DESC LIMIT 50`,
  )
    .bind(pengguna.id)
    .all();
  return json({ pengumuman: results });
}

async function buatPengumuman(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!bolehUbahKunci(pengguna)) return galat('Hanya Admin/Supervisor yang boleh membuat pengumuman.', 403);
  const b = (await req.json()) as { judul?: string; isi?: string; penting?: boolean; kirim_wa?: boolean };
  if (!b.judul || !b.isi) return galat('Judul dan isi wajib diisi.');

  const id = idBaru('peng');
  await env.DB.prepare(
    `INSERT INTO pengumuman (id, judul, isi, penting, kirim_wa, oleh) VALUES (?1,?2,?3,?4,?5,?6)`,
  )
    .bind(id, b.judul, b.isi, b.penting ? 1 : 0, b.kirim_wa === false ? 0 : 1, pengguna.id)
    .run();

  if (b.kirim_wa !== false) {
    const grup = await ambilPengaturan(env, 'wa_grup_id');
    // Hanya diantre saat WA aktif: pengumuman yang tertahan selama saklar mati
    // akan terkirim beruntun begitu saklarnya dinyalakan.
    if (grup && (await ambilPengaturan(env, 'wa_aktif')) === '1') {
      await antre(env, {
        tujuan: grup,
        isi: `*${b.penting ? '⚠ PENTING · ' : ''}${b.judul}*\n\n${b.isi}\n\n— ${pengguna.nama}`,
        jenis: 'pengumuman',
        ref_id: id,
      });
    }
  }

  return json({ id }, 201);
}

// ============================================================
// Jadwal
// ============================================================

async function daftarJadwal(url: URL, env: Env): Promise<Response> {
  const dari = url.searchParams.get('dari') ?? geserHari(tanggalWita(), -7);
  const sampai = url.searchParams.get('sampai') ?? geserHari(tanggalWita(), 60);

  const { results } = await env.DB.prepare(
    `SELECT j.*, t.nama AS pemilik_nama FROM jadwal j LEFT JOIN tim t ON t.id = j.pemilik_id
      WHERE j.tanggal <= ?2
        AND (j.rrule IS NOT NULL OR COALESCE(j.tanggal_selesai, j.tanggal) >= ?1)
      ORDER BY j.tanggal, j.jam_mulai`,
  )
    .bind(dari, sampai)
    .all();

  // Tenggat PICA ikut tampil di kalender tanpa perlu disalin jadi jadwal.
  const { results: tenggat } = await env.DB.prepare(
    `SELECT p.id, p.judul, p.due_date, p.status, t.nama AS pic_nama
       FROM pica p LEFT JOIN tim t ON t.id = p.pic_id
      WHERE p.dihapus = 0 AND p.status <> 'Closed' AND p.due_date BETWEEN ?1 AND ?2`,
  )
    .bind(dari, sampai)
    .all();

  const { results: libur } = await env.DB.prepare(
    'SELECT id, tanggal, nama, jenis, perkiraan FROM libur WHERE tanggal BETWEEN ?1 AND ?2 ORDER BY tanggal',
  )
    .bind(dari, sampai)
    .all();

  return json({ jadwal: results, tenggat, libur, hariIni: tanggalWita() });
}

async function buatJadwal(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  const b = (await req.json()) as Record<string, any>;
  if (!b.judul || !b.tanggal) return galat('Judul dan tanggal wajib diisi.');

  const id = idBaru('jdw');
  const selesaiTgl = normalSelesai(b.tanggal, b.tanggal_selesai);
  if (selesaiTgl === false) return galat('Tanggal selesai tidak boleh sebelum tanggal mulai.');

  await env.DB.prepare(
    `INSERT INTO jadwal (id, judul, keterangan, tanggal, tanggal_selesai, jam_mulai, jam_selesai, jenis, pica_id, pemilik_id, rrule, ingatkan_menit)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`,
  )
    .bind(
      id, b.judul, b.keterangan ?? null, b.tanggal, selesaiTgl, b.jam_mulai ?? null, b.jam_selesai ?? null,
      b.jenis ?? 'rencana', b.pica_id ?? null,
      b.untuk_semua ? null : (b.pemilik_id ?? pengguna.id), b.rrule ?? null,
      b.ingatkan_menit ? Number(b.ingatkan_menit) : null,
    )
    .run();

  return json({ id }, 201);
}

/** NULL bila satu hari, false bila tidak sah, selain itu tanggal selesai. */
function normalSelesai(mulai: string, selesai?: string | null): string | null | false {
  if (!selesai || selesai === mulai) return null;
  return selesai < mulai ? false : selesai;
}

async function ubahJadwal(id: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  const lama = await env.DB.prepare('SELECT * FROM jadwal WHERE id = ?1').bind(id).first<Record<string, any>>();
  if (!lama) return galat('Jadwal tidak ditemukan.', 404);

  const b = (await req.json()) as Record<string, any>;
  const hanyaCentang = Object.keys(b).every((k) => k === 'selesai');
  const pemilik = lama.pemilik_id === pengguna.id;
  if (!hanyaCentang && !pemilik && !bolehUbahKunci(pengguna)) {
    return galat('Hanya pemilik jadwal, Supervisor, atau Admin yang boleh mengubahnya.', 403);
  }

  const tanggal = b.tanggal ?? lama.tanggal;
  if ('tanggal_selesai' in b || 'tanggal' in b) {
    const s = normalSelesai(tanggal, 'tanggal_selesai' in b ? b.tanggal_selesai : lama.tanggal_selesai);
    if (s === false) return galat('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    b.tanggal_selesai = s;
  }
  if ('selesai' in b) b.selesai = b.selesai ? 1 : 0;
  if ('untuk_semua' in b) { b.pemilik_id = b.untuk_semua ? null : (lama.pemilik_id ?? pengguna.id); delete b.untuk_semua; }

  const kolom = ['judul', 'keterangan', 'tanggal', 'tanggal_selesai', 'jam_mulai', 'jam_selesai', 'jenis', 'pemilik_id', 'rrule', 'selesai', 'ingatkan_menit']
    .filter((k) => k in b);
  if (kolom.length === 0) return json({ ok: true });

  const set = kolom.map((k, i) => `${k} = ?${i + 2}`).join(', ');
  await env.DB.prepare(`UPDATE jadwal SET ${set} WHERE id = ?1`).bind(id, ...kolom.map((k) => b[k] ?? null)).run();
  return json({ ok: true });
}

// ============================================================
// Laporan lapangan
// ============================================================

async function daftarLaporan(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT l.*, t.nama AS user_nama,
            (SELECT kunci_r2 FROM lampiran m
              WHERE m.entitas = 'laporan' AND m.entitas_id = l.id ORDER BY m.pada LIMIT 1) AS foto
       FROM laporan l LEFT JOIN tim t ON t.id = l.user_id
      ORDER BY l.dibuat_pada DESC LIMIT 100`,
  ).all();
  return json({ laporan: results });
}

async function buatLaporan(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  const b = (await req.json()) as Record<string, any>;
  const capaian = Number(b.capaian ?? 0);
  const xp = 500 + Math.floor(capaian * 10);
  const id = idBaru('lap');

  await env.DB.prepare(
    `INSERT INTO laporan (id, user_id, pica_id, jenis, capaian, satuan, catatan, lat, lon, xp)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`,
  )
    .bind(id, pengguna.id, b.pica_id ?? null, b.jenis ?? 'Pekerjaan Rutin', capaian,
          b.satuan ?? 'ha', b.catatan ?? '', b.lat ?? null, b.lon ?? null, xp)
    .run();

  // Capaian dijumlah di server: dua orang melapor bersamaan tidak saling menimpa.
  // Perubahan angka selalu meninggalkan jejak — tanpa ini realisasi PICA bisa
  // berubah tanpa keterangan siapa, dan rekap 16.00 tidak melihatnya bergerak.
  if (b.pica_id && capaian > 0) {
    const sebelum = await env.DB.prepare('SELECT realisasi, periode_id, satuan FROM pica WHERE id = ?1')
      .bind(b.pica_id)
      .first<{ realisasi: number | null; periode_id: string | null; satuan: string | null }>();

    if (sebelum) {
      const lama = Number(sebelum.realisasi ?? 0);
      const baru = Math.round((lama + capaian) * 1000) / 1000;
      const satuan = b.satuan ?? sebelum.satuan ?? '';
      const catatan = [
        `${b.jenis ?? 'Laporan lapangan'}: +${capaian} ${satuan}`.trim(),
        String(b.catatan ?? '').trim(),
      ].filter(Boolean).join(' — ');

      await env.DB.batch([
        env.DB.prepare('UPDATE pica SET realisasi = ?2, diubah_pada = ?3 WHERE id = ?1')
          .bind(b.pica_id, baru, sekarangUtcIso()),
        env.DB.prepare(
          `INSERT INTO pica_update (pica_id, periode_id, catatan, realisasi, oleh)
           VALUES (?1, ?2, ?3, ?4, ?5)`,
        ).bind(b.pica_id, sebelum.periode_id, catatan, baru, pengguna.id),
        env.DB.prepare(
          `INSERT INTO pica_riwayat (pica_id, kolom, nilai_lama, nilai_baru, alasan, oleh)
           VALUES (?1, 'realisasi', ?2, ?3, 'laporan lapangan', ?4)`,
        ).bind(b.pica_id, String(lama), String(baru), pengguna.id),
      ]);
    }
  }

  return json({ id, xp }, 201);
}

// ============================================================
// Lampiran (R2)
// ============================================================

async function unggahLampiran(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  const form = await req.formData();
  const berkas = form.get('berkas');
  const entitas = String(form.get('entitas') ?? 'pica');
  const entitasId = String(form.get('entitas_id') ?? '');

  if (!(berkas instanceof File)) return galat('Berkas tidak ditemukan.');
  if (!entitasId) return galat('entitas_id wajib diisi.');
  if (berkas.size > 8 * 1024 * 1024) return galat('Ukuran berkas maksimal 8 MB.');

  const ekstensi = (berkas.name.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5);
  const kunci = `${entitas}/${entitasId}/${Date.now()}.${ekstensi}`;

  await env.BUKET.put(kunci, berkas.stream(), {
    httpMetadata: { contentType: berkas.type || 'application/octet-stream' },
  });

  const id = idBaru('lmp');
  await env.DB.prepare(
    `INSERT INTO lampiran (id, entitas, entitas_id, kunci_r2, nama, tipe_mime, ukuran, oleh)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8)`,
  )
    .bind(id, entitas, entitasId, kunci, berkas.name, berkas.type, berkas.size, pengguna.id)
    .run();

  return json({ id, kunci, url: `/api/berkas/${encodeURIComponent(kunci)}` }, 201);
}

async function ambilBerkas(kunci: string, env: Env): Promise<Response> {
  const objek = await env.BUKET.get(kunci);
  if (!objek) return galat('Berkas tidak ditemukan.', 404);

  const headers = new Headers(CORS);
  objek.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=86400');
  return new Response(objek.body, { headers });
}

// ============================================================
// Tautan berbagi (baca-saja, tanpa login)
// ============================================================

async function buatTautanBagi(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!bolehUbahKunci(pengguna)) return galat('Hanya Admin/Supervisor yang boleh membagikan tautan.', 403);
  const b = (await req.json().catch(() => ({}))) as { label?: string; hari?: number };

  const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  const hari = Number(b.hari ?? 90);
  const kedaluwarsa = hari > 0 ? new Date(Date.now() + hari * 86_400_000).toISOString() : null;

  await env.DB.prepare(
    `INSERT INTO tautan_bagi (token, cakupan, label, dibuat_oleh, kedaluwarsa) VALUES (?1,'kalender',?2,?3,?4)`,
  )
    .bind(token, b.label ?? `Kalender · ${pengguna.nama}`, pengguna.id, kedaluwarsa)
    .run();

  return json({ token, jalur: `/bagi/${token}`, kedaluwarsa }, 201);
}

async function daftarTautanBagi(env: Env, pengguna: Pengguna): Promise<Response> {
  if (!bolehUbahKunci(pengguna)) return galat('Hanya Admin/Supervisor.', 403);
  const { results } = await env.DB.prepare(
    `SELECT b.*, t.nama AS oleh_nama FROM tautan_bagi b LEFT JOIN tim t ON t.id = b.dibuat_oleh
      WHERE b.aktif = 1 ORDER BY b.dibuat_pada DESC`,
  ).all();
  return json({ tautan: results });
}

async function kalenderBagi(token: string, url: URL, env: Env): Promise<Response> {
  const tautan = await env.DB.prepare(
    'SELECT token, kedaluwarsa FROM tautan_bagi WHERE token = ?1 AND aktif = 1 AND cakupan = ?2',
  )
    .bind(token, 'kalender')
    .first<{ token: string; kedaluwarsa: string | null }>();

  if (!tautan) return galat('Tautan tidak berlaku atau sudah dimatikan.', 404);
  if (tautan.kedaluwarsa && Date.parse(tautan.kedaluwarsa) < Date.now()) {
    return galat('Tautan sudah kedaluwarsa.', 410);
  }

  await env.DB.prepare('UPDATE tautan_bagi SET dibuka = dibuka + 1 WHERE token = ?1').bind(token).run();

  // Isi yang sama dengan kalender di aplikasi, tanpa id anggota.
  const dari = url.searchParams.get('dari') ?? geserHari(tanggalWita(), -7);
  const sampai = url.searchParams.get('sampai') ?? geserHari(tanggalWita(), 60);

  const [jadwal, tenggat, libur] = await Promise.all([
    env.DB.prepare(
      `SELECT j.id, j.judul, j.keterangan, j.tanggal, j.tanggal_selesai, j.jam_mulai, j.jam_selesai, j.jenis,
              j.pica_id, j.rrule, j.selesai, t.nama AS pemilik_nama,
              CASE WHEN j.pemilik_id IS NULL THEN NULL ELSE 'anggota' END AS pemilik_id
         FROM jadwal j LEFT JOIN tim t ON t.id = j.pemilik_id
        WHERE j.tanggal <= ?2
          AND (j.rrule IS NOT NULL OR COALESCE(j.tanggal_selesai, j.tanggal) >= ?1)
        ORDER BY j.tanggal, j.jam_mulai`,
    ).bind(dari, sampai).all(),
    env.DB.prepare(
      'SELECT id, tanggal, nama, jenis, perkiraan FROM libur WHERE tanggal BETWEEN ?1 AND ?2 ORDER BY tanggal',
    ).bind(dari, sampai).all(),
    env.DB.prepare(
      `SELECT p.id, p.judul, p.due_date, p.status, t.nama AS pic_nama
         FROM pica p LEFT JOIN tim t ON t.id = p.pic_id
        WHERE p.dihapus = 0 AND p.status <> 'Closed' AND p.due_date BETWEEN ?1 AND ?2`,
    ).bind(dari, sampai).all(),
  ]);

  return json({
    jadwal: jadwal.results,
    tenggat: tenggat.results,
    libur: libur.results,
    hariIni: tanggalWita(),
    bacaSaja: true,
  });
}

// ============================================================
// Tim & pengaturan
// ============================================================

async function tambahTim(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh menambah anggota.', 403);
  const b = (await req.json()) as Record<string, string>;
  const id = String(b.id ?? '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!id || !b.nama) return galat('User ID (huruf kecil) dan nama wajib diisi.');

  let wa = String(b.wa ?? '').replace(/[^0-9]/g, '');
  if (wa.startsWith('0')) wa = '62' + wa.slice(1);

  const ada = await env.DB.prepare('SELECT 1 FROM tim WHERE id = ?1').bind(id).first();
  if (ada) return galat(`User ID "${id}" sudah dipakai.`, 409);

  await env.DB.prepare(
    `INSERT INTO tim (id, nama, jabatan, bidang, wa, peran) VALUES (?1,?2,?3,?4,?5,?6)`,
  )
    .bind(id, b.nama, b.jabatan ?? null, b.bidang ?? null, wa || null, b.peran ?? 'anggota')
    .run();
  await env.DB.prepare('INSERT OR IGNORE INTO profil_game (user_id) VALUES (?1)').bind(id).run();

  return json({ id, pesan: `Anggota ${b.nama} dibuat. Bagikan kode undangan agar ia bisa membuat password.` }, 201);
}

async function daftarTim(env: Env): Promise<Response> {
  const hariIni = tanggalWita();
  const { results } = await env.DB.prepare(
    `SELECT t.id, t.nama, t.jabatan, t.bidang, t.peran, t.aktif, t.foto,
            CASE WHEN t.wa IS NULL OR t.wa = '' THEN 0 ELSE 1 END AS punya_wa,
            (SELECT COUNT(*) FROM pica p WHERE p.pic_id = t.id AND p.dihapus = 0 AND p.status <> 'Closed') AS pica_terbuka,
            (SELECT COUNT(*) FROM pica p WHERE p.pic_id = t.id AND p.dihapus = 0 AND p.status <> 'Closed' AND p.due_date < ?1) AS pica_telat,
            (SELECT COALESCE(SUM(xp),0) FROM laporan l WHERE l.user_id = t.id) AS xp
       FROM tim t WHERE t.aktif = 1 ORDER BY pica_telat DESC, pica_terbuka DESC`,
  )
    .bind(hariIni)
    .all();
  return json({ tim: results });
}

async function ubahTim(id: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  const b = (await req.json()) as Record<string, any>;
  const sendiri = pengguna.id === id;
  if (!adalahAdmin(pengguna) && !sendiri) return galat('Tidak berhak mengubah data anggota lain.', 403);

  // Nomor WA dinormalkan ke format 62xxxxxxxx.
  if ('wa' in b && b.wa) {
    let wa = String(b.wa).replace(/[^0-9]/g, '');
    if (wa.startsWith('0')) wa = '62' + wa.slice(1);
    if (!wa.startsWith('62')) wa = '62' + wa;
    b.wa = wa;
  }

  const bolehSendiri = ['wa', 'jabatan'];
  const bolehAdmin = ['wa', 'jabatan', 'bidang', 'peran', 'nama', 'aktif'];
  const daftar = adalahAdmin(pengguna) ? bolehAdmin : bolehSendiri;

  const kolom = daftar.filter((k) => k in b);
  if (kolom.length === 0) return galat('Tidak ada yang diubah.');

  const set = kolom.map((k, i) => `${k} = ?${i + 2}`).join(', ');
  await env.DB.prepare(`UPDATE tim SET ${set} WHERE id = ?1`)
    .bind(id, ...kolom.map((k) => b[k]))
    .run();

  return json({ ok: true });
}

async function daftarPengaturan(env: Env, pengguna: Pengguna): Promise<Response> {
  if (!adalahAdmin(pengguna)) return galat('Hanya Admin.', 403);
  const { results } = await env.DB.prepare('SELECT * FROM pengaturan ORDER BY kunci').all();
  return json({ pengaturan: results, fonnte_terpasang: Boolean(env.FONNTE_TOKEN) });
}

async function simpanPengaturan(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!adalahAdmin(pengguna)) return galat('Hanya Admin.', 403);
  const b = (await req.json()) as Record<string, string>;

  const batch = Object.entries(b).map(([kunci, nilai]) =>
    env.DB.prepare('UPDATE pengaturan SET nilai = ?2 WHERE kunci = ?1').bind(kunci, String(nilai)),
  );
  if (batch.length) await env.DB.batch(batch);

  return json({ ok: true });
}

async function ujiWa(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!adalahAdmin(pengguna)) return galat('Hanya Admin.', 403);
  const b = (await req.json()) as { tujuan?: string };
  const tujuan = b.tujuan || (await ambilPengaturan(env, 'wa_grup_id'));
  if (!tujuan) return galat('Isi ID grup WhatsApp di Pengaturan terlebih dulu.');

  // Uji coba dikirim langsung (tidak menunggu antrean) agar hasilnya bisa
  // ditampilkan di layar saat itu juga.
  const hasil = await kirimLangsung(
    env,
    tujuan,
    `*Uji coba POKEMONKEY*\n\nBila pesan ini sampai, jalur WhatsApp sudah siap.\nDikirim oleh ${pengguna.nama} pada ${jamWita()} WITA.`,
  );
  if (!hasil.ok) return galat(`Fonnte menolak: ${hasil.galat}`, 502);
  return json({ ok: true, fonnte_id: hasil.id });
}

// ============================================================
// Webhook Fonnte — balasan yang mengubah data
// ============================================================

async function webhookWa(req: Request, env: Env): Promise<Response> {
  const form = await req.formData().catch(() => null);
  const ambil = (k: string) => String(form?.get(k) ?? '');

  const pengirim = ambil('sender').replace(/[^0-9]/g, '');
  const pesan = ambil('message').trim();
  if (!pengirim || !pesan) return json({ ok: true });

  const anggota = await env.DB.prepare('SELECT id, nama, peran FROM tim WHERE wa = ?1 AND aktif = 1')
    .bind(pengirim)
    .first<{ id: string; nama: string; peran: string }>();
  if (!anggota) return json({ ok: true, abai: 'nomor tidak dikenal' });

  const [perintahMentah, ...sisa] = pesan.split(/\s+/);
  const perintah = perintahMentah.toUpperCase();
  const periode = await ambilPengaturan(env, 'periode_aktif');
  const targetId = sisa[0] ? `PICA-${periode}-${sisa[0].padStart(2, '0')}` : '';

  const balas = async (teks: string) => {
    await antre(env, { tujuan: pengirim, isi: teks, jenis: 'balasan' });
    return json({ ok: true });
  };

  if (perintah === 'LAPOR') {
    const { results } = await env.DB.prepare(
      `SELECT id, judul, due_date FROM pica
        WHERE pic_id = ?1 AND dihapus = 0 AND status <> 'Closed' ORDER BY due_date LIMIT 10`,
    )
      .bind(anggota.id)
      .all<{ id: string; judul: string; due_date: string }>();

    const hariIni = tanggalWita();
    return balas(
      pesanRekap(
        `Item milik ${anggota.nama}`,
        results.map((r) => ({
          id: r.id, judul: r.judul, due_date: r.due_date, nama: anggota.nama,
          sisa: r.due_date ? selisihHari(r.due_date, hariIni) : 0,
        })),
      ),
    );
  }

  if (perintah === 'SELESAI' && targetId) {
    await env.DB.prepare(
      `UPDATE pica SET status = 'Verifikasi', diubah_oleh = ?2, diubah_pada = ?3
        WHERE id = ?1 AND pic_id = ?2 AND dihapus = 0`,
    )
      .bind(targetId, anggota.id, sekarangUtcIso())
      .run();
    await env.DB.prepare(
      `INSERT INTO pica_riwayat (pica_id, kolom, nilai_lama, nilai_baru, alasan, oleh)
       VALUES (?1,'status',NULL,'Verifikasi','via WhatsApp',?2)`,
    )
      .bind(targetId, anggota.id)
      .run();
    return balas(
      `${targetId} ditandai selesai dan menunggu verifikasi.\n\nKirim foto bukti lewat aplikasi agar bisa ditutup Supervisor.`,
    );
  }

  if (perintah === 'TUNDA' && targetId) {
    const alasan = sisa.slice(2).join(' ') || 'tanpa alasan';
    await env.DB.prepare(
      `INSERT INTO pica_riwayat (pica_id, kolom, nilai_lama, nilai_baru, alasan, oleh)
       VALUES (?1,'permintaan_tunda',NULL,?2,?3,?4)`,
    )
      .bind(targetId, sisa[1] ?? '', alasan, anggota.id)
      .run();
    return balas(
      `Permintaan penundaan ${targetId} dicatat dan menunggu persetujuan Admin.\nTenggat lama tetap berlaku sampai disetujui.`,
    );
  }

  if (perintah === 'BANTU' && targetId) {
    const grup = await ambilPengaturan(env, 'wa_grup_id');
    if (grup) {
      await antre(env, {
        tujuan: grup,
        isi: `*Permintaan bantuan · ${targetId}*\n\n${anggota.nama} meminta dukungan untuk item ini.`,
        jenis: 'eskalasi',
      });
    }
    return balas(`Permintaan bantuan untuk ${targetId} diteruskan ke grup departemen.`);
  }

  return balas(
    'Perintah yang tersedia:\n• LAPOR — daftar item Anda\n• SELESAI <no>\n• TUNDA <no> <tgl> <alasan>\n• BANTU <no>',
  );
}

// ============================================================
// Cron: tangga pengingat + antrean
// ============================================================

/** Selisih hari yang memicu pesan, beserta jenisnya. */
const TANGGA: Record<number, 'pengingat' | 'eskalasi'> = {
  3: 'pengingat',
  1: 'pengingat',
  0: 'pengingat',
  [-1]: 'eskalasi',
  [-3]: 'eskalasi',
};

async function jalankanTerjadwal(env: Env): Promise<void> {
  const hariIni = tanggalWita();
  const jam = jamWita();
  const jamPengingat = (await ambilPengaturan(env, 'jam_pengingat')) || '07:00';
  const jamRekap = (await ambilPengaturan(env, 'jam_rekap_sore')) || '16:00';

  // Cron berjalan tiap 15 menit; blok di bawah hanya aktif pada slot yang tepat.
  const slot = (target: string) => {
    const [jt, mt] = target.split(':').map(Number);
    const [jn, mn] = jam.split(':').map(Number);
    const selisih = jn * 60 + mn - (jt * 60 + mt);
    return selisih >= 0 && selisih < 15;
  };

  const grup = await ambilPengaturan(env, 'wa_grup_id');

  // --- Pengingat WA pribadi per PIC ---
  // Bawaan mati: pengingat pribadi kini lewat notifikasi HP (07.00), sehingga
  // nomor pengirim hanya dipakai untuk satu rekap grup per hari kerja.
  if (slot(jamPengingat) && (await ambilPengaturan(env, 'wa_pengingat_pribadi')) === '1') {
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.judul, p.due_date, p.tindakan, t.nama, t.wa
         FROM pica p JOIN tim t ON t.id = p.pic_id
        WHERE p.dihapus = 0 AND p.status NOT IN ('Closed')
          AND p.due_date IS NOT NULL
          AND t.wa IS NOT NULL AND t.wa <> ''`,
    ).all<{ id: string; judul: string; due_date: string; tindakan: string | null; nama: string; wa: string }>();

    for (const p of results) {
      const sisa = selisihHari(p.due_date, hariIni);
      const jenis = TANGGA[sisa];
      if (!jenis) continue;

      await antre(env, {
        tujuan: p.wa,
        isi: pesanPengingat(p, hariIni),
        jenis,
        ref_id: p.id,
      });

      // H+3 dibuka ke grup departemen.
      if (sisa === -3 && grup) {
        await antre(env, {
          tujuan: grup,
          isi: `*Eskalasi · ${p.id}*\n\n${p.judul.slice(0, 200)}\n\nPIC: ${p.nama}\nLewat tenggat 3 hari.`,
          jenis: 'eskalasi',
          ref_id: p.id + '-grup',
        });
      }
    }

  }

  // --- Rekap progres PICA ke grup WhatsApp, 16.00 WITA ---
  // Senin–Kamis: rekap harian. Jumat: rekap mingguan. Sabtu, Minggu, dan tanggal
  // merah dilewati. ref_id per tanggal + indeks unik pesan_wa mencegah kiriman
  // ganda bila cron menyentuh slot yang sama dua kali.
  // Hanya diantre saat WA aktif: rekap yang menumpuk selama saklar mati akan
  // terkirim beruntun ke grup begitu saklarnya dinyalakan.
  const hari = new Date(hariIni + 'T00:00:00Z').getUTCDay();
  const waAktif = (await ambilPengaturan(env, 'wa_aktif')) === '1';
  if (grup && waAktif && slot(jamRekap) && hari >= 1 && hari <= 5 && !(await liburPada(env, hariIni))) {
    await antre(env, {
      tujuan: grup,
      isi: await siapkanRekapPica(env, hari === 5 ? 'mingguan' : 'harian', hariIni, await tautanLihatPica(env, hariIni)),
      jenis: 'rekap',
      ref_id: `rekap-pica-${hariIni}`,
    });
  }

  // --- Notifikasi HP lewat Web Push: 07.00 PICA · 12.00 Info · 17.00 XP ---
  // APK Android tidak lewat sini; Background Runner di HP menjadwalkan sendiri.
  const jadwalNotif = [
    ['pagi', 'jam_notif_pagi', '07:00'],
    ['siang', 'jam_notif_siang', '12:00'],
    ['sore', 'jam_notif_sore', '17:00'],
  ] as const;
  for (const [namaSlot, kunci, bawaan] of jadwalNotif) {
    if (slot((await ambilPengaturan(env, kunci)) || bawaan)) {
      await kirimPushTerjadwal(env, namaSlot, hariIni);
    }
  }

  // Pengingat acara kalender untuk pemakai Web Push. APK Android tidak lewat
  // sini: penjadwal di HP memasang alarmnya sendiri tepat pada jam acara.
  await kirimPushAcara(env, hariIni);

  // --- Titik api NASA FIRMS: sekali tiap jam (putaran cron pertama di jam itu) ---
  // Peringatan WA hanya untuk titik baru dan hanya sekali; lihat titik-api.ts.
  if (Number(jam.split(':')[1]) < 15 && (await ambilPengaturan(env, 'titik_api_aktif')) !== '0') {
    try {
      await periksaTitikApi(env);
    } catch (e) {
      console.error('Pemeriksaan titik api gagal:', e);
    }
  }

  // Selalu proses antrean, apa pun jamnya.
  await prosesAntrean(env, 20);
}


/**
 * Semua yang dibutuhkan kartu anggota di layar KEBUN, dalam satu permintaan:
 * capaian, PICA yang masih terbuka, roster minggu ini, memo tim, dan laporan
 * terakhirnya.
 *
 * Nomor WhatsApp ikut dikirim — seluruh anggota memang sudah saling menyimpan
 * nomor di grup — tetapi hanya lewat jalur ini, tidak di daftar tim.
 * Memo pribadi tidak pernah ikut; yang tampil hanya memo berlingkup tim.
 */
async function profilAnggota(id: string, env: Env): Promise<Response> {
  const hariIni = tanggalWita();

  const anggota = await env.DB.prepare(
    'SELECT id, nama, jabatan, bidang, peran, wa, foto FROM tim WHERE id = ?1 AND aktif = 1',
  ).bind(id).first();
  if (!anggota) return galat('Anggota tidak ditemukan.', 404);

  const [profil, pica, roster, memo, laporan] = await Promise.all([
    env.DB.prepare('SELECT xp, level, luas_tanam, stamina, terakhir_aktif FROM profil_game WHERE user_id = ?1').bind(id).first(),
    env.DB.prepare(
      `SELECT id, judul, status, due_date, bidang FROM pica
        WHERE pic_id = ?1 AND dihapus = 0 AND status <> 'Closed'
        ORDER BY (due_date IS NULL), due_date LIMIT 20`,
    ).bind(id).all(),
    env.DB.prepare(
      'SELECT tanggal, kode, catatan FROM roster WHERE user_id = ?1 AND tanggal BETWEEN ?2 AND ?3 ORDER BY tanggal',
    ).bind(id, hariIni, geserHari(hariIni, 6)).all(),
    env.DB.prepare(
      `SELECT id, judul, ringkasan, kategori, status, tanggal FROM memo
        WHERE user_id = ?1 AND lingkup = 'tim' ORDER BY COALESCE(tanggal, dibuat_pada) DESC LIMIT 3`,
    ).bind(id).all(),
    env.DB.prepare(
      `SELECT id, jenis, capaian, satuan, pica_id, catatan, dibuat_pada FROM laporan
        WHERE user_id = ?1 ORDER BY dibuat_pada DESC LIMIT 5`,
    ).bind(id).all(),
  ]);

  return json({
    anggota,
    profil,
    pica: pica.results,
    roster: roster.results,
    memo: memo.results,
    laporan: laporan.results,
    hariIni,
  });
}
