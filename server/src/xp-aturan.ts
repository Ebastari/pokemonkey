/**
 * Aturan XP & Nilai Keaktifan — murni (tanpa akses tabel), dipakai server
 * (server/src/xp.ts) dan mode demo (lib/demo.ts). Penjelasan lengkap:
 * docs/sistem-xp.md. Mengubah angka di sini = mengubah KPI; catat di dokumen itu.
 */

export type Wilayah = 'tindak' | 'lapor' | 'koordinasi' | 'hadir' | 'main' | 'bonus' | 'warisan';

/** Wilayah yang membentuk Meter Aktif Harian (dan KPI) beserta bobotnya; jumlahnya 100. */
export const BOBOT_WILAYAH = { tindak: 40, lapor: 30, koordinasi: 20, hadir: 10 } as const;
export type WilayahMeter = keyof typeof BOBOT_WILAYAH;
export const WILAYAH_METER = Object.keys(BOBOT_WILAYAH) as WilayahMeter[];

export const LABEL_WILAYAH: Record<WilayahMeter, string> = {
  tindak: 'Tindak lanjut', lapor: 'Lapor', koordinasi: 'Koordinasi', hadir: 'Hadir',
};

export interface AturanXp {
  /** XP dasar satu kejadian. */
  xp: number;
  wilayah: Wilayah;
  /** Wilayah untuk Admin/Supervisor bila berbeda (laporan administrasi = Lapor). */
  wilayahPengelola?: Wilayah;
  /** Paling banyak berapa kejadian per hari WITA. */
  batas?: number;
  /** Pengali kejadian ke-1, ke-2, … dalam sehari (yang terakhir berlaku seterusnya). */
  bertahap?: number[];
  /** Paling banyak berapa XP per hari dari sumber ini (untuk nilai yang dikirim, mis. Monkey Run). */
  batasXp?: number;
  menu: string;
  label: string;
}

export const ATURAN_XP = {
  hadir: { xp: 20, wilayah: 'hadir', batas: 1, menu: 'KEBUN', label: 'Hadir di aplikasi' },

  pica_buat: { xp: 80, wilayah: 'tindak', batas: 5, menu: 'PICA', label: 'Mencatat PICA' },
  pica_mulai: { xp: 40, wilayah: 'tindak', menu: 'PICA', label: 'Mulai mengerjakan PICA' },
  pica_update: { xp: 120, wilayah: 'tindak', batas: 5, menu: 'PICA', label: 'Update progres PICA' },
  pica_bukti: { xp: 80, wilayah: 'tindak', batas: 5, menu: 'PICA', label: 'Unggah bukti PICA' },
  pica_ajukan: { xp: 100, wilayah: 'tindak', menu: 'PICA', label: 'Ajukan verifikasi PICA' },
  pica_tutup: { xp: 600, wilayah: 'tindak', menu: 'PICA', label: 'PICA ditutup' },
  pica_tepat_waktu: { xp: 200, wilayah: 'tindak', menu: 'PICA', label: 'PICA selesai tepat waktu' },
  pica_verifikasi: { xp: 150, wilayah: 'tindak', batas: 5, menu: 'PICA', label: 'Verifikasi & tutup PICA' },

  laporan_kirim: { xp: 250, wilayah: 'lapor', batas: 3, bertahap: [1, 0.5], menu: 'FEED', label: 'Laporan lapangan' },
  laporan_foto: { xp: 100, wilayah: 'lapor', batas: 3, menu: 'FEED', label: 'Foto laporan' },
  laporan_foto_susulan: { xp: 50, wilayah: 'lapor', batas: 3, menu: 'LOG', label: 'Melengkapi foto laporan' },
  laporan_pagi: { xp: 50, wilayah: 'lapor', batas: 1, menu: 'FEED', label: 'Lapor sebelum 12.00' },
  laporan_capaian: { xp: 50, wilayah: 'lapor', batas: 3, menu: 'FEED', label: 'Capaian dicatat' },
  laporan_pica: { xp: 50, wilayah: 'tindak', batas: 3, menu: 'FEED', label: 'Laporan tertaut PICA' },

  titik_cek: { xp: 80, wilayah: 'tindak', batas: 5, menu: 'FIRE', label: 'Memeriksa titik api' },
  titik_pertama: { xp: 120, wilayah: 'tindak', menu: 'FIRE', label: 'Pemeriksa pertama titik api' },
  karhutla_laporan: { xp: 400, wilayah: 'tindak', menu: 'FIRE', label: 'Laporan karhutla' },
  karhutla_kirim: { xp: 50, wilayah: 'tindak', menu: 'FIRE', label: 'Laporan karhutla dikirim' },

  jadwal_buat: { xp: 15, wilayah: 'koordinasi', batas: 3, menu: 'JADWAL', label: 'Membuat acara' },
  jadwal_selesai: { xp: 40, wilayah: 'tindak', batas: 5, menu: 'JADWAL', label: 'Acara/tugas selesai' },

  memo_tulis: { xp: 40, wilayah: 'koordinasi', batas: 2, menu: 'MEMO', label: 'Menulis memo' },
  memo_ceklis: { xp: 30, wilayah: 'tindak', batas: 5, menu: 'MEMO', label: 'Tugas memo selesai' },
  memo_komentar: { xp: 20, wilayah: 'koordinasi', batas: 5, menu: 'MEMO', label: 'Berkomentar di memo' },
  dokumen_buat: { xp: 100, wilayah: 'koordinasi', wilayahPengelola: 'lapor', batas: 2, menu: 'MEMO', label: 'Dokumen formal' },
  dokumen_unggah: { xp: 30, wilayah: 'lapor', batas: 3, menu: 'MEMO', label: 'Unggah ke Folder Dokumen' },
  formulir_isi: { xp: 40, wilayah: 'lapor', batas: 5, menu: 'MEMO', label: 'Mengisi formulir' },
  pesan_kirim: { xp: 15, wilayah: 'koordinasi', batas: 3, menu: 'SURAT', label: 'Mengirim pesan' },

  info_baca: { xp: 20, wilayah: 'koordinasi', menu: 'INFO', label: 'Membaca pengumuman' },
  info_buat: { xp: 50, wilayah: 'koordinasi', wilayahPengelola: 'lapor', batas: 2, menu: 'INFO', label: 'Membuat pengumuman' },

  roster_tim: { xp: 200, wilayah: 'koordinasi', wilayahPengelola: 'lapor', menu: 'ROSTER', label: 'Roster bulan depan terisi' },
  rab_ajukan: { xp: 150, wilayah: 'koordinasi', wilayahPengelola: 'lapor', menu: 'MONEY', label: 'RAB diajukan' },

  profil_foto: { xp: 100, wilayah: 'bonus', menu: 'TEAM', label: 'Foto profil terpasang' },
  notif_aktif: { xp: 100, wilayah: 'bonus', menu: 'NOTIF', label: 'Notifikasi HP aktif' },
  quest_selesai: { xp: 300, wilayah: 'bonus', menu: 'QUEST', label: 'Misi tim selesai' },

  pisang: { xp: 10, wilayah: 'main', batas: 15, menu: 'KEBUN', label: 'Pisang' },
  monkey_run: { xp: 0, wilayah: 'main', batasXp: 200, menu: 'GAME', label: 'Monkey Run' },

  warisan: { xp: 0, wilayah: 'warisan', menu: '—', label: 'XP sebelum sistem baru' },
} satisfies Record<string, AturanXp>;

export type SumberXp = keyof typeof ATURAN_XP;

export const adalahSumber = (s: unknown): s is SumberXp => typeof s === 'string' && Object.prototype.hasOwnProperty.call(ATURAN_XP, s);

export const pengelola = (peran: string | null | undefined) => peran === 'admin' || peran === 'supervisor';

export function wilayahUntuk(aturan: AturanXp, peran: string | null | undefined): Wilayah {
  return pengelola(peran) && aturan.wilayahPengelola ? aturan.wilayahPengelola : aturan.wilayah;
}

/**
 * XP untuk satu kejadian, sesudah batas harian.
 * `sudah` = kejadian dan XP dari sumber yang sama pada hari ini (sebelum yang ini).
 * `nilai` mengganti XP dasar (mis. pengumuman penting, skor Monkey Run).
 */
export function hitungXp(aturan: AturanXp, sudah: { jumlah: number; xp: number }, nilai?: number): number {
  if (aturan.batas !== undefined && sudah.jumlah >= aturan.batas) return 0;
  const dasar = Math.max(0, Math.floor(nilai ?? aturan.xp));
  const kali = aturan.bertahap ? aturan.bertahap[Math.min(sudah.jumlah, aturan.bertahap.length - 1)] : 1;
  let xp = Math.floor(dasar * kali);
  if (aturan.batasXp !== undefined) xp = Math.max(0, Math.min(xp, aturan.batasXp - sudah.xp));
  return xp;
}

// ---------------------------------------------------------------------------
// Level
// ---------------------------------------------------------------------------

/** XP yang dibutuhkan untuk naik dari level L ke L+1. */
export const xpNaikLevel = (level: number) => 1000 + 200 * (level - 1);

/** Level menurut rumus dari XP total (tanpa aturan "tidak pernah turun"). */
export function levelDari(xp: number): number {
  let level = 1;
  let sisa = Math.max(0, xp);
  while (sisa >= xpNaikLevel(level) && level < 999) {
    sisa -= xpNaikLevel(level);
    level += 1;
  }
  return level;
}

/** Posisi di level: XP yang sudah terkumpul di level ini dan yang dibutuhkan untuk naik. */
export function kemajuanLevel(xp: number, levelTersimpan = 1): { level: number; di: number; butuh: number } {
  const level = Math.max(levelTersimpan, levelDari(xp));
  let sebelum = 0;
  for (let l = 1; l < level; l++) sebelum += xpNaikLevel(l);
  const butuh = xpNaikLevel(level);
  return { level, di: Math.max(0, Math.min(butuh, xp - sebelum)), butuh };
}

// ---------------------------------------------------------------------------
// Meter Aktif Harian & Nilai Keaktifan
// ---------------------------------------------------------------------------

export const KODE_BUKAN_KERJA = ['OFF', 'FB', 'IK', 'L', 'C', 'I'];
export const hariKerjaRoster = (kode: string | null | undefined) => Boolean(kode) && !KODE_BUKAN_KERJA.includes(String(kode).toUpperCase());

/** Jumlah bobot wilayah yang tersentuh (0–100). Wilayah main/bonus/warisan diabaikan. */
export function meterHarian(wilayah: Iterable<string>): number {
  const kena = new Set<string>();
  for (const w of wilayah) if (w in BOBOT_WILAYAH) kena.add(w);
  let n = 0;
  for (const w of kena) n += BOBOT_WILAYAH[w as WilayahMeter];
  return n;
}

export interface NilaiKeaktifan {
  /** Rata-rata meter pada hari kerja (0–100), null bila tidak ada hari kerja di roster. */
  nilai: number | null;
  hariKerja: number;
  /** Persentase hari kerja yang menyentuh tiap wilayah. */
  perWilayah: Record<WilayahMeter, number>;
}

/**
 * Nilai keaktifan atas sekumpulan hari kerja.
 * `wilayahPerHari` = wilayah yang tersentuh per tanggal (hanya baris XP yang tidak dibatalkan).
 */
export function nilaiKeaktifan(hariKerja: readonly string[], wilayahPerHari: ReadonlyMap<string, ReadonlySet<string>>): NilaiKeaktifan {
  const perWilayah = { tindak: 0, lapor: 0, koordinasi: 0, hadir: 0 } as Record<WilayahMeter, number>;
  if (hariKerja.length === 0) return { nilai: null, hariKerja: 0, perWilayah };
  let total = 0;
  for (const h of hariKerja) {
    const w = wilayahPerHari.get(h) ?? new Set<string>();
    total += meterHarian(w);
    for (const k of WILAYAH_METER) if (w.has(k)) perWilayah[k] += 1;
  }
  for (const k of WILAYAH_METER) perWilayah[k] = Math.round((perWilayah[k] / hariKerja.length) * 100);
  return { nilai: Math.round((total / hariKerja.length) * 10) / 10, hariKerja: hariKerja.length, perWilayah };
}

/** Semester berjalan: Januari–Juni atau Juli–Desember. */
export function semesterDari(tanggal: string): { dari: string; sampai: string; label: string } {
  const tahun = tanggal.slice(0, 4);
  const awal = Number(tanggal.slice(5, 7)) <= 6;
  return awal
    ? { dari: `${tahun}-01-01`, sampai: `${tahun}-06-30`, label: `Semester 1 ${tahun}` }
    : { dari: `${tahun}-07-01`, sampai: `${tahun}-12-31`, label: `Semester 2 ${tahun}` };
}

// ---------------------------------------------------------------------------
// Hitung ulang riwayat lama dengan aturan baru
// ---------------------------------------------------------------------------

/** Waktu dari tabel ('2026-09-15 02:00:00' bawaan SQLite = UTC, atau ISO) → ISO UTC. */
export function isoDari(waktu: string): string {
  const w = String(waktu ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(w)) return `${w.replace(' ', 'T')}${w.length === 16 ? ':00' : ''}Z`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(w)) return `${w}T00:00:00Z`;
  return w;
}

/** Tanggal WITA (UTC+8) dari waktu tabel. */
export function hariWitaDari(waktu: string): string {
  const ms = Date.parse(isoDari(waktu));
  if (Number.isNaN(ms)) return String(waktu).slice(0, 10);
  return new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10);
}

export interface KejadianXp {
  user: string;
  sumber: SumberXp;
  /** Sama persis dengan ref yang dipakai pencatatan langsung, supaya tidak pernah ganda. */
  ref: string;
  pada: string;
  nilai?: number;
  catatan?: string;
}

export interface BarisXpBaru {
  user_id: string; sumber: SumberXp; ref: string; xp: number; wilayah: Wilayah; hari: string; pada: string; catatan: string | null;
}

/**
 * Kejadian lama → baris XP, diurut menurut waktu dan memakai batas harian yang
 * sama dengan pencatatan langsung. `sudahAda` = kunci "user|sumber|ref" yang sudah
 * tercatat (hitung ulang aman diulang). Bila `hadirDariAktivitas`, hari yang punya
 * aktivitas kerja dianggap hadir (riwayat membuka aplikasi tidak tersimpan).
 */
export function susunRiwayatXp(
  kejadian: readonly KejadianXp[],
  peranDari: (id: string) => string | null | undefined,
  sudahAda: ReadonlySet<string> = new Set(),
  opsi: { hadirDariAktivitas?: boolean } = {},
): BarisXpBaru[] {
  const hasil: BarisXpBaru[] = [];
  const kunci = new Set(sudahAda);
  const hitung = new Map<string, { jumlah: number; xp: number }>();

  const tambah = (k: KejadianXp) => {
    const kunciRef = `${k.user}|${k.sumber}|${k.ref}`;
    if (!k.user || kunci.has(kunciRef)) return;
    const aturan: AturanXp = ATURAN_XP[k.sumber];
    const pada = isoDari(k.pada);
    const hari = hariWitaDari(pada);
    const kunciHari = `${k.user}|${k.sumber}|${hari}`;
    const sudah = hitung.get(kunciHari) ?? { jumlah: 0, xp: 0 };
    const xp = hitungXp(aturan, sudah, k.nilai);
    if (xp <= 0) return;
    kunci.add(kunciRef);
    hitung.set(kunciHari, { jumlah: sudah.jumlah + 1, xp: sudah.xp + xp });
    hasil.push({ user_id: k.user, sumber: k.sumber, ref: k.ref, xp, wilayah: wilayahUntuk(aturan, peranDari(k.user)), hari, pada, catatan: k.catatan ?? null });
  };

  [...kejadian].sort((a, b) => isoDari(a.pada).localeCompare(isoDari(b.pada))).forEach(tambah);

  if (opsi.hadirDariAktivitas) {
    const hariAktif = new Map<string, string>();
    for (const r of hasil) {
      if (!(r.wilayah in BOBOT_WILAYAH) || r.wilayah === 'hadir') continue;
      const k = `${r.user_id}|${r.hari}`;
      const ada = hariAktif.get(k);
      if (!ada || r.pada < ada) hariAktif.set(k, r.pada);
    }
    for (const [k, pada] of hariAktif) {
      const [user, hari] = k.split('|');
      tambah({ user, sumber: 'hadir', ref: hari, pada, catatan: 'dari aktivitas tercatat' });
    }
  }
  return hasil;
}

/**
 * Konversi satu akun ke sistem baru. XP lama sudah dikurangi belanja skin, jadi
 * XP kotor lama = XP lama + harga skin yang dimiliki. Sisa yang tidak terbentuk
 * dari riwayat (pisang, Monkey Run, misi lama…) menjadi "warisan", sehingga
 * XP total dan saldo tidak pernah berkurang.
 */
export function konversiAkun(o: { xpLama: number; skinLama: readonly string[]; riwayat: number }): { warisan: number; total: number; terpakai: number; saldo: number } {
  const terpakai = [...new Set(o.skinLama)].reduce((n, s) => n + (HARGA_SKIN[s] ?? 0), 0);
  const kotorLama = Math.max(0, o.xpLama) + terpakai;
  const riwayat = Math.max(0, o.riwayat);
  const warisan = Math.max(0, kotorLama - riwayat);
  const total = riwayat + warisan;
  return { warisan, total, terpakai, saldo: total - terpakai };
}

// ---------------------------------------------------------------------------
// SHOP
// ---------------------------------------------------------------------------

/** Harga skin dalam XP — harus sama dengan SKINS di constants.ts (diuji). */
export const HARGA_SKIN: Record<string, number> = {
  classic: 0, military: 3000, manager: 4500, botanist: 6000, astro: 9000, cyber: 12000, samurai: 14000,
  fire: 16000, ice: 18000, money: 20000, shadow: 22000, golden: 24000, king: 28000, phoenix: 35000,
  dragon: 42000, diamond: 50000, legend: 75000,
};
