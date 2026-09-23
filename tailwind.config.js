/**
 * Tailwind v3.4 dipasang lokal menggantikan cdn.tailwindcss.com.
 *
 * Sengaja TIDAK memakai v4: v4 memindahkan penanda !important dari depan ke
 * belakang kelas (`!bg-zinc-900` -> `bg-zinc-900!`). Seluruh kode POKEMONKEY
 * memakai bentuk depan, jadi v4 akan mengubah tampilan diam-diam.
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [
    './index.html',
    './App.tsx',
    './MonkeyRace.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
