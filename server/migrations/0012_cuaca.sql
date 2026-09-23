-- ============================================================
-- POKEMONKEY · Cuaca BMKG di KEBUN
-- ============================================================
-- Lokasi prakiraan: kode wilayah Kemendagri tingkat desa (adm4) yang dipakai
-- API publik BMKG. Bawaan Desa Linuh, Kec. Bungur, Kab. Tapin — desa terdekat
-- (±2,6 km) dari pusat area tambang PT EBL. Admin bisa menggantinya dari
-- panel cuaca di KEBUN tanpa deploy.
INSERT OR IGNORE INTO pengaturan (kunci, nilai, catatan)
VALUES ('cuaca_adm4', '63.05.09.2012', 'Kode wilayah BMKG (desa) untuk prakiraan cuaca di KEBUN');

-- Jawaban BMKG yang sudah diringkas, disimpan 30 menit agar tiga pemakai
-- tidak masing-masing memanggil BMKG. Juga dipakai sebagai cadangan saat
-- BMKG sedang tidak bisa dihubungi.
CREATE TABLE cuaca_cache (
  adm4    TEXT PRIMARY KEY,
  data    TEXT NOT NULL,
  diambil TEXT NOT NULL
);
