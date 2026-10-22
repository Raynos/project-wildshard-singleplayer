// @vitest-environment happy-dom
// E271 / E272: no multi-draw for a graph look. A graph (node) material on a BatchedMesh did not even compile on the grid
// (the cell prefix landed above its GL_ANGLE_multi_draw directive) and spammed 'program not valid'; this keeps it gone.
// oxlint-disable-next-line import/no-nodejs-modules -- Scans the live source for BatchedMesh constructions.
import { readdirSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Joins the scanned source paths.
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { BatchedMesh, BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, type Object3D } from 'three';
import { defineModel, modelContext } from '../src/engine/models/model';
import { place } from '../src/engine/models/place';
import { graphLook, InstancedBatch } from '../src/engine/models/instancedBatch';

const nodeMaterial = (): MeshStandardMaterial => { const m = new MeshStandardMaterial(); Object.defineProperty(m, 'isNodeMaterial', { value: true }); return m; };
const kinds = (root: Object3D): string[] => { const out: string[] = []; root.traverse(o => { if (o instanceof BatchedMesh) out.push('batched'); else if (o instanceof InstancedMesh) out.push('instanced'); }); return out; };

test('a batched model draw with a graph look draws instanced, a classic one still batches', () => {
  const ctx = modelContext(null);
  Object.assign(ctx, { renderer: { extensions: { has: (name: string) => name === 'WEBGL_multi_draw' } } });
  const drawn = (material: MeshStandardMaterial): string[] => {
    const model = defineModel({ id: 'shared/graph-batch-fixture', name: 'Graph batch fixture', category: 'props', pipeline: 'code', file: 'test/no-graph-batches.test.ts', defaults: {},
      build: () => [{ geometry: new BoxGeometry(1, 1, 1), material }] });
    const placements = Array.from({ length: 6 }, (_, i) => ({ x: i * 3, y: 0, z: 0, matrix: new Matrix4().makeTranslation(i * 3, 0, 0) }));
    return kinds(place(model, placements, { ctx, draw: 'batched' }).object);
  };
  expect(graphLook(nodeMaterial())).toBe(true); expect(graphLook(new MeshStandardMaterial())).toBe(false);
  const graph = drawn(nodeMaterial());
  expect(graph).not.toContain('batched'); expect(graph).toContain('instanced');
  expect(drawn(new MeshStandardMaterial())).toEqual(['batched']);
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

test('every BatchedMesh in the live source is one of the three guarded engine draws', () => {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { if (!entry.name.endsWith('-legacy') && entry.name !== 'node_modules') walk(path); continue; }
      if (!entry.name.endsWith('.ts')) continue;
      const text = readFileSync(path, 'utf8');
      if (/new\s+(?:THREE\.)?BatchedMesh\s*\(/u.test(text)) found.push(path);
    }
  };
  walk('src');
  // each routes a graph look (graphLook) to instancing before it builds a batch; a new BatchedMesh needs the same guard here
  const guarded = ['src/engine/models/place.ts', 'src/engine/world/forest/Forest.ts', 'src/engine/world/interact/Interactables.ts'];
  expect(found.sort((p, q) => p.localeCompare(q))).toEqual([...guarded].sort((p, q) => p.localeCompare(q)));
  for (const path of guarded) expect(readFileSync(path, 'utf8')).toMatch(/graphLook\(/u);
});
