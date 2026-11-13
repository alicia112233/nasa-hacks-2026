export interface CheckIn {
  id: string;
  date: string;
  sol: number;
  simulated: boolean;
  reactionMs: number | null;
  missed: number;
  signals: number;
  sleep: number;
  mood: number;
  energy: number;
  symptoms: string[];
  heartRate?: number;
  notes: string;
  leftRange?: number;
  rightRange?: number;
}

export interface FollowUp {
  id: string;
  title: string;
  kind: 'movement' | 'attention' | 'wellbeing';
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

export interface MissionState {
  checkIns: CheckIn[];
  actions: FollowUp[];
  profile: { name: string; initials: string; mission: string; duration: number; startDate?: string };
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

export type Page = 'overview' | 'lens' | 'movement' | 'flight' | 'insights' | 'actions';
export type FlagKind = 'movement' | 'attention' | 'wellbeing';
export type HazardId = 'isolation' | 'gravity' | 'environment' | 'distance' | 'radiation';
