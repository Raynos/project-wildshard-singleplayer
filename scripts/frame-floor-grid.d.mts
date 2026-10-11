export interface FloorGridLive { current: string | null; worldFeet: { x: number; y: number; z: number }; crossings: number;
  transitions: { from: string | null; to: string | null }[]; residents: string[]; gameplayReady: boolean; pending?: string[] }
export interface FloorGridState { home: string; inside: string | null;
  cells: { instance: string; slug: string; cell: readonly [number, number] }[];
  borrowedHome?: { instance: string; level: string; bytes: number };
  claims?: readonly { id: string; owner: string; category: string; bytes?: number }[];
  /** Scalar preparation timings including painted waits; absent on older builds. */
  entryPreparation?: { root: string; completed: boolean; stages: { phase: string; elapsedMs: number; units: number }[] } | null;
  live: { live: FloorGridLive; crossing: { phase: string; issue: string | null } } }
export interface FloorGridPlan { name: string; from: string | null; to: string | null; movement?: 'road-hover'; hoverMaxSpeed?: number; borrowedHome?: string; start?: { x: number; z: number };
  waypoints: { x: number; z: number }[]; requiredResidents: string[]; retiredResidents?: string[];
  /** the leg ends as soon as `to` is entered and ready, whatever waypoints remain (an entry that carries the player on) */
  finishOnArrival?: boolean;
  /** Record destination readiness and visibility while following the normal road approach. */
  observePreparation?: boolean;
  /** Use this entered probe's authored islet row, normal USE, ride and bridge walking. */
  authoredLift?: { probe: string; edge: 'north' | 'east' | 'south' | 'west' } }
export interface FloorGridWitness {
  /** Actual input and mover observations; a socket-only arrival never satisfies these. */
  lift?: { edge: string; isle: string; usePresses: number; docked: boolean; onIsland: boolean; rideSamples: number; maximumDeckGap: number };
  plan: FloorGridPlan; before: FloorGridState; after: FloorGridState;
  /** Every drawn frame: real motor blockage at an unready destination edge, and early visibility. */
  arrival?: { blockedFrames: number; blockedMs: number; visibleBeforeReadyFrames: number };
  trace: { seconds: number; x: number; y: number; z: number; current: string | null; gameplayReady: boolean; hover?: boolean; preparation?: { pending: string[]; resident: boolean; visible: boolean | null; hook: string | null } }[]; elapsedSeconds: number }
export interface FloorGridProgress { documentOrigin: number; sampledAt: number; seconds: number;
  stop: { leg: string; phase: string; waypoint: number | null; target: { x: number; z: number } | null };
  current: string | null; inside: string | null; feet: { x: number; y: number; z: number }; gameplayReady: boolean;
  /** Existing scalar admission telemetry, copied at the ledger's one-second cadence; old records may omit it. */
  admission?: { residents: string[]; pending: string[]; issues: Record<string, string>;
    crossing: { phase: string; issue: string | null } | null; screens: unknown };
  memory: { modelledMB: number | null; accountedBytes: number | null; glMB: number | null; glReconciled: boolean | null; claims: unknown; cost: unknown } }
export interface FloorGridFailure { kind: string; stop: FloorGridProgress['stop']; lastSample: FloorGridProgress; recoveryReason: string; nextDocumentOrigin: number }
export function installFloorGridProgress(): void;
export function gridFloorRuntimeFailure(last: FloorGridProgress | null, diagnostic: { documentOrigin: number; lastEnd?: { reason: string; at: number }; lastUnload?: { reason: string; t: number } } | null): FloorGridFailure | null;
/** 'cell' enters the cell whose instance or slug is `options.cell` from the road at its home-side edge (op-frame22). */
export function gridFloorPlans(state: Pick<FloorGridState, 'home' | 'cells'>, scenario: 'baseline' | 'template' | 'runtime-travel' | 'sun-entry' | 'cell' | 'all' | 'milestone', options?: { cell?: string; roadApproach?: boolean; entrySocket?: boolean; risingIslet?: 'north' | 'east' | 'south' | 'west' }): FloorGridPlan[];
export interface FloorGridDocumentIdentity { readonly timeOrigin: number; readonly token: string }
export function gridFloorDocumentIdentity(): FloorGridDocumentIdentity;
export function driveFloorGrid(plan: FloorGridPlan, documentOrigin: number | FloorGridDocumentIdentity): Promise<FloorGridWitness>;
export function stageFloorGrid(plan: FloorGridPlan, documentOrigin: number | FloorGridDocumentIdentity, drive?: typeof driveFloorGrid): Promise<FloorGridState>;
export function runFloorGridRoute(page: { evaluate: (expression: string) => Promise<unknown> }, plan: FloorGridPlan, documentOrigin: number | FloorGridDocumentIdentity): Promise<FloorGridWitness>;
export function gridFloorWitnessFailures(result: FloorGridWitness): string[];

/** Select an explicit diagnostic cohort while preserving route order and all witnesses. */
export function selectFloorGridPlans(plans: FloorGridPlan[], names?: readonly string[]): FloorGridPlan[];
