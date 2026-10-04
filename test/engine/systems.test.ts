import { describe, expect, it, vi } from 'vitest';
import { App, Scope, PHASES, inState, type SystemSpec } from '../../src/engine/index';

function system(id: string, overrides: Partial<SystemSpec> = {}): SystemSpec {
  return { id, phase: 'update', run: vi.fn<() => void>(), ...overrides };
}
function ids(app: App): string[] { return app.systemsByPhase().update.map((spec) => spec.id); }

describe('system registry', () => {
  it('orders dependencies while preserving registration order among ready systems', () => {
    const app = new App(), scope = new Scope('test');
    app.addSystem(system('a', { after: ['c'] }), scope);
    app.addSystem(system('b'), scope);
    app.addSystem(system('c', { before: ['d'] }), scope);
    app.addSystem(system('d'), scope);
    expect(ids(app)).toEqual(['b', 'c', 'a', 'd']);
    scope.dispose();
  });

  it('keeps unconstrained ties stable, and exposes every phase', () => {
    const app = new App(), scope = new Scope('test');
    for (const id of ['c', 'a', 'b']) app.addSystem(system(id), scope);
    app.addSystem(system('input', { phase: 'input' }), scope);
    expect(ids(app)).toEqual(['c', 'a', 'b']);
    expect(Object.keys(app.systemsByPhase())).toEqual(PHASES);
    expect(app.systemsByPhase().input.map((spec) => spec.id)).toEqual(['input']);
    scope.dispose();
  });

  it('names the cycle rather than its downstream dependents, and rolls back the rejected registration', () => {
    const app = new App(), scope = new Scope('test');
    app.addSystem(system('tail', { after: ['b'] }), scope);
    app.addSystem(system('a', { after: ['b'] }), scope);
    expect(() => app.addSystem(system('b', { after: ['a'] }), scope)).toThrow('a -> b -> a');
    expect(ids(app)).toEqual(['tail', 'a']);
    expect(() => app.addSystem(system('self', { before: ['self'] }), scope)).toThrow('self -> self');
    scope.dispose();
  });

  it('rejects globally duplicate ids and deduplicates repeated edges', () => {
    const app = new App(), scope = new Scope('test');
    app.addSystem(system('a', { before: ['b', 'b'] }), scope);
    app.addSystem(system('b', { after: ['a'] }), scope);
    expect(ids(app)).toEqual(['a', 'b']);
    expect(() => app.addSystem(system('a', { phase: 'render' }), scope)).toThrow('Duplicate system id: a');
    scope.dispose();
  });

  it('orders each phase independently and leaves unresolved ids available for later registrations', () => {
    const app = new App(), scope = new Scope('test');
    app.addSystem(system('a', { after: ['b', 'future'] }), scope);
    app.addSystem(system('b', { phase: 'render', after: ['a'] }), scope);
    expect(ids(app)).toEqual(['a']);
    app.addSystem(system('future'), scope);
    expect(ids(app)).toEqual(['future', 'a']);
    scope.dispose();
  });

  it('removes only the disposing scope and supports a second load without duplicate systems', () => {
    const app = new App(), engine = new Scope('engine');
    const persistent = system('engine');
    app.addSystem(persistent, engine);
    for (let i = 0; i < 2; i++) {
      const level = engine.child('level'), run = vi.fn<() => void>();
      app.addSystem(system('level', { run }), level);
      for (const spec of app.systemsByPhase().update) spec.run(1 / 60, i);
      expect(run).toHaveBeenCalledTimes(1);
      level.dispose();
      expect(ids(app)).toEqual(['engine']);
    }
    engine.dispose();
    expect(ids(app)).toEqual([]);
    app.addSystem(system('closed'), engine);
    expect(ids(app)).toEqual([]);
  });

  it('provides live run conditions and copies dependency arrays', () => {
    const app = new App(), scope = new Scope('test');
    const condition = inState('play', 'practice');
    expect(condition(app)).toBe(false);
    app.setState('play');
    expect(condition(app)).toBe(true);
    app.setState('paused');
    expect(condition(app)).toBe(false);
    const after = ['b'];
    app.addSystem(system('a', { after, when: condition, tick: 'ai', core: true }), scope);
    after.length = 0;
    app.addSystem(system('b'), scope);
    expect(ids(app)).toEqual(['b', 'a']);
    scope.dispose();
  });
});
