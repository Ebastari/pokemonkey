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
  AtSign, CalendarClock, FileSymlink, FileText, Heading1, Heading2, Heading3, Heading4, ImagePlus, Info, List, ListChecks,
  ListCollapse, ListOrdered, MapPin, Minus, Paperclip, Quote, Sprout, Table2, Type, Video,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { JenisBlok } from './memo-dom';

export type GrupBlok = 'Blok dasar' | 'Media' | 'Data lapangan' | 'Sebaris';

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
  { id: 'garis', grup: 'Blok dasar', label: 'Divider', ket: 'Garis pemisah bagian', pintasan: '---', ikon: Minus, kata: ['divider', 'garis', 'pemisah'] },
  { id: 'tautan_halaman', grup: 'Blok dasar', label: 'Tautan ke halaman', ket: 'Tautkan memo lain', ikon: FileSymlink, kata: ['tautan', 'halaman', 'link', 'page', 'memo'] },
  // ---- Media ----
  { id: 'gambar', grup: 'Media', label: 'Gambar', ket: 'Foto dari kamera atau galeri', ikon: ImagePlus, kata: ['gambar', 'foto', 'image', 'kamera'] },
  { id: 'video', grup: 'Media', label: 'Video', ket: 'Tautan video (YouTube, Drive, …)', ikon: Video, kata: ['video', 'youtube', 'film', 'rekaman'] },
  { id: 'berkas', grup: 'Media', label: 'Berkas', ket: 'PDF, Excel, Word', ikon: Paperclip, kata: ['berkas', 'file', 'lampiran', 'pdf', 'excel'] },
  // ---- Data lapangan ----
  { id: 'data_nursery', grup: 'Data lapangan', label: 'Smart Nursery', ket: 'Data stok & mutasi persemaian', ikon: Sprout, kata: ['nursery', 'bibit', 'semai', 'stok', 'mutasi'] },
  { id: 'data_geotag', grup: 'Data lapangan', label: 'Geotagging Lapangan', ket: 'Sensus pohon, kesehatan & karbon', ikon: MapPin, kata: ['geotag', 'pohon', 'sensus', 'karbon', 'lapangan'] },
  // ---- Sebaris ----
  { id: 'tenggat', grup: 'Sebaris', label: 'Tanggal atau tenggat', ket: 'Tugas bertenggat masuk Jadwal', pintasan: '@', ikon: CalendarClock, kata: ['tenggat', 'tanggal', 'jadwal', 'date', 'waktu', 'pengingat'] },
  { id: 'orang', grup: 'Sebaris', label: 'Sebut orang', ket: 'Penanggung jawab tugas', pintasan: '@', ikon: AtSign, kata: ['orang', 'pic', 'sebut', 'mention', 'anggota'] },
];

/** Blok teks yang bisa dipilih di "Ubah jadi". */
export const UBAH_JADI: DefinisiBlok[] = DAFTAR_BLOK.filter((d) => d.jenis);

export const definisiJenis = (jenis: JenisBlok): DefinisiBlok | undefined => DAFTAR_BLOK.find((d) => d.jenis === jenis);

/** Cocokkan kueri menu "/" dengan kata kunci atau label (awal kata). */
export const cocokKueri = (d: Pick<DefinisiBlok, 'kata' | 'label'>, q: string): boolean =>
  !q || d.kata.some((k) => k.startsWith(q)) || d.label.toLowerCase().split(/\s+/).some((k) => k.startsWith(q));
