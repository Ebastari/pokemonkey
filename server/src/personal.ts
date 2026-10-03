/**
 * Rute roster bulanan dan memo pribadi.
 *
 * Roster: Admin/Supervisor mengatur semua orang; anggota boleh mengisi
 * miliknya sendiri (mis. mengajukan cuti) — setiap perubahan mencatat siapa
 * yang mengubah. Memo: sepenuhnya pribadi per akun.
 */

import type { Env, Pengguna } from './tipe';
import { bolehUbahKunci, adalahAdmin } from './auth';
import { sekarangUtcIso, geserHari, tanggalWita, selisihHari } from './waktu';
import {
  susunJadwalMemo, tandaJadwalMemo, setCentangTugas, lepasTenggatTugas, hakMemo, hanyaCentangTugasSendiri, type BarisJadwalMemo,
  kepalaSampah, memoKosong, gantiLabelHalaman, HARI_SAMPAH,
} from './memo-blok';
import { matikanTautanMemo, ruteBagiMemo } from './lihat-memo';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);

export async function rutePersonal(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  const url = new URL(req.url);

  // ---------- Roster ----------
  if (jalur === '/api/roster' && req.method === 'GET') {
    const bulan = url.searchParams.get('bulan') ?? sekarangUtcIso().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(bulan)) return galat('Format bulan: YYYY-MM');
    const { results } = await env.DB.prepare(
      `SELECT user_id, tanggal, kode, catatan FROM roster WHERE tanggal LIKE ?1 ORDER BY tanggal`,
    ).bind(`${bulan}-%`).all();
    return json({ roster: results, bulan });
  }

  if (jalur === '/api/roster' && req.method === 'POST') {
    const b = (await req.json()) as { user_id?: string; tanggal?: string; kode?: string; catatan?: string };
    if (!b.user_id || !b.tanggal) return galat('user_id dan tanggal wajib diisi.');
    if (!bolehUbahKunci(pengguna)) return galat('Jadwal roster hanya dapat diatur oleh Supervisor atau Admin.', 403);

    if (!b.kode) {
      await env.DB.prepare('DELETE FROM roster WHERE user_id = ?1 AND tanggal = ?2').bind(b.user_id, b.tanggal).run();
      return json({ ok: true });
    }
    await env.DB.prepare(
      `INSERT INTO roster (user_id, tanggal, kode, catatan, diubah_oleh, diubah_pada) VALUES (?1,?2,?3,?4,?5,?6)
       ON CONFLICT(user_id, tanggal) DO UPDATE SET kode = ?3, catatan = ?4, diubah_oleh = ?5, diubah_pada = ?6`,
    ).bind(b.user_id, b.tanggal, b.kode, b.catatan ?? null, pengguna.id, sekarangUtcIso()).run();
    return json({ ok: true });
  }

  // Isi cepat: satu kode untuk rentang tanggal (opsional hanya hari tertentu, 0=Minggu),
  // atau pola siklus lapangan (mis. 8 minggu kerja lalu 2 minggu libur) bila mode = 'siklus'.
  if (jalur === '/api/roster/isi' && req.method === 'POST') {
    if (!bolehUbahKunci(pengguna)) return galat('Hanya Admin/Supervisor.', 403);
    const b = (await req.json()) as {
      user_id?: string; dari?: string; sampai?: string; kode?: string; hari?: number[];
      /** Lewati tanggal merah (libur nasional & cuti bersama) di rentang ini. */
      lewatiLibur?: boolean;
      /** 'siklus' = pola kerja–libur berulang; selain itu isi cepat biasa. */
      mode?: 'siklus';
      /** Mode siklus: kode hari libur, jumlah minggu kerja, dan jumlah minggu libur. */
      kodeLibur?: string; mingguKerja?: number; mingguLibur?: number;
    };
    if (!b.user_id || !b.dari || !b.sampai || !b.kode) return galat('user_id, dari, sampai, dan kode wajib diisi.');

    // Mode siklus lapangan: hari Minggu dan tanggal merah tetap dihitung sebagai
    // bagian masa kerja (siklus tidak bergeser), tetapi di roster ditandai kode libur.
    if (b.mode === 'siklus') {
      const kodeLibur = b.kodeLibur || 'OFF';
      const hariKerja = Math.max(1, Math.round(b.mingguKerja ?? 8)) * 7;
      const hariLibur = Math.max(0, Math.round(b.mingguLibur ?? 2)) * 7;
      const panjang = hariKerja + hariLibur;

      const merah = new Set<string>();
      const libur = await env.DB.prepare(
        `SELECT tanggal FROM libur WHERE tanggal BETWEEN ?1 AND ?2 AND jenis IN ('nasional','cuti','perusahaan')`,
      ).bind(b.dari, b.sampai).all<{ tanggal: string }>();
      libur.results.forEach((r) => merah.add(r.tanggal));

      const batchSiklus: D1PreparedStatement[] = [];
      for (let t = b.dari; t <= b.sampai && batchSiklus.length < 400; t = geserHari(t, 1)) {
        const ke = ((selisihHari(t, b.dari) % panjang) + panjang) % panjang;
        const masaKerja = ke < hariKerja;
        const hariMinggu = new Date(t + 'T00:00:00Z').getUTCDay() === 0;
        const kode = masaKerja && !hariMinggu && !merah.has(t) ? b.kode : kodeLibur;
        batchSiklus.push(
          env.DB.prepare(
            `INSERT INTO roster (user_id, tanggal, kode, diubah_oleh, diubah_pada) VALUES (?1,?2,?3,?4,?5)
             ON CONFLICT(user_id, tanggal) DO UPDATE SET kode = ?3, diubah_oleh = ?4, diubah_pada = ?5`,
          ).bind(b.user_id, t, kode, pengguna.id, sekarangUtcIso()),
        );
      }
      if (batchSiklus.length) await env.DB.batch(batchSiklus);
      return json({ ok: true, jumlah: batchSiklus.length });
    }

    const tanggalMerah = new Set<string>();
    if (b.lewatiLibur) {
      const { results } = await env.DB.prepare(
        `SELECT tanggal FROM libur WHERE tanggal BETWEEN ?1 AND ?2 AND jenis IN ('nasional','cuti','perusahaan')`,
      ).bind(b.dari, b.sampai).all<{ tanggal: string }>();
      results.forEach((r) => tanggalMerah.add(r.tanggal));
    }

    const batch: D1PreparedStatement[] = [];
    for (let t = b.dari; t <= b.sampai && batch.length < 400; t = geserHari(t, 1)) {
      const hari = new Date(t + 'T00:00:00Z').getUTCDay();
      if (b.hari && b.hari.length && !b.hari.includes(hari)) continue;
      if (tanggalMerah.has(t)) continue;
      batch.push(
        env.DB.prepare(
          `INSERT INTO roster (user_id, tanggal, kode, diubah_oleh, diubah_pada) VALUES (?1,?2,?3,?4,?5)
           ON CONFLICT(user_id, tanggal) DO UPDATE SET kode = ?3, diubah_oleh = ?4, diubah_pada = ?5`,
        ).bind(b.user_id, t, b.kode, pengguna.id, sekarangUtcIso()),
      );
    }
    if (batch.length) await env.DB.batch(batch);
    return json({ ok: true, jumlah: batch.length });
  }

  // ---------- Alarm tenggat PICA (milik sendiri) ----------

  /** Jam bawaan alarm PICA per orang; disimpan di pengaturan agar tidak hilang saat pasang ulang APK. */
  const kunciJamAlarm = `alarm_pica_jam:${pengguna.id}`;

  if (jalur === '/api/pica-alarm' && req.method === 'GET') {
    const [baris, jam] = await Promise.all([
      env.DB.prepare('SELECT pica_id, jam, aktif FROM pica_alarm WHERE user_id = ?1').bind(pengguna.id).all(),
      env.DB.prepare('SELECT nilai FROM pengaturan WHERE kunci = ?1').bind(kunciJamAlarm).first<{ nilai: string }>(),
    ]);
    return json({ alarm: baris.results ?? [], jamBawaan: jam?.nilai ?? '07:00' });
  }

  if (jalur === '/api/pica-alarm' && req.method === 'POST') {
    const b = (await req.json()) as { pica_id?: string; aktif?: boolean; jam?: string };
    if (!b.pica_id) return galat('pica_id wajib diisi.');
    const jam = /^\d{2}:\d{2}$/.test(b.jam ?? '') ? b.jam! : null;
    const aktif = b.aktif === false ? 0 : 1;
    await env.DB.prepare(
      `INSERT INTO pica_alarm (pica_id, user_id, jam, aktif, diubah_pada)
       VALUES (?1, ?2, COALESCE(?3, (SELECT nilai FROM pengaturan WHERE kunci = ?5), '07:00'), ?4, ?6)
       ON CONFLICT(pica_id, user_id) DO UPDATE SET
         jam = COALESCE(?3, pica_alarm.jam), aktif = ?4, diubah_pada = ?6`,
    ).bind(b.pica_id, pengguna.id, jam, aktif, kunciJamAlarm, sekarangUtcIso()).run();
    return json({ ok: true });
  }

  /** Ubah jam bawaan alarm PICA untuk pemakai ini (layar Notifikasi). */
  if (jalur === '/api/pica-alarm/jam' && req.method === 'POST') {
    const b = (await req.json()) as { jam?: string };
    if (!/^\d{2}:\d{2}$/.test(b.jam ?? '')) return galat('Jam harus berbentuk HH:MM.');
    await env.DB.prepare(
      `INSERT INTO pengaturan (kunci, nilai) VALUES (?1, ?2) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai`,
    ).bind(kunciJamAlarm, b.jam).run();
    return json({ ok: true, jamBawaan: b.jam });
  }

  // ---------- Lapisan kalender yang ditampilkan (layar KALENDER + widget) ----------

  const kunciLapisan = `kalender_lapisan:${pengguna.id}`;

  if (jalur === '/api/kalender/lapisan' && req.method === 'GET') {
    const b = await env.DB.prepare('SELECT nilai FROM pengaturan WHERE kunci = ?1').bind(kunciLapisan).first<{ nilai: string }>();
    let lapisan: Record<string, boolean> = {};
    try { lapisan = b?.nilai ? JSON.parse(b.nilai) : {}; } catch { lapisan = {}; }
    return json({ lapisan });
  }

  if (jalur === '/api/kalender/lapisan' && req.method === 'POST') {
    const b = (await req.json()) as { lapisan?: Record<string, boolean> };
    if (!b.lapisan || typeof b.lapisan !== 'object') return galat('lapisan wajib berupa objek.');
    await env.DB.prepare(
      `INSERT INTO pengaturan (kunci, nilai) VALUES (?1, ?2) ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai`,
    ).bind(kunciLapisan, JSON.stringify(b.lapisan)).run();
    return json({ ok: true });
  }

  // ---------- Libur ----------
  if (jalur === '/api/libur' && req.method === 'GET') {
    const tahun = url.searchParams.get('tahun');
    const dari = url.searchParams.get('dari') ?? (tahun ? `${tahun}-01-01` : '0000-01-01');
    const sampai = url.searchParams.get('sampai') ?? (tahun ? `${tahun}-12-31` : '9999-12-31');
    const { results } = await env.DB.prepare(
      'SELECT id, tanggal, nama, jenis, perkiraan FROM libur WHERE tanggal BETWEEN ?1 AND ?2 ORDER BY tanggal',
    ).bind(dari, sampai).all();
    return json({ libur: results });
  }

  if (jalur === '/api/libur' && req.method === 'POST') {
    if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh mengatur hari libur.', 403);
    const b = (await req.json()) as { tanggal?: string; nama?: string; jenis?: string };
    if (!b.tanggal || !b.nama) return galat('Tanggal dan nama libur wajib diisi.');
    const jenis = ['nasional', 'cuti', 'perusahaan'].includes(b.jenis ?? '') ? b.jenis : 'perusahaan';
    await env.DB.prepare(
      `INSERT INTO libur (tanggal, nama, jenis, sumber) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(tanggal, nama) DO UPDATE SET jenis = ?3, sumber = ?4`,
    ).bind(b.tanggal, b.nama, jenis, `ditambah ${pengguna.nama}`).run();
    return json({ ok: true }, 201);
  }

  const cocokLibur = jalur.match(/^\/api\/libur\/(\d+)$/);
  if (cocokLibur && req.method === 'DELETE') {
    if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh mengatur hari libur.', 403);
    await env.DB.prepare('DELETE FROM libur WHERE id = ?1').bind(Number(cocokLibur[1])).run();
    return json({ ok: true });
  }

  // ---------- Realisasi revegetasi ----------
  // Data acuan dari "Realisasi Permintaan Amdal.xlsx" (sheet Summary); dibaca
  // semua peran. Pembaruan tahunan lewat migrasi/SQL sampai layar penyuntingnya ada.
  if (jalur === '/api/revegetasi' && req.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT tahun, apl, hutan, ipd, opd, timbunan_soil, fasilitas, blok FROM revegetasi ORDER BY tahun',
    ).all<Record<string, unknown> & { blok: string }>();
    return json({
      revegetasi: results.map((b) => ({ ...b, blok: JSON.parse(b.blok || '{}') })),
      satuan: 'Ha',
    });
  }

  if (jalur === '/api/revegetasi' && req.method === 'POST') {
    if (!adalahAdmin(pengguna)) return galat('Hanya Admin yang boleh mengubah angka realisasi.', 403);
    const b = (await req.json()) as Record<string, unknown>;
    const tahun = Number(b.tahun);
    if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) return galat('Tahun harus antara 2000 dan 2100.');

    const n = (x: unknown) => Math.max(0, Math.round((Number(x) || 0) * 1000) / 1000);
    const isiBlok = (b.blok && typeof b.blok === 'object') ? b.blok as Record<string, unknown> : {};
    const blok = JSON.stringify(Object.fromEntries(Object.entries(isiBlok).map(([nama, luas]) => [nama, n(luas)])));

    await env.DB.prepare(
      `INSERT INTO revegetasi (tahun, apl, hutan, ipd, opd, timbunan_soil, fasilitas, blok, catatan, diubah_pada)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
       ON CONFLICT(tahun) DO UPDATE SET
         apl = ?2, hutan = ?3, ipd = ?4, opd = ?5, timbunan_soil = ?6, fasilitas = ?7,
         blok = ?8, catatan = ?9, diubah_pada = ?10`,
    ).bind(
      tahun, n(b.apl), n(b.hutan), n(b.ipd), n(b.opd), n(b.timbunan_soil), n(b.fasilitas),
      blok, (b.catatan as string) || `diisi ${pengguna.nama}`, sekarangUtcIso(),
    ).run();
    return json({ ok: true, tahun }, 201);
  }

  // ---------- Memo: pribadi & Memo Internal tim ----------
  if (jalur === '/api/memo' && req.method === 'GET') {
    const lingkup = url.searchParams.get('lingkup') === 'tim' ? 'tim' : 'pribadi';
    const pilihan = `SELECT m.*, t.nama AS penulis, p.no_urut AS pica_no, p.judul AS pica_judul, p.status AS pica_status
                       FROM memo m LEFT JOIN tim t ON t.id = m.user_id LEFT JOIN pica p ON p.id = m.pica_id`;
    // Memo di Sampah tidak ikut tampil (lihat /api/memo/sampah).
    const { results } = lingkup === 'tim'
      ? await env.DB.prepare(
          `${pilihan}
            WHERE m.lingkup = 'tim' AND m.dihapus_pada IS NULL
            ORDER BY COALESCE(m.tanggal, substr(m.dibuat_pada, 1, 10)) DESC, m.dibuat_pada DESC`,
        ).all()
      : await env.DB.prepare(
          `${pilihan}
            WHERE m.lingkup = 'pribadi' AND m.user_id = ?1 AND m.dihapus_pada IS NULL
            ORDER BY m.disematkan DESC, COALESCE(m.diubah_pada, m.dibuat_pada) DESC`,
        ).bind(pengguna.id).all();
    return json({ memo: results, lingkup });
  }

  if (jalur === '/api/memo' && req.method === 'POST') {
    const b = (await req.json()) as Record<string, unknown>;
    const teks = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : undefined);
    let lingkup = b.lingkup === 'tim' ? 'tim' : 'pribadi';
    // Memo baru: anggota lain bisa mengedit (bawaan), kecuali pembuat memilih "Baca saja".
    let akses = b.akses === 'baca' ? 'baca' : 'edit';

    // Sub-halaman (blok "Halaman"): ikut lingkup induknya dan mewarisi aksesnya, seperti Notion.
    // Menambah sub-halaman = mengubah induk, jadi butuh hak edit di induk.
    let indukId: string | null = null;
    if (typeof b.induk_id === 'string' && b.induk_id) {
      const induk = await env.DB.prepare('SELECT id, user_id, lingkup, akses, dihapus_pada FROM memo WHERE id = ?1')
        .bind(b.induk_id).first<{ id: string; user_id: string; lingkup: string; akses: string | null; dihapus_pada: string | null }>();
      const hakInduk = induk && !induk.dihapus_pada ? hakMemo(induk, pengguna) : null;
      if (!induk || !hakInduk) return galat('Halaman induk tidak ditemukan.', 404);
      if (hakInduk === 'baca') return galat('Halaman induk diatur "Baca saja": sub-halaman tidak bisa ditambahkan.', 403);
      indukId = induk.id;
      lingkup = induk.lingkup === 'tim' ? 'tim' : 'pribadi';
      if (!('akses' in b)) akses = induk.akses === 'baca' ? 'baca' : 'edit';
    }
    if (lingkup === 'tim' && pengguna.peran === 'pemantau') return galat('Peran Pemantau hanya bisa membaca memo tim.', 403);

    const id = `memo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const judul = teks('judul') ?? '';
    const isi = teks('isi') ?? '';
    await env.DB.prepare(
      `INSERT INTO memo (id, user_id, lingkup, judul, isi, ringkasan, kategori, tipe, status, tanggal, warna, pica_id, props, akses, induk_id, dibuat_pada)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)`,
    ).bind(
      id, pengguna.id, lingkup, judul, isi, teks('ringkasan') ?? null,
      teks('kategori') ?? null, teks('tipe') ?? null, teks('status') ?? null,
      teks('tanggal') ?? (lingkup === 'tim' ? tanggalWita() : null), teks('warna') ?? null,
      await picaSah(env, b.pica_id), bersihkanProps(b.props), akses, indukId, sekarangUtcIso(),
    ).run();
    if (isi) await sinkronJadwalMemo(env, { id, user_id: pengguna.id, lingkup, judul, isi });
    return json({ id, lingkup, akses, induk_id: indukId }, 201);
  }

  // ---------- Sampah (seperti Trash di Notion) ----------
  // Isinya: memo yang boleh dihapus pengguna ini (akses penuh). Sub-halaman yang ikut
  // terbuang tidak ditampilkan terpisah; jumlahnya ada di jumlah_anak.
  if (jalur === '/api/memo/sampah' && req.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT m.id, m.user_id, m.lingkup, m.akses, m.judul, m.isi, m.ringkasan, m.kategori, m.tipe, m.status, m.tanggal,
              m.disematkan, m.warna, m.props, m.pica_id, m.induk_id, m.dibuat_pada, m.diubah_pada, m.dihapus_pada, m.dihapus_oleh,
              t.nama AS penulis, h.nama AS penghapus, i.judul AS induk_judul
         FROM memo m LEFT JOIN tim t ON t.id = m.user_id LEFT JOIN tim h ON h.id = m.dihapus_oleh
         LEFT JOIN memo i ON i.id = m.induk_id AND i.dihapus_pada IS NULL
        WHERE m.dihapus_pada IS NOT NULL AND (m.lingkup = 'tim' OR m.user_id = ?1)`,
    ).bind(pengguna.id).all<BarisSampah>();
    const daftar = kepalaSampah(results)
      .filter((m) => hakMemo(m, pengguna) === 'penuh')
      .sort((a, b) => b.dihapus_pada.localeCompare(a.dihapus_pada));
    return json({ memo: daftar, hari: HARI_SAMPAH });
  }

  // Pulihkan: kelompok yang dibuang bersamaan kembali utuh. Bila induknya tidak ada lagi
  // (atau masih di Sampah), halaman kembali sebagai halaman teratas.
  const cocokPulihkan = jalur.match(/^\/api\/memo\/([\w-]+)\/pulihkan$/);
  if (cocokPulihkan && req.method === 'POST') {
    const memo = await env.DB.prepare('SELECT id, user_id, lingkup, akses, induk_id, dihapus_pada FROM memo WHERE id = ?1')
      .bind(cocokPulihkan[1]).first<BarisSampah>();
    if (!memo || !memo.dihapus_pada || !hakMemo(memo, pengguna)) return galat('Memo tidak ada di Sampah.', 404);
    if (hakMemo(memo, pengguna) !== 'penuh') return galat('Hanya pembuat memo, Supervisor, atau Admin yang boleh memulihkan memo ini.', 403);
    const kelompok = await pohonSampah(env, memo.id, memo.dihapus_pada);
    const ids = JSON.stringify(kelompok.map((m) => m.id));
    const indukAda = memo.induk_id
      ? await env.DB.prepare('SELECT id FROM memo WHERE id = ?1 AND dihapus_pada IS NULL').bind(memo.induk_id).first()
      : null;
    await env.DB.batch([
      env.DB.prepare('UPDATE memo SET dihapus_pada = NULL, dihapus_oleh = NULL WHERE id IN (SELECT value FROM json_each(?1))').bind(ids),
      ...(memo.induk_id && !indukAda ? [env.DB.prepare('UPDATE memo SET induk_id = NULL WHERE id = ?1').bind(memo.id)] : []),
    ]);
    // Tugas bertenggat kembali ke Jadwal.
    for (const m of kelompok) if (m.isi) await sinkronJadwalMemo(env, m);
    return json({ ok: true, jumlah: kelompok.length, induk_id: indukAda ? memo.induk_id : null });
  }

  // Hapus permanen dari Sampah: memo beserta sub-halamannya, gambar/berkas, dan tautan bagikannya.
  const cocokPermanen = jalur.match(/^\/api\/memo\/([\w-]+)\/permanen$/);
  if (cocokPermanen && req.method === 'DELETE') {
    const memo = await env.DB.prepare('SELECT id, user_id, lingkup, akses, induk_id, dihapus_pada FROM memo WHERE id = ?1')
      .bind(cocokPermanen[1]).first<BarisSampah>();
    if (!memo || !memo.dihapus_pada || !hakMemo(memo, pengguna)) return galat('Memo tidak ada di Sampah.', 404);
    if (hakMemo(memo, pengguna) !== 'penuh') return galat('Hanya pembuat memo, Supervisor, atau Admin yang boleh menghapus permanen.', 403);
    const jumlah = await hapusPermanenMemo(env, memo.id);
    return json({ ok: true, jumlah });
  }

  // Komentar memo (lihat ruteKomentar).
  const cocokKomentar = jalur.match(/^\/api\/memo\/([\w-]+)\/komentar(?:\/([\w-]+))?$/);
  if (cocokKomentar) return ruteKomentar(cocokKomentar[1], cocokKomentar[2], req, env, pengguna);

  // Kartu tautan web di memo: judul & keterangan halaman yang ditautkan.
  if (jalur === '/api/pratinjau-tautan' && req.method === 'GET') return pratinjauTautan(url.searchParams.get('url') ?? '');

  // Bagikan memo lewat tautan (lihat lihat-memo.ts).
  const cocokBagiMemo = jalur.match(/^\/api\/memo\/([\w-]+)\/bagi$/);
  if (cocokBagiMemo) return ruteBagiMemo(cocokBagiMemo[1], req, env, pengguna);

  const cocokMemo = jalur.match(/^\/api\/memo\/([\w-]+)$/);
  if (cocokMemo) {
    const memo = await env.DB.prepare('SELECT id, user_id, lingkup, akses, judul, isi, ringkasan, diubah_pada FROM memo WHERE id = ?1 AND dihapus_pada IS NULL')
      .bind(cocokMemo[1]).first<{ id: string; user_id: string; lingkup: string; akses: string | null; judul: string; isi: string; ringkasan: string | null; diubah_pada: string | null }>();
    // Memo pribadi milik orang lain (dan memo di Sampah) diperlakukan seolah tidak ada.
    const hak = memo ? hakMemo(memo, pengguna) : null;
    if (!memo || !hak) return galat('Memo tidak ditemukan.', 404);

    // Satu memo terbaru — halaman yang sedang dibuka memeriksa perubahan dari orang lain.
    if (req.method === 'GET') {
      const baris = await env.DB.prepare(
        `SELECT m.*, t.nama AS penulis, p.no_urut AS pica_no, p.judul AS pica_judul, p.status AS pica_status
           FROM memo m LEFT JOIN tim t ON t.id = m.user_id LEFT JOIN pica p ON p.id = m.pica_id WHERE m.id = ?1`,
      ).bind(memo.id).first();
      return json({ memo: baris });
    }

    if (req.method === 'DELETE') {
      if (hak !== 'penuh') return galat('Hanya pembuat memo, Supervisor, atau Admin yang boleh menghapus memo ini.', 403);
      // ?kosong=1: halaman baru yang dibiarkan kosong (tanpa sub-halaman) dibuang langsung, tidak mengotori Sampah.
      if (url.searchParams.get('kosong') === '1') {
        const adaAnak = await env.DB.prepare('SELECT 1 FROM memo WHERE induk_id = ?1 LIMIT 1').bind(memo.id).first();
        if (!memoKosong(memo) || adaAnak) return json({ ok: true, dihapus: false });
        await hapusIsiTerkaitMemo(env, memo.id);
        await env.DB.prepare('DELETE FROM memo WHERE id = ?1').bind(memo.id).run();
        return json({ ok: true, dihapus: true });
      }
      // Pindah ke Sampah beserta semua sub-halamannya; tugasnya keluar dari Jadwal sampai dipulihkan.
      const { results: pohon } = await env.DB.prepare(
        `WITH RECURSIVE pohon(id) AS (
           SELECT ?1
           UNION ALL
           SELECT m.id FROM memo m JOIN pohon p ON m.induk_id = p.id WHERE m.dihapus_pada IS NULL
         )
         SELECT id FROM pohon`,
      ).bind(memo.id).all<{ id: string }>();
      const ids = JSON.stringify(pohon.map((r) => r.id));
      await env.DB.batch([
        env.DB.prepare('UPDATE memo SET dihapus_pada = ?2, dihapus_oleh = ?3 WHERE id IN (SELECT value FROM json_each(?1))')
          .bind(ids, sekarangUtcIso(), pengguna.id),
        env.DB.prepare('DELETE FROM jadwal WHERE memo_id IN (SELECT value FROM json_each(?1))').bind(ids),
      ]);
      return json({ ok: true, sampah: true, jumlah: pohon.length });
    }
    if (req.method === 'PATCH') {
      const b = (await req.json()) as Record<string, unknown>;
      // Penjaga bentrok: isi baru membawa versi dasarnya. Bila memo sudah diubah orang lain
      // sejak versi itu, jawab 409 beserta isi terbaru — aplikasi menggabung per baris lalu mengirim ulang.
      const adaDasar = 'dasar_diubah' in b;
      const dasar = b.dasar_diubah ?? null;
      delete b.dasar_diubah;
      if (adaDasar && typeof b.isi === 'string' && dasar !== (memo.diubah_pada ?? null) && b.isi !== memo.isi) {
        return json({ galat: 'Memo ini baru saja diubah orang lain.', memo: { isi: memo.isi, diubah_pada: memo.diubah_pada } }, 409);
      }
      // Baca saja: hanya boleh mencentang tugas yang menyebut dirinya.
      if (hak === 'baca') {
        const hanyaIsi = Object.keys(b).every((k) => k === 'isi');
        if (!hanyaIsi || typeof b.isi !== 'string' || !hanyaCentangTugasSendiri(memo.isi, b.isi, pengguna.id)) {
          return galat('Memo ini diatur "Baca saja" oleh pembuatnya. Anda hanya bisa mencentang tugas Anda sendiri.', 403);
        }
      }
      if ('akses' in b && hak !== 'penuh') return galat('Hanya pembuat memo, Supervisor, atau Admin yang boleh mengatur akses.', 403);
      if ('akses' in b) b.akses = b.akses === 'baca' ? 'baca' : 'edit';
      const kolom = ['judul', 'isi', 'disematkan', 'warna', 'ringkasan', 'kategori', 'tipe', 'status', 'tanggal', 'pica_id', 'props', 'akses'].filter((k) => k in b);
      if (kolom.length === 0) return json({ ok: true });
      const nilai: unknown[] = [];
      for (const k of kolom) {
        if (k === 'disematkan') nilai.push(b[k] ? 1 : 0);
        else if (k === 'pica_id') nilai.push(await picaSah(env, b[k]));
        else if (k === 'props') nilai.push(bersihkanProps(b[k]));
        else nilai.push(b[k]);
      }
      const set = kolom.map((k, i) => `${k} = ?${i + 2}`).join(', ');
      const waktu = sekarangUtcIso();
      await env.DB.prepare(`UPDATE memo SET ${set}, diubah_pada = ?${kolom.length + 2} WHERE id = ?1`)
        .bind(memo.id, ...nilai, waktu)
        .run();
      if ('isi' in b || 'judul' in b) {
        const baru = await env.DB.prepare('SELECT id, user_id, lingkup, judul, isi FROM memo WHERE id = ?1').bind(memo.id)
          .first<{ id: string; user_id: string; lingkup: string; judul: string; isi: string }>();
        if (baru) await sinkronJadwalMemo(env, baru);
      }
      if (typeof b.judul === 'string') await perbaruiLabelHalaman(env, memo.id, b.judul);
      return json({ ok: true, diubah_pada: waktu });
    }
  }

  return null;
}

// ============================================================
// Memo: pembersih masukan, Jadwal dari ceklis, pembersihan
// ============================================================

/** Id PICA yang masih ada, atau null. */
async function picaSah(env: Env, id: unknown): Promise<string | null> {
  if (typeof id !== 'string' || !id) return null;
  const r = await env.DB.prepare('SELECT id FROM pica WHERE id = ?1 AND dihapus = 0').bind(id).first<{ id: string }>();
  return r ? r.id : null;
}

/** Nilai properti kustom memo → JSON aman (kunci huruf kecil, nilai sederhana, ukuran dibatasi). */
function bersihkanProps(v: unknown): string {
  let isi: unknown = v;
  if (typeof v === 'string') { try { isi = JSON.parse(v); } catch { isi = null; } }
  if (!isi || typeof isi !== 'object' || Array.isArray(isi)) return '{}';
  const hasil: Record<string, string | number | boolean | null> = {};
  for (const [k, x] of Object.entries(isi as Record<string, unknown>).slice(0, 40)) {
    if (!/^[a-z0-9_]{1,40}$/.test(k)) continue;
    if (typeof x === 'string') hasil[k] = x.slice(0, 500);
    else if (typeof x === 'number' && Number.isFinite(x)) hasil[k] = x;
    else if (typeof x === 'boolean' || x === null) hasil[k] = x as boolean | null;
  }
  return JSON.stringify(hasil);
}

interface MemoSinkron { id: string; user_id: string; lingkup: string; judul: string; isi: string }

/**
 * Ceklis bertenggat di memo → baris Jadwal (jenis 'tenggat', memo_id terisi).
 * Daftar yang sama dengan yang tersimpan tidak menulis ulang tabel, sehingga
 * pengetikan biasa (simpan otomatis tiap jeda) tidak membuat baris berganti-ganti.
 */
async function sinkronJadwalMemo(env: Env, m: MemoSinkron): Promise<void> {
  const { results: tim } = await env.DB.prepare('SELECT id FROM tim WHERE aktif = 1').all<{ id: string }>();
  const baru = susunJadwalMemo(m.isi, {
    judulMemo: m.judul,
    lingkup: m.lingkup === 'tim' ? 'tim' : 'pribadi',
    penulisId: m.user_id,
    idTim: new Set(tim.map((t) => t.id)),
  });
  const { results: lama } = await env.DB.prepare(
    `SELECT judul, keterangan, tanggal, jam_mulai, selesai, pemilik_id, ingatkan_menit
       FROM jadwal WHERE memo_id = ?1 ORDER BY rowid`,
  ).bind(m.id).all<BarisJadwalMemo>();
  if (tandaJadwalMemo(lama as BarisJadwalMemo[]) === tandaJadwalMemo(baru)) return;

  const perintah = [env.DB.prepare('DELETE FROM jadwal WHERE memo_id = ?1').bind(m.id)];
  for (const r of baru) {
    perintah.push(
      env.DB.prepare(
        `INSERT INTO jadwal (id, judul, keterangan, tanggal, jam_mulai, jenis, pemilik_id, selesai, ingatkan_menit, memo_id)
         VALUES (?1,?2,?3,?4,?5,'tenggat',?6,?7,?8,?9)`,
      ).bind(
        `jdw_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        r.judul, r.keterangan, r.tanggal, r.jam_mulai, r.pemilik_id, r.selesai, r.ingatkan_menit, m.id,
      ),
    );
  }
  await env.DB.batch(perintah);
}

/** Memo dihapus: Jadwal buatannya, tautan bagikan, lampiran, dan berkas di R2 ikut dibersihkan. */
async function hapusIsiTerkaitMemo(env: Env, memoId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM jadwal WHERE memo_id = ?1').bind(memoId).run();
  await env.DB.prepare('DELETE FROM memo_komentar WHERE memo_id = ?1').bind(memoId).run();
  await matikanTautanMemo(env, memoId);
  const { results } = await env.DB.prepare("SELECT kunci_r2 FROM lampiran WHERE entitas = 'memo' AND entitas_id = ?1")
    .bind(memoId).all<{ kunci_r2: string }>();
  if (results.length) {
    await env.BUKET.delete(results.map((r) => r.kunci_r2));
    await env.DB.prepare("DELETE FROM lampiran WHERE entitas = 'memo' AND entitas_id = ?1").bind(memoId).run();
  }
}

/** Judul memo berubah: label tautan/sub-halaman `[[memo:id|…]]` di memo lain ikut diperbarui (tanpa mengubah diubah_pada). */
async function perbaruiLabelHalaman(env: Env, id: string, judul: string): Promise<void> {
  const { results } = await env.DB.prepare('SELECT id, isi FROM memo WHERE instr(isi, ?1) > 0 LIMIT 200')
    .bind(`[[memo:${id}|`).all<{ id: string; isi: string }>();
  const perintah = results.flatMap((r) => {
    const baru = gantiLabelHalaman(r.isi, id, judul);
    return baru === r.isi ? [] : [env.DB.prepare('UPDATE memo SET isi = ?2 WHERE id = ?1').bind(r.id, baru)];
  });
  if (perintah.length) await env.DB.batch(perintah);
}

// ============================================================
// Komentar memo
// ============================================================

/**
 * GET    /api/memo/:id/komentar        semua komentar memo (urut waktu)
 * POST   /api/memo/:id/komentar        { isi, kutipan?, induk_id? }
 * PATCH  /api/memo/:id/komentar/:kid   { isi } (penulisnya) · { selesai } (penulis atau yang bisa mengedit memo)
 * DELETE /api/memo/:id/komentar/:kid   penulisnya atau akses penuh memo; balasannya ikut terhapus
 * Siapa pun yang bisa membaca memo boleh berkomentar (teks memo tidak berubah).
 */
async function ruteKomentar(memoId: string, kid: string | undefined, req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  const memo = await env.DB.prepare('SELECT id, user_id, lingkup, akses FROM memo WHERE id = ?1 AND dihapus_pada IS NULL')
    .bind(memoId).first<{ id: string; user_id: string; lingkup: string; akses: string | null }>();
  const hak = memo ? hakMemo(memo, pengguna) : null;
  if (!memo || !hak) return galat('Memo tidak ditemukan.', 404);

  if (!kid && req.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT k.id, k.memo_id, k.induk_id, k.user_id, k.kutipan, k.isi, k.selesai, k.dibuat_pada, k.diubah_pada, t.nama
         FROM memo_komentar k LEFT JOIN tim t ON t.id = k.user_id WHERE k.memo_id = ?1 ORDER BY k.dibuat_pada`,
    ).bind(memo.id).all();
    return json({ komentar: results });
  }
  if (!kid && req.method === 'POST') {
    const b = (await req.json()) as Record<string, unknown>;
    const isi = typeof b.isi === 'string' ? b.isi.trim().slice(0, 2000) : '';
    if (!isi) return galat('Komentar masih kosong.');
    const kutipan = typeof b.kutipan === 'string' && b.kutipan.trim() ? b.kutipan.trim().slice(0, 300) : null;
    let induk: string | null = null;
    if (typeof b.induk_id === 'string' && b.induk_id) {
      const k = await env.DB.prepare('SELECT id, induk_id FROM memo_komentar WHERE id = ?1 AND memo_id = ?2').bind(b.induk_id, memo.id)
        .first<{ id: string; induk_id: string | null }>();
      if (!k) return galat('Komentar yang dibalas tidak ditemukan.', 404);
      induk = k.induk_id ?? k.id; // balasan selalu ke komentar pertama utas
    }
    const id = `kom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const pada = sekarangUtcIso();
    await env.DB.prepare(
      'INSERT INTO memo_komentar (id, memo_id, induk_id, user_id, kutipan, isi, dibuat_pada) VALUES (?1,?2,?3,?4,?5,?6,?7)',
    ).bind(id, memo.id, induk, pengguna.id, induk ? null : kutipan, isi, pada).run();
    return json({ id, memo_id: memo.id, induk_id: induk, user_id: pengguna.id, kutipan: induk ? null : kutipan, isi, selesai: 0, dibuat_pada: pada, diubah_pada: null, nama: pengguna.nama }, 201);
  }
  if (!kid) return galat('Metode tidak didukung.', 405);

  const k = await env.DB.prepare('SELECT id, user_id FROM memo_komentar WHERE id = ?1 AND memo_id = ?2').bind(kid, memo.id)
    .first<{ id: string; user_id: string }>();
  if (!k) return galat('Komentar tidak ditemukan.', 404);
  const milik = k.user_id === pengguna.id;
  if (req.method === 'PATCH') {
    const b = (await req.json()) as Record<string, unknown>;
    if (typeof b.isi === 'string') {
      if (!milik) return galat('Hanya penulis komentar yang boleh mengubahnya.', 403);
      const isi = b.isi.trim().slice(0, 2000);
      if (!isi) return galat('Komentar masih kosong.');
      await env.DB.prepare('UPDATE memo_komentar SET isi = ?2, diubah_pada = ?3 WHERE id = ?1').bind(k.id, isi, sekarangUtcIso()).run();
    }
    if ('selesai' in b) {
      if (!milik && hak === 'baca') return galat('Hanya penulis komentar atau yang bisa mengedit memo yang boleh menandai selesai.', 403);
      await env.DB.prepare('UPDATE memo_komentar SET selesai = ?2 WHERE id = ?1 OR induk_id = ?1').bind(k.id, b.selesai ? 1 : 0).run();
    }
    return json({ ok: true });
  }
  if (req.method === 'DELETE') {
    if (!milik && hak !== 'penuh') return galat('Hanya penulis komentar, pembuat memo, Supervisor, atau Admin yang boleh menghapusnya.', 403);
    await env.DB.prepare('DELETE FROM memo_komentar WHERE id = ?1 OR induk_id = ?1').bind(k.id).run();
    return json({ ok: true });
  }
  return galat('Metode tidak didukung.', 405);
}

// ============================================================
// Pratinjau tautan web (kartu "Tautan web" di memo)
// ============================================================

const entitas = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/** Judul, keterangan, dan nama situs dari tag <title>/<meta>; kosong bila tidak bisa diambil. */
async function pratinjauTautan(alamat: string): Promise<Response> {
  let u: URL;
  try { u = new URL(alamat); } catch { return galat('Alamat tautan tidak sah.'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return galat('Hanya alamat http/https.');
  const situs = u.hostname.replace(/^www\./, '');
  const kosong = json({ judul: '', ket: '', situs });
  // Hanya nama domain publik: alamat IP dan nama lokal tidak diambil.
  if (/^(localhost|.*\.local|.*\.internal|.*\.lan)$/i.test(u.hostname) || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(':')) return kosong;
  const henti = new AbortController();
  const pewaktu = setTimeout(() => henti.abort(), 5000);
  try {
    const res = await fetch(u.toString(), {
      signal: henti.signal, redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; POKEMONKEY-pratinjau/1.0)', Accept: 'text/html' },
    });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html') || !res.body) return kosong;
    // Cukup bagian awal halaman (<head>), paling banyak 100 KB.
    const pembaca = res.body.getReader();
    const urai = new TextDecoder();
    let html = '';
    while (html.length < 100_000) {
      const { done, value } = await pembaca.read();
      if (done) break;
      html += urai.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    void pembaca.cancel().catch(() => undefined);
    const meta = (nama: string) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nama}["'][^>]*>`, 'i'))?.[0];
      return m ? entitas(m.match(/content=["']([^"']*)["']/i)?.[1] ?? '').trim() : '';
    };
    const judul = meta('og:title') || meta('twitter:title') || entitas(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();
    const ket = meta('og:description') || meta('description') || meta('twitter:description');
    return json({ judul: judul.slice(0, 200), ket: ket.slice(0, 400), situs: (meta('og:site_name') || situs).slice(0, 100) });
  } catch {
    return kosong;
  } finally {
    clearTimeout(pewaktu);
  }
}

// ============================================================
// Sampah memo
// ============================================================

interface BarisSampah {
  id: string; user_id: string; lingkup: string; akses: string | null; judul: string; isi: string;
  induk_id: string | null; dihapus_pada: string;
}

/** Memo `akarId` dan sub-halaman yang terbuang bersamanya (dihapus_pada sama). */
async function pohonSampah(env: Env, akarId: string, waktu: string): Promise<BarisSampah[]> {
  const { results } = await env.DB.prepare(
    `WITH RECURSIVE pohon(id) AS (
       SELECT ?1
       UNION ALL
       SELECT m.id FROM memo m JOIN pohon p ON m.induk_id = p.id WHERE m.dihapus_pada = ?2
     )
     SELECT m.id, m.user_id, m.lingkup, m.akses, m.judul, m.isi, m.induk_id, m.dihapus_pada
       FROM memo m WHERE m.id IN (SELECT id FROM pohon)`,
  ).bind(akarId, waktu).all<BarisSampah>();
  return results;
}

/** Hapus permanen memo di Sampah beserta semua keturunannya yang juga di Sampah. Mengembalikan jumlah memo. */
async function hapusPermanenMemo(env: Env, akarId: string): Promise<number> {
  const { results } = await env.DB.prepare(
    `WITH RECURSIVE pohon(id) AS (
       SELECT ?1
       UNION ALL
       SELECT m.id FROM memo m JOIN pohon p ON m.induk_id = p.id
     )
     SELECT m.id FROM memo m WHERE m.id IN (SELECT id FROM pohon) AND m.dihapus_pada IS NOT NULL`,
  ).bind(akarId).all<{ id: string }>();
  for (const r of results) await hapusIsiTerkaitMemo(env, r.id);
  const ids = JSON.stringify(results.map((r) => r.id));
  await env.DB.batch([
    // Jaga-jaga: anak yang tidak ikut terhapus naik jadi halaman teratas, bukan menunjuk induk yang hilang.
    env.DB.prepare('UPDATE memo SET induk_id = NULL WHERE induk_id IN (SELECT value FROM json_each(?1)) AND dihapus_pada IS NULL').bind(ids),
    env.DB.prepare('DELETE FROM memo WHERE id IN (SELECT value FROM json_each(?1))').bind(ids),
  ]);
  return results.length;
}

/** Cron: memo yang lebih dari HARI_SAMPAH hari di Sampah dihapus permanen. */
export async function bersihkanSampahMemo(env: Env): Promise<void> {
  const batas = new Date(Date.now() - HARI_SAMPAH * 86_400_000).toISOString();
  const { results } = await env.DB.prepare(
    'SELECT id FROM memo WHERE dihapus_pada IS NOT NULL AND dihapus_pada < ?1 LIMIT 50',
  ).bind(batas).all<{ id: string }>();
  for (const r of results) {
    // Bisa sudah ikut terhapus sebagai keturunan baris sebelumnya.
    const masih = await env.DB.prepare('SELECT 1 FROM memo WHERE id = ?1').bind(r.id).first();
    if (masih) await hapusPermanenMemo(env, r.id);
  }
}

/**
 * Kalender mencentang / menghapus Jadwal buatan memo: perubahan itu dicerminkan
 * ke teks memo (memo adalah sumber kebenaran, jadi tidak boleh berselisih).
 */
export async function cerminkanJadwalKeMemo(
  env: Env,
  j: { memo_id: string | null; judul: string; tanggal: string; jam_mulai: string | null },
  aksi: { selesai: boolean } | 'lepas',
): Promise<void> {
  if (!j.memo_id) return;
  const memo = await env.DB.prepare('SELECT isi FROM memo WHERE id = ?1').bind(j.memo_id).first<{ isi: string }>();
  if (!memo) return;
  const baru = aksi === 'lepas' ? lepasTenggatTugas(memo.isi, j) : setCentangTugas(memo.isi, j, aksi.selesai);
  if (baru === null) return;
  await env.DB.prepare('UPDATE memo SET isi = ?2, diubah_pada = ?3 WHERE id = ?1').bind(j.memo_id, baru, sekarangUtcIso()).run();
}
