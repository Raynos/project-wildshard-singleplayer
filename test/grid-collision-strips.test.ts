// oxlint-disable-next-line import/no-nodejs-modules -- Native byte equality uses the project's committed Rapier binary.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { generateStrip, type StripProfile } from '../src/engine/sim/strips';
import { loadRapier } from '../src/engine/physics/rapier';
import { Physics } from '../src/engine/physics/Physics';
import { installStripCollider } from '../src/engine/physics/stripColliders';
import { tagOf } from '../src/engine/physics/surface';
import { Scope } from '../src/engine/app/scope';
import { collisionStrips } from '../src/game/grid/collisionStrips';

it('drops render colours while preserving exact native worlds, shared buffers, surfaces and entry metadata', async () => {
  const profile: StripProfile = { heights: Array.from({ length: 257 }, (_, i) => Math.abs(i - 128) <= 10 ? 0 : Math.sin(i / 8)),
    colours: Array.from({ length: 257 }, () => [0.2, 0.3, 0.4]), roadHeight: 0 };
  const source = generateStrip({ id: 'gap.x.0.0', axis: 'x', origin: { x: 277.5, z: 0 }, profiles: [profile, profile],
    adjacent: [{ instance: 'west', origin: { x: 0, z: 0 } }, { instance: 'east', origin: { x: 555, z: 0 } }],
    observations: [{ entryWidth: 8, geometry: 'ground', sourceSurface: 'a' }, { entryWidth: 6, geometry: 'ground', sourceSurface: 'b' }] });
  const projected = collisionStrips([source])[0]; if (projected === undefined) throw new Error('No collision strip');
  expect(projected.features).toBe(source.features); expect(projected.turnIn).toBe(source.turnIn); expect(projected.id).toBe(source.id);
  const originals = [source.mesh, ...source.duplicates.map(row => row.mesh)];
  const retained = [projected.mesh, ...projected.duplicates.map(row => row.mesh)];
  expect(projected.duplicates.map(row => row.instance)).toEqual(source.duplicates.map(row => row.instance));
  expect(source.mesh.colours.byteLength).toBeGreaterThan(0); // Projection never mutates the renderer's input.
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const before = new Physics(rapier), after = new Physics(rapier), left = new Scope('original'), right = new Scope('projected');
  try {
    for (const [index, mesh] of retained.entries()) {
      const original = originals[index]; if (original === undefined) throw new Error('No original mesh');
      expect(Object.keys(mesh).sort()).toEqual(['indices', 'origin', 'positions']);
      expect(mesh.origin).toBe(original.origin); expect(mesh.positions).toBe(original.positions); expect(mesh.indices).toBe(original.indices);
      installStripCollider(before, original, left); installStripCollider(after, mesh, right);
    }
    expect(after.world.takeSnapshot()).toEqual(before.world.takeSnapshot());
    for (let tick = 0; tick < 3; tick++) { before.step(); after.step(); }
    expect(after.world.takeSnapshot()).toEqual(before.world.takeSnapshot());
    const tags: unknown[] = []; after.world.forEachCollider(collider => { tags.push(tagOf(collider)); });
    expect(tags).toEqual(originals.map(() => ({ material: 'stone', owner: 'platform.grid' })));
  } finally {
    left.dispose(); right.dispose();
    expect(before.world.colliders.len()).toBe(0); expect(after.world.colliders.len()).toBe(0);
    before.dispose(); after.dispose();
  }
});
