// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- This witness uses the production native physics binary.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { BatchedMesh, Scene, Vector3 } from 'three';
import { app } from '../../../src/engine/app/runtime';
import { enterOwner, currentOwner } from '../../../src/engine/app/ownership';
import { Scope } from '../../../src/engine/app/scope';
import { Physics } from '../../../src/engine/physics/Physics';
import { loadRapier } from '../../../src/engine/physics/rapier';
import { Bodies } from '../../../src/engine/physics/bodies';
import { Flags } from '../../../src/engine/world/interact/flags';
import { WorldRegistry } from '../../../src/engine/world/registry';
import { installKitProps } from '../../../src/kit/models/interact';
import { installAdventureInteractables } from '../../../src/shards/driftwood-isle/quest/interactLifetime';
import { fakeWorld } from '../../fake/world';

it('owns a lazily built home barrel through two entries and page unload without stale native handles', async () => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const page = new Scope('barrel.page'), physics = new Physics(rapier), bodies = new Bodies(physics), registry = new WorldRegistry();
  const previous = { owner: currentOwner(), bodies: app.bodies, registry: app.registryValue };
  app.bodies = bodies; app.registryValue = registry; enterOwner(page); installKitProps();
  const scene = new Scene(), prompts: Parameters<typeof installAdventureInteractables>[1]['prompts'] = [];
  const host = { scene, sky: fakeWorld().sky, player: { position: new Vector3(), velocity: new Vector3() },
    flags: new Flags('driftwood-isle', false), place: () => ({ x: 0, y: 0, z: 0, yaw: 0 }), floorAt: () => 0, prompts };
  try {
    for (let visit = 0; visit < 2; visit++) {
      const entered = page.child('runtime.play');
      const kit = await installAdventureInteractables(entered, host);
      expect(bodies.list).toHaveLength(1); expect(physics.scopedCensus(entered).bodies).toBe(1);
      expect(physics.world.bodies.len()).toBe(1); expect(physics.world.colliders.len()).toBe(1);
      const batches = scene.children.filter((object): object is BatchedMesh => object instanceof BatchedMesh);
      const barrel = bodies.list[0]; if (barrel === undefined) throw new Error('Missing real barrel');
      physics.step(); kit.update(1 / 60, visit);
      if (visit === 0) entered.dispose(); else page.dispose();
      expect(barrel.alive).toBe(false); expect(bodies.list).toHaveLength(0);
      expect(physics.world.bodies.len()).toBe(0); expect(physics.world.colliders.len()).toBe(0);
      expect(prompts).toHaveLength(0); expect(registry.pieces).toHaveLength(0);
      // Batch resources belong to the drawn scene capture in production, not the kit's native disposal.
      for (const batch of batches) batch.dispose();
    }
    expect(page.census.bodies).toBe(0); expect(page.census.colliders).toBe(0);
  } finally {
    page.dispose(); bodies.dispose(); physics.dispose(); enterOwner(previous.owner); app.bodies = previous.bodies; app.registryValue = previous.registry;
  }
});
