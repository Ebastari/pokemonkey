/**
 * Export PDF langsung dari lembar dokumen di layar — tanpa dialog cetak, karena
 * WebView Android di APK tidak mendukung window.print().
 *
 * Cara kerja:
 *   1. Lembar diberi kelas `mode-ekspor-pdf` (lebar tetap 170 mm, tombol layar
 *      disembunyikan) supaya tata letaknya sama di HP maupun komputer.
 *   2. Tiap `<section data-halaman>` digambar ke kanvas (html-to-image).
 *   3. Bagian yang lebih tinggi dari satu halaman dipotong di baris putih
 *      terdekat (tidak memotong tulisan); halaman lanjutan diberi kop lagi.
 *   4. Halaman A4 200 dpi disimpan sebagai JPEG lalu dirangkai menjadi PDF.
 */

import { simpanBerkas } from './unduh';

const DPI = 200;
const MM = DPI / 25.4;
const A4 = { lebar: Math.round(210 * MM), tinggi: Math.round(297 * MM) };
/** Margin seperti dokumen Word contoh. */
const TEPI = { kiri: Math.round(22 * MM), kanan: Math.round(18 * MM), atas: Math.round(12 * MM), bawah: Math.round(14 * MM) };
const LEBAR_ISI = A4.lebar - TEPI.kiri - TEPI.kanan;
const TINGGI_ISI = A4.tinggi - TEPI.atas - TEPI.bawah;

const tungguBingkai = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/** Tunggu semua gambar di dalam lembar selesai dimuat (kop, tanda tangan, foto). */
async function tungguGambar(el: HTMLElement) {
  await Promise.all(
    Array.from(el.querySelectorAll('img')).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); }),
    ),
  );
}

/** Baris kanvas yang seluruhnya (hampir) putih. */
function barisPutih(data: Uint8ClampedArray, lebar: number, baris: number): boolean {
  const awal = baris * lebar * 4;
  for (let i = awal; i < awal + lebar * 4; i += 4) {
    if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) return false;
  }
  return true;
}

/** Cari baris putih terdekat di atas `batas` (maks. `jangkau` baris) untuk memotong halaman. */
function titikPotong(c: HTMLCanvasElement, batas: number, jangkau: number, minimal: number): number {
  const g = c.getContext('2d');
  const dari = Math.max(minimal + 1, batas - jangkau);
  if (!g || batas <= dari) return batas;
  const { data } = g.getImageData(0, dari, c.width, batas - dari);
  for (let y = batas - dari - 1; y >= 0; y--) {
    if (barisPutih(data, c.width, y)) return dari + y + 1;
  }
  return batas;
}

/** Lewati baris putih di awal potongan agar halaman lanjutan tidak diawali ruang kosong. */
function lewatiPutih(c: HTMLCanvasElement, y: number): number {
  const g = c.getContext('2d');
  if (!g) return y;
  const sampai = Math.min(c.height, y + Math.round(40 * MM));
  if (sampai <= y) return y;
  const { data } = g.getImageData(0, y, c.width, sampai - y);
  let n = 0;
  while (n < sampai - y && barisPutih(data, c.width, n)) n++;
  return y + n;
}

function halamanKosong(): { kanvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const kanvas = document.createElement('canvas');
  kanvas.width = A4.lebar;
  kanvas.height = A4.tinggi;
  const g = kanvas.getContext('2d');
  if (!g) throw new Error('Kanvas tidak tersedia di perangkat ini');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, A4.lebar, A4.tinggi);
  return { kanvas, g };
}

/** Bagi satu bagian menjadi halaman A4; halaman lanjutan diberi kop di atasnya. */
function paginasi(bagian: HTMLCanvasElement, kop: HTMLCanvasElement | null, jarakKop: number): HTMLCanvasElement[] {
  const hasil: HTMLCanvasElement[] = [];
  let y = 0;
  let pertama = true;
  while (y < bagian.height - 2) {
    const tinggiKop = !pertama && kop ? kop.height + jarakKop : 0;
    const ruang = TINGGI_ISI - tinggiKop;
    const sisa = bagian.height - y;
    const potong = sisa <= ruang ? bagian.height : titikPotong(bagian, y + ruang, Math.round(ruang * 0.35), y);
    const { kanvas, g } = halamanKosong();
    if (tinggiKop && kop) g.drawImage(kop, TEPI.kiri, TEPI.atas);
    g.drawImage(bagian, 0, y, bagian.width, potong - y, TEPI.kiri, TEPI.atas + tinggiKop, bagian.width, potong - y);
    hasil.push(kanvas);
    y = lewatiPutih(bagian, potong);
    pertama = false;
  }
  return hasil;
}

async function keJpeg(c: HTMLCanvasElement): Promise<{ data: Uint8Array; lebar: number; tinggi: number }> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
  if (!blob) throw new Error('Gagal menyusun halaman PDF');
  return { data: new Uint8Array(await blob.arrayBuffer()), lebar: c.width, tinggi: c.height };
}

/** Rangkai halaman JPEG (satu gambar penuh per halaman A4) menjadi berkas PDF. */
export function pdfDariJpeg(halaman: { data: Uint8Array; lebar: number; tinggi: number }[]): Blob {
  const enc = new TextEncoder();
  const bagian: Uint8Array[] = [];
  const offset: number[] = [];
  let panjang = 0;
  const tulis = (x: string | Uint8Array) => {
    const b = typeof x === 'string' ? enc.encode(x) : x;
    bagian.push(b);
    panjang += b.length;
  };
  const objek = (n: number) => { offset[n] = panjang; tulis(`${n} 0 obj\n`); };
  const W = 595.28, H = 841.89;

  tulis('%PDF-1.4\n%âãÏÓ\n');
  objek(1); tulis('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  objek(2); tulis(`<< /Type /Pages /Count ${halaman.length} /Kids [${halaman.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>\nendobj\n`);
  halaman.forEach((h, i) => {
    const hal = 3 + i * 3, isi = hal + 1, gbr = hal + 2;
    objek(hal);
    tulis(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${gbr} 0 R >> >> /Contents ${isi} 0 R >>\nendobj\n`);
    const perintah = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
    objek(isi); tulis(`<< /Length ${perintah.length} >>\nstream\n${perintah}\nendstream\nendobj\n`);
    objek(gbr);
    tulis(`<< /Type /XObject /Subtype /Image /Width ${h.lebar} /Height ${h.tinggi} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${h.data.length} >>\nstream\n`);
    tulis(h.data);
    tulis('\nendstream\nendobj\n');
  });
  const jumlah = 3 + halaman.length * 3;
  const xref = panjang;
  tulis(`xref\n0 ${jumlah}\n0000000000 65535 f \n`);
  for (let n = 1; n < jumlah; n++) tulis(`${String(offset[n]).padStart(10, '0')} 00000 n \n`);
  tulis(`trailer\n<< /Size ${jumlah} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(bagian as BlobPart[], { type: 'application/pdf' });
}

/**
 * Export lembar dokumen menjadi PDF A4 lalu simpan/bagikan.
 * `dok` berisi `section[data-halaman]` (yang kosong diberi `data-kosong="1"`)
 * dan satu elemen `[data-kop]` untuk kop halaman lanjutan.
 */
export async function eksporLembarPdf(dok: HTMLElement, nama: string, judul: string): Promise<'dibagikan' | 'diunduh'> {
  return simpanBerkas(await buatPdfLembar(dok), nama, judul);
}

/** Lembar dokumen → Blob PDF A4 (tanpa menyimpan), untuk diunggah ke arsip. */
export async function buatPdfLembar(dok: HTMLElement): Promise<Blob> {
  const { toCanvas } = await import('html-to-image');
  const halaman: HTMLCanvasElement[] = [];
  dok.classList.add('mode-ekspor-pdf');
  try {
    await tungguBingkai();
    await tungguGambar(dok);
    const rasio = LEBAR_ISI / dok.clientWidth;
    const opsi = {
      pixelRatio: rasio,
      backgroundColor: '#ffffff',
      cacheBust: true,
      filter: (n: Node) => !(n instanceof HTMLElement && (n.classList.contains('no-print') || n.dataset.tanpaGambar !== undefined)),
    };
    const kopEl = dok.querySelector<HTMLElement>('[data-kop]');
    const kop = kopEl ? await toCanvas(kopEl, { ...opsi, width: kopEl.offsetWidth, height: kopEl.offsetHeight }) : null;
    const jarakKop = kopEl ? Math.round((parseFloat(getComputedStyle(kopEl).marginBottom) || 0) * rasio) : 0;
    const bagian = Array.from(dok.querySelectorAll<HTMLElement>('section[data-halaman]')).filter((b) => b.dataset.kosong !== '1');
    for (const b of bagian) {
      const kanvas = await toCanvas(b, { ...opsi, width: b.offsetWidth, height: b.offsetHeight, style: { margin: '0' } });
      halaman.push(...paginasi(kanvas, kop, jarakKop));
    }
  } finally {
    dok.classList.remove('mode-ekspor-pdf');
  }
  if (!halaman.length) throw new Error('Tidak ada halaman untuk diekspor');
  const jpeg: { data: Uint8Array; lebar: number; tinggi: number }[] = [];
  for (const h of halaman) jpeg.push(await keJpeg(h)); // satu per satu: hemat memori WebView
  return pdfDariJpeg(jpeg);
}
