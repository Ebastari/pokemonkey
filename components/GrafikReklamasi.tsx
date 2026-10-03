import React, { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { ha, ringkasRevegetasi, totalTahun } from '../lib/revegetasi';
import { SUMBER_REVEGETASI, barisGrafik, kegiatanRevegetasi, muatRevegetasi, revegetasiTersimpan } from '../lib/revegetasi-muat';
import type { BlokGrafik, TampilGrafik } from '../server/src/memo-blok';

/**
 * Blok grafik realisasi reklamasi di memo — tampilannya sama dengan slide
 * Monkey Point (ModalMonkeyPoint): kartu putih berbingkai hitam dengan bayangan
 * piksel, kotak angka, batang bertumpuk APL + Hutan (PPKH) per tahun, dan batang
 * mendatar per jenis kegiatan / per blok. Data selalu terbaru dari /api/revegetasi;
 * saat server tak terjangkau memakai salinan lokal (sama dengan Monkey Point).
 */

const LABEL_TAMPIL: Record<TampilGrafik, string> = { tahun: 'Per tahun', kegiatan: 'Per kegiatan', blok: 'Per blok', lengkap: 'Lengkap' };

const PanelBatang: React.FC<{ judul: string; isi: [string, number][]; warnaBatang: string; warnaJudul: string }> = ({ judul, isi, warnaBatang, warnaJudul }) => {
  const maks = Math.max(...isi.map(([, n]) => n), 0.001);
  return (
    <div className="bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0f172a] p-3">
      <p className={`font-title text-[10px] mb-2 ${warnaJudul}`}>{judul}</p>
      <div className="space-y-1.5">
        {isi.map(([nama, n]) => (
          <div key={nama} className="flex items-center gap-2">
            <span className="w-28 shrink-0 font-bold text-slate-800 text-[11px] truncate">{nama}</span>
            <div className="flex-1 flex items-center gap-1.5 min-w-0">
              <div className={`h-3.5 border border-slate-900 ${warnaBatang}`} style={{ width: `${Math.max(0, (n / maks) * 75)}%` }} />
              <span className="text-[10px] font-bold text-slate-700 tabular-nums shrink-0">{ha(n)} ha</span>
            </div>
          </div>
        ))}
        {isi.length === 0 && <p className="text-slate-500 text-[11px]">Belum ada data.</p>}
      </div>
    </div>
  );
};

export const GrafikReklamasi: React.FC<{ blok: BlokGrafik; onUbah?: (g: BlokGrafik) => void }> = ({ blok, onUbah }) => {
  const [data, setData] = useState(revegetasiTersimpan);
  useEffect(() => {
    if (data) return;
    let hidup = true;
    void muatRevegetasi().then((h) => { if (hidup) setData(h); });
    return () => { hidup = false; };
  }, [data]);

  const semuaTahun = (data?.baris ?? []).map((b) => b.tahun).sort((a, b) => a - b);
  const baris = barisGrafik(data?.baris ?? [], blok);
  const r = ringkasRevegetasi(baris);
  const tampilTahun = blok.tampil === 'tahun' || blok.tampil === 'lengkap';
  const tampilRincian = blok.tampil !== 'tahun';
  const rentang = baris.length ? `${baris[0].tahun}–${baris[baris.length - 1].tahun}` : '';
  const sumber = SUMBER_REVEGETASI(Boolean(data?.cadangan));

  return (
    <div className="my-2 bg-[#f8fafc] border-2 border-slate-900 shadow-[4px_4px_0_#0f172a] p-3 text-slate-900 font-body" contentEditable={false}>
      {onUbah && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-2 border-b border-slate-300 text-[11px]" data-sunting>
          <BarChart3 size={13} className="text-emerald-800" />
          <select value={blok.tampil} onChange={(e) => onUbah({ ...blok, tampil: e.target.value as TampilGrafik })} className="border border-slate-400 bg-white px-1 py-0.5 text-slate-800" aria-label="Jenis grafik">
            {(Object.keys(LABEL_TAMPIL) as TampilGrafik[]).map((t) => <option key={t} value={t}>{LABEL_TAMPIL[t]}</option>)}
          </select>
          <span className="text-slate-500">tahun</span>
          <select value={blok.dari ?? ''} onChange={(e) => onUbah({ ...blok, dari: Number(e.target.value) || undefined })} className="border border-slate-400 bg-white px-1 py-0.5 text-slate-800" aria-label="Dari tahun">
            <option value="">awal</option>{semuaTahun.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-slate-500">–</span>
          <select value={blok.sampai ?? ''} onChange={(e) => onUbah({ ...blok, sampai: Number(e.target.value) || undefined })} className="border border-slate-400 bg-white px-1 py-0.5 text-slate-800" aria-label="Sampai tahun">
            <option value="">akhir</option>{semuaTahun.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      <div className="pb-2 border-b-2 border-emerald-700 mb-3">
        <h3 className="text-xs md:text-[13px] font-title text-emerald-950 leading-tight">{tampilTahun ? 'REALISASI PROGRES REKLAMASI' : 'RINCIAN REALISASI REKLAMASI'}</h3>
        <p className="text-[12px] text-slate-600 mt-0.5">
          {!data ? 'Memuat data realisasi…'
            : !baris.length ? 'Data realisasi tidak tersedia untuk rentang ini'
              : tampilTahun ? `Per tahun ${rentang}, status kawasan APL dan Hutan (PPKH)` : `Akumulasi ${rentang} · per jenis kegiatan dan per blok`}
        </p>
      </div>

      {tampilTahun && baris.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 text-xs">
          <div className="sm:w-44 shrink-0 grid grid-cols-2 sm:grid-cols-1 gap-2">
            {([
              ['TOTAL REALISASI', r.total, 'text-emerald-900', 'border-slate-900'],
              ['KAWASAN APL', r.apl, 'text-green-600', 'border-slate-900'],
              ['KAWASAN HUTAN (PPKH)', r.hutan, 'text-emerald-800', 'border-slate-900'],
            ] as const).map(([label, n, warnaTeks, garis]) => (
              <div key={label} className={`bg-white border-2 ${garis} shadow-[3px_3px_0_#0f172a] px-2 py-1.5`}>
                <p className="text-[10px] font-bold text-slate-500">{label}</p>
                <p className={`font-title text-[11px] ${warnaTeks}`}>{ha(n)} HA</p>
              </div>
            ))}
            {r.terakhir && (
              <div className="bg-white border-2 border-amber-700 shadow-[3px_3px_0_#0f172a] px-2 py-1.5">
                <p className="text-[10px] font-bold text-slate-500">TAHUN {r.terakhir.tahun}</p>
                <p className="font-title text-[11px] text-amber-800">{ha(totalTahun(r.terakhir))} HA</p>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-700 mb-1">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-600 border border-slate-900" /> APL</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-800 border border-slate-900" /> Hutan (PPKH)</span>
            </div>
            <div className="flex items-end gap-1 h-52 border-b-2 border-slate-900">
              {baris.map((b) => {
                const skala = 88 / (r.maks || 1);
                return (
                  <div key={b.tahun} className="flex-1 h-full flex flex-col justify-end items-center min-w-0">
                    <span className="text-[9px] font-bold text-slate-800 mb-0.5 tabular-nums">{ha(totalTahun(b))}</span>
                    <div className="w-3/5 bg-emerald-800 border border-slate-900" style={{ height: `${b.hutan * skala}%` }} />
                    <div className="w-3/5 bg-green-600 border border-slate-900 border-t-0" style={{ height: `${b.apl * skala}%` }} />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-1">
              {baris.map((b) => <span key={b.tahun} className="flex-1 text-center font-title text-[7px] text-slate-700">{b.tahun}</span>)}
            </div>
          </div>
        </div>
      )}

      {tampilRincian && baris.length > 0 && (
        <div className={`grid gap-4 text-xs ${blok.tampil === 'lengkap' ? 'sm:grid-cols-2 mt-4' : ''}`}>
          {(blok.tampil === 'kegiatan' || blok.tampil === 'lengkap') && (
            <PanelBatang judul="PER JENIS KEGIATAN" isi={kegiatanRevegetasi(baris)} warnaBatang="bg-amber-600" warnaJudul="text-amber-800" />
          )}
          {(blok.tampil === 'blok' || blok.tampil === 'lengkap') && (
            <PanelBatang judul="PER BLOK" isi={r.perBlok.map((b) => [b.nama, b.luas] as [string, number])} warnaBatang="bg-sky-600" warnaJudul="text-sky-800" />
          )}
        </div>
      )}

      {data && <p className="text-[10px] text-slate-500 text-right mt-2">{sumber}</p>}
    </div>
  );
};
