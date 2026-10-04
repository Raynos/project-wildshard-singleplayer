import { expect, it } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, Mesh } from 'three';
import { installBorderShimmer } from '../src/game/grid/borderShimmer';
import type { StripProfile } from '../src/engine/sim/strips';

/**
 * G78's border shimmer is a 1.5 m ribbon standing on each cell border. Its top vertices once had no z (five numbers per
 * column instead of six), so every ribbon's top edge lay on z = 0 and each border leaned across its cell as a vast cyan
 * sheet: the "cyan box in the sky" over Pine Hollow's ridge in the SF19b boards (render-fixes2).
 */
it('every shimmer column stands upright: the top vertex is right over its foot, 1.5 m up', () => {
  const scene = new Group(), disposers: (() => void)[] = [];
  const colours = Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]);
  const ridge: StripProfile = { heights: Array.from({ length: 257 }, (_, i) => 10 + 50 * Math.sin(i / 40) ** 2), colours, roadHeight: 0 };
  const flat: StripProfile = { heights: Array.from({ length: 257 }, () => 0), colours, roadHeight: 0 };
  installBorderShimmer({
    cells: [{ x: 0, z: 555, edges: { north: ridge, east: ridge, south: ridge, west: ridge } }, { x: 0, z: 0, edges: { north: flat, east: flat, south: flat, west: flat } }, { x: 555, z: 0, edges: null }],
    ports: { feet: () => ({ x: 0, z: 277.5 }), status: () => null, text: () => '' },
    scene, scope: { onDispose: (fn) => { disposers.push(fn); } }, time: () => 0,
  });
  const line = scene.getObjectByName('grid-border-shimmer-line');
  if (!(line instanceof Mesh)) throw new Error('no shimmer line');
  const geometry: unknown = line.geometry;
  if (!(geometry instanceof BufferGeometry)) throw new Error('no shimmer geometry');
  const position: unknown = geometry.getAttribute('position');
  if (!(position instanceof BufferAttribute)) throw new Error('no shimmer positions');
  expect(position.count).toBe(3 * 4 * 65 * 2);
  for (let i = 0; i < position.count; i += 2) {
    expect(position.getX(i + 1)).toBe(position.getX(i));
    expect(position.getZ(i + 1)).toBe(position.getZ(i));
    expect(position.getY(i + 1) - position.getY(i)).toBeCloseTo(1.5, 4);
  }
  // every column sits on its cell's border
  const along = (v: number, centres: readonly number[]): boolean => centres.some((c) => Math.abs(Math.abs(v - c) - 250) < 1e-3);
  for (let i = 0; i < position.count; i++) expect(along(position.getZ(i), [0, 555]) || along(position.getX(i), [0, 555])).toBe(true);
  for (const fn of disposers) fn();
});
