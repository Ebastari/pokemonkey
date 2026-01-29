
import React from 'react';
import { Calendar as CalendarIcon, ClipboardCheck, Volume2 } from 'lucide-react';
import { GameState, FieldReport } from '../types';

export const CalendarScreen = ({ state, onRead }: { state: GameState, onRead: (r: FieldReport) => void }) => (
  <div className="p-4 space-y-4 overflow-auto h-full">
    <h2 className="text-r-md border-b-4 border-white pb-2 mb-6 uppercase flex items-center gap-2">
      <CalendarIcon size={20} /> Field Activity Log
    </h2>
    <div className="grid grid-cols-1 gap-4 pb-20">
      {state.reports.length === 0 && <p className="text-center py-20 opacity-20 text-[10px]">BELUM ADA LOG TERJADWAL</p>}
      {state.reports.map((r) => (
        <div key={r.id} onClick={() => onRead(r)} className="retro-box !bg-white/5 flex gap-4 p-4 border-white/10 cursor-pointer group hover:!bg-white/10">
           <div className="w-16 h-16 bg-black flex-shrink-0 border-4 border-white overflow-hidden relative">
              {r.photoData ? <img src={r.photoData} className="w-full h-full object-cover" /> : <CalendarIcon size={16} className="opacity-20 m-4" />}
           </div>
           <div className="flex-1">
              <div className="flex justify-between items-start">
                 <div>
                    <p className="text-[7px] font-bold text-cyan-400 mb-1 uppercase">{new Date(r.timestamp).toLocaleDateString()}</p>
                    <p className="text-[10px] text-white font-bold uppercase">{r.missionTitle}</p>
                 </div>
                 <div className="text-right">
                    <p className="text-r-sm text-emerald-400 font-bold">+{r.achievedUnit.toFixed(2)} UNIT</p>
                    <Volume2 size={12} className="text-zinc-500 ml-auto mt-1" />
                 </div>
              </div>
           </div>
        </div>
      ))}
    </div>
  </div>
);
