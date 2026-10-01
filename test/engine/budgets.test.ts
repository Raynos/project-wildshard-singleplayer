import { describe, expect, it } from 'vitest';
import { deriveBudget, type BudgetInputs, type Calibration } from '#engine/render/budgets';
import { slope } from '#engine/calibrate/math';

const calibration: Calibration = { schema: 1, measuredAt: '2026-10-01', device: 'fixture', source: 'fixture', phone: { ratio: 10, source: 'E283', assumption: 'fixture assumption' }, combine: 'serial', costs: {
  drawCpuMs: 0.004, triangleGpuMs: { static: 0.000001, skinned: 0.000002, wind: 0.000003 }, fragmentGpuMs: { flat: 1e-7, toon: 2e-7, pbr: 3e-7, alphaTest: 4e-7, blend: 5e-7 }, passGpuMs: {}, linkMs: 0.2, rigCpuMs: 0.01, bodyCpuMs: 0.02, agentCpuMs: 0.04,
} };
const inputs: BudgetInputs = { phone: { fps: 30, variability: 1.3, cpuMs: 9.6, gcMs: 0.6, systems: { animation: 1, physics: 0.8, ai: 0.8, rest: 1.4 }, vertexShare: 0.5, lanes: { opaque: 0.5, post: 0.5 }, linkMs: 40 }, load: { coldPlay4G: 30, fixedSeconds: 5, cpuRatio: 2, bytesPerSecond: 1125000 } };
describe('calibrated budget arithmetic', () => {
  it('derives counts, systems, GPU ruler and bytes from known unit costs', () => {
    const d = deriveBudget(inputs, 'phone', calibration);
    expect(d?.limits).toEqual({ draws: 125, tris: 802051, programs: 20, gpuMB: null });
    expect(d?.gpuM5Ms).toBeCloseTo(1.60410256);
    expect(d?.entities).toEqual({ rigs: 10, bodies: 4, agents: 2 });
    expect(d?.downloadBytes).toBe(22500000);
    expect(d?.formula.assumption).toBe('fixture assumption');
  });
  it('recalibration changes capacities without editing inputs', () => {
    expect(deriveBudget(inputs, 'phone', { ...calibration, phone: { ...calibration.phone, ratio: 5 } })?.limits.draws).toBe(250);
    expect(deriveBudget(inputs, 'phone', { ...calibration, combine: 'pipelined' })?.gpuMs).toBeCloseTo(25.6410256);
  });
  it('keeps underived levels/desktop on ceilings and rejects invalid costs', () => {
    expect(deriveBudget({}, 'phone', calibration)).toBeNull();
    expect(deriveBudget(inputs, 'desktop', calibration)).toBeNull();
    expect(() => deriveBudget(inputs, 'phone', { ...calibration, costs: { ...calibration.costs, drawCpuMs: 0 } })).toThrow('positive');
  });
  it('fits a slope while rejecting unresolved or negative signal', () => {
    expect(slope([{ n: 0, ms: 1 }, { n: 100, ms: 5 }, { n: 200, ms: 9 }])).toBe(0.04);
    expect(() => slope([{ n: 0, ms: 2 }, { n: 100, ms: 1 }])).toThrow('unresolved');
  });
});
