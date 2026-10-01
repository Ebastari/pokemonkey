import React, { useState } from 'react';
import { CalendarClock, ChevronRight, ExternalLink, FileText, ImageOff, Info, Loader2, Play, Video } from 'lucide-react';
import { uraiBlok, uraiInline, toggleBaris, type Blok } from '../server/src/memo-blok';
import type { AnggotaRingkas } from '../lib/tipe-api';
import { useFotoProfil } from '../lib/foto';
import { unduhBerkasMemo } from '../lib/memo-gambar';
import * as W from '../lib/waktu';
import { infoHalaman, type PetaHalaman } from '../lib/memo-dom';
import { KartuDataLapangan } from './KartuDataLapangan';

/**
 * Penampil memo. Teks memo tetap teks biasa (lihat server/src/memo-blok.ts untuk
 * daftar markup): judul 1–4, butir, daftar bernomor, ceklis dengan tenggat dan
 * orang, kutipan, callout, divider, gambar, video, berkas, tautan halaman, serta tebal/miring/
 * coret/kode/tautan di dalam baris. Kotak centang bisa diklik bila `onToggle`
 * diberikan; nilainya nomor baris di teks asli, sehingga pemanggil cukup
 * mengganti baris itu (toggleBaris).
 */

export { toggleBaris };

interface Konteks {
  tim?: AnggotaRingkas[];
  onBukaPica?: (idPica: string) => void;
  /** Membuka memo lain dari chip "Tautan ke halaman". */
  onBukaHalaman?: (idMemo: string) => void;
  /** Judul & ikon terkini halaman yang ditautkan / sub-halaman. */
  halaman?: PetaHalaman;
}

/** Id video YouTube dari alamat watch/youtu.be/shorts/embed, atau null. */
export function idYoutube(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

const namaSitus = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/** Blok video: pratinjau YouTube (atau kartu tautan); ketuk untuk memutar di aplikasi/peramban video. */
export const KartuVideo: React.FC<{ url: string; judul: string }> = ({ url, judul }) => {
  const yt = idYoutube(url);
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block my-1.5 max-w-[560px] border-2 border-white/25 bg-black/40 hover:border-lime-400 group/video" title="Buka video">
      {yt ? (
        <span className="relative block aspect-video bg-black">
          <img src={`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" loading="lazy" draggable={false} />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-14 h-10 bg-red-600 border-2 border-black shadow-[3px_3px_0_#000] flex items-center justify-center group-hover/video:scale-110 transition-transform"><Play size={20} className="text-white fill-white" /></span>
          </span>
        </span>
      ) : (
        <span className="flex items-center justify-center aspect-[16/6] bg-zinc-900"><Video size={28} className="text-zinc-400" /></span>
      )}
      <span className="flex items-center gap-2 px-2 py-1.5 text-[13px]">
        <Video size={13} className="text-zinc-400 shrink-0" />
        <span className="font-bold text-zinc-100 truncate flex-1">{judul || 'Video'}</span>
        <span className="text-[11px] text-zinc-500 shrink-0">{namaSitus(url)}</span>
        <ExternalLink size={12} className="text-zinc-500 shrink-0" />
      </span>
    </a>
  );
};

const namaDepan = (id: string, tim?: AnggotaRingkas[]) => tim?.find((t) => t.id === id)?.nama.split(' ')[0] ?? null;

/** Penanda tenggat: merah bila lewat, kuning hari ini, redup bila sudah selesai. */
export const ChipTenggat: React.FC<{ tanggal: string; jam: string | null; selesai?: boolean }> = ({ tanggal, jam, selesai }) => {
  const sisa = W.selisihHari(tanggal, W.hariIniWita());
  const kelas = selesai
    ? 'border-white/15 text-zinc-500'
    : sisa < 0 ? 'border-red-400 text-red-300 bg-red-950/40'
      : sisa === 0 ? 'border-amber-400 text-amber-200 bg-amber-950/40'
        : 'border-sky-400/60 text-sky-200 bg-sky-950/30';
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 border text-[12px] font-bold whitespace-nowrap align-baseline ${kelas}`} title={`Tenggat ${W.formatPanjang(tanggal)}${jam ? ` ${jam}` : ''}`}>
      <CalendarClock size={11} />{W.formatPendek(tanggal)}{jam ? ` ${jam}` : ''}
    </span>
  );
};

/** Gambar di dalam memo; ketuk untuk memperbesar. */
const GambarMemo: React.FC<{ kunci: string; nama: string }> = ({ kunci, nama }) => {
  const url = useFotoProfil(kunci);
  const [besar, setBesar] = useState(false);
  if (!url) {
    return (
      <div className="my-1 h-24 border-2 border-dashed border-white/20 flex items-center justify-center gap-2 text-[12px] text-zinc-500" role="img" aria-label={`Gambar ${nama}`}>
        <ImageOff size={14} /> Memuat gambar…
      </div>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setBesar(true)} className="block my-1.5 max-w-full" title="Ketuk untuk memperbesar">
        <img src={url} alt={nama} className="max-w-full max-h-[420px] border-2 border-white/25" />
        {nama && nama !== 'foto' && <span className="block text-[11px] text-zinc-500 mt-0.5 text-left">{nama}</span>}
      </button>
      {besar && (
        <div className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-3 cursor-zoom-out" onClick={() => setBesar(false)} role="dialog" aria-label={`Gambar ${nama}`}>
          <img src={url} alt={nama} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  );
};

/** Berkas terlampir (PDF, Excel, dll.): ketuk untuk menyimpan/membagikan. */
const BerkasMemo: React.FC<{ kunci: string; nama: string; blok?: boolean }> = ({ kunci, nama, blok }) => {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState(false);
  const buka = async () => {
    setSibuk(true); setGalat(false);
    try { await unduhBerkasMemo(kunci, nama); } catch { setGalat(true); } finally { setSibuk(false); }
  };
  return (
    <button type="button" onClick={buka} disabled={sibuk} className={`${blok ? 'my-1 flex' : 'inline-flex'} items-center gap-1.5 px-2 py-0.5 border-2 text-[13px] font-bold ${galat ? 'border-red-400 text-red-300' : 'border-white/25 text-zinc-100 hover:border-lime-400'} bg-white/5`} title={galat ? 'Berkas tidak dapat dimuat' : 'Simpan atau bagikan berkas'}>
      {sibuk ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}{nama}
    </button>
  );
};

/** Isi satu baris: tanda format, tautan, tenggat, orang, PICA. */
export const TeksInline: React.FC<{ teks: string; selesai?: boolean } & Konteks> = ({ teks, selesai, tim, onBukaPica, onBukaHalaman, halaman }) => (
  <>
    {uraiInline(teks).map((x, i) => {
      switch (x.t) {
        case 'teks': return <React.Fragment key={i}>{x.v}</React.Fragment>;
        case 'tebal': return <b key={i} className="text-white">{x.v}</b>;
        case 'miring': return <i key={i}>{x.v}</i>;
        case 'coret': return <s key={i} className="text-zinc-400">{x.v}</s>;
        case 'kode': return <code key={i} className="px-1 bg-black/40 border border-white/15 text-lime-200 text-[0.92em]">{x.v}</code>;
        case 'tautan': return <a key={i} href={x.url} target="_blank" rel="noopener noreferrer" className="text-sky-300 underline break-all">{x.v}</a>;
        case 'berkas': return <BerkasMemo key={i} kunci={x.kunci} nama={x.v} />;
        case 'tenggat': return <ChipTenggat key={i} tanggal={x.tanggal} jam={x.jam} selesai={selesai} />;
        case 'orang': {
          const nama = namaDepan(x.id, tim);
          return nama
            ? <span key={i} className="inline-block px-1.5 border border-lime-500/50 text-lime-200 bg-lime-950/30 text-[12px] font-bold whitespace-nowrap" title={`Penanggung jawab: ${nama}`}>@{nama}</span>
            : <React.Fragment key={i}>@{x.id}</React.Fragment>;
        }
        case 'halaman': {
          const h = infoHalaman(x.id, x.v, halaman);
          return (
            <button key={i} type="button" disabled={!onBukaHalaman} onClick={() => onBukaHalaman?.(x.id)} className={`inline-flex items-center gap-1 px-1.5 border text-[0.9em] font-bold whitespace-nowrap align-baseline ${h.hilang ? 'border-white/15 text-zinc-500 line-through' : 'border-white/30 bg-white/5 text-zinc-100 underline decoration-white/30 hover:border-lime-400'}`} title={h.hilang ? 'Halaman ada di Sampah atau sudah dihapus' : 'Buka halaman'}>
              {h.ikon} {h.judul}
            </button>
          );
        }
        case 'pica':
          return onBukaPica
            ? <button key={i} type="button" onClick={() => onBukaPica(x.id)} className="inline-block px-1.5 border border-amber-400/60 text-amber-200 bg-amber-950/30 text-[12px] font-bold whitespace-nowrap hover:border-amber-300">{x.id}</button>
            : <span key={i} className="inline-block px-1.5 border border-amber-400/60 text-amber-200 bg-amber-950/30 text-[12px] font-bold whitespace-nowrap">{x.id}</span>;
      }
    })}
  </>
);

/** Tabel baca-saja; baris pertama jadi judul kolom bila `kepala`. */
export const TabelBaca: React.FC<{ baris: string[][]; kepala: boolean } & Konteks> = ({ baris, kepala, ...ctx }) => (
  <div className="my-1.5 overflow-x-auto custom-scrollbar">
    <table className="border-collapse text-[0.9375em]">
      <tbody>
        {baris.map((r, i) => (
          <tr key={i} className={kepala && i === 0 ? 'bg-white/[0.07]' : ''}>
            {r.map((c, j) => (kepala && i === 0
              ? <th key={j} className="border-2 border-white/25 px-2 py-1 text-left align-top min-w-[90px] font-bold text-white"><TeksInline teks={c} {...ctx} /></th>
              : <td key={j} className="border-2 border-white/20 px-2 py-1 align-top min-w-[90px] text-zinc-100"><TeksInline teks={c} {...ctx} /></td>))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const BlokMemo: React.FC<{ b: Blok; onToggle?: () => void; terbuka?: boolean; onLipat?: () => void } & Konteks> = ({ b, onToggle, terbuka, onLipat, tim, onBukaPica, onBukaHalaman, halaman }) => {
  const ctx = { tim, onBukaPica, onBukaHalaman, halaman };
  switch (b.jenis) {
    case 'toggle':
      return (
        <div className="flex items-start gap-1.5 py-[3px] text-zinc-100">
          <button type="button" onClick={onLipat} className="w-5 h-6 shrink-0 flex items-center justify-center hover:bg-white/10" aria-label={terbuka ? 'Lipat' : 'Buka'} aria-expanded={terbuka}>
            <ChevronRight size={15} className={`transition-transform ${terbuka ? 'rotate-90' : ''}`} />
          </button>
          <span className="min-w-0 cursor-pointer" onClick={onLipat}><TeksInline teks={b.teks} {...ctx} /></span>
        </div>
      );
    case 'judul':
      // Ukuran sama dengan penyunting (Notion: 30/24/20 px pada teks 16 px).
      if (b.tingkat === 1) return <h3 className="text-[1.875em] leading-[1.3] font-bold text-lime-300 mt-6 mb-0.5 py-[3px] first:mt-0"><TeksInline teks={b.teks} {...ctx} /></h3>;
      if (b.tingkat === 2) return <h4 className="text-[1.5em] leading-[1.3] font-bold text-white mt-5 py-[3px] first:mt-0"><TeksInline teks={b.teks} {...ctx} /></h4>;
      if (b.tingkat === 3) return <h5 className="text-[1.25em] leading-[1.3] font-bold text-zinc-100 mt-3 py-[3px] first:mt-0"><TeksInline teks={b.teks} {...ctx} /></h5>;
      return <h6 className="text-[1.0625em] leading-[1.35] font-bold text-zinc-200 mt-2 py-[3px] first:mt-0"><TeksInline teks={b.teks} {...ctx} /></h6>;
    case 'ceklis':
      return (
        <label className={`flex items-start gap-2 py-0.5 ${onToggle ? 'cursor-pointer' : ''}`}>
          <input type="checkbox" checked={b.selesai} onChange={onToggle} disabled={!onToggle} className="mt-1 accent-lime-500" />
          <span className={b.selesai ? 'line-through text-zinc-500' : 'text-zinc-100'}><TeksInline teks={b.teks} selesai={b.selesai} {...ctx} /></span>
        </label>
      );
    case 'butir':
      return (
        <p className="flex items-start gap-1.5 text-zinc-100">
          <span className="w-4 shrink-0 flex justify-center pt-[9px]" aria-hidden="true"><span className="w-1.5 h-1.5 bg-zinc-300" /></span>
          <span className="min-w-0"><TeksInline teks={b.teks} {...ctx} /></span>
        </p>
      );
    case 'nomor': return <p className="pl-3 text-zinc-100"><span className="text-zinc-400 mr-1">{b.no}.</span><TeksInline teks={b.teks} {...ctx} /></p>;
    case 'kutipan': return <blockquote className="border-l-4 border-lime-500/60 pl-3 my-0.5 text-zinc-300 italic"><TeksInline teks={b.teks} {...ctx} /></blockquote>;
    case 'penting':
      return (
        <div className="my-1 px-3 py-2 border-2 border-amber-400/70 bg-amber-950/30 text-zinc-100 flex gap-2">
          <Info size={15} className="mt-0.5 shrink-0 text-amber-300" />
          <span className="min-w-0"><TeksInline teks={b.teks} {...ctx} /></span>
        </div>
      );
    case 'garis': return <hr className="my-2 border-t-2 border-dashed border-white/20" />;
    case 'gambar': return <GambarMemo kunci={b.kunci} nama={b.nama} />;
    case 'video': return <KartuVideo url={b.url} judul={b.judul} />;
    case 'tabel': return <TabelBaca baris={b.baris} kepala={b.kepala} {...ctx} />;
    case 'data': return <KartuDataLapangan blok={b} />;
    case 'berkas': return <BerkasMemo kunci={b.kunci} nama={b.nama} blok />;
    case 'kosong': return <div className="h-2" />;
    default: return <p className="text-zinc-100 py-[3px]"><TeksInline teks={b.teks} {...ctx} /></p>;
  }
};

/** Seluruh isi memo. */
export const IsiMemo: React.FC<{
  isi: string; onToggle?: (indeksBaris: number) => void; kosong?: string;
  /** Batasi centang ke baris tertentu (mis. tugas milik pembaca memo "Baca saja"). */
  bolehToggle?: (indeksBaris: number) => boolean;
} & Konteks> = ({ isi, onToggle, kosong = 'Kosong.', tim, onBukaPica, onBukaHalaman, halaman, bolehToggle }) => {
  // Saat dibaca, toggle terlipat seperti di Notion; nomor baris = indeks blok (untuk centang).
  const [terbuka, setTerbuka] = useState<ReadonlySet<number>>(() => new Set());
  const daftar = uraiBlok(isi);
  const hasil: React.ReactNode[] = [];
  let batas: number | null = null;
  daftar.forEach((b, i) => {
    if (batas !== null && b.kedalaman > batas) return;
    batas = null;
    const buka = terbuka.has(i);
    if (b.jenis === 'toggle' && !buka) batas = b.kedalaman;
    hasil.push(
      <div key={i} style={b.kedalaman ? { paddingLeft: `${b.kedalaman * 1.5}em` } : undefined}>
        <BlokMemo
          b={b}
          tim={tim}
          onBukaPica={onBukaPica}
          onBukaHalaman={onBukaHalaman}
          halaman={halaman}
          onToggle={onToggle && (!bolehToggle || bolehToggle(i)) ? () => onToggle(i) : undefined}
          terbuka={buka}
          onLipat={() => setTerbuka((t) => { const n = new Set(t); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
        />
      </div>,
    );
  });
  return (
    <>
      {hasil}
      {!isi.trim() && <p className="text-zinc-500">{kosong}</p>}
    </>
  );
};
