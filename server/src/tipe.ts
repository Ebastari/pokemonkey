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
  /** Rahasia — Google Gemini AI API Key untuk asisten tulisan PICA dan Resume */
  GEMINI_API_KEY?: string;
  /** Kunci enkripsi isi memo Rahasia (dipasang sendiri: `wrangler secret put KUNCI_RAHASIA_MEMO`). */
  KUNCI_RAHASIA_MEMO?: string;
  /** Model Gemini per tingkat (opsional, dipisah koma): cepat = rapikan/ringkas/teks terpilih, kuat = kembangkan/tugas/tulis. */
  GEMINI_MODEL_CEPAT?: string;
  GEMINI_MODEL_KUAT?: string;
  /** Batas permintaan AI per orang per hari (bawaan 60; Admin/SPV ×3, Pemantau ÷3). */
  AI_BATAS_HARIAN?: string;
  /** Alamat publik Worker, untuk tautan papan PICA hanya-baca di rekap WA. */
  ALAMAT_PUBLIK?: string;
  /** Binding D1 hanya-baca langsung ke data lapangan (satu akun Cloudflare) */
  NURSERY_DB?: D1Database;
  GEOTAG_DB?: D1Database;
  /** Kunci dan URL fallback bila binding D1 lokal belum tersinkron */
  NURSERY_API_KEY?: string;
  NURSERY_API_URL?: string;
  GEOTAG_KEY?: string;
  GEOTAG_URL?: string;
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
