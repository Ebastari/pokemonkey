/**
 * Papan PICA hanya-baca untuk tautan di rekap WhatsApp.
 *
 *   GET /lihat/pica?k=<kunci>  → halaman HTML, tanpa login, tanpa tombol ubah.
 *
 * Kunci acak disimpan di tabel pengaturan dan diganti otomatis setiap Senin
 * (WITA). Kunci minggu sebelumnya masih diterima, jadi tautan di rekap Jumat
 * tetap bisa dibuka sepanjang minggu berikutnya; tautan yang lebih tua mati.
 * Halaman ditandai noindex dan tidak mengirim Referer, supaya kuncinya tidak
 * bocor ke mesin pencari atau situs lain.
 */

import type { Env } from './tipe';
import { ambilPengaturan } from './wa';
import { geserHari, jamWita, tanggalIndonesia, tanggalWita } from './waktu';
import { labelPerPic } from './ringkasan';

const K_KUNCI = 'lihat_kunci';
const K_LAMA = 'lihat_kunci_lama';
const K_MINGGU = 'lihat_kunci_minggu';

async function simpan(env: Env, kunci: string, nilai: string, catatan: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO pengaturan (kunci, nilai, catatan) VALUES (?1, ?2, ?3)
     ON CONFLICT(kunci) DO UPDATE SET nilai = excluded.nilai`,
  )
    .bind(kunci, nilai, catatan)
    .run();
}

const seninDari = (tanggal: string) => geserHari(tanggal, -((new Date(`${tanggal}T00:00:00Z`).getUTCDay() + 6) % 7));

/**
 * Kunci minggu ini; dibuat baru bila belum ada atau minggunya sudah berganti.
 * Dipanggil saat rekap disusun DAN saat halaman dibuka, jadi pergantian tiap
 * Senin tidak bergantung pada ada-tidaknya rekap. Kunci lama tetap berlaku
 * hanya bila memang kunci minggu lalu; kunci yang lebih tua langsung mati.
 */
async function kunciMingguIni(env: Env, hariIni: string): Promise<string> {
  const senin = seninDari(hariIni);
  const [kunci, minggu] = await Promise.all([ambilPengaturan(env, K_KUNCI), ambilPengaturan(env, K_MINGGU)]);
  if (kunci && minggu === senin) return kunci;

  const baru = crypto.randomUUID().replace(/-/g, '');
  const lamaMasihSah = kunci && minggu === geserHari(senin, -7) ? kunci : '';
  await simpan(env, K_LAMA, lamaMasihSah, 'Kunci tautan PICA hanya-baca minggu lalu (masih berlaku)');
  await simpan(env, K_KUNCI, baru, 'Kunci tautan PICA hanya-baca di rekap WA; berganti tiap Senin');
  await simpan(env, K_MINGGU, senin, 'Senin saat kunci tautan PICA dibuat');
  return baru;
}

/**
 * Alamat papan PICA hanya-baca untuk dicantumkan di rekap. `asal` dipakai bila
 * var ALAMAT_PUBLIK belum diisi (mis. saat dipanggil dari permintaan HTTP).
 */
export async function tautanLihatPica(env: Env, hariIni: string, asal?: string): Promise<string | null> {
  const dasar = (env.ALAMAT_PUBLIK || asal || '').replace(/\/+$/, '');
  if (!dasar) return null;
  return `${dasar}/lihat/pica?k=${await kunciMingguIni(env, hariIni)}`;
}

// ---------------------------------------------------------------------------
// Halaman
// ---------------------------------------------------------------------------

interface BarisLihat {
  id: string;
  judul: string;
  judul_singkat: string | null;
  bidang: string | null;
  prioritas: string | null;
  status: string;
  due_date: string | null;
  pic_id: string | null;
  pic_nama: string | null;
  target: number | null;
  realisasi: number | null;
  satuan: string | null;
  akar: string | null;
  tindakan: string | null;
}

const esc = (t: unknown) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const angka = (n: number) => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
const namaDepan = (n: string | null) => (n ? n.split(' ')[0] : 'Tanpa PIC');
const selisih = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const tglPendek = (t: string) => { const d = new Date(`${t}T00:00:00Z`); return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`; };

function kartu(p: BarisLihat, hariIni: string): string {
  const sisa = p.due_date ? selisih(p.due_date, hariIni) : null;
  const telat = sisa !== null && sisa < 0;
  const [kelas, waktu] = sisa === null ? ['netral', 'Belum ada tanggal target']
    : telat ? ['telat', `Telat ${-sisa} hari · tenggat ${tglPendek(p.due_date as string)}`]
      : sisa === 0 ? ['dekat', 'Batasnya hari ini']
        : [sisa <= 7 ? 'dekat' : 'aman', `${sisa} hari lagi · tenggat ${tglPendek(p.due_date as string)}`];

  const t = Number(p.target);
  const r = Number(p.realisasi);
  const adaCapaian = t > 0 && p.realisasi !== null;
  const persen = adaCapaian ? Math.max(0, Math.min(100, Math.round((r / t) * 100))) : 0;

  return `
    <article class="pica ${kelas}">
      <header>
        <span class="kode">${esc(p.id)}</span>
        <span class="lencana ${kelas}">${esc(waktu)}</span>
      </header>
      <h3>${esc(p.judul_singkat || p.judul)}</h3>
      ${p.judul_singkat ? `<p class="lengkap">${esc(p.judul)}</p>` : ''}
      <p class="meta">${esc(p.bidang ?? '—')} · prioritas ${esc((p.prioritas ?? '—').toLowerCase())} · ${p.status === 'Continue' ? 'sedang ditangani' : esc(p.status)}</p>
      ${adaCapaian ? `
      <div class="capaian" role="img" aria-label="Capaian ${persen} persen">
        <div class="batang"><span style="width:${persen}%"></span></div>
        <span class="angka">${angka(r)} / ${angka(t)}${p.satuan ? ` ${esc(p.satuan)}` : ''} · ${persen}%</span>
      </div>` : ''}
      ${p.tindakan ? `<p class="blok"><b>Tindakan</b>${esc(p.tindakan)}</p>` : ''}
      ${p.akar ? `<p class="blok"><b>Akar masalah</b>${esc(p.akar)}</p>` : ''}
    </article>`;
}

function halaman(judul: string, isi: string): Response {
  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>${esc(judul)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&display=swap">
<style>
  :root {
    --latar: #eef1ea; --kartu: #ffffff; --tinta: #16191d; --redup: #57606a; --garis: #16191d;
    --bayang: #a9b2ab; --hijau: #1f6b3a; --telat: #b42318; --telat-muda: #fde8e6;
    --dekat: #9a5b00; --dekat-muda: #fdf1dc; --aman: #1f6b3a; --aman-muda: #e3f3e8; --batang: #d9ded6;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --latar: #121513; --kartu: #1c211e; --tinta: #eef1ea; --redup: #a3aca6; --garis: #3d4640;
      --bayang: #000000; --hijau: #4ade80; --telat: #ff8a80; --telat-muda: #3a1715;
      --dekat: #f5b84d; --dekat-muda: #3a2a0e; --aman: #6fdc97; --aman-muda: #14301f; --batang: #313a34;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--latar); color: var(--tinta); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 16px; }
  main { max-width: 760px; margin: 0 auto; display: grid; gap: 18px; }
  h1, h2 { font-family: "Pixelify Sans", system-ui, sans-serif; margin: 0; letter-spacing: 0.02em; }
  h1 { font-size: 26px; }
  h2 { font-size: 19px; display: flex; justify-content: space-between; gap: 8px; align-items: baseline; border-bottom: 3px solid var(--garis); padding-bottom: 4px; }
  h2 small { font-family: system-ui, sans-serif; font-size: 13px; color: var(--redup); font-weight: 600; }
  .kepala p { margin: 4px 0 0; color: var(--redup); font-size: 13px; }
  .ringkas { background: var(--kartu); border: 3px solid var(--garis); box-shadow: 4px 4px 0 var(--bayang); padding: 12px 14px; }
  .ringkas .total { font-weight: 700; margin: 0 0 8px; }
  .ringkas ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
  .ringkas li { display: flex; justify-content: space-between; gap: 12px; font-variant-numeric: tabular-nums; }
  .ringkas li b.telat { color: var(--telat); }
  section { display: grid; gap: 10px; }
  .pica { background: var(--kartu); border: 3px solid var(--garis); box-shadow: 4px 4px 0 var(--bayang); padding: 12px 14px; border-left-width: 8px; }
  .pica.telat { border-left-color: var(--telat); }
  .pica.dekat { border-left-color: var(--dekat); }
  .pica.aman { border-left-color: var(--aman); }
  .pica header { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
  .kode { font: 600 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--redup); }
  .lencana { font-size: 12px; font-weight: 700; padding: 2px 8px; border: 2px solid currentColor; }
  .lencana.telat { color: var(--telat); background: var(--telat-muda); }
  .lencana.dekat { color: var(--dekat); background: var(--dekat-muda); }
  .lencana.aman { color: var(--aman); background: var(--aman-muda); }
  .lencana.netral { color: var(--redup); }
  h3 { margin: 8px 0 2px; font-size: 16px; line-height: 1.35; }
  h3::first-letter { text-transform: uppercase; }
  .lengkap { margin: 0 0 4px; font-size: 13px; color: var(--redup); }
  .meta { margin: 0; font-size: 12px; color: var(--redup); }
  .capaian { margin-top: 8px; display: grid; gap: 4px; }
  .batang { height: 10px; background: var(--batang); border: 2px solid var(--garis); }
  .batang span { display: block; height: 100%; background: var(--hijau); }
  .capaian .angka { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--redup); }
  .blok { margin: 8px 0 0; font-size: 14px; }
  .blok b { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--redup); }
  footer { color: var(--redup); font-size: 12px; text-align: center; padding-bottom: 8px; }
</style>
</head>
<body><main>${isi}</main></body>
</html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

export async function halamanLihatPica(url: URL, env: Env): Promise<Response> {
  const k = url.searchParams.get('k') ?? '';
  const kunci = await kunciMingguIni(env, tanggalWita());
  const lama = await ambilPengaturan(env, K_LAMA);
  const sah = k.length >= 20 && (k === kunci || (lama !== '' && k === lama));
  if (!sah) {
    const r = halaman('Tautan kedaluwarsa · PICA', `
      <div class="kepala"><h1>Tautan kedaluwarsa</h1>
      <p>Tautan papan PICA berganti setiap Senin. Buka tautan dari rekap WhatsApp terbaru, atau masuk ke aplikasi POKEMONKEY.</p></div>`);
    return new Response(r.body, { status: 403, headers: r.headers });
  }

  const hariIni = tanggalWita();
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.judul, p.judul_singkat, p.bidang, p.prioritas, p.status, p.due_date, p.pic_id, t.nama AS pic_nama,
            p.target, p.realisasi, p.satuan, p.akar, p.tindakan
       FROM pica p LEFT JOIN tim t ON t.id = p.pic_id
      WHERE p.dihapus = 0 AND p.status <> 'Closed'
      ORDER BY p.due_date IS NULL, p.due_date`,
  ).all<BarisLihat>();

  const telatKah = (p: BarisLihat) => Boolean(p.due_date && p.due_date < hariIni);
  // Dikelompokkan per ID PIC, sama dengan rekap WA (nama depan kembar tidak tergabung).
  const label = labelPerPic(results);
  const kelompok = new Map<string, BarisLihat[]>();
  for (const p of results) kelompok.set(p.pic_id ?? '', [...(kelompok.get(p.pic_id ?? '') ?? []), p]);
  const urutan = [...kelompok]
    .map(([kunciPic, daftar]) => ({ nama: label.get(kunciPic) ?? 'Tanpa PIC', daftar, telat: daftar.filter(telatKah).length }))
    .sort((a, b) => b.telat - a.telat || b.daftar.length - a.daftar.length || a.nama.localeCompare(b.nama));
  const totalTelat = results.filter(telatKah).length;
  const jumlah = (n: number, t: number) => `${n} tugas${t ? `, <b class="telat">${t} telat</b>` : ', belum telat'}`;

  const isi = `
    <div class="kepala">
      <h1>PICA belum selesai</h1>
      <p>${esc(tanggalIndonesia(hariIni))} · data per ${esc(jamWita().replace(':', '.'))} WITA · tampilan hanya baca</p>
    </div>
    <div class="ringkas">
      ${results.length
        ? `<p class="total">Total ${results.length} tugas belum selesai, ${totalTelat ? `${totalTelat} sudah lewat tanggal` : 'belum ada yang telat'}.</p>
      <ul>${urutan.map((k) => `<li><span>${esc(k.nama)}</span><span>${jumlah(k.daftar.length, k.telat)}</span></li>`).join('')}</ul>`
        : '<p class="total">Semua PICA sudah selesai.</p>'}
    </div>
    ${urutan.map((k) => `
    <section>
      <h2>${esc(k.nama)} <small>${k.daftar.length} tugas${k.telat ? ` · ${k.telat} telat` : ''}</small></h2>
      ${k.daftar.map((p) => kartu(p, hariIni)).join('')}
    </section>`).join('')}
    <footer>POKEMONKEY · Revegetasi &amp; Rehabilitasi PT EBL<br>Untuk mengubah data, buka aplikasi POKEMONKEY.</footer>`;

  return halaman('PICA belum selesai · POKEMONKEY', isi);
}
