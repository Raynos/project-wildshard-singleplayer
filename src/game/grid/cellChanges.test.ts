import { expect, test } from 'vitest';
import { onCellMethods } from './cellChanges';

test('overlapping method subscriptions restore the exact own and inherited methods', () => {
  class Target {
    value = 0;
    first(amount: number): number { this.value += amount; return this.value; }
    second(): number { return this.value; }
  }
  const target = new Target(), calls: string[] = [];
  const method = Object.getOwnPropertyDescriptor(Target.prototype, 'second');
  if (method === undefined) throw new Error('Missing original method');
  Object.defineProperty(target, 'second', { ...method, writable: false, enumerable: false });
  const prior = Object.getOwnPropertyDescriptor(target, 'second');
  const stopFirst = onCellMethods(target, ['first', 'second', 'value'], () => { calls.push('first'); });
  const firstWrapper: unknown = Reflect.get(target, 'first'), secondWrapper: unknown = Reflect.get(target, 'second');
  const stopSecond = onCellMethods(target, ['second'], () => { calls.push('second'); });
  expect(Reflect.get(target, 'second')).toBe(secondWrapper);
  expect(target.first(3)).toBe(3);
  expect(target.second()).toBe(3);
  expect(calls).toEqual(['first', 'first', 'second']);
  stopFirst(); stopFirst();
  expect(Object.hasOwn(target, 'first')).toBe(false);
  expect(Reflect.get(target, 'first')).toBe(Reflect.get(Target.prototype, 'first'));
  expect(Reflect.get(target, 'first')).not.toBe(firstWrapper);
  expect(Reflect.get(target, 'second')).toBe(secondWrapper);
  target.second();
  expect(calls).toEqual(['first', 'first', 'second', 'second']);
  stopSecond();
  expect(Object.getOwnPropertyDescriptor(target, 'second')).toEqual(prior);
});

test('method notification retains live listener additions and removals', () => {
  const calls: string[] = [], target = { run(): void { calls.push('native'); } };
  let stopLater = (): void => undefined, stopAdded = (): void => undefined;
  const added = (): void => { calls.push('added'); };
  const stopFirst = onCellMethods(target, ['run'], () => {
    calls.push('first'); stopLater();
    stopAdded = onCellMethods(target, ['run'], added);
  });
  stopLater = onCellMethods(target, ['run'], () => { calls.push('later'); });
  target.run();
  expect(calls).toEqual(['native', 'first', 'added']);
  stopFirst(); stopAdded();
  target.run();
  expect(calls).toEqual(['native', 'first', 'added', 'native']);
});

test('method cleanup preserves a later replacement and duplicate key semantics', () => {
  let notifications = 0;
  const original = (): number => 1, replacement = (): number => 2;
  const target = { run: original };
  const stop = onCellMethods(target, ['run', 'run'], () => { notifications++; });
  expect(target.run()).toBe(1); expect(notifications).toBe(1);
  target.run = replacement; stop(); stop();
  expect(target.run).toBe(replacement);
  const stopNew = onCellMethods(target, ['run'], () => { notifications++; });
  expect(target.run()).toBe(2); expect(notifications).toBe(2);
  stopNew(); expect(target.run).toBe(replacement);
});

test('native method failures propagate without publishing a change', () => {
  const failure = new Error('native refusal');
  let notifications = 0;
  const target = { run(): never { throw failure; } };
  const prior = Object.getOwnPropertyDescriptor(target, 'run');
  const stop = onCellMethods(target, ['run'], () => { notifications++; });
  expect(() => target.run()).toThrow(failure); expect(notifications).toBe(0);
  stop(); expect(Object.getOwnPropertyDescriptor(target, 'run')).toEqual(prior);
});
