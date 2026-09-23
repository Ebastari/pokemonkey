import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Volume2 } from 'lucide-react';
import { GameState, FieldReport } from '../types';
import { urlBerkas } from '../lib/api';

/** LOG — riwayat laporan lapangan. */
export const CalendarScreen = ({ state, onRead }: { state: GameState; onRead: (r: FieldReport) => void }) => (
  <div className="p-3 space-y-3 overflow-auto h-full custom-scrollbar">
    <h2 className="judul-layar border-b-4 border-white pb-2 flex items-center gap-2"><CalendarIcon size={16} /> Field Activity Log</h2>
    <div className="grid grid-cols-1 gap-3 pb-6">
      {state.reports.length === 0 && <p className="text-center py-16 opacity-50 text-[13px] uppercase">Belum ada laporan</p>}
      {state.reports.map((r) => (
        <div key={r.id} onClick={() => onRead(r)} className="retro-box !bg-white/5 !p-3 flex gap-3 border-white/20 cursor-pointer hover:!bg-white/10">
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
                <p className="text-[11px] text-cyan-300 uppercase">{new Date(r.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}{r.userName ? ` · ${r.userName}` : ''}</p>
                <p className="text-[14px] text-white font-bold truncate">{r.missionTitle}</p>
                <p className="text-[12px] text-zinc-300 truncate">{r.activityType}{r.notes ? ` — ${r.notes}` : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] text-emerald-300 font-bold">+{r.achievedUnit.toFixed(2)} {r.unitType.toUpperCase()}</p>
                <Volume2 size={12} className="text-zinc-500 ml-auto mt-1" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Foto bukti laporan yang sudah tersimpan di server.
 *
 * Berkasnya butuh header Authorization, jadi tidak bisa dipasang langsung ke
 * src; diambil sebagai blob lalu dilepas kembali saat kartu hilang dari layar.
 */
const FotoLaporan: React.FC<{ kunci: string }> = ({ kunci }) => {
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
  return <img src={url} className="w-full h-full object-cover" alt="Bukti laporan" />;
};
