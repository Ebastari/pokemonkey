import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Heart, X } from 'lucide-react';
import { api } from '../lib/api';
import type { AnggotaRingkas } from '../lib/tipe-api';
import { AvatarAnggota } from './AvatarAnggota';

/**
 * Tombol "Dilihat oleh" dan "Suka" di kepala halaman memo. Membuka halaman dicatat
 * sekali per pembukaan; daftar siapa saja yang melihat/menyukai tampil saat diketuk.
 */

interface Sosial {
  suka: { user_id: string; nama: string | null; pada: string }[];
  dilihat: { user_id: string; nama: string | null; pertama: string; terakhir: string; kali: number }[];
  saya_suka: boolean;
}

const waktu = (iso: string) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const SosialMemo: React.FC<{ memoId: string; idSaya: string; tim: AnggotaRingkas[]; terang?: boolean; notify: (m: string) => void }> = ({ memoId, idSaya, tim, terang, notify }) => {
  const [data, setData] = useState<Sosial | null>(null);
  const [buka, setBuka] = useState<null | 'lihat' | 'suka'>(null);

  const muat = useCallback(() => {
    api<Sosial>(`/api/memo/${memoId}/sosial`).then(setData).catch(() => undefined);
  }, [memoId]);
  useEffect(() => {
    api(`/api/memo/${memoId}/lihat`, { method: 'POST', body: {} }).catch(() => undefined).finally(muat);
  }, [memoId, muat]);

  const suka = async () => {
    try {
      const d = await api<{ suka: boolean; jumlah: number }>(`/api/memo/${memoId}/suka`, { method: 'POST', body: {} });
      if (d.suka) notify('ANDA MENYUKAI MEMO INI');
      muat();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };

  const kelasTombol = `relative btn-ikon !w-9 !h-9 shrink-0 ${terang ? '!bg-zinc-100 hover:!bg-zinc-200 !text-zinc-800 !border-zinc-300' : 'bg-zinc-800'}`;
  const orangLain = data?.dilihat.filter((d) => d.user_id !== idSaya) ?? [];
  const foto = (id: string) => tim.find((t) => t.id === id)?.foto;

  return (
    <span className="relative inline-flex gap-1.5">
      <button type="button" onClick={() => setBuka(buka === 'lihat' ? null : 'lihat')} className={kelasTombol} title="Dilihat oleh" aria-label={`Dilihat oleh ${orangLain.length} orang`}>
        <Eye size={16} />
        {orangLain.length > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-sky-400 text-black text-[10px] font-bold flex items-center justify-center">{orangLain.length}</span>}
      </button>
      <button
        type="button"
        onClick={suka}
        onContextMenu={(e) => { e.preventDefault(); setBuka('suka'); }}
        className={`${kelasTombol} ${data?.saya_suka ? '!bg-pink-600 !text-white !border-pink-300' : ''}`}
        title="Suka (tekan lama / klik kanan: siapa saja)"
        aria-pressed={Boolean(data?.saya_suka)}
        aria-label={`Suka (${data?.suka.length ?? 0})`}
      >
        <Heart size={16} className={data?.saya_suka ? 'fill-white' : ''} />
        {(data?.suka.length ?? 0) > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-pink-400 text-black text-[10px] font-bold flex items-center justify-center">{data!.suka.length}</span>}
      </button>

      {buka && data && (
        <>
          <span className="fixed inset-0 z-20" onClick={() => setBuka(null)} aria-hidden="true" />
          <div className="absolute right-0 top-full mt-1 z-30 retro-box !bg-zinc-900 border-sky-500 !p-2 w-72 max-h-80 overflow-auto custom-scrollbar text-white">
            <div className="flex items-center gap-1 mb-1.5">
              <button onClick={() => setBuka('lihat')} className={`btn-retro btn-retro-sm !py-0.5 ${buka === 'lihat' ? 'bg-sky-600' : 'bg-zinc-800'}`}><Eye size={11} /> Dilihat {orangLain.length}</button>
              <button onClick={() => setBuka('suka')} className={`btn-retro btn-retro-sm !py-0.5 ${buka === 'suka' ? 'bg-pink-600' : 'bg-zinc-800'}`}><Heart size={11} /> Suka {data.suka.length}</button>
              <button onClick={() => setBuka(null)} className="ml-auto text-zinc-400 hover:text-white" aria-label="Tutup"><X size={14} /></button>
            </div>
            {buka === 'lihat' && (
              orangLain.length === 0 ? <p className="text-[12px] text-zinc-400 px-1 py-2">Belum ada orang lain yang membuka memo ini.</p> : (
                <ul className="space-y-1">
                  {orangLain.map((d) => (
                    <li key={d.user_id} className="flex items-center gap-2 text-[12px]">
                      <AvatarAnggota foto={foto(d.user_id)} ukuran={24} />
                      <span className="flex-1 min-w-0 leading-tight"><b className="block truncate">{d.nama ?? d.user_id}</b><span className="text-[10px] text-zinc-400">terakhir {waktu(d.terakhir)} · {d.kali}×</span></span>
                    </li>
                  ))}
                </ul>
              )
            )}
            {buka === 'suka' && (
              data.suka.length === 0 ? <p className="text-[12px] text-zinc-400 px-1 py-2">Belum ada yang menyukai.</p> : (
                <ul className="space-y-1">
                  {data.suka.map((d) => (
                    <li key={d.user_id} className="flex items-center gap-2 text-[12px]">
                      <AvatarAnggota foto={foto(d.user_id)} ukuran={24} />
                      <span className="flex-1 truncate">{d.nama ?? d.user_id}</span>
                      <span className="text-[10px] text-zinc-400">{waktu(d.pada)}</span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </>
      )}
    </span>
  );
};
