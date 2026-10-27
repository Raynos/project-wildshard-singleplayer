import { driftwoodPhysics } from '../src/shards/driftwood-isle/generators/physics';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { outputDescriptor } from '../src/game/shardfile/outputDescriptor';
import { builtProduct } from './fixtures/builtProduct';
import { parseRows } from '../src/format/rows';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { LootEconomySchema } from '../src/format/lootEconomy';
import { SECTIONS } from '../src/shards/driftwood-isle/generators/sections';
import { collectionRows } from '../src/shards/driftwood-isle/generators/collections';
import { DRIFTWOOD_FEATS, DRIFTWOOD_ITEMS } from '../src/shards/driftwood-isle/generators/questInventory';
import { DRIFTWOOD_EFFECTS, GOODS } from '../src/shards/driftwood-isle/generators/economy';
import { DRIFTWOOD_PLACES, GUIDE } from '../src/shards/driftwood-isle/generators/discovery';
import { SEA_GLASS_COUNT, SHARD_FLAGS } from '../src/shards/driftwood-isle/generators/interactables';

const nativePhysics=v.parse(v.object({solids:v.array(v.unknown())}),
  driftwoodPhysics());

const CHIME_PIECES = collectionRows().keepsakes.flags.count;
let pendingProduct: ReturnType<typeof loadHeadlessProduct> | undefined;
function emittedProduct(): ReturnType<typeof loadHeadlessProduct> {
  pendingProduct ??= Promise.resolve().then(() => loadHeadlessProduct(builtProduct('driftwood-isle')));
  return pendingProduct;
}

// The Driftwood client's product reads (sp-o277, W2b): every custom section runtime/ asks the built output for is
// emitted and parses against the runtime registry, with the shapes its readers rely on.
test('Driftwood client reads resolve against the emitted output', async () => {
  const loaded = await emittedProduct(), custom = outputDescriptor(loaded.shardfile)?.index;
  if (custom === undefined) throw new Error('Driftwood output descriptor absent');
  const value = <K extends keyof typeof SECTIONS>(name: K): v.InferOutput<(typeof SECTIONS)[K]> => v.parse(SECTIONS[name], loaded.section<unknown>(name));
  expect(value('custom/cumulusPuffs').length).toBeGreaterThan(0);
  const layouts = value('custom/fixedLayouts');
  expect(layouts.id).toBe('driftwood.island');
  const named=async(name:string):Promise<unknown>=>{
    const bytes=await loaded.file(name);
    const decoded:unknown=JSON.parse(new TextDecoder().decode(bytes));return decoded;
  };
  const catalogue=parseWorldSceneModels(await named('models/world-scenes.json'));
  // Keep complete discovery publication covered by actual emitted-product
  // intake; its focused policy fixture admits the same output independently.
  expect(await named('quests/discovery.json')).toEqual({ places: DRIFTWOOD_PLACES, guide: GUIDE,
    glassCount: SEA_GLASS_COUNT, shardFlags: SHARD_FLAGS });
  const anchors=(model:string,choice:string)=>catalogue.models.find(row=>row.key===model)?.choices.find(row=>row.id===choice)?.site?.anchors??{};
  const native=v.parse(v.object({constants:v.object({physics:v.object({solids:v.array(v.unknown())})})}),await named('sim/headless-assembly.json'));
  expect(native.constants.physics.solids).toEqual(nativePhysics.solids);
  const collections = value('custom/collections');
  expect(collections.models['chime']?.ranges.length).toBe(CHIME_PIECES + 1);
  for (const kind of ['world', 'specimen'] as const) expect(anchors('shrine',kind)['altar'], kind).toBeDefined();
  expect(Object.keys(collections.models['plaques']?.trophies?.full ?? {})).toHaveLength(2);
  for (const key of ['npc', 'hutChest', 'door', 'porch']) expect(anchors('hut','world')[key], key).toBeDefined();
  for (const key of ['zipTop', 'beacon', 'shard', 'stairFoot']) expect(anchors('lookout','world')[key], key).toBeDefined();
  // the trail's posts, signs and steps are world scene placements now (G3)
  expect(custom.sections.some(row => row.name === 'custom/trailside')).toBe(false);
  expect(loaded.shardfile.items.catalogue).toEqual(DRIFTWOOD_ITEMS);
  expect(loaded.shardfile.quests.achievements).toEqual(DRIFTWOOD_FEATS);
  expect(custom.sections.some(row => row.name === 'custom/questRows')).toBe(false);
  const economy = loaded.shardfile.rows.loot[0]?.economy;
  if (economy === undefined || 'kind' in economy) throw new Error('Missing coin economy');
  expect(economy.effects).toEqual(DRIFTWOOD_EFFECTS); expect(economy.goods).toEqual(GOODS);
}, 30000);

test('effect rows retain identity values while refusing invalid effect ids and unnamespaced tags', async () => {
  const source = (await emittedProduct()).shardfile;
  const schema = LootEconomySchema, base = source.rows.loot[0]?.economy;
  if (base === undefined || 'kind' in base) throw new Error('Missing admitted coin economy payload');
  const section = (effects: unknown) => ({ ...base, effects });
  const read = (effects: unknown) => v.parse(schema, section(effects));
  // The payload now ships in the platform section: re-admit the serialized wire through RowsSchema.
  const disk = (effects: readonly unknown[]) => {
    const previous = { id: 'effect.previous', kind: 'permanent', tags: [], modifiers: [], stacking: 'none' };
    const wire: unknown = JSON.parse(encodeCanonicalJson({ ...source.rows, loot: [{ ...source.rows.loot[0], economy: section([...base.effects, previous, ...effects]) }] }));
    const parsed = parseRows(wire).loot[0]?.economy;
    if (parsed === undefined || 'kind' in parsed) throw new Error('Missing parsed coin economy');
    return parsed.effects.slice(-effects.length);
  };
  const row = { id: 'effect.perk', kind: 'permanent', tags: ['status.perk'], modifiers: [], stacking: 'none',
    grants: ['cosmetic.perk'], removes: ['effect.previous'] };
  expect(read([row]).effects).toEqual([row]);
  expect(disk([row])).toEqual([row]);
  // These were identity reconstructions in the deleted adapter, including an empty suffix or namespace.
  const edges = { ...row, id: 'effect.', tags: ['.'], grants: ['.perk', 'status.'], removes: ['effect.'] };
  expect(read([edges]).effects).toEqual([edges]);
  expect(disk([edges])).toEqual([edges]);
  const longest = { ...row, id: `effect.${'x'.repeat(505)}`, tags: [`.${'x'.repeat(511)}`] };
  expect(read([longest]).effects).toEqual([longest]);
  expect(disk([longest])).toEqual([longest]);
  for (const changed of [
    { id: 'perk' }, { id: `effect.${'x'.repeat(506)}` }, { id: 1 },
    { tags: ['perk'] }, { grants: ['perk'] }, { removes: ['perk'] },
    { tags: [`status.${'x'.repeat(506)}`] }, { tags: [null] },
  ]) {
    expect(() => read([{ ...row, ...changed }])).toThrow();
    expect(() => disk([{ ...row, ...changed }])).toThrow();
  }
}, 30000);
