import { expect, it } from 'vitest';
import { seamGeometry, cornerSeamGeometry, SEAM_OFFSETS, type SeamEdge } from '../src/engine/sim/seamGeometry';
import { edgeSampleLocations } from '../src/engine/sim/edgeProfiles';
import { seamTriangleError, type SeamFloorField } from '../src/engine/sim/seamError';

function certify(field: SeamFloorField, indices: ArrayLike<number>, first: number, count: number): void {
  for (let at = first; at < first + count; at += 3) {
    const a = indices[at], b = indices[at + 1], c = indices[at + 2];
    if (a === undefined || b === undefined || c === undefined) throw new Error('Missing adaptive triangle');
    const bound = seamTriangleError(field, [a, b, c]);
    expect(bound.height).toBeLessThanOrEqual(0.02);
    expect(bound.colour).toBeLessThanOrEqual(3);
  }
}

it('certifies the complete height and CIE76 colour fields of mixed native rows, including a narrow colour spike', () => {
  const edge = (count: number, phase: number): SeamEdge => ({ entryWidth: 0, profile: {
    heights: Array.from({ length: count }, (_, i) => 2 + Math.sin(i / 13 + phase) + (i === 49 ? 0.3 : 0)),
    colours: Array.from({ length: count }, (_, i) => i === 49 ? [0.05, 0.8, 0.1]
      : [0.3 + 0.04 * Math.sin(i / 31), 0.4 + 0.05 * Math.cos(i / 23 + phase), 0.2]), roadHeight: 0,
  } });
  const edges = [edge(256, 0), edge(257, 0.7)] as const;
  const generated = seamGeometry({ id: 'adaptive.colour', axis: 'x', origin: { x: 0, z: 0 }, edges });
  const along = edgeSampleLocations(edges.map(value => value.profile));
  const field: SeamFloorField = { ...generated.mesh, columns: SEAM_OFFSETS.length, along };
  let triangles = 0;
  for (const range of generated.features.filter(feature => ['deck', 'neutral-buffer', 'gradient'].includes(feature.kind))) {
    certify(field, generated.mesh.indices, range.firstIndex, range.indexCount); triangles += range.indexCount / 3;
  }
  expect(triangles).toBeLessThan((along.length - 1) * (SEAM_OFFSETS.length - 1) * 2 * 0.75);
  // Both native boundary rows remain indexed segment by segment, including the
  // colour spike: the approximation only concerns the interior of the strip.
  for (const column of [0, SEAM_OFFSETS.length - 1]) {
    const boundary = new Set<number>();
    for (const index of generated.mesh.indices) if (index % SEAM_OFFSETS.length === column && index < along.length * SEAM_OFFSETS.length) boundary.add(index);
    expect(boundary.size).toBe(along.length);
  }
});

it('certifies crossroad interiors while retaining all four original border rows', () => {
  const generated = cornerSeamGeometry({ id: 'adaptive.corner', origin: { x: 0, z: 0 }, corners: [
    { height: -1, colour: [0.1, 0.4, 0.2] }, { height: 4, colour: [0.5, 0.2, 0.1] },
    { height: 3, colour: [0.2, 0.4, 0.3] }, { height: 6, colour: [0.5, 0.3, 0.1] },
  ] });
  const floor = generated.features[0]; if (floor === undefined) throw new Error('Missing corner floor');
  certify({ ...generated.mesh, columns: SEAM_OFFSETS.length, along: SEAM_OFFSETS, corner: true }, generated.mesh.indices, floor.firstIndex, floor.indexCount);
  expect(floor.indexCount / 3).toBeLessThan((SEAM_OFFSETS.length - 1) ** 2 * 2);
  const retained = new Set(Array.from(generated.mesh.indices.slice(0, floor.indexCount)));
  for (let i = 0; i < SEAM_OFFSETS.length; i++) for (const index of [i, (SEAM_OFFSETS.length - 1) * SEAM_OFFSETS.length + i,
    i * SEAM_OFFSETS.length, i * SEAM_OFFSETS.length + SEAM_OFFSETS.length - 1]) expect(retained.has(index)).toBe(true);
});

it('detects an unsampled height and colour spike between coarse endpoints, and certifies unchanged native triangles', () => {
  const positions: number[] = [], colours: number[] = [];
  for (let row = 0; row < 3; row++) for (let column = 0; column < 2; column++) {
    positions.push(column, row === 1 ? 1 : 0, row);
    colours.push(...(row === 1 ? [0.1, 0.9, 0.1] : [0.25, 0.25, 0.25]));
  }
  const field = { positions, colours, columns: 2, along: [0, 1, 2] };
  const error = seamTriangleError(field, [0, 4, 5]);
  expect(error.height).toBe(1); expect(error.colour).toBeGreaterThan(3);
  expect(seamTriangleError(field, [0, 2, 3])).toEqual({ height: 0, colour: 0 });
  expect(() => seamTriangleError(field, [0, 2, 4])).toThrow('Degenerate');
});

it('emits the admitted8m midpoint turn-in without closing it with road walls or rails', () => {
  const edge: SeamEdge = { entryWidth: 8, geometry: 'void', profile: {
    heights: Array.from({ length: 257 }, (_, i) => Math.abs(i - 128) <= 3 ? 0 : -40),
    colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]), roadHeight: 0,
  } };
  const generated = seamGeometry({ id: 'entry8', axis: 'z', origin: { x: 0, z: 0 }, edges: [edge, edge] });
  expect(generated.turnIn).toEqual({ at: 0, widths: [8, 8] });
  expect(generated.features.filter(feature => ['road-wall', 'guard-rail'].includes(feature.kind)).every(feature => feature.to <= -4 || feature.from >= 4)).toBe(true);
});
