import type { FloorGridPlan, FloorGridState } from './frame-floor-grid.mjs';
export interface PublicGridWitness {
  developer: boolean; savedDeveloper: unknown; state: FloorGridState;
  refusals: Record<string,string>; homeResidency: unknown; runtimeLevel: string;
}
export function publicGridIntentCode(home: {instance:string;slug:string}): string;
export function publicGridPlans(state: Pick<FloorGridState,'home'|'cells'>): FloorGridPlan[];
export function readPublicGridWitness(): PublicGridWitness;
export function publicGridWitnessFailures(witness: PublicGridWitness, requireRefusals: boolean): string[];
