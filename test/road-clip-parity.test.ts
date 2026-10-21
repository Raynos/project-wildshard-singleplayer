import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry } from 'three';
import { clipToBinsSteps, cullCountsSteps, cullPlanSteps, finishRoadSteps, ROAD_LOD } from '../src/game/grid/roadCull';

test('road clipping preserves edge vertices, interpolated UVs and exact LOD byte plans', async () => {
  const geometry = new BufferGeometry();
  const positions: number[] = [], weights: number[] = [], indices: number[] = [];
  const points = [-600, -375, -125, -124.999, 0, 124.999, 125, 375, 600];
  for (const [i, x] of points.entries()) for (const [j, z] of points.entries()) {
    const n = positions.length / 3;
    positions.push(x, i, z, x + (j % 2 === 0 ? 0 : 250), j, z + 0.125, x + 4, i + j, z + (i % 2 === 0 ? 4 : 750));
    weights.push(i, j, i + j, i - j, i / 3, j / 7);
    indices.push(n, n + 1, n + 2);
  }
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3));
  geometry.setAttribute('uv', new BufferAttribute(Float32Array.from(weights), 2));
  geometry.setIndex(indices);
  const counts = finishRoadSteps(cullCountsSteps([{ vertices: positions.length / 3, position: (k) => geometry.getAttribute('position').array[k] ?? 0, indices }], 500, ROAD_LOD));
  finishRoadSteps(clipToBinsSteps(geometry, 500));
  const plan = finishRoadSteps(cullPlanSteps(geometry, 500, ROAD_LOD));
  // Golden output from the admitted builder at 97cb8c6723, before the allocation fast path.
  const content = { position: Array.from(geometry.getAttribute('position').array), uv: Array.from(geometry.getAttribute('uv').array), index: Array.from(geometry.getIndex()?.array ?? []), source: Array.from(plan.source), bins: plan.bins, lod: plan.lod, counts };
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(content)));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  expect({ hash, counts }).toEqual({ hash: '031db7363e523059eae3c0b34803ce11cb29fc7b4500641427f2c4e2f9fb3d0f', counts: { clipped: 489, source: 2892, vertices: 243 } });
});
