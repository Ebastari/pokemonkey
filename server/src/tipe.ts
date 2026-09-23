export interface Env {
  DB: D1Database;
  BUKET: R2Bucket;
  APP_NAMA: string;
  TZ_OFFSET_MENIT: string;
  /** Rahasia — diisi lewat `wrangler secret put`, tidak pernah masuk kode atau APK. */
  FONNTE_TOKEN?: string;
  WEBHOOK_KUNCI?: string;
  /** Kode yang dibagikan Admin agar anggota bisa membuat password saat login pertama. */
  KODE_UNDANGAN?: string;
  /** Web Push: kontak pengirim (mailto:…), kunci publik (var), kunci privat (secret). */
  VAPID_SUBJECT?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /** Rahasia — MAP_KEY NASA FIRMS untuk pemantauan titik api. */
  FIRMS_MAP_KEY?: string;
  /** Alamat publik Worker, untuk tautan papan PICA hanya-baca di rekap WA. */
  ALAMAT_PUBLIK?: string;
}

export type Peran = 'admin' | 'supervisor' | 'anggota' | 'pemantau';

export interface Pengguna {
  id: string;
  nama: string;
  jabatan: string | null;
  bidang: string | null;
  wa: string | null;
  peran: Peran;
  /** Kunci berkas foto profil di R2 (lihat dokumen.ts), null bila belum ada. */
  foto?: string | null;
}

export interface Pica {
  id: string;
  nomor: number;
  periode_id: string | null;
  bidang: string;
  prioritas: string;
  judul: string;
  akar: string | null;
  tindakan: string | null;
  pic_id: string | null;
  due_date: string | null;
  status: string;
  terkait_id: string | null;
  target: number | null;
  realisasi: number | null;
  satuan: string | null;
  terkunci: number;
  props: string;
  ditutup_pada: string | null;
  dibuat_pada: string;
}
