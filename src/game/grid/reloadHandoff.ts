import * as v from 'valibot';
import type { SaveStore, SaveSlot } from '@wildshard/engine/saves/store';
import type { GridAssembly } from './assembly';
import { onRoad, type RoadGrid } from './roadRecovery';
import { RING_ISLAND } from './roadLayout';

const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER));
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const roadPoint = v.strictObject({ x: finite, z: finite, yaw: finite });
/** Planned grid transfer only: local inventories and rewards stay in their stable instance saves. */
export const GridReloadHandoffSchema = v.strictObject({
  v: v.literal(1), mode: v.literal('grid'),
  layout: v.strictObject({ developer: v.boolean(), devserver: v.boolean(), nineDragon: v.boolean() }),
  instance: id, revision: v.pipe(natural, v.minValue(1)), cell: v.tuple([finite, finite]),
  roadPose: v.strictObject({ x: finite, y: finite, z: finite }), heading: finite,
  mount: v.nullable(v.literal('hoverboard')),
  loadout: v.strictObject({ selected: v.null(), tools: v.pipe(v.array(v.literal('tool.hoverboard')), v.maxLength(1)) }),
  clock: v.strictObject({ version: v.literal(1), elapsed: v.pipe(finite, v.minValue(0)), wall: v.pipe(finite, v.minValue(0)), frames: natural,
    captureFps: v.nullable(v.pipe(finite, v.minValue(Number.MIN_VALUE))), paused: v.boolean(), scale: v.pipe(finite, v.minValue(0)) }),
  recovery: v.strictObject({ lastSafeRoadPoint: roadPoint, state: v.literal('on-road') }), at: natural,
});
/** Validated wire state; shard mounts cannot be represented in the transfer. */
export type GridReloadHandoff = v.InferOutput<typeof GridReloadHandoffSchema>;
const definition = { key: 'grid.reload.once', scope: 'device' as const, version: 1,
  schema: v.nullable(GridReloadHandoffSchema), initial: (): GridReloadHandoff | null => null };
/** Device storage survives sessionStorage loss; the shared definition also permits repeated installer calls. */
export function gridReloadSlot(store: SaveStore): SaveSlot<GridReloadHandoff | null> { return store.define(definition); }

/** Junction islands are ground, but never a safe asphalt transfer point. */
export function gridReloadDeck(grid: RoadGrid, x: number, z: number): boolean {
  if (!onRoad(grid, x, z)) return false;
  const offset = (value: number): number => value - (Math.round((value - grid.pitch / 2) / grid.pitch) * grid.pitch + grid.pitch / 2);
  return Math.hypot(offset(x), offset(z)) > RING_ISLAND + 0.5;
}

/** Geometry/revision admission is separate from asynchronous critical-bundle readiness at boot. */
export function validGridReload(value: GridReloadHandoff, assembly: GridAssembly, revision: (instance: string) => number | undefined, now: number): boolean {
  const age = now - value.at, cell = assembly.cells.find((entry) => entry.instance === value.instance);
  return age >= 0 && age <= 60_000 && cell !== undefined && revision(value.instance) === value.revision
    && cell.cell[0] === value.cell[0] && cell.cell[1] === value.cell[1]
    && Math.abs(value.roadPose.y) <= 0.6 && gridReloadDeck(assembly, value.roadPose.x, value.roadPose.z)
    && gridReloadDeck(assembly, value.recovery.lastSafeRoadPoint.x, value.recovery.lastSafeRoadPoint.z);
}
/** Consume before any world mutation, regardless of the Debug or public-grid gate. Failed deletion never restores. */
export function consumeGridReload(slot: SaveSlot<GridReloadHandoff | null>, valid: (value: GridReloadHandoff) => boolean): GridReloadHandoff | null {
  const value = slot.read();
  if (value === null) return null;
  if (!slot.write(null)) return null;
  return valid(value) ? value : null;
}

/** The page supplies real durable checkpoint, motion hold, fade and fresh-document navigation ports. */
export interface GridReloadExitPorts {
  /** The selected boot admission mode must fit before capturing, checkpointing or writing a transfer. */
  admit?: () => boolean;
  checkpoint: () => boolean;
  slot: SaveSlot<GridReloadHandoff | null>;
  hold: (held: boolean) => void;
  fade: () => Promise<void>;
  navigate: () => void;
}
/** Saving failures keep the traveller at the safe deck point. Retry writes the same transfer without moving possessions. */
export class GridReloadExit {
  private phase: 'idle' | 'saving' | 'failed' | 'navigating' = 'idle';
  private cancelled = false;
  private readonly ports: GridReloadExitPorts;
  constructor(ports: GridReloadExitPorts) { this.ports = ports; }
  state(): 'idle' | 'saving' | 'failed' | 'navigating' { return this.phase; }
  private isCancelled(): boolean { return this.cancelled; }
  /** Caller validates road contact and captures state before invoking this transaction. */
  async start(value: GridReloadHandoff | (() => Promise<GridReloadHandoff>)): Promise<boolean> {
    if (this.cancelled || this.phase === 'saving' || this.phase === 'navigating') return false;
    this.phase = 'saving'; this.ports.hold(true);
    try {
      if (this.ports.admit?.() === false) { this.phase = 'failed'; return false; }
      const admitted = typeof value === 'function' ? await value() : value;
      if (this.isCancelled()) return false;
      const parsed = v.parse(GridReloadHandoffSchema, admitted);
      if (!this.ports.checkpoint() || !this.ports.slot.write(parsed)) { this.phase = 'failed'; return false; }
      await this.ports.fade();
    }
    catch { this.phase = 'failed'; return false; }
    if (this.isCancelled()) return false;
    this.phase = 'navigating'; this.ports.navigate(); return true;
  }
  /** A U-turn can resume movement only once the pending one-shot has been durably invalidated. */
  cancel(): boolean {
    if (this.phase === 'navigating' || !this.ports.slot.write(null)) return false;
    this.cancelled = true; this.phase = 'idle'; this.ports.hold(false); return true;
  }
}
