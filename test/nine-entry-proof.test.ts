// oxlint-disable-next-line import/no-nodejs-modules -- The fixture gives the real SDK capability an explicit source root.
import { resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../src/sdk/configBoundary';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { nineEntryProof } from '../src/shards/nine-dragon-stack/generators/entryProof';
import { Physics } from '../src/engine/physics/Physics';
import { emptyShardfile } from '../src/sdk/author';
import { portalEntryRows } from '../src/shards/nine-dragon-stack/generators/portalEntries';
import { portalFloorRows } from '../src/shards/nine-dragon-stack/generators/portalFloors';

const context = () => createProjectGeneration(resolve('src/shards/nine-dragon-stack'), 'e'.repeat(64), new Map());
const base = () => emptyShardfile({ slug: 'proof-fixture', name: 'Proof', author: 'Test', revision: 1, seed: 1 });

test('the injected capability repeats the original complete Nine capsule proof in fresh disposed worlds', async () => {
  const dispose = vi.spyOn(Physics.prototype, 'dispose'), ctx = context();
  try {
    const original = { lanes: 92, steps: 15984, portalTransfers: 8 };
    expect(await nineEntryProof(ctx)).toEqual(original); expect(await nineEntryProof(ctx)).toEqual(original);
    expect(dispose).toHaveBeenCalledTimes(2);
  } finally { dispose.mockRestore(); }
});

test('static-only capability refuses ordinary edges before constructing a world', async () => {
  const dispose = vi.spyOn(Physics.prototype, 'dispose');
  try {
    await expect(context().proveStaticPortalEntries(base(), [])).rejects.toThrow('only declared portal links');
    expect(dispose).not.toHaveBeenCalled();
  } finally { dispose.mockRestore(); }
});

test('malformed pieces and missing grounded collision refuse and still dispose their native worlds', async () => {
  const dispose = vi.spyOn(Physics.prototype, 'dispose'), source = base(), ctx = context();
  const portal = { ...source, entryways: portalEntryRows(), props: { version: 1 as const, family: 'pbr', tiles: [], panels: [], models: [], far: null, textures: [], colliders: portalFloorRows() } };
  try {
    await expect(ctx.proveStaticPortalEntries(portal, [{ id: 'invalid' }])).rejects.toThrow();
    await expect(ctx.proveStaticPortalEntries(portal, [])).rejects.toThrow('grounded named static collision');
    expect(dispose).toHaveBeenCalledTimes(2);
  } finally { dispose.mockRestore(); }
});


test('the authored entry proof bundles without importing its native capability implementation', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/shards/nine-dragon-stack/generators/entryProof.ts'), formats: ['es'] } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing Nine proof bundle');
  const chunks = built.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/src/sdk/projectEntryProof.ts'))).toBe(false);
    expect(Object.keys(chunk.modules).some(path => path.endsWith('/src/engine/physics/rapier.ts') || path.endsWith('/src/engine/physics/Physics.ts'))).toBe(false);
  }
});
