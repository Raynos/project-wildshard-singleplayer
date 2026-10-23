import { expect, test } from 'vitest';
import { reserveHomeDownload } from './bootDownloads';
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
