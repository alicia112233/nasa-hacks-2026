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
  headache?: number;
  /** Hours asleep in the last sleep period. */
  sleepHours?: number;
  /** Body temperature from a thermometer, °C. */
  temperatureC?: number;
  /** Blood pressure from a cuff, mmHg. */
  bpSys?: number;
  bpDia?: number;
  /** Checks set aside for the day, such as blood pressure with no cuff to hand. */
  skipped?: string[];
  /** Checks retained in this day's routine, including concerns that clear after a repeat. */
  planned?: string[];
  /** Per-metric timestamps and conditions survive partial updates to a daily entry. */
  measurements?: Record<string, MeasurementContext>;
}

export type MissionPhase = 'preflight' | 'adaptation' | 'cruise' | 'surface' | 'return' | 'unknown';
export interface RecordingContext {
  phase: MissionPhase;
  cameraSetup: string;
  posture: string;
  lighting: string;
  clothing: string;
  activity: string;
}
export interface MeasurementContext extends RecordingContext {
  measuredAt: string;
  quality: 'good' | 'poor' | 'unknown';
  /** The reading's unit (bpm, °C, mmHg, h…) and how it was taken (wrist pulse, oral thermometer, automatic cuff…). */
  unit?: string;
  method?: string;
  confidentFrames?: number;
  spread?: number;
  recordingId?: string;
}
export interface GhostReference {
  id: string; crewId?: string; simulated: boolean; phase: MissionPhase;
  establishedAt: string; reason: string; records: CheckIn[];
}
export interface CabinReading {
  id: string; date: string; location: string; co2Ppm: number; temperatureC?: number; humidityPct?: number;
  source: 'manual' | 'simulated';
}
export interface CheckRun {
  id: string; crewId?: string; simulated: boolean; checkId: string; field: string;
  reason: string; startedAt: string; completedAt?: string; abandonedAt?: string;
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
  confidentFrames?: { left: number; right: number };
  conditions?: MeasurementContext;
}

/** Body measurements shape the 3D body; they never leave the device. */
export interface Profile {
  /** Stable id for the crew roster. */
  id?: string;
  name: string; initials: string; mission: string; duration: number; startDate?: string;
  /** Chosen avatar model, never inferred as the crew member's sex or gender. */
  sex?: 'female' | 'male'; heightCm?: number; massKg?: number; build?: 'slight' | 'average' | 'muscular';
  /** The scan that shapes the figure: the latest body scan, unless it was deleted. */
  scan?: BodyScan;
  /** Every saved scan, oldest first: body scans and leg outlines. Ratios only; no image is kept. */
  scans?: BodyScan[];
  /** Body shape set by hand (no camera). The crew card counts its first step done only after a scan or this. */
  setByHand?: boolean;
  recordingContext?: RecordingContext;
  /** Clips chosen as the movement ghost, oldest first. The last one is the ghost; the first clip is the ghost until one is chosen. */
  ghostClips?: GhostClip[];
}
export interface GhostClip { recordingId: string; reason: string; setAt: string }

/** Camera body scan: front-view breadths divided by torso length (src/scan.mjs). No image is kept; the review clip is never stored. */
export interface BodyScan {
  /** Stable id for the history; scans saved before history fall back to their date. */
  id?: string;
  /** setup: Scan me (shapes the figure); legs: the H Legs leg outline. */
  mode?: 'setup' | 'legs';
  date: string; shoulders: number; waist: number; hips: number; thighs: number; arms: number;
  thighOfHeight: number; armAngle: number; frames: number;
  /** Frame-to-frame disagreement on each breadth, as a fraction of it. Absent on scans saved before it was kept. */
  spread?: Record<string, number>;
  /** Avatar fit (legacy scans may contain a model guess). New scans fix sex to the chosen model; sure.sex is false. weights: fit weight per "sex/build". */
  detected?: { sex: 'female' | 'male'; build: 'slight' | 'average' | 'muscular'; weight?: number | null; weights?: Record<string, number>; sure: { sex: boolean; build: boolean } };
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
  references?: GhostReference[];
  cabinReadings?: CabinReading[];
  checkRuns?: CheckRun[];
  /** Which sample crew this device has been given, so new sample members arrive once. */
  sampleVersion?: number;
  careUpdates?: CareUpdate[];
}

export interface ProcedureRecord {
  status: 'none' | 'followed' | 'unknown';
  name: string;
  version: string;
}
export interface CarePlan {
  procedure: ProcedureRecord;
  nextCheck: string;
  dueAt: string;
  missingInformation: string[];
}
export interface CareUpdate {
  id: string; packetId: string; crewId?: string; source: 'simulated' | 'recorded'; recordedAt: string;
  observation: string; change: 'improved' | 'unchanged' | 'worse' | 'unclear';
  plan: CarePlan;
  measurements: { checkInId: string; field: string; value: number; measuredAt: string; conditions?: MeasurementContext }[];
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
  status: 'saved' | 'downloaded' | 'queued'; // queued is retained for older local packets only
  downloadedAt?: string;
  context: string;
  carePlan?: CarePlan;
  observations: CheckIn[];
  actions: FollowUp[];
  communication: { oneWayMinutes: number; blackoutDrill: boolean; transmitted: false };
  analysis: Record<string, unknown>;
  sources: { title: string; url: string; role: string }[];
  research?: { reviewedOn: string; externalMeasurementsImported: boolean; prototypeThresholdsValidated: boolean; description: string };
  limitations: string[];
}

export type Page = 'body' | 'trends' | 'report' | 'risks' | 'sources';
export type RegionId = 'head' | 'eyes' | 'chest' | 'abdomen' | 'arms' | 'hands' | 'pelvis' | 'legs' | 'cabin';
export type FlagKind = 'movement' | 'attention' | 'wellbeing';
export type HazardId = 'isolation' | 'gravity' | 'environment' | 'distance' | 'radiation';

export type Level = 'watch' | 'tell' | 'now';
/** One thing that needs attention, from the shared assessment (src/assess.mjs). Every page shows these same words. */
export interface Concern {
  checkId: string; field: string; region: RegionId; title: string;
  /** Has a trend against the ghost among its findings. */
  trend: boolean;
  level: Level; label: string; reason: string;
  steps: { text: string; action?: string; checkId: string }[];
  measuredAt: string | null;
}
