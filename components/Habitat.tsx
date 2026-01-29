
import React, { useMemo } from 'react';
import { TreePine, Skull, Info, Clock } from 'lucide-react';
import { GameState, WorkPlan } from '../types';

interface HabitatProps {
  state: GameState;
  dialogue: string;
  onSetDialogue: (d: string) => void;
}

export const Habitat: React.FC<HabitatProps> = ({ state, dialogue, onSetDialogue }) => {
  const treePositions = useMemo(() => {
    const count = Math.floor(state.plantedArea / 1.5);
    return Array.from({ length: count }).map((_, i) => ({
      x: (Math.abs(Math.sin(i * 12345 + 1)) * 90) + 5,
      y: (Math.abs(Math.cos(i * 12345 + 2)) * 80) + 10,
      size: 16 + (Math.abs(Math.sin(i)) * 16)
    }));
  }, [state.plantedArea]);

  const monkeyStatus = useMemo(() => {
    if (state.lives <= 0) return 'fainted';
    if (state.stamina < 30) return 'sluggish';
    return 'energetic';
  }, [state.lives, state.stamina]);

  // Cari rencana kerja terbaru yang aktif (belum selesai)
  const activePlan = useMemo(() => {
    if (!state.memoPlans) return null;
    // Ambil rencana yang isDone: false pertama
    return state.memoPlans.find(p => !p.isDone) || null;
  }, [state.memoPlans]);

  return (
    <div className="flex-1 garden-bg rounded-lg relative overflow-hidden border-4 border-[#3f6212] m-2">
      {/* Pohon-pohon */}
      {treePositions.map((pos, i) => (
        <div key={i} className="absolute animate-bounce-slow" style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.size}px`, transform: 'translate(-50%, -100%)' }}>
          <TreePine className="text-green-800 drop-shadow-md" size={pos.size} />
        </div>
      ))}

      {/* Info Shift */}
      <div className="absolute top-4 left-4 bg-black/60 p-2 border border-white/20 text-[6px] text-white z-10 uppercase">
        Shift: 07:00 - 15:00
      </div>

      {/* Gelembung Teks */}
      {state.lives > 0 && (
        <div className="absolute transition-all duration-300 z-40 pointer-events-none" 
             style={{ 
               left: `${state.monkeyPos.x}%`, 
               top: `calc(${state.monkeyPos.y}% - 140px)`, 
               transform: 'translateX(-50%)' 
             }}>
          <div className="pixel-bubble shadow-2xl min-w-[140px] text-center">
            {dialogue}
          </div>
        </div>
      )}

      {/* Sprite Monyet */}
      <div className="absolute transition-all duration-100 z-30" 
           style={{ 
             left: `${state.monkeyPos.x}%`, 
             top: `${state.monkeyPos.y}%`, 
             transform: `translate(-50%, -50%) scaleX(${state.monkeyPos.facing === 'left' ? -1 : 1})` 
           }}>
        <div className={monkeyStatus === 'fainted' ? 'grayscale opacity-50' : 'animate-monkey-happy'}>
          {monkeyStatus === 'fainted' ? <Skull size={96} className="text-zinc-600" /> : (
            <svg viewBox="0 0 64 64" className="w-32 h-32 drop-shadow-2xl" style={{ imageRendering: 'pixelated' }}>
              <rect x="20" y="24" width="24" height="24" fill="#8B4513" />
              <rect x="24" y="28" width="16" height="16" fill="#D2B48C" />
              <rect x="18" y="8" width="28" height="24" fill="#8B4513" />
              <rect x="22" y="12" width="20" height="16" fill="#D2B48C" />
              <rect x="26" y="16" width="2" height="4" fill="#000" />
              <rect x="36" y="16" width="2" height="4" fill="#000" />
              <rect x="26" y="24" width="12" height="2" fill="#000" />
              <rect x="14" y="28" width="6" height="12" fill="#8B4513" />
              <rect x="44" y="28" width="6" height="12" fill="#8B4513" />
              <rect x="22" y="48" width="6" height="8" fill="#8B4513" />
              <rect x="36" y="48" width="6" height="8" fill="#8B4513" />
            </svg>
          )}
        </div>
      </div>

      {/* Running Plan Ticker (Banner di bagian bawah sesuai gambar user) */}
      <div className="absolute bottom-4 left-4 right-4 z-50 overflow-hidden pointer-events-none">
        <div className="border-4 border-black bg-[#4ade80] px-4 py-2 flex items-center gap-4 shadow-lg min-h-[40px] relative">
          <div className="flex-shrink-0 bg-black text-white px-2 py-1 text-[7px] font-bold uppercase flex items-center gap-1 animate-pulse">
            <Info size={10} /> Berjalan
          </div>
          <div className="flex-1 whitespace-nowrap overflow-hidden">
             {activePlan ? (
               <div className="flex items-center gap-4 text-black text-[9px] font-bold animate-[marquee_20s_linear_infinite]">
                 <span className="flex items-center gap-1 bg-white/40 px-2 rounded-full border border-black/10">
                   <Clock size={10}/> {activePlan.startTime} - {activePlan.endTime}
                 </span>
                 <span>{activePlan.date}: {activePlan.description}</span>
                 <span className="opacity-20">|</span>
                 <span>{activePlan.date}: {activePlan.description}</span>
               </div>
             ) : (
               <p className="text-black/40 text-[7px] italic uppercase tracking-widest text-center w-full">
                 Tidak ada rencana kerja aktif yang terdeteksi
               </p>
             )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
};
