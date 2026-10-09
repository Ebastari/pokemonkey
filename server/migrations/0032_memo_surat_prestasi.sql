-- ============================================================
-- POKEMONKEY · Putaran 2 (docs/rencana-skin-team-memo.md)
-- Memo Rahasia, sematan pribadi, dilihat/suka, Folder Dokumen, Formulir,
-- Kotak Surat (pesan & pemberitahuan sistem), dan Skin Prestasi.
-- Jalankan setelah 0031_xp.sql.
-- ============================================================

-- ---------- Memo Rahasia ----------
-- lingkup = 'rahasia': hanya pembuat dan orang di `izin` (JSON array id anggota); semuanya bisa menyunting.
-- Isi memo rahasia disandikan (AES-GCM) bila secret KUNCI_RAHASIA_MEMO dipasang; awalan "enc1:".
ALTER TABLE memo ADD COLUMN izin TEXT;

-- Sematan per orang ("Sematkan untuk saya"). Kolom memo.disematkan = "Sematkan untuk semua".
CREATE TABLE memo_sematan (
  user_id TEXT NOT NULL,
  memo_id TEXT NOT NULL,
  pada    TEXT NOT NULL,
  PRIMARY KEY (user_id, memo_id)
);

-- Dilihat oleh: satu baris per orang per memo.
CREATE TABLE memo_lihat (
  memo_id  TEXT NOT NULL,
  user_id  TEXT NOT NULL,
  pertama  TEXT NOT NULL,
  terakhir TEXT NOT NULL,
  kali     INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (memo_id, user_id)
);

CREATE TABLE memo_suka (
  memo_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  pada    TEXT NOT NULL,
  PRIMARY KEY (memo_id, user_id)
);

-- ---------- Folder Dokumen (di atas Sampah) ----------
-- lingkup tim = semua anggota melihat; pribadi = hanya pemilik. Isinya hanya dokumen (R2: dok/…).
CREATE TABLE folder_dok (
  id          TEXT PRIMARY KEY,
  nama        TEXT NOT NULL,
  lingkup     TEXT NOT NULL,          -- tim | pribadi
  user_id     TEXT NOT NULL,          -- pembuat (pemilik untuk pribadi)
  induk_id    TEXT,
  dibuat_pada TEXT NOT NULL
);
CREATE INDEX idx_folder_dok ON folder_dok(lingkup, user_id);

CREATE TABLE berkas_dok (
  id          TEXT PRIMARY KEY,
  folder_id   TEXT,                   -- NULL = akar folder Tim/Pribadi
  lingkup     TEXT NOT NULL,          -- tim | pribadi
  user_id     TEXT NOT NULL,          -- pengunggah
  nama        TEXT NOT NULL,
  kunci       TEXT NOT NULL,          -- kunci R2
  tipe        TEXT,
  ukuran      INTEGER NOT NULL DEFAULT 0,
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT
);
CREATE INDEX idx_berkas_dok ON berkas_dok(lingkup, folder_id);

-- ---------- Formulir di dalam memo ----------
CREATE TABLE formulir (
  id          TEXT PRIMARY KEY,
  memo_id     TEXT NOT NULL,
  judul       TEXT NOT NULL DEFAULT '',
  ket         TEXT,
  skema       TEXT NOT NULL DEFAULT '[]',   -- JSON: [{id, label, jenis, wajib, opsi}]
  mode        TEXT NOT NULL DEFAULT 'anggota', -- anggota | publik
  token       TEXT UNIQUE,                   -- tautan publik /f/<token>
  sekali      INTEGER NOT NULL DEFAULT 0,    -- satu jawaban per orang (anggota)
  tutup_pada  TEXT,                          -- YYYY-MM-DD; sesudahnya formulir ditutup
  dibuat_oleh TEXT NOT NULL,
  dibuat_pada TEXT NOT NULL
);
CREATE INDEX idx_formulir_memo ON formulir(memo_id);

CREATE TABLE formulir_jawaban (
  id           TEXT PRIMARY KEY,
  formulir_id  TEXT NOT NULL,
  user_id      TEXT,                  -- NULL = pengisi lewat tautan publik
  nama_pengisi TEXT,
  jawaban      TEXT NOT NULL,         -- JSON {idPertanyaan: nilai}
  dikirim_pada TEXT NOT NULL
);
CREATE INDEX idx_jawaban_form ON formulir_jawaban(formulir_id, dikirim_pada);

-- ---------- Kotak Surat ----------
-- Pesan antar anggota (seperti email): satu pesan, banyak penerima; balasan = induk_id.
CREATE TABLE pesan (
  id          TEXT PRIMARY KEY,
  pengirim    TEXT NOT NULL,
  subjek      TEXT NOT NULL,
  isi         TEXT NOT NULL,
  tautan      TEXT,                   -- JSON {jenis: pica|memo|jadwal, id, label}
  jenis       TEXT NOT NULL DEFAULT 'pesan', -- pesan | minta_progres | progres
  penting     INTEGER NOT NULL DEFAULT 0,
  induk_id    TEXT,
  lampiran    TEXT,                   -- JSON [{nama, kunci}]
  dibuat_pada TEXT NOT NULL
);
CREATE TABLE pesan_penerima (
  pesan_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  dibaca_pada TEXT,
  diarsip     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (pesan_id, user_id)
);
CREATE INDEX idx_pesan_penerima ON pesan_penerima(user_id, dibaca_pada);

-- Pemberitahuan sistem (PICA ditugaskan, akses memo rahasia, prestasi, dll.); dibersihkan setelah 90 hari.
CREATE TABLE kotak_surat (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  jenis       TEXT NOT NULL,
  judul       TEXT NOT NULL,
  isi         TEXT,
  tautan      TEXT,
  penting     INTEGER NOT NULL DEFAULT 0,
  dibuat_pada TEXT NOT NULL,
  dibaca_pada TEXT
);
CREATE INDEX idx_kotak_surat ON kotak_surat(user_id, dibaca_pada);

-- ---------- Skin Prestasi ----------
CREATE TABLE prestasi (
  user_id     TEXT NOT NULL,
  kode        TEXT NOT NULL,
  didapat_pada TEXT NOT NULL,
  PRIMARY KEY (user_id, kode)
);
