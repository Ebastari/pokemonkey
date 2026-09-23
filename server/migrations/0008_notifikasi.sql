-- ============================================================
-- POKEMONKEY · Notifikasi terjadwal (HP) & rekap grup
-- ============================================================

-- ---------- Pengaturan jadwal ----------
INSERT OR IGNORE INTO pengaturan (kunci, nilai, catatan) VALUES
  ('wa_pengingat_pribadi', '0',     'Pengingat WA per PIC (H-3 s/d H+3). Bawaan mati: pengingat pribadi lewat notifikasi HP.'),
  ('jam_notif_pagi',       '07:00', 'Notifikasi HP: PICA milik saya yang masih Open'),
  ('jam_notif_siang',      '12:00', 'Notifikasi HP: pengumuman belum dibaca'),
  ('jam_notif_sore',       '17:00', 'Notifikasi HP: XP hari ini');

UPDATE pengaturan
   SET catatan = 'Rekap progres PICA ke grup WA: Senin–Kamis harian, Jumat mingguan, hari libur dilewati'
 WHERE kunci = 'jam_rekap_sore';

-- ---------- Langganan Web Push (iPhone PWA & browser) ----------
-- Android APK tidak memakai tabel ini: di sana notifikasi dijadwalkan
-- Background Runner di HP sendiri.
CREATE TABLE push_langganan (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL REFERENCES tim(id),
  endpoint       TEXT NOT NULL UNIQUE,
  p256dh         TEXT NOT NULL,
  auth           TEXT NOT NULL,
  platform       TEXT,                                -- ios | android-web | desktop
  slot           TEXT NOT NULL DEFAULT '{"pagi":true,"siang":true,"sore":true}',
  gagal_berturut INTEGER NOT NULL DEFAULT 0,
  dibuat_pada    TEXT NOT NULL DEFAULT (datetime('now')),
  diperbarui     TEXT
);
CREATE INDEX idx_push_user ON push_langganan(user_id);

-- ---------- Catatan kirim: satu slot, satu orang, satu hari, satu kanal ----------
CREATE TABLE notif_log (
  user_id TEXT NOT NULL,
  tanggal TEXT NOT NULL,                              -- tanggal WITA
  slot    TEXT NOT NULL,                              -- pagi | siang | sore
  kanal   TEXT NOT NULL,                              -- webpush | runner
  status  TEXT NOT NULL DEFAULT 'terkirim',
  pada    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tanggal, slot, kanal)
);
