import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Wand2, X, Plus, Loader2, ImageDown, ChartColumnStacked, FileSpreadsheet, Flag } from 'lucide-react';
import { api, GalatApi } from '../lib/api';
import { unduhGambar } from '../lib/gambar';
import { eksporRosterKerja } from '../lib/roster-excel';
import { namaTampil, namaDepan } from '../lib/nama';
import type { Bootstrap, Opsi, Pengguna, RosterBaris } from '../lib/tipe-api';
import { warna } from '../lib/warna';
import * as W from '../lib/waktu';
import { LIBUR_BAWAAN, petaLibur, type Libur } from '../lib/libur';
import { HARI_SENIN } from '../lib/acara';

/**
 * Roster bulanan: baris = anggota, kolom = tanggal, sel = kode sama dengan berkas
 * Excel resmi (D siang, N malam, OFF libur, FB field break, IK ijin khusus). Kode adalah data (tabel opsi), jadi jenis baru
 * bisa ditambah dari layar ini. Admin/Supervisor mengatur semua; anggota
 * mengisi miliknya sendiri.
 */

interface Props { boot: Bootstrap; pengguna: Pengguna; notify: (m: string) => void }

type SaringKelompok = 'semua' | 'ebl' | 'kbs';
const SARING_KELOMPOK: { id: SaringKelompok; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'ebl', label: 'PT EBL' },
  { id: 'kbs', label: 'CV KBS' },
];
const KUNCI_SARING = 'pokemonkey_roster_kelompok';

export const RosterScreen: React.FC<Props> = ({ boot, pengguna, notify }) => {
  const hariIni = W.hariIniWita();
  const [bulan, setBulan] = useState(hariIni.slice(0, 7));
  const [roster, setRoster] = useState<RosterBaris[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [sel, setSel] = useState<{ user_id: string; tanggal: string } | null>(null);
  const [isiCepat, setIsiCepat] = useState(false);
  const [kodeBaru, setKodeBaru] = useState<{ nilai: string; label: string; warna: string } | null>(null);

  const kode = useMemo(() => boot.opsi.filter((o) => o.grup === 'roster'), [boot.opsi]);
  const [libur, setLibur] = useState<Libur[]>(LIBUR_BAWAAN);
  const liburPeta = useMemo(() => petaLibur(libur), [libur]);
  const bolehKelola = pengguna.peran === 'admin' || pengguna.peran === 'supervisor';

  const [tahun, bln] = bulan.split('-').map(Number);
  const jumlahHari = new Date(Date.UTC(tahun, bln, 0)).getUTCDate();
  const tanggalList = useMemo(() => Array.from({ length: jumlahHari }, (_, i) => `${bulan}-${String(i + 1).padStart(2, '0')}`), [bulan, jumlahHari]);

  const muat = useCallback(async () => {
    setMemuat(true);
    try { const d = await api<{ roster: RosterBaris[] }>(`/api/roster?bulan=${bulan}`); setRoster(d.roster); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT ROSTER'); }
    finally { setMemuat(false); }
  }, [bulan, notify]);
  useEffect(() => { muat(); }, [muat]);

  // Libur dari server (termasuk revisi Admin); data bawaan dipakai bila gagal.
  useEffect(() => {
    api<{ libur: Libur[] }>(`/api/libur?tahun=${tahun}`)
      .then((d) => { if (d.libur.length) setLibur((l) => [...l.filter((x) => !x.tanggal.startsWith(String(tahun))), ...d.libur]); })
      .catch(() => undefined);
  }, [tahun]);

  const peta = useMemo(() => {
    const m = new Map<string, RosterBaris>();
    roster.forEach((r) => m.set(`${r.user_id}|${r.tanggal}`, r));
    return m;
  }, [roster]);

  const geserBulan = (n: number) => {
    const d = new Date(Date.UTC(tahun, bln - 1 + n, 1));
    setBulan(d.toISOString().slice(0, 7));
  };

  const simpanSel = async (user_id: string, tanggal: string, k: string, catatan?: string) => {
    try {
      await api('/api/roster', { body: { user_id, tanggal, kode: k, catatan } });
      setRoster((r) => {
        const sisa = r.filter((x) => !(x.user_id === user_id && x.tanggal === tanggal));
        return k ? [...sisa, { user_id, tanggal, kode: k, catatan: catatan ?? null }] : sisa;
      });
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN'); }
  };

  const tambahKode = async () => {
    if (!kodeBaru?.nilai || !kodeBaru.label) return;
    try {
      await api('/api/opsi', { body: { grup: 'roster', nilai: kodeBaru.nilai.toUpperCase(), label: kodeBaru.label, warna: kodeBaru.warna } });
      notify('KODE DITAMBAHKAN — MUAT ULANG UNTUK MELIHAT'); setKodeBaru(null);
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };

  // Bawaan tampilan: kolom hari ini langsung terlihat (di HP tabelnya lebih lebar dari layar).
  useEffect(() => {
    if (bulan !== hariIni.slice(0, 7) || sudahGeser.current === bulan) return;
    const sel = kolomHariIni.current;
    const wadah = wadahTabel.current;
    if (!sel || !wadah) return;
    const kolomNama = 120; // kolom nama menempel di kiri, jangan tertutup
    const geser = sel.getBoundingClientRect().left - wadah.getBoundingClientRect().left - kolomNama;
    wadah.scrollLeft = Math.max(0, wadah.scrollLeft + geser);
    sudahGeser.current = bulan; // sekali saja per bulan, agar tidak melompat saat sel diubah
  }, [bulan, hariIni, roster.length, memuat]);

  const liburBulanIni = tanggalList.flatMap((t) => (liburPeta.get(t) ?? []).map((l) => ({ tanggal: t, l })));
  // Kelompok perusahaan: anggota CV KBS ditampilkan terpisah di bawah tim inti.
  const kelompokDari = (bidang?: string | null) => (bidang ?? '').trim().toUpperCase() === 'CV KBS' ? 'CV KBS' : 'PT EBL / TAHURA';
  const [saringKelompok, setSaringKelompok] = useState<SaringKelompok>(() => {
    try { const v = localStorage.getItem(KUNCI_SARING); if (v === 'ebl' || v === 'kbs') return v; } catch { /* abaikan */ }
    return 'semua';
  });
  const gantiSaring = (v: SaringKelompok) => {
    setSaringKelompok(v);
    try { localStorage.setItem(KUNCI_SARING, v); } catch { /* abaikan */ }
  };
  const lolosSaring = (bidang?: string | null) =>
    saringKelompok === 'semua' || (kelompokDari(bidang) === 'CV KBS') === (saringKelompok === 'kbs');
  // Tabel, grafik, ringkasan hari ini, gambar, dan Excel semuanya memakai daftar yang sudah disaring.
  const timUrut = useMemo(() => {
    const urutan = (t: Bootstrap['tim'][number]) => (kelompokDari(t.bidang) === 'CV KBS' ? 1 : 0);
    return [...boot.tim].filter((t) => lolosSaring(t.bidang)).sort((a, b) => urutan(a) - urutan(b) || a.nama.localeCompare(b.nama));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot.tim, saringKelompok]);
  const labelSaring = SARING_KELOMPOK.find((s) => s.id === saringKelompok)!;
  const akhiranSaring = saringKelompok === 'semua' ? '' : ` · ${labelSaring.label}`;

  const ringkasHariIni = timUrut.map((t) => ({ t, k: peta.get(`${t.id}|${hariIni}`)?.kode }));
  const bolehUbah = (_userId: string) => bolehKelola;
  const judulBulan = `${W.NAMA_BULAN[bln - 1]} ${tahun}`;
  const judulBulanSaring = judulBulan + akhiranSaring;

  const [mengekspor, setMengekspor] = useState(false);
  /** Excel mengikuti berkas "Template Roster Kerja" milik perusahaan (lihat lib/roster-excel.ts). */
  const eksporExcel = async () => {
    setMengekspor(true);
    try {
      const hasil = await eksporRosterKerja({
        bulan,
        tanggalList,
        tim: timUrut.map((t) => ({ id: t.id, nama: t.nama, jabatan: t.jabatan ?? t.bidang ?? '', kelompok: kelompokDari(t.bidang) })),
        peta: new Map([...peta].map(([k, v]) => [k, { kode: v.kode, catatan: v.catatan }])),
        labelKode: (k) => kode.find((x) => x.nilai === k)?.label ?? k,
        libur: liburPeta,
        dibuatOleh: pengguna.nama,
        departemen: 'Revegetasi & Rehabilitasi',
        kelompokUtama: 'PT EBL / TAHURA',
        namaBerkas: `ROSTER KERJA ${bulan}${saringKelompok === 'semua' ? '' : ` ${labelSaring.label}`}.xlsx`,
      });
      notify(hasil === 'diunduh' ? 'ROSTER DIEKSPOR' : 'ROSTER SIAP DIBAGIKAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'EKSPOR GAGAL'); }
    finally { setMengekspor(false); }
  };

  const areaRoster = useRef<HTMLDivElement>(null);
  const wadahTabel = useRef<HTMLDivElement>(null);
  const kolomHariIni = useRef<HTMLTableCellElement>(null);
  const sudahGeser = useRef('');
  const [mengunduh, setMengunduh] = useState(false);
  const unduh = async (el: HTMLElement | null, nama: string, judul: string, keterangan?: string) => {
    if (!el || mengunduh) return;
    setMengunduh(true);
    try {
      const hasil = await unduhGambar(el, { nama, judul, keterangan });
      notify(hasil === 'diunduh' ? 'GAMBAR DIUNDUH' : 'GAMBAR SIAP DIBAGIKAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT GAMBAR'); }
    finally { setMengunduh(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 border-b-4 border-white pb-2 mb-2 px-2 pt-2">
        <h2 className="judul-layar flex items-center gap-2 mr-auto"><CalendarRange size={16} className="text-teal-400" /> Roster</h2>
        <button onClick={() => geserBulan(-1)} className="btn-ikon !w-8 !h-8 bg-zinc-800"><ChevronLeft size={16} /></button>
        <span className="text-[14px] font-bold text-white min-w-[120px] text-center">{judulBulan}</span>
        <button onClick={() => geserBulan(1)} className="btn-ikon !w-8 !h-8 bg-zinc-800"><ChevronRight size={16} /></button>
        <div className="flex border-2 border-white/30" role="group" aria-label="Saring kelompok">
          {SARING_KELOMPOK.map((s) => (
            <button
              key={s.id}
              onClick={() => gantiSaring(s.id)}
              aria-pressed={saringKelompok === s.id}
              className={`px-2 h-7 text-[11px] font-bold uppercase ${saringKelompok === s.id ? 'bg-teal-500 text-black' : 'bg-zinc-800 text-zinc-300 hover:text-white'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={() => unduh(areaRoster.current, `roster-${bulan}${saringKelompok === 'semua' ? '' : `-${saringKelompok}`}`, `Roster · ${judulBulanSaring}`)} disabled={mengunduh} className="btn-ikon !w-8 !h-8 bg-zinc-800" title="Unduh gambar roster">{mengunduh ? <Loader2 size={15} className="animate-spin" /> : <ImageDown size={15} />}</button>
        <button onClick={eksporExcel} disabled={mengekspor} className="btn-ikon !w-8 !h-8 sm:!w-auto sm:px-3 bg-emerald-700" title="Ekspor ke Excel">{mengekspor ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}<span className="hidden sm:inline ml-1 text-[12px] font-bold uppercase">Excel</span></button>
        {bolehKelola && <button onClick={() => setIsiCepat(true)} className="btn-ikon !w-8 !h-8 sm:!w-auto sm:px-3 bg-teal-600" title="Isi cepat"><Wand2 size={15} /><span className="hidden sm:inline ml-1 text-[12px] font-bold uppercase">Isi cepat</span></button>}
      </div>

      {/* Hari ini */}
      {bulan === hariIni.slice(0, 7) && (
        <div className="px-2 mb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-zinc-400 uppercase mr-1">Hari ini</span>
          {ringkasHariIni.map(({ t, k }) => {
            const o = kode.find((x) => x.nilai === k);
            const w = warna(o?.warna);
            return <span key={t.id} className={`chip-retro ${k ? `${w.garis} ${w.teks} ${w.latar}` : 'border-zinc-600 text-zinc-500'}`}>{namaDepan(t.nama)} · {o?.label ?? 'belum diisi'}</span>;
          })}
        </div>
      )}

      <div ref={wadahTabel} className="flex-1 overflow-auto custom-scrollbar px-2 pb-2 min-h-0">
        {/* Area yang direkam "Unduh gambar": tabel + legenda. */}
        <div ref={areaRoster} className="w-max min-w-full">
        <div className="inline-block min-w-full border-[3px] border-white/40 bg-black/60">
          <table className="border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-20 bg-zinc-900 border-r-2 border-b-2 border-white/30 p-2 text-left text-[11px] uppercase text-zinc-300 min-w-[110px]">Anggota</th>
                {tanggalList.map((t) => {
                  const h = W.hariKe(t);
                  const akhirPekan = h === 0 || h === 6;
                  const lbr = liburPeta.get(t);
                  const merah = h === 0 || lbr?.some((l) => l.jenis === 'nasional');
                  const cuti = lbr?.some((l) => l.jenis === 'cuti');
                  return (
                    <th key={t} ref={t === hariIni ? kolomHariIni : undefined} title={lbr?.map((l) => l.nama).join(' · ') ?? (merah ? 'Hari Minggu' : undefined)} className={`border-b-2 border-white/30 px-0.5 py-1 text-center min-w-[34px] leading-tight ${t === hariIni ? 'bg-cyan-600 text-black' : lbr ? (merah ? 'bg-red-600/85' : 'bg-rose-600/70') : akhirPekan ? 'bg-white/10' : ''} ${t === hariIni ? '' : lbr ? 'text-white' : merah ? 'text-red-400' : cuti ? 'text-rose-300' : 'text-zinc-200'}`}>
                      <div className="text-[10px] flex items-center justify-center gap-0.5">{lbr && <Flag size={8} />}{HARI_SENIN[(h + 6) % 7]}</div><div className="text-[12px] font-bold">{+t.slice(8)}</div>
                      <div className={`h-[3px] mx-1 mt-0.5 ${lbr ? (merah ? 'bg-red-300' : 'bg-rose-200') : 'bg-transparent'}`} />
                    </th>
                  );
                })}
                <th className="border-b-2 border-l-2 border-white/30 px-2 text-[10px] uppercase text-zinc-300 whitespace-nowrap">Rekap</th>
              </tr>
            </thead>
            <tbody>
              {timUrut.map((t, i) => {
                const rekap = kode.map((k) => ({ k, n: tanggalList.filter((tg) => peta.get(`${t.id}|${tg}`)?.kode === k.nilai).length })).filter((x) => x.n > 0);
                const kelompok = kelompokDari(t.bidang);
                const kelompokBaru = i === 0 || kelompok !== kelompokDari(timUrut[i - 1].bidang);
                return (
                  <React.Fragment key={t.id}>
                  {kelompokBaru && (
                    <tr>
                      <td colSpan={tanggalList.length + 2} className="sticky left-0 bg-zinc-800 border-y-2 border-white/25 px-2 py-1 text-[11px] font-bold uppercase text-teal-300 tracking-wide">
                        {kelompok}
                      </td>
                    </tr>
                  )}
                  <tr className={t.id === pengguna.id ? 'bg-teal-500/5' : ''}>
                    <td className="sticky left-0 z-10 bg-zinc-900 border-r-2 border-b border-white/15 p-2 leading-tight">
                      <div className="text-[13px] font-bold text-white truncate max-w-[130px]" title={t.nama}>{namaTampil(t.nama)}</div>
                      <div className="text-[10px] text-zinc-400 uppercase truncate max-w-[130px]">{t.bidang ?? t.peran}</div>
                    </td>
                    {tanggalList.map((tg) => {
                      const r = peta.get(`${t.id}|${tg}`);
                      const o = kode.find((x) => x.nilai === r?.kode);
                      const w = warna(o?.warna);
                      const h = W.hariKe(tg);
                      return (
                        <td key={tg} className={`border-b border-white/10 border-l border-white/5 p-0.5 text-center ${liburPeta.get(tg) ? 'bg-red-500/10' : h === 0 || h === 6 ? 'bg-white/5' : ''} ${tg === hariIni ? 'bg-cyan-500/10' : ''}`}>
                          <button
                            onClick={() => bolehUbah(t.id) && setSel({ user_id: t.id, tanggal: tg })}
                            title={r?.catatan ?? o?.label ?? ''}
                            className={`w-full h-8 text-[11px] font-bold border ${r ? `${w.garis} ${w.teks} ${w.latar}` : 'border-transparent text-zinc-600'} ${bolehUbah(t.id) ? 'hover:border-white' : 'cursor-default'} ${r?.catatan ? 'underline decoration-dotted' : ''}`}
                          >
                            {r?.kode ?? '·'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b border-l-2 border-white/15 px-2 whitespace-nowrap text-[11px] text-zinc-300">
                      {rekap.map(({ k, n }) => <span key={k.nilai} className={`mr-1.5 ${warna(k.warna).teks}`}>{k.nilai}:{n}</span>)}
                    </td>
                  </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {memuat && <p data-tanpa-gambar className="text-[12px] text-zinc-400 mt-2 flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> memuat…</p>}

        {/* Tanggal merah bulan ini — sumbernya sama dengan kalender (tabel libur di server). */}
        {liburBulanIni.length > 0 && (
          <div className="mt-3 panel-retro !p-2">
            <p className="label-retro flex items-center gap-1"><Flag size={10} className="text-red-400" /> Tanggal merah {judulBulan}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {liburBulanIni.map(({ tanggal, l }) => (
                <span key={tanggal + l.nama} className="text-[12px] flex items-center gap-1.5">
                  <span className={`w-3 h-3 border border-black/40 ${l.jenis === 'nasional' ? 'bg-red-500' : l.jenis === 'cuti' ? 'bg-rose-400' : 'bg-purple-400'}`} />
                  <b className={l.jenis === 'nasional' ? 'text-red-300' : 'text-rose-200'}>{+tanggal.slice(8)} {W.NAMA_BULAN_PENDEK[+tanggal.slice(5, 7) - 1]}</b>
                  <span className="text-zinc-300">{l.nama}</span>
                  {l.jenis !== 'nasional' && <span className="text-zinc-500">({l.jenis === 'cuti' ? 'cuti bersama' : 'libur perusahaan'})</span>}
                  {l.perkiraan ? <span className="text-amber-300">· perkiraan</span> : null}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Legenda + tambah kode */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {kode.map((k) => { const w = warna(k.warna); return <span key={k.nilai} className={`chip-retro ${w.garis} ${w.teks} ${w.latar}`}>{k.nilai} · {k.label}</span>; })}
          {bolehKelola && !kodeBaru && <button data-tanpa-gambar onClick={() => setKodeBaru({ nilai: '', label: '', warna: 'purple' })} className="btn-retro btn-retro-sm bg-zinc-800"><Plus size={12} /> Kode</button>}
          {kodeBaru && (
            <div data-tanpa-gambar className="flex flex-wrap items-center gap-1.5 panel-retro !p-1.5">
              <input value={kodeBaru.nilai} onChange={(e) => setKodeBaru({ ...kodeBaru, nilai: e.target.value.toUpperCase().slice(0, 3) })} placeholder="S3" className="input-retro !w-16 !py-1 font-mono" />
              <input value={kodeBaru.label} onChange={(e) => setKodeBaru({ ...kodeBaru, label: e.target.value })} placeholder="Shift 3" className="input-retro !w-32 !py-1" />
              <select value={kodeBaru.warna} onChange={(e) => setKodeBaru({ ...kodeBaru, warna: e.target.value })} className="input-retro !w-auto !py-1">{['emerald', 'cyan', 'blue', 'indigo', 'purple', 'amber', 'orange', 'red', 'yellow', 'zinc'].map((w) => <option key={w} value={w}>{w}</option>)}</select>
              <button onClick={tambahKode} className="btn-retro btn-retro-sm bg-teal-600">Simpan</button>
              <button onClick={() => setKodeBaru(null)} className="btn-ikon !w-7 !h-7 bg-zinc-800"><X size={12} /></button>
            </div>
          )}
        </div>
        </div>

        <GrafikRoster
          tim={timUrut} kode={kode} tanggalList={tanggalList} peta={peta}
          mengunduh={mengunduh}
          onUnduh={(el, keterangan) => unduh(el, `grafik-roster-${bulan}${saringKelompok === 'semua' ? '' : `-${saringKelompok}`}`, `Grafik roster tim · ${judulBulanSaring}`, keterangan)}
        />
        <GrafikAnggota
          tim={timUrut} kode={kode} tanggalList={tanggalList} peta={peta} awal={pengguna.id}
          mengunduh={mengunduh}
          onUnduh={(el, nama) => unduh(el, `grafik-roster-${nama.split(' ')[0].toLowerCase()}-${bulan}`, `Grafik roster ${nama} · ${judulBulan}`)}
        />
      </div>

      {/* Pilih kode untuk satu sel */}
      {sel && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-end md:items-center justify-center p-3" onClick={() => setSel(null)}>
          <div className="retro-box !bg-zinc-900 w-full max-w-sm border-teal-500 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b-2 border-white/20 pb-2">
              <div><p className="text-[14px] font-bold text-white">{boot.tim.find((t) => t.id === sel.user_id)?.nama}</p><p className="text-[12px] text-teal-300">{W.formatPanjang(sel.tanggal)}</p></div>
              <button onClick={() => setSel(null)} className="text-zinc-400"><X size={20} /></button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {kode.map((k) => {
                const w = warna(k.warna);
                const aktif = peta.get(`${sel.user_id}|${sel.tanggal}`)?.kode === k.nilai;
                return <button key={k.nilai} onClick={async () => { await simpanSel(sel.user_id, sel.tanggal, k.nilai, peta.get(`${sel.user_id}|${sel.tanggal}`)?.catatan ?? undefined); setSel(null); }} className={`btn-retro btn-retro-sm flex-col !gap-0 !py-2 ${w.padat} ${aktif ? 'ring-2 ring-white' : ''}`}><span className="text-[14px]">{k.nilai}</span><span className="text-[10px] font-normal normal-case">{k.label}</span></button>;
              })}
              <button onClick={async () => { await simpanSel(sel.user_id, sel.tanggal, ''); setSel(null); }} className="btn-retro btn-retro-sm bg-zinc-800 !py-2">Kosongkan</button>
            </div>
            <CatatanSel awal={peta.get(`${sel.user_id}|${sel.tanggal}`)} onSimpan={async (c) => { const r = peta.get(`${sel.user_id}|${sel.tanggal}`); if (r) { await simpanSel(sel.user_id, sel.tanggal, r.kode, c); notify('CATATAN DISIMPAN'); } }} />
          </div>
        </div>
      )}

      {isiCepat && <FormIsiCepat boot={boot} kode={kode} bulan={bulan} onTutup={() => setIsiCepat(false)} onSelesai={(n) => { setIsiCepat(false); notify(`${n} HARI DIISI`); muat(); }} />}
    </div>
  );
};

/** Skala sumbu "hari": puncak dibulatkan ke kelipatan 1/2/5/10, paling banyak ±7 garis bantu. */
function skalaHari(puncak: number) {
  const langkah = [1, 2, 5, 10].find((s) => puncak / s <= 7) ?? 10;
  const atas = Math.max(langkah, Math.ceil(puncak / langkah) * langkah);
  return { atas, garis: Array.from({ length: atas / langkah + 1 }, (_, i) => i * langkah) };
}

/** Kerangka grafik batang: sumbu tegak "hari" + garis bantu; `batang` dan `label` berbaris sejajar. */
const BidangGrafik: React.FC<{ atas: number; garis: number[]; batang: React.ReactNode; label: React.ReactNode }> = ({ atas, garis, batang, label }) => (
  <div className="flex gap-2 mt-7">
    <div className="relative h-56 w-7 shrink-0 text-[10px] text-zinc-400 tabular-nums">
      <span className="absolute -top-5 right-0">hari</span>
      {garis.map((g) => <span key={g} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(g / atas) * 100}%` }}>{g}</span>)}
    </div>
    <div className="flex-1 min-w-0">
      <div className="relative h-56 border-b-2 border-l-2 border-white/40">
        {garis.slice(1).map((g) => <div key={g} className="absolute inset-x-0 border-t border-dashed border-white/15" style={{ bottom: `${(g / atas) * 100}%` }} />)}
        <div className="absolute inset-0 flex items-end justify-around gap-3 px-3">{batang}</div>
      </div>
      <div className="flex justify-around gap-3 px-3 mt-1">{label}</div>
    </div>
  </div>
);

const KepalaGrafik: React.FC<{ judul: string; mengunduh: boolean; onUnduh: () => void }> = ({ judul, mengunduh, onUnduh }) => (
  <div className="flex items-center gap-2 mb-2">
    <ChartColumnStacked size={15} className="text-teal-400" />
    <h3 className="font-title text-[11px] text-white mr-auto">{judul}</h3>
    <button data-tanpa-gambar onClick={onUnduh} disabled={mengunduh} className="btn-ikon !w-8 !h-8 bg-zinc-800" title="Unduh gambar grafik">{mengunduh ? <Loader2 size={15} className="animate-spin" /> : <ImageDown size={15} />}</button>
  </div>
);

const chipPilih = (aktif: boolean) => `px-2 py-0.5 text-[12px] font-bold border-2 ${aktif ? 'bg-teal-600 border-white text-white' : 'border-white/20 text-zinc-400 hover:text-white'}`;

interface PropsGrafik {
  tim: Bootstrap['tim']; kode: Opsi[]; tanggalList: string[]; peta: Map<string, RosterBaris>;
  mengunduh: boolean;
}

/**
 * Grafik tim: sumbu bawah = anggota, sumbu tegak = jumlah hari dalam bulan.
 * Batang ditumpuk per kode (warna sama dengan tabel). Filter kode boleh lebih dari satu.
 */
const GrafikRoster: React.FC<PropsGrafik & { onUnduh: (el: HTMLElement | null, keterangan: string) => void }> = ({ tim, kode, tanggalList, peta, mengunduh, onUnduh }) => {
  const area = useRef<HTMLElement>(null);
  const [pilihKode, setPilihKode] = useState<string[]>([]);
  const kodeAktif = pilihKode.length ? kode.filter((k) => pilihKode.includes(k.nilai)) : kode;

  // hitung[anggota][kode] = jumlah hari bulan ini.
  const hitung = tim.map((t) => kodeAktif.map((k) => tanggalList.filter((tg) => peta.get(`${t.id}|${tg}`)?.kode === k.nilai).length));
  const totalOrang = hitung.map((baris) => baris.reduce((a, b) => a + b, 0));
  const totalKode = kodeAktif.map((_, j) => hitung.reduce((s, baris) => s + baris[j], 0));
  const { atas, garis } = skalaHari(Math.max(1, ...totalOrang));
  const keterangan = `Kode: ${pilihKode.length ? kodeAktif.map((k) => k.label).join(', ') : 'semua'} · sumbu tegak = jumlah hari`;

  return (
    <section ref={area} className="mt-4 panel-retro !p-3 w-full">
      <KepalaGrafik judul="Grafik roster tim" mengunduh={mengunduh} onUnduh={() => onUnduh(area.current, keterangan)} />
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setPilihKode([])} className={chipPilih(!pilihKode.length)}>Semua</button>
        {kode.map((k) => {
          const w = warna(k.warna);
          const aktif = pilihKode.includes(k.nilai);
          return <button key={k.nilai} onClick={() => setPilihKode(aktif ? pilihKode.filter((x) => x !== k.nilai) : [...pilihKode, k.nilai])} className={`px-2 py-0.5 text-[12px] font-bold border-2 ${aktif ? `${w.garis} ${w.teks} ${w.latar}` : 'border-white/20 text-zinc-400 hover:text-white'}`}>{k.label}</button>;
        })}
      </div>

      <BidangGrafik
        atas={atas}
        garis={garis}
        batang={tim.map((t, i) => (
          <div key={t.id} className="flex-1 max-w-[88px] h-full flex flex-col justify-end items-center" title={`${t.nama}: ${kodeAktif.map((k, j) => `${k.label} ${hitung[i][j]}`).join(' · ')}`}>
            <span className="text-[12px] font-bold text-white tabular-nums mb-0.5">{totalOrang[i]}</span>
            {totalOrang[i] > 0 && (
              <div className="w-full flex flex-col-reverse border-2 border-black/60" style={{ height: `${(totalOrang[i] / atas) * 100}%` }}>
                {kodeAktif.map((k, j) => hitung[i][j] > 0 && (
                  <div key={k.nilai} className={`${warna(k.warna).titik} teks-atas-warna flex items-center justify-center text-[11px] font-bold border-t border-black/40 overflow-hidden`} style={{ height: `${(hitung[i][j] / totalOrang[i]) * 100}%` }}>
                    {hitung[i][j] / atas >= 0.07 ? hitung[i][j] : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        label={tim.map((t) => <span key={t.id} className="flex-1 max-w-[88px] text-center text-[12px] font-bold text-white truncate" title={t.nama}>{namaDepan(t.nama)}</span>)}
      />

      {/* Total tim per kode (sekaligus legenda warna) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px]">
        {kodeAktif.map((k, j) => {
          const w = warna(k.warna);
          return (
            <span key={k.nilai} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 border border-black/40 ${w.titik}`} />
              <span className={`font-bold ${w.teks}`}>{k.label}</span>
              <span className="text-zinc-300 tabular-nums">{totalKode[j]} hari</span>
            </span>
          );
        })}
      </div>
    </section>
  );
};

/**
 * Grafik per anggota: pilih satu nama; sumbu bawah = kode (Masuk, Libur, Cuti, …),
 * sumbu tegak = jumlah hari. "Belum diisi" muncul bila ada tanggal kosong.
 */
const GrafikAnggota: React.FC<PropsGrafik & { awal: string; onUnduh: (el: HTMLElement | null, nama: string) => void }> = ({ tim, kode, tanggalList, peta, mengunduh, awal, onUnduh }) => {
  const area = useRef<HTMLElement>(null);
  const [pilihan, setPilih] = useState(() => (tim.some((t) => t.id === awal) ? awal : tim[0]?.id ?? ''));
  // Saringan kelompok bisa menyembunyikan orang yang sedang dipilih; pakai anggota pertama yang tersisa.
  const pilih = tim.some((t) => t.id === pilihan) ? pilihan : tim[0]?.id ?? '';
  const orang = tim.find((t) => t.id === pilih);

  const kolom = kode.map((k) => ({
    id: k.nilai, label: k.label, kelas: warna(k.warna).titik, teks: warna(k.warna).teks,
    n: tanggalList.filter((tg) => peta.get(`${pilih}|${tg}`)?.kode === k.nilai).length,
  }));
  const kosong = tanggalList.filter((tg) => !peta.has(`${pilih}|${tg}`)).length;
  if (kosong > 0) kolom.push({ id: '_', label: 'Belum diisi', kelas: 'bg-zinc-500', teks: 'text-zinc-400', n: kosong });
  const { atas, garis } = skalaHari(Math.max(1, ...kolom.map((k) => k.n)));

  if (!orang) return null;
  return (
    <section ref={area} className="mt-4 panel-retro !p-3 w-full">
      <KepalaGrafik judul={`Grafik ${namaDepan(orang.nama)}`} mengunduh={mengunduh} onUnduh={() => onUnduh(area.current, orang.nama)} />
      <div className="flex flex-wrap items-center gap-1.5">
        {tim.map((t) => <button key={t.id} onClick={() => setPilih(t.id)} className={chipPilih(t.id === pilih)}>{namaDepan(t.nama)}</button>)}
      </div>

      <BidangGrafik
        atas={atas}
        garis={garis}
        batang={kolom.map((k) => (
          <div key={k.id} className="flex-1 max-w-[88px] h-full flex flex-col justify-end items-center" title={`${k.label}: ${k.n} hari`}>
            <span className="text-[12px] font-bold text-white tabular-nums mb-0.5">{k.n}</span>
            {k.n > 0 && <div className={`w-full ${k.kelas} border-2 border-black/60`} style={{ height: `${(k.n / atas) * 100}%` }} />}
          </div>
        ))}
        label={kolom.map((k) => <span key={k.id} className={`flex-1 max-w-[88px] text-center text-[12px] font-bold leading-tight ${k.teks}`}>{k.label}</span>)}
      />
      <p className="text-[11px] text-zinc-400 mt-2">{namaTampil(orang.nama)} · {tanggalList.length} hari dalam bulan ini</p>
    </section>
  );
};

const CatatanSel: React.FC<{ awal?: RosterBaris; onSimpan: (c: string) => Promise<void> }> = ({ awal, onSimpan }) => {
  const [c, setC] = useState(awal?.catatan ?? '');
  if (!awal) return null;
  return (
    <div className="flex gap-2 border-t border-white/10 pt-2">
      <input value={c} onChange={(e) => setC(e.target.value)} placeholder="Catatan (mis. cuti tahunan, sakit)" className="input-retro !py-1.5 flex-1" />
      <button onClick={() => onSimpan(c)} className="btn-retro btn-retro-sm bg-zinc-700">Simpan</button>
    </div>
  );
};

/**
 * Isi cepat roster, dua cara:
 *  - **Per hari**: satu kode untuk rentang tanggal, boleh dibatasi hari tertentu.
 *  - **Siklus lapangan**: pola berulang, mis. 8 minggu kerja lalu 2 minggu libur.
 *    Hari Minggu dan tanggal merah di dalam masa kerja tetap dihitung sebagai
 *    bagian siklus (hitungan tidak bergeser), tetapi di roster ditandai kode libur.
 */
const FormIsiCepat: React.FC<{ boot: Bootstrap; kode: Bootstrap['opsi']; bulan: string; onTutup: () => void; onSelesai: (n: number) => void }> = ({ boot, kode, bulan, onTutup, onSelesai }) => {
  const [tahun, bln] = bulan.split('-').map(Number);
  const akhir = new Date(Date.UTC(tahun, bln, 0)).getUTCDate();
  const [cara, setCara] = useState<'hari' | 'siklus'>('hari');
  const [f, setF] = useState({
    user_id: boot.tim[0]?.id ?? '', dari: `${bulan}-01`, sampai: `${bulan}-${String(akhir).padStart(2, '0')}`,
    kode: kode[0]?.nilai ?? 'D', hari: [1, 2, 3, 4, 5] as number[], lewatiLibur: true,
    kodeLibur: kode.find((k) => k.nilai === 'OFF')?.nilai ?? kode[kode.length - 1]?.nilai ?? 'OFF',
    mingguKerja: 8, mingguLibur: 2,
  });
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const toggleHari = (h: number) => setF({ ...f, hari: f.hari.includes(h) ? f.hari.filter((x) => x !== h) : [...f.hari, h] });
  const jumlahHari = f.sampai >= f.dari ? W.selisihHari(f.sampai, f.dari) + 1 : 0;
  const panjangSiklus = (f.mingguKerja + f.mingguLibur) * 7;
  const terlaluPanjang = jumlahHari > 400;

  const simpan = async () => {
    setMenyimpan(true); setGalat(null);
    try {
      const body = cara === 'siklus'
        ? { user_id: f.user_id, dari: f.dari, sampai: f.sampai, mode: 'siklus', kode: f.kode, kodeLibur: f.kodeLibur, mingguKerja: f.mingguKerja, mingguLibur: f.mingguLibur }
        : { ...f, hari: f.hari.length === 7 ? [] : f.hari };
      const d = await api<{ jumlah: number }>('/api/roster/isi', { body });
      onSelesai(d.jumlah);
    } catch (e) { setGalat(e instanceof GalatApi ? e.message : 'Gagal.'); }
    finally { setMenyimpan(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3" onClick={onTutup}>
      <div className="retro-box !bg-zinc-900 w-full max-w-sm border-teal-500 flex flex-col gap-3 max-h-[92vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b-2 border-white/20 pb-2"><h3 className="judul-layar text-teal-300">Isi cepat</h3><button onClick={onTutup} className="text-zinc-400"><X size={20} /></button></div>
        {galat && <p className="text-[12px] text-red-200 bg-red-950/50 border border-red-500 p-2">{galat}</p>}

        <div className="flex border-2 border-white/40">
          {([['hari', 'Per hari'], ['siklus', 'Siklus lapangan']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setCara(id)} className={`flex-1 py-1.5 text-[12px] font-bold uppercase ${cara === id ? 'bg-teal-600 text-white' : 'bg-black/40 text-zinc-400'}`}>{label}</button>
          ))}
        </div>

        <div><label className="label-retro">Anggota</label><select value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })} className="input-retro">{boot.tim.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label-retro">{cara === 'siklus' ? 'Hari pertama masuk' : 'Dari'}</label><input type="date" value={f.dari} onChange={(e) => setF({ ...f, dari: e.target.value })} className="input-retro" /></div>
          <div><label className="label-retro">Sampai</label><input type="date" value={f.sampai} onChange={(e) => setF({ ...f, sampai: e.target.value })} className="input-retro" /></div>
        </div>

        {cara === 'hari' ? (
          <>
            <div><label className="label-retro">Kode</label><select value={f.kode} onChange={(e) => setF({ ...f, kode: e.target.value })} className="input-retro">{kode.map((k) => <option key={k.nilai} value={k.nilai}>{k.nilai} · {k.label}</option>)}</select></div>
            <div>
              <label className="label-retro">Hanya hari</label>
              <div className="flex gap-1">{[1, 2, 3, 4, 5, 6, 0].map((h) => <button key={h} onClick={() => toggleHari(h)} className={`flex-1 py-1.5 text-[12px] font-bold border-2 ${f.hari.includes(h) ? 'bg-teal-600 border-white' : 'bg-black/40 border-white/20 text-zinc-400'}`}>{W.NAMA_HARI[h]}</button>)}</div>
              <p className="text-[11px] text-zinc-400 mt-1">Contoh: pilih Sen–Jum lalu kode M, lalu ulangi untuk Sab–Min dengan kode L.</p>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-zinc-200 cursor-pointer">
              <input type="checkbox" checked={f.lewatiLibur} onChange={(e) => setF({ ...f, lewatiLibur: e.target.checked })} />
              Lewati tanggal merah (libur nasional &amp; cuti bersama)
            </label>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-retro">Minggu kerja</label>
                <input type="number" min={1} max={26} value={f.mingguKerja} onChange={(e) => setF({ ...f, mingguKerja: Math.max(1, Math.min(26, Number(e.target.value) || 1)) })} className="input-retro" />
              </div>
              <div>
                <label className="label-retro">Minggu libur</label>
                <input type="number" min={0} max={26} value={f.mingguLibur} onChange={(e) => setF({ ...f, mingguLibur: Math.max(0, Math.min(26, Number(e.target.value) || 0)) })} className="input-retro" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-retro">Kode masa kerja</label>
                <select value={f.kode} onChange={(e) => setF({ ...f, kode: e.target.value })} className="input-retro">{kode.map((k) => <option key={k.nilai} value={k.nilai}>{k.nilai} · {k.label}</option>)}</select>
              </div>
              <div>
                <label className="label-retro">Kode hari libur</label>
                <select value={f.kodeLibur} onChange={(e) => setF({ ...f, kodeLibur: e.target.value })} className="input-retro">{kode.map((k) => <option key={k.nilai} value={k.nilai}>{k.nilai} · {k.label}</option>)}</select>
              </div>
            </div>
            <div className="panel-retro !p-2 text-[12px] text-zinc-300 leading-relaxed">
              <p>Siklus {f.mingguKerja} minggu kerja lalu {f.mingguLibur} minggu libur, berulang tiap {panjangSiklus} hari sampai tanggal akhir.</p>
              <p className="text-zinc-400 mt-1">Hari Minggu dan tanggal merah di dalam masa kerja tetap dihitung sebagai bagian siklus, tetapi diisi kode libur.</p>
              <p className="text-teal-300 mt-1">{jumlahHari} hari akan diisi{terlaluPanjang ? ' — melebihi batas, hanya 400 hari pertama yang terisi' : ''}.</p>
            </div>
          </>
        )}

        <button onClick={simpan} disabled={menyimpan || jumlahHari <= 0 || (cara === 'hari' && f.hari.length === 0)} className="btn-retro bg-teal-600 w-full">{menyimpan ? 'Mengisi…' : 'Terapkan'}</button>
      </div>
    </div>
  );
};
