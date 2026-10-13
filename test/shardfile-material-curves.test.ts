import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, type Shardfile } from '@wildshard/format/shardSchema';
import { curveAt, materialCurveRules, type Curve } from '@wildshard/format/materials';
import { Scope } from '../src/engine/app/scope';
import { familyMaterial } from '../src/engine/render/families/registry';
import { updateGround } from '../src/engine/render/families/ground';
import { ToonLook } from '../src/engine/render/families/toon';
import { clientMaterials } from '../src/game/shardfile/clientMaterials';
import { curveAt as duskCurveAt, duskRow } from '../src/shards/sunscar-dunes/runtime/looks/duskCurves';
import { SAND_DUSK, AERIAL_FOG, FILL, type DuskCurve, type DuskRow } from '../src/shards/sunscar-dunes/data/dusk';
import template from '../src/shards/_template/shard.config';

/** clientMaterials reads the renderer only for KTX2 and graph compiles; these entries need neither. */
function renderer(): THREE.WebGLRenderer {
  const value: unknown = Object.create(THREE.WebGLRenderer.prototype);
  if (!(value instanceof THREE.WebGLRenderer)) throw new Error('Missing renderer prototype');
  return value;
}
const field = (id: number, name: string, value: number) => ({ id, name, type: 'f64' as const, privacy: 'public' as const, default: value, min: 0, max: 1 });
const uniforms = (m: THREE.Material): string => JSON.stringify(m.userData['familyUniforms'], (_key, value: unknown) => value instanceof THREE.Texture ? value.name : value);

/** Signal's dusk sand terms (data/dusk.ts SAND_DUSK) as `look.curves` rows: every curve leaf under `ground.` (the grain's strength aside, it needs its map). */
const isCurve = (row: DuskRow): row is { readonly curve: DuskCurve } => typeof row === 'object' && !Array.isArray(row) && 'curve' in row;
function sandRows(row: DuskRow, path: string): { param: string; state: string; curve: Curve }[] {
  if (isCurve(row)) return [{ param: path === 'ground.away' ? 'ground.away.amount' : path, state: 'shared.dusk', curve: row.curve }];
  if (typeof row !== 'object') return [];
  if (Array.isArray(row)) return row.flatMap((item: DuskRow, i: number) => sandRows(item, `${path}.${String(i)}`));
  return Object.entries(row).flatMap(([key, value]) => key === 'grainStrength' ? [] : sandRows(value, `${path}.${key}`));
}

describe('state-bound curves on family materials (look.curves)', () => {
  it('evaluates the dusk-curve shapes exactly as Signal\'s own evaluator', () => {
    for (const curve of [AERIAL_FOG, FILL]) for (const d of [0, 0.13, 0.5, 0.71, 1]) expect(curveAt(curve, d)).toBe(duskCurveAt(curve, d));
  });

  it('moves Signal\'s sand ground layer with a declared dusk field, uniform for uniform as its dusk adapter', async () => {
    const base = emptyShardfile({ slug: 'curve-sand', name: 'Curve sand', author: 'Local', seed: 1, revision: 1 });
    const at0 = duskRow(SAND_DUSK, 0) as { contrast: unknown; albedo: number; shade: unknown; away: number };
    const entry = { family: 'pbr', vertexColours: true, roughness: 0.88, metalness: 0, ground: { wind: [-0.643, 0.766], contrast: at0.contrast, albedo: at0.albedo, shade: at0.shade, away: { from: [0.3, -0.9], amount: at0.away } } };
    const shard: Shardfile = parseShardfile({ ...base, state: { ...base.state, shared: [field(1, 'dusk', 0.25)] },
      look: { ...base.look, families: ['toon', 'pbr'], materials: { sand: entry }, curves: { sand: sandRows(SAND_DUSK, 'ground') } } });
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
        const terms = duskRow(SAND_DUSK, next) as { contrast: { near: number; far: number; window: [number, number]; strength: number }; albedo: number; shade: { tint: [number, number, number]; gain: number; lift: [number, number, number]; amount: number; edge: number; floor: [number, number, number] }; away: number };
        updateGround(twin, { contrast: terms.contrast, albedo: terms.albedo, shade: terms.shade, away: { from: [0.3, -0.9], amount: terms.away } });
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
      'curves pbr: shared.missing is not a declared public numeric state field',
      'curves pbr: shared.missing is not a declared public numeric state field',
      'curves pbr: pbr cannot move faceted without a new program',
      'curves pbr: shared.missing is not a declared public numeric state field',
      'curves pbr: ground.albedo is not a number of the entry',
    ]);
  });
});
