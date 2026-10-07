import { expect, it, vi } from 'vitest';
import { Group } from 'three';
import { installSoftWallLook } from '../src/game/grid/softWallLook';

it('keeps unconverted cells closed with an honest waiting message, not a loading bar, and updates after retry', () => {
  const text: string[] = [], scope: (() => void)[] = [];
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ({
    fillRect: () => undefined, strokeRect: () => undefined, save: () => undefined, restore: () => undefined,
    translate: () => undefined, scale: () => undefined, measureText: (value: string) => ({ width: value.length * 15 }),
    fillText: (value: string) => { text.push(value); },
  }) }) });
  let waiting = true, reason: string | null = null, closed = true;
  const scene = new Group();
  try {
    const wall = installSoftWallLook({ scene, scope: { onDispose: fn => { scope.push(fn); } }, time: () => 0,
      edges: [{ instance: 'neighbour', x: 250, z: 0, axis: 'x', halfLength: 250 }],
      ports: { closed: () => closed, feet: () => ({ x: 249, z: 0 }), name: () => 'Neighbour', reason: () => reason,
        waiting: () => waiting ? { line: 'Neighbour · NOT READY FOR GRID', detail: 'ENTER THROUGH SHARD SELECT' } : null }, saveKept: 'YOUR SAVE IS KEPT' });
    wall.step();
    expect(wall.state()).toEqual({ closed: 1, panel: 'neighbour', status: 'waiting' });
    expect(text).toEqual(['NEIGHBOUR · NOT READY FOR GRID', 'ENTER THROUGH SHARD SELECT']);
    const bar = scene.getObjectByName('grid-soft-wall-progress'); if (bar === undefined) throw new Error('Missing progress mesh');
    expect(bar.visible).toBe(false);
    // An actual refusal takes precedence over a format wait and preserves the existing save message.
    reason = 'FAILED SAFETY CHECK'; wall.step();
    expect(wall.state().status).toBe('refused'); expect(text.slice(-2)).toEqual(['FAILED SAFETY CHECK', 'YOUR SAVE IS KEPT']);
    expect(bar.visible).toBe(false);
    // A newly supported / retried neighbour resumes genuine loading; opening its real wall removes the panel.
    waiting = false; reason = null; wall.step();
    expect(wall.state().status).toBe('loading'); expect(text.at(-1)).toBe('LOADING NEIGHBOUR'); expect(bar.visible).toBe(true);
    closed = false; wall.step(); expect(wall.state()).toEqual({ closed: 0, panel: null, status: null });
  } finally { for (const dispose of scope) dispose(); vi.unstubAllGlobals(); }
});
