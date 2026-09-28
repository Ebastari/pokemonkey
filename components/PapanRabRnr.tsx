import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Minus, Trash2, Settings2, Save, ShoppingCart, LayoutGrid, Loader2, PackagePlus, Undo2, Pencil, X } from 'lucide-react';
import { muatKatalog, simpanBarangKatalog, hapusBarangKatalog, type BarangKatalog } from '../lib/katalog-rab';
import {
  kartuRab, isiKeranjang, tambahKeKeranjang, pindahKartu, susunRab, ubahKartu, hapusKartu,
  DAFTAR_WBS, WBS_BAWAAN, type RabRnr, type KartuRab,
} from '../lib/rab-rnr';
import { formatRupiah } from '../lib/rab-hcga';

/**
 * Papan RAB RNR:
 * Mode "Isi Otomatis" RAB RNR (mode "Isi Manual" = tabel di RabRnr.tsx):
 *  1. Pengisian cepat — kotak uraian katalog, tekan ADD → masuk keranjang (qty 1).
 *  2. Keranjang — atur qty, buang yang tidak diajukan, lalu "Susun RAB".
 *  3. Papan minggu — isi keranjang masuk Minggu I; seret (atau ketuk I·II·III·IV)
 *     ke minggu pengajuannya. Uraian sama di beberapa minggu tetap satu baris di Excel.
 */

interface Props {
  rab: RabRnr;
  ubah: (r: RabRnr) => void;
  bolehKelola: boolean;
  notify: (pesan: string) => void;
}

const ROMAWI = ['I', 'II', 'III', 'IV'];
const kelas = 'input-retro !py-1 !text-[12px]';

const PilihWbs: React.FC<{ nilai: string; ubah: (v: string) => void }> = ({ nilai, ubah }) => (
  <select value={nilai} onChange={(e) => ubah(e.target.value)} className={`${kelas} !text-[11px]`} aria-label="Kode WBS">
    {!DAFTAR_WBS.some((w) => w.kode === nilai) && nilai && <option value={nilai}>{nilai}</option>}
    {DAFTAR_WBS.map((w) => <option key={w.kode} value={w.kode}>{w.kode} · {w.deskripsi}</option>)}
  </select>
);

const Qty: React.FC<{ n: number; ubah: (n: number) => void }> = ({ n, ubah }) => (
  <div className="flex items-center border-2 border-white/40 bg-black/60 shrink-0">
    <button type="button" onClick={() => ubah(n - 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10" aria-label="Kurangi"><Minus size={11} /></button>
    <span className="w-7 text-center text-[12px] font-bold font-mono">{n}</span>
    <button type="button" onClick={() => ubah(n + 1)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10" aria-label="Tambah"><Plus size={11} /></button>
  </div>
);

export const PapanRabRnr: React.FC<Props> = ({ rab, ubah, bolehKelola, notify }) => {
  const [katalog, setKatalog] = useState<BarangKatalog[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galatKatalog, setGalatKatalog] = useState<string | null>(null);
  const [cari, setCari] = useState('');
  const [kelompok, setKelompok] = useState('');
  const [kelola, setKelola] = useState(false);
  const [editSatuId, setEditSatuId] = useState<string | null>(null);
  const [suntingan, setSuntingan] = useState<Record<string, BarangKatalog>>({});
  const [baru, setBaru] = useState({ uraian: '', satuan: 'Paket', harga: '', wbs: WBS_BAWAAN });
  const [diseret, setDiseret] = useState<string | null>(null);
  const [sasaran, setSasaran] = useState<number | null>(null);

  const muat = () => {
    setMemuat(true);
    muatKatalog()
      .then((k) => { setKatalog(k); setGalatKatalog(null); })
      .catch((e) => setGalatKatalog(e instanceof Error ? e.message : 'Katalog tidak terjangkau.'))
      .finally(() => setMemuat(false));
  };
  useEffect(muat, []);

  const kartu = kartuRab(rab);
  const keranjang = isiKeranjang(rab);
  const daftarKelompok = useMemo(() => [...new Set(katalog.map((b) => b.kelompok))], [katalog]);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return katalog.filter((b) => (!kelompok || b.kelompok === kelompok) && (!q || `${b.nama} ${b.kelompok}`.toLowerCase().includes(q)));
  }, [katalog, cari, kelompok]);
  const diKeranjang = (b: BarangKatalog) => keranjang.filter((k) => k.uraian.trim().toLowerCase() === b.nama.trim().toLowerCase()).reduce((n, k) => n + k.qty, 0);

  const add = (b: { uraian: string; wbs: string; satuan: string; harga: number }) => {
    ubah(tambahKeKeranjang(rab, b));
    notify(`+ ${b.uraian.toUpperCase()} MASUK KERANJANG`);
  };
  const ubahQty = (k: KartuRab, n: number) => ubah(n <= 0 ? hapusKartu(rab, k.id) : ubahKartu(rab, k.id, { qty: n }));

  /** Kelola katalog (Admin/Supervisor): tambah kotak uraian baru ke katalog. */
  const tambahKeKatalog = async () => {
    const uraian = baru.uraian.trim();
    if (!uraian) { notify('ISI URAIAN DULU'); return; }
    try {
      await simpanBarangKatalog({ nama: uraian, wbs: baru.wbs, satuan: baru.satuan.trim() || 'Paket', harga: Number(baru.harga) || 0, kelompok: 'Pengajuan Rutin', urutan: 50 });
      notify('URAIAN MASUK KATALOG');
      setBaru({ ...baru, uraian: '', harga: '' });
      muat();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN KE KATALOG'); }
  };
  const simpanSuntingan = async (b: BarangKatalog) => {
    try {
      await simpanBarangKatalog(b);
      setSuntingan((s) => { const x = { ...s }; delete x[b.id]; return x; });
      if (editSatuId === b.id) setEditSatuId(null);
      muat();
      notify('KATALOG DIPERBARUI');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN'); }
  };
  const hapusKatalog = async (b: BarangKatalog) => {
    if (!confirm(`Hapus "${b.nama}" dari katalog?`)) return;
    try {
      await hapusBarangKatalog(b.id);
      if (editSatuId === b.id) setEditSatuId(null);
      muat();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGHAPUS'); }
  };

  const jatuhkan = (minggu: KartuRab['minggu']) => {
    if (diseret) ubah(pindahKartu(rab, diseret, minggu));
    setDiseret(null);
    setSasaran(null);
  };
  const zona = (minggu: KartuRab['minggu']) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setSasaran(minggu); },
    onDragLeave: () => setSasaran((s) => (s === minggu ? null : s)),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); jatuhkan(minggu); },
  });

  const kotakAjuan = (k: KartuRab) => (
    <div
      key={k.id}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', k.id); e.dataTransfer.effectAllowed = 'move'; setDiseret(k.id); }}
      onDragEnd={() => { setDiseret(null); setSasaran(null); }}
      className={`border-2 bg-zinc-900 p-1.5 cursor-grab active:cursor-grabbing space-y-1 ${diseret === k.id ? 'opacity-40 border-yellow-300' : 'border-white/25'}`}
    >
      <div className="text-[12px] font-bold text-white leading-tight">{k.uraian || <i className="text-zinc-500 font-normal">(uraian belum diisi)</i>}</div>
      <div className="text-[10px] text-zinc-400">{formatRupiah(k.harga)} / {k.satuan}</div>
      <div className="flex items-center gap-1.5">
        <Qty n={k.qty} ubah={(n) => ubahQty(k, n)} />
        <span className="ml-auto font-mono text-[11px] text-emerald-300 font-bold">{formatRupiah(k.qty * k.harga)}</span>
      </div>
      <div className="flex items-center gap-1">
        {ROMAWI.map((r, i) => (
          <button key={r} type="button" onClick={() => ubah(pindahKartu(rab, k.id, (i + 1) as KartuRab['minggu']))}
            className={`flex-1 h-6 text-[10px] font-bold border ${k.minggu === i + 1 ? 'bg-amber-500 text-black border-amber-300' : 'border-white/25 text-zinc-300 hover:bg-white/10'}`}
            aria-label={`Pindah ke Minggu ${r}`}>{r}</button>
        ))}
        {k.minggu !== 0 && (
          <button type="button" onClick={() => ubah(pindahKartu(rab, k.id, 0))} className="h-6 px-1 border border-white/25 text-zinc-300 hover:bg-white/10" aria-label="Kembalikan ke keranjang"><Undo2 size={11} /></button>
        )}
        <button type="button" onClick={() => ubah(hapusKartu(rab, k.id))} className="h-6 px-1 border border-rose-500/50 text-rose-300 hover:bg-rose-950" aria-label="Hapus ajuan"><Trash2 size={11} /></button>
      </div>
    </div>
  );

  const totalMingguKe = (m: number) => kartu.filter((k) => k.minggu === m).reduce((n, k) => n + k.qty * k.harga, 0);

  return (
    <div className="space-y-4">
      {/* 1. Pengisian cepat */}
      <section className="border-2 border-white/25 bg-black/40 p-2.5 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-title text-[11px] text-emerald-300 mr-auto">1. PENGISIAN CEPAT · KATALOG URAIAN</h3>
          {bolehKelola && (
            <button
              type="button"
              onClick={() => {
                setKelola((v) => !v);
                setEditSatuId(null);
              }}
              className={`btn-retro btn-retro-sm ${kelola ? 'bg-amber-600' : 'bg-zinc-800'}`}
              title="Kelola semua kolom katalog sekaligus"
            >
              <Settings2 size={12} /> {kelola ? 'Selesai kelola' : 'Kelola katalog'}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari uraian…" className="input-retro !pl-8 !py-1 !text-[12px]" />
          </div>
          {['', ...daftarKelompok].map((k) => (
            <button key={k || 'semua'} type="button" onClick={() => setKelompok(k)}
              className={`chip-retro !text-[11px] ${kelompok === k ? 'border-yellow-300 bg-yellow-500 text-black' : 'border-white/30 text-zinc-300'}`}>{k || 'Semua'}</button>
          ))}
        </div>
        {memuat && <p className="text-[12px] text-zinc-400"><Loader2 size={13} className="animate-spin inline mr-1" />Memuat katalog…</p>}
        {galatKatalog && <p className="text-[12px] text-amber-300">Katalog tidak terjangkau ({galatKatalog}). Pakai mode Isi Manual untuk mengetik uraian sendiri.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {tampil.map((b) => {
            const sedangEdit = (kelola && bolehKelola) || (editSatuId === b.id && bolehKelola);
            if (sedangEdit) {
              const s = suntingan[b.id] ?? b;
              const ubahS = (patch: Partial<BarangKatalog>) => setSuntingan((x) => ({ ...x, [b.id]: { ...s, ...patch } }));
              const modeSatu = editSatuId === b.id && !kelola;
              return (
                <div key={b.id} className="border-2 border-amber-500/60 bg-amber-950/20 p-1.5 space-y-1">
                  {modeSatu && (
                    <div className="flex items-center justify-between text-[10px] text-amber-300 font-bold px-0.5 pb-0.5 border-b border-amber-500/30">
                      <span className="flex items-center gap-1"><Pencil size={10} /> SUNTING SATU KOLOM</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSuntingan((prev) => { const copy = { ...prev }; delete copy[b.id]; return copy; });
                          setEditSatuId(null);
                        }}
                        className="text-zinc-400 hover:text-white"
                        title="Batal"
                        aria-label="Tutup / Batal sunting"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <input value={s.nama} onChange={(e) => ubahS({ nama: e.target.value })} className={kelas} aria-label="Uraian" placeholder="Nama uraian" />
                  <div className="flex gap-1">
                    <input type="number" value={s.harga} onChange={(e) => ubahS({ harga: Number(e.target.value) || 0 })} className={`${kelas} font-mono`} aria-label="Harga" placeholder="Harga" />
                    <input value={s.satuan} onChange={(e) => ubahS({ satuan: e.target.value })} className={`${kelas} !w-20`} aria-label="Satuan" placeholder="Satuan" />
                  </div>
                  <input value={s.kelompok} onChange={(e) => ubahS({ kelompok: e.target.value })} className={kelas} aria-label="Kelompok" placeholder="Kelompok" />
                  <PilihWbs nilai={s.wbs} ubah={(v) => ubahS({ wbs: v })} />
                  <div className="flex gap-1 pt-0.5">
                    <button
                      type="button"
                      disabled={!suntingan[b.id] && !modeSatu}
                      onClick={() => simpanSuntingan(s)}
                      className="btn-retro btn-retro-sm bg-emerald-700 flex-1 disabled:opacity-30"
                      title="Simpan perubahan ke katalog"
                    >
                      <Save size={11} /> Simpan
                    </button>
                    {modeSatu && (
                      <button
                        type="button"
                        onClick={() => {
                          setSuntingan((prev) => { const copy = { ...prev }; delete copy[b.id]; return copy; });
                          setEditSatuId(null);
                        }}
                        className="btn-retro btn-retro-sm bg-zinc-800 text-zinc-300"
                        title="Batal sunting"
                      >
                        <X size={11} /> Batal
                      </button>
                    )}
                    <button type="button" onClick={() => hapusKatalog(b)} className="btn-ikon !w-7 !h-7 bg-rose-900" aria-label="Hapus dari katalog" title="Hapus dari katalog"><Trash2 size={11} /></button>
                  </div>
                </div>
              );
            }
            const n = diKeranjang(b);
            return (
              <div key={b.id} className={`border-2 p-2 flex flex-col gap-1 ${n ? 'border-yellow-400 bg-yellow-950/20' : 'border-white/20 bg-zinc-900'}`}>
                <div className="text-[12px] font-bold text-white leading-tight flex-1">{b.nama}</div>
                <div className="text-[11px] text-emerald-300 font-mono">{formatRupiah(b.harga)} <span className="text-zinc-400">/ {b.satuan}</span></div>
                <div className="flex items-center gap-1 mt-auto pt-1">
                  {n > 0 && <span className="chip-retro !text-[10px] border-yellow-400 text-yellow-200">{n} di keranjang</span>}
                  <div className="ml-auto flex items-center gap-1">
                    {bolehKelola && (
                      <button
                        type="button"
                        onClick={() => {
                          setSuntingan((x) => ({ ...x, [b.id]: { ...b } }));
                          setEditSatuId(b.id);
                        }}
                        className="btn-retro btn-retro-sm bg-zinc-800 hover:bg-amber-600 text-zinc-300 hover:text-white border border-white/20 hover:border-amber-400 !px-1.5"
                        title={`Edit uraian "${b.nama}"`}
                        aria-label={`Edit uraian "${b.nama}"`}
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                    <button type="button" onClick={() => add({ uraian: b.nama, wbs: b.wbs, satuan: b.satuan, harga: b.harga })} className="btn-retro btn-retro-sm bg-amber-600">
                      <Plus size={12} /> ADD
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {kelola && bolehKelola && (
        <div className="border-2 border-dashed border-cyan-500/60 p-2 space-y-1.5">
          <div className="text-[11px] font-title text-cyan-300 flex items-center gap-1"><PackagePlus size={12} /> TAMBAH URAIAN KE KATALOG</div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
            <input value={baru.uraian} onChange={(e) => setBaru({ ...baru, uraian: e.target.value })} placeholder="Uraian, mis. Kunjungan Verifikasi PNBP PKH SK 892" className={`${kelas} col-span-2 sm:col-span-3`} />
            <input value={baru.satuan} onChange={(e) => setBaru({ ...baru, satuan: e.target.value })} placeholder="Satuan" className={kelas} />
            <input type="number" value={baru.harga} onChange={(e) => setBaru({ ...baru, harga: e.target.value })} placeholder="Harga" className={`${kelas} font-mono`} />
            <button type="button" onClick={tambahKeKatalog} className="btn-retro btn-retro-sm bg-cyan-700"><Save size={12} /> Simpan</button>
            <div className="col-span-2 sm:col-span-6"><PilihWbs nilai={baru.wbs} ubah={(v) => setBaru({ ...baru, wbs: v })} /></div>
          </div>
        </div>
        )}
      </section>

      {/* 2. Keranjang */}
      <section {...zona(0)} className={`border-2 p-2.5 space-y-2 ${sasaran === 0 ? 'border-yellow-300 bg-yellow-950/20' : 'border-yellow-500/50 bg-black/40'}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-title text-[11px] text-yellow-300 mr-auto flex items-center gap-1.5"><ShoppingCart size={13} /> 2. KERANJANG ({keranjang.length})</h3>
          <span className="font-mono text-[12px] text-emerald-300">{formatRupiah(totalMingguKe(0))}</span>
          <button type="button" disabled={!keranjang.length} onClick={() => { ubah(susunRab(rab)); notify('ISI KERANJANG MASUK MINGGU I · SESUAIKAN MINGGUNYA'); }}
            className="btn-retro bg-amber-600 !py-1 text-[12px] disabled:opacity-40"><LayoutGrid size={13} /> Susun RAB</button>
        </div>
        {!keranjang.length
          ? <p className="text-[12px] text-zinc-500">Keranjang kosong. Tekan ADD pada kotak uraian di atas.</p>
          : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{keranjang.map(kotakAjuan)}</div>}
      </section>

      {/* 3. Papan minggu */}
      <section className="space-y-1.5">
        <h3 className="font-title text-[11px] text-emerald-300">3. SUSUNAN RAB PER MINGGU <span className="font-body text-zinc-500 normal-case">· seret kotak, atau ketuk I · II · III · IV</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map((m) => {
            const isi = kartu.filter((k) => k.minggu === m);
            return (
              <div key={m} {...zona(m as KartuRab['minggu'])}
                className={`border-2 flex flex-col min-h-[140px] ${sasaran === m ? 'border-yellow-300 bg-yellow-950/20' : 'border-emerald-600/60 bg-black/40'}`}>
                <div className="bg-[#2f5d33] text-white font-title text-[11px] px-2 py-1.5">MINGGU {ROMAWI[m - 1]} <span className="font-body text-emerald-200">· {rab.bulan}</span></div>
                <div className="flex-1 p-1.5 space-y-1.5">
                  {isi.length ? isi.map(kotakAjuan) : <p className="text-[11px] text-zinc-600 text-center pt-6">Seret ajuan ke sini</p>}
                </div>
                <div className="border-t-2 border-emerald-600/60 px-2 py-1 flex justify-between text-[12px] font-bold">
                  <span className="text-zinc-300">Subtotal</span><span className="font-mono text-emerald-300">{formatRupiah(totalMingguKe(m))}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
