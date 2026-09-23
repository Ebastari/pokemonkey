/**
 * Hari libur nasional & cuti bersama Indonesia.
 *
 * Sumber: SKB 3 Menteri
 *   - 2026: No. 1497/2025, 2/2025, 5/2025 (ditetapkan 19 Sep 2025)
 *   - 2027: No. 1205/2026, 3/2026, 2/2026 (ditetapkan 15 Sep 2026)
 * Dicocokkan dengan setneg.go.id dan satu sumber berita per tahun.
 * Tanggal hari besar Islam 2027 masih dapat disesuaikan Keputusan Menteri Agama
 * (ditandai `perkiraan`). Salinan yang sama ada di server/migrations/0006,
 * Admin bisa merevisi atau menambah libur perusahaan dari aplikasi.
 * Berkas ini adalah cadangan saat offline / mode demo.
 */

export type JenisLibur = 'nasional' | 'cuti' | 'perusahaan';

export interface Libur {
  id?: number;
  tanggal: string;
  nama: string;
  jenis: JenisLibur;
  perkiraan?: boolean;
}

const N = (tanggal: string, nama: string, perkiraan = false): Libur => ({ tanggal, nama, jenis: 'nasional', perkiraan });
const C = (tanggal: string, nama: string, perkiraan = false): Libur => ({ tanggal, nama, jenis: 'cuti', perkiraan });

export const LIBUR_BAWAAN: Libur[] = [
  // ---------- 2026 ----------
  N('2026-01-01', 'Tahun Baru 2026 Masehi'),
  N('2026-01-16', 'Isra Mikraj Nabi Muhammad SAW'),
  C('2026-02-16', 'Cuti bersama Tahun Baru Imlek'),
  N('2026-02-17', 'Tahun Baru Imlek 2577 Kongzili'),
  C('2026-03-18', 'Cuti bersama Hari Suci Nyepi'),
  N('2026-03-19', 'Hari Suci Nyepi (Tahun Baru Saka 1948)'),
  C('2026-03-20', 'Cuti bersama Idulfitri'),
  N('2026-03-21', 'Idulfitri 1447 H'),
  N('2026-03-22', 'Idulfitri 1447 H'),
  C('2026-03-23', 'Cuti bersama Idulfitri'),
  C('2026-03-24', 'Cuti bersama Idulfitri'),
  N('2026-04-03', 'Wafat Yesus Kristus'),
  N('2026-04-05', 'Kebangkitan Yesus Kristus (Paskah)'),
  N('2026-05-01', 'Hari Buruh Internasional'),
  N('2026-05-14', 'Kenaikan Yesus Kristus'),
  C('2026-05-15', 'Cuti bersama Kenaikan Yesus Kristus'),
  N('2026-05-27', 'Iduladha 1447 H'),
  C('2026-05-28', 'Cuti bersama Iduladha'),
  N('2026-05-31', 'Hari Raya Waisak 2570 BE'),
  N('2026-06-01', 'Hari Lahir Pancasila'),
  N('2026-06-16', '1 Muharam Tahun Baru Islam 1448 H'),
  N('2026-08-17', 'Proklamasi Kemerdekaan RI'),
  N('2026-08-25', 'Maulid Nabi Muhammad SAW'),
  C('2026-12-24', 'Cuti bersama Natal'),
  N('2026-12-25', 'Kelahiran Yesus Kristus (Natal)'),

  // ---------- 2027 ----------
  N('2027-01-01', 'Tahun Baru 2027 Masehi'),
  N('2027-01-05', 'Isra Mikraj Nabi Muhammad SAW', true),
  C('2027-02-05', 'Cuti bersama Tahun Baru Imlek'),
  N('2027-02-06', 'Tahun Baru Imlek 2578 Kongzili'),
  N('2027-03-08', 'Hari Suci Nyepi (Tahun Baru Saka 1949)'),
  C('2027-03-09', 'Cuti bersama Idulfitri', true),
  N('2027-03-10', 'Idulfitri 1448 H', true),
  N('2027-03-11', 'Idulfitri 1448 H', true),
  C('2027-03-12', 'Cuti bersama Idulfitri', true),
  C('2027-03-15', 'Cuti bersama Idulfitri', true),
  C('2027-03-25', 'Cuti bersama Wafat Yesus Kristus'),
  N('2027-03-26', 'Wafat Yesus Kristus'),
  N('2027-03-28', 'Kebangkitan Yesus Kristus (Paskah)'),
  N('2027-05-01', 'Hari Buruh Internasional'),
  N('2027-05-06', 'Kenaikan Yesus Kristus'),
  N('2027-05-17', 'Iduladha 1448 H', true),
  C('2027-05-18', 'Cuti bersama Iduladha', true),
  C('2027-05-19', 'Cuti bersama Waisak'),
  N('2027-05-20', 'Hari Raya Waisak 2571 BE'),
  N('2027-06-01', 'Hari Lahir Pancasila'),
  N('2027-06-06', '1 Muharam Tahun Baru Islam 1449 H', true),
  N('2027-08-15', 'Maulid Nabi Muhammad SAW', true),
  N('2027-08-17', 'Proklamasi Kemerdekaan RI'),
  C('2027-12-24', 'Cuti bersama Natal'),
  N('2027-12-25', 'Kelahiran Yesus Kristus (Natal)'),
  N('2027-12-26', 'Isra Mikraj Nabi Muhammad SAW', true),
];

/** tanggal -> daftar libur di tanggal itu (bisa lebih dari satu). */
export function petaLibur(daftar: Libur[]): Map<string, Libur[]> {
  const m = new Map<string, Libur[]>();
  for (const l of daftar) {
    const ada = m.get(l.tanggal);
    if (ada) ada.push(l);
    else m.set(l.tanggal, [l]);
  }
  return m;
}

export const LABEL_JENIS: Record<JenisLibur, string> = {
  nasional: 'Libur nasional',
  cuti: 'Cuti bersama',
  perusahaan: 'Libur perusahaan',
};
