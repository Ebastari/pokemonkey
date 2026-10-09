/**
 * Asisten AI modul Memo (Google Gemini) — POST /api/ai/memo/proses
 *
 * Berbeda dengan versi awal, AI di sini:
 *   - tahu sintaks memo POKEMONKEY (kamus di bawah), jadi hasilnya langsung
 *     tampil sebagai toggle, tabel, ceklis bertenggat, stabilo, dst.;
 *   - diberi konteks nyata: tanggal hari ini (WITA), anggota tim aktif, PICA
 *     terbuka, properti memo, sub-halaman;
 *   - menjawab dengan JSON terstruktur (responseSchema), bukan ditebak regex;
 *   - hasilnya diperiksa server: @id hanya anggota aktif, tanggal harus sah,
 *     #PICA harus ada, tabel/kode Markdown diubah ke format memo;
 *   - tidak pernah menulis ke memo: aplikasi yang memutuskan penempatannya
 *     (sisip, tambah di bawah, ganti) setelah pengguna melihat pratinjau.
 *
 * Mode:
 *   kembangkan     catatan kasar → memo utuh (model kuat)
 *   rapikan        perbaiki bahasa & struktur tanpa mengubah maksud
 *   ringkas        ringkasan eksekutif + usulan judul (isi tidak disentuh)
 *   ekstrak_tugas  daftar tugas terstruktur (teks, tenggat, PIC, PICA, alasan) untuk disunting pengguna
 *   tulis          tulis blok baru sesuai instruksi (untuk disisipkan di posisi kursor)
 *   pilihan        olah teks terpilih (perbaiki, persingkat, …, jadikan ceklis/tabel)
 */

import type { Env, Pengguna } from './tipe';
import {
  ambilTugas, bacaData, hakMemo, jamSah, rakitData, rakitGrafik, rakitKode, rakitTabel, tanggalSah, uraiBlok, INDENT,
} from './memo-blok';
import { tanggalWita, jamWita, geserHari, sekarangUtcIso } from './waktu';
import { ambilDataGeotag, ambilDataNursery } from './sumber-lapangan';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);

export type ModeMemoAi = 'kembangkan' | 'rapikan' | 'ringkas' | 'ekstrak_tugas' | 'tulis' | 'pilihan' | 'laporan';
export type AksiPilihanAi = 'perbaiki' | 'persingkat' | 'perpanjang' | 'resmi' | 'sederhana' | 'inggris' | 'indonesia' | 'ceklis' | 'tabel' | 'lanjutkan' | 'bebas';

const MAKS_MASUKAN = 60_000;

// ---------------------------------------------------------------------------
// Gemini: keluaran JSON terstruktur, model bertingkat, deteksi jawaban terpotong
// ---------------------------------------------------------------------------

type Tingkat = 'cepat' | 'kuat';

/** Daftar model per tingkat; bisa diganti lewat var GEMINI_MODEL_CEPAT / GEMINI_MODEL_KUAT (dipisah koma). */
function daftarModel(env: Env, tingkat: Tingkat): string[] {
  const atur = (tingkat === 'kuat' ? env.GEMINI_MODEL_KUAT : env.GEMINI_MODEL_CEPAT)?.split(',').map((x) => x.trim()).filter(Boolean);
  if (atur?.length) return atur;
  return tingkat === 'kuat'
    ? ['gemini-flash-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
    : ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
}

class GalatAi extends Error {}

async function mintaGemini(env: Env, o: {
  tingkat: Tingkat; sistem: string; pesan: string; skema: Record<string, unknown>; maksToken: number; suhu?: number;
}): Promise<{ data: Record<string, unknown>; model: string; masuk: number; keluar: number }> {
  let terakhir: Error | null = null;
  for (const model of daftarModel(env, o.tingkat)) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY ?? '' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: o.sistem }] },
          contents: [{ role: 'user', parts: [{ text: o.pesan }] }],
          generationConfig: {
            temperature: o.suhu ?? 0.35,
            maxOutputTokens: o.maksToken,
            responseMimeType: 'application/json',
            responseSchema: o.skema,
          },
        }),
      });
      if (!res.ok) throw new Error(`Model ${model} menjawab ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const d = (await res.json()) as {
        candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const c = d.candidates?.[0];
      if (c?.finishReason === 'MAX_TOKENS') {
        throw new GalatAi('Jawaban AI terpotong karena terlalu panjang. Pilih sebagian teks lalu gunakan AI pada bagian itu, atau persingkat instruksinya.');
      }
      const teks = c?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      if (!teks.trim()) throw new Error(`Model ${model} tidak menghasilkan jawaban`);
      return { data: JSON.parse(teks) as Record<string, unknown>, model, masuk: d.usageMetadata?.promptTokenCount ?? 0, keluar: d.usageMetadata?.candidatesTokenCount ?? 0 };
    } catch (e) {
      if (e instanceof GalatAi) throw e; // terpotong: model lain juga akan terpotong
      terakhir = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw terakhir ?? new Error('Gagal menghubungi Gemini.');
}

// ---------------------------------------------------------------------------
// Batas harian & catatan pemakaian (tabel ai_pemakaian, migrasi 0030)
// ---------------------------------------------------------------------------

/** Batas permintaan per orang per hari; var AI_BATAS_HARIAN (bawaan 60). Admin/SPV ×3, Pemantau ÷3. */
export function batasHarian(env: Env, peran: string): number {
  const dasar = Number(env.AI_BATAS_HARIAN) > 0 ? Math.floor(Number(env.AI_BATAS_HARIAN)) : 60;
  return peran === 'admin' || peran === 'supervisor' ? dasar * 3 : peran === 'pemantau' ? Math.ceil(dasar / 3) : dasar;
}

/** Jumlah permintaan hari ini; null bila tabel belum ada (migrasi 0030 belum dijalankan) — AI tetap jalan. */
async function terpakaiHariIni(env: Env, userId: string): Promise<number | null> {
  try {
    const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM ai_pemakaian WHERE user_id = ?1 AND tanggal = ?2').bind(userId, tanggalWita()).first<{ n: number }>();
    return r?.n ?? 0;
  } catch { return null; }
}

async function catatPemakaian(env: Env, userId: string, fitur: string, model: string | null, masuk: number, keluar: number, berhasil: boolean): Promise<void> {
  try {
    await env.DB.prepare(
      'INSERT INTO ai_pemakaian (user_id, fitur, model, token_masuk, token_keluar, berhasil, tanggal, pada) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)',
    ).bind(userId, fitur, model, masuk, keluar, berhasil ? 1 : 0, tanggalWita(), sekarangUtcIso()).run();
  } catch { /* tabel belum ada: pemakaian tidak tercatat, AI tetap jalan */ }
}

async function tolakBilaHabis(env: Env, p: Pengguna): Promise<Response | null> {
  const n = await terpakaiHariIni(env, p.id);
  const batas = batasHarian(env, p.peran);
  return n !== null && n >= batas
    ? galat(`Batas AI hari ini sudah tercapai (${batas} permintaan per hari). Coba lagi besok, atau minta Admin menaikkan AI_BATAS_HARIAN.`, 429)
    : null;
}

/** Panggil Gemini sambil memeriksa kuota dan mencatat pemakaian. */
async function mintaTercatat(env: Env, p: Pengguna, fitur: string, o: Parameters<typeof mintaGemini>[1]) {
  try {
    const h = await mintaGemini(env, o);
    await catatPemakaian(env, p.id, fitur, h.model, h.masuk, h.keluar, true);
    return h;
  } catch (e) {
    await catatPemakaian(env, p.id, fitur, null, 0, 0, false);
    throw e;
  }
}

/** GET /api/ai/pemakaian — sisa kuota saya; Admin/SPV juga melihat pemakaian tim bulan ini. */
export async function rutePemakaianAi(env: Env, p: Pengguna): Promise<Response> {
  const n = await terpakaiHariIni(env, p.id);
  const batas = batasHarian(env, p.peran);
  const hasil: Record<string, unknown> = { hari_ini: n ?? 0, batas, sisa: Math.max(0, batas - (n ?? 0)), tercatat: n !== null };
  if (n !== null && (p.peran === 'admin' || p.peran === 'supervisor')) {
    const { results } = await env.DB.prepare(
      `SELECT a.user_id, t.nama, COUNT(*) AS permintaan, SUM(a.token_masuk + a.token_keluar) AS token, SUM(CASE WHEN a.berhasil = 0 THEN 1 ELSE 0 END) AS gagal
         FROM ai_pemakaian a LEFT JOIN tim t ON t.id = a.user_id WHERE a.tanggal >= ?1 GROUP BY a.user_id ORDER BY permintaan DESC`,
    ).bind(`${tanggalWita().slice(0, 7)}-01`).all();
    hasil.tim_bulan_ini = results;
  }
  return json(hasil);
}

const S = (description?: string) => ({ type: 'STRING', ...(description ? { description } : {}) });
const SKEMA: Record<ModeMemoAi, Record<string, unknown>> = {
  kembangkan: {
    type: 'OBJECT',
    properties: { judul: S('Judul memo yang tajam'), isi: S('Isi memo lengkap dalam format POKEMONKEY'), ringkasan: S('Ringkasan eksekutif 2-3 kalimat, teks polos'), catatan_ai: S('Satu kalimat saran') },
    required: ['judul', 'isi', 'ringkasan', 'catatan_ai'],
  },
  rapikan: {
    type: 'OBJECT',
    properties: { judul: S(), isi: S('Isi memo yang dirapikan, format POKEMONKEY'), catatan_ai: S() },
    required: ['judul', 'isi', 'catatan_ai'],
  },
  ringkas: {
    type: 'OBJECT',
    properties: { ringkasan: S('2-4 kalimat, teks polos'), judul_usulan: S('Usulan judul; kosong bila judul sekarang sudah tepat'), catatan_ai: S() },
    required: ['ringkasan', 'judul_usulan', 'catatan_ai'],
  },
  ekstrak_tugas: {
    type: 'OBJECT',
    properties: {
      tugas: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            teks: S('Tindakan konkret yang bisa dikerjakan & dicek, tanpa tanda @ atau #'),
            tanggal: S('YYYY-MM-DD bila tenggat disebut/tersirat jelas; kosong bila tidak'),
            jam: S('HH:MM bila disebut; kosong bila tidak'),
            pic: S('id anggota dari daftar tim bila jelas dari catatan; kosong bila ragu'),
            pica: S('id PICA dari daftar bila tugas ini menindaklanjutinya; kosong bila tidak'),
            alasan: S('Dasar tanggal/PIC dari catatan, maksimal 12 kata'),
          },
          required: ['teks', 'tanggal', 'jam', 'pic', 'pica', 'alasan'],
        },
      },
      catatan_ai: S(),
    },
    required: ['tugas', 'catatan_ai'],
  },
  tulis: {
    type: 'OBJECT',
    properties: { isi: S('Blok baru dalam format POKEMONKEY'), catatan_ai: S() },
    required: ['isi', 'catatan_ai'],
  },
  pilihan: {
    type: 'OBJECT',
    properties: { hasil: S('Pengganti teks terpilih dalam format POKEMONKEY'), catatan_ai: S() },
    required: ['hasil', 'catatan_ai'],
  },
  laporan: {
    type: 'OBJECT',
    properties: { judul: S('Judul laporan dengan periode'), isi: S('Laporan lengkap dalam format POKEMONKEY'), ringkasan: S('Ringkasan eksekutif 2-3 kalimat, teks polos'), catatan_ai: S() },
    required: ['judul', 'isi', 'ringkasan', 'catatan_ai'],
  },
};

// ---------------------------------------------------------------------------
// Kamus sintaks memo (diajarkan ke AI) & penyaring hasil
// ---------------------------------------------------------------------------

const KAMUS = `
FORMAT ISI MEMO POKEMONKEY — satu blok = satu baris teks:
# Judul 1 · ## Judul 2 · ### Judul 3
- butir · 1. bernomor · - [ ] tugas · - [x] tugas selesai
>> Judul toggle (isinya = baris-baris berikutnya yang menjorok)
> kutipan · !! catatan penting (callout) · --- garis pemisah
Anak/sub-butir: awali baris dengan 2 spasi per tingkat (bukan tab, bukan 4 spasi).
Di dalam baris: **tebal** *miring* ~~coret~~ ++garis bawah++ \`kode\`
  {l:kuning|teks} = stabilo (kuning, hijau, biru, merah, oranye, ungu, pink, abu, putih) — hemat, hanya untuk hal kritis
  {w:merah|teks} = warna teks (merah, oranye, kuning, hijau, biru, ungu, pink, abu)
  @YYYY-MM-DD atau @YYYY-MM-DD HH:MM = tenggat (pada tugas, otomatis masuk Jadwal dan alarm HP)
  @id = penanggung jawab — HANYA id dari daftar tim; @id menyalakan alarm di HP orang itu, jadi jangan menebak
  #PICA-… = tautan PICA — HANYA id dari daftar PICA
Tabel = SATU baris: !tabel{"kepala":true,"baris":[["Kolom 1","Kolom 2"],["isi","isi"]]}
Blok kode = SATU baris: !kode{"bahasa":"teks","isi":"baris1\\nbaris2"} · Rumus: !rumus{"isi":"LaTeX"}
Grafik realisasi reklamasi (data hidup) = SATU baris: !grafik{"sumber":"reklamasi","tampil":"tahun"} (tampil: tahun | kegiatan | blok | lengkap)
Kartu data lapangan (data hidup) = SATU baris: !data{"sumber":"nursery","saring":{},"tampil":"kpi"} atau dengan "sumber":"geotag"
DILARANG: tabel Markdown (| a | b |), butir "* ", HTML, blok \`\`\`, emoji berlebihan.`.trim();

const ATURAN = `
Anda Asisten Dokumen Operasional untuk tim RNR (reklamasi, revegetasi, nursery, K3) PT Energi Batubara Lestari.
Bahasa Indonesia baku yang lugas dan profesional; istilah teknis lapangan dipertahankan.
JANGAN mengarang fakta, angka, nama, lokasi, atau tanggal yang tidak ada/tidak tersirat jelas di catatan. Bila perlu data yang belum ada, tulis penanda [isi: …].
Tanggal relatif ("besok", "Jumat depan", "akhir bulan") dihitung dari HARI INI pada konteks.
${KAMUS}`.trim();

/** Tabel Markdown "| a | b |" (dengan baris pemisah) → !tabel{…}. */
function tabelMarkdown(baris: string[]): string | null {
  const sel = (b: string) => b.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((x) => x.trim());
  if (baris.length < 2 || !/^\s*\|?\s*:?-{3,}/.test(baris[1])) return null;
  const isi = [sel(baris[0]), ...baris.slice(2).map(sel)];
  return rakitTabel(isi, true);
}

export interface KonteksSaring { timIds: Set<string>; picaIds: Set<string>; bolehOrang: boolean }

/**
 * Hasil AI → teks memo yang sah: ``` → !kode, tabel Markdown → !tabel, "* " → "- ",
 * tab → 2 spasi, lompatan indentasi dirapikan, HTML dibuang, @id/tanggal/#PICA yang tidak sah dilepas tandanya.
 */
export function saringIsiAi(isi: string, k: KonteksSaring): string {
  const masuk = isi.replace(/\r/g, '').replace(/\t/g, INDENT).split('\n');
  const keluar: string[] = [];
  for (let i = 0; i < masuk.length; i += 1) {
    const b = masuk[i];
    const pagar = b.match(/^\s*```\s*([\w+-]*)\s*$/);
    if (pagar) {
      const kode: string[] = [];
      i += 1;
      while (i < masuk.length && !/^\s*```\s*$/.test(masuk[i])) { kode.push(masuk[i]); i += 1; }
      keluar.push(rakitKode(pagar[1] ? pagar[1].toLowerCase().replace(/^javascript$/, 'js').replace(/^typescript$/, 'ts').replace(/^python$/, 'py') : 'teks', kode.join('\n')));
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(b)) {
      const blok: string[] = [];
      while (i < masuk.length && /^\s*\|.*\|\s*$/.test(masuk[i])) { blok.push(masuk[i]); i += 1; }
      i -= 1;
      keluar.push(tabelMarkdown(blok) ?? blok.join(' '));
      continue;
    }
    keluar.push(b);
  }
  let tingkatLalu = 0;
  return keluar.map((baris) => {
    const polos = baris.trim();
    if (polos.startsWith('!tabel{') || polos.startsWith('!kode{') || polos.startsWith('!rumus{') || polos.startsWith('!penanda{') || polos === '!daftarisi') {
      tingkatLalu = 0;
      return polos;
    }
    // Blok data hidup: dibakukan; yang rusak dibuang (tidak tampil sebagai teks aneh).
    if (polos.startsWith('!grafik')) { const g = uraiBlok(polos)[0]; tingkatLalu = 0; return g?.jenis === 'grafik' ? rakitGrafik(g) : ''; }
    if (polos.startsWith('!data')) { const d = bacaData(polos); tingkatLalu = 0; return d ? rakitData(d) : ''; }
    // Indentasi ganjil / 4 spasi ala Markdown dibulatkan ke tingkat 2-spasi.
    const spasi = (baris.match(/^ */) ?? [''])[0].length;
    let kedalaman = Math.floor((spasi + 1) / 2);
    let b = baris.slice(spasi);
    kedalaman = Math.min(kedalaman, tingkatLalu + 1); // tidak melompat lebih dari satu tingkat
    b = b
      .replace(/^[*+•] /, '- ')
      .replace(/^- \[[xX]\]/, '- [x]')
      .replace(/<(?!br>)\/?[a-z][^>]*>/gi, '')
      // Tanda yang tidak sah dilepas, teksnya dipertahankan.
      .replace(/@(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/g, (m, t: string, j?: string) => (tanggalSah(t) ? (j && !jamSah(j) ? `@${t}` : m) : t))
      .replace(/(^|[\s(])@([a-z][a-z0-9_-]{0,29}[a-z0-9_])(?![\w@-])/g, (m, a: string, id: string) => (k.bolehOrang && k.timIds.has(id) ? m : `${a}${id}`))
      .replace(/#(PICA-[0-9A-Za-z-]+)/g, (m, id: string) => (k.picaIds.has(id) ? m : id));
    tingkatLalu = b.trim() ? kedalaman : tingkatLalu;
    return b.trim() ? `${INDENT.repeat(kedalaman)}${b}` : '';
  }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const satuBaris = (s: unknown, maks: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, maks);
const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// ---------------------------------------------------------------------------
// Rute
// ---------------------------------------------------------------------------

const PERINTAH_PILIHAN: Record<AksiPilihanAi, string> = {
  perbaiki: 'Perbaiki ejaan, tata bahasa, dan kejelasan teks terpilih tanpa mengubah maksud maupun format bloknya.',
  persingkat: 'Persingkat teks terpilih menjadi kira-kira setengahnya; pertahankan semua fakta, angka, tanggal, dan nama.',
  perpanjang: 'Kembangkan teks terpilih menjadi lebih lengkap dan jelas (konteks, langkah, alasan) tanpa mengarang fakta baru.',
  resmi: 'Ubah nada teks terpilih menjadi resmi dan profesional, layak untuk memo dinas.',
  sederhana: 'Sederhanakan teks terpilih agar mudah dipahami pekerja lapangan; kalimat pendek.',
  inggris: 'Terjemahkan teks terpilih ke bahasa Inggris profesional; pertahankan format dan tanda @/#.',
  indonesia: 'Terjemahkan teks terpilih ke bahasa Indonesia baku; pertahankan format dan tanda @/#.',
  ceklis: 'Ubah teks terpilih menjadi daftar tugas "- [ ] …" yang konkret; tambahkan @tanggal/@id hanya bila jelas dari teks.',
  tabel: 'Ubah teks terpilih menjadi SATU baris tabel !tabel{…} dengan kolom yang masuk akal dari isinya.',
  lanjutkan: 'Lanjutkan tulisan setelah teks terpilih dengan 1-3 blok yang selaras; kembalikan teks terpilih ditambah lanjutannya.',
  bebas: 'Ubah teks terpilih sesuai INSTRUKSI PENGGUNA.',
};

const PERINTAH_MODE: Record<Exclude<ModeMemoAi, 'pilihan'>, string> = {
  kembangkan: 'Kembangkan catatan menjadi memo kerja yang utuh dan terstruktur: konteks/latar belakang, pokok bahasan atau keputusan, rincian pelaksanaan, dan tindak lanjut berupa ceklis (- [ ] …) bila ada. Pakai toggle untuk rincian panjang, tabel untuk data berkolom, callout untuk peringatan K3. Semua isi asli wajib tetap ada.',
  rapikan: 'Rapikan bahasa, ejaan, dan struktur (judul, butir, ceklis) tanpa mengubah maksud, fakta, tanggal, atau tanda @/#/[[…]]. Jangan menambah informasi baru.',
  ringkas: 'Buat ringkasan eksekutif 2-4 kalimat (teks polos) yang memuat keputusan, angka penting, dan tindak lanjut. Usulkan judul hanya bila judul sekarang kurang tepat.',
  ekstrak_tugas: 'Temukan semua tugas, komitmen, dan tindak lanjut di memo. Satu tugas = satu tindakan yang bisa dicek. Isi tanggal/jam/pic/pica HANYA bila jelas dari catatan; kosongkan bila ragu. Jangan ulangi tugas yang sudah berupa ceklis di memo kecuali perlu dipecah.',
  tulis: 'Tulis blok baru sesuai instruksi pengguna, selaras dengan isi memo yang sudah ada (jangan mengulang isi yang sudah ada).',
  laporan: 'Susun laporan operasional dari DATA LAPORAN di konteks. Angka WAJIB persis sama dengan data (jangan dibulatkan sembarangan, jangan mengarang). Struktur: ## Ringkasan, satu ## per sumber data (sisipkan baris blok data hidup yang diminta di bagian itu), ## Isu & rekomendasi, ## Tindak lanjut (ceklis "- [ ] …", @id hanya bila PIC jelas dari data). Sorot hal kritis (PICA telat, mortalitas tinggi, persen hidup rendah) dengan callout !! atau stabilo {l:kuning|…}.',
};

export async function ruteAiMemo(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!env.GEMINI_API_KEY) {
    return galat('Kunci API Gemini belum dikonfigurasi di server (wrangler secret put GEMINI_API_KEY).', 503);
  }
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return galat('Body JSON tidak valid.'); }

  const mode = (['kembangkan', 'rapikan', 'ringkas', 'ekstrak_tugas', 'tulis', 'pilihan', 'laporan'] as const).find((m) => m === b.mode) ?? 'kembangkan';
  const aksi = (Object.keys(PERINTAH_PILIHAN) as AksiPilihanAi[]).find((a) => a === b.aksi) ?? 'perbaiki';
  const judul = satuBaris(b.judul, 200);
  const isi = String(b.isi ?? '').slice(0, MAKS_MASUKAN);
  const pilihan = String(b.pilihan ?? '').slice(0, 20_000);
  const instruksi = String(b.instruksi_khusus ?? '').trim().slice(0, 2000);
  if (mode === 'pilihan' && !pilihan.trim()) return galat('Pilih teks dulu.');
  if (mode === 'tulis' && !instruksi) return galat('Tulis dulu apa yang perlu dibuat AI.');
  if (mode !== 'tulis' && mode !== 'pilihan' && mode !== 'laporan' && !isi.trim() && !judul) return galat('Memo masih kosong. Tulis judul atau beberapa poin terlebih dahulu.');
  const pilihLaporan = (b.laporan && typeof b.laporan === 'object' ? b.laporan : {}) as Record<string, unknown>;
  if (mode === 'laporan' && !['pica', 'reklamasi', 'nursery', 'geotag'].some((x) => pilihLaporan[x])) return galat('Pilih minimal satu sumber data laporan.');
  const habis = await tolakBilaHabis(env, pengguna);
  if (habis) return habis;

  // ---- konteks: memo (bila disebut, hak baca diperiksa), tim aktif, PICA terbuka
  let lingkup = b.lingkup === 'pribadi' ? 'pribadi' : 'tim';
  let infoMemo = '';
  if (typeof b.memo_id === 'string' && b.memo_id) {
    const m = await env.DB.prepare(
      `SELECT m.id, m.user_id, m.lingkup, m.akses, m.izin, m.kategori, m.tipe, m.status, m.tanggal, m.pica_id, p.judul AS pica_judul
         FROM memo m LEFT JOIN pica p ON p.id = m.pica_id WHERE m.id = ?1 AND m.dihapus_pada IS NULL`,
    ).bind(b.memo_id).first<{ id: string; user_id: string; lingkup: string; akses: string | null; izin: string | null; kategori: string | null; tipe: string | null; status: string | null; tanggal: string | null; pica_id: string | null; pica_judul: string | null }>();
    if (!m || !hakMemo(m, pengguna)) return galat('Memo tidak ditemukan.', 404);
    // Isi memo rahasia tidak pernah dikirim ke layanan AI (server Google).
    if (m.lingkup === 'rahasia') return galat('AI tidak dipakai untuk memo rahasia.', 403);
    lingkup = m.lingkup === 'pribadi' ? 'pribadi' : 'tim';
    const { results: anak } = await env.DB.prepare('SELECT judul FROM memo WHERE induk_id = ?1 AND dihapus_pada IS NULL LIMIT 20').bind(m.id).all<{ judul: string }>();
    infoMemo = [
      `Lingkup: ${lingkup === 'tim' ? 'Memo Internal tim' : 'Catatan pribadi'}`,
      m.kategori && `Kategori: ${m.kategori}`, m.tipe && `Tipe: ${m.tipe}`, m.status && `Status: ${m.status}`, m.tanggal && `Tanggal memo: ${m.tanggal}`,
      m.pica_id && `PICA tertaut: #${m.pica_id} — ${m.pica_judul ?? ''}`,
      anak.length && `Sub-halaman: ${anak.map((x) => x.judul || 'Tanpa judul').join('; ')}`,
    ].filter(Boolean).join('\n');
  }
  const bolehOrang = lingkup === 'tim';
  const [tim, pica] = await Promise.all([
    env.DB.prepare('SELECT id, nama, jabatan, bidang FROM tim WHERE aktif = 1 ORDER BY nama').all<{ id: string; nama: string; jabatan: string | null; bidang: string | null }>(),
    env.DB.prepare(`SELECT id, judul, status FROM pica WHERE dihapus = 0 AND status <> 'Closed' ORDER BY rowid DESC LIMIT 40`).all<{ id: string; judul: string; status: string }>(),
  ]);
  const saring: KonteksSaring = { timIds: new Set(tim.results.map((t) => t.id)), picaIds: new Set(pica.results.map((p) => p.id)), bolehOrang };
  const hariIni = tanggalWita();
  const namaHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][new Date(`${hariIni}T00:00:00Z`).getUTCDay()];

  const konteks = [
    `HARI INI: ${namaHari}, ${hariIni} pukul ${jamWita()} WITA`,
    `Penulis permintaan: ${pengguna.nama} (@${pengguna.id})`,
    bolehOrang
      ? `DAFTAR TIM (id · nama · jabatan/bidang):\n${tim.results.map((t) => `@${t.id} · ${t.nama} · ${[t.jabatan, t.bidang].filter(Boolean).join(' / ')}`).join('\n')}`
      : 'Catatan pribadi: JANGAN memakai @id orang.',
    pica.results.length ? `PICA TERBUKA:\n${pica.results.map((p) => `#${p.id} · ${p.judul} (${p.status})`).join('\n')}` : '',
    infoMemo,
  ].filter(Boolean).join('\n\n');

  const dataLaporan = mode === 'laporan' ? await susunDataLaporan(env, pilihLaporan, hariIni) : '';
  const perintah = mode === 'pilihan' ? `${PERINTAH_PILIHAN[aksi]} Kembalikan HANYA pengganti teks terpilih.` : PERINTAH_MODE[mode];
  const pesan = [
    konteks,
    `JUDUL MEMO: ${judul || 'Tanpa judul'}`,
    `ISI MEMO SAAT INI:\n"""\n${isi || '(kosong)'}\n"""`,
    mode === 'pilihan' ? `TEKS TERPILIH:\n"""\n${pilihan}\n"""` : '',
    dataLaporan ? `DATA LAPORAN (sumber resmi, angka persis):\n${dataLaporan}` : '',
    instruksi ? `INSTRUKSI PENGGUNA: ${instruksi}` : '',
    `TUGAS: ${perintah}`,
  ].filter(Boolean).join('\n\n');

  const panjang = mode === 'kembangkan' || mode === 'rapikan' || mode === 'tulis' || mode === 'laporan';
  try {
    const { data, model } = await mintaTercatat(env, pengguna, `memo:${mode}`, {
      tingkat: mode === 'kembangkan' || mode === 'ekstrak_tugas' || mode === 'tulis' || mode === 'laporan' ? 'kuat' : 'cepat',
      sistem: ATURAN,
      pesan,
      skema: SKEMA[mode],
      maksToken: panjang ? 16_384 : 4096,
      suhu: mode === 'rapikan' || mode === 'pilihan' ? 0.2 : 0.4,
    });

    // ---- periksa & rapikan hasil
    const hasil: Record<string, unknown> = { catatan_ai: satuBaris(data.catatan_ai, 300) };
    if (typeof data.judul === 'string') hasil.judul = satuBaris(data.judul, 150);
    if (typeof data.ringkasan === 'string') hasil.ringkasan = String(data.ringkasan).replace(/\s+/g, ' ').trim().slice(0, 800);
    if (typeof data.judul_usulan === 'string') hasil.judul_usulan = satuBaris(data.judul_usulan, 150);
    if (typeof data.isi === 'string') hasil.isi = saringIsiAi(data.isi, saring);
    if (typeof data.hasil === 'string') hasil.hasil = saringIsiAi(data.hasil, saring);
    if (Array.isArray(data.tugas)) {
      const ada = new Set(ambilTugas(isi).map((t) => normal(t.judul)));
      const dilihat = new Set<string>();
      hasil.tugas = (data.tugas as Record<string, unknown>[]).flatMap((t) => {
        const teks = satuBaris(t.teks, 300).replace(/^- \[[ xX]\]\s*/, '').replace(/[@#]/g, '');
        if (!teks || dilihat.has(normal(teks))) return [];
        dilihat.add(normal(teks));
        const tanggal = tanggalSah(String(t.tanggal ?? '')) && String(t.tanggal) >= hariIni ? String(t.tanggal) : '';
        const jam = tanggal && jamSah(String(t.jam ?? '')) ? String(t.jam) : '';
        const pic = bolehOrang && saring.timIds.has(String(t.pic ?? '').replace(/^@/, '')) ? String(t.pic).replace(/^@/, '') : '';
        const pc = saring.picaIds.has(String(t.pica ?? '').replace(/^#/, '')) ? String(t.pica).replace(/^#/, '') : '';
        return [{ teks, tanggal, jam, pic, pica: pc, alasan: satuBaris(t.alasan, 120), sudah_ada: ada.has(normal(teks)) }];
      }).slice(0, 40);
    }
    return json({ sukses: true, hasil, model });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal memproses memo dengan AI.', e instanceof GalatAi ? 422 : 502);
  }
}

// ---------------------------------------------------------------------------
// Laporan otomatis: data resmi untuk AI (PICA, reklamasi, nursery, geotag)
// ---------------------------------------------------------------------------

async function susunDataLaporan(env: Env, pilih: Record<string, unknown>, hariIni: string): Promise<string> {
  const dari = pilih.periode === 'bulan' ? `${hariIni.slice(0, 7)}-01` : geserHari(hariIni, -6);
  const bagian: string[] = [`Periode laporan: ${dari} s.d. ${hariIni}`];
  if (pilih.pica) {
    try {
      const n = await env.DB.prepare(
        `SELECT SUM(CASE WHEN status <> 'Closed' THEN 1 ELSE 0 END) AS terbuka,
                SUM(CASE WHEN status <> 'Closed' AND due_date IS NOT NULL AND due_date < ?1 THEN 1 ELSE 0 END) AS telat,
                SUM(CASE WHEN status = 'Closed' AND substr(COALESCE(ditutup_pada, ''), 1, 10) >= ?2 THEN 1 ELSE 0 END) AS ditutup_periode,
                SUM(CASE WHEN substr(dibuat_pada, 1, 10) >= ?2 THEN 1 ELSE 0 END) AS baru_periode
           FROM pica WHERE dihapus = 0`,
      ).bind(hariIni, dari).first<Record<string, number>>();
      const { results } = await env.DB.prepare(
        `SELECT p.id, p.judul, p.status, p.due_date, p.bidang, p.prioritas, p.pic_id, t.nama AS pic
           FROM pica p LEFT JOIN tim t ON t.id = p.pic_id WHERE p.dihapus = 0 AND p.status <> 'Closed'
          ORDER BY (p.due_date IS NULL), p.due_date LIMIT 30`,
      ).all<{ id: string; judul: string; status: string; due_date: string | null; bidang: string; prioritas: string; pic_id: string | null; pic: string | null }>();
      bagian.push(`[PICA] terbuka ${n?.terbuka ?? 0}, telat ${n?.telat ?? 0}, baru di periode ${n?.baru_periode ?? 0}, ditutup di periode ${n?.ditutup_periode ?? 0}.\n`
        + results.map((x) => `#${x.id} · ${x.judul} · ${x.status} · prioritas ${x.prioritas} · ${x.bidang} · tenggat ${x.due_date ?? '-'}${x.due_date && x.due_date < hariIni ? ' (TELAT)' : ''} · PIC ${x.pic ? `${x.pic} (@${x.pic_id})` : '-'}`).join('\n'));
    } catch { bagian.push('[PICA] data tidak dapat dibaca.'); }
  }
  if (pilih.reklamasi) {
    try {
      const { results } = await env.DB.prepare('SELECT tahun, apl, hutan, ipd, opd, timbunan_soil, fasilitas FROM revegetasi ORDER BY tahun').all<Record<string, number>>();
      const total = results.reduce((a, r) => a + Math.round(((r.apl ?? 0) + (r.hutan ?? 0)) * 1000), 0) / 1000;
      bagian.push(`[REKLAMASI] Realisasi revegetasi (ha), sisipkan baris: !grafik{"sumber":"reklamasi","tampil":"tahun"}\nTotal ${total} ha.\n`
        + results.map((r) => `${r.tahun}: APL ${r.apl}, Hutan ${r.hutan}, IPD ${r.ipd}, OPD ${r.opd}, Timbunan soil ${r.timbunan_soil}, Fasilitas ${r.fasilitas}`).join('\n'));
    } catch { bagian.push('[REKLAMASI] data tidak dapat dibaca.'); }
  }
  if (pilih.nursery) {
    try {
      const d = await ambilDataNursery(env, { dari, sampai: hariIni });
      const r = d.ringkasan;
      bagian.push(`[NURSERY] sisipkan baris: !data{"sumber":"nursery","saring":{},"tampil":"kpi"}\n`
        + `Stok ${r.stok} btg${r.stok_sahih ? '' : ' (tersaring)'}, masuk ${r.masuk}, keluar ${r.keluar}, mati ${r.mati}, mortalitas ${r.mortalitas}%, ${r.jml_jenis} jenis.\n`
        + d.jenis.slice(0, 10).map((j) => `${j.nama}: stok ${j.stok}, mortalitas ${j.mortalitas}% (${j.status})`).join('\n')
        + (d.proyeksi.ada ? `\nProyeksi habis stok: ${d.proyeksi.perkiraan_habis} (${d.proyeksi.hari_tersisa} hari)` : ''));
    } catch { bagian.push('[NURSERY] data tidak dapat dibaca.'); }
  }
  if (pilih.geotag) {
    try {
      const d = await ambilDataGeotag(env, { dari, sampai: hariIni });
      const r = d.ringkasan;
      bagian.push(`[GEOTAG] sisipkan baris: !data{"sumber":"geotag","saring":{},"tampil":"kpi"}\n`
        + `Total ${r.total} pohon, sehat ${r.sehat}, merana ${r.merana}, mati ${r.mati}, hidup ${r.persen_hidup}%, tinggi rata-rata ${r.tinggi_avg} cm. `
        + `Karbon ${d.karbon.karbon_ton} t C (≈ ${d.karbon.co2e_ton} t CO2e) — WAJIB sertakan batasnya: ${d.karbon.batas.join(' ')}\n`
        + d.per_lokasi.slice(0, 10).map((l) => `${l.lokasi}: ${l.total} pohon, hidup ${l.persen_hidup}%`).join('\n'));
    } catch { bagian.push('[GEOTAG] data tidak dapat dibaca.'); }
  }
  return bagian.join('\n\n');
}

// ---------------------------------------------------------------------------
// Tanya semua memo — POST /api/ai/memo/tanya { pertanyaan }
// Cari kata kunci di memo yang boleh dibaca penanya (memo tim + catatan pribadinya),
// lalu AI menjawab HANYA dari kutipan itu dengan sumber [[memo:id|judul]].
// ---------------------------------------------------------------------------

const KATA_UMUM = new Set((
  'yang dan di ke dari untuk dengan pada adalah ini itu apa apakah kapan siapa mana bagaimana berapa kenapa mengapa saja ada '
  + 'tidak sudah belum akan bisa dalam atau juga oleh sebagai karena tolong mohon saya kita kami memo tentang soal hal yg gimana '
  + 'dong nya kah lah pun para sebuah suatu agar supaya lalu kemudian semua setiap terhadap antara sampai hingga sejak masih telah '
  + 'sedang harus perlu boleh mau ingin coba buat buatkan jelaskan sebutkan carikan cari tampilkan berikan terakhir pernah apakah'
).split(' '));

export function kataKunci(q: string): string[] {
  return [...new Set(q.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !KATA_UMUM.has(w)))].slice(0, 8);
}

/** Kutipan memo di sekitar kata kunci (memo pendek dikirim utuh). */
function kutipan(isi: string, kata: string[], maks = 1500): string {
  if (isi.length <= maks) return isi;
  const baris = isi.split('\n');
  const pakai = new Set<number>();
  baris.forEach((b, i) => { if (kata.some((k) => b.toLowerCase().includes(k))) [i - 1, i, i + 1].forEach((j) => { if (j >= 0 && j < baris.length) pakai.add(j); }); });
  let hasil = '';
  for (const i of [...pakai].sort((a, b) => a - b)) {
    if (hasil.length + baris[i].length > maks) break;
    hasil += `${baris[i]}\n`;
  }
  return hasil || isi.slice(0, maks);
}

export async function ruteTanyaMemo(req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  if (!env.GEMINI_API_KEY) return galat('Kunci API Gemini belum dikonfigurasi di server (wrangler secret put GEMINI_API_KEY).', 503);
  let b: Record<string, unknown>;
  try { b = (await req.json()) as Record<string, unknown>; } catch { return galat('Body JSON tidak valid.'); }
  const pertanyaan = String(b.pertanyaan ?? '').trim().slice(0, 500);
  if (!pertanyaan) return galat('Tulis pertanyaannya dulu.');
  const kata = kataKunci(pertanyaan);
  if (!kata.length) return galat('Pertanyaan terlalu umum — sebut kata kuncinya, mis. "kapan servis genset terakhir?".');
  const habis = await tolakBilaHabis(env, pengguna);
  if (habis) return habis;

  const syarat = kata.map((_, i) => `(m.judul LIKE ?${i + 2} OR m.isi LIKE ?${i + 2} OR COALESCE(m.ringkasan, '') LIKE ?${i + 2})`).join(' OR ');
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.judul, m.isi, m.ringkasan, m.tanggal, m.lingkup, m.dibuat_pada, m.diubah_pada
       FROM memo m WHERE m.dihapus_pada IS NULL AND m.lingkup <> 'rahasia' AND (m.lingkup = 'tim' OR m.user_id = ?1) AND (${syarat})
      ORDER BY COALESCE(m.diubah_pada, m.dibuat_pada) DESC LIMIT 200`,
  ).bind(pengguna.id, ...kata.map((k) => `%${k}%`)).all<{ id: string; judul: string; isi: string; ringkasan: string | null; tanggal: string | null; lingkup: string; dibuat_pada: string; diubah_pada: string | null }>();

  const nilai = (m: (typeof results)[number]) => {
    const j = m.judul.toLowerCase();
    const isi = m.isi.toLowerCase();
    const r = (m.ringkasan ?? '').toLowerCase();
    const kena = kata.filter((k) => j.includes(k) || isi.includes(k) || r.includes(k)).length;
    return kena * 4 + kata.reduce((n, k) => n + (j.includes(k) ? 6 : 0) + Math.min(10, isi.split(k).length - 1) + (r.includes(k) ? 2 : 0), 0);
  };
  const kandidat = results.map((m) => ({ m, n: nilai(m) })).filter((x) => x.n > 0).sort((a, c) => c.n - a.n).slice(0, 8).map((x) => x.m);
  if (!kandidat.length) {
    return json({ jawaban: `Tidak ditemukan memo yang memuat: ${kata.join(', ')}. Coba kata kunci lain.`, sumber: [], yakin: 'rendah', kata });
  }

  const sumberTeks = kandidat.map((m) => (
    `=== [[memo:${m.id}|${m.judul.replace(/[\]|\n]/g, ' ') || 'Tanpa judul'}]] · ${m.lingkup === 'tim' ? 'Memo Internal' : 'Catatan pribadi'} · tanggal ${m.tanggal ?? m.dibuat_pada.slice(0, 10)}`
    + `${m.ringkasan ? `\nRingkasan: ${m.ringkasan}` : ''}\n${kutipan(m.isi, kata)}`
  )).join('\n\n');
  const sistem = `Anda menjawab pertanyaan tim RNR PT Energi Batubara Lestari HANYA berdasarkan kutipan memo yang diberikan.
Setiap fakta WAJIB diberi sumber dengan menyalin penanda [[memo:ID|Judul]] memo asalnya tepat setelah kalimatnya.
Bila jawabannya tidak ada di kutipan, katakan terus terang "Tidak ditemukan di memo" lalu sarankan kata kunci lain — jangan menebak.
Bila ada beberapa catatan yang berbeda waktu, sebutkan yang terbaru dan tanggalnya.
Jawab ringkas dalam bahasa Indonesia; boleh memakai butir, ceklis, atau tabel format POKEMONKEY.
${KAMUS}`;
  try {
    const { data, model } = await mintaTercatat(env, pengguna, 'memo:tanya', {
      tingkat: 'kuat', sistem, maksToken: 4096, suhu: 0.2,
      pesan: `HARI INI: ${tanggalWita()}\n\nPERTANYAAN: ${pertanyaan}\n\nKUTIPAN MEMO:\n${sumberTeks}`,
      skema: {
        type: 'OBJECT',
        properties: {
          jawaban: S('Jawaban dengan sumber [[memo:ID|Judul]]'),
          sumber: { type: 'ARRAY', items: S('ID memo yang dipakai') },
          yakin: S('tinggi | sedang | rendah'),
        },
        required: ['jawaban', 'sumber', 'yakin'],
      },
    });
    const ada = new Map(kandidat.map((m) => [m.id, m]));
    // Tautan hanya ke memo yang benar-benar dikutip; judulnya diambil dari data, bukan dari AI.
    const jawaban = saringIsiAi(String(data.jawaban ?? ''), { timIds: new Set(), picaIds: new Set(), bolehOrang: false })
      .replace(/\[\[memo:([\w-]+)\|([^\]\n]*)\]\]/g, (m0, id: string, label: string) => {
        const m = ada.get(id);
        return m ? `[[memo:${id}|${(m.judul || 'Tanpa judul').replace(/[\]|\n]/g, ' ')}]]` : label;
      });
    const dipakai = new Set([...(Array.isArray(data.sumber) ? data.sumber.map(String) : []), ...[...jawaban.matchAll(/\[\[memo:([\w-]+)\|/g)].map((x) => x[1])]);
    const sumber = kandidat.filter((m) => dipakai.has(m.id)).map((m) => ({ id: m.id, judul: m.judul || 'Tanpa judul', tanggal: m.tanggal ?? m.dibuat_pada.slice(0, 10), lingkup: m.lingkup }));
    const yakin = ['tinggi', 'sedang', 'rendah'].includes(String(data.yakin)) ? String(data.yakin) : 'sedang';
    return json({ jawaban, sumber, yakin, model, kata });
  } catch (e) {
    return galat(e instanceof Error ? e.message : 'Gagal menjawab dengan AI.', e instanceof GalatAi ? 422 : 502);
  }
}
