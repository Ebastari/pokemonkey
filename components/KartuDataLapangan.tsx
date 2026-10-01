import React, { useEffect, useState, useCallback } from 'react';
import {
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock, Filter,
  Flame, Info, Loader2, Lock, MapPin, RefreshCw, Sprout, Trees, Unlock, X,
} from 'lucide-react';
import type { BlokData, InfoBekuData } from '../server/src/memo-blok';
import type { HasilNursery, HasilGeotag } from '../lib/tipe-lapangan';
import { api } from '../lib/api';

interface Props {
  blok: BlokData;
  onUbah?: (baru: BlokData) => void;
  bolehUbah?: boolean;
}

export const KartuDataLapangan: React.FC<Props> = ({ blok, onUbah, bolehUbah }) => {
  const [dataNursery, setDataNursery] = useState<HasilNursery | null>(
    blok.sumber === 'nursery' && blok.beku ? ({ ok: true, ringkasan: blok.beku.ringkasan, diambil: blok.beku.pada, sumber: 'd1' } as any) : null
  );
  const [dataGeotag, setDataGeotag] = useState<HasilGeotag | null>(
    blok.sumber === 'geotag' && blok.beku ? ({ ok: true, ringkasan: blok.beku.ringkasan, karbon: blok.beku.karbon, diambil: blok.beku.pada, sumber: 'd1' } as any) : null
  );
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [bukaDetail, setBukaDetail] = useState(false);
  const [bukaBatas, setBukaBatas] = useState(false);
  const [bukaSaring, setBukaSaring] = useState(false);

  // Form saringan modal
  const [filterForm, setFilterForm] = useState<Record<string, string>>({ ...blok.saring });

  const muatData = useCallback(async (paksaSegar = false) => {
    if (blok.beku && !paksaSegar) return; // Mode beku tidak menembak API

    setMemuat(true);
    setGalat(null);

    const saring = blok.saring || {};
    const params = new URLSearchParams();
    Object.entries(saring).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    if (paksaSegar) params.set('segar', '1');

    try {
      if (blok.sumber === 'nursery') {
        const res = await api<HasilNursery>(`/api/lapangan/nursery?${params.toString()}`);
        if (res && res.ok) setDataNursery(res);
      } else {
        const res = await api<HasilGeotag>(`/api/lapangan/geotag?${params.toString()}`);
        if (res && res.ok) setDataGeotag(res);
      }
    } catch (err: any) {
      setGalat(err?.message || 'Gagal memuat data lapangan.');
    } finally {
      setMemuat(false);
    }
  }, [blok.sumber, blok.saring, blok.beku]);

  useEffect(() => {
    muatData(false);
  }, [muatData]);

  // Aksi bekukan angka
  const bekukan = () => {
    if (!onUbah) return;
    const waktuSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WITA';
    const tanggalSekarang = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const capWaktu = `${tanggalSekarang} ${waktuSekarang}`;

    let infoBeku: InfoBekuData;
    if (blok.sumber === 'nursery' && dataNursery) {
      infoBeku = {
        pada: capWaktu,
        ringkasan: dataNursery.ringkasan,
      };
    } else if (blok.sumber === 'geotag' && dataGeotag) {
      infoBeku = {
        pada: capWaktu,
        ringkasan: dataGeotag.ringkasan,
        karbon: dataGeotag.karbon,
      };
    } else {
      return;
    }

    onUbah({
      ...blok,
      beku: infoBeku,
    });
  };

  // Aksi cairkan angka (kembali live)
  const cairkan = () => {
    if (!onUbah) return;
    const baru = { ...blok };
    delete baru.beku;
    onUbah(baru);
  };

  // Simpan saringan baru
  const terapkanSaringan = () => {
    if (!onUbah) return;
    const bersih: Record<string, string> = {};
    Object.entries(filterForm).forEach(([k, v]) => {
      const trim = v.trim();
      if (trim) bersih[k] = trim;
    });
    const baru = { ...blok, saring: bersih };
    delete baru.beku; // Reset beku saat saringan diubah
    onUbah(baru);
    setBukaSaring(false);
  };

  const hapusSaringan = (kunci: string) => {
    if (!onUbah) return;
    const baruSaring = { ...blok.saring };
    delete baruSaring[kunci];
    const baru = { ...blok, saring: baruSaring };
    delete baru.beku;
    onUbah(baru);
  };

  const isBeku = Boolean(blok.beku);
  const waktuAmbil = blok.beku?.pada || (blok.sumber === 'nursery' ? dataNursery?.diambil : dataGeotag?.diambil) || '';

  return (
    <div className="my-3 border-2 border-white/20 bg-zinc-950/90 text-zinc-100 shadow-[3px_3px_0_#000] overflow-hidden">
      {/* Bilah Kepala Kartu */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-white/5 border-b border-white/10 text-xs font-bold">
        <div className="flex items-center gap-2">
          {blok.sumber === 'nursery' ? (
            <span className="flex items-center gap-1.5 text-lime-400 font-pixel tracking-wider text-sm">
              <Sprout size={16} /> SMART NURSERY
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sky-400 font-pixel tracking-wider text-sm">
              <Trees size={16} /> GEOTAGGING REKLAMASI
            </span>
          )}

          {isBeku ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-amber-400/50 bg-amber-950/40 text-amber-300 text-[11px]">
              <Lock size={10} /> Beku ({blok.beku?.pada})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-lime-500/50 bg-lime-950/40 text-lime-300 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" /> Live {waktuAmbil ? `· ${waktuAmbil}` : ''}
            </span>
          )}
        </div>

        {/* Tombol Kontrol */}
        <div className="flex items-center gap-1">
          {bolehUbah && (
            <button
              type="button"
              onClick={() => {
                setFilterForm({ ...blok.saring });
                setBukaSaring(true);
              }}
              className="px-2 py-1 border border-white/20 hover:border-lime-400 bg-white/5 hover:bg-white/10 text-[11px] flex items-center gap-1 transition-colors"
              title="Saring data"
            >
              <Filter size={11} /> Saring {Object.keys(blok.saring || {}).length > 0 && `(${Object.keys(blok.saring).length})`}
            </button>
          )}

          {!isBeku && (
            <button
              type="button"
              onClick={() => muatData(true)}
              disabled={memuat}
              className="px-2 py-1 border border-white/20 hover:border-lime-400 bg-white/5 hover:bg-white/10 text-[11px] flex items-center gap-1 transition-colors"
              title="Segarkan data terbaru"
            >
              <RefreshCw size={11} className={memuat ? 'animate-spin' : ''} /> Segarkan
            </button>
          )}

          {bolehUbah && (
            isBeku ? (
              <button
                type="button"
                onClick={cairkan}
                className="px-2 py-1 border border-amber-400/60 hover:border-amber-300 bg-amber-950/40 text-amber-200 text-[11px] flex items-center gap-1 transition-colors"
                title="Cairkan (kembali live & selalu terbaru)"
              >
                <Unlock size={11} /> Cairkan
              </button>
            ) : (
              <button
                type="button"
                onClick={bekukan}
                className="px-2 py-1 border border-white/20 hover:border-white/40 bg-white/5 text-[11px] flex items-center gap-1 transition-colors text-zinc-300"
                title="Bekukan angka laporan saat ini"
              >
                <Lock size={11} /> Bekukan
              </button>
            )
          )}
        </div>
      </div>

      {/* Chip Saringan Aktif */}
      {Object.keys(blok.saring || {}).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 bg-black/40 border-b border-white/10 text-[11px]">
          <span className="text-zinc-500">Saringan:</span>
          {Object.entries(blok.saring).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-zinc-700 bg-zinc-900 text-zinc-300">
              <span className="text-zinc-500">{k}:</span> <b>{v}</b>
              {bolehUbah && (
                <button type="button" onClick={() => hapusSaringan(k)} className="hover:text-red-400 ml-0.5">
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Konten Utama */}
      <div className="p-3">
        {memuat && !dataNursery && !dataGeotag && (
          <div className="flex items-center justify-center py-6 text-zinc-400 text-xs gap-2">
            <Loader2 size={16} className="animate-spin text-lime-400" /> Memuat data lapangan...
          </div>
        )}

        {galat && !dataNursery && !dataGeotag && (
          <div className="p-3 border border-red-500/40 bg-red-950/30 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span>{galat}</span>
            <button type="button" onClick={() => muatData(true)} className="ml-auto underline text-red-300 hover:text-white">
              Coba lagi
            </button>
          </div>
        )}

        {/* 1. TAMPILAN NURSERY */}
        {blok.sumber === 'nursery' && dataNursery && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {/* Kartu Stok */}
              <div className="p-2.5 border border-lime-500/30 bg-lime-950/20">
                <div className="text-[11px] text-zinc-400">
                  {dataNursery.ringkasan.stok_sahih ? 'Stok Tersedia' : 'Bibit Bersih (Saringan)'}
                </div>
                <div className="text-xl sm:text-2xl font-bold font-pixel text-lime-300 mt-0.5">
                  {dataNursery.ringkasan.stok.toLocaleString('id-ID')} <span className="text-xs font-sans text-zinc-400">btg</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Σ Masuk: {dataNursery.ringkasan.masuk.toLocaleString('id-ID')}
                </div>
              </div>

              {/* Kartu Mortalitas */}
              <div className={`p-2.5 border ${
                dataNursery.ringkasan.mortalitas > 25
                  ? 'border-red-500/40 bg-red-950/20 text-red-300'
                  : dataNursery.ringkasan.mortalitas > 10
                  ? 'border-amber-500/40 bg-amber-950/20 text-amber-300'
                  : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
              }`}>
                <div className="text-[11px] text-zinc-400">Mortalitas Semai</div>
                <div className="text-xl sm:text-2xl font-bold font-pixel mt-0.5">
                  {dataNursery.ringkasan.mortalitas}%
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {dataNursery.ringkasan.mati.toLocaleString('id-ID')} bibit mati
                </div>
              </div>

              {/* Kartu Aktivitas Hari Ini */}
              <div className="p-2.5 border border-white/15 bg-white/5">
                <div className="text-[11px] text-zinc-400">Hari Ini (WITA)</div>
                <div className="text-sm font-bold text-zinc-200 mt-1 flex flex-col gap-0.5">
                  <span className="text-lime-400">+{dataNursery.ringkasan.masuk_hari_ini.toLocaleString('id-ID')} masuk</span>
                  <span className="text-sky-300">-{dataNursery.ringkasan.keluar_hari_ini.toLocaleString('id-ID')} keluar</span>
                </div>
              </div>

              {/* Kartu Proyeksi / Hari Aktif */}
              <div className="p-2.5 border border-white/15 bg-white/5">
                <div className="text-[11px] text-zinc-400">Proyeksi Habis</div>
                {dataNursery.proyeksi.ada ? (
                  <>
                    <div className="text-base font-bold font-pixel text-amber-300 mt-0.5">
                      ±{dataNursery.proyeksi.hari_tersisa} hari
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      Est. {dataNursery.proyeksi.perkiraan_habis}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-zinc-500 italic mt-1">
                    {dataNursery.ringkasan.stok_sahih ? 'Laju stabil' : 'Saringan aktif'}
                  </div>
                )}
              </div>
            </div>

            {/* Tombol Buka Rincian */}
            {dataNursery.jenis && dataNursery.jenis.length > 0 && (
              <button
                type="button"
                onClick={() => setBukaDetail(!bukaDetail)}
                className="w-full py-1.5 px-3 border border-white/10 hover:border-white/30 bg-black/40 text-xs text-zinc-300 flex items-center justify-between transition-colors"
              >
                <span>Rincian Jenis Bibit & Distribusi ({dataNursery.ringkasan.jml_jenis} Jenis)</span>
                {bukaDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}

            {/* Rincian Tabel Jenis & Tujuan */}
            {bukaDetail && dataNursery.jenis && (
              <div className="mt-2 space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/10 text-zinc-300">
                        <th className="p-1.5 border border-white/15">Jenis Bibit</th>
                        <th className="p-1.5 border border-white/15 text-right">Masuk</th>
                        <th className="p-1.5 border border-white/15 text-right">Keluar</th>
                        <th className="p-1.5 border border-white/15 text-right">Mati</th>
                        <th className="p-1.5 border border-white/15 text-right">Sisa Stok</th>
                        <th className="p-1.5 border border-white/15 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataNursery.jenis.map((j) => (
                        <tr key={j.nama} className="hover:bg-white/5">
                          <td className="p-1.5 border border-white/10 font-bold">{j.nama}</td>
                          <td className="p-1.5 border border-white/10 text-right">{j.masuk.toLocaleString('id-ID')}</td>
                          <td className="p-1.5 border border-white/10 text-right">{j.keluar.toLocaleString('id-ID')}</td>
                          <td className="p-1.5 border border-white/10 text-right">{j.mati.toLocaleString('id-ID')}</td>
                          <td className="p-1.5 border border-white/10 text-right font-bold text-lime-400">{j.stok.toLocaleString('id-ID')}</td>
                          <td className="p-1.5 border border-white/10 text-center">
                            <span className={`px-1.5 py-0.5 text-[10px] ${
                              j.status === 'Kritis' ? 'bg-red-950 text-red-300 border border-red-500/40' :
                              j.status === 'Waspada' ? 'bg-amber-950 text-amber-300 border border-amber-500/40' :
                              'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            }`}>
                              {j.status} ({j.mortalitas}%)
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {dataNursery.tujuan && dataNursery.tujuan.length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-bold text-zinc-400 mb-1.5">Top Area Serapan Bibit (Pareto):</div>
                    <div className="flex flex-wrap gap-2">
                      {dataNursery.tujuan.map((t) => (
                        <div key={t.tujuan} className="px-2 py-1 border border-white/15 bg-white/5 text-xs">
                          <span className="font-bold text-zinc-200">{t.tujuan}</span>:{' '}
                          <span className="text-lime-300">{t.total.toLocaleString('id-ID')} btg</span>{' '}
                          <span className="text-zinc-500">({t.persen}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 2. TAMPILAN GEOTAGGING */}
        {blok.sumber === 'geotag' && dataGeotag && (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {/* Kartu Total Pohon */}
              <div className="p-2.5 border border-sky-500/30 bg-sky-950/20">
                <div className="text-[11px] text-zinc-400">Total Sensus</div>
                <div className="text-xl sm:text-2xl font-bold font-pixel text-sky-300 mt-0.5">
                  {dataGeotag.ringkasan.total.toLocaleString('id-ID')} <span className="text-xs font-sans text-zinc-400">titik</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  {dataGeotag.ringkasan.berkoordinat} GPS · {dataGeotag.ringkasan.berfoto} Foto
                </div>
              </div>

              {/* Kartu Persen Hidup */}
              <div className="p-2.5 border border-emerald-500/30 bg-emerald-950/20">
                <div className="text-[11px] text-zinc-400">% Tumbuh / Hidup</div>
                <div className="text-xl sm:text-2xl font-bold font-pixel text-emerald-400 mt-0.5">
                  {dataGeotag.ringkasan.persen_hidup}%
                </div>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {dataGeotag.ringkasan.sehat.toLocaleString('id-ID')} Sehat · {dataGeotag.ringkasan.merana.toLocaleString('id-ID')} Merana
                </div>
              </div>

              {/* Kartu Tinggi Rata-rata */}
              <div className="p-2.5 border border-white/15 bg-white/5">
                <div className="text-[11px] text-zinc-400">Tinggi Rata-rata</div>
                <div className="text-xl sm:text-2xl font-bold font-pixel text-zinc-200 mt-0.5">
                  {dataGeotag.ringkasan.tinggi_avg} <span className="text-xs font-sans text-zinc-400">cm</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">
                  Min {dataGeotag.ringkasan.tinggi_min} - Maks {dataGeotag.ringkasan.tinggi_max} cm
                </div>
              </div>

              {/* Kartu Cadangan Karbon */}
              <div className="p-2.5 border border-emerald-500/40 bg-emerald-950/30">
                <div className="flex items-center justify-between text-[11px] text-emerald-400 font-bold">
                  <span>Stok Karbon</span>
                  <button
                    type="button"
                    onClick={() => setBukaBatas(!bukaBatas)}
                    className="text-zinc-400 hover:text-white"
                    title="Lihat asumsi & batas perhitungan"
                  >
                    <Info size={12} />
                  </button>
                </div>
                <div className="text-xl sm:text-2xl font-bold font-pixel text-white mt-0.5">
                  {dataGeotag.karbon.karbon_ton} <span className="text-xs font-sans text-emerald-300">ton C</span>
                </div>
                <div className="text-[10px] text-emerald-300/80 mt-0.5">
                  ≈ {dataGeotag.karbon.co2e_ton} ton CO₂e
                </div>
              </div>
            </div>

            {/* Kotak Asumsi Karbon (4 Batas Ilmiah) */}
            {bukaBatas && (
              <div className="my-2 p-2.5 border border-amber-500/40 bg-amber-950/30 text-amber-200 text-xs">
                <div className="font-bold flex items-center gap-1.5 text-amber-300 mb-1">
                  <Info size={13} /> 4 Batas & Asumsi Estimasi Biomassa Karbon (Chave 2014 & IPCC):
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-200/90">
                  {dataGeotag.karbon.batas.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tombol Buka Rincian Lokasi & Tanaman */}
            {dataGeotag.per_lokasi && dataGeotag.per_lokasi.length > 0 && (
              <button
                type="button"
                onClick={() => setBukaDetail(!bukaDetail)}
                className="w-full py-1.5 px-3 border border-white/10 hover:border-white/30 bg-black/40 text-xs text-zinc-300 flex items-center justify-between transition-colors"
              >
                <span>Rincian Lokasi & Komposisi Tanaman</span>
                {bukaDetail ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}

            {/* Detail Lokasi & Tanaman */}
            {bukaDetail && (
              <div className="mt-2 space-y-3">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-white/10 text-zinc-300">
                        <th className="p-1.5 border border-white/15">Lokasi / Blok</th>
                        <th className="p-1.5 border border-white/15 text-right">Total Pohon</th>
                        <th className="p-1.5 border border-white/15 text-right">Sehat</th>
                        <th className="p-1.5 border border-white/15 text-right">Merana</th>
                        <th className="p-1.5 border border-white/15 text-right">Mati</th>
                        <th className="p-1.5 border border-white/15 text-right">% Hidup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataGeotag.per_lokasi.map((l) => (
                        <tr key={l.lokasi} className="hover:bg-white/5">
                          <td className="p-1.5 border border-white/10 font-bold">{l.lokasi}</td>
                          <td className="p-1.5 border border-white/10 text-right">{l.total.toLocaleString('id-ID')}</td>
                          <td className="p-1.5 border border-white/10 text-right text-emerald-400">{l.sehat.toLocaleString('id-ID')}</td>
                          <td className="p-1.5 border border-white/10 text-right text-amber-300">{l.merana.toLocaleString('id-ID')}</td>
                          <td className="p-1.5 border border-white/10 text-right text-red-400">{l.mati.toLocaleString('id-ID')}</td>
                          <td className="p-1.5 border border-white/10 text-right font-bold">{l.persen_hidup}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {dataGeotag.per_tanaman && dataGeotag.per_tanaman.length > 0 && (
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] font-bold text-zinc-400 mb-1.5">Sebaran Jenis Tanaman:</div>
                    <div className="flex flex-wrap gap-2">
                      {dataGeotag.per_tanaman.map((t) => (
                        <div key={t.tanaman} className="px-2 py-1 border border-white/15 bg-white/5 text-xs">
                          <span className="font-bold text-zinc-200">{t.tanaman}</span>:{' '}
                          <span className="text-sky-300">{t.total.toLocaleString('id-ID')} phn</span>{' '}
                          <span className="text-zinc-500">({t.persen}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Saringan */}
      {bukaSaring && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-3">
          <div className="w-full max-w-sm border-2 border-white/40 bg-zinc-900 p-4 shadow-[6px_6px_0_#000] text-zinc-100">
            <div className="flex items-center justify-between border-b border-white/15 pb-2 mb-3">
              <h4 className="font-bold text-sm text-lime-400 flex items-center gap-1.5 font-pixel">
                <Filter size={14} /> SARING DATA {blok.sumber.toUpperCase()}
              </h4>
              <button type="button" onClick={() => setBukaSaring(false)} className="text-zinc-400 hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              {blok.sumber === 'nursery' ? (
                <>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold">Jenis Bibit:</label>
                    <input
                      type="text"
                      value={filterForm.bibit || ''}
                      onChange={(e) => setFilterForm({ ...filterForm, bibit: e.target.value })}
                      placeholder="Contoh: SENGON POTTING"
                      className="w-full p-1.5 bg-black border border-white/20 text-white focus:border-lime-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold">Tujuan / Blok Penanaman:</label>
                    <input
                      type="text"
                      value={filterForm.tujuan || ''}
                      onChange={(e) => setFilterForm({ ...filterForm, tujuan: e.target.value })}
                      placeholder="Contoh: Blok 1"
                      className="w-full p-1.5 bg-black border border-white/20 text-white focus:border-lime-400 outline-none"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold">Lokasi / Blok:</label>
                    <input
                      type="text"
                      value={filterForm.lokasi || ''}
                      onChange={(e) => setFilterForm({ ...filterForm, lokasi: e.target.value })}
                      placeholder="Contoh: Pit Barat"
                      className="w-full p-1.5 bg-black border border-white/20 text-white focus:border-lime-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold">Jenis Tanaman:</label>
                    <input
                      type="text"
                      value={filterForm.tanaman || ''}
                      onChange={(e) => setFilterForm({ ...filterForm, tanaman: e.target.value })}
                      placeholder="Contoh: Sengon"
                      className="w-full p-1.5 bg-black border border-white/20 text-white focus:border-lime-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1 font-bold">Vendor / Tim:</label>
                    <input
                      type="text"
                      value={filterForm.vendor || ''}
                      onChange={(e) => setFilterForm({ ...filterForm, vendor: e.target.value })}
                      placeholder="Contoh: Tim Basri"
                      className="w-full p-1.5 bg-black border border-white/20 text-white focus:border-lime-400 outline-none"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-zinc-400 mb-1 font-bold">Dari Tanggal:</label>
                  <input
                    type="date"
                    value={filterForm.dari || ''}
                    onChange={(e) => setFilterForm({ ...filterForm, dari: e.target.value })}
                    className="w-full p-1 bg-black border border-white/20 text-white focus:border-lime-400 outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1 font-bold">Sampai Tanggal:</label>
                  <input
                    type="date"
                    value={filterForm.sampai || ''}
                    onChange={(e) => setFilterForm({ ...filterForm, sampai: e.target.value })}
                    className="w-full p-1 bg-black border border-white/20 text-white focus:border-lime-400 outline-none text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-white/15">
              <button
                type="button"
                onClick={() => setFilterForm({})}
                className="px-2.5 py-1 border border-white/20 text-zinc-400 hover:text-white text-xs"
              >
                Kosongkan
              </button>
              <button
                type="button"
                onClick={terapkanSaringan}
                className="px-3 py-1 bg-lime-600 hover:bg-lime-500 text-black font-bold text-xs"
              >
                Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
