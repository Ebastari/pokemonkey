import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  X, Sun, Moon, CloudSun, CloudMoon, Cloud, CloudRain, CloudDrizzle, CloudLightning, CloudFog,
  Droplets, Wind, MapPin, Loader2, Pencil, TriangleAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { jenisCuaca, intensitasHujan, polaAdm4, type JawabanCuaca, type SlotCuaca } from '../server/src/cuaca-bmkg';

/**
 * Cuaca di KEBUN, dari prakiraan BMKG untuk desa di sekitar area tambang.
 *   - `useCuaca`   : ambil /api/cuaca saat dibuka, lalu tiap 30 menit.
 *   - `HujanKebun` : tetes hujan (dan kilat bila petir) di atas kebun saat slot sekarang hujan.
 *   - `ChipCuaca`  : ringkasan kecil di pojok kebun; diketuk membuka `PanelCuaca`.
 */

const SELANG_MS = 30 * 60_000;

export function useCuaca() {
  const [cuaca, setCuaca] = useState<JawabanCuaca | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const muat = useCallback(() => {
    api<JawabanCuaca>('/api/cuaca')
      .then((d) => { setCuaca(d); setGalat(null); })
      .catch((e) => setGalat(e instanceof Error ? e.message : 'Cuaca tidak tersedia'));
  }, []);

  useEffect(() => {
    muat();
    const t = setInterval(muat, SELANG_MS);
    return () => clearInterval(t);
  }, [muat]);

  return { cuaca, galat, muat };
}

const jamLokal = (s: SlotCuaca) => Number(s.lokal.slice(11, 13));
const malam = (s: SlotCuaca) => jamLokal(s) >= 18 || jamLokal(s) < 6;

/** Ikon lucide untuk satu slot (siang/malam dibedakan saat cerah). */
export const IkonCuaca: React.FC<{ slot: SlotCuaca; size?: number; className?: string }> = ({ slot, size = 16, className }) => {
  const j = jenisCuaca(slot.kode);
  const Ikon = j === 'petir' ? CloudLightning
    : j === 'hujan' ? (intensitasHujan(slot.kode) === 1 ? CloudDrizzle : CloudRain)
      : j === 'kabut' ? CloudFog
        : j === 'berawan' ? Cloud
          : j === 'cerah-berawan' ? (malam(slot) ? CloudMoon : CloudSun)
            : (malam(slot) ? Moon : Sun);
  return <Ikon size={size} className={className} aria-hidden="true" />;
};

// ---------------------------------------------------------------------------
// Hujan di atas kebun
// ---------------------------------------------------------------------------

export const HujanKebun: React.FC<{ tingkat: 0 | 1 | 2 | 3; petir?: boolean; kabut?: boolean }> = ({ tingkat, petir, kabut }) => {
  const tetes = useMemo(() => {
    const n = tingkat === 3 ? 120 : tingkat === 2 ? 75 : tingkat === 1 ? 38 : 0;
    // Acak tetapi stabil selama tingkatnya sama, supaya tidak berkedip saat render ulang.
    return Array.from({ length: n }, (_, i) => {
      const a = Math.abs(Math.sin(i * 12.9898 + tingkat * 78.233));
      const b = Math.abs(Math.sin(i * 39.3468 + tingkat * 11.135));
      return {
        kiri: a * 112 - 6,
        tunda: -b * 1.2,
        lama: (tingkat === 3 ? 0.42 : tingkat === 2 ? 0.55 : 0.7) + a * 0.25,
        panjang: 10 + Math.round(b * 8),
        redup: 0.45 + a * 0.4,
      };
    });
  }, [tingkat]);

  if (!tingkat && !kabut) return null;
  return (
    <div className="absolute inset-0 z-[15] pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Langit mendung: kebun sedikit lebih gelap saat hujan, keputihan saat udara kabur. */}
      <div
        className="absolute inset-0"
        style={{ background: tingkat ? `rgb(15 23 42 / ${tingkat === 3 ? 0.3 : tingkat === 2 ? 0.22 : 0.14})` : 'rgb(226 232 240 / 0.28)' }}
      />
      {tingkat > 0 && (
        <div className="absolute -inset-x-8 inset-y-0" style={{ transform: 'skewX(-9deg)' }}>
          {tetes.map((t, i) => (
            <span
              key={i}
              className="tetes-hujan"
              style={{
                left: `${t.kiri}%`,
                animationDelay: `${t.tunda}s`,
                animationDuration: `${t.lama}s`,
                backgroundSize: `2px ${t.panjang}px`,
                opacity: t.redup,
              }}
            />
          ))}
        </div>
      )}
      {petir && <div className="absolute inset-0 kilat-petir" />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chip di pojok kebun
// ---------------------------------------------------------------------------

export const ChipCuaca: React.FC<{ cuaca: JawabanCuaca | null; galat: string | null; onBuka: () => void }> = ({ cuaca, galat, onBuka }) => {
  const s = cuaca?.sekarang;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onBuka(); }}
      className="absolute z-20 right-2 top-2 retro-box !bg-black/70 !border-white/40 !p-1.5 !px-2 flex items-center gap-1.5 leading-tight text-left"
      title="Prakiraan cuaca BMKG"
      aria-label={s ? `Cuaca sekarang ${s.ket}, ${s.suhu} derajat. Buka prakiraan` : 'Buka prakiraan cuaca'}
    >
      {s ? (
        <>
          <IkonCuaca slot={s} size={18} className={cuaca?.hujan ? 'text-sky-300' : jenisCuaca(s.kode) === 'cerah' ? 'text-yellow-300' : 'text-zinc-200'} />
          <span>
            <span className="block font-title text-[10px] text-white">{s.suhu}°C</span>
            <span className="block text-[10px] text-zinc-300 max-w-[88px] truncate">{s.ket}</span>
          </span>
        </>
      ) : galat ? (
        <><TriangleAlert size={14} className="text-amber-300" /><span className="text-[10px] text-zinc-300">Cuaca</span></>
      ) : (
        <Loader2 size={14} className="animate-spin text-zinc-300" />
      )}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Panel prakiraan
// ---------------------------------------------------------------------------

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const labelTanggal = (tgl: string) => {
  const d = new Date(`${tgl}T00:00:00Z`);
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`;
};
const jamWita = (iso: string) => new Date(Date.parse(iso) + 480 * 60_000).toISOString().slice(11, 16).replace(':', '.');

interface RingkasHari { tanggal: string; min: number; maks: number; mm: number; hujan: number; wakil: SlotCuaca }

function ringkasPerHari(slot: SlotCuaca[]): RingkasHari[] {
  const peta = new Map<string, SlotCuaca[]>();
  for (const s of slot) {
    const t = s.lokal.slice(0, 10);
    peta.set(t, [...(peta.get(t) ?? []), s]);
  }
  return [...peta].map(([tanggal, d]) => {
    // Wakil hari: slot terburuk (hujan/petir menang), supaya "ada hujan sore" tidak tertutup pagi cerah.
    const wakil = [...d].sort((a, b) => intensitasHujan(b.kode) - intensitasHujan(a.kode) || b.awan - a.awan)[0];
    return {
      tanggal,
      min: Math.min(...d.map((s) => s.suhu)),
      maks: Math.max(...d.map((s) => s.suhu)),
      mm: Math.round(d.reduce((n, s) => n + s.hujanMm, 0) * 10) / 10,
      hujan: d.filter((s) => intensitasHujan(s.kode) > 0).length,
      wakil,
    };
  });
}

/** Saran kerja lapangan singkat dari slot-slot hari ini. */
function saranLapangan(slot: SlotCuaca[]): string | null {
  const hariIni = slot[0]?.lokal.slice(0, 10);
  const hujan = slot.filter((s) => s.lokal.startsWith(hariIni) && intensitasHujan(s.kode) > 0);
  if (hujan.some((s) => s.kode === 95 || s.kode === 97)) return `Ada potensi hujan petir mulai ${hujan[0].lokal.slice(11)} WITA — hentikan kegiatan di area terbuka saat kilat terlihat.`;
  if (hujan.length) return `Hujan diperkirakan mulai ${hujan[0].lokal.slice(11)} WITA — atur jadwal penanaman/penyulaman, jalan tambang bisa licin.`;
  const kabur = slot.filter((s) => s.lokal.startsWith(hariIni) && (s.kode === 5 || s.kode === 10));
  if (kabur.length) return 'Udara kabur hari ini — pantau asap/titik api di sekitar area.';
  const panas = slot.filter((s) => s.lokal.startsWith(hariIni)).some((s) => s.suhu >= 33);
  if (panas) return 'Terik siang ini (≥33°C) — penyiraman bibit pagi/sore, sediakan air minum tim.';
  return null;
}

export const PanelCuaca: React.FC<{
  cuaca: JawabanCuaca | null;
  galat: string | null;
  admin: boolean;
  onMuatUlang: () => void;
  onTutup: () => void;
  notify?: (m: string) => void;
}> = ({ cuaca, galat, admin, onMuatUlang, onTutup, notify }) => {
  const [ubah, setUbah] = useState(false);
  const [kode, setKode] = useState(cuaca?.lokasi.adm4 ?? '');
  const [menyimpan, setMenyimpan] = useState(false);
  const hari = useMemo(() => (cuaca ? ringkasPerHari(cuaca.slot) : []), [cuaca]);
  const saran = useMemo(() => (cuaca ? saranLapangan(cuaca.slot) : null), [cuaca]);
  const s = cuaca?.sekarang;

  const simpanKode = async () => {
    setMenyimpan(true);
    try {
      await api('/api/pengaturan', { body: { cuaca_adm4: kode.trim() } });
      setUbah(false);
      notify?.('LOKASI CUACA DIPERBARUI');
      onMuatUlang();
    } catch (e) { notify?.(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN'); }
    finally { setMenyimpan(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-end sm:items-center justify-center sm:p-4" onClick={(e) => { e.stopPropagation(); onTutup(); }}>
      <div className="retro-box !bg-zinc-900 border-sky-500 w-full sm:max-w-xl max-h-[90vh] overflow-auto custom-scrollbar !p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b-4 border-white pb-2 mb-3">
          <h2 className="judul-layar flex items-center gap-2 mr-auto"><CloudSun size={16} className="text-sky-400" /> Cuaca Kebun</h2>
          {admin && !ubah && (
            <button onClick={() => { setKode(cuaca?.lokasi.adm4 ?? ''); setUbah(true); }} className="btn-retro btn-retro-sm bg-zinc-700" title="Ganti desa acuan prakiraan">
              <Pencil size={12} /> Lokasi
            </button>
          )}
          <button onClick={onTutup} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup"><X size={16} /></button>
        </div>

        {ubah && (
          <div className="panel-retro !p-3 mb-3 border-sky-500">
            <label htmlFor="cuaca-adm4" className="label-retro">Kode wilayah desa (adm4)</label>
            <input id="cuaca-adm4" value={kode} onChange={(e) => setKode(e.target.value)} placeholder="63.05.09.2012" className="input-retro !py-1.5 font-mono mt-1" inputMode="decimal" />
            <p className="text-[11px] text-zinc-400 mt-1 leading-snug">
              Kode Kemendagri tingkat desa, format 00.00.00.0000. Bawaan 63.05.09.2012 = Desa Linuh, Kec. Bungur, Tapin (±2,6 km dari pusat area tambang).
            </p>
            {kode.trim() && !polaAdm4.test(kode.trim()) && <p className="text-[11px] text-amber-300 mt-1">Format belum sesuai, contoh 63.05.09.2012.</p>}
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <button onClick={() => setUbah(false)} className="btn-retro btn-retro-sm bg-zinc-700">Batal</button>
              <button onClick={simpanKode} disabled={menyimpan || !polaAdm4.test(kode.trim())} className="btn-retro btn-retro-sm bg-sky-700">
                {menyimpan ? <Loader2 size={12} className="animate-spin" /> : null} Simpan
              </button>
            </div>
          </div>
        )}

        {!cuaca && (
          <p className="text-[13px] text-zinc-300 flex items-center gap-2">
            {galat ? <><TriangleAlert size={14} className="text-amber-300" /> {galat}</> : <><Loader2 size={14} className="animate-spin" /> memuat prakiraan…</>}
          </p>
        )}

        {cuaca && (
          <>
            <p className="text-[12px] text-zinc-300 flex items-center gap-1.5 mb-2">
              <MapPin size={12} className="text-sky-300 shrink-0" />
              <span className="truncate">Desa {cuaca.lokasi.desa}, Kec. {cuaca.lokasi.kecamatan}, {cuaca.lokasi.kotkab}</span>
            </p>

            {s && (
              <div className={`panel-retro !p-3 mb-3 flex items-center gap-3 ${cuaca.hujan ? 'border-sky-500' : 'border-white/20'}`}>
                <IkonCuaca slot={s} size={40} className={cuaca.hujan ? 'text-sky-300' : jenisCuaca(s.kode) === 'cerah' ? 'text-yellow-300' : 'text-zinc-300'} />
                <div className="flex-1 min-w-0">
                  <p className="font-title text-[18px] text-white">{s.suhu}°C</p>
                  <p className="text-[14px] font-bold">{s.ket}</p>
                  <p className="text-[11px] text-zinc-400">slot {s.lokal.slice(11)} WITA</p>
                </div>
                <div className="text-[12px] text-zinc-300 space-y-0.5 text-right tabular-nums">
                  <p className="flex items-center justify-end gap-1"><Droplets size={12} className="text-sky-300" /> {s.lembap}%</p>
                  <p className="flex items-center justify-end gap-1"><CloudRain size={12} className="text-sky-300" /> {s.hujanMm} mm</p>
                  <p className="flex items-center justify-end gap-1"><Wind size={12} className="text-zinc-400" /> {s.angin} km/j {s.arah}</p>
                </div>
              </div>
            )}

            {saran && <p className="text-[12px] border-2 border-amber-500 bg-amber-950/40 px-2 py-1.5 mb-3 leading-snug">{saran}</p>}

            <p className="label-retro">Per 3 jam</p>
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 custom-scrollbar">
              {cuaca.slot.slice(0, 16).map((x) => (
                <div key={x.utc} className={`shrink-0 w-[62px] border-2 p-1.5 text-center ${intensitasHujan(x.kode) ? 'border-sky-500 bg-sky-950/40' : 'border-white/15'}`}>
                  <p className="text-[10px] text-zinc-400">{x.lokal.slice(11)}</p>
                  <IkonCuaca slot={x} size={18} className={`mx-auto my-1 ${intensitasHujan(x.kode) ? 'text-sky-300' : jenisCuaca(x.kode) === 'cerah' ? 'text-yellow-300' : 'text-zinc-300'}`} />
                  <p className="text-[12px] font-bold tabular-nums">{x.suhu}°</p>
                  <p className="text-[9px] text-zinc-400 leading-tight h-[22px] overflow-hidden">{x.ket}</p>
                </div>
              ))}
            </div>

            <p className="label-retro">Per hari</p>
            <div className="space-y-1 mb-3">
              {hari.map((h) => (
                <div key={h.tanggal} className="flex items-center gap-2 border-b border-white/10 py-1.5 text-[13px]">
                  <span className="w-24 shrink-0">{labelTanggal(h.tanggal)}</span>
                  <IkonCuaca slot={h.wakil} size={16} className={intensitasHujan(h.wakil.kode) ? 'text-sky-300' : 'text-zinc-300'} />
                  <span className="flex-1 min-w-0 truncate text-zinc-300">{h.wakil.ket}{h.hujan ? ` · ${h.mm} mm` : ''}</span>
                  <span className="tabular-nums text-[12px]"><span className="text-sky-300">{h.min}°</span> / <span className="text-orange-300">{h.maks}°</span></span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-zinc-400 leading-snug">
              Sumber: <b>BMKG</b> (Badan Meteorologi, Klimatologi, dan Geofisika) · diperbarui {jamWita(cuaca.diambil)} WITA
              {cuaca.basi && <span className="text-amber-300"> · BMKG sedang tidak bisa dihubungi, menampilkan data terakhir</span>}
            </p>
          </>
        )}
      </div>
    </div>
  );
};
