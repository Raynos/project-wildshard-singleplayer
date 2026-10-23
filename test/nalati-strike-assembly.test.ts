// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real admitted native product and Rapier binary.
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import * as rosters from '../src/engine/ai/eliteRoster';
import { createSimHost } from '../src/engine/sim';
import { loadRapier } from '../src/engine/physics/rapier';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { builtProduct } from './fixtures/builtProduct';
import { nalatiNativeAssets } from './proof/nalati-grasslands/nativeAssets';
import source from '../src/shards/nalati-grasslands/shard.config';
import { NALATI_STRIKES, sampleStrike } from './fixtures/nalati-strikes';
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };

test('Nalati admitted elite contacts retain every original shape and cover refusal', async () => {
  const OriginalRoster = rosters.NativeEliteRoster;
  const capture = vi.spyOn(rosters, 'NativeEliteRoster').mockImplementation(class extends OriginalRoster {});
  const { prepareHeadlessRuntime } = await import('./fixtures/nalati-headless');
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const plan = await prepareHeadlessRuntime({ shard: source, assets: nalatiNativeAssets(source), rapier,
    product: await loadHeadlessProduct(builtProduct('nalati-grasslands')) });
  const host = createSimHost(plan.level, { ...plan.ports, rapier });
  try {
    plan.install(host, { restoring: false, commands: () => [], emit: () => undefined });
    const call = capture.mock.calls.find(([, loans]) => loans.host === host), installed = call?.[1].kernel;
    const actor = [...host.entities.values()][0];
    if (installed === undefined || actor === undefined) throw new Error('Missing actual native elite contact ports');
    const profiles = v.parse(v.object({ kernels: v.array(v.object({ id: v.string(), profile: v.object({ spec: v.unknown() }) })) }), call?.[0]).kernels;
    expect(profiles.find(row => row.id === 'aqbars')?.profile.spec).toEqual(ecology.profiles.aqbars.spec);
    expect(profiles.find(row => row.id === 'kokbori')?.profile.spec).toEqual(ecology.profiles.kokbori.spec);
    let accepted = 0, refused = 0;
    for (const name of ['swipe', 'pounce', 'bite'] as const) {
      const expected = NALATI_STRIKES[name], actual = installed.strikes.find(row => row.id === expected.id);
      if (actual === undefined) throw new Error('Missing actual native strike');
      const { weight: _actualWeight, ...actualRows } = actual;
      const { weight: _expectedWeight, ...expectedRows } = expected;
      expect(actualRows).toEqual(expectedRows);
      for (const reach of [false, true]) for (let x = -6; x <= 6; x += .5) for (let z = -6; z <= 6; z += .5) {
        const target = new Vector3(actor.position.x + x, actor.position.y, actor.position.z + z);
        let actualHits = 0, expectedHits = 0;
        const next = installed.contacts.contact(actual, { actor, target, hit: () => { actualHits++; }, canReach: () => reach });
        const prior = sampleStrike(expected, actor, target, () => { expectedHits++; }, { reach: () => reach });
        expect([next, actualHits]).toEqual([prior, expectedHits]);
        if (next) accepted++; else refused++;
      }
    }
    expect(accepted).toBeGreaterThan(0);
    expect(refused).toBeGreaterThan(0);
  } finally { host.dispose(); capture.mockRestore(); }
}, 120_000);
