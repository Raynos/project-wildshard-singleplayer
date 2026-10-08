export interface FloorGridLive { current: string | null; worldFeet: { x: number; y: number; z: number }; crossings: number;
  transitions: { from: string | null; to: string | null }[]; residents: string[]; gameplayReady: boolean }
export interface FloorGridState { home: string; inside: string | null;
  cells: { instance: string; slug: string; cell: readonly [number, number] }[];
  claims?: readonly { id: string; owner: string; category: string }[];
  live: { live: FloorGridLive; crossing: { phase: string; issue: string | null } } }
export interface FloorGridPlan { name: string; from: string | null; to: string | null; movement?: 'road-hover'; hoverMaxSpeed?: number; start?: { x: number; z: number };
  waypoints: { x: number; z: number }[]; requiredResidents: string[]; retiredResidents?: string[] }
export interface FloorGridWitness { plan: FloorGridPlan; before: FloorGridState; after: FloorGridState;
  trace: { seconds: number; x: number; y: number; z: number; current: string | null; gameplayReady: boolean; hover?: boolean }[]; elapsedSeconds: number }
export interface FloorGridProgress { documentOrigin: number; sampledAt: number; seconds: number;
  stop: { leg: string; phase: string; waypoint: number | null; target: { x: number; z: number } | null };
  current: string | null; inside: string | null; feet: { x: number; y: number; z: number }; gameplayReady: boolean;
  memory: { modelledMB: number | null; accountedBytes: number | null; glMB: number | null; glReconciled: boolean | null; claims: unknown; cost: unknown } }
export interface FloorGridFailure { kind: string; stop: FloorGridProgress['stop']; lastSample: FloorGridProgress; recoveryReason: string; nextDocumentOrigin: number }
export function installFloorGridProgress(): void;
export function gridFloorRuntimeFailure(last: FloorGridProgress | null, diagnostic: { documentOrigin: number; lastEnd?: { reason: string; at: number }; lastUnload?: { reason: string; t: number } } | null): FloorGridFailure | null;
export function gridFloorPlans(state: Pick<FloorGridState, 'home' | 'cells'>, scenario: 'baseline' | 'template' | 'runtime-travel' | 'all'): FloorGridPlan[];
export interface FloorGridDocumentIdentity { readonly timeOrigin: number; readonly token: string }
export function gridFloorDocumentIdentity(): FloorGridDocumentIdentity;
export function driveFloorGrid(plan: FloorGridPlan, documentOrigin: number | FloorGridDocumentIdentity): Promise<FloorGridWitness>;
export function stageFloorGrid(plan: FloorGridPlan, documentOrigin: number | FloorGridDocumentIdentity): Promise<FloorGridState>;
export function runFloorGridRoute(page: { evaluate: (expression: string) => Promise<unknown> }, plan: FloorGridPlan, documentOrigin: number | FloorGridDocumentIdentity): Promise<FloorGridWitness>;
export function gridFloorWitnessFailures(result: FloorGridWitness): string[];
