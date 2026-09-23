-- ============================================================
-- POKEMONKEY · Titik api (hotspot) dari NASA FIRMS
-- ============================================================
-- Satu baris = satu deteksi satelit (sumber + koordinat + waktu), jadi deteksi
-- yang sama tidak pernah tercatat — dan tidak pernah diperingatkan — dua kali.
CREATE TABLE titik_api (
  id            TEXT PRIMARY KEY,               -- sumber|lat|lon|tanggal|jam dari FIRMS
  sumber        TEXT NOT NULL,                  -- VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, VIIRS_NOAA21_NRT, MODIS_NRT
  lat           REAL NOT NULL,
  lon           REAL NOT NULL,
  waktu         TEXT NOT NULL,                  -- waktu deteksi satelit, ISO UTC
  keyakinan     TEXT NOT NULL,                  -- rendah | sedang | tinggi
  frp           REAL,                           -- Fire Radiative Power (MW)
  zona          TEXT NOT NULL,                  -- ippkh | iup | waspada | pantau
  jarak_km      REAL NOT NULL,                  -- ke batas IUP; 0 = di dalam
  bidang        TEXT,                           -- SK IPPKH yang memuatnya
  status        TEXT NOT NULL DEFAULT 'baru',   -- baru | dicek | padam | bukan_api
  catatan       TEXT,
  dicek_oleh    TEXT REFERENCES tim(id),
  dicek_pada    TEXT,
  pica_id       TEXT,
  diperingatkan INTEGER NOT NULL DEFAULT 0,     -- 1 = sudah masuk pesan WA (sekali saja)
  dibuat_pada   TEXT NOT NULL
);
CREATE INDEX idx_titik_api_waktu ON titik_api(waktu);

INSERT OR IGNORE INTO pengaturan (kunci, nilai, catatan) VALUES
  ('titik_api_aktif', '1', 'Periksa titik api FIRMS tiap jam (1/0)'),
  ('titik_api_wa', '1', 'Kirim peringatan titik api baru ke grup WA (1/0)'),
  ('titik_api_radius_waspada_km', '2', 'Jarak dari batas IUP yang masuk zona waspada (km)'),
  ('titik_api_radius_pantau_km', '5', 'Jarak dari batas IUP yang masih dicatat (km)'),
  ('titik_api_terakhir', '', 'Waktu pemeriksaan FIRMS terakhir (ISO)'),
  ('titik_api_galat', '', 'Galat pemeriksaan FIRMS terakhir');
