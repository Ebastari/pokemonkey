
import React, { useState, useEffect, useMemo } from 'react';
import { Users, Trophy, BrainCircuit, Globe, RefreshCcw, Wifi, Star } from 'lucide-react';
import { GameState, TeamMember } from '../types';

export const TeamScreen = ({ state }: { state: GameState }) => {
  const [teamData, setTeamData] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>("Uu-aa! Menyiapkan data tim...");

  // Fungsi Rule-Based Engine (Pengganti Gemini)
  const generateLocalAdvice = (data: TeamMember[]) => {
    const totalHa = data.reduce((acc, m) => acc + m.totalHa, 0);
    const targetHa = 150;
    const percentage = (totalHa / targetHa) * 100;
    const memberCount = data.length;
    const topPlayer = data.length > 0 ? [...data].sort((a, b) => b.xp - a.xp)[0] : null;

    // Kumpulan Template Pesan Monyet
    if (totalHa === 0) {
      return "UU-AA! Lahan masih gersang! Ayo ajak timmu mulai menanam sekarang!";
    }
    
    if (percentage >= 100) {
      return "LUAR BIASA! Target 150ha tercapai! Kalian adalah pahlawan hutan sejati! Uu-aa!";
    }

    if (percentage > 75) {
      return `Sedikit lagi! ${totalHa.toFixed(1)}ha sudah hijau. Fokus pada tahap penyelesaian!`;
    }

    if (percentage > 40) {
      return `Progres tim sangat solid! ${memberCount} forester bekerja keras. Terus jaga ritme penanaman!`;
    }

    if (topPlayer && topPlayer.xp > 5000) {
      return `Uu-aa! Lihat ${topPlayer.name}, dia sangat produktif! Ayo tim lainnya, jangan mau kalah!`;
    }

    if (percentage > 0) {
      return `Awal yang bagus! ${totalHa.toFixed(2)}ha sudah dikerjakan. Ingat: satu bibit hari ini, satu hutan masa depan!`;
    }

    return "Uu-aa! Tetap semangat dan jangan lupa sinkronkan data lapanganmu!";
  };

  // Fetch Team Data from Spreadsheet
  const fetchTeamData = async () => {
    if (!state.cloudUrl) {
      // Fallback Mock Data jika tidak ada URL Cloud
      const mock = [
        { name: state.fullName || 'You', xp: state.xp, level: state.level, lastActive: 'Sekarang', totalHa: state.plantedArea },
        { name: 'Mandor Budi', xp: 4500, level: 5, lastActive: '10m lalu', totalHa: 12.5 },
        { name: 'Tim Nursery', xp: 8200, level: 9, lastActive: '2j lalu', totalHa: 25.0 },
      ];
      setTeamData(mock);
      setAiAdvice(generateLocalAdvice(mock));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${state.cloudUrl}?action=getTeamData`);
      if (!response.ok) throw new Error("Fetch failed");
      const data = await response.json();
      setTeamData(data);
      setAiAdvice(generateLocalAdvice(data)); // Update advice secara lokal
    } catch (err) {
      console.warn("Could not fetch team data. Using local mock data.");
      const fallback = [
        { name: state.fullName || 'You', xp: state.xp, level: state.level, lastActive: 'Sekarang', totalHa: state.plantedArea },
        { name: 'Mandor Budi', xp: 4500, level: 5, lastActive: '10m lalu', totalHa: 12.5 },
      ];
      setTeamData(fallback);
      setAiAdvice(generateLocalAdvice(fallback));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, [state.cloudUrl, state.xp, state.plantedArea]); // Trigger refresh saat data lokal berubah

  const globalTotal = useMemo(() => teamData.reduce((acc, m) => acc + m.totalHa, 0), [teamData]);

  return (
    <div className="p-4 flex flex-col h-full overflow-hidden">
       <div className="flex justify-between items-center border-b-4 border-white pb-2 mb-6">
          <h2 className="text-r-md uppercase flex items-center gap-2">
            <Users size={20} /> Team Network
          </h2>
          <button 
            disabled={loading}
            onClick={fetchTeamData} 
            className={`p-2 bg-indigo-600 rounded hover:bg-indigo-500 transition-all ${loading ? 'opacity-50' : 'active:scale-90'}`}
          >
             <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-auto custom-scrollbar pb-20">
          <div className="space-y-4">
             {/* Global Progress Card */}
             <div className="retro-box !bg-indigo-900/40 border-indigo-400 p-4">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-[10px] font-bold text-indigo-300 uppercase flex items-center gap-2"><Globe size={14} /> Global Progress</h3>
                   <span className="text-[8px] bg-white text-indigo-900 px-2 font-bold">150 HA TARGET</span>
                </div>
                <div className="h-6 bg-black border-4 border-white overflow-hidden relative mb-2">
                   <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-1000 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${Math.min(100, (globalTotal / 150) * 100)}%` }}></div>
                   <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold mix-blend-difference">{((globalTotal / 150) * 100).toFixed(2)}% COMPLETE</span>
                </div>
                <p className="text-[6px] text-indigo-200 text-center uppercase tracking-widest">Total Kontribusi Tim: {globalTotal.toFixed(2)} HA</p>
             </div>

             {/* Local Analysis Card (Pengganti Gemini) */}
             <div className="retro-box !bg-black/80 border-cyan-500 p-4 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
                   <BrainCircuit size={80} className="text-cyan-500" />
                </div>
                <h3 className="text-[8px] font-bold text-cyan-400 uppercase mb-3 flex items-center gap-2">
                   <span className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></span> Shift Genius (Local)
                </h3>
                <div className="bg-cyan-950/30 p-3 border border-cyan-500/30 min-h-[60px]">
                   <p className="text-[8px] leading-relaxed text-white italic">"{aiAdvice}"</p>
                </div>
                <p className="text-[5px] text-zinc-500 mt-2 uppercase">*Analisis instan berdasarkan data tim terbaru.</p>
             </div>
          </div>

          <div className="space-y-4">
             {/* Leaderboard */}
             <div className="retro-box !bg-zinc-900/80 p-4 border-yellow-500 flex flex-col h-full min-h-[300px]">
                <h3 className="text-[10px] font-bold text-yellow-400 uppercase mb-4 flex items-center gap-2"><Trophy size={14} /> Forester Ranking</h3>
                <div className="space-y-2 overflow-auto custom-scrollbar pr-1 flex-1">
                   {teamData.length > 0 ? (
                     teamData.sort((a,b) => b.xp - a.xp).map((member, idx) => (
                       <div key={member.name} className={`flex items-center justify-between p-3 border-2 transition-all ${member.name === state.fullName ? 'border-yellow-400 bg-yellow-400/10 scale-[1.02]' : 'border-white/10 bg-black/40 hover:border-white/30'}`}>
                          <div className="flex items-center gap-3">
                             <span className="text-[8px] font-bold text-zinc-500 w-4">#{idx+1}</span>
                             <div>
                                <p className="text-[8px] font-bold text-white uppercase">{member.name}</p>
                                <p className="text-[6px] text-zinc-500 uppercase">LVL {member.level} | {member.lastActive}</p>
                             </div>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-bold text-yellow-400 flex items-center gap-1 justify-end">
                                {member.xp.toLocaleString()} <Star size={10} fill="currentColor" />
                             </p>
                             <p className="text-[6px] text-emerald-400 uppercase">{member.totalHa.toFixed(2)} HA</p>
                          </div>
                       </div>
                     ))
                   ) : (
                      <div className="flex flex-col items-center justify-center p-10 opacity-30 text-center h-full">
                         <Wifi size={32} className="mb-2 animate-pulse" />
                         <p className="text-[8px] uppercase">Menghubungkan ke Cloud...</p>
                      </div>
                   )}
                </div>
             </div>
          </div>
       </div>
    </div>
  );
};
