import { expect, it } from 'vitest';
import { walkingSpeed } from '../../src/engine/player/walk';

it('preserves the page speed arithmetic exactly for crouch, sprint, depth and both scales', () => {
  for (const crouch of [false, true]) for (const sprint of [false, true]) for (const depth of [0, 0.01, 0.3, 0.55, 1])
    for (const move of [0, 0.6, 1, 1.4]) for (const effect of [0, 0.65, 1])
      expect(walkingSpeed(crouch, sprint, depth, move, effect)).toBe((crouch ? 2.2 : sprint ? 7.2 : 4.3) * (1 - 0.55 * depth) * move * effect);
});
