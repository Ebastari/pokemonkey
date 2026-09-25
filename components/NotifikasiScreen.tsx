import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, BellOff, BellRing, CalendarClock, ClipboardList, Loader2, Megaphone, RefreshCw, Send, Share, Smartphone, SquarePlus, Star,
} from 'lucide-react';
import { api, demoAktif } from '../lib/api';
import { ambilAlarmPica, simpanJamBawaanAlarm } from '../lib/pica-alarm';
import type { Bootstrap } from '../lib/tipe-api';
import type { AcaraSiap } from '../server/src/ringkasan';
import {
  SEMUA_SLOT, PESAN_LANGGANAN, jalurNotifikasi, perluPasangKeLayarUtama, jamDariPengaturan,
  statusIzin, mintaIzin, bacaSlot, simpanSlot, kirimContoh, tampilkanSlot, periksaSekarang,
  perbaruiLangganan, ambilDiagnosa,
  type Diagnosa, type HasilLangganan, type Izin, type NotifSiap, type Slot,
} from '../lib/notifikasi';

/** Pengaturan pengingat harian: 07.00 PICA · 12.00 Info · 17.00 XP (WITA). */

interface Props {
  boot: Bootstrap;
  notify: (pesan: string) => void;
}

const INFO_SLOT: Record<Slot, { label: string; ikon: React.ReactElement; teks: string; tepi: string; ket: string }> = {
  pagi: { label: 'PICA', ikon: <ClipboardList size={15} />, teks: 'text-amber-300', tepi: 'border-amber-500', ket: 'PICA milikmu yang masih Open' },
  siang: { label: 'INFO', ikon: <Megaphone size={15} />, teks: 'text-pink-300', tepi: 'border-pink-500', ket: 'Pengumuman yang belum kamu baca' },
  sore: { label: 'XP', ikon: <Star size={15} />, teks: 'text-yellow-300', tepi: 'border-yellow-500', ket: 'XP hari ini, atau pengingat melapor' },
};

const jamTampil = (jam: string) => jam.replace(':', '.');
const keMenit = (jam: string) => {
  const [j, m] = jam.split(':').map(Number);
  return (j || 0) * 60 + (m || 0);
};
const menitWita = () => {
  const d = new Date(Date.now() + 480 * 60000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const jamWita = (iso: string) =>
  new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }).replace(':', '.');

const waktuWita = (ms?: number) =>
  ms ? `${new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WITA` : '—';

export const NotifikasiScreen: React.FC<Props> = ({ boot, notify }) => {
  const jalur = useMemo(jalurNotifikasi, []);
  const pasangDulu = useMemo(perluPasangKeLayarUtama, []);
  const jam = useMemo(() => jamDariPengaturan(boot.pengaturan), [boot.pengaturan]);
  const demo = demoAktif();

  const [jamAlarmPica, setJamAlarmPica] = useState('07:00');

  const [izin, setIzin] = useState<Izin | null>(null);
  const [slot, setSlot] = useState(bacaSlot);
  const [isi, setIsi] = useState<Partial<Record<Slot, NotifSiap>>>({});
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState<'izin' | 'contoh' | 'periksa' | Slot | null>(null);
  const [langganan, setLangganan] = useState<HasilLangganan | null>(null);
  const [diagnosa, setDiagnosa] = useState<Diagnosa | null>(null);
  const [acara, setAcara] = useState<AcaraSiap[]>([]);

  const muatIsi = useCallback(async () => {
    setMemuat(true);
    try {
      const hasil = await Promise.all(SEMUA_SLOT.map((s) => api<NotifSiap>(`/api/notif/ringkas?slot=${s}`)));
      setIsi(Object.fromEntries(hasil.map((n) => [n.slot, n])) as Partial<Record<Slot, NotifSiap>>);
      const kal = await api<{ acara: AcaraSiap[] }>('/api/notif/acara').catch(() => ({ acara: [] }));
      setAcara(kal.acara ?? []);
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT PRATINJAU');
    } finally {
      setMemuat(false);
    }
  }, [notify]);

  // Jam alarm tenggat PICA tersimpan di server agar ikut walau APK dipasang ulang.
  useEffect(() => {
    let hidup = true;
    ambilAlarmPica().then((d) => { if (hidup) setJamAlarmPica(d.jamBawaan); }).catch(() => undefined);
    return () => { hidup = false; };
  }, []);

  const ubahJamAlarmPica = async (jam: string) => {
    setJamAlarmPica(jam);
    try { await simpanJamBawaanAlarm(jam); notify(`JAM ALARM PICA: ${jam} WITA`); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN JAM ALARM'); }
  };

  useEffect(() => {
    void muatIsi();
    void statusIzin().then(setIzin);
    if (jalur === 'native') void ambilDiagnosa().then(setDiagnosa);
  }, [muatIsi, jalur]);

  useEffect(() => {
    if (jalur === 'push' && izin === 'granted') void perbaruiLangganan().then(setLangganan);
  }, [jalur, izin]);

  // ---------- Aksi ----------

  const izinkan = async () => {
    setSibuk('izin');
    const hasil = await mintaIzin();
    setIzin(hasil);
    setSibuk(null);
    notify(hasil === 'granted' ? 'NOTIFIKASI DIIZINKAN' : 'IZIN NOTIFIKASI DITOLAK');
  };

  const ubahSlot = (kunci: string, label: string) => {
    const baru = { ...slot, [kunci]: !slot[kunci] };
    setSlot(baru);
    void simpanSlot(baru);
    notify(`PENGINGAT ${label} ${baru[kunci] ? 'DINYALAKAN' : 'DIMATIKAN'}`);
  };

  const contoh = async () => {
    setSibuk('contoh');
    const hasil = await kirimContoh();
    setSibuk(null);
    notify(hasil.pesan.toUpperCase());
  };

  const periksa = async () => {
    setSibuk('periksa');
    let pesan = 'PRATINJAU DIPERBARUI';
    if (jalur === 'native') {
      await periksaSekarang();
      setDiagnosa(await ambilDiagnosa());
      pesan = 'PENJADWAL DIPERIKSA';
    } else if (jalur === 'push') {
      const hasil = await perbaruiLangganan();
      setLangganan(hasil);
      pesan = hasil === 'aktif' ? 'PERANGKAT TERDAFTAR' : PESAN_LANGGANAN[hasil].toUpperCase();
    }
    await muatIsi();
    setSibuk(null);
    notify(pesan);
  };

  const tampilkan = async (s: Slot) => {
    const n = isi[s];
    if (!n) return;
    if (izin !== 'granted') {
      notify('IZINKAN NOTIFIKASI TERLEBIH DAHULU');
      return;
    }
    setSibuk(s);
    const ok = await tampilkanSlot(n);
    setSibuk(null);
    notify(ok ? 'NOTIFIKASI DITAMPILKAN' : 'GAGAL MENAMPILKAN NOTIFIKASI');
  };

  // ---------- Keadaan ----------

  const judulStatus =
    izin === null ? 'Memeriksa izin…'
      : jalur === 'tidak-ada' ? (pasangDulu ? 'Pasang ke Layar Utama dulu' : 'Notifikasi tidak didukung')
        : izin === 'granted' ? 'Notifikasi menyala'
          : izin === 'denied' ? 'Notifikasi diblokir'
            : 'Notifikasi belum diizinkan';

  const teksJalur =
    jalur === 'native' ? 'APK Android · penjadwal tetap berjalan saat aplikasi ditutup'
      : jalur === 'push' ? 'Web Push · dikirim server saat aplikasi ditutup'
        : jalur === 'browser' ? (demo ? 'Mode demo · tanpa server, hanya contoh notifikasi' : 'Browser tanpa Web Push · hanya contoh notifikasi')
          : pasangDulu ? 'Safari di iPhone baru menerima notifikasi setelah aplikasi dipasang' : 'Coba Chrome, Edge, atau Safari versi terbaru';

  const berikutnya = useMemo(() => {
    const nyala = SEMUA_SLOT.filter((s) => slot[s]);
    if (nyala.length === 0) return 'Semua pengingat dimatikan';
    const kini = menitWita();
    const s = nyala.find((x) => keMenit(jam[x]) > kini);
    return s
      ? `Berikutnya hari ini ${jamTampil(jam[s])} · ${INFO_SLOT[s].label}`
      : `Berikutnya besok ${jamTampil(jam[nyala[0]])} · ${INFO_SLOT[nyala[0]].label}`;
  }, [slot, jam]);

  const catatan =
    jalur === 'native' ? 'Android membangunkan penjadwal sekitar tiap 15 menit, jadi pengingat bisa bergeser beberapa menit. Di HP Xiaomi, Oppo, vivo, atau Samsung, kecualikan POKEMONKEY dari penghemat baterai agar pengingat tetap datang.'
      : jalur === 'push' ? 'Server mengirim pengingat pada jam di atas. Buka aplikasi sesekali agar pendaftaran perangkat ini tetap berlaku.'
        : jalur === 'browser' ? (demo
          ? 'Mode demo tidak punya server, jadi pengingat terjadwal tidak dikirim. Pratinjau di atas memakai data demo dan bisa dicoba sebagai notifikasi browser.'
          : 'Browser ini tidak mendukung Web Push. Pasang APK di Android, atau buka lewat Chrome, Edge, atau Safari terbaru.')
          : '';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 border-b-4 border-white pb-2 mb-3 px-2 pt-2">
        <h2 className="judul-layar flex items-center gap-2 mr-auto"><Bell size={16} className="text-rose-400" /> Notifikasi</h2>
        <span className="chip-retro border-white/40 bg-black/50 text-zinc-200">WITA</span>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar px-2 pb-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-3">
          {/* ---------- Status perangkat ---------- */}
          <section className="panel-retro">
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 border-[3px] border-black flex items-center justify-center shrink-0 ${izin === 'granted' ? 'bg-emerald-400' : izin === 'denied' ? 'bg-red-400' : 'bg-zinc-300'}`}>
                {izin === 'granted' ? <BellRing size={20} className="text-black" /> : <BellOff size={20} className="text-black" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[16px] font-bold text-white leading-snug">{judulStatus}</p>
                <p className="text-[12px] text-zinc-300 mt-0.5 leading-snug">{teksJalur}</p>
                {izin === 'granted' && (jalur === 'native' || jalur === 'push') && <p className="text-[12px] text-emerald-300 mt-1">{berikutnya}</p>}
              </div>
            </div>

            {izin === 'prompt' && jalur !== 'tidak-ada' && (
              <button onClick={izinkan} disabled={sibuk !== null} className="btn-retro bg-rose-600 w-full mt-3">
                {sibuk === 'izin' ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Izinkan notifikasi
              </button>
            )}
            {izin === 'denied' && jalur !== 'tidak-ada' && (
              <p className="text-[12px] text-red-300 mt-3 leading-relaxed">
                {jalur === 'native'
                  ? 'Buka Setelan HP → Aplikasi → POKEMONKEY → Notifikasi, lalu nyalakan.'
                  : 'Buka pengaturan situs (ikon di kiri bilah alamat), izinkan Notifikasi, lalu muat ulang halaman.'}
              </p>
            )}
            {jalur === 'push' && langganan && langganan !== 'aktif' && (
              <p className="text-[12px] text-amber-300 mt-3 leading-relaxed">{PESAN_LANGGANAN[langganan]}</p>
            )}
          </section>

          {pasangDulu && <PanduanIphone />}

          {/* ---------- Pengingat harian ---------- */}
          <section>
            <p className="label-retro px-1">Pengingat harian</p>
            <div className="flex flex-col gap-2">
              {SEMUA_SLOT.map((s) => {
                const n = isi[s];
                const nyala = slot[s];
                const info = INFO_SLOT[s];
                return (
                  <div key={s} className={`retro-box !p-0 !bg-zinc-900/80 ${nyala ? info.tepi : 'border-zinc-700'}`}>
                    <div className="flex items-center gap-3 px-3 py-2 border-b-2 border-white/10">
                      <span className={`font-title text-[12px] tabular-nums ${nyala ? 'text-white' : 'text-zinc-500'}`}>{jamTampil(jam[s])}</span>
                      <span className={`flex items-center gap-1.5 text-[13px] font-bold ${nyala ? info.teks : 'text-zinc-500'}`}>{info.ikon}{info.label}</span>
                      <Saklar nyala={nyala} onUbah={() => ubahSlot(s, `${info.label} ${jamTampil(jam[s])}`)} label={`Pengingat ${info.label} pukul ${jamTampil(jam[s])}`} />
                    </div>

                    <div className={`px-3 py-3 ${nyala ? '' : 'opacity-50'}`}>
                      {!n ? (
                        memuat && <p className="text-[12px] text-zinc-400 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Menyusun pratinjau…</p>
                      ) : (
                        <>
                          {/* Pratinjau berbentuk notifikasi HP */}
                          <div className={`bg-zinc-100 text-black border-[3px] border-black px-3 py-2 shadow-[4px_4px_0_#000] ${n.tampil ? '' : 'opacity-60'}`}>
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-zinc-600 mb-1">
                              <span className="w-3 h-3 bg-emerald-600 border border-black" aria-hidden="true" /> POKEMONKEY · {jamTampil(jam[s])}
                            </div>
                            <p className="text-[14px] font-bold leading-snug">{n.judul}</p>
                            {n.isi && <p className="text-[13px] leading-snug text-zinc-800 mt-0.5 whitespace-pre-line">{n.isi}</p>}
                          </div>
                          <div className="flex items-center gap-2 mt-2.5">
                            <p className="text-[11px] text-zinc-400 flex-1 leading-snug">
                              {n.tampil ? info.ket : 'Tidak ada yang perlu diberitahukan — pengingat ini dilewati.'}
                            </p>
                            {n.tampil && (
                              <button onClick={() => tampilkan(s)} disabled={sibuk !== null} className="btn-retro btn-retro-sm bg-zinc-700 shrink-0">
                                {sibuk === s ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />} Tampilkan
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Jam alarm tenggat PICA: dipakai semua PICA yang alarmnya dinyalakan di layar PICA. */}
          <section>
            <p className="label-retro px-1">Alarm tenggat PICA</p>
            <div className="retro-box !p-3 !bg-zinc-900/80 border-amber-500 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-amber-300">Jam bunyi</p>
                <p className="text-[12px] text-zinc-400 leading-snug">
                  Berbunyi sehari sebelum tenggat dan pada hari tenggat. Alarm dinyalakan per PICA di layar PICA;
                  bawaannya mati agar tidak bertumpuk dengan rekap pagi.
                </p>
              </div>
              <input
                type="time"
                value={jamAlarmPica}
                onChange={(e) => ubahJamAlarmPica(e.target.value)}
                className="input-retro !w-auto"
                aria-label="Jam alarm tenggat PICA"
              />
            </div>
          </section>

          <section>
            <p className="label-retro px-1">Pengingat acara kalender</p>
            <div className={`retro-box !p-0 !bg-zinc-900/80 ${slot.acara !== false ? 'border-cyan-500' : 'border-zinc-700'}`}>
              <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-white/10">
                <CalendarClock size={15} className={slot.acara !== false ? 'text-cyan-300' : 'text-zinc-500'} />
                <span className={`text-[13px] font-bold ${slot.acara !== false ? 'text-cyan-300' : 'text-zinc-500'}`}>ACARA</span>
                <Saklar nyala={slot.acara !== false} onUbah={() => ubahSlot('acara', 'ACARA KALENDER')} label="Pengingat acara kalender" />
              </div>

              <div className={`px-3 py-3 ${slot.acara !== false ? '' : 'opacity-50'}`}>
                {acara.length === 0 ? (
                  <p className="text-[12px] text-zinc-400 leading-snug">
                    Hari ini tidak ada acara berpengingat. Atur per acara lewat layar JADWAL — pilih acaranya, lalu isi kolom Pengingat.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {acara.map((a) => (
                      <li key={a.kunci} className="flex items-baseline gap-2 text-[13px]">
                        <span className="font-title text-[10px] text-cyan-300 tabular-nums shrink-0">{jamWita(a.ingatkanPada)}</span>
                        <span className="text-zinc-100 leading-snug">{a.judul}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-[11px] text-zinc-400 mt-2 leading-snug">
                  {jalur === 'native'
                    ? 'Alarm dipasang di HP tepat pada jamnya, bahkan saat aplikasi tertutup.'
                    : jalur === 'push'
                      ? 'Dikirim server; karena pemeriksaannya tiap 15 menit, bisa datang beberapa menit setelah jam pengingat.'
                      : 'Mode ini hanya menampilkan daftarnya; pengingatnya berbunyi di APK atau lewat Web Push.'}
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={contoh} disabled={sibuk !== null || jalur === 'tidak-ada'} className="btn-retro bg-zinc-700">
              {sibuk === 'contoh' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kirim contoh
            </button>
            <button onClick={periksa} disabled={sibuk !== null} className="btn-retro bg-zinc-700">
              {sibuk === 'periksa' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Periksa sekarang
            </button>
          </div>

          {jalur === 'native' && (
            <section className="panel-retro">
              <p className="label-retro">Diagnosa penjadwal</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
                <dt className="text-zinc-400">Terakhir memeriksa</dt>
                <dd className="text-zinc-100">{waktuWita(diagnosa?.terakhirPeriksa)}</dd>
                <dt className="text-zinc-400">Terakhir menjadwalkan</dt>
                <dd className="text-zinc-100">{waktuWita(diagnosa?.terakhirKirim)}</dd>
                <dt className="text-zinc-400">Hari ini</dt>
                <dd className="text-zinc-100">{SEMUA_SLOT.map((s) => `${INFO_SLOT[s].label} ${diagnosa?.slot?.[s] ?? 'menunggu'}`).join(' · ')}</dd>
                <dt className="text-zinc-400">Token titipan</dt>
                <dd className={diagnosa?.punyaKonfigurasi ? 'text-emerald-300' : 'text-amber-300'}>
                  {!diagnosa ? 'Penjadwal belum menjawab' : diagnosa.punyaKonfigurasi ? 'Tersimpan' : 'Belum ada — tutup lalu buka ulang aplikasi'}
                </dd>
              </dl>
            </section>
          )}

          {catatan && <p className="text-[12px] text-zinc-400 leading-relaxed px-1">{catatan}</p>}
        </div>
      </div>
    </div>
  );
};

const Saklar: React.FC<{ nyala: boolean; onUbah: () => void; label: string }> = ({ nyala, onUbah, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={nyala}
    aria-label={label}
    onClick={onUbah}
    className={`ml-auto relative shrink-0 w-12 h-6 border-[3px] border-black transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 ${nyala ? 'bg-emerald-500' : 'bg-zinc-600'}`}
  >
    <span className={`absolute top-0 h-full w-[18px] bg-white transition-[left] motion-reduce:transition-none ${nyala ? 'left-[24px]' : 'left-0'}`} />
  </button>
);

const LANGKAH_IPHONE: React.ReactNode[] = [
  <>Buka POKEMONKEY di <b>Safari</b>.</>,
  <>Ketuk <Share size={13} className="inline -mt-0.5" /> <b>Bagikan</b> di bilah bawah.</>,
  <>Pilih <SquarePlus size={13} className="inline -mt-0.5" /> <b>Tambah ke Layar Utama</b>.</>,
  <>Buka POKEMONKEY dari ikon barunya, lalu kembali ke menu <b>NOTIF</b>.</>,
];

const PanduanIphone: React.FC = () => (
  <section className="retro-box !bg-sky-950/70 border-sky-400 !p-3">
    <p className="text-[15px] font-bold text-white flex items-center gap-2"><Smartphone size={16} className="text-sky-300" /> Pasang ke Layar Utama iPhone</p>
    <p className="text-[12px] text-zinc-300 mt-1 leading-relaxed">
      iPhone hanya mengirim notifikasi ke aplikasi web yang sudah dipasang di Layar Utama (iOS 16.4 atau lebih baru).
    </p>
    <ol className="mt-3 flex flex-col gap-2 text-[13px] text-zinc-100">
      {LANGKAH_IPHONE.map((langkah, i) => (
        <li key={i} className="flex gap-2 items-start">
          <span className="w-5 h-5 shrink-0 bg-sky-400 text-black border-2 border-black flex items-center justify-center font-title text-[8px]">{i + 1}</span>
          <span className="leading-snug">{langkah}</span>
        </li>
      ))}
    </ol>
  </section>
);
