/**
 * Model Data dan Generator Laporan Resmi Pemantauan Titik Api (FIRE MONKEY)
 * Format sesuai dokumen resmi KLHK:
 * 1. IPPKH: PT Energi Batubara Lestari (SK.6982/MenLHK-PKTL/Ren/Pla.0/9/2022) 21092026
 * 2. REHAB DAS: Areal Penanaman Rehabilitasi DAS PT EBL di Kawasan Tahura Sultan Adam (SK.498/MenLHK-PDASRH/2021)
 */

import { api, demoAktif } from './api';
import { anonimkanDalam, kotaDemoTerpilih } from './wilayah-fire';
import { AREA_EBL } from '../server/src/area-ebl';
import { AREA_DAS } from '../server/src/area-das';
import { tentukanZonaArea, namaSatelit, type TitikApi, type Zona, type AreaTitik } from '../server/src/titik-api-murni';
import type { Pengguna } from './tipe-api';
import type { IsianFormLaporan } from './form-laporan-fire';

export interface TitikApiFireItem {
  id: string;
  lat: number;
  lon: number;
  waktu: string;
  sumber: string; // e.g. NASA-SNPP, NASA-NOAA20, MODIS
  keyakinan: 'rendah' | 'sedang' | 'tinggi';
  frp?: number | null; // Fire Radiative Power (MW)
  area: AreaTitik; // 'tambang' | 'das'
  zona: Exclude<Zona, 'luar'>; // 'ippkh' | 'iup' | 'petak' | 'waspada' | 'pantau'
  bidang: string | null; // e.g. 'SK.78', 'SK.892', 'PETAK 8 (2)'
  desa?: string;
  kecamatan?: string;
  kabupaten?: string;
  provinsi?: string;
  status: 'baru' | 'dicek' | 'padam' | 'bukan_api';
  penyebab?: string;
  catatan?: string;
}

export interface KoordinatLaporan {
  no: number;
  xBujur: number;
  yLintang: number;
  keterangan: string;
  satelit: string;
  desa: string;
  waktu: string;
}

export interface LaporanKarhutla {
  id: string;
  nomorLaporan: string;
  judul: string;
  tanggalLaporan: string; // YYYY-MM-DD
  waktuLaporan: string; // HH:mm WITA

  // Identitas Izin Perusahaan
  perusahaan: string;
  pemegangIzin: string;
  jenisIzin: string; // PPKH / IUP / Rehabilitasi DAS
  skNomorTanggal: string;
  jangkaWaktuIzin: string;
  luas: string;
  statusKawasanHutan: string;
  kabupaten: string;
  provinsi: string;

  // Titik Koordinat yang Dilaporkan
  titikIds: string[];
  titikKoordinat: KoordinatLaporan[];

  // A. Deskripsi
  deskripsiUmum: string;

  // B. Kronologi & Penanganan
  kronologi: {
    waktuVerifikasi: string;
    lokasiSpesifik: string;
    pengamatanVisual: string;
    tindakanPenanganan: string;
    prosesPemadaman: string;
    hasilVerifikasi: string;
  };

  // C. Dokumentasi
  dokumentasi: {
    petaSipongi: string[];
    fotoLapangan: {
      url: string;
      judul: string;
      deskripsi?: string;
      kategori: 'sebelum' | 'tindakan' | 'setelah' | 'umum';
    }[];
  };

  status: 'Draf' | 'Siap Dikirim' | 'Terkirim ke KLHK';
  dibuatOleh: string;
  /** Jabatan pembuat di kolom tanda tangan (laporan lama: kosong → teks tim bawaan). */
  jabatanPembuat?: string;
  /** Isian form terakhir, agar form bisa dibuka lagi dengan isi yang sama. */
  isianForm?: IsianFormLaporan;
  dibuatPada: string;
  diubahPada: string;
}

/** Pembuat laporan bawaan; nama & jabatan bisa diganti di form. */
export const PEMBUAT_BAWAAN = {
  nama: 'Agung Laksono',
  jabatan: 'Staff Revegetasi',
  ttd: '/fire-report-assets/ttd-agung.png',
};

/** Pembuat bawaan sesuai mode (demo memakai nama contoh tanpa tanda tangan). */
export const pembuatBawaan = () =>
  demoAktif() ? { nama: 'Nama Pembuat', jabatan: 'Staf Lapangan (contoh)', ttd: '' } : PEMBUAT_BAWAAN;

/** Tanda tangan pembuat hanya dipasang bila namanya Agung Laksono (pemilik berkas tanda tangan). */
export const ttdPembuat = (nama: string) =>
  !demoAktif() && nama.trim().toLowerCase() === PEMBUAT_BAWAAN.nama.toLowerCase() ? PEMBUAT_BAWAAN.ttd : '';

/** Pejabat yang mengesahkan laporan karhutla (tanda tangan di akhir kronologi). */
export const PENGESAH_LAPORAN = {
  nama: 'Bambang Octaryono',
  jabatan: 'Kepala Teknik Tambang',
  ttd: '/fire-report-assets/ttd-bambang.png',
};

export const KUNCI_STORAGE_TITIK_FIRE = 'pokemonkey_fire_points_v1';
export const KUNCI_STORAGE_LAPORAN_FIRE = 'pokemonkey_fire_reports_v1';

export type TargetAreaLaporan = 'auto' | 'das' | 'ippkh' | 'iup' | 'terpilih';

/**
 * Aturan verifikasi: Titik api di dalam IUP, IPPKH, atau Petak Rehab DAS
 * memenuhi kriteria pembuatan laporan resmi ke KLHK.
 */
export function bisaDibuatkanLaporan(t: TitikApiFireItem): boolean {
  return t.zona === 'ippkh' || t.zona === 'iup' || t.zona === 'petak' || t.area === 'das';
}

/**
 * Titik api default:
 * 1. IPPKH SK.78 (Tapin) - Titik 1 & Titik 2 dari dokumen PDF 21 Sep 2026
 * 2. Rehab DAS Tahura Sultan Adam - Petak 8, Petak 7, Petak 1
 * 3. IUP & Waspada / Pantau
 */
export const TITIK_API_DEFAULT: TitikApiFireItem[] = [
  {
    id: 'firms-20260921-snpp-1',
    lat: -2.95803,
    lon: 115.22012,
    waktu: '2026-09-21T00:49:00Z',
    sumber: 'NASA-SNPP',
    keyakinan: 'sedang',
    frp: 8.4,
    area: 'tambang',
    zona: 'ippkh',
    bidang: 'SK.78',
    desa: 'Bitahan Baru',
    kecamatan: 'Lokpaikat',
    kabupaten: 'Tapin',
    provinsi: 'Kalimantan Selatan',
    status: 'padam',
    penyebab: 'Spontaneous Combustion (Swabakar Timbunan Batubara)',
    catatan: 'Verifikasi lapangan 21 Sep 2026 pukul 09.20 WITA. Api dan bara telah padam sepenuhnya.',
  },
  {
    id: 'firms-20260921-noaa20-2',
    lat: -2.95704,
    lon: 115.2183,
    waktu: '2026-09-21T01:11:00Z',
    sumber: 'NASA-NOAA20',
    keyakinan: 'sedang',
    frp: 7.1,
    area: 'tambang',
    zona: 'ippkh',
    bidang: 'SK.78',
    desa: 'Bitahan Baru',
    kecamatan: 'Lokpaikat',
    kabupaten: 'Tapin',
    provinsi: 'Kalimantan Selatan',
    status: 'padam',
    penyebab: 'Spontaneous Combustion (Swabakar Timbunan Batubara)',
    catatan: 'Area timbunan batubara dekat Pit 1. Penanganan memakai excavator dan chemical suppressant.',
  },
  {
    id: 'firms-20260924-snpp-das4',
    lat: -3.5315,
    lon: 114.9425,
    waktu: '2026-09-24T06:15:00Z',
    sumber: 'NASA-SNPP',
    keyakinan: 'sedang',
    frp: 5.2,
    area: 'das',
    zona: 'petak',
    bidang: 'PETAK 8 (2)',
    desa: 'Tiwingan Lama',
    kecamatan: 'Aranio',
    kabupaten: 'Banjar',
    provinsi: 'Kalimantan Selatan',
    status: 'padam',
    penyebab: 'Pembakaran Serasah Kering di Luar Sekat Bakar',
    catatan: 'Sekat bakar selebar 4m efektif mencegah rambatan. Tanaman bibit ulin & mahoni 100% aman.',
  },
  {
    id: 'firms-20260925-noaa20-das5',
    lat: -3.5365,
    lon: 114.9355,
    waktu: '2026-09-25T01:45:00Z',
    sumber: 'NASA-NOAA20',
    keyakinan: 'sedang',
    frp: 4.8,
    area: 'das',
    zona: 'petak',
    bidang: 'PETAK 7',
    desa: 'Tiwingan Lama',
    kecamatan: 'Aranio',
    kabupaten: 'Banjar',
    provinsi: 'Kalimantan Selatan',
    status: 'dicek',
    penyebab: 'Aktivitas Kebun Warga Dekat Batas DAS',
    catatan: 'Tim patroli Rehab DAS dan vendor pelaksana (ABL) sedang melakukan pembasahan sekat bakar.',
  },
  {
    id: 'firms-20260924-noaa21-3',
    lat: -2.9615,
    lon: 115.2245,
    waktu: '2026-09-24T05:22:00Z',
    sumber: 'NASA-NOAA21',
    keyakinan: 'tinggi',
    frp: 12.5,
    area: 'tambang',
    zona: 'iup',
    bidang: null,
    desa: 'Bitahan Baru',
    kecamatan: 'Lokpaikat',
    kabupaten: 'Tapin',
    provinsi: 'Kalimantan Selatan',
    status: 'dicek',
    penyebab: 'Indikasi Swabakar Batubara Low Rank',
    catatan: 'Tim patroli SHE sedang melakukan pendinginan di lereng tambang.',
  },
  {
    id: 'firms-20260925-modis-6',
    lat: -2.972,
    lon: 115.205,
    waktu: '2026-09-25T02:40:00Z',
    sumber: 'MODIS_NRT',
    keyakinan: 'rendah',
    frp: 3.8,
    area: 'tambang',
    zona: 'waspada',
    bidang: null,
    desa: 'Suato Tatakan',
    kecamatan: 'Tapin Selatan',
    kabupaten: 'Tapin',
    provinsi: 'Kalimantan Selatan',
    status: 'baru',
    penyebab: 'Asap Pembakaran Semak Belukar Luar',
    catatan: 'Terdeteksi 1.2 km dari batas konsesi IUP. Tidak merambat ke dalam area tambang.',
  },
  {
    id: 'firms-20260925-snpp-7',
    lat: -2.948,
    lon: 115.215,
    waktu: '2026-09-25T04:10:00Z',
    sumber: 'NASA-SNPP',
    keyakinan: 'rendah',
    frp: 2.1,
    area: 'tambang',
    zona: 'pantau',
    bidang: null,
    desa: 'Miawa',
    kecamatan: 'Piani',
    kabupaten: 'Tapin',
    provinsi: 'Kalimantan Selatan',
    status: 'baru',
    penyebab: 'Aktivitas Kebun Warga Luar',
    catatan: 'Jarak 3.4 km di luar konsesi.',
  },
];

/**
 * Laporan 1: Dokumen resmi acuan IPPKH (21 September 2026)
 * Sesuai berkas referensi: PT Energi Batubara Lestari (SK.6982_MenLHK-PKTL_Ren_Pla (3).0_9_2022) 21092026
 */
export const LAPORAN_AWAL_CONTOH: LaporanKarhutla = {
  id: 'lap-karhutla-20260921-ebl',
  nomorLaporan: 'LAP-KARHUTLA/EBL/PPKH/2026/09/21',
  judul: 'Laporan Pemantauan & Verifikasi Lapangan Titik Panas (Hotspot) SIPONGI - Area IPPKH Tapin (21 September 2026)',
  tanggalLaporan: '2026-09-21',
  waktuLaporan: '09:20 WITA',

  perusahaan: 'PT. ENERGI BATUBARA LESTARI',
  pemegangIzin: 'PT Energi Batubara Lestari',
  jenisIzin: 'PPKH',
  skNomorTanggal:
    'Keputusan Menteri Kehutanan Nomor 78/MENLHK/PLA.0/1/2022 dan SK Tata Batas SK.6982/MenLHK-PKTL/Ren/Pla.0/9/2022',
  jangkaWaktuIzin: '27 Januari 2022-27 Januari 2030',
  luas: '14,13 Ha',
  statusKawasanHutan: 'Hutan Produksi Terbatas',
  kabupaten: 'Rantau, Tapin',
  provinsi: 'Kalimantan Selatan',

  titikIds: ['firms-20260921-snpp-1', 'firms-20260921-noaa20-2'],
  titikKoordinat: [
    {
      no: 1,
      xBujur: 115.22012,
      yLintang: -2.95803,
      keterangan: 'Area IPPKH PT Energi Batubara Lestari Keputusan Menteri Kehutanan Nomor 78/MENLHK/PLA.0/1/2022',
      satelit: 'NASA-SNPP',
      desa: 'Bitahan Baru, Kec. Lokpaikat',
      waktu: '21 Sep 2026 00:49:00',
    },
    {
      no: 2,
      xBujur: 115.2183,
      yLintang: -2.95704,
      keterangan: 'Area IPPKH PT Energi Batubara Lestari Keputusan Menteri Kehutanan Nomor 78/MENLHK/PLA.0/1/2022',
      satelit: 'NASA-NOAA20',
      desa: 'Bitahan Baru, Kec. Lokpaikat',
      waktu: '21 Sep 2026 01:11:00',
    },
  ],

  deskripsiUmum:
    'Berdasarkan hasil pemantauan titik panas (hotspot) melalui Sistem Informasi Pengendalian Kebakaran Hutan dan Lahan (SIPONGI) Kementerian Lingkungan Hidup dan Kehutanan, terdeteksi adanya indikasi kebakaran hutan dan lahan pada tanggal 21 September 2026 dengan tingkat kepercayaan (confidence level) klasifikasi medium. Titik panas tersebut terpantau berada pada wilayah kerja PT Energi Batubara Lestari, khususnya pada Area Izin Pinjam Pakai Kawasan Hutan (IPPKH) sebagaimana ditetapkan dalam Keputusan Menteri Lingkungan Hidup dan Kehutanan Nomor 78/MENLHK/PLA.0/1/2022. Menindaklanjuti informasi tersebut, tim pemantau melakukan verifikasi lapangan (ground check) untuk memastikan keberadaan, penyebab, luasan, serta status titik api di lokasi terindikasi.',

  kronologi: {
    waktuVerifikasi: 'Senin, 21 September 2026, pukul 09.20 WITA',
    lokasiSpesifik:
      'Timbunan batubara di dalam Area IPPKH PT Energi Batubara Lestari (SK.78/MENLHK/PLA.0/1/2022), Titik 1 (X: 115,22012; Y: -2,95803) dan Titik 2 (X: 115,21830; Y: -2,95704).',
    pengamatanVisual:
      'Berdasarkan pengamatan visual dan pemeriksaan kondisi lapangan, api yang timbul bukan merupakan kebakaran vegetasi maupun kebakaran lahan, melainkan berasal dari fenomena pembakaran spontan (spontaneous combustion) pada timbunan Batubara yang sudah ada dari tanggal 15 September 2026. Fenomena tersebut terjadi akibat proses oksidasi alami batubara terhadap oksigen di udara yang menghasilkan panas secara eksotermik. Panas yang terakumulasi dan tidak terdisipasi dengan baik di dalam timbunan menyebabkan kenaikan suhu hingga mencapai titik nyala (ignition point) batubara, sehingga menimbulkan bara dan asap pada permukaan timbunan. Kondisi ini diperkuat oleh faktor cuaca kering dan suhu lingkungan yang tinggi pada periode tersebut. Tidak ditemukan indikasi adanya aktivitas pembakaran yang disengaja, sisa api unggun, puntung rokok, maupun sumber api dari pihak luar di sekitar lokasi kejadian.',
    tindakanPenanganan:
      'Menindaklanjuti temuan tersebut, tim tanggap darurat kebakaran PT Energi Batubara Lestari segera melakukan tindakan penanganan di lokasi. Upaya pemadaman dilakukan dengan mengisolasi area terdampak, melakukan pembongkaran dan perataan timbunan batubara yang membara menggunakan alat berat excavator untuk melepaskan panas terakumulasi, serta mengaplikasikan bahan kimia pemadam (chemical fire suppressant) pada titik-titik bara. Penggunaan bahan kimia pemadam dipilih karena lebih efektif menekan reaksi oksidasi pada batubara dibandingkan penyiraman air biasa, sekaligus mencegah terjadinya penyalaan ulang (re-ignition).',
    prosesPemadaman:
      'Proses pemadaman berlangsung hingga api dan bara dinyatakan padam sepenuhnya pada hari Senin, tanggal 21 September 2026, pukul 14.30 WITA. Setelah pemadaman selesai, tim melakukan pendinginan (mopping up) dan pemantauan lanjutan untuk memastikan tidak terdapat sisa bara yang berpotensi menimbulkan penyalaan ulang.',
    hasilVerifikasi:
      'Berdasarkan hasil verifikasi akhir, tidak terdapat korban jiwa maupun korban luka, tidak terjadi kerusakan pada tegakan vegetasi maupun tanaman revegetasi di sekitar lokasi, dan tidak terdapat perluasan api ke area kawasan hutan di sekitarnya.',
  },

  dokumentasi: {
    petaSipongi: ['/fire-report-assets/sipongi-titik-1.jpeg', '/fire-report-assets/sipongi-titik-2.jpeg'],
    fotoLapangan: [
      {
        url: '/fire-report-assets/foto-before-after.jpeg',
        judul: 'Dokumentasi Kondisi Before & After Penanganan Bara Batubara',
        deskripsi:
          'Foto komparasi kondisi sebelum dan sesudah penanganan bara batubara menggunakan excavator PC210 dan penyemprotan bahan kimia pemadam.',
        kategori: 'umum',
      },
      {
        url: '/fire-report-assets/foto-lapangan-1.jpeg',
        judul: 'Kegiatan Pembongkaran & Penyemprotan Bara pada Timbunan Batubara',
        deskripsi:
          'Ekskavator Komatsu membongkar lapisan singkapan batubara yang berasap sembari disemprot chemical fire suppressant.',
        kategori: 'tindakan',
      },
      {
        url: '/fire-report-assets/foto-lapangan-2.jpeg',
        judul: 'Kondisi Akhir Permukaan Setelah Pembasahan & Mopping Up',
        deskripsi: 'Tim SHE memastikan tidak ada bara aktif dan temperatur permukaan telah stabil.',
        kategori: 'setelah',
      },
    ],
  },

  status: 'Terkirim ke KLHK',
  dibuatOleh: 'Tim SHE & Pengendalian Karhutla PT EBL',
  dibuatPada: '2026-09-21T09:30:00.000Z',
  diubahPada: '2026-09-21T15:00:00.000Z',
};

/**
 * Laporan 2: Dokumen resmi khusus REHABILITASI DAS (Tahura Sultan Adam)
 */
export const LAPORAN_REHABDAS_CONTOH: LaporanKarhutla = {
  id: 'lap-karhutla-rehabdas-20260924',
  nomorLaporan: 'LAP-KARHUTLA/EBL/REHABDAS/2026/09/24',
  judul: 'Laporan Pemantauan Titik Panas (Hotspot) - Petak Rehabilitasi DAS Tahura Sultan Adam (24 September 2026)',
  tanggalLaporan: '2026-09-24',
  waktuLaporan: '10:45 WITA',

  perusahaan: 'PT. ENERGI BATUBARA LESTARI',
  pemegangIzin: 'PT Energi Batubara Lestari',
  jenisIzin: 'Rehabilitasi DAS',
  skNomorTanggal:
    'SK Penetapan Lokasi Penanaman Rehabilitasi DAS PT EBL Nomor SK.498/MenLHK-PDASRH/2021 dan Peta Kerja Tahura Sultan Adam',
  jangkaWaktuIzin: 'Masa Penanaman & Pemeliharaan (P0 - P2)',
  luas: '498,00 Ha (Petak 8 seluas 30,66 Ha)',
  statusKawasanHutan: 'Taman Hutan Raya (Tahura) Sultan Adam',
  kabupaten: 'Banjar (Kec. Aranio)',
  provinsi: 'Kalimantan Selatan',

  titikIds: ['firms-20260924-snpp-das4'],
  titikKoordinat: [
    {
      no: 1,
      xBujur: 114.9425,
      yLintang: -3.5315,
      keterangan: 'Petak 8 (2) Penanaman Rehabilitasi DAS PT EBL di Kawasan Tahura Sultan Adam',
      satelit: 'NASA-SNPP',
      desa: 'Tiwingan Lama, Kec. Aranio',
      waktu: '24 Sep 2026 06:15:00',
    },
  ],

  deskripsiUmum:
    'Berdasarkan hasil pemantauan titik panas (hotspot) melalui Sistem Informasi Pengendalian Kebakaran Hutan dan Lahan (SIPONGI) Kementerian Lingkungan Hidup dan Kehutanan / NASA FIRMS, terdeteksi adanya indikasi titik panas pada tanggal 24 September 2026 dengan tingkat kepercayaan (confidence level) medium pada areal petak tanaman Rehabilitasi DAS PT Energi Batubara Lestari di Kawasan Tahura Sultan Adam. Menindaklanjuti informasi tersebut, tim patroli pengamanan hutan dan pengawas tanaman Rehab DAS PT EBL bersama vendor pelaksana (KBS) segera melakukan verifikasi lapangan (ground check) untuk memastikan kondisi tegakan tanaman dan perimeter sekat bakar.',

  kronologi: {
    waktuVerifikasi: 'Kamis, 24 September 2026, pukul 08.30 WITA',
    lokasiSpesifik:
      'Blok Petak 8 (2) Penanaman Rehabilitasi DAS PT EBL, Desa Tiwingan Lama, Kec. Aranio, Kab. Banjar (X: 114,94250; Y: -3,53150).',
    pengamatanVisual:
      'Berdasarkan pemeriksaan langsung di lapangan oleh tim patroli DAS PT EBL, sumber panas berasal dari pembakaran serasah semak belukar kering di luar batas sekat bakar petak. Asap dan panas terpantau oleh satelit pengamat cuaca. Berkat keberadaan jalur sekat bakar (fire break) selebar 4 meter yang telah dipersiapkan sebelumnya, rambatan api tidak memasuki area inti petak tanam bibit pohon. Tidak ditemukan indikasi kebakaran pohon atau kesengajaan pembakaran oleh pihak internal.',
    tindakanPenanganan:
      'Tim pengawas tanaman dan regu pemadam darurat segera melakukan penyekatan tambahan, pemadaman manual menggunakan peralatan gepyok dan tangki semprot punggung (jet shooter), serta pembasahan perimeter dengan pompa air portabel. Tim juga berkoordinasi dengan petugas resort UPTD Tahura Sultan Adam.',
    prosesPemadaman:
      'Api dinyatakan padam tuntas pada pukul 10.15 WITA. Tim melakukan penyisiran sisa bara dan pembasahan (mopping up) hingga suhu tanah kembali normal dan tidak berpotensi menyala kembali.',
    hasilVerifikasi:
      'Hasil verifikasi akhir menegaskan bahwa seluruh tanaman pohon rehabilitasi (ulin, mahoni, meranti) di dalam Petak 8 (2) dalam kondisi aman, tidak ada kerusakan tegakan bibit, nihil korban jiwa, dan sekat bakar berfungsi dengan optimal.',
  },

  dokumentasi: {
    petaSipongi: ['/fire-report-assets/sipongi-titik-1.jpeg', '/fire-report-assets/sipongi-titik-2.jpeg'],
    fotoLapangan: [
      {
        url: '/fire-report-assets/foto-lapangan-2.jpeg',
        judul: 'Patroli Jalur Sekat Bakar (Fire Break) Petak 8 (2) Rehab DAS',
        deskripsi: 'Pemeriksaan perimeter luar petak penanaman pohon Tahura Sultan Adam.',
        kategori: 'umum',
      },
      {
        url: '/fire-report-assets/foto-before-after.jpeg',
        judul: 'Penyisiran dan Pembasahan Tuntas (Mopping Up) di Sekitar Petak Tanam',
        deskripsi: 'Kondisi areal aman terkendali dan tidak ada rambatan ke tanaman pokok.',
        kategori: 'setelah',
      },
    ],
  },

  status: 'Terkirim ke KLHK',
  dibuatOleh: 'Tim Pengawas Rehab DAS PT EBL & UPTD Tahura',
  dibuatPada: '2026-09-24T09:00:00.000Z',
  diubahPada: '2026-09-24T11:30:00.000Z',
};

/**
 * Generator otomatis: Membuat draf laporan resmi KLHK
 * Mendukung target wilayah spesifik:
 * - 'das'    : Khusus petak-petak penanaman Rehabilitasi DAS Tahura Sultan Adam
 * - 'ippkh'  : Khusus izin pinjam pakai kawasan hutan SK.78 / SK.6982 Tapin
 * - 'iup'    : Khusus izin usaha pertambangan PT EBL
 * - 'auto'   : Menyesuaikan secara otomatis sesuai titik yang dipilih
 */
function buatLaporanOtomatisAsli(params: {
  titikList: TitikApiFireItem[];
  pengguna?: Pengguna | null;
  tanggal?: string;
  penyebab?: string;
  targetArea?: TargetAreaLaporan;
}): LaporanKarhutla {
  const target = params.targetArea || 'auto';

  // Saring titik sesuai target bila ditentukan secara spesifik
  let titikLayak = params.titikList.filter(bisaDibuatkanLaporan);

  if (target === 'das') {
    const khususDas = titikLayak.filter((t) => t.area === 'das' || t.zona === 'petak');
    if (khususDas.length > 0) {
      titikLayak = khususDas;
    }
  } else if (target === 'ippkh') {
    const khususIppkh = titikLayak.filter((t) => t.zona === 'ippkh');
    if (khususIppkh.length > 0) {
      titikLayak = khususIppkh;
    }
  } else if (target === 'iup') {
    const khususIup = titikLayak.filter((t) => t.zona === 'iup');
    if (khususIup.length > 0) {
      titikLayak = khususIup;
    }
  }

  if (titikLayak.length === 0) {
    throw new Error(
      `Tidak ditemukan titik api yang berada di dalam ${
        target === 'das' ? 'Petak Rehabilitasi DAS' : target === 'ippkh' ? 'Area IPPKH' : 'wilayah konsesi'
      } untuk dibuatkan laporan.`,
    );
  }

  const now = new Date();
  const tglStr = params.tanggal || now.toISOString().slice(0, 10);
  const waktuStr = `${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')} WITA`;

  // Tentukan apakah laporan ini untuk Rehab DAS atau IPPKH atau IUP
  const isDas =
    target === 'das' ||
    titikLayak.every((t) => t.area === 'das' || t.zona === 'petak') ||
    (titikLayak.some((t) => t.area === 'das' || t.zona === 'petak') && !titikLayak.some((t) => t.zona === 'ippkh'));

  const isIppkh = !isDas && (target === 'ippkh' || titikLayak.some((t) => t.zona === 'ippkh'));

  let jenisIzin = 'IUP';
  let skIzin = 'IUP Operasi Produksi PT Energi Batubara Lestari';
  let statusHutan = 'Bukan Kawasan Hutan (APL)';
  let kabupaten = 'Rantau, Tapin';
  let luas = '2.073,00 Ha';

  if (isDas) {
    jenisIzin = 'Rehabilitasi DAS';
    skIzin =
      'SK Penetapan Lokasi Penanaman Rehabilitasi DAS PT EBL Nomor SK.498/MenLHK-PDASRH/2021 dan Peta Kerja Tahura Sultan Adam';
    statusHutan = 'Taman Hutan Raya (Tahura) Sultan Adam';
    kabupaten = 'Banjar (Kec. Aranio)';
    luas = '498,00 Ha';
  } else if (isIppkh) {
    jenisIzin = 'PPKH';
    skIzin =
      'Keputusan Menteri Kehutanan Nomor 78/MENLHK/PLA.0/1/2022 dan SK Tata Batas SK.6982/MenLHK-PKTL/Ren/Pla.0/9/2022';
    statusHutan = 'Hutan Produksi Terbatas';
    kabupaten = 'Rantau, Tapin';
    luas = '14,13 Ha';
  }

  const titikKoordinat: KoordinatLaporan[] = titikLayak.map((t, idx) => {
    let ket = `Area ${jenisIzin === 'PPKH' ? 'IPPKH' : jenisIzin} PT Energi Batubara Lestari`;
    if (t.bidang) ket += ` (${t.bidang})`;
    return {
      no: idx + 1,
      xBujur: Number(t.lon.toFixed(5)),
      yLintang: Number(t.lat.toFixed(5)),
      keterangan: ket,
      satelit: t.sumber,
      desa: `${t.desa || (isDas ? 'Tiwingan Lama' : 'Bitahan Baru')}, Kec. ${
        t.kecamatan || (isDas ? 'Aranio' : 'Lokpaikat')
      }`,
      waktu: t.waktu,
    };
  });

  const daftarTitikTeks = titikKoordinat
    .map((k) => `Titik ${k.no} (X: ${k.xBujur}; Y: ${k.yLintang})`)
    .join(' dan ');

  const idBaru = `lap-karhutla-${Date.now()}`;
  const noLaporan = `LAP-KARHUTLA/EBL/${jenisIzin.replace(/\s+/g, '')}/${tglStr.replace(/-/g, '')}/${String(
    titikLayak.length,
  ).padStart(2, '0')}`;

  // Tanggal deteksi (WITA) dan tingkat keyakinan diambil dari titik yang dilaporkan.
  const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const tanggalDeteksi = [...new Set(titikLayak
    .map((t) => new Date(Date.parse(t.waktu) + 8 * 3600_000).toISOString().slice(0, 10))
    .filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t)))].sort()
    .map((t) => `${+t.slice(8)} ${BULAN_ID[+t.slice(5, 7) - 1]} ${t.slice(0, 4)}`);
  const tglDeteksi = tanggalDeteksi.length ? tanggalDeteksi.join(' dan ') : tglStr;
  const klasifikasi = (['rendah', 'sedang', 'tinggi'] as const)
    .filter((k) => titikLayak.some((t) => t.keyakinan === k))
    .map((k) => ({ rendah: 'low', sedang: 'medium', tinggi: 'high' })[k])
    .join(' dan ') || 'medium';

  // Deskripsi dan kronologi yang kontekstual sesuai wilayah
  let deskripsiUmum = '';
  let kronologiVisual = '';
  let tindakanTeks = '';
  let verifikasiTeks = '';

  if (isDas) {
    deskripsiUmum = `Berdasarkan hasil pemantauan titik panas (hotspot) melalui Sistem Informasi Pengendalian Kebakaran Hutan dan Lahan (SIPONGI) Kementerian Lingkungan Hidup dan Kehutanan dan NASA FIRMS, terdeteksi adanya indikasi kebakaran hutan dan lahan pada tanggal ${tglDeteksi} dengan tingkat kepercayaan (confidence level) klasifikasi ${klasifikasi}. Titik panas tersebut terpantau berada pada areal petak tanaman Rehabilitasi DAS PT Energi Batubara Lestari di Kawasan Tahura Sultan Adam.`;

    kronologiVisual = `Berdasarkan pemeriksaan langsung di lapangan oleh tim patroli DAS PT EBL, sumber panas berasal dari ${
      params.penyebab ||
      'pembakaran serasah semak belukar kering di luar batas sekat bakar petak'
    }. Berkat keberadaan jalur sekat bakar (fire break) selebar 4 meter yang telah dipersiapkan sebelumnya, rambatan api tidak memasuki area inti petak tanam bibit pohon. Tidak ditemukan indikasi kebakaran tegakan pohon maupun kesengajaan pembakaran oleh pihak internal.`;

    tindakanTeks =
      'Tim pengawas tanaman dan regu pemadam darurat segera melakukan penyekatan tambahan, pemadaman manual menggunakan peralatan gepyok dan tangki semprot punggung (jet shooter), serta pembasahan perimeter dengan pompa air portabel. Tim juga berkoordinasi dengan petugas resort UPTD Tahura Sultan Adam.';

    verifikasiTeks =
      'Hasil verifikasi akhir menegaskan bahwa seluruh tanaman pohon rehabilitasi (ulin, mahoni, meranti) di dalam petak tanam dalam kondisi aman, tidak ada kerusakan tegakan bibit, nihil korban jiwa, dan sekat bakar berfungsi dengan optimal.';
  } else {
    deskripsiUmum = `Berdasarkan hasil pemantauan titik panas (hotspot) melalui Sistem Informasi Pengendalian Kebakaran Hutan dan Lahan (SIPONGI) Kementerian Lingkungan Hidup dan Kehutanan dan NASA FIRMS, terdeteksi adanya indikasi kebakaran hutan dan lahan pada tanggal ${tglDeteksi} dengan tingkat kepercayaan (confidence level) klasifikasi ${klasifikasi}. Titik panas tersebut terpantau berada pada wilayah kerja PT Energi Batubara Lestari, khususnya pada ${isIppkh ? `Area Izin Pinjam Pakai Kawasan Hutan (IPPKH) sebagaimana ditetapkan dalam ${skIzin.split(' dan ')[0]}` : 'Area Izin Usaha Pertambangan (IUP) Operasi Produksi'}.`;

    kronologiVisual = `Berdasarkan pengamatan visual dan pemeriksaan kondisi lapangan, api yang timbul bukan merupakan kebakaran vegetasi liar yang meluas, melainkan berasal dari ${
      params.penyebab ||
      'fenomena pembakaran spontan (spontaneous combustion) pada timbunan Batubara akibat proses oksidasi alami batubara terhadap oksigen di udara yang menghasilkan panas secara eksotermik di cuaca panas kering'
    }. Panas yang terakumulasi dan tidak terdisipasi dengan baik di dalam timbunan menyebabkan kenaikan suhu hingga mencapai titik nyala batubara, sehingga menimbulkan bara dan asap. Kondisi ini diperkuat oleh faktor cuaca kering dan suhu lingkungan yang tinggi. Tidak ditemukan indikasi adanya aktivitas pembakaran yang disengaja, sisa api unggun, puntung rokok, maupun sumber api dari pihak luar di sekitar lokasi kejadian.`;

    tindakanTeks =
      'Menindaklanjuti temuan tersebut, tim tanggap darurat kebakaran PT Energi Batubara Lestari segera melakukan tindakan penanganan di lokasi. Upaya pemadaman dilakukan dengan mengisolasi area terdampak, melakukan pembongkaran dan perataan timbunan batubara yang membara menggunakan alat berat excavator untuk melepaskan panas terakumulasi, serta mengaplikasikan bahan kimia pemadam (chemical fire suppressant) / water spray pada titik-titik bara guna mencegah terjadinya penyalaan ulang (re-ignition).';

    verifikasiTeks =
      'Berdasarkan hasil verifikasi akhir, tidak terdapat korban jiwa maupun korban luka, tidak terjadi kerusakan pada tegakan vegetasi maupun tanaman revegetasi di sekitar lokasi, dan tidak terdapat perluasan api ke area kawasan hutan di sekitarnya.';
  }

  return {
    id: idBaru,
    nomorLaporan: noLaporan,
    judul: `Laporan Pemantauan Titik Panas (Hotspot) - ${
      isDas ? 'Areal Rehabilitasi DAS Tahura Sultan Adam' : isIppkh ? 'Area IPPKH Tapin' : 'Area IUP PT EBL'
    } (${tglStr})`,
    tanggalLaporan: tglStr,
    waktuLaporan: waktuStr,
    perusahaan: 'PT. ENERGI BATUBARA LESTARI',
    pemegangIzin: 'PT Energi Batubara Lestari',
    jenisIzin,
    skNomorTanggal: skIzin,
    jangkaWaktuIzin: isDas ? 'Masa Penanaman & Pemeliharaan (P0 - P2)' : '27 Januari 2022-27 Januari 2030',
    luas,
    statusKawasanHutan: statusHutan,
    kabupaten,
    provinsi: 'Kalimantan Selatan',
    titikIds: titikLayak.map((t) => t.id),
    titikKoordinat,
    deskripsiUmum,
    kronologi: {
      waktuVerifikasi: `Tanggal ${tglStr}, pukul ${waktuStr}`,
      lokasiSpesifik: `Wilayah kerja PT Energi Batubara Lestari pada ${jenisIzin}, tepatnya pada koordinat ${daftarTitikTeks}.`,
      pengamatanVisual: kronologiVisual,
      tindakanPenanganan: tindakanTeks,
      prosesPemadaman: `Proses pemadaman berlangsung hingga bara dan api dinyatakan padam sepenuhnya dan terkendali. Setelah pemadaman selesai, tim melakukan pendinginan (mopping up) dan pemantauan berkala untuk memastikan tidak terdapat sisa bara yang berpotensi menyala kembali.`,
      hasilVerifikasi: verifikasiTeks,
    },
    // Foto & screenshot diisi dari lapangan (form / tinjau), bukan foto contoh.
    dokumentasi: { petaSipongi: [], fotoLapangan: [] },
    status: 'Draf',
    dibuatOleh: pembuatBawaan().nama,
    jabatanPembuat: pembuatBawaan().jabatan,
    dibuatPada: now.toISOString(),
    diubahPada: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Penyimpanan Lokal
// ---------------------------------------------------------------------------

/**
 * Mode demo memakai titik fiktif: koordinat dibulatkan, tanpa nomor SK, dan
 * tanpa nama petak asli — supaya data konsesi perusahaan tidak ikut terlihat
 * pemakai di luar departemen.
 */
export function titikApiDemo(): TitikApiFireItem[] {
  const k = kotaDemoTerpilih();
  const jam = (n: number) => new Date(Date.now() - n * 3600_000).toISOString();
  const lokasi = { desa: `Kelurahan Contoh`, kecamatan: `Kecamatan Contoh`, kabupaten: k.nama, provinsi: k.provinsi };
  // Posisi relatif terhadap wilayah contoh di lib/wilayah-fire.ts.
  return [
    { id: 'contoh-titik-1', lat: k.lat - 0.006, lon: k.lon + 0.004, waktu: jam(6), sumber: 'NASA-SNPP', keyakinan: 'sedang', frp: 7.2,
      area: 'tambang', zona: 'iup', bidang: 'AREA KERJA CONTOH', ...lokasi, status: 'baru', catatan: 'CONTOH · titik untuk mencoba alur pelaporan' },
    { id: 'contoh-titik-2', lat: k.lat - 0.014, lon: k.lon + 0.016, waktu: jam(20), sumber: 'NASA-NOAA20', keyakinan: 'tinggi', frp: 10.4,
      area: 'tambang', zona: 'ippkh', bidang: 'IZIN CONTOH', ...lokasi, status: 'dicek', catatan: 'CONTOH · sedang dicek tim lapangan' },
    { id: 'contoh-titik-3', lat: k.lat + 0.022, lon: k.lon - 0.02, waktu: jam(30), sumber: 'MODIS', keyakinan: 'tinggi', frp: 12.5,
      area: 'das', zona: 'petak', bidang: 'PETAK CONTOH 1', ...lokasi, status: 'padam', catatan: 'CONTOH · sudah dipadamkan' },
    { id: 'contoh-titik-4', lat: k.lat - 0.034, lon: k.lon + 0.042, waktu: jam(48), sumber: 'NASA-NOAA21', keyakinan: 'rendah', frp: 2.8,
      area: 'tambang', zona: 'waspada', bidang: 'LUAR AREA (±1 km)', ...lokasi, status: 'bukan_api', catatan: 'CONTOH · ternyata pembakaran sampah warga' },
  ];
}

/** Ganti titik contoh ke kota lain (dipanggil saat kota demo diganti). */
export function aturUlangTitikDemo(): TitikApiFireItem[] {
  const titik = titikApiDemo();
  try { localStorage.setItem(`${KUNCI_STORAGE_TITIK_FIRE}_demo`, JSON.stringify(titik)); } catch { /* abaikan */ }
  return titik;
}

/** Kunci penyimpanan terpisah agar data demo tidak bercampur dengan data kerja. */
const kunciTitik = () => (demoAktif() ? `${KUNCI_STORAGE_TITIK_FIRE}_demo` : KUNCI_STORAGE_TITIK_FIRE);
const kunciLaporan = () => (demoAktif() ? `${KUNCI_STORAGE_LAPORAN_FIRE}_demo` : KUNCI_STORAGE_LAPORAN_FIRE);

export function muatTitikApiMonitoring(): TitikApiFireItem[] {
  const bawaan = demoAktif() ? titikApiDemo() : TITIK_API_DEFAULT;
  if (typeof window === 'undefined') return bawaan;
  try {
    const raw = localStorage.getItem(kunciTitik());
    if (!raw) {
      localStorage.setItem(kunciTitik(), JSON.stringify(bawaan));
      return bawaan;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return bawaan;
    if (demoAktif()) {
      // Titik demo lama (dekat area asli atau kota sebelumnya) diganti titik di kota pilihan.
      const k = kotaDemoTerpilih();
      const dekatKota = parsed.some((t: TitikApiFireItem) => Math.abs(t.lat - k.lat) < 0.3 && Math.abs(t.lon - k.lon) < 0.3);
      return dekatKota ? parsed : aturUlangTitikDemo();
    }

    // Pastikan titik Rehab DAS ada di dalam list
    const adaDas = parsed.some((t: TitikApiFireItem) => t.area === 'das' || t.zona === 'petak');
    if (!adaDas) {
      const dasPoints = TITIK_API_DEFAULT.filter((t) => t.area === 'das' || t.zona === 'petak');
      const gabungan = [...dasPoints, ...parsed];
      localStorage.setItem(kunciTitik(), JSON.stringify(gabungan));
      return gabungan;
    }
    return parsed;
  } catch {
    return bawaan;
  }
}

export function simpanTitikApiMonitoring(items: TitikApiFireItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(kunciTitik(), JSON.stringify(items));
  } catch {}
}

export const DAFTAR_LAPORAN_DEFAULT: LaporanKarhutla[] = [
  LAPORAN_AWAL_CONTOH,
  LAPORAN_REHABDAS_CONTOH,
];

export function muatDaftarLaporanKarhutla(): LaporanKarhutla[] {
  const bawaan = demoAktif() ? [] : DAFTAR_LAPORAN_DEFAULT;
  if (typeof window === 'undefined') return bawaan;
  try {
    const raw = localStorage.getItem(kunciLaporan());
    if (!raw) {
      localStorage.setItem(kunciLaporan(), JSON.stringify(bawaan));
      return bawaan;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return bawaan;
    return parsed;
  } catch {
    return bawaan;
  }
}

export function simpanDaftarLaporanKarhutla(daftar: LaporanKarhutla[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(kunciLaporan(), JSON.stringify(daftar));
  } catch {}
}

/**
 * Buat laporan karhutla dari titik terpilih. Di mode demo, semua nama
 * perusahaan, kawasan, kabupaten, dan nomor SK disamarkan (lib/wilayah-fire.ts).
 */
export function buatLaporanOtomatis(params: Parameters<typeof buatLaporanOtomatisAsli>[0]): LaporanKarhutla {
  return anonimkanDalam(buatLaporanOtomatisAsli(params));
}

export interface DataTitikLive {
  titik: TitikApiFireItem[];
  /** Waktu server terakhir mengambil data NASA FIRMS (ISO), bila ada. */
  terakhir: string | null;
  galat: string | null;
  terpasang: boolean;
  /** Terisi bila server tak terjangkau: yang tampil salinan terakhir di perangkat (waktu ISO salinan). */
  salinanDari?: string;
}

const KUNCI_SALINAN_NASA = 'pokemonkey_fire_nasa_v1';

/**
 * Titik api NASA FIRMS dari server (cron mengambilnya tiap jam ke tabel titik_api).
 * `jam` = jendela waktu: 24 untuk LIVE, 168 untuk riwayat 7 hari.
 * Bila server tak terjangkau (sinyal lapangan), salinan terakhir di perangkat
 * dipakai dan ditandai `salinanDari`. Mode demo tidak punya server: titik
 * contoh di kota pilihan.
 */
export async function muatTitikNasa(jam: number): Promise<DataTitikLive> {
  const batas = Date.now() - jam * 3600_000;
  const dalamJendela = (d: DataTitikLive): DataTitikLive => ({ ...d, titik: d.titik.filter((t) => Date.parse(t.waktu) >= batas) });
  if (demoAktif()) {
    return dalamJendela({ titik: titikApiDemo(), terakhir: new Date().toISOString(), galat: null, terpasang: true });
  }
  try {
    const d = await api<{ titik: TitikApi[]; terakhir: string | null; galat: string | null; terpasang: boolean }>(
      `/api/titik-api?hari=${Math.max(1, Math.ceil(jam / 24))}`,
    );
    const hasil: DataTitikLive = {
      titik: d.titik.map((t) => ({
        id: t.id, lat: t.lat, lon: t.lon, waktu: t.waktu, sumber: namaSatelit(t.sumber), keyakinan: t.keyakinan, frp: t.frp,
        area: t.area ?? 'tambang', zona: t.zona, bidang: t.bidang, status: t.status, catatan: t.catatan ?? undefined,
      })),
      terakhir: d.terakhir,
      galat: d.galat,
      terpasang: d.terpasang,
    };
    try { localStorage.setItem(KUNCI_SALINAN_NASA, JSON.stringify({ ...hasil, diambil: new Date().toISOString() })); } catch { /* abaikan */ }
    return dalamJendela(hasil);
  } catch (e) {
    try {
      const salinan = JSON.parse(localStorage.getItem(KUNCI_SALINAN_NASA) || 'null') as (DataTitikLive & { diambil: string }) | null;
      if (salinan?.titik) return dalamJendela({ ...salinan, salinanDari: salinan.diambil });
    } catch { /* abaikan */ }
    throw e;
  }
}
