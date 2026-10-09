import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ClipboardList, Settings2, Inbox, Send, Loader2, Plus, Trash2, Link as IkonTaut, Copy, Globe, Users, ArrowUp, ArrowDown, Check, Camera,
} from 'lucide-react';
import { api } from '../lib/api';
import type { JenisPertanyaan, Pertanyaan } from '../server/src/formulir-skema';
import { hitungKolom } from '../lib/rumus-tabel';

/**
 * Blok Formulir di memo (seperti Notion Forms): isi formulir, rekap jawaban
 * (yang bisa menyunting memo), dan pengaturan — anggota saja atau terbuka lewat tautan.
 */

interface DataFormulir {
  formulir: { id: string; memo_id: string; judul: string; ket: string | null; skema: Pertanyaan[]; mode: 'anggota' | 'publik'; sekali: number; tutup_pada: string | null };
  boleh_atur: boolean; sudah_isi: boolean; tertutup: boolean; jumlah_jawaban: number | null; url_publik: string | null;
}
interface Jawaban { id: string; user_id: string | null; nama_pengisi: string | null; jawaban: Record<string, unknown>; dikirim_pada: string }

const LABEL_JENIS: Record<JenisPertanyaan, string> = {
  teks: 'Teks singkat', paragraf: 'Paragraf', angka: 'Angka', rupiah: 'Rupiah', pilihan: 'Pilihan (satu)', ceklis: 'Centang', tanggal: 'Tanggal', foto: 'Foto (aplikasi saja)',
};
const tampilNilai = (q: Pertanyaan, v: unknown): string => {
  if (v === undefined || v === null || v === '') return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'boolean') return v ? '✓' : '';
  if (q.jenis === 'rupiah' && typeof v === 'number') return `Rp ${v.toLocaleString('id-ID')}`;
  if (q.jenis === 'angka' && typeof v === 'number') return v.toLocaleString('id-ID');
  if (q.jenis === 'foto') return '📷 foto';
  return String(v);
};

export const BlokFormulir: React.FC<{ id: string; judul: string; notify: (m: string) => void; latarPutih?: boolean }> = ({ id, judul, notify, latarPutih }) => {
  const [data, setData] = useState<DataFormulir | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tab, setTab] = useState<'isi' | 'jawaban' | 'atur'>('isi');
  const [isian, setIsian] = useState<Record<string, unknown>>({});
  const [mengirim, setMengirim] = useState(false);
  const [jawaban, setJawaban] = useState<Jawaban[] | null>(null);
  const [draf, setDraf] = useState<DataFormulir['formulir'] | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    try { const d = await api<DataFormulir>(`/api/formulir/${id}`); setData(d); setDraf(d.formulir); setGalat(null); }
    catch (e) { setGalat(e instanceof Error ? e.message : 'Formulir tidak dapat dimuat.'); }
  }, [id]);
  useEffect(() => { void muat(); }, [muat]);
  const muatJawaban = useCallback(async () => {
    try { setJawaban((await api<{ jawaban: Jawaban[] }>(`/api/formulir/${id}/jawaban`)).jawaban); } catch { setJawaban([]); }
  }, [id]);
  useEffect(() => { if (tab === 'jawaban') void muatJawaban(); }, [tab, muatJawaban]);

  const kirim = async () => {
    setMengirim(true);
    try {
      await api(`/api/formulir/${id}/kirim`, { body: { jawaban: isian } });
      notify('JAWABAN FORMULIR TERKIRIM');
      setIsian({});
      void muat();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGIRIM'); }
    finally { setMengirim(false); }
  };
  const simpanAtur = async (patch?: Partial<DataFormulir['formulir']>) => {
    if (!draf) return;
    const isi = { ...draf, ...patch };
    setMenyimpan(true);
    try {
      const d = await api<{ url_publik: string | null }>(`/api/formulir/${id}`, { method: 'PATCH', body: { judul: isi.judul, ket: isi.ket ?? '', skema: isi.skema, mode: isi.mode, sekali: isi.sekali, tutup_pada: isi.tutup_pada } });
      setData((x) => (x ? { ...x, formulir: isi, url_publik: d.url_publik } : x));
      setDraf(isi);
      notify('FORMULIR DISIMPAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN'); }
    finally { setMenyimpan(false); }
  };
  const hapusJawaban = async (jid: string) => {
    if (!window.confirm('Hapus jawaban ini?')) return;
    await api(`/api/formulir/${id}/jawaban/${jid}`, { method: 'DELETE' }).catch(() => undefined);
    void muatJawaban();
  };
  const unggahFoto = async (qid: string, f: File) => {
    try {
      const form = new FormData();
      form.append('berkas', f, f.name);
      form.append('entitas', 'formulir');
      form.append('entitas_id', id);
      const d = await api<{ kunci: string }>('/api/lampiran', { form });
      setIsian((x) => ({ ...x, [qid]: d.kunci }));
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'FOTO GAGAL DIUNGGAH'); }
  };

  const skema = data?.formulir.skema ?? [];
  const ringkasan = useMemo(() => {
    if (!jawaban) return null;
    return skema.map((q) => {
      if (q.jenis === 'angka' || q.jenis === 'rupiah') {
        const jml = hitungKolom(jawaban.map((j) => String(j.jawaban[q.id] ?? '')), 'jumlah');
        const rata = hitungKolom(jawaban.map((j) => String(j.jawaban[q.id] ?? '')), 'rata');
        return `Σ ${jml} · rata ${rata}`;
      }
      if (q.jenis === 'pilihan' || q.jenis === 'ceklis') {
        const n = new Map<string, number>();
        for (const j of jawaban) {
          const v = j.jawaban[q.id];
          for (const x of Array.isArray(v) ? v : v === true ? ['✓'] : v ? [String(v)] : []) n.set(String(x), (n.get(String(x)) ?? 0) + 1);
        }
        return [...n.entries()].map(([k, c]) => `${k}: ${c}`).join(' · ');
      }
      return `${jawaban.filter((j) => String(j.jawaban[q.id] ?? '').trim()).length} terisi`;
    });
  }, [jawaban, skema]);

  const garis = latarPutih ? 'border-zinc-300' : 'border-white/20';
  const kartu = `my-2 border-2 ${latarPutih ? 'border-sky-500 bg-sky-50 text-zinc-900' : 'border-sky-500/70 bg-sky-950/20 text-zinc-100'} not-prose`;

  if (galat) return <div className={`${kartu} p-3 text-[13px]`}><ClipboardList size={14} className="inline mr-1" /> {judul || 'Formulir'} — <span className="text-red-400">{galat}</span></div>;
  if (!data || !draf) return <div className={`${kartu} p-3 text-[13px] flex items-center gap-2`}><Loader2 size={14} className="animate-spin" /> Memuat formulir…</div>;
  const f = data.formulir;

  return (
    <div className={kartu} contentEditable={false} data-formulir={id}>
      <div className={`flex flex-wrap items-center gap-2 px-3 py-2 border-b-2 ${garis}`}>
        <ClipboardList size={16} className="text-sky-400" />
        <span className="font-bold text-[15px] flex-1 min-w-0 truncate">{f.judul || 'Formulir'}</span>
        <span className={`text-[11px] px-1.5 py-0.5 border ${f.mode === 'publik' ? 'border-emerald-400 text-emerald-500' : 'border-sky-400 text-sky-400'} flex items-center gap-1`}>
          {f.mode === 'publik' ? <><Globe size={11} /> Terbuka lewat tautan</> : <><Users size={11} /> Hanya anggota</>}
        </span>
        {data.boleh_atur && (
          <span className="flex gap-1">
            {(['isi', 'jawaban', 'atur'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`px-2 py-0.5 text-[12px] border flex items-center gap-1 ${tab === t ? 'bg-sky-600 text-white border-sky-300' : `${garis} hover:border-sky-400`}`}>
                {t === 'isi' ? <Send size={11} /> : t === 'jawaban' ? <Inbox size={11} /> : <Settings2 size={11} />}
                {t === 'isi' ? 'Isi' : t === 'jawaban' ? `Jawaban ${data.jumlah_jawaban ?? ''}` : 'Atur'}
              </button>
            ))}
          </span>
        )}
      </div>

      {tab === 'isi' && (
        <div className="p-3 space-y-3">
          {f.ket && <p className="text-[13px] opacity-80 whitespace-pre-wrap">{f.ket}</p>}
          {data.tertutup ? <p className="text-[13px] text-amber-500">Formulir sudah ditutup.</p>
            : data.sudah_isi ? <p className="text-[13px] text-emerald-500 flex items-center gap-1.5"><Check size={14} /> Anda sudah mengisi formulir ini. Terima kasih!</p>
              : (
                <>
                  {skema.map((q) => (
                    <div key={q.id}>
                      <label className="block text-[13px] font-bold mb-1">{q.label}{q.wajib && <span className="text-red-500"> *</span>}</label>
                      {q.jenis === 'paragraf' ? (
                        <textarea value={String(isian[q.id] ?? '')} onChange={(e) => setIsian({ ...isian, [q.id]: e.target.value })} rows={3} className="input-retro !text-[13px]" />
                      ) : q.jenis === 'pilihan' ? (
                        <select value={String(isian[q.id] ?? '')} onChange={(e) => setIsian({ ...isian, [q.id]: e.target.value })} className="input-retro !text-[13px] !py-1.5">
                          <option value="">— pilih —</option>{(q.opsi ?? []).map((o) => <option key={o}>{o}</option>)}
                        </select>
                      ) : q.jenis === 'ceklis' ? (
                        q.opsi?.length ? (
                          <div className="flex flex-col gap-1">
                            {q.opsi.map((o) => {
                              const arr = Array.isArray(isian[q.id]) ? (isian[q.id] as string[]) : [];
                              return (
                                <label key={o} className="flex items-center gap-2 text-[13px]">
                                  <input type="checkbox" className="accent-sky-500 w-4 h-4" checked={arr.includes(o)} onChange={(e) => setIsian({ ...isian, [q.id]: e.target.checked ? [...arr, o] : arr.filter((x) => x !== o) })} /> {o}
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-sky-500 w-4 h-4" checked={Boolean(isian[q.id])} onChange={(e) => setIsian({ ...isian, [q.id]: e.target.checked })} /> Ya</label>
                        )
                      ) : q.jenis === 'foto' ? (
                        <label className="btn-retro btn-retro-sm bg-zinc-700 text-white inline-flex items-center gap-1.5 cursor-pointer">
                          <Camera size={12} /> {isian[q.id] ? 'Foto terunggah ✓' : 'Ambil / pilih foto'}
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const x = e.target.files?.[0]; if (x) void unggahFoto(q.id, x); }} />
                        </label>
                      ) : (
                        <input
                          type={q.jenis === 'tanggal' ? 'date' : 'text'}
                          inputMode={q.jenis === 'angka' || q.jenis === 'rupiah' ? 'decimal' : undefined}
                          value={String(isian[q.id] ?? '')}
                          onChange={(e) => setIsian({ ...isian, [q.id]: e.target.value })}
                          placeholder={q.jenis === 'rupiah' ? 'Rp' : ''}
                          className="input-retro !text-[13px] !py-1.5"
                        />
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={kirim} disabled={mengirim} className="btn-retro bg-sky-600 text-white font-bold flex items-center gap-2">
                    {mengirim ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Kirim jawaban
                  </button>
                </>
              )}
        </div>
      )}

      {tab === 'jawaban' && (
        <div className="p-3">
          {!jawaban ? <p className="text-[13px] flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Memuat…</p>
            : jawaban.length === 0 ? <p className="text-[13px] opacity-70">Belum ada jawaban.</p>
              : (
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="border-collapse text-[12px]">
                    <thead>
                      <tr>
                        <th className={`border-2 ${garis} px-2 py-1 text-left`}>Waktu</th>
                        <th className={`border-2 ${garis} px-2 py-1 text-left`}>Pengisi</th>
                        {skema.map((q) => <th key={q.id} className={`border-2 ${garis} px-2 py-1 text-left whitespace-nowrap`}>{q.label}</th>)}
                        <th className={`border-2 ${garis}`} />
                      </tr>
                    </thead>
                    <tbody>
                      {jawaban.map((j) => (
                        <tr key={j.id}>
                          <td className={`border-2 ${garis} px-2 py-1 whitespace-nowrap`}>{new Date(j.dikirim_pada).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                          <td className={`border-2 ${garis} px-2 py-1 whitespace-nowrap`}>{j.nama_pengisi ?? '—'}{!j.user_id && <span className="ml-1 text-[10px] text-emerald-500">tautan</span>}</td>
                          {skema.map((q) => <td key={q.id} className={`border-2 ${garis} px-2 py-1`}>{tampilNilai(q, j.jawaban[q.id])}</td>)}
                          <td className={`border-2 ${garis} px-1`}><button type="button" onClick={() => hapusJawaban(j.id)} className="text-red-400 hover:text-red-300" aria-label="Hapus jawaban"><Trash2 size={12} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold">
                        <td className={`border-2 ${garis} px-2 py-1`} colSpan={2}>{jawaban.length} jawaban</td>
                        {(ringkasan ?? []).map((r, i) => <td key={i} className={`border-2 ${garis} px-2 py-1 text-[11px] whitespace-nowrap`}>{r}</td>)}
                        <td className={`border-2 ${garis}`} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
        </div>
      )}

      {tab === 'atur' && (
        <div className="p-3 space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <div><label className="label-retro">Judul formulir</label><input value={draf.judul} onChange={(e) => setDraf({ ...draf, judul: e.target.value })} className="input-retro !text-[13px] !py-1.5" /></div>
            <div><label className="label-retro">Ditutup setelah (opsional)</label><input type="date" value={draf.tutup_pada ?? ''} onChange={(e) => setDraf({ ...draf, tutup_pada: e.target.value || null })} className="input-retro !text-[13px] !py-1.5" /></div>
          </div>
          <div><label className="label-retro">Keterangan untuk pengisi</label><textarea value={draf.ket ?? ''} onChange={(e) => setDraf({ ...draf, ket: e.target.value })} rows={2} className="input-retro !text-[13px]" /></div>

          <div>
            <p className="label-retro">Pertanyaan</p>
            <div className="space-y-2">
              {draf.skema.map((q, i) => (
                <div key={q.id} className={`border-2 ${garis} p-2 space-y-1.5`}>
                  <div className="flex gap-1.5">
                    <input value={q.label} onChange={(e) => setDraf({ ...draf, skema: draf.skema.map((x) => (x.id === q.id ? { ...x, label: e.target.value } : x)) })} className="input-retro !text-[13px] !py-1 flex-1" placeholder="Pertanyaan" />
                    <select value={q.jenis} onChange={(e) => setDraf({ ...draf, skema: draf.skema.map((x) => (x.id === q.id ? { ...x, jenis: e.target.value as JenisPertanyaan } : x)) })} className="input-retro !text-[12px] !py-1 !w-36">
                      {(Object.keys(LABEL_JENIS) as JenisPertanyaan[]).map((j) => <option key={j} value={j}>{LABEL_JENIS[j]}</option>)}
                    </select>
                  </div>
                  {(q.jenis === 'pilihan' || q.jenis === 'ceklis') && (
                    <input
                      value={(q.opsi ?? []).join(', ')}
                      onChange={(e) => setDraf({ ...draf, skema: draf.skema.map((x) => (x.id === q.id ? { ...x, opsi: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } : x)) })}
                      className="input-retro !text-[12px] !py-1"
                      placeholder="Pilihan dipisah koma, mis. Baik, Rusak, Hilang"
                    />
                  )}
                  <div className="flex items-center gap-2 text-[12px]">
                    <label className="flex items-center gap-1"><input type="checkbox" className="accent-sky-500" checked={Boolean(q.wajib)} onChange={(e) => setDraf({ ...draf, skema: draf.skema.map((x) => (x.id === q.id ? { ...x, wajib: e.target.checked } : x)) })} /> Wajib</label>
                    <span className="ml-auto flex gap-1">
                      <button type="button" disabled={i === 0} onClick={() => { const s = [...draf.skema]; [s[i - 1], s[i]] = [s[i], s[i - 1]]; setDraf({ ...draf, skema: s }); }} className="disabled:opacity-30" aria-label="Naik"><ArrowUp size={13} /></button>
                      <button type="button" disabled={i === draf.skema.length - 1} onClick={() => { const s = [...draf.skema]; [s[i + 1], s[i]] = [s[i], s[i + 1]]; setDraf({ ...draf, skema: s }); }} className="disabled:opacity-30" aria-label="Turun"><ArrowDown size={13} /></button>
                      <button type="button" onClick={() => setDraf({ ...draf, skema: draf.skema.filter((x) => x.id !== q.id) })} className="text-red-400" aria-label="Hapus pertanyaan"><Trash2 size={13} /></button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setDraf({ ...draf, skema: [...draf.skema, { id: `q${Date.now().toString(36)}`, label: 'Pertanyaan baru', jenis: 'teks' }] })} className="mt-2 px-2 py-1 text-[12px] border border-sky-400 text-sky-400 flex items-center gap-1"><Plus size={12} /> Tambah pertanyaan</button>
          </div>

          <div className={`border-2 ${garis} p-2 space-y-1.5`}>
            <p className="label-retro !mb-0">Siapa yang bisa mengisi</p>
            <label className="flex items-center gap-2 text-[13px]"><input type="radio" checked={draf.mode === 'anggota'} onChange={() => setDraf({ ...draf, mode: 'anggota' })} /> <Users size={13} /> Hanya anggota yang login</label>
            <label className="flex items-center gap-2 text-[13px]"><input type="radio" checked={draf.mode === 'publik'} onChange={() => setDraf({ ...draf, mode: 'publik' })} /> <Globe size={13} /> Siapa saja lewat tautan (mis. vendor, tanpa akun)</label>
            {draf.mode === 'anggota' && (
              <label className="flex items-center gap-2 text-[12px] pl-5"><input type="checkbox" checked={Boolean(draf.sekali)} onChange={(e) => setDraf({ ...draf, sekali: e.target.checked ? 1 : 0 })} /> Satu jawaban per orang</label>
            )}
            {data.url_publik && draf.mode === 'publik' && (
              <div className="flex items-center gap-1.5 pt-1">
                <IkonTaut size={13} className="shrink-0" />
                <input readOnly value={data.url_publik} className="input-retro !text-[12px] !py-1 flex-1" onFocus={(e) => e.target.select()} />
                <button type="button" onClick={() => { void navigator.clipboard?.writeText(data.url_publik!).then(() => notify('TAUTAN FORMULIR DISALIN')); }} className="btn-ikon !w-8 !h-8 bg-zinc-700 text-white" aria-label="Salin tautan"><Copy size={13} /></button>
              </div>
            )}
            {draf.mode === 'publik' && <p className="text-[11px] opacity-70">Pertanyaan foto hanya muncul di aplikasi. Pengisi lewat tautan tidak bisa melihat jawaban orang lain.</p>}
          </div>

          <button type="button" onClick={() => simpanAtur()} disabled={menyimpan} className="btn-retro bg-sky-600 text-white font-bold flex items-center gap-2">
            {menyimpan ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Simpan formulir
          </button>
        </div>
      )}
    </div>
  );
};
