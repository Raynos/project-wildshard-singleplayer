import { describe, expect, it } from 'vitest';
import { App, InputService, Scope, type DiscSpot, type TouchRelabel } from '#engine';

describe('additive input contexts', () => {
  it('keeps weapon actions live under a tool and restores lower relabels on pop and disposal', () => {
    const input = new InputService(), scope = new Scope('input');
    let labels: Partial<Record<DiscSpot, TouchRelabel>> = {};
    input.touchSink((next) => { labels = next; }, scope);
    input.register({ id: 'weapon', actions: ['attack', 'lock', 'jump'], touch: { relabel: { lock: { label: 'Lock', tone: 'rest' } } } }, scope);
    input.register({ id: 'grapple', actions: ['lock', 'jump'], blocks: [], touch: { relabel: { lock: { label: 'Grapple', tone: 'ready' } } } }, scope);
    input.push('weapon', scope); input.push('grapple', scope);
    input.press('attack'); expect(input.consume('attack')).toBe(true);
    expect(input.top).toBe('grapple'); expect(labels.lock?.label).toBe('Grapple');
    input.pop('grapple'); expect(labels.lock?.label).toBe('Lock');
    const live = scope.census.disposers;
    for (let i = 0; i < 20; i++) { input.push('grapple', scope); input.pop('grapple'); }
    expect(scope.census.disposers).toBe(live);
    input.push('grapple', scope); scope.dispose(); expect(input.top).toBe(''); expect(labels).toEqual({});
  });
  it('blocks only named actions, while a blocking context can own its own action', () => {
    const input = new InputService(), scope = new Scope('input');
    input.register({ id: 'menu', actions: ['lock'], blocks: ['attack'] }, scope); input.push('menu', scope);
    input.press('attack'); input.press('lock'); expect(input.consume('attack')).toBe(false); expect(input.consume('lock')).toBe(true);
    input.pop('menu'); expect(input.consume('attack')).toBe(true); scope.dispose();
  });
  it('keeps a press for 120 ms and gives it to only the first system that consumes it', () => {
    let now = 0; const input = new InputService(() => now), app = new App(), scope = new Scope('input');
    const calls: string[] = [];
    app.addSystem({ id: 'player', phase: 'input', run: () => { if (input.consume('jump')) calls.push('player'); } }, scope);
    app.addSystem({ id: 'tool', phase: 'input', before: ['player'], run: () => { if (input.consume('jump')) calls.push('tool'); } }, scope);
    input.press('jump'); now = 120;
    for (const system of app.systemsByPhase().input) system.run(0, 0);
    expect(calls).toEqual(['tool']); input.press('jump'); now = 241; expect(input.consume('jump')).toBe(false);
    scope.dispose(); app.engineScope.dispose();
  });
});
