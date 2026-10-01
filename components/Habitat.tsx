import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { TreePine, ChevronRight, ClipboardList, Bell, CalendarDays, AlarmClock, Coins, Flame, Sprout, Trees } from 'lucide-react';
import { GameState, Skin } from '../types';
import type { Opsi, Pengguna } from '../lib/tipe-api';
import type { AlarmItem } from '../lib/alarm';
import { PanelAnggota } from './PanelAnggota';
import { SKINS } from '../constants';
import { api } from '../lib/api';
import { MonkeySprite } from './MonkeySprite';
import { PanelRealisasi } from './PanelRealisasi';
import { useCuaca, HujanKebun, ChipCuaca, PanelCuaca } from './CuacaKebun';
import { useTitikApi, ChipTitikApi, PanelTitikApi } from './TitikApiKebun';
import { ModalRingkasanLapangan } from './ModalRingkasanLapangan';
import { ringkasRevegetasi, totalTahun, ha, type BarisRevegetasi } from '../lib/revegetasi';
import { perbaruiDataWidgetHp } from '../lib/widget';

/**
 * KEBUN — habitat bersama. Monyet Anda berkeliling sendiri: memilih tujuan
 * acak, berjalan ke sana, berhenti sejenak, kadang melompat. Ketuk tanah
 * untuk menyuruhnya ke titik itu. Stamina rendah = jalan lambat; habis = diam.
 */

interface ActiveUser {
  userId: string;
  name: string;
  skinId: string;
  posX: number;
  posY: number;
  stamina: number;
  level: number;
  status?: string | null;
}

interface Props {
  state: GameState;
  skin: Skin;
  dialogue: string;
  onSetDialogue: (d: string) => void;
  onPindah: (pos: { x: number; y: number; facing: 'left' | 'right' }) => void;
  /** Pemakai yang sedang masuk; Admin boleh mengisi angka realisasi revegetasi. */
  pengguna?: Pengguna;
  /** Pisang di kebun menambah XP lewat jalur yang sama dengan Monkey Run. */
  onGainXP?: (xp: number) => void;
  opsiRoster?: Opsi[];
  notify?: (pesan: string) => void;
  /** Teks di atas kepala monyet Anda (terlihat anggota lain). */
  statusTeks?: string;
  onUbahStatus?: (teks: string) => void;
  /** Papan INFO di kebun: jumlah pengumuman belum dibaca, dan pintasan ke tab INFO. */
  jumlahInfoBaru?: number;
  onBukaInfo?: () => void;
  /** Widget PICA: jumlah tugas open dan indikator telat */
  jumlahPicaTerbuka?: number;
  adaPicaTelat?: boolean;
  onBukaPica?: () => void;
  /** Widget KALENDER: jumlah agenda hari ini */
  jumlahAcaraHariIni?: number;
  onBukaJadwal?: () => void;
  /** Widget ALARM: agenda meeting/acara & nada dering */
  daftarAlarm?: AlarmItem[];
  sedangAlarm?: boolean;
  onBukaAlarm?: () => void;
  /** Widget NOTIF: pintasan ke tab notifikasi */
  onBukaNotif?: () => void;
  /** Widget MONEY: pintasan ke Money Monkey (Anggaran & RAB) */
  onBukaMoney?: () => void;
  /** Widget FIRE: pintasan ke Fire Monkey (Hotspot & Karhutla) */
  onBukaFire?: () => void;
}

interface Pisang { id: number; x: number; y: number }
interface AngkaNaik { id: number; x: number; y: number; teks: string }

/** Satu pisang = 10 XP, dibatasi 15 pisang sehari supaya peringkat tim tetap soal kerja. */
const XP_PISANG = 10;
const BATAS_PISANG_HARIAN = 15;
const kunciPisangHariIni = () => `pokemonkey_pisang_${new Date(Date.now() + 480 * 60000).toISOString().slice(0, 10)}`;

const BATAS = { xMin: 6, xMax: 94, yMin: 18, yMax: 88 };
/** Pilihan cepat untuk teks status; tetap bisa diketik bebas. */
const STATUS_CEPAT = ['Di lapangan', 'Di nursery', 'Rapat', 'Di kantor', 'Istirahat dulu'];
/** Ucapan sesaat (hasil lapor, stamina, dsb.) kembali ke teks status setelah beberapa detik. */
const LAMA_UCAPAN_MS = 6000;
const acak = (a: number, b: number) => a + Math.random() * (b - a);
/** Balon teks dekat tepi kebun diratakan ke dalam supaya tidak terpotong. */
const sisiBalon = (x: number): 'kiri' | 'kanan' | 'tengah' => (x < 24 ? 'kiri' : x > 76 ? 'kanan' : 'tengah');

export const Habitat: React.FC<Props> = ({
  state, skin, dialogue, onSetDialogue, onPindah, pengguna, onGainXP, opsiRoster, notify, statusTeks, onUbahStatus,
  jumlahInfoBaru = 0, onBukaInfo, jumlahPicaTerbuka = 0, adaPicaTelat = false, onBukaPica,
  jumlahAcaraHariIni = 0, onBukaJadwal,
  daftarAlarm = [], sedangAlarm = false, onBukaAlarm,
  onBukaNotif, onBukaMoney, onBukaFire,
}) => {
  const [others, setOthers] = useState<ActiveUser[]>([]);
  const [reveg, setReveg] = useState<BarisRevegetasi[]>([]);
  const [panelBuka, setPanelBuka] = useState(false);
  const [anggota, setAnggota] = useState<{ id: string; nama: string } | null>(null);
  const [pisang, setPisang] = useState<Pisang[]>([]);
  const [angkaNaik, setAngkaNaik] = useState<AngkaNaik[]>([]);
  const [incaranPisang, setIncaranPisang] = useState<number | null>(null);
  const [ubahStatus, setUbahStatus] = useState(false);
  const [panelCuaca, setPanelCuaca] = useState(false);
  const [panelApi, setPanelApi] = useState(false);
  const [modalLapangan, setModalLapangan] = useState<'nursery' | 'geotag' | null>(null);
  const { data: titikApi, muat: muatTitikApi } = useTitikApi();
  const { cuaca, galat: galatCuaca, muat: muatCuaca } = useCuaca();

  useEffect(() => {
    if (!cuaca?.sekarang) return;
    const teksCuaca = `${cuaca.sekarang.suhu}°C · ${cuaca.sekarang.ket || 'Cerah'}${cuaca.hujan ? ' 🌧️' : ''}`;
    void perbaruiDataWidgetHp({ cuaca: teksCuaca });
  }, [cuaca]);

  useEffect(() => {
    if (!titikApi) return;
    const ZONA_WASPADA = ['ippkh', 'iup', 'waspada'];
    const bahaya = (titikApi.titik ?? []).filter((t) => (t.status === 'baru' || t.status === 'dicek') && ZONA_WASPADA.includes(t.zona)).length;
    const teksApi = bahaya > 0 ? `⚠️ ${bahaya} Titik Api Perlu Cek!` : 'Aman (0 Titik)';
    void perbaruiDataWidgetHp({ titikApi: teksApi, titikApiBahaya: bahaya > 0 });
  }, [titikApi]);
  const hujanSebelumnya = useRef(0);
  const nomorRef = useRef(1);
  const [pos, setPos] = useState({ x: state.monkeyPos.x, y: state.monkeyPos.y });
  const [hadap, setHadap] = useState<'left' | 'right'>(state.monkeyPos.facing);
  const [aksi, setAksi] = useState<'diam' | 'jalan' | 'lompat'>('diam');
  const [durasi, setDurasi] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const posRef = useRef(pos);
  posRef.current = pos;

  const lelah = state.stamina < 30;
  const habis = state.stamina <= 0;

  useEffect(() => {
    if (!state.isLoggedIn) return;
    const fetchOthers = async () => {
      try {
        const data = await api<{ aktif: ActiveUser[] }>('/api/kehadiran');
        setOthers(data.aktif.filter((u) => u.userId !== state.userId));
      } catch (e) {
        console.warn('Multiplayer sync offline/error:', e);
      }
    };
    fetchOthers();
    const interval = setInterval(fetchOthers, 30000);
    const saatKembali = () => { if (document.visibilityState === 'visible') fetchOthers(); };
    document.addEventListener('visibilitychange', saatKembali);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', saatKembali); };
  }, [state.userId, state.isLoggedIn]);

  // Realisasi area/revegetasi: angka dari server/demo lokal.
  const muatRevegetasi = useCallback(() => {
    api<{ revegetasi: BarisRevegetasi[] }>('/api/revegetasi')
      .then((d) => { setReveg(d.revegetasi ?? []); })
      .catch(() => undefined);
  }, []);
  useEffect(() => { muatRevegetasi(); }, [muatRevegetasi]);

  /**
   * Jalan ke titik tujuan; lamanya sebanding jarak dan stamina. `onTiba` hanya
   * dijalankan bila perjalanan ini selesai — tujuan baru di tengah jalan membatalkannya.
   */
  const jalanKe = useCallback((x: number, y: number, opsi?: { onTiba?: () => void; cepat?: boolean }) => {
    const dari = posRef.current;
    const jarak = Math.hypot(x - dari.x, y - dari.y);
    const kecepatan = (lelah ? 6 : 13) * (opsi?.cepat ? 1.7 : 1); // persen layar per detik
    const detik = Math.max(opsi?.cepat ? 0.35 : 0.6, jarak / kecepatan);
    if (!opsi?.onTiba) setIncaranPisang(null);
    setHadap(x >= dari.x ? 'right' : 'left');
    setDurasi(detik);
    setAksi('jalan');
    setPos({ x, y });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setAksi('diam');
      onPindah({ x, y, facing: x >= dari.x ? 'right' : 'left' });
      opsi?.onTiba?.();
    }, detik * 1000);
  }, [lelah, onPindah]);

  // Pengembara: pilih tujuan baru setiap beberapa detik saat sedang diam.
  useEffect(() => {
    if (state.isPaused || habis || aksi !== 'diam') return;
    const jeda = setTimeout(() => {
      if (Math.random() < 0.22) {
        setAksi('lompat');
        setTimeout(() => setAksi('diam'), 700);
        return;
      }
      jalanKe(acak(BATAS.xMin, BATAS.xMax), acak(BATAS.yMin, BATAS.yMax));
    }, acak(2200, 6000));
    return () => clearTimeout(jeda);
  }, [aksi, state.isPaused, habis, jalanKe]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Monyet berkomentar sekali saat hujan mulai turun di kebun.
  useEffect(() => {
    const h = cuaca?.hujan ?? 0;
    if (h > 0 && hujanSebelumnya.current === 0) {
      onSetDialogue(cuaca?.petir ? 'Uu! Ada petir, jangan di area terbuka!' : 'Uu... hujan turun! Hati-hati, jalan licin.');
    }
    hujanSebelumnya.current = h;
  }, [cuaca?.hujan, cuaca?.petir, onSetDialogue]);

  useEffect(() => {
    if (!dialogue) return;
    const t = setTimeout(() => onSetDialogue(''), LAMA_UCAPAN_MS);
    return () => clearTimeout(t);
  }, [dialogue, onSetDialogue]);

  /** Pisang muncul acak sebagai selingan; maksimal empat di layar agar kebun tidak ramai. */
  useEffect(() => {
    if (state.isPaused) return;
    const taruh = () => setPisang((p) => (p.length >= 4
      ? p
      : [...p, { id: nomorRef.current++, x: acak(BATAS.xMin, BATAS.xMax), y: acak(BATAS.yMin, BATAS.yMax) }]));
    taruh();
    const t = setInterval(taruh, 7000);
    return () => clearInterval(t);
  }, [state.isPaused]);

  /** Ketuk pisang: monyet berlari ke sana dulu; pisang baru hilang (dan XP masuk) saat ia tiba. */
  const ambilPisang = (p: Pisang, e: React.MouseEvent) => {
    e.stopPropagation();
    if (habis) { onSetDialogue('Uu... lemas, tidak kuat jalan. Kirim laporan dulu di FEED.'); return; }
    if (incaranPisang === p.id) return;
    setIncaranPisang(p.id);
    jalanKe(p.x, p.y, { cepat: true, onTiba: () => makanPisang(p) });
  };

  const makanPisang = (p: Pisang) => {
    setIncaranPisang(null);
    setPisang((d) => d.filter((x) => x.id !== p.id));
    setAksi('lompat');
    setTimeout(() => setAksi('diam'), 500);

    let sudah = 0;
    try { sudah = Number(localStorage.getItem(kunciPisangHariIni()) || 0); } catch { /* abaikan */ }
    const dapat = sudah < BATAS_PISANG_HARIAN ? XP_PISANG : 0;
    if (dapat > 0) {
      try { localStorage.setItem(kunciPisangHariIni(), String(sudah + 1)); } catch { /* abaikan */ }
      onGainXP?.(dapat);
    }

    const id = nomorRef.current++;
    setAngkaNaik((a) => [...a, { id, x: p.x, y: p.y, teks: dapat > 0 ? `+${dapat} XP` : 'Kenyang!' }]);
    setTimeout(() => setAngkaNaik((a) => a.filter((x) => x.id !== id)), 1100);
  };

  const ketukTanah = (e: React.MouseEvent<HTMLDivElement>) => {
    if (habis) { onSetDialogue('Uu... stamina habis. Kirim laporan dulu di FEED.'); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(BATAS.xMax, Math.max(BATAS.xMin, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(BATAS.yMax, Math.max(BATAS.yMin, ((e.clientY - r.top) / r.height) * 100));
    jalanKe(x, y);
  };

  const treePositions = useMemo(() => {
    const count = Math.min(80, Math.floor(state.plantedArea));
    return Array.from({ length: count }).map((_, i) => ({
      x: Math.abs(Math.sin(i * 123.45)) * 90 + 5,
      y: Math.abs(Math.cos(i * 678.9)) * 80 + 10,
      size: 16 + Math.abs(Math.sin(i)) * 24,
    }));
  }, [state.plantedArea]);

  const ringkas = useMemo(() => ringkasRevegetasi(reveg), [reveg]);

  const grassDecor = useMemo(() => Array.from({ length: 40 }).map((_, i) => ({
    x: Math.abs(Math.sin(i * 444)) * 95,
    y: Math.abs(Math.cos(i * 555)) * 95,
  })), []);

  return (
    <div className="flex-1 garden-bg relative overflow-hidden m-0 md:m-1 min-h-[300px] cursor-pointer shadow-inner" onClick={ketukTanah}>
      {grassDecor.map((g, i) => (
        <div key={`g-${i}`} className="absolute w-1 h-1 bg-green-700/30 rounded-full" style={{ left: `${g.x}%`, top: `${g.y}%` }} />
      ))}
      {treePositions.map((p, i) => (
        <div key={`t-${i}`} className="absolute opacity-90 drop-shadow-md pointer-events-none" style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, transform: 'translate(-50%, -100%)' }}>
          <TreePine className="text-green-900" size={p.size} />
        </div>
      ))}

      {/* Hujan (dan kilat) mengikuti prakiraan BMKG slot sekarang; di bawah monyet, di atas pohon. */}
      <HujanKebun
        tingkat={cuaca?.hujan ?? 0}
        petir={cuaca?.petir}
        kabut={[5, 10, 45].includes(cuaca?.sekarang?.kode ?? -1)}
      />
      <ChipCuaca cuaca={cuaca} galat={galatCuaca} onBuka={() => setPanelCuaca(true)} />
      <ChipTitikApi data={titikApi} onBuka={() => setPanelApi(true)} />
      {onBukaPica && (
        <ChipPica
          jumlah={jumlahPicaTerbuka}
          telat={adaPicaTelat}
          onBuka={onBukaPica}
        />
      )}
      {onBukaJadwal && (
        <ChipKalender
          jumlah={jumlahAcaraHariIni}
          onBuka={onBukaJadwal}
        />
      )}
      {onBukaAlarm && (
        <ChipAlarm
          daftarAlarm={daftarAlarm}
          sedangBunyi={sedangAlarm}
          onBuka={onBukaAlarm}
        />
      )}
      {onBukaNotif && (
        <ChipNotif onBuka={onBukaNotif} />
      )}
      {onBukaMoney && (
        <ChipMoney onBuka={onBukaMoney} />
      )}
      {onBukaFire && (
        <ChipFire onBuka={onBukaFire} />
      )}
      <ChipNursery onBuka={() => setModalLapangan('nursery')} />
      <ChipGeotag onBuka={() => setModalLapangan('geotag')} />

      {/* Papan INFO: pintasan ke pengumuman, dengan lencana yang belum dibaca. */}
      {onBukaInfo && (
        <button
          onClick={(e) => { e.stopPropagation(); onBukaInfo(); }}
          className="absolute z-20 left-2 top-2 flex flex-col items-center group"
          aria-label={jumlahInfoBaru > 0 ? `Papan info: ${jumlahInfoBaru} pengumuman belum dibaca` : 'Papan info: buka pengumuman'}
          title="Buka INFO"
        >
          <PapanInfo baru={jumlahInfoBaru} />
        </button>
      )}

      {/* Pemain lain: bergeser pelan ke posisi terbarunya; diketuk membuka kartunya. */}
      {others.map((user) => (
        <button
          key={user.userId}
          onClick={(e) => { e.stopPropagation(); setAnggota({ id: user.userId, nama: user.name }); }}
          title={`Lihat progres ${user.name}`}
          aria-label={`Lihat progres ${user.name}`}
          className="absolute transition-all duration-[4000ms] ease-in-out z-20"
          style={{ left: `${user.posX}%`, top: `${user.posY}%`, transform: 'translate(-50%, -100%)' }}
        >
          <PlayerSprite nama={user.name} skin={SKINS.find((s) => s.id === user.skinId) ?? SKINS[0]} stamina={user.stamina} level={user.level} pose="diam" hadap="right" isMe={false} dialogue={user.status ?? undefined} sisi={sisiBalon(user.posX)} />
        </button>
      ))}

      {/* Pisang: selingan kecil yang menambah XP. */}
      {pisang.map((p) => (
        <button
          key={p.id}
          onClick={(e) => ambilPisang(p, e)}
          aria-label="Ambil pisang"
          className={`absolute z-20 p-1.5 ${incaranPisang === p.id ? 'pisang-diincar' : ''}`}
          style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          {/* Animasi di elemen dalam: transform-nya tidak boleh menimpa translate penengah di atas. */}
          <span className="block animate-pisang"><PisangIkon /></span>
        </button>
      ))}
      {angkaNaik.map((t) => (
        <span
          key={t.id}
          className="absolute z-30 pointer-events-none font-title text-[9px] text-yellow-200 animate-xp-naik"
          style={{ left: `${t.x}%`, top: `${t.y}%` }}
        >
          {t.teks}
        </span>
      ))}

      {/* Anda — diketuk untuk mengubah teks di atas kepala */}
      <div
        className="absolute z-30 pointer-events-none"
        style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -100%)', transition: aksi === 'jalan' ? `left ${durasi}s linear, top ${durasi}s linear` : 'none' }}
      >
        <button
          className="pointer-events-auto block"
          onClick={(e) => { e.stopPropagation(); if (onUbahStatus) setUbahStatus(true); }}
          aria-label="Ubah teks di atas kepala monyet"
          title="Ketuk untuk mengubah status"
        >
          <PlayerSprite nama="SAYA" skin={skin} stamina={state.stamina} level={state.level} pose={aksi === 'jalan' ? 'jalan' : aksi === 'lompat' ? 'lompat' : 'diam'} hadap={hadap} isMe dialogue={dialogue || statusTeks} lelah={lelah} habis={habis} sisi={sisiBalon(pos.x)} />
        </button>
      </div>

      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end pointer-events-none gap-2">
        <div className="retro-box !bg-black/80 !p-2 flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {others.slice(0, 3).map((u) => (
              <div key={u.userId} className="w-6 h-6 border-2 border-white bg-zinc-800 flex items-center justify-center text-[11px] font-bold">{u.name[0]}</div>
            ))}
            {others.length > 3 && <div className="w-6 h-6 border-2 border-white bg-emerald-600 flex items-center justify-center text-[10px] font-bold">+{others.length - 3}</div>}
          </div>
          <div className="leading-tight">
            <p className="text-[10px] text-zinc-400 uppercase">Aktif 24 jam</p>
            <p className="text-[13px] font-bold">{others.length + 1} orang</p>
          </div>
        </div>
        {reveg.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setPanelBuka(true); }}
            className="retro-box !bg-green-900/90 !border-white/40 !p-2 text-left leading-tight pointer-events-auto flex items-center gap-2"
            title="Lihat grafik realisasi per tahun"
          >
            <div>
              <p className="text-[10px] text-green-200 uppercase">Realisasi area</p>
              <p className="font-title text-[11px] text-white">{ha(ringkas.total)} HA</p>
              <p className="text-[10px] text-green-200/90 tabular-nums">
                {ringkas.terakhir && `${ringkas.terakhir.tahun}: ${ha(totalTahun(ringkas.terakhir))} · `}area {state.plantedArea.toFixed(2)}
              </p>
            </div>
            <span className="flex items-end gap-[2px] h-7" aria-hidden="true">
              {reveg.map((b) => (
                <span key={b.tahun} className="w-[3px] bg-emerald-400" style={{ height: `${Math.max(8, (totalTahun(b) / (ringkas.maks || 1)) * 100)}%` }} />
              ))}
            </span>
            <ChevronRight size={14} className="text-green-200 shrink-0" />
          </button>
        )}
      </div>

      {ubahStatus && onUbahStatus && (
        <FormStatus
          awal={statusTeks ?? ''}
          onSimpan={(t) => { onUbahStatus(t); setUbahStatus(false); }}
          onTutup={() => setUbahStatus(false)}
        />
      )}

      {anggota && pengguna && (
        <PanelAnggota
          userId={anggota.id}
          nama={anggota.nama}
          pengguna={pengguna}
          opsiRoster={opsiRoster}
          notify={notify ?? (() => undefined)}
          onTutup={() => setAnggota(null)}
        />
      )}

      {panelApi && (
        <PanelTitikApi
          data={titikApi}
          admin={pengguna?.peran === 'admin'}
          onMuatUlang={muatTitikApi}
          onTutup={() => setPanelApi(false)}
          notify={notify}
          onBukaFire={onBukaFire ? () => { setPanelApi(false); onBukaFire(); } : undefined}
        />
      )}

      {panelCuaca && (
        <PanelCuaca
          cuaca={cuaca}
          galat={galatCuaca}
          admin={pengguna?.peran === 'admin'}
          onMuatUlang={muatCuaca}
          onTutup={() => setPanelCuaca(false)}
          notify={notify}
        />
      )}

      {modalLapangan && (
        <ModalRingkasanLapangan
          jenis={modalLapangan}
          onTutup={() => setModalLapangan(null)}
        />
      )}

      {panelBuka && (
        <PanelRealisasi
          data={reveg}
          luasKebun={state.plantedArea}
          peran={pengguna?.peran}
          onSimpan={muatRevegetasi}
          onTutup={() => setPanelBuka(false)}
        />
      )}
    </div>
  );
};

const PlayerSprite: React.FC<{
  nama: string; skin: Skin; stamina: number; level: number; isMe: boolean;
  pose: 'diam' | 'jalan' | 'lompat'; hadap: 'left' | 'right'; dialogue?: string; lelah?: boolean; habis?: boolean;
  sisi?: 'kiri' | 'kanan' | 'tengah';
}> = ({ nama, skin, stamina, level, isMe, pose, hadap, dialogue, lelah, habis, sisi = 'tengah' }) => {
  const staminaColor = stamina > 70 ? 'bg-emerald-500' : stamina > 30 ? 'bg-yellow-500' : 'bg-red-600';
  const kelasAnim = habis ? 'grayscale opacity-60' : pose === 'lompat' ? 'animate-monkey-happy' : pose === 'jalan' ? 'animate-monkey-walk' : lelah || (!isMe && stamina < 30) ? 'animate-monkey-tired' : 'animate-monkey-idle';

  return (
    <div className="relative flex flex-col items-center">
      {dialogue && (
        <div className={`absolute bottom-full mb-2 whitespace-normal z-50 w-max ${isMe ? 'max-w-[220px]' : 'max-w-[150px]'} ${sisi === 'kiri' ? 'left-0' : sisi === 'kanan' ? 'right-0' : ''}`}>
          <div className={`pixel-bubble ${isMe ? '' : 'pixel-bubble-kecil'} ${sisi === 'kiri' ? 'pixel-bubble-kiri' : sisi === 'kanan' ? 'pixel-bubble-kanan' : ''}`}>{dialogue}</div>
        </div>
      )}
      <div className="mb-1 flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1 bg-black/70 px-1.5 py-0.5 border border-white/30">
          <span className="text-[10px] font-bold text-yellow-300">LV{level}</span>
          <span className="text-[11px] font-bold text-white uppercase">{nama}</span>
        </div>
        <div className="w-12 h-1.5 bg-black border border-white/40 overflow-hidden">
          <div className={`h-full transition-all duration-500 ${staminaColor}`} style={{ width: `${stamina}%` }} />
        </div>
      </div>
      <div className={kelasAnim}>
        <MonkeySprite skin={skin} pose={pose} hadap={hadap} ukuran={isMe ? 76 : 56} animasi={!habis} />
      </div>
      <div className="w-10 h-2 bg-black/25 rounded-full blur-[2px] -mt-1" />
    </div>
  );
};

/** Pisang 8×8 piksel, sewarna dengan pisang di Monkey Run. */
const PisangIkon: React.FC = () => (
  <svg viewBox="0 0 8 8" width="22" height="22" shapeRendering="crispEdges" aria-hidden="true" className="drop-shadow-[2px_2px_0_rgba(0,0,0,0.35)]">
    <rect x="5" y="1" width="1" height="1" fill="#a16207" />
    <rect x="4" y="2" width="2" height="2" fill="#fde047" />
    <rect x="3" y="3" width="2" height="2" fill="#facc15" />
    <rect x="2" y="4" width="2" height="2" fill="#facc15" />
    <rect x="2" y="5" width="3" height="1" fill="#eab308" />
    <rect x="3" y="6" width="2" height="1" fill="#eab308" />
  </svg>
);

/** Lembar kecil untuk menulis teks di atas kepala monyet. */
const FormStatus: React.FC<{ awal: string; onSimpan: (t: string) => void; onTutup: () => void }> = ({ awal, onSimpan, onTutup }) => {
  const [teks, setTeks] = useState(awal);
  return (
    <div className="absolute inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-3" onClick={(e) => { e.stopPropagation(); onTutup(); }}>
      <form
        className="retro-box !bg-zinc-900 w-full max-w-sm flex flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onSimpan(teks); }}
      >
        <label htmlFor="status-monyet" className="label-retro">Teks di atas kepala monyet</label>
        <input
          id="status-monyet"
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          maxLength={60}
          autoFocus
          placeholder="mis. Di blok 4, cek bibit"
          className="input-retro !py-1.5"
        />
        <div className="flex flex-wrap gap-1">
          {STATUS_CEPAT.map((t) => (
            <button key={t} type="button" onClick={() => setTeks(t)} className="chip-retro border-white/30 text-zinc-200">{t}</button>
          ))}
        </div>
        <p className="text-[11px] text-zinc-400">{teks.length}/60 · terlihat anggota lain di KEBUN. Kosongkan untuk sapaan bawaan.</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={onTutup} className="btn-retro btn-retro-sm bg-zinc-700">Batal</button>
          <button type="submit" className="btn-retro btn-retro-sm bg-emerald-700">Simpan</button>
        </div>
      </form>
    </div>
  );
};

/** Papan kayu piksel bertuliskan INFO, dengan lencana merah untuk pengumuman baru. */
const PapanInfo: React.FC<{ baru: number }> = ({ baru }) => (
  <span className="relative block">
    <svg viewBox="0 0 24 20" width="60" height="50" shapeRendering="crispEdges" aria-hidden="true" className="drop-shadow-[2px_2px_0_rgba(0,0,0,0.35)] group-hover:-translate-y-0.5 transition-transform">
      {/* tiang */}
      <rect x="5" y="11" width="2" height="9" fill="#5b3a1a" />
      <rect x="17" y="11" width="2" height="9" fill="#5b3a1a" />
      {/* papan */}
      <rect x="1" y="1" width="22" height="11" fill="#3b2410" />
      <rect x="2" y="2" width="20" height="9" fill="#a0692e" />
      <rect x="2" y="5" width="20" height="1" fill="#8a5a26" />
      <rect x="2" y="8" width="20" height="1" fill="#8a5a26" />
      {/* paku */}
      <rect x="3" y="3" width="1" height="1" fill="#2a1a0a" />
      <rect x="20" y="3" width="1" height="1" fill="#2a1a0a" />
      {/* rumput */}
      <rect x="3" y="19" width="6" height="1" fill="#15803d" />
      <rect x="15" y="19" width="6" height="1" fill="#15803d" />
    </svg>
    <span className="absolute left-0 right-0 top-[9px] text-center font-title text-[9px] [text-shadow:1px_1px_0_#3b2410] pointer-events-none" style={{ color: '#fef9c3' }}>INFO</span>
    {baru > 0 && (
      <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-600 border-2 border-black text-white text-[10px] font-bold flex items-center justify-center animate-bounce teks-atas-warna">
        {baru > 9 ? '9+' : baru}
      </span>
    )}
  </span>
);

/** Chip PICA di pojok kebun: jumlah tugas Open dan peringatan telat */
export const ChipPica: React.FC<{
  jumlah: number;
  telat?: boolean;
  onBuka: () => void;
}> = ({ jumlah, telat, onBuka }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onBuka(); }}
    className={`absolute z-20 right-2 top-[96px] retro-box !p-1.5 !px-2 flex items-center gap-1.5 leading-tight ${
      telat
        ? '!bg-red-700 !border-white animate-pulse'
        : jumlah > 0
          ? '!bg-amber-950/80 !border-amber-400'
          : '!bg-black/70 !border-white/40'
    }`}
    title="Register PICA (Tugas & Temuan Tim)"
    aria-label={jumlah > 0 ? `${jumlah} PICA masih Open${telat ? ' (ada yang telat)' : ''}` : 'PICA: semua selesai'}
  >
    <ClipboardList size={16} className={telat ? 'text-white' : jumlah > 0 ? 'text-amber-300' : 'text-zinc-300'} />
    <span className={`font-title text-[10px] ${telat ? 'teks-atas-warna text-white' : jumlah > 0 ? 'text-amber-200' : 'text-white'}`}>
      {jumlah > 0 ? `${jumlah} PICA` : 'PICA'}
    </span>
  </button>
);

/** Chip Kalender di pojok kebun: agenda hari ini */
export const ChipKalender: React.FC<{
  jumlah: number;
  onBuka: () => void;
}> = ({ jumlah, onBuka }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onBuka(); }}
    className={`absolute z-20 right-2 top-[136px] retro-box !p-1.5 !px-2 flex items-center gap-1.5 leading-tight ${
      jumlah > 0 ? '!bg-blue-950/80 !border-blue-400' : '!bg-black/70 !border-white/40'
    }`}
    title="Jadwal & Agenda Kalender Tim"
    aria-label={jumlah > 0 ? `${jumlah} agenda hari ini` : 'Kalender: tidak ada agenda hari ini'}
  >
    <CalendarDays size={16} className={jumlah > 0 ? 'text-sky-300' : 'text-zinc-300'} />
    <span className={`font-title text-[10px] ${jumlah > 0 ? 'text-sky-200' : 'text-white'}`}>
      {jumlah > 0 ? `${jumlah} Acara` : 'Jadwal'}
    </span>
  </button>
);

/** Chip Alarm di pojok kebun: status alarm meeting & nada dering */
export const ChipAlarm: React.FC<{
  daftarAlarm: AlarmItem[];
  sedangBunyi?: boolean;
  onBuka: () => void;
}> = ({ daftarAlarm, sedangBunyi, onBuka }) => {
  const adaAlarm = daftarAlarm.length > 0;
  const alarmTerdekat = daftarAlarm.find((a) => a.waktuTargetMs > Date.now());

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onBuka(); }}
      className={`absolute z-20 right-2 top-[176px] retro-box !p-1.5 !px-2 flex items-center gap-1.5 leading-tight ${
        sedangBunyi
          ? '!bg-red-700 !border-white animate-pulse'
          : adaAlarm
            ? '!bg-yellow-950/80 !border-yellow-400'
            : '!bg-black/70 !border-white/40'
      }`}
      title="Alarm & Pengingat Meeting Kalender (Klik untuk Atur Nada Dering)"
      aria-label="Alarm meeting"
    >
      <AlarmClock
        size={16}
        className={sedangBunyi ? 'text-white animate-bounce' : adaAlarm ? 'text-yellow-300' : 'text-zinc-300'}
      />
      <span className={`font-title text-[10px] ${sedangBunyi ? 'teks-atas-warna text-white' : adaAlarm ? 'text-yellow-200' : 'text-white'}`}>
        {sedangBunyi ? 'BUNYI!' : alarmTerdekat ? alarmTerdekat.jamMulai : adaAlarm ? `${daftarAlarm.length} Alarm` : 'Alarm'}
      </span>
    </button>
  );
};

/** Chip Notifikasi di pojok kebun: status dan pintasan ke menu NOTIF */
export const ChipNotif: React.FC<{
  onBuka: () => void;
}> = ({ onBuka }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onBuka(); }}
    className="absolute z-20 right-2 top-[216px] retro-box !bg-black/70 !border-white/40 !p-1.5 !px-2 flex items-center gap-1.5 leading-tight hover:!bg-zinc-800"
    title="Pengingat Notifikasi (07.00, 12.00, 17.00 WITA)"
    aria-label="Buka notifikasi"
  >
    <Bell size={16} className="text-yellow-300" />
    <span className="font-title text-[10px] text-white">NOTIF</span>
  </button>
);

/** Chip Money Monkey di pojok kebun: pintasan ke RAB & Anggaran */
export const ChipMoney: React.FC<{
  onBuka: () => void;
}> = ({ onBuka }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onBuka(); }}
    className="absolute z-20 right-2 top-[256px] retro-box !bg-emerald-950/80 !border-emerald-400 !p-1.5 !px-2 flex items-center gap-1.5 leading-tight hover:!bg-emerald-900"
    title="Money Monkey (Anggaran, RAB & Keuangan HCGA)"
    aria-label="Buka Money Monkey"
  >
    <Coins size={16} className="text-yellow-300" />
    <span className="font-title text-[10px] text-emerald-200">MONEY</span>
  </button>
);

/** Chip Fire Monkey di pojok kebun: pintasan ke Monitoring Titik Api & Karhutla */
export const ChipFire: React.FC<{
  onBuka: () => void;
}> = ({ onBuka }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onBuka(); }}
    className="absolute z-20 right-2 top-[296px] retro-box !bg-orange-950/80 !border-orange-400 !p-1.5 !px-2 flex items-center gap-1.5 leading-tight hover:!bg-orange-900"
    title="Fire Monkey (Peta Interaktif Hotspot NASA FIRMS & Karhutla)"
    aria-label="Buka Fire Monkey"
  >
    <Flame size={16} className="text-orange-400" />
    <span className="font-title text-[10px] text-orange-200">FIRE</span>
  </button>
);

/** Chip Smart Nursery di pojok kebun: pintasan ke data bibit */
export const ChipNursery: React.FC<{
  onBuka: () => void;
}> = ({ onBuka }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onBuka(); }}
    className="absolute z-20 right-2 top-[336px] retro-box !bg-lime-950/80 !border-lime-400 !p-1.5 !px-2 flex items-center gap-1.5 leading-tight hover:!bg-lime-900"
    title="Smart Nursery (Stok bibit persemaian & mutasi)"
    aria-label="Buka Smart Nursery"
  >
    <Sprout size={16} className="text-lime-300" />
    <span className="font-title text-[10px] text-lime-200">SEMAI</span>
  </button>
);

/** Chip Geotagging di pojok kebun: pintasan ke sensus pohon & biomassa */
export const ChipGeotag: React.FC<{
  onBuka: () => void;
}> = ({ onBuka }) => (
  <button
    onClick={(e) => { e.stopPropagation(); onBuka(); }}
    className="absolute z-20 right-2 top-[376px] retro-box !bg-sky-950/80 !border-sky-400 !p-1.5 !px-2 flex items-center gap-1.5 leading-tight hover:!bg-sky-900"
    title="Geotagging & Karbon (Sensus pohon & cadangan karbon)"
    aria-label="Buka Geotagging"
  >
    <Trees size={16} className="text-sky-300" />
    <span className="font-title text-[10px] text-sky-200">POHON</span>
  </button>
);



