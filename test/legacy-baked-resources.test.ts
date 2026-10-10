// oxlint-disable-next-line import/no-nodejs-modules -- Reads the real committed offline resources used by the browser.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SHARDS, LEGACY_SHARDS, LEGACY_CONTENT_IDENTITIES } from '../src/shards.generated';
import { installShards } from '../src/game/shard/list';
import { parseShardSlug } from '../src/game/shard/slug';
import { toLevelSpec } from '../src/game/shard/spec';
import { levelBakedId } from '../src/engine/level/spec';
import { bakedTerrainUrl, bakedSamplers, loadBakedTerrain, parseBakedTerrain } from '../src/engine/world/BakedTerrain';
import { HeightfieldBinding, bindHeightfield } from '../src/engine/world/Heightfield';
import { bindLevelSelection } from '../src/engine/level/selection';
import { _applyChunkConstants } from '../src/engine/core/config';
import { placeForest, plantSpecs } from '../src/engine/world/forest/placement';
import { bakedTextureUrls } from '../src/engine/boot/bakedTextures';
import { navmeshUrl } from '../src/engine/physics/navmeshUrl';
import { loadNavmesh, setActiveNavmesh } from '../src/engine/physics/navmeshLoad';
import { app } from '../src/engine/app/runtime';
import { bakedCardUrls } from '../src/engine/world/BakedCards';
import { viewmodelBakeUrl } from '../src/engine/player/viewmodelTextures';

const identities: Readonly<Record<string, string>> = LEGACY_CONTENT_IDENTITIES;
const install = (): void => { installShards([...SHARDS, ...LEGACY_SHARDS], LEGACY_CONTENT_IDENTITIES); };
beforeEach(install);
afterEach(() => { install(); vi.restoreAllMocks(); setActiveNavmesh('none', null); });

it.each(LEGACY_SHARDS)('keeps $slug identity while resolving the inventoried primary offline resources', copy => {
  const primary = identities[copy.slug];
  if (primary === undefined) throw new Error('Missing registered legacy resource identity');
  const level = toLevelSpec(copy), folder = levelBakedId(level);
  expect(level.id).toBe(copy.slug); expect(folder).toBe(primary);
  expect(bakedTerrainUrl(folder)).toBe(bakedTerrainUrl(primary));
  expect(navmeshUrl(folder)).toBe(navmeshUrl(primary));
  expect(bakedTextureUrls(folder)).toEqual(bakedTextureUrls(primary));
  expect(bakedCardUrls(folder)).toEqual(bakedCardUrls(primary));
  expect(viewmodelBakeUrl(folder, 'walnut', 'col')).toBe(`procedural:/assets/baked/${primary}/viewmodel/walnut.col.png`);
});

it('never infers an offline folder from an unregistered suffix or an ordinary manifest', () => {
  const primary = SHARDS[0]; if (primary === undefined) throw new Error('Missing primary');
  expect(toLevelSpec(primary).bakedId).toBeUndefined();
  expect(toLevelSpec({ ...primary, slug: parseShardSlug('unregistered-legacy'), legacy: true }).bakedId).toBeUndefined();
  expect(levelBakedId({ id: 'unregistered-legacy' })).toBe('unregistered-legacy');
});

it('loads Pine LEGACY actual WSTR and navmesh, preserving the baked 918-tree world instead of the analytic fallback', async () => {
  const copy = LEGACY_SHARDS.find(row => row.slug === 'pine-hollow-legacy');
  const previous = SHARDS[0];
  if (copy === undefined || previous === undefined) throw new Error('Missing Pine legacy manifest');
  const level = toLevelSpec(copy), folder = levelBakedId(level), url = bakedTerrainUrl(folder);
  if (url === null) throw new Error('Missing real Pine terrain bake');
  const bytes = Uint8Array.from(readFileSync(`public${url}`)), grid = parseBakedTerrain(bytes.buffer);
  if (grid === null || level.trees === undefined) throw new Error('Missing Pine tree/terrain data');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(input => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname;
    return Promise.resolve(new Response(Uint8Array.from(readFileSync(`public${path}`))));
  });
  const binding = new HeightfieldBinding(level), leaveLevel = bindLevelSelection(level), leaveGround = bindHeightfield(binding);
  _applyChunkConstants(copy);
  try {
    expect(await loadBakedTerrain(binding)).toBe(true);
    expect(binding.field.heightAt(119.5, -3.6)).toBe(bakedSamplers(grid).heightAt(119.5, -3.6));
    expect(placeForest(plantSpecs(level.trees)).trees).toHaveLength(918);
    expect(await loadNavmesh(level.id, folder)).not.toBeNull();
    expect(app.navmeshId).toBe(copy.slug);
    expect(fetcher.mock.calls.map(([input]) => typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)).toEqual([url, navmeshUrl(folder)]);
    expect(await loadBakedTerrain(binding)).toBe(true); expect(fetcher).toHaveBeenCalledTimes(2);
  } finally { leaveGround(); leaveLevel(); _applyChunkConstants(previous); }
});
