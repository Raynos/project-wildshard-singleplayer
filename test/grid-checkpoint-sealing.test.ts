// oxlint-disable-next-line import/no-nodejs-modules -- Capture a native checkpoint with the shipped Rapier binary.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { loadRapier } from '../src/engine/physics/rapier';
import { createSimHost } from '../src/engine/sim';
import { snapshotSimHostBytes, SIM_REGION_SNAPSHOT_CHAR_BUDGET } from '../src/engine/sim/snapshot';
import { SaveStore } from '../src/engine/saves/store';
import { fnv1a32 } from '../src/engine/core/rng';
import { GridRegionDurability } from '../src/game/grid/durability';
import template from '../src/shards/_template/shard.config';
import { SIM_LEVEL } from './fixtures/sim-level/level';
import { MemoryStorage } from './setup';

const documentSchema = v.object({ keys: v.record(v.string(), v.object({ v: v.number(), data: v.unknown() })) });
const regionSchema = v.object({ revision: v.number(), snapshot: v.nullable(v.string()), logical: v.unknown(), mode: v.picklist(['exact', 'logical']), integrity: v.number() });

it.each([
  { text: 'quote" slash\\ newline\n emoji🌲', mode: 'exact' },
  { text: '"\\\n'.repeat(100_000), mode: 'logical' },
] as const)('keeps the actual escaped $mode envelope count and checksum within the unchanged quota', async ({ text, mode }) => {
  const rapier = await loadRapier(readFileSync('public/assets/physics/rapier.wasm'));
  const host = createSimHost(SIM_LEVEL, { rapier });
  const local = new MemoryStorage(), store = new SaveStore({ local, session: new MemoryStorage() });
  const source = { ...template, identity: { ...template.identity, slug: SIM_LEVEL.id }, ledger: [] };
  const identity = { id: SIM_LEVEL.id, shard: SIM_LEVEL.id };
  const owner = new GridRegionDurability(store, identity, source, []);
  try {
    host.slots.scriptGlobals['escaping'] = text;
    const snapshot = snapshotSimHostBytes(host);
    expect(owner.checkpoint(snapshot)).toBe(true);
    const key = Array.from({ length: local.length }, (_, index) => local.key(index)).find(name => name?.endsWith(identity.id));
    if (key === undefined || key === null) throw new Error('Missing durable region');
    const stored = local.getItem(key); if (stored === null) throw new Error('Missing durable bytes');
    const document = v.parse(documentSchema, JSON.parse(stored));
    const slot = document.keys['platform.region']; if (slot === undefined) throw new Error('Missing continuation');
    const region = v.parse(regionSchema, slot.data);
    const actualCharacters = JSON.stringify({ keys: { 'platform.region': slot } }).length;
    expect(owner.state()).toEqual({ mode, characters: actualCharacters });
    expect(actualCharacters).toBeLessThanOrEqual(SIM_REGION_SNAPSHOT_CHAR_BUDGET);
    expect(region.integrity).toBe(fnv1a32(JSON.stringify({ revision: region.revision, snapshot: region.snapshot, logical: region.logical, mode: region.mode })));
    const reopened = new GridRegionDurability(new SaveStore({ local, session: new MemoryStorage() }), identity, source, []);
    if (mode === 'exact') expect(reopened.read()?.slots.scriptGlobals['escaping']).toBe(text);
    else { expect(region.snapshot).toBeNull(); expect(reopened.read(true)).toBeUndefined(); }
  } finally { host.dispose(); }
});
