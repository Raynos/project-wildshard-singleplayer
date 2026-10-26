import { beforeAll, expect, test } from 'vitest';
import { emitNamedBlobs } from '../src/sdk/blobs';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { parseAdventureContent, type AdventureContent } from '../src/format/questStory';
import { createQuestPlacements } from '../src/engine/world/interact/types';
import { Flags } from '../src/engine/world/interact/flags';
import { placesWithDiscovery } from '../src/engine/quest/view';
import { COMPLETE_CONTENT } from '../src/shards/driftwood-isle/generators/completion';
import { DRIFTWOOD_PLACES } from '../src/shards/driftwood-isle/generators/discovery';
import frames from '../src/shards/driftwood-isle/data/questFrames.json' with { type: 'json' };

let admitted: AdventureContent | undefined;
beforeAll(async () => {
  // Keep cold output construction inside this hook's original budget. The
  // whole-project publication check shares driftwood-product-reads' intake.
  const { output } = await import('../src/shards/driftwood-isle/generators/output');
  const file = output.namedFiles.find(row => row.name === 'quests/discovery.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (file === undefined || bytes === undefined) throw new Error('The product must publish the discovery catalogue');
  const published = emitNamedBlobs([{ file, bytes }]).assets.get(file.hash);
  if (published === undefined) throw new Error('The discovery catalogue must pass named-file admission');
  admitted = parseAdventureContent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(published)));
}, 30_000);
function content(): AdventureContent {
  if (admitted === undefined) throw new Error('The admitted discovery catalogue is required');
  return admitted;
}
// Frozen from the shipped parent authoring, before the product conversion.
const ORIGINAL_HASHES = ["5d3f8ae7fa088a2775976d70a35f8f90de65e2b669f870988673c30c504a9960", "59a81b473e3a47d79dc47ed4feb43ae9f9672357f14fb434d04f0996ae000c05", "1e7466d476fdc2dde0ae4475266f64d9833346b4f091d9ff5d11d7fcb88d9886"];
const hash = (value: unknown): string => hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(value)));

test('product completion copy, ordered places and guide thresholds retain the shipped catalogue', () => {
  const rows = content();
  expect([hash(COMPLETE_CONTENT), hash(rows.places), hash(rows.guide)]).toEqual(ORIGINAL_HASHES);
  expect(rows.glassCount).toBe(15);
  expect(rows.shardFlags).toEqual(['shard:lookout', 'shard:wreck', 'shard:cave']);
});

test('admitted places keep actual POI and late anchor resolution, pre-existing discovery and marker order', () => {
  const rows = content(), placement = createQuestPlacements({ terrain: (x, z) => x * .01 + z * .02, frames });
  placement.setAnchor('lookout.zipline', { x: 71, y: 6, z: 32, yaw: .4 });
  expect(rows.places.map(row => placement.place(row.at))).toEqual(DRIFTWOOD_PLACES.map(row => placement.place(row.at)));
  const flags = new Flags('discovery-product-fixture', false), toasts: string[] = [];
  flags.set('seen:hut');
  const places = placesWithDiscovery(rows.places.map(row => { const at = placement.place(row.at);
    return { id: row.id, label: row.label, x: at.x, z: at.z, r: row.r, quiet: row.id === 'pier' };
  }), flags, text => { toasts.push(text); }, () => []);
  expect(places.points.map(row => row.id)).toEqual(DRIFTWOOD_PLACES.map(row => row.id));
  expect(toasts).toEqual([]);
  const vista = places.points.find(row => row.id === 'vista');
  if (vista === undefined) throw new Error('The original vista must remain discoverable');
  places.update(vista.x, vista.z);
  expect(flags.has('seen:vista')).toBe(true);
  expect(flags.has('seen:hut')).toBe(true);
  expect(toasts).toContain('Discovered · VISTA POINT');
});

test('discovery catalogue refuses malformed coordinates and unknown completion policy', () => {
  const rows = content();
  expect(() => parseAdventureContent({ ...rows, complete: {} })).toThrow();
  expect(() => parseAdventureContent({ ...rows, guide: { ...rows.guide, retry: -1 } })).toThrow();
  expect(() => parseAdventureContent({ ...rows, places: [{ ...rows.places[0], at: { poi: 'world', x: Infinity, z: 0 } }] })).toThrow();
});
