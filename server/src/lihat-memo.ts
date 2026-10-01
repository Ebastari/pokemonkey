/**
 * Bagikan memo lewat tautan — seperti "Share to web" di Notion.
 *
 *   POST   /api/memo/:id/bagi   nyalakan tautan (atau kembalikan yang sudah ada)
 *   GET    /api/memo/:id/bagi   status tautan memo ini
 *   DELETE /api/memo/:id/bagi   matikan tautan
 *
 *   GET /lihat/memo/<token>                 halaman HTML hanya-baca, tanpa login
 *   GET /lihat/memo/<token>/berkas?k=<kunci> gambar/berkas milik memo itu saja
 *
 * Token acak disimpan di tabel tautan_bagi (cakupan 'memo', objek_id = id memo)
 * dan berlaku sampai dimatikan atau memonya dihapus. Halaman selalu memuat isi
 * terbaru, ditandai noindex, dan tidak mengirim Referer.
 */

import type { Env, Pengguna } from './tipe';
import { bolehUbahKunci } from './auth';
import { uraiBlok, uraiInline, hitungTugas } from './memo-blok';
import { jamWita, selisihHari, tanggalIndonesia, tanggalWita } from './waktu';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function tokenAcak(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

const alamat = (env: Env, asal: string, token: string) => `${(env.ALAMAT_PUBLIK || asal).replace(/\/+$/, '')}/lihat/memo/${token}`;

interface BarisTautan { token: string; dibuka: number; dibuat_pada: string; kedaluwarsa: string | null }

async function tautanAktif(env: Env, memoId: string): Promise<BarisTautan | null> {
  return env.DB.prepare(
    `SELECT token, dibuka, dibuat_pada, kedaluwarsa FROM tautan_bagi
      WHERE cakupan = 'memo' AND objek_id = ?1 AND aktif = 1
      ORDER BY dibuat_pada DESC LIMIT 1`,
  ).bind(memoId).first<BarisTautan>();
}

// ============================================================
// API (butuh login)
// ============================================================

/**
 * Melihat status tautan: siapa pun yang boleh membaca memo itu.
 * Menyalakan/mematikan: penulis memo, atau Supervisor/Admin untuk memo tim.
 */
export async function ruteBagiMemo(memoId: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response> {
  const memo = await env.DB.prepare('SELECT id, user_id, lingkup, judul FROM memo WHERE id = ?1')
    .bind(memoId).first<{ id: string; user_id: string; lingkup: string; judul: string }>();
  if (!memo || (memo.lingkup !== 'tim' && memo.user_id !== pengguna.id)) return galat('Memo tidak ditemukan.', 404);
  const boleh = memo.user_id === pengguna.id || (memo.lingkup === 'tim' && bolehUbahKunci(pengguna));
  const asal = new URL(req.url).origin;

  if (req.method === 'GET') {
    const t = await tautanAktif(env, memo.id);
    return json(t ? { aktif: true, url: alamat(env, asal, t.token), dibuka: t.dibuka, dibuat_pada: t.dibuat_pada, boleh } : { aktif: false, boleh });
  }
  if (!boleh) return galat('Hanya penulis memo, Supervisor, atau Admin yang boleh mengatur tautan.', 403);

  if (req.method === 'POST') {
    const ada = await tautanAktif(env, memo.id);
    if (ada) return json({ aktif: true, url: alamat(env, asal, ada.token), dibuka: ada.dibuka, dibuat_pada: ada.dibuat_pada, boleh });
    const token = tokenAcak();
    await env.DB.prepare(
      `INSERT INTO tautan_bagi (token, cakupan, label, dibuat_oleh, kedaluwarsa, objek_id) VALUES (?1, 'memo', ?2, ?3, NULL, ?4)`,
    ).bind(token, `Memo · ${memo.judul.trim() || 'Tanpa judul'}`.slice(0, 120), pengguna.id, memo.id).run();
    return json({ aktif: true, url: alamat(env, asal, token), dibuka: 0, dibuat_pada: new Date().toISOString(), boleh }, 201);
  }
  if (req.method === 'DELETE') {
    await env.DB.prepare(`UPDATE tautan_bagi SET aktif = 0 WHERE cakupan = 'memo' AND objek_id = ?1`).bind(memo.id).run();
    return json({ aktif: false, boleh });
  }
  return galat('Metode tidak didukung.', 405);
}

/** Memo dihapus: tautannya ikut mati. */
export async function matikanTautanMemo(env: Env, memoId: string): Promise<void> {
  await env.DB.prepare(`UPDATE tautan_bagi SET aktif = 0 WHERE cakupan = 'memo' AND objek_id = ?1`).bind(memoId).run();
}

// ============================================================
// Halaman publik (tanpa login)
// ============================================================

interface MemoLihat {
  id: string; judul: string; isi: string; ringkasan: string | null; kategori: string | null; tipe: string | null;
  status: string | null; tanggal: string | null; lingkup: string; props: string | null; pica_id: string | null;
  dibuat_pada: string; diubah_pada: string | null; penulis: string | null; pica_no: number | null; pica_judul: string | null;
}

/** Memo di balik token yang masih berlaku, atau null. */
async function memoDariToken(env: Env, token: string): Promise<MemoLihat | null> {
  const t = await env.DB.prepare(
    `SELECT objek_id, kedaluwarsa FROM tautan_bagi WHERE token = ?1 AND cakupan = 'memo' AND aktif = 1`,
  ).bind(token).first<{ objek_id: string | null; kedaluwarsa: string | null }>();
  if (!t?.objek_id) return null;
  if (t.kedaluwarsa && Date.parse(t.kedaluwarsa) < Date.now()) return null;
  return env.DB.prepare(
    `SELECT m.id, m.judul, m.isi, m.ringkasan, m.kategori, m.tipe, m.status, m.tanggal, m.lingkup, m.props, m.pica_id,
            m.dibuat_pada, m.diubah_pada, t.nama AS penulis, p.no_urut AS pica_no, p.judul AS pica_judul
       FROM memo m LEFT JOIN tim t ON t.id = m.user_id LEFT JOIN pica p ON p.id = m.pica_id
      WHERE m.id = ?1`,
  ).bind(t.objek_id).first<MemoLihat>();
}

const jalurBerkas = (token: string, kunci: string) => `/lihat/memo/${token}/berkas?k=${encodeURIComponent(kunci)}`;

interface Konteks { token: string; nama: Map<string, string>; hariIni: string }

function inline(teks: string, k: Konteks, selesai = false): string {
  return uraiInline(teks).map((x) => {
    switch (x.t) {
      case 'teks': return esc(x.v);
      case 'tebal': return `<b>${esc(x.v)}</b>`;
      case 'miring': return `<i>${esc(x.v)}</i>`;
      case 'coret': return `<s>${esc(x.v)}</s>`;
      case 'kode': return `<code>${esc(x.v)}</code>`;
      case 'tautan': return `<a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(x.v)}</a>`;
      case 'berkas': return `<a class="chip" href="${esc(jalurBerkas(k.token, x.kunci))}" download="${esc(x.v)}">📎 ${esc(x.v)}</a>`;
      case 'tenggat': {
        const sisa = selisihHari(x.tanggal, k.hariIni);
        const kelas = selesai ? 'redup' : sisa < 0 ? 'telat' : sisa === 0 ? 'dekat' : 'aman';
        return `<span class="chip ${kelas}">📅 ${esc(tanggalIndonesia(x.tanggal))}${x.jam ? ` ${esc(x.jam)}` : ''}</span>`;
      }
      case 'orang': {
        const nama = k.nama.get(x.id);
        return nama ? `<span class="chip orang">@${esc(nama.split(' ')[0])}</span>` : esc(`@${x.id}`);
      }
      case 'pica': return `<span class="chip pica">#${esc(x.id)}</span>`;
    }
    return '';
  }).join('');
}

function isiHtml(isi: string, k: Konteks): string {
  const keluar: string[] = [];
  let daftar: 'ul' | 'ol' | 'tugas' | null = null;
  const tutup = () => { if (daftar) keluar.push(daftar === 'ol' ? '</ol>' : '</ul>'); daftar = null; };
  const buka = (j: 'ul' | 'ol' | 'tugas') => {
    if (daftar === j) return;
    tutup();
    keluar.push(j === 'ol' ? '<ol>' : j === 'tugas' ? '<ul class="tugas">' : '<ul>');
    daftar = j;
  };
  for (const b of uraiBlok(isi)) {
    switch (b.jenis) {
      case 'butir': buka('ul'); keluar.push(`<li>${inline(b.teks, k)}</li>`); continue;
      case 'nomor': buka('ol'); keluar.push(`<li>${inline(b.teks, k)}</li>`); continue;
      case 'ceklis':
        buka('tugas');
        keluar.push(`<li class="${b.selesai ? 'selesai' : ''}"><span class="kotak" aria-hidden="true">${b.selesai ? '✓' : ''}</span><span>${inline(b.teks, k, b.selesai)}</span></li>`);
        continue;
      default: tutup();
    }
    switch (b.jenis) {
      case 'judul': keluar.push(`<h${b.tingkat + 1}>${inline(b.teks, k)}</h${b.tingkat + 1}>`); break;
      case 'kutipan': keluar.push(`<blockquote>${inline(b.teks, k)}</blockquote>`); break;
      case 'penting': keluar.push(`<aside class="penting"><span aria-hidden="true">ⓘ</span><div>${inline(b.teks, k)}</div></aside>`); break;
      case 'garis': keluar.push('<hr>'); break;
      case 'gambar':
        keluar.push(`<figure><img src="${esc(jalurBerkas(k.token, b.kunci))}" alt="${esc(b.nama)}" loading="lazy">${b.nama && b.nama !== 'foto' ? `<figcaption>${esc(b.nama)}</figcaption>` : ''}</figure>`);
        break;
      case 'berkas': keluar.push(`<p><a class="chip" href="${esc(jalurBerkas(k.token, b.kunci))}" download="${esc(b.nama)}">📎 ${esc(b.nama)}</a></p>`); break;
      case 'kosong': keluar.push('<div class="jarak"></div>'); break;
      case 'teks': keluar.push(`<p>${inline(b.teks, k)}</p>`); break;
      default:
    }
  }
  tutup();
  return keluar.join('\n');
}

/** Nilai kolom kustom memo sebagai teks (sama dengan teksNilai di aplikasi). */
function nilaiProperti(tipe: string, v: unknown, nama: Map<string, string>): string {
  if (v === undefined || v === null || v === '') return '';
  if (tipe === 'checkbox') return v ? 'Ya' : 'Tidak';
  if (tipe === 'orang') return nama.get(String(v)) ?? String(v);
  if (tipe === 'tanggal' && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) return tanggalIndonesia(String(v));
  return String(v);
}

export async function halamanLihatMemo(token: string, env: Env): Promise<Response> {
  const memo = await memoDariToken(env, token);
  if (!memo) {
    return halaman('Tautan tidak berlaku', `
      <header class="kepala"><h1>Tautan tidak berlaku</h1>
      <p>Tautan memo ini sudah dimatikan, memonya dihapus, atau alamatnya salah. Minta tautan baru ke pengirimnya.</p></header>`, 404);
  }
  await env.DB.prepare('UPDATE tautan_bagi SET dibuka = dibuka + 1 WHERE token = ?1').bind(token).run();

  const [tim, properti] = await Promise.all([
    env.DB.prepare('SELECT id, nama FROM tim').all<{ id: string; nama: string }>(),
    env.DB.prepare(`SELECT id, label, tipe FROM properti WHERE entitas = 'memo' ORDER BY urutan`).all<{ id: string; label: string; tipe: string }>(),
  ]);
  const nama = new Map(tim.results.map((t) => [t.id, t.nama]));
  const k: Konteks = { token, nama, hariIni: tanggalWita() };

  let props: Record<string, unknown> = {};
  try { props = JSON.parse(memo.props || '{}') as Record<string, unknown>; } catch { /* biarkan kosong */ }

  const { selesai, total } = hitungTugas(memo.isi);
  const baris: [string, string][] = [];
  if (memo.lingkup === 'tim') {
    if (memo.kategori) baris.push(['Kategori', esc(memo.kategori)]);
    if (memo.tipe) baris.push(['Tipe', esc(memo.tipe)]);
    if (memo.status) baris.push(['Status', `<span class="lencana">${esc(memo.status)}</span>`]);
    if (memo.tanggal) baris.push(['Tanggal', esc(tanggalIndonesia(memo.tanggal.slice(0, 10)))]);
  }
  if (memo.penulis) baris.push(['Penulis', esc(memo.penulis)]);
  if (memo.pica_id) {
    const no = memo.pica_no ? `PICA-${String(memo.pica_no).padStart(3, '0')} · ` : '';
    baris.push(['PICA', esc(`${no}${memo.pica_judul ?? memo.pica_id}`)]);
  }
  if (total) baris.push(['Tugas', `${selesai} dari ${total} selesai`]);
  if (memo.lingkup === 'tim') {
    for (const p of properti.results) {
      const v = nilaiProperti(p.tipe, props[p.id], nama);
      if (!v) continue;
      baris.push([esc(p.label), p.tipe === 'url' && /^https?:\/\//.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener noreferrer nofollow">${esc(v)}</a>` : esc(v)]);
    }
  }

  const diubah = memo.diubah_pada ?? memo.dibuat_pada;
  const waktu = (() => {
    const d = new Date(diubah.endsWith('Z') || diubah.includes('+') ? diubah : `${diubah}Z`);
    return Number.isNaN(d.getTime()) ? '' : `${tanggalIndonesia(tanggalWita(d))} ${jamWita(d)} WITA`;
  })();

  const judul = memo.judul.trim() || 'Tanpa judul';
  return halaman(judul, `
    <article>
      <header class="kepala">
        <p class="asal">POKEMONKEY · Memo${memo.lingkup === 'tim' ? ' Internal' : ''} · hanya-baca</p>
        <h1>${esc(judul)}</h1>
        ${baris.length ? `<dl>${baris.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>` : ''}
        ${memo.ringkasan ? `<p class="ringkasan">${esc(memo.ringkasan)}</p>` : ''}
      </header>
      <div class="isi">${memo.isi.trim() ? isiHtml(memo.isi, k) : '<p class="redup">Memo ini belum berisi.</p>'}</div>
    </article>
    <footer>Dibagikan dari POKEMONKEY${waktu ? ` · diperbarui ${waktu}` : ''}<br>Isi selalu mengikuti memo terbaru selama tautan masih aktif.</footer>`);
}

/** Gambar/berkas memo untuk halaman publik: hanya milik memo itu dan yang memang disebut di isinya. */
export async function berkasLihatMemo(token: string, url: URL, env: Env): Promise<Response> {
  const kunci = url.searchParams.get('k') ?? '';
  const memo = await memoDariToken(env, token);
  if (!memo || !kunci.startsWith(`memo/${memo.id}/`) || !memo.isi.includes(`(${kunci})`)) {
    return new Response('Tidak ditemukan', { status: 404 });
  }
  const objek = await env.BUKET.get(kunci);
  if (!objek) return new Response('Tidak ditemukan', { status: 404 });
  const headers = new Headers();
  objek.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, max-age=3600');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(objek.body, { headers });
}

// ---------------------------------------------------------------------------
// Kerangka halaman (gaya kotak piksel POKEMONKEY, terang/gelap mengikuti HP)
// ---------------------------------------------------------------------------

function halaman(judul: string, isi: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta property="og:title" content="${esc(judul)}">
<meta property="og:description" content="Memo POKEMONKEY (hanya-baca)">
<title>${esc(judul)} · POKEMONKEY</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&display=swap">
<style>
  :root {
    --latar: #eef1ea; --kartu: #ffffff; --tinta: #16191d; --redup: #57606a; --garis: #16191d; --bayang: #a9b2ab;
    --hijau: #1f6b3a; --hijau-muda: #e3f3e8; --telat: #b42318; --telat-muda: #fde8e6; --dekat: #9a5b00; --dekat-muda: #fdf1dc;
    --biru: #1d4f91; --biru-muda: #e4eefb; --amber: #9a5b00; --amber-muda: #fdf1dc;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --latar: #121513; --kartu: #1c211e; --tinta: #eef1ea; --redup: #a3aca6; --garis: #3d4640; --bayang: #000000;
      --hijau: #6fdc97; --hijau-muda: #14301f; --telat: #ff8a80; --telat-muda: #3a1715; --dekat: #f5b84d; --dekat-muda: #3a2a0e;
      --biru: #8cb8ff; --biru-muda: #15233a; --amber: #f5b84d; --amber-muda: #3a2a0e;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--latar); color: var(--tinta); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; padding: 16px; }
  main { max-width: 760px; margin: 0 auto; display: grid; gap: 16px; }
  article { background: var(--kartu); border: 3px solid var(--garis); box-shadow: 4px 4px 0 var(--bayang); padding: 18px 18px 22px; overflow-wrap: anywhere; }
  h1, h2, h3, h4 { font-family: "Pixelify Sans", system-ui, sans-serif; letter-spacing: 0.02em; line-height: 1.25; }
  h1 { font-size: 28px; margin: 4px 0 12px; }
  h2 { font-size: 22px; margin: 22px 0 6px; color: var(--hijau); }
  h3 { font-size: 18px; margin: 16px 0 4px; }
  h4 { font-size: 16px; margin: 12px 0 2px; }
  .asal { margin: 0; font-size: 12px; color: var(--redup); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 14px; margin: 0 0 12px; font-size: 14px; }
  dt { color: var(--redup); }
  dd { margin: 0; }
  .ringkasan { margin: 0 0 4px; padding: 8px 12px; border-left: 4px solid var(--hijau); background: var(--hijau-muda); font-size: 15px; }
  .isi { border-top: 3px dashed var(--garis); margin-top: 12px; padding-top: 6px; }
  .isi p { margin: 4px 0; }
  .jarak { height: 8px; }
  ul, ol { margin: 4px 0; padding-left: 24px; }
  ul:not(.tugas) { list-style: square; }
  ul.tugas { list-style: none; padding-left: 0; }
  ul.tugas li { display: flex; gap: 10px; align-items: flex-start; margin: 3px 0; }
  .kotak { flex: none; width: 18px; height: 18px; margin-top: 3px; border: 2px solid var(--garis); display: inline-flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #fff; }
  li.selesai .kotak { background: var(--hijau); border-color: var(--hijau); }
  li.selesai > span:last-child { text-decoration: line-through; color: var(--redup); }
  blockquote { margin: 8px 0; padding: 2px 12px; border-left: 4px solid var(--hijau); color: var(--redup); font-style: italic; }
  .penting { display: flex; gap: 10px; margin: 8px 0; padding: 10px 12px; border: 2px solid var(--amber); background: var(--amber-muda); }
  .penting > span { color: var(--amber); font-weight: 700; }
  hr { border: none; border-top: 3px dashed var(--garis); margin: 14px 0; }
  figure { margin: 10px 0; }
  img { max-width: 100%; height: auto; border: 3px solid var(--garis); display: block; }
  figcaption { font-size: 12px; color: var(--redup); margin-top: 2px; }
  code { font: 14px ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--latar); border: 1px solid var(--garis); padding: 0 4px; }
  a { color: var(--biru); }
  .chip { display: inline-block; font-size: 13px; font-weight: 700; padding: 0 6px; border: 2px solid currentColor; white-space: nowrap; text-decoration: none; }
  .chip.telat { color: var(--telat); background: var(--telat-muda); }
  .chip.dekat { color: var(--dekat); background: var(--dekat-muda); }
  .chip.aman { color: var(--biru); background: var(--biru-muda); }
  .chip.redup { color: var(--redup); }
  .chip.orang { color: var(--hijau); background: var(--hijau-muda); }
  .chip.pica { color: var(--amber); background: var(--amber-muda); }
  .lencana { font-size: 13px; font-weight: 700; padding: 0 8px; border: 2px solid var(--garis); }
  .redup { color: var(--redup); }
  .kepala p { color: var(--redup); }
  footer { color: var(--redup); font-size: 12px; text-align: center; padding-bottom: 8px; line-height: 1.5; }
</style>
</head>
<body><main>${isi}</main></body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      // Isi memo sudah di-escape; CSP tetap menutup kemungkinan skrip dari mana pun.
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    },
  });
}
