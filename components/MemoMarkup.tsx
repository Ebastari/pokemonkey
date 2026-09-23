import React from 'react';

/**
 * Penampil markup ringan untuk memo (pribadi maupun Memo Internal):
 *   # Judul   ## Subjudul   - butir   - [ ] tugas   - [x] selesai   **tebal**
 * Kotak centang bisa diklik bila `onToggle` diberikan; nilainya adalah indeks
 * baris di teks asli, sehingga pemanggil cukup mengganti baris itu.
 */

export function tebal(teks: string): React.ReactNode {
  return teks.split(/(\*\*[^*]+\*\*)/g).map((b, i) =>
    b.startsWith('**') && b.endsWith('**')
      ? <b key={i} className="text-white">{b.slice(2, -2)}</b>
      : <React.Fragment key={i}>{b}</React.Fragment>,
  );
}

export const Baris: React.FC<{ teks: string; onToggle?: () => void }> = ({ teks, onToggle }) => {
  if (teks.startsWith('# ')) return <h3 className="text-[17px] font-bold text-lime-300 mt-3 mb-1 first:mt-0">{tebal(teks.slice(2))}</h3>;
  if (teks.startsWith('## ')) return <h4 className="text-[15px] font-bold text-white mt-2 mb-0.5">{tebal(teks.slice(3))}</h4>;
  if (/^- \[[ x]\] /.test(teks)) {
    const selesai = teks.startsWith('- [x]');
    return (
      <label className={`flex items-start gap-2 py-0.5 ${onToggle ? 'cursor-pointer' : ''}`}>
        <input type="checkbox" checked={selesai} onChange={onToggle} disabled={!onToggle} className="mt-1 accent-lime-500" />
        <span className={selesai ? 'line-through text-zinc-500' : 'text-zinc-100'}>{tebal(teks.slice(6))}</span>
      </label>
    );
  }
  if (teks.startsWith('- ')) return <p className="pl-3 text-zinc-100">• {tebal(teks.slice(2))}</p>;
  if (!teks.trim()) return <div className="h-2" />;
  return <p className="text-zinc-100">{tebal(teks)}</p>;
};

/** Seluruh isi memo. */
export const IsiMemo: React.FC<{ isi: string; onToggle?: (indeksBaris: number) => void; kosong?: string }> = ({ isi, onToggle, kosong = 'Kosong.' }) => (
  <>
    {isi.split('\n').map((b, i) => <Baris key={i} teks={b} onToggle={onToggle ? () => onToggle(i) : undefined} />)}
    {!isi.trim() && <p className="text-zinc-500">{kosong}</p>}
  </>
);

/** Ganti "- [ ]" ↔ "- [x]" pada satu baris; dipakai papan dan catatan pribadi. */
export function toggleBaris(isi: string, indeks: number): string {
  const baris = isi.split('\n');
  const b = baris[indeks] ?? '';
  baris[indeks] = b.startsWith('- [x]') ? b.replace('- [x]', '- [ ]') : b.replace('- [ ]', '- [x]');
  return baris.join('\n');
}
