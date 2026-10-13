// oxlint-disable-next-line import/no-nodejs-modules -- The build fixture owns and removes its isolated author project.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolated author projects live outside the shared checkout.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the source template and SDK-only workspace link.
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { buildProject, readProjectAssets } from '@wildshard/sdk/project';
import { parseGlb } from '@wildshard/sdk/assets';
import { projectPlaceholders } from '@wildshard/sdk/bake/placeholders';
import { NEAR_PLACEHOLDER_LIMITS, nearPlaceholderCost } from '@wildshard/format/nearPlaceholder';
import { loadShardfileNear } from '../src/game/grid/shardfileFar';

// G348: the template stands in for an unknown uploaded shard: `wildshard build` gives it both placeholders from its own
// terrain collider, its own coarse tiles and its own look, with no per-shard code and nothing it declares.
const root = mkdtempSync(join(tmpdir(), 'sdk-placeholders-'));
const project = join(root, 'author');
beforeAll(() => {
  cpSync(resolve('src/shards/_template'), project, { recursive: true });
  mkdirSync(join(project, 'node_modules/@wildshard'), { recursive: true });
  symlinkSync(resolve('src/sdk'), join(project, 'node_modules/@wildshard/sdk'));
});
afterAll(() => { rmSync(root, { recursive: true, force: true }); });

it('wildshard build (placeholders on, the CLI default) bakes a near placeholder into any terrain shardfile', async () => {
  const built = await buildProject(project, join(root, 'product'), { client: null, placeholders: true });
  const near = built.near;
  if (near === undefined) throw new Error('no near placeholder');
  expect(near.terrain).toEqual([]); expect(near.content).toHaveLength(1);
  const ref = near.content[0] ?? '', bytes = readFileSync(join(root, 'product', ref));
  expect(parseGlb(bytes).draws).toBe(1);
  const cost = nearPlaceholderCost(near, built);
  expect(cost.content.resident).toBeGreaterThan(0); expect(cost.content.resident).toBeLessThanOrEqual(NEAR_PLACEHOLDER_LIMITS.contentBytes);
  expect(built.far?.files.every((hash) => existsSync(join(root, 'product', hash)))).toBe(true);
  // the grid reads that row from the admitted shardfile itself (no baked folder, no slug): it draws, is charged its
  // admitted content residency and leaves the shard's own tiles refining (it never owns the cell)
  const reads: string[] = [];
  const loaded = await loadShardfileNear(built, (hash) => { reads.push(hash); return Promise.resolve(new Uint8Array(readFileSync(join(root, 'product', hash)))); });
  try {
    expect(reads).toEqual(near.content); expect(loaded.owns).toBe(false); expect(loaded.bytes).toBe(cost.content.resident);
    expect(loaded.prepared.positionalMask).toBe(true); expect(loaded.prepared.geometry.getAttribute('position').count).toBeGreaterThan(1000);
    expect(loaded.prepared.geometry.hasAttribute('color')).toBe(true);
  } finally { loaded.prepared.geometry.dispose(); }
  const bare = { ...built }; delete bare.near;
  await expect(loadShardfileNear(bare, () => Promise.reject(new Error('unread')))).rejects.toThrow('no near content');
}, 120_000);

it('a shardfile that ships no far proxy gets one, and the bake is deterministic', async () => {
  const { shard, assets } = await readProjectAssets(project);
  const bare = { ...shard, far: null, props: shard.props === null ? null : { ...shard.props, far: null } };
  const a = await projectPlaceholders(bare, new Map(assets)), b = await projectPlaceholders(bare, new Map(assets));
  expect(a.far).not.toBeNull(); expect(a.far?.draws).toBe(1); expect(a.near?.content).toHaveLength(1);
  expect(JSON.stringify(a.far)).toBe(JSON.stringify(b.far)); expect(a.near).toEqual(b.near);
  // G380: a shard without a height field (an authored mesh world) keeps its far as it is and gets a near view from its
  // coarse tiles alone, over a flat floor; with no coarse tile meshes it is left as it is
  const flat = await projectPlaceholders({ ...bare, terrain: null }, new Map(assets));
  expect(flat.far).toBeNull(); expect(flat.near?.content).toHaveLength(1); expect(flat.near?.terrain).toEqual([]);
  const ref = flat.near?.content[0] ?? '', glb = flat.files.find(file => file.hash === ref);
  expect(glb?.draws).toBe(1); expect(glb?.triangles).toBeGreaterThan(100);
  const tileless = { ...bare, terrain: null, tiles: [] };
  expect(await projectPlaceholders(tileless, new Map(assets))).toEqual(tileless);
}, 120_000);
