
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  Play, Pause, Heart, HeartOff, User, Edit, Send, Bell, NotebookPen, 
  Trees, Target, Backpack, Calendar as CalendarIcon, Gamepad2, Flame, Volume2, Star, X, Save
} from 'lucide-react';
import { 
  GameState, MissionStatus, MissionType, FieldReport, AppTab, WorkPlan 
} from './types';
import { INITIAL_TOTAL_AREA, INITIAL_MISSIONS } from './constants';

// Import Komponen Baru
import { Habitat } from './components/Habitat';
import { MissionsScreen } from './components/MissionsScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { MemoScreen } from './components/MemoScreen';
import { MonkeyRace } from './MonkeyRace';

const SAVE_KEY = 'pokemonkey_v27_units'; // Versi baru karena ada perubahan skema profil
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
  return Math.max(0, MAX_STAMINA - (elapsedSeconds * STAMINA_DRAIN_PER_SECOND));
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { 
          ...parsed, 
          fullName: parsed.fullName || 'Agung',
          statusText: parsed.statusText || 'Siap Menghijaukan!',
          memoPlans: parsed.memoPlans || [],
          stamina: calculateStaminaHybrid(parsed.lastFeedingTime || 0)
        };
      } catch (e) {
        console.error("Error loading save data:", e);
      }
    }
    return {
      nickname: 'Forester', fullName: 'Agung', jabatan: 'Reclamation Manager', statusText: 'Siap Menghijaukan!', profilePhoto: '',
      currentDay: 1, currentHour: 0, totalArea: INITIAL_TOTAL_AREA,
      clearedArea: 0, plantedArea: 0, seedlingsCount: 0, seedlingsTarget: 100,
      xp: 0, level: 1, missions: INITIAL_MISSIONS, reports: [], memoPlans: [],
      isPaused: true, timeSpeed: 1, monkeyHealth: 100, stamina: 100,
      lastFeedingTime: 0, lives: MAX_LIVES, lastReportDay: 1,
      monkeyPos: { x: 50, y: 50, facing: 'right' }
    };
  });

  const [activeTab, setActiveTab] = useState<AppTab>('habitat');
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [monkeyDialogue, setMonkeyDialogue] = useState<string>("Uu-aa! Ayo hijaukan tempat ini!");
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  // Sync state ke LocalStorage
  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
  }, [gameState]);

  // Stamina Drainer
  useEffect(() => {
    const timer = setInterval(() => {
      setGameState(p => ({ ...p, stamina: calculateStaminaHybrid(p.lastFeedingTime) }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const notify = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3000);
  };

  const handleShareWA = () => {
    const message = `Halo! ${gameState.fullName}, ${gameState.nickname} telah mendapatkan ${gameState.xp.toLocaleString()} XP di POKEMONKEY RPG! Ayo cek progres reklamasi kami! 🌲🐒`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleReportSubmit = (report: Omit<FieldReport, 'id' | 'timestamp' | 'missionTitle'>) => {
    const now = Date.now();
    const mission = gameState.missions.find(m => m.id === report.missionId);
    if (!mission) return;

    let finalValue = report.achievedUnit;
    const capPerDay = mission.capacityPerDay || 1.66;
    
    switch(report.unitType) {
      case 'jam': finalValue = report.achievedUnit * (capPerDay / 8); break;
      case 'hari': finalValue = report.achievedUnit * capPerDay; break;
      case 'orang': finalValue = (report.achievedUnit * capPerDay) / 10; break; 
      case 'meter': finalValue = report.achievedUnit / 10000; break; 
    }

    const xpGained = 500 + Math.floor(finalValue * 10);
    const newReport: FieldReport = { 
      ...report, id: now.toString(), timestamp: now, achievedUnit: finalValue, missionTitle: mission.title 
    };

    setGameState(prev => ({
      ...prev,
      stamina: MAX_STAMINA,
      lastFeedingTime: now,
      lives: Math.min(MAX_LIVES, Math.floor(prev.lives) + 1),
      reports: [newReport, ...prev.reports],
      xp: prev.xp + xpGained,
      level: Math.floor((prev.xp + xpGained) / 1000) + 1,
      clearedArea: mission.type === MissionType.LAND_PREP ? Math.min(prev.totalArea, prev.clearedArea + finalValue) : prev.clearedArea,
      plantedArea: mission.type === MissionType.PLANTING ? Math.min(prev.totalArea, prev.plantedArea + finalValue) : prev.plantedArea,
      missions: prev.missions.map(m => {
        if (m.id === report.missionId) {
          const nextVal = Math.min(m.target, m.current + finalValue);
          return { ...m, current: nextVal, status: nextVal >= m.target ? MissionStatus.COMPLETED : m.status };
        }
        return m;
      })
    }));

    setMonkeyDialogue(`Uu-aa! Sync sukses! +${xpGained} XP didapat!`);
    setActiveTab('habitat');
    notify("SINKRONISASI BERHASIL!");
  };

  const totalAchieved = useMemo(() => gameState.reports.reduce((acc, r) => acc + r.achievedUnit, 0), [gameState.reports]);
  const activePlansCount = useMemo(() => gameState.memoPlans.filter(p => !p.isDone).length, [gameState.memoPlans]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-950 font-retro select-none">
      <header className="retro-box h-24 flex items-center justify-between mx-4 mt-4 z-20">
        <div className="flex gap-4 items-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowProfileEdit(true)}>
          <div className="w-12 h-12 bg-white border-4 border-black overflow-hidden relative group">
            {gameState.profilePhoto ? <img src={gameState.profilePhoto} className="w-full h-full object-cover" /> : <User size={24} className="text-black m-2" />}
            <div className="absolute inset-0 bg-black/40 items-center justify-center hidden group-hover:flex">
              <Edit size={16} className="text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-r-md font-bold mb-1">POKEMONKEY <span className="text-[6px] bg-red-600 px-1 rounded animate-pulse">BETA</span></h1>
            <p className="text-r-xs text-yellow-300 truncate max-w-[150px] uppercase">{gameState.nickname} | {gameState.jabatan}</p>
          </div>
        </div>
        
        <div className="flex gap-6 items-center">
          <div className="flex gap-2 bg-black/60 p-3 border-2 border-white/20">
             {Array.from({ length: MAX_LIVES }).map((_, i) => (
               <div key={i}>{i < Math.floor(gameState.lives) ? <Heart key={i} size={24} className="text-red-500 fill-red-500 shadow-xl" /> : <HeartOff key={i} size={24} className="text-zinc-700" />}</div>
             ))}
          </div>
          
          <div className="retro-box !bg-zinc-900 border-yellow-500 min-w-[120px] flex items-center gap-3 px-4">
             <Star size={20} className="text-yellow-400 fill-yellow-400 animate-pulse" />
             <div className="text-left">
                <p className="text-[6px] text-zinc-500 uppercase">Total XP</p>
                <p className="text-r-sm font-bold text-white tracking-widest">{gameState.xp.toLocaleString()}</p>
             </div>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <button onClick={handleShareWA} className="retro-box !bg-green-600 p-2 text-[6px] font-bold flex gap-2 items-center hover:scale-105 active:translate-y-1">
            <Send size={12} /> SHARE WA
          </button>
          <button onClick={() => setActiveTab('memo')} className="retro-box !bg-zinc-800 p-2 relative hover:scale-105">
            <Bell size={16} />
            {activePlansCount > 0 && <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[8px] w-5 h-5 flex items-center justify-center rounded-full border-2 animate-bounce">{activePlansCount}</span>}
          </button>
          <button onClick={() => setGameState(p => ({ ...p, isPaused: !p.isPaused }))} className="retro-box !bg-yellow-500 p-2 hover:scale-105">
            {gameState.isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex p-4 gap-4 overflow-hidden">
        <aside className="w-24 flex flex-col gap-4">
           <SidebarItem active={activeTab === 'habitat'} icon={<Trees />} label="KEBUN" onClick={() => setActiveTab('habitat')} color="bg-green-600" />
           <SidebarItem active={activeTab === 'missions'} icon={<Target />} label="QUEST" onClick={() => setActiveTab('missions')} color="bg-blue-600" />
           <SidebarItem active={activeTab === 'reports'} icon={<Backpack />} label="FEED" onClick={() => setActiveTab('reports')} color="bg-red-600" />
           <SidebarItem active={activeTab === 'calendar'} icon={<CalendarIcon />} label="LOG" onClick={() => setActiveTab('calendar')} color="bg-purple-600" />
           <SidebarItem active={activeTab === 'game'} icon={<Gamepad2 />} label="GAME" onClick={() => setActiveTab('game')} color="bg-orange-600" />
           <SidebarItem active={activeTab === 'memo'} icon={<NotebookPen />} label="MEMO" onClick={() => setActiveTab('memo')} color="bg-cyan-600" />
        </aside>

        <section className="flex-1 retro-box !bg-black/50 overflow-hidden relative flex flex-col">
          {activeTab === 'habitat' && <Habitat state={gameState} dialogue={monkeyDialogue} onSetDialogue={setMonkeyDialogue} />}
          {activeTab === 'missions' && <MissionsScreen state={gameState} onStart={(id) => setGameState(p => ({ ...p, missions: p.missions.map(m => m.id === id ? { ...m, status: MissionStatus.IN_PROGRESS } : m) }))} />}
          {activeTab === 'reports' && <ReportsScreen state={gameState} onSubmit={handleReportSubmit} />}
          {activeTab === 'calendar' && <CalendarScreen state={gameState} onRead={(r) => { setMonkeyDialogue(`Uu-aa! Laporan ${new Date(r.timestamp).toLocaleDateString()}: ${r.activityType} sebanyak ${r.achievedUnit.toFixed(2)} unit. Semangat!`); setActiveTab('habitat'); }} />}
          {activeTab === 'game' && <MonkeyRace onGainXP={(xp) => setGameState(p => ({ ...p, xp: p.xp + xp, level: Math.floor((p.xp+xp)/1000)+1 }))} />}
          {activeTab === 'memo' && <MemoScreen state={gameState} setGameState={setGameState} />}
        </section>

        <div className="w-64 flex flex-col gap-4">
           <div className="retro-box !bg-red-950/80">
              <h3 className="text-r-xs font-bold text-orange-400 mb-4 flex items-center gap-2 uppercase"><Flame size={12} /> Bio-Stamina</h3>
              <div className="h-6 bg-black border-4 border-white overflow-hidden relative">
                 <div className="h-full stamina-bar-fill transition-all" style={{ width: `${gameState.stamina}%` }}></div>
                 <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mix-blend-difference">{gameState.stamina.toFixed(4)}%</span>
              </div>
           </div>

           <div className="retro-box !bg-black/80 flex-1 overflow-auto flex flex-col">
              <div className="border-b-4 border-emerald-500/30 mb-4 pb-2">
                <h3 className="text-r-sm font-bold text-emerald-400 uppercase leading-none">Feeding Log</h3>
                <div className="flex justify-between items-baseline mt-2">
                   <span className="text-[6px] text-zinc-400 uppercase">Total Capaian:</span>
                   <span className="text-r-sm text-white font-bold">{totalAchieved.toFixed(2)} UNIT</span>
                </div>
              </div>
              <div className="space-y-3 flex-1 overflow-auto custom-scrollbar">
                 {gameState.reports.map(r => (
                   <div key={r.id} onClick={() => { setMonkeyDialogue(`Uu-aa! Detail: ${r.activityType} ${r.achievedUnit.toFixed(2)} unit. ${r.notes}`); setActiveTab('habitat'); }} className="border-b border-white/10 pb-2 cursor-pointer group hover:bg-white/5 p-2 transition-all">
                      <div className="flex justify-between mb-1">
                        <p className="text-[7px] text-yellow-500 font-bold uppercase group-hover:text-yellow-400">{r.activityType}</p>
                        <Volume2 size={8} className="text-zinc-600" />
                      </div>
                      <div className="flex justify-between text-[6px]">
                        <p className="text-zinc-300">+{r.achievedUnit.toFixed(2)} {r.unitType.toUpperCase()}</p>
                        <p className="text-zinc-500">{new Date(r.timestamp).toLocaleDateString()}</p>
                      </div>
                   </div>
                 ))}
                 {gameState.reports.length === 0 && <p className="text-[6px] text-zinc-600 italic text-center mt-10">Belum ada data.</p>}
              </div>
           </div>
        </div>
      </main>

      {/* MODAL EDIT PROFIL */}
      {showProfileEdit && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="retro-box !bg-zinc-900 w-full max-w-md border-yellow-500 p-6 flex flex-col gap-4 scale-up-center">
              <div className="flex justify-between items-center border-b-2 border-white/20 pb-4">
                 <h2 className="text-r-md font-bold text-yellow-400 uppercase flex items-center gap-2"><User /> EDIT PROFILE TRAINER</h2>
                 <button onClick={() => setShowProfileEdit(false)} className="text-zinc-500 hover:text-white"><X /></button>
              </div>

              <div className="space-y-4">
                 <div className="space-y-1">
                    <label className="text-[8px] text-zinc-500 uppercase font-bold">Nama Lengkap:</label>
                    <input 
                      type="text" 
                      value={gameState.fullName}
                      onChange={e => setGameState(p => ({ ...p, fullName: e.target.value }))}
                      className="w-full bg-black border-4 border-white p-3 text-r-sm outline-none text-white focus:border-yellow-500"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[8px] text-zinc-500 uppercase font-bold">Nick Name:</label>
                    <input 
                      type="text" 
                      value={gameState.nickname}
                      onChange={e => setGameState(p => ({ ...p, nickname: e.target.value }))}
                      className="w-full bg-black border-4 border-white p-3 text-r-sm outline-none text-white focus:border-yellow-500"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[8px] text-zinc-500 uppercase font-bold">Jabatan:</label>
                    <input 
                      type="text" 
                      value={gameState.jabatan}
                      onChange={e => setGameState(p => ({ ...p, jabatan: e.target.value }))}
                      className="w-full bg-black border-4 border-white p-3 text-r-sm outline-none text-white focus:border-yellow-500"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[8px] text-zinc-500 uppercase font-bold">Status / Bio:</label>
                    <textarea 
                      value={gameState.statusText}
                      onChange={e => setGameState(p => ({ ...p, statusText: e.target.value }))}
                      className="w-full h-20 bg-black border-4 border-white p-3 text-[10px] outline-none text-white focus:border-yellow-500 resize-none"
                    />
                 </div>
                 
                 <div className="space-y-1">
                    <label className="text-[8px] text-zinc-500 uppercase font-bold">Foto Profil (URL):</label>
                    <input 
                      type="text" 
                      placeholder="Masukkan URL foto..."
                      value={gameState.profilePhoto}
                      onChange={e => setGameState(p => ({ ...p, profilePhoto: e.target.value }))}
                      className="w-full bg-black border-4 border-white p-3 text-[8px] outline-none text-white focus:border-yellow-500"
                    />
                 </div>
              </div>

              <button 
                onClick={() => { setShowProfileEdit(false); notify("PROFIL TERSIMPAN!"); }}
                className="w-full retro-box !bg-yellow-600 p-4 font-bold text-r-sm flex items-center justify-center gap-3 hover:!bg-yellow-500 active:translate-y-1 transition-all"
              >
                <Save size={20} /> SIMPAN PERUBAHAN
              </button>
           </div>
        </div>
      )}

      {showNotification && (
        <div className="fixed inset-x-0 bottom-10 flex justify-center z-50 animate-bounce">
           <div className="retro-box !bg-white text-black text-r-md px-10 py-6 border-black shadow-2xl">&gt; {showNotification}</div>
        </div>
      )}
    </div>
  );
};

const SidebarItem = ({ active, icon, label, onClick, color }: any) => (
  <button onClick={onClick} className={`retro-box !p-2 flex flex-col items-center gap-1 transition-all ${active ? color + ' translate-x-2 scale-105 shadow-xl border-white' : '!bg-gray-800 opacity-60 border-zinc-700 hover:opacity-100'}`}>
    {React.cloneElement(icon, { size: 20 })}
    <span className="text-[6px] font-bold">{label}</span>
  </button>
);

export default App;
