import type { FloorGridPlan, FloorGridWitness } from '../frame-floor-grid.mjs';

/** Preserve a static-preview error transport's original payload for CI diagnosis, including nonfatal lifecycle diagnostics. */
export function bootErrorReport(url: string, method: string, body: string | null): unknown;
/** Only nonfatal boot-after-hide/nav-navigate diagnostics following observed grid navigation are acknowledged. */
export function bootLifecycleDiagnostic(report: unknown, observedGridNavigation: boolean): boolean;
/** Read the installed catalogue in the actual built title document. */
export function bootCatalogue(): { slug: string; status: string; legacy: boolean }[];
/** Public-policy admission observes a hydrated title, an unwaived public mode and a locked experimental card. */
export function publicPolicyAdmission(observation: { shard:string; appState:string; entered?:boolean; playerValid:boolean; fatal:string[]; frame:number; renderFrame:number }): { admitted:boolean; developer:boolean; locked:boolean; frame:number; renderFrame:number };
/** Required public and Developer cases; Nine also enters with Developer off. Hidden and frozen copies are excluded. */
export function bootCases(catalogue: readonly { slug: string; status: string; legacy: boolean }[], group?: 'all' | 'public' | 'developer'): readonly (readonly ['standalone' | 'grid' | 'public-policy', string, boolean])[];

/** Plan the required real Signal road crossing from the running grid catalogue. */
export function bootSignalRoadPlan(state: unknown): FloorGridPlan;
/** Refuse missing Signal transitions, live residency or actual road frames. */
export function verifyBootSignalRoad(witness: FloorGridWitness): void;

/** Give the grid a fresh browser after prior contexts are closed, preserving every case law. */
export function bootCaseBrowser<T>(pool: {browser:(slot:number)=>Promise<T>;release:(slot:number)=>Promise<void>}, mode:'standalone'|'grid'|'public-policy'):Promise<T>;
