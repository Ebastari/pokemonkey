import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FolderOpen, Folder, FolderPlus, Upload, X, Loader2, ChevronRight, Users, Lock, FileText, FileSpreadsheet, Presentation, Pencil, Trash2,
  MoveRight, Search, ChevronDown, Plus,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Pengguna } from '../lib/tipe-api';
import { PenampilBerkas } from './PenampilBerkas';

/**
 * Folder Dokumen (di sidebar Memo, di atas Sampah): tempat dokumen kerja — PDF,
 * Word, Excel, PowerPoint, CSV, TXT — disimpan di server dan bisa dibaca tanpa
 * diunduh. Folder Tim untuk semua anggota; Folder Pribadi hanya pemiliknya.
 */

interface BarisFolder { id: string; nama: string; lingkup: string; user_id: string; induk_id: string | null; pembuat?: string | null }
interface BarisBerkas {
  id: string; folder_id: string | null; lingkup: string; user_id: string; nama: string; kunci: string; tipe: string | null;
  ukuran: number; dibuat_pada: string; pengunggah?: string | null;
}
interface DataFolder { folder: BarisFolder[]; berkas: BarisBerkas[]; boleh_folder: boolean; boleh_unggah: boolean }

const TERIMA = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.odt,.ods,.odp,.rtf,.md';
const ukuranTeks = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const ikonBerkas = (nama: string) => {
  const ext = (nama.split('.').pop() ?? '').toLowerCase();
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return <FileSpreadsheet size={18} className="text-emerald-300" />;
  if (['ppt', 'pptx', 'odp'].includes(ext)) return <Presentation size={18} className="text-orange-300" />;
  if (ext === 'pdf') return <FileText size={18} className="text-red-300" />;
  return <FileText size={18} className="text-sky-300" />;
};

/** Nama akar Folder Tim (seperti "Awan PT EBL" di gambar acuan pengguna). */
export const NAMA_AWAN = 'Awan PT EBL';

export interface ArahFolder { lingkup: 'tim' | 'pribadi'; folder: string | null }

export const FolderDokumen: React.FC<{
  pengguna: Pengguna; notify: (m: string) => void; onTutup: () => void;
  /** Folder yang langsung dibuka (dari pohon folder di sidebar). */
  awal?: ArahFolder;
  /** Isi folder berubah (unggah, folder baru, hapus): pohon di sidebar dimuat ulang. */
  onBerubah?: () => void;
}> = ({ pengguna, notify, onTutup, awal, onBerubah }) => {
  const [lingkup, setLingkup] = useState<'tim' | 'pribadi'>(awal?.lingkup ?? 'tim');
  const [data, setData] = useState<DataFolder | null>(null);
  const [folderAktif, setFolderAktif] = useState<string | null>(awal?.folder ?? null);
  const lingkupTerakhir = useRef(lingkup);
  const [mengunggah, setMengunggah] = useState(0);
  const [pratinjau, setPratinjau] = useState<BarisBerkas | null>(null);
  const [pindah, setPindah] = useState<BarisBerkas | null>(null);
  const [cari, setCari] = useState('');
  const berkasRef = useRef<HTMLInputElement>(null);
  const kelola = pengguna.peran === 'admin' || pengguna.peran === 'supervisor';

  const muat = useCallback(async () => {
    try { setData(await api<DataFolder>(`/api/folder?lingkup=${lingkup}`)); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMUAT FOLDER'); }
  }, [lingkup, notify]);
  useEffect(() => {
    setData(null);
    // Ganti Tim/Pribadi kembali ke akar; folder awal (dari pohon) tetap dipakai saat pertama dibuka.
    if (lingkupTerakhir.current !== lingkup) setFolderAktif(null);
    lingkupTerakhir.current = lingkup;
    void muat();
  }, [muat, lingkup]);
  const muatDanKabari = useCallback(() => { void muat(); onBerubah?.(); }, [muat, onBerubah]);

  const jalur = useMemo(() => {
    const hasil: BarisFolder[] = [];
    let x = folderAktif;
    for (let i = 0; x && i < 20; i += 1) {
      const f = data?.folder.find((y) => y.id === x);
      if (!f) break;
      hasil.unshift(f);
      x = f.induk_id;
    }
    return hasil;
  }, [folderAktif, data]);

  const q = cari.trim().toLowerCase();
  const subFolder = (data?.folder ?? []).filter((f) => (q ? f.nama.toLowerCase().includes(q) : (f.induk_id ?? null) === folderAktif));
  const isiBerkas = (data?.berkas ?? []).filter((b) => (q ? b.nama.toLowerCase().includes(q) : (b.folder_id ?? null) === folderAktif));

  const unggah = async (daftar: FileList) => {
    for (const f of Array.from(daftar)) {
      setMengunggah((n) => n + 1);
      try {
        const form = new FormData();
        form.append('berkas', f, f.name);
        form.append('lingkup', lingkup);
        if (folderAktif) form.append('folder_id', folderAktif);
        await api('/api/folder/unggah', { form });
        notify(`${f.name.toUpperCase()} DIUNGGAH`);
      } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : `GAGAL MENGUNGGAH ${f.name}`); }
      finally { setMengunggah((n) => n - 1); }
    }
    muatDanKabari();
  };
  const folderBaru = async () => {
    const nama = window.prompt('Nama folder baru:');
    if (!nama?.trim()) return;
    try { await api('/api/folder', { body: { nama, lingkup, induk_id: folderAktif } }); muatDanKabari(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT FOLDER'); }
  };
  const gantiNamaFolder = async (f: BarisFolder) => {
    const nama = window.prompt('Ganti nama folder:', f.nama);
    if (!nama?.trim() || nama === f.nama) return;
    try { await api(`/api/folder/${f.id}`, { method: 'PATCH', body: { nama } }); muatDanKabari(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };
  const hapusFolder = async (f: BarisFolder) => {
    if (!window.confirm(`Hapus folder "${f.nama}"? Folder harus kosong.`)) return;
    try { await api(`/api/folder/${f.id}`, { method: 'DELETE' }); muatDanKabari(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };
  const gantiNamaBerkas = async (b: BarisBerkas) => {
    const nama = window.prompt('Ganti nama dokumen:', b.nama);
    if (!nama?.trim() || nama === b.nama) return;
    try { await api(`/api/folder/berkas/${b.id}`, { method: 'PATCH', body: { nama } }); void muat(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };
  const hapusBerkas = async (b: BarisBerkas) => {
    if (!window.confirm(`Hapus dokumen "${b.nama}" dari server? Tidak bisa dipulihkan.`)) return;
    try { await api(`/api/folder/berkas/${b.id}`, { method: 'DELETE' }); notify('DOKUMEN DIHAPUS'); muatDanKabari(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };
  const pindahkan = async (b: BarisBerkas, folderId: string | null) => {
    try { await api(`/api/folder/berkas/${b.id}`, { method: 'PATCH', body: { folder_id: folderId } }); setPindah(null); void muat(); }
    catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
  };
  const bolehUbah = (b: BarisBerkas) => b.user_id === pengguna.id || (lingkup === 'tim' && kelola);

  return (
    <div className="fixed inset-0 z-[125] bg-black/85 flex items-center justify-center p-2 sm:p-4" onClick={onTutup}>
      <div className="retro-box !bg-zinc-950 border-4 !border-amber-500 w-full max-w-3xl max-h-[94vh] flex flex-col overflow-hidden !p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b-2 border-amber-500/40 pb-2 shrink-0">
          <div className="w-8 h-8 bg-amber-500 border-2 border-white flex items-center justify-center shrink-0"><FolderOpen size={17} className="text-black" /></div>
          <div className="mr-auto">
            <h2 className="font-title text-[13px] md:text-[15px] text-amber-200 leading-none">FOLDER DOKUMEN</h2>
            <p className="text-[10px] text-zinc-400 uppercase mt-0.5">PDF · Word · Excel · PowerPoint — tersimpan di server</p>
          </div>
          <button onClick={onTutup} className="btn-ikon bg-zinc-800 text-zinc-300" aria-label="Tutup"><X size={18} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 py-2 shrink-0">
          <button onClick={() => setLingkup('tim')} className={`btn-retro btn-retro-sm flex items-center gap-1.5 ${lingkup === 'tim' ? 'bg-amber-600 text-black' : 'bg-zinc-800'}`}><Users size={12} /> {NAMA_AWAN}</button>
          <button onClick={() => setLingkup('pribadi')} className={`btn-retro btn-retro-sm flex items-center gap-1.5 ${lingkup === 'pribadi' ? 'bg-amber-600 text-black' : 'bg-zinc-800'}`}><Lock size={12} /> Folder Pribadi</button>
          <div className="relative ml-auto">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari dokumen…" className="input-retro !pl-7 !py-1 !text-[12px] w-40" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 text-[13px] pb-2 shrink-0">
          <button onClick={() => setFolderAktif(null)} className="text-amber-200 hover:underline">{lingkup === 'tim' ? NAMA_AWAN : 'Pribadi'}</button>
          {jalur.map((f) => (
            <React.Fragment key={f.id}><ChevronRight size={12} className="text-zinc-600" /><button onClick={() => setFolderAktif(f.id)} className="text-amber-200 hover:underline">{f.nama}</button></React.Fragment>
          ))}
          <span className="ml-auto flex gap-1.5">
            {data?.boleh_folder && <button onClick={folderBaru} className="btn-retro btn-retro-sm bg-zinc-800 flex items-center gap-1"><FolderPlus size={12} /> Folder</button>}
            {data?.boleh_unggah && (
              <>
                <input ref={berkasRef} type="file" multiple accept={TERIMA} className="hidden" onChange={(e) => { if (e.target.files?.length) void unggah(e.target.files); e.target.value = ''; }} />
                <button onClick={() => berkasRef.current?.click()} disabled={mengunggah > 0} className="btn-retro btn-retro-sm bg-emerald-700 flex items-center gap-1">
                  {mengunggah > 0 ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Unggah dokumen
                </button>
              </>
            )}
          </span>
        </div>

        <div
          className="flex-1 overflow-auto custom-scrollbar border-2 border-white/10 bg-black/30"
          onDragOver={(e) => { if (data?.boleh_unggah) e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (data?.boleh_unggah && e.dataTransfer.files.length) void unggah(e.dataTransfer.files); }}
        >
          {!data && <p className="text-[13px] text-zinc-400 flex items-center gap-2 py-10 justify-center"><Loader2 size={14} className="animate-spin" /> Memuat…</p>}
          {data && subFolder.length === 0 && isiBerkas.length === 0 && (
            <div className="text-center py-12 text-zinc-400 text-[13px]">
              <FolderOpen size={40} className="mx-auto mb-2 opacity-40" />
              {q ? 'Tidak ada yang cocok.' : 'Folder ini masih kosong.'}
              {data.boleh_unggah && !q && <p className="text-[12px] mt-1">Tekan <b>Unggah dokumen</b> atau seret berkas ke sini.</p>}
            </div>
          )}
          <ul className="divide-y divide-white/5">
            {subFolder.map((f) => (
              <li key={f.id} className="group flex items-center gap-2 px-2.5 py-2 hover:bg-white/5">
                <button onClick={() => { setFolderAktif(f.id); setCari(''); }} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                  <Folder size={18} className="text-amber-300 fill-amber-300/30 shrink-0" />
                  <span className="text-[13px] font-bold text-white truncate">{f.nama}</span>
                  <span className="text-[11px] text-zinc-500">{(data?.berkas.filter((b) => b.folder_id === f.id).length ?? 0)} dokumen</span>
                </button>
                {data?.boleh_folder && (
                  <span className="flex gap-1 sm:opacity-0 group-hover:opacity-100">
                    <button onClick={() => gantiNamaFolder(f)} className="btn-ikon !w-7 !h-7 bg-zinc-800" title="Ganti nama"><Pencil size={12} /></button>
                    <button onClick={() => hapusFolder(f)} className="btn-ikon !w-7 !h-7 bg-zinc-800 text-red-300" title="Hapus folder"><Trash2 size={12} /></button>
                  </span>
                )}
              </li>
            ))}
            {isiBerkas.map((b) => (
              <li key={b.id} className="group flex items-center gap-2 px-2.5 py-2 hover:bg-white/5">
                <button onClick={() => setPratinjau(b)} className="flex items-center gap-2 flex-1 min-w-0 text-left" title="Buka tanpa mengunduh">
                  {ikonBerkas(b.nama)}
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block text-[13px] text-zinc-100 truncate">{b.nama}</span>
                    <span className="block text-[10px] text-zinc-500">{ukuranTeks(b.ukuran)} · {b.pengunggah ?? b.user_id} · {new Date(b.dibuat_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </span>
                </button>
                {bolehUbah(b) && (
                  <span className="flex gap-1 sm:opacity-0 group-hover:opacity-100">
                    <button onClick={() => gantiNamaBerkas(b)} className="btn-ikon !w-7 !h-7 bg-zinc-800" title="Ganti nama"><Pencil size={12} /></button>
                    {(data?.folder.length ?? 0) > 0 && <button onClick={() => setPindah(b)} className="btn-ikon !w-7 !h-7 bg-zinc-800" title="Pindahkan ke folder"><MoveRight size={12} /></button>}
                    <button onClick={() => hapusBerkas(b)} className="btn-ikon !w-7 !h-7 bg-zinc-800 text-red-300" title="Hapus"><Trash2 size={12} /></button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-[11px] text-zinc-500 pt-2 shrink-0 leading-snug">
          {lingkup === 'tim'
            ? 'Folder Tim: semua anggota bisa membaca. Anggota mengunggah dan mengatur dokumennya sendiri; Admin/Supervisor mengatur folder.'
            : 'Folder Pribadi: hanya Anda yang bisa melihat.'} Hanya dokumen (maks. 25 MB); foto & video simpan di memo.
        </p>
      </div>

      {pindah && data && (
        <div className="fixed inset-0 z-[130] bg-black/70 flex items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); setPindah(null); }}>
          <div className="retro-box !bg-zinc-900 border-amber-500 w-full max-w-sm !p-3" onClick={(e) => e.stopPropagation()}>
            <p className="judul-layar text-amber-200 mb-2">Pindahkan “{pindah.nama}”</p>
            <button onClick={() => pindahkan(pindah, null)} className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] hover:bg-white/10"><FolderOpen size={14} className="text-amber-300" /> (Akar {lingkup === 'tim' ? 'Folder Tim' : 'Folder Pribadi'})</button>
            {data.folder.map((f) => (
              <button key={f.id} onClick={() => pindahkan(pindah, f.id)} className="flex w-full items-center gap-2 px-2 py-1.5 text-[13px] hover:bg-white/10"><Folder size={14} className="text-amber-300" /> {f.nama}</button>
            ))}
          </div>
        </div>
      )}
      {pratinjau && <PenampilBerkas berkas={{ nama: pratinjau.nama, kunci: pratinjau.kunci, tipe: pratinjau.tipe }} onTutup={() => setPratinjau(null)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Pohon folder di sidebar Memo (seperti penjelajah folder: buka-lipat bertingkat)
// ---------------------------------------------------------------------------

const KUNCI_BUKA_FOLDER = 'pokemonkey_folder_buka';
const bacaBukaFolder = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(KUNCI_BUKA_FOLDER) || '["akar:tim"]') as string[]); } catch { return new Set(['akar:tim']); }
};

export const PohonFolder: React.FC<{
  pengguna: Pengguna; notify: (m: string) => void; muatUlang?: number;
  onBuka: (arah: ArahFolder) => void;
}> = ({ pengguna, notify, muatUlang = 0, onBuka }) => {
  const [data, setData] = useState<Record<'tim' | 'pribadi', DataFolder | null>>({ tim: null, pribadi: null });
  const [buka, setBuka] = useState<Set<string>>(bacaBukaFolder);
  const muat = useCallback(async () => {
    try {
      const [tim, pribadi] = await Promise.all([api<DataFolder>('/api/folder?lingkup=tim'), api<DataFolder>('/api/folder?lingkup=pribadi')]);
      setData({ tim, pribadi });
    } catch { /* tanpa sinyal: pohon kosong */ }
  }, []);
  useEffect(() => { void muat(); }, [muat, muatUlang]);
  const alih = (k: string) => {
    const b = new Set(buka);
    if (b.has(k)) b.delete(k); else b.add(k);
    setBuka(b);
    try { localStorage.setItem(KUNCI_BUKA_FOLDER, JSON.stringify([...b].slice(-200))); } catch { /* abaikan */ }
  };
  const folderBaru = async (lingkup: 'tim' | 'pribadi', induk: string | null) => {
    const nama = window.prompt('Nama folder baru:');
    if (!nama?.trim()) return;
    try {
      await api('/api/folder', { body: { nama, lingkup, induk_id: induk } });
      const b = new Set(buka); b.add(induk ? `f:${induk}` : `akar:${lingkup}`); setBuka(b);
      void muat();
    } catch (e) { notify(e instanceof Error ? e.message.toUpperCase() : 'GAGAL MEMBUAT FOLDER'); }
  };

  const Baris: React.FC<{ lingkup: 'tim' | 'pribadi'; f: BarisFolder | null; label: string; dalam: number }> = ({ lingkup, f, label, dalam }) => {
    const d = data[lingkup];
    const kunci = f ? `f:${f.id}` : `akar:${lingkup}`;
    const anak = (d?.folder ?? []).filter((x) => (x.induk_id ?? null) === (f?.id ?? null)).sort((a, b) => a.nama.localeCompare(b.nama, 'id', { numeric: true }));
    const jmlBerkas = (d?.berkas ?? []).filter((b) => (b.folder_id ?? null) === (f?.id ?? null)).length;
    const terbuka = buka.has(kunci);
    const bolehBuat = Boolean(d?.boleh_folder);
    return (
      <li>
        <div className="group/f flex items-center h-7 pr-1 hover:bg-white/5" style={{ paddingLeft: `${4 + dalam * 14}px` }}>
          <button type="button" onClick={() => alih(kunci)} className={`w-5 h-6 shrink-0 flex items-center justify-center ${anak.length ? 'text-zinc-400 hover:text-white' : 'text-transparent'}`} aria-label={terbuka ? 'Lipat folder' : 'Buka folder'} aria-expanded={terbuka} tabIndex={anak.length ? 0 : -1}>
            {terbuka ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
          <button type="button" onClick={() => onBuka({ lingkup, folder: f?.id ?? null })} className="flex-1 min-w-0 flex items-center gap-1.5 text-left text-[13px] text-zinc-200 h-7" title={`Buka ${label}`}>
            {terbuka && anak.length ? <FolderOpen size={15} className="text-amber-400 fill-amber-400/40 shrink-0" /> : <Folder size={15} className="text-amber-400 fill-amber-400/60 shrink-0" />}
            <span className="truncate">{label}</span>
            {jmlBerkas > 0 && <span className="text-[10px] text-zinc-500 shrink-0">{jmlBerkas}</span>}
          </button>
          {bolehBuat && (
            <button type="button" onClick={() => void folderBaru(lingkup, f?.id ?? null)} className="w-6 h-6 shrink-0 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 opacity-100 lg:opacity-0 lg:group-hover/f:opacity-100" title="Folder baru di dalamnya" aria-label={`Folder baru di ${label}`}>
              <Plus size={12} />
            </button>
          )}
        </div>
        {terbuka && anak.length > 0 && (
          <ul>{anak.map((x) => <Baris key={x.id} lingkup={lingkup} f={x} label={x.nama} dalam={dalam + 1} />)}</ul>
        )}
      </li>
    );
  };

  return (
    <ul className="text-[13px]" aria-label="Folder dokumen">
      <Baris lingkup="tim" f={null} label={NAMA_AWAN} dalam={0} />
      <Baris lingkup="pribadi" f={null} label={`Pribadi · ${pengguna.nama.split(' ')[0]}`} dalam={0} />
    </ul>
  );
};
