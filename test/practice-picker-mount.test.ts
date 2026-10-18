// @vitest-environment happy-dom
import { afterEach, expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { TrainingArena } from '../src/engine/practice/TrainingArena';
import { app } from '../src/engine/app/runtime';
import { installPracticePicker } from '../src/game/practice/PracticePicker';
import { setDev } from '../src/engine/core/devMode';

afterEach(() => { document.body.replaceChildren(); app.setState('title'); setDev(false); });

test('the cross-mode picker mounts beside Explore, outside the fixed HUD, and remains scope-owned', () => {
  const hud = document.createElement('div'); hud.id = 'hud'; document.body.append(hud);
  const arena: unknown = Object.create(TrainingArena.prototype);
  if (!(arena instanceof TrainingArena)) throw new Error('Missing arena fixture');
  Object.defineProperty(arena, 'entered', { value: false });
  const owner = new Scope('picker-test');
  app.setState('explore'); setDev(true);
  owner.run(() => installPracticePicker({ owner, arena, choices: [], load: () => Promise.resolve(null),
    clear: () => undefined, retry: () => undefined, tick: () => undefined }));
  const panel = document.querySelector('.ws-practice-picker');
  expect(panel?.parentElement).toBe(document.body);
  expect(hud.children.length).toBe(0);
  expect(panel?.hasAttribute('hidden')).toBe(false);
  owner.dispose();
  expect(document.querySelector('.ws-practice-picker')).toBeNull();
});
