import React, { useRef, useState } from 'react';
import { FileUp, Loader2, Save, X } from 'lucide-react';
import { simpanBarangKatalog, type BarangKatalog } from '../lib/katalog-rab';
import { bacaBerkasImpor, usulanKatalog, statusUsulan, dataSimpan, type UsulanKatalog, type StatusUsulan } from '../lib/impor-katalog';
import { formatRupiah } from '../lib/rab-hcga';
import { PilihKategori, PilihWbs } from './PapanRabRnr';

/**
 * Impor katalog dari Excel pengajuan (Admin/Supervisor): pilih berkas → pratinjau
 * barang baru / berubah / sama → simpan yang dicentang. Harga dari berkas
 * menggantikan harga katalog; tiap kolom masih bisa dibetulkan sebelum disimpan.
 */

interface Props {
  katalog: BarangKatalog[];
  notify: (pesan: string) => void;
  onTutup: () => void;
  /** Dipanggil setelah katalog berubah supaya daftar dimuat ulang. */
  onSelesai: () => void;
}

const kelas = 'input-retro !py-1 !text-[12px]';
const LABEL: Record<StatusUsulan, [string, string]> = {
  baru: ['Baru', 'border-cyan-400 text-cyan-200'],
  berubah: ['Berubah', 'border-amber-400 text-amber-200'],
  sama: ['Sudah sama', 'border-white/30 text-zinc-400'],
};

export const ImporKatalog: React.FC<Props> = ({ katalog, notify, onTutup, onSelesai }) => {
  const berkas = useRef<HTMLInputElement>(null);
  const [namaBerkas, setNamaBerkas] = useState('');
  const [usulan, setUsulan] = useState<UsulanKatalog[] | null>(null);
  const [sibuk, setSibuk] = useState<'baca' | 'simpan' | null>(null);
  const [kemajuan, setKemajuan] = useState(0);

  const baca = async (f: File | undefined) => {
    if (!f) return;
    setSibuk('baca');
    setNamaBerkas(f.name);
    try {
      const baris = await bacaBerkasImpor(await f.arrayBuffer());
      if (!baris.length) {
        notify('TIDAK ADA BARANG DI BERKAS · CEK KOLOM URAIAN / NAMA BARANG');
        setUsulan(null);
      } else setUsulan(usulanKatalog(baris, katalog));
    } catch (e) {
      notify(e instanceof Error ? `GAGAL MEMBACA EXCEL: ${e.message}`.toUpperCase() : 'GAGAL MEMBACA EXCEL');
    } finally {
      setSibuk(null);
    }
  };

  const ubah = (i: number, patch: Partial<UsulanKatalog>) =>
    setUsulan((d) => d && d.map((u, j) => (j === i ? { ...u, ...patch } : u)));

  const dipilih = (usulan ?? []).filter((u) => u.pilih);
  const hitung = (s: StatusUsulan) => (usulan ?? []).filter((u) => statusUsulan(u) === s).length;

  const simpan = async () => {
    setSibuk('simpan');
    setKemajuan(0);
    let n = 0;
    try {
      for (const u of dipilih) {
        await simpanBarangKatalog(dataSimpan(u, n));
        setKemajuan(++n);
      }
      notify(`${n} BARANG KATALOG DISIMPAN`);
      onSelesai();
      onTutup();
    } catch (e) {
      notify(`${n} TERSIMPAN · ${e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENYIMPAN'}`);
      if (n) onSelesai();
    } finally {
      setSibuk(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col">
      <div className="flex flex-wrap items-center gap-2 p-2 bg-zinc-900 border-b-4 border-white shrink-0">
        <span className="font-title text-[12px] text-yellow-300 mr-auto">IMPOR KATALOG DARI EXCEL</span>
        <button type="button" onClick={() => berkas.current?.click()} disabled={sibuk !== null} className="btn-retro bg-zinc-700 !py-1.5 text-[12px] disabled:opacity-50">
          {sibuk === 'baca' ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />} {usulan ? 'Ganti berkas' : 'Pilih berkas'}
        </button>
        {usulan && (
          <button type="button" onClick={simpan} disabled={sibuk !== null || !dipilih.length} className="btn-retro bg-emerald-700 !py-1.5 text-[12px] disabled:opacity-50">
            {sibuk === 'simpan' ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {sibuk === 'simpan' ? `Menyimpan ${kemajuan}/${dipilih.length}` : `Simpan ke katalog (${dipilih.length})`}
          </button>
        )}
        <button type="button" onClick={onTutup} disabled={sibuk === 'simpan'} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup impor"><X size={16} /></button>
        <input ref={berkas} type="file" accept=".xlsx" className="hidden" onChange={(e) => { void baca(e.target.files?.[0]); e.target.value = ''; }} />
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-3 space-y-2">
        {!usulan ? (
          <div className="max-w-xl mx-auto border-2 border-white/25 bg-black/60 p-4 space-y-2 text-[12px] text-zinc-300">
            <p>Pilih Excel pengajuan RAB (mis. hasil ekspor RAB RNR yang sudah diajukan). Barangnya dicocokkan dengan katalog berdasarkan nama:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b className="text-cyan-200">Baru</b> — belum ada di katalog, ditambahkan.</li>
              <li><b className="text-amber-200">Berubah</b> — harga/satuan/WBS/kategori di berkas berbeda; katalog diperbarui mengikuti berkas.</li>
              <li><b className="text-zinc-300">Sudah sama</b> — tidak perlu disimpan.</li>
            </ul>
            <p className="text-zinc-400">Rekap RAB RNR hanya berisi nilai (qty × harga). Bila nilainya kelipatan pas harga katalog, harga tetap dan selisihnya dianggap qty; selain itu harga diganti nilai di berkas. Semua bisa dibetulkan di pratinjau sebelum disimpan. Barang katalog tidak pernah dihapus.</p>
            <p className="text-zinc-400">Dikenali juga: lembar rincian per kategori (Nama Barang/Jasa · Qty · Satuan · Harga Satuan; kategori dari nama lembar) dan Form RAB (Kegiatan · Banyak · Estimasi Harga · WBS).</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-zinc-300 mr-auto">{namaBerkas} · {usulan.length} barang</span>
              <span className={`chip-retro !text-[11px] ${LABEL.baru[1]}`}>{hitung('baru')} baru</span>
              <span className={`chip-retro !text-[11px] ${LABEL.berubah[1]}`}>{hitung('berubah')} berubah</span>
              <span className={`chip-retro !text-[11px] ${LABEL.sama[1]}`}>{hitung('sama')} sudah sama</span>
            </div>
            <div className="border-2 border-white/30 bg-black/60 overflow-x-auto">
              <table className="w-full min-w-[1100px] text-[12px] border-collapse">
                <thead className="bg-[#2f5d33] text-white text-[10px] uppercase">
                  <tr>
                    <th className="p-1.5 w-8">
                      <input type="checkbox" aria-label="Pilih semua" checked={dipilih.length === usulan.length}
                        onChange={(e) => setUsulan(usulan.map((u) => ({ ...u, pilih: e.target.checked })))} />
                    </th>
                    <th className="p-1.5 text-left">Nama barang</th>
                    <th className="p-1.5 w-20">Satuan</th>
                    <th className="p-1.5 w-40">Harga satuan</th>
                    <th className="p-1.5 text-left w-56">Kode WBS</th>
                    <th className="p-1.5 text-left w-36">Kategori</th>
                    <th className="p-1.5 text-left w-48">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {usulan.map((u, i) => {
                    const s = statusUsulan(u);
                    const l = u.lama;
                    return (
                      <tr key={u.kunci} className={`border-t border-white/10 align-top ${u.pilih ? '' : 'opacity-60'}`}>
                        <td className="p-1.5 text-center"><input type="checkbox" checked={u.pilih} onChange={(e) => ubah(i, { pilih: e.target.checked })} aria-label={`Pilih ${u.nama}`} /></td>
                        <td className="p-1"><input value={u.nama} onChange={(e) => ubah(i, { nama: e.target.value })} className={kelas} /></td>
                        <td className="p-1"><input value={u.satuan} onChange={(e) => ubah(i, { satuan: e.target.value })} className={kelas} /></td>
                        <td className="p-1">
                          <input inputMode="numeric" value={u.harga || ''} onChange={(e) => ubah(i, { harga: Number(e.target.value.replace(/\D/g, '')) || 0 })} className={`${kelas} font-mono text-right`} />
                          {l && l.harga !== u.harga && <div className="text-[10px] text-amber-300 font-mono pt-0.5">sebelumnya {formatRupiah(l.harga)}</div>}
                        </td>
                        <td className="p-1"><PilihWbs nilai={u.wbs} ubah={(v) => ubah(i, { wbs: v })} /></td>
                        <td className="p-1"><PilihKategori nilai={u.kategori} ubah={(v) => ubah(i, { kategori: v })} /></td>
                        <td className="p-1.5">
                          <span className={`chip-retro !text-[10px] ${LABEL[s][1]}`}>{LABEL[s][0]}</span>
                          {u.catatan && <div className="text-[10px] text-zinc-400 pt-0.5">{u.catatan}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
