import React, { useState } from 'react';
import { X, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import {
  eksporRabRnr, barisRekap, totalRab, totalUraian, totalMinggu, nilaiMinggu, deskripsiWbs, perluDirektur, tinggiBarisRab,
  PENYETUJU_DIV_HEAD, PENYETUJU_DIREKTUR, PENYETUJU_VERIFIKASI, PENYETUJU_PIMPINAN, LEBAR_KOLOM_TEKS, type RabRnr,
} from '../lib/rab-rnr';
import { DAFTAR_BULAN } from '../lib/rab-hcga';
import { eksporLembarPdf } from '../lib/pdf-laporan';
// Logo dari template Excel RAB (xl/media/image1.png).
import logoRab from '../aset/logo-rab-rnr.png';

/**
 * Pratinjau RAB RNR, meniru lembar rekap Excel (public/template-rab-rnr.xlsx):
 * kolom B–J dengan lebar yang sama, sel gabungan, garis tebal/tipis, kotak
 * persetujuan F–G dan H–I, format angka "Rp", tinggi baris uraian sama dengan
 * hasil ekspor (tinggiBarisRab). Export PDF memakai A4 mendatar
 * dan diperkecil agar muat satu halaman, sama seperti pengaturan cetak Excel.
 */

interface Props {
  rab: RabRnr;
  notify: (pesan: string) => void;
  onTutup: () => void;
}

// Lebar kolom Excel B–J (satuan lebar kolom) → piksel, sama dengan template.
const KOLOM = [4.54, LEBAR_KOLOM_TEKS.kode, LEBAR_KOLOM_TEKS.desk, LEBAR_KOLOM_TEKS.uraian, 18.82, 18.82, 18.82, 18.82, 18.9].map((w) => Math.round(w * 7));
const TINGGI = { biasa: 20, judul: 19, total: 32, blok13: 45 };
/** Poin Excel → piksel layar. */
const px = (pt: number) => Math.round((pt * 4) / 3);
const TEBAL = '2px solid #000';
const TIPIS = '1px solid #000';
const RAMBUT = '1px solid #9ca3af';

type Garis = Partial<Record<'kiri' | 'kanan' | 'atas' | 'bawah', string>>;
const garis = (g: Garis): React.CSSProperties => ({
  borderLeft: g.kiri, borderRight: g.kanan, borderTop: g.atas, borderBottom: g.bawah,
});

const tglPanjang = (iso: string) => (iso ? `${Number(iso.slice(8, 10))} ${DAFTAR_BULAN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}` : '');

/**
 * Format akuntansi Excel: "Rp" rata kiri, angka rata kanan, nol jadi "-".
 * `kosongBilaNol`: sel minggu uraian yang tidak diajukan dibiarkan kosong, seperti hasil ekspor.
 */
const Rupiah: React.FC<{ n: number; kosongBilaNol?: boolean }> = ({ n, kosongBilaNol }) => (n || !kosongBilaNol ? (
  <span className="flex justify-between gap-0.5 px-1 whitespace-nowrap">
    <span>Rp</span><span>{n ? n.toLocaleString('id-ID') : '-'}</span>
  </span>
) : null);

export const PratinjauRabRnr: React.FC<Props> = ({ rab, notify, onTutup }) => {
  const [sibuk, setSibuk] = useState<'excel' | 'pdf' | null>(null);
  const isi = barisRekap(rab).filter((u) => u.uraian.trim() && totalUraian(u) > 0);
  const direktur = perluDirektur(rab);
  const namaBerkas = `RAB RNR ${rab.bulan} ${rab.tahun} ${rab.nomorRab.replace(/\//g, '-')}`;
  const pemohon = { nama: rab.pemohonNama || 'Diisi DI form', jabatan: 'Diisi Di Form' };
  const verifikasi = { nama: rab.verifikasiNama || PENYETUJU_VERIFIKASI.nama, jabatan: rab.jabatanVerifikasi || PENYETUJU_VERIFIKASI.jabatan };
  const pimpinan = { nama: rab.pimpinanNama || PENYETUJU_PIMPINAN.nama, jabatan: rab.jabatanPimpinan || PENYETUJU_PIMPINAN.jabatan };
  const divHead = { nama: rab.penyetujuDivHead || PENYETUJU_DIV_HEAD.nama, jabatan: rab.jabatanDivHead || PENYETUJU_DIV_HEAD.jabatan };
  const dir = { nama: rab.penyetuju || PENYETUJU_DIREKTUR.nama, jabatan: rab.jabatanPenyetuju || PENYETUJU_DIREKTUR.jabatan };

  const excel = async () => {
    setSibuk('excel');
    try {
      const h = await eksporRabRnr(rab);
      notify(h === 'diunduh' ? 'EXCEL DIUNDUH' : 'EXCEL SIAP DIBAGIKAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT EXCEL'); } finally { setSibuk(null); }
  };
  const pdf = async () => {
    const dok = document.getElementById('dokumen-rab-rnr');
    if (!dok) return;
    setSibuk('pdf');
    try {
      const h = await eksporLembarPdf(dok, `${namaBerkas}.pdf`, rab.judul, { lanskap: true, satuHalaman: true });
      notify(h === 'diunduh' ? 'PDF DIUNDUH' : 'PDF SIAP DIBAGIKAN');
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT PDF'); } finally { setSibuk(null); }
  };

  const f10: React.CSSProperties = { fontFamily: 'Arial, sans-serif', fontSize: '10pt' };
  const kepala: React.CSSProperties = { fontFamily: 'Verdana, sans-serif', fontSize: '10pt', fontWeight: 700 };

  /**
   * Satu kotak persetujuan 1 kolom (judul, jabatan, ruang tanda tangan + nama, tanggal),
   * bergaris tipis kiri-kanan seperti template resmi.
   */
  const kotakSetuju = (header: string, jabatan: string, nama: string, adaTanggal = true) => {
    const sisi = { kiri: TIPIS, kanan: TIPIS };
    return {
      b10: <td className="text-center px-1" style={garis({ ...sisi, atas: TEBAL })}>{header}</td>,
      b11: <td className="text-center px-1 leading-tight text-[9pt]" style={garis(sisi)}>{jabatan}</td>,
      b12: <td rowSpan={3} className="text-center align-bottom px-1 pb-0.5 leading-tight text-[9pt] font-semibold" style={garis(sisi)}>{nama}</td>,
      b15: <td className="text-left px-1 text-[9pt]" style={garis({ ...sisi, atas: TIPIS, bawah: TEBAL })}>{adaTanggal ? 'Tanggal :' : ''}</td>,
    };
  };
  const k1 = kotakSetuju('Dibuat', pemohon.jabatan, pemohon.nama, false);
  const k2 = kotakSetuju('Diverifikasi', verifikasi.jabatan, verifikasi.nama, true);
  const k3 = kotakSetuju('Disetujui Oleh,', pimpinan.jabatan, pimpinan.nama, true);
  const k4 = kotakSetuju('Disetujui Oleh,', divHead.jabatan, divHead.nama, true);
  const k5 = kotakSetuju('Disetujui Oleh,', dir.jabatan, dir.nama, true);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 flex flex-col">
      <div className="flex flex-wrap items-center gap-2 p-2 bg-zinc-900 border-b-4 border-white shrink-0">
        <span className="font-title text-[12px] text-yellow-300 mr-auto">PRATINJAU RAB · {rab.nomorRab}</span>
        <button type="button" onClick={excel} disabled={sibuk !== null} className="btn-retro bg-emerald-700 !py-1.5 text-[12px] disabled:opacity-50">
          {sibuk === 'excel' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Export Excel
        </button>
        <button type="button" onClick={pdf} disabled={sibuk !== null} className="btn-retro bg-rose-700 !py-1.5 text-[12px] disabled:opacity-50">
          {sibuk === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} Export PDF
        </button>
        <button type="button" onClick={onTutup} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup pratinjau"><X size={16} /></button>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar p-3">
        <div className="mx-auto w-fit bg-white shadow-2xl p-4">
          <div id="dokumen-rab-rnr" className="bg-white text-black" style={{ width: KOLOM.reduce((a, b) => a + b, 0) }}>
            <section data-halaman="1">
              <table className="border-collapse table-fixed" style={{ ...f10, width: KOLOM.reduce((a, b) => a + b, 0) }}>
                <colgroup>{KOLOM.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
                <tbody>
                  {/* Baris 2–5: logo + judul */}
                  <tr style={{ height: TINGGI.judul }}>
                    <td colSpan={2} rowSpan={3} className="text-center align-bottom" style={garis({ kiri: TEBAL, atas: TEBAL })}>
                      <img src={logoRab} alt="Hasnur Group" className="inline-block" style={{ height: 52 }} />
                    </td>
                    <td colSpan={6} rowSpan={4} className="text-center align-middle whitespace-pre-line" style={{ ...garis({ kiri: TEBAL, atas: TEBAL, bawah: TEBAL }), fontSize: '15pt', fontWeight: 700 }}>
                      {'PT ENERGI BATUBARA LESTARI\nRENCANA ANGGARAN BULANAN (RAB)\nDepartemen RNR'}
                    </td>
                    <td rowSpan={4} style={garis({ kanan: TEBAL, atas: TEBAL, bawah: TEBAL })} />
                  </tr>
                  <tr style={{ height: TINGGI.judul }} />
                  <tr style={{ height: TINGGI.judul }} />
                  <tr style={{ height: TINGGI.biasa }}>
                    <td colSpan={2} className="text-center" style={{ ...garis({ kiri: TEBAL, bawah: TEBAL }), fontSize: '8pt', fontWeight: 700 }}>Hasnur Group</td>
                  </tr>
                  <tr style={{ height: TINGGI.biasa }}><td colSpan={9} /></tr>

                  {/* Baris 7–8: lokasi, periode, halaman */}
                  <tr style={{ height: TINGGI.biasa }}>
                    <td colSpan={3} rowSpan={2} className="px-1" style={garis({ kiri: TEBAL, kanan: RAMBUT, atas: TEBAL, bawah: TEBAL })}>Lokasi</td>
                    <td colSpan={2} rowSpan={2} className="px-1" style={garis({ kanan: TIPIS, atas: TEBAL, bawah: TEBAL })}>: {rab.lokasi}</td>
                    <td colSpan={3} className="text-center" style={garis({ atas: TEBAL, bawah: RAMBUT })}>Periode</td>
                    <td rowSpan={2} className="px-1" style={garis({ kiri: TIPIS, kanan: TEBAL, atas: TEBAL, bawah: TEBAL })}>Halaman :&nbsp;&nbsp;1/1</td>
                  </tr>
                  <tr style={{ height: TINGGI.biasa }}>
                    <td colSpan={3} className="text-center whitespace-nowrap" style={{ ...garis({ kanan: TIPIS, bawah: TEBAL }), color: '#ff0000' }}>
                      Bulan : {rab.bulan}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Tahun : {rab.tahun}
                    </td>
                  </tr>
                  <tr style={{ height: TINGGI.biasa }}><td colSpan={9} /></tr>

                  {/* Baris 10–15: identitas + 4 atau 5 kotak persetujuan */}
                  <tr style={{ height: TINGGI.biasa }}>
                    <td colSpan={2} className="px-1" style={garis({ kiri: TEBAL, atas: TEBAL })}>Kepada</td>
                    <td className="px-1" style={garis({ kiri: RAMBUT, atas: TEBAL, bawah: RAMBUT })}>{rab.kepada}</td>
                    <td style={garis({ atas: TEBAL })} />
                    {k1.b10}{k2.b10}{k3.b10}{k4.b10}
                    {direktur ? k5.b10 : <td style={garis({ kanan: TEBAL, atas: TEBAL })} />}
                  </tr>
                  <tr style={{ height: TINGGI.biasa }}>
                    <td colSpan={2} className="px-1" style={garis({ kiri: TEBAL })}>Up.</td>
                    <td className="px-1" style={garis({ kiri: RAMBUT, bawah: RAMBUT })}>{rab.up}</td>
                    <td />
                    {k1.b11}{k2.b11}{k3.b11}{k4.b11}
                    {direktur ? k5.b11 : <td style={garis({ kanan: TEBAL })} />}
                  </tr>
                  <tr style={{ height: TINGGI.biasa }}>
                    <td colSpan={2} className="px-1" style={garis({ kiri: TEBAL, atas: TIPIS })}>No. RAB</td>
                    <td rowSpan={2} className="px-1 align-middle" style={{ ...garis({ kiri: RAMBUT, atas: TIPIS, bawah: RAMBUT }), fontSize: '9pt' }}>{rab.nomorRab}</td>
                    <td rowSpan={3} />
                    {k1.b12}{k2.b12}{k3.b12}{k4.b12}
                    {direktur ? k5.b12 : <td rowSpan={3} style={garis({ kanan: TEBAL })} />}
                  </tr>
                  <tr style={{ height: TINGGI.blok13 }}>
                    <td colSpan={2} style={garis({ kiri: TEBAL })} />
                  </tr>
                  <tr style={{ height: TINGGI.biasa }}>
                    <td colSpan={2} className="px-1" style={garis({ kiri: TEBAL })}>Tanggal</td>
                    <td className="px-1" style={garis({ kiri: RAMBUT, atas: RAMBUT, bawah: RAMBUT })}>{tglPanjang(rab.tanggal)}</td>
                  </tr>
                  <tr style={{ height: TINGGI.biasa }}>
                    <td colSpan={2} style={garis({ kiri: TEBAL, bawah: TEBAL })} />
                    <td style={garis({ kiri: RAMBUT, atas: RAMBUT, bawah: TEBAL })} />
                    <td style={garis({ bawah: TEBAL })} />
                    {k1.b15}{k2.b15}{k3.b15}{k4.b15}
                    {direktur ? k5.b15 : <td style={garis({ kanan: TEBAL, bawah: TEBAL })} />}
                  </tr>
                  <tr style={{ height: TINGGI.biasa }}><td colSpan={9} /></tr>

                  {/* Baris 17–18: judul tabel */}
                  <tr style={{ height: TINGGI.biasa }}>
                    {['NO.', 'Kode WBS / Cost Center', 'Desc. WBS', 'Uraian', 'Minggu I', 'Minggu II', 'Minggu III', 'Minggu IV', 'Total'].map((h, i) => (
                      <td key={h} rowSpan={2} className="text-center align-middle px-1 leading-tight"
                        style={{ ...kepala, ...garis({ kiri: i === 0 ? TEBAL : TIPIS, kanan: i === 8 ? TEBAL : TIPIS, atas: TEBAL, bawah: i >= 4 && i <= 7 ? TEBAL : TIPIS }) }}>{h}</td>
                    ))}
                  </tr>
                  <tr style={{ height: TINGGI.biasa }} />

                  {/* Baris uraian */}
                  {isi.map((u, i) => {
                    const atas = i === 0 ? TEBAL : RAMBUT;
                    return (
                      <tr key={u.id} style={{ height: px(tinggiBarisRab(u)) }}>
                        <td className="text-center" style={garis({ kiri: TEBAL, kanan: TIPIS, atas, bawah: RAMBUT })}>{i + 1}</td>
                        <td className="px-1 leading-tight" style={garis({ kiri: TIPIS, kanan: TIPIS, atas, bawah: RAMBUT })}>{u.wbs}</td>
                        <td className="px-1 leading-tight" style={garis({ atas, bawah: RAMBUT })}>{deskripsiWbs(u.wbs)}</td>
                        <td className="px-1 leading-tight" style={garis({ kiri: TIPIS, kanan: TIPIS, atas, bawah: RAMBUT })}>{u.uraian}</td>
                        {[0, 1, 2, 3].map((m) => (
                          <td key={m} style={garis({ kiri: TIPIS, kanan: TIPIS, atas, bawah: RAMBUT })}><Rupiah n={nilaiMinggu(u, m)} kosongBilaNol /></td>
                        ))}
                        <td style={{ ...garis({ kiri: TIPIS, kanan: TEBAL, atas, bawah: RAMBUT }), fontWeight: 700 }}><Rupiah n={totalUraian(u)} /></td>
                      </tr>
                    );
                  })}

                  {/* Baris total (2 baris digabung) */}
                  <tr style={{ height: TINGGI.total }}>
                    <td colSpan={4} rowSpan={2} className="text-center align-middle" style={{ ...kepala, ...garis({ kiri: TEBAL, kanan: TIPIS, atas: TEBAL, bawah: TEBAL }) }}>Total</td>
                    {[0, 1, 2, 3].map((m) => (
                      <td key={m} rowSpan={2} className="align-middle" style={{ ...kepala, fontStyle: 'italic', ...garis({ kiri: TIPIS, kanan: TIPIS, atas: TEBAL, bawah: TEBAL }) }}><Rupiah n={totalMinggu(rab, m)} /></td>
                    ))}
                    <td rowSpan={2} className="align-middle" style={{ ...kepala, fontStyle: 'italic', ...garis({ kiri: TIPIS, kanan: TEBAL, atas: TEBAL, bawah: TEBAL }) }}><Rupiah n={totalRab(rab)} /></td>
                  </tr>
                  <tr style={{ height: TINGGI.total }} />
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
