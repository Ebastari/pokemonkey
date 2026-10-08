import React, { useEffect, useId, useState } from 'react';
import { CalendarClock, Check, ChevronRight, Copy, ExternalLink, FileText, ImageOff, Info, Link2, Loader2, Lock, Play, Video } from 'lucide-react';
import { daftarJudul, uraiBlok, uraiInline, toggleBaris, type Blok, type Inline, type RataGambar, type InfoPicaLive, type OpsiGrafikTabel } from '../server/src/memo-blok';
import { BAHASA_KODE, WARNA_KODE, sorotKode } from '../server/src/tampil-memo';
import { rumusHtml, useKatex } from '../lib/rumus';
import { GrafikReklamasi } from './GrafikReklamasi';
import type { AnggotaRingkas } from '../lib/tipe-api';
import { useFotoProfil } from '../lib/foto';
import { unduhBerkasMemo } from '../lib/memo-gambar';
import * as W from '../lib/waktu';
import { infoHalaman, type PetaHalaman } from '../lib/memo-dom';
import { KartuDataLapangan } from './KartuDataLapangan';
import { GrafikTabelMemo } from './GrafikTabelMemo';
import { sinkronkanTabelPica } from '../lib/pica-tabel';

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
/** Lebar (%) & perataan gambar, sama di mode baca dan penyunting. */
export const gayaGambar = (lebar?: number, rata?: RataGambar): React.CSSProperties => ({
  ...(lebar ? { width: `${lebar}%` } : {}),
  ...(rata === 'tengah' ? { marginLeft: 'auto', marginRight: 'auto' } : rata === 'kanan' ? { marginLeft: 'auto' } : {}),
});

const GambarMemo: React.FC<{ kunci: string; nama: string; lebar?: number; rata?: RataGambar }> = ({ kunci, nama, lebar, rata }) => {
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
      <button type="button" onClick={() => setBesar(true)} className="block my-1.5 max-w-full" style={gayaGambar(lebar, rata)} title="Ketuk untuk memperbesar">
        <img src={url} alt={nama} className={`${lebar ? 'w-full' : 'max-w-full max-h-[420px]'} border-2 border-white/25`} />
        {nama && nama !== 'foto' && <span className={`block text-[12px] text-zinc-400 mt-0.5 ${rata === 'tengah' ? 'text-center' : rata === 'kanan' ? 'text-right' : 'text-left'}`}>{nama}</span>}
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

/** Blok kode: pewarna sintaks ringan + tombol salin. */
export const BlokKode: React.FC<{ bahasa: string; isi: string; kepala?: React.ReactNode }> = ({ bahasa, isi, kepala }) => {
  const [disalin, setDisalin] = useState(false);
  const salin = async () => {
    try { await navigator.clipboard.writeText(isi); setDisalin(true); setTimeout(() => setDisalin(false), 1500); } catch { /* papan klip ditolak */ }
  };
  return (
    <div className="my-1.5 border-2 border-white/20 bg-black/60">
      <div className="flex items-center gap-2 px-2 h-7 border-b border-white/10 text-[11px] text-zinc-400">
        {kepala ?? <span>{BAHASA_KODE.find((b) => b.id === bahasa)?.label ?? bahasa}</span>}
        <button type="button" onClick={salin} className="ml-auto flex items-center gap-1 hover:text-white" title="Salin kode">
          {disalin ? <Check size={12} /> : <Copy size={12} />}{disalin ? 'Tersalin' : 'Salin'}
        </button>
      </div>
      <pre className="m-0 px-3 py-2 overflow-x-auto custom-scrollbar text-[0.85em] leading-[1.55] font-mono whitespace-pre">
        <code>{sorotKode(isi, bahasa).map((p, i) => <span key={i} style={{ color: WARNA_KODE[p.t].gelap }}>{p.v}</span>)}{!isi && <span className="text-zinc-600">Kode kosong</span>}</code>
      </pre>
    </div>
  );
};

/** Rumus satu blok (LaTeX → MathML). */
export const BlokRumus: React.FC<{ isi: string }> = ({ isi }) => {
  const siap = useKatex(Boolean(isi));
  const html = siap ? rumusHtml(isi, true) : null;
  if (!isi.trim()) return <p className="my-1 text-zinc-500 text-[0.9em]">Rumus kosong</p>;
  return html
    ? <div className="rumus-blok my-2 overflow-x-auto custom-scrollbar text-center text-zinc-100" dangerouslySetInnerHTML={{ __html: html }} />
    : <div className="my-2 text-center"><code className="text-lime-200">{isi}</code></div>;
};

const RumusSebaris: React.FC<{ tex: string }> = ({ tex }) => {
  const siap = useKatex(true);
  const html = siap ? rumusHtml(tex) : null;
  return html ? <span className="inline-block align-baseline" dangerouslySetInnerHTML={{ __html: html }} /> : <code className="text-lime-200">{tex}</code>;
};

/** Kartu tautan web (bookmark): judul, keterangan, dan nama situs. */
export const KartuPenanda: React.FC<{ url: string; judul: string; ket: string; situs: string }> = ({ url, judul, ket, situs }) => (
  <a href={url} target="_blank" rel="noopener noreferrer" className="flex my-1.5 max-w-[640px] border-2 border-white/25 hover:border-lime-400 bg-white/[0.03]" title={url}>
    <span className="flex-1 min-w-0 px-3 py-2">
      <span className="block text-[14px] font-bold text-zinc-100 truncate">{judul || url}</span>
      {ket && <span className="block text-[12px] text-zinc-400 mt-0.5 line-clamp-2">{ket}</span>}
      <span className="flex items-center gap-1 mt-1 text-[11px] text-zinc-500"><Link2 size={11} />{situs || namaSitus(url)}<ExternalLink size={10} /></span>
    </span>
  </a>
);

/** Daftar isi dari judul-judul memo; ketuk untuk melompat. */
export const DaftarIsi: React.FC<{ judul: { indeks: number; tingkat: number; teks: string }[]; onLompat?: (indeks: number) => void }> = ({ judul, onLompat }) => (
  <nav className="my-1.5 py-1 border-l-2 border-white/15 pl-2" aria-label="Daftar isi">
    {judul.length === 0 && <p className="text-zinc-500 text-[0.9em]">Tambahkan judul (#, ##, ###) agar daftar isi terisi.</p>}
    {judul.map((j) => (
      <button key={j.indeks} type="button" onClick={() => onLompat?.(j.indeks)} className="block w-full text-left text-[0.95em] text-zinc-300 underline decoration-white/20 hover:text-white py-0.5" style={{ paddingLeft: `${(j.tingkat - 1) * 1.25}em` }}>
        {j.teks || 'Tanpa judul'}
      </button>
    ))}
  </nav>
);

/** Isi satu baris: tanda format, tautan, tenggat, orang, PICA. */
export const TeksInline: React.FC<{ teks: string; selesai?: boolean } & Konteks> = ({ teks, ...ctx }) => (
  <PotonganInline daftar={uraiInline(teks)} {...ctx} />
);

const PotonganInline: React.FC<{ daftar: Inline[]; selesai?: boolean } & Konteks> = ({ daftar, selesai, tim, onBukaPica, onBukaHalaman, halaman }) => (
  <>
    {daftar.map((x, i) => {
      switch (x.t) {
        case 'teks': return <React.Fragment key={i}>{x.v}</React.Fragment>;
        case 'baris': return <br key={i} />;
        case 'garisbawah': return <u key={i}>{x.v}</u>;
        case 'warna': return <span key={i} className={`m${x.jenis}-${x.warna}`}><PotonganInline daftar={x.isi} selesai={selesai} tim={tim} onBukaPica={onBukaPica} onBukaHalaman={onBukaHalaman} halaman={halaman} /></span>;
        case 'rumus': return <RumusSebaris key={i} tex={x.v} />;
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
export const TabelBaca: React.FC<{
  baris: string[][];
  kepala: boolean;
  pica?: InfoPicaLive;
  grafik?: OpsiGrafikTabel;
} & Konteks> = ({ baris, kepala, pica, grafik, ...ctx }) => {
  const [dataBaris, setDataBaris] = useState(baris);

  useEffect(() => {
    setDataBaris(baris);
    if (!pica?.aktif) return;
    let batal = false;
    sinkronkanTabelPica(pica)
      .then((hasil) => {
        if (!batal && hasil) {
          setDataBaris(hasil.baris);
        }
      })
      .catch(() => {});
    return () => {
      batal = true;
    };
  }, [baris, pica?.aktif, pica?.filterStatus, pica?.picaIds?.join(',')]);

  return (
    <div className="my-2">
      {/* Badge Status PICA Live vs Statis */}
      {pica && (
        <div
          className={`flex items-center justify-between gap-2 px-2.5 py-1 mb-1 border rounded-xs text-[11px] ${
            pica.aktif
              ? 'bg-lime-950/30 border-lime-500/30 text-lime-300'
              : 'bg-zinc-900 border-amber-500/30 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {pica.aktif ? (
              <>
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                <span className="font-bold text-lime-300">Live PICA</span>
                <span className="text-zinc-300">
                  ({pica.mode === 'pilihan'
                    ? `${pica.picaIds?.length || dataBaris.length - 1} Item Terpilih`
                    : `Status: ${(pica.filterStatus || 'semua').toUpperCase()}`})
                </span>
                {pica.terakhirUpdate && (
                  <span className="text-zinc-500">• Update: {pica.terakhirUpdate}</span>
                )}
              </>
            ) : (
              <>
                <Lock size={12} className="text-amber-400" />
                <span className="font-bold text-amber-300">Tabel PICA Ditetapkan (Statis)</span>
                {pica.ditetapkanPada && (
                  <span className="text-zinc-400">• Ditetapkan pada {pica.ditetapkanPada}</span>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Grid Tabel */}
      <div className="overflow-x-auto custom-scrollbar pb-1">
        <table className="border-collapse text-[0.9375em]">
          <tbody>
            {dataBaris.map((r, i) => (
              <tr key={i} className={kepala && i === 0 ? 'bg-white/[0.07]' : ''}>
                {r.map((c, j) =>
                  kepala && i === 0 ? (
                    <th
                      key={j}
                      className="border-2 border-white/25 px-2 py-1 text-left align-top min-w-[90px] font-bold text-white break-words"
                    >
                      <TeksInline teks={c} {...ctx} />
                    </th>
                  ) : (
                    <td
                      key={j}
                      className="border-2 border-white/20 px-2 py-1 align-top min-w-[90px] text-zinc-100 break-words"
                    >
                      <TeksInline teks={c} {...ctx} />
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Grafik yang terkoneksi langsung dengan baris tabel terkini */}
      {grafik?.aktif && (
        <GrafikTabelMemo baris={dataBaris} kepala={kepala} grafik={grafik} />
      )}
    </div>
  );
};

const BlokMemo: React.FC<{
  b: Blok; onToggle?: () => void; terbuka?: boolean; onLipat?: () => void;
  /** Isi memo lengkap (daftar isi) dan cara melompat ke satu blok. */
  isiPenuh?: string; onLompat?: (indeks: number) => void;
} & Konteks> = ({ b, onToggle, terbuka, onLipat, tim, onBukaPica, onBukaHalaman, halaman, isiPenuh = '', onLompat }) => {
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
    case 'gambar': return <GambarMemo kunci={b.kunci} nama={b.nama} lebar={b.lebar} rata={b.rata} />;
    case 'kode': return <BlokKode bahasa={b.bahasa} isi={b.isi} />;
    case 'rumus': return <BlokRumus isi={b.isi} />;
    case 'daftarisi': return <DaftarIsi judul={daftarJudul(isiPenuh)} onLompat={onLompat} />;
    case 'penanda': return <KartuPenanda url={b.url} judul={b.judul} ket={b.ket} situs={b.situs} />;
    case 'kolom': return null;
    case 'grafik': return <GrafikReklamasi blok={b} />;
    case 'video': return <KartuVideo url={b.url} judul={b.judul} />;
    case 'tabel': return (
      <TabelBaca
        baris={b.baris}
        kepala={b.kepala}
        pica={b.pica}
        grafik={b.grafik}
        {...ctx}
      />
    );
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
  const wadahId = useId();
  const daftar = uraiBlok(isi);
  const lompat = (i: number) => {
    document.getElementById(wadahId)?.querySelector(`[data-indeks="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const geser = (n: number) => (n > 0 ? { paddingLeft: `${n * 1.5}em` } : undefined);
  /** Blok [dari, sampai) relatif ke kedalaman `dasar`; kolom bersebelahan jadi satu baris kolom. */
  const susun = (dari: number, sampai: number, dasar: number): React.ReactNode[] => {
    const hasil: React.ReactNode[] = [];
    const akhirAnak = (j: number) => { let k = j + 1; while (k < sampai && daftar[k].kedalaman > daftar[j].kedalaman) k += 1; return k; };
    let i = dari;
    while (i < sampai) {
      const b = daftar[i];
      if (b.jenis === 'kolom') {
        const kolom: [number, number][] = [];
        let j = i;
        while (j < sampai && daftar[j].jenis === 'kolom' && daftar[j].kedalaman === b.kedalaman) { const k = akhirAnak(j); kolom.push([j + 1, k]); j = k; }
        hasil.push(
          <div key={`kolom-${i}`} style={geser(b.kedalaman - dasar)} className="grid gap-x-6 gap-y-2 my-1 sm:grid-flow-col sm:auto-cols-fr">
            {kolom.map(([a, z], n) => <div key={n} className="min-w-0">{susun(a, z, b.kedalaman + 1)}</div>)}
          </div>,
        );
        i = j;
        continue;
      }
      const indeks = i;
      const buka = terbuka.has(indeks);
      hasil.push(
        <div key={indeks} data-indeks={indeks} style={geser(b.kedalaman - dasar)}>
          <BlokMemo
            b={b}
            tim={tim}
            onBukaPica={onBukaPica}
            onBukaHalaman={onBukaHalaman}
            halaman={halaman}
            isiPenuh={isi}
            onLompat={lompat}
            onToggle={onToggle && (!bolehToggle || bolehToggle(indeks)) ? () => onToggle(indeks) : undefined}
            terbuka={buka}
            onLipat={() => setTerbuka((t) => { const n = new Set(t); if (n.has(indeks)) n.delete(indeks); else n.add(indeks); return n; })}
          />
        </div>,
      );
      i = b.jenis === 'toggle' && !buka ? akhirAnak(i) : i + 1;
    }
    return hasil;
  };
  return (
    <div id={wadahId}>
      {susun(0, daftar.length, 0)}
      {!isi.trim() && <p className="text-zinc-500">{kosong}</p>}
    </div>
  );
};
