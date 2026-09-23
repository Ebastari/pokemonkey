import React, { useMemo, useState } from 'react';
import { ShoppingBag, Star, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import { GameState, Skin } from '../types';
import { SKINS } from '../constants';
import { MonkeySprite } from './MonkeySprite';

interface MarketScreenProps {
  state: GameState;
  onBuy: (id: string) => void;
  onEquip: (id: string) => void;
}

const TIER: Record<number, { label: string; garis: string; teks: string }> = {
  1: { label: 'Seragam',            garis: 'border-zinc-500',   teks: 'text-zinc-300' },
  2: { label: 'Aksesori',           garis: 'border-emerald-500', teks: 'text-emerald-300' },
  3: { label: 'Aksesori + Efek',    garis: 'border-cyan-500',   teks: 'text-cyan-300' },
  4: { label: 'Jubah / Sayap',      garis: 'border-purple-500', teks: 'text-purple-300' },
  5: { label: 'Legenda',            garis: 'border-yellow-400', teks: 'text-yellow-300' },
};

export const MarketScreen: React.FC<MarketScreenProps> = ({ state, onBuy, onEquip }) => {
  const [saring, setSaring] = useState<'semua' | 'dimiliki' | 'terjangkau'>('semua');

  const daftar = useMemo(() => [...SKINS].sort((a, b) => a.cost - b.cost).filter((s) => {
    if (saring === 'dimiliki') return state.ownedSkins.includes(s.id);
    if (saring === 'terjangkau') return !state.ownedSkins.includes(s.id) && state.xp >= s.cost;
    return true;
  }), [saring, state.ownedSkins, state.xp]);

  const berikutnya = useMemo(() => SKINS.filter((s) => !state.ownedSkins.includes(s.id) && s.cost > state.xp).sort((a, b) => a.cost - b.cost)[0], [state.ownedSkins, state.xp]);

  return (
    <div className="p-3 flex flex-col h-full overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b-4 border-white pb-2 mb-3">
        <h2 className="judul-layar flex items-center gap-2 mr-auto"><ShoppingBag size={16} /> Forester Market</h2>
        <div className="chip-retro !text-[13px] border-yellow-400 bg-zinc-900 text-yellow-300 !py-1.5"><Star size={12} className="fill-yellow-300" /> {state.xp.toLocaleString('id-ID')} XP</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {(['semua', 'dimiliki', 'terjangkau'] as const).map((s) => (
          <button key={s} onClick={() => setSaring(s)} className={`btn-retro btn-retro-sm ${saring === s ? 'bg-yellow-600' : 'bg-zinc-800'}`}>{s}</button>
        ))}
        {berikutnya && (
          <p className="text-[12px] text-zinc-300 ml-auto">Berikutnya: <b className="text-white">{berikutnya.name}</b> — kurang <b className="text-yellow-300">{(berikutnya.cost - state.xp).toLocaleString('id-ID')} XP</b></p>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar pb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {daftar.map((skin) => {
            const isOwned = state.ownedSkins.includes(skin.id);
            const isActive = state.activeSkinId === skin.id;
            const canAfford = state.xp >= skin.cost;
            const t = TIER[skin.tier];
            return (
              <div key={skin.id} className={`retro-box !p-3 flex flex-col gap-2 transition-all ${isActive ? '!border-yellow-400 !bg-yellow-950/40' : `!bg-zinc-900/70 ${t.garis}`}`}>
                <div className="h-28 bg-black/50 border-2 border-white/10 flex items-center justify-center relative overflow-hidden">
                  <MonkeySprite skin={skin} ukuran={88} pose="diam" />
                  {isActive && <span className="absolute top-1 right-1 chip-retro border-yellow-300 bg-yellow-500 text-black">Dipakai</span>}
                  {!isOwned && !canAfford && <span className="absolute top-1 left-1 text-zinc-400"><Lock size={14} /></span>}
                </div>
                <div className="leading-tight">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-[14px] font-bold text-white truncate">{skin.name}</h3>
                    <span className={`text-[11px] ${t.teks} whitespace-nowrap`}>{'★'.repeat(skin.tier)}</span>
                  </div>
                  <p className={`text-[11px] ${t.teks} uppercase`}>{t.label}</p>
                  <p className="text-[12px] text-zinc-300 mt-1 min-h-[2.4em] line-clamp-2">{skin.description}</p>
                </div>
                {!isOwned ? (
                  <button onClick={() => onBuy(skin.id)} disabled={!canAfford} className={`btn-retro btn-retro-sm w-full ${canAfford ? 'bg-emerald-600' : 'bg-zinc-800 grayscale'}`}>
                    <Star size={12} /> {skin.cost === 0 ? 'Gratis' : `${skin.cost.toLocaleString('id-ID')} XP`}
                  </button>
                ) : (
                  <button onClick={() => onEquip(skin.id)} disabled={isActive} className={`btn-retro btn-retro-sm w-full ${isActive ? 'bg-zinc-700' : 'bg-blue-600'}`}>
                    {isActive ? <><CheckCircle2 size={12} /> Terpasang</> : <><Sparkles size={12} /> Pakai</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 panel-retro text-[12px] text-zinc-300 leading-relaxed">
          <b className="text-white">Tingkatan skin.</b> Makin mahal, makin banyak lapisannya: ★ seragam · ★★ aksesori (helm, topi) · ★★★ aksesori + efek (aura, api, es, bayangan) · ★★★★ jubah atau sayap · ★★★★★ legenda dengan semua sekaligus. XP didapat dari laporan lapangan, menutup PICA tepat waktu, dan Monkey Run.
        </div>
      </div>
    </div>
  );
};
