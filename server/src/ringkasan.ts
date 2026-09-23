/**
 * Penyusun isi notifikasi & rekap — fungsi murni.
 *
 * Tidak menyentuh database, jaringan, maupun binding Worker, sehingga berkas
 * yang sama dipakai dua tempat: Worker (server/src/sumber.ts) dan mode demo di
 * browser (lib/demo.ts). Dengan begitu kalimat yang dilihat saat pratinjau
 * adalah kalimat yang benar-benar terkirim.
 *
 * Datanya diterima dalam bentuk sederhana di bawah. Saat skema database
 * berubah, yang disesuaikan hanya pengambilnya (sumber.ts), bukan berkas ini.
 */

export type Slot = 'pagi' | 'siang' | 'sore';

export interface PicaRingkas {
  id: string;
  judul: string;
  status: string;
  due_date: string | null;
  bidang?: string | null;
  pic_nama?: string | null;
}

export interface NotifSiap {
  slot: Slot;
  judul: string;
  isi: string;
  jumlah: number;
  /** false = tidak ada yang perlu diberitahukan; jangan tampilkan notifikasi. */
  tampil: boolean;
  /** Layar yang dibuka saat notifikasi diketuk. */
  tab: 'pica' | 'pengumuman' | 'habitat';
}

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MS_HARI = 86_400_000;

const angka = (n: number) => Math.round(Number(n) || 0).toLocaleString('id-ID');
const potong = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
const nomor = (id: string) => id.slice(-2);
const namaDepan = (nama?: string | null) => (nama ? nama.split(' ')[0] : '—');

const selisihHari = (a: string, b: string) =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / MS_HARI);

export const tanggalPanjang = (t: string) => {
  const d = new Date(`${t}T00:00:00Z`);
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

const sisaTeks = (due: string | null, hariIni: string) => {
  if (!due) return 'tanpa tenggat';
  const s = selisihHari(due, hariIni);
  if (s < 0) return `telat ${-s} hari`;
  if (s === 0) return 'tenggat hari ini';
  return `${s} hari lagi`;
};

// ============================================================
// Notifikasi di HP
// ============================================================

/** 07.00 — PICA milik pemakai yang masih berstatus Open. */
export function susunNotifPagi(p: {
  milik: PicaRingkas[];
  hariIni: string;
  /** Hanya untuk Admin/Supervisor. */
  tim?: { open: number; telat: number };
}): NotifSiap {
  const baris = p.milik.slice(0, 3).map((x) => `${nomor(x.id)} ${potong(x.judul, 46)} · ${sisaTeks(x.due_date, p.hariIni)}`);
  if (p.milik.length > 3) baris.push(`+${p.milik.length - 3} PICA lainnya`);
  if (p.tim) baris.push(`Tim: ${p.tim.open} Open · ${p.tim.telat} lewat tenggat`);

  const judul = p.milik.length > 0
    ? `${p.milik.length} PICA kamu masih Open`
    : p.tim && p.tim.open > 0
      ? `Tim: ${p.tim.open} PICA masih Open`
      : 'Tidak ada PICA Open';

  return {
    slot: 'pagi',
    judul,
    isi: baris.join('\n') || 'Semua PICA sudah berjalan.',
    jumlah: p.milik.length,
    tampil: p.milik.length > 0 || Boolean(p.tim && p.tim.open > 0),
    tab: 'pica',
  };
}

/** 12.00 — pengumuman yang belum dibaca pemakai. */
export function susunNotifSiang(p: { belum: { judul: string; penting?: number | boolean }[] }): NotifSiap {
  const penting = p.belum.filter((x) => x.penting);
  const urut = [...penting, ...p.belum.filter((x) => !x.penting)];
  const baris = urut.slice(0, 3).map((x) => `${x.penting ? 'PENTING · ' : ''}${potong(x.judul, 60)}`);
  if (urut.length > 3) baris.push(`+${urut.length - 3} lainnya`);

  return {
    slot: 'siang',
    judul: p.belum.length > 0
      ? `Info: ${p.belum.length} pengumuman belum dibaca${penting.length ? ` (${penting.length} penting)` : ''}`
      : 'Semua pengumuman sudah dibaca',
    isi: baris.join('\n'),
    jumlah: p.belum.length,
    tampil: p.belum.length > 0,
    tab: 'pengumuman',
  };
}

/** 17.00 — XP hari ini, atau pengingat melapor bila belum. */
export function susunNotifSore(p: {
  xpHariIni: number;
  laporanHariIni: number;
  xp: number;
  level: number;
  stamina: number;
}): NotifSiap {
  const kurang = Math.max(0, p.level * 1000 - p.xp);
  const stamina = Math.round(Math.max(0, Math.min(100, p.stamina)));

  if (p.laporanHariIni > 0) {
    return {
      slot: 'sore',
      judul: `+${angka(p.xpHariIni)} XP dari ${p.laporanHariIni} laporan hari ini`,
      isi: `Level ${p.level} · ${angka(kurang)} XP lagi ke Level ${p.level + 1} · total ${angka(p.xp)} XP`,
      jumlah: p.xpHariIni,
      tampil: true,
      tab: 'habitat',
    };
  }

  return {
    slot: 'sore',
    judul: 'Belum ada laporan hari ini',
    isi: `Kirim laporan di FEED sebelum pulang · stamina monyet ${stamina}% · Level ${p.level}, ${angka(kurang)} XP lagi naik level`,
    jumlah: 0,
    tampil: true,
    tab: 'habitat',
  };
}

// ============================================================
// Rekap PICA untuk grup WhatsApp
// ============================================================
//
// Dikelompokkan per PIC. Lima baris pertama sudah menjawab "siapa punya berapa
// tugas yang belum selesai", supaya terbaca sebelum WhatsApp memotong pesan
// dengan "Baca selengkapnya". Tiap tugas ditulis sebagai kalimat utuh:
//   Pekerjaan penanaman: sengon potting, baru 55% (34.312 dari 62.195 batang).
//   Telat 9 hari dari tanggal 12 Sep. Rekomendasi: segera pisahkan kekurangan ...

export interface PicaRekap {
  id: string;
  judul: string;
  /** Judul pendek khusus pesan WA; kosong = dipotong otomatis dari judul. */
  judul_singkat?: string | null;
  bidang?: string | null;
  status: string;
  due_date: string | null;
  pic_id?: string | null;
  pic_nama?: string | null;
  target?: number | null;
  realisasi?: number | null;
  satuan?: string | null;
  tindakan?: string | null;
}

export interface DataRekapPica {
  jenis: 'harian' | 'mingguan';
  hariIni: string;
  /** Semua PICA yang belum Closed. */
  terbuka: PicaRekap[];
  selesaiHariIni: number;
  /** Perkembangan yang dicatat hari ini (catatan update & perubahan status). */
  bergerak: { pica_id: string; oleh: string | null }[];
  /** Khusus rekap Jumat: jumlah PICA baru & ditutup sejak Senin. */
  mingguan?: { dari: string; baru: number; ditutup: number };
  /** Tautan papan PICA hanya-baca; null = tidak dicantumkan. */
  tautan?: string | null;
}

const HARI_PANJANG = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const tanggalHari = (t: string) => {
  const d = new Date(`${t}T00:00:00Z`);
  return `${HARI_PANJANG[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const tanggalPendek = (t: string) => {
  const d = new Date(`${t}T00:00:00Z`);
  return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`;
};

/** Angka gaya Indonesia, pecahan paling banyak dua digit (10,95 Ha). */
const angkaDesimal = (n: number) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });

const hurufKecilAwal = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
const tanpaTitikAkhir = (t: string) => t.trim().replace(/[.;,\s]+$/, '');

/** Label pekerjaan dari bidang PICA. */
function labelPekerjaan(bidang?: string | null): string {
  const b = (bidang ?? '').trim();
  const peta: Record<string, string> = { revegetasi: 'penanaman', nursery: 'pembibitan' };
  return `Pekerjaan ${peta[b.toLowerCase()] ?? (b ? b.toLowerCase() : 'lain-lain')}`;
}

/** Judul singkat bila ada; kalau tidak, potong judul panjang di jeda kalimat pertama. */
function subjek(p: PicaRekap): string {
  const singkat = p.judul_singkat?.trim();
  if (singkat) return tanpaTitikAkhir(singkat);
  const potongan = p.judul.split(/ - | – |, |\. |: | \(/)[0];
  return hurufKecilAwal(tanpaTitikAkhir(potong(potongan, 70)));
}

/** ", baru 55% (34.312 dari 62.195 batang)" — hanya bila target dan capaian sudah terisi. */
function capaian(p: PicaRekap): string {
  const t = Number(p.target);
  const r = Number(p.realisasi);
  if (!(t > 0) || p.realisasi === null || p.realisasi === undefined || !(r > 0)) return '';
  const persen = r >= t ? Math.round((r / t) * 100) : Math.min(99, Math.round((r / t) * 100));
  const satuan = p.satuan ? ` ${p.satuan}` : '';
  return `, ${r >= t ? 'sudah' : 'baru'} ${persen}% (${angkaDesimal(r)} dari ${angkaDesimal(t)}${satuan})`;
}

/** Kalimat pertama tindakan korektif, sebagai rekomendasi. */
function rekomendasi(p: PicaRekap, telat: boolean): string {
  const t = p.tindakan?.trim();
  if (!t) return telat ? ' Rekomendasi: segera tentukan tindakan perbaikannya.' : '';
  const pertama = potong(tanpaTitikAkhir(t.split(/\.\s+(?=[A-Z])/)[0]), 170);
  return ` Rekomendasi: ${telat ? 'segera ' : ''}${hurufKecilAwal(pertama)}.`;
}

/** Satu tugas sebagai kalimat utuh. */
function kalimatTugas(p: PicaRekap, hariIni: string): string {
  const sisa = p.due_date ? selisihHari(p.due_date, hariIni) : null;
  const telat = sisa !== null && sisa < 0;
  const waktu = sisa === null ? 'Belum ada tanggal target.'
    : telat ? `Telat ${-sisa} hari dari tanggal ${tanggalPendek(p.due_date as string)}.`
      : sisa === 0 ? 'Batasnya hari ini.'
        : `Batas ${tanggalPendek(p.due_date as string)}, masih ${sisa} hari lagi.`;
  const sedang = p.status === 'Continue' ? ' (sedang ditangani)' : '';
  return `${labelPekerjaan(p.bidang)}: ${subjek(p)}${capaian(p)}${sedang}. ${waktu}${rekomendasi(p, telat)}`;
}

/**
 * Label kelompok PIC. Pengelompokan memakai ID, bukan nama: dua orang bernama
 * depan sama (mis. Agung Laksono & Agung Basuki) tetap terpisah dan keduanya
 * ditampilkan dengan nama lengkap. Kunci '' = tugas tanpa PIC.
 */
export function labelPerPic(daftar: { pic_id?: string | null; pic_nama?: string | null }[]): Map<string, string> {
  const namaPer = new Map<string, string>();
  for (const p of daftar) namaPer.set(p.pic_id ?? '', p.pic_nama || p.pic_id || '');
  const depan = new Map<string, number>();
  for (const [kunci, nama] of namaPer) if (kunci) depan.set(namaDepan(nama), (depan.get(namaDepan(nama)) ?? 0) + 1);
  const label = new Map<string, string>();
  for (const [kunci, nama] of namaPer) {
    label.set(kunci, !kunci ? 'Tanpa PIC' : (depan.get(namaDepan(nama)) ?? 0) > 1 ? nama : namaDepan(nama));
  }
  return label;
}

const ringkasJumlah = (n: number, telat: number) => `${n} tugas, ${telat ? `${telat} telat` : 'belum telat'}`;

export function susunRekapPica(d: DataRekapPica): string {
  const hariIni = d.hariIni;
  const telatKah = (p: PicaRekap) => Boolean(p.due_date && p.due_date < hariIni);
  const jumlahTelat = d.terbuka.filter(telatKah).length;

  const bagian: string[] = [];
  if (d.jenis === 'mingguan' && d.mingguan) {
    const a = new Date(`${d.mingguan.dari}T00:00:00Z`);
    const b = new Date(`${hariIni}T00:00:00Z`);
    const rentang = a.getUTCMonth() === b.getUTCMonth()
      ? `${a.getUTCDate()}–${b.getUTCDate()} ${BULAN[b.getUTCMonth()]} ${b.getUTCFullYear()}`
      : `${a.getUTCDate()} ${BULAN[a.getUTCMonth()]} – ${b.getUTCDate()} ${BULAN[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
    bagian.push('*PICA BELUM SELESAI · REKAP MINGGUAN*', `${rentang} · Jumat 16.00 WITA`, '');
  } else {
    bagian.push('*PICA BELUM SELESAI*', `${tanggalHari(hariIni)} · 16.00 WITA`, '');
  }

  if (d.terbuka.length === 0) {
    bagian.push('Semua PICA sudah selesai. Terima kasih, tim!');
  } else {
    // Kelompok per ID PIC: yang paling banyak telat di atas.
    const label = labelPerPic(d.terbuka);
    const kelompok = new Map<string, PicaRekap[]>();
    for (const p of d.terbuka) {
      const kunci = p.pic_id ?? '';
      kelompok.set(kunci, [...(kelompok.get(kunci) ?? []), p]);
    }
    const urutan = [...kelompok]
      .map(([kunci, daftar]) => ({ nama: label.get(kunci) ?? 'Tanpa PIC', daftar, telat: daftar.filter(telatKah).length }))
      .sort((a, b) => b.telat - a.telat || b.daftar.length - a.daftar.length || a.nama.localeCompare(b.nama));

    const tambahan = d.selesaiHariIni ? `, ${d.selesaiHariIni} selesai hari ini` : '';
    bagian.push(`Total ${d.terbuka.length} tugas belum selesai, ${jumlahTelat ? `${jumlahTelat} sudah lewat tanggal` : 'belum ada yang telat'}${tambahan}.`);
    for (const k of urutan) bagian.push(`• ${k.nama}: ${ringkasJumlah(k.daftar.length, k.telat)}`);

    // Di dalam PIC: yang telat paling lama dulu, lalu tenggat terdekat, lalu tanpa tenggat.
    const kunciUrut = (p: PicaRekap) => (p.due_date ? Date.parse(`${p.due_date}T00:00:00Z`) : Number.MAX_SAFE_INTEGER);
    for (const k of urutan) {
      bagian.push('', `*${k.nama.toUpperCase()} · ${ringkasJumlah(k.daftar.length, k.telat)}*`);
      [...k.daftar]
        .sort((a, b) => kunciUrut(a) - kunciUrut(b) || a.id.localeCompare(b.id))
        .forEach((p, i) => bagian.push(`${i + 1}. ${kalimatTugas(p, hariIni)}`));
    }
  }

  bagian.push('');
  if (d.jenis === 'mingguan' && d.mingguan) {
    bagian.push(`Minggu ini: ${d.mingguan.baru} PICA baru, ${d.mingguan.ditutup} ditutup.`);
  } else if (d.bergerak.length === 0) {
    bagian.push('Hari ini belum ada perkembangan yang dicatat.');
  } else {
    const perOrang = new Map<string, number>();
    for (const b of d.bergerak) {
      const nama = namaDepan(b.oleh);
      perOrang.set(nama, (perOrang.get(nama) ?? 0) + 1);
    }
    const rincian = [...perOrang].map(([n, x]) => `${n} ${x}`).join(', ');
    bagian.push(`Perkembangan hari ini: ${d.bergerak.length} catatan (${rincian}).`);
  }

  if (d.tautan) bagian.push('', 'Lihat semua PICA (tanpa login, hanya baca):', d.tautan);
  return bagian.join('\n');
}

// ============================================================
// Pengingat acara kalender
// ============================================================

export interface BarisJadwal {
  id: string;
  judul: string;
  keterangan?: string | null;
  tanggal: string;
  tanggal_selesai?: string | null;
  jam_mulai?: string | null;
  jam_selesai?: string | null;
  jenis?: string | null;
  rrule?: string | null;
  ingatkan_menit?: number | null;
}

export interface AcaraSiap {
  id: string;
  /** Id acara + tanggal kejadiannya; kunci anti-kirim-ganda. */
  kunci: string;
  judul: string;
  isi: string;
  tab: 'jadwal';
  /** Kapan pengingatnya berbunyi (ISO UTC). */
  ingatkanPada: string;
  /** Kapan acaranya mulai (ISO UTC). */
  mulaiPada: string;
  tanggal: string;
}

/** Acara tanpa jam dianggap dimulai pukul 07.00 WITA. */
const JAM_ACARA_SEHARIAN = '07:00';

const msWita = (tanggal: string, jam: string) => Date.parse(`${tanggal}T${jam}:00Z`) - 480 * 60_000;
const tanggalDariMs = (ms: number) => new Date(ms + 480 * 60_000).toISOString().slice(0, 10);
const geserTanggal = (tanggal: string, hari: number) =>
  new Date(Date.parse(`${tanggal}T00:00:00Z`) + hari * MS_HARI).toISOString().slice(0, 10);
const hariMinggu = (tanggal: string) => new Date(`${tanggal}T00:00:00Z`).getUTCDay();
const jamTitik = (jam?: string | null) => (jam ? jam.replace(':', '.') : null);

/** Acara berhari-hari hanya diingatkan pada hari pertamanya. */
function jatuhPada(j: BarisJadwal, tanggal: string): boolean {
  const ulang = (j.rrule ?? '').toUpperCase();
  if (ulang.includes('DAILY')) return j.tanggal <= tanggal;
  if (ulang.includes('WEEKLY')) return j.tanggal <= tanggal && hariMinggu(j.tanggal) === hariMinggu(tanggal);
  return j.tanggal === tanggal;
}

function isiPengingat(j: BarisJadwal, menit: number): string {
  const rentang = j.jam_mulai
    ? `${jamTitik(j.jam_mulai)}${j.jam_selesai ? `–${jamTitik(j.jam_selesai)}` : ''} WITA`
    : 'Sepanjang hari';
  const sisa = menit >= 60 ? `${Math.round(menit / 60)} jam lagi` : `${menit} menit lagi`;
  const kepala = menit >= 1440 ? `Besok · ${rentang}` : `${rentang} · ${sisa}`;
  return [kepala, (j.keterangan ?? '').trim()].filter(Boolean).join('\n');
}

/**
 * Pengingat yang jatuh pada satu tanggal WITA.
 *
 * Acara besok ikut diperiksa, karena pengingat "satu hari sebelum" berbunyi
 * hari ini. Dipakai dua sisi: Worker (Web Push) dan penjadwal di HP.
 */
export function susunPengingatAcara(daftar: BarisJadwal[], tanggal: string): AcaraSiap[] {
  const hasil: AcaraSiap[] = [];

  for (const hari of [tanggal, geserTanggal(tanggal, 1)]) {
    for (const j of daftar) {
      const menit = Number(j.ingatkan_menit ?? 0);
      if (!menit || !jatuhPada(j, hari)) continue;

      const mulai = msWita(hari, j.jam_mulai || JAM_ACARA_SEHARIAN);
      const ingatkan = mulai - menit * 60_000;
      if (tanggalDariMs(ingatkan) !== tanggal) continue;

      hasil.push({
        id: j.id,
        kunci: `${j.id}:${hari}`,
        judul: j.judul,
        isi: isiPengingat(j, menit),
        tab: 'jadwal',
        ingatkanPada: new Date(ingatkan).toISOString(),
        mulaiPada: new Date(mulai).toISOString(),
        tanggal: hari,
      });
    }
  }

  return hasil.sort((a, b) => a.ingatkanPada.localeCompare(b.ingatkanPada));
}

// ============================================================
// Pesan WhatsApp ke satu orang
// ============================================================

/**
 * Daftar PICA yang belum selesai, siap ditempel ke WhatsApp.
 *
 * Dipakai tombol "Kirim lewat WhatsApp" di kartu anggota: teksnya hanya
 * disiapkan, yang menekan tombol kirim tetap manusianya. Sengaja pendek —
 * pesan panjang di WhatsApp berhenti dibaca.
 */
export function susunPesanTagihPica(p: {
  nama: string;
  dari: string;
  pica: PicaRingkas[];
  hariIni: string;
}): string {
  const sapa = `Halo ${namaDepan(p.nama)},`;

  if (p.pica.length === 0) {
    return [sapa, '', 'Semua PICA kamu sudah tertutup. Terima kasih 🙏', '', `— ${p.dari} (POKEMONKEY)`].join('\n');
  }

  const baris = p.pica.slice(0, 8).map((x, i) => `${i + 1}. ${nomor(x.id)} ${potong(x.judul, 60)} — ${sisaTeks(x.due_date, p.hariIni)}`);
  if (p.pica.length > 8) baris.push(`dan ${p.pica.length - 8} lainnya`);

  const telat = p.pica.filter((x) => x.due_date && x.due_date < p.hariIni).length;

  return [
    sapa,
    `Ada ${p.pica.length} PICA yang masih terbuka${telat ? `, ${telat} di antaranya lewat tenggat` : ''}:`,
    '',
    ...baris,
    '',
    'Kalau sudah ada perkembangan, tolong catat di aplikasi POKEMONKEY ya. Terima kasih.',
    `— ${p.dari}`,
  ].join('\n');
}
