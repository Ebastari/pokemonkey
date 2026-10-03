/**
 * Modul Bantuan Google Gemini AI untuk POKEMONKEY
 * 
 * - Kembangkan Uraian PICA (Problem, Root Cause, Action)
 * - Resume Eksekutif PICA untuk Laporan Operasional & Morning Talk
 */

import { api } from './api';
import type { PicaItem } from './tipe-api';

// Kunci Gemini TIDAK disimpan di aplikasi (akan ikut ke APK/web dan bisa dicuri): semua AI lewat server.

export interface SaranPicaAi {
  judul: string;
  judul_singkat: string;
  akar: string;
  tindakan: string;
  catatan_ai?: string;
}

export interface ResumePicaAi {
  judul: string;
  ringkasan_umum: string;
  isu_kritis: string[];
  analisis_pola: string;
  rekomendasi: string[];
  teks_wa: string;
}

function ekstrakJson(teks: string): string {
  const match = teks.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  let bersih = teks.trim();
  if (bersih.startsWith('```')) {
    bersih = bersih.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return bersih.trim();
}

/** Cadangan lama (panggilan Gemini langsung dari aplikasi) dimatikan demi keamanan kunci. */
async function panggilGeminiLangsung(_prompt: string): Promise<string> {
  throw new Error('AI hanya tersedia lewat server POKEMONKEY. Periksa sinyal, lalu coba lagi.');
}

/** Kembangkan Uraian PICA dengan AI */
export async function kembangkanPicaAi(params: {
  judul: string;
  akar?: string;
  tindakan?: string;
  bidang?: string;
  satuan?: string;
  target?: number | null;
  realisasi?: number | null;
}): Promise<SaranPicaAi> {
  try {
    const hasil = await api<{ sukses: boolean; saran: SaranPicaAi }>('/api/ai/pica/kembangkan', {
      method: 'POST',
      body: params,
    });
    if (hasil?.saran) return hasil.saran;
  } catch {
    // Fallback ke Gemini langsung jika rute backend belum tersedia / demo mode
  }

  const prompt = `
Anda adalah Senior Operations & K3 Manager untuk Reklamasi & Revegetasi Tambang serta Persemaian (Nursery) Hutan.
Tugas Anda adalah mengembangkan dan menyusun draf register PICA (Problem, Identification, Corrective Action) yang profesional, berbasis data lapangan, faktual, dan memiliki tindakan terukur.

Data Mentah dari Pengguna:
- Bidang Operasional: ${params.bidang || 'Revegetasi / Nursery'}
- Uraian Masalah / Fakta Lapangan: "${params.judul}"
- Akar Masalah Saat Ini: "${params.akar || '-'}"
- Tindakan Saat Ini: "${params.tindakan || '-'}"
- Target / Realisasi: ${params.target ?? '-'} / ${params.realisasi ?? '-'} ${params.satuan || ''}

Instruksi:
1. "judul": Rumuskan pernyataan masalah operasional yang jelas, objektif, dan faktual (bahasa Indonesia baku, profesional).
2. "judul_singkat": Buat judul singkat padat (maksimal 60 karakter) yang cocok untuk baris ringkas WhatsApp.
3. "akar": Kembangkan analisis akar masalah (root cause) dengan pendekatan teknis/operasional (faktor manusia, metode, material, alat, atau lingkungan/cuaca).
4. "tindakan": Rancang tindakan korektif (segera) & preventif (jangka panjang) yang konkret dan terukur.
5. "catatan_ai": Ulasan singkat 1 kalimat alasan perbaikan ini disarankan.

Kembalikan HANYA format JSON valid tanpa teks pengantar:
{
  "judul": "...",
  "judul_singkat": "...",
  "akar": "...",
  "tindakan": "...",
  "catatan_ai": "..."
}
`.trim();

  try {
    const teks = await panggilGeminiLangsung(prompt);
    const jsonStr = ekstrakJson(teks);
    return JSON.parse(jsonStr) as SaranPicaAi;
  } catch (err) {
    console.error('Gagal parse saran AI:', err);
    return {
      judul: params.judul,
      judul_singkat: params.judul.slice(0, 50),
      akar: params.akar || 'Memerlukan investigasi teknis lapangan lebih lanjut.',
      tindakan: params.tindakan || 'Lakukan verifikasi dan koordinasikan tindakan perbaikan dengan tim lapangan.',
      catatan_ai: 'Saran disesuaikan secara otomatis.',
    };
  }
}

/** Buat Resume Eksekutif PICA dengan AI */
export async function resumePicaAi(params: {
  pica: PicaItem[];
  periode?: string;
}): Promise<ResumePicaAi> {
  const daftar = params.pica ?? [];

  if (daftar.length === 0) {
    return {
      judul: 'Resume Eksekutif PICA Operasional',
      ringkasan_umum: 'Belum ada data PICA yang tercatat atau aktif pada tampilan/periode ini. Seluruh item perbaikan sudah selesai atau belum ada temuan baru.',
      isu_kritis: [],
      analisis_pola: 'Kondisi operasional normal tanpa kendala terbuka.',
      rekomendasi: [
        'Lakukan monitoring berkala di lapangan (Nursery & Revegetasi).',
        'Pastikan pengisian pelaporan harian berjalan disiplin.',
      ],
      teks_wa: '📢 *RESUME PICA OPERASIONAL*\n\n✅ *Status:* Tidak ada PICA aktif/terbuka. Operasional berjalan lancar.',
    };
  }

  try {
    const hasil = await api<{ sukses: boolean; resume: ResumePicaAi }>('/api/ai/pica/resume', {
      method: 'POST',
      body: params,
    });
    if (hasil?.resume) return hasil.resume;
  } catch {
    // Fallback ke Gemini langsung
  }

  const ringkas = daftar.slice(0, 50).map((p, i) => ({
    no: i + 1,
    id: p.id,
    bidang: p.bidang,
    prioritas: p.prioritas,
    status: p.status,
    masalah: p.judul,
    akar: p.akar || 'Belum dianalisis',
    tindakan: p.tindakan || 'Belum ada',
    pic: p.pic_nama || 'Belum ada',
    due_date: p.due_date || '-',
    sisa_hari: p.sisa_hari ?? null,
    telat: (p.sisa_hari ?? 1) < 0 && p.status !== 'Closed',
  }));

  const jmlTerbuka = daftar.filter((p) => p.status !== 'Closed').length;
  const jmlSelesai = daftar.filter((p) => p.status === 'Closed').length;
  const jmlTelat = daftar.filter((p) => (p.sisa_hari ?? 1) < 0 && p.status !== 'Closed').length;

  const prompt = `
Anda adalah Operational Excellence & Performance Lead di bidang Rehabilitasi Tambang (Revegetasi & Nursery).
Tugas Anda adalah menganalisis data PICA berikut dan menghasilkan **Resume Eksekutif Operasional** untuk rapat mingguan atau briefing manajemen.

Statistik Data:
- Total PICA: ${daftar.length}
- Terbuka: ${jmlTerbuka}
- Selesai: ${jmlSelesai}
- Telat: ${jmlTelat}
- Periode: ${params.periode || 'Periode Aktif'}

Daftar PICA:
${JSON.stringify(ringkas, null, 2)}

Instruksi:
1. "ringkasan_umum": Paragraf narasi ringkas tentang status dan progres kerja saat ini.
2. "isu_kritis": Array 2-4 poin yang merangkum masalah kritis / terlambat yang butuh tindakan segera.
3. "analisis_pola": Analisis tren akar masalah yang dominan.
4. "rekomendasi": Array 3-5 langkah prioritas yang disarankan.
5. "teks_wa": Teks rapi siap kirim ke WhatsApp tim/manajemen lengkap dengan statistik dan rekomendasi.

Kembalikan HANYA format JSON valid tanpa teks pengantar:
{
  "judul": "Resume Eksekutif PICA Operasional",
  "ringkasan_umum": "...",
  "isu_kritis": ["...", "..."],
  "analisis_pola": "...",
  "rekomendasi": ["...", "..."],
  "teks_wa": "..."
}
`.trim();

  try {
    const teks = await panggilGeminiLangsung(prompt);
    const jsonStr = ekstrakJson(teks);
    return JSON.parse(jsonStr) as ResumePicaAi;
  } catch (err) {
    console.error('Gagal parse resume AI:', err);
    return {
      judul: 'Resume Eksekutif PICA Operasional',
      ringkasan_umum: `Terdapat ${daftar.length} PICA terdata (${jmlTerbuka} terbuka, ${jmlSelesai} selesai, ${jmlTelat} telat).`,
      isu_kritis: jmlTelat > 0 ? [`Terdapat ${jmlTelat} PICA yang melewati tenggat (due date). Perlu percepatan eksekusi.`] : ['Tidak ada PICA yang telat.'],
      analisis_pola: 'Sebagian besar kendala berpusat pada koordinasi teknis dan alokasi sumber daya di lapangan.',
      rekomendasi: [
        'Prioritaskan penyelesaian item PICA dengan prioritas Tinggi.',
        'Lakukan evaluasi mingguan terhadap progres tindakan korektif.',
      ],
      teks_wa: `📢 *RESUME PICA OPERASIONAL*\n\n📊 Total: ${daftar.length} | Terbuka: ${jmlTerbuka} | Selesai: ${jmlSelesai} | Telat: ${jmlTelat}\n\n⚠️ Harap perhatikan tindak lanjut perbaikan yang belum selesai.`,
    };
  }
}

export type ModeMemoAi = 'kembangkan' | 'rapikan' | 'ringkas' | 'ekstrak_tugas' | 'tulis' | 'pilihan' | 'laporan';

/** Sumber data laporan otomatis (mode "laporan"). */
export interface PilihanLaporanAi { pica?: boolean; reklamasi?: boolean; nursery?: boolean; geotag?: boolean; periode?: 'minggu' | 'bulan' }
export type AksiPilihanAi = 'perbaiki' | 'persingkat' | 'perpanjang' | 'resmi' | 'sederhana' | 'inggris' | 'indonesia' | 'ceklis' | 'tabel' | 'lanjutkan' | 'bebas';

/** Usulan tugas dari AI — disunting pengguna sebelum disisipkan. */
export interface TugasAi {
  teks: string;
  /** YYYY-MM-DD atau kosong. */
  tanggal: string;
  jam: string;
  /** id anggota (sudah diperiksa server) atau kosong. */
  pic: string;
  pica: string;
  /** Dasar AI memilih tanggal/PIC. */
  alasan: string;
  /** Tugas yang sama sudah ada di memo. */
  sudah_ada: boolean;
}

export interface HasilMemoAi {
  judul?: string;
  isi?: string;
  ringkasan?: string;
  judul_usulan?: string;
  tugas?: TugasAi[];
  /** Pengganti teks terpilih (mode "pilihan"). */
  hasil?: string;
  catatan_ai?: string;
  model?: string;
}

/**
 * Asisten AI memo (lihat server/src/ai-memo.ts). Hanya lewat server; galat
 * diteruskan apa adanya — tidak ada hasil "pura-pura berhasil".
 */
export async function prosesMemoAi(params: {
  mode: ModeMemoAi;
  memo_id?: string;
  lingkup?: 'tim' | 'pribadi';
  judul: string;
  isi: string;
  instruksi_khusus?: string;
  pilihan?: string;
  aksi?: AksiPilihanAi;
  laporan?: PilihanLaporanAi;
}): Promise<HasilMemoAi> {
  const r = await api<{ sukses: boolean; hasil: HasilMemoAi; model?: string }>('/api/ai/memo/proses', { method: 'POST', body: params });
  return { ...r.hasil, model: r.model };
}

export interface JawabanTanyaAi {
  /** Jawaban dalam format memo, dengan sumber [[memo:id|judul]]. */
  jawaban: string;
  sumber: { id: string; judul: string; tanggal: string; lingkup: string }[];
  yakin: 'tinggi' | 'sedang' | 'rendah';
  kata?: string[];
  model?: string;
}

/** Tanya semua memo yang boleh dibaca (lihat server/src/ai-memo.ts ruteTanyaMemo). */
export async function tanyaMemoAi(pertanyaan: string): Promise<JawabanTanyaAi> {
  return api<JawabanTanyaAi>('/api/ai/memo/tanya', { method: 'POST', body: { pertanyaan } });
}

export interface PemakaianAi {
  hari_ini: number; batas: number; sisa: number; tercatat: boolean;
  /** Admin/SPV: pemakaian tim bulan ini. */
  tim_bulan_ini?: { user_id: string; nama: string | null; permintaan: number; token: number; gagal: number }[];
}
export const pemakaianAi = (): Promise<PemakaianAi> => api<PemakaianAi>('/api/ai/pemakaian');

/** Satu tugas AI → baris ceklis memo (tenggat & PIC jadi chip, tugas bertenggat masuk Jadwal). */
export function barisTugasAi(t: TugasAi): string {
  return ['- [ ]', t.teks, t.tanggal && `@${t.tanggal}${t.jam ? ` ${t.jam}` : ''}`, t.pic && `@${t.pic}`, t.pica && `#${t.pica}`].filter(Boolean).join(' ');
}
