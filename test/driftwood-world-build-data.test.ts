import { driftwoodPierScenes } from '../src/shards/driftwood-isle/generators/pierScenesBank';
import { DRIFTWOOD_GUEST_ROWS } from './fixtures/driftwood-guest-programs';
import { expect, test } from 'vitest';
import { floorAtRects } from '@wildshard/engine/physics/box';
import * as v from 'valibot';
import { parseWorldScenePlacement,parseWorldScenePlacementPage,WorldScenePlacementSchema } from '@wildshard/format/worldScenePlacement';
import { driftwoodOutputRows } from '../src/shards/driftwood-isle/generators/output';
import { driftwoodFoliageScenes } from '../src/shards/driftwood-isle/generators/foliageScenesBank';
import { DRIFTWOOD_LAYOUTS } from './fixtures/driftwood-layout-source';
import { DRIFTWOOD_ISLAND_FACTS } from './fixtures/driftwood-island-facts';
import { decodeEntryDecks } from '../src/shards/driftwood-isle/generators/entryDecks';
import { driftwoodEntryDeckRows } from '../src/shards/driftwood-isle/generators/entryDeck';
import { worldPlacements,uprightPoses } from '../src/shards/driftwood-isle/generators/worldPlacements';
import { driftwoodSceneBanks } from './fixtures/driftwoodSceneBanks';
import { islandFoliagePlacements } from '../src/shards/driftwood-isle/generators/islandDressing';

const foliage = islandFoliagePlacements(), decks = driftwoodEntryDeckRows(), output = driftwoodOutputRows(DRIFTWOOD_LAYOUTS, DRIFTWOOD_ISLAND_FACTS, DRIFTWOOD_GUEST_ROWS);

const finite=v.pipe(v.number(),v.finite());
const placement=v.strictObject({...WorldScenePlacementSchema.entries,poses:v.array(v.object({x:finite,y:finite,z:finite,
  matrix:v.array(finite),params:v.exactOptional(v.record(v.string(),v.unknown()))}))});
const foliageTier=v.object({palms:placement,hibiscus:placement});
const authoredScenes=v.parse(v.object({placements:v.object({phone:foliageTier,desktop:foliageTier})}),
  driftwoodFoliageScenes());

function rows(tier:'phone'|'desktop',kind:'palms'|'hibiscus') {
  const name=`world/placement-pages/foliage-${tier}.shared.0.json`,file=output.namedFiles.find(row=>row.name===name),bytes=file===undefined?undefined:output.assets.get(file.hash);
  if(bytes===undefined)throw new Error('Missing published placement page');
  const data:unknown=JSON.parse(new TextDecoder().decode(bytes));
  const row=parseWorldScenePlacementPage(data).rows.find(value=>value.id===`foliage.${kind==='palms'?'palms':'bushes'}.${tier}`);
  if(row===undefined)throw new Error('Missing original foliage member');
  return row;
}
test('published world-build data preserves both tiers of foliage in authored order', () => {
  for(const tier of ['phone','desktop']as const)for(const kind of ['palms','hibiscus']as const){
    const original=authoredScenes.placements[tier][kind];
    expect(rows(tier,kind).poses.map(({x,y,z,params})=>({x,y,z,params}))).toEqual(foliage.tiers[tier][kind==='palms'?'palms':'bushes'].placements);
    expect(rows(tier,kind)).toEqual(parseWorldScenePlacement({...original,poses:uprightPoses(original.poses),id:`foliage.${kind==='palms'?'palms':'bushes'}.${tier}`}));
  }
});
test('the moved build decoder retains cached-row and positive-footprint refusals', () => {
  expect(decodeEntryDecks(decks)).toEqual(decks.rows);
  const first = decks.rows[0]; if (first === undefined) throw new Error('Missing deck');
  expect(() => decodeEntryDecks({ ...decks, notice: 'hand edited' })).toThrow();
  expect(() => decodeEntryDecks({ ...decks, rows: [{ ...first, rect: { ...first.rect, maxX: first.rect.minX } }, ...decks.rows.slice(1)] })).toThrow('positive footprint');
});
test('canonical placement admission refuses unbounded foliage', () => {
  const data=rows('phone','palms'),first=data.poses[0];if(first===undefined)throw new Error('Missing palm');
  expect(()=>v.parse(WorldScenePlacementSchema,{...data,poses:Array.from({length:8193},()=>first)})).toThrow();
});

test('compiled deck floors preserve inclusive corners and adjacent floating-point edges', async () => {
  const floors = worldPlacements(await driftwoodSceneBanks()).find(row => row.id === 'entry.decks')?.piece?.floors ?? [], epsilon = Number.EPSILON * 256;
  expect(floors).toHaveLength(4);
  for (const { rect } of decks.rows) {
    const xs = [rect.minX - epsilon, rect.minX, (rect.minX + rect.maxX) / 2, rect.maxX, rect.maxX + epsilon];
    const zs = [rect.minZ - epsilon, rect.minZ, (rect.minZ + rect.maxZ) / 2, rect.maxZ, rect.maxZ + epsilon];
    for (const x of xs) for (const z of zs) {
      const expected = decks.rows.some(({ rect: r }) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) ? 0 : undefined;
      expect(floorAtRects(floors, x, z, 'first'), `${x},${z}`).toBe(expected);
    }
  }
});

test('bounded native pages retain every original pier and foliage member exactly once', () => {
  const pages=output.namedFiles.filter(row=>row.name?.startsWith('world/placement-pages/'));
  expect(pages).toHaveLength(3);
  const members=pages.flatMap(file=>{
    const bytes=output.assets.get(file.hash);if(bytes===undefined)throw new Error('Missing placement page body');
    const input:unknown=JSON.parse(new TextDecoder().decode(bytes));return parseWorldScenePlacementPage(input).rows;
  });
  expect(members).toHaveLength(12);
  expect(new Set(members.map(row=>row.id)).size).toBe(12);
  expect(output.namedFiles.some(row=>(row.name?.startsWith('world/piers/')??false)||(row.name?.startsWith('world/foliage/')??false))).toBe(false);
  for(const original of driftwoodPierScenes().placements){
    const serialized=JSON.stringify(original),wire:unknown=JSON.parse(serialized);
    expect(members.find(row=>row.id===original.id)).toEqual(parseWorldScenePlacement(wire));
  }
});
