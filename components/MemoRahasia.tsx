import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, X, Check, Plus, Search, Lock, AlertTriangle } from 'lucide-react';
import type { AnggotaRingkas, Pengguna } from '../lib/tipe-api';
import type { Memo } from '../types';
import { cuplikanMemo, izinMemo } from '../server/src/memo-blok';
import { AvatarAnggota } from './AvatarAnggota';
import { bacaProps } from './PropertiMemo';
import { layarAman } from '../lib/widget';

/**
 * Memo Rahasia: hanya pembuat dan orang yang dituju (semuanya bisa menyunting).
 * Tidak bisa dibagikan lewat tautan, tidak diproses AI, tidak bisa diunduh/diekspor,
 * tangkapan layar diblokir di APK, dan isinya disandikan di server.
 */

/** Pilih orang yang dituju memo rahasia. */
export const PilihOrangRahasia: React.FC<{
  tim: AnggotaRingkas[]; pengguna: Pengguna; awal?: string[]; judul?: string; tombol?: string;
  onSimpan: (ids: string[]) => void; onTutup: () => void;
}> = ({ tim, pengguna, awal = [], judul = 'Memo rahasia baru', tombol = 'Buat memo rahasia', onSimpan, onTutup }) => {
  const [pilih, setPilih] = useState<string[]>(awal);
  const [cari, setCari] = useState('');
  const daftar = tim.filter((t) => t.id !== pengguna.id && (!cari || t.nama.toLowerCase().includes(cari.toLowerCase())));
  const alih = (id: string) => setPilih((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <div className="fixed inset-0 z-[140] bg-black/85 flex items-end sm:items-center justify-center sm:p-4" onClick={onTutup}>
      <div className="retro-box !bg-zinc-900 border-amber-500 w-full sm:max-w-md max-h-[90vh] flex flex-col !p-3 gap-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b-2 border-white/20 pb-2">
          <ShieldCheck size={17} className="text-amber-300" />
          <h3 className="judul-layar text-amber-200 mr-auto">{judul}</h3>
          <button onClick={onTutup} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup"><X size={15} /></button>
        </div>
        <p className="text-[12px] text-zinc-300 leading-relaxed">
          Pilih siapa yang boleh membuka memo ini. <b className="text-white">Semua yang dituju bisa menyunting</b> — seperti Anda.
          Admin dan Supervisor pun tidak bisa melihat bila tidak dipilih.
        </p>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama…" className="input-retro !pl-8 !py-1.5 !text-[13px]" />
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar border-2 border-white/10 min-h-[160px]">
          {daftar.map((t) => {
            const ya = pilih.includes(t.id);
            return (
              <button key={t.id} type="button" onClick={() => alih(t.id)} className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] border-b border-white/5 ${ya ? 'bg-amber-500/15' : 'hover:bg-white/5'}`}>
                <span className={`w-5 h-5 border-2 flex items-center justify-center shrink-0 ${ya ? 'bg-amber-500 border-amber-300 text-black' : 'border-white/40'}`}>{ya && <Check size={13} />}</span>
                <AvatarAnggota foto={t.foto} ukuran={26} />
                <span className="flex-1 truncate text-zinc-100">{t.nama}</span>
                <span className="text-[11px] text-zinc-500">{t.jabatan ?? t.peran}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-zinc-500">{pilih.length} orang dituju · Anda selalu bisa membuka memo milik Anda.</p>
        <button onClick={() => onSimpan(pilih)} className="btn-retro bg-amber-600 text-black font-bold w-full flex items-center justify-center gap-2">
          <Lock size={14} /> {tombol}
        </button>
      </div>
    </div>
  );
};

/** Barisan avatar orang yang dituju memo rahasia. */
export const AvatarIzin: React.FC<{ memo: Memo; tim: AnggotaRingkas[]; maks?: number }> = ({ memo, tim, maks = 5 }) => {
  const ids = [memo.user_id ?? '', ...izinMemo(memo.izin)].filter(Boolean);
  return (
    <span className="inline-flex items-center -space-x-1.5">
      {ids.slice(0, maks).map((id) => {
        const t = tim.find((x) => x.id === id);
        return <span key={id} title={t?.nama ?? id}><AvatarAnggota foto={t?.foto} ukuran={22} className="ring-2 ring-zinc-900" /></span>;
      })}
      {ids.length > maks && <span className="text-[11px] text-zinc-400 pl-2">+{ids.length - maks}</span>}
    </span>
  );
};

/** Tab "Memo Rahasia" di papan memo. */
export const PapanRahasia: React.FC<{
  daftar: Memo[]; memuat: boolean; sandi: boolean | null; tim: AnggotaRingkas[]; pengguna: Pengguna;
  onBuka: (id: string) => void; onBuat: (izin: string[]) => void;
}> = ({ daftar, memuat, sandi, tim, pengguna, onBuka, onBuat }) => {
  const [pilihBuka, setPilihBuka] = useState(false);
  const urut = useMemo(() => [...daftar].filter((m) => !m.induk_id)
    .sort((a, b) => Number(Boolean(b.disematkan || b.sematan_saya)) - Number(Boolean(a.disematkan || a.sematan_saya))
      || String(b.diubah_pada ?? b.dibuat_pada).localeCompare(String(a.diubah_pada ?? a.dibuat_pada))), [daftar]);
  return (
    <div className="h-full overflow-auto custom-scrollbar">
      <div className="panel-retro !p-3 border-amber-500/60 bg-amber-950/20 mb-3 text-[12px] text-zinc-200 leading-relaxed">
        <p className="font-bold text-amber-200 flex items-center gap-1.5 mb-1"><ShieldCheck size={14} /> Memo Rahasia</p>
        Hanya Anda dan orang yang Anda tuju yang bisa membuka dan menyunting — contoh: rencana anggaran tahun depan untuk satu rekan.
        Tidak bisa dibagikan lewat tautan, tidak diproses AI, tidak bisa diunduh, tangkapan layar diblokir di aplikasi HP, dan isinya disandikan di server.
        {sandi === false && (
          <p className="mt-1.5 text-amber-300 flex items-start gap-1.5"><AlertTriangle size={13} className="shrink-0 mt-0.5" /> Kunci sandi server belum dipasang — memo tetap terbatas aksesnya, tetapi isinya belum disandikan. Minta pengelola menjalankan <code>wrangler secret put KUNCI_RAHASIA_MEMO</code>.</p>
        )}
      </div>
      <button onClick={() => setPilihBuka(true)} className="btn-retro btn-retro-sm bg-amber-600 text-black font-bold flex items-center gap-1.5 mb-3"><Plus size={13} /> Memo rahasia baru</button>
      {memuat && <p className="text-[13px] text-zinc-400 py-6 text-center">Memuat…</p>}
      {!memuat && urut.length === 0 && <p className="text-[13px] text-zinc-500 py-6 text-center">Belum ada memo rahasia untuk Anda.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {urut.map((m) => {
          const ikon = bacaProps(m).ikon;
          return (
            <button key={m.id} onClick={() => onBuka(m.id)} className="retro-box !p-3 !bg-zinc-900/80 border-amber-500/50 text-left hover:border-amber-300 flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-[14px] font-bold text-white">
                {typeof ikon === 'string' && ikon ? <span>{ikon}</span> : <Lock size={13} className="text-amber-300" />}
                <span className="truncate flex-1">{m.judul || 'Tanpa judul'}</span>
              </span>
              <span className="text-[12px] text-zinc-400 line-clamp-2 min-h-[2.4em]">{cuplikanMemo(m.isi) || 'Kosong'}</span>
              <span className="flex items-center gap-2 text-[11px] text-zinc-500">
                <AvatarIzin memo={m} tim={tim} />
                <span className="ml-auto">{m.user_id === pengguna.id ? 'Milik Anda' : `dari ${m.penulis ?? '—'}`}</span>
              </span>
            </button>
          );
        })}
      </div>
      {pilihBuka && <PilihOrangRahasia tim={tim} pengguna={pengguna} onTutup={() => setPilihBuka(false)} onSimpan={(ids) => { setPilihBuka(false); onBuat(ids); }} />}
    </div>
  );
};

/** Selama memo rahasia terbuka: blokir tangkapan layar (APK) dan beri watermark nama pembaca. */
export function useLayarAman(aktif: boolean): void {
  useEffect(() => {
    if (!aktif) return;
    void layarAman(true);
    return () => { void layarAman(false); };
  }, [aktif]);
}

export const WatermarkRahasia: React.FC<{ nama: string }> = ({ nama }) => {
  const teks = `RAHASIA · ${nama} · ${new Date().toLocaleDateString('id-ID')}`;
  return (
    <div className="pointer-events-none fixed inset-0 z-[101] overflow-hidden select-none" aria-hidden="true">
      <div className="absolute -inset-1/2 flex flex-wrap content-start gap-x-24 gap-y-20 rotate-[-24deg] opacity-[0.06]">
        {Array.from({ length: 80 }, (_, i) => <span key={i} className="text-[15px] font-bold whitespace-nowrap text-current">{teks}</span>)}
      </div>
    </div>
  );
};
