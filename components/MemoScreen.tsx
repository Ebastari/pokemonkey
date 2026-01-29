
import React, { useState } from 'react';
import { NotebookPen, X, CheckCircle2, Trash2, CalendarDays, Clock } from 'lucide-react';
import { GameState, WorkPlan } from '../types';
import { MONTH_NAMES } from '../constants';

export const MemoScreen = ({ state, setGameState }: { state: GameState, setGameState: any }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:00");

  const daysInMonth = (month: number) => new Date(2026, month + 1, 0).getDate();
  const startDayOfMonth = (month: number) => new Date(2026, month, 1).getDay();

  const handleAdd = () => {
    if (!description || !selectedDate) return;
    const newPlan: WorkPlan = { 
      id: Date.now().toString(), 
      date: selectedDate, 
      startTime, 
      endTime, 
      description, 
      isDone: false 
    };
    setGameState((p: any) => ({ ...p, memoPlans: [newPlan, ...p.memoPlans] }));
    setDescription("");
    setStartTime("07:00");
    setEndTime("15:00");
    setSelectedDate(null);
  };

  return (
    <div className="p-4 flex flex-col h-full overflow-hidden">
       <h2 className="text-r-md border-b-4 border-white pb-2 mb-4 uppercase flex items-center gap-2">
         <NotebookPen size={20} /> Memo Rencana 2026
       </h2>
       
       <div className="flex-1 overflow-auto space-y-8 pb-10 custom-scrollbar">
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MONTH_NAMES.map((monthName, mIdx) => (
              <div key={monthName} className="retro-box !bg-zinc-900/50 p-2 border-zinc-700">
                 <h3 className="text-[7px] font-bold text-cyan-400 mb-2 uppercase text-center">{monthName}</h3>
                 <div className="grid grid-cols-7 gap-1">
                    {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-[4px] text-zinc-600 text-center font-bold">{d}</div>)}
                    {Array.from({ length: startDayOfMonth(mIdx) }).map((_, i) => <div key={i} />)}
                    {Array.from({ length: daysInMonth(mIdx) }).map((_, dIdx) => {
                      const day = dIdx + 1;
                      const dStr = `2026-${(mIdx + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                      const hasPlan = state.memoPlans.some(p => p.date === dStr);
                      return (
                        <button 
                          key={day} onClick={() => setSelectedDate(dStr)}
                          className={`aspect-square flex items-center justify-center text-[5px] border transition-all ${hasPlan ? 'bg-cyan-600 border-white text-white animate-pulse' : 'bg-black/40 border-white/5 text-zinc-500 hover:border-white'}`}
                        >
                          {day}
                        </button>
                      );
                    })}
                 </div>
              </div>
            ))}
         </div>
       </div>

       {selectedDate && (
         <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="retro-box !bg-zinc-900 w-full max-w-sm border-cyan-500 flex flex-col gap-4 scale-up-center">
               <div className="flex justify-between items-center border-b-2 border-white/20 pb-2">
                  <h3 className="text-r-sm font-bold text-cyan-400 uppercase flex items-center gap-2"><CalendarDays size={16} /> {selectedDate}</h3>
                  <button onClick={() => setSelectedDate(null)} className="text-zinc-500 hover:text-white transition-colors"><X size={24} /></button>
               </div>
               
               <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[6px] text-zinc-500 uppercase flex items-center gap-1">
                        <Clock size={8}/> Mulai
                      </label>
                      <input 
                        type="time" 
                        value={startTime} 
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-black border-2 border-white/20 p-2 text-[10px] text-white outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[6px] text-zinc-500 uppercase flex items-center gap-1">
                        <Clock size={8}/> Selesai
                      </label>
                      <input 
                        type="time" 
                        value={endTime} 
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-black border-2 border-white/20 p-2 text-[10px] text-white outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[6px] text-zinc-500 uppercase">Rencana Aktivitas</label>
                    <textarea 
                      value={description} onChange={e => setDescription(e.target.value)}
                      placeholder="Input rencana kerja..."
                      className="w-full h-20 bg-black border-4 border-white p-3 text-[10px] outline-none text-white focus:border-cyan-500"
                    />
                  </div>

                  <button onClick={handleAdd} className="w-full retro-box !bg-cyan-600 p-4 font-bold text-[10px] uppercase hover:!bg-cyan-500 active:translate-y-1 transition-all">SIMPAN JADWAL</button>
               </div>

               <div className="max-h-40 overflow-auto space-y-2 pr-2 custom-scrollbar">
                  <p className="text-[6px] text-zinc-500 uppercase border-t border-white/10 pt-2">Eksisting Plan:</p>
                  {state.memoPlans.filter(p => p.date === selectedDate).map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-black/50 p-2 border border-white/10">
                       <div className="flex-1 overflow-hidden">
                          <p className={`text-[7px] font-bold truncate ${p.isDone ? 'line-through opacity-40' : 'text-white'}`}>{p.description}</p>
                          <p className="text-[5px] text-cyan-400">{p.startTime} - {p.endTime}</p>
                       </div>
                       <div className="flex gap-1 ml-2">
                          <button onClick={() => setGameState((prev:any) => ({ ...prev, memoPlans: prev.memoPlans.map((pl:any)=>pl.id===p.id?{...pl,isDone:!pl.isDone}:pl)}))} className={`p-1 ${p.isDone ? 'bg-zinc-700' : 'bg-green-600'}`}><CheckCircle2 size={10} /></button>
                          <button onClick={() => setGameState((prev:any) => ({ ...prev, memoPlans: prev.memoPlans.filter((pl:any)=>pl.id!==p.id)}))} className="p-1 bg-red-900"><Trash2 size={10} /></button>
                       </div>
                    </div>
                  ))}
                  {state.memoPlans.filter(p => p.date === selectedDate).length === 0 && <p className="text-[6px] italic opacity-30 text-center">Belum ada rencana.</p>}
               </div>
            </div>
         </div>
       )}
    </div>
  );
};
