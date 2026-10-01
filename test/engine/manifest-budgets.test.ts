import { describe, expect, it } from 'vitest';
import nine from '#shards/nine-dragon-stack/manifest';
import pine from '#shards/pine-hollow/manifest';
import nalati from '#shards/nalati-grasslands/manifest';
import driftwood from '#shards/driftwood-isle/manifest';
import { poseBudgets, frameBudget } from '#engine/render/budgetReport';
import type { BudgetLimits } from '#engine/render/budgets';
import sources from '../../budgets/nalati-ceiling-sources.json';
import provenance from '../../budgets/x7-ceiling-sources.json';
import { desktopProjections } from '../../scripts/gpu-perf/report.mjs';

const metrics: readonly (keyof BudgetLimits)[] = ['draws', 'tris', 'programs', 'gpuMB'];
describe('manifest budget ownership', () => {
  it.each([nine, pine, nalati, driftwood])('owns complete allocation inputs and recorded ceilings for $slug', (manifest) => {
    const inputs = manifest.budgets;
    if (inputs === undefined) throw new Error('Missing budget inputs');
    expect(inputs.phone?.fps).toBe(30); expect(inputs.desktop?.fps).toBe(60);
    expect(inputs.load).toBeDefined();
    for (const tier of ['phone', 'desktop'] as const) {
      const ceilings = inputs.ceilings?.[tier];
      if (!ceilings) throw new Error('Missing manifest ceilings');
      expect(Object.keys(ceilings).length).toBeGreaterThanOrEqual(3);
      const reported = poseBudgets(manifest.slug, tier, inputs, []);
      for (const [pose, limits] of Object.entries(ceilings)) for (const metric of metrics) {
        expect(limits[metric]).toBeGreaterThan(0);
        expect(reported[pose]?.ceiling?.[metric]).toBe(limits[metric]);
      }
      const frame = frameBudget(manifest.slug, tier, inputs);
      expect(frame.draws).toBe(Math.max(...Object.values(ceilings).map((row) => row.draws ?? 0)));
    }
  });
  it('keeps all 24 Nalati ceilings exactly equal to sol-s35c evidence', () => {
    const ceilings = nalati.budgets?.ceilings;
    let checked = 0;
    for (const [key, expected] of Object.entries(sources.ceilings)) {
      const parts = key.split('.'), tier = parts[1], pose = parts[2], metric = parts[3];
      if ((tier !== 'phone' && tier !== 'desktop') || !pose || !metrics.includes(metric as keyof BudgetLimits)) throw new Error('Invalid evidence key');
      expect(ceilings?.[tier]?.[pose]?.[metric as keyof BudgetLimits]).toBe(expected); checked++;
    }
    expect(checked).toBe(24);
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
