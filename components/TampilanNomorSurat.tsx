import React, { useMemo, useState } from 'react';
import {
  Hash, Plus, Search, FileSpreadsheet, Download, Paperclip, Copy, Check,
  Pencil, Trash2, ExternalLink, Calendar, User, MapPin, Filter, FileText,
  Send, ClipboardList, Loader2, ArrowUpDown, ArrowDown, ArrowUp, RotateCcw,
} from 'lucide-react';
import {
  type ItemSurat,
  type KategoriSurat,
  type JenisLingkup,
  type DokumenLampiran,
  KATEGORI_SURAT_INFO,
} from '../lib/tipe-surat';
import { eksporSemuaNomorSuratKeExcel } from '../lib/ekspor-manajemen-surat';
import { FormNomorSuratModal } from './FormNomorSuratModal';

interface Props {
  daftar: ItemSurat[];
  onSimpanItem: (item: ItemSurat, bukaDiMemoDinas?: boolean) => void;
  onHapusItem: (id: string) => void;
  onBukaMemoDinasDariSurat?: (item: ItemSurat) => void;
  notify: (pesan: string) => void;
}

export const TampilanNomorSurat: React.FC<Props> = ({
  daftar,
  onSimpanItem,
  onHapusItem,
  onBukaMemoDinasDariSurat,
  notify,
}) => {
  const [cari, setCari] = useState('');
  const [saringKategori, setSaringKategori] = useState<KategoriSurat | 'semua'>('semua');
  const [saringLingkup, setSaringLingkup] = useState<JenisLingkup | 'semua'>('semua');
  const [saringTahun, setSaringTahun] = useState<string>('semua');
  const [saringBulan, setSaringBulan] = useState<string>('semua');
  const [saringLampiran, setSaringLampiran] = useState<boolean>(false);
  // Default urutan: 'terbaru' (berdasarkan Tahun & Bulan Romawi di nomor surat)
  const [urut, setUrut] = useState<'terbaru' | 'terlama' | 'nomor_asc' | 'nomor_desc'>('terbaru');

  const [sedangEkspor, setSedangEkspor] = useState(false);
  const [suratTerpilih, setSuratTerpilih] = useState<ItemSurat | null>(null);
  const [bukaModalForm, setBukaModalForm] = useState(false);
  const [tersalinId, setTersalinId] = useState<string | null>(null);

  // Modal cepat lihat dokumen lampiran
  const [dokumenLihat, setDokumenLihat] = useState<{ nomorSurat: string; list: DokumenLampiran[] } | null>(null);

  // Kamus konversi Romawi ke Angka Bulan (1 - 12)
  const ROMAWI_KE_BULAN: Record<string, number> = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
    'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10, 'XI': 11, 'XII': 12,
  };

  const DAFTAR_PILIHAN_BULAN = [
    { nomor: '1', romawi: 'I', label: 'Jan' },
    { nomor: '2', romawi: 'II', label: 'Feb' },
    { nomor: '3', romawi: 'III', label: 'Mar' },
    { nomor: '4', romawi: 'IV', label: 'Apr' },
    { nomor: '5', romawi: 'V', label: 'Mei' },
    { nomor: '6', romawi: 'VI', label: 'Jun' },
    { nomor: '7', romawi: 'VII', label: 'Jul' },
    { nomor: '8', romawi: 'VIII', label: 'Agu' },
    { nomor: '9', romawi: 'IX', label: 'Sep' },
    { nomor: '10', romawi: 'X', label: 'Okt' },
    { nomor: '11', romawi: 'XI', label: 'Nov' },
    { nomor: '12', romawi: 'XII', label: 'Des' },
  ];

  // Helper cerdas membedah nomor surat: mengekstrak Nomor Urut, Bulan Romawi, dan Tahun secara akurat
  const bedahNomorSurat = (item: ItemSurat) => {
    const nomorSurat = item.nomorSurat || '';

    // 1. Ekstrak nomor urut di awal (misal "023" dari "023/RNR-PD/IX/2026" atau "68" dari "68/RNR-PD/IV/2024")
    const matchNo = nomorSurat.match(/^(\d+)/);
    const nomorUrut = matchNo ? parseInt(matchNo[1], 10) : (item.nomorUrut || 0);

    // 2. Ekstrak bulan romawi dan tahun di akhir (misal ".../IX/2026", ".../VIII/2026", ".../IV/2024")
    const matchBulanTahun = nomorSurat.match(/\/([IVXLCDM]+)\/(\d{4})/i);
    let bulan = 0;
    let bulanRomawi = '';
    let tahun = 0;

    if (matchBulanTahun) {
      bulanRomawi = matchBulanTahun[1].toUpperCase();
      bulan = ROMAWI_KE_BULAN[bulanRomawi] || 0;
      tahun = parseInt(matchBulanTahun[2], 10);
    }

    // Fallback tahun jika nomor surat hanya berakhiran /YYYY
    if (!tahun) {
      const matchThn = nomorSurat.match(/\/(\d{4})/);
      if (matchThn) tahun = parseInt(matchThn[1], 10);
    }

    // Fallback dari tanggal item jika di nomor surat belum terisi
    const tglRef = item.tanggalMulai || item.tanggal || item.dibuatPada || '';
    if (!tahun && tglRef.length >= 4) {
      const thn = parseInt(tglRef.slice(0, 4), 10);
      if (!isNaN(thn)) tahun = thn;
    }
    if (!bulan && tglRef.length >= 7) {
      const bln = parseInt(tglRef.slice(5, 7), 10);
      if (!isNaN(bln)) {
        bulan = bln;
        bulanRomawi = DAFTAR_PILIHAN_BULAN[bulan - 1]?.romawi || '';
      }
    }

    let hari = 1;
    if (tglRef.length >= 10) {
      const hr = parseInt(tglRef.slice(8, 10), 10);
      if (!isNaN(hr)) hari = hr;
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    const tanggalEfektif = `${tahun || 1970}-${pad(bulan || 1)}-${pad(hari)}`;

    return { nomorUrut, bulan, bulanRomawi, tahun, tanggalEfektif };
  };

  // Daftar tahun unik dari data nomor surat untuk filter
  const daftarTahun = useMemo(() => {
    const setTahun = new Set<string>();
    daftar.forEach((item) => {
      const info = bedahNomorSurat(item);
      if (info.tahun >= 2000 && info.tahun <= 2099) {
        setTahun.add(String(info.tahun));
      }
    });
    return Array.from(setTahun).sort().reverse();
  }, [daftar]);

  // Hitung statistik per kategori
  const hitung = useMemo(() => {
    return {
      total: daftar.length,
      im: daftar.filter((x) => x.kategori === 'im').length,
      surat_keluar: daftar.filter((x) => x.kategori === 'surat_keluar').length,
      kontrak: daftar.filter((x) => x.kategori === 'kontrak').length,
      berita_acara: daftar.filter((x) => x.kategori === 'berita_acara').length,
      adaDokumen: daftar.filter((x) => x.dokumen && x.dokumen.length > 0).length,
    };
  }, [daftar]);

  // Data tersaring & terurut (Default: Nomor Surat Terbaru di posisi paling atas berdasarkan Tahun & Bulan)
  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const hasil = daftar.filter((item) => {
      // Filter kategori
      if (saringKategori !== 'semua' && item.kategori !== saringKategori) {
        return false;
      }
      // Filter lingkup
      if (saringLingkup !== 'semua') {
        const lingkupItem = KATEGORI_SURAT_INFO[item.kategori]?.lingkup;
        if (lingkupItem !== saringLingkup) return false;
      }
      // Filter tahun (berdasarkan tahun yang diekstrak dari nomor surat)
      if (saringTahun !== 'semua') {
        const info = bedahNomorSurat(item);
        if (String(info.tahun) !== saringTahun) return false;
      }
      // Filter bulan (berdasarkan bulan romawi yang diekstrak dari nomor surat)
      if (saringBulan !== 'semua') {
        const info = bedahNomorSurat(item);
        if (String(info.bulan) !== saringBulan) return false;
      }
      // Filter dokumen lampiran
      if (saringLampiran && (!item.dokumen || item.dokumen.length === 0)) {
        return false;
      }
      // Filter teks cari
      if (!q) return true;
      const gabungan = [
        item.nomorSurat,
        item.namaSurat,
        item.namaYangDitugaskan,
        item.tujuanDinas,
        item.tujuanSurat,
        item.keperluan,
        item.namaPembuat,
        item.author,
        item.pelaksana,
        item.keterangan,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return gabungan.includes(q);
    });

    // Pengurutan (Sorting): Default adalah 'terbaru' di atas berdasarkan Tahun, Bulan, dan Nomor Urut Surat
    hasil.sort((a, b) => {
      const infoA = bedahNomorSurat(a);
      const infoB = bedahNomorSurat(b);

      if (urut === 'terbaru') {
        // 1. Tahun terbesar di atas (2026 > 2025 > 2024)
        if (infoB.tahun !== infoA.tahun) {
          return infoB.tahun - infoA.tahun;
        }
        // 2. Bulan terbesar di atas (misal IX (9) > VIII (8) > IV (4))
        if (infoB.bulan !== infoA.bulan) {
          return infoB.bulan - infoA.bulan;
        }
        // 3. Tanggal hari jika ada
        const cmpTgl = infoB.tanggalEfektif.localeCompare(infoA.tanggalEfektif);
        if (cmpTgl !== 0) return cmpTgl;
        // 4. Nomor urut terbesar di atas (misal 023 > 022 > 001)
        if (infoB.nomorUrut !== infoA.nomorUrut) {
          return infoB.nomorUrut - infoA.nomorUrut;
        }
        return (b.dibuatPada || '').localeCompare(a.dibuatPada || '');
      }
      if (urut === 'terlama') {
        // 1. Tahun terkecil di atas (2024 < 2025 < 2026)
        if (infoA.tahun !== infoB.tahun) {
          return infoA.tahun - infoB.tahun;
        }
        // 2. Bulan terkecil di atas (misal IV (4) < VIII (8) < IX (9))
        if (infoA.bulan !== infoB.bulan) {
          return infoA.bulan - infoB.bulan;
        }
        const cmpTgl = infoA.tanggalEfektif.localeCompare(infoB.tanggalEfektif);
        if (cmpTgl !== 0) return cmpTgl;
        if (infoA.nomorUrut !== infoB.nomorUrut) {
          return infoA.nomorUrut - infoB.nomorUrut;
        }
        return (a.dibuatPada || '').localeCompare(b.dibuatPada || '');
      }
      if (urut === 'nomor_asc') {
        return a.nomorSurat.localeCompare(b.nomorSurat, undefined, { numeric: true });
      }
      if (urut === 'nomor_desc') {
        return b.nomorSurat.localeCompare(a.nomorSurat, undefined, { numeric: true });
      }
      return 0;
    });

    return hasil;
  }, [daftar, cari, saringKategori, saringLingkup, saringTahun, saringBulan, saringLampiran, urut]);

  const handleSalinNomor = (nomor: string, id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(nomor).then(() => {
      setTersalinId(id);
      notify(`NOMOR DISALIN: ${nomor}`);
      setTimeout(() => setTersalinId(null), 2000);
    });
  };

  const handleEksporExcel = async () => {
    if (daftar.length === 0) {
      notify('TIDAK ADA DATA UNTUK DIEKSPOR');
      return;
    }
    setSedangEkspor(true);
    try {
      await eksporSemuaNomorSuratKeExcel(daftar);
      notify('BERKAS EXCEL NOMOR SURAT BERHASIL DIUNDUH');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGEKSPOR EXCEL');
    } finally {
      setSedangEkspor(false);
    }
  };

  const handleHapus = (id: string, nomor: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm(`Hapus nomor surat "${nomor}"?`)) {
      onHapusItem(id);
      notify('NOMOR SURAT DIHAPUS');
    }
  };

  const handleUnduhDokumen = (dok: DokumenLampiran) => {
    if (!dok.dataUrl) {
      notify('BERKAS TIDAK MEMILIKI DATA URL');
      return;
    }
    const a = document.createElement('a');
    a.href = dok.dataUrl;
    a.download = dok.nama;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto custom-scrollbar pb-3 sm:overflow-hidden sm:flex sm:flex-col space-y-3">
      {/* Banner / Info & Statistik */}
      <div className="panel-retro !bg-zinc-950/90 !p-3 border-2 border-lime-500/80 flex flex-wrap items-center justify-between gap-3 shrink-0 rounded shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-lime-500 border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]">
            <Hash size={22} className="text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-title text-[13px] md:text-[15px] text-white">
                Manajerial Nomor Surat (Internal &amp; Eksternal)
              </h3>
              <span className="bg-lime-900/80 text-lime-300 text-[10px] px-2 py-0.5 border border-lime-500/40 font-mono font-bold rounded">
                DEPARTEMEN RNR
              </span>
            </div>
            <p className="hidden sm:block text-[12px] text-zinc-400">
              Penomoran otomatis resmi, lampiran berkas opsional &amp; sinkronisasi ke template Excel
            </p>
          </div>
        </div>

        {/* Tombol Aksi Atas */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleEksporExcel}
            disabled={sedangEkspor}
            className="btn-retro btn-retro-sm !bg-emerald-800 hover:!bg-emerald-700 text-white font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
            title="Unduh file Excel (.xlsx) dengan 4 sheet sesuai template asli Anda"
          >
            {sedangEkspor ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
            <span>Unduh .xlsx</span>
          </button>

          <button
            onClick={() => {
              setSuratTerpilih(null);
              setBukaModalForm(true);
            }}
            className="btn-retro btn-retro-sm bg-lime-600 hover:bg-lime-500 text-white font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
          >
            <Plus size={13} /> Buat Nomor Baru
          </button>
        </div>
      </div>

      {/* Baris Statistik & Filter Kategori */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Filter Kategori Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-950/80 border border-zinc-800 rounded">
          <button
            onClick={() => setSaringKategori('semua')}
            className={`px-3 py-1.5 text-[11px] font-bold transition-all rounded ${
              saringKategori === 'semua'
                ? 'bg-lime-600 text-white shadow-[1px_1px_0_#000]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Semua ({hitung.total})
          </button>
          <button
            onClick={() => setSaringKategori('im')}
            className={`px-3 py-1.5 text-[11px] font-bold transition-all rounded ${
              saringKategori === 'im'
                ? 'bg-amber-600 text-white shadow-[1px_1px_0_#000]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            IM Dinas ({hitung.im})
          </button>
          <button
            onClick={() => setSaringKategori('surat_keluar')}
            className={`px-3 py-1.5 text-[11px] font-bold transition-all rounded ${
              saringKategori === 'surat_keluar'
                ? 'bg-blue-600 text-white shadow-[1px_1px_0_#000]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Surat Keluar ({hitung.surat_keluar})
          </button>
          <button
            onClick={() => setSaringKategori('kontrak')}
            className={`px-3 py-1.5 text-[11px] font-bold transition-all rounded ${
              saringKategori === 'kontrak'
                ? 'bg-emerald-600 text-white shadow-[1px_1px_0_#000]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Kontrak ({hitung.kontrak})
          </button>
          <button
            onClick={() => setSaringKategori('berita_acara')}
            className={`px-3 py-1.5 text-[11px] font-bold transition-all rounded ${
              saringKategori === 'berita_acara'
                ? 'bg-purple-600 text-white shadow-[1px_1px_0_#000]'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
            }`}
          >
            Berita Acara ({hitung.berita_acara})
          </button>
        </div>

        {/* Filter Lingkup: Internal vs Eksternal */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-zinc-400 font-bold">Lingkup:</span>
          <button
            onClick={() => setSaringLingkup('semua')}
            className={`px-2.5 py-1 font-mono font-bold rounded border ${
              saringLingkup === 'semua'
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'text-zinc-400 border-zinc-800 hover:text-white'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setSaringLingkup('internal')}
            className={`px-2.5 py-1 font-mono font-bold rounded ${
              saringLingkup === 'internal'
                ? 'lencana-im'
                : 'text-zinc-400 border border-zinc-800 hover:text-white'
            }`}
          >
            Internal
          </button>
          <button
            onClick={() => setSaringLingkup('eksternal')}
            className={`px-2.5 py-1 font-mono font-bold rounded ${
              saringLingkup === 'eksternal'
                ? 'lencana-sr'
                : 'text-zinc-400 border border-zinc-800 hover:text-white'
            }`}
          >
            Eksternal
          </button>
        </div>
      </div>

      {/* Toolbar Pencarian, Filter Tahun, Urutan & Lampiran */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 bg-zinc-950/80 p-2 border border-zinc-800 rounded">
        {/* Kolom Kiri: Input Cari */}
        <div className="relative flex-1 min-w-[240px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nomor surat, perihal, karyawan, tujuan, pelaksana, author…"
            className="input-retro !pl-8 !py-1.5 !text-[12px] w-full"
          />
          {cari && (
            <button
              onClick={() => setCari('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              title="Hapus pencarian"
            >
              ✕
            </button>
          )}
        </div>

        {/* Kolom Kanan: Filter Tahun, Pilihan Urutan & Filter Lampiran */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {/* Filter Tahun */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 px-2 py-1 rounded">
            <Calendar size={12} className="text-zinc-400" />
            <span className="text-zinc-400 font-bold">Tahun:</span>
            <select
              value={saringTahun}
              onChange={(e) => setSaringTahun(e.target.value)}
              className="bg-transparent text-white font-mono font-bold outline-none cursor-pointer"
            >
              <option value="semua" className="bg-zinc-900 text-white">Semua</option>
              {daftarTahun.map((thn) => (
                <option key={thn} value={thn} className="bg-zinc-900 text-white">
                  {thn}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Bulan (Romawi & Nama Bulan) */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 px-2 py-1 rounded">
            <span className="text-zinc-400 font-bold">Bulan:</span>
            <select
              value={saringBulan}
              onChange={(e) => setSaringBulan(e.target.value)}
              className="bg-transparent text-white font-mono font-bold outline-none cursor-pointer"
            >
              <option value="semua" className="bg-zinc-900 text-white">Semua</option>
              {DAFTAR_PILIHAN_BULAN.map((bln) => (
                <option key={bln.nomor} value={bln.nomor} className="bg-zinc-900 text-white">
                  {bln.romawi} ({bln.label})
                </option>
              ))}
            </select>
          </div>

          {/* Pilihan Urutan (Default: Terbaru) */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 px-2 py-1 rounded">
            <ArrowUpDown size={12} className="text-amber-400" />
            <span className="text-zinc-400 font-bold">Urutan:</span>
            <select
              value={urut}
              onChange={(e) => setUrut(e.target.value as any)}
              className="bg-transparent text-amber-400 font-bold outline-none cursor-pointer"
            >
              <option value="terbaru" className="bg-zinc-900 text-amber-400 font-bold">
                ▼ Terbaru (Default)
              </option>
              <option value="terlama" className="bg-zinc-900 text-zinc-200">
                ▲ Terlama
              </option>
              <option value="nomor_desc" className="bg-zinc-900 text-zinc-200">
                🔤 No. Surat (Z-A)
              </option>
              <option value="nomor_asc" className="bg-zinc-900 text-zinc-200">
                🔤 No. Surat (A-Z)
              </option>
            </select>
          </div>

          {/* Filter Lampiran */}
          <button
            onClick={() => setSaringLampiran(!saringLampiran)}
            className={`px-2 py-1 font-mono font-bold rounded flex items-center gap-1 transition-all ${
              saringLampiran
                ? 'lencana-dokumen border'
                : 'text-zinc-400 border border-zinc-800 hover:text-white bg-zinc-900'
            }`}
            title="Filter hanya surat yang memiliki berkas lampiran"
          >
            <Paperclip size={11} />
            <span>Ada Berkas ({hitung.adaDokumen})</span>
          </button>

          {/* Reset Filter Button */}
          {(cari || saringKategori !== 'semua' || saringLingkup !== 'semua' || saringTahun !== 'semua' || saringBulan !== 'semua' || saringLampiran || urut !== 'terbaru') && (
            <button
              onClick={() => {
                setCari('');
                setSaringKategori('semua');
                setSaringLingkup('semua');
                setSaringTahun('semua');
                setSaringBulan('semua');
                setSaringLampiran(false);
                setUrut('terbaru');
              }}
              className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-white !py-1 !px-2 flex items-center gap-1 text-[11px]"
              title="Reset semua filter ke bawaan"
            >
              <RotateCcw size={11} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ================= TABEL DATA NOMOR SURAT ================= */}
      <div className="overflow-x-auto custom-scrollbar border-[3px] border-zinc-700 bg-zinc-950 rounded sm:flex-1 sm:overflow-auto sm:min-h-0">
        {tersaring.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <FileText size={36} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-[14px] font-bold text-zinc-300 mb-1">
              Tidak ada nomor surat yang cocok
            </p>
            <p className="text-[12px] text-zinc-500 mb-3">
              Coba sesuaikan kata kunci pencarian atau filter kategori / tahun / bulan.
            </p>
            <button
              onClick={() => {
                setCari('');
                setSaringKategori('semua');
                setSaringLingkup('semua');
                setSaringTahun('semua');
                setSaringBulan('semua');
                setSaringLampiran(false);
                setUrut('terbaru');
              }}
              className="btn-retro btn-retro-sm bg-zinc-800"
            >
              Reset Filter
            </button>
          </div>
        ) : (
          <table className="min-w-[1000px] w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-zinc-900 text-zinc-200 text-[11px] uppercase tracking-wider font-mono border-b-2 border-zinc-700">
                <th className="text-center px-2 py-2.5 w-12">No.</th>
                <th className="text-left px-2 py-2.5 w-28">Kategori</th>
                <th
                  onClick={() => setUrut(urut === 'nomor_desc' ? 'nomor_asc' : 'nomor_desc')}
                  className="text-left px-2 py-2.5 w-52 cursor-pointer select-none hover:text-amber-400 transition-colors"
                  title="Klik untuk mengurutkan berdasarkan nomor surat"
                >
                  <div className="flex items-center gap-1">
                    <span>Nomor Surat</span>
                    {urut === 'nomor_desc' && <ArrowDown size={12} className="text-amber-400" />}
                    {urut === 'nomor_asc' && <ArrowUp size={12} className="text-amber-400" />}
                    {urut !== 'nomor_desc' && urut !== 'nomor_asc' && <ArrowUpDown size={11} className="text-zinc-500" />}
                  </div>
                </th>
                <th className="text-left px-3 py-2.5 min-w-[200px]">Perihal / Nama Surat</th>
                <th
                  onClick={() => setUrut(urut === 'terbaru' ? 'terlama' : 'terbaru')}
                  className="text-left px-2 py-2.5 w-36 cursor-pointer select-none hover:text-amber-400 transition-colors"
                  title="Klik untuk mengubah urutan tanggal (Terbaru / Terlama)"
                >
                  <div className="flex items-center gap-1">
                    <span>Jadwal / Tanggal</span>
                    {urut === 'terbaru' && <ArrowDown size={12} className="text-amber-400" />}
                    {urut === 'terlama' && <ArrowUp size={12} className="text-amber-400" />}
                    {urut !== 'terbaru' && urut !== 'terlama' && <ArrowUpDown size={11} className="text-zinc-500" />}
                  </div>
                </th>
                <th className="text-left px-3 py-2.5 w-48">Pihak / Tujuan</th>
                <th className="text-left px-2 py-2.5 w-28">Pembuat</th>
                <th className="text-center px-2 py-2.5 w-24">Dokumen</th>
                <th className="text-right px-3 py-2.5 w-28">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tersaring.map((item, idx) => {
                const infoKat = KATEGORI_SURAT_INFO[item.kategori];
                const jmlDok = item.dokumen?.length || 0;
                const disalin = tersalinId === item.id;

                const lencanaClass =
                  item.kategori === 'im'
                    ? 'lencana-im'
                    : item.kategori === 'surat_keluar'
                    ? 'lencana-sr'
                    : item.kategori === 'kontrak'
                    ? 'lencana-kk'
                    : 'lencana-ba';

                return (
                  <tr
                    key={item.id}
                    className={`border-b border-zinc-800/80 hover:bg-lime-500/10 transition-colors ${
                      idx % 2 === 1 ? 'bg-zinc-900/30' : 'bg-transparent'
                    }`}
                  >
                    {/* 1. Nomor Baris */}
                    <td className="text-center px-2 py-2 font-mono text-zinc-400 font-bold">
                      {idx + 1}
                    </td>

                    {/* 2. Kategori */}
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 font-mono text-[10px] font-bold uppercase rounded ${lencanaClass}`}>
                        {infoKat.singkatan} · {infoKat.lingkup}
                      </span>
                    </td>

                    {/* 3. Nomor Surat & Tombol Copy */}
                    <td className="px-2 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-amber-400">
                        <span className="truncate">{item.nomorSurat}</span>
                        <button
                          onClick={(e) => handleSalinNomor(item.nomorSurat, item.id, e)}
                          className="btn-ikon !w-5 !h-5 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600"
                          title="Salin Nomor Surat"
                        >
                          {disalin ? <Check size={11} className="text-lime-400" /> : <Copy size={11} />}
                        </button>
                      </div>
                    </td>

                    {/* 4. Perihal / Nama Surat / Keperluan */}
                    <td className="px-3 py-2 text-zinc-200">
                      <p className="font-semibold leading-tight line-clamp-2">
                        {item.kategori === 'im'
                          ? (item.keperluan || item.namaSurat || '—')
                          : (item.namaSurat || '—')}
                      </p>
                      {item.kategori === 'kontrak' && item.sistemPelaksanaan && (
                        <span className="text-[10px] text-zinc-400 font-mono">
                          Sistem: {item.sistemPelaksanaan}
                        </span>
                      )}
                    </td>

                    {/* 5. Jadwal / Tanggal */}
                    <td className="px-2 py-2 text-zinc-400 text-[11px] whitespace-nowrap font-mono">
                      {item.kategori === 'im' ? (
                        <div>
                          <div className="text-zinc-300 font-bold">{item.tanggalMulai || '—'}</div>
                          {item.tanggalBerakhir && item.tanggalBerakhir !== item.tanggalMulai && (
                            <div className="text-zinc-500">s/d {item.tanggalBerakhir}</div>
                          )}
                          {item.lamaHari ? (
                            <span className="text-[10px] text-amber-400 font-bold">
                              ({item.lamaHari} Hari)
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-zinc-300">{item.tanggal || '—'}</span>
                      )}
                    </td>

                    {/* 6. Pihak / Tujuan */}
                    <td className="px-3 py-2 text-zinc-300 text-[11px]">
                      {item.kategori === 'im' ? (
                        <div>
                          <p className="font-bold text-white flex items-center gap-1">
                            <User size={11} className="text-amber-400" /> {item.namaYangDitugaskan || '—'}
                          </p>
                          <p className="text-zinc-400 flex items-center gap-1">
                            <MapPin size={11} className="text-zinc-500" /> {item.tujuanDinas || '—'}
                          </p>
                        </div>
                      ) : item.kategori === 'kontrak' ? (
                        <div>
                          <p className="font-bold text-white">{item.pelaksana || '—'}</p>
                          {item.keterangan && <p className="text-zinc-400">{item.keterangan}</p>}
                        </div>
                      ) : (
                        <p className="line-clamp-2 text-zinc-200">{item.tujuanSurat || '—'}</p>
                      )}
                    </td>

                    {/* 7. Pembuat / Author */}
                    <td className="px-2 py-2 text-zinc-300 text-[11px] whitespace-nowrap">
                      {item.author || item.namaPembuat || '—'}
                    </td>

                    {/* 8. Dokumen Lampiran (Opsional) */}
                    <td className="text-center px-2 py-2 whitespace-nowrap">
                      {jmlDok > 0 ? (
                        <button
                          onClick={() => setDokumenLihat({ nomorSurat: item.nomorSurat, list: item.dokumen! })}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded lencana-dokumen text-[11px] font-mono font-bold hover:opacity-90"
                          title="Lihat / Unduh Berkas Lampiran"
                        >
                          <Paperclip size={11} /> {jmlDok}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSuratTerpilih(item);
                            setBukaModalForm(true);
                          }}
                          className="text-zinc-500 hover:text-zinc-300 text-[11px] flex items-center justify-center gap-0.5 mx-auto font-mono"
                          title="Tambah Lampiran (Opsional)"
                        >
                          <Paperclip size={11} /> —
                        </button>
                      )}
                    </td>

                    {/* 9. Aksi */}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {item.kategori === 'im' && onBukaMemoDinasDariSurat && (
                          <button
                            onClick={() => onBukaMemoDinasDariSurat(item)}
                            className="btn-ikon !w-7 !h-7 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white border border-amber-600/50"
                            title="Buka / Buat Surat Memo Dinas Resmi"
                          >
                            <ExternalLink size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSuratTerpilih(item);
                            setBukaModalForm(true);
                          }}
                          className="btn-ikon !w-7 !h-7 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-600"
                          title="Edit Nomor Surat"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={(e) => handleHapus(item.id, item.nomorSurat, e)}
                          className="btn-ikon !w-7 !h-7 !bg-red-700 hover:!bg-red-600 text-white border border-red-400"
                          title="Hapus Nomor Surat"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Form Tambah / Edit */}
      {bukaModalForm && (
        <FormNomorSuratModal
          initialData={suratTerpilih}
          daftarEksis={daftar}
          onSimpan={(item, bukaMemoDinas) => {
            onSimpanItem(item, bukaMemoDinas);
            setBukaModalForm(false);
            setSuratTerpilih(null);
          }}
          onTutup={() => {
            setBukaModalForm(false);
            setSuratTerpilih(null);
          }}
          notify={notify}
        />
      )}

      {/* Modal Cepat Lihat Dokumen Lampiran */}
      {dokumenLihat && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDokumenLihat(null)}
        >
          <div
            className="retro-box !bg-zinc-900 border-lime-500 w-full max-w-md p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
              <h4 className="font-title text-[13px] text-white flex items-center gap-1.5">
                <Paperclip size={14} className="text-lime-400" /> Lampiran: {dokumenLihat.nomorSurat}
              </h4>
              <button onClick={() => setDokumenLihat(null)} className="text-zinc-400 hover:text-white">
                ✕
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
              {dokumenLihat.list.map((dok) => (
                <div
                  key={dok.id}
                  className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800 text-[12px] rounded"
                >
                  <div className="truncate pr-2">
                    <p className="font-bold text-zinc-200 truncate">{dok.nama}</p>
                    <p className="text-[10px] text-zinc-500">
                      {(dok.ukuran / 1024).toFixed(1)} KB · {dok.tipe}
                    </p>
                  </div>
                  {dok.dataUrl && (
                    <button
                      onClick={() => handleUnduhDokumen(dok)}
                      className="btn-retro btn-retro-sm !bg-emerald-800 hover:!bg-emerald-700 text-white flex items-center gap-1 text-[11px]"
                    >
                      <Download size={12} /> Unduh
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
