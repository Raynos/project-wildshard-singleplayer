// oxlint-disable-next-line import/no-nodejs-modules -- Read the same admitted products and native physics as the grid.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Trusted legacy entries are local, explicit test inputs.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Trusted entries need absolute module URLs.
import { pathToFileURL } from 'node:url';
import { expect, test } from 'vitest';
import { loadRapier } from '../src/engine/physics/rapier';
import { snapshotSimHost, restoreSimHost, serializeSimSnapshot, decodeSimSnapshot } from '../src/engine/sim/snapshot';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { createShardfileSim, bindShardfileSim } from '../src/game/plugin/simulation';
import { createTrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { productHeadlessSections } from '../src/sdk/headlessSections';
import { generateHeadlessModuleMap } from '../scripts/check-headless-assemblies.mjs';

const shards = ['_template', 'blender-template', 'ink-cel-valley', 'pastel-plain', 'driftwood-isle', 'pine-hollow', 'nalati-grasslands',
  'nine-dragon-stack', 'sunscar-dunes', 'far-reach'] as const;
const entries: Partial<Record<string, string>> = {
  'pine-hollow': 'test/fixtures/pine-headless.ts',
  'nalati-grasslands': 'src/shards/nalati-grasslands/boot/headlessModules.ts',
};

// G498: eviction, then return through the actual native installer/restore path.
// All ten live products are tested; sealed legacy products are never grid destinations.
// Renderer-owned kit parts have a separate mandatory quick check (Pine King).
for (const slug of shards) test(`${slug}: evict and re-enter with kit, held items and quest progress`, async () => {
  const product = await loadHeadlessProduct(`out/${slug}`), shard = product.shardfile;
  const descriptor = outputDescriptor(shard);
  if (descriptor === undefined) throw new Error('Missing admitted product inventory');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash,
    Uint8Array.from(readFileSync(`out/${slug}/${file.path}`))]));
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const entry = slug === 'driftwood-isle' || slug === 'nine-dragon-stack'
    ? generateHeadlessModuleMap(resolve('.'), slug) : entries[slug];
  const trusted = entry !== undefined || product.has('sim/runtime-plan');
  const options = entry === undefined ? undefined : { module: pathToFileURL(resolve(entry)).href };
  const preparation = { shard, assets, rapier, product };
  const sections = productHeadlessSections(product);
  const questPorts = { fact: () => undefined, coins: () => undefined };
  const first = trusted ? await createTrustedHeadlessResident(preparation, options)
    : createShardfileSim(shard, assets, { rapier, sections, quest: questPorts });
  let saved;
  try {
    // Exercise actual authored progress and equipment ownership, not an empty save.
    for (const quest of first.host.quests) {
      for (const flag of quest.def.startWhen?.all ?? []) first.host.flags.set(flag);
      const start = quest.def.startWhen?.any?.[0]; if (start !== undefined) first.host.flags.set(start);
      const step = quest.def.steps[0];
      for (const flag of step?.done.none ?? []) first.host.flags.clear(flag);
      for (const flag of step?.done.all ?? []) first.host.flags.set(flag);
      const done = step?.done.any?.[0]; if (done !== undefined) first.host.flags.set(done);
    }
    for (const flag of shard.items.loadout.native?.ownership ?? []) if (flag !== null) first.host.flags.set(flag);
    // Select a non-default held slot through its actual registered continuation.
    for (const adapter of first.host.adapters.values()) {
      const state = adapter.snapshot();
      if (state !== null && typeof state === 'object' && !Array.isArray(state) && 'held' in state && 'swap' in state) {
        const slots = shard.items.loadout.native?.slots;
        const held = slots?.at(-1); if (held !== undefined) adapter.restore({ ...state, held, swap: null });
      }
    }
    saved = decodeSimSnapshot(serializeSimSnapshot(snapshotSimHost(first.host)));
  } finally { first.dispose(); }
  // Nothing from the old native world survives; a fresh installer must recreate
  // its full adapter kit before strict restore accepts the held/quest state.
  const again = trusted ? await createTrustedHeadlessResident(preparation, options, saved)
    : { host: restoreSimHost(first.host.level, { rapier }, saved,
      host => { bindShardfileSim(host, shard, assets, { rapier, sections, quest: questPorts, restoring: true }); }), dispose() { this.host.dispose(); } };
  try {
    const restored = snapshotSimHost(again.host);
    expect(restored.flags).toEqual(saved.flags);
    expect(restored.quests).toEqual(saved.quests);
    expect(restored.slots).toEqual(saved.slots);
    expect(restored.adapters).toEqual(saved.adapters);
    again.host.step();
    expect(again.host.state.tick).toBe(saved.state.tick + 1);
    for (const flag of saved.flags) expect(again.host.flags.has(flag)).toBe(true);
  } finally { again.dispose(); }
}, 30_000);
