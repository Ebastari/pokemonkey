import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, FileSpreadsheet, Loader2, ArrowLeft, CopyPlus, X, Save, Cloud, CloudOff, HardDrive, Lock, Unlock } from 'lucide-react';
import {
  muatRabRnr, simpanRabRnr, rabBaru, ambilRabServer, kirimRabServer, hapusRabServer, kirimHapusTertunda, gabungRab, sinkronRabAktif, eksporRabRnr, kartuRab, barisRekap, isiKeranjang, salinKeKeranjang,
  ubahBaris, aturQtyBaris, tambahBarisKosong, hapusBaris, susunRab,
  totalRab, totalUraian, totalMinggu, nilaiMinggu, deskripsiWbs, perluDirektur,
  BATAS_PERSETUJUAN, PENYETUJU_DIV_HEAD, PENYETUJU_DIREKTUR, PENYETUJU_VERIFIKASI, PENYETUJU_PIMPINAN,
  DAFTAR_STATUS_RAB, DAFTAR_WBS, type RabRnr as TipeRab, type StatusRab,
} from '../lib/rab-rnr';
import { DAFTAR_BULAN, formatRupiah } from '../lib/rab-hcga';
import { PapanRabRnr, PilihKategori } from './PapanRabRnr';
import { muatKatalog, simpanBarangKatalog } from '../lib/katalog-rab';
import { PratinjauRabRnr } from './PratinjauRabRnr';
import { ModalBukaKunci } from './ModalBukaKunci';
import { muatSurat, simpanSuratKeServer } from '../lib/dokumen';
import { generateNomorSuratOtomatis, type ItemSurat } from '../lib/tipe-surat';
import * as W from '../lib/waktu';
import type { Pengguna } from '../lib/tipe-api';

/**
 * RAB RNR: daftar pengajuan bulanan → papan (pengisian cepat → keranjang →
 * susun per minggu) + tabel isian manual yang sinkron → Simpan RAB → pratinjau
 * Export Excel/PDF. "Salin ke bulan depan" memasukkan ajuan bulan lalu ke keranjang.
 * RAB tersimpan di server (sinkron antar perangkat) dengan salinan di perangkat
 * untuk tampil seketika dan tetap bisa diisi saat offline.
 */

type StatusSinkron = 'memuat' | 'menyimpan' | 'tersimpan' | 'offline' | 'lokal';

const LABEL_SINKRON: Record<StatusSinkron, { teks: string; warna: string }> = {
  memuat: { teks: 'Memuat dari server…', warna: 'text-zinc-400' },
  menyimpan: { teks: 'Menyimpan ke server…', warna: 'text-amber-300' },
  tersimpan: { teks: 'Tersimpan di server', warna: 'text-emerald-300' },
  offline: { teks: 'Offline · tersimpan di perangkat, dikirim saat online', warna: 'text-rose-300' },
  lokal: { teks: 'Mode demo · hanya di perangkat ini', warna: 'text-zinc-400' },
};

const TandaSinkron: React.FC<{ status: StatusSinkron }> = ({ status }) => {
  const { teks, warna } = LABEL_SINKRON[status];
  const Ikon = status === 'offline' ? CloudOff : status === 'lokal' ? HardDrive : status === 'tersimpan' ? Cloud : Loader2;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] ${warna}`} role="status">
      <Ikon size={12} className={status === 'memuat' || status === 'menyimpan' ? 'animate-spin' : ''} /> {teks}
    </span>
  );
};

interface Props {
  pengguna: Pengguna;
  notify: (pesan: string) => void;
  /** Buka RAB ini langsung dalam pratinjau dokumen (dari tautan Data Surat). */
  bukaId?: string | null;
  onDibuka?: () => void;
}

const WARNA_STATUS: Record<StatusRab, string> = {
  Draf: 'border-zinc-500 bg-zinc-800 text-zinc-200',
  Diajukan: 'border-blue-400 bg-blue-950 text-blue-200',
  Verifikasi: 'border-amber-400 bg-amber-950 text-amber-200',
  Disetujui: 'border-emerald-400 bg-emerald-950 text-emerald-200',
  Dicairkan: 'border-cyan-400 bg-cyan-950 text-cyan-200',
  Ditolak: 'border-rose-400 bg-rose-950 text-rose-200',
};
const ROMAWI = ['I', 'II', 'III', 'IV'];
const kelas = 'input-retro !py-1 !text-[12px]';
const angka = (v: string) => Math.max(0, Number(v.replace(/[^\d.]/g, '')) || 0);

export const RabRnr: React.FC<Props> = ({ pengguna, notify, bukaId, onDibuka }) => {
  const [daftar, setDaftar] = useState<TipeRab[]>(muatRabRnr);
  const [aktifId, setAktifId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'semua' | StatusRab>('semua');
  const [daftarSurat, setDaftarSurat] = useState<ItemSurat[]>([]);
  const [modal, setModal] = useState<{ bulan: string; tahun: number; judul: string; lokasi: string; nomor: string; urut: number; salinDari: string } | null>(null);
  const [pratinjau, setPratinjau] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [mengekspor, setMengekspor] = useState<string | null>(null);
  const [bukaModalKunci, setBukaModalKunci] = useState(false);
  const bolehKelola = true;

  useEffect(() => { simpanRabRnr(daftar); }, [daftar]);

  // ---------- sinkron server: salinan perangkat tampil dulu, lalu digabung dengan server.
  const [sinkron, setSinkron] = useState<StatusSinkron>(sinkronRabAktif() ? 'memuat' : 'lokal');
  const daftarRef = useRef(daftar);
  daftarRef.current = daftar;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const antre = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const kirim = useCallback(async (id: string) => {
    delete antre.current[id];
    const r = daftarRef.current.find((x) => x.id === id);
    if (!r || !sinkronRabAktif()) return;
    setSinkron('menyimpan');
    try {
      const terbaru = await kirimRabServer(r);
      if (terbaru) {
        setDaftar((d) => d.map((x) => (x.id === id ? terbaru : x)));
        notifyRef.current(`${terbaru.nomorRab} DIPERBARUI DARI PERANGKAT LAIN`);
      }
      if (!Object.keys(antre.current).length) setSinkron('tersimpan');
    } catch {
      setSinkron('offline');
    }
  }, []);

  /** Kirim RAB ke server sesaat setelah perubahan terakhir (diberi jeda supaya tidak tiap ketikan). */
  const jadwalkan = useCallback((id: string, jeda = 1200) => {
    if (!sinkronRabAktif()) return;
    clearTimeout(antre.current[id]);
    antre.current[id] = setTimeout(() => { kirim(id); }, jeda);
  }, [kirim]);

  useEffect(() => {
    if (!sinkronRabAktif()) return;
    let batal = false;
    (async () => {
      try {
        await kirimHapusTertunda();
        const { rab, dihapus } = await ambilRabServer();
        if (batal) return;
        // RAB lama yang baru ada di perangkat ini ikut terkirim ke server.
        const { daftar: gabung, perluKirim } = gabungRab(daftarRef.current, rab, dihapus, pengguna.id);
        daftarRef.current = gabung;
        setDaftar(gabung);
        perluKirim.forEach((x, i) => jadwalkan(x.id, 100 + i * 150));
        setSinkron(perluKirim.length ? 'menyimpan' : 'tersimpan');
      } catch {
        if (!batal) setSinkron('offline');
      }
    })();
    return () => { batal = true; };
  }, [pengguna.id, jadwalkan]);

  // Keluar dari Money Monkey: yang masih menunggu jeda langsung dikirim.
  useEffect(() => () => {
    for (const id of Object.keys(antre.current)) {
      clearTimeout(antre.current[id]);
      kirim(id);
    }
  }, [kirim]);

  // Tautan dari Data Surat: tunggu daftar selesai digabung dengan server, lalu buka pratinjaunya.
  useEffect(() => {
    if (!bukaId || sinkron === 'memuat') return;
    const nomor = bukaId.startsWith('nomor:') ? bukaId.slice(6).trim() : null;
    const cocok = daftar.find((r) => (nomor ? r.nomorRab.trim() === nomor : r.id === bukaId));
    if (cocok) {
      setAktifId(cocok.id);
      setPratinjau(true);
    } else {
      notify('DOKUMEN RAB TIDAK DITEMUKAN · MUNGKIN SUDAH DIHAPUS ATAU BELUM TERSIMPAN DI SERVER');
    }
    onDibuka?.();
  }, [bukaId, sinkron, daftar, notify, onDibuka]);

  const aktif = daftar.find((r) => r.id === aktifId) ?? null;
  const ubah = (r: TipeRab, jeda?: number) => {
    setDaftar((d) => d.map((x) => (x.id === r.id ? { ...r, diubahPada: new Date().toISOString() } : x)));
    jadwalkan(r.id, jeda);
  };
  const tampil = useMemo(() => daftar.filter((r) => filter === 'semua' || r.status === filter), [daftar, filter]);

  // ---------- nomor RAB: urut berjalan dari Data Surat (kategori RAB)
  const nomorUntuk = (bulan: string, tahun: number, surat: ItemSurat[]) => {
    const noBulan = Math.max(1, DAFTAR_BULAN.indexOf(bulan) + 1);
    return generateNomorSuratOtomatis('rab', surat, `${tahun}-${String(noBulan).padStart(2, '0')}-01T00:00:00`);
  };
  const bukaModal = async (salinDari?: TipeRab) => {
    let bulan: string;
    let tahun: number;
    if (salinDari) {
      const i = DAFTAR_BULAN.indexOf(salinDari.bulan);
      bulan = DAFTAR_BULAN[(i + 1) % 12];
      tahun = salinDari.tahun + (i === 11 ? 1 : 0);
    } else {
      const h = W.hariIniWita();
      bulan = DAFTAR_BULAN[Number(h.slice(5, 7)) - 1];
      tahun = Number(h.slice(0, 4));
    }
    const isi = (surat: ItemSurat[]) => {
      const g = nomorUntuk(bulan, tahun, surat);
      return { bulan, tahun, judul: `RAB RNR - ${bulan} ${tahun}`, lokasi: salinDari?.lokasi ?? 'Site EBL - RANTAU', nomor: g.nomorSurat, urut: g.nomorUrut, salinDari: salinDari?.id ?? '' };
    };
    setModal(isi(daftarSurat));
    try {
      const surat = await muatSurat();
      setDaftarSurat(surat);
      setModal((m) => (m ? { ...isi(surat), judul: m.judul, lokasi: m.lokasi, salinDari: m.salinDari } : m));
    } catch {
      notify('DATA SURAT TIDAK TERJANGKAU · NOMOR RAB MUNGKIN BELUM URUT');
    }
  };
  const ubahPeriode = (bulan: string, tahun: number) => setModal((m) => {
    if (!m) return m;
    const g = nomorUntuk(bulan, tahun, daftarSurat);
    return { ...m, bulan, tahun, judul: `RAB RNR - ${bulan} ${tahun}`, nomor: g.nomorSurat, urut: g.nomorUrut };
  });

  const buat = (mode: 'otomatis' | 'manual') => {
    if (!modal) return;
    let r = rabBaru({ bulan: modal.bulan, tahun: modal.tahun, nomorRab: modal.nomor.trim(), nomorUrut: modal.urut, lokasi: modal.lokasi, judul: modal.judul, pemohonId: pengguna.id, pemohonNama: pengguna.nama });
    const sumber = daftar.find((x) => x.id === modal.salinDari);
    if (sumber) {
      r = salinKeKeranjang(sumber, { ...r, kepada: sumber.kepada, up: sumber.up, penyetuju: sumber.penyetuju, jabatanPenyetuju: sumber.jabatanPenyetuju, catatan: sumber.catatan,
        penyetujuDivHead: sumber.penyetujuDivHead ?? r.penyetujuDivHead, jabatanDivHead: sumber.jabatanDivHead ?? r.jabatanDivHead });
    }
    r = { ...r, mode };
    // Mode manual tidak memakai keranjang: salinan bulan lalu langsung jadi baris tabel (Minggu I).
    if (mode === 'manual') r = kartuRab(r).length ? susunRab(r) : tambahBarisKosong(r);
    setDaftar((d) => [r, ...d]);
    jadwalkan(r.id, 300);
    setModal(null);
    setAktifId(r.id);
    notify(sumber ? `RAB ${r.nomorRab} DIBUAT · AJUAN BULAN LALU ADA DI KERANJANG` : `RAB ${r.nomorRab} DIBUAT`);
    const surat: ItemSurat = {
      id: `rab-${r.id}`, kategori: 'rab', nomorUrut: r.nomorUrut, nomorSurat: r.nomorRab, namaSurat: r.judul,
      tanggal: r.tanggal, namaPembuat: pengguna.nama, keterangan: `Money Monkey · RAB RNR ${r.bulan} ${r.tahun}`, dibuatPada: r.dibuatPada,
    };
    simpanSuratKeServer(surat)
      .then(() => setDaftarSurat((d) => [surat, ...d]))
      .catch((e) => notify(e instanceof Error ? `NOMOR RAB BELUM TERCATAT DI DATA SURAT: ${e.message}`.toUpperCase() : 'NOMOR RAB BELUM TERCATAT DI DATA SURAT'));
  };

  const hapus = (r: TipeRab) => {
    if (!confirm(`Hapus ${r.judul} (${r.nomorRab})?`)) return;
    setDaftar((d) => d.filter((x) => x.id !== r.id));
    if (aktifId === r.id) setAktifId(null);
    clearTimeout(antre.current[r.id]);
    delete antre.current[r.id];
    if (sinkronRabAktif()) {
      hapusRabServer(r.id).catch(() => notify('RAB DIHAPUS DI PERANGKAT · SERVER BELUM TERJANGKAU, DICOBA LAGI NANTI'));
    }
  };
  const ekspor = async (r: TipeRab) => {
    if (!totalRab(r)) { notify('BELUM ADA URAIAN BERNILAI'); return; }
    setMengekspor(r.id);
    try {
      const h = await eksporRabRnr(r);
      notify(h === 'diunduh' ? 'EXCEL DIUNDUH' : 'EXCEL SIAP DIBAGIKAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT EXCEL'); } finally { setMengekspor(null); }
  };
  /**
   * Simpan RAB → uraian yang diketik langsung di tabel dan belum ada di katalog ikut
   * masuk katalog (Admin/Supervisor), lalu buka pratinjau untuk Export Excel/PDF.
   */
  const simpanRab = async (r: TipeRab) => {
    const berisi = barisRekap(r).filter((u) => u.uraian.trim());
    if (!berisi.some((u) => totalUraian(u) > 0)) { notify('SUSUN MINIMAL SATU URAIAN DENGAN HARGA & QTY'); return; }
    setMenyimpan(true);
    ubah({ ...r, terkunci: true, kartu: kartuRab(r).filter((k) => k.uraian.trim()).map((k) => ({ ...k, uraian: k.uraian.trim() })) }, 200);
    const sisaKeranjang = isiKeranjang(r).length;
    if (sisaKeranjang) notify(`${sisaKeranjang} AJUAN MASIH DI KERANJANG · TIDAK IKUT RAB SEBELUM DISUSUN`);
    let baru = 0;
    if (bolehKelola) {
      try {
        const katalog = await muatKatalog();
        const ada = new Set(katalog.map((k) => k.nama.trim().toLowerCase()));
        for (const u of berisi) {
          const kunci = u.uraian.trim().toLowerCase();
          if (ada.has(kunci) || !u.harga) continue;
          await simpanBarangKatalog({ nama: u.uraian.trim(), wbs: u.wbs, satuan: u.satuan || 'Paket', harga: u.harga, kelompok: 'Pengajuan Rutin', urutan: 50 });
          ada.add(kunci);
          baru++;
        }
      } catch {
        notify('RAB TERSIMPAN · KATALOG BELUM TERJANGKAU, URAIAN BARU BELUM MASUK KATALOG');
      }
    }
    setMenyimpan(false);
    notify(baru ? `RAB TERSIMPAN & TERKUNCI · ${baru} URAIAN BARU MASUK KATALOG` : 'RAB TERSIMPAN & TERKUNCI (PASSWORD: eblhasnurajadeh)');
    setPratinjau(true);
  };

  // ======================================================================== daftar
  if (!aktif) {
    const totalSemua = daftar.reduce((n, r) => n + totalRab(r), 0);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <div className="font-title text-[12px] text-yellow-300">RAB RNR</div>
            <div className="text-[11px] text-zinc-400">Rencana Anggaran Bulanan Departemen RNR · {daftar.length} pengajuan · {formatRupiah(totalSemua)}</div>
            <TandaSinkron status={sinkron} />
          </div>
          <button type="button" onClick={() => bukaModal()} className="btn-retro bg-amber-600 !py-1.5 text-[12px]"><Plus size={14} /> RAB baru</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['semua', ...DAFTAR_STATUS_RAB] as const).map((s) => (
            <button key={s} type="button" onClick={() => setFilter(s)}
              className={`chip-retro !text-[11px] ${filter === s ? 'border-yellow-300 bg-yellow-500 text-black' : 'border-white/30 text-zinc-300'}`}>
              {s === 'semua' ? 'Semua' : s} ({s === 'semua' ? daftar.length : daftar.filter((r) => r.status === s).length})
            </button>
          ))}
        </div>
        {!tampil.length && <div className="p-8 text-center text-zinc-400 border-2 border-dashed border-white/20">Belum ada RAB. Tekan <b className="text-white">RAB baru</b>.</div>}
        <div className="grid gap-2">
          {tampil.map((r) => (
            <div key={r.id} className="border-2 border-white/20 bg-black/50 p-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={() => setAktifId(r.id)} className="flex-1 min-w-[220px] text-left">
                <div className="font-bold text-white text-[13px] hover:text-amber-300 flex items-center gap-1.5">
                  {r.terkunci && <span title="RAB Terkunci" className="inline-flex"><Lock size={12} className="text-amber-400 shrink-0" /></span>}
                  <span>{r.judul}</span>
                  {r.terkunci && (
                    <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded font-normal font-mono">
                      Terkunci
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-cyan-300 font-mono">{r.nomorRab}</div>
                <div className="text-[11px] text-zinc-400">{barisRekap(r).length} uraian · {isiKeranjang(r).length ? `${isiKeranjang(r).length} di keranjang · ` : ''}{r.pemohonNama}</div>
              </button>
              <select value={r.status} onChange={(e) => ubah({ ...r, status: e.target.value as StatusRab })} className={`px-2 py-1 text-[11px] font-bold uppercase border ${WARNA_STATUS[r.status]}`} aria-label="Status">
                {DAFTAR_STATUS_RAB.map((s) => <option key={s} value={s} className="bg-zinc-900 text-white">{s}</option>)}
              </select>
              <span className="font-mono text-emerald-300 text-[13px] font-bold w-32 text-right">{formatRupiah(totalRab(r))}</span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => ekspor(r)} disabled={mengekspor === r.id} className="btn-retro btn-retro-sm bg-emerald-700">
                  {mengekspor === r.id ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />} Excel
                </button>
                <button type="button" onClick={() => bukaModal(r)} className="btn-retro btn-retro-sm bg-zinc-800" title="Buat RAB bulan berikutnya; ajuan bulan ini masuk keranjang untuk dipilah">
                  <CopyPlus size={12} /> Salin ke bulan depan
                </button>
                <button type="button" onClick={() => hapus(r)} className="btn-ikon !w-7 !h-7 bg-rose-950 text-rose-300" aria-label="Hapus"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>

        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-zinc-900 border-4 border-white p-4 max-w-lg w-full shadow-[8px_8px_0_#000] space-y-3 text-[12px]">
              <div className="flex items-center justify-between border-b-2 border-white/20 pb-2">
                <h3 className="font-title text-[13px] text-yellow-300">{modal.salinDari ? 'SALIN KE BULAN DEPAN' : 'RAB RNR BARU'}</h3>
                <button type="button" onClick={() => setModal(null)} className="text-zinc-400 hover:text-white" aria-label="Tutup"><X size={16} /></button>
              </div>
              <label className="block"><span className="label-retro">Judul</span><input value={modal.judul} onChange={(e) => setModal({ ...modal, judul: e.target.value })} className={kelas} /></label>
              <div className="grid grid-cols-2 gap-2">
                <label><span className="label-retro">Bulan</span>
                  <select value={modal.bulan} onChange={(e) => ubahPeriode(e.target.value, modal.tahun)} className={kelas}>{DAFTAR_BULAN.map((b) => <option key={b}>{b}</option>)}</select>
                </label>
                <label><span className="label-retro">Tahun</span><input type="number" value={modal.tahun} onChange={(e) => ubahPeriode(modal.bulan, Number(e.target.value) || modal.tahun)} className={`${kelas} font-mono`} /></label>
              </div>
              <label className="block"><span className="label-retro">Nomor RAB</span>
                <input value={modal.nomor} onChange={(e) => setModal({ ...modal, nomor: e.target.value })} className={`${kelas} font-mono`} />
                <span className="text-[11px] text-zinc-400">Nomor urut otomatis dari Data Surat (kategori RAB) dan ikut tercatat di sana.</span>
              </label>
              <label className="block"><span className="label-retro">Lokasi</span><input value={modal.lokasi} onChange={(e) => setModal({ ...modal, lokasi: e.target.value })} className={kelas} /></label>
              <label className="block"><span className="label-retro">Salin uraian dari</span>
                <select value={modal.salinDari} onChange={(e) => setModal({ ...modal, salinDari: e.target.value })} className={kelas}>
                  <option value="">— tidak, pilih dari katalog —</option>
                  {daftar.map((r) => <option key={r.id} value={r.id}>{r.judul} · {barisRekap(r).length} uraian (masuk keranjang)</option>)}
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/20">
                <button type="button" onClick={() => setModal(null)} className="btn-retro bg-zinc-800">Batal</button>
                <button type="button" onClick={() => buat('otomatis')} className="btn-retro bg-amber-600" title="Pilih uraian dari katalog, susun per minggu"><Plus size={14} /> Isi Otomatis</button>
                <button type="button" onClick={() => buat('manual')} className="btn-retro bg-cyan-700" title="Ketik uraian sendiri di tabel"><Plus size={14} /> Isi Manual</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ======================================================================== editor
  const r = aktif;
  const baris = barisRekap(r);
  const total = totalRab(r);
  // RAB lama tanpa pilihan: yang sudah punya isi tanpa keranjang dianggap manual.
  const mode = r.mode ?? (kartuRab(r).length && !isiKeranjang(r).length ? 'manual' : 'otomatis');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 sticky top-0 z-10 bg-zinc-950/95 py-2 border-b-2 border-white/20">
        <button type="button" onClick={() => setAktifId(null)} className="btn-retro btn-retro-sm bg-zinc-800"><ArrowLeft size={12} /> Daftar</button>
        <div className="mr-auto min-w-0">
          <div className="font-bold text-white text-[13px] truncate flex items-center gap-1.5">
            {r.terkunci && <Lock size={13} className="text-amber-400 shrink-0" />}
            <span>{r.judul}</span>
            {r.terkunci && (
              <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                Terkunci
              </span>
            )}
          </div>
          <div className="text-[11px] text-cyan-300 font-mono">{r.nomorRab}</div>
          <TandaSinkron status={sinkron} />
        </div>
        <select value={r.status} onChange={(e) => ubah({ ...r, status: e.target.value as StatusRab })} className={`px-2 py-1 text-[11px] font-bold uppercase border ${WARNA_STATUS[r.status]}`} aria-label="Status">
          {DAFTAR_STATUS_RAB.map((s) => <option key={s} value={s} className="bg-zinc-900 text-white">{s}</option>)}
        </select>
        <span className="font-mono text-emerald-300 font-bold">{formatRupiah(total)}</span>
        <button type="button" onClick={() => ekspor(r)} disabled={mengekspor === r.id} className="btn-retro btn-retro-sm bg-teal-700 !py-1.5 text-[12px]" title="Export Excel lengkap (rekap + kategori)">
          {mengekspor === r.id ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />} Export Excel
        </button>

        {r.terkunci ? (
          <button
            type="button"
            onClick={() => setBukaModalKunci(true)}
            className="btn-retro !bg-amber-600 hover:!bg-amber-500 !text-white !py-1.5 text-[12px] flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
            title="Dokumen terkunci. Klik untuk membuka kunci dengan password."
          >
            <Lock size={13} className="text-amber-200" /> Buka Kunci
          </button>
        ) : (
          <button
            type="button"
            onClick={() => simpanRab(r)}
            disabled={menyimpan}
            className="btn-retro bg-emerald-700 !py-1.5 text-[12px] disabled:opacity-50"
            title="Simpan, kunci dengan password, masukkan uraian baru ke katalog, lalu pratinjau Export Excel/PDF"
          >
            {menyimpan ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan RAB
          </button>
        )}
      </div>

      {r.terkunci && (
        <div className="bg-amber-500/10 border-2 border-amber-500 text-amber-200 px-3.5 py-2.5 rounded flex items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-amber-400 shrink-0" />
            <span>Dokumen RAB RNR ini telah disimpan dan terkunci. Buka kunci untuk melakukan penyuntingan.</span>
          </div>
          <button
            type="button"
            onClick={() => setBukaModalKunci(true)}
            className="btn-retro btn-retro-sm !bg-amber-600 hover:!bg-amber-500 !text-white flex items-center gap-1 shrink-0"
          >
            <Unlock size={12} /> Buka Kunci
          </button>
        </div>
      )}

      <fieldset disabled={Boolean(r.terkunci)} className="contents space-y-3">

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[12px]">
        <label><span className="label-retro">Bulan</span><select value={r.bulan} onChange={(e) => ubah({ ...r, bulan: e.target.value })} className={kelas}>{DAFTAR_BULAN.map((b) => <option key={b}>{b}</option>)}</select></label>
        <label><span className="label-retro">Tahun</span><input type="number" value={r.tahun} onChange={(e) => ubah({ ...r, tahun: Number(e.target.value) || r.tahun })} className={`${kelas} font-mono`} /></label>
        <label><span className="label-retro">No. RAB</span><input value={r.nomorRab} onChange={(e) => ubah({ ...r, nomorRab: e.target.value })} className={`${kelas} font-mono`} /></label>
        <label><span className="label-retro">Tanggal</span><input type="date" value={r.tanggal} onChange={(e) => ubah({ ...r, tanggal: e.target.value })} className={kelas} /></label>
        <label><span className="label-retro">Lokasi</span><input value={r.lokasi} onChange={(e) => ubah({ ...r, lokasi: e.target.value })} className={kelas} /></label>
        <label><span className="label-retro">Kepada</span><input value={r.kepada} onChange={(e) => ubah({ ...r, kepada: e.target.value })} className={kelas} /></label>
        <label><span className="label-retro">Up.</span><input value={r.up} onChange={(e) => ubah({ ...r, up: e.target.value })} className={kelas} /></label>
      </div>

      {/* Cara mengisi: dipilih saat membuat RAB; bisa diganti, datanya tetap sama. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-zinc-400 font-bold uppercase">Cara mengisi</span>
        <div className="flex border-2 border-white/40">
          {([['otomatis', 'Isi Otomatis'], ['manual', 'Isi Manual']] as const).map(([m, label]) => (
            <button key={m} type="button" onClick={() => ubah({ ...r, mode: m })}
              className={`px-3 py-1.5 text-[11px] font-bold uppercase ${mode === m ? (m === 'otomatis' ? 'bg-amber-600 text-white' : 'bg-cyan-700 text-white') : 'bg-black/40 text-zinc-300 hover:text-white'}`}>{label}</button>
          ))}
        </div>
        <span className="text-[11px] text-zinc-500">{mode === 'otomatis' ? 'Pilih uraian dari katalog → keranjang → susun per minggu.' : 'Ketik uraian sendiri; uraian baru masuk katalog saat Simpan RAB.'}</span>
      </div>

      {mode === 'otomatis' && <PapanRabRnr rab={r} ubah={ubah} bolehKelola={bolehKelola} notify={notify} />}

      {mode === 'manual' && <>
      <div className="border-2 border-white/30 bg-black/50 overflow-x-auto">
        <table className="w-full min-w-[1120px] text-[12px] border-collapse">
          <thead className="bg-[#2f5d33] text-white text-[10px] uppercase">
            <tr>
              <th className="p-1.5 w-8">No</th>
              <th className="p-1.5 text-left">Uraian</th>
              <th className="p-1.5 text-left w-40">Kategori</th>
              <th className="p-1.5 text-left w-56">Kode WBS</th>
              <th className="p-1.5 w-20">Satuan</th>
              <th className="p-1.5 w-28">Harga satuan</th>
              {ROMAWI.map((x) => <th key={x} className="p-1.5 w-16">Qty M{x}</th>)}
              <th className="p-1.5 w-32 text-right">Total</th>
              <th className="p-1.5 w-8" />
            </tr>
          </thead>
          <tbody>
            {!baris.length && (
              <tr><td colSpan={12} className="p-6 text-center text-zinc-400">Belum ada uraian. Tekan <b className="text-white">Baris kosong</b>.</td></tr>
            )}
            {baris.map((u, i) => (
              <tr key={u.id} className={`border-t border-white/10 align-top ${i % 2 ? 'bg-white/5' : ''}`}>
                <td className="p-1.5 text-center text-zinc-400">{i + 1}</td>
                <td className="p-1"><input value={u.uraian} onChange={(e) => ubah(ubahBaris(r, u.id, { uraian: e.target.value }))} className={kelas} placeholder="Uraian" /></td>
                <td className="p-1"><PilihKategori nilai={u.kategori} ubah={(v) => ubah(ubahBaris(r, u.id, { kategori: v }))} /></td>
                <td className="p-1">
                  <select value={u.wbs} onChange={(e) => ubah(ubahBaris(r, u.id, { wbs: e.target.value }))} className={`${kelas} !text-[11px]`} title={deskripsiWbs(u.wbs)}>
                    {!DAFTAR_WBS.some((w) => w.kode === u.wbs) && <option value={u.wbs}>{u.wbs}</option>}
                    {DAFTAR_WBS.map((w) => <option key={w.kode} value={w.kode}>{w.kode} · {w.deskripsi}</option>)}
                  </select>
                </td>
                <td className="p-1"><input value={u.satuan} onChange={(e) => ubah(ubahBaris(r, u.id, { satuan: e.target.value }))} className={kelas} /></td>
                <td className="p-1"><input inputMode="numeric" value={u.harga || ''} onChange={(e) => ubah(ubahBaris(r, u.id, { harga: angka(e.target.value) }))} className={`${kelas} font-mono text-right`} /></td>
                {[0, 1, 2, 3].map((m) => (
                  <td key={m} className="p-1">
                    <input inputMode="numeric" value={u.qty[m] || ''} onChange={(e) => ubah(aturQtyBaris(r, u.id, (m + 1) as 1 | 2 | 3 | 4, angka(e.target.value)))} className={`${kelas} font-mono text-center`} placeholder="–" />
                  </td>
                ))}
                <td className="p-1.5 text-right font-mono font-bold text-emerald-300">{formatRupiah(totalUraian(u))}</td>
                <td className="p-1"><button type="button" onClick={() => ubah(hapusBaris(r, u.id))} className="btn-ikon !w-7 !h-7 bg-rose-950 text-rose-300" aria-label="Hapus uraian"><Trash2 size={12} /></button></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-black/70 font-bold text-[12px]">
            <tr className="border-t-2 border-white/30">
              <td colSpan={6} className="p-1.5 text-right text-zinc-300">Total per minggu</td>
              {[0, 1, 2, 3].map((m) => <td key={m} className="p-1.5 text-center font-mono text-[11px] text-white">{totalMinggu(r, m) ? formatRupiah(totalMinggu(r, m)).replace('Rp ', '') : '–'}</td>)}
              <td className="p-1.5 text-right font-mono text-emerald-300">{formatRupiah(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <button type="button" onClick={() => ubah(tambahBarisKosong(r))} className="btn-retro btn-retro-sm bg-zinc-800">
        <Plus size={12} /> Baris kosong
      </button>
      <p className="text-[11px] text-zinc-500">Nilai tiap minggu = qty × harga satuan. Export Excel otomatis membuat lembar rekap dan lembar rincian W1–W4 per kategori (ATK, BBM, dll.) yang tersambung rumus ke rekap.</p>
      {baris.some((u) => u.qty.some((q, m) => q && !nilaiMinggu(u, m))) && <p className="text-[11px] text-amber-300">Ada uraian dengan harga 0 — isi harga satuannya.</p>}
      </>}

      {/* Persetujuan sesuai template RAB: Dibuat, Verifikasi, Pimpinan Site, Div Head, dan Operation & HCA Director (> 25 jt) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-[12px]">
        <div className="border-2 border-purple-500/60 bg-purple-950/20 p-2 space-y-1.5">
          <span className="label-retro !text-purple-300">Dibuat (Pembuat / Pemohon)</span>
          <input value={r.pemohonNama || ''} onChange={(e) => ubah({ ...r, pemohonNama: e.target.value })} className={kelas} placeholder="Nama Pembuat" aria-label="Nama Pembuat" />
          <input value={r.pemohonJabatan ?? 'Staff RNR'} onChange={(e) => ubah({ ...r, pemohonJabatan: e.target.value })} className={kelas} placeholder="Jabatan Pembuat" aria-label="Jabatan Pembuat" />
        </div>
        <div className="border-2 border-blue-500/60 bg-blue-950/20 p-2 space-y-1.5">
          <span className="label-retro !text-blue-300">Diverifikasi (Finance Site)</span>
          <input value={r.verifikasiNama ?? PENYETUJU_VERIFIKASI.nama} onChange={(e) => ubah({ ...r, verifikasiNama: e.target.value })} className={kelas} aria-label="Nama verifikasi" />
          <input value={r.jabatanVerifikasi ?? PENYETUJU_VERIFIKASI.jabatan} onChange={(e) => ubah({ ...r, jabatanVerifikasi: e.target.value })} className={kelas} aria-label="Jabatan verifikasi" />
        </div>
        <div className="border-2 border-cyan-500/60 bg-cyan-950/20 p-2 space-y-1.5">
          <span className="label-retro !text-cyan-300">Disetujui Oleh (Pimpinan Site)</span>
          <input value={r.pimpinanNama ?? PENYETUJU_PIMPINAN.nama} onChange={(e) => ubah({ ...r, pimpinanNama: e.target.value })} className={kelas} aria-label="Nama pimpinan site" />
          <input value={r.jabatanPimpinan ?? PENYETUJU_PIMPINAN.jabatan} onChange={(e) => ubah({ ...r, jabatanPimpinan: e.target.value })} className={kelas} aria-label="Jabatan pimpinan site" />
        </div>
        <div className="border-2 border-emerald-500/60 bg-emerald-950/20 p-2 space-y-1.5">
          <span className="label-retro !text-emerald-300">Disetujui Oleh (Div Head)</span>
          <input value={r.penyetujuDivHead ?? PENYETUJU_DIV_HEAD.nama} onChange={(e) => ubah({ ...r, penyetujuDivHead: e.target.value })} className={kelas} aria-label="Nama penyetuju Div Head" />
          <input value={r.jabatanDivHead ?? PENYETUJU_DIV_HEAD.jabatan} onChange={(e) => ubah({ ...r, jabatanDivHead: e.target.value })} className={kelas} aria-label="Jabatan penyetuju Div Head" />
        </div>
        <div className={`border-2 p-2 space-y-1.5 ${perluDirektur(r) ? 'border-amber-400 bg-amber-950/30' : 'border-white/15 bg-black/30 opacity-60'}`}>
          <span className={`label-retro ${perluDirektur(r) ? '!text-amber-300' : ''}`}>Disetujui Oleh (&gt; 25 Juta)</span>
          <input value={r.penyetuju || PENYETUJU_DIREKTUR.nama} onChange={(e) => ubah({ ...r, penyetuju: e.target.value })} className={kelas} aria-label="Nama Operation & HCA Director" />
          <input value={r.jabatanPenyetuju || PENYETUJU_DIREKTUR.jabatan} onChange={(e) => ubah({ ...r, jabatanPenyetuju: e.target.value })} className={kelas} aria-label="Jabatan Operation & HCA Director" />
        </div>
      </div>
      <p className={`text-[12px] font-bold ${perluDirektur(r) ? 'text-amber-300' : 'text-emerald-300'}`}>
        {perluDirektur(r)
          ? `Total ${formatRupiah(total)} lebih dari 25 juta → ada kolom TTD Pak Rahmad (${r.penyetuju || PENYETUJU_DIREKTUR.nama}) di samping para penyetuju site & div head.`
          : `Total ${formatRupiah(total)} ≤ 25 juta → TTD cukup sampai Div Head (${r.penyetujuDivHead ?? PENYETUJU_DIV_HEAD.nama}), kolom TTD Pak Rahmad ditiadakan.`}
      </p>
      </fieldset>

      {pratinjau && <PratinjauRabRnr rab={r} notify={notify} onTutup={() => setPratinjau(false)} />}

      {bukaModalKunci && (
        <ModalBukaKunci
          namaDokumen={`RAB ${r.judul}`}
          onSukses={() => {
            setBukaModalKunci(false);
            ubah({ ...r, terkunci: false });
          }}
          onBatal={() => setBukaModalKunci(false)}
          notify={notify}
        />
      )}
    </div>
  );
};
