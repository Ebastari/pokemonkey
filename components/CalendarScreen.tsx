import React, { useEffect, useRef, useState } from 'react';
import { Calendar as CalendarIcon, Camera, ChevronRight, Images, Loader2, Pencil, Save, Volume2, X } from 'lucide-react';
import { GameState, FieldReport } from '../types';
import { urlBerkas } from '../lib/api';
import { kompresFoto } from './ReportsScreen';

const adaFoto = (r: FieldReport) => Boolean(r.photoData || r.foto);
/** Laporan yang sudah tersimpan di server (bukan yang masih menunggu sinkron). */
const sudahDiServer = (r: FieldReport) => r.id.startsWith('lap_');

const tanggal = (t: number) => new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const tanggalJam = (t: number) => new Date(t).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface Props {
  state: GameState;
  onRead: (r: FieldReport) => void;
  /** Admin/Supervisor boleh melengkapi foto laporan siapa pun; anggota hanya miliknya. */
  bolehSemua?: boolean;
  /** Tambahkan foto ke laporan yang belum punya (laporan lama, atau yang dikirim saat offline). */
  onTambahFoto?: (r: FieldReport, dataUrl: string) => Promise<void>;
}

/** LOG — riwayat laporan lapangan; ketuk satu laporan untuk melihat detail lengkapnya. */
export const CalendarScreen = ({ state, onRead, bolehSemua, onTambahFoto }: Props) => {
  const [terpilihId, setTerpilihId] = useState<string | null>(null);
  const terpilih = state.reports.find((r) => r.id === terpilihId) ?? null;
  const setTerpilih = (r: FieldReport | null) => setTerpilihId(r?.id ?? null);
  const bolehEdit = (r: FieldReport) => Boolean(onTambahFoto) && sudahDiServer(r) && (bolehSemua || r.userId === state.userId);
  return (
    <div className="p-3 space-y-3 overflow-auto h-full custom-scrollbar">
      <h2 className="judul-layar border-b-4 border-white pb-2 flex items-center gap-2"><CalendarIcon size={16} /> Field Activity Log</h2>
      <div className="grid grid-cols-1 gap-3 pb-6">
        {state.reports.length === 0 && <p className="text-center py-16 opacity-50 text-[13px] uppercase">Belum ada laporan</p>}
        {state.reports.map((r) => (
          <button key={r.id} type="button" onClick={() => setTerpilih(r)} className="retro-box !bg-white/5 !p-3 flex gap-3 border-white/20 text-left hover:!bg-white/10" title="Lihat detail laporan">
            <div className="w-14 h-14 bg-black shrink-0 border-[3px] border-white flex items-center justify-center">
              {r.photoData
                ? <img src={r.photoData} className="w-full h-full object-cover" alt="" />
                : r.foto
                  ? <FotoLaporan kunci={r.foto} />
                  : <CalendarIcon size={18} className="opacity-40" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-cyan-300 uppercase">{tanggal(r.timestamp)}{r.userName ? ` · ${r.userName}` : ''}</p>
                  <p className="text-[14px] text-white font-bold truncate">{r.missionTitle}</p>
                  <p className="text-[12px] text-zinc-300 truncate">{r.activityType}{r.notes ? ` — ${r.notes}` : ''}</p>
                  {!adaFoto(r) && (
                    <span className="chip-retro !text-[10px] border-orange-400 text-orange-300 inline-flex items-center gap-1 mt-1">
                      {bolehEdit(r) ? <><Pencil size={10} /> Belum ada foto · ketuk untuk melengkapi</> : 'Belum ada foto'}
                    </span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] text-emerald-300 font-bold">+{r.achievedUnit.toFixed(2)} {r.unitType.toUpperCase()}</p>
                  <ChevronRight size={14} className="text-zinc-500 ml-auto mt-1" />
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {terpilih && (
        <DetailLaporan
          laporan={terpilih}
          onTutup={() => setTerpilih(null)}
          onBacakan={() => { onRead(terpilih); setTerpilih(null); }}
          onTambahFoto={bolehEdit(terpilih) ? (data) => onTambahFoto!(terpilih, data) : undefined}
        />
      )}
    </div>
  );
};

/** Lembar detail satu laporan: foto penuh, waktu, pelapor, tujuan, capaian, dan catatan lengkap. */
const DetailLaporan: React.FC<{
  laporan: FieldReport; onTutup: () => void; onBacakan: () => void; onTambahFoto?: (dataUrl: string) => Promise<void>;
}> = ({ laporan: r, onTutup, onBacakan, onTambahFoto }) => {
  // Edit: melengkapi laporan yang belum berfoto.
  const [fotoBaru, setFotoBaru] = useState('');
  const [sibuk, setSibuk] = useState<'proses' | 'simpan' | null>(null);
  const [galat, setGalat] = useState('');
  const kameraRef = useRef<HTMLInputElement>(null);
  const galeriRef = useRef<HTMLInputElement>(null);
  const terimaFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setGalat('');
    setSibuk('proses');
    try { setFotoBaru(await kompresFoto(f)); } finally { setSibuk(null); }
  };
  const simpanFoto = async () => {
    if (!fotoBaru || !onTambahFoto) return;
    setGalat('');
    setSibuk('simpan');
    try { await onTambahFoto(fotoBaru); setFotoBaru(''); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Foto gagal disimpan. Coba lagi.'); }
    finally { setSibuk(null); }
  };
  const tanpaFoto = !adaFoto(r);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') onTutup(); };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [onTutup]);
  const baris = (label: string, isi: React.ReactNode) => (
    <div className="flex gap-3 py-1.5 border-b border-white/10 text-[13px]">
      <span className="w-24 shrink-0 text-zinc-400 uppercase text-[11px] pt-0.5">{label}</span>
      <span className="flex-1 min-w-0 text-white break-words">{isi}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-[100] bg-black/85 flex items-end md:items-center justify-center md:p-4" onClick={onTutup}>
      <div role="dialog" aria-modal="true" aria-label="Detail laporan" className="retro-box !bg-zinc-900 border-purple-400 w-full md:max-w-lg max-h-[92vh] flex flex-col !p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-2 border-b-2 border-white/15 shrink-0">
          <span className="font-title text-[11px] text-purple-300 flex-1">DETAIL LAPORAN</span>
          <button type="button" onClick={onTutup} className="text-zinc-400 hover:text-white" aria-label="Tutup"><X size={22} /></button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-3">
          <div className={`w-full bg-black border-[3px] flex items-center justify-center min-h-[120px] max-h-[55vh] overflow-hidden ${tanpaFoto && !fotoBaru ? 'border-dashed border-orange-400' : 'border-white'}`}>
            {fotoBaru
              ? <img src={fotoBaru} className="w-full max-h-[55vh] object-contain" alt="Foto yang akan disimpan" />
              : r.photoData
                ? <img src={r.photoData} className="w-full max-h-[55vh] object-contain" alt="Foto dokumentasi laporan" />
                : r.foto
                  ? <FotoLaporan kunci={r.foto} penuh />
                  : <p className="text-[12px] text-orange-300 uppercase py-8">{sibuk === 'proses' ? 'Memproses foto…' : 'Laporan ini belum ada foto'}</p>}
          </div>

          {tanpaFoto && onTambahFoto && (
            <div className="border-2 border-orange-400/60 bg-orange-950/20 p-2.5 space-y-2">
              <p className="text-[12px] text-orange-200 flex items-center gap-1.5 font-bold"><Pencil size={12} /> Edit · lengkapi foto dokumentasi</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => kameraRef.current?.click()} disabled={sibuk !== null} className="btn-retro btn-retro-sm bg-orange-600 justify-center disabled:opacity-50"><Camera size={13} /> Kamera</button>
                <button type="button" onClick={() => galeriRef.current?.click()} disabled={sibuk !== null} className="btn-retro btn-retro-sm bg-zinc-700 justify-center disabled:opacity-50"><Images size={13} /> Galeri</button>
              </div>
              {fotoBaru && (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFotoBaru('')} disabled={sibuk !== null} className="btn-retro btn-retro-sm bg-zinc-800 justify-center disabled:opacity-50">Batal</button>
                  <button type="button" onClick={simpanFoto} disabled={sibuk !== null} className="btn-retro btn-retro-sm bg-emerald-700 justify-center disabled:opacity-50">
                    {sibuk === 'simpan' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan foto
                  </button>
                </div>
              )}
              {galat && <p className="text-[12px] text-red-300" role="alert">{galat}</p>}
              <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={terimaFoto} />
              <input ref={galeriRef} type="file" accept="image/*" className="hidden" onChange={terimaFoto} />
            </div>
          )}
          {tanpaFoto && !onTambahFoto && !sudahDiServer(r) && (
            <p className="text-[12px] text-zinc-400">Laporan ini belum tersinkron ke server; foto bisa ditambahkan setelah online.</p>
          )}
          <div>
            <p className="text-[18px] font-bold text-white leading-snug">{r.missionTitle}</p>
            <p className="text-[20px] font-bold text-emerald-300 mt-0.5">+{r.achievedUnit.toFixed(2)} {r.unitType.toUpperCase()}</p>
          </div>
          <div>
            {baris('Waktu', tanggalJam(r.timestamp))}
            {baris('Pelapor', r.userName || '—')}
            {baris('Pekerjaan', r.activityType || '—')}
            {baris(r.missionId ? 'PICA / misi' : 'Tujuan', r.missionId || 'Pekerjaan rutin, tanpa PICA')}
            {baris('Capaian', `${r.achievedUnit.toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${r.unitType}`)}
          </div>
          <div>
            <p className="label-retro text-yellow-300">Catatan</p>
            <p className="text-[14px] text-zinc-100 leading-relaxed whitespace-pre-wrap break-words">{r.notes?.trim() || <span className="text-zinc-500">Tidak ada catatan.</span>}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-4 py-2 border-t-2 border-white/15 shrink-0">
          <button type="button" onClick={onBacakan} className="btn-retro btn-retro-sm bg-zinc-800" title="Monyet di KEBUN membacakan ringkasan laporan ini"><Volume2 size={12} /> Bacakan di KEBUN</button>
          <button type="button" onClick={onTutup} className="btn-retro btn-retro-sm bg-purple-700">Tutup</button>
        </div>
      </div>
    </div>
  );
};

/**
 * Foto bukti laporan yang sudah tersimpan di server.
 *
 * Berkasnya butuh header Authorization, jadi tidak bisa dipasang langsung ke
 * src; diambil sebagai blob lalu dilepas kembali saat kartu hilang dari layar.
 * `penuh`: tampil utuh (detail laporan), bukan dipotong jadi kotak kecil.
 */
const FotoLaporan: React.FC<{ kunci: string; penuh?: boolean }> = ({ kunci, penuh }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    let dibuat = '';
    urlBerkas(kunci)
      .then((u) => { if (hidup) { dibuat = u; setUrl(u); } })
      .catch(() => undefined);
    return () => {
      hidup = false;
      if (dibuat.startsWith('blob:')) URL.revokeObjectURL(dibuat);
    };
  }, [kunci]);

  if (!url) return <CalendarIcon size={18} className="opacity-40" />;
  return <img src={url} className={penuh ? 'w-full max-h-[55vh] object-contain' : 'w-full h-full object-cover'} alt="Bukti laporan" />;
};
