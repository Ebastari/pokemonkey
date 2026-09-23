/**
 * Tipe data & pembantu untuk Manajerial Nomor Surat (Internal & Eksternal)
 * PT Energi Batubara Lestari (Hasnur Group) - Departemen RNR
 */

export type KategoriSurat = 'im' | 'surat_keluar' | 'kontrak' | 'berita_acara';
export type JenisLingkup = 'internal' | 'eksternal';

export interface DokumenLampiran {
  id: string;
  nama: string;
  ukuran: number; // bytes
  tipe: string;   // mime type / ekstensi
  dataUrl?: string; // base64 untuk pratinjau & unduh
  diunggahPada: string; // ISO timestamp
}

export interface ItemSurat {
  id: string;
  kategori: KategoriSurat;
  nomorUrut?: number;
  nomorSurat: string;
  namaSurat: string; // Perihal / Nama Surat
  tanggal?: string;  // YYYY-MM-DD

  // Bidang Khusus Internal Memo (IM)
  namaYangDitugaskan?: string;
  tanggalMulai?: string;
  tanggalBerakhir?: string;
  lamaHari?: number | null;
  tujuanDinas?: string;
  keperluan?: string;
  namaPembuat?: string;

  // Bidang Khusus Surat Keluar & Berita Acara
  tujuanSurat?: string;
  author?: string;

  // Bidang Khusus Kontrak Pekerjaan
  sistemPelaksanaan?: string; // 'Vendor' | 'Swakelola' | dll.
  pelaksana?: string;
  keterangan?: string;

  // Dokumen Lampiran (Opsional, bukan syarat)
  dokumen?: DokumenLampiran[];

  // Tautan ke Form Internal Memo Dinas (jika terhubung)
  internalMemoId?: string;

  dibuatPada: string;
  diubahPada?: string;
}

export const KATEGORI_SURAT_INFO: Record<
  KategoriSurat,
  { label: string; singkatan: string; lingkup: JenisLingkup; warna: string; formatContoh: string }
> = {
  im: {
    label: 'Internal Memo (Dinas)',
    singkatan: 'IM',
    lingkup: 'internal',
    warna: 'amber',
    formatContoh: '024/RNR-PD/IX/2026',
  },
  surat_keluar: {
    label: 'Surat Keluar (Dinas)',
    singkatan: 'SR',
    lingkup: 'eksternal',
    warna: 'blue',
    formatContoh: '06/EBL/RNR-SR/IX/2026',
  },
  kontrak: {
    label: 'Kontrak Pekerjaan',
    singkatan: 'KK',
    lingkup: 'eksternal',
    warna: 'emerald',
    formatContoh: '04/EBL/RNR-KK/IX/2026',
  },
  berita_acara: {
    label: 'Berita Acara',
    singkatan: 'BA',
    lingkup: 'internal',
    warna: 'purple',
    formatContoh: '06/EBL/RNR-BA/IX/2026',
  },
};

/**
 * Konversi angka bulan (1-12) ke angka Romawi
 */
export function bulanKeRomawi(bulan: number): string {
  const romawi = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romawi[Math.max(0, Math.min(11, bulan - 1))] || 'I';
}

/**
 * Otomatis menghitung selisih hari antara dua tanggal (inklusif atau durasi dinas)
 */
export function hitungLamaHari(tglMulai?: string, tglAkhir?: string): number | null {
  if (!tglMulai || !tglAkhir) return null;
  try {
    const m = new Date(tglMulai).getTime();
    const a = new Date(tglAkhir).getTime();
    const diff = Math.round((a - m) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 1;
  } catch {
    return null;
  }
}

/**
 * Otomatis menghasilkan nomor surat baru berikutnya berdasarkan kategori dan daftar yang ada
 */
export function generateNomorSuratOtomatis(
  kategori: KategoriSurat,
  daftar: ItemSurat[],
  tanggalAcuan: string = new Date().toISOString()
): { nomorSurat: string; nomorUrut: number } {
  const date = new Date(tanggalAcuan);
  const bulan = isNaN(date.getMonth()) ? new Date().getMonth() + 1 : date.getMonth() + 1;
  const tahun = isNaN(date.getFullYear()) ? new Date().getFullYear() : date.getFullYear();
  const romawi = bulanKeRomawi(bulan);

  // Ambil semua item dalam kategori ini
  const itemKategori = daftar.filter((item) => item.kategori === kategori);

  // Cari nomor urut terbesar dari item pada tahun ini
  let maxUrut = 0;
  for (const item of itemKategori) {
    if (item.nomorUrut && item.nomorUrut > maxUrut) {
      maxUrut = item.nomorUrut;
    }
    // Jika tidak ada nomorUrut eksplisit, ekstrak angka di awal nomorSurat (misal "023/..." -> 23)
    if (item.nomorSurat) {
      const match = item.nomorSurat.match(/^(\d+)\//);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxUrut) {
          maxUrut = n;
        }
      }
    }
  }

  const urutBaru = maxUrut + 1;

  let nomorSurat = '';
  switch (kategori) {
    case 'im': {
      // Format 3 digit: 024/RNR-PD/IX/2026
      const pad = String(urutBaru).padStart(3, '0');
      nomorSurat = `${pad}/RNR-PD/${romawi}/${tahun}`;
      break;
    }
    case 'surat_keluar': {
      // Format 2 digit: 06/EBL/RNR-SR/IX/2026
      const pad = String(urutBaru).padStart(2, '0');
      nomorSurat = `${pad}/EBL/RNR-SR/${romawi}/${tahun}`;
      break;
    }
    case 'kontrak': {
      // Format 2 digit: 04/EBL/RNR-KK/IX/2026
      const pad = String(urutBaru).padStart(2, '0');
      nomorSurat = `${pad}/EBL/RNR-KK/${romawi}/${tahun}`;
      break;
    }
    case 'berita_acara': {
      // Format 2 digit: 06/EBL/RNR-BA/IX/2026
      const pad = String(urutBaru).padStart(2, '0');
      nomorSurat = `${pad}/EBL/RNR-BA/${romawi}/${tahun}`;
      break;
    }
  }

  return { nomorSurat, nomorUrut: urutBaru };
}
