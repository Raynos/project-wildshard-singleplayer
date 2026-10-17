import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { parseRows } from '../src/format/rows';
import { encodeCanonicalJson } from '../src/sdk/immutable';
import { LootEconomySchema } from '../src/format/lootEconomy';
import source from '../src/shards/driftwood-isle/shard.config';
import { SECTIONS } from '../src/shards/driftwood-isle/runtime/sections';
import { CHIME_PIECES } from '../src/shards/driftwood-isle/runtime/models/seaGlassChime';
import { DRIFTWOOD_FEATS, DRIFTWOOD_ITEMS } from '../src/shards/driftwood-isle/generators/questInventory';
import { DRIFTWOOD_EFFECTS, GOODS } from '../src/shards/driftwood-isle/generators/economy';

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
  expect(layouts.chimeSlots.length).toBe(CHIME_PIECES + 1);
  expect(layouts.cove.native.descs.some(row => row.kind === 'treads')).toBe(true);
  for (const kind of ['world', 'specimen'] as const) expect(layouts.shrine[kind].anchors['altar'], kind).toBeDefined();
  expect(layouts.trophySlots.boards.length).toBe(2);
  for (const key of ['npc', 'hutChest', 'door', 'porch']) expect(layouts.hut.anchors[key], key).toBeDefined();
  for (const key of ['zipTop', 'beacon', 'shard', 'stairFoot']) expect(layouts.lookout.anchors[key], key).toBeDefined();
  const trail = value('custom/trailside');
  expect(trail.worldColliders.some(row => row.kind === 'treads')).toBe(true); expect(trail.posts.pls.length * 6).toBe(trail.posts.boxes.length);
  const quest = value('custom/questRows');
  expect(quest.items).toEqual(DRIFTWOOD_ITEMS); expect(quest.feats).toEqual(DRIFTWOOD_FEATS);
  const economy = source.rows.loot[0]?.economy;
  expect(economy?.effects).toEqual(DRIFTWOOD_EFFECTS); expect(economy?.goods).toEqual(GOODS);
  expect(Reflect.has(quest, 'effects')).toBe(false); expect(Reflect.has(quest, 'goods')).toBe(false);
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
