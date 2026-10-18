import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { parseRows } from '../src/format/rows';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { LootEconomySchema } from '../src/format/lootEconomy';
import source from '../src/shards/driftwood-isle/shard.config';
import { SECTIONS } from '../src/shards/driftwood-isle/generators/sections';
import { collectionRows } from '../src/shards/driftwood-isle/generators/collections';
import { DRIFTWOOD_FEATS, DRIFTWOOD_ITEMS } from '../src/shards/driftwood-isle/generators/questInventory';
import { DRIFTWOOD_EFFECTS, GOODS } from '../src/shards/driftwood-isle/generators/economy';

const CHIME_PIECES = collectionRows().keepsakes.flags.count;

// The Driftwood client's product reads (sp-o277, W2b): every custom section runtime/ asks the built output for is
// emitted and parses against the runtime registry, with the shapes its readers rely on.
test('Driftwood client reads resolve against the emitted output', async () => {
  const loaded = await readProjectAssets('src/shards/driftwood-isle'), custom = loaded.output.custom;
  if (custom === undefined) throw new Error('Driftwood custom sections absent');
  const value = <K extends keyof typeof SECTIONS>(name: K): v.InferOutput<(typeof SECTIONS)[K]> => {
    const row = custom.sections.find(entry => entry.name === name), bytes = row === undefined ? undefined : custom.files.get(row.path);
    if (bytes === undefined) throw new Error(`Driftwood output has no ${name}`);
    return v.parse(SECTIONS[name], JSON.parse(new TextDecoder().decode(bytes)));
  };
  expect(value('custom/cumulusPuffs').length).toBeGreaterThan(0);
  const layouts = value('custom/fixedLayouts');
  const collections = value('custom/collections');
  expect(collections.models['chime']?.ranges.length).toBe(CHIME_PIECES + 1);
  expect(layouts.cove.native.descs.some(row => row.kind === 'treads')).toBe(true);
  for (const kind of ['world', 'specimen'] as const) expect(layouts.shrine[kind].anchors['altar'], kind).toBeDefined();
  expect(Object.keys(collections.models['plaques']?.trophies?.full ?? {})).toHaveLength(2);
  for (const key of ['npc', 'hutChest', 'door', 'porch']) expect(layouts.hut.anchors[key], key).toBeDefined();
  for (const key of ['zipTop', 'beacon', 'shard', 'stairFoot']) expect(layouts.lookout.anchors[key], key).toBeDefined();
  const trail = value('custom/trailside');
  expect(trail.worldColliders.some(row => row.kind === 'treads')).toBe(true); expect(trail.posts.pls.length * 6).toBe(trail.posts.boxes.length);
  expect(loaded.shard.items.catalogue).toEqual(DRIFTWOOD_ITEMS);
  expect(loaded.shard.quests.achievements).toEqual(DRIFTWOOD_FEATS);
  expect(custom.sections.some(row => row.name === 'custom/questRows')).toBe(false);
  const economy = source.rows.loot[0]?.economy;
  expect(economy?.effects).toEqual(DRIFTWOOD_EFFECTS); expect(economy?.goods).toEqual(GOODS);
}, 30000);

test('effect rows retain identity values while refusing invalid effect ids and unnamespaced tags', () => {
  const schema = LootEconomySchema, base = source.rows.loot[0]?.economy;
  if (base === undefined) throw new Error('Missing admitted economy payload');
  const section = (effects: unknown) => ({ ...base, effects });
  const read = (effects: unknown) => v.parse(schema, section(effects));
  // The payload now ships in the platform section: re-admit the serialized wire through RowsSchema.
  const disk = (effects: readonly unknown[]) => {
    const previous = { id: 'effect.previous', kind: 'permanent', tags: [], modifiers: [], stacking: 'none' };
    const wire: unknown = JSON.parse(encodeCanonicalJson({ ...source.rows, loot: [{ ...source.rows.loot[0], economy: section([...base.effects, previous, ...effects]) }] }));
    const parsed = parseRows(wire).loot[0]?.economy;
    if (parsed === undefined) throw new Error('Missing parsed economy');
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
