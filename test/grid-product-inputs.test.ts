import { expect, test, vi } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import type { AdmittedProduct, ProductOptions } from '../src/game/shardfile/product';
import { ProductInputs } from '../src/game/grid/productInputs';

function fixture() {
  const source = emptyShardfile({ slug: 'input-lease', name: 'Inputs', author: 'Test', revision: 1, seed: 1 });
  const bytes = Uint8Array.of(1, 2, 3), ref = hashImmutableBytes(bytes), wire = new Map([[ref, bytes]]);
  source.files.push({ hash: ref, kind: 'binary', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  let durable = true, corrupted = false, held = 0;
  const fetch = vi.fn(() => Promise.resolve(new Response(corrupted ? Uint8Array.of(3, 2, 1) : bytes)));
  const options: ProductOptions = { base: 'https://inputs.test/', offline: false, firstParty: true, fetch, hash: value => Promise.resolve(hashImmutableBytes(value)),
    cache: { product: () => Promise.resolve(null), putProduct: () => Promise.resolve(), putAsset: () => Promise.resolve(true),
      asset: async () => new Uint8Array(await (await fetch()).arrayBuffer()) } };
  const releasePreparedTransport = vi.fn((refs: Iterable<string>) => {
    const released = durable ? [...refs] : [];
    for (const key of released) wire.delete(key);
    return Promise.resolve(released);
  });
  const admitted: AdmittedProduct = { source, assets: wire, cached: false, releasePreparedTransport };
  const inputs = new ProductInputs(admitted, options, count => {
    held += count; let remaining = count;
    return { shrink: next => { held += next - remaining; remaining = next; }, release: () => { held -= remaining; remaining = 0; } };
  });
  return { inputs, wire, ref, bytes, fetch, releasePreparedTransport, held: () => held,
    durable: (value: boolean) => { durable = value; }, corrupt: () => { corrupted = true; } };
}

test('overlapping preparations pin both mirrors until their last idempotent release', async () => {
  const f = fixture(), first = await f.inputs.acquire(), second = await f.inputs.acquire();
  expect(first.assets.get(f.ref)).toBe(f.bytes); expect(second.assets).toBe(first.assets);
  await first.release(); await first.release();
  expect(f.wire.has(f.ref)).toBe(true); expect(f.inputs.reader.retained.has(f.ref)).toBe(true);
  expect(f.releasePreparedTransport).not.toHaveBeenCalled();
  await second.release();
  expect(first.assets.size).toBe(0); expect(f.wire.size).toBe(0); expect(f.inputs.reader.retained.size).toBe(0);
});

test('late preparation rehydrates verified bytes with a temporary charged claim', async () => {
  const f = fixture(), first = await f.inputs.acquire(); await first.release();
  const next = await f.inputs.acquire();
  expect(next.assets.get(f.ref)).toEqual(f.bytes); expect(next.assets.get(f.ref)).not.toBe(f.bytes);
  expect(f.fetch).toHaveBeenCalledOnce(); expect(f.held()).toBe(f.bytes.length);
  await next.release(); expect(next.assets.size).toBe(0); expect(f.held()).toBe(0);
});

test('unreleasable offline inputs keep their bytes and need no reread', async () => {
  const f = fixture(); f.durable(false);
  const first = await f.inputs.acquire(); await first.release();
  expect(f.wire.get(f.ref)).toBe(f.bytes); expect(f.inputs.reader.retained.get(f.ref)).toBe(f.bytes);
  const next = await f.inputs.acquire(); expect(next.assets.get(f.ref)).toBe(f.bytes);
  expect(f.fetch).not.toHaveBeenCalled(); await next.release();
});

test('corrupt rehydration refuses before publication and releases its temporary claim', async () => {
  const f = fixture(), first = await f.inputs.acquire(); await first.release(); f.corrupt();
  await expect(f.inputs.acquire()).rejects.toThrow('hash or size mismatch');
  expect(f.held()).toBe(0); expect(first.assets.size).toBe(0);
});

test('an acquire during asynchronous retirement waits, then receives refilled inputs', async () => {
  const f = fixture(), first = await f.inputs.acquire();
  let finish: (() => void) | undefined;
  const wait = new Promise<void>(resolve => { finish = resolve; });
  f.releasePreparedTransport.mockImplementationOnce(async refs => { await wait; const result = [...refs]; for (const key of result) f.wire.delete(key); return result; });
  const retirement = first.release(); await Promise.resolve(); await Promise.resolve();
  const loading = f.inputs.acquire();
  if (finish === undefined) throw new Error('Missing retirement gate'); finish();
  await retirement; const next = await loading;
  expect(next.assets.get(f.ref)).toEqual(f.bytes); await next.release(); expect(f.held()).toBe(0);
});
