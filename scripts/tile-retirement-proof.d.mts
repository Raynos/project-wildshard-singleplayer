import type { FloorGridDocumentIdentity, FloorGridPlan, FloorGridState } from './frame-floor-grid.mjs';
import type { MemorySnapshot } from '../src/engine/core/memoryAttribution';

export interface RetirementBoundary {
  readonly document: string;
  readonly current: string | null;
  readonly ready: boolean;
  readonly controls: boolean;
  readonly pending: number;
  readonly retiring: number;
  readonly tileGhosts: number;
  readonly regionGhosts: number;
  readonly inFlight: number;
  readonly queued: number;
  readonly x: number;
  readonly z: number;
  readonly process: { renderer: number; gpu: number; browser: number };
}
export function tileRetirementRoute(state: Pick<FloorGridState, 'home' | 'cells' | 'pitch'>): {
  reference: { x: number; z: number }; plans: FloorGridPlan[];
};
export function tileRetirementPortalPlans(state: Pick<FloorGridState, 'home' | 'cells' | 'pitch'>,
  entryways: ReadonlyMap<string, unknown>): FloorGridPlan[];
export function tileRetirementTracker(): {
  observe: (keys: readonly string[]) => void;
  result: () => { cycles: number; byKey: Record<string, number> };
};
export function gradeTileRetirement(proof: {
  baseline: RetirementBoundary; returns: readonly RetirementBoundary[]; cycles: number; errors: readonly string[];
}): { pass: boolean; failures: string[]; baselineBytes: number; deltaBytes: number[] };
export function readRetirementBoundary(identity: FloorGridDocumentIdentity, documentIdentity: () => FloorGridDocumentIdentity):
  Omit<RetirementBoundary, 'process'> & { keys: string[]; ghostOwners: {
    tiles: readonly { instance: string; ageS: number }[];
    regions: readonly { instance: string; ageS: number }[];
  } };
export function seedTileRetirementHome(reference: { x: number; z: number }, identity: FloorGridDocumentIdentity,
  documentIdentity: () => FloorGridDocumentIdentity): Promise<void>;
export function readRetirementResources(): {
  renderer: { geometries: number; textures: number; programs: number | null };
  programCache: readonly { cacheKey: string; name: string; usedTimes: number }[];
  ledger: MemorySnapshot;
};

/** Diagnostic-clock build history; a finite ring may have truncated older rows. */
export function readRetirementProgramBuilds(): {
  readonly at: number; readonly builds: number; readonly captured: number;
  readonly rows: readonly { readonly at: number; readonly material: string; readonly object: string;
    readonly how: string; readonly keyChars: number; readonly numericReferences: readonly string[] }[];
} | null;
