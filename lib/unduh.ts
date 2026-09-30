/**
 * Simpan berkas ke perangkat — satu pintu untuk browser dan APK.
 *
 * Di browser: `<a download>` biasa (HP memakai lembar bagikan bila tersedia).
 * Di APK, WebView Android mengabaikan unduhan blob dan `window.open`, jadi
 * berkas ditulis ke folder aplikasi (Android/data/<paket>/files/POKEMONKEY,
 * tanpa izin penyimpanan) lalu diserahkan ke lembar bagikan Android: dari
 * sana pemakai memilih "Simpan ke Files", WhatsApp, Excel, dsb.
 * Pola yang sama dengan Smart Nursery (src/utils/nativeShare.ts).
 */

import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { diAplikasi } from './platform';

const keBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Berkas gagal dibaca'));
    r.onload = () => {
      const hasil = String(r.result);
      const koma = hasil.indexOf(',');
      resolve(koma >= 0 ? hasil.slice(koma + 1) : hasil);
    };
    r.readAsDataURL(blob);
  });

/** Nama berkas aman untuk sistem berkas Android. */
const namaAman = (nama: string) => nama.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'berkas';

/**
 * Simpan `blob` sebagai `nama`. Mengembalikan 'dibagikan' bila lembar bagikan
 * terbuka (APK/HP), 'diunduh' bila browser mengunduhnya.
 */
export async function simpanBerkas(blob: Blob, nama: string, judul = nama): Promise<'dibagikan' | 'diunduh'> {
  if (diAplikasi()) {
    const { uri } = await Filesystem.writeFile({
      path: `POKEMONKEY/${namaAman(nama)}`,
      data: await keBase64(blob),
      directory: Directory.External,
      recursive: true,
    });
    try {
      await Share.share({ title: judul, files: [uri], dialogTitle: 'Simpan atau bagikan berkas' });
    } catch {
      // Lembar bagikan ditutup: berkas sudah tersimpan di folder aplikasi, bukan kegagalan.
    }
    return 'dibagikan';
  }

  // Lembar bagikan hanya di layar sentuh; di komputer langsung unduh.
  const sentuh = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const berkas = new File([blob], nama, { type: blob.type });
  if (sentuh && typeof navigator.canShare === 'function' && navigator.canShare({ files: [berkas] })) {
    try {
      await navigator.share({ files: [berkas], title: judul });
      return 'dibagikan';
    } catch { /* dibatalkan: jatuh ke unduhan */ }
  }

  unduhLewatBrowser(blob, nama);
  return 'diunduh';
}

function unduhLewatBrowser(blob: Blob, nama: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Bagikan `blob` lewat lembar bagikan perangkat (pemakai memilih WhatsApp, dsb.).
 * Di APK dan di browser yang mendukung berbagi berkas hasilnya 'dibagikan'
 * ('dibatalkan' bila lembarnya ditutup); selain itu berkas diunduh ('diunduh')
 * untuk dilampirkan sendiri.
 */
export async function bagikanBerkas(blob: Blob, nama: string, judul = nama, teks?: string): Promise<'dibagikan' | 'diunduh' | 'dibatalkan'> {
  if (diAplikasi()) {
    const { uri } = await Filesystem.writeFile({
      path: `POKEMONKEY/${namaAman(nama)}`,
      data: await keBase64(blob),
      directory: Directory.External,
      recursive: true,
    });
    try {
      await Share.share({ title: judul, text: teks, files: [uri], dialogTitle: 'Bagikan ke WhatsApp' });
      return 'dibagikan';
    } catch {
      return 'dibatalkan';
    }
  }

  const berkas = new File([blob], nama, { type: blob.type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [berkas] })) {
    try {
      await navigator.share({ files: [berkas], title: judul, text: teks });
      return 'dibagikan';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'dibatalkan';
      /* gagal berbagi: jatuh ke unduhan */
    }
  }
  unduhLewatBrowser(blob, nama);
  return 'diunduh';
}
