import { expect, it } from 'vitest';
import { seamGeometry, cornerSeamGeometry, SEAM_FACE_TOP, SEAM_OFFSETS, type SeamEdge } from '../src/engine/sim/seamGeometry';
import { edgeSampleLocations, edgeSample } from '../src/engine/sim/edgeProfiles';

const edge = (height: number, count = 257): SeamEdge => ({ profile: { heights: Array.from({ length: count }, () => height), colours: Array.from({ length: count }, () => [0.2, 0.4, 0.6]), roadHeight: 0 }, entryWidth: 0 });
const input = (a: SeamEdge, b: SeamEdge = edge(0)) => ({ id: 'study.edge', axis: 'x' as const, origin: { x: 277.5, z: 0 }, edges: [a, b] as const });
it('keeps the road and4m buffer at0, with a2m sampled smoothstep gradient clamped to B', () => {
  const result = seamGeometry(input(edge(6), edge(-1.5))), count = SEAM_OFFSETS.length;
  expect(result).toEqual(seamGeometry(input(edge(6), edge(-1.5))));
  for (let col = 0; col < count; col++) {
    const u = SEAM_OFFSETS[col] ?? 0, weight = Math.max(0, Math.min(1, (Math.abs(u) - 11.5) / 16)), b = u < 0 ? 6 : -1.5;
    expect(result.mesh.positions[col * 3 + 1]).toBeCloseTo(b * weight ** 2 * (3 - 2 * weight), 6);
    if (Math.abs(u) <= 11.5) expect(result.mesh.positions[col * 3 + 1]).toBe(0);
    if (col > 0 && col !== count / 2) expect(u - (SEAM_OFFSETS[col - 1] ?? 0)).toBeLessThanOrEqual(2);
  }
  let end = 0;
  for (const feature of result.features) { expect(feature.firstIndex).toBe(end); end += feature.indexCount; }
  expect(end).toBe(result.mesh.indices.length);
  expect(result.turnIn).toEqual({ at: 0, widths: [0, 0] });
});
it('preserves every mixed256/257 native seam vertex and its boundary height within2cm', () => {
  const a = edge(0, 256), b = edge(0, 257);
  const variedA = { ...a, profile: { ...a.profile, heights: a.profile.heights.map((_, i) => 2 + Math.sin(i)) } };
  const variedB = { ...b, profile: { ...b.profile, heights: b.profile.heights.map((_, i) => 4 + Math.sin(i)) } };
  const result = seamGeometry(input(variedA, variedB)), along = edgeSampleLocations([variedA.profile, variedB.profile]);
  expect(along).toHaveLength(511);
  for (let row = 0; row < along.length; row++) for (const [col, profile] of [[0, variedA.profile], [SEAM_OFFSETS.length - 1, variedB.profile]] as const) {
    const at = (row * SEAM_OFFSETS.length + col) * 3;
    expect(Math.abs((result.mesh.positions[at + 1] ?? Infinity) - edgeSample(profile, along[row] ?? 0).height)).toBeLessThanOrEqual(0.02);
  }
});
it('keeps every native boundary segment indexed and joins constant fans without interior T-junctions', () => {
  for (const axis of ['x', 'z'] as const) {
    const a = edge(0, 256), b = edge(0, 257);
    const result = seamGeometry({ ...input(a, b), axis }), rows = edgeSampleLocations([a.profile, b.profile]).length, columns = SEAM_OFFSETS.length;
    const edges = new Map<string, number>();
    const key = (x: number, y: number): string => x < y ? `${x}/${y}` : `${y}/${x}`;
    for (const range of result.features.filter(feature => ['deck', 'neutral-buffer', 'gradient'].includes(feature.kind))) {
      for (let i = range.firstIndex; i < range.firstIndex + range.indexCount; i += 3) {
        const aIndex = result.mesh.indices[i], bIndex = result.mesh.indices[i + 1], cIndex = result.mesh.indices[i + 2];
        if (aIndex === undefined || bIndex === undefined || cIndex === undefined) throw new Error('Missing floor triangle');
        for (const [x, y] of [[aIndex, bIndex], [bIndex, cIndex], [cIndex, aIndex]]) {
          if (x === undefined || y === undefined) throw new Error('Missing floor edge');
          const id = key(x, y); edges.set(id, (edges.get(id) ?? 0) + 1);
        }
      }
    }
    for (const [id, uses] of edges) {
      const [aIndex = 0, bIndex = 0] = id.split('/').map(Number), aRow = Math.floor(aIndex / columns), bRow = Math.floor(bIndex / columns);
      const aColumn = aIndex % columns, bColumn = bIndex % columns;
      const boundary = aRow === bRow && (aRow === 0 || aRow === rows - 1)
        || aColumn === bColumn && (aColumn === 0 || aColumn === columns - 1);
      expect(uses).toBe(boundary ? 1 : 2);
    }
    for (const column of [0, columns - 1]) for (let row = 1; row < rows; row++) {
      expect(edges.get(key((row - 1) * columns + column, row * columns + column))).toBe(1);
    }
  }
});
it('builds same-mesh retaining faces,85degree cliffs with4m talus, and mandatory road walls/rails', () => {
  const low = seamGeometry(input(edge(10))), high = seamGeometry(input({ ...edge(100), sourceSurface: 'ridge' }));
  expect(low.features.some((f) => f.kind === 'retaining-wall')).toBe(true);
  expect(low.features.some((f) => f.kind === 'cliff')).toBe(false);
  const cliffs = high.features.filter((f) => f.kind === 'cliff'); expect(cliffs.length).toBeGreaterThan(0);
  for (const face of cliffs) {
    const i = high.mesh.indices[face.firstIndex], j = high.mesh.indices[face.firstIndex + 2];
    if (i === undefined || j === undefined) throw new Error('Missing cliff triangle');
    const rise = (high.mesh.positions[j * 3 + 1] ?? 0) - (high.mesh.positions[i * 3 + 1] ?? 0), run = Math.abs((high.mesh.positions[j * 3] ?? 0) - (high.mesh.positions[i * 3] ?? 0));
    expect(Math.atan2(rise, run) * 180 / Math.PI).toBeCloseTo(85, 3); expect(face.sourceSurface).toBe('ridge');
  }
  for (const kind of ['talus', 'road-wall', 'guard-rail']) expect(high.features.some((f) => f.kind === kind)).toBe(true);
});
it('caps every seam face at G90\'s 14 m band while the boundary row keeps the raw edge height (G222)', () => {
  const faceTops = (result: { readonly mesh: { readonly positions: Float32Array; readonly indices: Uint32Array }; readonly features: readonly { readonly kind: string; readonly firstIndex: number; readonly indexCount: number; readonly top: number }[] }, kinds: readonly string[]): number => {
    let top = -Infinity;
    for (const feature of result.features.filter((f) => kinds.includes(f.kind))) {
      expect(feature.top).toBeLessThanOrEqual(SEAM_FACE_TOP);
      for (let i = feature.firstIndex; i < feature.firstIndex + feature.indexCount; i++) top = Math.max(top, result.mesh.positions[(result.mesh.indices[i] ?? 0) * 3 + 1] ?? Infinity);
    }
    return top;
  };
  // Nalati's 100 m west edge, Pine's 62 m north edge, and a 250 m edge that used to refuse the whole platform
  for (const height of [20, 62, 100, 250]) {
    const result = seamGeometry(input(edge(height)));
    expect(faceTops(result, ['cliff', 'talus', 'retaining-wall'])).toBeCloseTo(SEAM_FACE_TOP, 6);
    expect(result.features.some((f) => f.kind === 'cliff')).toBe(true);
    // the native boundary row's apron under the shard's terrain stays at the true edge height
    expect(result.features.filter((f) => f.kind === 'overlap' && f.side === -1).every((f) => f.top === height && f.bottom === height)).toBe(true);
    const corner = { height, colour: [0.2, 0.4, 0.6] as const };
    const junction = cornerSeamGeometry({ id: 'study.corner', origin: { x: 0, z: 0 }, corners: [corner, corner, corner, corner] });
    expect(faceTops(junction, ['cliff', 'talus', 'retaining-wall'])).toBeCloseTo(SEAM_FACE_TOP, 6);
  }
  // a short > 14 m run (G108 C2) keeps its retaining face, capped too
  const base = edge(0), spike = { ...base, profile: { ...base.profile, heights: base.profile.heights.map((_, i) => i >= 10 && i <= 13 ? 60 : 0) } };
  expect(faceTops(seamGeometry(input(spike)), ['retaining-wall'])).toBeCloseTo(SEAM_FACE_TOP, 6);
});
it('keeps isolated high steps as retaining faces and never closes a legal midpoint entry', () => {
  const base = edge(0), spike = { ...base, profile: { ...base.profile, heights: base.profile.heights.map((_, i) => i >= 10 && i <= 13 ? 20 : 0) } };
  const result = seamGeometry(input({ ...spike, entryWidth: 6 }));
  expect(result.features.some((f) => f.kind === 'retaining-wall')).toBe(true); expect(result.features.some((f) => f.kind === 'cliff')).toBe(false);
  expect(result.features.filter((f) => ['road-wall', 'guard-rail'].includes(f.kind)).every((f) => f.to <= -3 || f.from >= 3)).toBe(true);
  expect(result.turnIn.widths[0]).toBe(6); expect(() => seamGeometry(input({ ...edge(1), entryWidth: 6 }))).toThrow('Midpoint');
});
it('describes drops, voids, coastal dikes and river culverts as physical triangle ranges', () => {
  const result = seamGeometry(input({ ...edge(-10), geometry: 'void', waterSurface: 0.8, outflows: [{ from: 20, to: 30 }] }));
  for (const kind of ['parapet', 'road-wall', 'guard-rail', 'dike', 'culvert']) expect(result.features.some((f) => f.kind === kind && f.indexCount > 0)).toBe(true);
  expect(result.features.filter((f) => f.kind === 'dike').every((f) => f.top >= 1.3)).toBe(true);
});
it('keeps the corridor and corner guard collision ranges at the G101 single/double-jump boundary', () => {
  const corner = { height: -40, colour: [0.2, 0.4, 0.6] as const };
  for (const result of [seamGeometry(input(edge(-40))), cornerSeamGeometry({ id: 'guard.corner', origin: { x: 0, z: 0 }, corners: [corner, corner, corner, corner] })]) {
    for (const [kind, bottom, top] of [['road-wall', 0, 1.85], ['guard-rail', 1.85, 2]] as const) {
      const ranges = result.features.filter((f) => f.kind === kind); expect(ranges.length).toBeGreaterThan(0);
      for (const range of ranges) {
        expect(range.bottom).toBe(bottom); expect(range.top).toBe(top);
        const vertices = result.mesh.indices.subarray(range.firstIndex, range.firstIndex + range.indexCount);
        const heights = Array.from(vertices, (index) => result.mesh.positions[index * 3 + 1] ?? Infinity);
        expect(Math.min(...heights)).toBeCloseTo(bottom, 6); expect(Math.max(...heights)).toBeCloseTo(top, 6);
      }
    }
  }
});
