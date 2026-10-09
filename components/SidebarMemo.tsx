import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronsLeft, FileText, FolderOpen, Home, Lock, NotebookPen, Pin, Plus, Search, ShieldCheck, Sparkles, SquarePen, Trash2, Users, X } from 'lucide-react';
import type { Memo } from '../types';
import { bacaProps } from './PropertiMemo';

/**
 * Sidebar halaman memo seperti Notion: ruang kerja di atas, Beranda & Cari,
 * lalu pohon halaman per bagian (Memo Internal = teamspace, Pribadi = private)
 * — sub-halaman tampil di bawah induknya dan bisa dibuka/dilipat — lalu Sampah
 * dan "Halaman baru" di bawah. Di laptop selalu tampil di kiri halaman; di HP
 * dibuka sebagai laci dari tombol menu.
 */

const ikonDari = (m: Memo) => {
  const v = bacaProps(m).ikon;
  return typeof v === 'string' && v ? v : '';
};

const urutDiubah = (a: Memo, b: Memo) => String(b.diubah_pada ?? b.dibuat_pada).localeCompare(String(a.diubah_pada ?? a.dibuat_pada));
/** Disematkan (untuk saya atau untuk semua) selalu di atas. */
export const tersemat = (m: Memo) => Boolean(m.sematan_saya || m.disematkan);
const urutSemat = (a: Memo, b: Memo) => Number(tersemat(b)) - Number(tersemat(a));

// Halaman yang sub-halamannya sedang dibuka, diingat per perangkat (seperti Notion).
const KUNCI_BUKA = 'pokemonkey_memo_sidebar_buka';
const bacaBuka = (): ReadonlySet<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(KUNCI_BUKA) || '[]') as string[]); } catch { return new Set(); }
};

interface Pohon {
  /** Anak per id induk; '' = halaman teratas (atau induknya tidak ada di daftar ini). */
  anak: Map<string, Memo[]>;
  /** Induk tiap halaman, untuk membuka leluhur halaman aktif. */
  induk: Map<string, string>;
}

function susunPohon(daftar: Memo[]): Pohon {
  const ada = new Set(daftar.map((m) => m.id));
  const anak = new Map<string, Memo[]>();
  const induk = new Map<string, string>();
  for (const m of daftar) {
    const k = m.induk_id && ada.has(m.induk_id) ? m.induk_id : '';
    if (k) induk.set(m.id, k);
    const d = anak.get(k) ?? [];
    d.push(m);
    anak.set(k, d);
  }
  return { anak, induk };
}

interface AksiBaris {
  aktifId: string;
  buka: ReadonlySet<string>;
  onBuka: (id: string) => void;
  onPilih: (id: string) => void;
  onBaruAnak?: (induk: Memo) => void;
  bolehAnak?: (m: Memo) => boolean;
}

const BarisHalaman: React.FC<{ m: Memo; dalam: number; pohon: Pohon | null } & AksiBaris> = ({ m, dalam, pohon, ...a }) => {
  const ikon = ikonDari(m);
  const aktif = m.id === a.aktifId;
  const anak = pohon?.anak.get(m.id) ?? [];
  const terbuka = anak.length > 0 && a.buka.has(m.id);
  const bisaAnak = Boolean(a.onBaruAnak && (!a.bolehAnak || a.bolehAnak(m)));
  return (
    <li>
      <div className={`group/baris flex items-center h-8 pr-1 ${aktif ? 'bg-white/10' : 'hover:bg-white/5'}`} style={{ paddingLeft: `${6 + dalam * 14}px` }}>
        {pohon ? (
          <button
            type="button"
            onClick={() => anak.length && a.onBuka(m.id)}
            className={`w-5 h-6 shrink-0 flex items-center justify-center ${anak.length ? 'text-zinc-400 hover:text-white hover:bg-white/10' : 'text-transparent cursor-default'}`}
            aria-label={anak.length ? (terbuka ? 'Lipat sub-halaman' : 'Buka sub-halaman') : undefined}
            aria-expanded={anak.length ? terbuka : undefined}
            tabIndex={anak.length ? 0 : -1}
          >
            {terbuka ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : <span className="w-2 shrink-0" />}
        <button
          type="button"
          onClick={() => a.onPilih(m.id)}
          className={`flex-1 min-w-0 flex items-center gap-2 pl-0.5 h-8 text-left text-[13px] ${aktif ? 'text-white font-bold' : 'text-zinc-300'}`}
          aria-current={aktif ? 'page' : undefined}
          title={m.judul || 'Tanpa judul'}
        >
          <span className="w-4 shrink-0 flex justify-center text-[14px] leading-none">{ikon || <FileText size={14} className="text-zinc-500" />}</span>
          <span className={`truncate flex-1 ${m.judul ? '' : 'text-zinc-500 italic'}`}>{m.judul || 'Tanpa judul'}</span>
          {m.disematkan ? <Pin size={11} className="text-red-400 shrink-0" aria-label="Disematkan untuk semua" /> : m.sematan_saya ? <Pin size={11} className="text-lime-300 shrink-0" aria-label="Disematkan" /> : null}
        </button>
        {bisaAnak && (
          <button
            type="button"
            onClick={() => a.onBaruAnak?.(m)}
            className="w-6 h-6 shrink-0 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 opacity-100 lg:opacity-0 lg:group-hover/baris:opacity-100 focus:opacity-100"
            title="Tambah sub-halaman di dalamnya"
            aria-label={`Tambah sub-halaman di ${m.judul || 'Tanpa judul'}`}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
      {terbuka && pohon && (
        <ul>
          {anak.map((c) => <BarisHalaman key={c.id} m={c} dalam={dalam + 1} pohon={pohon} {...a} />)}
        </ul>
      )}
    </li>
  );
};

const Bagian: React.FC<{
  judul: string; ikon: React.ReactNode; daftar: Memo[]; mencari: boolean; onTambah?: () => void;
} & AksiBaris> = ({ judul, ikon, daftar, mencari, onTambah, ...a }) => {
  const [buka, setBuka] = useState(true);
  // Saat mencari: daftar rata berisi semua yang cocok; selain itu pohon induk → sub-halaman.
  const pohon = useMemo(() => (mencari ? null : susunPohon(daftar)), [daftar, mencari]);
  const atas = pohon ? pohon.anak.get('') ?? [] : daftar;
  return (
    <section className="mb-3">
      <div className="group flex items-center gap-1 px-1.5 h-7 text-[12px] text-zinc-500">
        <button type="button" onClick={() => setBuka(!buka)} className="flex items-center gap-1 flex-1 min-w-0 hover:text-zinc-300 text-left" aria-expanded={buka}>
          {buka ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{ikon}<span className="truncate">{judul}</span>
          <span className="text-zinc-600 ml-1">{atas.length}</span>
        </button>
        {onTambah && (
          <button type="button" onClick={onTambah} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 hover:text-white opacity-100 lg:opacity-0 lg:group-hover:opacity-100" title={`Halaman baru di ${judul}`} aria-label={`Halaman baru di ${judul}`}>
            <Plus size={13} />
          </button>
        )}
      </div>
      {buka && (
        <ul>
          {atas.length === 0 && <li className="px-7 py-1 text-[12px] text-zinc-600">{mencari ? 'Tidak ada yang cocok' : 'Belum ada halaman'}</li>}
          {atas.map((m) => <BarisHalaman key={m.id} m={m} dalam={0} pohon={pohon} {...a} />)}
        </ul>
      )}
    </section>
  );
};

export const SidebarMemo: React.FC<{
  memoTim: Memo[]; memoPribadi: Memo[]; aktifId: string; lingkupAktif: 'tim' | 'pribadi' | 'rahasia';
  /** Memo rahasia yang boleh saya buka (pembuat atau orang yang dituju). */
  memoRahasia?: Memo[];
  bolehBuatTim: boolean; onPilih: (id: string) => void; onBaru: (lingkup: 'tim' | 'pribadi' | 'rahasia') => void;
  /** Pohon Folder Dokumen (tepat di atas Sampah), seperti penjelajah folder. */
  folder?: React.ReactNode;
  onBeranda: () => void; onTutup?: () => void; className?: string;
  /** Laptop: sembunyikan sidebar agar halaman memenuhi layar (tombol « seperti Notion). */
  onSembunyi?: () => void;
  /** "+" di baris halaman: sub-halaman baru di dalamnya (hanya bila `bolehAnak`). */
  onBaruAnak?: (induk: Memo) => void;
  bolehAnak?: (m: Memo) => boolean;
  /** Buka Sampah (memo yang dihapus, bisa dipulihkan). */
  onSampah?: () => void;
  /** Tanya semua memo dengan AI. */
  onTanya?: () => void;
}> = ({
  memoTim, memoPribadi, memoRahasia = [], aktifId, lingkupAktif, bolehBuatTim, onPilih, onBaru, onBeranda, onTutup, className = '', onSembunyi,
  onBaruAnak, bolehAnak, onSampah, onTanya, folder,
}) => {
  const [cari, setCari] = useState('');
  const [cariBuka, setCariBuka] = useState(false);
  const [bukaSimpan, setBukaSimpan] = useState<ReadonlySet<string>>(bacaBuka);

  const saring = (d: Memo[]) => {
    const q = cari.trim().toLowerCase();
    return (q ? d.filter((m) => `${m.judul} ${m.isi}`.toLowerCase().includes(q)) : d).slice().sort(urutDiubah);
  };
  const tim = useMemo(() => saring(memoTim).sort(urutSemat), [memoTim, cari]); // eslint-disable-line react-hooks/exhaustive-deps
  const pribadi = useMemo(() => saring(memoPribadi).sort(urutSemat), [memoPribadi, cari]); // eslint-disable-line react-hooks/exhaustive-deps
  const rahasia = useMemo(() => saring(memoRahasia).sort(urutSemat), [memoRahasia, cari]); // eslint-disable-line react-hooks/exhaustive-deps
  // Bagian "Disematkan": pintasan rata ke halaman penting dari semua bagian.
  const semat = useMemo(() => [...tim, ...rahasia, ...pribadi].filter(tersemat), [tim, rahasia, pribadi]);

  // Leluhur halaman yang sedang dibuka selalu terbuka, supaya halaman itu terlihat di pohon.
  const buka = useMemo(() => {
    const semua = new Map([...memoTim, ...memoPribadi, ...memoRahasia].map((m) => [m.id, m]));
    const hasil = new Set(bukaSimpan);
    let x = semua.get(aktifId)?.induk_id;
    for (let i = 0; x && i < 50; i += 1) { hasil.add(x); x = semua.get(x)?.induk_id; }
    return hasil;
  }, [bukaSimpan, aktifId, memoTim, memoPribadi, memoRahasia]);
  const alihBuka = (id: string) => {
    const baru = new Set(buka);
    if (baru.has(id)) baru.delete(id); else baru.add(id);
    setBukaSimpan(baru);
    try { localStorage.setItem(KUNCI_BUKA, JSON.stringify([...baru].slice(-200))); } catch { /* abaikan */ }
  };

  const aksi: AksiBaris = { aktifId, buka, onBuka: alihBuka, onPilih, onBaruAnak, bolehAnak };
  const mencari = Boolean(cari.trim());

  return (
    <aside className={`w-[260px] h-full flex-col bg-zinc-900 border-r-2 border-white/10 shrink-0 ${className}`} aria-label="Daftar halaman memo">
      <div className="h-12 shrink-0 flex items-center gap-2 px-3 border-b-2 border-white/10">
        <span className="w-6 h-6 bg-lime-500 border-2 border-black flex items-center justify-center shrink-0"><NotebookPen size={13} className="text-black" /></span>
        <span className="font-bold text-[14px] text-white truncate flex-1">Memo &amp; Surat</span>
        {onSembunyi && <button type="button" onClick={onSembunyi} className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10" title="Sembunyikan daftar halaman (Ctrl+\)" aria-label="Sembunyikan daftar halaman"><ChevronsLeft size={17} /></button>}
        {onTutup && <button type="button" onClick={onTutup} className="w-7 h-7 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10" aria-label="Tutup daftar"><X size={16} /></button>}
      </div>

      <div className="px-2 pt-2 space-y-0.5">
        <button type="button" onClick={onBeranda} className="w-full flex items-center gap-2 px-2 h-8 text-[13px] text-zinc-300 hover:bg-white/5 text-left">
          <Home size={15} /> Beranda <span className="text-[11px] text-zinc-500 ml-auto">papan memo</span>
        </button>
        {cariBuka ? (
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input autoFocus value={cari} onChange={(e) => setCari(e.target.value)} onBlur={() => { if (!cari) setCariBuka(false); }} placeholder="Cari halaman…" className="input-retro !pl-8 !py-1 !text-[13px]" aria-label="Cari halaman" />
          </div>
        ) : (
          <button type="button" onClick={() => setCariBuka(true)} className="w-full flex items-center gap-2 px-2 h-8 text-[13px] text-zinc-300 hover:bg-white/5 text-left">
            <Search size={15} /> Cari
          </button>
        )}
        {onTanya && (
          <button type="button" onClick={onTanya} className="w-full flex items-center gap-2 px-2 h-8 text-[13px] text-purple-200 hover:bg-white/5 text-left">
            <Sparkles size={15} /> Tanya AI <span className="text-[11px] text-zinc-500 ml-auto">semua memo</span>
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar px-2 pt-3">
        {semat.length > 0 && !mencari && (
          <Bagian judul="Disematkan" ikon={<Pin size={12} />} daftar={semat} mencari {...aksi} />
        )}
        <Bagian judul="Memo Internal" ikon={<Users size={12} />} daftar={tim} mencari={mencari} onTambah={bolehBuatTim ? () => onBaru('tim') : undefined} {...aksi} />
        <Bagian judul="Rahasia" ikon={<ShieldCheck size={12} />} daftar={rahasia} mencari={mencari} onTambah={() => onBaru('rahasia')} {...aksi} />
        <Bagian judul="Pribadi" ikon={<Lock size={12} />} daftar={pribadi} mencari={mencari} onTambah={() => onBaru('pribadi')} {...aksi} />
        {folder && !mencari && (
          <section className="mb-3">
            <div className="flex items-center gap-1 px-1.5 h-7 text-[12px] text-zinc-500"><FolderOpen size={12} /> Folder Dokumen</div>
            {folder}
          </section>
        )}
      </nav>

      <div className="p-2 border-t-2 border-white/10 space-y-1">
        {onSampah && (
          <button type="button" onClick={onSampah} className="w-full flex items-center gap-2 px-2 h-8 text-[13px] text-zinc-300 hover:bg-white/5 text-left">
            <Trash2 size={15} /> Sampah · 30 hari <span className="text-[11px] text-zinc-500 ml-auto">pulihkan</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onBaru(lingkupAktif === 'tim' && bolehBuatTim ? 'tim' : lingkupAktif === 'rahasia' ? 'rahasia' : 'pribadi')}
          className="w-full flex items-center gap-2 px-2 h-9 text-[13px] font-bold text-zinc-200 border-2 border-white/15 hover:border-white/40 hover:bg-white/5"
        >
          <SquarePen size={15} /> Halaman baru
          <span className="ml-auto text-[11px] font-normal text-zinc-500">{lingkupAktif === 'tim' && bolehBuatTim ? 'Memo Internal' : lingkupAktif === 'rahasia' ? 'Rahasia' : 'Pribadi'}</span>
        </button>
      </div>
    </aside>
  );
};
