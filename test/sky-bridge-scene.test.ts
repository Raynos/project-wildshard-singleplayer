import { expect, it } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, MeshStandardMaterial } from 'three';
import { createClientScene } from '../src/game/plugin/scene';
import { worldPieces, type WorldPieceRow } from '../src/game/shardfile/bakedKinds';
import type { Piece } from '../src/engine/world/registry';
// oxlint-disable-next-line import/no-nodejs-modules -- Supply the original authored native model directly to its owner.
import { readFileSync } from 'node:fs';
import { bridgeRestValues } from '../src/shards/far-reach/generators/bridgeRest';
import { skyBridgePhysicsPlacements } from '../src/shards/far-reach/generators/bridgeColliders';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { originalSkySceneInputs } from './fixtures/sky-scene-source';

const { routes: { SKY_ROUTE_SCENE, SKY_ROUTES } } = await originalSkySceneInputs();
const COLLIDERS = skyBridgePhysicsPlacements();

it('retires bridge contact publication while retaining the complete original wire', () => {
  const bytes = new TextEncoder().encode(`${JSON.stringify(skyBridgePhysicsPlacements())}\n`);
  expect(bytes.byteLength).toBe(227_953);
  expect(hashImmutableBytes(bytes)).toBe('d5545bc47278abcf37fbefea7a2fdbad75a8998b684e309a1585da081ce425f7');
});

it('assembles an authored bridge with borrowed materials and optional painted posts', async () => {
  const BRIDGES = await bridgeRestValues(url => new Uint8Array(readFileSync(`public${url}`)));
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
  const pieces = worldPieces(piece => { registered.push(piece); }, new Group(), SKY_ROUTES.registry as readonly WorldPieceRow[], undefined, COLLIDERS);
  await pieces.scene(made, SKY_ROUTES.bindings);
  expect(registered.map(piece => piece.id)).toEqual(SKY_ROUTES.registry.map(row => row.id));
  expect(registered.every(piece => piece.surface === 'wood' && piece.colliders !== undefined && piece.colliders.length > 0)).toBe(true);
  expect(registered.find(piece => piece.id === 'far.updraft')?.mode).toBe('board');
  expect(registered.filter(piece => piece.id.startsWith('far.hover.')).every(piece => piece.mode === 'board')).toBe(true);
  expect(registered.filter(piece => piece.id.startsWith('far.rope.')).every(piece => piece.mode === undefined)).toBe(true);
  made.dispose(); geometry.dispose(); material.dispose();
});
