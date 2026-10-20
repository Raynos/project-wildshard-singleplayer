import { Scene, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Texture } from 'three';
import { bindPageWater } from '../src/game/shardfile/pageWater';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import type { ShardContext } from '../src/game/plugin/context';
import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { prepareScriptMemoryLease } from '../src/engine/script/host';
import { embeddedDirectorBytes, prepareEmbeddedDirector } from '../src/game/plugin/director';
import { terrainOpeningHits } from '../src/game/shardfile/pagePreparation';
import { PageTerrainCutSchema } from '../src/format/pagePreparation';
import * as v from 'valibot';
import declaration from '../src/shards/driftwood-isle/data/director.json' with { type: 'json' };
import module from '../src/shards/driftwood-isle/behaviour/director.json' with { type: 'json' };

const bytes = embeddedDirectorBytes(declaration, module);

test('a prepared native guest has the same initialization and continuation as a fresh guest', async () => {
  const a = new Scope('orchard.prepared'), b = new Scope('orchard.direct');
  try {
    const create = await prepareEmbeddedDirector(declaration, module, 17), release = await prepareScriptMemoryLease([bytes], a, 'task');
    const prepared = a.run(create); release(); const direct = b.run(create);
    expect(prepared.snapshot()).toEqual(direct.snapshot());
    await expect(prepareScriptMemoryLease([new Uint8Array()], a, 'task')).rejects.toThrow();
  } finally { a.dispose(); b.dispose(); }
});

test('leases refuse overlap, release once and reject disposal during preparation', async () => {
  const scope = new Scope('orchard.lease');
  try {
    const release = await prepareScriptMemoryLease([bytes], scope, 'task');
    await expect(prepareScriptMemoryLease([bytes], scope, 'task')).rejects.toThrow('already active');
    release(); const next = await prepareScriptMemoryLease([bytes], scope, 'task'); release();
    await expect(prepareScriptMemoryLease([bytes], scope, 'task')).rejects.toThrow('already active'); next();
    const abandoned = prepareScriptMemoryLease([bytes], scope, 'task'); scope.dispose();
    await expect(abandoned).rejects.toThrow('disposed');
  } finally { scope.dispose(); }
});

test('orchard terrain openings preserve yawed triangle bounds and vertical exclusion', () => {
  const rows = v.parse(PageTerrainCutSchema, { frame: { x: 20, z: -30, yaw: Math.PI / 2 }, cuts: [], holes: [{ lx: 0, lz: 4, hw: 2, hd: 1, y0: 0, y1: 3 }] });
  expect(terrainOpeningHits(rows, 23, 1, -30, 25, 1, -31, 25, 1, -29)).toBe(true);
  expect(terrainOpeningHits(rows, 23, 5, -30, 25, 5, -31, 25, 5, -29)).toBe(false);
  expect(terrainOpeningHits(rows, 30, 1, -30, 32, 1, -31, 32, 1, -29)).toBe(false);
  expect(() => v.parse(PageTerrainCutSchema, { ...rows, inside: () => true })).toThrow();
});

test('an orchard basin binds different native texture slots and its own look', () => {
  const scope = new Scope('orchard.water'), scene = new Scene(), ripple = new Texture(), reflection = new Texture(), look = new MeshStandardMaterial();
  const old = new MeshPhysicalMaterial({ normalMap: ripple }), pond = new Mesh(undefined, old), textures = new Map<string, Texture>();
  pond.name = 'orchard-basin'; pond.userData['reflection'] = reflection; scene.add(pond);
  lendLooks(scope, { materials: new Map([['orchard.water', look]]), setParam: () => undefined,
    setTexture: (_id, name, value) => { textures.set(name, value); }, bindMeshMap: () => look });
  try {
    bindPageWater({ game: { runtime: { world: { game: { scene, rootScene: scene } } } } } as ShardContext,
      { object: 'orchard-basin', look: 'orchard.water', looks: ['orchard.water'], ripples: 'waves', skyline: 'reflectionMap', centre: 'reflectionCentre', probe: 'reflection' });
    expect(pond.material).toBe(look); expect(textures.get('waves')).toBe(ripple); expect(textures.get('reflectionMap')).toBe(reflection);
  } finally { scope.dispose(); look.dispose(); pond.geometry.dispose(); ripple.dispose(); reflection.dispose(); }
});
