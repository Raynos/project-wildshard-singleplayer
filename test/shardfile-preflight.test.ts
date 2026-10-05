import { expect, it } from 'vitest';
import { preflightShardfile } from '../src/game/shardfile/preflight';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '../src/game/shardfile/admissionLimits';

const hash = 'a'.repeat(64), other = 'b'.repeat(64);
const cost = { decoded: 0, gpu: 0, triangles: 0, draws: 0 };
it('bounds distinct wire including commons before following references, and refuses understated aliases', () => {
  const source = { files: [{ hash, compressed: limits.wireBytes - 1 }], requires: { commons: [other], commonsWire: { [other]: 1 }, commonsCosts: { [other]: cost } } };
  expect(() => preflightShardfile(source)).not.toThrow();
  source.requires.commonsWire[other] = 2; expect(() => preflightShardfile(source)).toThrow('total wire');
  expect(() => preflightShardfile({ files: [{ hash, compressed: 3_000_000_000 }] })).toThrow('total wire');
  expect(() => preflightShardfile({ files: [{ hash, compressed: 5 }], requires: { commons: [hash], commonsWire: { [hash]: 5 }, commonsCosts: { [hash]: cost } } })).not.toThrow();
  expect(() => preflightShardfile({ files: [{ hash, compressed: 5 }], requires: { commons: [hash], commonsWire: { [hash]: 4 } } })).toThrow('Conflicting');
});
it.each([
  ['files', limits.files, (rows: unknown[]) => ({ files: rows.map((_row, i) => ({ hash: i.toString(16).padStart(64, '0'), compressed: 0 })) })],
  ['commons', limits.commons, (rows: unknown[]) => { const hashes = rows.map((_row, i) => i.toString(16).padStart(64, '0')); return { requires: { commons: hashes, commonsWire: Object.fromEntries(hashes.map((key) => [key, 0])), commonsCosts: Object.fromEntries(hashes.map(key => [key, cost])) } }; }],
  ['shared state', limits.stateFields, (rows: unknown[]) => ({ state: { shared: rows } })],
  ['player state', limits.stateFields, (rows: unknown[]) => ({ state: { player: rows } })],
  ['water', limits.waterBodies, (rows: unknown[]) => ({ water: rows })],
] as const)('accepts equality and refuses one over %s', (label, maximum, source) => {
  expect(() => preflightShardfile(source(Array.from({ length: maximum }, () => null)))).not.toThrow();
  expect(() => preflightShardfile(source(Array.from({ length: maximum + 1 }, () => null)))).toThrow(label);
});
it('bounds UTF-8 canonical source bytes and text without copying an entire serialized source', () => {
  expect(() => preflightShardfile({ text: 'x'.repeat(limits.textCharacters) })).not.toThrow();
  expect(() => preflightShardfile({ text: 'x'.repeat(limits.textCharacters + 1) })).toThrow('string');
  expect(() => preflightShardfile({ id: 'x'.repeat(limits.idCharacters) })).not.toThrow();
  expect(() => preflightShardfile({ id: 'x'.repeat(limits.idCharacters + 1) })).toThrow('string');
  expect(() => preflightShardfile({ default: 'x'.repeat(limits.textCharacters) })).not.toThrow();
  const rows = Array.from({ length: 487 }, () => 'x'.repeat(4096));
  // The final string places canonical JSON exactly at the shared source ceiling.
  const remaining = limits.sourceBytes - JSON.stringify(rows).length - 3;
  rows.push('x'.repeat(remaining)); expect(JSON.stringify(rows).length).toBe(limits.sourceBytes);
  expect(() => preflightShardfile(rows)).not.toThrow(); rows[0] = `${rows[0]}é`;
  expect(() => preflightShardfile(rows)).toThrow();
});
it('refuses authored accessors and cycles without invoking them', () => {
  let calls = 0; const source = { get files() { calls++; return []; } };
  expect(() => preflightShardfile(source)).toThrow('accessors'); expect(calls).toBe(0);
  const cyclic: { self?: unknown } = {}; cyclic.self = cyclic; expect(() => preflightShardfile(cyclic)).toThrow('JSON');
});
