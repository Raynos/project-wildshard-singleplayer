import { expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { InputService } from '../../src/engine/input/InputService';

it('keeps a touch USE gesture unlock before the interaction, once, without unlocking on programmatic actions', () => {
  const scope = new Scope('input'), input = new InputService(() => 0), calls: string[] = [];
  input.firstGesture(() => { calls.push('sample-bed'); }, scope);
  input.bind('use', () => { calls.push('use'); }, scope);
  try {
    input.press('dodge'); input.setHeld('move.forward', true);
    expect(calls).toEqual([]);
    input.pressGesture('use');
    expect(calls).toEqual(['sample-bed', 'use']);
    input.pressGesture('use');
    expect(calls).toEqual(['sample-bed', 'use', 'use']);
  } finally { scope.dispose(); }
});

it('releases an unused gesture callback with its level scope', () => {
  const input = new InputService(() => 0), root = new Scope('input'), level = new Scope('level');
  const calls: string[] = [];
  input.firstGesture(() => { calls.push('sample-bed'); }, level);
  input.bind('use', () => { calls.push('use'); }, root); level.dispose();
  try {
    input.pressGesture('use');
    expect(calls).toEqual(['use']);
  } finally { root.dispose(); }
});
