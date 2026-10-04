import { beforeAll, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the shipped physics binary with real bounded entry geometry.
import { readFile } from 'node:fs/promises';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { groups } from '../src/engine/physics/groups';
import { walkEdgeEntries } from '../src/engine/physics/edgeEntries';
import { ENTRY_WIDTH, ENTRY_ASPHALT } from '../src/engine/core/config';
import { TURN_IN_HALF, ENTRY_ASPHALT as roadAsphalt } from '../src/game/grid/roadLayout';

let rapier: Awaited<ReturnType<typeof loadRapier>>;
beforeAll(async () => { const bytes = await readFile('public/assets/physics/rapier.wasm'); rapier = await loadRapier(Uint8Array.from(bytes).buffer); });

function canyon() {
  const physics = new Physics(rapier);
  for (const alongX of [true, false]) for (const sign of [-1, 1]) {
    const at = sign * 222.5;
    physics.world.createCollider(rapier.ColliderDesc.cuboid(alongX ? 27.5 : ENTRY_WIDTH / 2, 0.5, alongX ? ENTRY_WIDTH / 2 : 27.5)
      .setTranslation(alongX ? at : 0, -0.5, alongX ? 0 : at).setCollisionGroups(groups('WORLD')));
    for (const wall of [-1, 1]) physics.world.createCollider(rapier.ColliderDesc.cuboid(alongX ? 27.5 : 0.5, 2, alongX ? 0.5 : 27.5)
      .setTranslation(alongX ? at : wall * 4.5, 2, alongX ? wall * 4.5 : at).setCollisionGroups(groups('WORLD')));
  }
  physics.step(); return physics;
}
it('walks an exact eight-metre canyon at every midpoint without requiring a wider opening', () => {
  const physics = canyon();
  try {
    expect(TURN_IN_HALF).toBe(4); expect(roadAsphalt).toBe(ENTRY_ASPHALT);
    const proof = walkEdgeEntries(physics); expect(proof.lanes).toBe(92); expect(proof.steps).toBeGreaterThan(46000);
    expect(() => walkEdgeEntries(physics, () => 0.8)).toThrow('Submerged edge entry');
    physics.world.createCollider(rapier.ColliderDesc.cuboid(4, 2, 0.5).setTranslation(0, 2, 240).setCollisionGroups(groups('WORLD')));
    physics.step(); expect(() => walkEdgeEntries(physics)).toThrow('Blocked edge entry north');
  } finally { physics.dispose(); }
});
