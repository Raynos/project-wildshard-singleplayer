import { describe, expect, it, vi } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { Events, EVENT_FLUSH_LIMIT } from '../../src/engine/events/events';
import type { Tag } from '../../src/engine/events/maps';
import { hasTag } from '../../src/engine/events/tags';

declare module '../../src/engine/events/maps' {
  interface EventMap { 'test.value': number; 'test.next': number }
  interface AskMap { 'test.modify': [number, number] }
  interface TagMap { 'test': true; 'test.child': true; 'test.child.deep': true; 'testing.child': true }
}

describe('events and asks', () => {
  it('queues until an explicit phase boundary, in emit order and listener order', () => {
    const events = new Events(), scope = new Scope('test'), log: string[] = [];
    events.on('test.value', (value) => { log.push(`late:${String(value)}`); }, scope, { order: 2 });
    events.on('test.value', (value) => { log.push(`first:${String(value)}`); }, scope, { order: -1 });
    events.on('test.value', (value) => { log.push(`second:${String(value)}`); }, scope, { order: -1 });
    events.emit('test.value', 1);
    events.emit('test.value', 2);
    expect(log).toEqual([]);
    events.flush('input');
    expect(log).toEqual(['first:1', 'second:1', 'late:1', 'first:2', 'second:2', 'late:2']);
    events.emit('test.value', 3);
    expect(log).toHaveLength(6);
    events.flush('fixed.step');
    expect(log.slice(-3)).toEqual(['first:3', 'second:3', 'late:3']);
    scope.dispose();
  });

  it('drains recursive emits in the same phase, deferring listeners added during dispatch', () => {
    const events = new Events(), scope = new Scope('test'), log: number[] = [];
    events.on('test.value', (value) => {
      log.push(value);
      events.on('test.value', () => { log.push(99); }, scope);
      events.emit('test.next', value + 1);
      events.flush('render');
    }, scope);
    events.on('test.next', (value) => { log.push(value); }, scope);
    events.emit('test.value', 1);
    events.flush('update');
    expect(log).toEqual([1, 2]);
    scope.dispose();
  });

  it('reports one fault after 1,000 events and drops runaway emissions, including fault-handler emissions', () => {
    const events = new Events(), scope = new Scope('test'), faults = vi.fn();
    let calls = 0;
    events.on('test.value', (value) => { calls++; events.emit('test.value', value + 1); }, scope);
    events.on('fault', (fault) => { faults(fault); events.emit('test.value', 0); }, scope);
    events.emit('test.value', 0);
    events.flush('late');
    expect(calls).toBe(EVENT_FLUSH_LIMIT);
    expect(faults).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ source: 'events', phase: 'late', limit: 1000 }));
    events.flush('render');
    expect(calls).toBe(EVENT_FLUSH_LIMIT);
    scope.dispose();
  });

  it('allows exactly 1,000 events without a fault and recovers after a throwing listener', () => {
    const events = new Events(), scope = new Scope('test'), faults = vi.fn<() => void>(), values = vi.fn<() => void>();
    events.on('fault', faults, scope);
    events.on('test.value', values, scope);
    for (let i = 0; i < 1000; i++) events.emit('test.value', i);
    events.flush('update');
    expect(values).toHaveBeenCalledTimes(1000);
    expect(faults).not.toHaveBeenCalled();
    const throwing = new Scope('throwing');
    events.on('test.next', () => { throw new Error('listener'); }, throwing);
    events.emit('test.next', 1);
    events.emit('test.value', 1000);
    expect(() => events.flush('update')).toThrow('listener');
    throwing.dispose();
    events.flush('late');
    expect(values).toHaveBeenCalledTimes(1001);
    scope.dispose();
  });

  it('shares the 1,000-event budget across phases of one frame and resets on the next', () => {
    const events = new Events(), scope = new Scope('test'), value = vi.fn<() => void>(), faults = vi.fn<() => void>();
    events.on('test.value', value, scope); events.on('fault', faults, scope);
    events.beginFrame();
    for (let i = 0; i < 600; i++) events.emit('test.value', i);
    events.flush('input');
    for (let i = 0; i < 600; i++) events.emit('test.value', i);
    events.flush('update');
    expect(value).toHaveBeenCalledTimes(1000); expect(faults).toHaveBeenCalledTimes(1);
    events.beginFrame(); events.emit('test.value', 1); events.flush('late');
    expect(value).toHaveBeenCalledTimes(1001);
    scope.dispose();
  });

  it('chains asks synchronously by order, returning the initial value without answerers', () => {
    const events = new Events(), scope = new Scope('test');
    expect(events.ask('test.modify', 3)).toBe(3);
    events.answer('test.modify', (value) => value * 2, scope, { order: 1 });
    events.answer('test.modify', (value) => value + 1, scope, { order: 0 });
    events.answer('test.modify', (value) => value + 10, scope, { order: 1 });
    expect(events.ask('test.modify', 3)).toBe(18);
    scope.dispose();
    expect(events.ask('test.modify', 3)).toBe(3);
  });

  it('unsubscribes during dispatch and ignores registrations on disposed scopes', () => {
    const events = new Events(), scope = new Scope('test'), other = new Scope('other'), observed = vi.fn<() => void>();
    events.on('test.value', () => other.dispose(), scope, { order: -1 });
    events.on('test.value', observed, other);
    events.emit('test.value', 1);
    events.flush('update');
    events.on('test.value', observed, other);
    events.answer('test.modify', (value) => { observed(); return value; }, other);
    events.emit('test.value', 2);
    events.flush('render');
    expect(events.ask('test.modify', 4)).toBe(4);
    expect(observed).not.toHaveBeenCalled();
    scope.dispose();
  });
});

describe('tag matching', () => {
  it('matches exact tags and descendants at dot boundaries', () => {
    const tags = new Set<Tag>(['test.child.deep', 'testing.child']);
    expect(hasTag(tags, 'test.child.deep')).toBe(true);
    expect(hasTag(tags, 'test.child')).toBe(false);
    expect(hasTag(tags, 'test.*')).toBe(true);
    expect(hasTag(tags, 'test.child.*')).toBe(true);
    expect(hasTag(new Set<Tag>(['test', 'testing.child']), 'test.*')).toBe(false);
    expect(hasTag(tags, 'missing.*')).toBe(false);
  });
});
