/**
 * Sistem Pengaman & Kunci Dokumen POKEMONKEY
 * Digunakan untuk mengunci dokumen penting (Internal Memo, MoM, Nomor Surat, Disposisi, RAB, Laporan Karhutla)
 * setelah disimpan, dan memerlukan password untuk membuka kunci dan menyunting kembali.
 */

export const PASSWORD_KUNCI_DOKUMEN = 'eblhasnurajadeh';

/**
 * Memeriksa kecocokan password pengaman dokumen.
 */
export function verifikasiPasswordDokumen(passwordInput: string): boolean {
  if (!passwordInput) return false;
  return passwordInput.trim() === PASSWORD_KUNCI_DOKUMEN;
}
