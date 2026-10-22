import { expect, test } from 'vitest';
import { floorAtRects } from '@wildshard/engine/physics/box';
import * as v from 'valibot';
import { parseWorldScenePlacement,WorldScenePlacementSchema } from '../src/format/worldScenePlacement';
import { output } from '../src/shards/driftwood-isle/generators/output';
import { decodeEntryDecks } from '../src/shards/driftwood-isle/generators/entryDecks';
import decks from '../src/shards/driftwood-isle/data/entryDecks.generated.json' with { type: 'json' };
import { WORLD_PLACEMENTS,uprightPoses } from '../src/shards/driftwood-isle/generators/worldPlacements';
import authoredScenes from '../src/shards/driftwood-isle/data/foliageScenes.generated.json' with {type:'json'};
import foliage from '../src/shards/driftwood-isle/data/foliagePlacements.generated.json' with { type: 'json' };

function rows(tier:'phone'|'desktop',kind:'palms'|'hibiscus') {
  const name=`world/foliage/${kind}-${tier}.json`,file=output.namedFiles.find(row=>row.name===name),bytes=file===undefined?undefined:output.assets.get(file.hash);
  if(bytes===undefined)throw new Error('Missing published foliage');
  const data:unknown=JSON.parse(new TextDecoder().decode(bytes));return parseWorldScenePlacement(data);
}
test('published world-build data preserves both tiers of foliage in authored order', () => {
  for(const tier of ['phone','desktop']as const)for(const kind of ['palms','hibiscus']as const){
    const original=authoredScenes.placements[tier][kind];
    expect(rows(tier,kind).poses.map(({x,y,z,params})=>({x,y,z,params}))).toEqual(foliage.tiers[tier][kind==='palms'?'palms':'bushes'].placements);
    expect(rows(tier,kind)).toEqual(parseWorldScenePlacement({...original,poses:uprightPoses(original.poses),id:`foliage.${kind==='palms'?'palms':'bushes'}.${tier}`}));
  }
  expect(rows('phone','palms').poses).toHaveLength(204);
  expect(rows('desktop','hibiscus').poses).toHaveLength(260);
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

test('compiled deck floors preserve inclusive corners and adjacent floating-point edges', () => {
  const floors = WORLD_PLACEMENTS.find(row => row.id === 'entry.decks')?.piece?.floors ?? [], epsilon = Number.EPSILON * 256;
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
