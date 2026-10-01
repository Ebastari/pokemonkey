import React, { useState } from 'react';
import {
  Sparkles, X, Check, Copy, Loader2, FileText, CheckSquare,
  AlignLeft, RefreshCw, PenTool, Lightbulb,
} from 'lucide-react';
import { prosesMemoAi, type HasilMemoAi } from '../lib/gemini';

interface Props {
  judulAwal: string;
  isiAwal: string;
  kategori?: string;
  onTerapkan: (hasil: HasilMemoAi) => void;
  onTutup: () => void;
  notify: (pesan: string) => void;
}

type ModeAi = 'kembangkan' | 'rapikan' | 'ringkas' | 'ekstrak_tugas';

export const ModalAiMemo: React.FC<Props> = ({
  judulAwal,
  isiAwal,
  kategori,
  onTerapkan,
  onTutup,
  notify,
}) => {
  const [mode, setMode] = useState<ModeAi>('kembangkan');
  const [instruksi, setInstruksi] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [hasil, setHasil] = useState<HasilMemoAi | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [disalin, setDisalin] = useState(false);

  const prosesAi = async (modeTerpilih = mode) => {
    if (!isiAwal.trim() && !judulAwal.trim()) {
      setGalat('Memo masih kosong. Tulis judul atau beberapa poin terlebih dahulu.');
      return;
    }
    setMemuat(true);
    setGalat(null);
    try {
      const res = await prosesMemoAi({
        mode: modeTerpilih,
        judul: judulAwal,
        isi: isiAwal,
        kategori,
        instruksi_khusus: instruksi.trim() || undefined,
      });
      setHasil(res);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memproses dengan Gemini AI.');
    } finally {
      setMemuat(false);
    }
  };

  const salinTeks = () => {
    if (!hasil) return;
    const teks = hasil.isi || hasil.ringkasan || (hasil.tugas ? hasil.tugas.join('\n') : '');
    navigator.clipboard.writeText(teks);
    setDisalin(true);
    notify('HASIL AI DISALIN KE CLIPBOARD');
    setTimeout(() => setDisalin(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 md:p-4" onClick={onTutup}>
      <div
        className="retro-box !bg-zinc-900 w-full max-w-3xl border-purple-500 flex flex-col gap-3 max-h-[92vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex justify-between items-center border-b-2 border-purple-500/40 pb-2.5 px-1 shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-gradient-to-r from-purple-700 to-indigo-700 border border-purple-400 rounded-sm">
              <Sparkles size={16} className="text-yellow-300 animate-pulse" />
            </span>
            <div>
              <h3 className="text-[14px] font-bold text-white flex items-center gap-1.5 uppercase">
                Asisten Menulis Memo <span className="text-[11px] text-purple-300 font-mono">Gemini AI</span>
              </h3>
              <p className="text-[10px] text-zinc-400 uppercase">
                Kembangkan draf kasar, rapikan tata bahasa, ringkas, atau ekstrak daftar tugas
              </p>
            </div>
          </div>
          <button onClick={onTutup} className="text-zinc-400 hover:text-white shrink-0 p-1" title="Tutup">
            <X size={20} />
          </button>
        </div>

        {/* Pilihan Mode */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => { setMode('kembangkan'); setHasil(null); }}
            className={`p-2 border-2 text-left rounded-sm transition-all flex flex-col gap-1 ${
              mode === 'kembangkan'
                ? 'bg-purple-950/80 border-purple-400 text-white'
                : 'bg-black/40 border-white/20 text-zinc-400 hover:border-white/50'
            }`}
          >
            <span className="flex items-center gap-1 text-[11px] font-bold">
              <PenTool size={13} className="text-purple-300" /> Kembangkan
            </span>
            <span className="text-[9.5px] leading-tight text-zinc-300">Poin kasar jadi memo kerja resmi</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('rapikan'); setHasil(null); }}
            className={`p-2 border-2 text-left rounded-sm transition-all flex flex-col gap-1 ${
              mode === 'rapikan'
                ? 'bg-purple-950/80 border-purple-400 text-white'
                : 'bg-black/40 border-white/20 text-zinc-400 hover:border-white/50'
            }`}
          >
            <span className="flex items-center gap-1 text-[11px] font-bold">
              <Sparkles size={13} className="text-yellow-300" /> Rapikan
            </span>
            <span className="text-[9.5px] leading-tight text-zinc-300">Perbaiki bahasa & heading</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('ringkas'); setHasil(null); }}
            className={`p-2 border-2 text-left rounded-sm transition-all flex flex-col gap-1 ${
              mode === 'ringkas'
                ? 'bg-purple-950/80 border-purple-400 text-white'
                : 'bg-black/40 border-white/20 text-zinc-400 hover:border-white/50'
            }`}
          >
            <span className="flex items-center gap-1 text-[11px] font-bold">
              <AlignLeft size={13} className="text-cyan-300" /> Ringkas
            </span>
            <span className="text-[9.5px] leading-tight text-zinc-300">Eksekutif summary 2-3 kalimat</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('ekstrak_tugas'); setHasil(null); }}
            className={`p-2 border-2 text-left rounded-sm transition-all flex flex-col gap-1 ${
              mode === 'ekstrak_tugas'
                ? 'bg-purple-950/80 border-purple-400 text-white'
                : 'bg-black/40 border-white/20 text-zinc-400 hover:border-white/50'
            }`}
          >
            <span className="flex items-center gap-1 text-[11px] font-bold">
              <CheckSquare size={13} className="text-emerald-300" /> Ekstrak Tugas
            </span>
            <span className="text-[9.5px] leading-tight text-zinc-300">Otomatis buat ceklis tindak lanjut</span>
          </button>
        </div>

        {/* Input Instruksi Tambahan (Opsional) */}
        <div className="flex gap-2 items-center shrink-0">
          <input
            type="text"
            value={instruksi}
            onChange={(e) => setInstruksi(e.target.value)}
            placeholder="Instruksi tambahan (opsional, misal: 'Gunakan nada resmi', 'Fokus tim bibitan')…"
            className="input-retro flex-1 !py-1.5 !text-[12px]"
          />
          <button
            type="button"
            onClick={() => prosesAi()}
            disabled={memuat}
            className="btn-retro btn-retro-sm bg-gradient-to-r from-purple-700 via-indigo-700 to-sky-700 hover:brightness-110 text-white font-bold flex items-center gap-1.5 shrink-0"
          >
            {memuat ? <Loader2 size={13} className="animate-spin text-yellow-300" /> : <Sparkles size={13} className="text-yellow-300" />}
            <span>{memuat ? 'Memproses…' : 'Mulai Proses AI'}</span>
          </button>
        </div>

        {/* Area Tampilan Hasil */}
        <div className="flex-1 overflow-auto custom-scrollbar border-2 border-white/20 bg-black/60 p-3 rounded-sm min-h-[220px]">
          {memuat && (
            <div className="h-full flex flex-col items-center justify-center gap-2.5 py-12">
              <Loader2 size={28} className="animate-spin text-purple-400" />
              <p className="text-[13px] text-purple-200 font-bold uppercase animate-pulse">
                Sedang Memproses dengan Gemini AI…
              </p>
              <p className="text-[11px] text-zinc-400">
                Menyusun struktur dokumen resmi dan menyelaraskan kalimat.
              </p>
            </div>
          )}

          {galat && !memuat && (
            <div className="p-3 bg-red-950/60 border border-red-500 text-red-200 text-[12px] space-y-1.5">
              <p className="font-bold">Gagal Memproses:</p>
              <p className="font-mono text-[11px]">{galat}</p>
            </div>
          )}

          {!hasil && !memuat && !galat && (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
              <FileText size={32} className="mb-2 text-zinc-600" />
              <p className="text-[13px] font-bold text-zinc-400 uppercase mb-1">
                Pilih Mode dan Klik "Mulai Proses AI"
              </p>
              <p className="text-[11px] text-zinc-500 max-w-md">
                Gemini AI akan membaca judul dan catatan memo saat ini, lalu menyusun rekomendasi draf yang bisa langsung Anda terapkan.
              </p>
            </div>
          )}

          {hasil && !memuat && (
            <div className="space-y-3 text-[12px]">
              {hasil.catatan_ai && (
                <div className="bg-purple-950/40 border border-purple-500/40 p-2.5 rounded text-[11px] text-purple-200 flex items-start gap-2">
                  <Lightbulb size={14} className="text-yellow-300 shrink-0 mt-0.5" />
                  <span>{hasil.catatan_ai}</span>
                </div>
              )}

              {hasil.judul && hasil.judul !== judulAwal && (
                <div className="bg-zinc-800/80 p-2 border border-white/20 rounded">
                  <span className="text-[10px] text-yellow-300 uppercase font-bold block mb-0.5">Saran Judul Memo:</span>
                  <p className="text-white font-bold text-[13px]">{hasil.judul}</p>
                </div>
              )}

              {hasil.ringkasan && (
                <div className="bg-cyan-950/30 p-2.5 border border-cyan-500/40 rounded">
                  <span className="text-[10px] text-cyan-300 uppercase font-bold block mb-0.5">Ringkasan Eksekutif:</span>
                  <p className="text-zinc-200 leading-relaxed">{hasil.ringkasan}</p>
                </div>
              )}

              {hasil.isi && (
                <div className="bg-black/50 p-3 border border-white/10 rounded">
                  <span className="text-[10px] text-zinc-400 uppercase font-bold block mb-1">Draf Teks Lengkap:</span>
                  <pre className="text-zinc-100 font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-[260px] overflow-auto custom-scrollbar">
                    {hasil.isi}
                  </pre>
                </div>
              )}

              {hasil.tugas && hasil.tugas.length > 0 && (
                <div className="bg-emerald-950/30 p-2.5 border border-emerald-500/40 rounded">
                  <span className="text-[10px] text-emerald-300 uppercase font-bold block mb-1.5">Daftar Tugas / Ceklis Tindak Lanjut:</span>
                  <ul className="space-y-1">
                    {hasil.tugas.map((t, idx) => (
                      <li key={idx} className="text-emerald-100 font-mono text-[11px] flex items-center gap-1.5">
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Tombol Aksi */}
        <div className="border-t-2 border-white/10 pt-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex gap-2">
            {hasil && (
              <button
                type="button"
                onClick={salinTeks}
                className="btn-retro btn-retro-sm bg-zinc-800 text-zinc-200 flex items-center gap-1.5"
                title="Salin hasil ke clipboard"
              >
                {disalin ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
                <span>{disalin ? 'Tersalin!' : 'Salin'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => prosesAi()}
              disabled={memuat}
              className="btn-retro btn-retro-sm bg-zinc-800 text-zinc-300 flex items-center gap-1"
              title="Proses ulang"
            >
              <RefreshCw size={13} className={memuat ? 'animate-spin' : ''} />
              <span>Proses Ulang</span>
            </button>
          </div>

          <div className="flex gap-2">
            {hasil && (
              <button
                type="button"
                onClick={() => onTerapkan(hasil)}
                className="btn-retro btn-retro-sm bg-gradient-to-r from-emerald-700 to-teal-700 text-white font-bold flex items-center gap-1.5"
              >
                <Check size={14} /> Terapkan ke Memo Ini
              </button>
            )}
            <button type="button" onClick={onTutup} className="btn-retro btn-retro-sm bg-zinc-700">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
