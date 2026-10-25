import { expect, test } from 'vitest';
import { Document, NodeIO, type Material } from '@gltf-transform/core';
import { normalizeWorldGlb } from './world';
import { farSources } from './authoredWorld';
import { parseWorldSource } from '../worldSource';

// G608: a world source's `far` prefix: those nodes fill only the far proxy, never a tile or a collider
function world(): Promise<Uint8Array> {
  const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene('world');
  const ground = doc.createMaterial('Ground'), glow = doc.createMaterial('Glow');
  const add = (name: string, material: Material, y: number): void => {
    const positions = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0, y, 0, 0, y, 1, 1, y, 0])).setBuffer(buffer);
    scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(doc.createPrimitive().setMaterial(material).setAttribute('POSITION', positions))));
  };
  add('ground', ground, 0); add('collide_ground', ground, 0); add('far_glow', glow, 50);
  return new NodeIO().writeBinary(doc);
}
const source = (far: string) => ({ glb: 'world.glb', colliders: 'nodes:collide_', far, materials: { Ground: 'ground', Glow: 'glow' } });

test('far-prefixed nodes are far only: no tile, no collision', async () => {
  const bytes = await world(), normalized = await normalizeWorldGlb(bytes, source('far_'), ['ground', 'glow']);
  expect(normalized.far.map(row => row.node)).toEqual(['far_glow']);
  expect(normalized.static.map(row => row.node)).toEqual(['ground']);
  expect(normalized.collision.map(row => row.node)).toEqual(['collide_ground']);
  await expect(normalizeWorldGlb(bytes, source('none_'), ['ground', 'glow'])).rejects.toThrow('far prefix none_ matches no meshes');
});

test('NM0: farMode replace builds the far proxy from the far-only nodes alone; add (default) from everything', async () => {
  const bytes = await world(), normalized = await normalizeWorldGlb(bytes, source('far_'), ['ground', 'glow']);
  expect(parseWorldSource(source('far_')).farMode).toBe('add');
  expect(farSources(normalized, new Set(), 'add').map(row => row.node)).toEqual(['ground', 'far_glow']);
  expect(farSources(normalized, new Set(), 'replace').map(row => row.node)).toEqual(['far_glow']);
  expect(() => parseWorldSource({ glb: 'world.glb', colliders: 'nodes:collide_', farMode: 'replace', materials: { Ground: 'ground' } })).toThrow('farMode replace needs a far prefix');
});
