import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  HelpCircle, Heart, HeartOff, User, Trees, Target, Backpack, Calendar as CalendarIcon,
  Gamepad2, Flame, Star, Wifi, WifiOff, Users, ShoppingBag, LogOut, ClipboardList,
  CalendarDays, Megaphone, CloudUpload, Menu, X, Maximize2, Minimize2, CalendarRange, NotebookPen, Bell,
  Sun, Moon, Presentation, Camera, Coins,
} from 'lucide-react';
import { GameState, MissionStatus, MissionType, FieldReport, AppTab, Mission } from './types';
import { INITIAL_TOTAL_AREA, INITIAL_MISSIONS, SKINS } from './constants';
import {
  api, GalatApi, ambilToken, hapusToken, demoAktif, matikanDemo,
  antreOffline, jumlahAntreanOffline, kirimAntreanOffline,
} from './lib/api';
import type { Bootstrap, Pengguna, ProfilGame, MisiServer } from './lib/tipe-api';

import { Habitat } from './components/Habitat';
import { MissionsScreen } from './components/MissionsScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { TeamScreen } from './components/TeamScreen';
import { MarketScreen } from './components/MarketScreen';
import { AuthScreen } from './components/AuthScreen';
import { PicaScreen } from './components/PicaScreen';
import { KalenderScreen } from './components/KalenderScreen';
import { PengumumanScreen } from './components/PengumumanScreen';
import { RosterScreen } from './components/RosterScreen';
import { MemoScreen } from './components/MemoScreen';
import { MoneyMonkeyScreen } from './components/MoneyMonkeyScreen';
import { FireMonkeyScreen } from './components/FireMonkeyScreen';
import { MonkeyRun } from './components/MonkeyRun';
import { mintaLayarPenuh, keluarLayarPenuh } from './lib/platform';
import { NotifikasiScreen } from './components/NotifikasiScreen';
import { ModalAlarm } from './components/ModalAlarm';
import { PanelAlarm } from './components/PanelAlarm';
import { ModalMonkeyPoint } from './components/ModalMonkeyPoint';
import { ModalPanduanAplikasi } from './components/ModalPanduanAplikasi';
import { ModalStamina } from './components/ModalStamina';
import { ModalProfil } from './components/ModalProfil';
import { mulaiNotifikasi, hentikanNotifikasi, lupakanSesiNotifikasi, dengarKetukanNotifikasi } from './lib/notifikasi';
import { daftarAlarmHariIni, periksaAlarmHarusBunyi, bunyikanAlarm, hentikanAlarm, type AlarmItem } from './lib/alarm';
import type { JadwalItem } from './lib/tipe-api';
import { bacaTema, pasangTema, type Tema } from './lib/tema';
import { perbaruiDataWidgetHp, ambilTabDariWidget, dengarKetukanWidget } from './lib/widget';
import { simpanFotoProfil, hapusFotoProfil } from './lib/dokumen';
import { urlFoto, lupakanFoto } from './lib/foto';
import { tautanGabung } from './lib/demo-contoh';
import { hapusDataContohDemo, adaDataContohDemo } from './lib/demo';
import { ambilAlarmPica, pasangAlarmPica, labelSisa } from './lib/pica-alarm';
import { bangunAcara, type Sumber } from './lib/acara';
import { LIBUR_BAWAAN } from './lib/libur';
import type { TenggatKalender, RosterBaris } from './lib/tipe-api';

const SAVE_KEY = 'pokemonkey_game_v5';
const MAX_LIVES = 5;
const MAX_STAMINA = 100;
const DRAIN_DURATION_HOURS = 18;
const STAMINA_DRAIN_PER_SECOND = MAX_STAMINA / (DRAIN_DURATION_HOURS * 3600);
const WORK_START_HOUR = 7;

const calculateStaminaHybrid = (lastFeeding: number) => {
  const now = new Date();
  const today7AM = new Date(now.getFullYear(), now.getMonth(), now.getDate(), WORK_START_HOUR, 0, 0, 0).getTime();
  if (now.getTime() < today7AM) return MAX_STAMINA;
  const effectiveStartTime = Math.max(lastFeeding, today7AM);
  const elapsedSeconds = (now.getTime() - effectiveStartTime) / 1000;
  return Math.max(0, MAX_STAMINA - elapsedSeconds * STAMINA_DRAIN_PER_SECOND);
};

/** Teks di atas kepala monyet bila pemakai belum menulis statusnya sendiri. */
const STATUS_BAWAAN = 'Siap beraktivitas';

const gameAwal = (): GameState => ({
  userId: '', nickname: '', fullName: '', jabatan: 'Koordinator Lapangan', statusText: STATUS_BAWAAN, profilePhoto: '',
  currentDay: 1, currentHour: 0, totalArea: INITIAL_TOTAL_AREA,
  clearedArea: 0, plantedArea: 0, seedlingsCount: 0, seedlingsTarget: 100,
  xp: 0, level: 1, missions: [], reports: [], memoPlans: [],
  isPaused: false, timeSpeed: 1, monkeyHealth: 100, stamina: 100,
  lastFeedingTime: 0, lives: MAX_LIVES, lastReportDay: 1,
  monkeyPos: { x: Math.random() * 60 + 20, y: Math.random() * 50 + 25, facing: 'right' },
  isOnline: false, ownedSkins: ['classic'], activeSkinId: 'classic', isLoggedIn: false,
});

interface LaporanServer {
  id: string; user_id: string; user_nama: string | null; pica_id: string | null;
  jenis: string | null; capaian: number | null; satuan: string | null; catatan: string | null;
  xp: number; dibuat_pada: string; foto?: string | null;
}
const petaLaporan = (l: LaporanServer): FieldReport => ({
  id: l.id,
  timestamp: Date.parse(l.dibuat_pada),
  activityType: l.jenis ?? 'Pekerjaan Rutin',
  durationMinutes: 0,
  achievedUnit: Number(l.capaian ?? 0),
  unitType: (l.satuan as FieldReport['unitType']) ?? 'ha',
  notes: l.catatan ?? '',
  missionId: l.pica_id ?? '',
  missionTitle: l.pica_id ?? (l.jenis ?? 'Laporan'),
  userId: l.user_id,
  userName: l.user_nama ?? undefined,
  foto: l.foto ?? null,
});

const misiKeMission = (m: MisiServer): Mission => ({
  id: m.id,
  title: m.judul ?? m.id,
  type: (Object.values(MissionType) as string[]).includes(m.tipe) ? (m.tipe as MissionType) : MissionType.NURSERY,
  description: m.deskripsi ?? '',
  target: Number(m.target),
  current: Number(m.current),
  status: (m.status as MissionStatus) ?? MissionStatus.AVAILABLE,
  rewardXP: Number(m.xp),
  satuan: m.satuan,
  capacityPerDay: Number(m.kapasitas) || 1.66,
});

/** Tab utama di navigasi bawah ponsel; sisanya lewat MENU. */
const TAB_UTAMA: AppTab[] = ['habitat', 'pica', 'jadwal', 'pengumuman'];

const INFO_TAB: Record<AppTab, { label: string; ikon: React.ReactElement; warna: string; teks: string }> = {
  habitat:    { label: 'KEBUN',  ikon: <Trees />,         warna: 'bg-green-600',  teks: 'text-green-400' },
  pica:       { label: 'PICA',   ikon: <ClipboardList />, warna: 'bg-amber-600',  teks: 'text-amber-400' },
  jadwal:     { label: 'JADWAL', ikon: <CalendarDays />,  warna: 'bg-cyan-600',   teks: 'text-cyan-400' },
  pengumuman: { label: 'INFO',   ikon: <Megaphone />,     warna: 'bg-pink-600',   teks: 'text-pink-400' },
  roster:     { label: 'ROSTER', ikon: <CalendarRange />, warna: 'bg-teal-600',   teks: 'text-teal-400' },
  memo:       { label: 'MEMO',   ikon: <NotebookPen />,   warna: 'bg-lime-600',   teks: 'text-lime-400' },
  notif:      { label: 'NOTIF',  ikon: <Bell />,          warna: 'bg-rose-600',   teks: 'text-rose-400' },
  team:       { label: 'TEAM',   ikon: <Users />,         warna: 'bg-indigo-600', teks: 'text-indigo-400' },
  market:     { label: 'SHOP',   ikon: <ShoppingBag />,   warna: 'bg-yellow-600', teks: 'text-yellow-400' },
  missions:   { label: 'QUEST',  ikon: <Target />,        warna: 'bg-blue-600',   teks: 'text-blue-400' },
  reports:    { label: 'FEED',   ikon: <Backpack />,      warna: 'bg-red-600',    teks: 'text-red-400' },
  calendar:   { label: 'LOG',    ikon: <CalendarIcon />,  warna: 'bg-purple-600', teks: 'text-purple-400' },
  money:      { label: 'MONEY',  ikon: <Coins />,         warna: 'bg-emerald-600', teks: 'text-emerald-400' },
  fire:       { label: 'FIRE',   ikon: <Flame />,         warna: 'bg-orange-600',  teks: 'text-orange-400' },
  game:       { label: 'GAME',   ikon: <Gamepad2 />,      warna: 'bg-yellow-600', teks: 'text-yellow-400' },
};
const URUTAN_TAB = Object.keys(INFO_TAB) as AppTab[];

/** Tab dari tautan notifikasi yang diketuk (/?tab=pica). */
const tabDariUrl = (): AppTab | null => {
  if (typeof window === 'undefined') return null;
  const tab = new URLSearchParams(window.location.search).get('tab');
  return tab && (URUTAN_TAB as string[]).includes(tab) ? (tab as AppTab) : null;
};

const App: React.FC = () => {
  const tokenBagi = useMemo(() => {
    const m = typeof window !== 'undefined' ? window.location.pathname.match(/^\/bagi\/([\w-]+)/) : null;
    return m ? m[1] : null;
  }, []);

  const [sesi, setSesi] = useState<{ pengguna: Pengguna; boot: Bootstrap } | null>(null);
  /** Id pemakai untuk dipakai di dalam pemuat data tanpa memasangnya sebagai dependensi. */
  const idPenggunaRef = useRef<string | null>(null);
  const [memuatSesi, setMemuatSesi] = useState(() => Boolean(ambilToken()) && !tokenBagi);

  const [gameState, setGameState] = useState<GameState>(() => {
    const awal = gameAwal();
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Alamat blob: dari sesi sebelumnya sudah mati; kosongkan agar foto diambil ulang dari server.
        const profilePhoto = String(parsed.profilePhoto ?? '').startsWith('blob:') ? '' : parsed.profilePhoto;
        return { ...awal, ...parsed, profilePhoto, missions: awal.missions, stamina: calculateStaminaHybrid(parsed.lastFeedingTime || 0), isLoggedIn: false, isPaused: false };
      }
    } catch (e) { console.error('Load error:', e); }
    return awal;
  });

  const [activeTab, setActiveTab] = useState<AppTab>(() => tabDariUrl() ?? 'habitat');
  const [tema, setTema] = useState<Tema>(bacaTema);
  const [fokus, setFokus] = useState(false);
  const [menuBuka, setMenuBuka] = useState(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [monkeyDialogue, setMonkeyDialogue] = useState<string>('Semangat! Siap beraktivitas hari ini!');
  const [syncing, setSyncing] = useState(false);
  const [antrean, setAntrean] = useState(jumlahAntreanOffline());
  const [picaTerbuka, setPicaTerbuka] = useState<{ id: string; judul: string; telat?: boolean }[]>([]);
  const [picaTerpilih, setPicaTerpilih] = useState<string | null>(null);
  const [pengumumanBaru, setPengumumanBaru] = useState(0);
  const [semuaJadwal, setSemuaJadwal] = useState<JadwalItem[]>([]);
  const [alarmAktif, setAlarmAktif] = useState<AlarmItem | null>(null);
  const [panelAlarmBuka, setPanelAlarmBuka] = useState(false);
  const [monkeyPointBuka, setMonkeyPointBuka] = useState(false);
  const [panduanBuka, setPanduanBuka] = useState(false);
  const [modalStaminaBuka, setModalStaminaBuka] = useState(false);
  const [modalProfilBuka, setModalProfilBuka] = useState(false);

  const hariIniWita = useMemo(() => new Date(Date.now() + 480 * 60000).toISOString().slice(0, 10), []);
  const daftarAlarm = useMemo(() => daftarAlarmHariIni(semuaJadwal, hariIniWita), [semuaJadwal, hariIniWita]);
  const acaraHariIni = useMemo(() => semuaJadwal.filter((j) => (j.tanggal === hariIniWita || j.tanggal_selesai === hariIniWita) && !j.selesai), [semuaJadwal, hariIniWita]);

  const notifyRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((msg: string) => {
    setShowNotification(msg);
    if (notifyRef.current) clearTimeout(notifyRef.current);
    notifyRef.current = setTimeout(() => setShowNotification(null), 3000);
  }, []);

  // Pemeriksa alarm kalender: berbunyi saat waktu target (meeting/agenda) tiba
  useEffect(() => {
    if (!sesi || semuaJadwal.length === 0) return;
    const periksa = () => {
      const hari = new Date(Date.now() + 480 * 60000).toISOString().slice(0, 10);
      const harusBunyi = periksaAlarmHarusBunyi(semuaJadwal, hari);
      if (harusBunyi && (!alarmAktif || alarmAktif.id !== harusBunyi.id)) {
        setAlarmAktif(harusBunyi);
        void bunyikanAlarm(harusBunyi);
      }
    };
    periksa();
    const t = setInterval(periksa, 5000);
    return () => clearInterval(t);
  }, [sesi, semuaJadwal, alarmAktif]);

  // ---------- Muat data ----------

  const muatMisi = useCallback(async () => {
    const d = await api<{ misi: MisiServer[] }>('/api/misi');
    setGameState((p) => ({ ...p, missions: (d.misi ?? []).map(misiKeMission) }));
  }, []);

  const muatGame = useCallback(async () => {
    const [profil, misi, laporan, pica, pengumuman, dataJadwal] = await Promise.all([
      api<{ profil: ProfilGame | null }>('/api/profil'),
      api<{ misi: MisiServer[] }>('/api/misi'),
      api<{ laporan: LaporanServer[] }>('/api/laporan'),
      api<{ pica: { id: string; judul: string; status: string; sisa_hari?: number | null; pic_nama?: string | null; due_date?: string | null; pic_id?: string | null }[] }>('/api/pica'),
      api<{ pengumuman: { sudah_baca: number }[] }>('/api/pengumuman').catch(() => ({ pengumuman: [] })),
      api<{ jadwal: JadwalItem[]; tenggat?: TenggatKalender[] }>('/api/jadwal').catch(() => ({ jadwal: [], tenggat: [] })),
    ]);

    const picaOpen = (pica.pica ?? []).filter((p) => p.status !== 'Closed');
    setPicaTerbuka(picaOpen.map((p) => ({
      id: p.id,
      judul: p.judul,
      telat: typeof p.sisa_hari === 'number' && p.sisa_hari < 0,
    })));
    setPengumumanBaru(pengumuman.pengumuman.filter((p) => !p.sudah_baca).length);
    setSemuaJadwal(dataJadwal.jadwal ?? []);

    const picaTelatCount = picaOpen.filter((p) => typeof p.sisa_hari === 'number' && p.sisa_hari < 0).length;
    const hariIniWita = new Date(Date.now() + 480 * 60000).toISOString().slice(0, 10);

    // Widget di layar utama HP menampilkan PICA milik pemakai yang sedang masuk.
    const idSaya = idPenggunaRef.current;
    const picaSaya = idSaya ? picaOpen.filter((p) => p.pic_id === idSaya) : picaOpen;
    const picaUrut = [...(picaSaya.length ? picaSaya : picaOpen)].sort((a, b) => (a.sisa_hari ?? 999) - (b.sisa_hari ?? 999));

    // Alarm tenggat: bawaannya mati, hanya yang ditandai pemiliknya yang dipasang.
    let alarmPica: { pica_id: string; jam: string; aktif: number }[] = [];
    let jamAlarm = '07:00';
    try {
      const d = await ambilAlarmPica();
      alarmPica = d.alarm;
      jamAlarm = d.jamBawaan;
      void pasangAlarmPica(picaSaya.map((x) => ({ id: x.id, judul: x.judul, due_date: x.due_date, status: x.status })), d.alarm, d.jamBawaan);
    } catch { /* alarm tidak wajib: widget tetap tampil tanpa datanya */ }
    const alarmHidup = new Set(alarmPica.filter((a) => a.aktif).map((a) => a.pica_id));

    const topPica = picaUrut.slice(0, 4).map((p) => ({
      id: p.id,
      judul: p.judul,
      pic: p.pic_nama || 'Tim EBL',
      due_date: p.due_date || '—',
      sisa: labelSisa(p.due_date, hariIniWita),
      waktu: alarmHidup.has(p.id)
        ? `${alarmPica.find((a) => a.pica_id === p.id)?.jam || jamAlarm} WITA`
        : (p.due_date ? `${+p.due_date.slice(8)} ${p.due_date.slice(5, 7)}` : '—'),
      alarm: alarmHidup.has(p.id),
      telat: typeof p.sisa_hari === 'number' && p.sisa_hari < 0,
    }));
    const picaIsi = picaTelatCount > 0
      ? `${picaTelatCount} tugas telat! (${topPica[0]?.judul || ''})`
      : (topPica.length > 0 ? `${topPica.length} tugas open: ${topPica[0]?.judul}` : 'Semua tugas PICA selesai');

    const hariIni = hariIniWita;
    const acara = (dataJadwal.jadwal ?? []).filter((j) => (j.tanggal === hariIni || j.tanggal_selesai === hariIni) && !j.selesai);
    const topAcara = acara.slice(0, 3).map((j) => ({
      id: j.id,
      judul: j.judul,
      jam: j.jam_mulai ? (j.jam_selesai ? `${j.jam_mulai} - ${j.jam_selesai}` : j.jam_mulai) : 'Sepanjang hari',
      selesai: Boolean(j.selesai),
    }));
    const alarms = daftarAlarmHariIni(dataJadwal.jadwal ?? [], hariIni);
    const alarmStatus = alarms.length > 0 ? `${alarms.length} Alarm Aktif` : 'Alarm Standby';
    const jadwalIsi = topAcara.length > 0
      ? `${topAcara[0].jam}: ${topAcara[0].judul}`
      : 'Tidak ada agenda rapat hari ini';

    // ---- Widget kalender: titik penanda per tanggal, mengikuti lapisan yang dipilih ----
    const KODE_SUMBER: Record<Sumber, string> = { libur: 'L', tenggat: 'T', rapat: 'R', tim: 'M', saya: 'S', lain: 'A', roster: 'O' };
    const kalenderTitik: Record<string, string> = {};
    let kalenderRingkas = 'Tidak ada agenda hari ini';
    try {
      const [lapisanSrv, rosterBulan] = await Promise.all([
        api<{ lapisan: Record<string, boolean> }>('/api/kalender/lapisan').catch(() => ({ lapisan: {} as Record<string, boolean> })),
        idSaya
          ? api<{ roster: RosterBaris[] }>(`/api/roster?bulan=${hariIniWita.slice(0, 7)}`).catch(() => ({ roster: [] as RosterBaris[] }))
          : Promise.resolve({ roster: [] as RosterBaris[] }),
      ]);
      const lapisanAktif = (s: Sumber) => lapisanSrv.lapisan[s] !== false;

      // Rentang ±2 bulan, sesuai batas tombol pindah bulan di widget.
      const awal = new Date(Date.UTC(+hariIniWita.slice(0, 4), +hariIniWita.slice(5, 7) - 3, 1)).toISOString().slice(0, 10);
      const akhir = new Date(Date.UTC(+hariIniWita.slice(0, 4), +hariIniWita.slice(5, 7) + 2, 0)).toISOString().slice(0, 10);

      const acaraKalender = bangunAcara({
        jadwal: dataJadwal.jadwal ?? [],
        tenggat: dataJadwal.tenggat ?? [],
        libur: LIBUR_BAWAAN.filter((l) => l.tanggal >= awal && l.tanggal <= akhir),
        sayaId: idSaya ?? undefined,
        roster: (rosterBulan.roster ?? []).filter((r) => r.user_id === idSaya).map((r) => ({ tanggal: r.tanggal, kode: r.kode, catatan: r.catatan })),
        dari: awal,
        sampai: akhir,
        hariIni: hariIniWita,
      });

      for (const a of acaraKalender) {
        if (!lapisanAktif(a.sumber)) continue;
        const kode = KODE_SUMBER[a.sumber];
        // Acara multi-hari menandai setiap tanggalnya, dibatasi 31 hari agar tidak berlebihan.
        let t = a.mulaiTgl;
        for (let n = 0; n < 31 && t <= a.selesaiTgl; n++) {
          if (t >= awal && t <= akhir && !(kalenderTitik[t] ?? '').includes(kode)) kalenderTitik[t] = (kalenderTitik[t] ?? '') + kode;
          t = new Date(Date.parse(t + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
        }
      }

      const agendaHariIni = acaraKalender.filter((a) => a.mulaiTgl <= hariIniWita && a.selesaiTgl >= hariIniWita);
      const tenggatHariIni = agendaHariIni.filter((a) => a.sumber === 'tenggat').length;
      const jumlahAgenda = agendaHariIni.filter((a) => a.sumber !== 'tenggat' && a.sumber !== 'libur').length;
      const liburHariIni = agendaHariIni.find((a) => a.sumber === 'libur');
      kalenderRingkas = [
        `${+hariIniWita.slice(8)}/${hariIniWita.slice(5, 7)}`,
        liburHariIni ? liburHariIni.judul : null,
        jumlahAgenda > 0 ? `${jumlahAgenda} agenda` : null,
        tenggatHariIni > 0 ? `${tenggatHariIni} tenggat PICA` : null,
      ].filter(Boolean).join(' · ') || 'Tidak ada agenda hari ini';
    } catch { /* widget kalender boleh kosong bila datanya gagal dimuat */ }

    void perbaruiDataWidgetHp({
      kalenderTitik,
      kalenderHariIni: hariIniWita,
      kalenderRingkas,
      picaTotal: picaSaya.length || picaOpen.length,
      picaTelat: picaTelatCount,
      picaIsi,
      picaItems: topPica,
      jadwalIsi,
      jadwalItems: topAcara,
      alarmStatus,
    });

    setGameState((prev) => ({
      ...prev,
      xp: profil.profil?.xp ?? prev.xp,
      level: profil.profil?.level ?? prev.level,
      plantedArea: profil.profil?.luas_tanam ?? prev.plantedArea,
      ownedSkins: profil.profil?.skin_dimiliki ?? prev.ownedSkins,
      activeSkinId: profil.profil?.skin_aktif ?? prev.activeSkinId,
      statusText: profil.profil ? (profil.profil.status_teks || STATUS_BAWAAN) : prev.statusText,
      reports: laporan.laporan.map(petaLaporan),
      missions: (misi.misi ?? []).map(misiKeMission),
      isOnline: true,
    }));
  }, []);

  const muatSesi = useCallback(async () => {
    try {
      const boot = await api<Bootstrap>('/api/bootstrap');
      idPenggunaRef.current = boot.pengguna.id;
      setSesi({ pengguna: boot.pengguna, boot });
      setGameState((prev) => ({
        ...prev,
        userId: boot.pengguna.id,
        fullName: boot.pengguna.nama,
        nickname: boot.pengguna.nama.split(' ')[0],
        jabatan: boot.pengguna.jabatan ?? 'Forester',
        phone: boot.pengguna.wa || prev.phone || '',
        isLoggedIn: true,
        isOnline: true,
      }));
      await muatGame();
    } catch (e) {
      if (e instanceof GalatApi && e.status === 0) {
        notify('OFFLINE — MEMAKAI DATA TERSIMPAN');
        setGameState((p) => ({ ...p, isOnline: false }));
      } else {
        hapusToken();
        setSesi(null);
      }
    } finally {
      setMemuatSesi(false);
    }
  }, [muatGame, notify]);

  const bootUlang = useCallback(async () => {
    try {
      const boot = await api<Bootstrap>('/api/bootstrap');
      idPenggunaRef.current = boot.pengguna.id;
      setSesi({ pengguna: boot.pengguna, boot });
      await muatGame();
    } catch { /* biarkan boot lama */ }
  }, [muatGame]);

  useEffect(() => {
    if (tokenBagi) return;
    if (ambilToken()) muatSesi();
  }, [tokenBagi, muatSesi]);

  // Foto profil kini milik server: kalau ponsel ini belum punya salinannya, ambil dari sana.
  useEffect(() => {
    const kunci = sesi?.pengguna.foto;
    if (!kunci || gameState.profilePhoto) return;
    let hidup = true;
    urlFoto(kunci).then((u) => { if (hidup && u) setGameState((p) => ({ ...p, profilePhoto: u })); });
    return () => { hidup = false; };
  }, [sesi?.pengguna.foto, gameState.profilePhoto]);

  useEffect(() => {
    const tangani = () => { setSesi(null); notify('SESI BERAKHIR — SILAKAN MASUK LAGI'); };
    window.addEventListener('pokemonkey:sesi-berakhir', tangani);
    return () => window.removeEventListener('pokemonkey:sesi-berakhir', tangani);
  }, [notify]);

  useEffect(() => {
    if (!gameState.isLoggedIn) return;
    const { missions, ...ringan } = gameState;
    void missions;
    // Foto dari server berupa alamat blob: yang hanya hidup selama aplikasi terbuka — tidak ikut disimpan.
    const foto = ringan.profilePhoto.startsWith('blob:') ? '' : ringan.profilePhoto;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...ringan, profilePhoto: foto, reports: ringan.reports.slice(0, 50) })); } catch { /* abaikan */ }
  }, [gameState]);

  // Alamat /?tab= dari notifikasi sudah dibaca saat awal; bersihkan agar muat ulang tidak membukanya lagi.
  useEffect(() => {
    if (window.location.search.includes('tab=')) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // Pengingat 07.00/12.00/17.00: titipkan token & jam ke penjadwal HP, atau segarkan langganan Web Push.
  useEffect(() => {
    if (!sesi) return;
    void mulaiNotifikasi(sesi.boot.pengaturan);
    return () => hentikanNotifikasi();
  }, [sesi]);

  // Notifikasi diketuk saat aplikasi terbuka atau dari baki notifikasi HP.
  useEffect(() => dengarKetukanNotifikasi((tab) => {
    if (!(URUTAN_TAB as string[]).includes(tab)) return;
    setActiveTab(tab as AppTab);
    setMenuBuka(false);
  }), []);

  // Widget layar depan HP diketuk saat aplikasi terbuka atau dari dingin.
  useEffect(() => {
    void ambilTabDariWidget().then((tab) => {
      if (tab && (URUTAN_TAB as string[]).includes(tab)) {
        setActiveTab(tab as AppTab);
      }
    });
    return dengarKetukanWidget((tab) => {
      if ((URUTAN_TAB as string[]).includes(tab)) {
        setActiveTab(tab as AppTab);
        setMenuBuka(false);
      }
    });
  }, []);

  // Sinkronisasi data widget layar depan HP setiap kali jadwal atau alarm berubah
  useEffect(() => {
    const hariIni = new Date(Date.now() + 480 * 60000).toISOString().slice(0, 10);
    const acara = semuaJadwal.filter((j) => (j.tanggal === hariIni || j.tanggal_selesai === hariIni) && !j.selesai);
    const topAcara = acara.slice(0, 3).map((j) => ({
      id: j.id,
      judul: j.judul,
      jam: j.jam_mulai ? (j.jam_selesai ? `${j.jam_mulai} - ${j.jam_selesai}` : j.jam_mulai) : 'Sepanjang hari',
      selesai: Boolean(j.selesai),
    }));
    const alarms = daftarAlarmHariIni(semuaJadwal, hariIni);
    const alarmStatus = alarmAktif
      ? `🚨 BUNYI: ${alarmAktif.judul}`
      : (alarms.length > 0 ? `${alarms.length} Alarm Aktif` : 'Alarm Standby');
    const jadwalIsi = topAcara.length > 0
      ? `${topAcara[0].jam}: ${topAcara[0].judul}`
      : 'Tidak ada agenda rapat hari ini';

    void perbaruiDataWidgetHp({
      jadwalIsi,
      jadwalItems: topAcara,
      alarmStatus,
    });
  }, [semuaJadwal, alarmAktif]);

  // Layar penuh: sembunyikan cangkang + minta fullscreen browser bila ada.
  useEffect(() => {
    if (fokus) mintaLayarPenuh();
    else keluarLayarPenuh();
  }, [fokus]);

  // ---------- Sinkronisasi ----------

  const simpanProfil = useCallback(async (bagian: Record<string, unknown>) => {
    setSyncing(true);
    try {
      await api('/api/profil', { body: bagian });
      setGameState((p) => ({ ...p, isOnline: true }));
    } catch {
      setGameState((p) => ({ ...p, isOnline: false }));
    } finally {
      setSyncing(false);
    }
  }, []);

  /** Teks di atas kepala monyet; kosong = kembali ke sapaan bawaan. Terlihat anggota lain di KEBUN. */
  const ubahStatus = useCallback((teks: string) => {
    const bersih = teks.replace(/\s+/g, ' ').trim().slice(0, 60);
    setGameState((p) => ({ ...p, statusText: bersih || STATUS_BAWAAN }));
    setMonkeyDialogue('');
    simpanProfil({ status_teks: bersih });
  }, [simpanProfil]);

  useEffect(() => {
    if (!sesi) return;
    const timer = setInterval(async () => {
      const newStamina = calculateStaminaHybrid(gameState.lastFeedingTime);
      setGameState((p) => ({ ...p, stamina: newStamina }));
      simpanProfil({ stamina: newStamina, pos_x: gameState.monkeyPos.x, pos_y: gameState.monkeyPos.y });

      const terkirim = await kirimAntreanOffline();
      setAntrean(jumlahAntreanOffline());
      if (terkirim > 0) {
        notify(`${terkirim} LAPORAN OFFLINE TERKIRIM`);
        muatGame().catch(() => undefined);
      } else {
        muatMisi().catch(() => undefined);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [sesi, gameState.lastFeedingTime, gameState.monkeyPos.x, gameState.monkeyPos.y, simpanProfil, muatGame, muatMisi, notify]);

  // ---------- Aksi ----------

  const handleMasuk = (pengguna: Pengguna) => {
    setMemuatSesi(true);
    notify(`SELAMAT DATANG, ${pengguna.nama.toUpperCase()}!`);
    muatSesi();
  };

  const handleLogout = async () => {
    // Sebelum token dihapus: runner & langganan push tidak boleh terus mengirim atas nama akun ini.
    await lupakanSesiNotifikasi().catch(() => undefined);
    try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch { /* token lokal tetap dihapus */ }
    hapusToken();
    matikanDemo();
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  };

  const handleBuySkin = async (skinId: string) => {
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin) return;
    if (gameState.xp < skin.cost) { notify('XP TIDAK CUKUP!'); return; }
    const newState = { ...gameState, xp: gameState.xp - skin.cost, ownedSkins: [...gameState.ownedSkins, skinId], activeSkinId: skinId };
    setGameState(newState);
    await simpanProfil({ xp: newState.xp, skin_dimiliki: newState.ownedSkins, skin_aktif: skinId });
    notify(`${skin.name.toUpperCase()} DIBELI!`);
  };

  const handleEquipSkin = async (skinId: string) => {
    setGameState((p) => ({ ...p, activeSkinId: skinId }));
    await simpanProfil({ skin_aktif: skinId });
    notify('SKIN DIPASANG!');
  };

  const handleMissionStart = async (missionId: string) => {
    setGameState((prev) => ({
      ...prev,
      missions: prev.missions.map((m) => (m.id === missionId ? { ...m, status: MissionStatus.IN_PROGRESS } : m)),
    }));
    try { await api(`/api/misi/${missionId}/mulai`, { method: 'POST', body: {} }); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMULAI MISI'); }
  };

  const handleMisiSimpan = async (data: Record<string, unknown>, id?: string) => {
    try {
      if (id) await api(`/api/misi/${id}`, { method: 'PATCH', body: data });
      else await api('/api/misi', { body: data });
      await muatMisi();
      notify(id ? 'MISI DIPERBARUI' : 'MISI DITAMBAHKAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN MISI'); }
  };

  const handleMisiHapus = async (id: string) => {
    try { await api(`/api/misi/${id}`, { method: 'DELETE' }); await muatMisi(); notify('MISI DIHAPUS'); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGHAPUS MISI'); }
  };

  const unggahFoto = async (laporanId: string, dataUrl: string) => {
    const blob = await (await fetch(dataUrl)).blob();
    const form = new FormData();
    form.append('berkas', blob, `foto-${laporanId}.jpg`);
    form.append('entitas', 'laporan');
    form.append('entitas_id', laporanId);
    await api('/api/lampiran', { form });
  };

  const handleReportSubmit = async (report: Omit<FieldReport, 'id' | 'timestamp' | 'missionTitle'> & { picaId?: string; photoData?: string }) => {
    const now = Date.now();
    const mission = report.missionId ? gameState.missions.find((m) => m.id === report.missionId) : undefined;

    let finalValue = report.achievedUnit;
    const capPerDay = mission?.capacityPerDay || 1.66;
    switch (report.unitType) {
      case 'jam': finalValue = report.achievedUnit * (capPerDay / 8); break;
      case 'hari': finalValue = report.achievedUnit * capPerDay; break;
      case 'orang': finalValue = (report.achievedUnit * capPerDay) / 10; break;
      case 'meter': finalValue = report.achievedUnit / 10000; break;
    }

    const xpGained = 500 + Math.floor(finalValue * 10);
    const newReport: FieldReport = {
      ...report, id: now.toString(), timestamp: now, achievedUnit: finalValue,
      missionTitle: report.picaId || mission?.title || report.activityType, userId: gameState.userId, userName: gameState.fullName,
    };
    const nextMissionValue = mission ? Math.min(mission.target, mission.current + finalValue) : 0;
    const nextStatus = mission && nextMissionValue >= mission.target ? MissionStatus.COMPLETED : mission?.status;
    // Tanpa misi, capaian dalam hektare tetap menumbuhkan kebun di layar KEBUN.
    const menanam = mission ? mission.type === MissionType.PLANTING : report.unitType === 'ha';

    setGameState((prev) => ({
      ...prev,
      stamina: MAX_STAMINA,
      lastFeedingTime: now,
      lives: Math.min(MAX_LIVES, Math.floor(prev.lives) + 1),
      reports: [newReport, ...prev.reports],
      xp: prev.xp + xpGained,
      level: Math.floor((prev.xp + xpGained) / 1000) + 1,
      clearedArea: mission?.type === MissionType.LAND_PREP ? Math.min(prev.totalArea, prev.clearedArea + finalValue) : prev.clearedArea,
      plantedArea: menanam ? Math.min(prev.totalArea, prev.plantedArea + finalValue) : prev.plantedArea,
      missions: mission ? prev.missions.map((m) => (m.id === mission.id ? { ...m, current: nextMissionValue, status: nextStatus ?? m.status } : m)) : prev.missions,
    }));

    const bodyLaporan = { pica_id: report.picaId || null, jenis: report.activityType, capaian: finalValue, satuan: report.unitType, catatan: report.notes };
    const bodyMisi = mission
      ? { nilai: finalValue, target: mission.target, luas: mission.type === MissionType.PLANTING ? finalValue : 0, xp: xpGained }
      : { nilai: 0, target: 0, luas: menanam ? finalValue : 0, xp: xpGained };

    setSyncing(true);
    try {
      const d = await api<{ id: string }>('/api/laporan', { body: bodyLaporan });
      // Tanpa misi, XP dan luas tanam tetap dicatat lewat jalur profil di simpanProfil.
      if (mission) await api(`/api/misi/${mission.id}/tambah`, { body: bodyMisi });
      if (report.photoData) await unggahFoto(d.id, report.photoData).catch(() => notify('FOTO GAGAL TERUNGGAH'));
      await simpanProfil({ stamina: MAX_STAMINA, xp: gameState.xp + xpGained, level: Math.floor((gameState.xp + xpGained) / 1000) + 1, luas_tanam: menanam ? gameState.plantedArea + finalValue : gameState.plantedArea });
      setMonkeyDialogue(`Uu-aa! Sync sukses! +${xpGained} XP didapat!`);
      muatGame().catch(() => undefined);
    } catch (e) {
      if (e instanceof GalatApi && e.status === 0) {
        antreOffline('/api/laporan', bodyLaporan);
        if (mission) antreOffline(`/api/misi/${mission.id}/tambah`, bodyMisi);
        setAntrean(jumlahAntreanOffline());
        setGameState((p) => ({ ...p, isOnline: false }));
        setMonkeyDialogue('Uu-aa! Sinyal hilang. Laporan disimpan, dikirim otomatis saat online.');
      } else {
        notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN LAPORAN');
      }
    } finally {
      setSyncing(false);
    }

    setActiveTab('habitat');
  };

  const handleGainXP = (xp: number) => {
    const newXP = gameState.xp + xp;
    const newLevel = Math.floor(newXP / 1000) + 1;
    setGameState((p) => ({ ...p, xp: newXP, level: newLevel }));
    simpanProfil({ xp: newXP, level: newLevel });
  };

  const gantiTema = () => {
    const baru: Tema = tema === 'gelap' ? 'terang' : 'gelap';
    setTema(baru);
    pasangTema(baru);
    notify(baru === 'terang' ? 'MODE TERANG — UNTUK DI LAPANGAN' : 'MODE GELAP');
  };

  const bukaPica = (id: string) => { setPicaTerpilih(id); setActiveTab('pica'); };
  const pilihTab = (t: AppTab) => {
    setActiveTab(t);
    setMenuBuka(false);
    if (t === 'pengumuman') setPengumumanBaru(0);
    if (t === 'habitat') {
      api<{ jadwal: JadwalItem[] }>('/api/jadwal').then((d) => setSemuaJadwal(d.jadwal ?? [])).catch(() => undefined);
    }
  };

  const totalAchieved = useMemo(() => gameState.reports.reduce((acc, r) => acc + r.achievedUnit, 0), [gameState.reports]);
  const skinAktif = useMemo(() => SKINS.find((s) => s.id === gameState.activeSkinId) ?? SKINS[0], [gameState.activeSkinId]);

  // ---------- Tampilan ----------

  if (tokenBagi) {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-zinc-950 select-none">
        <header className="retro-box !py-2 flex items-center justify-between mx-2 mt-2 gap-2">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 bg-white border-[3px] border-black flex items-center justify-center shrink-0"><Trees size={18} className="text-black" /></div>
            <div>
              <h1 className="font-title text-[10px] md:text-[12px]">POKEMONKEY</h1>
              <p className="text-[12px] text-yellow-200 uppercase">Kalender tim · tampilan berbagi</p>
            </div>
          </div>
          <a href="/" className="btn-retro btn-retro-sm bg-yellow-600 mr-1">Masuk aplikasi</a>
        </header>
        <main className="flex-1 p-2 overflow-hidden">
          <div className="h-full retro-box !bg-black/80 !p-0 overflow-hidden flex flex-col">
            <KalenderScreen bacaSaja tokenBagi={tokenBagi} />
          </div>
        </main>
      </div>
    );
  }

  if (memuatSesi) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center">
        <div className="retro-box !bg-zinc-900 border-yellow-500 p-8 text-center">
          <Trees size={40} className="text-yellow-500 mx-auto mb-4 animate-bounce" />
          <p className="text-[13px] uppercase text-zinc-300 tracking-widest">Menghubungkan…</p>
        </div>
      </div>
    );
  }

  if (!sesi) return <AuthScreen onMasuk={handleMasuk} />;

  const { pengguna, boot } = sesi;
  const demo = demoAktif();

  /** Pita mode demo: pengingat bahwa data hanya di perangkat ini + ajakan bergabung. */
  const pitaDemo = demo ? (
    <div className="shrink-0 flex flex-wrap items-center gap-2 px-2 py-1 bg-amber-950/80 border-b-2 border-amber-500 text-[11px]">
      <span className="font-bold text-amber-300 uppercase tracking-wide">Mode demo</span>
      <span className="text-amber-100/90">Data contoh, tersimpan di perangkat ini saja.</span>
      <span className="w-full sm:w-auto text-amber-200/70 text-[10px]">PICA = tugas perbaikan · KEBUN = ruang tim · FEED = laporan harian · LOG = catatan kegiatan</span>
      {adaDataContohDemo() && (
        <button
          onClick={() => { hapusDataContohDemo(); notify('DATA CONTOH DIHAPUS'); window.location.reload(); }}
          className="btn-retro btn-retro-sm !py-0.5 bg-zinc-800"
        >
          Hapus data contoh
        </button>
      )}
      <a
        href={tautanGabung()}
        target="_blank"
        rel="noreferrer"
        className="btn-retro btn-retro-sm !py-0.5 bg-emerald-700 ml-auto"
      >
        Gabung tim saya
      </a>
    </div>
  ) : null;

  const layar = (
    <>
      {activeTab === 'habitat' && (
        <Habitat
          state={gameState}
          skin={skinAktif}
          dialogue={monkeyDialogue}
          onSetDialogue={setMonkeyDialogue}
          onPindah={(pos) => setGameState((p) => ({ ...p, monkeyPos: pos }))}
          pengguna={pengguna}
          onGainXP={handleGainXP}
          opsiRoster={boot.opsi.filter((o) => o.grup === 'roster')}
          notify={notify}
          statusTeks={gameState.statusText}
          onUbahStatus={ubahStatus}
          jumlahInfoBaru={pengumumanBaru}
          onBukaInfo={() => pilihTab('pengumuman')}
          jumlahPicaTerbuka={picaTerbuka.length}
          adaPicaTelat={picaTerbuka.some((p) => p.telat)}
          onBukaPica={() => pilihTab('pica')}
          jumlahAcaraHariIni={acaraHariIni.length}
          onBukaJadwal={() => pilihTab('jadwal')}
          daftarAlarm={daftarAlarm}
          sedangAlarm={Boolean(alarmAktif)}
          onBukaAlarm={() => setPanelAlarmBuka(true)}
          onBukaNotif={() => pilihTab('notif')}
          onBukaMoney={() => pilihTab('money')}
          onBukaFire={() => pilihTab('fire')}
        />
      )}
      {activeTab === 'pica' && <PicaScreen boot={boot} pengguna={pengguna} picaAwal={picaTerpilih} onBootUlang={bootUlang} notify={notify} fokus={fokus} onFokus={() => setFokus((f) => !f)} />}
      {activeTab === 'jadwal' && <KalenderScreen pengguna={pengguna} tim={boot.tim} opsiRoster={boot.opsi.filter((o) => o.grup === 'roster')} onBukaPica={bukaPica} notify={notify} fokus={fokus} onFokus={() => setFokus((f) => !f)} onPerubahanJadwal={() => api<{ jadwal: JadwalItem[] }>('/api/jadwal').then((d) => setSemuaJadwal(d.jadwal ?? [])).catch(() => undefined)} />}
      {activeTab === 'pengumuman' && <PengumumanScreen pengguna={pengguna} jumlahTim={boot.tim.length} notify={notify} />}
      {activeTab === 'roster' && <RosterScreen boot={boot} pengguna={pengguna} notify={notify} />}
      {activeTab === 'memo' && <MemoScreen boot={boot} pengguna={pengguna} notify={notify} />}
      {activeTab === 'notif' && <NotifikasiScreen boot={boot} notify={notify} />}
      {activeTab === 'team' && <TeamScreen pengguna={pengguna} onBootUlang={bootUlang} notify={notify} />}
      {activeTab === 'market' && <MarketScreen state={gameState} onBuy={handleBuySkin} onEquip={handleEquipSkin} />}
      {activeTab === 'missions' && <MissionsScreen state={gameState} admin={pengguna.peran === 'admin'} onStart={handleMissionStart} onSimpan={handleMisiSimpan} onHapus={handleMisiHapus} />}
      {activeTab === 'reports' && <ReportsScreen state={gameState} picaTerbuka={picaTerbuka} onSubmit={handleReportSubmit} />}
      {activeTab === 'calendar' && <CalendarScreen state={gameState} onRead={(r) => { setMonkeyDialogue(`Uu-aa! ${r.activityType}: ${r.achievedUnit.toFixed(2)} unit. Semangat!`); setActiveTab('habitat'); }} />}
      {activeTab === 'money' && <MoneyMonkeyScreen pengguna={pengguna} notify={notify} />}
      {activeTab === 'fire' && <FireMonkeyScreen pengguna={pengguna} notify={notify} />}
    </>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-950 select-none">
      {/* ---------- Header ponsel: satu baris ---------- */}
      {!fokus && (
        <header className="md:hidden area-warna flex items-center gap-2 px-2.5 py-1.5 min-h-12 shrink-0 border-b-4 border-white" style={{ background: 'var(--pk-blue)' }}>
          <div className="flex flex-col items-center shrink-0">
            <button
              onClick={() => setModalProfilBuka(true)}
              className="w-8 h-8 bg-white border-2 border-black flex items-center justify-center shrink-0 overflow-hidden shadow-sm active:scale-95 transition-transform"
              title="Klik untuk edit foto, nomor telepon & bagikan profil"
              aria-label="Profil Pengguna"
            >
              {gameState.profilePhoto ? <img src={gameState.profilePhoto} alt="Profil" className="w-full h-full object-cover" /> : <User size={16} className="text-black" />}
            </button>
            {/* Bar stamina tepat di bawah foto profil */}
            <button
              onClick={() => setModalStaminaBuka(true)}
              className="w-12 h-3.5 mt-0.5 bg-black border border-white overflow-hidden relative cursor-pointer active:scale-95 transition-transform"
              title={`Sisa Stamina: ${gameState.stamina.toFixed(1)}% (Klik untuk melihat info detail)`}
              aria-label="Info Bio-Stamina"
            >
              <div className="h-full stamina-bar-fill transition-all duration-300" style={{ width: `${gameState.stamina}%` }} />
              <span className="absolute inset-0 flex items-center justify-center text-[7.5px] font-mono font-black text-white mix-blend-difference leading-none">
                Sisa {gameState.stamina.toFixed(0)}%
              </span>
            </button>
          </div>
          <div className="flex-1 min-w-0 leading-tight">
            <div className="font-title text-[9px] text-white truncate">POKEMONKEY</div>
            <div className="text-[11px] text-yellow-200 uppercase truncate">{gameState.nickname} · {pengguna.peran}{demo ? ' · DEMO' : ''}</div>
          </div>
          <div className="chip-retro border-yellow-400 bg-black/50 text-yellow-300"><Star size={11} className="fill-yellow-300" /> {gameState.xp.toLocaleString('id-ID')}</div>
          {antrean > 0 && <span className="chip-retro border-amber-400 bg-amber-900/60 text-amber-200"><CloudUpload size={11} /> {antrean}</span>}
          <span className={`w-2.5 h-2.5 border border-white ${gameState.isOnline ? 'bg-emerald-400' : 'bg-red-500'}`} title={gameState.isOnline ? 'Online' : 'Offline'} />
        </header>
      )}

      {/* ---------- Header desktop ---------- */}
      {!fokus && (
        <header className="hidden md:flex retro-box min-h-[5.25rem] py-2 items-center justify-between mx-4 mt-4 z-20 relative">
          {syncing && <div className="absolute inset-0 bg-blue-500/20 animate-pulse z-[-1]" />}
          <div className="flex gap-4 items-center px-2">
            <div className="flex flex-col items-center shrink-0">
              <button
                onClick={() => setModalProfilBuka(true)}
                className="w-12 h-12 bg-white border-4 border-black flex items-center justify-center shrink-0 overflow-hidden shadow-sm cursor-pointer hover:border-yellow-400 hover:scale-105 active:scale-95 transition-all group relative"
                title="Klik untuk edit foto, nomor telepon & bagikan profil"
                aria-label="Profil Pengguna"
              >
                {gameState.profilePhoto ? (
                  <img src={gameState.profilePhoto} alt="Profil" className="w-full h-full object-cover" />
                ) : (
                  <User size={22} className="text-black group-hover:text-amber-700 transition-colors" />
                )}
                <span className="absolute bottom-0 right-0 bg-yellow-400 text-black p-0.5 border-t border-l border-black opacity-0 group-hover:opacity-100 transition-opacity" title="Ubah Foto Profil">
                  <Camera size={9} />
                </span>
              </button>
              {/* Bar stamina tepat di bawah foto profil */}
              <button
                onClick={() => setModalStaminaBuka(true)}
                className="w-16 sm:w-20 h-4 mt-1 bg-black border-2 border-white overflow-hidden relative cursor-pointer hover:border-yellow-400 hover:scale-105 active:scale-95 transition-all shadow group"
                title={`Sisa Stamina: ${gameState.stamina.toFixed(1)}% (Klik untuk melihat info detail)`}
                aria-label="Info Bio-Stamina"
              >
                <div className="h-full stamina-bar-fill transition-all duration-300" style={{ width: `${gameState.stamina}%` }} />
                <span className="absolute inset-0 flex items-center justify-center gap-0.5 text-[8.5px] font-mono font-black text-white mix-blend-difference leading-none tracking-tight">
                  <Flame size={9} className="shrink-0" />
                  Sisa {gameState.stamina.toFixed(0)}%
                </span>
              </button>
            </div>
            <div>
              <h1 className="font-title text-[12px] flex items-center gap-2 mb-1">
                POKEMONKEY
                <span className={`chip-retro !text-[10px] border-white/40 ${gameState.isOnline ? 'bg-blue-800' : 'bg-red-700'}`}>
                  {gameState.isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}{gameState.isOnline ? 'ONLINE' : 'OFFLINE'}
                </span>
                {antrean > 0 && <span className="chip-retro !text-[10px] border-amber-300 bg-amber-700 animate-pulse"><CloudUpload size={10} /> {antrean} MENUNGGU</span>}
                {demo && <span className="chip-retro !text-[10px] border-purple-300 bg-purple-700">DEMO</span>}
              </h1>
              <p className="text-[12px] text-yellow-200 uppercase">ID: {gameState.userId} · {gameState.fullName} · {pengguna.peran}</p>
            </div>
          </div>

          <div className="flex gap-5 items-center">
            <div className="flex gap-1.5 bg-black/60 p-2 border-2 border-white/20">
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <div key={i}>{i < Math.floor(gameState.lives) ? <Heart size={20} className="text-red-500 fill-red-500" /> : <HeartOff size={20} className="text-zinc-600" />}</div>
              ))}
            </div>
            <div className="retro-box !bg-zinc-900 border-yellow-500 min-w-[130px] flex items-center gap-3 px-4 !py-2">
              <Star size={18} className="text-yellow-400 fill-yellow-400 animate-pulse" />
              <div>
                <p className="text-[11px] text-zinc-300 uppercase leading-none mb-1">XP · Level {gameState.level}</p>
                <p className="font-title text-[12px] text-white">{gameState.xp.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-center px-2">
            <button onClick={() => pilihTab('money')} className="btn-retro btn-retro-sm bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white font-bold flex items-center gap-1.5" title="Money Monkey - Anggaran, RAB & Keuangan HCGA">
              <Coins size={15} />
              <span className="hidden xl:inline">Money Monkey</span>
            </button>
            <button onClick={() => pilihTab('fire')} className="btn-retro btn-retro-sm bg-gradient-to-r from-red-700 to-orange-700 hover:from-red-600 hover:to-orange-600 text-white font-bold flex items-center gap-1.5" title="Fire Monkey - Pantau Titik Api & Karhutla NASA FIRMS">
              <Flame size={15} />
              <span className="hidden xl:inline">Fire Monkey</span>
            </button>
            <button onClick={() => setMonkeyPointBuka(true)} className="btn-retro btn-retro-sm bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold flex items-center gap-1.5" title="Monkey Point - Tarik semua data & ekspor PowerPoint">
              <Presentation size={15} />
              <span className="hidden xl:inline">Monkey Point</span>
            </button>
            <button onClick={gantiTema} className="btn-ikon bg-zinc-800" title={tema === 'gelap' ? 'Mode terang (untuk di lapangan)' : 'Mode gelap'} aria-label="Ganti mode warna">
              {tema === 'gelap' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button onClick={() => setFokus(true)} className="btn-ikon bg-zinc-800" title="Layar penuh"><Maximize2 size={16} /></button>
            <button onClick={() => setPanduanBuka(true)} className="btn-ikon bg-yellow-500 text-black" title="Buku panduan" aria-label="Buka buku panduan">
              <HelpCircle size={17} />
            </button>
            <button onClick={handleLogout} className="btn-ikon bg-red-900" title="Keluar"><LogOut size={16} /></button>
          </div>
        </header>
      )}

      <main className={`flex-1 flex flex-col md:flex-row overflow-hidden relative ${fokus ? 'p-0' : 'p-1 md:p-4 gap-2 md:gap-4'}`}>
        {!fokus && (
          <aside className="hidden md:flex w-24 flex-col gap-2 overflow-auto custom-scrollbar pr-1">
            {URUTAN_TAB.map((t) => (
              <SidebarItem key={t} active={activeTab === t} icon={INFO_TAB[t].ikon} label={INFO_TAB[t].label} onClick={() => pilihTab(t)} color={INFO_TAB[t].warna} badge={t === 'pengumuman' ? pengumumanBaru : 0} />
            ))}
          </aside>
        )}

        {/* Tanpa z-index: bila section membuat konteks tumpukan, jendela/lembar di dalam
            layar (z-[100]) akan terkurung di bawah navigasi bawah ponsel (z-30). */}
        <section className="flex-1 min-w-0 overflow-hidden relative flex flex-col">
          {activeTab === 'habitat' ? layar : (
            <div className={`flex-1 retro-box !bg-black/85 !p-0 overflow-hidden relative flex flex-col ${fokus ? '!border-0 !shadow-none' : ''}`}>{pitaDemo}{layar}</div>
          )}
        </section>
      </main>

      {/* ---------- Navigasi bawah ponsel ---------- */}
      {!fokus && (
        <nav className="md:hidden h-14 bg-zinc-900 border-t-4 border-white flex items-stretch z-30 shrink-0">
          {TAB_UTAMA.map((t) => (
            <NavButton key={t} active={activeTab === t} icon={INFO_TAB[t].ikon} label={INFO_TAB[t].label} onClick={() => pilihTab(t)} color={INFO_TAB[t].teks} badge={t === 'pengumuman' ? pengumumanBaru : 0} />
          ))}
          <NavButton active={menuBuka || !TAB_UTAMA.includes(activeTab)} icon={<Menu />} label={TAB_UTAMA.includes(activeTab) ? 'MENU' : INFO_TAB[activeTab].label} onClick={() => setMenuBuka(true)} color="text-white" badge={0} />
        </nav>
      )}

      {fokus && (
        <button onClick={() => setFokus(false)} className="fixed top-2 right-2 z-50 btn-ikon bg-zinc-800/90" title="Keluar layar penuh"><Minimize2 size={16} /></button>
      )}

      {/* ---------- Lembar menu & profil (ponsel) ---------- */}
      {menuBuka && (
        <div className="fixed inset-0 z-[90] bg-black/80 md:hidden" onClick={() => setMenuBuka(false)}>
          <div className="absolute inset-x-0 bottom-0 retro-box !bg-zinc-900 !p-3 max-h-[85vh] overflow-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => { setMenuBuka(false); setModalProfilBuka(true); }}
                title="Klik untuk edit foto, nomor telepon & profil"
              >
                <div className="w-10 h-10 bg-white border-[3px] border-black flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                  {gameState.profilePhoto ? <img src={gameState.profilePhoto} alt="Profil" className="w-full h-full object-cover" /> : <User size={18} className="text-black" />}
                </div>
                <div className="leading-tight">
                  <p className="text-[14px] font-bold text-white flex items-center gap-1.5">
                    {gameState.fullName}
                    <span className="text-[10px] text-yellow-400 font-normal">[Edit]</span>
                  </p>
                  <p className="text-[11px] text-zinc-300 uppercase">{pengguna.jabatan ?? pengguna.peran} · Level {gameState.level}</p>
                </div>
              </div>
              <button onClick={() => setMenuBuka(false)} className="text-zinc-400"><X size={22} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="panel-retro !p-2">
                <p className="text-[10px] text-zinc-400 uppercase mb-1">Nyawa</p>
                <div className="flex gap-1">{Array.from({ length: MAX_LIVES }).map((_, i) => i < Math.floor(gameState.lives) ? <Heart key={i} size={14} className="text-red-500 fill-red-500" /> : <HeartOff key={i} size={14} className="text-zinc-600" />)}</div>
              </div>
              <div
                onClick={() => { setMenuBuka(false); setModalStaminaBuka(true); }}
                className="panel-retro !p-2 cursor-pointer hover:border-yellow-400 active:scale-95 transition-all"
                title="Klik untuk melihat info Bio-Stamina lengkap"
              >
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] text-zinc-400 uppercase">Stamina</p>
                  <p className="text-[10px] text-yellow-300 font-mono font-bold">Sisa {gameState.stamina.toFixed(0)}%</p>
                </div>
                <div className="h-3 bg-black border-2 border-white/40 overflow-hidden relative">
                  <div className="h-full stamina-bar-fill" style={{ width: `${gameState.stamina}%` }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {URUTAN_TAB.filter((t) => !TAB_UTAMA.includes(t)).map((t) => (
                <button key={t} onClick={() => pilihTab(t)} className={`retro-box !p-2 flex flex-col items-center gap-1 ${activeTab === t ? INFO_TAB[t].warna + ' teks-atas-warna border-white' : '!bg-zinc-800 border-zinc-600'}`}>
                  {React.cloneElement(INFO_TAB[t].ikon as React.ReactElement<{ size?: number }>, { size: 20 })}
                  <span className="text-[10px] font-bold">{INFO_TAB[t].label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="grid grid-cols-2 gap-2 w-full">
                <button onClick={() => { pilihTab('money'); setMenuBuka(false); }} className="btn-retro btn-retro-sm bg-gradient-to-r from-emerald-700 to-teal-700 text-white font-bold flex items-center justify-center gap-1.5" title="Buka Money Monkey">
                  <Coins size={14} /> Money Monkey
                </button>
                <button onClick={() => { pilihTab('fire'); setMenuBuka(false); }} className="btn-retro btn-retro-sm bg-gradient-to-r from-red-700 to-orange-700 text-white font-bold flex items-center justify-center gap-1.5" title="Buka Fire Monkey">
                  <Flame size={14} /> Fire Monkey
                </button>
              </div>
              <button onClick={() => { setMonkeyPointBuka(true); setMenuBuka(false); }} className="btn-retro btn-retro-sm bg-gradient-to-r from-amber-600 to-yellow-600 text-white font-bold flex-1 min-w-[100%] flex items-center justify-center gap-1.5">
                <Presentation size={14} /> Monkey Point (Unduh PPTX)
              </button>
              <button onClick={gantiTema} className="btn-retro btn-retro-sm bg-zinc-700 flex-1 min-w-[46%]">
                {tema === 'gelap' ? <><Sun size={14} /> Mode terang</> : <><Moon size={14} /> Mode gelap</>}
              </button>
              <button onClick={() => { setFokus(true); setMenuBuka(false); }} className="btn-retro btn-retro-sm bg-zinc-700 flex-1 min-w-[46%]"><Maximize2 size={14} /> Layar penuh</button>
              <button onClick={() => { setPanduanBuka(true); setMenuBuka(false); }} className="btn-retro btn-retro-sm bg-yellow-600 flex-1"><HelpCircle size={14} /> Panduan</button>
              <button onClick={handleLogout} className="btn-retro btn-retro-sm bg-red-900 flex-1"><LogOut size={14} /> Keluar</button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-3 text-center">{gameState.isOnline ? 'Tersambung' : 'Offline'}{demo ? ' · mode demo, data di browser ini' : ''}</p>
          </div>
        </div>
      )}

      {/* GAME: lapisan layar penuh di atas header & navigasi bawah */}
      {activeTab === 'game' && (
        <div className="fixed inset-0 z-[80] bg-black">
          <MonkeyRun skin={skinAktif} onGainXP={handleGainXP} onKeluar={() => setActiveTab('habitat')} />
        </div>
      )}

      {showNotification && (
        <div className="fixed inset-x-0 bottom-20 md:bottom-10 flex justify-center z-[95] animate-bounce px-4 pointer-events-none">
          <div className="retro-box !bg-white text-black text-[13px] md:text-[14px] font-bold px-5 py-3 border-black shadow-2xl">&gt; {showNotification}</div>
        </div>
      )}

      {alarmAktif && (
        <ModalAlarm
          alarm={alarmAktif}
          onTutup={() => {
            setAlarmAktif(null);
            hentikanAlarm();
          }}
          onBukaKalender={() => pilihTab('jadwal')}
          notify={notify}
        />
      )}

      {panelAlarmBuka && (
        <PanelAlarm
          daftarAlarm={daftarAlarm}
          onTutup={() => setPanelAlarmBuka(false)}
          onBukaKalender={() => pilihTab('jadwal')}
          onUjiCobaAlarm={() => {
            const ujiAlarm: AlarmItem = {
              id: 'uji-' + Date.now(),
              judul: 'Meeting Koordinasi Revegetasi (Simulasi)',
              jamMulai: new Date(Date.now() + 480 * 60000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.'),
              menitSebelum: 15,
              waktuTargetMs: Date.now(),
              keterangan: 'Simulasi pengujian alarm dengan nada dering kustom',
            };
            setAlarmAktif(ujiAlarm);
            void bunyikanAlarm(ujiAlarm);
          }}
          notify={notify}
        />
      )}

      <ModalPanduanAplikasi isOpen={panduanBuka} onClose={() => setPanduanBuka(false)} />

      {monkeyPointBuka && sesi && (
        <ModalMonkeyPoint
          boot={sesi.boot}
          pengguna={sesi.pengguna}
          onTutup={() => setMonkeyPointBuka(false)}
          notify={notify}
        />
      )}

      {modalStaminaBuka && (
        <ModalStamina
          stamina={gameState.stamina}
          lastFeedingTime={gameState.lastFeedingTime}
          reports={gameState.reports}
          totalAchieved={totalAchieved}
          onTutup={() => setModalStaminaBuka(false)}
          onBukaLapor={() => {
            pilihTab('reports');
            setModalStaminaBuka(false);
          }}
          onPilihReport={(r) => {
            setMonkeyDialogue(`Uu-aa! ${r.activityType} ${r.achievedUnit.toFixed(2)} unit. ${r.notes}`);
            setActiveTab('habitat');
            setModalStaminaBuka(false);
          }}
        />
      )}

      {modalProfilBuka && sesi && (
        <ModalProfil
          gameState={gameState}
          pengguna={sesi.pengguna}
          picaTerbukaCount={picaTerbuka.length}
          picaTelatCount={picaTerbuka.filter((p) => p.telat).length}
          totalAchieved={totalAchieved}
          onSimpanFoto={async (fotoBase64) => {
            setGameState((p) => ({ ...p, profilePhoto: fotoBase64 }));
            try {
              lupakanFoto(sesi.pengguna.foto);
              const d = await simpanFotoProfil(fotoBase64);
              setSesi((x) => (x ? { ...x, pengguna: { ...x.pengguna, foto: d.foto } } : null));
              void bootUlang(); // agar anggota lain ikut melihat foto barunya
            } catch (e) {
              notify(e instanceof Error ? e.message.toUpperCase() : 'FOTO GAGAL DISIMPAN KE SERVER');
            }
          }}
          onHapusFoto={async () => {
            setGameState((p) => ({ ...p, profilePhoto: '' }));
            try {
              lupakanFoto(sesi.pengguna.foto);
              await hapusFotoProfil();
              setSesi((x) => (x ? { ...x, pengguna: { ...x.pengguna, foto: null } } : null));
              void bootUlang();
            } catch (e) {
              notify(e instanceof Error ? e.message.toUpperCase() : 'FOTO GAGAL DIHAPUS DI SERVER');
            }
          }}
          onSimpanWa={async (wa) => {
            await api(`/api/tim/${sesi.pengguna.id}`, { method: 'PATCH', body: { wa } });
            setSesi((s) => s ? { ...s, pengguna: { ...s.pengguna, wa } } : null);
            setGameState((p) => ({ ...p, phone: wa }));
            void bootUlang();
          }}
          onTutup={() => setModalProfilBuka(false)}
          notify={notify}
        />
      )}
    </div>
  );
};

const SidebarItem = ({ active, icon, label, onClick, color, badge }: { active: boolean; icon: React.ReactElement; label: string; onClick: () => void; color: string; badge: number }) => (
  <button onClick={onClick} className={`retro-box !p-2 flex flex-col items-center gap-1 transition-all relative shrink-0 ${active ? color + ' teks-atas-warna translate-x-1 scale-105 border-white' : '!bg-zinc-800 opacity-70 border-zinc-700 hover:opacity-100'}`}>
    {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 20 })}
    <span className="text-[10px] font-bold uppercase">{label}</span>
    {badge > 0 && <span className="absolute -top-1 -right-1 bg-pink-600 text-[10px] font-bold px-1 border border-white">{badge}</span>}
  </button>
);

const NavButton = ({ active, icon, label, onClick, color, badge }: { active: boolean; icon: React.ReactElement; label: string; onClick: () => void; color: string; badge: number }) => (
  <button onClick={onClick} className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${active ? 'bg-white/10 ' + color : 'text-zinc-500'}`}>
    {React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: 20 })}
    <span className="text-[10px] font-bold">{label}</span>
    {badge > 0 && <span className="absolute top-1 right-3 bg-pink-600 text-white teks-atas-warna text-[10px] font-bold px-1 border border-white">{badge}</span>}
  </button>
);

export default App;
