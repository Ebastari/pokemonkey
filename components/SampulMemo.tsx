import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useFotoProfil } from '../lib/foto';
import { kecilkanGambar, unggahKeMemo } from '../lib/memo-gambar';
import { GALERI_POKEMONKEY, SAMPUL_RESMI, SAMPUL_WARNA, bacaSampul, posisiSampul, type SampulGambar } from '../lib/sampul';

/**
 * Sampul halaman memo seperti Notion: pita gambar selebar halaman. Saat diarahkan
 * muncul "Ubah" (pemilih: galeri POKEMONKEY, resmi, warna, unggah), "Ubah posisi"
 * (geser gambar naik/turun lalu simpan), dan hapus.
 */

export interface PatchSampul { sampul?: string | null; sampul_y?: number | null }

/** Pemilih sampul; dipakai tombol "Ubah" dan "Tambahkan sampul". */
export const PemilihSampul: React.FC<{
  memoId: string; nilai: string; onPilih: (p: PatchSampul) => void; onTutup: () => void; notify: (m: string) => void;
  className?: string;
}> = ({ memoId, nilai, onPilih, onTutup, notify, className = '' }) => {
  const [tab, setTab] = useState<'galeri' | 'warna' | 'unggah'>('galeri');
  const [mengunggah, setMengunggah] = useState(false);
  const berkas = useRef<HTMLInputElement>(null);

  const unggah = async (f: File | undefined) => {
    if (!f) return;
    setMengunggah(true);
    try {
      const h = await unggahKeMemo(memoId, await kecilkanGambar(f, 1600));
      onPilih({ sampul: h.kunci, sampul_y: null });
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGUNGGAH SAMPUL'); }
    finally { setMengunggah(false); }
  };

  const kartu = (g: SampulGambar) => (
    <button
      key={g.kode}
      type="button"
      onClick={() => onPilih({ sampul: g.kode, sampul_y: null })}
      className={`text-left border-2 ${nilai === g.kode ? 'border-lime-400' : 'border-white/20 hover:border-white/60'}`}
      title={g.cerita ?? g.nama}
    >
      <span className={`block h-16 ${g.muat === 'utuh' ? 'bg-white' : 'bg-zinc-800'}`}>
        <img src={g.src} alt="" className={`w-full h-full ${g.muat === 'utuh' ? 'object-contain' : 'object-cover'}`} style={{ objectPosition: `center ${g.fokusY}%` }} draggable={false} />
      </span>
      <span className="block px-1.5 py-1 text-[11px] font-bold text-zinc-200 truncate">{g.nama}</span>
    </button>
  );

  return (
    <>
      <span className="fixed inset-0 z-40" onClick={onTutup} aria-hidden="true" />
      <div className={`absolute z-50 retro-box !bg-zinc-900 border-lime-500 !p-0 w-[22rem] max-w-[calc(100vw-1.5rem)] ${className}`} role="dialog" aria-label="Pilih sampul">
        <div className="flex items-center border-b-2 border-white/15">
          {([['galeri', 'Galeri'], ['warna', 'Warna'], ['unggah', 'Unggah']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={`px-3 py-2 text-[13px] font-bold border-b-2 -mb-[2px] ${tab === k ? 'border-lime-400 text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}>{l}</button>
          ))}
          <span className="flex-1" />
          {nilai && <button type="button" onClick={() => onPilih({ sampul: null, sampul_y: null })} className="px-3 py-2 text-[12px] text-red-300 hover:text-red-200">Hapus</button>}
          <button type="button" onClick={onTutup} className="px-2 text-zinc-400 hover:text-white" aria-label="Tutup"><X size={15} /></button>
        </div>
        <div className="p-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar space-y-3">
          {tab === 'galeri' && (
            <>
              <section>
                <p className="text-[11px] uppercase text-zinc-500 mb-1.5">POKEMONKEY</p>
                <div className="grid grid-cols-2 gap-1.5">{GALERI_POKEMONKEY.map(kartu)}</div>
                <p className="text-[11px] text-zinc-500 mt-1.5">Stage berikutnya menyusul.</p>
              </section>
              <section>
                <p className="text-[11px] uppercase text-zinc-500 mb-1.5">Resmi</p>
                <div className="grid grid-cols-2 gap-1.5">{SAMPUL_RESMI.map(kartu)}</div>
              </section>
            </>
          )}
          {tab === 'warna' && (
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(SAMPUL_WARNA).map(([k, w]) => (
                <button key={k} type="button" onClick={() => onPilih({ sampul: k, sampul_y: null })} className={`h-14 border-2 ${nilai === k ? 'border-lime-400' : 'border-white/20 hover:border-white/60'} ${w.kelas ?? ''} flex items-end p-1`} style={w.gaya}>
                  <span className="text-[10px] font-bold text-white bg-black/50 px-1">{w.label}</span>
                </button>
              ))}
            </div>
          )}
          {tab === 'unggah' && (
            <div className="space-y-2">
              <button type="button" onClick={() => berkas.current?.click()} disabled={mengunggah} className="btn-retro bg-lime-600 w-full justify-center">
                {mengunggah ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {mengunggah ? 'Mengunggah…' : 'Pilih foto'}
              </button>
              <p className="text-[11px] text-zinc-500">Gambar lebar paling bagus (lebar ≥ 1500 px). Foto diperkecil otomatis.</p>
            </div>
          )}
        </div>
        <input ref={berkas} type="file" accept="image/*" className="hidden" onChange={(e) => { void unggah(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    </>
  );
};

/** Pita sampul di kepala halaman. */
export const SampulMemo: React.FC<{
  memoId: string; nilai: string; y: unknown; boleh: boolean;
  onUbah: (p: PatchSampul) => void; notify: (m: string) => void;
}> = ({ memoId, nilai, y, boleh, onUbah, notify }) => {
  const s = bacaSampul(nilai);
  const foto = useFotoProfil(s.jenis === 'unggahan' ? s.kunci : null);
  const [pemilih, setPemilih] = useState(false);
  const [geser, setGeser] = useState<number | null>(null);
  const kotak = useRef<HTMLDivElement>(null);
  const posisi = geser ?? posisiSampul(y, s);

  // Saat "Ubah posisi": seret gambar naik/turun (tetikus atau jari).
  const mulaiSeret = (e: React.PointerEvent) => {
    if (geser === null || !kotak.current) return;
    e.preventDefault();
    const awalY = e.clientY;
    const awal = geser;
    const tinggi = kotak.current.clientHeight || 1;
    const gerak = (ev: PointerEvent) => setGeser(Math.min(100, Math.max(0, awal - ((ev.clientY - awalY) / tinggi) * 100)));
    const lepas = () => { window.removeEventListener('pointermove', gerak); window.removeEventListener('pointerup', lepas); };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
  };
  useEffect(() => { setGeser(null); }, [nilai]);

  if (s.jenis === 'tidak-ada') return null;
  const src = s.jenis === 'gambar' ? s.gambar.src : s.jenis === 'unggahan' ? foto : null;
  const utuh = s.jenis === 'gambar' && s.gambar.muat === 'utuh';
  const w = s.jenis === 'warna' ? SAMPUL_WARNA[s.kode] : null;

  return (
    <div
      ref={kotak}
      className={`group relative w-full h-[120px] sm:h-[180px] lg:h-[210px] select-none ${utuh ? 'bg-white' : 'bg-zinc-800'} ${w?.kelas ?? ''} ${geser !== null ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
      style={w?.gaya}
      onPointerDown={mulaiSeret}
    >
      {src && (
        <img
          src={src}
          alt=""
          className={`w-full h-full pointer-events-none ${utuh ? 'object-contain' : 'object-cover'}`}
          style={{ objectPosition: `center ${posisi}%` }}
          draggable={false}
        />
      )}
      {s.jenis === 'unggahan' && !foto && <Loader2 size={16} className="absolute inset-0 m-auto animate-spin text-zinc-400" />}
      {geser !== null && (
        <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center pointer-events-none">
          <span className="px-2 py-1 bg-black/70 text-white text-[12px] font-bold">Seret gambar untuk mengatur posisi</span>
        </span>
      )}

      {boleh && (
        <div className={`absolute right-3 top-3 flex border-2 border-black/60 bg-zinc-900/90 text-[12px] font-bold text-zinc-200 ${geser !== null || pemilih ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'} transition-opacity`}>
          {geser === null ? (
            <>
              <button type="button" onClick={() => setPemilih(true)} className="px-2.5 py-1 hover:bg-white/10">Ubah</button>
              {!utuh && !w && <button type="button" onClick={() => setGeser(posisi)} className="px-2.5 py-1 hover:bg-white/10 border-l-2 border-black/60">Ubah posisi</button>}
            </>
          ) : (
            <>
              <button type="button" onClick={() => { onUbah({ sampul_y: Math.round(geser) }); setGeser(null); }} className="px-2.5 py-1 bg-lime-700 hover:bg-lime-600 text-white">Simpan posisi</button>
              <button type="button" onClick={() => setGeser(null)} className="px-2.5 py-1 hover:bg-white/10 border-l-2 border-black/60">Batal</button>
            </>
          )}
        </div>
      )}
      {pemilih && (
        <PemilihSampul
          memoId={memoId}
          nilai={nilai}
          notify={notify}
          className="right-3 top-12"
          onTutup={() => setPemilih(false)}
          onPilih={(p) => { setPemilih(false); onUbah(p); }}
        />
      )}
    </div>
  );
};
