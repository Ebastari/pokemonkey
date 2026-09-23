import React, { useState } from 'react';
import {
  FileText, Printer, Save, RotateCcw, X, Edit3, Eye, Calendar, Clock,
  MapPin, Users, Plus, Trash2, Image as ImageIcon, Download, CheckCircle2,
  FileSpreadsheet, MoveRight, LayoutTemplate
} from 'lucide-react';
import {
  type DataMOM,
  type PoinMOM,
  type PesertaMOM,
  type FotoDokumentasiMOM,
  MOM_DEFAULT,
  eksporMOMKeWord,
  eksporMOMKeExcel,
} from '../lib/ekspor-mom';
import { LOGO_HASNUR_BASE64 } from '../lib/logo-hasnur';
import * as W from '../lib/waktu';

interface Props {
  initialData?: DataMOM;
  onSimpan?: (data: DataMOM) => void;
  onTutup: () => void;
  notify: (pesan: string) => void;
}

export const FormMOM: React.FC<Props> = ({
  initialData,
  onSimpan,
  onTutup,
  notify,
}) => {
  const [data, setData] = useState<DataMOM>(initialData ?? MOM_DEFAULT);
  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [sedangEkspor, setSedangEkspor] = useState(false);

  // --- Handlers Poin Rapat ---
  const tambahPoin = () => {
    const noBaru = (data.poinList.length || 0) + 1;
    const baru: PoinMOM = {
      id: `poin-${Date.now()}`,
      no: noBaru,
      minutesOfMeeting: '',
      pic: '',
      dueDate: '',
      remark: '',
    };
    setData((prev) => ({
      ...prev,
      poinList: [...prev.poinList, baru],
    }));
  };

  const ubahPoin = (id: string, patch: Partial<PoinMOM>) => {
    setData((prev) => ({
      ...prev,
      poinList: prev.poinList.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const hapusPoin = (id: string) => {
    setData((prev) => {
      const tersisa = prev.poinList.filter((p) => p.id !== id);
      // Susun ulang penomoran
      return {
        ...prev,
        poinList: tersisa.map((p, idx) => ({ ...p, no: idx + 1 })),
      };
    });
  };

  // --- Handlers Peserta ---
  const tambahPeserta = () => {
    const baru: PesertaMOM = {
      id: `peserta-${Date.now()}`,
      nama: '',
      jabatan: '',
      instansi: 'PT EBL',
    };
    setData((prev) => ({
      ...prev,
      pesertaList: [...prev.pesertaList, baru],
    }));
  };

  const ubahPeserta = (id: string, patch: Partial<PesertaMOM>) => {
    setData((prev) => ({
      ...prev,
      pesertaList: prev.pesertaList.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  };

  const hapusPeserta = (id: string) => {
    setData((prev) => ({
      ...prev,
      pesertaList: prev.pesertaList.filter((p) => p.id !== id),
    }));
  };

  // --- Handlers Foto Dokumentasi ---
  const handleUnggahFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const url = loadEvt.target?.result as string;
        if (url) {
          const fotoBaru: FotoDokumentasiMOM = {
            id: `foto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            url,
            keterangan: file.name.replace(/\.[^/.]+$/, ''),
          };
          setData((prev) => ({
            ...prev,
            fotoList: [...(prev.fotoList || []), fotoBaru],
          }));
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const hapusFoto = (id: string) => {
    setData((prev) => ({
      ...prev,
      fotoList: (prev.fotoList || []).filter((f) => f.id !== id),
    }));
  };

  const ubahKeteranganFoto = (id: string, keterangan: string) => {
    setData((prev) => ({
      ...prev,
      fotoList: (prev.fotoList || []).map((f) => (f.id === id ? { ...f, keterangan } : f)),
    }));
  };

  // --- Ekspor & Cetak ---
  const handleEksporWord = async () => {
    setSedangEkspor(true);
    try {
      await eksporMOMKeWord(data);
      notify('BERKAS WORD MINUTES OF MEETING BERHASIL DIUNDUH');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGEKSPOR WORD');
    } finally {
      setSedangEkspor(false);
    }
  };

  const handleEksporExcel = async () => {
    setSedangEkspor(true);
    try {
      await eksporMOMKeExcel(data);
      notify('BERKAS EXCEL MINUTES OF MEETING BERHASIL DIUNDUH');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGEKSPOR EXCEL');
    } finally {
      setSedangEkspor(false);
    }
  };

  const handleCetak = () => {
    // Sama dengan Internal Memo: judul halaman dikosongkan agar tidak ikut tercetak.
    const judulAsli = document.title;
    document.title = ' ';
    window.print();
    setTimeout(() => {
      document.title = judulAsli;
    }, 1000);
  };

  const handleReset = () => {
    if (window.confirm('Kembalikan data formulir ke nilai bawaan template?')) {
      setData(MOM_DEFAULT);
      notify('DATA DIRESET KE NILAI TEMPLATE BAWAAN');
    }
  };

  const handleSimpan = () => {
    onSimpan?.(data);
    notify('MINUTES OF MEETING BERHASIL DISIMPAN');
  };

  const formatTanggalLengkap = (s?: string) => {
    if (!s) return '—';
    try {
      const [y, m, d] = s.slice(0, 10).split('-').map(Number);
      return `${d} ${W.NAMA_BULAN[m - 1] || ''} ${y}`;
    } catch {
      return s;
    }
  };

  const isLandscape = (data.orientasi ?? 'landscape') === 'landscape';

  // Chunks peserta untuk rendering 4 kolom per tabel
  const pesertaChunks: PesertaMOM[][] = [];
  for (let i = 0; i < data.pesertaList.length; i += 4) {
    pesertaChunks.push(data.pesertaList.slice(i, i + 4));
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed-none">
      {/* ================= TOP TOOLBAR (Hidden when Printing) ================= */}
      <header className="max-w-6xl mx-auto w-full mb-3 bg-slate-900 border-2 border-slate-700 p-2.5 sm:p-3 rounded-xl shadow-xl flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 border-2 border-white rounded-lg flex items-center justify-center text-slate-950 font-bold shadow">
            <FileText size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-title text-white tracking-wide">
                MINUTES OF MEETING (MOM)
              </h1>
              <span className="bg-blue-900 text-blue-300 text-[9px] px-2 py-0.5 rounded font-title border border-blue-500/40">
                TEMPLATE RESMI
              </span>
            </div>
            <p className="text-[12px] text-slate-400 font-body">
              Live Preview A4, Penyesuaian Panjang Halaman, &amp; Ekspor Word (.doc)
            </p>
          </div>
        </div>

        {/* Tab Switcher & Pengaturan Orientasi */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
            <button
              onClick={() => setMode('form')}
              className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                mode === 'form'
                  ? 'bg-blue-500 text-slate-950 shadow font-title text-[10px]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Edit3 size={13} />
              <span>Form Input</span>
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                mode === 'preview'
                  ? 'bg-blue-500 text-slate-950 shadow font-title text-[10px]'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Eye size={13} />
              <span>Pratinjau</span>
            </button>
          </div>

          {/* Pemilih Orientasi */}
          <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs">
            <span className="text-[11px] text-slate-400 px-2 font-mono">Orientasi:</span>
            <button
              onClick={() => setData((p) => ({ ...p, orientasi: 'landscape' }))}
              className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                isLandscape ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Landscape (Sesuai Dokumen Template Asli)"
            >
              Landscape
            </button>
            <button
              onClick={() => setData((p) => ({ ...p, orientasi: 'portrait' }))}
              className={`px-2.5 py-1 rounded font-bold text-[11px] transition-all ${
                !isLandscape ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Portrait (Tegak)"
            >
              Portrait
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleEksporWord}
            disabled={sedangEkspor}
            className="btn-retro btn-retro-sm !bg-blue-700 hover:!bg-blue-600 !text-white flex items-center gap-1 text-[11px]"
            title="Unduh berkas Word (.doc) sesuai template asli"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Unduh</span> Word
          </button>

          <button
            onClick={handleEksporExcel}
            disabled={sedangEkspor}
            className="btn-retro btn-retro-sm !bg-emerald-700 hover:!bg-emerald-600 !text-white flex items-center gap-1 text-[11px]"
            title="Unduh berkas Excel (.xlsx) dengan format tabel rapi"
          >
            <FileSpreadsheet size={13} />
            <span className="hidden sm:inline">Unduh</span> .xlsx
          </button>

          <button
            onClick={handleCetak}
            className="btn-retro btn-retro-sm !bg-slate-700 hover:!bg-slate-600 !text-white flex items-center gap-1 text-[11px]"
            title="Cetak atau simpan sebagai PDF A4 resmi"
          >
            <Printer size={13} />
            <span className="hidden sm:inline">Cetak /</span> PDF
          </button>

          <button
            onClick={handleReset}
            className="btn-retro btn-retro-sm !bg-slate-800 hover:!bg-slate-700 !text-white flex items-center gap-1 text-[11px]"
            title="Kembalikan ke template default"
          >
            <RotateCcw size={13} />
            <span className="hidden md:inline">Reset</span>
          </button>

          <button
            onClick={handleSimpan}
            className="btn-retro btn-retro-sm !bg-emerald-600 hover:!bg-emerald-500 !text-white font-bold flex items-center gap-1 text-[11px]"
            title="Simpan perubahan Minutes of Meeting"
          >
            <Save size={13} />
            <span>Simpan</span>
          </button>

          <button
            onClick={onTutup}
            className="btn-ikon !w-7 !h-7 !bg-red-700 hover:!bg-red-600 !text-white !border-2 !border-red-400 ml-1"
            title="Tutup Form"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* ================= FORM EDITOR MODE ================= */}
      {mode === 'form' && (
        <main className="max-w-6xl mx-auto w-full flex-1 bg-slate-900 border-2 border-slate-700 rounded-xl p-3 sm:p-5 text-white overflow-y-auto space-y-6">
          {/* Bagian 1: Header / Informasi Pertemuan */}
          <section className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-3">
            <h2 className="text-xs font-title text-blue-400 flex items-center gap-2 tracking-wider">
              <Calendar size={14} /> 1. INFORMASI &amp; JADWAL RAPAT
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Judul Dokumen</label>
                <input
                  type="text"
                  value={data.judul}
                  onChange={(e) => setData({ ...data, judul: e.target.value })}
                  placeholder="MINUTES OF MEETING"
                  className="input-retro !py-1.5 !text-sm w-full font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Tanggal</label>
                <input
                  type="date"
                  value={data.tanggal}
                  onChange={(e) => setData({ ...data, tanggal: e.target.value })}
                  className="input-retro !py-1.5 !text-sm w-full"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Waktu</label>
                <input
                  type="text"
                  value={data.waktu}
                  onChange={(e) => setData({ ...data, waktu: e.target.value })}
                  placeholder="09:00 - Selesai WITA"
                  className="input-retro !py-1.5 !text-sm w-full"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Tempat</label>
                <input
                  type="text"
                  value={data.tempat}
                  onChange={(e) => setData({ ...data, tempat: e.target.value })}
                  placeholder="Ruang Rapat Site / Online"
                  className="input-retro !py-1.5 !text-sm w-full"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-mono text-slate-400 block mb-1">Peserta (Ringkasan)</label>
                <input
                  type="text"
                  value={data.pesertaRingkasan}
                  onChange={(e) => setData({ ...data, pesertaRingkasan: e.target.value })}
                  placeholder="Daftar peserta yang diundang/hadir"
                  className="input-retro !py-1.5 !text-sm w-full"
                />
              </div>
            </div>
          </section>

          {/* Bagian 2: Tabel Poin Rapat (Minutes of Meeting) */}
          <section className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-xs font-title text-blue-400 flex items-center gap-2 tracking-wider">
                <FileText size={14} /> 2. TABEL POIN NOTULEN (MINUTES OF MEETING)
              </h2>
              <button
                onClick={tambahPoin}
                className="btn-retro btn-retro-sm !bg-blue-600 hover:!bg-blue-500 !text-white text-[11px] flex items-center gap-1 font-bold"
              >
                <Plus size={13} /> Tambah Poin Rapat
              </button>
            </div>

            <div className="space-y-2">
              {data.poinList.map((poin, idx) => (
                <div
                  key={poin.id}
                  className="bg-slate-900 border border-slate-700 p-3 rounded-lg flex flex-col md:flex-row gap-3 items-start"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-950 border border-blue-600 flex items-center justify-center text-blue-300 font-bold text-xs shrink-0 mt-1">
                    {poin.no || idx + 1}
                  </div>

                  <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2.5 w-full">
                    <div className="md:col-span-6">
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                        Minutes of Meeting (Pembahasan / Hasil Rapat)
                      </label>
                      <textarea
                        value={poin.minutesOfMeeting}
                        onChange={(e) => ubahPoin(poin.id, { minutesOfMeeting: e.target.value })}
                        placeholder="Uraian pembahasan, kesepakatan, atau instruksi kerja…"
                        rows={2}
                        className="input-retro !py-1 !text-xs w-full resize-y"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">PIC</label>
                      <input
                        type="text"
                        value={poin.pic}
                        onChange={(e) => ubahPoin(poin.id, { pic: e.target.value })}
                        placeholder="Nama / Tim"
                        className="input-retro !py-1 !text-xs w-full"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Due Date</label>
                      <input
                        type="text"
                        value={poin.dueDate}
                        onChange={(e) => ubahPoin(poin.id, { dueDate: e.target.value })}
                        placeholder="Contoh: 2026-10-05"
                        className="input-retro !py-1 !text-xs w-full"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">Remark</label>
                      <input
                        type="text"
                        value={poin.remark}
                        onChange={(e) => ubahPoin(poin.id, { remark: e.target.value })}
                        placeholder="Catatan / status"
                        className="input-retro !py-1 !text-xs w-full"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => hapusPoin(poin.id)}
                    className="btn-ikon !w-7 !h-7 !bg-red-700 hover:!bg-red-600 !text-white !border-2 !border-red-400 shrink-0 mt-1"
                    title="Hapus poin ini"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {data.poinList.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-700 rounded-lg">
                  Belum ada poin rapat. Klik tombol <strong>+ Tambah Poin Rapat</strong> di atas.
                </div>
              )}
            </div>
          </section>

          {/* Bagian 3: Tabel Peserta & Tanda Tangan */}
          <section className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-xs font-title text-blue-400 flex items-center gap-2 tracking-wider">
                <Users size={14} /> 3. PESERTA &amp; TANDA TANGAN (DAFTAR HADIR)
              </h2>
              <button
                onClick={tambahPeserta}
                className="btn-retro btn-retro-sm !bg-blue-600 hover:!bg-blue-500 !text-white text-[11px] flex items-center gap-1 font-bold"
              >
                <Plus size={13} /> Tambah Peserta
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Disusun dalam kelompok 4 kolom berdampingan sesuai format template dokumen.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {data.pesertaList.map((peserta, idx) => (
                <div
                  key={peserta.id}
                  className="bg-slate-900 border border-slate-700 p-3 rounded-lg space-y-2 relative group"
                >
                  <div className="flex items-center justify-between gap-1 border-b border-slate-800 pb-1.5">
                    <span className="text-[10px] font-mono text-blue-400 font-bold">
                      Peserta #{idx + 1}
                    </span>
                    <button
                      onClick={() => hapusPeserta(peserta.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                      title="Hapus peserta"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div>
                    <label className="text-[9px] font-mono text-slate-400 block mb-0.5">Nama</label>
                    <input
                      type="text"
                      value={peserta.nama}
                      onChange={(e) => ubahPeserta(peserta.id, { nama: e.target.value })}
                      placeholder="Nama lengkap"
                      className="input-retro !py-1 !text-xs w-full font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-mono text-slate-400 block mb-0.5">Jabatan</label>
                    <input
                      type="text"
                      value={peserta.jabatan}
                      onChange={(e) => ubahPeserta(peserta.id, { jabatan: e.target.value })}
                      placeholder="Jabatan"
                      className="input-retro !py-1 !text-xs w-full"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-mono text-slate-400 block mb-0.5">Instansi</label>
                    <input
                      type="text"
                      value={peserta.instansi}
                      onChange={(e) => ubahPeserta(peserta.id, { instansi: e.target.value })}
                      placeholder="PT EBL / Hasnur"
                      className="input-retro !py-1 !text-xs w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bagian 4: Dokumentasi Foto */}
          <section className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-xs font-title text-blue-400 flex items-center gap-2 tracking-wider">
                <ImageIcon size={14} /> 4. DOKUMENTASI FOTO PERTEMUAN
              </h2>
              <label className="btn-retro btn-retro-sm !bg-blue-600 hover:!bg-blue-500 !text-white text-[11px] flex items-center gap-1 font-bold cursor-pointer">
                <Plus size={13} /> Unggah Foto
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUnggahFoto}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {(data.fotoList || []).map((foto) => (
                <div
                  key={foto.id}
                  className="bg-slate-900 border border-slate-700 p-2 rounded-lg space-y-1.5 relative group"
                >
                  <div className="aspect-video bg-black rounded overflow-hidden relative">
                    <img
                      src={foto.url}
                      alt={foto.keterangan || 'Dokumentasi'}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => hapusFoto(foto.id)}
                      className="absolute top-1 right-1 btn-ikon !w-6 !h-6 !bg-red-700 hover:!bg-red-600 !text-white !border !border-red-400"
                      title="Hapus foto"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={foto.keterangan || ''}
                    onChange={(e) => ubahKeteranganFoto(foto.id, e.target.value)}
                    placeholder="Keterangan foto…"
                    className="input-retro !py-0.5 !text-[11px] w-full"
                  />
                </div>
              ))}

              {(!data.fotoList || data.fotoList.length === 0) && (
                <div className="col-span-full text-center py-6 text-slate-500 text-xs border border-dashed border-slate-800 rounded-lg">
                  Belum ada foto dokumentasi diunggah. Format template asli: <em>Foto, foto, foto</em>.
                </div>
              )}
            </div>
          </section>
        </main>
      )}

      {/* ================= LIVE PREVIEW & PRINTABLE DOCUMENT ================= */}
      {/* Container ini tetap dirender saat printing, dan dimunculkan di layar jika mode === 'preview' */}
      <main
        className={`max-w-6xl mx-auto w-full flex-1 overflow-y-auto ${
          mode === 'preview' ? 'block' : 'hidden print:block'
        }`}
      >
        <div
          id="dokumen-mom-cetak"
          className={`bg-white text-black mx-auto shadow-2xl p-6 sm:p-10 transition-all font-sans print:p-0 print:shadow-none print:w-full ${
            isLandscape
              ? 'max-w-[1050px] min-h-[720px]'
              : 'max-w-[800px] min-h-[1100px]'
          }`}
          style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            color: '#000',
            lineHeight: 1.35,
          }}
        >
          {/* Kop Surat Resmi: Logo Hasnur Group & PT Energi Batubara Lestari (Sesuai P0 Template Asli) */}
          <div className="flex items-center gap-4 pb-2 mb-2">
            <img
              src={LOGO_HASNUR_BASE64}
              alt="Logo Hasnur Group"
              className="h-14 sm:h-16 w-auto object-contain shrink-0"
            />
            <div className="text-black">
              <h2 className="text-[15px] sm:text-[17px] font-bold tracking-wide text-black uppercase leading-snug">
                PT. ENERGI BATUBARA LESTARI
              </h2>
              <p className="text-[11px] sm:text-[12px] text-black leading-tight">
                Mine Site Office : Jl. Jend Sudirman - Tapin, Kalimantan Selatan
              </p>
              <p className="text-[11px] sm:text-[12px] text-black leading-tight">
                Telp. 0517-2034058 Fax. 0517-2034058
              </p>
            </div>
          </div>

          {/* Garis Pembatas Kop Surat */}
          <div className="border-b-2 border-black mb-5" />

          {/* Judul Dokumen (P3 Template: MINUTES OF MEETING, Arial Bold Centered) */}
          <div className="text-center mb-6">
            <h1 className="text-[17px] sm:text-[20px] font-bold tracking-wide uppercase text-black">
              {data.judul || 'MINUTES OF MEETING'}
            </h1>
          </div>

          {/* Metadata Pertemuan (P4 - P7 Template) */}
          <div className="text-[13px] leading-relaxed text-black mb-5 space-y-1">
            <div className="grid grid-cols-12 gap-x-2 items-center">
              <div className="col-span-2 sm:col-span-1 text-black font-normal">Tanggal</div>
              <div className="col-span-1 text-center font-bold">:</div>
              <div className="col-span-9 sm:col-span-10 font-semibold">
                {formatTanggalLengkap(data.tanggal)}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-center">
              <div className="col-span-2 sm:col-span-1 text-black font-normal">Waktu</div>
              <div className="col-span-1 text-center font-bold">:</div>
              <div className="col-span-9 sm:col-span-10">
                {data.waktu || '—'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-center">
              <div className="col-span-2 sm:col-span-1 text-black font-normal">Tempat</div>
              <div className="col-span-1 text-center font-bold">:</div>
              <div className="col-span-9 sm:col-span-10">
                {data.tempat || '—'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-center">
              <div className="col-span-2 sm:col-span-1 text-black font-normal">Peserta</div>
              <div className="col-span-1 text-center font-bold">:</div>
              <div className="col-span-9 sm:col-span-10">
                {data.pesertaRingkasan || '—'}
              </div>
            </div>
          </div>

          {/* Tabel 1: Poin Rapat (Table 0 Template: No | Minutes of Meeting | Pic | Due Date | Remark) */}
          <div className="mb-6">
            <table className="w-full table-fixed border-collapse border border-black text-[12px] sm:text-[13px]">
              <thead>
                <tr className="bg-slate-100 font-bold text-center border-b border-black">
                  <th className="border border-black px-2 py-2 w-[5%]">No</th>
                  <th className="border border-black px-3 py-2 w-[52%] text-left">Minutes of Meeting</th>
                  <th className="border border-black px-2 py-2 w-[14%]">Pic</th>
                  <th className="border border-black px-2 py-2 w-[13%]">Due Date</th>
                  <th className="border border-black px-2 py-2 w-[16%] text-left">Remark</th>
                </tr>
              </thead>
              <tbody>
                {data.poinList.map((p, idx) => (
                  <tr key={p.id || idx} className="border-b border-black break-inside-avoid">
                    <td className="border border-black px-2 py-2 text-center align-top font-bold">
                      {p.no || idx + 1}
                    </td>
                    <td className="border border-black px-3 py-2 align-top whitespace-pre-line [overflow-wrap:anywhere]">
                      {p.minutesOfMeeting || '\u00A0'}
                    </td>
                    <td className="border border-black px-2 py-2 text-center align-top font-medium [overflow-wrap:anywhere]">
                      {p.pic || '\u00A0'}
                    </td>
                    <td className="border border-black px-2 py-2 text-center align-top font-mono text-[12px]">
                      {p.dueDate || '\u00A0'}
                    </td>
                    <td className="border border-black px-2 py-2 align-top whitespace-pre-line [overflow-wrap:anywhere]">
                      {p.remark || '\u00A0'}
                    </td>
                  </tr>
                ))}
                {data.poinList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="border border-black px-3 py-6 text-center text-slate-400 italic">
                      Belum ada poin pembahasan rapat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Header Seksi Peserta (P12 Template) */}
          <div className="mb-2">
            <p className="text-[13px] font-bold text-black">
              Peserta
            </p>
          </div>

          {/* Tabel 2: Grid Tanda Tangan Peserta (Table 1 Template: 4 Kolom) */}
          <div className="mb-6 space-y-4">
            {pesertaChunks.map((chunk, cIdx) => {
              const padded = [...chunk];
              while (padded.length < 4) {
                padded.push({ id: `empty-${padded.length}`, nama: '', jabatan: '', instansi: '' });
              }

              return (
                <table
                  key={cIdx}
                  className="w-full table-fixed border-collapse border border-black text-[12px] sm:text-[13px] break-inside-avoid mb-3"
                >
                  <tbody>
                    {/* Baris Nama */}
                    <tr className="border-b border-black bg-slate-50 font-bold text-center">
                      {padded.map((p, i) => (
                        <td key={i} className="border border-black px-2 py-1.5 w-1/4 [overflow-wrap:anywhere]">
                          {p.nama || '\u00A0'}
                        </td>
                      ))}
                    </tr>
                    {/* Baris Tanda Tangan */}
                    <tr className="border-b border-black text-center h-20 sm:h-24">
                      {padded.map((p, i) => (
                        <td key={i} className="border border-black px-2 py-2 w-1/4 align-bottom text-[11px] text-slate-400">
                          {p.ttdUrl ? (
                            <img src={p.ttdUrl} alt="ttd" className="max-h-16 mx-auto object-contain" />
                          ) : (
                            p.nama ? '( ttd )' : '\u00A0'
                          )}
                        </td>
                      ))}
                    </tr>
                    {/* Baris Jabatan */}
                    <tr className="border-b border-black text-center text-[12px]">
                      {padded.map((p, i) => (
                        <td key={i} className="border border-black px-2 py-1 w-1/4 [overflow-wrap:anywhere]">
                          {p.jabatan || '\u00A0'}
                        </td>
                      ))}
                    </tr>
                    {/* Baris Instansi */}
                    <tr className="text-center text-[12px]">
                      {padded.map((p, i) => (
                        <td key={i} className="border border-black px-2 py-1 w-1/4 [overflow-wrap:anywhere]">
                          {p.instansi || '\u00A0'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              );
            })}
          </div>

          {/* Seksi Foto Dokumentasi (P24 Template: Foto, foto, foto) */}
          <div className="mt-8 break-inside-avoid">
            {data.fotoList && data.fotoList.length > 0 ? (
              <div>
                <h4 className="text-[13px] font-bold text-black mb-3">Dokumentasi Pertemuan</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {data.fotoList.map((foto) => (
                    <div key={foto.id} className="text-center border border-slate-300 p-2 rounded bg-slate-50">
                      <img
                        src={foto.url}
                        alt={foto.keterangan || 'Dokumentasi'}
                        className="max-h-44 w-full object-contain mx-auto rounded"
                      />
                      {foto.keterangan && (
                        <p className="text-[11px] text-slate-600 mt-1">{foto.keterangan}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 italic">Foto, foto, foto</p>
            )}
          </div>
        </div>
      </main>

      {/* Gaya cetak A4 yang adaptif & isolasi dokumen (Zero pokemonkey traces) */}
      <style>{`
        @media print {
          @page {
            size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
            margin: 10mm 15mm 10mm 15mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            overflow: visible !important;
          }
          /* Sembunyikan seluruh antarmuka background aplikasi */
          body > * {
            visibility: hidden !important;
          }
          /* Hanya tampilkan lembar dokumen Minutes of Meeting */
          #dokumen-mom-cetak, #dokumen-mom-cetak * {
            visibility: visible !important;
          }
          #dokumen-mom-cetak {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }
          /* Pengaturan pagination adaptif agar tidak terpotong canggung */
          .break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
};
