import { outputPlatformPayloads } from '../src/sdk/outputProduct';
import { parseClientPlan } from '../src/format/clientPlan';
import { nineNativeConstants } from './fixtures/nine-native-constants';
// oxlint-disable-next-line import/no-nodejs-modules -- Compile the actual authored guest source, without generated metadata.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { compileScriptV2 } from '../src/sdk/bake/compileScriptV2';
import { hashImmutableBytes } from '../src/sdk/immutable';
import product, { nineProduct, inputs } from './fixtures/nine-product-inputs';
import { output } from './fixtures/nine-source-program';
import { SCRIPT_V2_REVISIONS } from '../src/format/scriptAdmissionV2';
import { nineOutput as emitNineOutput } from '../src/shards/nine-dragon-stack/generators/productOutput';

test('the product uses the supplied view memory while retaining every other declaration field', () => {
  expect(nineProduct({ pages: 1 })).toEqual(product);
  const larger = nineProduct({ pages: 2 });
  expect(larger.budgets.library.resident).toBe(product.budgets.library.resident + 131072);
  expect({ ...larger, budgets: product.budgets }).toEqual(product);
});

test('supplied source inputs own their executable, decals and entry proof', async () => {
  const bytes = await compileScriptV2(readFileSync('src/shards/nine-dragon-stack/behaviour/movers.as', 'utf8'), { lane: 'view', ioBytes: 4096 });
  const hash = hashImmutableBytes(bytes), actual = output;
  // Supply distinct proof and decal rows directly, without a file-reader fallback.
  const burst = { name: 'fixture', shape: 'flake' as const, count: 1, life: .5 };
  const suppliedInputs = { courseProgram: inputs.courseProgram, casts: inputs.casts, signs: inputs.signs, ownedWorld: inputs.ownedWorld, scenes: inputs.scenes, held: inputs.held, construction: { seed: product.identity.seed, looks: Object.keys(product.look.materials) },
    scriptRevisions: SCRIPT_V2_REVISIONS, graphArmsSchema: { type: 'object' },
    bursts: { muzzle: burst, bite: burst, dock: burst, sparks: burst }, entryProof: { lanes: 1, steps: 2, portalTransfers: 3 },
    decals: { sources: { phone: { width: 1, height: 1, png: 'phone.png' }, desktop: { width: 2, height: 2, png: 'desktop.png' } } } };
  const supplied = emitNineOutput({ hash, bytes }, suppliedInputs);
  expect(supplied.namedFiles.some(row => row.name === 'sim/headless-assembly.json')).toBe(false);
  expect(supplied.blobs.filter(row => row.name.startsWith('looks/jian-decal-')).map(row => row.source)).toEqual(['phone.png', 'desktop.png']);
  expect(supplied.namedFiles.some(row => row.name === 'sim/headless-constants.json')).toBe(false);
  const policies = await nineNativeConstants();
  const plan = parseClientPlan(outputPlatformPayloads(supplied.platform, ['client/plan']).get('client/plan'));
  expect(plan.features.find(row => row.kind === 'held.claims.enter')).toMatchObject({
    grapple: { profile: policies.grappleProfile, hooks: policies.hooks },
  });
  expect(plan.features.find(row => row.kind === 'portal.ride')).toEqual({ kind: 'portal.ride', rows: policies.portalRide });
  const mover = actual.namedFiles.find(row => row.name === 'views/movers.wasm');
  expect(mover).toMatchObject({ name: 'views/movers.wasm', hash, path: `blobs/wasm/${hash}.wasm`, compressed: bytes.byteLength, critical: true });
  const owned = actual.assets.get(hash);
  if (owned === undefined) throw new Error('Missing owned movers bytes');
  expect(hashImmutableBytes(owned)).toBe(hash);
  expect(() => emitNineOutput({ hash: '0'.repeat(64), bytes }, suppliedInputs)).toThrow('bytes differ from module hash');
});
