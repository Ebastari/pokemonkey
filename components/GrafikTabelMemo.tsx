/**
 * Komponen Grafik Dinamis Terkoneksi pada Tabel (Live-Linked Chart).
 *
 * Menggambar visualisasi SVG interaktif (Batang, Garis, Pie/Donat) yang
 * bersumber langsung dari tabel memo. Setiap kali isi tabel diubah,
 * grafik otomatis memperbarui tampilannya secara real-time.
 */

import React, { useMemo, useState } from 'react';
import { BarChart3, LineChart, PieChart, Settings2, Trash2, X } from 'lucide-react';
import type { OpsiGrafikTabel } from '../server/src/memo-blok';

interface Props {
  baris: string[][];
  kepala: boolean;
  grafik: OpsiGrafikTabel;
  bolehUbah?: boolean;
  onUbah?: (baru: OpsiGrafikTabel | undefined) => void;
}

const WARNA_PALET = [
  '#84cc16', // lime-500
  '#06b6d4', // cyan-500
  '#f59e0b', // amber-500
  '#ec4899', // pink-500
  '#8b5cf6', // purple-500
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f97316', // orange-500
];

/** Ekstrak nilai angka dari sel teks (tangani tanda koma/titik Indonesia, persen, satuan) */
export function ekstrakAngka(teks: string): number | null {
  if (!teks || !teks.trim()) return null;
  let s = teks.trim();

  // Buang satuan umum: ha, bibit, batang, pohon, kg, ton, %, dll
  s = s.replace(/(?:ha|hektar|bibit|btg|batang|pohon|kg|ton|rp|usd|%)\b/gi, '').trim();

  // Jika format angka Indonesia dengan titik ribuan dan koma desimal: 1.250,50 -> 1250.50
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+(,\d+)$/.test(s)) {
    // 12,5 -> 12.5
    s = s.replace(',', '.');
  } else {
    // Format standar atau buang koma ribuan: 1,250.50 -> 1250.50
    s = s.replace(/,/g, '');
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export const GrafikTabelMemo: React.FC<Props> = ({
  baris,
  kepala,
  grafik,
  bolehUbah = false,
  onUbah,
}) => {
  const [bukaSetelan, setBukaSetelan] = useState(false);
  const [sorot, setSorot] = useState<{ label: string; seri: string; nilai: number } | null>(null);

  // Ambil nama kolom header
  const daftarKolom = useMemo(() => {
    if (baris.length === 0) return [];
    const jmlKolom = baris[0].length;
    return Array.from({ length: jmlKolom }, (_, j) => {
      if (kepala && baris[0][j]?.trim()) return baris[0][j].trim();
      return `Kolom ${j + 1}`;
    });
  }, [baris, kepala]);

  // Data baris data (tanpa header jika kepala === true)
  const dataBaris = useMemo(() => (kepala ? baris.slice(1) : baris), [baris, kepala]);

  // Deteksi kolom angka otomatis
  const kolomAngkaOtomatis = useMemo(() => {
    const hasil: number[] = [];
    if (daftarKolom.length <= 1) return [0];

    for (let j = 1; j < daftarKolom.length; j++) {
      let adaAngka = false;
      for (const r of dataBaris) {
        if (ekstrakAngka(r[j] ?? '') !== null) {
          adaAngka = true;
          break;
        }
      }
      if (adaAngka) hasil.push(j);
    }
    return hasil.length > 0 ? hasil : [Math.min(1, daftarKolom.length - 1)];
  }, [daftarKolom, dataBaris]);

  const idxX = grafik.sumbuX !== undefined && grafik.sumbuX < daftarKolom.length ? grafik.sumbuX : 0;
  const seriY = useMemo(() => {
    if (grafik.seriY && grafik.seriY.length > 0) {
      const valid = grafik.seriY.filter((j) => j < daftarKolom.length && j !== idxX);
      if (valid.length > 0) return valid;
    }
    return kolomAngkaOtomatis.filter((j) => j !== idxX);
  }, [grafik.seriY, daftarKolom.length, idxX, kolomAngkaOtomatis]);

  // Hitung data seri untuk grafik
  const labelKategori = useMemo(() => {
    return dataBaris.map((r, i) => r[idxX]?.trim() || `Baris ${i + 1}`);
  }, [dataBaris, idxX]);

  const dataSeri = useMemo(() => {
    return seriY.map((j) => {
      const nama = daftarKolom[j] || `Kolom ${j + 1}`;
      const nilai = dataBaris.map((r) => ekstrakAngka(r[j] ?? '') ?? 0);
      return { j, nama, nilai };
    });
  }, [seriY, daftarKolom, dataBaris]);

  const nilaiMaks = useMemo(() => {
    let max = 0;
    for (const s of dataSeri) {
      for (const v of s.nilai) {
        if (v > max) max = v;
      }
    }
    return max > 0 ? max : 10;
  }, [dataSeri]);

  const judulGrafik = grafik.judul || (dataSeri.length === 1 ? dataSeri[0].nama : 'Grafik Data Tabel');

  const gantiTipe = (tipe: 'batang' | 'garis' | 'pie') => {
    onUbah?.({ ...grafik, tipe });
  };

  const gantiSumbuX = (x: number) => {
    const baruSeri = seriY.filter((j) => j !== x);
    onUbah?.({ ...grafik, sumbuX: x, seriY: baruSeri.length ? baruSeri : undefined });
  };

  const toggleSeriY = (y: number) => {
    let baru: number[];
    if (seriY.includes(y)) {
      baru = seriY.filter((j) => j !== y);
    } else {
      baru = [...seriY, y];
    }
    if (baru.length === 0) baru = [y];
    onUbah?.({ ...grafik, seriY: baru });
  };

  const hapusGrafik = () => {
    onUbah?.(undefined);
  };

  // Dimensi SVG
  const W = 520;
  const H = 220;
  const padL = 45;
  const padR = 20;
  const padT = 25;
  const padB = 40;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  if (labelKategori.length === 0) {
    return null;
  }

  return (
    <div className="my-2 border-2 border-lime-500/30 bg-black/40 p-2.5 rounded-sm overflow-hidden select-none">
      {/* Bilah Header Grafik */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-1 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 flex items-center justify-center text-lime-400 shrink-0">
            {grafik.tipe === 'garis' ? <LineChart size={16} /> : grafik.tipe === 'pie' ? <PieChart size={16} /> : <BarChart3 size={16} />}
          </span>
          <h4 className="text-[13px] font-bold text-white truncate">{judulGrafik}</h4>
        </div>

        {bolehUbah && (
          <div className="flex items-center gap-1 shrink-0">
            <div className="flex border border-white/20 bg-white/5 rounded-sm p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => gantiTipe('batang')}
                className={`p-1 rounded-sm text-[11px] ${grafik.tipe === 'batang' ? 'bg-lime-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                title="Grafik Batang"
              >
                <BarChart3 size={13} />
              </button>
              <button
                type="button"
                onClick={() => gantiTipe('garis')}
                className={`p-1 rounded-sm text-[11px] ${grafik.tipe === 'garis' ? 'bg-lime-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                title="Grafik Garis"
              >
                <LineChart size={13} />
              </button>
              <button
                type="button"
                onClick={() => gantiTipe('pie')}
                className={`p-1 rounded-sm text-[11px] ${grafik.tipe === 'pie' ? 'bg-lime-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
                title="Grafik Lingkaran"
              >
                <PieChart size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setBukaSetelan(!bukaSetelan)}
              className={`p-1 border border-white/20 text-zinc-300 hover:text-white hover:border-lime-400 bg-white/5 rounded-sm ${bukaSetelan ? 'border-lime-400 text-lime-300' : ''}`}
              title="Pengaturan Sumbu & Seri"
            >
              <Settings2 size={13} />
            </button>

            <button
              type="button"
              onClick={hapusGrafik}
              className="p-1 border border-white/20 text-zinc-400 hover:text-red-300 hover:border-red-400 bg-white/5 rounded-sm"
              title="Tutup Grafik"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Panel Setelan Sumbu & Seri (Bila dibuka oleh user) */}
      {bukaSetelan && bolehUbah && (
        <div className="p-2 mb-2 bg-zinc-900/90 border border-lime-500/40 text-[12px] space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400">Sumbu X (Label):</span>
              <select
                value={idxX}
                onChange={(e) => gantiSumbuX(parseInt(e.target.value, 10))}
                className="input-retro !py-0.5 !text-[12px] !w-auto"
              >
                {daftarKolom.map((col, idx) => (
                  <option key={idx} value={idx}>{col}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
            <span className="text-zinc-400">Sumbu Y (Data Angka):</span>
            {daftarKolom.map((col, idx) => {
              if (idx === idxX) return null;
              const aktif = seriY.includes(idx);
              return (
                <label key={idx} className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[11px] cursor-pointer rounded-sm ${aktif ? 'border-lime-500 bg-lime-950/40 text-lime-200' : 'border-white/15 text-zinc-400 hover:text-white'}`}>
                  <input
                    type="checkbox"
                    checked={aktif}
                    onChange={() => toggleSeriY(idx)}
                    className="accent-lime-500 w-3 h-3"
                  />
                  <span>{col}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Render Visualisasi SVG */}
      <div className="relative overflow-x-auto custom-scrollbar">
        {grafik.tipe === 'pie' ? (
          /* ============================================================ */
          /* 1. GRAFIK PIE / DONAT                                        */
          /* ============================================================ */
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
            <svg viewBox="0 0 200 200" className="w-44 h-44 shrink-0">
              {(() => {
                const seriPilihan = dataSeri[0] || { j: 0, nama: 'Nilai', nilai: [] as number[] };
                const total = seriPilihan.nilai.reduce((a, b) => a + b, 0);
                if (total <= 0) {
                  return <text x="100" y="105" textAnchor="middle" fill="#71717a" fontSize="12">Data kosong</text>;
                }

                let sudutMulai = 0;
                return (
                  <g transform="translate(100, 100)">
                    {seriPilihan.nilai.map((val, i) => {
                      if (val <= 0) return null;
                      const porsi = val / total;
                      const sudut = porsi * 2 * Math.PI;
                      const sudutAkhir = sudutMulai + sudut;

                      const rOuter = 85;
                      const rInner = 45;

                      const x1 = rOuter * Math.cos(sudutMulai);
                      const y1 = rOuter * Math.sin(sudutMulai);
                      const x2 = rOuter * Math.cos(sudutAkhir);
                      const y2 = rOuter * Math.sin(sudutAkhir);

                      const x3 = rInner * Math.cos(sudutAkhir);
                      const y3 = rInner * Math.sin(sudutAkhir);
                      const x4 = rInner * Math.cos(sudutMulai);
                      const y4 = rInner * Math.sin(sudutMulai);

                      const largeArc = sudut > Math.PI ? 1 : 0;
                      const path = `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4} Z`;

                      const warna = WARNA_PALET[i % WARNA_PALET.length];
                      const lbl = labelKategori[i] || `Item ${i + 1}`;

                      sudutMulai = sudutAkhir;

                      return (
                        <path
                          key={i}
                          d={path}
                          fill={warna}
                          className="cursor-pointer transition-opacity hover:opacity-80"
                          onMouseEnter={() => setSorot({ label: lbl, seri: seriPilihan.nama, nilai: val })}
                          onMouseLeave={() => setSorot(null)}
                        />
                      );
                    })}
                    <text x="0" y="4" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">
                      {total.toLocaleString('id-ID')}
                    </text>
                  </g>
                );
              })()}
            </svg>

            {/* Legenda Pie */}
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar text-[12px] min-w-[150px]">
              {labelKategori.map((lbl, i) => {
                const val = dataSeri[0]?.nilai[i] ?? 0;
                const warna = WARNA_PALET[i % WARNA_PALET.length];
                return (
                  <div key={i} className="flex items-center justify-between gap-2 py-0.5 border-b border-white/5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 shrink-0 rounded-xs" style={{ backgroundColor: warna }} />
                      <span className="text-zinc-300 truncate" title={lbl}>{lbl}</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-100">{val.toLocaleString('id-ID')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : grafik.tipe === 'garis' ? (
          /* ============================================================ */
          /* 2. GRAFIK GARIS (LINE CHART)                                 */
          /* ============================================================ */
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px] h-48">
            {/* Garis Grid Horizontal */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const yPos = padT + chartH * (1 - pct);
              const valText = Math.round(nilaiMaks * pct);
              return (
                <g key={idx}>
                  <line x1={padL} y1={yPos} x2={W - padR} y2={yPos} stroke="rgba(255,255,255,0.1)" strokeDasharray="3,3" />
                  <text x={padL - 6} y={yPos + 3} textAnchor="end" fill="#71717a" fontSize="10" fontFamily="monospace">
                    {valText}
                  </text>
                </g>
              );
            })}

            {/* Garis Sumbu X & Y */}
            <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="rgba(255,255,255,0.25)" />

            {/* Garis Tiap Seri */}
            {dataSeri.map((seri, sIdx) => {
              const warna = WARNA_PALET[sIdx % WARNA_PALET.length];
              const stepX = chartW / Math.max(1, labelKategori.length - 1);

              const points = seri.nilai.map((val, i) => {
                const x = padL + i * stepX;
                const y = padT + chartH - (val / nilaiMaks) * chartH;
                return `${x},${y}`;
              }).join(' ');

              return (
                <g key={sIdx}>
                  <polyline
                    fill="none"
                    stroke={warna}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                  />
                  {seri.nilai.map((val, i) => {
                    const x = padL + i * stepX;
                    const y = padT + chartH - (val / nilaiMaks) * chartH;
                    const lbl = labelKategori[i];
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="4"
                        fill={warna}
                        stroke="#000"
                        strokeWidth="1.5"
                        className="cursor-pointer hover:r-6 transition-all"
                        onMouseEnter={() => setSorot({ label: lbl, seri: seri.nama, nilai: val })}
                        onMouseLeave={() => setSorot(null)}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Label Sumbu X */}
            {labelKategori.map((lbl, i) => {
              const stepX = chartW / Math.max(1, labelKategori.length - 1);
              const x = padL + i * stepX;
              return (
                <text key={i} x={x} y={H - 12} textAnchor="middle" fill="#a1a1aa" fontSize="10">
                  {lbl.length > 8 ? `${lbl.slice(0, 7)}…` : lbl}
                </text>
              );
            })}
          </svg>
        ) : (
          /* ============================================================ */
          /* 3. GRAFIK BATANG (BAR CHART)                                 */
          /* ============================================================ */
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px] h-48">
            {/* Garis Grid Horizontal */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
              const yPos = padT + chartH * (1 - pct);
              const valText = Math.round(nilaiMaks * pct);
              return (
                <g key={idx}>
                  <line x1={padL} y1={yPos} x2={W - padR} y2={yPos} stroke="rgba(255,255,255,0.1)" strokeDasharray="3,3" />
                  <text x={padL - 6} y={yPos + 3} textAnchor="end" fill="#71717a" fontSize="10" fontFamily="monospace">
                    {valText}
                  </text>
                </g>
              );
            })}

            {/* Sumbu X dasar */}
            <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="rgba(255,255,255,0.25)" />

            {/* Batang per Kategori */}
            {(() => {
              const nKategori = labelKategori.length;
              const nSeri = dataSeri.length;
              const slotW = chartW / Math.max(1, nKategori);
              const barTotalW = slotW * 0.7;
              const barW = Math.max(4, barTotalW / Math.max(1, nSeri));

              return labelKategori.map((lbl, i) => {
                const groupX = padL + i * slotW + (slotW - barTotalW) / 2;

                return (
                  <g key={i}>
                    {dataSeri.map((seri, sIdx) => {
                      const val = seri.nilai[i] ?? 0;
                      const h = Math.max(1, (val / nilaiMaks) * chartH);
                      const x = groupX + sIdx * barW;
                      const y = padT + chartH - h;
                      const warna = WARNA_PALET[sIdx % WARNA_PALET.length];

                      return (
                        <rect
                          key={sIdx}
                          x={x}
                          y={y}
                          width={barW - 1}
                          height={h}
                          fill={warna}
                          rx="1"
                          className="cursor-pointer transition-opacity hover:opacity-80"
                          onMouseEnter={() => setSorot({ label: lbl, seri: seri.nama, nilai: val })}
                          onMouseLeave={() => setSorot(null)}
                        />
                      );
                    })}
                    <text
                      x={groupX + barTotalW / 2}
                      y={H - 12}
                      textAnchor="middle"
                      fill="#a1a1aa"
                      fontSize="10"
                    >
                      {lbl.length > 8 ? `${lbl.slice(0, 7)}…` : lbl}
                    </text>
                  </g>
                );
              });
            })()}
          </svg>
        )}

        {/* Tooltip Interaktif Hover */}
        {sorot && (
          <div className="absolute top-2 right-2 bg-zinc-900 border border-lime-400 px-2 py-1 text-[11px] shadow-lg pointer-events-none z-10">
            <span className="font-bold text-white">{sorot.label}</span>
            <div className="text-zinc-300">
              {sorot.seri}: <span className="font-mono text-lime-300 font-bold">{sorot.nilai.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legenda Seri (bila lebih dari 1 seri) */}
      {dataSeri.length > 1 && grafik.tipe !== 'pie' && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 mt-1 border-t border-white/5 text-[11px]">
          {dataSeri.map((s, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: WARNA_PALET[idx % WARNA_PALET.length] }} />
              <span className="text-zinc-300 font-medium">{s.nama}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
