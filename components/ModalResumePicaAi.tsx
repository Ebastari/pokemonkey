import React, { useState, useEffect } from 'react';
import {
  Sparkles, X, Copy, Check, RefreshCw, AlertTriangle, CheckCircle2,
  TrendingUp, ListChecks, MessageSquare, Loader2,
} from 'lucide-react';
import type { PicaItem } from '../lib/tipe-api';
import { resumePicaAi, type ResumePicaAi } from '../lib/gemini';

interface Props {
  daftarPica: PicaItem[];
  periodeNama?: string;
  onTutup: () => void;
  notify: (pesan: string) => void;
}

export const ModalResumePicaAi: React.FC<Props> = ({
  daftarPica,
  periodeNama,
  onTutup,
  notify,
}) => {
  const [resume, setResume] = useState<ResumePicaAi | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [disalin, setDisalin] = useState(false);

  const statistik = {
    total: daftarPica.length,
    terbuka: daftarPica.filter((p) => p.status !== 'Closed').length,
    selesai: daftarPica.filter((p) => p.status === 'Closed').length,
    telat: daftarPica.filter((p) => (p.sisa_hari ?? 1) < 0 && p.status !== 'Closed').length,
  };

  const muatResume = async () => {
    if (daftarPica.length === 0) {
      setGalat('Tidak ada data PICA untuk dianalisis.');
      setMemuat(false);
      return;
    }
    setMemuat(true);
    setGalat(null);
    try {
      const hasil = await resumePicaAi({
        pica: daftarPica,
        periode: periodeNama,
      });
      setResume(hasil);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menghasilkan resume AI.');
    } finally {
      setMemuat(false);
    }
  };

  useEffect(() => {
    muatResume();
  }, []);

  const salinTeks = () => {
    if (!resume) return;
    const teks = resume.teks_wa || `${resume.judul}\n\n${resume.ringkasan_umum}`;
    navigator.clipboard.writeText(teks);
    setDisalin(true);
    notify('RESUME BERHASIL DISALIN KE CLIPBOARD');
    setTimeout(() => setDisalin(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 md:p-4" onClick={onTutup}>
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
                Resume Eksekutif PICA <span className="text-[11px] text-purple-300 font-mono">AI Gemini</span>
              </h3>
              <p className="text-[10px] text-zinc-400 uppercase">
                Sintesis temuan, analisis pola kendala, dan rekomendasi perbaikan operasional
              </p>
            </div>
          </div>
          <button onClick={onTutup} className="text-zinc-400 hover:text-white shrink-0 p-1" title="Tutup">
            <X size={20} />
          </button>
        </div>

        {/* Ringkasan Angka Cepat */}
        <div className="grid grid-cols-4 gap-2 shrink-0">
          <div className="panel-retro !p-2 text-center bg-black/40">
            <p className="text-[9px] text-zinc-400 uppercase">Total PICA</p>
            <p className="text-[14px] font-bold text-white font-mono">{statistik.total}</p>
          </div>
          <div className="panel-retro !p-2 text-center bg-amber-950/40 border-amber-600/50">
            <p className="text-[9px] text-amber-300 uppercase">Terbuka</p>
            <p className="text-[14px] font-bold text-amber-300 font-mono">{statistik.terbuka}</p>
          </div>
          <div className="panel-retro !p-2 text-center bg-emerald-950/40 border-emerald-600/50">
            <p className="text-[9px] text-emerald-300 uppercase">Selesai</p>
            <p className="text-[14px] font-bold text-emerald-400 font-mono">{statistik.selesai}</p>
          </div>
          <div className={`panel-retro !p-2 text-center ${statistik.telat > 0 ? 'bg-red-950/60 border-red-500 animate-pulse' : 'bg-black/40'}`}>
            <p className="text-[9px] text-red-300 uppercase">Telat / Overdue</p>
            <p className="text-[14px] font-bold text-red-400 font-mono">{statistik.telat}</p>
          </div>
        </div>

        {/* Konten Utama */}
        <div className="flex-1 overflow-auto custom-scrollbar space-y-3 pr-1">
          {memuat && (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-purple-400" />
              <p className="text-[13px] text-purple-200 font-bold uppercase tracking-wider animate-pulse">
                Sedang Menganalisis Register PICA dengan Gemini AI…
              </p>
              <p className="text-[11px] text-zinc-400 max-w-sm">
                Membaca akar masalah, menghitung keterlambatan, dan merumuskan langkah korektif terbaik.
              </p>
            </div>
          )}

          {galat && !memuat && (
            <div className="p-3 bg-red-950/60 border-2 border-red-500 text-red-200 text-[12px] space-y-2">
              <p className="font-bold">Gagal Membuat Resume:</p>
              <p className="font-mono text-[11px]">{galat}</p>
              <button onClick={muatResume} className="btn-retro btn-retro-sm bg-zinc-800 text-white flex items-center gap-1">
                <RefreshCw size={13} /> Coba Lagi
              </button>
            </div>
          )}

          {resume && !memuat && (
            <div className="space-y-3 text-[12px]">
              {/* Narasi Ringkasan Umum */}
              <div className="bg-purple-950/30 border border-purple-500/40 p-3 rounded-sm">
                <p className="text-[11px] font-bold text-purple-300 uppercase mb-1 flex items-center gap-1.5">
                  <TrendingUp size={14} /> Situasi & Tren Operasional
                </p>
                <p className="text-zinc-200 leading-relaxed">{resume.ringkasan_umum}</p>
              </div>

              {/* Isu Kritis */}
              {resume.isu_kritis && resume.isu_kritis.length > 0 && (
                <div className="bg-red-950/30 border border-red-500/40 p-3 rounded-sm">
                  <p className="text-[11px] font-bold text-red-300 uppercase mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Isu Kritis / Kendala Utama Memerlukan Atensi
                  </p>
                  <ul className="space-y-1.5">
                    {resume.isu_kritis.map((kritis, i) => (
                      <li key={i} className="flex items-start gap-2 text-red-100">
                        <span className="text-red-400 font-bold shrink-0">•</span>
                        <span>{kritis}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Analisis Pola Akar Masalah */}
              {resume.analisis_pola && (
                <div className="bg-zinc-800/60 border border-white/20 p-3 rounded-sm">
                  <p className="text-[11px] font-bold text-amber-300 uppercase mb-1 flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Pola Akar Masalah Dominan
                  </p>
                  <p className="text-zinc-300 leading-relaxed">{resume.analisis_pola}</p>
                </div>
              )}

              {/* Rekomendasi Tindakan Strategis */}
              {resume.rekomendasi && resume.rekomendasi.length > 0 && (
                <div className="bg-emerald-950/30 border border-emerald-500/40 p-3 rounded-sm">
                  <p className="text-[11px] font-bold text-emerald-300 uppercase mb-2 flex items-center gap-1.5">
                    <ListChecks size={14} /> Rekomendasi Tindakan Korektif & Preventif
                  </p>
                  <ul className="space-y-1.5">
                    {resume.rekomendasi.map((rek, i) => (
                      <li key={i} className="flex items-start gap-2 text-emerald-100">
                        <span className="text-emerald-400 font-bold font-mono shrink-0">{i + 1}.</span>
                        <span>{rek}</span>
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
          <button
            onClick={muatResume}
            disabled={memuat}
            className="btn-retro btn-retro-sm bg-zinc-800 text-zinc-300 flex items-center gap-1.5"
            title="Muat ulang analisis AI"
          >
            <RefreshCw size={13} className={memuat ? 'animate-spin' : ''} />
            <span>Analisis Ulang</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={salinTeks}
              disabled={!resume || memuat}
              className="btn-retro btn-retro-sm bg-gradient-to-r from-emerald-700 to-teal-700 text-white font-bold flex items-center gap-1.5"
              title="Salin ringkasan lengkap untuk pesan WhatsApp atau rapat"
            >
              {disalin ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
              <span>{disalin ? 'Tersalin!' : 'Salin untuk WA / Rapat'}</span>
            </button>
            <button onClick={onTutup} className="btn-retro btn-retro-sm bg-zinc-700">
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
