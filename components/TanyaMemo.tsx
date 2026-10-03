import React, { useMemo, useState } from 'react';
import { FileText, Loader2, Lock, Search, Sparkles, Users, X } from 'lucide-react';
import { tanyaMemoAi, type JawabanTanyaAi } from '../lib/gemini';
import type { AnggotaRingkas } from '../lib/tipe-api';
import type { Memo } from '../types';
import { IsiMemo } from './MemoMarkup';

/**
 * Tanya semua memo (AI): pertanyaan bebas dijawab HANYA dari memo yang boleh
 * dibaca penanya (memo tim + catatan pribadinya), dengan sumber yang bisa
 * diketuk untuk membuka memonya. Lihat server/src/ai-memo.ts ruteTanyaMemo.
 */

const CONTOH = ['Kapan terakhir servis genset?', 'Apa keputusan rapat koordinasi terakhir?', 'Tugas apa yang masih terbuka untuk nursery?', 'Rangkum catatan K3 bulan ini'];

export const TanyaMemo: React.FC<{
  memo: Memo[]; tim: AnggotaRingkas[];
  onBuka: (id: string) => void; onTutup: () => void;
}> = ({ memo, tim, onBuka, onTutup }) => {
  const [pertanyaan, setPertanyaan] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [hasil, setHasil] = useState<(JawabanTanyaAi & { tanya: string }) | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  // Judul terkini memo untuk chip sumber di jawaban.
  const peta = useMemo(() => new Map(memo.map((m) => [m.id, { judul: m.judul }])), [memo]);

  const tanya = async (q = pertanyaan) => {
    const t = q.trim();
    if (!t || memuat) return;
    setMemuat(true);
    setGalat(null);
    try {
      setHasil({ ...(await tanyaMemoAi(t)), tanya: t });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menjawab.');
    } finally {
      setMemuat(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/85 flex items-stretch sm:items-center justify-center sm:p-4" onClick={onTutup}>
      <div className="retro-box !bg-zinc-900 w-full max-w-2xl border-purple-500 flex flex-col max-h-full sm:max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Tanya semua memo">
        <div className="flex items-center gap-2 border-b-2 border-purple-500/40 pb-2 shrink-0">
          <span className="p-1.5 bg-purple-700 border border-purple-400"><Sparkles size={16} className="text-yellow-300" /></span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-bold text-white uppercase">Tanya semua memo</h3>
            <p className="text-[11px] text-zinc-400 truncate">AI menjawab hanya dari memo yang boleh Anda baca, lengkap dengan sumbernya.</p>
          </div>
          <button type="button" onClick={onTutup} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup"><X size={15} /></button>
        </div>

        <div className="pt-3 space-y-2 shrink-0">
          <div className="flex gap-1.5">
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                autoFocus
                value={pertanyaan}
                onChange={(e) => setPertanyaan(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void tanya(); } }}
                placeholder="mis. Kapan terakhir servis genset?"
                className="input-retro !pl-8 !py-2 !text-[14px]"
                aria-label="Pertanyaan"
              />
            </div>
            <button type="button" onClick={() => { void tanya(); }} disabled={memuat || !pertanyaan.trim()} className="btn-retro !bg-purple-700 text-white font-bold flex items-center gap-1.5 disabled:opacity-60">
              {memuat ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Tanya
            </button>
          </div>
          {!hasil && !memuat && (
            <div className="flex flex-wrap gap-1">
              {CONTOH.map((c) => <button key={c} type="button" onClick={() => { setPertanyaan(c); void tanya(c); }} className="px-2 py-0.5 border border-white/15 text-[11px] text-zinc-300 hover:border-purple-400">{c}</button>)}
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-3">
          {memuat && <p className="text-[13px] text-zinc-300 flex items-center gap-2 py-6 justify-center"><Loader2 size={14} className="animate-spin" /> Mencari di memo & menyusun jawaban…</p>}
          {galat && <p className="text-[12px] text-red-300 border-2 border-red-500/50 bg-red-950/40 px-2 py-1.5">{galat}</p>}
          {hasil && !memuat && (
            <div className="space-y-3">
              <p className="text-[12px] text-zinc-500">“{hasil.tanya}”{hasil.kata?.length ? ` · kata kunci: ${hasil.kata.join(', ')}` : ''}</p>
              <div className="border-2 border-purple-500/40 bg-black/30 px-3 py-2 text-[14px] leading-[1.55]">
                <IsiMemo isi={hasil.jawaban} tim={tim} halaman={peta} onBukaHalaman={onBuka} />
              </div>
              <p className={`text-[11px] ${hasil.yakin === 'tinggi' ? 'text-lime-300' : hasil.yakin === 'rendah' ? 'text-amber-300' : 'text-zinc-400'}`}>
                Keyakinan AI: {hasil.yakin}{hasil.yakin !== 'tinggi' ? ' — periksa memo sumbernya.' : ''}{hasil.model ? ` · ${hasil.model}` : ''}
              </p>
              {hasil.sumber.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase text-zinc-500 mb-1">Sumber</p>
                  <div className="space-y-1">
                    {hasil.sumber.map((s) => (
                      <button key={s.id} type="button" onClick={() => onBuka(s.id)} className="w-full flex items-center gap-2 px-2 py-1.5 border-2 border-white/10 hover:border-purple-400 text-left">
                        <FileText size={14} className="text-zinc-400 shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-[13px] text-zinc-100 font-bold">{s.judul}</span>
                        <span className="text-[11px] text-zinc-500 shrink-0 flex items-center gap-1">{s.lingkup === 'tim' ? <Users size={11} /> : <Lock size={11} />}{s.tanggal}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
