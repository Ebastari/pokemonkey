import React, { useEffect, useMemo, useState } from 'react';
import type { Libur } from '../lib/libur';
import { type Acara, kelasAcara, susunMinggu, gridBulanSenin, HARI_SENIN_PANJANG, padaTanggal } from '../lib/acara';

/**
 * Tampilan bulan ala Google Calendar: tiap baris satu minggu, acara multi-hari
 * menjadi bar yang menyambung, "+N" bila satu tanggal terlalu penuh.
 * Tanggal merah (Minggu & libur) diberi angka merah, khas kalender Indonesia.
 */

interface Props {
  tahun: number;
  bulan: number;                // 0..11
  hariIni: string;
  tanggalPilih: string;
  acara: Acara[];
  libur: Map<string, Libur[]>;
  onPilihHari: (t: string) => void;
  onBukaAcara: (a: Acara) => void;
  onTambah?: (t: string) => void;
}

const TINGGI_BAR = 17;
const TINGGI_ANGKA = 22;

export const KalenderBulan: React.FC<Props> = ({ tahun, bulan, hariIni, tanggalPilih, acara, libur, onPilihHari, onBukaAcara, onTambah }) => {
  const [sempit, setSempit] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const cek = () => setSempit(window.innerWidth < 768);
    window.addEventListener('resize', cek);
    return () => window.removeEventListener('resize', cek);
  }, []);

  const maksLajur = sempit ? 3 : 4;
  const minggu = useMemo(() => gridBulanSenin(tahun, bulan), [tahun, bulan]);
  const kodeBulan = `${tahun}-${String(bulan + 1).padStart(2, '0')}`;

  return (
    <div className="flex flex-col h-full min-h-0 border-[3px] border-white/40 bg-black/70">
      <div className="grid grid-cols-7 border-b-2 border-white/25 shrink-0">
        {HARI_SENIN_PANJANG.map((h, i) => (
          <div key={h} className={`text-center py-1 text-[11px] font-bold uppercase ${i === 6 ? 'text-red-400' : 'text-zinc-300'}`}>{h}</div>
        ))}
      </div>

      <div className="flex-1 grid min-h-0 overflow-auto custom-scrollbar" style={{ gridTemplateRows: `repeat(${minggu.length}, minmax(${TINGGI_ANGKA + (maksLajur + 1) * TINGGI_BAR + 4}px, 1fr))` }}>
        {minggu.map((baris) => {
          const bars = susunMinggu(baris, acara);
          const terlihat = bars.filter((b) => b.lajur < maksLajur);
          const tersembunyi = baris.map((t) => acara.filter((a) => padaTanggal(a, t)).length - terlihat.filter((b) => padaTanggal(b.a, t)).length);

          return (
            <div key={baris[0]} className="relative border-b border-white/15 last:border-b-0">
              {/* Latar sel + angka tanggal */}
              <div className="absolute inset-0 grid grid-cols-7">
                {baris.map((t, i) => {
                  const diBulan = t.startsWith(kodeBulan);
                  const merah = i === 6 || libur.get(t)?.some((l) => l.jenis === 'nasional');
                  const cuti = libur.get(t)?.some((l) => l.jenis === 'cuti');
                  return (
                    <button
                      key={t}
                      onClick={() => onPilihHari(t)}
                      onDoubleClick={() => onTambah?.(t)}
                      title={libur.get(t)?.map((l) => l.nama).join(' · ')}
                      className={`relative text-left border-l border-white/10 first:border-l-0 transition-colors hover:bg-white/5 ${diBulan ? '' : 'bg-white/[0.03]'} ${t === tanggalPilih ? 'bg-cyan-500/10' : ''} ${merah && diBulan ? 'bg-red-500/[0.06]' : ''}`}
                    >
                      <span className={`absolute top-0.5 left-1 text-[13px] font-bold leading-none px-1 py-0.5 ${
                        t === hariIni ? 'bg-cyan-400 text-black'
                          : !diBulan ? 'text-zinc-600'
                          : merah ? 'text-red-400'
                          : cuti ? 'text-rose-300'
                          : 'text-zinc-100'
                      }`}>
                        {+t.slice(8)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Bar acara */}
              <div className="absolute inset-x-0 bottom-0 grid grid-cols-7 pointer-events-none px-px" style={{ top: TINGGI_ANGKA, gridAutoRows: TINGGI_BAR, rowGap: 1 }}>
                {terlihat.map((b) => (
                  <button
                    key={`${b.a.kunci}-${baris[0]}`}
                    onClick={(e) => { e.stopPropagation(); onBukaAcara(b.a); }}
                    title={b.a.judul}
                    className={`pointer-events-auto text-left text-[11px] leading-none truncate px-1 border-l-[3px] mx-px ${kelasAcara(b.a)} ${b.a.selesaiDitandai ? 'opacity-50 line-through' : ''} ${b.lanjutKiri ? '!border-l-0 pl-1.5' : ''}`}
                    style={{ gridColumn: `${b.kolom + 1} / span ${b.rentang}`, gridRow: b.lajur + 1 }}
                  >
                    {b.lanjutKiri && '‹ '}
                    {!sempit && b.a.mulai !== null && b.rentang === 1 && <span className="opacity-75 mr-1">{String(Math.floor(b.a.mulai / 60)).padStart(2, '0')}.{String(b.a.mulai % 60).padStart(2, '0')}</span>}
                    {b.a.judul}
                    {b.lanjutKanan && ' ›'}
                  </button>
                ))}
                {tersembunyi.map((n, i) => n > 0 && (
                  <button
                    key={`lebih-${baris[i]}`}
                    onClick={(e) => { e.stopPropagation(); onPilihHari(baris[i]); }}
                    className="pointer-events-auto text-left text-[11px] font-bold text-zinc-300 hover:text-white px-1 leading-none"
                    style={{ gridColumn: i + 1, gridRow: maksLajur + 1 }}
                  >
                    +{n} lagi
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
