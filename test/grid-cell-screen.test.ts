// G217 (SF18b / SF58): a cell you can't enter wears the full Developer loading screen in 3D, for everyone. The state → screen
// mapping (loading with real stages, waiting for its shardfile, refused with the reason), and the panels: the nearest cells
// only, redrawn only when the text changes, standing at the soft wall facing the traveller, charged as one platform claim.
import { describe, expect, it, vi } from 'vitest';
import { Group, type Mesh } from 'three';
import { Scope } from '../src/engine/app/scope';
import { cellScreenBytes, cellScreenContent, drawCellScreen, installCellScreens, SCREEN_M, type CellScreenInput, type ScreenContext } from '../src/game/grid/cellScreen';
import type { PlatformRenderAdmission, PlatformRenderBytePlan } from '../src/game/grid/renderResidency';

const MB = 1e6;
const base: CellScreenInput = { instance: 'template-1', slug: 'template', name: 'Template', status: 'loading', refusal: null, wait: null, issue: null, far: 'resident',
  requested: true, product: true, runtime: false, colliders: false, sim: false, claimedBytes: 12 * MB, claims: 3, declaredBytes: 10 * MB, pageBytes: 400 * MB, capBytes: 1000 * MB, overBytes: 0 };
const frame = { build: 'abc1234def567', tier: 'phone', elapsedS: 7 };

describe('G217: the cell state maps to the loading screen', () => {
  it('loading: the real stages, the product admitted, the clock and the memory claim', () => {
    const s = cellScreenContent(base, frame);
    expect(s.kicker).toBe('Loading chunk ·'); expect(s.title).toBe('Template'); expect(s.chip).toBe('LOADING'); expect(s.clock).toBe('00:07');
    expect(s.headline).toBeNull();
    expect(s.tracks.map((t) => [t.name, t.pct])).toEqual([['download', 100], ['setup', 25]]);
    expect(s.tracks[0].fact).toBe('product admitted · 10.0 MB declared');
    expect(s.tracks[1].fact).toBe('step 2 / 4 · runtime');
    expect(s.rows.map((r) => [r.label, r.state])).toEqual([['far view', 'ok'], ['admission', 'ok'], ['product', 'ok'], ['runtime', 'on'], ['colliders', 'todo'], ['sim', 'todo'], ['soft wall', 'todo']]);
    expect(s.meta[0]).toEqual(['memory', '12.0 MB claimed · page 400.0 MB / 1000.0 MB']);
    expect(s.meta.slice(1)).toEqual([['tier', 'phone'], ['cell', 'template-1'], ['build', 'abc1234de']]);
    expect(s.build).toBe('BUILD abc1234de');
    // G216: a cell Developer admitted past the envelope shows the full numbers and the overage
    const over = cellScreenContent({ ...base, pageBytes: 1100 * MB, overBytes: 100 * MB }, frame);
    expect(over.meta.slice(0, 2)).toEqual([['memory', '12.0 MB claimed · page 1100.0 MB / 1000.0 MB'], ['over', '+100.0 MB past the envelope · Developer']]);
    expect(s.bar).toBeCloseTo(0.625); expect(s.line).toBe('LOADING · 62%');
    // nothing requested yet: the admission row waits for the traveller, no stage runs
    const queued = cellScreenContent({ ...base, requested: false, product: false, claimedBytes: 0, claims: 0, declaredBytes: 0, far: 'loading' }, { ...frame, elapsedS: 65 });
    expect(queued.clock).toBe('01:05'); expect(queued.tracks[0].fact).toBe('product not requested yet · — declared');
    expect(queued.rows.map((r) => r.state)).toEqual(['on', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
  });
  it('does not report the no-hybrid runtime ready until its product is admitted', () => {
    // Readiness acknowledges an absent hybrid runtime up front; the product still needs admission.
    const pending = cellScreenContent({ ...base, product: false, runtime: true }, frame);
    expect(pending.rows.find((row) => row.label === 'runtime')).toEqual({ label: 'runtime', detail: 'pending', state: 'todo' });
    expect(pending.tracks.map((track) => track.pct)).toEqual([0, 0]);
    expect(pending.tracks[1].fact).toBe('step 1 / 4 · product');
    const admitted = cellScreenContent({ ...base, product: true, runtime: true }, frame);
    expect(admitted.rows.find((row) => row.label === 'runtime')).toEqual({ label: 'runtime', detail: 'ready', state: 'ok' });
    expect(admitted.tracks[1].pct).toBe(50);
    expect(admitted.tracks[1].fact).toBe('step 3 / 4 · colliders');
  });
  it('waiting: no shardfile yet, said plainly, playable through SHARD SELECT, no fake progress', () => {
    const s = cellScreenContent({ ...base, name: 'Nalati Grasslands', status: 'waiting', wait: 'format', product: false, requested: false, issue: 'nalati-grasslands is not a shardfile shard (it stays a far proxy until M3)' }, { ...frame, elapsedS: null });
    expect(s.chip).toBe('WAITING'); expect(s.clock).toBe('--:--');
    expect(s.headline).toBe('Nalati Grasslands · NOT READY FOR GRID'); expect(s.sub).toBe('ENTER THROUGH SHARD SELECT');
    expect(s.tracks.map((t) => t.pct)).toEqual([0, 0]); expect(s.bar).toBe(0); expect(s.line).toBe('PLAY IT THROUGH SHARD SELECT');
    expect(s.rows.map((r) => [r.label, r.detail, r.state])).toEqual([['far view', 'drawn', 'ok'], ['shardfile', 'none yet: converts in M3', 'fail'], ['shard select', 'playable there today', 'ok'], ['soft wall', 'closed until every step is ready', 'todo']]);
    expect(s.diagnostics.join(' ')).toContain('joins the grid in M3');
    expect(cellScreenContent({ ...base, status: 'waiting', wait: 'hybrid' }, frame).rows[1]?.detail).toBe('hybrid runtime: converts in M3');
  });
  it('refused: the reason in the headline and on the stage that failed, the save kept, the admission message in the diagnostics', () => {
    const s = cellScreenContent({ ...base, status: 'refused', refusal: 'too-big', product: false, issue: 'Live sim admission deferred by the shared budget' }, { ...frame, elapsedS: null });
    expect(s.kicker).toBe('Unavailable ·'); expect(s.chip).toBe('REFUSED');
    expect(s.headline).toBe('TEMPLATE · TOO BIG FOR THIS DEVICE'); expect(s.sub).toBe('YOUR SAVE IS KEPT');
    expect(s.rows.find((r) => r.label === 'product')).toEqual({ label: 'product', detail: 'TOO BIG FOR THIS DEVICE', state: 'fail' });
    expect(s.rows.find((r) => r.label === 'soft wall')?.state).toBe('fail');
    expect(s.tracks[0].fact).toBe('product refused · 10.0 MB declared'); expect(s.line).toBe('TOO BIG FOR THIS DEVICE');
    expect(s.diagnostics.slice(1).join(' ')).toBe('Live sim admission deferred by the shared budget'); // wrapped to the column
    // a refusal after the product admitted lands on the next stage
    expect(cellScreenContent({ ...base, status: 'refused', refusal: 'safety', runtime: true }, frame).rows.find((r) => r.state === 'fail')?.label).toBe('colliders');
  });
  it('the near screen retains the live reason and action in large type instead of tiny diagnostics', () => {
    const drawn: string[] = [], g = recorder(drawn);
    const screen = cellScreenContent({ ...base, status: 'waiting', wait: 'format' }, frame);
    drawCellScreen(g, screen, null, true);
    expect(drawn).toContain('TEMPLATE'); expect(drawn).toContain('NOT READY FOR GRID');
    expect(drawn).toContain('ENTER THROUGH SHARD SELECT'); expect(drawn).toContain(screen.build);
    expect(drawn).not.toContain('3 claims · 10.0 MB declared');
  });
  it('the painter draws every line of the screen', () => {
    const drawn: string[] = [], g = recorder(drawn), s = cellScreenContent({ ...base, status: 'refused', refusal: 'load', issue: 'Failed to fetch' }, frame);
    drawCellScreen(g, s, null);
    for (const line of [s.kicker.toUpperCase(), s.title.toUpperCase(), s.chip, s.clock, s.build, s.headline ?? '', s.sub ?? '', s.line, ...s.rows.map((r) => r.detail), ...s.tracks.map((t) => t.fact), ...s.diagnostics]) expect(drawn).toContain(line);
  });
});

function recorder(drawn: string[]): ScreenContext {
  return { fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left', textBaseline: 'alphabetic', globalAlpha: 1,
    fillRect: () => undefined, strokeRect: () => undefined, save: () => undefined, restore: () => undefined, translate: () => undefined, scale: () => undefined,
    beginPath: () => undefined, moveTo: () => undefined, lineTo: () => undefined, stroke: () => undefined, drawImage: () => undefined,
    measureText: (value: string) => ({ width: value.length * 10 } as TextMetrics), fillText: (value: string) => { drawn.push(value); } };
}

describe('G217: the panels in the world', () => {
  it('stand on the nearest unenterable cells at their soft wall facing the traveller, redraw only on change, and are one platform claim', () => {
    const drawn: string[] = [], plans: PlatformRenderBytePlan[] = [], scope = new Scope('cell-screen-test');
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => recorder(drawn) }) });
    const admission: PlatformRenderAdmission = { allocate: (plan, build) => { plans.push(plan); return build(scope.child(plan.id)); } };
    const scene = new Group(), snapshot = new Map<string, CellScreenInput>();
    const cells = [{ instance: 'east', x: 560, z: 0, art: null }, { instance: 'north', x: 0, z: 560, art: null }, { instance: 'far-corner', x: 560, z: 560, art: null }];
    for (const cell of cells) snapshot.set(cell.instance, { ...base, instance: cell.instance });
    let feet = { x: 270, z: 10 }, now = 0;
    try {
      const screens = installCellScreens({ cells, wall: 256, scene, admission, time: () => now, build: 'b', tier: 'desktop', slots: 2, ports: { read: () => snapshot, feet: () => feet } });
      expect(plans).toEqual([{ id: 'cell-screens', ...cellScreenBytes(2) }]);
      expect(cellScreenBytes(2)).toEqual({ jsBytes: 2 * 1024 * 640 * 4, gpuBytes: 2 * Math.ceil(1024 * 640 * 4 * 4 / 3) });
      screens.step();
      expect(screens.state().shown.map((s) => s.instance).sort()).toEqual(['east', 'north']); // the far corner is out of the two slots
      expect(screens.state().draws).toBe(2);
      for (let k = 0; k < 30; k++) screens.step();
      expect(screens.state().draws).toBe(2); // nothing changed: no redraw
      const panels: { position: Mesh['position']; rotation: Mesh['rotation'] }[] = []; scene.traverse((node) => { if (node.name === 'grid-cell-screen' && node.visible) panels.push(node); });
      const east = panels.find((p) => Math.abs(p.position.x - (560 - 256 + 24)) < 1e-6);
      if (east === undefined) throw new Error('No panel on the east cell\'s west wall');
      expect(east.position.y).toBeCloseTo(SCREEN_M.bottom + SCREEN_M.h / 2); expect(east.rotation.y).toBeCloseTo(-Math.PI / 2); // in front of the wall, facing −x, toward the road
      // the clock ticks in whole seconds: one redraw per loading panel per second
      now = 1.2; for (let k = 0; k < 6; k++) screens.step();
      expect(screens.state().draws).toBe(4);
      // At the soft wall the closest panel is still 24 m inside the blocked cell, never face-first on the road.
      feet = { x: 304, z: 10 }; screens.step();
      expect(screens.state().draws).toBe(6); // near layout plus the newly nearest corner, same canvas pool
      for (let k = 0; k < 12; k++) screens.step();
      expect(screens.state().draws).toBe(6);
      expect(east.position.x - feet.x).toBeCloseTo(24);
      // a refusal redraws once; an enterable cell (absent from the port) loses its panel
      snapshot.set('east', { ...base, instance: 'east', status: 'refused', refusal: 'too-big' }); snapshot.delete('north');
      for (let k = 0; k < 6; k++) screens.step();
      expect(screens.state().shown).toEqual([{ instance: 'east', status: 'refused' }, { instance: 'far-corner', status: 'loading' }]);
      expect(drawn).toContain('TEMPLATE'); expect(drawn).toContain('TOO BIG FOR THIS DEVICE');
      feet = { x: 2000, z: 2000 }; for (let k = 0; k < 6; k++) screens.step();
      expect(screens.state().shown).toEqual([]); // out of range
      scope.dispose();
      expect(scene.getObjectByName('grid-cell-screens')).toBeUndefined();
    } finally { vi.unstubAllGlobals(); }
  });
});
