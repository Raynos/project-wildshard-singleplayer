import { expect, test } from 'vitest';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { parseWorldScenes } from '../src/format/worldScenes';
import rows from '../src/shards/pine-hollow/data/props.json' with { type: 'json' };
import baked from '../src/shards/pine-hollow/data/propScenes.generated.json' with { type: 'json' };
import { output } from '../src/shards/pine-hollow/generators/output';
import { MODEL_SCENES, SCENE_MODELS, SCENE_PLACEMENTS } from '../src/shards/pine-hollow/generators/sceneModelRows';

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
    expect([...Float32Array.from(copies.flatMap(row => row.matrix))]).toEqual(group.matrices);
  }
  const placed = SCENE_PLACEMENTS[0]; if (placed === undefined) throw new Error('Missing authored placement');
  expect(() => parseWorldScenes({ ...MODEL_SCENES, placements: [{ ...placed, poses: [{ x: 0, y: 0, z: 0, matrix: [1] }] }] })).toThrow();
  expect(() => parseWorldScenes({ ...MODEL_SCENES, placements: [{ ...placed, callback: () => undefined }] })).toThrow();
});
