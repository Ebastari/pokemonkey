/**
 * WhatsApp lewat Fonnte.
 *
 * Aturan main:
 *  - Token hanya ada di sini, sebagai secret Worker. Aplikasi Android TIDAK
 *    pernah memegangnya (APK bisa dibongkar).
 *  - Permintaan pengguna tidak pernah memanggil Fonnte langsung. Semua pesan
 *    masuk tabel pesan_wa, lalu dikirim oleh cron. Jadi lambatnya Fonnte tidak
 *    menahan aplikasi, dan kegagalan bisa diulang.
 *  - Indeks unik di pesan_wa mencegah satu PICA dikirimi pengingat jenis sama
 *    dua kali dalam satu hari.
 */

import type { Env } from './tipe';
import { sekarangUtcIso, tanggalIndonesia, selisihHari, tanggalWita } from './waktu';

const ENDPOINT = 'https://api.fonnte.com/send';

export interface PesanBaru {
  tujuan: string;
  isi: string;
  jenis: 'pengingat' | 'eskalasi' | 'rekap' | 'pengumuman' | 'uji' | 'balasan' | 'titik_api';
  ref_id?: string | null;
  kirim_pada?: string;
}

/** Masukkan ke antrean. Duplikat diabaikan diam-diam oleh indeks unik. */
export async function antre(env: Env, p: PesanBaru): Promise<void> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO pesan_wa (tujuan, isi, jenis, ref_id, kirim_pada)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  )
    .bind(p.tujuan, p.isi, p.jenis, p.ref_id ?? null, p.kirim_pada ?? sekarangUtcIso())
    .run();
}

export async function ambilPengaturan(env: Env, kunci: string): Promise<string> {
  const b = await env.DB.prepare('SELECT nilai FROM pengaturan WHERE kunci = ?1')
    .bind(kunci)
    .first<{ nilai: string }>();
  return b?.nilai ?? '';
}

/** Kirim satu permintaan ke Fonnte. */
async function kirimFonnte(
  env: Env,
  target: string,
  pesan: string,
  jeda: string,
): Promise<{ ok: boolean; id?: string; galat?: string }> {
  if (!env.FONNTE_TOKEN) return { ok: false, galat: 'FONNTE_TOKEN belum diatur' };

  const body = new FormData();
  body.append('target', target);
  body.append('message', pesan);
  body.append('countryCode', '62');
  if (jeda) body.append('delay', jeda);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: env.FONNTE_TOKEN }, // tanpa "Bearer"
      body,
    });
    const hasil = (await res.json()) as { status?: boolean; id?: string[]; reason?: string; detail?: string };
    if (hasil.status) return { ok: true, id: Array.isArray(hasil.id) ? hasil.id[0] : undefined };
    return { ok: false, galat: hasil.reason ?? hasil.detail ?? 'ditolak Fonnte' };
  } catch (e) {
    return { ok: false, galat: e instanceof Error ? e.message : 'gangguan jaringan' };
  }
}

function tidur(ms: number): Promise<void> {
  return new Promise((selesai) => setTimeout(selesai, ms));
}

function acak(min: number, maks: number): number {
  return min + Math.random() * Math.max(0, maks - min);
}

/** Panggil API Fonnte selain /send; semuanya POST dengan token di header. */
async function panggilFonnte<T>(env: Env, jalur: string): Promise<T & { status?: boolean; reason?: string; detail?: string }> {
  const res = await fetch(`https://api.fonnte.com/${jalur}`, {
    method: 'POST',
    headers: { Authorization: env.FONNTE_TOKEN ?? '' },
  });
  return res.json();
}

export interface StatusWa {
  terpasang: boolean;
  tersambung?: boolean;
  nomor?: string;
  nama?: string;
  kuota?: string;
  paket?: string;
  kedaluwarsa?: string;
  galat?: string;
}

/** Keadaan perangkat Fonnte: token terpasang? nomor WA tersambung? sisa kuota? */
export async function statusWa(env: Env): Promise<StatusWa> {
  if (!env.FONNTE_TOKEN) return { terpasang: false };
  try {
    const d = await panggilFonnte<{ device?: string; device_status?: string; name?: string; quota?: string; package?: string; expired?: string }>(env, 'device');
    if (!d.status) return { terpasang: true, tersambung: false, galat: d.reason ?? d.detail ?? 'ditolak Fonnte' };
    return {
      terpasang: true,
      tersambung: d.device_status === 'connect',
      nomor: d.device,
      nama: d.name,
      kuota: d.quota,
      paket: d.package,
      kedaluwarsa: d.expired,
    };
  } catch (e) {
    return { terpasang: true, galat: e instanceof Error ? e.message : 'gangguan jaringan' };
  }
}

/**
 * Daftar grup WA yang diikuti nomor Fonnte. `segarkan` memanggil fetch-group
 * lebih dulu — Fonnte meminta itu hanya sesekali (setelah bergabung ke grup
 * baru), karena terlalu sering bisa membuat nomor diblokir WhatsApp.
 */
export async function daftarGrupWa(env: Env, segarkan: boolean): Promise<{ grup: { id: string; nama: string }[]; galat?: string }> {
  if (!env.FONNTE_TOKEN) return { grup: [], galat: 'FONNTE_TOKEN belum diatur' };
  try {
    if (segarkan) {
      const f = await panggilFonnte<object>(env, 'fetch-group');
      if (!f.status) return { grup: [], galat: f.detail ?? f.reason ?? 'gagal memperbarui daftar grup' };
    }
    const d = await panggilFonnte<{ data?: { id: string; name: string }[] }>(env, 'get-whatsapp-group');
    if (!d.status) return { grup: [], galat: d.detail ?? d.reason ?? 'daftar grup kosong' };
    return { grup: (d.data ?? []).map((g) => ({ id: g.id, nama: g.name })) };
  } catch (e) {
    return { grup: [], galat: e instanceof Error ? e.message : 'gangguan jaringan' };
  }
}

/** Kirim seketika tanpa antrean (untuk uji coba), tetap tercatat di pesan_wa. */
export async function kirimLangsung(
  env: Env,
  tujuan: string,
  isi: string,
): Promise<{ ok: boolean; id?: string; galat?: string }> {
  const hasil = await kirimFonnte(env, tujuan, isi, '');
  await env.DB.prepare(
    `INSERT INTO pesan_wa (tujuan, isi, jenis, kirim_pada, status, percobaan, fonnte_id, galat, diproses_pada)
     VALUES (?1, ?2, 'uji', ?3, ?4, 1, ?5, ?6, ?3)`,
  )
    .bind(tujuan, isi, sekarangUtcIso(), hasil.ok ? 'terkirim' : 'gagal', hasil.id ?? null, hasil.galat ?? null)
    .run();
  return hasil;
}

/** Dipanggil cron: kirim yang sudah waktunya, maksimal beberapa per putaran. */
export async function prosesAntrean(env: Env, batas = 20): Promise<{ terkirim: number; gagal: number }> {
  if ((await ambilPengaturan(env, 'wa_aktif')) !== '1') return { terkirim: 0, gagal: 0 };

  // Pengumuman dan rekap yang tertahan lebih dari sehari sudah basi; jangan dikirim.
  await env.DB.prepare(
    `UPDATE pesan_wa SET status = 'gagal', galat = 'kedaluwarsa', diproses_pada = ?2
      WHERE status = 'menunggu' AND jenis IN ('pengumuman', 'rekap', 'titik_api') AND kirim_pada < ?1`,
  )
    .bind(new Date(Date.now() - 86_400_000).toISOString(), sekarangUtcIso())
    .run();

  const jeda = (await ambilPengaturan(env, 'wa_jeda')) || '5-10';
  const { results } = await env.DB.prepare(
    `SELECT id, tujuan, isi FROM pesan_wa
      WHERE status = 'menunggu' AND kirim_pada <= ?1 AND percobaan < 4
      ORDER BY kirim_pada LIMIT ?2`,
  )
    .bind(sekarangUtcIso(), batas)
    .all<{ id: number; tujuan: string; isi: string }>();

  let terkirim = 0;
  let gagal = 0;

  // Parameter `delay` Fonnte hanya berlaku untuk banyak target dalam SATU
  // permintaan. Karena tiap pesan di sini permintaan terpisah, jedanya dibuat
  // sendiri. Menunggu jaringan tidak dihitung sebagai waktu CPU Worker.
  const [jedaMin, jedaMaks] = jeda.split('-').map(Number);

  for (let i = 0; i < results.length; i++) {
    const p = results[i];
    if (i > 0) await tidur(acak(jedaMin || 5, jedaMaks || jedaMin || 10) * 1000);

    const hasil = await kirimFonnte(env, p.tujuan, p.isi, '');
    if (hasil.ok) {
      terkirim++;
      await env.DB.prepare(
        `UPDATE pesan_wa SET status='terkirim', fonnte_id=?2, diproses_pada=?3,
                percobaan = percobaan + 1 WHERE id = ?1`,
      )
        .bind(p.id, hasil.id ?? null, sekarangUtcIso())
        .run();
    } else {
      gagal++;
      await env.DB.prepare(
        `UPDATE pesan_wa
            SET percobaan = percobaan + 1,
                galat = ?2,
                status = CASE WHEN percobaan + 1 >= 4 THEN 'gagal' ELSE 'menunggu' END,
                diproses_pada = ?3
          WHERE id = ?1`,
      )
        .bind(p.id, hasil.galat ?? 'gagal', sekarangUtcIso())
        .run();
    }
  }

  return { terkirim, gagal };
}

// ---------- Penyusun pesan ----------

interface BarisPengingat {
  id: string;
  judul: string;
  due_date: string;
  tindakan: string | null;
  nama: string;
  wa: string | null;
}

export function pesanPengingat(p: BarisPengingat, hariIni: string): string {
  const sisa = selisihHari(p.due_date, hariIni);
  const kepala =
    sisa < 0
      ? `*${p.id} · LEWAT TENGGAT ${Math.abs(sisa)} HARI*`
      : sisa === 0
        ? `*${p.id} · JATUH TEMPO HARI INI*`
        : `*${p.id} · ${sisa} HARI LAGI*`;

  const potong = (t: string, n: number) => (t.length > n ? t.slice(0, n) + '…' : t);

  return [
    kepala,
    '',
    potong(p.judul, 320),
    '',
    p.tindakan ? `Tindakan: ${potong(p.tindakan, 220)}` : '',
    `Tenggat: ${tanggalIndonesia(p.due_date)} (WITA)`,
    '',
    'Balas salah satu:',
    `• SELESAI ${p.id.slice(-2)} — lalu kirim foto bukti`,
    `• TUNDA ${p.id.slice(-2)} <tgl> <alasan>`,
    `• BANTU ${p.id.slice(-2)} — eskalasi ke supervisor`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function pesanRekap(
  judul: string,
  baris: { id: string; judul: string; due_date: string | null; nama: string; sisa: number }[],
): string {
  if (baris.length === 0) return `*${judul}*\n\nTidak ada item terbuka. Bagus.`;

  const telat = baris.filter((b) => b.sisa < 0);
  const dekat = baris.filter((b) => b.sisa >= 0);

  const tulis = (b: (typeof baris)[number]) =>
    `${b.id.slice(-2)}. ${b.judul.slice(0, 70)}${b.judul.length > 70 ? '…' : ''}\n     ${b.nama} · ${
      b.due_date ? tanggalIndonesia(b.due_date) : 'tanpa tenggat'
    }${b.sisa < 0 ? ` · telat ${Math.abs(b.sisa)}h` : ''}`;

  return [
    `*${judul}*`,
    '',
    telat.length ? `⚠ LEWAT TENGGAT (${telat.length})` : '',
    ...telat.map(tulis),
    telat.length && dekat.length ? '' : '',
    dekat.length ? `BERJALAN (${dekat.length})` : '',
    ...dekat.map(tulis),
    '',
    `Dibuat otomatis oleh POKEMONKEY · ${tanggalIndonesia(tanggalWita())}`,
  ]
    .filter((x) => x !== undefined)
    .join('\n');
}
