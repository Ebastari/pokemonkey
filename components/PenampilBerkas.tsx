import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Loader2, FileText, ZoomIn, ZoomOut, Lock } from 'lucide-react';
import { ambilBerkas } from '../lib/api';
import { simpanBerkas } from '../lib/unduh';
import { bacaCsv, bacaDocx, bacaPptx, bacaXlsx, bukaPdf, jenisDari, type BlokDok, type DokumenPdf } from '../lib/pratinjau-dok';

/**
 * Penampil berkas layar penuh di dalam aplikasi — dokumen bisa dibaca tanpa
 * diunduh dulu. Dipakai blok berkas di memo, Folder Dokumen, dan Kotak Surat.
 * `bolehUnduh = false` (memo rahasia): tombol unduh disembunyikan.
 */

const TabelPratinjau: React.FC<{ baris: string[][] }> = ({ baris }) => (
  <div className="overflow-auto custom-scrollbar border-2 border-zinc-300 bg-white">
    <table className="border-collapse text-[12px] text-zinc-900">
      <tbody>
        {baris.map((r, i) => (
          <tr key={i} className={i === 0 ? 'bg-zinc-100 font-bold' : ''}>
            <td className="border border-zinc-300 px-1.5 py-0.5 text-zinc-400 text-right tabular-nums select-none">{i + 1}</td>
            {r.map((c, j) => <td key={j} className="border border-zinc-300 px-2 py-0.5 whitespace-nowrap max-w-[320px] overflow-hidden text-ellipsis">{c}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const HalamanPdf: React.FC<{ doc: DokumenPdf; no: number; lebar: number }> = ({ doc, no, lebar }) => {
  const wadah = useRef<HTMLDivElement>(null);
  const [siap, setSiap] = useState(false);
  useEffect(() => {
    let hidup = true;
    const el = wadah.current;
    if (!el) return;
    // Halaman digambar saat mendekati layar, supaya PDF tebal tetap ringan.
    const amati = new IntersectionObserver((e) => {
      if (!e[0].isIntersecting) return;
      amati.disconnect();
      doc.gambar(no, lebar).then((k) => { if (hidup && el) { el.innerHTML = ''; el.appendChild(k); setSiap(true); } }).catch(() => undefined);
    }, { rootMargin: '600px' });
    amati.observe(el);
    return () => { hidup = false; amati.disconnect(); };
  }, [doc, no, lebar]);
  return (
    <div className="relative bg-white shadow-[0_2px_10px_rgba(0,0,0,0.5)] mx-auto" style={{ width: lebar, minHeight: siap ? undefined : lebar * 1.41 }}>
      <div ref={wadah} />
      {!siap && <span className="absolute inset-0 flex items-center justify-center text-zinc-400 text-[12px]"><Loader2 size={14} className="animate-spin mr-1" /> Halaman {no}</span>}
    </div>
  );
};

export const PenampilBerkas: React.FC<{
  berkas: { nama: string; kunci: string; tipe?: string | null };
  bolehUnduh?: boolean;
  onTutup: () => void;
}> = ({ berkas, bolehUnduh = true, onTutup }) => {
  const jenis = jenisDari(berkas.nama, berkas.tipe);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [pdf, setPdf] = useState<DokumenPdf | null>(null);
  const [docx, setDocx] = useState<BlokDok[] | null>(null);
  const [pptx, setPptx] = useState<{ no: number; judul: string; teks: string[] }[] | null>(null);
  const [lembar, setLembar] = useState<{ nama: string; baris: string[][] }[] | null>(null);
  const [lembarAktif, setLembarAktif] = useState(0);
  const [teks, setTeks] = useState<string | null>(null);
  const [urlGambar, setUrlGambar] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [lebarLayar, setLebarLayar] = useState(() => Math.min(860, window.innerWidth - 32));

  useEffect(() => {
    const ubah = () => setLebarLayar(Math.min(860, window.innerWidth - 32));
    window.addEventListener('resize', ubah);
    return () => window.removeEventListener('resize', ubah);
  }, []);
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [onTutup]);

  useEffect(() => {
    let hidup = true;
    let url: string | null = null;
    (async () => {
      try {
        const b = await ambilBerkas(berkas.kunci);
        if (!hidup) return;
        setBlob(b);
        if (jenis === 'pdf') setPdf(await bukaPdf(b));
        else if (jenis === 'docx') setDocx(await bacaDocx(b));
        else if (jenis === 'pptx') setPptx(await bacaPptx(b));
        else if (jenis === 'xlsx') setLembar(await bacaXlsx(b));
        else if (jenis === 'csv') setLembar([{ nama: berkas.nama, baris: bacaCsv(await b.text()) }]);
        else if (jenis === 'teks') setTeks((await b.text()).slice(0, 200_000));
        else if (jenis === 'gambar') { url = URL.createObjectURL(b); setUrlGambar(url); }
      } catch (e) {
        if (hidup) setGalat(e instanceof Error ? e.message : 'Berkas tidak dapat dibuka.');
      }
    })();
    return () => { hidup = false; if (url) URL.revokeObjectURL(url); };
  }, [berkas.kunci, berkas.nama, jenis]);

  const unduh = async () => { if (blob) await simpanBerkas(blob, berkas.nama).catch(() => undefined); };
  const memuat = !galat && !pdf && !docx && !pptx && !lembar && teks === null && !urlGambar && jenis !== 'lain';
  const lebarPdf = Math.round(lebarLayar * zoom);

  return (
    <div className="fixed inset-0 z-[140] bg-zinc-800/95 flex flex-col" role="dialog" aria-label={`Pratinjau ${berkas.nama}`}>
      <div className="h-12 shrink-0 flex items-center gap-2 px-2 sm:px-4 bg-zinc-950 border-b-2 border-white/15">
        <FileText size={16} className="text-lime-300 shrink-0" />
        <span className="text-[13px] font-bold text-white truncate flex-1" title={berkas.nama}>{berkas.nama}</span>
        {pdf && <span className="text-[11px] text-zinc-400 whitespace-nowrap">{pdf.halaman} hlm</span>}
        {(pdf || urlGambar) && (
          <>
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Perkecil"><ZoomOut size={15} /></button>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Perbesar"><ZoomIn size={15} /></button>
          </>
        )}
        {bolehUnduh ? (
          <button onClick={unduh} disabled={!blob} className="btn-ikon !w-8 !h-8 bg-emerald-700" title="Simpan / bagikan" aria-label="Unduh"><Download size={15} /></button>
        ) : (
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-amber-300 whitespace-nowrap"><Lock size={11} /> Rahasia · hanya lihat</span>
        )}
        <button onClick={onTutup} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-3 sm:p-6">
        {memuat && <p className="text-[13px] text-zinc-300 flex items-center gap-2 py-16 justify-center"><Loader2 size={16} className="animate-spin" /> Membuka dokumen…</p>}
        {galat && <p className="text-[13px] text-red-300 py-16 text-center">{galat}</p>}

        {pdf && (
          <div className="flex flex-col gap-4 items-center">
            {Array.from({ length: pdf.halaman }, (_, i) => <HalamanPdf key={`${i}-${lebarPdf}`} doc={pdf} no={i + 1} lebar={lebarPdf} />)}
          </div>
        )}

        {urlGambar && <img src={urlGambar} alt={berkas.nama} className="mx-auto block" style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? '100%' : undefined }} />}

        {docx && (
          <div className="mx-auto bg-white text-zinc-900 shadow-[0_2px_10px_rgba(0,0,0,0.5)] px-6 sm:px-14 py-10" style={{ maxWidth: 820, fontFamily: 'Calibri, Arial, sans-serif' }}>
            {docx.length === 0 && <p className="text-zinc-500">Dokumen kosong.</p>}
            {docx.map((b, i) => b.t === 'tabel' ? (
              <div key={i} className="my-3"><TabelPratinjau baris={b.baris} /></div>
            ) : (
              <p key={i} className={b.gaya === 'judul1' ? 'text-[22px] font-bold mt-4 mb-2' : b.gaya === 'judul2' ? 'text-[18px] font-bold mt-3 mb-1.5' : b.gaya === 'judul3' ? 'text-[15px] font-bold mt-2 mb-1' : b.gaya === 'daftar' ? 'text-[14px] pl-5 relative before:content-["•"] before:absolute before:left-1.5 my-0.5' : 'text-[14px] my-1.5 leading-relaxed min-h-[1em] whitespace-pre-wrap'}>
                {b.runs.map((r, j) => <span key={j} className={`${r.b ? 'font-bold' : ''} ${r.i ? 'italic' : ''} ${r.u ? 'underline' : ''}`}>{r.v}</span>)}
              </p>
            ))}
          </div>
        )}

        {pptx && (
          <div className="mx-auto flex flex-col gap-4" style={{ maxWidth: 820 }}>
            <p className="text-[12px] text-zinc-300">Pratinjau teks per slide (tata letak dan gambar slide tampil saat dibuka di PowerPoint).</p>
            {pptx.map((s) => (
              <div key={s.no} className="bg-white text-zinc-900 border-2 border-zinc-900 shadow-[4px_4px_0_#000] aspect-video p-5 sm:p-8 overflow-hidden relative">
                <span className="absolute top-2 right-3 text-[11px] text-zinc-400">{s.no}</span>
                <h3 className="text-[18px] sm:text-[24px] font-bold mb-3 leading-tight">{s.judul || `Slide ${s.no}`}</h3>
                <ul className="space-y-1 text-[13px] sm:text-[15px] list-disc pl-5">{s.teks.slice(0, 14).map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
        )}

        {lembar && (
          <div className="mx-auto" style={{ maxWidth: 1100 }}>
            {lembar.length > 1 && (
              <div className="flex gap-1 mb-2 flex-wrap">
                {lembar.map((l, i) => <button key={l.nama + i} onClick={() => setLembarAktif(i)} className={`btn-retro btn-retro-sm ${i === lembarAktif ? 'bg-emerald-600' : 'bg-zinc-700'}`}>{l.nama}</button>)}
              </div>
            )}
            <TabelPratinjau baris={lembar[lembarAktif]?.baris ?? []} />
            {(lembar[lembarAktif]?.baris.length ?? 0) >= 300 && <p className="text-[11px] text-zinc-300 mt-1">Menampilkan 300 baris pertama.</p>}
          </div>
        )}

        {teks !== null && <pre className="mx-auto bg-white text-zinc-900 p-4 text-[13px] whitespace-pre-wrap break-words" style={{ maxWidth: 900 }}>{teks}</pre>}

        {jenis === 'lain' && !galat && (
          <div className="text-center py-16 text-zinc-200">
            <FileText size={48} className="mx-auto mb-3 opacity-60" />
            <p className="text-[14px]">Jenis berkas ini belum bisa dipratinjau di aplikasi.</p>
            {bolehUnduh && <button onClick={unduh} disabled={!blob} className="btn-retro bg-emerald-700 mt-4 inline-flex items-center gap-2"><Download size={14} /> Simpan / bagikan</button>}
          </div>
        )}
      </div>
    </div>
  );
};
