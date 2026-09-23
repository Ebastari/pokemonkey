import React, { useEffect, useMemo, useState } from 'react';
import { susunMonyet, LEBAR, TINGGI, type Pose } from '../lib/pixel';
import type { Skin } from '../types';

/**
 * Monyet sebagai SVG. Satu komponen untuk KEBUN, SHOP, dan pratinjau.
 * Efek skin tingkat tinggi (aura, kilau, api) dianimasikan di sini.
 */

interface Props {
  skin: Skin;
  pose?: Pose;
  hadap?: 'left' | 'right';
  ukuran?: number;          // tinggi dalam px
  animasi?: boolean;        // ganti frame jalan/api
  className?: string;
}

export const MonkeySprite: React.FC<Props> = ({ skin, pose = 'diam', hadap = 'right', ukuran = 64, animasi = true, className = '' }) => {
  const [bingkai, setBingkai] = useState(0);

  const perluFrame = animasi && (pose === 'jalan' || skin.efek === 'api' || skin.aksesori?.some((a) => a.startsWith('sayap_api')));
  useEffect(() => {
    if (!perluFrame) return;
    const t = setInterval(() => setBingkai((b) => b + 1), pose === 'jalan' ? 140 : 220);
    return () => clearInterval(t);
  }, [perluFrame, pose]);

  const lapisan = useMemo(() => susunMonyet(skin.colors, skin.aksesori ?? [], pose, bingkai), [skin, pose, bingkai]);

  const lebarPx = (ukuran * LEBAR) / TINGGI;
  const aura = skin.efek === 'aura' || skin.efek === 'kilau' || skin.efek === 'api' || skin.efek === 'es';
  const warnaAura = skin.efek === 'api' ? '#fb923c' : skin.efek === 'es' ? '#a5f3fc' : skin.colors.secondary;

  return (
    <div className={`relative inline-block ${className}`} style={{ width: lebarPx, height: ukuran }}>
      {aura && (
        <div
          className="absolute inset-0 rounded-full animate-aura pointer-events-none"
          style={{ background: `radial-gradient(circle at 50% 60%, ${warnaAura}55 0%, transparent 65%)`, transform: 'scale(1.6)' }}
        />
      )}
      {skin.efek === 'kilau' && [0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="absolute w-1.5 h-1.5 bg-white animate-sparkle pointer-events-none"
          style={{ left: `${15 + i * 22}%`, top: `${10 + ((i * 37) % 60)}%`, animationDelay: `${i * 0.3}s` }}
        />
      ))}
      {skin.efek === 'bayangan' && (
        <svg viewBox={`0 0 ${LEBAR} ${TINGGI}`} className="absolute inset-0 opacity-30" style={{ transform: `translate(-3px, 2px) ${hadap === 'left' ? 'scaleX(-1)' : ''}`, width: lebarPx, height: ukuran }} shapeRendering="crispEdges">
          {lapisan.depan.map((k, i) => <rect key={i} x={k.x} y={k.y} width={k.w} height={1} fill="#000" />)}
        </svg>
      )}
      <svg
        viewBox={`0 0 ${LEBAR} ${TINGGI}`}
        width={lebarPx}
        height={ukuran}
        shapeRendering="crispEdges"
        className="relative block"
        style={{ imageRendering: 'pixelated', transform: hadap === 'left' ? 'scaleX(-1)' : undefined, filter: aura ? `drop-shadow(0 0 3px ${warnaAura})` : undefined }}
      >
        {lapisan.belakang.map((k, i) => <rect key={`b${i}`} x={k.x} y={k.y} width={k.w} height={1} fill={k.fill} />)}
        {lapisan.depan.map((k, i) => <rect key={`d${i}`} x={k.x} y={k.y} width={k.w} height={1} fill={k.fill} />)}
      </svg>
    </div>
  );
};
