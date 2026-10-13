// oxlint-disable-next-line import/no-nodejs-modules -- Headless behaviour runs the real authored product bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The trusted worker entry is a local platform-selected file.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- No network or browser enters the authoritative simulation.
import { pathToFileURL } from 'node:url';
import { QuestState } from '../src/engine/quest/core';
import { Flags } from '../src/engine/world/interact/flags';
import { expect, it } from 'vitest';
import { parseShardfile } from '../src/format/shardSchema';
import { decodeSimSnapshot } from '../src/engine/sim/snapshot';
import { HeadlessSimulation } from '../src/sdk/headless';
import template from '../src/shards/_template/shard.config';
import pastel from '../src/shards/pastel-plain/shard.config';
import driftwood from '../src/shards/driftwood-isle/shard.config';
import pine from '../src/shards/pine-hollow/shard.config';
import nalati from '../src/shards/nalati-grasslands/shard.config';
import nine from '../src/shards/nine-dragon-stack/shard.config';
import signal from '../src/shards/sunscar-dunes/shard.config';
import sky from '../src/shards/far-reach/shard.config';

const cases = [
  ['_template', template, false], ['pastel-plain', pastel, false],
  ['driftwood-isle', driftwood, true], ['pine-hollow', pine, true],
  ['nalati-grasslands', nalati, true], ['nine-dragon-stack', nine, true],
  ['sunscar-dunes', signal, true], ['far-reach', sky, true],
] as const;

// Compatibility means a living headless shard, never a historical fingerprint or replay suffix.
for (const [slug, input, trusted] of cases) it(`${slug}: boots and advances a living headless simulation`, async () => {
  const source = parseShardfile(input);
  const assets = new Map(source.files.map(file => [file.hash, Uint8Array.from(readFileSync(`src/shards/${slug}/assets/${file.hash}`))]));
  for (const hash of source.requires.commons) assets.set(`commons:${hash}`, Uint8Array.from(readFileSync(`public/commons/${hash}`)));
  const sim = await HeadlessSimulation.create(source, assets, undefined, { deadline: 'advisory',
    ...(trusted ? { trustedRuntime: { module: pathToFileURL(resolve(slug === 'pine-hollow' ? 'test/fixtures/pine-headless.ts' : `src/shards/${slug}/runtime/headless.ts`)).href } } : {}) });
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

for (const [slug, input] of cases) for (const row of parseShardfile(input).quests.quests) it(`${slug}: ${row.title} completes without repeating its completion`, () => {
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
