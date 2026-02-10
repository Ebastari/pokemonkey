
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Trophy, Zap, Ghost, Timer, Keyboard, Settings, Save, X, Trophy as TrophyIcon } from 'lucide-react';
import { SKINS } from './constants';

const DEFAULT_WORDS = [
  "REKLAMASI", "SENGON", "PENGHIJAUAN", "POLYBAG", "BIBIT", 
  "EKOSISTEM", "TOP SOIL", "PENANAMAN", "LINGKUNGAN", "SUSTAINABLE",
  "HIDROPONIK", "KOMPOS", "FERTILIZER", "HUTAN", "FLORA", "FAUNA"
];

const STORAGE_KEY = 'monkey_race_custom_words';

interface MonkeyRaceProps {
  onGainXP: (xp: number) => void;
  activeSkin?: string;
}

export const MonkeyRace: React.FC<MonkeyRaceProps> = ({ onGainXP, activeSkin }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [wordBank, setWordBank] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_WORDS;
  });
  const [customText, setCustomText] = useState(wordBank.join('\n'));
  
  const [word, setWord] = useState("");
  const [input, setInput] = useState("");
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [totalTyped, setTotalTyped] = useState(0);
  const [correctTyped, setCorrectTyped] = useState(0);
  const [progress, setProgress] = useState(0); 
  const [shake, setShake] = useState(false);
  
  const startTimeRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentSkinData = useMemo(() => {
    return SKINS.find(s => s.id === activeSkin) || SKINS[0];
  }, [activeSkin]);

  const nextWord = useCallback(() => {
    if (wordBank.length === 0) {
      setWord("KOSONG");
      return;
    }
    const randomWord = wordBank[Math.floor(Math.random() * wordBank.length)];
    setWord(randomWord.toUpperCase());
    setInput("");
    setProgress(0);
  }, [wordBank]);

  const startGame = () => {
    if (wordBank.length === 0) return alert("Masukkan kata-kata di pengaturan terlebih dahulu!");
    setIsPlaying(true);
    setShowSettings(false);
    startTimeRef.current = Date.now();
    setTotalTyped(0);
    setCorrectTyped(0);
    nextWord();
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPlaying) return;
    const val = e.target.value.toUpperCase();
    const lastChar = val[val.length - 1];
    const targetChar = word[input.length];

    setTotalTyped(prev => prev + 1);

    if (lastChar === targetChar) {
      const newInput = val;
      setInput(newInput);
      setCorrectTyped(prev => prev + 1);
      
      const newProgress = (newInput.length / word.length) * 100;
      setProgress(newProgress);

      if (newInput === word) {
        onGainXP(word.length * 10);
        if ('vibrate' in navigator) navigator.vibrate(50);
        setTimeout(nextWord, 100);
      }
    } else {
      setShake(true);
      if ('vibrate' in navigator) navigator.vibrate([30, 30]);
      setTimeout(() => setShake(false), 100);
    }

    if (startTimeRef.current) {
      const minutes = (Date.now() - startTimeRef.current) / 60000;
      setWpm(Math.round((correctTyped / 5) / (minutes || 1)) || 0);
      setAccuracy(Math.round((correctTyped / totalTyped) * 100) || 100);
    }
  };

  const saveCustomWords = () => {
    const list = customText
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (list.length === 0) return alert("Daftar kata tidak boleh kosong!");
    
    setWordBank(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    setShowSettings(false);
  };

  return (
    <div className="flex-1 flex flex-col gap-1 md:gap-4 overflow-hidden relative h-full bg-zinc-900/20">
      <div className="flex justify-between items-center p-2 bg-black/40 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
           <button onClick={() => setIsPlaying(false)} className="p-1 hover:text-red-500 transition-colors">
              <X size={16} />
           </button>
           <h2 className="text-[8px] md:text-r-sm uppercase font-bold text-white/50">Training Room</h2>
        </div>
        <div className="flex gap-2">
          <div className="text-[8px] md:text-[10px] text-yellow-400 font-bold bg-black px-2 py-1 rounded border border-yellow-500/50">WPM: {wpm}</div>
          <button onClick={() => setShowSettings(true)} className="p-1 bg-zinc-800 rounded">
            <Settings size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col overflow-hidden">
        <div className="h-12 md:h-24 bg-zinc-800/80 border-y-2 border-white/10 relative flex items-center overflow-hidden shrink-0">
           <div className="absolute right-4 md:right-10 h-full w-2 md:w-4 bg-[repeating-linear-gradient(45deg,#fff,#fff_5px,#000_5px,#000_10px)] opacity-30"></div>
           
           <div className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 animate-bounce">
              <img src="https://cdn-icons-png.flaticon.com/512/2909/2909808.png" className="w-5 h-5 md:w-10 md:h-10" alt="target" />
           </div>

           <div 
             className="absolute transition-all duration-300 flex flex-col items-center"
             style={{ left: `calc(10px + ${progress * 0.8}%)`, top: '50%', transform: 'translateY(-50%)' }}
           >
             <div className={isPlaying ? 'animate-walk-fast' : ''}>
                <svg viewBox="0 0 64 64" className="w-8 h-8 md:w-20 md:h-20" style={{ imageRendering: 'pixelated' }}>
                   <rect x="20" y="24" width="24" height="24" fill={currentSkinData.colors.primary} />
                   <rect x="24" y="28" width="16" height="16" fill={currentSkinData.colors.secondary} />
                   <rect x="18" y="8" width="28" height="24" fill={currentSkinData.colors.primary} />
                   <rect x="22" y="12" width="20" height="16" fill={currentSkinData.colors.secondary} />
                   <rect x="26" y="16" width="2" height="4" fill={currentSkinData.colors.accent} />
                   <rect x="36" y="16" width="2" height="4" fill={currentSkinData.colors.accent} />
                   <rect x="26" y="24" width="12" height="2" fill={currentSkinData.colors.accent} />
                   <rect x="14" y="28" width="6" height="12" fill={currentSkinData.colors.primary} />
                   <rect x="44" y="28" width="6" height="12" fill={currentSkinData.colors.primary} />
                   <rect x="22" y="48" width="6" height="8" fill={currentSkinData.colors.primary} />
                   <rect x="36" y="48" width="6" height="8" fill={currentSkinData.colors.primary} />
                </svg>
             </div>
           </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-start pt-6 md:pt-12 px-4 gap-6">
           {isPlaying ? (
             <div className={`w-full max-w-md transition-transform ${shake ? 'translate-x-1' : ''}`}>
                <div className="retro-box !bg-black/80 !p-4 md:!p-8 border-yellow-500 shadow-2xl mb-4">
                   <div className="flex justify-center gap-1 md:gap-3 flex-wrap">
                     {word.split('').map((char, i) => (
                       <span 
                         key={i} 
                         className={`text-xl md:text-4xl font-black tracking-tighter md:tracking-widest ${
                           i < input.length ? 'text-green-500' : 'text-zinc-600'
                         }`}
                       >
                         {char}
                       </span>
                     ))}
                   </div>
                   
                   <div className="mt-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 transition-all duration-150" style={{ width: `${progress}%` }}></div>
                   </div>
                </div>

                <div className="relative h-12 flex items-center justify-center">
                   <input 
                      ref={inputRef}
                      type="text"
                      autoFocus
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      value={input}
                      onChange={handleInput}
                      className="absolute inset-0 opacity-0 w-full cursor-default"
                      style={{ fontSize: '16px' }} 
                   />
                   <p className="text-[7px] md:text-[10px] text-zinc-500 animate-pulse uppercase tracking-[0.2em]">
                      Tap di sini jika keyboard tertutup
                   </p>
                </div>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center text-center p-8 mt-10">
                <TrophyIcon size={48} className="text-yellow-500 mb-4 animate-bounce" />
                <h3 className="text-r-md font-bold mb-4">SPEED TRAINING</h3>
                <button 
                  onClick={startGame}
                  className="retro-box !bg-yellow-600 !px-10 !py-4 font-bold text-r-sm hover:!bg-yellow-500 active:translate-y-1 transition-all"
                >
                  MULAI BALAPAN
                </button>
                <p className="mt-6 text-[8px] text-zinc-500 uppercase max-w-[200px] leading-relaxed">
                   Ketik kata secepat mungkin untuk membantu monyet mencapai garis finish!
                </p>
             </div>
           )}
        </div>

        {showSettings && (
          <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md p-4 flex items-center justify-center">
             <div className="retro-box !bg-zinc-900 w-full max-w-sm border-yellow-500 p-4">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-[10px] font-bold text-yellow-500 uppercase">Edit Word Bank</h3>
                   <button onClick={() => setShowSettings(false)} className="text-zinc-500"><X /></button>
                </div>
                <textarea 
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full h-40 bg-black border-2 border-zinc-700 p-3 text-[10px] text-green-500 font-mono outline-none resize-none mb-4"
                  placeholder="Ketik kata baru di sini (pisahkan dengan baris atau koma)..."
                />
                <button 
                  onClick={saveCustomWords}
                  className="w-full retro-box !bg-green-600 p-3 font-bold text-[10px] hover:!bg-green-500"
                >
                  SIMPAN KATA-KATA
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
