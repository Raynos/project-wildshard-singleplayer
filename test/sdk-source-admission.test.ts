// oxlint-disable-next-line import/no-nodejs-modules -- Bounded CLI fixture uses its own temporary files.
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bounded CLI fixture uses its own temporary directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture files inside the owned directory.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { readBoundedFile, readShardfileSource } from '../src/sdk/sourceReader';
import { projectAssets } from '../src/sdk/project';
import { emptyShardfile } from '../src/sdk/author';
import { SHARDFILE_ADMISSION_LIMITS as limits } from '../src/game/shardfile/admissionLimits';

it('CLI source intake accepts exactly two million bytes and refuses one over before JSON parsing', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sdk-source-admission-')), path = join(directory, 'source.json');
  try {
    writeFileSync(path, `{}${' '.repeat(limits.sourceBytes - 2)}`); expect(readShardfileSource(path)).toEqual({});
    writeFileSync(path, `{}${' '.repeat(limits.sourceBytes - 1)}`); expect(() => readShardfileSource(path)).toThrow('byte cap');
    writeFileSync(path, new Uint8Array([0xff])); expect(() => readShardfileSource(path)).toThrow();
    writeFileSync(path, new Uint8Array(3)); expect(() => readBoundedFile(path, 2)).toThrow('byte cap'); expect(readBoundedFile(path, 3)).toHaveLength(3);
  } finally { rmSync(directory, { recursive: true }); }
});
it('SDK asset intake refuses huge manifests and small orphans before opening nonexistent asset paths', () => {
  const shard = emptyShardfile({ slug: 'preflight-sdk', name: 'Preflight', author: 'Local', seed: 1, revision: 1 });
  const file = { hash: 'a'.repeat(64), kind: 'binary' as const, compressed: 3_000_000_000, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false };
  shard.files.push(file); expect(() => projectAssets('/nonexistent-sf58-fixture', shard)).toThrow('total wire');
  file.compressed = 1; expect(() => projectAssets('/nonexistent-sf58-fixture', shard)).toThrow('Orphan');
});
