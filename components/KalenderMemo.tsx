import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import type { Memo } from '../types';
import type { AnggotaRingkas } from '../lib/tipe-api';
import { kumpulkanTugas, urutTugas } from '../lib/memo-tugas';
import * as W from '../lib/waktu';
import { BarisTugas, type PropsTugas } from './TugasMemo';

/**
 * Kalender memo: grid bulan (Senin di kolom pertama) berisi memo tim yang
 * bertanggal dan ceklis bertenggat. Ketuk tanggal untuk melihat isinya.
 * Jadwal lengkap (dengan pengingat) ada di tab JADWAL; ini hanya pandangan memo.
 */

const NAMA_HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Sel-sel bulan dengan Senin di kolom pertama; null = sel kosong. */
export function gridBulanSenin(tahun: number, bulan: number): (string | null)[] {
  const pertama = `${tahun}-${String(bulan + 1).padStart(2, '0')}-01`;
  const jumlah = new Date(Date.UTC(tahun, bulan + 1, 0)).getUTCDate();
  const kosongAwal = (W.hariKe(pertama) + 6) % 7;
  const sel: (string | null)[] = Array.from({ length: kosongAwal }, () => null);
  for (let d = 1; d <= jumlah; d++) sel.push(`${tahun}-${String(bulan + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (sel.length % 7 !== 0) sel.push(null);
  return sel;
}

export const KalenderMemo: React.FC<PropsTugas & { tim: AnggotaRingkas[] }> = ({ memos, tim, bolehUbah, onCentang, onBukaMemo }) => {
  const hariIni = W.hariIniWita();
  const [tahun, setTahun] = useState(Number(hariIni.slice(0, 4)));
  const [bulan, setBulan] = useState(Number(hariIni.slice(5, 7)) - 1);
  const [pilih, setPilih] = useState(hariIni);

  const idTim = useMemo(() => new Set(tim.map((t) => t.id)), [tim]);
  const peta = useMemo(() => new Map(memos.map((m) => [m.id, m])), [memos]);
  const tugas = useMemo(() => kumpulkanTugas(memos, idTim).filter((t) => t.tanggal), [memos, idTim]);

  const perHari = useMemo(() => {
    const p = new Map<string, { memo: Memo[]; tugas: typeof tugas }>();
    const ambil = (k: string) => { let v = p.get(k); if (!v) { v = { memo: [], tugas: [] }; p.set(k, v); } return v; };
    for (const m of memos) if (m.lingkup === 'tim' && m.tanggal) ambil(m.tanggal.slice(0, 10)).memo.push(m);
    for (const t of tugas) ambil(t.tanggal as string).tugas.push(t);
    return p;
  }, [memos, tugas]);

  const geser = (n: number) => {
    const d = new Date(Date.UTC(tahun, bulan + n, 1));
    setTahun(d.getUTCFullYear());
    setBulan(d.getUTCMonth());
  };

  const sel = gridBulanSenin(tahun, bulan);
  const isiHari = perHari.get(pilih);

  return (
    <div data-gambar-lepas className="h-full overflow-y-auto custom-scrollbar pr-1">
      <div className="flex items-center gap-2 mb-2">
        <CalendarDays size={15} className="text-lime-300" />
        <span className="text-[15px] font-bold text-white">{NAMA_BULAN[bulan]} {tahun}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => geser(-1)} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Bulan sebelumnya"><ChevronLeft size={15} /></button>
          <button type="button" onClick={() => { setTahun(Number(hariIni.slice(0, 4))); setBulan(Number(hariIni.slice(5, 7)) - 1); setPilih(hariIni); }} className="btn-retro btn-retro-sm bg-zinc-800">Hari ini</button>
          <button type="button" onClick={() => geser(1)} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Bulan berikutnya"><ChevronRight size={15} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-2 border-white/25 text-center" role="grid" aria-label={`Kalender ${NAMA_BULAN[bulan]} ${tahun}`}>
        {NAMA_HARI.map((h) => <div key={h} className="py-1 text-[11px] uppercase text-zinc-400 bg-zinc-900 border-b-2 border-white/15" role="columnheader">{h}</div>)}
        {sel.map((tgl, i) => {
          if (!tgl) return <div key={`k${i}`} className="min-h-[52px] border-b border-r border-white/5 bg-black/20" />;
          const v = perHari.get(tgl);
          const terlambat = v?.tugas.some((t) => !t.selesai && tgl < hariIni);
          const adaTugas = v?.tugas.filter((t) => !t.selesai).length ?? 0;
          const aktif = tgl === pilih;
          return (
            <button
              key={tgl}
              type="button"
              role="gridcell"
              onClick={() => setPilih(tgl)}
              aria-label={`${W.formatPanjang(tgl)}${v ? `, ${v.memo.length} memo, ${v.tugas.length} tugas` : ''}`}
              aria-selected={aktif}
              className={`min-h-[52px] p-1 text-left border-b border-r border-white/10 flex flex-col gap-0.5 ${aktif ? 'bg-lime-600/25 outline outline-2 outline-lime-400 -outline-offset-2' : 'hover:bg-white/[0.06]'}`}
            >
              <span className={`text-[12px] font-bold w-5 h-5 flex items-center justify-center ${tgl === hariIni ? 'bg-amber-400 text-black' : 'text-zinc-200'}`}>{Number(tgl.slice(8))}</span>
              <span className="flex flex-wrap gap-0.5">
                {v && v.memo.length > 0 && <span className="w-2 h-2 bg-sky-400" title={`${v.memo.length} memo`} />}
                {adaTugas > 0 && <span className={`w-2 h-2 ${terlambat ? 'bg-red-400' : 'bg-lime-400'}`} title={`${adaTugas} tugas`} />}
                {v && v.tugas.length > 0 && adaTugas === 0 && <span className="w-2 h-2 bg-zinc-500" title="tugas selesai" />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-zinc-500 mt-1 flex flex-wrap gap-x-3"><span><b className="text-sky-400">■</b> memo bertanggal</span><span><b className="text-lime-400">■</b> tugas</span><span><b className="text-red-400">■</b> tugas terlambat</span></p>

      <div className="mt-3">
        <h3 className="text-[14px] font-bold text-white border-b-2 border-white/15 pb-1 mb-1">{W.formatPanjang(pilih)}</h3>
        {!isiHari && <p className="text-[13px] text-zinc-500 py-3">Tidak ada memo atau tugas pada tanggal ini.</p>}
        {isiHari?.memo.map((m) => (
          <button key={m.id} type="button" onClick={() => onBukaMemo(m)} className="w-full text-left flex items-center gap-2 px-2 py-1.5 border-b border-white/10 hover:bg-white/[0.04]">
            <FileText size={13} className="text-sky-300 shrink-0" />
            <span className={`text-[14px] font-bold truncate ${m.judul ? 'text-white' : 'text-zinc-500 italic'}`}>{m.judul || 'Tanpa judul'}</span>
            {m.penulis && <span className="text-[12px] text-zinc-400 ml-auto shrink-0">{m.penulis.split(' ')[0]}</span>}
          </button>
        ))}
        {isiHari?.tugas.slice().sort(urutTugas).map((t) => {
          const m = peta.get(t.memoId);
          return (
            <BarisTugas
              key={`${t.memoId}:${t.indeks}`}
              t={t}
              memo={m}
              tim={tim}
              bolehUbah={m ? bolehUbah(m, t) : false}
              onCentang={() => m && onCentang(m, t.indeks)}
              onBuka={() => m && onBukaMemo(m)}
            />
          );
        })}
      </div>
    </div>
  );
};
