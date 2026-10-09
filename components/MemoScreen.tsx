import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NotebookPen, Plus, ListFilter, ArrowUpDown, Search, Trash2, Pencil, Eye, Loader2, KanbanSquare,
  CircleDot, Tags, Lock, Pin, PinOff, ChevronLeft, ChevronDown, User, ImageDown, FileSpreadsheet,
  FileText, ClipboardList, Download, Clock, MapPin, Hash, Sun, Moon, Send, ListChecks, CalendarDays, Target,
  MoreHorizontal, MoveHorizontal, Smile, Image as ImageIcon, Type, AlignLeft, Menu, Users, Sparkles, MessageSquare, X,
  ShieldCheck, FolderOpen, FileDown, BookOpen, SlidersHorizontal,
} from 'lucide-react';
import { api } from '../lib/api';
import { unduhGambar } from '../lib/gambar';
import { unduhGambarMemo, bagikanGambarMemo, GAYA_GAMBAR_MEMO, layarKomputer, type GayaGambarMemo, type UkuranGambarMemo } from '../lib/gambar-memo';
import { bukuBaru, gayakanChip, lembarBaru, simpanBuku, tanggalExcel, FORMAT_TANGGAL } from '../lib/excel';
import type { AnggotaRingkas, Bootstrap, Opsi, Pengguna, Properti as DefProperti } from '../lib/tipe-api';
import type { Memo } from '../types';
import { warna } from '../lib/warna';
import * as W from '../lib/waktu';
import { EditorMemo } from './EditorMemo';
import { BagikanMemo } from './BagikanMemo';
import { ModalAiMemo } from './ModalAiMemo';
import { prosesMemoAi, type AksiPilihanAi } from '../lib/gemini';
import { SidebarMemo } from './SidebarMemo';
import { SampahMemo } from './SampahMemo';
import { PemilihSampul, SampulMemo, type PatchSampul } from './SampulMemo';
import { SAMPUL_BAWAAN } from '../lib/sampul';
import { BarisProperti, Kosong, NilaiPolos, PilihanTembus, TanggalTembus } from './BarisProperti';
import { EditorProperti, PilihPicaMemo, TambahPropertiMemo, bacaProps, teksNilai, opsiProperti } from './PropertiMemo';
import { cuplikanMemo, gantiLabelHalaman, hakMemo, hitungTugas, pohonMemo } from '../server/src/memo-blok';
import { patchMemo, simpanMemo, pasangPengirimTertunda, type DasarIsi, type PatchMemo } from '../lib/memo-simpan';
import { gabungTigaArah, tambahDiBawah } from '../lib/gabung-isi';
import { KomentarMemo } from './KomentarMemo';
import { TanyaMemo } from './TanyaMemo';
import { FormInternalMemo } from './FormInternalMemo';
import { type DataMemoDinas, MEMO_DINAS_DEFAULT, eksporMemoDinasKeExcel } from '../lib/ekspor-memo-dinas';
import { FormMOM } from './FormMOM';
import { type DataMOM, MOM_DEFAULT, eksporMOMKeWord, eksporMOMKeExcel } from '../lib/ekspor-mom';
import { TampilanNomorSurat } from './TampilanNomorSurat';
import { type ItemSurat, generateNomorSuratOtomatis, hitungLamaHari } from '../lib/tipe-surat';
import {
  muatSurat, simpanSuratKeServer, hapusSuratDiServer,
  muatMemoDinas, simpanMemoDinasKeServer, hapusMemoDinasDiServer,
  muatMom, simpanMomKeServer, hapusMomDiServer,
} from '../lib/dokumen';
import { bacaTema, pasangTema, type Tema } from '../lib/tema';
import { PapanRahasia, PilihOrangRahasia, AvatarIzin, useLayarAman, WatermarkRahasia } from './MemoRahasia';
import { SosialMemo } from './SosialMemo';
import { FolderDokumen, PohonFolder, type ArahFolder } from './FolderDokumen';
import { PenampilBerkas } from './PenampilBerkas';
import { tersemat } from './SidebarMemo';
import { eksporDocxMemo } from '../lib/ekspor-docx-memo';
import { izinMemo } from '../server/src/memo-blok';

/**
 * MEMO — papan "Memo Internal" tim bergaya Notion, plus catatan pribadi.
 * Satu sumber data, beberapa tampilan: Ikhtisar (per kategori), Status,
 * Kategori (daftar), Tabel (semua properti), Pribadi, Internal Memo, Minutes of Meeting (MoM),
 * dan Manajemen Nomor Surat (Internal & Eksternal).
 */

// 'ikhtisar' = papan "Memo Kerja" (id lama dipertahankan agar tab yang tersimpan di perangkat tetap cocok).
type Tab = 'ikhtisar' | 'pribadi' | 'rahasia' | 'internal_memo' | 'mom' | 'nomor_surat' | 'folder' | 'sampah';
type Urut = 'tanggal' | 'judul' | 'diubah';

const KUNCI_TAB = 'pokemonkey_memo_tab';

/** `pendek` = label di layar HP (tab satu baris yang digeser). */
const TAB: { id: Tab; label: string; pendek?: string; ikon: React.ReactElement }[] = [
  { id: 'ikhtisar', label: 'Memo Kerja', ikon: <KanbanSquare size={14} /> },
  // Catatan pribadi tersimpan di server, hanya terlihat oleh akun pemiliknya.
  { id: 'pribadi', label: 'Memo Pribadi', ikon: <Lock size={14} /> },
  // Hanya pembuat dan orang yang dituju (semuanya menyunting); disandikan, tanpa tautan/AI/unduh.
  { id: 'rahasia', label: 'Memo Rahasia', pendek: 'Rahasia', ikon: <ShieldCheck size={14} /> },
  { id: 'internal_memo', label: 'Internal Memo', ikon: <FileText size={14} /> },
  { id: 'mom', label: 'Minutes of Meeting', pendek: 'MoM', ikon: <ClipboardList size={14} /> },
  { id: 'nomor_surat', label: 'Nomor Surat', ikon: <Hash size={14} /> },
  // Dokumen kerja (PDF, Word, Excel, PowerPoint) tim & pribadi, dibaca tanpa unduh.
  { id: 'folder', label: 'Folder Dokumen', pendek: 'Folder', ikon: <FolderOpen size={14} /> },
  // Memo yang dihapus (beserta sub-halamannya) menunggu 30 hari di sini, seperti Trash di Notion.
  { id: 'sampah', label: 'Sampah', ikon: <Trash2 size={14} /> },
];

const BAWAAN: Record<string, string[]> = {
  memo_kategori: ['Revegetasi', 'Nursery', 'Administrasi', 'Operasi & K3'],
  memo_tipe: ['Perubahan Kebijakan', 'Rekap Rapat', 'Pengumuman', 'Pembaruan', 'Keputusan'],
  memo_status: ['Draf', 'Sedang berlangsung', 'Selesai'],
};

const ambilOpsi = (boot: Bootstrap, grup: string): Opsi[] => {
  const ada = boot.opsi.filter((o) => o.grup === grup);
  return ada.length ? ada : BAWAAN[grup].map((nilai, i) => ({ grup, nilai, label: nilai, warna: 'zinc', urutan: i }));
};

const tglMemo = (t: string | null) => {
  if (!t) return '';
  const [y, m, d] = t.slice(0, 10).split('-').map(Number);
  return `${d} ${W.NAMA_BULAN_PENDEK[m - 1]} ${y}`;
};

interface Props {
  boot: Bootstrap;
  pengguna: Pengguna;
  notify: (m: string) => void;
  /** Dari Data Surat: buka RAB RNR yang nomornya tercatat (pindah ke Money Monkey). */
  onBukaRab?: (idRab: string) => void;
  /** Buka PICA yang ditautkan memo (pindah ke tab PICA). */
  onBukaPica?: (idPica: string) => void;
  /** Memo yang diminta dibuka (mis. dari tautan di Kotak Surat). */
  memoAwal?: string | null;
  onMemoAwalTerpakai?: () => void;
}

/** Tab yang menampilkan papan Memo Internal tim (dengan bilah saring/cari/ekspor). */
const TAB_PAPAN: readonly Tab[] = ['ikhtisar'];

export const MemoScreen: React.FC<Props> = ({ boot, pengguna, notify, onBukaRab, onBukaPica, memoAwal, onMemoAwalTerpakai }) => {
  const [tab, setTabState] = useState<Tab>(() => {
    // Tab yang tersimpan bisa jadi sudah tidak ada (Status, Kategori, Tabel, Tugas, Kalender dihapus).
    try { const t = localStorage.getItem(KUNCI_TAB); return TAB.some((x) => x.id === t) ? t as Tab : 'ikhtisar'; } catch { return 'ikhtisar'; }
  });
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem(KUNCI_TAB, t); } catch { /* abaikan */ } };

  // State tema gelap / putih bersih / terang (lapangan)
  const [temaAktif, setTemaAktif] = useState<Tema>(bacaTema);
  const toggleTema = () => {
    const baru: Tema = temaAktif === 'gelap' ? 'putih' : temaAktif === 'putih' ? 'terang' : 'gelap';
    setTemaAktif(baru);
    pasangTema(baru);
    notify(
      baru === 'putih'
        ? 'MODE PUTIH BERSIH AKTIF'
        : baru === 'terang'
          ? 'MODE LAPANGAN AKTIF (REDUKSI SILAU)'
          : 'MODE GELAP AKTIF',
    );
  };

  const [memo, setMemo] = useState<Memo[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [cari, setCari] = useState('');
  const [cariBuka, setCariBuka] = useState(false);
  const [tanyaBuka, setTanyaBuka] = useState(false);
  // HP: tab aktif digeser ke dalam layar (baris tab satu baris yang digeser).
  const tabAktifEl = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { tabAktifEl.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [tab]);
  const [saring, setSaring] = useState({ tipe: '', status: '' });
  const [urut, setUrut] = useState<Urut>('tanggal');
  const [alat, setAlat] = useState<null | 'saring' | 'urut'>(null);
  const [terpilihId, setTerpilihId] = useState<string | null>(null);

  // ---------------------------------------------------------------------
  // Dokumen administrasi (nomor surat, Internal Memo dinas, MoM).
  // Sumbernya server (D1) lewat lib/dokumen.ts; data lama di ponsel ikut
  // dipindahkan sekali saat daftar server masih kosong.
  // ---------------------------------------------------------------------
  const [daftarNomorSurat, setDaftarNomorSurat] = useState<ItemSurat[]>([]);
  const [daftarMemoDinas, setDaftarMemoDinas] = useState<DataMemoDinas[]>([]);
  const [daftarMOM, setDaftarMOM] = useState<DataMOM[]>([]);
  const [memuatDokumen, setMemuatDokumen] = useState(true);
  const [memoDinasAktif, setMemoDinasAktif] = useState<DataMemoDinas | null>(null);
  const [bukaFormDinas, setBukaFormDinas] = useState(false);
  const [momAktif, setMomAktif] = useState<DataMOM | null>(null);
  const [bukaFormMOM, setBukaFormMOM] = useState(false);

  const muatDokumen = useCallback(async () => {
    try {
      const [surat, dinas, mom] = await Promise.all([muatSurat(), muatMemoDinas(), muatMom()]);
      setDaftarNomorSurat(surat);
      setDaftarMemoDinas(dinas);
      setDaftarMOM(mom);
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT DOKUMEN');
    } finally {
      setMemuatDokumen(false);
    }
  }, [notify]);
  useEffect(() => { muatDokumen(); }, [muatDokumen]);

  /** Kirim satu perubahan ke server; bila gagal, daftar disegarkan agar tidak beda dengan server. */
  const kirimDokumen = async (aksi: () => Promise<unknown>, pesanGagal: string) => {
    try { await aksi(); } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : pesanGagal);
      muatDokumen();
    }
  };

  const handleSimpanItemSurat = async (item: ItemSurat, bukaDiMemoDinas?: boolean) => {
    const ada = daftarNomorSurat.some((s) => s.id === item.id);
    setDaftarNomorSurat(ada ? daftarNomorSurat.map((s) => (s.id === item.id ? item : s)) : [item, ...daftarNomorSurat]);
    await kirimDokumen(() => simpanSuratKeServer(item), 'GAGAL MENYIMPAN NOMOR SURAT');
    notify('NOMOR SURAT BERHASIL DISIMPAN');

    if (bukaDiMemoDinas && item.kategori === 'im') {
      handleBukaMemoDinasDariSurat(item);
    }
  };

  const handleHapusItemSurat = async (id: string) => {
    setDaftarNomorSurat(daftarNomorSurat.filter((s) => s.id !== id));
    await kirimDokumen(() => hapusSuratDiServer(id), 'GAGAL MENGHAPUS NOMOR SURAT');
  };

  const handleBukaMemoDinasDariSurat = (item: ItemSurat) => {
    const eksis = daftarMemoDinas.find(
      (m) => (item.internalMemoId && m.id === item.internalMemoId) || m.nomor === item.nomorSurat
    );
    if (eksis) {
      setMemoDinasAktif(eksis);
    } else {
      setMemoDinasAktif({
        ...MEMO_DINAS_DEFAULT,
        id: item.internalMemoId || `memo-dinas-${Date.now()}`,
        nomor: item.nomorSurat,
        namaKaryawan: item.namaYangDitugaskan || '',
        tanggalBerangkat: item.tanggalMulai || W.hariIniWita(),
        tanggalKembali: item.tanggalBerakhir || W.hariIniWita(),
        tempatTujuan: item.tujuanDinas || '',
        keperluan: item.keperluan || item.namaSurat || '',
        dari: item.namaPembuat || MEMO_DINAS_DEFAULT.dari,
        dibuatPada: item.dibuatPada || new Date().toISOString(),
      });
    }
    setBukaFormDinas(true);
  };

  const handleSimpanMemoDinas = async (data: DataMemoDinas) => {
    const id = data.id || `memo-dinas-${Date.now()}`;
    const itemDenganId = { ...data, id, dibuatPada: data.dibuatPada || new Date().toISOString() };
    const ada = daftarMemoDinas.some((m) => m.id === id);
    setDaftarMemoDinas(ada ? daftarMemoDinas.map((m) => (m.id === id ? itemDenganId : m)) : [itemDenganId, ...daftarMemoDinas]);
    setBukaFormDinas(false);
    setMemoDinasAktif(null);
    await kirimDokumen(() => simpanMemoDinasKeServer(itemDenganId), 'GAGAL MENYIMPAN INTERNAL MEMO');

    // Sinkronisasi otomatis ke Manajemen Nomor Surat.
    if (!data.nomor) return;
    const nomorTrim = data.nomor.trim();
    const suratAda = daftarNomorSurat.find((s) => s.nomorSurat === nomorTrim || s.internalMemoId === id);
    const durasi = hitungLamaHari(data.tanggalBerangkat, data.tanggalKembali);

    if (suratAda) {
      const suratBaru: ItemSurat = {
        ...suratAda,
        nomorSurat: nomorTrim,
        namaSurat: data.perihal || suratAda.namaSurat,
        namaYangDitugaskan: data.namaKaryawan || suratAda.namaYangDitugaskan,
        tanggalMulai: data.tanggalBerangkat || suratAda.tanggalMulai,
        tanggalBerakhir: data.tanggalKembali || suratAda.tanggalBerakhir,
        lamaHari: durasi ?? suratAda.lamaHari,
        tujuanDinas: data.tempatTujuan || suratAda.tujuanDinas,
        keperluan: data.keperluan || suratAda.keperluan,
        namaPembuat: data.dari || suratAda.namaPembuat,
        internalMemoId: id,
        diubahPada: new Date().toISOString(),
      };
      setDaftarNomorSurat(daftarNomorSurat.map((s) => (s.id === suratAda.id ? suratBaru : s)));
      await kirimDokumen(() => simpanSuratKeServer(suratBaru), 'GAGAL MENYIMPAN NOMOR SURAT');
    } else {
      const match = nomorTrim.match(/^(\d+)\//);
      const entriSuratBaru: ItemSurat = {
        id: `surat-${Date.now()}`,
        kategori: 'im',
        nomorUrut: match ? parseInt(match[1], 10) : undefined,
        nomorSurat: nomorTrim,
        namaSurat: data.perihal || `Internal Memo - ${data.namaKaryawan}`,
        namaYangDitugaskan: data.namaKaryawan,
        tanggalMulai: data.tanggalBerangkat,
        tanggalBerakhir: data.tanggalKembali,
        lamaHari: durasi,
        tujuanDinas: data.tempatTujuan,
        keperluan: data.keperluan,
        namaPembuat: data.dari,
        internalMemoId: id,
        dibuatPada: new Date().toISOString(),
      };
      setDaftarNomorSurat([entriSuratBaru, ...daftarNomorSurat]);
      await kirimDokumen(() => simpanSuratKeServer(entriSuratBaru), 'GAGAL MENYIMPAN NOMOR SURAT');
    }
  };

  const handleHapusMemoDinas = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Hapus dokumen Internal Memo ini?')) return;
    setDaftarMemoDinas(daftarMemoDinas.filter((m) => m.id !== id));
    await kirimDokumen(() => hapusMemoDinasDiServer(id), 'GAGAL MENGHAPUS INTERNAL MEMO');
    notify('INTERNAL MEMO DIHAPUS');
  };

  const buatMemoDinasBaru = () => {
    // Nomor otomatis mengikuti daftar nomor surat yang ada di server.
    const gen = generateNomorSuratOtomatis('im', daftarNomorSurat, W.hariIniWita());
    setMemoDinasAktif({
      ...MEMO_DINAS_DEFAULT,
      id: `memo-dinas-${Date.now()}`,
      nomor: gen.nomorSurat,
      tanggalBerangkat: W.hariIniWita(),
      tanggalKembali: W.hariIniWita(),
      dibuatPada: new Date().toISOString(),
    });
    setBukaFormDinas(true);
  };

  const handleSimpanMOM = async (data: DataMOM) => {
    const id = data.id || `mom-${Date.now()}`;
    const itemDenganId = { ...data, id, dibuatPada: data.dibuatPada || new Date().toISOString() };
    const ada = daftarMOM.some((m) => m.id === id);
    setDaftarMOM(ada ? daftarMOM.map((m) => (m.id === id ? itemDenganId : m)) : [itemDenganId, ...daftarMOM]);
    setBukaFormMOM(false);
    setMomAktif(null);
    await kirimDokumen(() => simpanMomKeServer(itemDenganId), 'GAGAL MENYIMPAN MINUTES OF MEETING');
  };

  const handleHapusMOM = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm('Hapus dokumen Minutes of Meeting ini?')) return;
    setDaftarMOM(daftarMOM.filter((m) => m.id !== id));
    await kirimDokumen(() => hapusMomDiServer(id), 'GAGAL MENGHAPUS MINUTES OF MEETING');
    notify('MINUTES OF MEETING DIHAPUS');
  };

  const buatMOMBaru = () => {
    setMomAktif({
      ...MOM_DEFAULT,
      id: `mom-${Date.now()}`,
      tanggal: W.hariIniWita(),
      dibuatPada: new Date().toISOString(),
    });
    setBukaFormMOM(true);
  };

  const kategori = useMemo(() => ambilOpsi(boot, 'memo_kategori'), [boot]);
  const tipe = useMemo(() => ambilOpsi(boot, 'memo_tipe'), [boot]);
  const status = useMemo(() => ambilOpsi(boot, 'memo_status'), [boot]);
  const bolehBuat = pengguna.peran !== 'pemantau';
  const kelola = pengguna.peran === 'admin' || pengguna.peran === 'supervisor';

  // Catatan pribadi dimuat di sini juga, supaya Tugas dan Kalender mencakup keduanya.
  const [memoPribadi, setMemoPribadi] = useState<Memo[]>([]);
  const [memuatPribadi, setMemuatPribadi] = useState(true);
  // Memo rahasia yang boleh saya buka (pembuat atau orang yang dituju).
  const [memoRahasia, setMemoRahasia] = useState<Memo[]>([]);
  const [memuatRahasia, setMemuatRahasia] = useState(true);
  const [sandiRahasia, setSandiRahasia] = useState<boolean | null>(null);
  // Folder Dokumen: null = tertutup; arah = folder yang dibuka (dari pohon folder atau tab).
  const [folderBuka, setFolderBuka] = useState<ArahFolder | null>(null);
  const [muatUlangFolder, setMuatUlangFolder] = useState(0);
  const [pilihRahasiaBuka, setPilihRahasiaBuka] = useState(false);
  const [propertiMemo, setPropertiMemo] = useState<DefProperti[]>(boot.propertiMemo ?? []);
  useEffect(() => { setPropertiMemo(boot.propertiMemo ?? []); }, [boot.propertiMemo]);

  const muat = useCallback(async () => {
    try {
      const d = await api<{ memo: Memo[] }>('/api/memo?lingkup=tim');
      setMemo(d.memo);
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT MEMO');
    } finally {
      setMemuat(false);
    }
    try {
      const d = await api<{ memo: Memo[] }>('/api/memo?lingkup=pribadi');
      setMemoPribadi(d.memo);
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT CATATAN');
    } finally {
      setMemuatPribadi(false);
    }
    try {
      const d = await api<{ memo: Memo[]; sandi?: boolean }>('/api/memo?lingkup=rahasia');
      setMemoRahasia(d.memo);
      setSandiRahasia(d.sandi ?? null);
    } catch { /* server lama tanpa memo rahasia: biarkan kosong */ }
    finally { setMemuatRahasia(false); }
  }, [notify]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => {
    if (!memoAwal || memuat || memuatPribadi || memuatRahasia) return;
    if ([...memo, ...memoPribadi, ...memoRahasia].some((m) => m.id === memoAwal)) setTerpilihId(memoAwal);
    else notify('MEMO TIDAK DITEMUKAN ATAU ANDA TIDAK PUNYA AKSES');
    onMemoAwalTerpakai?.();
  }, [memoAwal, memuat, memuatPribadi, memuatRahasia]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Perubahan satu memo (tim atau pribadi) di daftar yang tampil. */
  const perbaruiDimana = useCallback((id: string, patch: Partial<Memo>) => {
    const ganti = (d: Memo[]) => (d.some((x) => x.id === id) ? d.map((x) => (x.id === id ? { ...x, ...patch } : x)) : d);
    setMemo(ganti);
    setMemoPribadi(ganti);
    setMemoRahasia(ganti);
  }, []);

  // Perubahan yang tertahan karena sinyal hilang dikirim ulang sendiri.
  useEffect(() => pasangPengirimTertunda((id, patch) => {
    perbaruiDimana(id, patch as Partial<Memo>);
    notify('PERUBAHAN MEMO TERKIRIM');
  }), [perbaruiDimana, notify]);

  const muatPropertiMemo = async () => {
    try { const b = await api<Bootstrap>('/api/bootstrap'); setPropertiMemo(b.propertiMemo ?? []); } catch { /* biarkan */ }
  };

  // Papan hanya berisi halaman teratas; sub-halaman tampil di dalam induknya dan di sidebar (seperti Notion).
  const memoAtas = useMemo(() => memo.filter((m) => !m.induk_id), [memo]);
  const pribadiAtas = useMemo(() => memoPribadi.filter((m) => !m.induk_id), [memoPribadi]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return memoAtas
      .filter((m) => (!q || `${m.judul} ${m.ringkasan ?? ''} ${m.isi}`.toLowerCase().includes(q))
        && (!saring.tipe || m.tipe === saring.tipe)
        && (!saring.status || m.status === saring.status))
      .sort((a, b) => (Number(tersemat(b)) - Number(tersemat(a))) || (urut === 'judul'
        ? a.judul.localeCompare(b.judul)
        : urut === 'diubah'
          ? String(b.diubah_pada ?? b.dibuat_pada).localeCompare(String(a.diubah_pada ?? a.dibuat_pada))
          : String(b.tanggal ?? b.dibuat_pada).localeCompare(String(a.tanggal ?? a.dibuat_pada))));
  }, [memoAtas, cari, saring, urut]);

  const buat = async (awal: { kategori?: string | null; status?: string | null } = {}) => {
    const body = {
      lingkup: 'tim',
      judul: '',
      isi: '',
      ringkasan: '',
      // Halaman baru bersih: properti hanya terisi bila dibuat dari kolom papan (kategori) atau ditambah lewat "/".
      kategori: awal.kategori ?? null,
      tipe: null,
      status: awal.status ?? null,
      tanggal: W.hariIniWita(),
      // Halaman baru langsung bersampul, seperti Notion; bisa diganti atau dihapus.
      props: JSON.stringify({ sampul: SAMPUL_BAWAAN }),
    };
    try {
      const d = await api<{ id: string }>('/api/memo', { body });
      const baru: Memo = {
        id: d.id, user_id: pengguna.id, penulis: pengguna.nama, lingkup: 'tim', judul: '', isi: '', ringkasan: '', akses: 'edit',
        kategori: body.kategori, tipe: null, status: body.status, tanggal: body.tanggal,
        disematkan: 0, warna: null, props: body.props, dibuat_pada: new Date().toISOString(), diubah_pada: null,
      };
      setMemo((m) => [baru, ...m]);
      setTerpilihId(d.id);
      if (!TAB_PAPAN.includes(tab) && !terpilihId) setTab('ikhtisar');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT MEMO');
    }
  };

  /** Catatan pribadi baru (dari tab Pribadi atau sidebar halaman), bersampul bawaan dan boleh bertemplat. */
  const buatPribadi = async (t: { judul: string; isi: string; ikon?: string } = { judul: '', isi: '' }) => {
    const props = JSON.stringify({ sampul: SAMPUL_BAWAAN, ...(t.ikon ? { ikon: t.ikon } : {}) });
    try {
      const d = await api<{ id: string }>('/api/memo', { body: { lingkup: 'pribadi', judul: t.judul, isi: t.isi, props } });
      const baru: Memo = {
        id: d.id, user_id: pengguna.id, lingkup: 'pribadi', judul: t.judul, isi: t.isi, ringkasan: null, kategori: null, tipe: null,
        status: null, tanggal: null, disematkan: 0, warna: null, props, dibuat_pada: new Date().toISOString(), diubah_pada: null,
      };
      setMemoPribadi((x) => [baru, ...x]);
      setTerpilihId(d.id);
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT CATATAN'); }
  };

  /** Memo rahasia baru untuk orang yang dituju (semuanya bisa menyunting), lalu dibuka. */
  const buatRahasia = async (izin: string[]) => {
    const props = JSON.stringify({ sampul: SAMPUL_BAWAAN, ikon: '🔒' });
    try {
      const d = await api<{ id: string; izin: string[] | null }>('/api/memo', { body: { lingkup: 'rahasia', judul: '', isi: '', props, izin } });
      const baru: Memo = {
        id: d.id, user_id: pengguna.id, penulis: pengguna.nama, lingkup: 'rahasia', izin: JSON.stringify(d.izin ?? izin), judul: '', isi: '', ringkasan: null,
        kategori: null, tipe: null, status: null, tanggal: null, disematkan: 0, warna: null, props, dibuat_pada: new Date().toISOString(), diubah_pada: null,
      };
      setMemoRahasia((x) => [baru, ...x]);
      setTerpilihId(d.id);
      if (sandiRahasia === false) notify('MEMO RAHASIA DIBUAT — KUNCI SANDI SERVER BELUM DIPASANG');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT MEMO RAHASIA'); }
  };

  /**
   * Sub-halaman baru di dalam `induk` (blok "Halaman" di menu "/" atau "+" di sidebar).
   * `tambahBlok`: blok halamannya ditambahkan di akhir isi induk (dari sidebar, induk sedang tidak dibuka).
   */
  const buatAnak = async (induk: Memo, tambahBlok: boolean): Promise<Memo | null> => {
    const props = JSON.stringify({ sampul: SAMPUL_BAWAAN });
    try {
      const d = await api<{ id: string; lingkup: 'tim' | 'pribadi' | 'rahasia'; akses: 'edit' | 'baca'; izin?: string[] | null }>('/api/memo', {
        body: { lingkup: induk.lingkup, induk_id: induk.id, judul: '', isi: '', props },
      });
      const baru: Memo = {
        id: d.id, user_id: pengguna.id, penulis: pengguna.nama, lingkup: d.lingkup, judul: '', isi: '', ringkasan: null,
        kategori: null, tipe: null, status: null, tanggal: d.lingkup === 'tim' ? W.hariIniWita() : null, disematkan: 0, warna: null,
        props, akses: d.akses, induk_id: induk.id, dibuat_pada: new Date().toISOString(), diubah_pada: null,
        izin: d.izin ? JSON.stringify(d.izin) : null,
      };
      (baru.lingkup === 'tim' ? setMemo : baru.lingkup === 'rahasia' ? setMemoRahasia : setMemoPribadi)((x) => [baru, ...x]);
      if (tambahBlok) {
        const blok = `[[memo:${baru.id}|Tanpa judul]]`;
        const isiBaru = induk.isi.trim() ? `${induk.isi.replace(/\s+$/, '')}\n${blok}` : blok;
        perbaruiDimana(induk.id, { isi: isiBaru });
        try { await patchMemo(induk.id, { isi: isiBaru }); } catch { /* sub-halaman tetap ada di sidebar */ }
      }
      return baru;
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT SUB-HALAMAN');
      return null;
    }
  };
  const bolehAnak = useCallback((m: Memo) => {
    const hak = hakMemo(m, pengguna);
    return hak === 'penuh' || hak === 'edit';
  }, [pengguna]);


  const terpilih = memo.find((m) => m.id === terpilihId) ?? memoPribadi.find((m) => m.id === terpilihId) ?? memoRahasia.find((m) => m.id === terpilihId) ?? null;
  const adaSaring = Boolean(saring.tipe || saring.status || cari);

  // Ekspor Excel seperti tab yang dibuka: Tabel = tabel biasa; Ikhtisar/Kategori/Status = dikelompokkan dengan judul berwarna.
  const [mengekspor, setMengekspor] = useState(false);
  const eksporExcel = async () => {
    if (!tersaring.length) { notify('TIDAK ADA MEMO UNTUK DIEKSPOR'); return; }
    setMengekspor(true);
    try {
      const wb = await bukuBaru();
      const labelTab = TAB.find((t) => t.id === tab)?.label ?? tab;
      const k = lembarBaru(wb, 'Memo', {
        judul: `Memo Internal · ${labelTab}`,
        keterangan: [
          `${tersaring.length} memo`,
          saring.tipe && `Tipe: ${tipe.find((o) => o.nilai === saring.tipe)?.label ?? saring.tipe}`,
          saring.status && `Status: ${status.find((o) => o.nilai === saring.status)?.label ?? saring.status}`,
          cari.trim() && `Cari: "${cari.trim()}"`,
        ].filter(Boolean).join(' · '),
        kolom: [
          { judul: 'Judul', lebar: 36, bungkus: true }, { judul: 'Kategori', lebar: 16 }, { judul: 'Tipe', lebar: 20 }, { judul: 'Status', lebar: 18 },
          { judul: 'Tanggal', lebar: 12 }, { judul: 'Penulis', lebar: 18 }, { judul: 'Ringkasan', lebar: 48, bungkus: true }, { judul: 'Isi', lebar: 70, bungkus: true },
        ],
      });
      const cari_ = (opsi: Opsi[], n: string | null) => opsi.find((o) => o.nilai === n);
      const tulis = (m: Memo) => {
        const row = k.tambah([
          m.judul || 'Tanpa judul', cari_(kategori, m.kategori)?.label ?? m.kategori ?? '', cari_(tipe, m.tipe)?.label ?? m.tipe ?? '',
          cari_(status, m.status)?.label ?? m.status ?? '', tanggalExcel(m.tanggal), m.penulis ?? '', m.ringkasan ?? '', m.isi.slice(0, 32000),
        ]);
        row.getCell(1).font = { ...row.getCell(1).font, bold: true };
        row.getCell(5).numFmt = FORMAT_TANGGAL;
        if (m.kategori) gayakanChip(row.getCell(2), cari_(kategori, m.kategori)?.warna);
        if (m.tipe) gayakanChip(row.getCell(3), 'zinc', { tebal: false });
        if (m.status) gayakanChip(row.getCell(4), cari_(status, m.status)?.warna);
      };

      // Seperti papan Memo Kerja: dikelompokkan per kategori (kolom kosong tetap tampil, kecuali "Tanpa kategori").
      const grup = [...kategori.map((o) => ({ nilai: o.nilai, label: o.label, warna: o.warna })), { nilai: '', label: 'Tanpa kategori', warna: 'zinc' }];
      grup.forEach((g) => {
        const isi = tersaring.filter((m) => (m.kategori ?? '') === g.nilai);
        if (!isi.length && g.nilai === '') return;
        k.kelompok(`${g.label} · ${isi.length} memo`, g.warna);
        isi.forEach(tulis);
      });

      await simpanBuku(wb, `Memo-${labelTab}-${W.hariIniWita()}.xlsx`, 'Ekspor memo');
      notify(`${tersaring.length} MEMO DIEKSPOR`);
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'EKSPOR GAGAL'); }
    finally { setMengekspor(false); }
  };

  // Unduh gambar: hanya tampilan (tab) yang sedang dibuka, dengan saringan yang berlaku.
  const areaIsi = useRef<HTMLDivElement>(null);
  const [mengunduh, setMengunduh] = useState(false);
  const unduh = async () => {
    if (!areaIsi.current || mengunduh) return;
    const labelTab = TAB.find((t) => t.id === tab)?.label ?? tab;
    const keterangan = [
      `${tersaring.length} memo`,
      saring.tipe && `Tipe: ${tipe.find((o) => o.nilai === saring.tipe)?.label ?? saring.tipe}`,
      saring.status && `Status: ${status.find((o) => o.nilai === saring.status)?.label ?? saring.status}`,
      cari.trim() && `Cari: "${cari.trim()}"`,
    ].filter(Boolean).join(' · ');
    setMengunduh(true);
    try {
      const hasil = await unduhGambar(areaIsi.current, { nama: `memo-${tab}-${W.hariIniWita()}`, judul: `Memo Internal · ${labelTab}`, keterangan });
      notify(hasil === 'diunduh' ? 'GAMBAR DIUNDUH' : 'GAMBAR SIAP DIBAGIKAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT GAMBAR'); }
    finally { setMengunduh(false); }
  };

  return (
    <KonteksGambarMemo.Provider value={{ kategori, tipe, status, pengunduh: pengguna.nama, notify, tim: boot.tim, properti: propertiMemo }}>
    <div className="flex flex-col h-full overflow-hidden">
      {/* ---------- Kepala ---------- */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-lime-500 border-[3px] border-black flex items-center justify-center shrink-0 shadow-[3px_3px_0_#000]">
              <NotebookPen size={20} className="text-black" />
            </div>
            <div>
              <h2 className="font-title text-[15px] md:text-[20px] text-white leading-tight">Memo &amp; Surat</h2>
              <p className="hidden sm:block text-[11px] text-zinc-400">Arsip memo internal, MoM, dan penomoran surat resmi</p>
            </div>
          </div>

          <button
            onClick={toggleTema}
            className={`btn-retro btn-retro-sm flex items-center gap-1.5 text-[11px] shadow-[2px_2px_0_#000] ${
              temaAktif === 'putih'
                ? '!bg-white !text-zinc-900 !border-zinc-400'
                : '!bg-zinc-800 hover:!bg-zinc-700 text-zinc-200'
            }`}
            title={
              temaAktif === 'gelap'
                ? 'Ganti ke Mode Putih Bersih'
                : temaAktif === 'putih'
                  ? 'Ganti ke Mode Lapangan'
                  : 'Ganti ke Mode Gelap'
            }
          >
            {temaAktif === 'gelap' ? (
              <Moon size={13} className="text-indigo-400" />
            ) : temaAktif === 'putih' ? (
              <Sun size={13} className="text-amber-500 fill-amber-400" />
            ) : (
              <Sun size={13} className="text-emerald-400" />
            )}
            <span className="hidden sm:inline font-mono font-bold">
              {temaAktif === 'putih'
                ? 'Putih Bersih'
                : temaAktif === 'terang'
                  ? 'Mode Lapangan'
                  : 'Mode Gelap'}
            </span>
          </button>
        </div>
        {/* Baris 2: Tab Navigasi Utama (Tepat di bawah Judul). Di HP satu baris yang digeser, agar papan tidak terdesak. */}
        <div className="flex flex-nowrap overflow-x-auto tanpa-scrollbar sm:flex-wrap gap-1 border-b-4 border-white pb-2 mb-2">
          {TAB.map((t) => (
            <button
              key={t.id}
              ref={tab === t.id ? tabAktifEl : undefined}
              onClick={() => setTab(t.id)}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-bold border-2 transition-colors ${
                tab === t.id ? 'bg-lime-600 border-white text-white shadow-[2px_2px_0_#000]' : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              {t.ikon}
              {t.pendek ? <><span className="sm:hidden">{t.pendek}</span><span className="hidden sm:inline">{t.label}</span></> : t.label}
            </button>
          ))}
        </div>

        {/* Baris 3: Toolbar Khusus Menu Memo Internal (Ikhtisar, Status, Kategori, Tabel) */}
        {TAB_PAPAN.includes(tab) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              {bolehBuat && (
                <button
                  onClick={() => buat()}
                  className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-white font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-[2px_2px_0_#000]"
                >
                  <Plus size={12} /> <span className="sm:hidden">Baru</span><span className="hidden sm:inline">Entri baru</span>
                </button>
              )}
              <button
                onClick={() => setTanyaBuka(true)}
                className="btn-retro btn-retro-sm !bg-purple-700 hover:!bg-purple-600 !text-white font-bold flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-[2px_2px_0_#000]"
                title="Tanya semua memo dengan AI"
              >
                <Sparkles size={12} /> Tanya AI
              </button>

              <div className="flex items-center gap-1 shrink-0 relative ml-auto">
                <button onClick={() => setAlat(alat === 'saring' ? null : 'saring')} className={`btn-ikon !w-8 !h-8 ${saring.tipe || saring.status ? 'bg-lime-600' : 'bg-zinc-800'}`} title="Saring"><ListFilter size={14} /></button>
                <button onClick={() => setAlat(alat === 'urut' ? null : 'urut')} className="btn-ikon !w-8 !h-8 bg-zinc-800" title="Urutkan"><ArrowUpDown size={14} /></button>
                <button onClick={() => setCariBuka((v) => !v)} className={`btn-ikon !w-8 !h-8 ${cari ? 'bg-lime-600' : 'bg-zinc-800'}`} title="Cari"><Search size={14} /></button>
                <button onClick={unduh} disabled={mengunduh || memuat} className="btn-ikon !w-8 !h-8 bg-zinc-800" title="Unduh gambar tampilan ini">{mengunduh ? <Loader2 size={14} className="animate-spin" /> : <ImageDown size={14} />}</button>
                <button onClick={eksporExcel} disabled={mengekspor || memuat} className="btn-ikon !w-8 !h-8 bg-emerald-700" title="Ekspor ke Excel">{mengekspor ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}</button>

                {alat === 'saring' && (
                  <div className="absolute right-0 top-full mt-2 z-30 retro-box !bg-zinc-900 border-lime-500 !p-3 w-60 space-y-2">
                    <div><label className="label-retro">Tipe</label>
                      <select value={saring.tipe} onChange={(e) => setSaring({ ...saring, tipe: e.target.value })} className="input-retro !py-1.5 !text-[13px]">
                        <option value="">Semua tipe</option>{tipe.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
                      </select></div>
                    <div><label className="label-retro">Status</label>
                      <select value={saring.status} onChange={(e) => setSaring({ ...saring, status: e.target.value })} className="input-retro !py-1.5 !text-[13px]">
                        <option value="">Semua status</option>{status.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
                      </select></div>
                    <button onClick={() => { setSaring({ tipe: '', status: '' }); setAlat(null); }} className="btn-retro btn-retro-sm bg-zinc-700 w-full">Hapus saringan</button>
                  </div>
                )}
                {alat === 'urut' && (
                  <div className="absolute right-0 top-full mt-2 z-30 retro-box !bg-zinc-900 border-lime-500 !p-1 w-48">
                    {([['tanggal', 'Tanggal memo'], ['diubah', 'Terakhir diubah'], ['judul', 'Judul A–Z']] as const).map(([k, label]) => (
                      <button key={k} onClick={() => { setUrut(k); setAlat(null); }} className={`block w-full text-left px-2 py-1.5 text-[13px] ${urut === k ? 'bg-lime-600 text-white' : 'hover:bg-white/10'}`}>{label}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {cariBuka && (
              <div className="relative mb-2">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input autoFocus value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari judul, ringkasan, isi…" className="input-retro !pl-8 !py-1.5 !text-[13px]" />
              </div>
            )}
            {adaSaring && (
              <p className="text-[12px] text-zinc-400 mb-1">{tersaring.length} dari {memoAtas.length} memo</p>
            )}
          </div>
        )}
      </div>

      {/* ---------- Isi ---------- */}
      <div ref={areaIsi} data-gambar-lepas className="flex-1 min-h-0 overflow-hidden px-3 pb-3" onClick={() => setAlat(null)}>
        {memuat && TAB_PAPAN.includes(tab) && <p className="text-[13px] text-zinc-400 flex items-center gap-2 py-8 justify-center"><Loader2 size={14} className="animate-spin" /> Memuat…</p>}

        {!memuat && tab === 'ikhtisar' && (
          <Papan daftar={tersaring} kolom={kategori} kunci="kategori" tipe={tipe} status={status} onBuka={setTerpilihId} onBaru={bolehBuat ? (nilai) => buat({ kategori: nilai || null }) : undefined} />
        )}
        {tab === 'pribadi' && (
          <CatatanPribadi
            daftar={pribadiAtas}
            memuat={memuatPribadi}
            onBuka={setTerpilihId}
            onBuat={buatPribadi}
            notify={notify}
          />
        )}
        {tab === 'folder' && (
          <div className="h-full overflow-auto custom-scrollbar">
            <div className="max-w-xl retro-box !bg-zinc-900/80 border-amber-500/60 !p-3">
              <p className="text-[12px] text-zinc-300 mb-2 leading-relaxed">
                Dokumen kerja tim & pribadi — PDF, Word, Excel, PowerPoint — tersimpan di server dan bisa dibaca tanpa diunduh.
                Ketuk folder untuk membuka isinya; <b className="text-white">+</b> untuk membuat sub-folder.
              </p>
              <PohonFolder pengguna={pengguna} notify={notify} muatUlang={muatUlangFolder} onBuka={setFolderBuka} />
              <button type="button" onClick={() => setTab('sampah')} className="mt-1 flex items-center gap-2 px-2 h-7 text-[13px] text-zinc-400 hover:text-white">
                <Trash2 size={14} /> Sampah · 30 hari
              </button>
            </div>
          </div>
        )}
        {tab === 'rahasia' && (
          <PapanRahasia
            daftar={memoRahasia}
            memuat={memuatRahasia}
            sandi={sandiRahasia}
            tim={boot.tim}
            pengguna={pengguna}
            onBuka={setTerpilihId}
            onBuat={(izin) => { void buatRahasia(izin); }}
          />
        )}
        {tab === 'sampah' && (
          <SampahMemo
            tim={boot.tim}
            notify={notify}
            onPulih={(id, buka) => { void muat().then(() => { if (buka) setTerpilihId(id); }); }}
          />
        )}
        {memuatDokumen && (tab === 'internal_memo' || tab === 'mom' || tab === 'nomor_surat') && (
          <p className="text-[13px] text-zinc-400 flex items-center gap-2 py-8 justify-center"><Loader2 size={14} className="animate-spin" /> Memuat dokumen dari server…</p>
        )}
        {!memuatDokumen && tab === 'internal_memo' && (
          <TampilanInternalMemo
            daftar={daftarMemoDinas}
            onBuka={(item) => {
              setMemoDinasAktif(item);
              setBukaFormDinas(true);
            }}
            onBaru={buatMemoDinasBaru}
            onHapus={handleHapusMemoDinas}
            notify={notify}
          />
        )}
        {!memuatDokumen && tab === 'mom' && (
          <TampilanMOM
            daftar={daftarMOM}
            onBuka={(item) => {
              setMomAktif(item);
              setBukaFormMOM(true);
            }}
            onBaru={buatMOMBaru}
            onHapus={handleHapusMOM}
            notify={notify}
          />
        )}
        {!memuatDokumen && tab === 'nomor_surat' && (
          <TampilanNomorSurat
            daftar={daftarNomorSurat}
            onSimpanItem={handleSimpanItemSurat}
            onHapusItem={handleHapusItemSurat}
            onBukaMemoDinasDariSurat={handleBukaMemoDinasDariSurat}
            onBukaRab={onBukaRab}
            notify={notify}
          />
        )}
      </div>

      {terpilih && (
        <LembarMemo
          key={terpilih.id}
          memo={terpilih}
          boleh={hakMemo(terpilih, pengguna) === 'penuh' || hakMemo(terpilih, pengguna) === 'edit'}
          penuh={hakMemo(terpilih, pengguna) === 'penuh'}
          idSaya={pengguna.id}
          kelola={kelola}
          kategori={kategori}
          tipe={tipe}
          status={status}
          tim={boot.tim}
          properti={propertiMemo}
          onPropertiBaru={muatPropertiMemo}
          onBukaPica={onBukaPica ? (id) => { setTerpilihId(null); onBukaPica(id); } : undefined}
          onUbah={(patch) => {
            perbaruiDimana(terpilih.id, patch);
            // Judul berubah: label blok halaman / tautan di memo lain ikut (server melakukan hal yang sama).
            const j = patch.judul;
            if (typeof j === 'string') {
              const ganti = (d: Memo[]) => d.map((x) => { const isi = gantiLabelHalaman(x.isi, terpilih.id, j); return isi === x.isi ? x : { ...x, isi }; });
              setMemo(ganti);
              setMemoPribadi(ganti);
            }
          }}
          onHapus={() => {
            const id = terpilih.id;
            // Sub-halamannya ikut pindah ke Sampah.
            const buang = new Set(pohonMemo([...memo, ...memoPribadi, ...memoRahasia], id).map((x) => x.id));
            setMemo((m) => m.filter((x) => !buang.has(x.id)));
            setMemoPribadi((m) => m.filter((x) => !buang.has(x.id)));
            setMemoRahasia((m) => m.filter((x) => !buang.has(x.id)));
            // Saat pindah halaman lewat sidebar, halaman kosong yang ditinggal ikut dibuang tanpa menutup halaman tujuan.
            setTerpilihId((t) => (t === id ? null : t));
          }}
          onTutup={() => setTerpilihId(null)}
          notify={notify}
          memoTim={memo}
          memoPribadi={memoPribadi}
          memoRahasia={memoRahasia}
          sandiRahasia={sandiRahasia}
          namaSaya={pengguna.nama}
          bolehBuatTim={bolehBuat}
          onPindah={setTerpilihId}
          onBaru={(l) => { if (l === 'tim') void buat(); else if (l === 'rahasia') setPilihRahasiaBuka(true); else void buatPribadi(); }}
          onFolder={(arah) => setFolderBuka(arah ?? { lingkup: 'tim', folder: null })}
          muatUlangFolder={muatUlangFolder}
          onBuatAnak={buatAnak}
          bolehAnak={bolehAnak}
          onSampah={() => { setTerpilihId(null); setTab('sampah'); }}
        />
      )}

      {tanyaBuka && (
        <TanyaMemo
          memo={[...memo, ...memoPribadi]}
          tim={boot.tim}
          onBuka={(id) => { setTanyaBuka(false); setTerpilihId(id); }}
          onTutup={() => setTanyaBuka(false)}
        />
      )}
      {folderBuka && (
        <FolderDokumen
          key={`${folderBuka.lingkup}:${folderBuka.folder ?? ''}`}
          pengguna={pengguna}
          notify={notify}
          awal={folderBuka}
          onBerubah={() => setMuatUlangFolder((n) => n + 1)}
          onTutup={() => setFolderBuka(null)}
        />
      )}
      {pilihRahasiaBuka && (
        <PilihOrangRahasia
          tim={boot.tim}
          pengguna={pengguna}
          onTutup={() => setPilihRahasiaBuka(false)}
          onSimpan={(ids) => { setPilihRahasiaBuka(false); setTerpilihId(null); void buatRahasia(ids); }}
        />
      )}

      {bukaFormDinas && (
        <FormInternalMemo
          initialData={memoDinasAktif ?? MEMO_DINAS_DEFAULT}
          daftarSurat={daftarNomorSurat}
          onSimpan={handleSimpanMemoDinas}
          onTutup={() => {
            setBukaFormDinas(false);
            setMemoDinasAktif(null);
          }}
          notify={notify}
        />
      )}

      {bukaFormMOM && (
        <FormMOM
          initialData={momAktif ?? MOM_DEFAULT}
          onSimpan={handleSimpanMOM}
          onTutup={() => {
            setBukaFormMOM(false);
            setMomAktif(null);
          }}
          notify={notify}
        />
      )}
    </div>
    </KonteksGambarMemo.Provider>
  );
};

// ============================================================
// Unduh satu memo sebagai gambar poster
// ============================================================

/** Opsi kategori/tipe/status + nama pengunduh, dipakai tombol unduh gambar di kartu dan lembar memo. */
const KonteksGambarMemo = React.createContext<{
  kategori: Opsi[]; tipe: Opsi[]; status: Opsi[]; pengunduh: string; notify: (m: string) => void;
  /** Nama anggota (chip @orang) dan kolom properti kustom, supaya gambar memuat semua properti. */
  tim: AnggotaRingkas[]; properti: DefProperti[];
} | null>(null);

type MemoUntukGambar = Pick<Memo, 'judul' | 'isi' | 'ringkasan' | 'kategori' | 'tipe' | 'status' | 'tanggal' | 'penulis' | 'lingkup' | 'props' | 'pica_id' | 'pica_no' | 'pica_judul' | 'induk_id'>;

const KUNCI_GAYA_GAMBAR = 'pokemonkey_memo_gaya_gambar';
const KUNCI_UKURAN_GAMBAR = 'pokemonkey_memo_ukuran_gambar';

/**
 * Tombol gambar memo: pilih gaya (Retro gelap / Retro terang / Resmi — pilihan
 * terakhir diingat), lalu Unduh atau Bagikan ke WhatsApp. Memo lengkap jadi satu PNG.
 */
const TombolGambarMemo: React.FC<{ memo: MemoUntukGambar; kecil?: boolean }> = ({ memo, kecil }) => {
  const ctx = React.useContext(KonteksGambarMemo);
  const [buka, setBuka] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [gaya, setGayaState] = useState<GayaGambarMemo>(() => {
    try {
      const g = localStorage.getItem(KUNCI_GAYA_GAMBAR);
      return GAYA_GAMBAR_MEMO.some((x) => x.id === g) ? (g as GayaGambarMemo) : 'retro-gelap';
    } catch { return 'retro-gelap'; }
  });
  // Ukuran: Otomatis = komputer → lebar seperti di monitor, HP → tegak. Pilihan terakhir diingat.
  const [ukuran, setUkuranState] = useState<'otomatis' | UkuranGambarMemo>(() => {
    try {
      const u = localStorage.getItem(KUNCI_UKURAN_GAMBAR);
      return u === 'hp' || u === 'komputer' ? u : 'otomatis';
    } catch { return 'otomatis'; }
  });
  if (!ctx) return null;
  const setGaya = (g: GayaGambarMemo) => { setGayaState(g); try { localStorage.setItem(KUNCI_GAYA_GAMBAR, g); } catch { /* abaikan */ } };
  const setUkuran = (u: 'otomatis' | UkuranGambarMemo) => { setUkuranState(u); try { localStorage.setItem(KUNCI_UKURAN_GAMBAR, u); } catch { /* abaikan */ } };
  const ukuranUnduh: UkuranGambarMemo = ukuran === 'otomatis' ? (layarKomputer() ? 'komputer' : 'hp') : ukuran;
  const chip = (nilai: string | null, opsi: Opsi[]) => {
    if (!nilai) return null;
    const o = opsi.find((x) => x.nilai === nilai);
    return { label: o?.label ?? nilai, warna: o?.warna };
  };
  const jalankan = async (aksi: 'unduh' | 'bagikan') => {
    setBuka(false);
    setSibuk(true);
    // Semua yang tampil di halaman memo ikut: sampul, ikon, PICA, dan properti kustom yang terisi.
    const p = bacaProps(memo);
    const properti = [
      ...(memo.pica_id ? [{ label: 'PICA', nilai: `${memo.pica_no ? `PICA-${String(memo.pica_no).padStart(3, '0')} · ` : ''}${memo.pica_judul ?? ''}` }] : []),
      ...(memo.lingkup === 'tim' && !memo.induk_id ? ctx.properti.map((d) => ({ label: d.label, nilai: teksNilai(d, p[d.id], ctx.tim) })) : []),
    ];
    const data = {
      judul: memo.judul, ringkasan: memo.ringkasan, isi: memo.isi, tanggal: tglMemo(memo.tanggal), penulis: memo.penulis,
      kategori: chip(memo.kategori, ctx.kategori), tipe: chip(memo.tipe, ctx.tipe), status: chip(memo.status, ctx.status),
      jenis: memo.lingkup === 'pribadi' ? 'Catatan Pribadi' : 'Memo Internal', pengunduh: ctx.pengunduh,
      ikon: typeof p.ikon === 'string' ? p.ikon : undefined, sampul: typeof p.sampul === 'string' ? p.sampul : undefined,
      properti, tim: ctx.tim,
    };
    try {
      if (aksi === 'unduh') {
        const hasil = await unduhGambarMemo(data, gaya, ukuranUnduh);
        ctx.notify(hasil === 'diunduh' ? 'GAMBAR MEMO DIUNDUH' : 'GAMBAR MEMO SIAP DISIMPAN / DIBAGIKAN');
      } else {
        // WhatsApp dibaca di HP: selalu format tegak (gambar lebar diperkecil, tulisannya terlalu kecil).
        const hasil = await bagikanGambarMemo(data, gaya);
        if (hasil === 'diunduh') ctx.notify('PERANGKAT INI TIDAK BISA BERBAGI LANGSUNG · GAMBAR DIUNDUH, LAMPIRKAN DI WHATSAPP');
        else if (hasil === 'dibagikan') ctx.notify('GAMBAR MEMO DIBAGIKAN');
      }
    } catch (e) {
      ctx.notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT GAMBAR MEMO');
    } finally {
      setSibuk(false);
    }
  };
  return (
    <span className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        disabled={sibuk}
        className={kecil ? 'btn-ikon !w-7 !h-7 bg-zinc-800 disabled:opacity-60' : 'btn-retro btn-retro-sm bg-zinc-800 disabled:opacity-60'}
        title="Unduh atau bagikan memo ini sebagai gambar"
        aria-label="Unduh memo sebagai gambar"
        aria-haspopup="dialog"
        aria-expanded={buka}
      >
        {sibuk ? <Loader2 size={kecil ? 13 : 12} className="animate-spin" /> : <ImageDown size={kecil ? 13 : 12} />}{!kecil && ' Gambar'}
      </button>
      {buka && (
        <>
          <span className="fixed inset-0 z-[110]" onClick={() => setBuka(false)} />
          <span role="dialog" aria-label="Gambar memo" className="absolute right-0 top-full mt-1 z-[111] w-56 flex flex-col bg-zinc-900 border-[3px] border-white shadow-[4px_4px_0_#000] text-left">
            <span className="px-2 py-1 text-[10px] text-zinc-400 uppercase border-b border-white/20">Gaya gambar</span>
            {GAYA_GAMBAR_MEMO.map((g) => (
              <button key={g.id} type="button" role="radio" aria-checked={gaya === g.id} onClick={() => setGaya(g.id)}
                className={`flex items-center gap-2 px-2 py-1.5 text-left border-b border-white/10 ${gaya === g.id ? 'bg-lime-500/20' : 'hover:bg-white/5'}`}>
                <span className={`w-3 h-3 border-2 shrink-0 ${gaya === g.id ? 'border-lime-300 bg-lime-400' : 'border-zinc-500'}`} />
                <span className="flex flex-col leading-tight">
                  <span className="text-[12px] font-bold text-white">{g.label}</span>
                  <span className="text-[10px] text-zinc-400">{g.ket}</span>
                </span>
              </button>
            ))}
            <span className="px-2 py-1 text-[10px] text-zinc-400 uppercase border-b border-white/20">Ukuran unduhan</span>
            <span className="grid grid-cols-3 gap-1 p-1.5 border-b border-white/10" role="radiogroup" aria-label="Ukuran gambar">
              {([['otomatis', 'Otomatis'], ['hp', 'HP'], ['komputer', 'Komputer']] as const).map(([u, label]) => (
                <button key={u} type="button" role="radio" aria-checked={ukuran === u} onClick={() => setUkuran(u)}
                  className={`px-1 py-1 text-[11px] font-bold border-2 ${ukuran === u ? 'border-lime-300 bg-lime-500/20 text-white' : 'border-white/15 text-zinc-300 hover:bg-white/5'}`}>
                  {label}
                </button>
              ))}
            </span>
            <span className="px-2 pt-1 text-[10px] text-zinc-400 leading-snug">
              Unduh: {ukuranUnduh === 'komputer' ? 'lebar seperti di komputer' : 'tegak seperti di HP'} · Bagikan WhatsApp: tegak (HP)
            </span>
            <span className="grid grid-cols-2 gap-1.5 p-1.5">
              <button type="button" onClick={() => jalankan('unduh')} className="btn-retro btn-retro-sm bg-zinc-700 justify-center"><Download size={12} /> Unduh</button>
              <button type="button" onClick={() => jalankan('bagikan')} className="btn-retro btn-retro-sm bg-emerald-700 justify-center" title="Bagikan langsung, pilih WhatsApp"><Send size={12} /> WhatsApp</button>
            </span>
          </span>
        </>
      )}
    </span>
  );
};

// ============================================================
// Kartu & tampilan
// ============================================================

const ChipOpsi: React.FC<{ nilai: string | null; opsi: Opsi[]; bulat?: boolean }> = ({ nilai, opsi, bulat }) => {
  if (!nilai) return null;
  const o = opsi.find((x) => x.nilai === nilai);
  const w = warna(o?.warna);
  if (bulat) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[12px] font-bold whitespace-nowrap ${w.garis} ${w.teks} ${w.latar}`}>
        <span className={`w-2 h-2 ${w.titik}`} />{o?.label ?? nilai}
      </span>
    );
  }
  return <span className="inline-block px-1.5 py-0.5 text-[12px] font-bold bg-white/10 border border-white/20 text-zinc-200 whitespace-nowrap">{o?.label ?? nilai}</span>;
};

/** Kemajuan ceklis memo, mis. "☑ 2/5"; hijau bila semua selesai. */
const ChipTugas: React.FC<{ isi: string }> = ({ isi }) => {
  const { selesai, total } = hitungTugas(isi);
  if (!total) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 border text-[12px] font-bold whitespace-nowrap ${selesai === total ? 'border-lime-500/60 text-lime-300' : 'border-white/20 text-zinc-300'}`} title={`${selesai} dari ${total} tugas selesai`}>
      <ListChecks size={11} />{selesai}/{total}
    </span>
  );
};

/** PICA tertaut memo. */
const ChipPica: React.FC<{ memo: Memo }> = ({ memo: m }) => {
  if (!m.pica_id) return null;
  const label = m.pica_no ? `PICA-${String(m.pica_no).padStart(3, '0')}` : 'PICA';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 border text-[12px] font-bold whitespace-nowrap ${m.pica_status === 'Closed' ? 'border-white/20 text-zinc-400' : 'border-amber-400/60 text-amber-200 bg-amber-950/30'}`} title={m.pica_judul ?? undefined}>
      <Target size={11} />{label}
    </span>
  );
};

const KartuMemo: React.FC<{ memo: Memo; tipe: Opsi[]; status: Opsi[]; onBuka: (id: string) => void }> = ({ memo: m, tipe, status, onBuka }) => (
  <div className="relative">
  {/* Kartu sendiri sebuah tombol, jadi tombol unduh ditumpuk di pojoknya (bukan di dalamnya). */}
  <div className="absolute top-1.5 right-1.5 z-[1]"><TombolGambarMemo memo={m} kecil /></div>
  <button onClick={() => onBuka(m.id)} className="w-full text-left bg-zinc-950 border-[3px] border-white/25 p-3 shadow-[3px_3px_0_#000] hover:border-white/60 transition-colors flex flex-col gap-2">
    <p className={`text-[15px] font-bold leading-snug pr-8 ${m.judul ? 'text-white' : 'text-zinc-500 italic'}`}>{tersemat(m) && <Pin size={13} className={`inline mr-1 ${m.disematkan ? 'text-red-400' : 'text-lime-300'}`} />}{ikonMemo(m) && <span className="mr-1.5">{ikonMemo(m)}</span>}{m.judul || 'Tanpa judul'}</p>
    {(m.ringkasan || cuplikanMemo(m.isi)) && <p className="text-[13px] text-zinc-300 leading-snug line-clamp-3">{m.ringkasan || cuplikanMemo(m.isi)}</p>}
    {(m.tipe || m.pica_id || hitungTugas(m.isi).total > 0) && (
      <div className="flex flex-wrap gap-1"><ChipOpsi nilai={m.tipe} opsi={tipe} /><ChipPica memo={m} /><ChipTugas isi={m.isi} /></div>
    )}
    <p className="text-[12px] text-zinc-400">{tglMemo(m.tanggal)}{m.penulis ? ` · ${m.penulis.split(' ')[0]}` : ''}</p>
    {m.status && <div><ChipOpsi nilai={m.status} opsi={status} bulat /></div>}
  </button>
  </div>
);

const Papan: React.FC<{
  daftar: Memo[]; kolom: Opsi[]; kunci: 'kategori' | 'status'; tipe: Opsi[]; status: Opsi[];
  onBuka: (id: string) => void; onBaru?: (nilai: string) => void;
}> = ({ daftar, kolom, kunci, tipe, status, onBuka, onBaru }) => {
  const semuaKolom = [...kolom];
  if (daftar.some((m) => !m[kunci])) {
    semuaKolom.push({ grup: '', nilai: '', label: kunci === 'status' ? 'Tanpa status' : 'Tanpa kategori', warna: 'zinc', urutan: 999 });
  }

  return (
    <div data-gambar-lepas className="h-full overflow-y-auto sm:overflow-x-auto sm:overflow-y-hidden custom-scrollbar sm:snap-x sm:snap-mandatory">
      <div data-gambar-lepas className="flex flex-col gap-3 pb-2 sm:flex-row sm:h-full sm:min-w-max">
        {semuaKolom.map((k) => {
          const isi = daftar.filter((m) => (m[kunci] ?? '') === k.nilai);
          const w = warna(k.warna);
          return (
            <section key={k.nilai || '_'} className="w-full sm:w-72 sm:shrink-0 sm:snap-start flex flex-col sm:min-h-0 bg-white/[0.04] border-2 border-white/10">
              <div className="flex items-center gap-2 px-2 py-2 shrink-0 sticky top-0 z-10 bg-zinc-950 sm:static sm:bg-transparent">
                <span className={`px-2 py-0.5 text-[13px] font-bold border ${w.garis} ${w.teks} ${w.latar}`}>{k.label}</span>
                <span className="text-[13px] text-zinc-400">{isi.length}</span>
              </div>
              <div data-gambar-lepas className="px-2 pb-2 space-y-2 sm:flex-1 sm:overflow-y-auto sm:min-h-0 custom-scrollbar">
                {isi.map((m) => <KartuMemo key={m.id} memo={m} tipe={tipe} status={status} onBuka={onBuka} />)}
                {onBaru && (
                  <button data-tanpa-gambar onClick={() => onBaru(k.nilai)} className="w-full text-left text-[13px] text-zinc-500 hover:text-white px-2 py-1.5 flex items-center gap-1.5">
                    <Plus size={13} /> Baru
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

const TampilanInternalMemo: React.FC<{
  daftar: DataMemoDinas[];
  onBuka: (item: DataMemoDinas) => void;
  onBaru: () => void;
  onHapus: (id: string, e: React.MouseEvent) => void;
  notify: (m: string) => void;
}> = ({ daftar, onBuka, onBaru, onHapus, notify }) => {
  const [cari, setCari] = useState('');
  const [sedangEksporId, setSedangEksporId] = useState<string | null>(null);

  const formatRupiah = (val?: number | null) => {
    if (!val) return '—';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
  };

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return daftar;
    return daftar.filter((d) =>
      `${d.nomor ?? ''} ${d.namaKaryawan} ${d.divisiKaryawan} ${d.perihal} ${d.tempatTujuan} ${d.keperluan}`.toLowerCase().includes(q)
    );
  }, [daftar, cari]);

  const handleEkspor = async (item: DataMemoDinas, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = item.id || 'default';
    setSedangEksporId(id);
    try {
      await eksporMemoDinasKeExcel(item);
      notify('BERKAS EXCEL MEMO DINAS BERHASIL DIUNDUH');
    } catch (err) {
      notify(err instanceof Error ? err.message.toUpperCase() : 'GAGAL MENGEKSPOR EXCEL');
    } finally {
      setSedangEksporId(null);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto custom-scrollbar pb-3 sm:overflow-hidden sm:flex sm:flex-col space-y-3">
      {/* Banner / Info */}
      <div className="panel-retro !bg-zinc-950 !p-3 border-lime-500 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-amber-500 border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]">
            <FileSpreadsheet size={20} className="text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-title text-[13px] md:text-[15px] text-white">Internal Memo Perjalanan Dinas</h3>
              <span className="bg-emerald-900/80 text-emerald-300 text-[10px] px-2 py-0.5 border border-emerald-500/40 font-mono font-bold">
                HASNUR GROUP
              </span>
            </div>
            <p className="text-[12px] text-zinc-400">
              Format baku PT Energi Batubara Lestari · Live preview surat resmi A4 &amp; ekspor langsung ke template .xlsx
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBaru} className="btn-retro btn-retro-sm bg-lime-600 text-white font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]">
            <Plus size={13} /> Buat Memo Dinas
          </button>
        </div>
      </div>

      {/* Pencarian */}
      <div className="relative shrink-0">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari nama karyawan, nomor memo, tujuan, atau keperluan…"
          className="input-retro !pl-8 !py-1.5 !text-[13px]"
        />
      </div>

      {/* Daftar Kartu Memo Dinas */}
      <div className="space-y-3 pr-1 sm:flex-1 sm:overflow-y-auto sm:min-h-0">
        {tersaring.length === 0 ? (
          <div className="text-center py-12 panel-retro !bg-zinc-900/50 border-dashed border-zinc-700">
            <FileText size={36} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-[14px] font-bold text-zinc-300 mb-1">Belum ada Internal Memo Dinas</p>
            <p className="text-[12px] text-zinc-500 mb-4">Buat memo dinas baru atau gunakan format bawaan template Excel.</p>
            <button onClick={onBaru} className="btn-retro btn-retro-sm bg-lime-600">
              <Plus size={12} /> Buat Memo Baru
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tersaring.map((item) => {
              const totalTambahan = (item.biayaTambahan || []).reduce(
                (acc, c) => acc + (Number(c.nominal) || 0),
                0
              );
              const total =
                (Number(item.biayaTransportasi) || 0) +
                (Number(item.biayaPenginapan) || 0) +
                (Number(item.biayaUangMakan) || 0) +
                (Number(item.biayaLainLain) || 0) +
                totalTambahan;

              const sedangEkspor = sedangEksporId === (item.id || 'default');

              return (
                <div
                  key={item.id || item.nomor || Math.random()}
                  onClick={() => onBuka(item)}
                  className="bg-zinc-900/90 border-[3px] border-zinc-700 hover:border-amber-400 transition-all p-3.5 shadow-[3px_3px_0_#000] cursor-pointer flex flex-col justify-between gap-3 group rounded"
                >
                  <div className="space-y-2">
                    {/* Nomor & Badge Biaya */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded lencana-im">
                        {item.nomor || 'TANPA NOMOR'}
                      </span>
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded lencana-kk">
                        {formatRupiah(total)}
                      </span>
                    </div>

                    {/* Perihal & Karyawan */}
                    <div>
                      <h4 className="text-[15px] font-bold text-white group-hover:text-amber-300 transition-colors">
                        {item.perihal || 'Permohonan Perjalanan Dinas'}
                      </h4>
                      <p className="text-[13px] text-amber-400 font-semibold mt-0.5 flex items-center gap-1.5">
                        <User size={13} /> {item.namaKaryawan || '—'}
                        <span className="text-[11px] text-zinc-400 font-normal">({item.jabatanKaryawan || item.divisiKaryawan})</span>
                      </p>
                    </div>

                    {/* Rincian Tujuan & Keperluan */}
                    <div className="bg-zinc-950/60 border border-zinc-700/80 p-2.5 text-[12px] space-y-1.5 rounded">
                      <div className="flex items-start gap-1.5">
                        <span className="text-zinc-400 font-bold w-16 shrink-0">Tujuan:</span>
                        <span className="font-bold text-zinc-100">{item.tempatTujuan || '—'}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-zinc-400 font-bold w-16 shrink-0">Jadwal:</span>
                        <span className="text-zinc-300 font-mono">{item.tanggalBerangkat || '—'} s/d {item.tanggalKembali || '—'}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-zinc-400 font-bold w-16 shrink-0">Keperluan:</span>
                        <span className="text-zinc-200 line-clamp-2">{item.keperluan || '—'}</span>
                      </div>
                    </div>

                    {/* Dari & Kepada */}
                    <div className="text-[11px] text-zinc-400 flex items-center justify-between border-t border-zinc-700/80 pt-1.5">
                      <span>Dari: <strong className="text-zinc-200">{item.dari}</strong></span>
                      <span>Kepada: <strong className="text-zinc-200">{item.kepada}</strong></span>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-700/80">
                    <button
                      onClick={(e) => handleEkspor(item, e)}
                      disabled={sedangEkspor}
                      className="btn-retro btn-retro-sm !bg-emerald-800 hover:!bg-emerald-700 !text-white flex items-center gap-1.5 text-[11px]"
                      title="Unduh file Excel (.xlsx) dengan format template asli"
                    >
                      {sedangEkspor ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                      <span>Unduh .xlsx</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onBuka(item); }}
                      className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-white flex items-center gap-1 text-[11px]"
                    >
                      <Pencil size={12} /> Buka / Edit
                    </button>
                    {item.id !== 'memo-dinas-bawaan' && (
                      <button
                        onClick={(e) => onHapus(item.id!, e)}
                        className="btn-ikon !w-7 !h-7 !bg-red-700 hover:!bg-red-600 text-white border border-red-400"
                        title="Hapus memo"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Tampilan Minutes of Meeting (MOM)
// ============================================================

const TampilanMOM: React.FC<{
  daftar: DataMOM[];
  onBuka: (item: DataMOM) => void;
  onBaru: () => void;
  onHapus: (id: string, e?: React.MouseEvent) => void;
  notify: (m: string) => void;
}> = ({ daftar, onBuka, onBaru, onHapus, notify }) => {
  const [cari, setCari] = useState('');
  const [sedangEksporId, setSedangEksporId] = useState<string | null>(null);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return daftar;
    return daftar.filter((item) =>
      `${item.judul} ${item.tempat} ${item.pesertaRingkasan} ${item.poinList.map((p) => p.minutesOfMeeting).join(' ')}`
        .toLowerCase()
        .includes(q)
    );
  }, [daftar, cari]);

  const handleEkspor = async (item: DataMOM, e: React.MouseEvent) => {
    e.stopPropagation();
    setSedangEksporId(item.id || 'default');
    try {
      await eksporMOMKeWord(item);
      notify('BERKAS WORD BERHASIL DIUNDUH');
    } catch (err) {
      notify(err instanceof Error ? err.message.toUpperCase() : 'GAGAL MENGEKSPOR WORD');
    } finally {
      setSedangEksporId(null);
    }
  };

  const handleEksporExcel = async (item: DataMOM, e: React.MouseEvent) => {
    e.stopPropagation();
    setSedangEksporId(item.id || 'default');
    try {
      await eksporMOMKeExcel(item);
      notify('BERKAS EXCEL BERHASIL DIUNDUH');
    } catch (err) {
      notify(err instanceof Error ? err.message.toUpperCase() : 'GAGAL MENGEKSPOR EXCEL');
    } finally {
      setSedangEksporId(null);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto custom-scrollbar pb-3 sm:overflow-hidden sm:flex sm:flex-col space-y-3">
      {/* Banner / Info */}
      <div className="panel-retro !bg-zinc-950 !p-3 border-blue-500 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0_#000]">
            <ClipboardList size={20} className="text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-title text-[13px] md:text-[15px] text-white">Minutes of Meeting (MoM)</h3>
              <span className="bg-blue-900/80 text-blue-300 text-[10px] px-2 py-0.5 border border-blue-500/40 font-mono font-bold">
                TEMPLATE RESMI
              </span>
            </div>
            <p className="text-[12px] text-zinc-400">
              Notulen rapat resmi · Pratinjau cetak A4 adaptif, penyesuaian panjang halaman &amp; ekspor Word (.doc)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onBaru} className="btn-retro btn-retro-sm bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]">
            <Plus size={13} /> Buat MoM Baru
          </button>
        </div>
      </div>

      {/* Pencarian */}
      <div className="relative shrink-0">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          placeholder="Cari judul agenda, tempat, peserta, atau poin pembahasan…"
          className="input-retro !pl-8 !py-1.5 !text-[13px]"
        />
      </div>

      {/* Daftar Kartu MoM */}
      <div className="space-y-3 pr-1 sm:flex-1 sm:overflow-y-auto sm:min-h-0">
        {tersaring.length === 0 ? (
          <div className="text-center py-12 panel-retro !bg-zinc-900/50 border-dashed border-zinc-700">
            <ClipboardList size={36} className="mx-auto text-zinc-600 mb-2" />
            <p className="text-[14px] font-bold text-zinc-300 mb-1">Belum ada Minutes of Meeting</p>
            <p className="text-[12px] text-zinc-500 mb-4">Buat notulen rapat baru berdasarkan template resmi.</p>
            <button onClick={onBaru} className="btn-retro btn-retro-sm bg-blue-600">
              <Plus size={12} /> Buat MoM Baru
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tersaring.map((item) => {
              const sedangEkspor = sedangEksporId === (item.id || 'default');
              const jmlPoin = item.poinList?.length || 0;
              const jmlPeserta = item.pesertaList?.length || 0;
              const jmlFoto = item.fotoList?.length || 0;

              return (
                <div
                  key={item.id || Math.random()}
                  onClick={() => onBuka(item)}
                  className="bg-zinc-900/90 border-[3px] border-zinc-700 hover:border-blue-400 transition-all p-3.5 shadow-[3px_3px_0_#000] cursor-pointer flex flex-col justify-between gap-3 group rounded"
                >
                  <div className="space-y-2">
                    {/* Header Kartu: Tanggal & Badge Orientasi */}
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded lencana-sr">
                        {item.tanggal || 'DRAF'}
                      </span>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded uppercase lencana-im">
                        {item.orientasi || 'landscape'}
                      </span>
                    </div>

                    {/* Judul MoM */}
                    <div>
                      <h4 className="text-[15px] font-bold text-white group-hover:text-blue-300 transition-colors">
                        {item.judul || 'MINUTES OF MEETING'}
                      </h4>
                      <p className="text-[12px] text-zinc-400 mt-0.5 flex items-center gap-1.5">
                        <MapPin size={12} className="text-zinc-400" /> {item.tempat || '—'} · <Clock size={12} className="text-zinc-400" /> {item.waktu || '—'}
                      </p>
                    </div>

                    {/* Ringkasan Peserta & Poin */}
                    <div className="bg-zinc-950/60 border border-zinc-700/80 p-2.5 text-[12px] space-y-1.5 rounded">
                      <div className="flex items-start gap-1.5">
                        <span className="text-zinc-400 font-bold w-16 shrink-0">Peserta:</span>
                        <span className="text-zinc-200 line-clamp-1">{item.pesertaRingkasan || '—'}</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-zinc-400 font-bold w-16 shrink-0">Ringkasan:</span>
                        <span className="text-zinc-200">
                          {jmlPoin} poin pembahasan · {jmlPeserta} peserta hadir {jmlFoto > 0 ? `· ${jmlFoto} foto` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                    <button
                      onClick={(e) => handleEkspor(item, e)}
                      disabled={sedangEkspor}
                      className="btn-retro btn-retro-sm !bg-blue-800 hover:!bg-blue-700 !text-white flex items-center gap-1.5 text-[11px]"
                      title="Unduh file Word (.doc) sesuai template"
                    >
                      {sedangEkspor ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      <span>Unduh .doc</span>
                    </button>
                    <button
                      onClick={(e) => handleEksporExcel(item, e)}
                      disabled={sedangEkspor}
                      className="btn-retro btn-retro-sm !bg-emerald-800 hover:!bg-emerald-700 !text-white flex items-center gap-1.5 text-[11px]"
                      title="Unduh file Excel (.xlsx) dengan tabel rapi"
                    >
                      {sedangEkspor ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                      <span>Unduh .xlsx</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onBuka(item); }}
                      className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-white flex items-center gap-1 text-[11px]"
                    >
                      <Pencil size={12} /> Buka / Edit
                    </button>
                    {item.id !== 'mom-bawaan' && (
                      <button
                        onClick={(e) => onHapus(item.id!, e)}
                        className="btn-ikon !w-7 !h-7 !bg-red-700 hover:!bg-red-600 text-white border border-red-400"
                        title="Hapus MoM"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Halaman satu memo — seperti "full page" di Notion: memenuhi layar
// laptop maupun HP, dengan bilah atas, ikon & sampul, judul besar,
// properti, lalu isi. Tombol kembali HP/peramban menutup halaman.
// ============================================================

/** Ikon & sampul halaman disimpan di memo.props (kunci "ikon", "sampul", "sampul_y"; kolom kustom berawalan m_). */
const IKON_PILIHAN = ['📝', '📋', '📌', '✅', '⚠️', '🔥', '🌱', '🌳', '🌾', '🚜', '⛏️', '🛠️', '🧯', '🦺', '🚧', '📅', '📊', '💰', '📣', '🗂️', '📦', '🧪', '🗺️', '💧', '⚡', '🌧️', '☀️', '⭐', '🐒', '🍌'];

const ikonMemo = (m: Pick<Memo, 'props'>): string => {
  const v = bacaProps(m).ikon;
  return typeof v === 'string' ? v : '';
};

/** "Diedit 5 mnt lalu" seperti bilah atas Notion. */
function teksDiedit(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = Date.parse(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (Number.isNaN(t)) return '';
  const menit = Math.round((Date.now() - t) / 60000);
  if (menit < 1) return 'Diedit baru saja';
  if (menit < 60) return `Diedit ${menit} mnt lalu`;
  if (menit < 24 * 60) return `Diedit ${Math.round(menit / 60)} jam lalu`;
  return `Diedit ${W.formatWaktuIso(iso)}`;
}

const KUNCI_TAMPILAN = 'pokemonkey_memo_halaman';

export type JenisFontMemo = 'sans' | 'serif' | 'mono' | 'retro';
export type LatarMemo = 'putih' | 'gelap' | 'lapangan';

/** Tampilan halaman per perangkat; `sidebar` = daftar halaman di kiri (laptop) tampil atau disembunyikan. */
interface TampilanHalaman {
  lebar: boolean;
  kecil: boolean;
  sidebar: boolean;
  lipatProperti: boolean;
  font: JenisFontMemo;
  latar: LatarMemo;
  /** Mode Word: menyunting di atas lembar A4 seperti Microsoft Word. */
  word: boolean;
}

export const DAFTAR_FONT: { id: JenisFontMemo; label: string; contoh: string; ket: string; kelas: string }[] = [
  { id: 'sans', label: 'Sans', contoh: 'Ag', ket: 'Bawaan Notion · Bersih & modern', kelas: 'memo-font-sans font-sans' },
  { id: 'serif', label: 'Serif', contoh: 'Ag', ket: 'Elegan · Gaya buku & surat', kelas: 'memo-font-serif font-serif' },
  { id: 'mono', label: 'Mono', contoh: 'Ag', ket: 'Monospace · Gaya kode & ketik', kelas: 'memo-font-mono font-mono' },
  { id: 'retro', label: 'Retro', contoh: 'Ag', ket: 'Pixelify · Khas POKEMONKEY', kelas: 'memo-font-retro' },
];

export const DAFTAR_LATAR: { id: LatarMemo; label: string; ket: string; bgWarna: string }[] = [
  { id: 'putih', label: 'Putih Bersih', ket: 'Latar putih bersih · kontras maksimal', bgWarna: 'bg-white border-zinc-400' },
  { id: 'gelap', label: 'Gelap', ket: 'Mode gelap · santai di malam hari', bgWarna: 'bg-zinc-950 border-zinc-700' },
  { id: 'lapangan', label: 'Lapangan', ket: 'Abu lapangan · reduksi silau', bgWarna: 'bg-[#e6eae3] border-zinc-500' },
];

const bacaTampilan = (): TampilanHalaman => {
  const bawaan: TampilanHalaman = {
    lebar: false,
    kecil: false,
    sidebar: true,
    lipatProperti: false,
    font: 'sans',
    latar: 'putih',
    word: false,
  };
  try {
    const raw = JSON.parse(localStorage.getItem(KUNCI_TAMPILAN) || '{}');
    return {
      ...bawaan,
      ...raw,
      font: ['sans', 'serif', 'mono', 'retro'].includes(raw.font) ? raw.font : 'sans',
      latar: ['putih', 'gelap', 'lapangan'].includes(raw.latar) ? raw.latar : 'putih',
    };
  } catch {
    return bawaan;
  }
};
const layarLebar = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;

const LembarMemo: React.FC<{
  memo: Memo; boleh: boolean; kelola: boolean; kategori: Opsi[]; tipe: Opsi[]; status: Opsi[];
  tim: AnggotaRingkas[]; properti: DefProperti[]; onPropertiBaru: () => void; onBukaPica?: (id: string) => void;
  onUbah: (patch: Partial<Memo>) => void; onHapus: () => void; onTutup: () => void; notify: (m: string) => void;
  /** Sidebar ala Notion: semua halaman memo tim & pribadi, pindah halaman, dan halaman baru. */
  memoTim: Memo[]; memoPribadi: Memo[]; bolehBuatTim: boolean;
  /** Memo rahasia yang boleh saya buka; sandiRahasia = kunci sandi server terpasang. */
  memoRahasia: Memo[]; sandiRahasia: boolean | null;
  namaSaya: string;
  /** Akses penuh (pembuat/Admin/SPV): hapus, bagikan, atur akses. */
  penuh: boolean;
  idSaya: string;
  onPindah: (id: string) => void; onBaru: (lingkup: 'tim' | 'pribadi' | 'rahasia') => void;
  /** Folder Dokumen (pohon di sidebar, di atas Sampah); `arah` = folder yang langsung dibuka. */
  onFolder: (arah?: ArahFolder) => void;
  /** Naik setiap isi folder berubah, agar pohon folder dimuat ulang. */
  muatUlangFolder: number;
  /** Sub-halaman baru di dalam `induk`; `tambahBlok` = blok halamannya ditambahkan ke isi induk oleh pemanggil. */
  onBuatAnak: (induk: Memo, tambahBlok: boolean) => Promise<Memo | null>;
  bolehAnak: (m: Memo) => boolean;
  /** Buka Sampah (menu tersendiri di papan memo). */
  onSampah: () => void;
}> = ({
  memo, boleh, penuh, idSaya, kelola, kategori, tipe, status, tim, properti, onPropertiBaru, onBukaPica, onUbah, onHapus, onTutup, notify,
  memoTim, memoPribadi, memoRahasia, sandiRahasia, namaSaya, bolehBuatTim, onPindah, onBaru, onBuatAnak, bolehAnak, onSampah, onFolder, muatUlangFolder,
}) => {
  const pribadi = memo.lingkup === 'pribadi';
  // Rahasia: hanya pembuat + orang yang dituju; tanpa tautan/AI/unduh/ekspor, layar aman di APK.
  const rahasia = memo.lingkup === 'rahasia';
  const tim_ = memo.lingkup === 'tim';
  useLayarAman(rahasia);
  const [pratinjau, setPratinjau] = useState<{ nama: string; kunci: string } | null>(null);
  const [aturIzin, setAturIzin] = useState(false);
  const [menuSemat, setMenuSemat] = useState(false);
  const [mengeksporWord, setMengeksporWord] = useState(false);
  // Sub-halaman: tanpa properti papan (seperti halaman di dalam halaman Notion) dan tidak dibuang otomatis saat kosong.
  const subHalaman = Boolean(memo.induk_id);
  const semuaHalaman = useMemo(() => new Map([...memoTim, ...memoPribadi, ...memoRahasia].map((m) => [m.id, m])), [memoTim, memoPribadi, memoRahasia]);
  /** Jalur induk → … → halaman ini (breadcrumb). */
  const leluhur = useMemo(() => {
    const hasil: Memo[] = [];
    let x = memo.induk_id;
    for (let i = 0; x && i < 20; i += 1) {
      const m = semuaHalaman.get(x);
      if (!m) break;
      hasil.unshift(m);
      x = m.induk_id;
    }
    return hasil;
  }, [memo.induk_id, semuaHalaman]);
  // "Tautan ke halaman" & judul chip terkini: memo tim hanya menautkan memo tim, agar judul catatan pribadi tidak terbaca orang lain.
  const daftarHalaman = useMemo(
    () => (pribadi ? [...memoTim, ...memoPribadi] : rahasia ? [...memoTim, ...memoRahasia] : memoTim).map((m) => ({ id: m.id, judul: m.judul, ikon: ikonMemo(m) })),
    [pribadi, rahasia, memoTim, memoPribadi, memoRahasia],
  );
  /** Sub-halaman yang baru dibuat di sesi ini (bisa belum masuk daftar saat langsung dibuka). */
  const baruDibuat = useRef(new Set<string>());
  const [judul, setJudul] = useState(memo.judul);
  const [ringkasan, setRingkasan] = useState(memo.ringkasan ?? '');
  const [isi, setIsi] = useState(memo.isi);
  const [status_, setStatusSimpan] = useState<StatusSimpan>('tersimpan');
  const [menu, setMenu] = useState<null | 'titik' | 'ikon' | 'sampul'>(null);
  const [tampilan, setTampilanState] = useState<TampilanHalaman>(bacaTampilan);
  const [laci, setLaci] = useState(false);
  const [modalAiBuka, setModalAiBuka] = useState(false);
  /** Isi sebelum AI menerapkan hasilnya (untuk "Urungkan"). */
  const cadanganAi = useRef<{ judul: string; isi: string; ringkasan: string } | null>(null);
  const [urungAi, setUrungAi] = useState(false);
  useEffect(() => {
    if (!urungAi) return;
    const t = setTimeout(() => setUrungAi(false), 30_000);
    return () => clearTimeout(t);
  }, [urungAi]);
  const urungkanAi = () => {
    const c = cadanganAi.current;
    if (!c) return;
    setJudul(c.judul);
    setIsi(c.isi);
    setRingkasan(c.ringkasan);
    jadwalkan({ judul: c.judul, isi: c.isi, ringkasan: c.ringkasan }, true);
    cadanganAi.current = null;
    setUrungAi(false);
    notify('PERUBAHAN AI DIURUNGKAN');
  };
  const fokusJudulAwal = useRef(true);
  const tertunda = useRef<PatchMemo>({});
  const pewaktu = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setTampilan = (t: TampilanHalaman) => {
    setTampilanState(t);
    try { localStorage.setItem(KUNCI_TAMPILAN, JSON.stringify(t)); } catch { /* abaikan */ }
  };

  // Sidebar ala Notion: laptop = tampil/sembunyi (halaman jadi satu layar penuh); HP = laci.
  const alihSidebar = useCallback(() => {
    if (!layarLebar()) { setLaci((v) => !v); return; }
    setTampilanState((t) => {
      const baru = { ...t, sidebar: !t.sidebar };
      try { localStorage.setItem(KUNCI_TAMPILAN, JSON.stringify(baru)); } catch { /* abaikan */ }
      return baru;
    });
  }, []);
  // Ctrl+\ (Cmd+\ di Mac) seperti Notion.
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === '\\') { e.preventDefault(); alihSidebar(); } };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [alihSidebar]);

  /** Isi yang terakhir diketahui ada di server: dasar penjaga bentrok (lib/memo-simpan.ts). */
  const dasar = useRef<DasarIsi>({ isi: memo.isi, diubah_pada: memo.diubah_pada ?? null });
  const ketikTerakhir = useRef(0);
  const kirim = useCallback(async () => {
    const patch = tertunda.current;
    tertunda.current = {};
    if (Object.keys(patch).length === 0) return;
    setStatusSimpan('menyimpan');
    try {
      const hasil = await simpanMemo(memo.id, patch, typeof patch.isi === 'string' ? dasar.current : undefined);
      const gabung = hasil.gabung;
      if (hasil.status === 'tersimpan') {
        dasar.current = { isi: gabung?.isi ?? patch.isi ?? dasar.current.isi, diubah_pada: hasil.diubah_pada ?? dasar.current.diubah_pada };
      }
      if (gabung && typeof patch.isi === 'string') {
        // Suntingan orang lain ikut masuk. Ketikan kita yang belum terkirim ikut digabung, tidak tertimpa.
        const lanjut = tertunda.current.isi;
        const isiLayar = typeof lanjut === 'string' ? gabungTigaArah(patch.isi, lanjut, gabung.isi).isi : gabung.isi;
        if (typeof lanjut === 'string') tertunda.current = { ...tertunda.current, isi: isiLayar };
        setIsi(isiLayar);
        notify(gabung.bentrok
          ? `DIGABUNG DENGAN SUNTINGAN ORANG LAIN · ${gabung.bentrok} BAGIAN BENTROK, VERSI ANDA DIPAKAI`
          : 'DIGABUNG DENGAN SUNTINGAN ORANG LAIN');
      }
      onUbah({ ...patch, ...(gabung ? { isi: gabung.isi } : {}), diubah_pada: hasil.diubah_pada ?? new Date().toISOString() } as Partial<Memo>);
      setStatusSimpan(hasil.status);
    } catch (e) {
      setStatusSimpan('mengetik');
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN MEMO');
    }
  }, [memo.id, onUbah, notify]);

  const jadwalkan = (patch: PatchMemo, segera = false) => {
    if (!boleh) return;
    ketikTerakhir.current = Date.now();
    tertunda.current = { ...tertunda.current, ...patch };
    setStatusSimpan('mengetik');
    if (pewaktu.current) clearTimeout(pewaktu.current);
    pewaktu.current = setTimeout(kirim, segera ? 0 : 700);
  };

  /**
   * Halaman baru (teratas) yang dibiarkan kosong tidak ikut mengotori daftar maupun Sampah:
   * dibuang langsung. Server memastikan memang kosong dan tanpa sub-halaman.
   */
  const buangJikaKosong = async (): Promise<boolean> => {
    if (!penuh || subHalaman || judul.trim() || ringkasan.trim() || isi.trim()) return false;
    try {
      const h = await api<{ dihapus?: boolean }>(`/api/memo/${memo.id}?kosong=1`, { method: 'DELETE' });
      if (h.dihapus) { onHapus(); return true; }
    } catch { /* biarkan */ }
    return false;
  };

  // Halaman penuh = satu langkah riwayat: tombol kembali HP/peramban menutupnya.
  const ditutup = useRef(false);
  const selesai = async () => {
    if (ditutup.current) return;
    ditutup.current = true;
    if (pewaktu.current) clearTimeout(pewaktu.current);
    await kirim();
    if (await buangJikaKosong()) return;
    onTutup();
  };
  const selesaiRef = useRef(selesai);
  selesaiRef.current = selesai;
  // Satu langkah riwayat per pembukaan halaman, ditandai kunci unik: efek yang terpasang dua kali
  // (mode pengembangan) atau sisa riwayat lama tidak membuat "kembali" perlu ditekan dua kali.
  const kunciRiwayat = useRef(`${memo.id}:${Date.now().toString(36)}`);
  const sudahDidorong = useRef(false);
  useEffect(() => {
    if (!sudahDidorong.current) {
      sudahDidorong.current = true;
      // Sudah di halaman memo (pindah lewat sidebar): ganti langkahnya, supaya satu "kembali" tetap menutup.
      try {
        if (window.history.state?.halamanMemo) window.history.replaceState({ halamanMemo: kunciRiwayat.current }, '');
        else window.history.pushState({ halamanMemo: kunciRiwayat.current }, '');
      } catch { /* abaikan */ }
    }
    const saatKembali = () => { void selesaiRef.current(); };
    window.addEventListener('popstate', saatKembali);
    return () => window.removeEventListener('popstate', saatKembali);
  }, []);
  const tutup = () => {
    if (window.history.state?.halamanMemo === kunciRiwayat.current) window.history.back();
    else void selesai();
  };

  /** Pindah halaman lewat sidebar: kirim perubahan dulu; halaman kosong ikut dibuang seperti saat ditutup. */
  const siapPindah = async () => {
    if (ditutup.current) return;
    ditutup.current = true;
    setLaci(false);
    if (pewaktu.current) clearTimeout(pewaktu.current);
    await kirim();
    await buangJikaKosong();
  };
  const pindahKe = async (id: string) => {
    if (id === memo.id) { setLaci(false); return; }
    await siapPindah();
    onPindah(id);
  };
  const halamanBaru = async (lingkup: 'tim' | 'pribadi' | 'rahasia') => {
    await siapPindah();
    onBaru(lingkup);
  };

  /** Chip/blok halaman diketuk: halaman di Sampah (atau sudah dihapus) tidak bisa dibuka. */
  const bukaHalaman = (id: string) => {
    if (!semuaHalaman.has(id) && !baruDibuat.current.has(id)) { notify('HALAMAN ITU ADA DI SAMPAH ATAU SUDAH DIHAPUS'); return; }
    void pindahKe(id);
  };
  /** Blok "Halaman" di menu "/": sub-halaman di dalam halaman ini (bloknya disisipkan penyunting). */
  const buatSubHalaman = async () => {
    const baru = await onBuatAnak(memo, false);
    if (!baru) return null;
    baruDibuat.current.add(baru.id);
    return { id: baru.id, judul: baru.judul };
  };
  /** "+" di sidebar: sub-halaman di halaman mana pun; bloknya ditambahkan di akhir isi induk, lalu dibuka. */
  const tambahAnakSidebar = async (induk: Memo) => {
    if (induk.id === memo.id) {
      const baru = await onBuatAnak(memo, false);
      if (!baru) return;
      const blok = `[[memo:${baru.id}|Tanpa judul]]`;
      const isiBaru = isi.trim() ? `${isi.replace(/\s+$/, '')}\n${blok}` : blok;
      setIsi(isiBaru);
      jadwalkan({ isi: isiBaru });
      baruDibuat.current.add(baru.id);
      await pindahKe(baru.id);
      return;
    }
    const baru = await onBuatAnak(induk, true);
    if (baru) await pindahKe(baru.id);
  };
  /** Sidebar → Sampah: simpan dulu, tutup halaman, lalu buka menu Sampah di papan memo. */
  const keSampah = async () => {
    await siapPindah();
    if (window.history.state?.halamanMemo === kunciRiwayat.current) window.history.back();
    onSampah();
  };

  /** "Memulai" (halaman masih kosong): isi dari templat, seperti tombol cepat di halaman baru Notion. */
  const pakaiTemplat = (t: { judul: string; isi: string; ikon?: string }) => {
    setIsi(t.isi);
    const patch: PatchMemo = { isi: t.isi };
    if (!judul.trim() && t.judul) { setJudul(t.judul); patch.judul = t.judul; }
    if (t.ikon && !bacaProps(memo).ikon) {
      const props = JSON.stringify({ ...bacaProps(memo), ikon: t.ikon });
      onUbah({ props });
      patch.props = props;
    }
    jadwalkan(patch, true);
  };

  /** Pindah ke Sampah (beserta sub-halaman), bisa dipulihkan 30 hari — tanpa konfirmasi, seperti Notion. */
  const hapus = async () => {
    setMenu(null);
    if (pewaktu.current) clearTimeout(pewaktu.current);
    await kirim();
    try {
      const h = await api<{ jumlah?: number }>(`/api/memo/${memo.id}`, { method: 'DELETE' });
      const anak = (h.jumlah ?? 1) - 1;
      notify(`DIPINDAH KE SAMPAH${anak > 0 ? ` BESERTA ${anak} SUB-HALAMAN` : ''} — BISA DIPULIHKAN 30 HARI`);
      ditutup.current = true;
      // Sub-halaman: kembali ke induknya (seperti Notion); halaman teratas: kembali ke papan.
      const induk = memo.induk_id && semuaHalaman.has(memo.induk_id) ? memo.induk_id : null;
      if (induk) { onHapus(); onPindah(induk); return; }
      if (window.history.state?.halamanMemo === kunciRiwayat.current) window.history.back();
      onHapus();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGHAPUS'); }
  };


  const nilaiProps = bacaProps(memo);
  const simpanProps = (baru: Record<string, string | number | boolean | null>, segera: boolean) => {
    const teks = JSON.stringify(baru);
    onUbah({ props: teks });
    jadwalkan({ props: teks }, segera);
  };
  const ubahProps = (p: DefProperti, v: string | number | boolean | null) =>
    // Ketikan teks/angka/tautan/lokasi ditunda; pilihan, tanggal, dan centang langsung dikirim.
    simpanProps({ ...bacaProps(memo), [p.id]: v }, !['teks', 'angka', 'url', 'lokasi'].includes(p.tipe));

  const hapusKolomProperti = async (p: DefProperti) => {
    if (!confirm(`Hapus kolom properti "${p.label}"?
Kolom ini akan dihapus dari daftar properti memo.`)) return;
    try {
      await api(`/api/properti/${p.id}`, { method: 'DELETE' });
      notify(`KOLOM "${p.label.toUpperCase()}" BERHASIL DIHAPUS`);
      if (nilaiProps[p.id] !== undefined) {
        const baru = { ...nilaiProps };
        delete baru[p.id];
        simpanProps(baru, true);
      }
      onPropertiBaru();
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGHAPUS KOLOM');
    }
  };

  // Properti yang sengaja ditampilkan (lewat "/properti" atau "+ Tambah properti") walau masih kosong.
  const [propTampil, setPropTampil] = useState<ReadonlySet<string>>(new Set());
  const [pilihProp, setPilihProp] = useState(false);
  const areaProperti = useRef<HTMLDivElement>(null);
  /** Tanggal memo tim terisi otomatis saat dibuat: baru tampil bila diubah atau sengaja ditambahkan. */
  const tanggalBuat = new Date(Date.parse(memo.dibuat_pada) + 480 * 60000).toISOString().slice(0, 10);
  const tampilProp = (k: string): boolean => {
    if (propTampil.has(k)) return true;
    if (k === 'kategori' || k === 'tipe' || k === 'status') return Boolean(memo[k]);
    if (k === 'tanggal') return Boolean(memo.tanggal && memo.tanggal !== tanggalBuat);
    if (k === 'pica') return Boolean(memo.pica_id);
    if (k === 'ringkasan') return Boolean(ringkasan.trim());
    const v = nilaiProps[k];
    return !(v === undefined || v === null || v === '' || v === false);
  };
  const daftarProp: { k: string; label: string; ikon: React.ReactNode }[] = [
    { k: 'status', label: 'Status', ikon: <CircleDot size={14} /> },
    { k: 'kategori', label: 'Kategori', ikon: <Tags size={14} /> },
    { k: 'tipe', label: 'Tipe', ikon: <FileText size={14} /> },
    { k: 'tanggal', label: 'Tanggal', ikon: <CalendarDays size={14} /> },
    { k: 'pica', label: 'PICA', ikon: <Target size={14} /> },
    { k: 'ringkasan', label: 'Ringkasan', ikon: <AlignLeft size={14} /> },
    ...properti.map((p) => ({ k: p.id, label: p.label, ikon: <Hash size={14} /> })),
  ];
  const bukaPilihProp = () => {
    setPilihProp(true);
    areaProperti.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const ikon = typeof nilaiProps.ikon === 'string' ? nilaiProps.ikon : '';
  const sampul = typeof nilaiProps.sampul === 'string' ? nilaiProps.sampul : '';
  const pasangIkon = (v: string | null) => { setMenu(null); simpanProps({ ...bacaProps(memo), ikon: v }, true); };
  const pasangSampul = (p: PatchSampul) => { setMenu(null); simpanProps({ ...bacaProps(memo), ...p }, true); };

  /** Memo "Baca saja": pembaca mencentang tugas yang menyebut dirinya; server memastikan hanya itu yang berubah. */
  // Suntingan orang lain tampil sendiri (seperti Notion yang tersinkron): diperiksa tiap 20 detik,
  // hanya saat tidak sedang mengetik dan tidak ada perubahan kita yang belum terkirim.
  useEffect(() => {
    const tenang = () => Object.keys(tertunda.current).length === 0 && Date.now() - ketikTerakhir.current > 5000;
    const periksa = async () => {
      if (document.visibilityState !== 'visible' || ditutup.current || !tenang()) return;
      try {
        const d = await api<{ memo: Memo | null }>(`/api/memo/${memo.id}`);
        const m = d.memo;
        if (!m || (m.diubah_pada ?? null) === dasar.current.diubah_pada || !tenang()) return;
        dasar.current = { isi: m.isi, diubah_pada: m.diubah_pada ?? null };
        setIsi(m.isi);
        setJudul(m.judul);
        setRingkasan(m.ringkasan ?? '');
        onUbah(m);
      } catch { /* tanpa sinyal: coba lagi nanti */ }
    };
    const t = setInterval(() => { void periksa(); }, 20_000);
    return () => clearInterval(t);
  }, [memo.id, onUbah]); // eslint-disable-line react-hooks/exhaustive-deps

  // Komentar (panel kanan; di HP lembar bawah).
  const [komentarBuka, setKomentarBuka] = useState(false);
  const [tanyaBuka, setTanyaBuka] = useState(false);
  const [kutipanKomentar, setKutipanKomentar] = useState<string | null>(null);
  const [jumlahKomentar, setJumlahKomentar] = useState(0);
  const lihatKutipan = (k: string) => {
    const kunci = k.slice(0, 60);
    const el = Array.from(document.querySelectorAll<HTMLElement>('[data-blok-edit],[data-indeks]')).find((n) => (n.textContent ?? '').includes(kunci));
    if (!el) { notify('TEKS YANG DIKOMENTARI SUDAH BERUBAH'); return; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('sorot-komentar');
    setTimeout(() => el.classList.remove('sorot-komentar'), 1800);
  };

  const centangBaca = async (baru: string) => {
    const lama = isi;
    setIsi(baru);
    onUbah({ isi: baru });
    try {
      if ((await patchMemo(memo.id, { isi: baru })) === 'tertunda') notify('TANPA SINYAL — DISIMPAN DI HP, DIKIRIM NANTI');
    } catch (e) {
      setIsi(lama);
      onUbah({ isi: lama });
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN');
    }
  };

  const asal = pribadi ? 'Catatan Pribadi' : rahasia ? 'Memo Rahasia' : 'Memo Internal';

  /** Sematkan: 'saya' = hanya untuk saya; 'semua' = untuk semua orang (pembuat/Admin/SPV; catatan pribadi memakai ini). */
  const sematkan = async (untuk: 'saya' | 'semua', nilai: boolean) => {
    setMenuSemat(false);
    try {
      await api(`/api/memo/${memo.id}/sematkan`, { body: { untuk, nilai } });
      onUbah(untuk === 'semua' ? { disematkan: nilai ? 1 : 0 } : { sematan_saya: nilai ? 1 : 0 });
      notify(nilai ? (untuk === 'semua' ? 'DISEMATKAN UNTUK SEMUA — SELALU DI ATAS' : 'DISEMATKAN — SELALU DI ATAS') : 'SEMATAN DILEPAS');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYEMATKAN'); }
  };
  const tersematIni = Boolean(memo.sematan_saya || memo.disematkan);
  const eksporWord = async () => {
    setMenu(null);
    setMengeksporWord(true);
    try {
      await kirim();
      const h = await eksporDocxMemo({ judul, isi, penulis: memo.penulis }, tim);
      notify(h === 'diunduh' ? 'DOKUMEN WORD DIUNDUH' : 'DOKUMEN WORD SIAP DIBAGIKAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL EKSPOR WORD'); }
    finally { setMengeksporWord(false); }
  };
  const diedit = teksDiedit(memo.diubah_pada ?? memo.dibuat_pada);
  const kotakMenu = 'absolute z-30 retro-box !bg-zinc-900 border-lime-500 !p-1';

  const kelasLatar = tampilan.latar === 'putih'
    ? 'memo-latar-putih bg-white text-zinc-900'
    : tampilan.latar === 'lapangan'
      ? 'memo-latar-lapangan bg-[#e6eae3] text-zinc-900'
      : 'bg-zinc-950 text-white';

  const kelasFont = tampilan.font === 'sans'
    ? 'memo-font-sans font-sans'
    : tampilan.font === 'serif'
      ? 'memo-font-serif font-serif'
      : tampilan.font === 'mono'
        ? 'memo-font-mono font-mono'
        : 'memo-font-retro';

  return (
    <div className={`fixed inset-0 z-[100] flex ${kelasLatar} ${kelasFont}`} role="dialog" aria-modal="true" aria-label={judul || 'Tanpa judul'}>
      {/* ---------- Sidebar (laptop: selalu di kiri; HP: laci dari tombol menu) ---------- */}
      <SidebarMemo
        className={tampilan.sidebar ? 'hidden lg:flex' : 'hidden'}
        onSembunyi={alihSidebar}
        memoTim={memoTim}
        memoPribadi={memoPribadi}
        memoRahasia={memoRahasia}
        aktifId={memo.id}
        lingkupAktif={memo.lingkup}
        bolehBuatTim={bolehBuatTim}
        onPilih={(id) => { void pindahKe(id); }}
        onBaru={(l) => { void halamanBaru(l); }}
        folder={<PohonFolder pengguna={{ id: idSaya, nama: namaSaya, peran: kelola ? 'admin' : 'anggota' } as Pengguna} notify={notify} muatUlang={muatUlangFolder} onBuka={onFolder} />}
        onBeranda={tutup}
        onBaruAnak={(m) => { void tambahAnakSidebar(m); }}
        bolehAnak={bolehAnak}
        onSampah={() => { void keSampah(); }}
        onTanya={() => setTanyaBuka(true)}
      />
      {laci && (
        <div className="lg:hidden fixed inset-0 z-[120] flex">
          <SidebarMemo
            className="flex max-w-[85vw] shadow-[4px_0_0_#000]"
            memoTim={memoTim}
            memoPribadi={memoPribadi}
            memoRahasia={memoRahasia}
            aktifId={memo.id}
            lingkupAktif={memo.lingkup}
            bolehBuatTim={bolehBuatTim}
            onPilih={(id) => { void pindahKe(id); }}
            onBaru={(l) => { void halamanBaru(l); }}
            folder={<PohonFolder pengguna={{ id: idSaya, nama: namaSaya, peran: kelola ? 'admin' : 'anggota' } as Pengguna} notify={notify} muatUlang={muatUlangFolder} onBuka={(a) => { setLaci(false); onFolder(a); }} />}
            onBeranda={() => { setLaci(false); tutup(); }}
            onTutup={() => setLaci(false)}
            onBaruAnak={(m) => { void tambahAnakSidebar(m); }}
            bolehAnak={bolehAnak}
            onSampah={() => { void keSampah(); }}
            onTanya={() => { setLaci(false); setTanyaBuka(true); }}
          />
          <button type="button" className="flex-1 bg-black/60" onClick={() => setLaci(false)} aria-label="Tutup daftar halaman" />
        </div>
      )}

      {tanyaBuka && (
        <TanyaMemo
          memo={[...memoTim, ...memoPribadi]}
          tim={tim}
          onBuka={(id) => { setTanyaBuka(false); bukaHalaman(id); }}
          onTutup={() => setTanyaBuka(false)}
        />
      )}

      {/* Komentar: dimuat sejak halaman dibuka (untuk angka di tombol), tampil saat dibuka. */}
      <KomentarMemo
        memoId={memo.id}
        idSaya={idSaya}
        penuh={penuh}
        boleh={boleh}
        buka={komentarBuka}
        onTutup={() => setKomentarBuka(false)}
        kutipan={kutipanKomentar}
        onKutipanTerpakai={() => setKutipanKomentar(null)}
        onLihat={lihatKutipan}
        onJumlah={setJumlahKomentar}
        notify={notify}
      />

      <div className="flex-1 min-w-0 flex flex-col">
      {/* ---------- Bilah atas ---------- */}
      <div className={`h-12 shrink-0 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 border-b-2 ${
        tampilan.latar === 'putih'
          ? 'bg-white border-zinc-200'
          : tampilan.latar === 'lapangan'
            ? 'bg-[#e6eae3] border-zinc-400'
            : 'bg-zinc-950 border-white/15'
      }`}>
        <button type="button" onClick={alihSidebar} className={`${tampilan.sidebar ? 'lg:hidden' : ''} btn-ikon !w-9 !h-9 ${tampilan.latar === 'putih' ? '!bg-zinc-100 hover:!bg-zinc-200 !text-zinc-800 !border-zinc-300' : 'bg-zinc-800'} shrink-0`} title="Tampilkan daftar halaman (Ctrl+\)" aria-label="Tampilkan daftar halaman"><Menu size={17} /></button>
        <button type="button" onClick={tutup} className={`btn-ikon !w-9 !h-9 ${tampilan.latar === 'putih' ? '!bg-zinc-100 hover:!bg-zinc-200 !text-zinc-800 !border-zinc-300' : 'bg-zinc-800'} shrink-0`} title="Kembali ke papan memo" aria-label="Kembali"><ChevronLeft size={18} /></button>
        <nav className="flex items-center gap-1.5 min-w-0 overflow-hidden text-[13px]" aria-label="Jalur halaman">
          {/* Induk → … → halaman ini; di HP hanya induk terdekat yang tampil. */}
          {leluhur.length > 1 && <span className="sm:hidden text-zinc-500">…/</span>}
          {leluhur.map((m, i) => {
            const sembunyiHp = i < leluhur.length - 1 ? 'hidden sm:inline' : '';
            return (
              <React.Fragment key={m.id}>
                <button type="button" onClick={() => { void pindahKe(m.id); }} className={`${sembunyiHp} min-w-0 max-w-[9rem] truncate ${tampilan.latar === 'putih' ? 'text-zinc-500 hover:text-zinc-950' : 'text-zinc-400 hover:text-white'}`} title={m.judul || 'Tanpa judul'}>
                  {ikonMemo(m) && <span className="mr-1">{ikonMemo(m)}</span>}{m.judul || 'Tanpa judul'}
                </button>
                <span className={`${sembunyiHp} text-zinc-600`}>/</span>
              </React.Fragment>
            );
          })}
          <span className={`font-bold truncate ${tampilan.latar === 'putih' ? 'text-zinc-950' : 'text-white'}`}>{ikon && <span className="mr-1">{ikon}</span>}{judul || 'Tanpa judul'}</span>
          <span className={`hidden sm:inline-flex items-center gap-1 whitespace-nowrap ${rahasia ? 'text-amber-500 font-bold' : 'text-zinc-500'}`}>{pribadi ? <Lock size={12} /> : rahasia ? <ShieldCheck size={12} /> : <Users size={12} />}{asal}</span>
        </nav>
        <span className="ml-auto hidden md:inline text-[11px] text-zinc-500 whitespace-nowrap">{diedit}</span>
        {boleh && <TandaSimpan status={status_} className="hidden sm:inline" />}
        {!boleh && !pribadi && <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 border border-white/20 text-[11px] text-zinc-400 whitespace-nowrap" title="Pembuat memo mengatur memo ini Baca saja"><Eye size={11} /> Hanya baca</span>}
        {/* Sematkan: memo penting selalu di atas daftar & papan */}
        <span className="relative">
          <button
            type="button"
            onClick={() => (tim_ && penuh ? setMenuSemat((v) => !v) : void sematkan(pribadi ? 'semua' : 'saya', !(pribadi ? memo.disematkan : memo.sematan_saya)))}
            className={`btn-ikon !w-9 !h-9 shrink-0 ${tersematIni ? '!bg-lime-600 !text-white' : tampilan.latar === 'putih' ? '!bg-zinc-100 hover:!bg-zinc-200 !text-zinc-800 !border-zinc-300' : 'bg-zinc-800'}`}
            title={tersematIni ? 'Disematkan — ketuk untuk melepas' : 'Sematkan di atas'}
            aria-label="Sematkan"
            aria-pressed={tersematIni}
          >
            {tersematIni ? <Pin size={15} className={memo.disematkan && !pribadi ? 'text-red-200' : ''} /> : <Pin size={15} />}
          </button>
          {menuSemat && (
            <>
              <span className="fixed inset-0 z-20" onClick={() => setMenuSemat(false)} aria-hidden="true" />
              <div className={`${kotakMenu} right-0 top-full mt-1 w-60 ${tampilan.latar === 'putih' ? '!bg-white !border-zinc-300 text-zinc-900 shadow-xl' : ''}`}>
                <button type="button" onClick={() => sematkan('saya', !memo.sematan_saya)} className={`flex w-full items-center gap-2 px-2 py-1.5 text-[13px] ${tampilan.latar === 'putih' ? 'hover:bg-zinc-100' : 'hover:bg-white/10'}`}>
                  {memo.sematan_saya ? <PinOff size={14} /> : <Pin size={14} className="text-lime-400" />} {memo.sematan_saya ? 'Lepas sematan saya' : 'Sematkan untuk saya'}
                </button>
                <button type="button" onClick={() => sematkan('semua', !memo.disematkan)} className={`flex w-full items-center gap-2 px-2 py-1.5 text-[13px] ${tampilan.latar === 'putih' ? 'hover:bg-zinc-100' : 'hover:bg-white/10'}`}>
                  {memo.disematkan ? <PinOff size={14} /> : <Pin size={14} className="text-red-400" />} {memo.disematkan ? 'Lepas sematan untuk semua' : 'Sematkan untuk semua anggota'}
                </button>
              </div>
            </>
          )}
        </span>
        {!pribadi && <SosialMemo memoId={memo.id} idSaya={idSaya} tim={tim} terang={tampilan.latar === 'putih'} notify={notify} />}
        <button
          type="button"
          onClick={() => setKomentarBuka((v) => !v)}
          className={`relative btn-ikon !w-9 !h-9 shrink-0 ${komentarBuka ? 'bg-lime-600' : tampilan.latar === 'putih' ? '!bg-zinc-100 hover:!bg-zinc-200 !text-zinc-800 !border-zinc-300' : 'bg-zinc-800'}`}
          title="Komentar"
          aria-label={`Komentar${jumlahKomentar ? ` (${jumlahKomentar})` : ''}`}
          aria-expanded={komentarBuka}
        >
          <MessageSquare size={16} />
          {jumlahKomentar > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-amber-400 text-black text-[10px] font-bold flex items-center justify-center">{jumlahKomentar}</span>}
        </button>
        {rahasia ? (
          <button
            type="button"
            onClick={() => (penuh ? setAturIzin(true) : notify('HANYA PEMBUAT YANG MENGATUR ORANG YANG DITUJU'))}
            className="flex items-center gap-1.5 px-2 h-9 border-2 border-amber-500/60 bg-amber-500/10 text-[12px] font-bold text-amber-600 shrink-0"
            title="Orang yang dituju memo rahasia ini (semuanya bisa menyunting)"
          >
            <ShieldCheck size={14} /> <AvatarIzin memo={memo} tim={tim} maks={3} />
          </button>
        ) : (
          <BagikanMemo
            memoId={memo.id}
            judul={judul}
            pribadi={pribadi}
            notify={notify}
            akses={memo.akses === 'edit' ? 'edit' : 'baca'}
            bolehAturAkses={penuh}
            onAkses={(a) => { onUbah({ akses: a }); jadwalkan({ akses: a }, true); }}
          />
        )}
        {!rahasia && <span className="hidden sm:inline-flex"><TombolGambarMemo memo={{ ...memo, judul, ringkasan, isi }} kecil /></span>}
        {boleh && !rahasia && (
          <button
            type="button"
            onClick={() => setModalAiBuka(true)}
            className="btn-retro btn-retro-sm !py-1 !px-2.5 bg-gradient-to-r from-purple-700 via-indigo-700 to-sky-700 hover:brightness-110 text-white font-bold flex items-center gap-1.5 shadow shrink-0"
            title="Asisten Menulis & Ringkasan Gemini AI"
          >
            <Sparkles size={13} className="text-yellow-300 animate-pulse" />
            <span className="hidden sm:inline text-[11px] uppercase">Asisten AI</span>
          </button>
        )}
        {/* Tombol cepat Latar Putih Bersih / Gelap */}
        <button
          type="button"
          onClick={() => {
            const baru: LatarMemo = tampilan.latar === 'putih' ? 'gelap' : 'putih';
            setTampilan({ ...tampilan, latar: baru });
            notify(baru === 'putih' ? 'LATAR PUTIH BERSIH DIAKTIFKAN' : 'LATAR GELAP DIAKTIFKAN');
          }}
          className={`btn-ikon !w-9 !h-9 shrink-0 ${
            tampilan.latar === 'putih'
              ? '!bg-amber-100 hover:!bg-amber-200 !text-amber-900 !border-amber-300'
              : 'bg-zinc-800 text-zinc-300 hover:text-white'
          }`}
          title={tampilan.latar === 'putih' ? 'Ganti ke Latar Gelap' : 'Ganti ke Latar Putih Bersih'}
          aria-label="Latar Belakang Memo"
        >
          {tampilan.latar === 'putih' ? <Sun size={15} className="text-amber-600" /> : <Moon size={15} className="text-indigo-400" />}
        </button>
        <span className="relative">
          <button type="button" onClick={() => setMenu(menu === 'titik' ? null : 'titik')} className={`btn-ikon !w-9 !h-9 ${menu === 'titik' ? 'bg-lime-600' : tampilan.latar === 'putih' ? '!bg-zinc-100 hover:!bg-zinc-200 !text-zinc-800 !border-zinc-300' : 'bg-zinc-800'}`} title="Lainnya" aria-label="Lainnya" aria-expanded={menu === 'titik'}><MoreHorizontal size={16} /></button>
          {menu === 'titik' && (
            <>
              <span className="fixed inset-0 z-20" onClick={() => setMenu(null)} aria-hidden="true" />
              <div className={`${kotakMenu} right-0 top-full mt-1 w-64 ${tampilan.latar === 'putih' ? '!bg-white !border-zinc-300 text-zinc-900 shadow-xl' : ''}`}>
                <p className="px-2 pt-1 pb-1 text-[11px] uppercase text-zinc-500 font-bold">Gaya Huruf (Font)</p>
                <div className="grid grid-cols-4 gap-1 px-1 pb-1.5">
                  {DAFTAR_FONT.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setTampilan({ ...tampilan, font: f.id })}
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded border-2 transition-all ${
                        tampilan.font === f.id
                          ? 'border-lime-500 bg-lime-500/20 font-bold shadow'
                          : tampilan.latar === 'putih'
                            ? 'border-zinc-200 hover:border-zinc-400 text-zinc-700 hover:bg-zinc-100'
                            : 'border-white/15 hover:border-white/40 text-zinc-300 hover:text-white'
                      }`}
                      title={f.ket}
                    >
                      <span className={`text-[17px] leading-tight ${f.kelas}`}>Ag</span>
                      <span className="text-[10px] mt-0.5">{f.label}</span>
                    </button>
                  ))}
                </div>

                <div className={`h-px my-1 ${tampilan.latar === 'putih' ? 'bg-zinc-200' : 'bg-white/15'}`} />
                <p className="px-2 pt-1 pb-1 text-[11px] uppercase text-zinc-500 font-bold">Latar Belakang</p>
                <div className="grid grid-cols-3 gap-1 px-1 pb-1.5">
                  {DAFTAR_LATAR.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setTampilan({ ...tampilan, latar: l.id })}
                      className={`flex flex-col items-center justify-center py-1.5 px-1 rounded border-2 transition-all ${
                        tampilan.latar === l.id
                          ? 'border-lime-500 font-bold shadow ring-2 ring-lime-400'
                          : tampilan.latar === 'putih'
                            ? 'border-zinc-200 hover:border-zinc-400 text-zinc-700 hover:bg-zinc-100'
                            : 'border-white/15 hover:border-white/40 text-zinc-300 hover:text-white'
                      }`}
                      title={l.ket}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full border mb-0.5 ${l.bgWarna}`} />
                      <span className="text-[10px] leading-tight text-center">{l.label}</span>
                    </button>
                  ))}
                </div>

                <div className={`h-px my-1 ${tampilan.latar === 'putih' ? 'bg-zinc-200' : 'bg-white/15'}`} />
                <p className="px-2 pt-1 pb-0.5 text-[11px] uppercase text-zinc-500 font-bold">Tampilan Halaman</p>
                <button type="button" onClick={() => setTampilan({ ...tampilan, lebar: !tampilan.lebar })} className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-[13px] ${tampilan.latar === 'putih' ? 'hover:bg-zinc-100 text-zinc-800' : 'hover:bg-white/10 text-white'}`}>
                  <span className="flex items-center gap-2"><MoveHorizontal size={14} /> Lebar penuh</span><span className={`w-8 h-4 border-2 ${tampilan.latar === 'putih' ? 'border-zinc-400' : 'border-white/60'} relative ${tampilan.lebar ? 'bg-lime-600' : ''}`}><span className={`absolute top-0 w-3 h-3 ${tampilan.latar === 'putih' ? 'bg-zinc-900' : 'bg-white'} ${tampilan.lebar ? 'right-0' : 'left-0'}`} /></span>
                </button>
                <button type="button" onClick={() => setTampilan({ ...tampilan, kecil: !tampilan.kecil })} className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-[13px] ${tampilan.latar === 'putih' ? 'hover:bg-zinc-100 text-zinc-800' : 'hover:bg-white/10 text-white'}`}>
                  <span className="flex items-center gap-2"><Type size={14} /> Teks kecil</span><span className={`w-8 h-4 border-2 ${tampilan.latar === 'putih' ? 'border-zinc-400' : 'border-white/60'} relative ${tampilan.kecil ? 'bg-lime-600' : ''}`}><span className={`absolute top-0 w-3 h-3 ${tampilan.latar === 'putih' ? 'bg-zinc-900' : 'bg-white'} ${tampilan.kecil ? 'right-0' : 'left-0'}`} /></span>
                </button>
                <button type="button" onClick={() => setTampilan({ ...tampilan, word: !tampilan.word })} className={`flex w-full items-center justify-between gap-2 px-2 py-1.5 text-[13px] ${tampilan.latar === 'putih' ? 'hover:bg-zinc-100 text-zinc-800' : 'hover:bg-white/10 text-white'}`} title="Menyunting di atas lembar A4 seperti Microsoft Word">
                  <span className="flex items-center gap-2"><BookOpen size={14} /> Mode Word (lembar A4)</span><span className={`w-8 h-4 border-2 ${tampilan.latar === 'putih' ? 'border-zinc-400' : 'border-white/60'} relative ${tampilan.word ? 'bg-lime-600' : ''}`}><span className={`absolute top-0 w-3 h-3 ${tampilan.latar === 'putih' ? 'bg-zinc-900' : 'bg-white'} ${tampilan.word ? 'right-0' : 'left-0'}`} /></span>
                </button>
                {!rahasia && (
                  <button type="button" onClick={eksporWord} disabled={mengeksporWord} className={`flex w-full items-center gap-2 px-2 py-1.5 text-[13px] ${tampilan.latar === 'putih' ? 'hover:bg-zinc-100 text-zinc-800' : 'hover:bg-white/10 text-white'}`}>
                    {mengeksporWord ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} className="text-sky-400" />} Ekspor ke Word (.docx)
                  </button>
                )}
                {pribadi && boleh && (
                  <>
                    <div className={`h-px my-1 ${tampilan.latar === 'putih' ? 'bg-zinc-200' : 'bg-white/15'}`} />
                    <div className="flex items-center gap-1.5 px-2 py-1.5">
                      <span className="text-[12px] text-zinc-400 mr-1">Warna</span>
                      {Object.keys(WARNA_PRIBADI).map((w) => (
                        <button key={w} type="button" onClick={() => { const v = memo.warna === w ? null : w; onUbah({ warna: v }); jadwalkan({ warna: v }, true); }} className={`w-4 h-4 border-2 ${memo.warna === w ? 'border-white' : 'border-transparent'} ${TITIK_PRIBADI[w]}`} aria-label={`Warna ${w}`} />
                      ))}
                    </div>
                  </>
                )}
                {!rahasia && (
                  <div className="sm:hidden">
                    <div className={`h-px my-1 ${tampilan.latar === 'putih' ? 'bg-zinc-200' : 'bg-white/15'}`} />
                    <div className={`px-2 py-1.5 flex items-center gap-2 text-[13px] ${tampilan.latar === 'putih' ? 'text-zinc-800' : ''}`}><TombolGambarMemo memo={{ ...memo, judul, ringkasan, isi }} kecil /> Unduh gambar</div>
                  </div>
                )}
                {penuh && (
                  <>
                    <div className={`h-px my-1 ${tampilan.latar === 'putih' ? 'bg-zinc-200' : 'bg-white/15'}`} />
                    <button type="button" onClick={hapus} className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] text-red-500 hover:bg-red-500/10"><Trash2 size={14} /> Pindahkan ke Sampah</button>
                  </>
                )}
                {diedit && <p className="px-2 pt-1 pb-0.5 text-[11px] text-zinc-500 md:hidden">{diedit}</p>}
              </div>
            </>
          )}
        </span>
      </div>

      {/* ---------- Halaman ---------- */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar ${tampilan.word ? 'bg-zinc-300 py-6 px-2 sm:px-6' : ''}`}>
        {sampul && !tampilan.word && <SampulMemo memoId={memo.id} nilai={sampul} y={nilaiProps.sampul_y} boleh={boleh} notify={notify} onUbah={pasangSampul} />}

        <div
          className={tampilan.word
            ? 'memo-mode-word memo-latar-putih mx-auto bg-white text-zinc-900 shadow-[0_4px_18px_rgba(0,0,0,0.35)] px-6 sm:px-[72px] pt-10 sm:pt-[72px] pb-28 w-full max-w-[794px]'
            : `mx-auto px-4 sm:px-12 pb-28 ${tampilan.lebar ? 'max-w-none' : 'max-w-[780px]'} ${tampilan.kecil ? 'text-[13px]' : ''}`}
          // Garis batas tiap 297 mm (lembar A4) agar terasa seperti menyunting di Word.
          style={tampilan.word ? { minHeight: 1123, backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 1121px, #d4d4d8 1121px, #d4d4d8 1123px)', fontFamily: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif' } : undefined}
        >
          {/* Kepala halaman: ikon, lalu tombol "Tambah ikon / sampul" yang muncul saat diarahkan */}
          <div className={`group relative ${sampul ? '' : 'pt-8 sm:pt-14'}`}>
            {ikon && (
              <button type="button" disabled={!boleh} onClick={() => setMenu(menu === 'ikon' ? null : 'ikon')} className={`block text-[56px] sm:text-[68px] leading-none ${sampul ? '-mt-9 sm:-mt-11' : ''} hover:bg-white/5 px-1`} title={boleh ? 'Ganti ikon' : undefined} aria-label="Ikon halaman">{ikon}</button>
            )}
            {boleh && (
              <div className={`flex flex-wrap gap-1 mt-2 ${ikon && sampul ? '' : ''} opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity`}>
                {!ikon && <button type="button" onClick={() => setMenu(menu === 'ikon' ? null : 'ikon')} className="text-[13px] text-zinc-400 hover:text-white hover:bg-white/10 px-2 py-1 flex items-center gap-1.5"><Smile size={14} /> Tambahkan ikon</button>}
                {!sampul && <button type="button" onClick={() => setMenu(menu === 'sampul' ? null : 'sampul')} className="text-[13px] text-zinc-400 hover:text-white hover:bg-white/10 px-2 py-1 flex items-center gap-1.5"><ImageIcon size={14} /> Tambahkan sampul</button>}
              </div>
            )}

            {menu === 'ikon' && (
              <>
                <span className="fixed inset-0 z-20" onClick={() => setMenu(null)} aria-hidden="true" />
                <div className={`${kotakMenu} left-0 top-full mt-1 w-[19rem] max-w-[calc(100vw-2rem)] !p-2`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] uppercase text-zinc-500">Ikon halaman</span>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => pasangIkon(IKON_PILIHAN[Math.floor(Math.random() * IKON_PILIHAN.length)])} className="text-[12px] text-zinc-300 hover:text-white px-1.5">Acak</button>
                      {ikon && <button type="button" onClick={() => pasangIkon(null)} className="text-[12px] text-red-300 hover:text-red-200 px-1.5">Hapus</button>}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {IKON_PILIHAN.map((e) => (
                      <button key={e} type="button" onClick={() => pasangIkon(e)} className={`h-10 text-[22px] hover:bg-white/10 ${ikon === e ? 'bg-lime-600/30 outline outline-2 outline-lime-400' : ''}`} aria-label={`Ikon ${e}`}>{e}</button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {menu === 'sampul' && (
              <PemilihSampul memoId={memo.id} nilai={sampul} notify={notify} className="left-0 top-full mt-1" onTutup={() => setMenu(null)} onPilih={pasangSampul} />
            )}
          </div>

          {/* Judul */}
          {boleh ? (
            <textarea
              value={judul}
              rows={1}
              onChange={(e) => { const v = e.target.value.replace(/\n/g, ' '); setJudul(v); jadwalkan({ judul: v }); }}
              onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }}
              ref={(t) => {
                if (!t) return;
                t.style.height = 'auto';
                t.style.height = `${t.scrollHeight}px`;
                // Halaman baru: kursor langsung di judul, tanpa menggulir sampul keluar layar (seperti Notion).
                if (fokusJudulAwal.current && !memo.judul && !memo.isi) { fokusJudulAwal.current = false; t.focus({ preventScroll: true }); }
              }}
              placeholder="Tanpa judul"
              className={`w-full mt-2 bg-transparent text-[28px] sm:text-[38px] font-bold leading-tight outline-none resize-none overflow-hidden ${
                tampilan.latar === 'putih'
                  ? 'text-zinc-950 placeholder:text-zinc-400'
                  : tampilan.latar === 'lapangan'
                    ? 'text-zinc-900 placeholder:text-zinc-500'
                    : 'text-white placeholder:text-zinc-700'
              }`}
              aria-label="Judul"
            />
          ) : (
            <h1 className={`mt-2 text-[28px] sm:text-[38px] font-bold leading-tight ${
              tampilan.latar === 'putih' ? 'text-zinc-950' : tampilan.latar === 'lapangan' ? 'text-zinc-900' : 'text-white'
            }`}>{judul || 'Tanpa judul'}</h1>
          )}

          {/* Properti — halaman baru bersih seperti halaman biasa Notion: properti hanya tampil bila
              terisi, atau ditambah lewat "/properti" atau "+ Tambah properti" di bawah judul. */}
          {tim_ && !subHalaman && (
            <div ref={areaProperti} className="mt-2">
              {(memo.penulis || diedit) && (
                <p className="text-[12px] text-zinc-500 px-1.5 mb-1">{memo.penulis ? `Ditulis oleh ${memo.penulis}` : ''}{memo.penulis && diedit ? ' · ' : ''}{diedit}</p>
              )}
              {([['kategori', 'Kategori', kategori, true], ['tipe', 'Tipe', tipe, false], ['status', 'Status', status, true]] as const).filter(([kunci]) => tampilProp(kunci)).map(([kunci, label, opsi, bulat]) => (
                <BarisProperti
                  key={kunci}
                  label={label}
                  ikon={kunci === 'kategori' ? <Tags size={14} /> : kunci === 'tipe' ? <FileText size={14} /> : <CircleDot size={14} />}
                  tampil={(
                    <PilihanTembus nilai={memo[kunci]} opsi={opsi} boleh={boleh} label={label} onUbah={(v) => { onUbah({ [kunci]: v }); jadwalkan({ [kunci]: v }, true); }}>
                      {memo[kunci] ? <ChipOpsi nilai={memo[kunci]} opsi={opsi} bulat={bulat} /> : <Kosong />}
                    </PilihanTembus>
                  )}
                />
              ))}
              {tampilProp('tanggal') && (
                <BarisProperti
                  label="Tanggal"
                  ikon={<CalendarDays size={14} />}
                  tampil={(
                    <TanggalTembus nilai={memo.tanggal} boleh={boleh} label="Tanggal" onUbah={(v) => { onUbah({ tanggal: v }); jadwalkan({ tanggal: v }, true); }}>
                      <span className="text-[14px] text-zinc-100">{tglMemo(memo.tanggal) || <Kosong />}</span>
                    </TanggalTembus>
                  )}
                />
              )}
              {tampilProp('pica') && (
                <BarisProperti
                  label="PICA"
                  ikon={<Target size={14} />}
                  boleh={boleh}
                  tampil={memo.pica_id ? <ChipPica memo={memo} /> : <Kosong />}
                  sunting={() => (
                    <PilihPicaMemo
                      memo={memo}
                      boleh
                      onBukaPica={onBukaPica}
                      onUbah={(id, r) => { onUbah({ pica_id: id, pica_no: r.no, pica_judul: r.judul, pica_status: r.status }); jadwalkan({ pica_id: id }, true); }}
                    />
                  )}
                />
              )}
              {hitungTugas(isi).total > 0 && <BarisProperti label="Tugas" ikon={<ListChecks size={14} />} tampil={<NilaiPolos><ChipTugas isi={isi} /></NilaiPolos>} />}
              {properti.filter((p) => tampilProp(p.id)).map((p) => {
                const v = nilaiProps[p.id];
                const kosong = v === undefined || v === null || v === '';
                const menuKolom = kelola || boleh ? [{ label: 'Hapus properti', aksi: () => hapusKolomProperti(p), bahaya: true }] : undefined;
                const ikonKolom = <Hash size={14} />;
                // Centang dan lokasi (penyunting peta) tetap langsung bisa dipakai; pilihan/orang/tanggal memakai pemilih perangkat.
                if (p.tipe === 'checkbox' || p.tipe === 'lokasi') {
                  return <BarisProperti key={p.id} label={p.label} ikon={ikonKolom} menu={menuKolom} tampil={<div className="px-1.5 py-1"><EditorProperti p={p} nilai={v} tim={tim} boleh={boleh} onUbah={(x) => ubahProps(p, x)} /></div>} />;
                }
                if (p.tipe === 'select' || p.tipe === 'orang') {
                  const opsiKolom = p.tipe === 'orang' ? tim.map((x) => ({ nilai: x.id, label: x.nama })) : opsiProperti(p).map((o) => ({ nilai: o, label: o }));
                  return (
                    <BarisProperti
                      key={p.id} label={p.label} ikon={ikonKolom} menu={menuKolom}
                      tampil={(
                        <PilihanTembus nilai={kosong ? null : String(v)} opsi={opsiKolom} boleh={boleh} label={p.label} onUbah={(x) => ubahProps(p, x)}>
                          {kosong ? <Kosong /> : <span className="inline-block px-1.5 py-0.5 text-[12px] font-bold bg-white/10 border border-white/20 text-zinc-200">{teksNilai(p, v, tim)}</span>}
                        </PilihanTembus>
                      )}
                    />
                  );
                }
                if (p.tipe === 'tanggal') {
                  return (
                    <BarisProperti
                      key={p.id} label={p.label} ikon={ikonKolom} menu={menuKolom}
                      tampil={(
                        <TanggalTembus nilai={kosong ? null : String(v)} boleh={boleh} label={p.label} onUbah={(x) => ubahProps(p, x)}>
                          <span className="text-[14px] text-zinc-100">{kosong ? <Kosong /> : teksNilai(p, v, tim)}</span>
                        </TanggalTembus>
                      )}
                    />
                  );
                }
                return (
                  <BarisProperti
                    key={p.id} label={p.label} ikon={ikonKolom} menu={menuKolom} boleh={boleh}
                    tampil={kosong ? <Kosong /> : <EditorProperti p={p} nilai={v} tim={tim} boleh={false} onUbah={() => undefined} />}
                    sunting={() => <EditorProperti p={p} nilai={v} tim={tim} boleh onUbah={(x) => ubahProps(p, x)} />}
                  />
                );
              })}
              {tampilProp('ringkasan') && (
                <BarisProperti
                  label="Ringkasan"
                  ikon={<AlignLeft size={14} />}
                  boleh={boleh}
                  tampil={ringkasan ? <span className="py-1.5 whitespace-pre-wrap leading-snug">{ringkasan}</span> : <Kosong teks="Kosong — tampil di kartu" />}
                  sunting={() => (
                    <textarea
                      value={ringkasan}
                      onChange={(e) => { setRingkasan(e.target.value); jadwalkan({ ringkasan: e.target.value }); }}
                      rows={3}
                      className="input-retro !py-1.5 !text-[14px] resize-y"
                      placeholder="Dua–tiga kalimat inti memo (tampil di kartu)…"
                      aria-label="Ringkasan"
                    />
                  )}
                />
              )}
              {boleh && (
                <div className="relative pl-1">
                  <button
                    type="button"
                    onClick={() => setPilihProp((v) => !v)}
                    className={`flex items-center gap-1.5 px-1.5 py-1 text-[12px] text-zinc-500 hover:text-white hover:bg-white/[0.06] ${pilihProp ? 'text-white' : ''}`}
                    aria-expanded={pilihProp}
                  >
                    <Plus size={13} /> Tambah properti <span className="text-zinc-600">· atau ketik /properti</span>
                  </button>
                  {pilihProp && (
                    <>
                      <span className="fixed inset-0 z-20" onClick={() => setPilihProp(false)} aria-hidden="true" />
                      <div className={`${kotakMenu} left-0 top-full mt-1 w-64 ${tampilan.latar === 'putih' ? '!bg-white !border-zinc-300 text-zinc-900 shadow-xl' : ''}`}>
                        <p className="px-2 pt-1 pb-1 text-[11px] uppercase text-zinc-500 font-bold flex items-center gap-1"><SlidersHorizontal size={11} /> Properti halaman</p>
                        {daftarProp.filter((x) => !tampilProp(x.k)).map((x) => (
                          <button key={x.k} type="button" onClick={() => { setPropTampil((s) => new Set(s).add(x.k)); setPilihProp(false); }} className={`flex w-full items-center gap-2 px-2 py-1.5 text-[13px] ${tampilan.latar === 'putih' ? 'hover:bg-zinc-100' : 'hover:bg-white/10'}`}>
                            {x.ikon} {x.label}
                          </button>
                        ))}
                        {daftarProp.every((x) => tampilProp(x.k)) && <p className="px-2 py-1.5 text-[12px] text-zinc-500">Semua properti sudah tampil.</p>}
                        {kelola && <div className="px-1.5 pt-1 border-t border-white/10 mt-1"><TambahPropertiMemo ada={properti} notify={notify} onSelesai={onPropertiBaru} /></div>}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {pribadi && <p className="text-[12px] text-zinc-500 flex items-center gap-1.5 py-1 mt-2"><Lock size={12} /> Catatan pribadi — hanya terlihat oleh Anda{memo.disematkan ? ' · disematkan' : ''}</p>}
          {rahasia && (
            <div className="mt-2 px-2 py-1.5 border-2 border-amber-500/50 bg-amber-500/10 text-[12px] flex flex-wrap items-center gap-2">
              <ShieldCheck size={14} className="text-amber-500 shrink-0" />
              <span className="flex-1 min-w-[12rem]">Memo rahasia — hanya pembuat dan orang yang dituju; semuanya bisa menyunting. Tidak bisa dibagikan, diunduh, atau diproses AI.{sandiRahasia === false ? ' (Kunci sandi server belum dipasang.)' : ' Isi disandikan di server.'}</span>
              <AvatarIzin memo={memo} tim={tim} />
            </div>
          )}

          <div className={subHalaman ? 'mt-4' : `border-t mt-3 pt-4 ${tampilan.latar === 'putih' ? 'border-zinc-200' : tampilan.latar === 'lapangan' ? 'border-zinc-300' : 'border-white/15'}`}>
            <EditorMemo
              memoId={memo.id}
              isi={isi}
              onIsi={(baru) => { setIsi(baru); jadwalkan({ isi: baru }); }}
              boleh={boleh}
              tim={tim}
              notify={notify}
              bolehSebutOrang={tim_}
              onBukaPica={onBukaPica}
              tinggi={isi.trim() ? 360 : 120}
              kecil={tampilan.kecil}
              font={tampilan.word ? 'sans' : tampilan.font}
              latar={tampilan.word ? 'putih' : tampilan.latar}
              idSaya={idSaya}
              onProperti={tim_ && boleh && !subHalaman ? bukaPilihProp : undefined}
              onPratinjauBerkas={setPratinjau}
              onCentangBaca={!boleh && !pribadi ? centangBaca : undefined}
              // "Tautan ke halaman": memo tim hanya menautkan memo tim, agar judul catatan pribadi tidak terbaca orang lain.
              halaman={daftarHalaman}
              onBukaHalaman={bukaHalaman}
              onBuatHalaman={boleh ? buatSubHalaman : undefined}
              onKomentar={(k) => { setKutipanKomentar(k); setKomentarBuka(true); }}
              onAi={boleh && !rahasia ? async (q) => {
                const r = await prosesMemoAi({ mode: q.mode, aksi: q.aksi as AksiPilihanAi | undefined, pilihan: q.pilihan, instruksi_khusus: q.instruksi, memo_id: memo.id, lingkup: pribadi ? 'pribadi' : 'tim', judul, isi });
                return { teks: (q.mode === 'pilihan' ? r.hasil : r.isi) ?? '', catatan: r.catatan_ai };
              } : undefined}
            />
          </div>

          {/* Halaman baru masih kosong: tombol cepat seperti "Memulai" di Notion */}
          {boleh && !isi.trim() && (
            <div className="mt-6">
              <p className="text-[12px] text-zinc-500 mb-2">Memulai</p>
              <div className="flex flex-wrap gap-2">
                {!rahasia && (
                  <button
                    type="button"
                    onClick={() => setModalAiBuka(true)}
                    className="px-3 py-1.5 border-2 border-purple-500/50 bg-gradient-to-r from-purple-900/40 to-indigo-900/40 hover:border-purple-400 hover:bg-purple-900/60 text-[13px] font-bold text-purple-200 flex items-center gap-1.5 shadow"
                  >
                    <Sparkles size={14} className="text-yellow-300 animate-pulse" />
                    <span>Tulis dengan AI</span>
                  </button>
                )}
                {TEMPLATE.filter((t) => t.isi).map((t) => (
                  <button key={t.nama} type="button" onClick={() => pakaiTemplat(t)} className="px-3 py-1.5 border-2 border-white/15 bg-white/[0.04] hover:border-white/40 hover:bg-white/10 text-[13px] font-bold text-zinc-200 flex items-center gap-1.5">
                    <span>{t.ikon}</span>{t.nama}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {rahasia && <WatermarkRahasia nama={namaSaya} />}
      {pratinjau && <PenampilBerkas berkas={pratinjau} bolehUnduh={!rahasia} onTutup={() => setPratinjau(null)} />}
      {aturIzin && (
        <PilihOrangRahasia
          tim={tim}
          pengguna={{ id: idSaya } as Pengguna}
          awal={izinMemo(memo.izin)}
          judul="Orang yang dituju"
          tombol="Simpan"
          onTutup={() => setAturIzin(false)}
          onSimpan={async (ids) => {
            setAturIzin(false);
            try {
              await api(`/api/memo/${memo.id}`, { method: 'PATCH', body: { izin: ids } });
              onUbah({ izin: JSON.stringify(ids) });
              notify(`MEMO RAHASIA KINI UNTUK ${ids.length} ORANG — MEREKA MENERIMA SURAT`);
            } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN'); }
          }}
        />
      )}

      {urungAi && (
        <div className="fixed z-[120] left-1/2 -translate-x-1/2 bottom-4 flex items-center gap-3 px-3 py-2 retro-box !bg-zinc-900 border-purple-500 text-[13px] text-zinc-100" role="status">
          <Sparkles size={14} className="text-purple-300" /> Memo diubah oleh AI
          <button type="button" onClick={urungkanAi} className="btn-retro btn-retro-sm !bg-purple-700 text-white font-bold">Urungkan</button>
          <button type="button" onClick={() => setUrungAi(false)} className="text-zinc-400 hover:text-white" aria-label="Tutup"><X size={14} /></button>
        </div>
      )}

      {modalAiBuka && (
        <ModalAiMemo
          memoId={memo.id}
          lingkup={pribadi ? 'pribadi' : 'tim'}
          judulAwal={judul}
          isiAwal={isi}
          ringkasanAwal={ringkasan}
          tim={tim}
          kelola={kelola}
          onTerapkan={(a) => {
            // Cadangan untuk "Urungkan": isi sebelum AI menyentuhnya.
            cadanganAi.current = { judul, isi, ringkasan };
            const patch: PatchMemo = {};
            if (a.judul) { setJudul(a.judul); patch.judul = a.judul; }
            if (a.ringkasan) { setRingkasan(a.ringkasan); patch.ringkasan = a.ringkasan; }
            if (a.jenis !== 'ringkasan') {
              const isiBaru = a.jenis === 'ganti' ? a.isi : tambahDiBawah(isi, a.isi, a.bagian);
              setIsi(isiBaru);
              patch.isi = isiBaru;
            }
            jadwalkan(patch, true);
            setUrungAi(true);
            notify(a.jenis === 'ringkasan' ? 'RINGKASAN DIISI OLEH AI' : a.jenis === 'tambah' ? 'HASIL AI DITAMBAHKAN DI BAWAH' : 'ISI MEMO DIGANTI OLEH AI');
            setModalAiBuka(false);
          }}
          onTutup={() => setModalAiBuka(false)}
          notify={notify}
        />
      )}
    </div>
  );
};

type StatusSimpan = 'tersimpan' | 'mengetik' | 'menyimpan' | 'tertunda';

/** Keterangan simpan otomatis; 'tertunda' = tanpa sinyal, menunggu dikirim dari HP. */
const TandaSimpan: React.FC<{ status: StatusSimpan; className?: string }> = ({ status, className = '' }) => (
  <span className={`text-[11px] whitespace-nowrap ${status === 'tertunda' ? 'text-amber-300' : 'text-zinc-500'} ${className}`} title={status === 'tertunda' ? 'Tanpa sinyal: perubahan tersimpan di HP dan dikirim otomatis' : undefined}>
    {status === 'tersimpan' ? 'tersimpan' : status === 'menyimpan' ? 'menyimpan…' : status === 'tertunda' ? 'disimpan di HP' : 'mengetik…'}
  </span>
);

// ============================================================
// Catatan pribadi (hanya pemiliknya): daftar halaman; ketuk untuk
// membuka sebagai halaman penuh (LembarMemo, dirender MemoScreen).
// ============================================================

const TEMPLATE: { nama: string; judul: string; isi: string; ikon?: string }[] = [
  { nama: 'Halaman kosong', judul: '', isi: '' },
  { nama: 'Rencana harian', ikon: '📅', judul: `Rencana ${W.formatPanjang(W.hariIniWita())}`, isi: `# Prioritas\n- [ ]  @${W.hariIniWita()}\n- [ ] \n- [ ] \n\n## Lapangan\n- [ ] \n\n## Catatan\n` },
  { nama: 'Catatan rapat', ikon: '📋', judul: 'Catatan rapat', isi: '# Peserta\n- \n\n# Keputusan\n- \n\n# Tindak lanjut\n- [ ] Apa · kapan\n' },
  { nama: 'Daftar tugas', ikon: '✅', judul: 'Daftar tugas', isi: '- [ ] \n- [ ] \n- [ ] \n' },
];

const WARNA_PRIBADI: Record<string, string> = { amber: 'border-l-amber-400', cyan: 'border-l-cyan-400', emerald: 'border-l-emerald-400', pink: 'border-l-pink-400', purple: 'border-l-purple-400' };
const TITIK_PRIBADI: Record<string, string> = { amber: 'bg-amber-400', cyan: 'bg-cyan-400', emerald: 'bg-emerald-400', pink: 'bg-pink-400', purple: 'bg-purple-400' };

const CatatanPribadi: React.FC<{
  daftar: Memo[];
  /** Membuat catatan baru (bersampul bawaan, boleh bertemplat) lalu membukanya. */
  onBuat: (t: { judul: string; isi: string; ikon?: string }) => Promise<void>;
  memuat: boolean;
  onBuka: (id: string) => void;
  notify: (m: string) => void;
}> = ({ daftar, memuat, onBuka, onBuat }) => {
  const [cari, setCari] = useState('');
  const [templateBuka, setTemplateBuka] = useState(false);

  const buat = (t: typeof TEMPLATE[number]) => {
    setTemplateBuka(false);
    void onBuat(t);
  };

  const tersaring = daftar
    .filter((m) => !cari || `${m.judul} ${m.isi}`.toLowerCase().includes(cari.toLowerCase()))
    .sort((a, b) => (b.disematkan - a.disematkan) || String(b.diubah_pada ?? b.dibuat_pada).localeCompare(String(a.diubah_pada ?? a.dibuat_pada)));

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1 max-w-md">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari catatan…" className="input-retro !pl-8 !py-1.5 !text-[13px]" />
        </div>
        <div className="relative ml-auto">
          <button onClick={() => setTemplateBuka((v) => !v)} className="btn-retro btn-retro-sm bg-lime-600"><Plus size={12} /> Halaman baru <ChevronDown size={11} /></button>
          {templateBuka && (
            <div className="absolute right-0 top-full mt-1 z-30 retro-box !bg-zinc-900 !p-1 w-48 border-lime-500">
              {TEMPLATE.map((t) => <button key={t.nama} onClick={() => buat(t)} className="block w-full text-left px-2 py-1.5 text-[13px] hover:bg-white/10">{t.ikon ? `${t.ikon} ` : ''}{t.nama}</button>)}
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 mb-2 flex items-center gap-1"><Lock size={10} /> Hanya terlihat oleh Anda · ketuk untuk membuka sebagai halaman penuh</p>
      <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
        {memuat && <p className="text-[12px] text-zinc-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> memuat…</p>}
        {!memuat && tersaring.length === 0 && <p className="text-[12px] text-zinc-400 text-center py-8">Belum ada catatan. Tekan <b>Halaman baru</b>.</p>}
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 pb-2">
          {tersaring.map((m) => {
            const { selesai, total } = hitungTugas(m.isi);
            const ikon = ikonMemo(m);
            return (
              <button key={m.id} onClick={() => onBuka(m.id)} className={`w-full text-left panel-retro !p-2.5 border-l-4 ${m.warna ? WARNA_PRIBADI[m.warna] : 'border-l-zinc-500'} hover:!border-white/50`}>
                <div className="flex items-center gap-1.5">
                  {m.disematkan ? <Pin size={11} className="text-lime-300 shrink-0" /> : null}
                  {ikon && <span className="text-[16px] leading-none">{ikon}</span>}
                  <p className={`text-[14px] font-bold truncate flex-1 ${m.judul ? 'text-white' : 'text-zinc-500 italic'}`}>{m.judul || 'Tanpa judul'}</p>
                </div>
                <p className="text-[12px] text-zinc-300 truncate mt-0.5">{cuplikanMemo(m.isi) || '—'}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{W.formatWaktuIso(m.diubah_pada ?? m.dibuat_pada)}{total ? ` · ${selesai}/${total} selesai` : ''}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
