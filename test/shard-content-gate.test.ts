// oxlint-disable-next-line import/no-nodejs-modules -- Immutable fixture digest.
import { createHash } from 'node:crypto';
import { describeNavigation } from '@wildshard/format/navigation';
// oxlint-disable-next-line import/no-nodejs-modules -- Own emitted-product fixtures only.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own isolated native fixture directory.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture product paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { shardContent } from '../scripts/shard-platform-content.mjs';

it('reports honest structural content independently of the source ratio or gameplay verdict', () => {
  const root = mkdtempSync(join(tmpdir(), 'content-gate-'));
  const product = join(root, 'public/shardfiles/example/shard.json');
  const emit = (value: unknown): void => { mkdirSync(join(root, 'public/shardfiles/example'), { recursive: true }); writeFileSync(product, JSON.stringify(value)); };
  const base = { tiles: [{ lod: 0 }], files: [{ hash: 'model', kind: 'glb' }], props: { colliders: [{ shapes: [{ kind: 'box' }] }] } };
  try {
    expect(shardContent('example', root).gate).toEqual({ enforcement: 'report-only', status: 'unavailable', issues: ['product missing'] });
    emit(base);
    expect(shardContent('example', root).gate).toEqual({ enforcement: 'report-only', status: 'candidate', issues: [] });
    emit({ ...base, props: { colliders: [{ shapes: [] }] } });
    expect(shardContent('example', root)).toMatchObject({ structuralWorld: false, gate: { status: 'incomplete', issues: ['no declared world collider shapes'] } });
    emit({ ...base, tiles: [{ lod: 1 }], runtime: { entry: 'runtime/main.ts' } });
    expect(shardContent('example', root).gate).toMatchObject({ status: 'incomplete', issues: ['no L0 render tiles', 'trusted runtime owns simulation'] });
    emit({ ...base, terrain: { tiles: {} } });
    expect(shardContent('example', root).gate).toEqual({ enforcement: 'report-only', status: 'unavailable', issues: ['product invalid'] });
    emit({ ...base, files: [] });
    expect(shardContent('example', root).gate).toMatchObject({ status: 'incomplete', issues: ['no declared asset files'] });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('owns legacy navigation aliases only after exact admitted WSNM declaration and byte identity', () => {
  const root = mkdtempSync(join(tmpdir(), 'navigation-content-'));
  const product = join(root, 'public/shardfiles/example');
  const original = new Uint8Array(readFileSync('public/assets/baked/far-reach/navmesh.bin'));
  const hash = createHash('sha256').update(original).digest('hex');
  const navigation = describeNavigation(hash, original);
  const source = { tiles: [{ lod: 0 }], files: [{ hash, kind: 'binary', compressed: original.length, dependencies: [] }], critical: [hash], props: { colliders: [{ shapes: [{ kind: 'box' }] }] } };
  const emit = (row: unknown): void => { writeFileSync(join(product, 'shard.json'), JSON.stringify(row)); };
  try {
    mkdirSync(join(product, 'assets'), { recursive: true });
    mkdirSync(join(root, 'public/assets/baked/example'), { recursive: true });
    writeFileSync(join(root, 'public/assets/baked/example/navmesh.bin'), original);
    writeFileSync(join(product, 'assets', hash), original);
    emit(source); expect(shardContent('example', root).privateBinaries).toHaveLength(2);
    emit({ ...source, navigation }); expect(shardContent('example', root)).toMatchObject({ status: 'built', privateBinaries: [], files: { platformBinaries: 1 } });
    const changed = Uint8Array.from(original); changed[0] = 0;
    writeFileSync(join(root, 'public/assets/baked/example/navmesh.bin'), changed);
    expect(shardContent('example', root).privateBinaries).toHaveLength(1);
    emit({ ...source, navigation: { ...navigation, bounds: [0, 0, 0, 1, 1, 1] } });
    expect(shardContent('example', root).status).toBe('invalid');
    emit({ ...source, navigation }); writeFileSync(join(product, 'assets', hash), changed);
    expect(shardContent('example', root).status).toBe('invalid');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
