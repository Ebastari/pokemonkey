
import React, { useMemo, useState, useEffect } from 'react';
import { TreePine, Users, Zap } from 'lucide-react';
import { GameState } from '../types';
import { SKINS } from '../constants';

interface HabitatProps {
  state: GameState;
  dialogue: string;
  onSetDialogue: (d: string) => void;
}

interface ActiveUser {
  userId: string;
  name: string;
  skinId: string;
  posX: number;
  posY: number;
  stamina: number;
  level: number;
}

export const Habitat: React.FC<HabitatProps> = ({ state, dialogue, onSetDialogue }) => {
  const [others, setOthers] = useState<ActiveUser[]>([]);

  // Sync users lain setiap 10 detik agar terasa real-time
  useEffect(() => {
    if (!state.cloudUrl || !state.isLoggedIn) return;

    const fetchOthers = async () => {
      try {
        const res = await fetch(`${state.cloudUrl}?action=getActiveUsers`);
        if (!res.ok) throw new Error("Sync failed");
        const data = await res.json();
        if (Array.isArray(data)) {
          // Filter diri sendiri agar tidak double
          setOthers(data.filter(u => u.userId !== state.userId));
        }
      } catch (e) {
        console.warn("Multiplayer sync offline/error:", e);
      }
    };

    fetchOthers();
    const interval = setInterval(fetchOthers, 10000);
    return () => clearInterval(interval);
  }, [state.cloudUrl, state.userId, state.isLoggedIn]);

  // Generate pepohonan berdasarkan plantedArea
  const treePositions = useMemo(() => {
    const count = Math.min(80, Math.floor(state.plantedArea / 1));
    return Array.from({ length: count }).map((_, i) => ({
      x: (Math.abs(Math.sin(i * 123.45)) * 90) + 5,
      y: (Math.abs(Math.cos(i * 678.90)) * 80) + 10,
      size: 16 + (Math.abs(Math.sin(i)) * 24)
    }));
  }, [state.plantedArea]);

  // Dekorasi rumput acak
  const grassDecor = useMemo(() => {
    return Array.from({ length: 40 }).map((_, i) => ({
      x: (Math.abs(Math.sin(i * 444)) * 95),
      y: (Math.abs(Math.cos(i * 555)) * 95),
    }));
  }, []);

  return (
    <div className="flex-1 garden-bg rounded-lg relative overflow-hidden border-4 border-[#3f6212] m-1 md:m-2 min-h-[400px] cursor-crosshair shadow-inner">
      {/* Layer 1: Dekorasi Rumput & Tanah */}
      {grassDecor.map((g, i) => (
        <div key={`g-${i}`} className="absolute w-1 h-1 bg-green-700/30 rounded-full" style={{ left: `${g.x}%`, top: `${g.y}%` }} />
      ))}

      {/* Layer 2: Pepohonan (Berdasarkan progress tanam) */}
      {treePositions.map((pos, i) => (
        <div 
          key={`t-${i}`} 
          className="absolute opacity-90 drop-shadow-md transition-all duration-1000" 
          style={{ left: `${pos.x}%`, top: `${pos.y}%`, width: `${pos.size}px`, transform: 'translate(-50%, -100%)' }}
        >
          <TreePine className="text-green-900" size={pos.size} />
        </div>
      ))}

      {/* Layer 3: User Lain (Multiplayer) */}
      {others.map((user) => (
        <div 
          key={user.userId} 
          className="absolute transition-all duration-[5000ms] ease-in-out z-20"
          style={{ left: `${user.posX}%`, top: `${user.posY}%`, transform: 'translate(-50%, -50%)' }}
        >
          <PlayerSprite 
            name={user.name} 
            skinId={user.skinId} 
            stamina={user.stamina} 
            level={user.level} 
            isMe={false} 
          />
        </div>
      ))}

      {/* Layer 4: Karakter Utama (User) */}
      <div 
        className="absolute transition-all duration-500 z-30"
        style={{ left: `${state.monkeyPos.x}%`, top: `${state.monkeyPos.y}%`, transform: 'translate(-50%, -50%)' }}
      >
        <PlayerSprite 
          name="SAYA" 
          skinId={state.activeSkinId} 
          stamina={state.stamina} 
          level={state.level} 
          isMe={true} 
          dialogue={dialogue}
        />
      </div>

      {/* UI Overlay: Statistik Kebun */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end pointer-events-none">
         <div className="retro-box !bg-black/80 !p-2 flex items-center gap-3">
            <div className="flex -space-x-2">
               {others.slice(0, 3).map(u => (
                  <div key={u.userId} className="w-6 h-6 border-2 border-white bg-zinc-800 rounded-full flex items-center justify-center text-[5px] font-bold overflow-hidden">
                     {u.name[0]}
                  </div>
               ))}
               {others.length > 3 && <div className="w-6 h-6 border-2 border-white bg-emerald-600 rounded-full flex items-center justify-center text-[5px] font-bold">+{others.length-3}</div>}
            </div>
            <div className="text-white">
               <p className="text-[6px] text-zinc-400 uppercase leading-none mb-1">Populasi Rimbawan</p>
               <p className="text-[8px] font-bold uppercase">{others.length + 1} Forester Aktif</p>
            </div>
         </div>

         <div className="retro-box !bg-green-900/90 !border-white/40 !p-2 text-right">
            <p className="text-[6px] text-green-300 uppercase">Luas Hutan</p>
            <p className="text-r-sm font-bold text-white tracking-tighter">{state.plantedArea.toFixed(2)} HA</p>
         </div>
      </div>
    </div>
  );
};

// Sub-komponen Sprite Player dengan Tag Nama & Stamina
const PlayerSprite = ({ name, skinId, stamina, level, isMe, dialogue }: any) => {
  const skin = SKINS.find(s => s.id === skinId) || SKINS[0];
  const staminaColor = stamina > 70 ? 'bg-emerald-500' : stamina > 30 ? 'bg-yellow-500' : 'bg-red-600';

  return (
    <div className="relative flex flex-col items-center">
      {/* Gelembung Chat Diri Sendiri */}
      {isMe && dialogue && (
        <div className="absolute -top-16 mb-2 whitespace-nowrap z-50">
           <div className="pixel-bubble !p-2 !text-[6px] md:!text-[8px]">
             {dialogue}
           </div>
        </div>
      )}

      {/* Status Bar: Level & Stamina */}
      <div className="mb-1 flex flex-col items-center gap-0.5">
         <div className="flex items-center gap-1 bg-black/60 px-1 rounded border border-white/20">
            <span className="text-[5px] font-bold text-yellow-400">LV.{level}</span>
            <span className="text-[6px] font-bold text-white uppercase">{name}</span>
         </div>
         
         {/* Stamina Bar Mini */}
         <div className="w-10 h-1.5 bg-black border border-white/40 overflow-hidden relative">
            <div 
              className={`h-full transition-all duration-500 ${staminaColor}`}
              style={{ width: `${stamina}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[4px] font-bold text-white drop-shadow-sm">
               {Math.floor(stamina)}%
            </span>
         </div>
      </div>

      {/* Karakter Monyet */}
      <div className={`${stamina <= 0 ? 'grayscale opacity-50' : (isMe ? 'animate-monkey-happy' : 'animate-monkey-tired')}`}>
         <svg viewBox="0 0 64 64" className={`${isMe ? 'w-12 h-12 md:w-16 md:h-16' : 'w-8 h-8 md:w-10 md:h-10'} drop-shadow-xl`} style={{ imageRendering: 'pixelated' }}>
            <rect x="20" y="24" width="24" height="24" fill={skin.colors.primary} />
            <rect x="24" y="28" width="16" height="16" fill={skin.colors.secondary} />
            <rect x="18" y="8" width="28" height="24" fill={skin.colors.primary} />
            <rect x="22" y="12" width="20" height="16" fill={skin.colors.secondary} />
            <rect x="26" y="16" width="2" height="4" fill={skin.colors.accent} />
            <rect x="36" y="16" width="2" height="4" fill={skin.colors.accent} />
            <rect x="26" y="24" width="12" height="2" fill={skin.colors.accent} />
            <rect x="14" y="28" width="6" height="12" fill={skin.colors.primary} />
            <rect x="44" y="28" width="6" height="12" fill={skin.colors.primary} />
            <rect x="22" y="48" width="6" height="8" fill={skin.colors.primary} />
            <rect x="36" y="48" width="6" height="8" fill={skin.colors.primary} />
         </svg>
      </div>

      {/* Shadow */}
      <div className="w-8 h-2 bg-black/20 rounded-full blur-[2px] -mt-1" />
    </div>
  );
};
