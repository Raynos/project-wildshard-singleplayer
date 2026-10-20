import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group, MeshBasicMaterial, MeshStandardMaterial, Texture, Vector3 } from 'three';
import { parse } from 'valibot';
import { staticGlb } from '../src/sdk/bake/glb';
import { parseClientPlan } from '../src/format/clientPlan';
import type { ShardContext } from '../src/game/plugin/context';
import { Scope } from '../src/engine/app/scope';
import { ToonLook } from '../src/engine/render/families/toon';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import * as lookCompiler from '../src/game/shardfile/runtimeProduct';
import { lendLooks, lentLook, setLentTexture, type LentLooks } from '../src/game/shardfile/lentLooks';
import { installClientBakedTiles, lendBakedLooks, residentBakedTiles } from '../src/game/shardfile/bakedTiles';
import { parseFamilyMaterial } from '../src/format/materialFamilies';
import { BakedTilesSchema, type BakedTilesRow } from '../src/format/bakedTiles';

const lend = (id: string, material: MeshBasicMaterial, setTexture: LentLooks['setTexture']): Awaited<ReturnType<typeof lookCompiler.runtimeLookMaterials>> => ({
  materials: new Map([[id, material]]), setParam: () => undefined, setTexture, bindMeshMap: () => material,
  toon: new ToonLook(), textures: new Map<string, never>(), compile: () => material, tick: () => undefined, outline: () => [], surfaces: null,
  graphs: { bind: () => undefined, readout: { compiled: 0, fallback: 0, reasons: [] } },
});

// A data client may lend a graph look's presentation fallback first (graphs off): it takes no lent textures. The baked
// tiles host lends its own graph-compiled looks for its resident, so its lightmaps never reach the fallback (G532).
test('baked tiles lend their graph looks over an earlier presentation fallback', async () => {
  const source = emptyShardfile({ slug: 'fixture-orchard', name: 'Orchard', author: 'Fixture', revision: 1, seed: 3 });
  source.look.materials['orchard-ground'] = parseFamilyMaterial({ family: 'pbr' });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('No fixture blob')) });
  const presentation = new Scope('presentation'), resident = new Scope('resident'), fallback = new MeshBasicMaterial(), compiled = new MeshBasicMaterial();
  const lent: string[] = [];
  lendLooks(presentation, lend('orchard-ground', fallback, () => { throw new Error('Material has no compiled graph textures'); }));
  const compile = vi.spyOn(lookCompiler, 'runtimeLookMaterials').mockResolvedValue(lend('orchard-ground', compiled, (_id, name) => { lent.push(name); }));
  const row = { look: 'orchard-ground', instances: null } as const satisfies Pick<BakedTilesRow, 'look' | 'instances'>;
  try {
    await lendBakedLooks({ game: {} as never, product }, [row as BakedTilesRow], resident);
    expect(compile).toHaveBeenCalledWith(expect.objectContaining({ scope: resident }), source, true, ['orchard-ground']);
    expect(lentLook('orchard-ground')).toBe(compiled);
    setLentTexture('orchard-ground', 'ao', new Texture());
    expect(lent).toEqual(['ao']);
    resident.dispose();
    expect(lentLook('orchard-ground')).toBe(fallback);
  } finally { compile.mockRestore(); presentation.dispose(); resident.dispose(); fallback.dispose(); compiled.dispose(); }
});

// G532 grid entry: a trusted runtime's resident world can build before any plan phase drew the tiles. Whichever path asks
// first draws them once per shard; the other (here a second admitted product object of the same shard) reuses that draw.
test('baked tiles draw once per shard whichever path enters first', async () => {
  const source = emptyShardfile({ slug: 'fixture-reef', name: 'Reef', author: 'Fixture', revision: 1, seed: 4 });
  source.look.materials['reef-ground'] = parseFamilyMaterial({ family: 'pbr' });
  const glb = staticGlb([{ geometry: new BoxGeometry(), material: new MeshStandardMaterial(), name: 'ground_0_0' }]);
  const row = parse(BakedTilesSchema, { id: 'ground', glb: { file: 'world/ground.glb' }, tiles: { phone: 'ground_', desktop: 'ground_' }, look: 'reef-ground', drop: 0,
    meshPrefix: 'baked-', sky: false, toonDay: false, lightmaps: [], sun: null, instances: null });
  const plan = parseClientPlan({ version: 1, features: [{ kind: 'world.baked', rows: [row] }] });
  const product = () => createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map([['client/plan', plan]]),
    files: new Map([['world/ground.glb', { hash: 'a'.repeat(64), url: '/fixture/ground.glb' }]]), read: () => Promise.resolve(glb) });
  const resident = new Scope('resident'), entered = new Scope('entered'), root = new Group(), material = new MeshBasicMaterial();
  const world = { sky: { setupMaterial: vi.fn(), csm: { lights: [] }, sunDir: new Vector3(0, 1, 0) }, registry: {} };
  const context = (scope: Scope) => {
    const system = vi.fn<ShardContext['system']>(), base: Pick<ShardContext, 'product' | 'scope' | 'root' | 'system'> = { product: product(), scope, root, system };
    const typed = base as ShardContext;
    Object.defineProperty(typed, 'game', { enumerable: true, value: { runtime: { world } } });
    return { ctx: { system }, typed };
  };
  const compile = vi.spyOn(lookCompiler, 'runtimeLookMaterials').mockResolvedValue(lend('reef-ground', material, () => undefined));
  try {
    const runtime = context(resident), feature = context(entered);
    const drawn = await residentBakedTiles(runtime.typed, resident);
    await installClientBakedTiles(feature.typed, { kind: 'world.baked', rows: [row] }, entered);
    expect(drawn.get('ground')?.tiles.map(tile => tile.name)).toEqual(['baked-ground_0_0']);
    expect(root.children).toHaveLength(1);
    expect(compile).toHaveBeenCalledOnce();
    expect(runtime.ctx.system).toHaveBeenCalledOnce(); expect(feature.ctx.system).toHaveBeenCalledOnce();
    resident.dispose();
    expect(root.children).toHaveLength(0);
  } finally { compile.mockRestore(); resident.dispose(); entered.dispose(); material.dispose(); }
});
