import { parseCoverAppearance } from '../src/format/coverAppearance';
import { HeldEquipmentSchema } from '../src/format/heldEquipment';
import { outputPlatformPayloads } from '../src/sdk/outputProduct';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { SECTIONS } from '../src/shards/pine-hollow/generators/sectionSchemas.generated';

// The Pine client's product reads (sp-o270): every custom section and named blob runtime/ asks the built output for is
// emitted, with the shapes the readers convert (skin pickups, wildlife voices, mount packs).
test('Pine client reads resolve against the emitted output', async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow'), custom = loaded.output.custom;
  if (custom === undefined) throw new Error('Pine custom sections absent');
  const value = <K extends keyof typeof SECTIONS>(name: K): v.InferOutput<(typeof SECTIONS)[K]> => {
    const row = custom.sections.find(entry => entry.name === name), bytes = row === undefined ? undefined : custom.files.get(row.path);
    if (bytes === undefined) throw new Error(`Pine output has no ${name}`);
    return v.parse(SECTIONS[name], JSON.parse(new TextDecoder().decode(bytes)));
  };
  const rows = loaded.shard.items.pickups ?? {};
  expect(Object.keys(rows).sort()).toEqual(['blackpaw', 'ghost-stag', 'hollow-ash', 'imperial', 'ironhide', 'scarback-furnace', 'warden']);
  const inventory = value('custom/questInventory');
  expect(inventory.feats.length).toBeGreaterThan(0);
  expect(inventory.items.length).toBeGreaterThan(0);
  const shots = loaded.shard.audio.bank?.shots;
  if(shots===undefined)throw new Error('Pine admitted voice identities absent');
  for (const voice of Object.values(value('custom/ambientLife').sounds)) expect(shots.includes(voice), voice).toBe(true);
  expect(shots.length).toBe(new Set(shots).size);
  for (const geometry of value('custom/trophyMounts').rows.geometries) expect(geometry.own).toBeNull();
  const names = new Set(loaded.output.namedFiles?.map(row => row.name));
  const coverFile = loaded.output.namedFiles?.find(row => row.name === 'look/cover-appearance.json');
  const coverBytes = coverFile === undefined ? undefined : loaded.assets.get(coverFile.hash);
  if (coverBytes === undefined) throw new Error('Pine output has no cover appearance');
  const appearance = parseCoverAppearance(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(coverBytes)));
  expect(Object.keys(appearance.textures).sort()).toEqual(['endGrain', 'ferns', 'glow', 'litter', 'moss', 'reeds', 'shrubs', 'stones']);
  expect(Object.keys(value('custom/paintedTextures').textures).sort()).toEqual(['chalk', 'coatArm', 'coatMap', 'coatNormal']);
  const held = v.parse(HeldEquipmentSchema, outputPlatformPayloads(loaded.output.platform,['held/equipment']).get('held/equipment'));
  const wanted = [held.firearm.pool.url, held.launcher.pool.url, value('custom/trophyMounts').url,
    ...Object.values(value('custom/paintedTextures').textures).map(row => row.url),
    ...Object.values(appearance.textures).map(row => row.url),
    'world/ambience.json', 'actors/elites.json', ...['night', 'director'].map(stem => `behaviour/${stem}.wasm`),
    ...['ironhide', 'ghost-stag', 'blackpaw', 'imperial-bull'].map(stem => `behaviour/elites/${stem}.wasm`)];
  for (const name of wanted) expect(names.has(name), name).toBe(true);
}, 30000);
