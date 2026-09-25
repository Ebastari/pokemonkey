import { NativeBiometric, AccessControl, BiometricAuthError } from '@capgo/capacitor-native-biometric';
import { diAplikasi } from './platform';

/**
 * Login sidik jari / wajah (hanya APK).
 *
 * Yang disimpan adalah User ID + password di Android Keystore, dikunci
 * BIOMETRY_CURRENT_SET: hanya bisa dibuka lewat BiometricPrompt, dan otomatis
 * tidak berlaku bila sidik jari di ponsel ditambah/diganti. Bukan token sesi,
 * karena layar masuk hanya muncul setelah logout — saat itu sesinya sudah dicabut
 * server, jadi token lama tak bisa dipakai lagi.
 *
 * Kredensial tetap tersimpan saat logout (justru untuk masuk lagi); dihapus bila
 * pengguna mematikannya atau password tersimpan ditolak server.
 */

const SERVER_KUNCI = 'id.ebl.pokemonkey.login';

export async function biometrikTersedia(): Promise<boolean> {
  if (!diAplikasi()) return false;
  try {
    const r = await NativeBiometric.isAvailable({ useFallback: false });
    return r.isAvailable && r.strongBiometryIsAvailable;
  } catch {
    return false;
  }
}

export async function biometrikAktif(): Promise<boolean> {
  if (!diAplikasi()) return false;
  try {
    return (await NativeBiometric.isCredentialsSaved({ server: SERVER_KUNCI })).isSaved;
  } catch {
    return false;
  }
}

export async function aktifkanBiometrik(userId: string, password: string): Promise<void> {
  await NativeBiometric.setCredentials({
    username: userId,
    password,
    server: SERVER_KUNCI,
    accessControl: AccessControl.BIOMETRY_CURRENT_SET,
    title: 'Aktifkan login sidik jari',
    negativeButtonText: 'Batal',
  });
}

export async function matikanBiometrik(): Promise<void> {
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER_KUNCI });
  } catch { /* memang belum tersimpan */ }
}

/** null = pengguna membatalkan dialog; melempar Error bila gagal karena sebab lain. */
export async function ambilKredensialBiometrik(): Promise<{ userId: string; password: string } | null> {
  try {
    const c = await NativeBiometric.getSecureCredentials({
      server: SERVER_KUNCI,
      title: 'Masuk POKEMONKEY',
      subtitle: 'Sentuh sensor sidik jari',
      negativeButtonText: 'Pakai password',
    });
    return { userId: c.username, password: c.password };
  } catch (err) {
    const kode = Number((err as { code?: string | number }).code);
    if (kode === BiometricAuthError.USER_CANCEL || kode === BiometricAuthError.SYSTEM_CANCEL
      || kode === BiometricAuthError.APP_CANCEL || kode === BiometricAuthError.USER_FALLBACK) return null;
    if (kode === BiometricAuthError.USER_LOCKOUT || kode === BiometricAuthError.USER_TEMPORARY_LOCKOUT) {
      throw new Error('Terlalu banyak percobaan. Masuk dengan password dulu.');
    }
    // Kunci Keystore batal karena sidik jari di ponsel berubah, atau sebab lain.
    await matikanBiometrik();
    throw new Error('Login sidik jari perlu diaktifkan ulang. Masuk dengan password.');
  }
}
