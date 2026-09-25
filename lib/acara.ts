/**
 * Model acara kalender bersama untuk tampilan Hari, Minggu, Bulan, dan Agenda.
 * Satu "acara" bisa berupa jadwal (termasuk berulang & multi-hari), tenggat PICA,
 * atau hari libur.
 */

import type { JadwalItem, TenggatKalender } from './tipe-api';
import type { Libur } from './libur';
import * as W from './waktu';

export type Sumber = 'libur' | 'tenggat' | 'rapat' | 'tim' | 'saya' | 'lain' | 'roster';

export interface Acara {
  kunci: string;
  judul: string;
  mulaiTgl: string;
  selesaiTgl: string;           // inklusif
  mulai: number | null;         // menit sejak 00:00 WITA; null = sepanjang hari
  selesai: number | null;
  sumber: Sumber;
  sub?: string;
  jadwal?: JadwalItem;
  tenggat?: TenggatKalender;
  libur?: Libur;
  selesaiDitandai?: boolean;
  telat?: boolean;
}

export const SUMBER: { id: Sumber; label: string; titik: string }[] = [
  { id: 'libur', label: 'Libur nasional', titik: 'bg-red-500' },
  { id: 'tenggat', label: 'Tenggat PICA', titik: 'bg-amber-500' },
  { id: 'rapat', label: 'Rapat', titik: 'bg-indigo-500' },
  { id: 'tim', label: 'Rencana tim', titik: 'bg-cyan-500' },
  { id: 'saya', label: 'Rencana saya', titik: 'bg-emerald-500' },
  { id: 'lain', label: 'Anggota lain', titik: 'bg-zinc-500' },
  { id: 'roster', label: 'Roster saya', titik: 'bg-teal-500' },
];

const KELAS: Record<Sumber, string> = {
  libur: 'bg-red-800/90 border-red-300 text-red-50',
  tenggat: 'bg-amber-900/85 border-amber-400 text-amber-50',
  rapat: 'bg-indigo-900/85 border-indigo-400 text-indigo-50',
  tim: 'bg-cyan-900/85 border-cyan-400 text-cyan-50',
  saya: 'bg-emerald-900/85 border-emerald-400 text-emerald-50',
  lain: 'bg-zinc-800/85 border-zinc-500 text-zinc-100',
  roster: 'bg-teal-900/85 border-teal-400 text-teal-50',
};

export function kelasAcara(a: Acara): string {
  if (a.libur?.jenis === 'cuti') return 'bg-rose-950/85 border-rose-400 text-rose-100';
  if (a.libur?.jenis === 'perusahaan') return 'bg-purple-900/85 border-purple-300 text-purple-50';
  if (a.telat) return 'bg-red-900/80 border-red-500 text-red-50';
  return KELAS[a.sumber];
}

export const multiHari = (a: Acara) => a.mulaiTgl !== a.selesaiTgl;
export const sepanjangHari = (a: Acara) => a.mulai === null || multiHari(a);
export const padaTanggal = (a: Acara, t: string) => a.mulaiTgl <= t && t <= a.selesaiTgl;

function sumberJadwal(j: JadwalItem, saya?: string | null): Sumber {
  if (j.jenis === 'rapat') return 'rapat';
  if (!j.pemilik_id) return 'tim';
  if (saya && j.pemilik_id === saya) return 'saya';
  return 'lain';
}

/** Tanggal-tanggal mulai kemunculan jadwal (berulang harian/mingguan) di rentang. */
function kemunculan(j: JadwalItem, dari: string, sampai: string): string[] {
  const panjang = j.tanggal_selesai ? W.selisihHari(j.tanggal_selesai, j.tanggal) : 0;
  if (!j.rrule) return [j.tanggal];
  const harian = /FREQ=DAILY/i.test(j.rrule);
  const mingguan = /FREQ=WEEKLY/i.test(j.rrule);
  if (!harian && !mingguan) return [j.tanggal];
  const hasil: string[] = [];
  const hariAsal = W.hariKe(j.tanggal);
  for (let t = W.geserHari(dari, -panjang); t <= sampai; t = W.geserHari(t, 1)) {
    if (t < j.tanggal) continue;
    if (harian || W.hariKe(t) === hariAsal) hasil.push(t);
  }
  return hasil;
}

export function bangunAcara(p: {
  jadwal: JadwalItem[];
  tenggat: TenggatKalender[];
  libur: Libur[];
  sayaId?: string | null;
  /** Roster pemakai sendiri (sudah disaring per orang) untuk lapisan "Roster saya". */
  roster?: { tanggal: string; kode: string; catatan?: string | null }[];
  /** Kode roster → labelnya, mis. 'M' → 'Masuk'. */
  labelKode?: (kode: string) => string;
  dari: string;
  sampai: string;
  hariIni: string;
}): Acara[] {
  const hasil: Acara[] = [];

  for (const l of p.libur) {
    hasil.push({ kunci: `libur-${l.tanggal}-${l.nama}`, judul: l.nama, mulaiTgl: l.tanggal, selesaiTgl: l.tanggal, mulai: null, selesai: null, sumber: 'libur', sub: l.perkiraan ? 'tanggal masih perkiraan' : undefined, libur: l });
  }

  for (const j of p.jadwal) {
    const sumber = sumberJadwal(j, p.sayaId);
    const panjang = j.tanggal_selesai ? W.selisihHari(j.tanggal_selesai, j.tanggal) : 0;
    for (const t of kemunculan(j, p.dari, p.sampai)) {
      const mulai = W.menitDariJam(j.jam_mulai);
      const selesai = W.menitDariJam(j.jam_selesai);
      hasil.push({
        kunci: `${j.id}@${t}`, judul: j.judul, mulaiTgl: t, selesaiTgl: W.geserHari(t, panjang),
        mulai, selesai: mulai !== null ? (selesai !== null && selesai > mulai ? selesai : mulai + 60) : null,
        sumber, sub: j.pemilik_nama ?? (j.pemilik_id ? 'anggota' : 'seluruh tim'), jadwal: j, selesaiDitandai: j.selesai === 1,
      });
    }
  }

  for (const r of p.roster ?? []) {
    hasil.push({
      kunci: `roster-${r.tanggal}`, judul: p.labelKode?.(r.kode) ?? r.kode,
      mulaiTgl: r.tanggal, selesaiTgl: r.tanggal, mulai: null, selesai: null,
      sumber: 'roster', sub: r.catatan ?? r.kode,
    });
  }

  for (const t of p.tenggat) {
    hasil.push({ kunci: `tenggat-${t.id}`, judul: `${t.id.slice(-2)} · ${t.judul}`, mulaiTgl: t.due_date, selesaiTgl: t.due_date, mulai: null, selesai: null, sumber: 'tenggat', sub: t.pic_nama ?? undefined, tenggat: t, telat: t.due_date < p.hariIni });
  }

  return hasil;
}

/** Urutan tampil ala Google Calendar: libur, multi-hari terpanjang, sepanjang hari, lalu berjam. */
export function urutkan(a: Acara, b: Acara): number {
  const bobot = (x: Acara) => (x.sumber === 'libur' ? 0 : multiHari(x) ? 1 : x.mulai === null ? 2 : 3);
  return bobot(a) - bobot(b)
    || a.mulaiTgl.localeCompare(b.mulaiTgl)
    || W.selisihHari(b.selesaiTgl, b.mulaiTgl) - W.selisihHari(a.selesaiTgl, a.mulaiTgl)
    || (a.mulai ?? 0) - (b.mulai ?? 0)
    || a.judul.localeCompare(b.judul);
}

export interface Bar {
  a: Acara;
  kolom: number;       // 0..6
  rentang: number;     // jumlah kolom
  lajur: number;
  lanjutKiri: boolean; // acara dimulai sebelum minggu ini
  lanjutKanan: boolean;
}

/** Tata letak bar untuk satu baris minggu (7 tanggal). */
export function susunMinggu(minggu: string[], acara: Acara[]): Bar[] {
  const awal = minggu[0];
  const akhir = minggu[minggu.length - 1];
  const kena = acara.filter((a) => a.mulaiTgl <= akhir && a.selesaiTgl >= awal).sort(urutkan);
  const terisi: boolean[][] = [];
  const hasil: Bar[] = [];

  for (const a of kena) {
    const kolom = Math.max(0, W.selisihHari(a.mulaiTgl, awal));
    const kolomAkhir = Math.min(minggu.length - 1, W.selisihHari(a.selesaiTgl, awal));
    let lajur = 0;
    for (;; lajur++) {
      terisi[lajur] ??= Array(minggu.length).fill(false);
      let bebas = true;
      for (let c = kolom; c <= kolomAkhir; c++) if (terisi[lajur][c]) { bebas = false; break; }
      if (bebas) break;
    }
    for (let c = kolom; c <= kolomAkhir; c++) terisi[lajur][c] = true;
    hasil.push({ a, kolom, rentang: kolomAkhir - kolom + 1, lajur, lanjutKiri: a.mulaiTgl < awal, lanjutKanan: a.selesaiTgl > akhir });
  }
  return hasil;
}

/** Grid bulan berawal Senin, lengkap dengan tanggal bulan sebelum/sesudah. */
export function gridBulanSenin(tahun: number, bulan: number): string[][] {
  const pertama = W.keIso(new Date(Date.UTC(tahun, bulan, 1)));
  const terakhir = W.keIso(new Date(Date.UTC(tahun, bulan + 1, 0)));
  const minggu: string[][] = [];
  for (let t = W.awalMinggu(pertama); t <= terakhir || minggu.length < 5; t = W.geserHari(t, 7)) {
    minggu.push(Array.from({ length: 7 }, (_, i) => W.geserHari(t, i)));
    if (minggu.length === 6) break;
  }
  return minggu;
}

/** Nama hari dua huruf, Senin dulu — tidak ambigu seperti "S S". */
export const HARI_SENIN = ['Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb', 'Mg'];
export const HARI_SENIN_PANJANG = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
