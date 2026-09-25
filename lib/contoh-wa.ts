/**
 * Contoh pesan WhatsApp untuk buku panduan.
 *
 * Teksnya disusun oleh fungsi yang SAMA dengan yang dipakai server saat
 * mengirim (server/src/ringkasan.ts, server/src/titik-api-murni.ts), memakai
 * data contoh fiktif. Bila format pesan di server berubah, contoh di buku
 * panduan ikut berubah dengan sendirinya.
 */

import { susunRekapPica, susunPesanTagihPica, type PicaRekap } from '../server/src/ringkasan';
import {
  susunPeringatanTitikApi, susunPeringatanTitikApiDas, susunRekapTitikApi7Hari,
  type TitikApi, type InfoPetak,
} from '../server/src/titik-api-murni';

export interface ContohWa {
  id: string;
  judul: string;
  /** Kapan pesan dikirim. */
  kapan: string;
  /** Tujuan pesan. */
  kepada: string;
  /** Jam di pojok gelembung. */
  jam: string;
  teks: string;
}

// Tanggal contoh tetap supaya teks tidak berubah-ubah tiap hari.
const RABU = '2026-09-16';
const JUMAT = '2026-09-18';

const PICA: PicaRekap[] = [
  {
    id: 'PICA-26W36-03', judul: 'Sengon potting belum mencapai target persemaian', judul_singkat: 'sengon potting', bidang: 'nursery', status: 'Continue',
    due_date: '2026-09-12', pic_id: 'u1', pic_nama: 'Budi Santoso', target: 62195, realisasi: 34312, satuan: 'batang',
    tindakan: 'Tambah dua tenaga harian untuk pengisian polybag. Laporkan capaian tiap Jumat.',
  },
  {
    id: 'PICA-26W37-05', judul: 'Penanaman LCC blok utara belum mulai', judul_singkat: 'penanaman LCC blok utara', bidang: 'revegetasi',
    status: 'Open', due_date: '2026-09-15', pic_id: 'u1', pic_nama: 'Budi Santoso',
    tindakan: 'Koordinasi jadwal alat berat dengan tim tambang.',
  },
  {
    id: 'PICA-26W37-07', judul: 'Papan informasi petak tanam rusak di tiga titik', bidang: 'revegetasi', status: 'Open',
    due_date: '2026-09-24', pic_id: 'u2', pic_nama: 'Sari Wulandari',
    tindakan: 'Ganti papan dengan bahan besi galvanis.',
  },
];

const jamUtc = (tanggal: string, jamWita: string) => new Date(Date.parse(`${tanggal}T${jamWita}:00Z`) - 8 * 3600_000).toISOString();

function titik(p: Partial<TitikApi> & Pick<TitikApi, 'id' | 'zona' | 'waktu'>): TitikApi {
  return {
    sumber: 'VIIRS_NOAA20_NRT', lat: -2.95, lon: 115.2, keyakinan: 'sedang', frp: 1.8,
    area: 'tambang', jarak_km: 0, bidang: null, status: 'baru', ...p,
  };
}

const TITIK_TAMBANG: TitikApi[] = [
  titik({ id: 't1', zona: 'ippkh', bidang: 'SK.966', waktu: jamUtc(RABU, '01:39'), sumber: 'VIIRS_NOAA21_NRT' }),
  titik({ id: 't2', zona: 'iup', waktu: jamUtc(RABU, '02:15'), sumber: 'VIIRS_SNPP_NRT' }),
  titik({ id: 't3', zona: 'waspada', jarak_km: 1.2, waktu: jamUtc(RABU, '02:34') }),
];

const TITIK_DAS: TitikApi[] = [
  titik({ id: 'd1', area: 'das', zona: 'petak', bidang: 'PETAK 8', waktu: jamUtc(RABU, '13:42'), keyakinan: 'tinggi', sumber: 'VIIRS_SNPP_NRT' }),
];
const PETAK = new Map<string, InfoPetak>([['PETAK 8', { luas_ha: 24.5, vendor: 'CV Hijau Lestari', status: 'Pemeliharaan I' }]]);

/** Tautan peta berisi koordinat; di buku panduan diganti tanda singkat. */
const samarkanTautan = (teks: string) => teks.replace(/https?:\/\/\S+/g, 'maps.google.com/…');

export function contohPesanWa(): ContohWa[] {
  const bersih = (t: string) => samarkanTautan(t);
  return [
    {
      id: 'rekap-harian',
      judul: 'Rekap PICA harian',
      kapan: 'Senin–Kamis 16.00 WITA, otomatis',
      kepada: 'Grup WhatsApp tim',
      jam: '16.00',
      teks: bersih(susunRekapPica({
        jenis: 'harian', hariIni: RABU, terbuka: PICA, selesaiHariIni: 1,
        bergerak: [{ pica_id: PICA[0].id, oleh: 'Budi Santoso' }, { pica_id: PICA[2].id, oleh: 'Sari Wulandari' }],
        tautan: '(tautan papan PICA)',
      })),
    },
    {
      id: 'rekap-mingguan',
      judul: 'Rekap PICA mingguan',
      kapan: 'Jumat 16.00 WITA, otomatis',
      kepada: 'Grup WhatsApp tim',
      jam: '16.00',
      teks: bersih(susunRekapPica({
        jenis: 'mingguan', hariIni: JUMAT, terbuka: PICA.slice(0, 2), selesaiHariIni: 0, bergerak: [],
        mingguan: { dari: '2026-09-14', baru: 2, ditutup: 3 },
      })),
    },
    {
      id: 'api-tambang',
      judul: 'Peringatan titik api · area tambang',
      kapan: 'Saat satelit mendeteksi titik baru di IPPKH, IUP, atau zona waspada (maks. 4 pesan per hari)',
      kepada: 'Grup WhatsApp tim',
      jam: '03.00',
      teks: bersih(susunPeringatanTitikApi(TITIK_TAMBANG, jamUtc(RABU, '03:00'), {
        total: 11, ippkh: 2, iup: 3, waspada: 6, belum_dicek: 5, sedang_dicek: 2, padam: 3, bukan_api: 1,
      })),
    },
    {
      id: 'api-das',
      judul: 'Peringatan titik api · Rehab DAS',
      kapan: 'Saat ada titik baru di petak atau dekat petak Rehab DAS (maks. 4 pesan per hari)',
      kepada: 'Grup WhatsApp tim',
      jam: '14.00',
      teks: bersih(susunPeringatanTitikApiDas(TITIK_DAS, jamUtc(RABU, '14:00'), PETAK)),
    },
    {
      id: 'api-rekap',
      judul: 'Rekap titik api 7 hari',
      kapan: 'Saat Admin menekan tombol rekap di panel titik api (KEBUN)',
      kepada: 'Grup WhatsApp tim',
      jam: '08.00',
      teks: bersih(susunRekapTitikApi7Hari(
        jamUtc(RABU, '08:00'),
        { riwayat: { total: 11, ippkh: 2, iup: 3, waspada: 6, belum_dicek: 5, sedang_dicek: 2, padam: 3, bukan_api: 1 }, titik: TITIK_TAMBANG.slice(0, 2) },
        { riwayat: { total: 1, petak: 1, waspada: 0, belum_dicek: 1, sedang_dicek: 0, padam: 0, bukan_api: 0 }, titik: TITIK_DAS },
      )),
    },
    {
      id: 'tagih',
      judul: 'Pengingat PICA untuk satu anggota',
      kapan: 'Dari kartu anggota, tombol "Buka WhatsApp": teks sudah terisi, Anda yang menekan kirim',
      kepada: 'Chat pribadi anggota',
      jam: '09.15',
      teks: susunPesanTagihPica({
        nama: 'Budi Santoso', dari: 'Sari', hariIni: RABU,
        pica: PICA.slice(0, 2).map((p) => ({ id: p.id, judul: p.judul, status: p.status, due_date: p.due_date })),
      }),
    },
  ];
}
