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
import katex from 'katex';
import { htmlGrafikReklamasi, type BarisReklamasi } from './grafik-memo';
import { cssTemaGrafik, hitungGrafikTabel, htmlKartuGrafikTabel, kolomStatusTabel, kontras, statusBaku } from './grafik-tabel';
import { daftarJudul, uraiBlok, uraiInline, hitungTugas, hakMemo, type Blok, type Inline } from './memo-blok';
import { jamWita, selisihHari, tanggalIndonesia, tanggalWita } from './waktu';
import { BAHASA_KODE, CSS_SAMPUL_WARNA, GALERI_SAMPUL, WARNA_KODE, gayaWarna, paletOpsi, posisiY, sorotKode, warnaTenggat } from './tampil-memo';

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
  const memo = await env.DB.prepare('SELECT id, user_id, lingkup, judul, akses FROM memo WHERE id = ?1 AND dihapus_pada IS NULL')
    .bind(memoId).first<{ id: string; user_id: string; lingkup: string; judul: string; akses: string | null }>();
  const hak = memo ? hakMemo(memo, pengguna) : null;
  if (!memo || !hak) return galat('Memo tidak ditemukan.', 404);
  // Membagikan ke web = akses penuh (pembuat, Admin, Supervisor), seperti Share di Notion.
  const boleh = hak === 'penuh';
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
  status: string | null; tanggal: string | null; lingkup: string; props: string | null; pica_id: string | null; induk_id: string | null;
  dibuat_pada: string; diubah_pada: string | null; penulis: string | null; pica_no: number | null; pica_judul: string | null;
}

const PILIH_MEMO = `SELECT m.id, m.judul, m.isi, m.ringkasan, m.kategori, m.tipe, m.status, m.tanggal, m.lingkup, m.props, m.pica_id, m.induk_id,
            m.dibuat_pada, m.diubah_pada, t.nama AS penulis, p.no_urut AS pica_no, p.judul AS pica_judul
       FROM memo m LEFT JOIN tim t ON t.id = m.user_id LEFT JOIN pica p ON p.id = m.pica_id
      WHERE m.id = ?1 AND m.dihapus_pada IS NULL`; // memo di Sampah: tautannya tidak berlaku sampai dipulihkan

/** Isi tautan: memo yang dibagikan (`akar`), halaman yang sedang dibuka, dan leluhurnya di antara keduanya. */
interface Terbagi { akar: MemoLihat; memo: MemoLihat; jalur: MemoLihat[] }

/**
 * Memo di balik token yang masih berlaku, atau null. Seperti "Share to web" di Notion,
 * sub-halaman memo itu ikut terbuka (`h` = id sub-halaman); halaman lain tidak.
 */
async function memoDariToken(env: Env, token: string, h?: string | null): Promise<Terbagi | null> {
  const t = await env.DB.prepare(
    `SELECT objek_id, kedaluwarsa FROM tautan_bagi WHERE token = ?1 AND cakupan = 'memo' AND aktif = 1`,
  ).bind(token).first<{ objek_id: string | null; kedaluwarsa: string | null }>();
  if (!t?.objek_id) return null;
  if (t.kedaluwarsa && Date.parse(t.kedaluwarsa) < Date.now()) return null;
  const ambil = (id: string) => env.DB.prepare(PILIH_MEMO).bind(id).first<MemoLihat>();
  const akar = await ambil(t.objek_id);
  if (!akar) return null;
  if (!h || h === akar.id) return { akar, memo: akar, jalur: [] };
  const memo = await ambil(h);
  if (!memo) return null;
  // Naik ke induk sampai bertemu memo yang dibagikan; tidak bertemu = bukan sub-halamannya.
  const antara: MemoLihat[] = [];
  let x = memo;
  for (let i = 0; i < 20; i += 1) {
    if (!x.induk_id) return null;
    if (x.induk_id === akar.id) return { akar, memo, jalur: [akar, ...antara.reverse()] };
    const p = await ambil(x.induk_id);
    if (!p) return null;
    antara.push(p);
    x = p;
  }
  return null;
}

const bacaPropsMemo = (m: Pick<MemoLihat, 'props'>): Record<string, unknown> => {
  try { const v = JSON.parse(m.props || '{}'); return v && typeof v === 'object' ? v as Record<string, unknown> : {}; } catch { return {}; }
};
const ikonDari = (m: Pick<MemoLihat, 'props'>): string => {
  const v = bacaPropsMemo(m).ikon;
  return typeof v === 'string' ? v : '';
};

const jalurBerkas = (token: string, kunci: string, h?: string) =>
  `/lihat/memo/${token}/berkas?k=${encodeURIComponent(kunci)}${h ? `&h=${encodeURIComponent(h)}` : ''}`;
const jalurHalaman = (token: string, h?: string) => `/lihat/memo/${token}${h ? `?h=${encodeURIComponent(h)}` : ''}`;

interface InfoHalaman { judul: string; ikon: string; anak: boolean }
interface Konteks {
  token: string; nama: Map<string, string>; hariIni: string;
  /** Id halaman yang sedang dibuka bila bukan memo akar (untuk alamat berkas). */
  h?: string;
  /** Halaman yang disebut di isi: judul terkini; `anak` = sub-halaman yang ikut dibagikan. */
  halaman: Map<string, InfoHalaman>;
  /** Judul-judul memo untuk blok daftar isi. */
  judul?: { indeks: number; tingkat: number; teks: string }[];
  /** Data realisasi revegetasi (hanya dimuat bila memo memuat blok grafik). */
  revegetasi?: BarisReklamasi[];
}

/** Rumus LaTeX → MathML (tanpa CSS/huruf tambahan; aman: KaTeX meng-escape masukannya). */
function htmlRumus(tex: string, blok: boolean): string {
  try {
    return katex.renderToString(tex, { output: 'mathml', throwOnError: false, displayMode: blok, strict: 'ignore' });
  } catch {
    return `<code>${esc(tex)}</code>`;
  }
}

// Ikon garis (lucide, sama dengan aplikasi), digambar sebaris tanpa berkas luar.
const IKON: Record<string, string> = {
  kategori: '<path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/><path d="M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l3.58-3.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="6.5" cy="9.5" r=".5" fill="currentColor"/>',
  tipe: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/>',
  status: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
  tanggal: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  penulis: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  pica: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  tugas: '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  kolom: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  ringkasan: '<path d="M15 12H3M17 18H3M21 6H3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  jam: '<path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5M16 2v4M8 2v4M3 10h5"/><path d="M17.5 17.5 16 16.3V14"/><circle cx="16" cy="16" r="6"/>',
  berkas: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  video: '<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  luar: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  kunci: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  tim: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
};
const ikon = (nama: string, ukuran = 14) =>
  `<svg width="${ukuran}" height="${ukuran}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKON[nama] ?? ''}</svg>`;

const tglPendek = (t: string) => {
  const [, m, d] = t.slice(0, 10).split('-').map(Number);
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m - 1] ?? ''}`;
};

/** Isi satu baris, sama dengan TeksInline di aplikasi (MemoMarkup.tsx). */
function inline(teks: string, k: Konteks, selesai = false): string {
  return inlineDaftar(uraiInline(teks), k, selesai);
}

function inlineDaftar(daftar: Inline[], k: Konteks, selesai: boolean): string {
  return daftar.map((x) => {
    switch (x.t) {
      case 'teks': return esc(x.v);
      case 'baris': return '<br>';
      case 'garisbawah': return `<u>${esc(x.v)}</u>`;
      case 'warna': {
        const w = gayaWarna(x.jenis, x.warna, true);
        const gaya = `${w.color ? `color:${w.color};` : ''}${w.background ? `background:${w.background};padding:0 2px;` : ''}`;
        return `<span style="${gaya}">${inlineDaftar(x.isi, k, selesai)}</span>`;
      }
      case 'rumus': return `<span class="rumus">${htmlRumus(x.v, false)}</span>`;
      case 'tebal': return `<b>${esc(x.v)}</b>`;
      case 'miring': return `<i>${esc(x.v)}</i>`;
      case 'coret': return `<s>${esc(x.v)}</s>`;
      case 'kode': return `<code>${esc(x.v)}</code>`;
      case 'tautan': return `<a class="tautan" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(x.v)}</a>`;
      case 'berkas': return `<a class="berkas" href="${esc(jalurBerkas(k.token, x.kunci, k.h))}" download="${esc(x.v)}">${ikon('berkas', 13)}${esc(x.v)}</a>`;
      case 'tenggat': {
        const w = warnaTenggat(selisihHari(x.tanggal, k.hariIni), selesai);
        return `<span class="chip" style="border-color:${w.garis};color:${w.teks};background:${w.latar}" title="Tenggat ${esc(tanggalIndonesia(x.tanggal))}">${ikon('jam', 11)}${esc(tglPendek(x.tanggal))}${x.jam ? ` ${esc(x.jam)}` : ''}</span>`;
      }
      case 'orang': {
        const nama = k.nama.get(x.id);
        return nama ? `<span class="chip orang" title="Penanggung jawab: ${esc(nama)}">@${esc(nama.split(' ')[0])}</span>` : esc(`@${x.id}`);
      }
      case 'pica': return `<span class="chip pica">${esc(x.id)}</span>`;
      case 'halaman': {
        // Sub-halaman ikut dibagikan (bisa dibuka); tautan ke memo lain tampil sebagai nama saja.
        const h = k.halaman.get(x.id);
        if (!h) return `<span class="chip halaman hilang" title="Halaman tidak tersedia">📄 ${esc(x.v || 'Tanpa judul')}</span>`;
        const isi = `${esc(h.ikon || '📄')} ${esc(h.judul)}`;
        return h.anak ? `<a class="chip halaman" href="${esc(jalurHalaman(k.token, x.id))}">${isi}</a>` : `<span class="chip halaman">${isi}</span>`;
      }
    }
    return '';
  }).join('');
}

/** Blok beserta anak-anaknya (pohon tampilan, seperti "content" di Notion); `i` = nomor blok (jangkar daftar isi). */
interface Simpul { b: Blok; anak: Simpul[]; i: number }

function pohonBlok(daftar: Blok[]): Simpul[] {
  const akar: Simpul[] = [];
  const tumpuk: Simpul[] = [];
  for (const [i, b] of daftar.entries()) {
    const simpul: Simpul = { b, anak: [], i };
    while (tumpuk.length && tumpuk[tumpuk.length - 1].b.kedalaman >= b.kedalaman) tumpuk.pop();
    (tumpuk.length ? tumpuk[tumpuk.length - 1].anak : akar).push(simpul);
    tumpuk.push(simpul);
  }
  return akar;
}

/** Blok seperti IsiMemo (mode baca) di aplikasi: anak digeser 1,5em, toggle tertutup secara bawaan. */
function htmlSimpul(simpul: Simpul[], k: Konteks): string {
  const keluar: string[] = [];
  for (let i = 0; i < simpul.length; i += 1) {
    // Kolom bersebelahan = satu baris kolom (di HP bertumpuk), isi tiap kolom = anaknya.
    if (simpul[i].b.jenis === 'kolom') {
      const kolom: string[] = [];
      while (i < simpul.length && simpul[i].b.jenis === 'kolom') { kolom.push(`<div class="kolom">${htmlSimpul(simpul[i].anak, k)}</div>`); i += 1; }
      i -= 1;
      keluar.push(`<div class="kolom-baris">${kolom.join('')}</div>`);
      continue;
    }
    keluar.push(htmlSatu(simpul[i], k));
  }
  return keluar.join('\n');
}

function htmlSatu({ b, anak, i }: Simpul, k: Konteks): string {
  {
    const isiAnak = anak.length ? `<div class="anak">${htmlSimpul(anak, k)}</div>` : '';
    switch (b.jenis) {
      // <details> bawaan peramban: bisa dibuka/dilipat tanpa skrip.
      case 'toggle':
        return `<details class="toggle"><summary><span class="panah" aria-hidden="true">▸</span><span>${inline(b.teks, k)}</span></summary>${isiAnak || '<div class="anak redup">Toggle kosong</div>'}</details>`;
      case 'judul': return `<h${b.tingkat + 1} class="j${b.tingkat}" id="b${i}">${inline(b.teks, k)}</h${b.tingkat + 1}>${isiAnak}`;
      case 'ceklis':
        return `<div class="ceklis${b.selesai ? ' selesai' : ''}"><span class="kotak" aria-hidden="true">${b.selesai ? '✓' : ''}</span><span>${inline(b.teks, k, b.selesai)}</span></div>${isiAnak}`;
      case 'butir': return `<div class="butir"><span class="titik" aria-hidden="true"></span><span>${inline(b.teks, k)}</span></div>${isiAnak}`;
      case 'nomor': return `<div class="nomor"><span class="no">${b.no}.</span>${inline(b.teks, k)}</div>${isiAnak}`;
      case 'kutipan': return `<blockquote>${inline(b.teks, k)}</blockquote>${isiAnak}`;
      case 'penting': return `<aside class="penting">${ikon('info', 15)}<div>${inline(b.teks, k)}</div></aside>${isiAnak}`;
      case 'garis': return `<hr>${isiAnak}`;
      case 'gambar': {
        // Lebar & perataan sama dengan halaman memo.
        const gaya = `${b.lebar ? `width:${b.lebar}%;` : ''}${b.rata === 'tengah' ? 'margin-left:auto;margin-right:auto;text-align:center;' : b.rata === 'kanan' ? 'margin-left:auto;text-align:right;' : ''}`;
        return `<figure${gaya ? ` style="${gaya}"` : ''}><img src="${esc(jalurBerkas(k.token, b.kunci, k.h))}" alt="${esc(b.nama)}" loading="lazy"${b.lebar ? ' style="width:100%;max-height:none"' : ''}>${b.nama && b.nama !== 'foto' ? `<figcaption>${esc(b.nama)}</figcaption>` : ''}</figure>${isiAnak}`;
      }
      case 'kode': {
        const label = BAHASA_KODE.find((x) => x.id === b.bahasa)?.label ?? b.bahasa;
        const isi = sorotKode(b.isi, b.bahasa).map((x) => `<span style="color:${WARNA_KODE[x.t].gelap}">${esc(x.v)}</span>`).join('');
        return `<div class="kode"><div class="kode-kepala">${esc(label)}</div><pre><code>${isi}</code></pre></div>${isiAnak}`;
      }
      case 'rumus': return `<div class="rumus-blok">${htmlRumus(b.isi, true)}</div>${isiAnak}`;
      case 'grafik': return `${htmlGrafikReklamasi(b, k.revegetasi ?? [])}${isiAnak}`;
      case 'daftarisi': {
        const judul = k.judul ?? [];
        return `<nav class="daftar-isi" aria-label="Daftar isi">${judul.length ? judul.map((j) => `<a href="#b${j.indeks}" style="padding-left:${(j.tingkat - 1) * 1.25}em">${esc(j.teks || 'Tanpa judul')}</a>`).join('') : '<span class="redup">Daftar isi kosong</span>'}</nav>${isiAnak}`;
      }
      case 'penanda':
        return `<a class="penanda" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer nofollow"><b>${esc(b.judul || b.url)}</b>${b.ket ? `<span>${esc(b.ket)}</span>` : ''}<small>${ikon('luar', 11)} ${esc(b.situs || b.url)}</small></a>${isiAnak}`;
      case 'berkas': return `<p><a class="berkas blok" href="${esc(jalurBerkas(k.token, b.kunci, k.h))}" download="${esc(b.nama)}">${ikon('berkas', 13)}${esc(b.nama)}</a></p>${isiAnak}`;
      case 'video': {
        let situs = b.url;
        try { situs = new URL(b.url).hostname.replace(/^www\./, ''); } catch { /* biarkan alamat utuh */ }
        return `<a class="video" href="${esc(b.url)}" target="_blank" rel="noopener noreferrer nofollow"><span class="layar">${ikon('video', 28)}</span><span class="kaki">${ikon('video', 13)}<b>${esc(b.judul || 'Video')}</b><small>${esc(situs)}</small>${ikon('luar', 12)}</span></a>${isiAnak}`;
      }
      case 'tabel': {
        // Sama dengan aplikasi: kolom status berupa lencana berwarna, grafik tersambung di bawah tabel.
        const kolomStatus = kolomStatusTabel(b.baris, b.kepala);
        const sel = (c: string, i: number, j: number) => {
          if (b.kepala && i === 0) return `<th>${inline(c, k)}</th>`;
          const st = j === kolomStatus ? statusBaku(c) : null;
          return st
            ? `<td><span style="display:inline-block;padding:1px 7px;border:2px solid #0f172a;background:${st.warna};color:${kontras(st.warna)};font-weight:700;font-size:12px;white-space:nowrap">${esc(b.pica ? st.label : c)}</span></td>`
            : `<td>${inline(c, k)}</td>`;
        };
        const dg = b.grafik?.aktif ? hitungGrafikTabel(b.baris, b.kepala, b.grafik, Boolean(b.pica)) : null;
        return `<div class="tabel"><table>${b.baris.map((r, i) => `<tr>${r.map((c, j) => sel(c, i, j)).join('')}</tr>`).join('')}</table></div>${dg ? htmlKartuGrafikTabel(dg) : ''}${isiAnak}`;
      }
      case 'data':
        return `<aside class="penting" style="border-color:rgba(132,204,22,.5);background:rgba(26,46,5,.3);">${ikon('info', 15)}<div><b>Data ${b.sumber === 'nursery' ? 'Smart Nursery' : 'Geotagging Lapangan'}</b>: Data operasional internal disembunyikan pada tautan publik (hanya tampil setelah masuk/login).</div></aside>${isiAnak}`;
      case 'kosong': return `<div class="jarak"></div>${isiAnak}`;
      case 'teks': return `<p>${inline(b.teks, k)}</p>${isiAnak}`;
      default: return isiAnak;
    }
  }
}

const isiHtml = (isi: string, k: Konteks): string => htmlSimpul(pohonBlok(uraiBlok(isi)), k);

/** Nilai kolom kustom memo sebagai teks (sama dengan teksNilai di aplikasi). */
function nilaiProperti(tipe: string, v: unknown, nama: Map<string, string>): string {
  if (v === undefined || v === null || v === '') return '';
  if (tipe === 'checkbox') return v ? 'Ya' : 'Tidak';
  if (tipe === 'orang') return nama.get(String(v)) ?? String(v);
  if (tipe === 'tanggal' && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) return tanggalIndonesia(String(v));
  return String(v);
}

/** Sampul seperti SampulMemo: pita setinggi 120/180/210 px, posisi tegak tersimpan. */
function htmlSampul(memo: MemoLihat, k: Konteks): string {
  const p = bacaPropsMemo(memo);
  const kode = typeof p.sampul === 'string' ? p.sampul : '';
  if (!kode) return '';
  if (CSS_SAMPUL_WARNA[kode]) return `<div class="sampul" style="${CSS_SAMPUL_WARNA[kode]}"></div>`;
  const y = posisiY(p.sampul_y, kode);
  const galeri = GALERI_SAMPUL[kode];
  if (galeri) {
    return `<div class="sampul${galeri.utuh ? ' utuh' : ''}"><img src="/${esc(galeri.berkas)}" alt="" style="object-position:center ${y}%"></div>`;
  }
  if (/^(memo|demo)\//.test(kode)) return `<div class="sampul"><img src="${esc(jalurBerkas(k.token, kode, k.h))}" alt="" style="object-position:center ${y}%"></div>`;
  return '';
}

export async function halamanLihatMemo(token: string, env: Env, url?: URL): Promise<Response> {
  const terbagi = await memoDariToken(env, token, url?.searchParams.get('h'));
  if (!terbagi) {
    return halaman('Tautan tidak berlaku', `
      <article class="pesan"><h1>Tautan tidak berlaku</h1>
      <p>Tautan memo ini sudah dimatikan, memonya dihapus atau ada di Sampah, atau alamatnya salah. Minta tautan baru ke pengirimnya.</p></article>`, 404);
  }
  const { akar, memo, jalur } = terbagi;
  if (memo.id === akar.id) await env.DB.prepare('UPDATE tautan_bagi SET dibuka = dibuka + 1 WHERE token = ?1').bind(token).run();

  // Halaman yang disebut di isi: judul & ikon terkini, dan apakah ia sub-halaman yang ikut terbuka.
  const disebut = uraiBlok(memo.isi)
    .flatMap((b) => ('teks' in b ? uraiInline(b.teks) : b.jenis === 'tabel' ? b.baris.flat().flatMap((c) => uraiInline(c)) : []))
    .flatMap((x) => (x.t === 'halaman' ? [x.id] : []));
  const [tim, properti, opsi, halamanDisebut] = await Promise.all([
    env.DB.prepare('SELECT id, nama FROM tim').all<{ id: string; nama: string }>(),
    env.DB.prepare(`SELECT id, label, tipe FROM properti WHERE entitas = 'memo' AND aktif = 1 ORDER BY urutan`).all<{ id: string; label: string; tipe: string }>(),
    env.DB.prepare(`SELECT grup, nilai, label, warna FROM opsi WHERE grup IN ('memo_kategori', 'memo_tipe', 'memo_status')`).all<{ grup: string; nilai: string; label: string | null; warna: string | null }>(),
    disebut.length
      ? env.DB.prepare(`SELECT id, judul, props, induk_id, lingkup FROM memo WHERE id IN (SELECT value FROM json_each(?1)) AND dihapus_pada IS NULL`)
        .bind(JSON.stringify([...new Set(disebut)])).all<{ id: string; judul: string; props: string | null; induk_id: string | null; lingkup: string }>()
      : Promise.resolve({ results: [] as { id: string; judul: string; props: string | null; induk_id: string | null; lingkup: string }[] }),
  ]);
  const nama = new Map(tim.results.map((t) => [t.id, t.nama]));
  const halamanPeta = new Map<string, InfoHalaman>();
  for (const h of halamanDisebut.results) {
    // Judul catatan pribadi orang lain tidak dibocorkan lewat memo tim.
    if (h.lingkup === 'pribadi' && memo.lingkup === 'tim') continue;
    halamanPeta.set(h.id, { judul: h.judul.trim() || 'Tanpa judul', ikon: ikonDari(h), anak: h.induk_id === memo.id });
  }
  const k: Konteks = { token, nama, hariIni: tanggalWita(), h: memo.id === akar.id ? undefined : memo.id, halaman: halamanPeta, judul: daftarJudul(memo.isi) };
  if (memo.isi.includes('!grafik{')) {
    const { results } = await env.DB.prepare('SELECT tahun, apl, hutan, ipd, opd, timbunan_soil, fasilitas, blok FROM revegetasi ORDER BY tahun')
      .all<Omit<BarisReklamasi, 'blok'> & { blok: string | null }>();
    k.revegetasi = results.map((r) => { let blok: Record<string, number> = {}; try { blok = JSON.parse(r.blok || '{}'); } catch { /* biarkan */ } return { ...r, blok }; });
  }
  const props = bacaPropsMemo(memo);

  // ---- Baris properti, sama dengan halaman memo (memo tim teratas saja; sub-halaman & catatan pribadi tanpa properti)
  const kosong = '<span class="kosong">Kosong</span>';
  const chipOpsi = (grup: string, nilai: string | null, bulat: boolean) => {
    if (!nilai) return kosong;
    const o = opsi.results.find((x) => x.grup === grup && x.nilai === nilai);
    const label = esc(o?.label ?? nilai);
    if (!bulat) return `<span class="opsi">${label}</span>`;
    const w = paletOpsi(o?.warna);
    return `<span class="opsi bulat" style="border-color:${w.garis};color:${w.teks};background:${w.latar}"><span style="background:${w.titik}"></span>${label}</span>`;
  };
  const baris: [string, string, string][] = [];
  if (memo.lingkup === 'tim' && !memo.induk_id) {
    const { selesai, total } = hitungTugas(memo.isi);
    baris.push(['kategori', 'Kategori', chipOpsi('memo_kategori', memo.kategori, true)]);
    baris.push(['tipe', 'Tipe', chipOpsi('memo_tipe', memo.tipe, false)]);
    baris.push(['status', 'Status', chipOpsi('memo_status', memo.status, true)]);
    baris.push(['tanggal', 'Tanggal', memo.tanggal ? esc(tanggalIndonesia(memo.tanggal.slice(0, 10))) : kosong]);
    baris.push(['penulis', 'Penulis', memo.penulis ? esc(memo.penulis) : kosong]);
    baris.push(['pica', 'PICA', memo.pica_id
      ? `<span class="chip pica">${esc(memo.pica_no ? `PICA-${String(memo.pica_no).padStart(3, '0')}` : 'PICA')}</span> ${esc(memo.pica_judul ?? '')}`
      : kosong]);
    if (total) baris.push(['tugas', 'Tugas', `<span class="chip ${selesai === total ? 'tuntas' : 'netral'}">${ikon('tugas', 11)}${selesai}/${total}</span>`]);
    for (const p of properti.results) {
      const v = nilaiProperti(p.tipe, props[p.id], nama);
      const isi = !v ? kosong
        : p.tipe === 'url' && /^https?:\/\//.test(v) ? `<a class="tautan" href="${esc(v)}" target="_blank" rel="noopener noreferrer nofollow">${esc(v)}</a>`
          : esc(v);
      baris.push(['kolom', esc(p.label), isi]);
    }
    baris.push(['ringkasan', 'Ringkasan', memo.ringkasan?.trim() ? `<span class="ringkasan">${esc(memo.ringkasan.trim())}</span>` : kosong]);
  }

  const diubah = memo.diubah_pada ?? memo.dibuat_pada;
  const waktu = (() => {
    const d = new Date(diubah.endsWith('Z') || diubah.includes('+') ? diubah : `${diubah}Z`);
    return Number.isNaN(d.getTime()) ? '' : `${tanggalIndonesia(tanggalWita(d))} ${jamWita(d)} WITA`;
  })();

  const judul = memo.judul.trim() || 'Tanpa judul';
  const ikonHalaman = ikonDari(memo);
  const sampul = htmlSampul(memo, k);
  const asal = memo.lingkup === 'tim' ? `${ikon('tim', 12)}Memo Internal` : `${ikon('kunci', 12)}Catatan Pribadi`;
  // Jalur: memo yang dibagikan → … → halaman ini (seperti breadcrumb di aplikasi).
  const remah = [...jalur.map((m) => `<a href="${esc(jalurHalaman(token, m.id === akar.id ? undefined : m.id))}">${esc(ikonDari(m))} ${esc(m.judul.trim() || 'Tanpa judul')}</a><span class="garis-miring">/</span>`), `<b>${esc(ikonHalaman)} ${esc(judul)}</b>`].join('');

  return halaman(judul, `
    <header class="bilah"><nav>${remah}</nav><span class="asal">${asal}</span></header>
    <article>
      ${sampul}
      <div class="badan">
        <div class="kepala${sampul ? ' bersampul' : ''}">
          ${ikonHalaman ? `<div class="ikon">${esc(ikonHalaman)}</div>` : ''}
          <h1>${esc(judul)}</h1>
        </div>
        ${baris.length ? `<div class="properti">${baris.map(([i, a, b]) => `<div class="baris"><span class="nama">${ikon(i)}<span>${a}</span></span><span class="nilai">${b}</span></div>`).join('')}</div>` : ''}
        <div class="isi${baris.length ? ' bergaris' : ''}">${memo.isi.trim() ? isiHtml(memo.isi, k) : '<p class="redup">Memo ini belum berisi.</p>'}</div>
      </div>
    </article>
    <footer>Dibagikan dari POKEMONKEY · hanya-baca${waktu ? ` · diperbarui ${waktu}` : ''}<br>Isi selalu mengikuti memo terbaru selama tautan masih aktif.</footer>`);
}

/** Gambar/berkas memo untuk halaman publik: hanya milik memo itu (atau sub-halamannya) dan yang memang dipakai di sana. */
export async function berkasLihatMemo(token: string, url: URL, env: Env): Promise<Response> {
  const kunci = url.searchParams.get('k') ?? '';
  const memo = (await memoDariToken(env, token, url.searchParams.get('h')))?.memo;
  const dipakai = memo && (memo.isi.includes(`(${kunci})`) || bacaPropsMemo(memo).sampul === kunci);
  if (!memo || !kunci.startsWith(`memo/${memo.id}/`) || !dipakai) {
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
// Kerangka halaman: sama dengan halaman memo di aplikasi (gelap, huruf piksel,
// lebar isi 780 px, ukuran blok mengikuti Notion seperti di aplikasi)
// ---------------------------------------------------------------------------

function halaman(judul: string, isi: string, status = 200): Response {
  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#09090b">
<meta property="og:title" content="${esc(judul)}">
<meta property="og:description" content="Memo POKEMONKEY (hanya-baca)">
<title>${esc(judul)} · POKEMONKEY</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;700&family=Press+Start+2P&display=swap">
<style>
  * { box-sizing: border-box; }
  html { background: #09090b; }
  :root { ${cssTemaGrafik(true)}; }
  body { margin: 0; background: #09090b; color: #f4f4f5; font: 16px/1.5 'Pixelify Sans', 'Segoe UI', system-ui, sans-serif; overflow-wrap: anywhere; }
  a { color: inherit; }
  svg { flex: none; display: inline-block; vertical-align: -2px; }
  .bilah { position: sticky; top: 0; z-index: 2; height: 48px; display: flex; align-items: center; gap: 10px; padding: 0 16px; background: #09090b; border-bottom: 2px solid rgba(255,255,255,.15); font-size: 13px; }
  .bilah nav { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; white-space: nowrap; }
  .bilah nav a { color: #a1a1aa; text-decoration: none; overflow: hidden; text-overflow: ellipsis; max-width: 9rem; }
  .bilah nav a:hover { color: #fff; }
  .bilah nav b { color: #fff; overflow: hidden; text-overflow: ellipsis; }
  .garis-miring { color: #52525b; }
  .asal { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; color: #71717a; white-space: nowrap; }
  .sampul { width: 100%; height: 120px; background: #27272a; }
  .sampul.utuh { background: #fff; }
  .sampul img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sampul.utuh img { object-fit: contain; }
  .badan { max-width: 780px; margin: 0 auto; padding: 0 16px 112px; }
  .kepala { padding-top: 32px; }
  .kepala.bersampul { padding-top: 0; }
  .ikon { font-size: 56px; line-height: 1; padding: 0 4px; }
  .kepala.bersampul .ikon { margin-top: -36px; }
  h1 { margin: 8px 0 0; font-size: 28px; line-height: 1.25; font-weight: 700; color: #fff; }
  .properti { margin-top: 16px; }
  .baris { display: flex; align-items: flex-start; gap: 8px; min-height: 34px; }
  .nama { width: 118px; flex: none; display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 6px; font-size: 13px; color: #a1a1aa; }
  .nama svg { opacity: .8; }
  .nama span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .nilai { flex: 1; min-width: 0; padding: 6px; font-size: 14px; color: #f4f4f5; }
  .kosong { color: #52525b; }
  .ringkasan { color: #e4e4e7; white-space: pre-wrap; }
  .opsi { display: inline-block; padding: 2px 6px; font-size: 12px; font-weight: 700; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2); color: #e4e4e7; white-space: nowrap; }
  .opsi.bulat { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border: 1px solid; }
  .opsi.bulat > span { width: 8px; height: 8px; }
  .isi { margin-top: 16px; }
  .isi.bergaris { border-top: 1px solid rgba(255,255,255,.15); margin-top: 12px; padding-top: 16px; }
  .anak { padding-left: 1.5em; }
  p { margin: 0; padding: 3px 0; color: #f4f4f5; }
  h2, h3, h4, h5 { margin: 0; padding: 3px 0; font-weight: 700; }
  .j1 { font-size: 1.875em; line-height: 1.3; color: #bef264; margin: 24px 0 2px; }
  .j2 { font-size: 1.5em; line-height: 1.3; color: #fff; margin-top: 20px; }
  .j3 { font-size: 1.25em; line-height: 1.3; color: #f4f4f5; margin-top: 12px; }
  .j4 { font-size: 1.0625em; line-height: 1.35; color: #e4e4e7; margin-top: 8px; }
  .isi > :first-child { margin-top: 0; }
  .butir { display: flex; align-items: flex-start; gap: 6px; color: #f4f4f5; }
  .butir .titik { width: 16px; flex: none; display: flex; justify-content: center; padding-top: 9px; }
  .butir .titik::before { content: ''; width: 6px; height: 6px; background: #d4d4d8; }
  .nomor { padding-left: 12px; color: #f4f4f5; }
  .nomor .no { color: #a1a1aa; margin-right: 4px; }
  .ceklis { display: flex; align-items: flex-start; gap: 8px; padding: 2px 0; color: #f4f4f5; }
  .ceklis .kotak { width: 14px; height: 14px; margin-top: 5px; flex: none; border: 1px solid #a1a1aa; background: #fff; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; }
  .ceklis.selesai .kotak { background: #84cc16; border-color: #84cc16; }
  .ceklis.selesai > span:last-child { text-decoration: line-through; color: #71717a; }
  .toggle summary { display: flex; align-items: flex-start; gap: 6px; padding: 3px 0; cursor: pointer; list-style: none; color: #f4f4f5; }
  .toggle summary::-webkit-details-marker { display: none; }
  .toggle .panah { width: 20px; height: 24px; flex: none; display: flex; align-items: center; justify-content: center; color: #d4d4d8; transition: transform .15s; }
  .toggle[open] > summary .panah { transform: rotate(90deg); }
  blockquote { margin: 2px 0; padding: 0 0 0 12px; border-left: 4px solid rgba(132,204,22,.6); color: #d4d4d8; font-style: italic; }
  .penting { display: flex; gap: 8px; margin: 4px 0; padding: 8px 12px; border: 2px solid rgba(251,191,36,.7); background: rgba(69,26,3,.3); color: #f4f4f5; }
  .penting svg { margin-top: 3px; color: #fcd34d; }
  hr { border: none; border-top: 2px dashed rgba(255,255,255,.2); margin: 8px 0; }
  figure { margin: 6px 0; }
  figure img { max-width: 100%; max-height: 420px; border: 2px solid rgba(255,255,255,.25); display: block; }
  figcaption { font-size: 11px; color: #71717a; margin-top: 2px; }
  code { padding: 0 4px; background: rgba(0,0,0,.4); border: 1px solid rgba(255,255,255,.15); color: #d9f99d; font-size: .92em; }
  b { color: #fff; }
  s { color: #a1a1aa; }
  .tautan { color: #7dd3fc; text-decoration: underline; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 0 6px; border: 1px solid; font-size: 12px; font-weight: 700; white-space: nowrap; vertical-align: baseline; text-decoration: none; }
  .chip.orang { border-color: rgba(132,204,22,.5); color: #d9f99d; background: rgba(26,46,5,.3); }
  .chip.pica { border-color: rgba(251,191,36,.6); color: #fde68a; background: rgba(69,26,3,.3); }
  .chip.halaman { border-color: rgba(255,255,255,.3); color: #f4f4f5; background: rgba(255,255,255,.05); text-decoration: underline; text-decoration-color: rgba(255,255,255,.3); font-size: .9em; }
  a.chip.halaman:hover { border-color: #a3e635; }
  .chip.halaman.hilang { border-color: rgba(255,255,255,.15); color: #71717a; background: none; text-decoration: line-through; }
  .chip.tuntas { border-color: rgba(132,204,22,.6); color: #bef264; }
  .chip.netral { border-color: rgba(255,255,255,.2); color: #d4d4d8; }
  .berkas { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border: 2px solid rgba(255,255,255,.25); background: rgba(255,255,255,.05); color: #f4f4f5; font-size: 13px; font-weight: 700; text-decoration: none; }
  .berkas.blok { display: flex; width: fit-content; margin: 4px 0; }
  .video { display: block; max-width: 560px; margin: 6px 0; border: 2px solid rgba(255,255,255,.25); background: rgba(0,0,0,.4); text-decoration: none; }
  .video:hover { border-color: #a3e635; }
  .video .layar { display: flex; align-items: center; justify-content: center; aspect-ratio: 16 / 6; background: #18181b; color: #a1a1aa; }
  .video .kaki { display: flex; align-items: center; gap: 8px; padding: 6px 8px; font-size: 13px; color: #a1a1aa; }
  .video .kaki b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #f4f4f5; }
  .video small { font-size: 11px; color: #71717a; }
  .tabel { overflow-x: auto; margin: 6px 0; }
  .tabel table { border-collapse: collapse; font-size: .9375em; }
  .tabel th, .tabel td { border: 2px solid rgba(255,255,255,.2); padding: 4px 8px; text-align: left; vertical-align: top; min-width: 90px; color: #f4f4f5; }
  u { text-decoration: underline; }
  .kode { margin: 6px 0; border: 2px solid rgba(255,255,255,.2); background: rgba(0,0,0,.6); }
  .kode-kepala { padding: 2px 8px; font-size: 11px; color: #a1a1aa; border-bottom: 1px solid rgba(255,255,255,.1); }
  .kode pre { margin: 0; padding: 8px 12px; overflow-x: auto; font: .85em/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
  .kode code { background: none; border: none; padding: 0; color: #e4e4e7; font-size: 1em; }
  .rumus-blok { margin: 8px 0; padding: 4px 0; overflow-x: auto; overflow-y: hidden; text-align: center; font-size: 1.2em; }
  .daftar-isi { margin: 6px 0; padding-left: 8px; border-left: 2px solid rgba(255,255,255,.15); }
  .daftar-isi a { display: block; padding: 2px 0; color: #d4d4d8; text-decoration: underline; text-decoration-color: rgba(255,255,255,.2); }
  .kolom-baris { display: grid; gap: 8px 24px; margin: 4px 0; }
  .kolom { min-width: 0; }
  .penanda { display: flex; flex-direction: column; gap: 2px; max-width: 640px; margin: 6px 0; padding: 8px 12px; border: 2px solid rgba(255,255,255,.25); background: rgba(255,255,255,.03); text-decoration: none; color: #f4f4f5; }
  .penanda:hover { border-color: #a3e635; }
  .penanda span { font-size: 12px; color: #a1a1aa; }
  .penanda small { font-size: 11px; color: #71717a; display: inline-flex; align-items: center; gap: 4px; }
  .tabel th { border-color: rgba(255,255,255,.25); background: rgba(255,255,255,.07); color: #fff; }
  .jarak { height: 8px; }
  .redup { color: #71717a; }
  .pesan { max-width: 560px; margin: 48px auto; padding: 0 16px; }
  .pesan p { color: #a1a1aa; }
  footer { color: #71717a; font-size: 12px; text-align: center; padding: 0 16px 24px; line-height: 1.5; }
  @media (min-width: 640px) {
    .kolom-baris { grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); }
    .bilah { padding: 0 24px; }
    .sampul { height: 180px; }
    .badan { padding: 0 48px 112px; }
    .kepala { padding-top: 56px; }
    .ikon { font-size: 68px; }
    .kepala.bersampul .ikon { margin-top: -44px; }
    h1 { font-size: 38px; }
    .nama { width: 190px; }
  }
  @media (min-width: 1024px) { .sampul { height: 210px; } }
</style>
</head>
<body>${isi}</body>
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
