import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, FileSpreadsheet, Loader2, ArrowLeft, Copy, ChevronDown, Save, Lock, Unlock } from 'lucide-react';
import {
  muatFormulir, simpanFormulir, disposisiBaru, insidentalBaru, lbpdBaru,
  barisDisposisiBaru, barisInsidentalBaru, barisLbpdBaru,
  totalDisposisi, totalInsidental, totalLbpd, tglPanjang,
  eksporDisposisi, eksporInsidental, eksporLbpd, ALOKASI_LBPD,
  type JenisFormulir, type Formulir, type Disposisi, type RabInsidental, type Lbpd, type Penanda,
} from '../lib/formulir-keuangan';
import { terbilang } from '../lib/xlsx-templat';
import { formatRupiah } from '../lib/rab-hcga';
import { ModalBukaKunci } from './ModalBukaKunci';
import type { Pengguna } from '../lib/tipe-api';

/**
 * Money Monkey: Disposisi PNBP PKH, RAB Insidental, dan LBPD.
 * Daftar dokumen di perangkat → form isian → ekspor ke template Excel resmi.
 */

interface Props {
  jenis: JenisFormulir;
  pengguna: Pengguna;
  notify: (pesan: string) => void;
}

const INFO: Record<JenisFormulir, { judul: string; sub: string }> = {
  disposisi: { judul: 'DISPOSISI PNBP PKH', sub: 'Formulir Permintaan Kas dan Pembayaran — isi keterangan & nilai' },
  insidental: { judul: 'RAB INSIDENTAL', sub: 'Form Rencana Anggaran Biaya kegiatan insidental (mis. kunjungan Satgas)' },
  lbpd: { judul: 'LBPD', sub: 'Laporan Biaya Perjalanan Dinas' },
};

const angka = (v: string) => (v.trim() === '' ? null : Number(v.replace(/[^\d.-]/g, '')) || 0);
const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => <span className="block text-[11px] text-zinc-400 font-bold uppercase mb-0.5">{children}</span>;
const kelasInput = 'input-retro !py-1.5 !text-[13px]';

export const FormulirKeuangan: React.FC<Props> = ({ jenis, pengguna, notify }) => {
  const [daftar, setDaftar] = useState<Formulir[]>(() => muatFormulir(jenis));
  const [aktifId, setAktifId] = useState<string | null>(null);
  const [mengekspor, setMengekspor] = useState(false);
  const [bukaModalKunci, setBukaModalKunci] = useState(false);

  useEffect(() => { setDaftar(muatFormulir(jenis)); setAktifId(null); }, [jenis]);
  useEffect(() => { simpanFormulir(jenis, daftar); }, [jenis, daftar]);

  const aktif = daftar.find((f) => f.id === aktifId) ?? null;
  const ubah = (baru: Formulir) => setDaftar((d) => d.map((f) => (f.id === baru.id ? { ...baru, diubahPada: new Date().toISOString() } : f)));

  const handleSimpan = () => {
    if (!aktif) return;
    const terkunciBaru = { ...aktif, terkunci: true, diubahPada: new Date().toISOString() };
    ubah(terkunciBaru);
    notify(`${INFO[jenis].judul} DISIMPAN & TERKUNCI (PASSWORD: eblhasnurajadeh)`);
  };

  const buat = () => {
    const f = jenis === 'disposisi' ? disposisiBaru() : jenis === 'insidental' ? insidentalBaru() : lbpdBaru(pengguna.nama);
    setDaftar((d) => [f, ...d]);
    setAktifId(f.id);
  };
  const duplikat = (f: Formulir) => {
    const kini = new Date().toISOString();
    const salin = { ...JSON.parse(JSON.stringify(f)), id: `${f.id.split('-')[0]}-${Date.now()}`, dibuatPada: kini, diubahPada: kini } as Formulir;
    setDaftar((d) => [salin, ...d]);
    notify('DOKUMEN DIDUPLIKASI');
  };
  const hapus = (f: Formulir) => {
    if (!confirm(`Hapus ${judulDok(f)}?`)) return;
    setDaftar((d) => d.filter((x) => x.id !== f.id));
    if (aktifId === f.id) setAktifId(null);
  };
  const ekspor = async (f: Formulir) => {
    setMengekspor(true);
    try {
      const hasil = f.jenis === 'disposisi' ? await eksporDisposisi(f) : f.jenis === 'insidental' ? await eksporInsidental(f) : await eksporLbpd(f);
      notify(hasil === 'diunduh' ? 'EXCEL DIUNDUH' : 'EXCEL SIAP DIBAGIKAN');
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT EXCEL');
    } finally {
      setMengekspor(false);
    }
  };

  if (!aktif) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <div className="font-title text-[12px] text-yellow-300">{INFO[jenis].judul}</div>
            <div className="text-[11px] text-zinc-400">{INFO[jenis].sub}</div>
          </div>
          <button type="button" onClick={buat} className="btn-retro bg-amber-600 !py-1.5 text-[12px]"><Plus size={14} /> Buat baru</button>
        </div>
        {!daftar.length && <div className="p-8 text-center text-zinc-400 border-2 border-dashed border-white/20">Belum ada dokumen. Tekan <b className="text-white">Buat baru</b>.</div>}
        <div className="grid gap-2">
          {daftar.map((f) => (
            <div key={f.id} className="border-2 border-white/20 bg-black/50 p-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={() => setAktifId(f.id)} className="flex-1 min-w-[200px] text-left">
                <div className="font-bold text-white text-[13px] hover:text-amber-300 flex items-center gap-1.5">
                  {f.terkunci && <Lock size={13} className="text-amber-400 shrink-0" />}
                  <span>{judulDok(f)}</span>
                  {f.terkunci && (
                    <span className="text-[10px] bg-amber-950/80 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-normal font-mono">
                      Terkunci
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400">{tglPanjang(tanggalDok(f))} · {f.baris.length} baris · diubah {new Date(f.diubahPada).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </button>
              <span className="font-mono text-emerald-300 text-[13px] font-bold">{formatRupiah(totalDok(f))}</span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => ekspor(f)} disabled={mengekspor} className="btn-retro btn-retro-sm bg-emerald-700"><FileSpreadsheet size={12} /> Excel</button>
                <button type="button" onClick={() => duplikat(f)} className="btn-ikon !w-7 !h-7 bg-zinc-800" aria-label="Duplikat"><Copy size={12} /></button>
                <button type="button" onClick={() => hapus(f)} className="btn-ikon !w-7 !h-7 bg-rose-950 text-rose-300" aria-label="Hapus"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 sticky top-0 z-10 bg-zinc-950/95 py-2 border-b-2 border-white/20">
        <button type="button" onClick={() => setAktifId(null)} className="btn-retro btn-retro-sm bg-zinc-800"><ArrowLeft size={12} /> Daftar</button>
        <div className="flex items-center gap-1.5 mr-auto">
          <span className="font-title text-[11px] text-yellow-300">{INFO[jenis].judul}</span>
          {aktif.terkunci && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-amber-950/80 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
              <Lock size={10} /> Terkunci
            </span>
          )}
        </div>
        <span className="font-mono text-emerald-300 font-bold">{formatRupiah(totalDok(aktif))}</span>

        {/* Tombol Simpan atau Buka Kunci */}
        {aktif.terkunci ? (
          <button
            type="button"
            onClick={() => setBukaModalKunci(true)}
            className="btn-retro !bg-amber-600 hover:!bg-amber-500 !text-white !py-1.5 text-[12px] flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
            title="Dokumen terkunci. Klik untuk membuka kunci dengan password."
          >
            <Lock size={13} className="text-amber-200" /> Buka Kunci
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSimpan}
            className="btn-retro !bg-amber-600 hover:!bg-amber-500 !text-white !py-1.5 text-[12px] flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
            title="Simpan dokumen & kunci dengan password"
          >
            <Save size={13} /> Simpan
          </button>
        )}

        <button type="button" onClick={() => ekspor(aktif)} disabled={mengekspor} className="btn-retro bg-emerald-700 !py-1.5 text-[12px] disabled:opacity-50">
          {mengekspor ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Ekspor Excel
        </button>
      </div>

      {aktif.terkunci && (
        <div className="bg-amber-500/10 border-2 border-amber-500 text-amber-200 px-3.5 py-2.5 rounded flex items-center justify-between gap-3 text-xs font-medium">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-amber-400 shrink-0" />
            <span>Dokumen {INFO[jenis].judul} ini telah disimpan dan terkunci. Buka kunci untuk melakukan penyuntingan.</span>
          </div>
          <button
            type="button"
            onClick={() => setBukaModalKunci(true)}
            className="btn-retro btn-retro-sm !bg-amber-600 hover:!bg-amber-500 !text-white flex items-center gap-1 shrink-0"
          >
            <Unlock size={12} /> Buka Kunci
          </button>
        </div>
      )}

      <fieldset disabled={Boolean(aktif.terkunci)} className="contents space-y-3">
        {aktif.jenis === 'disposisi' && <EditorDisposisi d={aktif} ubah={ubah} />}
        {aktif.jenis === 'insidental' && <EditorInsidental r={aktif} ubah={ubah} />}
        {aktif.jenis === 'lbpd' && <EditorLbpd l={aktif} ubah={ubah} />}
      </fieldset>

      {bukaModalKunci && (
        <ModalBukaKunci
          namaDokumen={INFO[jenis].judul}
          onSukses={() => {
            setBukaModalKunci(false);
            const dibuka = { ...aktif, terkunci: false };
            ubah(dibuka);
          }}
          onBatal={() => setBukaModalKunci(false)}
          notify={notify}
        />
      )}
    </div>
  );
};

const judulDok = (f: Formulir) =>
  f.jenis === 'disposisi' ? (f.judul || 'Disposisi') : f.jenis === 'insidental' ? `RAB Insidental · ${f.kegiatan || 'tanpa nama kegiatan'}` : `LBPD · ${f.nama}${f.noSppd ? ` · ${f.noSppd}` : ''}`;
const tanggalDok = (f: Formulir) => f.tanggal;
const totalDok = (f: Formulir) => (f.jenis === 'disposisi' ? totalDisposisi(f) : f.jenis === 'insidental' ? totalInsidental(f) : totalLbpd(f));

const TombolHapusBaris: React.FC<{ onClick: () => void; nonaktif: boolean }> = ({ onClick, nonaktif }) => (
  <button type="button" onClick={onClick} disabled={nonaktif} className="btn-ikon !w-7 !h-7 bg-rose-950 text-rose-300 disabled:opacity-30 shrink-0" aria-label="Hapus baris"><Trash2 size={12} /></button>
);

// ------------------------------------------------------------------ Disposisi

const EditorDisposisi: React.FC<{ d: Disposisi; ubah: (f: Formulir) => void }> = ({ d, ubah }) => {
  const [detail, setDetail] = useState<Record<string, boolean>>({});
  const total = totalDisposisi(d);
  const ubahBaris = (id: string, patch: Partial<Disposisi['baris'][number]>) => ubah({ ...d, baris: d.baris.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label><Label>Judul (untuk daftar)</Label><input value={d.judul} onChange={(e) => ubah({ ...d, judul: e.target.value })} className={kelasInput} /></label>
        <label><Label>Tanggal</Label><input type="date" value={d.tanggal} onChange={(e) => ubah({ ...d, tanggal: e.target.value })} className={kelasInput} /></label>
        <label><Label>Nomor (opsional)</Label><input value={d.nomor} onChange={(e) => ubah({ ...d, nomor: e.target.value })} className={kelasInput} /></label>
      </div>
      <div className="space-y-2">
        {d.baris.map((b, i) => (
          <div key={b.id} className="border-2 border-white/20 bg-black/40 p-2 space-y-2">
            <div className="flex flex-wrap gap-2 items-start">
              <span className="font-title text-[10px] text-amber-300 pt-2 w-5">{i + 1}.</span>
              <label className="flex-1 min-w-[220px]"><Label>Keterangan</Label>
                <textarea rows={2} value={b.keterangan} onChange={(e) => ubahBaris(b.id, { keterangan: e.target.value })} className={`${kelasInput} resize-y`}
                  placeholder="Disposisi Biaya Operasional Departemen Operation (Verifikasi PNBP PKH SK 966)" />
              </label>
              <label className="w-40"><Label>Nilai (Rp)</Label>
                <input inputMode="numeric" value={b.nilai ?? ''} onChange={(e) => ubahBaris(b.id, { nilai: angka(e.target.value) })} className={`${kelasInput} font-mono text-right`} placeholder="7200000" />
              </label>
              <div className="pt-5"><TombolHapusBaris onClick={() => ubah({ ...d, baris: d.baris.filter((x) => x.id !== b.id) })} nonaktif={d.baris.length <= 1} /></div>
            </div>
            <button type="button" onClick={() => setDetail((x) => ({ ...x, [b.id]: !x[b.id] }))} className="text-[11px] text-zinc-400 underline decoration-dotted flex items-center gap-1 ml-7">
              <ChevronDown size={11} className={detail[b.id] ? '' : '-rotate-90'} /> Tanggal jatuh tempo & kode budget (opsional)
            </button>
            {detail[b.id] && (
              <div className="grid grid-cols-2 gap-2 ml-7">
                <label><Label>Tgl jatuh tempo</Label><input type="date" value={b.jatuhTempo} onChange={(e) => ubahBaris(b.id, { jatuhTempo: e.target.value })} className={kelasInput} /></label>
                <label><Label>Kode budget</Label><input value={b.kodeBudget} onChange={(e) => ubahBaris(b.id, { kodeBudget: e.target.value })} className={`${kelasInput} font-mono`} placeholder="AB3.11-06.02.22.02" /></label>
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={() => ubah({ ...d, baris: [...d.baris, barisDisposisiBaru()] })} className="btn-retro btn-retro-sm bg-zinc-800"><Plus size={12} /> Tambah baris</button>
      </div>
      <div className="border-2 border-emerald-500/60 bg-emerald-950/30 p-2.5 text-[12px]">
        <div className="flex justify-between font-bold text-white"><span>Total</span><span className="font-mono text-emerald-300">{formatRupiah(total)}</span></div>
        <div className="text-zinc-300 mt-1">Terbilang: <i>{terbilang(total)}</i></div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ RAB Insidental

const KotakPenanda: React.FC<{ judul: string; p: Penanda; ubah: (p: Penanda) => void }> = ({ judul, p, ubah }) => (
  <div className="border border-white/20 p-2 space-y-1.5">
    <Label>{judul}</Label>
    <input value={p.nama} onChange={(e) => ubah({ ...p, nama: e.target.value })} className={kelasInput} placeholder="Nama" />
    <input value={p.jabatan} onChange={(e) => ubah({ ...p, jabatan: e.target.value })} className={kelasInput} placeholder="Jabatan" />
  </div>
);

const EditorInsidental: React.FC<{ r: RabInsidental; ubah: (f: Formulir) => void }> = ({ r, ubah }) => {
  const ubahBaris = (id: string, patch: Partial<RabInsidental['baris'][number]>) => ubah({ ...r, baris: r.baris.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label><Label>Nama</Label><input value={r.nama} onChange={(e) => ubah({ ...r, nama: e.target.value })} className={kelasInput} /></label>
        <label><Label>Department</Label><input value={r.departemen} onChange={(e) => ubah({ ...r, departemen: e.target.value })} className={kelasInput} /></label>
        <label><Label>Tanggal</Label><input type="date" value={r.tanggal} onChange={(e) => ubah({ ...r, tanggal: e.target.value })} className={kelasInput} /></label>
        <label><Label>Kegiatan</Label><input value={r.kegiatan} onChange={(e) => ubah({ ...r, kegiatan: e.target.value })} className={kelasInput} placeholder="Kunjungan Satgas Estimasi 1 Hari" /></label>
      </div>
      <div className="space-y-2">
        {r.baris.map((b, i) => (
          <div key={b.id} className="border-2 border-white/20 bg-black/40 p-2 grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
            <span className="font-title text-[10px] text-amber-300 sm:col-span-12">{i + 1}.</span>
            <label className="col-span-2 sm:col-span-4"><Label>Kegiatan</Label><input value={b.kegiatan} onChange={(e) => ubahBaris(b.id, { kegiatan: e.target.value })} className={kelasInput} placeholder="Drone Grid" /></label>
            <label className="col-span-2 sm:col-span-3"><Label>Keterangan</Label><input value={b.keterangan} onChange={(e) => ubahBaris(b.id, { keterangan: e.target.value })} className={kelasInput} placeholder="Paket / Orang" /></label>
            <label className="sm:col-span-1"><Label>Banyak</Label><input inputMode="numeric" value={b.banyak ?? ''} onChange={(e) => ubahBaris(b.id, { banyak: angka(e.target.value) })} className={`${kelasInput} font-mono text-right`} /></label>
            <label className="sm:col-span-2"><Label>Harga satuan</Label><input inputMode="numeric" value={b.harga ?? ''} onChange={(e) => ubahBaris(b.id, { harga: angka(e.target.value) })} className={`${kelasInput} font-mono text-right`} /></label>
            <label className="sm:col-span-2"><Label>Kode budget (WBS)</Label><input value={b.wbs} onChange={(e) => ubahBaris(b.id, { wbs: e.target.value })} className={`${kelasInput} font-mono`} /></label>
            <div className="col-span-2 sm:col-span-12 flex items-center justify-between">
              <span className="font-mono text-emerald-300 text-[12px]">Total {formatRupiah((b.banyak ?? 0) * (b.harga ?? 0))}</span>
              <TombolHapusBaris onClick={() => ubah({ ...r, baris: r.baris.filter((x) => x.id !== b.id) })} nonaktif={r.baris.length <= 1} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => ubah({ ...r, baris: [...r.baris, barisInsidentalBaru()] })} className="btn-retro btn-retro-sm bg-zinc-800"><Plus size={12} /> Tambah baris</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <KotakPenanda judul="Dibuat oleh" p={r.dibuat} ubah={(p) => ubah({ ...r, dibuat: p })} />
        <KotakPenanda judul="Diperiksa oleh" p={r.diperiksa} ubah={(p) => ubah({ ...r, diperiksa: p })} />
        <KotakPenanda judul="Disetujui oleh" p={r.disetujui} ubah={(p) => ubah({ ...r, disetujui: p })} />
      </div>
    </div>
  );
};

// ------------------------------------------------------------------ LBPD

const EditorLbpd: React.FC<{ l: Lbpd; ubah: (f: Formulir) => void }> = ({ l, ubah }) => {
  const ubahBaris = (id: string, patch: Partial<Lbpd['baris'][number]>) => ubah({ ...l, baris: l.baris.map((b) => (b.id === id ? { ...b, ...patch } : b)) });
  const total = totalLbpd(l);
  const perAlokasi = useMemo(() => ALOKASI_LBPD.map((a) => ({ ...a, n: l.baris.filter((b) => b.alokasi === a.id).reduce((x, b) => x + (b.nilai ?? 0), 0) })), [l.baris]);
  const selisih = (l.kasRbpd ?? 0) - total;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <label><Label>Nama</Label><input value={l.nama} onChange={(e) => ubah({ ...l, nama: e.target.value })} className={kelasInput} /></label>
        <label><Label>Division</Label><input value={l.divisi} onChange={(e) => ubah({ ...l, divisi: e.target.value })} className={kelasInput} /></label>
        <label><Label>No SPPD</Label><input value={l.noSppd} onChange={(e) => ubah({ ...l, noSppd: e.target.value })} className={`${kelasInput} font-mono`} /></label>
        <label><Label>Periode</Label><input value={l.periode} onChange={(e) => ubah({ ...l, periode: e.target.value })} className={kelasInput} /></label>
      </div>
      <div className="space-y-2">
        {l.baris.map((b) => (
          <div key={b.id} className="border-2 border-white/20 bg-black/40 p-2 grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
            <label className="sm:col-span-2"><Label>Tanggal</Label><input type="date" value={b.tanggal} onChange={(e) => ubahBaris(b.id, { tanggal: e.target.value })} className={kelasInput} /></label>
            <label className="col-span-2 sm:col-span-4"><Label>Uraian</Label><input value={b.uraian} onChange={(e) => ubahBaris(b.id, { uraian: e.target.value })} className={kelasInput} placeholder="Gocar Stasiun Gambir - Hotel" /></label>
            <label className="sm:col-span-1"><Label>Ref.</Label><input value={b.ref} onChange={(e) => ubahBaris(b.id, { ref: e.target.value })} className={kelasInput} /></label>
            <label className="sm:col-span-2"><Label>Nilai (Rp)</Label><input inputMode="numeric" value={b.nilai ?? ''} onChange={(e) => ubahBaris(b.id, { nilai: angka(e.target.value) })} className={`${kelasInput} font-mono text-right`} /></label>
            <label className="sm:col-span-2"><Label>Alokasi</Label>
              <select value={b.alokasi} onChange={(e) => ubahBaris(b.id, { alokasi: e.target.value as Lbpd['baris'][number]['alokasi'] })} className={kelasInput}>
                {ALOKASI_LBPD.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
            <div className="sm:col-span-1 flex justify-end"><TombolHapusBaris onClick={() => ubah({ ...l, baris: l.baris.filter((x) => x.id !== b.id) })} nonaktif={l.baris.length <= 1} /></div>
          </div>
        ))}
        <button type="button" onClick={() => ubah({ ...l, baris: [...l.baris, barisLbpdBaru(l.baris[l.baris.length - 1]?.tanggal)] })} className="btn-retro btn-retro-sm bg-zinc-800"><Plus size={12} /> Tambah baris</button>
      </div>
      <div className="border-2 border-emerald-500/60 bg-emerald-950/30 p-2.5 text-[12px] space-y-1.5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-300">{perAlokasi.map((a) => <span key={a.id}>{a.label}: <b className="font-mono text-white">{formatRupiah(a.n)}</b></span>)}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
          <label><Label>Kas RBPD (diterima)</Label><input inputMode="numeric" value={l.kasRbpd ?? ''} onChange={(e) => ubah({ ...l, kasRbpd: angka(e.target.value) })} className={`${kelasInput} font-mono text-right`} /></label>
          <div className="font-bold text-white">Total biaya: <span className="font-mono text-emerald-300">{formatRupiah(total)}</span></div>
          <div className={`font-bold ${selisih < 0 ? 'text-red-300' : 'text-emerald-300'}`}>{selisih < 0 ? 'Kekurangan' : 'Kelebihan'} kas: <span className="font-mono">{formatRupiah(Math.abs(selisih))}</span></div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
        <label><Label>Tempat</Label><input value={l.tempat} onChange={(e) => ubah({ ...l, tempat: e.target.value })} className={kelasInput} /></label>
        <label><Label>Tanggal</Label><input type="date" value={l.tanggal} onChange={(e) => ubah({ ...l, tanggal: e.target.value })} className={kelasInput} /></label>
        <label><Label>Dibuat oleh</Label><input value={l.dibuat} onChange={(e) => ubah({ ...l, dibuat: e.target.value })} className={kelasInput} /></label>
        <label><Label>Diketahui SDM</Label><input value={l.diketahuiSdm} onChange={(e) => ubah({ ...l, diketahuiSdm: e.target.value })} className={kelasInput} /></label>
        <label><Label>Diperiksa</Label><input value={l.diperiksa} onChange={(e) => ubah({ ...l, diperiksa: e.target.value })} className={kelasInput} /></label>
        <label><Label>Disetujui oleh</Label><input value={l.disetujui} onChange={(e) => ubah({ ...l, disetujui: e.target.value })} className={kelasInput} /></label>
      </div>
    </div>
  );
};
