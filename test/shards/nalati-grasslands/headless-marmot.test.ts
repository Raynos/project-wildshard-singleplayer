// oxlint-disable-next-line import/no-nodejs-modules -- Read the real WASM and admitted Nalati terrain/navigation assets.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost, type SimHost } from '../../../src/engine/sim';
import { snapshotSimHost, restoreSimHost, serializeSimSnapshot, decodeSimSnapshot, type SimSnapshot } from '../../../src/engine/sim/snapshot';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import type { HeadlessRuntimePlan } from '../../../src/sdk/headlessRuntime';
import { expectSameSimSnapshot } from '../../fake/simSnapshot';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET, prepareHeadlessRuntime } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { nalatiCreaturesOf } from '../../../src/shards/nalati-grasslands/runtime/headlessCreatures';
import { nalatiBake } from '../../../src/shards/nalati-grasslands/runtime/baked';
import { nalatiGroupsOf } from '../../../src/shards/nalati-grasslands/runtime/groups';

let rapier: Rapier, plan: HeadlessRuntimePlan;
const assets = new Map([NALATI_TERRAIN_ASSET, NALATI_NAVMESH_ASSET].map(path => [path, new Uint8Array(readFileSync(path))] as const));
const effects = { commands: () => [], emit: (): never => { throw new Error('raid install must not emit a reward'); } };
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); plan = await prepareHeadlessRuntime({ shard: source, assets, rapier }); });
function boot(saved?: SimSnapshot): SimHost {
  const ports = { ...plan.ports, rapier };
  if (saved === undefined) { const host = createSimHost(plan.level, ports); plan.install(host, { restoring: false, ...effects }); return host; }
  return restoreSimHost(plan.level, ports, saved, host => { if (ports.heightAt !== undefined) host.setHeightQuery(ports.heightAt); plan.install(host, { restoring: true, snapshot: saved, ...effects }); });
}
function parts(host: SimHost) {
  const creatures = nalatiCreaturesOf(host), groups = nalatiGroupsOf(host);
  if (creatures === undefined || groups === undefined) throw new Error('missing actual raid controllers');
  return { ...creatures, groups };
}

it('installs the actual tick-zero marmot colony, warns the real herd/pack, and restores every keeper clock through JSON', () => {
  const first = boot(); let restored: SimHost | undefined;
  try {
    const { marmots, groups } = parts(first), basis = first.physics.snapshot();
    expect(marmots.snapshot()).toEqual(nalatiBake().marmots);
    expect(marmots.rows.length).toBeGreaterThan(0);
    const sentry = marmots.rows[0], herd = groups.herds[0], pack = groups.packs[0];
    if (sentry === undefined || herd === undefined || pack === undefined) throw new Error('missing actual marmot warning subjects');
    first.player.position.set(sentry.x + 30, 40, sentry.z);
    sentry.state = 1; sentry.t = 100;
    for (const a of parts(first).bodies) a.harnessHold = true;
    for (const a of herd.members) { a.position.set(sentry.x, 40, sentry.z); a.mem['aw'] = 0; }
    for (const w of pack.members) w.position.set(sentry.x, 40, sentry.z);
    pack.awareness = 0;
    for (let i = 0; i < 7; i++) first.step();
    expect(sentry.state).toBe(2); expect(pack.awareness).toBe(0.3);
    herd.members.forEach(a => { expect(a.mem['aw']).toBe(0.3); });
    for (const a of parts(first).bodies) a.harnessHold = false;
    const saved = snapshotSimHost(first);
    restored = boot(decodeSimSnapshot(serializeSimSnapshot(saved, basis), basis));
    expectSameSimSnapshot(snapshotSimHost(restored), saved);
    expect(parts(restored).marmots.snapshot()).toEqual(marmots.snapshot());
    for (let i = 0; i < 120; i++) { first.step(); restored.step(); }
    expectSameSimSnapshot(snapshotSimHost(restored), snapshotSimHost(first));
  } finally { restored?.dispose(); first.dispose(); }
}, 60_000);
