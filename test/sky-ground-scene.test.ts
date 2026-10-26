import { expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, type Object3D } from 'three';
import { createWorldScene } from '../src/game/plugin/scene';
import { worldPieces, type WorldPieceRow } from '../src/game/shardfile/bakedKinds';
import type { Piece } from '../src/engine/world/registry';
import { skyGroundValues } from '../src/shards/far-reach/generators/groundScene';
import { skyPhysicsPlacements } from '../src/shards/far-reach/generators/physicsPlacements';
import { SKY_SCENE_BLOBS, SKY_WORLD_SCENES } from '../src/shards/far-reach/generators/worldScenes';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';

const { SKY_GROUND, SKY_GROUND_COLLIDERS } = skyGroundValues();
const PLACEMENTS = skyPhysicsPlacements();

const isMesh = (node: Object3D | undefined): node is Mesh => node instanceof Mesh;

it('source-derived ground retains the complete published scene and world declaration', () => {
  const ground = SKY_SCENE_BLOBS.find(row => row.file.name === 'world/scenes/ground.json');
  if (ground === undefined) throw new Error('Missing original published ground');
  expect(ground.file).toEqual({ name: 'world/scenes/ground.json',
    path: 'blobs/json/4f0303edc133f9a55afe6f2499bdf782f0cd03919871f00831c393d63cbfb25b.json', kind: 'json',
    hash: '4f0303edc133f9a55afe6f2499bdf782f0cd03919871f00831c393d63cbfb25b', compressed: 2628, decoded: 2628,
    gpu: 0, triangles: 0, draws: 0, critical: false, dependencies: [] });
  expect(hashImmutableBytes(ground.bytes)).toBe(ground.file.hash);
  const world = new TextEncoder().encode(encodeCanonicalJson(SKY_WORLD_SCENES));
  expect(world.byteLength).toBe(329_351);
  expect(hashImmutableBytes(world)).toBe('27f1bf00f36fecbf34936dff22d2e9791498006a92aa2404236883111f417884');
});

it('registers the authored walkable ground while borrowing loaded island geometry', async () => {
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial();
  const tiles = new Map<string, BoxGeometry>(SKY_GROUND.isles.map(row => [row.id, geometry]));
  const materials = new Map(SKY_GROUND.looks.map(look => [look, material]));
  const made = createWorldScene(SKY_GROUND.recipe, { materials, geometry: name => tiles.get(name) ?? null, model: () => null,
    baked: (_piece, only) => {
      const root = new Group(); root.name = String(only?.['name']);
      root.add(new Mesh(geometry, material)); return { root, colliders: [] };
    } });
  const registered: Piece[] = [], root = new Group();
  const pieces = worldPieces(piece => { registered.push(piece); }, root, SKY_GROUND.registry as readonly WorldPieceRow[], undefined,
    [...PLACEMENTS, ...SKY_GROUND_COLLIDERS]);
  await pieces.scene(made, SKY_GROUND.bindings);
  expect(registered.map(piece => piece.id)).toEqual(SKY_GROUND.registry.map(row => row.id));
  expect(registered.every(piece => piece.colliders !== undefined && piece.colliders.length > 0 && piece.surface === 'grass')).toBe(true);
  for (const row of SKY_GROUND.isles) {
    const mesh = made.parts.get(`isle.${row.id}`);
    if (!isMesh(mesh)) throw new Error(`Missing island mesh ${row.id}`);
    expect(mesh.geometry).toBe(tiles.get(row.id));
    expect(mesh.material).toBe(material);
    expect(registered.find(piece => piece.id === `far.isle.${row.id}`)?.object).toBe(mesh);
    expect(mesh.position.toArray()).toEqual(row.at);
  }
  for (const row of SKY_GROUND_COLLIDERS) {
    expect(registered.find(piece => piece.id === row.id)?.colliders?.some(shape => shape.kind === 'hull')).toBe(true);
  }
  made.dispose(); geometry.dispose(); material.dispose();
});

it('leaves an island undrawn when its props tile is unavailable', () => {
  const material = new MeshBasicMaterial();
  const made = createWorldScene(SKY_GROUND.recipe, {
    geometry: () => null, materials: new Map(SKY_GROUND.looks.map(look => [look, material])), model: () => null,
    baked: () => ({ root: new Group(), colliders: [] }),
  });
  for (const row of SKY_GROUND.isles) {
    const island = made.parts.get(`isle.${row.id}`);
    if (!isMesh(island)) throw new Error(`Missing island fallback ${row.id}`);
    expect(island.geometry.getAttribute('position')).toBeUndefined();
    expect(island.position.toArray()).toEqual(row.at);
  }
  made.dispose(); material.dispose();
});
