import { expect, it } from 'vitest';
import { generateStrip, type StripProfile } from '../src/engine/sim/strips';
import type { SeamEdge } from '../src/engine/sim/seamGeometry';
import { SEAM_BUCKETS, seamBucket, seamLookGeometry } from '../src/game/grid/seamLook';

const profile = (height: (i: number) => number, colour: readonly [number, number, number] = [0.3, 0.5, 0.2]): StripProfile => ({
  heights: Array.from({ length: 257 }, (_, i) => height(i)), colours: Array.from({ length: 257 }, () => [...colour]), roadHeight: 0,
});
const entry = (h: number) => (i: number): number => (Math.abs(i - 128) <= 4 ? 0 : h);
const open: Omit<SeamEdge, 'profile'> = { entryWidth: 6 };

it('keys every generator feature kind to a seam material, unknown kinds to ground (G90 / G91 / G101)', () => {
  const kinds = ['deck', 'neutral-buffer', 'gradient', 'overlap', 'turn-in', 'retaining-wall', 'parapet', 'culvert', 'cliff', 'talus', 'dike', 'road-wall', 'guard-rail'];
  expect(kinds.map(seamBucket)).toEqual(['ground', 'ground', 'ground', 'ground', 'ground', 'stone', 'stone', 'stone', 'rock', 'rock', 'dike', 'curtain', 'rail']);
  expect(seamBucket('a-newer-kind')).toBe('ground');
});

it('draws the exact collider triangles, one group per material present, the shard colour on its cliff', () => {
  // west: a 40 m cliff edge (cliff, talus, road wall + rail); east: a sea held by a dike (+0.8 m water, G91)
  const strip = generateStrip({ id: 'gap.x.0.0', axis: 'x', origin: { x: 277.5, z: 0 }, profiles: [profile(entry(40), [0.6, 0.3, 0.1]), profile(entry(0.2))], adjacent: [],
    observations: [open, { ...open, waterSurface: 0.8 }] });
  const { geometry, state } = seamLookGeometry([strip], { origin: { x: 0, z: 0 } });
  // the look never rebuilds geometry: the same triangle count as the collider mesh
  expect(state.triangles).toBe(strip.mesh.indices.length / 3);
  expect(geometry.getAttribute('position').count).toBe(strip.mesh.positions.length / 3);
  // (the cliff's ends, where the edge climbs from the entry, are short retaining faces: stone)
  expect(Object.keys(state.buckets).sort()).toEqual(['curtain', 'dike', 'ground', 'rail', 'rock', 'stone']);
  expect(state.draws).toBe(6);
  expect(geometry.groups.map((g) => SEAM_BUCKETS[g.materialIndex ?? -1])).toEqual(['ground', 'stone', 'rock', 'dike', 'rail', 'curtain']);
  // every collider triangle appears exactly once in the drawn index buffer
  const key = (a: number, b: number, c: number): string => [a, b, c].sort((x, y) => x - y).join(',');
  const drawn = new Map<string, number>(), index = geometry.getIndex()?.array ?? [];
  for (let i = 0; i < index.length; i += 3) { const k = key(index[i] ?? 0, index[i + 1] ?? 0, index[i + 2] ?? 0); drawn.set(k, (drawn.get(k) ?? 0) + 1); }
  for (let i = 0; i < strip.mesh.indices.length; i += 3) {
    const k = key(strip.mesh.indices[i] ?? 0, strip.mesh.indices[i + 1] ?? 0, strip.mesh.indices[i + 2] ?? 0);
    expect(drawn.get(k)).toBeGreaterThan(0);
  }
  // the cliff wears the shard's own (orange) edge colour toward rock, not the neutral platform grey
  const rock = geometry.groups.find((g) => SEAM_BUCKETS[g.materialIndex ?? -1] === 'rock');
  const colour = geometry.getAttribute('color'), first = index[rock?.start ?? 0] ?? 0;
  expect(colour.getX(first)).toBeGreaterThan(colour.getZ(first) + 0.1);
});

it('a resolved sourceSurface colour wins over the sampled edge colour', () => {
  const strip = generateStrip({ id: 'gap.x.0.0', axis: 'x', origin: { x: 0, z: 0 }, profiles: [profile(entry(40)), profile(entry(0))], adjacent: [],
    observations: [{ ...open, sourceSurface: 'basalt' }, open] });
  const { geometry } = seamLookGeometry([strip], { origin: { x: 0, z: 0 } }, (name) => (name === 'basalt' ? [0, 0, 1] : undefined));
  const rock = geometry.groups.find((g) => SEAM_BUCKETS[g.materialIndex ?? -1] === 'rock'), index = geometry.getIndex()?.array ?? [];
  const first = index[rock?.start ?? 0] ?? 0, colour = geometry.getAttribute('color');
  expect(colour.getZ(first)).toBeGreaterThan(colour.getX(first) + 0.2);
});
