import { expect, test } from 'vitest';
import { g571HostApprovals } from '../scripts/g571-hosts.mjs';

test('the core fixed-draw approval names only its reviewed bindings', () => {
  const names = g571HostApprovals('.').get('src/game/models/fixedDraws.ts');
  expect(names).toBeInstanceOf(Set);
  expect(names?.has('productFixedDraws')).toBe(true);
  expect(names?.has('productDraws')).toBe(true);
  expect(names?.has('sourceOf')).toBe(false);
});
