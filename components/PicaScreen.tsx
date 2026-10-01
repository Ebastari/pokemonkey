import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { noPica } from '../lib/nomor-pica';
import {
  ClipboardList, Plus, Search, Table2, KanbanSquare, X, Lock, Unlock, Paperclip, History,
  MessageSquarePlus, Pencil, Trash2, Settings2, Loader2, Link2, ExternalLink, FileSpreadsheet,
  Maximize2, Minimize2, Eye, Send, Download, Users, RefreshCw, Presentation,
  BellRing, BellOff, Upload, Sparkles,
} from 'lucide-react';
import { api, GalatApi, ambilBerkas } from '../lib/api';
import { simpanBerkas } from '../lib/unduh';
import { bukuBaru, gayakan, gayakanChip, lembarBaru, pasangSaringan, simpanBuku, tanggalExcel, FORMAT_TANGGAL, MERAH, HIJAU, JINGGA, ABU } from '../lib/excel';
import { ambilAlarmPica, simpanAlarmPica } from '../lib/pica-alarm';
import { namaTampil, namaDepan } from '../lib/nama';
import { diAplikasi } from '../lib/platform';
import type { Bootstrap, PicaItem, RiwayatPica, UpdatePica, Lampiran, Pengguna } from '../lib/tipe-api';
import { warna } from '../lib/warna';
import * as W from '../lib/waktu';
import { ModalMonkeyPoint } from './ModalMonkeyPoint';
import { ModalImporPica } from './ModalImporPica';
import { ModalResumePicaAi } from './ModalResumePicaAi';
import { kembangkanPicaAi, type SaranPicaAi } from '../lib/gemini';
import { useKursorTabel } from '../lib/kursor-tabel';

/** Mengecek apakah suatu PICA sudah berstatus progress / sedang dikerjakan */
export const cekSudahProgress = (p: PicaItem): boolean => {
  if (p.status === 'Closed') return false;
  if (p.status === 'In Progress' || p.status === 'Continue') return true;
  if (p.realisasi !== null && p.realisasi > 0) return true;
  return false;
};

/** Menghitung persentase capaian realisasi terhadap target */
export const hitungPersen = (target: number | null, realisasi: number | null): number | null => {
  if (target && realisasi !== null) {
    return Math.min(100, Math.round((realisasi / target) * 100));
  }
  return null;
};

/** Register PICA: satu sumber data, tampilan tabel & papan, ekspor Excel, layar penuh. */

interface Props {
  boot: Bootstrap;
  pengguna: Pengguna;
  picaAwal?: string | null;
  onBootUlang: () => void;
  notify: (pesan: string) => void;
  fokus?: boolean;
  onFokus?: () => void;
}

export const PicaScreen: React.FC<Props> = ({ boot, pengguna, picaAwal, onBootUlang, notify, fokus, onFokus }) => {
  const [daftar, setDaftar] = useState<PicaItem[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [tampilan, setTampilan] = useState<'tabel' | 'papan'>('tabel');
  const [kelompok, setKelompok] = useState<'status' | 'pic_id' | 'bidang'>('status');
  // Default tutup: true agar PICA yang selesai (Closed) langsung tampil saat layar dibuka
  const [filter, setFilter] = useState({ q: '', tutup: true });
  // Saringan di bawah judul tiap kolom tabel (juga berlaku untuk tampilan papan & ekspor).
  const [saring, setSaring] = useState<SaringKolom>(SARING_KOSONG);
  const jumlahSaring = Object.values(saring).filter(Boolean).length;
  const [terpilih, setTerpilih] = useState<string | null>(picaAwal ?? null);
  const [formBaru, setFormBaru] = useState(false);
  const [aturBuka, setAturBuka] = useState(false);
  const [mengekspor, setMengekspor] = useState(false);
  const [monkeyPointBuka, setMonkeyPointBuka] = useState(false);
  const [imporBuka, setImporBuka] = useState(false);
  const [resumeAiBuka, setResumeAiBuka] = useState(false);

  const opsi = (grup: string) => boot.opsi.filter((o) => o.grup === grup);
  const bolehKelola = pengguna.peran === 'admin' || pengguna.peran === 'supervisor';
  const periodeAktif = boot.periode.find((p) => p.id === boot.pengaturan.periode_aktif);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const p = new URLSearchParams();
      if (filter.q) p.set('q', filter.q);
      // Server mengurutkan dari PICA terbaru (no_urut terbesar) di atas.
      const d = await api<{ pica: PicaItem[] }>(`/api/pica?${p.toString()}`);
      setDaftar(d.pica);
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT PICA'); }
    finally { setMemuat(false); }
  }, [filter, notify]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { if (picaAwal) setTerpilih(picaAwal); }, [picaAwal]);
  const tutupDetail = useCallback(() => setTerpilih(null), []);

  // Yang tampil = hasil saringan kolom; PICA selesai disembunyikan bila "Tampilkan Selesai" mati
  // (kecuali saringan status memilih Closed).
  const tampil = useMemo(
    () => daftar.filter((p) => (filter.tutup || saring.status === 'Closed' || p.status !== 'Closed') && cocokSaring(p, saring)),
    [daftar, filter.tutup, saring],
  );

  const ringkas = useMemo(() => ({
    terbuka: tampil.filter((p) => p.status !== 'Closed').length,
    telat: tampil.filter((p) => p.status !== 'Closed' && !cekSudahProgress(p) && (p.sisa_hari ?? 1) < 0).length,
    selesai: tampil.filter((p) => p.status === 'Closed').length,
  }), [tampil]);

  const kolomProps = boot.properti.filter((p) => p.tampil_di_tabel === 1);

  // Tabel ala Excel: kursor sel (panah/Tab/Enter), tahan-seret untuk menggeser, kolom No dan judul dikunci.
  const kursor = useKursorTabel({
    id: 'tabel-pica',
    jumlahBaris: tampil.length,
    jumlahKolom: 14 + kolomProps.length,
    onBuka: (b) => { const p = tampil[b]; if (p) setTerpilih(p.id); },
  });
  // Layar sentuh: ketuk baris langsung membuka PICA; di laptop klik memilih sel, klik 2× / Enter membuka.
  const sentuh = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  const kunciPeriode = async () => {
    if (!periodeAktif) return;
    if (!confirm(`Kunci periode ${periodeAktif.id}? PIC dan due date semua PICA di periode ini akan butuh alasan untuk diubah.`)) return;
    try {
      const d = await api<{ pesan: string }>(`/api/periode/${periodeAktif.id}/kunci`, { method: 'POST', body: {} });
      notify(d.pesan.toUpperCase()); onBootUlang(); muat();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };

  /**
   * Ekspor apa yang sedang tampil ke .xlsx bergaya layar: tampilan Tabel = tabel
   * dengan warna prioritas/status/sisa hari; tampilan Papan = dikelompokkan sesuai
   * pilihan Kelompok (Status/PIC/Bidang) dengan judul kelompok berwarna.
   */
  const eksporExcel = async () => {
    if (tampil.length === 0) { notify('TIDAK ADA DATA UNTUK DIEKSPOR'); return; }
    setMengekspor(true);
    try {
      const wb = await bukuBaru();
      const labelOpsi = (grup: string, n: string) => boot.opsi.find((o) => o.grup === grup && o.nilai === n);
      const propLain = boot.properti.filter((k) => k.tampil_di_tabel !== 1);
      const saringan = [
        ...teksSaring(saring, boot),
        filter.q && `Cari: "${filter.q}"`,
        !filter.tutup && 'tanpa PICA selesai',
      ].filter(Boolean).join(', ');
      const labelKelompok = kelompok === 'pic_id' ? 'PIC' : kelompok === 'bidang' ? 'Bidang' : 'Status';
      const k = lembarBaru(wb, 'PICA', {
        judul: `PICA · ${periodeAktif?.id ?? 'semua periode'}`,
        keterangan: [
          tampilan === 'papan' ? `Tampilan papan, kelompok ${labelKelompok}` : 'Tampilan tabel',
          `Terbuka ${ringkas.terbuka} · Selesai ${ringkas.selesai} · Telat ${ringkas.telat}`,
          saringan && `Saringan: ${saringan}`,
        ].filter(Boolean).join(' · '),
        latarKepala: '2F5D33',
        bekuKolom: 2,
        kolom: [
          { judul: 'No', lebar: 6, rata: 'center' }, { judul: 'ID', lebar: 16 }, { judul: 'Bidang', lebar: 14 }, { judul: 'Prioritas', lebar: 11, rata: 'center' },
          { judul: 'Masalah (fakta di laporan)', lebar: 50, bungkus: true }, { judul: 'Akar masalah', lebar: 36, bungkus: true },
          { judul: 'Tindakan korektif', lebar: 40, bungkus: true },
          { judul: 'Target', lebar: 10 }, { judul: 'Realisasi', lebar: 10 }, { judul: 'Satuan', lebar: 9 }, { judul: '% Progres', lebar: 11, rata: 'center' },
          { judul: 'PIC', lebar: 18 }, { judul: 'Due Date', lebar: 12 },
          { judul: 'Status', lebar: 12, rata: 'center' }, { judul: 'Sisa / Keterangan', lebar: 16 },
          { judul: 'Catatan Terakhir', lebar: 40, bungkus: true }, { judul: 'Bukti', lebar: 10, rata: 'center' },
          ...kolomProps.map((p) => ({ judul: p.label, lebar: 16 })),
          { judul: 'Terkait', lebar: 16 }, { judul: 'Terkunci', lebar: 9, rata: 'center' },
          ...propLain.map((p) => ({ judul: p.label, lebar: 16 })),
        ],
      });

      let urutan = 0;
      const tulis = (p: PicaItem) => {
        const sudahProg = cekSudahProgress(p);
        const pct = hitungPersen(p.target, p.realisasi);
        const telat = p.status !== 'Closed' && !sudahProg && (p.sisa_hari ?? 1) < 0;
        const teksSisaPica = p.status === 'Closed'
          ? 'selesai'
          : sudahProg
          ? `Progres ${pct !== null ? `${pct}%` : ''}`
          : W.teksSisa(p.sisa_hari);

        const zebra = urutan++ % 2 ? 'FAFAFA' : undefined;
        const row = k.tambah([
          noPica(p), p.id, p.bidang, labelOpsi('prioritas', p.prioritas)?.label ?? p.prioritas,
          p.judul, p.akar ?? '', p.tindakan ?? '',
          p.target ?? '', p.realisasi ?? '', p.satuan ?? '', pct !== null ? `${pct}%` : '',
          p.pic_nama ?? '—', tanggalExcel(p.due_date),
          labelOpsi('status', p.status)?.label ?? p.status, teksSisaPica,
          p.update_terakhir ?? '', p.jumlah_lampiran ? `${p.jumlah_lampiran} berkas` : '',
          ...kolomProps.map((kp) => String(p.props[kp.id] ?? '')),
          p.terkait_id ?? '', p.terkunci ? 'Ya' : 'Tidak',
          ...propLain.map((kp) => String(p.props[kp.id] ?? '')),
        ], { latar: zebra });
        gayakan(row.getCell(2), { teks: ABU, ukuran: 10, latar: zebra });
        row.getCell(13).numFmt = FORMAT_TANGGAL;
        gayakanChip(row.getCell(4), labelOpsi('prioritas', p.prioritas)?.warna, { rata: 'center' });
        gayakanChip(row.getCell(14), labelOpsi('status', p.status)?.warna, { rata: 'center' });
        const sisa = row.getCell(15);
        sisa.font = { ...sisa.font, bold: p.status === 'Closed' || sudahProg || telat, color: { argb: `FF${p.status === 'Closed' ? HIJAU : sudahProg ? '0284C7' : telat ? MERAH : (p.sisa_hari ?? 9) <= 3 ? JINGGA : '15181C'}` } };
        // Seperti kartu papan: PICA telat diberi garis merah di kiri.
        if (telat) row.getCell(1).border = { ...row.getCell(1).border, left: { style: 'thick', color: { argb: `FF${MERAH}` } } };
      };

      if (tampilan === 'tabel') {
        tampil.forEach(tulis);
        pasangSaringan(k);
      } else {
        const kolomPapan: { kunci: string; label: string; warna: string }[] =
          kelompok === 'status' ? opsi('status').map((o) => ({ kunci: o.nilai, label: o.label, warna: o.warna ?? 'zinc' }))
            : kelompok === 'bidang' ? opsi('bidang').map((o) => ({ kunci: o.nilai, label: o.label, warna: o.warna ?? 'zinc' }))
              : [...boot.tim.map((t) => ({ kunci: t.id, label: t.nama, warna: 'indigo' })), { kunci: '', label: 'Belum ada PIC', warna: 'zinc' }];
        kolomPapan.forEach((g) => {
          const isi = tampil.filter((p) => String(p[kelompok] ?? '') === g.kunci);
          if (isi.length === 0 && kelompok === 'pic_id' && g.kunci === '') return;
          const telat = isi.filter((p) => !cekSudahProgress(p) && (p.sisa_hari ?? 1) < 0 && p.status !== 'Closed').length;
          k.kelompok(`${g.label.toUpperCase()} · ${isi.length} PICA${telat ? ` · ${telat} telat` : ''}`, g.warna);
          urutan = 0;
          isi.forEach(tulis);
        });
      }

      await simpanBuku(wb, `PICA-${periodeAktif?.id ?? 'semua'}-${W.hariIniWita()}.xlsx`, 'Ekspor PICA');
      notify(`${tampil.length} BARIS DIEKSPOR`);
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'EKSPOR GAGAL'); }
    finally { setMengekspor(false); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 border-b-4 border-white pb-2 mb-2 px-2 pt-2">
        <h2 className="judul-layar flex items-center gap-2 mr-auto">
          <ClipboardList size={16} className="text-amber-400" /> PICA
          {periodeAktif && <span className={`chip-retro ${periodeAktif.terkunci ? 'border-red-500 text-red-300' : 'border-emerald-500 text-emerald-300'}`}>{periodeAktif.terkunci ? <Lock size={10} /> : <Unlock size={10} />}{periodeAktif.id}{periodeAktif.terkunci ? ' terkunci' : ' usulan'}</span>}
        </h2>
        <span className="text-[12px] text-zinc-300 mr-1">Terbuka <b className="text-white">{ringkas.terbuka}</b> · Selesai <b className="text-emerald-400">{ringkas.selesai}</b> · Telat <b className="text-red-400">{ringkas.telat}</b></span>
        <div className="flex border-2 border-white/40">
          <button onClick={() => setTampilan('tabel')} className={`px-2 py-1.5 flex items-center gap-1 text-[12px] font-bold uppercase ${tampilan === 'tabel' ? 'bg-amber-600' : 'bg-black/40 text-zinc-300'}`}><Table2 size={13} /><span className="hidden sm:inline">Tabel</span></button>
          <button onClick={() => setTampilan('papan')} className={`px-2 py-1.5 flex items-center gap-1 text-[12px] font-bold uppercase ${tampilan === 'papan' ? 'bg-amber-600' : 'bg-black/40 text-zinc-300'}`}><KanbanSquare size={13} /><span className="hidden sm:inline">Papan</span></button>
        </div>
        {bolehKelola && (
          <>
            <button onClick={() => setFormBaru(true)} className="btn-ikon !w-8 !h-8 sm:!w-auto sm:px-3 bg-amber-600" title="PICA baru"><Plus size={16} /><span className="hidden sm:inline ml-1 text-[12px] font-bold uppercase">PICA</span></button>
            <button onClick={() => setImporBuka(true)} className="btn-ikon !w-8 !h-8 sm:!w-auto sm:px-3 bg-teal-700 hover:bg-teal-600" title="Impor CSV & Format AI (Mode Append)"><Upload size={15} /><span className="hidden sm:inline ml-1 text-[12px] font-bold uppercase">Impor CSV</span></button>
          </>
        )}
        <button onClick={eksporExcel} disabled={mengekspor} className="btn-ikon !w-8 !h-8 sm:!w-auto sm:px-3 bg-emerald-700" title="Ekspor ke Excel">{mengekspor ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}<span className="hidden sm:inline ml-1 text-[12px] font-bold uppercase">Excel</span></button>
        <button onClick={() => setMonkeyPointBuka(true)} className="btn-ikon !w-8 !h-8 sm:!w-auto sm:px-3 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold" title="Monkey Point - Ekspor PowerPoint"><Presentation size={15} /><span className="hidden sm:inline ml-1 text-[12px] font-bold uppercase">Monkey Point</span></button>
        <button onClick={() => setResumeAiBuka(true)} className="btn-ikon !w-8 !h-8 sm:!w-auto sm:px-3 bg-gradient-to-r from-purple-700 via-indigo-700 to-sky-700 hover:brightness-110 text-white font-bold" title="Resume Eksekutif AI (Gemini)"><Sparkles size={15} className="text-yellow-300 animate-pulse" /><span className="hidden sm:inline ml-1 text-[12px] font-bold uppercase">Resume AI</span></button>
        {bolehKelola && <button onClick={() => setAturBuka((v) => !v)} className={`btn-ikon !w-8 !h-8 ${aturBuka ? 'bg-zinc-600' : 'bg-zinc-800'}`} title="Atur"><Settings2 size={15} /></button>}
        {onFokus && <button onClick={onFokus} className="btn-ikon !w-8 !h-8 bg-zinc-800" title="Layar penuh">{fokus ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>}
      </div>

      <div className="flex flex-wrap gap-1.5 px-2 mb-2">
        <div className="relative flex-1 min-w-[150px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} placeholder="Cari masalah / kode…" className="input-retro !pl-8 !py-1.5 !text-[13px]" />
        </div>
        {jumlahSaring > 0 && (
          <button onClick={() => setSaring(SARING_KOSONG)} className="chip-retro border-amber-400 bg-amber-950/60 text-amber-200 !text-[11px]" title="Hapus semua saringan kolom">
            {jumlahSaring} saringan kolom aktif · {tampil.length} dari {daftar.length} PICA · Hapus ✕
          </button>
        )}
        <label className="flex items-center gap-1.5 text-[12px] text-zinc-300 cursor-pointer select-none bg-black/30 px-2 py-1 border border-white/20 hover:border-amber-400" title="Centang untuk menampilkan PICA yang berstatus Closed"><input type="checkbox" checked={filter.tutup} onChange={(e) => setFilter({ ...filter, tutup: e.target.checked })} className="accent-amber-500" /> Tampilkan Selesai</label>
        {tampilan === 'papan' && <select value={kelompok} onChange={(e) => setKelompok(e.target.value as typeof kelompok)} className="input-retro !w-auto !py-1.5 !text-[13px]"><option value="status">Kelompok: Status</option><option value="pic_id">Kelompok: PIC</option><option value="bidang">Kelompok: Bidang</option></select>}
      </div>

      {aturBuka && bolehKelola && <PanelAtur boot={boot} pengguna={pengguna} onSelesai={onBootUlang} onKunci={kunciPeriode} notify={notify} />}

      <div className={`flex-1 custom-scrollbar px-2 pb-4 min-h-0 ${tampilan === 'tabel' && daftar.length > 0 ? 'flex flex-col overflow-hidden' : 'overflow-auto'}`}>
        {memuat && daftar.length === 0 && <p className="text-[13px] text-zinc-400 text-center py-10 flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Memuat…</p>}
        {!memuat && daftar.length === 0 && <p className="text-[13px] text-zinc-400 text-center py-10 uppercase">Tidak ada PICA yang cocok.</p>}

        {tampilan === 'tabel' && daftar.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 pb-1.5 text-[11px] text-zinc-400 shrink-0">
            <span className="mr-auto">Klik sel lalu pakai <b className="text-zinc-200">← ↑ ↓ →</b> seperti Excel · <b className="text-zinc-200">Enter</b> / klik 2× membuka · tahan klik lalu seret untuk menggeser</span>
            <button type="button" onClick={() => kursor.geser(-1)} className="btn-ikon !w-7 !h-7 bg-zinc-800" aria-label="Kolom sebelumnya" title="Kolom sebelumnya">◀</button>
            <button type="button" onClick={() => kursor.geser(1)} className="btn-ikon !w-7 !h-7 bg-zinc-800" aria-label="Kolom berikutnya" title="Kolom berikutnya">▶</button>
          </div>
        )}
        {tampilan === 'tabel' && daftar.length > 0 && (
          <div {...kursor.propsWadah} className="min-h-0 overflow-auto custom-scrollbar border-[3px] border-white/40">
            <style>{kursor.gaya}</style>
            <table className="min-w-[1380px] w-full text-[12px] border-collapse">
              <thead className="sticky top-0 z-[4]">
                <tr className="bg-[#2f5d33] text-white teks-atas-warna uppercase text-[11px]">
                  {['No', 'Bidang', 'Prioritas', 'Masalah (fakta di laporan)', 'Akar masalah', 'Tindakan korektif', 'Target & Realisasi', 'Progres', 'PIC', 'Due Date', 'Status', 'Sisa / Keterangan', 'Update Terakhir', 'Bukti', ...kolomProps.map((k) => k.label)].map((h, k) => (
                    <th key={h} data-kol={k} data-beku={k === 0 ? '' : undefined}
                      className={`text-left p-2 border border-white/25 font-bold whitespace-nowrap ${k === 0 ? 'sticky left-0 z-[5] bg-[#2f5d33] shadow-[2px_0_0_rgba(255,255,255,0.35)]' : ''}`}>{h}</th>
                  ))}
                </tr>
                <BarisSaring saring={saring} ubah={(k, v) => setSaring((x) => ({ ...x, [k]: v }))} boot={boot} kolomProps={kolomProps.length} />
              </thead>
              <tbody>
                {tampil.length === 0 && (
                  <tr><td colSpan={14 + kolomProps.length} className="p-6 text-center text-zinc-400">Tidak ada PICA yang cocok dengan saringan kolom.</td></tr>
                )}
                {tampil.map((p, i) => {
                  const sudahProg = cekSudahProgress(p);
                  const pct = hitungPersen(p.target, p.realisasi);
                  const telat = p.status !== 'Closed' && !sudahProg && (p.sisa_hari ?? 1) < 0;
                  return (
                    <tr key={p.id} onClick={sentuh ? () => setTerpilih(p.id) : undefined} onDoubleClick={() => setTerpilih(p.id)} className={`cursor-cell align-top ${i % 2 ? 'bg-white/5' : 'bg-black/30'} hover:bg-amber-500/10`}>
                      <td data-sel={`${i}-0`} data-beku="" className="p-2 border border-white/10 whitespace-nowrap sticky left-0 z-[1] bg-zinc-900 shadow-[2px_0_0_rgba(255,255,255,0.25)]"><span className="font-bold text-amber-300">{noPica(p)}</span><br /><span className="text-[10px] text-zinc-500">{p.id}</span></td>
                      <td data-sel={`${i}-1`} className="p-2 border border-white/10 whitespace-nowrap">{p.bidang}</td>
                      <td data-sel={`${i}-2`} className="p-2 border border-white/10"><Pill nilai={p.prioritas} grup="prioritas" boot={boot} /></td>
                      <td data-sel={`${i}-3`} className="p-2 border border-white/10 min-w-[280px] leading-relaxed text-white">{p.judul}{p.terkait_id && <span className="block text-[11px] text-cyan-300 mt-1">↳ terkait {p.terkait_id}</span>}</td>
                      <td data-sel={`${i}-4`} className="p-2 border border-white/10 min-w-[180px] leading-relaxed text-zinc-200">{p.akar || <span className="text-zinc-500">—</span>}</td>
                      <td data-sel={`${i}-5`} className="p-2 border border-white/10 min-w-[200px] leading-relaxed text-zinc-200">{p.tindakan || <span className="text-zinc-500">—</span>}</td>
                      <td data-sel={`${i}-6`} className="p-2 border border-white/10 whitespace-nowrap text-zinc-200 font-mono-code">
                        {p.target !== null ? `${p.realisasi ?? 0} / ${p.target} ${p.satuan ?? ''}` : <span className="text-zinc-500">—</span>}
                      </td>
                      <td data-sel={`${i}-7`} className="p-2 border border-white/10 whitespace-nowrap">
                        {pct !== null ? (
                          <div className="flex items-center gap-1.5 min-w-[90px]">
                            <div className="flex-1 h-2 bg-black/60 border border-white/20 rounded-sm overflow-hidden">
                              <div className={`h-full ${pct < 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="font-bold text-[11px] text-emerald-300 tabular-nums">{pct}%</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>
                      <td data-sel={`${i}-8`} className="p-2 border border-white/10 whitespace-nowrap">{p.pic_nama ? namaTampil(p.pic_nama) : <span className="text-zinc-500">—</span>}</td>
                      <td data-sel={`${i}-9`} className="p-2 border border-white/10 whitespace-nowrap">{p.due_date ? W.formatPendek(p.due_date) : '—'}</td>
                      <td data-sel={`${i}-10`} className="p-2 border border-white/10"><Pill nilai={p.status} grup="status" boot={boot} /></td>
                      <td data-sel={`${i}-11`} className="p-2 border border-white/10 whitespace-nowrap">
                        {p.status === 'Closed' ? (
                          <span className="text-emerald-400 font-bold">selesai</span>
                        ) : sudahProg ? (
                          <span className="chip-retro border-sky-400 bg-sky-950/60 text-sky-300 font-bold">
                            Progres {pct !== null ? `${pct}%` : ''}
                          </span>
                        ) : telat ? (
                          <span className="text-red-400 font-bold">{W.teksSisa(p.sisa_hari)}</span>
                        ) : (p.sisa_hari ?? 9) <= 3 ? (
                          <span className="text-amber-300">{W.teksSisa(p.sisa_hari)}</span>
                        ) : (
                          <span className="text-zinc-300">{W.teksSisa(p.sisa_hari)}</span>
                        )}
                      </td>
                      <td data-sel={`${i}-12`} className="p-2 border border-white/10 min-w-[160px] max-w-[220px]">
                        {p.update_terakhir ? (
                          <span className="line-clamp-2 text-[11px] text-zinc-300 leading-snug" title={p.update_terakhir}>
                            {p.update_terakhir}
                          </span>
                        ) : (
                          <span className="text-zinc-500 italic text-[11px]">—</span>
                        )}
                      </td>
                      <td data-sel={`${i}-13`} className="p-2 border border-white/10 whitespace-nowrap text-center">
                        {p.jumlah_lampiran && p.jumlah_lampiran > 0 ? (
                          <span className="chip-retro border-cyan-400 bg-cyan-950/50 text-cyan-300 inline-flex items-center gap-1 text-[10px]">
                            <Paperclip size={10} /> {p.jumlah_lampiran}
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-[10px]">—</span>
                        )}
                      </td>
                      {kolomProps.map((k, j) => <td key={k.id} data-sel={`${i}-${14 + j}`} className="p-2 border border-white/10 whitespace-nowrap text-zinc-200">{String(p.props[k.id] ?? '')}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tampilan === 'papan' && daftar.length > 0 && <Papan daftar={tampil} kelompok={kelompok} boot={boot} onPilih={setTerpilih} />}
      </div>

      {terpilih && <DetailPica id={terpilih} boot={boot} pengguna={pengguna} daftar={daftar} onTutup={tutupDetail} onUbah={muat} notify={notify} />}
      {formBaru && bolehKelola && <FormPica boot={boot} daftar={daftar} bolehKelola={bolehKelola} onTutup={() => setFormBaru(false)} onSimpan={(id) => { setFormBaru(false); muat(); notify(`${id} DIBUAT`); }} />}
      {imporBuka && <ModalImporPica boot={boot} pengguna={pengguna} onTutup={() => setImporBuka(false)} onSelesai={() => { setImporBuka(false); muat(); }} notify={notify} />}
      {monkeyPointBuka && <ModalMonkeyPoint boot={boot} pengguna={pengguna} onTutup={() => setMonkeyPointBuka(false)} notify={notify} />}
      {resumeAiBuka && (
        <ModalResumePicaAi
          daftarPica={tampil}
          periodeNama={periodeAktif?.id}
          onTutup={() => setResumeAiBuka(false)}
          notify={notify}
        />
      )}
    </div>
  );
};


interface SaringKolom {
  no: string; bidang: string; prioritas: string; judul: string; akar: string; tindakan: string;
  progres: '' | 'ada' | 'belum'; pic: string; due: '' | 'telat' | 'minggu' | 'kosong'; status: string;
  update: string; bukti: '' | 'ada' | 'tidak'; props: string;
}
const SARING_KOSONG: SaringKolom = {
  no: '', bidang: '', prioritas: '', judul: '', akar: '', tindakan: '', progres: '', pic: '', due: '', status: '', update: '', bukti: '', props: '',
};

const memuatTeks = (isi: string | null | undefined, cari: string) => !cari || String(isi ?? '').toLowerCase().includes(cari.toLowerCase());

function cocokSaring(p: PicaItem, s: SaringKolom): boolean {
  const telat = p.status !== 'Closed' && !cekSudahProgress(p) && (p.sisa_hari ?? 1) < 0;
  if (!memuatTeks(`${noPica(p)} ${p.id}`, s.no)) return false;
  if (s.bidang && p.bidang !== s.bidang) return false;
  if (s.prioritas && p.prioritas !== s.prioritas) return false;
  if (!memuatTeks(p.judul, s.judul) || !memuatTeks(p.akar, s.akar) || !memuatTeks(p.tindakan, s.tindakan)) return false;
  if (s.progres === 'ada' && hitungPersen(p.target, p.realisasi) === null) return false;
  if (s.progres === 'belum' && hitungPersen(p.target, p.realisasi) !== null) return false;
  if (s.pic === '-' ? p.pic_id : s.pic && p.pic_id !== s.pic) return false;
  if (s.due === 'telat' && !telat) return false;
  if (s.due === 'minggu' && (p.status === 'Closed' || p.sisa_hari === null || p.sisa_hari < 0 || p.sisa_hari > 7)) return false;
  if (s.due === 'kosong' && p.due_date) return false;
  if (s.status && p.status !== s.status) return false;
  if (!memuatTeks(p.update_terakhir, s.update)) return false;
  if (s.bukti === 'ada' && !p.jumlah_lampiran) return false;
  if (s.bukti === 'tidak' && p.jumlah_lampiran) return false;
  if (s.props && !Object.values(p.props ?? {}).some((v) => memuatTeks(String(v), s.props))) return false;
  return true;
}

/** Ringkasan saringan kolom untuk keterangan berkas Excel. */
function teksSaring(s: SaringKolom, boot: Bootstrap): string[] {
  const due = { telat: 'telat', minggu: 'tenggat ≤ 7 hari', kosong: 'tanpa due date' } as const;
  return [
    s.no && `No: "${s.no}"`, s.bidang && `Bidang: ${s.bidang}`, s.prioritas && `Prioritas: ${s.prioritas}`,
    s.judul && `Masalah: "${s.judul}"`, s.akar && `Akar: "${s.akar}"`, s.tindakan && `Tindakan: "${s.tindakan}"`,
    s.progres && `Progres: ${s.progres === 'ada' ? 'ada target' : 'tanpa target'}`,
    s.pic && `PIC: ${s.pic === '-' ? 'belum ada' : boot.tim.find((t) => t.id === s.pic)?.nama ?? s.pic}`,
    s.due && `Due: ${due[s.due]}`, s.status && `Status: ${s.status}`, s.update && `Update: "${s.update}"`,
    s.bukti && `Bukti: ${s.bukti === 'ada' ? 'ada' : 'belum ada'}`, s.props && `Kolom lain: "${s.props}"`,
  ].filter((x): x is string => Boolean(x));
}

/** Baris saringan di bawah judul kolom tabel PICA. */
const BarisSaring: React.FC<{ saring: SaringKolom; ubah: (k: keyof SaringKolom, v: string) => void; boot: Bootstrap; kolomProps: number }> = ({ saring, ubah, boot, kolomProps }) => {
  const kelas = (aktif: boolean) => `w-full min-w-[70px] bg-black/60 border ${aktif ? 'border-amber-400 text-amber-200' : 'border-white/20 text-zinc-200'} px-1.5 py-1 text-[11px] font-normal normal-case`;
  const teks = (k: keyof SaringKolom, ph = 'Cari…') => (
    <input value={saring[k]} onChange={(e) => ubah(k, e.target.value)} placeholder={ph} className={kelas(Boolean(saring[k]))} aria-label={`Saring ${k}`} />
  );
  const pilih = (k: keyof SaringKolom, isi: [string, string][]) => (
    <select value={saring[k]} onChange={(e) => ubah(k, e.target.value)} className={kelas(Boolean(saring[k]))} aria-label={`Saring ${k}`}>
      <option value="">Semua</option>
      {isi.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
  const opsi = (g: string): [string, string][] => boot.opsi.filter((o) => o.grup === g).map((o) => [o.nilai, o.label]);
  const sel = 'p-1 border border-white/20 bg-[#1f3d22]';
  return (
    <tr>
      <th data-beku="" className={`${sel} sticky left-0 z-[5] shadow-[2px_0_0_rgba(255,255,255,0.35)]`}>{teks('no', 'PICA-…')}</th>
      <th className={sel}>{pilih('bidang', opsi('bidang'))}</th>
      <th className={sel}>{pilih('prioritas', opsi('prioritas'))}</th>
      <th className={sel}>{teks('judul')}</th>
      <th className={sel}>{teks('akar')}</th>
      <th className={sel}>{teks('tindakan')}</th>
      <th className={sel}>{pilih('progres', [['ada', 'Ada target'], ['belum', 'Tanpa target']])}</th>
      <th className={sel} />
      <th className={sel}>{pilih('pic', [...boot.tim.map((t): [string, string] => [t.id, t.nama]), ['-', 'Belum ada PIC']])}</th>
      <th className={sel}>{pilih('due', [['telat', 'Telat'], ['minggu', '≤ 7 hari'], ['kosong', 'Tanpa due']])}</th>
      <th className={sel}>{pilih('status', opsi('status'))}</th>
      <th className={sel} />
      <th className={sel}>{teks('update')}</th>
      <th className={sel}>{pilih('bukti', [['ada', 'Ada'], ['tidak', 'Belum']])}</th>
      {Array.from({ length: kolomProps }, (_, i) => <th key={i} className={sel}>{i === 0 ? teks('props') : null}</th>)}
    </tr>
  );
};

/**
 * Sakelar alarm tenggat PICA. Bawaannya mati; kalau dinyalakan, HP berbunyi
 * sehari sebelum tenggat dan pada hari tenggat, pada jam yang diatur pemakai
 * (bawaan 07.00 WITA di layar Notifikasi). Hanya untuk PICA milik sendiri.
 */
const TombolAlarmPica: React.FC<{ pica: PicaItem; milikSaya: boolean; notify: (p: string) => void }> = ({ pica, milikSaya, notify }) => {
  const [aktif, setAktif] = useState<boolean | null>(null);
  const [jam, setJam] = useState('07:00');
  const [sibuk, setSibuk] = useState(false);

  useEffect(() => {
    if (!milikSaya) return;
    let hidup = true;
    ambilAlarmPica()
      .then((d) => {
        if (!hidup) return;
        const a = d.alarm.find((x) => x.pica_id === pica.id);
        setAktif(Boolean(a?.aktif));
        setJam(a?.jam || d.jamBawaan);
      })
      .catch(() => { if (hidup) setAktif(false); });
    return () => { hidup = false; };
  }, [pica.id, milikSaya]);

  if (!milikSaya || !pica.due_date || pica.status === 'Closed') return null;

  const ubah = async () => {
    const baru = !aktif;
    setAktif(baru); setSibuk(true);
    try {
      await simpanAlarmPica(pica.id, baru);
      notify(baru ? `ALARM TENGGAT AKTIF · ${jam} WITA` : 'ALARM TENGGAT DIMATIKAN');
    } catch (e) {
      setAktif(!baru);
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGUBAH ALARM');
    } finally { setSibuk(false); }
  };

  return (
    <button onClick={ubah} disabled={sibuk || aktif === null} title={aktif ? `Alarm H-1 dan hari-H pukul ${jam} WITA` : 'Nyalakan alarm tenggat'}
      className={`chip-retro flex items-center gap-1 ${aktif ? 'border-emerald-500 text-emerald-300 bg-emerald-950/50' : 'border-zinc-600 text-zinc-400'}`}>
      {aktif ? <BellRing size={11} /> : <BellOff size={11} />}
      {aktif ? `Alarm ${jam}` : 'Alarm mati'}
    </button>
  );
};

const Pill: React.FC<{ nilai: string; grup: string; boot: Bootstrap }> = ({ nilai, grup, boot }) => {
  const o = boot.opsi.find((x) => x.grup === grup && x.nilai === nilai);
  const w = warna(o?.warna);
  return <span className={`chip-retro ${w.garis} ${w.teks} ${w.latar}`}>{o?.label ?? nilai}</span>;
};

const Papan: React.FC<{ daftar: PicaItem[]; kelompok: 'status' | 'pic_id' | 'bidang'; boot: Bootstrap; onPilih: (id: string) => void }> = ({ daftar, kelompok, boot, onPilih }) => {
  const kolom: { kunci: string; label: string; warna: string }[] =
    kelompok === 'status' ? boot.opsi.filter((o) => o.grup === 'status').map((o) => ({ kunci: o.nilai, label: o.label, warna: o.warna ?? 'zinc' }))
      : kelompok === 'bidang' ? boot.opsi.filter((o) => o.grup === 'bidang').map((o) => ({ kunci: o.nilai, label: o.label, warna: o.warna ?? 'zinc' }))
        : [...boot.tim.map((t) => ({ kunci: t.id, label: t.nama, warna: 'indigo' })), { kunci: '', label: 'Belum ada PIC', warna: 'zinc' }];

  return (
    <div className="flex gap-3 min-w-max pb-4">
      {kolom.map((k) => {
        const isi = daftar.filter((p) => String(p[kelompok] ?? '') === k.kunci);
        if (isi.length === 0 && kelompok === 'pic_id' && k.kunci === '') return null;
        const w = warna(k.warna);
        const telat = isi.filter((p) => !cekSudahProgress(p) && (p.sisa_hari ?? 1) < 0 && p.status !== 'Closed').length;
        return (
          <div key={k.kunci} className="w-64 shrink-0 panel-retro !p-2 flex flex-col gap-2">
            <div className={`flex items-center justify-between border-b-2 pb-1 ${w.garis}`}>
              <span className={`text-[13px] uppercase font-bold ${w.teks}`}>{k.label}</span>
              <span className="text-[11px] text-zinc-300">{isi.length}{telat ? ` · ${telat} telat` : ''}</span>
            </div>
            {isi.map((p) => {
              const sudahProg = cekSudahProgress(p);
              const pct = hitungPersen(p.target, p.realisasi);
              const isTelat = !sudahProg && (p.sisa_hari ?? 1) < 0 && p.status !== 'Closed';
              return (
                <button
                  key={p.id}
                  onClick={() => onPilih(p.id)}
                  className={`text-left bg-black/50 border-l-4 p-2 hover:bg-white/5 ${isTelat ? 'border-red-500' : sudahProg ? 'border-sky-500' : w.garis}`}
                >
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <span>{noPica(p)} · {p.bidang}</span>
                    {p.jumlah_lampiran && p.jumlah_lampiran > 0 ? (
                      <span className="text-cyan-300 flex items-center gap-0.5 text-[10px]"><Paperclip size={10} />{p.jumlah_lampiran}</span>
                    ) : null}
                  </div>
                  <p className="text-[13px] text-white leading-snug line-clamp-3 my-1">{p.judul}</p>

                  {/* Progress bar jika ada target & realisasi */}
                  {pct !== null && (
                    <div className="my-1.5 bg-black/40 p-1 border border-white/10 rounded">
                      <div className="flex justify-between text-[10px] text-zinc-300 mb-0.5 font-mono-code">
                        <span>{p.realisasi ?? 0}/{p.target} {p.satuan ?? ''}</span>
                        <span className="font-bold text-emerald-400">{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-black/60 border border-white/20 rounded-sm overflow-hidden">
                        <div className={`h-full ${pct < 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Catatan update terakhir */}
                  {p.update_terakhir && (
                    <p className="text-[10px] text-zinc-400 italic line-clamp-1 my-1 border-l-2 border-amber-500/70 pl-1">
                      💬 {p.update_terakhir}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <Pill nilai={p.prioritas} grup="prioritas" boot={boot} />
                    {kelompok !== 'status' && <Pill nilai={p.status} grup="status" boot={boot} />}
                    {sudahProg ? (
                      <span className="text-[10px] font-bold text-sky-300 ml-auto bg-sky-950/60 px-1.5 py-0.5 border border-sky-500/50 rounded">
                        Progres {pct !== null ? `${pct}%` : ''}
                      </span>
                    ) : (
                      <span className={`text-[11px] ml-auto ${isTelat ? 'text-red-400 font-bold' : 'text-zinc-300'}`}>
                        {namaDepan(p.pic_nama) || '—'} · {p.due_date ? W.formatPendek(p.due_date) : '—'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {isi.length === 0 && <p className="text-[12px] text-zinc-500 text-center py-3">kosong</p>}
          </div>
        );
      })}
    </div>
  );
};

const Modal: React.FC<{ judul: React.ReactNode; lebar?: string; onTutup: () => void; children: React.ReactNode }> = ({ judul, lebar = 'max-w-2xl', onTutup, children }) => (
  <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-2 md:p-4" onClick={onTutup}>
    <div className={`retro-box !bg-zinc-900 w-full ${lebar} border-amber-500 flex flex-col gap-3 max-h-[94vh] overflow-auto custom-scrollbar`} onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-start border-b-2 border-white/20 pb-2 gap-3">
        <div className="text-[14px] font-bold text-amber-300 leading-snug">{judul}</div>
        <button onClick={onTutup} className="text-zinc-400 hover:text-white shrink-0"><X size={20} /></button>
      </div>
      {children}
    </div>
  </div>
);

interface DataDetail { pica: PicaItem; riwayat: RiwayatPica[]; updates: UpdatePica[]; lampiran: Lampiran[] }

const DetailPica: React.FC<{ id: string; boot: Bootstrap; pengguna: Pengguna; daftar: PicaItem[]; onTutup: () => void; onUbah: () => void; notify: (m: string) => void }> = ({ id, boot, pengguna, daftar, onTutup, onUbah, notify }) => {
  const [d, setD] = useState<DataDetail | null>(null);
  const [ubah, setUbah] = useState(false);
  const [catatan, setCatatan] = useState('');
  const [realisasiBaru, setRealisasiBaru] = useState('');
  const [mengunggah, setMengunggah] = useState(false);
  const [tab, setTab] = useState<'update' | 'riwayat' | 'lampiran'>('update');
  const [pratinjau, setPratinjau] = useState<{ url: string; blob: Blob; nama: string } | null>(null);

  const muat = useCallback(async () => {
    try { setD(await api<DataDetail>(`/api/pica/${id}`)); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); onTutup(); }
  }, [id, notify, onTutup]);
  useEffect(() => { muat(); }, [muat]);

  if (!d) return <Modal judul="PICA" onTutup={onTutup}><p className="text-[13px] text-zinc-300 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> memuat…</p></Modal>;

  const p = d.pica;
  const bolehKelola = pengguna.peran === 'admin' || pengguna.peran === 'supervisor';
  const terkunci = p.terkunci === 1 || boot.periode.find((x) => x.id === p.periode_id)?.terkunci === 1;

  const ubahStatus = async (status: string) => {
    try { await api(`/api/pica/${id}`, { method: 'PATCH', body: { status } }); notify(`STATUS → ${status.toUpperCase()}`); muat(); onUbah(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };
  const kirimUpdate = async () => {
    if (!catatan.trim()) return;
    try { await api(`/api/pica/${id}/update`, { body: { catatan: catatan.trim(), realisasi: realisasiBaru ? Number(realisasiBaru) : undefined } }); setCatatan(''); setRealisasiBaru(''); muat(); onUbah(); notify('PERKEMBANGAN DICATAT'); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };
  const unggah = async (berkas: File) => {
    setMengunggah(true);
    try { const form = new FormData(); form.append('berkas', berkas); form.append('entitas', 'pica'); form.append('entitas_id', id); await api('/api/lampiran', { form }); notify('BUKTI TERUNGGAH'); muat(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL UNGGAH'); }
    finally { setMengunggah(false); }
  };
  /** Foto dipratinjau di dalam aplikasi; PDF/berkas lain disimpan (APK) atau dibuka di tab baru (browser). */
  const bukaBerkas = async (l: Lampiran) => {
    try {
      const blob = await ambilBerkas(l.kunci_r2);
      const nama = l.nama ?? l.kunci_r2.split('/').pop() ?? 'lampiran';
      const tipe = l.tipe_mime || blob.type;
      if (tipe.startsWith('image/')) { setPratinjau({ url: URL.createObjectURL(blob), blob, nama }); return; }
      if (diAplikasi()) { await simpanBerkas(blob, nama, 'Lampiran PICA'); return; }
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { notify('BERKAS TIDAK DAPAT DIBUKA'); }
  };
  const tutupPratinjau = () => { if (pratinjau) URL.revokeObjectURL(pratinjau.url); setPratinjau(null); };
  const hapus = async () => {
    if (!confirm(`Hapus ${id}? Riwayatnya tetap tersimpan.`)) return;
    try { await api(`/api/pica/${id}`, { method: 'DELETE' }); notify('PICA DIHAPUS'); onUbah(); onTutup(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };

  if (ubah) return <FormPica boot={boot} daftar={daftar} awal={p} terkunci={terkunci} bolehKelola={bolehKelola} onTutup={() => setUbah(false)} onSimpan={() => { setUbah(false); muat(); onUbah(); notify('PICA DIPERBARUI'); }} />;

  const persen = p.target && p.realisasi !== null ? Math.min(100, Math.round((p.realisasi / p.target) * 100)) : null;

  return (
    <Modal judul={<><span className="text-[11px] text-zinc-400 block font-normal">{noPica(p)} · {p.id} · {p.bidang}{terkunci && <span className="ml-2 text-red-300"><Lock size={10} className="inline" /> terkunci</span>}</span>{p.judul}</>} onTutup={onTutup}>
      <div className="flex flex-wrap gap-2 items-center">
        <Pill nilai={p.prioritas} grup="prioritas" boot={boot} />
        <select value={p.status} onChange={(e) => ubahStatus(e.target.value)} className="input-retro !w-auto !py-1 !text-[12px]">{boot.opsi.filter((o) => o.grup === 'status').map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}</select>
        <span className="text-[12px] text-zinc-300">PIC: <b className="text-white">{namaTampil(p.pic_nama) || '—'}</b></span>
        <span className={`text-[12px] ${(p.sisa_hari ?? 1) < 0 && p.status !== 'Closed' ? 'text-red-400' : 'text-zinc-300'}`}>Tenggat: <b>{p.due_date ? W.formatPendek(p.due_date) : '—'}</b> · {p.status === 'Closed' ? 'selesai' : W.teksSisa(p.sisa_hari)}</span>
        <TombolAlarmPica pica={p} milikSaya={p.pic_id === pengguna.id} notify={notify} />
        <div className="ml-auto flex gap-1">
          <button onClick={() => setUbah(true)} className="btn-retro btn-retro-sm bg-zinc-800"><Pencil size={12} /> Ubah</button>
          {pengguna.peran === 'admin' && <button onClick={hapus} className="btn-ikon !w-8 !h-8 bg-red-900"><Trash2 size={12} /></button>}
        </div>
      </div>

      {persen !== null && (
        <div>
          <div className="flex justify-between text-[11px] uppercase text-zinc-300 mb-1"><span>Realisasi</span><span>{p.realisasi?.toLocaleString('id-ID')} / {p.target?.toLocaleString('id-ID')} {p.satuan} · {persen}%</span></div>
          <div className="h-2.5 bg-black border-2 border-white/30"><div className={`h-full ${persen < 60 ? 'bg-red-500' : persen < 90 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${persen}%` }} /></div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 text-[13px] leading-relaxed">
        <div className="panel-retro !p-2"><p className="text-[10px] text-zinc-400 uppercase mb-1">Akar masalah</p>{p.akar || <span className="text-zinc-500">belum dikonfirmasi</span>}</div>
        <div className="panel-retro !p-2"><p className="text-[10px] text-zinc-400 uppercase mb-1">Tindakan korektif</p>{p.tindakan || <span className="text-zinc-500">—</span>}</div>
      </div>
      {p.terkait_id && <p className="text-[12px] text-cyan-300 flex items-center gap-1"><Link2 size={12} /> Terkait {p.terkait_id}: {daftar.find((x) => x.id === p.terkait_id)?.judul.slice(0, 80) ?? ''}</p>}
      {Object.keys(p.props).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {boot.properti.filter((k) => p.props[k.id] !== undefined && p.props[k.id] !== '').map((k) => <span key={k.id} className="chip-retro border-white/20 bg-black/40 text-zinc-200 normal-case"><span className="text-zinc-400 uppercase">{k.label}:</span> {String(p.props[k.id])}</span>)}
        </div>
      )}

      <div className="flex border-b-2 border-white/20">
        {([['update', 'Perkembangan', MessageSquarePlus], ['lampiran', `Bukti (${d.lampiran.length})`, Paperclip], ['riwayat', 'Riwayat', History]] as const).map(([k, label, Ikon]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-[12px] font-bold uppercase flex items-center gap-1 ${tab === k ? 'bg-amber-600 text-white' : 'text-zinc-300 hover:text-white'}`}><Ikon size={12} /> {label}</button>
        ))}
      </div>

      {tab === 'update' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan perkembangan minggu ini…" className="input-retro h-16 resize-none flex-1" />
            <div className="w-28 flex flex-col gap-1">
              <input value={realisasiBaru} onChange={(e) => setRealisasiBaru(e.target.value)} type="number" placeholder="realisasi" className="input-retro !py-1.5" />
              <button onClick={kirimUpdate} className="btn-retro btn-retro-sm bg-amber-600">Catat</button>
            </div>
          </div>
          {d.updates.length === 0 && <p className="text-[12px] text-zinc-500 italic">Belum ada catatan perkembangan.</p>}
          {d.updates.map((u) => (
            <div key={u.id} className="bg-black/40 border-l-4 border-amber-500 p-2 text-[13px]">
              <p className="text-white leading-relaxed">{u.catatan}</p>
              <p className="text-[11px] text-zinc-400 mt-1 uppercase">{u.oleh_nama ?? '—'} · {W.formatWaktuIso(u.pada)}{u.realisasi !== null ? ` · realisasi ${u.realisasi}` : ''}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'lampiran' && (
        <div className="space-y-2">
          <label className={`btn-retro bg-emerald-700 w-full cursor-pointer ${mengunggah ? 'opacity-50' : ''}`}>
            {mengunggah ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />} Unggah foto / PDF bukti
            <input type="file" accept="image/*,application/pdf" className="hidden" disabled={mengunggah} onChange={(e) => { const f = e.target.files?.[0]; if (f) unggah(f); e.target.value = ''; }} />
          </label>
          {d.lampiran.length === 0 && <p className="text-[12px] text-zinc-500 italic">Belum ada bukti. PICA tidak bisa ditutup tanpa bukti.</p>}
          {d.lampiran.map((l) => (
            <button key={l.id} onClick={() => bukaBerkas(l)} className="w-full text-left bg-black/40 border border-white/15 p-2 text-[13px] flex items-center gap-2 hover:border-white/40">
              <ExternalLink size={13} className="text-cyan-300 shrink-0" /><span className="truncate flex-1">{l.nama ?? l.kunci_r2}</span>
              <span className="text-[11px] text-zinc-400">{l.ukuran ? `${Math.round(l.ukuran / 1024)} KB` : ''} · {W.formatWaktuIso(l.pada)}</span>
            </button>
          ))}
          {pratinjau && (
            <div className="fixed inset-0 z-[90] bg-black/90 flex flex-col" onClick={tutupPratinjau}>
              <div className="flex items-center gap-2 p-2 border-b-2 border-white/20" onClick={(e) => e.stopPropagation()}>
                <span className="flex-1 truncate text-[13px] teks-atas-warna">{pratinjau.nama}</span>
                <button className="btn-retro bg-emerald-700 !py-1.5 text-[12px]" onClick={() => simpanBerkas(pratinjau.blob, pratinjau.nama, 'Lampiran PICA').catch(() => notify('GAGAL MENYIMPAN'))}>
                  <Download size={13} /> Simpan
                </button>
                <button className="btn-ikon" aria-label="Tutup pratinjau" onClick={tutupPratinjau}><X size={16} /></button>
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-center p-3">
                <img src={pratinjau.url} alt={pratinjau.nama} className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'riwayat' && (
        <div className="space-y-1">
          {d.riwayat.map((r) => (
            <div key={r.id} className="text-[12px] bg-black/30 border border-white/10 p-1.5 flex flex-wrap gap-x-2">
              <span className="text-zinc-400">{W.formatWaktuIso(r.pada)}</span><span className="text-white">{r.oleh_nama ?? '—'}</span><span className="text-amber-300 uppercase">{r.kolom}</span>
              {r.nilai_lama && <span className="text-zinc-500 line-through truncate max-w-[140px]">{r.nilai_lama}</span>}
              <span className="text-emerald-300 truncate max-w-[240px]">{r.nilai_baru}</span>
              {r.alasan && <span className="text-zinc-300 italic w-full">alasan: {r.alasan}</span>}
            </div>
          ))}
        </div>
      )}

      {!bolehKelola && p.status === 'Verifikasi' && <p className="text-[12px] text-purple-300">Menunggu verifikasi Supervisor/Admin untuk ditutup.</p>}
    </Modal>
  );
};

const FormPica: React.FC<{ boot: Bootstrap; daftar: PicaItem[]; awal?: PicaItem; terkunci?: boolean; bolehKelola?: boolean; onTutup: () => void; onSimpan: (id: string) => void }> = ({ boot, daftar, awal, terkunci = false, bolehKelola = true, onTutup, onSimpan }) => {
  const opsi = (g: string) => boot.opsi.filter((o) => o.grup === g);
  const [f, setF] = useState({
    bidang: awal?.bidang ?? opsi('bidang')[0]?.nilai ?? '', prioritas: awal?.prioritas ?? 'Sedang', judul: awal?.judul ?? '', judul_singkat: awal?.judul_singkat ?? '', akar: awal?.akar ?? '', tindakan: awal?.tindakan ?? '',
    pic_id: awal?.pic_id ?? '', due_date: awal?.due_date ?? '', terkait_id: awal?.terkait_id ?? '', target: awal?.target?.toString() ?? '', realisasi: awal?.realisasi?.toString() ?? '', satuan: awal?.satuan ?? '',
    props: { ...(awal?.props ?? {}) } as Record<string, unknown>, alasan: '',
  });
  const [menyimpan, setMenyimpan] = useState(false);
  const [sedangAi, setSedangAi] = useState(false);
  const [saranAi, setSaranAi] = useState<SaranPicaAi | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const butuhAlasan = terkunci && awal && (f.pic_id !== (awal.pic_id ?? '') || f.due_date !== (awal.due_date ?? ''));

  const kembangkanDenganAi = async () => {
    if (!f.judul.trim()) {
      setGalat('Tulis uraian masalah terlebih dahulu agar dapat dikembangkan oleh AI.');
      return;
    }
    setSedangAi(true);
    setGalat(null);
    try {
      const saran = await kembangkanPicaAi({
        judul: f.judul,
        akar: f.akar,
        tindakan: f.tindakan,
        bidang: f.bidang,
        satuan: f.satuan,
        target: f.target ? Number(f.target) : null,
        realisasi: f.realisasi ? Number(f.realisasi) : null,
      });
      setSaranAi(saran);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menghubungi Gemini AI.');
    } finally {
      setSedangAi(false);
    }
  };

  const terapkanSaranAi = () => {
    if (!saranAi) return;
    setF((prev) => ({
      ...prev,
      judul: saranAi.judul || prev.judul,
      judul_singkat: saranAi.judul_singkat || prev.judul_singkat,
      akar: saranAi.akar || prev.akar,
      tindakan: saranAi.tindakan || prev.tindakan,
    }));
    setSaranAi(null);
  };

  const simpan = async () => {
    if (!f.judul.trim()) { setGalat('Uraian masalah wajib diisi.'); return; }
    if (butuhAlasan && !f.alasan.trim()) { setGalat('Periode terkunci: isi alasan perubahan PIC / due date.'); return; }
    setMenyimpan(true); setGalat(null);
    const body: Record<string, unknown> = { bidang: f.bidang, prioritas: f.prioritas, judul: f.judul.trim(), judul_singkat: f.judul_singkat.trim() || null, akar: f.akar.trim() || null, tindakan: f.tindakan.trim() || null, pic_id: f.pic_id || null, due_date: f.due_date || null, terkait_id: f.terkait_id || null, target: f.target === '' ? null : Number(f.target), realisasi: f.realisasi === '' ? null : Number(f.realisasi), satuan: f.satuan || null, props: f.props };
    if (awal && f.alasan.trim()) body.alasan = f.alasan.trim();
    try {
      if (awal) { await api(`/api/pica/${awal.id}`, { method: 'PATCH', body }); onSimpan(awal.id); }
      else { const d = await api<{ id: string }>('/api/pica', { body }); onSimpan(d.id); }
    } catch (e) { setGalat(e instanceof GalatApi ? e.message : 'Gagal menyimpan.'); }
    finally { setMenyimpan(false); }
  };

  return (
    <Modal judul={awal ? `Ubah ${awal.id}` : 'PICA baru'} onTutup={onTutup}>
      {galat && <p className="text-[12px] text-red-200 bg-red-950/50 border border-red-500 p-2">{galat}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label-retro">Bidang</label><select value={f.bidang} onChange={(e) => setF({ ...f, bidang: e.target.value })} className="input-retro">{opsi('bidang').map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}</select></div>
        <div><label className="label-retro">Prioritas</label><select value={f.prioritas} onChange={(e) => setF({ ...f, prioritas: e.target.value })} className="input-retro">{opsi('prioritas').map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}</select></div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label-retro !mb-0">Masalah (fakta di laporan)</label>
          <button
            type="button"
            onClick={kembangkanDenganAi}
            disabled={sedangAi || !f.judul.trim()}
            className="btn-retro btn-retro-sm !py-0.5 !px-2 bg-gradient-to-r from-purple-700 via-indigo-700 to-sky-700 text-white font-bold flex items-center gap-1 hover:brightness-110 disabled:opacity-50"
            title="Kembangkan masalah, akar masalah & tindakan dengan Gemini AI"
          >
            {sedangAi ? <Loader2 size={11} className="animate-spin text-yellow-300" /> : <Sparkles size={11} className="text-yellow-300" />}
            <span className="text-[10px]">{sedangAi ? 'Menganalisis…' : '✨ Kembangkan AI'}</span>
          </button>
        </div>
        <textarea autoFocus value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} className="input-retro h-20 resize-none" placeholder="Tulis fakta beserta angkanya…" />
      </div>

      {/* Kotak Rekomendasi AI */}
      {saranAi && (
        <div className="p-3 bg-purple-950/40 border-2 border-purple-500 rounded-sm space-y-2 text-[12px]">
          <div className="flex justify-between items-center border-b border-purple-500/40 pb-1">
            <span className="font-bold text-yellow-300 flex items-center gap-1">
              <Sparkles size={13} /> Saran Pengembangan Gemini AI
            </span>
            <button type="button" onClick={() => setSaranAi(null)} className="text-zinc-400 hover:text-white text-[11px]">✕ Batal</button>
          </div>
          {saranAi.catatan_ai && <p className="text-[11px] text-purple-200 italic">💡 {saranAi.catatan_ai}</p>}
          <div className="space-y-1.5 bg-black/40 p-2 border border-white/10 rounded">
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-bold block">Masalah Disarankan:</span>
              <p className="text-white">{saranAi.judul}</p>
            </div>
            {saranAi.akar && (
              <div>
                <span className="text-[10px] text-amber-400 uppercase font-bold block">Akar Masalah (Root Cause):</span>
                <p className="text-zinc-200">{saranAi.akar}</p>
              </div>
            )}
            {saranAi.tindakan && (
              <div>
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">Tindakan Korektif & Preventif:</span>
                <p className="text-zinc-200">{saranAi.tindakan}</p>
              </div>
            )}
            {saranAi.judul_singkat && (
              <div>
                <span className="text-[10px] text-cyan-400 uppercase font-bold block">Judul Singkat WhatsApp:</span>
                <p className="text-zinc-300 font-mono text-[11px]">{saranAi.judul_singkat}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={terapkanSaranAi}
              className="btn-retro btn-retro-sm bg-gradient-to-r from-emerald-700 to-teal-700 text-white font-bold flex items-center gap-1"
            >
              ✓ Terapkan Saran Ini
            </button>
          </div>
        </div>
      )}
      <div><label className="label-retro" htmlFor="pica-judul-singkat">Judul singkat untuk rekap WhatsApp</label><input id="pica-judul-singkat" value={f.judul_singkat} onChange={(e) => setF({ ...f, judul_singkat: e.target.value })} maxLength={80} className="input-retro !py-1.5" placeholder="mis. sengon potting — capaian ditambahkan otomatis" /></div>
      <div className="grid md:grid-cols-2 gap-3">
        <div><label className="label-retro">Akar masalah</label><textarea value={f.akar} onChange={(e) => setF({ ...f, akar: e.target.value })} className="input-retro h-16 resize-none" placeholder="Kosongkan bila belum dikonfirmasi" /></div>
        <div><label className="label-retro">Tindakan korektif</label><textarea value={f.tindakan} onChange={(e) => setF({ ...f, tindakan: e.target.value })} className="input-retro h-16 resize-none" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label-retro">PIC {terkunci && <Lock size={10} className="inline text-red-400" />}</label><select value={f.pic_id} onChange={(e) => setF({ ...f, pic_id: e.target.value })} className="input-retro"><option value="">— belum ditetapkan —</option>{boot.tim.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}</select></div>
        <div><label className="label-retro">Due date {(!bolehKelola || terkunci) && <Lock size={10} className="inline text-red-400" />}</label><input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} disabled={!bolehKelola} className="input-retro disabled:opacity-60 disabled:cursor-not-allowed" /></div>
      </div>
      {butuhAlasan && <div><label className="label-retro !text-red-300">Alasan perubahan (wajib, tercatat di riwayat)</label><input value={f.alasan} onChange={(e) => setF({ ...f, alasan: e.target.value })} className="input-retro !border-red-500" placeholder="Disepakati di rapat 19 Sep…" /></div>}
      <div className="grid grid-cols-3 gap-3">
        <div><label className="label-retro">Target</label><input type="number" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} className="input-retro" /></div>
        <div><label className="label-retro">Realisasi</label><input type="number" value={f.realisasi} onChange={(e) => setF({ ...f, realisasi: e.target.value })} className="input-retro" /></div>
        <div><label className="label-retro">Satuan</label><select value={f.satuan} onChange={(e) => setF({ ...f, satuan: e.target.value })} className="input-retro"><option value="">—</option>{opsi('satuan').map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}</select></div>
      </div>
      <div><label className="label-retro">Terkait PICA lain</label><select value={f.terkait_id} onChange={(e) => setF({ ...f, terkait_id: e.target.value })} className="input-retro"><option value="">— tidak ada —</option>{daftar.filter((p) => p.id !== awal?.id).map((p) => <option key={p.id} value={p.id}>{noPica(p)} · {p.judul.slice(0, 60)}</option>)}</select></div>
      {boot.properti.length > 0 && (
        <div className="border-t border-white/10 pt-2">
          <p className="label-retro">Kolom tambahan</p>
          <div className="grid grid-cols-2 gap-3">
            {boot.properti.map((k) => (
              <div key={k.id}><label className="label-retro !normal-case !tracking-normal">{k.label}</label>
                {k.tipe === 'checkbox' ? <input type="checkbox" checked={Boolean(f.props[k.id])} onChange={(e) => setF({ ...f, props: { ...f.props, [k.id]: e.target.checked } })} />
                  : k.tipe === 'select' ? <select value={String(f.props[k.id] ?? '')} onChange={(e) => setF({ ...f, props: { ...f.props, [k.id]: e.target.value } })} className="input-retro"><option value="">—</option>{(JSON.parse(k.opsi_json || '[]') as string[]).map((o) => <option key={o} value={o}>{o}</option>)}</select>
                    : <input type={k.tipe === 'angka' ? 'number' : k.tipe === 'tanggal' ? 'date' : 'text'} value={String(f.props[k.id] ?? '')} onChange={(e) => setF({ ...f, props: { ...f.props, [k.id]: k.tipe === 'angka' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value } })} className="input-retro" />}
              </div>
            ))}
          </div>
        </div>
      )}
      <button onClick={simpan} disabled={menyimpan} className="btn-retro bg-amber-600 w-full">{menyimpan ? 'Menyimpan…' : awal ? 'Simpan perubahan' : 'Buat PICA'}</button>
    </Modal>
  );
};

const PanelAtur: React.FC<{ boot: Bootstrap; pengguna: Pengguna; onSelesai: () => void; onKunci: () => void; notify: (m: string) => void }> = ({ boot, pengguna, onSelesai, onKunci, notify }) => {
  const [kolom, setKolom] = useState({ id: '', label: '', tipe: 'teks' });
  const [bidang, setBidang] = useState('');
  const periodeAktif = boot.periode.find((p) => p.id === boot.pengaturan.periode_aktif);

  const tambahKolom = async () => {
    try { await api('/api/properti', { body: { id: kolom.id.trim().toLowerCase(), label: kolom.label.trim(), tipe: kolom.tipe } }); setKolom({ id: '', label: '', tipe: 'teks' }); notify('KOLOM DITAMBAHKAN'); onSelesai(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };
  const tambahBidang = async () => {
    try { await api('/api/opsi', { body: { grup: 'bidang', nilai: bidang.trim(), warna: 'cyan' } }); setBidang(''); notify('BIDANG DITAMBAHKAN'); onSelesai(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };

  return (
    <div className="mx-2 mb-2 panel-retro grid md:grid-cols-3 gap-4">
      <div>
        <p className="label-retro">Kolom baru (gaya Notion)</p>
        <div className="space-y-1.5">
          <input value={kolom.label} onChange={(e) => setKolom({ ...kolom, label: e.target.value, id: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') })} placeholder="Label, mis. Nomor surat" className="input-retro !py-1.5" />
          <div className="flex gap-1.5">
            <input value={kolom.id} onChange={(e) => setKolom({ ...kolom, id: e.target.value })} placeholder="id" className="input-retro !py-1.5 font-mono" />
            <select value={kolom.tipe} onChange={(e) => setKolom({ ...kolom, tipe: e.target.value })} className="input-retro !py-1.5 !w-auto">{['teks', 'angka', 'tanggal', 'checkbox', 'url'].map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <button onClick={tambahKolom} disabled={!kolom.id || !kolom.label} className="btn-retro btn-retro-sm bg-zinc-700 w-full">Tambah kolom</button>
        </div>
      </div>
      <div>
        <p className="label-retro">Bidang baru</p>
        <div className="space-y-1.5">
          <input value={bidang} onChange={(e) => setBidang(e.target.value)} placeholder="mis. Pemeliharaan" className="input-retro !py-1.5" />
          <button onClick={tambahBidang} disabled={!bidang.trim()} className="btn-retro btn-retro-sm bg-zinc-700 w-full">Tambah bidang</button>
          <p className="text-[11px] text-zinc-400">Aktif: {boot.opsi.filter((o) => o.grup === 'bidang').map((o) => o.label).join(', ')}</p>
        </div>
      </div>
      <div>
        <p className="label-retro">Rapat mingguan</p>
        {periodeAktif ? (
          <>
            <p className="text-[12px] text-zinc-200 mb-2">Periode {periodeAktif.id} ({W.formatPendek(periodeAktif.mulai)} – {W.formatPendek(periodeAktif.selesai)})</p>
            {periodeAktif.terkunci ? <p className="text-[12px] text-red-300 flex items-center gap-1"><Lock size={12} /> Sudah dikunci. Ubah PIC/tenggat butuh alasan.</p>
              : pengguna.peran === 'admin' ? <button onClick={onKunci} className="btn-retro btn-retro-sm bg-red-800 w-full"><Lock size={12} /> Kunci PIC &amp; due date</button>
                : <p className="text-[12px] text-zinc-400">Hanya Admin yang bisa mengunci.</p>}
          </>
        ) : <p className="text-[12px] text-zinc-400">Periode aktif belum diatur.</p>}
      </div>
      {pengguna.peran === 'admin' && <RekapWa notify={notify} />}
    </div>
  );
};

/** Rekap progres PICA ke grup WhatsApp (Fonnte): tujuan grup, pratinjau, kirim manual. */
interface StatusWa { terpasang: boolean; tersambung?: boolean; nomor?: string; nama?: string; kuota?: string; paket?: string; kedaluwarsa?: string; galat?: string }

/** Satu kotak keadaan Fonnte: token, nomor tersambung, kuota — plus apa yang harus dilakukan. */
const StatusFonnte: React.FC<{ status: StatusWa | null }> = ({ status }) => {
  if (!status) return <p className="text-[11px] text-zinc-500 mb-3 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Memeriksa Fonnte…</p>;
  const [kotak, judul, isi] = !status.terpasang
    ? ['border-amber-500 bg-amber-950/40', 'Token Fonnte belum dipasang', status.galat ?? 'Admin server menjalankan "npx wrangler secret put FONNTE_TOKEN" dari folder server, lalu menempel token perangkat dari fonnte.com.']
    : status.tersambung
      ? ['border-emerald-500 bg-emerald-950/40', `Tersambung · ${status.nomor ?? ''}`, [status.nama, status.kuota && `kuota ${status.kuota}`, status.kedaluwarsa && `aktif s/d ${status.kedaluwarsa}`].filter(Boolean).join(' · ')]
      : ['border-red-500 bg-red-950/40', 'Nomor WA terputus', status.galat ?? 'Buka fonnte.com → Device → Connect, lalu pindai QR dengan WhatsApp di HP pengirim.'];
  return (
    <div className={`border-2 ${kotak} px-2 py-1.5 mb-3`}>
      <p className="text-[12px] font-bold">{judul}</p>
      {isi && <p className="text-[11px] text-zinc-300 leading-snug">{isi}</p>}
    </div>
  );
};

const RekapWa: React.FC<{ notify: (m: string) => void }> = ({ notify }) => {
  const [grup, setGrup] = useState('');
  const [aktif, setAktif] = useState(false);
  const [notifAktivitas, setNotifAktivitas] = useState(true);
  const [tersimpan, setTersimpan] = useState({ grup: '', aktif: false, notifAktivitas: true });
  const [status, setStatus] = useState<StatusWa | null>(null);
  const [daftarGrup, setDaftarGrup] = useState<{ id: string; nama: string }[] | null>(null);
  // Jumat (WITA) = rekap mingguan, sama seperti jadwal otomatisnya.
  const [jenis, setJenis] = useState<'harian' | 'mingguan'>(() => (new Date(Date.now() + 480 * 60000).getUTCDay() === 5 ? 'mingguan' : 'harian'));
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<'simpan' | 'pratinjau' | 'kirim' | 'uji' | 'grup' | null>(null);

  useEffect(() => {
    api<{ pengaturan: { kunci: string; nilai: string }[]; fonnte_terpasang?: boolean }>('/api/pengaturan')
      .then((d) => {
        const nilai = (k: string) => d.pengaturan.find((x) => x.kunci === k)?.nilai ?? '';
        const awal = {
          grup: nilai('wa_grup_id'),
          aktif: nilai('wa_aktif') === '1',
          notifAktivitas: nilai('wa_notif_pica') !== '0',
        };
        setGrup(awal.grup);
        setAktif(awal.aktif);
        setNotifAktivitas(awal.notifAktivitas);
        setTersimpan(awal);
      })
      .catch(() => undefined);
    api<StatusWa>('/api/wa/status').then(setStatus).catch(() => undefined);
  }, []);

  /** Ambil grup yang diikuti nomor Fonnte, supaya ID grup dipilih, bukan diketik. */
  const muatGrup = async (segarkan: boolean) => {
    if (segarkan && !window.confirm('Perbarui daftar grup dari WhatsApp? Lakukan hanya setelah nomor Fonnte bergabung ke grup baru — terlalu sering bisa membuat nomor diblokir.')) return;
    setSibuk('grup');
    try {
      const d = await api<{ grup: { id: string; nama: string }[]; galat?: string }>(`/api/wa/grup${segarkan ? '?segarkan=1' : ''}`);
      setDaftarGrup(d.grup);
      if (d.galat) notify(d.galat.toUpperCase());
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT GRUP'); }
    finally { setSibuk(null); }
  };

  /** Pesan uji langsung ke grup (tanpa antrean), meski pengiriman otomatis masih mati. */
  const ujiKirim = async () => {
    setSibuk('uji');
    try {
      await api('/api/wa/uji', { body: { tujuan: grupBersih } });
      notify('PESAN UJI TERKIRIM — CEK GRUP WA');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'UJI GAGAL'); }
    finally { setSibuk(null); }
  };

  const grupBersih = grup.trim();
  const grupSah = !grupBersih || grupBersih.endsWith('@g.us');
  const berubah = grupBersih !== tersimpan.grup || aktif !== tersimpan.aktif || notifAktivitas !== tersimpan.notifAktivitas;
  const siapKirim = Boolean(tersimpan.grup) && tersimpan.aktif && !berubah;

  const simpan = async () => {
    setSibuk('simpan');
    try {
      await api('/api/pengaturan', {
        body: {
          wa_grup_id: grupBersih,
          wa_aktif: aktif ? '1' : '0',
          wa_notif_pica: notifAktivitas ? '1' : '0',
        },
      });
      setTersimpan({ grup: grupBersih, aktif, notifAktivitas });
      notify('PENGATURAN WHATSAPP DISIMPAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN'); }
    finally { setSibuk(null); }
  };

  const jalankan = async (kirim: boolean) => {
    setSibuk(kirim ? 'kirim' : 'pratinjau');
    try {
      const d = await api<{ pesan: string; terkirim: boolean; demo?: boolean }>(`/api/notify/rekap-pica?jenis=${jenis}${kirim ? '' : '&dryRun=1'}`, { method: 'POST', body: {} });
      setPesan(d.pesan);
      if (kirim) notify(d.demo ? 'MODE DEMO: PESAN TIDAK DIKIRIM' : d.terkirim ? 'REKAP TERKIRIM KE GRUP' : 'REKAP MASUK ANTREAN WHATSAPP');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
    finally { setSibuk(null); }
  };

  return (
    <div className="md:col-span-3 border-t-2 border-white/10 pt-4 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4">
      <div>
        <p className="label-retro">Rekap PICA ke grup WhatsApp</p>
        <p className="text-[12px] text-zinc-300 leading-relaxed mb-3">Terkirim otomatis pukul 16.00 WITA: Senin–Kamis rekap harian, Jumat rekap mingguan. Hari libur dilewati.</p>
        <StatusFonnte status={status} />

        <label htmlFor="wa-grup" className="text-[11px] uppercase text-zinc-400">ID grup</label>
        <input id="wa-grup" value={grup} onChange={(e) => setGrup(e.target.value)} placeholder="120363xxxxxxxxxx@g.us" className="input-retro !py-1.5 font-mono mt-1" />
        {!grupSah && <p className="text-[11px] text-amber-300 mt-1">ID grup WhatsApp berakhiran @g.us.</p>}
        {status?.tersambung && (
          <div className="mt-1.5">
            <div className="flex gap-1.5">
              <button onClick={() => muatGrup(false)} disabled={sibuk !== null} className="btn-retro btn-retro-sm bg-zinc-800 flex-1">
                {sibuk === 'grup' ? <Loader2 size={12} className="animate-spin" /> : <Users size={12} />} Pilih dari daftar grup
              </button>
              {daftarGrup && (
                <button onClick={() => muatGrup(true)} disabled={sibuk !== null} className="btn-retro btn-retro-sm bg-zinc-800" title="Setelah nomor Fonnte bergabung ke grup baru">
                  <RefreshCw size={12} /> Perbarui
                </button>
              )}
            </div>
            {daftarGrup && (daftarGrup.length === 0
              ? <p className="text-[11px] text-zinc-400 mt-1">Belum ada grup. Masukkan nomor Fonnte ke grup WA, lalu ketuk Perbarui.</p>
              : (
                <div className="mt-1 max-h-36 overflow-y-auto border-2 border-white/15">
                  {daftarGrup.map((g) => (
                    <button key={g.id} onClick={() => setGrup(g.id)} aria-pressed={grupBersih === g.id} className={`w-full text-left px-2 py-1.5 text-[12px] border-b border-white/10 last:border-0 ${grupBersih === g.id ? 'bg-emerald-900/60' : 'hover:bg-white/5'}`}>
                      <span className="block font-bold truncate">{g.nama}</span>
                      <span className="block font-mono text-[10px] text-zinc-400 truncate">{g.id}</span>
                    </button>
                  ))}
                </div>
              ))}
          </div>
        )}
        <label htmlFor="wa-aktif" className="flex items-center gap-2 mt-2 text-[13px] text-zinc-200 cursor-pointer">
          <input id="wa-aktif" type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
          Pengiriman WhatsApp aktif
        </label>
        <label htmlFor="wa-notif-pica" className="flex items-start gap-2 mt-2.5 text-[12px] text-zinc-200 cursor-pointer bg-black/40 border border-white/10 p-2">
          <input id="wa-notif-pica" type="checkbox" checked={notifAktivitas} onChange={(e) => setNotifAktivitas(e.target.checked)} className="w-4 h-4 mt-0.5 accent-emerald-500 shrink-0" />
          <span className="leading-snug">
            <b className="text-emerald-300 block mb-0.5">Notifikasi Aktivitas PICA</b>
            Kirim notifikasi instan ke WA grup &amp; Info aplikasi saat ada anggota membuat PICA, mengubah status, mengunggah bukti, atau menutup PICA.
          </span>
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-1.5 mt-2">
          <button onClick={simpan} disabled={!berubah || !grupSah || sibuk !== null} className="btn-retro btn-retro-sm bg-zinc-700">
            {sibuk === 'simpan' ? 'Menyimpan…' : 'Simpan pengaturan WhatsApp'}
          </button>
          <button onClick={ujiKirim} disabled={!grupBersih || !grupSah || !status?.terpasang || sibuk !== null} className="btn-retro btn-retro-sm bg-sky-700" title="Kirim satu pesan uji ke grup">
            {sibuk === 'uji' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Uji kirim
          </button>
        </div>

        <div className="flex gap-1.5 mt-4" role="group" aria-label="Jenis rekap">
          {(['harian', 'mingguan'] as const).map((j) => (
            <button key={j} onClick={() => { setJenis(j); setPesan(null); }} aria-pressed={jenis === j} className={`btn-retro btn-retro-sm flex-1 ${jenis === j ? 'bg-emerald-700' : 'bg-zinc-800'}`}>
              {j === 'harian' ? 'Harian' : 'Mingguan'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5 mt-1.5">
          <button onClick={() => jalankan(false)} disabled={sibuk !== null} className="btn-retro btn-retro-sm bg-zinc-700">
            {sibuk === 'pratinjau' ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Pratinjau
          </button>
          <button onClick={() => jalankan(true)} disabled={!siapKirim || sibuk !== null} className="btn-retro btn-retro-sm bg-emerald-700" title={siapKirim ? undefined : 'Simpan ID grup dan aktifkan pengiriman WhatsApp dulu'}>
            {sibuk === 'kirim' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Kirim sekarang
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <p className="label-retro">Pratinjau pesan</p>
        {pesan
          ? <PesanWa teks={pesan} />
          : <p className="text-[12px] text-zinc-500 border-2 border-dashed border-white/15 p-4 text-center">Ketuk Pratinjau untuk melihat pesan yang akan masuk ke grup.</p>}
      </div>
    </div>
  );
};

/** *tebal* dan _miring_ dirender seperti di WhatsApp. */
const formatWa = (baris: string): React.ReactNode[] =>
  baris.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).filter(Boolean).map((b, i) =>
    b.length > 2 && b.startsWith('*') && b.endsWith('*') ? <strong key={i}>{b.slice(1, -1)}</strong>
      : b.length > 2 && b.startsWith('_') && b.endsWith('_') ? <em key={i} className="text-[#aebac1]">{b.slice(1, -1)}</em>
        : <React.Fragment key={i}>{b}</React.Fragment>);

const PesanWa: React.FC<{ teks: string }> = ({ teks }) => (
  <div className="bg-[#0b141a] border-[3px] border-black p-3 max-h-96 overflow-auto custom-scrollbar">
    <div className="bg-[#005c4b] text-[#e9edef] px-3 py-2 max-w-[34rem] shadow-[3px_3px_0_#000] text-[13px] leading-relaxed break-words">
      {teks.split('\n').map((baris, i) => <p key={i} className="min-h-[1em]">{formatWa(baris)}</p>)}
    </div>
  </div>
);
