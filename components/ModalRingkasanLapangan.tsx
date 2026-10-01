import React from 'react';
import { X, Sprout, Trees } from 'lucide-react';
import { KartuDataLapangan } from './KartuDataLapangan';
import type { BlokData } from '../server/src/memo-blok';

interface Props {
  jenis: 'nursery' | 'geotag';
  onTutup: () => void;
}

export const ModalRingkasanLapangan: React.FC<Props> = ({ jenis, onTutup }) => {
  const [blok, setBlok] = React.useState<BlokData>({
    jenis: 'data',
    sumber: jenis,
    saring: {},
    tampil: 'kpi',
  });

  return (
    <div className="fixed inset-0 z-[250] bg-black/80 flex items-center justify-center p-3 animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col border-2 border-white/40 bg-zinc-900 shadow-[6px_6px_0_#000] text-zinc-100 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-4 py-3 bg-black/50 border-b border-white/15">
          <div className="flex items-center gap-2 font-pixel text-base font-bold">
            {jenis === 'nursery' ? (
              <>
                <Sprout size={18} className="text-lime-400" />
                <span className="text-lime-400">DASBOR SMART NURSERY (KEBUN)</span>
              </>
            ) : (
              <>
                <Trees size={18} className="text-sky-400" />
                <span className="text-sky-400">SENSUS GEOTAGGING & CADANGAN KARBON (KEBUN)</span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onTutup}
            className="p-1 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Isi Modal */}
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          <KartuDataLapangan
            blok={blok}
            bolehUbah={true}
            onUbah={(baru) => setBlok(baru)}
          />
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-black/30 border-t border-white/10 text-right">
          <button
            type="button"
            onClick={onTutup}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
