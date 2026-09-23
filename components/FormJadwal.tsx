import React, { useState } from 'react';
import { X, CalendarRange } from 'lucide-react';
import { api, GalatApi } from '../lib/api';
import type { JadwalItem, Pengguna } from '../lib/tipe-api';
import * as W from '../lib/waktu';

/**
 * Buat atau ubah jadwal. Mendukung jadwal beberapa hari (mis. pelatihan
 * Senin–Jumat) dengan pintasan durasi, jadwal berjam, dan pengulangan.
 */

interface Props {
  awal: { tanggal: string; jam?: string } | JadwalItem;
  pengguna: Pengguna | null;
  onTutup: () => void;
  onSimpan: (pesan: string) => void;
}

const adalahJadwal = (x: Props['awal']): x is JadwalItem => 'id' in x;

export const FormJadwal: React.FC<Props> = ({ awal, pengguna, onTutup, onSimpan }) => {
  const ubah = adalahJadwal(awal) ? awal : null;
  const kelola = pengguna?.peran === 'admin' || pengguna?.peran === 'supervisor';
  const jamAwal = ubah?.jam_mulai ?? (!ubah && 'jam' in awal && awal.jam ? awal.jam : '07:00');

  const [f, setF] = useState({
    judul: ubah?.judul ?? '',
    keterangan: ubah?.keterangan ?? '',
    jenis: (ubah?.jenis === 'rapat' ? 'rapat' : 'rencana') as 'rencana' | 'rapat',
    tanggal: awal.tanggal,
    multi: Boolean(ubah?.tanggal_selesai),
    tanggal_selesai: ubah?.tanggal_selesai ?? W.geserHari(awal.tanggal, 4),
    sepanjang_hari: ubah ? ubah.jam_mulai === null : false,
    jam_mulai: jamAwal,
    jam_selesai: ubah?.jam_selesai ?? W.jamDariMenit((W.menitDariJam(jamAwal) ?? 420) + 60),
    ulang: (ubah?.rrule ? (/DAILY/i.test(ubah.rrule) ? 'harian' : 'mingguan') : 'tidak') as 'tidak' | 'harian' | 'mingguan',
    untuk_semua: ubah ? !ubah.pemilik_id : kelola,
    ingatkan: String(ubah?.ingatkan_menit ?? ''),
  });
  const [menyimpan, setMenyimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const durasi = f.multi ? W.selisihHari(f.tanggal_selesai, f.tanggal) + 1 : 1;

  /** Pintasan: sampai Jumat minggu ini, 5 hari kerja, 1 minggu penuh. */
  const pintasan: { label: string; sampai: string }[] = [
    { label: 's/d Jumat', sampai: W.geserHari(W.awalMinggu(f.tanggal), 4) },
    { label: '3 hari', sampai: W.geserHari(f.tanggal, 2) },
    { label: '5 hari', sampai: W.geserHari(f.tanggal, 4) },
    { label: '1 minggu', sampai: W.geserHari(f.tanggal, 6) },
  ].filter((p) => p.sampai > f.tanggal);

  const simpan = async () => {
    if (!f.judul.trim()) { setGalat('Judul wajib diisi.'); return; }
    if (f.multi && f.tanggal_selesai < f.tanggal) { setGalat('Tanggal selesai tidak boleh sebelum tanggal mulai.'); return; }
    setMenyimpan(true); setGalat(null);
    const body = {
      judul: f.judul.trim(),
      keterangan: f.keterangan.trim() || null,
      tanggal: f.tanggal,
      tanggal_selesai: f.multi ? f.tanggal_selesai : null,
      jam_mulai: f.sepanjang_hari ? null : f.jam_mulai,
      jam_selesai: f.sepanjang_hari ? null : f.jam_selesai,
      jenis: f.jenis,
      untuk_semua: f.untuk_semua,
      rrule: f.ulang === 'mingguan' ? 'FREQ=WEEKLY' : f.ulang === 'harian' ? 'FREQ=DAILY' : null,
      ingatkan_menit: f.ingatkan ? Number(f.ingatkan) : null,
    };
    try {
      if (ubah) await api(`/api/jadwal/${ubah.id}`, { method: 'PATCH', body });
      else await api('/api/jadwal', { body });
      onSimpan(ubah ? 'JADWAL DIPERBARUI' : 'JADWAL DISIMPAN');
    } catch (e) {
      setGalat(e instanceof GalatApi ? e.message : 'Gagal menyimpan.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-sm flex items-end md:items-center justify-center md:p-3" onClick={onTutup}>
      <div className="retro-box !bg-zinc-900 w-full md:max-w-md border-cyan-500 flex flex-col gap-3 max-h-[92vh] overflow-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b-2 border-white/20 pb-2">
          <h3 className="judul-layar text-cyan-300">{ubah ? 'Ubah jadwal' : 'Jadwal baru'}</h3>
          <button onClick={onTutup} className="text-zinc-400 hover:text-white"><X size={20} /></button>
        </div>
        {galat && <p className="text-[12px] text-red-200 bg-red-950/50 border border-red-500 p-2">{galat}</p>}

        <div><label className="label-retro">Judul</label><input autoFocus value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} className="input-retro" placeholder="Pelatihan K3 tim lapangan" /></div>

        <div className="grid grid-cols-2 gap-2">
          {(['rencana', 'rapat'] as const).map((j) => (
            <button key={j} onClick={() => setF({ ...f, jenis: j })} className={`btn-retro btn-retro-sm ${f.jenis === j ? (j === 'rapat' ? 'bg-indigo-600' : 'bg-cyan-600') : 'bg-zinc-800 opacity-70'}`}>{j === 'rapat' ? 'Rapat' : 'Rencana kerja'}</button>
          ))}
        </div>

        <div className={`grid gap-3 ${f.multi ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <div><label className="label-retro">{f.multi ? 'Mulai' : 'Tanggal'}</label><input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value, tanggal_selesai: f.tanggal_selesai < e.target.value ? e.target.value : f.tanggal_selesai })} className="input-retro" /></div>
          {f.multi && <div><label className="label-retro">Sampai</label><input type="date" min={f.tanggal} value={f.tanggal_selesai} onChange={(e) => setF({ ...f, tanggal_selesai: e.target.value })} className="input-retro" /></div>}
        </div>

        <label className="flex items-center gap-2 text-[13px] text-zinc-200 cursor-pointer">
          <input type="checkbox" checked={f.multi} onChange={(e) => setF({ ...f, multi: e.target.checked, sepanjang_hari: e.target.checked ? true : f.sepanjang_hari })} />
          <CalendarRange size={14} className="text-cyan-300" /> Berlangsung beberapa hari
          {f.multi && <span className="ml-auto chip-retro border-cyan-400 text-cyan-200 bg-cyan-950/50">{durasi} hari</span>}
        </label>
        {f.multi && (
          <div className="flex flex-wrap gap-1.5 -mt-1">
            {pintasan.map((p) => <button key={p.label} onClick={() => setF({ ...f, tanggal_selesai: p.sampai })} className={`btn-retro btn-retro-sm ${f.tanggal_selesai === p.sampai ? 'bg-cyan-700' : 'bg-zinc-800'}`}>{p.label}</button>)}
          </div>
        )}

        <label className="flex items-center gap-2 text-[13px] text-zinc-200 cursor-pointer">
          <input type="checkbox" checked={f.sepanjang_hari} onChange={(e) => setF({ ...f, sepanjang_hari: e.target.checked })} /> Sepanjang hari
        </label>
        {!f.sepanjang_hari && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-retro">Jam mulai (WITA)</label><input type="time" value={f.jam_mulai} onChange={(e) => setF({ ...f, jam_mulai: e.target.value })} className="input-retro" /></div>
            <div><label className="label-retro">Jam selesai</label><input type="time" value={f.jam_selesai} onChange={(e) => setF({ ...f, jam_selesai: e.target.value })} className="input-retro" /></div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div><label htmlFor="jdw-ulang" className="label-retro">Ulangi</label>
            <select id="jdw-ulang" value={f.ulang} onChange={(e) => setF({ ...f, ulang: e.target.value as typeof f.ulang })} className="input-retro">
              <option value="tidak">Tidak diulang</option>
              <option value="mingguan">Tiap minggu, hari yang sama</option>
              <option value="harian">Tiap hari</option>
            </select>
          </div>
          <div><label htmlFor="jdw-ingatkan" className="label-retro">Pengingat</label>
            <select id="jdw-ingatkan" value={f.ingatkan} onChange={(e) => setF({ ...f, ingatkan: e.target.value })} className="input-retro">
              <option value="">Tidak diingatkan</option>
              <option value="5">5 menit sebelum</option>
              <option value="10">10 menit sebelum</option>
              <option value="15">15 menit sebelum</option>
              <option value="30">30 menit sebelum</option>
              <option value="60">1 jam sebelum</option>
              <option value="120">2 jam sebelum</option>
              <option value="1440">1 hari sebelum</option>
            </select>
            <p className="text-[11px] text-zinc-400 mt-1">
              {f.sepanjang_hari ? 'Acara tanpa jam dihitung dari pukul 07.00 WITA.' : 'Berbunyi di HP yang sudah mengizinkan notifikasi.'}
            </p>
          </div>
        </div>

        {kelola && (
          <label className="flex items-center gap-2 text-[13px] text-zinc-200 cursor-pointer"><input type="checkbox" checked={f.untuk_semua} onChange={(e) => setF({ ...f, untuk_semua: e.target.checked })} /> Untuk seluruh tim</label>
        )}

        <div><label className="label-retro">Keterangan</label><textarea value={f.keterangan} onChange={(e) => setF({ ...f, keterangan: e.target.value })} className="input-retro h-16 resize-none" placeholder="Lokasi, agenda, peserta…" /></div>

        <button onClick={simpan} disabled={menyimpan} className="btn-retro bg-cyan-600 w-full">{menyimpan ? 'Menyimpan…' : ubah ? 'Simpan perubahan' : 'Simpan jadwal'}</button>
      </div>
    </div>
  );
};
