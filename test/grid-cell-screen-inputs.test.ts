// sp-o100: a cell screen's content is a pure function of its snapshot row, the whole loading seconds, the near layout and
// the art's readiness; a frame where none of them changed builds no content and stringifies no key.
import { expect, it, vi } from 'vitest';
import { Group } from 'three';
import { Scope } from '../src/engine/app/scope';
import { installCellScreens, type CellScreenInput, type ScreenContext } from '../src/game/grid/cellScreen';
import type { PlatformRenderAdmission } from '../src/game/grid/renderResidency';

const MB = 1e6;
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
  } finally { stringify.mockRestore(); scope.dispose(); vi.unstubAllGlobals(); vi.stubGlobal('document', original); }
});
