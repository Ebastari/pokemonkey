import React, { useCallback, useEffect, useState } from 'react';
import { HeartOff, HeartPulse, Loader2, X } from 'lucide-react';
import { daftarPermohonanHati, hidupkanHati, type PermohonanHati } from '../lib/hati';

/**
 * Untuk Admin/Supervisor: anggota yang hatinya mati dan tombol menghidupkannya.
 * - <PanelHatiMati/>  : daftar di menu TEAM (kosong = tidak tampil).
 * - <ModalHidupkanHati/> : konfirmasi saat tautan di pesan WhatsApp dibuka (/?hidupkan=<token>).
 */

const NAMA_BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tgl = (t: string) => { const [, b, h] = t.split('-').map(Number); return `${h} ${NAMA_BULAN[b - 1]}`; };

const RincianPermohonan: React.FC<{ p: PermohonanHati }> = ({ p }) => (
  <div className="min-w-0 flex-1">
    <p className="text-[14px] font-bold text-white truncate">{p.nama}</p>
    <p className="text-[12px] text-zinc-400">
      {p.hariAbsen} hari kerja tidak membuka aplikasi{p.tanggalAbsen.length ? ` · ${p.tanggalAbsen.map(tgl).join(', ')}` : ''}
    </p>
    {p.kalimat
      ? <p className="text-[12px] text-zinc-200 mt-1 leading-snug">“{p.kalimat}”{p.keterangan && p.alasan !== 'lain' ? ` — ${p.keterangan}` : ''}</p>
      : <p className="text-[12px] text-amber-300 mt-1">Belum mengirim permohonan.</p>}
  </div>
);

export const PanelHatiMati: React.FC<{ notify: (pesan: string) => void }> = ({ notify }) => {
  const [daftar, setDaftar] = useState<PermohonanHati[]>([]);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const muat = useCallback(() => {
    daftarPermohonanHati().then((d) => setDaftar(d.permohonan)).catch(() => undefined);
  }, []);
  useEffect(() => {
    muat();
    const t = setInterval(muat, 60_000);
    return () => clearInterval(t);
  }, [muat]);

  const hidupkan = async (p: PermohonanHati) => {
    if (!confirm(`Hidupkan kembali hati ${p.nama}?`)) return;
    setSibuk(p.id);
    try {
      await hidupkanHati({ id: p.id });
      notify(`HATI ${p.nama.toUpperCase()} DIHIDUPKAN`);
      muat();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGHIDUPKAN'); }
    finally { setSibuk(null); }
  };

  if (!daftar.length) return null;
  return (
    <div className="retro-box !bg-red-950/40 border-red-500 mb-3 space-y-2">
      <h3 className="text-[13px] font-bold text-red-200 uppercase flex items-center gap-2"><HeartOff size={14} /> Hati mati · {daftar.length} anggota</h3>
      {daftar.map((p) => (
        <div key={p.id} className="flex items-start gap-3 border-t border-white/10 pt-2">
          <RincianPermohonan p={p} />
          <button type="button" onClick={() => hidupkan(p)} disabled={sibuk !== null} className="btn-retro btn-retro-sm bg-red-700 shrink-0 disabled:opacity-50">
            {sibuk === p.id ? <Loader2 size={12} className="animate-spin" /> : <HeartPulse size={12} />} Hidupkan
          </button>
        </div>
      ))}
    </div>
  );
};

export const ModalHidupkanHati: React.FC<{ token: string; boleh: boolean; notify: (pesan: string) => void; onSelesai: () => void }> = ({ token, boleh, notify, onSelesai }) => {
  const [p, setP] = useState<PermohonanHati | null>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (!boleh) return;
    daftarPermohonanHati(token)
      .then((d) => (d.permohonan[0] ? setP(d.permohonan[0]) : setGalat('Permohonan tidak ditemukan atau tautannya sudah tidak berlaku.')))
      .catch((e) => setGalat(e instanceof Error ? e.message : 'Server tidak terjangkau.'));
  }, [token, boleh]);

  const hidupkan = async () => {
    setSibuk(true);
    try {
      const d = await hidupkanHati({ token });
      notify(`HATI ${d.nama.toUpperCase()} ${d.sudah ? 'SUDAH HIDUP' : 'DIHIDUPKAN'}`);
      onSelesai();
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal menghidupkan.'); setSibuk(false); }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 flex items-center justify-center p-4">
      <div className="retro-box !bg-zinc-900 border-red-500 w-full max-w-md space-y-3" role="dialog" aria-modal="true" aria-label="Hidupkan hati">
        <div className="flex items-center gap-2 border-b-2 border-white/15 pb-2">
          <HeartPulse size={18} className="text-red-400" />
          <h3 className="font-title text-[12px] text-red-300 flex-1">HIDUPKAN HATI</h3>
          <button type="button" onClick={onSelesai} className="text-zinc-400 hover:text-white" aria-label="Tutup"><X size={20} /></button>
        </div>
        {!boleh && <p className="text-[13px] text-amber-200">Tautan ini hanya untuk Admin atau Supervisor. Akun Anda tidak bisa menghidupkan hati anggota lain.</p>}
        {boleh && !p && !galat && <p className="text-[13px] text-zinc-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Memuat permohonan…</p>}
        {galat && <p className="text-[13px] text-red-300" role="alert">{galat}</p>}
        {boleh && p && (
          <>
            <div className="flex items-start gap-3"><RincianPermohonan p={p} /></div>
            {p.dihidupkanPada
              ? <p className="text-[13px] text-emerald-300">Hati ini sudah dihidupkan{p.dihidupkanOleh ? ` oleh ${p.dihidupkanOleh}` : ''}.</p>
              : (
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={onSelesai} className="btn-retro bg-zinc-800">Nanti</button>
                  <button type="button" onClick={hidupkan} disabled={sibuk} className="btn-retro bg-red-700 disabled:opacity-50">
                    {sibuk ? <Loader2 size={14} className="animate-spin" /> : <HeartPulse size={14} />} Hidupkan
                  </button>
                </div>
              )}
          </>
        )}
      </div>
    </div>
  );
};
