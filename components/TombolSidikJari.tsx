import React from 'react';

/**
 * Tombol sidik jari bergaya konsol 90-an: sidik jari piksel di dalam bantalan
 * pemindai, garis pindai naik-turun, dan tulisan kedip "PRESS".
 * `redup` untuk perangkat yang belum bisa/belum mengaktifkan sidik jari.
 */

// 15 × 16 piksel; '#' = piksel menyala.
const POLA = [
  '.....#####.....',
  '...##.....##...',
  '..#..#####..#..',
  '.#..#.....#..#.',
  '.#.#..###..#.#.',
  '#..#.#...#.#..#',
  '#.#..#.#.#..#.#',
  '#.#.#..#..#.#.#',
  '#.#.#.##..#.#.#',
  '#.#.#.#..#..#.#',
  '..#.#.#.#..#..#',
  '.#..#.#.#.#..#.',
  '.#.#..#.#.#.#..',
  '...#.#..#..#...',
  '..#..#.#..#....',
  '....#..#.#.....',
];

const PIKSEL = POLA.flatMap((baris, y) =>
  [...baris].flatMap((c, x) => (c === '#' ? [{ x, y }] : [])),
);

interface Props {
  onClick: () => void;
  keterangan: string;
  redup?: boolean;
  sibuk?: boolean;
  besar?: boolean;
}

export const TombolSidikJari: React.FC<Props> = ({ onClick, keterangan, redup, sibuk, besar }) => {
  const sisi = besar ? 'w-28 h-28' : 'w-[88px] h-[88px]';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={sibuk}
      aria-label="Masuk dengan sidik jari"
      className={`group flex flex-col items-center gap-2 mx-auto select-none ${redup ? 'opacity-55' : ''}`}
    >
      <span className={`relative ${sisi} bg-[#18181b] border-[3px] border-black shadow-[4px_4px_0_#000] group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:shadow-none transition-transform overflow-hidden`}>
        {/* Bingkai dalam bantalan pemindai */}
        <span className="absolute inset-[5px] border-2 border-yellow-500/70 bg-[#0d1a12]" />
        <svg viewBox="-2 -2 19 20" className="absolute inset-[9px] w-[calc(100%-18px)] h-[calc(100%-18px)]" shapeRendering="crispEdges" aria-hidden="true">
          {PIKSEL.map(({ x, y }) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" className={redup ? 'fill-zinc-500' : 'fill-emerald-400'} />
          ))}
        </svg>
        {!redup && <span className={`absolute inset-x-[7px] h-[3px] bg-emerald-300/80 pindai-sidik ${sibuk ? '!animate-none top-1/2' : ''}`} />}
        {/* Garis layar CRT */}
        <span className="absolute inset-0 garis-crt pointer-events-none" />
      </span>
      <span className="font-title text-[9px] text-yellow-400 tracking-wider">
        {sibuk ? 'MEMINDAI…' : <><span className="kedip-press">▶ PRESS</span></>}
      </span>
      <span className="text-[11.5px] text-zinc-400 leading-tight text-center max-w-[220px]">{keterangan}</span>
    </button>
  );
};
