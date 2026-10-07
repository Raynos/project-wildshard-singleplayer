import * as v from 'valibot';
import type { SaveKeyDef, SaveStore } from '@wildshard/engine/saves/store';
import type { GridAssembly } from './assembly';
import { onRoad, type RoadPoint } from './roadRecovery';
import { instanceSave } from '../instanceSaves';

const finite = v.pipe(v.number(), v.finite());
const identity = v.pipe(v.string(), v.regex(/^_?[a-z0-9]+(?:-[a-z0-9]+)*$/u));
const roadSchema = v.strictObject({ x: finite, z: finite, yaw: finite });
const locationSchema = v.variant('kind', [
  v.strictObject({ kind: v.literal('road') }),
  v.strictObject({ kind: v.literal('cell'), x: finite, y: finite, z: finite, yaw: finite }),
]);
const savedSchema = v.strictObject({ instance: identity, slug: identity,
  catalogue: v.pipe(v.string(), v.maxLength(4096)), at: finite, road: roadSchema, location: locationSchema });
/** A durable location references the instance's real continuation; it carries no progress or native bytes. */
export type GridSavedLocation = v.InferOutput<typeof locationSchema>;
const lastDefinition = { key: 'grid.last-played', scope: 'device' as const, version: 1, schema: v.nullable(savedSchema), initial: () => null };
const localDefinition = { ...lastDefinition, key: 'platform.grid-position', scope: 'shard' as const };
const guardDefinition = { key: 'grid.recovery.guard', scope: 'device' as const, version: 1,
  schema: v.nullable(v.strictObject({ at: finite })), initial: () => null };
const schema = v.nullable(v.strictObject({ instance: identity, slug: identity,
  catalogue: v.pipe(v.string(), v.maxLength(4096)), at: finite,
  reason: v.picklist(['gpu', 'background', 'new-game']),
  road: roadSchema,
  saved: v.optional(savedSchema),
}));
/** A recovery location only: progress remains in the existing instance saves, never copied into this record. */
export type GridRecoveryRecord = v.InferOutput<typeof schema>;
/** GPU loss, long absence and New game may resume; a crossing never writes or consumes this protocol. */
export type GridRecoveryReason = NonNullable<GridRecoveryRecord>['reason'];
const definition: SaveKeyDef<GridRecoveryRecord> = { key: 'grid.recovery.once', scope: 'session', version: 1, schema, initial: () => null };
const backup: SaveKeyDef<GridRecoveryRecord> = { ...definition, scope: 'device' };
const MAX_AGE_MS = 60_000;

/** Stable identities plus actual placement seal the selected catalogue without tying saves to cell coordinates. */
export function recoveryCatalogue(assembly: GridAssembly): string {
  return JSON.stringify({ pitch: assembly.pitch, cells: assembly.cells.map(cell => [cell.instance, cell.slug, ...cell.cell]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))) });
}
/** Renderer-free consumption result; malformed, expired or unsafe recovery chooses a fresh safe road start. */
export type GridRecoveryRead = { readonly kind: 'none' | 'fallback' | 'refused' | 'loop' } | { readonly kind: 'resume'; readonly record: NonNullable<GridRecoveryRecord> };

/** Recovery-only metadata is mirrored for a replaced WebContent process and consumed before any boot allocation. */
export function gridRecovery(store: SaveStore, now: () => number = Date.now): {
  write: (assembly: GridAssembly, home: { instance: string; slug: string }, road: RoadPoint, reason: GridRecoveryReason) => boolean;
  /** Call only after every continuation/ledger writer succeeds. The instance slot fences New-game generations. */
  save: (assembly: GridAssembly, home: { instance: string; slug: string }, road: RoadPoint, location: GridSavedLocation) => boolean;
  clearLoop: () => boolean;
  consume: (assembly: GridAssembly, unexpected?: boolean) => GridRecoveryRead;
} {
  const session = store.define(definition), device = store.define(backup);
  const last = store.define(lastDefinition), guard = store.define(guardDefinition);
  const valid = (record: GridRecoveryRecord, assembly: GridAssembly): record is NonNullable<GridRecoveryRecord> => record !== null
    && now() - record.at >= 0 && now() - record.at <= MAX_AGE_MS
    && record.catalogue === recoveryCatalogue(assembly)
    && assembly.cells.some(cell => cell.instance === record.instance && [record.slug].includes(cell.slug))
    && onRoad(assembly, record.road.x, record.road.z);
  const validSaved = (saved: v.InferOutput<typeof savedSchema>, assembly: GridAssembly): boolean => {
    const cell = assembly.cells.find(row => row.instance === saved.instance && [saved.slug].includes(row.slug));
    if (cell === undefined || saved.catalogue !== recoveryCatalogue(assembly) || !onRoad(assembly, saved.road.x, saved.road.z)) return false;
    if (saved.location.kind === 'cell') {
      const world = assembly.world(saved.location, cell);
      if (assembly.at(world.x, world.z)?.instance !== cell.instance) return false;
    }
    const local = instanceSave(store, localDefinition, { id: saved.instance, shard: saved.slug });
    return JSON.stringify(local.peek()) === JSON.stringify(saved);
  };
  return {
    save: (assembly, home, road, location) => {
      const saved = v.parse(savedSchema, { instance: home.instance, slug: home.slug, road: { ...road }, location, catalogue: recoveryCatalogue(assembly), at: now() });
      const cell = assembly.cells.find(row => row.instance === home.instance && [home.slug].includes(row.slug));
      if (cell === undefined || !onRoad(assembly, road.x, road.z)) throw new Error('Durable location requires an admitted instance and safe road');
      if (location.kind === 'cell') {
        const world = assembly.world(location, cell);
        if (assembly.at(world.x, world.z)?.instance !== home.instance) throw new Error('Durable location is outside its instance');
      }
      const local = instanceSave(store, localDefinition, { id: home.instance, shard: home.slug });
      return local.write(saved) && last.write(saved);
    },
    clearLoop: () => guard.write(null),
    write: (assembly, home, road, reason) => {
      const saved = last.peek();
      const selected = saved !== null && validSaved(saved, assembly) ? saved : undefined;
      const record = v.parse(schema, { instance: selected?.instance ?? home.instance, slug: selected?.slug ?? home.slug,
        road: selected?.road ?? { ...road }, ...(selected === undefined ? {} : { saved: selected }), reason, catalogue: recoveryCatalogue(assembly), at: now() });
      if (!valid(record, assembly)) throw new Error('Recovery requires an admitted home and safe road location');
      const inSession = session.write(record), onDevice = device.write(record);
      // A blocked sessionStorage may retain a memory-only copy; never require that phantom copy on the next read.
      if (!inSession) session.write(null);
      return inSession || onDevice;
    },
    consume: (assembly, unexpected = false) => {
      const statuses = [session.status?.(), device.status?.()];
      const records = [session.peek(), device.peek()];
      // Unknown future records remain untouched and cannot initiate a boot in an older client.
      if (statuses.includes('future')) return { kind: 'refused' };
      const resumed = guard.peek();
      const looping = resumed !== null && now() - resumed.at >= 0 && now() - resumed.at < 600_000;
      if (records.every(value => value === null) && !statuses.includes('invalid')) return { kind: unexpected && looping ? 'loop' : 'none' };
      // Consume every present copy durably before allocation: refusal leaves the ordinary title route.
      const inSession = session.write(null), onDevice = device.write(null);
      if (((records[0] !== null || statuses[0] === 'invalid') && !inSession) || ((records[1] !== null || statuses[1] === 'invalid') && !onDevice)) return { kind: 'refused' };
      if (looping) return { kind: 'loop' };
      const record = records.find((value): value is NonNullable<GridRecoveryRecord> => valid(value, assembly) && (value.saved === undefined || validSaved(value.saved, assembly)));
      if (record !== undefined) return guard.write({ at: now() }) ? { kind: 'resume', record } : { kind: 'refused' };
      return { kind: records.some(value => value !== null) || statuses.some(status => status === 'invalid') ? 'fallback' : 'none' };
    },
  };
}
