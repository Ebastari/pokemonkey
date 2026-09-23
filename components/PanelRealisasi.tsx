import React, { useMemo, useState } from 'react';
import { X, TreePine, RotateCcw, Pencil, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { ha, jumlah, totalTahun, type BarisRevegetasi } from '../lib/revegetasi';

/**
 * Rincian realisasi revegetasi: total, grafik per tahun, dan sebaran blok.
 *
 * Bisa disaring dari tiga arah — kawasan (APL / hutan), blok, dan tahun — dan
 * ketiganya saling menyesuaikan: ketuk batang untuk memilih tahun, ketuk baris
 * blok untuk menyaring blok.
 *
 * Batas datanya: sumbernya memuat kawasan per tahun dan blok per tahun, tetapi
 * tidak memuat silangnya (mis. berapa APL di Blok 3). Karena itu saat satu blok
 * dipilih, saringan kawasan dimatikan, bukan ditebak.
 */

type Kawasan = 'semua' | 'apl' | 'hutan';

interface Props {
  data: BarisRevegetasi[];
  /** Luas tanam pribadi dari profil game, sebagai pembanding kecil. */
  luasKebun: number;
  /** Hanya Admin yang boleh mengisi angka realisasi. */
  peran?: string;
  /** Dipanggil setelah angka disimpan, agar layar memuat ulang datanya. */
  onSimpan?: () => void;
  onTutup: () => void;
}

const WARNA: Record<Exclude<Kawasan, 'semua'>, string> = { apl: 'bg-amber-400', hutan: 'bg-emerald-400' };

export const PanelRealisasi: React.FC<Props> = ({ data, luasKebun, peran, onSimpan, onTutup }) => {
  const [formTahun, setFormTahun] = useState<number | 'baru' | null>(null);
  const baris = useMemo(() => [...data].sort((a, b) => a.tahun - b.tahun), [data]);
  const [kawasan, setKawasan] = useState<Kawasan>('semua');
  const [blok, setBlok] = useState('');
  const [tahun, setTahun] = useState<number | null>(null);

  const daftarBlok = useMemo(() => {
    const set = new Set<string>();
    for (const b of baris) for (const [nama, luas] of Object.entries(b.blok ?? {})) if (luas > 0) set.add(nama);
    return [...set].sort();
  }, [baris]);

  /** Nilai satu tahun sesuai saringan yang sedang aktif. */
  const nilai = useMemo(() => (b: BarisRevegetasi): number => {
    if (blok) return b.blok?.[blok] ?? 0;
    if (kawasan === 'apl') return b.apl;
    if (kawasan === 'hutan') return b.hutan;
    return totalTahun(b);
  }, [blok, kawasan]);

  const terpilih = baris.find((b) => b.tahun === tahun) ?? null;
  const lingkup = terpilih ? [terpilih] : baris;
  const total = jumlah(lingkup.map(nilai));
  const totalApl = jumlah(lingkup.map((b) => b.apl));
  const totalHutan = jumlah(lingkup.map((b) => b.hutan));
  const maks = Math.max(...baris.map(nilai), 0.001);
  const skala = Math.max(10, Math.ceil(maks / 10) * 10);

  const puncak = baris.reduce((a, b) => (nilai(b) > nilai(a) ? b : a), baris[0]);
  const tahunAktif = baris.filter((b) => nilai(b) > 0).length;

  const sebaranBlok = useMemo(() => {
    const per = new Map<string, number[]>();
    for (const b of lingkup) for (const [nama, luas] of Object.entries(b.blok ?? {})) per.set(nama, [...(per.get(nama) ?? []), luas]);
    return [...per].map(([nama, nilaiBlok]) => ({ nama, luas: jumlah(nilaiBlok) })).filter((x) => x.luas > 0).sort((a, b) => b.luas - a.luas);
  }, [lingkup]);
  const maksBlok = Math.max(0.001, ...sebaranBlok.map((b) => b.luas));

  const adaSaring = kawasan !== 'semua' || blok !== '' || tahun !== null;
  const labelSaring = [blok || null, kawasan === 'apl' ? 'APL' : kawasan === 'hutan' ? 'kawasan hutan' : null].filter(Boolean).join(' · ');
  const rentang = terpilih ? String(terpilih.tahun) : `${baris[0]?.tahun}–${baris[baris.length - 1]?.tahun}`;

  const pilihBlok = (nama: string) => {
    setBlok((b) => (b === nama ? '' : nama));
    setKawasan('semua');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-end sm:items-center justify-center sm:p-4" onClick={(e) => { e.stopPropagation(); onTutup(); }}>
      <div
        className="retro-box !bg-zinc-900 border-emerald-500 w-full sm:max-w-xl max-h-[90vh] overflow-auto custom-scrollbar !p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b-4 border-white pb-2 mb-3">
          <h2 className="judul-layar flex items-center gap-2 mr-auto"><TreePine size={16} className="text-emerald-400" /> Realisasi Revegetasi</h2>
          {peran === 'admin' && formTahun === null && (
            <button onClick={() => setFormTahun(tahun ?? 'baru')} className="btn-retro btn-retro-sm bg-emerald-700" title="Isi atau ubah luasan realisasi">
              <Pencil size={12} /> Isi data
            </button>
          )}
          {adaSaring && (
            <button onClick={() => { setKawasan('semua'); setBlok(''); setTahun(null); }} className="btn-retro btn-retro-sm bg-zinc-700" title="Tampilkan semua">
              <RotateCcw size={12} /> Semua
            </button>
          )}
          <button onClick={onTutup} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup"><X size={15} /></button>
        </div>

        {formTahun !== null && (
          <FormRealisasi
            awal={baris.find((b) => b.tahun === formTahun) ?? null}
            tahunBaru={formTahun === 'baru' ? (baris[baris.length - 1]?.tahun ?? new Date().getFullYear()) + 1 : formTahun}
            daftarBlok={daftarBlok}
            onBatal={() => setFormTahun(null)}
            onSelesai={(tahunTersimpan) => { setFormTahun(null); setTahun(tahunTersimpan); onSimpan?.(); }}
          />
        )}

        {/* ---------- Saringan ---------- */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
          <div>
            <p className="label-retro !mb-1">Kawasan</p>
            <div className="flex" role="group" aria-label="Saring kawasan">
              {([['semua', 'Semua'], ['apl', 'APL'], ['hutan', 'Hutan']] as const).map(([nilaiTombol, label]) => (
                <button
                  key={nilaiTombol}
                  onClick={() => setKawasan(nilaiTombol)}
                  disabled={Boolean(blok)}
                  aria-pressed={kawasan === nilaiTombol}
                  title={blok ? 'Data blok tidak dirinci per kawasan' : undefined}
                  className={`px-2.5 py-1 text-[13px] font-bold border-2 -ml-[2px] first:ml-0 disabled:opacity-40 ${
                    kawasan === nilaiTombol ? 'bg-emerald-600 border-white text-white' : 'bg-zinc-800 border-white/30 text-zinc-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-[116px]">
            <label htmlFor="rv-blok" className="label-retro !mb-1">Blok</label>
            <select id="rv-blok" value={blok} onChange={(e) => { setBlok(e.target.value); setKawasan('semua'); }} className="input-retro !py-1 !text-[13px]">
              <option value="">Semua blok</option>
              {daftarBlok.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          <div className="min-w-[116px]">
            <label htmlFor="rv-tahun" className="label-retro !mb-1">Tahun</label>
            <select id="rv-tahun" value={tahun ?? ''} onChange={(e) => setTahun(e.target.value ? Number(e.target.value) : null)} className="input-retro !py-1 !text-[13px]">
              <option value="">Semua tahun</option>
              {baris.map((b) => <option key={b.tahun} value={b.tahun}>{b.tahun}</option>)}
            </select>
          </div>
        </div>

        {blok && <p className="text-[11px] text-amber-300 mb-3">Sebaran blok tidak dirinci per kawasan, jadi saringan APL/hutan dimatikan.</p>}

        {/* ---------- Angka pokok ---------- */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="panel-retro !p-2 col-span-2">
            <p className="text-[11px] text-zinc-400 uppercase">Total {rentang}{labelSaring ? ` · ${labelSaring}` : ''}</p>
            <p className="font-title text-[15px] text-emerald-300 mt-1">{ha(total)} <span className="text-[11px]">HA</span></p>
          </div>

          {blok ? (
            <>
              <div className="panel-retro !p-2">
                <p className="text-[11px] text-zinc-400 uppercase">Tahun tertinggi</p>
                <p className="text-[15px] font-bold text-emerald-300 tabular-nums">{puncak ? `${puncak.tahun} · ${ha(nilai(puncak))}` : '—'}</p>
              </div>
              <div className="panel-retro !p-2">
                <p className="text-[11px] text-zinc-400 uppercase">Tahun ada kegiatan</p>
                <p className="text-[15px] font-bold text-zinc-100 tabular-nums">{tahunAktif} dari {baris.length}</p>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setKawasan(kawasan === 'apl' ? 'semua' : 'apl')} aria-pressed={kawasan === 'apl'} className={`panel-retro !p-2 text-left ${kawasan === 'apl' ? '!border-amber-400' : ''}`}>
                <p className="text-[11px] text-zinc-400 uppercase">APL</p>
                <p className="text-[15px] font-bold text-amber-300 tabular-nums">{ha(totalApl)} Ha</p>
              </button>
              <button onClick={() => setKawasan(kawasan === 'hutan' ? 'semua' : 'hutan')} aria-pressed={kawasan === 'hutan'} className={`panel-retro !p-2 text-left ${kawasan === 'hutan' ? '!border-emerald-400' : ''}`}>
                <p className="text-[11px] text-zinc-400 uppercase">Kawasan hutan</p>
                <p className="text-[15px] font-bold text-emerald-300 tabular-nums">{ha(totalHutan)} Ha</p>
              </button>
            </>
          )}
        </div>

        {/* ---------- Grafik per tahun ---------- */}
        <p className="label-retro">Realisasi per tahun (Ha){labelSaring ? ` · ${labelSaring}` : ''}</p>
        <div className="panel-retro !p-2">
          <div className="relative h-44 pl-9">
            {[skala, skala / 2].map((garis) => (
              <div key={garis} className="absolute left-0 right-0 flex items-center gap-1" style={{ bottom: `${(garis / skala) * 100}%` }}>
                <span className="w-8 text-right text-[10px] text-zinc-500 tabular-nums shrink-0">{garis}</span>
                <span className="flex-1 border-t border-dashed border-white/15" />
              </div>
            ))}

            <div className="flex items-end gap-[3px] h-full">
              {baris.map((b) => {
                const n = nilai(b);
                const aktif = b.tahun === tahun;
                const redup = tahun !== null && !aktif;
                return (
                  <button
                    key={b.tahun}
                    onClick={() => setTahun((t) => (t === b.tahun ? null : b.tahun))}
                    aria-pressed={aktif}
                    aria-label={`${b.tahun}: ${ha(n)} hektare`}
                    title={`${b.tahun} · ${ha(n)} Ha`}
                    className={`flex-1 min-w-0 h-full flex flex-col justify-end ${redup ? 'opacity-45' : ''}`}
                  >
                    <div
                      className={`w-full flex flex-col justify-end border-2 ${aktif ? 'border-white' : 'border-black/50'}`}
                      style={{ height: `${n > 0 ? Math.max(2, (n / skala) * 100) : 0}%` }}
                    >
                      {blok || kawasan !== 'semua' ? (
                        <div className={`w-full h-full ${blok ? 'bg-cyan-400' : WARNA[kawasan as 'apl' | 'hutan']}`} />
                      ) : (
                        <>
                          <div className="w-full bg-amber-400" style={{ height: `${(b.apl / (n || 1)) * 100}%` }} />
                          <div className="w-full bg-emerald-400" style={{ height: `${(b.hutan / (n || 1)) * 100}%` }} />
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-[3px] pl-9 mt-1">
            {baris.map((b) => (
              <span key={b.tahun} className={`flex-1 min-w-0 text-center text-[9px] tabular-nums ${b.tahun === tahun ? 'text-white font-bold' : 'text-zinc-500'}`}>
                {String(b.tahun).slice(2)}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-400">
            {blok ? (
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-cyan-400 border border-black inline-block" /> {blok}</span>
            ) : (
              <>
                {kawasan !== 'apl' && <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-400 border border-black inline-block" /> Kawasan hutan</span>}
                {kawasan !== 'hutan' && <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-400 border border-black inline-block" /> APL</span>}
              </>
            )}
            <span className="ml-auto">Ketuk batang untuk memilih tahun</span>
          </div>
        </div>

        {/* ---------- Rincian tahun terpilih ---------- */}
        {terpilih && (
          <div className="panel-retro !p-2.5 mt-2">
            <p className="text-[14px] font-bold text-white">
              {terpilih.tahun} · <span className="text-emerald-300 tabular-nums">{ha(nilai(terpilih))} Ha</span>
              {labelSaring && <span className="text-[12px] text-zinc-400 font-normal"> ({labelSaring})</span>}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 text-[12px]">
              {([
                ['APL', terpilih.apl], ['Kawasan hutan', terpilih.hutan],
                ['IPD', terpilih.ipd], ['OPD', terpilih.opd],
                ['Timbunan soil', terpilih.timbunan_soil], ['Fasilitas penunjang', terpilih.fasilitas],
              ] as const).filter(([, n]) => n > 0).map(([label, n]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-zinc-400">{label}</span>
                  <span className="text-zinc-100 tabular-nums">{ha(n)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Sebaran blok ---------- */}
        <p className="label-retro mt-4">Sebaran blok · {rentang}</p>
        <div className="panel-retro !p-2.5 flex flex-col gap-1.5">
          {sebaranBlok.map((b) => (
            <button
              key={b.nama}
              onClick={() => pilihBlok(b.nama)}
              aria-pressed={blok === b.nama}
              className={`flex items-center gap-2 px-1 py-0.5 text-left ${blok === b.nama ? 'bg-white/10' : 'hover:bg-white/5'}`}
            >
              <span className={`text-[12px] w-16 shrink-0 ${blok === b.nama ? 'text-white font-bold' : 'text-zinc-300'}`}>{b.nama}</span>
              <span className="flex-1 h-3 bg-black/50 border border-white/20 overflow-hidden">
                <span className={`block h-full ${blok === b.nama ? 'bg-cyan-400' : 'bg-emerald-500'}`} style={{ width: `${(b.luas / maksBlok) * 100}%` }} />
              </span>
              <span className="text-[12px] text-zinc-100 tabular-nums w-20 text-right">{ha(b.luas)} Ha</span>
            </button>
          ))}
          {sebaranBlok.length === 0 && <p className="text-[12px] text-zinc-500 italic">Tidak ada kegiatan pada tahun ini.</p>}
        </div>

        <p className="text-[11px] text-zinc-500 mt-3 leading-relaxed">
          Kebun Anda di layar KEBUN: {ha(luasKebun)} Ha dari laporan pribadi.
          Sumber angka di atas: berkas <span className="text-zinc-300">Realisasi Permintaan Amdal.xlsx</span>, sheet Summary.
        </p>
      </div>
    </div>
  );
};

/**
 * Isian luasan realisasi satu tahun. Angka ditulis apa adanya dalam hektare;
 * total tahun dihitung dari APL + kawasan hutan, bukan diketik ulang, supaya
 * tidak pernah ada dua versi angka yang sama.
 */
const FormRealisasi: React.FC<{
  awal: BarisRevegetasi | null;
  tahunBaru: number;
  daftarBlok: string[];
  onBatal: () => void;
  onSelesai: (tahun: number) => void;
}> = ({ awal, tahunBaru, daftarBlok, onBatal, onSelesai }) => {
  const teks = (n?: number) => (n ? String(n) : '');
  const [tahun, setTahun] = useState(String(awal?.tahun ?? tahunBaru));
  const [f, setF] = useState({
    apl: teks(awal?.apl), hutan: teks(awal?.hutan), ipd: teks(awal?.ipd),
    opd: teks(awal?.opd), timbunan_soil: teks(awal?.timbunan_soil), fasilitas: teks(awal?.fasilitas),
  });
  const [blok, setBlok] = useState<Record<string, string>>(
    Object.fromEntries((daftarBlok.length ? daftarBlok : ['Blok 1', 'Blok 2', 'Blok 3', 'Blok 5', 'Blok 6'])
      .map((nama) => [nama, teks(awal?.blok?.[nama])])),
  );
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const num = (x: string) => Math.max(0, Number(String(x).replace(',', '.')) || 0);
  const totalKawasan = num(f.apl) + num(f.hutan);
  const totalBlok = Object.values(blok).reduce((n, x) => n + num(x), 0);
  const tahunAngka = Number(tahun);

  const simpan = async () => {
    if (!Number.isInteger(tahunAngka) || tahunAngka < 2000 || tahunAngka > 2100) { setGalat('Tahun harus antara 2000 dan 2100.'); return; }
    if (totalKawasan <= 0) { setGalat('Isi luas APL atau kawasan hutan dulu.'); return; }
    setMenyimpan(true);
    setGalat(null);
    try {
      await api('/api/revegetasi', {
        body: {
          tahun: tahunAngka,
          apl: num(f.apl), hutan: num(f.hutan), ipd: num(f.ipd), opd: num(f.opd),
          timbunan_soil: num(f.timbunan_soil), fasilitas: num(f.fasilitas),
          blok: Object.fromEntries(Object.entries(blok).map(([nama, isi]) => [nama, num(isi)])),
        },
      });
      onSelesai(tahunAngka);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="panel-retro !p-3 mb-3 border-emerald-500">
      <div className="flex items-center gap-2 mb-2">
        <p className="label-retro !mb-0 mr-auto">Isi luasan realisasi (Ha)</p>
        <button onClick={onBatal} className="btn-ikon !w-7 !h-7 bg-zinc-800" aria-label="Batal"><X size={13} /></button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div>
          <label htmlFor="rv-f-tahun" className="text-[11px] uppercase text-zinc-400">Tahun</label>
          <input id="rv-f-tahun" value={tahun} onChange={(e) => setTahun(e.target.value)} type="number" className="input-retro !py-1 !text-[13px] tabular-nums" />
        </div>
        {([
          ['rv-f-apl', 'APL', 'apl'], ['rv-f-hutan', 'Kawasan hutan', 'hutan'],
          ['rv-f-ipd', 'IPD', 'ipd'], ['rv-f-opd', 'OPD', 'opd'],
          ['rv-f-soil', 'Timbunan soil', 'timbunan_soil'], ['rv-f-fasilitas', 'Fasilitas penunjang', 'fasilitas'],
        ] as const).map(([id, label, kunci]) => (
          <div key={kunci}>
            <label htmlFor={id} className="text-[11px] uppercase text-zinc-400">{label}</label>
            <input
              id={id} value={f[kunci]} onChange={(e) => setF({ ...f, [kunci]: e.target.value })}
              type="text" inputMode="decimal" placeholder="0"
              className="input-retro !py-1 !text-[13px] tabular-nums"
            />
          </div>
        ))}
      </div>

      <p className="label-retro !mb-1 mt-3">Sebaran blok</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.keys(blok).map((nama) => (
          <div key={nama}>
            <label htmlFor={'rv-f-' + nama.replace(/\s+/g, '')} className="text-[11px] uppercase text-zinc-400">{nama}</label>
            <input
              id={'rv-f-' + nama.replace(/\s+/g, '')} value={blok[nama]}
              onChange={(e) => setBlok({ ...blok, [nama]: e.target.value })}
              type="text" inputMode="decimal" placeholder="0"
              className="input-retro !py-1 !text-[13px] tabular-nums"
            />
          </div>
        ))}
      </div>

      <p className="text-[12px] text-zinc-400 mt-2 tabular-nums">
        Total tahun ini: <span className="text-emerald-300">{ha(totalKawasan)} Ha</span>
        {totalBlok > 0 && Math.abs(totalBlok - totalKawasan) > 0.01 && (
          <span className="text-amber-300"> · jumlah blok {ha(totalBlok)} Ha, belum sama</span>
        )}
      </p>
      {galat && <p className="text-[12px] text-red-300 mt-1">{galat}</p>}

      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={onBatal} className="btn-retro btn-retro-sm bg-zinc-700">Batal</button>
        <button onClick={simpan} disabled={menyimpan} className="btn-retro btn-retro-sm bg-emerald-700">
          {menyimpan ? <><Loader2 size={12} className="animate-spin" /> Menyimpan…</> : 'Simpan'}
        </button>
      </div>
    </div>
  );
};
