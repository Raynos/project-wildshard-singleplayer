import { expect, test } from 'vitest';
import { parseWorldSceneModels, worldSceneModelResources } from './worldSceneModels';
import { parseWorldSceneWeld } from './worldSceneWeld';

const draw = (id: string) => ({ id, library: 'shapes', model: id, material: id });
const graph = (id: string) => parseWorldSceneWeld({ id, root: 'root', nodes: [
  { kind: 'mesh', id: 'external', parent: 'root', geometry: { library: 'shapes', model: id }, material: `outside-${id}`, sphere: [0, 0, 0, 1] },
  { kind: 'cloud', id: 'repeat', parent: 'root', material: `outside-${id}`, seedWords: [], sphere: [0, 0, 0, 1] },
  { kind: 'cloud', id: 'local', parent: 'root', material: 'local', seedWords: [], sphere: [0, 0, 0, 1] },
  { kind: 'cloud', id: 'shadow', parent: 'root', material: '$shadow', seedWords: [], sphere: [0, 0, 0, 1] },
], materials: [
  { id: 'local', kind: 'basic', properties: {}, source: { material: `source-${id}`, maps: [] } },
  { id: 'second-local', kind: 'basic', properties: {}, source: { material: 'local', maps: [] } },
] });

test('resources retain draw, donor and both topology orders without caching owner data', () => {
  const choice = { id: 'default', params: {}, size: [1, 1, 1], colliders: [] };
  const model = { name: 'Shape', file: 'shape.glb', category: 'props', pipeline: 'code', defaults: {} };
  const rows = parseWorldSceneModels({ product: 'fixture', models: [
    { ...model, key: 'parts', id: 'fixture/parts', assembly: 'parts', choices: [{ ...choice, draws: [draw('base')],
      lods: [{ from: 10, draws: [{ ...draw('lod'), attributes: { library: 'shapes', model: 'donor' } }] }] }] },
    { ...model, key: 'scene', id: 'fixture/scene', assembly: 'scene', choices: [{ ...choice, draws: [draw('scene-draw')],
      scene: { knob: 'fixture.topology', false: { phone: graph('a'), desktop: { file: 'late.json' } }, true: { phone: graph('b'), desktop: graph('a') } } }] },
  ] });
  const admitted = [graph('late')], resources = worldSceneModelResources(rows, admitted);
  expect(resources.geometry.map(row => row.model)).toEqual(['base', 'lod', 'scene-draw', 'donor', 'a', 'b', 'a', 'late']);
  expect(resources.materials).toEqual(['base', 'lod', 'scene-draw',
    'outside-a', 'outside-a', 'source-a', 'outside-b', 'outside-b', 'source-b',
    'outside-a', 'outside-a', 'source-a', 'outside-late', 'outside-late', 'source-late']);
  const original = rows.models[0]?.choices[0]?.draws[0];
  if (original === undefined) throw new Error('Missing original draw');
  expect(resources.geometry[0]).toBe(original);
  expect(worldSceneModelResources(rows, admitted)).not.toBe(resources);
  original.material = 'changed';
  expect(worldSceneModelResources(rows, admitted).materials[0]).toBe('changed');
});
