import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus, X, AlertTriangle, Eye, MessageCircle, Loader2, Copy, Send } from 'lucide-react';
import { api, GalatApi } from '../lib/api';
import type { Pengumuman, Pengguna } from '../lib/tipe-api';
import * as W from '../lib/waktu';
import { formatPengumumanWa, bukaWaManual } from '../lib/wa-manual';

interface Props {
  pengguna: Pengguna;
  jumlahTim: number;
  notify: (pesan: string) => void;
}

export const PengumumanScreen: React.FC<Props> = ({ pengguna, jumlahTim, notify }) => {
  const [daftar, setDaftar] = useState<Pengumuman[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [buka, setBuka] = useState<Pengumuman | null>(null);
  const [formBuka, setFormBuka] = useState(false);
  const [linkGrup, setLinkGrup] = useState<string | null>(null);
  const bolehBuat = pengguna.peran === 'admin' || pengguna.peran === 'supervisor';

  const muat = useCallback(async () => {
    try {
      const d = await api<{ pengumuman: Pengumuman[] }>('/api/pengumuman');
      setDaftar(d.pengumuman);
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT');
    } finally {
      setMemuat(false);
    }
  }, [notify]);

  useEffect(() => {
    muat();
    // Ambil tautan grup WhatsApp dari pengaturan sistem jika ada
    api<{ pengaturan: { kunci: string; nilai: string }[] }>('/api/pengaturan')
      .then((d) => {
        const idGrup = d.pengaturan.find((x) => x.kunci === 'wa_grup_id')?.nilai;
        if (idGrup && idGrup.includes('chat.whatsapp.com')) {
          setLinkGrup(idGrup);
        }
      })
      .catch(() => undefined);
  }, [muat]);

  const bukaPengumuman = async (p: Pengumuman) => {
    setBuka(p);
    if (!p.sudah_baca) {
      try {
        await api(`/api/pengumuman/${p.id}/baca`, { method: 'POST', body: {} });
        setDaftar((d) =>
          d.map((x) => (x.id === p.id ? { ...x, sudah_baca: 1, jumlah_baca: x.jumlah_baca + 1 } : x))
        );
      } catch {
        /* abaikan */
      }
    }
  };

  /** Membuka WhatsApp secara manual ke grup dengan teks terisi */
  const kirimKeWa = async (p: Pengumuman) => {
    const teks = formatPengumumanWa(p);
    const aksi = await bukaWaManual({ pesan: teks, linkGrup });
    if (aksi === 'clipboard_copied') {
      notify('TEKS PENGUMUMAN DISALIN! SILAKAN TEMPEL (PASTE) DI GRUP WA');
    } else {
      notify('WHATSAPP TERBUKA · PILIH GRUP LALU TEKAN KIRIM');
    }
  };

  /** Salin teks saja ke clipboard */
  const salinTeks = async (p: Pengumuman) => {
    const teks = formatPengumumanWa(p);
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(teks);
      notify('TEKS PENGUMUMAN DISALIN KE CLIPBOARD');
    }
  };

  const belumDibaca = daftar.filter((p) => !p.sudah_baca).length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 border-b-4 border-white pb-2 mb-3 px-2 pt-2">
        <h2 className="judul-layar flex items-center gap-2 mr-auto">
          <Megaphone size={16} className="text-pink-400" /> Pengumuman{' '}
          {belumDibaca > 0 && (
            <span className="chip-retro border-pink-300 bg-pink-600 text-white teks-atas-warna">
              {belumDibaca} baru
            </span>
          )}
        </h2>
        {bolehBuat && (
          <button onClick={() => setFormBuka(true)} className="btn-retro btn-retro-sm bg-pink-600">
            <Plus size={12} /> Buat
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar px-2 pb-4 space-y-2.5">
        {memuat && (
          <p className="text-[13px] text-zinc-400 flex items-center gap-2 justify-center py-10">
            <Loader2 size={14} className="animate-spin" /> Memuat…
          </p>
        )}
        {!memuat && daftar.length === 0 && (
          <p className="text-[13px] text-zinc-400 text-center py-10 uppercase">Belum ada pengumuman.</p>
        )}
        {daftar.map((p) => (
          <div
            key={p.id}
            onClick={() => bukaPengumuman(p)}
            className={`w-full text-left retro-box !p-3.5 transition-transform hover:translate-x-1 cursor-pointer ${
              p.penting
                ? '!bg-red-950/70 border-red-500'
                : p.sudah_baca
                ? '!bg-zinc-900/80 border-zinc-500'
                : '!bg-pink-950/60 border-pink-400'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {p.penting ? (
                <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
              ) : (
                <Megaphone
                  size={18}
                  className={`shrink-0 mt-0.5 ${p.sudah_baca ? 'text-zinc-400' : 'text-pink-400'}`}
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-bold leading-snug text-white">
                  {p.judul}
                </p>
                <p className="text-[13.5px] text-zinc-200 mt-1 line-clamp-2 leading-relaxed font-body">
                  {p.isi}
                </p>

                {/* Baris Meta & Tombol Kirim WhatsApp yang Jelas dan Kontras */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 mt-3 pt-2.5 border-t border-white/20">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] uppercase font-bold text-zinc-300">
                    <span className="text-zinc-200">{p.oleh_nama ?? '—'} · {W.formatWaktuIso(p.dibuat_pada)} WITA</span>
                    <span className="flex items-center gap-1 text-zinc-200">
                      <Eye size={12} /> {p.jumlah_baca}/{jumlahTim} dibaca
                    </span>
                    {!p.sudah_baca && <span className="text-pink-300 font-bold">belum dibaca</span>}
                  </div>

                  {/* Tombol aksi cepat WA dengan teks putih pekat & kontras tinggi */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void kirimKeWa(p);
                    }}
                    className="btn-retro !bg-emerald-600 hover:!bg-emerald-500 !text-white !border-2 !border-white !py-1.5 !px-3 text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-[2px_2px_0_#000] ml-auto cursor-pointer"
                    title="Kirim pengumuman ini ke grup WhatsApp"
                  >
                    <MessageCircle size={14} className="text-white shrink-0" />
                    <span className="text-white font-bold tracking-wide">KIRIM KE WA GROUP</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Detail Pengumuman */}
      {buka && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3"
          onClick={() => setBuka(null)}
        >
          <div
            className={`retro-box !bg-zinc-900 w-full max-w-lg ${
              buka.penting ? 'border-red-500' : 'border-pink-500'
            } flex flex-col gap-3.5 max-h-[85vh] overflow-auto custom-scrollbar !p-4`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b-2 border-white/20 pb-2.5 gap-2">
              <h3 className="text-[17px] font-bold text-white leading-snug">
                {buka.penting && <span className="text-red-400">PENTING · </span>}
                {buka.judul}
              </h3>
              <button onClick={() => setBuka(null)} className="text-zinc-400 hover:text-white shrink-0 p-1">
                <X size={20} />
              </button>
            </div>
            <p className="text-[14.5px] text-white leading-relaxed whitespace-pre-wrap font-body">{buka.isi}</p>
            <p className="text-[12px] text-zinc-300 font-bold uppercase border-t border-white/15 pt-2">
              {buka.oleh_nama ?? '—'} · {W.formatWaktuIso(buka.dibuat_pada)} WITA · dibaca {buka.jumlah_baca}/{jumlahTim}
            </p>

            {/* Aksi Berbagi WhatsApp Manual */}
            <div className="flex items-center gap-2 pt-2 border-t-2 border-white/20">
              <button
                type="button"
                onClick={() => void kirimKeWa(buka)}
                className="btn-retro !bg-emerald-600 hover:!bg-emerald-500 !text-white !border-2 !border-white flex-1 flex items-center justify-center gap-2 !py-2.5 px-4 text-xs font-bold shadow-[3px_3px_0_#000] cursor-pointer"
              >
                <MessageCircle size={16} className="text-white shrink-0" />
                <span className="text-white font-bold tracking-wider">KIRIM KE WA GROUP</span>
              </button>
              <button
                type="button"
                onClick={() => void salinTeks(buka)}
                className="btn-retro !bg-zinc-800 hover:!bg-zinc-700 !text-white !border-2 !border-white !py-2.5 px-4 text-xs font-bold flex items-center gap-1.5 shadow-[3px_3px_0_#000] cursor-pointer"
                title="Salin teks pengumuman ke clipboard"
              >
                <Copy size={14} className="text-white shrink-0" />
                <span className="text-white font-bold">SALIN</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Buat Pengumuman Baru */}
      {formBuka && (
        <FormPengumuman
          linkGrup={linkGrup}
          onTutup={() => setFormBuka(false)}
          onSimpan={(baru) => {
            setFormBuka(false);
            muat();
            notify('PENGUMUMAN DITERBITKAN');
          }}
          notify={notify}
        />
      )}
    </div>
  );
};

const FormPengumuman: React.FC<{
  linkGrup: string | null;
  onTutup: () => void;
  onSimpan: (baru: { judul: string; isi: string; penting: boolean; kirim_wa: boolean }) => void;
  notify: (pesan: string) => void;
}> = ({ linkGrup, onTutup, onSimpan, notify }) => {
  const [f, setF] = useState({ judul: '', isi: '', penting: false, kirim_wa: true });
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const simpan = async () => {
    if (!f.judul.trim() || !f.isi.trim()) {
      setGalat('Judul dan isi wajib diisi.');
      return;
    }
    setMenyimpan(true);
    setGalat(null);
    try {
      await api('/api/pengumuman', {
        body: { ...f, judul: f.judul.trim(), isi: f.isi.trim() },
      });
      onSimpan(f);

      // Jika opsi kirim_wa aktif, buka WhatsApp secara langsung agar user bisa kirim ke grup
      if (f.kirim_wa) {
        const teks = formatPengumumanWa({
          judul: f.judul.trim(),
          isi: f.isi.trim(),
          penting: f.penting,
        });
        void bukaWaManual({ pesan: teks, linkGrup });
      }
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Gagal mengirim.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onTutup}
    >
      <div
        className="retro-box !bg-zinc-900 w-full max-w-md border-pink-500 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b-2 border-white/20 pb-2">
          <h3 className="judul-layar text-pink-300">Pengumuman baru</h3>
          <button onClick={onTutup} className="text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        {galat && (
          <p className="text-[12px] text-red-200 bg-red-950/50 border border-red-500 p-2">{galat}</p>
        )}
        <input
          autoFocus
          value={f.judul}
          onChange={(e) => setF({ ...f, judul: e.target.value })}
          placeholder="Judul"
          className="input-retro"
        />
        <textarea
          value={f.isi}
          onChange={(e) => setF({ ...f, isi: e.target.value })}
          placeholder="Isi pengumuman…"
          className="input-retro h-32 resize-none"
        />
        <label className="flex items-center gap-2 text-[13px] text-zinc-200 cursor-pointer">
          <input
            type="checkbox"
            checked={f.penting}
            onChange={(e) => setF({ ...f, penting: e.target.checked })}
          />{' '}
          Tandai penting
        </label>
        <label className="flex items-center gap-2.5 text-xs text-white font-bold cursor-pointer bg-emerald-950/80 p-2.5 border-2 border-emerald-500 rounded">
          <input
            type="checkbox"
            checked={f.kirim_wa}
            onChange={(e) => setF({ ...f, kirim_wa: e.target.checked })}
            className="w-4 h-4 accent-emerald-500"
          />{' '}
          <span className="text-emerald-200 font-bold">Buka WhatsApp setelah simpan (Kirim ke WA Group)</span>
        </label>
        <button
          onClick={simpan}
          disabled={menyimpan}
          className="btn-retro bg-pink-600 hover:bg-pink-500 w-full flex items-center justify-center gap-2"
        >
          {menyimpan ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Menyimpan…
            </>
          ) : (
            <>
              <Send size={14} /> Terbitkan &amp; Kirim Pengumuman
            </>
          )}
        </button>
      </div>
    </div>
  );
};
