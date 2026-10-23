import { afterEach, expect, test, vi } from 'vitest';
import { TIER, initializeTier, frameCapFps, practiceFps, frameProbe } from '../src/engine/core/tier';

const initialTier = TIER, initialLocation = globalThis.location;

afterEach(() => { practiceFps.on = false; frameProbe.uncapped = false; initializeTier(initialTier); vi.stubGlobal('location', initialLocation); });
test.each(['', '?fps=30', '?fps=60'])('frame cap follows auto or explicit capture protocol %s', search => {
  vi.stubGlobal('location', new URL(`https://example.invalid/${search}`));
  initializeTier('phone');
  expect(frameCapFps()).toBe(search === '?fps=60' ? 0 : 30);
  practiceFps.on = true; expect(frameCapFps()).toBe(search === '?fps=60' ? 0 : 60);
  practiceFps.on = false; initializeTier('desktop');
  expect(frameCapFps()).toBe(search === '?fps=30' ? 30 : 0);
  frameProbe.uncapped = true; expect(frameCapFps()).toBe(0);
});


test('headless readers need no browser location or persisted frame-cap pick', () => {
  vi.stubGlobal('location', undefined);
  initializeTier('desktop'); expect(frameCapFps()).toBe(0);
  initializeTier('phone'); expect(frameCapFps()).toBe(30);
});
