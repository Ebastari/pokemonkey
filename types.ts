
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
  achievedUnit: number; 
  unitType: 'ha' | 'bibit' | 'jam' | 'hari' | 'orang' | 'meter';
  photoData?: string; 
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
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface GameState {
  userId: string;
  nickname: string;
  fullName: string; 
  jabatan: string;
  statusText: string; 
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
  cloudUrl: string; 
  isOnline: boolean;
  ownedSkins: string[]; 
  activeSkinId: string;
  isLoggedIn: boolean;
}

export type AppTab = 'habitat' | 'missions' | 'calendar' | 'reports' | 'game' | 'memo' | 'team' | 'market';
