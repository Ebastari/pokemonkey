import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Loader2, Send, Share2, X } from 'lucide-react';
import { api, demoAktif } from '../lib/api';
import { bukaWaManual } from '../lib/wa-manual';

/**
 * Tombol "Bagikan" memo — seperti "Share to web" di Notion: satu tautan
 * hanya-baca yang bisa dibuka siapa pun tanpa login (mis. dikirim ke grup WA),
 * selalu menampilkan isi terbaru, dan bisa dimatikan kapan saja.
 * Server: server/src/lihat-memo.ts.
 */

interface StatusBagi { aktif: boolean; url?: string; dibuka?: number; boleh: boolean }

async function salin(teks: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(teks); return true; }
  } catch { /* jatuh ke cara lama */ }
  const t = document.createElement('textarea');
  t.value = teks;
  t.setAttribute('readonly', '');
  t.style.position = 'fixed';
  t.style.opacity = '0';
  document.body.appendChild(t);
  t.select();
  const ok = document.execCommand('copy');
  t.remove();
  return ok;
}

export const BagikanMemo: React.FC<{
  memoId: string; judul: string; pribadi?: boolean; kecil?: boolean; notify: (m: string) => void;
}> = ({ memoId, judul, pribadi = false, kecil = false, notify }) => {
  const [buka, setBuka] = useState(false);
  const [status, setStatus] = useState<StatusBagi | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const demo = demoAktif();

  useEffect(() => {
    if (!buka || demo) return;
    let hidup = true;
    api<StatusBagi>(`/api/memo/${memoId}/bagi`)
      .then((s) => { if (hidup) setStatus(s); })
      .catch((e) => { if (hidup) { setStatus({ aktif: false, boleh: false }); notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT TAUTAN'); } });
    return () => { hidup = false; };
  }, [buka, memoId, demo, notify]);

  const ubah = async (nyala: boolean) => {
    if (nyala && pribadi && !confirm('Catatan pribadi ini akan bisa dibaca siapa pun yang punya tautannya. Lanjutkan?')) return;
    setSibuk(true);
    try {
      const s = await api<StatusBagi>(`/api/memo/${memoId}/bagi`, { method: nyala ? 'POST' : 'DELETE', body: {} });
      setStatus(s);
      if (nyala && s.url) {
        if (await salin(s.url)) { setTersalin(true); notify('TAUTAN DIBUAT & DISALIN'); } else notify('TAUTAN DIBUAT');
      } else if (!nyala) notify('TAUTAN DIMATIKAN — ALAMAT LAMA TIDAK BISA DIBUKA LAGI');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGATUR TAUTAN');
    } finally { setSibuk(false); }
  };

  const salinTautan = async () => {
    if (!status?.url) return;
    if (await salin(status.url)) { setTersalin(true); notify('TAUTAN DISALIN'); setTimeout(() => setTersalin(false), 2000); }
    else notify('GAGAL MENYALIN — TEKAN LAMA TAUTAN UNTUK MENYALIN');
  };

  const kirimWa = async () => {
    if (!status?.url) return;
    await bukaWaManual({ pesan: `*${judul.trim() || 'Memo'}*\nMemo POKEMONKEY (baca saja):\n${status.url}` });
  };

  const aktif = Boolean(status?.aktif && status.url);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => { setBuka((v) => !v); setTersalin(false); }}
        className={kecil ? `btn-ikon !w-8 !h-8 ${aktif ? 'bg-sky-700' : 'bg-zinc-800'}` : `btn-retro btn-retro-sm ${aktif ? 'bg-sky-700' : 'bg-zinc-800'}`}
        title="Bagikan lewat tautan"
        aria-label="Bagikan lewat tautan"
        aria-expanded={buka}
      >
        <Share2 size={kecil ? 14 : 12} />{!kecil && ' Bagikan'}
      </button>

      {buka && (
        <>
          <span className="fixed inset-0 z-[140]" onClick={() => setBuka(false)} aria-hidden="true" />
          <span
            className="fixed inset-x-2 top-14 z-[150] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80 retro-box !bg-zinc-900 border-sky-500 !p-3 flex flex-col gap-2.5 text-left"
            role="dialog"
            aria-label="Bagikan memo"
          >
            <span className="flex items-center gap-2">
              <Globe size={15} className="text-sky-300 shrink-0" />
              <span className="text-[14px] font-bold text-white flex-1">Bagikan ke web</span>
              <button type="button" onClick={() => setBuka(false)} className="text-zinc-400 hover:text-white" aria-label="Tutup"><X size={16} /></button>
            </span>

            {demo ? (
              <span className="text-[12px] text-zinc-300 leading-snug">Mode demo berjalan tanpa server, jadi tautan publik tidak bisa dibuat. Di aplikasi tim, tombol ini membuat tautan baca-saja untuk dikirim ke WhatsApp.</span>
            ) : !status ? (
              <span className="text-[12px] text-zinc-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> memuat…</span>
            ) : (
              <>
                <span className="flex items-start gap-3">
                  <span className="text-[12px] text-zinc-300 leading-snug flex-1">
                    Siapa pun yang punya tautan bisa <b className="text-white">membaca</b> memo ini tanpa login. Mereka tidak bisa mengubahnya, dan isinya selalu yang terbaru.
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={aktif}
                    aria-label="Tautan publik"
                    disabled={sibuk || !status.boleh}
                    onClick={() => ubah(!aktif)}
                    className={`relative w-11 h-6 shrink-0 border-2 border-white transition-colors disabled:opacity-50 ${aktif ? 'bg-sky-600' : 'bg-zinc-700'}`}
                    title={status.boleh ? undefined : 'Hanya penulis memo, Supervisor, atau Admin'}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white transition-all ${aktif ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </span>
                {!status.boleh && !aktif && <span className="text-[11px] text-zinc-500">Hanya penulis memo, Supervisor, atau Admin yang bisa menyalakan tautan.</span>}
                {pribadi && !aktif && status.boleh && <span className="text-[11px] text-amber-300">Ini catatan pribadi: menyalakan tautan membuatnya bisa dibaca orang lain.</span>}

                {aktif && status.url && (
                  <>
                    <span className="flex gap-1.5">
                      <input readOnly value={status.url} onFocus={(e) => e.currentTarget.select()} className="input-retro !py-1 !text-[12px] flex-1 min-w-0" aria-label="Tautan memo" />
                      <button type="button" onClick={salinTautan} className="btn-retro btn-retro-sm bg-sky-700 shrink-0">{tersalin ? <><Check size={12} /> Tersalin</> : <><Copy size={12} /> Salin</>}</button>
                    </span>
                    <span className="grid grid-cols-2 gap-1.5">
                      <button type="button" onClick={kirimWa} className="btn-retro btn-retro-sm bg-emerald-700 justify-center"><Send size={12} /> WhatsApp</button>
                      <button type="button" onClick={() => window.open(status.url, '_blank', 'noopener,noreferrer')} className="btn-retro btn-retro-sm bg-zinc-700 justify-center"><ExternalLink size={12} /> Buka</button>
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Dibuka {status.dibuka ?? 0} kali.{status.boleh ? ' Matikan sakelar untuk menutup tautan ini.' : ''}
                    </span>
                  </>
                )}
                {sibuk && <span className="text-[11px] text-zinc-400 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> menyimpan…</span>}
              </>
            )}
          </span>
        </>
      )}
    </span>
  );
};
