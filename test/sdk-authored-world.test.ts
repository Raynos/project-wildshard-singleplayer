// oxlint-disable-next-line import/no-nodejs-modules -- This fixture owns disposable author projects only.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixture roots live outside the repository and trusted slug policy.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve SDK fixtures and disposable product files.
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { bakeAuthoredWorld } from '../src/sdk/bake/authoredWorld';
import { emptyShardfile } from '../src/sdk/author';
import { buildProject, canonicalJson, readProjectAssets, validateProject } from '../src/sdk/project';
import { validateSimulation } from '../src/sdk/headless';
import { decodeMeshCollision } from '../src/engine/core/meshCollision';
import { shardfileSource } from '../src/game/shardfile/loader';
import { hashImmutableBytes } from '../src/sdk/immutable';

const fixture = resolve('test/fixtures/sdk-authored-world/world.glb');
function declaration(): object {
  const base = emptyShardfile({ slug: 'authored-fixture', name: 'Authored fixture', author: 'Wildshard', revision: 1, seed: 55 });
  return { ...base, spawn: { x: 0, y: 0.1, z: 0, yaw: 0 },
    world: { glb: 'assets/world.glb', materials: { Clay: 'pbr', Paint: 'pbr', 'Door wood': 'pbr' }, colliders: 'mesh', objects: { Bridge: 'bridge' }, interactive: [{ node: 'Door', id: 'hall.door', colliderId: 'hall.door.collider' }] } };
}

it('bakes an ordinary Blender GLB with transformed bridge layers, two PNG textures and separate door deterministically', async () => {
  const bytes = readFileSync(fixture), input = declaration(), a = await bakeAuthoredWorld(input, bytes), b = await bakeAuthoredWorld(input, bytes);
  expect(canonicalJson(a.shard)).toBe(canonicalJson(b.shard)); expect(a.assets).toEqual(b.assets);
  validateProject(a.shard, a.assets);
  expect(a.shard.terrain).toBeNull(); expect(a.shard.meshCollision?.tiles).toHaveLength(64);
  expect(a.shard.files.filter(row => row.kind === 'ktx2')).toHaveLength(2);
  expect(a.shard.props?.panels).toHaveLength(1); expect(a.shard.meshCollision?.panels[0]?.id).toBe('hall.door.collider');
  expect(a.shard.far?.draws).toBe(1); expect(a.shard.tiles).toHaveLength(80);
  const heights = a.shard.meshCollision?.tiles.flatMap(row => {
    const data = a.assets.get(row.file); if (data === undefined) throw new Error('Missing collision');
    return Array.from(decodeMeshCollision(data).vertices).filter((_value, at) => at % 3 === 1);
  }) ?? [];
  expect(heights.some(y => y > 6)).toBe(true); expect(heights.some(y => y === 0)).toBe(true);
  for (const edge of Object.values(a.shard.edge)) expect(edge.heights).toEqual(Array.from({ length: 257 }, () => 0));
  const manifest = await shardfileSource(a.shard, { base: 'https://world.fixture/', firstParty: false, offline: false, hash: wire => Promise.resolve(hashImmutableBytes(wire)), fetch: url => {
    const payload = a.assets.get(new URL(url).pathname.slice(1)); if (payload === undefined) throw new Error('Unknown world asset');
    return Promise.resolve(new Response(Uint8Array.from(payload)));
  } }, { instance: 'authored-fixture-1', catalogue: [], items: new Map(), recipes: new Map(), icon: () => 'glyph', voices: () => new Map() });
  expect(manifest.ground.structures).toBe(true); // Normal level boot must not allocate a slab or heightfield beside WMC1.
  const proof = await validateSimulation(a.shard, a.assets); expect(proof.lanes).toBe(92); expect(proof.steps).toBeGreaterThan(1000);
}, 60_000);

it('builds and validates authored projects without writing compiled files into their source', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sf55a-project-')), project = join(root, 'project');
  try {
    mkdirSync(join(project, 'assets'), { recursive: true }); cpSync(fixture, join(project, 'assets/world.glb'));
    writeFileSync(join(project, 'shard.config.ts'), `export default ${canonicalJson(declaration())};\n`);
    const a = await buildProject(project, join(root, 'a'), { client: null }), b = await buildProject(project, join(root, 'b'), { client: null });
    expect(a).toEqual(b); expect(readdirSync(join(project, 'assets'))).toEqual(['world.glb']);
    for (const file of readdirSync(join(root, 'a'))) expect(readFileSync(join(root, 'a', file))).toEqual(readFileSync(join(root, 'b', file)));
    const loaded = await readProjectAssets(project); validateProject(loaded.shard, loaded.assets);
    expect(existsSync(join(project, 'generators'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60_000);

it('refuses an authored GLB symlink escaping its project before opening world bytes', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sf55a-symlink-'));
  try {
    mkdirSync(join(root, 'assets')); symlinkSync(fixture, join(root, 'assets/world.glb'));
    writeFileSync(join(root, 'shard.config.ts'), `export default ${canonicalJson(declaration())};\n`);
    await expect(buildProject(root, join(root, 'output'), { client: null })).rejects.toThrow('outside the author project');
    expect(existsSync(join(root, 'output'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('refuses compiled world sections instead of replacing them and names absent source materials', async () => {
  const source = declaration(), bytes = readFileSync(fixture);
  await expect(bakeAuthoredWorld({ ...source, props: {} }, bytes)).rejects.toThrow('compiled props');
  await expect(bakeAuthoredWorld({ ...source, world: { glb: 'assets/world.glb', materials: { Clay: 'pbr' }, colliders: 'mesh' } }, bytes)).rejects.toThrow('unmapped');
});
