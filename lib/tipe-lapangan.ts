/**
 * Kontrak tipe data lapangan (Smart Nursery & Geotagging Pohon).
 * Digunakan bersama oleh UI (React) dan Server (Cloudflare Worker).
 */

export const BATAS_KARBON = [
  'Diameter TIDAK diukur di lapangan; diduga dari tinggi pohon (allometrik).',
  'Kerapatan kayu dipukul rata 0,60 g/cm³ untuk semua jenis.',
  'Hanya biomassa ATAS TANAH (AGB). Akar, serasah, dan tanah tidak terhitung.',
  'Luas cakupan survei, bukan luas tutupan tanam riil.',
];

export interface SaringanNursery {
  bibit?: string;
  tujuan?: string;
  dari?: string;
  sampai?: string;
}

export interface HasilNursery {
  ok: boolean;
  ringkasan: {
    stok: number;
    stok_sahih: boolean;
    saringan: string[];
    masuk: number;
    keluar: number;
    mati: number;
    mortalitas: number;
    jml_jenis: number;
    jml_baris: number;
    masuk_hari_ini: number;
    keluar_hari_ini: number;
    mati_hari_ini: number;
    hari_aktif: number;
    dari: string;
    sampai: string;
  };
  jenis: Array<{
    nama: string;
    masuk: number;
    keluar: number;
    mati: number;
    stok: number;
    mortalitas: number;
    status: 'Sehat' | 'Waspada' | 'Kritis';
    terakhir: string;
  }>;
  tujuan: Array<{
    tujuan: string;
    total: number;
    persen: number;
  }>;
  tren: Array<{
    tanggal: string;
    masuk: number;
    keluar: number;
    mati: number;
    stok: number;
  }>;
  proyeksi: {
    ada: boolean;
    stok?: number;
    laju_harian?: number;
    hari_tersisa?: number;
    perkiraan_habis?: string;
    alasan?: string;
  };
  diambil: string;
  sumber: 'd1' | 'worker' | 'demo';
}

export interface SaringanGeotag {
  lokasi?: string;
  tanaman?: string;
  vendor?: string;
  pengawas?: string;
  dari?: string;
  sampai?: string;
}

export interface HasilGeotag {
  ok: boolean;
  ringkasan: {
    total: number;
    sehat: number;
    merana: number;
    mati: number;
    persen_hidup: number;
    persen_sehat: number;
    berkoordinat: number;
    berfoto: number;
    tinggi_avg: number;
    tinggi_min: number;
    tinggi_max: number;
  };
  karbon: {
    agb_kg: number;
    agb_ton: number;
    karbon_kg: number;
    karbon_ton: number;
    co2e_kg: number;
    co2e_ton: number;
    batas: string[];
  };
  per_lokasi: Array<{
    lokasi: string;
    total: number;
    sehat: number;
    merana: number;
    mati: number;
    persen_hidup: number;
  }>;
  per_tanaman: Array<{
    tanaman: string;
    total: number;
    persen: number;
  }>;
  diambil: string;
  sumber: 'd1' | 'worker' | 'demo';
}
