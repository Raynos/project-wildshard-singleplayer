// src/boot/plan.ts + steps.ts + timing.ts — the loading screen's progress invariants (header of plan.ts):
// both fractions are monotone, a running step never reads complete, and done() reads exactly 1 / 1.
import { describe, expect, it, vi } from 'vitest';
import { BOOT_STEPS, BYTE_SOURCES, STEP_INFO, byteLabel, closedBy, shardTimingKey, useShardSteps, type BootStep, type ByteKey } from '../src/boot/steps';
import { createBootPlan, formatMB, runDirect, type Plan, type PlanOptions, type ProgressView, type StepProgress } from '../src/boot/plan';
import { expectedDurations, loadTimings, saveTimings, type Timings } from '../src/boot/timing';

type Totals = PlanOptions['totals'];
const totals = (bytes: number, files = 2): Totals => {
  const out = {} as Record<ByteKey, { bytes: number; files: number }>;
  for (const k of BYTE_SOURCES) out[k] = { bytes, files };
  return out;
};
const flatExpected = (ms: number): Record<BootStep, number> => {
  const out = {} as Record<BootStep, number>;
  for (const k of BOOT_STEPS) out[k] = ms;
  return out;
};

/** A plan on a fake clock that records every published view. */
function harness(opts: Partial<PlanOptions> = {}) {
  let t = 0;
  const views: ProgressView[] = [];
  const record = vi.fn<(m: Timings) => void>();
  const plan = createBootPlan((v) => { views.push(v); }, { totals: totals(1000), now: () => t, expected: flatExpected(100), record, schedule: null, ...opts });
  return { plan, views, record, advance: (ms: number) => { t += ms; } };
}

type Work = (key: BootStep, p: StepProgress) => void | Promise<void>;
/** Runs every step in declared order through the typed chain (as main.ts does), so `done` is callable at the end. */
async function runAll(plan: Plan<BootStep>, work: Work): Promise<Plan<never>> {
  const w = (key: BootStep) => (p: StepProgress) => work(key, p);
  const p1 = await plan.step('renderer', w('renderer'));
  const p2 = await p1.step('sky', w('sky'));
  const p3 = await p2.step('terrain', w('terrain'));
  const p4 = await p3.step('cards', w('cards'));
  const p5 = await p4.step('forest', w('forest'));
  const p5b = await p5.step('physics', w('physics'));
  const p6 = await p5b.step('edge', w('edge'));
  const p7 = await p6.step('grass', w('grass'));
  const p8 = await p7.step('cabins', w('cabins'));
  const p9 = await p8.step('props', w('props'));
  const p10 = await p9.step('animals', w('animals'));
  const p11 = await p10.step('weapon', w('weapon'));
  const p12 = await p11.step('menu', w('menu'));
  const p13 = await p12.step('shaders', w('shaders'));
  const p14 = await p13.step('firstFrame', w('firstFrame'));
  return p14.step('audio', w('audio'));
}

const monotone = (xs: number[]): boolean => xs.every((x, i) => i === 0 || x >= (xs[i - 1] ?? 0));

describe('boot steps table', () => {
  it('steps are unique, labelled and positively weighted', () => {
    expect(new Set(BOOT_STEPS).size).toBe(BOOT_STEPS.length);
    for (const k of BOOT_STEPS) { expect(STEP_INFO[k].label.length).toBeGreaterThan(0); expect(STEP_INFO[k].weight).toBeGreaterThan(0); }
  });

  it('the test chain covers exactly the declared steps, in order', async () => {
    const order: BootStep[] = [];
    const { plan } = harness();
    await runAll(plan, (k) => { order.push(k); });
    expect(order).toEqual([...BOOT_STEPS]);
  });

  it('every byte source is closed by a real step and has a label', () => {
    for (const k of BYTE_SOURCES) { expect(BOOT_STEPS).toContain(closedBy(k)); expect(byteLabel(k).length).toBeGreaterThan(0); }
  });
});

describe('createBootPlan', () => {
  it('a full boot: both fractions monotone, < 1 while work remains, exactly 1 at done()', async () => {
    const { plan, views, record, advance } = harness();
    const final = await runAll(plan, async (key, p) => {
      advance(30);
      for (const src of BYTE_SOURCES) if (closedBy(src) === key) { plan.reader(src).add(400); plan.fileDone(src); }
      p.set(1, 2, 'half');
      advance(250); // overrun the 100 ms expectation
      p.set(2, 2);
      await Promise.resolve();
    });
    for (const v of views.filter((x) => x.doneCount < BOOT_STEPS.length)) expect(v.setup).toBeLessThan(1);
    expect(monotone(views.map((v) => v.setup))).toBe(true);
    expect(monotone(views.map((v) => v.download))).toBe(true);
    expect(views.some((v) => v.done)).toBe(false);

    final.done();
    const last = final.view;
    expect(last).toMatchObject({ done: true, setup: 1, download: 1, doneCount: BOOT_STEPS.length, bytesRead: last.bytesTotal, filesDone: last.filesTotal });
    expect(record).toHaveBeenCalledTimes(1);
    const measured = record.mock.calls[0]?.[0] ?? {};
    for (const k of BOOT_STEPS) expect(measured[k]).toBe(280);
  });

  it('a running step never reads complete, however much it reports or overruns', async () => {
    const { plan, advance } = harness();
    let seen = -1;
    await plan.step('renderer', (p) => {
      p.set(10, 10);
      advance(10_000);
      p.detail('still going');
      const row = plan.view.rows[0];
      seen = row?.fraction ?? -1;
      expect(row?.state).toBe('on');
      expect(row?.sub).toBe(1);
      expect(plan.view.detail).toBe('still going');
    });
    expect(seen).toBeGreaterThan(0.9);
    expect(seen).toBeLessThan(1);
    expect(plan.view.rows[0]?.fraction).toBe(1);
  });

  it('download counts bytes up to each declared total and closes a source at its step', async () => {
    const { plan } = harness({ totals: totals(1000, 1) });
    const sky = plan.reader('sky');
    sky.add(600);
    sky.add(-50);           // ignored
    sky.add(Number.NaN);    // ignored
    expect(plan.view.bytes).toMatchObject({ key: 'sky', done: 600, total: 1000 });
    sky.add(5000);          // over-read is capped at the total
    expect(plan.view.bytesRead).toBe(1000);
    expect(plan.view.download).toBeCloseTo(1000 / (1000 * BYTE_SOURCES.length));
    await plan.step('renderer', () => undefined);
    await plan.step('sky', () => undefined); // closes 'sky' and 'baked' (baked never read a byte)
    expect(plan.view.bytesRead).toBe(2000);
    expect(plan.view.filesDone).toBe(2);
    sky.add(1);             // after close: ignored
    expect(plan.view.bytesRead).toBe(2000);
  });

  it('a boot that declares no bytes reads download = 1 from the start', () => {
    const { plan } = harness({ totals: totals(0, 0) });
    expect(plan.view.download).toBe(1);
    expect(plan.view.setup).toBe(0);
  });

  it('refuses to run a step twice, an unknown step, or done() with steps missing', async () => {
    const { plan } = harness();
    await plan.step('renderer', () => undefined);
    await expect(plan.step('renderer', () => undefined)).rejects.toThrow(/already ok/);
    await expect(plan.step(JSON.parse('"warp-drive"') as BootStep, () => undefined)).rejects.toThrow(/unknown/);
    // `done` is typed `never` until every step ran; reach past the type to hit the runtime guard behind it
    const done = plan.done as () => void;
    expect(done).toThrow(/not complete/);
  });

  it('step values flow through the chain', async () => {
    const { plan } = harness();
    const next = await plan.step('renderer', () => 42);
    expect(next.value).toBe(42);
    const after = await next.step('sky', () => Promise.resolve('hdr'));
    expect(after.value).toBe('hdr');
  });

  it('fail() surfaces the error in the view', () => {
    const { plan } = harness();
    plan.fail('WebGL context lost');
    expect(plan.view.error).toBe('WebGL context lost');
  });
});

describe('formatMB / runDirect', () => {
  it('formats bytes as MB with 2 decimals under 10 MB, 1 above', () => {
    expect(formatMB(1048576)).toBe('1.00 MB');
    expect(formatMB(1.5 * 1048576)).toBe('1.50 MB');
    expect(formatMB(25 * 1048576)).toBe('25.0 MB');
  });

  it('runDirect just runs the work', async () => {
    await expect(runDirect('renderer', () => 'ok')).resolves.toBe('ok');
  });
});

describe('timing (expected step durations)', () => {
  it('first run: weight × 300 ms per step', () => {
    const e = expectedDurations({});
    for (const k of BOOT_STEPS) expect(e[k]).toBe(STEP_INFO[k].weight * 300);
  });

  it('partially known: unknown steps are scaled by what the known ones cost per weight', () => {
    const e = expectedDurations({ renderer: 50 }); // renderer weight 1 → 50 ms per weight unit
    expect(e.renderer).toBe(50);
    expect(e.shaders).toBe(STEP_INFO.shaders.weight * 50);
  });

  it('never expects less than 1 ms', () => {
    const e = expectedDurations({ renderer: 0.001 });
    for (const k of BOOT_STEPS) expect(e[k]).toBeGreaterThanOrEqual(1);
  });

  it('saveTimings stores the first run, then blends 50/50; loadTimings drops junk', () => {
    saveTimings({ renderer: 100, sky: 400 });
    expect(loadTimings()).toEqual({ renderer: 100, sky: 400 });
    saveTimings({ renderer: 200, sky: Number.NaN });
    expect(loadTimings()).toEqual({ renderer: 150 });
  });
});

describe('per-shard step nouns (steps.ts SHARD_STEPS)', () => {
  const labels = () => BOOT_STEPS.map((k) => STEP_INFO[k].label).join(' | ');
  it('the shared table is neutral: Driftwood Isle shows no pines, cabins, HDRI or crossbow', () => {
    useShardSteps('driftwood-isle');
    expect(labels()).not.toMatch(/pine|cabin|hdri|crossbow|herds/i);
    expect(byteLabel('trees')).toBe('tree bark · twigs');
    expect(shardTimingKey()).toBe('');
  });
  it('Pine Hollow names its own steps and keeps the shared weights, under its own timing key', () => {
    useShardSteps('pine-hollow');
    expect(STEP_INFO.cards.label).toBe('Tree species · pine · fir · birch') // PH-B4's species set, not the old pine cards;
    expect(STEP_INFO.sky.label).toBe('Sky · dawn to moonlight');
    expect(STEP_INFO.weapon.label).toBe('Crossbow · lever-action · longbow');
    expect(STEP_INFO.edge.label).toBe('Pond · creek · waterfall · far country');
    expect(byteLabel('trees')).toBe('tree species · bark · needles');
    expect(byteLabel('props')).toBe('landmarks · crags · creatures'); // PH-P3 / B2: the hero props + the crag kit + the creature hulls are what that download is
    expect(byteLabel('art')).toBe('title art');                // not overridden: the shared noun
    expect(shardTimingKey()).toBe(':pine-hollow');
    useShardSteps('driftwood-isle');
    for (const k of BOOT_STEPS) expect(STEP_INFO[k].weight).toBeGreaterThan(0);
  });
});
