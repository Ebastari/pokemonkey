import React, { useEffect, useState } from 'react';
import { Download, RefreshCcw, Smartphone, X } from 'lucide-react';
import { ambilVersiTerbaru, perluPerbarui, ukuranMb, VERSI_APP, type VersiTerbaru } from '../lib/versi';
import { diAplikasi } from '../lib/platform';

/**
 * Pembaruan aplikasi:
 * - <KotakUnduhApk/>       di layar login: tautan unduh APK terbaru (web), atau
 *                          ajakan memperbarui bila APK yang terpasang sudah lama.
 * - <PeringatanPembaruan/> setelah masuk: peringatan bila versi yang berjalan
 *                          lebih lama dari versi terbaru di server — APK diminta
 *                          mengunduh, web diminta memuat ulang.
 * Tautan unduh dibuka di browser HP (target _blank), yang lalu mengunduh berkas APK.
 */

function useVersiTerbaru(ulangMenit = 0): VersiTerbaru | null {
  const [v, setV] = useState<VersiTerbaru | null>(null);
  useEffect(() => {
    let batal = false;
    const muat = () => ambilVersiTerbaru().then((d) => { if (!batal && d) setV(d); });
    muat();
    if (!ulangMenit) return () => { batal = true; };
    const t = setInterval(muat, ulangMenit * 60_000);
    const tampak = () => { if (document.visibilityState === 'visible') muat(); };
    document.addEventListener('visibilitychange', tampak);
    return () => { batal = true; clearInterval(t); document.removeEventListener('visibilitychange', tampak); };
  }, [ulangMenit]);
  return v;
}

const CARA_PASANG = 'Pasang langsung di atas versi lama — jangan di-uninstall, supaya data di HP tidak hilang.';

export const KotakUnduhApk: React.FC = () => {
  const v = useVersiTerbaru();
  const apk = diAplikasi();
  if (!v) return apk ? <p className="text-[11px] text-zinc-500 text-center">Versi {VERSI_APP}</p> : null;

  if (apk && !perluPerbarui(v)) {
    return <p className="text-[11px] text-zinc-500 text-center">Versi {VERSI_APP} · sudah terbaru</p>;
  }
  const lama = apk && perluPerbarui(v);
  return (
    <div className={`panel-retro !p-2.5 space-y-1.5 text-left ${lama ? 'border-orange-400 bg-orange-950/40' : 'border-cyan-500/70 bg-cyan-950/30'}`}>
      <p className={`text-[12px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${lama ? 'text-orange-300' : 'text-cyan-300'}`}>
        <Smartphone size={13} /> {lama ? `Versi baru ${v.versi} tersedia` : 'Aplikasi Android'}
      </p>
      <p className="text-[11px] text-zinc-300 leading-snug">
        {lama ? `Yang terpasang di HP ini versi ${VERSI_APP}. ` : 'Pasang POKEMONKEY di HP Android. '}{CARA_PASANG}
      </p>
      <a href={v.url} target="_blank" rel="noreferrer" className={`btn-retro btn-retro-sm w-full justify-center ${lama ? 'bg-orange-600 hover:bg-orange-500' : 'bg-cyan-700 hover:bg-cyan-600'}`}>
        <Download size={13} /> Unduh APK v{v.versi}{v.ukuran ? ` · ${ukuranMb(v.ukuran)}` : ''}
      </a>
    </div>
  );
};

export const PeringatanPembaruan: React.FC = () => {
  // Diperiksa ulang berkala: aplikasi yang dibiarkan terbuka tetap tahu ada rilis baru.
  const v = useVersiTerbaru(30);
  const [ditunda, setDitunda] = useState<number | null>(null);
  if (!perluPerbarui(v)) return null;
  const apk = diAplikasi();

  // "Nanti": peringatan mengecil jadi tombol kecil, muncul lagi penuh saat aplikasi dibuka berikutnya.
  if (ditunda === v.kode) {
    return (
      <button type="button" onClick={() => setDitunda(null)}
        className="fixed top-1 left-1/2 -translate-x-1/2 z-[90] chip-retro !text-[11px] border-orange-400 bg-orange-600 text-white shadow-[2px_2px_0_#000] flex items-center gap-1"
        title="Versi baru tersedia">
        <Download size={11} /> Perbarui ke v{v.versi}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[115] bg-black/85 flex items-center justify-center p-4">
      <div className="retro-box !bg-zinc-900 border-orange-400 w-full max-w-md space-y-3" role="alertdialog" aria-modal="true" aria-label="Pembaruan aplikasi">
        <div className="flex items-center gap-2 border-b-2 border-white/15 pb-2">
          <Download size={18} className="text-orange-300" />
          <h3 className="font-title text-[12px] text-orange-300 flex-1">{apk ? 'APLIKASI PERLU DIPERBARUI' : 'VERSI BARU TERSEDIA'}</h3>
          <button type="button" onClick={() => setDitunda(v.kode)} className="text-zinc-400 hover:text-white" aria-label="Nanti"><X size={20} /></button>
        </div>
        <p className="text-[14px] text-zinc-100 leading-relaxed">
          Versi terbaru <b className="text-orange-300">v{v.versi}</b>{v.tanggal ? ` (${v.tanggal})` : ''}, sedangkan yang {apk ? 'terpasang di HP ini' : 'sedang terbuka'} <b>v{VERSI_APP}</b>.
        </p>
        {v.catatan && (
          <div className="border-l-4 border-orange-400 bg-orange-950/30 px-3 py-2">
            <p className="text-[10px] text-orange-300 uppercase font-bold mb-1">Yang baru</p>
            <p className="text-[13px] text-zinc-100 leading-relaxed whitespace-pre-wrap">{v.catatan}</p>
          </div>
        )}
        {apk ? (
          <>
            <ol className="text-[12px] text-zinc-300 leading-relaxed list-decimal pl-5 space-y-0.5">
              <li>Tekan <b className="text-white">Unduh APK</b>; berkas diunduh lewat browser HP.</li>
              <li>Buka berkas yang terunduh, lalu pilih <b className="text-white">Perbarui / Pasang</b>.</li>
              <li>{CARA_PASANG}</li>
            </ol>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setDitunda(v.kode)} className="btn-retro bg-zinc-800">Nanti</button>
              <a href={v.url} target="_blank" rel="noreferrer" className="btn-retro bg-orange-600 hover:bg-orange-500">
                <Download size={14} /> Unduh APK v{v.versi}{v.ukuran ? ` · ${ukuranMb(v.ukuran)}` : ''}
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="text-[12px] text-zinc-300 leading-relaxed">Muat ulang halaman untuk memakai versi terbaru. Yang sedang Anda kerjakan dan belum tersimpan sebaiknya disimpan dulu.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setDitunda(v.kode)} className="btn-retro bg-zinc-800">Nanti</button>
              <button type="button" onClick={() => window.location.reload()} className="btn-retro bg-orange-600 hover:bg-orange-500"><RefreshCcw size={14} /> Muat ulang sekarang</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
