-- ============================================================
-- POKEMONKEY · Sistem hati (disiplin membuka aplikasi)
-- ============================================================
-- Anggota yang melewatkan satu hari kerja atau lebih tanpa membuka aplikasi
-- "hatinya mati": ia tetap bisa login, tetapi semua menu terkunci sampai ia
-- mengirim permohonan (alasan + pesan ke grup WhatsApp) dan Admin/Supervisor
-- menghidupkannya lewat tautan di pesan itu atau dari menu TEAM.
-- Hari dengan roster libur/cuti/izin (OFF, FB, IK, …) tidak dihitung.

-- Tanggal (WITA) terakhir pemilik akun membuka aplikasi. NULL = belum pernah
-- tercatat; hitungan baru dimulai sejak pertama kali membuka versi ini.
ALTER TABLE profil_game ADD COLUMN hati_buka_terakhir TEXT;

CREATE TABLE hati_mati (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES tim(id),
  mati_pada       TEXT NOT NULL,                 -- saat terdeteksi (UTC)
  buka_terakhir   TEXT NOT NULL,                 -- tanggal WITA terakhir membuka sebelum mati
  hari_absen      INTEGER NOT NULL,              -- jumlah hari kerja yang terlewat
  tanggal_absen   TEXT NOT NULL DEFAULT '[]',    -- JSON daftar tanggal hari kerja itu
  alasan          TEXT,                          -- lalai | sakit | sinyal | tugas | lain
  keterangan      TEXT,
  token           TEXT,                          -- tautan "hidupkan" di pesan WhatsApp
  diajukan_pada   TEXT,
  dihidupkan_oleh TEXT REFERENCES tim(id),
  dihidupkan_pada TEXT
);
CREATE INDEX idx_hati_mati_user ON hati_mati(user_id, dihidupkan_pada);
CREATE UNIQUE INDEX idx_hati_mati_token ON hati_mati(token) WHERE token IS NOT NULL;
