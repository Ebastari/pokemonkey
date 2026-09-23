import { Capacitor } from '@capacitor/core';

/** true saat berjalan di dalam APK (WebView Capacitor), false di browser. */
export const diAplikasi = (): boolean => Capacitor.isNativePlatform();

/**
 * Minta layar penuh browser. Di APK dilewati: WebView Capacitor langsung
 * membatalkannya (BridgeWebChromeClient.onShowCustomView), sehingga yang tersisa
 * hanya perubahan ukuran mendadak di tengah permainan.
 * Di APK, lapisan `fixed inset-0` sudah menutup seluruh layar.
 */
export function mintaLayarPenuh(): void {
  if (diAplikasi() || document.fullscreenElement) return;
  const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
  el.requestFullscreen?.().catch(() => undefined);
}

export function keluarLayarPenuh(): void {
  if (diAplikasi() || !document.fullscreenElement) return;
  document.exitFullscreen?.().catch(() => undefined);
}
