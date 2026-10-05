// oxlint-disable-next-line import/no-nodejs-modules -- Build integration fixtures own their temporary directories.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated author projects live outside the repository.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths and SDK workspace links.
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import binaryen from 'binaryen';
import { CONTENT_CAPS as C } from '../src/engine/core/config';
import { worstContentCost } from '../src/game/shardfile/budget';
import { emptyShardfile } from '@wildshard/sdk/author';
import { assetCost } from '@wildshard/sdk/assets';
import { buildProject, contentHash, newProject, validateProject } from '@wildshard/sdk/project';

const empty = (): ReturnType<typeof emptyShardfile> => emptyShardfile({ slug: 'example', name: 'Example', author: 'Local', seed: 1, revision: 1 });
it('rejects a valid-hash Wasm module with an unmetered endless loop before execution', () => {
  const module = binaryen.parseText('(module (import "env" "memory" (memory 1 64)) (func (export "on_tick") (loop $spin (br $spin))))');
  let bytes: Uint8Array;
  try { bytes = module.emitBinary(); } finally { module.dispose(); }
  const hash = contentHash(bytes), s = empty();
  s.files.push({ hash, kind: 'wasm', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
  s.critical.push(hash); s.sim.scripts.push(hash); s.budgets.sim = { resident: bytes.length, compressed: bytes.length };
  expect(WebAssembly.validate(Uint8Array.from(bytes))).toBe(true);
  expect(() => validateProject(s, new Map([[hash, bytes]]))).toThrow();
});
it.each([['glb', 'triangle.glb'], ['ktx2', 'pixel.ktx2'], ['audio', 'sample.wav']])('parses bounded %s assets and rejects a malformed fixture', (kind, file) => {
  expect(assetCost(kind, readFileSync(`test/fixtures/shard-assets/${file}`)).decoded).toBeGreaterThanOrEqual(0);
  const extension = file.split('.').pop();
  expect(() => assetCost(kind, readFileSync(`test/fixtures/shard-assets/malformed.${extension ?? ''}`))).toThrow();
});
it('checks actual wire hashes and rejects understated decoded costs', () => {
  const bytes = new TextEncoder().encode('{"row":1}'), hash = contentHash(bytes), s = empty();
  s.files.push({ hash, kind: 'json', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: false });
  s.library.push(hash); s.budgets.library = { compressed: bytes.length, resident: bytes.length };
  expect(validateProject(s, new Map([[hash, bytes]]))).toEqual(s);
  expect(() => validateProject(s, new Map([[hash, new Uint8Array(bytes.length)]]))).toThrow('hash');
  s.files[0]?.dependencies.push('b'.repeat(64)); expect(() => validateProject(s, new Map([[hash, bytes]]))).toThrow();
  s.files[0]?.dependencies.pop(); const file = s.files[0]; if (file === undefined) throw new Error('fixture missing'); file.decoded = 0;
  expect(() => validateProject(s, new Map([[hash, bytes]]))).toThrow('understated');
});
it('deduplicates shared dependencies and enforces the transitive critical wire cap', () => {
  const bytes = new Uint8Array(2_000_001), hash = contentHash(bytes), s = empty();
  s.files.push({ hash, kind: 'binary', compressed: bytes.length, decoded: bytes.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true }); s.critical.push(hash);
  s.budgets.sim = { resident: 25_000_000, compressed: 2_000_000 };
  expect(() => validateProject(s, new Map([[hash, bytes]]))).toThrow('budget');
});
it('counts all categories at the worst location: saturated v1 fits, commons can break the total while tile caps pass', () => {
  const s = empty(); s.budgets.library = { resident: C.library.resident, compressed: C.library.compressed }; s.budgets.sim = { resident: C.sim.resident, compressed: C.sim.compressed };
  s.far = { files: [], bounds: { min: [-250, -250, -250], max: [250, 250, 250] }, compressed: C.far.compressed, decoded: 0, gpu: C.far.resident, triangles: C.far.triangles, draws: C.far.draws };
  for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) s.tiles.push({ lod: 0, x, z, bounds: { min: [-250 + x * 62.5, -250, -250 + z * 62.5], max: [-250 + (x + 1) * 62.5, 250, -250 + (z + 1) * 62.5] }, geometricError: 0, files: [], compressed: C.l0.compressed, decoded: 0, gpu: C.l0.resident, triangles: C.l0.triangles, draws: C.l0.draws });
  const cost = worstContentCost(s); expect(cost.playing).toBeLessThanOrEqual(C.playing);
  expect(validateProject(s, new Map())).toEqual(s);
  expect(worstContentCost(s, 200_000_000).playing).toBeGreaterThan(C.playing); // 200 MB of commons breaks the 1.0 GB envelope (G65)
  const tile = s.tiles[0]; if (tile === undefined) throw new Error('fixture missing'); tile.gpu++;
  expect(() => validateProject(s, new Map())).toThrow();
});
it('two clean author builds produce identical shardfiles and the canonical layout', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shard-build-'));
  try {
    const project = join(root, 'example'); newProject(project, 'example'); symlinkSync(resolve('node_modules'), join(project, 'node_modules'));
    await buildProject(project, join(root, 'one')); await buildProject(project, join(root, 'two'));
    expect(readFileSync(join(root, 'one/shard.json'))).toEqual(readFileSync(join(root, 'two/shard.json')));
    expect(readdirSync(project)).toEqual(expect.arrayContaining(['shard.config.ts', 'generators', 'data', 'behaviour', 'quests', 'assets']));
    expect(() => newProject(project, 'example')).toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);
it('writes commons bytes once under their immutable hash in the built product', async () => {
  const root = mkdtempSync(join(tmpdir(), 'shard-commons-'));
  try {
    const project = join(root, 'example'), bytes = new Uint8Array([1, 2, 3]), hash = contentHash(bytes);
    newProject(project, 'example'); symlinkSync(resolve('node_modules'), join(project, 'node_modules'));
    mkdirSync(join(project, 'commons')); writeFileSync(join(project, 'commons', hash), bytes);
    writeFileSync(join(project, 'shard.config.ts'), `import { emptyShardfile } from '@wildshard/sdk/author';\nconst shard=emptyShardfile({slug:'example',name:'Example',author:'Local',seed:1,revision:1});\nshard.requires.commons.push('${hash}');\nshard.requires.commonsWire['${hash}']=${bytes.length};\nshard.requires.commonsCosts['${hash}']=${JSON.stringify(assetCost('binary', bytes))};\nshard.library.push('commons:${hash}');\nexport default shard;\n`);
    await buildProject(project, join(root, 'product'));
    expect([...readFileSync(join(root, 'product', hash))]).toEqual([...bytes]);
    expect(readdirSync(join(root, 'product')).filter((name) => name === hash)).toHaveLength(1);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 30_000);
