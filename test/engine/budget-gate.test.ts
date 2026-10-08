import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { Page } from 'playwright';
import { legacyDouble } from '../fake/FakeGame';
import { baselineCeilings } from '../../scripts/parity/budgetCeilings.mjs';
import { budgetChecks, budgetLines, budgetViews } from '../../scripts/parity/budgets.mjs';
import { compare } from '../../scripts/parity/compare.mjs';
import { parseCalibration } from '../../src/engine/render/calibration';
import { syntheticNavigation } from '../../src/engine/calibrate/js';
import { createFindNearestPolyResult, DEFAULT_QUERY_FILTER, findNearestPoly } from 'navcat';
import rawSweep from '../../budgets/calibration/m5-2026-10-01T08-07-18-573Z.json?raw';

const base = { boot: { shard: 'fixture', tier: 'phone', lane: 'm5', renderer: 'ANGLE (Apple, ANGLE Metal Renderer', errors: [], scene: { totals: { batched: 0 } }, render: { programs: 30 }, gpuBytes: { total: 100 * 2 ** 20 } }, poses: { a: { calls: 100, tris: 1000000 } }, spread: { 'poses.a.calls': 2, 'poses.a.tris': 10000, 'boot.gpuBytes.total': 2 ** 20 } };
describe('budget rollout and report', () => {
  it('calibrates actual nearest-poly work on a queryable synthetic tile', () => {
    const nav = syntheticNavigation();
    for (const p of [[0.2, 0, 0.2], [7.2, 0, 7.2]] as [number, number, number][]) expect(findNearestPoly(createFindNearestPolyResult(), nav, p, [1, 2, 1], DEFAULT_QUERY_FILTER).success).toBe(true);
  });
  it('uses the higher baseline lane plus its exact existing band', () => {
    // band = 2 × the recorded spread, no floor on top (E388): calls 110 + 2 × 2, tris 1e6 + 2 × 1e4, 100 MiB + 2 × 1 MiB
    const other = structuredClone(base); other.poses.a.calls = 110;
    expect(baselineCeilings([base, other])).toEqual({ 'fixture.phone.a.draws': 114, 'fixture.phone.a.tris': 1020000, 'fixture.phone.a.programs': 30, 'fixture.phone.a.gpuMB': 102 });
  });
  it('retains boot-wide bytes/programs for a shard without pinned poses', () => {
    expect(baselineCeilings([{ ...base, poses: {} }])).toEqual({ 'fixture.phone.current.programs': 30, 'fixture.phone.current.gpuMB': 102 });
  });
  it('measures current draw and triangle counts when a starter has no camera poses', async () => {
    const render = { calls: 0, triangles: 0 };
    const game = { camera: new THREE.PerspectiveCamera(), level: {}, shardFrame: vi.fn(),
      renderer: { info: { render, programs: [1, 2], reset: (): void => { render.calls = 0; render.triangles = 0; } } },
      composer: { render: (): void => { render.calls += 7; render.triangles += 31; } } };
    const priorWindow: unknown = Reflect.get(globalThis, 'window');
    vi.stubGlobal('window', { __wildshard: { requireWorld: () => ({ game }), budgets: () => ({}) }, __wildshardHarness: { gpuBytes: () => ({ total: 4 * 2 ** 20 }) } });
    const page = legacyDouble<Page>({ evaluate: (fn: (value: unknown) => unknown, value: unknown) => Promise.resolve(fn(value)) });
    try {
      expect(await budgetViews(page)).toEqual({});
      const views = await budgetViews(page, true);
      expect(views).toEqual({ current: { draws: 7, tris: 31, programs: 2, gpuMB: 4 } });
      expect(budgetChecks({ boot: { shard: '_template', tier: 'phone' }, poses: {}, budgets: { current: { derived: { draws: 8, tris: 32 }, observed: views['current'] } } }).every((check) => check.pass)).toBe(true);
    } finally { vi.stubGlobal('window', priorWindow); }
  });
  it('measures the current ceiling even when the new shard also declares standing cameras', async () => {
    const render = { calls: 0, triangles: 0 };
    const game = { camera: new THREE.PerspectiveCamera(),
      level: { capturePoses: () => Promise.resolve({ spawn: { eye: [1, 4, 3], feet: [1, 2.32, 3], yaw: 90, pitch: 0 } }) },
      shardFrame: vi.fn(), renderer: { info: { render, programs: [1], reset: (): void => { render.calls = 0; render.triangles = 0; } } },
      composer: { render: (): void => { render.calls += 9; render.triangles += 53; } } };
    const priorWindow: unknown = Reflect.get(globalThis, 'window');
    vi.stubGlobal('window', { __wildshard: { requireWorld: () => ({ game }), budgets: () => ({ current: {} }) }, __wildshardHarness: { gpuBytes: () => ({ total: 5 * 2 ** 20 }) } });
    const page = legacyDouble<Page>({ evaluate: (fn: (value: unknown) => unknown, value: unknown) => Promise.resolve(fn(value)) });
    try { expect(await budgetViews(page)).toEqual({ current: { draws: 9, tris: 53, programs: 1, gpuMB: 5 } }); }
    finally { vi.stubGlobal('window', priorWindow); }
  });
  it('enforces ceilings even when derived targets are absent', () => {
    const current = { ...base, budgets: { a: { derived: null, ceiling: { draws: 99 } } } };
    expect(budgetChecks(current)[0]).toMatchObject({ observed: 100, limit: 99, pass: false });
    const checked = compare(base, current, { ignore: ['budgets'], pending: [{ shard: 'fixture', fields: ['budgets.*'], expect: null }], quarantine: [{ id: 'fixture/phone/budgets.a.draws' }] });
    expect(checked.rows.find((r) => r.field === 'budgets.a.draws')).toMatchObject({ class: 'D', verdict: 'red', now: 100 });
  });
  it('prefers an explicit ceiling and fails missing/nonfinite observations', () => {
    const current = { ...base, budgets: { a: { derived: { draws: 50 }, ceiling: { draws: 100 } } } };
    expect(budgetChecks(current)[0]?.pass).toBe(true);
    expect(budgetChecks({ ...current, poses: { a: {} } })[0]?.pass).toBe(false);
    expect(budgetChecks({ ...current, poses: { a: { calls: Number.NaN } } })[0]?.pass).toBe(false);
  });
  it('includes the fourth free camera without inventing a standing parity pose', () => {
    const current = { ...base, budgets: { D: { derived: { draws: 100 }, observed: { draws: 101 } } } };
    expect(budgetChecks(current)[0]).toMatchObject({ field: 'budgets.D.draws', observed: 101, pass: false });
  });
  it('prints formula, source and assumption and never publishes the unstable raw fixture', () => {
    const current = { ...base, budgets: { a: { derived: { draws: 50 }, ceiling: { draws: 100 }, formula: { source: 'fixture', assumption: 'phone=M5×10', inputs: { fps: 30 }, expressions: { draws: 'floor(cpu/c_draw)' } } } } };
    expect(budgetLines(current).join('\n')).toContain('floor(cpu/c_draw)');
    expect(budgetLines(current).join('\n')).toContain('phone=M5×10');
    expect(() => parseCalibration(rawSweep)).toThrow('stable');
  });
});
