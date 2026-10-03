import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const akar = path.resolve(__dirname, '..');

const memoId = 'memo_panduan_operasional_ebl';
const userId = 'agung';
const judul = 'SOP-EBL-RNR-2026-001: Standar Operasional Prosedur Penggunaan Sistem POKEMONKEY';
const ringkasan = 'Buku panduan resmi operasional POKEMONKEY: modul kerja, PICA, Smart Nursery, Geotagging, NASA FIRMS, dan tata persuratan dinas PT Energi Batubara Lestari.';
const kategori = 'Administrasi';
const tipe = 'Pembaruan Kebijakan';
const status = 'Selesai';
const lingkup = 'tim';
const akses = 'baca';
const tanggal = '2026-10-01';

const isi = `!! POKEMONKEY merupakan portal sistem operasional dan pemantauan terpadu Departemen Revegetasi & Rehabilitasi PT Energi Batubara Lestari. Seluruh personil lapangan dan administrasi wajib mengacu pada standar operasional prosedur ini dalam pelaksanaan dan pelaporan kegiatan harian.
---
# 1. Landasan Kebijakan & Prinsip Satu Sumber Kebenaran
Departemen Revegetasi & Rehabilitasi beroperasi di dua bentang wilayah operasional: Area Penambangan dan IPPKH di Tapin, serta Petak Rehabilitasi DAS di Kawasan Tahura Sultan Adam. Penanganan operasional mencakup pembibitan persemaian, penanaman reklamasi, sensus pertumbuhan tegakan, pencegahan dan penanggulangan karhutla, tata persuratan dinas, serta pengelolaan anggaran belanja site.
> Seluruh pelaporan operasional, administrasi persuratan, data mutasi bibit, dan pemantauan titik panas satelit berpijak pada basis data terpadu (Single Source of Truth) untuk menjamin akurasi dan mencegah perselisihan data antar-lokasi dan antar-perangkat.
![Alur Kerja Terpadu POKEMONKEY](memo/memo_panduan_operasional_ebl/alur_operasional.jpg)
---
# 2. Diagram Alur Proses Operasional Lapangan
Pelaksanaan siklus operasional harian terbagi ke dalam 4 tahapan berkesinambungan:
![Diagram 4 Tahapan Proses Operasional](memo/memo_panduan_operasional_ebl/diagram_proses.jpg)
1. **Inspeksi Lapangan**: Pemeriksaan fisik tanaman, sarana persemaian, dan identifikasi potensi bahaya K3LH.
2. **Tindakan PICA**: Pencatatan temuan kendala operasional, analisis 5-Why, penunjukan penanggung jawab (PIC), dan penetapan tenggat penyelesaian.
3. **Pengelolaan Persemaian (Nursery)**: Pencatatan mutasi bibit masuk, keluar, dan afkir serta alokasi bibit ke blok penanaman.
4. **Pemantauan Satelit & Evaluasi**: Pengawasan anomali termal satelit NASA FIRMS dan pelaporan kinerja berkala.
---
# 3. Matriks Modul Sistem & Otorisasi Pengguna
Pembagian wewenang dan cakupan teknis modul sistem POKEMONKEY diatur sebagai berikut:
!tabel{"kepala":true,"baris":[["Modul","Menu","Fungsi Utama","Hak Akses Admin / SPV","Hak Akses Anggota"],["KEBUN","Utama","Parameter habitat, cuaca harian, dan ringkasan semai/tegakan","Penuh (Kelola & Pantau)","Baca & Laporan Harian"],["PICA","Utama","Register ketidaksesuaian, analisis 5-Why, dan perbaikan","Penuh (Ubah Due Date & Verifikasi Tutup)","Input Temuan & Update Progres"],["JADWAL","Utama","Agenda kerja tim, kalender rapat, dan tenggat tugas memo","Penuh (Kelola Roster & Agenda Induk)","Lihat Jadwal & Centang Tugas Sendiri"],["INFO","Utama","Instruksi dinas, pengumuman departemen, dan edaran K3LH","Penuh (Buat Pengumuman)","Baca & Tandai Selesai"],["ROSTER","Menu","Pengaturan jadwal shift kerja dan hak cuti siklus 8/2","Penuh (Kelola Jadwal & Ekspor Excel)","Lihat Jadwal Roster Sendiri"],["MEMO","Menu","Dokumen kerja Notion, Nomor Surat, Form IM Dinas, dan MoM","Penuh (Kelola Tim & Arsip Surat)","Baca/Sunting Sesuai Hak Memo"],["MONEY","Menu","Rencana Anggaran Biaya (RAB RNR) dan katalog pengadaan barang","Penuh (Penyusunan & Persetujuan)","Akses Dibatasi"],["FIRE","Menu","Pemantauan titik panas satelit NASA FIRMS & laporan karhutla","Penuh (Verifikasi & Laporan PDF)","Pantau Anomali & Ground Check"]]}
---
# 4. Integrasi Pemantauan Data Lapangan (Real-Time)
Berikut adalah blok data dinamis yang terhubung langsung ke basis data operasional persemaian dan sensus tegakan:
## Indikator Kinerja Persemaian (Smart Nursery)
!data{"sumber":"nursery","saring":{},"tampil":"kpi"}
## Indikator Sensus Tegakan & Estimasi Karbon (Geotagging)
!data{"sumber":"geotag","saring":{},"tampil":"kpi"}
!! Estimasi biomassa atas tanah (AGB) dan serapan CO2e dihitung menggunakan formula allometrik Chave et al. (2014) dengan 4 batasan ilmiah wajib: diameter diduga dari tinggi tanaman, berat jenis kayu dipukul rata (rho = 0,60), perhitungan biomassa atas tanah saja, dan luas cakupan survei dihitung dari convex hull koordinat valid.
---
# 5. Pemantauan Titik Panas Karhutla Satelit (FIRE MONKEY)
Server POKEMONKEY memeriksa data sensor satelit NASA FIRMS (VIIRS dan MODIS) setiap jam secara otomatis.
![Peta Radar Zona Pantau Karhutla](memo/memo_panduan_operasional_ebl/peta_zona_pantau.jpg)
Klasifikasi radius zona pengawasan titik panas:
- **Area Izin (IUP / IPPKH / Petak DAS)**: Ground check fisik wajib dilakukan oleh tim lapangan dan berita acara laporan formal diterbitkan.
- **Zona Waspada (Radius <= 2 km dari batas)**: Pengawasan intensif dilakukan; peringatan darurat otomatis dikirim ke grup WhatsApp.
- **Zona Pantau (Radius <= 5 km dari batas)**: Anomali termal dicatat dalam sistem tanpa eskalasi peringatan darurat.
> Anomali termal satelit dapat bergeser beberapa ratus meter akibat sudut sensor. Ground check fisik di lapangan mutlak dilakukan sebelum laporan formal disahkan.
---
# 6. Prosedur Rutinitas Kerja Harian Terhubung Kalender
Ceklis berikut merepresentasikan alur operasional baku harian. Setiap butir penugasan yang diberi tanda tenggat tanggal dan jam secara otomatis disinkronkan ke kalender kerja tim:
- [ ] Pukul 07.00 WITA: Morning Talk K3LH dan verifikasi register PICA status Open @2026-10-02 07:00 @agung
- [ ] Pukul 09.00 WITA: Verifikasi fisik surat jalan bibit dan input mutasi persemaian di Nursery @2026-10-02 09:00 @agung
- [ ] Pukul 12.00 WITA: Pemeriksaan edaran resmi dan pengumuman dinas pada modul INFO @2026-10-02 12:00 @agung
- [ ] Pukul 14.00 WITA: Sensus geotagging tegakan pohon dan pengukuran tinggi tanaman @2026-10-02 14:00 @agung
- [ ] Pukul 16.00 WITA: Evaluasi progres PICA harian sebelum pengiriman rekapitulasi WhatsApp @2026-10-02 16:00 @agung
- [ ] Pukul 17.00 WITA: Pengiriman laporan kegiatan harian FEED (tersimpan luring bila tanpa sinyal) @2026-10-02 17:00 @agung
---
# 7. Petunjuk Teknis Lanjutan Sistem
>> Prosedur Pemanfaatan Asisten AI (Google Gemini)
  1. Buka register PICA atau modul Memo.
  2. Masukkan deskripsi masalah singkat pada form isian.
  3. Klik tombol Asisten AI untuk mengembangkan kalimat menjadi rumusan masalah faktual, analisis akar penyebab teknis 5-Why, dan tindakan korektif-preventif terukur.
  4. Pada menu ringkasan PICA, gunakan tombol Resume AI untuk membuat ringkasan eksekutif siap kirim ke WhatsApp manajemen.
>> Prosedur Siklus Roster Kerja 8 Minggu Kerja / 2 Minggu Libur (8/2)
  1. Roster kerja disusun dalam blok 10 minggu: 8 minggu kerja (K) diikuti 2 minggu istirahat periodik (L).
  2. Gunakan tombol Isi Cepat untuk mengisi pola rotasi otomatis seluruh personil.
  3. Ekspor format Excel resmi mengikuti standar kode RNR (D, N, OFF, FB, IK beserta rekap total jam kerja).
>> Prosedur Tata Persuratan & Dokumentasi Resmi
  1. Penomoran Surat: Pengambilan nomor otomatis berurutan untuk surat internal, eksternal, dan berita acara.
  2. Form Internal Memo: Penyusunan memo perjalanan dinas terstandarisasi dengan ekspor ke format Excel perusahaan.
  3. Minutes of Meeting (MoM): Pencatatan notulen rapat resmi dengan pemenggalan teks rapi dan ekspor Word/Excel.
  4. Keranjang Sampah: Memo atau sub-halaman yang dihapus ditampung selama masa retensi 30 hari sebelum dimusnahkan permanen.
---
# 8. Kontak Bantuan Sistem
Apabila personil mengalami kendala teknis perangkat, kehilangan akses kata sandi, atau memerlukan pendaftaran akun baru, hubungi Administrator Sistem melalui kontak resmi operasional.`;

const props = JSON.stringify({ sampul: 'resmi:ebl' });

function petik(str) {
  return `'${String(str).replace(/'/g, "''")}'`;
}

const lampiran = [
  {
    id: 'lmp_panduan_alur',
    kunci: 'memo/memo_panduan_operasional_ebl/alur_operasional.jpg',
    nama: 'Alur Kerja Terpadu POKEMONKEY',
    mime: 'image/jpeg',
    ukuran: 1212318,
  },
  {
    id: 'lmp_panduan_proses',
    kunci: 'memo/memo_panduan_operasional_ebl/diagram_proses.jpg',
    nama: 'Diagram 4 Tahapan Proses Operasional',
    mime: 'image/jpeg',
    ukuran: 858681,
  },
  {
    id: 'lmp_panduan_peta',
    kunci: 'memo/memo_panduan_operasional_ebl/peta_zona_pantau.jpg',
    nama: 'Peta Radar Zona Pantau Karhutla',
    mime: 'image/jpeg',
    ukuran: 893954,
  },
];

const jadwal = [
  { id: 'jdw_sop_01', judul: 'Morning Talk K3LH dan verifikasi PICA Open', jam: '07:00' },
  { id: 'jdw_sop_02', judul: 'Verifikasi fisik surat jalan bibit & mutasi di Nursery', jam: '09:00' },
  { id: 'jdw_sop_03', judul: 'Pemeriksaan edaran resmi & pengumuman di INFO', jam: '12:00' },
  { id: 'jdw_sop_04', judul: 'Sensus geotagging tegakan pohon & ukur tinggi', jam: '14:00' },
  { id: 'jdw_sop_05', judul: 'Evaluasi progres PICA harian sebelum rekap WA', jam: '16:00' },
  { id: 'jdw_sop_06', judul: 'Pengiriman laporan kegiatan harian FEED', jam: '17:00' },
];

const sql = `
-- 1. Hapus entri lama jika ada
DELETE FROM memo WHERE id = ${petik(memoId)};
DELETE FROM lampiran WHERE entitas_id = ${petik(memoId)};
DELETE FROM jadwal WHERE memo_id = ${petik(memoId)};

-- 2. Masukkan Memo Panduan
INSERT INTO memo (
  id, user_id, judul, isi, disematkan, warna, dibuat_pada, diubah_pada,
  lingkup, kategori, tipe, status, ringkasan, tanggal, pica_id, props, akses
) VALUES (
  ${petik(memoId)},
  ${petik(userId)},
  ${petik(judul)},
  ${petik(isi)},
  1,
  'emerald',
  datetime('now'),
  datetime('now'),
  ${petik(lingkup)},
  ${petik(kategori)},
  ${petik(tipe)},
  ${petik(status)},
  ${petik(ringkasan)},
  ${petik(tanggal)},
  NULL,
  ${petik(props)},
  ${petik(akses)}
);

-- 3. Masukkan Data Lampiran Gambar
${lampiran.map((l) => `
INSERT INTO lampiran (id, entitas, entitas_id, kunci_r2, nama, tipe_mime, ukuran, oleh, pada)
VALUES (${petik(l.id)}, 'memo', ${petik(memoId)}, ${petik(l.kunci)}, ${petik(l.nama)}, ${petik(l.mime)}, ${l.ukuran}, ${petik(userId)}, datetime('now'));
`).join('')}

-- 4. Masukkan Jadwal Ceklis
${jadwal.map((j) => `
INSERT INTO jadwal (id, judul, keterangan, tanggal, jam_mulai, jenis, pemilik_id, selesai, dibuat_pada, memo_id)
VALUES (${petik(j.id)}, ${petik(j.judul)}, 'Dari memo: SOP Penggunaan POKEMONKEY', '2026-10-02', ${petik(j.jam)}, 'rencana', ${petik(userId)}, 0, datetime('now'), ${petik(memoId)});
`).join('')}
`;

const berkasSql = path.join(akar, 'server', 'temp-panduan.sql');
writeFileSync(berkasSql, sql, 'utf8');

console.log('Menjalankan SQL ke D1...');
try {
  // Remote
  console.log('Eksekusi ke Cloudflare D1 Remote...');
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--remote', '--file', 'temp-panduan.sql'], {
    cwd: path.join(akar, 'server'),
    stdio: 'inherit',
    shell: true,
  });

  // Local
  console.log('Eksekusi ke Cloudflare D1 Local...');
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', '--local', '--file', 'temp-panduan.sql'], {
    cwd: path.join(akar, 'server'),
    stdio: 'inherit',
    shell: true,
  });
  console.log('Sukses memasukkan memo panduan ke server dan lokal!');
} finally {
  try { unlinkSync(berkasSql); } catch {}
}
