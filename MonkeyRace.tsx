
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trophy, Zap, Ghost, Timer, Keyboard, Settings, Save, X } from 'lucide-react';

const DEFAULT_WORDS = [
  "REKLAMASI", "SENGON", "PENGHIJAUAN", "POLYBAG", "BIBIT", 
  "EKOSISTEM", "TOP SOIL", "PENANAMAN", "LINGKUNGAN", "SUSTAINABLE",
  "HIDROPONIK", "KOMPOS", "FERTILIZER", "HUTAN", "FLORA", "FAUNA"
];

const STORAGE_KEY = 'monkey_race_custom_words';

interface MonkeyRaceProps {
  onGainXP: (xp: number) => void;
}

export const MonkeyRace: React.FC<MonkeyRaceProps> = ({ onGainXP }) => {
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
  const [progress, setProgress] = useState(0); // 0 to 100
  const [shake, setShake] = useState(false);
  
  const startTimeRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    setTimeout(() => inputRef.current?.focus(), 100);
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
        setTimeout(nextWord, 100);
      }
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 100);
    }

    if (startTimeRef.current) {
      const minutes = (Date.now() - startTimeRef.current) / 60000;
      setWpm(Math.round((correctTyped / 5) / minutes) || 0);
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
    alert("Daftar kata berhasil disimpan!");
  };

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden relative">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-r-md uppercase flex items-center gap-2">
          <Keyboard size={20} /> Monkey Race: Typing Training
        </h2>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="retro-box !bg-zinc-800 p-2 hover:scale-105 active:scale-95 transition-transform"
            title="Pengaturan Kata"
          >
            <Settings size={16} />
          </button>
          <div className="retro-box !bg-black/50 py-1 px-3 text-[10px] text-yellow-400">WPM: {wpm}</div>
          <div className="retro-box !bg-black/50 py-1 px-3 text-[10px] text-green-400">ACC: {accuracy}%</div>
        </div>
      </div>

      <div className="flex-1 retro-box !bg-green-900/40 relative flex flex-col overflow-hidden">
        {/* Track Area */}
        <div className="absolute top-1/2 left-0 right-0 h-24 bg-zinc-800 -translate-y-1/2 border-y-4 border-dashed border-white/30 flex items-center">
          <div className="absolute right-10 h-full w-4 bg-[repeating-conic-gradient(#fff_0%_25%,#000_0%_50%)_0%_0%/10px_10px] border-l-2 border-white"></div>
          
          <div className="absolute right-2 top-1/2 -translate-y-1/2 animate-bounce">
            <img src="https://cdn-icons-png.flaticon.com/512/2909/2909808.png" className="w-8 h-8 drop-shadow-[0_0_8px_yellow]" />
          </div>

          <div 
            className="absolute transition-all duration-100 flex flex-col items-center"
            style={{ left: `calc(40px + ${progress * 0.8}%)`, top: '50%', transform: 'translateY(-50%)' }}
          >
            <div className={`${isPlaying ? 'animate-walk-fast' : ''}`}>
               <svg viewBox="0 0 64 64" className="w-16 h-16 drop-shadow-lg" style={{ imageRendering: 'pixelated' }}>
                  <rect x="20" y="24" width="24" height="24" fill="#8B4513" />
                  <rect x="24" y="28" width="16" height="16" fill="#D2B48C" />
                  <rect x="18" y="8" width="28" height="24" fill="#8B4513" />
                  <rect x="22" y="12" width="20" height="16" fill="#D2B48C" />
                  <rect x="26" y="16" width="2" height="4" fill="#000" />
                  <rect x="36" y="16" width="2" height="4" fill="#000" />
                  <rect x="26" y="24" width="12" height="2" fill="#000" />
               </svg>
            </div>
          </div>
        </div>

        {!isPlaying && !showSettings && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
            <Trophy size={64} className="text-yellow-400 mb-4 animate-pulse" />
            <h3 className="text-r-md mb-2">SIAP BALAPAN?</h3>
            <p className="text-[8px] text-zinc-400 mb-8">Ketik kata secepat mungkin untuk mengejar pisang!</p>
            <button 
              onClick={startGame}
              className="retro-box !bg-yellow-500 !p-4 hover:scale-105 active:scale-95 transition-transform font-bold text-r-sm"
            >
              MULAI TRAINING [ENTER]
            </button>
          </div>
        )}

        {showSettings && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-6">
            <div className="retro-box !bg-zinc-900 w-full max-w-md border-yellow-500">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-r-sm font-bold text-yellow-500 uppercase">Setting Teks Balapan</h3>
                <button onClick={() => setShowSettings(false)} className="text-zinc-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <p className="text-[6px] text-zinc-400 mb-2 uppercase">Masukkan kata-kata (pisahkan dengan baris baru atau koma):</p>
              <textarea 
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="CONTOH: REKLAMASI, SENGON, POHON..."
                className="w-full h-48 bg-black border-4 border-zinc-700 p-3 text-[10px] text-green-500 font-mono focus:border-green-500 outline-none resize-none mb-4"
              />
              <div className="flex gap-2">
                <button 
                  onClick={saveCustomWords}
                  className="flex-1 retro-box !bg-green-600 p-2 flex items-center justify-center gap-2 hover:!bg-green-500 transition-colors"
                >
                  <Save size={14} /> <span className="text-[8px] font-bold">SIMPAN</span>
                </button>
                <button 
                  onClick={() => setCustomText(DEFAULT_WORDS.join('\n'))}
                  className="retro-box !bg-zinc-700 p-2 text-[8px] font-bold"
                >
                  RESET
                </button>
              </div>
            </div>
          </div>
        )}

        {isPlaying && !showSettings && (
          <div className={`mt-auto mb-12 flex flex-col items-center gap-6 z-10 transition-transform ${shake ? 'translate-x-1' : ''}`}>
            <div className="retro-box !bg-black/90 p-8 border-yellow-500 min-w-[400px] text-center shadow-2xl">
              <div className="flex justify-center gap-2 mb-4 flex-wrap">
                {word.split('').map((char, i) => (
                  <span 
                    key={i} 
                    className={`text-2xl font-bold tracking-widest ${
                      i < input.length ? 'text-green-500' : 'text-zinc-600'
                    }`}
                  >
                    {char}
                  </span>
                ))}
              </div>
              <input 
                ref={inputRef}
                type="text"
                autoFocus
                value={input}
                onChange={handleInput}
                className="absolute opacity-0 pointer-events-none"
              />
              <div className="h-2 bg-zinc-800 border-2 border-white/20 w-full rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 transition-all duration-200" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
            <p className="text-[8px] text-zinc-500 animate-pulse uppercase tracking-widest">Ketik kata di atas secepat kilat!</p>
          </div>
        )}
      </div>
    </div>
  );
};
