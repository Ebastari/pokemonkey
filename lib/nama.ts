/**
 * Cara menulis nama orang di aplikasi.
 *
 * Nama tersimpan lengkap seperti di berkas roster resmi, termasuk keterangan
 * penempatan dalam kurung — mis. "Mariano Alvarado Simamora (Tahura)".
 * Keterangan itu hanya dipakai di Excel dan cetakan; di layar dan pesan
 * WhatsApp cukup nama orangnya.
 */

/** Nama lengkap untuk layar: tanpa keterangan dalam kurung di akhir. */
export function namaTampil(nama?: string | null): string {
  const bersih = (nama ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  return bersih || (nama ?? '').trim();
}

/** Nama depan, untuk tempat sempit: chip, label grafik, dan kalender. */
export function namaDepan(nama?: string | null): string {
  return namaTampil(nama).split(' ')[0] ?? '';
}
