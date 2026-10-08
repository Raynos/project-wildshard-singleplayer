export interface FloorGridLive { current: string | null; worldFeet: { x: number; y: number; z: number }; crossings: number;
  transitions: { from: string | null; to: string | null }[]; residents: string[]; gameplayReady: boolean }
export interface FloorGridState { home: string; inside: string | null;
  cells: { instance: string; slug: string; cell: readonly [number, number] }[];
  claims?: readonly { id: string; owner: string; category: string }[];
  live: { live: FloorGridLive; crossing: { phase: string; issue: string | null } } }
export interface FloorGridPlan { name: string; from: string; to: string; start?: { x: number; z: number };
  waypoints: { x: number; z: number }[]; requiredResidents: string[]; retiredResidents?: string[] }
export interface FloorGridWitness { plan: FloorGridPlan; before: FloorGridState; after: FloorGridState;
  trace: { seconds: number; x: number; y: number; z: number; current: string | null; gameplayReady: boolean }[]; elapsedSeconds: number }
export function gridFloorPlans(state: Pick<FloorGridState, 'home' | 'cells'>, scenario: 'baseline' | 'template' | 'runtime-travel' | 'all'): FloorGridPlan[];
export function driveFloorGrid(plan: FloorGridPlan): Promise<FloorGridWitness>;
export function stageFloorGrid(plan: FloorGridPlan): Promise<FloorGridState>;
export function gridFloorWitnessFailures(result: FloorGridWitness): string[];
