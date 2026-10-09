// Nine Dragon Stack's whole-shard witness in plain Node: no browser, DOM shim, renderer or active application.
// oxlint-disable-next-line import/no-nodejs-modules -- Fail the native witness if browser globals or an invalid proof mode are present.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Native proof mode and failure status are CLI results, not game configuration.
import process from 'node:process';
import { installAppIdentity } from '../../../src/engine/app/identity.ts';
import { WILDSHARD_IDENTITY } from '../../../src/game/identity.ts';
import { ENTRY, SCOPE, nineRapier, headlessProof, replayProof, ledgerProof } from './witness.ts';

assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined');
installAppIdentity(WILDSHARD_IDENTITY);
const mode = process.argv.at(2) ?? 'all';
if (!['all', 'headless', 'replay', 'ledger'].includes(mode)) throw new Error('Unknown compatibility proof mode');
const rapier = await nineRapier(), results = {};
if (mode === 'all' || mode === 'headless') results.headless = await headlessProof(rapier);
if (mode === 'all' || mode === 'replay') results.replay = await replayProof(rapier);
if (mode === 'all' || mode === 'ledger') Object.assign(results, await ledgerProof());
// Nine declares no ledger rule: its compatibility is the headless and replay stages, with the ledger stage reporting
// `not-declared` (never a claimed emission); it is transitional: SCOPE lists what runs and what is still browser-only
const passed = name => results[name]?.status === 'passed';
const compatible = passed('headless') && passed('replay') && results.ledger?.status === 'not-declared';
console.info(JSON.stringify({ slug: 'nine-dragon-stack', entry: ENTRY, compatible, ...SCOPE, ...results }));
process.exitCode = compatible || (mode === 'ledger' ? results.ledger?.status === 'not-declared' : passed(mode)) ? 0 : 1;
