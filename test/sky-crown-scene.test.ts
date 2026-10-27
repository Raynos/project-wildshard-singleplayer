import { expect, it } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, MeshStandardMaterial } from 'three';
import { bindWorldSceneParts, createWorldScene } from '../src/game/plugin/scene';
import type { ColliderDesc } from '../src/engine/world/registry';
import { crownScene } from '../src/shards/far-reach/generators/crownScene';
import { crownInstances } from '../src/shards/far-reach/generators/crownInstances';
import { hashImmutableBytes } from '../src/sdk/immutable';

const CROWN_SCENE = crownScene();

it('retains the complete original float32 crown matrices without a scheduler handoff', () => {
  const bytes = (): Uint8Array => new TextEncoder().encode(`${JSON.stringify(crownInstances())}\n`);
  expect(bytes().byteLength).toBe(789);
  expect(hashImmutableBytes(bytes())).toBe('3af611946d9a3c684fe659eeb7b1388c7d06c3a8dc0c6f0cc2577174e24191cb');
  const changed = crownInstances(); changed[0]?.fill(0);
  expect(hashImmutableBytes(bytes())).toBe('3af611946d9a3c684fe659eeb7b1388c7d06c3a8dc0c6f0cc2577174e24191cb');
});

it('assembles the carved arena around its borrowed baked part and collider owner', () => {
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial(), baked = new Group(), colliders: ColliderDesc[] = [];
  const made = createWorldScene(CROWN_SCENE.recipe, {
    geometry: () => geometry, materials: new Map(CROWN_SCENE.models.map(row => [row.id, material])),
    model: () => null, baked: () => ({ root: baked, colliders }),
  });
  const bound = bindWorldSceneParts(made, { colliders: 'colliders' }, CROWN_SCENE.bindings);
  expect(bound.colliders).toBe(colliders);
  expect(baked.parent).toBe(made.root);
  expect(made.parts.get('dais')?.name).toBe('far.crown.dais');
  for (const row of CROWN_SCENE.models.filter(entry => entry.look === null)) {
    const stone = made.parts.get(row.id);
    expect(stone instanceof InstancedMesh).toBe(true);
    expect(stone?.parent).toBe(made.root);
  }
  made.dispose(); geometry.dispose(); material.dispose();
});

it('keeps the baked arena and collision owner when carved models are unavailable', () => {
  const baked = new Group(), colliders: ColliderDesc[] = [];
  const made = createWorldScene(CROWN_SCENE.recipe, {
    geometry: () => null, materials: new Map(), model: () => null, baked: () => ({ root: baked, colliders }),
  });
  expect(made.root.children).toEqual([baked]);
  expect(bindWorldSceneParts(made, { colliders: 'colliders' }, CROWN_SCENE.bindings).colliders).toBe(colliders);
  made.dispose();
});
