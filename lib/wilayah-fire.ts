/**
 * Wilayah yang dipakai modul FIRE (peta, gambar peta otomatis, teks laporan).
 *
 * - Mode kerja: poligon IUP / IPPKH / petak Rehab DAS milik perusahaan.
 * - Mode demo : wilayah fiktif di sekitar kota yang dipilih pemakai, sehingga
 *   orang di luar departemen bisa mencoba alur pemantauan titik api di kota
 *   mereka sendiri tanpa melihat batas konsesi, nomor SK, atau nama kawasan asli.
 *
 * Semua layar FIRE mengambil wilayah dari sini, jadi aturan demo cukup ditulis sekali.
 */

import { AREA_EBL, type BidangArea } from '../server/src/area-ebl';
import { AREA_DAS } from '../server/src/area-das';
import { demoAktif } from './api';

export interface KotaDemo {
  id: string;
  nama: string;
  provinsi: string;
  lat: number;
  lon: number;
}

/** Kota pilihan untuk mode demo, tersebar dari barat sampai timur Indonesia. */
export const KOTA_DEMO: KotaDemo[] = [
  { id: 'jakarta', nama: 'Jakarta', provinsi: 'DKI Jakarta', lat: -6.2, lon: 106.82 },
  { id: 'bandung', nama: 'Bandung', provinsi: 'Jawa Barat', lat: -6.92, lon: 107.61 },
  { id: 'semarang', nama: 'Semarang', provinsi: 'Jawa Tengah', lat: -6.99, lon: 110.42 },
  { id: 'yogyakarta', nama: 'Yogyakarta', provinsi: 'DI Yogyakarta', lat: -7.8, lon: 110.37 },
  { id: 'surabaya', nama: 'Surabaya', provinsi: 'Jawa Timur', lat: -7.26, lon: 112.75 },
  { id: 'denpasar', nama: 'Denpasar', provinsi: 'Bali', lat: -8.67, lon: 115.21 },
  { id: 'medan', nama: 'Medan', provinsi: 'Sumatera Utara', lat: 3.59, lon: 98.67 },
  { id: 'pekanbaru', nama: 'Pekanbaru', provinsi: 'Riau', lat: 0.51, lon: 101.45 },
  { id: 'palembang', nama: 'Palembang', provinsi: 'Sumatera Selatan', lat: -2.99, lon: 104.76 },
  { id: 'jambi', nama: 'Jambi', provinsi: 'Jambi', lat: -1.61, lon: 103.61 },
  { id: 'pontianak', nama: 'Pontianak', provinsi: 'Kalimantan Barat', lat: -0.03, lon: 109.34 },
  { id: 'palangkaraya', nama: 'Palangka Raya', provinsi: 'Kalimantan Tengah', lat: -2.21, lon: 113.92 },
  { id: 'banjarmasin', nama: 'Banjarmasin', provinsi: 'Kalimantan Selatan', lat: -3.32, lon: 114.59 },
  { id: 'balikpapan', nama: 'Balikpapan', provinsi: 'Kalimantan Timur', lat: -1.24, lon: 116.85 },
  { id: 'samarinda', nama: 'Samarinda', provinsi: 'Kalimantan Timur', lat: -0.5, lon: 117.15 },
  { id: 'makassar', nama: 'Makassar', provinsi: 'Sulawesi Selatan', lat: -5.14, lon: 119.43 },
  { id: 'manado', nama: 'Manado', provinsi: 'Sulawesi Utara', lat: 1.47, lon: 124.84 },
  { id: 'jayapura', nama: 'Jayapura', provinsi: 'Papua', lat: -2.53, lon: 140.72 },
];

const KUNCI_KOTA = 'pokemonkey_demo_kota';

export function kotaDemoTerpilih(): KotaDemo {
  try {
    const id = localStorage.getItem(KUNCI_KOTA);
    const kota = KOTA_DEMO.find((k) => k.id === id);
    if (kota) return kota;
  } catch { /* abaikan */ }
  return KOTA_DEMO[0];
}

export function pilihKotaDemo(id: string): KotaDemo {
  const kota = KOTA_DEMO.find((k) => k.id === id) ?? KOTA_DEMO[0];
  try { localStorage.setItem(KUNCI_KOTA, kota.id); } catch { /* abaikan */ }
  return kota;
}

/** Persegi panjang sebagai MultiPolygon GeoJSON ([lon, lat]). */
function kotak(lat: number, lon: number, dLat: number, dLon: number): BidangArea['poligon'] {
  return [[[
    [lon - dLon, lat + dLat], [lon + dLon, lat + dLat], [lon + dLon, lat - dLat],
    [lon - dLon, lat - dLat], [lon - dLon, lat + dLat],
  ]]];
}

export interface IdentitasWilayah {
  perusahaan: string;
  singkatan: string;
  kotaKab: string;
  provinsi: string;
  /** Nama pendek tiap lapisan untuk legenda dan judul. */
  labelIup: string;
  labelIppkh: string;
  labelDas: string;
  kawasanDas: string;
}

export interface WilayahFire {
  demo: boolean;
  pusat: [number, number];
  zoom: number;
  iup: BidangArea[];
  ippkh: BidangArea[];
  das: BidangArea[];
  identitas: IdentitasWilayah;
}

const IDENTITAS_KERJA: IdentitasWilayah = {
  perusahaan: 'PT Energi Batubara Lestari',
  singkatan: 'PT EBL',
  kotaKab: 'Rantau, Tapin',
  provinsi: 'Kalimantan Selatan',
  labelIup: 'IUP PT EBL',
  labelIppkh: 'IPPKH (SK.78)',
  labelDas: 'Rehab DAS',
  kawasanDas: 'Tahura Sultan Adam',
};

/** Wilayah aktif: asli di mode kerja, fiktif di sekitar kota pilihan di mode demo. */
export function wilayahFire(): WilayahFire {
  if (!demoAktif()) {
    return { demo: false, pusat: [-2.958, 115.22], zoom: 14, iup: AREA_EBL.iup, ippkh: AREA_EBL.ippkh, das: AREA_DAS, identitas: IDENTITAS_KERJA };
  }
  const k = kotaDemoTerpilih();
  return {
    demo: true,
    // Wilayah contoh digeser sedikit ke tenggara pusat kota agar tidak menutup keterangan kota di peta.
    pusat: [k.lat - 0.01, k.lon + 0.01],
    zoom: 13,
    iup: [{ nama: 'AREA KERJA CONTOH', poligon: kotak(k.lat - 0.01, k.lon + 0.01, 0.016, 0.022) }],
    ippkh: [{ nama: 'IZIN CONTOH', keterangan: 'Izin kawasan contoh (fiktif)', poligon: kotak(k.lat - 0.014, k.lon + 0.016, 0.005, 0.007) }],
    das: [
      { nama: 'PETAK CONTOH 1', poligon: kotak(k.lat + 0.022, k.lon - 0.02, 0.005, 0.006) },
      { nama: 'PETAK CONTOH 2', poligon: kotak(k.lat + 0.012, k.lon - 0.028, 0.004, 0.005) },
    ],
    identitas: {
      perusahaan: 'PT Contoh Sejahtera',
      singkatan: 'PT Contoh',
      kotaKab: k.nama,
      provinsi: k.provinsi,
      labelIup: 'Area kerja contoh',
      labelIppkh: 'Izin contoh',
      labelDas: 'Petak contoh',
      kawasanDas: `Kawasan Hijau Contoh ${k.nama}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Penyamaran teks laporan di mode demo
// ---------------------------------------------------------------------------

/** Pasangan [asli, pengganti]; urut dari yang terpanjang agar tidak saling memotong. */
function penggantiDemo(): [RegExp, string][] {
  const w = wilayahFire().identitas;
  return [
    [/SK\.?\s?498\/MenLHK-PDASRH\/2021/gi, 'SK.000/CONTOH/2026'],
    [/SK\.?\s?6982\/MenLHK-PKTL\/Ren\/Pla\.0\/9\/2022/gi, 'SK.000/CONTOH/2026'],
    [/(Nomor\s+)?78\/MENLHK\/[A-Z.\/0-9]+\/2022/gi, 'Nomor 000/CONTOH/2026'],
    [/SK\.\d+\/[A-Za-z0-9.\/-]+/g, 'SK.000/CONTOH/2026'],
    [/\bSK\.\s?\d+\b/g, 'SK.000'],
    [/UPTD Tahura Sultan Adam/gi, 'pengelola kawasan setempat'],
    [/Taman Hutan Raya \(Tahura\) Sultan Adam/gi, w.kawasanDas],
    [/Tahura Sultan Adam/gi, w.kawasanDas],
    [/Tahura/gi, 'kawasan hijau'],
    [/PT\.?\s?Energi Batubara Lestari/gi, w.perusahaan],
    [/Energi Batubara Lestari/gi, w.perusahaan],
    [/Hasnur Group/gi, 'Grup Contoh'],
    [/PT\.?\s?EBL/g, w.singkatan],
    [/\bEBL\b/g, 'CONTOH'],
    [/Banjar \(Kec\. Aranio\)/gi, `${w.kotaKab}, ${w.provinsi}`],
    [/Rantau,\s*Tapin/gi, `${w.kotaKab}, ${w.provinsi}`],
    [/\bTapin\b/g, w.kotaKab],
    [/\bRantau\b/g, w.kotaKab],
    [/\bAranio\b/g, w.kotaKab],
    [/\bMeratus\b/g, 'perbukitan setempat'],
    [/batubara/gi, 'material'],
  ];
}

/** Samarkan satu teks bila mode demo aktif. */
export function anonimkanTeks(teks: string): string {
  if (!demoAktif() || !teks) return teks;
  return penggantiDemo().reduce((t, [pola, ganti]) => t.replace(pola, ganti), teks);
}

/** Samarkan semua teks di dalam objek (laporan utuh) bila mode demo aktif. */
export function anonimkanDalam<T>(nilai: T): T {
  if (!demoAktif()) return nilai;
  const ganti = penggantiDemo();
  const jalan = (v: unknown): unknown => {
    if (typeof v === 'string') return ganti.reduce((t, [pola, g]) => t.replace(pola, g), v);
    if (Array.isArray(v)) return v.map(jalan);
    if (v && typeof v === 'object') {
      // Gambar (data URL) tidak disentuh.
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, typeof x === 'string' && x.startsWith('data:') ? x : jalan(x)]));
    }
    return v;
  };
  return jalan(nilai) as T;
}
