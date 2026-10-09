/**
 * Buku besar XP di mode demo — tiruan server/src/xp.ts memakai aturan murni yang
 * sama (server/src/xp-aturan.ts), disimpan di database demo (localStorage).
 * XP yang didapat pemakai demo dikumpulkan lalu dikabarkan oleh lib/api.ts,
 * sama seperti header X-XP dari server.
 */

import { GalatApi } from './galat';
import { hariIniWita, geserHari } from './waktu';
import {
  ATURAN_XP, HARGA_SKIN, hariKerjaRoster, hitungXp, kemajuanLevel, levelDari, meterHarian, nilaiKeaktifan,
  semesterDari, wilayahUntuk, type SumberXp,
} from '../server/src/xp-aturan';
import type { KabarXp } from './xp';

type Baris = Record<string, any>;

/** Bagian database demo yang dipakai buku besar XP. */
export interface DbXp {
  xpLog: Baris[];
  profil: Record<string, Baris>;
  tim: Baris[];
  roster: Baris[];
  urut: number;
}

let kabar: KabarXp | null = null;

/** XP yang didapat pemakai demo selama satu permintaan; diambil (dan dikosongkan) oleh lib/api.ts. */
export function ambilKabarDemo(): KabarXp | null {
  const k = kabar;
  kabar = null;
  return k;
}

const gagal = (pesan: string, status = 400): never => { throw new GalatApi(pesan, status); };

const skinDari = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  try { const a = JSON.parse(String(v || '["classic"]')); return Array.isArray(a) ? a.map(String) : ['classic']; } catch { return ['classic']; }
};

function profilDari(d: DbXp, id: string): Baris {
  if (!d.profil[id]) d.profil[id] = { user_id: id, xp: 0, level: 1, xp_terpakai: 0, skin_aktif: 'classic', skin_dimiliki: ['classic'], luas_tanam: 0 };
  const p = d.profil[id];
  p.xp_terpakai = Number(p.xp_terpakai ?? 0);
  return p;
}

/** Sama dengan beriXp() di server. `sayaId` = pemakai demo yang sedang memakai aplikasi. */
export function beriXpDemo(d: DbXp, penerimaId: string | null | undefined, sumber: SumberXp, ref: string, sayaId: string, nilai?: number): number {
  if (!penerimaId || !ref) return 0;
  if (!Array.isArray(d.xpLog)) d.xpLog = [];
  const kunciRef = ref.slice(0, 160);
  if (d.xpLog.some((r) => r.user_id === penerimaId && r.sumber === sumber && r.ref === kunciRef)) return 0;
  const hari = hariIniWita();
  const hariIni = d.xpLog.filter((r) => r.user_id === penerimaId && r.sumber === sumber && r.hari === hari && !r.dibatalkan_pada);
  const aturan = ATURAN_XP[sumber];
  const xp = hitungXp(aturan, { jumlah: hariIni.length, xp: hariIni.reduce((n, r) => n + Number(r.xp), 0) }, nilai);
  if (xp <= 0) return 0;
  const peran = d.tim.find((t) => t.id === penerimaId)?.peran ?? null;
  d.xpLog.push({
    id: ++d.urut, user_id: penerimaId, sumber, ref: kunciRef, xp, wilayah: wilayahUntuk(aturan, peran), hari,
    pada: new Date().toISOString(), catatan: null, dibatalkan_pada: null,
  });
  const p = profilDari(d, penerimaId);
  p.xp = Number(p.xp ?? 0) + xp;
  const lama = Number(p.level ?? 1);
  p.level = Math.max(lama, levelDari(p.xp));
  if (penerimaId === sayaId) {
    const k = kabar ?? { tambah: 0, total: 0, level: 1, naik: false, rincian: [] };
    k.tambah += xp;
    k.total = p.xp;
    k.level = p.level;
    k.naik = k.naik || p.level > lama;
    k.rincian.push({ sumber, xp, label: aturan.label });
    kabar = k;
  }
  return xp;
}

/** Skin Prestasi yang baru terbuka untuk pemakai demo: ikut dikabarkan seperti header X-XP. */
export function kabarPrestasiDemo(skin: string[]): void {
  if (!skin.length) return;
  const k = kabar ?? { tambah: 0, total: 0, level: 1, naik: false, rincian: [] };
  k.prestasi = [...(k.prestasi ?? []), ...skin];
  kabar = k;
}

/** Skin dari aplikasi: yang baru hanya diterima bila saldo cukup (sama dengan sahkanSkin di server). */
export function sahkanSkinDemo(d: DbXp, id: string, diminta: unknown): string[] {
  const p = profilDari(d, id);
  const milik = skinDari(p.skin_dimiliki);
  let saldo = Number(p.xp ?? 0) - Number(p.xp_terpakai);
  for (const s of skinDari(diminta)) {
    if (milik.includes(s)) continue;
    const harga = HARGA_SKIN[s];
    if (harga === undefined || harga > saldo) continue;
    milik.push(s);
    saldo -= harga;
    p.xp_terpakai += harga;
  }
  return milik;
}

function skor(d: DbXp) {
  const hariIni = hariIniWita();
  const kemarin = geserHari(hariIni, -1);
  const awal7 = geserHari(hariIni, -7);
  const awalXp7 = geserHari(hariIni, -6);
  const semester = semesterDari(hariIni);
  const anggota = d.tim.filter((t) => t.aktif !== 0 && t.peran !== 'pemantau').map((t) => {
    const p = d.profil[t.id];
    const wilayahPerHari = new Map<string, Set<string>>();
    let xp7 = 0;
    for (const r of d.xpLog ?? []) {
      if (r.user_id !== t.id || r.dibatalkan_pada) continue;
      let w = wilayahPerHari.get(r.hari);
      if (!w) { w = new Set(); wilayahPerHari.set(r.hari, w); }
      w.add(r.wilayah);
      if (r.hari >= awalXp7) xp7 += Number(r.xp);
    }
    const kerja = d.roster.filter((r) => r.user_id === t.id && hariKerjaRoster(r.kode)).map((r) => String(r.tanggal));
    const xp = Number(p?.xp ?? 0);
    const lv = kemajuanLevel(xp, Number(p?.level ?? 1));
    return {
      id: t.id, nama: t.nama, jabatan: t.jabatan ?? null, peran: t.peran,
      xp, level: lv.level, xpDiLevel: lv.di, xpButuh: lv.butuh, saldo: xp - Number(p?.xp_terpakai ?? 0), xp7,
      meterHariIni: meterHarian(wilayahPerHari.get(hariIni) ?? []),
      wilayahHariIni: [...(wilayahPerHari.get(hariIni) ?? [])],
      hariIniKerja: kerja.includes(hariIni),
      skor7: nilaiKeaktifan(kerja.filter((h) => h >= awal7 && h <= kemarin), wilayahPerHari),
      kpi: nilaiKeaktifan(kerja.filter((h) => h >= semester.dari && h <= kemarin), wilayahPerHari),
    };
  }).sort((a, b) => String(a.nama).localeCompare(String(b.nama)));
  return { hariIni, semester, anggota };
}

const ringkasProfil = (p: Baris) => ({
  xp: Number(p.xp ?? 0), level: Number(p.level ?? 1), xp_terpakai: Number(p.xp_terpakai ?? 0),
  saldo: Number(p.xp ?? 0) - Number(p.xp_terpakai ?? 0), skin_dimiliki: skinDari(p.skin_dimiliki), skin_aktif: p.skin_aktif ?? 'classic',
});

/** Rute /api/xp/* di mode demo; null bila bukan miliknya. */
export function ruteXpDemo(d: DbXp, path: string, method: string, body: any, q: URLSearchParams, saya: { id: string; peran: string }): unknown | null {
  if (!path.startsWith('/api/xp')) return null;
  const kelola = saya.peran === 'admin' || saya.peran === 'supervisor';

  if (path === '/api/xp/riwayat' && method === 'GET') {
    const user = q.get('user') || saya.id;
    if (user !== saya.id && !kelola) gagal('Riwayat XP orang lain hanya untuk Admin/Supervisor.', 403);
    const hari = Math.min(186, Math.max(1, Number(q.get('hari')) || 30));
    const dari = geserHari(hariIniWita(), -(hari - 1));
    const riwayat = (d.xpLog ?? []).filter((r) => r.user_id === user && r.hari >= dari)
      .sort((a, b) => b.id - a.id).slice(0, 500)
      .map((r) => ({ ...r, label: (ATURAN_XP as Record<string, { label: string }>)[r.sumber]?.label ?? r.sumber, menu: (ATURAN_XP as Record<string, { menu: string }>)[r.sumber]?.menu ?? '' }));
    return { riwayat };
  }
  if (path === '/api/xp/skor' && method === 'GET') return skor(d);
  if (path === '/api/xp/main' && method === 'POST') {
    if (body?.jenis !== 'pisang' && body?.jenis !== 'monkey_run') gagal('Jenis tidak dikenal.');
    const ref = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    const xp = beriXpDemo(d, saya.id, body.jenis, ref, saya.id, body.jenis === 'monkey_run' ? Math.max(0, Math.floor(Number(body.nilai) || 0)) : undefined);
    return { xp, profil: ringkasProfil(profilDari(d, saya.id)) };
  }
  if (path === '/api/xp/klaim' && method === 'POST') {
    if (body?.sumber !== 'notif_aktif') gagal('Hadiah ini tidak bisa diklaim dari aplikasi.');
    return { xp: beriXpDemo(d, saya.id, 'notif_aktif', 'sekali', saya.id) };
  }
  if (path === '/api/xp/beli-skin' && method === 'POST') {
    const skin = String(body?.skin ?? '');
    const harga = HARGA_SKIN[skin];
    if (harga === undefined) gagal('Skin tidak dikenal.');
    const p = profilDari(d, saya.id);
    const milik = skinDari(p.skin_dimiliki);
    if (!milik.includes(skin)) {
      if (Number(p.xp ?? 0) - Number(p.xp_terpakai) < harga) gagal('Saldo XP tidak cukup.', 409);
      milik.push(skin);
      p.xp_terpakai += harga;
    }
    p.skin_dimiliki = milik;
    p.skin_aktif = skin;
    return { ok: true, profil: ringkasProfil(p) };
  }
  if (path === '/api/xp/batal' && method === 'POST') {
    if (!kelola) gagal('Hanya Admin/Supervisor yang boleh membatalkan XP.', 403);
    const alasan = String(body?.alasan ?? '').trim();
    if (alasan.length < 5) gagal('Tulis alasan pembatalan (paling sedikit 5 huruf).');
    const r = (d.xpLog ?? []).find((x) => x.id === Number(body?.id));
    if (!r) gagal('Baris XP tidak ditemukan.', 404);
    if (!r!.dibatalkan_pada) {
      r!.dibatalkan_pada = new Date().toISOString();
      r!.dibatalkan_oleh = saya.id;
      r!.alasan_batal = alasan.slice(0, 200);
      const p = profilDari(d, r!.user_id);
      p.xp = Math.max(0, Number(p.xp ?? 0) - Number(r!.xp));
    }
    return { ok: true };
  }
  if (path === '/api/xp/hitung-ulang') gagal('Hitung ulang riwayat hanya ada di server sungguhan, bukan mode demo.', 409);
  return null;
}
