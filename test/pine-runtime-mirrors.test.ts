import { CRAG_CAVE_ROWS } from '../src/shards/pine-hollow/generators/cragSceneContribution';
import logKit from '../src/shards/pine-hollow/data/logKit.json' with { type: 'json' };
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the diagnostic metadata with the shipping terrain bytes.
import { readFileSync } from 'node:fs';
import { parseBakedTerrain } from '../src/format/bakedTerrainBytes';
import { bakedSamplers } from '../src/format/bakedTerrainSampling';
import poses from '../src/shards/pine-hollow/data/boot-poses.generated.json' with { type: 'json' };
import manifest from '../src/shards/pine-hollow/manifest.json' with { type: 'json' };

import { expect, test } from 'vitest';
import * as v from 'valibot';
import { NATIVE_VIEW } from '../src/shards/pine-hollow/generators/nativeView';
import { NativeViewSchema, CaveRowsSchema, PoolGroundSchema } from '../src/shards/pine-hollow/generators/sections';
import { output } from '../src/shards/pine-hollow/generators/output';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { resolveBootSources } from '../src/engine/boot/filePolicy';
import { PINE_BOOT_FILES, PINE_BOOT_SOURCES } from '../src/shards/pine-hollow/generators/bootFiles';
import metadata from '../src/shards/pine-hollow/data/bootMetadata.generated.json' with { type: 'json' };
import explorer from '../src/shards/pine-hollow/data/explorerMetadata.generated.json' with { type: 'json' };
import { FINISH_CARDS } from '../src/shards/pine-hollow/generators/finishCards';
import coatPages from '../src/shards/pine-hollow/data/coatPages.generated.json' with { type: 'json' };
import authored from '../src/shards/pine-hollow/data/timberWorld.generated.json' with { type: 'json' };
import { GPU_FILES } from '../src/shards/pine-hollow/ktx2.generated';
import { ASTC6_PHONE } from '../src/shards/pine-hollow/runtime/boot/astc6/ktx2.generated';
import { bootSources, bootFiles, pineMemoryTrim, pineSetCap } from '../src/shards/pine-hollow/runtime/boot/files';
import { currentPageMode, setPageMode } from '../src/game/grid/pageMode';

test('world view rows come from the admitted section', () => {
  const section = output.custom.sections.find(row => row.name === 'custom/nativeView');
  const bytes = section === undefined ? undefined : output.custom.files.get(section.path);
  if (section === undefined || bytes === undefined) throw new Error('Missing Pine native view');
  expect(output.namedFiles.some(row => row.name === 'look/native-view.json')).toBe(false);
  const product = createShardProduct({ slug:'pine-hollow', revision:1,
    shardfile:emptyShardfile({ slug:'pine-hollow', name:'Pine', author:'Wildshard', revision:1, seed:1 }),
    sections:new Map([['custom/nativeView', JSON.parse(new TextDecoder().decode(bytes))]]), files:new Map(), read:() => Promise.reject(new Error('Native view must use its section')) });
  expect(product.section('custom/nativeView')).toEqual(v.parse(NativeViewSchema, { ...NATIVE_VIEW, ...logKit }));
  expect(() => v.parse(NativeViewSchema, { ...NATIVE_VIEW, ...logKit, KING_ARENA_FOG:'31' })).toThrow();
  expect(() => v.parse(NativeViewSchema, { ...NATIVE_VIEW, ...logKit, BOSS_ENCOUNTER: { ...NATIVE_VIEW.BOSS_ENCOUNTER, profile: { ...NATIVE_VIEW.BOSS_ENCOUNTER.profile, fight: { ...NATIVE_VIEW.BOSS_ENCOUNTER.profile.fight, strike: { ...NATIVE_VIEW.BOSS_ENCOUNTER.profile.fight.strike, action: 'unknown' } } } } })).toThrow();
});

test('pre-admission metadata preserves Explorer identities and ordered boot recipes', () => {
  expect(explorer.cards).toEqual(FINISH_CARDS);
  const inputs = { pages:{ coats:coatPages.tiers }, aliases:{ props:authored.propMaterials } };
  const before = currentPageMode();
  try {
    for (const mode of ['shard', 'grid'] as const) {
      setPageMode(mode);
      expect(pineMemoryTrim()).toBe(mode === 'grid');
      expect([256, 512, 1024, 2048].map(pineSetCap)).toEqual(mode === 'grid' ? [256, 512, 512, 2048] : [256, 512, 1024, 2048]);
      const table = mode === 'grid' ? { phone:{ ...GPU_FILES.phone, ...ASTC6_PHONE }, desktop:GPU_FILES.desktop } : GPU_FILES;
      const baked = mode === 'grid' ? metadata.grid : metadata.standalone;
      for (const tier of ['phone','desktop'] as const) for (const tex of ['img','ktx2'] as const) {
        const expected = resolveBootSources(PINE_BOOT_FILES, PINE_BOOT_SOURCES, tier, tex, table, inputs);
        expect(baked.modes[tier][tex]).toEqual(expected);
        expect(bootSources(tier, tex)).toEqual(expected);
        if (tex === 'img') expect(bootFiles(tier)).toEqual(Object.values(expected).flat());
      }
    }
  } finally { setPageMode(before); }
});

test('generated diagnostic eyes retain the authored probes and native terrain height', () => {
  const grid = parseBakedTerrain(Uint8Array.from(readFileSync(new URL('../public/assets/baked/pine-hollow/terrain.bin', import.meta.url))), { seed:1337 });
  if (grid === null) throw new Error('Missing Pine lattice');
  const source = bakedSamplers(grid);
  expect(Object.keys(poses)).toEqual(manifest.captureProbes.map(probe => probe.name));
  for (const row of Object.values(poses)) {
    const probe = manifest.captureProbes.find(candidate => candidate.name === row.probe.name);
    if (probe === undefined) throw new Error('Diagnostic pose lost its probe');
    expect(row.probe).toEqual(probe);
    expect(row.eye).toEqual([probe.x, source.heightAt(probe.x, probe.z) + 1.68, probe.z]);
    expect(row.yaw).toBe(-probe.yaw * 180 / Math.PI);
    expect(row.pitch).toBe(probe.pitch * 180 / Math.PI);
  }
});

test('the named cave and pool inputs retain exact values and refuse malformed vectors', () => {
  const file = output.namedFiles.find(row => row.name === 'world/crag-cave.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing cave metadata');
  expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual(CRAG_CAVE_ROWS);
  expect(() => v.parse(CaveRowsSchema, { ...CRAG_CAVE_ROWS, meta: { ...CRAG_CAVE_ROWS.meta, inside: [[1]] } })).toThrow();
  expect(v.parse(PoolGroundSchema, authored.poolGround)).toEqual(authored.poolGround);
  expect(() => v.parse(PoolGroundSchema, [Infinity])).toThrow();
});
