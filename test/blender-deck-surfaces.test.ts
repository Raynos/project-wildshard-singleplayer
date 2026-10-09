// oxlint-disable-next-line import/no-nodejs-modules -- Inspect the committed Blender payload rather than a synthetic mesh.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Ray, Vector3 } from 'three';
import { normalizeWorldGlb } from '../src/sdk/bake/world';

async function upperSurfaces(probes: readonly (readonly [number, number, number])[]): Promise<void> {
  const bytes = new Uint8Array(readFileSync('src/shards/blender-template/assets/world.glb'));
  const world = await normalizeWorldGlb(bytes, { glb: 'assets/world.glb', colliders: 'mesh',
    materials: { Clay: 'pbr', 'Road clay': 'pbr', 'Hall door': 'pbr' },
    interactive: [{ node: 'HallDoor', id: 'blender.door', colliderId: 'blender.door.collider' }] }, ['pbr']);
  for (const [x, z, height] of probes) {
    const ray = new Ray(new Vector3(x, 40, z), new Vector3(0, -1, 0)), hit = new Vector3();
    let surfaces = 0;
    for (const primitive of world.static) {
      for (let at = 0; at < primitive.indices.length; at += 3) {
        const ia = primitive.indices[at], ib = primitive.indices[at + 1], ic = primitive.indices[at + 2];
        if (ia === undefined || ib === undefined || ic === undefined) throw new Error('Incomplete triangle');
        const a = new Vector3().fromArray(primitive.positions, ia * 3), b = new Vector3().fromArray(primitive.positions, ib * 3), c = new Vector3().fromArray(primitive.positions, ic * 3);
        if (ray.intersectTriangle(a, b, c, true, hit) !== null && Math.abs(hit.y - height) < 0.0001) surfaces++;
      }
    }
    expect(surfaces, `top faces at (${x}, ${z}, ${height})`).toBe(1);
  }
}

it('gives the north bridge, approach and banks one upper surface at their shared route height', async () => {
  await upperSurfaces([[6.35, 207.15, 19.2], [13.125, 197.125, 19.2], [-6.35, 208.15, 19.2], [0, 209.125, 19.2], [35.125, 208.15, 19.2]]);
});

it('gives every G276 deck one upper surface: watchtower, stoa roofs and footbridge, aqueduct, cistern, obelisk dais', async () => {
  await upperSurfaces([[-45, 204.2, 28.2], [-30.4, 205.3, 19.2 + 0.3 * 11], [190, 16, 7.5], [187, -16.4, 7.5], [156.4, 2.3, 7.5],
    [-62, -211.3, 8.8], [-30, -212.5, 8.8], [-101, -212.3, 14.2], [0.7, -16, 0.9]]);
});
