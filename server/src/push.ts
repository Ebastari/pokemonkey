/**
 * Web Push — notifikasi di atas layar untuk iPhone (PWA di Layar Utama) dan
 * browser mana pun.
 *
 * APK Android tidak lewat sini: Background Runner di HP menjadwalkan
 * notifikasinya sendiri (pola Smart Nursery), jadi APK tetap berbunyi walau
 * server tidak bisa menjangkau perangkat.
 *
 * Kunci VAPID:
 *   - VAPID_PUBLIC_KEY  : var di wrangler.jsonc (tidak rahasia; dikirim ke aplikasi)
 *   - VAPID_PRIVATE_KEY : secret (`wrangler secret put VAPID_PRIVATE_KEY`)
 *   Buat sepasang dengan: npx web-push generate-vapid-keys
 */

import { buildPushPayload, type PushMessage, type PushSubscription, type VapidKeys } from '@block65/webcrypto-web-push';
import type { Env, Pengguna } from './tipe';
import { beriXp } from './xp';
import { siapkanNotif, acaraPengingat } from './sumber';
import type { Slot } from './ringkasan';
import { sekarangUtcIso, tanggalWita } from './waktu';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}

const vapidDari = (env: Env): VapidKeys | null =>
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY
    ? { subject: env.VAPID_SUBJECT || 'mailto:admin@pokemonkey.local', publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
    : null;

interface BarisLangganan {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  slot: string;
  gagal_berturut: number;
}

/** Isi yang dibaca service worker (public/sw.js). */
interface IsiPush {
  judul: string;
  isi: string;
  tab: string;
  slot: Slot | 'uji';
}

async function kirimSatu(vapid: VapidKeys, row: BarisLangganan, isi: IsiPush): Promise<'ok' | 'hapus' | 'gagal'> {
  const subscription: PushSubscription = {
    endpoint: row.endpoint,
    expirationTime: null,
    keys: { p256dh: row.p256dh, auth: row.auth },
  };
  // Tiga jam: notifikasi pagi yang baru sampai siang hari masih berguna, lewat dari itu tidak.
  const message: PushMessage = { data: JSON.stringify(isi), options: { ttl: 3 * 3600 } };

  try {
    const res = await fetch(row.endpoint, await buildPushPayload(message, subscription, vapid));
    // 404/410 = langganan sudah dicabut perangkat (aplikasi dihapus, izin dicabut, token berganti).
    if (res.status === 404 || res.status === 410) return 'hapus';
    return res.ok ? 'ok' : 'gagal';
  } catch {
    return 'gagal';
  }
}

async function catatHasil(env: Env, row: BarisLangganan, hasil: 'ok' | 'hapus' | 'gagal'): Promise<void> {
  if (hasil === 'hapus' || (hasil === 'gagal' && row.gagal_berturut + 1 >= 5)) {
    await env.DB.prepare('DELETE FROM push_langganan WHERE id = ?1').bind(row.id).run();
  } else if (hasil === 'gagal') {
    await env.DB.prepare('UPDATE push_langganan SET gagal_berturut = gagal_berturut + 1 WHERE id = ?1').bind(row.id).run();
  } else if (row.gagal_berturut > 0) {
    await env.DB.prepare('UPDATE push_langganan SET gagal_berturut = 0 WHERE id = ?1').bind(row.id).run();
  }
}

const slotAktif = (row: BarisLangganan, slot: string): boolean => {
  try { return (JSON.parse(row.slot || '{}') as Record<string, boolean>)[slot] !== false; } catch { return true; }
};

// ============================================================
// Rute
// ============================================================

export async function rutePush(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (jalur === '/api/push/vapid' && req.method === 'GET') {
    return json({ publicKey: env.VAPID_PUBLIC_KEY ?? null, aktif: Boolean(vapidDari(env)) });
  }

  if (jalur === '/api/push/langganan' && req.method === 'POST') {
    const b = (await req.json()) as {
      endpoint?: string; keys?: { p256dh?: string; auth?: string }; platform?: string; slot?: Record<string, boolean>;
    };
    if (!b.endpoint || !b.endpoint.startsWith('https://') || !b.keys?.p256dh || !b.keys?.auth) {
      return json({ galat: 'Data langganan push tidak lengkap.' }, 400);
    }
    await env.DB.prepare(
      `INSERT INTO push_langganan (user_id, endpoint, p256dh, auth, platform, slot, diperbarui)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = ?1, p256dh = ?3, auth = ?4, platform = ?5,
         slot = COALESCE(?6, slot), gagal_berturut = 0, diperbarui = ?7`,
    ).bind(
      pengguna.id, b.endpoint, b.keys.p256dh, b.keys.auth, b.platform ?? null,
      b.slot ? JSON.stringify(b.slot) : null, sekarangUtcIso(),
    ).run();
    await beriXp(env, pengguna, 'notif_aktif', 'sekali', { pelaku: pengguna });
    return json({ ok: true });
  }

  if (jalur === '/api/push/langganan' && req.method === 'DELETE') {
    const b = (await req.json().catch(() => ({}))) as { endpoint?: string };
    if (b.endpoint) {
      await env.DB.prepare('DELETE FROM push_langganan WHERE endpoint = ?1 AND user_id = ?2').bind(b.endpoint, pengguna.id).run();
    }
    return json({ ok: true });
  }

  // Kirim satu push contoh ke semua perangkat milik pemakai ini.
  if (jalur === '/api/push/uji' && req.method === 'POST') {
    const vapid = vapidDari(env);
    if (!vapid) return json({ galat: 'Kunci VAPID belum dipasang di server.' }, 409);
    const { results } = await env.DB.prepare('SELECT * FROM push_langganan WHERE user_id = ?1').bind(pengguna.id).all<BarisLangganan>();
    if (results.length === 0) return json({ galat: 'Perangkat ini belum berlangganan notifikasi.' }, 404);

    let terkirim = 0;
    for (const row of results) {
      const hasil = await kirimSatu(vapid, row, {
        judul: 'Notifikasi POKEMONKEY aktif',
        isi: `Beginilah bentuk pengingat pukul 07.00, 12.00, dan 17.00 WITA. (${tanggalWita()})`,
        tab: 'habitat',
        slot: 'uji',
      });
      await catatHasil(env, row, hasil);
      if (hasil === 'ok') terkirim++;
    }
    return json({ ok: terkirim > 0, terkirim, perangkat: results.length });
  }

  return null;
}

/**
 * Push seketika ke semua perangkat Web Push milik satu orang — hanya untuk surat
 * bertanda Penting di Kotak Surat (surat biasa ikut ringkasan pukul 12.00).
 */
export async function kirimPushLangsung(env: Env, userId: string, isi: { judul: string; isi: string; tab?: string }): Promise<number> {
  const vapid = vapidDari(env);
  if (!vapid) return 0;
  const { results } = await env.DB.prepare('SELECT * FROM push_langganan WHERE user_id = ?1').bind(userId).all<BarisLangganan>();
  let terkirim = 0;
  for (const row of results) {
    const hasil = await kirimSatu(vapid, row, { judul: isi.judul, isi: isi.isi, tab: isi.tab ?? 'habitat', slot: 'uji' });
    await catatHasil(env, row, hasil);
    if (hasil === 'ok') terkirim++;
  }
  return terkirim;
}

// ============================================================
// Pengiriman terjadwal (dipanggil cron)
// ============================================================

/**
 * Kirim notifikasi satu slot ke seluruh pelanggan Web Push.
 * Isi dihitung sekali per orang; `notif_log` memastikan satu orang hanya
 * menerima satu notifikasi per slot per hari walau cron menyentuh slotnya dua kali.
 */
export async function kirimPushTerjadwal(env: Env, slot: Slot, hariIni: string): Promise<{ orang: number; terkirim: number }> {
  const vapid = vapidDari(env);
  if (!vapid) return { orang: 0, terkirim: 0 };

  const { results } = await env.DB.prepare(
    `SELECT l.*, t.nama, t.jabatan, t.bidang, t.wa, t.peran
       FROM push_langganan l JOIN tim t ON t.id = l.user_id
      WHERE t.aktif = 1`,
  ).all<BarisLangganan & Omit<Pengguna, 'id'>>();

  const perOrang = new Map<string, (BarisLangganan & Omit<Pengguna, 'id'>)[]>();
  for (const row of results) {
    if (!slotAktif(row, slot)) continue;
    const daftar = perOrang.get(row.user_id) ?? [];
    daftar.push(row);
    perOrang.set(row.user_id, daftar);
  }

  let orang = 0;
  let terkirim = 0;

  for (const [userId, perangkat] of perOrang) {
    const p = perangkat[0];
    const pengguna: Pengguna = { id: userId, nama: p.nama, jabatan: p.jabatan, bidang: p.bidang, wa: p.wa, peran: p.peran };
    const notif = await siapkanNotif(env, pengguna, slot, hariIni);
    if (!notif.tampil) continue;

    const log = await env.DB.prepare(
      `INSERT OR IGNORE INTO notif_log (user_id, tanggal, slot, kanal) VALUES (?1, ?2, ?3, 'webpush')`,
    ).bind(userId, hariIni, slot).run();
    if (Number((log.meta as Record<string, unknown>)?.changes ?? 0) === 0) continue; // sudah terkirim hari ini

    orang++;
    for (const row of perangkat) {
      const hasil = await kirimSatu(vapid, row, { judul: notif.judul, isi: notif.isi, tab: notif.tab, slot });
      await catatHasil(env, row, hasil);
      if (hasil === 'ok') terkirim++;
    }
  }

  return { orang, terkirim };
}

/**
 * Pengingat acara kalender lewat Web Push.
 *
 * Cron berjalan tiap 15 menit, jadi yang dikirim adalah pengingat yang jatuh
 * temponya sudah lewat sejak putaran sebelumnya — terlambat beberapa menit,
 * tidak pernah terlalu awal. Di APK Android hal ini tidak berlaku: penjadwal di
 * HP memasang alarmnya sendiri tepat pada jamnya.
 */
export async function kirimPushAcara(env: Env, hariIni: string, jendelaMenit = 16): Promise<{ terkirim: number }> {
  const vapid = vapidDari(env);
  if (!vapid) return { terkirim: 0 };

  const { results } = await env.DB.prepare(
    `SELECT l.*, t.nama, t.jabatan, t.bidang, t.wa, t.peran
       FROM push_langganan l JOIN tim t ON t.id = l.user_id
      WHERE t.aktif = 1`,
  ).all<BarisLangganan & Omit<Pengguna, 'id'>>();

  const perOrang = new Map<string, (BarisLangganan & Omit<Pengguna, 'id'>)[]>();
  for (const row of results) {
    if (!slotAktif(row, 'acara')) continue;
    perOrang.set(row.user_id, [...(perOrang.get(row.user_id) ?? []), row]);
  }

  const sekarang = Date.now();
  const batasAwal = sekarang - jendelaMenit * 60_000;
  let terkirim = 0;

  for (const [userId, perangkat] of perOrang) {
    const p = perangkat[0];
    const pengguna: Pengguna = { id: userId, nama: p.nama, jabatan: p.jabatan, bidang: p.bidang, wa: p.wa, peran: p.peran };
    const acara = await acaraPengingat(env, pengguna, hariIni);

    for (const a of acara) {
      const pada = Date.parse(a.ingatkanPada);
      if (pada > sekarang + 120_000 || pada < batasAwal) continue;

      const log = await env.DB.prepare(
        `INSERT OR IGNORE INTO notif_log (user_id, tanggal, slot, kanal) VALUES (?1, ?2, ?3, 'webpush')`,
      ).bind(userId, hariIni, `acara:${a.kunci}`).run();
      if (Number((log.meta as Record<string, unknown>)?.changes ?? 0) === 0) continue;

      for (const row of perangkat) {
        const hasil = await kirimSatu(vapid, row, { judul: a.judul, isi: a.isi, tab: a.tab, slot: 'acara' as Slot });
        await catatHasil(env, row, hasil);
        if (hasil === 'ok') terkirim++;
      }
    }
  }

  return { terkirim };
}
