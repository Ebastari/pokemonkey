
import React from 'react';
import { ShoppingBag, Star, CheckCircle2, Lock } from 'lucide-react';
import { GameState, Skin } from '../types';
import { SKINS } from '../constants';

interface MarketScreenProps {
  state: GameState;
  onBuy: (id: string) => void;
  onEquip: (id: string) => void;
}

export const MarketScreen: React.FC<MarketScreenProps> = ({ state, onBuy, onEquip }) => {
  return (
    <div className="p-4 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center border-b-4 border-white pb-2 mb-6">
        <h2 className="text-r-md uppercase flex items-center gap-2">
          <ShoppingBag size={20} /> Forester Market
        </h2>
        <div className="retro-box !bg-zinc-900 !py-1 px-3 border-yellow-500 flex items-center gap-2">
          <Star size={14} className="text-yellow-400 fill-yellow-400" />
          <span className="text-r-sm font-bold">{state.xp.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SKINS.map((skin) => {
            const isOwned = state.ownedSkins.includes(skin.id);
            const isActive = state.activeSkinId === skin.id;
            const canAfford = state.xp >= skin.cost;

            return (
              <div key={skin.id} className={`retro-box flex flex-col gap-3 transition-all ${isActive ? '!border-yellow-400 bg-yellow-950/20' : '!bg-zinc-900/50'}`}>
                {/* Skin Preview Mini Sprite */}
                <div className="h-24 bg-black/40 border-2 border-white/10 flex items-center justify-center relative group">
                  <svg viewBox="0 0 64 64" className="w-16 h-16" style={{ imageRendering: 'pixelated' }}>
                    <rect x="20" y="24" width="24" height="24" fill={skin.colors.primary} />
                    <rect x="24" y="28" width="16" height="16" fill={skin.colors.secondary} />
                    <rect x="18" y="8" width="28" height="24" fill={skin.colors.primary} />
                    <rect x="22" y="12" width="20" height="16" fill={skin.colors.secondary} />
                    <rect x="26" y="16" width="2" height="4" fill={skin.colors.accent} />
                    <rect x="36" y="16" width="2" height="4" fill={skin.colors.accent} />
                    <rect x="26" y="24" width="12" height="2" fill={skin.colors.accent} />
                  </svg>
                  {isActive && (
                    <div className="absolute top-1 right-1 bg-yellow-400 text-black text-[5px] font-bold px-1 uppercase animate-pulse">
                      Active
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-[10px] font-bold text-white uppercase truncate">{skin.name}</h3>
                  <p className="text-[6px] text-zinc-500 h-8 line-clamp-2">{skin.description}</p>
                </div>

                <div className="flex flex-col gap-2">
                  {!isOwned ? (
                    <button 
                      onClick={() => onBuy(skin.id)}
                      disabled={!canAfford}
                      className={`w-full retro-box !p-2 text-[8px] font-bold flex items-center justify-center gap-2 ${canAfford ? '!bg-emerald-600 hover:!bg-emerald-500' : '!bg-zinc-800 opacity-50 grayscale'}`}
                    >
                      <Star size={10} /> {skin.cost.toLocaleString()} XP
                    </button>
                  ) : (
                    <button 
                      onClick={() => onEquip(skin.id)}
                      disabled={isActive}
                      className={`w-full retro-box !p-2 text-[8px] font-bold flex items-center justify-center gap-2 ${isActive ? '!bg-zinc-700' : '!bg-blue-600 hover:!bg-blue-500'}`}
                    >
                      {isActive ? <CheckCircle2 size={10} /> : <ShoppingBag size={10} />}
                      {isActive ? 'EQUIPPED' : 'EQUIP'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
