-- ============================================================
-- POKEMONKEY · Pengaturan Notifikasi Aktivitas PICA
-- ============================================================
-- Notifikasi otomatis saat pengguna membuat, memperbarui,
-- mengunggah bukti, atau menutup PICA.

INSERT OR IGNORE INTO pengaturan (kunci, nilai, catatan) VALUES
  ('wa_notif_pica', '1', 'Notifikasi instan WA & Info saat PICA dibuat, diubah, ditambah bukti, atau ditutup');
