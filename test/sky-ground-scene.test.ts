import { expect, it } from 'vitest';
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, type Object3D } from 'three';
import { createWorldScene } from '../src/game/plugin/scene';
import { worldPieces, type WorldPieceRow } from '../src/game/shardfile/bakedKinds';
import type { Piece } from '../src/engine/world/registry';
import { skyGroundValues } from '../src/shards/far-reach/generators/groundScene';
import { skyPhysicsPlacements } from '../src/shards/far-reach/generators/physicsPlacements';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { originalSkyScenes } from './fixtures/sky-scene-source';

const { blobs: SKY_SCENE_BLOBS, scenes: SKY_WORLD_SCENES } = await originalSkyScenes();

const { SKY_GROUND, SKY_GROUND_COLLIDERS } = skyGroundValues();
const PLACEMENTS = skyPhysicsPlacements();

const isMesh = (node: Object3D | undefined): node is Mesh => node instanceof Mesh;

it('source contacts retain the complete original wire after scheduler retirement', () => {
  const bytes = (): Uint8Array => new TextEncoder().encode(`${JSON.stringify(skyPhysicsPlacements())}\n`);
  expect(bytes().byteLength).toBe(15_498);
  expect(hashImmutableBytes(bytes())).toBe('12f4de8259d2a8589352afe3229cd9f90f9f4e94d09ba845dcb420f255b849b4');
  const changed = skyPhysicsPlacements(); changed[0]?.colliders.splice(0);
  expect(hashImmutableBytes(bytes())).toBe('12f4de8259d2a8589352afe3229cd9f90f9f4e94d09ba845dcb420f255b849b4');
});

it('streamed ground pins its complete anchor scene and cold world declaration', () => {
  const ground = SKY_SCENE_BLOBS.find(row => row.file.name === 'world/scenes/ground.json');
  if (ground === undefined) throw new Error('Missing original published ground');
  expect(ground.file).toEqual({ name: 'world/scenes/ground.json',
    path: 'blobs/json/7681a36b74533468e874b8bd2a7da9070cc4ba929e64935e19c3717e11b72d9c.json', kind: 'json',
    hash: '7681a36b74533468e874b8bd2a7da9070cc4ba929e64935e19c3717e11b72d9c', compressed: 1849, decoded: 1849,
    gpu: 0, triangles: 0, draws: 0, critical: false, dependencies: [] });
  expect(hashImmutableBytes(ground.bytes)).toBe(ground.file.hash);
  const world = new TextEncoder().encode(encodeCanonicalJson(SKY_WORLD_SCENES));
  expect(world.byteLength).toBe(313_596);
  expect(hashImmutableBytes(world)).toBe('fbaad205460b7338145a8c31192f8fe2a1ef2f80c9d1c6a04bc419914aca62e9');
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
