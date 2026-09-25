/**
 * Alarm tenggat PICA.
 *
 * Tenggat PICA hanya berupa tanggal, jadi jamnya ditentukan pemakai (bawaan 07.00
 * WITA). Alarm berbunyi dua kali: sehari sebelum tenggat dan pada hari tenggat.
 * Yang sudah telat tidak dibunyikan tiap hari — itu sudah ditangani rekap pagi.
 *
 * Bawaannya mati; hanya PICA yang sengaja ditandai pemiliknya yang berbunyi.
 * Pengaturannya disimpan di server supaya tidak hilang saat APK dipasang ulang.
 *
 * Penjadwalan memakai LocalNotifications: begitu dijadwalkan, sistem Android yang
 * memegangnya, jadi tetap berbunyi walau aplikasi ditutup. Jamnya bisa meleset
 * beberapa menit karena aplikasi ini tidak memakai izin alarm presisi.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api } from './api';
import * as W from './waktu';

export interface AlarmPica {
  pica_id: string;
  jam: string;
  aktif: number;
}

export interface PicaTenggat {
  id: string;
  judul: string;
  due_date: string | null;
  status: string;
}

/** Rentang id notifikasi khusus alarm PICA, supaya tidak bentrok dengan alarm agenda. */
const ID_AWAL = 300_000;
const ID_AKHIR = 399_999;

const idNotif = (picaId: string, hariKe: 0 | 1): number => {
  const dasar = Math.abs(picaId.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)) % 45_000;
  return ID_AWAL + dasar * 2 + hariKe;
};

export const ambilAlarmPica = () => api<{ alarm: AlarmPica[]; jamBawaan: string }>('/api/pica-alarm');
export const simpanAlarmPica = (pica_id: string, aktif: boolean, jam?: string) =>
  api<{ ok: boolean }>('/api/pica-alarm', { body: { pica_id, aktif, jam } });
export const simpanJamBawaanAlarm = (jam: string) =>
  api<{ jamBawaan: string }>('/api/pica-alarm/jam', { body: { jam } });

/** Label sisa waktu untuk widget dan layar: "TELAT 3 HARI", "HARI INI", "H-2". */
export function labelSisa(dueDate: string | null, hariIni: string): string {
  if (!dueDate) return 'TANPA TENGGAT';
  const sisa = W.selisihHari(dueDate, hariIni);
  if (sisa < 0) return `TELAT ${Math.abs(sisa)} HARI`;
  if (sisa === 0) return 'HARI INI';
  if (sisa === 1) return 'BESOK';
  return `H-${sisa}`;
}

/** Waktu WITA (tanggal + jam) sebagai Date lokal perangkat. */
function waktuWita(tanggal: string, jam: string): Date {
  const [j, m] = jam.split(':').map(Number);
  const utc = Date.parse(`${tanggal}T00:00:00Z`) + (j * 60 + m - W.OFFSET_WITA_MENIT) * 60_000;
  return new Date(utc);
}

/**
 * Pasang ulang seluruh alarm PICA milik pemakai ini.
 * Semua alarm lama dibatalkan dulu agar PICA yang sudah ditutup tidak ikut berbunyi.
 */
export async function pasangAlarmPica(pica: PicaTenggat[], alarm: AlarmPica[], jamBawaan: string): Promise<number> {
  if (!Capacitor.isNativePlatform()) return 0;

  try {
    const tertunda = await LocalNotifications.getPending();
    const lama = tertunda.notifications.filter((n) => n.id >= ID_AWAL && n.id <= ID_AKHIR);
    if (lama.length) await LocalNotifications.cancel({ notifications: lama.map((n) => ({ id: n.id })) });

    await LocalNotifications.createChannel({
      id: 'pica_channel',
      name: 'Tenggat PICA',
      description: 'Pengingat tenggat PICA yang alarmnya dinyalakan sendiri',
      importance: 5,
      visibility: 1,
      vibration: true,
    });

    const hariIni = W.hariIniWita();
    const peta = new Map(alarm.filter((a) => a.aktif).map((a) => [a.pica_id, a.jam || jamBawaan]));
    const daftar: Parameters<typeof LocalNotifications.schedule>[0]['notifications'] = [];

    for (const p of pica) {
      const jam = peta.get(p.id);
      if (!jam || !p.due_date || p.status === 'Closed' || p.due_date < hariIni) continue;

      // Sehari sebelum tenggat, lalu pada hari tenggat.
      const jadwal: [string, 0 | 1, string][] = [
        [W.geserHari(p.due_date, -1), 1, 'Besok tenggatnya'],
        [p.due_date, 0, 'Hari ini tenggatnya'],
      ];
      for (const [tanggal, ke, awalan] of jadwal) {
        const saat = waktuWita(tanggal, jam);
        if (saat.getTime() <= Date.now()) continue;
        daftar.push({
          id: idNotif(p.id, ke),
          title: `${p.id} · ${awalan}`,
          body: p.judul,
          channelId: 'pica_channel',
          schedule: { at: saat, allowWhileIdle: true },
          autoCancel: true,
          extra: { tab: 'pica', picaId: p.id },
        });
      }
    }

    if (daftar.length) await LocalNotifications.schedule({ notifications: daftar });
    return daftar.length;
  } catch (e) {
    console.warn('Alarm PICA gagal dipasang', e);
    return 0;
  }
}
