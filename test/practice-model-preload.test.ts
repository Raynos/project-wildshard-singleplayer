import { afterEach, expect, test, vi } from 'vitest';
import { AnimalFactory } from '../src/engine/entities/AnimalFactory';
import { SkyRig } from '../src/engine/world/skyRig';
import { app } from '../src/engine/app/runtime';
import { speciesWithLook } from '../src/engine/entities/species/look';
import { CRAB } from './fake/driftwoodSpecies';
import { CRAB_LOOK } from '../src/shards/driftwood-isle/species/crab';

afterEach(() => { vi.restoreAllMocks(); });
function sky(): SkyRig {
  const value: unknown = Object.create(SkyRig.prototype);
  if (!(value instanceof SkyRig)) throw new Error('Missing test sky');
  return value;
}

test('selected-kind preparation deduplicates its look and never preloads unrelated resident looks', async () => {
  const selected = vi.fn(() => Promise.resolve()), unrelated = vi.fn(() => Promise.resolve());
  const all = vi.spyOn(app.species, 'preloads').mockReturnValue([unrelated]);
  vi.spyOn(app.species, 'get').mockReturnValue(speciesWithLook(CRAB, CRAB_LOOK));
  vi.spyOn(app.species, 'look').mockReturnValue({ ...CRAB_LOOK, preload: selected });
  const factory = new AnimalFactory(sky(), { style: 'toon', kinds: ['crab', 'crab'] });
  await factory.ready;
  expect(selected).toHaveBeenCalledOnce(); expect(unrelated).not.toHaveBeenCalled(); expect(all).not.toHaveBeenCalled();
  expect(factory.style).toBe('toon');
});

test('ordinary factories keep the existing complete resident preload behavior', async () => {
  const first = vi.fn(() => Promise.resolve()), second = vi.fn(() => Promise.resolve());
  vi.spyOn(app.species, 'preloads').mockReturnValue([first, second]);
  await new AnimalFactory(sky()).ready;
  expect(first).toHaveBeenCalledOnce(); expect(second).toHaveBeenCalledOnce();
});

test('an unknown selected kind fails instead of silently preparing a different model', () => {
  vi.spyOn(app.species, 'get').mockReturnValue(undefined);
  expect(() => new AnimalFactory(sky(), { kinds: ['missing'] })).toThrow('Unknown creature kind');
});
