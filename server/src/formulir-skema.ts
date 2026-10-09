/**
 * Skema & pemeriksaan jawaban formulir memo — murni (tanpa akses database),
 * dipakai server (formulir.ts) dan aplikasi (BlokFormulir).
 */

export type JenisPertanyaan = 'teks' | 'paragraf' | 'angka' | 'rupiah' | 'pilihan' | 'ceklis' | 'tanggal' | 'foto';
export interface Pertanyaan { id: string; label: string; jenis: JenisPertanyaan; wajib?: boolean; opsi?: string[] }

const JENIS: JenisPertanyaan[] = ['teks', 'paragraf', 'angka', 'rupiah', 'pilihan', 'ceklis', 'tanggal', 'foto'];
export function bersihkanSkema(v: unknown): Pertanyaan[] {
  let a: unknown = v;
  if (typeof v === 'string') { try { a = JSON.parse(v); } catch { a = []; } }
  if (!Array.isArray(a)) return [];
  return a.slice(0, 40).flatMap((x): Pertanyaan[] => {
    if (!x || typeof x !== 'object') return [];
    const p = x as Record<string, unknown>;
    const jenis = JENIS.includes(p.jenis as JenisPertanyaan) ? (p.jenis as JenisPertanyaan) : 'teks';
    const id = typeof p.id === 'string' && /^[\w-]{1,30}$/.test(p.id) ? p.id : `q${Math.random().toString(36).slice(2, 8)}`;
    const opsi = Array.isArray(p.opsi) ? p.opsi.map((o) => String(o).slice(0, 80)).filter(Boolean).slice(0, 30) : undefined;
    return [{ id, label: String(p.label ?? '').slice(0, 200) || 'Pertanyaan', jenis, wajib: Boolean(p.wajib), ...(opsi?.length ? { opsi } : {}) }];
  });
}

/** Periksa & rapikan jawaban terhadap skema; galat berupa teks untuk pengisi. */
export function periksaJawaban(skema: Pertanyaan[], masuk: Record<string, unknown>, publik: boolean): { jawaban: Record<string, unknown> } | { galat: string } {
  const jawaban: Record<string, unknown> = {};
  for (const q of skema) {
    if (publik && q.jenis === 'foto') continue;
    let v = masuk[q.id];
    if (q.jenis === 'ceklis') {
      const daftar = (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []).map(String);
      v = q.opsi?.length ? daftar.filter((x) => q.opsi!.includes(x)) : daftar.length > 0 || v === true || v === 'on';
    } else if (q.jenis === 'angka' || q.jenis === 'rupiah') {
      const t = String(v ?? '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
      v = t === '' ? '' : Number(t);
      if (v !== '' && !Number.isFinite(v as number)) return { galat: `"${q.label}" harus berupa angka.` };
    } else if (q.jenis === 'pilihan') {
      v = String(v ?? '');
      if (v && q.opsi?.length && !q.opsi.includes(v as string)) return { galat: `Pilihan "${q.label}" tidak sah.` };
    } else if (q.jenis === 'tanggal') {
      v = String(v ?? '');
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v as string)) return { galat: `Tanggal "${q.label}" tidak sah.` };
    } else {
      v = String(v ?? '').slice(0, q.jenis === 'paragraf' ? 4000 : 500);
    }
    const kosong = v === '' || v === false || (Array.isArray(v) && v.length === 0);
    if (q.wajib && kosong) return { galat: `"${q.label}" wajib diisi.` };
    jawaban[q.id] = v;
  }
  return { jawaban };
}

