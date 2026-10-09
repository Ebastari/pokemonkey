/**
 * Daftar jenis blok memo — satu sumber untuk semua peralatan blok, seperti di
 * Notion ("type menentukan cara tampil"): menu "/", "Ubah jadi", bilah alat HP,
 * dan teks penanda (placeholder) membaca daftar ini.
 *
 * Urutan & pengelompokan mengikuti menu "/" Notion: Blok dasar → Media → Sebaris.
 * Penyimpanan tiap jenis ada di lib/memo-dom.ts (bacaBaris/rakitBaris) dan
 * server/src/memo-blok.ts (penampil & server).
 */

import {
  AlertCircle, AtSign, BarChart3, Bookmark, CalendarCheck, CalendarClock, Columns2, Columns3, FileSpreadsheet, FileSymlink, FileText, Heading1, Heading2, Heading3, Heading4, Highlighter,
  ImagePlus, Info, List, ListChecks, ListCollapse, ListOrdered, ListTree, MapPin, Minus, Palette, Paperclip, Quote, Sigma, Smile,
  Sparkles, SquareCode, Sprout, Table2, Type, Video, ClipboardPen, SlidersHorizontal,
} from 'lucide-react';
import { WARNA_LATAR, WARNA_TEKS } from '../server/src/tampil-memo';
import type { ComponentType } from 'react';
import type { JenisBlok } from './memo-dom';

export type GrupBlok = 'AI' | 'Blok dasar' | 'Halaman' | 'Media' | 'Data lapangan' | 'Lanjutan' | 'Sebaris' | 'Warna';

export interface DefinisiBlok {
  /** Id perintah menu "/"; untuk blok teks sama dengan jenisnya. */
  id: string;
  /** Jenis blok teks yang bisa dipilih lewat "Ubah jadi". */
  jenis?: JenisBlok;
  label: string;
  ket: string;
  grup: GrupBlok;
  /** Pintasan ketik, ditampilkan di kolom kanan menu "/". */
  pintasan?: string;
  ikon: ComponentType<{ size?: number; className?: string }>;
  /** Kata kunci pencarian menu "/". */
  kata: string[];
  /** Teks penanda saat blok kosong. */
  penanda?: string;
}

export const DAFTAR_BLOK: DefinisiBlok[] = [
  // ---- AI (seperti "Ask AI" Notion): tulis blok baru di posisi kursor ----
  { id: 'ai', grup: 'AI', label: 'Tulis dengan AI', ket: 'Minta AI menulis di sini (notulen, ceklis, tabel, …)', ikon: Sparkles, kata: ['ai', 'tulis', 'gemini', 'asisten', 'buat', 'tanya'] },
  // ---- Blok dasar ----
  { id: 'teks', jenis: 'teks', grup: 'Blok dasar', label: 'Teks', ket: 'Mulai menulis teks biasa', ikon: Type, kata: ['teks', 'paragraf', 'text', 'biasa'] },
  { id: 'h1', jenis: 'h1', grup: 'Blok dasar', label: 'Judul 1', ket: 'Judul bagian besar', pintasan: '#', ikon: Heading1, kata: ['judul', 'heading', 'h1', 'besar'], penanda: 'Judul 1' },
  { id: 'h2', jenis: 'h2', grup: 'Blok dasar', label: 'Judul 2', ket: 'Judul bagian sedang', pintasan: '##', ikon: Heading2, kata: ['judul', 'heading', 'h2', 'sedang'], penanda: 'Judul 2' },
  { id: 'h3', jenis: 'h3', grup: 'Blok dasar', label: 'Judul 3', ket: 'Judul bagian kecil', pintasan: '###', ikon: Heading3, kata: ['judul', 'heading', 'h3', 'kecil'], penanda: 'Judul 3' },
  { id: 'h4', jenis: 'h4', grup: 'Blok dasar', label: 'Judul 4', ket: 'Judul paling kecil', pintasan: '####', ikon: Heading4, kata: ['judul', 'heading', 'h4'], penanda: 'Judul 4' },
  { id: 'butir', jenis: 'butir', grup: 'Blok dasar', label: 'Daftar berpoin', ket: 'Daftar sederhana berpoin', pintasan: '-', ikon: List, kata: ['daftar', 'berpoin', 'butir', 'bullet', 'list', 'poin'], penanda: 'Daftar' },
  { id: 'nomor', jenis: 'nomor', grup: 'Blok dasar', label: 'Daftar bernomor', ket: 'Daftar dengan nomor urut', pintasan: '1.', ikon: ListOrdered, kata: ['daftar', 'nomor', 'bernomor', 'numbered', 'urut'], penanda: 'Daftar' },
  { id: 'ceklis', jenis: 'ceklis', grup: 'Blok dasar', label: 'Daftar tugas', ket: 'Tugas yang bisa dicentang', pintasan: '[]', ikon: ListChecks, kata: ['daftar', 'tugas', 'todo', 'ceklis', 'centang', 'checklist'], penanda: 'Tugas' },
  { id: 'toggle', jenis: 'toggle', grup: 'Blok dasar', label: 'Toggle daftar', ket: 'Isi bisa dilipat dan dibuka', pintasan: '>', ikon: ListCollapse, kata: ['toggle', 'lipat', 'daftar', 'collapse', 'buka'], penanda: 'Toggle' },
  { id: 'halaman', grup: 'Blok dasar', label: 'Halaman', ket: 'Sub-halaman di dalam halaman ini', ikon: FileText, kata: ['halaman', 'page', 'sub', 'anak'] },
  { id: 'penting', jenis: 'penting', grup: 'Blok dasar', label: 'Callout', ket: 'Catatan yang menonjol', ikon: Info, kata: ['callout', 'penting', 'catatan', 'kotak', 'info'], penanda: 'Catatan penting' },
  { id: 'kutipan', jenis: 'kutipan', grup: 'Blok dasar', label: 'Kutipan', ket: 'Kutipan atau rujukan', pintasan: '"', ikon: Quote, kata: ['kutipan', 'quote'], penanda: 'Kutipan' },
  { id: 'tabel', grup: 'Blok dasar', label: 'Tabel', ket: 'Kisi baris dan kolom', ikon: Table2, kata: ['tabel', 'table', 'kisi', 'kolom', 'baris'] },
  { id: 'impor_tabel', grup: 'Blok dasar', label: 'Impor Excel / CSV', ket: 'Sisipkan tabel dari berkas .xlsx, .xls, atau .csv & grafik otomatis', ikon: FileSpreadsheet, kata: ['impor', 'excel', 'csv', 'xlsx', 'xls', 'spreadsheet', 'tabel', 'upload'] },
  { id: 'garis', grup: 'Blok dasar', label: 'Divider', ket: 'Garis pemisah bagian', pintasan: '---', ikon: Minus, kata: ['divider', 'garis', 'pemisah'] },
  { id: 'formulir', grup: 'Blok dasar', label: 'Formulir', ket: 'Kumpulkan jawaban: anggota, atau siapa saja lewat tautan', ikon: ClipboardPen, kata: ['formulir', 'form', 'kuesioner', 'isian', 'survei', 'survey', 'jawaban', 'vendor'] },
  { id: 'properti', grup: 'Halaman', label: 'Properti halaman', ket: 'Status, kategori, tanggal, PICA, ringkasan, …', ikon: SlidersHorizontal, kata: ['properti', 'property', 'status', 'kategori', 'tipe', 'tanggal', 'pica', 'ringkasan', 'atribut'] },
  { id: 'tautan_halaman', grup: 'Blok dasar', label: 'Tautan ke halaman', ket: 'Tautkan memo lain', ikon: FileSymlink, kata: ['tautan', 'halaman', 'link', 'page', 'memo'] },
  { id: 'habit', grup: 'Blok dasar', label: 'Habit', ket: 'Lacak / ubah kebiasaan 1 bulan: contoh CSV, prompt AI, unggah CSV & grafik progres', ikon: CalendarCheck, kata: ['habit', 'kebiasaan', 'tracker', 'ceklis', 'harian', 'bulan', 'rutin', 'progres', 'target'] },
  { id: 'pica', grup: 'Blok dasar', label: 'Tabel PICA', ket: 'Sisipkan tabel data PICA (Open, Continue, Selesai) & buat grafik', ikon: AlertCircle, kata: ['pica', 'tabel', 'masalah', 'temuan', 'tindakan', 'korektif', 'link'] },
  // ---- Media ----
  { id: 'gambar', grup: 'Media', label: 'Gambar', ket: 'Foto dari kamera atau galeri', ikon: ImagePlus, kata: ['gambar', 'foto', 'image', 'kamera'] },
  { id: 'video', grup: 'Media', label: 'Video', ket: 'Tautan video (YouTube, Drive, …)', ikon: Video, kata: ['video', 'youtube', 'film', 'rekaman'] },
  { id: 'penanda', grup: 'Media', label: 'Tautan web', ket: 'Kartu pratinjau situs (bookmark)', ikon: Bookmark, kata: ['bookmark', 'penanda', 'tautan', 'web', 'situs', 'link', 'url'] },
  { id: 'berkas', grup: 'Media', label: 'Berkas', ket: 'PDF, Excel, Word', ikon: Paperclip, kata: ['berkas', 'file', 'lampiran', 'pdf', 'excel'] },
  // ---- Data lapangan ----
  { id: 'data_nursery', grup: 'Data lapangan', label: 'Smart Nursery', ket: 'Data stok & mutasi persemaian', ikon: Sprout, kata: ['nursery', 'bibit', 'semai', 'stok', 'mutasi'] },
  { id: 'grafik_reklamasi', grup: 'Data lapangan', label: 'Grafik realisasi reklamasi', ket: 'Batang APL & Hutan per tahun, per kegiatan, per blok', ikon: BarChart3, kata: ['grafik', 'reklamasi', 'revegetasi', 'realisasi', 'chart', 'apl', 'hutan', 'ppkh'] },
  { id: 'data_geotag', grup: 'Data lapangan', label: 'Geotagging Lapangan', ket: 'Sensus pohon, kesehatan & karbon', ikon: MapPin, kata: ['geotag', 'pohon', 'sensus', 'karbon', 'lapangan'] },
  // ---- Lanjutan ----
  { id: 'kode', grup: 'Lanjutan', label: 'Kode', ket: 'Blok kode berwarna + tombol salin', pintasan: '```', ikon: SquareCode, kata: ['kode', 'code', 'skrip', 'program'] },
  { id: 'rumus', grup: 'Lanjutan', label: 'Rumus', ket: 'Persamaan matematika (LaTeX)', pintasan: '$$', ikon: Sigma, kata: ['rumus', 'math', 'matematika', 'persamaan', 'latex', 'equation'] },
  { id: 'daftarisi', grup: 'Lanjutan', label: 'Daftar isi', ket: 'Daftar judul otomatis', ikon: ListTree, kata: ['daftar', 'isi', 'toc', 'judul', 'navigasi'] },
  { id: 'kolom2', grup: 'Lanjutan', label: '2 kolom', ket: 'Dua kolom berdampingan', ikon: Columns2, kata: ['kolom', 'col2', 'dua', 'tata', 'letak', 'columns'] },
  { id: 'kolom3', grup: 'Lanjutan', label: '3 kolom', ket: 'Tiga kolom berdampingan', ikon: Columns3, kata: ['kolom', 'col3', 'tiga', 'tata', 'letak', 'columns'] },
  // ---- Sebaris ----
  { id: 'rumus_sebaris', grup: 'Sebaris', label: 'Rumus sebaris', ket: 'Rumus di dalam kalimat', pintasan: '$$', ikon: Sigma, kata: ['rumus', 'math', 'sebaris', 'inline', 'latex'] },
  { id: 'emoji', grup: 'Sebaris', label: 'Emoji', ket: 'Ketik : lalu nama emoji', pintasan: ':', ikon: Smile, kata: ['emoji', 'ikon', 'senyum'] },
  { id: 'tenggat', grup: 'Sebaris', label: 'Tanggal atau tenggat', ket: 'Tugas bertenggat masuk Jadwal', pintasan: '@', ikon: CalendarClock, kata: ['tenggat', 'tanggal', 'jadwal', 'date', 'waktu', 'pengingat'] },
  { id: 'orang', grup: 'Sebaris', label: 'Sebut orang', ket: 'Penanggung jawab tugas', pintasan: '@', ikon: AtSign, kata: ['orang', 'pic', 'sebut', 'mention', 'anggota'] },
  // ---- Warna (seperti "/merah" di Notion): seluruh teks blok diberi warna atau stabilo ----
  ...WARNA_TEKS.map((w): DefinisiBlok => ({ id: `warna:w:${w.nama}`, grup: 'Warna', label: w.label, ket: 'Warna teks blok ini', ikon: Palette, kata: [w.nama, ...w.label.toLowerCase().split(' '), 'warna', 'teks', 'color'] })),
  ...WARNA_LATAR.map((w): DefinisiBlok => ({ id: `warna:l:${w.nama}`, grup: 'Warna', label: `Latar ${w.label.toLowerCase()}`, ket: 'Stabilo seluruh blok ini', ikon: Highlighter, kata: [w.nama, ...w.label.toLowerCase().split(' '), 'latar', 'stabilo', 'highlight', 'background'] })),
];

/** Blok teks yang bisa dipilih di "Ubah jadi". */
export const UBAH_JADI: DefinisiBlok[] = DAFTAR_BLOK.filter((d) => d.jenis);

export const definisiJenis = (jenis: JenisBlok): DefinisiBlok | undefined => DAFTAR_BLOK.find((d) => d.jenis === jenis);

/** Cocokkan kueri menu "/" dengan kata kunci atau label (awal kata). */
export const cocokKueri = (d: Pick<DefinisiBlok, 'kata' | 'label'>, q: string): boolean =>
  !q || d.kata.some((k) => k.startsWith(q)) || d.label.toLowerCase().split(/\s+/).some((k) => k.startsWith(q));

/**
 * Peringkat hasil menu "/" (seperti Notion): label yang diawali kueri di atas,
 * lalu kata di label, terakhir kata kunci sampingan ("/kolom" → "2 kolom" sebelum "Tabel").
 */
export const skorKueri = (d: Pick<DefinisiBlok, 'kata' | 'label'>, q: string): number => {
  if (!q) return 0;
  const label = d.label.toLowerCase();
  if (label.startsWith(q)) return 3;
  if (label.split(/\s+/).some((k) => k.startsWith(q))) return 2;
  return d.kata.some((k) => k.startsWith(q)) ? 1 : 0;
};
