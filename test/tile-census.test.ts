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
