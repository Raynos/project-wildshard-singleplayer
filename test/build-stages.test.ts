import { expect, test } from 'vitest';
import { Group } from 'three';
import { BuildStages, type Slice } from '../src/engine/boot/plan';

test('build stages attach and collect before yielding, retaining results and failed-work boundaries', async () => {
  const parent = new Group(), first = new Group(), second = new Group(), values: number[] = [], reports: unknown[][] = [];
  const slice: Slice = Object.assign(async (...args: unknown[]) => {
    reports.push(args);
    expect(parent.children).toEqual([first, second]);
    expect(values).toEqual([3, 5]);
    await Promise.resolve();
  }, { due: () => null });
  const stages = new BuildStages({ slice, total: 2, parent, collect: values });
  const result = { parts: [first, null, second], values: [3, 5] };
  expect(await stages.build('Parts', () => result, { objects: value => value.parts, values: value => value.values })).toBe(result);
  expect(reports).toEqual([[1, 2, 'Parts']]);
  await expect(stages.build('Failed', () => { throw new Error('constructor failed'); })).rejects.toThrow('constructor failed');
  expect(stages.completed).toBe(1);
  await stages.next('Local work');
  expect(reports).toEqual([[1, 2, 'Parts'], [2, 2, 'Local work']]);
  let ran = false;
  const work = (): Group => { ran = true; return new Group(); };
  await expect(stages.build('Overflow', work)).rejects.toThrow('budget exhausted');
  const bare = new BuildStages({ slice });
  await expect(bare.build('No parent', work, { objects: value => [value] })).rejects.toThrow('require a parent');
  await expect(bare.build('No collector', work, { values: () => [] })).rejects.toThrow('require a collector');
  expect(ran).toBe(false);
  await bare.next('Unreported');
  expect(reports.at(-1)).toEqual([]);
  expect(() => new BuildStages({ slice, total: 513 })).toThrow('1..512');
});
