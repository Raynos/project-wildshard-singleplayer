import { expect, it } from 'vitest';
import { MemoryAdmission } from '../src/game/grid/memoryAdmission';
import { admitProduct, type ProductOptions } from '../src/game/shardfile/product';
import { parseKtx2 } from '../src/game/shardfile/assets';
import { contentHash } from '../src/sdk/project';
import { emptyShardfile } from '../src/sdk/author';

function fixture() {
  const shard = emptyShardfile({ slug: 'developer-cost', name: 'Developer cost', author: 'Fixture', seed: 1, revision: 1 });
  const assets = new Map<string, Uint8Array>();
  // Distinct bounded KTX2 headers; only the total commons residency exceeds the envelope, never one file's cap.
  for (let id = 0; id < 40; id++) {
    const bytes = new Uint8Array(129), view = new DataView(bytes.buffer);
    bytes.set([171, 75, 84, 88, 32, 50, 48, 187, 13, 10, 26, 10]);
    view.setUint32(20, 2048, true); view.setUint32(24, 2048, true); view.setUint32(36, 1, true); view.setUint32(40, 1, true);
    view.setUint32(48, 104, true); view.setUint32(52, 24, true);
    view.setBigUint64(80, 128n, true); view.setBigUint64(88, 1n, true); view.setBigUint64(96, 1n, true); bytes[128] = id;
    const hash = contentHash(bytes), cost = parseKtx2(bytes); assets.set(hash, bytes);
    shard.requires.commons.push(hash); shard.requires.commonsWire[hash] = bytes.length; shard.requires.commonsCosts[hash] = cost;
    shard.library.push(`commons:${hash}`);
  }
  let reads = 0;
  const options: ProductOptions = { base: 'https://outside.test/', firstParty: false, offline: false,
    hash: payload => Promise.resolve(contentHash(payload)), fetch: url => { reads++; const bytes = assets.get(new URL(url).pathname.slice(1));
      if (bytes === undefined) throw new Error('Unknown fixture asset'); return Promise.resolve(new Response(Uint8Array.from(bytes))); } };
  return { shard, assets, options, reads: () => reads };
}

it('only Developer admits exact over-envelope products, retaining full totals before and after byte admission', async () => {
  const f = fixture(); await expect(admitProduct(f.shard, f.options)).rejects.toThrow('declared worst-location'); expect(f.reads()).toBe(0);
  const memory = new MemoryAdmission(() => true);
  const admitted = await admitProduct(f.shard, { ...f.options, memory });
  expect(admitted.assets.size).toBe(40); expect(f.reads()).toBe(40);
  expect(memory.reports().map(row => row.stage)).toEqual(['declared', 'actual']);
  expect(memory.reports().every(row => row.playingBytes > 1_000_000_000 && row.playingCap === 1_000_000_000 && row.claimedBytes === row.accountedBytes)).toBe(true);
});
it('Developer still refuses changed hashes, corrupt asset headers and understated exact costs', async () => {
  const memory = new MemoryAdmission(() => true);
  const f = fixture(); await expect(admitProduct(f.shard, { ...f.options, memory, hash: () => Promise.resolve('0'.repeat(64)) })).rejects.toThrow('hash mismatch');
  const first = f.shard.requires.commons[0]; if (first === undefined) throw new Error('Missing commons fixture');
  f.shard.requires.commonsCosts[first] = { decoded: 0, gpu: 1, triangles: 0, draws: 0 };
  await expect(admitProduct(f.shard, { ...f.options, memory })).rejects.toThrow('commons cost declaration differs');
  const bytes = f.assets.get(first); if (bytes === undefined) throw new Error('Missing bytes'); bytes[0] = 0;
  await expect(admitProduct(f.shard, { ...f.options, memory })).rejects.toThrow('hash mismatch');
});
