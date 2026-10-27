import { array, finite, number, object, parse, pipe, string } from 'valibot';
import { expect, test } from 'vitest';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { parseWorldScenes } from '../src/format/worldScenes';
import { pineProps } from '../src/shards/pine-hollow/generators/bake-pine-props.mjs';
import { pinePropScenes } from '../src/shards/pine-hollow/generators/bake-prop-scenes.mjs';
import { PINE_PREPARED_OUTPUT as output } from './fixtures/pine-program';
import { sceneModelRows } from '../src/shards/pine-hollow/generators/sceneModelRows';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { builtProduct } from './fixtures/builtProduct';
import { PINE_SOURCES } from './fixtures/pine-sources';

const { MODEL_SCENES, SCENE_MODELS, SCENE_PLACEMENTS } = await sceneModelRows(PINE_SOURCES);

// GR8 (97e4918e1f): the props rows are the producer's, not a committed data/props.json
const rows = await pineProps(PINE_SOURCES);
// GR8 G28: the prop scenes are the producer's (bake-prop-scenes.mjs), not a stored propScenes.generated.json
const baked=parse(object({groups:array(object({id:string(),matrices:array(pipe(number(),finite()))}))}),
  { groups: (await pinePropScenes(PINE_SOURCES)).rows.groups });

test('admitted scene rows retain every scatter copy and native Float32 upload', () => {
  const file = output.namedFiles.find(row => row.name === 'models/world-scenes.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing named model catalogue');
  expect(parseWorldSceneModels(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))).toEqual(SCENE_MODELS);
  for (const [id, count] of [['props.rocks', rows.rocks.length], ['props.stumps', rows.stumps.length], ['props.log', rows.logs.length]] as const) {
    const placement = SCENE_PLACEMENTS.find(row => row.id === id);
    expect(placement?.poses).toHaveLength(count);
    expect(placement?.colliders).toBeUndefined();
  }
  for (const group of baked.groups) {
    const model = group.id.startsWith('rock-') ? 'props.rocks' : group.id.startsWith('stump-') ? 'props.stumps' : 'props.log';
    const placement = SCENE_PLACEMENTS.find(row => row.model === model);
    if (placement === undefined) throw new Error('Missing native scatter placement');
    const copies = model === 'props.rocks' ? placement.poses.filter(row => row.params?.['shape'] === Number(group.id.slice('rock-'.length))) : placement.poses;
    expect([...Float32Array.from(copies.flatMap(row => { if (!('matrix' in row)) throw new Error('Scatter pose needs its native matrix'); return row.matrix; }))]).toEqual(group.matrices);
  }
  const placed = SCENE_PLACEMENTS[0]; if (placed === undefined) throw new Error('Missing authored placement');
  expect(() => parseWorldScenes({ ...MODEL_SCENES, placements: [{ ...placed, poses: [{ x: 0, y: 0, z: 0, matrix: [1] }] }] })).toThrow();
  expect(() => parseWorldScenes({ ...MODEL_SCENES, placements: [{ ...placed, callback: () => undefined }] })).toThrow();
});

test('built scene libraries retain every logical reference after hash deduplication', async () => {
  const product = await loadHeadlessProduct(builtProduct('pine-hollow')), scenes = product.section('world/scenes');
  for (const library of scenes.libraries) if (library.kind === 'owned') for (const model of library.models) {
    expect(typeof model.file === 'string' ? product.hasFile(model.file) : product.hasFile(model.file.phone) && product.hasFile(model.file.desktop), `${library.id}/${model.id}`).toBe(true);
  }
  const timber = scenes.libraries.find(row => row.id === 'timbers');
  if (timber?.kind !== 'owned') throw new Error('Missing timber library');
  expect(timber.models).toHaveLength(31); expect(new Set(timber.models.map(row => row.id)).size).toBe(31);
  expect(timber.models.map(row => row.id)).toEqual(expect.arrayContaining(['hollow-log-outer', 'hollow-log-inner', 'hollow-log-rim-0', 'hollow-log-rim-1', 'hollow-log-bed']));
});
