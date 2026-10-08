/**
 * Modal "Habit" (menu "/" → Habit): lacak atau ubah kebiasaan seseorang selama 1 bulan.
 *
 * Empat cara mengisi, hasilnya sama — tabel harian + grafik progres:
 * 1. Buat langsung: satu kebiasaan, tanggal mulai, lama (7–31 hari).
 * 2. Contoh CSV: salin/unduh, ubah di Excel, lalu unggah.
 * 3. Prompt AI: salin ke ChatGPT/Gemini; jawabannya (CSV) ditempel di tab Unggah.
 * 4. Unggah/tempel CSV atau Excel: kolom dicocokkan menurut judul, kumulatif dihitung ulang.
 */

import React, { useMemo, useState } from 'react';
import { CalendarCheck, Copy, Download, FileUp, Sparkles, Table2, X } from 'lucide-react';
import { KEPALA_HABIT, LAMA_HABIT, barisHabitDariBerkas, buatBarisHabit, contohCsvHabit, promptHabit, rakitHabit, tanggalHariIni } from '../lib/habit';
import { bacaBerkasTabel, uraiCsvKeMatriks } from '../lib/impor-tabel';
import { simpanBerkas } from '../lib/unduh';

type Tab = 'langsung' | 'contoh' | 'prompt' | 'unggah';

const TAB: { id: Tab; label: string; ikon: typeof Copy }[] = [
  { id: 'langsung', label: 'Buat langsung', ikon: CalendarCheck },
  { id: 'contoh', label: 'Contoh CSV', ikon: Table2 },
  { id: 'prompt', label: 'Prompt AI', ikon: Sparkles },
  { id: 'unggah', label: 'Unggah / tempel', ikon: FileUp },
];

export const ModalHabit: React.FC<{ onTutup: () => void; onSisipkan: (raw: string) => void }> = ({ onTutup, onSisipkan }) => {
  const [tab, setTab] = useState<Tab>('langsung');
  const [kebiasaan, setKebiasaan] = useState('');
  const [mulai, setMulai] = useState(tanggalHariIni);
  const [lama, setLama] = useState(30);
  const [teks, setTeks] = useState('');
  const [hasil, setHasil] = useState<{ baris: string[][]; peringatan: string[]; sumber: string } | null>(null);
  const [pesan, setPesan] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const contoh = useMemo(() => contohCsvHabit(mulai), [mulai]);
  const prompt = useMemo(() => promptHabit(kebiasaan, mulai, lama), [kebiasaan, mulai, lama]);
  const pratinjau = tab === 'langsung' ? buatBarisHabit(kebiasaan, mulai, lama) : hasil?.baris ?? null;

  const salin = async (isi: string, label: string) => {
    try { await navigator.clipboard.writeText(isi); setPesan(`${label} tersalin.`); } catch { setPesan('Papan klip ditolak — pilih teks lalu salin manual.'); }
  };
  const proses = (matriks: string[][], sumber: string) => {
    const h = barisHabitDariBerkas(matriks, kebiasaan, mulai);
    if (h.baris.length <= 1) { setHasil(null); setPesan('Tidak ada baris hari yang terbaca. Periksa isi CSV.'); return; }
    setHasil({ ...h, sumber });
    setPesan('');
  };
  const pilihBerkas = async (f: File | undefined) => {
    if (!f) return;
    setSibuk(true);
    try { const r = await bacaBerkasTabel(f); proses(r.baris, f.name); } catch (e) { setPesan(e instanceof Error ? e.message : 'Berkas tidak bisa dibaca.'); } finally { setSibuk(false); }
  };
  const sisipkan = () => {
    const baris = tab === 'langsung' ? buatBarisHabit(kebiasaan, mulai, lama) : hasil?.baris;
    if (!baris || baris.length <= 1) return;
    onSisipkan(rakitHabit(baris, kebiasaan, mulai));
  };

  const tombol = 'px-2.5 py-1.5 border-2 border-black text-[12px] font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]';
  return (
    <div className="fixed inset-0 z-[250] bg-black/80 flex items-center justify-center p-3" onClick={onTutup}>
      <div className="bg-zinc-950 border-2 border-lime-500/60 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-zinc-100 text-[13px]" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Habit 1 bulan">
        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-zinc-900 border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarCheck size={18} className="text-lime-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-[14px] text-white">Habit · lacak kebiasaan 1 bulan</h3>
              <p className="text-[11px] text-zinc-400">Tabel ceklis harian + grafik progres (selesai vs target, runtunan, konsistensi)</p>
            </div>
          </div>
          <button type="button" onClick={onTutup} className="p-1 text-zinc-400 hover:text-white" aria-label="Tutup"><X size={18} /></button>
        </div>

        {/* Data dasar: dipakai keempat cara */}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 px-4 pt-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase">Kebiasaan yang dilacak / diubah</span>
            <input value={kebiasaan} onChange={(e) => setKebiasaan(e.target.value)} placeholder="mis. Bangun 05.00 & olahraga 20 menit" className="input-retro !py-1.5 !text-[13px]" maxLength={120} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase">Mulai</span>
            <input type="date" value={mulai} onChange={(e) => e.target.value && setMulai(e.target.value)} className="input-retro !py-1.5 !text-[13px]" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-zinc-400 uppercase">Lama</span>
            <select value={lama} onChange={(e) => setLama(Number(e.target.value))} className="input-retro !py-1.5 !text-[13px]">
              {LAMA_HABIT.map((n) => <option key={n} value={n}>{n} hari</option>)}
            </select>
          </label>
        </div>

        <div className="flex overflow-x-auto tanpa-scrollbar border-b border-white/10 px-3 mt-3">
          {TAB.map(({ id, label, ikon: Ikon }) => (
            <button key={id} type="button" onClick={() => { setTab(id); setPesan(''); }} className={`shrink-0 whitespace-nowrap py-2 px-3 text-[12px] font-bold border-b-2 flex items-center gap-1.5 ${tab === id ? 'border-lime-400 text-lime-300' : 'border-transparent text-zinc-400 hover:text-white'}`}>
              <Ikon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {tab === 'langsung' && (
            <p className="text-zinc-300 leading-relaxed">
              Satu kebiasaan yang sama setiap hari selama {lama} hari, dibagi tiga fase (Memulai → Menguatkan → Mengunci).
              Centang status setiap hari di tabel; grafik menunjukkan selesai vs target, hari yang terlewat, runtunan, dan perkiraan akhir.
            </p>
          )}

          {tab === 'contoh' && (
            <>
              <p className="text-zinc-300">Format kolom: <b>{['Hari', 'Tanggal', 'Fase', 'Kebiasaan', 'Status', 'Catatan'].join(' · ')}</b>. Ubah di Excel (boleh disimpan sebagai .xlsx atau .csv), lalu unggah di tab <b>Unggah / tempel</b>.</p>
              <pre className="max-h-56 overflow-auto custom-scrollbar p-2 bg-black/50 border border-white/15 text-[11px] leading-snug whitespace-pre font-mono">{contoh.split('\n').slice(0, 12).join('\n')}{'\n…'}</pre>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${tombol} bg-zinc-800 text-zinc-100`} onClick={() => void salin(contoh, 'CSV contoh')}><Copy size={13} /> Salin CSV</button>
                <button type="button" className={`${tombol} bg-zinc-800 text-zinc-100`} onClick={() => void simpanBerkas(new Blob(['﻿' + contoh], { type: 'text/csv' }), 'contoh-habit-30-hari.csv')}><Download size={13} /> Unduh contoh .csv</button>
                <button type="button" className={`${tombol} bg-zinc-800 text-zinc-100`} onClick={() => { proses(uraiCsvKeMatriks(contoh), 'contoh'); setTab('unggah'); }}><Table2 size={13} /> Pakai contoh ini</button>
              </div>
            </>
          )}

          {tab === 'prompt' && (
            <>
              <ol className="list-decimal pl-5 space-y-0.5 text-zinc-300">
                <li>Isi <b>kebiasaan</b> di atas, lalu salin prompt ini.</li>
                <li>Tempel di ChatGPT / Gemini.</li>
                <li>Salin jawaban CSV-nya, tempel di tab <b>Unggah / tempel</b>.</li>
              </ol>
              <textarea readOnly value={prompt} rows={11} className="w-full p-2 bg-black/50 border border-white/15 text-[12px] leading-snug font-mono resize-y" aria-label="Prompt AI" />
              <button type="button" className={`${tombol} bg-purple-700 text-white`} onClick={() => void salin(prompt, 'Prompt')}><Copy size={13} /> Salin prompt</button>
            </>
          )}

          {tab === 'unggah' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-zinc-400 uppercase">Unggah berkas .csv / .xlsx / .xls</span>
                <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={(e) => void pilihBerkas(e.target.files?.[0])} className="text-[12px]" disabled={sibuk} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-zinc-400 uppercase">…atau tempel teks CSV (mis. jawaban AI)</span>
                <textarea value={teks} onChange={(e) => setTeks(e.target.value)} rows={5} placeholder="Hari,Tanggal,Fase,Kebiasaan,Status,Catatan" className="w-full p-2 bg-black/50 border border-white/15 text-[12px] font-mono resize-y" />
              </label>
              <button type="button" disabled={!teks.trim()} className={`${tombol} bg-zinc-800 text-zinc-100 disabled:opacity-40`} onClick={() => proses(uraiCsvKeMatriks(teks.replace(/^```[a-z]*\s*|```\s*$/gim, '')), 'teks')}>
                <Table2 size={13} /> Baca teks CSV
              </button>
              {hasil && hasil.peringatan.map((p) => <p key={p} className="text-[12px] text-amber-300">⚠ {p}</p>)}
            </>
          )}

          {pratinjau && pratinjau.length > 1 && (tab === 'langsung' || tab === 'unggah') && (
            <div>
              <p className="text-[11px] font-bold text-zinc-400 uppercase mb-1">Pratinjau ({pratinjau.length - 1} hari{hasil && tab === 'unggah' ? ` · dari ${hasil.sumber}` : ''})</p>
              <div className="overflow-x-auto custom-scrollbar border border-white/15">
                <table className="text-[12px] border-collapse min-w-full">
                  <tbody>
                    {pratinjau.slice(0, 6).map((r, i) => (
                      <tr key={i} className={i === 0 ? 'bg-white/[0.07] font-bold' : ''}>
                        {r.map((c, j) => <td key={j} className="border border-white/10 px-2 py-1 align-top whitespace-nowrap">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pratinjau.length > 6 && <p className="text-[11px] text-zinc-500 mt-1">… {pratinjau.length - 6} hari lagi</p>}
            </div>
          )}
          {pesan && <p className="text-[12px] text-lime-300">{pesan}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 px-4 py-3 bg-zinc-900 border-t border-white/10">
          <span className="text-[11px] text-zinc-400">Kolom: {KEPALA_HABIT.join(' · ')}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onTutup} className={`${tombol} bg-zinc-800 text-zinc-200`}>Batal</button>
            <button type="button" onClick={sisipkan} disabled={!(tab === 'langsung' || (tab === 'unggah' && hasil))} className={`${tombol} bg-lime-500 text-black disabled:opacity-40`}>
              <CalendarCheck size={13} /> Sisipkan habit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
