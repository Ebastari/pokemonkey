import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Star, X, Activity, Users, History, RefreshCw, Ban, Calculator } from 'lucide-react';
import { api } from '../lib/api';
import type { Pengguna } from '../lib/tipe-api';
import type { BarisRiwayatXp, DataSkor, SkorAnggota } from '../lib/xp';
import { BOBOT_WILAYAH, LABEL_WILAYAH, WILAYAH_METER, type NilaiKeaktifan } from '../server/src/xp-aturan';

/**
 * Panel keaktifan (docs/sistem-xp.md): level & XP, Meter Aktif Harian, Skor 7 hari,
 * Nilai Keaktifan semester (KPI), riwayat XP, tabel tim untuk semua anggota,
 * pembatalan XP (Admin/SPV) dan hitung ulang riwayat sekali jalan (Admin).
 */

interface Props {
  pengguna: Pengguna;
  notify: (pesan: string) => void;
  onTutup: () => void;
  /** XP/saldo berubah (pembatalan, konversi) → muat ulang profil di kepala layar. */
  onBerubah?: () => void;
}

interface BarisPratinjau {
  id: string; nama: string; xpLama: number; levelLama: number; riwayat: number; warisan: number;
  total: number; levelBaru: number; saldo: number;
  rincian: { sumber: string; label: string; jumlah: number; xp: number }[];
}
interface HasilHitungUlang { terapkan: boolean; xpMulai: string; sudahKonversi?: boolean; barisBaru: number; pratinjau: BarisPratinjau[] }

const WARNA_WILAYAH: Record<string, string> = {
  tindak: 'bg-amber-500', lapor: 'bg-emerald-500', koordinasi: 'bg-cyan-500', hadir: 'bg-pink-500',
  main: 'bg-yellow-600', bonus: 'bg-purple-500', warisan: 'bg-zinc-500',
};
const LABEL_SEMUA: Record<string, string> = { ...LABEL_WILAYAH, main: 'Main', bonus: 'Bonus', warisan: 'Warisan' };

const angka = (n: number) => n.toLocaleString('id-ID');
const nilaiTeks = (k: NilaiKeaktifan) => (k.nilai === null ? '—' : String(Math.round(k.nilai)));
const warnaNilai = (n: number | null) => (n === null ? 'text-zinc-400' : n >= 70 ? 'text-emerald-300' : n >= 40 ? 'text-yellow-300' : 'text-red-300');

function Bar({ persen, warna }: { persen: number; warna: string }) {
  return (
    <div className="h-3 bg-black border-2 border-white/60 overflow-hidden">
      <div className={`h-full ${warna} transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, persen))}%` }} />
    </div>
  );
}

function Riwayat({ user, bolehBatal, notify, onBerubah }: { user: string; bolehBatal: boolean; notify: Props['notify']; onBerubah: () => void }) {
  const [baris, setBaris] = useState<BarisRiwayatXp[] | null>(null);
  const muat = useCallback(() => {
    api<{ riwayat: BarisRiwayatXp[] }>(`/api/xp/riwayat?hari=30&user=${encodeURIComponent(user)}`)
      .then((d) => setBaris(d.riwayat)).catch((e) => { setBaris([]); notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT RIWAYAT'); });
  }, [user, notify]);
  useEffect(() => { muat(); }, [muat]);

  const batal = async (r: BarisRiwayatXp) => {
    const alasan = window.prompt(`Batalkan +${r.xp} XP "${r.label}" (${r.hari})?\nTulis alasannya:`);
    if (alasan === null) return;
    try {
      await api('/api/xp/batal', { body: { id: r.id, alasan } });
      notify('XP DIBATALKAN');
      muat();
      onBerubah();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBATALKAN'); }
  };

  if (!baris) return <p className="text-[12px] text-zinc-400">Memuat riwayat…</p>;
  if (baris.length === 0) return <p className="text-[12px] text-zinc-400">Belum ada XP dalam 30 hari terakhir.</p>;
  return (
    <ul className="divide-y divide-white/10 border-2 border-white/15 bg-black/40">
      {baris.map((r) => (
        <li key={r.id} className={`flex items-center gap-2 px-2 py-1.5 text-[12px] ${r.dibatalkan_pada ? 'opacity-50' : ''}`}>
          <span className={`w-2.5 h-2.5 shrink-0 border border-white/50 ${WARNA_WILAYAH[r.wilayah] ?? 'bg-zinc-600'}`} title={LABEL_SEMUA[r.wilayah] ?? r.wilayah} />
          <div className="flex-1 min-w-0 leading-tight">
            <p className={`text-white truncate ${r.dibatalkan_pada ? 'line-through' : ''}`}>{r.label}</p>
            <p className="text-[10px] text-zinc-400 uppercase truncate">
              {r.menu} · {r.hari.slice(8)}/{r.hari.slice(5, 7)}{r.dibatalkan_pada ? ` · dibatalkan: ${r.alasan_batal ?? ''}` : ''}
            </p>
          </div>
          <span className="font-mono font-bold text-yellow-300 whitespace-nowrap">+{angka(r.xp)}</span>
          {bolehBatal && !r.dibatalkan_pada && r.sumber !== 'warisan' && (
            <button onClick={() => batal(r)} className="btn-ikon bg-zinc-800 text-red-300 hover:text-red-200" title="Batalkan XP ini" aria-label="Batalkan XP ini"><Ban size={13} /></button>
          )}
        </li>
      ))}
    </ul>
  );
}

function KartuSaya({ a, semester }: { a: SkorAnggota; semester: DataSkor['semester'] }) {
  const sentuh = new Set(a.wilayahHariIni);
  return (
    <div className="space-y-3">
      <div className="bg-black/60 border-2 border-yellow-500/40 p-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="font-title text-[12px] text-yellow-300">LEVEL {a.level}</span>
          <span className="text-[11px] text-zinc-300 font-mono">{angka(a.xpDiLevel)} / {angka(a.xpButuh)} XP</span>
        </div>
        <Bar persen={(a.xpDiLevel / Math.max(1, a.xpButuh)) * 100} warna="bg-yellow-400" />
        <div className="grid grid-cols-3 gap-2 mt-2.5 text-center">
          <div><p className="text-[10px] text-zinc-400 uppercase">XP total</p><p className="font-mono font-bold text-white text-[13px]">{angka(a.xp)}</p></div>
          <div><p className="text-[10px] text-zinc-400 uppercase">Saldo SHOP</p><p className="font-mono font-bold text-emerald-300 text-[13px]">{angka(a.saldo)}</p></div>
          <div><p className="text-[10px] text-zinc-400 uppercase">XP 7 hari</p><p className="font-mono font-bold text-cyan-300 text-[13px]">{angka(a.xp7)}</p></div>
        </div>
      </div>

      <div className="bg-black/60 border-2 border-white/20 p-3">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[11px] font-bold text-white uppercase flex items-center gap-1.5"><Activity size={13} /> Meter aktif hari ini</span>
          <span className="font-mono font-black text-[16px] text-yellow-300">{a.meterHariIni}/100</span>
        </div>
        <Bar persen={a.meterHariIni} warna="bg-gradient-to-r from-pink-500 via-cyan-500 to-amber-500" />
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {WILAYAH_METER.map((w) => (
            <div key={w} className={`flex items-center gap-1.5 px-2 py-1 border-2 text-[11px] ${sentuh.has(w) ? 'border-white bg-white/10 text-white' : 'border-white/15 text-zinc-500'}`}>
              <span className={`w-2.5 h-2.5 border border-white/50 ${sentuh.has(w) ? WARNA_WILAYAH[w] : 'bg-zinc-800'}`} />
              <span className="flex-1">{LABEL_WILAYAH[w]}</span>
              <span className="font-mono">{sentuh.has(w) ? '✓' : ''} {BOBOT_WILAYAH[w]}</span>
            </div>
          ))}
        </div>
        {!a.hariIniKerja && <p className="text-[10px] text-zinc-400 mt-1.5">Hari ini bukan hari kerja di roster — tidak dihitung ke KPI.</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {([['Skor 7 hari', a.skor7], [`KPI ${semester.label}`, a.kpi]] as const).map(([judul, k]) => (
          <div key={judul} className="bg-black/60 border-2 border-white/20 p-3">
            <p className="text-[10px] text-zinc-400 uppercase">{judul}</p>
            <p className={`font-title text-[18px] ${warnaNilai(k.nilai)}`}>{nilaiTeks(k)}</p>
            <p className="text-[10px] text-zinc-400">{k.hariKerja} hari kerja</p>
            <div className="mt-1.5 space-y-1">
              {WILAYAH_METER.map((w) => (
                <div key={w} className="flex items-center gap-1.5 text-[10px] text-zinc-300">
                  <span className="w-16 shrink-0">{LABEL_WILAYAH[w]}</span>
                  <div className="flex-1"><Bar persen={k.perWilayah[w]} warna={WARNA_WILAYAH[w]} /></div>
                  <span className="w-8 text-right font-mono">{Math.round(k.perWilayah[w])}%</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-zinc-400 leading-relaxed">
        Meter = jumlah bobot wilayah yang disentuh dalam sehari (Tindak lanjut PICA 40 · Lapor 30 · Koordinasi 20 · Hadir 10).
        KPI = rata-rata meter pada hari kerja roster sampai kemarin. XP dari main, bonus, dan warisan tidak masuk KPI.
      </p>
    </div>
  );
}

function HitungUlang({ notify, onBerubah }: { notify: Props['notify']; onBerubah: () => void }) {
  const [hasil, setHasil] = useState<HasilHitungUlang | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [buka, setBuka] = useState<string | null>(null);

  const jalankan = async (terapkan: boolean) => {
    if (terapkan && !window.confirm('Terapkan hitung ulang XP untuk semua anggota? Langkah ini hanya bisa dijalankan sekali.')) return;
    setSibuk(true);
    try {
      const d = await api<HasilHitungUlang>(`/api/xp/hitung-ulang${terapkan ? '?terapkan=1' : ''}`, { method: 'POST', body: {} });
      setHasil(d);
      if (d.terapkan) { notify('HITUNG ULANG XP DITERAPKAN'); onBerubah(); }
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGHITUNG ULANG'); }
    finally { setSibuk(false); }
  };

  return (
    <div className="space-y-3">
      <div className="panel-retro text-[12px] text-zinc-300 leading-relaxed">
        Menghitung ulang XP dari riwayat sebelum sistem baru: PICA yang dibuat, dikerjakan, diajukan, dan ditutup (siapa
        yang menutup &amp; tepat waktu atau tidak), update &amp; bukti PICA, laporan &amp; fotonya, titik api, karhutla, memo,
        dokumen, info, roster, RAB, dan misi tim — dengan aturan dan batas harian yang sama.
        <b className="text-white"> Tidak ada yang kehilangan XP atau saldo:</b> selisih yang tidak bisa dilacak (pisang,
        Monkey Run, centang jadwal lama) dicatat sebagai <i>XP warisan</i>. Lihat pratinjau dulu, lalu terapkan sekali.
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={sibuk} onClick={() => jalankan(false)} className="btn-retro btn-retro-sm bg-blue-700 flex items-center gap-1.5">
          <RefreshCw size={13} className={sibuk ? 'animate-spin' : ''} /> Pratinjau
        </button>
        {hasil && !hasil.terapkan && (
          <button disabled={sibuk || hasil.sudahKonversi} onClick={() => jalankan(true)} className={`btn-retro btn-retro-sm flex items-center gap-1.5 ${hasil.sudahKonversi ? 'bg-zinc-700' : 'bg-emerald-700'}`}>
            <Calculator size={13} /> {hasil.sudahKonversi ? 'Sudah pernah diterapkan' : 'Terapkan'}
          </button>
        )}
      </div>
      {hasil && (
        <>
          <p className="text-[11px] text-zinc-400">
            {hasil.terapkan ? 'Sudah diterapkan.' : 'Pratinjau — belum ada yang berubah.'} Riwayat sebelum {hasil.xpMulai.slice(0, 10)} ·
            {' '}{angka(hasil.barisBaru)} baris riwayat baru.
          </p>
          <div className="overflow-x-auto border-2 border-white/15">
            <table className="w-full text-[11px] text-left">
              <thead className="bg-white/10 text-zinc-300 uppercase text-[10px]">
                <tr><th className="p-1.5">Nama</th><th className="p-1.5 text-right">XP lama</th><th className="p-1.5 text-right">Riwayat</th><th className="p-1.5 text-right">Warisan</th><th className="p-1.5 text-right">Total</th><th className="p-1.5 text-right">Level</th><th className="p-1.5 text-right">Saldo</th></tr>
              </thead>
              <tbody>
                {hasil.pratinjau.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr className="border-t border-white/10 cursor-pointer hover:bg-white/5" onClick={() => setBuka(buka === p.id ? null : p.id)}>
                      <td className="p-1.5 text-white">{p.nama}</td>
                      <td className="p-1.5 text-right font-mono">{angka(p.xpLama)}</td>
                      <td className="p-1.5 text-right font-mono text-cyan-300">{angka(p.riwayat)}</td>
                      <td className="p-1.5 text-right font-mono text-zinc-400">{angka(p.warisan)}</td>
                      <td className="p-1.5 text-right font-mono text-yellow-300">{angka(p.total)}</td>
                      <td className="p-1.5 text-right font-mono">{p.levelLama}→{p.levelBaru}</td>
                      <td className="p-1.5 text-right font-mono text-emerald-300">{angka(p.saldo)}</td>
                    </tr>
                    {buka === p.id && (
                      <tr><td colSpan={7} className="p-2 bg-black/50">
                        {p.rincian.length === 0 ? <span className="text-zinc-400">Tidak ada riwayat yang bisa dilacak.</span> : (
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
                            {p.rincian.map((r) => (
                              <li key={r.sumber} className="flex justify-between gap-2"><span className="text-zinc-300">{r.label} ×{r.jumlah}</span><span className="font-mono text-yellow-300">{angka(r.xp)}</span></li>
                            ))}
                          </ul>
                        )}
                      </td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export const PanelKeaktifan: React.FC<Props> = ({ pengguna, notify, onTutup, onBerubah }) => {
  const kelola = pengguna.peran === 'admin' || pengguna.peran === 'supervisor';
  const admin = pengguna.peran === 'admin';
  const [tab, setTab] = useState<'saya' | 'tim' | 'hitung'>('saya');
  const [skor, setSkor] = useState<DataSkor | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [urut, setUrut] = useState<'kpi' | 'skor7' | 'xp'>('kpi');

  const muat = useCallback(() => {
    api<DataSkor>('/api/xp/skor').then((d) => { setSkor(d); setGalat(null); })
      .catch((e) => setGalat(e instanceof Error ? e.message : 'Gagal memuat skor.'));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  const berubah = useCallback(() => { muat(); onBerubah?.(); }, [muat, onBerubah]);

  const saya = skor?.anggota.find((a) => a.id === pengguna.id);
  const timUrut = useMemo(() => {
    const daftar = [...(skor?.anggota ?? [])];
    const n = (k: NilaiKeaktifan) => k.nilai ?? -1;
    return daftar.sort((a, b) => (urut === 'xp' ? b.xp - a.xp : urut === 'skor7' ? n(b.skor7) - n(a.skor7) : n(b.kpi) - n(a.kpi)));
  }, [skor, urut]);
  const anggotaDipilih = skor?.anggota.find((a) => a.id === dipilih);

  const TAB: { id: typeof tab; label: string; ikon: React.ReactElement }[] = [
    { id: 'saya', label: 'Saya', ikon: <Star size={13} /> },
    { id: 'tim', label: 'Tim', ikon: <Users size={13} /> },
    ...(admin ? [{ id: 'hitung' as const, label: 'Hitung ulang', ikon: <Calculator size={13} /> }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 flex items-center justify-center p-3 sm:p-4" onClick={onTutup}>
      <div className="retro-box !bg-zinc-950 border-4 !border-yellow-500 w-full max-w-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-2xl max-h-[92vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b-2 border-yellow-500/40 pb-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-yellow-500 border-2 border-white flex items-center justify-center shrink-0"><Star size={18} className="text-black fill-black" /></div>
            <div>
              <h2 className="font-title text-[13px] md:text-[15px] text-yellow-300 leading-none">KEAKTIFAN & XP</h2>
              <p className="text-[10px] text-zinc-400 uppercase mt-0.5">{skor ? `${skor.semester.label} · per ${skor.hariIni.slice(8)}/${skor.hariIni.slice(5, 7)}` : 'Memuat…'}</p>
            </div>
          </div>
          <button onClick={onTutup} className="btn-ikon bg-zinc-800 text-zinc-400 hover:text-white" aria-label="Tutup"><X size={18} /></button>
        </div>

        <div className="flex gap-1.5 shrink-0">
          {TAB.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setDipilih(null); }} className={`btn-retro btn-retro-sm flex items-center gap-1.5 ${tab === t.id ? 'bg-yellow-600' : 'bg-zinc-800'}`}>{t.ikon} {t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar pr-1 space-y-3">
          {galat && <p className="text-[12px] text-red-300">{galat}</p>}

          {tab === 'saya' && saya && skor && (
            <>
              <KartuSaya a={saya} semester={skor.semester} />
              <h3 className="text-[11px] font-bold text-white uppercase flex items-center gap-1.5"><History size={13} /> Riwayat XP 30 hari</h3>
              <Riwayat user={pengguna.id} bolehBatal={kelola} notify={notify} onBerubah={berubah} />
            </>
          )}
          {tab === 'saya' && skor && !saya && <p className="text-[12px] text-zinc-400">Akun ini tidak ikut dalam skor keaktifan.</p>}

          {tab === 'tim' && skor && !anggotaDipilih && (
            <>
              <div className="flex flex-wrap gap-1.5 items-center text-[11px] text-zinc-400">
                Urutkan:
                {([['kpi', 'KPI'], ['skor7', '7 hari'], ['xp', 'XP']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setUrut(k)} className={`btn-retro btn-retro-sm !py-0.5 ${urut === k ? 'bg-yellow-600' : 'bg-zinc-800'}`}>{l}</button>
                ))}
              </div>
              <div className="overflow-x-auto border-2 border-white/15">
                <table className="w-full text-[12px] text-left">
                  <thead className="bg-white/10 text-zinc-300 uppercase text-[10px]">
                    <tr><th className="p-1.5">#</th><th className="p-1.5">Nama</th><th className="p-1.5 text-right">Lv</th><th className="p-1.5">Hari ini</th><th className="p-1.5 text-right">7 hari</th><th className="p-1.5 text-right">KPI</th></tr>
                  </thead>
                  <tbody>
                    {timUrut.map((a, i) => (
                      <tr key={a.id} onClick={() => setDipilih(a.id)} className={`border-t border-white/10 cursor-pointer hover:bg-white/5 ${a.id === pengguna.id ? 'bg-yellow-900/30' : ''}`}>
                        <td className="p-1.5 text-zinc-400 font-mono">{i + 1}</td>
                        <td className="p-1.5"><p className="text-white truncate max-w-[9rem] sm:max-w-none">{a.nama}</p><p className="text-[10px] text-zinc-400 truncate">{a.jabatan ?? a.peran}</p></td>
                        <td className="p-1.5 text-right font-mono text-yellow-300">{a.level}</td>
                        <td className="p-1.5">
                          <div className="flex gap-0.5" title={`Meter ${a.meterHariIni}/100`}>
                            {WILAYAH_METER.map((w) => <span key={w} className={`w-3 h-3 border border-white/40 ${a.wilayahHariIni.includes(w) ? WARNA_WILAYAH[w] : 'bg-zinc-800'}`} />)}
                          </div>
                        </td>
                        <td className={`p-1.5 text-right font-mono ${warnaNilai(a.skor7.nilai)}`}>{nilaiTeks(a.skor7)}</td>
                        <td className={`p-1.5 text-right font-mono font-bold ${warnaNilai(a.kpi.nilai)}`}>{nilaiTeks(a.kpi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-zinc-400">
                {WILAYAH_METER.map((w) => <span key={w} className="flex items-center gap-1"><span className={`w-2.5 h-2.5 border border-white/40 ${WARNA_WILAYAH[w]}`} />{LABEL_WILAYAH[w]} {BOBOT_WILAYAH[w]}</span>)}
              </div>
            </>
          )}
          {tab === 'tim' && skor && anggotaDipilih && (
            <>
              <button onClick={() => setDipilih(null)} className="btn-retro btn-retro-sm bg-zinc-800">← Kembali ke tim</button>
              <h3 className="font-title text-[12px] text-white">{anggotaDipilih.nama}</h3>
              <KartuSaya a={anggotaDipilih} semester={skor.semester} />
              {(kelola || anggotaDipilih.id === pengguna.id) && (
                <>
                  <h3 className="text-[11px] font-bold text-white uppercase flex items-center gap-1.5"><History size={13} /> Riwayat XP 30 hari</h3>
                  <Riwayat user={anggotaDipilih.id} bolehBatal={kelola} notify={notify} onBerubah={berubah} />
                </>
              )}
            </>
          )}

          {tab === 'hitung' && admin && <HitungUlang notify={notify} onBerubah={berubah} />}
        </div>
      </div>
    </div>
  );
};
