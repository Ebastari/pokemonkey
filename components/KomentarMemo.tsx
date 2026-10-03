import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, CornerDownRight, Loader2, MessageSquare, Pencil, Quote, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';

/**
 * Komentar memo seperti Notion: komentar pada teks terpilih (kutipan) atau pada
 * halaman, dengan balasan, tanda "selesai", ubah, dan hapus. Siapa pun yang
 * bisa membaca memo boleh berkomentar — teks memonya sendiri tidak berubah.
 */

export interface Komentar {
  id: string; memo_id: string; induk_id: string | null; user_id: string; nama: string | null;
  kutipan: string | null; isi: string; selesai: number; dibuat_pada: string; diubah_pada: string | null;
}

function berapaLama(iso: string): string {
  const menit = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} mnt lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return `${Math.round(jam / 24)} hari lalu`;
}

export const KomentarMemo: React.FC<{
  memoId: string; idSaya: string;
  /** Akses penuh memo: boleh menghapus komentar siapa pun. */
  penuh: boolean;
  /** Bisa mengedit memo: boleh menandai komentar siapa pun selesai. */
  boleh: boolean;
  buka: boolean; onTutup: () => void;
  /** Kutipan baru dari bilah format (teks yang dipilih); null = komentar halaman. */
  kutipan: string | null; onKutipanTerpakai: () => void;
  /** Gulir ke teks yang dikomentari. */
  onLihat: (kutipan: string) => void;
  onJumlah: (n: number) => void;
  notify: (m: string) => void;
}> = ({ memoId, idSaya, penuh, boleh, buka, onTutup, kutipan, onKutipanTerpakai, onLihat, onJumlah, notify }) => {
  const [daftar, setDaftar] = useState<Komentar[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [teks, setTeks] = useState('');
  const [balas, setBalas] = useState<string | null>(null);
  const [teksBalas, setTeksBalas] = useState('');
  const [ubah, setUbah] = useState<string | null>(null);
  const [teksUbah, setTeksUbah] = useState('');
  const [lihatSelesai, setLihatSelesai] = useState(false);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(async () => {
    try {
      const d = await api<{ komentar: Komentar[] }>(`/api/memo/${memoId}/komentar`);
      setDaftar(d.komentar);
    } catch { /* tanpa sinyal: tampilkan yang terakhir */ } finally { setMemuat(false); }
  }, [memoId]);
  useEffect(() => {
    void muat();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void muat(); }, 30_000);
    return () => clearInterval(t);
  }, [muat]);

  const utas = useMemo(() => {
    const atas = daftar.filter((k) => !k.induk_id);
    return atas.map((k) => ({ k, balasan: daftar.filter((b) => b.induk_id === k.id) }));
  }, [daftar]);
  const terbuka = utas.filter((u) => !u.k.selesai);
  useEffect(() => { onJumlah(terbuka.length); }, [terbuka.length, onJumlah]);

  const kirim = async (isi: string, induk?: string) => {
    if (!isi.trim()) return;
    setSibuk(true);
    try {
      const k = await api<Komentar>(`/api/memo/${memoId}/komentar`, { body: { isi, induk_id: induk, kutipan: induk ? undefined : kutipan ?? undefined } });
      setDaftar((d) => [...d, k]);
      if (induk) { setBalas(null); setTeksBalas(''); } else { setTeks(''); onKutipanTerpakai(); }
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGIRIM KOMENTAR'); } finally { setSibuk(false); }
  };
  const tandaiSelesai = async (k: Komentar) => {
    const selesai = k.selesai ? 0 : 1;
    setDaftar((d) => d.map((x) => (x.id === k.id || x.induk_id === k.id ? { ...x, selesai } : x)));
    try { await api(`/api/memo/${memoId}/komentar/${k.id}`, { method: 'PATCH', body: { selesai: Boolean(selesai) } }); } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); void muat(); }
  };
  const simpanUbah = async (k: Komentar) => {
    const isi = teksUbah.trim();
    if (!isi) return;
    setDaftar((d) => d.map((x) => (x.id === k.id ? { ...x, isi, diubah_pada: new Date().toISOString() } : x)));
    setUbah(null);
    try { await api(`/api/memo/${memoId}/komentar/${k.id}`, { method: 'PATCH', body: { isi } }); } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); void muat(); }
  };
  const hapus = async (k: Komentar) => {
    if (!confirm('Hapus komentar ini beserta balasannya?')) return;
    setDaftar((d) => d.filter((x) => x.id !== k.id && x.induk_id !== k.id));
    try { await api(`/api/memo/${memoId}/komentar/${k.id}`, { method: 'DELETE' }); } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); void muat(); }
  };

  if (!buka) return null;

  const satu = (k: Komentar, atas: boolean) => (
    <div key={k.id} className={atas ? '' : 'mt-2 pl-3 border-l-2 border-white/10'}>
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-bold text-zinc-100 truncate">{k.nama ?? k.user_id}</span>
        <span className="text-[11px] text-zinc-500 whitespace-nowrap">{berapaLama(k.dibuat_pada)}{k.diubah_pada ? ' · diubah' : ''}</span>
        <span className="ml-auto flex gap-0.5 shrink-0">
          {atas && (k.user_id === idSaya || boleh) && (
            <button type="button" onClick={() => { void tandaiSelesai(k); }} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-lime-300" title={k.selesai ? 'Buka lagi' : 'Tandai selesai'}>{k.selesai ? <RotateCcw size={12} /> : <Check size={13} />}</button>
          )}
          {k.user_id === idSaya && <button type="button" onClick={() => { setUbah(k.id); setTeksUbah(k.isi); }} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white" title="Ubah"><Pencil size={12} /></button>}
          {(k.user_id === idSaya || penuh) && <button type="button" onClick={() => { void hapus(k); }} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-red-300" title="Hapus"><Trash2 size={12} /></button>}
        </span>
      </div>
      {ubah === k.id ? (
        <div className="mt-1 space-y-1">
          <textarea autoFocus value={teksUbah} onChange={(e) => setTeksUbah(e.target.value)} rows={2} className="input-retro !py-1 !text-[13px] resize-none" aria-label="Ubah komentar" />
          <div className="flex gap-1">
            <button type="button" onClick={() => { void simpanUbah(k); }} className="btn-retro btn-retro-sm bg-lime-600">Simpan</button>
            <button type="button" onClick={() => setUbah(null)} className="btn-retro btn-retro-sm bg-zinc-800">Batal</button>
          </div>
        </div>
      ) : <p className="text-[13px] text-zinc-200 whitespace-pre-wrap break-words mt-0.5">{k.isi}</p>}
    </div>
  );

  return (
    <aside className="fixed z-[115] inset-x-0 bottom-0 max-h-[75vh] sm:inset-auto sm:right-0 sm:top-12 sm:bottom-0 sm:max-h-none sm:w-[340px] flex flex-col bg-zinc-900 border-t-2 sm:border-t-0 sm:border-l-2 border-white/15 shadow-[0_-4px_0_#000] sm:shadow-[-4px_0_0_#000]" aria-label="Komentar">
      <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b-2 border-white/10">
        <MessageSquare size={15} className="text-lime-300" />
        <span className="font-bold text-[14px] text-white flex-1">Komentar</span>
        <label className="flex items-center gap-1 text-[11px] text-zinc-400 cursor-pointer">
          <input type="checkbox" checked={lihatSelesai} onChange={(e) => setLihatSelesai(e.target.checked)} className="accent-lime-500" /> Selesai
        </label>
        <button type="button" onClick={onTutup} className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10" aria-label="Tutup komentar"><X size={16} /></button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-2 space-y-3">
        {memuat && <p className="text-[12px] text-zinc-500 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Memuat…</p>}
        {!memuat && (lihatSelesai ? utas : terbuka).length === 0 && (
          <p className="text-[12px] text-zinc-500 py-4 text-center">Belum ada komentar. Pilih teks lalu ketuk 💬, atau tulis komentar untuk halaman ini di bawah.</p>
        )}
        {(lihatSelesai ? utas : terbuka).map(({ k, balasan }) => (
          <div key={k.id} className={`border-2 p-2 ${k.selesai ? 'border-white/10 opacity-60' : 'border-white/15'} bg-black/20`}>
            {k.kutipan && (
              <button type="button" onClick={() => onLihat(k.kutipan!)} className="w-full text-left mb-1.5 pl-2 border-l-2 border-amber-400/70 text-[12px] text-amber-100/90 italic line-clamp-2 hover:bg-white/5" title="Lihat di memo">
                {k.kutipan}
              </button>
            )}
            {satu(k, true)}
            {balasan.map((b) => satu(b, false))}
            {balas === k.id ? (
              <div className="mt-2 flex gap-1">
                <input autoFocus value={teksBalas} onChange={(e) => setTeksBalas(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void kirim(teksBalas, k.id); } if (e.key === 'Escape') setBalas(null); }} placeholder="Balas…" className="input-retro !py-1 !text-[13px] flex-1 min-w-0" aria-label="Balas komentar" />
                <button type="button" disabled={sibuk} onClick={() => { void kirim(teksBalas, k.id); }} className="btn-ikon !w-8 !h-8 bg-lime-600" aria-label="Kirim balasan"><Send size={13} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => { setBalas(k.id); setTeksBalas(''); }} className="mt-1.5 flex items-center gap-1 text-[12px] text-zinc-400 hover:text-white"><CornerDownRight size={12} /> Balas</button>
            )}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t-2 border-white/10 p-2 space-y-1.5">
        {kutipan && (
          <div className="flex items-start gap-1.5 pl-2 border-l-2 border-amber-400/70 text-[12px] text-amber-100/90 italic">
            <Quote size={11} className="mt-0.5 shrink-0" /><span className="line-clamp-2 flex-1">{kutipan}</span>
            <button type="button" onClick={onKutipanTerpakai} className="text-zinc-500 hover:text-white" aria-label="Lepas kutipan"><X size={12} /></button>
          </div>
        )}
        <div className="flex gap-1">
          <textarea value={teks} onChange={(e) => setTeks(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void kirim(teks); } }} rows={2} placeholder={kutipan ? 'Komentari teks ini…' : 'Komentar untuk halaman ini…'} className="input-retro !py-1 !text-[13px] flex-1 min-w-0 resize-none" aria-label="Tulis komentar" />
          <button type="button" disabled={sibuk || !teks.trim()} onClick={() => { void kirim(teks); }} className="btn-ikon !w-9 !h-auto bg-lime-600 disabled:opacity-50" aria-label="Kirim komentar">{sibuk ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}</button>
        </div>
      </div>
    </aside>
  );
};
