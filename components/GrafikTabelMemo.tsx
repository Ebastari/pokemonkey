/**
 * Grafik yang tersambung ke tabel memo (blok `!tabel{…,"grafik":{…}}`).
 *
 * Hitungan dan gambarnya berasal dari server/src/grafik-tabel.ts — sumber yang sama
 * dengan halaman bagikan dan gambar unduhan, jadi tampilannya sama persis di mana pun.
 * Komponen ini hanya menambah kepala (judul, pilihan tipe) dan panel setelan.
 *
 * Dua cara mengolah data:
 * - 'hitung' (rekap jumlah): menghitung baris per kategori, mis. jumlah PICA per status
 *   atau per PIC dirinci per status → kotak angka + batang mendatar / donat;
 * - 'nilai': angka di sel apa adanya (tracker kumulatif, luas, biaya) → batang tegak / garis.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, ExternalLink, LineChart, PieChart, Settings2, Trash2, TrendingUp } from 'lucide-react';
import type { OpsiGrafikTabel } from '../server/src/memo-blok';
import { hitungGrafikTabel, htmlIsiGrafikTabel, kontras, labelStatus, statusBaku } from '../server/src/grafik-tabel';

interface Props {
  baris: string[][];
  kepala: boolean;
  grafik: OpsiGrafikTabel;
  /** Tabel bersumber data PICA: label status mengikuti layar PICA, satuan "PICA". */
  pica?: boolean;
  bolehUbah?: boolean;
  onUbah?: (baru: OpsiGrafikTabel | undefined) => void;
}

const TIPE: { id: OpsiGrafikTabel['tipe']; label: string; ikon: typeof BarChart3 }[] = [
  { id: 'progres', label: 'Progres', ikon: TrendingUp },
  { id: 'batang', label: 'Batang', ikon: BarChart3 },
  { id: 'pie', label: 'Donat', ikon: PieChart },
  { id: 'garis', label: 'Garis', ikon: LineChart },
];

export const GrafikTabelMemo: React.FC<Props> = ({ baris, kepala, grafik, pica = false, bolehUbah = false, onUbah }) => {
  const [bukaSetelan, setBukaSetelan] = useState(false);
  // Mode baca: tipe bisa diganti untuk dilihat saja (tidak disimpan).
  const [tipeLokal, setTipeLokal] = useState(grafik.tipe);
  useEffect(() => { setTipeLokal(grafik.tipe); }, [grafik.tipe]);

  const opsi = useMemo(() => ({ ...grafik, tipe: tipeLokal }), [grafik, tipeLokal]);
  const d = useMemo(() => hitungGrafikTabel(baris, kepala, opsi, pica), [baris, kepala, opsi, pica]);
  const html = useMemo(() => (d ? htmlIsiGrafikTabel(d) : ''), [d]);
  if (!d) return null;

  const ubah = (baru: Partial<OpsiGrafikTabel>) => onUbah?.({ ...grafik, ...baru });
  const gantiTipe = (tipe: OpsiGrafikTabel['tipe']) => { setTipeLokal(tipe); if (bolehUbah) ubah({ tipe }); };
  // Garis menyambung titik-titik berurutan; untuk kategori (status, nama PIC) garis menyesatkan.
  // Progres harian butuh kolom status/ceklis (satu baris = satu hari).
  const tipeBoleh = TIPE.filter((t) => (t.id !== 'garis' || d.mode === 'nilai') && (t.id !== 'progres' || d.idxStatus !== -1));
  // Warna dari variabel tema (index.css): kartu ikut mode gelap/terang, tidak kontras dengan latar.
  const pilih = 'border-2 border-[color:var(--gk-garis)] bg-[var(--gk-kartu)] text-[color:var(--gk-teks)] text-[12px] px-1.5 py-1 max-w-full';
  const tombolPreset = 'px-2 py-1 border-2 border-[color:var(--gk-garis)] bg-[var(--gk-kartu)] text-[color:var(--gk-teks)] text-[12px] font-bold hover:border-amber-400 shadow-[2px_2px_0_var(--gk-bayang)]';
  const label = 'font-bold text-[color:var(--gk-pudar)]';

  return (
    <div className="my-3 bg-[var(--gk-kartu)] border-2 border-[color:var(--gk-bingkai)] shadow-[4px_4px_0_var(--gk-bayang)] p-3 sm:p-4 text-[color:var(--gk-teks)] select-none" contentEditable={false}>
      {/* Kepala: judul + ket, lalu pilihan tipe & setelan */}
      <div className="flex flex-wrap items-start justify-between gap-2 pb-2 mb-3 border-b-2 border-[color:var(--gk-bingkai)]">
        <div className="min-w-0">
          <p className="font-title text-[11px] sm:text-[12px] leading-relaxed uppercase text-[color:var(--gk-teks)] break-words">{d.judul}</p>
          <p className="text-[12px] font-bold text-[color:var(--gk-pudar)] mt-0.5">{d.ket}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" data-sunting>
          <div className="flex border-2 border-[color:var(--gk-garis)] bg-[var(--gk-kotak)]">
            {tipeBoleh.map(({ id, label, ikon: Ikon }) => (
              <button
                key={id}
                type="button"
                onClick={() => gantiTipe(id)}
                className={`flex items-center gap-1 px-2 py-1 text-[12px] font-bold ${d.tipe === id ? 'bg-emerald-700 text-white' : 'text-[color:var(--gk-pudar)] hover:text-[color:var(--gk-teks)]'}`}
                title={`Tampilkan sebagai grafik ${label.toLowerCase()}`}
                aria-pressed={d.tipe === id}
              >
                <Ikon size={14} /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          {bolehUbah && (
            <>
              <button type="button" onClick={() => setBukaSetelan((v) => !v)} className={`p-1.5 border-2 border-[color:var(--gk-garis)] ${bukaSetelan ? 'bg-amber-400 !text-black' : 'bg-[var(--gk-kotak)] text-[color:var(--gk-teks)] hover:border-amber-400'}`} title="Atur data grafik" aria-label="Atur data grafik" aria-expanded={bukaSetelan}>
                <Settings2 size={14} />
              </button>
              <button type="button" onClick={() => onUbah?.(undefined)} className="p-1.5 border-2 border-[color:var(--gk-garis)] bg-[var(--gk-kotak)] hover:border-red-500 text-red-500" title="Hapus grafik (tabel tetap ada)" aria-label="Hapus grafik">
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Setelan: cara mengolah data, kategori, rincian, kolom angka */}
      {bukaSetelan && bolehUbah && (
        <div className="mb-4 p-3 bg-[var(--gk-kotak)] border-2 border-[color:var(--gk-garis)] text-[12px] space-y-3" data-sunting>
          <div className="flex flex-wrap items-center gap-2">
            <span className={label}>Olah data:</span>
            {([['hitung', 'Hitung jumlah baris'], ['nilai', 'Pakai angka di sel']] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => ubah({ mode: m })} className={`px-2 py-1 border-2 border-[color:var(--gk-garis)] font-bold ${d.mode === m ? 'bg-emerald-700 text-white' : 'bg-[var(--gk-kartu)] text-[color:var(--gk-teks)] hover:border-amber-400'}`}>
                {label}
              </button>
            ))}
          </div>

          {d.tipe === 'progres' && (
            <label className="flex flex-wrap items-center gap-2">
              <span className={label}>Tanggal mulai (bila tabel tanpa kolom Tanggal):</span>
              <input type="date" value={grafik.mulai ?? ''} onChange={(e) => ubah({ mulai: e.target.value || undefined })} className={pilih} />
            </label>
          )}
          {d.tipe === 'progres' ? null : d.mode === 'hitung' ? (
            <>
              {(d.idxStatus !== -1 || d.idxPic !== -1) && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={label}>Cepat:</span>
                  {d.idxStatus !== -1 && (
                    <button type="button" className={tombolPreset} onClick={() => ubah({ mode: 'hitung', sumbuX: d.idxStatus, kolomPecah: -1, judul: undefined })}>
                      Jumlah per {d.kolom[d.idxStatus]}
                    </button>
                  )}
                  {d.idxStatus !== -1 && d.idxPic !== -1 && (
                    <button type="button" className={tombolPreset} onClick={() => ubah({ mode: 'hitung', sumbuX: d.idxPic, kolomPecah: d.idxStatus, tipe: 'batang', judul: undefined })}>
                      Per {d.kolom[d.idxPic]}, dirinci {d.kolom[d.idxStatus]}
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className={label}>Kelompokkan menurut</span>
                  <select value={d.colX} onChange={(e) => ubah({ sumbuX: Number(e.target.value), judul: undefined })} className={pilih}>
                    {d.kolom.map((k, j) => <option key={j} value={j}>{k}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={label}>Rinci per (warna potongan)</span>
                  <select value={d.colPecah} onChange={(e) => ubah({ kolomPecah: Number(e.target.value), judul: undefined })} className={pilih}>
                    <option value={-1}>— Tanpa rincian —</option>
                    {d.kolom.map((k, j) => (j === d.colX ? null : <option key={j} value={j}>{k}</option>))}
                  </select>
                </label>
              </div>
            </>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className={label}>Label tiap batang/titik</span>
                <select value={d.colX} onChange={(e) => ubah({ sumbuX: Number(e.target.value) })} className={pilih}>
                  {d.kolom.map((k, j) => <option key={j} value={j}>{k}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className={label}>Kolom angka:</span>
                {d.kolom.map((k, j) => {
                  if (j === d.colX) return null;
                  const aktif = d.seriY.includes(j);
                  return (
                    <label key={j} className={`inline-flex items-center gap-1 px-2 py-1 border-2 border-[color:var(--gk-garis)] cursor-pointer font-bold ${aktif ? 'bg-emerald-700 text-white' : 'bg-[var(--gk-kartu)] text-[color:var(--gk-pudar)]'}`}>
                      <input
                        type="checkbox"
                        checked={aktif}
                        onChange={() => {
                          const baru = aktif ? d.seriY.filter((x) => x !== j) : [...d.seriY, j];
                          ubah({ seriY: baru.length ? baru : [j] });
                        }}
                        className="accent-emerald-700"
                      />
                      {k}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Gambar grafik: HTML yang sama dengan halaman bagikan & gambar unduhan. */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

/**
 * Lencana status di sel tabel: warna sama dengan grafik & layar PICA, terbaca di
 * tema gelap maupun terang.
 * - Tabel PICA: label baku; klik = buka PICA itu di menu PICA. Status PICA hanya
 *   bisa diubah/ditutup di sana (oleh siapa pun), tidak dari memo.
 * - Tabel biasa: klik = selesai/belum.
 */
export const LencanaStatus: React.FC<{ teks: string; pica?: boolean; onKlik?: () => void; nanti?: boolean }> = ({ teks, pica = false, onKlik, nanti = false }) => {
  // Habit: hari yang belum tiba belum bisa dicentang.
  if (nanti) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 border-2 text-[12px] font-bold whitespace-nowrap" style={{ background: 'transparent', color: 'var(--gk-pudar)', borderColor: 'var(--gk-pudar)', borderStyle: 'dashed' }} title="Harinya belum tiba — bisa dicentang saat hari itu">
        Belum waktunya
      </span>
    );
  }
  const st = statusBaku(teks);
  const warna = st?.warna ?? '#64748b';
  const label = pica && st ? st.label : labelStatus(teks) || (st ? st.label : 'Belum');
  const gaya = { background: warna, color: kontras(warna), borderColor: '#0f172a' };
  const kelas = 'inline-flex items-center px-2 py-0.5 border-2 text-[12px] font-bold whitespace-nowrap shadow-[2px_2px_0_#0f172a]';
  if (!onKlik) {
    return <span style={gaya} className={kelas} title={pica ? 'Status dari data PICA — ubah lewat menu PICA' : undefined}>{label}</span>;
  }
  if (pica) {
    return (
      <button type="button" onClick={onKlik} style={gaya} className={`${kelas} gap-1 hover:brightness-110`} title="Buka PICA ini di menu PICA — status hanya bisa diubah atau ditutup di sana">
        {label} <ExternalLink size={11} aria-hidden="true" />
      </button>
    );
  }
  return (
    <button type="button" onClick={onKlik} style={gaya} className={`${kelas} hover:brightness-110`} title="Klik untuk menandai selesai / belum (grafik ikut berubah)">
      {label}
    </button>
  );
};

/**
 * Ringkasan progres di atas tabel berstatus/ceklis (Total · Selesai · Sisa · Progres).
 * Ikut tema seperti grafik; warna Selesai/Sisa sama dengan lencana status.
 */
export const RingkasanProgres: React.FC<{ total: number; selesai: number; sisa: number; persen: number }> = ({ total, selesai, sisa, persen }) => {
  const chip = 'px-2 py-0.5 border-2 border-[color:var(--gk-garis)] whitespace-nowrap';
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 mb-2 bg-[var(--gk-kartu)] border-2 border-[color:var(--gk-bingkai)] text-[12px] font-bold text-[color:var(--gk-teks)]">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`${chip} bg-[var(--gk-kotak)]`}>Total: {total}</span>
        <span className={chip} style={{ background: '#059669', color: '#ffffff' }}>Selesai: {selesai}</span>
        <span className={chip} style={{ background: '#f59e0b', color: '#0f172a' }}>Sisa: {sisa}</span>
        <span className={`${chip} bg-[var(--gk-kotak)]`}>Progres: {persen}%</span>
      </div>
      <div className="w-28 sm:w-40 h-3.5 bg-[var(--gk-kotak)] border-2 border-[color:var(--gk-garis)]" role="progressbar" aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100} aria-label="Progres selesai">
        <div className="h-full" style={{ width: `${persen}%`, background: '#059669' }} />
      </div>
    </div>
  );
};
