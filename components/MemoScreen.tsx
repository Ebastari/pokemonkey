import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NotebookPen, Plus, ListFilter, ArrowUpDown, Search, X, Trash2, Pencil, Eye, Loader2, KanbanSquare,
  CircleDot, Tags, Table2, Lock, Pin, PinOff, ChevronLeft, ChevronDown, User, ImageDown, FileSpreadsheet,
  FileText, ClipboardList, Download, Clock, MapPin, Hash, Sun, Moon, Send, ListChecks, CalendarDays, Target,
} from 'lucide-react';
import { api } from '../lib/api';
import { unduhGambar } from '../lib/gambar';
import { unduhGambarMemo, bagikanGambarMemo, GAYA_GAMBAR_MEMO, type GayaGambarMemo } from '../lib/gambar-memo';
import { bukuBaru, gayakanChip, lembarBaru, pasangSaringan, simpanBuku, tanggalExcel, FORMAT_TANGGAL } from '../lib/excel';
import type { AnggotaRingkas, Bootstrap, Opsi, Pengguna, Properti as DefProperti } from '../lib/tipe-api';
import type { Memo } from '../types';
import { warna } from '../lib/warna';
import * as W from '../lib/waktu';
import { toggleBaris } from './MemoMarkup';
import { EditorMemo } from './EditorMemo';
import { BagikanMemo } from './BagikanMemo';
import { TugasMemo } from './TugasMemo';
import { KalenderMemo } from './KalenderMemo';
import { EditorProperti, PilihPicaMemo, TambahPropertiMemo, bacaProps, teksNilai } from './PropertiMemo';
import { cuplikanMemo, hitungTugas } from '../server/src/memo-blok';
import { patchMemo, pasangPengirimTertunda, type PatchMemo } from '../lib/memo-simpan';
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

/**
 * MEMO — papan "Memo Internal" tim bergaya Notion, plus catatan pribadi.
 * Satu sumber data, beberapa tampilan: Ikhtisar (per kategori), Status,
 * Kategori (daftar), Tabel (semua properti), Pribadi, Internal Memo, Minutes of Meeting (MoM),
 * dan Manajemen Nomor Surat (Internal & Eksternal).
 */

type Tab = 'ikhtisar' | 'status' | 'kategori' | 'tabel' | 'tugas' | 'kalender' | 'pribadi' | 'internal_memo' | 'mom' | 'nomor_surat';
type Urut = 'tanggal' | 'judul' | 'diubah';

const KUNCI_TAB = 'pokemonkey_memo_tab';

const TAB: { id: Tab; label: string; ikon: React.ReactElement }[] = [
  { id: 'ikhtisar', label: 'Ikhtisar', ikon: <KanbanSquare size={14} /> },
  { id: 'status', label: 'Status', ikon: <CircleDot size={14} /> },
  { id: 'kategori', label: 'Kategori', ikon: <Tags size={14} /> },
  { id: 'tabel', label: 'Tabel', ikon: <Table2 size={14} /> },
  { id: 'tugas', label: 'Tugas', ikon: <ListChecks size={14} /> },
  { id: 'kalender', label: 'Kalender', ikon: <CalendarDays size={14} /> },
  { id: 'pribadi', label: 'Pribadi', ikon: <Lock size={14} /> },
  { id: 'internal_memo', label: 'Internal Memo', ikon: <FileText size={14} /> },
  { id: 'mom', label: 'Minutes of Meeting', ikon: <ClipboardList size={14} /> },
  { id: 'nomor_surat', label: 'Nomor Surat', ikon: <Hash size={14} /> },
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
}

/** Tab yang menampilkan papan Memo Internal tim (dengan bilah saring/cari/ekspor). */
const TAB_PAPAN: readonly Tab[] = ['ikhtisar', 'status', 'kategori', 'tabel'];

export const MemoScreen: React.FC<Props> = ({ boot, pengguna, notify, onBukaRab, onBukaPica }) => {
  const [tab, setTabState] = useState<Tab>(() => {
    try { return (localStorage.getItem(KUNCI_TAB) as Tab) || 'ikhtisar'; } catch { return 'ikhtisar'; }
  });
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem(KUNCI_TAB, t); } catch { /* abaikan */ } };

  // State tema terang / gelap
  const [temaAktif, setTemaAktif] = useState<Tema>(bacaTema);
  const toggleTema = () => {
    const baru: Tema = temaAktif === 'gelap' ? 'terang' : 'gelap';
    setTemaAktif(baru);
    pasangTema(baru);
    notify(baru === 'terang' ? 'MODE TERANG AKTIF — UNTUK DI LAPANGAN' : 'MODE GELAP AKTIF');
  };

  const [memo, setMemo] = useState<Memo[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [cari, setCari] = useState('');
  const [cariBuka, setCariBuka] = useState(false);
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
  const [pribadiAwalId, setPribadiAwalId] = useState<string | null>(null);
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
  }, [notify]);

  useEffect(() => { muat(); }, [muat]);

  /** Perubahan satu memo (tim atau pribadi) di daftar yang tampil. */
  const perbaruiDimana = useCallback((id: string, patch: Partial<Memo>) => {
    const ganti = (d: Memo[]) => (d.some((x) => x.id === id) ? d.map((x) => (x.id === id ? { ...x, ...patch } : x)) : d);
    setMemo(ganti);
    setMemoPribadi(ganti);
  }, []);

  // Perubahan yang tertahan karena sinyal hilang dikirim ulang sendiri.
  useEffect(() => pasangPengirimTertunda((id, patch) => {
    perbaruiDimana(id, patch as Partial<Memo>);
    notify('PERUBAHAN MEMO TERKIRIM');
  }), [perbaruiDimana, notify]);

  const muatPropertiMemo = async () => {
    try { const b = await api<Bootstrap>('/api/bootstrap'); setPropertiMemo(b.propertiMemo ?? []); } catch { /* biarkan */ }
  };

  const bolehUbahMemo = useCallback(
    (m: Memo) => (m.lingkup === 'pribadi' ? true : m.user_id === pengguna.id || pengguna.peran === 'admin' || pengguna.peran === 'supervisor'),
    [pengguna],
  );

  /** Centang tugas dari tab Tugas/Kalender: baris ceklis di memo asalnya yang berubah. */
  const centangTugas = async (m: Memo, indeks: number) => {
    const baru = toggleBaris(m.isi, indeks);
    if (baru === m.isi) return;
    perbaruiDimana(m.id, { isi: baru });
    try {
      if ((await patchMemo(m.id, { isi: baru })) === 'tertunda') notify('TANPA SINYAL — DISIMPAN DI HP, DIKIRIM NANTI');
    } catch (e) {
      perbaruiDimana(m.id, { isi: m.isi });
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN');
    }
  };

  const bukaMemoDari = (m: Memo) => {
    if (m.lingkup === 'tim') { setTerpilihId(m.id); return; }
    setPribadiAwalId(m.id);
    setTab('pribadi');
  };

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return memo
      .filter((m) => (!q || `${m.judul} ${m.ringkasan ?? ''} ${m.isi}`.toLowerCase().includes(q))
        && (!saring.tipe || m.tipe === saring.tipe)
        && (!saring.status || m.status === saring.status))
      .sort((a, b) => (urut === 'judul'
        ? a.judul.localeCompare(b.judul)
        : urut === 'diubah'
          ? String(b.diubah_pada ?? b.dibuat_pada).localeCompare(String(a.diubah_pada ?? a.dibuat_pada))
          : String(b.tanggal ?? b.dibuat_pada).localeCompare(String(a.tanggal ?? a.dibuat_pada))));
  }, [memo, cari, saring, urut]);

  const buat = async (awal: { kategori?: string | null; status?: string | null } = {}) => {
    const body = {
      lingkup: 'tim',
      judul: '',
      isi: '',
      ringkasan: '',
      kategori: awal.kategori ?? kategori[0]?.nilai ?? null,
      tipe: null,
      status: awal.status ?? 'Draf',
      tanggal: W.hariIniWita(),
    };
    try {
      const d = await api<{ id: string }>('/api/memo', { body });
      const baru: Memo = {
        id: d.id, user_id: pengguna.id, penulis: pengguna.nama, lingkup: 'tim', judul: '', isi: '', ringkasan: '',
        kategori: body.kategori, tipe: null, status: body.status, tanggal: body.tanggal,
        disematkan: 0, warna: null, dibuat_pada: new Date().toISOString(), diubah_pada: null,
      };
      setMemo((m) => [baru, ...m]);
      setTerpilihId(d.id);
      if (!TAB_PAPAN.includes(tab)) setTab('ikhtisar');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT MEMO');
    }
  };

  const perbarui = useCallback((id: string, patch: Partial<Memo>) => {
    setMemo((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);

  const terpilih = memo.find((m) => m.id === terpilihId) ?? null;
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

      if (tab === 'tabel') {
        tersaring.forEach(tulis);
        pasangSaringan(k);
      } else {
        const kunci = tab === 'status' ? 'status' : 'kategori';
        const opsi = kunci === 'status' ? status : kategori;
        const grup = [...opsi.map((o) => ({ nilai: o.nilai, label: o.label, warna: o.warna })), { nilai: '', label: kunci === 'status' ? 'Tanpa status' : 'Tanpa kategori', warna: 'zinc' }];
        grup.forEach((g) => {
          const isi = tersaring.filter((m) => (m[kunci] ?? '') === g.nilai);
          // Seperti layar: Ikhtisar/Status menampilkan kolom kosong, Kategori tidak.
          if (!isi.length && (tab === 'kategori' || g.nilai === '')) return;
          k.kelompok(`${g.label} · ${isi.length} memo`, g.warna);
          isi.forEach(tulis);
        });
      }

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
    <KonteksGambarMemo.Provider value={{ kategori, tipe, status, pengunduh: pengguna.nama, notify }}>
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
              <p className="text-[11px] text-zinc-400">Arsip memo internal, MoM, dan penomoran surat resmi</p>
            </div>
          </div>

          <button
            onClick={toggleTema}
            className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 text-zinc-200 flex items-center gap-1.5 text-[11px] shadow-[2px_2px_0_#000]"
            title={temaAktif === 'gelap' ? 'Ganti ke Mode Terang (Lapangan)' : 'Ganti ke Mode Gelap'}
          >
            {temaAktif === 'gelap' ? <Sun size={13} className="text-amber-300" /> : <Moon size={13} className="text-indigo-400" />}
            <span className="hidden sm:inline font-mono font-bold">{temaAktif === 'gelap' ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>
        </div>
        {/* Baris 2: Tab Navigasi Utama (Tepat di bawah Judul) */}
        <div className="flex flex-wrap gap-1 border-b-4 border-white pb-2 mb-2">
          {TAB.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-bold border-2 transition-colors ${
                tab === t.id ? 'bg-lime-600 border-white text-white shadow-[2px_2px_0_#000]' : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              {t.ikon}{t.label}
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
                  className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-white font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
                >
                  <Plus size={12} /> Entri baru
                </button>
              )}

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
              <p className="text-[12px] text-zinc-400 mb-1">{tersaring.length} dari {memo.length} memo</p>
            )}
          </div>
        )}
      </div>

      {/* ---------- Isi ---------- */}
      <div ref={areaIsi} data-gambar-lepas className="flex-1 min-h-0 overflow-hidden px-3 pb-3" onClick={() => setAlat(null)}>
        {(memuat && TAB_PAPAN.includes(tab) || (memuat || memuatPribadi) && (tab === 'tugas' || tab === 'kalender')) && <p className="text-[13px] text-zinc-400 flex items-center gap-2 py-8 justify-center"><Loader2 size={14} className="animate-spin" /> Memuat…</p>}

        {!memuat && tab === 'ikhtisar' && (
          <Papan daftar={tersaring} kolom={kategori} kunci="kategori" tipe={tipe} status={status} onBuka={setTerpilihId} onBaru={bolehBuat ? (nilai) => buat({ kategori: nilai || null }) : undefined} />
        )}
        {!memuat && tab === 'status' && (
          <Papan daftar={tersaring} kolom={status} kunci="status" tipe={tipe} status={status} onBuka={setTerpilihId} onBaru={bolehBuat ? (nilai) => buat({ status: nilai || null }) : undefined} />
        )}
        {!memuat && tab === 'kategori' && (
          <DaftarKategori daftar={tersaring} kategori={kategori} tipe={tipe} status={status} onBuka={setTerpilihId} />
        )}
        {!memuat && tab === 'tabel' && (
          <TabelMemo daftar={tersaring} kategori={kategori} tipe={tipe} status={status} properti={propertiMemo} tim={boot.tim} onBuka={setTerpilihId} />
        )}
        {!memuat && !memuatPribadi && tab === 'tugas' && (
          <TugasMemo memos={[...memo, ...memoPribadi]} tim={boot.tim} idSaya={pengguna.id} bolehUbah={bolehUbahMemo} onCentang={centangTugas} onBukaMemo={bukaMemoDari} />
        )}
        {!memuat && !memuatPribadi && tab === 'kalender' && (
          <KalenderMemo memos={[...memo, ...memoPribadi]} tim={boot.tim} idSaya={pengguna.id} bolehUbah={bolehUbahMemo} onCentang={centangTugas} onBukaMemo={bukaMemoDari} />
        )}
        {tab === 'pribadi' && (
          <CatatanPribadi
            daftar={memoPribadi}
            setDaftar={setMemoPribadi}
            memuat={memuatPribadi}
            awalId={pribadiAwalId}
            onAwalDipakai={() => setPribadiAwalId(null)}
            tim={boot.tim}
            onBukaPica={onBukaPica}
            notify={notify}
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
          boleh={terpilih.user_id === pengguna.id || kelola}
          kelola={kelola}
          kategori={kategori}
          tipe={tipe}
          status={status}
          tim={boot.tim}
          properti={propertiMemo}
          onPropertiBaru={muatPropertiMemo}
          onBukaPica={onBukaPica ? (id) => { setTerpilihId(null); onBukaPica(id); } : undefined}
          onUbah={(patch) => perbarui(terpilih.id, patch)}
          onHapus={() => { setMemo((m) => m.filter((x) => x.id !== terpilih.id)); setTerpilihId(null); }}
          onTutup={() => setTerpilihId(null)}
          notify={notify}
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
const KonteksGambarMemo = React.createContext<{ kategori: Opsi[]; tipe: Opsi[]; status: Opsi[]; pengunduh: string; notify: (m: string) => void } | null>(null);

type MemoUntukGambar = Pick<Memo, 'judul' | 'isi' | 'ringkasan' | 'kategori' | 'tipe' | 'status' | 'tanggal' | 'penulis' | 'lingkup'>;

const KUNCI_GAYA_GAMBAR = 'pokemonkey_memo_gaya_gambar';

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
  if (!ctx) return null;
  const setGaya = (g: GayaGambarMemo) => { setGayaState(g); try { localStorage.setItem(KUNCI_GAYA_GAMBAR, g); } catch { /* abaikan */ } };
  const chip = (nilai: string | null, opsi: Opsi[]) => {
    if (!nilai) return null;
    const o = opsi.find((x) => x.nilai === nilai);
    return { label: o?.label ?? nilai, warna: o?.warna };
  };
  const jalankan = async (aksi: 'unduh' | 'bagikan') => {
    setBuka(false);
    setSibuk(true);
    const data = {
      judul: memo.judul, ringkasan: memo.ringkasan, isi: memo.isi, tanggal: tglMemo(memo.tanggal), penulis: memo.penulis,
      kategori: chip(memo.kategori, ctx.kategori), tipe: chip(memo.tipe, ctx.tipe), status: chip(memo.status, ctx.status),
      jenis: memo.lingkup === 'pribadi' ? 'Catatan Pribadi' : 'Memo Internal', pengunduh: ctx.pengunduh,
    };
    try {
      if (aksi === 'unduh') {
        const hasil = await unduhGambarMemo(data, gaya);
        ctx.notify(hasil === 'diunduh' ? 'GAMBAR MEMO DIUNDUH' : 'GAMBAR MEMO SIAP DISIMPAN / DIBAGIKAN');
      } else {
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
    <p className={`text-[15px] font-bold leading-snug pr-8 ${m.judul ? 'text-white' : 'text-zinc-500 italic'}`}>{m.judul || 'Tanpa judul'}</p>
    {(m.ringkasan || cuplikanMemo(m.isi)) && <p className="text-[13px] text-zinc-300 leading-snug line-clamp-3">{m.ringkasan || cuplikanMemo(m.isi)}</p>}
    {(m.tipe || m.pica_id || m.isi.includes('- [')) && (
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

const DaftarKategori: React.FC<{ daftar: Memo[]; kategori: Opsi[]; tipe: Opsi[]; status: Opsi[]; onBuka: (id: string) => void }> = ({ daftar, kategori, tipe, status, onBuka }) => (
  <div data-gambar-lepas className="h-full overflow-y-auto custom-scrollbar space-y-4 pr-1">
    {[...kategori, { grup: '', nilai: '', label: 'Tanpa kategori', warna: 'zinc', urutan: 999 }].map((k) => {
      const isi = daftar.filter((m) => (m.kategori ?? '') === k.nilai);
      if (isi.length === 0) return null;
      const w = warna(k.warna);
      return (
        <section key={k.nilai || '_'}>
          <div className={`flex items-center gap-2 border-b-2 pb-1 mb-1 ${w.garis}`}>
            <span className={`text-[14px] font-bold ${w.teks}`}>{k.label}</span>
            <span className="text-[12px] text-zinc-400">{isi.length}</span>
          </div>
          {isi.map((m) => (
            <button key={m.id} onClick={() => onBuka(m.id)} className="w-full text-left flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2 border-b border-white/10 hover:bg-white/5">
              <span className={`text-[14px] font-bold flex-1 min-w-[160px] ${m.judul ? 'text-white' : 'text-zinc-500 italic'}`}>{m.judul || 'Tanpa judul'}</span>
              <ChipOpsi nilai={m.tipe} opsi={tipe} />
              <ChipOpsi nilai={m.status} opsi={status} bulat />
              <span className="text-[12px] text-zinc-400 w-24 text-right">{tglMemo(m.tanggal)}</span>
            </button>
          ))}
        </section>
      );
    })}
    {daftar.length === 0 && <p className="text-[13px] text-zinc-400 text-center py-8">Belum ada memo.</p>}
  </div>
);

const TabelMemo: React.FC<{
  daftar: Memo[]; kategori: Opsi[]; tipe: Opsi[]; status: Opsi[]; properti: DefProperti[]; tim: AnggotaRingkas[]; onBuka: (id: string) => void;
}> = ({ daftar, kategori, tipe, status, properti, tim, onBuka }) => (
  <div data-gambar-lepas data-gambar-lebar className="h-full overflow-auto custom-scrollbar border-[3px] border-white/30">
    <table className="min-w-[860px] w-full text-[13px] border-collapse">
      <thead className="sticky top-0 z-10">
        <tr className="bg-zinc-900 text-zinc-300 text-[11px] uppercase">
          {['Judul', 'Kategori', 'Tipe', 'Status', 'Tanggal', 'Penulis', 'Tugas', 'PICA', ...properti.map((p) => p.label), 'Ringkasan'].map((h, i) => (
            <th key={`${i}-${h}`} className="text-left px-2 py-2 border-b-2 border-white/25 font-bold whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {daftar.map((m, i) => (
          <tr key={m.id} onClick={() => onBuka(m.id)} className={`cursor-pointer align-top hover:bg-lime-500/10 ${i % 2 ? 'bg-white/[0.03]' : ''}`}>
            <td className={`px-2 py-2 border-b border-white/10 font-bold min-w-[220px] ${m.judul ? 'text-white' : 'text-zinc-500 italic'}`}>{m.judul || 'Tanpa judul'}</td>
            <td className="px-2 py-2 border-b border-white/10"><ChipOpsi nilai={m.kategori} opsi={kategori} bulat /></td>
            <td className="px-2 py-2 border-b border-white/10"><ChipOpsi nilai={m.tipe} opsi={tipe} /></td>
            <td className="px-2 py-2 border-b border-white/10"><ChipOpsi nilai={m.status} opsi={status} bulat /></td>
            <td className="px-2 py-2 border-b border-white/10 whitespace-nowrap text-zinc-300">{tglMemo(m.tanggal)}</td>
            <td className="px-2 py-2 border-b border-white/10 whitespace-nowrap text-zinc-300">{m.penulis ?? '—'}</td>
            <td className="px-2 py-2 border-b border-white/10"><ChipTugas isi={m.isi} /></td>
            <td className="px-2 py-2 border-b border-white/10"><ChipPica memo={m} /></td>
            {properti.map((p) => {
              const v = bacaProps(m)[p.id];
              return <td key={p.id} className="px-2 py-2 border-b border-white/10 text-zinc-300 whitespace-nowrap max-w-[220px] truncate">{teksNilai(p, v, tim)}</td>;
            })}
            <td className="px-2 py-2 border-b border-white/10 text-zinc-400 min-w-[260px]">{m.ringkasan || cuplikanMemo(m.isi)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {daftar.length === 0 && <p className="text-[13px] text-zinc-400 text-center py-8">Belum ada memo.</p>}
  </div>
);

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
// Halaman satu memo
// ============================================================

/** Baris properti ala halaman Notion. Di luar LembarMemo agar isinya tidak dipasang ulang tiap ketikan. */
const Properti: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-3 min-h-[34px]">
    <span className="w-20 shrink-0 text-[12px] text-zinc-400">{label}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const LembarMemo: React.FC<{
  memo: Memo; boleh: boolean; kelola: boolean; kategori: Opsi[]; tipe: Opsi[]; status: Opsi[];
  tim: AnggotaRingkas[]; properti: DefProperti[]; onPropertiBaru: () => void; onBukaPica?: (id: string) => void;
  onUbah: (patch: Partial<Memo>) => void; onHapus: () => void; onTutup: () => void; notify: (m: string) => void;
}> = ({ memo, boleh, kelola, kategori, tipe, status, tim, properti, onPropertiBaru, onBukaPica, onUbah, onHapus, onTutup, notify }) => {
  const [judul, setJudul] = useState(memo.judul);
  const [ringkasan, setRingkasan] = useState(memo.ringkasan ?? '');
  const [isi, setIsi] = useState(memo.isi);
  const [status_, setStatusSimpan] = useState<StatusSimpan>('tersimpan');
  const tertunda = useRef<PatchMemo>({});
  const pewaktu = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const kirim = useCallback(async () => {
    const patch = tertunda.current;
    tertunda.current = {};
    if (Object.keys(patch).length === 0) return;
    setStatusSimpan('menyimpan');
    try {
      const hasil = await patchMemo(memo.id, patch);
      onUbah({ ...patch, diubah_pada: new Date().toISOString() } as Partial<Memo>);
      setStatusSimpan(hasil);
    } catch (e) {
      setStatusSimpan('mengetik');
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN MEMO');
    }
  }, [memo.id, onUbah, notify]);

  const jadwalkan = (patch: PatchMemo, segera = false) => {
    if (!boleh) return;
    tertunda.current = { ...tertunda.current, ...patch };
    setStatusSimpan('mengetik');
    if (pewaktu.current) clearTimeout(pewaktu.current);
    pewaktu.current = setTimeout(kirim, segera ? 0 : 700);
  };

  const tutup = async () => {
    if (pewaktu.current) clearTimeout(pewaktu.current);
    await kirim();
    // Entri baru yang dibiarkan kosong tidak ikut mengotori papan tim.
    if (boleh && !judul.trim() && !ringkasan.trim() && !isi.trim()) {
      try { await api(`/api/memo/${memo.id}`, { method: 'DELETE' }); onHapus(); return; } catch { /* biarkan */ }
    }
    onTutup();
  };

  const hapus = async () => {
    if (!confirm(`Hapus memo "${judul || 'Tanpa judul'}"?`)) return;
    try { await api(`/api/memo/${memo.id}`, { method: 'DELETE' }); notify('MEMO DIHAPUS'); onHapus(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGHAPUS'); }
  };

  const pilih = (nilai: string | null, opsi: Opsi[], kunci: 'kategori' | 'tipe' | 'status') => (boleh ? (
    <select value={nilai ?? ''} onChange={(e) => { const v = e.target.value || null; onUbah({ [kunci]: v }); jadwalkan({ [kunci]: v }, true); }} className="input-retro !py-1 !text-[13px] !w-auto max-w-full">
      <option value="">—</option>{opsi.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
    </select>
  ) : <ChipOpsi nilai={nilai} opsi={opsi} bulat={kunci !== 'tipe'} />);

  const nilaiProps = bacaProps(memo);
  const ubahProps = (p: DefProperti, v: string | number | boolean | null) => {
    const teks = JSON.stringify({ ...bacaProps(memo), [p.id]: v });
    onUbah({ props: teks });
    // Ketikan teks/angka/tautan ditunda; pilihan, tanggal, dan centang langsung dikirim.
    jadwalkan({ props: teks }, !['teks', 'angka', 'url'].includes(p.tipe));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4" onClick={tutup}>
      <div className="retro-box !bg-zinc-900 border-lime-500 w-full md:max-w-3xl max-h-[94vh] flex flex-col !p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2 border-b-2 border-white/15 shrink-0">
          <span className="text-[12px] text-zinc-400 flex-1 truncate">Memo Internal{boleh ? '' : ' · baca-saja'}</span>
          {boleh && <TandaSimpan status={status_} />}
          <BagikanMemo memoId={memo.id} judul={judul} notify={notify} />
          <TombolGambarMemo memo={{ ...memo, judul, ringkasan, isi }} />
          {boleh && <button onClick={hapus} className="btn-ikon !w-8 !h-8 bg-red-900" title="Hapus"><Trash2 size={14} /></button>}
          <button onClick={tutup} className="text-zinc-400 hover:text-white" aria-label="Tutup"><X size={22} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3">
          {boleh ? (
            <input autoFocus={!memo.judul} value={judul} onChange={(e) => { setJudul(e.target.value); jadwalkan({ judul: e.target.value }); }} placeholder="Tanpa judul" className="w-full bg-transparent text-[22px] font-bold text-white outline-none placeholder:text-zinc-600" />
          ) : (
            <h3 className="text-[22px] font-bold text-white leading-snug">{judul || 'Tanpa judul'}</h3>
          )}

          <div className="space-y-0.5">
            <Properti label="Kategori">{pilih(memo.kategori, kategori, 'kategori')}</Properti>
            <Properti label="Tipe">{pilih(memo.tipe, tipe, 'tipe')}</Properti>
            <Properti label="Status">{pilih(memo.status, status, 'status')}</Properti>
            <Properti label="Tanggal">
              {boleh
                ? <input type="date" value={memo.tanggal ?? ''} onChange={(e) => { onUbah({ tanggal: e.target.value || null }); jadwalkan({ tanggal: e.target.value || null }, true); }} className="input-retro !py-1 !text-[13px] !w-auto" />
                : <span className="text-[13px] text-zinc-200">{tglMemo(memo.tanggal) || '—'}</span>}
            </Properti>
            <Properti label="Penulis"><span className="text-[13px] text-zinc-200 flex items-center gap-1"><User size={12} /> {memo.penulis ?? '—'}</span></Properti>
            <Properti label="PICA">
              <PilihPicaMemo
                memo={memo}
                boleh={boleh}
                onBukaPica={onBukaPica}
                onUbah={(id, r) => { onUbah({ pica_id: id, pica_no: r.no, pica_judul: r.judul, pica_status: r.status }); jadwalkan({ pica_id: id }, true); }}
              />
            </Properti>
            {isi.includes('- [') && <Properti label="Tugas"><ChipTugas isi={isi} /></Properti>}
            {properti.map((p) => (
              <Properti key={p.id} label={p.label}>
                <EditorProperti p={p} nilai={nilaiProps[p.id]} tim={tim} boleh={boleh} onUbah={(v) => ubahProps(p, v)} />
              </Properti>
            ))}
            {kelola && <TambahPropertiMemo ada={properti} notify={notify} onSelesai={onPropertiBaru} />}
          </div>

          <div>
            <label className="label-retro">Ringkasan (tampil di kartu)</label>
            {boleh
              ? <textarea value={ringkasan} onChange={(e) => { setRingkasan(e.target.value); jadwalkan({ ringkasan: e.target.value }); }} className="input-retro h-16 resize-none !text-[13px]" placeholder="Dua–tiga kalimat inti memo…" />
              : <p className="text-[13px] text-zinc-200">{ringkasan || '—'}</p>}
          </div>

          <div className="border-t-2 border-white/10 pt-3">
            <EditorMemo
              memoId={memo.id}
              isi={isi}
              onIsi={(baru) => { setIsi(baru); jadwalkan({ isi: baru }); }}
              boleh={boleh}
              tim={tim}
              notify={notify}
              bolehSebutOrang
              onBukaPica={onBukaPica}
              tinggi={240}
            />
          </div>
        </div>
      </div>
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
// Catatan pribadi (hanya pemiliknya)
// ============================================================

const TEMPLATE: { nama: string; judul: string; isi: string }[] = [
  { nama: 'Kosong', judul: '', isi: '' },
  { nama: 'Rencana harian', judul: `Rencana ${W.formatPanjang(W.hariIniWita())}`, isi: `# Prioritas\n- [ ]  @${W.hariIniWita()}\n- [ ] \n- [ ] \n\n## Lapangan\n- [ ] \n\n## Catatan\n` },
  { nama: 'Catatan rapat', judul: 'Catatan rapat', isi: '# Peserta\n- \n\n# Keputusan\n- \n\n# Tindak lanjut\n- [ ] Apa · kapan\n' },
  { nama: 'Daftar tugas', judul: 'Daftar tugas', isi: '- [ ] \n- [ ] \n- [ ] \n' },
];

const WARNA_PRIBADI: Record<string, string> = { amber: 'border-l-amber-400', cyan: 'border-l-cyan-400', emerald: 'border-l-emerald-400', pink: 'border-l-pink-400', purple: 'border-l-purple-400' };
const TITIK_PRIBADI: Record<string, string> = { amber: 'bg-amber-400', cyan: 'bg-cyan-400', emerald: 'bg-emerald-400', pink: 'bg-pink-400', purple: 'bg-purple-400' };

const CatatanPribadi: React.FC<{
  daftar: Memo[];
  setDaftar: React.Dispatch<React.SetStateAction<Memo[]>>;
  memuat: boolean;
  /** Dibuka dari tab Tugas/Kalender. */
  awalId: string | null;
  onAwalDipakai: () => void;
  tim: AnggotaRingkas[];
  onBukaPica?: (id: string) => void;
  notify: (m: string) => void;
}> = ({ daftar, setDaftar, memuat, awalId, onAwalDipakai, tim, onBukaPica, notify }) => {
  const [aktifId, setAktifId] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  const [templateBuka, setTemplateBuka] = useState(false);
  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [status, setStatus] = useState<StatusSimpan>('tersimpan');
  const simpanRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const aktif = daftar.find((m) => m.id === aktifId) ?? null;

  const buka = (m: Memo) => { setAktifId(m.id); setJudul(m.judul); setIsi(m.isi); setStatus('tersimpan'); };

  useEffect(() => {
    if (!awalId) return;
    const m = daftar.find((x) => x.id === awalId);
    if (m) { buka(m); onAwalDipakai(); }
  }, [awalId, daftar]); // eslint-disable-line react-hooks/exhaustive-deps

  const jadwalkan = (j: string, i: string) => {
    if (!aktifId) return;
    const id = aktifId;
    setStatus('mengetik');
    if (simpanRef.current) clearTimeout(simpanRef.current);
    simpanRef.current = setTimeout(async () => {
      setStatus('menyimpan');
      try {
        const hasil = await patchMemo(id, { judul: j, isi: i });
        setDaftar((d) => d.map((m) => (m.id === id ? { ...m, judul: j, isi: i, diubah_pada: new Date().toISOString() } : m)));
        setStatus(hasil);
      } catch { setStatus('mengetik'); notify('GAGAL MENYIMPAN CATATAN'); }
    }, 800);
  };

  const buat = async (t: typeof TEMPLATE[number]) => {
    setTemplateBuka(false);
    try {
      const d = await api<{ id: string }>('/api/memo', { body: { lingkup: 'pribadi', judul: t.judul, isi: t.isi } });
      const baru: Memo = { id: d.id, lingkup: 'pribadi', judul: t.judul, isi: t.isi, ringkasan: null, kategori: null, tipe: null, status: null, tanggal: null, disematkan: 0, warna: null, dibuat_pada: new Date().toISOString(), diubah_pada: null };
      setDaftar((x) => [baru, ...x]);
      buka(baru);
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT CATATAN'); }
  };

  const ubah = async (m: Memo, patch: Partial<Memo>) => {
    try { await api(`/api/memo/${m.id}`, { method: 'PATCH', body: patch }); setDaftar((d) => d.map((x) => (x.id === m.id ? { ...x, ...patch } : x))); }
    catch { notify('GAGAL'); }
  };

  const hapus = async (m: Memo) => {
    if (!confirm(`Hapus catatan "${m.judul || 'Tanpa judul'}"?`)) return;
    try { await api(`/api/memo/${m.id}`, { method: 'DELETE' }); setDaftar((d) => d.filter((x) => x.id !== m.id)); if (aktifId === m.id) setAktifId(null); }
    catch { notify('GAGAL MENGHAPUS'); }
  };

  const tersaring = daftar.filter((m) => !cari || `${m.judul} ${m.isi}`.toLowerCase().includes(cari.toLowerCase()));

  return (
    <div className="flex h-full gap-3 min-h-0">
      <div className={`${aktif ? 'hidden md:flex' : 'flex'} w-full md:w-72 shrink-0 flex-col min-h-0`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari catatan…" className="input-retro !pl-8 !py-1.5 !text-[13px]" />
          </div>
          <div className="relative">
            <button onClick={() => setTemplateBuka((v) => !v)} className="btn-retro btn-retro-sm bg-lime-600"><Plus size={12} /> Baru <ChevronDown size={11} /></button>
            {templateBuka && (
              <div className="absolute right-0 top-full mt-1 z-30 retro-box !bg-zinc-900 !p-1 w-44 border-lime-500">
                {TEMPLATE.map((t) => <button key={t.nama} onClick={() => buat(t)} className="block w-full text-left px-2 py-1.5 text-[13px] hover:bg-white/10">{t.nama}</button>)}
              </div>
            )}
          </div>
        </div>
        <p className="text-[11px] text-zinc-500 mb-2 flex items-center gap-1"><Lock size={10} /> Hanya terlihat oleh Anda</p>
        <div className="flex-1 overflow-auto custom-scrollbar space-y-1.5 min-h-0">
          {memuat && <p className="text-[12px] text-zinc-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> memuat…</p>}
          {!memuat && tersaring.length === 0 && <p className="text-[12px] text-zinc-400 text-center py-8">Belum ada catatan. Tekan <b>Baru</b>.</p>}
          {tersaring.map((m) => {
            const { selesai, total } = hitungTugas(m.isi);
            return (
              <button key={m.id} onClick={() => buka(m)} className={`w-full text-left panel-retro !p-2 border-l-4 ${m.warna ? WARNA_PRIBADI[m.warna] : 'border-l-zinc-500'} ${aktifId === m.id ? '!bg-lime-950/40 !border-white/50' : ''}`}>
                <div className="flex items-center gap-1">
                  {m.disematkan ? <Pin size={11} className="text-lime-300 shrink-0" /> : null}
                  <p className="text-[14px] font-bold text-white truncate flex-1">{m.judul || 'Tanpa judul'}</p>
                </div>
                <p className="text-[12px] text-zinc-300 truncate">{cuplikanMemo(m.isi)}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{W.formatWaktuIso(m.diubah_pada ?? m.dibuat_pada)}{total ? ` · ${selesai}/${total} selesai` : ''}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`${aktif ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 min-h-0`}>
        {aktif ? (
          <>
            <div className="flex items-center gap-1.5 mb-2">
              <button onClick={() => setAktifId(null)} className="md:hidden btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Kembali ke daftar"><ChevronLeft size={16} /></button>
              <input value={judul} onChange={(e) => { setJudul(e.target.value); jadwalkan(e.target.value, isi); }} placeholder="Judul catatan" className="flex-1 bg-transparent text-[18px] font-bold text-white outline-none border-b-2 border-transparent focus:border-lime-400 min-w-0" />
              <TandaSimpan status={status} className="hidden sm:inline" />
              <button onClick={() => ubah(aktif, { disematkan: aktif.disematkan ? 0 : 1 })} className={`btn-ikon !w-8 !h-8 ${aktif.disematkan ? 'bg-lime-600' : 'bg-zinc-800'}`} title="Sematkan">{aktif.disematkan ? <PinOff size={14} /> : <Pin size={14} />}</button>
              <BagikanMemo memoId={aktif.id} judul={judul} pribadi kecil notify={notify} />
              <TombolGambarMemo memo={{ ...aktif, judul, isi }} kecil />
              <button onClick={() => hapus(aktif)} className="btn-ikon !w-8 !h-8 bg-red-900" title="Hapus"><Trash2 size={14} /></button>
            </div>
            <div className="flex items-center gap-1 mb-2">
              {Object.keys(WARNA_PRIBADI).map((w) => <button key={w} onClick={() => ubah(aktif, { warna: aktif.warna === w ? null : w })} className={`w-4 h-4 border-2 ${aktif.warna === w ? 'border-white' : 'border-transparent'} ${TITIK_PRIBADI[w]}`} aria-label={`Warna ${w}`} />)}
            </div>
            <EditorMemo
              key={aktif.id}
              memoId={aktif.id}
              isi={isi}
              onIsi={(baru) => { setIsi(baru); jadwalkan(judul, baru); }}
              boleh
              tim={tim}
              notify={notify}
              onBukaPica={onBukaPica}
              tinggi="penuh"
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-500">Pilih catatan di kiri atau buat yang baru.</div>
        )}
      </div>
    </div>
  );
};
