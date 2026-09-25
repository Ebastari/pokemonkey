-- Alarm tenggat PICA per orang.
-- Bawaannya mati: hanya PICA yang sengaja ditandai pemiliknya yang berbunyi,
-- supaya tidak bertabrakan dengan rekap pagi 07.00 yang sudah ada.
CREATE TABLE IF NOT EXISTS pica_alarm (
  pica_id     TEXT NOT NULL,
  user_id     TEXT NOT NULL REFERENCES tim(id),
  jam         TEXT NOT NULL DEFAULT '07:00',   -- WITA, HH:MM
  aktif       INTEGER NOT NULL DEFAULT 1,
  diubah_pada TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pica_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_pica_alarm_user ON pica_alarm(user_id, aktif);
