import { expect, test } from 'vitest';
import { InputService, type Action } from './InputService';
import { Scope } from '../app/scope';

function fixture() {
  const scope = new Scope('input-scan'), input = new InputService(() => 10);
  input.register({ id: 'base', actions: ['move.forward', 'sprint', 'skip'],
    keys: { 'move.forward': ['KeyW'], sprint: ['ShiftLeft'], skip: ['*'] } }, scope);
  input.push('base', scope);
  return { input, scope };
}

test('physical, wildcard and manual transitions preserve press and release order', () => {
  const { input, scope } = fixture(), calls: string[] = [];
  try {
    for (const action of ['move.forward', 'sprint', 'skip'] as const) {
      input.bind(action, () => { calls.push(`+${action}`); }, scope);
      input.bindRelease(action, () => { calls.push(`-${action}`); }, scope);
    }
    input.executeCommand({ kind: 'physical', code: 'ShiftLeft', on: true, at: 1 });
    expect(calls).toEqual(['+sprint']);
    input.executeCommand({ kind: 'physical', code: 'KeyW', on: true, at: 2 });
    expect(calls).toEqual(['+sprint', '+move.forward', '+skip']);
    input.setHeld('move.forward', true);
    input.executeCommand({ kind: 'physical', code: 'KeyW', on: false, at: 3 });
    expect(calls.at(-1)).toBe('-skip'); expect(input.held('move.forward')).toBe(true);
    input.setHeld('move.forward', false);
    input.executeCommand({ kind: 'physical', code: 'ShiftLeft', on: false, at: 4 });
    expect(calls.slice(-3)).toEqual(['-skip', '-move.forward', '-sprint']);
    for (let frame = 0; frame < 100; frame++) input.refresh();
    expect(calls).toHaveLength(6);
  } finally { scope.dispose(); }
});

test('every wildcard exclusion stays excluded without suppressing a normal key', () => {
  const { input, scope } = fixture();
  try {
    for (const code of ['Escape', 'ArrowLeft', 'ArrowRight', 'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'AltLeft', 'AltRight']) {
      input.executeCommand({ kind: 'physical', code, on: true, at: 1 });
      expect(input.held('skip')).toBe(false);
      input.executeCommand({ kind: 'physical', code, on: false, at: 2 });
    }
    input.executeCommand({ kind: 'physical', code: 'ArrowUp', on: true, at: 3 });
    expect(input.held('skip')).toBe(true);
  } finally { scope.dispose(); }
});

test('allowed retains its entry snapshot through a reentrant context removal', () => {
  const scope = new Scope('input-allowed'), input = new InputService(() => 1);
  let armed = false;
  input.register({ id: 'blocked', actions: [], blocks: 'below' }, scope);
  input.register({ id: 'top', actions: [], enabled: () => {
    if (armed) { armed = false; input.pop('blocked'); expect(input.allowed('use')).toBe(true); }
    return true;
  } }, scope);
  input.push('blocked', scope); input.push('top', scope);
  try {
    armed = true;
    expect(input.allowed('use')).toBe(false);
    expect(input.allowed('use')).toBe(true);
  } finally { armed = false; scope.dispose(); }
});

test('a reentrant press refresh cannot overwrite the outer transition union', () => {
  const { input, scope } = fixture(), calls: Action[] = [];
  try {
    input.bind('move.forward', () => { calls.push('move.forward'); input.setHeld('sprint', true); }, scope);
    input.bind('sprint', () => { calls.push('sprint'); }, scope);
    input.executeCommand({ kind: 'physical', code: 'KeyW', on: true, at: 1 });
    expect(calls).toEqual(['move.forward', 'sprint']);
    expect(input.held('sprint')).toBe(true); expect(input.held('skip')).toBe(true);
    input.refresh(); expect(calls).toEqual(['move.forward', 'sprint']);
  } finally { scope.dispose(); }
});

test('a failed callback releases scratch while preserving its original down edge', () => {
  const { input, scope } = fixture(); let fail = true; const calls: string[] = [];
  try {
    input.bind('move.forward', () => { calls.push('press'); if (fail) { fail = false; throw new Error('input callback'); } }, scope);
    input.bindRelease('move.forward', () => { calls.push('release'); }, scope);
    expect(() => input.setHeld('move.forward', true)).toThrow('input callback');
    expect(input.held('move.forward')).toBe(true);
    input.setHeld('move.forward', false); input.setHeld('move.forward', true);
    expect(calls).toEqual(['press', 'release', 'press']);
  } finally { scope.dispose(); }
});

test('failed context predicates do not leave old owners in a later allowed scan', () => {
  const { input, scope } = fixture(); let fail = false;
  input.register({ id: 'throws', actions: [], enabled: () => { if (fail) { fail = false; throw new Error('predicate'); } return true; } }, scope);
  input.push('throws', scope);
  try {
    fail = true; expect(() => input.allowed('use')).toThrow('predicate');
    input.pop('throws'); expect(input.allowed('use')).toBe(true);
    input.pop('base'); expect(input.allowed('use')).toBe(true);
  } finally { fail = false; scope.dispose(); }
});
