/**
 * Mode demo untuk fitur putaran 2 — tiruan server/src/{memo-sosial,surat,folder-dok,formulir,prestasi}.ts
 * di database demo (localStorage). Dipanggil dari lib/demo.ts sebelum rute lain.
 */

import { GalatApi } from './galat';
import { hakMemo, izinMemo } from '../server/src/memo-blok';
import { bersihkanSkema, periksaJawaban } from '../server/src/formulir-skema';
import { PRESTASI, type KodePrestasi } from '../server/src/prestasi-aturan';
import { beriXpDemo, kabarPrestasiDemo, type DbXp } from './demo-xp';
import { ID_FORMULIR_PANDUAN, ID_PANDUAN, JUDUL_PANDUAN, PROPS_PANDUAN, RINGKASAN_PANDUAN, SKEMA_FORMULIR_PANDUAN, VERSI_PANDUAN, isiPanduan } from './memo-panduan';

type Baris = Record<string, any>;

export interface DbPlus extends DbXp {
  memo: Baris[];
  pica: Baris[];
  updates: Baris[];
  laporan: Baris[];
  lampiran: Baris[];
  memoSematan?: Baris[];
  memoLihat?: Baris[];
  memoSuka?: Baris[];
  pesan?: Baris[];
  pesanPenerima?: Baris[];
  kotakSurat?: Baris[];
  folderDok?: Baris[];
  berkasDok?: Baris[];
  formulir?: Baris[];
  formulirJawaban?: Baris[];
  prestasi?: Baris[];
}

const gagal = (pesan: string, status = 400): never => { throw new GalatApi(pesan, status); };
const kini = () => new Date().toISOString();
const idBaru = (awal: string) => `${awal}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const nama = (d: DbPlus, id: string | null | undefined) => d.tim.find((t) => t.id === id)?.nama ?? null;
const EKSTENSI_DOKUMEN = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'odt', 'ods', 'odp', 'rtf', 'md'];

/** Surat sistem di Kotak Surat demo. */
export function suratSistemDemo(d: DbPlus, userId: string | null | undefined, s: { jenis: string; judul: string; isi?: string; tautan?: Baris | null; penting?: boolean }): void {
  if (!userId) return;
  d.kotakSurat ??= [];
  d.kotakSurat.push({ id: idBaru('srt'), user_id: userId, jenis: s.jenis, judul: s.judul, isi: s.isi ?? null, tautan: s.tautan ? JSON.stringify(s.tautan) : null, penting: s.penting ? 1 : 0, dibuat_pada: kini(), dibaca_pada: null });
}

// ---------------------------------------------------------------------------
// Prestasi (tiruan server/src/prestasi.ts)
// ---------------------------------------------------------------------------

function kemajuan(d: DbPlus, u: string): Record<KodePrestasi, number> {
  const tutup = d.pica.filter((p) => !p.dihapus && p.status === 'Closed');
  const selamat = tutup.filter((p) => p.pic_id !== u && p.due_date && (
    d.updates.some((x) => x.pica_id === p.id && x.oleh === u && String(x.pada).slice(0, 10) > p.due_date)
    || d.lampiran.some((l) => l.entitas === 'pica' && l.entitas_id === p.id && l.oleh === u && String(l.pada).slice(0, 10) > p.due_date)));
  return {
    first_responder: d.xpLog.filter((r) => r.user_id === u && r.sumber === 'titik_pertama' && !r.dibatalkan_pada).length,
    pemburu_pica: tutup.filter((p) => p.pic_id === u).length,
    penyelamat_tim: selamat.length,
    fotografer: d.xpLog.filter((r) => r.user_id === u && r.sumber === 'laporan_foto' && !r.dibatalkan_pada).length,
  };
}

export function periksaPrestasiDemo(d: DbPlus, u: string | null | undefined, sayaId: string): void {
  if (!u) return;
  d.prestasi ??= [];
  const nilai = kemajuan(d, u);
  const baru = PRESTASI.filter((p) => !d.prestasi!.some((x) => x.user_id === u && x.kode === p.kode) && nilai[p.kode] >= p.target);
  if (!baru.length) return;
  const prof = d.profil[u] ?? (d.profil[u] = { user_id: u, xp: 0, level: 1, skin_aktif: 'classic', skin_dimiliki: ['classic'] });
  const milik: string[] = Array.isArray(prof.skin_dimiliki) ? prof.skin_dimiliki : ['classic'];
  for (const p of baru) {
    d.prestasi.push({ user_id: u, kode: p.kode, didapat_pada: kini() });
    if (!milik.includes(p.skin)) milik.push(p.skin);
    suratSistemDemo(d, u, { jenis: 'prestasi', judul: `🏆 Prestasi terbuka: ${p.nama}`, isi: `${p.syarat} Skin "${p.nama}" kini ada di koleksi Anda.`, tautan: { jenis: 'tab', id: 'market', label: 'Buka SHOP' } });
  }
  prof.skin_dimiliki = milik;
  if (u === sayaId) kabarPrestasiDemo(baru.map((p) => p.skin));
}

// ---------------------------------------------------------------------------
// Rute
// ---------------------------------------------------------------------------

export async function rutePlusDemo(
  d: DbPlus, path: string, method: string, body: any, q: URLSearchParams, form: FormData | undefined,
  saya: { id: string; peran: string; nama: string }, bacaDataUrl: (f: File) => Promise<string>,
): Promise<unknown | null> {
  let m: RegExpMatchArray | null;
  const kelola = saya.peran === 'admin' || saya.peran === 'supervisor';

  // ----- memo: dilihat oleh, suka, sematkan -----
  if ((m = path.match(/^\/api\/memo\/([\w-]+)\/(lihat|sosial|suka|sematkan)$/))) {
    const x = d.memo.find((y) => y.id === m![1] && !y.dihapus_pada);
    const hak = x ? hakMemo({ user_id: x.user_id, lingkup: x.lingkup ?? 'pribadi', akses: x.akses, izin: x.izin }, saya) : null;
    if (!x || !hak) gagal('Memo tidak ditemukan.', 404);
    d.memoLihat ??= []; d.memoSuka ??= []; d.memoSematan ??= [];
    if (m[2] === 'lihat') {
      const l = d.memoLihat.find((y) => y.memo_id === x!.id && y.user_id === saya.id);
      if (l) { l.terakhir = kini(); l.kali += 1; } else d.memoLihat.push({ memo_id: x!.id, user_id: saya.id, pertama: kini(), terakhir: kini(), kali: 1 });
      return { ok: true };
    }
    if (m[2] === 'sosial') {
      const suka = d.memoSuka.filter((s) => s.memo_id === x!.id).map((s): Baris => ({ ...s, nama: nama(d, s.user_id) }));
      return {
        suka, saya_suka: suka.some((s) => s.user_id === saya.id),
        dilihat: d.memoLihat.filter((l) => l.memo_id === x!.id).map((l): Baris => ({ ...l, nama: nama(d, l.user_id) })).sort((a, b) => String(b.terakhir).localeCompare(String(a.terakhir))),
      };
    }
    if (m[2] === 'suka') {
      const ada = d.memoSuka.findIndex((s) => s.memo_id === x!.id && s.user_id === saya.id);
      if (ada >= 0) d.memoSuka.splice(ada, 1); else d.memoSuka.push({ memo_id: x!.id, user_id: saya.id, pada: kini() });
      return { suka: ada < 0, jumlah: d.memoSuka.filter((s) => s.memo_id === x!.id).length };
    }
    if (body?.untuk === 'semua') {
      if (hak !== 'penuh') gagal('Hanya pembuat memo, Supervisor, atau Admin yang boleh menyematkan untuk semua orang.', 403);
      x!.disematkan = body.nilai ? 1 : 0;
      return { ok: true, disematkan: x!.disematkan };
    }
    d.memoSematan = d.memoSematan.filter((s) => !(s.memo_id === x!.id && s.user_id === saya.id));
    if (body?.nilai) d.memoSematan.push({ memo_id: x!.id, user_id: saya.id, pada: kini() });
    return { ok: true, sematan_saya: body?.nilai ? 1 : 0 };
  }

  // ----- Kotak Surat -----
  if (path.startsWith('/api/surat')) {
    d.pesan ??= []; d.pesanPenerima ??= []; d.kotakSurat ??= [];
    if (!d.kotakSurat.some((s) => s.user_id === saya.id && s.jenis === 'sambutan')) {
      suratSistemDemo(d, saya.id, { jenis: 'sambutan', judul: '📬 Selamat datang di Kotak Surat', isi: 'Di sini masuk pesan dari anggota tim dan pemberitahuan sistem: PICA baru untuk Anda, perubahan status, memo rahasia, dan prestasi.' });
      d.kotakSurat[d.kotakSurat.length - 1].jenis = 'sambutan';
    }
    const belum = () => {
      const pesan = d.pesanPenerima!.filter((r) => r.user_id === saya.id && !r.dibaca_pada && !r.diarsip).length;
      const sistem = d.kotakSurat!.filter((s) => s.user_id === saya.id && !s.dibaca_pada).length;
      return { pesan, sistem, belum: pesan + sistem };
    };
    const akar = (id: string) => d.pesan!.find((p) => p.id === id)?.induk_id ?? id;
    const bolehUtas = (a: string) => d.pesan!.some((p) => (p.id === a || p.induk_id === a) && (p.pengirim === saya.id || d.pesanPenerima!.some((r) => r.pesan_id === p.id && r.user_id === saya.id)));
    if (path === '/api/surat/jumlah') return belum();
    if (path === '/api/surat' && method === 'GET') {
      const kotak = q.get('kotak') ?? 'masuk';
      if (kotak === 'sistem') return { surat: d.kotakSurat.filter((s) => s.user_id === saya.id).sort((a, b) => String(b.dibuat_pada).localeCompare(String(a.dibuat_pada))) };
      if (kotak === 'terkirim') {
        return { surat: d.pesan.filter((p) => p.pengirim === saya.id).map((p) => ({ ...p, cuplikan: String(p.isi).slice(0, 160), dibaca: 1, penerima_nama: d.pesanPenerima!.filter((r) => r.pesan_id === p.id).map((r) => nama(d, r.user_id)).join(', ') })).reverse() };
      }
      return {
        surat: d.pesanPenerima.filter((r) => r.user_id === saya.id && !r.diarsip).map((r): Baris => {
          const p = d.pesan!.find((x) => x.id === r.pesan_id)!;
          return { ...p, pengirim_nama: nama(d, p.pengirim), cuplikan: String(p.isi).slice(0, 160), dibaca: r.dibaca_pada ? 1 : 0 };
        }).sort((a, b) => String(b.dibuat_pada).localeCompare(String(a.dibuat_pada))),
      };
    }
    if ((m = path.match(/^\/api\/surat\/pesan\/([\w-]+)$/)) && method === 'GET') {
      const a = akar(m[1]);
      if (!bolehUtas(a)) gagal('Pesan tidak ditemukan.', 404);
      const utas = d.pesan.filter((p) => p.id === a || p.induk_id === a).sort((x, y) => String(x.dibuat_pada).localeCompare(String(y.dibuat_pada)));
      for (const r of d.pesanPenerima) if (r.user_id === saya.id && !r.dibaca_pada && utas.some((p) => p.id === r.pesan_id)) r.dibaca_pada = kini();
      return { utas: utas.map((p) => ({ ...p, pengirim_nama: nama(d, p.pengirim), penerima: d.pesanPenerima!.filter((r) => r.pesan_id === p.id).map((r) => ({ id: r.user_id, nama: nama(d, r.user_id), dibaca_pada: r.dibaca_pada })) })) };
    }
    if (path === '/api/surat/pesan' && method === 'POST') {
      const isi = String(body?.isi ?? '').trim();
      if (!isi) gagal('Isi pesan masih kosong.');
      let induk: string | null = null;
      let penerima: string[] = Array.isArray(body?.penerima) ? [...new Set<string>(body.penerima.map(String))] : [];
      if (body?.induk_id) {
        induk = akar(String(body.induk_id));
        if (!bolehUtas(induk)) gagal('Pesan yang dibalas tidak ditemukan.', 404);
        if (!penerima.length) {
          const utas = d.pesan.filter((p) => p.id === induk || p.induk_id === induk);
          penerima = [...new Set([...utas.map((p) => p.pengirim), ...d.pesanPenerima.filter((r) => utas.some((p) => p.id === r.pesan_id)).map((r) => r.user_id)])];
        }
      }
      penerima = penerima.filter((u) => u !== saya.id && d.tim.some((t) => t.id === u));
      if (!penerima.length) gagal('Pilih paling sedikit satu penerima.');
      const id = idBaru('psn');
      const jenis = body?.jenis === 'minta_progres' || body?.jenis === 'progres' ? body.jenis : 'pesan';
      d.pesan.push({
        id, pengirim: saya.id, subjek: String(body?.subjek ?? '').trim() || (induk ? 'Balasan' : '(tanpa subjek)'), isi, jenis,
        tautan: body?.tautan ? JSON.stringify(body.tautan) : null, penting: body?.penting ? 1 : 0, induk_id: induk,
        lampiran: Array.isArray(body?.lampiran) && body.lampiran.length ? JSON.stringify(body.lampiran) : null, dibuat_pada: kini(),
      });
      for (const u of penerima) d.pesanPenerima.push({ pesan_id: id, user_id: u, dibaca_pada: null, diarsip: 0 });
      beriXpDemo(d, saya.id, 'pesan_kirim', id, saya.id);
      return { id, induk_id: induk };
    }
    if ((m = path.match(/^\/api\/surat\/pesan\/([\w-]+)\/arsip$/))) {
      for (const r of d.pesanPenerima) if (r.pesan_id === m[1] && r.user_id === saya.id) { r.diarsip = 1; r.dibaca_pada ??= kini(); }
      return { ok: true };
    }
    if (path === '/api/surat/sistem/baca-semua') { for (const s of d.kotakSurat) if (s.user_id === saya.id) s.dibaca_pada ??= kini(); return { ok: true }; }
    if ((m = path.match(/^\/api\/surat\/sistem\/([\w-]+)\/baca$/))) { const s = d.kotakSurat.find((x) => x.id === m![1] && x.user_id === saya.id); if (s) s.dibaca_pada ??= kini(); return { ok: true }; }
    if (path === '/api/surat/ringkasan-saya') {
      const hari = new Date(Date.now() + 480 * 60000).toISOString().slice(0, 10);
      const lap = d.laporan.filter((l) => l.user_id === saya.id && String(l.dibuat_pada).slice(0, 10) === hari);
      const upd = d.updates.filter((u) => u.oleh === saya.id && String(u.pada).slice(0, 10) === hari);
      const baris = [`Progres kerja ${hari}:`];
      if (lap.length) baris.push('', 'Laporan lapangan:', ...lap.map((l) => `- ${l.jenis ?? 'Kegiatan'}${l.capaian ? ` · ${l.capaian} ${l.satuan ?? ''}` : ''}${l.catatan ? ` — ${l.catatan}` : ''}`));
      if (upd.length) baris.push('', 'Update PICA:', ...upd.map((u) => `- ${d.pica.find((p) => p.id === u.pica_id)?.judul ?? u.pica_id}: ${u.catatan}`));
      if (baris.length === 1) baris.push('', '(Belum ada laporan atau update PICA hari ini — tulis progresnya di sini.)');
      return { subjek: `Progres kerja ${hari}`, isi: baris.join('\n') };
    }
    return null;
  }

  // ----- Folder Dokumen -----
  if (path.startsWith('/api/folder')) {
    d.folderDok ??= []; d.berkasDok ??= [];
    const lingkupDari = (v: unknown) => (v === 'pribadi' ? 'pribadi' : 'tim');
    const terlihat = (r: Baris) => r.lingkup === 'tim' || r.user_id === saya.id;
    if (path === '/api/folder' && method === 'GET') {
      const lingkup = lingkupDari(q.get('lingkup'));
      return {
        folder: d.folderDok.filter((f) => f.lingkup === lingkup && terlihat(f)).map((f) => ({ ...f, pembuat: nama(d, f.user_id) })),
        berkas: d.berkasDok.filter((b) => b.lingkup === lingkup && terlihat(b)).map((b) => ({ ...b, pengunggah: nama(d, b.user_id) })),
        boleh_folder: lingkup === 'pribadi' || kelola, boleh_unggah: lingkup === 'pribadi' || saya.peran !== 'pemantau',
      };
    }
    if (path === '/api/folder' && method === 'POST') {
      const lingkup = lingkupDari(body?.lingkup);
      if (lingkup === 'tim' && !kelola) gagal('Folder Tim dibuat oleh Admin atau Supervisor. Anda tetap bisa mengunggah dokumen.', 403);
      const id = idBaru('fld');
      d.folderDok.push({ id, nama: String(body?.nama ?? '').trim().slice(0, 80) || 'Folder', lingkup, user_id: saya.id, induk_id: body?.induk_id ?? null, dibuat_pada: kini() });
      return { id };
    }
    if (path === '/api/folder/unggah' && method === 'POST') {
      const berkas = form?.get('berkas');
      if (!(berkas instanceof File)) gagal('Berkas tidak ditemukan.');
      const f = berkas as File;
      const ext = (f.name.split('.').pop() ?? '').toLowerCase();
      if (!EKSTENSI_DOKUMEN.includes(ext)) gagal(`Folder Dokumen hanya untuk dokumen (${EKSTENSI_DOKUMEN.join(', ')}). Foto & video simpan di memo.`);
      if (f.size > 4 * 1024 * 1024) gagal('Mode demo menyimpan dokumen di HP ini: maksimal 4 MB (di server 25 MB).');
      const lingkup = lingkupDari(form?.get('lingkup'));
      const id = idBaru('dok');
      const kunci = `demo/dok/${id}.${ext}`;
      d.lampiran.push({ id: idBaru('lmp'), entitas: 'dok', entitas_id: id, kunci_r2: kunci, nama: f.name, tipe_mime: f.type, ukuran: f.size, oleh: saya.id, pada: kini(), data: await bacaDataUrl(f) });
      d.berkasDok.push({ id, folder_id: String(form?.get('folder_id') ?? '') || null, lingkup, user_id: saya.id, nama: f.name, kunci, tipe: f.type || null, ukuran: f.size, dibuat_pada: kini() });
      if (lingkup === 'tim') beriXpDemo(d, saya.id, 'dokumen_unggah', id, saya.id);
      return { id, kunci, nama: f.name };
    }
    if ((m = path.match(/^\/api\/folder\/berkas\/([\w-]+)$/))) {
      const b = d.berkasDok.find((x) => x.id === m![1] && terlihat(x));
      if (!b) gagal('Berkas tidak ditemukan.', 404);
      if (b!.user_id !== saya.id && !(b!.lingkup === 'tim' && kelola)) gagal('Hanya pengunggah, Supervisor, atau Admin yang boleh mengubah berkas ini.', 403);
      if (method === 'PATCH') { if (body?.nama) b!.nama = String(body.nama).slice(0, 160); if ('folder_id' in (body ?? {})) b!.folder_id = body.folder_id || null; return { ok: true }; }
      if (method === 'DELETE') { d.berkasDok = d.berkasDok.filter((x) => x.id !== b!.id); d.lampiran = d.lampiran.filter((l) => l.kunci_r2 !== b!.kunci); return { ok: true }; }
    }
    if ((m = path.match(/^\/api\/folder\/([\w-]+)$/))) {
      const f = d.folderDok.find((x) => x.id === m![1] && terlihat(x));
      if (!f) gagal('Folder tidak ditemukan.', 404);
      if (f!.lingkup === 'tim' && !kelola) gagal('Folder Tim diatur oleh Admin atau Supervisor.', 403);
      if (method === 'PATCH') { f!.nama = String(body?.nama ?? f!.nama).slice(0, 80); return { ok: true }; }
      if (method === 'DELETE') {
        if (d.berkasDok.some((b) => b.folder_id === f!.id) || d.folderDok.some((x) => x.induk_id === f!.id)) gagal('Folder masih berisi. Pindahkan atau hapus isinya dulu.', 409);
        d.folderDok = d.folderDok.filter((x) => x.id !== f!.id);
        return { ok: true };
      }
    }
    return null;
  }

  // ----- Formulir -----
  if (path.startsWith('/api/formulir')) {
    d.formulir ??= []; d.formulirJawaban ??= [];
    const hakMemoDari = (memoId: string) => {
      const x = d.memo.find((y) => y.id === memoId && !y.dihapus_pada);
      return x ? hakMemo({ user_id: x.user_id, lingkup: x.lingkup ?? 'pribadi', akses: x.akses, izin: x.izin }, saya) : null;
    };
    if (path === '/api/formulir' && method === 'POST') {
      const hak = hakMemoDari(String(body?.memo_id ?? ''));
      if (!hak) gagal('Memo tidak ditemukan.', 404);
      if (hak === 'baca') gagal('Memo ini diatur "Baca saja".', 403);
      const id = idBaru('frm');
      d.formulir.push({ id, memo_id: body.memo_id, judul: String(body?.judul ?? 'Formulir'), ket: null, skema: JSON.stringify([{ id: 'nama', label: 'Nama', jenis: 'teks', wajib: true }, { id: 'q1', label: 'Pertanyaan pertama', jenis: 'teks' }]), mode: 'anggota', token: null, sekali: 0, tutup_pada: null, dibuat_oleh: saya.id, dibuat_pada: kini() });
      return { id };
    }
    if ((m = path.match(/^\/api\/formulir\/([\w-]+)(?:\/(kirim|jawaban)(?:\/([\w-]+))?)?$/))) {
      const f = d.formulir.find((x) => x.id === m![1]);
      if (!f) gagal('Formulir tidak ditemukan.', 404);
      const hak = hakMemoDari(f!.memo_id);
      const bolehAtur = hak === 'penuh' || hak === 'edit';
      const tertutup = Boolean(f!.tutup_pada && new Date(Date.now() + 480 * 60000).toISOString().slice(0, 10) > f!.tutup_pada);
      const url = f!.mode === 'publik' && f!.token ? `${location.origin}/f/${f!.token}` : null;
      if (!m[2] && method === 'GET') {
        return {
          formulir: { ...f, skema: bersihkanSkema(f!.skema) }, boleh_atur: bolehAtur, tertutup,
          sudah_isi: Boolean(f!.sekali && d.formulirJawaban.some((j) => j.formulir_id === f!.id && j.user_id === saya.id)),
          jumlah_jawaban: bolehAtur ? d.formulirJawaban.filter((j) => j.formulir_id === f!.id).length : null, url_publik: url,
        };
      }
      if (!m[2] && method === 'PATCH') {
        if (!bolehAtur) gagal('Hanya yang bisa menyunting memo ini yang boleh mengatur formulir.', 403);
        if (typeof body?.judul === 'string') f!.judul = body.judul.slice(0, 160);
        if (typeof body?.ket === 'string') f!.ket = body.ket.slice(0, 1000);
        if ('skema' in (body ?? {})) f!.skema = JSON.stringify(bersihkanSkema(body.skema));
        if (body?.mode === 'publik' || body?.mode === 'anggota') f!.mode = body.mode;
        if (f!.mode === 'publik' && !f!.token) f!.token = Math.random().toString(36).slice(2, 14);
        if ('sekali' in (body ?? {})) f!.sekali = body.sekali ? 1 : 0;
        if ('tutup_pada' in (body ?? {})) f!.tutup_pada = body.tutup_pada || null;
        return { ok: true, url_publik: f!.mode === 'publik' ? `${location.origin}/f/${f!.token}` : null };
      }
      if (m[2] === 'kirim' && method === 'POST') {
        if (tertutup) gagal('Formulir sudah ditutup.', 409);
        if (f!.sekali && d.formulirJawaban.some((j) => j.formulir_id === f!.id && j.user_id === saya.id)) gagal('Anda sudah mengisi formulir ini.', 409);
        const hasil = periksaJawaban(bersihkanSkema(f!.skema), body?.jawaban ?? {}, false);
        if ('galat' in hasil) gagal(hasil.galat);
        const id = idBaru('jwb');
        d.formulirJawaban.push({ id, formulir_id: f!.id, user_id: saya.id, nama_pengisi: saya.nama, jawaban: JSON.stringify((hasil as { jawaban: unknown }).jawaban), dikirim_pada: kini() });
        beriXpDemo(d, saya.id, 'formulir_isi', id, saya.id);
        return { id };
      }
      if (m[2] === 'jawaban') {
        if (!bolehAtur) gagal('Rekap jawaban hanya untuk yang bisa menyunting memo ini.', 403);
        if (!m[3] && method === 'GET') {
          return { jawaban: d.formulirJawaban.filter((j) => j.formulir_id === f!.id).map((j) => ({ ...j, jawaban: JSON.parse(j.jawaban || '{}') })).reverse() };
        }
        if (m[3] && method === 'DELETE') { d.formulirJawaban = d.formulirJawaban.filter((j) => j.id !== m![3]); return { ok: true }; }
      }
    }
    return null;
  }

  // ----- Skin Prestasi & pemilik skin -----
  if (path === '/api/prestasi' && method === 'GET') {
    const user = q.get('user') || saya.id;
    if (user === saya.id) periksaPrestasiDemo(d, user, saya.id);
    const nilai = kemajuan(d, user);
    return { prestasi: PRESTASI.map((p) => ({ ...p, nilai: nilai[p.kode], didapat_pada: (d.prestasi ?? []).find((x) => x.user_id === user && x.kode === p.kode)?.didapat_pada ?? null })) };
  }
  if (path === '/api/skin/pemilik' && method === 'GET') {
    const pemilik: Record<string, number> = {};
    for (const t of d.tim) {
      const milik = d.profil[t.id]?.skin_dimiliki;
      for (const s of Array.isArray(milik) ? milik : ['classic']) pemilik[s] = (pemilik[s] ?? 0) + 1;
    }
    return { pemilik, anggota: d.tim.filter((t) => t.peran !== 'pemantau').length };
  }

  return null;
}

/** Halaman latihan "Yang baru di Memo" (sama dengan migrasi 0033) dipasang sekali di database demo. */
export function pastikanPanduanDemo(d: DbPlus, sayaId: string): boolean {
  const admin = d.tim.find((t) => t.peran === 'admin')?.id ?? sayaId;
  const ada = d.memo.find((m) => m.id === ID_PANDUAN);
  if (ada) {
    // Versi lama di HP ini: diganti versi terbaru (halaman latihan, bukan catatan pemakai).
    let versi = 0;
    try { versi = Number(JSON.parse(String(ada.props ?? '{}')).versi_panduan ?? 0); } catch { versi = 0; }
    if (versi >= VERSI_PANDUAN) return false;
    Object.assign(ada, { judul: JUDUL_PANDUAN, isi: isiPanduan(admin), ringkasan: RINGKASAN_PANDUAN, props: PROPS_PANDUAN, dihapus_pada: null, diubah_pada: kini() });
    return true;
  }
  const kini_ = kini();
  d.memo.push({
    id: ID_PANDUAN, user_id: admin, lingkup: 'tim', judul: JUDUL_PANDUAN, isi: isiPanduan(admin),
    ringkasan: RINGKASAN_PANDUAN,
    kategori: null, tipe: null, status: null, tanggal: kini_.slice(0, 10), disematkan: 1, warna: null, pica_id: null,
    props: PROPS_PANDUAN, akses: 'edit', induk_id: null, dihapus_pada: null, dihapus_oleh: null, dibuat_pada: kini_, diubah_pada: null, izin: null,
  });
  d.formulir ??= [];
  if (!d.formulir.some((f) => f.id === ID_FORMULIR_PANDUAN)) {
    d.formulir.push({ id: ID_FORMULIR_PANDUAN, memo_id: ID_PANDUAN, judul: 'Latihan: laporan tanam harian', ket: 'Formulir latihan — isi bebas untuk mencoba.', skema: SKEMA_FORMULIR_PANDUAN, mode: 'anggota', token: null, sekali: 0, tutup_pada: null, dibuat_oleh: admin, dibuat_pada: kini_ });
  }
  return true;
}

/** Orang yang baru dituju memo rahasia (demo) mendapat surat. */
export function kabariIzinDemo(d: DbPlus, saya: { nama: string }, memoId: string, judul: string, orang: string[]): void {
  for (const u of orang) {
    suratSistemDemo(d, u, { jenis: 'memo_rahasia', judul: `${saya.nama} membagikan memo rahasia kepada Anda`, isi: `"${judul || 'Tanpa judul'}" — hanya Anda dan orang yang dituju yang bisa membuka dan menyuntingnya.`, tautan: { jenis: 'memo', id: memoId, label: judul || 'Tanpa judul' } });
  }
}

export { izinMemo };
