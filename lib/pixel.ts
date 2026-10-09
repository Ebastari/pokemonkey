/**
 * Sistem sprite piksel POKEMONKEY.
 *
 * Monyet digambar sebagai peta karakter 22 kolom. Tiap huruf adalah satu
 * warna dari palet skin, sehingga satu gambar melayani 16 skin sekaligus:
 *   P primer   p primer-gelap   Q primer-terang (sorot)
 *   S sekunder s sekunder-gelap  O garis luar
 *   E putih mata  K pupil  N hidung/mulut  . kosong
 * Aksesori adalah peta kecil yang ditumpuk di atas (atau di belakang) badan.
 * Dipakai oleh SVG (KEBUN, SHOP) dan kanvas (Monkey Run) lewat dua fungsi
 * render di bagian bawah.
 */

export type Peta = string[];
export const LEBAR = 22;
/** 4 baris kosong di atas kepala untuk mahkota, api, tanduk. */
export const ATAS = 4;
export const TINGGI = ATAS + 12 + 10; // 26

const rapikan = (peta: Peta): Peta => peta.map((b) => b.padEnd(LEBAR, '.').slice(0, LEBAR));

// ---------- Badan ----------

export const KEPALA: Peta = rapikan([
  '......OOOOOOOOOO......',
  '.....OPQQPPPPPPPPO....',
  '....OPQPPPPPPPPPPPO...',
  '..OOOPPPPPPPPPPPPPOOO.',
  '.OPPOOPSSSSSSSSSSPOPPO',
  '.OPSPOPSSSSSSSSSSPOSPO',
  '.OPPPOPSEKSSSSSEKSPPPO',
  '..OOOOPSSSSSSSSSSPOOO.',
  '.....OPSSSNNSSSSSPO...',
  '.....OPSsSSSSSSsSPO...',
  '......OPSSssssssPO....',
  '.......OPPPPPPPPO.....',
]);

export const BADAN_DIAM: Peta = rapikan([
  '........OPPPPPPO......',
  '......OPPPSSSSPPPO....',
  '.....OPpPPSSSSPPpPO..P',
  '.....OPpPPSSSSPPpPO.PP',
  '.....OPpPPSSSSPPpPOPP.',
  '......OPPPPPPPPPPOP...',
  '.......OPpPPPPpPO.....',
  '.......OPPOOOOPPO.....',
  '.......OPPO..OPPO.....',
  '......OOOOO..OOOOO....',
]);

export const BADAN_JALAN: Peta = rapikan([
  '........OPPPPPPO......',
  '......OPPPSSSSPPPO....',
  '.....OPpPPSSSSPPpPO..P',
  '.....OPpPPSSSSPPpPO.PP',
  '.....OPpPPSSSSPPpPOPP.',
  '......OPPPPPPPPPPOP...',
  '.......OPpPPPPpPO.....',
  '......OPPOOOOOOPPO....',
  '.....OPPO......OPPO...',
  '.....OOOO......OOOO...',
]);

export const BADAN_LOMPAT: Peta = rapikan([
  '..P.....OPPPPPPO......',
  '.PP...OPPPSSSSPPPO....',
  '.PpPOPpPPSSSSPPpPOP...',
  '..OPPPPPPSSSSPPPPPP...',
  '.....OPPPPSSSSPPPO....',
  '......OPPPPPPPPPPO....',
  '.......OPpPPPPpPO.....',
  '......OPPOO..OOPPO....',
  '.....OPPO......OPPO...',
  '.....OOOO......OOOO...',
]);

export const BADAN_MERUNDUK: Peta = rapikan([
  '....OPPPPPPPPPPPPPO...',
  '...OPpPPSSSSSSSSPpPO.P',
  '...OPpPPSSSSSSSSPpPOPP',
  '....OPPPPPPPPPPPPPOP..',
  '.....OPPOOOOOOPPO.....',
  '.....OOOO....OOOO.....',
]);

// ---------- Aksesori ----------

export interface Aksesori {
  peta: Peta;
  y: number;               // baris awal (0 = paling atas, kepala mulai di ATAS)
  belakang?: boolean;      // digambar di belakang badan (jubah, sayap)
  warna: Record<string, string>;
  bingkai?: Peta;          // frame kedua untuk animasi (api, kilau)
}

export const AKSESORI: Record<string, Aksesori> = {
  helm_oranye: {
    y: ATAS - 1,
    peta: rapikan(['......HHHHHHHHHH......', '.....HHHWWWWWWHHHH....', '....HHHHHHHHHHHHHH....', '...HHHHHHHHHHHHHHHH...', '...HH............HH...']),
    warna: { H: '#f97316', W: '#fde68a' },
  },
  helm_hijau: {
    y: ATAS - 1,
    peta: rapikan(['......HHHHHHHHHH......', '.....HHHHhHHHHHHH.....', '....HHHHHHHHHHHHHH....', '...HHHHHHHHHHHHHHHH...', '...HH............HH...']),
    warna: { H: '#4d7c0f', h: '#65a30d' },
  },
  rompi: {
    y: ATAS + 13,
    peta: rapikan(['.......VVVVVVVVV......', '......VVWWWWWWVV......', '......VVVVVVVVVV......', '......VVWWWWWWVV......', '.......VVVVVVVV.......']),
    warna: { V: '#f97316', W: '#fde68a' },
  },
  topi_daun: {
    y: ATAS - 3,
    peta: rapikan(['..........G...........', '.......GGGGGG.gG......', '.....GGgGGGGGGGGG.....', '....GGGGGGgGGGGGGG....', '......GGGGGGGGGG......']),
    warna: { G: '#16a34a', g: '#86efac' },
  },
  mahkota: {
    y: ATAS - 3,
    peta: rapikan(['......Y....Y....Y.....', '......YY..YRY..YY.....', '......YYYYYYYYYYY.....', '......YYYYYYYYYYY.....']),
    warna: { Y: '#facc15', R: '#ef4444' },
  },
  mahkota_kristal: {
    y: ATAS - 3,
    peta: rapikan(['......C....C....C.....', '......CC..CWC..CC.....', '......CCCCCCCCCCC.....', '......CCCCCCCCCCC.....']),
    warna: { C: '#67e8f9', W: '#ffffff' },
  },
  visor: {
    y: ATAS + 6,
    peta: rapikan(['......VVVVVVVVVVV.....', '......VvvvvvvvvvV.....']),
    warna: { V: '#f0abfc', v: '#d946ef' },
  },
  masker: {
    y: ATAS + 3,
    peta: rapikan(['......RRRRRRRRRRR..RR.', '.................RRR..', '......................', '......................', '......................', '.....DDDDDDDDDDDDD....', '......DDDDDDDDDDD.....', '.......DDDDDDDDD......']),
    warna: { R: '#dc2626', D: '#27272a' },
  },
  kabuto: {
    y: ATAS - 3,
    peta: rapikan(['....Y..........Y......', '.....Y........Y.......', '......HHHHHHHHHH......', '.....HHHHHHHHHHHH.....', '....HHHHHHHHHHHHHH....', '...HH.HHHHHHHHHH.HH...']),
    warna: { H: '#b91c1c', Y: '#facc15' },
  },
  kubah: {
    y: ATAS - 1,
    peta: rapikan(['.....WWWWWWWWWWWW.....', '....W............W....', '...W..............W...', '...W..............W...', '...W..............W...', '...W..............W...', '...W..............W...', '...W..............W...', '...W..............W...', '...W..............W...', '...W..............W...', '....W............W....', '.....WWWWWWWWWWWW.....']),
    warna: { W: '#e0f2fe' },
  },
  tanduk: {
    y: ATAS - 3,
    peta: rapikan(['....T...........T.....', '....TT.........TT.....', '.....TT.......TT......', '......T.......T.......']),
    warna: { T: '#84cc16' },
  },
  api: {
    y: 0,
    peta: rapikan(['........F.....F.......', '.......FFF...FFf......', '......FFfFF.FFfFF.....', '.....FFffFFFFffFFF....']),
    bingkai: rapikan(['.........F...F........', '........FF..FFF.......', '.......FFfF.FfFF......', '......FFffFFFffFF.....']),
    warna: { F: '#f97316', f: '#fde047' },
  },
  es: {
    y: 0,
    peta: rapikan(['.........I.....I......', '........III...III.....', '.......IWIII.IIWII....', '......IIIIIIIIIIIII...']),
    warna: { I: '#a5f3fc', W: '#ffffff' },
  },
  jubah: {
    y: ATAS + 12,
    belakang: true,
    peta: rapikan(['......CCCCCCCCCCCC....', '.....CCCCCCCCCCCCCC...', '....CCCCCCCCCCCCCCCC..', '....CCCCCCCCCCCCCCCC..', '...CCCCCCCCCCCCCCCCCC.', '...CCCCCCCCCCCCCCCCCC.', '...CCcCCCCCCCCCCCcCCC.', '..CCCcCCCCCCCCCCCCcCCC', '..CccccccccccccccccccC', '..CCCCCCCCCCCCCCCCCCCC']),
    warna: { C: '#7e22ce', c: '#facc15' },
  },
  sayap_api: {
    y: ATAS + 10,
    belakang: true,
    peta: rapikan(['.F................F...', 'FFF..............FFF..', 'FfFF............FFfF..', 'FffFF..........FFffF..', '.FffFF........FFffF...', '..FfFFF......FFFfF....', '...FFFF......FFFF.....', '....FF........FF......']),
    bingkai: rapikan(['......................', '.F................F...', 'FFF..............FFF..', 'FfFF............FFfF..', 'FffFF..........FFffF..', '.FffFF........FFffF...', '..FfFFF......FFFfF....', '...FFFF......FFFF.....']),
    warna: { F: '#ea580c', f: '#fde047' },
  },
  sayap_naga: {
    y: ATAS + 10,
    belakang: true,
    peta: rapikan(['.G................G...', 'GGG..............GGG..', 'GgGG............GGgG..', 'GggGG..........GGggG..', '.GggGG........GGggG...', '..GgGGG......GGGgG....', '...GGGG......GGGG.....', '....GG........GG......']),
    warna: { G: '#166534', g: '#4ade80' },
  },
  sayap_emas: {
    y: ATAS + 10,
    belakang: true,
    peta: rapikan(['.Y................Y...', 'YYY..............YYY..', 'YyYY............YYyY..', 'YyyYY..........YYyyY..', '.YyyYY........YYyyY...', '..YyYYY......YYYyY....', '...YYYY......YYYY.....', '....YY........YY......']),
    warna: { Y: '#ca8a04', y: '#fef08a' },
  },

  // ---------- Skin Prestasi (tidak bisa dibeli) ----------
  helm_pemadam: {
    y: ATAS - 3,
    peta: rapikan(['.........YY...........', '......RRRYYRRRR.......', '.....RRRRYYRRRRRR.....', '....RRRRRRRRRRRRRR....', '...RRRRRRRRRRRRRRRR...', '..RRR............RRRR.']),
    warna: { R: '#dc2626', Y: '#facc15' },
  },
  rompi_reflektor: {
    y: ATAS + 13,
    peta: rapikan(['.......VVVVVVVVV......', '......VVWWWWWWVV......', '......VVVVVVVVVV......', '......VVWWWWWWVV......', '.......VVVVVVVV.......']),
    warna: { V: '#ea580c', W: '#e5e7eb' },
  },
  medali: {
    y: ATAS + 12,
    peta: rapikan(['..........B.B.........', '...........Y..........', '..........YWY.........', '...........Y..........']),
    warna: { B: '#2563eb', Y: '#facc15', W: '#ffffff' },
  },
  topi_pemburu: {
    y: ATAS - 3,
    peta: rapikan(['.........TTTT.........', '.......TTtTTtTT.......', '.....TTTTTTTTTTTT.....', '...TTTTTtTTTTtTTTTT...', '..T...............T...']),
    warna: { T: '#92400e', t: '#d97706' },
  },
  kaca_pembesar: {
    y: ATAS + 9,
    peta: rapikan(['.................GGG..', '................GWccG.', '................GccWG.', '.................GGG..', '................H.....', '...............H......']),
    warna: { G: '#facc15', W: '#ffffff', c: '#7dd3fc', H: '#78350f' },
  },
  jubah_merah: {
    y: ATAS + 12,
    belakang: true,
    peta: rapikan(['......CCCCCCCCCCCC....', '.....CCCCCCCCCCCCCC...', '....CCCCCCCCCCCCCCCC..', '....CCCCCCCCCCCCCCCC..', '...CCCCCCCCCCCCCCCCCC.', '...CCCCCCCCCCCCCCCCCC.', '..CCCCCCCCCCCCCCCCCCCC', '..CCcCCCCCCCCCCCCCcCCC', '..CccccccccccccccccccC', '..CCCCCCCCCCCCCCCCCCCC']),
    warna: { C: '#b91c1c', c: '#fde047' },
  },
  ikat_kepala: {
    y: ATAS + 2,
    peta: rapikan(['....RRRRRRRRRRRRRR....', '..................RRR.', '...................RR.']),
    warna: { R: '#ef4444' },
  },
  lambang_tolong: {
    y: ATAS + 13,
    peta: rapikan(['..........WWW.........', '.........WWRWW........', '.........WRRRW........', '.........WWRWW........', '..........WWW.........']),
    warna: { W: '#ffffff', R: '#dc2626' },
  },
  baret: {
    y: ATAS - 2,
    peta: rapikan(['...........b..........', '.......BBBBBBBB.......', '.....BBBBBBBBBBBB.....', '....BBBBBBBBBBBBBBB...']),
    warna: { B: '#1e3a8a', b: '#0f172a' },
  },
  kamera: {
    y: ATAS + 13,
    peta: rapikan(['.......KKK............', '......KKKKKKKKKK......', '......KKWKKGGKKK......', '......KKKKGccGKK......', '......KKKKKGGKKK......', '.......KKKKKKKK.......']),
    warna: { K: '#27272a', W: '#f4f4f5', G: '#71717a', c: '#38bdf8' },
  },
};

// ---------- Warna ----------

function hexKeRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function rgbKeHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function gelapkan(hex: string, f = 0.7): string {
  const [r, g, b] = hexKeRgb(hex);
  return rgbKeHex(r * f, g * f, b * f);
}
export function terangkan(hex: string, f = 0.35): string {
  const [r, g, b] = hexKeRgb(hex);
  return rgbKeHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
}

export interface WarnaSkin {
  primary: string;
  secondary: string;
  accent: string;
}

/** Palet lengkap dari tiga warna skin: bayangan dan sorot dihitung otomatis. */
export function paletDari(w: WarnaSkin): Record<string, string> {
  return {
    P: w.primary,
    p: gelapkan(w.primary, 0.72),
    Q: terangkan(w.primary, 0.4),
    S: w.secondary,
    s: gelapkan(w.secondary, 0.75),
    O: gelapkan(w.accent === '#000000' ? w.primary : w.accent, 0.35),
    E: '#ffffff',
    K: '#111111',
    N: gelapkan(w.secondary, 0.5),
  };
}

// ---------- Render ----------

export interface Kotak { x: number; y: number; w: number; fill: string }

/** Gabungkan piksel sebaris jadi satu kotak agar jumlah <rect> kecil. */
export function petaKeKotak(peta: Peta, palet: Record<string, string>, y0: number): Kotak[] {
  const hasil: Kotak[] = [];
  peta.forEach((baris, i) => {
    let x = 0;
    while (x < baris.length) {
      const c = baris[x];
      const warna = palet[c];
      if (!warna || c === '.') { x++; continue; }
      let w = 1;
      while (x + w < baris.length && baris[x + w] === c) w++;
      hasil.push({ x, y: y0 + i, w, fill: warna });
      x += w;
    }
  });
  return hasil;
}

export type Pose = 'diam' | 'jalan' | 'lompat' | 'merunduk';

export interface Lapisan {
  belakang: Kotak[];
  depan: Kotak[];
  tinggi: number;
}

/** Semua kotak yang membentuk satu monyet dengan skin dan pose tertentu. */
export function susunMonyet(
  warna: WarnaSkin,
  aksesori: string[] = [],
  pose: Pose = 'diam',
  bingkai = 0,
): Lapisan {
  const palet = paletDari(warna);
  const belakang: Kotak[] = [];
  const depan: Kotak[] = [];

  const merunduk = pose === 'merunduk';
  const badan = pose === 'jalan' ? (bingkai % 2 ? BADAN_JALAN : BADAN_DIAM)
    : pose === 'lompat' ? BADAN_LOMPAT
    : merunduk ? BADAN_MERUNDUK : BADAN_DIAM;

  // Saat merunduk, kepala turun 4 baris agar badan lebih pendek.
  const yKepala = ATAS + (merunduk ? 4 : 0);
  const yBadan = yKepala + KEPALA.length;

  for (const nama of aksesori) {
    const a = AKSESORI[nama];
    if (!a || !a.belakang) continue;
    belakang.push(...petaKeKotak(a.bingkai && bingkai % 2 ? a.bingkai : a.peta, a.warna, a.y + (merunduk ? 4 : 0)));
  }

  depan.push(...petaKeKotak(KEPALA, palet, yKepala));
  depan.push(...petaKeKotak(badan, palet, yBadan));

  for (const nama of aksesori) {
    const a = AKSESORI[nama];
    if (!a || a.belakang) continue;
    depan.push(...petaKeKotak(a.bingkai && bingkai % 2 ? a.bingkai : a.peta, a.warna, a.y + (merunduk ? 4 : 0)));
  }

  return { belakang, depan, tinggi: yBadan + badan.length };
}

/** Gambar ke kanvas 2D. (x, y) = pojok kiri-bawah sprite, skala = px per piksel. */
export function gambarMonyetKanvas(
  ctx: CanvasRenderingContext2D,
  lapisan: Lapisan,
  x: number,
  yBawah: number,
  skala: number,
  hadapKiri = false,
): void {
  const yAtas = yBawah - TINGGI * skala;
  ctx.save();
  if (hadapKiri) {
    ctx.translate(x + LEBAR * skala, 0);
    ctx.scale(-1, 1);
    x = 0;
  }
  for (const k of [...lapisan.belakang, ...lapisan.depan]) {
    ctx.fillStyle = k.fill;
    ctx.fillRect(Math.round(x + k.x * skala), Math.round(yAtas + k.y * skala), Math.ceil(k.w * skala), Math.ceil(skala));
  }
  ctx.restore();
}
