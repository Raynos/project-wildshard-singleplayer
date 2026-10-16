import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { SECTIONS } from '../src/shards/driftwood-isle/runtime/sections';
import { CHIME_PIECES } from '../src/shards/driftwood-isle/runtime/models/seaGlassChime';
import { driftwoodEffects } from '../src/shards/driftwood-isle/runtime/questRows';
import { DRIFTWOOD_FEATS, DRIFTWOOD_ITEMS } from '../src/shards/driftwood-isle/data/questInventory';
import { DRIFTWOOD_EFFECTS, GOODS } from '../src/shards/driftwood-isle/data/economy';

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
  const clip = value('custom/islandClips');
  expect(clip.ranges.reduce((sum, row) => sum + row.count, 0)).toBe(clip.outputIndices);
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
  expect(quest.items).toEqual(DRIFTWOOD_ITEMS); expect(quest.feats).toEqual(DRIFTWOOD_FEATS); expect(quest.goods).toEqual(GOODS);
  expect(driftwoodEffects(quest.effects)).toEqual(DRIFTWOOD_EFFECTS);
}, 30000);
