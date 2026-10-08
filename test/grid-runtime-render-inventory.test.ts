import { describe, expect, it } from 'vitest';
import { compileRuntimeRenderPlan, type RuntimeRenderPlan } from '../src/game/grid/runtimeRenderPlan';
import type { RuntimeCost } from '../src/game/grid/runtimeCost';

const measured: RuntimeCost = { webContentMB: 350, glMB: 50, engineBaseMB: 299,
  rev: '123456789', device: 'reviewed test fixture', evidence: 'progress/memory/runtime-rings/summary.json' };
function plan(): RuntimeRenderPlan {
  return { measurement: { rev: measured.rev, evidence: measured.evidence }, nonStreamingBytes: 20_000_000,
    dependencies: [{ id: 'materials.verified', jsBytes: 20_000_000, gpuBytes: 20_000_000 }],
    chunks: [
      { id: 'terrain.coarse', level: 'l1', x: 0, z: 0, dependencyIds: ['materials.verified'], jsBytes: 10_000_000, gpuBytes: 10_000_000 },
      { id: 'terrain.fine', level: 'l0', x: 0, z: 0, dependencyIds: ['materials.verified'], jsBytes: 10_000_000, gpuBytes: 10_000_000 },
    ] };
}
function firstChunk() {
  const row = plan().chunks[0];
  if (row === undefined) throw new Error('Fixture requires a chunk');
  return row;
}

describe('reviewed runtime render inventory', () => {
  it('counts multiple tile components and unions shared dependencies exactly once', () => {
    const input = plan(), first = firstChunk();
    const inventory = compileRuntimeRenderPlan({ ...input, chunks: [...input.chunks,
      { ...first, id: 'props.coarse', jsBytes: 3, gpuBytes: 7 }] }, measured);
    expect(inventory.full).toMatchObject({ nonStreamingBytes: 20_000_000, chunkJsBytes: 20_000_003,
      chunkGpuBytes: 20_000_007, dependencyJsBytes: 20_000_000, dependencyGpuBytes: 20_000_000, totalBytes: 100_000_010 });
    expect(inventory.footprint(['terrain.coarse']).totalBytes).toBe(80_000_000);
    expect(inventory.footprint(['terrain.fine', 'terrain.coarse', 'terrain.fine', 'props.coarse'])).toEqual(inventory.full);
    expect(inventory.footprint([]).totalBytes).toBe(20_000_000);
    expect(inventory.tile('l1', 0, 0).map((row) => row.id)).toEqual(['props.coarse', 'terrain.coarse']);
    expect(inventory.tile('l0', 1, 1)).toEqual([]);
  });

  it('refuses a stale measurement or a full inventory below the reviewed whole-runtime cost', () => {
    const input = plan();
    expect(() => compileRuntimeRenderPlan({ ...input, measurement: { ...input.measurement, rev: '987654321' } }, measured)).toThrow('reviewed measurement');
    expect(() => compileRuntimeRenderPlan({ ...input, measurement: { ...input.measurement, evidence: 'progress/memory/other.json' } }, measured)).toThrow('reviewed measurement');
    expect(() => compileRuntimeRenderPlan({ ...input, nonStreamingBytes: 1 }, measured)).toThrow('undercounts');
    expect(() => compileRuntimeRenderPlan({ ...input, nonStreamingBytes: 0 }, measured)).toThrow('requires its residual');
    expect(() => compileRuntimeRenderPlan({ ...input, chunks: [] }, measured)).toThrow('presentation inventory');
  });

  it('refuses ambiguous ownership, dangling resources and unused inventory', () => {
    const input = plan(), first = firstChunk();
    expect(() => compileRuntimeRenderPlan({ ...input, dependencies: [...input.dependencies, ...input.dependencies] }, measured)).toThrow('duplicate runtime render dependency');
    expect(() => compileRuntimeRenderPlan({ ...input, dependencies: [...input.dependencies, { id: 'unused', jsBytes: 1, gpuBytes: 1 }] }, measured)).toThrow('Unused');
    expect(() => compileRuntimeRenderPlan({ ...input, chunks: [...input.chunks, first] }, measured)).toThrow('duplicate runtime render chunk');
    expect(() => compileRuntimeRenderPlan({ ...input, chunks: [{ ...first, id: 'materials.verified' }] }, measured)).toThrow('duplicate runtime render chunk');
    expect(() => compileRuntimeRenderPlan({ ...input, chunks: [{ ...first, dependencyIds: ['missing'] }] }, measured)).toThrow('Unknown runtime render dependency');
    expect(() => compileRuntimeRenderPlan({ ...input, chunks: [{ ...first, dependencyIds: ['materials.verified', 'materials.verified'] }] }, measured)).toThrow('Duplicate runtime render dependency reference');
    expect(() => compileRuntimeRenderPlan(input, measured).footprint(['missing'])).toThrow('Unknown runtime render chunk');
  });

  it('refuses invalid layout coordinates, unsafe byte counts and sum overflow', () => {
    const input = plan(), first = firstChunk();
    for (const x of [-1, 4, 0.5, Number.NaN]) expect(() => compileRuntimeRenderPlan({ ...input, chunks: [{ ...first, x }] }, measured)).toThrow('tile');
    for (const nonStreamingBytes of [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => compileRuntimeRenderPlan({ ...input, nonStreamingBytes }, measured)).toThrow('byte count');
    }
    expect(() => compileRuntimeRenderPlan({ ...input, nonStreamingBytes: Number.MAX_SAFE_INTEGER }, measured)).toThrow('byte count');
  });

  it('snapshots mutable builder descriptors so later edits cannot reduce admitted bytes', () => {
    const dependencies = [{ id: 'materials.verified', jsBytes: 20_000_000, gpuBytes: 20_000_000 }];
    const refs = ['materials.verified'];
    const chunks = [];
    for (const row of plan().chunks) chunks.push({ ...row, dependencyIds: refs });
    const input = { ...plan(), dependencies, chunks };
    const inventory = compileRuntimeRenderPlan(input, measured), dependency = dependencies[0];
    if (dependency === undefined) throw new Error('Fixture requires a dependency');
    dependency.gpuBytes = 0; refs.push('different'); input.nonStreamingBytes = 1;
    expect(inventory.full.totalBytes).toBe(100_000_000);
    expect(inventory.footprint(['terrain.coarse']).totalBytes).toBe(80_000_000);
    expect(Object.isFrozen(inventory)).toBe(true);
    expect(Object.isFrozen(inventory.full.chunks)).toBe(true);
    expect(Object.isFrozen(inventory.tile('l1', 0, 0)[0])).toBe(true);
  });
});
