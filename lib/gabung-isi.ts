/**
 * Gabung tiga arah (diff3) per baris untuk isi memo — dipakai saat dua orang
 * menyunting memo yang sama: perubahan kita dan perubahan orang lain sama-sama
 * dipertahankan selama tidak menyentuh baris yang sama. Satu blok memo = satu
 * baris, jadi ini setara "last writer wins per blok" di Notion: bila baris yang
 * sama diubah keduanya, versi kita yang dipakai dan dihitung sebagai bentrok.
 */

/** Pasangan LCS: untuk tiap baris `a`, indeks baris `b` yang sama (atau -1). */
function petaLcs(a: string[], b: string[]): Int32Array {
  const peta = new Int32Array(a.length).fill(-1);
  // Awal & akhir yang sama dipasangkan langsung (suntingan biasanya setempat), sisa tengah lewat DP.
  let awal = 0;
  while (awal < a.length && awal < b.length && a[awal] === b[awal]) { peta[awal] = awal; awal += 1; }
  let ea = a.length;
  let eb = b.length;
  while (ea > awal && eb > awal && a[ea - 1] === b[eb - 1]) { ea -= 1; eb -= 1; peta[ea] = eb; }
  const n = ea - awal;
  const m = eb - awal;
  if (n === 0 || m === 0) return peta;
  if (n * m > 4_000_000) return peta; // terlalu besar: anggap tengahnya berganti seluruhnya
  const dp = new Uint16Array((n + 1) * (m + 1));
  const lebar = m + 1;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i * lebar + j] = a[awal + i] === b[awal + j]
        ? dp[(i + 1) * lebar + j + 1] + 1
        : Math.max(dp[(i + 1) * lebar + j], dp[i * lebar + j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[awal + i] === b[awal + j]) { peta[awal + i] = awal + j; i += 1; j += 1; }
    else if (dp[(i + 1) * lebar + j] >= dp[i * lebar + j + 1]) i += 1;
    else j += 1;
  }
  return peta;
}

const sama = (x: string[], y: string[]) => x.length === y.length && x.every((v, i) => v === y[i]);

/** Perbedaan per baris (untuk pratinjau perubahan AI): sama / tambah / hapus. */
export function bedaBaris(lama: string, baru: string): { t: 'sama' | 'tambah' | 'hapus'; v: string }[] {
  const L = lama.split('\n');
  const B = baru.split('\n');
  const peta = petaLcs(L, B);
  const hasil: { t: 'sama' | 'tambah' | 'hapus'; v: string }[] = [];
  let j = 0;
  L.forEach((v, i) => {
    if (peta[i] < 0) { hasil.push({ t: 'hapus', v }); return; }
    while (j < peta[i]) { hasil.push({ t: 'tambah', v: B[j] }); j += 1; }
    hasil.push({ t: 'sama', v });
    j += 1;
  });
  while (j < B.length) { hasil.push({ t: 'tambah', v: B[j] }); j += 1; }
  return hasil;
}

/**
 * Tambahkan baris di bawah memo tanpa dobel: baris yang sudah ada dilewati. Bila `bagian`
 * diberi (mis. "Tindak lanjut") dan judul itu sudah ada, baris masuk di akhir bagian itu;
 * bila belum, judul bagian dibuat sekali di akhir memo.
 */
export function tambahDiBawah(isi: string, tambahan: string, bagian?: string): string {
  const ada = new Set(isi.split('\n').map((b) => b.trim()).filter(Boolean));
  const baru = tambahan.replace(/\s+$/, '').split('\n').filter((b) => !b.trim() || !ada.has(b.trim()));
  if (!baru.some((b) => b.trim())) return isi;
  const baris = isi.replace(/\s+$/, '').split('\n');
  const kosong = !isi.trim();
  if (bagian) {
    const tingkat = (b: string) => (b.match(/^(#{1,4}) /)?.[1].length ?? 0);
    const i = baris.findIndex((b) => tingkat(b) > 0 && b.replace(/^#+ /, '').trim().toLowerCase() === bagian.toLowerCase());
    if (i >= 0) {
      let j = i + 1;
      while (j < baris.length && !(tingkat(baris[j]) > 0 && tingkat(baris[j]) <= tingkat(baris[i]))) j += 1;
      let k = j;
      while (k > i + 1 && !baris[k - 1].trim()) k -= 1;
      baris.splice(k, 0, ...baru.filter((b) => b.trim()));
      return baris.join('\n');
    }
    return [...(kosong ? [] : [...baris, '']), `## ${bagian}`, ...baru].join('\n');
  }
  return [...(kosong ? [] : [...baris, '']), ...baru].join('\n');
}

/** Gabungkan `kita` dan `mereka` yang sama-sama berangkat dari `dasar`. */
export function gabungTigaArah(dasar: string, kita: string, mereka: string): { isi: string; bentrok: number } {
  if (kita === mereka || mereka === dasar) return { isi: kita, bentrok: 0 };
  if (kita === dasar) return { isi: mereka, bentrok: 0 };
  const D = dasar.split('\n');
  const A = kita.split('\n');
  const B = mereka.split('\n');
  const pa = petaLcs(D, A);
  const pb = petaLcs(D, B);
  const hasil: string[] = [];
  let bentrok = 0;
  let [di, ai, bi] = [0, 0, 0];
  const potong = (dz: number, az: number, bz: number) => {
    const d = D.slice(di, dz);
    const a = A.slice(ai, az);
    const b = B.slice(bi, bz);
    if (sama(a, d)) hasil.push(...b);
    else if (sama(b, d) || sama(a, b)) hasil.push(...a);
    else { hasil.push(...a); bentrok += 1; }
  };
  for (let i = 0; i < D.length; i += 1) {
    // Jangkar: baris dasar yang masih ada di kedua sisi.
    if (pa[i] >= ai && pb[i] >= bi) {
      potong(i, pa[i], pb[i]);
      hasil.push(D[i]);
      [di, ai, bi] = [i + 1, pa[i] + 1, pb[i] + 1];
    }
  }
  potong(D.length, A.length, B.length);
  return { isi: hasil.join('\n'), bentrok };
}
