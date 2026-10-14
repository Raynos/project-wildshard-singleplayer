import { expect, it } from 'vitest';
import { Group, MeshStandardMaterial } from 'three';
import { createWorldScene } from '../src/game/plugin/ui';
import { worldPieces } from '../src/game/shardfile/bakedKinds';
import type { Piece } from '../src/engine/world/registry';

it('binds real world resources and registers parts without changing their hierarchy or pose', async () => {
  const bake = new Group(), hero = new Group(), material = new MeshStandardMaterial();
  const recipe = { scene: { version: 1, root: 'world', textures: [], materials: [], nodes: [
    { kind: 'group', id: 'world', children: ['camp'] },
    { kind: 'object', id: 'camp', source: 'camp-source', missing: 'refuse', position: [1, 2, 3], children: ['hero'] },
    { kind: 'object', id: 'hero', source: 'hero-source', missing: 'refuse', position: [4, 0, 0] },
  ] }, imports: [
    { id: 'camp-source', kind: 'baked', piece: 'camp', only: { region: 2 }, materials: 'embers' },
    { id: 'hero-source', kind: 'model', model: 'wagon', fit: { size: 3, by: 'height' } },
  ] };
  const collected: MeshStandardMaterial[] = [], shapes = [{ kind: 'box' as const, surface: 'wood' as const, x: 0, y: 0, z: 0, hx: 1, hy: 1, hz: 1 }];
  const made = createWorldScene(recipe, { geometry: () => null,
    model: (name, fit) => { expect(name).toBe('wagon'); expect(fit.by).toBe('height'); return hero; },
    baked: (name, only, each) => { expect(name).toBe('camp'); expect(only).toEqual({ region: 2 }); each?.(material); return { root: bake, colliders: shapes }; },
    materialCollectors: new Map([['embers', value => { collected.push(value); }]]) });
  const root = new Group(), registered: Piece[] = [], pieces = worldPieces(piece => { registered.push(piece); }, root,
    [{ id: 'camp', name: 'Camp', category: 'props', file: 'world', at: [99, 99, 99] }]);
  await expect(pieces.scene(made, [{ piece: 'camp', part: 'absent' }])).rejects.toThrow();
  expect(root.children).toHaveLength(0); expect(registered).toHaveLength(0);
  await pieces.scene(made, [{ piece: 'camp', part: 'camp', baked: 'camp-source' }]);
  expect(root.children[0]).toBe(made.root); expect(hero.parent).toBe(bake); expect(bake.parent).toBe(made.root);
  expect(bake.position.toArray()).toEqual([1, 2, 3]); expect(registered[0]?.object).toBe(bake);
  expect(registered[0]?.colliders).toBe(shapes); expect(collected).toEqual([material]);
  made.dispose(); material.dispose();
});
