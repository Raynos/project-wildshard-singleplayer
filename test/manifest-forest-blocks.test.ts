import { expect, test, vi } from 'vitest';
import { zlibSync } from 'fflate';
import { Scope } from '../src/engine/app/scope';
import { ScalarLatticeBindings } from '../src/engine/world/scalarChannel';
import { defineShard, declaredForestQueries, prepareManifestScalarBlocks, type ShardManifestRows } from '../src/game/shard/manifest';
import { absentShardProduct, type ShardProduct } from '../src/game/shardfile/shardProduct';
import pine from '../src/shards/pine-hollow/discovery.generated';

const packed = (values: readonly number[]): Uint8Array => zlibSync(new Uint8Array(Float64Array.from(values).buffer));
const channel = (count = 2, file = 'world/density.bin') => ({ type: 'f64', count, data: { file } });
const candidates = { forest: [
  { x: -0, z: 0, scale: 1, species: { tree: 1 } },
  { x: 0, z: 0, scale: 2, species: { tree: .5 } },
], density: channel() };

function fixture() {
  const { scalarBlocks: _blocks, forest: prior, load: _load, render: _render, roster: _roster, ktx2: _ktx2,
    dev: _dev, groundColor: _colour, minimap: _map, navmesh: _nav, ...fixed } = pine;
  if (prior === undefined) throw new Error('Missing source forest metadata');
  const { density: _density, scale: _scale, species: _species, ...forest } = prior;
  const rows: ShardManifestRows = { ...fixed, forest, forestRows: candidates };
  const manifest = defineShard(rows, {}), parent = new Scope('forest-parent'), scope = parent.child('forest-intake');
  const file = vi.fn(() => Promise.resolve(packed([-0, Number.MIN_VALUE])));
  const product = Object.assign(absentShardProduct(manifest.slug), { hasFile: () => true, file });
  return { manifest, parent, scope, rows, product, file };
}

test('binary forest density joins verified preparation without eager reads or rounding', async () => {
  const f = fixture(), query = f.manifest.forest;
  if (query?.density === undefined || query.scale === undefined || query.species === undefined) throw new Error('Missing forest queries');
  try {
    expect(f.file).not.toHaveBeenCalled(); expect(f.manifest.scalarBlocks?.files).toEqual(['world/density.bin']);
    expect(() => query.density?.(0, 0)).toThrow('not prepared');
    await prepareManifestScalarBlocks(f.manifest, f.product, f.scope);
    expect(query.density(0, 0)).toBe(Number.MIN_VALUE);
    expect(query.density(-0, 0)).toBe(Number.MIN_VALUE);
    expect(query.scale(0, 0)).toBe(2); expect(query.species(0, 0)).toEqual({ tree: .5 });
    expect(() => query.density?.(.01, 0)).toThrow('candidate');
    await prepareManifestScalarBlocks(f.manifest, f.product, f.scope);
    expect(f.file).toHaveBeenCalledTimes(1);
  } finally { f.parent.dispose(); }
});

test('indexed scalar values retain signed zero, f64 extremes and independent definitions', () => {
  const first = new ScalarLatticeBindings(), second = new ScalarLatticeBindings();
  const a = first.channel(channel()), b = second.channel(channel());
  first.seal(); expect(first.channel(channel())).toBe(a);
  const bytes = packed([-0, Number.MIN_VALUE]);
  first.prepare(new Map([['world/density.bin', bytes]]));
  second.prepare(new Map([['world/density.bin', packed([Math.PI, Number.MAX_VALUE])]]));
  bytes.fill(0);
  expect(Object.is(a(0), -0)).toBe(true); expect(a(1)).toBe(Number.MIN_VALUE);
  expect(b(0)).toBe(Math.PI); expect(b(1)).toBe(Number.MAX_VALUE);
  for (const index of [-1, .5, 2, Number.NaN]) expect(() => a(index)).toThrow('index outside');
});

test('malformed channels never partially publish valid lattices or other channels', () => {
  const intake = new ScalarLatticeBindings();
  const sample = intake.lattice({ res: 2, size: 500, values: { type: 'f32', count: 4, data: { file: 'world/pond.bin' } } });
  const a = intake.channel(channel()), b = intake.channel(channel(1, 'world/second.bin'));
  const blocks = new Map([['world/pond.bin', zlibSync(new Uint8Array(new Float32Array([0, 1, 2, 3]).buffer))],
    ['world/density.bin', packed([1, 2])], ['world/second.bin', packed([Infinity])]]);
  expect(() => intake.prepare(blocks)).toThrow('Non-finite');
  expect(intake.prepared).toBe(false);
  for (const read of [() => sample(0, 0), () => a(0), () => b(0)]) expect(read).toThrow('not prepared');
  blocks.set('world/second.bin', packed([3])); intake.prepare(blocks);
  expect(a(1)).toBe(2); expect(b(0)).toBe(3); expect(sample(-250, -250)).toBe(0);
});

test('a channel and lattice share one validated file read without retaining transport bytes', () => {
  const intake = new ScalarLatticeBindings(), row = { type: 'f32', count: 4, data: { file: 'world/shared.bin' } };
  const sample = intake.lattice({ res: 2, size: 500, values: row }), channelValue = intake.channel(row);
  expect(intake.files).toEqual(['world/shared.bin']);
  const bytes = zlibSync(new Uint8Array(new Float32Array([1, 2, 3, 4]).buffer)), blocks = new Map([['world/shared.bin', bytes]]);
  const get = vi.spyOn(blocks, 'get'); intake.prepare(blocks);
  expect(get).toHaveBeenCalledTimes(1); blocks.clear(); bytes.fill(0);
  expect(sample(-250, -250)).toBe(1); expect(channelValue(3)).toBe(4);
});

test('cross-reader declarations, limits, missing sources and invalid candidate rows refuse', () => {
  const intake = new ScalarLatticeBindings(); intake.channel(channel());
  expect(() => intake.channel(channel(3))).toThrow('Conflicting');
  expect(() => intake.lattice({ res: 2, size: 500, values: { type: 'f32', count: 4, data: { file: 'world/density.bin' } } })).toThrow('Conflicting');
  const reverse = new ScalarLatticeBindings(); reverse.lattice({ res: 2, size: 500, values: { type: 'f32', count: 4, data: { file: 'world/density.bin' } } });
  expect(() => reverse.channel(channel())).toThrow('Conflicting');
  for (let i = 1; i < 64; i++) intake.channel(channel(1, `world/${i}.bin`));
  expect(() => intake.channel(channel(1, 'world/overflow.bin'))).toThrow('Too many');
  intake.seal(); expect(() => intake.channel(channel(1, 'world/new.bin'))).toThrow('sealed');
  expect(() => declaredForestQueries(candidates)).toThrow('scalar intake');
  expect(() => declaredForestQueries({ ...candidates, density: channel(1) }, new ScalarLatticeBindings())).toThrow();
  expect(() => intake.prepare(new Map())).toThrow('Missing scalar block');
});

test.each(['scope', 'ancestor', 'sliced', 'reader', 'hasFile', 'identity', 'intake'] as const)('forest publication refuses a retired or replaced %s', async kind => {
  const f = fixture();
  let disposal: ReturnType<Scope['disposeSteps']> | undefined;
  const product: { -readonly [K in keyof ShardProduct]: ShardProduct[K] } = f.product;
  product.file = () => {
    if (kind === 'scope') f.scope.dispose();
    if (kind === 'ancestor') f.parent.dispose();
    if (kind === 'sliced') { f.parent.onDisposeSteps(function* delayed() { yield; }); disposal = f.parent.disposeSteps(); disposal.next(); }
    if (kind === 'reader') product.file = () => Promise.resolve(packed([3, 4]));
    if (kind === 'hasFile') product.hasFile = () => true;
    if (kind === 'identity') product.slug = 'replaced';
    if (kind === 'intake') f.manifest.scalarBlocks = new ScalarLatticeBindings();
    return Promise.resolve(packed([1, 2]));
  };
  try {
    await expect(prepareManifestScalarBlocks(f.manifest, product, f.scope)).rejects.toThrow('Retired or replaced');
    expect(() => f.manifest.forest?.density?.(0, 0)).toThrow('not prepared');
  } finally { if (disposal !== undefined) Array.from(disposal); f.parent.dispose(); }
});

test('new forest row bindings refuse accessors and competing callbacks', () => {
  const f = fixture(); let calls = 0;
  try {
    expect(() => defineShard({ ...f.rows, get forestRows() { calls++; return candidates; } }, {})).toThrow('own data fields');
    expect(calls).toBe(0);
    const forest = f.rows.forest; if (forest === undefined) throw new Error('Missing forest metadata');
    expect(() => defineShard({ ...f.rows, forest: { ...forest, density: () => 1 } }, {})).toThrow('Conflicting');
    expect(() => defineShard({ ...f.rows, forest: { ...forest, get density() { calls++; return () => 1; } } }, {})).toThrow('Conflicting');
    expect(calls).toBe(0);
  } finally { f.parent.dispose(); }
});
