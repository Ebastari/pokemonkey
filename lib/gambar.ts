/**
 * Unduh bagian layar sebagai gambar PNG, sama dengan yang tampil (tema terang/gelap,
 * huruf aplikasi, warna). Dipakai Roster, grafik Roster, dan Memo.
 *
 * - Wadah bergulir di dalam area yang ditandai `data-gambar-lepas` dibuka penuh
 *   selama pemotretan (kelas `.mode-gambar` di index.css), jadi kolom/baris yang
 *   tersembunyi di balik gulir ikut terekam.
 * - Elemen bertanda `data-tanpa-gambar` (tombol, formulir) tidak ikut.
 * - Di atas gambar ditambahkan pita judul + waktu unduh agar gambar bisa dibaca
 *   tanpa konteks (mis. saat dikirim ke WhatsApp).
 */

import { simpanBerkas } from './unduh';
import * as W from './waktu';

interface OpsiGambar {
  /** Nama berkas tanpa ekstensi. */
  nama: string;
  /** Judul di pita atas, mis. "Roster · September 2026". */
  judul: string;
  /** Baris kecil di bawah judul, mis. filter yang aktif. */
  keterangan?: string;
}

/** Warna latar pertama yang tidak transparan, dari elemen ke atas. */
function latarDari(el: HTMLElement): string {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const c = getComputedStyle(n).backgroundColor;
    if (c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
  }
  return getComputedStyle(document.body).backgroundColor || '#0b0d10';
}

const tungguBingkai = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

export async function unduhGambar(el: HTMLElement, opsi: OpsiGambar): Promise<'dibagikan' | 'diunduh'> {
  const { toCanvas } = await import('html-to-image');
  const latar = latarDari(el);
  const warnaTeks = getComputedStyle(el).color || '#ffffff';

  // Wadah bertanda `data-gambar-lebar` (mis. tabel memo) dilebarkan selebar isinya agar bingkainya utuh.
  const dilebarkan = Array.from(el.querySelectorAll<HTMLElement>('[data-gambar-lebar]'));
  const lebarAsli = dilebarkan.map((n) => n.style.width);
  dilebarkan.forEach((n) => { n.style.width = `${n.scrollWidth + n.offsetWidth - n.clientWidth}px`; });
  el.classList.add('mode-gambar');
  let isi: HTMLCanvasElement;
  try {
    await tungguBingkai();
    const w = Math.ceil(el.scrollWidth);
    const h = Math.ceil(el.scrollHeight);
    // Tajam di HP, tapi dibatasi agar kanvas besar (roster 31 hari) tidak melebihi batas memori WebView.
    const rasio = w * h * 4 <= 16_000_000 ? 2 : 1;
    isi = await toCanvas(el, {
      width: w,
      height: h,
      pixelRatio: rasio,
      backgroundColor: latar,
      cacheBust: true,
      style: { width: `${w}px`, height: `${h}px`, margin: '0', overflow: 'visible' },
      filter: (n) => !(n instanceof HTMLElement && n.dataset.tanpaGambar !== undefined),
    });
  } finally {
    el.classList.remove('mode-gambar');
    dilebarkan.forEach((n, i) => { n.style.width = lebarAsli[i]; });
  }

  // Pita judul (huruf aplikasi) di atas hasil tangkapan.
  const r = isi.width / Math.max(1, el.scrollWidth);
  await Promise.all([document.fonts.load(`${12 * r}px "Press Start 2P"`), document.fonts.load(`${13 * r}px "Pixelify Sans"`)]).catch(() => undefined);
  const tepi = Math.round(16 * r);
  const tinggiPita = Math.round((opsi.keterangan ? 58 : 42) * r);
  const kanvas = document.createElement('canvas');
  kanvas.width = isi.width + tepi * 2;
  kanvas.height = isi.height + tinggiPita + tepi * 2;
  const g = kanvas.getContext('2d');
  if (!g) throw new Error('Kanvas tidak tersedia di perangkat ini');
  g.fillStyle = latar;
  g.fillRect(0, 0, kanvas.width, kanvas.height);
  g.fillStyle = warnaTeks;
  g.textBaseline = 'top';
  g.font = `${12 * r}px "Press Start 2P", monospace`;
  g.fillText(opsi.judul.toUpperCase(), tepi, tepi);
  g.font = `${13 * r}px "Pixelify Sans", sans-serif`;
  g.globalAlpha = 0.7;
  const kanan = `POKEMONKEY · ${W.capWaktuWita()}`;
  g.fillText(kanan, kanvas.width - tepi - g.measureText(kanan).width, tepi);
  if (opsi.keterangan) g.fillText(opsi.keterangan, tepi, tepi + 20 * r);
  g.globalAlpha = 1;
  g.drawImage(isi, tepi, tepi + tinggiPita);

  const blob = await new Promise<Blob>((ok, gagal) => kanvas.toBlob((b) => (b ? ok(b) : gagal(new Error('Gambar gagal dibuat'))), 'image/png'));
  return simpanBerkas(blob, `${opsi.nama}.png`, opsi.judul);
}
