
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Play, Pause, Heart, HeartOff, User, Edit, Trees, Target, Backpack, 
  Calendar as CalendarIcon, Gamepad2, Flame, Volume2, Star, X, Save, 
  ExternalLink, Wifi, WifiOff, Users, ShoppingBag, LogOut, NotebookPen
} from 'lucide-react';
import { 
  GameState, MissionStatus, MissionType, FieldReport, AppTab, WorkPlan 
} from './types';
import { INITIAL_TOTAL_AREA, INITIAL_MISSIONS, SKINS } from './constants';

// Components
import { Habitat } from './components/Habitat';
import { MissionsScreen } from './components/MissionsScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { CalendarScreen } from './components/CalendarScreen';
import { MemoScreen } from './components/MemoScreen';
import { TeamScreen } from './components/TeamScreen';
import { MarketScreen } from './components/MarketScreen';
import { AuthScreen } from './components/AuthScreen';
import { MonkeyRace } from './MonkeyRace';

const SAVE_KEY = 'pokemonkey_cloud_v3_secure'; 
const MAX_LIVES = 5;
const MAX_STAMINA = 100;
const DRAIN_DURATION_HOURS = 18; 
const STAMINA_DRAIN_PER_SECOND = MAX_STAMINA / (DRAIN_DURATION_HOURS * 3600);
const WORK_START_HOUR = 7;
const DEFAULT_CLOUD_URL = 'https://script.google.com/macros/s/AKfycbwqtwhUkmK7x-llaDZJr4eAZoDs-NrUXY54LQo27UKkjtCmPXMwposyHR1djKQ7AlI/exec'; 

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
          stamina: calculateStaminaHybrid(parsed.lastFeedingTime || 0),
          isLoggedIn: parsed.isLoggedIn || false,
          isOnline: !!(parsed.cloudUrl || DEFAULT_CLOUD_URL),
          cloudUrl: parsed.cloudUrl || DEFAULT_CLOUD_URL
        };
      } catch (e) { console.error("Load error:", e); }
    }
    return {
      userId: '', nickname: '', fullName: '', jabatan: 'Forester', statusText: 'Siap Menghijaukan!', profilePhoto: '',
      currentDay: 1, currentHour: 0, totalArea: INITIAL_TOTAL_AREA,
      clearedArea: 0, plantedArea: 0, seedlingsCount: 0, seedlingsTarget: 100,
      xp: 0, level: 1, missions: INITIAL_MISSIONS, reports: [], memoPlans: [],
      isPaused: true, timeSpeed: 1, monkeyHealth: 100, stamina: 100,
      lastFeedingTime: 0, lives: MAX_LIVES, lastReportDay: 1,
      monkeyPos: { x: Math.random()*80+10, y: Math.random()*70+15, facing: 'right' },
      cloudUrl: DEFAULT_CLOUD_URL, isOnline: !!DEFAULT_CLOUD_URL,
      ownedSkins: ['classic'], activeSkinId: 'classic', isLoggedIn: false
    };
  });

  const [activeTab, setActiveTab] = useState<AppTab>('habitat');
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [monkeyDialogue, setMonkeyDialogue] = useState<string>("Uu-aa! Ayo hijaukan tempat ini!");
  const [syncing, setSyncing] = useState(false);

  // Global Collaborative Missions State
  const fetchGlobalMissions = useCallback(async () => {
    if (!gameState.cloudUrl || !gameState.isLoggedIn) return;
    try {
      const res = await fetch(`${gameState.cloudUrl}?action=getGlobalMissions`);
      if (!res.ok) throw new Error("Missions fetch failed");
      const cloudMissions = await res.json();
      
      if (cloudMissions && typeof cloudMissions === 'object') {
        setGameState(prev => ({
          ...prev,
          missions: prev.missions.map(m => {
            const remote = cloudMissions[m.id];
            if (remote) {
              return { ...m, status: remote.status as MissionStatus, current: Number(remote.current) };
            }
            return m;
          })
        }));
      }
    } catch (e) {
      console.warn("Global mission sync failed:", e);
    }
  }, [gameState.cloudUrl, gameState.isLoggedIn]);

  useEffect(() => {
    if (gameState.isLoggedIn) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(gameState));
    }
  }, [gameState]);

  // Periodic Global Sync
  useEffect(() => {
    if (!gameState.isLoggedIn) return;
    
    fetchGlobalMissions();
    const timer = setInterval(() => {
      const newStamina = calculateStaminaHybrid(gameState.lastFeedingTime);
      setGameState(p => ({ ...p, stamina: newStamina }));
      
      // Auto-Sync Heartbeat and Missions
      if (gameState.cloudUrl) {
         syncProgressToCloud({ stamina: newStamina });
         fetchGlobalMissions();
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [gameState.isLoggedIn, gameState.cloudUrl, gameState.lastFeedingTime, fetchGlobalMissions]);

  const notify = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3000);
  };

  const syncProgressToCloud = async (overrideState?: Partial<GameState>) => {
    const targetState = { ...gameState, ...overrideState };
    if (!targetState.cloudUrl || !targetState.userId) return;
    
    setSyncing(true);
    try {
      await fetch(targetState.cloudUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          action: 'updateProgress',
          userId: targetState.userId,
          xp: targetState.xp,
          level: targetState.level,
          plantedArea: targetState.plantedArea,
          ownedSkins: targetState.ownedSkins,
          activeSkinId: targetState.activeSkinId,
          memoPlans: targetState.memoPlans,
          stamina: targetState.stamina,
          posX: targetState.monkeyPos.x,
          posY: targetState.monkeyPos.y
        })
      });
      setGameState(p => ({ ...p, isOnline: true }));
    } catch (e) {
      setGameState(p => ({ ...p, isOnline: false }));
    } finally {
      setSyncing(false);
    }
  };

  const handleAuthSuccess = (userData: any, usedCloudUrl: string) => {
    setGameState(prev => ({
      ...prev,
      userId: userData.userId,
      fullName: userData.fullName,
      nickname: userData.fullName.split(' ')[0],
      xp: Number(userData.xp) || 0,
      level: Number(userData.level) || 1,
      plantedArea: Number(userData.plantedArea) || 0,
      ownedSkins: Array.isArray(userData.ownedSkins) ? userData.ownedSkins : ['classic'],
      activeSkinId: userData.activeSkinId || 'classic',
      memoPlans: Array.isArray(userData.memoPlans) ? userData.memoPlans : [],
      cloudUrl: usedCloudUrl,
      isLoggedIn: true,
      isOnline: !!usedCloudUrl
    }));
    notify(`WELCOME BACK, ${userData.fullName.toUpperCase()}!`);
    setTimeout(fetchGlobalMissions, 500);
  };

  const handleLogout = () => {
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  };

  const handleBuySkin = async (skinId: string) => {
    const skin = SKINS.find(s => s.id === skinId);
    if (!skin) return;
    if (gameState.xp < skin.cost) {
      notify("XP TIDAK CUKUP!");
      return;
    }
    const newState = {
      ...gameState,
      xp: gameState.xp - skin.cost,
      ownedSkins: [...gameState.ownedSkins, skinId],
      activeSkinId: skinId
    };
    setGameState(newState);
    await syncProgressToCloud(newState);
    notify(`${skin.name.toUpperCase()} DIBELI!`);
  };

  const handleEquipSkin = async (skinId: string) => {
    const newState = { ...gameState, activeSkinId: skinId };
    setGameState(newState);
    await syncProgressToCloud(newState);
    notify("SKIN DIPASANG!");
  };

  const handleMissionStart = async (missionId: string) => {
    setGameState(prev => ({
      ...prev,
      missions: prev.missions.map(m => m.id === missionId ? { ...m, status: MissionStatus.IN_PROGRESS } : m)
    }));

    if (gameState.cloudUrl) {
      setSyncing(true);
      try {
        await fetch(gameState.cloudUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'updateMissionStatus',
            missionId: missionId,
            status: MissionStatus.IN_PROGRESS
          })
        });
      } finally {
        setSyncing(false);
      }
    }
  };

  const handleReportSubmit = async (report: Omit<FieldReport, 'id' | 'timestamp' | 'missionTitle'>) => {
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
      ...report, id: now.toString(), timestamp: now, achievedUnit: finalValue, missionTitle: mission.title, userId: gameState.userId, userName: gameState.fullName
    };

    const nextMissionValue = Math.min(mission.target, mission.current + finalValue);
    const nextStatus = nextMissionValue >= mission.target ? MissionStatus.COMPLETED : mission.status;

    const newState = {
      ...gameState,
      stamina: MAX_STAMINA,
      lastFeedingTime: now,
      lives: Math.min(MAX_LIVES, Math.floor(gameState.lives) + 1),
      reports: [newReport, ...gameState.reports],
      xp: gameState.xp + xpGained,
      level: Math.floor((gameState.xp + xpGained) / 1000) + 1,
      clearedArea: mission.type === MissionType.LAND_PREP ? Math.min(gameState.totalArea, gameState.clearedArea + finalValue) : gameState.clearedArea,
      plantedArea: mission.type === MissionType.PLANTING ? Math.min(gameState.totalArea, gameState.plantedArea + finalValue) : gameState.plantedArea,
      missions: gameState.missions.map(m => {
        if (m.id === report.missionId) {
          return { ...m, current: nextMissionValue, status: nextStatus };
        }
        return m;
      })
    };

    setGameState(newState);
    
    if (gameState.cloudUrl) {
      setSyncing(true);
      try {
        await fetch(gameState.cloudUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'addReport',
            userId: gameState.userId,
            fullName: gameState.fullName,
            activityType: newReport.activityType,
            achievedUnit: newReport.achievedUnit,
            notes: newReport.notes,
            xpGained: xpGained,
            xp: newState.xp,
            level: newState.level,
            plantedArea: newState.plantedArea,
            ownedSkins: newState.ownedSkins,
            activeSkinId: newState.activeSkinId,
            memoPlans: newState.memoPlans,
            photoData: report.photoData,
            stamina: MAX_STAMINA,
            missionId: report.missionId,
            missionCurrent: nextMissionValue,
            missionStatus: nextStatus
          })
        });
        setTimeout(fetchGlobalMissions, 1500);
      } finally {
        setSyncing(false);
      }
    }

    setMonkeyDialogue(`Uu-aa! Sync sukses! +${xpGained} XP didapat!`);
    setActiveTab('habitat');
  };

  const totalAchieved = useMemo(() => gameState.reports.reduce((acc, r) => acc + r.achievedUnit, 0), [gameState.reports]);

  if (!gameState.isLoggedIn) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} cloudUrl={gameState.cloudUrl} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-zinc-950 font-retro select-none">
      <header className="retro-box h-auto py-2 md:h-24 flex flex-col md:flex-row items-center justify-between mx-2 md:mx-4 mt-2 md:mt-4 z-20 gap-2 md:gap-0 relative">
        {syncing && <div className="absolute inset-0 bg-blue-500/20 animate-pulse z-[-1]" />}
        
        <div className="flex gap-4 items-center w-full md:w-auto px-2">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-white border-4 border-black overflow-hidden relative shrink-0">
             <User size={20} className="text-black m-2" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-[8px] md:text-r-md font-bold mb-1 flex items-center gap-2">
              POKEMONKEY 
              <span className={`text-[5px] px-1 rounded flex items-center gap-1 ${gameState.isOnline ? 'bg-blue-600' : 'bg-red-600'}`}>
                {gameState.isOnline ? <Wifi size={6} /> : <WifiOff size={6} />}
                {gameState.isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </h1>
            <p className="text-[6px] md:text-r-xs text-yellow-300 truncate max-w-[120px] md:max-w-[150px] uppercase">ID: {gameState.userId} | {gameState.nickname}</p>
          </div>
        </div>
        
        <div className="flex gap-2 md:gap-6 items-center justify-center">
          <div className="flex gap-1 md:gap-2 bg-black/60 p-1 md:p-3 border-2 border-white/20">
             {Array.from({ length: MAX_LIVES }).map((_, i) => (
               <div key={i}>{i < Math.floor(gameState.lives) ? <Heart key={i} size={16} className="md:size-6 text-red-500 fill-red-500" /> : <HeartOff key={i} size={16} className="md:size-6 text-zinc-700" />}</div>
             ))}
          </div>
          
          <div className="retro-box !bg-zinc-900 border-yellow-500 min-w-[80px] md:min-w-[120px] flex items-center gap-1 md:gap-3 px-2 md:px-4 !py-1 md:!py-3">
             <Star size={14} className="md:size-5 text-yellow-400 fill-yellow-400 animate-pulse" />
             <div className="text-left">
                <p className="text-[4px] md:text-[6px] text-zinc-500 uppercase">XP</p>
                <p className="text-[8px] md:text-r-sm font-bold text-white tracking-widest">{gameState.xp.toLocaleString()}</p>
             </div>
          </div>
        </div>

        <div className="flex gap-2 items-center w-full md:w-auto justify-center md:justify-end px-2">
          <button onClick={handleLogout} className="retro-box !bg-red-900 p-2 hover:scale-105 transition-transform" title="Logout">
            <LogOut size={14} />
          </button>
          <button onClick={() => setGameState(p => ({ ...p, isPaused: !p.isPaused }))} className="retro-box !bg-yellow-500 p-2 hover:scale-105 transition-transform">
            {gameState.isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-2 md:p-4 gap-2 md:gap-4 overflow-hidden relative">
        <aside className="hidden md:flex w-24 flex-col gap-4">
           <SidebarItem active={activeTab === 'habitat'} icon={<Trees />} label="KEBUN" onClick={() => setActiveTab('habitat')} color="bg-green-600" />
           <SidebarItem active={activeTab === 'team'} icon={<Users />} label="TEAM" onClick={() => setActiveTab('team')} color="bg-indigo-600" />
           <SidebarItem active={activeTab === 'market'} icon={<ShoppingBag />} label="SHOP" onClick={() => setActiveTab('market')} color="bg-yellow-600" />
           <SidebarItem active={activeTab === 'missions'} icon={<Target />} label="QUEST" onClick={() => setActiveTab('missions')} color="bg-blue-600" />
           <SidebarItem active={activeTab === 'reports'} icon={<Backpack />} label="FEED" onClick={() => setActiveTab('reports')} color="bg-red-600" />
           <SidebarItem active={activeTab === 'calendar'} icon={<CalendarIcon />} label="LOG" onClick={() => setActiveTab('calendar')} color="bg-purple-600" />
           <SidebarItem active={activeTab === 'game'} icon={<Gamepad2 />} label="GAME" onClick={() => setActiveTab('game')} color="bg-orange-600" />
           <SidebarItem active={activeTab === 'memo'} icon={<NotebookPen />} label="MEMO" onClick={() => setActiveTab('memo')} color="bg-cyan-600" />
        </aside>

        <section className="flex-1 retro-box !bg-transparent border-0 overflow-hidden relative flex flex-col z-10">
          {activeTab === 'habitat' ? (
            <Habitat state={gameState} dialogue={monkeyDialogue} onSetDialogue={setMonkeyDialogue} />
          ) : (
            <div className="flex-1 retro-box !bg-black/80 overflow-hidden relative flex flex-col">
              {activeTab === 'team' && <TeamScreen state={gameState} />}
              {activeTab === 'market' && <MarketScreen state={gameState} onBuy={handleBuySkin} onEquip={handleEquipSkin} />}
              {activeTab === 'missions' && <MissionsScreen state={gameState} onStart={handleMissionStart} />}
              {activeTab === 'reports' && <ReportsScreen state={gameState} onSubmit={handleReportSubmit} />}
              {activeTab === 'calendar' && <CalendarScreen state={gameState} onRead={(r) => { setMonkeyDialogue(`Uu-aa! Detail: ${r.activityType} ${r.achievedUnit.toFixed(2)} unit. Semangat!`); setActiveTab('habitat'); }} />}
              {activeTab === 'game' && <MonkeyRace activeSkin={gameState.activeSkinId} onGainXP={(xp) => {
                 const newXP = gameState.xp + xp;
                 const newLevel = Math.floor(newXP / 1000) + 1;
                 setGameState(p => ({ ...p, xp: newXP, level: newLevel }));
                 syncProgressToCloud({ xp: newXP, level: newLevel });
              }} />}
              {activeTab === 'memo' && <MemoScreen state={gameState} setGameState={setGameState} onSync={syncProgressToCloud} />}
            </div>
          )}
        </section>

        <div className="hidden md:flex w-64 flex-col gap-4">
           <div className="retro-box !bg-red-950/80 shrink-0">
              <h3 className="text-r-xs font-bold text-orange-400 mb-4 flex items-center gap-2 uppercase"><Flame size={10} /> Bio-Stamina</h3>
              <div className="h-6 bg-black border-4 border-white overflow-hidden relative">
                 <div className="h-full stamina-bar-fill transition-all" style={{ width: `${gameState.stamina}%` }}></div>
                 <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mix-blend-difference">{gameState.stamina.toFixed(4)}%</span>
              </div>
           </div>

           <div className="retro-box !bg-black/80 flex-1 overflow-auto flex flex-col custom-scrollbar">
              <div className="border-b-4 border-emerald-500/30 mb-4 pb-2">
                <h3 className="text-r-sm font-bold text-emerald-400 uppercase leading-none">Feeding Log</h3>
                <div className="flex justify-between items-baseline mt-2">
                   <span className="text-[6px] text-zinc-400 uppercase">Capaian:</span>
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
                 {gameState.reports.length === 0 && <p className="text-[6px] text-center opacity-20 py-4 uppercase">No records found</p>}
              </div>
           </div>
        </div>
      </main>

      <nav className="md:hidden h-16 bg-zinc-900 border-t-4 border-white flex items-center justify-around px-2 z-30">
        <NavButton active={activeTab === 'habitat'} icon={<Trees />} onClick={() => setActiveTab('habitat')} color="text-green-500" />
        <NavButton active={activeTab === 'team'} icon={<Users />} onClick={() => setActiveTab('team')} color="text-indigo-500" />
        <NavButton active={activeTab === 'market'} icon={<ShoppingBag />} onClick={() => setActiveTab('market')} color="text-yellow-500" />
        <NavButton active={activeTab === 'missions'} icon={<Target />} onClick={() => setActiveTab('missions')} color="text-blue-500" />
        <NavButton active={activeTab === 'reports'} icon={<Backpack />} onClick={() => setActiveTab('reports')} color="text-red-500" />
        <NavButton active={activeTab === 'game'} icon={<Gamepad2 />} onClick={() => setActiveTab('game')} color="text-orange-500" />
        <NavButton active={activeTab === 'memo'} icon={<NotebookPen />} onClick={() => setActiveTab('memo')} color="text-cyan-500" />
      </nav>

      {showNotification && (
        <div className="fixed inset-x-0 bottom-20 md:bottom-10 flex justify-center z-50 animate-bounce px-4 pointer-events-none">
           <div className="retro-box !bg-white text-black text-[10px] md:text-r-md px-6 md:px-10 py-3 md:py-6 border-black shadow-2xl">&gt; {showNotification}</div>
        </div>
      )}
    </div>
  );
};

const SidebarItem = ({ active, icon, label, onClick, color }: any) => (
  <button onClick={onClick} className={`retro-box !p-2 flex flex-col items-center gap-1 transition-all ${active ? color + ' translate-x-2 scale-105 shadow-xl border-white' : '!bg-gray-800 opacity-60 border-zinc-700 hover:opacity-100'}`}>
    {React.cloneElement(icon, { size: 20 })}
    <span className="text-[6px] font-bold uppercase">{label}</span>
  </button>
);

const NavButton = ({ active, icon, onClick, color }: any) => (
  <button onClick={onClick} className={`p-2 transition-all rounded-lg ${active ? 'bg-white/10 scale-110 ' + color : 'text-zinc-600'}`}>
    {React.cloneElement(icon, { size: 24 })}
  </button>
);

export default App;
