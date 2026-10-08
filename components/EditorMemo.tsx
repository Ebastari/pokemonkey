import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter, AlignLeft, AlignRight, AtSign, Bold, CalendarClock, CheckSquare, ChevronDown, ChevronRight, ChevronUp, Code, Columns2, Copy, FileText,
  GripVertical, Highlighter, ImagePlus, ImageOff, Info, Italic, Link2, ListChecks, ListIndentDecrease, ListIndentIncrease, Loader2,
  Lock, MessageSquare, Palette, Paperclip, Plus, RefreshCw, Send, Sigma, SlidersHorizontal, Sparkles, Strikethrough, Trash2, Type, Underline, X,
} from 'lucide-react';
import {
  INDENT, MAKS_BARIS_TABEL, MAKS_KOLOM_TABEL, ambilTugas, bacaTabel, daftarJudul, jamSah, pisahIndent, rakitData, rakitGambar, rakitKode,
  rakitGrafik, rakitPenanda, rakitRumus, rakitTabel, tanggalSah, toggleBaris, ubahTenggatBaris, uraiBlok, uraiInline, type Inline, type RataGambar,
  type InfoPicaLive,
} from '../server/src/memo-blok';
import { BAHASA_KODE, WARNA_KODE, WARNA_LATAR, WARNA_TEKS, sorotKode } from '../server/src/tampil-memo';
import { katexSiap, muatKatex, rumusHtml } from '../lib/rumus';
import { cariEmoji } from '../lib/emoji';
import { api } from '../lib/api';
import {
  BLOK_TEKS, bacaBaris, cekPintasan, dariDom, jenisLanjutan, keHtml, kursorDiTepi, offsetKursor, panjangTampil,
  pasangKursor, potongDiKursor, rakitBaris, rentang, type JenisBlok, type PetaHalaman,
} from '../lib/memo-dom';
import { barisUntukUnggah, kecilkanGambar, unduhBerkasMemo, unggahKeMemo } from '../lib/memo-gambar';
import { useFotoProfil } from '../lib/foto';
import type { AnggotaRingkas } from '../lib/tipe-api';
import * as W from '../lib/waktu';
import { BlokRumus, DaftarIsi, IsiMemo, KartuPenanda, KartuVideo, gayaGambar } from './MemoMarkup';
import { KartuDataLapangan } from './KartuDataLapangan';
import { DAFTAR_BLOK, UBAH_JADI, cocokKueri, skorKueri, type DefinisiBlok } from '../lib/blok-jenis';
import { GrafikTabelMemo, LencanaStatus, RingkasanProgres } from './GrafikTabelMemo';
import { GrafikReklamasi } from './GrafikReklamasi';
import { ModalPilihPica } from './ModalPilihPica';
import { ModalImporTabel } from './ModalImporTabel';
import { ModalHabit } from './ModalHabit';
import { uraiClipboard, uraiTsvKeMatriks } from '../lib/memo-clipboard';
import { sinkronkanTabelPica, capWaktuSekarang, capDitetapkanSekarang, cariIdPica, kolomNoPica } from '../lib/pica-tabel';
import { hitungRingkasanTabel, toggleStatusBarisTabel, buatOpsiGrafikOtomatis, lebarKolomTabel, sesuaikanGrafik, cekNilaiSelesai, ringkasanTanpa } from '../lib/tabel-interaktif';
import { barisMendatang } from '../server/src/grafik-tabel';

/**
 * Penyunting memo gaya Notion: halaman berisi blok yang langsung jadi saat
 * diketik — tanpa mode Tulis/Baca dan tanpa tanda # atau - [ ] yang terlihat.
 *
 *  - tiap baris = satu blok; arahkan tetikus untuk "+" (blok baru) dan "⋮⋮"
 *    (seret untuk memindah, ketuk untuk Ubah jadi / Duplikat / Hapus)
 *  - "/" membuka menu blok; pintasan ketik "# ", "- ", "[] ", "1. ", "\" ", "---"
 *  - Enter membuat blok baru (daftar berlanjut), Backspace di awal blok
 *    mengubahnya jadi teks lalu menggabungkan dengan blok di atasnya
 *  - di HP: bilah alat di atas papan ketik menggantikan tombol yang muncul saat arah tetikus
 *
 * Isi tetap teks satu-blok-per-baris (server/src/memo-blok.ts), jadi data lama,
 * Jadwal dari ceklis, poster, dan ekspor tidak berubah.
 */

interface Props {
  memoId: string;
  isi: string;
  onIsi: (baru: string) => void;
  boleh: boolean;
  tim: AnggotaRingkas[];
  notify: (m: string) => void;
  /** Memo tim boleh menyebut orang (@id) sebagai penanggung jawab ceklis; memo pribadi tidak. */
  bolehSebutOrang?: boolean;
  onBukaPica?: (idPica: string) => void;
  /** Angka = tinggi minimum halaman (px); 'penuh' = mengisi wadah dan bergulir sendiri. */
  tinggi?: number | 'penuh';
  /** Teks kecil (menu ••• halaman): ukuran dasar 14px, bukan 16px. */
  kecil?: boolean;
  /** Pilihan font gaya Notion: 'sans' | 'serif' | 'mono' | 'retro'. */
  font?: 'sans' | 'serif' | 'mono' | 'retro';
  /** Latar belakang memo: 'putih' | 'gelap' | 'lapangan'. */
  latar?: 'putih' | 'gelap' | 'lapangan';
  /** Teks saat memo kosong dan hanya bisa dibaca. */
  kosong?: string;
  /** Memo lain yang bisa ditautkan lewat "Tautan ke halaman". */
  halaman?: { id: string; judul: string; ikon?: string }[];
  /** Membuka memo lain dari chip tautan halaman. */
  onBukaHalaman?: (idMemo: string) => void;
  /** Blok "Halaman" (menu "/"): buat sub-halaman di dalam memo ini; null = gagal. */
  onBuatHalaman?: () => Promise<{ id: string; judul: string } | null>;
  /** Komentar pada teks yang dipilih (bilah format); kutipan = teks terpilih. */
  onKomentar?: (kutipan: string) => void;
  /**
   * AI (Gemini lewat server): olah teks terpilih atau tulis blok baru di posisi kursor.
   * Mengembalikan teks memo yang sudah disaring server.
   */
  onAi?: (p: { mode: 'pilihan' | 'tulis'; aksi?: string; pilihan?: string; instruksi?: string }) => Promise<{ teks: string; catatan?: string }>;
  /** Memo "Baca saja": pembaca tetap boleh mencentang tugas yang menyebut dirinya (`@idSaya`). */
  idSaya?: string;
  onCentangBaca?: (baru: string) => void;
}

type Ikon = React.ComponentType<{ size?: number; className?: string }>;

/** Daftar halaman → peta judul/ikon terkini untuk chip halaman (undefined = tidak diketahui). */
const petaHalaman = (d?: Props['halaman']): PetaHalaman | undefined => (d ? new Map(d.map((h) => [h.id, h])) : undefined);

/**
 * Satu blok di penyunting. `raw` = baris tanpa indentasi; `dalam` = kedalaman
 * sarang (anak dari blok di atasnya, seperti "content" di Notion). Disimpan
 * sebagai 2 spasi per tingkat di depan baris.
 */
interface Blok { id: string; raw: string; v: number; dalam?: number }
interface Fokus { id: string; pos: number | 'akhir' }

let seri = 0;
const idBaru = () => `b${Date.now().toString(36)}${(seri++).toString(36)}`;
const dariTeks = (t: string): Blok[] => t.split('\n').map((baris) => {
  const { kedalaman, isi } = pisahIndent(baris);
  return { id: idBaru(), raw: isi, v: 0, dalam: kedalaman };
});
const keTeks = (b: readonly Blok[]) => b.map((x) => INDENT.repeat(x.dalam ?? 0) + x.raw).join('\n');
const dlm = (b: Blok | undefined) => b?.dalam ?? 0;

/** Blok teks tanpa isi (mis. butir/tugas yang baru dibuat): perintah "/" menggantinya, seperti Notion. */
const tanpaIsi = (b: Blok | undefined): boolean => {
  if (!b) return false;
  const info = bacaBaris(b.raw);
  return BLOK_TEKS.has(info.jenis) && info.isi.trim() === '';
};

/** Indeks akhir (eksklusif) subpohon blok i: blok-blok sesudahnya yang lebih dalam. */
function akhirSubpohon(arr: readonly Blok[], i: number): number {
  const d = dlm(arr[i]);
  let j = i + 1;
  while (j < arr.length && dlm(arr[j]) > d) j += 1;
  return j;
}

// Peralatan blok dibaca dari satu daftar (lib/blok-jenis.ts), seperti di Notion.
type Perintah = Omit<DefinisiBlok, 'grup'> & { grup?: string };

/** Panel AI di penyunting: teks terpilih (satu/sebagian/beberapa blok) atau tulis baru di blok kursor. */
interface PanelAi {
  idMulai: string; idAkhir: string;
  /** Posisi huruf pilihan di dalam satu blok (bila pilihan tidak melewati batas blok). */
  dari?: number; sampai?: number;
  pilihan: string;
  mode: 'pilihan' | 'tulis';
  status: 'pilih' | 'memuat' | 'siap' | 'galat';
  hasil?: string; pesan?: string;
}

const AKSI_AI: [string, string][] = [
  ['perbaiki', 'Perbaiki tulisan'], ['persingkat', 'Persingkat'], ['perpanjang', 'Perpanjang'], ['lanjutkan', 'Lanjutkan tulisan'],
  ['resmi', 'Lebih resmi'], ['sederhana', 'Lebih sederhana'], ['ceklis', 'Jadikan ceklis'], ['tabel', 'Jadikan tabel'],
  ['inggris', 'Ke bahasa Inggris'], ['indonesia', 'Ke bahasa Indonesia'],
];
const CONTOH_TULIS_AI = ['Notulen rapat dari catatan di atas', 'Ceklis tindak lanjut minggu ini', 'Tabel rekap dari data di atas', 'Paragraf pembuka memo'];

/** Ikon menu untuk satu emoji (komponen dibuat sekali per emoji). */
const ikonEmojiSimpan = new Map<string, React.ComponentType<{ size?: number; className?: string }>>();
function ikonEmoji(e: string): React.ComponentType<{ size?: number; className?: string }> {
  let k = ikonEmojiSimpan.get(e);
  if (!k) {
    k = () => <span className="text-[15px] leading-none">{e}</span>;
    ikonEmojiSimpan.set(e, k);
  }
  return k;
}

/** Isi blok tanpa pembungkus warna seluruh blok ({w:…|isi} → isi). */
const lepasWarnaBlok = (isi: string) => isi.match(/^\{[wl]:[a-z]+\|([^{}\n]*)\}$/)?.[1] ?? isi;

const LABEL_MEDIA: Partial<Record<JenisBlok, string>> = {
  garis: 'Divider', gambar: 'Gambar', video: 'Video', tabel: 'Tabel', data: 'Data Lapangan', kode: 'Kode', rumus: 'Rumus',
  daftarisi: 'Daftar isi', kolom: 'Kolom', penanda: 'Tautan web', grafik: 'Grafik realisasi reklamasi',
};

const PH: Partial<Record<JenisBlok, string>> = Object.fromEntries(
  DAFTAR_BLOK.filter((d) => d.jenis && d.penanda).map((d) => [d.jenis, d.penanda]),
);

// Ukuran mengikuti Notion (teks 16/24, Judul 1/2/3 = 30/24/20 px) dalam em, agar "Teks kecil" ikut mengecil.
const KELAS_BARIS: Partial<Record<JenisBlok, string>> = {
  h1: 'mt-6 mb-0.5 first:mt-0', h2: 'mt-5 first:mt-0', h3: 'mt-3 first:mt-0', h4: 'mt-2 first:mt-0',
  kutipan: 'border-l-4 border-lime-500/60 pl-3 my-0.5',
  penting: 'border-2 border-amber-400/70 bg-amber-950/30 px-2.5 py-1.5 my-1',
};

const KELAS_TEKS: Record<string, string> = {
  teks: 'text-zinc-100',
  h1: 'text-[1.875em] !leading-[1.3] font-bold text-lime-300',
  h2: 'text-[1.5em] !leading-[1.3] font-bold text-white',
  h3: 'text-[1.25em] !leading-[1.3] font-bold text-zinc-100',
  h4: 'text-[1.0625em] !leading-[1.35] font-bold text-zinc-200',
  butir: 'text-zinc-100', nomor: 'text-zinc-100', ceklis: 'text-zinc-100', toggle: 'text-zinc-100', kutipan: 'italic text-zinc-300', penting: 'text-zinc-100',
};

// ============================================================
// Pembungkus: memo yang tidak boleh diubah cukup ditampilkan
// ============================================================

export const EditorMemo: React.FC<Props> = (props) => {
  const kelasFont = props.font === 'serif' ? 'memo-font-serif font-serif' : props.font === 'mono' ? 'memo-font-mono font-mono' : props.font === 'retro' ? 'memo-font-retro' : 'memo-font-sans font-sans';
  const kelasLatar = props.latar === 'putih' ? 'memo-latar-putih' : '';
  if (!props.boleh) {
    const penuh = props.tinggi === 'penuh';
    const milik = props.onCentangBaca && props.idSaya
      ? new Set(ambilTugas(props.isi).filter((t) => t.pic === props.idSaya).map((t) => t.indeks))
      : null;
    return (
      <div className={`${props.kecil ? 'text-[14px]' : 'text-[16px]'} leading-[1.5] ${kelasFont} ${kelasLatar} ${penuh ? 'flex-1 overflow-auto custom-scrollbar min-h-0' : ''}`}>
        <IsiMemo
          isi={props.isi}
          kosong={props.kosong ?? 'Belum ada isi.'}
          tim={props.tim}
          onBukaPica={props.onBukaPica}
          onBukaHalaman={props.onBukaHalaman}
          halaman={petaHalaman(props.halaman)}
          onToggle={milik?.size ? (i) => props.onCentangBaca?.(toggleBaris(props.isi, i)) : undefined}
          bolehToggle={milik ? (i) => milik.has(i) : undefined}
        />
      </div>
    );
  }
  return <EditorBlok {...props} />;
};

// ============================================================
// Satu blok
// ============================================================

interface Penangan {
  daftar: (id: string, el: HTMLElement | null) => void;
  centang: (id: string) => void;
  pegang: (e: React.PointerEvent, id: string) => void;
  tambahDi: (id: string) => void;
  /** Buka/lipat toggle. */
  lipat: (id: string) => void;
  /** Ganti seluruh baris blok (mis. tabel yang disunting sel per sel). */
  ubahRaw: (id: string, raw: string) => void;
  /** Gulir ke blok ke-n (daftar isi). */
  lompat: (indeks: number) => void;
  /** Buka PICA (dari nomor "PICA-006" di tabel PICA) di menu PICA. */
  bukaPica: (nomor: string) => void;
}

/**
 * Tabel ala Notion: sel bisa langsung diketik; "+ Baris", "+ Kolom", hapus
 * baris/kolom, dan baris judul. Disimpan sebagai satu baris `!tabel{…}`.
 */
/**
 * Sel tabel penyunting: teks panjang dibungkus ke bawah dan tinggi baris mengikuti
 * isinya, jadi Masalah / Akar Masalah / Tindakan terbaca utuh (tidak terpotong).
 * Isi tetap satu baris data (ganti baris diabaikan); Enter = sel di bawahnya.
 */
const SelTabel: React.FC<{
  nilai: string; judul: boolean; lebarMin: number; sel: string; label: string;
  onIsi: (v: string) => void; onTombol: (e: React.KeyboardEvent) => void; onEnter: () => void; onTempel: (e: React.ClipboardEvent) => void;
}> = ({ nilai, judul, lebarMin, sel, label, onIsi, onTombol, onEnter, onTempel }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const tinggikan = () => {
    const t = ref.current;
    if (!t) return;
    t.style.height = '0px';
    t.style.height = `${t.scrollHeight}px`;
  };
  useLayoutEffect(tinggikan, [nilai, lebarMin]);
  // Lebar kolom ikut berubah saat sel lain diketik: tinggi dihitung ulang.
  useEffect(() => {
    const t = ref.current;
    if (!t || typeof ResizeObserver === 'undefined') return;
    let lebar = t.clientWidth;
    const ro = new ResizeObserver(() => { if (t.clientWidth !== lebar) { lebar = t.clientWidth; tinggikan(); } });
    ro.observe(t);
    return () => ro.disconnect();
  }, []);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={nilai}
      onChange={(e) => onIsi(e.target.value.replace(/[\r\n]+/g, ' '))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter(); return; }
        onTombol(e);
      }}
      onPaste={onTempel}
      data-sel={sel}
      style={{ minWidth: lebarMin }}
      className={`block w-full bg-transparent px-2 py-1.5 outline-none focus:bg-lime-500/10 resize-none overflow-hidden whitespace-pre-wrap break-words leading-snug ${judul ? 'font-bold text-white' : 'text-zinc-100'}`}
      placeholder={judul ? label : ''}
      aria-label={label}
    />
  );
};

const TabelSunting: React.FC<{ raw: string; onUbah: (raw: string) => void; onBukaPica?: (nomor: string) => void }> = ({ raw, onUbah, onBukaPica }) => {
  const kisi = useRef<HTMLDivElement>(null);
  const t = bacaTabel(raw);
  if (!t) return null;
  const { baris, kepala, grafik, pica } = t;
  const [modalPicaBuka, setModalPicaBuka] = useState(false);
  const [modalImporBuka, setModalImporBuka] = useState(false);
  const [kolomLebar, setKolomLebar] = useState(false);
  const [memuatSync, setMemuatSync] = useState(false);

  const infoProgres = useMemo(() => hitungRingkasanTabel(baris), [baris]);
  const lebarKolom = useMemo(() => lebarKolomTabel(baris, kolomLebar), [baris, kolomLebar]);
  const mendatang = useMemo(() => (grafik ? barisMendatang(baris, kepala, grafik) : new Set<number>()), [baris, kepala, grafik]);
  // Grafik yang sudah ada ikut menunjuk kolom yang sama walau kolom dihapus/disisip/diimpor ulang.
  const kirim = (b: string[][], k = kepala, g = grafik, p = pica) =>
    onUbah(rakitTabel(b, k, g && g === grafik ? sesuaikanGrafik(baris, b, k, g) : g, p));

  // Selalu update otomatis jika tabel dalam mode Live Sync PICA
  useEffect(() => {
    if (!pica?.aktif) return;
    let batal = false;
    sinkronkanTabelPica(pica)
      .then((hasil) => {
        if (batal || !hasil) return;
        const sama = JSON.stringify(hasil.baris) === JSON.stringify(baris);
        if (!sama) {
          kirim(hasil.baris, kepala, grafik, {
            ...pica,
            terakhirUpdate: capWaktuSekarang(),
          });
        }
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [pica?.aktif, pica?.filterStatus, pica?.picaIds?.join(',')]);

  // Tombol aksi PICA
  const segarkanPica = async () => {
    if (!pica) return;
    setMemuatSync(true);
    try {
      const hasil = await sinkronkanTabelPica(pica, true);
      if (hasil) {
        kirim(hasil.baris, kepala, grafik, {
          ...pica,
          aktif: true,
          terakhirUpdate: capWaktuSekarang(),
        });
      }
    } finally {
      setMemuatSync(false);
    }
  };

  const tetapkanTabel = () => {
    if (!pica) return;
    kirim(baris, kepala, grafik, {
      ...pica,
      aktif: false,
      ditetapkanPada: capDitetapkanSekarang(),
    });
  };

  const hubungkanKembaliLive = async () => {
    if (!pica) return;
    setMemuatSync(true);
    try {
      const picaBaru: InfoPicaLive = { ...pica, aktif: true };
      const hasil = await sinkronkanTabelPica(picaBaru, true);
      kirim(hasil ? hasil.baris : baris, kepala, grafik, {
        ...picaBaru,
        terakhirUpdate: capWaktuSekarang(),
      });
    } finally {
      setMemuatSync(false);
    }
  };

  // Sel yang sudah ada langsung difokus; sel di baris baru menunggu render berikutnya.
  const fokusSel = (i: number, j: number) => {
    const cari = () => kisi.current?.querySelector(`[data-sel="${i}-${j}"]`) as HTMLTextAreaElement | null;
    const sel = cari();
    if (sel) sel.select();
    else setTimeout(() => cari()?.select(), 0);
  };
  // Tab = sel berikutnya, Shift+Tab = sebelumnya; Tab di sel terakhir menambah baris (seperti Notion).
  const pindahSel = (e: React.KeyboardEvent, i: number, j: number) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const lebar = baris[0].length;
    const urut = i * lebar + j + (e.shiftKey ? -1 : 1);
    if (urut < 0) return;
    if (urut >= baris.length * lebar) {
      if (baris.length >= MAKS_BARIS_TABEL) return;
      kirim([...baris, baris[0].map(() => '')]);
      fokusSel(baris.length, 0);
      return;
    }
    fokusSel(Math.floor(urut / lebar), urut % lebar);
  };

  /** Tempel sel banyak (TSV dari Excel / Word) mulai dari sel (rAwal, cAwal) */
  const tempelSel = (e: React.ClipboardEvent, rAwal: number, cAwal: number) => {
    const matriks = uraiTsvKeMatriks(e.clipboardData);
    if (!matriks || matriks.length === 0) return;
    e.preventDefault();

    let salin = baris.map((r) => [...r]);
    const butuhBaris = Math.min(MAKS_BARIS_TABEL, rAwal + matriks.length);
    const maxLebarMatriks = Math.max(...matriks.map((m) => m.length));
    const butuhKolom = Math.min(MAKS_KOLOM_TABEL, cAwal + maxLebarMatriks);

    while (salin.length < butuhBaris) {
      salin.push(Array(salin[0].length).fill(''));
    }
    if (salin[0].length < butuhKolom) {
      salin = salin.map((r) => {
        const row = [...r];
        while (row.length < butuhKolom) row.push('');
        return row;
      });
    }

    for (let i = 0; i < matriks.length; i++) {
      const barisIdx = rAwal + i;
      if (barisIdx >= MAKS_BARIS_TABEL) break;
      for (let j = 0; j < matriks[i].length; j++) {
        const kolomIdx = cAwal + j;
        if (kolomIdx >= MAKS_KOLOM_TABEL) break;
        salin[barisIdx][kolomIdx] = matriks[i][j];
      }
    }
    kirim(salin);
  };

  const isiSel = (i: number, j: number, v: string) => kirim(baris.map((r, a) => (a === i ? r.map((c, x) => (x === j ? v : c)) : r)));
  const tombol = 'px-2 py-0.5 text-[12px] border border-white/20 text-zinc-300 hover:text-white hover:border-lime-400 bg-white/5 disabled:opacity-40';

  return (
    <div className="my-1.5" data-tabel ref={kisi}>
      {/* Bilah Status PICA Live vs Tetapkan */}
      {pica && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 mb-1.5 border rounded-xs text-[12px] ${
            pica.aktif
              ? 'bg-lime-950/40 border-lime-500/50'
              : 'bg-zinc-900 border-amber-500/40'
          }`}
        >
          <div className="flex items-center gap-2 flex-wrap">
            {pica.aktif ? (
              <>
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-lime-400 animate-pulse" />
                <span className="font-bold text-lime-300">Live Sync PICA:</span>
                <span className="text-zinc-200">
                  {pica.mode === 'pilihan'
                    ? `${pica.picaIds?.length || baris.length - 1} PICA Terpilih`
                    : `Filter Status: ${(pica.filterStatus || 'semua').toUpperCase()}`}
                </span>
                {pica.terakhirUpdate && (
                  <span className="text-zinc-400 text-[11px]">• Update: {pica.terakhirUpdate}</span>
                )}
              </>
            ) : (
              <>
                <Lock size={13} className="text-amber-400" />
                <span className="font-bold text-amber-300">Tabel PICA Ditetapkan (Statis)</span>
                <span className="text-zinc-400 text-[11px]">
                  (Tidak akan berubah saat PICA terupdate{pica.ditetapkanPada ? ` • ${pica.ditetapkanPada}` : ''})
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {pica.aktif ? (
              <>
                <button
                  type="button"
                  onClick={segarkanPica}
                  disabled={memuatSync}
                  className="btn-retro btn-retro-sm !bg-lime-600 hover:!bg-lime-500 !text-black font-bold flex items-center gap-1 text-[11px] py-0.5 px-2"
                  title="Ambil data PICA terbaru dari database sekarang"
                >
                  <RefreshCw size={11} className={memuatSync ? 'animate-spin' : ''} />
                  <span>Segarkan</span>
                </button>
                <button
                  type="button"
                  onClick={tetapkanTabel}
                  className="btn-retro btn-retro-sm !bg-amber-600 hover:!bg-amber-500 !text-black font-bold flex items-center gap-1 text-[11px] py-0.5 px-2"
                  title="Tetapkan/Bekukan data saat ini menjadi tabel statis sehingga tidak berubah lagi saat PICA terupdate"
                >
                  <Lock size={11} />
                  <span>Tetapkan (Bekukan)</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={hubungkanKembaliLive}
                disabled={memuatSync}
                className="btn-retro btn-retro-sm !bg-lime-900/40 hover:!bg-lime-600 hover:!text-black text-lime-300 border border-lime-500/40 font-bold flex items-center gap-1 text-[11px] py-0.5 px-2"
                title="Hubungkan kembali ke database PICA agar update otomatis aktif lagi"
              >
                <RefreshCw size={11} className={memuatSync ? 'animate-spin' : ''} />
                <span>Hubungkan Live Sync</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setModalPicaBuka(true)}
              className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-zinc-200 flex items-center gap-1 text-[11px] py-0.5 px-2"
              title="Ubah sumber filter atau pilih PICA lain"
            >
              <SlidersHorizontal size={11} />
              <span>Pilih PICA</span>
            </button>
          </div>
        </div>
      )}

      {/* Ringkasan progres (Total · Selesai · Sisa · Progres) bila tabel punya kolom status / ceklis */}
      {infoProgres && infoProgres.idxStatus !== -1 && (
        <RingkasanProgres {...ringkasanTanpa(infoProgres, baris, mendatang)} />
      )}

      {/* Tabel Grid */}
      <div className="overflow-x-auto custom-scrollbar pb-1">
        <table className="border-collapse text-[0.9375em]">
          <tbody>
            {baris.map((r, i) => (
              <tr key={i} className="group/baris">
                {r.map((c, j) => {
                  // Sel Ceklis Interaktif (pada kolom status)
                  if (i > 0 && infoProgres && j === infoProgres.idxStatus) {
                    return (
                      <td key={j} className="border-2 border-white/20 px-1.5 py-1 align-middle text-center bg-white/[0.02]">
                        <LencanaStatus
                          teks={c}
                          nanti={mendatang.has(i) && !cekNilaiSelesai(c)}
                          pica={Boolean(pica)}
                          // PICA: buka di menu PICA (status tidak diubah dari memo). Tabel biasa: selesai/belum.
                          onKlik={pica ? (onBukaPica ? () => onBukaPica(r[kolomNoPica(baris[0])] ?? '') : undefined) : () => kirim(toggleStatusBarisTabel(baris, i))}
                        />
                      </td>
                    );
                  }

                  // Sel Kumulatif Angka (highlight rapi)
                  if (i > 0 && infoProgres && j === infoProgres.idxKumulatif) {
                    return (
                      <td key={j} className="border-2 border-white/20 px-2 py-1 align-middle text-center font-mono font-bold text-lime-300 bg-white/[0.02]">
                        {c}
                      </td>
                    );
                  }

                  return (
                    <td key={j} className={`border-2 border-white/20 p-0 align-top ${kepala && i === 0 ? 'bg-white/[0.07]' : ''}`}>
                      <SelTabel
                        nilai={c}
                        judul={kepala && i === 0}
                        lebarMin={lebarKolom[j] ?? 96}
                        sel={`${i}-${j}`}
                        label={kepala && i === 0 ? `Kolom ${j + 1}` : `Baris ${i + 1}, kolom ${j + 1}`}
                        onIsi={(v) => isiSel(i, j, v)}
                        onTombol={(e) => pindahSel(e, i, j)}
                        onEnter={() => { if (i + 1 < baris.length) fokusSel(i + 1, j); }}
                        onTempel={(e) => tempelSel(e, i, j)}
                      />
                    </td>
                  );
                })}
                <td className="pl-1 align-middle">
                  <button type="button" tabIndex={-1} disabled={baris.length <= 1} onClick={() => kirim(baris.filter((_, a) => a !== i))} className="w-5 h-5 text-zinc-500 hover:text-red-300 opacity-60 sm:opacity-0 sm:group-hover/baris:opacity-100 disabled:hidden" title="Hapus baris" aria-label={`Hapus baris ${i + 1}`}><X size={12} /></button>
                </td>
              </tr>
            ))}
            <tr>
              {baris[0].map((_, j) => (
                <td key={j} className="text-center pt-0.5">
                  <button type="button" tabIndex={-1} disabled={baris[0].length <= 1} onClick={() => kirim(baris.map((r) => r.filter((__, x) => x !== j)))} className="text-[11px] text-zinc-600 hover:text-red-300 disabled:hidden" title="Hapus kolom" aria-label={`Hapus kolom ${j + 1}`}>hapus kolom</button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bilah Tombol Pengaturan Tabel */}
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        <button type="button" disabled={baris.length >= MAKS_BARIS_TABEL} onClick={() => kirim([...baris, baris[0].map(() => '')])} className={tombol}>+ Baris</button>
        <button type="button" disabled={baris[0].length >= MAKS_KOLOM_TABEL} onClick={() => kirim(baris.map((r) => [...r, '']))} className={tombol}>+ Kolom</button>
        <button
          type="button"
          onClick={() => setKolomLebar(!kolomLebar)}
          className={`${tombol} ${kolomLebar ? 'border-sky-400 text-sky-300 bg-sky-950/40 font-bold' : ''}`}
          title={kolomLebar ? 'Kembalikan ke ukuran kolom normal' : 'Lebarkan kolom dan bungkus teks agar kalimat panjang tidak terpotong'}
        >
          ↔️ {kolomLebar ? 'Kolom Kompak' : 'Lebarkan Kolom'}
        </button>
        <button
          type="button"
          onClick={() => setModalImporBuka(true)}
          className={`${tombol} border-emerald-500/50 text-emerald-300 bg-emerald-950/30 hover:border-emerald-400`}
          title="Impor berkas Excel (.xlsx/.xls) atau CSV (.csv) ke tabel ini"
        >
          📥 Impor Excel/CSV
        </button>
        <button
          type="button"
          onClick={() => {
            if (grafik?.aktif) {
              kirim(baris, kepala, undefined);
            } else {
              kirim(baris, kepala, buatOpsiGrafikOtomatis(baris));
            }
          }}
          className={`${tombol} ${grafik?.aktif ? 'border-lime-400 text-lime-300 bg-lime-600/20' : ''}`}
          title={grafik?.aktif ? 'Sembunyikan grafik' : 'Buat grafik visual interaktif yang langsung terhubung ke tabel ini'}
        >
          📊 {grafik?.aktif ? 'Grafik Aktif' : 'Buat Grafik'}
        </button>
        {!pica && (
          <button
            type="button"
            onClick={() => setModalPicaBuka(true)}
            className={`${tombol} border-amber-500/50 text-amber-200 bg-amber-950/20 hover:border-amber-400`}
            title="Sambungkan tabel ini ke data PICA (Live Sync atau Statis)"
          >
            🔗 Sambungkan ke PICA
          </button>
        )}
        <label className="flex items-center gap-1 text-[12px] text-zinc-400 ml-1 cursor-pointer">
          <input type="checkbox" checked={kepala} onChange={(e) => kirim(baris, e.target.checked)} className="accent-lime-500" /> Baris judul
        </label>
      </div>

      {/* Grafik interaktif yang terhubung langsung ke tabel ini */}
      {grafik?.aktif && (
        <GrafikTabelMemo
          baris={baris}
          kepala={kepala}
          grafik={grafik}
          pica={Boolean(pica)}
          bolehUbah={true}
          onUbah={(baru) => kirim(baris, kepala, baru)}
        />
      )}

      {/* Modal Pemilih PICA untuk mengubah atau menyambungkan tabel */}
      {modalPicaBuka && (
        <ModalPilihPica
          picaAwal={pica}
          onPerbaruiTabel={(tabelRaw) => {
            onUbah(tabelRaw);
            setModalPicaBuka(false);
          }}
          onTutup={() => setModalPicaBuka(false)}
        />
      )}

      {/* Modal Impor Excel / CSV untuk mengganti atau mengisi tabel */}
      {modalImporBuka && (
        <ModalImporTabel
          onTutup={() => setModalImporBuka(false)}
          onSisipkan={(barisBaru, kBaru, dgGrafik) => {
            // Tabel yang sudah bergrafik tetap bergrafik (kolomnya dipetakan ulang ke data baru).
            kirim(barisBaru, kBaru, dgGrafik ? buatOpsiGrafikOtomatis(barisBaru) : grafik);
            setModalImporBuka(false);
          }}
        />
      )}
    </div>
  );
};

/** Blok kode yang bisa disunting: pilih bahasa, ketik di area teks; di luar fokus tampil berwarna. */
const KodeSunting: React.FC<{ bahasa: string; isi: string; onUbah: (bahasa: string, isi: string) => void }> = ({ bahasa, isi, onUbah }) => {
  const [fokus, setFokus] = useState(false);
  const [disalin, setDisalin] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const tinggikan = (t: HTMLTextAreaElement | null) => { if (t) { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; } };
  useLayoutEffect(() => { if (fokus) tinggikan(area.current); }, [fokus, isi]);
  const salin = async () => {
    try { await navigator.clipboard.writeText(isi); setDisalin(true); setTimeout(() => setDisalin(false), 1500); } catch { /* papan klip ditolak */ }
  };
  return (
    <div data-sunting className="my-1.5 border-2 border-white/20 bg-black/60">
      <div className="flex items-center gap-2 px-2 h-7 border-b border-white/10 text-[11px] text-zinc-400">
        <select value={bahasa} onChange={(e) => onUbah(e.target.value, isi)} className="bg-transparent text-zinc-300 outline-none cursor-pointer" aria-label="Bahasa kode">
          {BAHASA_KODE.map((b) => <option key={b.id} value={b.id} className="bg-zinc-900">{b.label}</option>)}
        </select>
        <button type="button" onClick={salin} className="ml-auto flex items-center gap-1 hover:text-white" title="Salin kode">{disalin ? 'Tersalin' : <><Copy size={12} /> Salin</>}</button>
      </div>
      {fokus ? (
        <textarea
          ref={area}
          autoFocus
          value={isi}
          spellCheck={false}
          onChange={(e) => { onUbah(bahasa, e.target.value); tinggikan(e.target); }}
          onBlur={() => setFokus(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.currentTarget.blur(); return; }
            if (e.key === 'Tab') {
              e.preventDefault();
              const t = e.currentTarget;
              const a = t.selectionStart;
              const baru = `${isi.slice(0, a)}  ${isi.slice(t.selectionEnd)}`;
              onUbah(bahasa, baru);
              requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = a + 2; });
            }
          }}
          className="block w-full px-3 py-2 bg-transparent text-zinc-100 font-mono text-[0.85em] leading-[1.55] outline-none resize-none whitespace-pre overflow-x-auto"
          aria-label="Isi kode"
        />
      ) : (
        <pre onClick={() => setFokus(true)} className="m-0 px-3 py-2 min-h-[2.5em] overflow-x-auto custom-scrollbar text-[0.85em] leading-[1.55] font-mono whitespace-pre cursor-text">
          <code>{sorotKode(isi, bahasa).map((x, i) => <span key={i} style={{ color: WARNA_KODE[x.t].gelap }}>{x.v}</span>)}{!isi && <span className="text-zinc-600">Ketuk untuk menulis kode</span>}</code>
        </pre>
      )}
    </div>
  );
};

/** Blok rumus: ketuk untuk mengubah LaTeX, pratinjau langsung di bawahnya. */
const RumusSunting: React.FC<{ isi: string; onUbah: (isi: string) => void }> = ({ isi, onUbah }) => {
  const [ubah, setUbah] = useState(!isi);
  const [siap, setSiap] = useState(katexSiap);
  useEffect(() => { if (!siap) void muatKatex().then(() => setSiap(katexSiap())); }, [siap]);
  return (
    <div data-sunting className="my-1">
      <div onClick={() => setUbah(true)} className="cursor-pointer hover:bg-white/5"><BlokRumus isi={isi} /></div>
      {ubah && (
        <div className="flex items-start gap-2 border-2 border-lime-500/60 bg-zinc-900 p-2">
          <span className="text-[12px] text-zinc-400 pt-1.5">TeX</span>
          <textarea
            autoFocus
            rows={1}
            value={isi}
            onChange={(e) => onUbah(e.target.value.replace(/\n/g, ' '))}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setUbah(false); } }}
            placeholder="mis. \frac{a}{b} atau x^2 + y^2 = r^2"
            className="flex-1 min-w-0 input-retro !py-1 !text-[13px] font-mono resize-none"
            aria-label="Rumus LaTeX"
          />
          <button type="button" onClick={() => setUbah(false)} className="btn-retro btn-retro-sm bg-lime-600">Selesai</button>
        </div>
      )}
    </div>
  );
};

/** Gambar yang bisa diatur lebar & perataannya, dengan keterangan yang bisa diketik (seperti Notion). */
const GambarSunting: React.FC<{ kunci: string; nama: string; lebar?: number; rata?: RataGambar; aktif: boolean; onUbah: (raw: string) => void }> = ({ kunci, nama, lebar, rata, aktif, onUbah }) => {
  const url = useFotoProfil(kunci);
  const [ket, setKet] = useState(nama === 'foto' ? '' : nama);
  useEffect(() => { setKet(nama === 'foto' ? '' : nama); }, [nama]);
  const pasang = (l?: number, r?: RataGambar, n = ket) => onUbah(rakitGambar(n.trim() || 'foto', kunci, l, r));
  const tombol = (aktifkah: boolean) => `w-7 h-7 flex items-center justify-center text-[11px] font-bold ${aktifkah ? 'bg-lime-600 text-white' : 'text-zinc-300 hover:bg-white/10'}`;
  return (
    <figure data-sunting className="group/gambar relative my-1 max-w-full" style={gayaGambar(lebar, rata)}>
      {url
        ? <img src={url} alt={nama} className={`${lebar ? 'w-full' : 'max-w-full max-h-[420px]'} border-2 border-white/25`} draggable={false} />
        : <div className="h-24 border-2 border-dashed border-white/20 flex items-center justify-center gap-2 text-[12px] text-zinc-500"><ImageOff size={14} /> Memuat gambar…</div>}
      <div className={`absolute right-1 top-1 flex bg-zinc-900/95 border-2 border-black/70 ${aktif ? 'opacity-100' : 'opacity-0 group-hover/gambar:opacity-100'} transition-opacity`}>
        {([25, 50, 75, 100] as const).map((l) => (
          <button key={l} type="button" onClick={() => pasang(l === 100 ? undefined : l, rata)} className={tombol((lebar ?? 100) === l)} title={`Lebar ${l}%`}>{l}</button>
        ))}
        <span className="w-px bg-white/20 mx-0.5" />
        {([['kiri', AlignLeft], ['tengah', AlignCenter], ['kanan', AlignRight]] as const).map(([r, Ikon]) => (
          <button key={r} type="button" onClick={() => pasang(lebar, r)} className={tombol((rata ?? 'kiri') === r)} title={`Rata ${r}`} aria-label={`Rata ${r}`}><Ikon size={13} /></button>
        ))}
      </div>
      <input
        value={ket}
        onChange={(e) => setKet(e.target.value)}
        onBlur={() => { if (ket !== (nama === 'foto' ? '' : nama)) pasang(lebar, rata); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
        placeholder="Tulis keterangan…"
        className={`block w-full mt-0.5 bg-transparent text-[12px] text-zinc-400 outline-none placeholder:text-zinc-700 ${rata === 'tengah' ? 'text-center' : rata === 'kanan' ? 'text-right' : ''}`}
        aria-label="Keterangan gambar"
      />
    </figure>
  );
};

const GambarBlok: React.FC<{ kunci: string; nama: string }> = ({ kunci, nama }) => {
  const url = useFotoProfil(kunci);
  if (!url) {
    return <div className="h-24 border-2 border-dashed border-white/20 flex items-center justify-center gap-2 text-[12px] text-zinc-500"><ImageOff size={14} /> Memuat gambar…</div>;
  }
  return (
    <figure>
      <img src={url} alt={nama} className="max-w-full max-h-[420px] border-2 border-white/25" draggable={false} />
      {nama && nama !== 'foto' && <figcaption className="text-[11px] text-zinc-500 mt-0.5">{nama}</figcaption>}
    </figure>
  );
};

const BlokBaris = React.memo<{
  b: Blok; no: number; terpilih: boolean; ph: string; sentuh: boolean; menuTerbuka: boolean;
  tim: AnggotaRingkas[]; h: React.MutableRefObject<Penangan>;
  /** Toggle sedang terbuka (anaknya tampil). */
  terbuka?: boolean;
  /** Judul terkini halaman yang ditautkan. */
  hal?: PetaHalaman;
  /** Judul-judul memo (hanya untuk blok daftar isi). */
  judul?: { indeks: number; tingkat: number; teks: string }[];
  /** Tingkat indentasi yang tidak digambar (blok di dalam kolom berdampingan). */
  kurangi?: number;
}>(({ b, no, terpilih, ph, sentuh, menuTerbuka, tim, h, terbuka = false, hal, judul, kurangi = 0 }) => {
  const info = bacaBaris(b.raw);
  const el = useRef<HTMLDivElement | null>(null);
  const terbaru = useRef({ isi: info.isi, tim, selesai: info.selesai, halaman: hal });
  terbaru.current = { isi: info.isi, tim, selesai: info.selesai, halaman: hal };

  // Isi kotak sunting diatur sendiri (bukan oleh React) agar kursor tidak meloncat saat mengetik.
  const pasang = useCallback((node: HTMLDivElement | null) => {
    if (node && node !== el.current) {
      const t = terbaru.current;
      node.innerHTML = keHtml(t.isi, t);
    }
    el.current = node;
    h.current.daftar(b.id, node);
  }, [b.id, h]);
  const versiAwal = useRef(b.v);
  useLayoutEffect(() => {
    if (b.v === versiAwal.current || !el.current) return;
    versiAwal.current = b.v;
    const t = terbaru.current;
    el.current.innerHTML = keHtml(t.isi, t);
  }, [b.v]);

  // Anak digeser ke kanan 1,5em per tingkat; gagang "+ ⋮⋮" ikut menempel di kiri blok.
  const tingkat = Math.max(0, dlm(b) - kurangi);
  const geserKiri = tingkat ? { paddingLeft: `${tingkat * 1.5}em` } : undefined;
  const gagang = !sentuh && (
    <div style={{ left: `calc(${tingkat * 1.5}em - 2.75rem)` }} className={`absolute top-0.5 w-11 flex justify-end pr-1 ${menuTerbuka ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`} contentEditable={false}>
      <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => h.current.tambahDi(b.id)} className="w-5 h-6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10" title="Tambah blok di bawah" aria-label="Tambah blok"><Plus size={14} /></button>
      <button type="button" tabIndex={-1} onPointerDown={(e) => h.current.pegang(e, b.id)} className="w-5 h-6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 cursor-grab touch-none" title="Seret untuk memindah · ketuk untuk menu" aria-label="Menu blok"><GripVertical size={14} /></button>
    </div>
  );

  if (!BLOK_TEKS.has(info.jenis)) {
    const blok = uraiBlok(b.raw)[0];
    return (
      <div data-baris={b.id} className="group relative" style={geserKiri}>
        {gagang}
        <div
          ref={(node) => h.current.daftar(b.id, node)}
          data-media={b.id}
          tabIndex={0}
          className={`outline-none ${info.jenis === 'berkas' ? 'py-1 inline-block max-w-full' : 'py-1 w-full'} ${terpilih ? 'outline outline-2 outline-lime-400 outline-offset-1 bg-lime-500/10' : ''}`}
          aria-label={LABEL_MEDIA[info.jenis] ?? 'Berkas'}
        >
          {blok.jenis === 'garis' && <hr className="my-1.5 border-t-2 border-dashed border-white/20" />}
          {blok.jenis === 'gambar' && <GambarSunting kunci={blok.kunci} nama={blok.nama} lebar={blok.lebar} rata={blok.rata} aktif={terpilih} onUbah={(raw) => h.current.ubahRaw(b.id, raw)} />}
          {blok.jenis === 'kode' && <KodeSunting bahasa={blok.bahasa} isi={blok.isi} onUbah={(bahasa, isi) => h.current.ubahRaw(b.id, rakitKode(bahasa, isi))} />}
          {blok.jenis === 'rumus' && <RumusSunting isi={blok.isi} onUbah={(isi) => h.current.ubahRaw(b.id, rakitRumus(isi))} />}
          {blok.jenis === 'daftarisi' && <DaftarIsi judul={judul ?? []} onLompat={(i) => h.current.lompat(i)} />}
          {blok.jenis === 'kolom' && (
            <div className="flex items-center gap-1.5 h-6 px-1.5 border-l-2 border-lime-500/60 bg-white/[0.03] text-[11px] text-zinc-400 select-none" title="Kolom: seret blok ke sini untuk memasukkannya. Di layar sempit kolom tampil bertumpuk.">
              <Columns2 size={12} /> Kolom
            </div>
          )}
          {blok.jenis === 'penanda' && <KartuPenanda url={blok.url} judul={blok.judul} ket={blok.ket} situs={blok.situs} />}
          {blok.jenis === 'grafik' && <div data-sunting><GrafikReklamasi blok={blok} onUbah={(g) => h.current.ubahRaw(b.id, rakitGrafik(g))} /></div>}
          {blok.jenis === 'video' && <KartuVideo url={blok.url} judul={blok.judul} />}
          {blok.jenis === 'tabel' && <TabelSunting raw={b.raw} onUbah={(raw) => h.current.ubahRaw(b.id, raw)} onBukaPica={(nomor) => h.current.bukaPica(nomor)} />}
          {blok.jenis === 'data' && (
            <KartuDataLapangan
              blok={blok}
              bolehUbah={true}
              onUbah={(baru) => h.current.ubahRaw(b.id, rakitData(baru))}
            />
          )}
          {blok.jenis === 'berkas' && (
            <button type="button" data-unduh={blok.kunci} data-nama={blok.nama} className="flex items-center gap-1.5 px-2 py-1 border-2 border-white/25 hover:border-lime-400 bg-white/5 text-[13px] font-bold text-zinc-100" title="Simpan atau bagikan berkas">
              <FileText size={13} />{blok.nama}
            </button>
          )}
        </div>
      </div>
    );
  }

  const penanda = info.jenis === 'ceklis'
    ? <input type="checkbox" checked={info.selesai} onChange={() => h.current.centang(b.id)} onMouseDown={(e) => e.preventDefault()} className="mt-[7px] accent-lime-500 w-4 h-4 shrink-0 cursor-pointer" aria-label="Selesai" />
    : info.jenis === 'butir' ? <span className="w-4 shrink-0 flex justify-center pt-[0.62em] select-none" aria-hidden="true"><span className="w-1.5 h-1.5 bg-zinc-300" /></span>
      : info.jenis === 'nomor' ? <span className="min-w-[1.25rem] shrink-0 text-right text-zinc-400 select-none">{no}.</span>
        : info.jenis === 'penting' ? <Info size={15} className="mt-[5px] shrink-0 text-amber-300" />
          : info.jenis === 'toggle' ? (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => h.current.lipat(b.id)}
              className="w-5 h-6 mt-[1px] shrink-0 flex items-center justify-center text-zinc-300 hover:bg-white/10"
              aria-label={terbuka ? 'Lipat' : 'Buka'}
              aria-expanded={terbuka}
            >
              <ChevronRight size={15} className={`transition-transform ${terbuka ? 'rotate-90' : ''}`} />
            </button>
          )
            : <span className="hidden" />;

  return (
    <div data-baris={b.id} className={`group relative flex items-start gap-1.5 ${KELAS_BARIS[info.jenis] ?? ''}`} style={geserKiri}>
      {gagang}
      {penanda}
      <div
        ref={pasang}
        data-blok-edit={b.id}
        contentEditable
        role="textbox"
        aria-multiline="false"
        aria-label={UBAH_JADI.find((p) => p.jenis === info.jenis)?.label ?? 'Teks'}
        spellCheck={false}
        data-ph={ph}
        className={`flex-1 min-w-0 outline-none whitespace-pre-wrap break-words py-[3px] leading-[1.5] ${KELAS_TEKS[info.jenis]} ${info.jenis === 'ceklis' && info.selesai ? '!text-zinc-500 line-through' : ''} empty:before:content-[attr(data-ph)] empty:before:text-zinc-600 empty:before:pointer-events-none`}
      />
    </div>
  );
});
BlokBaris.displayName = 'BlokBaris';

// ============================================================
// Penyunting
// ============================================================

const EditorBlok: React.FC<Props> = ({
  memoId, isi, onIsi, tim, notify, bolehSebutOrang = false, onBukaPica, tinggi = 220, kecil = false,
  font = 'sans', latar = 'putih', halaman = [], onBukaHalaman,
  onBuatHalaman, onKomentar, onAi,
}) => {
  const [blok, setBlokState] = useState<Blok[]>(() => dariTeks(isi));
  const blokRef = useRef(blok);
  const terkirim = useRef(isi);
  const elRef = useRef(new Map<string, HTMLElement>());
  const fokusMinta = useRef<Fokus | null>(null);
  const wadah = useRef<HTMLDivElement>(null);
  const daftarEl = useRef<HTMLDivElement>(null);
  const berkasGambar = useRef<HTMLInputElement>(null);
  const berkasLain = useRef<HTMLInputElement>(null);
  const sisipSetelah = useRef<string | null>(null);
  const riwayat = useRef<string[]>([]);
  const maju = useRef<string[]>([]);
  const ketikTerakhir = useRef(0);

  const [aktifId, setAktifId] = useState<string | null>(null);
  const [terpilih, setTerpilih] = useState<string | null>(null);
  // Menu ketik: "/" (blok) atau "@" (sebut orang / tanggal), terbuka di blok `id`.
  const [slash, setSlash] = useState<{ id: string; query: string; panjang: number; jenis?: 'sebut' | 'emoji' } | null>(null);
  const [pilih, setPilih] = useState(0);
  const [panel, setPanel] = useState<{ jenis: 'tenggat' | 'orang' | 'menu' | 'video' | 'halaman' | 'penanda' | 'rumus'; id: string; pos: number } | null>(null);
  const [urlPenanda, setUrlPenanda] = useState('');
  const [sibukPenanda, setSibukPenanda] = useState(false);
  const [teksRumus, setTeksRumus] = useState('');
  /** Chip rumus sebaris yang sedang diubah (null = rumus baru di posisi kursor). */
  const chipRumus = useRef<HTMLElement | null>(null);
  const [paletBuka, setPaletBuka] = useState(false);
  const [aiPanel, setAiPanel] = useState<PanelAi | null>(null);
  const [teksAi, setTeksAi] = useState('');
  const [urlVideo, setUrlVideo] = useState('');
  const [judulVideo, setJudulVideo] = useState('');
  const [cariHalaman, setCariHalaman] = useState('');
  const [tgl, setTgl] = useState('');
  const [jam, setJam] = useState('');
  const [sibuk, setSibuk] = useState(0);
  const [modalPica, setModalPica] = useState<{ id: string; pos: number } | null>(null);
  const [modalImpor, setModalImpor] = useState<{ id: string; pos: number } | null>(null);
  const [modalHabit, setModalHabit] = useState<{ id: string } | null>(null);
  const [seret, setSeret] = useState<{ id: string; ke: number; atas: number; kiri?: number; lebar?: number; dalam?: number } | null>(null);
  const [pilihan, setPilihan] = useState<{ x: number; y: number } | null>(null);
  /** Bilah format mengambang: digeser agar tidak terpotong tepi layar (teks terpilih di dekat tepi). */
  const pasBilah = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    el.style.marginLeft = '0px';
    const r = el.getBoundingClientRect();
    const tepi = 8;
    if (r.left < tepi) el.style.marginLeft = `${tepi - r.left}px`;
    else if (r.right > window.innerWidth - tepi) el.style.marginLeft = `${window.innerWidth - tepi - r.right}px`;
  }, []);
  // Toggle yang sedang dilipat (di penyunting toggle terbuka secara bawaan, seperti saat menulis di Notion).
  const [tertutup, setTertutup] = useState<ReadonlySet<string>>(() => new Set());

  /** Blok di dalam toggle yang dilipat: tidak dirender dan dilewati panah atas/bawah. */
  const tersembunyi = useMemo(() => {
    const hasil = new Set<string>();
    let batas: number | null = null;
    for (const b of blok) {
      if (batas !== null && dlm(b) > batas) { hasil.add(b.id); continue; }
      batas = null;
      if (tertutup.has(b.id) && bacaBaris(b.raw).jenis === 'toggle') batas = dlm(b);
    }
    return hasil;
  }, [blok, tertutup]);
  const tersembunyiRef = useRef(tersembunyi);
  tersembunyiRef.current = tersembunyi;

  const sentuh = useMemo(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches), []);
  const orangAktif = bolehSebutOrang && tim.length > 0;
  // Judul chip halaman diambil dari daftar terkini; panjang tampil (posisi kursor) ikut memakainya.
  const peta = useMemo(() => petaHalaman(halaman), [halaman]);
  const ctx = useMemo(() => ({ tim, halaman: peta }), [tim, peta]);

  // ---- model -----------------------------------------------------------------

  // Isi berubah dari luar (mis. dicentang dari tab Tugas): susun ulang blok.
  useEffect(() => {
    if (isi === terkirim.current) return;
    terkirim.current = isi;
    const baru = dariTeks(isi);
    blokRef.current = baru;
    setBlokState(baru);
  }, [isi]);

  const catatRiwayat = () => {
    const t = keTeks(blokRef.current);
    if (riwayat.current[riwayat.current.length - 1] !== t) {
      riwayat.current.push(t);
      if (riwayat.current.length > 100) riwayat.current.shift();
    }
    maju.current = [];
  };

  const terapkan = (baru: Blok[], opsi: { fokus?: Fokus; catat?: boolean } = {}) => {
    if (opsi.catat !== false) catatRiwayat();
    if (baru.length === 0) baru = [{ id: idBaru(), raw: '', v: 0 }];
    blokRef.current = baru;
    setBlokState(baru);
    const teks = keTeks(baru);
    terkirim.current = teks;
    onIsi(teks);
    if (opsi.fokus) fokusMinta.current = opsi.fokus;
  };

  const indeks = (id: string) => blokRef.current.findIndex((b) => b.id === id);

  /** Blok terlihat terdekat sebelum (-1) / sesudah (1) indeks i. */
  const tetangga = (i: number, arah: -1 | 1): Blok | undefined => {
    const arr = blokRef.current;
    let j = i + arah;
    while (j >= 0 && j < arr.length && tersembunyiRef.current.has(arr[j].id)) j += arah;
    return arr[j];
  };

  /** Buka semua toggle leluhur blok i agar blok itu terlihat. */
  const bukaLeluhur = (arr: readonly Blok[], i: number) => {
    const buka: string[] = [];
    let d = dlm(arr[i]);
    for (let k = i - 1; k >= 0 && d > 0; k -= 1) {
      if (dlm(arr[k]) < d) { buka.push(arr[k].id); d = dlm(arr[k]); }
    }
    if (buka.some((x) => tertutup.has(x))) setTertutup((t) => { const n = new Set(t); buka.forEach((x) => n.delete(x)); return n; });
  };

  const lipat = (id: string) => setTertutup((t) => {
    const n = new Set(t);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  /**
   * Tab / Shift+Tab ala Notion: blok beserta anak-anaknya masuk ke bawah blok di
   * atasnya (+1) atau keluar satu tingkat (-1). Tidak bisa lebih dalam dari
   * blok di atasnya + 1.
   */
  const ubahKedalaman = (id: string, delta: 1 | -1) => {
    const arr = blokRef.current.slice();
    const i = arr.findIndex((b) => b.id === id);
    if (i < 0) return;
    const d = dlm(arr[i]);
    if (delta > 0 && (i === 0 || d + 1 > dlm(arr[i - 1]) + 1)) return;
    if (delta < 0 && d === 0) return;
    const j = akhirSubpohon(arr, i);
    for (let k = i; k < j; k += 1) arr[k] = { ...arr[k], dalam: dlm(arr[k]) + delta };
    const el = elRef.current.get(id);
    const pos = el?.isContentEditable ? offsetKursor(el) ?? 'akhir' : 0;
    terapkan(arr, { fokus: { id, pos } });
    bukaLeluhur(arr, i);
  };
  const ganti = (id: string, raw: string, fokus?: Fokus) =>
    terapkan(blokRef.current.map((b) => (b.id === id ? { ...b, raw, v: b.v + 1 } : b)), { fokus });

  const muatUlang = (t: string) => {
    const i = aktifId ? Math.max(0, indeks(aktifId)) : 0;
    const baru = dariTeks(t);
    blokRef.current = baru;
    setBlokState(baru);
    terkirim.current = t;
    onIsi(t);
    const target = baru[Math.min(i, baru.length - 1)];
    fokusMinta.current = { id: target.id, pos: 'akhir' };
  };
  const urungkan = () => {
    const t = riwayat.current.pop();
    if (t === undefined) return;
    maju.current.push(keTeks(blokRef.current));
    muatUlang(t);
  };
  const ulangi = () => {
    const t = maju.current.pop();
    if (t === undefined) return;
    riwayat.current.push(keTeks(blokRef.current));
    muatUlang(t);
  };

  // Fokus/kursor yang diminta operasi blok dipasang setelah DOM diperbarui.
  useLayoutEffect(() => {
    const f = fokusMinta.current;
    if (!f) return;
    const el = elRef.current.get(f.id);
    if (!el) return;
    fokusMinta.current = null;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
    if (el.isContentEditable) pasangKursor(el, f.pos === 'akhir' ? Number.MAX_SAFE_INTEGER : f.pos);
  });

  const fokusKe = (id: string, pos: number | 'akhir') => {
    const el = elRef.current.get(id);
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
    if (el.isContentEditable) pasangKursor(el, pos === 'akhir' ? Number.MAX_SAFE_INTEGER : pos);
    else setTerpilih(id);
  };

  // ---- operasi blok ---------------------------------------------------------------

  /** Jumlah bagian isi yang tampil sebagai elemen (tebal, chip, …); orang di luar tim tetap teks. */
  const hitungFormat = (daftar: Inline[]): number => daftar.reduce((n, x) => n + (
    x.t === 'warna' ? 1 + hitungFormat(x.isi)
      : x.t === 'teks' || x.t === 'baris' || (x.t === 'orang' && !tim.some((t) => t.id === x.id)) ? 0 : 1
  ), 0);
  const jumlahFormat = (md: string) => hitungFormat(uraiInline(md));
  const jumlahFormatDom = (el: HTMLElement) => el.querySelectorAll('b,strong,i,em,s,strike,del,code,u,[data-warna],[data-raw]').length;

  /** Tampilan blok disamakan dengan isinya (mis. "**kata**" yang diketik jadi tebal) tanpa mengubah data. */
  const rapikan = (id: string) => {
    const el = elRef.current.get(id);
    const b = blokRef.current.find((x) => x.id === id);
    if (!el?.isContentEditable || !b) return;
    const info = bacaBaris(b.raw);
    if (jumlahFormat(info.isi) !== jumlahFormatDom(el) || dariDom(el) !== info.isi) {
      el.innerHTML = keHtml(info.isi, { ...ctx, selesai: info.selesai });
    }
  };

  /** Ketikan biasa: simpan isi blok; pintasan "# ", "- " … mengubah jenis; "/" membuka menu. */
  const prosesInput = (id: string, menyusun = false) => {
    const el = elRef.current.get(id);
    const i = indeks(id);
    if (!el || i < 0) return;
    if (!el.textContent && !el.querySelector('[data-raw]')) el.innerHTML = '';
    const b = blokRef.current[i];
    const info = bacaBaris(b.raw);
    const md = dariDom(el);
    const c = offsetKursor(el);

    const p = cekPintasan(md);
    // Teks blok biasa yang diawali "# ", "- " dst. tetap dijadikan blok itu (juga bila papan
    // ketik mengirim satu kata utuh), supaya tampilan selalu sama dengan yang tersimpan.
    const ambigu = info.jenis === 'teks' && bacaBaris(md).jenis !== 'teks';
    // Awalan yang baru diketik (bukan teks lama yang kebetulan diawali "- ").
    const awalanBaru = p !== null && !info.isi.startsWith(md.slice(0, md.length - p.sisa.length));
    if (p && (awalanBaru || ambigu) && !(p.jenis === info.jenis && p.jenis !== 'ceklis')) {
      setSlash(null);
      if (p.jenis === 'garis') {
        const baru: Blok = { id: idBaru(), raw: '', v: 0, dalam: dlm(b) };
        const arr = blokRef.current.slice();
        arr.splice(i, 1, { ...b, raw: '---', v: b.v + 1 }, baru);
        terapkan(arr, { fokus: { id: baru.id, pos: 0 } });
        return;
      }
      ganti(id, rakitBaris(p.jenis, p.sisa, p.selesai), { id, pos: Math.max(0, (c ?? 0) - (md.length - p.sisa.length)) });
      return;
    }
    if (ambigu) {
      const x = bacaBaris(md);
      ganti(id, md, { id, pos: x.jenis === 'garis' ? 0 : Math.max(0, (c ?? 0) - (md.length - x.isi.length)) });
      return;
    }

    const kini = Date.now();
    if (kini - ketikTerakhir.current > 1000) catatRiwayat();
    ketikTerakhir.current = kini;
    const raw = rakitBaris(info.jenis, md, info.selesai);
    if (raw !== b.raw) terapkan(blokRef.current.map((x) => (x.id === id ? { ...x, raw } : x)), { catat: false });

    // Tanda penutup baru saja diketik ("**", "`", ")" tautan, tanggal lengkap): langsung jadi format,
    // kecuali saat papan ketik HP masih menyusun kata (mengganti isi di tengah susunan merusak ketikan).
    if (!menyusun && jumlahFormat(md) > jumlahFormatDom(el)) {
      const { sebelum } = potongDiKursor(el);
      el.innerHTML = keHtml(md, { ...ctx, selesai: info.selesai });
      pasangKursor(el, panjangTampil(sebelum, ctx));
    }

    // "```" di blok kosong = blok kode (pintasan Notion).
    if (md === '```' && BLOK_TEKS.has(info.jenis)) {
      setSlash(null);
      ganti(id, rakitKode('teks', ''));
      setTimeout(() => (document.querySelector(`[data-media="${id}"] pre`) as HTMLElement | null)?.click(), 0);
      return;
    }

    const sebelum = c === null ? '' : (el.textContent ?? '').slice(0, c);
    const m = sebelum.match(/(^|\s)\/([a-zA-Z]*)$/);
    const ms = m ? null : sebelum.match(/(^|\s)@([a-zA-Z0-9_-]*)$/);
    const me = m || ms ? null : sebelum.match(/(^|\s):([a-zA-Z]{2,})$/);
    const cocok = m ?? ms ?? (me && cariEmoji(me[2]).length ? me : null);
    if (cocok) {
      const q = cocok[2].toLowerCase();
      const jenis = ms ? 'sebut' as const : me ? 'emoji' as const : undefined;
      if (!slash || slash.id !== id || slash.query !== q || slash.jenis !== jenis) setPilih(0);
      setSlash({ id, query: q, panjang: cocok[2].length + 1, jenis });
      setPanel(null);
    } else if (slash) {
      setSlash(null);
    }
  };

  const enter = (id: string) => {
    const el = elRef.current.get(id);
    const i = indeks(id);
    if (!el || i < 0) return;
    const b = blokRef.current[i];
    const info = bacaBaris(b.raw);
    const { sebelum, sesudah } = potongDiKursor(el);
    const d = dlm(b);
    // Blok kosong yang menjorok: Enter = keluar satu tingkat (seperti Notion).
    if (!sebelum && !sesudah && d > 0 && !info.jenis.startsWith('h')) { ubahKedalaman(id, -1); return; }
    // Enter pada daftar/tugas/kutipan kosong = keluar dari daftar.
    if (!sebelum && !sesudah && info.jenis !== 'teks' && !info.jenis.startsWith('h')) {
      ganti(id, '', { id, pos: 0 });
      return;
    }
    const arr = blokRef.current.slice();
    if (!sebelum && sesudah) {
      const atas: Blok = { id: idBaru(), raw: rakitBaris(jenisLanjutan(info.jenis), ''), v: 0, dalam: d };
      arr.splice(i, 0, atas);
      terapkan(arr, { fokus: { id, pos: 0 } });
      return;
    }
    arr[i] = { ...b, raw: rakitBaris(info.jenis, sebelum, info.selesai), v: b.v + 1 };
    const punyaAnak = akhirSubpohon(arr, i) > i + 1;
    // Toggle: Enter membuat isi pertama di dalamnya bila terbuka, atau toggle baru sesudahnya bila terlipat.
    if (info.jenis === 'toggle' && tertutup.has(b.id)) {
      const lanjut: Blok = { id: idBaru(), raw: rakitBaris('toggle', sesudah), v: 0, dalam: d };
      arr.splice(akhirSubpohon(arr, i), 0, lanjut);
      terapkan(arr, { fokus: { id: lanjut.id, pos: 0 } });
      return;
    }
    const keAnak = info.jenis === 'toggle' || punyaAnak;
    const baru: Blok = {
      id: idBaru(),
      raw: info.jenis === 'toggle' ? sesudah : rakitBaris(jenisLanjutan(info.jenis), sesudah),
      v: 0,
      dalam: keAnak ? d + 1 : d,
    };
    arr.splice(i + 1, 0, baru);
    terapkan(arr, { fokus: { id: baru.id, pos: 0 } });
  };

  const pilihMedia = (id: string) => {
    setTerpilih(id);
    fokusMinta.current = { id, pos: 0 };
    setBlokState((x) => x.slice()); // paksa render agar fokus dipasang
  };

  const hapusDiAwal = (id: string) => {
    const el = elRef.current.get(id);
    const i = indeks(id);
    if (!el || i < 0) return;
    const b = blokRef.current[i];
    const info = bacaBaris(b.raw);
    const md = dariDom(el);
    if (info.jenis !== 'teks') { ganti(id, md, { id, pos: 0 }); return; }
    if (dlm(b) > 0) { ubahKedalaman(id, -1); return; }
    const prev = tetangga(i, -1);
    if (!prev) return;
    const pi = bacaBaris(prev.raw);
    if (pi.jenis === 'garis') {
      terapkan(blokRef.current.filter((x) => x.id !== prev.id), { fokus: { id, pos: 0 } });
      return;
    }
    if (!BLOK_TEKS.has(pi.jenis)) {
      if (!md) terapkan(blokRef.current.filter((_, k) => k !== i));
      pilihMedia(prev.id);
      return;
    }
    const arr = blokRef.current.slice();
    const ip = arr.findIndex((x) => x.id === prev.id);
    arr[ip] = { ...prev, raw: rakitBaris(pi.jenis, pi.isi + md, pi.selesai), v: prev.v + 1 };
    arr.splice(i, 1);
    terapkan(arr, { fokus: { id: prev.id, pos: panjangTampil(pi.isi, ctx) } });
  };

  const hapusDiAkhir = (id: string) => {
    const el = elRef.current.get(id);
    const i = indeks(id);
    if (!el || i < 0 || i === blokRef.current.length - 1) return;
    const b = blokRef.current[i];
    const info = bacaBaris(b.raw);
    const next = tetangga(i, 1);
    if (!next) return;
    const ni = bacaBaris(next.raw);
    if (ni.jenis === 'garis') { terapkan(blokRef.current.filter((x) => x.id !== next.id), { fokus: { id, pos: 'akhir' } }); return; }
    if (!BLOK_TEKS.has(ni.jenis)) { pilihMedia(next.id); return; }
    const md = dariDom(el);
    const arr = blokRef.current.slice();
    arr[i] = { ...b, raw: rakitBaris(info.jenis, md + ni.isi, info.selesai), v: b.v + 1 };
    arr.splice(arr.findIndex((x) => x.id === next.id), 1);
    terapkan(arr, { fokus: { id, pos: panjangTampil(md, ctx) } });
  };

  const hapusBlok = (id: string) => {
    const i = indeks(id);
    if (i < 0) return;
    // Blok dihapus bersama anak-anaknya.
    const arr = blokRef.current.slice();
    arr.splice(i, akhirSubpohon(arr, i) - i);
    setTerpilih(null);
    setPanel(null);
    const tuju = arr[i - 1] ?? arr[i];
    terapkan(arr, tuju ? { fokus: { id: tuju.id, pos: arr[i - 1] ? 'akhir' : 0 } } : {});
  };

  const duplikat = (id: string) => {
    const i = indeks(id);
    if (i < 0) return;
    const arr = blokRef.current.slice();
    const j = akhirSubpohon(arr, i);
    const salinan = arr.slice(i, j).map((x) => ({ ...x, id: idBaru(), v: 0 }));
    arr.splice(j, 0, ...salinan);
    setPanel(null);
    terapkan(arr, { fokus: { id: salinan[0].id, pos: 'akhir' } });
  };

  /** Pindahkan blok beserta anaknya ke posisi `ke`; kedalaman disesuaikan dengan blok di atas tujuan. */
  /** Pindahkan blok (beserta anaknya) ke indeks `ke`; `dalam` = kedalaman tujuan (mis. masuk kolom). */
  const pindah = (id: string, ke: number, dalam?: number) => {
    const arr = blokRef.current.slice();
    const i = arr.findIndex((b) => b.id === id);
    if (i < 0) return;
    const j = akhirSubpohon(arr, i);
    if (ke >= i && ke <= j) return;
    const potong = arr.splice(i, j - i);
    const tujuan = ke > i ? ke - potong.length : ke;
    const batas = tujuan > 0 ? dlm(arr[tujuan - 1]) + 1 : 0;
    const geserDalam = (dalam ?? Math.min(dlm(potong[0]), batas)) - dlm(potong[0]);
    arr.splice(tujuan, 0, ...potong.map((x) => ({ ...x, dalam: Math.max(0, dlm(x) + geserDalam) })));
    terapkan(arr, { fokus: { id, pos: 'akhir' } });
  };
  /** Naik/turun melewati satu blok terlihat (beserta anaknya). */
  const geser = (id: string, arah: -1 | 1) => {
    const arr = blokRef.current;
    const i = indeks(id);
    if (i < 0) return;
    if (arah < 0) {
      const atas = tetangga(i, -1);
      if (atas) pindah(id, arr.findIndex((x) => x.id === atas.id));
      return;
    }
    const j = akhirSubpohon(arr, i);
    if (j < arr.length) pindah(id, akhirSubpohon(arr, j));
  };

  const ubahJenis = (id: string, jenis: JenisBlok) => {
    const i = indeks(id);
    if (i < 0) return;
    const b = blokRef.current[i];
    const info = bacaBaris(b.raw);
    const el = elRef.current.get(id);
    const md = el?.isContentEditable ? dariDom(el) : info.isi;
    const pos = el?.isContentEditable ? offsetKursor(el) ?? 'akhir' : 'akhir';
    setPanel(null);
    if (!BLOK_TEKS.has(info.jenis)) return;
    ganti(id, rakitBaris(jenis, md, jenis === 'ceklis' && info.selesai), { id, pos });
  };

  const centang = (id: string) => {
    const b = blokRef.current.find((x) => x.id === id);
    if (!b) return;
    const info = bacaBaris(b.raw);
    if (info.jenis !== 'ceklis') return;
    // Hanya penanda yang berubah; isi kotak sunting tidak perlu dipasang ulang.
    terapkan(blokRef.current.map((x) => (x.id === id ? { ...x, raw: rakitBaris('ceklis', info.isi, !info.selesai) } : x)));
  };

  /** Seperti "+" di Notion: blok baru berisi "/" dengan menu blok terbuka (blok teks kosong dipakai langsung). */
  const blokBaruSetelah = (id: string) => {
    const i = indeks(id);
    const b = blokRef.current[i];
    setPanel(null);
    setPilih(0);
    if (b && b.raw === '') {
      ganti(id, '/', { id, pos: 1 });
      setSlash({ id, query: '', panjang: 1 });
      return;
    }
    const arr = blokRef.current.slice();
    const baru: Blok = { id: idBaru(), raw: '/', v: 0, dalam: dlm(b) };
    arr.splice(i >= 0 ? akhirSubpohon(arr, i) : arr.length, 0, baru);
    terapkan(arr, { fokus: { id: baru.id, pos: 1 } });
    setSlash({ id: baru.id, query: '', panjang: 1 });
  };

  /** Klik di bawah blok terakhir: lanjut menulis di blok kosong terakhir atau buat yang baru. */
  const klikBawah = () => {
    const akhir = blokRef.current[blokRef.current.length - 1];
    if (akhir && akhir.raw === '') { fokusKe(akhir.id, 0); return; }
    const baru: Blok = { id: idBaru(), raw: '', v: 0, dalam: 0 };
    terapkan([...blokRef.current, baru], { fokus: { id: baru.id, pos: 0 } });
  };

  /** Sisipkan token (tenggat/orang) di posisi kursor `pos` dalam satu blok. */
  const sisipToken = (id: string, pos: number, token: string) => {
    const el = elRef.current.get(id);
    const b = blokRef.current.find((x) => x.id === id);
    if (!el || !b) return;
    const info = bacaBaris(b.raw);
    pasangKursor(el, pos);
    const { sebelum, sesudah } = potongDiKursor(el);
    const kiri = `${sebelum}${sebelum && !/\s$/.test(sebelum) ? ' ' : ''}${token} `;
    ganti(id, rakitBaris(info.jenis, kiri + sesudah.replace(/^\s+/, ''), info.selesai), { id, pos: panjangTampil(kiri, ctx) });
  };

  // ---- menu "/" -------------------------------------------------------------------

  const halamanLain = useMemo(() => halaman.filter((h) => h.id !== memoId), [halaman, memoId]);

  const daftarSlash = useMemo(() => {
    if (!slash) return [];
    const q = slash.query;
    const cocok = (p: Perintah) => cocokKueri(p, q);
    if (slash.jenis === 'emoji') {
      return cariEmoji(q).map((x): Perintah => ({ id: `emoji:${x.e}`, label: `${x.e}  ${x.kata[0]}`, ket: x.kata.slice(1, 4).join(', '), ikon: ikonEmoji(x.e), kata: x.kata, grup: 'Emoji' }));
    }
    if (slash.jenis === 'sebut') {
      const hari = W.hariIniWita();
      const tgl = (n: number, label: string, kata: string[]): Perintah => {
        const t = W.geserHari(hari, n);
        return { id: `tgl:${t}`, label, ket: W.formatPanjang(t), ikon: CalendarClock, kata: [...kata, 'tanggal', 'tenggat'], grup: 'Tanggal' };
      };
      const orang: Perintah[] = orangAktif
        ? tim.map((t) => ({ id: `orang:${t.id}`, label: t.nama, ket: `@${t.id}`, ikon: AtSign, kata: [t.id, ...t.nama.toLowerCase().split(/\s+/)], grup: 'Orang' }))
        : [];
      return ([
        ...orang,
        tgl(0, 'Hari ini', ['hari', 'ini', 'today']),
        tgl(1, 'Besok', ['besok', 'tomorrow']),
        tgl(7, 'Minggu depan', ['minggu', 'depan', 'pekan']),
        { id: 'tgl:pilih', label: 'Pilih tanggal…', ket: 'Tanggal dan jam tertentu', ikon: CalendarClock, kata: ['pilih', 'jam'], grup: 'Tanggal' },
      ] as Perintah[]).filter(cocok);
    }
    return DAFTAR_BLOK
      .filter((p) => (orangAktif || p.id !== 'orang') && (halamanLain.length > 0 || p.id !== 'tautan_halaman') && (onBuatHalaman || p.id !== 'halaman') && (onAi || p.id !== 'ai'))
      .filter((p) => cocokKueri(p, q))
      .map((p, i) => ({ p, i, n: skorKueri(p, q) }))
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map((x) => x.p);
  }, [slash, orangAktif, tim, halamanLain.length, onBuatHalaman, onAi]);

  const bukaTenggat = (id: string, pos: number) => {
    const b = blokRef.current.find((x) => x.id === id);
    const m = b?.raw.match(/@(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
    setTgl(m && tanggalSah(m[1]) ? m[1] : W.hariIniWita());
    setJam(m?.[2] && jamSah(m[2]) ? m[2] : '');
    setSlash(null);
    setPanel({ jenis: 'tenggat', id, pos });
  };

  const jalankan = (pid: string, id: string, pos: number) => {
    if (pid === 'tgl:pilih') { bukaTenggat(id, pos); return; }
    if (pid.startsWith('tgl:')) { sisipToken(id, pos, `@${pid.slice(4)}`); return; }
    if (pid.startsWith('orang:')) { sisipToken(id, pos, `@${pid.slice(6)}`); return; }
    const jenis = UBAH_JADI.find((p) => p.id === pid)?.jenis;
    if (jenis) { ubahJenis(id, jenis); return; }
    if (pid === 'garis') {
      const i = indeks(id);
      const b = blokRef.current[i];
      const arr = blokRef.current.slice();
      const kosongkan = tanpaIsi(b);
      const sesudah: Blok = { id: idBaru(), raw: '', v: 0, dalam: dlm(b) };
      if (kosongkan) arr.splice(i, 1, { ...b, raw: '---', v: b.v + 1 }, sesudah);
      else arr.splice(akhirSubpohon(arr, i), 0, { id: idBaru(), raw: '---', v: 0, dalam: dlm(b) }, sesudah);
      terapkan(arr, { fokus: { id: sesudah.id, pos: 0 } });
      return;
    }
    if (pid === 'gambar' || pid === 'berkas') {
      sisipSetelah.current = id;
      (pid === 'gambar' ? berkasGambar : berkasLain).current?.click();
      return;
    }
    if (pid === 'tenggat') { bukaTenggat(id, pos); return; }
    if (pid === 'orang') { setPanel({ jenis: 'orang', id, pos }); return; }
    if (pid === 'video') { setUrlVideo(''); setJudulVideo(''); setPanel({ jenis: 'video', id, pos }); return; }
    if (pid === 'tabel') {
      const i = indeks(id);
      const arr = blokRef.current.slice();
      const d = i >= 0 ? dlm(arr[i]) : 0;
      const tabel: Blok = { id: idBaru(), raw: rakitTabel([['Kolom 1', 'Kolom 2', 'Kolom 3'], ['', '', ''], ['', '', '']], true), v: 0, dalam: d };
      const lanjut: Blok = { id: idBaru(), raw: '', v: 0, dalam: d };
      if (i >= 0 && tanpaIsi(arr[i])) arr.splice(i, 1, tabel, lanjut);
      else arr.splice(i >= 0 ? akhirSubpohon(arr, i) : arr.length, 0, tabel, lanjut);
      terapkan(arr);
      // Langsung siap diketik di sel pertama.
      setTimeout(() => (document.querySelector(`[data-media="${tabel.id}"] input`) as HTMLInputElement | null)?.select(), 0);
      return;
    }
    if (pid === 'data_nursery' || pid === 'data_geotag') {
      const i = indeks(id);
      const arr = blokRef.current.slice();
      const d = i >= 0 ? dlm(arr[i]) : 0;
      const sumber = pid === 'data_nursery' ? 'nursery' : 'geotag';
      const blokData: Blok = {
        id: idBaru(),
        raw: rakitData({ sumber, saring: {}, tampil: 'kpi' }),
        v: 0,
        dalam: d,
      };
      const lanjut: Blok = { id: idBaru(), raw: '', v: 0, dalam: d };
      if (i >= 0 && tanpaIsi(arr[i])) arr.splice(i, 1, blokData, lanjut);
      else arr.splice(i >= 0 ? akhirSubpohon(arr, i) : arr.length, 0, blokData, lanjut);
      terapkan(arr, { fokus: { id: lanjut.id, pos: 0 } });
      return;
    }
    if (pid === 'tautan_halaman') { setCariHalaman(''); setPanel({ jenis: 'halaman', id, pos }); }
    if (pid === 'pica') { setModalPica({ id, pos }); return; }
    if (pid === 'impor_tabel') { setModalImpor({ id, pos }); return; }
    if (pid === 'habit') { setModalHabit({ id }); return; }
    if (pid === 'halaman') void buatSubHalaman(id);
    if (pid.startsWith('emoji:')) { sisipTeks(id, pos, pid.slice(6)); return; }
    if (pid.startsWith('warna:')) { warnaiBlok(id, pid.slice(6, 7) as 'w' | 'l', pid.slice(8)); return; }
    if (pid === 'kode') {
      const baru = sisipBlokKhusus(id, rakitKode('teks', ''));
      setTimeout(() => (document.querySelector(`[data-media="${baru}"] pre`) as HTMLElement | null)?.click(), 0);
      return;
    }
    if (pid === 'rumus') { void muatKatex(); sisipBlokKhusus(id, rakitRumus('')); return; }
    if (pid === 'daftarisi') { sisipBlokKhusus(id, '!daftarisi'); return; }
    if (pid === 'grafik_reklamasi') { sisipBlokKhusus(id, rakitGrafik({ sumber: 'reklamasi', tampil: 'tahun' })); return; }
    if (pid === 'kolom2' || pid === 'kolom3') { sisipKolom(id, pid === 'kolom2' ? 2 : 3); return; }
    if (pid === 'penanda') { setUrlPenanda(''); setPanel({ jenis: 'penanda', id, pos }); return; }
    if (pid === 'rumus_sebaris') { void muatKatex(); chipRumus.current = null; setTeksRumus(''); setPanel({ jenis: 'rumus', id, pos }); }
    if (pid === 'ai' && onAi) { setTeksAi(''); setPanel(null); setAiPanel({ idMulai: id, idAkhir: id, pilihan: '', mode: 'tulis', status: 'pilih' }); }
  };

  // ---- AI (lihat server/src/ai-memo.ts) ----------------------------------------------

  /** Teks terpilih → panel AI: dalam satu blok (sebagian/seluruh) atau melewati beberapa blok. */
  const mulaiAiPilihan = () => {
    if (!onAi) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { notify('PILIH TEKS DULU, LALU KETUK AI'); return; }
    const r = sel.getRangeAt(0);
    const blokDari = (n: Node) => ((n.nodeType === Node.TEXT_NODE ? n.parentElement : n as Element)?.closest('[data-blok-edit]') as HTMLElement | null)?.dataset.blokEdit ?? null;
    const a = blokDari(r.startContainer);
    const z = blokDari(r.endContainer);
    if (!a || !z) return;
    setPilihan(null);
    setPaletBuka(false);
    setTeksAi('');
    if (a === z) {
      const el = elRef.current.get(a);
      if (!el) return;
      const pre = document.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(r.startContainer, r.startOffset);
      const dari = pre.toString().length;
      setAiPanel({ idMulai: a, idAkhir: a, dari, sampai: dari + r.toString().length, pilihan: dariDom(r.cloneContents()), mode: 'pilihan', status: 'pilih' });
      return;
    }
    const [x, y] = [indeks(a), indeks(z)].sort((m, n) => m - n);
    const kumpulan = blokRef.current.slice(x, y + 1);
    const d0 = Math.min(...kumpulan.map(dlm));
    setAiPanel({
      idMulai: blokRef.current[x].id, idAkhir: blokRef.current[y].id,
      pilihan: kumpulan.map((b) => INDENT.repeat(dlm(b) - d0) + b.raw).join('\n'), mode: 'pilihan', status: 'pilih',
    });
  };

  const jalankanAi = async (aksi: string) => {
    const p = aiPanel;
    if (!p || !onAi) return;
    const instruksi = teksAi.trim();
    if ((aksi === 'bebas' || p.mode === 'tulis') && !instruksi) { notify('TULIS DULU PERMINTAANNYA'); return; }
    setAiPanel({ ...p, status: 'memuat' });
    try {
      const r = await onAi({ mode: p.mode, aksi: p.mode === 'pilihan' ? aksi : undefined, pilihan: p.pilihan || undefined, instruksi: instruksi || undefined });
      if (!r.teks.trim()) throw new Error('AI tidak menghasilkan teks.');
      setAiPanel((q) => q && { ...q, status: 'siap', hasil: r.teks, pesan: r.catatan });
    } catch (e) {
      setAiPanel((q) => q && { ...q, status: 'galat', pesan: e instanceof Error ? e.message : 'Gagal menghubungi AI.' });
    }
  };

  /** Pasang hasil AI. Masuk riwayat penyunting, jadi Ctrl+Z mengurungkannya. */
  const pasangAi = (cara: 'ganti' | 'bawah') => {
    const p = aiPanel;
    if (!p?.hasil) return;
    setAiPanel(null);
    catatRiwayat();
    const arr = blokRef.current.slice();
    const i0 = arr.findIndex((b) => b.id === p.idMulai);
    const i1 = arr.findIndex((b) => b.id === p.idAkhir);
    if (i0 < 0 || i1 < 0) { notify('BLOKNYA SUDAH BERUBAH — COBA LAGI'); return; }
    const d = dlm(arr[i0]);
    const baru = dariTeks(p.hasil).map((b) => ({ ...b, dalam: dlm(b) + d }));
    const akhir = baru[baru.length - 1];
    const fokus = akhir && BLOK_TEKS.has(bacaBaris(akhir.raw).jenis) ? { id: akhir.id, pos: 'akhir' as const } : undefined;
    const sebaris = !p.hasil.includes('\n') && bacaBaris(p.hasil).jenis === 'teks';

    if (p.mode === 'pilihan' && cara === 'ganti' && i0 === i1 && p.dari !== undefined && p.sampai !== undefined) {
      const el = elRef.current.get(p.idMulai);
      const b = arr[i0];
      const info = bacaBaris(b.raw);
      const seluruh = p.dari === 0 && p.sampai >= (el?.textContent?.length ?? 0);
      if (el && sebaris && BLOK_TEKS.has(info.jenis)) {
        // Hasil sebaris: hanya bagian terpilih yang diganti, format bloknya tetap.
        const r = rentang(el, p.dari, p.sampai);
        r.deleteContents();
        r.insertNode(document.createTextNode(p.hasil));
        ganti(p.idMulai, rakitBaris(info.jenis, dariDom(el), info.selesai), { id: p.idMulai, pos: 'akhir' });
        return;
      }
      if (el && !seluruh && BLOK_TEKS.has(info.jenis)) {
        // Sebagian blok jadi beberapa blok (mis. ceklis/tabel): sisa teks tetap, hasil di bawahnya.
        rentang(el, p.dari, p.sampai).deleteContents();
        const sisa = dariDom(el);
        arr.splice(i0, 1, ...(sisa.trim() ? [{ ...b, raw: rakitBaris(info.jenis, sisa, info.selesai), v: b.v + 1 }] : []), ...baru);
        terapkan(arr, { fokus, catat: false });
        return;
      }
    }
    if (p.mode === 'pilihan' && cara === 'ganti') {
      arr.splice(Math.min(i0, i1), Math.abs(i1 - i0) + 1, ...baru);
    } else if (p.mode === 'tulis' && tanpaIsi(arr[i0])) {
      arr.splice(i0, 1, ...baru);
    } else {
      arr.splice(akhirSubpohon(arr, Math.max(i0, i1)), 0, ...baru);
    }
    terapkan(arr, { fokus, catat: false });
  };

  /** Teks polos (mis. emoji) di posisi kursor, tanpa spasi tambahan. */
  const sisipTeks = (id: string, pos: number, teks: string) => {
    const el = elRef.current.get(id);
    const b = blokRef.current.find((x) => x.id === id);
    if (!el || !b) return;
    const info = bacaBaris(b.raw);
    pasangKursor(el, pos);
    const { sebelum, sesudah } = potongDiKursor(el);
    ganti(id, rakitBaris(info.jenis, sebelum + teks + sesudah, info.selesai), { id, pos: panjangTampil(sebelum + teks, ctx) });
  };

  /** Blok satu baris (kode, rumus, daftar isi, tautan web) di tempat blok kosong atau di bawahnya; mengembalikan id blok itu. */
  const sisipBlokKhusus = (id: string, raw: string): string => {
    const i = indeks(id);
    const arr = blokRef.current.slice();
    const d = i >= 0 ? dlm(arr[i]) : 0;
    const blokBaru: Blok = { id: idBaru(), raw, v: 0, dalam: d };
    const lanjut: Blok = { id: idBaru(), raw: '', v: 0, dalam: d };
    if (i >= 0 && tanpaIsi(arr[i])) arr.splice(i, 1, blokBaru, lanjut);
    else arr.splice(i >= 0 ? akhirSubpohon(arr, i) : arr.length, 0, blokBaru, lanjut);
    terapkan(arr);
    return blokBaru.id;
  };

  /** Tata letak kolom: n blok "!kolom" bersebelahan, masing-masing dengan satu baris isi. */
  const sisipKolom = (id: string, n: number) => {
    const i = indeks(id);
    const arr = blokRef.current.slice();
    const d = i >= 0 ? dlm(arr[i]) : 0;
    const baru: Blok[] = [];
    let pertama = '';
    for (let k = 0; k < n; k += 1) {
      const isi: Blok = { id: idBaru(), raw: '', v: 0, dalam: d + 1 };
      if (!pertama) pertama = isi.id;
      baru.push({ id: idBaru(), raw: '!kolom', v: 0, dalam: d }, isi);
    }
    baru.push({ id: idBaru(), raw: '', v: 0, dalam: d });
    if (i >= 0 && tanpaIsi(arr[i])) arr.splice(i, 1, ...baru);
    else arr.splice(i >= 0 ? akhirSubpohon(arr, i) : arr.length, 0, ...baru);
    terapkan(arr, { fokus: { id: pertama, pos: 0 } });
  };

  /** Warna/stabilo untuk seluruh teks satu blok ("/merah", menu ⋮⋮). nama kosong = hapus warna. */
  const warnaiBlok = (id: string, jenis: 'w' | 'l', nama: string) => {
    const b = blokRef.current.find((x) => x.id === id);
    if (!b) return;
    const info = bacaBaris(b.raw);
    if (!BLOK_TEKS.has(info.jenis)) return;
    const polos = lepasWarnaBlok(info.isi);
    if (nama && !polos.trim()) { notify('KETIK TEKSNYA DULU, LALU PILIH WARNA'); return; }
    const isi = nama ? `{${jenis}:${nama}|${polos.replace(/\{[wl]:[a-z]+\|([^{}\n]*)\}/g, '$1').replace(/[{}]/g, '')}}` : polos;
    setPanel(null);
    ganti(id, rakitBaris(info.jenis, isi, info.selesai), { id, pos: 'akhir' });
  };

  /** Kartu tautan web: judul & keterangan diambil server dari halaman itu. */
  const sisipPenanda = async () => {
    if (!panel) return;
    const url = urlPenanda.trim();
    if (!/^https?:\/\/\S+$/.test(url)) { notify('ALAMAT HARUS DIAWALI https://'); return; }
    setSibukPenanda(true);
    let info = { judul: '', ket: '', situs: '' };
    try { info = await api<typeof info>(`/api/pratinjau-tautan?url=${encodeURIComponent(url)}`); } catch { /* tetap pasang tanpa pratinjau */ }
    let situs = info.situs;
    try { situs ||= new URL(url).hostname.replace(/^www\./, ''); } catch { /* biarkan */ }
    setSibukPenanda(false);
    const id = panel.id;
    setPanel(null);
    sisipBlokKhusus(id, rakitPenanda({ url, judul: info.judul || situs, ket: info.ket, situs }));
  };

  /** Rumus sebaris: pasang baru di posisi kursor, atau ganti chip yang diketuk. */
  const pasangRumusSebaris = () => {
    if (!panel) return;
    const tex = teksRumus.replace(/[$\n]/g, ' ').trim();
    const { id, pos } = panel;
    setPanel(null);
    const chip = chipRumus.current;
    chipRumus.current = null;
    if (chip) {
      const el = elRef.current.get(id);
      const b = blokRef.current.find((x) => x.id === id);
      if (!el || !b || !el.contains(chip)) return;
      chip.replaceWith(document.createTextNode(tex ? `$$${tex}$$` : ''));
      const info = bacaBaris(b.raw);
      ganti(id, rakitBaris(info.jenis, dariDom(el), info.selesai), { id, pos: 'akhir' });
      return;
    }
    if (tex) sisipToken(id, pos, `$$${tex}$$`);
  };

  /**
   * Blok "Halaman" seperti Notion: sub-halaman baru dibuat di dalam memo ini, bloknya
   * menempati baris yang sedang diketik (atau di bawahnya), lalu halaman itu langsung dibuka.
   */
  const buatSubHalaman = async (id: string) => {
    if (!onBuatHalaman) return;
    const h = await onBuatHalaman();
    if (!h) return;
    const arr = blokRef.current.slice();
    const i = arr.findIndex((b) => b.id === id);
    const d = i >= 0 ? dlm(arr[i]) : 0;
    const blokHal: Blok = { id: idBaru(), raw: `[[memo:${h.id}|${(h.judul.trim() || 'Tanpa judul').replace(/[\]|\n]/g, ' ')}]]`, v: 0, dalam: d };
    if (i >= 0 && tanpaIsi(arr[i])) arr.splice(i, 1, blokHal);
    else arr.splice(i >= 0 ? akhirSubpohon(arr, i) : arr.length, 0, blokHal);
    terapkan(arr);
    // Isi induk sudah memuat bloknya sebelum pindah (onIsi dipanggil di terapkan).
    setTimeout(() => onBukaHalaman?.(h.id), 0);
  };

  /** Blok video di bawah blok `id` (blok teks kosong dipakai langsung), lalu baris kosong untuk lanjut menulis. */
  const sisipVideo = () => {
    if (!panel) return;
    const url = urlVideo.trim();
    if (!/^https?:\/\/\S+$/.test(url)) { notify('ALAMAT VIDEO HARUS DIAWALI https://'); return; }
    const judul = (judulVideo.trim() || 'Video').replace(/[[\]\n]/g, ' ');
    const i = indeks(panel.id);
    const arr = blokRef.current.slice();
    const d = i >= 0 ? dlm(arr[i]) : 0;
    const video: Blok = { id: idBaru(), raw: `!video[${judul}](${url})`, v: 0, dalam: d };
    const lanjut: Blok = { id: idBaru(), raw: '', v: 0, dalam: d };
    if (i >= 0 && tanpaIsi(arr[i])) arr.splice(i, 1, video, lanjut);
    else arr.splice(i >= 0 ? i + 1 : arr.length, 0, video, lanjut);
    setPanel(null);
    terapkan(arr, { fokus: { id: lanjut.id, pos: 0 } });
  };

  /** Chip "Tautan ke halaman" di posisi kursor. */
  const tautkanHalaman = (h: { id: string; judul: string }) => {
    if (!panel) return;
    const judul = (h.judul.trim() || 'Tanpa judul').replace(/[\]|\n]/g, ' ');
    sisipToken(panel.id, panel.pos, `[[memo:${h.id}|${judul}]]`);
    setPanel(null);
  };

  const pilihPerintah = (pid: string) => {
    const s = slash;
    setSlash(null);
    if (!s) return;
    const el = elRef.current.get(s.id);
    let pos = el ? offsetKursor(el) ?? 0 : 0;
    if (el && s.panjang > 0 && pos >= s.panjang) {
      rentang(el, pos - s.panjang, pos).deleteContents();
      pos -= s.panjang;
      const b = blokRef.current.find((x) => x.id === s.id);
      if (b) {
        const info = bacaBaris(b.raw);
        const raw = rakitBaris(info.jenis, dariDom(el), info.selesai);
        terapkan(blokRef.current.map((x) => (x.id === s.id ? { ...x, raw } : x)), { catat: false });
      }
    }
    jalankan(pid, s.id, pos);
  };

  // ---- tenggat & orang ---------------------------------------------------------

  const terapkanTenggat = (hapus = false) => {
    if (!panel) return;
    const b = blokRef.current.find((x) => x.id === panel.id);
    if (!b) { setPanel(null); return; }
    if (!hapus && !tanggalSah(tgl)) { notify('TANGGAL TIDAK SAH'); return; }
    const jamPakai = jamSah(jam) ? jam : null;
    const info = bacaBaris(b.raw);
    if (hapus || info.jenis === 'ceklis' || /@\d{4}-\d{2}-\d{2}/.test(b.raw)) {
      ganti(b.id, ubahTenggatBaris(b.raw, hapus ? null : tgl, jamPakai), { id: b.id, pos: 'akhir' });
    } else {
      sisipToken(b.id, panel.pos, `@${tgl}${jamPakai ? ` ${jamPakai}` : ''}`);
    }
    setPanel(null);
  };

  const sebutOrang = (idOrang: string) => {
    if (!panel) return;
    sisipToken(panel.id, panel.pos, `@${idOrang}`);
    setPanel(null);
  };

  // ---- format teks terpilih ---------------------------------------------------------

  const blokDariPilihan = (): string | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const n = sel.getRangeAt(0).commonAncestorContainer;
    const host = (n.nodeType === Node.ELEMENT_NODE ? n : n.parentElement) as HTMLElement | null;
    const ed = host?.closest('[data-blok-edit]') as HTMLElement | null;
    return ed && wadah.current?.contains(ed) ? ed.dataset.blokEdit ?? null : null;
  };

  const format = (jenis: 'tebal' | 'miring' | 'coret' | 'kode' | 'tautan' | 'garisbawah' | 'rumus' | 'komentar') => {
    const id = blokDariPilihan();
    if (!id) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (jenis === 'tebal') { document.execCommand('bold'); return; }
    if (jenis === 'miring') { document.execCommand('italic'); return; }
    if (jenis === 'coret') { document.execCommand('strikeThrough'); return; }
    if (jenis === 'garisbawah') { document.execCommand('underline'); return; }
    if (jenis === 'komentar') {
      const kutipan = r.toString().trim();
      if (kutipan && onKomentar) { sel.removeAllRanges(); setPilihan(null); onKomentar(kutipan.slice(0, 300)); }
      return;
    }
    if (jenis === 'rumus') {
      // Teks terpilih jadi rumus sebaris; tanpa pilihan, panel rumus baru dibuka.
      const el = elRef.current.get(id);
      const tex = r.toString().replace(/[$\n]/g, ' ').trim();
      void muatKatex();
      if (!el) return;
      if (!tex) { chipRumus.current = null; setTeksRumus(''); setPanel({ jenis: 'rumus', id, pos: offsetKursor(el) ?? 0 }); return; }
      r.deleteContents();
      r.insertNode(document.createTextNode(`$$${tex}$$`));
      const b = blokRef.current.find((x) => x.id === id);
      if (!b) return;
      const info = bacaBaris(b.raw);
      ganti(id, rakitBaris(info.jenis, dariDom(el), info.selesai), { id, pos: 'akhir' });
      return;
    }
    if (jenis === 'kode') {
      if (r.collapsed) return;
      const k = document.createElement('code');
      k.appendChild(r.extractContents());
      r.insertNode(k);
      prosesInput(id);
      return;
    }
    const teks = (r.toString() || 'tautan').replace(/[[\]\n]/g, ' ').trim() || 'tautan';
    const url = window.prompt('Alamat tautan (https://…)', 'https://');
    if (!url || !/^https?:\/\/\S+$/.test(url.trim())) return;
    const el = elRef.current.get(id);
    if (!el) return;
    r.deleteContents();
    r.insertNode(document.createTextNode(`[${teks}](${url.trim()})`));
    const b = blokRef.current.find((x) => x.id === id);
    if (!b) return;
    const info = bacaBaris(b.raw);
    ganti(id, rakitBaris(info.jenis, dariDom(el), info.selesai), { id, pos: 'akhir' });
  };

  /** Warna teks/stabilo untuk teks terpilih; nama kosong = lepas warna di dalam pilihan. */
  const warnai = (jenis: 'w' | 'l', nama: string) => {
    const id = blokDariPilihan();
    const sel = window.getSelection();
    const el = id ? elRef.current.get(id) : undefined;
    if (!id || !el || !sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    setPaletBuka(false);
    if (!nama) {
      el.querySelectorAll<HTMLElement>('[data-warna]').forEach((sp) => { if (r.intersectsNode(sp)) sp.replaceWith(...Array.from(sp.childNodes)); });
      prosesInput(id);
      return;
    }
    if (r.collapsed) return;
    const sp = document.createElement('span');
    sp.dataset.warna = `${jenis}:${nama}`;
    sp.className = `m${jenis}-${nama}`;
    sp.appendChild(r.extractContents());
    // Warna di dalam pilihan diganti, bukan ditumpuk.
    sp.querySelectorAll<HTMLElement>('[data-warna]').forEach((x) => x.replaceWith(...Array.from(x.childNodes)));
    r.insertNode(sp);
    prosesInput(id);
  };

  /** Shift+Enter: baris baru di dalam blok yang sama (disimpan sebagai <br>). */
  const barisLunak = (id: string) => {
    const el = elRef.current.get(id);
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    r.deleteContents();
    const sisa = document.createRange();
    sisa.selectNodeContents(el);
    sisa.setStart(r.endContainer, r.endOffset);
    // Di ujung blok perlu huruf penahan tak terlihat agar baris barunya tampil.
    const n = document.createTextNode(sisa.toString().replace(/\u200B/g, '') ? '\n' : '\n\u200B');
    r.insertNode(n);
    const c = document.createRange();
    c.setStart(n, 1);
    c.collapse(true);
    sel.removeAllRanges();
    sel.addRange(c);
    prosesInput(id);
  };

  // Rumus yang sudah ada: muat KaTeX, lalu gambar ulang blok yang berisi rumus sebaris.
  useEffect(() => {
    if (katexSiap() || !/\$\$|!rumus\{/.test(isi)) return;
    let hidup = true;
    void muatKatex().then(() => {
      if (!hidup || !katexSiap()) return;
      const arr = blokRef.current.map((x) => (x.raw.includes('$$') ? { ...x, v: x.v + 1 } : x));
      blokRef.current = arr;
      setBlokState(arr);
    });
    return () => { hidup = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Bilah format mengambang saat teks dipilih (layar bertetikus).
  useEffect(() => {
    if (sentuh) return;
    const saat = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !blokDariPilihan()) { setPilihan(null); return; }
      const k = sel.getRangeAt(0).getBoundingClientRect();
      setPilihan({ x: k.left + k.width / 2, y: k.top });
    };
    document.addEventListener('selectionchange', saat);
    return () => document.removeEventListener('selectionchange', saat);
  }, [sentuh]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- unggah -------------------------------------------------------------------

  const unggah = async (daftar: FileList | null, gambar: boolean) => {
    if (!daftar?.length) return;
    let jangkar = sisipSetelah.current ?? aktifId ?? blokRef.current[blokRef.current.length - 1]?.id ?? null;
    sisipSetelah.current = null;
    setSibuk((n) => n + 1);
    let berhasil = 0;
    try {
      for (const f of Array.from(daftar)) {
        const siap = gambar ? await kecilkanGambar(f) : f;
        const hasil = await unggahKeMemo(memoId, siap);
        const arr = blokRef.current.slice();
        const i = jangkar ? arr.findIndex((b) => b.id === jangkar) : -1;
        const baru: Blok = { id: idBaru(), raw: barisUntukUnggah(hasil, gambar && siap.type.startsWith('image/')), v: 0, dalam: i >= 0 ? dlm(arr[i]) : 0 };
        if (i >= 0 && tanpaIsi(arr[i])) arr.splice(i, 1, baru);
        else arr.splice(i >= 0 ? i + 1 : arr.length, 0, baru);
        jangkar = baru.id;
        terapkan(arr);
        berhasil += 1;
      }
      // Sesudah gambar selalu ada tempat untuk lanjut mengetik.
      const arr = blokRef.current.slice();
      const i = jangkar ? arr.findIndex((b) => b.id === jangkar) : -1;
      if (i >= 0) {
        const lanjut = arr[i + 1];
        if (lanjut && lanjut.raw === '') fokusMinta.current = { id: lanjut.id, pos: 0 };
        else {
          const kosong: Blok = { id: idBaru(), raw: '', v: 0, dalam: dlm(arr[i]) };
          arr.splice(i + 1, 0, kosong);
          terapkan(arr, { fokus: { id: kosong.id, pos: 0 }, catat: false });
        }
      }
      notify(berhasil > 1 ? `${berhasil} BERKAS DITAMBAHKAN` : gambar ? 'GAMBAR DITAMBAHKAN' : 'BERKAS DITAMBAHKAN');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGUNGGAH');
    } finally {
      setSibuk((n) => n - 1);
    }
  };

  // ---- seret blok ----------------------------------------------------------------

  const tujuanSeret = (id: string, x: number, y: number): { ke: number; atas: number; kiri?: number; lebar?: number; dalam?: number } => {
    const daftar = daftarEl.current;
    if (!daftar) return { ke: 0, atas: 0 };
    const kotak = daftar.getBoundingClientRect();
    const dasar = kotak.top;
    const arr = blokRef.current;
    const barisEl = (b: Blok) => daftar.querySelector(`[data-baris="${b.id}"]`) as HTMLElement | null;
    // Penunjuk di atas salah satu kolom berdampingan: jatuhkan di antara isi kolom itu (seperti Notion).
    const kolomEl = arr.find((b) => b.id === id)?.raw === '!kolom' ? undefined : Array.from(daftar.querySelectorAll<HTMLElement>('[data-kolom-isi]')).find((k) => {
      const r = k.getBoundingClientRect();
      const deret = (k.parentElement ?? k).getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= deret.top && y <= deret.bottom;
    });
    const a = kolomEl ? arr.findIndex((b) => b.id === kolomEl.dataset.kolomIsi) : -1;
    if (kolomEl && a >= 0) {
      const z = akhirSubpohon(arr, a);
      const r = kolomEl.getBoundingClientRect();
      const posisi = { kiri: r.left - kotak.left, lebar: r.width, dalam: dlm(arr[a]) + 1 };
      for (let k = a + 1; k < z; k++) {
        const rb = barisEl(arr[k])?.getBoundingClientRect();
        if (rb && rb.height && y < rb.top + rb.height / 2) return { ke: k, atas: rb.top - dasar, ...posisi };
      }
      const akhir = barisEl(arr[z - 1])?.getBoundingClientRect();
      return { ke: z, atas: (akhir ? akhir.bottom : r.bottom) - dasar, ...posisi };
    }
    const baris = arr.map(barisEl);
    // Keluar dari kolom: blok ikut tingkat blok di tempat jatuhnya (tidak tetap menjorok).
    const dariKolom = !!daftar.querySelector(`[data-kolom-isi] [data-baris="${id}"]`);
    for (let k = 0; k < baris.length; k++) {
      const r = baris[k]?.getBoundingClientRect();
      if (r && y < r.top + r.height / 2) return { ke: k, atas: r.top - dasar, ...(dariKolom ? { dalam: dlm(arr[k]) } : {}) };
    }
    const akhir = baris[baris.length - 1]?.getBoundingClientRect();
    return { ke: baris.length, atas: akhir ? akhir.bottom - dasar : 0, ...(dariKolom ? { dalam: 0 } : {}) };
  };

  const pegang = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    const x0 = e.clientX;
    const y0 = e.clientY;
    let menyeret = false;
    const gerak = (ev: PointerEvent) => {
      if (!menyeret && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      menyeret = true;
      setSeret({ id, ...tujuanSeret(id, ev.clientX, ev.clientY) });
    };
    const lepas = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      window.removeEventListener('pointercancel', lepas);
      if (menyeret) {
        setSeret(null);
        if (ev.type === 'pointerup') { const t = tujuanSeret(id, ev.clientX, ev.clientY); pindah(id, t.ke, t.dalam); }
      } else {
        const el = elRef.current.get(id);
        setSlash(null);
        setPanel((p) => (p?.jenis === 'menu' && p.id === id ? null : { jenis: 'menu', id, pos: el?.isContentEditable ? offsetKursor(el) ?? 0 : 0 }));
      }
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
    window.addEventListener('pointercancel', lepas);
  };

  // ---- peristiwa papan ketik & tetikus (ditangkap di wadah) ----------------------------

  const idDari = (t: EventTarget | null, atribut: 'blokEdit' | 'media'): string | null => {
    const el = (t as HTMLElement | null)?.closest?.(atribut === 'blokEdit' ? '[data-blok-edit]' : '[data-media]') as HTMLElement | null;
    return el ? el.dataset[atribut] ?? null : null;
  };

  // beforeinput asli: Enter dan Backspace dari papan ketik Android (Gboard) sering
  // tidak membawa kode tombol di keydown, tapi selalu muncul sebagai inputType di sini.
  const sebelumInput = useRef<(e: InputEvent) => void>(() => undefined);
  sebelumInput.current = (e: InputEvent) => {
    const id = idDari(e.target, 'blokEdit');
    if (!id) return;
    const el = elRef.current.get(id);
    if (!el) return;
    const sel = window.getSelection();
    const kosong = sel?.isCollapsed ?? true;
    switch (e.inputType) {
      case 'insertParagraph':
      case 'insertLineBreak':
        e.preventDefault();
        if (slash && daftarSlash.length) pilihPerintah(daftarSlash[Math.min(pilih, daftarSlash.length - 1)].id);
        else enter(id);
        return;
      case 'deleteContentBackward':
        if (kosong && offsetKursor(el) === 0) { e.preventDefault(); hapusDiAwal(id); }
        return;
      case 'deleteContentForward':
        if (kosong && offsetKursor(el) === (el.textContent?.length ?? 0)) { e.preventDefault(); hapusDiAkhir(id); }
        return;
      case 'historyUndo': e.preventDefault(); urungkan(); return;
      case 'historyRedo': e.preventDefault(); ulangi(); return;
      default:
    }
  };
  useEffect(() => {
    const w = wadah.current;
    if (!w) return;
    const f = (e: Event) => sebelumInput.current(e as InputEvent);
    w.addEventListener('beforeinput', f);
    return () => w.removeEventListener('beforeinput', f);
  }, []);

  const tombolMedia = (e: React.KeyboardEvent, id: string) => {
    const i = indeks(id);
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); hapusBlok(id); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const arr = blokRef.current.slice();
      const baru: Blok = { id: idBaru(), raw: '', v: 0, dalam: dlm(arr[i]) };
      arr.splice(akhirSubpohon(arr, i), 0, baru);
      setTerpilih(null);
      terapkan(arr, { fokus: { id: baru.id, pos: 0 } });
      return;
    }
    if (e.key === 'Tab') { e.preventDefault(); ubahKedalaman(id, e.shiftKey ? -1 : 1); return; }
    const atas = tetangga(i, -1);
    const bawah = tetangga(i, 1);
    if (e.key === 'ArrowUp' && atas) { e.preventDefault(); setTerpilih(null); fokusKe(atas.id, 'akhir'); return; }
    if (e.key === 'ArrowDown' && bawah) { e.preventDefault(); setTerpilih(null); fokusKe(bawah.id, 0); return; }
    if (e.key === 'Escape') setTerpilih(null);
  };

  const tekan = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).closest?.('[data-tabel],[data-sunting]')) return;
    const media = idDari(e.target, 'media');
    if (media) { tombolMedia(e, media); return; }
    const id = idDari(e.target, 'blokEdit');
    if (!id) return;
    const el = elRef.current.get(id);
    if (!el) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) ulangi(); else urungkan(); return; }
    if (mod && k === 'y') { e.preventDefault(); ulangi(); return; }
    if (mod && k === 'k') { e.preventDefault(); format('tautan'); return; }
    if (mod && k === 'e') { e.preventDefault(); format('kode'); return; }
    if (mod && e.shiftKey && k === 's') { e.preventDefault(); format('coret'); return; }
    if (mod && k === 'u') { e.preventDefault(); format('garisbawah'); return; }

    if (slash && daftarSlash.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPilih((p) => (p + 1) % daftarSlash.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPilih((p) => (p - 1 + daftarSlash.length) % daftarSlash.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pilihPerintah(daftarSlash[Math.min(pilih, daftarSlash.length - 1)].id); return; }
    }
    if (e.key === 'Escape') { setSlash(null); setPanel(null); return; }
    if (e.key === 'Tab') { e.preventDefault(); ubahKedalaman(id, e.shiftKey ? -1 : 1); return; }
    if (e.key === 'Enter' && e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); barisLunak(id); return; }
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); enter(id); return; }

    const i = indeks(id);
    const sel = window.getSelection();
    const satuTitik = sel?.isCollapsed ?? true;
    const pos = offsetKursor(el);
    // Cadangan untuk peramban yang tidak mengirim beforeinput saat kursor di tepi blok.
    if (e.key === 'Backspace' && satuTitik && pos === 0 && !mod) { e.preventDefault(); hapusDiAwal(id); return; }
    if (e.key === 'Delete' && satuTitik && pos === (el.textContent?.length ?? 0) && !mod) { e.preventDefault(); hapusDiAkhir(id); return; }
    if (e.shiftKey || !satuTitik) return;
    const prev = tetangga(i, -1);
    const next = tetangga(i, 1);
    if (e.key === 'ArrowUp' && prev && kursorDiTepi(el, 'atas')) { e.preventDefault(); fokusKe(prev.id, 'akhir'); return; }
    if (e.key === 'ArrowDown' && next && kursorDiTepi(el, 'bawah')) { e.preventDefault(); fokusKe(next.id, 0); return; }
    if (e.key === 'ArrowLeft' && prev && pos === 0) { e.preventDefault(); fokusKe(prev.id, 'akhir'); return; }
    if (e.key === 'ArrowRight' && next && pos === (el.textContent?.length ?? 0)) { e.preventDefault(); fokusKe(next.id, 0); }
  };

  const ketik = (e: React.FormEvent) => {
    const id = idDari(e.target, 'blokEdit');
    if (id) prosesInput(id, Boolean((e.nativeEvent as InputEvent).isComposing));
  };

  const tempel = (e: React.ClipboardEvent) => {
    const id = idDari(e.target, 'blokEdit');
    if (!id) return;
    e.preventDefault();
    const el = elRef.current.get(id);
    const i = indeks(id);
    if (!el || i < 0) return;

    const hasil = uraiClipboard(e.clipboardData);
    const baris = hasil.baris;
    if (baris.length === 0) return;

    const b = blokRef.current[i];
    const info = bacaBaris(b.raw);
    const { sebelum, sesudah } = potongDiKursor(el);

    // Kasus 1: Ditempel berupa 1 blok tabel murni (dari Word/Excel)
    if (hasil.tabel && baris.length === 1 && baris[0].startsWith('!tabel')) {
      const d = dlm(b);
      const blokTabel: Blok = { id: idBaru(), raw: baris[0], v: 0, dalam: d };
      const arr = blokRef.current.slice();
      if (tanpaIsi(b)) {
        arr.splice(i, 1, blokTabel);
        terapkan(arr);
      } else {
        const lanjut: Blok = { id: idBaru(), raw: '', v: 0, dalam: d };
        arr.splice(i + 1, 0, blokTabel, lanjut);
        terapkan(arr, { fokus: { id: lanjut.id, pos: 0 } });
      }
      return;
    }

    // Kasus 2: 1 baris teks biasa (bisa jadi hasil normalisasi simbol ceklis/butir)
    if (baris.length === 1) {
      const barisTunggal = baris[0];
      const infoTunggal = bacaBaris(barisTunggal);
      // Jika ditempel simbol ceklis di baris kosong
      if (tanpaIsi(b) && infoTunggal.jenis !== 'teks') {
        ganti(id, barisTunggal, { id, pos: panjangTampil(infoTunggal.isi, ctx) });
        return;
      }
      ganti(id, rakitBaris(info.jenis, sebelum + barisTunggal + sesudah, info.selesai), { id, pos: panjangTampil(sebelum + barisTunggal, ctx) });
      return;
    }

    // Kasus 3: Banyak baris (tabel, ceklis, nomor, butir, teks campuran)
    const d = dlm(b);
    const pertama = !sebelum && info.jenis === 'teks' ? pisahIndent(baris[0]).isi : rakitBaris(info.jenis, sebelum + baris[0], info.selesai);
    const ujung = pisahIndent(baris[baris.length - 1]);
    const akhirRaw = ujung.isi;
    const ai = bacaBaris(akhirRaw);
    const blokBaru: Blok[] = [
      { ...b, raw: pertama, v: b.v + 1 },
      ...baris.slice(1, -1).map((x) => { const t = pisahIndent(x); return { id: idBaru(), raw: t.isi, v: 0, dalam: d + t.kedalaman }; }),
    ];
    const akhir: Blok = { id: idBaru(), raw: BLOK_TEKS.has(ai.jenis) ? rakitBaris(ai.jenis, ai.isi + sesudah, ai.selesai) : akhirRaw, v: 0, dalam: d + ujung.kedalaman };
    blokBaru.push(akhir);
    if (!BLOK_TEKS.has(ai.jenis) && sesudah) blokBaru.push({ id: idBaru(), raw: sesudah, v: 0, dalam: d });
    const arr = blokRef.current.slice();
    arr.splice(i, 1, ...blokBaru);
    terapkan(arr, { fokus: { id: akhir.id, pos: BLOK_TEKS.has(ai.jenis) ? panjangTampil(ai.isi, ctx) : 0 } });
  };

  const klik = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const unduh = t.closest('[data-unduh]') as HTMLElement | null;
    if (unduh) {
      unduhBerkasMemo(unduh.dataset.unduh ?? '', unduh.dataset.nama ?? 'berkas').catch(() => notify('BERKAS TIDAK DAPAT DIMUAT'));
      return;
    }
    const media = idDari(t, 'media');
    if (media && t.closest('[data-tabel],[data-sunting],a[href]')) return;
    if (media) { setTerpilih(media); return; }
    const chip = t.closest('[data-raw]') as HTMLElement | null;
    const id = idDari(t, 'blokEdit');
    if (!chip || !id) return;
    e.preventDefault();
    if (chip.dataset.tenggat) {
      const el = elRef.current.get(id);
      bukaTenggat(id, el ? offsetKursor(el) ?? 0 : 0);
      setTgl(chip.dataset.tenggat);
      setJam(chip.dataset.jam ?? '');
    } else if (chip.dataset.berkas) {
      unduhBerkasMemo(chip.dataset.berkas, chip.dataset.nama ?? 'berkas').catch(() => notify('BERKAS TIDAK DAPAT DIMUAT'));
    } else if (chip.dataset.halaman) {
      onBukaHalaman?.(chip.dataset.halaman);
    } else if (chip.dataset.pica) {
      onBukaPica?.(chip.dataset.pica);
    } else if (chip.dataset.tautan) {
      window.open(chip.dataset.tautan, '_blank', 'noopener,noreferrer');
    } else if (chip.dataset.rumus !== undefined) {
      const el = elRef.current.get(id);
      void muatKatex();
      chipRumus.current = chip;
      setTeksRumus(chip.dataset.rumus);
      setPanel({ jenis: 'rumus', id, pos: el ? offsetKursor(el) ?? 0 : 0 });
    }
  };

  const masukFokus = (e: React.FocusEvent) => {
    const media = idDari(e.target, 'media');
    const id = idDari(e.target, 'blokEdit');
    if (aktifId && aktifId !== id && aktifId !== media) rapikan(aktifId);
    if (media) { setTerpilih(media); setAktifId(media); return; }
    if (id) { setAktifId(id); setTerpilih(null); }
  };
  const keluarFokus = () => {
    setTimeout(() => {
      const a = document.activeElement;
      if (a && wadah.current?.contains(a)) return;
      if (aktifId) rapikan(aktifId);
      setAktifId(null);
      setTerpilih(null);
      setSlash(null);
    }, 120);
  };

  // ---- penangan untuk BlokBaris (ref tetap agar BlokBaris tidak dirender ulang) ----------

  const h = useRef<Penangan>({ daftar: () => undefined, centang: () => undefined, pegang: () => undefined, tambahDi: () => undefined, lipat: () => undefined, ubahRaw: () => undefined, lompat: () => undefined, bukaPica: () => undefined });
  h.current = {
    daftar: (id, el) => { if (el) elRef.current.set(id, el); else elRef.current.delete(id); },
    centang,
    pegang,
    tambahDi: blokBaruSetelah,
    lipat,
    ubahRaw: (id, raw) => {
      const kini = Date.now();
      if (kini - ketikTerakhir.current > 1000) catatRiwayat();
      ketikTerakhir.current = kini;
      terapkan(blokRef.current.map((x) => (x.id === id ? { ...x, raw } : x)), { catat: false });
    },
    bukaPica: (nomor) => {
      if (!onBukaPica) return;
      void cariIdPica(nomor).then((id) => (id ? onBukaPica(id) : notify('PICA TIDAK DITEMUKAN')));
    },
    lompat: (i) => {
      const b = blokRef.current[i];
      if (b) elRef.current.get(b.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
  };

  // ---- tampilan ---------------------------------------------------------------------

  // Judul-judul untuk blok daftar isi (dihitung sekali per perubahan isi).
  const judulMemo = useMemo(() => (blok.some((b) => b.raw === '!daftarisi') ? daftarJudul(keTeks(blok)) : []), [blok]);

  // Menu dan panel yang baru terbuka digulir ke tampilan (bisa muncul di dasar halaman).
  const gulirKe = useCallback((el: HTMLElement | null) => { if (!sentuh) el?.scrollIntoView({ block: 'nearest' }); }, [sentuh]);
  // Di HP lembar menu menutup separuh bawah layar: blok yang sedang disunting dinaikkan ke atas.
  const idSorot = slash?.id ?? panel?.id ?? null;
  useEffect(() => {
    if (sentuh && idSorot) elRef.current.get(idSorot)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [sentuh, idSorot]);

  const bawahBaris = (id: string): number => {
    const r = daftarEl.current?.querySelector(`[data-baris="${id}"]`) as HTMLElement | null;
    return r ? r.offsetTop + r.offsetHeight : 0;
  };

  /** Letak menu/panel: di bawah blok (layar bertetikus) atau lembar di atas bilah alat (HP). */
  const letak = (id: string): { className: string; style?: React.CSSProperties } => (sentuh
    ? { className: 'fixed left-2 right-2 bottom-[60px] z-[150] !w-auto !max-w-none max-h-[50vh] overflow-y-auto custom-scrollbar' }
    : { className: 'absolute z-30', style: { top: bawahBaris(id) + 2, left: 0 } });

  const satuKosong = blok.length === 1 && blok[0].raw === '';
  // Kolom berdampingan seperti Notion: deret "!kolom" bersaudara jadi satu baris kolom
  // (aturan sama dengan mode baca, components/MemoMarkup.tsx). Indeks awal deret → [awal, akhir) tiap kolom.
  const deretKolom = new Map<number, [number, number][]>();
  const kurangiKolom = new Map<string, number>();
  for (let i = 0; i < blok.length;) {
    if (blok[i].raw !== '!kolom') { i += 1; continue; }
    const d = dlm(blok[i]);
    const kolom: [number, number][] = [];
    let k = i;
    while (k < blok.length && blok[k].raw === '!kolom' && dlm(blok[k]) === d) { const z = akhirSubpohon(blok, k); kolom.push([k, z]); k = z; }
    deretKolom.set(i, kolom);
    for (const [a, z] of kolom) for (let x = a; x < z; x++) kurangiKolom.set(blok[x].id, x === a ? d : d + 1);
    i = k;
  }
  // Nomor urut per kedalaman, seperti Notion: daftar bernomor di dalam anak mulai lagi dari 1.
  const urut: number[] = [];
  const perBlok: React.ReactNode[][] = blok.map(() => []);
  blok.forEach((b, i) => {
    const baris = perBlok[i];
    const info = bacaBaris(b.raw);
    const d = dlm(b);
    urut[d] = info.jenis === 'nomor' ? (urut[d] ?? 0) + 1 : 0;
    urut.length = d + 1;
    if (tersembunyi.has(b.id)) return;
    const diKolom = kurangiKolom.has(b.id) && b.raw !== '!kolom';
    const ph = info.jenis === 'teks'
      ? (satuKosong ? 'Mulai menulis… ketik / untuk menu blok' : aktifId === b.id ? 'Ketik / untuk perintah' : diKolom && !b.raw ? 'Kolom kosong' : '')
      : PH[info.jenis] ?? '';
    const terbuka = info.jenis === 'toggle' && !tertutup.has(b.id);
    baris.push(
      <BlokBaris
        key={b.id}
        b={b}
        no={urut[d]}
        terpilih={terpilih === b.id}
        ph={ph}
        sentuh={sentuh}
        menuTerbuka={panel?.jenis === 'menu' && panel.id === b.id}
        tim={tim}
        h={h}
        terbuka={terbuka}
        hal={peta}
        judul={info.jenis === 'daftarisi' ? judulMemo : undefined}
        kurangi={kurangiKolom.get(b.id)}
      />,
    );
    // Toggle terbuka tanpa isi: petunjuk seperti "Toggle kosong" di Notion; diketuk = isi pertama.
    if (terbuka && dlm(blok[i + 1]) <= d) {
      baris.push(
        <button
          key={`${b.id}-kosong`}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            const arr = blokRef.current.slice();
            const k = arr.findIndex((x) => x.id === b.id);
            const anak: Blok = { id: idBaru(), raw: '', v: 0, dalam: d + 1 };
            arr.splice(k + 1, 0, anak);
            terapkan(arr, { fokus: { id: anak.id, pos: 0 } });
          }}
          style={{ paddingLeft: `${(d + 1 - (kurangiKolom.get(b.id) ?? 0)) * 1.5}em` }}
          className="block w-full text-left py-[3px] text-[0.875em] text-zinc-600 hover:text-zinc-400"
        >
          Toggle kosong. Ketuk untuk menambah isi.
        </button>,
      );
    }
  });
  const baris: React.ReactNode[] = [];
  for (let i = 0; i < blok.length;) {
    const kolom = deretKolom.get(i);
    if (!kolom) { baris.push(...perBlok[i]); i += 1; continue; }
    const d = dlm(blok[i]);
    baris.push(
      <div key={`kolom-${blok[i].id}`} className="grid gap-x-12 sm:grid-flow-col sm:auto-cols-fr" style={d ? { marginLeft: `${d * 1.5}em` } : undefined}>
        {kolom.map(([a, z]) => (
          <div key={blok[a].id} data-kolom-isi={blok[a].id} className="min-w-0">{perBlok.slice(a, z).flat()}</div>
        ))}
      </div>,
    );
    i = kolom[kolom.length - 1][1];
  }

  const blokAktif = aktifId ? blok.find((b) => b.id === aktifId) : undefined;
  const infoAktif = blokAktif ? bacaBaris(blokAktif.raw) : null;
  const penuh = tinggi === 'penuh';
  const tahanFokus = { onPointerDown: (e: React.PointerEvent) => e.preventDefault(), onMouseDown: (e: React.MouseEvent) => e.preventDefault() };
  /** Seperti tahanFokus, tetapi kotak isian di dalamnya tetap bisa diketuk. */
  const tahanFokusLuarIsian = {
    onMouseDown: (e: React.MouseEvent) => { if (!(e.target as HTMLElement).closest('input,textarea,select')) e.preventDefault(); },
  };

  /** Isi palet warna teks & stabilo (bilah format mengambang dan bilah alat HP). */
  const isiPalet = (
    <>
      <p className="text-[11px] uppercase text-zinc-500">Warna teks</p>
      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={() => warnai('w', '')} className="w-7 h-7 border border-white/25 text-[11px] text-zinc-200 hover:border-white" title="Bawaan (lepas warna)">A</button>
        {WARNA_TEKS.map((w) => <button key={w.nama} type="button" onClick={() => warnai('w', w.nama)} className={`w-7 h-7 border border-white/25 text-[12px] font-bold hover:border-white mw-${w.nama}`} title={w.label} aria-label={`Teks ${w.label}`}>A</button>)}
      </div>
      <p className="text-[11px] uppercase text-zinc-500 flex items-center gap-1"><Highlighter size={11} /> Stabilo / latar</p>
      <div className="flex flex-wrap gap-1">
        {WARNA_LATAR.map((w) => <button key={w.nama} type="button" onClick={() => warnai('l', w.nama)} className={`w-7 h-7 border border-white/25 text-[12px] font-bold hover:border-white ml-${w.nama}`} title={`Latar ${w.label}`} aria-label={`Latar ${w.label}`}>A</button>)}
      </div>
    </>
  );

  const tombolAlat = (id: string, Ikon: Ikon, label: string, aksi: () => void, aktif = false) => (
    <button key={id} type="button" {...tahanFokus} onClick={aksi} className={`btn-ikon !w-9 !h-9 shrink-0 ${aktif ? 'bg-lime-600' : 'bg-zinc-800'}`} title={label} aria-label={label}>
      <Ikon size={15} />
    </button>
  );

  const menuBlok = panel?.jenis === 'menu' ? blok.find((b) => b.id === panel.id) : undefined;
  const menuInfo = menuBlok ? bacaBaris(menuBlok.raw) : null;
  const kelasFont = font === 'serif' ? 'memo-font-serif font-serif' : font === 'mono' ? 'memo-font-mono font-mono' : font === 'retro' ? 'memo-font-retro' : 'memo-font-sans font-sans';
  const kelasLatar = latar === 'putih' ? 'memo-latar-putih' : '';

  return (
    <div
      ref={wadah}
      className={`relative flex flex-col ${kelasFont} ${kelasLatar} ${penuh ? 'flex-1 min-h-0' : ''}`}
      onKeyDown={tekan}
      onInput={ketik}
      onPaste={tempel}
      onClick={klik}
      onFocus={masukFokus}
      onBlur={keluarFokus}
    >
      {sibuk > 0 && <p className="text-[11px] text-lime-300 flex items-center gap-1 mb-1"><Loader2 size={11} className="animate-spin" /> mengunggah…</p>}

      <div className={`${penuh ? 'flex-1 overflow-y-auto custom-scrollbar min-h-0' : ''}`}>
        <div ref={daftarEl} className={`relative ${kelasFont} ${kecil ? 'text-[14px]' : 'text-[16px]'}`} style={penuh ? undefined : { minHeight: typeof tinggi === 'number' ? tinggi : undefined }}>
          {baris}

          {/* Area kosong di bawah: klik untuk lanjut menulis, seperti halaman Notion. */}
          <div className="min-h-[max(56px,30vh)] cursor-text" onMouseDown={(e) => { e.preventDefault(); klikBawah(); }} aria-hidden="true" />

          {seret && <div className="absolute h-1 bg-lime-400 pointer-events-none" style={{ top: seret.atas - 2, left: seret.kiri ?? 0, width: seret.lebar ?? '100%' }} />}

          {slash && daftarSlash.length > 0 && (
            <div
              ref={gulirKe}
              className={`${letak(slash.id).className} retro-box !bg-zinc-900 border-lime-500 !p-1 w-72 max-w-[calc(100%-0.5rem)] max-h-72 overflow-y-auto custom-scrollbar`}
              style={letak(slash.id).style}
              role="listbox"
              aria-label={slash.jenis === 'sebut' ? 'Sebut orang atau tanggal' : 'Menu blok'}
              {...tahanFokus}
            >
              {daftarSlash.map((p, i) => {
                const Ikon = p.ikon;
                const kepala = p.grup && (i === 0 || daftarSlash[i - 1].grup !== p.grup);
                return (
                  <React.Fragment key={p.id}>
                    {kepala && <p className={`px-2 pb-0.5 text-[11px] uppercase text-zinc-500 ${i === 0 ? 'pt-1' : 'pt-2'}`}>{p.grup}</p>}
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === pilih}
                      onClick={() => pilihPerintah(p.id)}
                      onMouseEnter={() => setPilih(i)}
                      className={`flex w-full items-center gap-2.5 px-2 py-1.5 text-left ${i === pilih ? 'bg-lime-600 text-white' : 'hover:bg-white/10'}`}
                    >
                      <span className="w-7 h-7 border border-white/25 bg-black/30 flex items-center justify-center shrink-0"><Ikon size={14} /></span>
                      <span className="flex flex-col leading-tight min-w-0 flex-1"><span className="text-[13px] font-bold">{p.label}</span><span className="text-[11px] text-zinc-300/70 truncate">{p.ket}</span></span>
                      {p.pintasan && <span className={`text-[11px] font-mono shrink-0 ${i === pilih ? 'text-white/80' : 'text-zinc-500'}`}>{p.pintasan}</span>}
                    </button>
                  </React.Fragment>
                );
              })}
              <div className="h-px bg-white/15 my-1" />
              <button type="button" onClick={() => setSlash(null)} className="flex w-full items-center justify-between px-2 py-1.5 text-[12px] text-zinc-400 hover:bg-white/10 hover:text-white">
                <span>Tutup menu</span><span className="font-mono text-[11px] text-zinc-500">esc</span>
              </button>
            </div>
          )}

          {menuBlok && menuInfo && panel && (
            <div ref={gulirKe} className={`${letak(panel.id).className} retro-box !bg-zinc-900 border-lime-500 !p-1 w-64 max-w-[calc(100%-0.5rem)]`} style={letak(panel.id).style} {...tahanFokus}>
              {BLOK_TEKS.has(menuInfo.jenis) && (
                <>
                  <p className="px-2 pt-1 pb-0.5 text-[11px] uppercase text-zinc-500">Ubah jadi</p>
                  <div className="grid grid-cols-3 gap-1 p-1">
                    {UBAH_JADI.map((p) => {
                      const Ikon = p.ikon;
                      return (
                        <button key={p.id} type="button" onClick={() => ubahJenis(panel.id, p.jenis as JenisBlok)} className={`flex flex-col items-center gap-0.5 px-1 py-1.5 border text-[11px] leading-tight ${menuInfo.jenis === p.jenis ? 'border-lime-400 bg-lime-600/30 text-white' : 'border-white/15 hover:bg-white/10 text-zinc-200'}`}>
                          <Ikon size={14} />{p.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="h-px bg-white/15 my-1" />
                  <button type="button" onClick={() => bukaTenggat(panel.id, panel.pos)} className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] hover:bg-white/10"><CalendarClock size={14} /> Tenggat</button>
                  <p className="px-2 pt-1.5 pb-0.5 text-[11px] uppercase text-zinc-500">Warna teks</p>
                  <div className="flex flex-wrap gap-1 px-2 pb-1">
                    <button type="button" onClick={() => warnaiBlok(panel.id, 'w', '')} className="w-6 h-6 border border-white/25 text-[11px] text-zinc-200 hover:border-white" title="Bawaan (tanpa warna)">A</button>
                    {WARNA_TEKS.map((w) => <button key={w.nama} type="button" onClick={() => warnaiBlok(panel.id, 'w', w.nama)} className={`w-6 h-6 border border-white/25 text-[12px] font-bold hover:border-white mw-${w.nama}`} title={w.label} aria-label={`Teks ${w.label}`}>A</button>)}
                  </div>
                  <p className="px-2 pt-1 pb-0.5 text-[11px] uppercase text-zinc-500">Latar (stabilo)</p>
                  <div className="flex flex-wrap gap-1 px-2 pb-1">
                    {WARNA_LATAR.map((w) => <button key={w.nama} type="button" onClick={() => warnaiBlok(panel.id, 'l', w.nama)} className={`w-6 h-6 border border-white/25 text-[12px] font-bold hover:border-white ml-${w.nama}`} title={`Latar ${w.label}`} aria-label={`Latar ${w.label}`}>A</button>)}
                  </div>
                </>
              )}
              <button type="button" onClick={() => duplikat(panel.id)} className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] hover:bg-white/10"><Copy size={14} /> Duplikat</button>
              <button type="button" onClick={() => { setPanel(null); geser(panel.id, -1); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] hover:bg-white/10"><ChevronUp size={14} /> Pindah ke atas</button>
              <button type="button" onClick={() => { setPanel(null); geser(panel.id, 1); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] hover:bg-white/10"><ChevronDown size={14} /> Pindah ke bawah</button>
              <button type="button" onClick={() => hapusBlok(panel.id)} className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] text-red-300 hover:bg-red-900/40"><Trash2 size={14} /> Hapus</button>
            </div>
          )}

          {panel?.jenis === 'tenggat' && (
            <div ref={gulirKe} className={`${letak(panel.id).className} retro-box !bg-zinc-900 border-lime-500 !p-3 w-72 max-w-[calc(100%-0.5rem)] space-y-2`} style={letak(panel.id).style}>
              <p className="text-[12px] text-zinc-300">Tenggat untuk blok ini. Pada ceklis, tugas masuk ke <b>Jadwal</b> dan diingatkan.</p>
              <div className="flex gap-2">
                <input type="date" value={tgl} onChange={(e) => setTgl(e.target.value)} className="input-retro !py-1 !text-[13px] flex-1 min-w-0" aria-label="Tanggal tenggat" />
                <input type="time" value={jam} onChange={(e) => setJam(e.target.value)} className="input-retro !py-1 !text-[13px] w-28" aria-label="Jam (opsional)" />
              </div>
              <div className="flex flex-wrap gap-1">
                {([['Hari ini', 0], ['Besok', 1], ['+7 hari', 7]] as const).map(([l, n]) => (
                  <button key={l} type="button" onClick={() => setTgl(W.geserHari(W.hariIniWita(), n))} className="chip-retro border-white/25 bg-white/5 text-zinc-200 text-[12px]">{l}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => terapkanTenggat(false)} className="btn-retro btn-retro-sm bg-lime-600 flex-1 justify-center">Pasang</button>
                <button type="button" onClick={() => terapkanTenggat(true)} className="btn-retro btn-retro-sm bg-zinc-700">Hapus</button>
                <button type="button" onClick={() => setPanel(null)} className="btn-retro btn-retro-sm bg-zinc-800" aria-label="Tutup"><X size={12} /></button>
              </div>
            </div>
          )}

          {panel?.jenis === 'video' && (
            <div ref={gulirKe} className={`${letak(panel.id).className} retro-box !bg-zinc-900 border-lime-500 !p-3 w-80 max-w-[calc(100%-0.5rem)] space-y-2`} style={letak(panel.id).style}>
              <p className="text-[12px] text-zinc-300">Tempel alamat video (YouTube, Google Drive, dll.). Video tidak diunggah, hanya ditautkan.</p>
              <input autoFocus type="url" value={urlVideo} onChange={(e) => setUrlVideo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sisipVideo(); } if (e.key === 'Escape') setPanel(null); }} placeholder="https://youtu.be/…" className="input-retro !py-1 !text-[13px]" aria-label="Alamat video" />
              <input type="text" value={judulVideo} onChange={(e) => setJudulVideo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sisipVideo(); } }} placeholder="Judul (opsional)" className="input-retro !py-1 !text-[13px]" aria-label="Judul video" />
              <div className="flex gap-2">
                <button type="button" onClick={sisipVideo} className="btn-retro btn-retro-sm bg-lime-600 flex-1 justify-center">Sisipkan video</button>
                <button type="button" onClick={() => setPanel(null)} className="btn-retro btn-retro-sm bg-zinc-800" aria-label="Tutup"><X size={12} /></button>
              </div>
            </div>
          )}

          {panel?.jenis === 'halaman' && (
            <div ref={gulirKe} className={`${letak(panel.id).className} retro-box !bg-zinc-900 border-lime-500 !p-1 w-80 max-w-[calc(100%-0.5rem)]`} style={letak(panel.id).style}>
              <input autoFocus value={cariHalaman} onChange={(e) => setCariHalaman(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setPanel(null); }} placeholder="Cari halaman untuk ditautkan…" className="input-retro !py-1 !text-[13px] mb-1" aria-label="Cari halaman" />
              <div className="max-h-56 overflow-y-auto custom-scrollbar">
                {halamanLain
                  .filter((h) => !cariHalaman.trim() || h.judul.toLowerCase().includes(cariHalaman.trim().toLowerCase()))
                  .slice(0, 40)
                  .map((h) => (
                    <button key={h.id} type="button" onClick={() => tautkanHalaman(h)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] hover:bg-white/10">
                      <span className="w-5 text-center shrink-0">{h.ikon || '📄'}</span>
                      <span className={`truncate ${h.judul ? 'text-white' : 'text-zinc-500 italic'}`}>{h.judul || 'Tanpa judul'}</span>
                    </button>
                  ))}
              </div>
              <button type="button" onClick={() => setPanel(null)} className="w-full text-left px-2 py-1 text-[12px] text-zinc-500 hover:text-white">Batal</button>
            </div>
          )}

          {aiPanel && (
            <div ref={gulirKe} className={`${letak(aiPanel.idMulai).className} retro-box !bg-zinc-900 border-purple-500 !p-2 w-[22rem] max-w-[calc(100%-0.5rem)] space-y-2`} style={letak(aiPanel.idMulai).style} {...tahanFokusLuarIsian}>
              <div className="flex items-center gap-1.5 text-[12px] text-purple-200">
                <Sparkles size={13} /> <span className="flex-1">{aiPanel.mode === 'tulis' ? 'Tulis dengan AI' : 'AI untuk teks terpilih'}</span>
                <button type="button" onClick={() => setAiPanel(null)} className="text-zinc-400 hover:text-white" aria-label="Tutup"><X size={13} /></button>
              </div>
              {aiPanel.mode === 'pilihan' && aiPanel.status !== 'siap' && <p className="text-[11px] text-zinc-500 italic line-clamp-2">“{aiPanel.pilihan}”</p>}
              {(aiPanel.status === 'pilih' || aiPanel.status === 'galat') && (
                <>
                  {aiPanel.mode === 'pilihan' && (
                    <div className="grid grid-cols-2 gap-1">
                      {AKSI_AI.map(([a, label]) => (
                        <button key={a} type="button" onClick={() => { void jalankanAi(a); }} className="px-2 py-1 border border-white/15 text-left text-[12px] text-zinc-200 hover:border-purple-400 hover:bg-purple-900/30">{label}</button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <input
                      autoFocus={aiPanel.mode === 'tulis'}
                      value={teksAi}
                      onChange={(e) => setTeksAi(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void jalankanAi('bebas'); } if (e.key === 'Escape') setAiPanel(null); }}
                      placeholder={aiPanel.mode === 'tulis' ? 'Minta AI menulis… mis. notulen dari catatan di atas' : 'Atau ketik permintaan sendiri…'}
                      className="input-retro !py-1 !text-[13px] flex-1 min-w-0"
                      aria-label="Permintaan untuk AI"
                    />
                    <button type="button" onClick={() => { void jalankanAi('bebas'); }} className="btn-ikon !w-8 !h-8 bg-purple-700" aria-label="Kirim ke AI"><Send size={13} /></button>
                  </div>
                  {aiPanel.mode === 'tulis' && (
                    <div className="flex flex-wrap gap-1">
                      {CONTOH_TULIS_AI.map((c) => <button key={c} type="button" onClick={() => setTeksAi(c)} className="px-1.5 py-0.5 border border-white/15 text-[11px] text-zinc-300 hover:border-purple-400">{c}</button>)}
                    </div>
                  )}
                  {aiPanel.status === 'galat' && <p className="text-[12px] text-red-300">{aiPanel.pesan}</p>}
                </>
              )}
              {aiPanel.status === 'memuat' && <p className="text-[12px] text-zinc-300 flex items-center gap-1.5 py-2"><Loader2 size={13} className="animate-spin" /> AI sedang bekerja…</p>}
              {aiPanel.status === 'siap' && aiPanel.hasil && (
                <>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar border border-white/10 bg-black/30 px-2 py-1 text-[14px] leading-[1.5]"><IsiMemo isi={aiPanel.hasil} tim={tim} /></div>
                  {aiPanel.pesan && <p className="text-[11px] text-purple-200/80">{aiPanel.pesan}</p>}
                  <div className="flex flex-wrap gap-1">
                    <button type="button" onClick={() => pasangAi('ganti')} className="btn-retro btn-retro-sm !bg-purple-700 text-white font-bold">{aiPanel.mode === 'tulis' ? 'Sisipkan' : 'Ganti teks terpilih'}</button>
                    {aiPanel.mode === 'pilihan' && <button type="button" onClick={() => pasangAi('bawah')} className="btn-retro btn-retro-sm !bg-zinc-700 text-zinc-100">Sisipkan di bawah</button>}
                    <button type="button" onClick={() => setAiPanel({ ...aiPanel, status: 'pilih' })} className="btn-retro btn-retro-sm !bg-zinc-800 text-zinc-200">Coba lagi</button>
                  </div>
                </>
              )}
            </div>
          )}

          {panel?.jenis === 'penanda' && (
            <div ref={gulirKe} className={`${letak(panel.id).className} retro-box !bg-zinc-900 border-lime-500 !p-2 w-80 max-w-[calc(100%-0.5rem)] space-y-2`} style={letak(panel.id).style}>
              <p className="text-[12px] text-zinc-300">Tautan web — judul & keterangan diambil otomatis dari halamannya.</p>
              <input autoFocus type="url" value={urlPenanda} onChange={(e) => setUrlPenanda(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void sisipPenanda(); } if (e.key === 'Escape') setPanel(null); }} placeholder="https://…" className="input-retro !py-1 !text-[13px]" aria-label="Alamat tautan" />
              <div className="flex gap-2">
                <button type="button" disabled={sibukPenanda} onClick={() => { void sisipPenanda(); }} className="btn-retro btn-retro-sm bg-lime-600 flex-1 justify-center">{sibukPenanda ? <Loader2 size={12} className="animate-spin" /> : 'Pasang kartu'}</button>
                <button type="button" onClick={() => setPanel(null)} className="btn-retro btn-retro-sm bg-zinc-800" aria-label="Tutup"><X size={12} /></button>
              </div>
            </div>
          )}

          {panel?.jenis === 'rumus' && (
            <div ref={gulirKe} className={`${letak(panel.id).className} retro-box !bg-zinc-900 border-lime-500 !p-2 w-80 max-w-[calc(100%-0.5rem)] space-y-2`} style={letak(panel.id).style} {...tahanFokusLuarIsian}>
              <p className="text-[12px] text-zinc-300 flex items-center gap-1.5"><Sigma size={13} /> Rumus sebaris (LaTeX)</p>
              <input autoFocus value={teksRumus} onChange={(e) => setTeksRumus(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pasangRumusSebaris(); } if (e.key === 'Escape') setPanel(null); }} placeholder="mis. x^2 + \sqrt{y}" className="input-retro !py-1 !text-[13px] font-mono" aria-label="Rumus LaTeX" />
              <div className="min-h-[1.75rem] px-2 py-1 bg-black/30 text-center text-zinc-100" dangerouslySetInnerHTML={{ __html: teksRumus.trim() ? (rumusHtml(teksRumus) ?? '') : '<span style="color:#71717a">Pratinjau</span>' }} />
              <div className="flex gap-2">
                <button type="button" onClick={pasangRumusSebaris} className="btn-retro btn-retro-sm bg-lime-600 flex-1 justify-center">{chipRumus.current ? 'Simpan' : 'Sisipkan'}</button>
                <button type="button" onClick={() => setPanel(null)} className="btn-retro btn-retro-sm bg-zinc-800" aria-label="Tutup"><X size={12} /></button>
              </div>
            </div>
          )}

          {panel?.jenis === 'orang' && orangAktif && (
            <div ref={gulirKe} className={`${letak(panel.id).className} retro-box !bg-zinc-900 border-lime-500 !p-1 w-64 max-w-[calc(100%-0.5rem)] max-h-60 overflow-y-auto custom-scrollbar`} style={letak(panel.id).style} {...tahanFokus}>
              <p className="px-2 py-1 text-[11px] text-zinc-400">Penanggung jawab tugas</p>
              {tim.map((t) => (
                <button key={t.id} type="button" onClick={() => sebutOrang(t.id)} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[13px] hover:bg-white/10">
                  <span className="text-white truncate">{t.nama}</span><span className="text-zinc-500 shrink-0">@{t.id}</span>
                </button>
              ))}
              <button type="button" onClick={() => setPanel(null)} className="w-full text-left px-2 py-1 text-[12px] text-zinc-500 hover:text-white">Batal</button>
            </div>
          )}
        </div>
      </div>

      {/* HP: palet warna/stabilo untuk teks terpilih, tepat di atas bilah alat. */}
      {sentuh && paletBuka && blokAktif && (
        <div className="sticky bottom-[46px] z-20 retro-box !bg-zinc-900 border-lime-500 !p-2 space-y-1.5" {...tahanFokus}>{isiPalet}</div>
      )}

      {/* HP: bilah alat di atas papan ketik untuk blok yang sedang ditulis (pengganti "+" dan "⋮⋮"). */}
      {sentuh && blokAktif && infoAktif && (
        <div className="sticky bottom-0 z-20 -mx-1 mt-1 px-1 py-1 bg-zinc-950 border-t-2 border-white/20 flex items-center gap-1 overflow-x-auto tanpa-scrollbar" role="toolbar" aria-label="Alat blok">
          {tombolAlat('tambah', Plus, 'Tambah blok', () => blokBaruSetelah(blokAktif.id))}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('menu', Type, 'Ubah jadi', () => {
            const el = elRef.current.get(blokAktif.id);
            setSlash(null);
            setPanel(panel?.jenis === 'menu' ? null : { jenis: 'menu', id: blokAktif.id, pos: el ? offsetKursor(el) ?? 0 : 0 });
          }, panel?.jenis === 'menu')}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('ceklis', ListChecks, 'Ceklis', () => ubahJenis(blokAktif.id, infoAktif.jenis === 'ceklis' ? 'teks' : 'ceklis'), infoAktif.jenis === 'ceklis')}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('tebal', Bold, 'Tebal', () => format('tebal'))}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('miring', Italic, 'Miring', () => format('miring'))}
          {onAi && BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('ai', Sparkles, 'AI untuk teks terpilih', mulaiAiPilihan)}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('garisbawah', Underline, 'Garis bawah', () => format('garisbawah'))}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('warna', Palette, 'Warna & stabilo (pilih teks dulu)', () => setPaletBuka((v) => !v), paletBuka)}
          {onKomentar && BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('komentar', MessageSquare, 'Komentari teks terpilih', () => format('komentar'))}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('tenggat', CalendarClock, 'Tenggat', () => {
            const el = elRef.current.get(blokAktif.id);
            bukaTenggat(blokAktif.id, el ? offsetKursor(el) ?? 0 : 0);
          }, panel?.jenis === 'tenggat')}
          {orangAktif && BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('orang', AtSign, 'Sebut orang', () => {
            const el = elRef.current.get(blokAktif.id);
            setPanel({ jenis: 'orang', id: blokAktif.id, pos: el ? offsetKursor(el) ?? 0 : 0 });
          }, panel?.jenis === 'orang')}
          {tombolAlat('gambar', ImagePlus, 'Gambar', () => { sisipSetelah.current = blokAktif.id; berkasGambar.current?.click(); })}
          {tombolAlat('berkas', Paperclip, 'Berkas', () => { sisipSetelah.current = blokAktif.id; berkasLain.current?.click(); })}
          <span className="w-px h-6 bg-white/20 mx-0.5 shrink-0" />
          {tombolAlat('keluar', ListIndentDecrease, 'Keluar satu tingkat', () => ubahKedalaman(blokAktif.id, -1))}
          {tombolAlat('masuk', ListIndentIncrease, 'Masuk satu tingkat (jadi anak blok di atas)', () => ubahKedalaman(blokAktif.id, 1))}
          {tombolAlat('naik', ChevronUp, 'Pindah ke atas', () => geser(blokAktif.id, -1))}
          {tombolAlat('turun', ChevronDown, 'Pindah ke bawah', () => geser(blokAktif.id, 1))}
          {tombolAlat('hapus', Trash2, 'Hapus blok', () => hapusBlok(blokAktif.id))}
        </div>
      )}

      {/* Layar bertetikus: bilah format mengambang di atas teks yang dipilih. */}
      {!sentuh && pilihan && createPortal(
        <div key={`${pilihan.x},${pilihan.y}`} ref={pasBilah} className="fixed z-[400] flex items-center gap-0.5 retro-box !bg-zinc-900 border-lime-500 !p-0.5 -translate-x-1/2" style={{ left: pilihan.x, top: Math.max(4, pilihan.y - 44) }} role="toolbar" aria-label="Format teks" {...tahanFokus}>
          {onAi && (
            <button type="button" onClick={mulaiAiPilihan} className="h-8 px-2 flex items-center gap-1 text-[12px] font-bold text-purple-200 hover:bg-purple-700 hover:text-white" title="AI untuk teks terpilih">
              <Sparkles size={14} /> AI
            </button>
          )}
          <select
            value=""
            onChange={(e) => { const id = blokDariPilihan(); if (id && e.target.value) ubahJenis(id, e.target.value as JenisBlok); }}
            className="h-8 px-1 bg-transparent text-[12px] text-zinc-200 hover:bg-white/10 outline-none cursor-pointer"
            title="Ubah jadi"
            aria-label="Ubah jadi"
          >
            <option value="" className="bg-zinc-900">Ubah jadi…</option>
            {UBAH_JADI.map((p) => <option key={p.id} value={p.jenis} className="bg-zinc-900">{p.label}</option>)}
          </select>
          <span className="w-px h-6 bg-white/20" />
          {([['tebal', Bold, 'Tebal (Ctrl+B)'], ['miring', Italic, 'Miring (Ctrl+I)'], ['garisbawah', Underline, 'Garis bawah (Ctrl+U)'], ['coret', Strikethrough, 'Coret (Ctrl+Shift+S)'], ['kode', Code, 'Kode (Ctrl+E)'], ['tautan', Link2, 'Tautan (Ctrl+K)'], ['rumus', Sigma, 'Rumus sebaris']] as const).map(([j, Ikon, l]) => (
            <button key={j} type="button" onClick={() => format(j)} className="w-8 h-8 flex items-center justify-center text-zinc-200 hover:bg-lime-600 hover:text-white" title={l} aria-label={l}><Ikon size={14} /></button>
          ))}
          <span className="relative">
            <button type="button" onClick={() => setPaletBuka((v) => !v)} className={`w-8 h-8 flex items-center justify-center hover:bg-lime-600 hover:text-white ${paletBuka ? 'bg-lime-600 text-white' : 'text-zinc-200'}`} title="Warna & stabilo" aria-label="Warna & stabilo" aria-expanded={paletBuka}><Palette size={14} /></button>
            {paletBuka && (
              <div className={`absolute left-1/2 -translate-x-1/2 ${pilihan.y > window.innerHeight - 300 ? 'bottom-full mb-1' : 'top-full mt-1'} w-56 retro-box !bg-zinc-900 border-lime-500 !p-2 space-y-1.5`}>{isiPalet}</div>
            )}
          </span>
          {onKomentar && <button type="button" onClick={() => format('komentar')} className="w-8 h-8 flex items-center justify-center text-zinc-200 hover:bg-lime-600 hover:text-white" title="Komentari teks ini" aria-label="Komentar"><MessageSquare size={14} /></button>}
        </div>,
        document.body,
      )}

      {modalPica && (
        <ModalPilihPica
          onPilih={(p) => {
            const no = p.no_urut ? `PICA-${String(p.no_urut).padStart(3, '0')}` : `PICA-${p.id.slice(0, 4)}`;
            sisipToken(modalPica.id, modalPica.pos, `#${no}`);
            setModalPica(null);
          }}
          onSisipTabel={(rawTabel) => {
            sisipBlokKhusus(modalPica.id, rawTabel);
            setModalPica(null);
          }}
          onTutup={() => setModalPica(null)}
        />
      )}

      {modalHabit && (
        <ModalHabit
          onTutup={() => setModalHabit(null)}
          onSisipkan={(raw) => { sisipBlokKhusus(modalHabit.id, raw); setModalHabit(null); }}
        />
      )}

      {modalImpor && (
        <ModalImporTabel
          onTutup={() => setModalImpor(null)}
          onSisipkan={(barisBaru, kBaru, dgGrafik) => {
            const rawTabel = rakitTabel(
              barisBaru,
              kBaru,
              dgGrafik ? buatOpsiGrafikOtomatis(barisBaru) : undefined
            );
            sisipBlokKhusus(modalImpor.id, rawTabel);
            setModalImpor(null);
          }}
        />
      )}

      <input ref={berkasGambar} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void unggah(e.target.files, true); e.target.value = ''; }} />
      <input ref={berkasLain} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" multiple className="hidden" onChange={(e) => { void unggah(e.target.files, false); e.target.value = ''; }} />
    </div>
  );
};
