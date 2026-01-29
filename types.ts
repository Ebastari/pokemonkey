
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
  achievedUnit: number; // nilai progres yang dihasilkan
  unitType: 'ha' | 'bibit' | 'jam' | 'hari' | 'orang' | 'meter';
  photoData?: string; // base64
  notes: string;
  missionId: string;
  missionTitle: string;
}

export interface GameState {
  nickname: string;
  fullName: string; // Nama Lengkap
  jabatan: string;
  statusText: string; // Status/Bio
  profilePhoto: string;
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
}

export type AppTab = 'habitat' | 'missions' | 'calendar' | 'reports' | 'game' | 'memo';

export interface LandTile {
  id: number;
  status: 'RAW' | 'CLEARED' | 'PLANTED';
}
