/**
 * Generator Otomatis Screenshot Peta GIS & Utilitas Kompresi Gambar
 * Menghasilkan tangkapan layar peta resmi resolusi tinggi (Canvas WGS 1984)
 * dengan poligon konsesi IUP, IPPKH, Petak Rehab DAS, serta titik api terverifikasi.
 */

import { wilayahFire, anonimkanTeks } from './wilayah-fire';
import type { KoordinatLaporan } from './fire-report';

export interface OpsiMapSnapshot {
  titikKoordinat: KoordinatLaporan[];
  jenisIzin: string; // 'PPKH' | 'IUP' | 'Rehabilitasi DAS' | string
  nomorLaporan?: string;
  tanggalLaporan?: string;
  width?: number;
  height?: number;
}

/**
 * Utilitas untuk mengompres gambar yang diunggah pengguna agar aman di localStorage.
 * Mengubah foto kamera berukuran besar (misal 8MB) menjadi ~150KB JPEG dengan resolusi optimal.
 */
export function kompresGambar(
  file: File,
  maxDimensi = 1400,
  kualitas = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('File bukan gambar yang valid'));
      img.onload = () => {
        let w = img.width;
        let h = img.height;

        if (w > maxDimensi || h > maxDimensi) {
          if (w > h) {
            h = Math.round((h * maxDimensi) / w);
            w = maxDimensi;
          } else {
            w = Math.round((w * maxDimensi) / h);
            h = maxDimensi;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        // Gambar latar putih (untuk transparansi PNG jika ada)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL('image/jpeg', kualitas);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Generator Screenshot Peta GIS Resmi
 * Menghasilkan berkas gambar JPEG Data URL berkualitas tinggi
 */
export async function buatScreenshotPetaOtomatis(
  opsi: OpsiMapSnapshot,
): Promise<string> {
  const width = opsi.width || 1200;
  const height = opsi.height || 720;

  const isDas =
    opsi.jenisIzin.toLowerCase().includes('das') ||
    opsi.jenisIzin.toLowerCase().includes('rehab');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context tidak tersedia');

  // Mode demo: nama perusahaan, kawasan, dan nomor SK pada gambar diganti teks contoh.
  const tulisAsli = ctx.fillText.bind(ctx);
  ctx.fillText = (teks: string, x: number, y: number, lebarMaks?: number) =>
    (lebarMaks === undefined ? tulisAsli(anonimkanTeks(String(teks)), x, y) : tulisAsli(anonimkanTeks(String(teks)), x, y, lebarMaks));

  // 1. Tentukan Bounding Box (Rentang Geografis Min & Max)
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  if (opsi.titikKoordinat.length > 0) {
    opsi.titikKoordinat.forEach((t) => {
      if (t.xBujur < minLon) minLon = t.xBujur;
      if (t.xBujur > maxLon) maxLon = t.xBujur;
      if (t.yLintang < minLat) minLat = t.yLintang;
      if (t.yLintang > maxLat) maxLat = t.yLintang;
    });
  } else {
    // Default konsesi jika titik kosong
    if (isDas) {
      minLon = 114.935;
      maxLon = 114.945;
      minLat = -3.542;
      maxLat = -3.53;
    } else {
      minLon = 115.21;
      maxLon = 115.235;
      minLat = -2.965;
      maxLat = -2.952;
    }
  }

  // Sertakan koordinat poligon wilayah terkait agar tampak dalam frame peta
  if (isDas) {
    wilayahFire().das.forEach((item) => {
      item.poligon.forEach((multi) => {
        multi.forEach((ring) => {
          ring.forEach(([lon, lat]) => {
            // Hanya perlebar jika dekat dengan titik fokus (radius ~0.05 derajat)
            if (Math.abs(lon - minLon) < 0.05 && Math.abs(lat - minLat) < 0.05) {
              if (lon < minLon) minLon = lon;
              if (lon > maxLon) maxLon = lon;
              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
            }
          });
        });
      });
    });
  } else {
    wilayahFire().ippkh.forEach((item) => {
      item.poligon.forEach((multi) => {
        multi.forEach((ring) => {
          ring.forEach(([lon, lat]) => {
            if (Math.abs(lon - minLon) < 0.05 && Math.abs(lat - minLat) < 0.05) {
              if (lon < minLon) minLon = lon;
              if (lon > maxLon) maxLon = lon;
              if (lat < minLat) minLat = lat;
              if (lat > maxLat) maxLat = lat;
            }
          });
        });
      });
    });
  }

  // Tambahkan bantalan (padding) 25% di sekeliling peta
  const spanLon = Math.max(maxLon - minLon, 0.012);
  const spanLat = Math.max(maxLat - minLat, 0.008);
  const padLon = spanLon * 0.25;
  const padLat = spanLat * 0.25;

  const boundMinLon = minLon - padLon;
  const boundMaxLon = maxLon + padLon;
  const boundMinLat = minLat - padLat;
  const boundMaxLat = maxLat + padLat;

  // Margin peta untuk bingkai koordinat
  const marginL = 50;
  const marginR = 30;
  const marginT = 65;
  const marginB = 45;
  const mapW = width - marginL - marginR;
  const mapH = height - marginT - marginB;

  // Fungsi konversi Koordinat Geografis (WGS84) ke Piksel Canvas
  const lonToX = (lon: number) => {
    return marginL + ((lon - boundMinLon) / (boundMaxLon - boundMinLon)) * mapW;
  };
  const latToY = (lat: number) => {
    // Lintang makin ke utara makin kecil nilai Y pada kanvas
    return marginT + ((boundMaxLat - lat) / (boundMaxLat - boundMinLat)) * mapH;
  };

  // ---------------------------------------------------------------------------
  // 2. Gambar Latar Belakang (Citra Satelit / Topografi Terarsir)
  // ---------------------------------------------------------------------------
  // Warna latar belakang dasar (Topografi medan gelap satelit)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  if (isDas) {
    // Hijau hutan pegunungan Meratus / Tahura Sultan Adam
    bgGrad.addColorStop(0, '#102216');
    bgGrad.addColorStop(0.5, '#152e1e');
    bgGrad.addColorStop(1, '#0b190f');
  } else {
    // Area perbukitan batubara & tambang Tapin
    bgGrad.addColorStop(0, '#161c22');
    bgGrad.addColorStop(0.5, '#1e2630');
    bgGrad.addColorStop(1, '#11151a');
  }
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Gambar tekstur kontur elevasi sintetis yang elegan
  ctx.save();
  ctx.strokeStyle = isDas ? 'rgba(34, 197, 94, 0.07)' : 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let y = marginT; y < height - marginB; y += 18) {
    ctx.beginPath();
    ctx.moveTo(marginL, y);
    for (let x = marginL; x < width - marginR; x += 30) {
      const wobble = Math.sin((x + y) * 0.03) * 6;
      ctx.lineTo(x, y + wobble);
    }
    ctx.stroke();
  }
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 3. Gambar Kisi-Kisi Koordinat Geografis (Grid Lines)
  // ---------------------------------------------------------------------------
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);

  const stepLon = spanLon > 0.03 ? 0.01 : 0.005;
  const startLon = Math.ceil(boundMinLon / stepLon) * stepLon;
  for (let lon = startLon; lon <= boundMaxLon; lon += stepLon) {
    const x = lonToX(lon);
    if (x >= marginL && x <= width - marginR) {
      ctx.beginPath();
      ctx.moveTo(x, marginT);
      ctx.lineTo(x, height - marginB);
      ctx.stroke();

      // Label Lintang Bawah
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${lon.toFixed(3)}°E`, x, height - marginB + 14);
    }
  }

  const stepLat = spanLat > 0.02 ? 0.01 : 0.005;
  const startLat = Math.ceil(boundMinLat / stepLat) * stepLat;
  for (let lat = startLat; lat <= boundMaxLat; lat += stepLat) {
    const y = latToY(lat);
    if (y >= marginT && y <= height - marginB) {
      ctx.beginPath();
      ctx.moveTo(marginL, y);
      ctx.lineTo(width - marginR, y);
      ctx.stroke();

      // Label Bujur Kiri
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${lat.toFixed(3)}°S`, marginL - 6, y + 3);
    }
  }
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 4. Gambar Poligon Batas Konsesi
  // ---------------------------------------------------------------------------
  // A. Poligon IUP PT EBL (Warna Cyan)
  if (!isDas) {
    wilayahFire().iup.forEach((item) => {
      item.poligon.forEach((multi) => {
        multi.forEach((ring) => {
          ctx.save();
          ctx.beginPath();
          ring.forEach(([lon, lat], i) => {
            const x = lonToX(lon);
            const y = latToY(lat);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(0, 229, 255, 0.06)';
          ctx.fill();
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.restore();
        });
      });
    });

    // B. Poligon IPPKH PT EBL (Warna Emerald)
    wilayahFire().ippkh.forEach((item) => {
      item.poligon.forEach((multi) => {
        multi.forEach((ring) => {
          ctx.save();
          ctx.beginPath();
          ring.forEach(([lon, lat], i) => {
            const x = lonToX(lon);
            const y = latToY(lat);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
          ctx.fill();
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([]);
          ctx.stroke();

          // Label nama blok IPPKH
          if (ring[0]) {
            const lx = lonToX(ring[0][0]);
            const ly = latToY(ring[0][1]);
            ctx.fillStyle = '#86efac';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText(item.nama, lx + 5, ly - 5);
          }
          ctx.restore();
        });
      });
    });
  }

  // C. Poligon Petak Rehabilitasi DAS Tahura Sultan Adam (Warna Amber/Gold)
  if (isDas) {
    wilayahFire().das.forEach((item) => {
      item.poligon.forEach((multi) => {
        multi.forEach((ring) => {
          ctx.save();
          ctx.beginPath();
          ring.forEach(([lon, lat], i) => {
            const x = lonToX(lon);
            const y = latToY(lat);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.closePath();
          ctx.fillStyle = 'rgba(234, 179, 8, 0.22)';
          ctx.fill();
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
          ctx.stroke();

          // Label nama Petak DAS
          if (ring[0]) {
            const lx = lonToX(ring[0][0]);
            const ly = latToY(ring[0][1]);
            if (lx >= marginL && lx <= width - marginR && ly >= marginT && ly <= height - marginB) {
              ctx.fillStyle = '#fde047';
              ctx.font = 'bold 9px sans-serif';
              ctx.fillText(item.nama, lx + 3, ly - 3);
            }
          }
          ctx.restore();
        });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Gambar Titik Api Hotspot Terverifikasi
  // ---------------------------------------------------------------------------
  opsi.titikKoordinat.forEach((t) => {
    const px = lonToX(t.xBujur);
    const py = latToY(t.yLintang);

    ctx.save();
    // Efek sinar luar (Outer glow halo)
    const radGrad = ctx.createRadialGradient(px, py, 2, px, py, 36);
    radGrad.addColorStop(0, 'rgba(239, 68, 68, 0.9)');
    radGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.45)');
    radGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(px, py, 36, 0, Math.PI * 2);
    ctx.fill();

    // Lingkaran target bidik
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Titik pusat api
    ctx.fillStyle = '#ffedd5';
    ctx.beginPath();
    ctx.arc(px, py, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Garis bidik (Crosshair)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px - 16, py);
    ctx.lineTo(px + 16, py);
    ctx.moveTo(px, py - 16);
    ctx.lineTo(px, py + 16);
    ctx.stroke();

    // Kotak Keterangan Callout Badge Titik Api
    const labelW = 210;
    const labelH = 46;
    let badgeX = px + 22;
    let badgeY = py - 35;

    // Pastikan tidak meluap keluar kanvas
    if (badgeX + labelW > width - marginR - 10) {
      badgeX = px - labelW - 22;
    }
    if (badgeY < marginT + 10) {
      badgeY = py + 20;
    }

    // Garis penunjuk dari titik ke label
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(badgeX + (badgeX > px ? 0 : labelW), badgeY + labelH / 2);
    ctx.stroke();

    // Kotak badge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.8;
    ctx.fillRect(badgeX, badgeY, labelW, labelH);
    ctx.strokeRect(badgeX, badgeY, labelW, labelH);

    // Teks info titik
    ctx.fillStyle = '#fee2e2';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🔥 TITIK ${t.no} (${t.satelit})`, badgeX + 8, badgeY + 15);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`X: ${t.xBujur.toFixed(5)}  Y: ${t.yLintang.toFixed(5)}`, badgeX + 8, badgeY + 28);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '9px sans-serif';
    ctx.fillText(`${t.desa || 'Konsesi PT EBL'}`, badgeX + 8, badgeY + 40);

    ctx.restore();
  });

  // ---------------------------------------------------------------------------
  // 6. Bingkai Peta Luar & Garis Pembatas (Cartographic Border)
  // ---------------------------------------------------------------------------
  ctx.save();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.strokeRect(marginL, marginT, mapW, mapH);

  // Garis luar tipis dekoratif
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(marginL - 4, marginT - 4, mapW + 8, mapH + 8);
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 7. Header Atas Dokumen Resmi Peta
  // ---------------------------------------------------------------------------
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(0, 0, width, marginT - 5);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, marginT - 6);
  ctx.lineTo(width, marginT - 6);
  ctx.stroke();

  // Judul Peta
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(
    `PT. ENERGI BATUBARA LESTARI — PETA GROUND CHECK TITIK PANAS (HOTSPOT)`,
    marginL,
    22,
  );

  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px monospace';
  const subJudul = isDas
    ? `Areal Rehabilitasi DAS Tahura Sultan Adam · SK.498/MenLHK-PDASRH/2021 · Sistem WGS 1984`
    : `Area IPPKH / PPKH SK.78 & SK.6982 Tapin · Sistem Koordinat Geografis Datum WGS 1984`;
  ctx.fillText(subJudul, marginL, 38);

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`SUMBER: SIPONGI+ KLHK / NASA FIRMS`, width - marginR, 22);
  ctx.fillStyle = '#fde047';
  ctx.fillText(`TANGGAL: ${opsi.tanggalLaporan || new Date().toISOString().slice(0, 10)}`, width - marginR, 38);
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 8. Tanda Arah Mata Angin (North Arrow)
  // ---------------------------------------------------------------------------
  const compassX = width - marginR - 35;
  const compassY = marginT + 38;
  ctx.save();
  ctx.translate(compassX, compassY);

  // Lingkaran kompas
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Jarum Utara (Merah)
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(5, 0);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  ctx.fill();

  // Jarum Selatan (Putih)
  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(0, 16);
  ctx.lineTo(5, 0);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  ctx.fill();

  // Huruf U / N
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('U', 0, -18);
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 9. Skala Batang Grafis (Scale Bar)
  // ---------------------------------------------------------------------------
  const scaleX = marginL + 15;
  const scaleY = height - marginB - 25;
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.fillRect(scaleX - 6, scaleY - 14, 130, 26);
  ctx.strokeRect(scaleX - 6, scaleY - 14, 130, 26);

  // Garis skala 500m
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(scaleX, scaleY, 50, 4);
  ctx.fillStyle = '#000000';
  ctx.fillRect(scaleX + 50, scaleY, 50, 4);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(scaleX, scaleY, 100, 4);

  ctx.fillStyle = '#ffffff';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('0', scaleX, scaleY - 3);
  ctx.fillText('500m', scaleX + 50, scaleY - 3);
  ctx.fillText('1 km', scaleX + 100, scaleY - 3);
  ctx.restore();

  // ---------------------------------------------------------------------------
  // 10. Kotak Legenda Peta (Legend Box)
  // ---------------------------------------------------------------------------
  const legW = 230;
  const legH = isDas ? 100 : 115;
  const legX = width - marginR - legW - 12;
  const legY = height - marginB - legH - 12;

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.fillRect(legX, legY, legW, legH);
  ctx.strokeRect(legX, legY, legW, legH);

  // Judul Legenda
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LEGENDA PETA', legX + 10, legY + 16);

  let ly = legY + 32;

  // Item 1: Titik Panas Hotspot
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(legX + 16, ly - 3, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '9px sans-serif';
  ctx.fillText('Titik Panas Hotspot (Verifikasi)', legX + 28, ly);
  ly += 18;

  if (isDas) {
    // Item 2: Petak Rehab DAS
    ctx.fillStyle = 'rgba(234, 179, 8, 0.4)';
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;
    ctx.fillRect(legX + 10, ly - 8, 14, 10);
    ctx.strokeRect(legX + 10, ly - 8, 14, 10);
    ctx.fillStyle = '#fde047';
    ctx.fillText('Petak Rehabilitasi DAS Tahura', legX + 28, ly);
    ly += 18;

    // Item 3: Sekat Bakar
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(legX + 10, ly - 3);
    ctx.lineTo(legX + 24, ly - 3);
    ctx.stroke();
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('Jalur Sekat Bakar (Fire Break 4m)', legX + 28, ly);
  } else {
    // Item 2: Batas IPPKH
    ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.fillRect(legX + 10, ly - 8, 14, 10);
    ctx.strokeRect(legX + 10, ly - 8, 14, 10);
    ctx.fillStyle = '#86efac';
    ctx.fillText('Area IPPKH (SK.78 / SK.6982)', legX + 28, ly);
    ly += 18;

    // Item 3: Batas Konsesi IUP EBL
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(legX + 10, ly - 3);
    ctx.lineTo(legX + 24, ly - 3);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#67e8f9';
    ctx.fillText('Batas Konsesi IUP PT EBL', legX + 28, ly);
    ly += 18;

    // Item 4: Status Operasi
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '8px sans-serif';
    ctx.fillText('Kawasan Hutan Produksi Terbatas', legX + 28, ly);
  }
  ctx.restore();

  // Konversi kanvas ke Data URL JPEG dengan kualitas 0.92
  return canvas.toDataURL('image/jpeg', 0.92);
}
