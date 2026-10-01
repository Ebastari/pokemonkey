import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Loader2, Lock, RotateCcw, Search, Trash2, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import type { AnggotaRingkas } from '../lib/tipe-api';
import type { MemoSampah } from '../types';
import { IsiMemo } from './MemoMarkup';
import { bacaProps } from './PropertiMemo';

/**
 * Sampah memo, seperti Trash di Notion: memo yang dihapus (beserta sub-halamannya)
 * menunggu di sini selama 30 hari. Bisa dicari, dibuka untuk dibaca, dipulihkan ke
 * tempat semula, atau dihapus permanen. Hanya memo yang boleh dihapus pengguna ini
 * (pembuat, Admin, Supervisor; catatan pribadi hanya pemiliknya) yang tampil.
 */

const ikonDari = (m: MemoSampah) => {
  const v = bacaProps(m).ikon;
  return typeof v === 'string' && v ? v : '';
};

function berapaLama(iso: string): string {
  const menit = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.round(jam / 24)} hari lalu`;
}

const sisaHari = (iso: string, batas: number) => Math.max(0, batas - Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

type Saring = 'semua' | 'tim' | 'pribadi';

export const SampahMemo: React.FC<{
  tim: AnggotaRingkas[];
  notify: (m: string) => void;
  /** Memo dipulihkan: muat ulang daftar; `buka` = langsung buka halamannya. */
  onPulih: (id: string, buka: boolean) => void;
}> = ({ tim, notify, onPulih }) => {
  const [daftar, setDaftar] = useState<MemoSampah[]>([]);
  const [hari, setHari] = useState(30);
  const [memuat, setMemuat] = useState(true);
  const [cari, setCari] = useState('');
  const [saring, setSaring] = useState<Saring>('semua');
  const [lihat, setLihat] = useState<MemoSampah | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      const d = await api<{ memo: MemoSampah[]; hari: number }>('/api/memo/sampah');
      setDaftar(d.memo);
      setHari(d.hari);
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT SAMPAH');
    } finally {
      setMemuat(false);
    }
  }, [notify]);
  useEffect(() => { void muat(); }, [muat]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return daftar.filter((m) => (saring === 'semua' || m.lingkup === saring)
      && (!q || `${m.judul} ${m.isi} ${m.ringkasan ?? ''}`.toLowerCase().includes(q)));
  }, [daftar, cari, saring]);

  const pulihkan = async (m: MemoSampah, buka = false) => {
    setSibuk(m.id);
    try {
      const h = await api<{ jumlah: number; induk_id: string | null }>(`/api/memo/${m.id}/pulihkan`, { method: 'POST' });
      setDaftar((d) => d.filter((x) => x.id !== m.id));
      setLihat(null);
      // Induknya sudah tidak ada: halaman kembali sebagai halaman teratas.
      const pindah = m.induk_id && !h.induk_id ? ' — KEMBALI SEBAGAI HALAMAN TERATAS' : '';
      notify(`DIPULIHKAN${h.jumlah > 1 ? ` (${h.jumlah} HALAMAN)` : ''}${pindah}`);
      onPulih(m.id, buka);
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMULIHKAN');
    } finally {
      setSibuk(null);
    }
  };

  const hapusPermanen = async (m: MemoSampah) => {
    const anak = m.jumlah_anak ? ` beserta ${m.jumlah_anak} sub-halaman` : '';
    if (!confirm(`Hapus permanen "${m.judul || 'Tanpa judul'}"${anak}?\nGambar dan berkasnya ikut terhapus. Tindakan ini tidak bisa dibatalkan.`)) return;
    setSibuk(m.id);
    try {
      await api(`/api/memo/${m.id}/permanen`, { method: 'DELETE' });
      setDaftar((d) => d.filter((x) => x.id !== m.id));
      setLihat(null);
      notify('DIHAPUS PERMANEN');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGHAPUS');
    } finally {
      setSibuk(null);
    }
  };

  const tombolAksi = (m: MemoSampah, besar = false) => (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void pulihkan(m, besar); }}
        disabled={sibuk === m.id}
        className={besar ? 'btn-retro btn-retro-sm !bg-lime-600 flex items-center gap-1.5' : 'btn-ikon !w-8 !h-8 bg-zinc-800 hover:!bg-lime-700'}
        title="Pulihkan"
        aria-label={`Pulihkan ${m.judul || 'Tanpa judul'}`}
      >
        {sibuk === m.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}{besar && ' Pulihkan halaman'}
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); void hapusPermanen(m); }}
        disabled={sibuk === m.id}
        className={besar ? 'btn-retro btn-retro-sm !bg-red-700 flex items-center gap-1.5' : 'btn-ikon !w-8 !h-8 bg-zinc-800 hover:!bg-red-800'}
        title="Hapus permanen"
        aria-label={`Hapus permanen ${m.judul || 'Tanpa judul'}`}
      >
        <Trash2 size={14} />{besar && ' Hapus permanen'}
      </button>
    </>
  );

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 mb-2">
        <p className="text-[12px] text-zinc-400 mb-2 flex items-center gap-1.5">
          <Trash2 size={13} className="shrink-0" /> Memo yang dihapus menunggu di sini {hari} hari, lalu dihapus permanen otomatis. Sub-halaman ikut dipulihkan bersama induknya.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari di Sampah…" className="input-retro !pl-8 !py-1.5 !text-[13px]" aria-label="Cari di Sampah" />
          </div>
          <div className="flex gap-1" role="radiogroup" aria-label="Saring Sampah">
            {([['semua', 'Semua'], ['tim', 'Memo Internal'], ['pribadi', 'Pribadi']] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={saring === k}
                onClick={() => setSaring(k)}
                className={`px-2 py-1 border-2 text-[12px] font-bold ${saring === k ? 'border-lime-400 bg-lime-600/30 text-white' : 'border-white/15 text-zinc-400 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {memuat && <p className="text-[13px] text-zinc-400 flex items-center gap-2 py-8 justify-center"><Loader2 size={14} className="animate-spin" /> Memuat…</p>}
        {!memuat && tampil.length === 0 && (
          <div className="py-12 text-center text-zinc-500">
            <Trash2 size={28} className="mx-auto mb-2 opacity-60" />
            <p className="text-[13px]">{daftar.length ? 'Tidak ada yang cocok.' : 'Sampah kosong.'}</p>
          </div>
        )}
        <ul className="space-y-1.5">
          {tampil.map((m) => {
            const ikon = ikonDari(m);
            return (
              <li key={m.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setLihat(m)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setLihat(m); }}
                  className="flex items-center gap-3 px-3 py-2 border-2 border-white/15 bg-zinc-900 hover:border-white/40 cursor-pointer"
                >
                  <span className="w-6 shrink-0 flex justify-center text-[18px] leading-none">{ikon || <FileText size={16} className="text-zinc-500" />}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-bold truncate ${m.judul ? 'text-white' : 'text-zinc-500 italic'}`}>{m.judul || 'Tanpa judul'}</p>
                    <p className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-x-2">
                      <span className="inline-flex items-center gap-1">{m.lingkup === 'tim' ? <Users size={11} /> : <Lock size={11} />}{m.lingkup === 'tim' ? 'Memo Internal' : 'Pribadi'}{m.induk_judul !== null && m.induk_id ? ` / ${m.induk_judul || 'Tanpa judul'}` : ''}</span>
                      {m.jumlah_anak > 0 && <span>+{m.jumlah_anak} sub-halaman</span>}
                      <span>dihapus {berapaLama(m.dihapus_pada)}{m.penghapus ? ` oleh ${m.penghapus}` : ''}</span>
                      <span className="text-amber-300/80">sisa {sisaHari(m.dihapus_pada, hari)} hari</span>
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">{tombolAksi(m)}</div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Membaca halaman di Sampah: hanya-baca dengan pita merah, seperti Notion. */}
      {lihat && (
        <div className="fixed inset-0 z-[110] bg-black/70 flex items-stretch sm:items-center justify-center sm:p-6" role="dialog" aria-modal="true" aria-label={lihat.judul || 'Tanpa judul'} onClick={() => setLihat(null)}>
          <div className="w-full sm:max-w-[760px] max-h-full flex flex-col bg-zinc-950 border-0 sm:border-4 border-white shadow-[6px_6px_0_#000]" onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 bg-red-900/80 border-b-2 border-red-400">
              <Trash2 size={15} className="text-red-200 shrink-0" />
              <span className="text-[13px] font-bold text-red-50 flex-1 min-w-[160px]">Halaman ini ada di Sampah.</span>
              {tombolAksi(lihat, true)}
              <button type="button" onClick={() => setLihat(null)} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-10 py-6 text-[16px] leading-[1.5]">
              {ikonDari(lihat) && <div className="text-[48px] leading-none mb-2">{ikonDari(lihat)}</div>}
              <h1 className="text-[28px] sm:text-[34px] font-bold leading-tight text-white mb-4">{lihat.judul || 'Tanpa judul'}</h1>
              <IsiMemo isi={lihat.isi} tim={tim} kosong="Halaman ini kosong." />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
