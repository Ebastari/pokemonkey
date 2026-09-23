import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';
import type { Skin } from '../types';
import { susunMonyet, gambarMonyetKanvas, LEBAR, TINGGI, type Lapisan } from '../lib/pixel';
import { mintaLayarPenuh, keluarLayarPenuh } from '../lib/platform';

/**
 * MONKEY RUN — pelari tanpa akhir, layar penuh, tanpa tombol di layar.
 *
 * Sentuh: ketuk di mana saja = lompat; tahan sepertiga bawah layar (atau geser
 * ke bawah) = merunduk, dan bila sedang di udara membuat monyet cepat turun.
 * Keyboard: Spasi / ↑ = lompat, ↓ = merunduk, Esc = keluar.
 *
 * Semua ukuran dihitung dari layar: sprite, rintangan, gravitasi, dan
 * kecepatan ikut satu faktor skala, sehingga lompatan yang bisa melewati
 * rintangan di komputer juga bisa di HP potret.
 */

const KUNCI_TERBAIK = 'pokemonkey_run_terbaik';
const GRAVITASI = 2500;
const LOMPAT = -840;
const JEDA_ULANG_MS = 600;
const BATAS_BAWAH = 0.7; // sentuhan di bawah garis ini = merunduk

type TipeRintangan = 'batang' | 'tunggul' | 'lebah' | 'batu';
type Fase = 'siap' | 'main' | 'jeda' | 'mati';

interface Rintangan { x: number; w: number; h: number; tipe: TipeRintangan; yOff: number }
interface Pisang { x: number; naik: number }
interface Partikel { x: number; y: number; vx: number; vy: number; umur: number; warna: string }

interface Dunia {
  fase: Fase;
  matiPada: number;
  kecepatan: number;
  jarak: number;
  skor: number;
  pisangN: number;
  xp: number;
  y: number;
  vy: number;
  diTanah: boolean;
  merunduk: boolean;
  frame: number;
  frameT: number;
  rintangan: Rintangan[];
  pisang: Pisang[];
  partikel: Partikel[];
  spawnT: number;
  pisangT: number;
  guncang: number;
}

const acak = (a: number, b: number) => a + Math.random() * (b - a);

const duniaBaru = (fase: Fase = 'siap'): Dunia => ({
  fase, matiPada: 0, kecepatan: 0, jarak: 0, skor: 0, pisangN: 0, xp: 0,
  y: 0, vy: 0, diTanah: true, merunduk: false, frame: 0, frameT: 0,
  rintangan: [], pisang: [], partikel: [], spawnT: 1.6, pisangT: 2.5, guncang: 0,
});

/** Skala piksel sprite: dibatasi tinggi DAN lebar layar supaya HP potret tetap punya waktu bereaksi. */
const skalaDari = (w: number, h: number) => Math.max(1.6, Math.min(4, h / 170, w / 140));
const xMonyetDari = (w: number) => Math.max(36, w * 0.12);
const tanahDari = (h: number) => Math.round(h * 0.82);

const BINTANG = Array.from({ length: 50 }, (_, i) => ({ x: ((i * 97) % 1000) / 1000, y: (((i * 61) % 100) / 100) * 0.6, b: (i % 3) + 1 }));

function campur(a: string, b: string, t: number): string {
  const p = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`;
}

function langit(fase: number): { atas: string; bawah: string; malam: number } {
  const stop: [number, string, string][] = [
    [0, '#5cb8f0', '#bfe7ff'], [0.42, '#5cb8f0', '#bfe7ff'], [0.55, '#f0803c', '#ffd27a'],
    [0.66, '#0b1026', '#1e2a5a'], [0.88, '#0b1026', '#1e2a5a'], [1, '#5cb8f0', '#bfe7ff'],
  ];
  let i = 0;
  while (i < stop.length - 2 && fase > stop[i + 1][0]) i++;
  const t = (fase - stop[i][0]) / (stop[i + 1][0] - stop[i][0]);
  const malam = fase > 0.6 && fase < 0.92 ? 1 : fase >= 0.55 && fase <= 0.6 ? (fase - 0.55) / 0.05 : fase >= 0.92 ? 1 - (fase - 0.92) / 0.08 : 0;
  return { atas: campur(stop[i][1], stop[i + 1][1], t), bawah: campur(stop[i][2], stop[i + 1][2], t), malam };
}

interface Props {
  skin: Skin;
  onGainXP: (xp: number) => void;
  onKeluar: () => void;
}

export const MonkeyRun: React.FC<Props> = ({ skin, onGainXP, onKeluar }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dunia = useRef<Dunia>(duniaBaru());
  const ukuranRef = useRef({ w: 800, h: 600 });
  const rafRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const sentuhRef = useRef<{ id: number; y0: number } | null>(null);
  const terbaikRef = useRef(0);
  const xpRef = useRef(onGainXP);
  xpRef.current = onGainXP;

  const [bisu, setBisu] = useState(false);
  const bisuRef = useRef(bisu);
  bisuRef.current = bisu;

  useEffect(() => {
    try { terbaikRef.current = Number(localStorage.getItem(KUNCI_TERBAIK) || 0); } catch { /* abaikan */ }
  }, []);

  const sprite = useMemo(() => ({
    lari: [susunMonyet(skin.colors, skin.aksesori ?? [], 'jalan', 0), susunMonyet(skin.colors, skin.aksesori ?? [], 'jalan', 1)],
    lompat: susunMonyet(skin.colors, skin.aksesori ?? [], 'lompat', 0),
    merunduk: susunMonyet(skin.colors, skin.aksesori ?? [], 'merunduk', 0),
  }), [skin]);
  const spriteRef = useRef(sprite);
  spriteRef.current = sprite;

  // ---------- Suara ----------
  const bunyi = useCallback((f: number, durasi = 0.08, tipe: OscillatorType = 'square', geser?: number) => {
    if (bisuRef.current) return;
    try {
      const ctx = audioRef.current ?? (audioRef.current = new AudioContext());
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t = ctx.currentTime;
      o.type = tipe;
      o.frequency.setValueAtTime(f, t);
      if (geser) o.frequency.linearRampToValueAtTime(geser, t + durasi);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + durasi);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + durasi);
    } catch { /* audio diblokir */ }
  }, []);

  // ---------- Aksi ----------
  const mulai = useCallback(() => {
    const { w, h } = ukuranRef.current;
    const k = skalaDari(w, h) / 2.4;
    dunia.current = { ...duniaBaru('main'), kecepatan: 260 * k };
    bunyi(660, 0.1, 'square', 990);
    mintaLayarPenuh();
  }, [bunyi]);

  const lompat = useCallback(() => {
    const d = dunia.current;
    if (d.fase !== 'main' || !d.diTanah) return;
    const { w, h } = ukuranRef.current;
    const k = skalaDari(w, h) / 2.4;
    d.vy = LOMPAT * k;
    d.diTanah = false;
    bunyi(440, 0.12, 'square', 880);
  }, [bunyi]);

  const setMerunduk = useCallback((v: boolean) => { dunia.current.merunduk = v; }, []);

  /** Satu tindakan "utama" — ketuk atau Spasi — yang artinya bergantung fase. */
  const tindakanUtama = useCallback(() => {
    const d = dunia.current;
    if (d.fase === 'siap') mulai();
    else if (d.fase === 'jeda') d.fase = 'main';
    else if (d.fase === 'mati') { if (performance.now() - d.matiPada > JEDA_ULANG_MS) mulai(); }
    else lompat();
  }, [lompat, mulai]);

  const keluar = useCallback(() => {
    keluarLayarPenuh();
    onKeluar();
  }, [onKeluar]);

  const berakhir = useCallback(() => {
    const d = dunia.current;
    d.fase = 'mati';
    d.matiPada = performance.now();
    d.guncang = 0.45;
    d.merunduk = false;
    d.xp = Math.floor(d.skor / 4);
    if (d.xp > 0) xpRef.current(d.xp);
    if (d.skor > terbaikRef.current) {
      terbaikRef.current = d.skor;
      try { localStorage.setItem(KUNCI_TERBAIK, String(d.skor)); } catch { /* abaikan */ }
    }
    bunyi(140, 0.4, 'sawtooth', 60);
  }, [bunyi]);

  // ---------- Ukuran kanvas mengikuti layar ----------
  useEffect(() => {
    const c = canvasRef.current;
    const wrap = wrapRef.current;
    if (!c || !wrap) return;
    const atur = () => {
      const w = Math.max(240, wrap.clientWidth);
      const h = Math.max(200, wrap.clientHeight);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      ukuranRef.current = { w, h };
    };
    atur();
    const ro = new ResizeObserver(atur);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // ---------- Jeda saat aplikasi ditinggal ----------
  useEffect(() => {
    const tangani = () => { if (document.hidden && dunia.current.fase === 'main') dunia.current.fase = 'jeda'; };
    document.addEventListener('visibilitychange', tangani);
    return () => document.removeEventListener('visibilitychange', tangani);
  }, []);

  // ---------- Keyboard ----------
  useEffect(() => {
    const turun = (e: KeyboardEvent) => {
      const spasi = e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar';
      if (spasi || e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();
      if (e.key === 'Escape') { keluar(); return; }
      if (spasi || e.key === 'ArrowUp' || e.key === 'w') { if (!e.repeat) tindakanUtama(); }
      if (e.key === 'ArrowDown' || e.key === 's') setMerunduk(true);
    };
    const naik = (e: KeyboardEvent) => { if (e.key === 'ArrowDown' || e.key === 's') setMerunduk(false); };
    window.addEventListener('keydown', turun);
    window.addEventListener('keyup', naik);
    return () => { window.removeEventListener('keydown', turun); window.removeEventListener('keyup', naik); };
  }, [keluar, setMerunduk, tindakanUtama]);

  // ---------- Loop ----------
  useEffect(() => {
    let terakhir = performance.now();

    const spawnRintangan = (d: Dunia, w: number, k: number) => {
      const buat = (tipe: TipeRintangan, x: number): Rintangan =>
        tipe === 'batang' ? { x, w: (Math.random() < 0.35 && d.skor > 600 ? 66 : 36) * k, h: 22 * k, tipe, yOff: 0 }
          : tipe === 'tunggul' ? { x, w: 24 * k, h: 40 * k, tipe, yOff: 0 }
            : tipe === 'lebah' ? { x, w: 28 * k, h: 18 * k, tipe, yOff: 40 * k }
              : { x, w: 26 * k, h: 16 * k, tipe, yOff: 0 };
      const r = Math.random();
      const tipe: TipeRintangan = r < 0.4 ? 'batang' : r < 0.62 ? 'tunggul' : r < 0.83 ? 'lebah' : 'batu';
      const pertama = buat(tipe, w + 20 * k);
      d.rintangan.push(pertama);
      if (d.skor > 1500 && Math.random() < 0.35) {
        d.rintangan.push(buat(tipe === 'lebah' ? 'batang' : 'lebah', pertama.x + pertama.w + acak(90, 150) * k));
      }
    };

    const update = (dt: number) => {
      const d = dunia.current;
      const { w, h } = ukuranRef.current;
      const s = skalaDari(w, h);
      const k = s / 2.4;
      const tanahY = tanahDari(h);
      const xM = xMonyetDari(w);

      d.frameT += dt;
      const jedaFrame = d.fase === 'main' ? Math.max(0.06, 0.16 - d.kecepatan / k / 6000) : 0.18;
      if (d.frameT > jedaFrame) { d.frame++; d.frameT = 0; }
      if (d.guncang > 0) d.guncang = Math.max(0, d.guncang - dt);
      d.partikel = d.partikel.filter((p) => { p.umur -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * k * dt; return p.umur > 0; });
      if (d.fase !== 'main') return;

      d.kecepatan = Math.min(680 * k, d.kecepatan + 9 * k * dt);
      d.jarak += (d.kecepatan / k) * dt;

      // Menahan merunduk di udara = jatuh cepat.
      d.vy += GRAVITASI * k * dt * (d.merunduk && !d.diTanah ? 2.4 : 1);
      d.y += d.vy * dt;
      if (d.y >= 0) { d.y = 0; d.vy = 0; d.diTanah = true; }

      d.spawnT -= dt;
      if (d.spawnT <= 0) { spawnRintangan(d, w, k); d.spawnT = acak(0.95, 1.8) * ((400 * k) / d.kecepatan) + 0.4; }
      d.pisangT -= dt;
      if (d.pisangT <= 0) {
        const n = 3 + Math.floor(Math.random() * 3);
        const tinggi = acak(60, 150) * k;
        for (let i = 0; i < n; i++) d.pisang.push({ x: w + 30 * k + i * 30 * k, naik: tinggi + Math.sin((i / (n - 1)) * Math.PI) * 30 * k });
        d.pisangT = acak(2.5, 5);
      }

      for (const r of d.rintangan) r.x -= d.kecepatan * dt;
      for (const p of d.pisang) p.x -= d.kecepatan * dt;
      d.rintangan = d.rintangan.filter((r) => r.x + r.w > -20);
      d.pisang = d.pisang.filter((p) => p.x > -20);

      const tinggiKotak = d.merunduk && d.diTanah ? TINGGI * s * 0.52 : TINGGI * s - 14 * k;
      const kx = xM + 10 * k;
      const kw = LEBAR * s - 22 * k;
      const kyBawah = tanahY + d.y;
      const kyAtas = kyBawah - tinggiKotak;

      for (const r of d.rintangan) {
        const rAtas = tanahY - r.yOff - r.h;
        const rBawah = tanahY - r.yOff;
        if (kx < r.x + r.w - 4 * k && kx + kw > r.x + 4 * k && kyAtas < rBawah - 3 * k && kyBawah > rAtas + 3 * k) { berakhir(); return; }
      }

      d.pisang = d.pisang.filter((p) => {
        const py = tanahY - p.naik;
        const kena = p.x > kx - 8 * k && p.x < kx + kw + 8 * k && py > kyAtas - 8 * k && py < kyBawah + 8 * k;
        if (kena) {
          d.pisangN++;
          bunyi(1046, 0.07, 'square', 1318);
          for (let i = 0; i < 6; i++) d.partikel.push({ x: p.x, y: py, vx: acak(-120, 120) * k, vy: acak(-220, -40) * k, umur: 0.5, warna: i % 2 ? '#fde047' : '#ffffff' });
        }
        return !kena;
      });

      d.skor = Math.floor(d.jarak / 12) + d.pisangN * 10;
    };

    const teks = (ctx: CanvasRenderingContext2D, t: string, x: number, y: number, ukuran: number, warna = '#ffffff', huruf: 'judul' | 'isi' = 'judul', rata: CanvasTextAlign = 'center') => {
      ctx.font = huruf === 'judul' ? `${Math.round(ukuran)}px "Press Start 2P", monospace` : `700 ${Math.round(ukuran)}px "Pixelify Sans", system-ui, sans-serif`;
      ctx.textAlign = rata;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000000';
      ctx.fillText(t, x + Math.max(2, ukuran / 8), y + Math.max(2, ukuran / 8));
      ctx.fillStyle = warna;
      ctx.fillText(t, x, y);
    };

    const panel = (ctx: CanvasRenderingContext2D, cx: number, cy: number, lebar: number, tinggi: number) => {
      const x = Math.round(cx - lebar / 2);
      const y = Math.round(cy - tinggi / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(x, y, lebar, tinggi);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, lebar, 4); ctx.fillRect(x, y + tinggi - 4, lebar, 4);
      ctx.fillRect(x, y, 4, tinggi); ctx.fillRect(x + lebar - 4, y, 4, tinggi);
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 6, y + tinggi, lebar, 6); ctx.fillRect(x + lebar, y + 6, 6, tinggi);
    };

    const gambar = () => {
      const c = canvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const d = dunia.current;
      const { w, h } = ukuranRef.current;
      const s = skalaDari(w, h);
      const k = s / 2.4;
      const tanahY = tanahDari(h);
      const xM = xMonyetDari(w);
      const faseHari = (d.jarak % 9000) / 9000;
      const L = langit(faseHari);

      ctx.save();
      if (d.guncang > 0) ctx.translate(acak(-6, 6) * d.guncang, acak(-5, 5) * d.guncang);

      const grad = ctx.createLinearGradient(0, 0, 0, tanahY);
      grad.addColorStop(0, L.atas);
      grad.addColorStop(1, L.bawah);
      ctx.fillStyle = grad;
      ctx.fillRect(-10, -10, w + 20, h + 20);

      if (L.malam > 0) {
        ctx.fillStyle = `rgba(255,255,255,${0.9 * L.malam})`;
        for (const b of BINTANG) ctx.fillRect(Math.floor(b.x * w), Math.floor(b.y * tanahY), b.b, b.b);
      }

      const sx = w * 0.8;
      const sy = h * 0.14 + Math.sin(faseHari * Math.PI * 2) * 12 * k;
      const r = 12 * k;
      ctx.fillStyle = L.malam > 0.5 ? '#f1f5f9' : '#fde68a';
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
      ctx.fillRect(sx - r * 1.35, sy - r * 0.65, r * 2.7, r * 1.3);
      ctx.fillRect(sx - r * 0.65, sy - r * 1.35, r * 1.3, r * 2.7);

      const bukit = (geser: number, warna: string, tinggi: number) => {
        ctx.fillStyle = warna;
        ctx.beginPath();
        ctx.moveTo(0, tanahY);
        for (let x = 0; x <= w + 8; x += 8) {
          ctx.lineTo(x, tanahY - tinggi * (0.55 + 0.45 * Math.sin((x + geser) / (90 * k))) * (0.7 + 0.3 * Math.sin((x + geser) / (37 * k))));
        }
        ctx.lineTo(w, tanahY);
        ctx.closePath();
        ctx.fill();
      };
      bukit(d.jarak * 0.12 * k, campur('#1f6b3a', '#0c2b1a', L.malam), 70 * k);
      bukit(d.jarak * 0.28 * k + 300, campur('#2f8f4a', '#123a22', L.malam), 45 * k);

      const jarakPohon = 96 * k;
      const geserPohon = (d.jarak * 0.5 * k) % jarakPohon;
      for (let x = -geserPohon - jarakPohon; x < w + jarakPohon; x += jarakPohon) {
        const t = Math.floor((x + d.jarak * 0.5 * k) / jarakPohon);
        const tinggi = (40 + (Math.abs(t) % 3) * 12) * k;
        ctx.fillStyle = campur('#5b3a1a', '#2a1a0b', L.malam);
        ctx.fillRect(x + 10 * k, tanahY - tinggi, 8 * k, tinggi);
        ctx.fillStyle = campur('#3f9d4a', '#17402a', L.malam);
        ctx.fillRect(x, tanahY - tinggi - 6 * k, 28 * k, 14 * k);
        ctx.fillRect(x + 4 * k, tanahY - tinggi - 18 * k, 20 * k, 14 * k);
        ctx.fillRect(x + 9 * k, tanahY - tinggi - 26 * k, 10 * k, 10 * k);
      }

      ctx.fillStyle = campur('#4ade80', '#1d5f36', L.malam);
      ctx.fillRect(0, tanahY, w, 6 * k);
      ctx.fillStyle = campur('#6b4a24', '#2e2011', L.malam);
      ctx.fillRect(0, tanahY + 6 * k, w, h - tanahY);
      ctx.fillStyle = campur('#8a6430', '#3b2a16', L.malam);
      const geserTanah = (d.jarak * k) % (40 * k);
      for (let x = -geserTanah; x < w; x += 40 * k) {
        ctx.fillRect(x, tanahY + 14 * k, 12 * k, 3 * k);
        ctx.fillRect(x + 22 * k, tanahY + 26 * k, 8 * k, 3 * k);
      }

      for (const ob of d.rintangan) {
        const y = tanahY - ob.yOff - ob.h;
        if (ob.tipe === 'batang') {
          ctx.fillStyle = '#7c4a1e'; ctx.fillRect(ob.x, y, ob.w, ob.h);
          ctx.fillStyle = '#5a3312'; ctx.fillRect(ob.x, y + ob.h - 6 * k, ob.w, 6 * k); ctx.fillRect(ob.x + 8 * k, y + 4 * k, 4 * k, ob.h - 10 * k);
          ctx.fillStyle = '#c9925a'; ctx.fillRect(ob.x + ob.w - 8 * k, y + 3 * k, 5 * k, ob.h - 6 * k);
        } else if (ob.tipe === 'tunggul') {
          ctx.fillStyle = '#6b4423'; ctx.fillRect(ob.x, y, ob.w, ob.h);
          ctx.fillStyle = '#4a2c12'; ctx.fillRect(ob.x + 4 * k, y + 8 * k, 4 * k, ob.h - 8 * k); ctx.fillRect(ob.x + ob.w - 8 * k, y + 12 * k, 4 * k, ob.h - 12 * k);
          ctx.fillStyle = '#d8b382'; ctx.fillRect(ob.x - 3 * k, y, ob.w + 6 * k, 5 * k);
        } else if (ob.tipe === 'lebah') {
          const sayap = d.frame % 2;
          ctx.fillStyle = '#facc15'; ctx.fillRect(ob.x + 4 * k, y + 4 * k, ob.w - 8 * k, ob.h - 6 * k);
          ctx.fillStyle = '#111827'; ctx.fillRect(ob.x + 9 * k, y + 4 * k, 4 * k, ob.h - 6 * k); ctx.fillRect(ob.x + 17 * k, y + 4 * k, 4 * k, ob.h - 6 * k); ctx.fillRect(ob.x + ob.w - 4 * k, y + 8 * k, 4 * k, 4 * k);
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(ob.x + 6 * k, y - (4 - sayap * 3) * k, 8 * k, 5 * k); ctx.fillRect(ob.x + 15 * k, y - (4 - sayap * 3) * k, 8 * k, 5 * k);
        } else {
          ctx.fillStyle = '#6b7280'; ctx.fillRect(ob.x, y + 4 * k, ob.w, ob.h - 4 * k); ctx.fillRect(ob.x + 4 * k, y, ob.w - 8 * k, 4 * k);
          ctx.fillStyle = '#9ca3af'; ctx.fillRect(ob.x + 6 * k, y + 3 * k, 6 * k, 4 * k);
        }
      }

      for (const p of d.pisang) {
        const py = tanahY - p.naik;
        ctx.fillStyle = '#facc15';
        ctx.fillRect(p.x - 6 * k, py - 2 * k, 12 * k, 5 * k); ctx.fillRect(p.x - 8 * k, py - 5 * k, 4 * k, 5 * k); ctx.fillRect(p.x + 4 * k, py - 5 * k, 4 * k, 5 * k);
        ctx.fillStyle = '#a16207'; ctx.fillRect(p.x + 6 * k, py - 7 * k, 3 * k, 3 * k);
      }

      const sp = spriteRef.current;
      const lap: Lapisan = !d.diTanah ? sp.lompat : d.merunduk ? sp.merunduk : d.fase === 'main' ? sp.lari[d.frame % 2] : sp.lari[0];
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      const lebarBayang = LEBAR * s * (1 - Math.min(0.5, -d.y / (300 * k)));
      ctx.fillRect(xM + (LEBAR * s - lebarBayang) / 2, tanahY + 2 * k, lebarBayang, 4 * k);
      gambarMonyetKanvas(ctx, lap, xM, tanahY + d.y + 2 * k, s);

      for (const p of d.partikel) { ctx.fillStyle = p.warna; ctx.fillRect(p.x, p.y, 4 * k, 4 * k); }

      if (L.malam > 0) { ctx.fillStyle = `rgba(5,10,30,${0.25 * L.malam})`; ctx.fillRect(0, tanahY - 130 * k, w, h); }
      ctx.restore();

      // ---------- HUD ----------
      const uSkor = Math.max(12, Math.min(22, 11 * k));
      teks(ctx, String(d.skor).padStart(5, '0'), w - 16, Math.max(26, h * 0.05), uSkor, '#ffffff', 'judul', 'right');
      teks(ctx, `HI ${String(terbaikRef.current).padStart(5, '0')}`, w - 16, Math.max(26, h * 0.05) + uSkor * 1.6, uSkor * 0.9, '#e5e7eb', 'isi', 'right');

      const cx = w / 2;
      const cy = h * 0.42;
      const lebarPanel = Math.min(w - 32, 460);
      const uJudul = Math.max(14, Math.min(26, lebarPanel / 16));
      const uIsi = Math.max(14, Math.min(20, lebarPanel / 24));

      if (d.fase === 'siap') {
        panel(ctx, cx, cy, lebarPanel, uJudul * 7.2);
        teks(ctx, 'MONKEY RUN', cx, cy - uJudul * 2.2, uJudul, '#fdba74');
        teks(ctx, 'KETUK / SPASI', cx, cy - uJudul * 0.3, uJudul * 0.62);
        teks(ctx, 'Ketuk layar = lompat', cx, cy + uJudul * 1.3, uIsi, '#e5e7eb', 'isi');
        teks(ctx, 'Tahan layar bawah / ↓ = merunduk', cx, cy + uJudul * 2.4, uIsi, '#e5e7eb', 'isi');
      } else if (d.fase === 'jeda') {
        panel(ctx, cx, cy, lebarPanel, uJudul * 4.6);
        teks(ctx, 'JEDA', cx, cy - uJudul * 0.9, uJudul, '#93c5fd');
        teks(ctx, 'Ketuk / Spasi untuk lanjut', cx, cy + uJudul * 0.9, uIsi, '#e5e7eb', 'isi');
      } else if (d.fase === 'mati') {
        const bolehUlang = performance.now() - d.matiPada > JEDA_ULANG_MS;
        panel(ctx, cx, cy, lebarPanel, uJudul * 8.4);
        teks(ctx, 'GAME OVER', cx, cy - uJudul * 2.8, uJudul, '#fca5a5');
        teks(ctx, d.skor.toLocaleString('id-ID'), cx, cy - uJudul * 0.8, uJudul * 1.3);
        teks(ctx, d.skor > 0 && d.skor >= terbaikRef.current ? 'Rekor baru!' : `Terbaik ${terbaikRef.current.toLocaleString('id-ID')}`, cx, cy + uJudul * 0.9, uIsi, '#e5e7eb', 'isi');
        teks(ctx, `+${d.xp} XP`, cx, cy + uJudul * 2.1, uIsi * 1.1, '#fde047', 'isi');
        if (bolehUlang) teks(ctx, 'Ketuk / Spasi untuk ulang', cx, cy + uJudul * 3.3, uIsi * 0.9, '#d1d5db', 'isi');
      }
    };

    const loop = (t: number) => {
      const dt = Math.min(0.034, (t - terakhir) / 1000);
      terakhir = t;
      update(dt);
      gambar();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [berakhir, bunyi]);

  useEffect(() => () => {
    keluarLayarPenuh();
    // WebView membatasi jumlah AudioContext; yang tidak ditutup menumpuk tiap kali game dibuka.
    audioRef.current?.close().catch(() => undefined);
    audioRef.current = null;
  }, []);

  // ---------- Sentuhan ----------
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const d = dunia.current;
    if (d.fase !== 'main') { tindakanUtama(); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const bawah = (e.clientY - rect.top) / rect.height > BATAS_BAWAH;
    sentuhRef.current = { id: e.pointerId, y0: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    if (bawah) setMerunduk(true);
    else lompat();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = sentuhRef.current;
    if (!s || s.id !== e.pointerId) return;
    if (e.clientY - s.y0 > 24) setMerunduk(true);
  };

  const lepas = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = sentuhRef.current;
    if (!s || s.id !== e.pointerId) return;
    sentuhRef.current = null;
    setMerunduk(false);
  };

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 select-none overflow-hidden bg-black"
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={lepas}
      onPointerCancel={lepas}
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas ref={canvasRef} className="block w-full h-full" style={{ imageRendering: 'pixelated' }} />

      <div className="absolute left-3 flex gap-2" style={{ top: 'max(12px, env(safe-area-inset-top))' }}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={keluar}
          className="btn-ikon !w-9 !h-9 bg-black/45 !border-white/70"
          aria-label="Keluar dari game"
          title="Keluar (Esc)"
        >
          <X size={16} />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setBisu((b) => !b)}
          className="btn-ikon !w-9 !h-9 bg-black/45 !border-white/70"
          aria-label={bisu ? 'Nyalakan suara' : 'Bisukan suara'}
        >
          {bisu ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </div>
  );
};
