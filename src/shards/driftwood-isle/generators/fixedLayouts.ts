import { parseDriftwoodFixedLayouts } from './namedSchemas';
import type { WreckSpec, HoldBounds } from './wreckContract';

export interface FixedBox { x: number; z: number; hw: number; hd: number; rot: number; yTop: number; yBottom: number }
export interface FixedAnchor { x: number; y: number; z: number; yaw: number }
export interface FixedSpot { x: number; y: number; z: number; yaw?: number; variant?: string; params?: unknown }
export interface FixedCopies { placements: FixedSpot[]; boxes: number[] }
export interface FixedParamCopies<Params> { placements: (FixedSpot & { params: Params })[]; boxes: number[] }
export interface FixedSiteLayout extends Record<string, unknown> {
  site: unknown; origin: { x: number; y: number; z: number }; colliders: FixedBox[];
  descs: unknown[]; anchors: Record<string, FixedAnchor>; floors: unknown[];
}
export interface FixedShrineLayout extends FixedSiteLayout { baseY: number; terrace: number }
export interface FixedRockParams { r: number; squash: number; moss: number }
export interface FixedLogParams { len: number; r0: number; r1: number; tone: number }
export interface FixedWreckLayout extends Record<string, unknown> {
  spec: WreckSpec; floorY: number; colliders: FixedBox[]; descs: unknown[]; anchors: Record<string, FixedAnchor>;
  holdBounds: HoldBounds; floors: unknown[]; shipBox: number[];
  catalogue: { barrels: FixedCopies; crates: FixedParamCopies<{ size: number; broken: boolean }>;
    coils: FixedParamCopies<{ r: number }>; rocks: FixedParamCopies<FixedRockParams>; logs: FixedParamCopies<FixedLogParams> };
}
export interface FixedCoveLayout extends Record<string, unknown> {
  spec: unknown; floors: unknown[];
  native: { colliders: FixedBox[]; anchors: Record<string, FixedAnchor>; descs: unknown[]; cuts: unknown[] };
  catalogue: FixedParamCopies<FixedRockParams>;
}
/** The complete native site metadata retains extra authored fields; consumed fields cross their defining shape checks. */
export interface DriftwoodFixedLayouts {
  hut: FixedSiteLayout; lookout: FixedSiteLayout; shrine: { world: FixedShrineLayout; specimen: FixedShrineLayout };
  wreck: FixedWreckLayout; cove: FixedCoveLayout; logs: FixedParamCopies<FixedLogParams>;
}
const files: Readonly<Record<keyof DriftwoodFixedLayouts, string>> = {
  hut: 'data/hutBake.json', lookout: 'data/lookoutBake.json', shrine: 'data/shrineBake.json',
  wreck: 'data/wreckBake.json', cove: 'data/coveBake.json', logs: 'data/duneLogsBake.json',
};

/** Decode only the original producer's owned metadata; no filesystem or old source path is a fallback. */
export function driftwoodFixedLayouts(bank: ReadonlyMap<string, Uint8Array>): DriftwoodFixedLayouts {
  const rows: Record<string, unknown> = {};
  for (const [name, file] of Object.entries(files)) {
    const bytes = bank.get(file);
    if (bytes === undefined || bytes.byteLength === 0) throw new Error(`Missing owned fixed layout: ${name}`);
    const input: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    rows[name] = input;
  }
  return parseDriftwoodFixedLayouts(rows);
}
