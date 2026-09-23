import React, { useState } from 'react';
import { User, Key, LogIn, Trees, Wifi, AlertTriangle, Loader2, Settings, Globe, Ticket, PlayCircle } from 'lucide-react';
import { api, GalatApi, simpanToken, ambilServer, simpanServer, SERVER_BAWAAN, aktifkanDemo, matikanDemo } from '../lib/api';
import type { Pengguna } from '../lib/tipe-api';

/** Versi uji menampilkan tombol demo dan pengaturan alamat server; APK produksi tidak. */
const MODE_UJI = import.meta.env.VITE_DEMO !== '0';

/**
 * Layar masuk. Password lewat body POST; akun dibuat Admin di menu TEAM;
 * anggota membuat password sendiri saat login pertama dengan kode undangan.
 */

interface AuthScreenProps {
  onMasuk: (pengguna: Pengguna) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onMasuk }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [kodeUndangan, setKodeUndangan] = useState('');
  const [perluKode, setPerluKode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [server, setServer] = useState(ambilServer());

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) return;
    setLoading(true);
    setError(null);
    try {
      const d = await api<{ token: string; pengguna: Pengguna }>('/api/auth/login', {
        body: { userId: userId.trim().toLowerCase(), password, kodeUndangan: kodeUndangan || undefined },
      });
      simpanToken(d.token);
      onMasuk(d.pengguna);
    } catch (err) {
      if (err instanceof GalatApi) {
        if (err.data.perluKodeUndangan) setPerluKode(true);
        setError(err.status === 0 ? `${err.message} Server: ${ambilServer()}` : err.message);
      } else {
        setError('Gangguan koneksi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const masukDemo = async () => {
    setLoading(true);
    setError(null);
    aktifkanDemo();
    try {
      const d = await api<{ token: string; pengguna: Pengguna }>('/api/auth/login', { body: { userId: 'agung', password: 'demo-demo' } });
      simpanToken(d.token);
      onMasuk(d.pengguna);
    } catch (err) {
      matikanDemo();
      setError(err instanceof Error ? err.message : 'Demo gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none"><div className="garden-bg w-full h-full" /></div>

      {MODE_UJI && (
        <button onClick={() => setShowSettings(!showSettings)} className="absolute top-4 right-4 z-20 btn-ikon bg-zinc-800 text-yellow-400" title="Pengaturan server">
          <Settings size={18} className={showSettings ? 'rotate-90' : ''} />
        </button>
      )}

      <div className="retro-box !bg-zinc-900 w-full max-w-md border-yellow-500 !p-6 md:!p-8 z-10 max-h-[95vh] overflow-auto custom-scrollbar">
        {showSettings ? (
          <div className="space-y-5">
            <div className="text-center">
              <Globe size={32} className="mx-auto text-cyan-400 mb-2" />
              <h2 className="judul-layar text-white">Server</h2>
              <p className="text-[12px] text-zinc-400 mt-1">Alamat Worker Cloudflare</p>
            </div>
            <div>
              <label className="label-retro">Alamat server</label>
              <input type="text" value={server} onChange={(e) => setServer(e.target.value)} className="input-retro font-mono text-cyan-300" placeholder={SERVER_BAWAAN} />
              <p className="text-[12px] text-zinc-400 leading-relaxed mt-2 panel-retro">
                Uji di komputer: <code>http://localhost:8787</code><br />
                Produksi: <code>https://pokemonkey-api.&lt;akun&gt;.workers.dev</code><br />
                Ponsel di Wi-Fi yang sama: <code>http://&lt;ip-komputer&gt;:8787</code>
              </p>
            </div>
            <button onClick={() => { simpanServer(server); setShowSettings(false); setError(null); }} className="btn-retro bg-cyan-700 w-full">Simpan &amp; kembali</button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="inline-block p-4 bg-yellow-500 border-4 border-black mb-4 animate-bounce"><Trees size={40} className="text-black" /></div>
              <h1 className="font-title text-[13px] md:text-[15px] text-yellow-400 mb-2">POKEMONKEY</h1>
              <p className="text-[12px] text-zinc-300 uppercase tracking-widest">Rev &amp; Rehab · Sistem Kerja Tim</p>
            </div>

            {error && (
              <div className="bg-red-950/50 border-2 border-red-500 p-3 mb-5 flex items-start gap-3 text-[13px] text-red-200">
                <AlertTriangle size={18} className="shrink-0 text-red-400" /><span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="label-retro flex items-center gap-1.5"><User size={12} /> User ID</label>
                <input type="text" required autoCapitalize="none" autoComplete="username" value={userId} onChange={(e) => setUserId(e.target.value)} className="input-retro text-[16px]" placeholder="contoh: agung" />
              </div>
              <div>
                <label className="label-retro flex items-center gap-1.5"><Key size={12} /> Password</label>
                <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-retro text-[16px]" placeholder="••••••••" />
              </div>
              {perluKode && (
                <div>
                  <label className="label-retro !text-yellow-300 flex items-center gap-1.5"><Ticket size={12} /> Kode undangan</label>
                  <input type="text" value={kodeUndangan} onChange={(e) => setKodeUndangan(e.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} className="input-retro !border-yellow-500 text-[16px]" placeholder="dari Admin" />
                  <p className="text-[12px] text-zinc-400 mt-1">Login pertama: password yang Anda ketik menjadi password akun.</p>
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-retro bg-yellow-600 w-full !py-3 text-[14px]">
                {loading ? <Loader2 size={20} className="animate-spin" /> : <><LogIn size={18} /> Masuk</>}
              </button>
            </form>

            <div className="mt-6 border-t-2 border-white/10 pt-5 space-y-3">
              {MODE_UJI && <button type="button" onClick={masukDemo} disabled={loading} className="btn-retro bg-purple-700 w-full"><PlayCircle size={16} /> Lihat demo (tanpa server)</button>}
              <p className="text-[12px] text-zinc-400 leading-relaxed text-center">{MODE_UJI ? 'Demo memuat 10 PICA periode 26W36, tim, roster, jadwal, dan memo contoh di browser ini saja. ' : 'Login pertama: isi user ID, buat password baru, lalu masukkan kode undangan dari Admin. '}Belum punya akun? Minta Admin membuatkannya di menu TEAM.</p>
            </div>
          </>
        )}

        <div className="mt-5 flex items-center justify-center gap-2 opacity-40">
          <Wifi size={12} className="text-emerald-400" />
          <span className="text-[11px] uppercase tracking-widest">Cloudflare Link v4</span>
        </div>
      </div>
    </div>
  );
};
