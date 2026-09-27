import React, { useEffect, useMemo, useState } from 'react';
import { X, Search, Minus, Plus, ShoppingCart, Loader2, Settings2, Trash2, Save, PackagePlus } from 'lucide-react';
import {
  muatKatalog, simpanBarangKatalog, hapusBarangKatalog, LEMBAR_RAB,
  type BarangKatalog, type PilihanBelanja,
} from '../lib/katalog-rab';
import { formatRupiah } from '../lib/rab-hcga';

/**
 * Form belanja RAB ala marketplace: centang barang dari katalog, atur jumlah
 * dengan − / +, pilih minggu, tambah barang manual bila tidak ada di katalog.
 * Hasilnya dimasukkan ke lembar RAB (form edit & ekspor Excel tetap sama).
 * Admin/Supervisor bisa mengubah katalog langsung dari sini.
 */

interface Props {
  bolehKelola: boolean;
  bulan: string;
  notify: (pesan: string) => void;
  onTutup: () => void;
  onMasukkan: (pilihan: PilihanBelanja[]) => void;
}

interface Keranjang { qty: number; mingguKe: number }
interface BarangManual extends PilihanBelanja { id: string }

const MINGGU = [1, 2, 3, 4];
const ROMAWI = ['I', 'II', 'III', 'IV'];
const lembar = (id: string) => LEMBAR_RAB.find((l) => l.id === id)?.nama ?? id;

export const FormBelanjaRab: React.FC<Props> = ({ bolehKelola, bulan, notify, onTutup, onMasukkan }) => {
  const [katalog, setKatalog] = useState<BarangKatalog[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [cari, setCari] = useState('');
  const [kelompok, setKelompok] = useState('');
  const [mingguBawaan, setMingguBawaan] = useState(1);
  const [keranjang, setKeranjang] = useState<Record<string, Keranjang>>({});
  const [manual, setManual] = useState<BarangManual[]>([]);
  const [isian, setIsian] = useState({ namaBarang: '', kategori: 'pantry', satuan: 'Pcs', hargaSatuan: '', qty: '1', keKatalog: false });
  const [kelola, setKelola] = useState(false);
  const [suntingan, setSuntingan] = useState<Record<string, BarangKatalog>>({});

  const muat = () => {
    setMemuat(true);
    muatKatalog()
      .then(setKatalog)
      .catch((e) => notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT KATALOG'))
      .finally(() => setMemuat(false));
  };
  useEffect(muat, []);

  const daftarKelompok = useMemo(() => [...new Set(katalog.map((b) => b.kelompok))], [katalog]);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return katalog.filter((b) => (!kelompok || b.kelompok === kelompok) && (!q || `${b.nama} ${b.kelompok}`.toLowerCase().includes(q)));
  }, [katalog, cari, kelompok]);

  const ubahQty = (b: BarangKatalog, qty: number) => setKeranjang((k) => {
    const salin = { ...k };
    if (qty <= 0) delete salin[b.id];
    else salin[b.id] = { qty, mingguKe: k[b.id]?.mingguKe ?? mingguBawaan };
    return salin;
  });
  const ubahMinggu = (id: string, mingguKe: number) => setKeranjang((k) => (k[id] ? { ...k, [id]: { ...k[id], mingguKe } } : k));

  const pilihan: PilihanBelanja[] = useMemo(() => [
    ...katalog.filter((b) => keranjang[b.id]).map((b) => ({
      kategori: b.kategori, mingguKe: keranjang[b.id].mingguKe, namaBarang: b.nama, satuan: b.satuan, hargaSatuan: b.harga, qty: keranjang[b.id].qty,
    })),
    ...manual,
  ], [katalog, keranjang, manual]);
  const total = pilihan.reduce((n, p) => n + p.qty * p.hargaSatuan, 0);

  const tambahManual = async () => {
    const nama = isian.namaBarang.trim();
    const harga = Number(isian.hargaSatuan) || 0;
    const qty = Math.max(1, Number(isian.qty) || 1);
    if (!nama) { notify('ISI NAMA BARANG DULU'); return; }
    setManual((m) => [...m, { id: `m-${Date.now()}`, namaBarang: nama, kategori: isian.kategori, satuan: isian.satuan.trim() || 'Pcs', hargaSatuan: harga, qty, mingguKe: mingguBawaan }]);
    if (isian.keKatalog && bolehKelola) {
      try {
        await simpanBarangKatalog({ nama, kategori: isian.kategori, kelompok: 'Lainnya', satuan: isian.satuan.trim() || 'Pcs', harga, urutan: 90 });
        muat();
      } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN KE KATALOG'); }
    }
    setIsian({ namaBarang: '', kategori: isian.kategori, satuan: 'Pcs', hargaSatuan: '', qty: '1', keKatalog: false });
  };

  const simpanSuntingan = async (b: BarangKatalog) => {
    try {
      await simpanBarangKatalog(b);
      setSuntingan((s) => { const x = { ...s }; delete x[b.id]; return x; });
      muat();
      notify('KATALOG DIPERBARUI');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN'); }
  };
  const hapus = async (b: BarangKatalog) => {
    if (!confirm(`Hapus "${b.nama}" dari katalog?`)) return;
    try { await hapusBarangKatalog(b.id); muat(); } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGHAPUS'); }
  };

  const kotakQty = (qty: number, ubah: (n: number) => void) => (
    <div className="flex items-center border-2 border-white/40 bg-black/60">
      <button type="button" onClick={() => ubah(qty - 1)} className="w-7 h-7 flex items-center justify-center text-zinc-200 hover:bg-white/10" aria-label="Kurangi"><Minus size={13} /></button>
      <input type="number" min={0} value={qty} onChange={(e) => ubah(Math.max(0, Number(e.target.value) || 0))}
        className="w-12 h-7 bg-transparent text-center text-[13px] font-bold text-white font-mono [appearance:textfield]" aria-label="Jumlah" />
      <button type="button" onClick={() => ubah(qty + 1)} className="w-7 h-7 flex items-center justify-center text-zinc-200 hover:bg-white/10" aria-label="Tambah"><Plus size={13} /></button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex items-stretch justify-center sm:p-4">
      <div className="bg-zinc-900 border-4 border-white w-full max-w-4xl flex flex-col shadow-[8px_8px_0_#000] min-h-0">
        {/* Kepala */}
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-white/20 p-3">
          <h3 className="font-title text-[13px] text-yellow-300 flex items-center gap-2 mr-auto"><ShoppingCart size={16} /> BELANJA KEBUTUHAN RAB</h3>
          <label className="text-[11px] text-zinc-300 flex items-center gap-1.5">Masuk ke
            <select value={mingguBawaan} onChange={(e) => setMingguBawaan(Number(e.target.value))} className="input-retro !w-auto !py-1 !text-[12px]">
              {MINGGU.map((m) => <option key={m} value={m}>Minggu {ROMAWI[m - 1]} {bulan}</option>)}
            </select>
          </label>
          {bolehKelola && (
            <button type="button" onClick={() => setKelola((v) => !v)} className={`btn-retro btn-retro-sm ${kelola ? 'bg-amber-600' : 'bg-zinc-800'}`}>
              <Settings2 size={12} /> {kelola ? 'Selesai kelola' : 'Kelola katalog'}
            </button>
          )}
          <button type="button" onClick={onTutup} className="text-zinc-400 hover:text-white p-1" aria-label="Tutup"><X size={18} /></button>
        </div>

        {/* Saringan */}
        <div className="p-3 border-b border-white/10 space-y-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari barang…" className="input-retro !pl-8 !py-1.5 !text-[13px]" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['', ...daftarKelompok].map((k) => (
              <button key={k || 'semua'} type="button" onClick={() => setKelompok(k)}
                className={`chip-retro !text-[11px] ${kelompok === k ? 'border-yellow-300 bg-yellow-500 text-black' : 'border-white/30 text-zinc-300'}`}>
                {k || 'Semua'}
              </button>
            ))}
          </div>
        </div>

        {/* Daftar barang */}
        <div className="flex-1 overflow-auto custom-scrollbar p-3 space-y-4 min-h-0">
          {memuat && <p className="text-center text-zinc-400 py-8"><Loader2 size={16} className="animate-spin inline mr-2" />Memuat katalog…</p>}
          {!memuat && daftarKelompok.filter((k) => !kelompok || k === kelompok).map((k) => {
            const isi = tampil.filter((b) => b.kelompok === k);
            if (!isi.length) return null;
            return (
              <section key={k}>
                <h4 className="text-[11px] font-title text-emerald-300 mb-1.5">{k.toUpperCase()} <span className="text-zinc-500 font-body">· lembar {lembar(isi[0].kategori)}</span></h4>
                <div className="grid gap-1.5">
                  {isi.map((b) => {
                    const dipilih = keranjang[b.id];
                    const sunting = suntingan[b.id];
                    if (kelola && bolehKelola) {
                      const s = sunting ?? b;
                      const ubah = (patch: Partial<BarangKatalog>) => setSuntingan((x) => ({ ...x, [b.id]: { ...s, ...patch } }));
                      return (
                        <div key={b.id} className="flex flex-wrap items-center gap-1.5 p-2 border-2 border-amber-500/50 bg-amber-950/20">
                          <input value={s.nama} onChange={(e) => ubah({ nama: e.target.value })} className="input-retro !py-1 !text-[12px] flex-1 min-w-[160px]" aria-label="Nama barang" />
                          <input value={s.satuan} onChange={(e) => ubah({ satuan: e.target.value })} className="input-retro !py-1 !text-[12px] !w-20" aria-label="Satuan" />
                          <input type="number" value={s.harga} onChange={(e) => ubah({ harga: Number(e.target.value) || 0 })} className="input-retro !py-1 !text-[12px] !w-28 font-mono" aria-label="Harga" />
                          <select value={s.kategori} onChange={(e) => ubah({ kategori: e.target.value })} className="input-retro !py-1 !text-[12px] !w-auto" aria-label="Lembar RAB">
                            {LEMBAR_RAB.map((l) => <option key={l.id} value={l.id}>{l.nama}</option>)}
                          </select>
                          <button type="button" disabled={!sunting} onClick={() => simpanSuntingan(s)} className="btn-ikon !w-7 !h-7 bg-emerald-700 disabled:opacity-30" aria-label="Simpan"><Save size={12} /></button>
                          <button type="button" onClick={() => hapus(b)} className="btn-ikon !w-7 !h-7 bg-rose-900" aria-label="Hapus dari katalog"><Trash2 size={12} /></button>
                        </div>
                      );
                    }
                    return (
                      <div key={b.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 p-2 border-2 ${dipilih ? 'border-yellow-400 bg-yellow-950/30' : 'border-white/15 bg-black/40'}`}>
                        <input type="checkbox" checked={Boolean(dipilih)} onChange={(e) => ubahQty(b, e.target.checked ? 1 : 0)} className="w-5 h-5 accent-yellow-500" aria-label={`Pilih ${b.nama}`} />
                        <div className="flex-1 min-w-[160px]">
                          <div className="text-[13px] text-white font-bold leading-tight">{b.nama}</div>
                          <div className="text-[11px] text-zinc-400">{formatRupiah(b.harga)} / {b.satuan}</div>
                        </div>
                        {dipilih && (
                          <select value={dipilih.mingguKe} onChange={(e) => ubahMinggu(b.id, Number(e.target.value))} className="input-retro !w-auto !py-1 !text-[11px]" aria-label="Minggu">
                            {MINGGU.map((m) => <option key={m} value={m}>Minggu {ROMAWI[m - 1]}</option>)}
                          </select>
                        )}
                        {kotakQty(dipilih?.qty ?? 0, (n) => ubahQty(b, n))}
                        <div className="w-28 text-right font-mono text-[12px] text-emerald-300">{dipilih ? formatRupiah(dipilih.qty * b.harga) : ''}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Barang manual */}
          <section className="border-2 border-dashed border-cyan-500/60 p-2.5 space-y-2">
            <h4 className="text-[11px] font-title text-cyan-300 flex items-center gap-1.5"><PackagePlus size={13} /> TAMBAH BARANG LAIN (TIDAK ADA DI KATALOG)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
              <input value={isian.namaBarang} onChange={(e) => setIsian({ ...isian, namaBarang: e.target.value })} placeholder="Nama barang" className="input-retro !py-1 !text-[12px] col-span-2" />
              <select value={isian.kategori} onChange={(e) => setIsian({ ...isian, kategori: e.target.value })} className="input-retro !py-1 !text-[12px]" aria-label="Lembar RAB">
                {LEMBAR_RAB.map((l) => <option key={l.id} value={l.id}>{l.nama}</option>)}
              </select>
              <input value={isian.satuan} onChange={(e) => setIsian({ ...isian, satuan: e.target.value })} placeholder="Satuan" className="input-retro !py-1 !text-[12px]" />
              <input type="number" value={isian.hargaSatuan} onChange={(e) => setIsian({ ...isian, hargaSatuan: e.target.value })} placeholder="Harga" className="input-retro !py-1 !text-[12px] font-mono" />
              <input type="number" min={1} value={isian.qty} onChange={(e) => setIsian({ ...isian, qty: e.target.value })} placeholder="Jumlah" className="input-retro !py-1 !text-[12px] font-mono" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {bolehKelola && (
                <label className="text-[11px] text-zinc-300 flex items-center gap-1.5">
                  <input type="checkbox" checked={isian.keKatalog} onChange={(e) => setIsian({ ...isian, keKatalog: e.target.checked })} className="accent-cyan-500" /> Simpan juga ke katalog
                </label>
              )}
              <button type="button" onClick={tambahManual} className="btn-retro btn-retro-sm bg-cyan-700 ml-auto"><Plus size={12} /> Tambah ke keranjang</button>
            </div>
            {manual.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-2 border-2 border-yellow-400 bg-yellow-950/30 text-[12px]">
                <span className="flex-1 min-w-[140px] text-white font-bold">{m.namaBarang} <span className="text-zinc-400 font-normal">· {lembar(m.kategori)} · Minggu {ROMAWI[m.mingguKe - 1]}</span></span>
                {kotakQty(m.qty, (n) => setManual((x) => (n <= 0 ? x.filter((y) => y.id !== m.id) : x.map((y) => (y.id === m.id ? { ...y, qty: n } : y)))))}
                <span className="w-28 text-right font-mono text-emerald-300">{formatRupiah(m.qty * m.hargaSatuan)}</span>
              </div>
            ))}
          </section>
        </div>

        {/* Kaki: total & masukkan */}
        <div className="border-t-2 border-white/20 p-3 flex flex-wrap items-center gap-2 bg-black/60">
          <div className="mr-auto">
            <div className="text-[11px] text-zinc-400">{pilihan.length} barang dipilih</div>
            <div className="text-[16px] font-bold text-emerald-300 font-mono">{formatRupiah(total)}</div>
          </div>
          <button type="button" onClick={onTutup} className="btn-retro bg-zinc-800">Batal</button>
          <button type="button" disabled={!pilihan.length} onClick={() => onMasukkan(pilihan)} className="btn-retro bg-amber-600 disabled:opacity-40">
            <ShoppingCart size={14} /> Masukkan ke RAB
          </button>
        </div>
      </div>
    </div>
  );
};
