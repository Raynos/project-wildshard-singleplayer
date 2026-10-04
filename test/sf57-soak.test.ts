import { describe, it, expect } from 'vitest';
import catalogue from '../src/game/grid/singleplayer.json' with { type: 'json' };
import { soakRoute, gradeSoak } from '../scripts/soak/route';

const witness = () => ({
  samples: [{ type: 'sample', phase: 'loading', elapsed: -1, footprint: 400_000_000, interval: 400_000_000, gl: { totalBytes: 100_000_000, reconciled: true, unlabelled: 0, accountedBytes: 200_000_000, cycle: 0 } }, ...Array.from({ length: 1841 }, (_, elapsed) => ({ type: 'sample', phase: 'drive', elapsed, footprint: 400_000_000, interval: 400_000_000,
    gl: { totalBytes: 100_000_000, reconciled: true, unlabelled: 0, accountedBytes: 200_000_000, cycle: Math.min(2, Math.floor(elapsed / 600)) } }))],
  windows: [{ start: 0, end: 10 }, { start: 600, end: 610 }, { start: 1200, end: 1210 }],
  seconds: 1800, circuits: 2, evictions: 6, errors: [],
  leak: { disposalErrors: [], scope: { bodies: 0, colliders: 0 }, before: {}, after: { bodies: 0, colliders: 0, listeners: { window: 0 }, timers: { intervals: 0 } } },
  expected: ['template-1'], entries: [{ instance: 'template-1', admitted: true }], crossroads: Array.from({ length: 16 }, (_, index) => String(index)),
});
describe('SF57 honest drive and native memory gate', () => {
  it('visits all catalogue entries and 16 crossroads on roads, with walking entry/exit at actual midpoints', () => {
    const cells = catalogue.grid.cells;
    const route = soakRoute(cells), entries = route.steps.filter((step) => step.kind === 'enter');
    expect(entries.map((step) => step.instance).sort((a, b) => a?.localeCompare(b ?? '') ?? 0)).toEqual(cells.map((cell) => cell.instance).sort((a, b) => a.localeCompare(b)));
    expect(new Set(route.steps.filter((step) => step.kind === 'crossroads').map((step) => step.id)).size).toBe(16);
    let previous = route.reference;
    for (const step of route.steps) {
      expect(step.x === previous.x || step.z === previous.z).toBe(true);
      if (step.kind === 'enter') {
        const cell = cells.find((candidate) => candidate.instance === step.instance);
        if (cell?.cell[0] === undefined || cell.cell[1] === undefined) throw new Error('Route entry has no cell');
        expect(step.x).toBe(cell.cell[0] * 555); expect(step.z - cell.cell[1] * 555).toBe(-225);
      } else if (step.kind !== 'leave') {
        expect([-832.5, -277.5, 277.5, 832.5].includes(step.x) || [-832.5, -277.5, 277.5, 832.5].includes(step.z)).toBe(true);
      }
      previous = step;
    }
    let roadMetres = 0, walkingMetres = 0; previous = route.reference;
    for (const step of route.steps) { const metres = Math.hypot(step.x - previous.x, step.z - previous.z); if (step.kind === 'enter') walkingMetres += metres; else roadMetres += metres; previous = step; }
    // Two complete eviction circuits fit the real 30-minute drive, including slow walks and refused-cell waits.
    expect(roadMetres / 30 + walkingMetres / 4 + 9 * 15 + 20).toBeLessThan(900);
  });
  it('passes only a complete 30-minute native witness with repeated eviction, recovery and leak zero', () => {
    expect(gradeSoak(witness()).gatePass).toBe(true);
    expect(gradeSoak(witness()).ratios[0]).toEqual({ cycle: 1, raw: 2.5, adjusted: 1 });
    for (const patch of [{ seconds: 1799 }, { circuits: 1 }, { evictions: 0 }, { errors: ['WebContent gone'] }, { crossroads: [] }]) expect(gradeSoak({ ...witness(), ...patch }).gatePass).toBe(false);
  });
  it('counts interval highs, refuses missing readings and baseline growth even when the final unload is small', () => {
    const high = witness(); const row = high.samples[20]; if (row === undefined) throw new Error('Missing witness reading'); row.interval = 1_000_000_000; expect(gradeSoak(high).memoryPass).toBe(false);
    const gap = witness(); gap.samples.splice(20, 5); expect(gradeSoak(gap).sampling).toBe(false);
    const drift = witness(); for (const sample of drift.samples) if (sample.elapsed >= 1200) sample.footprint = 431_000_000;
    expect(gradeSoak(drift).recovery).toBe(false);
    const missing = witness(); missing.windows.pop(); expect(gradeSoak(missing).recovery).toBe(false);
    const leak = witness(); leak.leak.after.timers.intervals = 1; expect(gradeSoak(leak).leakZero).toBe(false);
  });
  it('reports a refused runtime cell as M3 incomplete even if its proxy and the memory readings look good', () => {
    const result = gradeSoak({ ...witness(), expected: ['template-1', 'runtime-cell'], entries: [...witness().entries, { instance: 'runtime-cell', admitted: false }] });
    expect(result.memoryPass).toBe(true); expect(result.gatePass).toBe(false); expect(result.refused).toEqual(['runtime-cell']); expect(result.attemptedEveryCell).toBe(true);
  });
  it('allows loop-one warmup, then requires loop-two peak and trough stability', () => {
    const result = witness(); for (const sample of result.samples) if (sample.elapsed < 600) sample.footprint = 350_000_000;
    expect(gradeSoak(result).recovery).toBe(true);
  });
  it('fails WebContent under the cap when labelled GL pushes the playing total over it', () => {
    const result = witness(); for (const sample of result.samples) sample.gl.totalBytes = 650_000_000;
    expect(gradeSoak(result).peakBytes).toBe(1_050_000_000); expect(gradeSoak(result).memoryPass).toBe(false);
    expect(gradeSoak({ ...witness(), rehearsal: true }).gatePass).toBe(false);
    const over = witness(); for (const sample of over.samples) sample.footprint = 422_000_001;
    expect(gradeSoak(over).calibration).toBe(false);
  });
  it('fails a loading-only combined over-cap and an unreconciled/missing GL reading', () => {
    const result = witness(); result.samples.push({ ...result.samples[0], type: 'sample', phase: 'loading', elapsed: -1, footprint: 1_750_000_000, interval: 1_750_000_000,
      gl: { totalBytes: 100_000_000, reconciled: true, unlabelled: 0, accountedBytes: 0, cycle: 0 } });
    expect(gradeSoak(result).loadingPeakBytes).toBe(1_850_000_000); expect(gradeSoak(result).memoryPass).toBe(false);
    expect(gradeSoak({ ...witness(), samples: witness().samples.filter((sample) => sample.phase !== 'loading') }).sampling).toBe(false);
    const broken = witness(); for (const sample of broken.samples) sample.gl.reconciled = false;
    expect(gradeSoak(broken).sampling).toBe(false);
    expect(gradeSoak({ ...witness(), samples: witness().samples.map(({ gl: _gl, ...sample }) => sample) }).memoryPass).toBe(false);
  });
});
