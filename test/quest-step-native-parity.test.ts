import * as v from 'valibot';
import { expect, test } from 'vitest';
import { driftwoodWitness } from './proof/driftwood-isle/native';
import { pineWitness } from './proof/pine-hollow/native';
// oxlint-disable-next-line import/no-nodejs-modules -- Read only admitted product and native physics bytes.
import { readFileSync } from 'node:fs';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { loadRapier } from '../src/engine/physics/rapier';
import { PINE_TERRAIN } from '../src/shards/pine-hollow/data/terrainBindings';
import legacy from './fixtures/quest-step-legacy-saves.json' with { type: 'json' };
import type { SimValue } from '../src/engine/sim';

// Both witnesses regenerate and compare the recorded gameplay checkpoint payloads before replaying an existing
// save. Their retained recorder refuses any changed flags, rewards, effects or compressed save bytes on Darwin.
const Proof = v.object({ replay: v.object({ status: v.literal('passed'), checkpointCaptured: v.literal(true),
  hash: v.string(), replayHash: v.string(), suffixTicksExecuted: v.pipe(v.number(), v.minValue(1)) }) });
const SavedValue: v.GenericSchema<unknown, SimValue> = v.lazy(() => v.union([
  v.null(), v.boolean(), v.pipe(v.number(), v.finite()), v.string(), v.array(SavedValue), v.record(v.string(), SavedValue),
]));
// A cold Linux recorder plus replay exceeds 110 s; retain a bounded process deadline.
for (const [slug, witness] of [
  ['driftwood-isle', (mode: string) => driftwoodWitness(mode, 270_000)],
  ['pine-hollow', (mode: string) => pineWitness(mode, 270_000)],
] as const)
  test(`${slug}: recorded native quest saves restore and replay byte-identically`, () => {
    const result = witness('replay');
    expect(result.status, `${result.stderr}\n${result.stdout}`).toBe(0);
    const proof = v.parse(Proof, JSON.parse(result.stdout.split('\n').at(-1) ?? 'null'));
    expect(proof.replay.replayHash).toBe(proof.replay.hash);
  }, 300_000);

for (const slug of ['driftwood-isle', 'pine-hollow'] as const)
  test(`${slug}: an existing native quest envelope retains its exact bytes`, async () => {
    const product = await loadHeadlessProduct(`out/${slug}`), descriptor = outputDescriptor(product.shardfile);
    if (descriptor === undefined) throw new Error('Missing admitted native product');
    const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash,
      Uint8Array.from(readFileSync(`out/${slug}/${file.path}`))]));
    if (slug === 'pine-hollow') for (const path of [PINE_TERRAIN.terrain, PINE_TERRAIN.navmesh])
      assets.set(path, Uint8Array.from(readFileSync(path)));
    const rapier = await loadRapier(Uint8Array.from(readFileSync('public/assets/physics/rapier.wasm')));
    const resident = await createTrustedHeadlessResident({ product, shard: product.shardfile, assets, rapier },
      { module: new URL(slug === 'driftwood-isle' ? './fixtures/driftwood-headless.ts' : '../src/shards/pine-hollow/boot/headlessModules.ts', import.meta.url).href });
    try {
      const fixture = legacy[slug], owner = resident.host.adapters.get(fixture.adapter);
      if (owner === undefined) throw new Error('Missing existing quest save owner');
      owner.restore(v.parse(SavedValue, fixture.state));
      expect(JSON.stringify(owner.snapshot())).toBe(fixture.bytes);
      expect(resident.effects).toEqual([]);
    } finally { resident.dispose(); }
  }, 120_000);
