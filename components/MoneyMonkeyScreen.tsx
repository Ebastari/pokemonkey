import React, { useState } from 'react';
import { Coins } from 'lucide-react';
import { RabRnr } from './RabRnr';
import { FormulirKeuangan } from './FormulirKeuangan';
import type { JenisFormulir } from '../lib/formulir-keuangan';
import type { Pengguna } from '../lib/tipe-api';

/**
 * MONEY MONKEY: RAB RNR bulanan + formulir Disposisi PNBP PKH, RAB Insidental,
 * dan LBPD. Semua berakhir di ekspor Excel dengan template resmi.
 */

interface Props {
  pengguna: Pengguna;
  notify: (pesan: string) => void;
}

type Menu = 'rab' | JenisFormulir;
const MENU: [Menu, string][] = [['rab', 'RAB RNR'], ['disposisi', 'Disposisi'], ['insidental', 'RAB Insidental'], ['lbpd', 'LBPD']];

export const MoneyMonkeyScreen: React.FC<Props> = ({ pengguna, notify }) => {
  const [menu, setMenu] = useState<Menu>(() => {
    try {
      const m = localStorage.getItem('pokemonkey_money_menu') as Menu | null;
      return m && MENU.some(([k]) => k === m) ? m : 'rab';
    } catch { return 'rab'; }
  });
  const ganti = (m: Menu) => {
    setMenu(m);
    try { localStorage.setItem('pokemonkey_money_menu', m); } catch { /* abaikan */ }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black/40">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-4 border-white pb-2 mb-2 px-2 pt-2 bg-black/60 shrink-0">
        <h2 className="judul-layar flex items-center gap-2 mr-auto">
          <Coins size={18} className="text-yellow-400" /> MONEY MONKEY
        </h2>
        <div className="flex flex-wrap border-2 border-white/40">
          {MENU.map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => ganti(k)}
              className={`px-2.5 py-1.5 text-[11px] font-bold uppercase ${menu === k ? 'bg-amber-600 text-white' : 'bg-black/40 text-zinc-300 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto custom-scrollbar px-2 pb-4 min-h-0">
        {menu === 'rab' ? <RabRnr pengguna={pengguna} notify={notify} /> : <FormulirKeuangan jenis={menu} pengguna={pengguna} notify={notify} />}
      </div>
    </div>
  );
};
