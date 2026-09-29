/**
 * Kursor sel ala Excel untuk tabel lebar:
 * - satu sel aktif (bingkai hijau + kotak kecil di pojok), judul kolomnya ikut ditandai;
 * - panah / Tab / Home / End / PageUp / PageDown memindah kursor, tabel ikut bergeser
 *   supaya sel aktif selalu terlihat (tidak tertutup kolom beku dan judul yang dikunci);
 * - Enter membuka baris (onBuka); Esc melepas kursor;
 * - tahan klik kiri lalu seret untuk menggeser tabel; klik pendek tetap memilih sel.
 *   Setelah digeser, tabel berhenti pas di awal kolom (scroll-snap).
 *
 * Sel ditandai dengan atribut `data-sel="baris-kolom"`, kolom beku dengan `data-beku`,
 * judul kolom dengan `data-kol="kolom"`. Wadah (div penggulung) memakai `propsWadah`
 * dan menaruh `<style>{gaya}</style>` di dalamnya.
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface SelTabel { b: number; k: number }

const ELEMEN_ISIAN = 'input, select, textarea, button, a, label, [contenteditable="true"]';
const HIJAU = '#16a34a';
const batas = (n: number, maks: number) => Math.max(0, Math.min(maks, n));

export function useKursorTabel(opsi: {
  id: string;
  jumlahBaris: number;
  jumlahKolom: number;
  kolomBeku?: number;
  onBuka?: (baris: number) => void;
}) {
  const { id, jumlahBaris, jumlahKolom, kolomBeku = 1, onBuka } = opsi;
  const wadahRef = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<SelTabel | null>(null);
  const [menyeret, setMenyeret] = useState(false);
  const [lebarBeku, setLebarBeku] = useState(0);
  const seret = useRef<{ x: number; y: number; kiri: number; atas: number; jalan: boolean } | null>(null);
  const abaikanKlik = useRef(false);

  // Lebar kolom beku = jarak henti kiri saat tabel digeser per kolom.
  useLayoutEffect(() => {
    const w = wadahRef.current;
    if (!w) return;
    const ukur = () => setLebarBeku([...w.querySelectorAll<HTMLElement>('thead tr:first-child [data-beku]')].reduce((n, x) => n + x.offsetWidth, 0));
    ukur();
    const ro = new ResizeObserver(ukur);
    ro.observe(w);
    return () => ro.disconnect();
    // Diukur ulang saat tabel baru muncul (data selesai dimuat) atau jumlah kolom berubah.
  }, [jumlahKolom, jumlahBaris > 0]);

  /** Geser tabel seperlunya supaya sel tampak penuh di luar kolom beku dan judul kolom. */
  const tampakkan = useCallback((s: SelTabel) => {
    const w = wadahRef.current;
    const el = w?.querySelector<HTMLElement>(`[data-sel="${s.b}-${s.k}"]`);
    if (!w || !el) return;
    const kotak = w.getBoundingClientRect();
    const c = el.getBoundingClientRect();
    // Tepi dalam wadah (tanpa bingkai).
    const x0 = kotak.left + w.clientLeft;
    const y0 = kotak.top + w.clientTop;
    if (s.k <= kolomBeku) {
      // Seperti Home di Excel: kembali ke kolom paling kiri.
      w.scrollLeft = 0;
    } else {
      const kiri = x0 + lebarBeku;
      const kanan = x0 + w.clientWidth;
      if (c.left < kiri) w.scrollLeft -= kiri - c.left;
      else if (c.right > kanan) w.scrollLeft += Math.min(c.right - kanan, c.left - kiri);
    }
    const atas = y0 + (w.querySelector('thead')?.getBoundingClientRect().height ?? 0);
    const bawah = y0 + w.clientHeight;
    if (c.top < atas) w.scrollTop -= atas - c.top;
    else if (c.bottom > bawah) w.scrollTop += Math.min(c.bottom - bawah, c.top - atas);
  }, [kolomBeku, lebarBeku]);

  const pilih = useCallback((b: number, k: number) => {
    if (!jumlahBaris || !jumlahKolom) return;
    setSel({ b: batas(b, jumlahBaris - 1), k: batas(k, jumlahKolom - 1) });
  }, [jumlahBaris, jumlahKolom]);

  // Setiap kursor pindah, tabel langsung digeser mengikutinya (sebelum layar digambar).
  useLayoutEffect(() => { if (sel) tampakkan(sel); }, [sel, tampakkan]);

  // Baris berkurang (disaring): kursor tetap di dalam tabel.
  useEffect(() => {
    setSel((s) => {
      if (!s) return s;
      if (!jumlahBaris || !jumlahKolom) return null;
      return s.b < jumlahBaris && s.k < jumlahKolom ? s : { b: Math.min(s.b, jumlahBaris - 1), k: Math.min(s.k, jumlahKolom - 1) };
    });
  }, [jumlahBaris, jumlahKolom]);

  /** Tombol ◀ ▶: pindah satu kolom. */
  const geser = (arah: -1 | 1) => {
    if (sel) pilih(sel.b, sel.k + arah);
    else pilih(0, arah > 0 ? kolomBeku : 0);
    wadahRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Mengetik di kolom saringan: panah dipakai kolom isian itu sendiri.
    if (e.target !== wadahRef.current && (e.target as Element).closest(ELEMEN_ISIAN)) return;
    if (!jumlahBaris) return;
    let { b, k } = sel ?? { b: 0, k: 0 };
    switch (e.key) {
      case 'ArrowRight': k++; break;
      case 'ArrowLeft': k--; break;
      case 'ArrowDown': b++; break;
      case 'ArrowUp': b--; break;
      case 'Tab':
        k += e.shiftKey ? -1 : 1;
        if (k < 0 || k >= jumlahKolom) return; // ujung baris: fokus keluar tabel seperti biasa
        break;
      case 'Home': k = 0; if (e.ctrlKey) b = 0; break;
      case 'End': k = jumlahKolom - 1; if (e.ctrlKey) b = jumlahBaris - 1; break;
      case 'PageDown': b += 10; break;
      case 'PageUp': b -= 10; break;
      case 'Enter':
        if (sel) { e.preventDefault(); onBuka?.(sel.b); }
        return;
      case 'Escape': setSel(null); return;
      default: return;
    }
    e.preventDefault();
    // Tekanan pertama tanpa kursor: mulai dari sel kiri atas.
    if (!sel) pilih(0, 0);
    else pilih(b, k);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || (e.target as Element).closest(ELEMEN_ISIAN)) return;
    const w = wadahRef.current;
    if (!w) return;
    seret.current = { x: e.clientX, y: e.clientY, kiri: w.scrollLeft, atas: w.scrollTop, jalan: false };
  };

  useEffect(() => {
    const gerak = (e: MouseEvent) => {
      const d = seret.current;
      const w = wadahRef.current;
      if (!d || !w) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.jalan) {
        if (Math.hypot(dx, dy) < 6) return;
        d.jalan = true;
        setMenyeret(true);
        window.getSelection()?.removeAllRanges();
      }
      e.preventDefault();
      w.scrollLeft = d.kiri - dx;
      w.scrollTop = d.atas - dy;
    };
    const lepas = () => {
      const d = seret.current;
      seret.current = null;
      if (!d?.jalan) return;
      setMenyeret(false);
      // Klik yang menyusul akhir seretan tidak memilih sel / membuka baris.
      abaikanKlik.current = true;
      setTimeout(() => { abaikanKlik.current = false; }, 0);
    };
    window.addEventListener('mousemove', gerak);
    window.addEventListener('mouseup', lepas);
    return () => {
      window.removeEventListener('mousemove', gerak);
      window.removeEventListener('mouseup', lepas);
    };
  }, []);

  const onClickCapture = (e: React.MouseEvent) => {
    if (abaikanKlik.current) { e.stopPropagation(); e.preventDefault(); }
  };
  const onClick = (e: React.MouseEvent) => {
    const td = (e.target as Element).closest('[data-sel]');
    if (!td || (e.target as Element).closest(ELEMEN_ISIAN)) return;
    const [b, k] = (td.getAttribute('data-sel') ?? '').split('-').map(Number);
    if (Number.isFinite(b) && Number.isFinite(k)) {
      pilih(b, k);
      wadahRef.current?.focus({ preventScroll: true });
    }
  };

  const s = `#${id}`;
  const gaya = [
    // Titik henti geser = awal tiap kolom yang tidak dibekukan.
    `${s} thead tr:first-child th:not([data-beku]) { scroll-snap-align: start; }`,
    `${s}:focus { outline: none; }`,
    sel && `${s} [data-sel="${sel.b}-${sel.k}"] { outline: 2px solid ${HIJAU}; outline-offset: -2px; }`,
    sel && `${s} [data-sel="${sel.b}-${sel.k}"]:not([data-beku]) { position: relative; }`,
    sel && `${s} [data-sel="${sel.b}-${sel.k}"]::after { content: ''; position: absolute; right: -1px; bottom: -1px; width: 7px; height: 7px; background: ${HIJAU}; border: 1px solid #fff; z-index: 2; }`,
    sel && `${s} thead [data-kol="${sel.k}"] { box-shadow: inset 0 -3px 0 ${HIJAU}; }`,
    sel && `${s} [data-sel^="${sel.b}-"] { box-shadow: inset 0 1px 0 ${HIJAU}55, inset 0 -1px 0 ${HIJAU}55; }`,
  ].filter(Boolean).join('\n');

  const propsWadah = {
    id,
    ref: wadahRef,
    tabIndex: 0,
    onKeyDown,
    onMouseDown,
    onClick,
    onClickCapture,
    style: {
      // Saat diseret, snap dimatikan supaya gerakan mulus; dilepas → berhenti di awal kolom.
      scrollSnapType: menyeret ? 'none' : 'x proximity',
      scrollPaddingLeft: lebarBeku,
      cursor: menyeret ? 'grabbing' : undefined,
      userSelect: menyeret ? 'none' : undefined,
    } as React.CSSProperties,
  };

  return { sel, pilih, geser, propsWadah, gaya };
}
