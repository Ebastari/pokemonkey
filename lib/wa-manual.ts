import * as W from './waktu';

/**
 * Format pengumuman untuk teks WhatsApp yang rapi dan profesional.
 */
export function formatPengumumanWa(p: {
  judul: string;
  isi: string;
  penting?: boolean | number;
  oleh_nama?: string | null;
  dibuat_pada?: string;
}): string {
  const tanggal = p.dibuat_pada ? W.formatWaktuIso(p.dibuat_pada) : W.hariIniWita();
  const pentingFlag = Boolean(p.penting);

  return [
    `*📢 PENGUMUMAN · HASNUR GROUP*`,
    `*PT ENERGI BATUBARA LESTARI*`,
    `----------------------------------------`,
    `${pentingFlag ? '⚠️ *PENTING & MENDESAK*\n' : ''}*${p.judul.trim()}*`,
    ``,
    `${p.isi.trim()}`,
    ``,
    `----------------------------------------`,
    `_Dibuat oleh: ${p.oleh_nama ?? 'Manajemen'} (${tanggal} WITA)_`,
    `_Sistem Informasi POKEMONKEY_`,
  ].join('\n');
}

/**
 * Membuka WhatsApp secara manual.
 * Mendukung direct group link (jika berupa https://chat.whatsapp.com/...)
 * atau universal share intent (https://api.whatsapp.com/send?text=...)
 */
export async function bukaWaManual({
  pesan,
  linkGrup,
}: {
  pesan: string;
  linkGrup?: string | null;
}): Promise<'wa_opened' | 'clipboard_copied'> {
  const teksTerenkode = encodeURIComponent(pesan);

  // Jika berupa link undangan grup resmi WhatsApp (chat.whatsapp.com)
  if (linkGrup && linkGrup.includes('chat.whatsapp.com')) {
    if (navigator?.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(pesan);
      } catch {
        /* abaikan jika permission clipboard ditolak */
      }
    }
    window.open(linkGrup, '_blank', 'noopener,noreferrer');
    return 'clipboard_copied';
  }

  // Universal intent: WhatsApp akan membuka picker daftar chat/grup,
  // dan begitu grup dipilih, teks otomatis terisi di kolom ketik obrolan.
  const urlWa = `https://api.whatsapp.com/send?text=${teksTerenkode}`;
  window.open(urlWa, '_blank', 'noopener,noreferrer');
  return 'wa_opened';
}
