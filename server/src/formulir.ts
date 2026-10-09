/**
 * Formulir di dalam memo (seperti Notion Forms). Blok di memo: `!formulir{"id":"frm_…"}`.
 * Jawaban tersimpan di `formulir_jawaban` dan tampil sebagai tabel rekap di blok itu.
 *
 *   POST   /api/formulir                       { memo_id } → formulir baru (butuh hak sunting memo)
 *   GET    /api/formulir/:id                   definisi + hak saya
 *   PATCH  /api/formulir/:id                   { judul, ket, skema, mode, sekali, tutup_pada }
 *   POST   /api/formulir/:id/kirim             { jawaban } — anggota yang login
 *   GET    /api/formulir/:id/jawaban           rekap (yang bisa menyunting memo)
 *   DELETE /api/formulir/:id/jawaban/:jid
 *   GET|POST /f/<token>                        halaman publik (mode 'publik'), tanpa login
 *
 * Mode 'anggota': semua anggota yang login boleh mengisi, walau tidak bisa membuka memonya
 * (mis. memo rahasia) — pengisi hanya melihat formulir, tidak melihat rekap.
 */

import type { Env, Pengguna } from './tipe';
import { hakMemo } from './memo-blok';
import { sekarangUtcIso, tanggalWita } from './waktu';
import { beriXp } from './xp';
import { bersihkanSkema, periksaJawaban, type Pertanyaan } from './formulir-skema';

export type { JenisPertanyaan, Pertanyaan } from './formulir-skema';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  });
}
const galat = (pesan: string, status = 400) => json({ galat: pesan }, status);
const idBaru = (awal: string) => `${awal}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const MAKS_JAWABAN_HARIAN_PUBLIK = 300;

interface BarisFormulir {
  id: string; memo_id: string; judul: string; ket: string | null; skema: string; mode: string; token: string | null;
  sekali: number; tutup_pada: string | null; dibuat_oleh: string; dibuat_pada: string;
}

const bentuk = (f: BarisFormulir) => ({ ...f, skema: bersihkanSkema(f.skema) });
const tertutup = (f: BarisFormulir) => Boolean(f.tutup_pada && tanggalWita() > f.tutup_pada);

async function hakMemoForm(env: Env, memoId: string, p: Pengguna) {
  const memo = await env.DB.prepare('SELECT user_id, lingkup, akses, izin FROM memo WHERE id = ?1 AND dihapus_pada IS NULL')
    .bind(memoId).first<{ user_id: string; lingkup: string; akses: string | null; izin: string | null }>();
  return memo ? hakMemo(memo, p) : null;
}

export async function ruteFormulir(jalur: string, req: Request, env: Env, pengguna: Pengguna): Promise<Response | null> {
  if (!jalur.startsWith('/api/formulir')) return null;
  const asal = new URL(req.url).origin;

  if (jalur === '/api/formulir' && req.method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { memo_id?: string; judul?: string };
    const hak = b.memo_id ? await hakMemoForm(env, b.memo_id, pengguna) : null;
    if (!hak) return galat('Memo tidak ditemukan.', 404);
    if (hak === 'baca') return galat('Memo ini diatur "Baca saja".', 403);
    const id = idBaru('frm');
    const skema: Pertanyaan[] = [
      { id: 'nama', label: 'Nama', jenis: 'teks', wajib: true },
      { id: 'q1', label: 'Pertanyaan pertama', jenis: 'teks' },
    ];
    await env.DB.prepare(
      'INSERT INTO formulir (id, memo_id, judul, skema, dibuat_oleh, dibuat_pada) VALUES (?1,?2,?3,?4,?5,?6)',
    ).bind(id, b.memo_id, String(b.judul ?? 'Formulir').slice(0, 160), JSON.stringify(skema), pengguna.id, sekarangUtcIso()).run();
    return json({ id }, 201);
  }

  const m = jalur.match(/^\/api\/formulir\/([\w-]+)(?:\/(kirim|jawaban)(?:\/([\w-]+))?)?$/);
  if (!m) return null;
  const f = await env.DB.prepare('SELECT * FROM formulir WHERE id = ?1').bind(m[1]).first<BarisFormulir>();
  if (!f) return galat('Formulir tidak ditemukan.', 404);
  const hak = await hakMemoForm(env, f.memo_id, pengguna);
  const bolehAtur = hak === 'penuh' || hak === 'edit';

  if (!m[2] && req.method === 'GET') {
    const sudah = f.sekali
      ? await env.DB.prepare('SELECT 1 FROM formulir_jawaban WHERE formulir_id = ?1 AND user_id = ?2 LIMIT 1').bind(f.id, pengguna.id).first()
      : null;
    const n = bolehAtur ? await env.DB.prepare('SELECT COUNT(*) AS n FROM formulir_jawaban WHERE formulir_id = ?1').bind(f.id).first<{ n: number }>() : null;
    return json({
      formulir: bentuk(f), boleh_atur: bolehAtur, sudah_isi: Boolean(sudah), tertutup: tertutup(f),
      jumlah_jawaban: n ? Number(n.n) : null,
      url_publik: f.mode === 'publik' && f.token ? `${asal}/f/${f.token}` : null,
    });
  }

  if (!m[2] && req.method === 'PATCH') {
    if (!bolehAtur) return galat('Hanya yang bisa menyunting memo ini yang boleh mengatur formulir.', 403);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const mode = b.mode === 'publik' ? 'publik' : b.mode === 'anggota' ? 'anggota' : f.mode;
    const token = mode === 'publik' ? (f.token ?? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(15)))).replace(/[+/=]/g, (c) => (c === '+' ? '-' : c === '/' ? '_' : ''))) : f.token;
    const tutup = typeof b.tutup_pada === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.tutup_pada) ? b.tutup_pada : b.tutup_pada === null ? null : f.tutup_pada;
    await env.DB.prepare(
      'UPDATE formulir SET judul = ?2, ket = ?3, skema = ?4, mode = ?5, token = ?6, sekali = ?7, tutup_pada = ?8 WHERE id = ?1',
    ).bind(
      f.id,
      typeof b.judul === 'string' ? b.judul.slice(0, 160) : f.judul,
      typeof b.ket === 'string' ? b.ket.slice(0, 1000) : f.ket,
      'skema' in b ? JSON.stringify(bersihkanSkema(b.skema)) : f.skema,
      mode, token,
      'sekali' in b ? (b.sekali ? 1 : 0) : f.sekali,
      tutup,
    ).run();
    return json({ ok: true, url_publik: mode === 'publik' && token ? `${asal}/f/${token}` : null });
  }

  if (m[2] === 'kirim' && req.method === 'POST') {
    if (pengguna.peran === 'pemantau') return galat('Peran Pemantau tidak mengisi formulir.', 403);
    if (tertutup(f)) return galat('Formulir sudah ditutup.', 409);
    if (f.sekali) {
      const sudah = await env.DB.prepare('SELECT 1 FROM formulir_jawaban WHERE formulir_id = ?1 AND user_id = ?2 LIMIT 1').bind(f.id, pengguna.id).first();
      if (sudah) return galat('Anda sudah mengisi formulir ini.', 409);
    }
    const b = (await req.json().catch(() => ({}))) as { jawaban?: Record<string, unknown> };
    const hasil = periksaJawaban(bersihkanSkema(f.skema), b.jawaban ?? {}, false);
    if ('galat' in hasil) return galat(hasil.galat);
    const id = idBaru('jwb');
    await env.DB.prepare(
      'INSERT INTO formulir_jawaban (id, formulir_id, user_id, nama_pengisi, jawaban, dikirim_pada) VALUES (?1,?2,?3,?4,?5,?6)',
    ).bind(id, f.id, pengguna.id, pengguna.nama, JSON.stringify(hasil.jawaban), sekarangUtcIso()).run();
    await beriXp(env, pengguna, 'formulir_isi', id, { pelaku: pengguna });
    return json({ id }, 201);
  }

  if (m[2] === 'jawaban') {
    if (!bolehAtur) return galat('Rekap jawaban hanya untuk yang bisa menyunting memo ini.', 403);
    if (!m[3] && req.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT id, user_id, nama_pengisi, jawaban, dikirim_pada FROM formulir_jawaban WHERE formulir_id = ?1 ORDER BY dikirim_pada DESC LIMIT 1000',
      ).bind(f.id).all<{ jawaban: string }>();
      return json({ jawaban: results.map((r) => ({ ...r, jawaban: JSON.parse(r.jawaban || '{}') })) });
    }
    if (m[3] && req.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM formulir_jawaban WHERE id = ?1 AND formulir_id = ?2').bind(m[3], f.id).run();
      return json({ ok: true });
    }
  }
  return galat('Metode tidak didukung.', 405);
}

// ---------------------------------------------------------------------------
// Halaman publik /f/<token>
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function halaman(judul: string, isi: string, status = 200): Response {
  return new Response(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(judul)}</title><meta name="robots" content="noindex">
<style>
:root{--latar:#f4f4f5;--kartu:#fff;--teks:#18181b;--pudar:#52525b;--garis:#18181b;--aksen:#65a30d}
@media (prefers-color-scheme:dark){:root{--latar:#09090b;--kartu:#18181b;--teks:#fafafa;--pudar:#a1a1aa;--garis:#fafafa}}
*{box-sizing:border-box}body{margin:0;background:var(--latar);color:var(--teks);font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px}
.k{max-width:640px;margin:0 auto;background:var(--kartu);border:3px solid var(--garis);box-shadow:4px 4px 0 var(--garis);padding:20px}
h1{font-size:22px;margin:0 0 6px}p.ket{color:var(--pudar);margin:0 0 16px;white-space:pre-wrap}
label.q{display:block;font-weight:700;margin:16px 0 6px}label.q i{color:#dc2626;font-style:normal}
input[type=text],input[type=number],input[type=date],textarea,select{width:100%;padding:9px 10px;border:2px solid var(--garis);background:var(--latar);color:var(--teks);font:inherit}
textarea{min-height:96px}.op{display:flex;gap:8px;align-items:center;margin:4px 0}
button{margin-top:20px;width:100%;padding:12px;border:3px solid var(--garis);background:var(--aksen);color:#fff;font-weight:800;font-size:15px;cursor:pointer;box-shadow:3px 3px 0 var(--garis)}
.galat{border:2px solid #dc2626;color:#dc2626;padding:8px 10px;margin-bottom:12px}.kaki{margin-top:18px;font-size:12px;color:var(--pudar);text-align:center}
.hp{position:absolute;left:-5000px}
</style></head><body><div class="k">${isi}<p class="kaki">Formulir POKEMONKEY</p></div></body></html>`, {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

function formHtml(f: BarisFormulir, galatTeks?: string): string {
  const skema = bersihkanSkema(f.skema).filter((q) => q.jenis !== 'foto');
  const bidang = skema.map((q) => {
    const nama = esc(q.id);
    const wajib = q.wajib ? ' required' : '';
    const label = `<label class="q" for="${nama}">${esc(q.label)}${q.wajib ? ' <i>*</i>' : ''}</label>`;
    if (q.jenis === 'paragraf') return `${label}<textarea id="${nama}" name="${nama}"${wajib}></textarea>`;
    if (q.jenis === 'angka' || q.jenis === 'rupiah') return `${label}<input type="text" inputmode="decimal" id="${nama}" name="${nama}"${wajib} placeholder="${q.jenis === 'rupiah' ? 'Rp' : '0'}">`;
    if (q.jenis === 'tanggal') return `${label}<input type="date" id="${nama}" name="${nama}"${wajib}>`;
    if (q.jenis === 'pilihan') return `${label}<select id="${nama}" name="${nama}"${wajib}><option value="">— pilih —</option>${(q.opsi ?? []).map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;
    if (q.jenis === 'ceklis') {
      return q.opsi?.length
        ? `${label}${q.opsi.map((o) => `<div class="op"><input type="checkbox" name="${nama}" value="${esc(o)}"> ${esc(o)}</div>`).join('')}`
        : `<div class="op" style="margin-top:16px"><input type="checkbox" id="${nama}" name="${nama}"${wajib}> <label for="${nama}"><b>${esc(q.label)}</b></label></div>`;
    }
    return `${label}<input type="text" id="${nama}" name="${nama}"${wajib}>`;
  }).join('');
  return `<h1>${esc(f.judul || 'Formulir')}</h1>${f.ket ? `<p class="ket">${esc(f.ket)}</p>` : ''}${galatTeks ? `<div class="galat">${esc(galatTeks)}</div>` : ''}
<form method="post"><input class="hp" name="situs_web" tabindex="-1" autocomplete="off" aria-hidden="true">${bidang}<button type="submit">Kirim jawaban</button></form>`;
}

export async function ruteFormulirPublik(token: string, req: Request, env: Env): Promise<Response> {
  const f = await env.DB.prepare("SELECT * FROM formulir WHERE token = ?1 AND mode = 'publik'").bind(token).first<BarisFormulir>();
  if (!f) return halaman('Formulir tidak ditemukan', '<h1>Formulir tidak ditemukan</h1><p class="ket">Tautan ini sudah tidak berlaku.</p>', 404);
  if (tertutup(f)) return halaman(f.judul, `<h1>${esc(f.judul)}</h1><p class="ket">Formulir ini sudah ditutup.</p>`);
  if (req.method === 'GET') return halaman(f.judul || 'Formulir', formHtml(f));
  if (req.method !== 'POST') return halaman('Metode tidak didukung', '<h1>Metode tidak didukung</h1>', 405);

  const data = await req.formData();
  if (String(data.get('situs_web') ?? '')) return halaman(f.judul, '<h1>Terima kasih</h1>'); // jebakan robot
  const hari = tanggalWita();
  const n = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM formulir_jawaban WHERE formulir_id = ?1 AND user_id IS NULL AND substr(datetime(dikirim_pada, '+8 hours'), 1, 10) = ?2",
  ).bind(f.id, hari).first<{ n: number }>();
  if (Number(n?.n ?? 0) >= MAKS_JAWABAN_HARIAN_PUBLIK) return halaman(f.judul, formHtml(f, 'Batas jawaban hari ini sudah tercapai. Coba lagi besok.'), 429);
  const masuk: Record<string, unknown> = {};
  for (const q of bersihkanSkema(f.skema)) {
    const semua = data.getAll(q.id).map(String);
    masuk[q.id] = q.jenis === 'ceklis' ? (q.opsi?.length ? semua : semua.length > 0) : semua[0] ?? '';
  }
  const hasil = periksaJawaban(bersihkanSkema(f.skema), masuk, true);
  if ('galat' in hasil) return halaman(f.judul, formHtml(f, hasil.galat), 400);
  const nama = String(masuk.nama ?? '').slice(0, 120) || null;
  await env.DB.prepare(
    'INSERT INTO formulir_jawaban (id, formulir_id, user_id, nama_pengisi, jawaban, dikirim_pada) VALUES (?1,?2,NULL,?3,?4,?5)',
  ).bind(idBaru('jwb'), f.id, nama, JSON.stringify(hasil.jawaban), sekarangUtcIso()).run();
  return halaman(f.judul, `<h1>Terima kasih ✓</h1><p class="ket">Jawaban Anda untuk "${esc(f.judul)}" sudah terkirim.</p>`);
}
