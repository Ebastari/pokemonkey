/**
 * Prakiraan cuaca BMKG — bagian murni (tanpa D1/fetch), dipakai Worker dan mode demo.
 *
 * Sumber: https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=<kode desa>
 * Gratis tanpa kunci, batas 60 permintaan/menit/IP, WAJIB mencantumkan BMKG
 * sebagai sumber. Data per 3 jam untuk 3 hari ke depan.
 */

export interface SlotCuaca {
  /** Awal slot, ISO UTC. */
  utc: string;
  /** Waktu setempat "YYYY-MM-DD HH:MM" (WITA untuk Kalimantan Selatan). */
  lokal: string;
  suhu: number;
  lembap: number;
  /** Curah hujan dalam slot ini, mm. */
  hujanMm: number;
  /** Tutupan awan, %. */
  awan: number;
  /** Kode cuaca BMKG (0 cerah … 60 hujan ringan … 95 petir). */
  kode: number;
  ket: string;
  /** Kecepatan angin km/jam dan arah asalnya (N, NE, …). */
  angin: number;
  arah: string;
}

export interface LokasiCuaca {
  adm4: string;
  desa: string;
  kecamatan: string;
  kotkab: string;
  provinsi: string;
  lat: number;
  lon: number;
}

export interface DataCuaca {
  lokasi: LokasiCuaca;
  slot: SlotCuaca[];
  analisis?: string;
}

export interface JawabanCuaca {
  lokasi: LokasiCuaca;
  sekarang: SlotCuaca | null;
  /** Slot dari sekarang ke depan (maks. 24 = 3 hari). */
  slot: SlotCuaca[];
  /** 0 tidak hujan · 1 ringan · 2 sedang · 3 lebat/petir. */
  hujan: 0 | 1 | 2 | 3;
  petir: boolean;
  /** Kapan data diambil dari BMKG (ISO). */
  diambil: string;
  /** true bila BMKG sedang tidak bisa dihubungi dan yang tampil data lama. */
  basi?: boolean;
  sumber: 'BMKG';
}

/** Pola kode BMKG yang berarti hujan turun. */
export function intensitasHujan(kode: number): 0 | 1 | 2 | 3 {
  if (kode === 63 || kode === 95 || kode === 97) return 3;
  if (kode === 61) return 2;
  if (kode === 60 || kode === 80) return 1;
  return kode >= 60 ? 1 : 0;
}

export type JenisCuaca = 'cerah' | 'cerah-berawan' | 'berawan' | 'kabut' | 'hujan' | 'petir';

export function jenisCuaca(kode: number): JenisCuaca {
  if (kode === 95 || kode === 97) return 'petir';
  if (intensitasHujan(kode) > 0) return 'hujan';
  if (kode === 0) return 'cerah';
  if (kode === 1 || kode === 2) return 'cerah-berawan';
  if (kode === 5 || kode === 10 || kode === 45) return 'kabut';
  return 'berawan';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Ubah JSON BMKG menjadi bentuk ringkas; slot diurutkan menurut waktu. */
export function uraiBmkg(j: any, adm4: string): DataCuaca {
  const l = j?.lokasi ?? {};
  const mentah: any[] = (j?.data?.[0]?.cuaca ?? []).flat();
  const slot = mentah
    .filter((s) => s && s.datetime)
    .map((s): SlotCuaca => ({
      utc: new Date(s.datetime).toISOString(),
      lokal: String(s.local_datetime ?? '').slice(0, 16),
      suhu: Number(s.t),
      lembap: Number(s.hu),
      hujanMm: Number(s.tp) || 0,
      awan: Number(s.tcc) || 0,
      kode: Number(s.weather),
      ket: String(s.weather_desc ?? ''),
      angin: Number(s.ws) || 0,
      arah: String(s.wd ?? ''),
    }))
    .sort((a, b) => a.utc.localeCompare(b.utc));
  return {
    lokasi: {
      adm4,
      desa: String(l.desa ?? ''),
      kecamatan: String(l.kecamatan ?? ''),
      kotkab: String(l.kotkab ?? ''),
      provinsi: String(l.provinsi ?? ''),
      lat: Number(l.lat),
      lon: Number(l.lon),
    },
    slot,
    analisis: mentah[0]?.analysis_date,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const TIGA_JAM = 3 * 3600_000;

/** Slot yang sedang berjalan: yang terakhir dimulai sebelum `kini` (dalam 3 jam), atau yang pertama akan datang. */
export function slotSekarang(slot: SlotCuaca[], kini: number): SlotCuaca | null {
  let pilih: SlotCuaca | null = null;
  for (const s of slot) {
    const t = Date.parse(s.utc);
    if (t <= kini && kini - t < TIGA_JAM) pilih = s;
  }
  return pilih ?? slot.find((s) => Date.parse(s.utc) > kini) ?? null;
}

export function susunJawabanCuaca(data: DataCuaca, diambil: string, kini: number, basi = false): JawabanCuaca {
  const sekarang = slotSekarang(data.slot, kini);
  const mulai = sekarang ? data.slot.indexOf(sekarang) : 0;
  const kode = sekarang?.kode ?? 0;
  return {
    lokasi: data.lokasi,
    sekarang,
    slot: data.slot.slice(Math.max(0, mulai), Math.max(0, mulai) + 24),
    hujan: intensitasHujan(kode),
    petir: kode === 95 || kode === 97,
    diambil,
    ...(basi ? { basi: true } : {}),
    sumber: 'BMKG',
  };
}

/** Kode wilayah Kemendagri tingkat desa/kelurahan, mis. 63.05.09.2012. */
export const polaAdm4 = /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/;

/** Bawaan: Desa Linuh, Kec. Bungur, Kab. Tapin — ±2,6 km dari pusat area tambang PT EBL. */
export const ADM4_BAWAAN = '63.05.09.2012';
