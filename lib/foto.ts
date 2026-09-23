/**
 * Foto profil anggota. Server hanya menyimpan kunci berkasnya (lihat
 * server/src/dokumen.ts); gambarnya butuh header Authorization, jadi diambil
 * sebagai blob lalu diubah jadi object URL. Hasilnya diingat selama aplikasi
 * hidup supaya satu foto tidak diunduh berulang kali.
 */

import { useEffect, useState } from 'react';
import { ambilBerkas } from './api';

const ingatan = new Map<string, string>();

export async function urlFoto(kunci?: string | null): Promise<string | null> {
  if (!kunci) return null;
  if (kunci.startsWith('data:')) return kunci; // mode demo menyimpan gambarnya langsung
  const ada = ingatan.get(kunci);
  if (ada) return ada;
  try {
    const url = URL.createObjectURL(await ambilBerkas(kunci));
    ingatan.set(kunci, url);
    return url;
  } catch {
    return null; // foto hilang atau jaringan mati: layar memakai inisial nama
  }
}

/** Object URL foto, atau null selama belum siap / tidak ada. */
export function useFotoProfil(kunci?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(() => (kunci ? ingatan.get(kunci) ?? null : null));
  useEffect(() => {
    let hidup = true;
    urlFoto(kunci).then((u) => { if (hidup) setUrl(u); });
    return () => { hidup = false; };
  }, [kunci]);
  return url;
}

/** Lupakan foto lama setelah diganti, agar tidak tampil dari ingatan. */
export function lupakanFoto(kunci?: string | null): void {
  if (!kunci) return;
  const url = ingatan.get(kunci);
  if (url) URL.revokeObjectURL(url);
  ingatan.delete(kunci);
}
