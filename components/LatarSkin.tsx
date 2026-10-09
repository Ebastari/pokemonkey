import React from 'react';
import type { Skin } from '../types';
import { MonkeySprite } from './MonkeySprite';

/**
 * Wallpaper skin: monyet besar di atas latar sesuai tingkatnya. Dipakai layar
 * detail skin (SHOP), kepala panel anggota (TEAM), dan avatar bawaan.
 */

export const KELANGKAAN: Record<number, { label: string; garis: string; teks: string; bingkai: string }> = {
  1: { label: 'Umum', garis: 'border-zinc-500', teks: 'text-zinc-300', bingkai: '#a1a1aa' },
  2: { label: 'Biasa', garis: 'border-emerald-500', teks: 'text-emerald-300', bingkai: '#10b981' },
  3: { label: 'Langka', garis: 'border-cyan-500', teks: 'text-cyan-300', bingkai: '#06b6d4' },
  4: { label: 'Epik', garis: 'border-purple-500', teks: 'text-purple-300', bingkai: '#a855f7' },
  5: { label: 'Legenda', garis: 'border-yellow-400', teks: 'text-yellow-300', bingkai: '#facc15' },
  6: { label: 'Mitis · Prestasi', garis: 'border-pink-400', teks: 'text-pink-300', bingkai: '#f472b6' },
};

/** Latar per tingkat: hutan pagi → persemaian → malam berkabut → senja → emas → pelangi prestasi. */
const LATAR: Record<number, string> = {
  1: 'linear-gradient(180deg,#bae6fd 0%,#e0f2fe 68%,#4d7c0f 68%,#365314 100%)',
  2: 'linear-gradient(180deg,#a7f3d0 0%,#d1fae5 68%,#65a30d 68%,#3f6212 100%)',
  3: 'linear-gradient(180deg,#0f172a 0%,#1e3a5f 68%,#14532d 68%,#052e16 100%)',
  4: 'linear-gradient(180deg,#7c2d12 0%,#f97316 35%,#fde68a 68%,#422006 68%,#1c1917 100%)',
  5: 'linear-gradient(180deg,#713f12 0%,#facc15 58%,#fef9c3 68%,#854d0e 68%,#422006 100%)',
  6: 'linear-gradient(180deg,#1e1b4b 0%,#7c3aed 30%,#ec4899 50%,#facc15 68%,#0f172a 68%,#020617 100%)',
};

export const LatarSkin: React.FC<{
  skin: Skin; tinggi?: number; ukuranMonyet?: number; pose?: 'diam' | 'jalan' | 'lompat'; className?: string; children?: React.ReactNode;
}> = ({ skin, tinggi = 220, ukuranMonyet = 150, pose = 'diam', className = '', children }) => (
  <div className={`relative overflow-hidden ${className}`} style={{ height: tinggi, background: LATAR[skin.tier] ?? LATAR[1] }}>
    {/* Bintang kecil untuk latar malam/prestasi */}
    {skin.tier >= 3 && [12, 27, 44, 63, 78, 90].map((x, i) => (
      <span key={x} className="absolute w-1 h-1 bg-white/80 animate-sparkle" style={{ left: `${x}%`, top: `${8 + ((i * 17) % 30)}%`, animationDelay: `${i * 0.4}s` }} />
    ))}
    {/* Rumput piksel */}
    <div className="absolute inset-x-0" style={{ top: '68%', height: 6, background: 'repeating-linear-gradient(90deg,#22c55e 0 6px,#16a34a 6px 12px)' }} />
    <div className="absolute inset-x-0 flex justify-center" style={{ top: `calc(68% - ${ukuranMonyet * 0.93}px)` }}>
      <MonkeySprite skin={skin} ukuran={ukuranMonyet} pose={pose} />
    </div>
    {children}
  </div>
);

/** Avatar kepala-dada dari skin (dipotong dari sprite), berbingkai warna kelangkaan. */
export const AvatarSkin: React.FC<{ skin: Skin; ukuran?: number; className?: string }> = ({ skin, ukuran = 40, className = '' }) => (
  <span
    className={`relative inline-block overflow-hidden shrink-0 border-2 ${className}`}
    style={{ width: ukuran, height: ukuran, borderColor: KELANGKAAN[skin.tier]?.bingkai ?? '#a1a1aa', background: LATAR[skin.tier] ?? LATAR[1] }}
    aria-hidden="true"
  >
    <span className="absolute left-1/2" style={{ top: -ukuran * 0.08, transform: 'translateX(-50%)' }}>
      <MonkeySprite skin={{ ...skin, prestasi: false, efek: undefined }} ukuran={ukuran * 1.55} animasi={false} />
    </span>
  </span>
);
