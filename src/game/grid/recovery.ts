import * as v from 'valibot';
import type { SaveKeyDef, SaveStore } from '@wildshard/engine/saves/store';
import type { GridAssembly } from './assembly';
import { onRoad, type RoadPoint } from './roadRecovery';

const finite = v.pipe(v.number(), v.finite());
const identity = v.pipe(v.string(), v.regex(/^_?[a-z0-9]+(?:-[a-z0-9]+)*$/u));
const schema = v.nullable(v.strictObject({ instance: identity, slug: identity,
  catalogue: v.pipe(v.string(), v.maxLength(4096)), at: finite,
  reason: v.picklist(['gpu', 'background', 'new-game']),
  road: v.strictObject({ x: finite, z: finite, yaw: finite }),
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
export type GridRecoveryRead = { readonly kind: 'none' | 'fallback' } | { readonly kind: 'resume'; readonly record: NonNullable<GridRecoveryRecord> };

/** Recovery-only metadata is mirrored for a replaced WebContent process and consumed before any boot allocation. */
export function gridRecovery(store: SaveStore, now: () => number = Date.now): {
  write: (assembly: GridAssembly, home: { instance: string; slug: string }, road: RoadPoint, reason: GridRecoveryReason) => boolean;
  consume: (assembly: GridAssembly) => GridRecoveryRead;
} {
  const session = store.define(definition), device = store.define(backup);
  const valid = (record: GridRecoveryRecord, assembly: GridAssembly): record is NonNullable<GridRecoveryRecord> => record !== null
    && now() - record.at >= 0 && now() - record.at <= MAX_AGE_MS
    && record.catalogue === recoveryCatalogue(assembly)
    && assembly.cells.some(cell => cell.instance === record.instance && [record.slug].includes(cell.slug))
    && onRoad(assembly, record.road.x, record.road.z);
  return {
    write: (assembly, home, road, reason) => {
      const record = v.parse(schema, { instance: home.instance, slug: home.slug, road: { x: road.x, z: road.z, yaw: road.yaw }, reason, catalogue: recoveryCatalogue(assembly), at: now() });
      if (!valid(record, assembly)) throw new Error('Recovery requires an admitted home and safe road location');
      const inSession = session.write(record), onDevice = device.write(record);
      return inSession || onDevice;
    },
    consume: (assembly) => {
      const statuses = [session.status?.(), device.status?.()];
      const records = [session.peek(), device.peek()];
      // Unknown future records remain untouched and cannot initiate a boot in an older client.
      if (statuses.includes('future')) return { kind: 'none' };
      if (records.every(value => value === null) && !statuses.includes('invalid')) return { kind: 'none' };
      // Consume every present copy durably before allocation: refusal leaves the ordinary title route.
      const inSession = session.write(null), onDevice = device.write(null);
      if ((statuses[0] !== 'absent' && !inSession) || (statuses[1] !== 'absent' && !onDevice)) return { kind: 'none' };
      const record = records.find(value => valid(value, assembly));
      if (record !== undefined) return { kind: 'resume', record };
      return { kind: records.some(value => value !== null) || statuses.some(status => status === 'invalid') ? 'fallback' : 'none' };
    },
  };
}
