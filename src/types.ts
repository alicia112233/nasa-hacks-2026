export interface CheckIn {
  id: string;
  /** Crew member the record belongs to (MissionState.crew). Older records without one belong to the first member. */
  crewId?: string;
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
  /** Front-view thigh breadth from the body scan, with the crew member's height as the ruler. */
  thighCm?: number;
}

export interface FollowUp {
  id: string;
  /** Crew member the record belongs to (MissionState.crew). Older records without one belong to the first member. */
  crewId?: string;
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
  /** Crew member the record belongs to (MissionState.crew). Older records without one belong to the first member. */
  crewId?: string;
  date: string;
  sol: number;
  blob: Blob;
  frames: PoseFrame[];
  leftRange: number | null;
  rightRange: number | null;
}

/** Body measurements shape the 3D body; they never leave the device. */
export interface Profile {
  /** Stable id for the crew roster. */
  id?: string;
  name: string; initials: string; mission: string; duration: number; startDate?: string;
  sex?: 'female' | 'male'; heightCm?: number; massKg?: number; build?: 'slight' | 'average' | 'muscular';
  scan?: BodyScan;
  /** Body shape set by hand (no camera). The crew card counts its first step done only after a scan or this. */
  setByHand?: boolean;
}

/** Camera body scan: front-view breadths divided by torso length (src/scan.mjs). No image is kept. */
export interface BodyScan {
  date: string; shoulders: number; waist: number; hips: number; thighs: number; arms: number;
  thighOfHeight: number; armAngle: number; frames: number;
  /** What the scan suggested, and whether it was sure; the crew member confirms or changes it. */
  detected?: { sex: 'female' | 'male'; build: 'slight' | 'average' | 'muscular'; weight?: number | null; sure: { sex: boolean; build: boolean } };
}

export interface MissionState {
  checkIns: CheckIn[];
  actions: FollowUp[];
  /** The selected crew member. Kept in step with their entry in crew, so every view reads one profile. */
  profile: Profile;
  /** Everyone on this device. Each has their own scans, checks, ghost and handoffs. */
  crew?: Profile[];
  crewId?: string;
  demo: boolean;
  packets?: MissionPacket[];
}

export interface MissionPacket {
  /** Crew member the record belongs to (MissionState.crew). Older records without one belong to the first member. */
  crewId?: string;
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
