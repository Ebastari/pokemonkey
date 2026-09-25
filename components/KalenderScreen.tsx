import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, Share2, X, Trash2, CheckCircle2, Clock, Link2, Target,
  Users, Loader2, Maximize2, Minimize2, CalendarCheck, Columns3, Square, LayoutGrid, List, Flag, Pencil, SlidersHorizontal,
} from 'lucide-react';
import { api, ambilServer, demoAktif } from '../lib/api';
import type { JadwalItem, TenggatKalender, Pengguna, AnggotaRingkas, RosterBaris } from '../lib/tipe-api';
import { LIBUR_BAWAAN, LABEL_JENIS, petaLibur, type Libur } from '../lib/libur';
import { type Acara, type Sumber, SUMBER, bangunAcara, kelasAcara, padaTanggal, sepanjangHari, susunMinggu, gridBulanSenin, HARI_SENIN } from '../lib/acara';
import * as W from '../lib/waktu';
import { KalenderBulan } from './KalenderBulan';
import { KalenderAgenda } from './KalenderAgenda';
import { LembarHari, type StatusTim } from './LembarHari';
import { FormJadwal } from './FormJadwal';

/**
 * Kalender tim: Hari · Minggu · Bulan · Agenda, dengan libur nasional,
 * jadwal multi-hari, dan lembar "hari ini ada apa" saat tanggal diketuk.
 */

const JAM_AWAL = 5;
const JAM_AKHIR = 21;
const TINGGI_JAM = 56;
const PX_PER_MENIT = TINGGI_JAM / 60;
const KUNCI_MODE = 'pokemonkey_kalender_mode';

type Mode = 'hari' | 'minggu' | 'bulan' | 'agenda';

const MODE: { id: Mode; label: string; ikon: React.ReactElement }[] = [
  { id: 'hari', label: 'Hari', ikon: <Square size={14} /> },
  { id: 'minggu', label: 'Minggu', ikon: <Columns3 size={14} /> },
  { id: 'bulan', label: 'Bulan', ikon: <LayoutGrid size={14} /> },
  { id: 'agenda', label: 'Agenda', ikon: <List size={14} /> },
];

interface Props {
  pengguna?: Pengguna | null;
  tim?: AnggotaRingkas[];
  opsiRoster?: { nilai: string; label: string }[];
  bacaSaja?: boolean;
  tokenBagi?: string;
  onBukaPica?: (id: string) => void;
  notify?: (pesan: string) => void;
  fokus?: boolean;
  onFokus?: () => void;
  onPerubahanJadwal?: () => void;
}

const modeAwal = (): Mode => {
  try {
    const m = localStorage.getItem(KUNCI_MODE) as Mode | null;
    if (m && MODE.some((x) => x.id === m)) return m;
  } catch { /* abaikan */ }
  return typeof window !== 'undefined' && window.innerWidth < 768 ? 'bulan' : 'minggu';
};

/** Daftar kalender yang tampil + akhir pekan + tanggal merah; dipakai sisi kiri (layar lebar) dan lembar ponsel. */
const PanelKalender: React.FC<{
  aktif: Record<Sumber, boolean>;
  setAktif: React.Dispatch<React.SetStateAction<Record<Sumber, boolean>>>;
  mode: Mode;
  akhirPekan: boolean;
  setAkhirPekan: React.Dispatch<React.SetStateAction<boolean>>;
  liburBulanIni: Libur[];
  onPilihTanggal: (t: string) => void;
}> = ({ aktif, setAktif, mode, akhirPekan, setAkhirPekan, liburBulanIni, onPilihTanggal }) => (
  <>
    <p className="label-retro">Kalender</p>
    {SUMBER.map((s) => (
      <label key={s.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
        <input type="checkbox" className="sr-only" checked={aktif[s.id]} onChange={() => setAktif((a) => ({ ...a, [s.id]: !a[s.id] }))} />
        <span className={`w-3 h-3 border border-white/60 ${aktif[s.id] ? s.titik : 'bg-transparent'}`} />
        <span className={`text-[13px] ${aktif[s.id] ? 'text-white' : 'text-zinc-500 line-through'}`}>{s.label}</span>
      </label>
    ))}
    {mode === 'minggu' && (
      <label className="flex items-center gap-2 py-0.5 mt-1 border-t border-white/10 pt-1.5 cursor-pointer">
        <input type="checkbox" className="sr-only" checked={akhirPekan} onChange={() => setAkhirPekan((v) => !v)} />
        <span className={`w-3 h-3 border border-white/60 ${akhirPekan ? 'bg-white' : ''}`} />
        <span className="text-[13px] text-zinc-200">Tampilkan akhir pekan</span>
      </label>
    )}
    {liburBulanIni.length > 0 && (
      <div className="mt-2 border-t border-white/10 pt-1.5">
        <p className="label-retro flex items-center gap-1"><Flag size={10} /> Tanggal merah</p>
        {liburBulanIni.map((l) => (
          <button key={l.tanggal + l.nama} onClick={() => onPilihTanggal(l.tanggal)} className="block w-full text-left py-0.5 leading-tight hover:bg-white/5">
            <span className={`text-[12px] font-bold ${l.jenis === 'nasional' ? 'text-red-400' : 'text-rose-300'}`}>{+l.tanggal.slice(8)}</span>
            <span className="text-[12px] text-zinc-300 ml-1.5">{l.nama}</span>
          </button>
        ))}
      </div>
    )}
  </>
);

export const KalenderScreen: React.FC<Props> = ({ pengguna, tim = [], opsiRoster = [], bacaSaja = false, tokenBagi, onBukaPica, notify, fokus, onFokus, onPerubahanJadwal }) => {
  const hariIni = W.hariIniWita();
  const [tanggalPilih, setTanggalPilih] = useState(hariIni);
  const [mode, setModeState] = useState<Mode>(modeAwal);
  const [akhirPekan, setAkhirPekan] = useState(true);
  const [aktif, setAktif] = useState<Record<Sumber, boolean>>({ libur: true, tenggat: true, rapat: true, tim: true, saya: true, lain: true, roster: true });
  // Panel "Kalender" di ponsel: isinya sama dengan sisi kiri layar lebar.
  const [panelBuka, setPanelBuka] = useState(false);
  const [jadwal, setJadwal] = useState<JadwalItem[]>([]);
  const [tenggat, setTenggat] = useState<TenggatKalender[]>([]);
  const [liburServer, setLiburServer] = useState<Libur[] | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [menitKini, setMenitKini] = useState(W.menitSekarangWita());
  const [form, setForm] = useState<null | { tanggal: string; jam?: string } | JadwalItem>(null);
  const [detail, setDetail] = useState<Acara | null>(null);
  const [lembar, setLembar] = useState<string | null>(null);
  const [roster, setRoster] = useState<Record<string, RosterBaris[]>>({});
  const [tautan, setTautan] = useState<string | null>(null);
  const [membagikan, setMembagikan] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const setMode = (m: Mode) => { setModeState(m); try { localStorage.setItem(KUNCI_MODE, m); } catch { /* abaikan */ } };

  const tahun = +tanggalPilih.slice(0, 4);
  const bulan = +tanggalPilih.slice(5, 7) - 1;
  const mingguPenuh = useMemo(() => W.mingguDari(tanggalPilih), [tanggalPilih]);
  const hariTampil = useMemo(() => (mode === 'hari' ? [tanggalPilih] : akhirPekan ? mingguPenuh : mingguPenuh.slice(0, 5)), [mode, tanggalPilih, mingguPenuh, akhirPekan]);
  const rentang = useMemo(() => {
    const awalBulan = `${tanggalPilih.slice(0, 7)}-01`;
    return { dari: W.geserHari(W.awalMinggu(awalBulan), -7), sampai: W.geserHari(tanggalPilih, 60) };
  }, [tanggalPilih]);

  // Pilihan lapisan kalender disimpan di server: layar dan widget layar utama
  // selalu menampilkan lapisan yang sama, dan pilihannya ikut walau APK dipasang ulang.
  const lapisanSiap = useRef(false);
  useEffect(() => {
    if (bacaSaja) return;
    api<{ lapisan: Partial<Record<Sumber, boolean>> }>('/api/kalender/lapisan')
      .then((d) => { if (d.lapisan && Object.keys(d.lapisan).length) setAktif((a) => ({ ...a, ...d.lapisan })); })
      .catch(() => undefined)
      .finally(() => { lapisanSiap.current = true; });
  }, [bacaSaja]);

  useEffect(() => {
    if (bacaSaja || !lapisanSiap.current) return;
    const t = setTimeout(() => { void api('/api/kalender/lapisan', { body: { lapisan: aktif } }).catch(() => undefined); }, 600);
    return () => clearTimeout(t);
  }, [aktif, bacaSaja]);

  const muat = useCallback(async () => {
    setMemuat(true); setGalat(null);
    try {
      const q = `?dari=${rentang.dari}&sampai=${rentang.sampai}`;
      const d = await api<{ jadwal: JadwalItem[]; tenggat: TenggatKalender[]; libur?: Libur[] }>(tokenBagi ? `/api/bagi/${tokenBagi}/kalender${q}` : `/api/jadwal${q}`);
      setJadwal(d.jadwal); setTenggat(d.tenggat); setLiburServer(d.libur ?? null);
    } catch (e) { setGalat(e instanceof Error ? e.message : 'Gagal memuat kalender.'); }
    finally { setMemuat(false); }
  }, [rentang.dari, rentang.sampai, tokenBagi]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { const t = setInterval(() => setMenitKini(W.menitSekarangWita()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const el = gridRef.current; if (!el) return;
    el.scrollTop = Math.max(0, (menitKini - JAM_AWAL * 60) * PX_PER_MENIT - 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tanggalPilih]);

  // Libur dari server; bila server belum punya tabelnya / offline, pakai data bawaan.
  const libur = useMemo(
    () => liburServer ?? LIBUR_BAWAAN.filter((l) => l.tanggal >= rentang.dari && l.tanggal <= rentang.sampai),
    [liburServer, rentang.dari, rentang.sampai],
  );
  const liburPeta = useMemo(() => petaLibur(libur), [libur]);

  const rosterSaya = useMemo(() => {
    if (!pengguna || bacaSaja) return [];
    return Object.values(roster).flat().filter((r) => r.user_id === pengguna.id);
  }, [roster, pengguna, bacaSaja]);
  const labelKode = useCallback((k: string) => opsiRoster.find((o) => o.nilai === k)?.label ?? k, [opsiRoster]);

  const semuaAcara = useMemo(
    () => bangunAcara({ jadwal, tenggat, libur, sayaId: pengguna?.id, roster: rosterSaya, labelKode, dari: rentang.dari, sampai: rentang.sampai, hariIni }).filter((a) => aktif[a.sumber]),
    [jadwal, tenggat, libur, pengguna?.id, rosterSaya, labelKode, rentang.dari, rentang.sampai, hariIni, aktif],
  );
  const acaraPada = useCallback((t: string) => semuaAcara.filter((a) => padaTanggal(a, t)), [semuaAcara]);

  // Roster untuk lembar hari: siapa masuk, siapa cuti.
  useEffect(() => {
    if (!lembar || bacaSaja || !pengguna) return;
    const b = lembar.slice(0, 7);
    if (roster[b]) return;
    api<{ roster: RosterBaris[] }>(`/api/roster?bulan=${b}`).then((d) => setRoster((r) => ({ ...r, [b]: d.roster }))).catch(() => undefined);
  }, [lembar, bacaSaja, pengguna, roster]);

  // Roster untuk lapisan kalender: muat bulan-bulan yang sedang tampil.
  useEffect(() => {
    if (bacaSaja || !pengguna || !aktif.roster) return;
    const bulanTampil = new Set<string>();
    for (let t = rentang.dari; t <= rentang.sampai; t = W.geserHari(t, 15)) bulanTampil.add(t.slice(0, 7));
    bulanTampil.add(rentang.sampai.slice(0, 7));
    for (const b of bulanTampil) {
      if (roster[b]) continue;
      api<{ roster: RosterBaris[] }>(`/api/roster?bulan=${b}`)
        .then((d) => setRoster((r) => (r[b] ? r : { ...r, [b]: d.roster })))
        .catch(() => undefined);
    }
  }, [bacaSaja, pengguna, aktif.roster, rentang.dari, rentang.sampai, roster]);

  const statusTim = useMemo<StatusTim[] | undefined>(() => {
    if (!lembar || bacaSaja) return undefined;
    const baris = roster[lembar.slice(0, 7)];
    if (!baris) return undefined;
    return tim.flatMap((t) => {
      const r = baris.find((x) => x.user_id === t.id && x.tanggal === lembar);
      return r ? [{ nama: t.nama, kode: r.kode, label: opsiRoster.find((o) => o.nilai === r.kode)?.label ?? r.kode }] : [];
    });
  }, [lembar, bacaSaja, roster, tim, opsiRoster]);

  const berikutnya = useMemo(() => {
    const berjam = acaraPada(hariIni).filter((a) => !sepanjangHari(a));
    const sedang = berjam.find((a) => a.mulai! <= menitKini && a.selesai! > menitKini);
    if (sedang) return { a: sedang, teks: `berlangsung · ${sedang.selesai! - menitKini} mnt lagi` };
    const nanti = berjam.filter((a) => a.mulai! > menitKini).sort((x, y) => x.mulai! - y.mulai!)[0];
    return nanti ? { a: nanti, teks: `dalam ${nanti.mulai! - menitKini} mnt` } : null;
  }, [acaraPada, hariIni, menitKini]);

  const tenggatDekat = useMemo(() => [...tenggat].sort((x, y) => x.due_date.localeCompare(y.due_date)).slice(0, 4), [tenggat]);
  const liburDekat = useMemo(() => LIBUR_BAWAAN.filter((l) => l.tanggal >= hariIni).slice(0, 3), [hariIni]);
  const liburBulanIni = useMemo(() => libur.filter((l) => l.tanggal.startsWith(tanggalPilih.slice(0, 7))), [libur, tanggalPilih]);

  const geser = (n: number) => {
    if (mode === 'bulan') {
      const d = new Date(Date.UTC(tahun, bulan + n, 1));
      const baru = W.keIso(d);
      setTanggalPilih(baru.slice(0, 7) === hariIni.slice(0, 7) ? hariIni : baru);
    } else {
      setTanggalPilih(W.geserHari(tanggalPilih, n * (mode === 'hari' ? 1 : 7)));
    }
  };

  const bukaLembar = (t: string) => { setTanggalPilih(t); setLembar(t); };

  const bagikan = async () => {
    setMembagikan(true);
    try {
      const d = await api<{ jalur: string }>('/api/bagi', { body: { hari: 90 } });
      const url = `${demoAktif() ? window.location.origin : ambilServer()}${d.jalur}`;
      setTautan(url);
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) await nav.share({ title: 'Kalender POKEMONKEY', text: 'Kalender tim Rev & Rehab (baca-saja)', url }).catch(() => undefined);
    } catch (e) { notify?.(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT TAUTAN'); }
    finally { setMembagikan(false); }
  };

  const bolehBagikan = !bacaSaja && pengguna && (pengguna.peran === 'admin' || pengguna.peran === 'supervisor');
  const judul = mode === 'hari' ? W.formatPanjang(tanggalPilih)
    : mode === 'minggu' ? W.formatJudulMinggu(hariTampil)
    : mode === 'bulan' ? `${W.NAMA_BULAN[bulan]} ${tahun}`
    : `Agenda · mulai ${W.formatPendek(tanggalPilih)}`;

  const jamLabel = Array.from({ length: JAM_AKHIR - JAM_AWAL }, (_, i) => JAM_AWAL + i);
  const tinggiGrid = (JAM_AKHIR - JAM_AWAL) * TINGGI_JAM;
  const garisKini = (menitKini - JAM_AWAL * 60) * PX_PER_MENIT;
  const kolom = `44px repeat(${hariTampil.length}, minmax(0,1fr))`;
  const barSeharian = useMemo(() => susunMinggu(hariTampil, semuaAcara.filter(sepanjangHari)), [hariTampil, semuaAcara]);

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* ---------- Bilah alat ---------- */}
      <div className="flex items-center gap-1.5 px-2 pt-2 pb-2 border-b-4 border-white shrink-0">
        <button onClick={() => geser(-1)} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Sebelumnya"><ChevronLeft size={16} /></button>
        <h2 className="text-[15px] font-bold text-white leading-tight min-w-0 truncate px-1 flex-1 md:flex-none md:min-w-[200px]">
          <CalendarDays size={14} className="inline text-cyan-400 mr-1 -mt-0.5" />{judul}
        </h2>
        <button onClick={() => geser(1)} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Berikutnya"><ChevronRight size={16} /></button>
        <div className="hidden md:block flex-1" />
        {!bacaSaja && (
          <button onClick={() => setPanelBuka(true)} className="md:hidden btn-ikon !w-8 !h-8 bg-zinc-800" title="Pilih kalender yang tampil">
            <SlidersHorizontal size={15} />
          </button>
        )}
        <button onClick={() => setTanggalPilih(hariIni)} className="btn-ikon !w-8 !h-8 md:!w-auto md:px-3 bg-zinc-800" title="Hari ini"><CalendarCheck size={15} /><span className="hidden md:inline ml-1 text-[12px] font-bold uppercase">Hari ini</span></button>
        <div className="hidden md:flex border-2 border-white/40 shrink-0">
          {MODE.map((m) => (
            <button key={m.id} onClick={() => setMode(m.id)} title={m.label} className={`h-8 px-2 flex items-center gap-1 text-[12px] font-bold uppercase ${mode === m.id ? 'bg-cyan-600 text-white' : 'bg-black/40 text-zinc-400 hover:text-white'}`}>
              {m.ikon}<span className="hidden lg:inline">{m.label}</span>
            </button>
          ))}
        </div>
        {!bacaSaja && <button onClick={() => setForm({ tanggal: tanggalPilih })} className="hidden md:inline-flex btn-ikon !w-auto px-3 !h-8 bg-cyan-600"><Plus size={15} /><span className="ml-1 text-[12px] font-bold uppercase">Jadwal</span></button>}
        {bolehBagikan && <button onClick={bagikan} disabled={membagikan} className="btn-ikon !w-8 !h-8 bg-indigo-600" title="Bagikan tautan">{membagikan ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}</button>}
        {onFokus && <button onClick={onFokus} className="btn-ikon !w-8 !h-8 bg-zinc-800" title="Layar penuh">{fokus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>}
      </div>

      {/* Pilihan tampilan di ponsel: baris sendiri agar judul tetap terbaca */}
      <div className="md:hidden flex mx-2 mt-2 border-2 border-white/40 shrink-0">
        {MODE.map((m) => (
          <button key={m.id} onClick={() => setMode(m.id)} className={`flex-1 h-9 flex items-center justify-center gap-1 text-[12px] font-bold uppercase ${mode === m.id ? 'bg-cyan-600 text-white' : 'bg-black/40 text-zinc-400'}`}>
            {m.ikon}{m.label}
          </button>
        ))}
      </div>

      {galat && <div className="mx-2 mt-2 bg-red-950/60 border-2 border-red-500 p-2 text-[12px] text-red-200">{galat}</div>}

      {/* Pita hari (ponsel, tampilan Hari/Minggu) */}
      {(mode === 'hari' || mode === 'minggu') && (
        <div className="md:hidden px-2 pt-2 shrink-0">
          <div className="flex gap-1">
            {mingguPenuh.map((t) => {
              const merah = W.hariKe(t) === 0 || liburPeta.get(t)?.some((l) => l.jenis === 'nasional');
              return (
                <button key={t} onClick={() => { setTanggalPilih(t); setMode('hari'); }} className={`flex-1 py-1 border-2 text-center leading-tight ${t === tanggalPilih ? 'bg-cyan-600 border-white' : t === hariIni ? 'bg-black/60 border-cyan-400' : 'bg-black/40 border-white/15'}`}>
                  <div className={`text-[10px] uppercase ${merah ? 'text-red-300' : 'text-zinc-200'}`}>{W.NAMA_HARI[W.hariKe(t)]}</div>
                  <div className={`text-[14px] font-bold ${merah && t !== tanggalPilih ? 'text-red-400' : ''}`}>{+t.slice(8)}</div>
                  <div className={`w-1.5 h-1.5 mx-auto ${acaraPada(t).some((a) => a.sumber !== 'libur') ? 'bg-amber-400' : 'bg-transparent'}`} />
                </button>
              );
            })}
          </div>
          {berikutnya && mode === 'hari' && (
            <button onClick={() => setDetail(berikutnya.a)} className="w-full mt-2 text-left panel-retro !py-1.5 !px-2 flex items-center gap-2">
              <Clock size={12} className="text-cyan-300 shrink-0" />
              <span className="text-[12px] text-white font-bold truncate flex-1">{berikutnya.a.judul}</span>
              <span className="text-[11px] text-cyan-300 whitespace-nowrap">{berikutnya.teks}</span>
            </button>
          )}
        </div>
      )}

      <div className="flex-1 flex gap-2 overflow-hidden p-2 min-h-0">
        {/* ---------- Kiri: mini-bulan + sumber ---------- */}
        {!bacaSaja && (
          <aside className="hidden md:flex w-48 flex-col gap-2 shrink-0 min-h-0">
            <div className="panel-retro !p-2">
              <div className="flex items-center justify-between mb-1.5 gap-1">
                <button onClick={() => setTanggalPilih(W.keIso(new Date(Date.UTC(tahun, bulan - 1, 1))))} className="p-1 hover:text-cyan-300" aria-label="Bulan sebelumnya"><ChevronLeft size={13} /></button>
                <span className="text-[13px] font-bold text-cyan-300 flex-1 text-center">{W.NAMA_BULAN_PENDEK[bulan]} {tahun}</span>
                <button onClick={() => setTanggalPilih(W.keIso(new Date(Date.UTC(tahun, bulan + 1, 1))))} className="p-1 hover:text-cyan-300" aria-label="Bulan berikutnya"><ChevronRight size={13} /></button>
                <button onClick={() => setMode('bulan')} className={`btn-ikon !w-6 !h-6 !border-2 ${mode === 'bulan' ? 'bg-cyan-600' : 'bg-zinc-800'}`} title="Perbesar ke tampilan bulan"><Maximize2 size={11} /></button>
              </div>
              <div className="grid grid-cols-7 gap-px">
                {HARI_SENIN.map((h, i) => <div key={h} className={`text-[10px] text-center pb-0.5 ${i === 6 ? 'text-red-400' : 'text-zinc-400'}`}>{h}</div>)}
                {gridBulanSenin(tahun, bulan).flat().map((t, i) => {
                  const diBulan = +t.slice(5, 7) - 1 === bulan;
                  const merah = i % 7 === 6 || liburPeta.get(t)?.some((l) => l.jenis === 'nasional');
                  const adaAcara = acaraPada(t).some((a) => a.sumber !== 'libur');
                  return (
                    <button key={t} onClick={() => bukaLembar(t)} title={liburPeta.get(t)?.map((l) => l.nama).join(' · ')}
                      className={`h-6 text-[12px] leading-none flex flex-col items-center justify-center border ${
                        t === hariIni ? 'bg-cyan-500 border-white text-black font-bold'
                          : t === tanggalPilih ? 'border-cyan-300 text-white'
                          : 'border-transparent hover:border-white/30'
                      } ${!diBulan ? 'opacity-35' : ''} ${merah && t !== hariIni ? 'text-red-400' : ''}`}>
                      {+t.slice(8)}
                      <span className={`w-1 h-[3px] mt-px ${adaAcara ? (t === hariIni ? 'bg-black' : 'bg-amber-400') : 'bg-transparent'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="panel-retro !p-2 flex-1 overflow-auto custom-scrollbar min-h-0">
              <PanelKalender aktif={aktif} setAktif={setAktif} mode={mode} akhirPekan={akhirPekan} setAkhirPekan={setAkhirPekan} liburBulanIni={liburBulanIni} onPilihTanggal={bukaLembar} />
            </div>
          </aside>
        )}

        {/* ---------- Tengah ---------- */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {mode === 'bulan' && (
            <KalenderBulan tahun={tahun} bulan={bulan} hariIni={hariIni} tanggalPilih={tanggalPilih} acara={semuaAcara} libur={liburPeta}
              onPilihHari={bukaLembar} onBukaAcara={setDetail} onTambah={bacaSaja ? undefined : (t) => setForm({ tanggal: t })} />
          )}

          {mode === 'agenda' && (
            <KalenderAgenda acara={semuaAcara} dari={tanggalPilih} hariIni={hariIni} onPilihHari={bukaLembar} onBukaAcara={setDetail} />
          )}

          {(mode === 'hari' || mode === 'minggu') && (
            <div className="flex-1 flex flex-col min-h-0 border-[3px] border-white/40 bg-black/70">
              <div className="grid border-b-2 border-white/20 shrink-0" style={{ gridTemplateColumns: kolom }}>
                <div className="text-[10px] text-zinc-400 flex items-end justify-center pb-1">WITA</div>
                {hariTampil.map((t) => {
                  const merah = W.hariKe(t) === 0 || liburPeta.get(t)?.some((l) => l.jenis === 'nasional');
                  return (
                    <button key={t} onClick={() => bukaLembar(t)} className="py-1 text-center border-l border-white/10 hover:bg-white/5 leading-tight">
                      <div className={`text-[10px] uppercase ${merah ? 'text-red-400' : 'text-zinc-300'}`}>{W.NAMA_HARI[W.hariKe(t)]}</div>
                      <div className={`text-[14px] font-bold inline-block px-1.5 ${t === hariIni ? 'bg-cyan-500 text-black' : merah ? 'text-red-400' : 'text-white'}`}>{+t.slice(8)}</div>
                    </button>
                  );
                })}
              </div>

              {/* Sepanjang hari & multi-hari sebagai bar yang menyambung */}
              <div className="grid border-b-2 border-white/20 bg-zinc-950/70 shrink-0 max-h-[96px] overflow-auto custom-scrollbar py-0.5" style={{ gridTemplateColumns: kolom, gridAutoRows: 18, rowGap: 1 }}>
                <div className="text-[9px] text-zinc-400 uppercase flex items-center justify-center" style={{ gridColumn: 1, gridRow: `1 / span ${Math.max(1, ...barSeharian.map((b) => b.lajur + 1))}` }}>Hari</div>
                {barSeharian.map((b) => (
                  <button key={b.a.kunci} onClick={() => setDetail(b.a)} title={b.a.judul}
                    className={`text-left text-[11px] leading-none truncate px-1 border-l-[3px] mx-px ${kelasAcara(b.a)} ${b.a.selesaiDitandai ? 'line-through opacity-50' : ''}`}
                    style={{ gridColumn: `${b.kolom + 2} / span ${b.rentang}`, gridRow: b.lajur + 1 }}>
                    {b.lanjutKiri && '‹ '}{b.a.judul}{b.lanjutKanan && ' ›'}
                  </button>
                ))}
              </div>

              <div ref={gridRef} className="flex-1 overflow-auto custom-scrollbar relative min-h-0">
                <div className="grid relative" style={{ gridTemplateColumns: kolom, height: tinggiGrid }}>
                  <div className="relative">
                    {jamLabel.map((j) => <div key={j} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-zinc-400" style={{ top: (j - JAM_AWAL) * TINGGI_JAM }}>{String(j).padStart(2, '0')}:00</div>)}
                  </div>
                  {hariTampil.map((t) => {
                    const berjam = acaraPada(t).filter((a) => !sepanjangHari(a)).sort((x, y) => x.mulai! - y.mulai!);
                    const akhirLajur: number[] = [];
                    const tersusun = berjam.map((a) => {
                      let l = akhirLajur.findIndex((e) => e <= a.mulai!);
                      if (l < 0) { l = akhirLajur.length; akhirLajur.push(0); }
                      akhirLajur[l] = a.selesai!;
                      return { a, l };
                    });
                    const total = Math.max(1, akhirLajur.length);
                    return (
                      <div key={t} className={`relative border-l border-white/10 ${t === hariIni ? 'bg-cyan-500/5' : ''}`}
                        onDoubleClick={(e) => { if (bacaSaja) return; const y = e.clientY - e.currentTarget.getBoundingClientRect().top; setForm({ tanggal: t, jam: W.jamDariMenit(JAM_AWAL * 60 + Math.floor(y / PX_PER_MENIT / 30) * 30) }); }}>
                        {jamLabel.map((j) => <div key={j} className="absolute left-0 right-0 border-t border-white/10" style={{ top: (j - JAM_AWAL) * TINGGI_JAM }} />)}
                        {tersusun.map(({ a, l }) => {
                          const top = (a.mulai! - JAM_AWAL * 60) * PX_PER_MENIT;
                          const tinggi = Math.max(24, (a.selesai! - a.mulai!) * PX_PER_MENIT);
                          return (
                            <button key={a.kunci} onClick={() => setDetail(a)} className={`absolute border-l-4 px-1.5 py-0.5 text-left overflow-hidden hover:z-30 ${kelasAcara(a)} ${a.selesaiDitandai ? 'opacity-50' : ''}`}
                              style={{ top, height: tinggi, left: `${(l * 100) / total}%`, width: `calc(${100 / total}% - 3px)`, zIndex: 10 + l }}>
                              <div className={`text-[12px] leading-tight font-bold truncate ${a.selesaiDitandai ? 'line-through' : ''}`}>{a.judul}</div>
                              {tinggi > 34 && <div className="text-[11px] opacity-85 truncate">{W.jamDariMenit(a.mulai!)}–{W.jamDariMenit(a.selesai!)}{a.sub ? ` · ${a.sub}` : ''}</div>}
                            </button>
                          );
                        })}
                        {t === hariIni && garisKini >= 0 && garisKini <= tinggiGrid && (
                          <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: garisKini }}>
                            <div className="h-0.5 bg-red-500" /><div className="absolute -left-1 -top-[3px] w-2 h-2 bg-red-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {memuat && <div className="absolute top-14 right-4 text-[11px] text-cyan-300 flex items-center gap-1 pointer-events-none"><Loader2 size={11} className="animate-spin" /> memuat</div>}
        </main>

        {/* ---------- Kanan ---------- */}
        <aside className="hidden xl:flex w-52 flex-col gap-2 shrink-0 min-h-0">
          <div className="panel-retro">
            <p className="label-retro flex items-center gap-1"><Clock size={11} /> Berikutnya</p>
            {berikutnya ? (
              <button onClick={() => setDetail(berikutnya.a)} className="text-left w-full">
                <p className="text-[14px] font-bold text-white leading-snug">{berikutnya.a.judul}</p>
                <p className="text-[12px] text-cyan-300 mt-0.5">{berikutnya.teks}</p>
              </button>
            ) : <p className="text-[12px] text-zinc-400">Tidak ada jadwal berjam lagi hari ini.</p>}
          </div>
          <div className="panel-retro flex-1 overflow-auto custom-scrollbar min-h-0">
            <p className="label-retro flex items-center gap-1"><Target size={11} /> Tenggat terdekat</p>
            {tenggatDekat.length === 0 && <p className="text-[12px] text-zinc-400">Tidak ada tenggat.</p>}
            {tenggatDekat.map((t) => {
              const sisa = W.selisihHari(t.due_date, hariIni);
              return (
                <button key={t.id} onClick={() => onBukaPica?.(t.id)} className="block w-full text-left border-b border-white/10 py-1.5 hover:bg-white/5">
                  <p className="text-[11px] text-zinc-400">{t.id} · {t.pic_nama ?? '—'}</p>
                  <p className="text-[12px] text-white leading-snug line-clamp-2">{t.judul}</p>
                  <p className={`text-[11px] mt-0.5 ${sisa < 0 ? 'text-red-400' : sisa <= 3 ? 'text-amber-300' : 'text-emerald-300'}`}>{W.formatPendek(t.due_date)} · {W.teksSisa(sisa)}</p>
                </button>
              );
            })}
          </div>
          <div className="panel-retro">
            <p className="label-retro flex items-center gap-1"><Flag size={11} /> Libur terdekat</p>
            {liburDekat.map((l) => (
              <button key={l.tanggal + l.nama} onClick={() => bukaLembar(l.tanggal)} className="block w-full text-left py-0.5 hover:bg-white/5 leading-tight">
                <p className="text-[12px] text-white truncate">{l.nama}</p>
                <p className="text-[11px] text-red-300">{W.formatPanjang(l.tanggal)} · {W.teksSisa(W.selisihHari(l.tanggal, hariIni))}</p>
              </button>
            ))}
          </div>
          {bacaSaja && <div className="panel-retro !border-indigo-500"><p className="label-retro !text-indigo-200 flex items-center gap-1"><Users size={11} /> Tampilan berbagi</p><p className="text-[12px] text-zinc-300">Baca-saja. Masuk ke aplikasi untuk mengubah jadwal.</p></div>}
        </aside>
      </div>

      {/* Tombol tambah melayang (ponsel) */}
      {!bacaSaja && (
        <button onClick={() => setForm({ tanggal: tanggalPilih })} className="md:hidden absolute right-3 bottom-3 z-40 w-14 h-14 bg-cyan-500 text-black border-[3px] border-white shadow-[4px_4px_0_#000] flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5" aria-label="Tambah jadwal">
          <Plus size={26} strokeWidth={3} />
        </button>
      )}

      {lembar && (
        <LembarHari tanggal={lembar} hariIni={hariIni} acara={acaraPada(lembar)} libur={liburPeta.get(lembar) ?? []} tim={statusTim} bacaSaja={bacaSaja}
          onGeser={(n) => { const t = W.geserHari(lembar, n); setLembar(t); setTanggalPilih(t); }}
          onTutup={() => setLembar(null)} onTambah={(t) => setForm({ tanggal: t })} onBukaAcara={setDetail} />
      )}

      {tautan && (
        <Modal judul="Tautan berbagi" onTutup={() => setTautan(null)}>
          <p className="text-[13px] text-zinc-200 leading-relaxed">Siapa pun yang punya tautan ini bisa melihat kalender (baca-saja) di komputer atau ponsel tanpa masuk. Berlaku 90 hari.</p>
          <div className="bg-black border-2 border-white/30 p-2 text-[12px] text-cyan-300 font-mono break-all select-all">{tautan}</div>
          <button onClick={() => { navigator.clipboard?.writeText(tautan); notify?.('TAUTAN DISALIN'); }} className="btn-retro bg-indigo-600 w-full"><Link2 size={14} /> Salin tautan</button>
        </Modal>
      )}

      {panelBuka && (
        <div className="md:hidden fixed inset-0 z-[90] bg-black/80 flex items-end" onClick={() => setPanelBuka(false)}>
          <div className="w-full retro-box !bg-zinc-900 border-cyan-500 max-h-[80vh] overflow-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b-2 border-white/20 pb-2 mb-2">
              <h3 className="judul-layar text-cyan-300">Kalender</h3>
              <button onClick={() => setPanelBuka(false)} className="text-zinc-400" aria-label="Tutup"><X size={20} /></button>
            </div>
            <PanelKalender aktif={aktif} setAktif={setAktif} mode={mode} akhirPekan={akhirPekan} setAkhirPekan={setAkhirPekan} liburBulanIni={liburBulanIni}
              onPilihTanggal={(t) => { setPanelBuka(false); bukaLembar(t); }} />
          </div>
        </div>
      )}

      {detail && (
        <Modal judul={detail.libur ? LABEL_JENIS[detail.libur.jenis] : detail.tenggat ? 'Tenggat PICA' : 'Jadwal'} onTutup={() => setDetail(null)}>
          <p className="text-[16px] font-bold text-white leading-snug">{detail.judul}</p>
          <p className="text-[13px] text-cyan-300">
            {detail.mulaiTgl !== detail.selesaiTgl ? `${W.formatPanjang(detail.mulaiTgl)} – ${W.formatPanjang(detail.selesaiTgl)} (${W.selisihHari(detail.selesaiTgl, detail.mulaiTgl) + 1} hari)` : W.formatPanjang(detail.mulaiTgl)}
            {detail.mulai !== null && ` · ${W.jamDariMenit(detail.mulai)}–${W.jamDariMenit(detail.selesai!)} WITA`}
          </p>
          {detail.sub && <p className="text-[12px] text-zinc-300 uppercase">{detail.sub}</p>}
          {detail.libur?.perkiraan && <p className="text-[12px] text-amber-300">Tanggal hari besar Islam masih menunggu penetapan Menteri Agama.</p>}
          {detail.jadwal?.keterangan && <p className="text-[13px] text-zinc-200 leading-relaxed border-t border-white/10 pt-2">{detail.jadwal.keterangan}</p>}
          {detail.jadwal?.rrule && <p className="text-[12px] text-indigo-300 uppercase">Berulang · {/WEEKLY/i.test(detail.jadwal.rrule) ? 'tiap minggu' : 'tiap hari'}</p>}
          {detail.tenggat && onBukaPica && <button onClick={() => { onBukaPica(detail.tenggat!.id); setDetail(null); }} className="btn-retro bg-amber-600 w-full"><Target size={14} /> Buka PICA</button>}
          {!bacaSaja && detail.jadwal && (
            <div className="flex gap-2">
              <button onClick={async () => { await api(`/api/jadwal/${detail.jadwal!.id}`, { method: 'PATCH', body: { selesai: !detail.selesaiDitandai } }); setDetail(null); muat(); onPerubahanJadwal?.(); }} className={`btn-retro btn-retro-sm flex-1 ${detail.selesaiDitandai ? 'bg-zinc-700' : 'bg-green-600'}`}><CheckCircle2 size={13} /> {detail.selesaiDitandai ? 'Batal' : 'Selesai'}</button>
              <button onClick={() => { setForm(detail.jadwal!); setDetail(null); }} className="btn-retro btn-retro-sm bg-zinc-700"><Pencil size={13} /> Ubah</button>
              <button onClick={async () => { if (!confirm('Hapus jadwal ini?')) return; try { await api(`/api/jadwal/${detail.jadwal!.id}`, { method: 'DELETE' }); setDetail(null); muat(); onPerubahanJadwal?.(); } catch (e) { notify?.(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); } }} className="btn-retro btn-retro-sm bg-red-900"><Trash2 size={13} /></button>
            </div>
          )}
        </Modal>
      )}

      {form && <FormJadwal awal={form} pengguna={pengguna ?? null} onTutup={() => setForm(null)} onSimpan={(pesan) => { setForm(null); muat(); onPerubahanJadwal?.(); notify?.(pesan); }} />}
    </div>
  );
};

const Modal: React.FC<{ judul: string; onTutup: () => void; children: React.ReactNode }> = ({ judul, onTutup, children }) => (
  <div className="fixed inset-0 z-[105] bg-black/85 backdrop-blur-sm flex items-end md:items-center justify-center md:p-3" onClick={onTutup}>
    <div className="retro-box !bg-zinc-900 w-full md:max-w-sm border-cyan-500 flex flex-col gap-3 max-h-[90vh] overflow-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center border-b-2 border-white/20 pb-2">
        <h3 className="judul-layar text-cyan-300">{judul}</h3>
        <button onClick={onTutup} className="text-zinc-400 hover:text-white"><X size={20} /></button>
      </div>
      {children}
    </div>
  </div>
);
