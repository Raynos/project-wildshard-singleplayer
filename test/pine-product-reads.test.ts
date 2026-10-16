import { expect, test } from 'vitest';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { SECTIONS } from '../src/shards/pine-hollow/runtime/sections';
import { skinPickups } from '../src/shards/pine-hollow/runtime/loadout/skins';
import { PH_SHOTS, isPhShot } from '../src/shards/pine-hollow/runtime/audio/sfx';

// The Pine client's product reads (sp-o270): every custom section and named blob runtime/ asks the built output for
// exists in it, with the shapes the readers convert (skin pickups, wildlife voices).
test('Pine client reads resolve against the built product', async () => {
  const product = await loadHeadlessProduct('public/shardfiles/pine-hollow');
  const rows = skinPickups(product.section('custom/skinPickups', SECTIONS));
  expect(Object.keys(rows).sort()).toEqual(['blackpaw', 'ghost-stag', 'hollow-ash', 'imperial', 'ironhide', 'scarback-furnace', 'warden']);
  const inventory = product.section('custom/questInventory', SECTIONS);
  expect(inventory.feats.length).toBeGreaterThan(0);
  expect(inventory.items.length).toBeGreaterThan(0);
  const life = product.section('custom/ambientLife', SECTIONS);
  for (const voice of Object.values(life.sounds)) expect(isPhShot(voice), voice).toBe(true);
  expect(PH_SHOTS.length).toBe(new Set(PH_SHOTS).size);
  for (const name of ['custom/heldPlayback', 'custom/heldInputs', 'custom/heldSights', 'custom/leverPlayback'] as const) expect(product.has(name), name).toBe(true);
  const named = [product.section('custom/leverDetails', SECTIONS).pool.url, product.section('custom/crossbowPool', SECTIONS).pool.url,
    product.section('custom/trophyMounts', SECTIONS).url, ...Object.values(product.section('custom/paintedTextures', SECTIONS).textures).map(row => row.url),
    'behaviour/ironhide.wasm', 'behaviour/ghostStag.wasm', 'behaviour/blackpaw.wasm', 'behaviour/imperialBull.wasm', 'behaviour/night.wasm', 'behaviour/director.wasm'];
  for (const name of named) expect(product.hasFile(name), name).toBe(true);
  const mounts = product.section('custom/trophyMounts', SECTIONS);
  for (const geometry of mounts.rows.geometries) expect(geometry.own).toBeNull();
});
