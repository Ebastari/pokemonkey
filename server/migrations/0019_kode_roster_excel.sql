-- ============================================================
-- POKEMONKEY · Kode roster disamakan dengan berkas "ROSTER KERJA RNR 2026"
-- ============================================================
-- M/S1 → D (shift siang), S2 → N (shift malam), L → OFF, C → FB, I → IK.
-- Kode tambahan buatan Admin tidak disentuh.

UPDATE roster SET kode = CASE kode
  WHEN 'M'  THEN 'D'
  WHEN 'S1' THEN 'D'
  WHEN 'S2' THEN 'N'
  WHEN 'L'  THEN 'OFF'
  WHEN 'C'  THEN 'FB'
  WHEN 'I'  THEN 'IK'
  ELSE kode END
WHERE kode IN ('M','S1','S2','L','C','I');

DELETE FROM opsi WHERE grup = 'roster' AND nilai IN ('M','S1','S2','L','C','I');

INSERT OR REPLACE INTO opsi (grup, nilai, label, warna, urutan) VALUES
  ('roster','D',  'Shift Siang', 'cyan',    1),
  ('roster','N',  'Shift Malam', 'indigo',  2),
  ('roster','OFF','Libur',       'red',     3),
  ('roster','FB', 'Field Break / Cuti Tahunan', 'yellow', 4),
  ('roster','IK', 'Ijin Khusus', 'emerald', 5);
