import React, { useCallback, useEffect, useState } from 'react';
import { Flame, X, Loader2, MapPin, RefreshCw, TriangleAlert, Send } from 'lucide-react';
import { api } from '../lib/api';
import { teksZona, waktuWita, namaSatelit, tautanPeta, type TitikApi } from '../server/src/titik-api-murni';

/**
 * Titik api (NASA FIRMS) di KEBUN: tombol di bawah chip cuaca, panel daftar titik
 * 7 hari terakhir, dan tombol hasil cek lapangan. Peringatan WA dikirim server,
 * bukan dari sini.
 */

interface DataTitikApi {
  terpasang: boolean;
  aktif: boolean;
  terakhir: string | null;
  galat: string | null;
  radius: { waspada: number; pantau: number };
  titik: (TitikApi & { dicek_nama?: string | null })[];
}

const ZONA_WASPADA = ['ippkh', 'iup', 'petak', 'waspada'];
type SaringArea = 'semua' | 'tambang' | 'das';
const aktifKah = (t: TitikApi) => t.status === 'baru' || t.status === 'dicek';

export function useTitikApi() {
  const [data, setData] = useState<DataTitikApi | null>(null);
  const muat = useCallback(() => {
    api<DataTitikApi>('/api/titik-api?hari=7').then(setData).catch(() => undefined);
  }, []);
  useEffect(() => {
    muat();
    const t = setInterval(muat, 15 * 60_000);
    return () => clearInterval(t);
  }, [muat]);
  return { data, muat };
}

/** Pemeriksaan otomatis tiap jam; lebih dari 3 jam tanpa pemeriksaan = datanya tidak bisa dipercaya. */
const BASI_MS = 3 * 3600_000;

/**
 * "Aman" hanya tampil bila data benar-benar ada, segar, dan tanpa galat. Tombol keselamatan
 * tidak boleh memberi rasa aman palsu saat kunci FIRMS belum dipasang atau pemeriksaan macet.
 */
function statusChip(data: DataTitikApi | null): { teks: string; nada: 'bahaya' | 'ragu' | 'aman'; label: string } {
  if (!data) return { teks: '…', nada: 'ragu', label: 'Status titik api belum termuat' };
  const bahaya = data.titik.filter((t) => aktifKah(t) && ZONA_WASPADA.includes(t.zona)).length;
  if (bahaya) return { teks: String(bahaya), nada: 'bahaya', label: `${bahaya} titik api perlu dicek` };
  if (!data.terpasang) return { teks: 'Belum aktif', nada: 'ragu', label: 'Pemantauan titik api belum aktif: kunci FIRMS belum dipasang' };
  if (!data.terakhir || Date.now() - Date.parse(data.terakhir) > BASI_MS) {
    return { teks: 'Data lama', nada: 'ragu', label: 'Pemeriksaan titik api terakhir lebih dari 3 jam lalu' };
  }
  if (data.galat) return { teks: 'Ada galat', nada: 'ragu', label: `Pemeriksaan titik api bermasalah: ${data.galat}` };
  return { teks: 'Aman', nada: 'aman', label: 'Titik api: tidak ada yang perlu dicek' };
}

export const ChipTitikApi: React.FC<{ data: DataTitikApi | null; onBuka: () => void }> = ({ data, onBuka }) => {
  const s = statusChip(data);
  const kotak = s.nada === 'bahaya' ? '!bg-red-700 !border-white animate-pulse'
    : s.nada === 'ragu' ? '!bg-amber-700 !border-white' : '!bg-black/70 !border-white/40';
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onBuka(); }}
      className={`absolute z-20 right-2 top-[58px] retro-box !p-1.5 !px-2 flex items-center gap-1.5 ${kotak}`}
      title={s.label}
      aria-label={s.label}
    >
      <Flame size={16} className={s.nada === 'aman' ? 'text-orange-300' : 'text-yellow-200'} />
      <span className={`font-title text-[10px] ${s.nada === 'aman' ? 'text-white' : 'teks-atas-warna'}`}>{s.teks}</span>
    </button>
  );
};

const LABEL_STATUS: Record<string, string> = { baru: 'Belum dicek', dicek: 'Sedang dicek', padam: 'Sudah padam', bukan_api: 'Bukan api' };

export const PanelTitikApi: React.FC<{
  data: DataTitikApi | null;
  admin: boolean;
  onMuatUlang: () => void;
  onTutup: () => void;
  notify?: (m: string) => void;
}> = ({ data, admin, onMuatUlang, onTutup, notify }) => {
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [saring, setSaring] = useState<SaringArea>('semua');

  const ubah = async (t: TitikApi, status: string) => {
    setSibuk(t.id);
    try {
      await api(`/api/titik-api/${encodeURIComponent(t.id)}`, { method: 'PATCH', body: { status } });
      onMuatUlang();
    } catch (e) { notify?.(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
    finally { setSibuk(null); }
  };

  const periksa = async () => {
    setSibuk('periksa');
    try {
      const h = await api<{ baru: number; diperingatkan: number; galat: string[] }>('/api/titik-api/periksa', { method: 'POST', body: {} });
      notify?.(h.galat.length ? h.galat[0].toUpperCase() : `${h.baru} TITIK BARU · ${h.diperingatkan} DIKIRIM KE WA`);
      onMuatUlang();
    } catch (e) { notify?.(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
    finally { setSibuk(null); }
  };

  const kirimRekap = async () => {
    setSibuk('rekap');
    try {
      await api('/api/titik-api/rekap-wa', { method: 'POST', body: {} });
      notify?.('REKAP 7 HARI TERKIRIM KE WA');
    } catch (e) { notify?.(e instanceof Error ? e.message.toUpperCase() : 'GAGAL'); }
    finally { setSibuk(null); }
  };

  const semuaTitik = data?.titik ?? [];
  const titik = saring === 'semua' ? semuaTitik : semuaTitik.filter((t) => (t.area ?? 'tambang') === saring);
  const hitung = (a: 'tambang' | 'das') => semuaTitik.filter((t) => (t.area ?? 'tambang') === a && aktifKah(t) && ZONA_WASPADA.includes(t.zona)).length;
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-end sm:items-center justify-center sm:p-4" onClick={(e) => { e.stopPropagation(); onTutup(); }}>
      <div className="retro-box !bg-zinc-900 border-red-500 w-full sm:max-w-xl max-h-[90vh] overflow-auto custom-scrollbar !p-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b-4 border-white pb-2 mb-3">
          <h2 className="judul-layar flex items-center gap-2 mr-auto"><Flame size={16} className="text-orange-400" /> Titik Api</h2>
          {admin && (
            <div className="flex gap-1.5">
              <button onClick={periksa} disabled={sibuk !== null || !data?.terpasang} className="btn-retro btn-retro-sm bg-zinc-700" title="Ambil data FIRMS 7 hari">
                {sibuk === 'periksa' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Periksa
              </button>
              <button onClick={kirimRekap} disabled={sibuk !== null || !data?.terpasang} className="btn-retro btn-retro-sm bg-emerald-700" title="Kirim rekap 7 hari ke WhatsApp">
                {sibuk === 'rekap' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Rekap WA
              </button>
            </div>
          )}
          <button onClick={onTutup} className="btn-ikon !w-8 !h-8 bg-zinc-800" aria-label="Tutup"><X size={16} /></button>
        </div>

        {data && !data.terpasang && (
          <p className="text-[12px] border-2 border-amber-500 bg-amber-950/40 px-2 py-1.5 mb-3">
            Kunci NASA FIRMS belum dipasang. Admin menjalankan "npx wrangler secret put FIRMS_MAP_KEY" dari folder server.
          </p>
        )}
        {data?.galat && data.terpasang && (
          <p className="text-[12px] border-2 border-amber-500 bg-amber-950/40 px-2 py-1.5 mb-3 flex gap-1.5"><TriangleAlert size={14} className="shrink-0 text-amber-300" /> {data.galat}</p>
        )}

        <p className="text-[12px] text-zinc-300 mb-3 leading-snug">
          7 hari terakhir, dua area: tambang (di dalam IPPKH, di dalam IUP) dan Rehab DAS (di dalam petak).
          Waspada ≤{data?.radius.waspada ?? 2} km, pantau ≤{data?.radius.pantau ?? 5} km dari batas masing-masing.
          Diperiksa otomatis tiap jam{data?.terakhir ? `, terakhir ${waktuWita(data.terakhir)}` : ''}.
        </p>

        <div className="flex gap-1.5 mb-3" role="group" aria-label="Saring area">
          {([['semua', 'Semua'], ['tambang', 'Area tambang'], ['das', 'Rehab DAS']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setSaring(k)} aria-pressed={saring === k} className={`btn-retro btn-retro-sm flex-1 ${saring === k ? 'bg-emerald-700' : 'bg-zinc-800'}`}>
              {label}{k !== 'semua' && hitung(k) > 0 ? ` · ${hitung(k)}` : ''}
            </button>
          ))}
        </div>

        {!data && <p className="text-[13px] text-zinc-300 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> memuat…</p>}
        {data && titik.length === 0 && <p className="text-[13px] text-emerald-300 border-2 border-dashed border-white/15 p-4 text-center">Tidak ada titik api di area ini dalam 7 hari terakhir.</p>}

        <div className="space-y-2">
          {titik.map((t) => {
            const bahaya = ZONA_WASPADA.includes(t.zona);
            return (
              <div key={t.id} className={`border-2 p-2 ${bahaya && aktifKah(t) ? 'border-red-500 bg-red-950/40' : 'border-white/15'}`}>
                <p className="text-[13px] font-bold">{teksZona(t)}</p>
                <p className="text-[11px] text-zinc-400">
                  {waktuWita(t.waktu)} · keyakinan {t.keyakinan} · {namaSatelit(t.sumber)}{t.frp ? ` · ${t.frp} MW` : ''}
                </p>
                <p className="text-[11px] mt-0.5">
                  <span className="text-zinc-300">{LABEL_STATUS[t.status] ?? t.status}</span>
                  {t.dicek_nama && <span className="text-zinc-500"> · {t.dicek_nama.split(' ')[0]}</span>}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <a href={tautanPeta(t)} target="_blank" rel="noreferrer" className="btn-retro btn-retro-sm bg-sky-700"><MapPin size={12} /> Peta</a>
                  {(['dicek', 'padam', 'bukan_api'] as const).map((s) => (
                    <button key={s} onClick={() => ubah(t, s)} disabled={sibuk !== null || t.status === s} className={`btn-retro btn-retro-sm ${t.status === s ? 'bg-emerald-700' : 'bg-zinc-700'}`}>
                      {sibuk === t.id ? <Loader2 size={12} className="animate-spin" /> : null}{LABEL_STATUS[s]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-zinc-500 mt-3">Sumber: NASA FIRMS (VIIRS & MODIS). Titik di dalam IUP bisa berupa swabakar batubara.</p>
      </div>
    </div>
  );
};
