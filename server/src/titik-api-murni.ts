/**
 * Titik api (hotspot) — bagian murni, dipakai Worker, mode demo, dan peta di aplikasi.
 *
 * Sumber data: NASA FIRMS Area API (CSV), satelit VIIRS & MODIS.
 * Zona dihitung terhadap batas IUP/IPPKH PT EBL (area-ebl.ts):
 *   ippkh   — di dalam PPKH/IPPKH (kawasan hutan) → prioritas tertinggi
 *   iup     — di dalam IUP; bisa kebakaran, bisa swabakar batubara di pit/stockpile
 *   waspada — di luar IUP, ≤ radius waspada (bawaan 2 km) dari batasnya
 *   pantau  — di luar IUP, ≤ radius pantau (bawaan 5 km); dicatat, tidak dikirim ke WA
 *   luar    — lebih jauh; dibuang
 *
 * Area kedua, Rehabilitasi DAS (area-das.ts, ±69 km barat daya): zona petak (di dalam
 * petak tanam), waspada & pantau diukur dari petak terdekat. Kolom area = 'tambang' | 'das'.
 */

import { AREA_EBL, type BidangArea } from './area-ebl';
import { AREA_DAS } from './area-das';

export type Zona = 'ippkh' | 'iup' | 'petak' | 'waspada' | 'pantau' | 'luar';
export type AreaTitik = 'tambang' | 'das';
export type Keyakinan = 'rendah' | 'sedang' | 'tinggi';

export const SUMBER_FIRMS = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'] as const;

export interface TitikFirms {
  id: string;
  sumber: string;
  lat: number;
  lon: number;
  /** Waktu deteksi satelit, ISO UTC. */
  waktu: string;
  keyakinan: Keyakinan;
  /** Fire Radiative Power, MW. */
  frp: number | null;
}

export interface TitikApi extends TitikFirms {
  /** 'tambang' = IUP/IPPKH · 'das' = petak Rehabilitasi DAS. */
  area?: AreaTitik;
  zona: Exclude<Zona, 'luar'>;
  /** Jarak ke batas IUP dalam km (0 bila di dalam). */
  jarak_km: number;
  /** Nama bidang IPPKH yang memuatnya (SK.966, …) bila zona ippkh; nama petak terdekat bila area das. */
  bidang: string | null;
  status: 'baru' | 'dicek' | 'padam' | 'bukan_api';
  catatan?: string | null;
  dicek_oleh?: string | null;
  dicek_pada?: string | null;
  pica_id?: string | null;
  diperingatkan?: number;
}

export interface RadiusZona { waspada: number; pantau: number }
export const RADIUS_BAWAAN: RadiusZona = { waspada: 2, pantau: 5 };

// ---------------------------------------------------------------------------
// Geometri (proyeksi datar lokal; galat < 0,1% untuk jarak beberapa km di dekat khatulistiwa)
// ---------------------------------------------------------------------------

const KM_PER_DERAJAT_LAT = 110.574;
const kmPerDerajatLon = (lat: number) => 111.32 * Math.cos((lat * Math.PI) / 180);

function dalamCincin(lon: number, lat: number, cincin: [number, number][]): boolean {
  let dalam = false;
  for (let i = 0, j = cincin.length - 1; i < cincin.length; j = i++) {
    const [xi, yi] = cincin[i];
    const [xj, yj] = cincin[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dalam = !dalam;
  }
  return dalam;
}

export function dalamBidang(lon: number, lat: number, b: BidangArea): boolean {
  return b.poligon.some(([luar, ...lubang]) => dalamCincin(lon, lat, luar) && !lubang.some((h) => dalamCincin(lon, lat, h)));
}

/** Jarak titik ke tepi bidang (km); 0 bila di dalam. */
export function jarakKeBidangKm(lon: number, lat: number, b: BidangArea): number {
  if (dalamBidang(lon, lat, b)) return 0;
  const kx = kmPerDerajatLon(lat);
  const px = lon * kx;
  const py = lat * KM_PER_DERAJAT_LAT;
  let min = Infinity;
  for (const poli of b.poligon) {
    for (const cincin of poli) {
      for (let i = 0; i < cincin.length - 1; i++) {
        const ax = cincin[i][0] * kx, ay = cincin[i][1] * KM_PER_DERAJAT_LAT;
        const bx = cincin[i + 1][0] * kx, by = cincin[i + 1][1] * KM_PER_DERAJAT_LAT;
        const dx = bx - ax, dy = by - ay;
        const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
        min = Math.min(min, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
      }
    }
  }
  return min;
}

export function jarakAntarKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const kx = kmPerDerajatLon((a.lat + b.lat) / 2);
  return Math.hypot((a.lon - b.lon) * kx, (a.lat - b.lat) * KM_PER_DERAJAT_LAT);
}

/** Kotak [barat, selatan, timur, utara] yang memuat IUP + penyangga (km), untuk permintaan FIRMS. */
export function kotakPantau(penyanggaKm: number): [number, number, number, number] {
  const xs: number[] = [];
  const ys: number[] = [];
  // Satu kotak untuk kedua area (tambang + rehab DAS): jumlah permintaan FIRMS tidak bertambah;
  // titik di antara keduanya berzona 'luar' dan dibuang.
  for (const b of [...AREA_EBL.iup, ...AREA_EBL.ippkh, ...AREA_DAS]) {
    for (const poli of b.poligon) for (const c of poli[0]) { xs.push(c[0]); ys.push(c[1]); }
  }
  const tengahLat = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dLon = penyanggaKm / kmPerDerajatLon(tengahLat);
  const dLat = penyanggaKm / KM_PER_DERAJAT_LAT;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return [r(Math.min(...xs) - dLon), r(Math.min(...ys) - dLat), r(Math.max(...xs) + dLon), r(Math.max(...ys) + dLat)];
}

export function tentukanZona(lon: number, lat: number, radius: RadiusZona): { zona: Zona; jarak_km: number; bidang: string | null } {
  const ippkh = AREA_EBL.ippkh.find((b) => dalamBidang(lon, lat, b));
  const jarak = Math.min(...AREA_EBL.iup.map((b) => jarakKeBidangKm(lon, lat, b)));
  const jarak_km = Math.round(jarak * 100) / 100;
  if (ippkh) return { zona: 'ippkh', jarak_km: 0, bidang: ippkh.nama };
  if (jarak === 0) return { zona: 'iup', jarak_km: 0, bidang: null };
  if (jarak <= radius.waspada) return { zona: 'waspada', jarak_km, bidang: null };
  if (jarak <= radius.pantau) return { zona: 'pantau', jarak_km, bidang: null };
  return { zona: 'luar', jarak_km, bidang: null };
}

/** Zona di area tambang dulu; bila di luar, cek petak Rehabilitasi DAS. */
export function tentukanZonaArea(
  lon: number, lat: number, radius: RadiusZona,
): { area: AreaTitik; zona: Zona; jarak_km: number; bidang: string | null } {
  const tambang = tentukanZona(lon, lat, radius);
  if (tambang.zona !== 'luar') return { area: 'tambang', ...tambang };

  let terdekat: { nama: string; jarak: number } | null = null;
  for (const b of AREA_DAS) {
    const jarak = jarakKeBidangKm(lon, lat, b);
    if (!terdekat || jarak < terdekat.jarak) terdekat = { nama: b.nama, jarak };
    if (jarak === 0) break;
  }
  if (!terdekat) return { area: 'tambang', ...tambang };
  const jarak_km = Math.round(terdekat.jarak * 100) / 100;
  if (terdekat.jarak === 0) return { area: 'das', zona: 'petak', jarak_km: 0, bidang: terdekat.nama };
  if (terdekat.jarak <= radius.waspada) return { area: 'das', zona: 'waspada', jarak_km, bidang: terdekat.nama };
  if (terdekat.jarak <= radius.pantau) return { area: 'das', zona: 'pantau', jarak_km, bidang: terdekat.nama };
  return { area: 'das', zona: 'luar', jarak_km, bidang: terdekat.nama };
}

// ---------------------------------------------------------------------------
// CSV FIRMS
// ---------------------------------------------------------------------------

function keyakinanDari(sumber: string, nilai: string): Keyakinan {
  const v = nilai.trim().toLowerCase();
  if (sumber.startsWith('MODIS')) {
    const n = Number(v);
    return n >= 80 ? 'tinggi' : n >= 30 ? 'sedang' : 'rendah';
  }
  if (v.startsWith('h')) return 'tinggi';
  if (v.startsWith('l')) return 'rendah';
  return 'sedang';
}

/** Urai CSV Area API FIRMS (kolom VIIRS maupun MODIS dikenali dari judulnya). */
export function uraiCsvFirms(csv: string, sumber: string): TitikFirms[] {
  const baris = csv.trim().split(/\r?\n/);
  if (baris.length < 2) return [];
  const kolom = baris[0].split(',').map((k) => k.trim().toLowerCase());
  const ke = (nama: string) => kolom.indexOf(nama);
  const [iLat, iLon, iTgl, iJam, iConf, iFrp] = ['latitude', 'longitude', 'acq_date', 'acq_time', 'confidence', 'frp'].map(ke);
  if (iLat < 0 || iLon < 0 || iTgl < 0 || iJam < 0) return [];

  return baris.slice(1).flatMap((b) => {
    const s = b.split(',');
    const lat = Number(s[iLat]);
    const lon = Number(s[iLon]);
    const jam = String(s[iJam] ?? '').trim().padStart(4, '0');
    const tgl = String(s[iTgl] ?? '').trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return [];
    const waktu = `${tgl}T${jam.slice(0, 2)}:${jam.slice(2, 4)}:00Z`;
    return [{
      id: `${sumber}|${lat.toFixed(4)}|${lon.toFixed(4)}|${tgl}|${jam}`,
      sumber,
      lat,
      lon,
      waktu,
      keyakinan: keyakinanDari(sumber, iConf >= 0 ? String(s[iConf] ?? '') : ''),
      frp: iFrp >= 0 && s[iFrp] !== '' ? Number(s[iFrp]) : null,
    }];
  });
}

// ---------------------------------------------------------------------------
// Aturan peringatan: hanya titik baru, sekali saja
// ---------------------------------------------------------------------------

/** Zona yang dikirim ke grup WA. Zona pantau hanya dicatat. */
export const ZONA_PERINGATAN: Zona[] = ['ippkh', 'iup', 'petak', 'waspada'];
/** Titik baru yang ≤ 1 km dari titik yang sudah diperingatkan dalam 24 jam dianggap api yang sama. */
export const JARAK_SAMA_KM = 1;
export const JENDELA_SAMA_MS = 24 * 3600_000;

/** Pilih titik baru yang layak diperingatkan: zona peringatan dan bukan api yang sudah diberitahukan. */
export function pilihUntukPeringatan(
  baru: TitikApi[],
  sudahDiperingatkan: { lat: number; lon: number; waktu: string }[],
): TitikApi[] {
  const acuan = [...sudahDiperingatkan];
  const pilih: TitikApi[] = [];
  for (const t of [...baru].sort((a, b) => a.waktu.localeCompare(b.waktu))) {
    if (!ZONA_PERINGATAN.includes(t.zona)) continue;
    const kembar = acuan.some((a) =>
      Math.abs(Date.parse(a.waktu) - Date.parse(t.waktu)) <= JENDELA_SAMA_MS && jarakAntarKm(a, t) <= JARAK_SAMA_KM);
    if (kembar) continue;
    pilih.push(t);
    acuan.push(t);
  }
  return pilih;
}

// ---------------------------------------------------------------------------
// Kalimat
// ---------------------------------------------------------------------------

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function waktuWita(iso: string): string {
  const d = new Date(Date.parse(iso) + 480 * 60_000);
  const jam = `${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return `${HARI[d.getUTCDay()]} ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}, ${jam} WITA`;
}

export function namaSatelit(sumber: string): string {
  if (sumber.includes('SNPP')) return 'VIIRS S-NPP';
  if (sumber.includes('NOAA20')) return 'VIIRS NOAA-20';
  if (sumber.includes('NOAA21')) return 'VIIRS NOAA-21';
  if (sumber.startsWith('MODIS')) return 'MODIS';
  return sumber;
}

const km = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });

export function teksZona(t: Pick<TitikApi, 'zona' | 'jarak_km' | 'bidang' | 'area'>): string {
  if (t.area === 'das') {
    const petak = t.bidang ?? 'petak terdekat';
    if (t.zona === 'petak') return `Di dalam ${petak} (Rehab DAS)`;
    return `${t.zona === 'waspada' ? 'Waspada' : 'Pantau'}, ${km(t.jarak_km)} km dari ${petak} (Rehab DAS)`;
  }
  if (t.zona === 'ippkh') return `Di dalam IPPKH${t.bidang ? ` (${t.bidang})` : ''}`;
  if (t.zona === 'iup') return 'Di dalam IUP';
  if (t.zona === 'waspada') return `Waspada, ${km(t.jarak_km)} km dari batas IUP`;
  return `Pantau, ${km(t.jarak_km)} km dari batas IUP`;
}

export const tautanPeta = (t: { lat: number; lon: number }) =>
  `https://maps.google.com/?q=${t.lat.toFixed(5)},${t.lon.toFixed(5)}`;

export interface RingkasanRiwayat7Hari {
  total: number;
  ippkh: number;
  iup: number;
  waspada: number;
  pantau?: number;
  belum_dicek: number;
  sedang_dicek: number;
  padam: number;
  bukan_api: number;
}

/** Pesan grup WA untuk titik api baru (sudah disaring pilihUntukPeringatan) + riwayat 7 hari. */
export function susunPeringatanTitikApi(
  titik: TitikApi[],
  sekarangIso: string,
  riwayat?: RingkasanRiwayat7Hari | null,
): string {
  const hitung = (z: Zona) => titik.filter((t) => t.zona === z).length;
  const ringkas = [
    hitung('ippkh') && `• ${hitung('ippkh')} di dalam IPPKH (kawasan hutan)`,
    hitung('iup') && `• ${hitung('iup')} di dalam IUP`,
    hitung('waspada') && `• ${hitung('waspada')} waspada (dekat batas IUP)`,
  ].filter(Boolean) as string[];

  const bagian = [
    '*PERINGATAN TITIK API · AREA TAMBANG*',
    waktuWita(sekarangIso),
    '',
    `${titik.length} titik panas baru terdeteksi satelit di sekitar area tambang PT EBL:`,
    ...ringkas,
    '',
    ...titik.map((t, i) =>
      `${i + 1}. ${teksZona(t)}. Terdeteksi ${waktuWita(t.waktu)}, keyakinan ${t.keyakinan} (${namaSatelit(t.sumber)}). Lokasi: ${tautanPeta(t)}`),
    '',
    'Rekomendasi: segera cek lapangan, lalu catat hasilnya di POKEMONKEY (KEBUN, tombol titik api).',
  ];
  if (hitung('iup')) bagian.push('Titik di dalam IUP bisa berupa swabakar batubara di pit atau stockpile, pastikan saat cek.');

  if (riwayat && riwayat.total > 0) {
    bagian.push('');
    bagian.push('*Riwayat 7 Hari Terakhir:*');
    bagian.push(`• Total terdeteksi: ${riwayat.total} titik (${riwayat.ippkh} IPPKH, ${riwayat.iup} IUP, ${riwayat.waspada} waspada)`);
    const rincian = [
      riwayat.belum_dicek > 0 && `${riwayat.belum_dicek} belum dicek`,
      riwayat.sedang_dicek > 0 && `${riwayat.sedang_dicek} sedang dicek`,
      riwayat.padam > 0 && `${riwayat.padam} padam`,
      riwayat.bukan_api > 0 && `${riwayat.bukan_api} bukan api`,
    ].filter(Boolean).join(', ');
    if (rincian) bagian.push(`• Status verifikasi: ${rincian}`);
  }

  bagian.push('_Sumber: NASA FIRMS. Deteksi satelit bisa meleset beberapa ratus meter._');
  return bagian.join('\n');
}

/** Atribut petak Rehab DAS yang bisa berubah (tabel D1 das_petak). */
export interface InfoPetak { luas_ha: number | null; vendor: string | null; status: string | null }

export interface RingkasanDas7Hari {
  total: number;
  petak: number;
  waspada: number;
  belum_dicek: number;
  sedang_dicek: number;
  padam: number;
  bukan_api: number;
}

const luas = (n: number | null) => (n == null ? '' : `${n.toLocaleString('id-ID', { maximumFractionDigits: 1 })} Ha`);

function keteranganPetak(nama: string | null, info?: InfoPetak): string {
  if (!nama) return '';
  const bagian = [luas(info?.luas_ha ?? null), info?.vendor && `vendor ${info.vendor}`, info?.status && info.status.toLowerCase().replace(/\b(i{1,3}|iv|v)\b/g, (r) => r.toUpperCase())]
    .filter(Boolean);
  return bagian.length ? ` (${bagian.join(', ')})` : '';
}

/** Pesan grup WA untuk titik api baru di petak Rehabilitasi DAS — terpisah dari area tambang. */
export function susunPeringatanTitikApiDas(
  titik: TitikApi[],
  sekarangIso: string,
  petak: Map<string, InfoPetak>,
): string {
  const vendor = [...new Set(titik.map((t) => (t.bidang ? petak.get(t.bidang)?.vendor : null)).filter(Boolean))] as string[];
  const baris = titik.map((t, i) => {
    const lokasi = t.zona === 'petak'
      ? `Di dalam ${t.bidang ?? 'petak'}${keteranganPetak(t.bidang, t.bidang ? petak.get(t.bidang) : undefined)}`
      : `Waspada, ${km(t.jarak_km)} km dari ${t.bidang ?? 'petak terdekat'}${keteranganPetak(t.bidang, t.bidang ? petak.get(t.bidang) : undefined)}`;
    return `${i + 1}. ${lokasi}. Terdeteksi ${waktuWita(t.waktu)}, keyakinan ${t.keyakinan} (${namaSatelit(t.sumber)}). Lokasi: ${tautanPeta(t)}`;
  });
  const siapa = vendor.length ? `vendor ${vendor.join(' dan ')}` : 'vendor penanaman';
  return [
    '*PERINGATAN TITIK API · REHAB DAS*',
    waktuWita(sekarangIso),
    '',
    `${titik.length} titik panas baru di area rehabilitasi DAS (Tahura Sultan Adam):`,
    ...baris,
    '',
    `Rekomendasi: segera hubungi ${siapa} dan pengelola Tahura untuk cek lapangan. Tanaman yang terbakar memengaruhi penilaian serah terima.`,
    '_Sumber: NASA FIRMS. Deteksi satelit bisa meleset beberapa ratus meter._',
  ].join('\n');
}

const statusCek = (r: { belum_dicek: number; sedang_dicek: number; padam: number; bukan_api: number }) =>
  [
    r.belum_dicek > 0 && `${r.belum_dicek} belum dicek`,
    r.sedang_dicek > 0 && `${r.sedang_dicek} sedang dicek`,
    r.padam > 0 && `${r.padam} padam`,
    r.bukan_api > 0 && `${r.bukan_api} bukan api`,
  ].filter(Boolean).join(', ') || 'belum ada';

/** Rekap titik api 7 hari: SATU pesan dengan dua bagian, area tambang dan Rehab DAS. */
export function susunRekapTitikApi7Hari(
  sekarangIso: string,
  tambang: { riwayat: RingkasanRiwayat7Hari; titik: TitikApi[] },
  das: { riwayat: RingkasanDas7Hari; titik: TitikApi[] },
): string {
  const daftar = (titik: TitikApi[]) => titik.slice(0, 3).map((t, i) => `${i + 1}. ${teksZona(t)} (${waktuWita(t.waktu)}). Lokasi: ${tautanPeta(t)}`);
  const bagian = [
    '*REKAP TITIK API 7 HARI TERAKHIR*',
    waktuWita(sekarangIso),
    '',
    '*Area tambang (IUP/IPPKH)*',
    `• Terdeteksi: ${tambang.riwayat.total} titik (${tambang.riwayat.ippkh} IPPKH, ${tambang.riwayat.iup} IUP, ${tambang.riwayat.waspada} waspada)`,
    `• Status cek: ${statusCek(tambang.riwayat)}`,
    ...daftar(tambang.titik),
    '',
    '*Rehab DAS (Tahura Sultan Adam)*',
    `• Terdeteksi: ${das.riwayat.total} titik (${das.riwayat.petak} di dalam petak, ${das.riwayat.waspada} waspada)`,
    `• Status cek: ${statusCek(das.riwayat)}`,
    ...daftar(das.titik),
    '',
    '_Sumber: NASA FIRMS (VIIRS & MODIS). Zona pantau tidak dihitung._',
  ];
  return bagian.join('\n');
}
