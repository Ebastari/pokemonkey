import React from 'react';
import { AlarmClock, BellOff, Clock, CalendarDays, Volume2 } from 'lucide-react';
import type { AlarmItem } from '../lib/alarm';
import { matikanAlarmAcara, tundaAlarmAcara } from '../lib/alarm';

interface Props {
  alarm: AlarmItem;
  onTutup: () => void;
  onBukaKalender?: () => void;
  notify?: (pesan: string) => void;
}

export const ModalAlarm: React.FC<Props> = ({ alarm, onTutup, onBukaKalender, notify }) => {
  const matikan = () => {
    matikanAlarmAcara(alarm.id);
    notify?.('ALARM DIMATIKAN');
    onTutup();
  };

  const tunda = (menit = 5) => {
    tundaAlarmAcara(alarm.id, menit);
    notify?.(`ALARM DITUNDA ${menit} MENIT`);
    onTutup();
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 flex items-center justify-center p-4">
      <div className="retro-box !bg-zinc-950 border-4 !border-red-500 w-full max-w-md p-5 text-center flex flex-col items-center gap-4 shadow-2xl animate-bounce-short">
        
        {/* Ikon berkedip */}
        <div className="relative">
          <div className="w-16 h-16 bg-red-600 border-4 border-white flex items-center justify-center animate-pulse">
            <AlarmClock size={36} className="text-white animate-spin-slow" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500"></span>
          </span>
        </div>

        {/* Teks Judul & Acara */}
        <div>
          <span className="chip-retro border-red-400 bg-red-950 text-red-200 uppercase !text-[10px] mb-2 inline-flex items-center gap-1">
            <Volume2 size={12} className="animate-pulse" /> Alarm Berbunyi!
          </span>
          <h2 className="font-title text-[15px] md:text-[17px] text-yellow-300 mt-2 leading-relaxed">
            {alarm.judul}
          </h2>
          <div className="flex items-center justify-center gap-2 text-[12px] text-zinc-300 mt-2">
            <Clock size={14} className="text-sky-300" />
            <span className="font-bold text-white">Pukul {alarm.jamMulai} WITA</span>
            <span className="text-zinc-400">({alarm.menitSebelum} menit sebelum acara)</span>
          </div>
          {alarm.keterangan && (
            <p className="text-[11px] text-zinc-400 mt-2 max-w-sm italic bg-black/40 p-2 border border-white/10">
              "{alarm.keterangan}"
            </p>
          )}
        </div>

        {/* Tombol Aksi */}
        <div className="w-full flex flex-col gap-2 mt-2">
          <button
            onClick={matikan}
            className="btn-retro bg-red-700 hover:bg-red-600 text-white !py-3 flex items-center justify-center gap-2 text-[13px] font-bold shadow-lg"
          >
            <BellOff size={18} /> MATIKAN ALARM
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => tunda(5)}
              className="btn-retro bg-zinc-800 hover:bg-zinc-700 text-zinc-200 !py-2 text-[11px] flex items-center justify-center gap-1.5"
            >
              <Clock size={13} /> Tunda 5 Mnt
            </button>
            {onBukaKalender && (
              <button
                onClick={() => { matikan(); onBukaKalender(); }}
                className="btn-retro bg-blue-800 hover:bg-blue-700 text-white !py-2 text-[11px] flex items-center justify-center gap-1.5"
              >
                <CalendarDays size={13} /> Buka Kalender
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
