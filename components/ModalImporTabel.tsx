/**
 * Modal Impor Berkas Excel (.xlsx, .xls) & CSV (.csv) ke Tabel Memo.
 *
 * Mendukung drag-and-drop berkas spreadsheet, pratinjau data instan,
 * pengaturan baris judul & grafik otomatis, serta prompt cerdas siap pakai.
 */

import React, { useState, useId } from 'react';
import {
  Upload,
  FileSpreadsheet,
  X,
  Check,
  Copy,
  Info,
  BarChart3,
  Sparkles,
  Loader2,
  Table as TableIcon,
} from 'lucide-react';
import { bacaBerkasTabel } from '../lib/impor-tabel';

interface Props {
  onTutup: () => void;
  onSisipkan: (baris: string[][], kepala: boolean, denganGrafik: boolean) => void;
}

export const ModalImporTabel: React.FC<Props> = ({ onTutup, onSisipkan }) => {
  const [tab, setTab] = useState<'berkas' | 'panduan'>('berkas');
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [namaBerkas, setNamaBerkas] = useState<string | null>(null);
  const [matriksData, setMatriksData] = useState<string[][] | null>(null);

  const [kepala, setKepala] = useState(true);
  const [denganGrafik, setDenganGrafik] = useState(true);
  const [tersalin, setTersalin] = useState(false);

  const inputId = useId();

  const prosesFile = async (file: File) => {
    setMemuat(true);
    setGalat(null);
    try {
      const hasil = await bacaBerkasTabel(file);
      if (hasil.baris.length === 0) {
        throw new Error('Berkas tidak memuat baris data yang dapat diuraikan.');
      }
      setNamaBerkas(hasil.nama);
      setMatriksData(hasil.baris);
    } catch (err: any) {
      setGalat(err?.message || 'Gagal membaca berkas spreadsheet.');
      setMatriksData(null);
    } finally {
      setMemuat(false);
    }
  };

  const onPilihBerkas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) prosesFile(file);
  };

  const onDropBerkas = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) prosesFile(file);
  };

  const salinTeks = (teks: string) => {
    navigator.clipboard.writeText(teks);
    setTersalin(true);
    setTimeout(() => setTersalin(false), 2000);
  };

  const PROMPT_TEMPLATE = `Buatkan tabel Excel dengan struktur kolom berikut:
1. Hari (H-01 s/d H-30)
2. Fase (Minggu 1 Fondasi, Minggu 2 Implementasi, Minggu 3 Lanjutan, Minggu 4 Evaluasi)
3. Topik / Materi Pembelajaran
4. Status (isi dengan "Belum" atau "✓ Selesai")
5. Kumulatif (rumus running total dari jumlah hari yang sudah selesai)

Setelah selesai, saya akan copy-paste langsung ke memo POKEMONKEY untuk memunculkan checklist otomatis dan grafik progres live.`;

  return (
    <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-zinc-950 border-2 border-lime-500/50 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl rounded-sm overflow-hidden text-zinc-100 text-[13px]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-lime-500/20 border border-lime-500/50 flex items-center justify-center text-lime-400">
              <FileSpreadsheet size={16} />
            </div>
            <div>
              <h3 className="font-bold text-[14px] text-white">Impor Spreadsheet ke Tabel Memo</h3>
              <p className="text-[11px] text-zinc-400">Mendukung berkas Excel (.xlsx, .xls) dan CSV (.csv)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onTutup}
            className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 rounded-sm"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-white/10 bg-black/30 px-3">
          <button
            type="button"
            onClick={() => setTab('berkas')}
            className={`py-2 px-3 text-[12px] font-bold border-b-2 flex items-center gap-1.5 ${
              tab === 'berkas'
                ? 'border-lime-400 text-lime-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload size={13} />
            <span>Unggah Berkas</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('panduan')}
            className={`py-2 px-3 text-[12px] font-bold border-b-2 flex items-center gap-1.5 ${
              tab === 'panduan'
                ? 'border-lime-400 text-lime-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles size={13} />
            <span>Prompt & Panduan Cara</span>
          </button>
        </div>

        {/* Isi Modal */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {tab === 'berkas' ? (
            <>
              {/* Area Drag and Drop */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropBerkas}
                className={`border-2 border-dashed rounded-sm p-6 text-center transition-all ${
                  matriksData
                    ? 'border-lime-500/60 bg-lime-950/20'
                    : 'border-white/20 hover:border-lime-400/60 bg-white/[0.02]'
                }`}
              >
                <input
                  type="file"
                  id={inputId}
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  onChange={onPilihBerkas}
                  className="hidden"
                />
                <label
                  htmlFor={inputId}
                  className="cursor-pointer flex flex-col items-center justify-center gap-2"
                >
                  {memuat ? (
                    <div className="flex flex-col items-center gap-2 py-4 text-lime-300">
                      <Loader2 size={28} className="animate-spin text-lime-400" />
                      <span className="font-bold">Membaca berkas spreadsheet…</span>
                    </div>
                  ) : matriksData ? (
                    <div className="flex flex-col items-center gap-1 text-zinc-200">
                      <div className="w-10 h-10 rounded-full bg-emerald-950/80 border border-emerald-400 flex items-center justify-center text-emerald-300 mb-1">
                        <Check size={20} />
                      </div>
                      <span className="font-bold text-[14px] text-white">{namaBerkas}</span>
                      <span className="text-[12px] text-lime-300">
                        ✓ Berhasil diurai: {matriksData.length} baris × {matriksData[0]?.length || 0} kolom
                      </span>
                      <span className="text-[11px] text-zinc-500 mt-1 underline">
                        Klik untuk mengganti berkas lain
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-lime-500/10 border border-lime-500/30 flex items-center justify-center text-lime-400 mb-1">
                        <Upload size={22} />
                      </div>
                      <span className="font-bold text-[13px] text-zinc-200">
                        Klik untuk memilih berkas atau seret berkas ke sini
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Format didukung: Microsoft Excel (<strong>.xlsx</strong>, <strong>.xls</strong>) atau <strong>.csv</strong>
                      </span>
                    </>
                  )}
                </label>
              </div>

              {galat && (
                <div className="p-2.5 bg-red-950/40 border border-red-500/50 text-red-200 text-[12px] rounded-xs flex items-center gap-2">
                  <X size={15} className="text-red-400 shrink-0" />
                  <span>{galat}</span>
                </div>
              )}

              {/* Pratinjau Tabel Jika Data Sudah Terbaca */}
              {matriksData && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[12px] text-zinc-300 flex items-center gap-1.5">
                      <TableIcon size={14} className="text-lime-400" />
                      Pratinjau Data (5 Baris Pertama):
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Total: {matriksData.length} baris
                    </span>
                  </div>

                  <div className="overflow-x-auto custom-scrollbar border border-white/15 rounded-xs max-h-48 bg-black/60">
                    <table className="w-full border-collapse text-[11px]">
                      <tbody>
                        {matriksData.slice(0, 5).map((row, rIdx) => (
                          <tr key={rIdx} className={kepala && rIdx === 0 ? 'bg-white/10 font-bold text-white' : 'border-b border-white/5'}>
                            {row.map((col, cIdx) => (
                              <td
                                key={cIdx}
                                className="px-2.5 py-1.5 border-r border-white/10 max-w-[180px] truncate"
                                title={col}
                              >
                                {col || <span className="text-zinc-600">—</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pengaturan Tambahan */}
                  <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xs space-y-2">
                    <span className="font-bold text-[12px] text-zinc-300 block mb-1">
                      Opsi Sisipkan:
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-200 text-[12px]">
                      <input
                        type="checkbox"
                        checked={kepala}
                        onChange={(e) => setKepala(e.target.checked)}
                        className="accent-lime-500 w-3.5 h-3.5"
                      />
                      <span>Baris pertama dijadikan Judul Kolom (Header)</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-zinc-200 text-[12px]">
                      <input
                        type="checkbox"
                        checked={denganGrafik}
                        onChange={(e) => setDenganGrafik(e.target.checked)}
                        className="accent-lime-500 w-3.5 h-3.5"
                      />
                      <span className="flex items-center gap-1">
                        <BarChart3 size={12} className="text-lime-400" />
                        Otomatis buatkan Grafik visual terkoneksi langsung
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Tab Panduan & Prompt */
            <div className="space-y-4">
              <div className="p-3 bg-lime-950/30 border border-lime-500/40 rounded-xs text-[12px] space-y-2">
                <span className="font-bold text-lime-300 flex items-center gap-1.5">
                  <Info size={14} />
                  Dua Cara Cepat Memasukkan Data Excel ke Memo:
                </span>
                <div className="space-y-2 text-zinc-300 pl-1 text-[11px] leading-relaxed">
                  <div>
                    <strong className="text-white block">Cara 1 (Copy-Paste Langsung):</strong>
                    Buka file Excel $\rightarrow$ Seleksi rentang tabel $\rightarrow$ Tekan <strong>Ctrl+C</strong> $\rightarrow$ Buka memo Anda $\rightarrow$ Tekan <strong>Ctrl+V</strong>. Tabel otomatis terbentuk tanpa ada teks yang terpotong.
                  </div>
                  <div>
                    <strong className="text-white block">Cara 2 (Impor File .xlsx / .csv):</strong>
                    Gunakan tab <strong>Unggah Berkas</strong> di modal ini $\rightarrow$ Pilih file dari laptop $\rightarrow$ Tekan <strong>Sisipkan Tabel</strong>.
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[12px] text-zinc-200">
                    Template Prompt untuk AI / Pembuatan Excel:
                  </span>
                  <button
                    type="button"
                    onClick={() => salinTeks(PROMPT_TEMPLATE)}
                    className="flex items-center gap-1 text-[11px] font-bold text-lime-300 hover:text-white bg-lime-950/60 border border-lime-500/40 px-2 py-0.5 rounded-xs"
                  >
                    {tersalin ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{tersalin ? 'Tersalin!' : 'Salin Prompt'}</span>
                  </button>
                </div>
                <pre className="p-3 bg-black/60 border border-white/10 rounded-xs font-mono text-[11px] text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {PROMPT_TEMPLATE}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Tombol Aksi */}
        <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-t border-white/10">
          <button
            type="button"
            onClick={onTutup}
            className="px-3 py-1.5 border border-white/20 text-zinc-300 hover:text-white rounded-xs text-[12px]"
          >
            Batal
          </button>

          {tab === 'berkas' && matriksData && (
            <button
              type="button"
              onClick={() => {
                onSisipkan(matriksData, kepala, denganGrafik);
                onTutup();
              }}
              className="px-4 py-1.5 bg-lime-600 hover:bg-lime-500 text-black font-bold rounded-xs text-[12px] flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <TableIcon size={14} />
              <span>Sisipkan Tabel ke Memo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
