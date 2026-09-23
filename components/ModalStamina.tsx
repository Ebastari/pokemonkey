import React from 'react';
import { Flame, X, Utensils, Clock, HeartPulse, Info, CheckCircle2, AlertTriangle, BatteryCharging, History } from 'lucide-react';
import type { FieldReport } from '../types';

interface Props {
  stamina: number;
  lastFeedingTime?: number;
  reports?: FieldReport[];
  totalAchieved?: number;
  onTutup: () => void;
  onBukaLapor?: () => void;
  onPilihReport?: (r: FieldReport) => void;
}

export const ModalStamina: React.FC<Props> = ({
  stamina,
  lastFeedingTime,
  reports = [],
  totalAchieved = 0,
  onTutup,
  onBukaLapor,
  onPilihReport,
}) => {
  return (
    <div className="fixed inset-0 z-[120] bg-black/85 flex items-center justify-center p-3 sm:p-4" onClick={onTutup}>
      <div
        className="retro-box !bg-zinc-950 border-4 !border-orange-500 w-full max-w-lg p-4 sm:p-5 flex flex-col gap-3.5 shadow-2xl animate-bounce-short max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full border-b-2 border-orange-500/40 pb-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-orange-600 border-2 border-white flex items-center justify-center shrink-0">
              <Flame size={18} className="text-white fill-white animate-pulse" />
            </div>
            <div className="text-left">
              <h2 className="font-title text-[13px] md:text-[15px] text-orange-300 leading-none">BIO-STAMINA & FEEDING LOG</h2>
              <p className="text-[10px] text-zinc-400 uppercase mt-0.5">Status Kebugaran & Riwayat Asupan Monyet</p>
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
        <div className="flex-1 overflow-auto custom-scrollbar space-y-3.5 pr-1">
          {/* Section 1: Bar Stamina */}
          <div className="w-full bg-black/70 p-3 border-2 border-orange-500/30">
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-[11px] font-bold text-orange-200 uppercase flex items-center gap-1.5">
                <BatteryCharging size={14} className="text-orange-400" /> Sisa Stamina
              </span>
              <span className="font-mono font-black text-[16px] text-yellow-300">
                {stamina.toFixed(1)}%
              </span>
            </div>
            <div className="h-6 bg-black border-2 border-white overflow-hidden relative shadow-inner">
              <div
                className="h-full stamina-bar-fill transition-all duration-500"
                style={{ width: `${stamina}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-bold text-white mix-blend-difference">
                {stamina.toFixed(1)} / 100%
              </span>
            </div>

            {/* Status Badge */}
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              {stamina >= 70 ? (
                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 px-2 py-1 border border-emerald-500/40 w-full text-left">
                  <CheckCircle2 size={13} className="shrink-0" />
                  <span><strong>Kondisi Prima:</strong> Monyet bergerak lincah & bersemangat!</span>
                </div>
              ) : stamina >= 30 ? (
                <div className="flex items-center gap-1.5 text-yellow-300 bg-yellow-950/60 px-2 py-1 border border-yellow-500/40 w-full text-left">
                  <Info size={13} className="shrink-0" />
                  <span><strong>Kondisi Normal:</strong> Stamina berkurang teratur seiring jam kerja.</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-red-400 bg-red-950/60 px-2 py-1 border border-red-500/40 w-full text-left animate-pulse">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span><strong>Kritis:</strong> Monyet kelelahan & melambat. Segera beri makan!</span>
                </div>
              )}
            </div>

            <p className="text-[10px] text-zinc-400 mt-2 italic flex items-center gap-1">
              <Clock size={11} className="text-zinc-500 shrink-0" />
              Siklus 18 jam sejak 07:00 WITA. Kirim laporan kerja (FEED) untuk memulihkan stamina ke 100%.
              {lastFeedingTime && lastFeedingTime > 0
                ? ` Terakhir feeding: ${new Date(lastFeedingTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WITA.`
                : ''}
            </p>
          </div>

          {/* Section 2: Feeding Log */}
          <div className="w-full bg-black/80 p-3 border-2 border-emerald-500/40">
            <div className="border-b-2 border-emerald-500/30 pb-2 mb-2">
              <div className="flex justify-between items-baseline">
                <h3 className="text-[13px] font-bold text-emerald-400 uppercase leading-none flex items-center gap-1.5">
                  <History size={14} /> Feeding Log
                </h3>
                <div className="text-[12px] flex items-baseline gap-1.5">
                  <span className="text-zinc-400 uppercase text-[10px]">Capaian</span>
                  <span className="text-white font-bold font-mono">{totalAchieved.toFixed(2)} UNIT</span>
                </div>
              </div>
            </div>

            {/* List Riwayat Feeding */}
            <div className="space-y-1.5 max-h-52 overflow-auto custom-scrollbar pr-0.5">
              {reports.map((r) => (
                <div
                  key={r.id}
                  onClick={() => onPilihReport?.(r)}
                  className="border-b border-white/10 pb-1.5 pt-1 px-1.5 cursor-pointer hover:bg-white/5 transition-colors"
                  title="Klik untuk melihat di kebun"
                >
                  <p className="text-[12px] text-yellow-300 font-bold uppercase truncate">
                    {r.activityType}
                  </p>
                  <div className="flex justify-between text-[11px] mt-0.5">
                    <p className="text-zinc-200 font-mono">
                      +{r.achievedUnit.toFixed(2)} {r.unitType.toUpperCase()}
                    </p>
                    <p className="text-zinc-400 font-mono">
                      {new Date(r.timestamp).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                  {r.notes && (
                    <p className="text-[10px] text-zinc-400 italic truncate mt-0.5">
                      "{r.notes}"
                    </p>
                  )}
                </div>
              ))}
              {reports.length === 0 && (
                <div className="text-center py-6 text-zinc-500 text-[11px] uppercase">
                  Belum ada catatan feeding
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Tombol Aksi */}
        <div className="flex gap-2 w-full pt-1 border-t border-white/10 shrink-0">
          {onBukaLapor && (
            <button
              onClick={() => {
                onTutup();
                onBukaLapor();
              }}
              className="btn-retro flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold flex items-center justify-center gap-1.5 py-2 text-[11px]"
            >
              <Utensils size={14} /> Beri Makan (Lapor Kerja)
            </button>
          )}
          <button
            onClick={onTutup}
            className="btn-retro bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold px-4 py-2 text-[11px]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
