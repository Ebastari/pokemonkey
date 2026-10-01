
export enum MissionStatus {
  LOCKED = 'LOCKED',
  AVAILABLE = 'AVAILABLE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum MissionType {
  LAND_PREP = 'LAND_PREP',
  NURSERY = 'NURSERY',
  PLANTING = 'PLANTING'
}

export interface WorkPlan {
  id: string;
  date: string;      // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  description: string;
  isDone: boolean;
}

export interface Mission {
  id: string;
  title: string;
  type: MissionType;
  description: string;
  target: number; // ha or count
  current: number;
  status: MissionStatus;
  rewardXP: number;
  satuan?: string;
  durationDays?: number;
  capacityPerDay?: number;
  unlockedBy?: string[];
  startTime?: number; // game day when started
}

export interface FieldReport {
  id: string;
  timestamp: number;
  activityType: string;
  durationMinutes: number;
  achievedUnit: number; 
  unitType: 'ha' | 'bibit' | 'jam' | 'hari' | 'orang' | 'meter';
  photoData?: string;
  /** Kunci berkas di penyimpanan, diisi server untuk laporan lama. */
  foto?: string | null; 
  notes: string;
  missionId: string;
  missionTitle: string;
  userId?: string;
  userName?: string;
}

export interface TeamMember {
  name: string;
  xp: number;
  level: number;
  lastActive: string;
  totalHa: number;
}

export interface Skin {
  id: string;
  name: string;
  description: string;
  cost: number;
  /** 1 seragam · 2 aksesori · 3 aksesori+efek · 4 +jubah/sayap · 5 legenda */
  tier: 1 | 2 | 3 | 4 | 5;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  /** Nama aksesori dari lib/pixel.ts, digambar berlapis. */
  aksesori?: string[];
  efek?: 'aura' | 'kilau' | 'api' | 'es' | 'bayangan';
}

/** Satu sel roster: kode dari opsi grup 'roster' (M, S1, S2, L, C, I). */
export interface RosterSel {
  user_id: string;
  tanggal: string;
  kode: string;
  catatan?: string | null;
}

export interface Memo {
  id: string;
  user_id?: string;
  /** Nama penulis (hasil join dengan tim). */
  penulis?: string | null;
  /** pribadi = hanya pemiliknya; tim = papan Memo Internal. */
  lingkup: 'pribadi' | 'tim';
  judul: string;
  isi: string;
  ringkasan: string | null;
  kategori: string | null;
  tipe: string | null;
  status: string | null;
  tanggal: string | null;
  disematkan: number;
  warna: string | null;
  dibuat_pada: string;
  diubah_pada: string | null;
  /** Tautan ke satu PICA (id PICA) dan ringkasannya dari join di server. */
  pica_id?: string | null;
  pica_no?: number | null;
  pica_judul?: string | null;
  pica_status?: string | null;
  /** Nilai properti kustom memo (JSON, kunci = id properti). */
  props?: string | null;
}

export interface GameState {
  userId: string;
  nickname: string;
  fullName: string; 
  jabatan: string;
  statusText: string; 
  profilePhoto: string;
  phone?: string;
  currentDay: number;
  currentHour: number; 
  totalArea: number;
  clearedArea: number;
  plantedArea: number;
  seedlingsCount: number;
  seedlingsTarget: number;
  xp: number;
  level: number;
  missions: Mission[];
  reports: FieldReport[];
  memoPlans: WorkPlan[]; 
  isPaused: boolean;
  timeSpeed: number;
  monkeyHealth: number;
  stamina: number; 
  lastFeedingTime: number; 
  lives: number; 
  lastReportDay: number; 
  monkeyPos: { x: number; y: number; facing: 'left' | 'right' };
  isOnline: boolean;
  ownedSkins: string[]; 
  activeSkinId: string;
  isLoggedIn: boolean;
}

export type AppTab =
  | 'habitat' | 'pica' | 'jadwal' | 'pengumuman' | 'roster' | 'memo' | 'notif'
  | 'missions' | 'calendar' | 'money' | 'fire' | 'reports' | 'game' | 'team' | 'market';
