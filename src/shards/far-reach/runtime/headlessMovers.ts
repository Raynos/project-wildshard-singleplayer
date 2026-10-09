import * as v from 'valibot';
import type { SimHost } from '@wildshard/engine/sim';
import { ScriptHost } from '@wildshard/engine/script/host';
import { ScriptWorld } from '@wildshard/engine/script/effects';
import { scriptPhysicsQueries } from '@wildshard/engine/script/queries';
import { MOVER_FIELD_RANGES, moverScriptEntities, type MoverData } from '@wildshard/game/shardfile/movers';
import { MoverRuntime, moverQueries } from '@wildshard/game/shardfile/moverRuntime';
import { SKY_MOVERS, WINCH_BRIDGE } from './moverRows';

/**
 * The movers the headless runtime runs (SF72): every Sky row but the three static rope bridges, which never move and
 * collide as the baked `far.rope.*` pieces (the browser adopts them the same way). The islets, their road gates and the
 * winch bridge each get their own platform `KinematicMover` body; the raised winch bridge replaces the browser's baked
 * `far.bridge.crown` deck (inactive in the bake, so it stays out of the headless world).
 */
export const HEADLESS_MOVERS: MoverData = SKY_MOVERS.filter((row) => !row.id.startsWith('far.rope.'));

/** Hash-check every admitted module the headless movers name, once, before any host is built (`prepare` is async). */
export async function verifiedMoverModules(assets: ReadonlyMap<string, Uint8Array>, rows: MoverData = HEADLESS_MOVERS): Promise<ReadonlyMap<string, Uint8Array>> {
  return new Map(await Promise.all([...new Set(rows.map((row) => row.module))].map(async (hash) => {
    const bytes = assets.get(hash); if (bytes === undefined) throw new Error(`Sky Reach mover module ${hash} was not admitted`);
    const copy = Uint8Array.from(bytes), digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy));
    if ([...digest].map((b) => b.toString(16).padStart(2, '0')).join('') !== hash) throw new Error('Sky Reach mover module hash mismatch');
    return [hash, copy] as const;
  })));
}

const finite = v.pipe(v.number(), v.finite());
const natural = v.pipe(finite, v.integer(), v.minValue(0));
const Saved = v.strictObject({
  host: v.strictObject({ tick: v.pipe(finite, v.integer(), v.minValue(-1)), used: v.strictObject({ effects: natural, spawns: natural, events: natural, queries: natural, fuel: natural }),
    pending: v.array(v.strictObject({ type: natural, target: natural, value: finite })),
    modules: v.array(v.strictObject({ name: v.string(), memory: v.array(natural), globals: v.array(v.strictObject({ name: v.string(), type: v.picklist(['number', 'bigint']), value: v.string() })), failures: natural, disabled: v.boolean() })) }),
  world: v.array(v.strictObject({ id: natural, name: v.string(), position: v.tuple([finite, finite, finite]), fields: v.record(v.string(), finite), frozen: v.boolean(), interactive: v.boolean() })),
  movers: v.string(),
});

/** One installed headless mover set: the platform runtime over its own script host. */
export interface SkyMovers {
  readonly runtime: MoverRuntime;
  /** Script calls refused so far (a refused call publishes nothing; the proofs require zero). */
  failures: () => number;
}
/** The pieces a mover set needs: a physics getter (native restore replaces the world), a scope, and the bridge's winch permission. */
export interface SkyMoverPorts { physics: () => SimHost['physics']; scope: SimHost['scope']; restoring: boolean; permission: () => number }

/**
 * Build the movers synchronously on one host (install never awaits): a fresh `ScriptHost` with the verified modules, the
 * platform `MoverRuntime` WITHOUT adoption (a restore refuses adopted rows), and a step that runs as the browser's
 * `far.movers` system does: `beginTick` then every row's call with the winch's permission bits. The caller drives `step`.
 */
export function createSkyMovers(modules: ReadonlyMap<string, Uint8Array>, ports: SkyMoverPorts, rows: MoverData = HEADLESS_MOVERS): SkyMovers & { host: ScriptHost; world: ScriptWorld; permissions: Map<string, number> } {
  const world = new ScriptWorld({ fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 }, moverScriptEntities(rows));
  const physicsQuery = (kind: number, input: readonly number[], entity: number): readonly number[] =>
    scriptPhysicsQueries({ physics: ports.physics(), navigation: { closestWalkable: () => null, findPath: () => null }, handle: () => undefined })(kind, input, entity);
  const host = new ScriptHost({ world, query: moverQueries(rows, physicsQuery) });
  [...new Set(rows.map((row) => row.module))].forEach((hash) => {
    const bytes = modules.get(hash); if (bytes === undefined) throw new Error('Unverified Sky Reach mover module');
    host.install(hash, bytes);
  });
  const runtime = new MoverRuntime(rows, { host, physics: ports.physics, scope: ports.scope, restoring: ports.restoring });
  return { runtime, host, world, permissions: new Map([[WINCH_BRIDGE, 0]]), failures: () => host.failureCount };
}

/** Advance a mover set one fixed step: the host tick, then every row's script call, then the chains (none here). */
export function stepSkyMovers(movers: { runtime: MoverRuntime; host: ScriptHost; permissions: Map<string, number> }, tick: number, permission: number): void {
  movers.permissions.set(WINCH_BRIDGE, permission); movers.host.beginTick(tick); movers.runtime.step(tick, movers.permissions); movers.runtime.capture();
}

/**
 * Install the headless movers on a SimHost: built in `install` (restore calls install before the native snapshot), stepped
 * once per host tick, and an exact continuation: the script host's checkpoint (module memories, tick, quotas), the mover
 * entities' fields, and the runtime's pending commands and native body handles, reconnected after the native world restore.
 * Unlike a player save (which returns a lift to its road stop), a tick continuation resumes mid-ride exactly.
 */
export function installSkyMovers(host: SimHost, modules: ReadonlyMap<string, Uint8Array>, restoring: boolean, permission: () => number): SkyMovers {
  const movers = createSkyMovers(modules, { physics: () => host.physics, scope: host.scope, restoring, permission });
  host.onStep('far.movers', () => { stepSkyMovers(movers, host.state.tick, permission()); }, {
    snapshot: () => JSON.stringify({ host: movers.host.checkpoint(), world: movers.world.state(), movers: movers.runtime.snapshotState() }),
    restore: (value) => {
      if (typeof value !== 'string') throw new Error('Invalid Sky Reach mover continuation');
      const saved = v.parse(Saved, JSON.parse(value));
      movers.host.restoreState(saved.host);
      movers.world.restore(saved.world.map((row) => ({ ...row, fields: Object.fromEntries(Object.entries(row.fields).map(([key, field]) => [Number(key), field])) })));
      movers.runtime.restoreState(saved.movers);
    },
    physicsRestored: () => { movers.runtime.reconnect(); },
  });
  return { runtime: movers.runtime, failures: movers.failures };
}
