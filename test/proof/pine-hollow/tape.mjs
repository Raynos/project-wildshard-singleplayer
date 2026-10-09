// Pine Hollow's witness tape in plain Node (no browser, DOM shim, renderer or active application): the day's legs, spawn to
// the den's lantern, by tick commands alone (witness.ts). Pine's headless closure still needs Node's type transform (the
// game layer's eliteSystem.ts uses constructor parameter properties, which strip-only mode refuses), so:
//   node --experimental-transform-types --import ./scripts/sim-node-loader.mjs test/proof/pine-hollow/tape.mjs
// The canonical witness (run.mjs, compatibility.json, the checkpointed slices) is the next lane's; run.mjs stays the
// fail-closed probe until then.
// oxlint-disable-next-line import/no-nodejs-modules -- Fail the native witness if browser globals are present.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- The tape's status is the CLI result.
import process from 'node:process';
import { installAppIdentity } from '../../../src/engine/app/identity.ts';
import { WILDSHARD_IDENTITY } from '../../../src/game/identity.ts';
import { ENTRY, dayProof, pineRapier } from './witness.ts';

assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined');
installAppIdentity(WILDSHARD_IDENTITY);
const result = await dayProof(await pineRapier());
console.info(JSON.stringify({ slug: 'pine-hollow', entry: ENTRY, day: result }));
process.exitCode = result.status === 'passed' ? 0 : 1;
