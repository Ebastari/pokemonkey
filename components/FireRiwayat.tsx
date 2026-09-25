import React, { useEffect, useState } from 'react';
import { Download, Eye, Loader2, Send, Trash2, CheckCircle2, Trees, Mountain } from 'lucide-react';
import { PemilihBulan } from './FireHarian';
import {
  muatArsip, hapusArsip, ambilPdfArsip, tandaiTerkirim, kirimKeWhatsApp, pesanPengantar, namaPdf, kelompokLaporan, hariWita,
  type ArsipKarhutla,
} from '../lib/karhutla';
import { simpanBerkas } from '../lib/unduh';
import type { Pengguna } from '../lib/tipe-api';

/**
 * Tab RIWAYAT FIRE: hanya laporan yang sudah diekspor ke arsip server (PDF di R2).
 * Draf tidak tampil di sini — draf ada di tab Harian.
 */

interface Props {
  pengguna: Pengguna;
  notify: (pesan: string) => void;
  onBuka: (a: ArsipKarhutla) => void;
  /** Naik setiap ada ekspor/kirim baru, supaya daftar dimuat ulang. */
  versi: number;
}

const tglJam = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const tglPendek = (hari: string) => new Date(`${hari}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const FireRiwayat: React.FC<Props> = ({ pengguna, notify, onBuka, versi }) => {
  const [bulan, setBulan] = useState(() => hariWita(new Date().toISOString()).slice(0, 7));
  const [daftar, setDaftar] = useState<ArsipKarhutla[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [sibuk, setSibuk] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    setMemuat(true);
    muatArsip(bulan)
      .then((d) => { if (hidup) setDaftar(d); })
      .catch((e) => notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT RIWAYAT'))
      .finally(() => { if (hidup) setMemuat(false); });
    return () => { hidup = false; };
  }, [bulan, versi, notify]);

  const ganti = (a: ArsipKarhutla) => setDaftar((d) => d.map((x) => (x.id === a.id ? a : x)));

  const unduh = async (a: ArsipKarhutla) => {
    setSibuk(a.id);
    try {
      const hasil = await simpanBerkas(await ambilPdfArsip(a), namaPdf(a), a.judul);
      notify(hasil === 'diunduh' ? 'PDF DIUNDUH' : 'PDF SIAP DIBAGIKAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGAMBIL PDF'); } finally { setSibuk(null); }
  };

  const kirim = async (a: ArsipKarhutla) => {
    setSibuk(a.id);
    try {
      await kirimKeWhatsApp(await ambilPdfArsip(a), namaPdf(a), pesanPengantar(a));
      const b = await tandaiTerkirim(a.id);
      if (b) ganti(b);
      notify('DITANDAI TERKIRIM KE WHATSAPP');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGIRIM'); } finally { setSibuk(null); }
  };

  const hapus = async (a: ArsipKarhutla) => {
    if (!confirm(`Hapus arsip "${a.judul}" beserta PDF-nya?`)) return;
    setSibuk(a.id);
    try {
      await hapusArsip(a.id);
      setDaftar((d) => d.filter((x) => x.id !== a.id));
      notify('ARSIP LAPORAN DIHAPUS');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGHAPUS'); } finally { setSibuk(null); }
  };

  const bolehHapus = (a: ArsipKarhutla) => a.dibuat_oleh === pengguna.id || pengguna.peran === 'admin' || pengguna.peran === 'supervisor';
  const terkirim = daftar.filter((a) => a.dikirim_pada).length;
  const titik = daftar.reduce((n, a) => n + a.jumlah_titik, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PemilihBulan bulan={bulan} onGanti={setBulan} bulanMaks={hariWita(new Date().toISOString()).slice(0, 7)} />
        <div className="text-[11px] text-zinc-300 font-mono">
          <b className="text-white">{daftar.length}</b> laporan · <b className="text-red-300">{titik}</b> titik dilaporkan ·{' '}
          <b className="text-emerald-300">{terkirim}</b> terkirim
        </div>
      </div>

      <div className="grid gap-2">
        {memuat && <div className="p-6 text-center text-zinc-400"><Loader2 size={18} className="animate-spin inline mr-2" />Memuat arsip…</div>}
        {!memuat && !daftar.length && (
          <div className="p-6 text-center text-zinc-400 border-2 border-dashed border-white/20">
            Belum ada laporan yang diekspor di bulan ini. Buat laporan dari tab <b className="text-white">Harian</b>.
          </div>
        )}
        {!memuat && daftar.map((a) => {
          const das = kelompokLaporan(a.jenis_izin) === 'das';
          return (
            <div key={a.id} className="border-2 border-white/20 bg-black/60 p-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="w-16 text-center shrink-0">
                <div className="font-title text-[10px] text-yellow-400">{tglPendek(a.hari_titik)}</div>
                {das ? <Trees size={16} className="mx-auto mt-1 text-amber-300" /> : <Mountain size={16} className="mx-auto mt-1 text-emerald-300" />}
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="font-bold text-white text-[13px]">{a.area || a.jenis_izin} · {a.jumlah_titik} titik</div>
                <div className="text-[11px] text-cyan-300 font-mono">{a.nomor}</div>
                <div className="text-[11px] text-zinc-400">
                  Diekspor {tglJam(a.diekspor_pada)}{a.dibuat_nama ? ` oleh ${a.dibuat_nama}` : ''}
                </div>
              </div>
              <span className={`chip-retro !text-[10px] font-bold flex items-center gap-1 ${a.dikirim_pada ? 'border-emerald-400 bg-emerald-950 text-emerald-300' : 'border-cyan-400 bg-cyan-950 text-cyan-300'}`}>
                {a.dikirim_pada ? <><CheckCircle2 size={11} /> Terkirim {tglJam(a.dikirim_pada)}{a.jumlah_kirim > 1 ? ` (${a.jumlah_kirim}×)` : ''}</> : 'Diekspor, belum dikirim'}
              </span>
              <div className="flex items-center gap-1.5">
                {sibuk === a.id ? <Loader2 size={16} className="animate-spin text-zinc-300" /> : (
                  <>
                    <button type="button" onClick={() => kirim(a)} className="btn-retro btn-retro-sm bg-emerald-700"><Send size={12} /> WhatsApp</button>
                    <button type="button" onClick={() => unduh(a)} className="btn-retro btn-retro-sm bg-zinc-800"><Download size={12} /> PDF</button>
                    <button type="button" onClick={() => onBuka(a)} className="btn-retro btn-retro-sm bg-orange-700"><Eye size={12} /> Buka</button>
                    {bolehHapus(a) && (
                      <button type="button" onClick={() => hapus(a)} className="btn-ikon !w-7 !h-7 bg-rose-950 text-rose-300" aria-label="Hapus arsip"><Trash2 size={12} /></button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
