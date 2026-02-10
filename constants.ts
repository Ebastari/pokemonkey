
import { Mission, MissionType, MissionStatus, Skin } from './types';

export const INITIAL_TOTAL_AREA = 150; // ha
export const LAND_CAPACITY_PER_DAY = 1.66; // 150ha / 90 days
export const PLANTING_CAPACITY_PER_DAY = 1.66; // 150ha / 90 days
export const NURSERY_CAPACITY_PER_DAY = 500; // bibit per hari per orang/monyet

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic Forester', description: 'Seragam standar rimbawan.', cost: 0, colors: { primary: '#8B4513', secondary: '#D2B48C', accent: '#000000' } },
  { id: 'manager', name: 'Safety Manager', description: 'Gaya mandor dengan rompi oranye.', cost: 2000, colors: { primary: '#ff6600', secondary: '#ffcc00', accent: '#333333' } },
  { id: 'botanist', name: 'Elite Botanist', description: 'Ahli bibit dengan nuansa alam.', cost: 4000, colors: { primary: '#2d5a27', secondary: '#9acd32', accent: '#1a3317' } },
  { id: 'golden', name: 'Golden Monkey', description: 'Monyet berlapis emas murni.', cost: 8000, colors: { primary: '#ffd700', secondary: '#fffacd', accent: '#b8860b' } },
  { id: 'cyber', name: 'Cyber Gorilla', description: 'Teknologi masa depan.', cost: 12000, colors: { primary: '#ff00ff', secondary: '#00ffff', accent: '#000000' } },
  { id: 'fire', name: 'Lava Primat', description: 'Terlahir dari kawah reklamasi.', cost: 15000, colors: { primary: '#cc0000', secondary: '#ff9900', accent: '#330000' } },
  { id: 'ice', name: 'Frost Ape', description: 'Dingin dan tenang.', cost: 18000, colors: { primary: '#b0e0e6', secondary: '#ffffff', accent: '#4682b4' } },
  { id: 'shadow', name: 'Ninja Monkey', description: 'Bekerja dalam kegelapan.', cost: 20000, colors: { primary: '#222222', secondary: '#444444', accent: '#ff0000' } },
  { id: 'military', name: 'Forest Guard', description: 'Siap mengawal hutan.', cost: 6000, colors: { primary: '#4b5320', secondary: '#6b8e23', accent: '#1b1e0c' } },
  { id: 'king', name: 'The Forest King', description: 'Penguasa segala rimbawan.', cost: 25000, colors: { primary: '#4b0082', secondary: '#ffd700', accent: '#000000' } },
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
  {
    id: 'm2_1',
    title: '1. Persiapan Pekerja',
    type: MissionType.NURSERY,
    description: 'Rekrut dan latih tim khusus persemaian.',
    target: 10000,
    current: 0,
    status: MissionStatus.AVAILABLE,
    rewardXP: 200,
    capacityPerDay: 2000,
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
    capacityPerDay: 10000,
    durationDays: 1,
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
