// oxlint-disable-next-line import/no-nodejs-modules -- Own emitted-product fixtures only.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
