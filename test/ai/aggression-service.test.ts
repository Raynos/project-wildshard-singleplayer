import { describe, expect, it } from 'vitest';
import { AggressionDirector, AggressionService } from '../../src/engine/ai/director';
import { Scope } from '../../src/engine/app/scope';
import { Events } from '../../src/engine/events/events';

describe('aggression policy', () => {
  it('permits exactly two concurrent attackers and returns completed tokens', () => {
    const d = new AggressionDirector<string>(2);
    expect(d.enabled).toBe(true);
    expect(d.take('a')).toBe(true); expect(d.take('b')).toBe(true);
    expect(d.take('a')).toBe(true); expect(d.count).toBe(2);
    expect(d.take('c')).toBe(false); expect(d.free('c')).toBe(false);
    d.sweep((actor) => actor === 'b'); expect(d.count).toBe(1);
    expect(d.take('c')).toBe(true); d.release('b'); d.release('b');
    expect(d.count).toBe(1); d.clear(); expect(d.count).toBe(0);
  });
  it('omitted caps remain unlimited with no finite token pool', () => {
    const d = new AggressionDirector<number>();
    expect(d.enabled).toBe(false);
    for (let actor = 0; actor < 100; actor++) { expect(d.take(actor)).toBe(true); expect(d.free(actor)).toBe(true); }
    expect(d.count).toBe(0); expect(d.max).toBe(Infinity);
  });
  it('rejects invalid authoring and treats zero as a finite cap', () => {
    for (const cap of [-1, 0.5, Number.NaN, -Infinity]) expect(() => new AggressionDirector(cap)).toThrow();
    const d = new AggressionDirector(0); expect(d.enabled).toBe(true); expect(d.take({})).toBe(false);
  });
  it('answers actor policies once across resident scopes and releases disposed holders', () => {
    const root = new Scope('engine'), level = root.child('level'), other = root.child('resident');
    const events = new Events(), service = new AggressionService(events, root), capped = new AggressionDirector<object>(2);
    const a = {}, b = {}, c = {}, uncapped = {};
    for (const actor of [a, b, c]) service.register(actor, capped, level);
    service.register(uncapped, new AggressionDirector(), other);
    expect(events.census().answerers).toBe(2);
    expect(events.ask('ai.claim', a)).toBe(true); expect(events.ask('ai.claim', b)).toBe(true);
    expect(events.ask('ai.mayAttack', c)).toBe(false); expect(events.ask('ai.claim', c)).toBe(false);
    expect(events.ask('ai.claim', uncapped)).toBe(true); expect(capped.count).toBe(2);
    level.dispose(); expect(capped.count).toBe(0); expect(events.ask('ai.claim', a)).toBe(true);
    root.dispose(); expect(events.census().answerers).toBe(0);
  });
});
