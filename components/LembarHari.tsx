import React from 'react';
import { ChevronLeft, ChevronRight, X, Plus, Flag, Users, Clock, Sun } from 'lucide-react';
import { type Acara, kelasAcara, sepanjangHari, urutkan } from '../lib/acara';
import { LABEL_JENIS, type Libur } from '../lib/libur';
import * as W from '../lib/waktu';
import { namaDepan } from '../lib/nama';

/**
 * "Hari ini ada apa?" — lembar satu tanggal: libur, siapa yang tidak masuk
 * (dari roster), acara sepanjang hari, lalu acara berjam berurutan.
 * Di ponsel muncul dari bawah; di komputer sebagai jendela tengah.
 */

export interface StatusTim { nama: string; label: string; kode: string }

interface Props {
  tanggal: string;
  hariIni: string;
  acara: Acara[];
  libur: Libur[];
  tim?: StatusTim[];
  bacaSaja?: boolean;
  onGeser: (n: number) => void;
  onTutup: () => void;
  onTambah?: (t: string) => void;
  onBukaAcara: (a: Acara) => void;
}

const jam = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const LembarHari: React.FC<Props> = ({ tanggal, hariIni, acara, libur, tim, bacaSaja, onGeser, onTutup, onTambah, onBukaAcara }) => {
  const daftar = [...acara].filter((a) => a.sumber !== 'libur').sort(urutkan);
  const seharian = daftar.filter(sepanjangHari);
  const berjam = daftar.filter((a) => !sepanjangHari(a));
  const tidakMasuk = (tim ?? []).filter((s) => !['M', 'S1', 'S2'].includes(s.kode));
  const masuk = (tim ?? []).filter((s) => ['M', 'S1', 'S2'].includes(s.kode));
  const selisih = W.selisihHari(tanggal, hariIni);
  const keterangan = selisih === 0 ? 'Hari ini' : selisih === 1 ? 'Besok' : selisih === -1 ? 'Kemarin' : selisih > 0 ? `${selisih} hari lagi` : `${-selisih} hari lalu`;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-end md:items-center justify-center md:p-4" onClick={onTutup}>
      <div className="retro-box !bg-zinc-900 border-cyan-500 w-full md:max-w-md max-h-[85vh] flex flex-col !p-0" onClick={(e) => e.stopPropagation()}>
        {/* Kepala */}
        <div className="flex items-center gap-1.5 p-3 border-b-2 border-white/20 shrink-0">
          <button onClick={() => onGeser(-1)} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Hari sebelumnya"><ChevronLeft size={16} /></button>
          <div className="flex-1 min-w-0 text-center leading-tight">
            <p className="text-[16px] font-bold text-white">{W.formatPanjang(tanggal)}</p>
            <p className={`text-[12px] ${selisih === 0 ? 'text-cyan-300' : 'text-zinc-400'}`}>{keterangan} · {daftar.length} acara</p>
          </div>
          <button onClick={() => onGeser(1)} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Hari berikutnya"><ChevronRight size={16} /></button>
          <button onClick={onTutup} className="text-zinc-400 hover:text-white ml-1" aria-label="Tutup"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-3 space-y-3">
          {libur.map((l) => (
            <div key={l.nama} className={`flex items-start gap-2 p-2 border-l-4 ${l.jenis === 'nasional' ? 'bg-red-950/60 border-red-400' : l.jenis === 'cuti' ? 'bg-rose-950/50 border-rose-400' : 'bg-purple-950/50 border-purple-400'}`}>
              <Flag size={14} className="mt-0.5 shrink-0 text-red-300" />
              <div className="leading-tight">
                <p className="text-[14px] font-bold text-white">{l.nama}</p>
                <p className="text-[11px] text-zinc-300 uppercase">{LABEL_JENIS[l.jenis]}{l.perkiraan ? ' · tanggal masih perkiraan' : ''}</p>
              </div>
            </div>
          ))}

          {tim && tim.length > 0 && (
            <div className="panel-retro !p-2">
              <p className="label-retro flex items-center gap-1"><Users size={11} /> Tim</p>
              {tidakMasuk.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {tidakMasuk.map((s) => <span key={s.nama} className="chip-retro border-amber-400 bg-amber-950/50 text-amber-200 normal-case">{namaDepan(s.nama)} · {s.label}</span>)}
                </div>
              )}
              <p className="text-[12px] text-zinc-300">
                {masuk.length ? `Masuk: ${masuk.map((s) => `${namaDepan(s.nama)}${s.kode !== 'M' ? ` (${s.kode})` : ''}`).join(', ')}` : 'Belum ada yang dijadwalkan masuk.'}
              </p>
            </div>
          )}

          {seharian.length > 0 && (
            <div className="space-y-1">
              <p className="label-retro flex items-center gap-1"><Sun size={11} /> Sepanjang hari</p>
              {seharian.map((a) => (
                <button key={a.kunci} onClick={() => onBukaAcara(a)} className={`w-full text-left border-l-4 px-2 py-1.5 ${kelasAcara(a)} ${a.selesaiDitandai ? 'opacity-50' : ''}`}>
                  <p className={`text-[14px] font-bold leading-snug ${a.selesaiDitandai ? 'line-through' : ''}`}>{a.judul}</p>
                  <p className="text-[11px] opacity-80">
                    {a.mulaiTgl !== a.selesaiTgl ? `${W.formatPendek(a.mulaiTgl)} – ${W.formatPendek(a.selesaiTgl)} · hari ke-${W.selisihHari(tanggal, a.mulaiTgl) + 1} dari ${W.selisihHari(a.selesaiTgl, a.mulaiTgl) + 1}` : a.tenggat ? (a.telat ? 'Tenggat PICA · lewat' : 'Tenggat PICA') : 'Sepanjang hari'}
                    {a.sub ? ` · ${a.sub}` : ''}
                  </p>
                </button>
              ))}
            </div>
          )}

          {berjam.length > 0 && (
            <div className="space-y-1">
              <p className="label-retro flex items-center gap-1"><Clock size={11} /> Berjam (WITA)</p>
              {berjam.map((a) => (
                <button key={a.kunci} onClick={() => onBukaAcara(a)} className="w-full flex items-stretch gap-2 text-left group">
                  <div className="w-12 shrink-0 text-right leading-tight pt-1">
                    <p className="text-[13px] font-bold text-white">{jam(a.mulai!)}</p>
                    <p className="text-[11px] text-zinc-500">{jam(a.selesai!)}</p>
                  </div>
                  <div className={`flex-1 border-l-4 px-2 py-1.5 group-hover:brightness-125 ${kelasAcara(a)} ${a.selesaiDitandai ? 'opacity-50' : ''}`}>
                    <p className={`text-[14px] font-bold leading-snug ${a.selesaiDitandai ? 'line-through' : ''}`}>{a.judul}</p>
                    {(a.sub || a.jadwal?.keterangan) && <p className="text-[11px] opacity-80 truncate">{[a.sub, a.jadwal?.keterangan].filter(Boolean).join(' · ')}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {daftar.length === 0 && libur.length === 0 && (
            <p className="text-[13px] text-zinc-400 text-center py-6">Tidak ada jadwal. Hari yang lega.</p>
          )}
        </div>

        {!bacaSaja && onTambah && (
          <div className="p-3 border-t-2 border-white/20 shrink-0">
            <button onClick={() => onTambah(tanggal)} className="btn-retro bg-cyan-600 w-full"><Plus size={16} /> Tambah jadwal di tanggal ini</button>
          </div>
        )}
      </div>
    </div>
  );
};
