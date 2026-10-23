import { expect, test } from 'vitest';
import { reserveHomeDownload, prepareHomeExtras } from './bootDownloads';
import { DownloadAccounting, installDownloadAccounting } from '@wildshard/engine/boot/download';

const base = 'https://game.test/';
test('only the chosen home reserves bytes, before index receipt and individual declarations', () => {
  const accounting = new DownloadAccounting(base), close = installDownloadAccounting(accounting);
  try {
    const rows = { '/shardfiles/first/': [10, 100], '/shardfiles/other/': [50, 5000] };
    reserveHomeDownload(rows, '/shardfiles/first/shard.json', base);
    expect(accounting.snapshot()).toMatchObject({ declaredBytes: 100, declaredDoneBytes: 0, declaredFiles: 1, unitemizedBytes: 90, networkBytes: 0 });
    accounting.declare('/shardfiles/first/sections/world.json', 30);
    accounting.declare('/shardfiles/first/blobs/body.bin', 60);
    reserveHomeDownload(rows, '/shardfiles/first/shard.json', base);
    expect(accounting.snapshot()).toMatchObject({ declaredBytes: 100, declaredDoneBytes: 0, declaredFiles: 3 });
    expect(accounting.snapshot().unitemizedBytes).toBeUndefined();
  } finally { close(); }
});
test('legacy/external paths do not reserve a product and malformed selected facts publish nothing', () => {
  const accounting = new DownloadAccounting(base), close = installDownloadAccounting(accounting);
  try {
    for (const path of [undefined, '/legacy.json', 'https://other.test/shardfiles/first/shard.json']) reserveHomeDownload({}, path, base);
    for (const row of [[10, 9], [10, -1], [10, Infinity], [0.5, 10], [10, 100, 500]]) {
      expect(() => reserveHomeDownload({ '/shardfiles/first/': row }, '/shardfiles/first/shard.json', base)).toThrow('Invalid home download total');
    }
    expect(accounting.snapshot()).toMatchObject({ declaredBytes: 0, declaredFiles: 0 });
  } finally { close(); }
});

test('selected extras replace their reserve exactly after hash/size admission, without fetching model bytes', async () => {
  const accounting = new DownloadAccounting(base), close = installDownloadAccounting(accounting);
  try {
    const text = JSON.stringify([['/assets/model.glb', 30], ['/assets/card.webp', 10]]);
    const bytes = new TextEncoder().encode(text), digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
    const url = `/assets/boot-first-${hash.slice(0, 8)}.json`, reads: string[] = [];
    const read: typeof fetch = input => { reads.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); return Promise.resolve(new Response(text)); };
    const load = prepareHomeExtras({ '/shardfiles/first/': [url, bytes.length, 40, hash] }, '/shardfiles/first/shard.json', base, { disposed: false }, read);
    expect(accounting.snapshot()).toMatchObject({ declaredBytes: 40 + bytes.length, unitemizedBytes: 40, declaredFiles: 1 });
    if (load === null) throw new Error('Missing bank');
    await load.read();
    expect(reads).toEqual([new URL(url, base).href]);
    expect(accounting.snapshot()).toMatchObject({ declaredBytes: 40 + bytes.length, declaredDoneBytes: 0, declaredFiles: 3 });
    expect(accounting.snapshot().unitemizedBytes).toBeUndefined();
  } finally { close(); }
});
test('changed/oversized/retired metadata never publishes a file prefix', async () => {
  for (const mode of ['hash', 'size', 'retired'] as const) {
    const accounting = new DownloadAccounting(base), close = installDownloadAccounting(accounting);
    try {
      const owner = { disposed: false }, body = mode === 'size' ? 'x'.repeat(11) : '[1]';
      const load = prepareHomeExtras({ '/shardfiles/first/': [`/assets/boot-first-${'0'.repeat(8)}.json`, mode === 'size' ? 10 : 3, 40, '0'.repeat(64)] },
        '/shardfiles/first/shard.json', base, owner, () => { if (mode === 'retired') owner.disposed = true; return Promise.resolve(new Response(body)); });
      if (load === null) throw new Error('Missing bank');
      await expect(load.read()).rejects.toThrow(mode === 'size' ? 'Oversized' : mode === 'retired' ? 'Retired' : 'hash differs');
      expect(accounting.snapshot()).toMatchObject({ declaredFiles: 1, unitemizedBytes: 40, declaredDoneBytes: 0 });
    } finally { close(); }
  }
});
