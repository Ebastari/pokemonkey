import React, { useState, useEffect, useMemo } from 'react';
import {
  Coins, FileSpreadsheet, Download, RefreshCw, Eye, Edit3, Plus, Trash2,
  Calendar, MapPin, CheckCircle2, ChevronRight, FileText, ArrowLeft,
  Building, DollarSign, Loader2, Sparkles, Printer, Search, Copy,
  Clock, AlertCircle, XCircle, Check, X, ShieldAlert,
  Filter,
} from 'lucide-react';
import {
  type DataRabHcga,
  type KategoriRab,
  type MingguRab,
  type ItemRab,
  type StatusPermohonanRab,
  type PermohonanRab,
  DAFTAR_BULAN,
  BULAN_ROMAWI,
  muatDaftarPermohonan,
  simpanDaftarPermohonan,
  buatPermohonanBaru,
  hitungMetrikTracking,
  hitungTotalItem,
  hitungSubtotalMinggu,
  hitungTotalKategori,
  hitungGrandTotal,
  formatRupiah,
  eksporRabKeExcel,
} from '../lib/rab-hcga';
import type { Pengguna } from '../lib/tipe-api';

interface Props {
  pengguna: Pengguna;
  notify: (pesan: string) => void;
}

const DAFTAR_STATUS: StatusPermohonanRab[] = [
  'Draf',
  'Diajukan',
  'Verifikasi',
  'Disetujui',
  'Dicairkan',
  'Ditolak',
];

const WARNA_STATUS: Record<
  StatusPermohonanRab,
  { bg: string; text: string; border: string; badge: string; label: string }
> = {
  Draf: {
    bg: 'bg-zinc-800/80',
    text: 'text-zinc-300',
    border: 'border-zinc-500',
    badge: 'bg-zinc-700 text-zinc-200 border-zinc-500',
    label: 'DRAF',
  },
  Diajukan: {
    bg: 'bg-blue-950/70',
    text: 'text-blue-300',
    border: 'border-blue-500',
    badge: 'bg-blue-900/80 text-blue-200 border-blue-400',
    label: 'DIAJUKAN',
  },
  Verifikasi: {
    bg: 'bg-amber-950/70',
    text: 'text-amber-300',
    border: 'border-amber-500',
    badge: 'bg-amber-900/80 text-amber-200 border-amber-400',
    label: 'VERIFIKASI',
  },
  Disetujui: {
    bg: 'bg-emerald-950/70',
    text: 'text-emerald-300',
    border: 'border-emerald-500',
    badge: 'bg-emerald-900/80 text-emerald-200 border-emerald-400',
    label: 'DISETUJUI',
  },
  Dicairkan: {
    bg: 'bg-cyan-950/70',
    text: 'text-cyan-300',
    border: 'border-cyan-500',
    badge: 'bg-cyan-900/80 text-cyan-200 border-cyan-400',
    label: 'DICAIRKAN',
  },
  Ditolak: {
    bg: 'bg-rose-950/70',
    text: 'text-rose-300',
    border: 'border-rose-500',
    badge: 'bg-rose-900/80 text-rose-200 border-rose-400',
    label: 'DITOLAK',
  },
};

export const MoneyMonkeyScreen: React.FC<Props> = ({ pengguna, notify }) => {
  // ---------------------------------------------------------------------------
  // STATE DAFTAR PERMOHONAN & TRACKING
  // ---------------------------------------------------------------------------
  const [daftarPermohonan, setDaftarPermohonan] = useState<PermohonanRab[]>(() =>
    muatDaftarPermohonan(pengguna),
  );
  const [idPermohonanAktif, setIdPermohonanAktif] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('semua');
  const [pencarian, setPencarian] = useState<string>('');
  const [sedangEksporId, setSedangEksporId] = useState<string | null>(null);

  // State Modal Tambah Permohonan Baru
  const [modalTambahTerbuka, setModalTambahTerbuka] = useState(false);
  const [formBulan, setFormBulan] = useState<string>('November');
  const [formTahun, setFormTahun] = useState<number>(2026);
  const [formJudul, setFormJudul] = useState<string>('');
  const [formNomorRab, setFormNomorRab] = useState<string>('');
  const [formLokasi, setFormLokasi] = useState<string>('Site EBL - RANTAU');
  const [formSalinContoh, setFormSalinContoh] = useState<boolean>(true);

  // State di dalam Form Editor (jika ada permohonan aktif terpilih)
  const [editorMode, setEditorMode] = useState<'rekap' | 'rincian' | 'pratinjau'>('rekap');
  const [kategoriTerpilihId, setKategoriTerpilihId] = useState<string>('pantry');
  const [mingguTerpilih, setMingguTerpilih] = useState<number>(0); // 0=Semua, 1=W1, 2=W2, 3=W3, 4=W4

  // Simpan otomatis ke localStorage setiap perubahan daftar
  useEffect(() => {
    simpanDaftarPermohonan(daftarPermohonan);
  }, [daftarPermohonan]);

  // Permohonan yang sedang diedit
  const permohonanAktif = useMemo(() => {
    if (!idPermohonanAktif) return null;
    return daftarPermohonan.find((p) => p.id === idPermohonanAktif) || null;
  }, [daftarPermohonan, idPermohonanAktif]);

  // Metrik tracking ringkasan
  const metrik = useMemo(() => {
    return hitungMetrikTracking(daftarPermohonan);
  }, [daftarPermohonan]);

  // Filter daftar pengajuan di dashboard
  const daftarTerfilter = useMemo(() => {
    return daftarPermohonan.filter((item) => {
      if (filterStatus !== 'semua' && item.status !== filterStatus) {
        return false;
      }
      if (pencarian.trim()) {
        const cari = pencarian.toLowerCase();
        const cocokJudul = item.judul.toLowerCase().includes(cari);
        const cocokNomor = item.nomorRab.toLowerCase().includes(cari);
        const cocokPemohon = item.pemohonNama.toLowerCase().includes(cari);
        const cocokBulan = item.bulan.toLowerCase().includes(cari);
        const cocokLokasi = (item.data.header.lokasi || '').toLowerCase().includes(cari);
        if (!cocokJudul && !cocokNomor && !cocokPemohon && !cocokBulan && !cocokLokasi) {
          return false;
        }
      }
      return true;
    });
  }, [daftarPermohonan, filterStatus, pencarian]);

  // Grand total permohonan aktif
  const totalsAktif = useMemo(() => {
    if (!permohonanAktif) return { perMinggu: [0, 0, 0, 0] as [number, number, number, number], grandTotal: 0 };
    return hitungGrandTotal(permohonanAktif.data);
  }, [permohonanAktif]);

  const kategoriAktif = useMemo(() => {
    if (!permohonanAktif) return null;
    return (
      permohonanAktif.data.kategori.find((k) => k.id === kategoriTerpilihId) ||
      permohonanAktif.data.kategori[0]
    );
  }, [permohonanAktif, kategoriTerpilihId]);

  // ---------------------------------------------------------------------------
  // HANDLERS DASHBOARD & PERMOHONAN BARU
  // ---------------------------------------------------------------------------
  const handleBukaModalTambah = () => {
    const defaultBulan = 'November';
    const defaultTahun = 2026;
    const romawi = BULAN_ROMAWI[defaultBulan] || 'XI';
    setFormBulan(defaultBulan);
    setFormTahun(defaultTahun);
    setFormJudul(`RAB HCGA Site - ${defaultBulan} ${defaultTahun}`);
    setFormNomorRab(`RAB/EBL-HCGA/${romawi}/${defaultTahun}`);
    setFormLokasi('Site EBL - RANTAU');
    setFormSalinContoh(true);
    setModalTambahTerbuka(true);
  };

  const handleUbahBulanForm = (bulan: string) => {
    setFormBulan(bulan);
    const romawi = BULAN_ROMAWI[bulan] || 'I';
    setFormJudul(`RAB HCGA Site - ${bulan} ${formTahun}`);
    setFormNomorRab(`RAB/EBL-HCGA/${romawi}/${formTahun}`);
  };

  const handleUbahTahunForm = (tahun: number) => {
    setFormTahun(tahun);
    const romawi = BULAN_ROMAWI[formBulan] || 'I';
    setFormJudul(`RAB HCGA Site - ${formBulan} ${tahun}`);
    setFormNomorRab(`RAB/EBL-HCGA/${romawi}/${tahun}`);
  };

  const handleSimpanPermohonanBaru = (e: React.FormEvent) => {
    e.preventDefault();
    const baru = buatPermohonanBaru({
      judul: formJudul,
      bulan: formBulan,
      tahun: formTahun,
      nomorRab: formNomorRab,
      lokasi: formLokasi,
      salinDataContoh: formSalinContoh,
      pengguna,
    });

    setDaftarPermohonan((prev) => [baru, ...prev]);
    setModalTambahTerbuka(false);
    setIdPermohonanAktif(baru.id);
    setEditorMode('rekap');
    notify(`PERMOHONAN BARU ${baru.nomorRab} BERHASIL DIBUAT`);
  };

  const handleUbahStatus = (id: string, statusBaru: StatusPermohonanRab) => {
    setDaftarPermohonan((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          status: statusBaru,
          diubahPada: new Date().toISOString(),
        };
      }),
    );
    notify(`STATUS PENGAJUAN DIUBAH KE ${statusBaru.toUpperCase()}`);
  };

  const handleDuplikat = (item: PermohonanRab) => {
    const salinanData: DataRabHcga = JSON.parse(JSON.stringify(item.data));
    const nowStr = new Date().toISOString();
    const duplikat: PermohonanRab = {
      ...item,
      id: `rab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      judul: `${item.judul} (Salinan)`,
      status: 'Draf',
      tanggalPengajuan: nowStr.slice(0, 10),
      dibuatPada: nowStr,
      diubahPada: nowStr,
      data: salinanData,
    };
    setDaftarPermohonan((prev) => [duplikat, ...prev]);
    notify(`PENGAJUAN BERHASIL DIDUPLIKASI SEBAGAI DRAF`);
  };

  const handleHapusPermohonan = (id: string) => {
    const target = daftarPermohonan.find((p) => p.id === id);
    if (!target) return;
    if (confirm(`Yakin ingin menghapus pengajuan "${target.judul}" (${target.nomorRab})?`)) {
      setDaftarPermohonan((prev) => prev.filter((p) => p.id !== id));
      if (idPermohonanAktif === id) {
        setIdPermohonanAktif(null);
      }
      notify(`PENGAJUAN ${target.nomorRab} TELAH DIHAPUS`);
    }
  };

  const handleUnduhExcelPermohonan = async (item: PermohonanRab) => {
    setSedangEksporId(item.id);
    try {
      await eksporRabKeExcel(item.data);
      notify(`EXCEL ${item.nomorRab} BERHASIL DIUNDUH`);
    } catch (err) {
      notify(err instanceof Error ? err.message.toUpperCase() : 'GAGAL MENGEKSPOR EXCEL');
    } finally {
      setSedangEksporId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS DI DALAM FORM EDITOR
  // ---------------------------------------------------------------------------
  const handleUbahHeaderAktif = (
    kunci: keyof DataRabHcga['header'],
    nilai: string | number,
  ) => {
    if (!permohonanAktif) return;
    setDaftarPermohonan((prev) =>
      prev.map((item) => {
        if (item.id !== permohonanAktif.id) return item;
        const dataBaru: DataRabHcga = {
          ...item.data,
          header: {
            ...item.data.header,
            [kunci]: nilai,
          },
        };
        return {
          ...item,
          nomorRab: kunci === 'nomorRab' ? String(nilai) : item.nomorRab,
          bulan: kunci === 'bulan' ? String(nilai) : item.bulan,
          tahun: kunci === 'tahun' ? Number(nilai) : item.tahun,
          data: dataBaru,
          diubahPada: new Date().toISOString(),
        };
      }),
    );
  };

  const handleUbahItemAktif = (
    kategoriId: string,
    mingguKe: number,
    itemId: string,
    patch: Partial<ItemRab>,
  ) => {
    if (!permohonanAktif) return;
    setDaftarPermohonan((prev) =>
      prev.map((item) => {
        if (item.id !== permohonanAktif.id) return item;
        const dataBaru: DataRabHcga = {
          ...item.data,
          kategori: item.data.kategori.map((k) => {
            if (k.id !== kategoriId) return k;
            return {
              ...k,
              minggu: k.minggu.map((m) => {
                if (m.mingguKe !== mingguKe) return m;
                return {
                  ...m,
                  items: m.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
                };
              }),
            };
          }),
        };
        const tot = hitungGrandTotal(dataBaru).grandTotal;
        return {
          ...item,
          data: dataBaru,
          totalNominal: tot,
          diubahPada: new Date().toISOString(),
        };
      }),
    );
  };

  const handleTambahItemAktif = (kategoriId: string, mingguKe: number) => {
    if (!permohonanAktif) return;
    const baru: ItemRab = {
      id: `${kategoriId}-w${mingguKe}-${Date.now()}`,
      namaBarang: '',
      qty: 1,
      satuan: 'Pcs',
      hargaSatuan: 0,
    };

    setDaftarPermohonan((prev) =>
      prev.map((item) => {
        if (item.id !== permohonanAktif.id) return item;
        const dataBaru: DataRabHcga = {
          ...item.data,
          kategori: item.data.kategori.map((k) => {
            if (k.id !== kategoriId) return k;
            return {
              ...k,
              minggu: k.minggu.map((m) => {
                if (m.mingguKe !== mingguKe) return m;
                return {
                  ...m,
                  items: [...m.items, baru],
                };
              }),
            };
          }),
        };
        const tot = hitungGrandTotal(dataBaru).grandTotal;
        return {
          ...item,
          data: dataBaru,
          totalNominal: tot,
          diubahPada: new Date().toISOString(),
        };
      }),
    );
  };

  const handleHapusItemAktif = (kategoriId: string, mingguKe: number, itemId: string) => {
    if (!permohonanAktif) return;
    setDaftarPermohonan((prev) =>
      prev.map((item) => {
        if (item.id !== permohonanAktif.id) return item;
        const dataBaru: DataRabHcga = {
          ...item.data,
          kategori: item.data.kategori.map((k) => {
            if (k.id !== kategoriId) return k;
            return {
              ...k,
              minggu: k.minggu.map((m) => {
                if (m.mingguKe !== mingguKe) return m;
                return {
                  ...m,
                  items: m.items.filter((it) => it.id !== itemId),
                };
              }),
            };
          }),
        };
        const tot = hitungGrandTotal(dataBaru).grandTotal;
        return {
          ...item,
          data: dataBaru,
          totalNominal: tot,
          diubahPada: new Date().toISOString(),
        };
      }),
    );
  };

  // ===========================================================================
  // TAMPILAN 1: DASHBOARD TRACKING & DAFTAR PENGAJUAN (Saat tidak memilih permohonan)
  // ===========================================================================
  if (!permohonanAktif) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-black/40">
        {/* Header Toolbar Dashboard */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-4 border-white pb-2 mb-2 px-2 pt-2 bg-black/60 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="judul-layar flex items-center gap-2">
              <Coins size={18} className="text-yellow-400" /> MONEY MONKEY
            </h2>
            <span className="text-[11px] font-mono text-zinc-400 hidden md:inline">
              | TRACKING & PENGAJUAN RAB HCGA SITE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBukaModalTambah}
              className="btn-retro bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 !py-1.5 text-[12px] shadow-[2px_2px_0_#000]"
            >
              <Plus size={15} /> + Permohonan Baru
            </button>
          </div>
        </div>

        {/* Konten Dashboard (Bisa Di-scroll) */}
        <div className="flex-1 overflow-auto custom-scrollbar px-2 pb-4 space-y-3 min-h-0">
          {/* ================================================================ */}
          {/* KARTU METRIK TRACKING                                            */}
          {/* ================================================================ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Total Pengajuan */}
            <div className="panel-retro bg-black/60 border-2 border-white/30 p-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-blue-900/60 border border-blue-400 flex items-center justify-center text-blue-300 shrink-0">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                  Total Pengajuan
                </span>
                <span className="text-[17px] font-black text-white font-mono leading-none">
                  {metrik.totalPengajuan}{' '}
                  <span className="text-[11px] font-normal text-zinc-400">Berkas</span>
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  Draf: {metrik.countDraf} · Aktif: {metrik.totalPengajuan - metrik.countDraf}
                </span>
              </div>
            </div>

            {/* Total Nominal RAB */}
            <div className="panel-retro bg-black/60 border-2 border-white/30 p-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-yellow-900/60 border border-yellow-400 flex items-center justify-center text-yellow-300 shrink-0">
                <DollarSign size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-zinc-400 uppercase font-mono block">
                  Total Anggaran Pengajuan
                </span>
                <span className="text-[15px] font-black text-yellow-300 font-mono leading-none truncate block">
                  {formatRupiah(metrik.totalNominalSemua)}
                </span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  Akumulasi seluruh permohonan
                </span>
              </div>
            </div>

            {/* Disetujui / Dicairkan */}
            <div className="panel-retro bg-black/60 border-2 border-emerald-500/50 p-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-emerald-900/60 border border-emerald-400 flex items-center justify-center text-emerald-300 shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-emerald-300 uppercase font-mono block">
                  Disetujui / Cair ({metrik.countDisetujui + metrik.countDicairkan})
                </span>
                <span className="text-[15px] font-black text-emerald-400 font-mono leading-none truncate block">
                  {formatRupiah(metrik.totalNominalDisetujui)}
                </span>
                <span className="text-[10px] text-emerald-400/70 block mt-0.5">
                  Disetujui: {metrik.countDisetujui} · Cair: {metrik.countDicairkan}
                </span>
              </div>
            </div>

            {/* Dalam Proses */}
            <div className="panel-retro bg-black/60 border-2 border-blue-500/50 p-2.5 flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-blue-900/60 border border-blue-400 flex items-center justify-center text-blue-300 shrink-0">
                <Clock size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-blue-300 uppercase font-mono block">
                  Proses Approval ({metrik.countDiajukan + metrik.countVerifikasi})
                </span>
                <span className="text-[15px] font-black text-blue-300 font-mono leading-none truncate block">
                  {formatRupiah(metrik.totalNominalDiajukan)}
                </span>
                <span className="text-[10px] text-blue-300/70 block mt-0.5">
                  Diajukan: {metrik.countDiajukan} · Verifikasi: {metrik.countVerifikasi}
                </span>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* FILTER & PENCARIAN PENGAJUAN                                     */}
          {/* ================================================================ */}
          <div className="bg-black/60 border border-white/20 p-2.5 flex flex-wrap items-center justify-between gap-2.5 text-[12px]">
            {/* Filter Status Chips */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-zinc-400 font-mono text-[11px] mr-1 flex items-center gap-1">
                <Filter size={12} /> Status:
              </span>
              <button
                onClick={() => setFilterStatus('semua')}
                className={`px-2 py-0.5 font-bold uppercase text-[11px] border transition-colors ${
                  filterStatus === 'semua'
                    ? 'bg-amber-600 text-white border-amber-400 shadow-[1px_1px_0_#000]'
                    : 'bg-black/40 text-zinc-400 border-white/20 hover:text-white'
                }`}
              >
                Semua ({metrik.totalPengajuan})
              </button>
              {DAFTAR_STATUS.map((st) => {
                let jml = 0;
                if (st === 'Draf') jml = metrik.countDraf;
                else if (st === 'Diajukan') jml = metrik.countDiajukan;
                else if (st === 'Verifikasi') jml = metrik.countVerifikasi;
                else if (st === 'Disetujui') jml = metrik.countDisetujui;
                else if (st === 'Dicairkan') jml = metrik.countDicairkan;
                else if (st === 'Ditolak') jml = metrik.countDitolak;

                const aktif = filterStatus === st;
                return (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-2 py-0.5 font-bold uppercase text-[11px] border transition-colors flex items-center gap-1 ${
                      aktif
                        ? `${WARNA_STATUS[st].badge} shadow-[1px_1px_0_#000]`
                        : 'bg-black/40 text-zinc-400 border-white/20 hover:text-white'
                    }`}
                  >
                    <span>{st}</span>
                    <span className="text-[10px] opacity-80 font-mono">({jml})</span>
                  </button>
                );
              })}
            </div>

            {/* Input Pencarian */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="text"
                  value={pencarian}
                  onChange={(e) => setPencarian(e.target.value)}
                  placeholder="Cari No RAB, Judul, Pemohon..."
                  className="input-retro !pl-8 !py-1 !text-[12px] w-full"
                />
              </div>
              {pencarian && (
                <button
                  onClick={() => setPencarian('')}
                  className="text-zinc-400 hover:text-white p-1 text-[11px]"
                  title="Bersihkan pencarian"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* ================================================================ */}
          {/* TABEL DAFTAR PENGAJUAN & TRACKING STATUS                        */}
          {/* ================================================================ */}
          <div className="border-[3px] border-white/40 overflow-x-auto shadow-lg bg-black/60">
            <table className="w-full text-[12px] border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-[#2f5d33] text-white uppercase text-[11px]">
                  <th className="p-2 border border-white/20 text-center w-10">No</th>
                  <th className="p-2 border border-white/20 text-left min-w-[180px]">
                    No. RAB & Judul
                  </th>
                  <th className="p-2 border border-white/20 text-left w-36">Periode & Lokasi</th>
                  <th className="p-2 border border-white/20 text-left w-32">Pengaju</th>
                  <th className="p-2 border border-white/20 text-right w-36 bg-[#224425]">
                    Total Anggaran
                  </th>
                  <th className="p-2 border border-white/20 text-center w-36">Status Tracking</th>
                  <th className="p-2 border border-white/20 text-center w-36">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftarTerfilter.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-500 font-mono">
                      Tidak ada permohonan RAB yang cocok dengan kriteria pencarian / filter.
                    </td>
                  </tr>
                ) : (
                  daftarTerfilter.map((item, idx) => {
                    const warna = WARNA_STATUS[item.status];
                    const sedangUnduh = sedangEksporId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-amber-500/10 transition-colors ${
                          idx % 2 === 0 ? 'bg-black/40' : 'bg-white/5'
                        }`}
                      >
                        <td className="p-2 border border-white/10 text-center text-zinc-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-2 border border-white/10">
                          <button
                            type="button"
                            onClick={() => {
                              setIdPermohonanAktif(item.id);
                              setEditorMode('rekap');
                            }}
                            className="font-bold text-left text-white hover:text-amber-300 block hover:underline"
                          >
                            {item.judul}
                          </button>
                          <span className="text-[11px] font-mono text-cyan-300 block">
                            {item.nomorRab}
                          </span>
                        </td>
                        <td className="p-2 border border-white/10 text-[11px] text-zinc-300">
                          <span className="font-semibold block text-zinc-200">
                            {item.bulan} {item.tahun}
                          </span>
                          <span className="text-zinc-400 text-[10px] block truncate max-w-[140px]">
                            {item.data.header.lokasi}
                          </span>
                        </td>
                        <td className="p-2 border border-white/10 text-[11px]">
                          <span className="font-semibold text-zinc-200 block truncate max-w-[120px]">
                            {item.pemohonNama}
                          </span>
                          <span className="text-zinc-500 font-mono text-[10px] block">
                            {item.tanggalPengajuan}
                          </span>
                        </td>
                        <td className="p-2 border border-white/10 text-right font-mono font-bold text-emerald-400 bg-emerald-950/20 text-[13px]">
                          {formatRupiah(item.totalNominal)}
                        </td>
                        {/* Selector Status Cepat */}
                        <td className="p-2 border border-white/10 text-center">
                          <select
                            value={item.status}
                            onChange={(e) =>
                              handleUbahStatus(item.id, e.target.value as StatusPermohonanRab)
                            }
                            className={`px-2 py-1 text-[11px] font-bold uppercase rounded border transition-colors cursor-pointer ${warna.badge}`}
                          >
                            {DAFTAR_STATUS.map((st) => (
                              <option key={st} value={st} className="bg-zinc-900 text-white">
                                {st}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Aksi Bar */}
                        <td className="p-2 border border-white/10 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIdPermohonanAktif(item.id);
                                setEditorMode('rekap');
                              }}
                              className="btn-retro btn-retro-sm bg-amber-600 hover:bg-amber-500 text-[11px] inline-flex items-center gap-1 font-bold"
                              title="Buka dan Edit Formulir RAB"
                            >
                              <Edit3 size={11} /> Buka
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUnduhExcelPermohonan(item)}
                              disabled={sedangUnduh}
                              className="btn-retro btn-retro-sm bg-emerald-700 hover:bg-emerald-600 text-[11px] inline-flex items-center gap-1 font-bold"
                              title="Unduh Excel (.xlsx 11 sheet)"
                            >
                              {sedangUnduh ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Download size={11} />
                              )}
                              <span className="hidden xl:inline">Excel</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplikat(item)}
                              className="btn-ikon !w-6 !h-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                              title="Duplikat Pengajuan"
                            >
                              <Copy size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleHapusPermohonan(item.id)}
                              className="btn-ikon !w-6 !h-6 bg-rose-950 hover:bg-rose-800 text-rose-300"
                              title="Hapus Pengajuan"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Tips Info Panel */}
          <div className="p-3 bg-amber-950/40 border border-amber-500/40 flex items-start gap-2.5 text-[12px] text-zinc-300">
            <Sparkles size={16} className="text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300 block mb-0.5">
                Petunjuk Manajemen Money Monkey:
              </span>
              <p>
                Klik <b>"+ Permohonan Baru"</b> untuk membuat pengajuan RAB bulan berikutnya. Anda
                bisa langsung melacak status approval (Draf, Diajukan, Verifikasi, Disetujui,
                Dicairkan, Ditolak) serta mengunduh format berkas Excel resmi 11 sheet sesuai template
                site.
              </p>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* MODAL BUAT PERMOHONAN BARU                                        */}
        {/* ================================================================= */}
        {modalTambahTerbuka && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-zinc-900 border-4 border-white p-5 max-w-lg w-full shadow-[8px_8px_0_#000] relative">
              <div className="flex items-center justify-between border-b-2 border-white/20 pb-2 mb-4">
                <h3 className="text-[14px] font-title text-yellow-300 flex items-center gap-2">
                  <Coins size={16} /> TAMBAH PERMOHONAN RAB BARU
                </h3>
                <button
                  onClick={() => setModalTambahTerbuka(false)}
                  className="text-zinc-400 hover:text-white p-1"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSimpanPermohonanBaru} className="space-y-3 text-[12px]">
                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Judul Permohonan:</label>
                  <input
                    type="text"
                    required
                    value={formJudul}
                    onChange={(e) => setFormJudul(e.target.value)}
                    className="input-retro w-full"
                    placeholder="Contoh: RAB HCGA Site - November 2026"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Periode Bulan:</label>
                    <select
                      value={formBulan}
                      onChange={(e) => handleUbahBulanForm(e.target.value)}
                      className="input-retro w-full"
                    >
                      {DAFTAR_BULAN.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-bold mb-1">Tahun Anggaran:</label>
                    <input
                      type="number"
                      required
                      value={formTahun}
                      onChange={(e) => handleUbahTahunForm(Number(e.target.value) || 2026)}
                      className="input-retro w-full font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Nomor Dokumen RAB:</label>
                  <input
                    type="text"
                    required
                    value={formNomorRab}
                    onChange={(e) => setFormNomorRab(e.target.value)}
                    className="input-retro w-full font-mono"
                    placeholder="Contoh: RAB/EBL-HCGA/XI/2026"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-bold mb-1">Lokasi Site / Project:</label>
                  <input
                    type="text"
                    value={formLokasi}
                    onChange={(e) => setFormLokasi(e.target.value)}
                    className="input-retro w-full font-mono"
                    placeholder="Site EBL - RANTAU"
                  />
                </div>

                <div className="p-2.5 bg-black/50 border border-white/20">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formSalinContoh}
                      onChange={(e) => setFormSalinContoh(e.target.checked)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <div>
                      <span className="font-bold text-white block">
                        Salin item bawaan template (ATK, BBM, Catering, dll)
                      </span>
                      <span className="text-[11px] text-zinc-400 block">
                        Jika dicentang, tabel item akan terisi contoh standar yang bisa langsung Anda edit.
                      </span>
                    </div>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-white/20">
                  <button
                    type="button"
                    onClick={() => setModalTambahTerbuka(false)}
                    className="btn-retro bg-zinc-800 text-zinc-300 hover:text-white"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn-retro bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Buat & Buka Editor
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ===========================================================================
  // TAMPILAN 2: FORM EDITOR PERMOHONAN AKTIF (Rekap, Rincian, Pratinjau)
  // ===========================================================================
  const warnaAktif = WARNA_STATUS[permohonanAktif.status];
  const sedangUnduhAktif = sedangEksporId === permohonanAktif.id;

  /** Cetak lembar RAB: judul halaman dikosongkan agar tidak ikut di kepala kertas. */
  const cetakLembar = () => {
    const judulAsli = document.title;
    document.title = ' ';
    window.print();
    setTimeout(() => { document.title = judulAsli; }, 1000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black/40">
      {/* Header Toolbar Permohonan */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-4 border-white pb-2 mb-2 px-2 pt-2 bg-black/60 shrink-0">
        <div className="flex items-center gap-2 mr-auto">
          <button
            onClick={() => setIdPermohonanAktif(null)}
            className="btn-retro bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-1 !py-1 text-[12px] font-bold"
            title="Kembali ke Dashboard Tracking Pengajuan"
          >
            <ArrowLeft size={14} /> <span className="hidden sm:inline">Daftar Tracking</span>
          </button>

          <div className="flex items-center gap-2 ml-1">
            <h2 className="text-[13px] sm:text-[14px] font-bold text-white truncate max-w-[220px] sm:max-w-md">
              {permohonanAktif.judul}
            </h2>
            <span className="chip-retro border-emerald-500 bg-emerald-950/70 text-emerald-300 hidden md:inline-flex items-center gap-1 text-[11px] font-bold">
              <DollarSign size={12} /> {formatRupiah(totalsAktif.grandTotal)}
            </span>
          </div>
        </div>

        {/* Status Selector Badge Langsung di Header */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">Status:</span>
          <select
            value={permohonanAktif.status}
            onChange={(e) =>
              handleUbahStatus(permohonanAktif.id, e.target.value as StatusPermohonanRab)
            }
            className={`px-2 py-1 text-[11px] font-bold uppercase rounded border transition-colors cursor-pointer ${warnaAktif.badge}`}
          >
            {DAFTAR_STATUS.map((st) => (
              <option key={st} value={st} className="bg-zinc-900 text-white">
                {st}
              </option>
            ))}
          </select>
        </div>

        {/* Mode Switcher */}
        <div className="flex border-2 border-white/40">
          <button
            onClick={() => setEditorMode('rekap')}
            className={`px-2.5 py-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase transition-colors ${
              editorMode === 'rekap'
                ? 'bg-amber-600 text-white'
                : 'bg-black/40 text-zinc-300 hover:text-white'
            }`}
          >
            <Coins size={13} /> <span className="hidden sm:inline">Rekapitulasi</span>
          </button>
          <button
            onClick={() => setEditorMode('rincian')}
            className={`px-2.5 py-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase transition-colors ${
              editorMode === 'rincian'
                ? 'bg-amber-600 text-white'
                : 'bg-black/40 text-zinc-300 hover:text-white'
            }`}
          >
            <Edit3 size={13} /> <span className="hidden sm:inline">Rincian</span>
          </button>
          <button
            onClick={() => setEditorMode('pratinjau')}
            className={`px-2.5 py-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase transition-colors ${
              editorMode === 'pratinjau'
                ? 'bg-amber-600 text-white'
                : 'bg-black/40 text-zinc-300 hover:text-white'
            }`}
          >
            <Eye size={13} /> <span className="hidden sm:inline">Pratinjau</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleUnduhExcelPermohonan(permohonanAktif)}
            disabled={sedangUnduhAktif}
            className="btn-retro bg-emerald-700 hover:bg-emerald-600 font-bold flex items-center gap-1.5 !py-1 text-[12px]"
            title="Unduh berkas Excel resmi 11 sheet (.xlsx)"
          >
            {sedangUnduhAktif ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={14} />
            )}
            <span className="hidden sm:inline">Unduh Excel</span>
          </button>
        </div>
      </div>

      {/* Bar Parameter Metadata (Bulan, Tahun, No RAB, Lokasi) */}
      <div className="flex flex-wrap items-center gap-2 px-2 mb-2 bg-black/30 p-1.5 border border-white/10 shrink-0 text-[12px]">
        <div className="flex items-center gap-1">
          <span className="text-zinc-400 font-mono text-[11px]">Bulan:</span>
          <select
            value={permohonanAktif.data.header.bulan}
            onChange={(e) => handleUbahHeaderAktif('bulan', e.target.value)}
            className="input-retro !py-1 !text-[12px] !w-auto"
          >
            {DAFTAR_BULAN.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-zinc-400 font-mono text-[11px]">Tahun:</span>
          <input
            type="number"
            value={permohonanAktif.data.header.tahun}
            onChange={(e) => handleUbahHeaderAktif('tahun', Number(e.target.value) || 2026)}
            className="input-retro !py-1 !text-[12px] !w-20 font-mono"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-zinc-400 font-mono text-[11px]">No. RAB:</span>
          <input
            type="text"
            value={permohonanAktif.data.header.nomorRab}
            onChange={(e) => handleUbahHeaderAktif('nomorRab', e.target.value)}
            className="input-retro !py-1 !text-[12px] !w-44 font-mono"
            placeholder="No. RAB"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-zinc-400 font-mono text-[11px]">Lokasi:</span>
          <input
            type="text"
            value={permohonanAktif.data.header.lokasi}
            onChange={(e) => handleUbahHeaderAktif('lokasi', e.target.value)}
            className="input-retro !py-1 !text-[12px] !w-40 font-mono"
          />
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-zinc-400 font-mono text-[11px]">Persetujuan:</span>
          <span className="text-amber-300 font-semibold">
            {permohonanAktif.data.header.disetujuiOleh}
          </span>
        </div>
      </div>

      {/* Konten Editor (Scrollable) */}
      <div className="flex-1 overflow-auto custom-scrollbar px-2 pb-4 min-h-0">
        {/* ============================================================== */}
        {/* MODE 1: REKAPITULASI UTAMA (Ringkasan Bulanan)                 */}
        {/* ============================================================== */}
        {editorMode === 'rekap' && (
          <div className="space-y-3">
            <div className="border-[3px] border-white/40 overflow-x-auto shadow-lg bg-black/60">
              <table className="w-full text-[12px] border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#2f5d33] text-white uppercase text-[11px]">
                    <th className="p-2 border border-white/20 text-center w-12">No</th>
                    <th className="p-2 border border-white/20 text-left w-36">Kode WBS</th>
                    <th className="p-2 border border-white/20 text-left min-w-[200px]">
                      Uraian Kategori
                    </th>
                    <th className="p-2 border border-white/20 text-right w-28">Minggu I</th>
                    <th className="p-2 border border-white/20 text-right w-28">Minggu II</th>
                    <th className="p-2 border border-white/20 text-right w-28">Minggu III</th>
                    <th className="p-2 border border-white/20 text-right w-28">Minggu IV</th>
                    <th className="p-2 border border-white/20 text-right w-32 bg-[#224425]">
                      Total Anggaran
                    </th>
                    <th className="p-2 border border-white/20 text-center w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {permohonanAktif.data.kategori.map((k, idx) => {
                    const subW1 = hitungSubtotalMinggu(k.minggu[0]);
                    const subW2 = hitungSubtotalMinggu(k.minggu[1]);
                    const subW3 = hitungSubtotalMinggu(k.minggu[2]);
                    const subW4 = hitungSubtotalMinggu(k.minggu[3]);
                    const totKat = subW1 + subW2 + subW3 + subW4;

                    return (
                      <tr
                        key={k.id}
                        className={`hover:bg-amber-500/10 cursor-pointer ${
                          idx % 2 === 0 ? 'bg-black/40' : 'bg-white/5'
                        }`}
                        onClick={() => {
                          setKategoriTerpilihId(k.id);
                          setEditorMode('rincian');
                        }}
                      >
                        <td className="p-2 border border-white/10 text-center text-zinc-400 font-mono">
                          {idx + 1}
                        </td>
                        <td className="p-2 border border-white/10 text-cyan-300 font-mono text-[11px]">
                          {k.wbs}
                        </td>
                        <td className="p-2 border border-white/10 font-bold text-white flex items-center gap-1.5">
                          <span>{k.nama}</span>
                          <span className="chip-retro !text-[9px] border-zinc-600 text-zinc-400">
                            {k.minggu.reduce((s, m) => s + m.items.length, 0)} item
                          </span>
                        </td>
                        <td className="p-2 border border-white/10 text-right font-mono text-zinc-200">
                          {subW1 > 0 ? formatRupiah(subW1) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="p-2 border border-white/10 text-right font-mono text-zinc-200">
                          {subW2 > 0 ? formatRupiah(subW2) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="p-2 border border-white/10 text-right font-mono text-zinc-200">
                          {subW3 > 0 ? formatRupiah(subW3) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="p-2 border border-white/10 text-right font-mono text-zinc-200">
                          {subW4 > 0 ? formatRupiah(subW4) : <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="p-2 border border-white/10 text-right font-mono font-bold text-emerald-400 bg-emerald-950/20">
                          {formatRupiah(totKat)}
                        </td>
                        <td className="p-2 border border-white/10 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setKategoriTerpilihId(k.id);
                              setEditorMode('rincian');
                            }}
                            className="btn-retro btn-retro-sm bg-zinc-800 text-[10px] inline-flex items-center gap-1"
                          >
                            <Edit3 size={10} /> Rincian
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1f4222] text-white font-bold text-[12px] border-t-2 border-white/40">
                    <td colSpan={3} className="p-2.5 text-right uppercase tracking-wider">
                      TOTAL ANGGARAN (RAB)
                    </td>
                    <td className="p-2.5 border border-white/20 text-right font-mono text-amber-300">
                      {formatRupiah(totalsAktif.perMinggu[0])}
                    </td>
                    <td className="p-2.5 border border-white/20 text-right font-mono text-amber-300">
                      {formatRupiah(totalsAktif.perMinggu[1])}
                    </td>
                    <td className="p-2.5 border border-white/20 text-right font-mono text-amber-300">
                      {formatRupiah(totalsAktif.perMinggu[2])}
                    </td>
                    <td className="p-2.5 border border-white/20 text-right font-mono text-amber-300">
                      {formatRupiah(totalsAktif.perMinggu[3])}
                    </td>
                    <td className="p-2.5 border border-white/20 text-right font-mono font-black text-yellow-300 bg-black/40 text-[13px]">
                      {formatRupiah(totalsAktif.grandTotal)}
                    </td>
                    <td className="p-2.5 border border-white/20 text-center"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Catatan / Keterangan Persetujuan */}
            <div className="p-3 bg-amber-950/40 border border-amber-500/40 flex items-start gap-2.5 text-[12px] text-zinc-300">
              <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300 block mb-0.5">Catatan Persetujuan:</span>
                <p>{permohonanAktif.data.header.catatan}</p>
                <p className="text-[11px] text-zinc-400 mt-1">
                  💡 <i>Tip: Klik baris kategori di atas untuk langsung membuka dan mengedit rincian barang/jasa tiap minggu.</i>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 2: RINCIAN PER KATEGORI (Weekly Detail Editor)            */}
        {/* ============================================================== */}
        {editorMode === 'rincian' && kategoriAktif && (
          <div className="space-y-3">
            {/* Kategori Selector Pills */}
            <div className="flex flex-wrap gap-1.5 pb-1 border-b border-white/15">
              {permohonanAktif.data.kategori.map((k) => {
                const totalKat = hitungTotalKategori(k);
                const aktif = k.id === kategoriTerpilihId;
                return (
                  <button
                    key={k.id}
                    onClick={() => setKategoriTerpilihId(k.id)}
                    className={`px-3 py-1.5 text-[12px] font-bold uppercase border-2 transition-all flex items-center gap-1.5 ${
                      aktif
                        ? 'border-amber-400 bg-amber-600 text-white shadow-[2px_2px_0_#000]'
                        : 'border-white/20 bg-black/50 text-zinc-400 hover:text-white hover:border-white/40'
                    }`}
                  >
                    <span>{k.nama}</span>
                    <span
                      className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                        aktif ? 'bg-black/40 text-yellow-300' : 'text-zinc-400'
                      }`}
                    >
                      {formatRupiah(totalKat)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Filter Minggu Selector */}
            <div className="flex items-center justify-between gap-2 bg-black/50 p-2 border border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold text-amber-300 flex items-center gap-1.5">
                  <Coins size={16} /> {kategoriAktif.nama}
                </span>
                <span className="text-[11px] text-zinc-400 font-mono">
                  WBS: {kategoriAktif.wbs} · Sheet: {kategoriAktif.sheetName}
                </span>
              </div>

              <div className="flex border border-white/30 text-[11px] font-bold">
                <button
                  onClick={() => setMingguTerpilih(0)}
                  className={`px-2 py-1 ${
                    mingguTerpilih === 0 ? 'bg-amber-600 text-white' : 'bg-black/40 text-zinc-400'
                  }`}
                >
                  Semua Minggu
                </button>
                {[1, 2, 3, 4].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMingguTerpilih(m)}
                    className={`px-2 py-1 ${
                      mingguTerpilih === m ? 'bg-amber-600 text-white' : 'bg-black/40 text-zinc-400'
                    }`}
                  >
                    W{m}
                  </button>
                ))}
              </div>
            </div>

            {/* Daftar Tabel per Minggu */}
            <div className="space-y-4">
              {kategoriAktif.minggu
                .filter((m) => mingguTerpilih === 0 || m.mingguKe === mingguTerpilih)
                .map((m) => {
                  const subtotal = hitungSubtotalMinggu(m);

                  return (
                    <div
                      key={m.mingguKe}
                      className="panel-retro !p-3 bg-black/60 border-2 border-white/30"
                    >
                      <div className="flex items-center justify-between border-b-2 border-white/20 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-title text-[11px] text-yellow-300">
                            {m.label} ({permohonanAktif.data.header.bulan}{' '}
                            {permohonanAktif.data.header.tahun})
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {m.items.length} item
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-zinc-300">Subtotal:</span>
                          <span className="chip-retro border-emerald-400 bg-emerald-950/60 text-emerald-300 font-mono font-bold text-[12px]">
                            {formatRupiah(subtotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleTambahItemAktif(kategoriAktif.id, m.mingguKe)}
                            className="btn-retro btn-retro-sm bg-amber-600 text-[11px] flex items-center gap-1 font-bold"
                          >
                            <Plus size={12} /> Tambah Item
                          </button>
                        </div>
                      </div>

                      {m.items.length === 0 ? (
                        <div className="text-center py-6 text-zinc-500 text-[12px] border border-dashed border-white/15">
                          Belum ada item barang/jasa untuk {m.label}. Klik "+ Tambah Item" untuk
                          menambahkan.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-white/15 custom-scrollbar">
                          <table className="w-full text-[11px] border-collapse min-w-[700px]">
                            <thead className="bg-[#2f5d33] text-white uppercase text-[10px]">
                              <tr>
                                <th className="p-1.5 border border-white/20 text-center w-10">No</th>
                                <th className="p-1.5 border border-white/20 text-left min-w-[240px]">
                                  Nama Barang / Jasa
                                </th>
                                <th className="p-1.5 border border-white/20 text-center w-20">Qty</th>
                                <th className="p-1.5 border border-white/20 text-left w-24">Satuan</th>
                                <th className="p-1.5 border border-white/20 text-right w-36">
                                  Harga Satuan (Rp)
                                </th>
                                <th className="p-1.5 border border-white/20 text-right w-36">
                                  Total Harga (Rp)
                                </th>
                                <th className="p-1.5 border border-white/20 text-center w-12">Aksi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.items.map((it, idx) => {
                                const totalItem = hitungTotalItem(it);
                                return (
                                  <tr
                                    key={it.id}
                                    className={`border-b border-white/10 ${
                                      idx % 2 === 0 ? 'bg-black/30' : 'bg-white/5'
                                    }`}
                                  >
                                    <td className="p-1.5 border-r border-white/10 text-center text-zinc-400 font-mono">
                                      {idx + 1}
                                    </td>
                                    <td className="p-1.5 border-r border-white/10">
                                      <input
                                        type="text"
                                        value={it.namaBarang}
                                        onChange={(e) =>
                                          handleUbahItemAktif(kategoriAktif.id, m.mingguKe, it.id, {
                                            namaBarang: e.target.value,
                                          })
                                        }
                                        placeholder="Nama barang atau jasa…"
                                        className="input-retro !py-1 !text-[11px] w-full"
                                      />
                                    </td>
                                    <td className="p-1.5 border-r border-white/10">
                                      <input
                                        type="number"
                                        value={it.qty === null ? '' : it.qty}
                                        onChange={(e) =>
                                          handleUbahItemAktif(kategoriAktif.id, m.mingguKe, it.id, {
                                            qty:
                                              e.target.value === '' ? null : Number(e.target.value),
                                          })
                                        }
                                        placeholder="0"
                                        className="input-retro !py-1 !text-[11px] text-center font-mono w-full"
                                      />
                                    </td>
                                    <td className="p-1.5 border-r border-white/10">
                                      <input
                                        type="text"
                                        value={it.satuan}
                                        onChange={(e) =>
                                          handleUbahItemAktif(kategoriAktif.id, m.mingguKe, it.id, {
                                            satuan: e.target.value,
                                          })
                                        }
                                        placeholder="satuan"
                                        className="input-retro !py-1 !text-[11px] w-full"
                                      />
                                    </td>
                                    <td className="p-1.5 border-r border-white/10">
                                      <input
                                        type="number"
                                        value={it.hargaSatuan === null ? '' : it.hargaSatuan}
                                        onChange={(e) =>
                                          handleUbahItemAktif(kategoriAktif.id, m.mingguKe, it.id, {
                                            hargaSatuan:
                                              e.target.value === '' ? null : Number(e.target.value),
                                          })
                                        }
                                        placeholder="0"
                                        className="input-retro !py-1 !text-[11px] text-right font-mono w-full"
                                      />
                                    </td>
                                    <td className="p-1.5 border-r border-white/10 text-right font-mono font-bold text-emerald-400">
                                      {formatRupiah(totalItem)}
                                    </td>
                                    <td className="p-1.5 text-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleHapusItemAktif(kategoriAktif.id, m.mingguKe, it.id)
                                        }
                                        className="text-zinc-500 hover:text-red-400 p-1"
                                        title="Hapus baris"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* MODE 3: PRATINJAU DOKUMEN RESMI (Official Document Layout)     */}
        {/* ============================================================== */}
        {editorMode === 'pratinjau' && (
          <div className="flex justify-center py-2">
            <div id="dokumen-rab-a4" className="bg-white text-black p-6 md:p-8 max-w-4xl w-full shadow-2xl rounded-sm font-sans border-2 border-black/40">
              {/* Header Dokumen Perusahaan */}
              <div className="border-b-2 border-black pb-3 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-[16px] uppercase tracking-wide text-zinc-900 leading-tight">
                      PT ENERGI BATUBARA LESTARI
                    </h3>
                    <h4 className="font-extrabold text-[15px] uppercase tracking-wide text-zinc-800">
                      RENCANA ANGGARAN BULANAN (RAB)
                    </h4>
                    <p className="text-[13px] text-zinc-700 font-semibold">Departemen HCGA</p>
                  </div>
                  <div className="text-right text-[11px] text-zinc-600 space-y-0.5">
                    <p>
                      <b>Lokasi:</b> {permohonanAktif.data.header.lokasi}
                    </p>
                    <p>
                      <b>Periode:</b> {permohonanAktif.data.header.bulan}{' '}
                      {permohonanAktif.data.header.tahun}
                    </p>
                    <p>
                      <b>No. RAB:</b> {permohonanAktif.data.header.nomorRab}
                    </p>
                    <p>
                      <b>Tanggal:</b> {permohonanAktif.data.header.tanggal}
                    </p>
                    <p>
                      <b>Status:</b>{' '}
                      <span className="font-bold uppercase text-emerald-700">
                        {permohonanAktif.status}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabel Rekap Resmi */}
              <div className="mb-6 overflow-x-auto">
                <table className="w-full text-[11px] border-collapse border border-black">
                  <thead>
                    <tr className="bg-zinc-200 text-black uppercase font-bold text-center">
                      <th className="border border-black p-1.5 w-8">No</th>
                      <th className="border border-black p-1.5 text-left w-36">Kode WBS</th>
                      <th className="border border-black p-1.5 text-left">Uraian Kategori</th>
                      <th className="border border-black p-1.5 text-right w-24">Minggu I</th>
                      <th className="border border-black p-1.5 text-right w-24">Minggu II</th>
                      <th className="border border-black p-1.5 text-right w-24">Minggu III</th>
                      <th className="border border-black p-1.5 text-right w-24">Minggu IV</th>
                      <th className="border border-black p-1.5 text-right w-28 bg-zinc-300">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {permohonanAktif.data.kategori.map((k, idx) => {
                      const subW1 = hitungSubtotalMinggu(k.minggu[0]);
                      const subW2 = hitungSubtotalMinggu(k.minggu[1]);
                      const subW3 = hitungSubtotalMinggu(k.minggu[2]);
                      const subW4 = hitungSubtotalMinggu(k.minggu[3]);
                      const tot = subW1 + subW2 + subW3 + subW4;

                      return (
                        <tr key={k.id} className="border-b border-black">
                          <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                          <td className="border border-black p-1.5 font-mono text-[10px]">{k.wbs}</td>
                          <td className="border border-black p-1.5 font-semibold">{k.nama}</td>
                          <td className="border border-black p-1.5 text-right font-mono">
                            {subW1 > 0 ? formatRupiah(subW1) : '—'}
                          </td>
                          <td className="border border-black p-1.5 text-right font-mono">
                            {subW2 > 0 ? formatRupiah(subW2) : '—'}
                          </td>
                          <td className="border border-black p-1.5 text-right font-mono">
                            {subW3 > 0 ? formatRupiah(subW3) : '—'}
                          </td>
                          <td className="border border-black p-1.5 text-right font-mono">
                            {subW4 > 0 ? formatRupiah(subW4) : '—'}
                          </td>
                          <td className="border border-black p-1.5 text-right font-mono font-bold bg-zinc-100">
                            {formatRupiah(tot)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-300 text-black font-bold">
                      <td colSpan={3} className="border border-black p-2 text-right uppercase">
                        TOTAL ANGGARAN
                      </td>
                      <td className="border border-black p-2 text-right font-mono">
                        {formatRupiah(totalsAktif.perMinggu[0])}
                      </td>
                      <td className="border border-black p-2 text-right font-mono">
                        {formatRupiah(totalsAktif.perMinggu[1])}
                      </td>
                      <td className="border border-black p-2 text-right font-mono">
                        {formatRupiah(totalsAktif.perMinggu[2])}
                      </td>
                      <td className="border border-black p-2 text-right font-mono">
                        {formatRupiah(totalsAktif.perMinggu[3])}
                      </td>
                      <td className="border border-black p-2 text-right font-mono text-[12px] bg-zinc-400">
                        {formatRupiah(totalsAktif.grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Tanda Tangan & Persetujuan */}
              <div className="grid grid-cols-2 gap-8 text-[11px] pt-4 border-t border-zinc-300">
                <div>
                  <p className="font-semibold text-zinc-700">Kepada:</p>
                  <p className="font-bold">{permohonanAktif.data.header.kepada}</p>
                  <p className="text-zinc-600 mt-1">Up. {permohonanAktif.data.header.up}</p>
                  <p className="text-[10px] text-zinc-500 mt-4 italic">
                    {permohonanAktif.data.header.catatan}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-zinc-700">Disetujui Oleh,</p>
                  <p className="text-zinc-500 text-[10px] mb-12">Operation & HCA Director</p>
                  <p className="font-bold underline text-[12px]">
                    {permohonanAktif.data.header.disetujuiOleh}
                  </p>
                  <p className="text-zinc-600 text-[10px]">
                    Tanggal: {permohonanAktif.data.header.tanggal}
                  </p>
                </div>
              </div>

              {/* Print / Export Bar */}
              <div className="mt-8 pt-4 border-t-2 border-dashed border-zinc-300 flex justify-end gap-2 no-print">
                <button
                  type="button"
                  onClick={cetakLembar}
                  className="px-3 py-1.5 bg-zinc-800 text-white rounded text-[12px] font-bold flex items-center gap-1.5"
                >
                  <Printer size={14} /> Cetak Lembar
                </button>
                <button
                  type="button"
                  onClick={() => handleUnduhExcelPermohonan(permohonanAktif)}
                  disabled={sedangUnduhAktif}
                  className="px-4 py-1.5 bg-emerald-700 text-white rounded text-[12px] font-bold flex items-center gap-1.5"
                >
                  {sedangUnduhAktif ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  Unduh Berkas Excel (.xlsx)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gaya cetak A4: hanya lembar RAB yang keluar di kertas. */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { background: #ffffff !important; color: #000000 !important; overflow: visible !important; }
          body > * { visibility: hidden !important; }
          .no-print { display: none !important; }
          #dokumen-rab-a4, #dokumen-rab-a4 * { visibility: visible !important; }
          #dokumen-rab-a4 {
            position: absolute !important;
            left: 0 !important; top: 0 !important;
            width: 100% !important; max-width: 100% !important;
            margin: 0 !important; padding: 0 !important;
            border: none !important; box-shadow: none !important; background: #ffffff !important;
          }
          #dokumen-rab-a4 table { break-inside: auto; }
          #dokumen-rab-a4 tr { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};
