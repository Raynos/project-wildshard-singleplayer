import { describe, expect, it } from 'vitest';
import nine from '../../src/shards/nine-dragon-stack/manifest';
import pine from '../../src/shards/pine-hollow/manifest';
import nalati from '../../src/shards/nalati-grasslands/manifest';
import driftwood from '../../src/shards/driftwood-isle/manifest';
import { poseBudgets, frameBudget } from '../../src/engine/render/budgetReport';
import { deriveBudget, type BudgetLimits } from '../../src/engine/render/budgets';
import template from '../../src/shards/_template/manifest';
import dunes from '../../src/shards/sunscar-dunes/manifest';
import reach from '../../src/shards/far-reach/manifest';
import { parseCalibration } from '../../src/engine/render/calibration';
import calibrationText from '../../budgets/calibration.json?raw';
import sources from '../../budgets/ceiling-sources.json';
import ratchet from '../../lint/ratchet.json';
import provenance from '../../budgets/x7-ceiling-sources.json';
import { desktopProjections } from '../../scripts/gpu-perf/report.mjs';

const metrics: readonly (keyof BudgetLimits)[] = ['draws', 'tris', 'programs', 'gpuMB'];
describe('manifest budget ownership', () => {
  it.each([nine, pine, nalati, driftwood, template, dunes, reach])('owns complete allocation inputs and recorded ceilings for $slug', (manifest) => {
    const inputs = manifest.budgets;
    if (inputs === undefined) throw new Error('Missing budget inputs');
    expect(inputs.phone?.fps).toBe(30); expect(inputs.desktop?.fps).toBe(60);
    expect(inputs.load).toBeDefined();
    for (const tier of ['phone', 'desktop'] as const) {
      const ceilings = inputs.ceilings?.[tier];
      if (!ceilings) throw new Error('Missing manifest ceilings');
      const derived = deriveBudget(inputs, tier, parseCalibration(calibrationText));
      expect(derived).not.toBeNull();
      const reported = poseBudgets(manifest.slug, tier, inputs, ['current']);
      expect(reported['current']?.derived).toEqual(derived?.limits);
      for (const [pose, limits] of Object.entries(ceilings)) for (const metric of metrics) {
        if (limits[metric] === undefined) continue;
        expect(limits[metric]).toBeGreaterThan(0);
        const target = derived?.limits[metric];
        if (target !== null && target !== undefined) expect(limits[metric]).toBeGreaterThan(target);
        expect(reported[pose]?.ceiling?.[metric]).toBe(limits[metric]);
      }
      const frame = frameBudget(manifest.slug, tier, inputs);
      expect(frame.draws).toBe(Math.max(derived?.limits.draws ?? 0, ...Object.values(ceilings).map((row) => row.draws ?? 0)));
      for (const metric of metrics) {
        if (metric === 'gpuMB' && Object.keys(ceilings).length === 0) expect(frame[metric]).toBeNull();
        else expect(frame[metric]).toBeGreaterThan(0);
      }
    }
  });
  it('records derivations for every manifest and removes the duplicate ratchet fallback', async () => {
    expect(ratchet.budgets).toEqual({});
    expect(sources.calibration).toBe(parseCalibration(calibrationText).measuredAt);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(calibrationText));
    expect(sources.calibrationSha256).toBe(Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(''));
    for (const manifest of [nine, pine, nalati, driftwood, template, dunes, reach]) {
      if (manifest.budgets === undefined) throw new Error('Missing budget inputs');
      const recorded = sources.derived[manifest.slug as keyof typeof sources.derived];
      for (const tier of ['phone', 'desktop'] as const) {
        expect(recorded[tier].limits).toEqual(deriveBudget(manifest.budgets, tier, parseCalibration(calibrationText))?.limits);
      }
    }
  });
  it('re-records only explicitly accepted measured GL changes with causal commits', () => {
    expect(sources.reRecords.map((row) => `${row.shard}.${row.tier}.${row.metric}`).sort()).toEqual(['_template.desktop.gpuMB', '_template.phone.gpuMB', 'far-reach.desktop.gpuMB', 'far-reach.phone.gpuMB', 'nine-dragon-stack.desktop.gpuMB', 'pine-hollow.desktop.gpuMB', 'pine-hollow.phone.gpuMB', 'sunscar-dunes.desktop.gpuMB', 'sunscar-dunes.phone.gpuMB']);
    for (const row of sources.reRecords) {
      if (row.shard === 'nine-dragon-stack') {
        expect(row.ask).toBe('E435'); expect(row.approvedBy).toBe('wildshard-new');
        expect(row.reason).toContain('G224');
        for (const commit of ['599924369', '5ec641579', '82bd665cf']) expect(row.reason).toContain(commit);
      } else {
        expect(row.ask).toBe('E357'); expect(row.approvedBy).toBe('wildshard-9');
      }
      expect(row.commit).toMatch(/^[a-f0-9]{40}$/); expect(row.captureSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(row.source).toContain('budgets/calibration-reports/');
      for (const [key, value] of Object.entries(row.ceilings)) {
        const pose = key.split('.')[2];
        if (!pose || (row.tier !== 'phone' && row.tier !== 'desktop')) throw new Error('Invalid approved ceiling');
        const manifest = [template, pine, dunes, reach, nine].find((m) => m.slug === row.shard);
        if (manifest === undefined) throw new Error('Unknown approved shard');
        expect(manifest.budgets?.ceilings?.[row.tier]?.[pose]?.gpuMB).toBe(value);
      }
    }
  });
  it('retains F2-ceiling provenance without requiring stable calibration', () => {
    const text = JSON.stringify(provenance);
    expect(text).toContain('F2 baseline max(lanes)');
    expect(text).toContain('nalati-grasslands.phone.json');
    expect(poseBudgets('fixture', 'phone', { ceilings: { phone: { a: { draws: 17 } } } }, ['a'])['a']?.ceiling?.draws).toBe(17);
  });
  it('reports desktop interval projections explicitly without interpreting phone captures', () => {
    const reference = { k3060: 0.5, source: 'fixture', assumption: 'projection' };
    expect(desktopProjections({ boot: { tier: 'phone' } }, reference)).toEqual([]);
    expect(desktopProjections({ boot: { tier: 'desktop', shard: 'fixture' }, poses: { a: { frameP95Ms: 5 }, b: { frameP95Ms: 10 } } }, reference)).toMatchObject([
      { pose: 'a', projected3060FrameMs: 10, verdict: 'within projection' }, { pose: 'b', projected3060FrameMs: 20, verdict: 'over projection' },
    ]);
  });
});
