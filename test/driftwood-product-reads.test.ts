import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { SECTIONS } from '../src/shards/driftwood-isle/runtime/sections';
import { CHIME_PIECES } from '../src/shards/driftwood-isle/runtime/models/seaGlassChime';

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
  for (const key of ['npc', 'hutChest', 'door', 'porch']) expect(layouts.hut.anchors[key], key).toBeDefined();
  for (const key of ['zipTop', 'beacon', 'shard', 'stairFoot']) expect(layouts.lookout.anchors[key], key).toBeDefined();
}, 30000);
