import { expect, test } from 'vitest';
import * as v from 'valibot';
import { emptyShardfile } from '../src/sdk/author';
import { readProjectAssets } from '../src/sdk/project';
import { outputPlatformPayloads } from '../src/sdk/outputProduct';
import { HeldEquipmentSchema } from '../src/format/heldEquipment';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { HeldEquipment, heldLauncherProfile, heldFirearmSettings } from '../src/game/plugin/heldEquipment';
import { CROSSBOW_WEAPON_PROFILE } from '../src/shards/pine-hollow/generators/crossbowProfile';
import items from '../src/shards/pine-hollow/data/items.generated.json' with { type: 'json' };

// Another shard authors its own assets, hand materials, action presentation and motion.
test('a fictional harbour shard drives held equipment entirely from platform rows', async () => {
  const authored = await readProjectAssets('src/shards/pine-hollow');
  const rows = structuredClone(v.parse(HeldEquipmentSchema, outputPlatformPayloads(authored.output.platform, ['held/equipment']).get('held/equipment')));
  rows.firearm.asset.url = '/assets/harbour/weapons/harpoon-carbine.glb';
  rows.firearm.pool.url = 'harbour/carbine-details.glb'; rows.launcher.pool.url = 'harbour/harpoon.glb'; rows.hands.pool.url = 'harbour/hands.glb';
  rows.handNames = { hands: 'harbour-canvas', coat: 'harbour-oilskin' };
  rows.launcherTuning = { bury: .04, kick: .01, adsBlend: .25, adsMotion: .2, maxStuck: 17 };
  rows.firearmTuning = { ...rows.firearmTuning, kick: .02, brass: { count: 2, life: .8 } };
  rows.playback.crossbow = [{ id: 'harbour.pose', reads: [], nodes: [{ op: 'constant', value: .12 }], channels: [{ property: 'x', value: 0 }] }];
  const shardfile = emptyShardfile({ slug: 'fixture-harbour', name: 'Harbour', author: 'Fixture', revision: 1, seed: 7 });
  const product = createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile,
    sections: new Map([['held/equipment', rows]]), files: new Map(['harbour/carbine-details.glb', 'harbour/harpoon.glb', 'harbour/hands.glb']
      .map(name => [name, { hash: '0'.repeat(64), url: `/fixture/${name}` }])),
    read: () => Promise.reject(new Error('Fixture must not fetch a model')), check: true });
  const host = new HeldEquipment(product);
  expect(host.rows.handNames).toEqual(rows.handNames);
  expect(host.launcherRows(true).playback.groups.pose).toEqual(rows.playback.crossbow);
  expect(host.launcherRows().playback.groups.pose).toEqual([]);
  const launcher = heldLauncherProfile({ ...CROSSBOW_WEAPON_PROFILE, reserve: 4, interval: .6 }, rows.launcherTuning);
  expect(launcher).toMatchObject({ quiver: 5, cooldown: .6, bury: .04, kick: .01, adsBlend: .25, maxStuck: 17 });
  const rifle = items.rows.find(row => row.id === 'weapon.lever');
  const firearm = heldFirearmSettings(rifle?.profile, rows.firearm.rows.view, rows.firearmTuning);
  expect(firearm.profile.kick).toBe(.02); expect(firearm.profile.brass).toEqual({ count: 2, life: .8 });
  expect(() => new HeldEquipment(createShardProduct({ slug: shardfile.identity.slug, revision: 1, shardfile,
    sections: new Map([['held/equipment', { ...rows, launcherTuning: { ...rows.launcherTuning, maxStuck: -1 } }]]), files: new Map(),
    read: () => Promise.reject(new Error('No model fetch')), check: true }))).toThrow();
}, 30000);
