// oxlint-disable-next-line import/no-nodejs-modules -- The initializer is emitted into the frame-floor helper HTML.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { TASK_CLOCK_SCRIPT } from '../scripts/frame-floor-task-clock.mjs';

interface Take { minMs: number; dropped: number; tasks: [number, number, number, 'e' | 't', string, number][]; sites: string[] }

/** A page with hand-driven task sources: timers run when `runTimer` says, echoes when `drainEchoes` says. */
function page(): { window: { setTimeout: (fn: () => void, ms?: number) => number; __frameFloorTaskTake?: () => Take }; clock: { t: number };
  runTimer: (i: number) => void; drainEchoes: () => void; port: () => FakePort } {
  const clock = { t: 0 }, timers: (() => void)[] = [], echoes: { port: FakePort; data: unknown }[] = [];
  class FakeTarget {
    readonly handlers = new Map<string, ((event: { data: unknown }) => void)[]>();
    addEventListener(type: string, listener: (event: { data: unknown }) => void): void { this.handlers.set(type, [...(this.handlers.get(type) ?? []), listener]); }
    removeEventListener(type: string, listener: (event: { data: unknown }) => void): void { this.handlers.set(type, (this.handlers.get(type) ?? []).filter(l => l !== listener)); }
  }
  class Port extends FakeTarget {
    private handler: ((event: { data: unknown }) => void) | null = null;
    other: Port | null = null;
    get onmessage(): ((event: { data: unknown }) => void) | null { return this.handler; }
    set onmessage(fn: ((event: { data: unknown }) => void) | null) { this.handler = fn; }
    postMessage(data: unknown): void { if (this.other !== null) echoes.push({ port: this.other, data }); }
    deliver(data: unknown): void { this.handler?.({ data }); for (const l of this.handlers.get('message') ?? []) l({ data }); }
  }
  class Channel { readonly port1 = new Port(); readonly port2 = new Port(); constructor() { this.port1.other = this.port2; this.port2.other = this.port1; } }
  const window: { setTimeout: (fn: () => void, ms?: number) => number; __frameFloorTaskTake?: () => Take } = {
    setTimeout: (fn) => timers.push(fn),
  };
  runInNewContext(TASK_CLOCK_SCRIPT, { window, performance: { now: () => clock.t }, MessageChannel: Channel, MessagePort: Port, EventTarget: FakeTarget });
  return {
    window, clock,
    runTimer: (i) => { const fn = timers[i]; if (fn === undefined) throw new Error('No such timer'); fn(); },
    drainEchoes: () => { for (const { port, data } of echoes.splice(0)) port.deliver(data); },
    port: () => new Port(),
  };
}
interface FakePort { addEventListener: (type: string, l: (event: { data: unknown }) => void) => void; deliver: (data: unknown) => void }

it('keeps each task\'s exact callback time apart from its bounded total and the site that scheduled it', () => {
  const p = page();
  p.window.setTimeout(() => { p.clock.t += 6; });
  p.clock.t = 100; p.runTimer(0);
  p.clock.t += 14; // the continuation's microtasks
  p.drainEchoes();
  const take = p.window.__frameFloorTaskTake?.();
  expect(take?.tasks).toEqual([[100, 6, 20, 'e', 'timeout', 0]]);
  expect(take?.sites[0]).not.toBe('');
  expect(p.window.__frameFloorTaskTake?.().tasks).toEqual([]);
});

it('closes a task when the next one starts, and a late echo never closes the newer task', () => {
  const p = page();
  p.window.setTimeout(() => { p.clock.t += 5; });
  p.window.setTimeout(() => { p.clock.t += 9; });
  p.clock.t = 10; p.runTimer(0); // its echo is still queued
  p.clock.t = 20; p.runTimer(1);
  p.drainEchoes(); // both echoes: the first is stale
  p.clock.t = 50;
  const take = p.window.__frameFloorTaskTake?.();
  expect(take?.tasks).toEqual([[10, 5, 10, 't', 'timeout', 0], [20, 9, 9, 'e', 'timeout', 1]]);
});

it('times message listeners and drops short tasks', () => {
  const p = page(), port = p.port();
  port.addEventListener('message', () => { p.clock.t += 2; });
  p.clock.t = 0; port.deliver(1); p.drainEchoes();
  port.addEventListener('message', () => { p.clock.t += 30; });
  p.clock.t = 100; port.deliver(2); p.drainEchoes();
  const take = p.window.__frameFloorTaskTake?.();
  expect(take?.tasks.map(task => [task[1], task[4]])).toEqual([[30, 'message']]);
});
