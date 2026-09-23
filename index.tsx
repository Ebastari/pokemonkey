
import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/press-start-2p';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/500.css';
import '@fontsource/pixelify-sans/700.css';
import './index.css';
import App from './App';
import { daftarkanServiceWorker } from './lib/notifikasi';
import { bacaTema, pasangTema } from './lib/tema';

// Dipasang sebelum React menggambar, agar tidak ada kedipan gelap saat dibuka.
pasangTema(bacaTema());

// Service worker hanya untuk Web Push (tanpa cache halaman); dilewati di APK.
void daftarkanServiceWorker();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
