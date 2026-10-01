/** Bentuk data yang dikirim server POKEMONKEY (server/src). */

export type Peran = 'admin' | 'supervisor' | 'anggota' | 'pemantau';

export interface Pengguna {
  id: string;
  nama: string;
  jabatan: string | null;
  bidang: string | null;
  wa: string | null;
  peran: Peran;
  /** Kunci berkas foto profil di server, null bila belum ada. */
  foto?: string | null;
}

export interface Opsi {
  grup: 'bidang' | 'prioritas' | 'status' | 'satuan' | string;
  nilai: string;
  label: string;
  warna: string | null;
  urutan: number;
}

export interface Properti {
  id: string;
  label: string;
  /** 'orang' (id anggota tim) dan 'lokasi' (Google Maps) hanya dipakai kolom memo. */
  tipe: 'teks' | 'angka' | 'tanggal' | 'select' | 'checkbox' | 'url' | 'orang' | 'lokasi';
  opsi_json: string | null;
  urutan: number;
  tampil_di_tabel: number;
  /** 'pica' (bawaan) atau 'memo'. */
  entitas?: string;
}

export interface Periode {
  id: string;
  mulai: string;
  selesai: string;
  judul: string | null;
  sumber: string | null;
  terkunci: number;
}

export interface AnggotaRingkas {
  id: string;
  nama: string;
  jabatan: string | null;
  bidang: string | null;
  peran: Peran;
  /** Kunci berkas foto profil (diambil lewat ambilBerkas), null bila belum ada. */
  foto?: string | null;
}

export interface Bootstrap {
  pengguna: Pengguna;
  opsi: Opsi[];
  properti: Properti[];
  /** Kolom kustom memo; kosong/tidak ada di server lama. */
  propertiMemo?: Properti[];
  tim: AnggotaRingkas[];
  periode: Periode[];
  pengaturan: Record<string, string>;
  hariIni: string;
}

export interface PicaItem {
  id: string;
  nomor: number;
  /** Nomor berjalan sepanjang waktu (migrasi 0021), tampil sebagai PICA-001. */
  no_urut?: number | null;
  periode_id: string | null;
  bidang: string;
  prioritas: string;
  judul: string;
  /** Pokok pekerjaan untuk rekap WhatsApp; kosong = dipotong otomatis dari judul. */
  judul_singkat?: string | null;
  akar: string | null;
  tindakan: string | null;
  pic_id: string | null;
  pic_nama: string | null;
  due_date: string | null;
  status: string;
  terkait_id: string | null;
  target: number | null;
  realisasi: number | null;
  satuan: string | null;
  terkunci: number;
  props: Record<string, unknown>;
  sisa_hari: number | null;
  dibuat_pada: string;
  update_terakhir?: string | null;
  update_terakhir_pada?: string | null;
  jumlah_lampiran?: number;
}

export interface RiwayatPica {
  id: number;
  kolom: string;
  nilai_lama: string | null;
  nilai_baru: string | null;
  alasan: string | null;
  oleh_nama: string | null;
  pada: string;
}

export interface UpdatePica {
  id: number;
  catatan: string;
  realisasi: number | null;
  oleh_nama: string | null;
  pada: string;
}

export interface Lampiran {
  id: string;
  kunci_r2: string;
  nama: string | null;
  tipe_mime: string | null;
  ukuran: number | null;
  pada: string;
}

export interface Pengumuman {
  id: string;
  judul: string;
  isi: string;
  penting: number;
  kirim_wa: number;
  oleh_nama: string | null;
  dibuat_pada: string;
  jumlah_baca: number;
  sudah_baca: number;
}

export interface JadwalItem {
  id: string;
  judul: string;
  keterangan: string | null;
  tanggal: string;
  /** NULL = satu hari. */
  tanggal_selesai: string | null;
  jam_mulai: string | null;
  jam_selesai: string | null;
  jenis: 'rencana' | 'rapat' | 'tenggat';
  pica_id: string | null;
  pemilik_id: string | null;
  pemilik_nama: string | null;
  selesai: number;
  /** Menit sebelum acara untuk pengingat; NULL = tidak diingatkan. */
  ingatkan_menit?: number | null;
  rrule?: string | null;
}

export interface TenggatKalender {
  id: string;
  judul: string;
  due_date: string;
  status: string;
  pic_nama: string | null;
}

export interface AnggotaTim {
  id: string;
  nama: string;
  jabatan: string | null;
  bidang: string | null;
  peran: Peran;
  punya_wa: number;
  pica_terbuka: number;
  pica_telat: number;
  xp: number;
  foto?: string | null;
}

/** Misi dari server; App mengubahnya ke bentuk `Mission` yang dipakai layar QUEST. */
export interface MisiServer {
  id: string;
  judul: string | null;
  tipe: string;
  deskripsi: string | null;
  target: number;
  satuan: string;
  xp: number;
  kapasitas: number;
  urutan: number;
  aktif: number;
  status: string;
  current: number;
}

export interface RosterBaris {
  user_id: string;
  tanggal: string;
  kode: string;
  catatan: string | null;
}

export interface ProfilGame {
  user_id: string;
  xp: number;
  level: number;
  skin_aktif: string;
  skin_dimiliki: string[];
  luas_tanam: number;
  /** Teks di atas kepala monyet; null = sapaan bawaan. */
  status_teks?: string | null;
}
