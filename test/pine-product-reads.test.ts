import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { SECTIONS } from '../src/shards/pine-hollow/runtime/sections';
import { PH_SHOTS, isPhShot } from '../src/shards/pine-hollow/runtime/audio/sfx';

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
  const rows = value('custom/skinPickups');
  expect(Object.keys(rows).sort()).toEqual(['blackpaw', 'ghost-stag', 'hollow-ash', 'imperial', 'ironhide', 'scarback-furnace', 'warden']);
  const inventory = value('custom/questInventory');
  expect(inventory.feats.length).toBeGreaterThan(0);
  expect(inventory.items.length).toBeGreaterThan(0);
  for (const voice of Object.values(value('custom/ambientLife').sounds)) expect(isPhShot(voice), voice).toBe(true);
  expect(PH_SHOTS.length).toBe(new Set(PH_SHOTS).size);
  for (const geometry of value('custom/trophyMounts').rows.geometries) expect(geometry.own).toBeNull();
  const names = new Set(loaded.output.namedFiles?.map(row => row.name));
  const wanted = [value('custom/leverDetails').pool.url, value('custom/crossbowPool').pool.url, value('custom/trophyMounts').url,
    ...Object.values(value('custom/paintedTextures').textures).map(row => row.url),
    ...['ironhide', 'ghostStag', 'blackpaw', 'imperialBull', 'night', 'director'].map(stem => `behaviour/${stem}.wasm`)];
  for (const name of wanted) expect(names.has(name), name).toBe(true);
}, 30000);
