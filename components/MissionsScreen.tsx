
import React from 'react';
import { Target, CheckCircle2 } from 'lucide-react';
import { GameState, MissionStatus, MissionType } from '../types';

export const MissionsScreen = ({ state, onStart }: { state: GameState, onStart: (id: string) => void }) => (
  <div className="p-4 space-y-4 overflow-auto h-full">
    <h2 className="text-r-md border-b-4 border-white pb-2 mb-6 uppercase flex items-center gap-2">
      <Target size={20} /> Quest Journal
    </h2>
    <div className="grid grid-cols-1 gap-4 pb-10">
      {state.missions.map((m) => {
        const isPlanting = m.type === MissionType.PLANTING;
        const colorClass = isPlanting ? 'border-green-500 bg-green-950/20' : 'border-amber-500 bg-amber-950/20';
        const unit = m.type === MissionType.NURSERY ? 'Bibit' : 'Ha';
        return (
          <div key={m.id} className={`retro-box !p-4 border-l-8 ${colorClass} ${m.status === MissionStatus.LOCKED ? 'opacity-30 grayscale' : ''}`}>
            <div className="flex justify-between items-start">
               <div className="flex-1">
                  <h4 className="text-r-sm text-yellow-400 font-bold mb-1 uppercase">{m.title}</h4>
                  <p className="text-[8px] opacity-70 mb-4">{m.description}</p>
                  {(m.status === MissionStatus.IN_PROGRESS || m.status === MissionStatus.COMPLETED) && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[6px] uppercase font-bold">
                        <span>Progres</span>
                        <span>{m.current.toFixed(1)} / {m.target} {unit}</span>
                      </div>
                      <div className="h-2 bg-black border-2 border-white/20">
                        <div className="h-full bg-yellow-500" style={{ width: `${(m.current/m.target)*100}%` }}></div>
                      </div>
                    </div>
                  )}
               </div>
               {m.status === MissionStatus.AVAILABLE && (
                 <button onClick={() => onStart(m.id)} className="retro-box !bg-green-600 !p-2 text-[8px] font-bold">START</button>
               )}
               {m.status === MissionStatus.COMPLETED && <CheckCircle2 size={24} className="text-green-500" />}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);
