import React, { useState, useId } from 'react';
import {
  Upload, FileText, Sparkles, Download, CheckCircle2, AlertTriangle, XCircle,
  Copy, Check, Loader2, X, RefreshCw, Info, Calendar, ShieldCheck,
} from 'lucide-react';
import { api, GalatApi } from '../lib/api';
import { simpanBerkas } from '../lib/unduh';
import {
  parseCsv,
  prosesCsvPica,
  hasilkanTemplateCsv,
  hasilkanPromptAi,
  type PicaCsvBaris,
} from '../lib/csv-pica';
import type { Bootstrap, Pengguna } from '../lib/tipe-api';

interface Props {
  boot: Bootstrap;
  pengguna: Pengguna;
  onTutup: () => void;
  onSelesai: (jumlah: number) => void;
  notify: (pesan: string) => void;
}

export const ModalImporPica: React.FC<Props> = ({
  boot,
  pengguna,
  onTutup,
  onSelesai,
  notify,
}) => {
  const [tabAktif, setTabAktif] = useState<'upload' | 'prompt' | 'template'>('upload');
  const [berkasNama, setBerkasNama] = useState<string | null>(null);
  const [dataParsed, setDataParsed] = useState<{
    baris: PicaCsvBaris[];
    totalValid: number;
    totalGalat: number;
  } | null>(null);
  const [periodeTujuan, setPeriodeTujuan] = useState(
    boot.pengaturan.periode_aktif || boot.periode[0]?.id || '',
  );
  const [memproses, setMemproses] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const [galatUnggah, setGalatUnggah] = useState<string | null>(null);
  const fileInputId = useId();

  const daftarBidang = boot.opsi.filter((o) => o.grup === 'bidang').map((o) => o.nilai);

  const handlePilihBerkas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    bacaFileCsv(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    bacaFileCsv(file);
  };

  const bacaFileCsv = (file: File) => {
    setGalatUnggah(null);
    setBerkasNama(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = String(evt.target?.result || '');
        const matriks = parseCsv(text);
        if (matriks.length <= 1) {
          setGalatUnggah('Berkas CSV kosong atau hanya berisi baris judul header.');
          setDataParsed(null);
          return;
        }
        const hasil = prosesCsvPica(matriks, boot.tim, daftarBidang);
        setDataParsed(hasil);
        if (hasil.baris.length === 0) {
          setGalatUnggah('Tidak ada baris data yang terbaca dari berkas CSV.');
        }
      } catch (err) {
        setGalatUnggah(err instanceof Error ? err.message : 'Gagal membaca berkas CSV.');
        setDataParsed(null);
      }
    };
    reader.onerror = () => {
      setGalatUnggah('Terjadi kesalahan saat membaca berkas.');
      setDataParsed(null);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleUnduhTemplate = async () => {
    try {
      const csvContent = hasilkanTemplateCsv(daftarBidang, boot.tim);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      await simpanBerkas(blob, 'template_pica.csv', 'Template PICA CSV');
      notify('TEMPLATE CSV BERHASIL DIUNDUH');
    } catch (err) {
      notify(err instanceof Error ? err.message.toUpperCase() : 'GAGAL MENGUNDUH TEMPLATE');
    }
  };

  const teksPromptAi = hasilkanPromptAi(boot);

  const handleSalinPrompt = async () => {
    try {
      await navigator.clipboard.writeText(teksPromptAi);
      setTersalin(true);
      notify('PROMPT AI DISALIN KE CLIPBOARD');
      setTimeout(() => setTersalin(false), 2500);
    } catch {
      notify('GAGAL MENYALIN — SILAKAN SALIN SECARA MANUAL');
    }
  };

  const handleSimpanBatch = async () => {
    if (!dataParsed || dataParsed.totalValid === 0) return;
    setMemproses(true);
    setGalatUnggah(null);

    const barisKirim = dataParsed.baris
      .filter((b) => b.valid)
      .map((b) => ({
        bidang: b.bidang,
        prioritas: b.prioritas,
        judul: b.judul,
        akar: b.akar || null,
        tindakan: b.tindakan || null,
        pic_id: b.pic_id || null,
        due_date: b.due_date || null,
        target: b.target,
        realisasi: b.realisasi,
        satuan: b.satuan,
        judul_singkat: b.judul_singkat,
      }));

    try {
      const res = await api<{ ok: boolean; jumlah: number; ids: string[] }>('/api/pica/impor', {
        method: 'POST',
        body: {
          periode_id: periodeTujuan || null,
          items: barisKirim,
        },
      });
      notify(`${res.jumlah} PICA BARU BERHASIL DITAMBAHKAN`);
      onSelesai(res.jumlah);
    } catch (err) {
      setGalatUnggah(err instanceof GalatApi ? err.message : 'Gagal menyimpan PICA.');
    } finally {
      setMemproses(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 md:p-4"
      onClick={onTutup}
    >
      <div
        className="retro-box !bg-zinc-900 w-full max-w-4xl border-amber-500 flex flex-col gap-3 max-h-[94vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex justify-between items-start border-b-2 border-white/20 pb-2 gap-3 shrink-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold text-amber-300 leading-snug flex items-center gap-1.5">
                <Upload size={17} className="text-amber-400" /> Impor PICA via CSV
              </span>
              <span className="chip-retro border-emerald-500 bg-emerald-950/60 text-emerald-300 flex items-center gap-1 text-[10px]">
                <ShieldCheck size={11} /> Mode Append (Menambah Baru)
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Menambahkan tugas PICA baru secara massal tanpa mengubah atau menimpa PICA lama.
            </p>
          </div>
          <button onClick={onTutup} className="text-zinc-400 hover:text-white shrink-0 p-1">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigasi */}
        <div className="flex border-b border-white/20 gap-1 shrink-0">
          <button
            onClick={() => setTabAktif('upload')}
            className={`px-3 py-1.5 text-[12px] font-bold uppercase flex items-center gap-1.5 border-b-2 transition-colors ${
              tabAktif === 'upload'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload size={14} /> 1. Upload & Pratinjau
          </button>
          <button
            onClick={() => setTabAktif('prompt')}
            className={`px-3 py-1.5 text-[12px] font-bold uppercase flex items-center gap-1.5 border-b-2 transition-colors ${
              tabAktif === 'prompt'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles size={14} className="text-amber-400" /> 2. Salin Prompt AI Agent
          </button>
          <button
            onClick={() => setTabAktif('template')}
            className={`px-3 py-1.5 text-[12px] font-bold uppercase flex items-center gap-1.5 border-b-2 transition-colors ${
              tabAktif === 'template'
                ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Download size={14} /> 3. Unduh Template CSV
          </button>
        </div>

        {/* Tab 1: Upload & Pratinjau */}
        {tabAktif === 'upload' && (
          <div className="flex-1 flex flex-col min-h-0 gap-3 overflow-hidden">
            {galatUnggah && (
              <div className="p-2.5 bg-red-950/70 border border-red-500 text-red-200 text-[12px] flex items-start gap-2 shrink-0">
                <XCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{galatUnggah}</span>
              </div>
            )}

            {!dataParsed ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="flex-1 border-2 border-dashed border-white/30 hover:border-amber-400 bg-black/40 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors rounded-sm"
                onClick={() => document.getElementById(fileInputId)?.click()}
              >
                <input
                  id={fileInputId}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handlePilihBerkas}
                  className="hidden"
                />
                <div className="w-14 h-14 bg-amber-500/10 border-2 border-amber-500/40 rounded-full flex items-center justify-center mb-3 text-amber-400">
                  <Upload size={24} />
                </div>
                <p className="text-[14px] font-bold text-white mb-1">
                  Pilih atau seret berkas CSV ke sini
                </p>
                <p className="text-[12px] text-zinc-400 max-w-md leading-relaxed mb-4">
                  Pastikan format baris pertama berisi kolom:{' '}
                  <code className="text-amber-300 bg-black/60 px-1 py-0.5 border border-white/10 text-[11px]">
                    bidang, prioritas, judul, akar, tindakan, pic, due_date, target, realisasi, satuan
                  </code>
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="btn-retro bg-amber-600 text-[12px] pointer-events-none">
                    Pilih File CSV
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTabAktif('prompt');
                    }}
                    className="btn-retro bg-zinc-800 text-[12px] flex items-center gap-1.5"
                  >
                    <Sparkles size={13} className="text-amber-400" /> Minta AI Buatkan CSV
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0 gap-2 overflow-hidden">
                {/* Bar info ringkasan & kontrol periode */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-black/40 border border-white/15 p-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-amber-400 shrink-0" />
                    <div>
                      <span className="text-[12px] font-bold text-white block">{berkasNama}</span>
                      <span className="text-[11px] text-zinc-400">
                        Total {dataParsed.baris.length} baris (
                        <b className="text-emerald-400">{dataParsed.totalValid} valid</b>
                        {dataParsed.totalGalat > 0 && (
                          <span className="text-red-400 ml-1">· {dataParsed.totalGalat} bermasalah</span>
                        )}
                        )
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[11px] text-zinc-300">
                      <Calendar size={13} className="text-cyan-300" />
                      <span>Periode:</span>
                    </div>
                    <select
                      value={periodeTujuan}
                      onChange={(e) => setPeriodeTujuan(e.target.value)}
                      className="input-retro !w-auto !py-1 !text-[12px]"
                    >
                      {boot.periode.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id} ({p.mulai} s.d. {p.selesai})
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => {
                        setDataParsed(null);
                        setBerkasNama(null);
                      }}
                      className="btn-retro btn-retro-sm bg-zinc-800 text-[11px]"
                      title="Ganti berkas CSV"
                    >
                      <RefreshCw size={11} /> Ganti Berkas
                    </button>
                  </div>
                </div>

                {/* Tabel Pratinjau */}
                <div className="flex-1 overflow-auto border-2 border-white/20 bg-black/50 custom-scrollbar min-h-0">
                  <table className="w-full text-[11px] border-collapse min-w-[900px]">
                    <thead className="sticky top-0 bg-[#2f5d33] text-white uppercase text-[10px] z-10">
                      <tr>
                        <th className="p-2 border border-white/20 text-center w-12">No</th>
                        <th className="p-2 border border-white/20 text-center w-20">Status</th>
                        <th className="p-2 border border-white/20 text-left w-24">Bidang</th>
                        <th className="p-2 border border-white/20 text-center w-16">Prio</th>
                        <th className="p-2 border border-white/20 text-left min-w-[200px]">Masalah (Fakta)</th>
                        <th className="p-2 border border-white/20 text-left min-w-[150px]">Akar & Tindakan</th>
                        <th className="p-2 border border-white/20 text-left w-32">PIC</th>
                        <th className="p-2 border border-white/20 text-center w-24">Due Date</th>
                        <th className="p-2 border border-white/20 text-left w-24">Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataParsed.baris.map((b, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-white/10 ${
                            !b.valid
                              ? 'bg-red-950/40 text-red-100'
                              : idx % 2 === 0
                              ? 'bg-black/20'
                              : 'bg-white/5'
                          }`}
                        >
                          <td className="p-2 border-r border-white/10 text-center text-zinc-400 font-mono">
                            {b.barisKe}
                          </td>
                          <td className="p-2 border-r border-white/10 text-center">
                            {b.valid ? (
                              b.peringatan.length > 0 ? (
                                <span
                                  className="chip-retro border-amber-400 text-amber-300 bg-amber-950/40 text-[9px] inline-flex items-center gap-0.5"
                                  title={b.peringatan.join('\n')}
                                >
                                  <AlertTriangle size={10} /> Cek
                                </span>
                              ) : (
                                <span className="chip-retro border-emerald-400 text-emerald-300 bg-emerald-950/40 text-[9px] inline-flex items-center gap-0.5">
                                  <CheckCircle2 size={10} /> Valid
                                </span>
                              )
                            ) : (
                              <span
                                className="chip-retro border-red-500 text-red-300 bg-red-950/60 text-[9px] inline-flex items-center gap-0.5"
                                title={b.pesanGalat.join('\n')}
                              >
                                <XCircle size={10} /> Galat
                              </span>
                            )}
                          </td>
                          <td className="p-2 border-r border-white/10 font-bold text-zinc-200">
                            {b.bidang}
                          </td>
                          <td className="p-2 border-r border-white/10 text-center">
                            <span
                              className={`chip-retro text-[9px] ${
                                b.prioritas === 'Tinggi'
                                  ? 'border-red-400 text-red-300'
                                  : b.prioritas === 'Rendah'
                                  ? 'border-zinc-500 text-zinc-400'
                                  : 'border-amber-400 text-amber-300'
                              }`}
                            >
                              {b.prioritas}
                            </span>
                          </td>
                          <td className="p-2 border-r border-white/10">
                            <p className="font-semibold text-white leading-snug">{b.judul}</p>
                            {b.judul_singkat && (
                              <span className="text-[10px] text-zinc-400 block mt-0.5">
                                WA: {b.judul_singkat}
                              </span>
                            )}
                            {b.pesanGalat.length > 0 && (
                              <span className="text-[10px] text-red-400 font-bold block mt-0.5">
                                ⚠ {b.pesanGalat.join(', ')}
                              </span>
                            )}
                          </td>
                          <td className="p-2 border-r border-white/10 text-zinc-300 leading-snug">
                            {b.akar && (
                              <p className="text-[10px] text-zinc-400">
                                <b>Akar:</b> {b.akar}
                              </p>
                            )}
                            {b.tindakan && (
                              <p className="text-[10px] text-emerald-300 mt-0.5">
                                <b>Aksi:</b> {b.tindakan}
                              </p>
                            )}
                            {!b.akar && !b.tindakan && <span className="text-zinc-600">—</span>}
                          </td>
                          <td className="p-2 border-r border-white/10">
                            {b.pic_nama ? (
                              <div>
                                <span className="text-cyan-300 font-bold block">{b.pic_nama}</span>
                                <span className="text-[9px] text-zinc-500">ID: {b.pic_id}</span>
                              </div>
                            ) : b.pic_input ? (
                              <div>
                                <span className="text-amber-400 line-through text-[10px] block">
                                  {b.pic_input}
                                </span>
                                <span className="text-[9px] text-amber-300">Belum cocok tim</span>
                              </div>
                            ) : (
                              <span className="text-zinc-600 italic">Belum ada</span>
                            )}
                          </td>
                          <td className="p-2 border-r border-white/10 text-center font-mono text-zinc-300">
                            {b.due_date || <span className="text-zinc-600">—</span>}
                          </td>
                          <td className="p-2 font-mono text-zinc-300">
                            {b.target !== null ? `${b.target} ${b.satuan || ''}` : <span className="text-zinc-600">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Aksi */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/20 shrink-0">
                  <div className="text-[12px] text-zinc-300">
                    Akan menambahkan{' '}
                    <b className="text-emerald-400">{dataParsed.totalValid} PICA baru</b> ke Periode{' '}
                    <b className="text-amber-300">{periodeTujuan}</b>.
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onTutup}
                      disabled={memproses}
                      className="btn-retro bg-zinc-800"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleSimpanBatch}
                      disabled={memproses || dataParsed.totalValid === 0}
                      className="btn-retro bg-emerald-700 font-bold flex items-center gap-1.5"
                    >
                      {memproses ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Menyimpan…
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} /> Tambahkan ({dataParsed.totalValid}) PICA Baru
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Salin Prompt AI Agent */}
        {tabAktif === 'prompt' && (
          <div className="flex-1 flex flex-col min-h-0 gap-3 overflow-hidden">
            <div className="bg-amber-950/40 border border-amber-500/50 p-3 flex items-start gap-2.5 shrink-0">
              <Sparkles size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[12px] text-zinc-200 space-y-1">
                <p className="font-bold text-amber-300">Cara Pakai dengan AI Agent (ChatGPT / Claude / Gemini):</p>
                <ol className="list-decimal list-inside space-y-0.5 text-zinc-300">
                  <li>Klik tombol <b>Salin Prompt AI</b> di bawah.</li>
                  <li>Buka AI Agent Anda (misal Claude atau ChatGPT).</li>
                  <li>Tempelkan prompt ini, lalu sertakan notulen rapat / laporan temuan lapangan Anda.</li>
                  <li>AI akan menghasilkan kode CSV yang 100% valid sesuai struktur POKEMONKEY.</li>
                  <li>Simpan teks CSV tersebut menjadi file <code className="text-amber-300">.csv</code>, lalu unggah di tab <b>Upload & Pratinjau</b>.</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-between shrink-0">
              <span className="text-[12px] font-bold text-zinc-300 uppercase">
                Teks Instruksi AI Agent (Otomatis Memuat Master Data Aktif):
              </span>
              <button
                type="button"
                onClick={handleSalinPrompt}
                className="btn-retro bg-amber-600 flex items-center gap-1.5 !py-1 text-[12px]"
              >
                {tersalin ? <Check size={14} /> : <Copy size={14} />}
                {tersalin ? 'Tersalin ke Clipboard!' : 'Salin Prompt AI'}
              </button>
            </div>

            <textarea
              readOnly
              value={teksPromptAi}
              className="flex-1 input-retro font-mono text-[11px] leading-relaxed resize-none p-2.5 bg-black/60 custom-scrollbar min-h-0"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </div>
        )}

        {/* Tab 3: Unduh Template CSV */}
        {tabAktif === 'template' && (
          <div className="flex-1 flex flex-col min-h-0 gap-3 overflow-auto custom-scrollbar p-1">
            <div className="p-3 bg-black/40 border border-white/20 space-y-2">
              <h4 className="text-[13px] font-bold text-amber-300 flex items-center gap-1.5">
                <FileText size={15} /> Aturan Kolom Format CSV PICA
              </h4>
              <p className="text-[12px] text-zinc-300 leading-relaxed">
                Anda dapat membuat file CSV di Microsoft Excel, Google Sheets, atau text editor.
                Pastikan nama kolom pada baris pertama persis seperti tabel berikut:
              </p>

              <div className="overflow-x-auto border border-white/20 mt-2">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-[#2f5d33] text-white uppercase text-[10px]">
                    <tr>
                      <th className="p-2 border border-white/20 text-left">Nama Kolom</th>
                      <th className="p-2 border border-white/20 text-center">Wajib?</th>
                      <th className="p-2 border border-white/20 text-left">Keterangan & Nilai yang Sah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 text-zinc-200">
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">bidang</td>
                      <td className="p-2 text-center text-emerald-400 font-bold">Wajib</td>
                      <td className="p-2">
                        Pilihan: {daftarBidang.join(', ')} (atau teks bidang bebas).
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">prioritas</td>
                      <td className="p-2 text-center text-zinc-400">Opsional</td>
                      <td className="p-2">
                        <code className="text-zinc-200">Tinggi</code>,{' '}
                        <code className="text-zinc-200">Sedang</code>, atau{' '}
                        <code className="text-zinc-200">Rendah</code> (bawaan: Sedang).
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">judul</td>
                      <td className="p-2 text-center text-red-400 font-bold">Wajib</td>
                      <td className="p-2">Uraian masalah / fakta temuan lapangan beserta angkanya.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">akar</td>
                      <td className="p-2 text-center text-zinc-400">Opsional</td>
                      <td className="p-2">Akar masalah / penyebab terjadinya kendala.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">tindakan</td>
                      <td className="p-2 text-center text-zinc-400">Opsional</td>
                      <td className="p-2">Rencana aksi / tindakan korektif penyelesaian.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">pic</td>
                      <td className="p-2 text-center text-zinc-400">Opsional</td>
                      <td className="p-2">Nama atau ID tim penanggung jawab (misal: Daniel, Agung Laksono).</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">due_date</td>
                      <td className="p-2 text-center text-zinc-400">Opsional</td>
                      <td className="p-2">Tenggat waktu penyelesaian dengan format <code className="text-zinc-200">YYYY-MM-DD</code>.</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">target</td>
                      <td className="p-2 text-center text-zinc-400">Opsional</td>
                      <td className="p-2">Angka target kuantitatif (contoh: 3000).</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">realisasi</td>
                      <td className="p-2 text-center text-zinc-400">Opsional</td>
                      <td className="p-2">Capaian saat ini (contoh: 0).</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">satuan</td>
                      <td className="p-2 text-center text-zinc-400">Opsional</td>
                      <td className="p-2">Satuan target (misal: batang, Ha, %, titik, m2).</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-mono font-bold text-amber-300">judul_singkat</td>
                      <td className="p-2 text-center text-zinc-400">Opsional</td>
                      <td className="p-2">Ringkasan maksimal 80 huruf untuk pesan notifikasi WhatsApp.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={handleUnduhTemplate}
                className="btn-retro bg-emerald-700 flex items-center gap-2 px-5 py-2 text-[13px] font-bold"
              >
                <Download size={16} /> Unduh Berkas template_pica.csv
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
