import React, { useState } from 'react';
import { Lock, Unlock, Eye, EyeOff, X, AlertCircle } from 'lucide-react';
import { verifikasiPasswordDokumen } from '../lib/kunci-dokumen';

interface Props {
  namaDokumen?: string;
  onSukses: () => void;
  onBatal: () => void;
  notify?: (pesan: string) => void;
}

export const ModalBukaKunci: React.FC<Props> = ({
  namaDokumen = 'Dokumen',
  onSukses,
  onBatal,
  notify,
}) => {
  const [password, setPassword] = useState('');
  const [lihatPassword, setLihatPassword] = useState(false);
  const [salah, setSalah] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifikasiPasswordDokumen(password)) {
      setSalah(false);
      notify?.('KUNCI DIBUKA — DOKUMEN DAPAT DISUNTING KEMBALI');
      onSukses();
    } else {
      setSalah(true);
      notify?.('PASSWORD SALAH! DOKUMEN TETAP TERKUNCI');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[250] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in duration-150"
      onClick={onBatal}
    >
      <div
        className="retro-box !bg-zinc-900 border-amber-500 w-full max-w-sm flex flex-col !p-0 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b-2 border-white/15 bg-zinc-950">
          <div className="flex items-center gap-2 text-white font-bold text-[13px]">
            <Lock size={15} className="text-amber-400" />
            <span>Dokumen Terkunci</span>
          </div>
          <button
            type="button"
            onClick={onBatal}
            className="text-zinc-400 hover:text-white"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Konten Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 bg-zinc-900">
          <p className="text-[12px] text-zinc-300 leading-relaxed">
            <span className="font-semibold text-white">{namaDokumen}</span> telah disimpan dan diamankan. Masukkan password untuk membuka kunci dan mengedit:
          </p>

          <div className="space-y-1">
            <div className="relative">
              <input
                autoFocus
                type={lihatPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (salah) setSalah(false);
                }}
                placeholder="Masukkan password..."
                className={`input-retro !py-1.5 !text-[13px] !pr-8 w-full ${
                  salah ? '!border-red-500 !bg-red-950/20 text-red-200' : ''
                }`}
              />
              <button
                type="button"
                onClick={() => setLihatPassword(!lihatPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                title={lihatPassword ? 'Sembunyikan' : 'Tampilkan'}
              >
                {lihatPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>

            {salah && (
              <p className="text-[11px] text-red-400 flex items-center gap-1 font-medium mt-1">
                <AlertCircle size={12} /> Password salah! Dokumen tetap terkunci.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="btn-retro btn-retro-sm !bg-amber-600 hover:!bg-amber-500 !text-white font-bold flex-1 py-1.5 text-[12px] flex items-center justify-center gap-1.5 shadow-[2px_2px_0_#000]"
            >
              <Unlock size={13} /> Buka Kunci
            </button>
            <button
              type="button"
              onClick={onBatal}
              className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 text-zinc-300 py-1.5 px-3 text-[12px]"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
