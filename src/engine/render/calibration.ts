import type { Calibration, CalibrationCosts } from './budgets';

export function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid budget document');
  return value as Record<string, unknown>;
}
function cost(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error('Invalid calibration cost');
  return value;
}
function text(value: unknown): string { if (typeof value !== 'string' || !value) throw new Error('Missing calibration provenance'); return value; }
export function parseCalibration(raw: string): Calibration {
  const doc = record(JSON.parse(raw) as unknown), phone = record(doc['phone']), c = record(doc['costs']);
  if (doc['schema'] !== 1 || doc['stable'] !== true || !['serial', 'pipelined'].includes(String(doc['combine']))) throw new Error('Calibration must be stable schema1 with a measured combine rule');
  const tris = record(c['triangleGpuMs']), frags = record(c['fragmentGpuMs']), passes = record(c['passGpuMs']);
  const costs: CalibrationCosts = { drawCpuMs: cost(c['drawCpuMs']), triangleGpuMs: { static: cost(tris['static']), skinned: cost(tris['skinned']), wind: cost(tris['wind']) },
    fragmentGpuMs: { flat: cost(frags['flat']), toon: cost(frags['toon']), pbr: cost(frags['pbr']), alphaTest: cost(frags['alphaTest']), blend: cost(frags['blend']) },
    passGpuMs: Object.fromEntries(Object.entries(passes).map(([k, v]) => [k, cost(v)])), linkMs: cost(c['linkMs']), rigCpuMs: cost(c['rigCpuMs']), bodyCpuMs: cost(c['bodyCpuMs']), agentCpuMs: cost(c['agentCpuMs']) };
  return { schema: 1, measuredAt: text(doc['measuredAt']), device: text(doc['device']), source: text(doc['source']), phone: { ratio: cost(phone['ratio']), source: text(phone['source']), assumption: text(phone['assumption']) }, combine: doc['combine'] === 'pipelined' ? 'pipelined' : 'serial', costs };
}
