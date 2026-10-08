/**
 * Modal Pemilih PICA dengan Filter Status, Pencarian, Checklist Pilihan,
 * serta mode Live Sync (selalu update) dan Snapshot Statis (ditetapkan).
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckSquare,
  Filter,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Square,
  Table2,
  User,
  X,
} from 'lucide-react';
import type { PicaItem } from '../lib/tipe-api';
import type { InfoPicaLive } from '../server/src/memo-blok';
import * as W from '../lib/waktu';
import {
  ambilDaftarPica,
  cekStatusKategori,
  nomorPica,
  rakitBlokTabelPica,
  saringDaftarPica,
  susunBarisPicaDetail,
} from '../lib/pica-tabel';

export type FilterStatusPica = 'semua' | 'open' | 'continue' | 'selesai';

interface Props {
  terpilihId?: string | null;
  /** Konfigurasi pica saat ini jika modal dibuka untuk mengubah tabel yang ada */
  picaAwal?: InfoPicaLive;
  onPilih?: (pica: PicaItem) => void;
  /** Callback untuk menyisipkan daftar terfilter sebagai blok tabel memo baru */
  onSisipTabel?: (tabelRaw: string) => void;
  /** Callback untuk memperbarui blok tabel yang sedang aktif */
  onPerbaruiTabel?: (tabelRaw: string) => void;
  onLepas?: () => void;
  onTutup: () => void;
}

export const ModalPilihPica: React.FC<Props> = ({
  terpilihId,
  picaAwal,
  onPilih,
  onSisipTabel,
  onPerbaruiTabel,
  onLepas,
  onTutup,
}) => {
  const [daftar, setDaftar] = useState<PicaItem[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatusPica>(picaAwal?.filterStatus || 'semua');
  const [kueri, setKueri] = useState('');
  const [pilihanIds, setPilihanIds] = useState<Set<string>>(() => new Set(picaAwal?.picaIds || []));

  useEffect(() => {
    let aktif = true;
    void ambilDaftarPica()
      .then((d) => {
        if (aktif) {
          setDaftar(d);
          setMemuat(false);
        }
      })
      .catch(() => {
        if (aktif) {
          setDaftar([]);
          setMemuat(false);
        }
      });
    return () => {
      aktif = false;
    };
  }, []);

  // Hitung jumlah per kategori status
  const hitung = useMemo(() => {
    let open = 0;
    let cont = 0;
    let selesai = 0;
    for (const p of daftar) {
      const kat = cekStatusKategori(p.status);
      if (kat === 'open') open++;
      else if (kat === 'continue') cont++;
      else selesai++;
    }
    return { semua: daftar.length, open, continue: cont, selesai };
  }, [daftar]);

  // Saring daftar berdasarkan filter status dan kueri pencarian
  const tersaring = useMemo(() => {
    return saringDaftarPica(daftar, { filterStatus, kueri });
  }, [daftar, filterStatus, kueri]);

  // Toggle checklist satu PICA
  const togglePilih = (id: string) => {
    setPilihanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Pilih semua yang sedang tampil di filter
  const pilihSemuaTampil = () => {
    setPilihanIds((prev) => {
      const next = new Set(prev);
      tersaring.forEach((p) => next.add(p.id));
      return next;
    });
  };

  // Batal pilih semua
  const batalSemua = () => {
    setPilihanIds(new Set());
  };

  // Kirim tabel (baik sisip baru maupun perbarui tabel aktif)
  const kirimTabel = (rawTabel: string) => {
    if (onPerbaruiTabel) {
      onPerbaruiTabel(rawTabel);
    } else if (onSisipTabel) {
      onSisipTabel(rawTabel);
    }
    onTutup();
  };

  // Sisipkan berdasarkan filter status (semua yang cocok)
  const terapkanFilter = (live: boolean) => {
    if (tersaring.length === 0) return;
    const raw = rakitBlokTabelPica(tersaring, {
      live,
      mode: 'filter',
      filterStatus,
      ditetapkan: !live,
    });
    kirimTabel(raw);
  };

  // Sisipkan berdasarkan checklist PICA terpilih
  const terapkanPilihan = (live: boolean) => {
    const terpilih = daftar.filter((p) => pilihanIds.has(p.id));
    if (terpilih.length === 0) return;
    const raw = rakitBlokTabelPica(terpilih, {
      live,
      mode: 'pilihan',
      picaIds: Array.from(pilihanIds),
      ditetapkan: !live,
    });
    kirimTabel(raw);
  };

  // Sisipkan tabel rincian lengkap 1 PICA
  const sisipTabelSatu = (p: PicaItem) => {
    const baris = susunBarisPicaDetail(p);
    const json = JSON.stringify({
      kepala: true,
      baris,
    });
    kirimTabel(`!tabel${json}`);
  };

  const adaAksiTabel = Boolean(onSisipTabel || onPerbaruiTabel);
  const jumlahDipilih = pilihanIds.size;
  const labelAksi = onPerbaruiTabel ? 'Perbarui Tabel' : 'Sisipkan Tabel';

  return (
    <div className="fixed inset-0 z-[220] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3" onClick={onTutup}>
      <div
        className="retro-box !bg-zinc-900 border-amber-500 w-full max-w-2xl flex flex-col !p-0 overflow-hidden max-h-[90vh] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b-2 border-white/15 bg-zinc-950">
          <div className="flex items-center gap-2 text-white font-bold text-[14px]">
            <AlertCircle size={16} className="text-amber-400" />
            <span>Pilih & Sisipkan Tabel PICA</span>
            {picaAwal && (
              <span className="text-[11px] px-1.5 py-0.5 bg-lime-900/60 border border-lime-500/50 text-lime-300 font-normal">
                Mode Ubah Sumber
              </span>
            )}
          </div>
          <button type="button" onClick={onTutup} className="text-zinc-400 hover:text-white" aria-label="Tutup">
            <X size={18} />
          </button>
        </div>

        {/* Tab Filter Status */}
        <div className="flex items-center gap-1.5 p-2 bg-zinc-950/70 border-b border-white/10 overflow-x-auto custom-scrollbar">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider flex items-center gap-1 mr-1 shrink-0 font-bold">
            <Filter size={11} /> Status:
          </span>
          {(
            [
              ['semua', `Semua (${hitung.semua})`],
              ['open', `Open (${hitung.open})`],
              ['continue', `Continue (${hitung.continue})`],
              ['selesai', `Selesai (${hitung.selesai})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterStatus(k)}
              className={`px-2.5 py-1 text-[12px] font-bold rounded-xs shrink-0 transition-colors ${
                filterStatus === k
                  ? k === 'open'
                    ? 'bg-red-600 text-white shadow-sm'
                    : k === 'continue'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : k === 'selesai'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-lime-600 text-white shadow-sm'
                  : 'bg-white/5 text-zinc-300 hover:bg-white/10'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Input Pencarian & Kontrol Pilihan */}
        <div className="p-2.5 border-b border-white/10 bg-zinc-900 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={kueri}
                onChange={(e) => setKueri(e.target.value)}
                placeholder="Cari nomor (mis. 001), masalah, PIC, atau bidang..."
                className="input-retro !py-1 !pl-7 !text-[12px] w-full"
                autoFocus
              />
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            </div>

            {/* Tombol Checklist Semua / Batal */}
            {adaAksiTabel && tersaring.length > 0 && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={pilihSemuaTampil}
                  className="btn-retro btn-retro-sm !text-[11px] !py-1 !px-2 bg-zinc-800 text-zinc-300 hover:text-white"
                  title="Centang semua PICA yang tampil pada daftar"
                >
                  <CheckSquare size={12} />
                  <span>Pilih Semua</span>
                </button>
                {jumlahDipilih > 0 && (
                  <button
                    type="button"
                    onClick={batalSemua}
                    className="btn-retro btn-retro-sm !text-[11px] !py-1 !px-2 bg-zinc-800 text-zinc-400 hover:text-red-300"
                    title="Batal pilih semua centang"
                  >
                    Batal
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Baris Tombol Aksi Tabel Terfilter vs Terpilih */}
          {adaAksiTabel && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-[11px]">
              {/* Opsi 1: Jika ada PICA yang dicentang secara spesifik */}
              {jumlahDipilih > 0 ? (
                <div className="flex items-center gap-2 flex-wrap w-full bg-lime-950/40 p-1.5 border border-lime-500/30 rounded-xs">
                  <span className="font-bold text-lime-300 flex items-center gap-1">
                    <CheckSquare size={13} /> {jumlahDipilih} PICA Dicentang:
                  </span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => terapkanPilihan(true)}
                      className="btn-retro btn-retro-sm !bg-lime-500 hover:!bg-lime-400 !text-black font-bold flex items-center gap-1 text-[11px] py-1 px-2.5"
                      title="Tabel selalu update otomatis mengikuti perkembangan item-item ini"
                    >
                      <RefreshCw size={12} />
                      <span>{labelAksi} ({jumlahDipilih} Live Sync)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => terapkanPilihan(false)}
                      className="btn-retro btn-retro-sm !bg-amber-600 hover:!bg-amber-500 !text-black font-bold flex items-center gap-1 text-[11px] py-1 px-2.5"
                      title="Tetapkan sekarang sebagai snapshot statis (tidak berubah saat update)"
                    >
                      <Lock size={12} />
                      <span>{labelAksi} ({jumlahDipilih} Statis)</span>
                    </button>
                  </div>
                </div>
              ) : tersaring.length > 0 ? (
                /* Opsi 2: Berdasarkan filter tab status */
                <div className="flex items-center gap-2 flex-wrap w-full bg-zinc-950/40 p-1.5 border border-white/10 rounded-xs">
                  <span className="text-zinc-300 flex items-center gap-1">
                    <Table2 size={13} className="text-amber-400" />
                    <span>Filter: <strong className="text-white uppercase">{filterStatus}</strong> ({tersaring.length} PICA)</span>
                  </span>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => terapkanFilter(true)}
                      className="btn-retro btn-retro-sm !bg-lime-500 hover:!bg-lime-400 !text-black font-bold flex items-center gap-1 text-[11px] py-1 px-2.5 shadow-sm"
                      title="Menampilkan semua PICA yang cocok dan SELALU UPDATE OTOMATIS jika ada penambahan/perubahan status di database"
                    >
                      <RefreshCw size={12} />
                      <span>🟢 {labelAksi} (Live Sync — Selalu Update)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => terapkanFilter(false)}
                      className="btn-retro btn-retro-sm !bg-amber-600 hover:!bg-amber-500 !text-black font-bold flex items-center gap-1 text-[11px] py-1 px-2.5 shadow-sm"
                      title="Tetapkan data saat ini menjadi tabel statis (tidak akan berubah saat PICA terupdate)"
                    >
                      <Lock size={12} />
                      <span>🔒 {labelAksi} (Tetapkan / Statis)</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Daftar Item PICA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2.5 space-y-1.5 min-h-[180px] max-h-[50vh]">
          {memuat ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-400 gap-2">
              <Loader2 size={24} className="animate-spin text-amber-400" />
              <span className="text-[12px]">Memuat data PICA…</span>
            </div>
          ) : tersaring.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-[13px]">
              Tidak ada PICA yang cocok dengan filter status atau pencarian.
            </div>
          ) : (
            tersaring.map((p) => {
              const aktifTaut = p.id === terpilihId;
              const dicentang = pilihanIds.has(p.id);
              const kat = cekStatusKategori(p.status);
              const warnaBadge =
                kat === 'open'
                  ? 'border-red-400 text-red-300 bg-red-950/40'
                  : kat === 'continue'
                  ? 'border-amber-400 text-amber-200 bg-amber-950/40'
                  : 'border-emerald-400 text-emerald-200 bg-emerald-950/40';

              return (
                <div
                  key={p.id}
                  onClick={() => togglePilih(p.id)}
                  className={`p-2.5 border-2 rounded-xs transition-all flex items-start justify-between gap-3 cursor-pointer ${
                    dicentang
                      ? 'border-lime-400 bg-lime-950/30'
                      : aktifTaut
                      ? 'border-lime-500/70 bg-lime-950/15'
                      : 'border-white/10 hover:border-amber-400/80 bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  {/* Kotak Centang & Detail Konten */}
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePilih(p.id);
                      }}
                      className="mt-0.5 text-zinc-400 hover:text-lime-300 shrink-0"
                      aria-label="Pilih PICA"
                    >
                      {dicentang ? (
                        <CheckSquare size={17} className="text-lime-400" />
                      ) : (
                        <Square size={17} className="text-zinc-500" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-amber-300 text-[12px]">{nomorPica(p)}</span>
                        <span className={`px-1.5 py-0.2 border text-[10px] font-bold rounded-xs ${warnaBadge}`}>
                          {p.status}
                        </span>
                        {p.bidang && <span className="text-[11px] text-zinc-500">[{p.bidang}]</span>}
                      </div>
                      <p className="text-[13px] text-zinc-100 font-medium leading-snug break-words">{p.judul}</p>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-0.5 flex-wrap">
                        {p.pic_nama && (
                          <span className="flex items-center gap-1">
                            <User size={11} className="text-lime-400" />
                            <span>{p.pic_nama}</span>
                          </span>
                        )}
                        {p.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={11} className="text-zinc-500" />
                            <span>Tenggat: {W.formatPendek(p.due_date)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tombol Aksi per baris */}
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
                    {adaAksiTabel && (
                      <button
                        type="button"
                        onClick={() => sisipTabelSatu(p)}
                        className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-amber-600 hover:!text-black text-zinc-300 font-bold flex items-center gap-1 text-[11px] py-1 px-2"
                        title="Sisipkan rincian lengkap PICA ini sebagai tabel di memo"
                      >
                        <Table2 size={12} /> Rincian
                      </button>
                    )}
                    {onPilih && (
                      <button
                        type="button"
                        onClick={() => {
                          onPilih(p);
                          onTutup();
                        }}
                        className={`btn-retro btn-retro-sm ${
                          aktifTaut ? '!bg-lime-600 !text-white' : '!bg-white/10 hover:!bg-white/20 text-zinc-200'
                        } text-[11px] py-1 px-2`}
                        title="Tautkan referensi PICA ini"
                      >
                        {aktifTaut ? 'Terpilih' : 'Tautkan'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Modal */}
        <div className="flex items-center justify-between p-2.5 border-t border-white/10 bg-zinc-950">
          <div className="flex items-center gap-3 text-[12px] text-zinc-400">
            {jumlahDipilih > 0 && (
              <span className="text-lime-300 font-semibold">{jumlahDipilih} item dipilih</span>
            )}
            {onLepas && terpilihId && (
              <button
                type="button"
                onClick={() => {
                  onLepas();
                  onTutup();
                }}
                className="text-[12px] text-red-400 hover:underline"
              >
                Lepas Tautan PICA
              </button>
            )}
          </div>
          <button type="button" onClick={onTutup} className="btn-retro btn-retro-sm bg-zinc-800 text-zinc-300">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
