import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, type Shardfile } from '@wildshard/format/shardSchema';
import { curvedParams, graphBindingSources, materialCurveRules, materialGraphRules } from '@wildshard/format/materials';
import { parseFamilyMaterial } from '@wildshard/format/materialFamilies';
import { Scope } from '../src/engine/app/scope';
import { familyMaterial, moveFamilyMaterial } from '../src/engine/render/families/registry';
import { ToonLook } from '../src/engine/render/families/toon';
import { clientMaterials } from '../src/game/shardfile/clientMaterials';
import { SAND_DUSK } from '../src/shards/sunscar-dunes/data/dusk';
import { STORM_FIELD, STORM_GRAPHS } from '../src/shards/sunscar-dunes/data/stormLook';
import template from '../src/shards/_template/shard.config';

/** clientMaterials reads the renderer only for KTX2 and graph compiles; these entries need neither. */
function renderer(): THREE.WebGLRenderer {
  const value: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(value instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer prototype');
  return value;
}
const field = (id: number, name: string, value: number) => ({ id, name, type: 'f64' as const, privacy: 'public' as const, default: value, min: 0, max: 1 });
const uniforms = (m: THREE.Material): string => JSON.stringify(m.userData['familyUniforms'], (_key, value: unknown) => value instanceof THREE.Texture ? value.name : value);

/** Signal's dusk sand curves (data/dusk.ts SAND_DUSK, `look.curves` rows; the grain's strength aside, it needs its map). */
const sandRows = SAND_DUSK.filter((row) => row.param !== 'ground.grain.strength');

describe('state-bound curves on family materials (look.curves)', () => {
  it('moves Signal\'s sand ground layer with a declared dusk field, uniform for uniform as moving it by hand', async () => {
    const base = emptyShardfile({ slug: 'curve-sand', name: 'Curve sand', author: 'Local', seed: 1, revision: 1 });
    const entry = { family: 'pbr', vertexColours: true, roughness: 0.88, metalness: 0, ground: { wind: [-0.643, 0.766], away: { from: [0.3, -0.9], amount: 0 } } };
    const shard: Shardfile = parseShardfile({ ...base, state: { ...base.state, shared: [field(1, 'dusk', 0.25)] },
      look: { ...base.look, families: ['toon', 'pbr'], materials: { sand: entry }, curves: { sand: sandRows } } });
    expect(materialCurveRules(shard)).toEqual([]);
    const scope = new Scope('curve-sand'), reference = new Scope('curve-sand-ref');
    try {
      const client = await clientMaterials(shard, new Map(), renderer(), scope, { graphs: false });
      const sand = client.materials.get('sand'); if (sand === undefined) throw new Error('no sand');
      const twin = familyMaterial(entry, { toon: new ToonLook(), textures: () => { throw new Error('no maps'); }, scope: reference });
      const program = sand.customProgramCacheKey();
      let dusk = 0.25;
      client.graphs.bind({ state: (scopeName, name) => scopeName === 'shared' && name === 'dusk' ? dusk : undefined });
      for (const next of [0.25, 0.6, 1, 0]) {
        dusk = next; client.tick(1 / 30);
        moveFamilyMaterial(twin, curvedParams(parseFamilyMaterial(entry), sandRows, () => next));
        expect(uniforms(sand)).toBe(uniforms(twin));
      }
      expect(sand.customProgramCacheKey()).toBe(program);
    } finally { scope.dispose(); reference.dispose(); }
  });

  it('runs on a second shard\'s family material: the template\'s PBR roughness over a player field', async () => {
    const shard = parseShardfile({ ...template, state: { ...template.state, player: [...template.state.player, field(900, 'wear', 0.25)] },
      look: { ...template.look, curves: { pbr: [{ param: 'roughness', state: 'player.wear', curve: { mix: [0.2, 0.9] } }] } } });
    expect(materialCurveRules(shard)).toEqual([]);
    const scope = new Scope('curve-template');
    try {
      const client = await clientMaterials(shard, new Map(), renderer(), scope, { graphs: false });
      const pbr = client.materials.get('pbr');
      if (!(pbr instanceof THREE.MeshStandardMaterial)) throw new Error('the template PBR is a MeshStandardMaterial');
      expect(pbr.roughness).toBeCloseTo(0.375, 12);
      client.graphs.bind({ state: (scopeName, name) => scopeName === 'player' && name === 'wear' ? 1 : undefined });
      expect(pbr.roughness).toBeCloseTo(0.9, 12);
    } finally { scope.dispose(); }
  });

  it('refuses a curve on an unknown field, a program-changing param or a non-number', () => {
    const shard: Shardfile = { ...template, look: { ...template.look, curves: { pbr: [
      { param: 'roughness', state: 'shared.missing', curve: { base: 1 } },
      { param: 'faceted', state: 'shared.missing', curve: { base: 1 } },
      { param: 'ground.albedo', state: 'shared.missing', curve: { base: 1 } },
    ] } } };
    expect(() => parseShardfile(shard)).toThrow('shardfile semantic rules');
    expect(materialCurveRules(shard)).toEqual([
      'curves pbr: shared.missing is not a declared public numeric state field (or a host one its runtime binds)',
      'curves pbr: shared.missing is not a declared public numeric state field (or a host one its runtime binds)',
      'curves pbr: pbr cannot move faceted without a new program',
      'curves pbr: shared.missing is not a declared public numeric state field (or a host one its runtime binds)',
      'curves pbr: ground.albedo is not a number of the entry',
    ]);
  });

  it('lets a graph bind a host field exactly where a curve may: when its trusted runtime binds state (Signal\'s storm, G397)', () => {
    const base = emptyShardfile({ slug: 'storm-graph', name: 'Storm graph', author: 'Local', seed: 1, revision: 1 });
    const shard = parseShardfile({ ...base, state: { ...base.state, shared: [STORM_FIELD] }, runtime: { entry: 'runtime/index.ts', binds: ['state'] },
      look: { ...base.look, materials: Object.fromEntries(Object.entries(STORM_GRAPHS).map(([id, graph]) => [id, { family: 'graph', graph }])) } });
    expect(graphBindingSources(shard).state).toEqual(['shared.storm']);
    expect(materialGraphRules(shard)).toEqual([]);
    const unbound = { ...shard, runtime: null };
    expect(graphBindingSources(unbound).state).toEqual([]);
    expect(materialGraphRules(unbound)).toHaveLength(2);
  });
});
