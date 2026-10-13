// oxlint-disable-next-line import/no-nodejs-modules -- Walk the admitted native terrain and world with the shipping physics module.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { createSimHost } from '../../../src/engine/sim';
import { loadRapier, type Rapier } from '../../../src/engine/physics/rapier';
import { groups } from '../../../src/engine/physics/groups';
import { withOwner } from '../../../src/engine/app/ownership';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { nalatiNativeAssets } from '../../proof/nalati-grasslands/nativeAssets';
import { prepareHeadlessRuntime } from '../../../src/shards/nalati-grasslands/runtime/headless';
import { proveNalatiEntryways } from '../../../src/shards/nalati-grasslands/runtime/headlessEntryways';

let rapier: Rapier;
const assets = nalatiNativeAssets(source);
beforeAll(async () => { rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });

it('walks all 92 native lanes beyond each flat socket and refuses a real barrier without leaking a capsule', async () => {
  const plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
  const heightAt = plan.ports?.heightAt;
  if (heightAt === undefined || plan.proveEntries === undefined) throw new Error('Missing native entry proof');
  const host = createSimHost(plan.level, { ...plan.ports, rapier });
  try {
    plan.install(host, { restoring: false, commands: () => [], emit: () => { throw new Error('Entry walking must not award gameplay facts'); } });
    host.step(); // The real fixed step admits the freshly installed native colliders to Rapier's queries.
    const before = host.physics.world.colliders.len(), tick = host.state.tick, position = host.player.position.clone();
    const proof = plan.proveEntries(host);
    expect(proof.lanes).toBe(92); expect(proof.steps).toBeGreaterThanOrEqual(36_800);
    expect(host.physics.world.colliders.len()).toBe(before);
    expect(host.state.tick).toBe(tick); expect(host.player.position).toEqual(position);
    const barrier = withOwner(host.scope, () => host.physics.world.createCollider(host.physics.R.ColliderDesc.cuboid(4, 2, 0.5)
      .setTranslation(0, 2, 246).setCollisionGroups(groups('WORLD'))));
    host.step();
    expect(() => proveNalatiEntryways(host, source.entryways, heightAt)).toThrow('Blocked entry north');
    expect(host.physics.world.colliders.len()).toBe(before + 1);
    host.physics.world.removeCollider(barrier, false);
  } finally { host.dispose(); }
  expect(Object.values(host.scope.census).every(count => count === 0)).toBe(true);
});
