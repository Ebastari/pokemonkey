import React, { useMemo, useRef, useState } from 'react';
import { X, FileUp, FileDown, ArrowRight, Camera, Upload, Trash2, Loader2, AlertTriangle, Info, MapPin } from 'lucide-react';
import type { LaporanKarhutla } from '../lib/fire-report';
import { pembuatBawaan, ttdPembuat } from '../lib/fire-report';
import {
  DAFTAR_PENYEBAB, penyebabDari, teksPenyebab, isianAwal, periksaIsian, terapkanIsian,
  imporCsvForm, templateCsvForm, daftarKoordinat, type IsianFormLaporan, type KodePenyebab,
} from '../lib/form-laporan-fire';
import { kompresGambar } from '../lib/map-snapshot';
import { simpanBerkas } from '../lib/unduh';

/**
 * Langkah 1 laporan karhutla: form kronologi. Identitas izin & koordinat sudah
 * terisi dari titik terpilih; pemakai melengkapi waktu ground check, penyebab,
 * tindakan, dan foto — manual atau lewat impor CSV — lalu lanjut ke tinjauan.
 */

interface Props {
  laporan: LaporanKarhutla;
  /** true = laporan baru dari titik terpilih; false = laporan yang sudah ada dibuka lagi. */
  baru: boolean;
  notify: (pesan: string) => void;
  onBatal: () => void;
  onTinjau: (laporan: LaporanKarhutla) => void;
}

const jamWita = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t)
    ? '-'
    : new Date(t).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const Bagian: React.FC<{ judul: string; keterangan?: string; children: React.ReactNode }> = ({ judul, keterangan, children }) => (
  <section className="border-2 border-white/20 bg-black/40 p-3 space-y-2.5">
    <div>
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-orange-300">{judul}</h3>
      {keterangan && <p className="text-[11px] text-zinc-400 mt-0.5">{keterangan}</p>}
    </div>
    {children}
  </section>
);

const Label: React.FC<{ htmlFor: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="block text-[11px] font-bold uppercase text-zinc-300 mb-1">{children}</label>
);

export const FormLaporanFire: React.FC<Props> = ({ laporan, baru, notify, onBatal, onTinjau }) => {
  const pembuat = pembuatBawaan();
  const [isian, setIsian] = useState<IsianFormLaporan>(() => isianAwal(laporan, pembuat, baru));
  const [dokumentasi, setDokumentasi] = useState(laporan.dokumentasi);
  const [galat, setGalat] = useState<string[]>([]);
  const [galatCsv, setGalatCsv] = useState<string[]>([]);
  const [mengunggah, setMengunggah] = useState(false);
  const inputCsv = useRef<HTMLInputElement>(null);
  const inputFoto = useRef<HTMLInputElement>(null);
  const inputPeta = useRef<HTMLInputElement>(null);
  const atas = useRef<HTMLDivElement>(null);

  const ubah = <K extends keyof IsianFormLaporan>(k: K, v: IsianFormLaporan[K]) => setIsian((i) => ({ ...i, [k]: v }));

  const pilihPenyebab = (kode: KodePenyebab | '') => {
    const p = kode ? penyebabDari(kode) : undefined;
    if (!p) { ubah('penyebab', ''); return; }
    const t = teksPenyebab(p, laporan);
    setIsian((i) => ({ ...i, penyebab: p.kode, sumber: t.sumber, pengamatan: t.pengamatan, tindakan: t.tindakan, hasil: t.hasil, adaApi: p.kode === 'manual' ? i.adaApi : t.adaApi }));
  };

  const imporCsv = async (berkas: File | undefined) => {
    if (!berkas) return;
    const hasil = imporCsvForm(await berkas.text(), laporan);
    setGalatCsv(hasil.galat);
    if (hasil.terisi) {
      setIsian((i) => ({ ...i, ...hasil.isian }));
      notify(`FORM TERISI DARI CSV (${hasil.terisi} ISIAN)`);
    } else {
      notify('CSV TIDAK MENGISI APA PUN');
    }
  };

  const unduhTemplate = async () => {
    const blob = new Blob([templateCsvForm(pembuat)], { type: 'text/csv;charset=utf-8' });
    await simpanBerkas(blob, 'template-form-laporan-karhutla.csv', 'Template form laporan karhutla');
  };

  const unggah = async (files: FileList | null, jenis: 'foto' | 'peta') => {
    if (!files?.length) return;
    setMengunggah(true);
    try {
      const url: string[] = [];
      for (const f of Array.from(files)) url.push(await kompresGambar(f));
      setDokumentasi((d) =>
        jenis === 'peta'
          ? { ...d, petaSipongi: [...d.petaSipongi, ...url] }
          : { ...d, fotoLapangan: [...d.fotoLapangan, ...url.map((u, i) => ({ url: u, judul: `Foto ground check ${d.fotoLapangan.length + i + 1}`, kategori: 'umum' as const }))] },
      );
    } catch (e) {
      notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MENGUNGGAH');
    } finally {
      setMengunggah(false);
    }
  };

  const tinjau = () => {
    const daftar = periksaIsian(isian);
    setGalat(daftar);
    if (daftar.length) {
      atas.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    onTinjau(terapkanIsian({ ...laporan, dokumentasi }, isian));
  };

  const koordinatTeks = useMemo(() => daftarKoordinat(laporan), [laporan]);
  const adaTtd = Boolean(ttdPembuat(isian.dibuatOleh));

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 flex justify-center md:items-center md:p-4 no-print">
      <div className="retro-box !bg-zinc-900 border-orange-500 w-full max-w-3xl flex flex-col max-h-full md:max-h-[94vh] !p-0">
        {/* Kepala */}
        <div className="flex items-center gap-2 border-b-2 border-white/20 px-3 py-2.5">
          <div className="mr-auto min-w-0">
            <p className="text-[14px] font-bold text-white">Form laporan karhutla</p>
            <p className="text-[11px] text-orange-300 truncate">
              Langkah 1 dari 2 · isi kronologi, lalu tinjau sebelum export PDF
            </p>
          </div>
          <span className="chip-retro border-orange-400 text-orange-200 text-[10px] shrink-0">{laporan.jenisIzin}</span>
          <button type="button" onClick={onBatal} className="text-zinc-400 hover:text-white" aria-label="Tutup form">
            <X size={20} />
          </button>
        </div>

        {/* Isi */}
        <div ref={atas} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
          {galat.length > 0 && (
            <div className="border-2 border-red-500 bg-red-950/70 p-2.5 text-[12px] text-red-100">
              <p className="font-bold flex items-center gap-1.5 mb-1"><AlertTriangle size={13} /> Lengkapi dulu sebelum ditinjau</p>
              <ul className="list-disc pl-5 space-y-0.5">{galat.map((g) => <li key={g}>{g}</li>)}</ul>
            </div>
          )}

          <Bagian judul="Titik & identitas izin" keterangan="Terisi otomatis dari zona titik NASA yang dipilih; tidak perlu diisi.">
            <p className="text-[12px] text-zinc-200">
              <b className="text-white">{laporan.pemegangIzin}</b> · {laporan.jenisIzin} · {laporan.kabupaten}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse min-w-[420px]">
                <thead>
                  <tr className="text-zinc-400 uppercase text-[10px]">
                    <th className="text-left border-b border-white/20 py-1 pr-2">Titik</th>
                    <th className="text-left border-b border-white/20 py-1 pr-2">X (Bujur)</th>
                    <th className="text-left border-b border-white/20 py-1 pr-2">Y (Lintang)</th>
                    <th className="text-left border-b border-white/20 py-1 pr-2">Satelit</th>
                    <th className="text-left border-b border-white/20 py-1">Terdeteksi (WITA)</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-zinc-200">
                  {laporan.titikKoordinat.map((k) => (
                    <tr key={k.no}>
                      <td className="py-1 pr-2">{k.no}</td>
                      <td className="py-1 pr-2">{k.xBujur.toFixed(5).replace('.', ',')}</td>
                      <td className="py-1 pr-2">{k.yLintang.toFixed(5).replace('.', ',')}</td>
                      <td className="py-1 pr-2">{k.satelit}</td>
                      <td className="py-1">{jamWita(k.waktu)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Bagian>

          <Bagian judul="Isi otomatis dari CSV" keterangan="Satu baris judul kolom + satu baris isi, seperti impor PICA. Kolom teks yang kosong memakai kalimat bawaan penyebab.">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={unduhTemplate} className="btn-retro btn-retro-sm bg-zinc-800 text-white flex items-center gap-1.5">
                <FileDown size={13} /> Template CSV
              </button>
              <button type="button" onClick={() => inputCsv.current?.click()} className="btn-retro btn-retro-sm bg-emerald-700 text-white flex items-center gap-1.5">
                <FileUp size={13} /> Impor CSV
              </button>
              <input
                ref={inputCsv}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="hidden"
                onChange={(e) => { void imporCsv(e.target.files?.[0]); e.target.value = ''; }}
              />
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Kode penyebab: {DAFTAR_PENYEBAB.map((p) => <code key={p.kode} className="text-orange-200 mr-1.5">{p.kode}</code>)}
            </p>
            {galatCsv.length > 0 && (
              <ul className="text-[11px] text-amber-300 list-disc pl-5 space-y-0.5">{galatCsv.map((g) => <li key={g}>{g}</li>)}</ul>
            )}
          </Bagian>

          <Bagian judul="A. Deskripsi" keterangan="Terisi otomatis dari tanggal deteksi dan tingkat keyakinan satelit. Ubah bila perlu.">
            <textarea
              id="form-deskripsi"
              rows={4}
              value={isian.deskripsi}
              onChange={(e) => ubah('deskripsi', e.target.value)}
              className="input-retro w-full !text-[12px] leading-relaxed"
            />
          </Bagian>

          <Bagian judul="B. Kronologi kebakaran">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="form-tgl-cek">Tanggal ground check</Label>
                <input id="form-tgl-cek" type="date" value={isian.tanggalCek} onChange={(e) => ubah('tanggalCek', e.target.value)} className="input-retro w-full" />
              </div>
              <div>
                <Label htmlFor="form-jam-cek">Jam (WITA)</Label>
                <input id="form-jam-cek" type="time" value={isian.jamCek} onChange={(e) => ubah('jamCek', e.target.value)} className="input-retro w-full" />
              </div>
            </div>

            <div>
              <Label htmlFor="form-penyebab">Penyebab titik panas</Label>
              <select
                id="form-penyebab"
                value={isian.penyebab}
                onChange={(e) => pilihPenyebab(e.target.value as KodePenyebab | '')}
                className="input-retro w-full"
              >
                <option value="">— Pilih penyebab hasil ground check —</option>
                {DAFTAR_PENYEBAB.map((p) => <option key={p.kode} value={p.kode}>{p.label}</option>)}
              </select>
              <p className="text-[11px] text-zinc-400 mt-1 flex gap-1.5">
                <Info size={12} className="shrink-0 mt-0.5" />
                Memilih penyebab mengisi butir 1–4 dengan kalimat netral yang tidak menunjuk pihak mana pun. Semua kalimat tetap bisa diubah; pilih <b>Manual</b> untuk menulis sendiri.
              </p>
            </div>

            <div>
              <Label htmlFor="form-sumber">Butir 1 · Sumber titik panas</Label>
              <textarea id="form-sumber" rows={2} value={isian.sumber} onChange={(e) => ubah('sumber', e.target.value)} className="input-retro w-full !text-[12px]" placeholder="mis. timbunan batubara yang berada di dalam Area IPPKH …" />
              <p className="text-[11px] text-zinc-500 mt-1 flex gap-1.5">
                <MapPin size={12} className="shrink-0 mt-0.5" /> Dilanjutkan otomatis: “…, tepatnya pada koordinat {koordinatTeks}.”
              </p>
            </div>
            <div>
              <Label htmlFor="form-pengamatan">Butir 2 · Pengamatan visual & penyebab</Label>
              <textarea id="form-pengamatan" rows={5} value={isian.pengamatan} onChange={(e) => ubah('pengamatan', e.target.value)} className="input-retro w-full !text-[12px] leading-relaxed" />
            </div>
            <div>
              <Label htmlFor="form-tindakan">Butir 3 · Tindakan penanganan</Label>
              <textarea id="form-tindakan" rows={4} value={isian.tindakan} onChange={(e) => ubah('tindakan', e.target.value)} className="input-retro w-full !text-[12px] leading-relaxed" />
            </div>

            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase text-zinc-300">Butir 4 · Pemadaman & hasil verifikasi</p>
              <label className="flex items-center gap-2 text-[12px] text-zinc-200">
                <input type="checkbox" checked={isian.adaApi} onChange={(e) => ubah('adaApi', e.target.checked)} className="w-4 h-4" />
                Ada api atau bara yang dipadamkan
              </label>
              {isian.adaApi && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="form-tgl-padam">Tanggal dinyatakan padam</Label>
                    <input id="form-tgl-padam" type="date" value={isian.tanggalPadam} onChange={(e) => ubah('tanggalPadam', e.target.value)} className="input-retro w-full" />
                  </div>
                  <div>
                    <Label htmlFor="form-jam-padam">Jam padam (WITA)</Label>
                    <input id="form-jam-padam" type="time" value={isian.jamPadam} onChange={(e) => ubah('jamPadam', e.target.value)} className="input-retro w-full" />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="form-hasil">Hasil verifikasi akhir</Label>
                <textarea id="form-hasil" rows={3} value={isian.hasil} onChange={(e) => ubah('hasil', e.target.value)} className="input-retro w-full !text-[12px] leading-relaxed" />
              </div>
            </div>
          </Bagian>

          <Bagian judul="Dokumentasi" keterangan="Screenshot peta tampil di halaman 3, foto lapangan di halaman 4 laporan.">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => inputFoto.current?.click()} disabled={mengunggah} className="btn-retro btn-retro-sm bg-purple-700 text-white flex items-center gap-1.5 disabled:opacity-50">
                {mengunggah ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} Tambah foto lapangan
              </button>
              <button type="button" onClick={() => inputPeta.current?.click()} disabled={mengunggah} className="btn-retro btn-retro-sm bg-zinc-700 text-white flex items-center gap-1.5 disabled:opacity-50">
                <Upload size={13} /> Tambah screenshot peta
              </button>
              <input ref={inputFoto} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void unggah(e.target.files, 'foto'); e.target.value = ''; }} />
              <input ref={inputPeta} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void unggah(e.target.files, 'peta'); e.target.value = ''; }} />
            </div>
            {[
              { jenis: 'peta' as const, judul: 'Screenshot peta', daftar: dokumentasi.petaSipongi },
              { jenis: 'foto' as const, judul: 'Foto lapangan', daftar: dokumentasi.fotoLapangan.map((f) => f.url) },
            ].map(({ jenis, judul, daftar }) => (
              <div key={jenis}>
                <p className="text-[11px] text-zinc-400 mb-1">{judul} · {daftar.length}</p>
                {daftar.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 border border-dashed border-white/20 px-2 py-3 text-center">Belum ada</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {daftar.map((url, i) => (
                      <div key={i} className="relative border border-white/20 bg-black">
                        <img src={url} alt={`${judul} ${i + 1}`} className="block w-full aspect-square object-cover" />
                        <button
                          type="button"
                          onClick={() => setDokumentasi((d) => jenis === 'peta'
                            ? { ...d, petaSipongi: d.petaSipongi.filter((_, j) => j !== i) }
                            : { ...d, fotoLapangan: d.fotoLapangan.filter((_, j) => j !== i) })}
                          className="absolute top-1 right-1 bg-red-600 text-white p-1 border border-black"
                          aria-label={`Hapus ${judul.toLowerCase()} ${i + 1}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </Bagian>

          <Bagian judul="Dibuat oleh" keterangan="Tanda tangan otomatis dipasang untuk Agung Laksono. Nama lain tampil tanpa tanda tangan.">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <Label htmlFor="form-pembuat">Nama</Label>
                <input id="form-pembuat" type="text" value={isian.dibuatOleh} onChange={(e) => ubah('dibuatOleh', e.target.value)} className="input-retro w-full" />
              </div>
              <div>
                <Label htmlFor="form-jabatan">Jabatan</Label>
                <input id="form-jabatan" type="text" value={isian.jabatanPembuat} onChange={(e) => ubah('jabatanPembuat', e.target.value)} className="input-retro w-full" />
              </div>
            </div>
            <p className={`text-[11px] ${adaTtd ? 'text-emerald-300' : 'text-zinc-500'}`}>
              {adaTtd ? 'Tanda tangan akan dipasang.' : 'Tanpa tanda tangan.'}
            </p>
          </Bagian>
        </div>

        {/* Kaki */}
        <div className="flex items-center gap-2 border-t-2 border-white/20 px-3 py-2.5">
          <button type="button" onClick={onBatal} className="btn-retro bg-zinc-800 text-zinc-200 !py-1.5 text-[12px]">Batal</button>
          <button type="button" onClick={tinjau} className="btn-retro bg-orange-600 hover:bg-orange-500 text-white font-bold !py-1.5 text-[12px] ml-auto flex items-center gap-1.5">
            Tinjau laporan <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
