import React, { useEffect, useRef, useState } from 'react';

/**
 * Baris properti halaman memo — pola Notion: nama properti abu-abu di kiri,
 * nilai tampil polos di kanan dan baru menjadi isian saat diketuk; keluar
 * (klik di luar / Esc) kembali polos. Nama properti bisa membuka menu
 * (mis. "Hapus properti") seperti di Notion.
 */

export interface AksiProperti { label: string; aksi: () => void; bahaya?: boolean }

export const BarisProperti: React.FC<{
  label: string;
  ikon?: React.ReactNode;
  /** Nilai saat tidak disunting. */
  tampil: React.ReactNode;
  /** Penyunting; dipanggil saat baris aktif. `selesai` menutupnya. */
  sunting?: (selesai: () => void) => React.ReactNode;
  boleh?: boolean;
  menu?: AksiProperti[];
}> = ({ label, ikon, tampil, sunting, boleh = false, menu }) => {
  const [aktif, setAktif] = useState(false);
  const [menuBuka, setMenuBuka] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);
  const bisaSunting = boleh && Boolean(sunting);

  // Keluar dari penyunting saat fokus/klik berpindah ke luar baris.
  useEffect(() => {
    if (!aktif) return;
    const isian = wadah.current?.querySelector<HTMLElement>('input:not([type=hidden]), textarea, select');
    isian?.focus();
    const luar = (e: Event) => { if (wadah.current && !wadah.current.contains(e.target as Node)) setAktif(false); };
    document.addEventListener('pointerdown', luar, true);
    return () => document.removeEventListener('pointerdown', luar, true);
  }, [aktif]);

  return (
    <div className="flex items-start gap-2 min-h-[34px]" ref={wadah} onKeyDown={(e) => { if (e.key === 'Escape') setAktif(false); }}>
      <div className="relative w-[118px] sm:w-[190px] shrink-0">
        <button
          type="button"
          disabled={!menu?.length}
          onClick={() => setMenuBuka((v) => !v)}
          className={`w-full flex items-center gap-1.5 h-[34px] px-1.5 text-left text-[13px] text-zinc-400 ${menu?.length ? 'hover:bg-white/[0.06] hover:text-zinc-200' : 'cursor-default'}`}
          title={label}
        >
          <span className="shrink-0 opacity-80">{ikon}</span>
          <span className="truncate">{label}</span>
        </button>
        {menuBuka && menu?.length && (
          <>
            <span className="fixed inset-0 z-20" onClick={() => setMenuBuka(false)} aria-hidden="true" />
            <div className="absolute left-0 top-full z-30 mt-0.5 w-52 retro-box !bg-zinc-900 border-lime-500 !p-1">
              {menu.map((m) => (
                <button key={m.label} type="button" onClick={() => { setMenuBuka(false); m.aksi(); }} className={`block w-full text-left px-2 py-1.5 text-[13px] ${m.bahaya ? 'text-red-300 hover:bg-red-900/40' : 'hover:bg-white/10'}`}>{m.label}</button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex-1 min-w-0 min-h-[34px] flex items-center">
        {!sunting ? (
          // Nilai yang mengatur sendiri interaksinya (pilihan, tanggal, centang) atau baca-saja.
          <div className="w-full">{tampil}</div>
        ) : aktif ? (
          <div className="w-full py-0.5">{sunting(() => setAktif(false))}</div>
        ) : (
          <div
            role={bisaSunting ? 'button' : undefined}
            tabIndex={bisaSunting ? 0 : undefined}
            onClick={() => { if (bisaSunting) setAktif(true); }}
            onKeyDown={(e) => { if (bisaSunting && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setAktif(true); } }}
            className={`w-full min-h-[34px] flex items-center px-1.5 text-[14px] text-zinc-100 ${bisaSunting ? 'cursor-pointer hover:bg-white/[0.06]' : ''}`}
          >
            {tampil}
          </div>
        )}
      </div>
    </div>
  );
};

/** Nilai baca-saja dengan bantalan yang sama seperti nilai yang bisa disunting. */
export const NilaiPolos: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full min-h-[34px] flex items-center px-1.5 text-[14px] text-zinc-100">{children}</div>
);

/** Teks redup "Kosong" seperti "Empty" di Notion. */
export const Kosong: React.FC<{ teks?: string }> = ({ teks = 'Kosong' }) => <span className="text-zinc-600">{teks}</span>;

/**
 * Pilihan tunggal ala Notion: yang tampil hanya label berwarna; daftar pilihan
 * asli perangkat (pemilih HP) terbuka saat label diketuk, karena <select>
 * transparan menutupi label.
 */
export const PilihanTembus: React.FC<{
  nilai: string | null;
  opsi: { nilai: string; label: string }[];
  boleh: boolean;
  onUbah: (v: string | null) => void;
  label: string;
  children: React.ReactNode;
}> = ({ nilai, opsi, boleh, onUbah, label, children }) => (
  <div className={`relative w-full min-h-[34px] flex items-center px-1.5 ${boleh ? 'hover:bg-white/[0.06] cursor-pointer' : ''}`}>
    {children}
    {boleh && (
      <select
        value={nilai ?? ''}
        onChange={(e) => onUbah(e.target.value || null)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label={label}
      >
        <option value="">— Kosong</option>
        {opsi.map((o) => <option key={o.nilai} value={o.nilai}>{o.label}</option>)}
      </select>
    )}
  </div>
);

/** Tanggal ala Notion: teks tanggal; diketuk membuka pemilih tanggal perangkat. */
export const TanggalTembus: React.FC<{
  nilai: string | null; boleh: boolean; onUbah: (v: string | null) => void; label: string; children: React.ReactNode;
}> = ({ nilai, boleh, onUbah, label, children }) => {
  const isian = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`relative w-full min-h-[34px] flex items-center px-1.5 ${boleh ? 'hover:bg-white/[0.06] cursor-pointer' : ''}`}
      onClick={() => { if (!boleh || !isian.current) return; try { isian.current.showPicker(); } catch { isian.current.focus(); } }}
    >
      {children}
      {boleh && (
        <input
          ref={isian}
          type="date"
          value={nilai ?? ''}
          onChange={(e) => onUbah(e.target.value || null)}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
          tabIndex={-1}
          aria-label={label}
        />
      )}
    </div>
  );
};
