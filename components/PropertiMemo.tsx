import React, { useEffect, useState } from 'react';
import { ExternalLink, Link as IkonTaut, Loader2, MapPin, Plus, X } from 'lucide-react';
import { api } from '../lib/api';
import type { AnggotaRingkas, Properti } from '../lib/tipe-api';
import type { PicaItem } from '../lib/tipe-api';
import type { Memo } from '../types';
import * as W from '../lib/waktu';

/**
 * Properti kustom memo (kolom tambahan ala database Notion) dan tautan memo ke PICA.
 * Definisi kolom ada di tabel `properti` (entitas 'memo'); nilainya di `memo.props` (JSON).
 */

export type NilaiProps = Record<string, string | number | boolean | null>;

export function bacaProps(m: Pick<Memo, 'props'>): NilaiProps {
  try {
    const x = JSON.parse(m.props || '{}');
    return x && typeof x === 'object' && !Array.isArray(x) ? (x as NilaiProps) : {};
  } catch { return {}; }
}

export function opsiProperti(p: Properti): string[] {
  try {
    const a = JSON.parse(p.opsi_json || '[]');
    return Array.isArray(a) ? a.map(String) : [];
  } catch { return []; }
}

/** Menghasilkan tautan Google Maps dari teks alamat, koordinat, atau URL. */
export function buatTautanGoogleMaps(lokasi: string): string {
  const t = lokasi.trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t)}`;
}

/** Nilai properti sebagai teks (untuk tabel, ekspor, dan pencarian). */
export function teksNilai(p: Properti, nilai: unknown, tim: AnggotaRingkas[]): string {
  if (nilai === undefined || nilai === null || nilai === '') return '';
  if (p.tipe === 'checkbox') return nilai ? 'Ya' : 'Tidak';
  if (p.tipe === 'orang') return tim.find((t) => t.id === nilai)?.nama ?? String(nilai);
  if (p.tipe === 'tanggal') return W.formatPendek(String(nilai)) + ` ${String(nilai).slice(0, 4)}`;
  return String(nilai);
}

/** Sunting satu nilai properti sesuai jenisnya. */
export const EditorProperti: React.FC<{
  p: Properti; nilai: unknown; tim: AnggotaRingkas[]; boleh: boolean;
  onUbah: (v: string | number | boolean | null) => void;
}> = ({ p, nilai, tim, boleh, onUbah }) => {
  const teks = nilai === undefined || nilai === null ? '' : String(nilai);
  if (!boleh) {
    if (p.tipe === 'url' && teks) return <a href={teks} target="_blank" rel="noopener noreferrer" className="text-[13px] text-sky-300 underline break-all">{teks}</a>;
    if (p.tipe === 'lokasi' && teks) {
      const mapsUrl = buatTautanGoogleMaps(teks);
      return (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] text-emerald-400 hover:text-emerald-300 underline font-medium break-all"
          title="Buka di Google Maps"
        >
          <MapPin size={13} className="text-red-400 shrink-0" />
          <span>{teks}</span>
          <ExternalLink size={12} className="opacity-70 shrink-0" />
        </a>
      );
    }
    return <span className="text-[13px] text-zinc-200">{teksNilai(p, nilai, tim) || '—'}</span>;
  }
  switch (p.tipe) {
    case 'angka':
      return <input type="number" value={teks} onChange={(e) => onUbah(e.target.value === '' ? null : Number(e.target.value))} className="input-retro !py-1 !text-[13px] !w-40" aria-label={p.label} />;
    case 'tanggal':
      return <input type="date" value={teks} onChange={(e) => onUbah(e.target.value || null)} className="input-retro !py-1 !text-[13px] !w-auto" aria-label={p.label} />;
    case 'checkbox':
      return <input type="checkbox" checked={Boolean(nilai)} onChange={(e) => onUbah(e.target.checked)} className="accent-lime-500 w-4 h-4" aria-label={p.label} />;
    case 'select':
      return (
        <select value={teks} onChange={(e) => onUbah(e.target.value || null)} className="input-retro !py-1 !text-[13px] !w-auto max-w-full" aria-label={p.label}>
          <option value="">—</option>{opsiProperti(p).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'orang':
      return (
        <select value={teks} onChange={(e) => onUbah(e.target.value || null)} className="input-retro !py-1 !text-[13px] !w-auto max-w-full" aria-label={p.label}>
          <option value="">—</option>{tim.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}
        </select>
      );
    case 'url':
      return (
        <span className="flex items-center gap-2">
          <input type="url" value={teks} onChange={(e) => onUbah(e.target.value || null)} placeholder="https://" className="input-retro !py-1 !text-[13px] flex-1 min-w-0" aria-label={p.label} />
          {teks && <a href={teks} target="_blank" rel="noopener noreferrer" className="text-sky-300" aria-label="Buka tautan"><IkonTaut size={14} /></a>}
        </span>
      );
    case 'lokasi': {
      const mapsUrl = teks ? buatTautanGoogleMaps(teks) : '';
      return (
        <div className="flex items-center gap-1.5 w-full">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={teks}
              onChange={(e) => onUbah(e.target.value || null)}
              placeholder="Nama tempat, koordinat, atau link Maps"
              className="input-retro !py-1 !text-[13px] !pr-7 w-full"
              aria-label={p.label}
            />
            <MapPin size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
          {teks && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-retro btn-retro-sm !bg-emerald-800 hover:!bg-emerald-700 !text-white flex items-center gap-1 shrink-0 px-2 py-1 text-[11px]"
              title="Buka lokasi di Google Maps"
            >
              <MapPin size={12} className="text-red-300" />
              <span className="hidden sm:inline">Buka Maps</span>
              <ExternalLink size={10} />
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) {
                alert('Fitur GPS tidak didukung di browser ini.');
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const lat = pos.coords.latitude.toFixed(6);
                  const lng = pos.coords.longitude.toFixed(6);
                  onUbah(`${lat}, ${lng}`);
                },
                (err) => {
                  alert('Gagal mengambil titik GPS: ' + err.message);
                },
                { enableHighAccuracy: true, timeout: 8000 }
              );
            }}
            className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-zinc-300 shrink-0 px-2 py-1 text-[11px]"
            title="Isi koordinat GPS perangkat saat ini"
          >
            GPS
          </button>
        </div>
      );
    }
    default:
      return <input type="text" value={teks} onChange={(e) => onUbah(e.target.value || null)} className="input-retro !py-1 !text-[13px]" aria-label={p.label} />;
  }
};

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 28);

/** Formulir kecil menambah kolom kustom memo (Admin/Supervisor). */
export const TambahPropertiMemo: React.FC<{
  ada: Properti[]; notify: (m: string) => void; onSelesai: () => void;
}> = ({ ada, notify, onSelesai }) => {
  const [buka, setBuka] = useState(false);
  const [label, setLabel] = useState('');
  const [tipe, setTipe] = useState<Properti['tipe']>('teks');
  const [opsi, setOpsi] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const simpan = async () => {
    const nama = label.trim();
    if (!nama) { notify('NAMA KOLOM WAJIB DIISI'); return; }
    const daftarOpsi = opsi.split(',').map((o) => o.trim()).filter(Boolean);
    if (tipe === 'select' && daftarOpsi.length === 0) { notify('ISI PILIHAN, PISAHKAN DENGAN KOMA'); return; }
    let id = `m_${slug(nama) || 'kolom'}`;
    for (let n = 2; ada.some((p) => p.id === id); n++) id = `m_${slug(nama) || 'kolom'}_${n}`;
    setSibuk(true);
    try {
      await api('/api/properti', { body: { id, label: nama, tipe, opsi: tipe === 'select' ? daftarOpsi : undefined, entitas: 'memo' } });
      notify('KOLOM MEMO DITAMBAHKAN');
      setLabel(''); setOpsi(''); setTipe('teks'); setBuka(false);
      onSelesai();
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENAMBAH KOLOM');
    } finally { setSibuk(false); }
  };

  if (!buka) {
    return <button type="button" onClick={() => setBuka(true)} className="text-[12px] text-zinc-400 hover:text-white flex items-center gap-1 py-1"><Plus size={12} /> Tambah properti</button>;
  }
  return (
    <div className="border-2 border-white/15 p-2 space-y-2 bg-white/[0.03]">
      <div className="flex gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nama properti (mis. Lokasi, Titik Kumpul)" className="input-retro !py-1 !text-[13px] flex-1 min-w-0" aria-label="Nama properti" />
        <select value={tipe} onChange={(e) => setTipe(e.target.value as Properti['tipe'])} className="input-retro !py-1 !text-[13px] !w-auto" aria-label="Jenis properti">
          {([['teks', 'Teks'], ['angka', 'Angka'], ['tanggal', 'Tanggal'], ['select', 'Pilihan'], ['orang', 'Orang'], ['checkbox', 'Kotak centang'], ['url', 'Tautan'], ['lokasi', '📍 Lokasi / Maps']] as const).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {tipe === 'select' && <input value={opsi} onChange={(e) => setOpsi(e.target.value)} placeholder="Pilihan, pisahkan dengan koma" className="input-retro !py-1 !text-[13px]" aria-label="Pilihan" />}
      <div className="flex gap-2">
        <button type="button" onClick={simpan} disabled={sibuk} className="btn-retro btn-retro-sm bg-lime-600">{sibuk ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Tambah</button>
        <button type="button" onClick={() => setBuka(false)} className="btn-retro btn-retro-sm bg-zinc-800"><X size={12} /> Batal</button>
      </div>
    </div>
  );
};

/** Pemilih PICA tertaut. Daftar PICA diambil sekali, saat pilihan dibuka. */
export const PilihPicaMemo: React.FC<{
  memo: Pick<Memo, 'pica_id' | 'pica_no' | 'pica_judul'>; boleh: boolean;
  onUbah: (id: string | null, ringkas: { no: number | null; judul: string | null; status: string | null }) => void;
  onBukaPica?: (id: string) => void;
}> = ({ memo, boleh, onUbah, onBukaPica }) => {
  const [daftar, setDaftar] = useState<PicaItem[] | null>(null);
  const [memuat, setMemuat] = useState(false);

  const muat = async () => {
    if (daftar || memuat) return;
    setMemuat(true);
    try {
      const d = await api<{ pica: PicaItem[] }>('/api/pica');
      setDaftar(d.pica ?? []);
    } catch { setDaftar([]); } finally { setMemuat(false); }
  };
  useEffect(() => { if (boleh && memo.pica_id) void muat(); }, [boleh, memo.pica_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const nomor = (p: { no_urut?: number | null; nomor?: number | null }) => (p.no_urut ? `PICA-${String(p.no_urut).padStart(3, '0')}` : '');
  const label = memo.pica_id
    ? `${memo.pica_no ? `PICA-${String(memo.pica_no).padStart(3, '0')} · ` : ''}${memo.pica_judul ?? memo.pica_id}`
    : '—';

  if (!boleh) {
    return memo.pica_id
      ? <button type="button" onClick={() => onBukaPica?.(memo.pica_id!)} className="text-[13px] text-amber-200 underline text-left">{label}</button>
      : <span className="text-[13px] text-zinc-200">—</span>;
  }
  return (
    <span className="flex items-center gap-2 min-w-0">
      <select
        value={memo.pica_id ?? ''}
        onFocus={muat}
        onMouseDown={muat}
        onChange={(e) => {
          const id = e.target.value || null;
          const p = daftar?.find((x) => x.id === id);
          onUbah(id, { no: p?.no_urut ?? null, judul: p?.judul ?? null, status: p?.status ?? null });
        }}
        className="input-retro !py-1 !text-[13px] min-w-0 flex-1"
        aria-label="PICA tertaut"
      >
        <option value="">— tidak ditautkan</option>
        {memo.pica_id && !daftar?.some((p) => p.id === memo.pica_id) && <option value={memo.pica_id}>{label}</option>}
        {(daftar ?? []).filter((p) => p.status !== 'Closed' || p.id === memo.pica_id).map((p) => (
          <option key={p.id} value={p.id}>{nomor(p) ? `${nomor(p)} · ` : ''}{p.judul.slice(0, 70)}</option>
        ))}
      </select>
      {memuat && <Loader2 size={13} className="animate-spin text-zinc-400 shrink-0" />}
      {memo.pica_id && onBukaPica && <button type="button" onClick={() => onBukaPica(memo.pica_id!)} className="text-[12px] text-amber-200 underline shrink-0">Buka</button>}
    </span>
  );
};
