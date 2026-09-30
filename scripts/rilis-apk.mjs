/**
 * Terbitkan APK terbaru untuk tautan unduh di layar login dan peringatan pembaruan.
 *
 *   node scripts/rilis-apk.mjs "Catatan singkat yang baru di versi ini"
 *
 * Yang dilakukan:
 *   1. Baca versionName/versionCode dari android/app/build.gradle.
 *   2. Unggah rilis/POKEMONKEY-<versi>.apk ke R2 (rilis/POKEMONKEY-<versi>.apk).
 *   3. Catat versi terbaru di tabel `pengaturan` (apk_versi, apk_kode, apk_kunci, …).
 * Setelah itu /api/versi melaporkan versi ini dan /unduh/apk menyajikan berkasnya;
 * aplikasi yang versinya lebih lama menampilkan peringatan pembaruan.
 *
 * Jalankan SETELAH APK dibangun dan Worker + web versi yang sama di-deploy.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const akar = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gradle = readFileSync(path.join(akar, 'android/app/build.gradle'), 'utf8');
const versi = /versionName\s+"([^"]+)"/.exec(gradle)?.[1];
const kode = /versionCode\s+(\d+)/.exec(gradle)?.[1];
if (!versi || !kode) throw new Error('versionName/versionCode tidak ditemukan di android/app/build.gradle');

const berkas = path.join(akar, 'rilis', `POKEMONKEY-${versi}.apk`);
if (!existsSync(berkas)) throw new Error(`APK belum ada: ${berkas}`);
const ukuran = statSync(berkas).size;
const kunci = `rilis/POKEMONKEY-${versi}.apk`;
const catatan = (process.argv[2] ?? '').trim();
const tanggal = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10); // WITA

const wrangler = (...arg) => execFileSync('npx', ['wrangler', ...arg], { cwd: path.join(akar, 'server'), stdio: 'inherit', shell: process.platform === 'win32' });

console.log(`Mengunggah ${path.basename(berkas)} (${(ukuran / 1024 / 1024).toFixed(1)} MB) ke R2…`);
wrangler('r2', 'object', 'put', `pokemonkey-lampiran/${kunci}`, '--file', `"${berkas}"`, '--content-type', 'application/vnd.android.package-archive', '--remote');

const petik = (s) => `'${String(s).replace(/'/g, "''")}'`;
const nilai = { apk_versi: versi, apk_kode: kode, apk_kunci: kunci, apk_ukuran: ukuran, apk_catatan: catatan, apk_tanggal: tanggal };
const sql = Object.entries(nilai)
  .map(([k, v]) => `INSERT INTO pengaturan (kunci, nilai, catatan) VALUES (${petik(k)}, ${petik(v)}, 'Rilis APK terbaru (scripts/rilis-apk.mjs)') ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai;`)
  .join('\n');
console.log(`Mencatat versi ${versi} (kode ${kode}) sebagai versi terbaru…`);
// Lewat berkas, bukan --command: catatan rilis boleh berisi tanda petik dan baris baru.
const berkasSql = path.join(os.tmpdir(), `rilis-apk-${Date.now()}.sql`);
writeFileSync(berkasSql, sql, 'utf8');
try {
  wrangler('d1', 'execute', 'pokemonkey', '--remote', '--file', `"${berkasSql}"`);
} finally {
  unlinkSync(berkasSql);
}
console.log(`Selesai: versi ${versi} terbit. Tautan unduh: /unduh/apk`);
