import { withPortableMath } from '../src/commons/bake/portableMath';
import { expect, test } from 'vitest';
import { skyIsleProps } from '../src/shards/far-reach/generators/isleProps';
import { skyGroundValues, skyTiledGroundValues } from '../src/shards/far-reach/generators/groundScene';
import { SKY_ISLE_TILES } from '../src/shards/far-reach/generators/islandScenes';
import { SKY_WORLD_TILE_ROWS } from '../src/shards/far-reach/generators/worldTileRows';
import { skyProductRows } from '../src/shards/far-reach/generators/product';
import { originalSkyMovers } from './fixtures/sky-movers';
import { originalSkyNavigation } from './fixtures/sky-navigation';

test('native fine tile nodes retain their receive-shadow flags', () => {
  const baked = withPortableMath(skyIsleProps);
  for (const row of baked.props.tiles) {
    const bytes = baked.assets.get(row.file);
    if (bytes === undefined) throw new Error('Missing native island tile');
    const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(12, true);
    const doc: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)));
    if (typeof doc !== 'object' || doc === null) throw new Error('Expected native GLB');
    const nodes: unknown = Reflect.get(doc, 'nodes');
    if (!Array.isArray(nodes)) throw new Error('Missing tile nodes');
    for (const node of nodes) {
      if (typeof node !== 'object' || node === null) throw new Error('Missing tile node');
      const extras: unknown = Reflect.get(node, 'extras');
      if (typeof extras !== 'object' || extras === null) throw new Error('Missing tile flags');
      if (row.lod === 0) expect(Reflect.get(extras, 'receiveShadow')).toBe(false);
    }
  }
});

test('resident anchors preserve original ground identity, contacts, placement and cosmetic stream', () => {
  const original = skyGroundValues(), tiled = skyTiledGroundValues();
  expect(tiled.SKY_GROUND_COLLIDERS).toEqual(original.SKY_GROUND_COLLIDERS);
  expect({ ...tiled.SKY_GROUND, recipe: null }).toEqual({ ...original.SKY_GROUND, recipe: null });
  for (const row of tiled.SKY_GROUND.isles) {
    const node = tiled.SKY_GROUND.recipe.scene.nodes.find(candidate => candidate.id === `isle.${row.id}`);
    expect(node).toEqual({ kind: 'group', id: `isle.${row.id}`, position: row.at, children: [] });
  }
  expect(tiled.SKY_GROUND.recipe.scene.nodes.some(node => node.kind === 'mesh')).toBe(false);
});

test('fine render ownership is exclusive to tiles; each cold island reads only its own partitions', () => {
  const rows = skyProductRows(originalSkyNavigation(), originalSkyMovers());
  const fineFiles = new Set(rows.tiles.filter(row => row.lod === 0).flatMap(row => row.files));
  expect(rows.library.some(file => fineFiles.has(file))).toBe(false);
  if (rows.props === null) throw new Error('Missing streamed island props');
  expect(rows.props.tiles).toEqual(SKY_WORLD_TILE_ROWS.props.tiles);
  expect(Object.keys(rows.props.materials ?? {}).sort()).toEqual(['isle-coarse', 'isle-paint', 'isle-paint-cut', 'isle-paint-cut-mill']);
  expect(SKY_ISLE_TILES.load).toBe('explorer');
  expect(SKY_ISLE_TILES.models).toHaveLength(12);
  for (const model of SKY_ISLE_TILES.models) {
    expect(model.files.length).toBeGreaterThan(0);
    expect(model.files.length).toBeLessThanOrEqual(4);
    expect(model.files.every(file => fineFiles.has(file))).toBe(true);
  }
});
