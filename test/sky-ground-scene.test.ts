import { expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, type Object3D } from 'three';
import { createWorldScene } from '../src/game/plugin/scene';
import { worldPieces, type WorldPieceRow } from '../src/game/shardfile/bakedKinds';
import type { Piece } from '../src/engine/world/registry';
import { skyGroundValues } from '../src/shards/far-reach/generators/groundScene';
import { skyPhysicsPlacements } from '../src/shards/far-reach/generators/physicsPlacements';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { originalSkyScenes } from './fixtures/sky-scene-source';

const { blobs: SKY_SCENE_BLOBS } = await originalSkyScenes();

const { SKY_GROUND, SKY_GROUND_COLLIDERS } = skyGroundValues();
const PLACEMENTS = skyPhysicsPlacements();

const isMesh = (node: Object3D | undefined): node is Mesh => node instanceof Mesh;

it('source contact loans cannot mutate the complete current wire', () => {
  const bytes = (): Uint8Array => new TextEncoder().encode(`${JSON.stringify(skyPhysicsPlacements())}\n`);
  const before = hashImmutableBytes(bytes());
  const changed = skyPhysicsPlacements(); changed[0]?.colliders.splice(0);
  expect(hashImmutableBytes(bytes())).toBe(before);
});

it('streamed ground publishes its content-addressed anchor scene costs', () => {
  const ground = SKY_SCENE_BLOBS.find(row => row.file.name === 'world/scenes/ground.json');
  if (ground === undefined) throw new Error('Missing original published ground');
  const hash = hashImmutableBytes(ground.bytes);
  expect(ground.file).toEqual({ name: 'world/scenes/ground.json',
    path: `blobs/json/${hash}.json`, kind: 'json',
    hash, compressed: ground.bytes.byteLength, decoded: ground.bytes.byteLength,
    gpu: 0, triangles: 0, draws: 0, critical: false, dependencies: [] });
  expect(hashImmutableBytes(ground.bytes)).toBe(ground.file.hash);
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
