import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Flame, MapPin, FileText, Plus, RefreshCw, Printer, Download, Eye,
  CheckCircle2, AlertTriangle, ShieldCheck, ChevronRight, ArrowLeft,
  Calendar, Layers, Filter, Search, Copy, Trash2, Edit3, Image as ImageIcon,
  Check, X, Clock, Send, AlertCircle, Trees, Mountain, Pickaxe,
  Upload, Camera, Save, ArrowUp, ArrowDown, Sparkles, Loader2, FolderPlus,
  ZoomIn, ZoomOut, ChevronsUpDown, Table, Map, Scale, CheckSquare
} from 'lucide-react';
import { FireMap } from './FireMap';
import {
  type TitikApiFireItem,
  type LaporanKarhutla,
  type TargetAreaLaporan,
  bisaDibuatkanLaporan,
  buatLaporanOtomatis,
  muatTitikApiMonitoring,
  simpanTitikApiMonitoring,
  muatDaftarLaporanKarhutla,
  simpanDaftarLaporanKarhutla,
  aturUlangTitikDemo,
} from '../lib/fire-report';
import { buatScreenshotPetaOtomatis, kompresGambar } from '../lib/map-snapshot';
import { diAplikasi } from '../lib/platform';
import { demoAktif } from '../lib/api';
import { KOTA_DEMO, kotaDemoTerpilih, pilihKotaDemo, wilayahFire } from '../lib/wilayah-fire';
import type { Pengguna } from '../lib/tipe-api';

interface Props {
  pengguna: Pengguna;
  notify: (pesan: string) => void;
}

export const FireMonkeyScreen: React.FC<Props> = ({ pengguna, notify }) => {
  // ---------------------------------------------------------------------------
  // STATE UTAMA
  // ---------------------------------------------------------------------------
  const [tabMode, setTabMode] = useState<'peta' | 'laporan' | 'riwayat'>('peta');
  const [titikList, setTitikList] = useState<TitikApiFireItem[]>(muatTitikApiMonitoring);

  // Mode demo: pemakai memilih satu kota; wilayah contoh dan titik api fiktif
  // dipindah ke sana, sehingga tidak ada data konsesi perusahaan yang tampil.
  const modeDemo = demoAktif();
  const [kotaDemo, setKotaDemo] = useState(() => kotaDemoTerpilih().id);
  const gantiKotaDemo = (id: string) => {
    const kota = pilihKotaDemo(id);
    setKotaDemo(kota.id);
    setTitikList(aturUlangTitikDemo());
    notify(`PETA DEMO DIPINDAH KE ${kota.nama.toUpperCase()}`);
  };
  const idn = wilayahFire().identitas;
  const kopPerusahaan = modeDemo ? idn.perusahaan.toUpperCase() : 'PT. ENERGI BATUBARA LESTARI';
  const [daftarLaporan, setDaftarLaporan] = useState<LaporanKarhutla[]>(muatDaftarLaporanKarhutla);
  const [laporanAktifId, setLaporanAktifId] = useState<string | null>(() => {
    const list = muatDaftarLaporanKarhutla();
    return list[0]?.id || null;
  });

  // State Peta & Seleksi Titik
  const [titikTerpilihIds, setTitikTerpilihIds] = useState<string[]>([]);
  const [titikFokus, setTitikFokus] = useState<TitikApiFireItem | null>(null);
  const [filterZona, setFilterZona] = useState<string>('semua');
  const [pencarian, setPencarian] = useState<string>('');

  // Mode Edit Laporan & Draft State
  // Pengaturan Layout Tampilan: 'seimbang' (default) | 'tabel-luas' | 'peta-luas'
  const [modeLayout, setModeLayout] = useState<'seimbang' | 'tabel-luas' | 'peta-luas'>(() => {
    try {
      const t = localStorage.getItem('pokemonkey_fire_layout') as 'seimbang' | 'tabel-luas' | 'peta-luas' | null;
      if (t) return t;
    } catch { /* abaikan */ }
    return 'seimbang';
  });
  const ubahModeLayout = (mode: 'seimbang' | 'tabel-luas' | 'peta-luas') => {
    setModeLayout(mode);
    try { localStorage.setItem('pokemonkey_fire_layout', mode); } catch { /* abaikan */ }
  };

  // Pengaturan Zoom Font Tabel Titik Api
  const [zoomTabel, setZoomTabel] = useState<number>(() => {
    try { return Number(localStorage.getItem('pokemonkey_fire_zoom')) || 1; } catch { return 1; }
  });
  const ubahZoom = (arah: 1 | -1) => setZoomTabel((z) => {
    const baru = Math.min(1.4, Math.max(0.8, Math.round((z + arah * 0.05) * 100) / 100));
    try { localStorage.setItem('pokemonkey_fire_zoom', String(baru)); } catch { /* abaikan */ }
    return baru;
  });

  const [modeEditLaporan, setModeEditLaporan] = useState<boolean>(false);
  const [draftLaporan, setDraftLaporan] = useState<LaporanKarhutla | null>(null);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState<boolean>(false);
  const [isUploadingFoto, setIsUploadingFoto] = useState<boolean>(false);

  // Hidden File Inputs Refs
  const inputUploadFotoRef = useRef<HTMLInputElement>(null);
  const inputUploadPetaRef = useRef<HTMLInputElement>(null);

  // Simpan otomatis ke localStorage
  useEffect(() => {
    simpanTitikApiMonitoring(titikList);
  }, [titikList]);

  useEffect(() => {
    simpanDaftarLaporanKarhutla(daftarLaporan);
  }, [daftarLaporan]);

  // Laporan yang sedang dibuka di tab laporan
  const laporanAktif = useMemo(() => {
    if (!laporanAktifId) return daftarLaporan[0] || null;
    return daftarLaporan.find((l) => l.id === laporanAktifId) || daftarLaporan[0] || null;
  }, [daftarLaporan, laporanAktifId]);

  // Dokumen yang ditampilkan (pakai draft saat mode edit aktif)
  const laporanDitampilkan = (modeEditLaporan && draftLaporan) ? draftLaporan : laporanAktif;

  // Metrik ringkasan titik api
  const metrik = useMemo(() => {
    const total = titikList.length;
    const diDalam = titikList.filter((t) => bisaDibuatkanLaporan(t)).length;
    const ippkh = titikList.filter((t) => t.zona === 'ippkh').length;
    const iup = titikList.filter((t) => t.zona === 'iup').length;
    const das = titikList.filter((t) => t.area === 'das' || t.zona === 'petak').length;
    const waspada = titikList.filter((t) => t.zona === 'waspada').length;
    const pantau = titikList.filter((t) => t.zona === 'pantau').length;
    const padam = titikList.filter((t) => t.status === 'padam').length;
    return { total, diDalam, ippkh, iup, das, waspada, pantau, padam };
  }, [titikList]);

  // Titik yang terfilter di tabel bawah
  const titikTerfilter = useMemo(() => {
    return titikList.filter((t) => {
      if (filterZona === 'didalam' && !bisaDibuatkanLaporan(t)) return false;
      if (filterZona === 'ippkh' && t.zona !== 'ippkh') return false;
      if (filterZona === 'iup' && t.zona !== 'iup') return false;
      if (filterZona === 'das' && t.area !== 'das' && t.zona !== 'petak') return false;
      if (filterZona === 'waspada' && t.zona !== 'waspada') return false;
      if (filterZona === 'padam' && t.status !== 'padam') return false;

      if (pencarian.trim()) {
        const cari = pencarian.toLowerCase();
        const cocokSatelit = t.sumber.toLowerCase().includes(cari);
        const cocokZona = t.zona.toLowerCase().includes(cari);
        const cocokBidang = (t.bidang || '').toLowerCase().includes(cari);
        const cocokDesa = (t.desa || '').toLowerCase().includes(cari);
        if (!cocokSatelit && !cocokZona && !cocokBidang && !cocokDesa) return false;
      }
      return true;
    });
  }, [titikList, filterZona, pencarian]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const handleTogglePilihTitik = (id: string) => {
    setTitikTerpilihIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handlePilihSemuaDiDalam = (zonaKhusus?: 'das' | 'ippkh' | 'iup') => {
    let ids: string[] = [];
    if (zonaKhusus === 'das') {
      ids = titikList.filter((t) => t.area === 'das' || t.zona === 'petak').map((t) => t.id);
      notify(`${ids.length} TITIK ${modeDemo ? 'PETAK CONTOH' : 'REHAB DAS TAHURA'} DIPILIH`);
    } else if (zonaKhusus === 'ippkh') {
      ids = titikList.filter((t) => t.zona === 'ippkh').map((t) => t.id);
      notify(`${ids.length} TITIK ${modeDemo ? 'IZIN CONTOH' : 'IPPKH TAPIN'} DIPILIH`);
    } else if (zonaKhusus === 'iup') {
      ids = titikList.filter((t) => t.zona === 'iup').map((t) => t.id);
      notify(`${ids.length} TITIK ${modeDemo ? 'AREA KERJA CONTOH' : 'IUP TAPIN'} DIPILIH`);
    } else {
      ids = titikList.filter(bisaDibuatkanLaporan).map((t) => t.id);
      notify(`${ids.length} TITIK DI DALAM KONSESI DIPILIH`);
    }
    setTitikTerpilihIds(ids);
  };

  /**
   * Membuat laporan otomatis dengan opsi target area spesifik
   * dan langsung menghasilkan screenshot peta resmi secara otomatis
   */
  const handleBuatLaporan = async (target: TargetAreaLaporan = 'auto') => {
    try {
      let titikUntukLaporan: TitikApiFireItem[] = [];

      if (target === 'das') {
        titikUntukLaporan = titikList.filter((t) => t.area === 'das' || t.zona === 'petak');
      } else if (target === 'ippkh') {
        titikUntukLaporan = titikList.filter((t) => t.zona === 'ippkh');
      } else if (target === 'iup') {
        titikUntukLaporan = titikList.filter((t) => t.zona === 'iup');
      } else {
        if (titikTerpilihIds.length > 0) {
          titikUntukLaporan = titikList.filter(
            (t) => titikTerpilihIds.includes(t.id) && bisaDibuatkanLaporan(t),
          );
        }
        if (titikUntukLaporan.length === 0) {
          titikUntukLaporan = titikList.filter(bisaDibuatkanLaporan);
        }
      }

      if (titikUntukLaporan.length === 0) {
        notify(`TIDAK ADA TITIK API UNTUK AREA ${target.toUpperCase()}`);
        return;
      }

      const laporanBaru = buatLaporanOtomatis({
        titikList: titikUntukLaporan,
        targetArea: target,
        pengguna,
      });

      // Otomatis buatkan screenshot peta resmi resolusi tinggi (Canvas WGS 1984)
      try {
        const snapshotUrl = await buatScreenshotPetaOtomatis({
          titikKoordinat: laporanBaru.titikKoordinat,
          jenisIzin: laporanBaru.jenisIzin,
          nomorLaporan: laporanBaru.nomorLaporan,
          tanggalLaporan: laporanBaru.tanggalLaporan,
        });
        laporanBaru.dokumentasi.petaSipongi = [snapshotUrl, ...laporanBaru.dokumentasi.petaSipongi];
      } catch (errSnap) {
        console.warn('Gagal buat initial map snapshot:', errSnap);
      }

      setDaftarLaporan((prev) => [laporanBaru, ...prev]);
      setLaporanAktifId(laporanBaru.id);
      setTabMode('laporan');
      notify(`LAPORAN ${laporanBaru.jenisIzin.toUpperCase()} & SCREENSHOT PETA BERHASIL DIBUAT`);
    } catch (err) {
      notify(err instanceof Error ? err.message.toUpperCase() : 'GAGAL MEMBUAT LAPORAN');
    }
  };

  /**
   * Helper pembaruan data laporan aktif (menyimpan ke draft jika sedang edit, atau langsung ke daftar)
   */
  const mutateLaporan = (updater: (prev: LaporanKarhutla) => LaporanKarhutla) => {
    if (modeEditLaporan && draftLaporan) {
      setDraftLaporan((prev) => (prev ? updater(prev) : prev));
    } else if (laporanAktif) {
      const updated = updater(laporanAktif);
      setDaftarLaporan((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS EDIT DOKUMEN & FOTO
  // ---------------------------------------------------------------------------
  const handleMulaiEdit = () => {
    if (!laporanAktif) return;
    setDraftLaporan(JSON.parse(JSON.stringify(laporanAktif)));
    setModeEditLaporan(true);
    notify('MODE EDIT DOKUMEN DIAKTIFKAN');
  };

  const handleSimpanEdit = () => {
    if (!draftLaporan) return;
    const sekarang = new Date().toISOString();
    const updated: LaporanKarhutla = { ...draftLaporan, diubahPada: sekarang };
    setDaftarLaporan((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setModeEditLaporan(false);
    setDraftLaporan(null);
    notify('PERUBAHAN DOKUMEN BERHASIL DISIMPAN');
  };

  const handleBatalEdit = () => {
    setModeEditLaporan(false);
    setDraftLaporan(null);
    notify('SUNTINGAN DIBATALKAN');
  };

  /**
   * Menghasilkan screenshot peta resmi secara otomatis
   */
  const handleGenerateScreenshotPeta = async () => {
    const target = draftLaporan || laporanAktif;
    if (!target) return;
    setIsGeneratingSnapshot(true);
    try {
      const snapshotUrl = await buatScreenshotPetaOtomatis({
        titikKoordinat: target.titikKoordinat,
        jenisIzin: target.jenisIzin,
        nomorLaporan: target.nomorLaporan,
        tanggalLaporan: target.tanggalLaporan,
      });

      mutateLaporan((lap) => ({
        ...lap,
        dokumentasi: {
          ...lap.dokumentasi,
          petaSipongi: [snapshotUrl, ...lap.dokumentasi.petaSipongi],
        },
      }));
      notify('SCREENSHOT PETA RESMI BERHASIL DIBUAT OTOMATIS');
    } catch (err) {
      console.error(err);
      notify('GAGAL MEMBUAT SCREENSHOT PETA OTOMATIS');
    } finally {
      setIsGeneratingSnapshot(false);
    }
  };

  /**
   * Mengunggah foto dokumentasi lapangan (kompresi otomatis canvas)
   */
  const handleUploadFotoDokumentasi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploadingFoto(true);

    try {
      const fotoBaruList: LaporanKarhutla['dokumentasi']['fotoLapangan'] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await kompresGambar(file);
        const namaBersih = file.name.replace(/\.[^/.]+$/, '').toUpperCase();
        fotoBaruList.push({
          url: dataUrl,
          judul: `Foto Ground Check: ${namaBersih}`,
          deskripsi: `Dokumentasi verifikasi lapangan tim ${idn.perusahaan} (${new Date().toLocaleDateString('id-ID')}).`,
          kategori: 'tindakan',
        });
      }

      mutateLaporan((lap) => ({
        ...lap,
        dokumentasi: {
          ...lap.dokumentasi,
          fotoLapangan: [...lap.dokumentasi.fotoLapangan, ...fotoBaruList],
        },
      }));
      notify(`${fotoBaruList.length} FOTO DOKUMENTASI BERHASIL DIUNGGAH`);
    } catch (err) {
      console.error(err);
      notify('GAGAL MENGUNGGAH FOTO DOKUMENTASI');
    } finally {
      setIsUploadingFoto(false);
      e.target.value = '';
    }
  };

  /**
   * Mengunggah tangkapan layar peta / SiPongi secara manual
   */
  const handleUploadPetaSipongi = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const dataUrl = await kompresGambar(files[i]);
        urls.push(dataUrl);
      }

      mutateLaporan((lap) => ({
        ...lap,
        dokumentasi: {
          ...lap.dokumentasi,
          petaSipongi: [...urls, ...lap.dokumentasi.petaSipongi],
        },
      }));
      notify(`${urls.length} SCREENSHOT PETA BERHASIL DIUNGGAH`);
    } catch (err) {
      notify('GAGAL MENGUNGGAH SCREENSHOT PETA');
    } finally {
      e.target.value = '';
    }
  };

  /**
   * Menghapus foto dokumentasi lapangan
   */
  const handleHapusFotoLapangan = (idx: number) => {
    if (confirm('Hapus foto dokumentasi ini dari berkas laporan?')) {
      mutateLaporan((lap) => ({
        ...lap,
        dokumentasi: {
          ...lap.dokumentasi,
          fotoLapangan: lap.dokumentasi.fotoLapangan.filter((_, i) => i !== idx),
        },
      }));
      notify('FOTO DOKUMENTASI DIHAPUS');
    }
  };

  /**
   * Menghapus screenshot peta
   */
  const handleHapusPetaSipongi = (idx: number) => {
    if (confirm('Hapus tangkapan layar peta ini dari laporan?')) {
      mutateLaporan((lap) => ({
        ...lap,
        dokumentasi: {
          ...lap.dokumentasi,
          petaSipongi: lap.dokumentasi.petaSipongi.filter((_, i) => i !== idx),
        },
      }));
      notify('SCREENSHOT PETA DIHAPUS');
    }
  };

  /**
   * Menggeser urutan foto dokumentasi (naik / turun)
   */
  const handleGeserFoto = (idx: number, arah: 'atas' | 'bawah') => {
    mutateLaporan((lap) => {
      const list = [...lap.dokumentasi.fotoLapangan];
      const targetIdx = arah === 'atas' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return lap;
      const temp = list[idx];
      list[idx] = list[targetIdx];
      list[targetIdx] = temp;
      return {
        ...lap,
        dokumentasi: { ...lap.dokumentasi, fotoLapangan: list },
      };
    });
  };

  const handleUbahStatusLaporan = (id: string, status: LaporanKarhutla['status']) => {
    setDaftarLaporan((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status, diubahPada: new Date().toISOString() } : l)),
    );
    notify(`STATUS LAPORAN DIUBAH KE ${status.toUpperCase()}`);
  };

  const handleHapusLaporan = (id: string) => {
    const l = daftarLaporan.find((item) => item.id === id);
    if (!l) return;
    if (confirm(`Hapus berkas laporan "${l.judul}"?`)) {
      setDaftarLaporan((prev) => prev.filter((item) => item.id !== id));
      if (laporanAktifId === id) {
        setLaporanAktifId(daftarLaporan[1]?.id || null);
      }
      notify(`LAPORAN ${l.nomorLaporan} TELAH DIHAPUS`);
    }
  };

  const handleCetakDokumen = () => {
    // Browser mencetak judul halaman di kepala kertas; dokumen resmi KLHK tidak
    // boleh membawa nama aplikasi, jadi judulnya dikosongkan selama mencetak.
    const judulAsli = document.title;
    document.title = ' ';
    window.print();
    setTimeout(() => { document.title = judulAsli; }, 1000);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black/40">
      {/* ===================================================================== */}
      {/* TOOLBAR HEADER ATAS (Hidden on Print)                                */}
      {/* ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-4 border-white pb-2 mb-2 px-2 pt-2 bg-black/60 shrink-0 no-print">
        <div className="flex items-center gap-2 mr-auto">
          <h2 className="judul-layar flex items-center gap-2">
            <Flame size={18} className="text-orange-500 fill-orange-500 animate-pulse" /> FIRE MONKEY
          </h2>
          <span className="text-[11px] font-mono text-zinc-400 hidden lg:inline">
            {modeDemo ? '| DEMO · WILAYAH CONTOH' : '| MONITORING TITIK API IUP, IPPKH & REHABDAS'}
          </span>
        </div>

        {modeDemo && (
          <label className="flex items-center gap-1.5 text-[11px] text-amber-200 bg-amber-950/60 border-2 border-amber-500 px-2 py-1">
            <MapPin size={12} className="text-amber-400" />
            <span className="font-bold uppercase">Kota demo</span>
            <select
              value={kotaDemo}
              onChange={(e) => gantiKotaDemo(e.target.value)}
              className="input-retro !w-auto !py-0.5 !text-[11px]"
              aria-label="Pilih kota untuk peta demo"
            >
              {KOTA_DEMO.map((k) => <option key={k.id} value={k.id}>{k.nama} · {k.provinsi}</option>)}
            </select>
          </label>
        )}

        {/* Tab Mode Switcher */}
        <div className="flex border-2 border-white/40">
          <button
            onClick={() => setTabMode('peta')}
            className={`px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase transition-colors ${
              tabMode === 'peta' ? 'bg-orange-600 text-white' : 'bg-black/40 text-zinc-300 hover:text-white'
            }`}
          >
            <MapPin size={13} /> Peta Hotspot
          </button>
          <button
            onClick={() => setTabMode('laporan')}
            className={`px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase transition-colors ${
              tabMode === 'laporan' ? 'bg-orange-600 text-white' : 'bg-black/40 text-zinc-300 hover:text-white'
            }`}
          >
            <FileText size={13} /> Dokumen Resmi KLHK
          </button>
          <button
            onClick={() => setTabMode('riwayat')}
            className={`px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase transition-colors ${
              tabMode === 'riwayat' ? 'bg-orange-600 text-white' : 'bg-black/40 text-zinc-300 hover:text-white'
            }`}
          >
            <Calendar size={13} /> Riwayat ({daftarLaporan.length})
          </button>
        </div>

        {/* Tombol Buat Laporan Cepat per Wilayah */}
        <div className="flex items-center gap-1.5">
          {/* Tombol Khusus REHAB DAS */}
          <button
            onClick={() => handleBuatLaporan('das')}
            className="btn-retro bg-amber-700 hover:bg-amber-600 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px] shadow-[2px_2px_0_#000]"
            title={`Buat laporan resmi khusus petak di ${idn.kawasanDas}`}
          >
            <Trees size={13} className="text-yellow-300" />
            <span>Laporan Rehab DAS</span>
            <span className="bg-black/40 px-1 py-0.2 rounded text-[10px] font-mono text-yellow-300">
              {metrik.das}
            </span>
          </button>

          {/* Tombol Khusus IPPKH */}
          <button
            onClick={() => handleBuatLaporan('ippkh')}
            className="btn-retro bg-emerald-800 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px] shadow-[2px_2px_0_#000]"
            title={`Buat laporan resmi khusus ${idn.labelIppkh}`}
          >
            <Mountain size={13} className="text-emerald-300" />
            <span>Laporan IPPKH</span>
            <span className="bg-black/40 px-1 py-0.2 rounded text-[10px] font-mono text-emerald-300">
              {metrik.ippkh}
            </span>
          </button>

          {/* Tombol Buat Laporan Titik Terpilih */}
          <button
            onClick={() => handleBuatLaporan('auto')}
            className="btn-retro bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px] shadow-[2px_2px_0_#000]"
            title="Buat Laporan Otomatis dari titik-titik yang dipilih"
          >
            <Flame size={13} className="fill-white" />
            <span className="hidden sm:inline">Laporan Otomatis</span>
            {titikTerpilihIds.length > 0 && (
              <span className="bg-black/50 px-1 py-0.2 rounded text-[10px] font-mono">
                {titikTerpilihIds.length} Titik
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAMPILAN 1: PETA HOTSPOT & DAFTAR TITIK API                           */}
      {/* ===================================================================== */}
      {tabMode === 'peta' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar px-2 pb-8 gap-3.5 no-print">
          {/* ================================================================= */}
          {/* 1. KARTU METRIK RINGKAS & INTERAKTIF (Bisa diklik untuk filter)    */}
          {/* ================================================================= */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
            {/* Titik Di Dalam (Perlu Laporan) */}
            <div
              onClick={() => setFilterZona((prev) => (prev === 'didalam' ? 'semua' : 'didalam'))}
              className={`panel-retro p-2.5 flex items-center gap-3 cursor-pointer transition-all ${
                filterZona === 'didalam'
                  ? 'bg-red-950/80 border-2 border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] ring-1 ring-red-400'
                  : 'bg-black/70 border-2 border-red-500/70 hover:border-red-400 hover:bg-red-950/30'
              }`}
              title="Klik untuk menyaring titik di dalam konsesi IUP/IPPKH/DAS"
            >
              <div className="w-10 h-10 rounded bg-red-950/90 border border-red-500 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
                <Flame size={20} className="fill-red-400 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-red-300 font-bold uppercase tracking-wider font-mono">
                    Di Dalam Konsesi
                  </span>
                  {filterZona === 'didalam' && (
                    <span className="text-[9px] bg-red-600 text-white font-mono px-1 rounded">AKTIF</span>
                  )}
                </div>
                <div className="text-[18px] font-black text-white font-mono leading-tight mt-0.5">
                  {metrik.diDalam}{' '}
                  <span className="text-[11px] font-normal text-red-400">Titik Panas</span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                  IPPKH: <b className="text-emerald-300">{metrik.ippkh}</b> · IUP: <b className="text-cyan-300">{metrik.iup}</b> · DAS: <b className="text-amber-300">{metrik.das}</b>
                </div>
              </div>
            </div>

            {/* Khusus REHAB DAS Highlight */}
            <div
              onClick={() => setFilterZona((prev) => (prev === 'das' ? 'semua' : 'das'))}
              className={`panel-retro p-2.5 flex items-center gap-3 cursor-pointer transition-all ${
                filterZona === 'das'
                  ? 'bg-amber-950/80 border-2 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] ring-1 ring-amber-400'
                  : 'bg-black/70 border-2 border-amber-500/70 hover:border-amber-400 hover:bg-amber-950/30'
              }`}
              title={`Klik untuk menyaring titik di ${idn.kawasanDas}`}
            >
              <div className="w-10 h-10 rounded bg-amber-950/90 border border-amber-400 flex items-center justify-center text-amber-300 shrink-0 shadow-inner">
                <Trees size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider font-mono">
                    Petak Rehab DAS
                  </span>
                  {filterZona === 'das' && (
                    <span className="text-[9px] bg-amber-600 text-white font-mono px-1 rounded">AKTIF</span>
                  )}
                </div>
                <div className="text-[18px] font-black text-amber-200 font-mono leading-tight mt-0.5">
                  {metrik.das}{' '}
                  <span className="text-[11px] font-normal text-amber-300">Titik</span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                  {modeDemo ? idn.kawasanDas : 'Tahura Sultan Adam (Blok Lindung)'}
                </div>
              </div>
            </div>

            {/* Waspada Dekat Batas */}
            <div
              onClick={() => setFilterZona((prev) => (prev === 'waspada' ? 'semua' : 'waspada'))}
              className={`panel-retro p-2.5 flex items-center gap-3 cursor-pointer transition-all ${
                filterZona === 'waspada'
                  ? 'bg-yellow-950/80 border-2 border-yellow-400 shadow-[0_0_12px_rgba(234,179,8,0.5)] ring-1 ring-yellow-400'
                  : 'bg-black/70 border-2 border-yellow-500/60 hover:border-yellow-400 hover:bg-yellow-950/30'
              }`}
              title="Klik untuk menyaring titik zona waspada"
            >
              <div className="w-10 h-10 rounded bg-yellow-950/90 border border-yellow-500 flex items-center justify-center text-yellow-400 shrink-0 shadow-inner">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-yellow-300 font-bold uppercase tracking-wider font-mono">
                    Waspada Perimeter
                  </span>
                  {filterZona === 'waspada' && (
                    <span className="text-[9px] bg-yellow-600 text-black font-mono px-1 rounded font-bold">AKTIF</span>
                  )}
                </div>
                <div className="text-[18px] font-black text-yellow-300 font-mono leading-tight mt-0.5">
                  {metrik.waspada}{' '}
                  <span className="text-[11px] font-normal text-zinc-400">Titik (≤ 2 km)</span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                  Pantau rambatan ke batas konsesi
                </div>
              </div>
            </div>

            {/* Status Penanganan */}
            <div
              onClick={() => setFilterZona((prev) => (prev === 'padam' ? 'semua' : 'padam'))}
              className={`panel-retro p-2.5 flex items-center gap-3 cursor-pointer transition-all ${
                filterZona === 'padam'
                  ? 'bg-emerald-950/80 border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)] ring-1 ring-emerald-400'
                  : 'bg-black/70 border-2 border-emerald-500/60 hover:border-emerald-400 hover:bg-emerald-950/30'
              }`}
              title="Klik untuk melihat titik yang sudah padam"
            >
              <div className="w-10 h-10 rounded bg-emerald-950/90 border border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider font-mono">
                    Telah Padam / Terkendali
                  </span>
                  {filterZona === 'padam' && (
                    <span className="text-[9px] bg-emerald-600 text-white font-mono px-1 rounded">AKTIF</span>
                  )}
                </div>
                <div className="text-[18px] font-black text-emerald-400 font-mono leading-tight mt-0.5">
                  {metrik.padam}{' '}
                  <span className="text-[11px] font-normal text-zinc-400">Tuntas</span>
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5 truncate">
                  0 Korban · Karhutla Terkendali
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* 2. PETA GIS INTERAKTIF (Tinggi dinamis berdasarkan modeLayout)    */}
          {/* ================================================================= */}
          <div
            className={`relative rounded border-2 border-emerald-500/60 shadow-lg transition-all duration-300 overflow-hidden ${
              modeLayout === 'peta-luas'
                ? 'h-[500px] lg:h-[58vh] shrink-0'
                : modeLayout === 'tabel-luas'
                ? 'h-[190px] shrink-0'
                : 'h-[330px] shrink-0'
            }`}
          >
            <FireMap
              key={modeDemo ? kotaDemo : 'kerja'}
              titikList={titikList}
              titikTerpilihIds={titikTerpilihIds}
              titikFokus={titikFokus}
              onPilihTitik={(t) => {
                setTitikFokus(t);
              }}
              onTogglePilihLaporan={handleTogglePilihTitik}
            />
          </div>

          {/* ================================================================= */}
          {/* 3. KOTAK TABEL TITIK API (Lebar, jelas, dan tidak terpotong)      */}
          {/* ================================================================= */}
          <div
            className={`panel-retro !p-0 bg-black/80 border-2 border-emerald-500/70 rounded shadow-xl flex flex-col transition-all duration-300 ${
              modeLayout === 'tabel-luas'
                ? 'min-h-[580px]'
                : modeLayout === 'peta-luas'
                ? 'min-h-[280px]'
                : 'min-h-[440px]'
            }`}
          >
            {/* Header Kontrol & Penyaring Tabel */}
            <div className="p-3 border-b-2 border-emerald-500/40 bg-zinc-900/90 flex flex-col gap-2.5">
              {/* Baris 1: Filter Kategori & Tombol Pilih Semua */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-emerald-300 font-mono text-[11px] font-bold flex items-center gap-1 mr-1">
                    <Filter size={12} /> Saring:
                  </span>
                  <button
                    onClick={() => setFilterZona('semua')}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded border transition-all ${
                      filterZona === 'semua'
                        ? 'bg-orange-600 text-white border-orange-400 shadow-[1px_1px_0_#000]'
                        : 'bg-zinc-900 text-zinc-400 border-white/10 hover:text-white'
                    }`}
                  >
                    Semua ({titikList.length})
                  </button>
                  <button
                    onClick={() => setFilterZona('didalam')}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded border flex items-center gap-1 transition-all ${
                      filterZona === 'didalam'
                        ? 'bg-red-700 text-white border-red-400 shadow-[1px_1px_0_#000]'
                        : 'bg-zinc-900 text-red-300 border-red-500/30 hover:border-red-400'
                    }`}
                  >
                    <Flame size={12} className="fill-red-400" /> Di Dalam ({metrik.diDalam})
                  </button>
                  <button
                    onClick={() => setFilterZona('das')}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded border flex items-center gap-1 transition-all ${
                      filterZona === 'das'
                        ? 'bg-amber-700 text-white border-amber-400 shadow-[1px_1px_0_#000]'
                        : 'bg-zinc-900 text-amber-300 border-amber-500/30 hover:border-amber-400'
                    }`}
                  >
                    <Trees size={12} /> Rehab DAS ({metrik.das})
                  </button>
                  <button
                    onClick={() => setFilterZona('ippkh')}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded border flex items-center gap-1 transition-all ${
                      filterZona === 'ippkh'
                        ? 'bg-emerald-700 text-white border-emerald-400 shadow-[1px_1px_0_#000]'
                        : 'bg-zinc-900 text-emerald-300 border-emerald-500/30 hover:border-emerald-400'
                    }`}
                  >
                    <Mountain size={12} /> IPPKH ({metrik.ippkh})
                  </button>
                  <button
                    onClick={() => setFilterZona('iup')}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded border flex items-center gap-1 transition-all ${
                      filterZona === 'iup'
                        ? 'bg-cyan-700 text-white border-cyan-400 shadow-[1px_1px_0_#000]'
                        : 'bg-zinc-900 text-cyan-300 border-cyan-500/30 hover:border-cyan-400'
                    }`}
                  >
                    <Pickaxe size={12} /> IUP ({metrik.iup})
                  </button>
                  <button
                    onClick={() => setFilterZona('waspada')}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded border flex items-center gap-1 transition-all ${
                      filterZona === 'waspada'
                        ? 'bg-yellow-700 text-white border-yellow-400 shadow-[1px_1px_0_#000]'
                        : 'bg-zinc-900 text-yellow-300 border-yellow-500/30 hover:border-yellow-400'
                    }`}
                  >
                    <AlertTriangle size={12} /> Waspada ({metrik.waspada})
                  </button>
                  <button
                    onClick={() => setFilterZona('padam')}
                    className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded border flex items-center gap-1 transition-all ${
                      filterZona === 'padam'
                        ? 'bg-emerald-800 text-white border-emerald-300 shadow-[1px_1px_0_#000]'
                        : 'bg-zinc-900 text-emerald-400 border-emerald-500/30 hover:border-emerald-400'
                    }`}
                  >
                    <ShieldCheck size={12} /> Padam ({metrik.padam})
                  </button>
                </div>

                {/* Tombol Pilih Cepat untuk Laporan */}
                <div className="flex items-center gap-2">
                  {filterZona === 'das' ? (
                    <button
                      type="button"
                      onClick={() => handlePilihSemuaDiDalam('das')}
                      className="btn-retro bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-400 !py-1 text-[11px] font-bold flex items-center gap-1"
                    >
                      <CheckSquare size={13} /> Pilih Semua Rehab DAS
                    </button>
                  ) : filterZona === 'ippkh' ? (
                    <button
                      type="button"
                      onClick={() => handlePilihSemuaDiDalam('ippkh')}
                      className="btn-retro bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-400 !py-1 text-[11px] font-bold flex items-center gap-1"
                    >
                      <CheckSquare size={13} /> Pilih Semua IPPKH
                    </button>
                  ) : filterZona === 'iup' ? (
                    <button
                      type="button"
                      onClick={() => handlePilihSemuaDiDalam('iup')}
                      className="btn-retro bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-400 !py-1 text-[11px] font-bold flex items-center gap-1"
                    >
                      <CheckSquare size={13} /> Pilih Semua IUP
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePilihSemuaDiDalam()}
                      className="btn-retro bg-red-950/60 hover:bg-red-900 text-red-200 border border-red-500 !py-1 text-[11px] font-bold flex items-center gap-1"
                    >
                      <CheckSquare size={13} /> Pilih Semua Titik Di Dalam
                    </button>
                  )}
                  {titikTerpilihIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTitikTerpilihIds([])}
                      className="text-zinc-400 hover:text-white underline font-mono text-[10px]"
                    >
                      Batal Pilih
                    </button>
                  )}
                </div>
              </div>

              {/* Baris 2: Pencarian, Zoom Font & Tombol Preset Layout (Seimbang / Tabel Luas / Peta Luas) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-emerald-500/20">
                {/* Search Bar dengan tombol clear */}
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    value={pencarian}
                    onChange={(e) => setPencarian(e.target.value)}
                    placeholder="Cari satelit, petak DAS, blok, desa, atau koordinat..."
                    className="input-retro !pl-8 !pr-7 !py-1 !text-[11px] w-full"
                  />
                  {pencarian && (
                    <button
                      onClick={() => setPencarian('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5"
                      title="Hapus pencarian"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Kontrol Kanan: Zoom Teks & Layout Preset Switcher */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Zoom Font Tabel */}
                  <div className="flex items-center gap-1 bg-black/50 border border-white/20 px-1.5 py-0.5 rounded">
                    <span className="text-[10px] text-zinc-400 font-mono mr-1">Teks:</span>
                    <button
                      type="button"
                      onClick={() => ubahZoom(-1)}
                      disabled={zoomTabel <= 0.8}
                      className="btn-ikon !w-6 !h-6 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded text-white"
                      title="Perkecil teks tabel"
                    >
                      <ZoomOut size={12} />
                    </button>
                    <span className="text-[10px] font-mono text-emerald-400 w-9 text-center tabular-nums font-bold">
                      {Math.round(zoomTabel * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => ubahZoom(1)}
                      disabled={zoomTabel >= 1.4}
                      className="btn-ikon !w-6 !h-6 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded text-white"
                      title="Perbesar teks tabel"
                    >
                      <ZoomIn size={12} />
                    </button>
                  </div>

                  {/* Mode Layout Presets */}
                  <div className="flex items-center border border-emerald-500/50 rounded overflow-hidden shadow-inner">
                    <button
                      type="button"
                      onClick={() => ubahModeLayout('seimbang')}
                      className={`px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 transition-colors ${
                        modeLayout === 'seimbang'
                          ? 'bg-emerald-600 text-white font-black'
                          : 'bg-zinc-800 text-zinc-300 hover:text-white'
                      }`}
                      title="Tampilan seimbang antara Peta dan Tabel"
                    >
                      <Scale size={12} /> Seimbang
                    </button>
                    <button
                      type="button"
                      onClick={() => ubahModeLayout('tabel-luas')}
                      className={`px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 border-l border-emerald-500/50 transition-colors ${
                        modeLayout === 'tabel-luas'
                          ? 'bg-emerald-600 text-white font-black'
                          : 'bg-zinc-800 text-zinc-300 hover:text-white'
                      }`}
                      title="Tabel Luas: Peta diringkas ke atas agar tabel mendapatkan ruang maksimal"
                    >
                      <Table size={12} /> Tabel Luas
                    </button>
                    <button
                      type="button"
                      onClick={() => ubahModeLayout('peta-luas')}
                      className={`px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 border-l border-emerald-500/50 transition-colors ${
                        modeLayout === 'peta-luas'
                          ? 'bg-emerald-600 text-white font-black'
                          : 'bg-zinc-800 text-zinc-300 hover:text-white'
                      }`}
                      title="Peta Luas: Ruang peta diperbesar untuk navigasi GIS intensif"
                    >
                      <Map size={12} /> Peta Luas
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabel Titik Api dengan Sticky Header & Scroll Luas */}
            <div className="flex-1 overflow-auto custom-scrollbar">
              <table
                className="w-full text-[12px] border-collapse min-w-[850px]"
                style={{ zoom: zoomTabel }}
              >
                <thead className="bg-emerald-950 text-emerald-300 uppercase text-[10px] tracking-wider font-mono sticky top-0 z-10 shadow-md">
                  <tr className="border-b-2 border-emerald-500">
                    <th className="p-2.5 border-r border-emerald-700/40 text-center w-12">Pilih</th>
                    <th className="p-2.5 border-r border-emerald-700/40 text-left w-44">Zona & Area Izin</th>
                    <th className="p-2.5 border-r border-emerald-700/40 text-left w-40">Koordinat (WGS84)</th>
                    <th className="p-2.5 border-r border-emerald-700/40 text-left w-36">Satelit & Conf</th>
                    <th className="p-2.5 border-r border-emerald-700/40 text-left w-40">Waktu Deteksi</th>
                    <th className="p-2.5 border-r border-emerald-700/40 text-left min-w-[200px]">
                      Keterangan / Lokasi Lapangan
                    </th>
                    <th className="p-2.5 border-r border-emerald-700/40 text-center w-28">Status</th>
                    <th className="p-2.5 text-center w-36">Aksi Cepat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {titikTerfilter.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-zinc-400">
                        <AlertCircle size={28} className="mx-auto text-zinc-500 mb-2" />
                        <div className="font-bold text-zinc-300">Tidak ada titik api yang cocok dengan saringan.</div>
                        <div className="text-[11px] text-zinc-500 mt-1">
                          Coba ubah saringan zona atau bersihkan kata kunci pencarian.
                        </div>
                        {(filterZona !== 'semua' || pencarian) && (
                          <button
                            onClick={() => {
                              setFilterZona('semua');
                              setPencarian('');
                            }}
                            className="mt-3 btn-retro bg-zinc-800 text-zinc-200 text-[11px] !py-1 !px-3"
                          >
                            Reset Semua Saringan
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    titikTerfilter.map((t, idx) => {
                      const diDalam = bisaDibuatkanLaporan(t);
                      const dicentang = titikTerpilihIds.includes(t.id);
                      const isFokus = titikFokus?.id === t.id;
                      const isDas = t.area === 'das' || t.zona === 'petak';

                      return (
                        <tr
                          key={t.id}
                          className={`transition-colors ${
                            dicentang
                              ? 'bg-red-950/40 hover:bg-red-950/60'
                              : isFokus
                              ? 'bg-amber-950/40 hover:bg-amber-950/60'
                              : idx % 2 === 0
                              ? 'bg-black/40 hover:bg-emerald-500/10'
                              : 'bg-white/[0.04] hover:bg-emerald-500/10'
                          }`}
                        >
                          {/* 1. Checkbox Pilih */}
                          <td className="p-2.5 border-r border-white/5 text-center">
                            {diDalam ? (
                              <input
                                type="checkbox"
                                checked={dicentang}
                                onChange={() => handleTogglePilihTitik(t.id)}
                                className="w-4 h-4 accent-red-600 cursor-pointer rounded"
                                title="Centang untuk memasukkan titik ini ke Laporan Karhutla Resmi"
                              />
                            ) : (
                              <span className="text-zinc-600 text-[10px] select-none" title="Di luar konsesi (tidak perlu laporan KLHK)">—</span>
                            )}
                          </td>

                          {/* 2. Zona & Area */}
                          <td className="p-2.5 border-r border-white/5">
                            {isDas && (
                              <span className="chip-retro !text-[10px] border-amber-400 bg-amber-950/80 text-amber-300 font-bold flex items-center gap-1.5 w-fit">
                                <Trees size={12} className="text-amber-400 shrink-0" /> {modeDemo ? 'PETAK' : 'REHAB DAS'} ({t.bidang || idn.labelDas})
                              </span>
                            )}
                            {!isDas && t.zona === 'ippkh' && (
                              <span className="chip-retro !text-[10px] border-emerald-400 bg-emerald-950/80 text-emerald-300 font-bold flex items-center gap-1.5 w-fit">
                                <Mountain size={12} className="text-emerald-400 shrink-0" /> {modeDemo ? 'IZIN' : 'IPPKH'} ({t.bidang || idn.labelIppkh})
                              </span>
                            )}
                            {!isDas && t.zona === 'iup' && (
                              <span className="chip-retro !text-[10px] border-cyan-400 bg-cyan-950/80 text-cyan-300 font-bold flex items-center gap-1.5 w-fit">
                                <Pickaxe size={12} className="text-cyan-400 shrink-0" /> {modeDemo ? 'AREA KERJA' : 'IUP EBL'}
                              </span>
                            )}
                            {!isDas && t.zona === 'waspada' && (
                              <span className="chip-retro !text-[10px] border-yellow-500 bg-yellow-950/80 text-yellow-300 font-bold flex items-center gap-1.5 w-fit">
                                <AlertTriangle size={12} className="text-yellow-400 shrink-0" /> WASPADA (≤2km)
                              </span>
                            )}
                            {!isDas && t.zona === 'pantau' && (
                              <span className="chip-retro !text-[10px] border-zinc-600 bg-zinc-900 text-zinc-400 flex items-center gap-1.5 w-fit">
                                PANTAU LUAR
                              </span>
                            )}
                            {t.desa && (
                              <span className="text-[10px] text-zinc-400 block mt-1 font-mono">
                                Desa: {t.desa}
                              </span>
                            )}
                          </td>

                          {/* 3. Koordinat WGS84 */}
                          <td className="p-2.5 border-r border-white/5 font-mono text-[11px]">
                            <div className="text-emerald-400 font-bold">
                              {t.lat.toFixed(5)}° S
                            </div>
                            <div className="text-zinc-500">
                              {t.lon.toFixed(5)}° E
                            </div>
                          </td>

                          {/* 4. Satelit & Tingkat Keyakinan */}
                          <td className="p-2.5 border-r border-white/5">
                            <span className="font-bold text-white block">{t.sumber}</span>
                            <span className={`text-[10px] font-mono capitalize ${
                              t.keyakinan === 'tinggi'
                                ? 'text-red-400 font-bold'
                                : t.keyakinan === 'sedang'
                                ? 'text-yellow-300'
                                : 'text-zinc-400'
                            }`}>
                              Conf: {t.keyakinan}
                            </span>
                          </td>

                          {/* 5. Waktu Deteksi */}
                          <td className="p-2.5 border-r border-white/5 text-[11px] text-zinc-300">
                            <div className="font-mono">{new Date(t.waktu).toLocaleDateString('id-ID')}</div>
                            <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1 mt-0.5">
                              <Clock size={10} /> {new Date(t.waktu).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA
                            </div>
                          </td>

                          {/* 6. Keterangan & Catatan Lapangan */}
                          <td className="p-2.5 border-r border-white/5 text-[11px]">
                            <div className="font-bold text-amber-300">{t.penyebab || 'Penyebab belum tercatat'}</div>
                            <div className="text-zinc-400 text-[11px] mt-0.5">{t.catatan}</div>
                          </td>

                          {/* 7. Status Penanganan */}
                          <td className="p-2.5 border-r border-white/5 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                                t.status === 'padam'
                                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500'
                                  : t.status === 'dicek'
                                  ? 'bg-amber-950/80 text-amber-300 border-amber-500'
                                  : 'bg-red-950/80 text-red-300 border-red-500 animate-pulse'
                              }`}
                            >
                              {t.status === 'padam'
                                ? 'Sudah Padam'
                                : t.status === 'dicek'
                                ? 'Sedang Dicek'
                                : 'Hotspot Baru'}
                            </span>
                          </td>

                          {/* 8. Tombol Aksi */}
                          <td className="p-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setTitikFokus(t);
                                  // Scroll halus ke peta jika di mode tabel luas
                                  if (modeLayout === 'tabel-luas') {
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }
                                }}
                                className="btn-retro !py-1 !px-2 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold text-emerald-300 inline-flex items-center gap-1 border border-emerald-500/40"
                                title="Arahkan dan sorot titik ini di peta"
                              >
                                <MapPin size={11} /> Peta
                              </button>
                              {diDalam && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleBuatLaporan(isDas ? 'das' : t.zona === 'ippkh' ? 'ippkh' : 'iup');
                                  }}
                                  className={`btn-retro !py-1 !px-2 text-[10px] inline-flex items-center gap-1 font-bold ${
                                    isDas
                                      ? 'bg-amber-700 hover:bg-amber-600 text-white'
                                      : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                  }`}
                                  title="Buat berkas laporan resmi untuk titik ini"
                                >
                                  <Flame size={11} className="fill-white" /> Lapor
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Ringkasan Tabel & Tombol Buat Laporan Cepat */}
            <div className="p-2.5 border-t-2 border-emerald-500/40 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <div className="text-zinc-300">
                Menampilkan <b className="text-emerald-300 font-bold">{titikTerfilter.length}</b> dari{' '}
                <b className="text-white">{titikList.length}</b> total titik api terpantau
              </div>

              <div className="flex items-center gap-3">
                {titikTerpilihIds.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-red-300 font-bold">
                      {titikTerpilihIds.length} titik dipilih
                    </span>
                    <button
                      onClick={() => handleBuatLaporan('auto')}
                      className="btn-retro bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1.5 !py-1 !px-3 text-[11px] shadow-[2px_2px_0_#000]"
                    >
                      <Flame size={13} className="fill-white" />
                      Buat Laporan Resmi ({titikTerpilihIds.length} Titik)
                    </button>
                  </div>
                ) : (
                  <span className="text-zinc-500 text-[10px]">
                    Centang titik api di tabel untuk membuat laporan gabungan
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAMPILAN 2: PRATINJAU DOKUMEN RESMI SESUAI PDF REFERENSI              */}
      {/* ===================================================================== */}
      {tabMode === 'laporan' && laporanDitampilkan && (
        <div className="flex-1 overflow-auto custom-scrollbar px-2 pb-6 min-h-0">
          {/* Input Berkas Tersembunyi untuk Upload Foto & Screenshot Peta */}
          <input
            ref={inputUploadFotoRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUploadFotoDokumentasi}
            className="hidden"
          />
          <input
            ref={inputUploadPetaRef}
            type="file"
            accept="image/*"
            onChange={handleUploadPetaSipongi}
            className="hidden"
          />

          {/* Bar Aksi Dokumen (Hidden on Print) */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-black/60 border border-white/20 p-2.5 mb-2 text-[12px] no-print">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setTabMode('peta')}
                className="btn-retro bg-zinc-800 text-zinc-300 flex items-center gap-1.5 !py-1 text-[11px]"
              >
                <ArrowLeft size={13} /> Kembali ke Peta
              </button>
              <span className="font-bold text-white font-mono text-[12px]">
                {laporanDitampilkan.nomorLaporan}
              </span>
              <span
                className={`chip-retro text-[10px] font-bold ${
                  laporanDitampilkan.jenisIzin.toLowerCase().includes('das')
                    ? 'border-amber-400 bg-amber-950 text-amber-300'
                    : 'border-emerald-500 bg-emerald-950/80 text-emerald-300'
                }`}
              >
                {laporanDitampilkan.jenisIzin.toUpperCase()}
              </span>
              {modeEditLaporan && (
                <span className="chip-retro !text-[9px] border-yellow-400 bg-yellow-500 text-black font-black animate-pulse">
                  MODE EDIT AKTIF
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Buat Ulang Screenshot Peta Otomatis */}
              <button
                onClick={handleGenerateScreenshotPeta}
                disabled={isGeneratingSnapshot}
                className="btn-retro bg-cyan-800 hover:bg-cyan-700 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px] disabled:opacity-50"
                title="Buat screenshot peta resmi beresolusi tinggi otomatis (WGS 1984)"
              >
                {isGeneratingSnapshot ? (
                  <Loader2 size={13} className="animate-spin text-cyan-300" />
                ) : (
                  <Sparkles size={13} className="text-cyan-300" />
                )}
                <span>{isGeneratingSnapshot ? 'Membuat Peta...' : 'Screenshot Peta Otomatis'}</span>
              </button>

              {/* Tombol Upload Foto Dokumentasi */}
              <button
                onClick={() => inputUploadFotoRef.current?.click()}
                disabled={isUploadingFoto}
                className="btn-retro bg-purple-800 hover:bg-purple-700 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px] disabled:opacity-50"
                title="Unggah foto ground check dari perangkat / kamera"
              >
                {isUploadingFoto ? (
                  <Loader2 size={13} className="animate-spin text-purple-300" />
                ) : (
                  <Camera size={13} className="text-purple-300" />
                )}
                <span>{isUploadingFoto ? 'Mengunggah...' : 'Upload Foto'}</span>
              </button>

              {/* Toggle / Simpan Suntingan */}
              {!modeEditLaporan ? (
                <button
                  onClick={handleMulaiEdit}
                  className="btn-retro bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px]"
                >
                  <Edit3 size={13} /> Edit Dokumen
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleBatalEdit}
                    className="btn-retro bg-zinc-800 text-zinc-300 hover:text-white !py-1 text-[11px] flex items-center gap-1"
                  >
                    <X size={12} /> Batal
                  </button>
                  <button
                    onClick={handleSimpanEdit}
                    className="btn-retro bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px]"
                  >
                    <Save size={12} /> Simpan Perubahan
                  </button>
                </div>
              )}

              {/* Cetak PDF */}
              <button
                onClick={handleCetakDokumen}
                className="btn-retro bg-emerald-800 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px]"
                title="Cetak langsung atau simpan sebagai PDF A4 resmi"
              >
                <Printer size={13} /> Cetak / Unduh PDF
              </button>
            </div>
          </div>

          {/* Selector Berkas Laporan Tersedia (Bisa Beralih Antara IPPKH & Rehab DAS) */}
          <div className="flex flex-wrap items-center gap-1.5 pb-2 mb-3 border-b border-white/20 bg-black/30 p-2 no-print">
            <span className="text-[11px] text-zinc-400 font-mono mr-1">Pilih Dokumen Laporan:</span>
            {daftarLaporan.map((lap) => {
              const aktif = lap.id === laporanDitampilkan.id;
              const isDas = lap.jenisIzin.toLowerCase().includes('das');
              return (
                <button
                  key={lap.id}
                  onClick={() => {
                    if (modeEditLaporan) {
                      if (
                        confirm(
                          'Anda sedang dalam mode edit. Beralih dokumen akan membatalkan perubahan yang belum disimpan. Lanjutkan?',
                        )
                      ) {
                        setModeEditLaporan(false);
                        setDraftLaporan(null);
                        setLaporanAktifId(lap.id);
                      }
                    } else {
                      setLaporanAktifId(lap.id);
                    }
                  }}
                  className={`px-3 py-1 text-[11px] font-bold uppercase rounded border transition-all flex items-center gap-1.5 ${
                    aktif
                      ? isDas
                        ? 'bg-amber-600 text-white border-amber-400 shadow-[2px_2px_0_#000]'
                        : 'bg-emerald-700 text-white border-emerald-400 shadow-[2px_2px_0_#000]'
                      : 'bg-zinc-900 text-zinc-300 border-white/20 hover:text-white'
                  }`}
                >
                  {isDas ? <Trees size={12} className="text-yellow-300" /> : <Mountain size={12} />}
                  <span>{isDas ? (modeDemo ? '🌲 PETAK CONTOH' : '🌲 REHAB DAS (TAHURA)') : (modeDemo ? '⛰️ IZIN CONTOH' : '⛰️ IPPKH (TAPIN)')}</span>
                  <span className="font-mono text-[10px] opacity-80">({lap.tanggalLaporan})</span>
                </button>
              );
            })}
          </div>

          {/* Banner Peringatan Mode Edit Aktif */}
          {modeEditLaporan && (
            <div className="max-w-4xl mx-auto bg-amber-400 text-black px-4 py-2.5 mb-3 rounded-sm border-2 border-black flex flex-wrap items-center justify-between gap-2 shadow-lg no-print">
              <div className="flex items-center gap-2">
                <Edit3 size={16} className="text-black shrink-0" />
                <span className="font-bold text-[12px]">
                  MODE SUNGAI / EDIT DOKUMEN AKTIF: Anda dapat menyunting identitas izin, narasi deskripsi, kronologi, tindakan lapangan, dan foto dokumentasi di bawah ini.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBatalEdit}
                  className="btn-retro bg-zinc-800 text-white font-bold !py-1 text-[11px]"
                >
                  Batal
                </button>
                <button
                  onClick={handleSimpanEdit}
                  className="btn-retro bg-emerald-800 hover:bg-emerald-700 text-white font-bold !py-1 text-[11px] flex items-center gap-1"
                >
                  <Save size={12} /> Simpan Perubahan
                </button>
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* DOKUMEN FISIK FORMAT RESMI KLHK (Multi-Page A4 Printable)         */}
          {/* ================================================================= */}
          <div className="flex justify-center">
            <div id="dokumen-karhutla-a4" className="bg-white text-black p-8 md:p-12 max-w-4xl w-full shadow-2xl rounded-sm font-sans border-2 border-zinc-400 print:border-none print:p-0 print:shadow-none print:max-w-none text-[13px] leading-relaxed">
              {/* ------------------------------------------------------------- */}
              {/* HALAMAN 1: KOP, IDENTITAS IZIN, & DESKRIPSI                   */}
              {/* ------------------------------------------------------------- */}
              <div className="border-b-2 border-black pb-2 mb-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {!modeDemo && <img
                      src="/fire-report-assets/kop-ebl.jpeg"
                      alt="Logo PT Energi Batubara Lestari"
                      className="h-10 w-auto object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />}
                    <div>
                      <h3 className="font-black text-[15px] uppercase tracking-wider text-black">
                        {kopPerusahaan}
                      </h3>
                      <p className="text-[10px] text-zinc-600 font-mono tracking-tight uppercase">
                        LAPORAN VERIFIKASI GROUND CHECK TITIK PANAS (HOTSPOT) SIPONGI KLHK ·{' '}
                        {laporanDitampilkan.jenisIzin}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-[10px] font-mono text-zinc-600">
                    <div className="flex items-center gap-1 justify-end">
                      <b>Nomor:</b>{' '}
                      {modeEditLaporan ? (
                        <input
                          type="text"
                          value={laporanDitampilkan.nomorLaporan}
                          onChange={(e) =>
                            mutateLaporan((l) => ({ ...l, nomorLaporan: e.target.value }))
                          }
                          className="border border-amber-400 bg-amber-50 px-1 py-0.5 font-mono text-[10px] rounded"
                        />
                      ) : (
                        <span>{laporanDitampilkan.nomorLaporan}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <b>Tanggal:</b>{' '}
                      {modeEditLaporan ? (
                        <input
                          type="date"
                          value={laporanDitampilkan.tanggalLaporan}
                          onChange={(e) =>
                            mutateLaporan((l) => ({ ...l, tanggalLaporan: e.target.value }))
                          }
                          className="border border-amber-400 bg-amber-50 px-1 py-0.5 font-mono text-[10px] rounded"
                        />
                      ) : (
                        <span>{laporanDitampilkan.tanggalLaporan}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabel Identitas Pemegang Izin */}
              <div className="mb-5 overflow-x-auto">
                <table className="w-full text-[12px] border-collapse border border-black">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="p-1.5 border-r border-black font-semibold w-64 bg-zinc-100">
                        Nama Pemegang Izin/Pemilik Hak
                      </td>
                      <td className="p-1.5 border-r border-black w-3 text-center">:</td>
                      <td className="p-1.5 font-bold">
                        {modeEditLaporan ? (
                          <input
                            type="text"
                            value={laporanDitampilkan.pemegangIzin}
                            onChange={(e) =>
                              mutateLaporan((l) => ({ ...l, pemegangIzin: e.target.value }))
                            }
                            className="w-full border border-amber-300 bg-amber-50 p-1 text-[11px] rounded"
                          />
                        ) : (
                          laporanDitampilkan.pemegangIzin
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-1.5 border-r border-black font-semibold bg-zinc-100">
                        Jenis Izin Pemanfaatan Hutan/Penggunaan Kawasan Hutan*)
                      </td>
                      <td className="p-1.5 border-r border-black text-center">:</td>
                      <td className="p-1.5 font-bold uppercase">
                        {modeEditLaporan ? (
                          <input
                            type="text"
                            value={laporanDitampilkan.jenisIzin}
                            onChange={(e) =>
                              mutateLaporan((l) => ({ ...l, jenisIzin: e.target.value }))
                            }
                            className="w-full border border-amber-300 bg-amber-50 p-1 text-[11px] rounded font-bold uppercase"
                          />
                        ) : (
                          laporanDitampilkan.jenisIzin
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-1.5 border-r border-black font-semibold bg-zinc-100">
                        SK Nomor dan Tanggal*)
                      </td>
                      <td className="p-1.5 border-r border-black text-center">:</td>
                      <td className="p-1.5">
                        {modeEditLaporan ? (
                          <textarea
                            rows={2}
                            value={laporanDitampilkan.skNomorTanggal}
                            onChange={(e) =>
                              mutateLaporan((l) => ({ ...l, skNomorTanggal: e.target.value }))
                            }
                            className="w-full border border-amber-300 bg-amber-50 p-1 text-[11px] rounded"
                          />
                        ) : (
                          laporanDitampilkan.skNomorTanggal
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-1.5 border-r border-black font-semibold bg-zinc-100">
                        Jangka Waktu Izin*)
                      </td>
                      <td className="p-1.5 border-r border-black text-center">:</td>
                      <td className="p-1.5 font-mono">
                        {modeEditLaporan ? (
                          <input
                            type="text"
                            value={laporanDitampilkan.jangkaWaktuIzin}
                            onChange={(e) =>
                              mutateLaporan((l) => ({ ...l, jangkaWaktuIzin: e.target.value }))
                            }
                            className="w-full border border-amber-300 bg-amber-50 p-1 text-[11px] font-mono rounded"
                          />
                        ) : (
                          laporanDitampilkan.jangkaWaktuIzin
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-1.5 border-r border-black font-semibold bg-zinc-100">Luas</td>
                      <td className="p-1.5 border-r border-black text-center">:</td>
                      <td className="p-1.5 font-mono">
                        {modeEditLaporan ? (
                          <input
                            type="text"
                            value={laporanDitampilkan.luas}
                            onChange={(e) =>
                              mutateLaporan((l) => ({ ...l, luas: e.target.value }))
                            }
                            className="w-full border border-amber-300 bg-amber-50 p-1 text-[11px] font-mono rounded"
                          />
                        ) : (
                          laporanDitampilkan.luas
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-1.5 border-r border-black font-semibold bg-zinc-100">
                        Status Kawasan Hutan*)
                      </td>
                      <td className="p-1.5 border-r border-black text-center">:</td>
                      <td className="p-1.5">
                        {modeEditLaporan ? (
                          <input
                            type="text"
                            value={laporanDitampilkan.statusKawasanHutan}
                            onChange={(e) =>
                              mutateLaporan((l) => ({ ...l, statusKawasanHutan: e.target.value }))
                            }
                            className="w-full border border-amber-300 bg-amber-50 p-1 text-[11px] rounded"
                          />
                        ) : (
                          laporanDitampilkan.statusKawasanHutan
                        )}
                      </td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="p-1.5 border-r border-black font-semibold bg-zinc-100">
                        Kabupaten/Kota
                      </td>
                      <td className="p-1.5 border-r border-black text-center">:</td>
                      <td className="p-1.5">
                        {modeEditLaporan ? (
                          <input
                            type="text"
                            value={laporanDitampilkan.kabupaten}
                            onChange={(e) =>
                              mutateLaporan((l) => ({ ...l, kabupaten: e.target.value }))
                            }
                            className="w-full border border-amber-300 bg-amber-50 p-1 text-[11px] rounded"
                          />
                        ) : (
                          laporanDitampilkan.kabupaten
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 border-r border-black font-semibold bg-zinc-100">
                        Provinsi
                      </td>
                      <td className="p-1.5 border-r border-black text-center">:</td>
                      <td className="p-1.5">
                        {modeEditLaporan ? (
                          <input
                            type="text"
                            value={laporanDitampilkan.provinsi}
                            onChange={(e) =>
                              mutateLaporan((l) => ({ ...l, provinsi: e.target.value }))
                            }
                            className="w-full border border-amber-300 bg-amber-50 p-1 text-[11px] rounded"
                          />
                        ) : (
                          laporanDitampilkan.provinsi
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* BAGIAN A: DESKRIPSI */}
              <div className="mb-6 space-y-3">
                <h4 className="font-black text-[13px] uppercase tracking-wide border-b border-black pb-0.5">
                  A. DESKRIPSI
                </h4>
                {modeEditLaporan ? (
                  <div>
                    <label className="text-[11px] font-bold text-zinc-600 block mb-1">
                      Narasi Deskripsi Pemantauan Titik Panas (Poin 1):
                    </label>
                    <textarea
                      rows={4}
                      value={laporanDitampilkan.deskripsiUmum}
                      onChange={(e) =>
                        mutateLaporan((l) => ({ ...l, deskripsiUmum: e.target.value }))
                      }
                      className="w-full border border-amber-300 bg-amber-50 p-2 text-[12px] leading-relaxed rounded"
                    />
                  </div>
                ) : (
                  <p className="text-justify text-[12px] leading-relaxed">
                    1. {laporanDitampilkan.deskripsiUmum}
                  </p>
                )}
                <p className="text-justify text-[12px] leading-relaxed">
                  2. Menindaklanjuti informasi tersebut, tim pemantau melakukan verifikasi lapangan{' '}
                  <i>(ground check)</i> untuk memastikan keberadaan, penyebab, luasan, serta status titik
                  api di lokasi terindikasi. Adapun koordinat titik panas yang terpantau adalah sebagai
                  berikut:
                </p>

                {/* Tabel Koordinat Titik Panas Resmi */}
                <div className="my-2 overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse border border-black">
                    <thead>
                      <tr className="bg-zinc-200 text-black uppercase font-bold text-center">
                        <th className="border border-black p-1.5 w-12">Titik</th>
                        <th className="border border-black p-1.5 w-32">X (Bujur)</th>
                        <th className="border border-black p-1.5 w-32">Y (Lintang)</th>
                        <th className="border border-black p-1.5 text-left">Keterangan Area</th>
                        <th className="border border-black p-1.5 w-28">Satelit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laporanDitampilkan.titikKoordinat.map((k) => (
                        <tr key={k.no} className="border-b border-black">
                          <td className="border border-black p-1.5 text-center font-bold font-mono">
                            {k.no}
                          </td>
                          <td className="border border-black p-1.5 text-center font-mono font-bold">
                            {k.xBujur.toFixed(5).replace('.', ',')}
                          </td>
                          <td className="border border-black p-1.5 text-center font-mono font-bold">
                            {k.yLintang.toFixed(5).replace('.', ',')}
                          </td>
                          <td className="border border-black p-1.5 text-[10px]">
                            {k.keterangan} ({k.desa})
                          </td>
                          <td className="border border-black p-1.5 text-center font-mono text-[10px]">
                            {k.satelit}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-justify text-[12px] leading-relaxed">
                  3. Sistem koordinat yang digunakan adalah geografis{' '}
                  <i>(Geographic Coordinate System)</i> dengan datum WGS 1984, dinyatakan dalam satuan
                  derajat desimal. Peta sebaran titik panas dan lokasi verifikasi lapangan terlampir pada
                  dokumen ini.
                </p>
              </div>

              {/* Pemisah Halaman Cetak */}
              <div className="page-break my-6 border-t-2 border-dashed border-zinc-300 print:border-none" />

              {/* ------------------------------------------------------------- */}
              {/* HALAMAN 2: KRONOLOGI KEBAKARAN & UPAYA PENANGANAN             */}
              {/* ------------------------------------------------------------- */}
              <div className="border-b-2 border-black pb-2 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-[14px] uppercase tracking-wider text-black">
                    {kopPerusahaan}
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-mono uppercase">
                    Halaman 2 · Kronologi & Tindakan Penanganan ({laporanDitampilkan.jenisIzin})
                  </span>
                </div>
              </div>

              <div className="mb-6 space-y-3.5">
                <h4 className="font-black text-[13px] uppercase tracking-wide border-b border-black pb-0.5">
                  B. KRONOLOGI KEBAKARAN
                </h4>

                {/* Kronologi 1: Waktu & Lokasi Spesifik */}
                {modeEditLaporan ? (
                  <div className="p-2 border border-amber-300 bg-amber-50/50 rounded space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 block">
                      1. Waktu Ground Check & Lokasi Spesifik:
                    </label>
                    <input
                      type="text"
                      value={laporanDitampilkan.kronologi.waktuVerifikasi}
                      onChange={(e) =>
                        mutateLaporan((l) => ({
                          ...l,
                          kronologi: { ...l.kronologi, waktuVerifikasi: e.target.value },
                        }))
                      }
                      className="w-full border border-amber-300 bg-white p-1 text-[11px] rounded mb-1"
                      placeholder="Waktu verifikasi..."
                    />
                    <textarea
                      rows={2}
                      value={laporanDitampilkan.kronologi.lokasiSpesifik}
                      onChange={(e) =>
                        mutateLaporan((l) => ({
                          ...l,
                          kronologi: { ...l.kronologi, lokasiSpesifik: e.target.value },
                        }))
                      }
                      className="w-full border border-amber-300 bg-white p-1 text-[11px] rounded"
                      placeholder="Lokasi spesifik..."
                    />
                  </div>
                ) : (
                  <p className="text-justify text-[12px] leading-relaxed">
                    1. {laporanDitampilkan.kronologi.waktuVerifikasi}, tim patroli kebakaran {idn.perusahaan} melakukan verifikasi lapangan terhadap titik panas yang terpantau pada
                    Website SIPONGI / NASA FIRMS. Hasil verifikasi menunjukkan bahwa titik panas tersebut
                    bersumber dari {laporanDitampilkan.kronologi.lokasiSpesifik}
                  </p>
                )}

                {/* Kronologi 2: Pengamatan Visual (Penyebab) */}
                {modeEditLaporan ? (
                  <div className="p-2 border border-amber-300 bg-amber-50/50 rounded space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 block">
                      2. Pengamatan Visual & Penyebab Titik Panas:
                    </label>
                    <textarea
                      rows={4}
                      value={laporanDitampilkan.kronologi.pengamatanVisual}
                      onChange={(e) =>
                        mutateLaporan((l) => ({
                          ...l,
                          kronologi: { ...l.kronologi, pengamatanVisual: e.target.value },
                        }))
                      }
                      className="w-full border border-amber-300 bg-white p-1 text-[11px] leading-relaxed rounded"
                    />
                  </div>
                ) : (
                  <p className="text-justify text-[12px] leading-relaxed">
                    2. {laporanDitampilkan.kronologi.pengamatanVisual}
                  </p>
                )}

                {/* Kronologi 3: Tindakan Penanganan */}
                {modeEditLaporan ? (
                  <div className="p-2 border border-amber-300 bg-amber-50/50 rounded space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 block">
                      3. Upaya & Tindakan Penanganan Pemadaman:
                    </label>
                    <textarea
                      rows={3}
                      value={laporanDitampilkan.kronologi.tindakanPenanganan}
                      onChange={(e) =>
                        mutateLaporan((l) => ({
                          ...l,
                          kronologi: { ...l.kronologi, tindakanPenanganan: e.target.value },
                        }))
                      }
                      className="w-full border border-amber-300 bg-white p-1 text-[11px] leading-relaxed rounded"
                    />
                  </div>
                ) : (
                  <p className="text-justify text-[12px] leading-relaxed">
                    3. {laporanDitampilkan.kronologi.tindakanPenanganan}
                  </p>
                )}

                {/* Kronologi 4: Proses Pemadaman & Hasil Verifikasi */}
                {modeEditLaporan ? (
                  <div className="p-2 border border-amber-300 bg-amber-50/50 rounded space-y-1">
                    <label className="text-[11px] font-bold text-zinc-700 block">
                      4. Proses Pemadaman & Hasil Verifikasi Akhir:
                    </label>
                    <textarea
                      rows={2}
                      value={laporanDitampilkan.kronologi.prosesPemadaman}
                      onChange={(e) =>
                        mutateLaporan((l) => ({
                          ...l,
                          kronologi: { ...l.kronologi, prosesPemadaman: e.target.value },
                        }))
                      }
                      className="w-full border border-amber-300 bg-white p-1 text-[11px] rounded mb-1"
                      placeholder="Proses pemadaman..."
                    />
                    <textarea
                      rows={2}
                      value={laporanDitampilkan.kronologi.hasilVerifikasi}
                      onChange={(e) =>
                        mutateLaporan((l) => ({
                          ...l,
                          kronologi: { ...l.kronologi, hasilVerifikasi: e.target.value },
                        }))
                      }
                      className="w-full border border-amber-300 bg-white p-1 text-[11px] rounded"
                      placeholder="Hasil akhir verifikasi..."
                    />
                  </div>
                ) : (
                  <p className="text-justify text-[12px] leading-relaxed">
                    4. {laporanDitampilkan.kronologi.prosesPemadaman}{' '}
                    {laporanDitampilkan.kronologi.hasilVerifikasi}
                  </p>
                )}
              </div>

              {/* Pemisah Halaman Cetak */}
              <div className="page-break my-6 border-t-2 border-dashed border-zinc-300 print:border-none" />

              {/* ------------------------------------------------------------- */}
              {/* HALAMAN 3 & 4: LAMPIRAN PETA SIPONGI & FOTO DOKUMENTASI       */}
              {/* ------------------------------------------------------------- */}
              <div className="border-b-2 border-black pb-2 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-[14px] uppercase tracking-wider text-black">
                    {kopPerusahaan}
                  </h3>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    Halaman 3 & 4 · Lampiran Dokumentasi
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="font-black text-[13px] uppercase tracking-wide border-b border-black pb-0.5">
                  C. LAMPIRAN DOKUMENTASI PEMANTAUAN & PENANGANAN
                </h4>

                {/* 1. Tangkapan Layar SiPongi+ / Peta GIS Resmi */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h5 className="font-bold text-[12px] text-zinc-800">
                      1. Tangkapan Layar Titik Panas pada Sistem Informasi SiPongi+ KLHK & Peta GIS
                    </h5>
                    <div className="flex items-center gap-1.5 no-print">
                      <button
                        type="button"
                        onClick={handleGenerateScreenshotPeta}
                        disabled={isGeneratingSnapshot}
                        className="btn-retro btn-retro-sm bg-cyan-700 hover:bg-cyan-600 text-white font-bold flex items-center gap-1 text-[10px] !py-0.5"
                        title="Otomatis buat screenshot peta WGS 1984"
                      >
                        {isGeneratingSnapshot ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Sparkles size={11} />
                        )}
                        <span>{isGeneratingSnapshot ? 'Membuat Peta...' : '📸 Screenshot Peta Otomatis'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => inputUploadPetaRef.current?.click()}
                        className="btn-retro btn-retro-sm bg-zinc-700 hover:bg-zinc-600 text-white font-bold flex items-center gap-1 text-[10px] !py-0.5"
                        title="Upload gambar screenshot SiPongi dari file manual"
                      >
                        <Upload size={11} />
                        <span>Upload Peta</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {laporanDitampilkan.dokumentasi.petaSipongi.map((imgUrl, i) => (
                      <div
                        key={i}
                        className="border border-black p-1 bg-zinc-50 flex flex-col items-center relative group"
                      >
                        <img
                          src={imgUrl}
                          alt={`Tangkapan Layar SiPongi Titik ${i + 1}`}
                          className="w-full h-auto object-contain max-h-60 rounded-xs"
                        />
                        <p className="text-[10px] font-mono text-center text-zinc-600 mt-1">
                          Gambar {i + 1}: Tampilan Titik Koordinat Hotspot SiPongi+ / Peta GIS (
                          {laporanDitampilkan.titikKoordinat[i]?.satelit || 'WGS 1984'})
                        </p>
                        {modeEditLaporan && (
                          <button
                            type="button"
                            onClick={() => handleHapusPetaSipongi(i)}
                            className="absolute top-2 right-2 btn-retro btn-retro-sm bg-red-600 text-white !p-1 text-[10px] shadow no-print"
                            title="Hapus gambar screenshot peta ini"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Foto Dokumentasi Lapangan */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h5 className="font-bold text-[12px] text-zinc-800">
                      2. Dokumentasi Foto Lapangan Ground Check & Penanganan Tim Lapangan
                    </h5>
                    <div className="flex items-center gap-1.5 no-print">
                      <button
                        type="button"
                        onClick={() => inputUploadFotoRef.current?.click()}
                        disabled={isUploadingFoto}
                        className="btn-retro btn-retro-sm bg-purple-700 hover:bg-purple-600 text-white font-bold flex items-center gap-1 text-[10px] !py-0.5"
                        title="Unggah berkas foto dokumentasi dari kamera atau galeri"
                      >
                        {isUploadingFoto ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Camera size={11} />
                        )}
                        <span>{isUploadingFoto ? 'Mengunggah...' : '📁 Upload Foto Dokumentasi'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {laporanDitampilkan.dokumentasi.fotoLapangan.map((foto, idx) => (
                      <div
                        key={idx}
                        className="border border-black p-2 bg-zinc-50 flex flex-col justify-between rounded-sm relative"
                      >
                        <div className="flex flex-col items-center">
                          <img
                            src={foto.url}
                            alt={foto.judul}
                            className="w-full h-auto object-contain max-h-64 rounded-sm border border-zinc-300"
                          />
                        </div>

                        {modeEditLaporan ? (
                          <div className="mt-2 space-y-1.5 text-[11px] no-print">
                            <div>
                              <label className="text-[10px] font-bold text-zinc-600">Judul Foto:</label>
                              <input
                                type="text"
                                value={foto.judul}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  mutateLaporan((lap) => {
                                    const fl = [...lap.dokumentasi.fotoLapangan];
                                    fl[idx] = { ...fl[idx], judul: val };
                                    return {
                                      ...lap,
                                      dokumentasi: { ...lap.dokumentasi, fotoLapangan: fl },
                                    };
                                  });
                                }}
                                className="w-full border border-amber-300 bg-white p-1 text-[11px] rounded"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-600">
                                Keterangan Foto:
                              </label>
                              <textarea
                                rows={2}
                                value={foto.deskripsi || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  mutateLaporan((lap) => {
                                    const fl = [...lap.dokumentasi.fotoLapangan];
                                    fl[idx] = { ...fl[idx], deskripsi: val };
                                    return {
                                      ...lap,
                                      dokumentasi: { ...lap.dokumentasi, fotoLapangan: fl },
                                    };
                                  });
                                }}
                                className="w-full border border-amber-300 bg-white p-1 text-[10px] rounded"
                              />
                            </div>
                            <div className="flex items-center justify-between gap-1 pt-1 border-t border-zinc-200">
                              <select
                                value={foto.kategori}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  mutateLaporan((lap) => {
                                    const fl = [...lap.dokumentasi.fotoLapangan];
                                    fl[idx] = { ...fl[idx], kategori: val };
                                    return {
                                      ...lap,
                                      dokumentasi: { ...lap.dokumentasi, fotoLapangan: fl },
                                    };
                                  });
                                }}
                                className="border border-zinc-300 bg-white px-1.5 py-0.5 text-[10px] rounded"
                              >
                                <option value="sebelum">Sebelum Penanganan</option>
                                <option value="tindakan">Tindakan Pemadaman</option>
                                <option value="setelah">Setelah Padam (Bara Padam)</option>
                                <option value="umum">Umum / Before-After</option>
                              </select>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleGeserFoto(idx, 'atas')}
                                  disabled={idx === 0}
                                  className="btn-retro btn-retro-sm bg-zinc-200 text-black !p-1 text-[9px] disabled:opacity-30"
                                  title="Geser ke atas"
                                >
                                  <ArrowUp size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGeserFoto(idx, 'bawah')}
                                  disabled={idx === laporanDitampilkan.dokumentasi.fotoLapangan.length - 1}
                                  className="btn-retro btn-retro-sm bg-zinc-200 text-black !p-1 text-[9px] disabled:opacity-30"
                                  title="Geser ke bawah"
                                >
                                  <ArrowDown size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleHapusFotoLapangan(idx)}
                                  className="btn-retro btn-retro-sm bg-red-600 text-white !p-1 text-[9px]"
                                  title="Hapus foto ini"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-1.5 text-center">
                            <p className="font-bold text-[11px] text-black">{foto.judul}</p>
                            {foto.deskripsi && (
                              <p className="text-[10px] text-zinc-600 mt-0.5">{foto.deskripsi}</p>
                            )}
                            <div className="mt-1">
                              <span className="inline-block text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-200 text-zinc-700 uppercase">
                                Kategori: {foto.kategori}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Kolom Tanda Tangan Resmi */}
                <div className="grid grid-cols-2 gap-8 text-[11px] pt-6 border-t-2 border-black mt-8">
                  <div>
                    <p className="font-semibold text-zinc-700">Dibuat & Diverifikasi Oleh:</p>
                    <p className="text-zinc-500 text-[10px] mb-12">
                      {laporanDitampilkan.jenisIzin.toLowerCase().includes('das')
                        ? 'Pengawas Rehabilitasi DAS & Tim Patroli Hutan'
                        : 'Tim Tanggap Darurat & SHE Department'}
                    </p>
                    {modeEditLaporan ? (
                      <input
                        type="text"
                        value={laporanDitampilkan.dibuatOleh}
                        onChange={(e) =>
                          mutateLaporan((l) => ({ ...l, dibuatOleh: e.target.value }))
                        }
                        className="w-full border border-amber-300 bg-amber-50 p-1 text-[11px] font-bold rounded"
                      />
                    ) : (
                      <p className="font-bold underline text-[12px]">{laporanDitampilkan.dibuatOleh}</p>
                    )}
                    <p className="text-zinc-600 text-[10px]">{idn.perusahaan}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-zinc-700">Mengetahui / Disetujui,</p>
                    <p className="text-zinc-500 text-[10px] mb-12">
                      Kepala Teknik Tambang / Operation Head
                    </p>
                    <p className="font-bold underline text-[12px]">Rahmad Pudjotomo</p>
                    <p className="text-zinc-600 text-[10px]">
                      Tanggal: {laporanDitampilkan.tanggalLaporan}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAMPILAN 3: RIWAYAT LAPORAN RESMI KARHUTLA                            */}
      {/* ===================================================================== */}
      {tabMode === 'riwayat' && (
        <div className="flex-1 overflow-auto custom-scrollbar px-2 pb-4 space-y-3 min-h-0 no-print">
          <div className="border-[3px] border-white/40 overflow-x-auto shadow-lg bg-black/60">
            <table className="w-full text-[12px] border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-emerald-950 text-emerald-300 uppercase text-[11px]">
                  <th className="p-2 border border-white/20 text-center w-10">No</th>
                  <th className="p-2 border border-white/20 text-left min-w-[200px]">
                    Nomor & Judul Laporan
                  </th>
                  <th className="p-2 border border-white/20 text-left w-44">Jenis Izin & Wilayah</th>
                  <th className="p-2 border border-white/20 text-center w-28">Jumlah Titik</th>
                  <th className="p-2 border border-white/20 text-left w-36">Tanggal Lapor</th>
                  <th className="p-2 border border-white/20 text-center w-36">Status</th>
                  <th className="p-2 border border-white/20 text-center w-32">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {daftarLaporan.map((item, idx) => {
                  const isDas = item.jenisIzin.toLowerCase().includes('das');
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
                            setLaporanAktifId(item.id);
                            setTabMode('laporan');
                          }}
                          className="font-bold text-left text-white hover:text-orange-400 block hover:underline"
                        >
                          {item.judul}
                        </button>
                        <span className="text-[11px] font-mono text-cyan-300 block">
                          {item.nomorLaporan}
                        </span>
                      </td>
                      <td className="p-2 border border-white/10 text-[11px]">
                        <span
                          className={`font-bold block flex items-center gap-1 ${
                            isDas ? 'text-amber-300' : 'text-emerald-300'
                          }`}
                        >
                          {isDas ? <Trees size={12} /> : <Mountain size={12} />}
                          {item.jenisIzin}
                        </span>
                        <span className="text-zinc-400 text-[10px] block">{item.kabupaten}</span>
                      </td>
                      <td className="p-2 border border-white/10 text-center font-mono font-bold text-white">
                        {item.titikKoordinat.length} Titik
                      </td>
                      <td className="p-2 border border-white/10 text-[11px] text-zinc-300 font-mono">
                        {item.tanggalLaporan}
                      </td>
                      <td className="p-2 border border-white/10 text-center">
                        <select
                          value={item.status}
                          onChange={(e) =>
                            handleUbahStatusLaporan(
                              item.id,
                              e.target.value as LaporanKarhutla['status'],
                            )
                          }
                          className="input-retro !py-0.5 !text-[10px] font-bold uppercase cursor-pointer"
                        >
                          <option value="Draf">Draf</option>
                          <option value="Siap Dikirim">Siap Dikirim</option>
                          <option value="Terkirim ke KLHK">Terkirim ke KLHK</option>
                        </select>
                      </td>
                      <td className="p-2 border border-white/10 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setLaporanAktifId(item.id);
                              setTabMode('laporan');
                            }}
                            className="btn-retro btn-retro-sm bg-orange-600 hover:bg-orange-500 text-[10px] inline-flex items-center gap-1 font-bold"
                            title="Buka Lembar Dokumen Resmi"
                          >
                            <Eye size={11} /> Buka
                          </button>
                          <button
                            type="button"
                            onClick={() => handleHapusLaporan(item.id)}
                            className="btn-ikon !w-6 !h-6 bg-rose-950 hover:bg-rose-800 text-rose-300"
                            title="Hapus Laporan"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Gaya cetak A4: hanya lembar dokumen resmi yang keluar di kertas. */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 12mm 14mm 12mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
          }
          /* Sembunyikan seluruh tampilan aplikasi ... */
          body > * { visibility: hidden !important; }
          .no-print { display: none !important; }
          /* ... lalu tampilkan lembar dokumennya saja. */
          #dokumen-karhutla-a4, #dokumen-karhutla-a4 * { visibility: visible !important; }
          #dokumen-karhutla-a4 {
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
          /* Pemisah halaman antar bagian laporan. */
          .page-break { break-after: page; page-break-after: always; }
          #dokumen-karhutla-a4 img, #dokumen-karhutla-a4 table { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};
