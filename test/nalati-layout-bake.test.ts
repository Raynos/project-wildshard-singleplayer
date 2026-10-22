// oxlint-disable-next-line import/no-nodejs-modules -- Verify the committed native lattice.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { unzlibSync } from 'fflate';
import { InstancedBufferGeometry, Mesh, MeshBasicMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { createSceneBuffers } from '../src/game/shardfile/sceneBuffers';
import { ClientChannels } from '../src/sdk/clientChannels';
import { installChannelPrograms } from '../src/game/plugin/channelPrograms';
import { compactChannels } from '../src/shards/nalati-grasslands/generators/channelRows';
import { isJsonData } from '../src/format/json';
import geography from '../src/shards/nalati-grasslands/boot/geography.generated.json' with { type: 'json' };
import grass from '../src/shards/nalati-grasslands/boot/grass.generated.json' with { type: 'json' };
import layout from '../src/shards/nalati-grasslands/boot/layout.generated.json' with { type: 'json' };
import places from '../src/shards/nalati-grasslands/boot/poiLayout.generated.json' with { type: 'json' };
import clearings from '../src/shards/nalati-grasslands/boot/clearings.generated.json' with { type: 'json' };
import * as authoredLayout from '../src/shards/nalati-grasslands/generators/layout';
import * as authoredPlaces from '../src/shards/nalati-grasslands/generators/poiLayout';
import * as authoredClearings from '../src/shards/nalati-grasslands/generators/clearings';
import { riverZAt, riverHalfAt } from '../src/shards/nalati-grasslands/generators/edgeRecipe';
import { TERRAIN, snowValleyX, snowValleyHalf, snowValleyFloor, inPoiClearing, inSpruceClearing } from '../src/shards/nalati-grasslands/generators/terrainRecipe';
import { parseBakedTerrain } from '../src/format/bakedTerrainBytes';
import { bakedSamplers } from '../src/format/bakedTerrainSampling';
import { installDeclaredBakedTerrain } from '../src/engine/world/bakedTerrainField';
import { GROUND,forestMask } from './fixtures/nalati-terrain';
import { readScalarLattice } from '../src/engine/world/scalarChannel';

const bound = GROUND.terrain,wetMask = readScalarLattice(geography.channels.wet);

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
  installDeclaredBakedTerrain(bound, { ...bakedSamplers(grid), seed: grid.seed });
  let different = 0;
  for (let z = 0; z < grid.res; z++) for (let x = 0; x < grid.res; x++) {
    if (Math.fround(TERRAIN.heightAt(-250 + x * 500 / 255, -250 + z * 500 / 255)) !== grid.heights[z * grid.res + x]) different++;
    expect(bound.heightAt(-250 + x * 500 / 255, -250 + z * 500 / 255)).toBeCloseTo(grid.heights[z * grid.res + x] ?? 0, 9);
  }
  expect(different).toBe(0);
});

test('baked geography keeps bounded masks and complementary zones', () => {
  const zones = (['valley', 'bowl', 'snow'] as const).map(id => {
    const bytes = unzlibSync(Uint8Array.from(atob(geography.channels[id].values.data), value => value.codePointAt(0) ?? 0));
    return bakedSamplers({ res: geography.res, size: geography.size, seed: geography.seed, landscapeHash: 0,
      heights: new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4), splat: new Uint8Array(0), undergrowth: null }).heightAt;
  });
  for (let z = -250; z <= 250; z += 10) for (let x = -250; x <= 250; x += 10) {
    expect(zones.reduce((sum, sample) => sum + sample(x, z), 0)).toBeCloseTo(1, 6);
    for (const mask of [forestMask(x, z), wetMask(x, z), bound.pondMask(x, z)]) {
      expect(mask).toBeGreaterThanOrEqual(0); expect(mask).toBeLessThanOrEqual(1);
    }
  }
});

test('both grass tiers admit every ring, flower and card draw', () => {
  const decode = (value: string): Uint8Array => unzlibSync(Uint8Array.from(atob(value), char => char.codePointAt(0) ?? 0));
  expect(decode(grass.height).length).toBe(512 * 512 * 2);
  expect(decode(grass.field).length).toBe(126 * 126 * 4);
  expect(decode(grass.ground).length).toBe(126 * 126 * 4);
  for (const tier of [grass.phone, grass.desktop]) {
    const scope = new Scope('grass-fields'), material = new MeshBasicMaterial();
    try {
      for (const [kind, encoded] of Object.entries(tier.scenes)) {
        const input: unknown = JSON.parse(new TextDecoder().decode(decode(encoded)));
        const group = createSceneBuffers(input, material, scope);
        expect(group.children.length).toBe(kind === 'blades' ? 3 : 1);
        for (const child of group.children) {
          if (!(child instanceof Mesh) || !(child.geometry instanceof InstancedBufferGeometry)) throw new Error('Missing field draw');
          expect(child.geometry.getIndex()?.count).toBeGreaterThan(0);
          expect(child.geometry.instanceCount).toBe(kind === 'cards' ? tier.cards.across ** 2 : 0);
        }
      }
    } finally { scope.dispose(); material.dispose(); }
  }
});

test('compacted pose literals preserve arithmetic and private recurrence', () => {
  const dag = new ClientChannels('pose.compact'), previous = dag.local(0);
  const zero = dag.binary('add', dag.constant(0), dag.constant(0));
  const next = dag.binary('add', dag.binary('add', previous, dag.read('delta')), zero);
  dag.retain(previous, next); dag.output('value', next);
  const rows = compactChannels([{ ...dag.build(), numeric: { group: 'test', outputs: [{ property: 'value', target: 'root', path: ['value'] }] } }]);
  const owner = { value: 0 }, host = installChannelPrograms(rows, 'test', new Map([['root', owner]]));
  for (const delta of [.2, .3]) host.evaluate({ time: 0, delta, values: { delta } });
  expect(owner.value).toBe(.5);
  const bad = new ClientChannels('pose.invalid'); bad.constant(0); bad.output('value', bad.constant(-0));
  const invalid = compactChannels([{ ...bad.build(), numeric: { group: 'test', outputs: [{ property: 'value', target: 'root', path: ['value'] }] } }]);
  expect(isJsonData(invalid)).toBe(false);
});
