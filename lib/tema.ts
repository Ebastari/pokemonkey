/**
 * Mode gelap dan terang.
 *
 * Mode gelap adalah wajah asli aplikasi, tetapi di lapangan layar gelap nyaris
 * tidak terbaca di bawah matahari. Mode terang membalik seluruh permukaan netral
 * lewat satu atribut di elemen html; aturannya ada di bagian akhir index.css.
 *
 * Pilihannya disimpan per perangkat: HP lapangan boleh terang, laptop kantor
 * tetap gelap.
 */

export type Tema = 'gelap' | 'terang';

const KUNCI = 'pokemonkey_tema';
const WARNA_BILAH: Record<Tema, string> = { gelap: '#000000', terang: '#e6eae3' };

export function bacaTema(): Tema {
  try {
    const tersimpan = localStorage.getItem(KUNCI);
    if (tersimpan === 'terang' || tersimpan === 'gelap') return tersimpan;
  } catch {
    /* penyimpanan diblokir — pakai bawaan */
  }
  return 'gelap';
}

/** Pasang tema ke halaman, sekaligus warna bilah status di HP. */
export function pasangTema(tema: Tema): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', WARNA_BILAH[tema]);
  try {
    localStorage.setItem(KUNCI, tema);
  } catch {
    /* berlaku untuk sesi ini saja */
  }
}
