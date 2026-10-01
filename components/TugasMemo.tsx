import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, Lock, Users } from 'lucide-react';
import type { Memo } from '../types';
import type { AnggotaRingkas } from '../lib/tipe-api';
import { kelompokDari, kumpulkanTugas, urutTugas, URUT_KELOMPOK, type KelompokTugas, type TugasLintas } from '../lib/memo-tugas';
import * as W from '../lib/waktu';
import { ChipTenggat } from './MemoMarkup';

/**
 * Tugas: semua ceklis dari memo tim dan memo pribadi, dikelompokkan menurut
 * tenggat. Mencentang di sini mengubah baris ceklis di memo asalnya.
 */

export interface PropsTugas {
  /** Memo tim + memo pribadi milik pemakai. */
  memos: Memo[];
  tim: AnggotaRingkas[];
  idSaya: string;
  /** Boleh mengubah memo ini (penulis, atau Supervisor/Admin untuk memo tim). */
  bolehUbah: (m: Memo, t?: TugasLintas) => boolean;
  onCentang: (memo: Memo, indeksBaris: number) => void;
  onBukaMemo: (memo: Memo) => void;
}

export const BarisTugas: React.FC<{
  t: TugasLintas; memo: Memo | undefined; tim: AnggotaRingkas[]; bolehUbah: boolean;
  onCentang: () => void; onBuka: () => void; tampilkanMemo?: boolean;
}> = ({ t, memo, tim, bolehUbah, onCentang, onBuka, tampilkanMemo = true }) => {
  const nama = t.penanggung ? tim.find((x) => x.id === t.penanggung)?.nama.split(' ')[0] : null;
  return (
    <div className="flex items-start gap-2 px-2 py-1.5 border-b border-white/10 hover:bg-white/[0.04]">
      <input
        type="checkbox"
        checked={t.selesai}
        onChange={onCentang}
        disabled={!bolehUbah}
        className="mt-1 accent-lime-500 w-4 h-4 shrink-0"
        aria-label={`Selesaikan: ${t.judul}`}
        title={bolehUbah ? undefined : 'Memo ini diatur "Baca saja"; hanya tugas yang menyebut Anda yang bisa dicentang'}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-[14px] leading-snug ${t.selesai ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>{t.judul}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          {t.tanggal && <ChipTenggat tanggal={t.tanggal} jam={t.jam} selesai={t.selesai} />}
          {tampilkanMemo && memo && (
            <button type="button" onClick={onBuka} className="text-[12px] text-zinc-400 hover:text-white underline-offset-2 hover:underline truncate max-w-[220px] flex items-center gap-1">
              {t.lingkup === 'pribadi' ? <Lock size={10} /> : <Users size={10} />}{t.judulMemo || 'Tanpa judul'}
            </button>
          )}
          {nama && t.lingkup === 'tim' && <span className="text-[12px] text-lime-300">@{nama}</span>}
        </div>
      </div>
    </div>
  );
};

export const TugasMemo: React.FC<PropsTugas> = ({ memos, tim, idSaya, bolehUbah, onCentang, onBukaMemo }) => {
  const [semua, setSemua] = useState(false);
  const [tutup, setTutup] = useState<Record<string, boolean>>({ selesai: true });
  const hariIni = W.hariIniWita();

  const peta = useMemo(() => new Map(memos.map((m) => [m.id, m])), [memos]);
  const idTim = useMemo(() => new Set(tim.map((t) => t.id)), [tim]);
  const semuaTugas = useMemo(() => kumpulkanTugas(memos, idTim), [memos, idTim]);
  const tampil = useMemo(
    () => semuaTugas.filter((t) => semua || t.penanggung === idSaya).sort(urutTugas),
    [semuaTugas, semua, idSaya],
  );

  const kelompok = useMemo(() => {
    const k: Record<KelompokTugas, TugasLintas[]> = { terlambat: [], hariIni: [], mendatang: [], tanpaTenggat: [], selesai: [] };
    for (const t of tampil) k[kelompokDari(t, hariIni)].push(t);
    return k;
  }, [tampil, hariIni]);

  const belum = tampil.filter((t) => !t.selesai).length;

  return (
    <div data-gambar-lepas className="h-full overflow-y-auto custom-scrollbar pr-1">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[13px] text-zinc-300 flex items-center gap-1.5"><ListChecks size={14} className="text-lime-300" /> {belum} tugas belum selesai</span>
        <div className="ml-auto flex border-2 border-white/25">
          {([[false, 'Tugas saya'], [true, 'Semua orang']] as const).map(([v, l]) => (
            <button key={l} type="button" onClick={() => setSemua(v)} className={`px-2.5 py-1 text-[12px] font-bold ${semua === v ? 'bg-lime-600 text-white' : 'text-zinc-400 hover:text-white'}`}>{l}</button>
          ))}
        </div>
      </div>

      {tampil.length === 0 && (
        <div className="text-center py-10 text-[13px] text-zinc-400 space-y-1">
          <p>Belum ada tugas{semua ? '' : ' untuk Anda'}.</p>
          <p className="text-zinc-500">Tulis <b className="text-zinc-300">- [ ] tugas @2026-10-05</b> di memo mana pun, atau pilih <b className="text-zinc-300">Ceklis</b> di bilah alat.</p>
        </div>
      )}

      {URUT_KELOMPOK.map(({ id, label }) => {
        const isi = kelompok[id];
        if (isi.length === 0) return null;
        const terlipat = Boolean(tutup[id]);
        const warna = id === 'terlambat' ? 'text-red-300 border-red-400/60' : id === 'hariIni' ? 'text-amber-200 border-amber-400/60' : id === 'selesai' ? 'text-zinc-500 border-white/15' : 'text-zinc-100 border-white/25';
        return (
          <section key={id} className="mb-3">
            <button type="button" onClick={() => setTutup({ ...tutup, [id]: !terlipat })} className={`w-full flex items-center gap-1.5 border-b-2 pb-1 mb-0.5 text-left ${warna}`} aria-expanded={!terlipat}>
              {terlipat ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              <span className="text-[14px] font-bold">{label}</span>
              <span className="text-[12px] text-zinc-400">{isi.length}</span>
            </button>
            {!terlipat && isi.map((t) => {
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
          </section>
        );
      })}
    </div>
  );
};
