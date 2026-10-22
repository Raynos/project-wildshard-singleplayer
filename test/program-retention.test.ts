import { expect, test } from 'vitest';
import type { Material } from 'three';
import { createProgramKeeper, pinProgramReferences, RETAINED_PROGRAM_LIMIT, type ProgramReference, type ProgramRenderer } from '../src/engine/render/programRetention';
import { Scope } from '../src/engine/app/scope';
import { legacyDouble } from './fake/FakeGame';
import { selectedBootCell } from '../src/game/grid/bootProgramSelection';

test('one program hold survives source retirement, is idempotent and releases through its material owner', () => {
  const program: ProgramReference = { cacheKey: 'one', usedTimes: 1 }, held = new Map<string, ProgramReference>();
  expect(pinProgramReferences(held, [program, program])).toBe(1);
  expect(program.usedTimes).toBe(2);
  expect(pinProgramReferences(held, [program])).toBe(1);
  program.usedTimes -= 1; // Three retires the original world's material.
  expect(program.usedTimes).toBe(1);
  program.usedTimes += 1; // A later world acquires the same cached native program.
  for (const item of held.values()) item.usedTimes -= 1; // Three disposes the holder material.
  expect(program.usedTimes).toBe(1);
});

test('capacity and invalid cache identities refuse before any program reference changes', () => {
  const full = Array.from({ length: RETAINED_PROGRAM_LIMIT + 1 }, (_, i) => ({ cacheKey: String(i), usedTimes: 1 }));
  const held = new Map<string, ProgramReference>();
  expect(() => pinProgramReferences(held, full)).toThrow('bound');
  expect(held.size).toBe(0); expect(full.every(program => program.usedTimes === 1)).toBe(true);
  const old = { cacheKey: 'one', usedTimes: 1 }; held.set('one', old);
  const other = { cacheKey: 'two', usedTimes: 1 };
  expect(() => pinProgramReferences(held, [other, { cacheKey: 'one', usedTimes: 1 }])).toThrow('reference');
  expect(other.usedTimes).toBe(1); expect(held.size).toBe(1);
});

test('one explicit admitted cell is selected only in Developer; absent and stale picks stay off', () => {
  const rows = [{ instance: 'home', label: 'Home' }, { instance: 'next', label: 'Next' }];
  expect(selectedBootCell(rows, 'next', true)).toBe('next');
  expect(selectedBootCell(rows, 'next', false)).toBeNull();
  expect(selectedBootCell(rows, 'off', true)).toBeNull();
  expect(selectedBootCell(rows, 'stale', true)).toBeNull();
  expect(selectedBootCell(rows, undefined, true)).toBeNull();
});

// G580 T2: a renderer double whose material program maps release their references on disposal, as three's do
function keeperRenderer(programs: ProgramReference[]) {
  const maps = new Map<Material, Map<string, ProgramReference>>();
  const renderer: ProgramRenderer & { readonly properties: { get: (material: Material) => { programs: Map<string, ProgramReference> } } } = { info: { programs }, compile: () => undefined,
    properties: { get: (material: Material) => {
      let held = maps.get(material);
      if (held === undefined) {
        const own = new Map<string, ProgramReference>(); held = own; maps.set(material, own);
        material.addEventListener('dispose', () => { for (const program of own.values()) program.usedTimes -= 1; own.clear(); });
      }
      return { programs: held };
    } } };
  return renderer;
}
const camera = legacyDouble<Parameters<typeof createProgramKeeper>[2]>({}), scene = legacyDouble<Parameters<typeof createProgramKeeper>[3]>({});

test('a kept cell holds its programs past its own release; keeping it again replaces its earlier pin', () => {
  const a = { cacheKey: 'a', usedTimes: 1 }, b = { cacheKey: 'b', usedTimes: 1 }, owner = new Scope('page');
  const keeper = createProgramKeeper(keeperRenderer([a, b]), owner, camera, scene);
  expect(keeper.keep('pine')).toBe(2); expect(a.usedTimes).toBe(2);
  a.usedTimes -= 1; // the cell's world retires its materials: the kept reference keeps the program
  expect(a.usedTimes).toBe(1);
  expect(keeper.keep('pine')).toBe(2); expect(a.usedTimes).toBe(1); expect(b.usedTimes).toBe(2);
  owner.dispose(); expect(a.usedTimes).toBe(0); expect(b.usedTimes).toBe(1);
  expect(keeper.keep('pine')).toBe(0);
});

test('past its limit the oldest cell releases first; a renderer over the limit keeps nothing', () => {
  const programs = [{ cacheKey: 'a', usedTimes: 1 }, { cacheKey: 'b', usedTimes: 1 }], owner = new Scope('page');
  const keeper = createProgramKeeper(keeperRenderer(programs), owner, camera, scene, 2);
  keeper.keep('pine'); programs.splice(0, 2, { cacheKey: 'c', usedTimes: 1 });
  keeper.keep('sky');
  expect(keeper.size).toBe(1); expect(programs[0]?.usedTimes).toBe(2);
  programs.push({ cacheKey: 'd', usedTimes: 1 }, { cacheKey: 'e', usedTimes: 1 });
  expect(keeper.keep('nine')).toBe(0); expect(keeper.size).toBe(1);
  owner.dispose();
});
