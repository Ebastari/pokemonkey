import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Users, Trophy, BrainCircuit, Globe, RefreshCcw, Wifi, Star, UserPlus, Phone, X, AlertTriangle, KeyRound, Mail } from 'lucide-react';
import { api, GalatApi } from '../lib/api';
import type { AnggotaTim, Pengguna } from '../lib/tipe-api';
import { PanelAnggota } from './PanelAnggota';
import { PanelHatiMati } from './PanelHatiMati';
import { hatiAktif } from '../lib/hati';
import { AvatarAnggota } from './AvatarAnggota';
import type { AwalPesan } from './KotakSurat';

interface Peringkat { id: string; name: string; xp: number; level: number; totalHa: number; lastActive: string | null }
interface Props {
  pengguna: Pengguna; onBootUlang: () => void; notify: (pesan: string) => void;
  /** Tulis pesan Kotak Surat ke anggota (ikon amplop). */
  onTulisPesan?: (awal: AwalPesan) => void;
}

const PERAN_LABEL: Record<string, string> = { admin: 'Admin', supervisor: 'Supervisor', anggota: 'Anggota', pemantau: 'Pemantau' };

export const TeamScreen: React.FC<Props> = ({ pengguna, onBootUlang, notify, onTulisPesan }) => {
  const [tim, setTim] = useState<AnggotaTim[]>([]);
  const [peringkat, setPeringkat] = useState<Peringkat[]>([]);
  const [loading, setLoading] = useState(false);
  const [formBuka, setFormBuka] = useState(false);
  const [anggotaTerpilih, setAnggotaTerpilih] = useState<{ id: string; nama: string } | null>(null);
  const admin = pengguna.peran === 'admin';

  const muat = useCallback(async () => {
    setLoading(true);
    try {
      const [t, p] = await Promise.all([api<{ tim: AnggotaTim[] }>('/api/tim'), api<{ peringkat: Peringkat[] }>('/api/peringkat')]);
      setTim(t.tim); setPeringkat(p.peringkat);
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT TIM'); }
    finally { setLoading(false); }
  }, [notify]);
  useEffect(() => { muat(); }, [muat]);

  const globalTotal = useMemo(() => peringkat.reduce((acc, m) => acc + m.totalHa, 0), [peringkat]);
  const totalTelat = useMemo(() => tim.reduce((a, t) => a + t.pica_telat, 0), [tim]);
  const tanpaWa = useMemo(() => tim.filter((t) => !t.punya_wa), [tim]);

  const aiAdvice = useMemo(() => {
    if (tim.length === 0) return 'Uu-aa! Menyiapkan data tim...';
    const terberat = [...tim].sort((a, b) => b.pica_terbuka - a.pica_terbuka)[0];
    if (totalTelat >= 5) return `UU-AA! ${totalTelat} PICA sudah lewat tenggat! Bahas di rapat mingguan, jangan ditumpuk.`;
    if (terberat && terberat.pica_terbuka >= 5) return `${terberat.nama} memegang ${terberat.pica_terbuka} PICA terbuka. Bagi beban sebelum menumpuk!`;
    if (tanpaWa.length > 0) return `${tanpaWa.length} anggota belum punya nomor WA — pengingat tidak sampai ke mereka.`;
    if (totalTelat > 0) return `${totalTelat} PICA lewat tenggat. Sedikit lagi bersih, ayo tutup dengan bukti!`;
    return 'Semua PICA masih dalam tenggat. Jaga ritmenya, uu-aa!';
  }, [tim, totalTelat, tanpaWa]);

  /** Admin: kosongkan password anggota yang lupa/salah membuat password; sesi lamanya ikut dicabut. */
  const resetPassword = async (t: AnggotaTim) => {
    if (!confirm(`Reset password ${t.nama}? Ia akan membuat password baru saat login berikutnya dengan kode undangan.`)) return;
    try {
      const d = await api<{ pesan: string }>(`/api/tim/${t.id}/reset-password`, { method: 'POST', body: {} });
      notify(d.pesan.toUpperCase());
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };

  const ubahWa = async (t: AnggotaTim) => {
    const wa = prompt(`Nomor WhatsApp ${t.nama} (mis. 0812…):`);
    if (wa === null) return;
    try { await api(`/api/tim/${t.id}`, { method: 'PATCH', body: { wa } }); notify('NOMOR WA DISIMPAN'); muat(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };

  return (
    <div className="p-3 flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center border-b-4 border-white pb-2 mb-3">
        <h2 className="judul-layar flex items-center gap-2"><Users size={16} /> Team Network</h2>
        <div className="flex gap-2">
          {admin && <button onClick={() => setFormBuka(true)} className="btn-ikon bg-emerald-600" title="Tambah anggota"><UserPlus size={16} /></button>}
          <button disabled={loading} onClick={muat} className="btn-ikon bg-indigo-600"><RefreshCcw size={16} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {(admin || pengguna.peran === 'supervisor') && hatiAktif() && <PanelHatiMati notify={notify} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 overflow-auto custom-scrollbar pb-4">
        <div className="space-y-3">
          <div className="retro-box !bg-indigo-900/40 border-indigo-400">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-[13px] font-bold text-indigo-200 uppercase flex items-center gap-2"><Globe size={14} /> Global Progress</h3>
              <span className="chip-retro border-white bg-white text-indigo-900">150 Ha target</span>
            </div>
            <div className="h-6 bg-black border-4 border-white overflow-hidden relative mb-2">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, (globalTotal / 150) * 100)}%` }} />
              <span className="absolute inset-0 flex items-center justify-center text-[12px] font-bold mix-blend-difference">{((globalTotal / 150) * 100).toFixed(1)}%</span>
            </div>
            <p className="text-[12px] text-indigo-100 text-center uppercase">Total kontribusi tim: {globalTotal.toFixed(2)} Ha</p>
          </div>

          <div className="retro-box !bg-black/80 border-cyan-500 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-10 pointer-events-none"><BrainCircuit size={80} className="text-cyan-400" /></div>
            <h3 className="text-[12px] font-bold text-cyan-300 uppercase mb-2 flex items-center gap-2"><span className="w-2 h-2 bg-cyan-400 animate-ping" /> Shift Genius</h3>
            <div className="bg-cyan-950/40 p-3 border border-cyan-500/40"><p className="text-[14px] leading-relaxed text-white italic">"{aiAdvice}"</p></div>
            <p className="text-[11px] text-zinc-400 mt-2 uppercase">Dihitung dari beban PICA dan tenggat saat ini.</p>
          </div>

          <div className="retro-box !bg-zinc-900/80 border-amber-500">
            <h3 className="text-[13px] font-bold text-amber-300 uppercase mb-3 flex items-center gap-2"><AlertTriangle size={14} /> Beban PICA</h3>
            <div className="space-y-2">
              {tim.map((t) => (
                <div key={t.id} className={`flex items-center justify-between p-2.5 border-2 ${t.id === pengguna.id ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-black/40 hover:bg-white/5 transition-colors'}`}>
                  <button type="button" onClick={() => setAnggotaTerpilih({ id: t.id, nama: t.nama })} className="mr-2.5" aria-label={`Profil ${t.nama}`}>
                    <AvatarAnggota foto={t.foto} skinId={t.skin_aktif} ukuran={40} />
                  </button>
                  <div
                    className="min-w-0 flex-1 cursor-pointer"
                    onClick={() => setAnggotaTerpilih({ id: t.id, nama: t.nama })}
                    title="Klik untuk melihat detail profil & progres"
                  >
                    <p className="text-[14px] font-bold text-white truncate hover:text-yellow-300 transition-colors flex items-center gap-1.5">
                      {t.nama}
                      {t.id === pengguna.id && <span className="chip-retro !text-[8px] border-amber-400 bg-amber-900 text-amber-200">SAYA</span>}
                    </p>
                    <p className="text-[11px] text-zinc-400 uppercase">{PERAN_LABEL[t.peran] ?? t.peran}{t.bidang ? ` · ${t.bidang}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <div
                      className="text-right leading-tight cursor-pointer"
                      onClick={() => setAnggotaTerpilih({ id: t.id, nama: t.nama })}
                    >
                      <p className="text-[14px] font-bold text-white">{t.pica_terbuka} <span className="text-[10px] text-zinc-400 font-normal">TERBUKA</span></p>
                      {t.pica_telat > 0 && <p className="text-[11px] text-red-400 uppercase font-bold">{t.pica_telat} telat</p>}
                    </div>
                    {onTulisPesan && t.id !== pengguna.id && (
                      <button onClick={() => onTulisPesan({ penerima: [t.id] })} title={`Kirim pesan ke ${t.nama}`} aria-label={`Kirim pesan ke ${t.nama}`} className="p-1.5 border-2 border-cyan-500 text-cyan-300 hover:bg-cyan-500/20">
                        <Mail size={13} />
                      </button>
                    )}
                    {admin && t.id !== pengguna.id && (
                      <button onClick={() => resetPassword(t)} title={`Reset password ${t.nama}`} aria-label={`Reset password ${t.nama}`} className="p-1.5 border-2 border-amber-500 text-amber-400 hover:bg-amber-500/20">
                        <KeyRound size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => (admin || t.id === pengguna.id ? ubahWa(t) : setAnggotaTerpilih({ id: t.id, nama: t.nama }))}
                      title={t.punya_wa ? 'Nomor WA terpasang - Klik untuk chat/ubah' : 'Belum ada nomor WA'}
                      className={`p-1.5 border-2 ${t.punya_wa ? 'border-emerald-500 text-emerald-400 hover:bg-emerald-500/20' : 'border-red-500 text-red-400 animate-pulse'}`}
                    >
                      <Phone size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="retro-box !bg-zinc-900/80 border-yellow-500 flex flex-col min-h-[300px]">
          <h3 className="text-[13px] font-bold text-yellow-300 uppercase mb-3 flex items-center gap-2"><Trophy size={14} /> Forester Ranking</h3>
          <div className="space-y-2 overflow-auto custom-scrollbar pr-1 flex-1">
            {peringkat.length > 0 ? peringkat.map((member, idx) => (
              <div
                key={member.id}
                onClick={() => setAnggotaTerpilih({ id: member.id, nama: member.name })}
                className={`flex items-center justify-between p-2.5 border-2 cursor-pointer hover:bg-white/10 transition-colors ${member.id === pengguna.id ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 bg-black/40'}`}
                title="Klik untuk melihat detail profil"
              >
                <div className="flex items-center gap-3">
                  <span className="font-title text-[11px] text-zinc-400 w-6">#{idx + 1}</span>
                  {(() => { const a = tim.find((x) => x.id === member.id); return <AvatarAnggota foto={a?.foto} skinId={a?.skin_aktif} ukuran={32} />; })()}
                  <div>
                    <p className="text-[14px] font-bold text-white hover:text-yellow-300 transition-colors">{member.name}</p>
                    <p className="text-[11px] text-zinc-400 uppercase">Level {member.level} · {member.lastActive ? 'aktif' : 'belum aktif'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-bold text-yellow-300 flex items-center gap-1 justify-end">{member.xp.toLocaleString('id-ID')} <Star size={12} fill="currentColor" /></p>
                  <p className="text-[11px] text-emerald-300 uppercase">{member.totalHa.toFixed(2)} Ha</p>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center p-10 opacity-50 text-center h-full"><Wifi size={32} className="mb-2 animate-pulse" /><p className="text-[12px] uppercase">Menghubungkan…</p></div>
            )}
          </div>
        </div>
      </div>

      {formBuka && <FormAnggota onTutup={() => setFormBuka(false)} onSimpan={(pesan) => { setFormBuka(false); notify(pesan.toUpperCase()); muat(); onBootUlang(); }} />}

      {anggotaTerpilih && (
        <PanelAnggota
          userId={anggotaTerpilih.id}
          nama={anggotaTerpilih.nama}
          pengguna={pengguna}
          notify={notify}
          onTutup={() => setAnggotaTerpilih(null)}
          onTulisPesan={onTulisPesan}
        />
      )}
    </div>
  );
};

const FormAnggota: React.FC<{ onTutup: () => void; onSimpan: (pesan: string) => void }> = ({ onTutup, onSimpan }) => {
  const [f, setF] = useState({ id: '', nama: '', jabatan: '', bidang: '', wa: '', peran: 'anggota' });
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const simpan = async () => {
    setMenyimpan(true); setGalat(null);
    try { const d = await api<{ pesan: string }>('/api/tim', { body: f }); onSimpan(d.pesan); }
    catch (e) { setGalat(e instanceof GalatApi ? e.message : 'Gagal menyimpan.'); }
    finally { setMenyimpan(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3" onClick={onTutup}>
      <div className="retro-box !bg-zinc-900 w-full max-w-sm border-emerald-500 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b-2 border-white/20 pb-2"><h3 className="judul-layar text-emerald-300">Anggota baru</h3><button onClick={onTutup} className="text-zinc-400 hover:text-white"><X size={20} /></button></div>
        {galat && <p className="text-[12px] text-red-200 bg-red-950/50 border border-red-500 p-2">{galat}</p>}
        <div><label className="label-retro">Nama lengkap</label><input autoFocus value={f.nama} onChange={(e) => setF({ ...f, nama: e.target.value, id: f.id || e.target.value.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '') })} className="input-retro" /></div>
        <div><label className="label-retro">User ID (huruf kecil, untuk login)</label><input value={f.id} onChange={(e) => setF({ ...f, id: e.target.value.toLowerCase() })} className="input-retro font-mono" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label-retro">Jabatan</label><input value={f.jabatan} onChange={(e) => setF({ ...f, jabatan: e.target.value })} className="input-retro" /></div>
          <div><label className="label-retro">Bidang</label><input value={f.bidang} onChange={(e) => setF({ ...f, bidang: e.target.value })} className="input-retro" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label-retro">Nomor WA</label><input value={f.wa} onChange={(e) => setF({ ...f, wa: e.target.value })} className="input-retro" placeholder="0812…" /></div>
          <div><label className="label-retro">Peran</label><select value={f.peran} onChange={(e) => setF({ ...f, peran: e.target.value })} className="input-retro">{Object.entries(PERAN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <p className="text-[12px] text-zinc-300 leading-relaxed">Anggota membuat password sendiri saat login pertama, dengan kode undangan yang Anda bagikan.</p>
        <button onClick={simpan} disabled={menyimpan || !f.id || !f.nama} className="btn-retro bg-emerald-600 w-full">{menyimpan ? 'Menyimpan…' : 'Buat akun'}</button>
      </div>
    </div>
  );
};
