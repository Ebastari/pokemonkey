/** Nomor PICA berjalan sepanjang waktu: PICA-001, PICA-002, … (migrasi 0021). */
export const noPica = (p: { no_urut?: number | null; id: string }) =>
  p.no_urut ? `PICA-${String(p.no_urut).padStart(3, '0')}` : p.id;
