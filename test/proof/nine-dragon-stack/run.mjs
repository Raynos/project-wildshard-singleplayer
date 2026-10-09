// Nine Dragon's renderer-free witness. Checkpoints are regenerated explicitly and fenced by every loaded repo input.
// oxlint-disable-next-line import/no-nodejs-modules -- Proof CLI assertions reject browser globals.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- The proof mode and exit code are CLI outputs.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Capture the exact loaded headless closure for checkpoint freshness.
import { registerHooks } from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Read proof inputs, never live gameplay saves.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The checkpoint input fence is a SHA256 over source and asset bytes.
import { createHash } from 'node:crypto';

assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined');
const ROOT = new URL('../../../', import.meta.url), loaded = new Set([import.meta.url]);
registerHooks({ load(url, context, next) { if (url.startsWith(ROOT.href) && !url.includes('/node_modules/')) loaded.add(url); return next(url, context); } });
const { installAppIdentity } = await import('../../../src/engine/app/identity.ts');
const { WILDSHARD_IDENTITY } = await import('../../../src/game/identity.ts');
const witness = await import('./witness.ts');
// Admission loads this exact entry in every mode, so fresh/checkpoints/replay hash the same runtime closure.
await import('../../../src/shards/nine-dragon-stack/runtime/headless.ts');
installAppIdentity(WILDSHARD_IDENTITY);
function inputs() {
  const files = [...loaded, new URL('public/assets/physics/rapier.wasm', ROOT).href].sort();
  const hash = createHash('sha256');
  for (const url of files) hash.update(url.slice(ROOT.href.length)).update('\0').update(readFileSync(new URL(url))).update('\0');
  return hash.digest('hex');
}
const mode = process.argv.at(2) ?? 'all', fingerprint = inputs();
if (mode === 'fresh') {
  const result = witness.checkpointsFresh(fingerprint);
  console.info(JSON.stringify(result)); process.exitCode = result.status === 'fresh' ? 0 : 1;
} else if (mode === 'checkpoints') {
  console.info(JSON.stringify(await witness.writeCheckpoints(await witness.nineRapier(), fingerprint)));
} else {
  if (!['all', 'headless', 'replay', 'replay-ride', 'replay-crossing', 'ledger'].includes(mode)) throw new Error('Unknown compatibility proof mode');
  const rapier = await witness.nineRapier(), results = {};
  if (mode === 'all' || mode === 'headless') results.headless = await witness.headlessProof(rapier);
  if (mode === 'all' || mode === 'replay') {
    const ride = await witness.replayProof(rapier, fingerprint, 'ride'), crossing = await witness.replayProof(rapier, fingerprint, 'crossing');
    results.replay = { status: ride.status === 'passed' && crossing.status === 'passed' ? 'passed' : 'failed', ride, crossing };
  } else if (mode === 'replay-ride' || mode === 'replay-crossing') results.replay = await witness.replayProof(rapier, fingerprint, mode === 'replay-ride' ? 'ride' : 'crossing');
  if (mode === 'all' || mode === 'ledger') Object.assign(results, await witness.ledgerProof());
  const passed = name => results[name]?.status === 'passed';
  const compatible = passed('headless') && passed('replay') && results.ledger?.status === 'not-declared';
  console.info(JSON.stringify({ slug: 'nine-dragon-stack', entry: witness.ENTRY, compatible, ...witness.SCOPE, ...results }));
  process.exitCode = compatible || (mode === 'ledger' ? results.ledger?.status === 'not-declared' : passed(mode.startsWith('replay-') ? 'replay' : mode)) ? 0 : 1;
}
