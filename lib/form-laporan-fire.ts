/**
 * Form laporan karhutla: pilihan penyebab, penyusun kalimat kronologi, dan
 * impor CSV (seperti impor PICA).
 *
 * Identitas izin (pemegang izin, SK, luas, …) sudah pasti dari zona titik, jadi
 * form dan CSV hanya berisi kronologi. Kalimat penyebab ditulis netral: menjelaskan
 * yang teramati di lapangan tanpa menyimpulkan pihak mana pun sebagai penyebab.
 *
 * Rujukan penyebab: KLHK/BPBD (penyebab karhutla alam & manusia), NASA/NOAA
 * (titik panas VIIRS = anomali panas, tidak selalu api), kajian pembakaran
 * spontan timbunan batubara (oksidasi eksotermik).
 */

import { parseCsv } from './csv-pica';
import type { LaporanKarhutla } from './fire-report';

export type KodePenyebab =
  | 'spontan'
  | 'vegetasi_kering'
  | 'luar_areal'
  | 'bara_bawah'
  | 'petir'
  | 'padam_sendiri'
  | 'anomali_panas'
  | 'operasional'
  | 'manual';

export interface PenyebabKebakaran {
  kode: KodePenyebab;
  label: string;
  /** Ada api/bara yang dipadamkan tim? Menentukan kalimat butir B.4. */
  adaApi: boolean;
  /** Lanjutan kalimat "titik panas tersebut bersumber dari …". {area} = nama area izin. */
  sumber: string;
  /** Butir B.2: pengamatan visual & penyebab. */
  pengamatan: string;
  /** Butir B.3: tindakan penanganan. {perusahaan} = pemegang izin. */
  tindakan: string;
  /** Kalimat akhir butir B.4. */
  hasil: string;
}

const HASIL_API =
  'Berdasarkan hasil verifikasi akhir, tidak terdapat korban jiwa maupun korban luka, tidak terjadi kerusakan pada tegakan vegetasi maupun tanaman revegetasi di sekitar lokasi, dan tidak terdapat perluasan api ke kawasan hutan di sekitarnya.';
const HASIL_TANPA_API =
  'Berdasarkan hasil verifikasi, lokasi dalam kondisi aman, tidak terdapat korban jiwa maupun korban luka, dan tidak terjadi kerusakan vegetasi di sekitar lokasi.';
const TINDAKAN_VEGETASI =
  'Tim tanggap darurat kebakaran {perusahaan} segera melakukan pemadaman menggunakan peralatan pemadam manual (gepyok dan pompa punggung) serta pompa air portabel, membuat sekat bakar di sekeliling area terbakar untuk menghentikan rambatan api, dan membasahi perimeter area terdampak.';

export const DAFTAR_PENYEBAB: PenyebabKebakaran[] = [
  {
    kode: 'spontan',
    label: 'Pembakaran spontan timbunan batubara',
    adaApi: true,
    sumber: 'timbunan batubara yang berada di dalam {area}',
    pengamatan:
      'Berdasarkan pengamatan visual dan pemeriksaan kondisi lapangan, panas yang timbul bukan merupakan kebakaran vegetasi maupun kebakaran lahan, melainkan berasal dari fenomena pembakaran spontan (spontaneous combustion) pada timbunan batubara. Fenomena tersebut terjadi akibat proses oksidasi alami batubara dengan oksigen di udara yang menghasilkan panas secara eksotermik. Panas yang terakumulasi dan tidak terdisipasi dengan baik di dalam timbunan menyebabkan kenaikan suhu hingga mencapai titik nyala, sehingga menimbulkan bara dan asap pada permukaan timbunan. Kondisi ini diperkuat oleh cuaca kering dan suhu lingkungan yang tinggi pada periode tersebut.',
    tindakan:
      'Menindaklanjuti temuan tersebut, tim tanggap darurat kebakaran {perusahaan} segera melakukan penanganan di lokasi. Upaya pemadaman dilakukan dengan mengisolasi area terdampak, membongkar dan meratakan timbunan batubara yang membara untuk melepaskan panas yang terakumulasi, serta mengaplikasikan bahan pemadam (chemical fire suppressant) atau penyemprotan air pada titik-titik bara untuk mencegah penyalaan ulang (re-ignition).',
    hasil: HASIL_API,
  },
  {
    kode: 'vegetasi_kering',
    label: 'Kebakaran permukaan serasah/semak kering',
    adaApi: true,
    sumber: 'kebakaran permukaan pada serasah dan semak kering di dalam {area}',
    pengamatan:
      'Berdasarkan pengamatan visual dan pemeriksaan kondisi lapangan, api merupakan kebakaran permukaan yang membakar serasah, rumput, dan semak kering. Kondisi kemarau, suhu udara yang tinggi, dan kelembapan yang rendah membuat bahan bakar permukaan mudah terbakar dan api cepat merambat. Sumber penyulutan awal belum dapat dipastikan dari hasil pemeriksaan lapangan.',
    tindakan: TINDAKAN_VEGETASI,
    hasil: HASIL_API,
  },
  {
    kode: 'luar_areal',
    label: 'Api merambat dari luar areal izin',
    adaApi: true,
    sumber: 'api yang merambat dari luar batas {area}',
    pengamatan:
      'Berdasarkan pengamatan visual dan pemeriksaan kondisi lapangan, api berasal dari luar batas areal izin dan merambat mendekati atau memasuki areal melalui vegetasi kering di sekitar batas. Sumber penyulutan di luar areal tidak dapat dipastikan oleh tim dan berada di luar lingkup verifikasi ini.',
    tindakan:
      'Tim tanggap darurat kebakaran {perusahaan} melakukan pemadaman pada api yang berada di dalam dan di sekitar batas areal, membuat sekat bakar untuk mencegah api masuk lebih jauh, serta berkoordinasi dengan aparat desa dan pihak terkait setempat.',
    hasil:
      'Berdasarkan hasil verifikasi akhir, tidak terdapat korban jiwa maupun korban luka, dan rambatan api ke dalam areal izin telah dihentikan.',
  },
  {
    kode: 'bara_bawah',
    label: 'Bara di bawah permukaan (lapisan organik/gambut)',
    adaApi: true,
    sumber: 'bara di bawah permukaan tanah pada lapisan organik di dalam {area}',
    pengamatan:
      'Berdasarkan pengamatan visual dan pemeriksaan kondisi lapangan, panas berasal dari bara yang menjalar di bawah permukaan pada lapisan organik (serasah tebal atau gambut). Api jenis ini membara tanpa nyala yang jelas, menimbulkan asap, dan dapat bertahan lama di bawah permukaan.',
    tindakan:
      'Tim tanggap darurat kebakaran {perusahaan} melakukan pemadaman dengan penyuntikan dan penggenangan air pada lapisan yang membara, membongkar lapisan organik di sekitar titik bara, serta membuat sekat di sekeliling area terdampak.',
    hasil:
      'Berdasarkan hasil verifikasi akhir, tidak terdapat korban jiwa maupun korban luka, dan tidak ditemukan lagi bara aktif di bawah permukaan pada area yang ditangani.',
  },
  {
    kode: 'petir',
    label: 'Sambaran petir',
    adaApi: true,
    sumber: 'sambaran petir pada vegetasi di dalam {area}',
    pengamatan:
      'Berdasarkan pengamatan visual dan pemeriksaan kondisi lapangan, ditemukan bekas sambaran petir pada vegetasi di lokasi titik panas yang terjadi saat cuaca buruk disertai petir. Sambaran tersebut memicu api pada vegetasi di sekitarnya.',
    tindakan: TINDAKAN_VEGETASI,
    hasil: HASIL_API,
  },
  {
    kode: 'padam_sendiri',
    label: 'Bekas kebakaran, api sudah padam saat dicek',
    adaApi: false,
    sumber: 'bekas kebakaran dengan luasan terbatas di dalam {area} yang sudah padam saat tim tiba',
    pengamatan:
      'Berdasarkan pengamatan visual dan pemeriksaan kondisi lapangan, ditemukan bekas kebakaran dengan luasan terbatas, namun api dan bara telah padam saat tim tiba di lokasi. Sumber penyulutan tidak dapat dipastikan dari sisa yang ditemukan.',
    tindakan:
      'Tim melakukan pendinginan (mopping up) pada sisa bahan yang terbakar, memastikan tidak ada bara yang tersisa, dan mendokumentasikan area bekas kebakaran.',
    hasil: HASIL_TANPA_API,
  },
  {
    kode: 'anomali_panas',
    label: 'Tidak ada api (anomali panas permukaan)',
    adaApi: false,
    sumber: 'anomali panas pada permukaan terbuka di dalam {area}, bukan dari kebakaran',
    pengamatan:
      'Berdasarkan pengamatan visual dan pemeriksaan kondisi lapangan, tidak ditemukan api, bara, asap, maupun bekas kebakaran di lokasi titik panas. Satelit merekam anomali panas (thermal anomaly), bukan hanya api, sehingga titik panas tersebut diduga berasal dari suhu permukaan yang tinggi pada lahan terbuka, material berwarna gelap, atau permukaan yang memantulkan panas matahari.',
    tindakan:
      'Karena tidak ditemukan api di lokasi, tidak dilakukan tindakan pemadaman. Tim mendokumentasikan kondisi lapangan dan menandai lokasi tersebut untuk pemantauan lanjutan.',
    hasil: HASIL_TANPA_API,
  },
  {
    kode: 'operasional',
    label: 'Sumber panas kegiatan operasional (bukan kebakaran lahan)',
    adaApi: false,
    sumber: 'sumber panas dari fasilitas atau peralatan kegiatan operasional di dalam {area}',
    pengamatan:
      'Berdasarkan pengamatan visual dan pemeriksaan kondisi lapangan, titik panas bertepatan dengan lokasi fasilitas atau peralatan kegiatan operasional yang menghasilkan panas. Tidak ditemukan kebakaran vegetasi maupun kebakaran lahan di sekitar lokasi tersebut.',
    tindakan:
      'Tim memastikan sumber panas berada dalam kondisi terkendali sesuai prosedur keselamatan, memeriksa area sekitarnya dari potensi rambatan api, dan mendokumentasikan kondisi lapangan.',
    hasil: HASIL_TANPA_API,
  },
  {
    kode: 'manual',
    label: 'Manual (tulis sendiri)',
    adaApi: true,
    sumber: '',
    pengamatan: '',
    tindakan: '',
    hasil: '',
  },
];

export const penyebabDari = (kode: string) => DAFTAR_PENYEBAB.find((p) => p.kode === kode);

/** Isian form; disimpan di laporan agar form bisa dibuka lagi. */
export interface IsianFormLaporan {
  tanggalCek: string; // YYYY-MM-DD
  jamCek: string; // HH:MM
  penyebab: KodePenyebab | '';
  sumber: string;
  pengamatan: string;
  tindakan: string;
  adaApi: boolean;
  tanggalPadam: string;
  jamPadam: string;
  hasil: string;
  deskripsi: string;
  dibuatOleh: string;
  jabatanPembuat: string;
}

// ---------------------------------------------------------------------------
// Penyusun kalimat
// ---------------------------------------------------------------------------

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-09-21", "09:20" → "Pada hari Senin, tanggal 21 September 2026, pukul 09.20 WITA". */
export function waktuPanjang(tanggal: string, jam: string): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  if (!y || !m || !d) return '';
  const hari = HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `hari ${hari}, tanggal ${d} ${BULAN[m - 1]} ${y}${jam ? `, pukul ${jam.replace(':', '.')} WITA` : ''}`;
}

/** Nama area untuk kalimat kronologi, mengikuti contoh laporan. */
export function namaArea(l: LaporanKarhutla): string {
  const jenis = l.jenisIzin.toLowerCase();
  if (jenis.includes('das')) return `areal petak tanaman Rehabilitasi DAS ${l.pemegangIzin} (${l.statusKawasanHutan})`;
  if (jenis.includes('ppkh')) return `Area IPPKH ${l.pemegangIzin} berdasarkan ${l.skNomorTanggal.split(/\s+dan\s+/i)[0]}`;
  return `Area IUP Operasi Produksi ${l.pemegangIzin}`;
}

const angka = (n: number) => n.toFixed(5).replace('.', ',');

/** "Titik 1 (X: 115,22012; Y: -2,95803) dan Titik 2 (…)". */
export function daftarKoordinat(l: LaporanKarhutla): string {
  const t = l.titikKoordinat.map((k) => `Titik ${k.no} (X: ${angka(k.xBujur)}; Y: ${angka(k.yLintang)})`);
  if (t.length <= 1) return t.join('');
  return `${t.slice(0, -1).join(', ')} dan ${t[t.length - 1]}`;
}

/** Teks penyebab dengan {area}/{perusahaan} diganti isi laporan. */
export function teksPenyebab(p: PenyebabKebakaran, l: LaporanKarhutla) {
  const isi = (s: string) => s.replace(/\{area\}/g, namaArea(l)).replace(/\{perusahaan\}/g, l.pemegangIzin);
  return { sumber: isi(p.sumber), pengamatan: isi(p.pengamatan), tindakan: isi(p.tindakan), hasil: isi(p.hasil), adaApi: p.adaApi };
}

/**
 * Isian awal form. Laporan yang pernah diisi lewat form memakai isian tersimpan;
 * laporan lama (sebelum ada form) dibuka sebagai "Manual" dengan kalimat yang sudah ada.
 */
export function isianAwal(l: LaporanKarhutla, pembuat: { nama: string; jabatan: string }, baru: boolean): IsianFormLaporan {
  if (l.isianForm) return { ...l.isianForm };
  const hariIni = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10); // WITA
  if (!baru) {
    return {
      tanggalCek: l.tanggalLaporan,
      jamCek: '',
      penyebab: 'manual',
      sumber: l.kronologi.lokasiSpesifik.replace(/,?s*tepatnya pada koordinat[sS]*$/i, ''),
      pengamatan: l.kronologi.pengamatanVisual,
      tindakan: l.kronologi.tindakanPenanganan,
      adaApi: true,
      tanggalPadam: l.tanggalLaporan,
      jamPadam: '',
      hasil: l.kronologi.hasilVerifikasi,
      deskripsi: l.deskripsiUmum,
      dibuatOleh: l.dibuatOleh || pembuat.nama,
      jabatanPembuat: l.jabatanPembuat || pembuat.jabatan,
    };
  }
  return {
    tanggalCek: hariIni,
    jamCek: '',
    penyebab: '',
    sumber: '',
    pengamatan: '',
    tindakan: '',
    adaApi: true,
    tanggalPadam: hariIni,
    jamPadam: '',
    hasil: '',
    deskripsi: l.deskripsiUmum,
    dibuatOleh: pembuat.nama,
    jabatanPembuat: pembuat.jabatan,
  };
}

/** Isian yang belum lengkap → daftar pesan; kosong berarti siap ditinjau. */
export function periksaIsian(i: IsianFormLaporan): string[] {
  const galat: string[] = [];
  if (!i.tanggalCek) galat.push('Tanggal ground check belum diisi.');
  if (!i.jamCek) galat.push('Jam ground check belum diisi.');
  if (!i.penyebab) galat.push('Penyebab belum dipilih.');
  if (!i.sumber.trim()) galat.push('Sumber titik panas (butir 1) belum diisi.');
  if (!i.pengamatan.trim()) galat.push('Pengamatan & penyebab (butir 2) belum diisi.');
  if (!i.tindakan.trim()) galat.push('Tindakan penanganan (butir 3) belum diisi.');
  if (i.adaApi) {
    if (!i.tanggalPadam || !i.jamPadam) galat.push('Tanggal & jam api dinyatakan padam belum diisi.');
    else if (`${i.tanggalPadam}T${i.jamPadam}` < `${i.tanggalCek}T${i.jamCek}`) galat.push('Waktu padam lebih awal dari waktu ground check.');
  }
  if (!i.dibuatOleh.trim()) galat.push('Nama pembuat laporan belum diisi.');
  return galat;
}

/** Terapkan isian form ke laporan: kronologi B.1–B.4, deskripsi A.1, dan pembuat. */
export function terapkanIsian(l: LaporanKarhutla, i: IsianFormLaporan): LaporanKarhutla {
  const sumber = i.sumber.trim().replace(/[.\s]+$/, '');
  const pemadaman = i.adaApi
    ? `Proses pemadaman berlangsung hingga api dan bara dinyatakan padam sepenuhnya pada ${waktuPanjang(i.tanggalPadam, i.jamPadam)}. Setelah pemadaman selesai, tim melakukan pendinginan (mopping up) dan pemantauan lanjutan untuk memastikan tidak terdapat sisa bara yang berpotensi menimbulkan penyalaan ulang.`
    : 'Tim melakukan pemantauan lanjutan pada lokasi tersebut untuk memastikan kondisi tetap aman.';
  return {
    ...l,
    deskripsiUmum: i.deskripsi.trim() || l.deskripsiUmum,
    kronologi: {
      waktuVerifikasi: `Pada ${waktuPanjang(i.tanggalCek, i.jamCek)}`,
      lokasiSpesifik: `${sumber}, tepatnya pada koordinat ${daftarKoordinat(l)}.`,
      pengamatanVisual: i.pengamatan.trim(),
      tindakanPenanganan: i.tindakan.trim(),
      prosesPemadaman: pemadaman,
      hasilVerifikasi: i.hasil.trim(),
    },
    dibuatOleh: i.dibuatOleh.trim(),
    jabatanPembuat: i.jabatanPembuat.trim(),
    isianForm: { ...i },
    diubahPada: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CSV (satu baris judul + satu baris isi, seperti impor PICA)
// ---------------------------------------------------------------------------

export const KOLOM_CSV = [
  'tanggal_ground_check',
  'jam_ground_check',
  'penyebab',
  'sumber_titik_panas',
  'pengamatan',
  'tindakan',
  'ada_api',
  'tanggal_padam',
  'jam_padam',
  'hasil_verifikasi',
  'dibuat_oleh',
  'jabatan',
] as const;
type KolomCsv = (typeof KOLOM_CSV)[number];

/** Nama kolom lain yang juga dikenali (mis. hasil tulisan tangan atau AI). */
const SINONIM: Record<string, KolomCsv> = {
  tanggal: 'tanggal_ground_check', tanggal_cek: 'tanggal_ground_check', tgl_cek: 'tanggal_ground_check', tanggal_verifikasi: 'tanggal_ground_check',
  jam: 'jam_ground_check', jam_cek: 'jam_ground_check', pukul: 'jam_ground_check', jam_verifikasi: 'jam_ground_check',
  sebab: 'penyebab', kode_penyebab: 'penyebab',
  sumber: 'sumber_titik_panas', lokasi: 'sumber_titik_panas', sumber_panas: 'sumber_titik_panas',
  pengamatan_visual: 'pengamatan', kronologi: 'pengamatan', uraian: 'pengamatan',
  penanganan: 'tindakan', tindakan_penanganan: 'tindakan',
  api: 'ada_api', ada_api_dipadamkan: 'ada_api',
  tgl_padam: 'tanggal_padam', jam_selesai: 'jam_padam', pukul_padam: 'jam_padam',
  hasil: 'hasil_verifikasi', hasil_akhir: 'hasil_verifikasi',
  pembuat: 'dibuat_oleh', nama_pembuat: 'dibuat_oleh',
  jabatan_pembuat: 'jabatan',
};

const normalKolom = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** "21/09/2026", "21-09-2026", "2026-09-21" → "2026-09-21"; null bila tidak dikenali. */
function tanggalCsv(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

/** "9:20", "09.20" → "09:20"; null bila tidak dikenali. */
function jamCsv(s: string): string | null {
  const m = s.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/** Kode atau label penyebab (tidak peka huruf besar/kecil). */
function penyebabCsv(s: string): KodePenyebab | null {
  const n = normalKolom(s);
  const p = DAFTAR_PENYEBAB.find((x) => x.kode === n || normalKolom(x.label) === n || normalKolom(x.label).startsWith(n));
  return p ? p.kode : null;
}

export interface HasilImporCsv {
  isian: Partial<IsianFormLaporan>;
  galat: string[];
  terisi: number;
}

/**
 * Baca CSV form laporan. Baris pertama = judul kolom, baris kedua = isi.
 * Kolom teks yang kosong diisi kalimat bawaan dari penyebab yang dipilih.
 */
export function imporCsvForm(teks: string, l: LaporanKarhutla): HasilImporCsv {
  const baris = parseCsv(teks).filter((b) => b.some((s) => s.trim()));
  const galat: string[] = [];
  if (baris.length < 2) return { isian: {}, galat: ['CSV harus berisi baris judul kolom dan satu baris isi.'], terisi: 0 };
  if (baris.length > 2) galat.push(`CSV berisi ${baris.length - 1} baris isi; hanya baris pertama yang dipakai.`);

  const nilai: Partial<Record<KolomCsv, string>> = {};
  baris[0].forEach((judul, i) => {
    const n = normalKolom(judul);
    const kolom = (KOLOM_CSV as readonly string[]).includes(n) ? (n as KolomCsv) : SINONIM[n];
    const isi = (baris[1][i] ?? '').trim();
    if (kolom && isi) nilai[kolom] = isi;
  });

  const isian: Partial<IsianFormLaporan> = {};
  if (nilai.tanggal_ground_check) {
    const t = tanggalCsv(nilai.tanggal_ground_check);
    if (t) isian.tanggalCek = t; else galat.push(`Tanggal ground check "${nilai.tanggal_ground_check}" tidak dikenali (pakai 2026-09-21 atau 21/09/2026).`);
  }
  if (nilai.jam_ground_check) {
    const j = jamCsv(nilai.jam_ground_check);
    if (j) isian.jamCek = j; else galat.push(`Jam ground check "${nilai.jam_ground_check}" tidak dikenali (pakai 09:20).`);
  }
  if (nilai.penyebab) {
    const kode = penyebabCsv(nilai.penyebab);
    if (kode) {
      isian.penyebab = kode;
      const bawaan = teksPenyebab(penyebabDari(kode)!, l);
      isian.sumber = bawaan.sumber;
      isian.pengamatan = bawaan.pengamatan;
      isian.tindakan = bawaan.tindakan;
      isian.hasil = bawaan.hasil;
      isian.adaApi = bawaan.adaApi;
    } else {
      galat.push(`Penyebab "${nilai.penyebab}" tidak dikenali. Pakai salah satu kode: ${DAFTAR_PENYEBAB.map((p) => p.kode).join(', ')}.`);
    }
  }
  if (nilai.sumber_titik_panas) isian.sumber = nilai.sumber_titik_panas;
  if (nilai.pengamatan) isian.pengamatan = nilai.pengamatan;
  if (nilai.tindakan) isian.tindakan = nilai.tindakan;
  if (nilai.hasil_verifikasi) isian.hasil = nilai.hasil_verifikasi;
  if (nilai.ada_api) isian.adaApi = !/^(tidak|t|no|n|0|false)$/i.test(nilai.ada_api);
  if (nilai.tanggal_padam) {
    const t = tanggalCsv(nilai.tanggal_padam);
    if (t) isian.tanggalPadam = t; else galat.push(`Tanggal padam "${nilai.tanggal_padam}" tidak dikenali.`);
  }
  if (nilai.jam_padam) {
    const j = jamCsv(nilai.jam_padam);
    if (j) isian.jamPadam = j; else galat.push(`Jam padam "${nilai.jam_padam}" tidak dikenali.`);
  }
  if (nilai.dibuat_oleh) isian.dibuatOleh = nilai.dibuat_oleh;
  if (nilai.jabatan) isian.jabatanPembuat = nilai.jabatan;

  return { isian, galat, terisi: Object.keys(isian).length };
}

const selCsv = (s: string) => (/[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Template CSV: judul kolom + satu contoh baris. */
export function templateCsvForm(pembuat: { nama: string; jabatan: string }): string {
  const hariIni = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
  const contoh: Record<KolomCsv, string> = {
    tanggal_ground_check: hariIni,
    jam_ground_check: '09:20',
    penyebab: 'spontan',
    sumber_titik_panas: '',
    pengamatan: '',
    tindakan: '',
    ada_api: 'ya',
    tanggal_padam: hariIni,
    jam_padam: '14:30',
    hasil_verifikasi: '',
    dibuat_oleh: pembuat.nama,
    jabatan: pembuat.jabatan,
  };
  return `﻿${KOLOM_CSV.join(',')}\n${KOLOM_CSV.map((k) => selCsv(contoh[k])).join(',')}\n`;
}
