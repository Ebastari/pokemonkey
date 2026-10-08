import React, { useEffect, useRef, useState } from 'react';
import { Check, ExternalLink, Link as IkonTaut, Loader2, Map, MapPin, Navigation, Plus, Search, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../lib/api';
import { ambilNamaTempatDariKoordinat, cariDaftarTempat } from '../lib/geokoding';
import type { AnggotaRingkas, Properti } from '../lib/tipe-api';
import type { PicaItem } from '../lib/tipe-api';
import type { Memo } from '../types';
import * as W from '../lib/waktu';
import { ModalPilihPica } from './ModalPilihPica';

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
    case 'lokasi':
      return <EditorPropertiLokasi p={p} teks={teks} onUbah={onUbah} />;
    default:
      return <input type="text" value={teks} onChange={(e) => onUbah(e.target.value || null)} className="input-retro !py-1 !text-[13px]" aria-label={p.label} />;
  }
};

const pinPetaRetro = L.divIcon({
  className: 'pin-peta-memo',
  html: '<div style="font-size:28px;line-height:1;margin-left:-14px;margin-top:-28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">📍</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

/** Modal peta interaktif untuk memilih titik lokasi dan otomatis mendeteksi nama tempatnya */
const ModalPilihPeta: React.FC<{
  awal?: string;
  onPilih: (namaTempat: string) => void;
  onTutup: () => void;
}> = ({ awal, onPilih, onTutup }) => {
  const wadahPetaRef = useRef<HTMLDivElement>(null);
  const petaRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [alamatTerpilih, setAlamatTerpilih] = useState<string>(awal || 'Mendeteksi lokasi...');
  const [sedangCari, setSedangCari] = useState<boolean>(false);
  const [kataKunci, setKataKunci] = useState<string>('');

  useEffect(() => {
    if (!wadahPetaRef.current || petaRef.current) return;

    // Koordinat pusat default: Kalimantan Selatan (area operasional)
    const pusatDefault: [number, number] = [-3.44, 114.83];
    const map = L.map(wadahPetaRef.current).setView(pusatDefault, 13);
    petaRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(pusatDefault, { icon: pinPetaRetro, draggable: true }).addTo(map);
    markerRef.current = marker;

    const perbaruiTitik = async (lat: number, lng: number) => {
      setSedangCari(true);
      setAlamatTerpilih('Mencari nama tempat...');
      const nama = await ambilNamaTempatDariKoordinat(lat, lng);
      setAlamatTerpilih(nama);
      setSedangCari(false);
    };

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      void perbaruiTitik(e.latlng.lat, e.latlng.lng);
    });

    marker.on('dragend', () => {
      const p = marker.getLatLng();
      void perbaruiTitik(p.lat, p.lng);
    });

    // Coba ambil lokasi GPS perangkat saat ini untuk memposisikan peta
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (petaRef.current && markerRef.current) {
            petaRef.current.setView([lat, lng], 15);
            markerRef.current.setLatLng([lat, lng]);
            void perbaruiTitik(lat, lng);
          }
        },
        () => {
          void perbaruiTitik(pusatDefault[0], pusatDefault[1]);
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      void perbaruiTitik(pusatDefault[0], pusatDefault[1]);
    }

    setTimeout(() => map.invalidateSize(), 250);

    return () => {
      map.remove();
      petaRef.current = null;
    };
  }, []);

  const cariTempatAksi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kataKunci.trim() || !petaRef.current || !markerRef.current) return;
    setSedangCari(true);
    const hasil = await cariDaftarTempat(kataKunci);
    setSedangCari(false);
    if (hasil.length > 0) {
      const t = hasil[0];
      petaRef.current.setView([t.lat, t.lng], 16);
      markerRef.current.setLatLng([t.lat, t.lng]);
      setAlamatTerpilih(t.nama + (t.alamatLengkap ? `, ${t.alamatLengkap.split(',').slice(1, 3).join(', ')}` : ''));
    } else {
      alert(`Tempat "${kataKunci}" tidak ditemukan.`);
    }
  };

  const pusatkanKeGps = () => {
    if (!navigator.geolocation) return;
    setSedangCari(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (petaRef.current && markerRef.current) {
          petaRef.current.setView([lat, lng], 16);
          markerRef.current.setLatLng([lat, lng]);
        }
        const nama = await ambilNamaTempatDariKoordinat(lat, lng);
        setAlamatTerpilih(nama);
        setSedangCari(false);
      },
      () => setSedangCari(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3" onClick={onTutup}>
      <div className="retro-box !bg-zinc-900 border-lime-500 w-full max-w-lg flex flex-col !p-0 overflow-hidden max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        {/* Header Modal */}
        <div className="flex items-center justify-between px-3 py-2 border-b-2 border-white/15 bg-zinc-950">
          <div className="flex items-center gap-2 text-white font-bold text-[13px]">
            <MapPin size={15} className="text-lime-400" />
            <span>Pilih Lokasi Tempat di Peta</span>
          </div>
          <button type="button" onClick={onTutup} className="text-zinc-400 hover:text-white" aria-label="Tutup"><X size={18} /></button>
        </div>

        {/* Pencarian Tempat & Tombol GPS */}
        <form onSubmit={cariTempatAksi} className="flex gap-2 p-2 border-b border-white/10 bg-zinc-900">
          <input
            type="text"
            value={kataKunci}
            onChange={(e) => setKataKunci(e.target.value)}
            placeholder="Cari nama tempat / jalan / site..."
            className="input-retro !py-1 !text-[12px] flex-1 min-w-0"
          />
          <button type="submit" disabled={sedangCari} className="btn-retro btn-retro-sm !bg-lime-700 !text-white flex items-center gap-1 text-[11px]">
            {sedangCari ? <Loader2 size={11} className="animate-spin" /> : <Search size={11} />}
            <span>Cari</span>
          </button>
          <button
            type="button"
            onClick={pusatkanKeGps}
            disabled={sedangCari}
            className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-lime-400 flex items-center gap-1 text-[11px]"
            title="Pusatkan ke lokasi saya"
          >
            <Navigation size={11} />
            <span className="hidden sm:inline">GPS Saya</span>
          </button>
        </form>

        {/* Kontainer Peta Leaflet */}
        <div ref={wadahPetaRef} className="h-64 w-full bg-zinc-800 relative z-0" />

        {/* Hasil Deteksi Tempat */}
        <div className="p-3 bg-zinc-950 border-t border-white/10 space-y-2">
          <div className="text-[11px] text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <MapPin size={11} className="text-red-400" />
            <span>Nama Tempat (klik/geser pin di peta):</span>
          </div>
          <div className="text-[13px] text-white font-medium bg-zinc-900 p-2 border border-white/10 rounded break-words min-h-[38px] flex items-center">
            {sedangCari ? (
              <span className="flex items-center gap-1.5 text-zinc-400 text-[12px]">
                <Loader2 size={13} className="animate-spin text-lime-400" />
                Mendeteksi nama tempat...
              </span>
            ) : (
              alamatTerpilih
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => onPilih(alamatTerpilih)}
              disabled={sedangCari || !alamatTerpilih || alamatTerpilih === 'Mendeteksi lokasi...'}
              className="btn-retro btn-retro-sm !bg-lime-600 hover:!bg-lime-500 !text-black font-bold flex-1 py-1.5 text-[12px] flex items-center justify-center gap-1.5"
            >
              <Check size={14} /> Gunakan Tempat Ini
            </button>
            <button
              type="button"
              onClick={onTutup}
              className="btn-retro btn-retro-sm !bg-zinc-800 text-zinc-300 py-1.5 px-3 text-[12px]"
            >
              Batal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Editor properti Lokasi: otomatis mendeteksi nama tempat (bukan koordinat mentah), pilih di peta, dan buka Google Maps */
const EditorPropertiLokasi: React.FC<{
  p: Properti;
  teks: string;
  onUbah: (v: string | null) => void;
}> = ({ p, teks, onUbah }) => {
  const [sedangGps, setSedangGps] = useState(false);
  const [bukaPeta, setBukaPeta] = useState(false);

  const ambilLokasiOtomatis = async () => {
    if (!navigator.geolocation) {
      alert('Perangkat/browser Anda tidak mendukung fitur lokasi GPS.');
      return;
    }
    setSedangGps(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const namaTempat = await ambilNamaTempatDariKoordinat(lat, lng);
          onUbah(namaTempat);
        } catch {
          alert('Gagal mendeteksi nama tempat.');
        } finally {
          setSedangGps(false);
        }
      },
      (err) => {
        setSedangGps(false);
        alert('Gagal mengambil titik GPS: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  };

  const mapsUrl = teks ? buatTautanGoogleMaps(teks) : '';

  return (
    <>
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 w-full">
        <div className="relative flex-1 min-w-[170px]">
          <input
            type="text"
            value={teks}
            onChange={(e) => onUbah(e.target.value || null)}
            placeholder="Nama tempat / alamat (mis. Site EBL, Asam-Asam)"
            className="input-retro !py-1 !text-[13px] !pr-7 w-full"
            aria-label={p.label}
          />
          <MapPin size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        </div>

        {/* Tombol Ambil Lokasi Otomatis (GPS -> Terjemah ke Nama Tempat Nyata) */}
        <button
          type="button"
          onClick={ambilLokasiOtomatis}
          disabled={sedangGps}
          className="btn-retro btn-retro-sm !bg-lime-800 hover:!bg-lime-700 !text-lime-200 flex items-center gap-1 shrink-0 px-2 py-1 text-[11px]"
          title="Ambil lokasi otomatis dari GPS dan ubah menjadi nama tempat nyata"
        >
          {sedangGps ? <Loader2 size={12} className="animate-spin text-lime-300" /> : <Navigation size={12} className="text-lime-300" />}
          <span>{sedangGps ? 'Mendeteksi...' : 'Lokasi Otomatis'}</span>
        </button>

        {/* Tombol Buka Peta Interaktif */}
        <button
          type="button"
          onClick={() => setBukaPeta(true)}
          className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-zinc-200 flex items-center gap-1 shrink-0 px-2 py-1 text-[11px]"
          title="Buka peta untuk mencari atau memilih titik tempat"
        >
          <Map size={12} className="text-amber-400" />
          <span className="hidden sm:inline">Peta</span>
        </button>

        {/* Tombol Buka di Google Maps */}
        {teks && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-retro btn-retro-sm !bg-blue-900 hover:!bg-blue-800 !text-white flex items-center gap-1 shrink-0 px-2 py-1 text-[11px]"
            title="Buka tempat ini di Google Maps"
          >
            <MapPin size={11} className="text-red-400" />
            <span className="hidden md:inline">Google Maps</span>
            <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Modal Peta Interaktif */}
      {bukaPeta && (
        <ModalPilihPeta
          awal={teks}
          onPilih={(tempat) => {
            onUbah(tempat);
            setBukaPeta(false);
          }}
          onTutup={() => setBukaPeta(false)}
        />
      )}
    </>
  );
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

/** Pemilih PICA tertaut dengan antarmuka modal berfilter status (Open, Continue, Selesai, Semua). */
export const PilihPicaMemo: React.FC<{
  memo: Pick<Memo, 'pica_id' | 'pica_no' | 'pica_judul'>; boleh: boolean;
  onUbah: (id: string | null, ringkas: { no: number | null; judul: string | null; status: string | null }) => void;
  onBukaPica?: (id: string) => void;
}> = ({ memo, boleh, onUbah, onBukaPica }) => {
  const [bukaModal, setBukaModal] = useState(false);

  const label = memo.pica_id
    ? `${memo.pica_no ? `PICA-${String(memo.pica_no).padStart(3, '0')} · ` : ''}${memo.pica_judul ?? memo.pica_id}`
    : '—';

  if (!boleh) {
    return memo.pica_id
      ? <button type="button" onClick={() => onBukaPica?.(memo.pica_id!)} className="text-[13px] text-amber-200 underline text-left">{label}</button>
      : <span className="text-[13px] text-zinc-200">—</span>;
  }

  return (
    <>
      <div className="flex items-center gap-1.5 min-w-0">
        {memo.pica_id ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setBukaModal(true)}
              className="px-2 py-0.5 border border-amber-400/60 bg-amber-950/30 text-amber-200 hover:border-amber-300 text-[12px] font-bold rounded-xs truncate max-w-[240px]"
              title="Ganti PICA tertaut"
            >
              {label}
            </button>
            {onBukaPica && (
              <button
                type="button"
                onClick={() => onBukaPica(memo.pica_id!)}
                className="text-[12px] text-amber-200 underline shrink-0 hover:text-white"
              >
                Buka
              </button>
            )}
            <button
              type="button"
              onClick={() => onUbah(null, { no: null, judul: null, status: null })}
              className="text-zinc-500 hover:text-red-300 p-0.5 shrink-0"
              title="Lepas tautan PICA"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setBukaModal(true)}
            className="flex items-center gap-1 text-[12px] text-zinc-400 hover:text-amber-300 py-0.5 px-1.5 border border-dashed border-white/20 hover:border-amber-400"
          >
            <Plus size={11} /> Tautkan PICA
          </button>
        )}
      </div>

      {bukaModal && (
        <ModalPilihPica
          terpilihId={memo.pica_id}
          onPilih={(p) => {
            onUbah(p.id, { no: p.no_urut ?? null, judul: p.judul ?? null, status: p.status ?? null });
            setBukaModal(false);
          }}
          onLepas={() => {
            onUbah(null, { no: null, judul: null, status: null });
            setBukaModal(false);
          }}
          onTutup={() => setBukaModal(false)}
        />
      )}
    </>
  );
};
