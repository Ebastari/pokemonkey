/**
 * Grafik realisasi reklamasi untuk halaman bagikan memo (/lihat/memo) — gaya
 * slide Monkey Point, sama dengan components/GrafikReklamasi.tsx: kartu putih
 * berbingkai hitam, kotak angka, batang bertumpuk APL + Hutan (PPKH) per tahun,
 * batang mendatar per jenis kegiatan dan per blok. HTML + gaya sebaris (CSP: tanpa skrip).
 */

import type { BlokGrafik } from './memo-blok';

export interface BarisReklamasi {
  tahun: number; apl: number; hutan: number; ipd: number; opd: number; timbunan_soil: number; fasilitas: number;
  blok: Record<string, number>;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Jumlah lewat mili-hektare agar sama persis dengan aplikasi (lib/revegetasi.ts jumlah). */
const jumlah = (n: number[]) => n.reduce((a, x) => a + Math.round(x * 1000), 0) / 1000;
const ha = (n: number) => n.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const totalTahun = (b: BarisReklamasi) => jumlah([b.apl, b.hutan]);
const HITAM = '#0f172a';
const PIKSEL = "font-family:'Press Start 2P',monospace";

export function htmlGrafikReklamasi(g: BlokGrafik, semua: BarisReklamasi[]): string {
  const baris = semua.filter((b) => (!g.dari || b.tahun >= g.dari) && (!g.sampai || b.tahun <= g.sampai)).sort((a, b) => a.tahun - b.tahun);
  const tahunan = g.tampil === 'tahun' || g.tampil === 'lengkap';
  const rentang = baris.length ? `${baris[0].tahun}–${baris[baris.length - 1].tahun}` : '';
  const kotak = (isi: string, tambahan = '') => `<div style="background:#fff;border:2px solid ${HITAM};box-shadow:3px 3px 0 ${HITAM};${tambahan}">${isi}</div>`;
  const keluar: string[] = [
    `<div style="border-bottom:2px solid #047857;padding-bottom:6px;margin-bottom:12px"><div style="${PIKSEL};font-size:11px;color:#022c22">${tahunan ? 'REALISASI PROGRES REKLAMASI' : 'RINCIAN REALISASI REKLAMASI'}</div>`
    + `<div style="font-size:12px;color:#475569;margin-top:4px">${!baris.length ? 'Data realisasi tidak tersedia' : tahunan ? `Per tahun ${rentang}, status kawasan APL dan Hutan (PPKH)` : `Akumulasi ${rentang} · per jenis kegiatan dan per blok`}</div></div>`,
  ];
  if (baris.length && tahunan) {
    const apl = jumlah(baris.map((b) => b.apl));
    const hutan = jumlah(baris.map((b) => b.hutan));
    const terakhir = [...baris].reverse().find((b) => totalTahun(b) > 0) ?? null;
    const maks = Math.max(...baris.map(totalTahun), 0.001);
    const stat: [string, number, string, string][] = [
      ['TOTAL REALISASI', jumlah([apl, hutan]), '#064e3b', HITAM], ['KAWASAN APL', apl, '#16a34a', HITAM], ['KAWASAN HUTAN (PPKH)', hutan, '#065f46', HITAM],
      ...(terakhir ? [[`TAHUN ${terakhir.tahun}`, totalTahun(terakhir), '#92400e', '#b45309'] as [string, number, string, string]] : []),
    ];
    keluar.push(`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:12px">${stat.map(([l, n, w, garis]) => kotak(
      `<div style="font-size:10px;font-weight:700;color:#64748b">${esc(l)}</div><div style="${PIKSEL};font-size:10px;color:${w};margin-top:3px">${ha(n)} HA</div>`,
      `padding:6px 8px;border-color:${garis}`,
    )).join('')}</div>`);
    keluar.push(`<div style="display:flex;gap:12px;font-size:11px;font-weight:700;color:#334155;margin-bottom:4px">`
      + `<span><span style="display:inline-block;width:10px;height:10px;background:#16a34a;border:1px solid ${HITAM};vertical-align:-1px"></span> APL</span>`
      + `<span><span style="display:inline-block;width:10px;height:10px;background:#065f46;border:1px solid ${HITAM};vertical-align:-1px"></span> Hutan (PPKH)</span></div>`);
    const skala = 88 / maks;
    keluar.push(`<div style="display:flex;align-items:flex-end;gap:4px;height:200px;border-bottom:2px solid ${HITAM}">${baris.map((b) => (
      `<div style="flex:1 1 0;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center">`
      + `<span style="font-size:9px;font-weight:700;color:#1e293b;margin-bottom:2px">${ha(totalTahun(b))}</span>`
      + `<div style="width:60%;height:${b.hutan * skala}%;background:#065f46;border:1px solid ${HITAM}"></div>`
      + `<div style="width:60%;height:${b.apl * skala}%;background:#16a34a;border:1px solid ${HITAM};border-top:0"></div></div>`
    )).join('')}</div>`);
    keluar.push(`<div style="display:flex;gap:4px;margin-top:4px">${baris.map((b) => `<span style="flex:1 1 0;text-align:center;${PIKSEL};font-size:7px;color:#334155">${b.tahun}</span>`).join('')}</div>`);
  }
  if (baris.length && g.tampil !== 'tahun') {
    const blok = new Map<string, number[]>();
    for (const b of baris) for (const [nama, luas] of Object.entries(b.blok ?? {})) blok.set(nama, [...(blok.get(nama) ?? []), luas]);
    const panel = (judul: string, data: [string, number][], warna: string, warnaJudul: string) => {
      const maks = Math.max(...data.map(([, n]) => n), 0.001);
      return kotak(`<div style="${PIKSEL};font-size:9px;color:${warnaJudul};margin-bottom:8px">${judul}</div>${data.map(([nama, n]) => (
        `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span style="width:110px;flex:none;font-size:11px;font-weight:700;color:#1e293b">${esc(nama)}</span>`
        + `<div style="height:13px;width:${Math.max(0, (n / maks) * 60)}%;background:${warna};border:1px solid ${HITAM}"></div>`
        + `<span style="font-size:10px;font-weight:700;color:#334155;white-space:nowrap">${ha(n)} ha</span></div>`
      )).join('')}`, 'padding:10px');
    };
    const isi: string[] = [];
    if (g.tampil === 'kegiatan' || g.tampil === 'lengkap') {
      isi.push(panel('PER JENIS KEGIATAN', [
        ['IPD', jumlah(baris.map((b) => b.ipd))], ['OPD', jumlah(baris.map((b) => b.opd))],
        ['Timbunan Soil', jumlah(baris.map((b) => b.timbunan_soil))], ['Fasilitas Penunjang', jumlah(baris.map((b) => b.fasilitas))],
      ], '#d97706', '#92400e'));
    }
    if (g.tampil === 'blok' || g.tampil === 'lengkap') {
      isi.push(panel('PER BLOK', [...blok].map(([nama, l]) => [nama, jumlah(l)] as [string, number]).sort((a, b) => b[1] - a[1]), '#0284c7', '#075985'));
    }
    keluar.push(`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-top:12px">${isi.join('')}</div>`);
  }
  keluar.push('<div style="font-size:10px;color:#64748b;text-align:right;margin-top:8px">Sumber: Realisasi Permintaan Amdal (Summary) · hektare</div>');
  return `<div style="margin:10px 0;background:#f8fafc;border:2px solid ${HITAM};box-shadow:4px 4px 0 ${HITAM};padding:12px;color:${HITAM}">${keluar.join('')}</div>`;
}
