import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Phone, MessageCircle, Loader2, ClipboardList, NotebookPen, Backpack, CalendarRange, Star, Pencil, Mail, TrendingUp,
} from 'lucide-react';
import { SKINS } from '../constants';
import { LatarSkin, KELANGKAAN, AvatarSkin } from './LatarSkin';
import type { AwalPesan } from './KotakSurat';
import { api } from '../lib/api';
import type { Opsi, Pengguna } from '../lib/tipe-api';
import { warna } from '../lib/warna';
import { useFotoProfil } from '../lib/foto';
import { namaTampil } from '../lib/nama';
import * as W from '../lib/waktu';
import { susunPesanTagihPica } from '../server/src/ringkasan';

/**
 * Kartu anggota: dibuka dengan mengetuk monyet orang lain di KEBUN.
 *
 * Isinya yang perlu diketahui sebelum menegur seseorang — capaian, PICA yang
 * masih terbuka, roster minggu ini, memo tim, dan laporan terakhirnya — lalu
 * tombol WhatsApp berisi daftar PICA itu.
 *
 * Pesannya hanya disiapkan, tidak pernah terkirim sendiri: tombolnya membuka
 * WhatsApp dengan teks siap kirim, dan yang menekan "kirim" tetap pemakainya.
 * Teksnya juga boleh disunting dulu.
 */

interface BarisPica { id: string; judul: string; status: string; due_date: string | null; bidang?: string | null }
interface BarisMemo { id: string; judul: string; ringkasan: string | null; kategori: string | null; status: string | null; tanggal: string | null }
interface BarisLaporan { id: string; jenis: string | null; capaian: number | null; satuan: string | null; pica_id: string | null; catatan: string | null; dibuat_pada: string }

interface DataProfil {
  anggota: { id: string; nama: string; jabatan: string | null; bidang: string | null; peran: string; wa: string | null; foto?: string | null };
  profil: { xp: number; level: number; luas_tanam: number; stamina: number; terakhir_aktif: string | null; skin_aktif?: string | null } | null;
  pica: BarisPica[];
  roster: { tanggal: string; kode: string; catatan: string | null }[];
  memo: BarisMemo[];
  laporan: BarisLaporan[];
  hariIni: string;
}

interface Props {
  userId: string;
  /** Nama sementara sampai datanya termuat, supaya kartunya tidak kosong. */
  nama?: string;
  pengguna: Pengguna;
  opsiRoster?: Opsi[];
  notify: (pesan: string) => void;
  onTutup: () => void;
  /** Kotak Surat: kirim pesan / minta progres ke anggota ini. */
  onTulisPesan?: (awal: AwalPesan) => void;
}

const KODE_ROSTER: Record<string, string> = {
  D: 'Shift Siang', N: 'Shift Malam', OFF: 'Libur', FB: 'Field Break / Cuti Tahunan', IK: 'Ijin Khusus',
};

const nomorWa = (wa: string) => wa.replace(/[^0-9]/g, '');
const waTampil = (wa: string) => {
  const n = nomorWa(wa);
  return n.startsWith('62') ? `+${n.slice(0, 2)} ${n.slice(2, 5)}-${n.slice(5, 9)}-${n.slice(9)}` : n;
};

export const PanelAnggota: React.FC<Props> = ({ userId, nama, pengguna, opsiRoster, notify, onTutup, onTulisPesan }) => {
  const [pilihProgres, setPilihProgres] = useState(false);
  const [data, setData] = useState<DataProfil | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [pesan, setPesan] = useState('');
  const [suntingPesan, setSuntingPesan] = useState(false);
  const [editBuka, setEditBuka] = useState(false);
  const [formAkun, setFormAkun] = useState({ nama: '', jabatan: '', bidang: '', peran: 'anggota', wa: '' });
  const [menyimpanAkun, setMenyimpanAkun] = useState(false);
  const bolehKelola = pengguna.peran === 'admin' || pengguna.peran === 'supervisor';

  useEffect(() => {
    let hidup = true;
    setMemuat(true);
    api<DataProfil>(`/api/tim/${userId}/profil`)
      .then((d) => {
        if (!hidup) return;
        setData(d);
        setPesan(susunPesanTagihPica({ nama: d.anggota.nama, dari: pengguna.nama, pica: d.pica, hariIni: d.hariIni }));
      })
      .catch((e) => notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT DATA ANGGOTA'))
      .finally(() => { if (hidup) setMemuat(false); });
    return () => { hidup = false; };
  }, [userId, pengguna.nama, notify]);

  useEffect(() => {
    if (data?.anggota) {
      setFormAkun({
        nama: data.anggota.nama || '',
        jabatan: data.anggota.jabatan || '',
        bidang: data.anggota.bidang || '',
        peran: data.anggota.peran || 'anggota',
        wa: data.anggota.wa || '',
      });
    }
  }, [data]);

  const labelRoster = useMemo(() => {
    const dariOpsi = new Map((opsiRoster ?? []).map((o) => [o.nilai, o.label]));
    return (kode: string) => dariOpsi.get(kode) ?? KODE_ROSTER[kode] ?? kode;
  }, [opsiRoster]);

  const a = data?.anggota;
  const fotoAnggota = useFotoProfil(a?.foto);
  const telat = data ? data.pica.filter((p) => p.due_date && p.due_date < data.hariIni).length : 0;
  const rosterHariIni = data?.roster.find((r) => r.tanggal === data.hariIni);
  const tautanWa = a?.wa ? `https://wa.me/${nomorWa(a.wa)}?text=${encodeURIComponent(pesan)}` : null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-end sm:items-center justify-center sm:p-4" onClick={(e) => { e.stopPropagation(); onTutup(); }}>
      <div
        className="retro-box !bg-zinc-900 border-emerald-500 w-full sm:max-w-lg max-h-[90vh] overflow-auto custom-scrollbar !p-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wallpaper: skin yang sedang dipakai anggota ini */}
        {(() => {
          const skin = SKINS.find((s) => s.id === data?.profil?.skin_aktif) ?? SKINS[0];
          return (
            <LatarSkin skin={skin} tinggi={128} ukuranMonyet={96} className="-mx-3 -mt-3 mb-3 border-b-4 border-black">
              <span className={`absolute bottom-1.5 right-2 chip-retro bg-black/70 !text-[10px] ${KELANGKAAN[skin.tier].garis} ${KELANGKAAN[skin.tier].teks}`}>{skin.name}</span>
            </LatarSkin>
          );
        })()}
        {/* ---------- Kepala ---------- */}
        <div className="flex items-start gap-2 border-b-4 border-white pb-2 mb-3">
          <div className="w-11 h-11 shrink-0 border-[3px] border-black bg-emerald-500 overflow-hidden flex items-center justify-center shadow-[3px_3px_0_#000]">
            {fotoAnggota
              ? <img src={fotoAnggota} alt="Foto profil" className="w-full h-full object-cover" />
              : <AvatarSkin skin={SKINS.find((s) => s.id === data?.profil?.skin_aktif) ?? SKINS[0]} ukuran={38} className="!border-0" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="judul-layar truncate flex items-center gap-1.5" title={a?.nama ?? nama ?? ''}>
              {namaTampil(a?.nama ?? nama) || 'Anggota'}
              {a?.peran && (
                <span className={`chip-retro !text-[9px] uppercase ${a.peran === 'admin' ? 'border-amber-400 text-amber-300 bg-amber-950/60' : a.peran === 'supervisor' ? 'border-blue-400 text-blue-300 bg-blue-950/60' : 'border-zinc-500 text-zinc-300'}`}>
                  {a.peran === 'supervisor' ? 'SPV' : a.peran}
                </span>
              )}
            </h2>
            <p className="text-[12px] text-zinc-300 mt-0.5 truncate">
              {a?.jabatan ?? '—'}{a?.bidang ? ` · ${a.bidang}` : ''}
            </p>
          </div>
          {bolehKelola && (
            <button
              onClick={() => setEditBuka((v) => !v)}
              className="btn-retro btn-retro-sm bg-zinc-800 text-[11px] shrink-0"
              title="Kelola jabatan & peran"
            >
              <Pencil size={12} /> {editBuka ? 'Tutup' : 'Jabatan'}
            </button>
          )}
          <button onClick={onTutup} className="btn-ikon !w-8 !h-8 bg-zinc-800 shrink-0" aria-label="Tutup"><X size={15} /></button>
        </div>

        {editBuka && bolehKelola && (
          <div className="panel-retro !p-3 border-emerald-500 bg-black/60 flex flex-col gap-2 mb-3">
            <div className="flex justify-between items-center border-b border-white/20 pb-1.5">
              <p className="text-[12px] font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                <Pencil size={12} /> Kelola Jabatan & Peran
              </p>
              <span className="text-[10px] text-zinc-400">Admin & SPV</span>
            </div>
            <div>
              <label className="label-retro">Nama Lengkap</label>
              <input
                value={formAkun.nama}
                onChange={(e) => setFormAkun({ ...formAkun, nama: e.target.value })}
                className="input-retro !text-[12px] !py-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-retro">Jabatan</label>
                <input
                  value={formAkun.jabatan}
                  onChange={(e) => setFormAkun({ ...formAkun, jabatan: e.target.value })}
                  className="input-retro !text-[12px] !py-1"
                  placeholder="mis. Forester, SPV"
                />
              </div>
              <div>
                <label className="label-retro">Peran Sistem</label>
                <select
                  value={formAkun.peran}
                  onChange={(e) => setFormAkun({ ...formAkun, peran: e.target.value })}
                  className="input-retro !text-[12px] !py-1"
                >
                  <option value="admin">Admin</option>
                  <option value="supervisor">Supervisor (SPV)</option>
                  <option value="anggota">Anggota</option>
                  <option value="pemantau">Pemantau</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label-retro">Bidang</label>
                <input
                  value={formAkun.bidang}
                  onChange={(e) => setFormAkun({ ...formAkun, bidang: e.target.value })}
                  className="input-retro !text-[12px] !py-1"
                  placeholder="mis. Revegetasi, Nursery"
                />
              </div>
              <div>
                <label className="label-retro">Nomor WhatsApp</label>
                <input
                  value={formAkun.wa}
                  onChange={(e) => setFormAkun({ ...formAkun, wa: e.target.value })}
                  className="input-retro !text-[12px] !py-1"
                  placeholder="0812..."
                />
              </div>
            </div>
            <button
              disabled={menyimpanAkun}
              onClick={async () => {
                setMenyimpanAkun(true);
                try {
                  await api(`/api/tim/${userId}`, { method: 'PATCH', body: formAkun });
                  setData((d) => d ? { ...d, anggota: { ...d.anggota, ...formAkun } } : null);
                  notify('JABATAN & PERAN DISIMPAN');
                  setEditBuka(false);
                } catch (e) {
                  notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN');
                } finally {
                  setMenyimpanAkun(false);
                }
              }}
              className="btn-retro bg-emerald-600 text-[12px] w-full mt-1 font-bold"
            >
              {menyimpanAkun ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        )}

        {memuat && !data && (
          <p className="text-[13px] text-zinc-400 flex items-center gap-2 py-8 justify-center">
            <Loader2 size={14} className="animate-spin" /> Memuat data anggota…
          </p>
        )}

        {data && (
          <div className="flex flex-col gap-3">
            {/* ---------- Capaian ---------- */}
            <div className="grid grid-cols-3 gap-2">
              <div className="panel-retro !p-2">
                <p className="text-[10px] text-zinc-400 uppercase">Level</p>
                <p className="text-[15px] font-bold text-yellow-300 tabular-nums flex items-center gap-1">
                  <Star size={13} className="fill-yellow-300" />{data.profil?.level ?? 1}
                </p>
                <p className="text-[11px] text-zinc-400 tabular-nums">{(data.profil?.xp ?? 0).toLocaleString('id-ID')} XP</p>
              </div>
              <div className="panel-retro !p-2">
                <p className="text-[10px] text-zinc-400 uppercase">Luas tanam</p>
                <p className="text-[15px] font-bold text-emerald-300 tabular-nums">{(data.profil?.luas_tanam ?? 0).toFixed(2)}</p>
                <p className="text-[11px] text-zinc-400">Ha</p>
              </div>
              <div className="panel-retro !p-2">
                <p className="text-[10px] text-zinc-400 uppercase">Hari ini</p>
                <p className="text-[15px] font-bold text-cyan-300 leading-tight">{rosterHariIni ? labelRoster(rosterHariIni.kode) : '—'}</p>
                <p className="text-[11px] text-zinc-400">{rosterHariIni?.catatan ?? 'roster'}</p>
              </div>
            </div>

            {onTulisPesan && userId !== pengguna.id && (
              <div className="flex gap-2">
                <button onClick={() => { onTulisPesan({ penerima: [userId] }); onTutup(); }} className="btn-retro btn-retro-sm bg-cyan-700 flex-1 flex items-center justify-center gap-1.5"><Mail size={13} /> Kirim pesan</button>
                <button onClick={() => setPilihProgres((v) => !v)} disabled={data.pica.length === 0} className="btn-retro btn-retro-sm bg-amber-600 text-black font-bold flex-1 flex items-center justify-center gap-1.5" title={data.pica.length === 0 ? 'Tidak ada PICA terbuka' : 'Pilih PICA lalu kirim permintaan progres'}><TrendingUp size={13} /> Minta progres</button>
              </div>
            )}
            {pilihProgres && onTulisPesan && (
              <div className="panel-retro !p-2 border-amber-500">
                <p className="text-[11px] text-amber-200 mb-1.5">Pilih PICA — {namaTampil(a?.nama)} menerima surat; saat ia menulis update, progresnya otomatis kembali ke Kotak Surat Anda.</p>
                {data.pica.map((p) => (
                  <button key={p.id} onClick={() => {
                    onTulisPesan({
                      penerima: [userId], jenis: 'minta_progres', subjek: `Minta progres: ${p.judul.slice(0, 80)}`,
                      isi: `Halo ${namaTampil(a?.nama)}, mohon update progres PICA ini${p.due_date ? ` (tenggat ${p.due_date})` : ''}. Terima kasih.`,
                      tautan: { jenis: 'pica', id: p.id, label: p.judul.slice(0, 120) },
                    });
                    onTutup();
                  }} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] hover:bg-white/10 border-b border-white/10 last:border-0">
                    <ClipboardList size={12} className="text-amber-300 shrink-0" /><span className="flex-1 truncate text-zinc-100">{p.judul}</span>
                  </button>
                ))}
              </div>
            )}

            <p className="text-[11px] text-zinc-400 -mt-1">
              Terakhir aktif: {data.profil?.terakhir_aktif ? W.formatWaktuIso(data.profil.terakhir_aktif) + ' WITA' : 'belum pernah'}
            </p>

            {/* ---------- PICA ---------- */}
            <section>
              <p className="label-retro flex items-center gap-1.5">
                <ClipboardList size={12} /> PICA terbuka ({data.pica.length}{telat > 0 ? ` · ${telat} telat` : ''})
              </p>
              <div className="panel-retro !p-2 flex flex-col gap-1.5">
                {data.pica.length === 0 && <p className="text-[12px] text-zinc-400 italic">Tidak ada PICA terbuka.</p>}
                {data.pica.slice(0, 6).map((p) => {
                  const sisa = p.due_date ? W.selisihHari(p.due_date, data.hariIni) : null;
                  const w = warna(sisa !== null && sisa < 0 ? 'red' : sisa !== null && sisa <= 2 ? 'amber' : 'zinc');
                  return (
                    <div key={p.id} className="flex items-start gap-2 text-[12px]">
                      <span className={`px-1.5 py-0.5 border shrink-0 tabular-nums ${w.garis} ${w.teks} ${w.latar}`}>{p.id.slice(-2)}</span>
                      <span className="flex-1 min-w-0 text-zinc-100 leading-snug line-clamp-2">{p.judul}</span>
                      <span className={`shrink-0 tabular-nums ${sisa !== null && sisa < 0 ? 'text-red-300' : 'text-zinc-400'}`}>
                        {sisa === null ? '—' : sisa < 0 ? `telat ${-sisa}h` : `${sisa}h`}
                      </span>
                    </div>
                  );
                })}
                {data.pica.length > 6 && <p className="text-[11px] text-zinc-400">dan {data.pica.length - 6} lainnya</p>}
              </div>
            </section>

            {/* ---------- Roster minggu ini ---------- */}
            {data.roster.length > 0 && (
              <section>
                <p className="label-retro flex items-center gap-1.5"><CalendarRange size={12} /> Roster 7 hari</p>
                <div className="panel-retro !p-2 flex gap-1.5 overflow-x-auto custom-scrollbar">
                  {data.roster.map((r) => (
                    <div key={r.tanggal} className={`shrink-0 text-center px-2 py-1 border-2 ${r.tanggal === data.hariIni ? 'border-white bg-white/10' : 'border-white/20'}`}>
                      <p className="text-[10px] text-zinc-400 uppercase">{W.formatPendek(r.tanggal)}</p>
                      <p className="text-[12px] font-bold text-zinc-100">{r.kode}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ---------- Memo tim ---------- */}
            {data.memo.length > 0 && (
              <section>
                <p className="label-retro flex items-center gap-1.5"><NotebookPen size={12} /> Memo tim terakhir</p>
                <div className="panel-retro !p-2 flex flex-col gap-2">
                  {data.memo.map((m) => (
                    <div key={m.id}>
                      <p className="text-[13px] font-bold text-zinc-100 leading-snug">{m.judul || 'Tanpa judul'}</p>
                      {m.ringkasan && <p className="text-[12px] text-zinc-400 leading-snug line-clamp-2">{m.ringkasan}</p>}
                      <p className="text-[11px] text-zinc-500">{m.kategori ?? '—'}{m.tanggal ? ` · ${W.formatPendek(m.tanggal)}` : ''}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ---------- Laporan terakhir ---------- */}
            <section>
              <p className="label-retro flex items-center gap-1.5"><Backpack size={12} /> Laporan terakhir</p>
              <div className="panel-retro !p-2 flex flex-col gap-1">
                {data.laporan.length === 0 && <p className="text-[12px] text-zinc-400 italic">Belum ada laporan.</p>}
                {data.laporan.map((l) => (
                  <div key={l.id} className="flex items-baseline gap-2 text-[12px]">
                    <span className="text-zinc-400 tabular-nums shrink-0">{W.formatPendek(l.dibuat_pada.slice(0, 10))}</span>
                    <span className="flex-1 min-w-0 text-zinc-100 truncate">{l.jenis ?? 'Laporan'}{l.pica_id ? ` · ${l.pica_id.slice(-2)}` : ''}</span>
                    <span className="text-emerald-300 tabular-nums shrink-0">+{Number(l.capaian ?? 0).toFixed(2)} {l.satuan ?? ''}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ---------- Kontak ---------- */}
            <section>
              <p className="label-retro flex items-center gap-1.5"><Phone size={12} /> Hubungi</p>
              {a?.wa ? (
                <div className="panel-retro !p-2.5 flex flex-col gap-2">
                  <a href={`tel:+${nomorWa(a.wa)}`} className="flex items-center gap-2 text-[14px] text-zinc-100">
                    <span className="w-8 h-8 bg-emerald-600 border-2 border-black flex items-center justify-center shrink-0"><Phone size={15} /></span>
                    <span className="tabular-nums">{waTampil(a.wa)}</span>
                  </a>

                  <div className="border-t border-white/10 pt-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="label-retro !mb-0 mr-auto">Pesan yang akan dibuka</p>
                      <button onClick={() => setSuntingPesan((v) => !v)} className="text-[11px] text-cyan-300 underline">
                        {suntingPesan ? 'Selesai' : 'Sunting'}
                      </button>
                    </div>

                    {suntingPesan ? (
                      <textarea
                        value={pesan}
                        onChange={(e) => setPesan(e.target.value)}
                        className="input-retro !text-[12px] h-32 resize-none leading-relaxed"
                        aria-label="Isi pesan WhatsApp"
                      />
                    ) : (
                      <div className="bg-[#0b141a] border-2 border-black p-2">
                        <p className="bg-[#005c4b] text-[#e9edef] px-2.5 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap max-h-40 overflow-auto custom-scrollbar">
                          {pesan}
                        </p>
                      </div>
                    )}

                    <a
                      href={tautanWa ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => notify('WHATSAPP DIBUKA — TEKAN KIRIM DI SANA')}
                      className="btn-retro bg-emerald-700 w-full mt-2"
                    >
                      <MessageCircle size={14} /> Buka WhatsApp
                    </a>
                    <p className="text-[11px] text-zinc-400 mt-1.5 leading-snug">
                      Pesannya tidak terkirim sendiri. WhatsApp terbuka dengan teks ini, Anda yang menekan kirim.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="panel-retro !p-2.5">
                  <p className="text-[12px] text-zinc-400">
                    Nomor WhatsApp belum diisi. {pengguna.peran === 'admin' ? 'Tambahkan di layar TEAM.' : 'Minta Admin mengisinya di layar TEAM.'}
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};
