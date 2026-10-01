import { describe, expect, it } from 'vitest';
import { InputService } from '../../src/engine/input/InputService';
import { INPUT_CONTEXTS } from '../../src/game/inputContexts';
import { Bindings } from '../../src/engine/input/bindings';
import { Scope } from '#engine';

describe('the shared input service', () => {
  it('composes ride/tool discs and drops blocked verbs without hiding the weapon', () => {
    const input = new InputService(() => 0), scope = new Scope('input');
    input.register({ id: 'weapon.melee', actions: ['attack'], touch: { relabel: { r0: { label: 'Attack', tone: 'rest' } } } }, scope);
    input.register({ id: 'ride', actions: ['ride.whistle'], touch: { relabel: {}, verbs: { 'verb.1': 'ride.whistle' } } }, scope);
    input.register({ id: 'ride.break', actions: ['lean.left'], blocks: ['attack', 'ride.whistle'] }, scope);
    input.push('weapon.melee', scope); input.push('ride', scope); input.setHeld('attack', true);
    expect(input.held('attack')).toBe(true); expect(input.touchLayout().verbs['verb.1']).toBe('ride.whistle');
    input.push('ride.break', scope); expect(input.held('attack')).toBe(false); expect(input.touchLayout().verbs).toEqual({});
    expect(input.touchLayout().actions).not.toContain('attack'); scope.dispose();
  });
  it('swaps a conflicting key and reloads the global versioned save', () => {
    const keys = { jump: ['Space'], use: ['KeyE'] }, bindings = new Bindings(() => undefined);
    bindings.reset(); bindings.define('test', keys);
    expect(bindings.rebind('test', 'jump', 'KeyE')).toBe('use');
    expect(bindings.keys('test')).toEqual(keys);
    expect(bindings.rebind('test', 'jump', 'KeyE', true)).toBeUndefined();
    const restored = new Bindings(() => undefined); restored.define('test', keys);
    expect(restored.keys('test')).toEqual({ jump: ['KeyE'], use: ['Space'] }); restored.reset();
  });
  it('has no conflicting default keys within a context', () => {
    for (const context of INPUT_CONTEXTS) {
      const seen = new Set<string>();
      for (const codes of Object.values(context.keys ?? {})) for (const code of codes) { expect(seen.has(code), `${context.id}: ${code}`).toBe(false); seen.add(code); }
    }
  });
  it('gives blocked presses only to an allowed owner before the 120ms deadline', () => {
    let now = 0; const input = new InputService(() => now), scope = new Scope('input'); let fired = 0;
    input.register({ id: 'menu', actions: ['back'], blocks: 'below' }, scope);
    input.bind('attack', () => { fired++; }, scope); input.push('menu', scope);
    input.press('attack'); expect(fired).toBe(0); expect(input.consume('attack')).toBe(false);
    input.pop('menu'); now = 120; expect(input.consume('attack')).toBe(true);
    input.press('attack'); now = 241; expect(input.consume('attack')).toBe(false); scope.dispose();
  });
});

it('drops retired saved binding rows while retaining overrides for current actions', () => {
  const original = new Bindings(() => undefined); original.reset();
  original.define('onFoot', { crouch: ['KeyC'], jump: ['Space'] });
  original.rebind('onFoot', 'crouch', 'KeyV'); original.rebind('onFoot', 'jump', 'KeyK');
  const restored = new Bindings(() => undefined); restored.define('onFoot', { jump: ['Space'] });
  expect(restored.keys('onFoot')).toEqual({ jump: ['KeyK'] });
  expect(restored.entries()).toEqual([{ context: 'onFoot', action: 'jump', codes: ['KeyK'] }]);
  restored.reset();
});
it('leaves shared walking and bows without crouch or automatic-shot keys', () => {
  const input = new InputService(() => 0), scope = new Scope('J11-J12');
  for (const context of INPUT_CONTEXTS) input.register(context, scope);
  input.push('onFoot', scope); input.push('weapon.bow', scope);
  expect(input.held('crouch')).toBe(false); expect(input.held('crouch.hold')).toBe(false);
  expect(input.bindings.entries().some((entry) => entry.action === 'crouch' || entry.action === 'crouch.hold')).toBe(false);
  expect(input.bindings.entries().some((entry) => entry.context === 'weapon.bow' && entry.codes.includes('KeyF'))).toBe(false);
  input.setHeld('attack', true); expect(input.held('attack')).toBe(true);
  scope.dispose();
});
