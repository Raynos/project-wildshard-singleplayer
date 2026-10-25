import { expect, test } from 'vitest';
import { selectRelatedSuites } from '../scripts/precommit-selection.mjs';

test('nearest importers run before transitive readers, with a stable same-name tie break', () => {
  const sources = new Map([
    ['src/value.ts', 'export const value = 1;'],
    ['src/bridge.ts', 'export {value} from "./value";'],
    ['test/aaa.test.ts', 'import {value} from "../src/value";'],
    ['test/value.test.ts', 'import {value} from "../src/value";'],
    ['test/deeper.test.ts', 'import {value} from "../src/bridge";'],
    ['test/unrelated.test.ts', 'export const unrelated = true;'],
  ]);
  expect(selectRelatedSuites(sources, ['src/value.ts'], [...sources.keys()], 2)).toEqual({
    files: ['test/value.test.ts', 'test/aaa.test.ts'], direct: [],
    nearest: ['test/value.test.ts', 'test/aaa.test.ts'], candidates: 3, omitted: 1,
  });
});

test('all twenty-one staged tests run in addition to the bounded importer selection', () => {
  const sources = new Map([['src/value.ts', 'export const value = 1;'],
    ['test/importer.test.ts', 'import {value} from "../src/value";']]);
  const direct = Array.from({ length: 21 }, (_, i) => `test/direct-${String(i).padStart(2, '0')}.test.ts`);
  for (const file of direct) sources.set(file, 'export const test = true;');
  const result = selectRelatedSuites(sources, [...direct, 'src/value.ts'], [...sources.keys()], 1);
  expect(result.direct).toEqual(direct);
  expect(result.files).toEqual([...direct, 'test/importer.test.ts']);
  expect(result.omitted).toBe(0); expect(result.candidates).toBe(22);
});

test('workspace exports, dynamic imports, emitted JS suffixes and raw assets keep their edges', () => {
  const sources = new Map([
    ['src/engine/package.json', '{"exports":{"./value":"./value.ts"}}'],
    ['src/engine/value.ts', 'export const value = 1;'],
    ['src/sdk/bridge.mts', 'export const load = () => import("@wildshard/engine/value");'],
    ['test/value.test.ts', 'import "../src/sdk/bridge.mjs"; import raw from "../src/scene.as?raw";'],
  ]);
  const paths = [...sources.keys(), 'src/scene.as'];
  expect(selectRelatedSuites(sources, ['src/engine/value.ts'], paths).files).toEqual(['test/value.test.ts']);
  expect(selectRelatedSuites(sources, ['src/engine/package.json'], paths).files).toEqual(['test/value.test.ts']);
  expect(selectRelatedSuites(sources, ['src/scene.as'], paths).files).toEqual(['test/value.test.ts']);
});

test('discovery and workspace test configs retain bounded test execution', () => {
  const sources = new Map([
    ['test/root.test.ts', ''], ['src/game/a.test.ts', ''], ['src/sdk/a.test.ts', ''],
  ]);
  expect(selectRelatedSuites(sources, ['vitest.config.ts'], [...sources.keys()], 1).files).toHaveLength(1);
  expect(selectRelatedSuites(sources, ['src/sdk/tsconfig.test.json']).files).toEqual(['src/sdk/a.test.ts']);
  expect(selectRelatedSuites(sources, ['tsconfig.json']).candidates).toBe(3);
});

test('cycles, repeated changed files and deleted tests neither duplicate nor invent suites', () => {
  const sources = new Map([
    ['src/a.ts', 'import "./b";'], ['src/b.ts', 'import "./a";'],
    ['test/a.test.ts', 'import "../src/b";'],
  ]);
  const result = selectRelatedSuites(sources, ['src/a.ts', 'src/a.ts', 'test/deleted.test.ts']);
  expect(result.files).toEqual(['test/a.test.ts']); expect(result.candidates).toBe(1);
  expect(selectRelatedSuites(sources, ['test/a.test.ts', 'test/a.test.ts']).direct).toEqual(['test/a.test.ts']);
  expect(() => selectRelatedSuites(sources, [], [], -1)).toThrow('limit');
});
