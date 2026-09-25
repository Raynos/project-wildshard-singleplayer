// src/core/faults.ts (E133): the frame loop's fault isolation. The harness below is Game.ts's loop in miniature — each
// system in its own try/catch, a throw handed to systemFault — so the tests drive the same counters the game does.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FAULT_BURST, FAULT_STREAK, FAULT_WINDOW_MS, describeError, DescribedError, loopState, makeSystem, onFault, recordFault, setLoopState, systemFault, type Fault, type GameSystem } from '../src/core/faults';

type Fn = (dt: number) => void;
interface Harness { systems: GameSystem<Fn>[]; frame: number; now: number; dead: boolean; faults: Fault[]; tick: (n?: number, stepMs?: number) => void }

function harness(...systems: GameSystem<Fn>[]): Harness {
  const h: Harness = {
    systems, frame: 0, now: 0, dead: false, faults: [],
    tick(n = 1, stepMs = 16) {
      for (let i = 0; i < n && !h.dead; i++) {
        h.frame++; h.now += stepMs;
        for (const s of h.systems) {
          if (!s.on) continue;
          try { s.fn(1 / 60); } catch (e) { if (systemFault(s, e, h.frame, h.now) === 'fatal') h.dead = true; }
        }
      }
    },
  };
  return h;
}

let off: (() => void) | null = null;
function listen(h: Harness): void { off = onFault((f) => { h.faults.push(f); }); }
afterEach(() => { off?.(); off = null; vi.restoreAllMocks(); });
const quiet = (): void => { vi.spyOn(console, 'error').mockImplementation(() => undefined); vi.spyOn(console, 'warn').mockImplementation(() => undefined); };

describe('fault isolation', () => {
  it('nothing throws → no fault, every system runs every frame', () => {
    let a = 0, b = 0;
    const h = harness(makeSystem<Fn>(() => { a++; }, 'a', false, 'x'), makeSystem<Fn>(() => { b++; }, 'b', false, 'x'));
    listen(h);
    h.tick(100);
    expect([a, b]).toEqual([100, 100]);
    expect(h.faults).toEqual([]);
    expect(h.systems.every((s) => s.on && s.faults === 0 && s.recent === null)).toBe(true); // no burst ring until a throw
  });

  it(`a system that throws ${FAULT_STREAK} frames in a row is switched off; the others keep running`, () => {
    quiet();
    let ran = 0, after = 0;
    const bad = makeSystem<Fn>(() => { throw new Error('crab'); }, 'crabs', false, 'x');
    const h = harness(makeSystem<Fn>(() => { ran++; }, 'before', false, 'x'), bad, makeSystem<Fn>(() => { after++; }, 'after', false, 'x'));
    listen(h);
    h.tick(10);
    expect(bad.on).toBe(false);
    expect(bad.faults).toBe(FAULT_STREAK);
    expect(h.faults.map((f) => f.verdict)).toEqual([...Array.from({ length: FAULT_STREAK - 1 }, () => 'retry'), 'off']);
    expect(h.faults.every((f) => f.system === 'crabs')).toBe(true);
    expect([ran, after]).toEqual([10, 10]);
    expect(h.dead).toBe(false);
  });

  it(`an intermittent thrower is switched off after ${FAULT_BURST} throws inside ${FAULT_WINDOW_MS / 1000} s, not before`, () => {
    quiet();
    let n = 0;
    const flaky = makeSystem<Fn>(() => { if (++n % 2 === 0) throw new Error('flaky'); }, 'flaky', false, 'x');
    const h = harness(flaky);
    h.tick(2 * FAULT_BURST - 1);
    expect(flaky.on).toBe(true); // never twice in a row, only FAULT_BURST - 1 throws so far
    h.tick(1);
    expect(flaky.on).toBe(false);
    expect(flaky.faults).toBe(FAULT_BURST);
  });

  it('rare throws (spread out) never switch a system off', () => {
    quiet();
    const s = makeSystem<Fn>(() => undefined, 'rare', false, 'x');
    for (let i = 0; i < 20; i++) expect(recordFault(s, i * 1000, i * (FAULT_WINDOW_MS / 3))).toBe('retry');
    expect(s.on).toBe(true);
  });

  it('several throws in one frame (fixed steps) count once toward the streak', () => {
    quiet();
    const s = makeSystem<Fn>(() => undefined, 'fixed', false, 'x');
    expect(recordFault(s, 1, 0)).toBe('retry');
    expect(recordFault(s, 1, 1)).toBe('retry');
    expect(recordFault(s, 1, 2)).toBe('retry');
    expect(s.streak).toBe(1);
  });

  it('a core system that keeps throwing is fatal', () => {
    quiet();
    const core = makeSystem<Fn>(() => { throw new Error('physics'); }, 'physics.step', true, 'x');
    const h = harness(core);
    listen(h);
    h.tick(10);
    expect(h.dead).toBe(true);
    expect(h.faults.at(-1)?.verdict).toBe('fatal');
    expect(h.frame).toBe(FAULT_STREAK);
    expect(loopState()).toBe('dead'); // set before the listeners hear the fatal fault (no KEEP PLAYING)
    setLoopState('boot');
  });

  it('labels: given, else the function name, else the fallback', () => {
    function crabs(): void { /* named */ }
    expect(makeSystem(crabs, 'the crabs', false, 'x').label).toBe('the crabs');
    expect(makeSystem(crabs, undefined, false, 'x').label).toBe('crabs');
    expect(makeSystem([(): void => undefined][0], undefined, false, 'update#3').label).toBe('update#3');
  });

  it('a listener that throws never reaches the loop', () => {
    quiet();
    off = onFault(() => { throw new Error('listener'); });
    const s = makeSystem<Fn>(() => undefined, 's', false, 'x');
    expect(() => systemFault(s, new Error('x'), 1, 0)).not.toThrow();
  });

  it('describeError', () => {
    expect(describeError(new TypeError('nope')).message).toBe('TypeError: nope');
    expect(describeError(new DescribedError('Boot: x', 'at y'))).toEqual({ message: 'Boot: x', stack: 'at y' });
    expect(describeError('plain').message).toBe('plain');
    expect(describeError({ a: 1 }).message).toBe('{"a":1}');
  });
});
