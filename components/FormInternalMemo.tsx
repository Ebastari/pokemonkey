import React, { useState } from 'react';
import {
  FileSpreadsheet, Printer, Save, RotateCcw, X, Edit3, Eye, Calendar, DollarSign,
  User, Briefcase, MapPin, FileText, CheckCircle2, Plus, Trash2,
} from 'lucide-react';
import {
  type DataMemoDinas,
  type ItemBiayaTambahan,
  MEMO_DINAS_DEFAULT,
  eksporMemoDinasKeExcel,
} from '../lib/ekspor-memo-dinas';
import { generateNomorSuratOtomatis, type ItemSurat } from '../lib/tipe-surat';
import { LOGO_HASNUR_BASE64 } from '../lib/logo-hasnur';
import * as W from '../lib/waktu';

interface Props {
  initialData?: DataMemoDinas;
  /** Daftar nomor surat dari server, dipakai tombol "generate nomor". */
  daftarSurat?: ItemSurat[];
  onSimpan?: (data: DataMemoDinas) => void;
  onTutup: () => void;
  notify: (pesan: string) => void;
}

export const FormInternalMemo: React.FC<Props> = ({
  initialData,
  daftarSurat = [],
  onSimpan,
  onTutup,
  notify,
}) => {
  const [data, setData] = useState<DataMemoDinas>(initialData ?? MEMO_DINAS_DEFAULT);
  const [mode, setMode] = useState<'form' | 'preview'>('form');
  const [sedangEkspor, setSedangEkspor] = useState(false);

  // Kalkulasi total biaya termasuk biaya tambahan manual
  const totalBiayaTambahan = (data.biayaTambahan || []).reduce(
    (acc, cur) => acc + (Number(cur.nominal) || 0),
    0
  );
  const totalBiaya =
    (Number(data.biayaTransportasi) || 0) +
    (Number(data.biayaPenginapan) || 0) +
    (Number(data.biayaUangMakan) || 0) +
    (Number(data.biayaLainLain) || 0) +
    totalBiayaTambahan;

  const tambahItemBiaya = () => {
    const baru: ItemBiayaTambahan = {
      id: `tb-${Date.now()}`,
      nama: '',
      nominal: null,
    };
    setData((prev) => ({
      ...prev,
      biayaTambahan: [...(prev.biayaTambahan || []), baru],
    }));
  };

  const ubahItemBiaya = (id: string, patch: Partial<ItemBiayaTambahan>) => {
    setData((prev) => ({
      ...prev,
      biayaTambahan: (prev.biayaTambahan || []).map((it) =>
        it.id === id ? { ...it, ...patch } : it
      ),
    }));
  };

  const hapusItemBiaya = (id: string) => {
    setData((prev) => ({
      ...prev,
      biayaTambahan: (prev.biayaTambahan || []).filter((it) => it.id !== id),
    }));
  };

  const formatRupiah = (val?: number | null) => {
    if (val === null || val === undefined || isNaN(val) || val === 0) return '—';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
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

  const formatTanggalExcel = (s?: string) => {
    if (!s) return '\u00A0';
    try {
      const [y, m, d] = s.slice(0, 10).split('-').map(Number);
      const namaBulanPendek = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const yy = String(y).slice(-2);
      return `${d}-${namaBulanPendek[m - 1] || ''}-${yy}`;
    } catch {
      return s;
    }
  };

  const formatAngkaRibuan = (val?: number | null) => {
    if (val === null || val === undefined || isNaN(val) || val === 0) return '';
    return new Intl.NumberFormat('id-ID').format(val);
  };

  const handleEksporExcel = async () => {
    setSedangEkspor(true);
    try {
      await eksporMemoDinasKeExcel(data);
      notify('BERKAS EXCEL MEMO DINAS BERHASIL DIUNDUH');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGEKSPOR EXCEL');
    } finally {
      setSedangEkspor(false);
    }
  };

  const handleCetak = () => {
    const judulAsli = document.title;
    document.title = data.nomor ? `Internal Memo - ${data.nomor}` : 'Internal Memo Perjalanan Dinas';
    window.print();
    setTimeout(() => {
      document.title = judulAsli;
    }, 1000);
  };

  const handleReset = () => {
    if (window.confirm('Kembalikan data formulir ke nilai bawaan template Excel?')) {
      setData(MEMO_DINAS_DEFAULT);
      notify('DATA DIRESET KE NILAI TEMPLATE BAWAAN');
    }
  };

  const handleSimpan = () => {
    onSimpan?.(data);
    notify('INTERNAL MEMO DINAS BERHASIL DISIMPAN');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex flex-col justify-between p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:fixed-none">
      {/* ================= TOP TOOLBAR (Hidden when Printing) ================= */}
      <header className="max-w-5xl mx-auto w-full mb-3 bg-slate-900 border-2 border-slate-700 p-2.5 sm:p-3 rounded-xl shadow-xl flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-amber-500 border-2 border-white rounded-lg flex items-center justify-center text-slate-950 font-bold shadow">
            <FileText size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-title text-white tracking-wide">
                FORM INTERNAL MEMO · PERJALANAN DINAS
              </h1>
              <span className="bg-emerald-900 text-emerald-300 text-[9px] px-2 py-0.5 rounded font-title border border-emerald-500/40">
                HASNUR GROUP
              </span>
            </div>
            <p className="text-[12px] text-slate-400 font-body">Format Resmi Template Excel · Live Preview &amp; Ekspor .xlsx</p>
          </div>
        </div>

        {/* Tab Switcher: Form vs Preview */}
        <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setMode('form')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
              mode === 'form' ? 'bg-amber-500 text-slate-950 shadow font-title text-[10px]' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Edit3 size={13} /> Form Input
          </button>
          <button
            onClick={() => setMode('preview')}
            className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
              mode === 'preview' ? 'bg-emerald-600 text-white shadow font-title text-[10px]' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Eye size={13} /> Pratinjau Surat
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleEksporExcel}
            disabled={sedangEkspor}
            className="btn-retro !bg-emerald-700 hover:!bg-emerald-600 !text-white !border-2 !border-white !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
            title="Unduh file Excel (.xlsx) dengan template asli"
          >
            <FileSpreadsheet size={14} className="text-emerald-300" />
            <span>{sedangEkspor ? 'Menyusun…' : 'Unduh .xlsx'}</span>
          </button>

          <button
            onClick={handleCetak}
            className="btn-retro !bg-sky-700 hover:!bg-sky-600 !text-white !border-2 !border-white !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
            title="Cetak atau simpan ke PDF"
          >
            <Printer size={14} className="text-sky-300" />
            <span className="hidden sm:inline">Cetak / PDF</span>
          </button>

          {onSimpan && (
            <button
              onClick={handleSimpan}
              className="btn-retro !bg-amber-600 hover:!bg-amber-500 !text-white !border-2 !border-white !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
              title="Simpan perubahan ke database memo"
            >
              <Save size={14} />
              <span className="hidden sm:inline">Simpan</span>
            </button>
          )}

          <button
            onClick={handleReset}
            className="btn-retro !bg-zinc-800 hover:!bg-zinc-700 !text-white !border-2 !border-zinc-500 !py-1.5 !px-2.5 text-xs font-bold"
            title="Kembalikan ke data bawaan Excel"
          >
            <RotateCcw size={13} />
          </button>

          <button
            onClick={onTutup}
            className="btn-retro !bg-red-700 hover:!bg-red-600 !text-white !border-2 !border-red-400 !py-1.5 !px-2.5 text-xs font-bold ml-1"
            title="Tutup (Esc)"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* ================= MAIN CONTENT AREA ================= */}
      <main className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-start items-center">
        {/* ================= MODE FORM INPUT ================= */}
        <div className={`w-full bg-zinc-900 border-2 border-slate-700 p-4 sm:p-6 rounded-xl shadow-2xl space-y-6 font-body print:hidden ${mode === 'form' ? 'block' : 'hidden'}`}>
            {/* SEKSI 1: KEPALA MEMO (METADATA) */}
            <div className="border-b border-zinc-700 pb-5">
              <h3 className="text-sm font-bold text-amber-400 font-title uppercase mb-3 flex items-center gap-2">
                <FileText size={16} /> 1. Kepala Surat &amp; Metadata
              </h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label-retro text-zinc-300 !mb-0">Nomor Memo</label>
                    <span className="text-[9px] text-lime-400 font-mono font-bold bg-lime-950/80 px-1.5 py-0.5 border border-lime-700/60 rounded">
                      Linked
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={data.nomor ?? ''}
                      onChange={(e) => setData({ ...data, nomor: e.target.value })}
                      placeholder="mis. 024/RNR-PD/IX/2026"
                      className="input-retro font-mono font-bold text-amber-300 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const gen = generateNomorSuratOtomatis('im', daftarSurat, data.tanggalBerangkat || new Date().toISOString());
                          setData({ ...data, nomor: gen.nomorSurat });
                          notify(`NOMOR DIGENERATE: ${gen.nomorSurat}`);
                        } catch {
                          notify('GAGAL GENERATE NOMOR');
                        }
                      }}
                      className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-white !py-1 !px-2 shrink-0"
                      title="Generate nomor urut IM berikutnya dari sistem penomoran"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Perihal</label>
                  <input
                    type="text"
                    value={data.perihal}
                    onChange={(e) => setData({ ...data, perihal: e.target.value })}
                    placeholder="Permohonan Perjalanan Dinas"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Kepada (Penerima)</label>
                  <input
                    type="text"
                    value={data.kepada}
                    onChange={(e) => setData({ ...data, kepada: e.target.value })}
                    placeholder="M. Yusriani"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Divisi / Bagian Penerima</label>
                  <input
                    type="text"
                    value={data.divisiKepada}
                    onChange={(e) => setData({ ...data, divisiKepada: e.target.value })}
                    placeholder="HCA Department"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Jabatan Penerima</label>
                  <input
                    type="text"
                    value={data.jabatanKepada}
                    onChange={(e) => setData({ ...data, jabatanKepada: e.target.value })}
                    placeholder="HCA Section Head"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Dari (Pengirim)</label>
                  <input
                    type="text"
                    value={data.dari}
                    onChange={(e) => setData({ ...data, dari: e.target.value })}
                    placeholder="Bambang Octaryono"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Divisi Pengirim</label>
                  <input
                    type="text"
                    value={data.divisiDari}
                    onChange={(e) => setData({ ...data, divisiDari: e.target.value })}
                    placeholder="Kepala Teknik Tambang"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Jabatan Pengirim</label>
                  <input
                    type="text"
                    value={data.jabatanDari}
                    onChange={(e) => setData({ ...data, jabatanDari: e.target.value })}
                    placeholder="Kepala Teknik Tambang"
                    className="input-retro"
                  />
                </div>
              </div>
            </div>

            {/* SEKSI 2: KARYAWAN YANG DITUGASKAN */}
            <div className="border-b border-zinc-700 pb-5">
              <h3 className="text-sm font-bold text-sky-400 font-title uppercase mb-3 flex items-center gap-2">
                <User size={16} /> 2. Karyawan yang Ditugaskan
              </h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="label-retro text-zinc-300">Nama Karyawan</label>
                  <input
                    type="text"
                    value={data.namaKaryawan}
                    onChange={(e) => setData({ ...data, namaKaryawan: e.target.value })}
                    placeholder="Agung Laksono"
                    className="input-retro font-bold text-amber-300"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Divisi / Department</label>
                  <input
                    type="text"
                    value={data.divisiKaryawan}
                    onChange={(e) => setData({ ...data, divisiKaryawan: e.target.value })}
                    placeholder="Revegetasi dan Rehabilitasi"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Jabatan</label>
                  <input
                    type="text"
                    value={data.jabatanKaryawan}
                    onChange={(e) => setData({ ...data, jabatanKaryawan: e.target.value })}
                    placeholder="Crew Revegetasi"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Tanggal Berangkat</label>
                  <input
                    type="date"
                    value={data.tanggalBerangkat}
                    onChange={(e) => setData({ ...data, tanggalBerangkat: e.target.value })}
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Tanggal Kembali</label>
                  <input
                    type="date"
                    value={data.tanggalKembali}
                    onChange={(e) => setData({ ...data, tanggalKembali: e.target.value })}
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Tempat Tujuan</label>
                  <input
                    type="text"
                    value={data.tempatTujuan}
                    onChange={(e) => setData({ ...data, tempatTujuan: e.target.value })}
                    placeholder="Aeris Hotel Banjarbaru"
                    className="input-retro"
                  />
                </div>
                <div className="sm:col-span-2 md:col-span-3">
                  <label className="label-retro text-zinc-300">Keperluan Perjalanan Dinas</label>
                  <textarea
                    rows={2}
                    value={data.keperluan}
                    onChange={(e) => setData({ ...data, keperluan: e.target.value })}
                    placeholder="Bimbingan Teknis Aplikasi SINERGY BPKH V"
                    className="input-retro resize-none"
                  />
                </div>
              </div>
            </div>

            {/* SEKSI 3: KEBUTUHAN BIAYA DINAS */}
            <div className="border-b border-zinc-700 pb-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-emerald-400 font-title uppercase flex items-center gap-2">
                  <DollarSign size={16} /> 3. Kebutuhan Biaya Dinas
                </h3>
                <span className="text-xs font-mono-code font-bold text-emerald-300 bg-emerald-950 px-2 py-1 rounded border border-emerald-600">
                  Total: {formatRupiah(totalBiaya)}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                <div>
                  <label className="label-retro text-zinc-300">Transportasi (Rp)</label>
                  <input
                    type="number"
                    value={data.biayaTransportasi ?? ''}
                    onChange={(e) => setData({ ...data, biayaTransportasi: e.target.value ? Number(e.target.value) : null })}
                    placeholder="300000"
                    className="input-retro font-mono-code"
                  />
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">{formatRupiah(data.biayaTransportasi)}</span>
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Penginapan (Rp)</label>
                  <input
                    type="number"
                    value={data.biayaPenginapan ?? ''}
                    onChange={(e) => setData({ ...data, biayaPenginapan: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0"
                    className="input-retro font-mono-code"
                  />
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">{formatRupiah(data.biayaPenginapan)}</span>
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Uang Makan (Rp)</label>
                  <input
                    type="number"
                    value={data.biayaUangMakan ?? ''}
                    onChange={(e) => setData({ ...data, biayaUangMakan: e.target.value ? Number(e.target.value) : null })}
                    placeholder="140000"
                    className="input-retro font-mono-code"
                  />
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">{formatRupiah(data.biayaUangMakan)}</span>
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Lain-lain (Rp)</label>
                  <input
                    type="number"
                    value={data.biayaLainLain ?? ''}
                    onChange={(e) => setData({ ...data, biayaLainLain: e.target.value ? Number(e.target.value) : null })}
                    placeholder="0"
                    className="input-retro font-mono-code"
                  />
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">{formatRupiah(data.biayaLainLain)}</span>
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Keterangan Lain-lain</label>
                  <input
                    type="text"
                    value={data.keteranganLainLain ?? ''}
                    onChange={(e) => setData({ ...data, keteranganLainLain: e.target.value })}
                    placeholder="mis. Bensin, Tol, Parkir"
                    className="input-retro"
                  />
                  <span className="text-[11px] text-zinc-400 mt-0.5 block">Uraian biaya lain-lain</span>
                </div>
              </div>

              {/* Biaya Tambahan Manual (Bisa Tambah Baris Dinamis) */}
              <div className="mt-4 pt-3 border-t border-zinc-700/80">
                <div className="flex items-center justify-between mb-2">
                  <label className="label-retro text-amber-300 flex items-center gap-1.5 !mb-0">
                    <span>Biaya Tambahan Lainnya (Input Manual)</span>
                  </label>
                  <button
                    type="button"
                    onClick={tambahItemBiaya}
                    className="btn-retro btn-retro-sm !bg-emerald-700 hover:!bg-emerald-600 !text-white !text-[11px] !py-1 !px-2.5 flex items-center gap-1"
                  >
                    <Plus size={12} /> Tambah Biaya Tambahan
                  </button>
                </div>

                {(!data.biayaTambahan || data.biayaTambahan.length === 0) ? (
                  <p className="text-[12px] text-zinc-500 italic py-1">Belum ada biaya tambahan. Klik tombol "+ Tambah Biaya Tambahan" untuk menambah rincian biaya tak terduga secara manual.</p>
                ) : (
                  <div className="space-y-2">
                    {data.biayaTambahan.map((tb, idx) => (
                      <div key={tb.id || idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-zinc-950/70 p-2 border border-zinc-700 rounded">
                        <div className="flex-1 min-w-[160px]">
                          <input
                            type="text"
                            value={tb.nama}
                            onChange={(e) => ubahItemBiaya(tb.id, { nama: e.target.value })}
                            placeholder="Nama / jenis biaya tambahan (mis. Sewa Mobil, Tes Lab, dll.)"
                            className="input-retro !py-1 !text-[12px]"
                          />
                        </div>
                        <div className="w-44 min-w-[120px]">
                          <input
                            type="number"
                            value={tb.nominal ?? ''}
                            onChange={(e) => ubahItemBiaya(tb.id, { nominal: e.target.value ? Number(e.target.value) : null })}
                            placeholder="Nominal Rp"
                            className="input-retro font-mono-code !py-1 !text-[12px]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => hapusItemBiaya(tb.id)}
                          className="btn-ikon !w-7 !h-7 !bg-red-700 hover:!bg-red-600 !text-white !border-2 !border-red-400 shrink-0"
                          title="Hapus baris biaya ini"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SEKSI 4: PENUTUP & TANDA TANGAN */}
            <div>
              <h3 className="text-sm font-bold text-purple-400 font-title uppercase mb-3 flex items-center gap-2">
                <CheckCircle2 size={16} /> 4. Penutup &amp; Tanda Tangan
              </h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="label-retro text-zinc-300">Salam Penutup</label>
                  <input
                    type="text"
                    value={data.hormatSaya ?? 'Hormat saya,'}
                    onChange={(e) => setData({ ...data, hormatSaya: e.target.value })}
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Nama Penandatangan</label>
                  <input
                    type="text"
                    value={data.namaPenandatangan || data.dari}
                    onChange={(e) => setData({ ...data, namaPenandatangan: e.target.value })}
                    placeholder="Bambang Octaryono"
                    className="input-retro font-bold text-amber-300"
                  />
                </div>
                <div>
                  <label className="label-retro text-zinc-300">Tembusan</label>
                  <input
                    type="text"
                    value={data.tembusan ?? 'Tembusan : Karyawan yang ditugaskan.'}
                    onChange={(e) => setData({ ...data, tembusan: e.target.value })}
                    className="input-retro"
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-zinc-700 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={() => setMode('preview')}
                className="btn-retro !bg-emerald-600 hover:!bg-emerald-500 !text-white !py-2 !px-4 text-xs font-bold flex items-center gap-2"
              >
                <Eye size={15} /> Lihat Pratinjau Surat Resmi
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEksporExcel}
                  className="btn-retro !bg-emerald-700 hover:!bg-emerald-600 !text-white !py-2 !px-4 text-xs font-bold flex items-center gap-2"
                >
                  <FileSpreadsheet size={15} /> Unduh Excel (.xlsx)
                </button>
                {onSimpan && (
                  <button
                    onClick={handleSimpan}
                    className="btn-retro !bg-amber-600 hover:!bg-amber-500 !text-white !py-2 !px-4 text-xs font-bold flex items-center gap-2"
                  >
                    <Save size={15} /> Simpan
                  </button>
                )}
              </div>
            </div>
          </div>

        {/* ================= DOKUMEN RESMI A4 (SESUAI TEMPLATE EXCEL ASLI) ================= */}
        <div
          id="dokumen-memo-a4"
          className={`w-full max-w-[210mm] bg-white text-black p-8 sm:p-12 shadow-2xl border border-slate-300 rounded-lg relative my-4 a4-print-document print:my-0 print:p-0 print:border-0 print:shadow-none print:max-w-none print:w-full ${
            mode === 'form' ? 'hidden print:block' : 'block'
          }`}
          style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
        >
          {/* Header: Logo Hasnur Group di kiri (dengan garis bawah logo), WordArt "Internal Memo" di kanan */}
          <div className="flex items-start justify-between pb-2 mb-4">
            <div className="flex flex-col items-start">
              <img
                src={LOGO_HASNUR_BASE64}
                alt="Logo Hasnur Group"
                className="h-14 w-auto object-contain mb-1"
              />
              <div className="border-b-2 border-black w-40" />
            </div>
            <div className="text-right pt-2">
              <h1
                className="text-3xl sm:text-4xl font-black italic tracking-wide uppercase"
                style={{
                  fontFamily: "'Arial Black', Arial, sans-serif",
                  color: '#ffffff',
                  WebkitTextStroke: '1.5px #000000',
                  textShadow: '0 0 1px #000000',
                }}
              >
                Internal Memo
              </h1>
            </div>
          </div>

          {/* Tabel Metadata (Baris 8 - 15 Sesuai Excel Asli: Tanpa Titik Dua, Nilai Bergaris Bawah Solid) */}
          <div className="text-[13px] leading-relaxed text-black mb-3 space-y-1">
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Nomor</div>
              <div className="col-span-9 border-b border-black/80 font-mono text-[13px] pb-0.5">
                {data.nomor || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Kepada</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.kepada || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Divisi/ Bagian</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.divisiKepada || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Jabatan</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.jabatanKepada || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Dari</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.dari || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Divisi/ Bagian</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.divisiDari || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Jabatan</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.jabatanDari || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Perihal</div>
              <div className="col-span-9 border-b border-black/80 font-bold italic pb-0.5">
                {data.perihal || '\u00A0'}
              </div>
            </div>
          </div>

          {/* Garis Pembatas Tebal (Sesuai Baris 16 Excel: A16:I16) */}
          <div className="border-b border-black my-4" />

          {/* Pernyataan Penugasan (Baris 18 Excel) */}
          <p className="text-[13px] text-black mb-3">
            Dengan ini kami menugaskan untuk melakukan Perjalanan Dinas kepada :
          </p>

          {/* Data Karyawan yang Ditugaskan (Baris 20 - 26 Sesuai Excel Asli: Tanpa Titik Dua) */}
          <div className="text-[13px] leading-relaxed text-black mb-4 space-y-1">
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Nama</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.namaKaryawan || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Divisi/ Department</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.divisiKaryawan || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Jabatan</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.jabatanKaryawan || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Tanggal Berangkat</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {formatTanggalExcel(data.tanggalBerangkat)}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Tanggal Kembali</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {formatTanggalExcel(data.tanggalKembali)}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Tempat Tujuan</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.tempatTujuan || '\u00A0'}
              </div>
            </div>
            <div className="grid grid-cols-12 gap-x-2 items-end min-h-[22px]">
              <div className="col-span-3 text-black">Keperluan</div>
              <div className="col-span-9 border-b border-black/80 pb-0.5">
                {data.keperluan || '\u00A0'}
              </div>
            </div>
          </div>

          {/* Kebutuhan Biaya Dinas (Baris 28 - 35 Sesuai Excel Asli: Garis Bawah Menerus, Angka Tanpa Rp) */}
          <div className="text-[13px] leading-relaxed text-black mb-4">
            <p className="font-bold text-black mb-2">Kebutuhan Biaya Dinas :</p>
            <div className="space-y-1.5">
              <div className="flex items-end min-h-[22px]">
                <div className="w-28 shrink-0 text-black">Transportasi :</div>
                <div className="flex-1 border-b border-black pb-0.5 flex items-center">
                  <span className="w-28 text-center font-mono">
                    {data.biayaTransportasi ? formatAngkaRibuan(data.biayaTransportasi) : '\u00A0'}
                  </span>
                </div>
              </div>
              <div className="flex items-end min-h-[22px]">
                <div className="w-28 shrink-0 text-black">Penginapan :</div>
                <div className="flex-1 border-b border-black pb-0.5 flex items-center">
                  <span className="w-28 text-center font-mono">
                    {data.biayaPenginapan ? formatAngkaRibuan(data.biayaPenginapan) : '\u00A0'}
                  </span>
                </div>
              </div>
              <div className="flex items-end min-h-[22px]">
                <div className="w-28 shrink-0 text-black">Uang Makan :</div>
                <div className="flex-1 border-b border-black pb-0.5 flex items-center">
                  <span className="w-28 text-center font-mono">
                    {data.biayaUangMakan ? formatAngkaRibuan(data.biayaUangMakan) : '\u00A0'}
                  </span>
                </div>
              </div>
              <div className="flex items-end min-h-[22px]">
                <div className="w-28 shrink-0 text-black">
                  Lain-lain{data.keteranganLainLain ? ` (${data.keteranganLainLain})` : ''} :
                </div>
                <div className="flex-1 border-b border-black pb-0.5 flex items-center">
                  <span className="w-28 text-center font-mono">
                    {data.biayaLainLain ? formatAngkaRibuan(data.biayaLainLain) : '\u00A0'}
                  </span>
                </div>
              </div>

              {/* Item Biaya Tambahan Manual */}
              {(data.biayaTambahan || []).map((tb, idx) => (
                <div key={tb.id || idx} className="flex items-end min-h-[22px]">
                  <div className="w-28 shrink-0 text-black truncate">{tb.nama || 'Tambahan'} :</div>
                  <div className="flex-1 border-b border-black pb-0.5 flex items-center">
                    <span className="w-28 text-center font-mono">
                      {tb.nominal ? formatAngkaRibuan(tb.nominal) : '\u00A0'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Kalimat Penutup (Baris 37 - 38 Excel) */}
          <p className="text-[13px] text-black leading-relaxed mb-6">
            Demikian, agar dapat dibantu penyediaan transportasi, akomodasi, dan lain-lain yang diperlukan sesuai dengan standar yang berlaku di perusahaan.
          </p>

          {/* Tanda Tangan (Baris 40 - 45 Sesuai Excel: Garis Bawah Hanya Selebar Kolom B-E) */}
          <div className="mb-6">
            <p className="text-[13px] text-black mb-14">{data.hormatSaya ?? 'Hormat saya,'}</p>
            <div className="inline-block border-b border-black min-w-[220px] text-center pb-0.5">
              <p className="text-[13px] text-black">
                {data.namaPenandatangan || data.dari || '\u00A0'}
              </p>
            </div>
          </div>

          {/* Tembusan (Baris 47 Excel: Italic) */}
          <p className="text-[12px] text-black italic">
            {data.tembusan ?? 'Tembusan : Karyawan yang ditugaskan.'}
          </p>
        </div>
      </main>

      {/* Gaya cetak A4 yang presisi & isolasi dokumen */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 15mm 10mm 15mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            overflow: visible !important;
          }
          /* Sembunyikan seluruh UI latar belakang aplikasi Pokemonkey */
          body > * {
            visibility: hidden !important;
          }
          /* Hanya tampilkan dokumen A4 resmi */
          #dokumen-memo-a4, #dokumen-memo-a4 * {
            visibility: visible !important;
          }
          #dokumen-memo-a4 {
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
        }
      `}</style>
    </div>
  );
};
