// oxlint-disable-next-line import/no-nodejs-modules -- This fixture owns its source inputs and compiler cache.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve only the small fixture and original author sources.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { templateBehaviour, TEMPLATE_BEHAVIOUR_INPUTS } from '../src/shards/_template/generators/behaviour';

const original = { door: { hash: 'ecc886d8bbebcf190298ff9162b6bb364f2125606f5bdc8cc220ea28044f96ea', compressed: 710 },
  items: { hash: '7035c479edde46ee0baf713fce437fe21e7b61967154f36b5f1126708b2bfaa7', compressed: 740 },
  idle: { hash: '875e798b8b1be62129b477e6b85e7c45cf11ae67cba006596d869133b469726b', compressed: 3913 } };

test('cached source compilation retains all three original Wasm hashes and page bounds', async () => {
  mkdirSync('tmp', { recursive: true }); const root = mkdtempSync(resolve('tmp', 'template-behaviour-'));
  try {
    mkdirSync(resolve(root, 'behaviour'));
    for (const file of TEMPLATE_BEHAVIOUR_INPUTS) writeFileSync(resolve(root, file), readFileSync(resolve('src/shards/_template', file)));
    const assets = new Map<string, Uint8Array>(), ctx = createProjectGeneration(root, 'd'.repeat(64), assets, resolve(root, 'cache'));
    let calls = 0; const counted = { ...ctx, compileScript: (...args: Parameters<typeof ctx.compileScript>) => { calls++; return ctx.compileScript(...args); } };
    expect(await templateBehaviour(counted)).toEqual(original); expect(calls).toBe(3);
    expect(await templateBehaviour(counted)).toEqual(original); expect(calls).toBe(3);
    expect(await templateBehaviour(createProjectGeneration(root, 'd'.repeat(64), assets, resolve(root, 'cache')))).toEqual(original);
    const door = resolve(root, 'behaviour/door.as'); writeFileSync(door, `${readFileSync(door, 'utf8')}\n// changed source identity\n`);
    expect(await templateBehaviour(counted)).toEqual(original); expect(calls).toBe(6);
    expect([...assets.keys()].sort()).toEqual(Object.values(original).map(row => row.hash).sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});
