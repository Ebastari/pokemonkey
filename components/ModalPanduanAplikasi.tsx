import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ZoomIn, ZoomOut, X, Download, Loader2 } from 'lucide-react';
import { MonkeySprite } from './MonkeySprite';
import { BaganMermaid } from './BaganMermaid';
import { contohPesanWa, type ContohWa } from '../lib/contoh-wa';
import { SKINS } from '../constants';
import { eksporLembarPdf } from '../lib/pdf-laporan';
import gambarLogin from '../aset/login-hero.webp';
import gambarShowcase from '../aset/showcase-devices.jpeg';

/**
 * Buku panduan POKEMONKEY — gaya sama dengan dokumen "Alur Notifikasi":
 * pita biru, judul Press Start 2P, kotak piksel berbayang tegas, dan bagan
 * alur di tiap bab. Tiap bab = satu `section[data-halaman]`, sehingga Export
 * PDF (lib/pdf-laporan.ts) memulai bab baru di halaman baru.
 *
 * Tata letak memakai container query (bukan lebar layar) agar hasil PDF sama
 * di HP maupun komputer.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Warna modul = warna tab di aplikasi (App.tsx · INFO_TAB).
const MODUL = {
  kebun: { label: 'KEBUN', warna: '#16a34a', ket: 'XP, level, stamina, cuaca, titik api' },
  pica: { label: 'PICA', warna: '#d97706', ket: 'Temuan & tindakan perbaikan' },
  jadwal: { label: 'JADWAL', warna: '#0891b2', ket: 'Agenda & rapat tim' },
  info: { label: 'INFO', warna: '#db2777', ket: 'Pengumuman tim' },
  feed: { label: 'FEED', warna: '#dc2626', ket: 'Laporan kegiatan harian' },
  log: { label: 'LOG', warna: '#9333ea', ket: 'Kalender berlapis' },
  roster: { label: 'ROSTER', warna: '#0d9488', ket: 'Jadwal kerja & libur' },
  memo: { label: 'MEMO', warna: '#65a30d', ket: 'Nomor surat, memo, MoM' },
  fire: { label: 'FIRE', warna: '#ea580c', ket: 'Titik api NASA & laporan' },
  money: { label: 'MONEY', warna: '#059669', ket: 'RAB HCGA site' },
  notif: { label: 'NOTIF', warna: '#e11d48', ket: 'Atur pengingat HP' },
  quest: { label: 'QUEST', warna: '#2563eb', ket: 'Misi tim' },
  shop: { label: 'SHOP', warna: '#ca8a04', ket: 'Tukar koin' },
  game: { label: 'GAME', warna: '#a16207', ket: 'Monkey Run' },
  team: { label: 'TEAM', warna: '#4f46e5', ket: 'Anggota & akun' },
} as const;
type KunciModul = keyof typeof MODUL;

const DAFTAR_BAB: { id: string; judul: string; no?: number }[] = [
  { id: 'sampul', judul: 'Sampul' },
  { id: 'pendahuluan', judul: 'Pendahuluan' },
  { id: 'masuk', judul: 'Masuk & menu', no: 1 },
  { id: 'harian', judul: 'Hari kerja', no: 2 },
  { id: 'roster', judul: 'Roster & kalender', no: 3 },
  { id: 'pica', judul: 'PICA', no: 4 },
  { id: 'memo', judul: 'Memo & surat', no: 5 },
  { id: 'fire', judul: 'Fire Monkey', no: 6 },
  { id: 'money', judul: 'Money Monkey', no: 7 },
  { id: 'wa', judul: 'Pesan WhatsApp', no: 8 },
  { id: 'bantuan', judul: 'Bantuan', no: 9 },
];

// ---------------------------------------------------------------------------
// Komponen kecil
// ---------------------------------------------------------------------------

const Chip: React.FC<{ m: KunciModul }> = ({ m }) => (
  <span className="pg-chip" style={{ background: MODUL[m].warna }}>{MODUL[m].label}</span>
);

const Bab: React.FC<{ id: string; no: number; judul: string; lede?: string; children: React.ReactNode }> = ({ id, no, judul, lede, children }) => (
  <section id={`panduan-${id}`} data-halaman={no + 2} className="pg-bab">
    <p className="pg-eyebrow">Bab {no}</p>
    <h2 className="pg-h2">{judul}</h2>
    {lede && <p className="pg-lede">{lede}</p>}
    {children}
  </section>
);

const Langkah: React.FC<{ daftar: { judul: string; isi: React.ReactNode }[] }> = ({ daftar }) => (
  <ol className="pg-langkah">
    {daftar.map((l) => (
      <li key={l.judul}>
        <div>
          <h3>{l.judul}</h3>
          <p>{l.isi}</p>
        </div>
      </li>
    ))}
  </ol>
);

const Titik: React.FC<{ children: React.ReactNode }> = ({ children }) => <ul className="pg-titik">{children}</ul>;

const Tips: React.FC<{ skin: string; judul: string; warna: string; children: React.ReactNode }> = ({ skin, judul, warna, children }) => {
  const s = SKINS.find((k) => k.id === skin) ?? SKINS[0];
  return (
    <div className="pg-kotak pg-tips" style={{ borderLeftColor: warna }}>
      <div className="shrink-0"><MonkeySprite skin={s} ukuran={40} animasi={false} /></div>
      <div>
        <b className="block" style={{ color: warna }}>{judul}</b>
        <span>{children}</span>
      </div>
    </div>
  );
};

/** Format WhatsApp: *tebal*, _miring_, dan tautan peta yang disamarkan. */
function formatWa(baris: string): React.ReactNode[] {
  return baris.split(/(\*[^*\n]+\*|_[^_\n]+_|maps\.google\.com\/…)/g).map((b, i) => {
    if (b.length > 2 && b.startsWith('*') && b.endsWith('*')) return <strong key={i}>{b.slice(1, -1)}</strong>;
    if (b.length > 2 && b.startsWith('_') && b.endsWith('_')) return <em key={i}>{b.slice(1, -1)}</em>;
    if (b === 'maps.google.com/…') return <span key={i} className="pg-wa-tautan">{b}</span>;
    return <React.Fragment key={i}>{b}</React.Fragment>;
  });
}

/** Contoh pesan dalam gelembung chat, gaya dokumen "Alur Notifikasi". */
const GelembungWa: React.FC<{ c: ContohWa }> = ({ c }) => (
  <figure className="m-0 flex flex-col gap-2">
    <figcaption>
      <p className="pg-h3 !mb-0">{c.judul}</p>
      <p className="pg-muted text-[14px] !mb-0">{c.kapan} · ke {c.kepada.toLowerCase()}</p>
    </figcaption>
    <div className="pg-wa">
      <div className="pg-gelembung">
        {c.teks.split('\n').map((baris, i) => <p key={i}>{formatWa(baris)}</p>)}
        <div className="pg-wa-meta">{c.jam}</div>
      </div>
    </div>
  </figure>
);

/** Garis waktu jam kerja (06.00–18.00) dengan penanda notifikasi. */
const GarisWaktu: React.FC = () => {
  const posisi = (jam: number) => `${((jam - 6) / 12) * 100}%`;
  const slot = [
    { jam: '07.00', j: 7, chip: 'PICA', warna: '#b45309', kanal: 'Layar HP', isi: 'PICA milikmu yang masih Open, urut tenggat. Admin juga melihat angka tim.' },
    { jam: '12.00', j: 12, chip: 'INFO', warna: '#be185d', kanal: 'Layar HP', isi: 'Pengumuman yang belum dibaca. Dilewati bila semua sudah dibaca.' },
    { jam: '16.00', j: 16, chip: 'REKAP', warna: '#047857', kanal: 'Grup WA', isi: 'Rekap progres PICA Senin–Kamis, rekap mingguan hari Jumat. Hari libur dilewati.' },
    { jam: '17.00', j: 17, chip: 'XP', warna: '#a16207', kanal: 'Layar HP', isi: 'XP hari ini, atau pengingat bila belum mengirim laporan di FEED.' },
  ];
  return (
    <>
      <div className="pg-penggaris" aria-hidden="true">
        {[6, 9, 12, 15, 18].map((j, i) => (
          <span key={j} className={`pg-tik ${i === 0 ? 'awal' : i === 4 ? 'akhir' : ''}`} style={{ left: posisi(j) }}>{String(j).padStart(2, '0')}.00</span>
        ))}
        {slot.map((s) => <span key={s.jam} className="pg-tanda" style={{ left: posisi(s.j), background: s.warna }} />)}
      </div>
      <div className="pg-slot-grid">
        {slot.map((s) => (
          <article key={s.jam} className="pg-kotak pg-slot">
            <div className="pg-slot-kepala">
              <span className="pg-jam">{s.jam}</span>
              <span className="pg-chip" style={{ background: s.warna }}>{s.chip}</span>
              <span className="pg-kanal">{s.kanal}</span>
            </div>
            <p className="pg-slot-isi">{s.isi}</p>
          </article>
        ))}
      </div>
    </>
  );
};

/** Siklus roster 8 minggu kerja + 2 minggu libur. */
const SiklusRoster: React.FC = () => (
  <div className="pg-kotak p-3">
    <div className="pg-siklus">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className={`pg-siklus-sel ${i < 8 ? 'kerja' : 'libur'}`}>
          <b>{i < 8 ? 'K' : 'L'}</b>
          <span>M{i + 1}</span>
        </div>
      ))}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[13px]">
      <span><span className="pg-legenda" style={{ background: '#047857' }} /> 8 minggu kerja</span>
      <span><span className="pg-legenda" style={{ background: '#b91c1c' }} /> 2 minggu libur</span>
      <span className="pg-muted">Hari Minggu & tanggal merah di dalam minggu kerja tetap dihitung, tapi diisi libur.</span>
    </div>
  </div>
);

/** Zona pantau titik api di sekitar area izin (bukan skala). */
const ZonaApi: React.FC = () => (
  <div className="pg-kotak p-3">
    <svg viewBox="0 0 520 230" className="w-full h-auto" role="img" aria-label="Zona pantau titik api: area izin, waspada 2 km, pantau 5 km">
      <circle cx="140" cy="115" r="105" fill="#e0f2fe" stroke="#17221c" strokeWidth="3" />
      <circle cx="140" cy="115" r="68" fill="#fde68a" stroke="#17221c" strokeWidth="3" />
      <rect x="100" y="80" width="80" height="70" fill="#86efac" stroke="#17221c" strokeWidth="3" />
      <text x="140" y="112" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17221c">AREA</text>
      <text x="140" y="128" textAnchor="middle" fontSize="13" fontWeight="700" fill="#17221c">IZIN</text>
      <circle cx="160" cy="95" r="6" fill="#dc2626" stroke="#17221c" strokeWidth="2" />
      <circle cx="205" cy="70" r="6" fill="#dc2626" stroke="#17221c" strokeWidth="2" />
      <circle cx="80" cy="185" r="6" fill="#dc2626" stroke="#17221c" strokeWidth="2" />
      <line x1="180" y1="115" x2="275" y2="60" stroke="#17221c" strokeWidth="2" />
      <line x1="200" y1="150" x2="275" y2="125" stroke="#17221c" strokeWidth="2" />
      <line x1="235" y1="175" x2="275" y2="190" stroke="#17221c" strokeWidth="2" />
      <text x="282" y="56" fontSize="14" fontWeight="700" fill="#17221c">Di dalam IUP / IPPKH / petak DAS</text>
      <text x="282" y="72" fontSize="12.5" fill="#56665d">wajib ground check & laporan</text>
      <text x="282" y="122" fontSize="14" fontWeight="700" fill="#17221c">Waspada ≤ 2 km dari batas</text>
      <text x="282" y="138" fontSize="12.5" fill="#56665d">dipantau, peringatan WA</text>
      <text x="282" y="188" fontSize="14" fontWeight="700" fill="#17221c">Pantau ≤ 5 km</text>
      <text x="282" y="204" fontSize="12.5" fill="#56665d">dicatat, tanpa peringatan</text>
    </svg>
  </div>
);

/** Bagan tiap bab (Mermaid). Label satu baris agar tetap terbaca saat diperkecil. */
const BAGAN = {
  sistem: `
flowchart LR
  HP["Aplikasi · APK dan web"] <--> API["Server Cloudflare"]
  API <--> DB[("D1 · data tim")]
  NASA["NASA FIRMS · titik api"] --> API
  BMKG["BMKG · cuaca"] --> API
  API --> NT["Notifikasi HP · 07.00 · 12.00 · 17.00"]
  API --> WA["Grup WhatsApp · rekap 16.00"]
  HP --> WG["Widget HP · alarm PICA dan kalender"]
`,
  masalah: `
flowchart LR
  A["Tindak lanjut PICA hanya lisan"] --> D1["Terlupa · tenggat terlewat"]
  A --> D2["Progres ditanyakan satu per satu"]
  S["Titik api dicek manual di SiPongi"] --> D3["Api terlanjur menjalar luas"]
  K["Laporan karhutla disusun manual"] --> D4["Lambat · rawan salah koordinat"]
  B[("Roster, surat, memo, RAB di berkas terpisah")] --> D5["Sulit tahu siapa bertugas · format beragam"]
  L["Lokasi berjauhan · sinyal lemah"] --> D6["Laporan lapangan tertunda"]
  D1 --> Z(["Kondisi hari ini tidak terlihat utuh"])
  D2 --> Z
  D3 --> Z
  D4 --> Z
  D5 --> Z
  D6 --> Z
  classDef akar fill:#fde2e2,stroke:#9b1c1c,color:#42392e
  class A,S,K,B,L akar
`,
  solusi: `
flowchart LR
  M1["PICA hanya lisan"] --> F1["PICA · notifikasi 07.00 · alarm tenggat · rekap WA 16.00"]
  M2["Titik api dicek manual"] --> F2["FIRE · cek NASA tiap jam · peringatan WA otomatis"]
  M3["Laporan karhutla manual"] --> F3["FIRE · form kronologi · Export PDF"]
  M4["Roster Excel per bulan"] --> F4["ROSTER · isi cepat 8/2 · kalender · widget"]
  M5["Surat, memo, MoM terpisah"] --> F5["MEMO · register nomor · form · Excel"]
  M6["RAB site di Excel"] --> F6["MONEY · RAB berstatus · Excel"]
  M7["Sinyal lemah di lapangan"] --> F7["FEED · antrean offline · APK"]
  M8["Pencatatan terasa beban"] --> F8["KEBUN · XP, level, stamina · QUEST"]
  classDef masalah fill:#fde2e2,stroke:#9b1c1c,color:#42392e
  classDef fitur fill:#dcfce7,stroke:#166534,color:#1a2e22
  class M1,M2,M3,M4,M5,M6,M7,M8 masalah
  class F1,F2,F3,F4,F5,F6,F7,F8 fitur
`,
  masuk: `
flowchart TD
  A["Admin membuat akun · menu TEAM"] --> B["Anggota menerima User ID dan kode undangan"]
  B --> C{"Masuk pertama kali?"}
  C -- ya --> D["Isi User ID, password baru, kode undangan"]
  D --> F["Aktifkan sidik jari"]
  C -- tidak --> E{"Sidik jari aktif?"}
  E -- ya --> G["Sentuh sensor HP"]
  E -- tidak --> H["Isi User ID dan password"]
  F --> K(["Masuk ke KEBUN"])
  G --> K
  H --> K
`,
  laporan: `
flowchart LR
  L["Tulis laporan di FEED"] --> S{"Ada sinyal?"}
  S -- ya --> K["Terkirim ke server"]
  S -- tidak --> Q["Disimpan di antrean HP"]
  Q --> T["Sinyal kembali"]
  T --> K
  K --> X(["XP dan stamina naik · KEBUN"])
`,
  kalender: `
flowchart LR
  R["ROSTER · roster saya"] --> K["Kalender LOG"]
  J["JADWAL · agenda tim"] --> K
  P["PICA · tenggat"] --> K
  N["Libur nasional"] --> K
  K --> W(["Widget kalender HP"])
`,
  pica: `
flowchart LR
  T["Temuan lapangan"] --> O["Open · PIC dan tenggat"]
  O --> C["Continue · progres diperbarui"]
  C --> Z(["Closed"])
  O --> Z
  O -.->|"tiap pagi 07.00"| N["Notifikasi PICA Open"]
  O -.->|"H-1 dan hari H"| A["Alarm tenggat"]
  C -.->|"Senin-Jumat 16.00"| W["Rekap grup WhatsApp"]
`,
  csvPica: `
flowchart LR
  T["Unduh template CSV"] --> I["Isi di Excel"]
  I --> U["Impor ke PICA"]
  U --> V{"Semua baris valid?"}
  V -- tidak --> P["Perbaiki baris bertanda"]
  P --> U
  V -- ya --> S(["Simpan · maks. 200 baris"])
`,
  memo: `
flowchart LR
  N["Nomor Surat · register"] --> IM["Internal Memo"]
  M["Minutes of Meeting"]
  IM --> X["Excel format perusahaan"]
  M --> X
  IM --> G["Gambar PNG"]
  M --> G
  N --> XN["Excel register surat"]
`,
  fire: `
flowchart TD
  S["Satelit NASA FIRMS · VIIRS dan MODIS"] --> C["Server memeriksa tiap jam"]
  C --> Z{"Di mana titiknya?"}
  Z -- dalam area izin --> A["IUP · IPPKH · petak DAS"]
  Z -- sampai 2 km --> W["Zona waspada"]
  Z -- sampai 5 km --> P["Zona pantau · dicatat saja"]
  A --> WA["Peringatan grup WhatsApp"]
  W --> WA
  A --> L["LIVE di FIRE · 24 jam terakhir"]
  W --> L
  P --> L
  L --> G["Ground check di lapangan"]
  G --> F["Form kronologi · manual atau CSV"]
  F --> T["Tinjau lembar laporan"]
  T --> E(["Export PDF · bagikan"])
`,
  rekapWa: `
flowchart TD
  C["Cron server tiap 15 menit"] --> J{"Pukul 16.00 WITA?"}
  J -- tidak --> X(["Tidak ada pesan"])
  J -- ya --> H{"Senin-Jumat dan bukan tanggal merah?"}
  H -- tidak --> X
  H -- ya --> G{"ID grup terisi dan WhatsApp aktif?"}
  G -- tidak --> X
  G -- ya --> K{"Hari Jumat?"}
  K -- ya --> M["Rekap mingguan"]
  K -- tidak --> D["Rekap harian"]
  M --> Q["Antrean pesan · satu per tanggal"]
  D --> Q
  Q --> F(["Dikirim lewat Fonnte · diulang bila gagal"])
`,
  money: `
flowchart LR
  D["Draf"] --> A["Diajukan"]
  A --> V["Verifikasi"]
  V --> S["Disetujui"]
  S --> C(["Dicairkan"])
  A -.-> X["Ditolak"]
  V -.-> X
  S --> E["Excel RAB"]
`,
};

// ---------------------------------------------------------------------------
// Gaya buku (token warna mengikuti dokumen "Alur Notifikasi")
// ---------------------------------------------------------------------------

const GAYA = `
.buku-panduan {
  --pg-ground: #edf1eb; --pg-panel: #ffffff; --pg-ink: #17221c; --pg-muted: #56665d;
  --pg-hair: #cdd6cf; --pg-band: #225599; --pg-band-sub: #fde68a; --pg-code: #e1e8e2;
  container-type: inline-size;
  background: var(--pg-ground); color: var(--pg-ink);
  font-family: 'Pixelify Sans', 'Segoe UI', system-ui, sans-serif;
  font-size: 16px; line-height: 1.55;
  padding: 8px 16px 48px;
}
.buku-panduan * { box-sizing: border-box; }
.buku-panduan p { margin: 0 0 10px; max-width: 70ch; }
.pg-muted { color: var(--pg-muted); }
.pg-kotak { background: var(--pg-panel); border: 3px solid var(--pg-ink); box-shadow: 4px 4px 0 var(--pg-ink); }
.pg-band { background: var(--pg-band); color: #fff; border: 4px solid var(--pg-ink); box-shadow: 6px 6px 0 var(--pg-ink); padding: 20px 22px; }
.pg-band h1 { font-family: 'Press Start 2P', monospace; font-weight: 400; font-size: clamp(15px, 4cqw, 22px); line-height: 1.6; margin: 0 0 12px; text-wrap: balance; }
.pg-band .pg-eyebrow { color: var(--pg-band-sub); }
.pg-eyebrow { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: var(--pg-muted); margin: 0 0 6px !important; }
.pg-bab { padding-top: 40px; scroll-margin-top: 12px; display: flex; flex-direction: column; gap: 14px; }
.pg-h2 { font-family: 'Press Start 2P', monospace; font-weight: 400; font-size: 13px; line-height: 1.8; text-transform: uppercase; margin: 0; padding-bottom: 10px; border-bottom: 3px solid var(--pg-ink); text-wrap: balance; }
.pg-h3 { font-size: 18px; font-weight: 700; margin: 6px 0 0; }
.pg-lede { font-size: 16px; }
.pg-chip { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 0 7px; color: #fff; border: 2px solid var(--pg-ink); line-height: 1.6; }
.pg-legenda { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--pg-ink); vertical-align: -1px; margin-right: 4px; }
.buku-panduan code { font-family: ui-monospace, Consolas, monospace; font-size: .85em; background: var(--pg-code); padding: 1px 5px; }

/* Bagan (Mermaid) */
.pg-bagan { padding: 14px; overflow-x: auto; }
.pg-bagan-isi svg { display: block; margin: 0 auto; max-width: none; height: auto; }
@container (min-width: 600px) { .pg-bagan-isi svg { max-width: 100%; } }
.pg-bagan-cadangan { margin: 0; font-size: 12px; white-space: pre-wrap; }

/* Langkah bernomor */
.pg-langkah { list-style: none; padding: 0; margin: 0; counter-reset: langkah; display: flex; flex-direction: column; gap: 16px; }
.pg-langkah > li { counter-increment: langkah; display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 12px; }
.pg-langkah > li::before { content: counter(langkah); font-family: 'Press Start 2P', monospace; font-size: 11px; width: 34px; height: 34px; display: grid; place-items: center; background: var(--pg-band); color: #fff; border: 3px solid var(--pg-ink); }
.pg-langkah h3 { margin: 4px 0 2px; font-size: 17px; }
.pg-langkah p { margin: 0; }

/* Titik daftar */
.pg-titik { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; max-width: 72ch; }
.pg-titik li { position: relative; padding-left: 22px; }
.pg-titik li::before { content: ''; position: absolute; left: 2px; top: .55em; width: 8px; height: 8px; background: var(--pg-ink); }

/* Tips maskot */
.pg-tips { display: flex; gap: 12px; align-items: flex-start; padding: 10px 12px; border-left-width: 10px; font-size: 15px; line-height: 1.45; }

/* Peta aplikasi */
.pg-peta { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
.pg-peta-grup { padding: 12px; }
.pg-peta-daftar { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; margin-top: 8px; }
.pg-peta-item { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.pg-peta-item .pg-chip { min-width: 74px; text-align: center; }
@container (min-width: 600px) {
  .pg-peta { grid-template-columns: 1fr 1.6fr; }
  .pg-peta-grup.lebar .pg-peta-daftar { grid-template-columns: 1fr 1fr; }
}

/* Garis waktu notifikasi */
.pg-penggaris { position: relative; height: 44px; margin: 4px 8px 6px; }
.pg-penggaris::before { content: ''; position: absolute; left: 0; right: 0; top: 16px; height: 4px; background: var(--pg-ink); }
.pg-tik { position: absolute; top: 26px; transform: translateX(-50%); font-size: 12.5px; color: var(--pg-muted); font-variant-numeric: tabular-nums; }
.pg-tik.awal { transform: none; }
.pg-tik.akhir { transform: translateX(-100%); }
.pg-tanda { position: absolute; top: 9px; width: 18px; height: 18px; transform: translateX(-50%); border: 3px solid var(--pg-ink); }
.pg-slot-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
@container (min-width: 480px) { .pg-slot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (min-width: 760px) { .pg-slot-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.pg-slot-kepala { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 10px; border-bottom: 3px solid var(--pg-ink); }
.pg-jam { font-family: 'Press Start 2P', monospace; font-size: 12px; }
.pg-kanal { margin-left: auto; font-size: 13px; color: var(--pg-muted); }
.pg-slot-isi { padding: 8px 10px; font-size: 14px; line-height: 1.45; margin: 0 !important; }

/* Siklus roster */
.pg-siklus { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 4px; }
.pg-siklus-sel { border: 2px solid var(--pg-ink); color: #fff; text-align: center; padding: 6px 0 4px; display: flex; flex-direction: column; line-height: 1.2; }
.pg-siklus-sel.kerja { background: #047857; }
.pg-siklus-sel.libur { background: #b91c1c; }
.pg-siklus-sel b { font-family: 'Press Start 2P', monospace; font-size: 11px; }
.pg-siklus-sel span { font-size: 11px; opacity: .9; margin-top: 3px; }

/* Tabel */
.pg-tabel { width: 100%; border-collapse: collapse; font-size: 14.5px; }
.pg-tabel th, .pg-tabel td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 2px solid var(--pg-hair); }
.pg-tabel tr:last-child td { border-bottom: 0; }
.pg-tabel th { font-size: 12.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--pg-muted); border-bottom: 3px solid var(--pg-ink); }
.pg-tabel td:first-child { font-weight: 700; white-space: nowrap; }

/* Pesan WhatsApp */
.pg-wa { background: #efeae2; border: 3px solid var(--pg-ink); box-shadow: 4px 4px 0 var(--pg-ink); padding: 16px; }
.pg-gelembung { background: #d9fdd3; color: #111b21; max-width: 36rem; padding: 9px 12px 6px; font-family: 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif; font-size: 14.5px; line-height: 1.45; border-radius: 0 8px 8px 8px; overflow-wrap: anywhere; }
.buku-panduan .pg-gelembung p { margin: 0; max-width: none; min-height: 1.45em; }
.pg-wa-meta { text-align: right; font-size: 11.5px; color: #667781; margin-top: 2px; }
.pg-wa-tautan { color: #027eb5; }

/* Bilah bawah HP */
.pg-hp { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 3px solid var(--pg-ink); background: #17221c; box-shadow: 4px 4px 0 var(--pg-ink); max-width: 420px; }
.pg-hp span { color: #fff; font-size: 11px; font-weight: 700; text-align: center; padding: 8px 2px; border-right: 2px solid #33443a; }
.pg-hp span:last-child { border-right: 0; background: #225599; }

/* Export PDF: lebar tetap 170 mm, tanpa jarak antar-bab (tiap bab = halaman baru). */
#buku-panduan.mode-ekspor-pdf { width: 643px !important; max-width: none !important; padding: 0 !important; }
#buku-panduan.mode-ekspor-pdf .pg-bab { padding-top: 0 !important; }
`;

// ---------------------------------------------------------------------------
// Buku
// ---------------------------------------------------------------------------

export const ModalPanduanAplikasi: React.FC<Props> = ({ isOpen, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [babAktif, setBabAktif] = useState('sampul');
  const [mengekspor, setMengekspor] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const buku = useRef<HTMLDivElement>(null);

  // Hanya saat terbuka: modal ini kini selalu terpasang di App (tombol "?"), jadi
  // jangan menyentuh overflow body ketika tertutup.
  useEffect(() => {
    if (!isOpen) return;
    const tombol = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', tombol);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tombol);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const ubahZoom = (d: number) => setZoom((z) => Math.min(1.4, Math.max(0.7, Math.round((z + d) * 10) / 10)));
  const lompat = (id: string) => {
    setBabAktif(id);
    document.getElementById(`panduan-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const eksporPdf = async () => {
    if (!buku.current || mengekspor) return;
    setMengekspor(true);
    setPesan(null);
    try {
      const mulai = Date.now();
      while (buku.current.querySelector('.pg-bagan-isi > span') && Date.now() - mulai < 10_000) {
        await new Promise((r) => setTimeout(r, 200));
      }
      const hasil = await eksporLembarPdf(buku.current, 'Buku Panduan POKEMONKEY.pdf', 'Buku Panduan POKEMONKEY');
      setPesan(hasil === 'diunduh' ? 'PDF diunduh.' : 'PDF siap dibagikan.');
    } catch (e) {
      setPesan(e instanceof Error ? e.message : 'Gagal membuat PDF.');
    } finally {
      setMengekspor(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-900/95 overflow-hidden">
      <style>{GAYA}</style>

      {/* Bilah atas */}
      <div className="bg-[#121c16] border-b-2 border-emerald-500/60 px-3 py-2 flex flex-wrap items-center gap-2 shrink-0 shadow-xl">
        <div className="flex items-center gap-2 mr-auto min-w-0">
          <div className="w-8 h-8 bg-yellow-500/20 border-2 border-yellow-400 flex items-center justify-center text-yellow-400 shrink-0">
            <BookOpen size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="font-title text-[11px] md:text-[13px] text-yellow-400 truncate">BUKU PANDUAN</h2>
            <p className="text-[11px] text-zinc-400 truncate">POKEMONKEY · Revegetasi & Rehabilitasi</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-black/60 border border-white/20 px-2 py-1">
          <button onClick={() => ubahZoom(-0.1)} disabled={zoom <= 0.7} className="text-zinc-300 hover:text-white disabled:opacity-30 p-0.5" title="Perkecil" aria-label="Perkecil"><ZoomOut size={14} /></button>
          <span className="text-[11px] text-emerald-300 w-10 text-center font-bold">{Math.round(zoom * 100)}%</span>
          <button onClick={() => ubahZoom(0.1)} disabled={zoom >= 1.4} className="text-zinc-300 hover:text-white disabled:opacity-30 p-0.5" title="Perbesar" aria-label="Perbesar"><ZoomIn size={14} /></button>
        </div>
        <button
          onClick={eksporPdf}
          disabled={mengekspor}
          className="btn-retro bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 !py-1.5 !px-3 text-[11px] shadow-[2px_2px_0_#000] disabled:opacity-60"
          title="Simpan buku panduan sebagai PDF A4"
        >
          {mengekspor ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          <span>{mengekspor ? 'Membuat PDF…' : 'Export PDF'}</span>
        </button>
        <button onClick={onClose} className="btn-retro bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white !p-1.5" title="Tutup (Esc)" aria-label="Tutup panduan">
          <X size={16} />
        </button>
        {/* Daftar bab */}
        <nav className="w-full flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5" aria-label="Daftar bab">
          {DAFTAR_BAB.map((b) => (
            <button
              key={b.id}
              onClick={() => lompat(b.id)}
              className={`shrink-0 px-2 py-0.5 text-[11px] font-bold border-2 ${babAktif === b.id ? 'bg-yellow-400 text-black border-yellow-200' : 'bg-zinc-900 text-zinc-300 border-white/20 hover:text-white'}`}
            >
              {b.no ? `${b.no}. ${b.judul}` : b.judul}
            </button>
          ))}
        </nav>
        {pesan && <p className="w-full text-[11px] text-emerald-300">{pesan}</p>}
      </div>

      {/* Buku */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0c100e]">
        <div className="mx-auto w-full max-w-[860px] origin-top transition-transform duration-150" style={{ transform: `scale(${zoom})` }}>
          <div id="buku-panduan" ref={buku} className="buku-panduan">
            {/* ============================ SAMPUL ============================ */}
            <section id="panduan-sampul" data-halaman="1" className="pg-bab !pt-4">
              <header className="pg-band">
                <p className="pg-eyebrow">POKEMONKEY · Revegetasi & Rehabilitasi · Edisi September 2026</p>
                <h1>Buku Panduan POKEMONKEY</h1>
                <p className="!mb-0">
                  Aplikasi kerja tim: tugas perbaikan, jadwal, roster, surat, pemantauan titik api, dan anggaran site dalam satu tempat,
                  dengan rasa game 90-an agar pekerjaan harian terasa seperti petualangan tim.
                </p>
              </header>

              <figure className="pg-kotak m-0 overflow-hidden">
                <img src={gambarShowcase} alt="POKEMONKEY di laptop, tablet, dan HP" className="block w-full h-auto max-h-[300px] object-cover" />
                <figcaption className="px-3 py-2 text-[13px] border-t-[3px] border-[var(--pg-ink)]">
                  Satu akun untuk web, tablet, dan aplikasi Android (APK).
                </figcaption>
              </figure>

              <div className="pg-kotak p-3 flex gap-3 items-start">
                <img src={gambarLogin} alt="Layar masuk POKEMONKEY" className="w-20 h-24 object-cover border-[3px] border-[var(--pg-ink)] shrink-0" />
                <div>
                  <p className="pg-h3 !mt-0">Rapi seperti ruang kerja, seru seperti game</p>
                  <p className="!mb-0">
                    Setiap anggota punya monyet dengan XP, level, dan stamina. Aksi di semua menu menambah XP, paling besar menindaklanjuti
                    dan menutup PICA, dan keaktifan harian menjadi Nilai Keaktifan (KPI) semester. Data kerja tetap tersusun rapi seperti papan kerja tim.
                  </p>
                </div>
              </div>

            </section>

            {/* ========================= PENDAHULUAN ========================= */}
            <section id="panduan-pendahuluan" data-halaman="2" className="pg-bab">
              <p className="pg-eyebrow">Pendahuluan</p>
              <h2 className="pg-h2">Mengapa POKEMONKEY dibuat</h2>
              <p>
                Departemen Revegetasi & Rehabilitasi bekerja di dua lokasi yang berjauhan: area tambang dan IPPKH di Tapin, serta
                petak Rehabilitasi DAS di Tahura Sultan Adam. Timnya kecil, dibantu staf lapangan Tahura dan mitra CV KBS, sementara
                tanggung jawabnya luas: persemaian, penanaman, pemeliharaan, pemantauan kebakaran, sampai administrasi surat dan
                anggaran site.
              </p>
              <p>
                Sebelum ada aplikasi ini, temuan di lapangan dan tindak lanjutnya (PICA) hanya disampaikan secara lisan. Roster ada di
                berkas Excel tiap bulan, nomor surat di register tersendiri, memo dan notulen di template terpisah, dan anggaran site di
                lembar RAB. Tidak ada satu tempat untuk menjawab tiga pertanyaan sederhana: apa yang belum selesai, siapa yang
                bertugas hari ini, dan apa yang terjadi di lapangan.
              </p>
              <p className="!mb-0"><b>Akibatnya terasa setiap minggu:</b></p>
              <Titik>
                <li>Tindak lanjut yang hanya lisan mudah terlupa. Tenggat terlewat tanpa ada yang mengingatkan, dan progres harus ditanyakan satu per satu.</li>
                <li>Titik api baru diketahui setelah seseorang membuka aplikasi SiPongi. Sering kali, saat titiknya terlihat, api di lapangan sudah menjalar luas.</li>
                <li>Laporan karhutla disusun manual: koordinat, peta, dan kronologi disalin dengan tangan, lambat dan rawan salah ketik.</li>
                <li>Di lokasi tanpa sinyal, laporan tertunda sampai tim kembali ke mess.</li>
                <li>Pencatatan yang berulang terasa sebagai beban, bukan bagian dari kerja.</li>
              </Titik>
              <p>
                POKEMONKEY menyatukan semua itu dalam satu aplikasi yang bisa dibuka dari HP di lapangan maupun komputer di kantor.
                Data tersimpan di satu server, pengingat datang sendiri di jam kerja, server memeriksa satelit NASA setiap jam dan
                langsung memperingatkan grup WhatsApp saat ada titik api baru, dan dokumen resmi keluar dalam format perusahaan dengan
                satu tombol. Sentuhan game 90-an, yaitu monyet dengan XP, level, dan stamina, dipakai untuk satu tujuan: membuat
                mencatat pekerjaan terasa sebagai kemajuan tim, bukan sekadar kewajiban.
              </p>

              <div>
                <p className="pg-h3">Alur permasalahan</p>
                <p className="pg-muted">Kotak merah adalah sumber masalah; semuanya bermuara pada kondisi lapangan yang tidak terlihat utuh.</p>
                <BaganMermaid kode={BAGAN.masalah} label="Alur permasalahan sebelum ada POKEMONKEY" />
              </div>

              <div>
                <p className="pg-h3">Masalah dan solusinya</p>
                <p className="pg-muted">Setiap masalah (merah) dijawab oleh fitur tertentu (hijau).</p>
                <BaganMermaid kode={BAGAN.solusi} label="Pasangan masalah dan fitur POKEMONKEY yang menjawabnya" />
              </div>
              <div className="pg-kotak overflow-x-auto">
                <table className="pg-tabel">
                  <thead><tr><th>Masalah</th><th>Dampak</th><th>Fitur yang menjawab</th></tr></thead>
                  <tbody>
                    <tr><td>PICA hanya lisan</td><td>Terlupa, tenggat terlewat, progres ditanyakan satu per satu</td><td><b>PICA</b>: notifikasi 07.00, alarm tenggat H-1 dan hari H, rekap grup WA 16.00</td></tr>
                    <tr><td>Titik api dicek manual di SiPongi</td><td>Api sudah menjalar luas saat diketahui</td><td><b>FIRE</b>: server memeriksa NASA FIRMS tiap jam, peringatan grup WA otomatis, LIVE 24 jam</td></tr>
                    <tr><td>Laporan karhutla manual</td><td>Lambat, rawan salah koordinat</td><td><b>FIRE</b>: form kronologi, tinjau, Export PDF</td></tr>
                    <tr><td>Roster Excel per bulan</td><td>Sulit tahu siapa bertugas atau libur</td><td><b>ROSTER</b>: isi cepat 8/2, kalender berlapis, widget HP, Excel format RNR</td></tr>
                    <tr><td>Surat, memo, MoM terpisah</td><td>Nomor dan format tidak seragam</td><td><b>MEMO</b>: register nomor surat, form Internal Memo dan MoM, ekspor Excel</td></tr>
                    <tr><td>RAB site di Excel</td><td>Status pengajuan tidak terlihat</td><td><b>MONEY</b>: RAB W1–W4 dengan status, ekspor Excel</td></tr>
                    <tr><td>Lokasi jauh, sinyal lemah</td><td>Laporan tertunda</td><td><b>FEED</b>: antrean offline, APK Android</td></tr>
                    <tr><td>Pencatatan terasa beban</td><td>Data tidak lengkap</td><td><b>KEBUN / QUEST</b>: XP, level, stamina, misi tim</td></tr>
                  </tbody>
                </table>
              </div>

              <div>
                <p className="pg-h3">Cara kerja</p>
                <p className="pg-muted">Data tim tersimpan di server; aplikasi, notifikasi, WhatsApp, dan widget membaca dari sumber yang sama.</p>
                <BaganMermaid kode={BAGAN.sistem} label="Cara kerja POKEMONKEY: aplikasi, server, data, NASA, BMKG, notifikasi, WhatsApp, widget" />
              </div>

              <div>
                <p className="pg-h3">Peta aplikasi</p>
                <p className="pg-muted">Empat tab utama ada di bilah bawah HP. Menu lain dibuka lewat tombol MENU.</p>
                <div className="pg-peta">
                  <div className="pg-kotak pg-peta-grup">
                    <b>Tab utama</b>
                    <div className="pg-peta-daftar">
                      {(['kebun', 'pica', 'jadwal', 'info'] as KunciModul[]).map((m) => (
                        <div key={m} className="pg-peta-item"><Chip m={m} /><span>{MODUL[m].ket}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="pg-kotak pg-peta-grup lebar">
                    <b>Lewat MENU</b>
                    <div className="pg-peta-daftar">
                      {(['feed', 'log', 'roster', 'memo', 'fire', 'money', 'notif', 'quest', 'shop', 'game', 'team'] as KunciModul[]).map((m) => (
                        <div key={m} className="pg-peta-item"><Chip m={m} /><span>{MODUL[m].ket}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ============================ BAB 1 ============================ */}
            <Bab id="masuk" no={1} judul="Masuk & menu" lede="Akun dibuat Admin. Anggota membuat password sendiri saat masuk pertama kali, lalu bisa masuk dengan sidik jari.">
              <BaganMermaid kode={BAGAN.masuk} label="Alur masuk akun: akun dibuat Admin, masuk pertama dengan kode undangan, lalu sidik jari" />
              <Langkah
                daftar={[
                  { judul: 'Isi User ID', isi: <>Ketik User ID yang diberikan Admin di layar masuk.</> },
                  { judul: 'Buat password & kode undangan', isi: <>Saat masuk pertama, isi password baru dan kode undangan. Password itu menjadi sandi tetap akun Anda.</> },
                  { judul: 'Pakai sidik jari', isi: <>Setelah berhasil masuk, aktifkan tombol sidik jari. Di lapangan cukup sentuh sensor HP tanpa mengetik sandi.</> },
                ]}
              />
              <div>
                <p className="pg-h3">Bilah bawah HP</p>
                <div className="pg-hp mt-2" aria-label="Contoh bilah bawah HP">
                  <span>KEBUN</span><span>PICA</span><span>JADWAL</span><span>INFO</span><span>MENU</span>
                </div>
                <p className="pg-muted mt-2">Di komputer, semua menu tampil di bilah samping. Tombol matahari/bulan mengganti mode terang untuk dipakai di bawah terik matahari.</p>
              </div>
              <Tips skin="classic" judul="Tips maskot" warna="#225599">
                Tidak punya akun? Di layar masuk ada tombol <b>Ajukan akses</b> untuk menghubungi Admin lewat WhatsApp, atau coba dulu lewat <b>mode demo</b> yang datanya hanya tersimpan di HP Anda.
              </Tips>
            </Bab>

            {/* ============================ BAB 2 ============================ */}
            <Bab id="harian" no={2} judul="Hari kerja" lede="Pengingat datang di jam tetap (WITA). Laporan harian menambah XP dan tetap aman walau tanpa sinyal.">
              <p className="pg-h3">Jadwal pengingat</p>
              <GarisWaktu />
              <p className="pg-muted">
                Setiap orang bisa mematikan pengingat tertentu di menu <b>NOTIF</b>. Alarm tenggat PICA (H-1 dan hari H) diatur terpisah di tiap PICA.
              </p>

              <p className="pg-h3">Laporan harian & tanpa sinyal</p>
              <BaganMermaid kode={BAGAN.laporan} label="Alur laporan FEED: terkirim bila ada sinyal, disimpan di antrean HP bila tidak" />

            </Bab>

            {/* ============================ BAB 3 ============================ */}
            <Bab id="roster" no={3} judul="Roster & kalender" lede="ROSTER mencatat kerja dan libur tiap anggota. LOG menggabungkan agenda, tenggat PICA, libur nasional, dan roster dalam satu kalender.">
              <p className="pg-h3">Isi cepat: siklus 8 minggu kerja, 2 minggu libur</p>
              <SiklusRoster />
              <Titik>
                <li><b>Isi cepat</b> di ROSTER mengisi satu siklus sekaligus; sel tetap bisa diubah satu per satu.</li>
                <li>Saring <b>Semua · PT EBL · CV KBS</b> berlaku untuk tabel, grafik, gambar, dan Excel.</li>
                <li><b>Excel</b> mengikuti format Roster Kerja RNR (kode D, N, OFF, FB, IK beserta rekapnya).</li>
                <li>Tanggal merah ditandai bendera; daftarnya sama dengan kalender.</li>
              </Titik>
              <p className="pg-h3">Kalender berlapis di LOG</p>
              <BaganMermaid kode={BAGAN.kalender} label="Sumber lapisan kalender LOG dan widget kalender" />
            </Bab>

            {/* ============================ BAB 4 ============================ */}
            <Bab id="pica" no={4} judul="PICA · temuan & perbaikan" lede="PICA (Problem Identification & Corrective Action) mencatat masalah di lapangan sampai tuntas, lengkap dengan PIC dan tenggat.">
              <BaganMermaid kode={BAGAN.pica} label="Siklus PICA dari temuan sampai Closed beserta pengingatnya" />
              <div className="pg-kotak overflow-x-auto">
                <table className="pg-tabel">
                  <thead><tr><th>Kapan</th><th>Pengingat</th></tr></thead>
                  <tbody>
                    <tr><td>Setiap pagi 07.00</td><td>Notifikasi HP: PICA milikmu yang masih Open.</td></tr>
                    <tr><td>H-1 & hari H</td><td>Alarm tenggat berbunyi sekali di jam pilihan (bawaan 07.00). Dinyalakan per PICA, hanya untuk PICA milikmu.</td></tr>
                    <tr><td>Senin–Jumat 16.00</td><td>Rekap progres PICA ke grup WhatsApp.</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="pg-h3">Impor banyak PICA dari CSV</p>
              <BaganMermaid kode={BAGAN.csvPica} label="Alur impor PICA dari CSV" />
              <p className="pg-muted">Impor hanya untuk Admin dan Supervisor. PICA baru ditambahkan tanpa menimpa yang lama.</p>
            </Bab>

            {/* ============================ BAB 5 ============================ */}
            <Bab id="memo" no={5} judul="Memo & surat" lede="MEMO punya tiga tab: register Nomor Surat, Internal Memo perjalanan dinas, dan Minutes of Meeting.">
              <BaganMermaid kode={BAGAN.memo} label="Alur dokumen di menu MEMO" />
              <div className="pg-kotak overflow-x-auto">
                <table className="pg-tabel">
                  <thead><tr><th>Tab</th><th>Isi</th></tr></thead>
                  <tbody>
                    <tr><td>Nomor Surat</td><td>Register nomor surat keluar tim, bisa dicari dan diekspor.</td></tr>
                    <tr><td>Internal Memo</td><td>Memo perjalanan dinas mengikuti format Excel perusahaan.</td></tr>
                    <tr><td>MoM</td><td>Notulen rapat; teks panjang dipenggal rapi tanpa merusak tabel.</td></tr>
                  </tbody>
                </table>
              </div>
            </Bab>

            {/* ============================ BAB 6 ============================ */}
            <Bab id="fire" no={6} judul="Fire Monkey · titik api" lede="FIRE memakai data satelit NASA FIRMS yang diambil server tiap jam. Titik di dalam area izin dilaporkan lewat form, ditinjau, lalu diekspor PDF.">
              <BaganMermaid kode={BAGAN.fire} label="Alur data titik api dari satelit NASA sampai laporan PDF" />
              <p className="pg-h3">Zona pantau</p>
              <ZonaApi />
              <Tips skin="fire" judul="Panduan Fire Monkey" warna="#b91c1c">
                Posisi titik satelit bisa meleset beberapa ratus meter, jadi <b>ground check tetap wajib</b> sebelum laporan dibuat.
                Pilih penyebab sesuai yang terlihat di lapangan; kalimat bawaannya netral dan tidak menunjuk pihak mana pun.
              </Tips>
            </Bab>

            {/* ============================ BAB 7 ============================ */}
            <Bab id="money" no={7} judul="Money Monkey · RAB site" lede="MONEY menyusun Rencana Anggaran Biaya HCGA site per minggu (W1–W4) dan mengekspornya ke Excel format perusahaan.">
              <BaganMermaid kode={BAGAN.money} label="Alur status pengajuan RAB" />
              <p className="pg-muted">Pengajuan yang tidak disetujui berstatus <b>Ditolak</b>.</p>
              <div className="pg-kotak overflow-x-auto">
                <table className="pg-tabel">
                  <thead><tr><th>Uraian (contoh)</th><th>Vol</th><th>Harga satuan</th><th>Total</th></tr></thead>
                  <tbody className="tabular-nums">
                    <tr><td>Beras 50 kg</td><td>4 sak</td><td>Rp720.000</td><td>Rp2.880.000</td></tr>
                    <tr><td>Gas elpiji 12 kg</td><td>6 tabung</td><td>Rp225.000</td><td>Rp1.350.000</td></tr>
                    <tr><td>Jumlah</td><td /><td /><td>Rp4.230.000</td></tr>
                  </tbody>
                </table>
              </div>
              <Tips skin="money" judul="Panduan Money Monkey" warna="#047857">
                Tekan <b>Excel</b> pada pengajuan yang aktif. Berkas yang terunduh sudah berisi kop, rumus jumlah, dan kolom tanda tangan.
              </Tips>
            </Bab>

            {/* ============================ BAB 8 ============================ */}
            <Bab id="wa" no={8} judul="Pesan WhatsApp" lede="Pesan ke grup dikirim server lewat Fonnte, paling banyak satu rekap PICA per hari kerja agar nomor pengirim tidak diblokir. Contoh di bawah disusun oleh fungsi yang sama dengan pesan sungguhan, memakai data contoh.">
              <div className="pg-kotak overflow-x-auto">
                <table className="pg-tabel">
                  <thead><tr><th>Pesan</th><th>Kapan</th><th>Ke</th></tr></thead>
                  <tbody>
                    {contohPesanWa().map((c) => (
                      <tr key={c.id}><td>{c.judul}</td><td>{c.kapan}</td><td>{c.kepada}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="pg-h3">Alur rekap PICA pukul 16.00</p>
              <BaganMermaid kode={BAGAN.rekapWa} label="Alur rekap PICA ke grup WhatsApp pukul 16.00 WITA" />
              <Titik>
                <li>ID grup WhatsApp dan saklar pengiriman diatur Admin di <b>PICA → Atur</b>. Tombol Pratinjau menampilkan pesan tanpa mengirim.</li>
                <li>Peringatan titik api hanya untuk titik baru, satu kali per titik, paling banyak empat pesan per hari untuk area tambang dan empat untuk Rehab DAS.</li>
                <li>Tautan lokasi di contoh disamarkan; pesan sungguhan berisi tautan Google Maps ke koordinat titik.</li>
              </Titik>
              {contohPesanWa().map((c) => <GelembungWa key={c.id} c={c} />)}
            </Bab>

            {/* ============================ BAB 9 ============================ */}
            <Bab id="bantuan" no={9} judul="Bantuan & batasan">
              <Titik>
                <li><b>Jam pengingat Android bisa bergeser beberapa menit.</b> Di Xiaomi, Oppo, vivo, dan Samsung, kecualikan POKEMONKEY dari penghemat baterai.</li>
                <li><b>Titik satelit bukan selalu api.</b> Satelit merekam anomali panas; hasil ground check yang menentukan isi laporan.</li>
                <li><b>PDF laporan berupa gambar halaman</b>, jadi teksnya tidak bisa disalin. Ubah isi lewat form, bukan dari PDF.</li>
                <li><b>Mode demo</b> hanya untuk mencoba: datanya tersimpan di HP dan bisa dihapus kapan saja.</li>
              </Titik>
              <div className="pg-kotak p-3">
                <p className="pg-h3 !mt-0">Butuh bantuan atau akun baru?</p>
                <p className="!mb-0">Hubungi Admin aplikasi lewat WhatsApp <b>0811-2222-0044</b>.</p>
              </div>
              <p className="pg-muted text-[13px] pt-3 border-t-[3px] border-[var(--pg-ink)]">
                Buku Panduan POKEMONKEY · Dept. Revegetasi & Rehabilitasi · Edisi September 2026
              </p>
            </Bab>
          </div>
        </div>
      </div>
    </div>
  );
};
