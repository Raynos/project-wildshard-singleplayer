import { expect, test } from 'vitest';
import { summarizeTileCensus } from '../scripts/parity/tile-census.mjs';

const buffer = (id: string, bytes = 10, owner = 'scene:test') => ({ id, bytes, owner,
  kind: 'buffer', asset: `generated/${id}`, labelled: true });
const node = (path: string, buffers: string[]) => ({ path, buffers, type: 'Mesh' });
const sample = (resources: ReturnType<typeof buffer>[], nodes: ReturnType<typeof node>[]) => ({
  observed: { reconciled: true, totalBytes: resources.reduce((sum, row) => sum + row.bytes, 0), contexts: [{ resources }] },
  nodes, allocation: { accountedBytes: 900, totals: { gpu: 100, ram: 700 } },
});

test('one GPU buffer remains one allocation across attributes and consumers', () => {
  const row = buffer('b');
  const unique = summarizeTileCensus(sample([row], [node('Scene/props', ['b', 'b'])]));
  expect(unique.gpu.tileCandidate).toBe(10);
  const shared = summarizeTileCensus(sample([row], [node('Scene/a', ['b']), node('Scene/b', ['b'])]));
  expect(shared.gpu).toEqual({ engine: 0, shardGlobal: 0, tileCandidate: 0, shared: 10, unknown: 0 });
  expect(shared.total).toBe(10);
  expect(shared.ramCapacity).toBe(700);
  expect(shared.allocatorClaims).toBe(900);
  expect(shared.sceneCpu).toBeNull();
  const missingClaim = { ...sample([row], []), allocation: { accountedBytes: null, totals: { gpu: 10, ram: 20 } } };
  expect(summarizeTileCensus(missingClaim).allocatorClaims).toBeNull();
});

test('camera, always-resident and unknown resources receive no tile saving credit', () => {
  const rows = [buffer('camera'), buffer('water', 20, 'sea'), buffer('lost'), { ...buffer('raw'), labelled: false }];
  const result = summarizeTileCensus(sample(rows, [node('Scene/PerspectiveCamera/weapon', ['camera']), node('Scene/water', ['water'])]), ['sea']);
  expect(result.gpu).toEqual({ engine: 10, shardGlobal: 20, tileCandidate: 0, shared: 0, unknown: 20 });
});

test('unreconciled and ambiguous observations refuse instead of inventing savings', () => {
  const data = sample([buffer('b')], []);
  expect(() => summarizeTileCensus({ ...data, observed: { ...data.observed, reconciled: false } })).toThrow('Unreconciled');
  expect(() => summarizeTileCensus({ ...data, observed: { ...data.observed, totalBytes: 100 } })).toThrow('sizes do not reconcile');
  expect(() => summarizeTileCensus(sample([buffer('b'), buffer('b')], []))).toThrow('Ambiguous');
});

const cpuNode = (path: string, ids: string[]) => ({ ...node(path, []), cpuBuffers: ids.map(id => ({ id, role: 'position' })),
  missingCpuRoles: [], worldBounds: null });
const cpuSample = (nodes: ReturnType<typeof cpuNode>[]) => ({ ...sample([], nodes), nodes, sceneCpuVersion: 1,
  cpuBuffers: [{ id: 'shared', bytes: 48 }, { id: 'single', bytes: 16 }, { id: 'unlinked', bytes: 8 }] });

test('scene CPU capacity is deduplicated across roles and identically named nodes', () => {
  const result = summarizeTileCensus(cpuSample([
    cpuNode('Scene/Mesh', ['shared', 'shared', 'single']), cpuNode('Scene/Mesh', ['shared']),
  ]));
  expect(result.sceneCpu).toEqual({ totalBytes: 72, singleNodeBytes: 16, sharedNodeBytes: 48, unlinkedBytes: 8,
    nodes: 2, boundedNodes: 0, missingCpuRoles: 0 });
  expect(result.ramCapacity).toBe(700);
  expect(result.total).toBe(0);
});

test('partial, dangling and duplicate CPU identities refuse without zero-capacity claims', () => {
  const data = cpuSample([cpuNode('Scene/Mesh', ['shared'])]);
  expect(() => summarizeTileCensus({ ...data, sceneCpuVersion: undefined })).toThrow('Incomplete scene CPU census');
  expect(() => summarizeTileCensus({ ...data, nodes: [node('Scene/Mesh', [])] })).toThrow('Incomplete scene CPU node');
  expect(() => summarizeTileCensus({ ...data, nodes: [cpuNode('Scene/Mesh', ['missing'])] })).toThrow('Unknown scene CPU identity');
  expect(() => summarizeTileCensus({ ...data, cpuBuffers: [...data.cpuBuffers, data.cpuBuffers[0]] })).toThrow();
  expect(() => summarizeTileCensus({ ...data, cpuBuffers: [{ id: 'shared', bytes: Number.MAX_SAFE_INTEGER + 1 }] })).toThrow('Unsafe scene CPU capacity');
  expect(() => summarizeTileCensus({ ...data, nodes: [{ ...cpuNode('Scene/Mesh', []),
    worldBounds: { min: { x: 0, y: 0, z: 0 }, max: { x: Infinity, y: 1, z: 1 } } }] })).toThrow('Invalid scene bounds');
});
