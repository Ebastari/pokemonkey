/**
 * Sumber data lapangan: Smart Nursery dan Geotagging Pohon.
 * 
 * SATU-SATUNYA modul yang mengenal struktur tabel dan kueri data lapangan.
 * Aturan arsitektur:
 * 1. Hanya SELECT — tidak pernah menulis atau mengubah tabel sumber.
 * 2. Agregasi dilakukan di SQL D1 (atau dikelompokkan sebelum dihitung di JS)
 *    agar hemat CPU Worker (< 10 ms).
 * 3. Rumus mortalitas dan karbon disalin persis dari nursery_analitik.py
 *    dan geotag_analitik.py (camera.v8-native), tidak dikarang ulang.
 * 4. Fallback bertingkat: D1 binding -> Worker API -> Demo data jika jaringan putus.
 */

import type { Env } from './tipe';
import { tanggalWita, jamWita } from './waktu';

// Ambang mortalitas persemaian (standar reklamasi PT EBL)
const AMBANG_WASPADA = 10.0;
const AMBANG_KRITIS = 25.0;

// Konstanta karbon pohon (Chave 2014 & IPCC)
const RHO_KAYU = 0.60;          // g/cm3 rata-rata jenis reklamasi
const FRAKSI_KARBON = 0.47;     // IPCC standard
const CO2_PER_C = 44.0 / 12.0;  // rasio molekul CO2 / C

export const BATAS_KARBON = [
  'Diameter TIDAK diukur di lapangan; diduga dari tinggi pohon (allometrik).',
  'Kerapatan kayu dipukul rata 0,60 g/cm³ untuk semua jenis.',
  'Hanya biomassa ATAS TANAH (AGB). Akar, serasah, dan tanah tidak terhitung.',
  'Luas cakupan survei, bukan luas tutupan tanam riil.',
];

export interface SaringanNursery {
  bibit?: string;
  tujuan?: string;
  dari?: string;
  sampai?: string;
}

export interface HasilNursery {
  ok: boolean;
  ringkasan: {
    stok: number;
    stok_sahih: boolean;
    saringan: string[];
    masuk: number;
    keluar: number;
    mati: number;
    mortalitas: number;
    jml_jenis: number;
    jml_baris: number;
    masuk_hari_ini: number;
    keluar_hari_ini: number;
    mati_hari_ini: number;
    hari_aktif: number;
    dari: string;
    sampai: string;
  };
  jenis: Array<{
    nama: string;
    masuk: number;
    keluar: number;
    mati: number;
    stok: number;
    mortalitas: number;
    status: 'Sehat' | 'Waspada' | 'Kritis';
    terakhir: string;
  }>;
  tujuan: Array<{
    tujuan: string;
    total: number;
    persen: number;
  }>;
  tren: Array<{
    tanggal: string;
    masuk: number;
    keluar: number;
    mati: number;
    stok: number;
  }>;
  proyeksi: {
    ada: boolean;
    stok?: number;
    laju_harian?: number;
    hari_tersisa?: number;
    perkiraan_habis?: string;
    alasan?: string;
  };
  diambil: string;
  sumber: 'd1' | 'worker' | 'demo';
}

export interface SaringanGeotag {
  lokasi?: string;
  tanaman?: string;
  vendor?: string;
  pengawas?: string;
  dari?: string;
  sampai?: string;
}

export interface HasilGeotag {
  ok: boolean;
  ringkasan: {
    total: number;
    sehat: number;
    merana: number;
    mati: number;
    persen_hidup: number;
    persen_sehat: number;
    berkoordinat: number;
    berfoto: number;
    tinggi_avg: number;
    tinggi_min: number;
    tinggi_max: number;
  };
  karbon: {
    agb_kg: number;
    agb_ton: number;
    karbon_kg: number;
    karbon_ton: number;
    co2e_kg: number;
    co2e_ton: number;
    batas: string[];
  };
  per_lokasi: Array<{
    lokasi: string;
    total: number;
    sehat: number;
    merana: number;
    mati: number;
    persen_hidup: number;
  }>;
  per_tanaman: Array<{
    tanaman: string;
    total: number;
    persen: number;
  }>;
  diambil: string;
  sumber: 'd1' | 'worker' | 'demo';
}

/** Hitung DBH dan AGB pohon tunggal persis rumus camera.v8-native / geotag_analitik.py */
export function hitungAgbKg(tinggiCm: number): { dbhCm: number; agbKg: number } {
  if (!tinggiCm || tinggiCm <= 0) return { dbhCm: 0, agbKg: 0 };
  const h = tinggiCm / 100.0; // tinggi dalam meter
  const dbhCm = h <= 1.3 ? Math.max(0.5, h * 0.85) : Math.max(1.0, 0.85 * Math.pow(h, 1.2));
  const agbKg = Math.max(0, 0.0673 * Math.pow(RHO_KAYU * dbhCm * dbhCm * h, 0.976));
  return { dbhCm, agbKg };
}

// ============================================================================
// 1. SMART NURSERY
// ============================================================================

export async function ambilDataNursery(env: Env, saring: SaringanNursery = {}): Promise<HasilNursery> {
  const sekarang = new Date();
  const hariIni = tanggalWita(sekarang);
  const waktuStr = `${jamWita(sekarang)} WITA`;

  // Filter kebersihan
  const fBibit = (saring.bibit || '').trim();
  const fTujuan = (saring.tujuan || '').trim();
  const fDari = (saring.dari || '').trim();
  const fSampai = (saring.sampai || '').trim();

  // Kapan stok masih berarti stok:
  // Stok = sum(masuk) - sum(keluar) - sum(mati) hanya sah bila seluruh baris jenis itu ikut dihitung.
  // Menyaring tujuan (mis. "Blok 3") hanya menyisakan pengeluaran -> bukan stok persemaian.
  const stokSahih = !fTujuan && !fDari && !fSampai;
  const daftarSaringan: string[] = [];
  if (fBibit) daftarSaringan.push(`Bibit: ${fBibit}`);
  if (fTujuan) daftarSaringan.push(`Tujuan: ${fTujuan}`);
  if (fDari) daftarSaringan.push(`Dari: ${fDari}`);
  if (fSampai) daftarSaringan.push(`Sampai: ${fSampai}`);

  // Coba kueri D1 langsung bila binding tersedia
  if (env.NURSERY_DB) {
    try {
      const klausa: string[] = ['1=1'];
      const params: any[] = [];
      if (fBibit) {
        klausa.push('bibit = ?');
        params.push(fBibit);
      }
      if (fTujuan) {
        klausa.push('tujuan = ?');
        params.push(fTujuan);
      }
      if (fDari) {
        klausa.push('tanggal >= ?');
        params.push(fDari);
      }
      if (fSampai) {
        klausa.push('tanggal <= ?');
        params.push(fSampai);
      }
      const diMana = klausa.join(' AND ');

      // Kueri Ringkasan utama
      const kueriRingkasan = `
        SELECT 
          COUNT(*) as jml_baris,
          COALESCE(SUM(masuk), 0) as masuk,
          COALESCE(SUM(keluar), 0) as keluar,
          COALESCE(SUM(mati), 0) as mati,
          COALESCE(SUM(CASE WHEN tanggal = ? THEN masuk ELSE 0 END), 0) as masuk_hari_ini,
          COALESCE(SUM(CASE WHEN tanggal = ? THEN keluar ELSE 0 END), 0) as keluar_hari_ini,
          COALESCE(SUM(CASE WHEN tanggal = ? THEN mati ELSE 0 END), 0) as mati_hari_ini,
          MIN(tanggal) as dari_tgl,
          MAX(tanggal) as sampai_tgl
        FROM entries WHERE ${diMana}
      `;
      const stmtRingkasan = env.NURSERY_DB.prepare(kueriRingkasan).bind(hariIni, hariIni, hariIni, ...params);
      const ringkasanRaw = await stmtRingkasan.first<any>();

      if (ringkasanRaw && ringkasanRaw.jml_baris > 0) {
        const masuk = Number(ringkasanRaw.masuk || 0);
        const keluar = Number(ringkasanRaw.keluar || 0);
        const mati = Number(ringkasanRaw.mati || 0);
        const stok = masuk - keluar - mati;
        const mortalitas = masuk > 0 ? Number(((mati / masuk) * 100).toFixed(2)) : 0;

        // Kueri Per Jenis Bibit
        const kueriJenis = `
          SELECT 
            COALESCE(bibit, '(Tanpa Nama)') as nama,
            SUM(masuk) as masuk,
            SUM(keluar) as keluar,
            SUM(mati) as mati,
            MAX(tanggal) as terakhir
          FROM entries WHERE ${diMana}
          GROUP BY bibit
          ORDER BY (SUM(masuk) - SUM(keluar) - SUM(mati)) DESC
        `;
        const listJenisRaw = (await env.NURSERY_DB.prepare(kueriJenis).bind(...params).all<any>()).results || [];
        const jenis = listJenisRaw.map((r) => {
          const jMasuk = Number(r.masuk || 0);
          const jKeluar = Number(r.keluar || 0);
          const jMati = Number(r.mati || 0);
          const jStok = jMasuk - jKeluar - jMati;
          const jMort = jMasuk > 0 ? Number(((jMati / jMasuk) * 100).toFixed(2)) : 0;
          const status: 'Sehat' | 'Waspada' | 'Kritis' =
            jMort > AMBANG_KRITIS ? 'Kritis' : jMort > AMBANG_WASPADA ? 'Waspada' : 'Sehat';
          return {
            nama: r.nama,
            masuk: jMasuk,
            keluar: jKeluar,
            mati: jMati,
            stok: jStok,
            mortalitas: jMort,
            status,
            terakhir: r.terakhir || '',
          };
        });

        // Kueri Pareto Tujuan
        const kueriTujuan = `
          SELECT 
            tujuan,
            SUM(keluar) as total
          FROM entries 
          WHERE ${diMana} AND keluar > 0 AND tujuan IS NOT NULL AND TRIM(tujuan) != ''
          GROUP BY tujuan
          ORDER BY total DESC
        `;
        const listTujuanRaw = (await env.NURSERY_DB.prepare(kueriTujuan).bind(...params).all<any>()).results || [];
        const totalKeluarTujuan = listTujuanRaw.reduce((acc, cur) => acc + Number(cur.total || 0), 0);
        const tujuan = listTujuanRaw.map((r) => ({
          tujuan: r.tujuan,
          total: Number(r.total || 0),
          persen: totalKeluarTujuan > 0 ? Number(((Number(r.total || 0) / totalKeluarTujuan) * 100).toFixed(1)) : 0,
        }));

        // Kueri Tren Harian
        const kueriTren = `
          SELECT 
            tanggal,
            SUM(masuk) as masuk,
            SUM(keluar) as keluar,
            SUM(mati) as mati
          FROM entries 
          WHERE ${diMana} AND tanggal IS NOT NULL AND TRIM(tanggal) != ''
          GROUP BY tanggal
          ORDER BY tanggal ASC
        `;
        const listTrenRaw = (await env.NURSERY_DB.prepare(kueriTren).bind(...params).all<any>()).results || [];
        let kumulatif = 0;
        const tren = listTrenRaw.map((r) => {
          const m = Number(r.masuk || 0);
          const k = Number(r.keluar || 0);
          const mt = Number(r.mati || 0);
          kumulatif += m - k - mt;
          return {
            tanggal: r.tanggal,
            masuk: m,
            keluar: k,
            mati: mt,
            stok: kumulatif,
          };
        });

        // Hitung Proyeksi Habis Stok jika stok_sahih
        let proyeksi = {
          ada: false,
          stok,
          alasan: 'Saringan aktif membuat angka ini bukan stok utuh.',
        } as HasilNursery['proyeksi'];

        if (stokSahih && stok > 0 && tren.length >= 3) {
          // 30 hari data terakhir
          const jendela = tren.slice(-30);
          const totalKeluarJendela = jendela.reduce((acc, cur) => acc + cur.keluar, 0);
          const hariAktifJendela = jendela.filter((x) => x.keluar > 0).length;
          if (totalKeluarJendela > 0 && hariAktifJendela > 0) {
            const lajuHarian = totalKeluarJendela / jendela.length;
            const hariTersisa = Math.max(1, Math.round(stok / lajuHarian));
            const perkiraanTgl = new Date(Date.now() + hariTersisa * 86_400_000).toISOString().slice(0, 10);
            proyeksi = {
              ada: true,
              stok,
              laju_harian: Number(lajuHarian.toFixed(1)),
              hari_tersisa: hariTersisa,
              perkiraan_habis: perkiraanTgl,
            };
          } else {
            proyeksi = {
              ada: false,
              stok,
              alasan: 'Belum ada pengeluaran bibit pada periode terakhir.',
            };
          }
        }

        return {
          ok: true,
          ringkasan: {
            stok,
            stok_sahih: stokSahih,
            saringan: daftarSaringan,
            masuk,
            keluar,
            mati,
            mortalitas,
            jml_jenis: jenis.length,
            jml_baris: Number(ringkasanRaw.jml_baris || 0),
            masuk_hari_ini: Number(ringkasanRaw.masuk_hari_ini || 0),
            keluar_hari_ini: Number(ringkasanRaw.keluar_hari_ini || 0),
            mati_hari_ini: Number(ringkasanRaw.mati_hari_ini || 0),
            hari_aktif: tren.length,
            dari: ringkasanRaw.dari_tgl || '',
            sampai: ringkasanRaw.sampai_tgl || '',
          },
          jenis,
          tujuan,
          tren,
          proyeksi,
          diambil: waktuStr,
          sumber: 'd1',
        };
      }
    } catch (err) {
      console.warn('D1 NURSERY_DB query failed, attempting worker fallback:', err);
    }
  }

  // Fallback ke Worker API jika D1 lokal kosong atau belum deploy
  const apiUrl = env.NURSERY_API_URL || 'https://smart-nursery-api.montana-camera.workers.dev';
  const apiKey = env.NURSERY_API_KEY || 'vsDWaC5a6feBE5cqcsvl6q55hFLRfAVTTKZHsStaOTk';

  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/entries?limit=5000`, {
      headers: { 'X-Api-Key': apiKey },
    });
    if (res.ok) {
      const body = (await res.json()) as any;
      const barisMentah = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.entries) ? body.entries : [];

      // Saring data di memori jika lewat Worker API
      const baris = barisMentah.filter((b: any) => {
        if (fBibit && b.bibit !== fBibit) return false;
        if (fTujuan && b.tujuan !== fTujuan) return false;
        if (fDari && b.tanggal < fDari) return false;
        if (fSampai && b.tanggal > fSampai) return false;
        return true;
      });

      let masuk = 0;
      let keluar = 0;
      let mati = 0;
      let masukHariIni = 0;
      let keluarHariIni = 0;
      let matiHariIni = 0;

      const jenisPeta = new Map<string, { masuk: number; keluar: number; mati: number; terakhir: string }>();
      const tujuanPeta = new Map<string, number>();
      const trenPeta = new Map<string, { masuk: number; keluar: number; mati: number }>();

      for (const b of baris) {
        const m = Number(b.masuk || 0);
        const k = Number(b.keluar || 0);
        const mt = Number(b.mati || 0);
        masuk += m;
        keluar += k;
        mati += mt;

        if (b.tanggal === hariIni) {
          masukHariIni += m;
          keluarHariIni += k;
          matiHariIni += mt;
        }

        // Per jenis
        const jNama = b.bibit || '(Tanpa Nama)';
        const curJ = jenisPeta.get(jNama) || { masuk: 0, keluar: 0, mati: 0, terakhir: '' };
        curJ.masuk += m;
        curJ.keluar += k;
        curJ.mati += mt;
        if (b.tanggal > curJ.terakhir) curJ.terakhir = b.tanggal;
        jenisPeta.set(jNama, curJ);

        // Per tujuan
        if (k > 0 && b.tujuan && b.tujuan.trim()) {
          tujuanPeta.set(b.tujuan, (tujuanPeta.get(b.tujuan) || 0) + k);
        }

        // Per tanggal
        if (b.tanggal) {
          const curT = trenPeta.get(b.tanggal) || { masuk: 0, keluar: 0, mati: 0 };
          curT.masuk += m;
          curT.keluar += k;
          curT.mati += mt;
          trenPeta.set(b.tanggal, curT);
        }
      }

      const stok = masuk - keluar - mati;
      const mortalitas = masuk > 0 ? Number(((mati / masuk) * 100).toFixed(2)) : 0;

      const jenis = Array.from(jenisPeta.entries()).map(([nama, val]) => {
        const jStok = val.masuk - val.keluar - val.mati;
        const jMort = val.masuk > 0 ? Number(((val.mati / val.masuk) * 100).toFixed(2)) : 0;
        const status: 'Sehat' | 'Waspada' | 'Kritis' =
          jMort > AMBANG_KRITIS ? 'Kritis' : jMort > AMBANG_WASPADA ? 'Waspada' : 'Sehat';
        return {
          nama,
          masuk: val.masuk,
          keluar: val.keluar,
          mati: val.mati,
          stok: jStok,
          mortalitas: jMort,
          status,
          terakhir: val.terakhir,
        };
      }).sort((a, b) => b.stok - a.stok);

      const totalTujuan = Array.from(tujuanPeta.values()).reduce((a, b) => a + b, 0);
      const tujuan = Array.from(tujuanPeta.entries())
        .map(([tuj, tot]) => ({
          tujuan: tuj,
          total: tot,
          persen: totalTujuan > 0 ? Number(((tot / totalTujuan) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.total - a.total);

      const urutTgl = Array.from(trenPeta.keys()).sort();
      let kumu = 0;
      const tren = urutTgl.map((tgl) => {
        const v = trenPeta.get(tgl)!;
        kumu += v.masuk - v.keluar - v.mati;
        return {
          tanggal: tgl,
          masuk: v.masuk,
          keluar: v.keluar,
          mati: v.mati,
          stok: kumu,
        };
      });

      let proyeksi: HasilNursery['proyeksi'] = {
        ada: false,
        stok,
        alasan: 'Saringan aktif membuat angka ini bukan stok utuh.',
      };

      if (stokSahih && stok > 0 && tren.length >= 3) {
        const jendela = tren.slice(-30);
        const totalKeluarJendela = jendela.reduce((acc, cur) => acc + cur.keluar, 0);
        if (totalKeluarJendela > 0) {
          const lajuHarian = totalKeluarJendela / jendela.length;
          const hariTersisa = Math.max(1, Math.round(stok / lajuHarian));
          const perkiraanTgl = new Date(Date.now() + hariTersisa * 86_400_000).toISOString().slice(0, 10);
          proyeksi = {
            ada: true,
            stok,
            laju_harian: Number(lajuHarian.toFixed(1)),
            hari_tersisa: hariTersisa,
            perkiraan_habis: perkiraanTgl,
          };
        }
      }

      return {
        ok: true,
        ringkasan: {
          stok,
          stok_sahih: stokSahih,
          saringan: daftarSaringan,
          masuk,
          keluar,
          mati,
          mortalitas,
          jml_jenis: jenis.length,
          jml_baris: baris.length,
          masuk_hari_ini: masukHariIni,
          keluar_hari_ini: keluarHariIni,
          mati_hari_ini: matiHariIni,
          hari_aktif: tren.length,
          dari: urutTgl[0] || '',
          sampai: urutTgl[urutTgl.length - 1] || '',
        },
        jenis,
        tujuan,
        tren,
        proyeksi,
        diambil: waktuStr,
        sumber: 'worker',
      };
    }
  } catch (err) {
    console.warn('Fallback worker nursery fetch failed:', err);
  }

  // Fallback demo data jika offline total
  return demoHasilNursery(daftarSaringan, stokSahih, waktuStr);
}

// ============================================================================
// 2. GEOTAGGING LAPANGAN & ESTIMASI KARBON
// ============================================================================

export async function ambilDataGeotag(env: Env, saring: SaringanGeotag = {}): Promise<HasilGeotag> {
  const sekarang = new Date();
  const waktuStr = `${jamWita(sekarang)} WITA`;

  const fLokasi = (saring.lokasi || '').trim();
  const fTanaman = (saring.tanaman || '').trim();
  const fVendor = (saring.vendor || '').trim();
  const fPengawas = (saring.pengawas || '').trim();
  const fDari = (saring.dari || '').trim();
  const fSampai = (saring.sampai || '').trim();

  // Coba kueri D1 langsung jika binding tersedia
  if (env.GEOTAG_DB) {
    try {
      const klausa: string[] = ['1=1'];
      const params: any[] = [];
      if (fLokasi) {
        klausa.push('lokasi LIKE ?');
        params.push(`%${fLokasi}%`);
      }
      if (fTanaman) {
        klausa.push('tanaman = ?');
        params.push(fTanaman);
      }
      if (fVendor) {
        klausa.push('vendor = ?');
        params.push(fVendor);
      }
      if (fPengawas) {
        klausa.push('pengawas = ?');
        params.push(fPengawas);
      }
      if (fDari) {
        klausa.push('timestamp >= ?');
        params.push(fDari);
      }
      if (fSampai) {
        klausa.push('timestamp <= ?');
        params.push(fSampai);
      }
      const diMana = klausa.join(' AND ');

      // Kueri Ringkasan Kesehatan & Koordinat
      const kueriRingkasan = `
        SELECT 
          COUNT(*) as total,
          COALESCE(SUM(CASE WHEN LOWER(TRIM(kesehatan)) = 'sehat' THEN 1 ELSE 0 END), 0) as sehat,
          COALESCE(SUM(CASE WHEN LOWER(TRIM(kesehatan)) = 'merana' THEN 1 ELSE 0 END), 0) as merana,
          COALESCE(SUM(CASE WHEN LOWER(TRIM(kesehatan)) = 'mati' THEN 1 ELSE 0 END), 0) as mati,
          COALESCE(SUM(CASE WHEN x IS NOT NULL AND y IS NOT NULL AND x != 0 AND y != 0 THEN 1 ELSE 0 END), 0) as berkoordinat,
          COALESCE(SUM(CASE WHEN photo_key IS NOT NULL AND TRIM(photo_key) != '' THEN 1 ELSE 0 END), 0) as berfoto,
          AVG(CASE WHEN tinggi > 0 THEN tinggi ELSE NULL END) as tinggi_avg,
          MIN(CASE WHEN tinggi > 0 THEN tinggi ELSE NULL END) as tinggi_min,
          MAX(CASE WHEN tinggi > 0 THEN tinggi ELSE NULL END) as tinggi_max
        FROM entries WHERE ${diMana}
      `;
      const ringkasanRaw = await env.GEOTAG_DB.prepare(kueriRingkasan).bind(...params).first<any>();

      if (ringkasanRaw && ringkasanRaw.total > 0) {
        const total = Number(ringkasanRaw.total || 0);
        const sehat = Number(ringkasanRaw.sehat || 0);
        const merana = Number(ringkasanRaw.merana || 0);
        const mati = Number(ringkasanRaw.mati || 0);
        const persenHidup = total > 0 ? Number((((sehat + merana) / total) * 100).toFixed(1)) : 0;
        const persenSehat = total > 0 ? Number(((sehat / total) * 100).toFixed(1)) : 0;

        // Kueri Distribusi Tinggi untuk Perhitungan Karbon Presisi (Hanya ratusan baris, < 0.05 ms CPU)
        const kueriTinggi = `
          SELECT tinggi, COUNT(*) as jml 
          FROM entries 
          WHERE ${diMana} AND tinggi > 0 
          GROUP BY tinggi
        `;
        const tinggiGroups = (await env.GEOTAG_DB.prepare(kueriTinggi).bind(...params).all<any>()).results || [];

        let totalAgbKg = 0;
        for (const row of tinggiGroups) {
          const t = Number(row.tinggi || 0);
          const jml = Number(row.jml || 0);
          const { agbKg } = hitungAgbKg(t);
          totalAgbKg += agbKg * jml;
        }

        const totalKarbonKg = totalAgbKg * FRAKSI_KARBON;
        const totalCo2eKg = totalKarbonKg * CO2_PER_C;

        // Kueri Per Lokasi
        const kueriLokasi = `
          SELECT 
            COALESCE(lokasi, 'Tanpa Lokasi') as lokasi,
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN LOWER(TRIM(kesehatan)) = 'sehat' THEN 1 ELSE 0 END), 0) as sehat,
            COALESCE(SUM(CASE WHEN LOWER(TRIM(kesehatan)) = 'merana' THEN 1 ELSE 0 END), 0) as merana,
            COALESCE(SUM(CASE WHEN LOWER(TRIM(kesehatan)) = 'mati' THEN 1 ELSE 0 END), 0) as mati
          FROM entries WHERE ${diMana}
          GROUP BY lokasi
          ORDER BY total DESC
          LIMIT 12
        `;
        const listLokasiRaw = (await env.GEOTAG_DB.prepare(kueriLokasi).bind(...params).all<any>()).results || [];
        const perLokasi = listLokasiRaw.map((r) => {
          const t = Number(r.total || 0);
          const s = Number(r.sehat || 0);
          const m = Number(r.merana || 0);
          const mt = Number(r.mati || 0);
          return {
            lokasi: r.lokasi,
            total: t,
            sehat: s,
            merana: m,
            mati: mt,
            persen_hidup: t > 0 ? Number((((s + m) / t) * 100).toFixed(1)) : 0,
          };
        });

        // Kueri Per Tanaman
        const kueriTanaman = `
          SELECT 
            COALESCE(tanaman, 'Lainnya') as tanaman,
            COUNT(*) as total
          FROM entries WHERE ${diMana}
          GROUP BY tanaman
          ORDER BY total DESC
          LIMIT 8
        `;
        const listTanamanRaw = (await env.GEOTAG_DB.prepare(kueriTanaman).bind(...params).all<any>()).results || [];
        const perTanaman = listTanamanRaw.map((r) => ({
          tanaman: r.tanaman,
          total: Number(r.total || 0),
          persen: total > 0 ? Number(((Number(r.total || 0) / total) * 100).toFixed(1)) : 0,
        }));

        return {
          ok: true,
          ringkasan: {
            total,
            sehat,
            merana,
            mati,
            persen_hidup: persenHidup,
            persen_sehat: persenSehat,
            berkoordinat: Number(ringkasanRaw.berkoordinat || 0),
            berfoto: Number(ringkasanRaw.berfoto || 0),
            tinggi_avg: Number(Number(ringkasanRaw.tinggi_avg || 0).toFixed(1)),
            tinggi_min: Number(Number(ringkasanRaw.tinggi_min || 0).toFixed(1)),
            tinggi_max: Number(Number(ringkasanRaw.tinggi_max || 0).toFixed(1)),
          },
          karbon: {
            agb_kg: Math.round(totalAgbKg),
            agb_ton: Number((totalAgbKg / 1000).toFixed(2)),
            karbon_kg: Math.round(totalKarbonKg),
            karbon_ton: Number((totalKarbonKg / 1000).toFixed(2)),
            co2e_kg: Math.round(totalCo2eKg),
            co2e_ton: Number((totalCo2eKg / 1000).toFixed(2)),
            batas: BATAS_KARBON,
          },
          per_lokasi: perLokasi,
          per_tanaman: perTanaman,
          diambil: waktuStr,
          sumber: 'd1',
        };
      }
    } catch (err) {
      console.warn('D1 GEOTAG_DB query failed, attempting worker fallback:', err);
    }
  }

  // Fallback ke Worker API Geotag
  const apiUrl = env.GEOTAG_URL || 'https://montana-ecology-summary.montana-camera.workers.dev';
  const apiKey = env.GEOTAG_KEY || 'agunglaksono2026';

  try {
    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/api/entries?limit=5000`, {
      headers: { 'X-Api-Key': apiKey },
    });
    if (res.ok) {
      const body = (await res.json()) as any;
      const barisMentah = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.entries) ? body.entries : [];

      const baris = barisMentah.filter((b: any) => {
        if (fLokasi && !String(b.lokasi || '').toLowerCase().includes(fLokasi.toLowerCase())) return false;
        if (fTanaman && b.tanaman !== fTanaman) return false;
        if (fVendor && b.vendor !== fVendor) return false;
        if (fPengawas && b.pengawas !== fPengawas) return false;
        return true;
      });

      let sehat = 0;
      let merana = 0;
      let mati = 0;
      let berkoordinat = 0;
      let berfoto = 0;
      let totalTinggi = 0;
      let countTinggi = 0;
      let minTinggi = 999999;
      let maxTinggi = 0;
      let totalAgbKg = 0;

      const lokasiPeta = new Map<string, { total: number; sehat: number; merana: number; mati: number }>();
      const tanamanPeta = new Map<string, number>();

      for (const b of baris) {
        const k = String(b.kesehatan || '').trim().toLowerCase();
        if (k === 'sehat') sehat++;
        else if (k === 'merana') merana++;
        else if (k === 'mati') mati++;

        if ((b.x && b.y) || (b.gps?.lat && b.gps?.lon)) berkoordinat++;
        if (b.photoKey || b.photo_key) berfoto++;

        const t = Number(b.tinggi || 0);
        if (t > 0) {
          totalTinggi += t;
          countTinggi++;
          if (t < minTinggi) minTinggi = t;
          if (t > maxTinggi) maxTinggi = t;
          const { agbKg } = hitungAgbKg(t);
          totalAgbKg += agbKg;
        }

        const lok = b.lokasi || 'Tanpa Lokasi';
        const curL = lokasiPeta.get(lok) || { total: 0, sehat: 0, merana: 0, mati: 0 };
        curL.total++;
        if (k === 'sehat') curL.sehat++;
        else if (k === 'merana') curL.merana++;
        else if (k === 'mati') curL.mati++;
        lokasiPeta.set(lok, curL);

        const tan = b.tanaman || 'Lainnya';
        tanamanPeta.set(tan, (tanamanPeta.get(tan) || 0) + 1);
      }

      const total = baris.length;
      const totalKarbonKg = totalAgbKg * FRAKSI_KARBON;
      const totalCo2eKg = totalKarbonKg * CO2_PER_C;

      const perLokasi = Array.from(lokasiPeta.entries())
        .map(([lokasi, val]) => ({
          lokasi,
          total: val.total,
          sehat: val.sehat,
          merana: val.merana,
          mati: val.mati,
          persen_hidup: val.total > 0 ? Number((((val.sehat + val.merana) / val.total) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 12);

      const perTanaman = Array.from(tanamanPeta.entries())
        .map(([tanaman, tot]) => ({
          tanaman,
          total: tot,
          persen: total > 0 ? Number(((tot / total) * 100).toFixed(1)) : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);

      return {
        ok: true,
        ringkasan: {
          total,
          sehat,
          merana,
          mati,
          persen_hidup: total > 0 ? Number((((sehat + merana) / total) * 100).toFixed(1)) : 0,
          persen_sehat: total > 0 ? Number(((sehat / total) * 100).toFixed(1)) : 0,
          berkoordinat,
          berfoto,
          tinggi_avg: countTinggi > 0 ? Number((totalTinggi / countTinggi).toFixed(1)) : 0,
          tinggi_min: countTinggi > 0 ? minTinggi : 0,
          tinggi_max: countTinggi > 0 ? maxTinggi : 0,
        },
        karbon: {
          agb_kg: Math.round(totalAgbKg),
          agb_ton: Number((totalAgbKg / 1000).toFixed(2)),
          karbon_kg: Math.round(totalKarbonKg),
          karbon_ton: Number((totalKarbonKg / 1000).toFixed(2)),
          co2e_kg: Math.round(totalCo2eKg),
          co2e_ton: Number((totalCo2eKg / 1000).toFixed(2)),
          batas: BATAS_KARBON,
        },
        per_lokasi: perLokasi,
        per_tanaman: perTanaman,
        diambil: waktuStr,
        sumber: 'worker',
      };
    }
  } catch (err) {
    console.warn('Fallback worker geotag fetch failed:', err);
  }

  // Fallback demo data jika offline total
  return demoHasilGeotag(waktuStr);
}

// ============================================================================
// Fallback Demo Data
// ============================================================================

function demoHasilNursery(saringan: string[], stokSahih: boolean, diambil: string): HasilNursery {
  return {
    ok: true,
    ringkasan: {
      stok: 45200,
      stok_sahih: stokSahih,
      saringan,
      masuk: 62000,
      keluar: 15500,
      mati: 1300,
      mortalitas: 2.1,
      jml_jenis: 4,
      jml_baris: 128,
      masuk_hari_ini: 500,
      keluar_hari_ini: 0,
      mati_hari_ini: 5,
      hari_aktif: 45,
      dari: '2026-08-01',
      sampai: '2026-09-28',
    },
    jenis: [
      { nama: 'SENGON POTTING', masuk: 35000, keluar: 8000, mati: 600, stok: 26400, mortalitas: 1.71, status: 'Sehat', terakhir: '2026-09-28' },
      { nama: 'INDIGOFERA', masuk: 18000, keluar: 4500, mati: 400, stok: 13100, mortalitas: 2.22, status: 'Sehat', terakhir: '2026-09-28' },
      { nama: 'BUNGA SEPATU', masuk: 6000, keluar: 2000, mati: 200, stok: 3800, mortalitas: 3.33, status: 'Sehat', terakhir: '2026-09-28' },
      { nama: 'MALAPARI', masuk: 3000, keluar: 1000, mati: 100, stok: 1900, mortalitas: 3.33, status: 'Sehat', terakhir: '2026-09-25' },
    ],
    tujuan: [
      { tujuan: 'Blok 1 Pit Barat', total: 6500, persen: 41.9 },
      { tujuan: 'Blok 2 Lereng Utara', total: 4800, persen: 31.0 },
      { tujuan: 'Rehab DAS Riam Kanan', total: 4200, persen: 27.1 },
    ],
    tren: [
      { tanggal: '2026-09-24', masuk: 1200, keluar: 0, mati: 10, stok: 43500 },
      { tanggal: '2026-09-25', masuk: 0, keluar: 1000, mati: 20, stok: 42480 },
      { tanggal: '2026-09-26', masuk: 2000, keluar: 500, mati: 15, stok: 43965 },
      { tanggal: '2026-09-27', masuk: 800, keluar: 0, mati: 10, stok: 44755 },
      { tanggal: '2026-09-28', masuk: 500, keluar: 0, mati: 5, stok: 45200 },
    ],
    proyeksi: {
      ada: true,
      stok: 45200,
      laju_harian: 350.0,
      hari_tersisa: 129,
      perkiraan_habis: '2027-02-05',
    },
    diambil,
    sumber: 'demo',
  };
}

function demoHasilGeotag(diambil: string): HasilGeotag {
  return {
    ok: true,
    ringkasan: {
      total: 12450,
      sehat: 11200,
      merana: 530,
      mati: 720,
      persen_hidup: 94.2,
      persen_sehat: 89.9,
      berkoordinat: 12450,
      berfoto: 12100,
      tinggi_avg: 74.5,
      tinggi_min: 25.0,
      tinggi_max: 320.0,
    },
    karbon: {
      agb_kg: 17870,
      agb_ton: 17.87,
      karbon_kg: 8400,
      karbon_ton: 8.4,
      co2e_kg: 30800,
      co2e_ton: 30.8,
      batas: BATAS_KARBON,
    },
    per_lokasi: [
      { lokasi: 'Blok 1 Reklamasi Pit Barat', total: 4200, sehat: 3950, merana: 150, mati: 100, persen_hidup: 97.6 },
      { lokasi: 'Blok 2 Lereng Utara', total: 3850, sehat: 3400, merana: 250, mati: 200, persen_hidup: 94.8 },
      { lokasi: 'Area Revegetasi DAS Riam Kanan', total: 2900, sehat: 2500, merana: 100, mati: 300, persen_hidup: 89.6 },
      { lokasi: 'Buffer Zone Selatan', total: 1500, sehat: 1350, merana: 30, mati: 120, persen_hidup: 92.0 },
    ],
    per_tanaman: [
      { tanaman: 'Sengon', total: 5800, persen: 46.6 },
      { tanaman: 'Johar', total: 2600, persen: 20.9 },
      { tanaman: 'Trembesi', total: 2100, persen: 16.9 },
      { tanaman: 'Malapari', total: 1200, persen: 9.6 },
      { tanaman: 'Lainnya', total: 750, persen: 6.0 },
    ],
    diambil,
    sumber: 'demo',
  };
}
