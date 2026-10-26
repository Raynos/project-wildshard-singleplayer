// oxlint-disable-next-line import/no-nodejs-modules -- Complete shipped byte oracles and corrupt tools stay in owned fixture directories.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Owned fixture paths never enter the author bundle.
import { basename, dirname, resolve } from 'node:path';
import { expect, test } from 'vitest';
import { basisToolRecipe, prepareBasisTool } from '../src/sdk/bake/basisTool';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { skyCreaturePhoneProgram, CREATURE_PHONE_FILE } from '../src/shards/far-reach/generators/creaturePhoneProgram';

test('the native recipe preserves fused arithmetic on both normal build architectures', () => {
  for (const host of ['darwin', 'linux']) {
    expect(basisToolRecipe(host, 'arm64')).toEqual(['-ffp-contract=on']);
    expect(basisToolRecipe(host, 'x64')).toEqual(['-ffp-contract=on', '-mfma']);
  }
  expect(() => basisToolRecipe('linux', 'riscv64')).toThrow('Unsupported Basis build host');
  expect(() => basisToolRecipe('win32', 'x64')).toThrow('Unsupported Basis build host');
});

test('the normal checked host supplies original phone bytes through cold and persistent program execution', async () => {
  const scratch = mkdtempSync(resolve('tmp/basis-provider-'));
  const context = () => createProjectGeneration(resolve('src/shards/far-reach'), 'e'.repeat(64), new Map(), resolve(scratch, 'cache'),
    [{ prefix: '/assets/far-reach/', directory: resolve('public/assets/far-reach') }]);
  try {
    const ctx = context();
    if (ctx.basisEncoder === undefined) throw new Error('Missing checked host encoder capability');
    const provider = await ctx.basisEncoder(); expect(provider.identity).toMatch(/^[a-f0-9]{64}$/u);
    let encodes = 0;
    const encoder = { identity: provider.identity, encode: (image: Parameters<typeof provider.encode>[0]) => { encodes++; return provider.encode(image); } };
    const cold = await skyCreaturePhoneProgram(ctx, encoder), bytes = cold.get(CREATURE_PHONE_FILE);
    if (bytes === undefined) throw new Error('Missing phone output');
    expect([...cold.keys()]).toEqual([CREATURE_PHONE_FILE]); expect(bytes.length).toBe(2_053_504);
    expect(hashImmutableBytes(bytes)).toBe('70e5655f969dfb40edba0109d16d7baddc6faef7bede8d10d91c2e2661f7d8ad');
    expect(bytes).toEqual(new Uint8Array(readFileSync('public/assets/gpu/far-reach/rigs/storm-roc-70e5655f.glb')));
    bytes.fill(0);
    const persistent = context();
    if (persistent.basisEncoder === undefined) throw new Error('Missing persistent host encoder');
    expect((await persistent.basisEncoder()).identity).toBe(provider.identity);
    const hit = (await skyCreaturePhoneProgram(persistent, encoder)).get(CREATURE_PHONE_FILE);
    if (hit === undefined) throw new Error('Missing persistent phone output');
    expect(hashImmutableBytes(hit)).toBe('70e5655f969dfb40edba0109d16d7baddc6faef7bede8d10d91c2e2661f7d8ad'); expect(encodes).toBe(1);
    await expect(provider.encode({ index: 0, bytes: new Uint8Array(), width: 1024, height: 1024 })).rejects.toThrow();

    // A published cache is authority only for the exact executable it recorded; never rebuild or use PATH on corruption.
    const tool = await prepareBasisTool(), published = resolve(dirname(tool.file), '../..');
    const brokenRoot = resolve(scratch, 'tools'), broken = resolve(brokenRoot, basename(published));
    mkdirSync(resolve(broken, 'source/bin'), { recursive: true });
    writeFileSync(resolve(broken, 'receipt.json'), readFileSync(resolve(published, 'receipt.json')));
    await expect(prepareBasisTool(brokenRoot)).rejects.toThrow();
    writeFileSync(resolve(broken, 'source/bin/basisu'), new Uint8Array([1, 2, 3]));
    await expect(prepareBasisTool(brokenRoot)).rejects.toThrow('Pinned Basis executable identity differs');
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}, 180000);
