import { expect,test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { strike } from '../src/sdk/species';
import eliteRoster from '../src/shards/nalati-grasslands/data/eliteRoster.json' with { type: 'json' };
import ecology from '../src/shards/nalati-grasslands/data/ecology.generated.json' with { type: 'json' };
import ridingTerrain from '../src/shards/nalati-grasslands/data/ridingTerrain.generated.json' with { type: 'json' };
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with { type: 'json' };

test('the shared assembly document retains the complete page elite roster and its contact lookup', async () => {
  const product = await readProjectAssets('src/shards/nalati-grasslands');
  const file = product.output.namedFiles?.find(row => row.name === 'sim/headless-assembly.json');
  const bytes = file === undefined ? undefined : product.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing actual admitted assembly document');
  const assembly = v.parse(v.object({ constants: v.object({ pageElites: v.unknown(),nativeRide: v.record(v.string(),v.unknown()),nativeField: v.object({ world: v.unknown() }) }) }),JSON.parse(new TextDecoder().decode(bytes)));
  expect(assembly.constants.nativeRide).not.toHaveProperty('world');
  expect(assembly.constants.nativeField.world).toEqual(ridingTerrain);
  expect(assembly.constants.pageElites).toEqual({ ...eliteRoster,presentation: Object.fromEntries(Object.values(ecology.elites).map(def => [def.id, {
    prompt: `Take the ${def.drop.skinName} ${def.drop.weapon} skin`, toast: `${def.drop.skinName} ${def.drop.weapon} skin — ${def.drop.blurb}`,
    hum: true, sting: { banner: .8, phase2: 1, kill: 'chunk' },
  }])),keepers: ecology.keeperElites,external: ecology.externalElites,
    strikes: [{ amount: 14,strike: strike(strikes.swipe) },{ amount: 35,strike: strike(strikes.pounce) },{ amount: 22,strike: strike(strikes.bite) },{ amount: 30,strike: strike(strikes.stoop) }],fallbackStrike: strike(strikes.captain) });
});
