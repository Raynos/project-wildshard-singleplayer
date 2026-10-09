// Sky Reach's whole-shard witness in plain Node: no browser, DOM shim, renderer or active application.
// `all` (and `headless` / `replay` / `ledger`) plays the whole spawn → Roc tape: the authoritative witness, compatibility.json.
// The `slice-*` modes are the CI-budget legs, resumed from the committed checkpoints; `checkpoints` regenerates those from
// the whole tape and `fresh` refuses a set written from other headless inputs.
// oxlint-disable-next-line import/no-nodejs-modules -- Fail the native witness if browser globals or an invalid proof mode are present.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Native proof mode and failure status are CLI results, not game configuration.
import process from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- The checkpoints' inputs hash: every repo module the witness loads.
import { registerHooks } from 'node:module';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the loaded modules' and the read assets' bytes.
import { readFileSync, readdirSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Hash the loaded modules' and the read assets' bytes.
import { createHash } from 'node:crypto';

assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined');
const ROOT = new URL('../../../', import.meta.url), loaded = new Set();
registerHooks({ load(url, context, next) { if (url.startsWith(ROOT.href) && !url.includes('/node_modules/')) loaded.add(url); return next(url, context); } });
const { installAppIdentity } = await import('../../../src/engine/app/identity.ts');
const { WILDSHARD_IDENTITY } = await import('../../../src/game/identity.ts');
const witness = await import('./witness.ts');
installAppIdentity(WILDSHARD_IDENTITY);

/** The headless inputs: every repo module the witness loaded (the runtime, the engine, the tape), the physics module and the shard's assets. */
function inputs() {
  const assets = new URL('src/shards/far-reach/assets/', ROOT);
  const files = [...loaded, new URL('public/assets/physics/rapier.wasm', ROOT).href, ...readdirSync(assets).map(name => new URL(name, assets).href)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const hash = createHash('sha256');
  for (const url of files) hash.update(url.slice(ROOT.href.length)).update('\0').update(readFileSync(new URL(url))).update('\0');
  return hash.digest('hex');
}

const mode = process.argv.at(2) ?? 'all';
const proofs = { headless: witness.headlessProof, replay: witness.replayProof, ledger: witness.ledgerProof };
const slices = { 'slice-step': witness.stepSlice, 'slice-replay': witness.replaySlice, 'slice-storm': witness.stormSlice, 'slice-ledger': witness.ledgerSlice };
if (mode === 'fresh') {
  const result = witness.checkpointsFresh(inputs());
  console.info(JSON.stringify(result)); process.exitCode = result.status === 'fresh' ? 0 : 1;
} else if (mode === 'checkpoints') {
  console.info(JSON.stringify(await witness.writeCheckpoints(await witness.skyRapier(), inputs())));
} else if (mode in slices) {
  const result = await slices[mode](await witness.skyRapier());
  console.info(JSON.stringify({ slug: 'far-reach', entry: witness.ENTRY, [mode]: result })); process.exitCode = result.status === 'passed' ? 0 : 1;
} else {
  if (mode !== 'all' && !(mode in proofs)) throw new Error('Unknown compatibility proof mode');
  const rapier = await witness.skyRapier(), results = {};
  for (const [name, proof] of Object.entries(proofs)) if (mode === 'all' || mode === name) results[name] = await proof(rapier);
  const compatible = Object.keys(proofs).every(name => results[name]?.status === 'passed');
  console.info(JSON.stringify({ slug: 'far-reach', entry: witness.ENTRY, compatible, ...results }));
  process.exitCode = compatible || (mode !== 'all' && results[mode]?.status === 'passed') ? 0 : 1;
}
