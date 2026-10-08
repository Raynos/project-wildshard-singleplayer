// oxlint-disable-next-line import/no-nodejs-modules -- This is the compact, committed real-host capture witness, not another model builder.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { assignNalatiMeshes, type NalatiAssignmentInventory } from '../scripts/bake/nalatiMeshAssignments';

const meshSchema = v.object({ sourceMesh: v.number(), name: v.string(), instances: v.nullable(v.object({ count: v.number(), capacity: v.number() })) });
const schema = v.object({
  roots: v.array(v.object({ name: v.string(), models: v.array(v.string()), meshes: v.array(meshSchema) })),
  builds: v.array(v.object({ model: v.string(), kind: v.picklist(['model', 'weld']), meshes: v.array(meshSchema) })),
});
// Projection of progress/shard-platform/g227/nalati-authored-capture-cd1890836/summary.json. The full receipt
// is excluded from the Vercel gate; this exact identity/layout projection survives the clean test export.
const source = (): v.InferOutput<typeof schema> => v.parse(schema, JSON.parse(readFileSync(new URL('fixtures/bake/nalati-mesh-assignment.json', import.meta.url), 'utf8')));

describe('Nalati per-mesh static/hybrid assignment', () => {
  it('covers the actual roots and builder outputs once, retaining empty scatter and dynamic geometry explicitly', () => {
    const inventory = source(), result = assignNalatiMeshes(inventory);
    expect(inventory.roots.flatMap(root => root.meshes)).toHaveLength(58);
    expect(inventory.builds.flatMap(build => build.meshes)).toHaveLength(2);
    expect(result).toHaveLength(58); // 56 unique root meshes plus two independent balbal builder meshes.
    expect(result.filter(row => row.owner === 'static')).toHaveLength(50);
    expect(result.filter(row => row.owner === 'hybrid')).toHaveLength(8);
    expect(result.filter(row => row.replay === 'world-mesh')).toHaveLength(30);
    expect(result.filter(row => row.replay === 'captured-instances')).toHaveLength(10);
    const scatter = result.filter(row => row.replay === 'scatter-source-required');
    expect(scatter).toHaveLength(10);
    for (const row of scatter) {
      const captured = inventory.roots[row.primary.index]?.meshes[row.primary.mesh];
      expect(captured?.instances?.count).toBe(0); expect(captured?.instances?.capacity).toBeGreaterThan(0);
    }
    expect(result.filter(row => row.owner === 'hybrid').map(row => row.name)).toEqual(['', '', 'nalati-model-horse-saddled', 'nalati-kokpar-riders', ...Array.from({ length: 4 }, () => 'nalati-far-herd')]);
  });

  it('gives overlapping Kokpar goals to the static child and includes watchtower steps only once', () => {
    const result = assignNalatiMeshes(source()), aliases = result.filter(row => row.references.length > 1);
    expect(aliases).toHaveLength(2);
    expect(aliases.map(row => ({ owner: row.owner, replay: row.replay, root: row.primary.index, references: row.references.map(ref => ref.index) }))).toEqual([
      { owner: 'static', replay: 'world-mesh', root: 10, references: [10, 11] },
      { owner: 'static', replay: 'world-mesh', root: 12, references: [12, 13] },
    ]);
  });

  it('refuses new layouts, unknown builders and unrelated source identity collisions instead of assuming static', () => {
    const changed = source(), root = changed.roots[0]; if (root === undefined) throw new Error('Missing capture root');
    root.models.push('nalati-grasslands/new-moving-content');
    expect(() => assignNalatiMeshes(changed)).toThrow('Unaudited Nalati root/model/mesh layout');
    const extra = source(), mesh = extra.roots[0]?.meshes[0]; if (mesh === undefined) throw new Error('Missing capture mesh');
    mesh.name = 'new mesh'; expect(() => assignNalatiMeshes(extra)).toThrow('Unaudited Nalati root/model/mesh layout');
    const collided = source(), other = collided.roots[1]?.meshes[0]; if (other === undefined) throw new Error('Missing collision mesh');
    other.sourceMesh = 2; expect(() => assignNalatiMeshes(collided)).toThrow('Unreviewed Nalati mesh alias');
    const build = source(); build.builds.push({ model: 'nalati-grasslands/new-builder', kind: 'model', meshes: [] });
    expect(() => assignNalatiMeshes(build)).toThrow('Unaudited Nalati builder');
  });

  it('refuses incomplete static instance arrays rather than treating visibility as the authored population', () => {
    const changed = source(), mesh = changed.roots[2]?.meshes.find(row => row.instances !== null);
    if (mesh?.instances === undefined || mesh.instances === null) throw new Error('Missing static GLB instances');
    mesh.instances.count = 0;
    expect(() => assignNalatiMeshes(changed)).toThrow('Incomplete Nalati static instance capture');
  });

  it('keeps old captures pending and refuses a truncated original scatter source', () => {
    const changed: NalatiAssignmentInventory = source(), mesh = changed.roots[17]?.meshes[0];
    if (mesh?.instances === undefined || mesh.instances === null) throw new Error('Missing actual scatter mesh');
    const before = assignNalatiMeshes(changed).find(row => row.sourceMesh === mesh.sourceMesh);
    expect(before?.replay).toBe('scatter-source-required');
    mesh.scatter = { version: 1, count: mesh.instances.capacity - 1 };
    expect(() => assignNalatiMeshes(changed)).toThrow('Incomplete Nalati original scatter source');
    mesh.scatter = { version: 1, count: mesh.instances.capacity };
    expect(assignNalatiMeshes(changed).find(row => row.sourceMesh === mesh.sourceMesh)?.replay).toBe('scatter-source');
  });
});
