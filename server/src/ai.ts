/**
 * Rute AI (Google Gemini) untuk POKEMONKEY
 * 
 * Fitur:
 * - Kembangkan uraian PICA (Problem, Root Cause 5-Why, Corrective Action)
 * - Resume Eksekutif PICA untuk laporan harian/rapat mingguan tim
 */

import type { Env, Pengguna } from './tipe';


const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

function galat(pesan: string, status = 400): Response {
  return json({ galat: pesan, pesan }, status);
}

/** Panggil API Google Gemini dengan fallback model */
async function panggilGemini(apiKey: string, prompt: string, modelUtama = 'gemini-3.5-flash-lite'): Promise<string> {
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
        const errText = await res.text();
        throw new Error(`Model ${m} merespon ${res.status}: ${errText}`);
      }

      const hasil = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const teks = hasil.candidates?.[0]?.content?.parts?.[0]?.text;
      if (teks && teks.trim()) {
        return teks.trim();
      }
      throw new Error(`Model ${m} tidak menghasilkan teks kandidat`);
    } catch (e) {
      errorTerakhir = e instanceof Error ? e : new Error(String(e));
      // Coba model berikutnya jika gagal
    }
  }

  throw errorTerakhir ?? new Error('Gagal menghubungi Gemini API');
}

/** Ekstrak blok JSON valid dari jawaban LLM */
function ekstrakJson(teks: string): string {
  const match = teks.match(/\{[\s\S]*\}/);
  if (match) return match[0];
  let bersih = teks.trim();
  if (bersih.startsWith('```')) {
    bersih = bersih.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return bersih.trim();
}

export async function ruteAi(
  jalur: string,
  req: Request,
  env: Env,
  _pengguna?: Pengguna,
): Promise<Response | null> {
  if (req.method === 'OPTIONS' && jalur.startsWith('/api/ai/')) {
    return new Response(null, { status: 204, headers: CORS });
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return galat('Kunci API Gemini belum dikonfigurasi di server. Silakan hubungi Administrator (wrangler secret put GEMINI_API_KEY).', 503);
  }

  // 1. Kembangkan PICA
  if (jalur === '/api/ai/pica/kembangkan' && req.method === 'POST') {
    let body: {
      judul?: string;
      akar?: string;
      tindakan?: string;
      bidang?: string;
      satuan?: string;
      target?: number | null;
      realisasi?: number | null;
    } = {};

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return galat('Body JSON tidak valid');
    }

    const judul = (body.judul ?? '').trim();
    if (!judul) {
      return galat('Deskripsi masalah (judul) wajib diisi untuk dikembangkan oleh AI');
    }

    const prompt = `
Anda adalah Senior Operations & K3 Manager untuk Reklamasi & Revegetasi Tambang serta Persemaian (Nursery) Hutan.
Tugas Anda adalah mengembangkan dan menyusun draf register PICA (Problem, Identification, Corrective Action) yang profesional, berbasis data lapangan, faktual, dan memiliki tindakan terukur.

Data Mentah dari Pengguna:
- Bidang Operasional: ${body.bidang || 'Revegetasi / Nursery'}
- Uraian Masalah / Fakta Lapangan: "${judul}"
- Akar Masalah Saat Ini (jika ada): "${body.akar || '-'}"
- Tindakan Saat Ini (jika ada): "${body.tindakan || '-'}"
- Target / Realisasi (jika ada): ${body.target ?? '-'} / ${body.realisasi ?? '-'} ${body.satuan || ''}

Instruksi:
1. "judul": Rumuskan pernyataan masalah operasional yang jelas, objektif, dan faktual (bahasa Indonesia baku, profesional).
2. "judul_singkat": Buat judul singkat padat (maksimal 60 karakter) yang cocok untuk baris ringkas WhatsApp.
3. "akar": Kembangkan analisis akar masalah (root cause) dengan pendekatan teknis/operasional (misal faktor manusia, metode, material, alat, atau cuaca/lingkungan).
4. "tindakan": Rancang tindakan korektif (segera) & preventif (jangka panjang) yang jelas, aplikatif di lapangan, dan memiliki indikator keberhasilan.
5. "catatan_ai": Ulasan singkat 1 kalimat alasan perbaikan ini disarankan.

Kembalikan HANYA format JSON valid tanpa kata pengantar atau penutup lain:
{
  "judul": "...",
  "judul_singkat": "...",
  "akar": "...",
  "tindakan": "...",
  "catatan_ai": "..."
}
`.trim();

    try {
      const jawaban = await panggilGemini(apiKey, prompt);
      const jsonStr = ekstrakJson(jawaban);
      const hasil = JSON.parse(jsonStr);
      return json({ sukses: true, saran: hasil });
    } catch (e) {
      return galat(e instanceof Error ? e.message : 'Gagal menghasilkan saran AI', 500);
    }
  }

  // 2. Resume Eksekutif PICA
  if (jalur === '/api/ai/pica/resume' && req.method === 'POST') {
    let body: {
      pica?: Array<{
        id: string;
        bidang: string;
        prioritas: string;
        judul: string;
        akar?: string | null;
        tindakan?: string | null;
        pic_nama?: string | null;
        due_date?: string | null;
        status: string;
        sisa_hari?: number | null;
      }>;
      periode?: string;
    } = {};

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return galat('Body JSON tidak valid');
    }

    const daftarPica = body.pica ?? [];
    if (daftarPica.length === 0) {
      return galat('Daftar PICA kosong, tidak ada data untuk dianalisis');
    }

    // Ringkas data pica untuk menghemat token dan mempercepat respon
    const picaRingkas = daftarPica.slice(0, 50).map((p, idx) => ({
      no: idx + 1,
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

    const jumlahTotal = daftarPica.length;
    const jumlahTerbuka = daftarPica.filter((p) => p.status !== 'Closed').length;
    const jumlahSelesai = daftarPica.filter((p) => p.status === 'Closed').length;
    const jumlahTelat = daftarPica.filter((p) => (p.sisa_hari ?? 1) < 0 && p.status !== 'Closed').length;

    const prompt = `
Anda adalah Operational Excellence & Performance Lead di bidang Rehabilitasi Tambang (Revegetasi & Nursery).
Tugas Anda adalah menganalisis kumpulan data PICA (Problem Identification & Corrective Action) berikut dan menghasilkan **Resume Eksekutif Operasional** yang tajam, komprehensif, dan siap dipresentasikan di hadapan manajemen atau Morning Talk.

Statistik Data:
- Total PICA: ${jumlahTotal}
- Terbuka (Open/Progress): ${jumlahTerbuka}
- Selesai (Closed): ${jumlahSelesai}
- Keterlambatan (Overdue): ${jumlahTelat}
- Periode: ${body.periode || 'Periode Aktif'}

Daftar PICA:
${JSON.stringify(picaRingkas, null, 2)}

Instruksi Analisis:
1. Buat "ringkasan_umum": Paragraf narasi eksekutif tentang kondisi kesehatan operasional saat ini.
2. Buat "isu_kritis": Array 2-4 string poin yang menyoroti temuan paling berisiko / telat yang membutuhkan intervensi pimpinan segera.
3. Buat "analisis_pola": Analisis tren akar masalah yang dominan (misal ketergantungan cuaca, kelambatan pengadaan, koordinasi tim, atau kepatuhan SOP).
4. Buat "rekomendasi": Array 3-5 langkah prioritas yang harus diambil dalam 1-2 minggu ke depan.
5. Buat "teks_wa": Format teks siap kirim ke grup WhatsApp yang lengkap dengan emoticon, statistik, isu kritis, dan instruksi tindakan.

Kembalikan HANYA format JSON valid:
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
      const jawaban = await panggilGemini(apiKey, prompt);
      const jsonStr = ekstrakJson(jawaban);
      const hasil = JSON.parse(jsonStr);
      return json({
        sukses: true,
        resume: hasil,
        statistik: { total: jumlahTotal, terbuka: jumlahTerbuka, selesai: jumlahSelesai, telat: jumlahTelat },
      });
    } catch (e) {
      return galat(e instanceof Error ? e.message : 'Gagal menghasilkan resume AI', 500);
    }
  }

  // 3. Asisten Menulis & Ringkasan Memo
  if (jalur === '/api/ai/memo/proses' && req.method === 'POST') {
    let body: {
      mode?: 'kembangkan' | 'rapikan' | 'ringkas' | 'ekstrak_tugas';
      judul?: string;
      isi?: string;
      kategori?: string;
      instruksi_khusus?: string;
    } = {};

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return galat('Body JSON tidak valid');
    }

    const mode = body.mode || 'kembangkan';
    const judul = (body.judul ?? '').trim();
    const isi = (body.isi ?? '').trim();

    if (!isi && !judul) {
      return galat('Isi atau judul memo tidak boleh kosong.');
    }

    const instruksiMode: Record<string, string> = {
      kembangkan: 'Kembangkan catatan/poin ini menjadi draf Internal Memo resmi yang komprehensif, terstruktur dengan heading Notion/Markdown (#, ##, ###), latar belakang, maksud & tujuan, detail pelaksanaan/teknis, dan penutup.',
      rapikan: 'Perbaiki tata bahasa, profesionalisme, struktur heading (#, ##), dan daftar poin dari teks ini tanpa mengubah maksud aslinya.',
      ringkas: 'Buat ringkasan eksekutif 2-4 kalimat yang padat dan jelas yang merangkum keseluruhan memo, serta usulan judul jika judul sekarang kurang tepat.',
      ekstrak_tugas: 'Identifikasi semua tugas, komitmen, dan rencana tindak lanjut dari memo ini, lalu susun menjadi daftar ceklis tugas dengan format "- [ ] Nama Tugas".',
    };

    const prompt = `
Anda adalah Asisten Eksekutif dan Spesialis Manajemen Dokumen Operasional Tambang & Kehutanan (Revegetasi / Nursery / K3).
Tugas Anda: ${instruksiMode[mode] || instruksiMode.kembangkan}

Data Memo Saat Ini:
- Judul: "${judul || 'Tanpa judul'}"
- Kategori: "${body.kategori || 'Operasional'}"
- Isi Catatan:
"""
${isi}
"""
${body.instruksi_khusus ? `- Catatan Khusus Pengguna: "${body.instruksi_khusus}"` : ''}

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
      const jawaban = await panggilGemini(apiKey, prompt);
      const jsonStr = ekstrakJson(jawaban);
      const hasil = JSON.parse(jsonStr);
      return json({ sukses: true, hasil });
    } catch (e) {
      return galat(e instanceof Error ? e.message : 'Gagal memproses memo dengan AI', 500);
    }
  }

  return null;
}
