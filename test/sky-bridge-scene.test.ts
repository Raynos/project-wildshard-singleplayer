import { expect, it } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, MeshStandardMaterial } from 'three';
import { createClientScene } from '../src/game/plugin/ui';
import { worldPieces } from '../src/game/shardfile/bakedKinds';
import type { Piece } from '../src/engine/world/registry';
import BRIDGES from '../src/shards/far-reach/data/bridgeRest.generated.json' with { type: 'json' };
import COLLIDERS from '../src/shards/far-reach/data/bridgePhysics.generated.json' with { type: 'json' };
import { SKY_ROUTE_SCENE, SKY_ROUTES } from '../src/shards/far-reach/data/routeScene.generated';

it('assembles an authored bridge with borrowed materials and optional painted posts', () => {
  const span = BRIDGES.spans.find(row => row.id === 'kit');
  if (span === undefined) throw new Error('Explorer bridge recipe absent');
  const geometry = new BoxGeometry(), deck = new MeshStandardMaterial(), rails = new MeshStandardMaterial();
  const make = (posts: boolean) => createClientScene(span.scene, {
    geometry: name => name === 'post-hd' && !posts ? null : geometry,
    materials: new Map([['deck', deck], ['rails', rails], ['posts', posts ? rails : null]]),
  });
  const full = make(true), sparse = make(false);
  expect(full.root).toBeInstanceOf(Group);
  const planks = full.parts.get('deck'), posts = full.parts.get('posts');
  if (!(planks instanceof InstancedMesh) || !(posts instanceof InstancedMesh)) throw new Error('Bridge instances absent');
  expect(planks.material).toBe(deck); expect(posts.material).toBe(rails);
  expect(planks.count).toBe(span.deck.length / 16); expect(posts.count).toBe(span.posts.length / 16);
  expect(sparse.parts.has('posts')).toBe(false);
  expect(span.ropes.every(name => sparse.parts.has(name))).toBe(true);
  full.dispose(); sparse.dispose(); geometry.dispose(); deck.dispose(); rails.dispose();
});

it('registers the playable spans and keeps hover routes board-only', async () => {
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial();
  const made = createClientScene(SKY_ROUTE_SCENE, { geometry: () => geometry,
    materials: new Map(['deck', 'posts', 'rails', 'glass', 'frame'].map(name => [name, material])) });
  const registered: Piece[] = [];
  const pieces = worldPieces(piece => { registered.push(piece); }, new Group(), SKY_ROUTES.registry, undefined, COLLIDERS);
  await pieces.scene(made, SKY_ROUTES.bindings);
  expect(registered.map(piece => piece.id)).toEqual(SKY_ROUTES.registry.map(row => row.id));
  expect(registered.every(piece => piece.surface === 'wood' && piece.colliders !== undefined && piece.colliders.length > 0)).toBe(true);
  expect(registered.find(piece => piece.id === 'far.updraft')?.mode).toBe('board');
  expect(registered.filter(piece => piece.id.startsWith('far.hover.')).every(piece => piece.mode === 'board')).toBe(true);
  expect(registered.filter(piece => piece.id.startsWith('far.rope.')).every(piece => piece.mode === undefined)).toBe(true);
  made.dispose(); geometry.dispose(); material.dispose();
});
