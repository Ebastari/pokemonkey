import React, { useEffect, useMemo, useState } from 'react';
import {
  AlignLeft, BarChart3, CheckSquare, Copy, FileText, GitCompare, Loader2, PenTool, Sparkles, Wand2, X,
} from 'lucide-react';
import {
  barisTugasAi, pemakaianAi, prosesMemoAi, type HasilMemoAi, type ModeMemoAi, type PemakaianAi, type PilihanLaporanAi, type TugasAi,
} from '../lib/gemini';
import { bedaBaris } from '../lib/gabung-isi';
import type { AnggotaRingkas } from '../lib/tipe-api';
import { IsiMemo } from './MemoMarkup';

/**
 * Asisten Menulis Memo (Gemini, lewat server — lihat server/src/ai-memo.ts).
 * Hasil AI tidak pernah langsung menimpa memo: pengguna melihat pratinjau
 * (tampilan memo sungguhan atau perbedaan per baris), menyunting usulan tugas,
 * lalu memilih penempatan. Perubahan bisa diurungkan dari halaman memo.
 */

/** Cara hasil AI dipasang ke memo. */
export type TerapkanAi =
  | { jenis: 'ganti'; isi: string; judul?: string; ringkasan?: string }
  | { jenis: 'tambah'; isi: string; bagian?: string; judul?: string; ringkasan?: string }
  | { jenis: 'ringkasan'; ringkasan: string; judul?: string };

interface Props {
  memoId: string;
  lingkup: 'tim' | 'pribadi';
  judulAwal: string;
  isiAwal: string;
  ringkasanAwal: string;
  tim: AnggotaRingkas[];
  /** Admin/SPV: tampilkan pemakaian AI tim bulan ini. */
  kelola?: boolean;
  onTerapkan: (a: TerapkanAi) => void;
  onTutup: () => void;
  notify: (pesan: string) => void;
}

const MODE: { id: Exclude<ModeMemoAi, 'pilihan'>; label: string; ket: string; ikon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'kembangkan', label: 'Kembangkan', ket: 'Catatan kasar → memo kerja utuh: konteks, keputusan, rincian, tindak lanjut.', ikon: FileText },
  { id: 'rapikan', label: 'Rapikan', ket: 'Perbaiki bahasa & struktur tanpa mengubah maksud, fakta, atau tanggal.', ikon: PenTool },
  { id: 'ringkas', label: 'Ringkas', ket: 'Ringkasan eksekutif untuk kolom Ringkasan — isi memo tidak disentuh.', ikon: AlignLeft },
  { id: 'ekstrak_tugas', label: 'Tugas', ket: 'Temukan tindak lanjut; tenggat & PIC diusulkan bila jelas — periksa sebelum disisipkan.', ikon: CheckSquare },
  { id: 'tulis', label: 'Tulis baru', ket: 'Minta AI menulis bagian baru yang selaras dengan memo ini.', ikon: Wand2 },
  { id: 'laporan', label: 'Laporan', ket: 'Laporan otomatis dari data resmi (angka persis), lengkap dengan grafik & kartu data yang selalu terbaru.', ikon: BarChart3 },
];

const SUMBER_LAPORAN: [keyof Omit<PilihanLaporanAi, 'periode'>, string][] = [['pica', 'PICA'], ['reklamasi', 'Realisasi reklamasi'], ['nursery', 'Smart Nursery'], ['geotag', 'Geotagging']];

const CONTOH_TULIS = [
  'Buat notulen rapat dari catatan di atas',
  'Buat rencana kerja minggu ini dalam bentuk ceklis',
  'Buat tabel rekap dari data di memo',
  'Tulis laporan kejadian K3 dengan kronologi & tindakan',
];

export const ModalAiMemo: React.FC<Props> = ({ memoId, lingkup, judulAwal, isiAwal, ringkasanAwal, tim, kelola, onTerapkan, onTutup, notify }) => {
  const [mode, setMode] = useState<Exclude<ModeMemoAi, 'pilihan'>>('kembangkan');
  const [instruksi, setInstruksi] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [hasil, setHasil] = useState<HasilMemoAi | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [lihatBeda, setLihatBeda] = useState(false);
  const [pakaiJudul, setPakaiJudul] = useState(false);
  const [pakaiRingkasan, setPakaiRingkasan] = useState(false);
  const [teksRingkasan, setTeksRingkasan] = useState('');
  const [tugas, setTugas] = useState<(TugasAi & { pilih: boolean })[]>([]);
  const [laporan, setLaporan] = useState<PilihanLaporanAi>({ pica: true, reklamasi: true, nursery: false, geotag: false, periode: 'minggu' });
  const [kuota, setKuota] = useState<PemakaianAi | null>(null);
  const muatKuota = () => { pemakaianAi().then(setKuota).catch(() => setKuota(null)); };
  useEffect(muatKuota, []);

  const def = MODE.find((m) => m.id === mode)!;
  const judulBaru = (hasil?.judul ?? hasil?.judul_usulan ?? '').trim();
  const adaJudulBaru = Boolean(judulBaru && judulBaru !== judulAwal.trim());

  const proses = async () => {
    if (mode === 'tulis' && !instruksi.trim()) { setGalat('Tulis dulu apa yang perlu dibuat AI.'); return; }
    if (mode !== 'tulis' && mode !== 'laporan' && !isiAwal.trim() && !judulAwal.trim()) { setGalat('Memo masih kosong. Tulis judul atau beberapa poin terlebih dahulu.'); return; }
    if (mode === 'laporan' && !SUMBER_LAPORAN.some(([k]) => laporan[k])) { setGalat('Pilih minimal satu sumber data laporan.'); return; }
    setMemuat(true);
    setGalat(null);
    setHasil(null);
    try {
      const r = await prosesMemoAi({
        mode, memo_id: memoId, lingkup, judul: judulAwal, isi: isiAwal, instruksi_khusus: instruksi.trim() || undefined,
        laporan: mode === 'laporan' ? laporan : undefined,
      });
      setHasil(r);
      setLihatBeda(false);
      setPakaiJudul(Boolean(r.judul_usulan) || (mode === 'kembangkan' && !judulAwal.trim()));
      setPakaiRingkasan(Boolean(r.ringkasan) && !ringkasanAwal.trim());
      setTeksRingkasan(r.ringkasan ?? '');
      setTugas((r.tugas ?? []).map((t) => ({ ...t, pilih: !t.sudah_ada })));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memproses dengan AI.');
    } finally {
      setMemuat(false);
      muatKuota();
    }
  };

  const teksTugas = useMemo(() => tugas.filter((t) => t.pilih && t.teks.trim()).map(barisTugasAi).join('\n'), [tugas]);
  const isiHasil = mode === 'ekstrak_tugas' ? teksTugas : hasil?.isi ?? '';
  const beda = useMemo(() => (lihatBeda && hasil?.isi ? bedaBaris(isiAwal, hasil.isi) : []), [lihatBeda, hasil, isiAwal]);

  const salin = async () => {
    const t = mode === 'ringkas' ? teksRingkasan : isiHasil;
    try { await navigator.clipboard.writeText(t); notify('HASIL AI DISALIN'); } catch { notify('GAGAL MENYALIN'); }
  };
  const terapkan = (jenis: 'ganti' | 'tambah' | 'ringkasan') => {
    const judul = pakaiJudul && adaJudulBaru ? judulBaru : undefined;
    const ringkasan = pakaiRingkasan && teksRingkasan.trim() ? teksRingkasan.trim() : undefined;
    if (jenis === 'ringkasan') { onTerapkan({ jenis, ringkasan: teksRingkasan.trim(), judul }); return; }
    if (!isiHasil.trim()) { notify('TIDAK ADA YANG DISISIPKAN'); return; }
    if (jenis === 'ganti') onTerapkan({ jenis, isi: isiHasil, judul, ringkasan });
    else onTerapkan({ jenis, isi: isiHasil, bagian: mode === 'ekstrak_tugas' ? 'Tindak lanjut' : undefined, judul, ringkasan });
  };
  const ubahTugas = (i: number, patch: Partial<TugasAi & { pilih: boolean }>) => setTugas((d) => d.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="fixed inset-0 z-[130] bg-black/90 flex items-stretch sm:items-center justify-center sm:p-4" onClick={onTutup}>
      <div className="retro-box !bg-zinc-900 w-full max-w-3xl border-purple-500 flex flex-col max-h-full sm:max-h-[92vh] overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Asisten AI memo">
        <div className="flex items-center gap-2 border-b-2 border-purple-500/40 pb-2 shrink-0">
          <span className="p-1.5 bg-purple-700 border border-purple-400"><Sparkles size={16} className="text-yellow-300" /></span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[14px] font-bold text-white uppercase">Asisten Memo <span className="text-[11px] text-purple-300 font-mono normal-case">Gemini</span></h3>
            <p className="text-[11px] text-zinc-400 truncate">
              Paham format memo, tim, PICA terbuka, dan tanggal hari ini. Hasil selalu dipratinjau dulu.
              {kuota?.tercatat ? ` · sisa kuota hari ini ${kuota.sisa}/${kuota.batas}` : ''}
            </p>
          </div>
          <button type="button" onClick={onTutup} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup"><X size={15} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-3 space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1" role="tablist" aria-label="Mode AI">
            {MODE.map((m) => {
              const Ikon = m.ikon;
              return (
                <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => { setMode(m.id); setHasil(null); setGalat(null); }} className={`flex flex-col items-center gap-0.5 py-1.5 border-2 text-[11px] font-bold ${mode === m.id ? 'border-purple-400 bg-purple-700/40 text-white' : 'border-white/10 text-zinc-400 hover:text-white'}`}>
                  <Ikon size={15} />{m.label}
                </button>
              );
            })}
          </div>
          <p className="text-[12px] text-zinc-300">{def.ket}</p>

          {mode === 'laporan' && (
            <div className="border-2 border-white/10 p-2 space-y-1.5">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {SUMBER_LAPORAN.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5 text-[13px] text-zinc-200 cursor-pointer">
                    <input type="checkbox" checked={Boolean(laporan[k])} onChange={(e) => setLaporan({ ...laporan, [k]: e.target.checked })} className="accent-purple-500" /> {label}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[12px] text-zinc-400">
                Periode
                <select value={laporan.periode} onChange={(e) => setLaporan({ ...laporan, periode: e.target.value as 'minggu' | 'bulan' })} className="input-retro !py-0.5 !text-[12px] !w-auto">
                  <option value="minggu">7 hari terakhir</option>
                  <option value="bulan">Bulan ini</option>
                </select>
              </label>
            </div>
          )}

          <div>
            <textarea
              value={instruksi}
              onChange={(e) => setInstruksi(e.target.value)}
              rows={2}
              placeholder={mode === 'tulis' ? 'Apa yang harus ditulis AI? mis. "Buat notulen rapat dari catatan di atas"' : 'Instruksi tambahan (opsional), mis. "fokus ke nursery, tenggat minggu ini"'}
              className="input-retro !py-1.5 !text-[13px] resize-none"
              aria-label="Instruksi untuk AI"
            />
            {mode === 'tulis' && (
              <div className="flex flex-wrap gap-1 mt-1">
                {CONTOH_TULIS.map((c) => <button key={c} type="button" onClick={() => setInstruksi(c)} className="px-2 py-0.5 border border-white/15 text-[11px] text-zinc-300 hover:border-purple-400">{c}</button>)}
              </div>
            )}
          </div>

          <button type="button" onClick={() => { void proses(); }} disabled={memuat} className="btn-retro w-full justify-center !bg-purple-700 text-white font-bold flex items-center gap-2 disabled:opacity-60">
            {memuat ? <><Loader2 size={15} className="animate-spin" /> AI sedang bekerja…</> : <><Sparkles size={15} /> Proses dengan AI</>}
          </button>

          {galat && <p className="text-[12px] text-red-300 border-2 border-red-500/50 bg-red-950/40 px-2 py-1.5">{galat}</p>}

          {hasil && (
            <div className="space-y-2 border-t-2 border-white/10 pt-3">
              {hasil.catatan_ai && <p className="text-[12px] text-purple-200 flex gap-1.5"><Sparkles size={12} className="mt-0.5 shrink-0" />{hasil.catatan_ai}</p>}

              {adaJudulBaru && (
                <label className="flex items-start gap-2 text-[13px] text-zinc-200 cursor-pointer">
                  <input type="checkbox" checked={pakaiJudul} onChange={(e) => setPakaiJudul(e.target.checked)} className="mt-1 accent-purple-500" />
                  <span>Ganti judul jadi <b className="text-white">{judulBaru}</b></span>
                </label>
              )}

              {/* Ringkasan: mode Ringkas (utama) atau ikut Kembangkan */}
              {(mode === 'ringkas' || ((mode === 'kembangkan' || mode === 'laporan') && hasil.ringkasan)) && (
                <div>
                  {(mode === 'kembangkan' || mode === 'laporan') && (
                    <label className="flex items-center gap-2 text-[13px] text-zinc-200 cursor-pointer mb-1">
                      <input type="checkbox" checked={pakaiRingkasan} onChange={(e) => setPakaiRingkasan(e.target.checked)} className="accent-purple-500" />
                      Isi kolom Ringkasan{ringkasanAwal.trim() ? ' (menggantikan yang ada)' : ''}
                    </label>
                  )}
                  <textarea value={teksRingkasan} onChange={(e) => setTeksRingkasan(e.target.value)} rows={3} className="input-retro !py-1.5 !text-[13px] resize-none" aria-label="Ringkasan" />
                </div>
              )}

              {/* Tugas: bisa disunting satu per satu */}
              {mode === 'ekstrak_tugas' && (
                <div className="space-y-1.5">
                  {tugas.length === 0 && <p className="text-[12px] text-zinc-500">AI tidak menemukan tugas baru.</p>}
                  {tugas.map((t, i) => (
                    <div key={i} className={`border-2 p-1.5 ${t.pilih ? 'border-purple-500/50' : 'border-white/10 opacity-60'}`}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={t.pilih} onChange={(e) => ubahTugas(i, { pilih: e.target.checked })} className="mt-2 accent-purple-500" aria-label="Pakai tugas ini" />
                        <input value={t.teks} onChange={(e) => ubahTugas(i, { teks: e.target.value.replace(/[@#]/g, '') })} className="input-retro !py-1 !text-[13px] flex-1 min-w-0" aria-label="Uraian tugas" />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 pl-6">
                        <input type="date" value={t.tanggal} onChange={(e) => ubahTugas(i, { tanggal: e.target.value })} className="input-retro !py-0.5 !text-[12px] !w-auto" aria-label="Tenggat" />
                        {t.tanggal && <input type="time" value={t.jam} onChange={(e) => ubahTugas(i, { jam: e.target.value })} className="input-retro !py-0.5 !text-[12px] !w-auto" aria-label="Jam" />}
                        {lingkup === 'tim' && (
                          <select value={t.pic} onChange={(e) => ubahTugas(i, { pic: e.target.value })} className="input-retro !py-0.5 !text-[12px] !w-auto" aria-label="Penanggung jawab">
                            <option value="">Tanpa PIC</option>
                            {tim.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
                          </select>
                        )}
                        {t.pica && <span className="px-1.5 border border-amber-400/60 text-amber-200 text-[11px] font-bold">#{t.pica}</span>}
                        {t.sudah_ada && <span className="text-[11px] text-zinc-400">sudah ada di memo</span>}
                      </div>
                      {t.alasan && <p className="pl-6 mt-0.5 text-[11px] text-zinc-500">{t.alasan}</p>}
                    </div>
                  ))}
                  {tugas.some((t) => t.pic && t.tanggal && t.pilih) && (
                    <p className="text-[11px] text-amber-200/90">Tugas bertenggat dengan PIC masuk Jadwal dan membunyikan alarm di HP orang itu — pastikan PIC-nya benar.</p>
                  )}
                </div>
              )}

              {/* Pratinjau isi: tampilan memo sungguhan atau perbedaan per baris */}
              {(mode === 'kembangkan' || mode === 'rapikan' || mode === 'tulis' || mode === 'laporan') && hasil.isi && (
                <div>
                  {mode !== 'tulis' && mode !== 'laporan' && (
                    <div className="flex gap-1 mb-1">
                      <button type="button" onClick={() => setLihatBeda(false)} className={`px-2 py-0.5 border text-[11px] ${!lihatBeda ? 'border-purple-400 text-white' : 'border-white/15 text-zinc-400'}`}>Pratinjau</button>
                      <button type="button" onClick={() => setLihatBeda(true)} className={`px-2 py-0.5 border text-[11px] flex items-center gap-1 ${lihatBeda ? 'border-purple-400 text-white' : 'border-white/15 text-zinc-400'}`}><GitCompare size={11} /> Perbedaan</button>
                    </div>
                  )}
                  <div className="max-h-[42vh] overflow-y-auto custom-scrollbar border-2 border-white/10 bg-black/30 px-3 py-2 text-[14px] leading-[1.5]">
                    {lihatBeda
                      ? beda.map((d, i) => (
                        <div key={i} className={`font-mono text-[12px] whitespace-pre-wrap ${d.t === 'tambah' ? 'bg-lime-900/40 text-lime-200' : d.t === 'hapus' ? 'bg-red-950/50 text-red-300 line-through' : 'text-zinc-500'}`}>
                          {d.t === 'tambah' ? '+ ' : d.t === 'hapus' ? '− ' : '  '}{d.v || ' '}
                        </div>
                      ))
                      : <IsiMemo isi={hasil.isi} tim={tim} kosong="AI tidak menghasilkan isi." />}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {mode === 'ringkas' && (
                  <button type="button" onClick={() => terapkan('ringkasan')} disabled={!teksRingkasan.trim()} className="btn-retro btn-retro-sm !bg-purple-700 text-white font-bold">Pakai ringkasan</button>
                )}
                {mode === 'ekstrak_tugas' && (
                  <button type="button" onClick={() => terapkan('tambah')} disabled={!teksTugas} className="btn-retro btn-retro-sm !bg-purple-700 text-white font-bold">
                    Tambahkan {tugas.filter((t) => t.pilih && t.teks.trim()).length} tugas ke “Tindak lanjut”
                  </button>
                )}
                {(mode === 'kembangkan' || mode === 'rapikan') && (
                  <button type="button" onClick={() => terapkan('ganti')} className="btn-retro btn-retro-sm !bg-purple-700 text-white font-bold">Ganti isi memo</button>
                )}
                {(mode === 'kembangkan' || mode === 'tulis' || mode === 'laporan') && (
                  <button type="button" onClick={() => terapkan('tambah')} className={`btn-retro btn-retro-sm ${mode !== 'kembangkan' ? '!bg-purple-700 text-white font-bold' : '!bg-zinc-700 text-zinc-100'}`}>Tambah di bawah memo</button>
                )}
                {(mode === 'tulis' || mode === 'laporan') && (
                  <button type="button" onClick={() => terapkan('ganti')} className="btn-retro btn-retro-sm !bg-zinc-700 text-zinc-100">Ganti isi memo</button>
                )}
                <button type="button" onClick={() => { void salin(); }} className="btn-retro btn-retro-sm !bg-zinc-800 text-zinc-200 flex items-center gap-1"><Copy size={12} /> Salin</button>
              </div>
              <p className="text-[11px] text-zinc-500">Semua penerapan bisa diurungkan dari halaman memo.{hasil.model ? ` · ${hasil.model}` : ''}</p>
            </div>
          )}

          {kelola && kuota?.tim_bulan_ini && kuota.tim_bulan_ini.length > 0 && (
            <details className="border-t-2 border-white/10 pt-2 text-[12px] text-zinc-300">
              <summary className="cursor-pointer text-zinc-400">Pemakaian AI tim bulan ini</summary>
              <table className="w-full mt-1">
                <tbody>
                  {kuota.tim_bulan_ini.map((t) => (
                    <tr key={t.user_id} className="border-b border-white/5">
                      <td className="py-0.5">{t.nama ?? t.user_id}</td>
                      <td className="py-0.5 text-right tabular-nums">{t.permintaan} permintaan</td>
                      <td className="py-0.5 text-right tabular-nums text-zinc-500">{Math.round((t.token ?? 0) / 1000)}rb token{t.gagal ? ` · ${t.gagal} gagal` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};
