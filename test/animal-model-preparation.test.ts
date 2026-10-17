import { afterEach, expect, test, vi } from 'vitest';
import { AnimalFactory, type AnimalModel } from '../src/engine/entities/AnimalFactory';
import { SkyRig } from '../src/engine/world/skyRig';
import { Scope } from '../src/engine/app/scope';
import { currentOwner } from '../src/engine/app/ownership';
import { pageScope } from '../src/engine/app/resources';
import { app } from '../src/engine/app/runtime';

const models = new Set<AnimalModel>(), owners: Scope[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const owner of owners.splice(0)) owner.dispose();
  for (const model of models) { model.geometry.dispose(); for (const material of new Set([model.fur, model.hard, model.eye, ...model.shells])) material.dispose(); }
  models.clear();
});
function factory(): AnimalFactory {
  const sky: unknown = Object.create(SkyRig.prototype);
  if (!(sky instanceof SkyRig)) throw new Error('Missing test sky');
  vi.spyOn(sky, 'setupMaterial').mockImplementation(() => undefined);
  vi.spyOn(app.species, 'preloads').mockReturnValue([]);
  return new AnimalFactory(sky, { style: 'toon', render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true } });
}

test('prepares exact cached variants in the calling owner across spent frame slices', async () => {
  const direct = factory(), prepared = factory(), owner = new Scope('model-preparation'); owners.push(owner);
  const rows = [{ kind: 'bear', variant: 'brown' }, { kind: 'bear', variant: 'black' }, { kind: 'bear', variant: 'brown' }], contexts: (Scope | null)[] = [];
  const build = prepared.model.bind(prepared);
  vi.spyOn(prepared, 'model').mockImplementation((kind, variant) => { contexts.push(currentOwner()); const model = build(kind, variant); models.add(model); return model; });
  const timeout = vi.spyOn(pageScope, 'timeout');
  let at = 0; vi.spyOn(performance, 'now').mockImplementation(() => { at += 10; return at; });
  await owner.run(() => prepared.prepareModels(rows));
  expect(contexts).toEqual([owner, owner, owner]);
  expect(timeout.mock.calls.length).toBeGreaterThanOrEqual(rows.length);
  for (const row of rows) {
    const expected = direct.model(row.kind, row.variant), actual = prepared.model(row.kind, row.variant); models.add(expected);
    expect(prepared.model(row.kind, row.variant)).toBe(actual);
    expect(actual.bones).toEqual(expected.bones); expect(actual.dims).toEqual(expected.dims);
    expect(actual.geometry.groups).toEqual(expected.geometry.groups);
    expect(Object.keys(actual.geometry.attributes)).toEqual(Object.keys(expected.geometry.attributes));
    for (const [key, attribute] of Object.entries(expected.geometry.attributes)) expect(actual.geometry.getAttribute(key).array).toEqual(attribute.array);
    expect(actual.geometry.index?.array).toEqual(expected.geometry.index?.array);
  }
});

test('retiring the owner during a pending slice refuses further model construction', async () => {
  const prepared = factory(), owner = new Scope('retired-model-preparation'); owners.push(owner);
  const build = vi.spyOn(prepared, 'model');
  let at = 0; vi.spyOn(performance, 'now').mockImplementation(() => { at += 10; return at; });
  const pending = owner.run(() => prepared.prepareModels([{ kind: 'elk' }])); owner.dispose();
  await expect(pending).rejects.toThrow('owner closed');
  expect(build).not.toHaveBeenCalled();
  await expect(prepared.prepareModels(Array.from({ length: 1025 }, () => ({ kind: 'elk' })))).rejects.toThrow('Excessive');
});

test('prepares all potential variants when authored placement leaves the manager to roll', async () => {
  const prepared = factory(), owner = new Scope('rolled-model-preparation'); owners.push(owner);
  const build = prepared.model.bind(prepared), variants: (string | undefined)[] = [];
  vi.spyOn(prepared, 'model').mockImplementation((kind, variant) => { variants.push(variant); const model = build(kind, variant); models.add(model); return model; });
  await owner.run(() => prepared.prepareModels([{ kind: 'bear', variant: null }]));
  expect(variants).toEqual(['black', 'black-blaze', 'brown', 'black-old', 'brown-old']);
  const before = variants.length;
  for (const variant of ['black', 'brown-old']) {
    const model = prepared.model('bear', variant); expect(prepared.model('bear', variant)).toBe(model);
  }
  expect(variants.slice(before)).toEqual(['black', 'black', 'brown-old', 'brown-old']);
});
