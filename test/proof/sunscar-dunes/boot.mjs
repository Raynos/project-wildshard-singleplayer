// Signal Dunes boots in plain Node through its declared trusted headless factory, as the shipping worker composes it.
// oxlint-disable-next-line import/no-nodejs-modules -- Native boot assertions must fail the process.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the shard's admitted in-tree bytes and the native physics module.
import { readFileSync } from 'node:fs';
import source from '../../../src/shards/sunscar-dunes/shard.config.ts';
import { loadRapier } from '../../../src/engine/physics/rapier.ts';
import { decodeSimSnapshot } from '../../../src/engine/sim/snapshot.ts';
import { installAppIdentity } from '../../../src/engine/app/identity.ts';
import { WILDSHARD_IDENTITY } from '../../../src/game/identity.ts';
import { createTrustedHeadlessAdapter } from '../../../src/sdk/headlessRuntime.ts';

assert.equal(typeof document, 'undefined'); assert.equal(typeof window, 'undefined');
installAppIdentity(WILDSHARD_IDENTITY);
const root = new URL('../../../', import.meta.url);
const rapier = await loadRapier(readFileSync(new URL('public/assets/physics/rapier.wasm', root)));
const assets = new Map(source.files.map((file) => [file.hash, new Uint8Array(readFileSync(new URL(`src/shards/sunscar-dunes/assets/${file.hash}`, root)))]));
// The declared entry (`runtime.entry`'s headless sibling, the one the witness and the worker load), never a URL from the shardfile.
const adapter = await createTrustedHeadlessAdapter({ shard: source, assets, rapier }, { module: new URL('src/shards/sunscar-dunes/runtime/headless.ts', root).href });
try {
  adapter.step([]);
  const commit = adapter.commit(), snapshot = decodeSimSnapshot(commit.snapshot);
  const homes = snapshot.entities.map((entity) => entity.id), steps = snapshot.adapters.map((entry) => entry.id).filter((id) => !id.startsWith('runtime.actor.'));
  assert.deepEqual(homes, source.runtime?.spawns?.homes.map((home) => home.id));
  assert.equal(commit.effects.length, 0);
  console.info(JSON.stringify({ native: true, tick: commit.tick, homes: homes.length, steps, terrain: source.terrain !== null, effects: commit.effects.length }));
} finally { adapter.dispose(); }
