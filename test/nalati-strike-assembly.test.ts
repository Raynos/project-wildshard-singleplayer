// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real admitted native product and Rapier binary.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import * as encounters from '../src/game/shardfile/eliteEncounters';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { nalatiNativeAssets } from './proof/nalati-grasslands/nativeAssets';
import source from '../src/shards/nalati-grasslands/shard.config';
import { NALATI_STRIKES, sampleStrike } from './fixtures/nalati-strikes';

test('Nalati admitted elite contacts retain every original shape and cover refusal', async () => {
  const capture = vi.spyOn(encounters, 'installEliteEncounters');
  const { prepareHeadlessRuntime } = await import('./fixtures/nalati-headless');
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const plan = await prepareHeadlessRuntime({ shard: source, assets: nalatiNativeAssets(source), rapier,
    product: await loadHeadlessProduct('out/nalati-grasslands') });
  const host = createSimHost(plan.level, { ...plan.ports, rapier });
  try {
    plan.install(host, { restoring: false, commands: () => [], emit: () => undefined });
    const installed = capture.mock.calls.find(([owner]) => owner === host)?.[1].ports;
    const actor = [...host.entities.values()][0];
    if (installed === undefined || actor === undefined) throw new Error('Missing actual native elite contact ports');
    let accepted = 0, refused = 0;
    for (const name of ['swipe', 'pounce', 'bite'] as const) {
      const actual = installed.strikes[name], expected = NALATI_STRIKES[name];
      const { weight: _actualWeight, ...actualRows } = actual;
      const { weight: _expectedWeight, ...expectedRows } = expected;
      expect(actualRows).toEqual(expectedRows);
      for (const reach of [false, true]) for (let x = -6; x <= 6; x += .5) for (let z = -6; z <= 6; z += .5) {
        const target = new Vector3(actor.position.x + x, actor.position.y, actor.position.z + z);
        let actualHits = 0, expectedHits = 0;
        const next = installed.strike(actual, actor, target, () => { actualHits++; }, { reach: () => reach });
        const prior = sampleStrike(expected, actor, target, () => { expectedHits++; }, { reach: () => reach });
        expect([next, actualHits]).toEqual([prior, expectedHits]);
        if (next) accepted++; else refused++;
      }
    }
    expect(accepted).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  } finally { host.dispose(); capture.mockRestore(); }
}, 120_000);
