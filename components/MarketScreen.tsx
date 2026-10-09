import React, { useEffect, useMemo, useState } from 'react';
import { ShoppingBag, Star, CheckCircle2, Lock, Sparkles, X, ChevronLeft, ChevronRight, Trophy, Users, BookOpen, Lightbulb } from 'lucide-react';
import { GameState, Skin } from '../types';
import { SKINS } from '../constants';
import { MonkeySprite } from './MonkeySprite';
import { KELANGKAAN, LatarSkin } from './LatarSkin';
import { api } from '../lib/api';

interface MarketScreenProps {
  state: GameState;
  onBuy: (id: string) => void;
  onEquip: (id: string) => void;
}

/** Kemajuan Skin Prestasi dari GET /api/prestasi. */
interface KemajuanPrestasi { kode: string; skin: string; nama: string; syarat: string; target: number; satuan: string; nilai: number; didapat_pada: string | null }

const TIER_TAMBAHAN: Record<number, string> = {
  1: 'Seragam', 2: 'Aksesori', 3: 'Aksesori + Efek', 4: 'Jubah / Sayap', 5: 'Legenda', 6: 'Prestasi · tidak dijual',
};

type Saring = 'semua' | 'dimiliki' | 'terjangkau' | 'prestasi';

export const MarketScreen: React.FC<MarketScreenProps> = ({ state, onBuy, onEquip }) => {
  const [saring, setSaring] = useState<Saring>('semua');
  const [detail, setDetail] = useState<string | null>(null);
  const [pemilik, setPemilik] = useState<{ pemilik: Record<string, number>; anggota: number } | null>(null);
  const [prestasi, setPrestasi] = useState<KemajuanPrestasi[]>([]);
  // Belanja memakai saldo (XP total − yang sudah dibelanjakan); XP total & level tidak berkurang.
  const saldo = state.saldo ?? state.xp;

  useEffect(() => {
    api<{ pemilik: Record<string, number>; anggota: number }>('/api/skin/pemilik').then(setPemilik).catch(() => undefined);
    api<{ prestasi: KemajuanPrestasi[] }>('/api/prestasi').then((d) => setPrestasi(d.prestasi)).catch(() => undefined);
  }, [state.ownedSkins.length]);

  const urut = useMemo(() => [...SKINS].sort((a, b) => (Boolean(a.prestasi) === Boolean(b.prestasi) ? a.cost - b.cost : a.prestasi ? 1 : -1)), []);
  const daftar = useMemo(() => urut.filter((s) => {
    if (saring === 'dimiliki') return state.ownedSkins.includes(s.id);
    if (saring === 'terjangkau') return !s.prestasi && !state.ownedSkins.includes(s.id) && saldo >= s.cost;
    if (saring === 'prestasi') return Boolean(s.prestasi);
    return true;
  }), [urut, saring, state.ownedSkins, saldo]);

  const berikutnya = useMemo(() => SKINS.filter((s) => !s.prestasi && !state.ownedSkins.includes(s.id) && s.cost > saldo).sort((a, b) => a.cost - b.cost)[0], [state.ownedSkins, saldo]);
  const kemajuan = (s: Skin) => prestasi.find((p) => p.skin === s.id);

  return (
    <div className="p-3 flex flex-col h-full overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b-4 border-white pb-2 mb-3">
        <h2 className="judul-layar flex items-center gap-2 mr-auto"><ShoppingBag size={16} /> Forester Market</h2>
        <div className="chip-retro !text-[13px] border-yellow-400 bg-zinc-900 text-yellow-300 !py-1.5"><Star size={12} className="fill-yellow-300" /> Saldo {saldo.toLocaleString('id-ID')} XP</div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {(['semua', 'dimiliki', 'terjangkau', 'prestasi'] as const).map((s) => (
          <button key={s} onClick={() => setSaring(s)} className={`btn-retro btn-retro-sm flex items-center gap-1 ${saring === s ? (s === 'prestasi' ? 'bg-pink-600' : 'bg-yellow-600') : 'bg-zinc-800'}`}>
            {s === 'prestasi' && <Trophy size={12} />}{s}
          </button>
        ))}
        {berikutnya && saring !== 'prestasi' && (
          <p className="text-[12px] text-zinc-300 ml-auto">Berikutnya: <b className="text-white">{berikutnya.name}</b> — kurang <b className="text-yellow-300">{(berikutnya.cost - saldo).toLocaleString('id-ID')} XP</b></p>
        )}
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar pb-4">
        {saring === 'prestasi' && (
          <div className="mb-3 panel-retro text-[12px] text-zinc-300 leading-relaxed border-pink-500/50">
            <b className="text-pink-300">Skin Prestasi</b> tidak bisa dibeli. Skin ini terbuka sendiri dari kerja nyata — memeriksa titik api, menutup PICA,
            membantu rekan, melapor dengan foto — dan menjadi bukti yang bisa dilihat seluruh tim.
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {daftar.map((skin) => {
            const isOwned = state.ownedSkins.includes(skin.id);
            const isActive = state.activeSkinId === skin.id;
            const canAfford = !skin.prestasi && saldo >= skin.cost;
            const t = KELANGKAAN[skin.tier];
            const k = skin.prestasi ? kemajuan(skin) : undefined;
            return (
              <div key={skin.id} className={`retro-box !p-3 flex flex-col gap-2 transition-all ${isActive ? '!border-yellow-400 !bg-yellow-950/40' : `!bg-zinc-900/70 ${t.garis}`} ${skin.prestasi ? 'shadow-[0_0_14px_rgba(244,114,182,0.35)]' : ''}`}>
                <button
                  type="button"
                  onClick={() => setDetail(skin.id)}
                  className="h-28 bg-black/50 border-2 border-white/10 flex items-center justify-center relative overflow-hidden hover:border-white/40 group"
                  title={`Lihat ${skin.name}`}
                  aria-label={`Lihat detail ${skin.name}`}
                >
                  <span className={skin.prestasi && !isOwned ? 'brightness-0 opacity-60' : ''}><MonkeySprite skin={skin} ukuran={88} pose="diam" /></span>
                  {isActive && <span className="absolute top-1 right-1 chip-retro border-yellow-300 bg-yellow-500 text-black">Dipakai</span>}
                  {!isOwned && !canAfford && <span className="absolute top-1 left-1 text-zinc-400"><Lock size={14} /></span>}
                  <span className="absolute bottom-1 right-1 text-[10px] text-white/70 sm:opacity-0 group-hover:opacity-100">Lihat ▸</span>
                </button>
                <div className="leading-tight">
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="text-[14px] font-bold text-white truncate">{skin.name}</h3>
                    <span className={`text-[11px] ${t.teks} whitespace-nowrap`}>{skin.prestasi ? '🏆' : '★'.repeat(skin.tier)}</span>
                  </div>
                  <p className={`text-[11px] ${t.teks} uppercase`}>{t.label}</p>
                  <p className="text-[12px] text-zinc-300 mt-1 min-h-[2.4em] line-clamp-2">{skin.description}</p>
                </div>
                {skin.prestasi && !isOwned ? (
                  <div className="text-[11px] text-pink-200">
                    <div className="h-2 bg-black border border-pink-400/60 mb-1"><div className="h-full bg-pink-500" style={{ width: `${Math.min(100, ((k?.nilai ?? 0) / (k?.target ?? 1)) * 100)}%` }} /></div>
                    {k ? `${Math.min(k.nilai, k.target)}/${k.target} ${k.satuan}` : 'Memuat syarat…'}
                  </div>
                ) : !isOwned ? (
                  <button onClick={() => onBuy(skin.id)} disabled={!canAfford} className={`btn-retro btn-retro-sm w-full ${canAfford ? 'bg-emerald-600' : 'bg-zinc-800 grayscale'}`}>
                    <Star size={12} /> {skin.cost === 0 ? 'Gratis' : `${skin.cost.toLocaleString('id-ID')} XP`}
                  </button>
                ) : (
                  <button onClick={() => onEquip(skin.id)} disabled={isActive} className={`btn-retro btn-retro-sm w-full ${isActive ? 'bg-zinc-700' : 'bg-blue-600'}`}>
                    {isActive ? <><CheckCircle2 size={12} /> Terpasang</> : <><Sparkles size={12} /> Pakai</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 panel-retro text-[12px] text-zinc-300 leading-relaxed">
          <b className="text-white">Tingkat kelangkaan.</b> Umum (★) · Biasa (★★) · Langka (★★★) · Epik (★★★★) · Legenda (★★★★★) · <span className="text-pink-300">Mitis 🏆 — hanya dari prestasi</span>.
          Ketuk gambar skin untuk melihatnya besar beserta sejarah dan filosofinya. Skin yang dipakai menjadi foto profil bawaan Anda di TEAM.
          Harga dibayar dari saldo XP — XP total dan level tidak berkurang saat membeli.
        </div>
      </div>

      {detail && (
        <DetailSkin
          skinId={detail}
          daftar={daftar.some((s) => s.id === detail) ? daftar : urut}
          state={state}
          saldo={saldo}
          pemilik={pemilik}
          prestasi={prestasi}
          onGanti={setDetail}
          onTutup={() => setDetail(null)}
          onBuy={onBuy}
          onEquip={onEquip}
        />
      )}
    </div>
  );
};

/** Layar detail skin: gambar besar beranimasi, kelangkaan, sejarah, filosofi, pemilik, dan aksi. */
const DetailSkin: React.FC<{
  skinId: string; daftar: Skin[]; state: GameState; saldo: number;
  pemilik: { pemilik: Record<string, number>; anggota: number } | null; prestasi: KemajuanPrestasi[];
  onGanti: (id: string) => void; onTutup: () => void; onBuy: (id: string) => void; onEquip: (id: string) => void;
}> = ({ skinId, daftar, state, saldo, pemilik, prestasi, onGanti, onTutup, onBuy, onEquip }) => {
  const skin = SKINS.find((s) => s.id === skinId) ?? SKINS[0];
  const i = daftar.findIndex((s) => s.id === skinId);
  const [pose, setPose] = useState<'diam' | 'jalan' | 'lompat'>('diam');
  useEffect(() => {
    const urutan: ('diam' | 'jalan' | 'lompat')[] = ['diam', 'jalan', 'jalan', 'lompat', 'diam'];
    let n = 0;
    const t = setInterval(() => { n = (n + 1) % urutan.length; setPose(urutan[n]); }, 1100);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onTutup();
      if (e.key === 'ArrowRight' && i < daftar.length - 1) onGanti(daftar[i + 1].id);
      if (e.key === 'ArrowLeft' && i > 0) onGanti(daftar[i - 1].id);
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [i, daftar, onGanti, onTutup]);
  // Geser kiri/kanan di HP.
  const [awalX, setAwalX] = useState<number | null>(null);

  const milik = state.ownedSkins.includes(skin.id);
  const aktif = state.activeSkinId === skin.id;
  const t = KELANGKAAN[skin.tier];
  const k = prestasi.find((p) => p.skin === skin.id);
  const n = pemilik?.pemilik[skin.id] ?? 0;

  return (
    <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-2 sm:p-4" onClick={onTutup}>
      <div
        className={`retro-box !bg-zinc-950 border-4 ${t.garis} w-full max-w-3xl max-h-[94vh] overflow-hidden flex flex-col !p-0`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => setAwalX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (awalX === null) return;
          const dx = e.changedTouches[0].clientX - awalX;
          if (dx < -50 && i < daftar.length - 1) onGanti(daftar[i + 1].id);
          if (dx > 50 && i > 0) onGanti(daftar[i - 1].id);
          setAwalX(null);
        }}
        role="dialog"
        aria-label={`Detail skin ${skin.name}`}
      >
        <LatarSkin skin={skin} tinggi={260} ukuranMonyet={190} pose={pose} className="shrink-0">
          <button onClick={onTutup} className="absolute top-2 right-2 btn-ikon bg-black/60 text-white" aria-label="Tutup"><X size={18} /></button>
          {i > 0 && <button onClick={() => onGanti(daftar[i - 1].id)} className="absolute left-2 top-1/2 -translate-y-1/2 btn-ikon bg-black/60 text-white" aria-label="Skin sebelumnya"><ChevronLeft size={18} /></button>}
          {i >= 0 && i < daftar.length - 1 && <button onClick={() => onGanti(daftar[i + 1].id)} className="absolute right-2 top-1/2 -translate-y-1/2 btn-ikon bg-black/60 text-white" aria-label="Skin berikutnya"><ChevronRight size={18} /></button>}
          <span className={`absolute top-2 left-2 chip-retro bg-black/70 ${t.garis} ${t.teks}`}>{skin.prestasi ? '🏆' : '★'.repeat(skin.tier)} {t.label}</span>
        </LatarSkin>

        <div className="p-4 overflow-auto custom-scrollbar space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-title text-[15px] sm:text-[18px] text-white">{skin.name}</h2>
            <span className={`text-[12px] uppercase ${t.teks}`}>{TIER_TAMBAHAN[skin.tier]}</span>
            {pemilik && (
              <span className="text-[12px] text-zinc-400 flex items-center gap-1 ml-auto"><Users size={12} /> Dimiliki {n} dari {pemilik.anggota} anggota</span>
            )}
          </div>
          <p className="text-[13px] text-zinc-300">{skin.description}</p>

          {skin.sejarah && (
            <div className="bg-black/50 border-2 border-white/15 p-3">
              <p className="text-[11px] uppercase font-bold text-amber-300 flex items-center gap-1.5 mb-1"><BookOpen size={13} /> Sejarah</p>
              <p className="text-[13px] text-zinc-100 leading-relaxed">{skin.sejarah}</p>
            </div>
          )}
          {skin.filosofi && (
            <div className="bg-black/50 border-2 border-white/15 p-3">
              <p className="text-[11px] uppercase font-bold text-lime-300 flex items-center gap-1.5 mb-1"><Lightbulb size={13} /> Filosofi</p>
              <p className="text-[14px] text-white italic leading-relaxed">“{skin.filosofi}”</p>
            </div>
          )}

          {skin.prestasi && (
            <div className="bg-pink-950/30 border-2 border-pink-500/50 p-3">
              <p className="text-[11px] uppercase font-bold text-pink-300 flex items-center gap-1.5 mb-1"><Trophy size={13} /> Syarat prestasi</p>
              <p className="text-[13px] text-zinc-100">{k?.syarat ?? 'Memuat…'}</p>
              {k && (
                <>
                  <div className="h-3 bg-black border-2 border-pink-400/60 mt-2"><div className="h-full bg-pink-500" style={{ width: `${Math.min(100, (k.nilai / k.target) * 100)}%` }} /></div>
                  <p className="text-[12px] text-pink-200 mt-1">
                    {k.didapat_pada ? `Terbuka ${new Date(k.didapat_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : `${Math.min(k.nilai, k.target)} / ${k.target} ${k.satuan}`}
                  </p>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {milik ? (
              <button onClick={() => onEquip(skin.id)} disabled={aktif} className={`btn-retro flex-1 ${aktif ? 'bg-zinc-700' : 'bg-blue-600'}`}>
                {aktif ? <><CheckCircle2 size={14} /> Sedang dipakai · foto profil bawaan</> : <><Sparkles size={14} /> Pakai & jadikan foto profil</>}
              </button>
            ) : skin.prestasi ? (
              <div className="flex-1 text-center text-[12px] text-zinc-400 border-2 border-white/10 py-2"><Lock size={12} className="inline mr-1" /> Terbuka sendiri saat syarat tercapai</div>
            ) : (
              <button onClick={() => onBuy(skin.id)} disabled={saldo < skin.cost} className={`btn-retro flex-1 ${saldo >= skin.cost ? 'bg-emerald-600' : 'bg-zinc-800 grayscale'}`}>
                <Star size={14} /> {skin.cost === 0 ? 'Ambil gratis' : saldo >= skin.cost ? `Beli ${skin.cost.toLocaleString('id-ID')} XP` : `Kurang ${(skin.cost - saldo).toLocaleString('id-ID')} XP`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
