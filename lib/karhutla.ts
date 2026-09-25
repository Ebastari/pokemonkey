/**
 * FIRE: titik sebulan untuk tabel harian dan arsip laporan karhutla di server
 * (PDF + isi laporan di R2, lihat server/src/laporan-karhutla.ts).
 *
 * Kiriman ke WhatsApp dilakukan manual lewat lembar bagikan; server hanya
 * mencatat bahwa laporan sudah dikirim.
 *
 * Mode demo tidak punya server: arsip disimpan di perangkat (tanpa PDF — PDF
 * demo hanya diingat selama aplikasi terbuka).
 */

import { api, ambilBerkas, demoAktif } from './api';
import { simpanBerkas } from './unduh';
import { diAplikasi } from './platform';
import { namaSatelit, type TitikApi } from '../server/src/titik-api-murni';
import { DAFTAR_IPPKH, titikApiDemo, type LaporanKarhutla, type TitikApiFireItem } from './fire-report';

export interface ArsipKarhutla {
  id: string;
  nomor: string;
  judul: string;
  hari_titik: string;
  tanggal_lapor: string;
  jenis_izin: string;
  area: string;
  jumlah_titik: number;
  titik_ids: string;
  pdf_kunci: string;
  data_kunci: string;
  dibuat_oleh: string | null;
  dibuat_nama?: string | null;
  diekspor_pada: string;
  dikirim_pada: string | null;
  dikirim_nama?: string | null;
  jumlah_kirim: number;
}

/** "2026-09-25T01:39:00Z" → "2026-09-25" (tanggal WITA). */
export const hariWita = (iso: string) => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10);
export const bulanIni = () => hariWita(new Date().toISOString()).slice(0, 7);

// ------------------------------------------------------------------ kolom area

/** Kolom tabel harian tempat sebuah titik dihitung. */
export type KolomTitik = 'IUP' | 'DAS' | 'WASPADA' | string; // string = kode SK IPPKH

export function kolomTitik(t: TitikApiFireItem): KolomTitik {
  if (t.zona === 'petak') return 'DAS';
  if (t.zona === 'iup') return 'IUP';
  if (t.zona === 'ippkh') {
    const normal = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const kode = Object.keys(DAFTAR_IPPKH).find((k) => t.bidang && normal(t.bidang).startsWith(normal(k)));
    return kode ?? (t.bidang || 'IPPKH');
  }
  return 'WASPADA';
}

/** Titik yang wajib dilaporkan: di dalam IUP, IPPKH, atau petak Rehab DAS. */
export const wajibLapor = (t: TitikApiFireItem) => t.zona === 'iup' || t.zona === 'ippkh' || t.zona === 'petak';

/** Laporan tambang (IUP + IPPKH) dan Rehab DAS dibuat terpisah — formatnya berbeda. */
export type KelompokLaporan = 'tambang' | 'das';
export const kelompokTitik = (t: TitikApiFireItem): KelompokLaporan => (t.zona === 'petak' ? 'das' : 'tambang');
export const kelompokLaporan = (jenisIzin: string): KelompokLaporan => (jenisIzin.toLowerCase().includes('das') ? 'das' : 'tambang');

/** Label area untuk arsip: kode SK, "IUP", atau "Rehab DAS (PETAK 9)". */
export function labelArea(titik: TitikApiFireItem[]): string {
  const kolom = [...new Set(titik.map(kolomTitik))];
  if (kolom.includes('DAS')) {
    const petak = [...new Set(titik.map((t) => t.bidang).filter(Boolean))];
    return `Rehab DAS${petak.length ? ` (${petak.join(', ')})` : ''}`;
  }
  return kolom.join(' + ');
}

// ------------------------------------------------------------------ titik sebulan

const keTitik = (t: TitikApi): TitikApiFireItem => ({
  id: t.id, lat: t.lat, lon: t.lon, waktu: t.waktu, sumber: namaSatelit(t.sumber), keyakinan: t.keyakinan, frp: t.frp,
  area: t.area ?? 'tambang', zona: t.zona, bidang: t.bidang, status: t.status, catatan: t.catatan ?? undefined,
});

export async function muatBulan(bulan: string): Promise<{ titik: TitikApiFireItem[]; laporan: ArsipKarhutla[] }> {
  if (demoAktif()) {
    return {
      titik: titikApiDemo().filter((t) => hariWita(t.waktu).startsWith(bulan)),
      laporan: arsipDemo().filter((a) => a.hari_titik.startsWith(bulan)),
    };
  }
  const d = await api<{ titik: TitikApi[]; laporan: ArsipKarhutla[] }>(`/api/karhutla/bulan?bulan=${bulan}`);
  return { titik: d.titik.map(keTitik), laporan: d.laporan };
}

export async function muatArsip(bulan?: string): Promise<ArsipKarhutla[]> {
  if (demoAktif()) return arsipDemo().filter((a) => !bulan || a.hari_titik.startsWith(bulan));
  return (await api<{ laporan: ArsipKarhutla[] }>(`/api/karhutla/laporan${bulan ? `?bulan=${bulan}` : ''}`)).laporan;
}

// ------------------------------------------------------------------ arsip

const KUNCI_ARSIP_DEMO = 'pokemonkey_fire_arsip_demo_v1';
const pdfDemo = new Map<string, Blob>();

function arsipDemo(): (ArsipKarhutla & { data?: LaporanKarhutla })[] {
  try { return JSON.parse(localStorage.getItem(KUNCI_ARSIP_DEMO) || '[]'); } catch { return []; }
}
function tulisArsipDemo(daftar: (ArsipKarhutla & { data?: LaporanKarhutla })[]) {
  try { localStorage.setItem(KUNCI_ARSIP_DEMO, JSON.stringify(daftar)); } catch { /* penyimpanan penuh: arsip demo hanya di memori */ }
}

/** Unggah PDF + isi laporan. Mengekspor ulang laporan yang sama menimpa arsipnya. */
export async function unggahLaporan(l: LaporanKarhutla, titik: TitikApiFireItem[], pdf: Blob): Promise<ArsipKarhutla> {
  const meta = {
    id: l.id,
    nomor: l.nomorLaporan,
    judul: l.judul,
    hari_titik: l.hariTitik ?? l.tanggalLaporan,
    tanggal_lapor: l.tanggalLaporan,
    jenis_izin: l.jenisIzin,
    area: labelArea(titik.length ? titik : []) || l.jenisIzin,
    jumlah_titik: l.titikKoordinat.length,
    titik_ids: l.titikIds,
  };
  if (demoAktif()) {
    const kini = new Date().toISOString();
    const daftar = arsipDemo().filter((a) => a.id !== l.id);
    const lama = arsipDemo().find((a) => a.id === l.id);
    const arsip: ArsipKarhutla = {
      ...meta, titik_ids: JSON.stringify(meta.titik_ids), pdf_kunci: '', data_kunci: '', dibuat_oleh: 'demo', dibuat_nama: l.dibuatOleh,
      diekspor_pada: kini, dikirim_pada: lama?.dikirim_pada ?? null, jumlah_kirim: lama?.jumlah_kirim ?? 0,
    };
    pdfDemo.set(l.id, pdf);
    tulisArsipDemo([{ ...arsip, data: l }, ...daftar]);
    return arsip;
  }
  const form = new FormData();
  form.append('pdf', new File([pdf], 'laporan.pdf', { type: 'application/pdf' }));
  form.append('data', JSON.stringify(l));
  form.append('meta', JSON.stringify(meta));
  return (await api<{ laporan: ArsipKarhutla }>('/api/karhutla/laporan', { form })).laporan;
}

export async function tandaiTerkirim(id: string): Promise<ArsipKarhutla | null> {
  if (demoAktif()) {
    const daftar = arsipDemo();
    const a = daftar.find((x) => x.id === id);
    if (!a) return null;
    a.dikirim_pada = new Date().toISOString();
    a.jumlah_kirim += 1;
    tulisArsipDemo(daftar);
    return a;
  }
  return (await api<{ laporan: ArsipKarhutla }>(`/api/karhutla/laporan/${id}/kirim`, { method: 'POST', body: {} })).laporan;
}

export async function hapusArsip(id: string): Promise<void> {
  if (demoAktif()) { tulisArsipDemo(arsipDemo().filter((a) => a.id !== id)); pdfDemo.delete(id); return; }
  await api(`/api/karhutla/laporan/${id}`, { method: 'DELETE' });
}

export async function ambilPdfArsip(a: ArsipKarhutla): Promise<Blob> {
  if (demoAktif()) {
    const b = pdfDemo.get(a.id);
    if (!b) throw new Error('Mode demo: PDF hanya diingat selama aplikasi terbuka. Buka laporannya lalu Export PDF lagi.');
    return b;
  }
  return ambilBerkas(a.pdf_kunci);
}

export async function ambilIsiArsip(a: ArsipKarhutla): Promise<LaporanKarhutla> {
  if (demoAktif()) {
    const d = arsipDemo().find((x) => x.id === a.id)?.data;
    if (!d) throw new Error('Isi laporan demo tidak ditemukan.');
    return d;
  }
  return JSON.parse(await (await ambilBerkas(a.data_kunci)).text()) as LaporanKarhutla;
}

export const namaPdf = (a: { hari_titik: string; area: string; jenis_izin: string }) =>
  `Laporan Karhutla ${a.area || a.jenis_izin} ${a.hari_titik}.pdf`.replace(/[\\/:*?"<>|]/g, '-');

// ------------------------------------------------------------------ WhatsApp

/**
 * Kirim PDF ke WhatsApp secara manual.
 * APK & HP: lembar bagikan (pilih WhatsApp, lalu grup/kontak).
 * Komputer: PDF diunduh lalu WhatsApp Web dibuka dengan pesan pengantar —
 * berkasnya dilampirkan sendiri dari folder unduhan.
 */
export async function kirimKeWhatsApp(pdf: Blob, nama: string, pesan: string): Promise<'dibagikan' | 'diunduh'> {
  const sentuh = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (!diAplikasi() && sentuh) {
    const berkas = new File([pdf], nama, { type: 'application/pdf' });
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [berkas] })) {
      try {
        await navigator.share({ files: [berkas], text: pesan, title: nama });
        return 'dibagikan';
      } catch { /* dibatalkan: jatuh ke unduh + wa.me */ }
    }
  }
  const hasil = await simpanBerkas(pdf, nama, pesan);
  if (hasil === 'diunduh') window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, '_blank', 'noopener');
  return hasil;
}

/** Pesan pengantar WhatsApp untuk satu laporan. */
export function pesanPengantar(a: { judul: string; nomor: string; jumlah_titik: number; area: string; hari_titik: string }): string {
  const [y, m, d] = a.hari_titik.split('-').map(Number);
  const tgl = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `*Laporan Karhutla ${a.area}*\n${a.jumlah_titik} titik panas terdeteksi ${tgl}.\nNomor: ${a.nomor}\n\nBerkas PDF terlampir.`;
}
