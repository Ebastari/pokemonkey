
import React, { useState, useMemo, useEffect } from 'react';
import { Camera, Soup, Hash, Star, Info } from 'lucide-react';
import { GameState, MissionStatus, MissionType } from '../types';

export const ReportsScreen = ({ state, onSubmit }: { state: GameState, onSubmit: (r: any) => void }) => {
  const activeMissions = state.missions.filter(m => m.status === MissionStatus.IN_PROGRESS);
  const [formData, setFormData] = useState({ 
    missionId: '', 
    activityType: 'Pekerjaan Rutin', 
    durationMinutes: 30, 
    achievedUnit: 0, 
    unitType: 'ha' as 'ha' | 'jam' | 'hari' | 'orang' | 'meter' | 'bibit', 
    notes: '', 
    photoData: '' 
  });

  const currentMission = activeMissions.find(m => m.id === formData.missionId);

  // Estimasi XP real-time
  const estimatedXP = useMemo(() => {
    if (!formData.missionId || !formData.achievedUnit) return 0;
    let baseValue = formData.achievedUnit;
    const capPerDay = currentMission?.capacityPerDay || 1.66;
    
    // Konversi sederhana untuk visualisasi XP
    let normalized = baseValue;
    if (formData.unitType === 'jam') normalized = baseValue * (capPerDay / 8);
    if (formData.unitType === 'hari') normalized = baseValue * capPerDay;
    if (formData.unitType === 'meter') normalized = baseValue / 10000;
    
    return 500 + Math.floor(normalized * 10);
  }, [formData.missionId, formData.achievedUnit, formData.unitType, currentMission]);

  return (
    <div className="p-4 flex flex-col h-full overflow-auto custom-scrollbar">
       <h2 className="text-r-md border-b-4 border-white pb-2 mb-6 uppercase flex justify-between items-center">
          Sync Station
          {estimatedXP > 0 && <span className="text-yellow-400 text-[8px] animate-pulse">+ {estimatedXP} XP ESTIMASI</span>}
       </h2>
       
       {activeMissions.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center opacity-40">
            <Info size={48} className="mb-4" />
            <p className="text-r-sm uppercase text-center">Aktifkan Misi di Tab QUEST Dulu!</p>
         </div>
       ) : (
         <div className="grid grid-cols-2 gap-6 pb-20">
           <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[8px] block uppercase font-bold text-cyan-400">1. Pilih Misi Aktif:</label>
                <select 
                  className="w-full bg-black border-4 border-white p-3 text-[8px] outline-none font-bold text-white" 
                  value={formData.missionId} 
                  onChange={e => setFormData({ ...formData, missionId: e.target.value })}
                >
                  <option value="">-- PILIH MISI --</option>
                  {activeMissions.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
                </select>
              </div>

              <div className="space-y-4">
                <label className="text-[8px] block uppercase font-bold text-emerald-400">2. Satuan Capaian:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ha', 'jam', 'hari', 'orang', 'meter', 'bibit'] as const).map(u => (
                    <button 
                      key={u}
                      onClick={() => setFormData({ ...formData, unitType: u })}
                      className={`retro-box !p-2 text-[6px] font-bold uppercase transition-all ${formData.unitType === u ? '!bg-emerald-600 border-white' : '!bg-zinc-800 opacity-50 border-transparent'}`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[8px] block uppercase font-bold text-emerald-400">3. Nilai Capaian (Manual Input):</label>
                <div className="relative">
                  <input 
                    type="number" step="0.01" placeholder={`Input jumlah ${formData.unitType.toUpperCase()}...`}
                    className="w-full bg-black border-4 border-white p-3 text-r-sm outline-none font-bold text-white"
                    value={formData.achievedUnit || ''}
                    onChange={e => setFormData({ ...formData, achievedUnit: parseFloat(e.target.value) || 0 })}
                  />
                  <Hash size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[8px] block uppercase font-bold text-yellow-400">4. Memo / Catatan:</label>
                <textarea 
                  className="w-full bg-black border-4 border-white p-3 text-[10px] h-24 outline-none resize-none font-mono text-white" 
                  placeholder="Ketik detail pekerjaan..."
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <button 
                disabled={!formData.missionId || !formData.achievedUnit} 
                onClick={() => { 
                  onSubmit(formData); 
                  setFormData({ missionId: '', activityType: 'Pekerjaan Rutin', durationMinutes: 30, achievedUnit: 0, unitType: 'ha', notes: '', photoData: '' }); 
                }}
                className={`w-full retro-box p-6 font-bold text-r-sm flex items-center justify-center gap-3 !bg-emerald-700 transition-all ${(!formData.missionId || !formData.achievedUnit) ? 'grayscale opacity-30' : 'active:translate-y-2 shadow-xl hover:!bg-emerald-600'}`}
              >
                <Star size={20} className="animate-spin-slow" /> SYNC DATA & GET XP
              </button>
           </div>
           
           <div className="space-y-4">
              <label className="text-[8px] block uppercase font-bold text-orange-400">Dokumentasi Lapangan:</label>
              <div className="w-full aspect-square border-8 border-white bg-black/50 flex flex-col items-center justify-center relative group cursor-pointer hover:border-emerald-500 transition-colors">
                 {formData.photoData ? (
                   <img src={formData.photoData} className="w-full h-full object-cover" />
                 ) : (
                   <div className="flex flex-col items-center opacity-30 group-hover:opacity-100 transition-opacity">
                      <Camera size={64} className="mb-4" />
                      <p className="text-[8px] uppercase font-bold text-center">KLIK UNTUK<br/>UNGGAH FOTO</p>
                   </div>
                 )}
                 <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e => { const r = new FileReader(); r.onload = (ev) => setFormData({...formData, photoData: ev.target?.result as string}); if(e.target.files?.[0]) r.readAsDataURL(e.target.files[0]); }} />
              </div>
              <div className="retro-box !bg-zinc-900 text-[6px] text-zinc-400 leading-relaxed italic p-3">
                 <p className="text-emerald-400 font-bold underline mb-1">INFO KONVERSI:</p>
                 - Ha: Luas Lahan Aktual<br/>
                 - Jam: Konversi durasi ke kapasitas alat/orang<br/>
                 - Hari: Output harian standar mandor<br/>
                 - Orang: Jumlah tenaga kerja yang dikonversi ke target<br/>
                 - Meter: Output linear (meter lari/m2)
              </div>
           </div>
         </div>
       )}
    </div>
  );
};
