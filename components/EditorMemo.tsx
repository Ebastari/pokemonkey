import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AtSign, Bold, CalendarClock, ChevronDown, ChevronUp, Code, Copy, FileText, GripVertical, Heading1, Heading2, Heading3,
  ImagePlus, ImageOff, Info, Italic, Link2, List, ListChecks, ListOrdered, Loader2, Minus, Paperclip, Plus, Quote,
  Strikethrough, Trash2, Type, X,
} from 'lucide-react';
import { jamSah, tanggalSah, ubahTenggatBaris, uraiBlok, uraiInline } from '../server/src/memo-blok';
import {
  BLOK_TEKS, bacaBaris, cekPintasan, dariDom, jenisLanjutan, keHtml, kursorDiTepi, offsetKursor, panjangTampil,
  pasangKursor, potongDiKursor, rakitBaris, rentang, type JenisBlok,
} from '../lib/memo-dom';
import { barisUntukUnggah, kecilkanGambar, unduhBerkasMemo, unggahKeMemo } from '../lib/memo-gambar';
import { useFotoProfil } from '../lib/foto';
import type { AnggotaRingkas } from '../lib/tipe-api';
import * as W from '../lib/waktu';
import { IsiMemo } from './MemoMarkup';

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
  /** Teks saat memo kosong dan hanya bisa dibaca. */
  kosong?: string;
}

type Ikon = React.ComponentType<{ size?: number; className?: string }>;

interface Blok { id: string; raw: string; v: number }
interface Fokus { id: string; pos: number | 'akhir' }

let seri = 0;
const idBaru = () => `b${Date.now().toString(36)}${(seri++).toString(36)}`;
const dariTeks = (t: string): Blok[] => t.split('\n').map((raw) => ({ id: idBaru(), raw, v: 0 }));
const keTeks = (b: readonly Blok[]) => b.map((x) => x.raw).join('\n');

interface Perintah { id: string; label: string; ket: string; ikon: Ikon; kata: string[]; jenis?: JenisBlok; grup?: string }

const UBAH_JADI_DASAR: Perintah[] = [
  { id: 'teks', jenis: 'teks', label: 'Teks', ket: 'Paragraf biasa', ikon: Type, kata: ['teks', 'paragraf', 'text', 'biasa'] },
  { id: 'h1', jenis: 'h1', label: 'Judul 1', ket: 'Judul bagian besar', ikon: Heading1, kata: ['judul', 'heading', 'h1', 'besar'] },
  { id: 'h2', jenis: 'h2', label: 'Judul 2', ket: 'Judul bagian sedang', ikon: Heading2, kata: ['judul', 'subjudul', 'heading', 'h2', 'sedang'] },
  { id: 'h3', jenis: 'h3', label: 'Judul 3', ket: 'Judul bagian kecil', ikon: Heading3, kata: ['judul', 'heading', 'h3', 'kecil'] },
  { id: 'butir', jenis: 'butir', label: 'Daftar butir', ket: 'Daftar dengan titik', ikon: List, kata: ['daftar', 'butir', 'bullet', 'list'] },
  { id: 'nomor', jenis: 'nomor', label: 'Daftar bernomor', ket: 'Daftar 1, 2, 3', ikon: ListOrdered, kata: ['nomor', 'bernomor', 'numbered', 'urut', 'daftar'] },
  { id: 'ceklis', jenis: 'ceklis', label: 'Ceklis', ket: 'Tugas yang bisa dicentang', ikon: ListChecks, kata: ['ceklis', 'todo', 'tugas', 'centang', 'checklist'] },
  { id: 'kutipan', jenis: 'kutipan', label: 'Kutipan', ket: 'Kutipan atau rujukan', ikon: Quote, kata: ['kutipan', 'quote'] },
  { id: 'penting', jenis: 'penting', label: 'Kotak penting', ket: 'Catatan yang menonjol', ikon: Info, kata: ['penting', 'callout', 'catatan', 'kotak', 'info'] },
];

const UBAH_JADI: Perintah[] = UBAH_JADI_DASAR.map((p) => ({ ...p, grup: 'Blok' }));

const SISIPAN_DASAR: Perintah[] = [
  { id: 'garis', label: 'Garis pemisah', ket: 'Pisahkan bagian', ikon: Minus, kata: ['garis', 'pemisah', 'divider'] },
  { id: 'gambar', label: 'Gambar', ket: 'Foto dari kamera/galeri', ikon: ImagePlus, kata: ['gambar', 'foto', 'image', 'kamera'] },
  { id: 'berkas', label: 'Berkas', ket: 'PDF, Excel, Word', ikon: Paperclip, kata: ['berkas', 'file', 'lampiran', 'pdf'] },
  { id: 'tenggat', label: 'Tenggat', ket: 'Tanggal & jam; ceklis masuk Jadwal', ikon: CalendarClock, kata: ['tenggat', 'tanggal', 'jadwal', 'date', 'waktu'] },
  { id: 'orang', label: 'Sebut orang', ket: 'Penanggung jawab tugas', ikon: AtSign, kata: ['orang', 'pic', 'sebut', 'mention', 'anggota'] },
];

const SISIPAN: Perintah[] = SISIPAN_DASAR.map((p) => ({ ...p, grup: 'Sisipkan' }));

const PH: Partial<Record<JenisBlok, string>> = {
  h1: 'Judul 1', h2: 'Judul 2', h3: 'Judul 3', butir: 'Daftar', nomor: 'Daftar', ceklis: 'Tugas', kutipan: 'Kutipan', penting: 'Catatan penting',
};

const KELAS_BARIS: Partial<Record<JenisBlok, string>> = {
  h1: 'mt-4 first:mt-0', h2: 'mt-3 first:mt-0', h3: 'mt-2 first:mt-0',
  kutipan: 'border-l-4 border-lime-500/60 pl-3 my-0.5',
  penting: 'border-2 border-amber-400/70 bg-amber-950/30 px-2.5 py-1.5 my-1',
};

const KELAS_TEKS: Record<string, string> = {
  teks: 'text-zinc-100', h1: 'text-[19px] font-bold text-lime-300', h2: 'text-[16px] font-bold text-white', h3: 'text-[14.5px] font-bold text-zinc-100',
  butir: 'text-zinc-100', nomor: 'text-zinc-100', ceklis: 'text-zinc-100', kutipan: 'italic text-zinc-300', penting: 'text-zinc-100',
};

// ============================================================
// Pembungkus: memo yang tidak boleh diubah cukup ditampilkan
// ============================================================

export const EditorMemo: React.FC<Props> = (props) => {
  if (!props.boleh) {
    const penuh = props.tinggi === 'penuh';
    return (
      <div className={`text-[14px] leading-relaxed ${penuh ? 'flex-1 overflow-auto custom-scrollbar min-h-0' : ''}`}>
        <IsiMemo isi={props.isi} kosong={props.kosong ?? 'Belum ada isi.'} tim={props.tim} onBukaPica={props.onBukaPica} />
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
}

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
}>(({ b, no, terpilih, ph, sentuh, menuTerbuka, tim, h }) => {
  const info = bacaBaris(b.raw);
  const el = useRef<HTMLDivElement | null>(null);
  const terbaru = useRef({ isi: info.isi, tim, selesai: info.selesai });
  terbaru.current = { isi: info.isi, tim, selesai: info.selesai };

  // Isi kotak sunting diatur sendiri (bukan oleh React) agar kursor tidak meloncat saat mengetik.
  const pasang = useCallback((node: HTMLDivElement | null) => {
    if (node && node !== el.current) {
      const t = terbaru.current;
      node.innerHTML = keHtml(t.isi, { tim: t.tim, selesai: t.selesai });
    }
    el.current = node;
    h.current.daftar(b.id, node);
  }, [b.id, h]);
  const versiAwal = useRef(b.v);
  useLayoutEffect(() => {
    if (b.v === versiAwal.current || !el.current) return;
    versiAwal.current = b.v;
    const t = terbaru.current;
    el.current.innerHTML = keHtml(t.isi, { tim: t.tim, selesai: t.selesai });
  }, [b.v]);

  const gagang = !sentuh && (
    <div className={`absolute -left-11 top-0.5 w-11 flex justify-end pr-1 ${menuTerbuka ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`} contentEditable={false}>
      <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => h.current.tambahDi(b.id)} className="w-5 h-6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10" title="Tambah blok di bawah" aria-label="Tambah blok"><Plus size={14} /></button>
      <button type="button" tabIndex={-1} onPointerDown={(e) => h.current.pegang(e, b.id)} className="w-5 h-6 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 cursor-grab touch-none" title="Seret untuk memindah · ketuk untuk menu" aria-label="Menu blok"><GripVertical size={14} /></button>
    </div>
  );

  if (!BLOK_TEKS.has(info.jenis)) {
    const blok = uraiBlok(b.raw)[0];
    return (
      <div data-baris={b.id} className="group relative">
        {gagang}
        <div
          ref={(node) => h.current.daftar(b.id, node)}
          data-media={b.id}
          tabIndex={0}
          className={`outline-none ${info.jenis === 'garis' ? 'py-1' : 'py-1 inline-block max-w-full'} ${terpilih ? 'outline outline-2 outline-lime-400 outline-offset-1 bg-lime-500/10' : ''}`}
          aria-label={info.jenis === 'garis' ? 'Garis pemisah' : info.jenis === 'gambar' ? 'Gambar' : 'Berkas'}
        >
          {blok.jenis === 'garis' && <hr className="my-1.5 border-t-2 border-dashed border-white/20" />}
          {blok.jenis === 'gambar' && <GambarBlok kunci={blok.kunci} nama={blok.nama} />}
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
    : info.jenis === 'butir' ? <span className="w-4 shrink-0 flex justify-center pt-[11px] select-none" aria-hidden="true"><span className="w-1.5 h-1.5 bg-zinc-300" /></span>
      : info.jenis === 'nomor' ? <span className="min-w-[1.25rem] shrink-0 text-right text-zinc-400 select-none">{no}.</span>
        : info.jenis === 'penting' ? <Info size={15} className="mt-[5px] shrink-0 text-amber-300" />
          : <span className="hidden" />;

  return (
    <div data-baris={b.id} className={`group relative flex items-start gap-1.5 ${KELAS_BARIS[info.jenis] ?? ''}`}>
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
        className={`flex-1 min-w-0 outline-none whitespace-pre-wrap break-words py-[3px] leading-relaxed ${KELAS_TEKS[info.jenis]} ${info.jenis === 'ceklis' && info.selesai ? '!text-zinc-500 line-through' : ''} empty:before:content-[attr(data-ph)] empty:before:text-zinc-600 empty:before:pointer-events-none`}
      />
    </div>
  );
});
BlokBaris.displayName = 'BlokBaris';

// ============================================================
// Penyunting
// ============================================================

const EditorBlok: React.FC<Props> = ({ memoId, isi, onIsi, tim, notify, bolehSebutOrang = false, onBukaPica, tinggi = 220 }) => {
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
  const [panel, setPanel] = useState<{ jenis: 'tenggat' | 'orang' | 'menu'; id: string; pos: number } | null>(null);
  const [tgl, setTgl] = useState('');
  const [jam, setJam] = useState('');
  const [sibuk, setSibuk] = useState(0);
  const [seret, setSeret] = useState<{ id: string; ke: number; atas: number } | null>(null);
  const [pilihan, setPilihan] = useState<{ x: number; y: number } | null>(null);

  const sentuh = useMemo(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches), []);
  const orangAktif = bolehSebutOrang && tim.length > 0;
  const ctx = useMemo(() => ({ tim }), [tim]);

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
      el.innerHTML = keHtml(info.isi, { tim, selesai: info.selesai });
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
        const baru: Blok = { id: idBaru(), raw: '', v: 0 };
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
      el.innerHTML = keHtml(md, { tim, selesai: info.selesai });
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
    // Enter pada butir/ceklis/kutipan kosong = keluar dari daftar.
    if (!sebelum && !sesudah && info.jenis !== 'teks' && !info.jenis.startsWith('h')) {
      ganti(id, '', { id, pos: 0 });
      return;
    }
    const arr = blokRef.current.slice();
    if (!sebelum && sesudah) {
      const atas: Blok = { id: idBaru(), raw: rakitBaris(jenisLanjutan(info.jenis), ''), v: 0 };
      arr.splice(i, 0, atas);
      terapkan(arr, { fokus: { id, pos: 0 } });
      return;
    }
    const baru: Blok = { id: idBaru(), raw: rakitBaris(jenisLanjutan(info.jenis), sesudah), v: 0 };
    arr[i] = { ...b, raw: rakitBaris(info.jenis, sebelum, info.selesai), v: b.v + 1 };
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
    if (i === 0) return;
    const prev = blokRef.current[i - 1];
    const pi = bacaBaris(prev.raw);
    if (pi.jenis === 'garis') {
      terapkan(blokRef.current.filter((_, k) => k !== i - 1), { fokus: { id, pos: 0 } });
      return;
    }
    if (!BLOK_TEKS.has(pi.jenis)) {
      if (!md) terapkan(blokRef.current.filter((_, k) => k !== i));
      pilihMedia(prev.id);
      return;
    }
    const arr = blokRef.current.slice();
    arr[i - 1] = { ...prev, raw: rakitBaris(pi.jenis, pi.isi + md, pi.selesai), v: prev.v + 1 };
    arr.splice(i, 1);
    terapkan(arr, { fokus: { id: prev.id, pos: panjangTampil(pi.isi, ctx) } });
  };

  const hapusDiAkhir = (id: string) => {
    const el = elRef.current.get(id);
    const i = indeks(id);
    if (!el || i < 0 || i === blokRef.current.length - 1) return;
    const b = blokRef.current[i];
    const info = bacaBaris(b.raw);
    const next = blokRef.current[i + 1];
    const ni = bacaBaris(next.raw);
    if (ni.jenis === 'garis') { terapkan(blokRef.current.filter((_, k) => k !== i + 1), { fokus: { id, pos: 'akhir' } }); return; }
    if (!BLOK_TEKS.has(ni.jenis)) { pilihMedia(next.id); return; }
    const md = dariDom(el);
    const arr = blokRef.current.slice();
    arr[i] = { ...b, raw: rakitBaris(info.jenis, md + ni.isi, info.selesai), v: b.v + 1 };
    arr.splice(i + 1, 1);
    terapkan(arr, { fokus: { id, pos: panjangTampil(md, ctx) } });
  };

  const hapusBlok = (id: string) => {
    const i = indeks(id);
    if (i < 0) return;
    const arr = blokRef.current.filter((b) => b.id !== id);
    setTerpilih(null);
    setPanel(null);
    const tuju = arr[i - 1] ?? arr[i];
    terapkan(arr, tuju ? { fokus: { id: tuju.id, pos: arr[i - 1] ? 'akhir' : 0 } } : {});
  };

  const duplikat = (id: string) => {
    const i = indeks(id);
    if (i < 0) return;
    const salin: Blok = { id: idBaru(), raw: blokRef.current[i].raw, v: 0 };
    const arr = blokRef.current.slice();
    arr.splice(i + 1, 0, salin);
    setPanel(null);
    terapkan(arr, { fokus: { id: salin.id, pos: 'akhir' } });
  };

  const pindah = (id: string, ke: number) => {
    const i = indeks(id);
    if (i < 0 || ke === i || ke === i + 1) return;
    const arr = blokRef.current.slice();
    const [x] = arr.splice(i, 1);
    arr.splice(ke > i ? ke - 1 : ke, 0, x);
    terapkan(arr, { fokus: { id, pos: 'akhir' } });
  };
  const geser = (id: string, arah: -1 | 1) => {
    const i = indeks(id);
    pindah(id, arah < 0 ? i - 1 : i + 2);
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
    const baru: Blok = { id: idBaru(), raw: '/', v: 0 };
    const arr = blokRef.current.slice();
    arr.splice(i + 1, 0, baru);
    terapkan(arr, { fokus: { id: baru.id, pos: 1 } });
    setSlash({ id: baru.id, query: '', panjang: 1 });
  };

  /** Klik di bawah blok terakhir: lanjut menulis di blok kosong terakhir atau buat yang baru. */
  const klikBawah = () => {
    const akhir = blokRef.current[blokRef.current.length - 1];
    if (akhir && akhir.raw === '') { fokusKe(akhir.id, 0); return; }
    const baru: Blok = { id: idBaru(), raw: '', v: 0 };
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

  const daftarSlash = useMemo(() => {
    if (!slash) return [];
    const q = slash.query;
    const cocok = (p: Perintah) => !q || p.kata.some((k) => k.startsWith(q)) || p.label.toLowerCase().startsWith(q);
    if (slash.jenis === 'sebut') {
      const hari = W.hariIniWita();
      const tgl = (n: number, label: string, kata: string[]): Perintah => {
        const t = W.geserHari(hari, n);
        return { id: `tgl:${t}`, label, ket: W.formatPanjang(t), ikon: CalendarClock, kata: [...kata, 'tanggal', 'tenggat'], grup: 'Tanggal' };
      };
      const orang: Perintah[] = orangAktif
        ? tim.map((t) => ({ id: `orang:${t.id}`, label: t.nama, ket: `@${t.id}`, ikon: AtSign, kata: [t.id, ...t.nama.toLowerCase().split(/\s+/)], grup: 'Orang' }))
        : [];
      return [
        ...orang,
        tgl(0, 'Hari ini', ['hari', 'ini', 'today']),
        tgl(1, 'Besok', ['besok', 'tomorrow']),
        tgl(7, 'Minggu depan', ['minggu', 'depan', 'pekan']),
        { id: 'tgl:pilih', label: 'Pilih tanggal…', ket: 'Tanggal dan jam tertentu', ikon: CalendarClock, kata: ['pilih', 'jam'], grup: 'Tanggal' },
      ].filter(cocok);
    }
    return [...UBAH_JADI, ...SISIPAN]
      .filter((p) => orangAktif || p.id !== 'orang')
      .filter(cocok);
  }, [slash, orangAktif, tim]);

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
      const kosongkan = b.raw === '';
      const sesudah: Blok = { id: idBaru(), raw: '', v: 0 };
      if (kosongkan) arr.splice(i, 1, { ...b, raw: '---', v: b.v + 1 }, sesudah);
      else arr.splice(i + 1, 0, { id: idBaru(), raw: '---', v: 0 }, sesudah);
      terapkan(arr, { fokus: { id: sesudah.id, pos: 0 } });
      return;
    }
    if (pid === 'gambar' || pid === 'berkas') {
      sisipSetelah.current = id;
      (pid === 'gambar' ? berkasGambar : berkasLain).current?.click();
      return;
    }
    if (pid === 'tenggat') { bukaTenggat(id, pos); return; }
    if (pid === 'orang') { setPanel({ jenis: 'orang', id, pos }); }
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
        const baru: Blok = { id: idBaru(), raw: barisUntukUnggah(hasil, gambar && siap.type.startsWith('image/')), v: 0 };
        const arr = blokRef.current.slice();
        const i = jangkar ? arr.findIndex((b) => b.id === jangkar) : -1;
        if (i >= 0 && arr[i].raw === '') arr.splice(i, 1, baru);
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
          const kosong: Blok = { id: idBaru(), raw: '', v: 0 };
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
      const baru: Blok = { id: idBaru(), raw: '', v: 0 };
      const arr = blokRef.current.slice();
      arr.splice(i + 1, 0, baru);
      setTerpilih(null);
      terapkan(arr, { fokus: { id: baru.id, pos: 0 } });
      return;
    }
    if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); setTerpilih(null); fokusKe(blokRef.current[i - 1].id, 'akhir'); return; }
    if (e.key === 'ArrowDown' && i < blokRef.current.length - 1) { e.preventDefault(); setTerpilih(null); fokusKe(blokRef.current[i + 1].id, 0); return; }
    if (e.key === 'Escape') setTerpilih(null);
  };

  const tekan = (e: React.KeyboardEvent) => {
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
    if (e.key === 'Tab') { e.preventDefault(); return; }
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); enter(id); return; }

    const i = indeks(id);
    const sel = window.getSelection();
    const satuTitik = sel?.isCollapsed ?? true;
    const pos = offsetKursor(el);
    // Cadangan untuk peramban yang tidak mengirim beforeinput saat kursor di tepi blok.
    if (e.key === 'Backspace' && satuTitik && pos === 0 && !mod) { e.preventDefault(); hapusDiAwal(id); return; }
    if (e.key === 'Delete' && satuTitik && pos === (el.textContent?.length ?? 0) && !mod) { e.preventDefault(); hapusDiAkhir(id); return; }
    if (e.shiftKey || !satuTitik) return;
    const prev = blokRef.current[i - 1];
    const next = blokRef.current[i + 1];
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
    const pertama = !sebelum && info.jenis === 'teks' ? baris[0] : rakitBaris(info.jenis, sebelum + baris[0], info.selesai);
    const akhirRaw = baris[baris.length - 1];
    const ai = bacaBaris(akhirRaw);
    const blokBaru: Blok[] = [
      { ...b, raw: pertama, v: b.v + 1 },
      ...baris.slice(1, -1).map((raw) => ({ id: idBaru(), raw, v: 0 })),
    ];
    const akhir: Blok = { id: idBaru(), raw: BLOK_TEKS.has(ai.jenis) ? rakitBaris(ai.jenis, ai.isi + sesudah, ai.selesai) : akhirRaw, v: 0 };
    blokBaru.push(akhir);
    if (!BLOK_TEKS.has(ai.jenis) && sesudah) blokBaru.push({ id: idBaru(), raw: sesudah, v: 0 });
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

  const h = useRef<Penangan>({ daftar: () => undefined, centang: () => undefined, pegang: () => undefined, tambahDi: () => undefined });
  h.current = {
    daftar: (id, el) => { if (el) elRef.current.set(id, el); else elRef.current.delete(id); },
    centang,
    pegang,
    tambahDi: blokBaruSetelah,
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
    : { className: 'absolute z-30', style: { top: bawahBaris(id) + 2, left: 44 } });

  const satuKosong = blok.length === 1 && blok[0].raw === '';
  let urut = 0;
  const baris = blok.map((b) => {
    const info = bacaBaris(b.raw);
    urut = info.jenis === 'nomor' ? urut + 1 : 0;
    const ph = info.jenis === 'teks'
      ? (satuKosong ? 'Mulai menulis… ketik / untuk menu blok' : aktifId === b.id ? 'Ketik / untuk perintah' : '')
      : PH[info.jenis] ?? '';
    return (
      <BlokBaris
        key={b.id}
        b={b}
        no={urut}
        terpilih={terpilih === b.id}
        ph={ph}
        sentuh={sentuh}
        menuTerbuka={panel?.jenis === 'menu' && panel.id === b.id}
        tim={tim}
        h={h}
      />
    );
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
        <div ref={daftarEl} className={`relative text-[14px] ${sentuh ? 'pl-0.5' : 'pl-11'}`} style={penuh ? undefined : { minHeight: typeof tinggi === 'number' ? tinggi : undefined }}>
          {baris}

          {/* Area kosong di bawah: klik untuk lanjut menulis, seperti halaman Notion. */}
          <div className="min-h-[56px] cursor-text" onMouseDown={(e) => { e.preventDefault(); klikBawah(); }} aria-hidden="true" />

          {seret && <div className="absolute left-11 right-0 h-1 bg-lime-400 pointer-events-none" style={{ top: seret.atas - 2 }} />}

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
                      <span className="flex flex-col leading-tight min-w-0"><span className="text-[13px] font-bold">{p.label}</span><span className="text-[11px] text-zinc-300/70 truncate">{p.ket}</span></span>
                    </button>
                  </React.Fragment>
                );
              })}
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
