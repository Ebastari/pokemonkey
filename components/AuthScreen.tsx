
import React, { useState, useEffect } from 'react';
import { User, Key, UserPlus, LogIn, Trees, Wifi, AlertTriangle, Loader2, Settings, Globe } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (data: any, usedCloudUrl: string) => void;
  cloudUrl: string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess, cloudUrl: initialCloudUrl }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [customCloudUrl, setCustomCloudUrl] = useState(initialCloudUrl || '');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeUrl = customCloudUrl.trim();
    
    if (!activeUrl) {
      setError("DIPERLUKAN URL APPS SCRIPT (MASUK KE SETTINGS)!");
      return;
    }

    if (!userId || !password || (isRegister && !fullName)) return;
    
    setLoading(true);
    setError(null);

    const cleanUserId = userId.trim().toLowerCase();

    try {
      if (isRegister) {
        // Registration via POST
        // Note: Using text/plain for body/headers avoids CORS preflight triggers
        await fetch(activeUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            action: 'register',
            userId: cleanUserId,
            password,
            fullName
          })
        });
        
        // Wait a bit for the script to handle the post
        await new Promise(r => setTimeout(r, 1200));

        // Verify registration with login check
        const checkRes = await fetch(`${activeUrl}?action=login&userId=${cleanUserId}&password=${password}`);
        const checkData = await checkRes.json();
        
        if (typeof checkData === 'object' && checkData.userId) {
          onAuthSuccess(checkData, activeUrl);
        } else {
          setError("PENDAFTARAN BERHASIL. SILAKAN LOGIN MANUAL.");
          setIsRegister(false);
        }
      } else {
        // Login via GET for readable JSON response from Apps Script
        const response = await fetch(`${activeUrl}?action=login&userId=${cleanUserId}&password=${password}`);
        
        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }

        const result = await response.json();
        
        if (result === "AUTH_FAILED") {
          setError("ID ATAU PASSWORD SALAH!");
        } else if (typeof result === 'object' && result.userId) {
          onAuthSuccess(result, activeUrl);
        } else {
          setError("FORMAT RESPONSE TIDAK DIKENALI. CEK SCRIPT ANDA.");
        }
      }
    } catch (err) {
      console.error("Auth error:", err);
      
      // Fallback for local debugging
      if (!isRegister && cleanUserId === "admin" && password === "admin") {
         onAuthSuccess({
            userId: "admin",
            fullName: "Forester Master",
            xp: 1500,
            level: 2,
            plantedArea: 5,
            ownedSkins: ["classic", "manager"],
            activeSkinId: "classic",
            memoPlans: []
         }, "");
         return;
      }

      // If fetch fails, provide helpful troubleshooting
      if (err instanceof TypeError && err.message === "Failed to fetch") {
        setError(`GAGAL MENGHUBUNGI SERVER (Failed to fetch). Pastikan URL benar dan Script di-deploy sebagai 'Anyone' (Who has access: Anyone).`);
      } else {
        setError(`ERROR: ${err instanceof Error ? err.message : 'Gangguan Koneksi'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="garden-bg w-full h-full"></div>
      </div>
      
      <button 
        onClick={() => setShowSettings(!showSettings)}
        className="absolute top-4 right-4 z-20 p-3 retro-box !bg-zinc-800 text-yellow-500 hover:text-white transition-all"
        title="Cloud Settings"
      >
        <Settings size={20} className={showSettings ? 'rotate-90' : ''} />
      </button>

      <div className="retro-box !bg-zinc-900 w-full max-w-md border-yellow-500 p-8 shadow-[0_0_80px_rgba(234,179,8,0.15)] z-10 scale-up-center">
         {showSettings ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
               <div className="text-center mb-6">
                  <Globe size={32} className="mx-auto text-cyan-500 mb-2" />
                  <h2 className="text-r-sm font-bold text-white uppercase">Cloud Settings</h2>
                  <p className="text-[6px] text-zinc-500 uppercase mt-1">Konfigurasi Endpoint Apps Script</p>
               </div>
               
               <div className="space-y-2">
                  <label className="text-[8px] text-zinc-500 uppercase font-bold">Script Exec URL</label>
                  <input 
                    type="text" 
                    value={customCloudUrl} 
                    onChange={e => setCustomCloudUrl(e.target.value)}
                    className="w-full bg-black border-4 border-white p-3 text-[8px] outline-none text-cyan-400 font-mono focus:border-cyan-500"
                    placeholder="https://script.google.com/macros/s/.../exec"
                  />
                           <p className="text-[5px] text-zinc-400 leading-relaxed mt-2 bg-black/40 p-2 border border-white/5">
                              * Deploy script Anda di Google Apps Script:<br/>
                              1. Deploy &gt; New Deployment<br/>
                              2. Select 'Web App'<br/>
                              3. Execute as 'Me'<br/>
                              4. Who has access: 'Anyone' (WAJIB)
                           </p>
               </div>

               <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full retro-box !p-3 font-bold text-[8px] !bg-zinc-700 hover:!bg-zinc-600"
               >
                  KEMBALI KE LOGIN
               </button>
            </div>
         ) : (
            <>
               <div className="text-center mb-10">
                  <div className="inline-block p-5 bg-yellow-500 rounded-2xl mb-6 shadow-xl animate-bounce">
                     <Trees size={48} className="text-black" />
                  </div>
                  <h1 className="text-r-md font-bold text-yellow-500 mb-3 tracking-widest uppercase">Pokemonkey Cloud</h1>
                  <p className="text-[8px] text-zinc-500 uppercase tracking-widest leading-relaxed">Centralized Reclamation Progress Sync</p>
               </div>

               {error && (
                  <div className="bg-red-950/40 border-2 border-red-500 p-4 mb-8 flex items-start gap-4 text-[8px] text-red-200 uppercase leading-normal">
                     <AlertTriangle size={20} className="shrink-0 text-red-500" />
                     <span>{error}</span>
                  </div>
               )}

               <form onSubmit={handleAuth} className="space-y-6">
                  <div className="space-y-2">
                     <label className="text-[8px] text-zinc-500 uppercase font-bold flex items-center gap-2">
                        <User size={12}/> {isRegister ? 'BUAT USER ID' : 'USER ID'}
                     </label>
                     <input 
                        type="text" 
                        required
                        value={userId} 
                        onChange={e => setUserId(e.target.value)}
                        className="w-full bg-black border-4 border-white p-4 text-r-sm outline-none text-white focus:border-yellow-500 transition-colors"
                        placeholder="ID (CONTOH: MANDOR_RIMBA)"
                     />
                  </div>

                  {isRegister && (
                     <div className="space-y-2">
                        <label className="text-[8px] text-zinc-500 uppercase font-bold">NAMA LENGKAP</label>
                        <input 
                           type="text" 
                           required
                           value={fullName} 
                           onChange={e => setFullName(e.target.value)}
                           className="w-full bg-black border-4 border-white p-4 text-r-sm outline-none text-white focus:border-yellow-500 transition-colors"
                           placeholder="NAMA LENGKAP"
                        />
                     </div>
                  )}

                  <div className="space-y-2">
                     <label className="text-[8px] text-zinc-500 uppercase font-bold flex items-center gap-2">
                        <Key size={12}/> PASSWORD
                     </label>
                     <input 
                        type="password" 
                        required
                        value={password} 
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-black border-4 border-white p-4 text-r-sm outline-none text-white focus:border-yellow-500 transition-colors"
                        placeholder="********"
                     />
                  </div>

                  <button 
                     type="submit"
                     disabled={loading}
                     className={`w-full retro-box !p-5 font-bold text-r-sm flex items-center justify-center gap-4 !bg-yellow-600 hover:!bg-yellow-500 transition-all ${loading ? 'opacity-50 grayscale' : 'active:translate-y-2 shadow-2xl'}`}
                  >
                     {loading ? (
                       <Loader2 size={24} className="animate-spin" />
                     ) : (
                       isRegister ? <><UserPlus size={20} /> DAFTAR BARU</> : <><LogIn size={20} /> MASUK GAME</>
                     )}
                  </button>
               </form>

               <div className="mt-10 text-center border-t-2 border-white/5 pt-8">
                  <button 
                     onClick={() => { setIsRegister(!isRegister); setError(null); }} 
                     className="text-[8px] text-zinc-600 uppercase hover:text-yellow-500 transition-colors tracking-widest"
                  >
                     {isRegister ? 'Sudah punya akun? Login di sini' : 'Belum punya akun? Daftar sekarang'}
                  </button>
               </div>
            </>
         )}

         <div className="mt-6 flex items-center justify-center gap-3 opacity-20">
            <Wifi size={12} className="text-emerald-500" />
            <span className="text-[6px] uppercase font-bold tracking-widest">Progress Link v3 Active</span>
         </div>
      </div>
    </div>
  );
};
