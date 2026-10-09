import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Mail, X, Inbox, Bell, Send, Loader2, ChevronLeft, Paperclip, AlertTriangle, Reply, Archive, CheckCheck, ClipboardList,
  NotebookPen, ExternalLink, FileText, TrendingUp, Plus,
} from 'lucide-react';
import { api } from '../lib/api';
import type { AnggotaRingkas, Pengguna } from '../lib/tipe-api';
import { AvatarAnggota } from './AvatarAnggota';
import { PenampilBerkas } from './PenampilBerkas';

/**
 * Kotak Surat — pesan antar anggota (seperti email) dan pemberitahuan sistem.
 * Dibuka dari kotak surat di KEBUN, MENU, atau tombol amplop di TEAM.
 */

export interface TautanSurat { jenis: 'pica' | 'memo' | 'tab'; id: string; label?: string }
interface BerkasPesan { nama: string; kunci: string }

interface BarisMasuk {
  id: string; pengirim: string; pengirim_nama?: string | null; penerima_nama?: string | null; subjek: string; cuplikan: string;
  jenis: 'pesan' | 'minta_progres' | 'progres'; penting: number; induk_id: string | null; tautan: string | null; dibuat_pada: string; dibaca: number;
}
interface BarisSistem { id: string; jenis: string; judul: string; isi: string | null; tautan: string | null; penting: number; dibuat_pada: string; dibaca_pada: string | null }
interface PesanUtas {
  id: string; pengirim: string; pengirim_nama: string | null; subjek: string; isi: string; jenis: string; penting: number; induk_id: string | null;
  tautan: string | null; lampiran: string | null; dibuat_pada: string; penerima: { id: string; nama: string | null; dibaca_pada: string | null }[];
}

const bacaTautan = (s: string | null | undefined): TautanSurat | null => { try { return s ? JSON.parse(s) as TautanSurat : null; } catch { return null; } };
const bacaLampiran = (s: string | null | undefined): BerkasPesan[] => { try { return s ? JSON.parse(s) as BerkasPesan[] : []; } catch { return []; } };
const waktu = (iso: string) => {
  const d = new Date(iso);
  const hariIni = new Date().toDateString() === d.toDateString();
  return d.toLocaleString('id-ID', hariIni ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const IKON_SISTEM: Record<string, string> = { pica_baru: '📋', pica_status: '🔄', memo_rahasia: '🔒', prestasi: '🏆', xp: '⭐' };

const LabelTautan: React.FC<{ t: TautanSurat; onBuka: (t: TautanSurat) => void }> = ({ t, onBuka }) => (
  <button type="button" onClick={() => onBuka(t)} className="inline-flex items-center gap-1.5 px-2 py-1 border-2 border-cyan-400/60 bg-cyan-950/40 text-[12px] text-cyan-200 hover:bg-cyan-900/60 max-w-full">
    {t.jenis === 'pica' ? <ClipboardList size={12} /> : t.jenis === 'memo' ? <NotebookPen size={12} /> : <ExternalLink size={12} />}
    <span className="truncate">{t.label || (t.jenis === 'pica' ? t.id : 'Buka')}</span>
  </button>
);

// ---------------------------------------------------------------------------
// Tulis pesan
// ---------------------------------------------------------------------------

export interface AwalPesan {
  penerima?: string[]; subjek?: string; isi?: string; jenis?: 'pesan' | 'minta_progres' | 'progres'; tautan?: TautanSurat | null; induk_id?: string;
}

export const TulisPesan: React.FC<{
  tim: AnggotaRingkas[]; pengguna: Pengguna; awal?: AwalPesan; notify: (m: string) => void; onTutup: () => void; onTerkirim?: () => void;
}> = ({ tim, pengguna, awal, notify, onTutup, onTerkirim }) => {
  const [penerima, setPenerima] = useState<string[]>(awal?.penerima ?? []);
  const [subjek, setSubjek] = useState(awal?.subjek ?? '');
  const [isi, setIsi] = useState(awal?.isi ?? '');
  const [penting, setPenting] = useState(false);
  const [lampiran, setLampiran] = useState<BerkasPesan[]>([]);
  const [mengirim, setMengirim] = useState(false);
  const [mengunggah, setMengunggah] = useState(false);
  const [cari, setCari] = useState('');
  const berkasRef = useRef<HTMLInputElement>(null);
  const jenis = awal?.jenis ?? 'pesan';
  const pilihan = tim.filter((t) => t.id !== pengguna.id && !penerima.includes(t.id) && (!cari || t.nama.toLowerCase().includes(cari.toLowerCase())));

  const unggah = async (f: File) => {
    if (f.size > 8 * 1024 * 1024) { notify('LAMPIRAN MAKSIMAL 8 MB'); return; }
    setMengunggah(true);
    try {
      const form = new FormData();
      form.append('berkas', f, f.name);
      form.append('entitas', 'pesan');
      form.append('entitas_id', pengguna.id);
      const d = await api<{ kunci: string }>('/api/lampiran', { form });
      setLampiran((l) => [...l, { nama: f.name, kunci: d.kunci }]);
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGUNGGAH'); }
    finally { setMengunggah(false); }
  };

  const kirim = async () => {
    if (!awal?.induk_id && penerima.length === 0) { notify('PILIH PENERIMA DULU'); return; }
    if (!isi.trim()) { notify('ISI PESAN MASIH KOSONG'); return; }
    setMengirim(true);
    try {
      await api('/api/surat/pesan', { body: { penerima, subjek, isi, penting, jenis, tautan: awal?.tautan ?? null, induk_id: awal?.induk_id ?? null, lampiran } });
      notify(jenis === 'minta_progres' ? 'PERMINTAAN PROGRES TERKIRIM' : 'PESAN TERKIRIM');
      onTerkirim?.();
      onTutup();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGIRIM'); }
    finally { setMengirim(false); }
  };

  return (
    <div className="fixed inset-0 z-[135] bg-black/85 flex items-end sm:items-center justify-center sm:p-4" onClick={onTutup}>
      <div className="retro-box !bg-zinc-900 border-cyan-500 w-full sm:max-w-lg max-h-[92vh] overflow-auto custom-scrollbar !p-3 flex flex-col gap-2.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b-2 border-white/20 pb-2">
          <Send size={16} className="text-cyan-300" />
          <h3 className="judul-layar text-cyan-200 mr-auto">
            {awal?.induk_id ? 'Balas pesan' : jenis === 'minta_progres' ? 'Minta progres pekerjaan' : jenis === 'progres' ? 'Kirim progres' : 'Pesan baru'}
          </h3>
          <button onClick={onTutup} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup"><X size={15} /></button>
        </div>

        {!awal?.induk_id && (
          <div>
            <label className="label-retro">Kepada</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {penerima.map((id) => {
                const t = tim.find((x) => x.id === id);
                return (
                  <button key={id} type="button" onClick={() => setPenerima((p) => p.filter((x) => x !== id))} className="chip-retro border-cyan-400 bg-cyan-950/60 text-cyan-100 !text-[12px]" title="Hapus penerima">
                    {t?.nama ?? id} <X size={11} />
                  </button>
                );
              })}
            </div>
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama anggota…" className="input-retro !py-1.5 !text-[13px]" />
            {(cari || penerima.length === 0) && (
              <div className="max-h-32 overflow-auto custom-scrollbar border-2 border-white/10 mt-1">
                {pilihan.slice(0, 20).map((t) => (
                  <button key={t.id} type="button" onClick={() => { setPenerima((p) => [...p, t.id]); setCari(''); }} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[13px] hover:bg-white/10">
                    <AvatarAnggota foto={t.foto} ukuran={22} />
                    <span className="flex-1 truncate text-zinc-100">{t.nama}</span>
                    <span className="text-[11px] text-zinc-500">{t.jabatan ?? t.peran}</span>
                  </button>
                ))}
                {pilihan.length === 0 && <p className="px-2 py-1.5 text-[12px] text-zinc-500">Tidak ada nama yang cocok.</p>}
              </div>
            )}
          </div>
        )}

        {awal?.tautan && (
          <p className="text-[12px] text-zinc-300 flex items-center gap-1.5">
            Terkait: <span className="text-cyan-200 font-bold truncate">{awal.tautan.label ?? awal.tautan.id}</span>
          </p>
        )}

        {!awal?.induk_id && (
          <div>
            <label className="label-retro">Subjek</label>
            <input value={subjek} onChange={(e) => setSubjek(e.target.value)} className="input-retro !py-1.5 !text-[13px]" placeholder="Ringkas, mis. Progres penanaman blok B" />
          </div>
        )}
        <div>
          <label className="label-retro">Isi</label>
          <textarea value={isi} onChange={(e) => setIsi(e.target.value)} rows={7} className="input-retro !text-[13px] leading-relaxed resize-y" placeholder="Tulis pesan…" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input ref={berkasRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void unggah(f); e.target.value = ''; }} />
          <button type="button" onClick={() => berkasRef.current?.click()} disabled={mengunggah} className="btn-retro btn-retro-sm bg-zinc-800 flex items-center gap-1.5">
            {mengunggah ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />} Lampiran
          </button>
          <label className="flex items-center gap-1.5 text-[12px] text-amber-200 cursor-pointer" title="Pesan penting langsung berbunyi di HP penerima">
            <input type="checkbox" checked={penting} onChange={(e) => setPenting(e.target.checked)} className="accent-amber-500" />
            <AlertTriangle size={12} /> Penting
          </label>
        </div>
        {lampiran.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {lampiran.map((l) => (
              <span key={l.kunci} className="chip-retro border-white/30 bg-black/40 !text-[11px]"><FileText size={11} /> {l.nama}
                <button type="button" onClick={() => setLampiran((x) => x.filter((y) => y.kunci !== l.kunci))} aria-label="Hapus lampiran"><X size={11} /></button>
              </span>
            ))}
          </div>
        )}
        <p className="text-[11px] text-zinc-500 leading-snug">
          Pesan hanya terlihat oleh pengirim dan penerimanya. {penting ? 'Ditandai penting: langsung berbunyi di HP penerima.' : 'Pesan biasa ikut ringkasan notifikasi 12.00.'}
        </p>
        <button onClick={kirim} disabled={mengirim} className="btn-retro bg-cyan-700 w-full font-bold flex items-center justify-center gap-2">
          {mengirim ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kirim
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Kotak Surat
// ---------------------------------------------------------------------------

type Kotak = 'masuk' | 'sistem' | 'terkirim';

export const KotakSurat: React.FC<{
  pengguna: Pengguna; tim: AnggotaRingkas[]; notify: (m: string) => void; onTutup: () => void;
  onBuka: (t: TautanSurat) => void; onJumlah?: (n: number) => void; tulisAwal?: AwalPesan | null;
}> = ({ pengguna, tim, notify, onTutup, onBuka, onJumlah, tulisAwal }) => {
  const [kotak, setKotak] = useState<Kotak>('masuk');
  const [masuk, setMasuk] = useState<BarisMasuk[] | null>(null);
  const [sistem, setSistem] = useState<BarisSistem[] | null>(null);
  const [terkirim, setTerkirim] = useState<BarisMasuk[] | null>(null);
  const [utas, setUtas] = useState<PesanUtas[] | null>(null);
  const [tulis, setTulis] = useState<AwalPesan | null>(tulisAwal ?? null);
  const [pratinjau, setPratinjau] = useState<BerkasPesan | null>(null);

  const muat = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([
        api<{ surat: BarisMasuk[] }>('/api/surat?kotak=masuk'),
        api<{ surat: BarisSistem[] }>('/api/surat?kotak=sistem'),
        api<{ surat: BarisMasuk[] }>('/api/surat?kotak=terkirim'),
      ]);
      setMasuk(a.surat); setSistem(b.surat); setTerkirim(c.surat);
      onJumlah?.(a.surat.filter((x) => !x.dibaca).length + b.surat.filter((x) => !x.dibaca_pada).length);
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT KOTAK SURAT'); }
  }, [notify, onJumlah]);
  useEffect(() => { void muat(); }, [muat]);

  const bukaUtas = async (id: string) => {
    try {
      const d = await api<{ utas: PesanUtas[] }>(`/api/surat/pesan/${id}`);
      setUtas(d.utas);
      void muat();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUKA PESAN'); }
  };
  const bacaSistem = async (s: BarisSistem) => {
    if (!s.dibaca_pada) { await api(`/api/surat/sistem/${s.id}/baca`, { method: 'POST', body: {} }).catch(() => undefined); void muat(); }
    const t = bacaTautan(s.tautan);
    if (t) { onBuka(t); onTutup(); }
  };
  const bacaSemua = async () => { await api('/api/surat/sistem/baca-semua', { method: 'POST', body: {} }).catch(() => undefined); void muat(); };
  const arsipkan = async (id: string) => { await api(`/api/surat/pesan/${id}/arsip`, { method: 'POST', body: {} }).catch(() => undefined); setUtas(null); void muat(); };
  const progresSaya = async () => {
    try {
      const d = await api<{ subjek: string; isi: string }>('/api/surat/ringkasan-saya');
      const atasan = tim.filter((t) => t.id !== pengguna.id && (t.peran === 'supervisor' || t.peran === 'admin')).map((t) => t.id).slice(0, 3);
      setTulis({ subjek: d.subjek, isi: d.isi, jenis: 'progres', penerima: atasan });
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYUSUN PROGRES'); }
  };

  const belumMasuk = masuk?.filter((x) => !x.dibaca).length ?? 0;
  const belumSistem = sistem?.filter((x) => !x.dibaca_pada).length ?? 0;
  const daftar = kotak === 'masuk' ? masuk : kotak === 'terkirim' ? terkirim : null;
  const akar = utas?.[0];
  const balasKe = useMemo(() => (akar ? { induk_id: akar.id, tautan: bacaTautan(akar.tautan) } : null), [akar]);

  return (
    <div className="fixed inset-0 z-[125] bg-black/85 flex items-center justify-center p-2 sm:p-4" onClick={onTutup}>
      <div className="retro-box !bg-zinc-950 border-4 !border-blue-500 w-full max-w-2xl max-h-[94vh] flex flex-col overflow-hidden !p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b-2 border-blue-500/40 pb-2 shrink-0">
          <div className="w-8 h-8 bg-blue-600 border-2 border-white flex items-center justify-center shrink-0"><Mail size={17} className="text-white" /></div>
          <div className="mr-auto">
            <h2 className="font-title text-[13px] md:text-[15px] text-blue-200 leading-none">KOTAK SURAT</h2>
            <p className="text-[10px] text-zinc-400 uppercase mt-0.5">Pesan tim & pemberitahuan sistem</p>
          </div>
          <button onClick={() => setTulis({})} className="btn-retro btn-retro-sm bg-cyan-700 flex items-center gap-1"><Plus size={12} /> <span className="hidden sm:inline">Pesan baru</span></button>
          <button onClick={onTutup} className="btn-ikon bg-zinc-800 text-zinc-300" aria-label="Tutup"><X size={18} /></button>
        </div>

        {!utas && (
          <div className="flex gap-1.5 py-2 shrink-0 flex-wrap">
            {([['masuk', 'Masuk', <Inbox key="i" size={13} />, belumMasuk], ['sistem', 'Sistem', <Bell key="b" size={13} />, belumSistem], ['terkirim', 'Terkirim', <Send key="s" size={13} />, 0]] as const).map(([k, l, ik, n]) => (
              <button key={k} onClick={() => setKotak(k)} className={`btn-retro btn-retro-sm flex items-center gap-1.5 ${kotak === k ? 'bg-blue-600' : 'bg-zinc-800'}`}>
                {ik} {l}{n > 0 && <span className="min-w-[16px] h-4 px-1 bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">{n}</span>}
              </button>
            ))}
            <button onClick={progresSaya} className="btn-retro btn-retro-sm bg-emerald-700 flex items-center gap-1.5 ml-auto" title="Susun ringkasan kerja hari ini lalu kirim ke atasan"><TrendingUp size={13} /> Kirim progres saya</button>
          </div>
        )}

        <div className="flex-1 overflow-auto custom-scrollbar pr-1">
          {/* ---------- Utas pesan ---------- */}
          {utas && akar && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setUtas(null)} className="btn-retro btn-retro-sm bg-zinc-800 flex items-center gap-1"><ChevronLeft size={12} /> Kembali</button>
                <h3 className="text-[15px] font-bold text-white truncate flex-1">{akar.subjek}</h3>
                {akar.pengirim !== pengguna.id && <button onClick={() => arsipkan(akar.id)} className="btn-ikon !w-8 !h-8 bg-zinc-800" title="Arsipkan"><Archive size={14} /></button>}
              </div>
              {utas.map((p) => {
                const t = bacaTautan(p.tautan);
                const lamp = bacaLampiran(p.lampiran);
                const dari = tim.find((x) => x.id === p.pengirim);
                return (
                  <div key={p.id} className={`border-2 p-3 ${p.pengirim === pengguna.id ? 'border-cyan-500/40 bg-cyan-950/20 ml-4' : 'border-white/15 bg-black/40 mr-4'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <AvatarAnggota foto={dari?.foto} ukuran={26} />
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className="text-[13px] font-bold text-white truncate">{p.pengirim_nama ?? p.pengirim}{p.penting ? <span className="ml-1.5 text-amber-300">⚠ penting</span> : null}</p>
                        <p className="text-[10px] text-zinc-500 truncate">kepada {p.penerima.map((r) => r.nama ?? r.id).join(', ')} · {waktu(p.dibuat_pada)}</p>
                      </div>
                      {p.jenis === 'minta_progres' && <span className="chip-retro !text-[10px] border-amber-400 text-amber-200">minta progres</span>}
                      {p.jenis === 'progres' && <span className="chip-retro !text-[10px] border-emerald-400 text-emerald-200">progres</span>}
                    </div>
                    <p className="text-[13px] text-zinc-100 whitespace-pre-wrap leading-relaxed">{p.isi}</p>
                    {(t || lamp.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {t && <LabelTautan t={t} onBuka={(x) => { onBuka(x); onTutup(); }} />}
                        {lamp.map((l) => (
                          <button key={l.kunci} type="button" onClick={() => setPratinjau(l)} className="inline-flex items-center gap-1.5 px-2 py-1 border-2 border-white/25 bg-white/5 text-[12px] text-zinc-100 hover:border-lime-400">
                            <Paperclip size={12} /> {l.nama}
                          </button>
                        ))}
                      </div>
                    )}
                    {p.jenis === 'minta_progres' && p.pengirim !== pengguna.id && t && (
                      <button onClick={() => { onBuka(t); onTutup(); }} className="btn-retro btn-retro-sm bg-amber-600 text-black font-bold mt-2 flex items-center gap-1.5">
                        <TrendingUp size={12} /> Tulis update PICA — peminta otomatis menerima progresnya
                      </button>
                    )}
                  </div>
                );
              })}
              <button onClick={() => balasKe && setTulis({ induk_id: balasKe.induk_id, tautan: balasKe.tautan })} className="btn-retro bg-cyan-700 w-full flex items-center justify-center gap-2"><Reply size={14} /> Balas</button>
            </div>
          )}

          {/* ---------- Daftar pesan ---------- */}
          {!utas && kotak !== 'sistem' && (
            daftar === null ? <p className="text-[13px] text-zinc-400 flex items-center gap-2 py-8 justify-center"><Loader2 size={14} className="animate-spin" /> Memuat…</p>
              : daftar.length === 0 ? (
                <div className="text-center py-10 text-zinc-400 text-[13px]">
                  <Mail size={36} className="mx-auto mb-2 opacity-40" />
                  {kotak === 'masuk' ? 'Kotak masuk kosong.' : 'Belum ada pesan terkirim.'}
                  <p className="text-[12px] mt-1">Kirim pesan dari tombol <b>Pesan baru</b> atau ikon amplop di TEAM.</p>
                </div>
              ) : (
                <ul className="divide-y divide-white/10 border-2 border-white/10">
                  {daftar.map((m) => {
                    const dari = tim.find((x) => x.id === m.pengirim);
                    return (
                      <li key={m.id}>
                        <button onClick={() => bukaUtas(m.id)} className={`flex w-full items-start gap-2.5 px-2.5 py-2 text-left hover:bg-white/5 ${!m.dibaca ? 'bg-blue-950/40' : ''}`}>
                          <AvatarAnggota foto={dari?.foto} ukuran={32} />
                          <div className="min-w-0 flex-1 leading-tight">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[13px] truncate ${!m.dibaca ? 'font-bold text-white' : 'text-zinc-200'}`}>{kotak === 'terkirim' ? `Ke: ${m.penerima_nama ?? '—'}` : (m.pengirim_nama ?? m.pengirim)}</span>
                              {m.penting ? <AlertTriangle size={11} className="text-amber-300 shrink-0" /> : null}
                              {m.jenis !== 'pesan' && <span className={`text-[9px] uppercase px-1 border ${m.jenis === 'progres' ? 'border-emerald-400 text-emerald-300' : 'border-amber-400 text-amber-300'}`}>{m.jenis === 'progres' ? 'progres' : 'minta progres'}</span>}
                              <span className="ml-auto text-[10px] text-zinc-500 shrink-0">{waktu(m.dibuat_pada)}</span>
                            </div>
                            <p className={`text-[12px] truncate ${!m.dibaca ? 'text-zinc-100' : 'text-zinc-400'}`}>{m.induk_id ? '↩ ' : ''}{m.subjek}</p>
                            <p className="text-[11px] text-zinc-500 truncate">{m.cuplikan}</p>
                          </div>
                          {!m.dibaca && <span className="w-2 h-2 bg-blue-400 mt-1.5 shrink-0" aria-label="Belum dibaca" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )
          )}

          {/* ---------- Pemberitahuan sistem ---------- */}
          {!utas && kotak === 'sistem' && (
            sistem === null ? <p className="text-[13px] text-zinc-400 flex items-center gap-2 py-8 justify-center"><Loader2 size={14} className="animate-spin" /> Memuat…</p>
              : sistem.length === 0 ? <p className="text-center py-10 text-zinc-400 text-[13px]"><Bell size={36} className="mx-auto mb-2 opacity-40" />Belum ada pemberitahuan.</p>
                : (
                  <>
                    {belumSistem > 0 && <button onClick={bacaSemua} className="text-[12px] text-cyan-300 underline mb-2 flex items-center gap-1"><CheckCheck size={12} /> Tandai semua dibaca</button>}
                    <ul className="divide-y divide-white/10 border-2 border-white/10">
                      {sistem.map((s) => (
                        <li key={s.id}>
                          <button onClick={() => bacaSistem(s)} className={`flex w-full items-start gap-2.5 px-2.5 py-2 text-left hover:bg-white/5 ${!s.dibaca_pada ? 'bg-blue-950/40' : ''}`}>
                            <span className="text-[20px] leading-none mt-0.5">{IKON_SISTEM[s.jenis] ?? '📬'}</span>
                            <div className="min-w-0 flex-1 leading-tight">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[13px] ${!s.dibaca_pada ? 'font-bold text-white' : 'text-zinc-200'}`}>{s.judul}</span>
                                <span className="ml-auto text-[10px] text-zinc-500 shrink-0">{waktu(s.dibuat_pada)}</span>
                              </div>
                              {s.isi && <p className="text-[12px] text-zinc-400 mt-0.5">{s.isi}</p>}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )
          )}
        </div>
      </div>

      {tulis && (
        <TulisPesan
          tim={tim}
          pengguna={pengguna}
          awal={tulis}
          notify={notify}
          onTutup={() => setTulis(null)}
          onTerkirim={() => { void muat(); if (tulis.induk_id) void bukaUtas(tulis.induk_id); }}
        />
      )}
      {pratinjau && <PenampilBerkas berkas={pratinjau} onTutup={() => setPratinjau(null)} />}
    </div>
  );
};
