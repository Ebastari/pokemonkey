/**
 * Utilitas Geocoding & Reverse Geocoding (Format Tempat ala Google Maps)
 * Mengubah koordinat GPS perangkat menjadi nama tempat / jalan / desa nyata,
 * serta mendukung pencarian tempat untuk dipilih ke dalam memo.
 */

export interface HasilCariTempat {
  nama: string;
  alamatLengkap: string;
  lat: number;
  lng: number;
}

/**
 * Mengubah koordinat GPS (lat, lng) menjadi nama tempat / alamat manusiawi seperti Google Maps.
 */
export async function ambilNamaTempatDariKoordinat(lat: number, lng: number): Promise<string> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id`,
      {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      const addr = data.address || {};
      const bagian: string[] = [];

      // 1. Nama spesifik (gedung, kantor, fasilitas, sekolah, tempat industri, atau jalan)
      const namaSpesifik = data.name || addr.amenity || addr.building || addr.office || addr.industrial || addr.road;
      if (namaSpesifik) bagian.push(namaSpesifik);

      // 2. Dusun / Desa / Kelurahan
      const desa = addr.village || addr.suburb || addr.neighbourhood || addr.hamlet;
      if (desa && !bagian.includes(desa)) bagian.push(desa);

      // 3. Kecamatan / Distrik
      const kecamatan = addr.city_district || addr.district || addr.subdistrict;
      if (kecamatan && !bagian.includes(kecamatan)) bagian.push(`Kec. ${kecamatan}`);

      // 4. Kabupaten / Kota
      const kota = addr.city || addr.town || addr.county;
      if (kota && !bagian.includes(kota)) bagian.push(kota);

      // 5. Provinsi (hanya bila belum cukup informatif)
      if (bagian.length <= 2 && addr.state && !bagian.includes(addr.state)) {
        bagian.push(addr.state);
      }

      if (bagian.length > 0) {
        return bagian.join(', ');
      }

      if (data.display_name) {
        const parts = String(data.display_name).split(',').map((s: string) => s.trim());
        return parts.slice(0, 4).join(', ');
      }
    }
  } catch (e) {
    console.warn('Gagal reverse geocoding:', e);
  }

  // Backup fallback bila koneksi gagal / offline
  return `Titik Lokasi (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
}

/**
 * Mencari daftar nama tempat berdasarkan teks masukan pengguna.
 */
export async function cariDaftarTempat(kataKunci: string): Promise<HasilCariTempat[]> {
  const q = kataKunci.trim();
  if (q.length < 2) return [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&countrycodes=id&limit=5&accept-language=id`,
      {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (resp.ok) {
      const data = (await resp.json()) as Array<{
        name?: string;
        display_name?: string;
        lat: string;
        lon: string;
      }>;

      return data.map((d) => ({
        nama: d.name || d.display_name?.split(',')[0] || q,
        alamatLengkap: d.display_name || '',
        lat: Number(d.lat),
        lng: Number(d.lon),
      }));
    }
  } catch (e) {
    console.warn('Gagal cari tempat:', e);
  }
  return [];
}
