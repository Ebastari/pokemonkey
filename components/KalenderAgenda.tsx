import React, { useMemo } from 'react';
import { Flag } from 'lucide-react';
import { type Acara, kelasAcara, padaTanggal, sepanjangHari, urutkan } from '../lib/acara';
import * as W from '../lib/waktu';

/**
 * Agenda: daftar hari-hari yang punya acara, mulai dari tanggal terpilih.
 * Cara tercepat menjawab "minggu ini ada apa saja" di ponsel.
 */

interface Props {
  acara: Acara[];
  dari: string;
  hariIni: string;
  jumlahHari?: number;
  onPilihHari: (t: string) => void;
  onBukaAcara: (a: Acara) => void;
}

const jam = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const KalenderAgenda: React.FC<Props> = ({ acara, dari, hariIni, jumlahHari = 45, onPilihHari, onBukaAcara }) => {
  const kelompok = useMemo(() => {
    const hasil: { tanggal: string; isi: Acara[] }[] = [];
    for (let i = 0; i < jumlahHari; i++) {
      const t = W.geserHari(dari, i);
      const isi = acara.filter((a) => padaTanggal(a, t)).sort(urutkan);
      if (isi.length) hasil.push({ tanggal: t, isi });
    }
    return hasil;
  }, [acara, dari, jumlahHari]);

  if (kelompok.length === 0) {
    return <p className="text-[13px] text-zinc-400 text-center py-10">Tidak ada acara dalam {jumlahHari} hari ke depan.</p>;
  }

  return (
    <div className="h-full overflow-auto custom-scrollbar border-[3px] border-white/40 bg-black/70 p-2 space-y-3">
      {kelompok.map(({ tanggal, isi }) => {
        const liburNasional = isi.some((a) => a.libur?.jenis === 'nasional');
        const merah = W.hariKe(tanggal) === 0 || liburNasional;
        const ini = tanggal === hariIni;
        return (
          <section key={tanggal} className="flex gap-2">
            <button onClick={() => onPilihHari(tanggal)} className="w-12 shrink-0 text-center leading-tight pt-0.5">
              <div className={`text-[11px] uppercase ${merah ? 'text-red-400' : 'text-zinc-400'}`}>{W.NAMA_HARI[W.hariKe(tanggal)]}</div>
              <div className={`text-[20px] font-bold inline-block px-1.5 ${ini ? 'bg-cyan-400 text-black' : merah ? 'text-red-400' : 'text-white'}`}>{+tanggal.slice(8)}</div>
              <div className="text-[10px] text-zinc-500 uppercase">{W.NAMA_BULAN_PENDEK[+tanggal.slice(5, 7) - 1]}</div>
            </button>
            <div className="flex-1 min-w-0 space-y-1">
              {isi.map((a) => (
                <button key={`${a.kunci}-${tanggal}`} onClick={() => onBukaAcara(a)} className={`w-full text-left border-l-4 px-2 py-1.5 ${kelasAcara(a)} ${a.selesaiDitandai ? 'opacity-50' : ''}`}>
                  <p className={`text-[14px] font-bold leading-snug flex items-center gap-1 ${a.selesaiDitandai ? 'line-through' : ''}`}>
                    {a.libur && <Flag size={12} className="shrink-0" />}
                    <span className="truncate">{a.judul}</span>
                  </p>
                  <p className="text-[11px] opacity-80 truncate">
                    {a.libur ? (a.libur.jenis === 'cuti' ? 'Cuti bersama' : a.libur.jenis === 'perusahaan' ? 'Libur perusahaan' : 'Libur nasional')
                      : a.mulaiTgl !== a.selesaiTgl ? `Hari ${W.selisihHari(tanggal, a.mulaiTgl) + 1}/${W.selisihHari(a.selesaiTgl, a.mulaiTgl) + 1} · s/d ${W.formatPendek(a.selesaiTgl)}`
                        : sepanjangHari(a) ? (a.tenggat ? 'Tenggat PICA' : 'Sepanjang hari')
                          : `${jam(a.mulai!)}–${jam(a.selesai!)}`}
                    {a.sub ? ` · ${a.sub}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
