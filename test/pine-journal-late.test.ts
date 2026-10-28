// oxlint-disable-next-line import/no-nodejs-modules -- Read the journal's committed inputs through the native producer cache.
import { homedir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the existing explicit production cache root.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { pineJournal } from '../src/shards/pine-hollow/generators/journal';
import { pineGeneration } from './fixtures/pine-generation';
import { emptyShardfile } from '../src/sdk/author';
import { controlFileHashes } from '../src/format/admissionControl';
import { journalImageRefs } from '../src/format/compendiumRows';
import { hashImmutableBytes } from '../src/sdk/immutable';

const journal = await pineJournal(pineGeneration('pine-journal-late', resolve(homedir(), '.cache/wildshard/gen')));
const base = emptyShardfile({ slug: 'journal-late-fixture', name: 'Journal', author: 'Test', revision: 1, seed: 1 });
const source = { ...base, files: journal.files.map(file => {
  if (file.kind !== 'image') throw new Error('Journal inventory contains a non-image');
  return { ...file, kind: file.kind };
}), library: journal.files.map(file => file.hash), late: journal.late };

test('closed journal pages leave control while the trophy chalk and all original bodies remain declared', () => {
  expect(journal.files).toHaveLength(51); expect(journal.late).toHaveLength(50);
  expect(controlFileHashes(source)).toEqual(new Set([journal.row.chalk?.atlas]));
  const late = new Set(journal.late.map(row => row.hash));
  expect(journalImageRefs(journal.row).every(hash => late.has(hash) || hash === journal.row.chalk?.atlas)).toBe(true);
  expect(journal.files.filter(file => late.has(file.hash)).reduce((sum, file) => sum + file.compressed, 0)).toBe(1896998);
  for (const blob of journal.blobs) expect(blob.file.hash).toBe(hashImmutableBytes(blob.bytes));
});

test('actual shared, critical and dependency consumers override a journal scheduling hint', () => {
  const file = journal.files.find(value => journal.late.some(row => row.hash === value.hash));
  if (file === undefined) throw new Error('Missing original journal image');
  expect(controlFileHashes({ ...source, critical: [file.hash] })).toContain(file.hash);
  expect(controlFileHashes({ ...source, files: source.files.map(row => row.hash === file.hash ? { ...row, critical: true } : row) })).toContain(file.hash);
  const root = { ...file, hash: 'd'.repeat(64), kind: 'binary' as const, dependencies: [file.hash] };
  expect(controlFileHashes({ ...source, files: [...source.files, root], library: [...source.library, root.hash] })).toContain(file.hash);
  expect(controlFileHashes({ ...source, requires: { ...source.requires, commons: [file.hash] } })).toContain(file.hash);
});
