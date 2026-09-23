import React, { useState } from 'react';
import { Target, CheckCircle2, Plus, Pencil, Trash2, X } from 'lucide-react';
import { GameState, MissionStatus, MissionType, Mission } from '../types';

/**
 * Quest Journal. Misi kini data di server: Admin bisa menambah, mengubah,
 * menghapus, dan mengatur ulang progresnya dari layar ini.
 */

interface Props {
  state: GameState;
  admin: boolean;
  onStart: (id: string) => void;
  onSimpan: (data: Record<string, unknown>, id?: string) => Promise<void>;
  onHapus: (id: string) => Promise<void>;
}

const TIPE_LABEL: Record<string, string> = { LAND_PREP: 'Penataan lahan', NURSERY: 'Persemaian', PLANTING: 'Penanaman' };
const STATUS_LABEL: Record<string, string> = { AVAILABLE: 'Tersedia', IN_PROGRESS: 'Berjalan', COMPLETED: 'Selesai', LOCKED: 'Terkunci' };

export const MissionsScreen: React.FC<Props> = ({ state, admin, onStart, onSimpan, onHapus }) => {
  const [form, setForm] = useState<null | { awal?: Mission }>(null);

  return (
    <div className="p-3 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 border-b-4 border-white pb-2 mb-3">
        <h2 className="judul-layar flex items-center gap-2 mr-auto"><Target size={16} /> Quest Journal</h2>
        {admin && <button onClick={() => setForm({})} className="btn-retro btn-retro-sm bg-blue-600"><Plus size={12} /> Misi</button>}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar space-y-3 pb-4">
        {state.missions.map((m) => {
          const isPlanting = m.type === MissionType.PLANTING;
          const colorClass = isPlanting ? 'border-green-500 bg-green-950/30' : m.type === MissionType.LAND_PREP ? 'border-orange-500 bg-orange-950/30' : 'border-amber-500 bg-amber-950/20';
          const unit = m.satuan ?? (m.type === MissionType.NURSERY ? 'bibit' : 'Ha');
          const persen = Math.min(100, (m.current / m.target) * 100);
          return (
            <div key={m.id} className={`retro-box !p-3 border-l-8 ${colorClass} ${m.status === MissionStatus.LOCKED ? 'opacity-40 grayscale' : ''}`}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="text-[15px] text-yellow-300 font-bold leading-tight">{m.title}</h4>
                    <span className="chip-retro border-white/30 bg-black/40 text-zinc-200">{TIPE_LABEL[m.type] ?? m.type}</span>
                    <span className={`chip-retro ${m.status === MissionStatus.COMPLETED ? 'border-emerald-400 text-emerald-300 bg-emerald-950/50' : m.status === MissionStatus.IN_PROGRESS ? 'border-cyan-400 text-cyan-300 bg-cyan-950/50' : 'border-zinc-500 text-zinc-300 bg-zinc-900'}`}>{STATUS_LABEL[m.status] ?? m.status}</span>
                  </div>
                  <p className="text-[13px] text-zinc-200 mb-2">{m.description}</p>
                  <div className="flex justify-between text-[12px] uppercase font-bold mb-1">
                    <span className="text-zinc-300">Progres · +{m.rewardXP.toLocaleString('id-ID')} XP</span>
                    <span className="text-white">{m.current.toLocaleString('id-ID', { maximumFractionDigits: 1 })} / {m.target.toLocaleString('id-ID')} {unit}</span>
                  </div>
                  <div className="h-3 bg-black border-2 border-white/30">
                    <div className={`h-full ${m.status === MissionStatus.COMPLETED ? 'bg-emerald-500' : 'bg-yellow-500'}`} style={{ width: `${persen}%` }} />
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  {m.status === MissionStatus.AVAILABLE && <button onClick={() => onStart(m.id)} className="btn-retro btn-retro-sm bg-green-600">Mulai</button>}
                  {m.status === MissionStatus.COMPLETED && <CheckCircle2 size={26} className="text-green-400" />}
                  {admin && (
                    <div className="flex gap-1 mt-1">
                      <button onClick={() => setForm({ awal: m })} className="btn-ikon !w-8 !h-8 bg-zinc-800" title="Ubah"><Pencil size={13} /></button>
                      <button onClick={() => { if (confirm(`Hapus misi "${m.title}"?`)) onHapus(m.id); }} className="btn-ikon !w-8 !h-8 bg-red-900" title="Hapus"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {state.missions.length === 0 && <p className="text-[13px] text-zinc-400 text-center py-10 uppercase">Belum ada misi. Admin bisa menambah lewat tombol + Misi.</p>}
      </div>

      {form && (
        <FormMisi awal={form.awal} onTutup={() => setForm(null)} onSimpan={async (data) => { await onSimpan(data, form.awal?.id); setForm(null); }} />
      )}
    </div>
  );
};

const FormMisi: React.FC<{ awal?: Mission; onTutup: () => void; onSimpan: (d: Record<string, unknown>) => Promise<void> }> = ({ awal, onTutup, onSimpan }) => {
  const [f, setF] = useState({
    judul: awal?.title ?? '',
    tipe: awal?.type ?? MissionType.NURSERY,
    deskripsi: awal?.description ?? '',
    target: String(awal?.target ?? 100),
    satuan: awal?.satuan ?? 'Ha',
    xp: String(awal?.rewardXP ?? 500),
    kapasitas: String(awal?.capacityPerDay ?? 1.66),
    status: awal?.status ?? MissionStatus.AVAILABLE,
    current: String(awal?.current ?? 0),
  });
  const [menyimpan, setMenyimpan] = useState(false);

  const simpan = async () => {
    if (!f.judul.trim()) return;
    setMenyimpan(true);
    const data: Record<string, unknown> = {
      judul: f.judul.trim(), tipe: f.tipe, deskripsi: f.deskripsi.trim() || null,
      target: Number(f.target), satuan: f.satuan, xp: Number(f.xp), kapasitas: Number(f.kapasitas),
    };
    if (awal) { data.status = f.status; data.current = Number(f.current); }
    await onSimpan(data);
    setMenyimpan(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-3" onClick={onTutup}>
      <div className="retro-box !bg-zinc-900 w-full max-w-md border-blue-500 flex flex-col gap-3 max-h-[90vh] overflow-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b-2 border-white/20 pb-2">
          <h3 className="judul-layar text-blue-300">{awal ? 'Ubah misi' : 'Misi baru'}</h3>
          <button onClick={onTutup} className="text-zinc-400 hover:text-white"><X size={20} /></button>
        </div>
        <div><label className="label-retro">Judul</label><input autoFocus value={f.judul} onChange={(e) => setF({ ...f, judul: e.target.value })} className="input-retro" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label-retro">Jenis</label>
            <select value={f.tipe} onChange={(e) => setF({ ...f, tipe: e.target.value as MissionType })} className="input-retro">
              {Object.entries(TIPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div><label className="label-retro">Satuan</label><input value={f.satuan} onChange={(e) => setF({ ...f, satuan: e.target.value })} className="input-retro" placeholder="Ha / bibit" /></div>
        </div>
        <div><label className="label-retro">Deskripsi</label><textarea value={f.deskripsi} onChange={(e) => setF({ ...f, deskripsi: e.target.value })} className="input-retro h-16 resize-none" /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label-retro">Target</label><input type="number" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} className="input-retro" /></div>
          <div><label className="label-retro">XP hadiah</label><input type="number" value={f.xp} onChange={(e) => setF({ ...f, xp: e.target.value })} className="input-retro" /></div>
          <div><label className="label-retro">Kapasitas/hari</label><input type="number" step="0.01" value={f.kapasitas} onChange={(e) => setF({ ...f, kapasitas: e.target.value })} className="input-retro" /></div>
        </div>
        {awal && (
          <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
            <div><label className="label-retro">Status</label>
              <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as MissionStatus })} className="input-retro">
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></div>
            <div><label className="label-retro">Progres saat ini</label><input type="number" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} className="input-retro" /></div>
          </div>
        )}
        <button onClick={simpan} disabled={menyimpan || !f.judul.trim()} className="btn-retro bg-blue-600 w-full">{menyimpan ? 'Menyimpan…' : awal ? 'Simpan perubahan' : 'Tambah misi'}</button>
      </div>
    </div>
  );
};
