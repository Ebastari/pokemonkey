import React, { useState, useMemo, useRef } from 'react';
import { Camera, Images, Hash, Star, Info, X } from 'lucide-react';
import { GameState, MissionStatus } from '../types';

interface PicaRingkas { id: string; judul: string }

type Satuan = 'ha' | 'jam' | 'hari' | 'orang' | 'meter' | 'bibit';

/** Kecilkan foto ke maksimal 1280 px sisi terpanjang, JPEG 82% — hemat kuota lapangan. */
export async function kompresFoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file); });
  }
  const skala = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * skala);
  canvas.height = Math.round(bitmap.height * skala);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82);
}

export const ReportsScreen = ({ state, picaTerbuka = [], onSubmit }: { state: GameState; picaTerbuka?: PicaRingkas[]; onSubmit: (r: any) => void }) => {
  const activeMissions = state.missions.filter((m) => m.status === MissionStatus.IN_PROGRESS);
  const kosong = { missionId: '', picaId: '', activityType: 'Pekerjaan Rutin', durationMinutes: 30, achievedUnit: 0, unitType: 'ha' as Satuan, notes: '', photoData: '' };
  const [formData, setFormData] = useState(kosong);
  const [memproses, setMemproses] = useState(false);
  const kameraRef = useRef<HTMLInputElement>(null);
  const galeriRef = useRef<HTMLInputElement>(null);

  const currentMission = activeMissions.find((m) => m.id === formData.missionId);

  const estimatedXP = useMemo(() => {
    if (!formData.achievedUnit) return 0;
    const capPerDay = currentMission?.capacityPerDay || 1.66;
    let normalized = formData.achievedUnit;
    if (formData.unitType === 'jam') normalized = formData.achievedUnit * (capPerDay / 8);
    if (formData.unitType === 'hari') normalized = formData.achievedUnit * capPerDay;
    if (formData.unitType === 'meter') normalized = formData.achievedUnit / 10000;
    return 500 + Math.floor(normalized * 10);
  }, [formData.missionId, formData.achievedUnit, formData.unitType, currentMission]);

  const terimaFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setMemproses(true);
    try { setFormData((d) => ({ ...d, photoData: '' })); const data = await kompresFoto(f); setFormData((d) => ({ ...d, photoData: data })); }
    finally { setMemproses(false); }
  };

  // Perlu capaian, satu tujuan (PICA, misi, atau jenis pekerjaan), dan foto dokumentasi sebagai bukti.
  const isiLengkap = Boolean(formData.achievedUnit && (formData.picaId || formData.missionId || formData.activityType.trim()));
  const adaFoto = Boolean(formData.photoData);
  const siap = isiLengkap && adaFoto;

  return (
    <div className="p-3 flex flex-col h-full overflow-auto custom-scrollbar">
      <div className="flex items-center justify-between border-b-4 border-white pb-2 mb-3">
        <h2 className="judul-layar">Sync Station</h2>
        {estimatedXP > 0 && <span className="chip-retro !text-[12px] border-yellow-400 bg-yellow-950/60 text-yellow-300 animate-pulse">+{estimatedXP} XP</span>}
      </div>

      {(
        <div className="grid md:grid-cols-2 gap-4 pb-6">
          <div className="space-y-4 order-2 md:order-1">
            <div>
              <label htmlFor="lap-pica" className="label-retro text-amber-300">1. PICA yang dikerjakan</label>
              <select id="lap-pica" className="input-retro" value={formData.picaId} onChange={(e) => setFormData({ ...formData, picaId: e.target.value })}>
                <option value="">— pekerjaan rutin, tanpa PICA —</option>
                {picaTerbuka.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.judul.slice(0, 50)}</option>)}
              </select>
              <p className="text-[11px] text-zinc-400 mt-1 flex items-start gap-1.5">
                <Info size={12} className="shrink-0 mt-0.5" />
                Capaian menambah realisasi PICA itu dan tercatat sebagai perkembangan, lengkap dengan nama Anda.
              </p>
            </div>

            <div>
              <label htmlFor="lap-jenis" className="label-retro text-cyan-300">2. Jenis pekerjaan</label>
              <input
                id="lap-jenis" list="lap-jenis-umum" className="input-retro"
                value={formData.activityType}
                onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                placeholder="mis. Tabur LCC"
              />
              <datalist id="lap-jenis-umum">
                {['Pekerjaan Rutin', 'Penanaman', 'Penyulaman', 'Tabur LCC', 'Pemeliharaan', 'Penyiraman', 'Pengisian polybag', 'Penyemaian', 'Patroli'].map((j) => <option key={j} value={j} />)}
              </datalist>
            </div>

            {activeMissions.length > 0 && (
              <div>
                <label htmlFor="lap-misi" className="label-retro text-blue-300">3. Misi QUEST (opsional)</label>
                <select id="lap-misi" className="input-retro" value={formData.missionId} onChange={(e) => setFormData({ ...formData, missionId: e.target.value })}>
                  <option value="">— tidak ikut misi —</option>
                  {activeMissions.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="label-retro text-emerald-300">4. Satuan</label>
              <div className="grid grid-cols-3 gap-2">
                {(['ha', 'jam', 'hari', 'orang', 'meter', 'bibit'] as const).map((u) => (
                  <button key={u} onClick={() => setFormData({ ...formData, unitType: u })} className={`btn-retro btn-retro-sm ${formData.unitType === u ? 'bg-emerald-600' : 'bg-zinc-800 opacity-70'}`}>{u}</button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="lap-nilai" className="label-retro text-emerald-300">5. Nilai capaian</label>
              <div className="relative">
                <input id="lap-nilai" type="number" inputMode="decimal" step="0.01" placeholder={`Jumlah ${formData.unitType}`} className="input-retro pr-9 text-[16px]" value={formData.achievedUnit || ''} onChange={(e) => setFormData({ ...formData, achievedUnit: parseFloat(e.target.value) || 0 })} />
                <Hash size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              </div>
            </div>

            <div>
              <label className="label-retro text-yellow-300">6. Catatan</label>
              <textarea className="input-retro h-20 resize-none" placeholder="Detail pekerjaan, lokasi, kendala…" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>

            <button disabled={!siap || memproses} onClick={() => { onSubmit(formData); setFormData(kosong); }} className={`btn-retro w-full !py-3 ${siap ? 'bg-emerald-700' : 'bg-zinc-800'}`}>
              <Star size={16} /> Kirim laporan &amp; ambil XP
            </button>
            {!adaFoto && (
              <p className="text-[12px] text-orange-300 flex items-start gap-1.5" role="status">
                <Camera size={13} className="shrink-0 mt-0.5" />
                Foto dokumentasi wajib. Ambil lewat <b className="text-white">Kamera</b> atau <b className="text-white">Galeri</b> dulu, baru laporan bisa dikirim.
              </p>
            )}
          </div>

          <div className="space-y-3 order-1 md:order-2">
            <label className="label-retro text-orange-300">Dokumentasi lapangan <span className="text-red-400">· wajib</span></label>
            <div className={`w-full aspect-[4/3] border-4 bg-black/60 flex items-center justify-center relative overflow-hidden ${adaFoto ? 'border-white' : 'border-dashed border-orange-400'}`}>
              {formData.photoData ? (
                <>
                  <img src={formData.photoData} className="w-full h-full object-cover" alt="dokumentasi" />
                  <button onClick={() => setFormData({ ...formData, photoData: '' })} className="absolute top-2 right-2 btn-ikon !w-8 !h-8 bg-red-900"><X size={14} /></button>
                </>
              ) : (
                <div className="text-center opacity-60"><Camera size={48} className="mx-auto mb-2" /><p className="text-[12px] uppercase">{memproses ? 'Memproses foto…' : 'Belum ada foto · wajib sebelum kirim'}</p></div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => kameraRef.current?.click()} className="btn-retro bg-orange-600"><Camera size={16} /> Kamera</button>
              <button onClick={() => galeriRef.current?.click()} className="btn-retro bg-zinc-700"><Images size={16} /> Galeri</button>
            </div>
            <input ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={terimaFoto} />
            <input ref={galeriRef} type="file" accept="image/*" className="hidden" onChange={terimaFoto} />
            <div className="panel-retro text-[12px] text-zinc-300 leading-relaxed">
              <p className="text-emerald-300 font-bold mb-1">Konversi satuan</p>
              Ha: luas aktual · Jam: durasi → kapasitas alat/orang · Hari: output harian standar · Orang: tenaga kerja → target · Meter: meter lari/m². Foto dikecilkan otomatis ke 1280 px agar hemat kuota.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
