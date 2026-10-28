/// <reference types="node" />
// oxlint-disable-next-line import/no-nodejs-modules -- Headless behaviour runs the real authored product bytes.
import { readFileSync } from 'node:fs';
import { QuestState } from '../src/engine/quest/core';
import { Flags } from '../src/engine/world/interact/flags';
import { afterAll, expect, it, vi } from 'vitest';
import { parseShardfileField } from '../src/sdk/shardfile';
import { decodeSimSnapshot } from '../src/engine/sim/snapshot';
import { HeadlessSimulation } from '../src/sdk/headless';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { builtProduct } from './fixtures/builtProduct';
import { productHeadlessSections } from '../src/sdk/headlessSections';
import { createNativeProofWorker } from './fixtures/headless-worker';
// Admit the same verified products the native scenarios run. Quest-source
// declarations are checked separately without constructing whole author worlds.
const cases = await Promise.all([
  '_template', 'pastel-plain', 'driftwood-isle', 'pine-hollow',
  'nalati-grasslands', 'nine-dragon-stack', 'sunscar-dunes', 'far-reach',
].map(async slug => ({ slug, product: await loadHeadlessProduct(builtProduct(slug)) })));

// Each simulation owns a separate native worker. Overlap two independent
// starts/tick tapes without multiplying the file's peak native residency by five.
vi.setConfig({ maxConcurrency: 2 });
afterAll(() => { vi.resetConfig(); });

// Compatibility means a living headless shard, never a historical fingerprint or replay suffix.
for (const { slug } of cases) it.concurrent(`${slug}: boots and advances a living headless simulation`, async () => {
  const directory = builtProduct(slug), product = await loadHeadlessProduct(directory), source = product.shardfile;
  const descriptor = outputDescriptor(source); if (descriptor === undefined) throw new Error('Missing admitted headless inventory');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash,
    Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  const nativeKinds = { 'driftwood-isle': 'driftwood', 'pine-hollow': 'pine', 'nine-dragon-stack': 'nine' } as const;
  const sections = productHeadlessSections(product);
  const nativeKind = !sections.has('sim/runtime-plan') && (slug === 'driftwood-isle' || slug === 'pine-hollow' || slug === 'nine-dragon-stack') ? nativeKinds[slug] : undefined;
  const sim = nativeKind === undefined
    ? await HeadlessSimulation.create(source, assets, undefined, { deadline: 'advisory', sections })
    : await createNativeProofWorker(source, assets, nativeKind, undefined, sections, directory);
  try {
    const first = decodeSimSnapshot((await sim.step()).snapshot);
    for (let tick = 0; tick < 24; tick++) await sim.step([{ source: 'player', commands: [{ kind: 'player', moveX: 0.2, moveZ: 0.2, yaw: 0 }] }]);
    const committed = sim.checkpoint;
    if (committed === undefined) throw new Error('Headless shard did not commit a live tick');
    expect(committed.tick).toBeGreaterThan(0);
    const state = decodeSimSnapshot(committed.snapshot);
    expect(state.player.position.every(Number.isFinite)).toBe(true);
    const distance = Math.hypot((state.player.position[0] ?? 0) - (first.player.position[0] ?? 0), (state.player.position[2] ?? 0) - (first.player.position[2] ?? 0));
    expect(distance).toBeGreaterThan(0);
    expect(state.player.motor.result.grounded).toBe(true); // real character collision supports the player's feet
    expect(sim.quarantined).toBe(false);
  } finally { await sim.dispose(); }
}, 120_000);

for (const { slug, product } of cases) for (const row of product.shardfile.quests.quests) it(`${slug}: ${row.title} completes without repeating its completion`, () => {
  const flags = new Flags(`behaviour.${slug}`, false), quest = new QuestState(row, flags);
  let completed = false, repeated = false;
  quest.observe({ complete: () => { if (completed) repeated = true; completed = true; } });
  const satisfy = (condition: { all?: readonly string[]; any?: readonly string[]; none?: readonly string[] } | undefined): void => {
    for (const flag of condition?.none ?? []) flags.clear(flag);
    for (const flag of condition?.all ?? []) flags.set(flag);
    const choice = condition?.any?.at(0); if (choice !== undefined) flags.set(choice);
  };
  try {
    satisfy(row.startWhen);
    for (const step of row.steps) satisfy(step.done);
    expect(quest.isComplete).toBe(true); expect(completed).toBe(true);
    for (const step of row.steps) satisfy(step.done);
    expect(repeated).toBe(false);
  } finally { quest.dispose(); }
});

// Keep the independent complete source oracle without baking geometry, textures
// or Wasm merely to read quest declarations. These are the same quest leaves and
// achievement compositions the eight original product constructors consume.
it('admitted quest inventories match the original source declarations', async () => {
  const [template, pastel, driftwood, driftwoodFeats, pine, pineFeats, nalati, nalatiFeats, signal, sky] = await Promise.all([
    import('../src/shards/_template/data/quests.json'), import('../src/shards/pastel-plain/data/quests.json'),
    import('../src/shards/driftwood-isle/generators/quests'), import('../src/shards/driftwood-isle/generators/questInventory'),
    import('../src/shards/pine-hollow/generators/quests'), import('../src/shards/pine-hollow/generators/questInventory'),
    import('../src/shards/nalati-grasslands/data/questContent.json'), import('../src/shards/nalati-grasslands/data/feats.json'),
    import('../src/shards/sunscar-dunes/generators/quests'), import('../src/shards/far-reach/generators/quests'),
  ]);
  const expected = {
    '_template': template.default, 'pastel-plain': pastel.default,
    'driftwood-isle': { ...driftwood.DRIFTWOOD_QUESTS, achievements: driftwoodFeats.DRIFTWOOD_FEATS },
    'pine-hollow': { ...pine.PINE_QUESTS, achievements: pineFeats.PINE_FEATS },
    'nalati-grasslands': { ...nalati.default.quests, achievements: nalatiFeats.default },
    // Nine's product keeps emptyShardfile's unmodified quest default.
    'nine-dragon-stack': undefined,
    'sunscar-dunes': signal.SIGNAL_QUESTS, 'far-reach': sky.SKY_QUESTS,
  };
  expect(Object.fromEntries(cases.map(({ slug, product }) => [slug, product.shardfile.quests])))
    .toStrictEqual(Object.fromEntries(Object.entries(expected).map(([slug, input]) => [slug, parseShardfileField('quests', input)])));
}, 120_000);
