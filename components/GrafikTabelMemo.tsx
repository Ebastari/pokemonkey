/**
 * Komponen Grafik Dinamis Terkoneksi pada Tabel (Live-Linked Chart).
 *
 * Menggambar visualisasi SVG interaktif (Batang, Garis, Pie/Donat) yang
 * bersumber langsung dari tabel memo. Setiap kali isi tabel diubah,
 * grafik otomatis memperbarui tampilannya secara real-time.
 *
 * Mendukung dua mode pengolahan:
 * 1. Mode 'nilai': Menggunakan angka numerik yang ada di dalam sel secara langsung (misal: tracker YOLO, metrik kumulatif, finansial).
 * 2. Mode 'hitung' (Count / Rekap Pivot): Menghitung jumlah kemunculan baris kategori (misal: rekap PICA per PIC dan Status).
 */

import React, { useMemo, useState, useEffect } from 'react';
import { BarChart3, LineChart, PieChart, Settings2, Trash2 } from 'lucide-react';
import type { OpsiGrafikTabel } from '../server/src/memo-blok';

interface Props {
  baris: string[][];
  kepala: boolean;
  grafik: OpsiGrafikTabel;
  bolehUbah?: boolean;
  onUbah?: (baru: OpsiGrafikTabel | undefined) => void;
}

const WARNA_PALET = [
  '#f59e0b', // amber-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#ec4899', // pink-500
  '#8b5cf6', // purple-500
  '#3b82f6', // blue-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
];

/** Berikan warna semantik intuitif untuk kategori status atau palet umum */
export function warnaKategori(nama: string, idx: number): string {
  const s = nama.toLowerCase().trim();
  if (s.includes('open') || s.includes('buka') || s.includes('belum')) return '#f59e0b'; // amber-500
  if (s.includes('continue') || s.includes('progress') || s.includes('proses') || s.includes('verifikasi')) return '#06b6d4'; // cyan-500
  if (s.includes('selesai') || s.includes('closed') || s.includes('tuntas') || s.includes('done')) return '#10b981'; // emerald-500
  if (s.includes('batal') || s.includes('reject') || s.includes('cancel')) return '#ef4444'; // red-500
  return WARNA_PALET[idx % WARNA_PALET.length];
}

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

  // Pastikan seluruh teks setelah dibersihkan adalah angka murni (hindari teks tanggal seperti "28 Okt" atau kode "H-01")
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;

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

  // Periksa apakah tabel memiliki kolom data numerik nyata (>50% baris berisi angka valid)
  const adaKolomAngkaNyata = useMemo(() => {
    if (daftarKolom.length <= 1) return false;
    for (let j = 0; j < daftarKolom.length; j++) {
      const namaCol = (daftarKolom[j] || '').toLowerCase();
      if (/^(no|nomor|id|kode|tgl|tanggal|date|due)/i.test(namaCol)) continue;
      let hitungAngka = 0;
      for (const r of dataBaris) {
        const val = ekstrakAngka(r[j] ?? '');
        if (val !== null && val > 0) hitungAngka++;
      }
      if (dataBaris.length > 0 && hitungAngka / dataBaris.length >= 0.5) {
        return true;
      }
    }
    return false;
  }, [daftarKolom, dataBaris]);

  // Deteksi kolom khusus untuk PICA / Manajemen Tugas
  const idxStatusOtomatis = useMemo(() => {
    return daftarKolom.findIndex((c) => /status|kondisi|state|ceklis/i.test(c));
  }, [daftarKolom]);

  const idxPicOtomatis = useMemo(() => {
    return daftarKolom.findIndex((c) => /pic|orang|nama|pj|penanggung/i.test(c));
  }, [daftarKolom]);

  // Tentukan mode pengolahan data: 'nilai' (angka langsung) atau 'hitung' (frekuensi/rekap pivot)
  const modeAktif: 'nilai' | 'hitung' = grafik.mode ?? (adaKolomAngkaNyata ? 'nilai' : 'hitung');

  // Sinkronkan tipe tampilan lokal
  const [tipeLokal, setTipeLokal] = useState<'batang' | 'garis' | 'pie'>(grafik.tipe);
  useEffect(() => {
    setTipeLokal(grafik.tipe);
  }, [grafik.tipe]);
  const tipeAktif = tipeLokal;

  // -------------------------------------------------------------
  // Konfigurasi Sumbu X dan Kolom Pemecah (Breakdown)
  // -------------------------------------------------------------
  const colX = useMemo(() => {
    if (grafik.sumbuX !== undefined && grafik.sumbuX < daftarKolom.length) {
      return grafik.sumbuX;
    }
    if (modeAktif === 'hitung') {
      if (idxPicOtomatis !== -1) return idxPicOtomatis;
      if (idxStatusOtomatis !== -1) return idxStatusOtomatis;
    }
    return 0;
  }, [grafik.sumbuX, daftarKolom.length, modeAktif, idxPicOtomatis, idxStatusOtomatis]);

  const colBreakdown = useMemo(() => {
    if (grafik.kolomPecah !== undefined) {
      return grafik.kolomPecah;
    }
    // Bawaan cerdas: jika sumbu X adalah PIC dan ada kolom Status, otomatis pecah berdasarkan Status!
    if (modeAktif === 'hitung' && colX === idxPicOtomatis && idxStatusOtomatis !== -1 && idxStatusOtomatis !== colX) {
      return idxStatusOtomatis;
    }
    return -1;
  }, [grafik.kolomPecah, modeAktif, colX, idxPicOtomatis, idxStatusOtomatis]);

  // Deteksi kolom angka otomatis untuk mode 'nilai'
  const kolomAngkaOtomatis = useMemo(() => {
    const hasil: number[] = [];
    if (daftarKolom.length <= 1) return [0];

    for (let j = 0; j < daftarKolom.length; j++) {
      if (j === colX) continue;
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
  }, [daftarKolom, dataBaris, colX]);

  const seriYNilai = useMemo(() => {
    if (grafik.seriY && grafik.seriY.length > 0) {
      const valid = grafik.seriY.filter((j) => j < daftarKolom.length && j !== colX);
      if (valid.length > 0) return valid;
    }
    return kolomAngkaOtomatis;
  }, [grafik.seriY, daftarKolom.length, colX, kolomAngkaOtomatis]);

  // -------------------------------------------------------------
  // Perhitungan Data Grafik: Kategori & Seri
  // -------------------------------------------------------------
  const kategoriUnikX = useMemo(() => {
    if (modeAktif !== 'hitung') return [];
    const map = new Map<string, number>();
    for (const r of dataBaris) {
      const k = (r[colX] ?? '').trim() || '(Kosong)';
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.keys());
  }, [modeAktif, dataBaris, colX]);

  const kategoriUnikBreakdown = useMemo(() => {
    if (modeAktif !== 'hitung' || colBreakdown === -1 || colBreakdown >= daftarKolom.length || colBreakdown === colX) {
      return [];
    }
    const set = new Set<string>();
    for (const r of dataBaris) {
      const k = (r[colBreakdown] ?? '').trim() || '(Kosong)';
      set.add(k);
    }
    return Array.from(set.values());
  }, [modeAktif, dataBaris, colBreakdown, daftarKolom.length, colX]);

  const labelKategori = useMemo(() => {
    if (modeAktif === 'hitung') {
      return kategoriUnikX;
    }
    return dataBaris.map((r, i) => r[colX]?.trim() || `Baris ${i + 1}`);
  }, [modeAktif, kategoriUnikX, dataBaris, colX]);

  const dataSeri = useMemo(() => {
    if (modeAktif === 'hitung') {
      if (kategoriUnikBreakdown.length > 0) {
        // Multi-seri: dipecah berdasarkan kategori kedua (misal: Open, Continue, Selesai)
        return kategoriUnikBreakdown.map((seriName, sIdx) => {
          const nilai = kategoriUnikX.map((catX) => {
            return dataBaris.filter((r) => {
              const valX = (r[colX] ?? '').trim() || '(Kosong)';
              const valB = (r[colBreakdown] ?? '').trim() || '(Kosong)';
              return valX === catX && valB === seriName;
            }).length;
          });
          return {
            j: colBreakdown,
            nama: seriName,
            nilai,
            warna: warnaKategori(seriName, sIdx),
          };
        });
      } else {
        // Single-seri: Total jumlah baris per kategori Sumbu X
        const namaSeri = `Jumlah (${daftarKolom[colX] || 'Data'})`;
        const nilai = kategoriUnikX.map((catX) => {
          return dataBaris.filter((r) => ((r[colX] ?? '').trim() || '(Kosong)') === catX).length;
        });
        return [
          {
            j: colX,
            nama: namaSeri,
            nilai,
            warna: WARNA_PALET[0],
          },
        ];
      }
    }

    // Mode 'nilai' (Angka sel langsung)
    return seriYNilai.map((j, sIdx) => {
      const nama = daftarKolom[j] || `Kolom ${j + 1}`;
      const nilai = dataBaris.map((r) => ekstrakAngka(r[j] ?? '') ?? 0);
      return {
        j,
        nama,
        nilai,
        warna: WARNA_PALET[sIdx % WARNA_PALET.length],
      };
    });
  }, [modeAktif, kategoriUnikBreakdown, kategoriUnikX, dataBaris, colX, colBreakdown, daftarKolom, seriYNilai]);

  // Data khusus untuk Donut / Pie chart
  const pieData = useMemo(() => {
    if (modeAktif === 'hitung') {
      if (kategoriUnikBreakdown.length > 0) {
        // Pie chart menampilkan total proporsi pemecah (misal Status global: 18 Open, 8 Continue, 6 Selesai)
        const values = kategoriUnikBreakdown.map((bName) => {
          return dataBaris.filter((r) => ((r[colBreakdown] ?? '').trim() || '(Kosong)') === bName).length;
        });
        const total = values.reduce((a, b) => a + b, 0);
        return {
          namaSeri: daftarKolom[colBreakdown] || 'Kategori',
          labels: kategoriUnikBreakdown,
          values,
          total,
          warnas: kategoriUnikBreakdown.map((bName, i) => warnaKategori(bName, i)),
        };
      } else {
        // Pie chart dari kategori Sumbu X (misal proporsi PIC atau proporsi Status)
        const values = kategoriUnikX.map((catX) => {
          return dataBaris.filter((r) => ((r[colX] ?? '').trim() || '(Kosong)') === catX).length;
        });
        const total = values.reduce((a, b) => a + b, 0);
        return {
          namaSeri: daftarKolom[colX] || 'Kategori',
          labels: kategoriUnikX,
          values,
          total,
          warnas: kategoriUnikX.map((cName, i) => warnaKategori(cName, i)),
        };
      }
    }

    // Mode 'nilai':
    const seriPertama = dataSeri[0];
    const totalNumerik = seriPertama ? seriPertama.nilai.reduce((a, b) => a + b, 0) : 0;
    const semuaBiner = seriPertama && seriPertama.nilai.length > 2 && seriPertama.nilai.every((v) => v === 0 || v === 1);

    if (seriPertama && semuaBiner) {
      const selesai = seriPertama.nilai.filter((v) => v === 1).length;
      const belum = seriPertama.nilai.filter((v) => v === 0).length;
      return {
        namaSeri: seriPertama.nama || 'Status',
        labels: ['Selesai', 'Belum'],
        values: [selesai, belum],
        total: selesai + belum,
        warnas: ['#10b981', '#f59e0b'],
      };
    }

    if (totalNumerik > 0 && seriPertama) {
      return {
        namaSeri: seriPertama.nama,
        labels: labelKategori,
        values: seriPertama.nilai,
        total: totalNumerik,
        warnas: labelKategori.map((_, i) => WARNA_PALET[i % WARNA_PALET.length]),
      };
    }

    // Fallback jika numerik kosong
    const targetCol = colX < daftarKolom.length ? colX : 0;
    const frekuensi = new Map<string, number>();
    for (const r of dataBaris) {
      const teks = (r[targetCol] ?? '').trim() || '(Kosong)';
      frekuensi.set(teks, (frekuensi.get(teks) || 0) + 1);
    }
    const labels = Array.from(frekuensi.keys());
    const values = Array.from(frekuensi.values());
    const total = values.reduce((a, b) => a + b, 0);
    return {
      namaSeri: daftarKolom[targetCol] || 'Kategori',
      labels,
      values,
      total,
      warnas: labels.map((l, i) => warnaKategori(l, i)),
    };
  }, [modeAktif, kategoriUnikBreakdown, colBreakdown, dataBaris, daftarKolom, kategoriUnikX, colX, dataSeri, labelKategori]);

  const nilaiMaks = useMemo(() => {
    let max = 0;
    for (const s of dataSeri) {
      for (const v of s.nilai) {
        if (v > max) max = v;
      }
    }
    return max > 0 ? max : 5;
  }, [dataSeri]);

  const judulGrafik = useMemo(() => {
    if (grafik.judul) return grafik.judul;
    if (modeAktif === 'hitung') {
      if (colBreakdown !== -1 && colBreakdown !== colX) {
        return `Rekap ${daftarKolom[colX]} per ${daftarKolom[colBreakdown]} (${dataBaris.length} Data)`;
      }
      return `Rekap ${daftarKolom[colX]} (${dataBaris.length} Data)`;
    }
    return dataSeri.length === 1 ? dataSeri[0].nama : 'Grafik Data Tabel';
  }, [grafik.judul, modeAktif, colBreakdown, colX, daftarKolom, dataBaris.length, dataSeri]);

  const gantiTipe = (tipe: 'batang' | 'garis' | 'pie') => {
    setTipeLokal(tipe);
    onUbah?.({ ...grafik, tipe });
  };

  const gantiSumbuX = (x: number) => {
    onUbah?.({ ...grafik, sumbuX: x });
  };

  const gantiKolomBreakdown = (b: number) => {
    onUbah?.({ ...grafik, kolomPecah: b });
  };

  const gantiMode = (mode: 'hitung' | 'nilai') => {
    onUbah?.({ ...grafik, mode });
  };

  const toggleSeriY = (y: number) => {
    let baru: number[];
    if (seriYNilai.includes(y)) {
      baru = seriYNilai.filter((j) => j !== y);
    } else {
      baru = [...seriYNilai, y];
    }
    if (baru.length === 0) baru = [y];
    onUbah?.({ ...grafik, seriY: baru });
  };

  const hapusGrafik = () => {
    onUbah?.(undefined);
  };

  // Dimensi SVG responsif
  const nKategori = Math.max(1, labelKategori.length);
  const nSeri = Math.max(1, dataSeri.length);
  const padL = 45;
  const padR = 20;
  const padT = 25;
  const padB = 40;
  const H = 220;
  const chartH = H - padT - padB;

  // Lebar slot dinamis agar kategori banyak (misal banyak PIC) tidak berdempetan
  const slotWMinimal = Math.max(50, nSeri * 26 + 24);
  const W = Math.max(520, padL + padR + nKategori * slotWMinimal);
  const chartW = W - padL - padR;

  if (dataBaris.length === 0) {
    return null;
  }

  return (
    <div className="my-2 border-2 border-lime-500/30 bg-black/40 p-2.5 rounded-sm overflow-hidden select-none">
      {/* Bilah Header Grafik */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-1 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-5 h-5 flex items-center justify-center text-lime-400 shrink-0">
            {tipeAktif === 'garis' ? <LineChart size={16} /> : tipeAktif === 'pie' ? <PieChart size={16} /> : <BarChart3 size={16} />}
          </span>
          <h4 className="text-[13px] font-bold text-white truncate">{judulGrafik}</h4>
        </div>

        {/* Bilah Tombol Pengganti Tipe & Setelan */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex border border-white/20 bg-white/5 rounded-sm p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => gantiTipe('batang')}
              className={`p-1 rounded-sm text-[11px] ${tipeAktif === 'batang' ? 'bg-lime-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              title="Grafik Batang (Bar)"
            >
              <BarChart3 size={13} />
            </button>
            <button
              type="button"
              onClick={() => gantiTipe('garis')}
              className={`p-1 rounded-sm text-[11px] ${tipeAktif === 'garis' ? 'bg-lime-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              title="Grafik Garis (Line Tren)"
            >
              <LineChart size={13} />
            </button>
            <button
              type="button"
              onClick={() => gantiTipe('pie')}
              className={`p-1 rounded-sm text-[11px] ${tipeAktif === 'pie' ? 'bg-lime-600 text-white font-bold' : 'text-zinc-400 hover:text-white'}`}
              title="Grafik Donut / Pie (Proporsi)"
            >
              <PieChart size={13} />
            </button>
          </div>

          {bolehUbah && (
            <>
              <button
                type="button"
                onClick={() => setBukaSetelan(!bukaSetelan)}
                className={`p-1 border border-white/20 text-zinc-300 hover:text-white hover:border-lime-400 bg-white/5 rounded-sm ${bukaSetelan ? 'border-lime-400 text-lime-300' : ''}`}
                title="Pengaturan Sumbu, Kategori, & Rekap"
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
            </>
          )}
        </div>
      </div>

      {/* Panel Setelan Sumbu, Mode Rekap, & Preset (Bila dibuka oleh user) */}
      {bukaSetelan && bolehUbah && (
        <div className="p-2.5 mb-2 bg-zinc-900/95 border border-lime-500/40 text-[12px] space-y-2.5 rounded-xs">
          {/* Pilihan Mode Data */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/10">
            <span className="text-zinc-300 font-bold">Mode Pengolahan Data:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => gantiMode('hitung')}
                className={`px-2 py-0.5 rounded-xs text-[11px] font-bold border transition-all ${
                  modeAktif === 'hitung'
                    ? 'bg-lime-600 text-black border-lime-400'
                    : 'bg-white/5 text-zinc-400 border-white/15 hover:text-white'
                }`}
                title="Hitung jumlah kemunculan baris / frekuensi (sangat cocok untuk PICA & status tugas)"
              >
                📊 Rekap Jumlah Data (Count / Pivot)
              </button>
              <button
                type="button"
                onClick={() => gantiMode('nilai')}
                className={`px-2 py-0.5 rounded-xs text-[11px] font-bold border transition-all ${
                  modeAktif === 'nilai'
                    ? 'bg-lime-600 text-black border-lime-400'
                    : 'bg-white/5 text-zinc-400 border-white/15 hover:text-white'
                }`}
                title="Plot nilai numerik mentah langsung dari dalam sel tabel"
              >
                🔢 Nilai Sel Langsung (Numerik)
              </button>
            </div>
          </div>

          {/* Pengaturan untuk Mode Hitung / Rekap */}
          {modeAktif === 'hitung' ? (
            <div className="space-y-2">
              {/* Tombol Preset Cepat jika ada kolom PIC atau Status */}
              {(idxPicOtomatis !== -1 || idxStatusOtomatis !== -1) && (
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                  <span className="text-zinc-400 text-[11px]">Preset Cepat:</span>
                  {idxPicOtomatis !== -1 && idxStatusOtomatis !== -1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onUbah?.({
                          ...grafik,
                          mode: 'hitung',
                          sumbuX: idxPicOtomatis,
                          kolomPecah: idxStatusOtomatis,
                          judul: `Rekap ${daftarKolom[idxPicOtomatis]} per ${daftarKolom[idxStatusOtomatis]} (${dataBaris.length} Data)`,
                        })
                      }
                      className="px-2 py-0.5 border border-amber-500/50 bg-amber-950/40 text-amber-200 hover:border-amber-400 text-[11px] rounded-xs font-bold"
                    >
                      👥 Rekap per PIC ({daftarKolom[idxStatusOtomatis]})
                    </button>
                  )}
                  {idxStatusOtomatis !== -1 && (
                    <button
                      type="button"
                      onClick={() =>
                        onUbah?.({
                          ...grafik,
                          mode: 'hitung',
                          sumbuX: idxStatusOtomatis,
                          kolomPecah: -1,
                          judul: `Rekap ${daftarKolom[idxStatusOtomatis]} (${dataBaris.length} Data)`,
                        })
                      }
                      className="px-2 py-0.5 border border-lime-500/50 bg-lime-950/40 text-lime-200 hover:border-lime-400 text-[11px] rounded-xs font-bold"
                    >
                      🏷️ Rekap per {daftarKolom[idxStatusOtomatis]} (Total)
                    </button>
                  )}
                </div>
              )}

              {/* Dropdown Kategori Utama & Pecah Berdasarkan */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400 whitespace-nowrap">Sumbu X (Kategori Utama):</span>
                  <select
                    value={colX}
                    onChange={(e) => gantiSumbuX(parseInt(e.target.value, 10))}
                    className="input-retro !py-0.5 !text-[12px] flex-1 min-w-[120px]"
                  >
                    {daftarKolom.map((col, idx) => (
                      <option key={idx} value={idx}>{col}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400 whitespace-nowrap">Pecah Berdasarkan:</span>
                  <select
                    value={colBreakdown}
                    onChange={(e) => gantiKolomBreakdown(parseInt(e.target.value, 10))}
                    className="input-retro !py-0.5 !text-[12px] flex-1 min-w-[120px]"
                  >
                    <option value={-1}>— Total Saja (Tanpa Pemecah) —</option>
                    {daftarKolom.map((col, idx) => {
                      if (idx === colX) return null;
                      return (
                        <option key={idx} value={idx}>
                          {col}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* Pengaturan untuk Mode Nilai Sel Langsung */
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400">Sumbu X (Label Baris):</span>
                <select
                  value={colX}
                  onChange={(e) => gantiSumbuX(parseInt(e.target.value, 10))}
                  className="input-retro !py-0.5 !text-[12px] !w-auto"
                >
                  {daftarKolom.map((col, idx) => (
                    <option key={idx} value={idx}>{col}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/10">
                <span className="text-zinc-400">Sumbu Y (Kolom Angka):</span>
                {daftarKolom.map((col, idx) => {
                  if (idx === colX) return null;
                  const aktif = seriYNilai.includes(idx);
                  return (
                    <label
                      key={idx}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 border text-[11px] cursor-pointer rounded-sm ${
                        aktif
                          ? 'border-lime-500 bg-lime-950/40 text-lime-200'
                          : 'border-white/15 text-zinc-400 hover:text-white'
                      }`}
                    >
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
        </div>
      )}

      {/* Render Visualisasi SVG */}
      <div className="relative overflow-x-auto custom-scrollbar">
        {tipeAktif === 'pie' ? (
          /* ============================================================ */
          /* 1. GRAFIK PIE / DONAT                                        */
          /* ============================================================ */
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
            <svg viewBox="0 0 200 200" className="w-44 h-44 shrink-0">
              {(() => {
                const total = pieData.total;
                if (total <= 0) {
                  return <text x="100" y="105" textAnchor="middle" fill="#71717a" fontSize="12">Data kosong</text>;
                }

                let sudutMulai = 0;
                return (
                  <g transform="translate(100, 100)">
                    {pieData.values.map((val, i) => {
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

                      const warna = pieData.warnas?.[i] || WARNA_PALET[i % WARNA_PALET.length];
                      const lbl = pieData.labels[i] || `Item ${i + 1}`;

                      sudutMulai = sudutAkhir;

                      return (
                        <path
                          key={i}
                          d={path}
                          fill={warna}
                          className="cursor-pointer transition-opacity hover:opacity-80"
                          onMouseEnter={() => setSorot({ label: lbl, seri: pieData.namaSeri, nilai: val })}
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
              {pieData.labels.map((lbl, i) => {
                const val = pieData.values[i] ?? 0;
                const warna = pieData.warnas?.[i] || WARNA_PALET[i % WARNA_PALET.length];
                const pct = pieData.total > 0 ? Math.round((val / pieData.total) * 100) : 0;
                return (
                  <div key={i} className="flex items-center justify-between gap-2 py-0.5 border-b border-white/5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 shrink-0 rounded-xs" style={{ backgroundColor: warna }} />
                      <span className="text-zinc-300 truncate" title={lbl}>{lbl}</span>
                    </div>
                    <span className="font-mono font-bold text-zinc-100">
                      {val} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : tipeAktif === 'garis' ? (
          /* ============================================================ */
          /* 2. GRAFIK GARIS (LINE CHART)                                 */
          /* ============================================================ */
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, minWidth: '100%' }} className="h-48 block">
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
              const warna = seri.warna || WARNA_PALET[sIdx % WARNA_PALET.length];
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
                  {lbl.length > 10 ? `${lbl.slice(0, 9)}…` : lbl}
                </text>
              );
            })}
          </svg>
        ) : (
          /* ============================================================ */
          /* 3. GRAFIK BATANG (BAR CHART)                                 */
          /* ============================================================ */
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, minWidth: '100%' }} className="h-48 block">
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
              const slotW = chartW / nKategori;
              const barTotalW = slotW * 0.75;
              const barW = Math.max(4, barTotalW / nSeri);

              return labelKategori.map((lbl, i) => {
                const groupX = padL + i * slotW + (slotW - barTotalW) / 2;

                return (
                  <g key={i}>
                    {dataSeri.map((seri, sIdx) => {
                      const val = seri.nilai[i] ?? 0;
                      if (val <= 0) return null;
                      const h = Math.max(4, (val / nilaiMaks) * chartH);
                      const x = groupX + sIdx * barW;
                      const y = padT + chartH - h;
                      const warna = seri.warna || WARNA_PALET[sIdx % WARNA_PALET.length];

                      return (
                        <g key={sIdx}>
                          <rect
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
                          {/* Angka di atas batang bila lebar batang memadai */}
                          {barW >= 14 && (
                            <text
                              x={x + (barW - 1) / 2}
                              y={y - 3}
                              textAnchor="middle"
                              fill="#fff"
                              fontSize="9"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {val}
                            </text>
                          )}
                        </g>
                      );
                    })}
                    <text
                      x={groupX + barTotalW / 2}
                      y={H - 12}
                      textAnchor="middle"
                      fill="#a1a1aa"
                      fontSize="10"
                    >
                      {lbl.length > 10 ? `${lbl.slice(0, 9)}…` : lbl}
                    </text>
                  </g>
                );
              });
            })()}
          </svg>
        )}

        {/* Tooltip Interaktif Hover */}
        {sorot && (
          <div className="absolute top-2 right-2 bg-zinc-900 border border-lime-400 px-2.5 py-1 text-[11px] shadow-lg pointer-events-none z-10 rounded-xs">
            <span className="font-bold text-white">{sorot.label}</span>
            <div className="text-zinc-300">
              {sorot.seri}: <span className="font-mono text-lime-300 font-bold">{sorot.nilai.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Legenda Seri (bila lebih dari 1 seri) */}
      {dataSeri.length > 1 && tipeAktif !== 'pie' && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 mt-1 border-t border-white/5 text-[11px]">
          {dataSeri.map((s, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: s.warna || WARNA_PALET[idx % WARNA_PALET.length] }} />
              <span className="text-zinc-300 font-medium">{s.nama}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
