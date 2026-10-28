/// <reference types="node" />
// oxlint-disable-next-line import/no-nodejs-modules -- Headless behaviour runs the real authored product bytes.
import { readFileSync } from 'node:fs';
import { QuestState } from '../src/engine/quest/core';
import { Flags } from '../src/engine/world/interact/flags';
import { afterAll, expect, it, vi } from 'vitest';
import { parseShardfile } from '../src/format/shardSchema';
import { decodeSimSnapshot } from '../src/engine/sim/snapshot';
import { HeadlessSimulation } from '../src/sdk/headless';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { builtProduct } from './fixtures/builtProduct';
import { productHeadlessSections } from '../src/sdk/headlessSections';
import { createNativeProofWorker } from './fixtures/headless-worker';
// Admit the same verified products the native scenarios run. Authored-world
// fixtures are deliberately loaded only after all native workers are disposed.
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

// Keep the independent source oracle, but never overlap its compiler/Wasm world
// construction with the native workers above. Compare complete inventories so a
// producer cannot silently drop a quest (or its flags, triggers or dialogue).
it('admitted quest inventories match the original source declarations', async () => {
  const [template, pastel, driftwood, pine, nalati, nine, signal, skyRows, navigation, movers] = await Promise.all([
    import('./fixtures/templateSource'), import('./fixtures/pastelSource'),
    import('./fixtures/driftwood-product-source'), import('./fixtures/pine-program'),
    import('./fixtures/nalati-product-source'), import('./fixtures/nine-product-inputs'),
    import('./fixtures/sunscar-source-program'), import('../src/shards/far-reach/generators/product'),
    import('./fixtures/sky-navigation'), import('./fixtures/sky-movers'),
  ]);
  const expected = {
    '_template': template.TEMPLATE_SOURCE, 'pastel-plain': pastel.PASTEL_SOURCE,
    'driftwood-isle': driftwood.default, 'pine-hollow': pine.PINE,
    'nalati-grasslands': nalati.default, 'nine-dragon-stack': nine.default,
    'sunscar-dunes': signal.source,
    'far-reach': skyRows.skyProductRows(navigation.originalSkyNavigation(), movers.originalSkyMovers()),
  };
  expect(Object.fromEntries(cases.map(({ slug, product }) => [slug, product.shardfile.quests])))
    .toStrictEqual(Object.fromEntries(Object.entries(expected).map(([slug, input]) => [slug, parseShardfile(input).quests])));
}, 120_000);
