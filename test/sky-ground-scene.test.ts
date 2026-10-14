import { expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial } from 'three';
import { createWorldScene } from '../src/game/plugin/ui';
import { worldPieces } from '../src/game/shardfile/bakedKinds';
import type { Piece } from '../src/engine/world/registry';
import { SKY_GROUND, SKY_GROUND_COLLIDERS } from '../src/shards/far-reach/data/groundScene.generated';
import PLACEMENTS from '../src/shards/far-reach/data/physicsPlacements.generated.json' with { type: 'json' };

it('registers the authored walkable ground while borrowing native island poses', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const objects = new Map(SKY_GROUND.isles.map(row => {
    const mesh = new Mesh(geometry, material); mesh.position.set(5, 30, -7);
    return [`isle.${row.id}`, mesh] as const;
  }));
  const made = createWorldScene(SKY_GROUND.recipe, { objects, geometry: () => null, model: () => null,
    baked: (_piece, only) => {
      const root = new Group(); root.name = String(only?.['name']);
      root.add(new Mesh(geometry, material)); return { root, colliders: [] };
    } });
  const registered: Piece[] = [], root = new Group();
  const pieces = worldPieces(piece => { registered.push(piece); }, root, SKY_GROUND.registry, undefined,
    [...PLACEMENTS, ...SKY_GROUND_COLLIDERS]);
  await pieces.scene(made, SKY_GROUND.bindings);
  expect(registered.map(piece => piece.id)).toEqual(SKY_GROUND.registry.map(row => row.id));
  expect(registered.every(piece => piece.colliders !== undefined && piece.colliders.length > 0 && piece.surface === 'grass')).toBe(true);
  for (const row of SKY_GROUND.isles) {
    const mesh = objects.get(`isle.${row.id}`);
    expect(registered.find(piece => piece.id === `far.isle.${row.id}`)?.object).toBe(mesh);
    expect(mesh?.position.toArray()).toEqual([5, 30, -7]);
  }
  for (const row of SKY_GROUND_COLLIDERS) {
    expect(registered.find(piece => piece.id === row.id)?.colliders?.some(shape => shape.kind === 'hull')).toBe(true);
  }
  made.dispose(); geometry.dispose(); material.dispose();
});
