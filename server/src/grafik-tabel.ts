/**
 * Grafik tabel memo (blok `!tabel{…,"grafik":{…}}`) — SATU sumber hitungan dan
 * tampilan untuk penyunting, mode baca, halaman bagikan (/lihat/memo), dan gambar
 * unduhan, sehingga keempatnya sama persis. Gaya kartu Monkey Point (putih,
 * bingkai hitam, bayangan piksel) agar terbaca di tema gelap maupun terang.
 *
 * Supaya tidak membingungkan:
 * - angka selalu tertulis (tidak bergantung arahkan-tetikus; HP tidak punya hover);
 * - status memakai warna & urutan yang sama dengan layar PICA
 *   (Open → Dikerjakan → Continue → Menunggu Verifikasi → Selesai);
 * - rekap jumlah memakai batang mendatar (nama panjang tidak terpotong);
 *   grafik garis hanya untuk angka berurutan, bukan untuk kategori;
 * - skala sumbu kelipatan rapi (0, 1, 2, 3 — tanpa angka kembar);
 * - judul tidak membawa jumlah lama: jumlah selalu dihitung dari isi tabel terkini.
 * HTML + gaya sebaris saja (halaman bagikan tanpa skrip; gambar unduhan dari DOM).
 */

import type { OpsiGrafikTabel } from './memo-blok';

export interface StatusBaku { kunci: string; label: string; warna: string; urutan: number }

/** Sama dengan opsi status PICA (Open, Dikerjakan, Continue, Menunggu Verifikasi, Selesai). */
const STATUS: StatusBaku[] = [
  { kunci: 'open', label: 'Open', warna: '#f59e0b', urutan: 1 },
  { kunci: 'progress', label: 'Dikerjakan', warna: '#2563eb', urutan: 2 },
  { kunci: 'continue', label: 'Continue', warna: '#4f46e5', urutan: 3 },
  { kunci: 'verifikasi', label: 'Menunggu Verifikasi', warna: '#9333ea', urutan: 4 },
  { kunci: 'selesai', label: 'Selesai', warna: '#059669', urutan: 5 },
  { kunci: 'batal', label: 'Batal', warna: '#dc2626', urutan: 6 },
];

/**
 * Kelompok status baku dari teks sel (Closed/✓ Selesai → Selesai, In Progress → Dikerjakan, …).
 * Penyangkalan dicek lebih dulu: "Belum selesai", "Tidak selesai", "Not done" = belum.
 */
export function statusBaku(teks: string): StatusBaku | null {
  const s = (teks ?? '').trim().toLowerCase();
  if (!s) return null;
  if (/belum|\bblm\b|tidak|\bnot\b|undone|☐|\[ \]/.test(s)) return STATUS[0];
  if (/batal|cancel|reject|ditolak/.test(s)) return STATUS[5];
  if (/closed|selesai|done|tuntas|✓|✔|☑|\[x\]/.test(s) || s === '1') return STATUS[4];
  if (/verifikasi|verify|review/.test(s)) return STATUS[3];
  if (/continue|lanjut/.test(s)) return STATUS[2];
  if (/progress|dikerjakan|proses|berjalan|ongoing/.test(s)) return STATUS[1];
  if (/open|buka|belum|pending|to ?do|☐|\[ \]/.test(s) || s === '0') return STATUS[0];
  return null;
}

/**
 * Kolom pendek (isi terpanjang ≤ `maks` huruf, mis. No, Hari, Tanggal): jangan dilipat di gambar/halaman
 * bagikan. Gambar HP yang sempit memakai batas kecil agar kolom uraian tidak terhimpit.
 */
export const kolomPendek = (baris: string[][], maks = 12) => (baris[0] ?? []).map((_, j) => Math.max(0, ...baris.map((r) => (r[j] ?? '').length)) <= maks);

/** Label status tanpa tanda ceklis ("[x] Selesai" → "Selesai", "☐ Belum" → "Belum"). */
export function labelStatus(teks: string): string {
  return (teks ?? '').replace(/^\s*(\[[ xX]\]|☐|☑|✓|✔|✗|✘)\s*/, '').trim() || (teks ?? '').trim();
}

/** Warna teks yang terbaca di atas warna latar `hex` (hitam atau putih). */
export function kontras(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#0f172a';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0f172a' : '#ffffff';
}

/** Nilai angka dari teks sel (1.250,5 · 12,5 · 1,250.5 · 40% · 3 ha); null bila bukan angka. */
export function ekstrakAngka(teks: string): number | null {
  if (!teks || !teks.trim()) return null;
  let s = teks.trim().replace(/(?:ha|hektar|bibit|btg|batang|pohon|kg|ton|rp|usd|%)\b/gi, '').replace(/%/g, '').trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d+(,\d+)$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Skala sumbu rapi: langkah 1·2·2,5·5 × 10ⁿ, paling banyak ±5 garis. */
export function skalaRapi(maks: number, bulat: boolean): { atas: number; tick: number[] } {
  if (!(maks > 0)) return { atas: bulat ? 4 : 1, tick: bulat ? [0, 1, 2, 3, 4] : [0, 0.25, 0.5, 0.75, 1] };
  const kasar = maks / 4;
  const pangkat = 10 ** Math.floor(Math.log10(kasar));
  let langkah = [1, 2, 2.5, 5, 10].map((m) => m * pangkat).find((l) => l >= kasar) ?? 10 * pangkat;
  if (bulat) langkah = Math.max(1, Math.ceil(langkah));
  const atas = Math.ceil(maks / langkah - 1e-9) * langkah;
  const tick: number[] = [];
  for (let v = 0; v <= atas + 1e-9; v += langkah) tick.push(Math.round(v * 1e6) / 1e6);
  return { atas, tick };
}

const angka = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

// ---- Tanggal (grafik progres & habit) ----
const BULAN: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const isoTgl = (y: number, m: number, d: number): string | null => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null;
};
/** Tanggal dari teks sel: 2026-10-09 · 9/10/2026 · 9-10-26 · 9 Okt 2026; null bila bukan tanggal. */
export function bacaTanggal(teks: string): string | null {
  const s = (teks ?? '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return isoTgl(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(s);
  if (m) return isoTgl(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = /^(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s*(\d{4})?$/i.exec(s);
  if (m && BULAN[m[2].toLowerCase()]) return isoTgl(m[3] ? +m[3] : new Date().getUTCFullYear(), BULAN[m[2].toLowerCase()], +m[1]);
  return null;
}
export const tambahHari = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
/** Hari ini menurut WITA (lapangan di Kalimantan Selatan), sama di aplikasi dan server. */
export const hariIniWita = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
export const tglPendek = (iso: string) => (iso ? `${+iso.slice(8, 10)} ${NAMA_BULAN[+iso.slice(5, 7) - 1]}` : '');

export interface PotongGrafik { label: string; nilai: number; warna: string }

/** Keadaan tiap hari pada kurva progres. 'belum' = tabel tanpa tanggal (tak tahu terlambat/belum waktunya). */
export type KeadaanHari = 'selesai' | 'terlambat' | 'hariini' | 'nanti' | 'belum';
export interface DataProgres {
  n: number;
  /** Indeks hari ini: -1 belum mulai, n-1 masa sudah lewat; null bila tabel tanpa tanggal & tanggal mulai. */
  hariIni: number | null;
  selesai: number;
  keadaan: KeadaanHari[];
  kumulatif: number[];
  label: string[];
  tanggal: string[];
  fase: { label: string; dari: number; sampai: number }[];
  /** Target sampai hari ini: hari yang sudah lewat, + hari ini bila sudah dicentang. */
  target: number;
  terlambat: number;
  /** Hari selesai berturut-turut sampai hari ini / kemarin, dan yang terpanjang. */
  runtunan: number;
  terbaik: number;
  /** Persen hari yang dikerjakan dari hari yang sudah lewat; null bila belum bisa dihitung. */
  konsistensi: number | null;
  /** Perkiraan jumlah hari selesai di akhir masa dengan laju sekarang. */
  perkiraan: number | null;
  /** Habit: hari yang belum tiba tetapi sudah dicentang (tidak dihitung). */
  dimajukan: number;
  /** Indeks terakhir garis realisasi (hari ini; tracker biasa: sampai centang terakhir bila lebih awal). */
  akhir: number;
}
export interface SeriGrafik { nama: string; warna: string; nilai: number[] }
export interface DataGrafikTabel {
  judul: string;
  ket: string;
  mode: 'hitung' | 'nilai';
  /** Tipe yang benar-benar digambar (garis untuk kategori diganti batang). */
  tipe: 'batang' | 'garis' | 'pie' | 'progres';
  kategori: string[];
  /** Warna tiap kategori (seri tunggal): warna status, atau satu warna untuk kategori biasa. */
  warnaKategori: string[];
  seri: SeriGrafik[];
  /** Rekap jumlah dipecah kolom kedua → batang mendatar bertumpuk. */
  bertumpuk: boolean;
  /** Kotak angka & donat: jumlah per kelompok utama. */
  ringkas: PotongGrafik[];
  total: number;
  satuan: string;
  bulat: boolean;
  /** Kurva progres harian (tipe 'progres'). */
  progres?: DataProgres;
  /** Untuk panel setelan. */
  kolom: string[];
  colX: number;
  colPecah: number;
  seriY: number[];
  idxStatus: number;
  idxPic: number;
}

const PALET = ['#0284c7', '#f59e0b', '#059669', '#db2777', '#7c3aed', '#ea580c', '#65a30d', '#dc2626', '#0d9488', '#4f46e5'];
/** Satu warna untuk batang kategori biasa (nama PIC, bidang, …): warna berbeda tanpa arti hanya membingungkan. */
const WARNA_BATANG = '#0284c7';
const LEWATI_ANGKA = /^(no|nomor|id|kode|tgl|tanggal|date|due|tahun)\b/i;

/** Kolom status: judulnya "status/ceklis/kondisi", atau ≥60% isinya kata status. */
export function kolomStatusTabel(baris: string[][], kepala: boolean): number {
  if (!baris.length) return -1;
  const nama = baris[0].map((c, j) => (kepala ? c : `Kolom ${j + 1}`));
  const dariJudul = nama.findIndex((c) => /status|ceklis|checklist|\bcheck\b|kondisi|state|progres\s*hari|^selesai\??$/i.test(c) && !/kumulatif|cumulative|total|jumlah/i.test(c));
  if (dariJudul !== -1) return dariJudul;
  const data = barisData(kepala ? baris.slice(1) : baris);
  if (!data.length) return -1;
  for (let j = 0; j < nama.length; j++) {
    const kena = data.filter((r) => statusBaku(r[j] ?? '')).length;
    const adaKata = data.some((r) => /[a-z✓✔☑☐\[]/i.test(r[j] ?? ''));
    if (adaKata && kena / data.length >= 0.6 && new Set(data.map((r) => statusBaku(r[j] ?? '')?.kunci)).size >= 2) return j;
  }
  return -1;
}

/** Baris yang benar-benar berisi (baris kosong dari "+ Baris" tidak ikut dihitung/digambar). */
export const barisData = (data: string[][]) => data.filter((r) => r.some((c) => (c ?? '').trim()));

interface Kelompok { kunci: string; label: string; warna: string; urutan: number; n: number }

/** Kelompokkan isi satu kolom; status → kelompok baku (label baku untuk tabel PICA). */
function kelompokkan(data: string[][], j: number, status: boolean, labelBaku: boolean): { daftar: Kelompok[]; kunciBaris: string[] } {
  const peta = new Map<string, Kelompok & { teks: Map<string, number> }>();
  const kunciBaris = data.map((r) => {
    const teks = (r[j] ?? '').trim();
    const st = status ? statusBaku(teks) : null;
    const kunci = st ? `s:${st.kunci}` : `t:${teks.toLowerCase() || '(kosong)'}`;
    const tulisan = st ? labelStatus(teks) : teks || '(Kosong)';
    const k = peta.get(kunci) ?? { kunci, label: st && labelBaku ? st.label : tulisan, warna: st?.warna ?? '', urutan: st?.urutan ?? 99, n: 0, teks: new Map() };
    k.n += 1;
    k.teks.set(tulisan, (k.teks.get(tulisan) ?? 0) + 1);
    peta.set(kunci, k);
    return kunci;
  });
  const daftar = [...peta.values()].map((k) => {
    // Tabel biasa: label = tulisan yang paling sering dipakai di kelompok itu.
    const label = k.kunci.startsWith('s:') && !labelBaku ? [...k.teks.entries()].sort((a, b) => b[1] - a[1])[0][0] : k.label;
    return { kunci: k.kunci, label, warna: k.warna, urutan: k.urutan, n: k.n };
  });
  daftar.sort((a, b) => a.urutan - b.urutan || b.n - a.n || a.label.localeCompare(b.label, 'id'));
  daftar.forEach((k, i) => { if (!k.warna) k.warna = PALET[i % PALET.length]; });
  return { daftar, kunciBaris };
}

/**
 * Kurva progres harian: satu baris = satu hari. Hari ini diambil dari kolom tanggal
 * (atau tanggal mulai + urutan baris), menurut WITA. Kumulatif selalu dihitung dari
 * ceklis, bukan dari angka di berkas.
 */
/** Tanggal tiap baris data: kolom tanggal, atau tanggal mulai + urutan baris ('' bila tidak diketahui). */
function tanggalBaris(data: string[][], kolom: string[], mulai?: string): string[] {
  const idxTgl = kolom.findIndex((c) => /tanggal|\btgl\b|date/i.test(c));
  const awal = mulai ? bacaTanggal(mulai) : null;
  return data.map((r, i) => (idxTgl !== -1 ? bacaTanggal(r[idxTgl] ?? '') : null) ?? (awal ? tambahHari(awal, i) : ''));
}

/** Tabel habit (menu "/" → Habit, atau berkolom "Kebiasaan"): hari mendatang tidak boleh dicentang. */
export const tabelHabit = (kolom: string[], opsi: OpsiGrafikTabel) => Boolean(opsi.habit) || kolom.some((c) => /kebiasaan|habit/i.test(c));

/**
 * Nomor baris tabel (indeks pada `baris`, termasuk baris judul) yang harinya belum tiba,
 * untuk tabel habit bergrafik progres. Kosong bila tabel tanpa tanggal.
 */
export function barisMendatang(baris: string[][], kepala: boolean, opsi: OpsiGrafikTabel): Set<number> {
  const hasil = new Set<number>();
  if (opsi.tipe !== 'progres' || !baris.length) return hasil;
  const kolom = baris[0].map((c, j) => (kepala && c?.trim() ? c.trim() : `Kolom ${j + 1}`));
  if (!tabelHabit(kolom, opsi)) return hasil;
  const awalData = kepala ? 1 : 0;
  const nomor = baris.map((_, i) => i).slice(awalData).filter((i) => baris[i].some((c) => (c ?? '').trim()));
  const tanggal = tanggalBaris(nomor.map((i) => baris[i]), kolom, opsi.mulai);
  if (!tanggal.every(Boolean)) return hasil;
  const kini = hariIniWita();
  nomor.forEach((i, k) => { if (tanggal[k] > kini) hasil.add(i); });
  return hasil;
}

function hitungProgres(data: string[][], kolom: string[], idxStatus: number, colX: number, mulai?: string, habit = false): DataProgres {
  const n = data.length;
  const idxFase = kolom.findIndex((c) => /fase|minggu|tahap|week|phase/i.test(c));
  const tanggal = tanggalBaris(data, kolom, mulai);
  const kini = hariIniWita();
  let hariIni: number | null = null;
  if (n && tanggal.every(Boolean)) {
    hariIni = -1;
    tanggal.forEach((t, i) => { if (t <= kini) hariIni = i; });
  }
  const dicentang = data.map((r) => statusBaku(r[idxStatus] ?? '')?.kunci === 'selesai');
  // Habit: kebiasaan hari yang belum tiba belum mungkin dikerjakan — centangnya tidak dihitung.
  const mendatang = (i: number) => habit && hariIni !== null && i > hariIni;
  const dimajukan = dicentang.filter((x, i) => x && mendatang(i)).length;
  const selesaiArr = dicentang.map((x, i) => x && !mendatang(i));
  let jalan = 0;
  const kumulatif = selesaiArr.map((x) => (jalan += x ? 1 : 0));
  const keadaan: KeadaanHari[] = selesaiArr.map((x, i) => (
    x ? 'selesai' : hariIni === null ? 'belum' : i < hariIni ? 'terlambat' : i === hariIni ? 'hariini' : 'nanti'
  ));
  const fase: DataProgres['fase'] = [];
  if (idxFase !== -1) {
    data.forEach((r, i) => {
      const f = (r[idxFase] ?? '').trim();
      const akhir = fase[fase.length - 1];
      if (akhir && akhir.label === f) akhir.sampai = i;
      else if (f) fase.push({ label: f, dari: i, sampai: i });
    });
  }
  const selesai = jalan;
  // Hari ini baru dihitung bila sudah dicentang (masih bisa dikerjakan sampai malam).
  const dihitung = hariIni === null ? null : hariIni < 0 ? 0 : (selesaiArr[hariIni] ? hariIni + 1 : hariIni);
  const ujung = hariIni === null ? selesaiArr.lastIndexOf(true) : dihitung! - 1;
  let runtunan = 0;
  for (let i = ujung; i >= 0 && selesaiArr[i]; i--) runtunan++;
  let terbaik = 0;
  let run = 0;
  for (const x of selesaiArr) { run = x ? run + 1 : 0; terbaik = Math.max(terbaik, run); }
  const selesaiLewat = dihitung ? selesaiArr.slice(0, dihitung).filter(Boolean).length : 0;
  const konsistensi = dihitung ? Math.round((selesaiLewat / dihitung) * 100) : null;
  const perkiraan = konsistensi === null || dihitung === null ? null : Math.min(n, selesai + Math.round(((n - dihitung) * konsistensi) / 100));
  return {
    n, hariIni, selesai, keadaan, kumulatif, tanggal, fase,
    label: data.map((r, i) => (r[colX] ?? '').trim() || `Hari ${i + 1}`),
    // Target = hari yang sudah lewat (+ hari ini bila sudah dicentang), sama dengan dasar hitungan "Terlewat".
    target: hariIni === null ? n : dihitung ?? 0,
    terlambat: keadaan.filter((k) => k === 'terlambat').length,
    runtunan, terbaik, konsistensi, perkiraan, dimajukan,
    // Tracker biasa boleh lebih cepat dari jadwal: garis sampai centang terakhir.
    akhir: hariIni === null ? n - 1 : Math.max(Math.min(n - 1, hariIni), habit ? -1 : selesaiArr.lastIndexOf(true)),
  };
}

/** Hitung semua yang dibutuhkan grafik dari isi tabel terkini; null bila tabel kosong. */
export function hitungGrafikTabel(baris: string[][], kepala: boolean, opsi: OpsiGrafikTabel, pica = false): DataGrafikTabel | null {
  if (!baris.length) return null;
  const lebar = baris[0].length;
  const kolom = Array.from({ length: lebar }, (_, j) => (kepala && baris[0][j]?.trim() ? baris[0][j].trim() : `Kolom ${j + 1}`));
  const data = barisData(kepala ? baris.slice(1) : baris);
  if (!data.length) return null;

  const idxStatus = kolomStatusTabel(baris, kepala);
  const idxPic = kolom.findIndex((c) => /\bpic\b|penanggung|\bpj\b|petugas|nama/i.test(c));
  const kolomAngka = kolom.map((c, j) => !LEWATI_ANGKA.test(c) && data.filter((r) => (ekstrakAngka(r[j] ?? '') ?? 0) > 0).length / data.length >= 0.5);
  const mode: 'hitung' | 'nilai' = opsi.mode ?? (kolomAngka.some(Boolean) && lebar > 1 ? 'nilai' : 'hitung');
  const sah = (j: number | undefined) => j !== undefined && j >= 0 && j < lebar;

  let colX = sah(opsi.sumbuX) ? opsi.sumbuX! : mode === 'hitung' ? (idxStatus !== -1 ? idxStatus : idxPic !== -1 ? idxPic : 0) : 0;
  if (mode === 'hitung' && !sah(colX)) colX = 0;
  let colPecah = opsi.kolomPecah !== undefined ? opsi.kolomPecah : -1;
  if (!sah(colPecah) || colPecah === colX || mode !== 'hitung') colPecah = -1;

  const satuan = pica ? 'PICA' : 'data';
  const judulSimpan = (opsi.judul ?? '').replace(/\s*\(\s*\d+\s*(data|item|pica|baris)\s*\)\s*$/i, '').trim();

  if (opsi.tipe === 'progres' && idxStatus !== -1) {
    const p = hitungProgres(data, kolom, idxStatus, sah(opsi.sumbuX) ? opsi.sumbuX! : 0, opsi.mulai, tabelHabit(kolom, opsi));
    const rentang = p.tanggal[0] ? ` · ${tglPendek(p.tanggal[0])} – ${tglPendek(p.tanggal[p.n - 1])}` : '';
    return {
      judul: judulSimpan || 'Progres harian',
      ket: `${p.n} hari${rentang}`,
      mode: 'nilai', tipe: 'progres',
      kategori: p.label, warnaKategori: p.label.map(() => '#059669'),
      seri: [{ nama: 'Kumulatif selesai', warna: '#059669', nilai: p.kumulatif }],
      bertumpuk: false, ringkas: [], total: p.selesai, satuan: 'hari', bulat: true, progres: p,
      kolom, colX: sah(opsi.sumbuX) ? opsi.sumbuX! : 0, colPecah: -1, seriY: [], idxStatus, idxPic,
    };
  }

  if (mode === 'hitung') {
    const x = kelompokkan(data, colX, colX === idxStatus, pica);
    const statusX = colX === idxStatus;
    if (colPecah !== -1) {
      const p = kelompokkan(data, colPecah, colPecah === idxStatus, pica);
      const nilaiPer = (kx: string, kp: string) => data.filter((_, i) => x.kunciBaris[i] === kx && p.kunciBaris[i] === kp).length;
      // Kategori utama: status menurut urutan baku, selain itu terbanyak dulu.
      const urutX = statusX ? x.daftar : [...x.daftar].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'id'));
      return {
        judul: judulSimpan || `${pica ? 'PICA' : 'Jumlah'} per ${kolom[colX]}`,
        ket: `${data.length} ${satuan} · dirinci per ${kolom[colPecah]}`,
        mode, tipe: opsi.tipe === 'pie' ? 'pie' : 'batang',
        kategori: urutX.map((k) => k.label),
        warnaKategori: urutX.map((k) => (statusX ? k.warna : WARNA_BATANG)),
        seri: p.daftar.map((s) => ({ nama: s.label, warna: s.warna, nilai: urutX.map((k) => nilaiPer(k.kunci, s.kunci)) })),
        bertumpuk: true,
        ringkas: p.daftar.map((s) => ({ label: s.label, nilai: s.n, warna: s.warna })),
        total: data.length, satuan, bulat: true,
        kolom, colX, colPecah, seriY: [], idxStatus, idxPic,
      };
    }
    return {
      judul: judulSimpan || (statusX && pica ? 'Status PICA' : `Rekap ${kolom[colX]}`),
      ket: `${data.length} ${satuan} · menurut ${kolom[colX]}`,
      mode, tipe: opsi.tipe === 'pie' ? 'pie' : 'batang',
      kategori: x.daftar.map((k) => k.label),
      warnaKategori: x.daftar.map((k) => (statusX ? k.warna : WARNA_BATANG)),
      seri: [{ nama: `Jumlah ${satuan}`, warna: WARNA_BATANG, nilai: x.daftar.map((k) => k.n) }],
      bertumpuk: false,
      ringkas: x.daftar.map((k) => ({ label: k.label, nilai: k.n, warna: k.warna })),
      total: data.length, satuan, bulat: true,
      kolom, colX, colPecah: -1, seriY: [], idxStatus, idxPic,
    };
  }

  // Mode nilai: angka sel apa adanya, satu batang/titik per baris.
  const pilihan = (opsi.seriY ?? []).filter((j) => sah(j) && j !== colX);
  const otomatis = kolom.map((_, j) => j).filter((j) => j !== colX && kolomAngka[j]);
  const seriY = pilihan.length ? pilihan : otomatis.length ? otomatis : [Math.min(1, lebar - 1)];
  const seri = seriY.map((j, i) => ({ nama: kolom[j], warna: PALET[i % PALET.length], nilai: data.map((r) => ekstrakAngka(r[j] ?? '') ?? 0) }));
  const kategori = data.map((r, i) => (r[colX] ?? '').trim() || `Baris ${i + 1}`);
  const bulat = seri.every((s) => s.nilai.every((v) => Number.isInteger(v)));
  const pertama = seri[0];
  const totalPertama = pertama ? pertama.nilai.reduce((a, b) => a + b, 0) : 0;
  return {
    judul: judulSimpan || `${seri.length <= 3 ? seri.map((x) => x.nama).join(' & ') : `${seri.length} kolom angka`} per ${kolom[colX]}`,
    ket: `${data.length} baris · ${seri.map((s) => s.nama).join(', ')} menurut ${kolom[colX]}`,
    mode, tipe: opsi.tipe,
    kategori,
    warnaKategori: kategori.map(() => pertama?.warna ?? WARNA_BATANG),
    seri, bertumpuk: false,
    ringkas: pertama ? kategori.map((k, i) => ({ label: k, nilai: pertama.nilai[i], warna: PALET[i % PALET.length] })) : [],
    total: totalPertama, satuan, bulat,
    kolom, colX, colPecah: -1, seriY, idxStatus, idxPic,
  };
}

// ---------------------------------------------------------------------------------
// Tampilan (HTML + gaya sebaris)
// ---------------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Warna lewat variabel CSS agar grafik ikut tema (gelap di mode gelap, terang di mode terang /
// memo berlatar putih). Nilai cadangan = terang. Variabel diisi di index.css (aplikasi),
// lihat-memo.ts (halaman bagikan), dan gambar-memo.ts (gambar unduhan, menurut tema gambarnya).
const TEKS = 'var(--gk-teks,#0f172a)';
const PUDAR = 'var(--gk-pudar,#475569)';
const GARIS = 'var(--gk-garis,#0f172a)';
const BAYANG = 'var(--gk-bayang,#0f172a)';
const SUMBU = 'var(--gk-sumbu,#0f172a)';
const BANTU = 'var(--gk-bantu,#cbd5e1)';
const KOTAK = 'var(--gk-kotak,#ffffff)';

/** Nilai variabel tema grafik (sama dengan index.css): untuk halaman bagikan & gambar unduhan. */
export const TEMA_GRAFIK = {
  gelap: { kartu: '#18181b', kotak: '#27272a', teks: '#f4f4f5', pudar: '#a1a1aa', garis: '#000000', bayang: '#000000', sumbu: '#a1a1aa', bantu: '#3f3f46', bingkai: '#3f3f46' },
  terang: { kartu: '#ffffff', kotak: '#f8fafc', teks: '#0f172a', pudar: '#475569', garis: '#0f172a', bayang: '#0f172a', sumbu: '#0f172a', bantu: '#cbd5e1', bingkai: '#0f172a' },
} as const;
/** Deklarasi variabel CSS tema grafik, mis. untuk `:root{…}` atau atribut style. */
export const cssTemaGrafik = (gelap: boolean) =>
  Object.entries(TEMA_GRAFIK[gelap ? 'gelap' : 'terang']).map(([k, v]) => `--gk-${k}:${v}`).join(';');
const KARTU = 'var(--gk-kartu,#f8fafc)';
const BINGKAI = 'var(--gk-bingkai,#0f172a)';
const PIKSEL = "font-family:'Press Start 2P',monospace";
const TINGGI = 220;

/** Kisi batang mendatar: kolom nama selebar nama terpanjang (maks 40%), semua batang mulai sejajar. */
const KISI = 'display:grid;grid-template-columns:fit-content(40%) minmax(0,1fr);gap:10px 12px;align-items:center';
const NAMA = `font-size:13px;font-weight:700;color:${TEKS};line-height:1.25;word-break:break-word`;
const persen = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
const kotakWarna = (w: string, ukuran = 12) => `<span style="display:inline-block;flex:0 0 auto;width:${ukuran}px;height:${ukuran}px;background:${w};border:2px solid ${GARIS}"></span>`;

/** Kotak angka: total + tiap kelompok (jumlah dan persen). */
function htmlKotak(d: DataGrafikTabel): string {
  if (d.mode !== 'hitung' || d.ringkas.length > 8) return '';
  const kotak = (label: string, n: string, pct: string, w: string) => (
    `<div style="background:${KOTAK};border:2px solid ${GARIS};border-left:8px solid ${w};box-shadow:3px 3px 0 ${BAYANG};padding:7px 10px;min-width:0">`
    + `<div style="font-size:11px;font-weight:700;color:${PUDAR};text-transform:uppercase;line-height:1.25;word-break:break-word">${esc(label)}</div>`
    + `<div style="display:flex;align-items:baseline;gap:6px;margin-top:5px;flex-wrap:wrap"><span style="${PIKSEL};font-size:17px;color:${TEKS}">${n}</span>`
    + `${pct ? `<span style="font-size:12px;font-weight:700;color:${PUDAR}">${pct}</span>` : ''}</div></div>`
  );
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px;margin-bottom:16px">`
    + kotak(`Total ${d.satuan}`, angka(d.total), '', TEKS)
    + d.ringkas.map((k) => kotak(k.label, angka(k.nilai), `${persen(k.nilai, d.total)}%`, k.warna)).join('')
    + `</div>`;
}

/** Batang mendatar: satu baris per kategori, nama utuh di kiri, angka di ujung batang. */
function htmlBatangMendatar(d: DataGrafikTabel): string {
  const s = d.seri[0];
  const maks = Math.max(...s.nilai, 0);
  return `<div style="${KISI}">${d.kategori.map((k, i) => {
    const n = s.nilai[i] ?? 0;
    const lebar = maks > 0 ? (n / maks) * 82 : 0;
    return `<div style="${NAMA}">${esc(k)}</div>`
      + `<div style="display:flex;align-items:center;gap:8px;min-width:0">`
      + (n > 0 ? `<div style="flex:0 0 auto;width:${lebar}%;min-width:6px;height:26px;background:${d.warnaKategori[i]};border:2px solid ${GARIS};box-shadow:2px 2px 0 ${BAYANG}"></div>` : '')
      + `<span style="flex:0 0 auto;font-size:14px;font-weight:700;color:${TEKS};white-space:nowrap">${angka(n)}`
      + `${d.mode === 'hitung' ? ` <span style="font-size:12px;color:${PUDAR}">(${persen(n, d.total)}%)</span>` : ''}</span></div>`;
  }).join('')}</div>`;
}

const legenda = (d: DataGrafikTabel, denganJumlah: boolean) => `<div style="display:flex;flex-wrap:wrap;gap:6px 16px;margin-bottom:12px">${d.seri.map((s) => (
  `<span style="display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:${TEKS}">${kotakWarna(s.warna)}${esc(s.nama)}`
  + `${denganJumlah ? ` <span style="color:${PUDAR}">${angka(s.nilai.reduce((a, b) => a + b, 0))}</span>` : ''}</span>`
)).join('')}</div>`;

/** Batang mendatar bertumpuk (mis. per PIC dirinci per status): angka di tiap potongan & total di ujung. */
function htmlBatangBertumpuk(d: DataGrafikTabel): string {
  const total = d.kategori.map((_, i) => d.seri.reduce((a, s) => a + (s.nilai[i] ?? 0), 0));
  const maks = Math.max(...total, 0);
  return legenda(d, true) + `<div style="${KISI}">${d.kategori.map((k, i) => {
    const lebar = maks > 0 ? (total[i] / maks) * 82 : 0;
    const potong = d.seri.filter((s) => (s.nilai[i] ?? 0) > 0).map((s) => {
      const n = s.nilai[i];
      // Angka ditulis di dalam potongan bila potongannya cukup lebar.
      const muat = (n / Math.max(1, maks)) * 82 >= 6;
      return `<div title="${esc(s.nama)}: ${angka(n)}" style="flex:${n} 1 0;min-width:4px;height:100%;background:${s.warna};border-right:2px solid ${GARIS};display:flex;align-items:center;justify-content:center;overflow:hidden">`
        + (muat ? `<span style="font-size:12px;font-weight:700;color:${kontras(s.warna)}">${angka(n)}</span>` : '') + `</div>`;
    }).join('');
    return `<div style="${NAMA}">${esc(k)}</div>`
      + `<div style="display:flex;align-items:center;gap:8px;min-width:0">`
      + (total[i] > 0 ? `<div style="flex:0 0 auto;width:${lebar}%;min-width:8px;height:28px;display:flex;border:2px solid ${GARIS};border-right:0;box-shadow:2px 2px 0 ${BAYANG}">${potong}</div>` : '')
      + `<span style="flex:0 0 auto;font-size:14px;font-weight:700;color:${TEKS};white-space:nowrap">${angka(total[i])}</span></div>`;
  }).join('')}</div>`;
}

/** Donat besar: total di tengah, legenda dengan jumlah dan persen. */
function htmlDonat(d: DataGrafikTabel): string {
  const isi = d.ringkas.filter((k) => k.nilai > 0);
  const total = isi.reduce((a, k) => a + k.nilai, 0);
  if (total <= 0) return `<p style="font-size:13px;color:${PUDAR}">Belum ada angka untuk digambar.</p>`;
  const R = 104, r = 60, c = 120;
  let sudut = -Math.PI / 2;
  const titik = (rad: number, a: number) => `${(c + rad * Math.cos(a)).toFixed(2)} ${(c + rad * Math.sin(a)).toFixed(2)}`;
  const potong = isi.map((k) => {
    const porsi = k.nilai / total;
    if (porsi >= 0.9999) {
      return `<path d="M ${c - R} ${c} A ${R} ${R} 0 1 1 ${c + R} ${c} A ${R} ${R} 0 1 1 ${c - R} ${c} M ${c - r} ${c} A ${r} ${r} 0 1 0 ${c + r} ${c} A ${r} ${r} 0 1 0 ${c - r} ${c} Z" fill="${k.warna}" fill-rule="evenodd" stroke-width="2" style="stroke:${GARIS}"/>`;
    }
    const a0 = sudut;
    const a1 = sudut + porsi * Math.PI * 2;
    sudut = a1;
    const besar = a1 - a0 > Math.PI ? 1 : 0;
    return `<path d="M ${titik(R, a0)} A ${R} ${R} 0 ${besar} 1 ${titik(R, a1)} L ${titik(r, a1)} A ${r} ${r} 0 ${besar} 0 ${titik(r, a0)} Z" fill="${k.warna}" stroke-width="2" style="stroke:${GARIS}"/>`;
  }).join('');
  const svg = `<svg width="240" height="240" viewBox="0 0 240 240" style="flex:0 0 auto;max-width:100%;height:auto" role="img" aria-label="${esc(d.judul)}">${potong}`
    + `<text x="${c}" y="${c + 4}" text-anchor="middle" style="${PIKSEL};font-size:22px;fill:${TEKS}">${angka(total)}</text>`
    + `<text x="${c}" y="${c + 26}" text-anchor="middle" font-size="13" font-weight="700" style="fill:${PUDAR}">${esc(d.mode === 'hitung' ? d.satuan : 'total')}</text></svg>`;
  const daftar = `<div style="flex:1 1 220px;max-width:380px;display:grid;grid-template-columns:auto 1fr auto;gap:8px 10px;align-items:center;min-width:0">${d.ringkas.map((k) => (
    `${kotakWarna(k.warna, 14)}<span style="font-size:14px;font-weight:700;color:${TEKS};word-break:break-word">${esc(k.label)}</span>`
    + `<span style="font-size:14px;font-weight:700;color:${TEKS};white-space:nowrap;text-align:right">${angka(k.nilai)} <span style="color:${PUDAR};font-size:12px">(${persen(k.nilai, total)}%)</span></span>`
  )).join('')}</div>`;
  return `<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:20px">${svg}${daftar}</div>`;
}

/** Bidang gambar tegak (batang tegak & garis): sumbu kiri, garis bantu rapi, label bawah utuh (2 baris). */
function htmlBidang(d: DataGrafikTabel, isi: (atas: number, slotMin: number) => string): string {
  const maks = Math.max(0, ...d.seri.flatMap((s) => s.nilai));
  const { atas, tick } = skalaRapi(maks, d.bulat);
  const n = d.kategori.length;
  const slotMin = d.tipe === 'garis' ? 44 : Math.max(44, d.seri.length * 22 + 14);
  const sumbu = `<div style="flex:0 0 auto;position:relative;width:44px;height:${TINGGI}px">${tick.map((t) => (
    `<span style="position:absolute;right:6px;bottom:${(t / atas) * 100}%;transform:translateY(50%);font-size:12px;font-weight:700;color:${PUDAR};white-space:nowrap">${angka(t)}</span>`
  )).join('')}</div>`;
  const garis = tick.map((t) => `<div style="position:absolute;left:0;right:0;bottom:${(t / atas) * 100}%;border-top:${t === 0 ? `2px solid ${SUMBU}` : `1px dashed ${BANTU}`}"></div>`).join('');
  const label = `<div style="display:flex;min-width:${n * slotMin}px;margin-top:6px">${d.kategori.map((k) => (
    `<div style="flex:1 1 0;min-width:0;padding:0 2px;text-align:center;font-size:12px;font-weight:700;color:${TEKS};line-height:1.2;word-break:break-word;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden" title="${esc(k)}">${esc(k)}</div>`
  )).join('')}</div>`;
  return (d.seri.length > 1 ? legenda(d, false) : '')
    + `<div style="display:flex;gap:4px">${sumbu}<div style="flex:1;min-width:0;overflow-x:auto;padding-top:18px">`
    + `<div style="position:relative;height:${TINGGI}px;min-width:${n * slotMin}px;border-left:2px solid ${SUMBU}">${garis}${isi(atas, slotMin)}</div>${label}</div></div>`;
}

function htmlBatangTegak(d: DataGrafikTabel): string {
  const tulisAngka = d.kategori.length * d.seri.length <= 40;
  return htmlBidang(d, (atas) => `<div style="position:absolute;inset:0;display:flex">${d.kategori.map((_, i) => (
    `<div style="flex:1 1 0;min-width:0;display:flex;align-items:flex-end;justify-content:center;gap:3px;padding:0 3px">${d.seri.map((s) => {
      const v = s.nilai[i] ?? 0;
      return `<div style="position:relative;flex:0 1 26px;min-width:8px;height:${Math.max(0, (v / atas) * 100)}%;background:${s.warna};border:2px solid ${GARIS};border-bottom:0">`
        + (tulisAngka ? `<span style="position:absolute;left:50%;bottom:100%;transform:translateX(-50%);padding-bottom:2px;font-size:11px;font-weight:700;color:${TEKS};white-space:nowrap">${angka(v)}</span>` : '') + `</div>`;
    }).join('')}</div>`
  )).join('')}</div>`);
}

function htmlGaris(d: DataGrafikTabel): string {
  const n = d.kategori.length;
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const tulisAngka = n <= 20;
  return htmlBidang(d, (atas) => {
    const y = (v: number) => 100 - (v / atas) * 100;
    const garis = d.seri.map((s) => `<polyline fill="none" stroke="${s.warna}" stroke-width="3" vector-effect="non-scaling-stroke" points="${s.nilai.map((v, i) => `${(x(i) * 10).toFixed(1)},${(y(v) * 10).toFixed(1)}`).join(' ')}"/>`).join('');
    const titik = d.seri.map((s) => s.nilai.map((v, i) => (
      `<div style="position:absolute;left:${x(i)}%;bottom:${(v / atas) * 100}%;width:10px;height:10px;transform:translate(-50%,50%);background:${s.warna};border:2px solid ${GARIS}">`
      + (tulisAngka && d.seri.length === 1 ? `<span style="position:absolute;left:50%;bottom:100%;transform:translateX(-50%);padding-bottom:3px;font-size:11px;font-weight:700;color:${TEKS};white-space:nowrap">${angka(v)}</span>` : '') + `</div>`
    )).join('')).join('');
    return `<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">${garis}</svg>${titik}`;
  });
}

const WARNA_HARI: Record<KeadaanHari, [string, string]> = {
  selesai: ['#059669', 'Selesai'], terlambat: ['#dc2626', 'Terlewat'], hariini: ['#f59e0b', 'Hari ini'], nanti: ['', 'Belum waktunya'], belum: ['', 'Belum'],
};

/**
 * Kurva progres: kalimat ringkas, kotak angka, garis realisasi vs garis target,
 * penanda hari ini, pita fase, dan pita per hari (warna per keadaan).
 */
function htmlProgres(d: DataGrafikTabel): string {
  const p = d.progres!;
  const n = p.n;
  const pct = persen(p.selesai, n);
  let kalimat: string;
  if (p.hariIni === null) kalimat = `${p.selesai} dari ${n} hari selesai (${pct}%)`;
  else if (p.hariIni < 0) kalimat = `Belum dimulai · hari pertama ${tglPendek(p.tanggal[0])}`;
  else {
    const selisih = p.selesai - p.target;
    const nada = selisih === 0 ? 'sesuai target' : selisih > 0 ? `unggul ${selisih} hari dari target` : `kurang ${-selisih} hari dari target`;
    const warnaNada = selisih >= 0 ? '#059669' : '#dc2626';
    kalimat = `${p.selesai} dari ${n} hari selesai (${pct}%) · hari ke-${Math.min(n, p.hariIni + 1)} · <span style="color:${warnaNada}">${nada}</span>`;
  }
  const kotak = (label: string, nilai: string, sub: string, w: string) => (
    `<div style="background:${KOTAK};border:2px solid ${GARIS};border-left:8px solid ${w};box-shadow:3px 3px 0 ${BAYANG};padding:7px 10px;min-width:0">`
    + `<div style="font-size:11px;font-weight:700;color:${PUDAR};text-transform:uppercase">${label}</div>`
    + `<div style="display:flex;align-items:baseline;gap:6px;margin-top:5px;flex-wrap:wrap"><span style="${PIKSEL};font-size:16px;color:${TEKS}">${nilai}</span>`
    + `${sub ? `<span style="font-size:12px;font-weight:700;color:${PUDAR}">${sub}</span>` : ''}</div></div>`
  );
  const kotakKotak = [
    kotak('Selesai', `${p.selesai}/${n}`, `${pct}%`, '#059669'),
    ...(p.hariIni !== null ? [kotak('Terlewat', String(p.terlambat), 'hari', '#dc2626')] : []),
    kotak('Runtunan', String(p.runtunan), `hari · terbaik ${p.terbaik}`, '#f59e0b'),
    ...(p.konsistensi !== null ? [kotak('Konsistensi', `${p.konsistensi}%`, '', '#2563eb')] : []),
    ...(p.perkiraan !== null ? [kotak('Perkiraan akhir', `${p.perkiraan}/${n}`, 'hari', '#9333ea')] : []),
  ].join('');

  const { atas, tick } = skalaRapi(n, true);
  const x = (i: number) => ((i + 0.5) / n) * 100;
  const y = (v: number) => 100 - (v / atas) * 100;
  const akhir = p.akhir;
  const garisBantu = tick.map((t) => `<div style="position:absolute;left:0;right:0;bottom:${(t / atas) * 100}%;border-top:${t === 0 ? `2px solid ${SUMBU}` : `1px dashed ${BANTU}`}"></div>`).join('');
  const pitaFase = p.fase.map((f, i) => (
    `<div style="position:absolute;top:0;bottom:0;left:${(f.dari / n) * 100}%;width:${((f.sampai - f.dari + 1) / n) * 100}%;${i % 2 ? '' : `background:${KOTAK};`}border-right:1px dashed ${BANTU}">`
    + `<span style="position:absolute;top:2px;left:4px;right:2px;font-size:11px;font-weight:700;color:${PUDAR};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.label)}</span></div>`
  )).join('');
  const titikTarget = p.kumulatif.map((_, i) => `${(x(i) * 10).toFixed(1)},${(y(i + 1) * 10).toFixed(1)}`).join(' ');
  const titikNyata = akhir >= 0 ? p.kumulatif.slice(0, akhir + 1).map((v, i) => `${(x(i) * 10).toFixed(1)},${(y(v) * 10).toFixed(1)}`) : [];
  const luas = titikNyata.length ? `<polygon fill="#059669" fill-opacity="0.15" points="${(x(0) * 10).toFixed(1)},1000 ${titikNyata.join(' ')} ${(x(akhir) * 10).toFixed(1)},1000"/>` : '';
  const svg = `<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">`
    + `<polyline fill="none" stroke-width="2" stroke-dasharray="7 6" vector-effect="non-scaling-stroke" style="stroke:${PUDAR}" points="${titikTarget}"/>`
    + luas
    + (titikNyata.length ? `<polyline fill="none" stroke="#059669" stroke-width="4" stroke-linejoin="round" vector-effect="non-scaling-stroke" points="${titikNyata.join(' ')}"/>` : '')
    + `</svg>`;
  const ujung = akhir >= 0 ? (
    `<div style="position:absolute;left:${x(akhir)}%;bottom:${(p.kumulatif[akhir] / atas) * 100}%;width:12px;height:12px;transform:translate(-50%,50%);background:#059669;border:2px solid ${GARIS}">`
    + `<span style="position:absolute;left:50%;bottom:100%;transform:translateX(-50%);padding-bottom:3px;font-size:13px;font-weight:700;color:${TEKS};white-space:nowrap">${p.kumulatif[akhir]}</span></div>`
  ) : '';
  const penandaHariIni = p.hariIni !== null && p.hariIni >= 0 && p.hariIni < n ? (
    `<div style="position:absolute;top:0;bottom:0;left:${x(p.hariIni)}%;border-left:2px dashed #f59e0b">`
    + `<span style="position:absolute;bottom:2px;left:4px;padding:1px 5px;background:#f59e0b;color:#0f172a;font-size:11px;font-weight:700;white-space:nowrap;border:2px solid ${GARIS}">Hari ini</span></div>`
  ) : '';
  const langkah = n > 15 ? 5 : 1;
  const labelX = p.kumulatif.map((_, i) => ((i + 1) % langkah === 0 || i === 0 || i === n - 1
    ? `<span style="position:absolute;left:${x(i)}%;transform:translateX(-50%);font-size:12px;font-weight:700;color:${TEKS};white-space:nowrap">${i + 1}</span>` : '')).join('');
  const sumbuY = `<div style="flex:0 0 auto;position:relative;width:36px;height:${TINGGI}px">${tick.map((t) => (
    `<span style="position:absolute;right:6px;bottom:${(t / atas) * 100}%;transform:translateY(50%);font-size:12px;font-weight:700;color:${PUDAR}">${t}</span>`
  )).join('')}</div>`;
  const legendaGaris = `<div style="display:flex;flex-wrap:wrap;gap:6px 16px;margin-bottom:8px;font-size:12px;font-weight:700;color:${TEKS}">`
    + `<span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-block;width:22px;border-top:4px solid #059669"></span>Selesai (kumulatif)</span>`
    + `<span style="display:inline-flex;align-items:center;gap:6px"><span style="display:inline-block;width:22px;border-top:2px dashed ${PUDAR}"></span>Target (1 per hari)</span></div>`;
  const pita = `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:14px">${p.keadaan.map((k, i) => {
    const [w] = WARNA_HARI[k];
    const latar = w || KOTAK;
    const teks = w ? kontras(w) : PUDAR;
    const ket = `${esc(p.label[i])}${p.tanggal[i] ? ` · ${tglPendek(p.tanggal[i])}` : ''} · ${WARNA_HARI[k][1]}`;
    return `<div title="${ket}" style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:${latar};color:${teks};border:2px solid ${GARIS};font-size:11px;font-weight:700">${i + 1}</div>`;
  }).join('')}</div>`;
  const ada = new Set(p.keadaan);
  const legendaPita = `<div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px;font-size:12px;font-weight:700;color:${TEKS}">${(Object.keys(WARNA_HARI) as KeadaanHari[]).filter((k) => ada.has(k)).map((k) => (
    `<span style="display:inline-flex;align-items:center;gap:6px">${kotakWarna(WARNA_HARI[k][0] || 'transparent')}${WARNA_HARI[k][1]}</span>`
  )).join('')}</div>`;

  const peringatan = p.dimajukan
    ? `<div style="font-size:13px;font-weight:700;color:#b45309;margin:-6px 0 12px">⚠ ${p.dimajukan} hari yang belum tiba sudah dicentang — tidak dihitung sampai harinya tiba. Centang hanya hari ini dan hari yang sudah lewat.</div>`
    : '';
  return `<div style="font-size:15px;font-weight:700;color:${TEKS};margin-bottom:12px;line-height:1.4">${kalimat}</div>${peringatan}`
    + `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px;margin-bottom:16px">${kotakKotak}</div>`
    + legendaGaris
    + `<div style="display:flex;gap:4px">${sumbuY}<div style="flex:1;min-width:0">`
    + `<div style="position:relative;height:${TINGGI}px;border-left:2px solid ${SUMBU}">${pitaFase}${garisBantu}${svg}${penandaHariIni}${ujung}</div>`
    + `<div style="position:relative;height:18px;margin-top:4px">${labelX}</div>`
    + `<div style="text-align:center;font-size:11px;font-weight:700;color:${PUDAR}">Hari ke-</div></div></div>`
    + pita + legendaPita;
}

/** Isi grafik (kotak angka + gambar), tanpa judul. */
export function htmlIsiGrafikTabel(d: DataGrafikTabel): string {
  if (d.tipe === 'progres' && d.progres) return htmlProgres(d);
  if (d.tipe === 'pie') return htmlKotak(d) + htmlDonat(d);
  if (d.mode === 'hitung') return htmlKotak(d) + (d.bertumpuk ? htmlBatangBertumpuk(d) : htmlBatangMendatar(d));
  if (d.tipe === 'garis') return htmlGaris(d);
  return htmlBatangTegak(d);
}

/** Kartu grafik lengkap (judul + isi) untuk halaman bagikan dan gambar unduhan. */
export function htmlKartuGrafikTabel(d: DataGrafikTabel): string {
  return `<div style="margin:10px 0;background:${KARTU};border:2px solid ${BINGKAI};box-shadow:4px 4px 0 ${BAYANG};padding:14px;color:${TEKS}">`
    + `<div style="border-bottom:2px solid ${BINGKAI};padding-bottom:8px;margin-bottom:14px">`
    + `<div style="${PIKSEL};font-size:12px;line-height:1.5;color:${TEKS};text-transform:uppercase">${esc(d.judul)}</div>`
    + `<div style="font-size:12px;font-weight:700;color:${PUDAR};margin-top:4px">${esc(d.ket)}</div></div>`
    + htmlIsiGrafikTabel(d) + `</div>`;
}
