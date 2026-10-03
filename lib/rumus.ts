/**
 * Rumus matematika (LaTeX) memakai KaTeX keluaran MathML: tanpa berkas CSS/huruf
 * tambahan, digambar langsung oleh peramban/WebView. Pustakanya dimuat saat
 * pertama dibutuhkan agar tidak memperberat pembukaan aplikasi.
 */

import { useEffect, useState } from 'react';

type Katex = typeof import('katex').default;
let katex: Katex | null = null;
let janji: Promise<void> | null = null;

export function muatKatex(): Promise<void> {
  janji ??= import('katex').then((m) => { katex = m.default; }).catch(() => { janji = null; });
  return janji;
}

export const katexSiap = () => katex !== null;

/** HTML (MathML) rumus, atau null bila KaTeX belum dimuat. Rumus salah ketik tampil merah, tidak melempar galat. */
export function rumusHtml(tex: string, blok = false): string | null {
  if (!katex) return null;
  try {
    return katex.renderToString(tex, { output: 'mathml', throwOnError: false, displayMode: blok, strict: 'ignore' });
  } catch {
    return null;
  }
}

/** Komponen yang menampilkan rumus: muat KaTeX sekali, lalu gambar ulang. */
export function useKatex(perlu: boolean): boolean {
  const [siap, setSiap] = useState(katexSiap);
  useEffect(() => {
    if (!perlu || siap) return;
    let hidup = true;
    void muatKatex().then(() => { if (hidup) setSiap(katexSiap()); });
    return () => { hidup = false; };
  }, [perlu, siap]);
  return siap;
}
