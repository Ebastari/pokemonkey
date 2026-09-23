import React, { useState, useEffect, useRef } from 'react';
import {
  AlarmClock, X, Volume2, VolumeX, Upload, RotateCcw, Play, Square,
  Clock, CalendarDays, CheckCircle2, Sparkles, Bell
} from 'lucide-react';
import type { AlarmItem, InfoNadaDering } from '../lib/alarm';
import {
  ambilNadaDeringKustom, simpanNadaDeringKustom, hapusNadaDeringKustom,
  bunyikanAlarm, hentikanAlarm, apakahSedangBunyi
} from '../lib/alarm';

interface Props {
  daftarAlarm: AlarmItem[];
  onTutup: () => void;
  onBukaKalender?: () => void;
  onUjiCobaAlarm: () => void;
  notify?: (pesan: string) => void;
}

export const PanelAlarm: React.FC<Props> = ({
  daftarAlarm, onTutup, onBukaKalender, onUjiCobaAlarm, notify
}) => {
  const [nadaKustom, setNadaKustom] = useState<InfoNadaDering | null>(null);
  const [memuatNada, setMemuatNada] = useState(true);
  const [sedangUjiSuara, setSedangUjiSuara] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ambilNadaDeringKustom()
      .then(setNadaKustom)
      .finally(() => setMemuatNada(false));
  }, []);

  const tanganiUbahFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      notify?.('PILIH FILE AUDIO (.MP3, .WAV, .OGG)');
      return;
    }

    try {
      const info = await simpanNadaDeringKustom(file);
      setNadaKustom(info);
      notify?.(`NADA DERING DISIMPAN: ${file.name.toUpperCase()}`);
    } catch {
      notify?.('GAGAL MENYIMPAN NADA DERING');
    }
  };

  const tanganiUjiSuara = async () => {
    if (sedangUjiSuara || apakahSedangBunyi()) {
      hentikanAlarm();
      setSedangUjiSuara(false);
    } else {
      setSedangUjiSuara(true);
      await bunyikanAlarm();
    }
  };

  const tanganiResetBawaan = async () => {
    hentikanAlarm();
    setSedangUjiSuara(false);
    await hapusNadaDeringKustom();
    setNadaKustom(null);
    notify?.('NADA DERING DIKEMBALIKAN KE 8-BIT RETRO');
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-3" onClick={onTutup}>
      <div
        className="retro-box !bg-zinc-900 border-2 border-yellow-500 w-full max-w-lg max-h-[90vh] overflow-auto custom-scrollbar p-4 flex flex-col gap-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-white/20 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-yellow-500 text-black flex items-center justify-center border-2 border-black">
              <AlarmClock size={18} />
            </div>
            <div>
              <h2 className="font-title text-[12px] text-white">ALARM & PENGINGAT</h2>
              <p className="text-[10px] text-yellow-200">Agenda Kalender & Nada Dering</p>
            </div>
          </div>
          <button onClick={onTutup} className="text-zinc-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        {/* Section 1: Daftar Alarm Acara Hari Ini */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-bold text-sky-300 uppercase flex items-center gap-1.5">
              <CalendarDays size={13} /> Alarm Acara Hari Ini ({daftarAlarm.length})
            </h3>
            {onBukaKalender && (
              <button
                onClick={() => { onTutup(); onBukaKalender(); }}
                className="chip-retro border-sky-400 bg-sky-950/60 text-sky-200 !text-[10px]"
              >
                + Tambah di Jadwal
              </button>
            )}
          </div>

          {daftarAlarm.length === 0 ? (
            <div className="panel-retro !p-3 text-center text-zinc-400 text-[11px]">
              <p>Belum ada alarm acara untuk hari ini.</p>
              <p className="text-[10px] text-zinc-500 mt-1">
                Buat acara di tab <strong>JADWAL</strong> dan atur waktu pengingat (mis. 15 mnt sebelum).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {daftarAlarm.map((a) => {
                const sisaMenit = Math.round((a.waktuTargetMs - Date.now()) / 60_000);
                const lewat = sisaMenit < 0;
                return (
                  <div key={a.id} className="panel-retro !p-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-white truncate">{a.judul}</p>
                      <p className="text-[10px] text-zinc-300 flex items-center gap-1 mt-0.5">
                        <Clock size={11} className="text-yellow-400" />
                        Pukul {a.jamMulai} WITA · {a.menitSebelum} menit sebelum
                      </p>
                    </div>
                    <span className={`chip-retro !text-[9px] shrink-0 ${lewat ? 'border-zinc-600 bg-zinc-800 text-zinc-400' : 'border-emerald-400 bg-emerald-950 text-emerald-200 animate-pulse'}`}>
                      {lewat ? 'Selesai' : `${sisaMenit} mnt lagi`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Pengaturan Nada Dering Lokal */}
        <div className="border-t border-white/10 pt-3">
          <h3 className="text-[11px] font-bold text-yellow-300 uppercase flex items-center gap-1.5 mb-2">
            <Volume2 size={13} /> Nada Dering Pengingat
          </h3>

          <div className="panel-retro !p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-zinc-400 uppercase">Nada Aktif:</p>
                <p className="text-[12px] font-bold text-white mt-0.5 flex items-center gap-1.5">
                  {memuatNada ? (
                    'Memeriksa…'
                  ) : nadaKustom ? (
                    <>
                      <Sparkles size={13} className="text-yellow-400" />
                      <span className="text-emerald-300 truncate max-w-[220px]">{nadaKustom.nama}</span>
                    </>
                  ) : (
                    '8-Bit Retro Chime (Bawaan Game)'
                  )}
                </p>
              </div>

              {/* Tombol Uji Suara */}
              <button
                onClick={tanganiUjiSuara}
                className={`btn-retro btn-retro-sm ${sedangUjiSuara ? 'bg-red-700 animate-pulse' : 'bg-yellow-600'}`}
                title={sedangUjiSuara ? 'Hentikan pengujian' : 'Putar contoh nada'}
              >
                {sedangUjiSuara ? <><Square size={12} /> Stop</> : <><Play size={12} /> Uji Suara</>}
              </button>
            </div>

            {/* Unggah File Lokal */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={tanganiUbahFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-retro btn-retro-sm bg-indigo-700 hover:bg-indigo-600 flex-1 flex items-center justify-center gap-1.5 text-[11px]"
              >
                <Upload size={13} /> Pilih File Audio Lokal (.mp3, .wav)
              </button>

              {nadaKustom && (
                <button
                  type="button"
                  onClick={tanganiResetBawaan}
                  className="btn-retro btn-retro-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-200 flex items-center gap-1 text-[11px]"
                  title="Kembalikan ke nada dering 8-bit bawaan"
                >
                  <RotateCcw size={12} /> Reset
                </button>
              )}
            </div>
            <p className="text-[10px] text-zinc-400">
              File audio tersimpan secara privat di perangkat ini (IndexedDB) dan akan berbunyi saat alarm meeting berbunyi.
            </p>
          </div>
        </div>

        {/* Section 3: Uji Coba Alarm Lengkap */}
        <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
          <button
            onClick={() => {
              onTutup();
              onUjiCobaAlarm();
            }}
            className="btn-retro bg-red-800 hover:bg-red-700 text-white !py-2.5 flex items-center justify-center gap-2 text-[12px]"
          >
            <AlarmClock size={15} className="animate-pulse" />
            SIMULASIKAN ALARM BERBUNYI SEKARANG
          </button>
          <p className="text-[10px] text-zinc-500 text-center">
            Menguji layar alarm pop-up, tombol matikan/tunda, dan nada dering yang dipilih.
          </p>
        </div>

      </div>
    </div>
  );
};
