import React, { useEffect, useState } from 'react';
import { HeartOff, HeartPulse, Loader2, LogOut, RefreshCcw, Send } from 'lucide-react';
import { ALASAN_HATI, ajukanHati, hidupkanHati, kalimatMaaf, periksaHati, type HatiMati, type StatusHati } from '../lib/hati';
import type { Pengguna } from '../lib/tipe-api';

/**
 * Layar kunci "hati mati": pemilik akun melewatkan ≥ 1 hari kerja tanpa membuka
 * aplikasi. Ia tetap login, tetapi semua menu tertutup sampai memilih alasan,
 * mengirim permohonan ke grup WhatsApp, dan Admin/Supervisor menghidupkannya.
 */

interface Props {
  hati: HatiMati;
  pengguna: Pengguna;
  onBerubah: (s: StatusHati) => void;
  onKeluar: () => void;
}

const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tgl = (t: string) => { const [, b, h] = t.split('-').map(Number); return `${h} ${NAMA_BULAN[b - 1]}`; };
const JEDA_ULANG_MS = 10 * 60_000;

export const LayarHatiMati: React.FC<Props> = ({ hati, pengguna, onBerubah, onKeluar }) => {
  const [alasan, setAlasan] = useState(hati.alasan ?? '');
  const [keterangan, setKeterangan] = useState(hati.keterangan ?? '');
  const [sibuk, setSibuk] = useState<'kirim' | 'cek' | 'hidupkan' | null>(null);
  const [info, setInfo] = useState('');
  const [galat, setGalat] = useState('');
  const [kini, setKini] = useState(Date.now());

  const sudahDiajukan = Boolean(hati.diajukanPada);
  const sisaUlang = hati.diajukanPada ? Math.max(0, JEDA_ULANG_MS - (kini - Date.parse(hati.diajukanPada))) : 0;
  const isiLengkap = Boolean(alasan) && (alasan !== 'lain' || keterangan.trim().length > 0);

  // Setelah permohonan dikirim: periksa berkala, layar terbuka sendiri begitu dihidupkan.
  useEffect(() => {
    if (!sudahDiajukan) return;
    const t = setInterval(() => {
      setKini(Date.now());
      periksaHati().then(onBerubah).catch(() => undefined);
    }, 20_000);
    return () => clearInterval(t);
  }, [sudahDiajukan, onBerubah]);

  const kirim = async () => {
    setGalat(''); setInfo(''); setSibuk('kirim');
    try {
      const d = await ajukanHati(alasan, keterangan);
      setInfo(d.pesan);
      setKini(Date.now());
      onBerubah(d.status);
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Permohonan gagal dikirim.'); }
    finally { setSibuk(null); }
  };
  const cek = async () => {
    setGalat(''); setSibuk('cek');
    try {
      const s = await periksaHati();
      onBerubah(s);
      if (s.status === 'mati') setInfo('Belum dihidupkan. Hubungi Admin/Supervisor bila perlu.');
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Server tidak terjangkau.'); }
    finally { setSibuk(null); }
  };
  // Admin boleh menghidupkan hatinya sendiri setelah mengirim permohonan (supaya tidak buntu).
  const hidupkanSendiri = async () => {
    setGalat(''); setSibuk('hidupkan');
    try { await hidupkanHati({ id: hati.id }); onBerubah(await periksaHati()); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menghidupkan.'); }
    finally { setSibuk(null); }
  };

  return (
    <div className="h-screen w-full bg-zinc-950 overflow-auto custom-scrollbar flex items-start md:items-center justify-center p-3">
      <div className="retro-box !bg-zinc-900 border-red-500 w-full max-w-lg space-y-3" role="alertdialog" aria-label="Hati mati">
        <div className="flex items-center gap-3 border-b-2 border-white/15 pb-3">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => <HeartOff key={i} size={22} className="text-zinc-600" />)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-title text-[13px] text-red-400">HATI MATI</h1>
            <p className="text-[12px] text-zinc-400 truncate">{pengguna.nama}</p>
          </div>
          <button type="button" onClick={onKeluar} className="btn-retro btn-retro-sm bg-zinc-800" title="Keluar dari akun"><LogOut size={12} /> Keluar</button>
        </div>

        <p className="text-[14px] text-zinc-100 leading-relaxed">
          Anda tidak membuka POKEMONKEY selama <b className="text-red-300">{hati.hariAbsen} hari kerja</b>
          {hati.tanggalAbsen.length > 0 && <> ({hati.tanggalAbsen.map(tgl).join(', ')})</>}. Hari libur, cuti, dan izin di roster tidak dihitung.
        </p>
        <p className="text-[12px] text-zinc-400 leading-relaxed">
          Semua menu terkunci sampai hati dihidupkan kembali. Pilih alasannya, kirim permohonan ke grup WhatsApp tim, lalu Admin atau Supervisor menghidupkannya lewat tautan di pesan itu.
        </p>

        <fieldset className="space-y-1.5" disabled={sibuk !== null}>
          <legend className="label-retro text-amber-300">Kenapa tidak membuka aplikasi?</legend>
          {ALASAN_HATI.map((a) => (
            <label key={a.id} className={`flex items-center gap-2 px-2 py-1.5 border-2 cursor-pointer text-[13px] ${alasan === a.id ? 'border-amber-400 bg-amber-950/40 text-white' : 'border-white/15 text-zinc-300 hover:border-white/40'}`}>
              <input type="radio" name="alasan-hati" value={a.id} checked={alasan === a.id} onChange={() => setAlasan(a.id)} className="accent-amber-500" />
              {a.label}
            </label>
          ))}
          <textarea
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value.slice(0, 200))}
            placeholder={alasan === 'lain' ? 'Tuliskan alasannya (wajib)…' : 'Keterangan tambahan (opsional)…'}
            className="input-retro h-16 resize-none !text-[13px]"
            aria-label="Keterangan"
          />
        </fieldset>

        {alasan && (
          <div className="border-l-4 border-emerald-500 bg-emerald-950/30 px-3 py-2">
            <p className="text-[10px] text-emerald-300 uppercase font-bold mb-1">Pesan yang dikirim ke grup</p>
            <p className="text-[13px] text-white leading-relaxed">“{kalimatMaaf(hati.hariAbsen, alasan, keterangan)}”</p>
          </div>
        )}

        {info && <p className="text-[12px] text-emerald-300" role="status">{info}</p>}
        {galat && <p className="text-[12px] text-red-300" role="alert">{galat}</p>}

        {sudahDiajukan ? (
          <div className="space-y-2">
            <p className="text-[13px] text-amber-200 flex items-center gap-2"><HeartPulse size={15} className="animate-pulse" /> Permohonan sudah dikirim. Menunggu Admin/Supervisor menghidupkan…</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={cek} disabled={sibuk !== null} className="btn-retro bg-zinc-700 justify-center disabled:opacity-50">
                {sibuk === 'cek' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />} Periksa sekarang
              </button>
              <button type="button" onClick={kirim} disabled={sibuk !== null || sisaUlang > 0 || !isiLengkap} className="btn-retro bg-emerald-800 justify-center disabled:opacity-50" title={sisaUlang > 0 ? 'Kirim ulang bisa dilakukan setelah 10 menit' : 'Kirim ulang ke grup'}>
                {sibuk === 'kirim' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {sisaUlang > 0 ? `Kirim ulang (${Math.ceil(sisaUlang / 60_000)} mnt)` : 'Kirim ulang'}
              </button>
            </div>
            {pengguna.peran === 'admin' && (
              <button type="button" onClick={hidupkanSendiri} disabled={sibuk !== null} className="btn-retro bg-red-800 w-full justify-center disabled:opacity-50">
                {sibuk === 'hidupkan' ? <Loader2 size={14} className="animate-spin" /> : <HeartPulse size={14} />} Hidupkan sendiri (khusus Admin)
              </button>
            )}
          </div>
        ) : (
          <button type="button" onClick={kirim} disabled={sibuk !== null || !isiLengkap} className={`btn-retro w-full !py-3 justify-center ${isiLengkap ? 'bg-emerald-700' : 'bg-zinc-800'} disabled:opacity-60`}>
            {sibuk === 'kirim' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Kirim permohonan ke grup WhatsApp
          </button>
        )}
      </div>
    </div>
  );
};
