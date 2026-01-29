
import { Mission, MissionType, MissionStatus } from './types';

export const INITIAL_TOTAL_AREA = 150; // ha
export const LAND_CAPACITY_PER_DAY = 1.66; // 150ha / 90 days
export const PLANTING_CAPACITY_PER_DAY = 1.66; // 150ha / 90 days
export const NURSERY_CAPACITY_PER_DAY = 500; // bibit per hari per orang/monyet

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const INITIAL_MISSIONS: Mission[] = [
  {
    id: 'm1',
    title: 'Penataan Lahan (3 Bulan)',
    type: MissionType.LAND_PREP,
    description: 'Menata 150ha lahan kritis agar siap ditanami. Membutuhkan waktu dan ketelitian.',
    target: INITIAL_TOTAL_AREA,
    current: 0,
    status: MissionStatus.AVAILABLE,
    rewardXP: 1000,
    capacityPerDay: LAND_CAPACITY_PER_DAY,
    durationDays: 90
  },
  // --- SUB-MISI PERSEMAIAN (NURSERY CHAIN) ---
  // Target persemaian diubah ke satuan Bibit (Contoh: 10.000 bibit)
  {
    id: 'm2_1',
    title: '1. Persiapan Pekerja',
    type: MissionType.NURSERY,
    description: 'Rekrut dan latih tim khusus persemaian.',
    target: 10000,
    current: 0,
    status: MissionStatus.AVAILABLE,
    rewardXP: 200,
    capacityPerDay: 2000, // Misal rekrutmen cepat
    durationDays: 5
  },
  {
    id: 'm2_2',
    title: '2. Media Tanam',
    type: MissionType.NURSERY,
    description: 'Mixing tanah topsoil, kompos, dan pasir.',
    target: 10000,
    current: 0,
    status: MissionStatus.AVAILABLE,
    rewardXP: 300,
    capacityPerDay: NURSERY_CAPACITY_PER_DAY,
    durationDays: 20,
    unlockedBy: ['m2_1']
  },
  {
    id: 'm2_3',
    title: '3. Pengisian Polybag',
    type: MissionType.NURSERY,
    description: 'Mengisi polybag dengan media yang telah disiapkan.',
    target: 10000,
    current: 0,
    status: MissionStatus.AVAILABLE,
    rewardXP: 400,
    capacityPerDay: 400,
    durationDays: 25,
    unlockedBy: ['m2_2']
  },
  {
    id: 'm2_6',
    title: '6. Penyemaian Benih',
    type: MissionType.NURSERY,
    description: 'Penanaman benih unggul Sengon ke tiap polybag.',
    target: 10000,
    current: 0,
    status: MissionStatus.AVAILABLE,
    rewardXP: 500,
    capacityPerDay: 800,
    durationDays: 12,
    unlockedBy: ['m2_3']
  },
  {
    id: 'm2_7',
    title: '7. Pemeliharaan Rutin',
    type: MissionType.NURSERY,
    description: 'Penyiraman intensif pagi dan sore.',
    target: 10000,
    current: 0,
    status: MissionStatus.AVAILABLE,
    rewardXP: 450,
    capacityPerDay: 10000, // Sekali siram semua kena
    durationDays: 1, // Durasi per siklus
    unlockedBy: ['m2_6']
  },
  {
    id: 'm2_10',
    title: '10. Sertifikasi Bibit',
    type: MissionType.NURSERY,
    description: 'Pemeriksaan akhir kesiapan bibit sebelum distribusi.',
    target: 10000,
    current: 0,
    status: MissionStatus.AVAILABLE,
    rewardXP: 800,
    capacityPerDay: 2500,
    durationDays: 4,
    unlockedBy: ['m2_7']
  },
  // --- MISI FINAL ---
  {
    id: 'm3',
    title: 'Penanaman Masif',
    type: MissionType.PLANTING,
    description: 'Menanam seluruh bibit ke 150ha lahan yang sudah siap.',
    target: INITIAL_TOTAL_AREA,
    current: 0,
    status: MissionStatus.AVAILABLE,
    rewardXP: 2500,
    capacityPerDay: PLANTING_CAPACITY_PER_DAY,
    durationDays: 90,
    unlockedBy: ['m1', 'm2_10']
  }
];
