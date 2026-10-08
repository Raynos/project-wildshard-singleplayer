// The admin site's view bundle (SHARD-PLATFORM SF68, G250): the page's own shape, which the build derives from sp-x2's
// `wildshard-admin/1` data bundle (scripts/admin-data.mjs, committed reports only) in tools/view.ts. The page reads only
// this file; it never talks to the game.

export const BUNDLE_SCHEMA = 'wildshard-admin-view/1';

export interface Bundle {
  schema: typeof BUNDLE_SCHEMA;
  /** The commit the reports were collected from (admin-data's revision, short). */
  build: string;
  builtAt: string;
  memory: MemoryData;
  loading: LoadingData;
  playtests: Playtest[];
  plans: PlanData;
}

// ── memory ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type Side = 'gpu' | 'ram';
/** measured = same run and pose as the total; estimated = taken from another process or pin; unattributed = no owner. */
export type Confidence = 'measured' | 'estimated' | 'unattributed';

export interface MemBlock {
  side: Side;
  owner: string;
  asset: string;
  conf: Confidence;
  bytes: number;
}

export interface MemSituation {
  id: string;
  title: string;
  subtitle: string;
  /** The game build the reading came from (`/version.json` build or the pin). */
  build: string;
  settings: string;
  /** WebContent footprint + labelled GL; null when the pose was never measured. */
  totalBytes: number | null;
  ramBytes: number | null;
  gpuBytes: number | null;
  blocks: MemBlock[];
  /** Why parts (or all) of this situation are missing, verbatim from the report. */
  missing: string[];
  /** The report's own rendered page, a path under media/. */
  image: string | null;
}

export interface MemReport {
  id: string;
  title: string;
  date: string;
  /** The report file's schema / kind, e.g. memory-report/1. */
  kind: string;
  /** Repo path of the report. */
  source: string;
  device: string;
  note: string;
  situations: MemSituation[];
}

export interface MemoryData {
  capBytes: number;
  reports: MemReport[];
}

// ── loading ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface LoadingPhase {
  name: string;
  ms: number;
  owner: string;
}

export interface LoadingRun {
  shard: string;
  mode: 'cold' | 'warm';
  build: string;
  device: string;
  playableMs: number;
  phases: LoadingPhase[];
  longTasks: { ms: number; owner: string; label: string }[];
}

export interface LoadingData {
  /** Empty until SF67's benchmark lands; the page shows an empty state. */
  runs: LoadingRun[];
  note: string;
}

// ── playtests ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface PlaytestItem {
  rank: number;
  title: string;
  /** Body lines (markdown bullets flattened to plain lines; `code` kept). */
  lines: string[];
  /** File names of the round's media this finding names (admin-data's exact / clip-NN matches). */
  media: string[];
}

export interface PlaytestMedia {
  kind: 'image' | 'video';
  name: string;
  src: string;
  /** A still for a video tile (made at build when ffmpeg is present), else null. */
  poster: string | null;
}

export interface Playtest {
  id: string;
  title: string;
  date: string;
  builds: string[];
  source: string;
  top: PlaytestItem[];
  works: string[];
  media: PlaytestMedia[];
}

// ── plans ────────────────────────────────────────────────────────────────────────────────────────────────────────

export type RowStatus = 'done' | 'needs pick' | 'in flight' | 'open' | 'dropped';

export interface PlanRow {
  id: string;
  lane: string;
  what: string;
  doneWhen: string;
  status: RowStatus;
  size: string;
}

export interface Decision {
  id: string;
  topic: string;
  answer: string;
}

export interface Effort {
  label: string;
  pct: number;
}

export interface WaitingItem {
  id: string;
  what: string;
  source: string;
}

export interface Milestone {
  title: string;
  /** Plain lines of the plan's "Done when" section. */
  lines: string[];
}

export interface PlanData {
  slug: string;
  title: string;
  state: string;
  source: string;
  /** State's own reported percentages, verbatim (never inferred). */
  effort: Effort[];
  milestones: Milestone[];
  rows: PlanRow[];
  decisions: Decision[];
  waiting: WaitingItem[];
}
