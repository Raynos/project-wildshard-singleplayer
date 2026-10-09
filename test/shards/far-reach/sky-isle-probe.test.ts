import { describe, expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, DoubleSide, FrontSide, IcosahedronGeometry, Mesh, MeshBasicMaterial, Raycaster, TorusKnotGeometry, Vector3, type Side } from 'three';
import { skyIsleHitDown } from '../../../src/shards/far-reach/world/skyIsleHd';

// rt3-crossing2: the binned straight-down probe returns exactly what three's full-mesh raycast does (the first hit's height).
const random = (seed: number): (() => number) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; };
function rough(geometry: BufferGeometry, seed: number): BufferGeometry {
  const p = geometry.getAttribute('position'), next = random(seed);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + 0.4 * next()), p.getY(i) * (0.6 + 0.8 * next()), p.getZ(i) * (0.8 + 0.4 * next()));
  return geometry;
}
function soup(seed: number): BufferGeometry {
  const next = random(seed), positions = new Float32Array(3 * 3 * 400);
  for (let i = 0; i < positions.length; i++) positions[i] = (next() - 0.5) * (i % 3 === 1 ? 2 : 6);
  return new BufferGeometry().setAttribute('position', new BufferAttribute(positions, 3));
}
describe('skyIsleHitDown', () => {
  const cases: [string, BufferGeometry, Side][] = [
    ['rough icosahedron (non-indexed)', rough(new IcosahedronGeometry(3, 5), 7), DoubleSide],
    ['torus knot (indexed, several hits a ray)', rough(new TorusKnotGeometry(2, 0.7, 160, 24), 11), DoubleSide],
    ['triangle soup, front faces only', soup(5), FrontSide],
  ];
  for (const [name, geometry, side] of cases) it(`matches three's raycast on a ${name}`, () => {
    const probe = new Mesh(geometry, new MeshBasicMaterial({ side })), ray = new Raycaster(), down = new Vector3(0, -1, 0), next = random(3);
    let hits = 0;
    for (let n = 0; n < 1500; n++) {
      // vertices' own x / z too: rays down triangle edges and corners
      const p = geometry.getAttribute('position'), v = n % 3 === 0 ? Math.floor(next() * p.count) : -1;
      const origin = v >= 0 ? new Vector3(p.getX(v), 9, p.getZ(v)) : new Vector3((next() - 0.5) * 9, 9, (next() - 0.5) * 9);
      ray.set(origin, down);
      const want = ray.intersectObject(probe, false)[0]?.point.y;
      expect(skyIsleHitDown(probe, origin)).toBe(want);
      if (want !== undefined) hits++;
    }
    expect(hits).toBeGreaterThan(300);
  });
});
