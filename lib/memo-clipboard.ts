/**
 * Penerjemah Clipboard Cerdas (Smart Clipboard Parser) untuk Memo POKEMONKEY.
 *
 * Menerjemahkan data clipboard (text/html dan text/plain) dari Word, Excel,
 * Google Docs/Sheets, dan Web menjadi blok interaktif memo:
 *   - Tabel (Excel TSV & Word HTML <table>) -> !tabel{...}
 *   - Ceklis (Unicode ☐/☑, [ ]/[x], Docs task-list) -> - [ ] / - [x]
 *   - Penomoran & butir -> 1. / -
 *   - Judul / Heading -> #, ##, ###, ####
 *   - Tautan & gaya huruf inline (tebal, miring, garis bawah, coret, kode)
 */

import { MAKS_BARIS_TABEL, MAKS_KOLOM_TABEL, rakitTabel } from '../server/src/memo-blok';
import { uraiCsvKeMatriks } from './impor-tabel';

export interface HasilTempel {
  /** Apakah tempelan ini menghasilkan satu atau banyak baris terstruktur */
  baris: string[];
  /** Apakah tempelan ini merupakan tabel murni */
  tabel?: boolean;
}

/** Bersihkan teks sel tabel: hilangkan ganti baris dan rapikan spasi (hingga 2000 karakter agar tidak terpotong) */
function bersihkanSel(teks: string): string {
  return teks
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 2000);
}

/** Konversi elemen DOM node menjadi teks inline memo */
function domKeInline(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const anak = Array.from(el.childNodes).map(domKeInline).join('');

  if (!anak.trim() && tag !== 'br') return '';

  switch (tag) {
    case 'b':
    case 'strong':
      return `**${anak.trim()}**`;
    case 'i':
    case 'em':
      return `*${anak.trim()}*`;
    case 'u':
    case 'ins':
      return `++${anak.trim()}++`;
    case 's':
    case 'strike':
    case 'del':
      return `~~${anak.trim()}~~`;
    case 'code':
      return `\`${anak.trim()}\``;
    case 'a': {
      const href = el.getAttribute('href');
      if (href && /^https?:\/\//i.test(href)) {
        return `[${anak.trim() || href}](${href})`;
      }
      return anak;
    }
    case 'br':
      return ' ';
    default:
      return anak;
  }
}

/** Ekstraksi tabel dari elemen <table> HTML menjadi baris blok !tabel{...} */
function prosesTabelHtml(tableEl: HTMLTableElement): string | null {
  const trList = Array.from(tableEl.querySelectorAll('tr'));
  if (trList.length === 0) return null;

  const barisData: string[][] = [];
  let adaTh = false;

  for (const tr of trList.slice(0, MAKS_BARIS_TABEL)) {
    const selElements = Array.from(tr.querySelectorAll<HTMLTableCellElement>('th, td'));
    if (selElements.length === 0) continue;

    if (tr.querySelector('th')) adaTh = true;

    const baris: string[] = selElements.slice(0, MAKS_KOLOM_TABEL).map((sel) => {
      // Ambil teks atau inline format di dalam sel
      const txt = Array.from(sel.childNodes).map(domKeInline).join('');
      return bersihkanSel(txt || sel.innerText || sel.textContent || '');
    });

    if (baris.some((s) => s.length > 0)) {
      barisData.push(baris);
    }
  }

  if (barisData.length === 0) return null;

  // Samakan panjang semua kolom
  const maxKolom = Math.min(MAKS_KOLOM_TABEL, Math.max(1, ...barisData.map((r) => r.length)));
  const normal = barisData.map((r) => {
    const salin = r.slice(0, maxKolom);
    while (salin.length < maxKolom) salin.push('');
    return salin;
  });

  return rakitTabel(normal, adaTh || normal.length > 1);
}

/** Ekstraksi elemen HTML menjadi kumpulan baris blok memo */
function prosesHtml(html: string): string[] | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const body = doc.body;
    if (!body) return null;

    // Jika hanya berisi satu tabel murni (kasus paling umum saat copy tabel Word/Excel/Sheets)
    const tables = body.querySelectorAll('table');
    if (tables.length === 1 && body.textContent?.trim() === tables[0].textContent?.trim()) {
      const tabelRaw = prosesTabelHtml(tables[0]);
      if (tabelRaw) return [tabelRaw];
    }

    const hasil: string[] = [];

    // Iterasi elemen tingkat atas atau kontainer
    const prosesNode = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = (node.textContent || '').replace(/\r\n?/g, '\n').trim();
        if (t) hasil.push(t);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // 1. Tag Tabel
      if (tag === 'table') {
        const tabelRaw = prosesTabelHtml(el as HTMLTableElement);
        if (tabelRaw) hasil.push(tabelRaw);
        return;
      }

      // 2. Tag Heading
      if (/^h[1-6]$/.test(tag)) {
        const tingkat = Math.min(4, Math.max(1, parseInt(tag[1], 10)));
        const awalan = '#'.repeat(tingkat);
        const teks = domKeInline(el).trim();
        if (teks) hasil.push(`${awalan} ${teks}`);
        return;
      }

      // 3. Tag List Item
      if (tag === 'li') {
        const checkbox = el.querySelector<HTMLInputElement>('input[type="checkbox"]');
        const ceklisKelas = el.classList.contains('task-list-item') || el.getAttribute('role') === 'checkbox';
        const ariaChecked = el.getAttribute('aria-checked') === 'true';

        // Deteksi apakah item list ini adalah ceklis
        if (checkbox || ceklisKelas || el.getAttribute('role') === 'checkbox') {
          const selesai = checkbox ? checkbox.checked : ariaChecked;
          // Ambil teks tanpa checkbox
          const teks = domKeInline(el).trim();
          hasil.push(`- [${selesai ? 'x' : ' '}] ${teks}`);
          return;
        }

        const induk = el.parentElement?.tagName.toLowerCase();
        const teks = domKeInline(el).trim();
        if (induk === 'ol') {
          hasil.push(`1. ${teks}`);
        } else {
          hasil.push(`- ${teks}`);
        }
        return;
      }

      // 4. Tag Blockquote
      if (tag === 'blockquote') {
        const teks = domKeInline(el).trim();
        if (teks) hasil.push(`> ${teks}`);
        return;
      }

      // 5. Tag Pre / Code block
      if (tag === 'pre') {
        const teks = (el.textContent || '').trim();
        if (teks) hasil.push(teks);
        return;
      }

      // 6. Tag HR / Divider
      if (tag === 'hr') {
        hasil.push('---');
        return;
      }

      // 7. Paragraf atau div
      if (tag === 'p' || tag === 'div') {
        // Cek jika di dalamnya ada tabel
        const subTable = el.querySelector('table');
        if (subTable) {
          Array.from(el.childNodes).forEach(prosesNode);
          return;
        }
        const teks = domKeInline(el).trim();
        if (teks) hasil.push(teks);
        return;
      }

      // 8. Elemen daftar (ul/ol)
      if (tag === 'ul' || tag === 'ol') {
        Array.from(el.children).forEach(prosesNode);
        return;
      }

      // Elemen lainnya
      Array.from(el.childNodes).forEach(prosesNode);
    };

    Array.from(body.childNodes).forEach(prosesNode);
    return hasil.length > 0 ? hasil : null;
  } catch {
    return null;
  }
}

/**
 * Deteksi apakah teks biasa merupakan format tabel TSV (Tab-Separated Values)
 * seperti saat menyalin sel dari Microsoft Excel atau Google Sheets.
 */
function prosesTsvTeks(teks: string): string | null {
  const baris = teks.split(/\r?\n/).map((b) => b.trimEnd()).filter(Boolean);
  if (baris.length === 0) return null;

  // Cek apakah ada karakter tab
  const barisDenganTab = baris.filter((b) => b.includes('\t'));
  if (barisDenganTab.length === 0) return null;

  // Jika minimal 1 baris punya tab dan jumlah baris > 1, atau 1 baris punya minimal 2 tab
  const punyaBanyakKolom = baris.some((b) => b.split('\t').length >= 2);
  if (!punyaBanyakKolom) return null;

  const matriks = baris.slice(0, MAKS_BARIS_TABEL).map((b) =>
    b.split('\t').slice(0, MAKS_KOLOM_TABEL).map(bersihSelTsv)
  );

  const lebar = Math.min(MAKS_KOLOM_TABEL, Math.max(1, ...matriks.map((r) => r.length)));
  const normal = matriks.map((r) => {
    const row = r.slice(0, lebar);
    while (row.length < lebar) row.push('');
    return row;
  });

  return rakitTabel(normal, true);
}

function bersihSelTsv(s: string): string {
  return s.replace(/^"|"$/g, '').replace(/""/g, '"').trim().slice(0, 2000);
}

/**
 * Deteksi apakah teks berformat Markdown Table (| Kolom 1 | Kolom 2 | ... |)
 */
function prosesMarkdownTabel(teks: string): string | null {
  const baris = teks.split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
  if (baris.length < 2) return null;

  const barisPipa = baris.filter((b) => b.includes('|'));
  if (barisPipa.length < 2) return null;

  const matriks: string[][] = [];
  for (const b of barisPipa) {
    // Abaikan baris pembatas markdown seperti |:---:|---|---| atau :--- | ---
    if (/^[|\s:-]+$/.test(b)) continue;

    let bersih = b;
    if (bersih.startsWith('|')) bersih = bersih.slice(1);
    if (bersih.endsWith('|')) bersih = bersih.slice(0, -1);

    const sel = bersih.split('|').map((s) => s.trim().slice(0, 2000));
    if (sel.length >= 2) {
      matriks.push(sel);
    }
  }

  if (matriks.length < 2) return null;

  const lebar = Math.min(MAKS_KOLOM_TABEL, Math.max(1, ...matriks.map((r) => r.length)));
  const normal = matriks.slice(0, MAKS_BARIS_TABEL).map((r) => {
    const row = r.slice(0, lebar);
    while (row.length < lebar) row.push('');
    return row;
  });

  return rakitTabel(normal, true);
}

/**
 * Deteksi apakah teks berformat CSV (pemisah koma atau titik koma) multi-baris
 */
function prosesCsvTeks(teks: string): string | null {
  const baris = teks.split(/\r?\n/).map((b) => b.trim()).filter(Boolean);
  if (baris.length < 2) return null;

  // Cek konsistensi pemisah koma atau titik koma
  const countComma = baris.map((b) => (b.match(/,/g) || []).length);
  const countSemi = baris.map((b) => (b.match(/;/g) || []).length);

  const delimiter =
    countComma[0] >= 1 && countComma.slice(0, 5).every((c) => c === countComma[0] && c > 0)
      ? ','
      : countSemi[0] >= 1 && countSemi.slice(0, 5).every((s) => s === countSemi[0] && s > 0)
      ? ';'
      : null;

  if (!delimiter) return null;

  const matriks = uraiCsvKeMatriks(teks);
  if (matriks.length < 2 || matriks[0].length < 2) return null;

  return rakitTabel(matriks, true);
}

/**
 * Normalisasi satu baris teks biasa:
 * mengenali simbol ceklis Unicode, nomor, butir, dan heading.
 */
function normalisasiBarisTeks(baris: string): string {
  const trim = baris.trim();
  if (!trim) return baris;

  // 1. Ceklis dengan simbol kotak kosong (Belum selesai)
  // ☐ (U+2610), ◻ (U+25FB), ◽ (U+25FD), ▢ (U+25A2), □ (U+25A1)
  const mKosong = trim.match(/^[☐◻◽▢□]\s*(.*)$/);
  if (mKosong) return `- [ ] ${mKosong[1]}`;

  // 2. Ceklis dengan tanda centang (Selesai)
  // ☑ (U+2611), ☒ (U+2612), ✓ (U+2713), ✔ (U+2714), 🗹 (U+1F5F9)
  const mSelesai = trim.match(/^[☑☒✓✔🗹]\s*(.*)$/);
  if (mSelesai) return `- [x] ${mSelesai[1]}`;

  // 3. Notasi kurung kotak tanpa minus: "[ ] Tugas" atau "[x] Tugas"
  const mKurung = trim.match(/^\[([ xX])\]\s*(.*)$/);
  if (mKurung) return `- [${mKurung[1].toLowerCase() === 'x' ? 'x' : ' '}] ${mKurung[2]}`;

  // 4. Notasi kurung biasa: "( ) Tugas" atau "(x) Tugas"
  const mKurungBiasa = trim.match(/^\(([ xX])\)\s*(.*)$/);
  if (mKurungBiasa) return `- [${mKurungBiasa[1].toLowerCase() === 'x' ? 'x' : ' '}] ${mKurungBiasa[2]}`;

  // 5. Simbol butir / bullet khusus: •, ●, ○, ◦, ▪, ▫, –, —
  const mButir = trim.match(/^[•●○◦▪▫–—]\s*(.*)$/);
  if (mButir) return `- ${mButir[1]}`;

  // 6. Penomoran dengan kurung: "1) Tugas" atau "(1) Tugas"
  const mNomorKurung = trim.match(/^\(?(\d{1,3})\)\s+(.*)$/);
  if (mNomorKurung) return `${mNomorKurung[1]}. ${mNomorKurung[2]}`;

  return baris;
}

/**
 * Urai data clipboard secara menyeluruh.
 * Mengembalikan array baris yang siap dimasukkan sebagai blok memo.
 */
export function uraiClipboard(clipboardData: DataTransfer): HasilTempel {
  const html = clipboardData.getData('text/html');
  const teksPolos = clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');

  // 1. Jika ada HTML yang memuat tabel Word/Excel/Web
  if (html) {
    const hasilHtml = prosesHtml(html);
    if (hasilHtml && hasilHtml.length > 0) {
      const tabelSaja = hasilHtml.length === 1 && hasilHtml[0].startsWith('!tabel');
      return { baris: hasilHtml, tabel: tabelSaja };
    }
  }

  // 2. Jika teks biasa memuat tab (TSV dari Excel/Sheets yang disalin tanpa HTML)
  if (teksPolos && teksPolos.includes('\t')) {
    const tabelTsv = prosesTsvTeks(teksPolos);
    if (tabelTsv) {
      return { baris: [tabelTsv], tabel: true };
    }
  }

  // 3. Jika teks biasa berupa tabel Markdown (| Kolom 1 | Kolom 2 | ...)
  if (teksPolos && teksPolos.includes('|')) {
    const tabelMd = prosesMarkdownTabel(teksPolos);
    if (tabelMd) {
      return { baris: [tabelMd], tabel: true };
    }
  }

  // 4. Jika teks biasa berupa CSV terstruktur (koma / titik koma)
  if (teksPolos && (teksPolos.includes(',') || teksPolos.includes(';'))) {
    const tabelCsv = prosesCsvTeks(teksPolos);
    if (tabelCsv) {
      return { baris: [tabelCsv], tabel: true };
    }
  }

  // 5. Normalisasi teks baris per baris (ceklis simbol, butir, nomor)
  const barisMentah = teksPolos ? teksPolos.split('\n') : [''];
  const baris = barisMentah.map(normalisasiBarisTeks);

  return { baris, tabel: false };
}

/**
 * Pecah data clipboard menjadi matriks 2D untuk penempelan
 * multi-sel di dalam tabel yang sudah ada (TabelSunting).
 */
export function uraiTsvKeMatriks(clipboardData: DataTransfer): string[][] | null {
  const teks = clipboardData.getData('text/plain').replace(/\r\n?/g, '\n');
  if (!teks) return null;

  // 1. Cek Markdown Table jika memuat tanda pipa
  if (teks.includes('|')) {
    const baris = teks.split('\n').map((b) => b.trim()).filter(Boolean);
    const barisPipa = baris.filter((b) => b.includes('|') && !/^[|\s:-]+$/.test(b));
    if (barisPipa.length >= 1) {
      const matriks = barisPipa.map((b) => {
        let bersih = b;
        if (bersih.startsWith('|')) bersih = bersih.slice(1);
        if (bersih.endsWith('|')) bersih = bersih.slice(0, -1);
        return bersih.split('|').map((s) => s.trim().slice(0, 2000));
      });
      if (matriks.length > 0 && matriks[0].length >= 2) return matriks;
    }
  }

  // 2. Cek TSV (Excel/Sheets)
  if (teks.includes('\t')) {
    const baris = teks.split('\n').filter((b, idx, arr) => idx < arr.length - 1 || b.trim().length > 0);
    if (baris.length > 0) {
      return baris.map((b) => b.split('\t').map((c) => bersihSelTsv(c)));
    }
  }

  // 3. Cek CSV jika ada koma/titik koma multi-kolom
  if (teks.includes(',') || teks.includes(';')) {
    const csv = uraiCsvKeMatriks(teks);
    if (csv.length > 0 && csv[0].length >= 2) return csv;
  }

  return null;
}
