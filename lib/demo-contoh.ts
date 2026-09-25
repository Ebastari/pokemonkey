/**
 * Data contoh untuk Mode Demo Mandiri.
 *
 * Dipakai agar orang di luar departemen melihat aplikasinya benar-benar bekerja,
 * bukan layar kosong. Isinya **fiktif dan generik** — pekerjaan kantor dan
 * lapangan pada umumnya, bukan revegetasi — dan tidak memuat satu pun data
 * perusahaan: tanpa nama asli, tanpa angka realisasi, tanpa koordinat konsesi.
 *
 * Setiap baris diberi id berawalan `contoh-` dan judul berawalan "CONTOH ·",
 * sehingga mudah dikenali dan bisa dihapus sekaligus lewat tombol
 * "Hapus data contoh" tanpa menyentuh data yang dibuat pemakai sendiri.
 */

import { hariIniWita, geserHari } from './waktu';

export const AWALAN_CONTOH = 'contoh-';
export const LABEL_CONTOH = 'CONTOH ·';

/** Nomor WhatsApp untuk mengajukan akses tim dari mode demo. */
export const WA_GABUNG = '6281122220044';

/** Tautan WhatsApp berisi pesan pengajuan yang tinggal dikirim. */
export function tautanGabung(): string {
  const pesan =
    'Halo, saya mencoba demo POKEMONKEY dan tertarik memakainya untuk tim saya.\n\n'
    + 'Nama: \nDepartemen / perusahaan: \nJumlah anggota tim: \n\nMohon informasi cara bergabung. Terima kasih.';
  return `https://wa.me/${WA_GABUNG}?text=${encodeURIComponent(pesan)}`;
}

type Baris = Record<string, any>;

const pica = (
  n: number, bidang: string, prioritas: string, judul: string, akar: string, tindakan: string,
  pic: string, sisaHari: number, status: string, target: number | null, realisasi: number | null, satuan: string | null,
  props: Baris,
): Baris => ({
  id: `${AWALAN_CONTOH}pica-${String(n).padStart(2, '0')}`,
  nomor: n,
  periode_id: 'PERIODE-AKTIF',
  bidang, prioritas,
  judul: `${LABEL_CONTOH} ${judul}`,
  akar, tindakan,
  pic_id: pic,
  due_date: geserHari(hariIniWita(), sisaHari),
  status, terkait_id: null, target, realisasi, satuan,
  terkunci: 0, props, ditutup_pada: status === 'Closed' ? hariIniWita() : null,
  dibuat_oleh: 'demo', dibuat_pada: new Date().toISOString(), diubah_oleh: null, diubah_pada: null, dihapus: 0,
  judul_singkat: judul.slice(0, 40),
});

/** Seluruh data contoh; dipanggil saat basis data demo dibuat pertama kali. */
export function dataContohDemo() {
  const hariIni = hariIniWita();
  const kini = new Date().toISOString();

  const tim: Baris[] = [
    { id: 'demo', nama: 'Pengguna Demo', jabatan: 'Koordinator Lapangan', bidang: 'Operasional', wa: null, peran: 'admin', aktif: 1 },
    { id: `${AWALAN_CONTOH}budi`, nama: 'Budi Santoso', jabatan: 'Staf Administrasi', bidang: 'Administrasi', wa: null, peran: 'anggota', aktif: 1 },
    { id: `${AWALAN_CONTOH}sari`, nama: 'Sari Wulandari', jabatan: 'Pengawas K3', bidang: 'K3 & Lingkungan', wa: null, peran: 'supervisor', aktif: 1 },
    { id: `${AWALAN_CONTOH}rian`, nama: 'Rian Pratama', jabatan: 'Kru Lapangan', bidang: 'Lapangan', wa: null, peran: 'anggota', aktif: 1 },
  ];

  const profil: Record<string, Baris> = {
    demo: { user_id: 'demo', xp: 1250, level: 2, skin_aktif: 'classic', skin_dimiliki: ['classic'], luas_tanam: 0, pos_x: 50, pos_y: 55, stamina: 85, terakhir_aktif: kini, status_teks: 'Coba-coba dulu' },
    [`${AWALAN_CONTOH}budi`]: { user_id: `${AWALAN_CONTOH}budi`, xp: 640, level: 1, skin_aktif: 'classic', skin_dimiliki: ['classic'], luas_tanam: 0, pos_x: 30, pos_y: 40, stamina: 70, terakhir_aktif: kini, status_teks: 'Menyusun laporan bulanan' },
    [`${AWALAN_CONTOH}sari`]: { user_id: `${AWALAN_CONTOH}sari`, xp: 2100, level: 3, skin_aktif: 'classic', skin_dimiliki: ['classic'], luas_tanam: 0, pos_x: 68, pos_y: 35, stamina: 55, terakhir_aktif: kini, status_teks: 'Inspeksi APD pagi ini' },
    [`${AWALAN_CONTOH}rian`]: { user_id: `${AWALAN_CONTOH}rian`, xp: 880, level: 1, skin_aktif: 'classic', skin_dimiliki: ['classic'], luas_tanam: 0, pos_x: 40, pos_y: 70, stamina: 60, terakhir_aktif: kini, status_teks: 'Di area kerja B' },
  };

  const daftarPica: Baris[] = [
    pica(1, 'K3 & Lingkungan', 'Tinggi', 'Sarung tangan kerja kurang 12 pasang',
      'Permintaan bulan lalu belum sampai ke gudang', 'Ajukan pembelian cepat dan pinjam stok dari gudang pusat',
      `${AWALAN_CONTOH}sari`, -2, 'Open', 12, 4, 'unit', { lokasi: 'Gudang APD', kategori: 'Keselamatan kerja' }),
    pica(2, 'Administrasi', 'Sedang', 'Laporan bulanan terlambat tiga hari',
      'Data dari dua seksi belum masuk saat rekap', 'Tetapkan tenggat internal H-3 dan pengingat otomatis',
      `${AWALAN_CONTOH}budi`, 3, 'In Progress', 1, 0, 'berkas', { lokasi: 'Kantor', kategori: 'Pelaporan' }),
    pica(3, 'Operasional', 'Tinggi', 'Genset cadangan mati saat uji beban',
      'Perawatan berkala terlewat dua siklus', 'Servis oleh teknisi dan buat jadwal perawatan bulanan',
      'demo', 1, 'Open', 1, 0, 'unit', { lokasi: 'Ruang genset', kategori: 'Pemeliharaan' }),
    pica(4, 'Logistik', 'Sedang', 'Stok bahan bakar tinggal 20 persen',
      'Pengiriman pemasok mundur sepekan', 'Kunci jadwal pengiriman dan siapkan pemasok kedua',
      `${AWALAN_CONTOH}rian`, 5, 'Continue', 100, 20, '%', { lokasi: 'Tangki utama', kategori: 'Persediaan' }),
    pica(5, 'Lapangan', 'Rendah', 'Rambu arah di simpang timur pudar',
      'Terkena panas dan hujan sejak tahun lalu', 'Ganti dengan rambu berbahan reflektif',
      `${AWALAN_CONTOH}rian`, 12, 'Open', 4, 0, 'unit', { lokasi: 'Simpang timur', kategori: 'Sarana' }),
    pica(6, 'Perencanaan', 'Sedang', 'Jadwal pelatihan belum disepakati seluruh seksi',
      'Dua seksi belum mengirim nama peserta', 'Kirim pengingat dan tutup pendaftaran pekan ini',
      'demo', -5, 'Closed', 20, 20, 'orang', { lokasi: 'Ruang rapat', kategori: 'Pengembangan SDM' }),
  ];

  const jadwal: Baris[] = [
    { id: `${AWALAN_CONTOH}jd-1`, judul: `${LABEL_CONTOH} Rapat koordinasi mingguan`, keterangan: 'Bahas tugas terbuka dan rencana pekan depan', tanggal: hariIni, tanggal_selesai: null, jam_mulai: '08:00', jam_selesai: '09:00', jenis: 'rapat', pica_id: null, pemilik_id: null, rrule: null, ingatkan_menit: 15, gcal_id: null, selesai: 0, dibuat_pada: kini },
    { id: `${AWALAN_CONTOH}jd-2`, judul: `${LABEL_CONTOH} Inspeksi area kerja`, keterangan: 'Periksa rambu, APD, dan kebersihan area', tanggal: geserHari(hariIni, 1), tanggal_selesai: null, jam_mulai: '13:00', jam_selesai: '15:00', jenis: 'lapangan', pica_id: null, pemilik_id: `${AWALAN_CONTOH}sari`, rrule: null, ingatkan_menit: 30, gcal_id: null, selesai: 0, dibuat_pada: kini },
    { id: `${AWALAN_CONTOH}jd-3`, judul: `${LABEL_CONTOH} Pelatihan keselamatan kerja`, keterangan: 'Wajib untuk seluruh kru lapangan', tanggal: geserHari(hariIni, 3), tanggal_selesai: geserHari(hariIni, 4), jam_mulai: '08:00', jam_selesai: '16:00', jenis: 'pelatihan', pica_id: null, pemilik_id: null, rrule: null, ingatkan_menit: 60, gcal_id: null, selesai: 0, dibuat_pada: kini },
    { id: `${AWALAN_CONTOH}jd-4`, judul: `${LABEL_CONTOH} Serah terima shift`, keterangan: null, tanggal: hariIni, tanggal_selesai: null, jam_mulai: '16:00', jam_selesai: '16:30', jenis: 'rutin', pica_id: null, pemilik_id: 'demo', rrule: 'FREQ=DAILY', ingatkan_menit: null, gcal_id: null, selesai: 0, dibuat_pada: kini },
  ];

  // Roster dua pekan: tim inti masuk Senin–Sabtu, Minggu libur, satu orang cuti.
  const roster: Baris[] = [];
  for (const t of tim) {
    for (let i = -7; i < 14; i++) {
      const tanggal = geserHari(hariIni, i);
      const hari = new Date(`${tanggal}T00:00:00Z`).getUTCDay();
      let kode = hari === 0 ? 'OFF' : 'D';
      if (t.id === `${AWALAN_CONTOH}budi` && i >= 2 && i <= 4) kode = 'FB';
      if (t.id === `${AWALAN_CONTOH}rian` && hari !== 0) kode = i % 4 < 2 ? 'D' : 'N';
      roster.push({ user_id: t.id, tanggal, kode, catatan: null });
    }
  }

  const memo: Baris[] = [
    { id: `${AWALAN_CONTOH}memo-1`, user_id: 'demo', penulis: 'Pengguna Demo', lingkup: 'tim', kategori: 'Operasional', tipe: 'Keputusan', status: 'Sedang berlangsung', tanggal: geserHari(hariIni, -2), judul: `${LABEL_CONTOH} Perawatan alat jadi bulanan`, ringkasan: 'Servis genset dan pompa dijadwalkan setiap awal bulan agar tidak ada lagi kerusakan mendadak.', isi: '# Keputusan\n- Servis rutin setiap tanggal 1–5\n- Ceklis perawatan diisi lewat aplikasi\n\n# Tindak lanjut\n- [x] Susun ceklis\n- [ ] Tunjuk penanggung jawab tiap alat', disematkan: 1, warna: 'amber', dibuat_pada: kini, diubah_pada: null },
    { id: `${AWALAN_CONTOH}memo-2`, user_id: `${AWALAN_CONTOH}sari`, penulis: 'Sari Wulandari', lingkup: 'tim', kategori: 'K3 & Lingkungan', tipe: 'Pengumuman', status: 'Draf', tanggal: geserHari(hariIni, -1), judul: `${LABEL_CONTOH} Inspeksi APD tiap Senin pagi`, ringkasan: 'Pemeriksaan kelengkapan APD dilakukan sebelum apel pagi, dimulai pekan depan.', isi: '- Helm, rompi, sepatu\n- Yang tidak lengkap tidak boleh masuk area\n- Catat temuan di aplikasi', disematkan: 0, warna: null, dibuat_pada: kini, diubah_pada: null },
    { id: `${AWALAN_CONTOH}memo-3`, user_id: `${AWALAN_CONTOH}budi`, penulis: 'Budi Santoso', lingkup: 'tim', kategori: 'Administrasi', tipe: 'Rekap Rapat', status: 'Selesai', tanggal: geserHari(hariIni, -5), judul: `${LABEL_CONTOH} Rekap rapat koordinasi`, ringkasan: 'Tiga tugas baru dibuka, satu ditutup. Tenggat laporan dimajukan tiga hari.', isi: '# Hasil\n- Tugas baru: 3\n- Tugas selesai: 1\n\n# Catatan\nTenggat laporan bulanan dimajukan ke tanggal 25.', disematkan: 0, warna: null, dibuat_pada: kini, diubah_pada: null },
  ];

  const pengumuman: Baris[] = [
    { id: `${AWALAN_CONTOH}peng-1`, judul: `${LABEL_CONTOH} Rapat koordinasi pindah ke pukul 08.00`, isi: 'Mulai pekan ini rapat mingguan dimajukan ke pukul 08.00 agar tim lapangan bisa langsung berangkat setelahnya.', penting: 1, kirim_wa: 0, oleh: 'demo', dibuat_pada: kini },
    { id: `${AWALAN_CONTOH}peng-2`, judul: `${LABEL_CONTOH} Pengisian laporan harian lewat aplikasi`, isi: 'Laporan harian tidak lagi lewat pesan grup. Isi langsung di menu laporan supaya rekapnya otomatis.', penting: 0, kirim_wa: 0, oleh: `${AWALAN_CONTOH}budi`, dibuat_pada: kini },
  ];

  const laporan: Baris[] = [
    { id: `${AWALAN_CONTOH}lap-1`, user_id: 'demo', user_nama: 'Pengguna Demo', pica_id: `${AWALAN_CONTOH}pica-03`, jenis: 'Pemeliharaan', capaian: 1, satuan: 'unit', catatan: 'Genset dibersihkan, menunggu teknisi', xp: 420, dibuat_pada: kini },
    { id: `${AWALAN_CONTOH}lap-2`, user_id: `${AWALAN_CONTOH}rian`, user_nama: 'Rian Pratama', pica_id: null, jenis: 'Inspeksi area', capaian: 3, satuan: 'titik', catatan: 'Rambu simpang timur perlu diganti', xp: 360, dibuat_pada: kini },
  ];

  const misi: Baris[] = [
    { id: `${AWALAN_CONTOH}misi-1`, judul: 'Tutup 10 tugas perbaikan', tipe: 'LAND_PREP', deskripsi: 'Selesaikan sepuluh tugas terbuka tepat waktu.', target: 10, satuan: 'tugas', xp: 800, kapasitas: 1, urutan: 1, aktif: 1, status: 'IN_PROGRESS', current: 3 },
    { id: `${AWALAN_CONTOH}misi-2`, judul: 'Isi laporan harian 20 kali', tipe: 'NURSERY', deskripsi: 'Biasakan tim mengisi laporan lewat aplikasi.', target: 20, satuan: 'laporan', xp: 500, kapasitas: 1, urutan: 2, aktif: 1, status: 'IN_PROGRESS', current: 2 },
  ];

  const surat: Baris[] = [
    { id: `${AWALAN_CONTOH}surat-1`, kategori: 'im', nomorUrut: 1, nomorSurat: '001/DEMO/IX/2026', namaSurat: `${LABEL_CONTOH} Permohonan perjalanan dinas`, namaYangDitugaskan: 'Budi Santoso', tanggalMulai: geserHari(hariIni, 2), tanggalBerakhir: geserHari(hariIni, 3), lamaHari: 2, tujuanDinas: 'Kantor pusat', keperluan: 'Rapat koordinasi anggaran', namaPembuat: 'Pengguna Demo', dibuatPada: kini },
    { id: `${AWALAN_CONTOH}surat-2`, kategori: 'sk', nomorUrut: 1, nomorSurat: '002/DEMO/IX/2026', namaSurat: `${LABEL_CONTOH} Surat keluar permintaan suku cadang`, tujuanSurat: 'Pemasok alat berat', tanggal: hariIni, namaPembuat: 'Pengguna Demo', dibuatPada: kini },
  ];

  return { tim, profil, pica: daftarPica, jadwal, roster, memo, pengumuman, laporan, misi, surat };
}

/** Apakah satu baris berasal dari data contoh? */
export const barisContoh = (x: { id?: string; user_id?: string; pica_id?: string }): boolean =>
  Boolean(
    (typeof x.id === 'string' && x.id.startsWith(AWALAN_CONTOH))
    || (typeof x.user_id === 'string' && x.user_id.startsWith(AWALAN_CONTOH))
    || (typeof x.pica_id === 'string' && x.pica_id.startsWith(AWALAN_CONTOH)),
  );
