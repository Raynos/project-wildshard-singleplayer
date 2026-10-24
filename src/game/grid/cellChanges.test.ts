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

test('uninvoked shared methods stop notifying even through retained wrappers', () => {
  let notifications = 0, native = 0;
  const target = { first(): void { native++; }, second(): void { native++; } };
  const stop = onCellMethods(target, ['first', 'second'], () => { notifications++; });
  const first: unknown = Reflect.get(target, 'first'), second: unknown = Reflect.get(target, 'second');
  if (typeof first !== 'function' || typeof second !== 'function') throw new Error('Missing observed methods');
  stop(); stop();
  Reflect.apply(first, target, []); Reflect.apply(second, target, []);
  expect(native).toBe(2); expect(notifications).toBe(0);
});

test('reentrant subscription changes stay local to the selected method', () => {
  const calls: string[] = [];
  const target = { first(): void { calls.push('first'); }, second(): void { calls.push('second'); } };
  let add = true, stopExtra = (): void => undefined;
  const stop = onCellMethods(target, ['first', 'second'], () => {
    calls.push('base');
    if (add) { add = false; stopExtra = onCellMethods(target, ['second'], () => { calls.push('extra'); }); }
  });
  target.first(); target.first(); target.second();
  expect(calls).toEqual(['first', 'base', 'first', 'base', 'second', 'base', 'extra']);
  stop(); stopExtra();
});

test('removing and readding the current listener retains live Set order', () => {
  const calls: string[] = [];
  const target = { run(): void { calls.push('native'); }, untouched(): number { return 0; } };
  const prior = Object.getOwnPropertyDescriptor(target, 'untouched');
  let first = true, stop = (): void => undefined, stopExtra = (): void => undefined;
  const changed = (): void => {
    calls.push('base');
    if (first) {
      first = false;
      stopExtra = onCellMethods(target, ['run'], () => { calls.push('extra'); });
      stop(); stop = onCellMethods(target, ['run'], changed);
    }
  };
  stop = onCellMethods(target, ['run', 'untouched'], changed);
  target.run();
  expect(calls).toEqual(['native', 'base', 'extra', 'base']);
  stopExtra(); stop();
  expect(Object.getOwnPropertyDescriptor(target, 'untouched')).toEqual(prior);
});

test('method installation publishes no callback before defining the wrapper', () => {
  let notifications = 0, native = 0;
  const target: { run: () => void } = new Proxy({ run: (): void => { native++; } }, {
    defineProperty(object, key, descriptor): boolean {
      const value: unknown = descriptor.value;
      if (typeof value === 'function') Reflect.apply(value, object, []);
      return Reflect.defineProperty(object, key, descriptor);
    },
  });
  const stop = onCellMethods(target, ['run'], () => { notifications++; });
  expect(native).toBe(1); expect(notifications).toBe(0);
  target.run(); expect(native).toBe(2); expect(notifications).toBe(1);
  stop(); expect(notifications).toBe(1);
});
