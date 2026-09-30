/**
 * Sistem hati (klien): hari kerja tanpa membuka aplikasi mematikan hati.
 * Pemiliknya mengirim permohonan ke grup WhatsApp; Admin/Supervisor menghidupkan.
 * Aturan lengkap ada di server/src/hati.ts.
 */

import { api, demoAktif } from './api';

export interface HatiMati {
  status: 'mati';
  id: string;
  hariAbsen: number;
  /** Tanggal hari kerja yang terlewat (YYYY-MM-DD). */
  tanggalAbsen: string[];
  bukaTerakhir: string;
  matiPada: string;
  alasan: string | null;
  keterangan: string | null;
  /** Terisi bila permohonan sudah dikirim ke grup. */
  diajukanPada: string | null;
}
export type StatusHati = { status: 'hidup' } | HatiMati;

export interface PermohonanHati extends HatiMati {
  userId: string;
  nama: string;
  jabatan: string | null;
  kalimat: string | null;
  labelAlasan: string | null;
  dihidupkanPada: string | null;
  dihidupkanOleh: string | null;
}

/** Pilihan alasan; kalimatnya harus sama dengan ALASAN_HATI di server. */
export const ALASAN_HATI: { id: string; label: string; kalimat: (ket: string) => string }[] = [
  { id: 'lalai', label: 'Lalai', kalimat: () => 'sehingga saya lalai' },
  { id: 'sakit', label: 'Sakit', kalimat: () => 'karena saya sakit' },
  { id: 'sinyal', label: 'Tidak ada sinyal / HP bermasalah', kalimat: () => 'karena tidak ada sinyal atau HP saya bermasalah' },
  { id: 'tugas', label: 'Tugas di luar site', kalimat: () => 'karena saya bertugas di luar site' },
  { id: 'lain', label: 'Lainnya', kalimat: (ket) => (ket ? `karena ${ket.replace(/[.\s]+$/, '')}` : 'karena …') },
];

export const kalimatMaaf = (hari: number, alasan: string, keterangan: string) =>
  `Maaf, ${hari} hari saya tidak membuka PICA ${(ALASAN_HATI.find((a) => a.id === alasan) ?? ALASAN_HATI[0]).kalimat(keterangan.trim())}.`;

/** Mode demo tidak memakai sistem hati. */
export const hatiAktif = () => !demoAktif();

/** Dipanggil saat aplikasi dibuka: mencatat "hari ini dibuka" dan mengembalikan status hati. */
export const periksaHati = () => api<StatusHati>('/api/hati');

export const ajukanHati = (alasan: string, keterangan: string) =>
  api<{ ok: true; wa: boolean; pesan: string; status: HatiMati }>('/api/hati/ajukan', { body: { alasan, keterangan } });

export const daftarPermohonanHati = (token?: string) =>
  api<{ permohonan: PermohonanHati[] }>(`/api/hati/permohonan${token ? `?token=${encodeURIComponent(token)}` : ''}`);

export const hidupkanHati = (kunci: { token: string } | { id: string }) =>
  api<{ ok: true; nama: string; sudah?: boolean }>('/api/hati/hidupkan', { body: kunci });
