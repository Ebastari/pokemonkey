import React, { useState } from 'react';
import { CalendarClock, FileText, ImageOff, Info, Loader2 } from 'lucide-react';
import { uraiBlok, uraiInline, toggleBaris, type Blok } from '../server/src/memo-blok';
import type { AnggotaRingkas } from '../lib/tipe-api';
import { useFotoProfil } from '../lib/foto';
import { unduhBerkasMemo } from '../lib/memo-gambar';
import * as W from '../lib/waktu';

/**
 * Penampil memo. Teks memo tetap teks biasa (lihat server/src/memo-blok.ts untuk
 * daftar markup): judul 1–3, butir, daftar bernomor, ceklis dengan tenggat dan
 * orang, kutipan, kotak penting, garis, gambar, berkas, serta tebal/miring/
 * coret/kode/tautan di dalam baris. Kotak centang bisa diklik bila `onToggle`
 * diberikan; nilainya nomor baris di teks asli, sehingga pemanggil cukup
 * mengganti baris itu (toggleBaris).
 */

export { toggleBaris };

interface Konteks {
  tim?: AnggotaRingkas[];
  onBukaPica?: (idPica: string) => void;
}

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
export const TeksInline: React.FC<{ teks: string; selesai?: boolean } & Konteks> = ({ teks, selesai, tim, onBukaPica }) => (
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
        case 'pica':
          return onBukaPica
            ? <button key={i} type="button" onClick={() => onBukaPica(x.id)} className="inline-block px-1.5 border border-amber-400/60 text-amber-200 bg-amber-950/30 text-[12px] font-bold whitespace-nowrap hover:border-amber-300">{x.id}</button>
            : <span key={i} className="inline-block px-1.5 border border-amber-400/60 text-amber-200 bg-amber-950/30 text-[12px] font-bold whitespace-nowrap">{x.id}</span>;
      }
    })}
  </>
);

const BlokMemo: React.FC<{ b: Blok; onToggle?: () => void } & Konteks> = ({ b, onToggle, tim, onBukaPica }) => {
  const ctx = { tim, onBukaPica };
  switch (b.jenis) {
    case 'judul':
      if (b.tingkat === 1) return <h3 className="text-[17px] font-bold text-lime-300 mt-3 mb-1 first:mt-0"><TeksInline teks={b.teks} {...ctx} /></h3>;
      if (b.tingkat === 2) return <h4 className="text-[15px] font-bold text-white mt-2 mb-0.5"><TeksInline teks={b.teks} {...ctx} /></h4>;
      return <h5 className="text-[14px] font-bold text-zinc-100 mt-1.5"><TeksInline teks={b.teks} {...ctx} /></h5>;
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
    case 'berkas': return <BerkasMemo kunci={b.kunci} nama={b.nama} blok />;
    case 'kosong': return <div className="h-2" />;
    default: return <p className="text-zinc-100"><TeksInline teks={b.teks} {...ctx} /></p>;
  }
};

/** Seluruh isi memo. */
export const IsiMemo: React.FC<{
  isi: string; onToggle?: (indeksBaris: number) => void; kosong?: string;
} & Konteks> = ({ isi, onToggle, kosong = 'Kosong.', tim, onBukaPica }) => (
  <>
    {uraiBlok(isi).map((b, i) => <BlokMemo key={i} b={b} tim={tim} onBukaPica={onBukaPica} onToggle={onToggle ? () => onToggle(i) : undefined} />)}
    {!isi.trim() && <p className="text-zinc-500">{kosong}</p>}
  </>
);
