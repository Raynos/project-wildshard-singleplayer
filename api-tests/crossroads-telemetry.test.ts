import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useBlobStore } from '../api/_blobStore';
import { GET, POST, cleanRecord, resetRateLimit } from '../api/telemetry';
import { CROSSROADS_CONFIG as C } from '../src/engine/core/crossroads';

const stored = new Map<string, string>();
let restore = (): void => undefined;
beforeEach(() => {
  stored.clear(); resetRateLimit(); vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'fixture'); vi.stubEnv('REVIEW_PASSWORD', 'fixture');
  restore = useBlobStore({
    put: (path, body) => { if (typeof body !== 'string') throw new Error('Expected JSON string'); stored.set(path, body); return Promise.resolve({}); },
    get: (path) => Promise.resolve(stored.has(path) ? { stream: new Response(stored.get(path)).body } : null),
    list: () => Promise.resolve({ blobs: [...stored].map(([pathname, body]) => ({ pathname, size: body.length, uploadedAt: new Date() })), hasMore: false }),
    del: (paths) => { for (const path of paths) stored.delete(path); return Promise.resolve(); },
  });
});
afterEach(() => { restore(); vi.unstubAllEnvs(); });
function reading() {
  const accounted: Record<string, Record<string, number>> = {};
  for (const [key, count] of Object.entries({ l0: C.n0, l1: C.n1, far: C.nf, lib: C.libs, sim: C.sims })) {
    const cap = C.capsMB[key as keyof typeof C.capsMB];
    accounted[key] = { count, gpuGeomB: 0, gpuTexB: 0, cpuB: count * cap * 1e6, jsCopyB: 0, overCap: 0 };
  }
  Object.assign(accounted, { total: { gpuGeomB: 0, gpuTexB: 0, cpuB: 394_400_000, jsCopyB: 0, residentMB: 394.4 } });
  return { kind: 'crossroads', rigVersion: 1, build: 'fixture-build', install: 'anonymous', series: 'series', run: 'series/1', iteration: 1,
    stage: 'complete', config: C, context: { userAgent: 'iPhone Safari', viewport: [402, 874], dpr: 3, standalone: true, origin: 'hosted' },
    stats: { phase: 'done', format: 'astc4x4', error: null, contextLost: false, accounted,
      frames: { measure: { frames: 600, fps: 30, p95ms: 34, renderCpuP95ms: 5 } },
      info: { memory: { textures: 90, geometries: 100 }, drawingBuffer: [804, 1748], jsHeapMB: null }, churn: { swaps: 10, liveMax: 2, buildMsMax: 20 } } };
}
it('persists the real POST through the private store and returns a sanitized Safari record from authenticated rig reads', async () => {
  const body = reading();
  const response = await POST(new Request('https://example.test/api/telemetry', { method: 'POST', body: JSON.stringify({ ...body, email: 'discard', url: 'discard' }) }));
  expect(response.status).toBe(200); expect(stored.size).toBe(1);
  expect((await GET(new Request('https://example.test/api/telemetry?rig=crossroads'))).status).toBe(401);
  const read = await GET(new Request('https://example.test/api/telemetry?rig=crossroads', { headers: { 'x-review-password': 'fixture' } }));
  const value: unknown = await read.json();
  expect(value).toMatchObject({ records: [{ kind: 'crossroads', rig: { config: { n0: 29 }, stats: { withinCaps: true, info: { jsHeapMB: null }, memoryKind: 'accounted-content-excludes-engine-base' } } }] });
  expect(JSON.stringify(value)).not.toContain('discard');
});
it('rejects altered caps, false completion, inconsistent byte totals and invalid frame samples', () => {
  const body = reading();
  expect(cleanRecord({ ...body, config: { ...C, n0: 40 } })).toBeNull();
  expect(cleanRecord({ ...body, stats: { ...body.stats, contextLost: true } })).toBeNull();
  expect(cleanRecord({ ...body, stats: { ...body.stats, accounted: { ...body.stats.accounted, total: { ...Reflect.get(body.stats.accounted, 'total'), cpuB: 1 } } } })).toBeNull();
  expect(cleanRecord({ ...body, stats: { ...body.stats, frames: { measure: { frames: 0 } } } })).toBeNull();
  expect(cleanRecord({ ...body, stats: { ...body.stats, frames: { measure: { frames: 600, p95ms: Number.NaN } } } })).toBeNull();
});
it('records interruption/error and a three-run summary without treating them as session crash-rate samples', () => {
  const body = reading();
  expect(cleanRecord({ ...body, stage: 'interrupted', stats: null })?.rig?.stage).toBe('interrupted');
  expect(cleanRecord({ ...body, stage: 'error', stats: { error: 'WebGL unavailable' } })?.rig?.stats?.error).toBe('WebGL unavailable');
  const summary = { runs: 3, completed: 3, contextLosses: 0, errors: 0, posted: 3, overCapRuns: 0 };
  expect(cleanRecord({ ...body, run: 'series/summary', iteration: 0, stage: 'summary', stats: null, summary })?.rig?.summary).toEqual(summary);
  expect(cleanRecord({ ...body, run: 'series/summary', iteration: 0, stage: 'summary', summary: { ...summary, contextLosses: 1 } })).toBeNull();
});
