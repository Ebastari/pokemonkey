/**
 * Utilitas Parser CSV, Generator Template, dan Pembuat Prompt AI untuk PICA POKEMONKEY.
 * Mendukung RFC-4180 (kutip dua, koma di dalam teks, pemisah koma atau titik koma),
 * pemetaan sinonim kolom cerdas (AI-friendly), dan pencocokan nama PIC ke daftar tim.
 */

import type { Bootstrap, AnggotaRingkas } from './tipe-api';

export interface PicaCsvBaris {
  barisKe: number;
  bidang: string;
  prioritas: string;
  judul: string;
  akar: string;
  tindakan: string;
  pic_id: string | null;
  pic_input: string;
  pic_nama: string | null;
  due_date: string | null;
  target: number | null;
  realisasi: number | null;
  satuan: string | null;
  judul_singkat: string | null;
  valid: boolean;
  pesanGalat: string[];
  peringatan: string[];
}

/**
 * Parsing teks CSV menjadi matriks 2D string.
 * Menangani karakter kutip ganda RFC-4180, pemisah `,` atau `;`, dan strip UTF-8 BOM.
 */
export function parseCsv(teks: string): string[][] {
  const bersih = teks.replace(/^\uFEFF/, '').trim();
  if (!bersih) return [];

  // Deteksi pemisah di baris pertama (, atau ;)
  const barisPertama = bersih.split(/\r\n|\n|\r/)[0] || '';
  const hitungKoma = (barisPertama.match(/,/g) || []).length;
  const hitungTitikKoma = (barisPertama.match(/;/g) || []).length;
  const pemisah = hitungTitikKoma > hitungKoma ? ';' : ',';

  const barisHasil: string[][] = [];
  let barisSaatIni: string[] = [];
  let nilaiSaatIni = '';
  let dalamKutip = false;

  for (let i = 0; i < bersih.length; i++) {
    const c = bersih[i];
    const cBerikut = bersih[i + 1];

    if (c === '"') {
      if (dalamKutip && cBerikut === '"') {
        nilaiSaatIni += '"';
        i++; // lewati quote ganda yang di-escape
      } else {
        dalamKutip = !dalamKutip;
      }
    } else if (c === pemisah && !dalamKutip) {
      barisSaatIni.push(nilaiSaatIni.trim());
      nilaiSaatIni = '';
    } else if ((c === '\r' || c === '\n') && !dalamKutip) {
      if (c === '\r' && cBerikut === '\n') i++;
      barisSaatIni.push(nilaiSaatIni.trim());
      if (barisSaatIni.some((col) => col.length > 0)) {
        barisHasil.push(barisSaatIni);
      }
      barisSaatIni = [];
      nilaiSaatIni = '';
    } else {
      nilaiSaatIni += c;
    }
  }

  // Baris terakhir bila tidak diakhiri newline
  if (nilaiSaatIni.length > 0 || barisSaatIni.length > 0) {
    barisSaatIni.push(nilaiSaatIni.trim());
    if (barisSaatIni.some((col) => col.length > 0)) {
      barisHasil.push(barisSaatIni);
    }
  }

  return barisHasil;
}

/**
 * Kamus sinonim kolom agar format yang dihasilkan AI Agent tetap terbaca
 * meskipun menggunakan nama kolom alternatif dalam Bahasa Indonesia maupun Inggris.
 */
const ALIAS_KOLOM: Record<string, string[]> = {
  judul: ['judul', 'masalah', 'uraian', 'problem', 'issue', 'title', 'temuan', 'fakta', 'uraian_masalah'],
  bidang: ['bidang', 'area', 'departemen', 'dept', 'kategori', 'category', 'sektor'],
  prioritas: ['prioritas', 'priority', 'tingkat', 'level', 'urgensi'],
  akar: ['akar', 'akar_masalah', 'root_cause', 'sebab', 'penyebab', 'cause'],
  tindakan: ['tindakan', 'tindakan_korektif', 'action', 'corrective_action', 'rencana', 'solusi', 'solution', 'rencana_tindakan'],
  pic: ['pic', 'pic_id', 'penanggung_jawab', 'assignee', 'owner', 'pelaksana', 'nama_pic', 'pic_nama'],
  due_date: ['due_date', 'deadline', 'tenggat', 'target_selesai', 'tanggal_selesai', 'target_date', 'due'],
  target: ['target', 'kuantitas', 'qty', 'rencana_target'],
  realisasi: ['realisasi', 'actual', 'progres', 'capaian', 'progress', 'capai'],
  satuan: ['satuan', 'unit', 'satuan_target', 'satuan_capaian'],
  judul_singkat: ['judul_singkat', 'short_title', 'ringkasan', 'summary', 'rekap_wa', 'judul_wa'],
};

function cariKunciKolom(namaHeader: string): string | null {
  const norm = namaHeader.toLowerCase().replace(/[\s_-]+/g, '_').trim();
  for (const [kunci, daftarAlias] of Object.entries(ALIAS_KOLOM)) {
    if (daftarAlias.includes(norm)) return kunci;
  }
  return null;
}

/**
 * Mencocokkan input teks PIC dari CSV ke anggota tim POKEMONKEY secara cerdas.
 */
export function cocokkanPic(raw: string, tim: AnggotaRingkas[]): { id: string | null; nama: string | null } {
  const teks = raw.trim().toLowerCase();
  if (!teks || teks === '-' || teks === '—') return { id: null, nama: null };

  // 1. Cocok ID persis
  const viaId = tim.find((t) => t.id.toLowerCase() === teks);
  if (viaId) return { id: viaId.id, nama: viaId.nama };

  // 2. Cocok nama persis
  const viaNama = tim.find((t) => t.nama.toLowerCase() === teks);
  if (viaNama) return { id: viaNama.id, nama: viaNama.nama };

  // 3. Cocok nama bagian depan / kata pertama
  const kataPertama = teks.split(' ')[0];
  if (kataPertama && kataPertama.length >= 3) {
    const viaKata = tim.find((t) => t.nama.toLowerCase().split(' ')[0] === kataPertama);
    if (viaKata) return { id: viaKata.id, nama: viaKata.nama };
  }

  // 4. Cocok substring
  const viaSub = tim.find(
    (t) => t.nama.toLowerCase().includes(teks) || teks.includes(t.nama.toLowerCase()),
  );
  if (viaSub) return { id: viaSub.id, nama: viaSub.nama };

  return { id: null, nama: null };
}

/**
 * Normalisasi format tanggal ke format baku YYYY-MM-DD
 */
function normalisasiTanggal(raw: string): string | null {
  const t = raw.trim();
  if (!t || t === '-' || t === '—') return null;

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const polaDmy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (polaDmy) {
    const [, h, b, th] = polaDmy;
    return `${th}-${b.padStart(2, '0')}-${h.padStart(2, '0')}`;
  }

  return t; // simpan apa adanya bila tidak cocok pola standar
}

/**
 * Memproses matriks CSV mentah menjadi daftar baris PICA terstruktur beserta validasi.
 */
export function prosesCsvPica(
  matriks: string[][],
  tim: AnggotaRingkas[],
  daftarBidang: string[],
): { baris: PicaCsvBaris[]; totalValid: number; totalGalat: number } {
  if (matriks.length === 0) return { baris: [], totalValid: 0, totalGalat: 0 };

  const barisHeader = matriks[0];
  const petaIndeks: Record<string, number> = {};

  barisHeader.forEach((h, idx) => {
    const kunci = cariKunciKolom(h);
    if (kunci) petaIndeks[kunci] = idx;
  });

  const barisData = matriks.slice(1);
  const hasil: PicaCsvBaris[] = [];
  let totalValid = 0;
  let totalGalat = 0;

  barisData.forEach((row, indeks) => {
    // Lewati baris kosong
    if (!row.some((cell) => cell.length > 0)) return;

    const barisKe = indeks + 2; // 1-based, +1 karena baris 1 adalah header
    const ambil = (kunci: string): string => {
      const idx = petaIndeks[kunci];
      return idx !== undefined && row[idx] !== undefined ? row[idx].trim() : '';
    };

    const pesanGalat: string[] = [];
    const peringatan: string[] = [];

    // Judul (Wajib)
    const judul = ambil('judul');
    if (!judul) {
      pesanGalat.push('Masalah / uraian fakta wajib diisi.');
    }

    // Bidang (Wajib / Default ke bidang pertama)
    let bidang = ambil('bidang');
    if (!bidang) {
      if (daftarBidang.length > 0) {
        bidang = daftarBidang[0];
        peringatan.push(`Bidang kosong, otomatis diset ke "${bidang}".`);
      } else {
        bidang = 'Umum';
      }
    } else {
      // Cocokkan case-insensitive ke bidang resmi.
      const cocokBidang = daftarBidang.find((b) => b.toLowerCase() === bidang.toLowerCase());
      if (cocokBidang) {
        bidang = cocokBidang;
      } else if (daftarBidang.length > 0) {
        // Bidang di luar daftar membuat PICA tidak bisa disaring di layar, jadi
        // barisnya ditolak sampai dibetulkan.
        pesanGalat.push(`Bidang "${bidang}" tidak dikenal. Pilih salah satu: ${daftarBidang.join(', ')}.`);
      }
    }

    // Prioritas (Tinggi | Sedang | Rendah)
    const prioRaw = ambil('prioritas').toLowerCase();
    let prioritas = 'Sedang';
    if (prioRaw.includes('tinggi') || prioRaw.includes('high') || prioRaw === 'p1') {
      prioritas = 'Tinggi';
    } else if (prioRaw.includes('rendah') || prioRaw.includes('low') || prioRaw === 'p3') {
      prioritas = 'Rendah';
    } else if (prioRaw.includes('sedang') || prioRaw.includes('med') || prioRaw === 'p2') {
      prioritas = 'Sedang';
    }

    // Akar & Tindakan
    const akar = ambil('akar');
    const tindakan = ambil('tindakan');

    // PIC
    const picRaw = ambil('pic');
    let picId: string | null = null;
    let picNama: string | null = null;
    if (picRaw) {
      const cocok = cocokkanPic(picRaw, tim);
      picId = cocok.id;
      picNama = cocok.nama;
      if (!picId) {
        peringatan.push(`PIC "${picRaw}" tidak cocok dengan daftar tim POKEMONKEY.`);
      }
    }

    // Due Date
    const dueRaw = ambil('due_date');
    const dueDate = dueRaw ? normalisasiTanggal(dueRaw) : null;
    if (dueRaw && !dueDate) {
      peringatan.push(`Format tanggal "${dueRaw}" tidak baku (disarankan YYYY-MM-DD).`);
    }

    // Target & Realisasi
    const targetRaw = ambil('target');
    const realisasiRaw = ambil('realisasi');
    const target = targetRaw !== '' && !isNaN(Number(targetRaw)) ? Number(targetRaw) : null;
    const realisasi = realisasiRaw !== '' && !isNaN(Number(realisasiRaw)) ? Number(realisasiRaw) : null;

    // Satuan
    const satuan = ambil('satuan') || null;

    // Judul Singkat
    let judulSingkat = ambil('judul_singkat') || null;
    if (judulSingkat && judulSingkat.length > 80) {
      judulSingkat = judulSingkat.slice(0, 80);
    }

    const valid = pesanGalat.length === 0;
    if (valid) totalValid++;
    else totalGalat++;

    hasil.push({
      barisKe,
      bidang,
      prioritas,
      judul,
      akar,
      tindakan,
      pic_id: picId,
      pic_input: picRaw,
      pic_nama: picNama,
      due_date: dueDate,
      target,
      realisasi,
      satuan,
      judul_singkat: judulSingkat,
      valid,
      pesanGalat,
      peringatan,
    });
  });

  return { baris: hasil, totalValid, totalGalat };
}

/**
 * Menghasilkan teks CSV template yang siap diunduh oleh pengguna.
 */
export function hasilkanTemplateCsv(daftarBidang: string[], tim: AnggotaRingkas[]): string {
  const namaPicContoh1 = tim[0]?.nama || 'Daniel';
  const namaPicContoh2 = tim[1]?.nama || 'Agung Laksono';
  const bidang1 = daftarBidang[0] || 'Nursery';
  const bidang2 = daftarBidang[1] || 'Revegetasi';

  const baris = [
    'bidang,prioritas,judul,akar,tindakan,pic,due_date,target,realisasi,satuan,judul_singkat',
    `${bidang1},Tinggi,"Bibit sengon potting kurang 3.000 batang","Keterlambatan suplai media tanam dari vendor","Percepat pengiriman vendor dan tambah jam shift pengisian polibag",${namaPicContoh1},2026-10-15,3000,0,batang,"Potting sengon kurang 3rb btg"`,
    `${bidang2},Sedang,"Luasan tanam blok A belum mencapai target mingguan","Hujan lebat selama 3 hari berturut-turut menghambat mobilitas","Atur ulang jadwal tim dan maksimalkan penanaman saat hari cerah",${namaPicContoh2},2026-10-20,10,2,Ha,"Target tanam blok A terhambat cuaca"`,
  ];

  return baris.join('\r\n');
}

/**
 * Menghasilkan prompt siap pakai untuk diberikan kepada AI Agent (ChatGPT, Claude, Gemini, dll.).
 * Prompt ini secara otomatis menyuntikkan data master aktif (Tim, Bidang, Satuan).
 */
export function hasilkanPromptAi(boot: Bootstrap): string {
  const daftarBidang = boot.opsi.filter((o) => o.grup === 'bidang').map((o) => o.nilai).join(', ');
  const daftarTim = boot.tim.map((t) => `${t.nama} (${t.id})`).join('\n- ');
  const daftarSatuan = boot.opsi.filter((o) => o.grup === 'satuan').map((o) => o.nilai).join(', ');
  const periodeAktif = boot.pengaturan.periode_aktif || 'berjalan';

  return `Kamu adalah asisten analisis operasional dan rekapitulasi PICA (Problem Identification & Corrective Action) untuk aplikasi POKEMONKEY (Periode aktif: ${periodeAktif}).

Tugasmu:
Analisis catatan rapat, temuan inspeksi lapangan, atau percakapan berikut, kemudian ekstrak setiap permasalahan operasional menjadi data tabel PICA dengan format CSV persis seperti di bawah.

Aturan Penting:
1. Format output WAJIB HANYA berupa blok kode CSV tunggal:
\`\`\`csv
bidang,prioritas,judul,akar,tindakan,pic,due_date,target,realisasi,satuan,judul_singkat
\`\`\`

2. Nilai kolom harus mengikuti aturan master data POKEMONKEY:
- \`bidang\`: Pilih salah satu yang paling cocok dari daftar: [${daftarBidang}]
- \`prioritas\`: Pilih salah satu dari: [Tinggi, Sedang, Rendah]
- \`judul\`: (WAJIB) Tuliskan fakta masalah konkret di lapangan beserta angkanya bila ada.
- \`akar\`: Tuliskan akar penyebab masalah (jika belum pasti, kosongkan atau tulis dugaan sementara).
- \`tindakan\`: Tuliskan tindakan korektif / rencana aksi penyelesaian masalah.
- \`pic\`: Tuliskan nama penanggung jawab dari daftar tim di bawah.
- \`due_date\`: Format tanggal tenggat ISO: YYYY-MM-DD (misal: 2026-10-15).
- \`target\`: Angka target kuantitatif (hanya angka, misal: 1000 atau kosongkan).
- \`realisasi\`: Angka capaian saat ini (biasanya 0 atau kosong).
- \`satuan\`: Satuan target yang sesuai (contoh: ${daftarSatuan || 'batang, Ha, %, titik'}).
- \`judul_singkat\`: Ringkasan pendek (maksimal 10 kata / 80 huruf) untuk rekap notifikasi WhatsApp.

Daftar Anggota Tim (PIC yang valid):
- ${daftarTim}

3. Jika teks pada kolom mengandung tanda koma (,), apit isi kolom dengan tanda kutip dua ("...").
4. Jangan tambahkan kolom lain. Jangan berikan penjelasan pengantar atau penutup di luar blok kode CSV.

Berikut adalah catatan / laporan lapangan yang perlu kamu olah:
[TEMPELKAN CATATAN / NOTULEN LAPANGAN DI SINI]`;
}
