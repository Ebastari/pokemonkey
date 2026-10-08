import React, { useEffect, useState } from 'react';
import {
  X, Save, FileText, Upload, Trash2, Download, AlertCircle, RefreshCw,
  FileSpreadsheet, ClipboardList, Send, Calendar, User, MapPin, Tag, Lock, Unlock,
} from 'lucide-react';
import {
  type ItemSurat,
  type KategoriSurat,
  type DokumenLampiran,
  KATEGORI_SURAT_INFO,
  generateNomorSuratOtomatis,
  hitungLamaHari,
} from '../lib/tipe-surat';
import { ModalBukaKunci } from './ModalBukaKunci';
import * as W from '../lib/waktu';

interface Props {
  initialData?: ItemSurat | null;
  daftarEksis: ItemSurat[];
  onSimpan: (item: ItemSurat, bukaDiMemoDinas?: boolean) => void;
  onTutup: () => void;
  notify: (pesan: string) => void;
}

export const FormNomorSuratModal: React.FC<Props> = ({
  initialData,
  daftarEksis,
  onSimpan,
  onTutup,
  notify,
}) => {
  const isEdit = Boolean(initialData?.id);
  const [terkunci, setTerkunci] = useState<boolean>(Boolean(initialData?.terkunci));
  const [bukaModalKunci, setBukaModalKunci] = useState<boolean>(false);
  const [kategori, setKategori] = useState<KategoriSurat>(initialData?.kategori ?? 'im');

  const [nomorSurat, setNomorSurat] = useState(initialData?.nomorSurat ?? '');
  const [nomorUrut, setNomorUrut] = useState<number | undefined>(initialData?.nomorUrut);
  const [namaSurat, setNamaSurat] = useState(initialData?.namaSurat ?? '');
  const [tanggal, setTanggal] = useState(initialData?.tanggal ?? W.hariIniWita());

  // Bidang IM
  const [namaYangDitugaskan, setNamaYangDitugaskan] = useState(initialData?.namaYangDitugaskan ?? '');
  const [tanggalMulai, setTanggalMulai] = useState(initialData?.tanggalMulai ?? W.hariIniWita());
  const [tanggalBerakhir, setTanggalBerakhir] = useState(initialData?.tanggalBerakhir ?? W.hariIniWita());
  const [lamaHari, setLamaHari] = useState<number | null>(initialData?.lamaHari ?? 1);
  const [tujuanDinas, setTujuanDinas] = useState(initialData?.tujuanDinas ?? '');
  const [keperluan, setKeperluan] = useState(initialData?.keperluan ?? '');
  const [namaPembuat, setNamaPembuat] = useState(initialData?.namaPembuat ?? '');

  // Bidang Surat Keluar & Berita Acara
  const [tujuanSurat, setTujuanSurat] = useState(initialData?.tujuanSurat ?? '');
  const [author, setAuthor] = useState(initialData?.author ?? '');

  // Bidang Kontrak
  const [sistemPelaksanaan, setSistemPelaksanaan] = useState(initialData?.sistemPelaksanaan ?? 'Vendor');
  const [pelaksana, setPelaksana] = useState(initialData?.pelaksana ?? '');
  const [keterangan, setKeterangan] = useState(initialData?.keterangan ?? '');

  // Dokumen Lampiran
  const [dokumenList, setDokumenList] = useState<DokumenLampiran[]>(initialData?.dokumen ?? []);
  const [memprosesUnggah, setMemprosesUnggah] = useState(false);

  // Jika mode baru dan belum ada nomor, otomatis generate
  useEffect(() => {
    if (!isEdit && !nomorSurat) {
      const gen = generateNomorSuratOtomatis(kategori, daftarEksis, tanggalMulai || tanggal);
      setNomorSurat(gen.nomorSurat);
      setNomorUrut(gen.nomorUrut);
    }
  }, [isEdit, kategori, daftarEksis, tanggalMulai, tanggal, nomorSurat]);

  // Otomatis hitung lama hari saat tanggal mulai/berakhir berubah
  useEffect(() => {
    if (kategori === 'im') {
      const durasi = hitungLamaHari(tanggalMulai, tanggalBerakhir);
      if (durasi !== null) {
        setLamaHari(durasi);
      }
    }
  }, [kategori, tanggalMulai, tanggalBerakhir]);

  const handleGantiKategori = (katBaru: KategoriSurat) => {
    setKategori(katBaru);
    if (!isEdit) {
      const gen = generateNomorSuratOtomatis(katBaru, daftarEksis, tanggalMulai || tanggal);
      setNomorSurat(gen.nomorSurat);
      setNomorUrut(gen.nomorUrut);
    }
  };

  const handleRegenerateNomor = () => {
    const tgl = kategori === 'im' ? (tanggalMulai || W.hariIniWita()) : (tanggal || W.hariIniWita());
    const gen = generateNomorSuratOtomatis(kategori, daftarEksis, tgl);
    setNomorSurat(gen.nomorSurat);
    setNomorUrut(gen.nomorUrut);
    notify('NOMOR SURAT DI-GENERATE ULANG');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setMemprosesUnggah(true);
    const pembacaPromises: Promise<DokumenLampiran>[] = Array.from(files).map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            id: `dok-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            nama: file.name,
            ukuran: file.size,
            tipe: file.type || file.name.split('.').pop() || 'dokumen',
            dataUrl: reader.result as string,
            diunggahPada: new Date().toISOString(),
          });
        };
        reader.onerror = () => {
          resolve({
            id: `dok-${Date.now()}`,
            nama: file.name,
            ukuran: file.size,
            tipe: file.type,
            diunggahPada: new Date().toISOString(),
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(pembacaPromises)
      .then((hasil) => {
        setDokumenList((prev) => [...prev, ...hasil]);
        notify(`${hasil.length} BERKAS LAMPIRAN BERHASIL DIUNGGAH`);
      })
      .catch(() => {
        notify('GAGAL MEMPROSES BERKAS');
      })
      .finally(() => {
        setMemprosesUnggah(false);
        e.target.value = '';
      });
  };

  const handleHapusDokumen = (id: string) => {
    setDokumenList((prev) => prev.filter((d) => d.id !== id));
    notify('BERKAS LAMPIRAN DIHAPUS');
  };

  const handleUnduhDokumen = (dok: DokumenLampiran) => {
    if (!dok.dataUrl) {
      notify('BERKAS TIDAK MEMILIKI DATA URL');
      return;
    }
    const a = document.createElement('a');
    a.href = dok.dataUrl;
    a.download = dok.nama;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatUkuran = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSimpan = (bukaDiMemoDinas = false) => {
    if (!nomorSurat.trim()) {
      notify('NOMOR SURAT WAJIB DIISI');
      return;
    }

    const item: ItemSurat = {
      id: initialData?.id || `surat-${Date.now()}`,
      kategori,
      nomorUrut: nomorUrut || initialData?.nomorUrut,
      nomorSurat: nomorSurat.trim(),
      namaSurat: (kategori === 'im' ? (keperluan || `Internal Memo Dinas - ${namaYangDitugaskan}`) : namaSurat).trim() || 'Tanpa judul',
      tanggal: kategori === 'im' ? tanggalMulai : tanggal,
      namaYangDitugaskan: namaYangDitugaskan.trim(),
      tanggalMulai: tanggalMulai || undefined,
      tanggalBerakhir: tanggalBerakhir || undefined,
      lamaHari: lamaHari,
      tujuanDinas: tujuanDinas.trim(),
      keperluan: keperluan.trim(),
      namaPembuat: namaPembuat.trim(),
      tujuanSurat: tujuanSurat.trim(),
      author: author.trim(),
      sistemPelaksanaan: sistemPelaksanaan.trim(),
      pelaksana: pelaksana.trim(),
      keterangan: keterangan.trim(),
      dokumen: dokumenList,
      internalMemoId: initialData?.internalMemoId,
      terkunci: true,
      dibuatPada: initialData?.dibuatPada || new Date().toISOString(),
      diubahPada: new Date().toISOString(),
    };

    onSimpan(item, bukaDiMemoDinas);
    notify('DATA NOMOR SURAT DISIMPAN & TERKUNCI (PASSWORD: eblhasnurajadeh)');
  };

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={onTutup}
    >
      <div
        className="retro-box !bg-zinc-900 border-lime-500 w-full sm:max-w-2xl max-h-[92vh] flex flex-col !p-0 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-white/15 bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-lime-500 border border-black flex items-center justify-center text-black font-bold">
              <FileText size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-title text-[14px] text-white">
                  {isEdit ? 'Ubah Data Nomor Surat' : 'Buat Nomor Surat Baru'}
                </h3>
                {terkunci && (
                  <span className="inline-flex items-center gap-1 text-[10px] bg-amber-950/80 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                    <Lock size={10} /> Terkunci
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400">
                Manajemen nomor surat internal &amp; eksternal Departemen RNR
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {terkunci && (
              <button
                type="button"
                onClick={() => setBukaModalKunci(true)}
                className="btn-retro btn-retro-sm !bg-amber-600 hover:!bg-amber-500 !text-white flex items-center gap-1 text-[11px] mr-1"
                title="Buka kunci dokumen dengan password"
              >
                <Unlock size={12} /> Buka Kunci
              </button>
            )}
            <button
              onClick={onTutup}
              className="text-zinc-400 hover:text-white transition-colors"
              title="Tutup (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Isi Formulir */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {terkunci && (
            <div className="bg-amber-500/10 border-2 border-amber-500 text-amber-200 px-3.5 py-2.5 rounded flex items-center justify-between gap-3 text-xs font-medium">
              <div className="flex items-center gap-2">
                <Lock size={15} className="text-amber-400 shrink-0" />
                <span>Data nomor surat ini telah disimpan dan terkunci. Buka kunci untuk melakukan penyuntingan.</span>
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

          <fieldset disabled={terkunci} className="contents space-y-4">
          {/* Pilihan Kategori */}
          <div>
            <label className="label-retro text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Tag size={13} className="text-lime-400" /> Kategori Surat
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(KATEGORI_SURAT_INFO) as KategoriSurat[]).map((katKey) => {
                const info = KATEGORI_SURAT_INFO[katKey];
                const dipilih = kategori === katKey;
                return (
                  <button
                    key={katKey}
                    type="button"
                    onClick={() => handleGantiKategori(katKey)}
                    className={`p-2 border-2 text-left flex flex-col gap-0.5 transition-all ${
                      dipilih
                        ? 'bg-lime-600 border-white text-white shadow-[2px_2px_0_#000]'
                        : 'bg-zinc-950 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    <span className="font-mono text-[10px] font-bold uppercase opacity-80">
                      {info.singkatan} · {info.lingkup}
                    </span>
                    <span className="text-[12px] font-bold leading-tight line-clamp-1">
                      {info.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nomor Surat & Generator Otomatis */}
          <div className="bg-zinc-950/80 border-2 border-zinc-700 p-3 space-y-2 rounded">
            <div className="flex items-center justify-between">
              <label className="label-retro !mb-0 text-lime-400 font-bold flex items-center gap-1.5">
                <span>Nomor Surat Resmi</span>
              </label>
              <button
                type="button"
                onClick={handleRegenerateNomor}
                className="btn-retro btn-retro-sm !bg-zinc-800 hover:!bg-zinc-700 !text-white !text-[10px] !py-1 flex items-center gap-1"
                title="Generate ulang nomor berikutnya"
              >
                <RefreshCw size={11} /> Generate Ulang
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={nomorSurat}
                onChange={(e) => setNomorSurat(e.target.value)}
                placeholder={KATEGORI_SURAT_INFO[kategori].formatContoh}
                className="input-retro font-mono font-bold text-amber-300 !text-[14px] flex-1"
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              Format baku:{' '}
              <code className="text-zinc-300 bg-zinc-800 px-1 py-0.5 rounded">
                {KATEGORI_SURAT_INFO[kategori].formatContoh}
              </code>
              . Nomor dibuat otomatis tapi dapat diedit bebas jika perlu penyesuaian khusus.
            </p>
          </div>

          {/* ================= FORM KHUSUS KATEGORI ================= */}

          {/* 1. INTERNAL MEMO (IM) */}
          {kategori === 'im' && (
            <div className="space-y-3 border-t border-zinc-800 pt-3">
              <h4 className="text-[12px] font-title text-amber-400 uppercase flex items-center gap-1.5">
                <FileSpreadsheet size={14} /> Data Internal Memo Perjalanan Dinas
              </h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label-retro">Nama Yang Ditugaskan</label>
                  <input
                    type="text"
                    value={namaYangDitugaskan}
                    onChange={(e) => setNamaYangDitugaskan(e.target.value)}
                    placeholder="mis. Agus Wiranto / Agung Laksono"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro">Tujuan Dinas</label>
                  <input
                    type="text"
                    value={tujuanDinas}
                    onChange={(e) => setTujuanDinas(e.target.value)}
                    placeholder="mis. Banjar Baru / Rantau"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro">Mulai Tanggal</label>
                  <input
                    type="date"
                    value={tanggalMulai}
                    onChange={(e) => setTanggalMulai(e.target.value)}
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro">Berakhir Tanggal</label>
                  <input
                    type="date"
                    value={tanggalBerakhir}
                    onChange={(e) => setTanggalBerakhir(e.target.value)}
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro">Lama Hari (Hari)</label>
                  <input
                    type="number"
                    value={lamaHari ?? ''}
                    onChange={(e) => setLamaHari(e.target.value ? Number(e.target.value) : null)}
                    placeholder="1"
                    className="input-retro font-mono"
                  />
                </div>
                <div>
                  <label className="label-retro">Nama Pembuat / Author</label>
                  <input
                    type="text"
                    value={namaPembuat}
                    onChange={(e) => setNamaPembuat(e.target.value)}
                    placeholder="mis. Jembar / Mariano"
                    className="input-retro"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-retro">Keperluan Dinas / Rincian Tugas</label>
                  <textarea
                    rows={2}
                    value={keperluan}
                    onChange={(e) => setKeperluan(e.target.value)}
                    placeholder="mis. Survai Rumput Odot dan Koordinasi BPDAS"
                    className="input-retro resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2. SURAT KELUAR */}
          {kategori === 'surat_keluar' && (
            <div className="space-y-3 border-t border-zinc-800 pt-3">
              <h4 className="text-[12px] font-title text-blue-400 uppercase flex items-center gap-1.5">
                <Send size={14} /> Data Surat Keluar (Eksternal)
              </h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="label-retro">Nama Surat / Perihal</label>
                  <input
                    type="text"
                    value={namaSurat}
                    onChange={(e) => setNamaSurat(e.target.value)}
                    placeholder="mis. Surat Pengantar Laporan DAS Mei 2026"
                    className="input-retro font-bold"
                  />
                </div>
                <div>
                  <label className="label-retro">Tanggal Surat</label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro">Author / Pembuat</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="mis. Jembar / Mariano"
                    className="input-retro"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-retro">Tujuan Surat (Pihak Penerima)</label>
                  <input
                    type="text"
                    value={tujuanSurat}
                    onChange={(e) => setTujuanSurat(e.target.value)}
                    placeholder="mis. BPDAS, Dishut, KPH"
                    className="input-retro"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. KONTRAK PEKERJAAN */}
          {kategori === 'kontrak' && (
            <div className="space-y-3 border-t border-zinc-800 pt-3">
              <h4 className="text-[12px] font-title text-emerald-400 uppercase flex items-center gap-1.5">
                <ClipboardList size={14} /> Data Kontrak Pekerjaan
              </h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="label-retro">Nama Kontrak / Pekerjaan</label>
                  <input
                    type="text"
                    value={namaSurat}
                    onChange={(e) => setNamaSurat(e.target.value)}
                    placeholder="mis. Kontrak Jasa Reklamasi (Penanaman LCC)"
                    className="input-retro font-bold"
                  />
                </div>
                <div>
                  <label className="label-retro">Tanggal Kontrak</label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro">Sistem Pelaksanaan</label>
                  <select
                    value={sistemPelaksanaan}
                    onChange={(e) => setSistemPelaksanaan(e.target.value)}
                    className="input-retro !py-1.5"
                  >
                    <option value="Vendor">Vendor</option>
                    <option value="Swakelola">Swakelola</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="label-retro">Pelaksana (Vendor / Personil)</label>
                  <input
                    type="text"
                    value={pelaksana}
                    onChange={(e) => setPelaksana(e.target.value)}
                    placeholder="mis. CV KBS"
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro">Keterangan / PIC</label>
                  <input
                    type="text"
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="mis. Agung"
                    className="input-retro"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. BERITA ACARA */}
          {kategori === 'berita_acara' && (
            <div className="space-y-3 border-t border-zinc-800 pt-3">
              <h4 className="text-[12px] font-title text-purple-400 uppercase flex items-center gap-1.5">
                <FileText size={14} /> Data Berita Acara (BA)
              </h4>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="label-retro">Nama Berita Acara</label>
                  <input
                    type="text"
                    value={namaSurat}
                    onChange={(e) => setNamaSurat(e.target.value)}
                    placeholder="mis. Berita Acara Pemeriksaan Pekerjaan Rehab DAS"
                    className="input-retro font-bold"
                  />
                </div>
                <div>
                  <label className="label-retro">Tanggal Berita Acara</label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="input-retro"
                  />
                </div>
                <div>
                  <label className="label-retro">Pembuat / PIC</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="mis. Mariano / Jembar"
                    className="input-retro"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label-retro">Tujuan / Pihak Terkait</label>
                  <input
                    type="text"
                    value={tujuanSurat}
                    onChange={(e) => setTujuanSurat(e.target.value)}
                    placeholder="mis. Dishut, KPH, dan BPDAS"
                    className="input-retro"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ================= UPLOAD DOKUMEN LAMPIRAN (OPSIONAL) ================= */}
          <div className="border-t-2 border-dashed border-zinc-700 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="label-retro !mb-0 text-amber-300 font-bold flex items-center gap-1.5">
                <Upload size={13} /> Dokumen Lampiran
                <span className="text-[10px] text-zinc-400 font-normal ml-1">
                  (Opsional · Bukan Syarat Wajib)
                </span>
              </label>
              <span className="text-[11px] text-zinc-400 font-mono">
                {dokumenList.length} berkas terlampir
              </span>
            </div>

            {/* Input Berkas */}
            <div className="relative border-2 border-dashed border-zinc-700 hover:border-lime-500/80 transition-colors rounded p-3 text-center bg-zinc-950/40">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={memprosesUnggah}
              />
              <div className="flex flex-col items-center justify-center gap-1 text-zinc-400">
                <Upload size={20} className="text-zinc-500" />
                <p className="text-[12px] font-bold text-zinc-300">
                  {memprosesUnggah ? 'Sedang memproses berkas…' : 'Klik atau seret dokumen ke sini untuk mengunggah'}
                </p>
                <p className="text-[10px] text-zinc-500">
                  Mendukung PDF, Word (.docx), Excel (.xlsx), atau Gambar (PNG/JPG)
                </p>
              </div>
            </div>

            {/* Daftar Berkas Terlampir */}
            {dokumenList.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {dokumenList.map((dok) => (
                  <div
                    key={dok.id}
                    className="flex items-center justify-between p-2 bg-zinc-950 border border-zinc-700 rounded text-[12px]"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <FileText size={15} className="text-lime-400 shrink-0" />
                      <span className="font-bold text-zinc-200 truncate">{dok.nama}</span>
                      <span className="text-[10px] text-zinc-500 shrink-0 font-mono">
                        ({formatUkuran(dok.ukuran)})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {dok.dataUrl && (
                        <button
                          type="button"
                          onClick={() => handleUnduhDokumen(dok)}
                          className="btn-ikon !w-7 !h-7 bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-600"
                          title="Unduh / Pratinjau Dokumen"
                        >
                          <Download size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleHapusDokumen(dok.id)}
                        className="btn-ikon !w-7 !h-7 !bg-red-700 text-white hover:!bg-red-600 border border-red-400"
                        title="Hapus Lampiran"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </fieldset>
        </div>

        {/* Footer Aksi Modal */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t-2 border-white/15 bg-zinc-950 shrink-0">
          <button
            type="button"
            onClick={onTutup}
            className="btn-retro btn-retro-sm bg-zinc-800 hover:bg-zinc-700 text-white"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            {terkunci ? (
              <button
                type="button"
                onClick={() => setBukaModalKunci(true)}
                className="btn-retro btn-retro-sm bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
              >
                <Unlock size={13} /> Buka Kunci Dokumen
              </button>
            ) : (
              <>
                {kategori === 'im' && (
                  <button
                    type="button"
                    onClick={() => handleSimpan(true)}
                    className="btn-retro btn-retro-sm bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
                    title="Simpan nomor dan langsung buka di form cetak A4 Internal Memo Dinas"
                  >
                    <FileSpreadsheet size={13} /> Simpan &amp; Buat Memo Dinas
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleSimpan(false)}
                  className="btn-retro btn-retro-sm bg-lime-600 hover:bg-lime-500 text-white font-bold flex items-center gap-1.5 shadow-[2px_2px_0_#000]"
                >
                  <Save size={13} /> Simpan Nomor Surat
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {bukaModalKunci && (
        <ModalBukaKunci
          namaDokumen={`Nomor Surat ${nomorSurat || ''}`}
          onSukses={() => {
            setBukaModalKunci(false);
            setTerkunci(false);
          }}
          onBatal={() => setBukaModalKunci(false)}
          notify={notify}
        />
      )}
    </div>
  );
};
