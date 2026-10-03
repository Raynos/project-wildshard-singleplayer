// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { InputService, Scope } from '#engine';

// E355 (E323 audit): hold W, open a text box (the horse's name at the rail), release W while it has focus → the walk
// must stop. A key typed into a field never presses an action; its release always lands.
it('releases a key held when a text field took focus, and ignores keys typed into the field', () => {
  const input = new InputService(() => 0), scope = new Scope('text-field-keyup'); input.bindings.reset();
  const field = document.createElement('input'); document.body.append(field);
  try {
    input.register({ id: 'walk', actions: ['move.forward', 'use'], keys: { 'move.forward': ['KeyW'], use: ['KeyE'] } }, scope);
    input.push('walk', scope); input.install(scope);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.held('move.forward')).toBe(true);
    field.focus();
    field.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }));
    expect(input.held('use')).toBe(false);
    field.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
    expect(input.held('move.forward')).toBe(false);
  } finally { field.remove(); scope.dispose(); input.bindings.reset(); }
});
