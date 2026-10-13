// sp-o100: a cell screen's content is a pure function of its snapshot row, the whole loading seconds, the near layout and
// the art's readiness; a frame where none of them changed builds no content and stringifies no key.
import { expect, it, vi } from 'vitest';
import { Group } from 'three';
import { Scope } from '../src/engine/app/scope';
import { installCellScreens, type CellScreenInput, type ScreenContext } from '../src/game/grid/cellScreen';
import type { PlatformRenderAdmission } from '../src/game/grid/renderResidency';

const MB = 1e6;
const originalDocument = globalThis.document, originalStorage = globalThis.localStorage;
const base: CellScreenInput = { instance: 'east', slug: 'template', name: 'Template', status: 'loading', refusal: null, wait: null, issue: null, far: 'resident',
  requested: true, product: true, runtime: false, colliders: false, sim: false, claimedBytes: 12 * MB, claims: 3, declaredBytes: 10 * MB, pageBytes: 400 * MB, capBytes: 1000 * MB, overBytes: 0 };
const context = (drawn: string[]): ScreenContext => ({ fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1,
  fillRect: () => undefined, strokeRect: () => undefined, save: () => undefined, restore: () => undefined, translate: () => undefined, scale: () => undefined,
  beginPath: () => undefined, moveTo: () => undefined, lineTo: () => undefined, stroke: () => undefined, drawImage: () => undefined,
  measureText: (value: string) => ({ width: value.length * 10 } as TextMetrics), fillText: (value: string) => { drawn.push(value); } });

it('skips building an unchanged screen and rebuilds on a new row or a new second', () => {
  const drawn: string[] = [], scope = new Scope('cell-screen-inputs');
  const original = globalThis.document;
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context(drawn) }) });
  const admission: PlatformRenderAdmission = { allocate: (plan, build) => build(scope.child(plan.id)) };
  let snapshot = new Map([['east', { ...base }]]), elapsed = 0;
  const stringify = vi.spyOn(JSON, 'stringify');
  try {
    const screens = installCellScreens({ cells: [{ instance: 'east', x: 560, z: 0, art: null }], wall: 256, scene: new Group(), admission, time: () => elapsed,
      build: 'b', tier: 'phone', ports: { read: () => snapshot, feet: () => ({ x: 270, z: 10 }) } });
    screens.step();
    const first = stringify.mock.calls.length;
    expect(first).toBeGreaterThan(0); expect(screens.state().draws).toBe(1);
    for (let i = 0; i < 11; i++) screens.step(); // the same row is re-read every sixth step: still the same object
    expect(stringify.mock.calls.length).toBe(first); expect(screens.state().draws).toBe(1);
    elapsed = 1.5; screens.step(); // a new whole second repaints the clock
    expect(stringify.mock.calls.length).toBeGreaterThan(first); expect(screens.state().draws).toBe(2);
    const second = stringify.mock.calls.length;
    snapshot = new Map([['east', { ...base, runtime: true }]]);
    for (let i = 0; i < 6; i++) screens.step(); // the next read brings a new row with a new stage
    expect(stringify.mock.calls.length).toBeGreaterThan(second); expect(screens.state().draws).toBe(3);
  } finally { stringify.mockRestore(); scope.dispose(); vi.unstubAllGlobals(); vi.stubGlobal('document', original); vi.stubGlobal('localStorage', originalStorage); }
});

// sp-o105: a loading screen's clock ticks every second while the rest holds. The full layout then repaints only the clock's
// rectangle (the whole painter, clipped) and uploads only that rectangle into the same texture; any other change uploads whole.
it('repaints and uploads only the clock rectangle when only the clock changed', async () => {
  const { Texture, Vector2 } = await import('three');
  const { installScopeEnvironment, scopeEnvironment } = await import('../src/engine/app/scopeEnvironment');
  const { noteFrameDrawn, setFramePacing } = await import('../src/engine/core/framePacing');
  const { SCREEN_CLOCK, SCREEN_PX } = await import('../src/game/grid/cellScreen');
  const previous = scopeEnvironment(), scope = new Scope('cell-screen-clock');
  const frames = new Map<number, FrameRequestCallback>(), drawn: string[] = [], clips: number[][] = [];
  const full: unknown[] = [], copies: { src: unknown; dst: unknown; at: unknown }[] = [], stores: number[][] = [];
  let serial = 0, clock = 100_000, elapsed = 0;
  vi.useFakeTimers();
  const time = vi.spyOn(performance, 'now').mockImplementation(() => clock);
  installScopeEnvironment({ ...previous, frame: fn => { const id = ++serial; frames.set(id, fn); return id; }, cancelFrame: id => { frames.delete(id); } });
  const clipped = (): ScreenContext => ({ ...context(drawn), rect: (...r: number[]) => { clips.push(r); }, clip: () => undefined });
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: clipped }) });
  const admission: PlatformRenderAdmission = { allocate: (plan, build) => build(scope.child(plan.id)) };
  let snapshot = new Map([['east', { ...base }]]);
  const paint = (): void => {
    clock += 1000 / 30; noteFrameDrawn(clock, clock, 30);
    const callbacks = [...frames.values()]; frames.clear();
    for (const fn of callbacks) fn(clock);
    vi.runOnlyPendingTimers();
  };
  try {
    setFramePacing(false);
    const screens = installCellScreens({ cells: [{ instance: 'east', x: 560, z: 0, art: null }], wall: 256, scene: new Group(), admission, time: () => elapsed,
      build: 'b', tier: 'phone', ports: { read: () => snapshot, feet: () => ({ x: 270, z: 10 }) },
      renderer: { initTexture: texture => { full.push(texture); }, getContext: () => ({ isContextLost: () => false }),
        copyTextureToTexture: (src, dst, _region, at) => { copies.push({ src, dst, at }); },
        state: { pixelStorei: (name: number, value: number | boolean) => { stores.push([name, Number(value)]); } } } });
    screens.step(); expect(screens.state().draws).toBe(1); expect(clips).toEqual([]); // first appearance: whole, at draw
    setFramePacing(true); noteFrameDrawn(clock, clock, 30);
    drawn.length = 0; elapsed = 1.2; screens.step();
    expect(screens.state().draws).toBe(2); expect(drawn).toContain('00:01');
    expect(clips).toEqual([[SCREEN_CLOCK.x, SCREEN_CLOCK.y, SCREEN_CLOCK.w, SCREEN_CLOCK.h]]);
    paint();
    expect(full).toHaveLength(0); expect(copies).toHaveLength(1);
    expect(copies[0]?.src).toBeInstanceOf(Texture); expect(copies[0]?.at).toEqual(new Vector2(SCREEN_CLOCK.x, SCREEN_PX.h - SCREEN_CLOCK.y - SCREEN_CLOCK.h));
    expect(stores).toEqual([[0x9243, 0]]); // sRGB on a linear-sRGB working space: no conversion, as three's full upload
    // a new stage repaints and uploads whole; a clock tick queued behind it coalesces into that full upload
    snapshot = new Map([['east', { ...base, runtime: true }]]);
    for (let i = 0; i < 6; i++) screens.step();
    elapsed = 2.2; screens.step();
    expect(screens.state().draws).toBe(4); expect(clips).toHaveLength(2);
    paint(); expect(full).toHaveLength(1); expect(copies).toHaveLength(1);
  } finally { scope.dispose(); setFramePacing(false); installScopeEnvironment(previous); time.mockRestore(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.stubGlobal('document', originalDocument); vi.stubGlobal('localStorage', originalStorage); }
});
