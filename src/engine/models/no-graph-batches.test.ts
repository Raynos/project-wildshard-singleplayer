// @vitest-environment happy-dom
// E271 / E272, then PF1 (G936): a graph look batches like a classic one on the guarded batched draws (the grid's cell clip
// keeps a batch's GL_ANGLE_multi_draw directive first (game/grid/cell-clip-defines.test.ts).
// Facade declarations remain instanced (scripts/test-facade-instancing.mjs).
// oxlint-disable-next-line import/no-nodejs-modules -- Scans the live source for BatchedMesh constructions.
import { readdirSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Joins the scanned source paths.
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { BatchedMesh, BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, type Object3D } from 'three';
import { defineModel, modelContext } from './model';
import { place } from './place';
import { graphLook, InstancedBatch } from './instancedBatch';

const nodeMaterial = (): MeshStandardMaterial => { const m = new MeshStandardMaterial(); Object.defineProperty(m, 'isNodeMaterial', { value: true }); return m; };
const kinds = (root: Object3D): string[] => { const out: string[] = []; root.traverse(o => { if (o instanceof BatchedMesh) out.push('batched'); else if (o instanceof InstancedMesh) out.push('instanced'); }); return out; };

test('graph looks batch by default while explicit instanced declarations remain instanced', () => {
  const ctx = modelContext(null);
  Object.assign(ctx, { renderer: { extensions: { has: (name: string) => name === 'WEBGL_multi_draw' } } });
  const drawn = (material: MeshStandardMaterial, draw: 'batched' | 'instanced' = 'batched'): string[] => {
    const model = defineModel({ id: 'shared/graph-batch-fixture', name: 'Graph batch fixture', category: 'props', pipeline: 'code', file: 'src/engine/models/no-graph-batches.test.ts', defaults: {},
      build: () => [{ geometry: new BoxGeometry(1, 1, 1), material }] });
    const placements = Array.from({ length: 6 }, (_, i) => ({ x: i * 3, y: 0, z: 0, matrix: new Matrix4().makeTranslation(i * 3, 0, 0) }));
    return kinds(place(model, placements, { ctx, draw, registry: null }).object);
  };
  expect(graphLook(nodeMaterial())).toBe(true); expect(graphLook(new MeshStandardMaterial())).toBe(false);
  expect(drawn(nodeMaterial())).toEqual(['batched']);
  expect(drawn(new MeshStandardMaterial())).toEqual(['batched']);
  expect(drawn(nodeMaterial(), 'instanced')).toEqual(['instanced']);

});

test('PF1: a graph look\'s levels that share a material but not their shadow flag batch apart; a classic one as before', () => {
  const ctx = modelContext(null);
  Object.assign(ctx, { renderer: { extensions: { has: (name: string) => name === 'WEBGL_multi_draw' } } });
  const casts = (material: MeshStandardMaterial): boolean[] => {
    const model = defineModel({ id: 'shared/graph-batch-levels', name: 'Graph batch levels', category: 'props', pipeline: 'code', file: 'src/engine/models/no-graph-batches.test.ts', defaults: {},
      build: () => [{ geometry: new BoxGeometry(1, 1, 1), material, castShadow: true }],
      lods: [{ from: 10, build: () => [{ geometry: new BoxGeometry(1, 1, 1), material, castShadow: false }] }] });
    const placements = Array.from({ length: 4 }, (_, i) => ({ x: i * 3, y: 0, z: 0, matrix: new Matrix4().makeTranslation(i * 3, 0, 0) }));
    const out: boolean[] = [];
    place(model, placements, { ctx, draw: 'batched', registry: null }).object.traverse(o => { if (o instanceof BatchedMesh) out.push(o.castShadow); });
    return out;
  };
  expect(casts(nodeMaterial())).toEqual([true, false]);
  expect(casts(new MeshStandardMaterial())).toEqual([true]);
});

test('PF1: a batched level drawn at a scale (another variant\'s shape) holds its geometry scaled, as instancing draws it', () => {
  const ctx = modelContext(null);
  Object.assign(ctx, { renderer: { extensions: { has: (name: string) => name === 'WEBGL_multi_draw' } } });
  const shape = new BoxGeometry(1, 2, 1), material = new MeshStandardMaterial();
  const model = defineModel({ id: 'shared/batched-level-scale', name: 'Batched level scale', category: 'props', pipeline: 'code', file: 'src/engine/models/no-graph-batches.test.ts', defaults: { s: 1 },
    variants: [{ id: 'a', label: 'A', params: { s: 1 } }, { id: 'b', label: 'B', params: { s: 2 } }],
    build: () => [{ geometry: shape, material }],
    lods: [{ from: 10, build: (_ctx, p) => [{ geometry: shape, material, scale: p.s }] }] });
  const placements = [{ x: 0, y: 0, z: 0, variant: 'a', matrix: new Matrix4() }, { x: 5, y: 0, z: 0, variant: 'b', matrix: new Matrix4().makeTranslation(5, 0, 0) }];
  let heights: number[] = [];
  place(model, placements, { ctx, draw: 'batched', registry: null }).object.traverse(o => {
    if (!(o instanceof BatchedMesh)) return;
    const position = o.geometry.getAttribute('position');
    heights = [0, 1, 2, 3].map(id => {
      const range = o.getGeometryRangeAt(id);
      if (range === null) throw new Error('Missing batched geometry');
      let lo = Infinity, hi = -Infinity;
      for (let i = range.vertexStart; i < range.vertexStart + range.vertexCount; i++) { lo = Math.min(lo, position.getY(i)); hi = Math.max(hi, position.getY(i)); }
      return hi - lo;
    });
  });
  // (variant, level) in order: a near, a far (scale 1), b near, b far (scale 2)
  expect(heights).toEqual([2, 2, 2, 4]);
  expect(shape.getAttribute('position').getY(0)).toBe(1); // the shared source geometry is untouched
});

test('an instanced batch packs only visible copies per geometry, keeps their matrices and tints, and moves them between shapes', () => {
  const batch = new InstancedBatch(nodeMaterial(), { name: 'fixture', castShadow: true });
  const a = batch.addGeometry(new BoxGeometry()), b = batch.addGeometry(new BoxGeometry(2, 2, 2));
  const copies = [batch.addInstance(a), batch.addInstance(a), batch.addInstance(b)];
  copies.forEach((id, i) => { batch.setMatrixAt(id, new Matrix4().makeTranslation(i, 0, 0)); });
  // a mesh that grows is replaced (and re-added last), so find a slot's mesh by its name
  const instanced = (o: Object3D | undefined): o is InstancedMesh => o instanceof InstancedMesh;
  const mesh = (slot: number): InstancedMesh => { const m = batch.getObjectByName(`fixture:${slot}`); if (!instanced(m)) throw new Error('Missing slot mesh'); return m; };
  const xs = (slot: number): number[] => Array.from({ length: mesh(slot).count }, (_, i) => { const x = mesh(slot).getMatrixAt(i, new Matrix4()).elements.at(12); if (x === undefined) throw new Error('Missing matrix'); return x; });
  const sorted = (values: number[]): number[] => values.sort((p, q) => p - q);
  expect([mesh(0).count, mesh(1).count]).toEqual([2, 1]); expect(mesh(0).castShadow).toBe(true);
  batch.setVisibleAt(copies[0] ?? 0, false);
  expect(xs(0)).toEqual([1]); expect(batch.getVisibleAt(copies[0] ?? 0)).toBe(false);
  batch.setVisibleAt(copies[0] ?? 0, true); batch.setVisibleAt(copies[0] ?? 0, true);
  expect(sorted(xs(0))).toEqual([0, 1]);
  batch.setGeometryIdAt(copies[1] ?? 0, b);
  expect(xs(0)).toEqual([0]); expect(sorted(xs(1))).toEqual([1, 2]);
  batch.setColorAt(copies[2] ?? 0, new Color(1, 0, 0));
  const tint = new Color(); mesh(1).getColorAt(xs(1).indexOf(2), tint);
  expect([tint.r, tint.g, tint.b]).toEqual([1, 0, 0]);
  for (let i = 0; i < 40; i++) batch.addInstance(a); // grows past its first capacity, keeping what it held
  expect(mesh(0).count).toBe(41); expect(batch.instanceCount).toBe(43);
  batch.dispose();
});

// Match the test domain in lint/wildshard-plugin.js; production lookalikes remain guarded.
const batchedDraw = (path: string, source: string): boolean =>
  !path.endsWith('.test.ts') && !path.startsWith('src/engine/test/') && path.endsWith('.ts') && /new\s+(?:THREE\.)?BatchedMesh\s*\(/u.test(source);

test('the draw census excludes only canonical test-domain sources', () => {
  const source = 'new THREE.BatchedMesh(1, 2, 3)';
  for (const path of ['src/engine/render/draw.ts', 'src/game/test/draw.ts', 'src/engine/render/draw.test.ts/draw.ts']) {
    expect(batchedDraw(path, source), path).toBe(true);
  }
  for (const path of ['src/engine/render/draw.test.ts', 'src/engine/test/draw.ts', 'src/game/draw.test.ts']) {
    expect(batchedDraw(path, source), path).toBe(false);
  }
});

test('every BatchedMesh in the live source is one of the four guarded draws', () => {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { if (!entry.name.endsWith('-legacy') && entry.name !== 'node_modules') walk(path); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      const text = readFileSync(path, 'utf8');
      if (batchedDraw(path, text)) found.push(path);
    }
  };
  walk('src');
  // Keep the closed native constructor inventory; row-specific fallbacks are retired under G953.
  const guarded = ['src/engine/models/place.ts', 'src/engine/world/forest/Forest.ts', 'src/engine/world/interact/Interactables.ts', 'src/game/shardfile/worldSceneBatch.ts'];
  expect(found.sort((p, q) => p.localeCompare(q))).toEqual([...guarded].sort((p, q) => p.localeCompare(q)));
});
