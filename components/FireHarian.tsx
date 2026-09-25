import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Flame, Loader2, CheckCircle2, FileText, Trees, Mountain, Clock } from 'lucide-react';
import { demoAktif } from '../lib/api';
import { DAFTAR_IPPKH, type LaporanKarhutla, type TitikApiFireItem } from '../lib/fire-report';
import {
  hariWita, kolomTitik, wajibLapor, kelompokTitik, kelompokLaporan,
  type ArsipKarhutla, type KelompokLaporan,
} from '../lib/karhutla';

/**
 * Tab HARIAN FIRE: satu baris per hari dalam sebulan. Kolom = area (IUP, tiap
 * SK IPPKH, Rehab DAS, waspada). Kolom laporan menunjukkan keadaan hari itu:
 * Buat laporan → Draf (lanjut) → Diekspor → Terkirim. Laporan tambang
 * (IUP + IPPKH) dan Rehab DAS dibuat terpisah karena formatnya berbeda.
 */

interface Props {
  bulan: string;
  onGantiBulan: (bulan: string) => void;
  titik: TitikApiFireItem[];
  arsip: ArsipKarhutla[];
  draf: LaporanKarhutla[];
  memuat: boolean;
  galat: string | null;
  onBuat: (hari: string, kelompok: KelompokLaporan, titik: TitikApiFireItem[]) => void;
  onBukaDraf: (l: LaporanKarhutla) => void;
  onBukaArsip: (a: ArsipKarhutla) => void;
  onFokusTitik: (t: TitikApiFireItem) => void;
}

const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const geserBulan = (bulan: string, n: number) => {
  const [y, m] = bulan.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const labelBulan = (bulan: string) => `${NAMA_BULAN[Number(bulan.slice(5)) - 1]} ${bulan.slice(0, 4)}`.toUpperCase();
const labelHari = (hari: string) => {
  const d = new Date(`${hari}T00:00:00Z`);
  return `${NAMA_HARI[d.getUTCDay()]} ${d.getUTCDate()}`;
};
const jamWita = (iso: string) => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(11, 16).replace(':', '.');

/** Navigasi bulan, dipakai tab Harian dan Riwayat. */
export const PemilihBulan: React.FC<{ bulan: string; onGanti: (b: string) => void; bulanMaks: string }> = ({ bulan, onGanti, bulanMaks }) => (
  <div className="flex items-center gap-1">
    <button type="button" onClick={() => onGanti(geserBulan(bulan, -1))} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Bulan sebelumnya"><ChevronLeft size={16} /></button>
    <span className="font-title text-[11px] text-yellow-400 min-w-[10rem] px-2 text-center whitespace-nowrap">{labelBulan(bulan)}</span>
    <button type="button" onClick={() => onGanti(geserBulan(bulan, 1))} disabled={bulan >= bulanMaks} className="btn-ikon !w-8 !h-8 bg-zinc-800 disabled:opacity-30" aria-label="Bulan berikutnya"><ChevronRight size={16} /></button>
  </div>
);

type KeadaanLaporan =
  | { jenis: 'tidak-perlu' }
  | { jenis: 'belum' }
  | { jenis: 'draf'; laporan: LaporanKarhutla }
  | { jenis: 'arsip'; arsip: ArsipKarhutla };

const Sel: React.FC<{ n: number; warna: string }> = ({ n, warna }) => (
  <td className={`p-2 border-r border-white/10 text-center font-mono text-[13px] ${n ? `font-black ${warna}` : 'text-zinc-600'}`}>{n || '–'}</td>
);

export const FireHarian: React.FC<Props> = ({
  bulan, onGantiBulan, titik, arsip, draf, memuat, galat, onBuat, onBukaDraf, onBukaArsip, onFokusTitik,
}) => {
  const [buka, setBuka] = useState<string | null>(null);
  const [lepas, setLepas] = useState<Set<string>>(new Set());

  // Kolom SK: semua SK terdaftar + bidang IPPKH lain yang muncul di data.
  // Mode demo tidak boleh menampilkan nomor SK perusahaan: hanya bidang dari data contoh.
  const kolomSk = useMemo(() => {
    const ada = new Set(titik.filter((t) => t.zona === 'ippkh').map(kolomTitik));
    return [...new Set([...(demoAktif() ? [] : Object.keys(DAFTAR_IPPKH)), ...ada])];
  }, [titik]);

  const hari = useMemo(() => {
    const peta = new Map<string, TitikApiFireItem[]>();
    for (const t of titik) {
      const h = hariWita(t.waktu);
      peta.set(h, [...(peta.get(h) ?? []), t]);
    }
    return [...peta.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [titik]);

  const keadaan = (h: string, k: KelompokLaporan, daftar: TitikApiFireItem[]): KeadaanLaporan => {
    if (!daftar.some((t) => wajibLapor(t) && kelompokTitik(t) === k)) return { jenis: 'tidak-perlu' };
    const a = arsip.find((x) => x.hari_titik === h && kelompokLaporan(x.jenis_izin) === k);
    if (a) return { jenis: 'arsip', arsip: a };
    const d = draf.find((x) => x.hariTitik === h && kelompokLaporan(x.jenisIzin) === k);
    if (d) return { jenis: 'draf', laporan: d };
    return { jenis: 'belum' };
  };

  const total = useMemo(() => ({
    wajib: titik.filter(wajibLapor).length,
    hariWajib: hari.filter(([, d]) => d.some(wajibLapor)).length,
    waspada: titik.filter((t) => !wajibLapor(t)).length,
  }), [titik, hari]);

  const TombolLaporan: React.FC<{ h: string; k: KelompokLaporan; daftar: TitikApiFireItem[] }> = ({ h, k, daftar }) => {
    const s = keadaan(h, k, daftar);
    const label = k === 'das' ? 'Rehab DAS' : 'Tambang';
    const Ikon = k === 'das' ? Trees : Mountain;
    if (s.jenis === 'tidak-perlu') return null;
    if (s.jenis === 'arsip') {
      const terkirim = Boolean(s.arsip.dikirim_pada);
      return (
        <button type="button" onClick={(e) => { e.stopPropagation(); onBukaArsip(s.arsip); }}
          className={`chip-retro !text-[10px] font-bold flex items-center gap-1 ${terkirim ? 'border-emerald-400 bg-emerald-950 text-emerald-300' : 'border-cyan-400 bg-cyan-950 text-cyan-300'}`}>
          <CheckCircle2 size={11} /> {label}: {terkirim ? `Terkirim ${jamWita(s.arsip.dikirim_pada!)}` : 'Diekspor'}
        </button>
      );
    }
    if (s.jenis === 'draf') {
      return (
        <button type="button" onClick={(e) => { e.stopPropagation(); onBukaDraf(s.laporan); }}
          className="chip-retro !text-[10px] font-bold flex items-center gap-1 border-amber-400 bg-amber-950 text-amber-300">
          <FileText size={11} /> {label}: Draf · Lanjut
        </button>
      );
    }
    const dipakai = daftar.filter((t) => wajibLapor(t) && kelompokTitik(t) === k && !lepas.has(t.id));
    return (
      <button type="button" disabled={!dipakai.length} onClick={(e) => { e.stopPropagation(); onBuat(h, k, dipakai); }}
        className={`btn-retro btn-retro-sm !py-1 text-[10px] disabled:opacity-40 ${k === 'das' ? 'bg-amber-700' : 'bg-red-600'}`}>
        <Ikon size={11} /> Buat laporan {label}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PemilihBulan bulan={bulan} onGanti={(b) => { setBuka(null); onGantiBulan(b); }} bulanMaks={hariWita(new Date().toISOString()).slice(0, 7)} />
        <div className="text-[11px] text-zinc-300 font-mono">
          <b className="text-red-300">{total.wajib}</b> titik wajib lapor di <b className="text-white">{total.hariWajib}</b> hari ·{' '}
          <b className="text-yellow-300">{total.waspada}</b> waspada/pantau
        </div>
      </div>

      {galat && <div className="border-2 border-red-500 bg-red-950/60 p-2 text-[12px] text-red-200">{galat}</div>}

      <div className="border-2 border-white/30 bg-black/60 overflow-x-auto">
        <table className="w-full text-[12px] border-collapse min-w-[760px]">
          <thead className="bg-emerald-950 text-emerald-300 uppercase text-[10px] font-mono">
            <tr>
              <th className="p-2 border-r border-white/10 text-left w-24">Tanggal</th>
              <th className="p-2 border-r border-white/10">IUP</th>
              {kolomSk.map((k) => <th key={k} className="p-2 border-r border-white/10">{k}</th>)}
              <th className="p-2 border-r border-white/10">Rehab DAS</th>
              <th className="p-2 border-r border-white/10 text-yellow-300">Waspada</th>
              <th className="p-2 text-left">Laporan</th>
            </tr>
          </thead>
          <tbody>
            {memuat && !hari.length && (
              <tr><td colSpan={kolomSk.length + 5} className="p-6 text-center text-zinc-400"><Loader2 size={18} className="animate-spin inline mr-2" />Memuat titik bulan ini…</td></tr>
            )}
            {!memuat && !hari.length && (
              <tr><td colSpan={kolomSk.length + 5} className="p-6 text-center text-zinc-400">Tidak ada titik api terdeteksi di bulan ini.</td></tr>
            )}
            {hari.map(([h, daftar]) => {
              const hitung = (k: string) => daftar.filter((t) => kolomTitik(t) === k).length;
              const adaWajib = daftar.some(wajibLapor);
              const terbuka = buka === h;
              return (
                <React.Fragment key={h}>
                  <tr onClick={() => setBuka(terbuka ? null : h)}
                    className={`cursor-pointer border-t border-white/10 ${terbuka ? 'bg-orange-950/40' : adaWajib ? 'bg-red-950/20 hover:bg-red-950/40' : 'hover:bg-white/5'}`}>
                    <td className="p-2 border-r border-white/10 font-bold text-white whitespace-nowrap">
                      <ChevronDown size={12} className={`inline mr-1 transition-transform ${terbuka ? '' : '-rotate-90'}`} />{labelHari(h)}
                    </td>
                    <Sel n={hitung('IUP')} warna="text-cyan-300" />
                    {kolomSk.map((k) => <Sel key={k} n={hitung(k)} warna="text-emerald-300" />)}
                    <Sel n={hitung('DAS')} warna="text-amber-300" />
                    <Sel n={hitung('WASPADA')} warna="text-yellow-300" />
                    <td className="p-2">
                      {adaWajib ? (
                        <div className="flex flex-wrap gap-1.5">
                          <TombolLaporan h={h} k="tambang" daftar={daftar} />
                          <TombolLaporan h={h} k="das" daftar={daftar} />
                        </div>
                      ) : <span className="text-[11px] text-zinc-500">tidak perlu</span>}
                    </td>
                  </tr>
                  {terbuka && (
                    <tr className="bg-black/70">
                      <td colSpan={kolomSk.length + 5} className="p-2">
                        <div className="text-[11px] text-zinc-400 mb-1.5">
                          Centang titik yang ikut dilaporkan. Titik waspada/pantau hanya dipantau, tidak masuk laporan.
                        </div>
                        <div className="grid gap-1">
                          {daftar.map((t) => {
                            const wajib = wajibLapor(t);
                            return (
                              <div key={t.id} className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2 py-1.5 border ${wajib ? 'border-red-500/40 bg-red-950/20' : 'border-white/10'}`}>
                                <input type="checkbox" disabled={!wajib} checked={wajib && !lepas.has(t.id)}
                                  onChange={() => setLepas((s) => { const b = new Set(s); if (b.has(t.id)) b.delete(t.id); else b.add(t.id); return b; })}
                                  className="w-4 h-4 accent-red-600" aria-label="Masukkan ke laporan" />
                                <span className={`font-bold text-[11px] w-40 ${wajib ? 'text-red-300' : 'text-yellow-300'}`}>
                                  {kolomTitik(t) === 'DAS' ? `DAS ${t.bidang ?? ''}` : kolomTitik(t) === 'WASPADA' ? (t.zona === 'pantau' ? 'Pantau' : 'Waspada') : kolomTitik(t)}
                                </span>
                                <span className="font-mono text-[11px] text-zinc-200">{t.lon.toFixed(5)}, {t.lat.toFixed(5)}</span>
                                <span className="text-[11px] text-zinc-400 flex items-center gap-1"><Clock size={10} />{jamWita(t.waktu)} WITA</span>
                                <span className="text-[11px] text-zinc-400">{t.sumber} · {t.keyakinan}</span>
                                <span className={`text-[10px] font-bold uppercase ${t.status === 'padam' ? 'text-emerald-400' : t.status === 'dicek' ? 'text-amber-300' : 'text-red-300'}`}>
                                  {t.status === 'padam' ? 'Padam' : t.status === 'dicek' ? 'Dicek' : t.status === 'bukan_api' ? 'Bukan api' : 'Baru'}
                                </span>
                                <button type="button" onClick={() => onFokusTitik(t)} className="ml-auto text-[11px] text-cyan-300 underline decoration-dotted">Lihat di peta</button>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
        <Flame size={11} className="text-red-400" /> Satu hari bisa punya dua laporan: tambang (IUP/IPPKH) dan Rehab DAS.
      </p>
    </div>
  );
};
