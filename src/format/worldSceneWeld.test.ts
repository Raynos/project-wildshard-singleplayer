import { expect, test } from 'vitest';
import { parseWorldSceneWeld } from './worldSceneWeld';

test('hydration can reuse an immutable admitted graph without trusting its input', () => {
  const input = { id: 'scene', root: 'root', nodes: [{ kind: 'group', id: 'child', parent: 'root' }] };
  const row = parseWorldSceneWeld(input);
  expect(row).not.toBe(input);
  expect(parseWorldSceneWeld(row)).toBe(row);
  expect(Object.isFrozen(row.nodes)).toBe(true);
  const node = row.nodes[0];
  if (node === undefined) throw new Error('Missing admitted node');
  expect(() => { node.id = 'edited'; }).toThrow(TypeError);
  expect(() => row.placements.push('later')).toThrow(TypeError);
  input.nodes.push({ kind: 'group', id: 'child', parent: 'root' });
  expect(() => parseWorldSceneWeld(input)).toThrow('Unique bounded');
  expect(parseWorldSceneWeld(row)).toBe(row);
  const copy = structuredClone(row);
  copy.nodes.push(node);
  expect(() => parseWorldSceneWeld(copy)).toThrow('Unique bounded');
});

test('frozen lookalikes retain plain-data and numeric topology admission', () => {
  let reads = 0;
  const input = Object.freeze({ id: 'scene', root: 'root', get nodes() { reads++; return []; } });
  expect(() => parseWorldSceneWeld(input)).toThrow('plain JSON');
  expect(reads).toBe(0);
  expect(() => parseWorldSceneWeld(Object.freeze({ id: 'scene', root: 'root', nodes: [{ kind: 'instances', id: 'draw', parent: 'root',
    geometry: { library: 'library', model: 'model' }, material: 'material', sphere: [0, 0, 0, 1],
    capacity: 1, count: 2, matrixWords: Array.from({ length: 16 }, () => 0), instanceSphere: [0, 0, 0, 1] }] }))).toThrow('Unique bounded');
});
