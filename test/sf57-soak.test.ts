import { describe, it, expect } from 'vitest';
import catalogue from '../src/game/grid/singleplayer.json' with { type: 'json' };
import { soakRoute, soakCatalogue, validateSoakCatalogue, gradeSoak, parseSoakContentCut, soakDuration, soakUnlabelledBytes, soakPhaseByTime, soakDriveBounds } from '../scripts/soak/route';

const cut = { receipt: 'art/fixture/round-1-cut/README.md', sourceRevision: 'a'.repeat(40), approvedBy: 'Jake' as const };
const witness = () => ({
  drive: { start: 0, end: 3640 } as { start: number; end: number } | null,
  samples: [{ type: 'sample', phase: 'loading', elapsed: -1, footprint: 422_000_000, interval: 422_000_000, gl: { totalBytes: 100_000_000, reconciled: true, unlabelled: 0, accountedBytes: 200_000_000, cycle: 0, settled: true } }, ...Array.from({ length: 3641 }, (_, elapsed) => ({ type: 'sample', phase: 'drive', elapsed, footprint: 422_000_000, interval: 422_000_000,
    gl: { totalBytes: 100_000_000, reconciled: true, unlabelled: 0, accountedBytes: 200_000_000, cycle: Math.min(2, Math.floor(elapsed / 600)), settled: true } }))],
  windows: [{ start: 0, end: 10 }, { start: 600, end: 610 }, { start: 1200, end: 1210 }],
  seconds: 3600, circuits: 2, evictions: 6, errors: [],
  leak: { disposalErrors: [], scope: { bodies: 0, colliders: 0 }, before: { events: { listeners: 7, answerers: 5 } }, after: { events: { listeners: 7, answerers: 5 }, bodies: 0, colliders: 0, listeners: { window: 0 }, timers: { intervals: 0 } } },
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
    // Two complete eviction circuits fit the ordinary 30-minute drive, including slow walks and refused-cell waits.
    expect(roadMetres / 30 + walkingMetres / 4 + 9 * 15 + 20).toBeLessThan(900);
  });
  it('uses the production Developer catalogue and refuses DEVSERVER replacements', () => {
    const cells = soakCatalogue(catalogue.grid, 'dev');
    expect(cells).toHaveLength(8); // SF55 fills the SW plot and SF59 the NW plot only in Developer mode
    expect(cells.filter((cell) => cell.slug === '_template')).toHaveLength(1);
    expect(cells.filter((cell) => cell.slug !== '_template')).toHaveLength(7);
    expect(validateSoakCatalogue(cells, cells)).toBe(true);
    for (const slug of ['nine-dragon-stack', '_blender-template']) {
      const wrong = cells.map((cell, index) => index === 0 ? { ...cell, slug, instance: slug } : cell);
      expect(validateSoakCatalogue(wrong, cells)).toBe(false);
    }
  });
  it('loops all crossroads without entering a shard on the separate road-only leg', () => {
    const route = soakRoute(catalogue.grid.cells, 555, 'road');
    expect(route.steps.some((step) => step.kind === 'enter' || step.kind === 'leave')).toBe(false);
    expect(new Set(route.steps.filter((step) => step.kind === 'crossroads').map((step) => step.id)).size).toBe(16);
    const road = { ...witness(), leg: 'road' as const, expected: [], entries: [], evictions: 0 };
    expect(gradeSoak(road).gatePass).toBe(true);
    expect(gradeSoak({ ...road, entries: witness().entries }).memoryPass).toBe(false);
    for (const row of road.samples) if (row.elapsed >= 1200) row.footprint += 31_000_000;
    // Only an explicit picked-cut receipt permits G186 to print drift without gating it.
    for (const row of road.samples) row.gl.accountedBytes = (row.footprint + row.gl.totalBytes - 300_000_000) / 1.11;
    expect(gradeSoak(road).recovery).toBe(false);
    expect(gradeSoak(road).baselineDeltaBytes[0]).toBe(-31_000_000);
    expect(gradeSoak(road).gatePass).toBe(false);
    expect(gradeSoak({ ...road, contentCut: cut }).gatePass).toBe(true);
    expect(gradeSoak({ ...road, contentCut: cut, seconds: 3599 }).gatePass).toBe(false);
  });
  it('enforces both inclusive calibration bounds on settled samples only', () => {
    for (const [footprint, pass] of [[402_000_000, true], [442_000_000, true], [401_999_999, false], [442_000_001, false]] as const) {
      const value = witness(); for (const row of value.samples) row.footprint = footprint;
      expect(gradeSoak(value).calibration).toBe(pass);
    }
    const busy = witness(); for (const row of busy.samples) row.gl.settled = false;
    expect(gradeSoak(busy).calibration).toBe(false);
    const absent = [];
    for (const row of witness().samples) {
      const { settled: _settled, ...gl } = row.gl;
      absent.push({ ...row, gl });
    }
    expect(gradeSoak({ ...witness(), samples: absent }).calibration).toBe(false);
    const negative = witness(); negative.leak.scope.colliders = -1;
    expect(gradeSoak(negative).leakZero).toBe(false);
  });
  it('passes an ordinary 30-minute native witness with repeated eviction and leak zero', () => {
    expect(gradeSoak(witness()).gatePass).toBe(true);
    expect(gradeSoak(witness()).ratios[0]).toEqual({ cycle: 1, raw: 2.61, adjusted: 1.11 });
    expect(gradeSoak({ ...witness(), seconds: 1800 }).gatePass).toBe(true);
    for (const patch of [{ seconds: 1799 }, { circuits: 1 }, { evictions: 0 }, { errors: ['WebContent gone'] }, { crossroads: [] }]) expect(gradeSoak({ ...witness(), ...patch }).gatePass).toBe(false);
  });
  it('accepts reconciled journal GL for memory coverage but requires real settled allocator samples for calibration', () => {
    const value = witness();
    const samples = value.samples.map((row) => ({ ...row, gl: { totalBytes: row.gl.totalBytes,
      reconciled: true, unlabelled: 0, cycle: row.gl.cycle, accountedBytes: null } }));
    const result = gradeSoak({ ...value, samples });
    expect(result.sampling).toBe(true); expect(result.calibration).toBe(false); expect(result.memoryPass).toBe(false);
  });
  it('requires strict picked-cut provenance and retains all remaining gates at minute sixty', () => {
    expect(soakDuration()).toBe(1800); expect(soakDuration(cut)).toBe(3600);
    expect(parseSoakContentCut(cut)).toEqual(cut);
    for (const invalid of [{ ...cut, approvedBy: 'agent' }, { ...cut, receipt: '' }, { ...cut, sourceRevision: 'short' }, { ...cut, extra: true }]) expect(() => parseSoakContentCut(invalid)).toThrow();
    const selected = { ...witness(), contentCut: cut };
    expect(gradeSoak(selected)).toMatchObject({ gatePass: true, requiredSeconds: 3600, contentCut: cut });
    for (const patch of [{ seconds: 3599 }, { errors: ['lost document'] }, { evictions: 0 }]) expect(gradeSoak({ ...selected, ...patch }).gatePass).toBe(false);
  });
  it('counts interval highs, refuses missing readings and reports baseline growth', () => {
    const high = witness(); const row = high.samples[20]; if (row === undefined) throw new Error('Missing witness reading'); row.interval = 1_000_000_000; expect(gradeSoak(high).memoryPass).toBe(false);
    const gap = witness(); gap.samples.splice(20, 5); expect(gradeSoak(gap).sampling).toBe(false);
    const drift = witness(); for (const sample of drift.samples) if (sample.elapsed >= 1200) sample.footprint = 453_000_000;
    expect(gradeSoak(drift).recovery).toBe(false);
    const missing = witness(); missing.windows.pop(); expect(gradeSoak(missing).recovery).toBe(false);
    const leak = witness(); leak.leak.after.timers.intervals = 1; expect(gradeSoak(leak).leakZero).toBe(false);
    expect(gradeSoak({ ...witness(), leak: { ...witness().leak, scope: { ...witness().leak.scope, resources: 1 } } }).leakZero).toBe(false);
    const event = witness(); event.leak.after.events.listeners++; expect(gradeSoak(event).leakZero).toBe(false);
  });
  it('reports a refused runtime cell as M3 incomplete even if its proxy and the memory readings look good', () => {
    const result = gradeSoak({ ...witness(), expected: ['template-1', 'runtime-cell'], entries: [...witness().entries, { instance: 'runtime-cell', admitted: false }] });
    expect(result.memoryPass).toBe(true); expect(result.gatePass).toBe(false); expect(result.refused).toEqual(['runtime-cell']); expect(result.attemptedEveryCell).toBe(true);
  });
  it('prints loop-two peak and trough drift after loop-one warmup', () => {
    const result = witness(); for (const sample of result.samples) if (sample.elapsed < 600) sample.footprint = 350_000_000;
    expect(gradeSoak(result).recovery).toBe(true);
  });
  it('reports partial laps without requiring unvisited peaks or troughs, retaining the cap', () => {
    const value = witness();
    // Loop two spans both poses; the last partial lap has reached only the lower-memory pose.
    for (const sample of value.samples) if (sample.gl.cycle === 1 && sample.elapsed > 610) sample.interval += 80_000_000;
    const partial = gradeSoak(value);
    expect(partial.recovery).toBe(true);
    expect(partial.loops.at(-1)?.complete).toBe(false);
    expect(gradeSoak({ ...value, circuits: 3, windows: [...value.windows, { start: 1800, end: 1810 }] }).recovery).toBe(false);
    const tooHigh = witness();
    for (const sample of tooHigh.samples) if (sample.gl.cycle === 2 && sample.elapsed > 1210) sample.interval += 30_000_001;
    expect(gradeSoak(tooHigh).recovery).toBe(false);
    const tooLow = witness();
    for (const sample of tooLow.samples) if (sample.gl.cycle === 2 && sample.elapsed > 1210) sample.footprint -= 30_000_001;
    expect(gradeSoak(tooLow).recovery).toBe(false);
    const capped = witness();
    for (const sample of capped.samples) if (sample.gl.cycle === 2 && sample.elapsed > 1210) sample.interval = 1_000_000_000;
    expect(gradeSoak(capped).memoryPass).toBe(false);
  });
  it('fails WebContent under the cap when labelled GL pushes the playing total over it', () => {
    const result = witness(); for (const sample of result.samples) sample.gl.totalBytes = 650_000_000;
    expect(gradeSoak(result).peakBytes).toBe(1_072_000_000); expect(gradeSoak(result).memoryPass).toBe(false);
    expect(gradeSoak({ ...witness(), rehearsal: true }).gatePass).toBe(false);
    const over = witness(); for (const sample of over.samples) sample.footprint = 442_000_001;
    expect(gradeSoak(over).calibration).toBe(false);
  });
  it('fails a loading-only combined over-cap and an unreconciled/missing GL reading', () => {
    const result = witness(); result.samples.push({ ...result.samples[0], type: 'sample', phase: 'loading', elapsed: -1, footprint: 1_750_000_000, interval: 1_750_000_000,
      gl: { totalBytes: 100_000_000, reconciled: true, unlabelled: 0, accountedBytes: 0, cycle: 0, settled: true } });
    expect(gradeSoak(result).loadingPeakBytes).toBe(1_850_000_000); expect(gradeSoak(result).memoryPass).toBe(false);
    expect(gradeSoak({ ...witness(), samples: witness().samples.filter((sample) => sample.phase !== 'loading') }).sampling).toBe(false);
    const broken = witness(); for (const sample of broken.samples) sample.gl.reconciled = false;
    expect(gradeSoak(broken).sampling).toBe(false);
    // Unlabelled GL is graded by bytes: a zero-byte create-then-label handle holds nothing; one unlabelled byte fails.
    const unlabelledFirst = (bytes: number) => {
      const run = witness(), first = run.samples[0];
      if (first !== undefined) Object.assign(first.gl, { unlabelled: 1, unlabelledBytes: bytes });
      return run;
    };
    expect(gradeSoak(unlabelledFirst(0)).sampling).toBe(true); expect(gradeSoak(unlabelledFirst(1)).sampling).toBe(false);
    expect(soakUnlabelledBytes({ totalBytes: 1, reconciled: true, unlabelled: 1, accountedBytes: null, cycle: 0, assets: [{ owner: 'unlabelled', bytes: 1 }] })).toBe(1);
    expect(soakUnlabelledBytes({ totalBytes: 1, reconciled: true, unlabelled: 1, accountedBytes: null, cycle: 0, assets: [{ owner: 'engine/scene', bytes: 1 }, { owner: 'unlabelled', bytes: 0 }] })).toBe(0);
    expect(soakUnlabelledBytes({ totalBytes: 1, reconciled: true, unlabelled: 1, accountedBytes: null, cycle: 0 })).toBe(Number.POSITIVE_INFINITY);
    const absent = gradeSoak({ ...witness(), samples: witness().samples.map(({ gl: _gl, ...sample }) => sample) });
    expect(absent.memoryPass).toBe(false); expect(absent.missingGlSamples).toBe(3642);
    expect(Number.isFinite(absent.peakBytes)).toBe(true);
  });
  it('phases each sample by its timestamp against the recorded drive boundaries, not the sampler tag', () => {
    const drive = { start: 100, end: 1811.755 };
    const rows = [{ phase: 'baseline-0', elapsed: 99 }, { phase: 'drive', elapsed: 100 }, { phase: 'settle-1', elapsed: 900 }, { phase: 'drive', elapsed: 1811.755 },
      { phase: 'drive', elapsed: 1811.9 }, { phase: 'settle-3', elapsed: 1812.5 }, { phase: 'unloaded', elapsed: 1813 }, { phase: 'done', elapsed: 1840 }];
    // The late-tagged samples move to `unloaded`; a sample inside the window (end inclusive) keeps its drive tag.
    expect(soakPhaseByTime(rows, drive).map((row) => row.phase)).toEqual(['baseline-0', 'drive', 'settle-1', 'drive', 'unloaded', 'unloaded', 'unloaded', 'done']);
    // Missing or contradictory boundaries refuse rather than guess.
    expect(() => soakPhaseByTime(rows, null)).toThrow('recorded drive boundaries');
    expect(() => soakPhaseByTime([{ phase: 'drive', elapsed: 99 }], drive)).toThrow('before the recorded drive start');
    expect(() => soakPhaseByTime(rows, { start: 10, end: 5 })).toThrow('invalid');
    expect(soakPhaseByTime([{ phase: 'loading', elapsed: 1 }, { phase: 'baseline-0', elapsed: 2 }], null).map((row) => row.phase)).toEqual(['loading', 'baseline-0']);
    expect(soakDriveBounds({ driveStarted: '1970-01-01T00:01:40.000Z', seconds: 1711.755 })).toEqual(drive);
    expect(soakDriveBounds({})).toBeNull();
    expect(() => soakDriveBounds({ driveStarted: '1970-01-01T00:01:40.000Z' })).toThrow('no recorded end');
    expect(() => gradeSoak({ ...witness(), drive: null })).toThrow('recorded drive boundaries');
  });
  it('times a joined sample by the later of its native timestamp and its GL read (gl.at)', () => {
    const drive = { start: 100, end: 1811.755 };
    // 83c719436's road leg: the native half 0.101 s before the end, the GL half 0.067 s after it (teardown, GL 42.9 MB).
    const late = { phase: 'drive', elapsed: 1811.654, gl: { at: 1811.822 } };
    // A sample wholly inside the drive (GL read on either side of the native stamp) keeps its tag.
    const inside = [{ phase: 'drive', elapsed: 900, gl: { at: 900.4 } }, { phase: 'settle-2', elapsed: 1200, gl: { at: 1199.6 } }, { phase: 'drive', elapsed: 1811.7, gl: { at: 1811.755 } }];
    expect(soakPhaseByTime([...inside, late], drive).map((row) => row.phase)).toEqual(['drive', 'settle-2', 'drive', 'unloaded']);
    // No GL half (or a non-finite one) falls back to the native timestamp.
    expect(soakPhaseByTime([{ phase: 'drive', elapsed: 1811.7 }, { phase: 'drive', elapsed: 1811.7, gl: { at: Number.NaN } }], drive).map((row) => row.phase)).toEqual(['drive', 'drive']);
  });
  it('grades a post-teardown sample the sampler still tagged drive as unloaded, so it never sets a lap trough', () => {
    const value = witness(), late = value.samples.at(-1);
    if (late === undefined) throw new Error('Missing witness reading');
    // The teardown freed GL before the tag changed: inside the drive this trough fails rule (b); after the drive's end it is unloaded.
    late.gl.totalBytes = 42_900_000; late.gl.cycle = 2;
    expect(gradeSoak({ ...value, drive: { start: 0, end: 3640 } }).recovery).toBe(false);
    const graded = gradeSoak({ ...value, drive: { start: 0, end: 3639.5 } });
    expect(graded.recovery).toBe(true); expect(graded.gatePass).toBe(true);
  });
});
