import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AtSign, Bold, CalendarClock, ChevronDown, ChevronRight, ChevronUp, Code, Copy, FileText, GripVertical,
  ImagePlus, ImageOff, Info, Italic, Link2, ListChecks, ListIndentDecrease, ListIndentIncrease, Loader2, Paperclip, Plus,
  Strikethrough, Trash2, Type, X,
} from 'lucide-react';
import {
  INDENT, MAKS_BARIS_TABEL, MAKS_KOLOM_TABEL, ambilTugas, bacaTabel, jamSah, pisahIndent, rakitData, rakitTabel, tanggalSah, toggleBaris, ubahTenggatBaris,
  uraiBlok, uraiInline,
} from '../server/src/memo-blok';
import {
  BLOK_TEKS, bacaBaris, cekPintasan, dariDom, jenisLanjutan, keHtml, kursorDiTepi, offsetKursor, panjangTampil,
  pasangKursor, potongDiKursor, rakitBaris, rentang, type JenisBlok, type PetaHalaman,
} from '../lib/memo-dom';
import { barisUntukUnggah, kecilkanGambar, unduhBerkasMemo, unggahKeMemo } from '../lib/memo-gambar';
import { useFotoProfil } from '../lib/foto';
import type { AnggotaRingkas } from '../lib/tipe-api';
import * as W from '../lib/waktu';
import { IsiMemo, KartuVideo } from './MemoMarkup';
import { KartuDataLapangan } from './KartuDataLapangan';
import { DAFTAR_BLOK, UBAH_JADI, cocokKueri, type DefinisiBlok } from '../lib/blok-jenis';

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
  /** Teks saat memo kosong dan hanya bisa dibaca. */
  kosong?: string;
  /** Memo lain yang bisa ditautkan lewat "Tautan ke halaman". */
  halaman?: { id: string; judul: string; ikon?: string }[];
  /** Membuka memo lain dari chip tautan halaman. */
  onBukaHalaman?: (idMemo: string) => void;
  /** Blok "Halaman" (menu "/"): buat sub-halaman di dalam memo ini; null = gagal. */
  onBuatHalaman?: () => Promise<{ id: string; judul: string } | null>;
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
  if (!props.boleh) {
    const penuh = props.tinggi === 'penuh';
    const milik = props.onCentangBaca && props.idSaya
      ? new Set(ambilTugas(props.isi).filter((t) => t.pic === props.idSaya).map((t) => t.indeks))
      : null;
    return (
      <div className={`${props.kecil ? 'text-[14px]' : 'text-[16px]'} leading-[1.5] ${penuh ? 'flex-1 overflow-auto custom-scrollbar min-h-0' : ''}`}>
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
}

/**
 * Tabel ala Notion: sel bisa langsung diketik; "+ Baris", "+ Kolom", hapus
 * baris/kolom, dan baris judul. Disimpan sebagai satu baris `!tabel{…}`.
 */
const TabelSunting: React.FC<{ raw: string; onUbah: (raw: string) => void }> = ({ raw, onUbah }) => {
  const kisi = useRef<HTMLDivElement>(null);
  const t = bacaTabel(raw);
  if (!t) return null;
  const { baris, kepala } = t;
  const kirim = (b: string[][], k = kepala) => onUbah(rakitTabel(b, k));
  // Sel yang sudah ada langsung difokus; sel di baris baru menunggu render berikutnya.
  const fokusSel = (i: number, j: number) => {
    const cari = () => kisi.current?.querySelector(`input[data-sel="${i}-${j}"]`) as HTMLInputElement | null;
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
  const isiSel = (i: number, j: number, v: string) => kirim(baris.map((r, a) => (a === i ? r.map((c, x) => (x === j ? v : c)) : r)));
  const tombol = 'px-2 py-0.5 text-[12px] border border-white/20 text-zinc-300 hover:text-white hover:border-lime-400 bg-white/5 disabled:opacity-40';
  return (
    <div className="my-1" data-tabel ref={kisi}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="border-collapse text-[0.9375em]">
          <tbody>
            {baris.map((r, i) => (
              <tr key={i} className="group/baris">
                {r.map((c, j) => (
                  <td key={j} className={`border-2 border-white/20 p-0 align-top ${kepala && i === 0 ? 'bg-white/[0.07]' : ''}`}>
                    <input
                      value={c}
                      onChange={(e) => isiSel(i, j, e.target.value)}
                      onKeyDown={(e) => pindahSel(e, i, j)}
                      data-sel={`${i}-${j}`}
                      className={`w-full min-w-[110px] bg-transparent px-2 py-1 outline-none focus:bg-lime-500/10 ${kepala && i === 0 ? 'font-bold text-white' : 'text-zinc-100'}`}
                      placeholder={kepala && i === 0 ? `Kolom ${j + 1}` : ''}
                      aria-label={`Baris ${i + 1}, kolom ${j + 1}`}
                    />
                  </td>
                ))}
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
      <div className="flex flex-wrap items-center gap-1.5 mt-1">
        <button type="button" disabled={baris.length >= MAKS_BARIS_TABEL} onClick={() => kirim([...baris, baris[0].map(() => '')])} className={tombol}>+ Baris</button>
        <button type="button" disabled={baris[0].length >= MAKS_KOLOM_TABEL} onClick={() => kirim(baris.map((r) => [...r, '']))} className={tombol}>+ Kolom</button>
        <label className="flex items-center gap-1 text-[12px] text-zinc-400 ml-1 cursor-pointer">
          <input type="checkbox" checked={kepala} onChange={(e) => kirim(baris, e.target.checked)} className="accent-lime-500" /> Baris judul
        </label>
      </div>
    </div>
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
}>(({ b, no, terpilih, ph, sentuh, menuTerbuka, tim, h, terbuka = false, hal }) => {
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
  const geserKiri = dlm(b) ? { paddingLeft: `${dlm(b) * 1.5}em` } : undefined;
  const gagang = !sentuh && (
    <div style={{ left: `calc(${dlm(b) * 1.5}em - 2.75rem)` }} className={`absolute top-0.5 w-11 flex justify-end pr-1 ${menuTerbuka ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`} contentEditable={false}>
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
          className={`outline-none ${info.jenis === 'garis' || info.jenis === 'video' || info.jenis === 'tabel' || info.jenis === 'data' ? 'py-1 w-full' : 'py-1 inline-block max-w-full'} ${terpilih ? 'outline outline-2 outline-lime-400 outline-offset-1 bg-lime-500/10' : ''}`}
          aria-label={info.jenis === 'garis' ? 'Divider' : info.jenis === 'gambar' ? 'Gambar' : info.jenis === 'video' ? 'Video' : info.jenis === 'tabel' ? 'Tabel' : info.jenis === 'data' ? 'Data Lapangan' : 'Berkas'}
        >
          {blok.jenis === 'garis' && <hr className="my-1.5 border-t-2 border-dashed border-white/20" />}
          {blok.jenis === 'gambar' && <GambarBlok kunci={blok.kunci} nama={blok.nama} />}
          {blok.jenis === 'video' && <KartuVideo url={blok.url} judul={blok.judul} />}
          {blok.jenis === 'tabel' && <TabelSunting raw={b.raw} onUbah={(raw) => h.current.ubahRaw(b.id, raw)} />}
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
  memoId, isi, onIsi, tim, notify, bolehSebutOrang = false, onBukaPica, tinggi = 220, kecil = false, halaman = [], onBukaHalaman,
  onBuatHalaman,
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
  const [slash, setSlash] = useState<{ id: string; query: string; panjang: number; jenis?: 'sebut' } | null>(null);
  const [pilih, setPilih] = useState(0);
  const [panel, setPanel] = useState<{ jenis: 'tenggat' | 'orang' | 'menu' | 'video' | 'halaman'; id: string; pos: number } | null>(null);
  const [urlVideo, setUrlVideo] = useState('');
  const [judulVideo, setJudulVideo] = useState('');
  const [cariHalaman, setCariHalaman] = useState('');
  const [tgl, setTgl] = useState('');
  const [jam, setJam] = useState('');
  const [sibuk, setSibuk] = useState(0);
  const [seret, setSeret] = useState<{ id: string; ke: number; atas: number } | null>(null);
  const [pilihan, setPilihan] = useState<{ x: number; y: number } | null>(null);
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
  const jumlahFormat = (md: string) => uraiInline(md).filter((x) => x.t !== 'teks' && (x.t !== 'orang' || tim.some((t) => t.id === x.id))).length;
  const jumlahFormatDom = (el: HTMLElement) => el.querySelectorAll('b,strong,i,em,s,strike,del,code,[data-raw]').length;

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

    const sebelum = c === null ? '' : (el.textContent ?? '').slice(0, c);
    const m = sebelum.match(/(^|\s)\/([a-zA-Z]*)$/);
    const ms = m ? null : sebelum.match(/(^|\s)@([a-zA-Z0-9_-]*)$/);
    const cocok = m ?? ms;
    if (cocok) {
      const q = cocok[2].toLowerCase();
      const jenis = ms ? 'sebut' as const : undefined;
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
  const pindah = (id: string, ke: number) => {
    const arr = blokRef.current.slice();
    const i = arr.findIndex((b) => b.id === id);
    if (i < 0) return;
    const j = akhirSubpohon(arr, i);
    if (ke >= i && ke <= j) return;
    const potong = arr.splice(i, j - i);
    const tujuan = ke > i ? ke - potong.length : ke;
    const batas = tujuan > 0 ? dlm(arr[tujuan - 1]) + 1 : 0;
    const geserDalam = Math.min(dlm(potong[0]), batas) - dlm(potong[0]);
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
      .filter((p) => (orangAktif || p.id !== 'orang') && (halamanLain.length > 0 || p.id !== 'tautan_halaman') && (onBuatHalaman || p.id !== 'halaman'))
      .filter((p) => cocokKueri(p, q));
  }, [slash, orangAktif, tim, halamanLain.length, onBuatHalaman]);

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
    if (pid === 'halaman') void buatSubHalaman(id);
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

  const format = (jenis: 'tebal' | 'miring' | 'coret' | 'kode' | 'tautan') => {
    const id = blokDariPilihan();
    if (!id) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (jenis === 'tebal') { document.execCommand('bold'); return; }
    if (jenis === 'miring') { document.execCommand('italic'); return; }
    if (jenis === 'coret') { document.execCommand('strikeThrough'); return; }
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

  const tujuanSeret = (y: number): { ke: number; atas: number } => {
    const daftar = daftarEl.current;
    if (!daftar) return { ke: 0, atas: 0 };
    const dasar = daftar.getBoundingClientRect().top;
    const baris = blokRef.current.map((b) => daftar.querySelector(`[data-baris="${b.id}"]`) as HTMLElement | null);
    for (let k = 0; k < baris.length; k++) {
      const r = baris[k]?.getBoundingClientRect();
      if (r && y < r.top + r.height / 2) return { ke: k, atas: r.top - dasar };
    }
    const akhir = baris[baris.length - 1]?.getBoundingClientRect();
    return { ke: baris.length, atas: akhir ? akhir.bottom - dasar : 0 };
  };

  const pegang = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    const y0 = e.clientY;
    let menyeret = false;
    const gerak = (ev: PointerEvent) => {
      if (!menyeret && Math.abs(ev.clientY - y0) < 5) return;
      menyeret = true;
      setSeret({ id, ...tujuanSeret(ev.clientY) });
    };
    const lepas = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      window.removeEventListener('pointercancel', lepas);
      if (menyeret) {
        setSeret(null);
        if (ev.type === 'pointerup') pindah(id, tujuanSeret(ev.clientY).ke);
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
    if ((e.target as HTMLElement).closest?.('[data-tabel]')) return;
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

    if (slash && daftarSlash.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setPilih((p) => (p + 1) % daftarSlash.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setPilih((p) => (p - 1 + daftarSlash.length) % daftarSlash.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pilihPerintah(daftarSlash[Math.min(pilih, daftarSlash.length - 1)].id); return; }
    }
    if (e.key === 'Escape') { setSlash(null); setPanel(null); return; }
    if (e.key === 'Tab') { e.preventDefault(); ubahKedalaman(id, e.shiftKey ? -1 : 1); return; }
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
    const teks = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
    const el = elRef.current.get(id);
    const i = indeks(id);
    if (!teks || !el || i < 0) return;
    const b = blokRef.current[i];
    const info = bacaBaris(b.raw);
    const { sebelum, sesudah } = potongDiKursor(el);
    const baris = teks.split('\n');
    if (baris.length === 1) {
      ganti(id, rakitBaris(info.jenis, sebelum + baris[0] + sesudah, info.selesai), { id, pos: panjangTampil(sebelum + baris[0], ctx) });
      return;
    }
    // Banyak baris: tiap baris jadi blok; tanda # - [ ] di teks tempelan ikut dibaca.
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
    if (media && t.closest('[data-tabel]')) return;
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

  const h = useRef<Penangan>({ daftar: () => undefined, centang: () => undefined, pegang: () => undefined, tambahDi: () => undefined, lipat: () => undefined, ubahRaw: () => undefined });
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
  };

  // ---- tampilan ---------------------------------------------------------------------

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
  // Nomor urut per kedalaman, seperti Notion: daftar bernomor di dalam anak mulai lagi dari 1.
  const urut: number[] = [];
  const baris: React.ReactNode[] = [];
  blok.forEach((b, i) => {
    const info = bacaBaris(b.raw);
    const d = dlm(b);
    urut[d] = info.jenis === 'nomor' ? (urut[d] ?? 0) + 1 : 0;
    urut.length = d + 1;
    if (tersembunyi.has(b.id)) return;
    const ph = info.jenis === 'teks'
      ? (satuKosong ? 'Mulai menulis… ketik / untuk menu blok' : aktifId === b.id ? 'Ketik / untuk perintah' : '')
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
          style={{ paddingLeft: `${(d + 1) * 1.5}em` }}
          className="block w-full text-left py-[3px] text-[0.875em] text-zinc-600 hover:text-zinc-400"
        >
          Toggle kosong. Ketuk untuk menambah isi.
        </button>,
      );
    }
  });

  const blokAktif = aktifId ? blok.find((b) => b.id === aktifId) : undefined;
  const infoAktif = blokAktif ? bacaBaris(blokAktif.raw) : null;
  const penuh = tinggi === 'penuh';
  const tahanFokus = { onPointerDown: (e: React.PointerEvent) => e.preventDefault(), onMouseDown: (e: React.MouseEvent) => e.preventDefault() };

  const tombolAlat = (id: string, Ikon: Ikon, label: string, aksi: () => void, aktif = false) => (
    <button key={id} type="button" {...tahanFokus} onClick={aksi} className={`btn-ikon !w-9 !h-9 shrink-0 ${aktif ? 'bg-lime-600' : 'bg-zinc-800'}`} title={label} aria-label={label}>
      <Ikon size={15} />
    </button>
  );

  const menuBlok = panel?.jenis === 'menu' ? blok.find((b) => b.id === panel.id) : undefined;
  const menuInfo = menuBlok ? bacaBaris(menuBlok.raw) : null;

  return (
    <div
      ref={wadah}
      className={`relative flex flex-col ${penuh ? 'flex-1 min-h-0' : ''}`}
      onKeyDown={tekan}
      onInput={ketik}
      onPaste={tempel}
      onClick={klik}
      onFocus={masukFokus}
      onBlur={keluarFokus}
    >
      {sibuk > 0 && <p className="text-[11px] text-lime-300 flex items-center gap-1 mb-1"><Loader2 size={11} className="animate-spin" /> mengunggah…</p>}

      <div className={`${penuh ? 'flex-1 overflow-y-auto custom-scrollbar min-h-0' : ''}`}>
        <div ref={daftarEl} className={`relative ${kecil ? 'text-[14px]' : 'text-[16px]'}`} style={penuh ? undefined : { minHeight: typeof tinggi === 'number' ? tinggi : undefined }}>
          {baris}

          {/* Area kosong di bawah: klik untuk lanjut menulis, seperti halaman Notion. */}
          <div className="min-h-[56px] cursor-text" onMouseDown={(e) => { e.preventDefault(); klikBawah(); }} aria-hidden="true" />

          {seret && <div className="absolute left-0 right-0 h-1 bg-lime-400 pointer-events-none" style={{ top: seret.atas - 2 }} />}

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

      {/* HP: bilah alat di atas papan ketik untuk blok yang sedang ditulis (pengganti "+" dan "⋮⋮"). */}
      {sentuh && blokAktif && infoAktif && (
        <div className="sticky bottom-0 z-20 -mx-1 mt-1 px-1 py-1 bg-zinc-950 border-t-2 border-white/20 flex items-center gap-1 overflow-x-auto custom-scrollbar" role="toolbar" aria-label="Alat blok">
          {tombolAlat('tambah', Plus, 'Tambah blok', () => blokBaruSetelah(blokAktif.id))}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('menu', Type, 'Ubah jadi', () => {
            const el = elRef.current.get(blokAktif.id);
            setSlash(null);
            setPanel(panel?.jenis === 'menu' ? null : { jenis: 'menu', id: blokAktif.id, pos: el ? offsetKursor(el) ?? 0 : 0 });
          }, panel?.jenis === 'menu')}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('ceklis', ListChecks, 'Ceklis', () => ubahJenis(blokAktif.id, infoAktif.jenis === 'ceklis' ? 'teks' : 'ceklis'), infoAktif.jenis === 'ceklis')}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('tebal', Bold, 'Tebal', () => format('tebal'))}
          {BLOK_TEKS.has(infoAktif.jenis) && tombolAlat('miring', Italic, 'Miring', () => format('miring'))}
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
        <div className="fixed z-[400] flex items-center gap-0.5 retro-box !bg-zinc-900 border-lime-500 !p-0.5 -translate-x-1/2" style={{ left: pilihan.x, top: Math.max(4, pilihan.y - 44) }} role="toolbar" aria-label="Format teks" {...tahanFokus}>
          {([['tebal', Bold, 'Tebal (Ctrl+B)'], ['miring', Italic, 'Miring (Ctrl+I)'], ['coret', Strikethrough, 'Coret (Ctrl+Shift+S)'], ['kode', Code, 'Kode (Ctrl+E)'], ['tautan', Link2, 'Tautan (Ctrl+K)']] as const).map(([j, Ikon, l]) => (
            <button key={j} type="button" onClick={() => format(j)} className="w-8 h-8 flex items-center justify-center text-zinc-200 hover:bg-lime-600 hover:text-white" title={l} aria-label={l}><Ikon size={14} /></button>
          ))}
        </div>,
        document.body,
      )}

      <input ref={berkasGambar} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void unggah(e.target.files, true); e.target.value = ''; }} />
      <input ref={berkasLain} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg" multiple className="hidden" onChange={(e) => { void unggah(e.target.files, false); e.target.value = ''; }} />
    </div>
  );
};
