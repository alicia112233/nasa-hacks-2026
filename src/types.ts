export interface CheckIn {
  id: string;
  date: string;
  sol: number;
  simulated: boolean;
  reactionMs: number | null;
  missed: number;
  signals: number;
  sleep?: number;
  mood?: number;
  energy?: number;
  symptoms: string[];
  heartRate?: number;
  notes: string;
  leftRange?: number;
  rightRange?: number;
  /** Self-reported symptoms: 0 none, 1 mild, 2 strong. */
  dizziness?: number;
  vision?: number;
  breath?: number;
  joint?: number;
  gut?: number;
  skin?: number;
  grip?: number;
  back?: number;
  /** Self-reported 1–5 scales. */
  workload?: number;
  team?: number;
  appetite?: number;
  exerciseMin?: number;
}

export interface FollowUp {
  id: string;
  title: string;
  kind: 'movement' | 'attention' | 'wellbeing' | RegionId;
  notes: string;
  checklist: string[];
  createdAt: string;
  scheduledAt: string;
  status: 'scheduled' | 'complete';
  simulated: boolean;
}

export interface PoseFrame {
  time: number;
  landmarks: { x: number; y: number; z: number; visibility?: number }[];
}

export interface Recording {
  id: string;
  date: string;
  sol: number;
  blob: Blob;
  frames: PoseFrame[];
  leftRange: number | null;
  rightRange: number | null;
}

/** Body measurements shape the 3D body; they never leave the device. */
export interface Profile {
  name: string; initials: string; mission: string; duration: number; startDate?: string;
  sex?: 'female' | 'male'; heightCm?: number; massKg?: number; build?: 'slight' | 'average' | 'muscular';
}

export interface MissionState {
  checkIns: CheckIn[];
  actions: FollowUp[];
  profile: Profile;
  demo: boolean;
  packets?: MissionPacket[];
}

export interface MissionPacket {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  source: 'simulated' | 'recorded';
  sol: number;
  asOfDate: string;
  actionCutoff: string;
  crew: string;
  mission: string;
  status: 'queued' | 'downloaded';
  downloadedAt?: string;
  context: string;
  observations: CheckIn[];
  actions: FollowUp[];
  communication: { oneWayMinutes: number; blackoutDrill: boolean; transmitted: false };
  analysis: Record<string, unknown>;
  sources: { title: string; url: string; role: string }[];
  research?: { reviewedOn: string; externalMeasurementsImported: boolean; prototypeThresholdsValidated: boolean; description: string };
  limitations: string[];
}

export type Page = 'body' | 'trends' | 'handoff' | 'mission';
export type RegionId = 'head' | 'eyes' | 'chest' | 'abdomen' | 'arms' | 'hands' | 'pelvis' | 'legs' | 'cabin';
export type FlagKind = 'movement' | 'attention' | 'wellbeing';
export type HazardId = 'isolation' | 'gravity' | 'environment' | 'distance' | 'radiation';
