import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Flame, MapPin, FileText, Plus, RefreshCw, Printer, Download, Eye,
  CheckCircle2, AlertTriangle, ShieldCheck, ChevronRight, ArrowLeft,
  Calendar, Layers, Filter, Search, Copy, Trash2, Edit3, Image as ImageIcon,
  Check, X, Clock, Send, AlertCircle, Trees, Mountain, Pickaxe,
  Upload, Camera, Save, ArrowUp, ArrowDown, Sparkles, Loader2, FolderPlus,
  ZoomIn, ZoomOut, ChevronsUpDown, Table, Map, Scale, CheckSquare, Lock, Unlock
} from 'lucide-react';
import { ModalBukaKunci } from './ModalBukaKunci';
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
  PENGESAH_LAPORAN,
  ttdPembuat,
  muatTitikNasa,
  type DataTitikLive,
  type KoordinatLaporan,
} from '../lib/fire-report';
import { api } from '../lib/api';
import { anonimkanDalam } from '../lib/wilayah-fire';
import { buatPdfLembar } from '../lib/pdf-laporan';
import { FormLaporanFire } from './FormLaporanFire';
import { FireHarian } from './FireHarian';
import { FireRiwayat } from './FireRiwayat';
import {
  muatBulan, bulanIni, unggahLaporan, tandaiTerkirim, ambilPdfArsip, ambilIsiArsip, kirimKeWhatsApp, pesanPengantar, namaPdf, labelArea,
  type ArsipKarhutla, type KelompokLaporan,
} from '../lib/karhutla';
import { simpanBerkas } from '../lib/unduh';
import { buatScreenshotPetaOtomatis, kompresGambar } from '../lib/map-snapshot';
import { diAplikasi } from '../lib/platform';
import { demoAktif } from '../lib/api';
import { KOTA_DEMO, kotaDemoTerpilih, pilihKotaDemo, wilayahFire } from '../lib/wilayah-fire';
import type { Pengguna } from '../lib/tipe-api';

interface Props {
  pengguna: Pengguna;
  notify: (pesan: string) => void;
}

type KunciIdentitas = 'pemegangIzin' | 'jenisIzin' | 'skNomorTanggal' | 'jangkaWaktuIzin' | 'luas' | 'statusKawasanHutan' | 'kabupaten' | 'provinsi';
const BARIS_IDENTITAS: { label: string; kunci: KunciIdentitas; panjang?: boolean }[] = [
  { label: 'Nama Pemegang Izin/Pemilik Hak', kunci: 'pemegangIzin' },
  { label: 'Jenis Izin Pemanfaatan Hutan/Penggunaan Kawasan Hutan*)', kunci: 'jenisIzin' },
  { label: 'SK Nomor dan Tanggal*)', kunci: 'skNomorTanggal', panjang: true },
  { label: 'Jangka Waktu Izin*)', kunci: 'jangkaWaktuIzin' },
  { label: 'Luas', kunci: 'luas' },
  { label: 'Status Kawasan Hutan*)', kunci: 'statusKawasanHutan' },
  { label: 'Kabupaten/Kota', kunci: 'kabupaten' },
  { label: 'Provinsi', kunci: 'provinsi' },
];

/** "2026-09-21" → "21 September 2026". */
const tanggalPanjang = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Kota di baris tanggal pengesahan: "Rantau, Tapin" → "Rantau", "Banjar (Kec. Aranio)" → "Banjar". */
const kotaPengesahan = (kabupaten: string) => kabupaten.split(',')[0].replace(/\s*\(.*\)\s*/, '').trim() || kabupaten;

/** Baris koordinat dengan keterangan sama digabung (rowSpan), seperti tabel di contoh Word. */
const kelompokKoordinat = (daftar: KoordinatLaporan[]) =>
  daftar.map((k, i) => {
    if (i > 0 && daftar[i - 1].keterangan === k.keterangan) return { k, rentang: 0 };
    let rentang = 1;
    while (i + rentang < daftar.length && daftar[i + rentang].keterangan === k.keterangan) rentang++;
    return { k, rentang };
  });

/** Kop surat, diulang di tiap halaman seperti header dokumen Word. */
const KopLaporan: React.FC<{ demo: boolean; perusahaan: string }> = ({ demo, perusahaan }) =>
  demo ? (
    <div data-kop className="flex items-center gap-3 pb-2 mb-5 border-b-[3px] border-[#1f3a6e]">
      <div className="w-12 h-12 rounded-full border-[3px] border-zinc-400 flex items-center justify-center text-[7pt] font-bold text-zinc-500 shrink-0">LOGO</div>
      <div>
        <p className="font-bold text-[13pt] leading-tight text-[#1f3a6e]">{perusahaan.toUpperCase()}</p>
        <p className="text-[8pt] text-zinc-500">Kop perusahaan contoh</p>
      </div>
    </div>
  ) : (
    <img data-kop src="/fire-report-assets/kop-ebl-laporan.jpg" alt={perusahaan} className="block w-full h-auto mb-5" />
  );

/** Butir bernomor dengan indentasi gantung, seperti daftar bernomor Word. */
const Butir: React.FC<{ no: number; children: React.ReactNode }> = ({ no, children }) => (
  <div className="grid grid-cols-[2.2em_minmax(0,1fr)]">
    <span>{no}.</span>
    <div className="text-justify">{children}</div>
  </div>
);

/** Tombol hapus di pojok gambar; tampil di layar, tidak ikut tercetak. */
const TombolHapusGambar: React.FC<{ onClick: () => void; judul: string }> = ({ onClick, judul }) => (
  <button
    type="button"
    onClick={onClick}
    title={judul}
    aria-label={judul}
    className="no-print absolute top-1.5 right-1.5 flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold px-2 py-1 border-2 border-black shadow-[2px_2px_0_#000]"
  >
    <Trash2 size={12} /> Hapus
  </button>
);

export const FireMonkeyScreen: React.FC<Props> = ({ pengguna, notify }) => {
  // ---------------------------------------------------------------------------
  // STATE UTAMA
  // ---------------------------------------------------------------------------
  // Alur: pantau (peta) → harian (tabel per hari, buat laporan) → dokumen (form, PDF, kirim) → riwayat (arsip).
  const [tabMode, setTabMode] = useState<'pantau' | 'harian' | 'riwayat' | 'dokumen'>('pantau');
  const [kembaliKe, setKembaliKe] = useState<'pantau' | 'harian' | 'riwayat'>('harian');
  const [petaPanas, setPetaPanas] = useState(false);
  const pindahTab = (t: 'pantau' | 'harian' | 'riwayat') => {
    if (tabMode === 'dokumen' && modeEditLaporan && !confirm('Suntingan dokumen belum disimpan. Tinggalkan?')) return;
    setModeEditLaporan(false);
    setDraftLaporan(null);
    setTabMode(t);
  };
  // Titik simpanan di perangkat hanya untuk mode demo; mode kerja selalu memakai data NASA dari server.
  const [titikList, setTitikList] = useState<TitikApiFireItem[]>(() => (demoAktif() ? muatTitikApiMonitoring() : []));
  const [titikTerpilihIds, setTitikTerpilihIds] = useState<string[]>([]);

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
  const pengesah = modeDemo ? { nama: 'Nama Penyetuju', jabatan: 'Pimpinan (contoh)', ttd: '' } : PENGESAH_LAPORAN;

  // Sumber titik mode kerja = data NASA FIRMS di server (diambil cron tiap jam).
  // LIVE (bawaan): 24 jam terakhir, disegarkan tiap 10 menit. LIVE mati: riwayat 7 hari.
  // Mode demo: LIVE = titik contoh 24 jam, mati = semua titik contoh.
  const [modeLive, setModeLive] = useState<boolean>(() => {
    try { return localStorage.getItem('pokemonkey_fire_live') !== '0'; } catch { return true; }
  });
  const [dataNasa, setDataNasa] = useState<DataTitikLive | null>(null);
  const [memuatNasa, setMemuatNasa] = useState(false);
  const [diambilPada, setDiambilPada] = useState<Date | null>(null);
  const pakaiNasa = modeLive || !modeDemo;
  const segarkanNasa = React.useCallback(async (diam = false) => {
    setMemuatNasa(true);
    try {
      setDataNasa(await muatTitikNasa(modeLive ? 24 : 24 * 7));
      setDiambilPada(new Date());
    } catch (e) {
      if (!diam) notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT DATA NASA');
    } finally {
      setMemuatNasa(false);
    }
  }, [modeLive, notify]);
  useEffect(() => {
    if (!pakaiNasa) return;
    void segarkanNasa();
    if (!modeLive) return;
    const jeda = window.setInterval(() => void segarkanNasa(true), 10 * 60_000);
    return () => window.clearInterval(jeda);
  }, [pakaiNasa, modeLive, segarkanNasa]);
  const aturLive = (nyala: boolean) => {
    if (nyala === modeLive) return;
    setModeLive(nyala);
    setDataNasa(null);
    setTitikTerpilihIds([]);
    try { localStorage.setItem('pokemonkey_fire_live', nyala ? '1' : '0'); } catch { /* abaikan */ }
    notify(nyala ? 'LIVE: TITIK NASA 24 JAM TERAKHIR' : modeDemo ? 'LIVE MATI: SEMUA TITIK CONTOH' : 'RIWAYAT NASA 7 HARI');
  };
  const [memeriksaNasa, setMemeriksaNasa] = useState(false);
  const periksaNasaSekarang = async () => {
    setMemeriksaNasa(true);
    try {
      const h = await api<{ baru: number; galat: string[] }>('/api/titik-api/periksa', { method: 'POST', body: {} });
      notify(h.galat?.length ? h.galat[0].toUpperCase() : `NASA DIPERIKSA · ${h.baru} TITIK BARU`);
      await segarkanNasa(true);
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMERIKSA NASA');
    } finally {
      setMemeriksaNasa(false);
    }
  };
  const titikAktif = pakaiNasa ? (dataNasa?.titik ?? []) : titikList;
  const jamWita = (d: Date) => d.toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const [daftarLaporan, setDaftarLaporan] = useState<LaporanKarhutla[]>(muatDaftarLaporanKarhutla);
  const [laporanAktifId, setLaporanAktifId] = useState<string | null>(() => {
    const list = muatDaftarLaporanKarhutla();
    return list[0]?.id || null;
  });

  // State Peta & Seleksi Titik
  const [titikFokus, setTitikFokus] = useState<TitikApiFireItem | null>(null);

  // Tab Harian: titik sebulan dari server + arsip laporan bulan itu.
  const [bulanHarian, setBulanHarian] = useState(bulanIni);
  const [dataBulan, setDataBulan] = useState<{ titik: TitikApiFireItem[]; laporan: ArsipKarhutla[] }>({ titik: [], laporan: [] });
  const [memuatBulan, setMemuatBulan] = useState(false);
  const [galatBulan, setGalatBulan] = useState<string | null>(null);
  // Naik setiap ada ekspor/kirim, supaya tab Harian dan Riwayat memuat ulang.
  const [versiArsip, setVersiArsip] = useState(0);
  useEffect(() => {
    let hidup = true;
    setMemuatBulan(true);
    setGalatBulan(null);
    muatBulan(bulanHarian)
      .then((d) => { if (hidup) setDataBulan(d); })
      .catch((e) => { if (hidup) setGalatBulan(e instanceof Error ? e.message : 'Gagal memuat titik bulan ini.'); })
      .finally(() => { if (hidup) setMemuatBulan(false); });
    return () => { hidup = false; };
  }, [bulanHarian, versiArsip]);

  // Arsip server untuk laporan yang sedang dibuka (null = masih draf) + PDF terakhir di memori.
  const [arsipAktif, setArsipAktif] = useState<ArsipKarhutla | null>(null);
  const pdfTerakhir = useRef<{ id: string; blob: Blob } | null>(null);
  const [mengirimWa, setMengirimWa] = useState(false);

  const [modeEditLaporan, setModeEditLaporan] = useState<boolean>(false);
  const [bukaModalKunci, setBukaModalKunci] = useState<boolean>(false);
  const [aksiSetelahBukaKunci, setAksiSetelahBukaKunci] = useState<'editLangsung' | 'form' | null>(null);
  // Alur laporan: titik terpilih → form (langkah 1) → tinjau lembar (langkah 2) → export PDF.
  const [formLaporan, setFormLaporan] = useState<{ laporan: LaporanKarhutla; baru: boolean } | null>(null);
  const [mengeksporPdf, setMengeksporPdf] = useState(false);
  const [draftLaporan, setDraftLaporan] = useState<LaporanKarhutla | null>(null);
  const [isGeneratingSnapshot, setIsGeneratingSnapshot] = useState<boolean>(false);
  const [isUploadingFoto, setIsUploadingFoto] = useState<boolean>(false);

  // Hidden File Inputs Refs
  const inputUploadFotoRef = useRef<HTMLInputElement>(null);
  const inputUploadPetaRef = useRef<HTMLInputElement>(null);

  // Simpan otomatis ke localStorage
  useEffect(() => {
    if (demoAktif()) simpanTitikApiMonitoring(titikList);
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
  const arsipIni = arsipAktif && laporanDitampilkan && arsipAktif.id === laporanDitampilkan.id ? arsipAktif : null;
  const langkahDokumen = !arsipIni ? 1 : arsipIni.dikirim_pada ? 3 : 2;

  // Metrik ringkasan titik api
  const metrik = useMemo(() => {
    const total = titikAktif.length;
    const diDalam = titikAktif.filter((t) => bisaDibuatkanLaporan(t)).length;
    const ippkh = titikAktif.filter((t) => t.zona === 'ippkh').length;
    const iup = titikAktif.filter((t) => t.zona === 'iup').length;
    const das = titikAktif.filter((t) => t.area === 'das' || t.zona === 'petak').length;
    const waspada = titikAktif.filter((t) => t.zona === 'waspada').length;
    const pantau = titikAktif.filter((t) => t.zona === 'pantau').length;
    const padam = titikAktif.filter((t) => t.status === 'padam').length;
    return { total, diDalam, ippkh, iup, das, waspada, pantau, padam };
  }, [titikAktif]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const handleTogglePilihTitik = (id: string) => {
    setTitikTerpilihIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  /**
   * Tab Harian → laporan baru untuk satu hari dan satu kelompok area
   * (tambang = IUP/IPPKH, das = petak Rehab DAS), lalu buka form langkah 1.
   * Screenshot peta resmi dibuat otomatis.
   */
  const handleBuatDariHarian = async (hari: string, kelompok: KelompokLaporan, titik: TitikApiFireItem[]) => {
    try {
      const laporanBaru: LaporanKarhutla = {
        ...buatLaporanOtomatis({ titikList: titik, targetArea: kelompok === 'das' ? 'das' : 'auto', pengguna }),
        hariTitik: hari,
      };
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
      setKembaliKe('harian');
      setFormLaporan({ laporan: laporanBaru, baru: true });
    } catch (err) {
      notify(err instanceof Error ? err.message.toUpperCase() : 'GAGAL MEMBUAT LAPORAN');
    }
  };

  /** Tampilkan satu laporan di tab dokumen. `arsip` null = masih draf di perangkat. */
  const bukaDokumen = (id: string, arsip: ArsipKarhutla | null, dari: 'pantau' | 'harian' | 'riwayat') => {
    setLaporanAktifId(id);
    setArsipAktif(arsip);
    setModeEditLaporan(false);
    setDraftLaporan(null);
    setKembaliKe(dari);
    setTabMode('dokumen');
  };

  /** Laporan yang sudah diekspor: isinya diambil dari arsip server lalu dibuka. */
  const handleBukaArsip = async (a: ArsipKarhutla, dari: 'harian' | 'riwayat') => {
    try {
      const isi = { ...(await ambilIsiArsip(a)), diekspor: a.diekspor_pada };
      setDaftarLaporan((prev) => [isi, ...prev.filter((l) => l.id !== isi.id)]);
      pdfTerakhir.current = null;
      bukaDokumen(isi.id, a, dari);
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUKA ARSIP');
    }
  };

  /** Form selesai → laporan disimpan (draf) lalu ditampilkan untuk ditinjau. */
  const handleTinjauForm = (hasil: LaporanKarhutla) => {
    const siap: LaporanKarhutla = { ...anonimkanDalam(hasil), terkunci: true };
    const baru = formLaporan?.baru;
    setDaftarLaporan((prev) => (baru ? [siap, ...prev] : prev.map((l) => (l.id === siap.id ? siap : l))));
    setFormLaporan(null);
    bukaDokumen(siap.id, baru ? null : arsipAktif, kembaliKe);
    notify('LAPORAN DISIMPAN & TERKUNCI (PASSWORD: eblhasnurajadeh)');
  };

  /** Export PDF → unggah ke arsip server (R2) → siap dikirim ke WhatsApp. */
  const handleEksporPdf = async () => {
    if (modeEditLaporan) { notify('SIMPAN ATAU BATALKAN EDIT DULU'); return; }
    const dok = document.getElementById('dokumen-karhutla-a4');
    const l = laporanDitampilkan;
    if (!dok || !l) return;
    setMengeksporPdf(true);
    try {
      const pdf = await buatPdfLembar(dok);
      const titikLaporan = dataBulan.titik.filter((t) => l.titikIds.includes(t.id));
      const lengkap = { ...l, hariTitik: l.hariTitik ?? l.tanggalLaporan };
      const arsip = await unggahLaporan(lengkap, titikLaporan, pdf);
      pdfTerakhir.current = { id: l.id, blob: pdf };
      setArsipAktif(arsip);
      setDaftarLaporan((prev) => prev.map((x) => (x.id === l.id ? { ...lengkap, diekspor: arsip.diekspor_pada } : x)));
      setVersiArsip((v) => v + 1);
      notify('PDF TERSIMPAN DI ARSIP · SIAP DIKIRIM');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT PDF');
    } finally {
      setMengeksporPdf(false);
    }
  };

  const pdfArsipIni = async (a: ArsipKarhutla) =>
    pdfTerakhir.current?.id === a.id ? pdfTerakhir.current.blob : ambilPdfArsip(a);

  /** Kirim manual: lembar bagikan (HP) atau unduh + WhatsApp Web (komputer), lalu dicatat terkirim. */
  const handleKirimWa = async () => {
    if (!arsipAktif) return;
    setMengirimWa(true);
    try {
      await kirimKeWhatsApp(await pdfArsipIni(arsipAktif), namaPdf(arsipAktif), pesanPengantar(arsipAktif));
      const b = await tandaiTerkirim(arsipAktif.id);
      if (b) setArsipAktif(b);
      setVersiArsip((v) => v + 1);
      notify('DITANDAI TERKIRIM KE WHATSAPP');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGIRIM');
    } finally {
      setMengirimWa(false);
    }
  };

  const handleUnduhPdf = async () => {
    if (!arsipAktif) return;
    try {
      const hasil = await simpanBerkas(await pdfArsipIni(arsipAktif), namaPdf(arsipAktif), arsipAktif.judul);
      notify(hasil === 'diunduh' ? 'PDF DIUNDUH' : 'PDF SIAP DIBAGIKAN');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGAMBIL PDF');
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
    if (laporanAktif.terkunci) {
      setAksiSetelahBukaKunci('editLangsung');
      setBukaModalKunci(true);
      return;
    }
    setDraftLaporan(JSON.parse(JSON.stringify(laporanAktif)));
    setModeEditLaporan(true);
    notify('MODE EDIT DOKUMEN DIAKTIFKAN');
  };

  const handleBukaFormEdit = () => {
    if (!laporanAktif) return;
    if (laporanAktif.terkunci) {
      setAksiSetelahBukaKunci('form');
      setBukaModalKunci(true);
      return;
    }
    setFormLaporan({ laporan: laporanAktif, baru: false });
  };

  const handleSimpanEdit = () => {
    if (!draftLaporan) return;
    const sekarang = new Date().toISOString();
    const updated: LaporanKarhutla = { ...draftLaporan, terkunci: true, diubahPada: sekarang };
    setDaftarLaporan((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
    setModeEditLaporan(false);
    setDraftLaporan(null);
    notify('PERUBAHAN DOKUMEN BERHASIL DISIMPAN & TERKUNCI (PASSWORD: eblhasnurajadeh)');
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

        {/* Tiga tab alur kerja: pantau, harian (buat laporan), riwayat (arsip). */}
        <div className="flex border-2 border-white/40">
          {([['pantau', MapPin, 'Pantau'], ['harian', Table, 'Harian'], ['riwayat', Calendar, 'Riwayat']] as const).map(([k, Ikon, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => pindahTab(k)}
              className={`px-3 py-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase transition-colors ${
                tabMode === k || (tabMode === 'dokumen' && kembaliKe === k) ? 'bg-orange-600 text-white' : 'bg-black/40 text-zinc-300 hover:text-white'
              }`}
            >
              <Ikon size={13} /> {label}
            </button>
          ))}
        </div>
        {tabMode === 'pantau' && (
          <div className="flex items-center gap-1.5">
            <div className="flex border-2 border-white/40" role="group" aria-label="Rentang waktu titik">
              {([[true, '24 jam'], [false, '7 hari']] as const).map(([nyala, label]) => (
                <button key={label} type="button" onClick={() => aturLive(nyala)} aria-pressed={modeLive === nyala}
                  className={`px-2.5 h-8 text-[11px] font-bold uppercase flex items-center gap-1.5 ${modeLive === nyala ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-300 hover:text-white'}`}>
                  {nyala && <span className={`w-2 h-2 rounded-full ${modeLive ? 'bg-white animate-pulse' : 'bg-zinc-500'}`} />}{label}
                </button>
              ))}
            </div>
            <div className="flex border-2 border-white/40" role="group" aria-label="Tampilan peta">
              {([[false, 'Titik'], [true, 'Panas']] as const).map(([pn, label]) => (
                <button key={label} type="button" onClick={() => setPetaPanas(pn)} aria-pressed={petaPanas === pn}
                  className={`px-2.5 h-8 text-[11px] font-bold uppercase ${petaPanas === pn ? 'bg-orange-600 text-white' : 'bg-zinc-900 text-zinc-300 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {pakaiNasa && tabMode === 'pantau' && (
        <div
          className={`no-print mx-2 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-2 px-2 py-1.5 text-[11px] shrink-0 ${
            modeLive ? 'bg-red-950/70 border-red-500 text-red-100' : 'bg-zinc-900/80 border-zinc-500 text-zinc-200'
          }`}
        >
          <span className="flex items-center gap-1.5 font-bold uppercase text-white">
            <span className={`w-2 h-2 rounded-full ${modeLive ? 'bg-red-400 animate-pulse' : 'bg-zinc-400'}`} />
            {modeLive ? 'Live 24 jam' : '7 hari'}
          </span>
          {!dataNasa ? (
            <span className="flex items-center gap-1">
              {memuatNasa ? <><Loader2 size={11} className="animate-spin" /> Memuat data NASA FIRMS…</> : 'Data NASA belum termuat.'}
            </span>
          ) : (
            <span>
              <b className="text-white">{titikAktif.length}</b> titik NASA FIRMS dalam {modeLive ? '24 jam' : '7 hari'} terakhir
              {modeDemo && ' (contoh)'}
              {titikAktif.length === 0 && ' · tidak ada titik api terdeteksi'}
            </span>
          )}
          {dataNasa?.terakhir && !Number.isNaN(Date.parse(dataNasa.terakhir)) && (
            <span className="opacity-75">Satelit diambil server {jamWita(new Date(dataNasa.terakhir))} WITA</span>
          )}
          {diambilPada && !dataNasa?.salinanDari && (
            <span className="opacity-75">Disegarkan {jamWita(diambilPada)}{modeLive ? ' · otomatis tiap 10 menit' : ''}</span>
          )}
          {dataNasa?.salinanDari && (
            <span className="text-amber-300">
              Server tidak terjangkau · menampilkan salinan {jamWita(new Date(dataNasa.salinanDari))} WITA
            </span>
          )}
          {dataNasa && !dataNasa.terpasang && <span className="text-amber-300">Kunci NASA FIRMS belum dipasang di server.</span>}
          {dataNasa?.galat && <span className="text-amber-300">Galat terakhir: {dataNasa.galat}</span>}
          <span className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void segarkanNasa()}
              disabled={memuatNasa}
              className="btn-retro btn-retro-sm bg-zinc-800 text-white !py-0.5 text-[10px] flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw size={11} className={memuatNasa ? 'animate-spin' : ''} /> Segarkan
            </button>
            {pengguna.peran === 'admin' && !modeDemo && (
              <button
                type="button"
                onClick={periksaNasaSekarang}
                disabled={memeriksaNasa}
                className="btn-retro btn-retro-sm bg-red-700 text-white !py-0.5 text-[10px] flex items-center gap-1 disabled:opacity-50"
                title="Minta server mengambil data NASA FIRMS sekarang (tidak menunggu jadwal tiap jam)"
              >
                {memeriksaNasa ? <Loader2 size={11} className="animate-spin" /> : <Flame size={11} />} Periksa NASA sekarang
              </button>
            )}
          </span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAMPILAN 1: PETA HOTSPOT & DAFTAR TITIK API                           */}
      {/* ===================================================================== */}
      {tabMode === 'pantau' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar px-2 pb-8 gap-3.5 no-print">
          {/* ================================================================= */}
          {/* 1. KARTU METRIK RINGKAS & INTERAKTIF (Bisa diklik untuk filter)    */}
          {/* ================================================================= */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
            {/* Titik Di Dalam (Perlu Laporan) */}
            <div
              onClick={() => pindahTab('harian')}
              className={`panel-retro p-2.5 flex items-center gap-3 cursor-pointer transition-all ${'bg-black/70 border-2 border-red-500/70 hover:border-red-400 hover:bg-red-950/30'}`}
              title="Buka tab Harian"
            >
              <div className="w-10 h-10 rounded bg-red-950/90 border border-red-500 flex items-center justify-center text-red-400 shrink-0 shadow-inner">
                <Flame size={20} className="fill-red-400 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-red-300 font-bold uppercase tracking-wider font-mono">
                    Di Dalam Konsesi
                  </span>
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
              onClick={() => pindahTab('harian')}
              className={`panel-retro p-2.5 flex items-center gap-3 cursor-pointer transition-all ${'bg-black/70 border-2 border-amber-500/70 hover:border-amber-400 hover:bg-amber-950/30'}`}
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
              onClick={() => pindahTab('harian')}
              className={`panel-retro p-2.5 flex items-center gap-3 cursor-pointer transition-all ${'bg-black/70 border-2 border-yellow-500/60 hover:border-yellow-400 hover:bg-yellow-950/30'}`}
              title="Buka tab Harian"
            >
              <div className="w-10 h-10 rounded bg-yellow-950/90 border border-yellow-500 flex items-center justify-center text-yellow-400 shrink-0 shadow-inner">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-yellow-300 font-bold uppercase tracking-wider font-mono">
                    Waspada Perimeter
                  </span>
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
              onClick={() => pindahTab('harian')}
              className={`panel-retro p-2.5 flex items-center gap-3 cursor-pointer transition-all ${'bg-black/70 border-2 border-emerald-500/60 hover:border-emerald-400 hover:bg-emerald-950/30'}`}
              title="Buka tab Harian"
            >
              <div className="w-10 h-10 rounded bg-emerald-950/90 border border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider font-mono">
                    Telah Padam / Terkendali
                  </span>
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
          {/* 2. PETA GIS INTERAKTIF                                          */}
          {/* ================================================================= */}
          <div
            className={`relative rounded border-2 border-emerald-500/60 shadow-lg transition-all duration-300 overflow-hidden h-[62vh] min-h-[320px] shrink-0`}
          >
            <FireMap
              key={modeDemo ? kotaDemo : 'kerja'}
              titikList={titikAktif}
              titikTerpilihIds={titikTerpilihIds}
              titikFokus={titikFokus}
              onPilihTitik={(t) => {
                setTitikFokus(t);
              }}
              onTogglePilihLaporan={handleTogglePilihTitik}
              panas={petaPanas}
            />
          </div>

          <button
            type="button"
            onClick={() => pindahTab('harian')}
            className="btn-retro bg-red-600 w-full !py-3 text-[13px] shrink-0"
          >
            <Flame size={16} className="fill-white" /> Lihat titik per hari &amp; buat laporan
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAMPILAN 2: PRATINJAU DOKUMEN RESMI SESUAI PDF REFERENSI              */}
      {/* ===================================================================== */}
      {tabMode === 'dokumen' && laporanDitampilkan && (
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
                onClick={() => pindahTab(kembaliKe)}
                className="btn-retro bg-zinc-800 text-zinc-300 flex items-center gap-1.5 !py-1 text-[11px]"
              >
                <ArrowLeft size={13} /> Kembali
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
              {laporanDitampilkan?.terkunci && !modeEditLaporan && (
                <span className="chip-retro !text-[9px] border-amber-400 bg-amber-950 text-amber-300 font-bold flex items-center gap-1 font-mono">
                  <Lock size={10} /> TERKUNCI
                </span>
              )}
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
              {laporanDitampilkan?.terkunci && !modeEditLaporan ? (
                <button
                  type="button"
                  onClick={() => {
                    setAksiSetelahBukaKunci('editLangsung');
                    setBukaModalKunci(true);
                  }}
                  className="btn-retro bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px]"
                  title="Dokumen terkunci. Klik untuk membuka kunci dengan password."
                >
                  <Lock size={13} className="text-amber-200" /> Buka Kunci
                </button>
              ) : !modeEditLaporan ? (
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

              {/* Kembali ke form (langkah 1) */}
              <button
                onClick={handleBukaFormEdit}
                disabled={modeEditLaporan || !laporanAktif}
                className="btn-retro bg-orange-700 hover:bg-orange-600 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px] disabled:opacity-40"
                title="Buka lagi form kronologi laporan ini"
              >
                <FileText size={13} /> Ubah lewat form
              </button>

              {/* Export PDF langsung */}
              <button
                onClick={handleEksporPdf}
                disabled={mengeksporPdf}
                className="btn-retro bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 !py-1 text-[11px] shadow-[2px_2px_0_#000] disabled:opacity-60"
                title="Buat berkas PDF A4 lalu simpan atau bagikan"
              >
                {mengeksporPdf ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {mengeksporPdf ? 'Membuat & mengunggah PDF…' : arsipIni ? 'Export ulang PDF' : 'Export PDF'}
              </button>

              {/* Cetak lewat browser (hanya versi web; WebView APK tidak punya dialog cetak) */}
              {!diAplikasi() && (
                <button
                  onClick={handleCetakDokumen}
                  className="btn-retro bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-1.5 !py-1 text-[11px]"
                  title="Cetak lewat dialog cetak browser"
                >
                  <Printer size={13} /> Cetak
                </button>
              )}
            </div>
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
          {/* DOKUMEN RESMI A4 — tata letak mengikuti contoh laporan Word:      */}
          {/* hal.1 identitas + A. Deskripsi · hal.2 B. Kronologi + pengesahan  */}
          {/* hal.3 tangkapan layar peta · hal.4 foto lapangan                  */}
          {/* ================================================================= */}
          <div className="no-print max-w-4xl mx-auto mb-2 border-2 border-orange-500 bg-orange-950/60 px-3 py-2 text-[12px] text-orange-100 space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {['Isi form', 'Tinjau & export PDF', 'Kirim ke WhatsApp'].map((nama, i) => (
                <span
                  key={nama}
                  className={`chip-retro !text-[10px] font-bold ${
                    i < langkahDokumen ? 'border-emerald-400 bg-emerald-950 text-emerald-300' : i === langkahDokumen ? 'border-yellow-300 bg-yellow-500 text-black' : 'border-white/20 text-zinc-400'
                  }`}
                >
                  {i < langkahDokumen ? '✓' : i + 1}. {nama}
                </span>
              ))}
            </div>
            {!arsipIni ? (
              <p>Periksa semua halaman di bawah, lalu tekan <b>Export PDF</b>. PDF disimpan ke arsip server dan siap dikirim. Ada yang kurang? Tekan <b>Ubah lewat form</b>.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-[180px]">
                  {arsipIni.dikirim_pada
                    ? <>Sudah dikirim ke WhatsApp <b className="text-white">{jamWita(new Date(arsipIni.dikirim_pada))} WITA</b>{arsipIni.jumlah_kirim > 1 ? ` (${arsipIni.jumlah_kirim}×)` : ''}.</>
                    : <>PDF tersimpan di arsip. Kirim ke grup atau kontak WhatsApp.</>}
                </span>
                <button type="button" onClick={handleKirimWa} disabled={mengirimWa} className="btn-retro bg-emerald-700 !py-1.5 text-[12px] disabled:opacity-50">
                  {mengirimWa ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {arsipIni.dikirim_pada ? 'Kirim lagi' : 'Kirim ke WhatsApp'}
                </button>
                <button type="button" onClick={handleUnduhPdf} className="btn-retro bg-zinc-800 !py-1.5 text-[12px]">
                  <Download size={13} /> Unduh PDF
                </button>
              </div>
            )}
          </div>
          <div className="no-print max-w-4xl mx-auto mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-300 font-mono">
            <span className="flex items-center gap-1">
              <b className="text-zinc-400">Nomor</b>
              {modeEditLaporan ? (
                <input
                  type="text"
                  value={laporanDitampilkan.nomorLaporan}
                  onChange={(e) => mutateLaporan((l) => ({ ...l, nomorLaporan: e.target.value }))}
                  className="border border-amber-400 bg-amber-50 text-black px-1 py-0.5 text-[11px] rounded"
                />
              ) : (
                laporanDitampilkan.nomorLaporan
              )}
            </span>
            <span className="flex items-center gap-1">
              <b className="text-zinc-400">Tanggal</b>
              {modeEditLaporan ? (
                <input
                  type="date"
                  value={laporanDitampilkan.tanggalLaporan}
                  onChange={(e) => mutateLaporan((l) => ({ ...l, tanggalLaporan: e.target.value }))}
                  className="border border-amber-400 bg-amber-50 text-black px-1 py-0.5 text-[11px] rounded"
                />
              ) : (
                tanggalPanjang(laporanDitampilkan.tanggalLaporan)
              )}
            </span>
            <span className="text-zinc-500">Nomor tidak ikut tercetak, sesuai format laporan.</span>
          </div>

          <div className="flex justify-center">
            <div
              id="dokumen-karhutla-a4"
              className="bg-white text-black px-6 py-8 md:px-14 md:py-12 max-w-4xl w-full shadow-2xl border-2 border-zinc-400 print:border-none print:p-0 print:shadow-none print:max-w-none text-[10.5pt] leading-[1.45]"
              style={{ fontFamily: 'Tahoma, Verdana, "Segoe UI", Arial, sans-serif' }}
            >
              {/* ------------------------------------------------------------- */}
              {/* HALAMAN 1: KOP, IDENTITAS IZIN, & A. DESKRIPSI                */}
              {/* ------------------------------------------------------------- */}
              <section data-halaman="1">
                <KopLaporan demo={modeDemo} perusahaan={idn.perusahaan} />

                <table className="w-full border-collapse text-[9pt] mb-3">
                  <tbody>
                    {BARIS_IDENTITAS.map(({ label, kunci, panjang }) => (
                      <tr key={kunci}>
                        <td className="border border-black px-2 py-1.5 font-bold w-[38%] align-middle">{label}</td>
                        <td className="border border-black px-1 py-1.5 w-[3%] text-center align-middle">:</td>
                        <td className="border border-black px-2 py-1.5 align-middle">
                          {modeEditLaporan ? (
                            panjang ? (
                              <textarea
                                rows={2}
                                value={laporanDitampilkan[kunci]}
                                onChange={(e) => mutateLaporan((l) => ({ ...l, [kunci]: e.target.value }))}
                                className="w-full border border-amber-300 bg-amber-50 p-1 text-[9pt] rounded"
                              />
                            ) : (
                              <input
                                type="text"
                                value={laporanDitampilkan[kunci]}
                                onChange={(e) => mutateLaporan((l) => ({ ...l, [kunci]: e.target.value }))}
                                className="w-full border border-amber-300 bg-amber-50 p-1 text-[9pt] rounded"
                              />
                            )
                          ) : (
                            laporanDitampilkan[kunci]
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h4 className="font-bold text-[10.5pt] mb-1.5">A. DESKRIPSI</h4>
                <div className="space-y-1.5">
                  <Butir no={1}>
                    {modeEditLaporan ? (
                      <textarea
                        rows={5}
                        value={laporanDitampilkan.deskripsiUmum}
                        onChange={(e) => mutateLaporan((l) => ({ ...l, deskripsiUmum: e.target.value }))}
                        className="w-full border border-amber-300 bg-amber-50 p-2 text-[10pt] leading-relaxed rounded"
                      />
                    ) : (
                      laporanDitampilkan.deskripsiUmum
                    )}
                  </Butir>
                  <Butir no={2}>
                    Menindaklanjuti informasi tersebut, tim pemantau melakukan verifikasi lapangan{' '}
                    (<i>ground check</i>) untuk memastikan keberadaan, penyebab, luasan, serta status titik api
                    di lokasi terindikasi. Adapun koordinat titik panas yang terpantau adalah sebagai berikut:
                    <table className="w-full border-collapse text-[9.5pt] mt-1.5 mb-0.5 break-inside-avoid">
                      <thead>
                        <tr className="font-bold">
                          <th className="border border-black px-2 py-1 text-left w-[46%]">Keterangan</th>
                          <th className="border border-black px-2 py-1 text-center w-[12%]">Titik</th>
                          <th className="border border-black px-2 py-1 text-center">X (Bujur)</th>
                          <th className="border border-black px-2 py-1 text-center">Y (Lintang)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kelompokKoordinat(laporanDitampilkan.titikKoordinat).map(({ k, rentang }) => (
                          <tr key={k.no}>
                            {rentang > 0 && (
                              <td rowSpan={rentang} className="border border-black px-2 py-1 align-top">
                                {k.keterangan.split(/<br\s*\/?>/i).map((baris, i) => (
                                  <React.Fragment key={i}>{i > 0 && <br />}{baris.trim()}</React.Fragment>
                                ))}
                              </td>
                            )}
                            <td className="border border-black px-2 py-1 text-center align-top">{k.no}</td>
                            <td className="border border-black px-2 py-1 text-center align-top tabular-nums">
                              {k.xBujur.toFixed(5).replace('.', ',')}
                            </td>
                            <td className="border border-black px-2 py-1 text-center align-top tabular-nums">
                              {k.yLintang.toFixed(5).replace('.', ',')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Butir>
                  <Butir no={3}>
                    Sistem koordinat yang digunakan adalah geografis (Geographic Coordinate System) dengan datum
                    WGS 1984, dinyatakan dalam satuan derajat desimal. Peta sebaran titik panas dan lokasi
                    verifikasi lapangan terlampir pada dokumen ini.
                  </Butir>
                </div>
              </section>

              {/* ------------------------------------------------------------- */}
              {/* HALAMAN 2: B. KRONOLOGI KEBAKARAN + PENGESAHAN                */}
              {/* ------------------------------------------------------------- */}
              <section data-halaman="2" className="halaman-baru mt-8 pt-8 border-t-2 border-dashed border-zinc-300 print:mt-0 print:pt-0 print:border-none">
                <KopLaporan demo={modeDemo} perusahaan={idn.perusahaan} />

                <h4 className="font-bold text-[10.5pt] mb-1.5">B. KRONOLOGI KEBAKARAN</h4>
                <div className="space-y-1.5">
                  <Butir no={1}>
                    {modeEditLaporan ? (
                      <div className="space-y-1">
                        <label className="text-[9pt] font-bold text-zinc-600 block">Waktu ground check</label>
                        <input
                          type="text"
                          value={laporanDitampilkan.kronologi.waktuVerifikasi}
                          onChange={(e) => mutateLaporan((l) => ({ ...l, kronologi: { ...l.kronologi, waktuVerifikasi: e.target.value } }))}
                          className="w-full border border-amber-300 bg-amber-50 p-1 text-[10pt] rounded"
                          placeholder="Pada hari Senin, tanggal …, pukul … WITA"
                        />
                        <label className="text-[9pt] font-bold text-zinc-600 block">Sumber titik panas & lokasi spesifik</label>
                        <textarea
                          rows={3}
                          value={laporanDitampilkan.kronologi.lokasiSpesifik}
                          onChange={(e) => mutateLaporan((l) => ({ ...l, kronologi: { ...l.kronologi, lokasiSpesifik: e.target.value } }))}
                          className="w-full border border-amber-300 bg-amber-50 p-1 text-[10pt] rounded"
                        />
                      </div>
                    ) : (
                      <>
                        {laporanDitampilkan.kronologi.waktuVerifikasi}, tim patroli kebakaran {idn.perusahaan}{' '}
                        melakukan verifikasi lapangan terhadap titik panas yang terpantau pada Website SIPONGI. Hasil
                        verifikasi menunjukkan bahwa titik panas tersebut bersumber dari{' '}
                        {laporanDitampilkan.kronologi.lokasiSpesifik}
                      </>
                    )}
                  </Butir>
                  {([
                    ['pengamatanVisual', 5],
                    ['tindakanPenanganan', 5],
                  ] as const).map(([kunci, baris], i) => (
                    <Butir key={kunci} no={i + 2}>
                      {modeEditLaporan ? (
                        <textarea
                          rows={baris}
                          value={laporanDitampilkan.kronologi[kunci]}
                          onChange={(e) => mutateLaporan((l) => ({ ...l, kronologi: { ...l.kronologi, [kunci]: e.target.value } }))}
                          className="w-full border border-amber-300 bg-amber-50 p-1 text-[10pt] leading-relaxed rounded"
                        />
                      ) : (
                        laporanDitampilkan.kronologi[kunci]
                      )}
                    </Butir>
                  ))}
                  <Butir no={4}>
                    {modeEditLaporan ? (
                      <div className="space-y-1">
                        <textarea
                          rows={2}
                          value={laporanDitampilkan.kronologi.prosesPemadaman}
                          onChange={(e) => mutateLaporan((l) => ({ ...l, kronologi: { ...l.kronologi, prosesPemadaman: e.target.value } }))}
                          className="w-full border border-amber-300 bg-amber-50 p-1 text-[10pt] rounded"
                          placeholder="Proses pemadaman…"
                        />
                        <textarea
                          rows={3}
                          value={laporanDitampilkan.kronologi.hasilVerifikasi}
                          onChange={(e) => mutateLaporan((l) => ({ ...l, kronologi: { ...l.kronologi, hasilVerifikasi: e.target.value } }))}
                          className="w-full border border-amber-300 bg-amber-50 p-1 text-[10pt] rounded"
                          placeholder="Hasil verifikasi akhir…"
                        />
                      </div>
                    ) : (
                      <>
                        {laporanDitampilkan.kronologi.prosesPemadaman} {laporanDitampilkan.kronologi.hasilVerifikasi}
                      </>
                    )}
                  </Butir>
                </div>

                {/* Pengesahan: pembuat di kiri, Kepala Teknik Tambang di kanan. */}
                <div className="grid grid-cols-2 gap-10 mt-10 text-[10pt] text-center break-inside-avoid">
                  <div>
                    <p>&nbsp;</p>
                    <p>Dibuat oleh,</p>
                    <div className="h-[72px] flex items-center justify-center">
                      {ttdPembuat(laporanDitampilkan.dibuatOleh) && (
                        <img src={ttdPembuat(laporanDitampilkan.dibuatOleh)} alt={`Tanda tangan ${laporanDitampilkan.dibuatOleh}`} className="h-[60px] w-auto" />
                      )}
                    </div>
                    {modeEditLaporan ? (
                      <input
                        type="text"
                        value={laporanDitampilkan.dibuatOleh}
                        onChange={(e) => mutateLaporan((l) => ({ ...l, dibuatOleh: e.target.value }))}
                        className="w-full border border-amber-300 bg-amber-50 p-1 text-[10pt] font-bold text-center rounded"
                      />
                    ) : (
                      <p className="font-bold underline">{laporanDitampilkan.dibuatOleh}</p>
                    )}
                    <p>
                      {laporanDitampilkan.jabatanPembuat ||
                        (laporanDitampilkan.jenisIzin.toLowerCase().includes('das')
                          ? 'Pengawas Rehabilitasi DAS & Tim Patroli Hutan'
                          : 'Tim Tanggap Darurat & SHE Department')}
                    </p>
                  </div>
                  <div>
                    <p>{kotaPengesahan(laporanDitampilkan.kabupaten)}, {tanggalPanjang(laporanDitampilkan.tanggalLaporan)}</p>
                    <p>Mengesahkan,</p>
                    <div className="h-[72px] flex items-center justify-center">
                      {pengesah.ttd && <img src={pengesah.ttd} alt={`Tanda tangan ${pengesah.nama}`} className="h-[72px] w-auto" />}
                    </div>
                    <p className="font-bold underline">{pengesah.nama}</p>
                    <p>{pengesah.jabatan}</p>
                  </div>
                </div>
              </section>

              {/* ------------------------------------------------------------- */}
              {/* HALAMAN 3: TANGKAPAN LAYAR PETA / SIPONGI                     */}
              {/* ------------------------------------------------------------- */}
              <section
                data-halaman="3"
                data-kosong={laporanDitampilkan.dokumentasi.petaSipongi.length === 0 ? '1' : '0'}
                className={`halaman-baru mt-8 pt-8 border-t-2 border-dashed border-zinc-300 print:mt-0 print:pt-0 print:border-none ${
                  laporanDitampilkan.dokumentasi.petaSipongi.length === 0 ? 'print:hidden' : ''
                }`}
              >
                <KopLaporan demo={modeDemo} perusahaan={idn.perusahaan} />

                <div className="no-print flex flex-wrap items-center justify-between gap-2 mb-3 bg-zinc-100 border border-zinc-300 px-2 py-1.5">
                  <span className="text-[11px] font-bold text-zinc-700">
                    Tangkapan layar peta · {laporanDitampilkan.dokumentasi.petaSipongi.length} gambar
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleGenerateScreenshotPeta}
                      disabled={isGeneratingSnapshot}
                      className="btn-retro btn-retro-sm bg-cyan-700 hover:bg-cyan-600 text-white font-bold flex items-center gap-1 text-[10px] !py-0.5"
                      title="Otomatis buat screenshot peta WGS 1984"
                    >
                      {isGeneratingSnapshot ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                      <span>{isGeneratingSnapshot ? 'Membuat peta…' : 'Screenshot peta otomatis'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => inputUploadPetaRef.current?.click()}
                      className="btn-retro btn-retro-sm bg-zinc-700 hover:bg-zinc-600 text-white font-bold flex items-center gap-1 text-[10px] !py-0.5"
                      title="Upload gambar screenshot SiPongi dari berkas"
                    >
                      <Upload size={11} /> <span>Upload peta</span>
                    </button>
                  </div>
                </div>

                {laporanDitampilkan.dokumentasi.petaSipongi.length === 0 && (
                  <p className="no-print text-center text-zinc-500 text-[10pt] py-10 border-2 border-dashed border-zinc-300">
                    Belum ada tangkapan layar peta. Halaman ini tidak ikut tercetak selama kosong.
                  </p>
                )}
                <div className="flex flex-col items-center gap-4">
                  {laporanDitampilkan.dokumentasi.petaSipongi.map((imgUrl, i) => (
                    <div key={i} className="lebar-peta relative w-full md:w-[82%] break-inside-avoid">
                      <img src={imgUrl} alt={`Tangkapan layar titik panas ${i + 1}`} className="block w-full h-auto" />
                      <TombolHapusGambar onClick={() => handleHapusPetaSipongi(i)} judul="Hapus tangkapan layar ini" />
                    </div>
                  ))}
                </div>
              </section>

              {/* ------------------------------------------------------------- */}
              {/* HALAMAN 4: FOTO DOKUMENTASI LAPANGAN                          */}
              {/* ------------------------------------------------------------- */}
              <section
                data-halaman="4"
                data-kosong={laporanDitampilkan.dokumentasi.fotoLapangan.length === 0 ? '1' : '0'}
                className={`halaman-baru mt-8 pt-8 border-t-2 border-dashed border-zinc-300 print:mt-0 print:pt-0 print:border-none ${
                  laporanDitampilkan.dokumentasi.fotoLapangan.length === 0 ? 'print:hidden' : ''
                }`}
              >
                <KopLaporan demo={modeDemo} perusahaan={idn.perusahaan} />

                <div className="no-print flex flex-wrap items-center justify-between gap-2 mb-3 bg-zinc-100 border border-zinc-300 px-2 py-1.5">
                  <span className="text-[11px] font-bold text-zinc-700">
                    Foto lapangan · {laporanDitampilkan.dokumentasi.fotoLapangan.length} foto
                  </span>
                  <button
                    type="button"
                    onClick={() => inputUploadFotoRef.current?.click()}
                    disabled={isUploadingFoto}
                    className="btn-retro btn-retro-sm bg-purple-700 hover:bg-purple-600 text-white font-bold flex items-center gap-1 text-[10px] !py-0.5"
                    title="Unggah foto dokumentasi dari kamera atau galeri"
                  >
                    {isUploadingFoto ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                    <span>{isUploadingFoto ? 'Mengunggah…' : 'Upload foto'}</span>
                  </button>
                </div>

                {laporanDitampilkan.dokumentasi.fotoLapangan.length === 0 && (
                  <p className="no-print text-center text-zinc-500 text-[10pt] py-10 border-2 border-dashed border-zinc-300">
                    Belum ada foto lapangan. Halaman ini tidak ikut tercetak selama kosong.
                  </p>
                )}
                <div className="lebar-foto grid grid-cols-2 gap-1 w-full md:w-[80%] mx-auto">
                  {laporanDitampilkan.dokumentasi.fotoLapangan.map((foto, idx) => (
                    <div key={idx} className="break-inside-avoid">
                      <div className="relative">
                        <img src={foto.url} alt={foto.judul} className="block w-full aspect-square object-cover" />
                        <TombolHapusGambar onClick={() => handleHapusFotoLapangan(idx)} judul="Hapus foto ini" />
                      </div>
                      {modeEditLaporan && (
                        <div className="no-print mt-1 mb-2 space-y-1 text-[10px] bg-amber-50 border border-amber-300 p-1.5">
                          <input
                            type="text"
                            value={foto.judul}
                            onChange={(e) => {
                              const val = e.target.value;
                              mutateLaporan((lap) => {
                                const fl = [...lap.dokumentasi.fotoLapangan];
                                fl[idx] = { ...fl[idx], judul: val };
                                return { ...lap, dokumentasi: { ...lap.dokumentasi, fotoLapangan: fl } };
                              });
                            }}
                            className="w-full border border-amber-300 bg-white p-1 rounded"
                            placeholder="Judul foto (tidak tercetak)"
                          />
                          <div className="flex items-center justify-between gap-1">
                            <select
                              value={foto.kategori}
                              onChange={(e) => {
                                const val = e.target.value as LaporanKarhutla['dokumentasi']['fotoLapangan'][number]['kategori'];
                                mutateLaporan((lap) => {
                                  const fl = [...lap.dokumentasi.fotoLapangan];
                                  fl[idx] = { ...fl[idx], kategori: val };
                                  return { ...lap, dokumentasi: { ...lap.dokumentasi, fotoLapangan: fl } };
                                });
                              }}
                              className="border border-zinc-300 bg-white px-1 py-0.5 rounded"
                            >
                              <option value="sebelum">Sebelum</option>
                              <option value="tindakan">Tindakan</option>
                              <option value="setelah">Setelah</option>
                              <option value="umum">Umum</option>
                            </select>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleGeserFoto(idx, 'atas')}
                                disabled={idx === 0}
                                className="btn-retro btn-retro-sm bg-zinc-200 text-black !p-1 disabled:opacity-30"
                                title="Geser ke depan"
                              >
                                <ArrowUp size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGeserFoto(idx, 'bawah')}
                                disabled={idx === laporanDitampilkan.dokumentasi.fotoLapangan.length - 1}
                                className="btn-retro btn-retro-sm bg-zinc-200 text-black !p-1 disabled:opacity-30"
                                title="Geser ke belakang"
                              >
                                <ArrowDown size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB HARIAN: titik per hari sebulan + tombol buat laporan               */}
      {/* ===================================================================== */}
      {tabMode === 'harian' && (
        <div className="flex-1 overflow-auto custom-scrollbar px-2 pb-6 min-h-0 no-print">
          <FireHarian
            bulan={bulanHarian}
            onGantiBulan={setBulanHarian}
            titik={dataBulan.titik}
            arsip={dataBulan.laporan}
            draf={daftarLaporan.filter((l) => !l.diekspor)}
            memuat={memuatBulan}
            galat={galatBulan}
            onBuat={handleBuatDariHarian}
            onBukaDraf={(l) => bukaDokumen(l.id, null, 'harian')}
            onBukaArsip={(a) => void handleBukaArsip(a, 'harian')}
            onFokusTitik={(t) => { setTitikFokus(t); pindahTab('pantau'); }}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB RIWAYAT: laporan yang sudah diekspor (PDF di arsip server)         */}
      {/* ===================================================================== */}
      {tabMode === 'riwayat' && (
        <div className="flex-1 overflow-auto custom-scrollbar px-2 pb-6 min-h-0 no-print">
          <FireRiwayat pengguna={pengguna} notify={notify} versi={versiArsip} onBuka={(a) => void handleBukaArsip(a, 'riwayat')} />
        </div>
      )}

      {formLaporan && (
        <FormLaporanFire
          laporan={formLaporan.laporan}
          baru={formLaporan.baru}
          notify={notify}
          onBatal={() => setFormLaporan(null)}
          onTinjau={handleTinjauForm}
        />
      )}

      {/* Gaya cetak A4: hanya lembar dokumen resmi yang keluar di kertas. */}
      <style>{`
        #dokumen-karhutla-a4.mode-ekspor-pdf { width: 643px !important; max-width: none !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; }
        #dokumen-karhutla-a4.mode-ekspor-pdf .no-print { display: none !important; }
        #dokumen-karhutla-a4.mode-ekspor-pdf section { margin: 0 !important; padding: 0 !important; border: 0 !important; }
        #dokumen-karhutla-a4.mode-ekspor-pdf .lebar-peta { width: 82% !important; }
        #dokumen-karhutla-a4.mode-ekspor-pdf .lebar-foto { width: 80% !important; }
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 18mm 14mm 22mm;
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
          .halaman-baru { break-before: page; page-break-before: always; }
          #dokumen-karhutla-a4 img, #dokumen-karhutla-a4 table { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      {bukaModalKunci && (
        <ModalBukaKunci
          namaDokumen="Laporan Karhutla"
          onSukses={() => {
            setBukaModalKunci(false);
            if (laporanAktif) {
              const dibuka: LaporanKarhutla = { ...laporanAktif, terkunci: false };
              setDaftarLaporan((prev) => prev.map((l) => (l.id === dibuka.id ? dibuka : l)));
              if (aksiSetelahBukaKunci === 'editLangsung') {
                setDraftLaporan(JSON.parse(JSON.stringify(dibuka)));
                setModeEditLaporan(true);
              } else if (aksiSetelahBukaKunci === 'form') {
                setFormLaporan({ laporan: dibuka, baru: false });
              }
            }
            setAksiSetelahBukaKunci(null);
          }}
          onBatal={() => {
            setBukaModalKunci(false);
            setAksiSetelahBukaKunci(null);
          }}
          notify={notify}
        />
      )}
    </div>
  );
};
