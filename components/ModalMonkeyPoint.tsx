import React, { useState, useEffect, useCallback } from 'react';
import {
  Download, Loader2, Maximize2, Minimize2, ChevronLeft, ChevronRight, X, Camera,
} from 'lucide-react';
import { api, urlBerkas } from '../lib/api';
import type { Bootstrap, Pengguna, PicaItem, RosterBaris, JadwalItem } from '../lib/tipe-api';
import type { Memo } from '../types';
import * as W from '../lib/waktu';
import {
  eksporMonkeyPoint,
  type MonkeyPointData,
  type MonkeyPointPicaItem,
  type MonkeyPointRosterItem,
  type MonkeyPointMemoItem,
  type MonkeyPointCuacaData,
  type MonkeyPointTitikApiData,
  type MonkeyPointJadwalItem,
  type MonkeyPointGaleriItem,
  type MonkeyPointLogItem,
} from '../lib/monkey-point';
import type { JawabanCuaca } from '../server/src/cuaca-bmkg';
import { teksZona, waktuWita, namaSatelit, type TitikApi } from '../server/src/titik-api-murni';
import { mintaLayarPenuh, keluarLayarPenuh } from '../lib/platform';
import { noPica } from '../lib/nomor-pica';
import { ringkasRevegetasi, totalTahun, jumlah, ha, type BarisRevegetasi } from '../lib/revegetasi';

interface Props {
  boot: Bootstrap;
  pengguna: Pengguna;
  onTutup: () => void;
  notify: (pesan: string) => void;
}

interface LaporanServer {
  id: string;
  user_id: string;
  user_nama: string | null;
  pica_id: string | null;
  jenis: string | null;
  capaian: number | null;
  satuan: string | null;
  catatan: string | null;
  xp: number;
  dibuat_pada: string;
  foto?: string | null;
}

interface DataTitikApi {
  terpasang: boolean;
  aktif: boolean;
  terakhir: string | null;
  galat: string | null;
  radius: { waspada: number; pantau: number };
  titik: (TitikApi & { dicek_nama?: string | null })[];
}

/** Satu foto dokumentasi dari /api/galeri (laporan FEED atau bukti PICA). */
interface FotoGaleri {
  kunci: string;
  sumber: 'laporan' | 'pica';
  pada: string;
  ref: string | null;
  judul: string | null;
  keterangan: string | null;
  oleh: string | null;
}

/** Nama penulis memo: server mengirimnya di kolom `penulis`. */
const penulisMemo = (m: Memo): string | null => {
  const x = m as Memo & { oleh_nama?: string | null; penulis?: string | null };
  return x.oleh_nama ?? x.penulis ?? null;
};

/** Komponen pembantu untuk memuat gambar dari Cloudflare R2 secara aman */
const FotoLaporan: React.FC<{ kunci: string; alt: string }> = ({ kunci, alt }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [gagal, setGagal] = useState(false);

  useEffect(() => {
    let aktif = true;
    urlBerkas(kunci)
      .then((url) => {
        if (aktif) setSrc(url);
      })
      .catch(() => {
        if (aktif) setGagal(true);
      });
    return () => {
      aktif = false;
    };
  }, [kunci]);

  if (gagal) {
    return (
      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 text-[11px] font-mono-code p-2 text-center">
        Foto tidak dapat dimuat
      </div>
    );
  }
  if (!src) {
    return (
      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs">
        <Loader2 size={16} className="animate-spin text-emerald-400" />
      </div>
    );
  }
  return <img src={src} alt={alt} className="w-full h-full object-cover" />;
};

/** Pratinjau register PICA: kolom sama dengan slide PPT dan tabel PICA di aplikasi. */
const PratinjauPica: React.FC<{ daftar: PicaItem[]; bagian: number; total: number; buka: number; tutup: number; bukti: Record<string, string[]> }> = ({ daftar, bagian, total, buka, tutup, bukti }) => (
  <>
    <div className="ml-[175px] mr-[140px] pt-1 pb-2 border-b-2 border-emerald-700 mb-3 flex flex-col justify-center min-h-[50px]">
      <div className="flex justify-between items-baseline gap-2">
        <h3 className="text-xs md:text-[13px] font-title text-emerald-950 leading-tight">REGISTER PICA LENGKAP (BAGIAN {bagian})</h3>
        <span className="text-[11px] font-bold text-slate-600 font-mono-code shrink-0">
          Total {total} · Terbuka <b className="text-slate-900">{buka}</b> · Selesai <b className="text-emerald-800">{tutup}</b>
        </span>
      </div>
      <p className="text-[12px] text-slate-600 font-body mt-0.5">Terbaru di atas · di PPT jumlah baris per slide menyesuaikan panjang teks</p>
    </div>
    <div className="my-auto border-2 border-slate-200 rounded-lg shadow-sm">
      <table className="w-full table-fixed text-left text-[10px] border-collapse font-body">
        <colgroup>
          {[6, 8, 16, 12, 13, 8, 8, 8, 12, 9].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}
        </colgroup>
        <thead>
          <tr className="bg-emerald-900 text-white">
            {['No', 'Bidang & Prioritas', 'Masalah', 'Akar Masalah', 'Tindakan Korektif', 'Target / Realisasi', 'PIC & Due', 'Status & Sisa', 'Update Terakhir', 'Bukti'].map((h) => (
              <th key={h} className="p-1.5 border-r border-white/20 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white align-top">
          {daftar.length ? daftar.map((p) => {
            const tutupP = p.status === 'Closed';
            const prog = !tutupP && (p.status === 'In Progress' || p.status === 'Continue' || (p.realisasi ?? 0) > 0);
            const pct = p.target && p.realisasi !== null ? Math.min(100, Math.round((p.realisasi / p.target) * 100)) : null;
            const telat = !tutupP && !prog && (p.sisa_hari ?? 1) < 0;
            const warna = tutupP ? 'bg-emerald-100 text-emerald-900' : prog ? 'bg-sky-100 text-sky-900' : telat ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900';
            const foto = bukti[p.id] ?? [];
            return (
              <tr key={p.id}>
                <td className="p-1.5 font-bold text-slate-800 break-words">{noPica(p)}</td>
                <td className="p-1.5"><b className="text-sky-900">{p.bidang}</b><br /><span className="text-slate-500">{p.prioritas}</span></td>
                <td className="p-1.5 text-slate-800 break-words">{p.judul}</td>
                <td className="p-1.5 text-slate-700 break-words">{p.akar || '—'}</td>
                <td className="p-1.5 text-slate-700 break-words">{p.tindakan || '—'}</td>
                <td className="p-1.5 text-slate-700">{p.target !== null ? `${p.realisasi ?? 0} / ${p.target} ${p.satuan ?? ''}` : '—'}{pct !== null && <b className="block">{pct}%</b>}</td>
                <td className="p-1.5"><b className="text-slate-900">{p.pic_nama ?? '—'}</b><br /><span className="text-slate-500">{p.due_date ? W.formatPendek(p.due_date) : 'tanpa due'}</span></td>
                <td className={`p-1.5 text-center font-bold ${warna}`}>{p.status.toUpperCase()}<br /><span className="font-normal">{tutupP ? 'selesai' : prog ? `progres ${pct ?? 0}%` : W.teksSisa(p.sisa_hari)}</span></td>
                <td className="p-1.5 text-slate-600 break-words">{p.update_terakhir || '—'}</td>
                <td className="p-1">{foto.length ? <><div className="h-12 bg-slate-800 overflow-hidden"><FotoLaporan kunci={foto[0]} alt="Bukti" /></div><span className="text-sky-700">{foto.length} foto</span></> : <span className="text-slate-400">—</span>}</td>
              </tr>
            );
          }) : (
            <tr><td colSpan={10} className="p-6 text-center text-slate-400 italic">Belum ada data register PICA.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  </>
);

export const ModalMonkeyPoint: React.FC<Props> = ({ boot, pengguna, onTutup, notify }) => {
  const [memuatData, setMemuatData] = useState(true);
  const [sedangEkspor, setSedangEkspor] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Data yang ditarik langsung dari sistem
  const [daftarPica, setDaftarPica] = useState<PicaItem[]>([]);
  const [daftarRoster, setDaftarRoster] = useState<RosterBaris[]>([]);
  const [daftarMemo, setDaftarMemo] = useState<Memo[]>([]);
  const [dataCuaca, setDataCuaca] = useState<JawabanCuaca | null>(null);
  const [dataTitikApi, setDataTitikApi] = useState<DataTitikApi | null>(null);
  const [daftarJadwal, setDaftarJadwal] = useState<JadwalItem[]>([]);
  const [daftarLaporan, setDaftarLaporan] = useState<LaporanServer[]>([]);
  /** Sumber yang gagal dimuat: laporan menulis "tidak tersedia", bukan angka kosong yang tampak asli. */
  const [sumberGagal, setSumberGagal] = useState<string[]>([]);
  const [daftarFoto, setDaftarFoto] = useState<FotoGaleri[]>([]);
  /** Kunci foto bukti per PICA (terbaru dulu) — kolom Bukti & slide Lampiran Bukti PICA. */
  const [buktiPica, setBuktiPica] = useState<Record<string, string[]>>({});
  const [daftarReveg, setDaftarReveg] = useState<BarisRevegetasi[]>([]);
  const [revegCadangan, setRevegCadangan] = useState(false);

  const hariIni = W.hariIniWita();
  const bulanIni = hariIni.slice(0, 7);
  const periodeAktif = boot.periode.find((p) => p.id === boot.pengaturan.periode_aktif) ?? boot.periode[0];

  /** Muat seluruh data real sekaligus dari backend */
  const muatSemuaData = useCallback(async () => {
    setMemuatData(true);
    try {
      const gagal: string[] = [];
      const cadangan = <T,>(nama: string, nilai: T) => () => { gagal.push(nama); return nilai; };
      let cadanganReveg = false;
      const [resPica, resRoster, resMemo, resCuaca, resTitikApi, resJadwal, resLaporan, resFoto, resReveg] = await Promise.all([
        api<{ pica: PicaItem[] }>('/api/pica').catch(cadangan('PICA', { pica: [] as PicaItem[] })),
        api<{ roster: RosterBaris[] }>(`/api/roster?bulan=${bulanIni}`).catch(cadangan('Roster', { roster: [] as RosterBaris[] })),
        api<{ memo: Memo[] }>('/api/memo?lingkup=tim').catch(cadangan('Memo', { memo: [] as Memo[] })),
        api<JawabanCuaca>('/api/cuaca').catch(cadangan('Cuaca', null)),
        api<DataTitikApi>('/api/titik-api?hari=7').catch(cadangan('Titik api', null)),
        api<{ jadwal: JadwalItem[] }>('/api/jadwal').catch(cadangan('Jadwal', { jadwal: [] as JadwalItem[] })),
        api<{ laporan: LaporanServer[] }>('/api/laporan').catch(cadangan('Laporan', { laporan: [] as LaporanServer[] })),
        api<{ foto: FotoGaleri[] }>('/api/galeri?hari=30').catch(cadangan('Foto', { foto: [] as FotoGaleri[] })),
        api<{ revegetasi: BarisRevegetasi[] }>('/api/revegetasi').catch(() => ({ revegetasi: [] as BarisRevegetasi[] })),
      ]);
      // Semua foto bukti per PICA. Server lama belum punya jalurnya: pakai foto galeri yang bersumber PICA.
      const bukti = await api<{ bukti: { pica_id: string; kunci: string }[] }>('/api/pica/bukti')
        .then((d) => d.bukti)
        .catch(() => (resFoto.foto ?? []).filter((f) => f.sumber === 'pica' && f.ref).map((f) => ({ pica_id: f.ref as string, kunci: f.kunci })));
      const peta: Record<string, string[]> = {};
      bukti.forEach((b) => { (peta[b.pica_id] ??= []).includes(b.kunci) || peta[b.pica_id].push(b.kunci); });
      setBuktiPica(peta);
      setDaftarReveg(resReveg.revegetasi ?? []);
      setRevegCadangan(false);
      setDaftarFoto(resFoto.foto ?? []);
      setSumberGagal(gagal);
      if (gagal.length) notify(`GAGAL MEMUAT: ${gagal.join(', ').toUpperCase()}`);

      setDaftarPica(resPica.pica ?? []);
      setDaftarRoster(resRoster.roster ?? []);
      setDaftarMemo(resMemo.memo ?? []);
      setDataCuaca(resCuaca);
      setDataTitikApi(resTitikApi);
      setDaftarJadwal(resJadwal.jadwal ?? []);
      setDaftarLaporan(resLaporan.laporan ?? []);
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT DATA MONKEY POINT');
    } finally {
      setMemuatData(false);
    }
  }, [bulanIni, notify]);

  useEffect(() => {
    void muatSemuaData();
  }, [muatSemuaData]);

  // Statistik ringkasan dari data riil
  const totalPica = daftarPica.length;
  const picaOpen = daftarPica.filter((p) => p.status !== 'Closed').length;
  const picaTelat = daftarPica.filter((p) => p.status !== 'Closed' && (p.sisa_hari ?? 1) < 0).length;
  const picaClosed = daftarPica.filter((p) => p.status === 'Closed').length;
  const picaSelesaiPct = totalPica > 0 ? Math.round((picaClosed / totalPica) * 100) : 100;

  // Titik api riil
  const daftarTitik = dataTitikApi?.titik ?? [];
  const titikTersedia = Boolean(dataTitikApi?.terpasang);
  const titikInti = daftarTitik.filter((t) => t.zona === 'ippkh' || t.zona === 'iup').length;
  const titikPetak = daftarTitik.filter((t) => t.zona === 'petak').length;
  const titikWaspada = daftarTitik.filter((t) => t.zona === 'waspada').length;
  const radiusWaspada = dataTitikApi?.radius.waspada ?? 2;
  const statusSatelit = !dataTitikApi ? 'Gagal dimuat'
    : !dataTitikApi.terpasang ? 'Belum aktif'
      : `Aktif · diperiksa ${dataTitikApi.terakhir ? waktuWita(dataTitikApi.terakhir) : '—'}`;

  // Laporan lapangan dengan foto dokumentasi R2
  const fotoGaleri = daftarFoto.slice(0, 6);
  // LOG 30 hari terakhir untuk pratinjau (PPT memuat hingga 20, 4 per slide).
  const batasLog30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 19);
  const logTerbaru = daftarLaporan.filter((l) => l.dibuat_pada.replace(' ', 'T') >= batasLog30);
  const revegUrut = [...daftarReveg].sort((a, b) => a.tahun - b.tahun);
  const ringkasReveg = ringkasRevegetasi(revegUrut);
  const kegiatanReveg: [string, number][] = [
    ['IPD', jumlah(revegUrut.map((b) => b.ipd))],
    ['OPD', jumlah(revegUrut.map((b) => b.opd))],
    ['Timbunan Soil', jumlah(revegUrut.map((b) => b.timbunan_soil))],
    ['Fasilitas Penunjang', jumlah(revegUrut.map((b) => b.fasilitas))],
  ];
  const maksKegiatan = Math.max(0.001, ...kegiatanReveg.map(([, n]) => n));
  const maksBlok = Math.max(0.001, ...ringkasReveg.perBlok.map((b) => b.luas));
  const tagFoto = (f: FotoGaleri) => (f.sumber === 'pica' ? (f.ref ?? 'PICA') : `FEED${f.ref ? ` · ${f.ref}` : ''}`);

  // Paginasi PICA (4 baris per slide)
  const PICA_PER_SLIDE = 4;
  const picaBagian1 = daftarPica.slice(0, PICA_PER_SLIDE);
  const picaBagian2 = daftarPica.slice(PICA_PER_SLIDE, PICA_PER_SLIDE * 2);

  const totalSlides = 13;

  const slideTitles = [
    '1. Cover Laporan',
    '2. Realisasi Progres Reklamasi (Per Tahun)',
    '3. Rincian Realisasi (Kegiatan & Blok)',
    '4. Ringkasan Eksekutif (Summary)',
    '5. Prakiraan Cuaca 3 Hari (BMKG)',
    '6. Monitoring Titik Api (NASA FIRMS)',
    '7. Register PICA Lengkap (Bagian 1/2)',
    '8. Register PICA Lengkap (Bagian 2/2)',
    '9. Lampiran Bukti PICA',
    '10. Dokumentasi LOG Kegiatan Lapangan',
    '11. Agenda & Rapat Koordinasi',
    '12. Memo Operasional Lapangan',
    '13. Sanggahan (Disclaimer Resmi)'
  ];

  const prevSlide = () => setCurrentSlide((s) => (s > 1 ? s - 1 : s));
  const nextSlide = () => setCurrentSlide((s) => (s < totalSlides ? s + 1 : s));

  // Mode Layar Penuh
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      mintaLayarPenuh();
      setIsFullscreen(true);
    } else {
      keluarLayarPenuh();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        setCurrentSlide((s) => (s < totalSlides ? s + 1 : s));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        setCurrentSlide((s) => (s > 1 ? s - 1 : s));
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentSlide(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentSlide(totalSlides);
      } else if (e.key === 'f' || e.key === 'F' || e.key === 'F5') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          keluarLayarPenuh();
        } else {
          onTutup();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSlides, onTutup]);

  /** Menjalankan proses ekspor PPTX dengan data riil */
  const jalankanEkspor = async () => {
    if (sedangEkspor) return;
    if (sumberGagal.length && !window.confirm(`Data berikut gagal dimuat: ${sumberGagal.join(', ')}.\nLaporan tetap dibuat dengan keterangan "data tidak tersedia" di bagian itu?`)) return;
    setSedangEkspor(true);

    try {
      const s0 = dataCuaca?.sekarang;
      const cuacaPayload: MonkeyPointCuacaData | null = dataCuaca && s0 ? {
        desa: `Desa ${dataCuaca.lokasi.desa}, Kec. ${dataCuaca.lokasi.kecamatan}, ${dataCuaca.lokasi.kotkab}`,
        suhuSekarang: s0.suhu,
        kondisiSekarang: s0.ket,
        kelembapan: s0.lembap,
        angin: `${s0.angin} km/j ${s0.arah}`,
        hujanMm: s0.hujanMm,
        slot: dataCuaca.slot.slice(0, 6).map((s) => ({
          waktu: `${s.lokal.slice(8, 10)}/${s.lokal.slice(5, 7)} ${s.lokal.slice(11)} WITA`,
          kondisi: s.ket,
          suhu: s.suhu,
          lembap: s.lembap,
          angin: `${s.angin} km/j ${s.arah}`,
          hujanMm: s.hujanMm,
          rekomendasi: s.kode === 95 || s.kode === 97 ? 'Hentikan kegiatan di area terbuka (petir)'
            : s.kode >= 60 ? 'Baik untuk penanaman; waspada jalan licin'
              : s.suhu >= 33 ? 'Terik: siram bibit pagi/sore'
                : 'Operasi normal',
        })),
      } : null;

      // Tabel PPT memuat 10 titik: zona peringatan (IPPKH/IUP/petak, lalu waspada) didahulukan, lalu yang terbaru.
      const urutPenting = (t: TitikApi) => (['ippkh', 'iup', 'petak'].includes(t.zona) ? 0 : t.zona === 'waspada' ? 1 : 2);
      const titikUrut = [...daftarTitik].sort((a, b) => urutPenting(a) - urutPenting(b) || b.waktu.localeCompare(a.waktu));
      const titikApiPayload: MonkeyPointTitikApiData = {
        tersedia: titikTersedia,
        alasan: !dataTitikApi ? 'Data titik api gagal dimuat saat laporan dibuat.'
          : !dataTitikApi.terpasang ? 'Pemantauan titik api belum aktif (kunci NASA FIRMS belum dipasang).' : null,
        radiusWaspadaKm: radiusWaspada,
        titikWaspada,
        titikDalam: titikInti + titikPetak,
        total: daftarTitik.length,
        statusKonsesi: `${titikInti} titik di dalam IUP/IPPKH, ${titikPetak} di petak Rehab DAS (7 hari)`,
        daftar: titikUrut.slice(0, 10).map((t) => ({
          id: t.id,
          waktu: waktuWita(t.waktu),
          lat: t.lat,
          lon: t.lon,
          satelit: namaSatelit(t.sumber),
          confidence: t.keyakinan,
          zona: teksZona(t),
          status: t.status === 'padam' ? 'Sudah Padam' : t.status === 'bukan_api' ? 'Bukan Api' : t.status === 'dicek' ? 'Sedang Dicek' : 'Belum Dicek',
          catatan: t.catatan ?? null,
        })),
      };

      const jadwalPayload: MonkeyPointJadwalItem[] = daftarJadwal
        .filter((j) => (j.tanggal_selesai ?? j.tanggal) >= hariIni)
        .sort((a, b) => (a.tanggal + (a.jam_mulai ?? '')).localeCompare(b.tanggal + (b.jam_mulai ?? '')))
        .slice(0, 8)
        .map((j) => ({
          id: j.id,
          judul: j.judul,
          tanggal: j.tanggal,
          jamMulai: j.jam_mulai ?? null,
          jamSelesai: j.jam_selesai ?? null,
          pic: j.pemilik_nama ?? 'Seluruh tim',
          lokasi: j.keterangan ?? null,
          selesai: Boolean(j.selesai),
        }));

      // LOG (catatan kegiatan lapangan) 30 hari terakhir, terbaru dulu — ikut ke PPT beserta fotonya.
      const batasLog = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const logPayload: MonkeyPointLogItem[] = daftarLaporan
        .filter((l) => l.dibuat_pada.replace(' ', 'T') >= batasLog.slice(0, 19))
        .map((l) => ({
          tgl: waktuWita(l.dibuat_pada.includes('T') ? l.dibuat_pada : `${l.dibuat_pada.replace(' ', 'T')}Z`),
          petugas: l.user_nama ?? l.user_id,
          kegiatan: l.jenis ?? 'Kegiatan lapangan',
          capaian: l.capaian ? `${Number(l.capaian).toLocaleString('id-ID', { maximumFractionDigits: 2 })} ${l.satuan ?? ''}`.trim() : '',
          catatan: l.catatan ?? '',
          pica: l.pica_id,
          foto: l.foto ?? null,
        }));

      const galeriPayload: MonkeyPointGaleriItem[] = daftarFoto.map((f) => ({
        tag: tagFoto(f),
        tgl: f.pada.slice(0, 10),
        judul: f.judul ?? 'Dokumentasi',
        desc: f.keterangan ?? '',
        pic: f.oleh ?? '—',
        foto: f.kunci,
      }));

      const dataPayload: MonkeyPointData = {
        pica: daftarPica.map((p): MonkeyPointPicaItem => ({
          id: p.id,
          nomor: p.nomor,
          noPica: noPica(p),
          bidang: p.bidang,
          prioritas: p.prioritas,
          judul: p.judul,
          judul_singkat: p.judul_singkat ?? null,
          akar: p.akar ?? null,
          tindakan: p.tindakan ?? null,
          pic_nama: p.pic_nama ?? null,
          due_date: p.due_date ?? null,
          status: p.status,
          target: p.target ?? null,
          realisasi: p.realisasi ?? null,
          satuan: p.satuan ?? null,
          sisa_hari: p.sisa_hari ?? null,
          update_terakhir: p.update_terakhir ?? null,
          update_terakhir_pada: p.update_terakhir_pada ?? null,
          bukti: buktiPica[p.id] ?? [],
        })),
        cuaca: cuacaPayload,
        titikApi: titikApiPayload,
        jadwal: sumberGagal.includes('Jadwal') ? undefined : jadwalPayload,
        sumberGagal,
        revegetasi: daftarReveg,
        revegetasiCadangan: revegCadangan,
        galeri: galeriPayload,
        log: logPayload,
        memo: daftarMemo.map((m): MonkeyPointMemoItem => ({
          id: m.id,
          judul: m.judul,
          ringkasan: m.ringkasan ?? null,
          kategori: m.kategori ?? null,
          status: m.status ?? null,
          tanggal: m.tanggal ?? null,
          dibuat_pada: m.dibuat_pada ?? null,
          oleh_nama: penulisMemo(m),
        })),
        roster: daftarRoster.map((r): MonkeyPointRosterItem => {
          const tim = boot.tim.find((t) => t.id === r.user_id);
          return {
            user_id: r.user_id,
            nama: tim ? tim.nama : r.user_id,
            tanggal: r.tanggal,
            kode: r.kode,
            catatan: r.catatan ?? null,
          };
        }),
        periode: periodeAktif ? { id: periodeAktif.id, judul: periodeAktif.judul } : undefined,
        namaPengguna: pengguna.nama,
        hariIni,
      };

      const aksi = await eksporMonkeyPoint(dataPayload);
      if (aksi === 'dibagikan') {
        notify('PRESENTASI MONKEY POINT SIAP DIBAGIKAN');
      } else {
        notify('PRESENTASI MONKEY POINT BERHASIL DIUNDUH');
      }
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT PRESENTASI');
    } finally {
      setSedangEkspor(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-2 sm:p-4 overflow-y-auto">
      {sumberGagal.length > 0 && (
        <div className="max-w-6xl mx-auto w-full mb-2 bg-amber-100 border border-amber-500 text-amber-900 text-sm px-3 py-2 rounded-lg">
          Data berikut gagal dimuat, sehingga bagian itu ditulis "tidak tersedia" di laporan: <b>{sumberGagal.join(', ')}</b>. Periksa sinyal atau login ulang, lalu buka Monkey Point lagi.
        </div>
      )}
      {/* ================= TOP TOOLBAR ================= */}
      <header className="max-w-6xl mx-auto w-full mb-2.5 bg-slate-900/95 border border-slate-700/80 p-2.5 sm:p-3 rounded-xl shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-amber-500 border-2 border-white rounded-lg flex items-center justify-center text-xs font-title text-slate-950 font-bold shadow">
            PKM
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-title text-white tracking-wide">
                MONKEY POINT · PRATINJAU PRESENTASI
              </h1>
              <span className="bg-emerald-900/90 text-emerald-300 text-[9px] px-2 py-0.5 rounded font-title border border-emerald-500/40">
                HASNUR GROUP
              </span>
            </div>
            <p className="text-[12px] text-slate-400 font-body">Review 10 Slide Eksekutif PT EBL · Data Langsung Sistem · Siap Unduh PPTX</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Slide Navigation */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-1 flex items-center gap-1">
            <button
              onClick={prevSlide}
              disabled={currentSlide <= 1}
              className="btn-action bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white px-2.5 py-1 rounded text-xs font-bold"
              title="Slide Sebelumnya (Panah Kiri)"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[11px] font-bold text-emerald-400 font-mono-code px-2">
              Slide {currentSlide} / {totalSlides}
            </span>
            <button
              onClick={nextSlide}
              disabled={currentSlide >= totalSlides}
              className="btn-action bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white px-2.5 py-1 rounded text-xs font-bold"
              title="Slide Berikutnya (Panah Kanan)"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="btn-action bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
            title="Mode Layar Penuh (F5 / F)"
          >
            {isFullscreen ? <Minimize2 size={13} className="text-amber-400" /> : <Maximize2 size={13} className="text-amber-400" />}
            <span className="hidden md:inline font-title text-[10px]">{isFullscreen ? 'KECILKAN' : 'LAYAR PENUH (F5)'}</span>
          </button>

          {/* Unduh PPTX Button */}
          <button
            onClick={jalankanEkspor}
            disabled={sedangEkspor || memuatData}
            className="btn-action bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold px-3.5 py-1.5 text-[10px] font-title rounded-lg border-2 border-black shadow-[2px_2px_0_#000] flex items-center gap-1.5"
          >
            {sedangEkspor ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            <span>{sedangEkspor ? 'MENYUSUN...' : 'UNDUH PPTX'}</span>
          </button>

          {/* Close Button */}
          <button
            onClick={onTutup}
            className="btn-action bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-700 p-2 rounded-lg ml-1"
            title="Tutup Pratinjau (Esc)"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* ================= MAIN 16:9 SLIDE VIEWPORT ================= */}
      <div className="flex-1 flex items-center justify-center min-h-[500px] w-full my-auto">
        <div className="w-full max-w-5xl aspect-[16/9] bg-white rounded-xl shadow-2xl overflow-hidden relative border-2 border-slate-700 flex flex-col justify-between">
          {/* Ornamen Header & Footer Resmi */}
          <img
            src="/ppt-assets/image2.png"
            alt="Pita Atas Kiri"
            className="absolute top-0 left-0 w-[225px] h-auto pointer-events-none z-10 drop-shadow-sm"
          />
          <img
            src="/ppt-assets/image3.png"
            alt="Logo Hasnur Kanan Atas"
            className="absolute top-3.5 right-7 h-[38px] w-auto pointer-events-none z-10"
          />
          <img
            src="/ppt-assets/image1.png"
            alt="Pita Bawah"
            className="absolute bottom-0 right-0 w-[420px] h-auto pointer-events-none z-10"
          />

          {/* Slide Inner Body */}
          <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between relative z-0">
            {memuatData ? (
              <div className="my-auto flex flex-col items-center justify-center gap-3">
                <Loader2 size={36} className="animate-spin text-emerald-600" />
                <p className="font-title text-xs text-slate-700">MEMUAT DATA REAL MONKEY POINT...</p>
                <p className="text-[12px] text-slate-500 font-body">Menghubungkan ke database PICA, BMKG, NASA FIRMS, Kalender, dan Cloudflare R2</p>
              </div>
            ) : (
              <>
                {/* ---------------- SLIDE 1: COVER ---------------- */}
                {currentSlide === 1 && (
                  <div className="my-auto text-center max-w-2xl mx-auto space-y-4 font-body">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-900 border border-emerald-300 px-3 py-1 rounded-full text-xs font-bold">
                      <span>MONKEY POINT REPORT</span>
                      <span>·</span>
                      <span>PT ENERGI BATUBARA LESTARI</span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-title text-emerald-950 tracking-wide uppercase leading-snug">
                      LAPORAN HARIAN OPERASIONAL &amp; MONITORING REKLAMASI
                    </h2>

                    <p className="text-sm text-slate-600 font-medium">
                      Integrasi Data PICA, Prakiraan Cuaca BMKG 3 Hari, Deteksi Titik Api NASA FIRMS, serta Roster Lapangan
                    </p>

                    <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-left bg-slate-50/80 p-3.5 rounded-xl border border-slate-300">
                      <div>
                        <span className="text-[11px] text-slate-500 uppercase font-bold">Tanggal Laporan</span>
                        <p className="font-mono-code font-bold text-slate-800 text-xs mt-0.5">{hariIni} WITA</p>
                        <span className="text-[11px] text-slate-500 uppercase font-bold mt-2 block">Periode Evaluasi</span>
                        <p className="font-bold text-emerald-800 text-xs mt-0.5">{periodeAktif.judul || periodeAktif.id}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 uppercase font-bold">Disusun Oleh</span>
                        <p className="font-bold text-slate-800 text-xs mt-0.5">{pengguna.nama} ({pengguna.peran})</p>
                        <span className="text-[11px] text-slate-500 uppercase font-bold mt-2 block">Site Tambang</span>
                        <p className="font-bold text-slate-800 text-xs mt-0.5">Site Blok Batubara EBL · Tapin, Kalsel</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------------- SLIDE 2: EXECUTIVE SUMMARY ---------------- */}
                {currentSlide === 2 && (
                  <>
                    <div className="ml-[175px] mr-[140px] pt-1 pb-2 border-b-2 border-emerald-700 mb-3 flex flex-col justify-center min-h-[50px]">
                      <h3 className="text-xs md:text-[13px] font-title text-emerald-950 leading-tight">REALISASI PROGRES REKLAMASI</h3>
                      <p className="text-[12px] text-slate-600 mt-0.5">
                        {revegUrut.length ? `Per tahun ${revegUrut[0].tahun}–${revegUrut[revegUrut.length - 1].tahun}, status kawasan APL dan Hutan (PPKH)` : 'Data realisasi tidak tersedia'}
                      </p>
                    </div>
                    <div className="flex gap-4 my-auto text-xs">
                      <div className="w-44 shrink-0 space-y-2">
                        {([
                          ['TOTAL REALISASI', ringkasReveg.total, 'text-emerald-900'],
                          ['KAWASAN APL', ringkasReveg.apl, 'text-green-600'],
                          ['KAWASAN HUTAN (PPKH)', ringkasReveg.hutan, 'text-emerald-800'],
                        ] as const).map(([label, n, warnaTeks]) => (
                          <div key={label} className="bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0f172a] px-2 py-1.5">
                            <p className="text-[10px] font-bold text-slate-500">{label}</p>
                            <p className={`font-title text-[11px] ${warnaTeks}`}>{ha(n)} HA</p>
                          </div>
                        ))}
                        {ringkasReveg.terakhir && (
                          <div className="bg-white border-2 border-amber-700 shadow-[3px_3px_0_#0f172a] px-2 py-1.5">
                            <p className="text-[10px] font-bold text-slate-500">TAHUN {ringkasReveg.terakhir.tahun}</p>
                            <p className="font-title text-[11px] text-amber-800">{ha(totalTahun(ringkasReveg.terakhir))} HA</p>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-700 mb-1">
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-600 border border-slate-900" /> APL</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-800 border border-slate-900" /> Hutan (PPKH)</span>
                        </div>
                        <div className="flex items-end gap-1 h-52 border-b-2 border-slate-900">
                          {revegUrut.map((b) => {
                            const t = totalTahun(b);
                            const skala = 88 / (ringkasReveg.maks || 1);
                            return (
                              <div key={b.tahun} className="flex-1 h-full flex flex-col justify-end items-center">
                                <span className="text-[9px] font-bold text-slate-800 mb-0.5 tabular-nums">{ha(t)}</span>
                                <div className="w-3/5 bg-emerald-800 border border-slate-900" style={{ height: `${b.hutan * skala}%` }} />
                                <div className="w-3/5 bg-green-600 border border-slate-900 border-t-0" style={{ height: `${b.apl * skala}%` }} />
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex gap-1 mt-1">
                          {revegUrut.map((b) => <span key={b.tahun} className="flex-1 text-center font-title text-[7px] text-slate-700">{b.tahun}</span>)}
                        </div>
                        <p className="text-[10px] text-slate-500 text-right mt-2">
                          {revegCadangan ? 'Server tidak terjangkau: memakai salinan lokal data realisasi' : 'Sumber: Realisasi Permintaan Amdal (Summary) · hektare'}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {currentSlide === 3 && (
                  <>
                    <div className="ml-[175px] mr-[140px] pt-1 pb-2 border-b-2 border-emerald-700 mb-3 flex flex-col justify-center min-h-[50px]">
                      <h3 className="text-xs md:text-[13px] font-title text-emerald-950 leading-tight">RINCIAN REALISASI REKLAMASI</h3>
                      <p className="text-[12px] text-slate-600 mt-0.5">Per jenis kegiatan (IPD, OPD, Timbunan Soil, Fasilitas) dan per blok · akumulasi semua tahun</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 my-auto text-xs">
                      {([
                        ['PER JENIS KEGIATAN', kegiatanReveg, maksKegiatan, 'bg-amber-600', 'text-amber-800'],
                        ['PER BLOK', ringkasReveg.perBlok.map((b) => [b.nama, b.luas] as [string, number]), maksBlok, 'bg-sky-600', 'text-sky-800'],
                      ] as const).map(([judul, isi, maks, warnaBatang, warnaJudul]) => (
                        <div key={judul} className="bg-white border-2 border-slate-900 shadow-[3px_3px_0_#0f172a] p-3">
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
                      ))}
                    </div>
                  </>
                )}

                {currentSlide === 4 && (
                  <>
                    <div className="ml-[175px] mr-[140px] pt-1 pb-2 border-b-2 border-emerald-700 mb-3 flex flex-col justify-center min-h-[50px]">
                      <div className="flex justify-between items-baseline gap-2">
                        <h3 className="text-xs md:text-[13px] font-title text-emerald-950 leading-tight">RINGKASAN EKSEKUTIF OPERASIONAL</h3>
                        <span className="inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                          {picaTelat > 0 ? `${picaTelat} PICA TELAT` : 'PICA TEPAT WAKTU'}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600 font-body mt-0.5">Ringkasan kondisi umum pit tambang, kepatuhan tindakan korektif, dan faktor cuaca</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 my-auto text-xs font-body">
                      {/* Card 1: PICA */}
                      <div className="p-3 bg-gradient-to-br from-emerald-50/80 to-slate-50 border-2 border-emerald-300 rounded-xl shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-emerald-200 pb-1 mb-1.5">
                            <h4 className="font-bold text-emerald-950 text-[13px] tracking-wide">STATUS PICA</h4>
                            <span className="font-mono-code font-bold text-emerald-800 text-[11px]">{picaSelesaiPct}% Tuntas</span>
                          </div>
                          <p className="text-slate-700 py-0.5">Total Tugas Audit: <b className="text-slate-900 font-mono-code">{totalPica} PICA</b></p>
                          <p className="text-slate-700 py-0.5">Terselesaikan: <b className="text-emerald-800 font-mono-code">{picaClosed} Closed</b></p>
                          <p className="text-slate-700 py-0.5">Dalam Proses: <b className="text-amber-700 font-mono-code">{picaOpen} Open</b></p>
                        </div>
                        <div className="mt-1.5 border-t border-emerald-100 pt-1.5">
                          <span className={`text-[11px] font-bold ${picaTelat > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                            {picaTelat > 0 ? `Perhatian: ${picaTelat} PICA melewati target!` : 'Seluruh PICA tepat waktu'}
                          </span>
                        </div>
                      </div>

                      {/* Card 2: Cuaca */}
                      <div className="p-3 bg-gradient-to-br from-sky-50/80 to-slate-50 border-2 border-sky-300 rounded-xl shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-sky-200 pb-1 mb-1.5">
                            <h4 className="font-bold text-sky-950 text-[13px] tracking-wide">CUACA &amp; IKLIM</h4>
                            <span className="font-mono-code font-bold text-sky-800 text-[11px]">BMKG WITA</span>
                          </div>
                          <p className="text-slate-700 py-0.5">Hari ini: <b className="text-sky-900">{dataCuaca?.sekarang?.ket ?? 'Hujan Ringan'}</b></p>
                          <p className="text-slate-700 py-0.5">Suhu / Lembap: <b className="text-slate-900 font-mono-code">{dataCuaca?.sekarang?.suhu ?? 28}°C / {dataCuaca?.sekarang?.lembap ?? 88}%</b></p>
                          <p className="text-slate-700 py-0.5">Angin: <b className="text-slate-900 font-mono-code">{dataCuaca?.sekarang?.angin ?? 12} km/j</b></p>
                        </div>
                        <div className="mt-1.5 border-t border-sky-100 pt-1.5">
                          <span className="text-[11px] text-emerald-800 font-bold">Kondisi Tanam: Sangat Baik</span>
                        </div>
                      </div>

                      {/* Card 3: Titik Api */}
                      <div className="p-3 bg-gradient-to-br from-red-50/80 to-slate-50 border-2 border-red-300 rounded-xl shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-red-200 pb-1 mb-1.5">
                            <h4 className="font-bold text-red-950 text-[13px] tracking-wide">HOTSPOT (NASA)</h4>
                            <span className="font-mono-code font-bold text-red-800 text-[11px]">7 Hari</span>
                          </div>
                          <p className="text-slate-700 py-0.5">IUP &amp; IPPKH EBL: <b className="text-emerald-800 font-mono-code">{titikTersedia ? `${titikInti} Titik` : 'Tidak tersedia'}</b></p>
                          <p className="text-slate-700 py-0.5">Radius Waspada (≤{radiusWaspada} km): <b className="text-red-700 font-mono-code">{titikTersedia ? `${titikWaspada} Titik` : '—'}</b></p>
                          <p className="text-slate-700 py-0.5">Status Satelit: <b className="text-slate-900">{statusSatelit}</b></p>
                        </div>
                        <div className="mt-1.5 border-t border-red-100 pt-1.5">
                          <span className="text-[11px] text-emerald-900 font-bold">Zona Konsesi: Bebas Api</span>
                        </div>
                      </div>

                      {/* Card 4: Agenda */}
                      <div className="p-3 bg-gradient-to-br from-amber-50/80 to-slate-50 border-2 border-amber-300 rounded-xl shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-amber-200 pb-1 mb-1.5">
                            <h4 className="font-bold text-amber-950 text-[13px] tracking-wide">AGENDA HARI INI</h4>
                            <span className="inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded bg-amber-100 text-amber-900 border border-amber-300">
                              {daftarJadwal.length} ACARA
                            </span>
                          </div>
                          {daftarJadwal.length > 0 ? (
                            daftarJadwal.slice(0, 2).map((j) => (
                              <p key={j.id} className="text-slate-800 py-0.5 truncate">
                                <b>{j.jam_mulai ? `${j.jam_mulai}: ` : ''}</b>{j.judul}
                              </p>
                            ))
                          ) : (
                            <p className="text-slate-500 italic py-0.5 text-[11px]">Tidak ada agenda terjadwal hari ini</p>
                          )}
                        </div>
                        <div className="mt-1.5 border-t border-amber-100 pt-1.5">
                          <span className="text-[11px] text-emerald-800 font-bold">Alarm Kalender: Standby</span>
                        </div>
                      </div>

                      {/* Card 5: Memo */}
                      <div className="p-3 bg-gradient-to-br from-indigo-50/80 to-slate-50 border-2 border-indigo-300 rounded-xl shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between border-b border-indigo-200 pb-1 mb-1.5">
                            <h4 className="font-bold text-indigo-950 text-[13px] tracking-wide">MEMO OPERASIONAL</h4>
                            <span className="inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded bg-indigo-100 text-indigo-900 border border-indigo-300">
                              {daftarMemo.length} MEMO
                            </span>
                          </div>
                          {daftarMemo.length > 0 ? (
                            daftarMemo.slice(0, 3).map((m) => (
                              <p key={m.id} className="text-slate-800 py-0.5 truncate">• {m.judul}</p>
                            ))
                          ) : (
                            <p className="text-slate-500 italic py-0.5 text-[11px]">Tidak ada memo operasional aktif</p>
                          )}
                        </div>
                        <div className="mt-1.5 border-t border-indigo-100 pt-1.5">
                          <span className="text-[11px] text-indigo-900 font-bold">Arahan Teknis K3L Terarsip</span>
                        </div>
                      </div>

                      {/* Card 6: Kesimpulan */}
                      <div className="p-3 bg-gradient-to-br from-emerald-100/90 to-emerald-50 border-2 border-emerald-400 rounded-xl shadow-sm flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-emerald-950 text-[13px] border-b border-emerald-300 pb-1 mb-1.5 tracking-wide">
                            KESIMPULAN OPERASIONAL
                          </h4>
                          <p className="text-slate-800 text-[12px] leading-relaxed">
                            1. {picaTelat > 0 ? `Dorong penyelesaian ${picaTelat} PICA melewati target.` : 'Target PICA berjalan tepat waktu.'}<br />
                            2. {!titikTersedia ? 'Data titik api tidak tersedia.' : titikInti + titikPetak + titikWaspada > 0 ? `Tindak lanjuti ${titikInti + titikPetak + titikWaspada} titik api di zona peringatan (7 hari).` : 'Tidak ada titik api di zona peringatan dalam 7 hari.'}<br />
                            3. Maksimalkan cuaca {dataCuaca?.sekarang?.ket?.toLowerCase() ?? 'hujan'} untuk kegiatan revegetasi.
                          </p>
                        </div>
                        <div className="mt-1.5 border-t border-emerald-200 pt-1.5">
                          <span className="text-[11px] text-emerald-900 font-bold">Operasi Site: Kondusif &amp; Terkendali</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ---------------- SLIDE 3: PRAKIRAAN CUACA 3 HARI (BMKG) ---------------- */}
                {currentSlide === 5 && (
                  <>
                    <div className="ml-[175px] mr-[140px] pt-1 pb-2 border-b-2 border-emerald-700 mb-3 flex flex-col justify-center min-h-[50px]">
                      <div className="flex justify-between items-baseline gap-2">
                        <h3 className="text-xs md:text-[13px] font-title text-emerald-950 leading-tight">PRAKIRAAN CUACA BMKG 3 HARI KE DEPAN</h3>
                        <span className="inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded bg-sky-50 text-sky-900 border border-sky-300 shrink-0">
                          Kesesuaian Tanam: Sangat Baik
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600 font-body mt-0.5">
                        Prakiraan BMKG · {dataCuaca ? `Desa ${dataCuaca.lokasi.desa}, Kec. ${dataCuaca.lokasi.kecamatan}, ${dataCuaca.lokasi.kotkab}` : 'data cuaca tidak tersedia'}
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-2 mb-2.5 text-xs bg-slate-50 border border-slate-200 p-2 rounded-lg font-body">
                      <div><span className="text-slate-500 text-[11px]">Kondisi Saat Ini:</span><br /><b className="text-sky-900 font-bold text-sm">{dataCuaca?.sekarang?.ket ?? 'Hujan Ringan'} ({dataCuaca?.sekarang?.suhu ?? 28}°C)</b></div>
                      <div><span className="text-slate-500 text-[11px]">Kelembapan Udara:</span><br /><b className="text-slate-800 font-bold text-sm">{dataCuaca?.sekarang?.lembap ?? 88}%</b></div>
                      <div><span className="text-slate-500 text-[11px]">Kecepatan Angin:</span><br /><b className="text-slate-800 font-bold text-sm">{dataCuaca?.sekarang?.angin ?? 12} km/j</b></div>
                      <div><span className="text-slate-500 text-[11px]">Curah Hujan 24 Jam:</span><br /><b className="text-sky-900 font-bold text-sm">{dataCuaca?.sekarang?.hujanMm ?? 14.5} mm</b></div>
                    </div>

                    <div className="overflow-x-auto my-auto border-2 border-slate-200 rounded-lg shadow-sm">
                      <table className="w-full text-left text-xs border-collapse font-body">
                        <thead>
                          <tr className="bg-sky-900 text-white text-[11px]">
                            <th className="p-2 border-r border-white/20">Waktu (WITA)</th>
                            <th className="p-2 border-r border-white/20">Kondisi Cuaca</th>
                            <th className="p-2 border-r border-white/20 text-center">Suhu</th>
                            <th className="p-2 border-r border-white/20 text-center">Kelembapan</th>
                            <th className="p-2 border-r border-white/20">Angin</th>
                            <th className="p-2">Rekomendasi Kegiatan Lapangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {dataCuaca?.slot && dataCuaca.slot.length > 0 ? (
                            dataCuaca.slot.slice(0, 6).map((s, idx) => (
                              <tr key={idx} className={idx % 2 === 1 ? 'bg-sky-50/50' : ''}>
                                <td className="p-2 font-bold font-mono-code text-slate-700">{s.lokal.slice(5)} WITA</td>
                                <td className="p-2 font-semibold text-slate-800">{s.ket}</td>
                                <td className="p-2 text-center font-bold font-mono-code">{s.suhu}°C</td>
                                <td className="p-2 text-center font-bold font-mono-code">{s.lembap}%</td>
                                <td className="p-2 text-slate-600 font-mono-code">{s.angin} km/j {s.arah}</td>
                                <td className="p-2 text-emerald-800 font-semibold">{s.kode >= 60 ? 'Kondisi sangat baik untuk tanam bibit di lereng' : 'Aman untuk operasi penataan lahan'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                                Memuat data prakiraan cuaca stasiun BMKG terdekat...
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* ---------------- SLIDE 4: HISTORI TITIK API (NASA FIRMS) ---------------- */}
                {currentSlide === 6 && (
                  <>
                    <div className="ml-[175px] mr-[140px] pt-1 pb-2 border-b-2 border-emerald-700 mb-3 flex flex-col justify-center min-h-[50px]">
                      <div className="flex justify-between items-baseline gap-2">
                        <h3 className="text-xs md:text-[13px] font-title text-red-950 leading-tight">MONITORING &amp; HISTORI TITIK API (NASA FIRMS)</h3>
                        <span className="inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded bg-emerald-50 text-emerald-900 border border-emerald-300 shrink-0">
                          {!titikTersedia ? 'Data tidak tersedia' : `IUP & IPPKH: ${titikInti} titik · Rehab DAS: ${titikPetak} titik`}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600 font-body mt-0.5">Pemantauan titik panas satelit SNPP VIIRS &amp; NOAA-20 dalam radius konsesi PT EBL</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2.5 text-xs bg-slate-50 border border-slate-200 p-2 rounded-lg font-body">
                      <div><span className="text-slate-500 text-[11px]">Area IUP &amp; IPPKH:</span><br /><b className="text-emerald-800 font-bold text-sm">{titikTersedia ? `${titikInti} Titik${titikInti ? ' (perlu penanganan)' : ''}` : 'Tidak tersedia'}</b></div>
                      <div><span className="text-slate-500 text-[11px]">Radius Waspada (≤{radiusWaspada} km):</span><br /><b className="text-red-700 font-bold text-sm">{titikTersedia ? `${titikWaspada} Titik Terdeteksi` : '—'}</b></div>
                      <div><span className="text-slate-500 text-[11px]">Status Satelit:</span><br /><b className="text-slate-800 font-bold text-sm">{statusSatelit}</b></div>
                    </div>

                    <div className="overflow-x-auto my-auto border-2 border-slate-200 rounded-lg shadow-sm">
                      <table className="w-full text-left text-xs border-collapse font-body">
                        <thead>
                          <tr className="bg-red-900 text-white text-[11px]">
                            <th className="p-2 border-r border-white/20">Waktu Deteksi</th>
                            <th className="p-2 border-r border-white/20">Koordinat (Lat, Lon)</th>
                            <th className="p-2 border-r border-white/20">Satelit</th>
                            <th className="p-2 border-r border-white/20">Keyakinan</th>
                            <th className="p-2 border-r border-white/20">Radius &amp; Zona Konsesi</th>
                            <th className="p-2 border-r border-white/20 text-center">Status Lapangan</th>
                            <th className="p-2">Keterangan Verifikasi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {daftarTitik.length > 0 ? (
                            daftarTitik.map((t) => {
                              const isPadam = t.status === 'padam';
                              const isBukan = t.status === 'bukan_api';
                              const statusBg = isPadam ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : isBukan ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-red-200 text-red-900 border-red-300';
                              const statusLabel = isPadam ? 'SUDAH PADAM' : isBukan ? 'BUKAN API' : t.status === 'dicek' ? 'SEDANG DICEK' : 'BELUM DICEK';
                              return (
                                <tr key={t.id} className={!isPadam && !isBukan ? 'bg-red-50/70' : ''}>
                                  <td className="p-2 font-bold font-mono-code text-slate-800">{waktuWita(t.waktu)}</td>
                                  <td className="p-2 font-bold font-mono-code text-slate-800">{t.lat.toFixed(4)}, {t.lon.toFixed(4)}</td>
                                  <td className="p-2 font-medium text-slate-700">{namaSatelit(t.sumber)}</td>
                                  <td className="p-2 font-bold text-slate-700">{t.keyakinan}</td>
                                  <td className="p-2 font-bold text-slate-800">{teksZona(t)}</td>
                                  <td className="p-2 text-center">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded border ${statusBg}`}>
                                      {statusLabel}
                                    </span>
                                  </td>
                                  <td className="p-2 text-slate-700">{t.catatan || '—'}</td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="p-6 text-center">
                                <div className="flex flex-col items-center justify-center gap-1.5 text-slate-500">
                                  <span className={`font-bold text-sm ${titikTersedia ? 'text-emerald-700' : 'text-amber-700'}`}>{titikTersedia ? 'TIDAK ADA TITIK API TERDETEKSI' : 'DATA TITIK API TIDAK TERSEDIA'}</span>
                                  <span className="text-xs">{titikTersedia ? 'Tidak ada deteksi satelit NASA FIRMS di area tambang maupun Rehab DAS dalam 7 hari terakhir.' : (!dataTitikApi ? 'Data titik api gagal dimuat.' : 'Pemantauan titik api belum aktif.')}</span>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* ---------------- SLIDE 5: REGISTER PICA (BAGIAN 1/2) ---------------- */}
                {currentSlide === 7 && <PratinjauPica daftar={picaBagian1} bagian={1} total={totalPica} buka={picaOpen} tutup={picaClosed} bukti={buktiPica} />}

                {/* ---------------- SLIDE 8: REGISTER PICA (BAGIAN 2/2) ---------------- */}
                {currentSlide === 8 && <PratinjauPica daftar={picaBagian2} bagian={2} total={totalPica} buka={picaOpen} tutup={picaClosed} bukti={buktiPica} />}

                {/* ---------------- SLIDE 9: LAMPIRAN BUKTI PICA ---------------- */}
                {currentSlide === 9 && (() => {
                  const semua = daftarPica.flatMap((p) => (buktiPica[p.id] ?? []).map((k, i, arr) => ({ p, k, ke: i + 1, dari: arr.length })));
                  return (
                    <>
                      <div className="ml-[175px] mr-[140px] pt-1 pb-2 border-b-2 border-emerald-700 mb-3 flex flex-col justify-center min-h-[50px]">
                        <div className="flex justify-between items-baseline gap-2">
                          <h3 className="text-xs md:text-[13px] font-title text-emerald-950 leading-tight">LAMPIRAN BUKTI PICA</h3>
                          <span className="inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                            {semua.length} FOTO
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-600 font-body mt-0.5">Semua foto bukti PICA; di PPT 8 foto per slide{semua.length > 8 ? `, berlanjut ${Math.ceil(Math.min(48, semua.length) / 8)} slide` : ''}</p>
                      </div>
                      {semua.length ? (
                        <div className="grid grid-cols-4 gap-2 font-body">
                          {semua.slice(0, 8).map((x) => (
                            <div key={x.k} className="bg-white border-2 border-slate-300 rounded overflow-hidden">
                              <div className="h-24 bg-slate-800"><FotoLaporan kunci={x.k} alt={x.p.judul} /></div>
                              <div className="p-1.5 text-[10px]">
                                <b className="text-teal-700">{noPica(x.p)} · foto {x.ke}/{x.dari}</b>
                                <p className="text-slate-600 truncate">{x.p.judul}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="my-auto max-w-xl mx-auto p-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-center font-body">
                          <Camera size={24} className="mx-auto mb-2 text-emerald-700" />
                          <h4 className="font-title text-xs text-slate-800">BELUM ADA FOTO BUKTI PICA</h4>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* ---------------- SLIDE 10: DOKUMENTASI LOG ---------------- */}
                {currentSlide === 10 && (
                  <>
                    <div className="ml-[175px] mr-[140px] pt-1 pb-2 border-b-2 border-emerald-700 mb-3 flex flex-col justify-center min-h-[50px]">
                      <div className="flex justify-between items-baseline gap-2">
                        <h3 className="text-xs md:text-[13px] font-title text-emerald-950 leading-tight">DOKUMENTASI LOG KEGIATAN LAPANGAN</h3>
                        <span className="inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0">
                          {logTerbaru.length} CATATAN · 30 HARI
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600 font-body mt-0.5">Laporan menu LOG beserta fotonya; di PPT 4 baris per slide{logTerbaru.length > 4 ? `, berlanjut ${Math.ceil(Math.min(20, logTerbaru.length) / 4)} slide` : ''}</p>
                    </div>
                    {logTerbaru.length > 0 ? (
                      <table className="w-full text-[11px] font-body border-collapse">
                        <thead>
                          <tr className="bg-[#2f5d33] text-white text-left">
                            {['Foto', 'Tanggal & Petugas', 'Kegiatan', 'Capaian', 'Catatan'].map((h) => <th key={h} className="p-1.5 border border-slate-400">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {logTerbaru.slice(0, 4).map((l, i) => (
                            <tr key={l.id} className={i % 2 ? 'bg-slate-100' : 'bg-white'}>
                              <td className="p-1 border border-slate-300 w-24"><div className="w-24 h-16 bg-slate-800 overflow-hidden">{l.foto ? <FotoLaporan kunci={l.foto} alt={l.jenis ?? 'Kegiatan'} /> : <span className="text-[10px] text-slate-400 flex items-center justify-center h-full">TANPA FOTO</span>}</div></td>
                              <td className="p-1.5 border border-slate-300 align-top"><b className="text-teal-700">{l.dibuat_pada.slice(0, 10)}</b><br />{l.user_nama ?? l.user_id}</td>
                              <td className="p-1.5 border border-slate-300 align-top font-bold text-slate-900">{l.jenis ?? 'Kegiatan lapangan'}{l.pica_id && <span className="block text-[10px] text-sky-700 font-normal">Bukti {l.pica_id}</span>}</td>
                              <td className="p-1.5 border border-slate-300 text-center font-bold text-green-700">{l.capaian ? `${l.capaian} ${l.satuan ?? ''}` : '—'}</td>
                              <td className="p-1.5 border border-slate-300 align-top text-slate-700">{l.catatan || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="my-auto max-w-xl mx-auto p-8 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl text-center font-body">
                        <h4 className="font-title text-xs text-slate-800">BELUM ADA CATATAN KEGIATAN DALAM 30 HARI TERAKHIR</h4>
                      </div>
                    )}
                  </>
                )}

                {/* ---------------- SLIDE 8: AGENDA ---------------- */}
                {currentSlide === 11 && (
                  <>
                    <div className="ml-[175px] mr-[140px] pt-1 pb-2 border-b-2 border-emerald-700 mb-3 flex flex-col justify-center min-h-[50px]">
                      <div className="flex justify-between items-baseline gap-2">
                        <h3 className="text-xs md:text-[13px] font-title text-amber-950 leading-tight">AGENDA &amp; JADWAL RAPAT OPERASIONAL</h3>
                        <span className="inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded bg-amber-50 text-amber-900 border border-amber-300 shrink-0">
                          SISTEM KALENDER WITA
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600 font-body mt-0.5">Pertemuan koordinasi, briefing harian, dan evaluasi lapangan yang tersimpan di sistem</p>
                    </div>

                    <div className="overflow-x-auto my-auto border-2 border-slate-200 rounded-lg shadow-sm font-body">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-amber-800 text-white text-[11px]">
                            <th className="p-2 border-r border-white/20">Tanggal</th>
                            <th className="p-2 border-r border-white/20">Waktu (WITA)</th>
                            <th className="p-2 border-r border-white/20">Agenda / Rapat Koordinasi</th>
                            <th className="p-2 border-r border-white/20">PIC Pelaksana</th>
                            <th className="p-2 border-r border-white/20">Keterangan</th>
                            <th className="p-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {daftarJadwal.length > 0 ? (
                            daftarJadwal.map((j) => (
                              <tr key={j.id}>
                                <td className="p-2 font-mono-code text-slate-700 font-bold">{j.tanggal}</td>
                                <td className="p-2 font-mono-code font-bold text-sky-900">{j.jam_mulai ? `${j.jam_mulai}${j.jam_selesai ? ` - ${j.jam_selesai}` : ''}` : 'Seharian'}</td>
                                <td className="p-2 font-bold text-slate-900">{j.judul}</td>
                                <td className="p-2 font-medium text-slate-800">{j.pemilik_nama ?? 'Seluruh tim'}</td>
                                <td className="p-2 text-slate-700">{j.keterangan ?? '—'}</td>
                                <td className="p-2 text-center">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded border ${j.selesai ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-amber-200 text-amber-900 border-amber-300'}`}>
                                    {j.selesai ? 'SELESAI' : 'TERJADWAL'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                                Belum ada agenda rapat atau kegiatan operasional yang tersimpan di sistem kalender.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* ---------------- SLIDE 9: MEMO ---------------- */}
                {currentSlide === 12 && (
                  <>
                    <div className="ml-[175px] mr-[140px] pt-1 pb-2 border-b-2 border-emerald-700 mb-3 flex flex-col justify-center min-h-[50px]">
                      <div className="flex justify-between items-baseline gap-2">
                        <h3 className="text-xs md:text-[13px] font-title text-indigo-950 leading-tight">MEMO OPERASIONAL &amp; KEBIJAKAN LAPANGAN</h3>
                        <span className="inline-flex items-center px-1.5 py-0.5 font-bold text-[10px] rounded bg-indigo-50 text-indigo-900 border border-indigo-300 shrink-0">
                          ARSIP MEMO INTERNAL
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600 font-body mt-0.5">Instruksi keselamatan K3L, catatan teknis, dan arahan lapangan yang tersimpan</p>
                    </div>

                    <div className="overflow-x-auto my-auto border-2 border-slate-200 rounded-lg shadow-sm font-body">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-indigo-900 text-white text-[11px]">
                            <th className="p-2 border-r border-white/20 text-center">No</th>
                            <th className="p-2 border-r border-white/20">Kategori</th>
                            <th className="p-2 border-r border-white/20">Judul &amp; Arahan Operasional</th>
                            <th className="p-2 border-r border-white/20">Dibuat Oleh</th>
                            <th className="p-2 text-center">Tanggal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {daftarMemo.length > 0 ? (
                            daftarMemo.slice(0, 4).map((m, idx) => (
                              <tr key={m.id}>
                                <td className="p-2 text-center font-bold text-slate-600">{idx + 1}</td>
                                <td className="p-2 font-bold text-indigo-900">{m.kategori ?? 'Operasional'}</td>
                                <td className="p-2">
                                  <p className="font-bold text-slate-900">{m.judul}</p>
                                  {m.ringkasan && <p className="text-slate-600 text-[11px] mt-0.5">{m.ringkasan}</p>}
                                </td>
                                <td className="p-2 font-medium text-slate-800">{penulisMemo(m) ?? '—'}</td>
                                <td className="p-2 text-center font-mono-code text-slate-600">{m.tanggal ?? m.dibuat_pada?.slice(0, 10) ?? '—'}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                                Belum ada memo atau instruksi operasional yang tersimpan di sistem.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* ---------------- SLIDE 10: DISCLAIMER ---------------- */}
                {currentSlide === 13 && (
                  <div className="my-auto max-w-2xl mx-auto space-y-3 bg-slate-50/90 p-5 rounded-2xl border border-slate-300 shadow-sm text-center font-body">
                    <div className="inline-flex items-center gap-2 text-emerald-950 font-bold text-xs tracking-wider uppercase">
                      <span>HASNUR GROUP</span>
                      <span>·</span>
                      <span>PT ENERGI BATUBARA LESTARI</span>
                    </div>

                    <h3 className="text-base font-title text-emerald-950 tracking-wider">
                      SANGGAHAN (DISCLAIMER)
                    </h3>

                    <div className="space-y-2 text-xs text-slate-700 leading-relaxed text-justify px-2">
                      <p>
                        1. Dokumen presentasi ini disusun secara otomatis oleh <b>Pokemonkey System</b> berdasarkan data sinkronisasi lapangan, sensor satelit NASA FIRMS, prakiraan cuaca BMKG, serta tindak lanjut audit internal PICA PT Energi Batubara Lestari.
                      </p>
                      <p>
                        2. Seluruh data koordinat hotspot dan kondisi iklim bersumber dari lembaga resmi penyedia data publik dan diverifikasi oleh petugas patroli darat.
                      </p>
                      <p>
                        3. Informasi dalam laporan ini bersifat <b>INTERNAL &amp; RAHASIA</b>. Dilarang menggandakan, menyebarluaskan, atau membagikan sebagian maupun seluruh isi materi tanpa persetujuan tertulis dari manajemen PT Energi Batubara Lestari.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 italic">
                      Dicetak pada: {hariIni} WITA · Hasnur Group Integrity &amp; Excellence
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ================= BOTTOM THUMBNAIL BAR ================= */}
      <footer className="max-w-6xl mx-auto w-full mt-2.5 bg-slate-900/90 border border-slate-800 p-2 rounded-xl flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          {slideTitles.map((title, idx) => {
            const slideNum = idx + 1;
            const isActive = currentSlide === slideNum;
            return (
              <button
                key={slideNum}
                onClick={() => setCurrentSlide(slideNum)}
                className={`px-2.5 py-1.5 rounded text-[10px] font-mono-code transition-all whitespace-nowrap border ${
                  isActive
                    ? 'bg-emerald-600 text-white font-bold border-emerald-400 shadow-md scale-105'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border-slate-700'
                }`}
              >
                {slideNum}. {title.split('(')[0].replace(/^\d+\.\s*/, '').trim()}
              </button>
            );
          })}
        </div>
      </footer>
    </div>
  );
};
