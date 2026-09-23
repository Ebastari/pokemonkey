import React, { useState, useRef } from 'react';
import {
  User, Camera, Trash2, Phone, Save, Share2, Copy, Check, X,
  Shield, Trees, Flame, Heart, ClipboardList, Backpack, ExternalLink,
  MessageCircle, Sparkles, Loader2,
} from 'lucide-react';
import type { GameState } from '../types';
import type { Pengguna } from '../lib/tipe-api';

interface Props {
  gameState: GameState;
  pengguna: Pengguna;
  picaTerbukaCount: number;
  picaTelatCount: number;
  totalAchieved: number;
  onSimpanFoto: (fotoBase64: string) => void;
  onHapusFoto: () => void;
  onSimpanWa: (wa: string) => Promise<void>;
  onTutup: () => void;
  notify: (pesan: string) => void;
}

export const ModalProfil: React.FC<Props> = ({
  gameState,
  pengguna,
  picaTerbukaCount,
  picaTelatCount,
  totalAchieved,
  onSimpanFoto,
  onHapusFoto,
  onSimpanWa,
  onTutup,
  notify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [suntingWa, setSuntingWa] = useState(false);
  const [noWa, setNoWa] = useState(pengguna.wa || gameState.phone || '');
  const [menyimpanWa, setMenyimpanWa] = useState(false);
  const [sudahSalin, setSudahSalin] = useState(false);

  // Unggah & Kompres Foto Profil (Canvas 400x400)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('HARAP PILIH FILE GAMBAR (JPG/PNG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          onSimpanFoto(dataUrl);
          notify('FOTO PROFIL BERHASIL DIPERBARUI');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Simpan Nomor Telepon/WhatsApp
  const handleSimpanWa = async () => {
    let clean = noWa.replace(/[^0-9]/g, '');
    if (clean && clean.startsWith('0')) clean = '62' + clean.slice(1);
    if (clean && !clean.startsWith('62')) clean = '62' + clean;

    setMenyimpanWa(true);
    try {
      await onSimpanWa(clean);
      setNoWa(clean);
      setSuntingWa(false);
      notify('NOMOR WHATSAPP BERHASIL DISIMPAN');
    } catch (err) {
      notify(err instanceof Error ? err.message.toUpperCase() : 'GAGAL MENYIMPAN NOMOR');
    } finally {
      setMenyimpanWa(false);
    }
  };

  // Format Pesan Ringkasan Progres
  const susunTeksRingkasan = () => {
    const tgl = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const waUser = noWa || pengguna.wa || '-';
    const lines = [
      `🌿 *POKEMONKEY - RINGKASAN PROGRES FORESTER* 🐒`,
      `📅 *Per Tanggal:* ${tgl}`,
      ``,
      `👤 *IDENTITAS:*`,
      `• Nama: *${gameState.fullName}* (${gameState.userId})`,
      `• Jabatan: ${pengguna.jabatan ?? gameState.jabatan}`,
      `• Bidang: ${pengguna.bidang ?? 'Operasional Lapangan'}`,
      `• WhatsApp: ${waUser}`,
      ``,
      `🎮 *PROGRES GAME & HABITAT:*`,
      `• Level: *${gameState.level}* (XP: ${gameState.xp.toLocaleString('id-ID')})`,
      `• Luas Tanam / Revegetasi: *${gameState.plantedArea.toFixed(2)} Ha*`,
      `• Bio-Stamina: *${gameState.stamina.toFixed(1)}%*`,
      `• Nyawa: ${'❤️'.repeat(Math.floor(gameState.lives))}`,
      ``,
      `📋 *STATUS PICA:*`,
      `• PICA Terbuka: *${picaTerbukaCount} tugas*`,
      `• PICA Telat: *${picaTelatCount} tugas*`,
      ``,
      `🍌 *FEEDING & LAPORAN KERJA:*`,
      `• Total Laporan: *${gameState.reports.length} laporan*`,
      `• Total Capaian: *${totalAchieved.toFixed(2)} UNIT*`,
      ``,
      `_Dikirim dari POKEMONKEY Forestry App_`,
    ];
    return lines.join('\n');
  };

  const handleSalinRingkasan = () => {
    const teks = susunTeksRingkasan();
    void navigator.clipboard.writeText(teks);
    setSudahSalin(true);
    notify('RINGKASAN PROFIL DISALIN KE CLIPBOARD');
    setTimeout(() => setSudahSalin(false), 2500);
  };

  const handleKirimWhatsApp = () => {
    const teks = encodeURIComponent(susunTeksRingkasan());
    window.open(`https://api.whatsapp.com/send?text=${teks}`, '_blank');
  };

  const handleWebShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Progres Profil ${gameState.fullName} - POKEMONKEY`,
        text: susunTeksRingkasan(),
      }).catch(() => {});
    } else {
      handleSalinRingkasan();
    }
  };

  return (
    <div className="fixed inset-0 z-[115] bg-black/85 flex items-center justify-center p-3 sm:p-4" onClick={onTutup}>
      <div
        className="retro-box !bg-zinc-950 border-4 !border-yellow-500 w-full max-w-lg p-4 sm:p-5 flex flex-col gap-4 shadow-2xl animate-bounce-short max-h-[92vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full border-b-2 border-yellow-500/40 pb-2.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-yellow-500 border-2 border-black flex items-center justify-center shrink-0">
              <User size={20} className="text-black" />
            </div>
            <div>
              <h2 className="font-title text-[13px] sm:text-[15px] text-yellow-300 leading-none">PROFIL & PROGRES</h2>
              <p className="text-[10px] text-zinc-400 uppercase mt-0.5">Identitas Forester & Integrasi Tim</p>
            </div>
          </div>
          <button
            onClick={onTutup}
            className="btn-ikon bg-zinc-800 text-zinc-400 hover:text-white"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Konten Scrollable */}
        <div className="flex-1 overflow-auto custom-scrollbar space-y-4 pr-1">
          {/* Section 1: Kartu Identitas & Foto Profil */}
          <div className="bg-black/70 p-3.5 border-2 border-white/20 flex flex-col sm:flex-row items-center gap-4">
            {/* Foto Profil & Aksi Edit */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 bg-white border-4 border-black overflow-hidden flex items-center justify-center shadow-md">
                {gameState.profilePhoto ? (
                  <img src={gameState.profilePhoto} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  <User size={38} className="text-black" />
                )}
              </div>

              {/* Tombol Kamera / Ganti Foto */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-2 -right-2 p-1.5 bg-yellow-500 hover:bg-yellow-400 text-black border-2 border-black shadow rounded-xs active:scale-95 transition-transform"
                title="Ganti Foto Profil"
                aria-label="Ganti Foto Profil"
              >
                <Camera size={14} />
              </button>

              {/* Tombol Hapus Foto (jika ada foto kustom) */}
              {gameState.profilePhoto && (
                <button
                  onClick={() => {
                    onHapusFoto();
                    notify('FOTO PROFIL DIHAPUS');
                  }}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-600 hover:bg-red-500 text-white border-2 border-black shadow rounded-xs active:scale-95 transition-transform"
                  title="Hapus Foto Profil"
                  aria-label="Hapus Foto Profil"
                >
                  <Trash2 size={12} />
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Informasi Akun */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mb-1">
                <h3 className="font-title text-[14px] text-white truncate">{gameState.fullName}</h3>
                <span className="chip-retro !text-[9px] border-yellow-400 bg-yellow-950/80 text-yellow-300">
                  {pengguna.peran.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 uppercase">
                ID: <span className="font-mono font-bold text-white">{gameState.userId}</span> · {pengguna.jabatan ?? gameState.jabatan}
              </p>
              {pengguna.bidang && (
                <p className="text-[10px] text-zinc-400 uppercase mt-0.5">Bidang: {pengguna.bidang}</p>
              )}

              {/* Nomor Telepon / WhatsApp */}
              <div className="mt-2.5 flex items-center justify-center sm:justify-start gap-2">
                <Phone size={13} className="text-emerald-400 shrink-0" />
                {suntingWa ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={noWa}
                      onChange={(e) => setNoWa(e.target.value)}
                      placeholder="0812xxxx atau 62812xxxx"
                      className="px-2 py-0.5 bg-zinc-900 border border-emerald-400 text-[11px] text-white font-mono w-36 outline-none"
                    />
                    <button
                      disabled={menyimpanWa}
                      onClick={handleSimpanWa}
                      className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white border border-white active:scale-95 disabled:opacity-50"
                      title="Simpan Nomor"
                    >
                      {menyimpanWa ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    </button>
                    <button
                      onClick={() => {
                        setSuntingWa(false);
                        setNoWa(pengguna.wa || gameState.phone || '');
                      }}
                      className="p-1 bg-zinc-800 text-zinc-400 hover:text-white border border-white/40"
                      title="Batal"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-emerald-300 font-bold">
                      {noWa || pengguna.wa || gameState.phone || 'Belum diisi'}
                    </span>
                    <button
                      onClick={() => setSuntingWa(true)}
                      className="text-[10px] text-yellow-400 hover:underline cursor-pointer"
                    >
                      [Ubah]
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Grid Progres (Game, PICA, Laporan) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Game Progress */}
            <div className="bg-zinc-900/90 p-2.5 border border-indigo-500/40">
              <div className="flex items-center gap-1.5 text-indigo-300 mb-2 border-b border-white/10 pb-1">
                <Trees size={14} />
                <span className="text-[11px] font-bold uppercase">Progres Game</span>
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Level:</span>
                  <span className="font-bold text-white">{gameState.level}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total XP:</span>
                  <span className="font-mono font-bold text-yellow-300">{gameState.xp.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Luas Tanam:</span>
                  <span className="font-bold text-emerald-400">{gameState.plantedArea.toFixed(2)} Ha</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Bio-Stamina:</span>
                  <span className="font-mono text-orange-400 font-bold">{gameState.stamina.toFixed(0)}%</span>
                </div>
              </div>
            </div>

            {/* PICA Progress */}
            <div className="bg-zinc-900/90 p-2.5 border border-amber-500/40">
              <div className="flex items-center gap-1.5 text-amber-300 mb-2 border-b border-white/10 pb-1">
                <ClipboardList size={14} />
                <span className="text-[11px] font-bold uppercase">Progres PICA</span>
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tugas Terbuka:</span>
                  <span className="font-bold text-white">{picaTerbukaCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tugas Telat:</span>
                  <span className={`font-bold ${picaTelatCount > 0 ? 'text-red-400 animate-pulse' : 'text-zinc-300'}`}>
                    {picaTelatCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Status Tugas:</span>
                  <span className="font-bold text-yellow-300">
                    {picaTelatCount > 0 ? 'Perlu Segera Ditutup' : 'Terkendali'}
                  </span>
                </div>
              </div>
            </div>

            {/* Laporan / Feeding Progress */}
            <div className="bg-zinc-900/90 p-2.5 border border-emerald-500/40">
              <div className="flex items-center gap-1.5 text-emerald-300 mb-2 border-b border-white/10 pb-1">
                <Backpack size={14} />
                <span className="text-[11px] font-bold uppercase">Laporan Kerja</span>
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Laporan:</span>
                  <span className="font-bold text-white">{gameState.reports.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Total Capaian:</span>
                  <span className="font-mono font-bold text-white">{totalAchieved.toFixed(2)} UNIT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Terakhir Lapor:</span>
                  <span className="text-zinc-300 font-mono">
                    {gameState.reports[0] ? new Date(gameState.reports[0].timestamp).toLocaleDateString('id-ID') : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Fitur Bagikan Profil */}
          <div className="bg-black/80 p-3.5 border-2 border-yellow-500/40">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Share2 size={15} className="text-yellow-400" />
                <span className="text-[12px] font-bold text-yellow-300 uppercase">Bagikan Ringkasan Profil</span>
              </div>
              <span className="text-[10px] text-zinc-400">WhatsApp / Clipboard</span>
            </div>

            <p className="text-[10px] text-zinc-300 mb-3 leading-relaxed">
              Kirim ringkasan capaian profil Anda (status game, beban PICA, dan laporan kerja) langsung ke tim atau supervisor.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleKirimWhatsApp}
                className="btn-retro flex-1 min-w-[140px] bg-emerald-700 hover:bg-emerald-600 text-white font-bold flex items-center justify-center gap-1.5 py-2 text-[11px]"
              >
                <MessageCircle size={14} /> Kirim ke WhatsApp
              </button>

              <button
                onClick={handleSalinRingkasan}
                className="btn-retro flex-1 min-w-[130px] bg-zinc-800 hover:bg-zinc-700 text-yellow-300 font-bold flex items-center justify-center gap-1.5 py-2 text-[11px]"
              >
                {sudahSalin ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {sudahSalin ? 'Tersalin!' : 'Salin Teks'}
              </button>

              {'share' in navigator && (
                <button
                  onClick={handleWebShare}
                  className="btn-retro bg-indigo-700 hover:bg-indigo-600 text-white font-bold px-3 py-2 text-[11px]"
                  title="Bagikan via Sistem"
                >
                  <ExternalLink size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/10 flex justify-end shrink-0">
          <button
            onClick={onTutup}
            className="btn-retro bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-5 py-2 text-[11px]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
