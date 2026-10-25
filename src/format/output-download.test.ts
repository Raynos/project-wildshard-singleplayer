import { expect, test } from 'vitest';
import { readOutputDownloadIndex } from './outputDownload';

const hash = 'a'.repeat(64);
function input() {
  return { format: 'wildshard.shardfile', formatVersion: 2, runtime: null,
    sections: [{ name: 'actors/creatures', path: 'sections/actors/creatures.json', hash, bytes: 12 }], schemas: [],
    files: [{ path: `blobs/bin/${hash}.bin`, hash, compressed: 24 }] };
}
test('download metadata retains exact named paths, hashes and costs without admitting gameplay', () => {
  const row = input(), parsed = readOutputDownloadIndex(row);
  expect(parsed).toEqual(row);
  expect(() => readOutputDownloadIndex({ ...row, identity: 'not an admitted product', admission: null })).not.toThrow();
});
test.each(['../escape', '/absolute', 'https://foreign.test/asset'])('download metadata refuses unsafe path %s', path => {
  const row = input();
  expect(() => readOutputDownloadIndex({ ...row, files: [{ ...row.files[0], path }] })).toThrow();
});
test('download metadata refuses duplicate paths, invalid hashes, costs and versions', () => {
  const row = input();
  expect(() => readOutputDownloadIndex({ ...row, files: [...row.files, ...row.files] })).toThrow('Duplicate');
  expect(() => readOutputDownloadIndex({ ...row, files: [{ ...row.files[0], hash: 'not a hash' }] })).toThrow();
  expect(() => readOutputDownloadIndex({ ...row, files: [{ ...row.files[0], compressed: -1 }] })).toThrow();
  expect(() => readOutputDownloadIndex({ ...row, formatVersion: 3 })).toThrow();
});
