import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { wilayahFire } from '../lib/wilayah-fire';
import type { TitikApiFireItem } from '../lib/fire-report';
import { Flame, Layers, Maximize, MapPin, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  titikList: TitikApiFireItem[];
  titikTerpilihIds: string[];
  titikFokus: TitikApiFireItem | null;
  onPilihTitik: (titik: TitikApiFireItem) => void;
  onTogglePilihLaporan: (titikId: string) => void;
  /** Peta panas: tiap titik jadi lingkaran merah transparan; yang menumpuk tampak makin pekat. */
  panas?: boolean;
}

export const FireMap: React.FC<Props> = ({
  titikList,
  titikTerpilihIds,
  titikFokus,
  onPilihTitik,
  onTogglePilihLaporan,
  panas = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [bukaLegenda, setBukaLegenda] = useState<boolean>(false);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Wilayah aktif: poligon perusahaan di mode kerja, wilayah contoh di sekitar
    // kota pilihan di mode demo.
    const wilayah = wilayahFire();
    const idn = wilayah.identitas;

    // Inisialisasi peta Leaflet
    const map = L.map(mapContainerRef.current, {
      center: wilayah.pusat,
      zoom: wilayah.zoom,
      zoomControl: false,
    });
    mapInstanceRef.current = map;

    // Zoom control di pojok kanan bawah
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Observer untuk mendeteksi perubahan ukuran kontainer peta (misal saat tabel diperbesar)
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    // Layer Satelit Esri (Default)
    const satelitEsri = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: '&copy; Esri & NASA',
      },
    );

    // Layer OpenStreetMap (Alternatif)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    });

    satelitEsri.addTo(map);

    // Pengontrol Layer
    const baseLayers = {
      'Citra Satelit': satelitEsri,
      'Peta Jalan (OSM)': osm,
    };
    L.control.layers(baseLayers, undefined, { position: 'topright' }).addTo(map);

    // -------------------------------------------------------------------------
    // 1. Layer Poligon IUP PT EBL (Warna Cyan / Biru Langit)
    // -------------------------------------------------------------------------
    wilayah.iup.forEach((item) => {
      item.poligon.forEach((multi) => {
        const latLngs = multi.map((ring) => ring.map(([lon, lat]) => [lat, lon] as [number, number]));
        L.polygon(latLngs, {
          color: '#00e5ff',
          weight: 2.5,
          opacity: 0.9,
          fillColor: '#00e5ff',
          fillOpacity: 0.12,
          dashArray: '4, 4',
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: monospace; font-size: 11px;">
              <b style="color: #00838f;">${wilayah.demo ? item.nama : 'KONSESI IUP PT EBL'}</b><br>
              ${wilayah.demo ? `Wilayah kerja ${idn.perusahaan} (contoh)` : 'Area Izin Usaha Pertambangan Operasi Produksi'}<br>
              Status: ${wilayah.demo ? 'Data contoh' : 'Wilayah Tambang Aktif'}
            </div>`,
          );
      });
    });

    // -------------------------------------------------------------------------
    // 2. Layer Poligon IPPKH / PPKH PT EBL (Warna Hijau Lime / Emerald)
    // -------------------------------------------------------------------------
    wilayah.ippkh.forEach((item) => {
      item.poligon.forEach((multi) => {
        const latLngs = multi.map((ring) => ring.map(([lon, lat]) => [lat, lon] as [number, number]));
        L.polygon(latLngs, {
          color: '#22c55e',
          weight: 2.5,
          opacity: 0.95,
          fillColor: '#22c55e',
          fillOpacity: 0.25,
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: monospace; font-size: 11px;">
              <b style="color: #15803d;">${wilayah.demo ? item.nama : `AREA IPPKH / PPKH PT EBL (${item.nama})`}</b><br>
              ${item.keterangan || 'Kawasan Hutan Produksi Terbatas'}<br>
              <i>Prioritas Pengendalian Karhutla KLHK</i>
            </div>`,
          );
      });
    });

    // -------------------------------------------------------------------------
    // 3. Layer Poligon Petak Rehabilitasi DAS (Warna Kuning Emas / Amber)
    // -------------------------------------------------------------------------
    wilayah.das.forEach((item) => {
      item.poligon.forEach((multi) => {
        const latLngs = multi.map((ring) => ring.map(([lon, lat]) => [lat, lon] as [number, number]));
        L.polygon(latLngs, {
          color: '#eab308',
          weight: 1.8,
          opacity: 0.9,
          fillColor: '#eab308',
          fillOpacity: 0.22,
        })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: monospace; font-size: 11px;">
              <b style="color: #b45309;">${wilayah.demo ? item.nama : `REHABILITASI DAS (${item.nama})`}</b><br>
              Area Penanaman ${idn.kawasanDas}<br>
              <i>Wajib Pantau Bebas Titik Api</i>
            </div>`,
          );
      });
    });

    // Layer grup untuk titik api
    markersLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update marker titik api setiap kali `titikList` atau pilihan berubah
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (panas) {
      titikList.forEach((t) => {
        const wajib = t.zona === 'ippkh' || t.zona === 'iup' || t.zona === 'petak';
        L.circle([t.lat, t.lon], { radius: 900, stroke: false, fillColor: wajib ? '#dc2626' : '#f59e0b', fillOpacity: 0.16 }).addTo(layer);
        L.circle([t.lat, t.lon], { radius: 350, stroke: false, fillColor: wajib ? '#ef4444' : '#fbbf24', fillOpacity: 0.28 })
          .addTo(layer)
          .on('click', () => onPilihTitik(t));
      });
      return;
    }

    titikList.forEach((t) => {
      const diDalam = t.zona === 'ippkh' || t.zona === 'iup' || t.zona === 'petak';
      const isWaspada = t.zona === 'waspada';
      const terpilihLaporan = titikTerpilihIds.includes(t.id);

      // Warna badge api
      let bgWarna = 'bg-blue-600';
      let borderWarna = 'border-blue-400';
      let teksZona = 'PANTAU';

      if (t.zona === 'ippkh') {
        bgWarna = 'bg-red-600 animate-pulse';
        borderWarna = 'border-yellow-300';
        teksZona = 'IPPKH';
      } else if (t.zona === 'iup') {
        bgWarna = 'bg-red-600 animate-pulse';
        borderWarna = 'border-red-400';
        teksZona = 'IUP';
      } else if (t.zona === 'petak') {
        bgWarna = 'bg-orange-600 animate-pulse';
        borderWarna = 'border-amber-300';
        teksZona = 'DAS';
      } else if (isWaspada) {
        bgWarna = 'bg-amber-600';
        borderWarna = 'border-amber-400';
        teksZona = 'WASPADA';
      }

      const html = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; transform: translate(-50%, -100%);">
          <div style="background-color: ${
            diDalam ? '#dc2626' : isWaspada ? '#d97706' : '#2563eb'
          }; border: 2px solid ${
        terpilihLaporan ? '#fde047' : '#ffffff'
      }; border-radius: 9999px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(0,0,0,0.8);">
            <span style="font-size: 15px;">🔥</span>
          </div>
          <div style="background-color: #000000; color: #ffffff; border: 1px solid rgba(255,255,255,0.4); padding: 1px 4px; font-size: 8px; font-family: monospace; font-weight: bold; border-radius: 3px; margin-top: 2px; white-space: nowrap;">
            ${teksZona}
          </div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'marker-api-bersih',
        html,
        iconSize: [30, 42],
        iconAnchor: [15, 42],
      });

      const marker = L.marker([t.lat, t.lon], { icon }).addTo(layer);

      marker.on('click', () => {
        onPilihTitik(t);
      });

      const popupContent = document.createElement('div');
      popupContent.style.fontFamily = 'monospace';
      popupContent.style.fontSize = '11px';
      popupContent.style.minWidth = '200px';

      popupContent.innerHTML = `
        <div style="border-bottom: 2px solid #ccc; padding-bottom: 4px; margin-bottom: 4px;">
          <b style="color: ${diDalam ? '#b91c1c' : '#c2410c'}; font-size: 12px;">
            ${diDalam ? '⚠️ TITIK API DI DALAM KONSESI' : '📍 DETEKSI TITIK API'}
          </b>
        </div>
        <div><b>Zona:</b> ${t.zona.toUpperCase()}${t.bidang ? ` (${t.bidang})` : ''}</div>
        <div><b>Koordinat:</b> ${t.lat.toFixed(5)}, ${t.lon.toFixed(5)}</div>
        <div><b>Satelit:</b> ${t.sumber} · Conf: ${t.keyakinan}</div>
        <div><b>Waktu:</b> ${new Date(t.waktu).toLocaleString('id-ID')}</div>
        <div><b>Lokasi:</b> ${t.desa || '-'}, ${t.kecamatan || '-'}</div>
        <div style="margin-top: 6px; padding-top: 4px; border-top: 1px dashed #ccc;">
          ${
            diDalam
              ? `<button id="btn-toggle-${t.id}" style="width: 100%; background: #dc2626; color: white; border: none; padding: 4px 8px; font-weight: bold; font-size: 10px; cursor: pointer; border-radius: 2px;">
                  ${terpilihLaporan ? '✓ Terpilih di Laporan (Hapus)' : '+ Masukkan ke Laporan'}
                </button>`
              : `<span style="color: #64748b; font-size: 10px; font-style: italic;">Di luar area IUP/IPPKH/DAS (Hanya pemantauan waspada).</span>`
          }
        </div>
      `;

      marker.bindPopup(popupContent);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-toggle-${t.id}`);
        if (btn) {
          btn.onclick = () => {
            onTogglePilihLaporan(t.id);
            marker.closePopup();
          };
        }
      });
    });
  }, [titikList, titikTerpilihIds, onPilihTitik, onTogglePilihLaporan, panas]);

  // Efek fokus bila ada titik tertentu yang dipilih dari daftar
  useEffect(() => {
    if (!titikFokus || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([titikFokus.lat, titikFokus.lon], 16, { duration: 1.2 });
  }, [titikFokus]);

  // Tombol navigasi cepat: menuju tengah poligon wilayah aktif (asli atau contoh).
  const wilayah = wilayahFire();
  const idn = wilayah.identitas;
  const tengah = (daftar: typeof wilayah.iup): [number, number] | null => {
    const titik = daftar.flatMap((b) => b.poligon.flatMap((m) => m[0] ?? []));
    if (!titik.length) return null;
    const lat = titik.reduce((a, [, y]) => a + y, 0) / titik.length;
    const lon = titik.reduce((a, [x]) => a + x, 0) / titik.length;
    return [lat, lon];
  };
  const handleFokusTambang = () => {
    const t = tengah([...wilayah.iup, ...wilayah.ippkh]) ?? wilayah.pusat;
    mapInstanceRef.current?.flyTo(t, wilayah.zoom, { duration: 1 });
  };

  const handleFokusRehabDas = () => {
    const t = tengah(wilayah.das) ?? wilayah.pusat;
    mapInstanceRef.current?.flyTo(t, wilayah.zoom + 1, { duration: 1 });
  };

  return (
    <div className="relative w-full h-full min-h-[160px] bg-zinc-950 border-2 border-white/30 overflow-hidden shadow-inner">
      {/* Kontainer Peta Leaflet */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Kontrol Pintas Navigasi Cepat (Overlay Kiri Atas) */}
      <div className="absolute top-2 left-2 z-[400] flex flex-wrap items-center gap-1.5 bg-black/85 backdrop-blur-sm p-1.5 border border-white/30 text-[11px] shadow-lg">
        <button
          onClick={handleFokusTambang}
          className="btn-retro btn-retro-sm bg-cyan-800 hover:bg-cyan-700 text-white font-bold flex items-center gap-1 !py-0.5 text-[10px]"
          title={`Fokus ke ${idn.labelIup} & ${idn.labelIppkh}`}
        >
          <MapPin size={11} /> {wilayah.demo ? 'Area kerja' : 'IUP & IPPKH'}
        </button>
        <button
          onClick={handleFokusRehabDas}
          className="btn-retro btn-retro-sm bg-amber-800 hover:bg-amber-700 text-white font-bold flex items-center gap-1 !py-0.5 text-[10px]"
          title={`Fokus ke petak di ${idn.kawasanDas}`}
        >
          <MapPin size={11} /> {wilayah.demo ? 'Petak' : 'Rehab DAS'}
        </button>
        <button
          onClick={() => setBukaLegenda((prev) => !prev)}
          className={`btn-retro btn-retro-sm font-bold flex items-center gap-1 !py-0.5 text-[10px] transition-colors ${
            bukaLegenda ? 'bg-orange-600 text-white border-orange-400' : 'bg-zinc-800 text-zinc-300 hover:text-white'
          }`}
          title="Tampilkan / Sembunyikan Legenda Wilayah"
        >
          <Layers size={11} />
          <span>Legenda</span>
          {bukaLegenda ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
      </div>

      {/* Legenda Peta (Overlay Melayang Ketika Dibuka) */}
      {bukaLegenda && (
        <div className="absolute top-11 left-2 z-[400] bg-black/90 backdrop-blur-md p-2.5 border-2 border-white/40 text-[10px] font-mono space-y-1.5 shadow-2xl rounded-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="font-bold text-white uppercase text-[9px] mb-1 pb-1 border-b border-white/20 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1">
              <Layers size={11} className="text-orange-400" /> {wilayah.demo ? 'Legenda Wilayah Contoh' : 'Legenda Wilayah Konsesi'}
            </span>
            <button
              onClick={() => setBukaLegenda(false)}
              className="text-zinc-400 hover:text-white text-[10px]"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-2.5 border border-cyan-400 bg-cyan-400/20 inline-block shrink-0" />
            <span className="text-cyan-300 font-semibold">{wilayah.demo ? 'Batas area kerja' : 'Batas IUP PT EBL'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-2.5 border border-emerald-400 bg-emerald-400/30 inline-block shrink-0" />
            <span className="text-emerald-300 font-semibold">{wilayah.demo ? 'Area izin' : 'Area IPPKH (SK.78 / SK.892 / SK.966)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-2.5 border border-yellow-400 bg-yellow-400/30 inline-block shrink-0" />
            <span className="text-yellow-300 font-semibold">{wilayah.demo ? 'Petak tanam' : 'Petak Tanam DAS Tahura'}</span>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-white/20">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block animate-pulse shrink-0" />
            <span className="text-red-300 font-bold">Titik Api Di Dalam (Wajib Lapor)</span>
          </div>
        </div>
      )}
    </div>
  );
};
