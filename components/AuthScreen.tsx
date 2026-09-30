import React, { useEffect, useState } from 'react';
import { User, Key, ArrowRight, Wifi, AlertTriangle, Loader2, Settings, Globe, Ticket, PlayCircle, Sparkles, Fingerprint, BookOpen } from 'lucide-react';
import {
  api, GalatApi, simpanToken, ambilServer, simpanServer, SERVER_BAWAAN,
  aktifkanDemo, matikanDemo, adaDataDemo, resetDemoDb, hitungDataDemo,
} from '../lib/api';
import {
  biometrikTersedia, biometrikAktif, aktifkanBiometrik, matikanBiometrik, ambilKredensialBiometrik,
} from '../lib/biometrik';
import type { Pengguna } from '../lib/tipe-api';
import { TombolSidikJari } from './TombolSidikJari';
import { ModalPanduanAplikasi } from './ModalPanduanAplikasi';
import { tautanGabung } from '../lib/demo-contoh';
import { KotakUnduhApk } from './PembaruanAplikasi';
// Diimpor (bukan dari public/) supaya Vite langsung menyajikannya dan nama berkasnya ber-hash.
import gambarLogin from '../aset/login-hero.webp';

/** Versi uji menampilkan pengaturan alamat server; APK produksi tidak. */
const MODE_UJI = import.meta.env.VITE_DEMO !== '0';

/**
 * Layar masuk. Password lewat body POST; akun dibuat Admin di menu TEAM;
 * anggota membuat password sendiri saat login pertama dengan kode undangan.
 *
 * Di APK dengan sidik jari aktif, tombol sidik jari jadi pilihan utama dan form
 * password baru dibuka lewat "Masuk dengan password" (lib/biometrik.ts).
 */

interface AuthScreenProps {
  onMasuk: (pengguna: Pengguna) => void;
}

type Tampilan = 'biometrik' | 'form' | 'tawaran';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onMasuk }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [kodeUndangan, setKodeUndangan] = useState('');
  const [perluKode, setPerluKode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [server, setServer] = useState(ambilServer());
  const [dataDemo, setDataDemo] = useState(() => hitungDataDemo());
  const [konfirmasiReset, setKonfirmasiReset] = useState(false);
  const [bukaDemo, setBukaDemo] = useState(false);
  const [bukaPanduan, setBukaPanduan] = useState(false);
  const [tampilan, setTampilan] = useState<Tampilan>('form');
  const [bioTersedia, setBioTersedia] = useState(false);
  const [bioAktif, setBioAktif] = useState(false);
  const [menunggu, setMenunggu] = useState<Pengguna | null>(null);
  const [petunjuk, setPetunjuk] = useState<string | null>(null);

  const totalItemDemo = dataDemo.pica + dataDemo.jadwal + dataDemo.memo + dataDemo.laporan;
  const punyaDataDemo = adaDataDemo();

  useEffect(() => {
    (async () => {
      const ada = await biometrikTersedia();
      const aktif = ada && await biometrikAktif();
      setBioTersedia(ada);
      setBioAktif(aktif);
      if (aktif) setTampilan('biometrik');
    })();
  }, []);

  const login = (id: string, pw: string, kode?: string) =>
    api<{ token: string; pengguna: Pengguna }>('/api/auth/login', { body: { userId: id, password: pw, kodeUndangan: kode } });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !password) return;
    setLoading(true);
    setError(null);
    try {
      const d = await login(userId.trim().toLowerCase(), password, kodeUndangan || undefined);
      simpanToken(d.token);
      // Tawarkan sidik jari sekali setelah login password berhasil.
      if (bioTersedia && !bioAktif) {
        setMenunggu(d.pengguna);
        setTampilan('tawaran');
      } else {
        // Password bisa saja baru diganti: perbarui yang tersimpan.
        if (bioAktif) await aktifkanBiometrik(userId.trim().toLowerCase(), password).catch(() => {});
        onMasuk(d.pengguna);
      }
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

  const masukBiometrik = async () => {
    setError(null);
    let kred: { userId: string; password: string } | null;
    try {
      kred = await ambilKredensialBiometrik();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sidik jari gagal dibaca.');
      if (!(await biometrikAktif())) { setBioAktif(false); setTampilan('form'); }
      return;
    }
    if (!kred) return;
    setLoading(true);
    try {
      const d = await login(kred.userId, kred.password);
      simpanToken(d.token);
      onMasuk(d.pengguna);
    } catch (err) {
      if (err instanceof GalatApi && err.status !== 0) {
        // Password tersimpan sudah tidak berlaku (diganti/direset Admin).
        await matikanBiometrik();
        setBioAktif(false);
        setUserId(kred.userId);
        setTampilan('form');
        setError('Password tersimpan sudah tidak berlaku. Masuk dengan password baru, lalu aktifkan sidik jari lagi.');
      } else {
        setError(err instanceof GalatApi ? `${err.message} Server: ${ambilServer()}` : 'Gangguan koneksi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const tekanSidikJari = () => {
    if (bioAktif) masukBiometrik();
    else if (bioTersedia) setPetunjuk('Masuk dengan password sekali, lalu pilih "Aktifkan" saat ditawari.');
    else setPetunjuk('Login sidik jari hanya ada di aplikasi Android (APK).');
  };

  const keteranganSidik = bioAktif
    ? 'Sentuh untuk masuk'
    : petunjuk ?? (bioTersedia ? 'Sidik jari belum aktif' : 'Hanya di aplikasi Android');

  const jawabTawaran = async (setuju: boolean) => {
    if (!menunggu) return;
    if (setuju) {
      setLoading(true);
      try {
        await aktifkanBiometrik(userId.trim().toLowerCase(), password);
      } catch { /* dibatalkan: tetap masuk tanpa sidik jari */ }
      setLoading(false);
    }
    onMasuk(menunggu);
  };

  const masukDemo = async () => {
    setLoading(true);
    setError(null);
    aktifkanDemo();
    try {
      const d = await api<{ token: string; pengguna: Pengguna }>('/api/auth/login', { body: { userId: 'demo', password: 'demo-password' } });
      simpanToken(d.token);
      onMasuk(d.pengguna);
    } catch (err) {
      matikanDemo();
      setError(err instanceof Error ? err.message : 'Demo gagal dimuat.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = () => {
    resetDemoDb();
    setDataDemo(hitungDataDemo());
    setKonfirmasiReset(false);
  };

  const tautan = 'text-[12px] text-zinc-400 hover:text-yellow-300 underline decoration-dotted underline-offset-4';

  return (
    <div className="h-screen w-full bg-zinc-950 overflow-auto custom-scrollbar">
      <div className="min-h-full w-full max-w-md mx-auto flex flex-col md:max-w-none md:flex-row">
        {/* Gambar pembuka: di ponsel di atas form, di layar lebar jadi panel kiri. */}
        <div className="relative h-[40vh] min-h-[220px] max-h-[380px] shrink-0 overflow-hidden md:h-screen md:max-h-none md:sticky md:top-0 md:w-1/2 lg:w-[56%]">
          <img src={gambarLogin} alt="" className="absolute inset-0 w-full h-full object-cover object-[center_28%] md:object-[center_40%]" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 pudar-login md:hidden" />
          {/* Warna teks ditulis langsung supaya tidak ikut ditimpa tema terang (latarnya tetap gambar gelap). */}
          <div className="hidden md:flex absolute inset-x-0 bottom-0 flex-col gap-2 p-8 pt-28 bg-gradient-to-t from-black/85 to-transparent">
            <span className="font-title text-[10px] tracking-widest" style={{ color: '#d4d4d8' }}>PLAYER 1 · PLAYER 2</span>
            <span className="font-title text-[13px] drop-shadow-[2px_2px_0_#000] kedip-press" style={{ color: '#facc15' }}>▶ PRESS START</span>
          </div>
          <div className="hidden md:block absolute inset-y-0 right-0 w-1/4 pudar-login-kanan" />
          {MODE_UJI && (
            <button onClick={() => setShowSettings(!showSettings)} className="absolute top-4 right-4 btn-ikon bg-zinc-900/80" aria-label="Pengaturan server">
              <Settings size={18} className={showSettings ? 'rotate-90 text-yellow-400' : 'text-yellow-400'} />
            </button>
          )}
        </div>

        <div className="flex-1 flex flex-col px-6 pb-6 -mt-10 relative md:mt-0 md:px-12 md:py-10 md:justify-center">
          <div className="w-full max-w-sm mx-auto flex-1 flex flex-col md:flex-none">
          {showSettings ? (
            <div className="space-y-5 retro-box !bg-zinc-900 border-yellow-500 !p-5">
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
                <h1 className="font-title text-[15px] md:text-[20px] text-yellow-400 mb-2 drop-shadow-[2px_2px_0_#000]">POKEMONKEY</h1>
                <p className="text-[12px] text-zinc-300 uppercase tracking-widest">Sistem Kerja Lapangan &amp; Manajemen Tim</p>
              </div>

              {error && (
                <div className="bg-red-950/60 border-2 border-red-500 p-3 mb-5 flex items-start gap-3 text-[13px] text-red-200">
                  <AlertTriangle size={18} className="shrink-0 text-red-400" /><span>{error}</span>
                </div>
              )}

              {tampilan === 'tawaran' && menunggu && (
                <div className="retro-box !bg-zinc-900 border-yellow-500 !p-5 text-center space-y-4">
                  <Fingerprint size={40} className="mx-auto text-yellow-400" />
                  <div>
                    <p className="text-[15px] text-white font-bold">Aktifkan login sidik jari?</p>
                    <p className="text-[12.5px] text-zinc-400 mt-1 leading-snug">Lain kali cukup sentuh sensor, tanpa mengetik password. Password disimpan terkunci di ponsel ini.</p>
                  </div>
                  <button type="button" onClick={() => jawabTawaran(true)} disabled={loading} className="btn-retro bg-yellow-600 w-full !py-3 text-[14px]">
                    {loading ? <><Loader2 size={18} className="animate-spin" /> Menunggu sidik jari…</> : <><Fingerprint size={18} /> Aktifkan</>}
                  </button>
                  <button type="button" onClick={() => jawabTawaran(false)} disabled={loading} className={tautan}>Nanti saja</button>
                </div>
              )}

              {tampilan === 'biometrik' && (
                <div className="space-y-3">
                  <div className="pb-3">
                    <TombolSidikJari besar onClick={tekanSidikJari} sibuk={loading} keterangan={keteranganSidik} />
                  </div>
                  <button type="button" onClick={() => { setTampilan('form'); setError(null); }} disabled={loading} className="btn-retro bg-transparent !border-zinc-500 !shadow-none w-full !py-3 text-[13px] text-zinc-200">
                    <Key size={16} /> Masuk dengan password
                  </button>
                  <button
                    type="button"
                    onClick={() => setBukaPanduan(true)}
                    className="btn-retro bg-zinc-900/90 hover:bg-zinc-800 text-yellow-300 border-yellow-500/50 w-full !py-2.5 text-[12px] font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0_#000] transition-colors"
                  >
                    <BookOpen size={15} className="text-yellow-400" />
                    <span>Buku Panduan Aplikasi &amp; SOP (PDF)</span>
                  </button>
                </div>
              )}

              {tampilan === 'form' && (
                <form onSubmit={handleAuth} className="space-y-4">
                  <div>
                    <label className="label-retro flex items-center gap-1.5"><User size={12} /> User ID</label>
                    <input type="text" required autoCapitalize="none" autoComplete="username" value={userId} onChange={(e) => setUserId(e.target.value)} className="input-retro text-[16px]" placeholder="contoh: budi" />
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
                  <button type="submit" disabled={loading} className="btn-retro bg-yellow-600 w-full !py-3.5 text-[14px]">
                    {loading ? <><Loader2 size={18} className="animate-spin" /> Memeriksa…</> : <>Masuk <ArrowRight size={18} /></>}
                  </button>

                  {/* Tombol Akses Buku Panduan & SOP */}
                  <button
                    type="button"
                    onClick={() => setBukaPanduan(true)}
                    className="btn-retro bg-zinc-900/90 hover:bg-zinc-800 text-yellow-300 border-yellow-500/50 w-full !py-2.5 text-[12px] font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0_#000] transition-colors"
                  >
                    <BookOpen size={15} className="text-yellow-400" />
                    <span>Buku Panduan Aplikasi &amp; SOP (PDF)</span>
                  </button>

                  {/* Di website layar lebar sidik jari tak mungkin tersedia: disembunyikan. */}
                  <div className={`space-y-4 ${bioTersedia ? '' : 'md:hidden'}`}>
                    <div className="flex items-center gap-3 pt-1 text-[10px] font-title text-zinc-500">
                      <span className="flex-1 border-t-2 border-dashed border-zinc-700" />ATAU<span className="flex-1 border-t-2 border-dashed border-zinc-700" />
                    </div>
                    <TombolSidikJari onClick={tekanSidikJari} sibuk={loading && bioAktif} redup={!bioAktif} keterangan={keteranganSidik} />
                  </div>
                </form>
              )}

              {tampilan !== 'tawaran' && (
                <div className="mt-auto pt-8 space-y-3">
                  {bukaDemo && (
                    <div className="p-3.5 bg-purple-950/40 border-2 border-purple-500/80 text-left">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1.5 text-[11px] font-title text-purple-300 uppercase tracking-wide">
                          <Sparkles size={13} className="text-yellow-400" /> Mode Demo (Offline)
                        </span>
                        <span className="chip-retro !text-[9px] border-purple-400/60 bg-purple-900/60 text-purple-200">Lokal Perangkat</span>
                      </div>
                      <p className="text-[11.5px] text-zinc-300 leading-snug mb-3">
                        Ruang kerja tanpa server. Data tersimpan di perangkat ini &amp; tidak hilang saat di-refresh.
                      </p>

                      {punyaDataDemo && totalItemDemo > 0 && (
                        <div className="mb-2.5 px-2.5 py-1.5 bg-black/50 border border-purple-400/40 text-[11px] text-purple-200 font-mono flex items-center justify-between">
                          <span>Tersimpan: {dataDemo.pica} PICA · {dataDemo.jadwal} Jadwal · {dataDemo.memo} Memo</span>
                          <span className="text-emerald-400 text-[10px]">● Aman</span>
                        </div>
                      )}

                      <button type="button" onClick={masukDemo} disabled={loading} className="btn-retro bg-purple-700 hover:bg-purple-600 w-full !py-2.5 text-[13px]">
                        <PlayCircle size={16} />
                        {punyaDataDemo && totalItemDemo > 0 ? 'Lanjutkan demo' : 'Mulai demo kosong'}
                      </button>

                      {punyaDataDemo && (
                        <div className="mt-2 text-right">
                          {!konfirmasiReset ? (
                            <button type="button" onClick={() => setKonfirmasiReset(true)} className="text-[11px] text-zinc-400 hover:text-red-400 underline decoration-dotted transition-colors">
                              Kosongkan / Reset data demo
                            </button>
                          ) : (
                            <div className="p-2.5 bg-red-950/80 border border-red-500 text-left space-y-1.5 mt-1.5 animate-fadeIn">
                              <p className="text-[11px] text-red-200 leading-tight">
                                Hapus semua PICA, jadwal, memo, dan dokumen demo di perangkat ini?
                              </p>
                              <div className="flex gap-2 pt-1">
                                <button type="button" onClick={handleResetDemo} className="btn-retro !py-1 !px-2.5 bg-red-700 hover:bg-red-600 text-[11px]">Ya, Kosongkan</button>
                                <button type="button" onClick={() => setKonfirmasiReset(false)} className="btn-retro !py-1 !px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px]">Batal</button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* APK terbaru: tautan unduh (web) atau ajakan memperbarui (APK lama). */}
                  <KotakUnduhApk />

                  {/* Untuk pemakai di luar departemen: penjelasan singkat + ajuan akses. */}
                  <div className="panel-retro !p-2.5 border-emerald-500/70 bg-emerald-950/30 space-y-1.5 text-left">
                    <p className="text-[12px] text-emerald-300 font-bold uppercase tracking-wide">Bukan bagian tim ini?</p>
                    <p className="text-[11px] text-zinc-300 leading-snug">
                      Mode demo berisi data contoh dan berjalan sepenuhnya di perangkat Anda, tanpa server.
                      Isinya tugas perbaikan, jadwal, roster, memo, dan laporan harian — cocok untuk departemen mana pun.
                    </p>
                    <a
                      href={tautanGabung()}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-retro btn-retro-sm bg-emerald-700 hover:bg-emerald-600 w-full justify-center"
                    >
                      Ajukan akses untuk tim Anda
                    </a>
                    <p className="text-[10px] text-zinc-500 text-center">Lewat WhatsApp 0811-2222-0044</p>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <button type="button" onClick={() => setBukaDemo(!bukaDemo)} className={tautan}>
                      {bukaDemo ? 'Tutup mode demo' : 'Coba mode demo'}
                    </button>
                    {bioAktif && (
                      <button type="button" onClick={async () => { await matikanBiometrik(); setBioAktif(false); setTampilan('form'); }} className={tautan}>
                        Matikan sidik jari
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2 opacity-40">
                    <Wifi size={12} className="text-emerald-400" />
                    <span className="text-[11px] uppercase tracking-widest">Cloudflare Link v4</span>
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </div>

      {/* Modal Buku Panduan & SOP Aplikasi (Printable A4 & Export PDF) */}
      <ModalPanduanAplikasi
        isOpen={bukaPanduan}
        onClose={() => setBukaPanduan(false)}
      />
    </div>
  );
};
