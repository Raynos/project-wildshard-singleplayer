import { expect, test } from 'vitest';
import { gameplayPointerLock } from '../src/game/session/pointerLockPolicy';

// Entry, resume and note-sheet resume share this policy. Active touch controls must retain absolute
// coordinates even when the browser implements requestPointerLock (including mobile emulation).
test.each([
  { nolock: false, touchActive: false, expected: true },
  { nolock: false, touchActive: true, expected: false },
  { nolock: true, touchActive: false, expected: false },
  { nolock: true, touchActive: true, expected: false },
])('gameplay lock: nolock=$nolock, touch=$touchActive', ({ nolock, touchActive, expected }) => {
  expect(gameplayPointerLock(nolock, touchActive)).toBe(expected);
});
