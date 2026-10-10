import { expect, it } from 'vitest';
import { nativeProof } from './native';

it('steps 10,000 real physics, creature, quest and admitted-script ticks without a renderer or DOM', () => {
  expect(nativeProof('headless')).toContain('"ticks":10000');
});
