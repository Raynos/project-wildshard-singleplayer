import { expect, test } from 'vitest';
import { Document, NodeIO, type Material } from '@gltf-transform/core';
import { normalizeWorldGlb } from '../src/sdk/bake/world';

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
