import type { FloorGridDocumentIdentity, FloorGridPlan, FloorGridState, FloorGridWitness } from './frame-floor-grid.mjs';

export function gridApproachPlans(state: Pick<FloorGridState, 'home' | 'cells'>): FloorGridPlan[];
export function runGridApproachRegression(page: { evaluate: (expression: string) => Promise<unknown> }, state: FloorGridState,
  identity: FloorGridDocumentIdentity): Promise<FloorGridWitness[]>;
