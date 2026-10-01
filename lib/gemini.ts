/**
 * Modul Bantuan Google Gemini AI untuk POKEMONKEY
 * 
 * - Kembangkan Uraian PICA (Problem, Root Cause, Action)
 * - Resume Eksekutif PICA untuk Laporan Operasional & Morning Talk
 */

import { api } from './api';
import type { PicaItem } from './tipe-api';

const KUNCI_GEMINI_FALLBACK = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '';

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

/** Panggilan langsung ke Google Gemini API jika server offline / demo */
async function panggilGeminiLangsung(prompt: string, modelUtama = 'gemini-3.5-flash-lite'): Promise<string> {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || KUNCI_GEMINI_FALLBACK;
  if (!apiKey) {
    throw new Error('Kunci API Gemini tidak disetel di browser. Pastikan server online untuk memproses dengan AI.');
  }
  const modelList = [modelUtama, 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let errorTerakhir: Error | null = null;

  for (const m of modelList) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Model ${m} (${res.status}): ${t}`);
      }

      const d = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const teks = d.candidates?.[0]?.content?.parts?.[0]?.text;
      if (teks && teks.trim()) {
        return teks.trim();
      }
      throw new Error(`Model ${m} tidak mengembalikan teks`);
    } catch (e) {
      errorTerakhir = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw errorTerakhir ?? new Error('Gagal menghubungi Gemini AI');
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

export interface HasilMemoAi {
  judul?: string;
  isi?: string;
  ringkasan?: string;
  tugas?: string[];
  catatan_ai?: string;
}

/** Proses dan kembangkan tulisan Memo dengan AI */
export async function prosesMemoAi(params: {
  mode: 'kembangkan' | 'rapikan' | 'ringkas' | 'ekstrak_tugas';
  judul: string;
  isi: string;
  kategori?: string;
  instruksi_khusus?: string;
}): Promise<HasilMemoAi> {
  try {
    const hasil = await api<{ sukses: boolean; hasil: HasilMemoAi }>('/api/ai/memo/proses', {
      method: 'POST',
      body: params,
    });
    if (hasil?.hasil) return hasil.hasil;
  } catch {
    // Fallback ke Gemini langsung jika rute backend belum tersedia / demo mode
  }

  const instruksiMode: Record<string, string> = {
    kembangkan: 'Kembangkan catatan/poin ini menjadi draf Internal Memo resmi yang komprehensif, terstruktur dengan heading Notion/Markdown (#, ##, ###), latar belakang, maksud & tujuan, detail pelaksanaan/teknis, dan penutup.',
    rapikan: 'Perbaiki tata bahasa, profesionalisme, struktur heading (#, ##), dan daftar poin dari teks ini tanpa mengubah maksud aslinya.',
    ringkas: 'Buat ringkasan eksekutif 2-4 kalimat yang padat dan jelas yang merangkum keseluruhan memo, serta usulan judul jika judul sekarang kurang tepat.',
    ekstrak_tugas: 'Identifikasi semua tugas, komitmen, dan rencana tindak lanjut dari memo ini, lalu susun menjadi daftar ceklis tugas dengan format "- [ ] Nama Tugas".',
  };

  const prompt = `
Anda adalah Asisten Eksekutif dan Spesialis Manajemen Dokumen Operasional Tambang & Kehutanan (Revegetasi / Nursery / K3).
Tugas Anda: ${instruksiMode[params.mode] || instruksiMode.kembangkan}

Data Memo Saat Ini:
- Judul: "${params.judul || 'Tanpa judul'}"
- Kategori: "${params.kategori || 'Operasional'}"
- Isi Catatan:
"""
${params.isi}
"""
${params.instruksi_khusus ? `- Catatan Khusus Pengguna: "${params.instruksi_khusus}"` : ''}

Ketentuan Format Output:
- "judul": Usulan judul yang tajam, formal, dan mencerminkan isi (atau pertahankan jika sudah bagus).
- "isi": Teks lengkap memo yang sudah diproses (menggunakan format teks baris/heading Notion yang bersih).
- "ringkasan": Ringkasan eksekutif padat 2-3 kalimat.
- "tugas": Array string daftar tugas (misal ["- [ ] Inspeksi bedeng A", "- [ ] Koordinasi pengadaan pupuk"]).
- "catatan_ai": 1 kalimat saran dari AI mengenai perbaikan ini.

Kembalikan HANYA format JSON valid tanpa kata pengantar:
{
  "judul": "...",
  "isi": "...",
  "ringkasan": "...",
  "tugas": ["..."],
  "catatan_ai": "..."
}
`.trim();

  try {
    const teks = await panggilGeminiLangsung(prompt);
    const jsonStr = ekstrakJson(teks);
    return JSON.parse(jsonStr) as HasilMemoAi;
  } catch (err) {
    console.error('Gagal memproses memo AI:', err);
    return {
      judul: params.judul,
      isi: params.isi,
      ringkasan: params.isi.slice(0, 150),
      catatan_ai: 'Penyesuaian format dasar diterapkan.',
    };
  }
}

