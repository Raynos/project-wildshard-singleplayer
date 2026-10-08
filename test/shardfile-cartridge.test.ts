// oxlint-disable-next-line import/no-nodejs-modules -- Inspect an owned temporary build product, not application globals.
import { mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary build project path.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary build paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { emptyShardfile } from '@wildshard/sdk/author';
import { buildProject, contentHash } from '@wildshard/sdk/project';
import { parseShardfile } from '../src/game/shardfile/schema';

const empty = () => emptyShardfile({ slug: 'cartridge', name: 'Cartridge', author: 'Fixture', seed: 1, revision: 1 });
it('refuses non-data throughout the author export before invoking an accessor or serializer', () => {
  for (const value of [() => undefined, Symbol('code'), new Date(), new Map(), 1n]) {
    const source = { ...empty(), identity: { ...empty().identity, name: value } };
    expect(() => parseShardfile(source)).toThrow('JSON data only');
  }
  let reads = 0;
  const source = empty(); Object.defineProperty(source, 'entryways', { enumerable: true, get: () => { reads++; return []; } });
  expect(() => parseShardfile(source)).toThrow('JSON data only'); expect(reads).toBe(0);
  const cycle: Record<string, unknown> = {}; cycle['self'] = cycle;
  expect(() => parseShardfile({ ...empty(), hooks: cycle })).toThrow('JSON data only');
  let serialized = 0;
  expect(() => parseShardfile({ ...empty(), toJSON: () => { serialized++; return empty(); } })).toThrow('JSON data only');
  expect(serialized).toBe(0);
});
it('refuses TypeScript/callback migrations and hooks while accepting their bounded data arms', () => {
  const source = empty(); source.state.version = 2;
  const module = 'a'.repeat(64);
  source.files.push({ hash: module, kind: 'wasm', compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
  source.critical.push(module); source.sim.scripts.push(module); source.sim.bindings.push({ module, entity: 1, actorId: null, kind: 'server' });
  const valid = { ...source, migrations: [{ from: 1, to: 2, fields: [], asHook: null }], hooks: { conditions: [], scenes: [{ id: 'door.open', type: 201, value: 1 }] } };
  expect(parseShardfile(valid).hooks.scenes[0]?.type).toBe(201);
  for (const asHook of ['runtime/migrate.ts', 'https://example.test/migrate.js', () => undefined]) expect(() => parseShardfile({ ...valid, migrations: [{ from: 1, to: 2, fields: [], asHook }] })).toThrow();
  expect(() => parseShardfile({ ...valid, hooks: { conditions: [], scenes: [{ id: 'door.open', type: 201, value: 1, run: () => undefined }] } })).toThrow('JSON data only');
  expect(() => parseShardfile({ ...source, files: [{ hash: 'a'.repeat(64), kind: 'typescript', compressed: 0, decoded: 0, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false }] })).toThrow();
});
it('builds only shard data and declared hash-addressed assets, retaining a selector without copying transition source', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sf6-cartridge-'));
  try {
    const source = empty(), bytes = new TextEncoder().encode('{"data":true}'), hash = contentHash(bytes);
    source.files.push({ hash, kind: 'json', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
    source.library.push(hash); source.budgets.library = { compressed: bytes.length, resident: bytes.length }; source.runtime = { entry: 'runtime/index.ts' };
    mkdirSync(join(root, 'assets')); mkdirSync(join(root, 'runtime'));
    writeFileSync(join(root, 'assets', hash), bytes); writeFileSync(join(root, 'runtime/index.ts'), 'throw new Error("author TypeScript must never enter the cartridge");');
    writeFileSync(join(root, 'shard.config.ts'), `export default ${JSON.stringify(source)};\n`);
    const output = join(root, 'output'); await buildProject(root, output, { client: null });
    expect(readdirSync(output).sort()).toEqual([hash, 'shard.json', 'validation.json'].sort());
    const admitted = parseShardfile(JSON.parse(readFileSync(join(output, 'shard.json'), 'utf8')));
    expect(admitted.runtime).toEqual({ entry: 'runtime/index.ts' });
    expect(new Uint8Array(readFileSync(join(output, hash)))).toEqual(bytes);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
