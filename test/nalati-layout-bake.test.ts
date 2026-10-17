// oxlint-disable-next-line import/no-nodejs-modules -- Verify the committed native lattice.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import layout from '../src/shards/nalati-grasslands/boot/layout.generated.json' with { type: 'json' };
import places from '../src/shards/nalati-grasslands/boot/poiLayout.generated.json' with { type: 'json' };
import clearings from '../src/shards/nalati-grasslands/boot/clearings.generated.json' with { type: 'json' };
import * as authoredLayout from '../src/shards/nalati-grasslands/generators/layout';
import * as authoredPlaces from '../src/shards/nalati-grasslands/generators/poiLayout';
import * as authoredClearings from '../src/shards/nalati-grasslands/generators/clearings';
import { riverZAt, riverHalfAt } from '../src/shards/nalati-grasslands/edge';
import { TERRAIN, snowValleyX, snowValleyHalf, snowValleyFloor, inPoiClearing, inSpruceClearing } from '../src/shards/nalati-grasslands/world/terrain';
import { parseBakedTerrain } from '../src/format/bakedTerrainBytes';

test('baked layout owns every derived anchor and clearing', () => {
  const data = (source: object): object => Object.fromEntries(Object.entries(source).filter(([, value]) => typeof value !== 'function'));
  expect(layout).toEqual(data(authoredLayout));
  expect(places).toEqual(data(authoredPlaces));
  expect(clearings).toEqual(data(authoredClearings));
});

test('live profile and clearance consumers keep exact authored answers', () => {
  for (let i = -1000; i <= 1000; i++) {
    const at = i / 4;
    expect(riverZAt(at)).toBe(authoredLayout.riverZAt(at));
    expect(riverHalfAt(at)).toBe(authoredLayout.riverHalfAt(at));
    expect(snowValleyX(at)).toBe(authoredLayout.snowValleyX(at));
    expect(snowValleyHalf(at)).toBe(authoredLayout.snowValleyHalf(at));
    expect(snowValleyFloor(at)).toBe(authoredLayout.snowValleyFloor(at));
  }
  for (let x = -250; x <= 250; x += 2) for (let z = -250; z <= 250; z += 2) {
    expect(inPoiClearing(x, z)).toBe(authoredClearings.inPoiClearing(x, z));
    expect(inPoiClearing(x, z, 8)).toBe(authoredClearings.inPoiClearing(x, z, 8));
    expect(inSpruceClearing(x, z)).toBe(authoredClearings.inSpruceClearing(x, z));
  }
});

test('all native terrain heights, including every edge, retain their bake', () => {
  const bytes = Uint8Array.from(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin'));
  const grid = parseBakedTerrain(bytes.buffer);
  if (grid === null) throw new Error('Missing Nalati lattice');
  let different = 0;
  for (let z = 0; z < grid.res; z++) for (let x = 0; x < grid.res; x++) {
    if (Math.fround(TERRAIN.heightAt(-250 + x * 500 / 255, -250 + z * 500 / 255)) !== grid.heights[z * grid.res + x]) different++;
  }
  expect(different).toBe(0);
});
