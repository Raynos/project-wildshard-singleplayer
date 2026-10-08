import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { legacyDouble } from './fake/FakeGame';
import { parseFamilyMaterial, PAINTED_TERRAIN_ATTRIBUTES, parsePaintedTerrain, paintedTerrainTextureRefs, type PainterlyMaterialParams } from '../src/engine/render/families/params';
import { bindPaintedTerrainBake, fillPaintedTerrainAttributes, paintedTerrainBakeOff, paintedTerrainBakesKey, paintedTerrainUniforms, applyPaintedTerrain } from '../src/engine/render/families/paintedTerrain';
import { compilePainterly, PAINTERLY_PROGRAM_KEY, PainterlyLook } from '../src/engine/render/families/painterly';
import { familyMaterial } from '../src/engine/render/families/registry';
import { ToonLook } from '../src/engine/render/families/toon';
import { materialTextureRefs } from '../src/game/shardfile/materials';
import { painterlyMaterial } from '../src/engine/world/painterly';
import { applyTerrainSurface } from '../src/shards/nalati-grasslands/terrainSurface';
import { NALATI_TERRAIN_SURFACE } from '../src/shards/nalati-grasslands/look/terrainLayer';
import { TEX_MEAN, TEX_METRES } from '../src/shards/nalati-grasslands/look/nalatiTextures';
import { GLACIER, SNOW_LINE } from '../src/shards/nalati-grasslands/layout';

/** run a material's onBeforeCompile on three's Lambert source, as WebGLPrograms would */
function compiled(m: THREE.Material): THREE.WebGLProgramParametersWithUniforms {
  const lib = THREE.ShaderLib.lambert;
  const shader = legacyDouble<THREE.WebGLProgramParametersWithUniforms>({ uniforms: THREE.UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader });
  m.onBeforeCompile(shader, legacyDouble<THREE.WebGLRenderer>({}));
  return shader;
}

const LAYER = {
  maps: { base: 'b', track: 't', gravel: 'g', rock: 'r', snow: 's' },
  metres: { base: 2.5, track: 2, gravel: 1.6, rock: 4, snow: 3 },
  means: { base: [0.25, 0.245, 0.056], rock: [0.297, 0.247, 0.181] },
  snow: { line: 55, high: [44, 84] },
  wet: [-9.2, -9.9],
};
const painterly = (entry: object): PainterlyMaterialParams => {
  const p = parseFamilyMaterial({ family: 'painterly', ...entry });
  if (p.family !== 'painterly') throw new Error('not painterly');
  return p;
};
const textures = (asked: string[]) => (ref: string, use: 'colour' | 'data'): THREE.Texture => { asked.push(`${ref}:${use}`); const t = new THREE.Texture(); t.name = ref; return t; };

describe('the painterly family\'s painted-terrain layer (G227)', () => {
  it('validates its data, fills defaults, and leaves a plain painterly entry unchanged', () => {
    const p = parsePaintedTerrain(LAYER);
    expect(p.ice).toBeNull();
    expect(p.bakeKeyLight).toBe('phone');
    expect(p.zones).toEqual({ a: { tint: [0.86, 1.1, 0.8], amount: 0.55 }, b: { tint: [1.2, 1.02, 0.6], amount: 0.65 } });
    expect(paintedTerrainTextureRefs(p)).toEqual(['b', 't', 'g', 'r', 's']);
    expect(() => parsePaintedTerrain({ ...LAYER, wet: [-9.9, -9.2] })).toThrow(/wet margin/);
    expect(() => parsePaintedTerrain({ ...LAYER, snow: { line: 55, high: [84, 44] } })).toThrow(/snow high/);
    expect(() => parsePaintedTerrain({ ...LAYER, means: { base: [0, 0, 0], rock: [1, 1, 1] } })).toThrow();
    expect(Object.hasOwn(painterly({}), 'terrain')).toBe(false);
    const withLayer = painterly({ terrain: LAYER });
    expect(structuredClone(withLayer)).toEqual(withLayer);
    expect(materialTextureRefs({ ground: { ...withLayer, map: 'm' } })).toEqual(['m', 'b', 't', 'g', 'r', 's']);
  });

  it('declares the per-vertex inputs a baked tile carries', () => {
    expect(PAINTED_TERRAIN_ATTRIBUTES).toEqual({
      mask: { name: '_surf', size: 4, fill: [9, 0, 0, 0] }, track: { name: '_rdir', size: 2, fill: [1, 0] }, zone: { name: '_zone', size: 3, fill: [0, 0, 0] },
    });
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    geo.setAttribute('_zone', new THREE.BufferAttribute(new Float32Array(12).fill(0.5), 3));
    fillPaintedTerrainAttributes(geo);
    expect([...geo.getAttribute('_surf').array]).toEqual([9, 0, 0, 0, 9, 0, 0, 0, 9, 0, 0, 0, 9, 0, 0, 0]);
    expect([...geo.getAttribute('_rdir').array]).toEqual([1, 0, 1, 0, 1, 0, 1, 0]);
    expect(geo.getAttribute('_zone').getX(0)).toBe(0.5); // what a mesh carries is kept
  });

  it('compiles on the painterly program with the layer: attributes, maps as colour, uniforms, program variants', () => {
    const asked: string[] = [], look = new PainterlyLook({ grade: null });
    const m = compilePainterly(painterly({ bands: 0.5, rim: 0, shade: 0.85, terrain: LAYER }), look, textures(asked));
    expect(asked).toEqual(['b:colour', 't:colour', 'g:colour', 'r:colour', 's:colour']);
    expect(m.customProgramCacheKey().startsWith(`${PAINTERLY_PROGRAM_KEY}|terrain`)).toBe(true);
    const sh = compiled(m);
    for (const a of ['attribute vec4 _surf;', 'attribute vec2 _rdir;', 'attribute vec3 _zone;', 'vFamTWorld = ( modelMatrix']) expect(sh.vertexShader).toContain(a);
    expect(sh.fragmentShader).toContain('#define RE_Direct RE_Direct_Lambert'); // the painterly light model stays the one ramp
    expect(sh.fragmentShader).toContain('famTBakedContact( vFamTWorld )');
    expect(sh.fragmentShader).not.toContain('famTIceInfo.y / 7.0'); // no ice tongue: no ice code
    const u = paintedTerrainUniforms(m);
    if (u === null) throw new Error('no layer uniforms');
    expect(sh.uniforms['famTBase']).toBe(u.famTBase);
    expect(u.famTBase.value.name).toBe('b');
    expect(u.famTScale.value.toArray()).toEqual([1 / 2.5, 1 / 2, 1 / 1.6, 1 / 4]);
    expect(u.famTSnowLine.value.toArray()).toEqual([55, 44, 84]);
    expect(u.famTWet.value.toArray()).toEqual([-9.2, -9.9]);
    const ice = compilePainterly(painterly({ terrain: { ...LAYER, ice: { from: [0, 0], to: [30, 40], half: 10 } } }), look, textures([]));
    expect(ice.customProgramCacheKey()).toContain('|ice');
    expect(compiled(ice).fragmentShader).toContain('famTIceInfo.y / 7.0');
    expect(paintedTerrainUniforms(ice)?.famTIceInfo.value.toArray()).toEqual([10, 50, 0]);
    // the key shadowed by the bake: phones by default, or always / never
    expect([paintedTerrainBakesKey(parsePaintedTerrain(LAYER), 'phone'), paintedTerrainBakesKey(parsePaintedTerrain(LAYER), 'desktop')]).toEqual([true, false]);
    const baked = new THREE.MeshLambertMaterial(), cheapNoBake = new THREE.MeshLambertMaterial();
    applyPaintedTerrain(baked, parsePaintedTerrain(LAYER), textures([]), { cheap: false, bakeKey: true });
    applyPaintedTerrain(cheapNoBake, parsePaintedTerrain(LAYER), textures([]), { cheap: true, bakeKey: false });
    const bakedSource = compiled(baked).fragmentShader, cheapSource = compiled(cheapNoBake).fragmentShader;
    expect(bakedSource).toContain('directLight.color *= famTBakedShadow( vFamTWorld );');
    expect(bakedSource).toContain('vec2 st = vec2( 1.0, 0.45 ) * s * 0.21;');
    expect(cheapSource).not.toContain('famTBakedShadow( vFamTWorld );\n');
    expect(cheapSource).toContain('r = mix( r, famTRockBig( p, N, s )');
    expect(baked.customProgramCacheKey()).not.toBe(cheapNoBake.customProgramCacheKey());
  });

  it('shares a live bake by reference before the first draw, and refuses after', () => {
    const m = compilePainterly(painterly({ terrain: LAYER }), new PainterlyLook({ grade: null }), textures([]));
    const bake = paintedTerrainBakeOff();
    bindPaintedTerrainBake(m, bake);
    const sh = compiled(m);
    expect(sh.uniforms['famTBakeShadow']).toBe(bake.famTBakeShadow);
    expect(sh.uniforms['famTContactXf']).toBe(bake.famTContactXf);
    expect(() => { bindPaintedTerrainBake(m, paintedTerrainBakeOff()); }).toThrow(/before the first draw/);
    expect(() => { bindPaintedTerrainBake(new THREE.MeshLambertMaterial(), bake); }).toThrow(/no painted-terrain layer/);
  });

  it('Nalati\'s entry carries today\'s terrain inputs exactly (terrainSurface.ts → the layer)', () => {
    const scope = new Scope('painted-terrain-test');
    const tex = { meadow: new THREE.Texture(), path: new THREE.Texture(), gravel: new THREE.Texture(), rock: new THREE.Texture(), snow: new THREE.Texture() };
    const resolve = (ref: string): THREE.Texture => {
      if (ref === 'meadow' || ref === 'path' || ref === 'gravel' || ref === 'rock' || ref === 'snow') return tex[ref];
      throw new Error(ref);
    };
    const m = familyMaterial(NALATI_TERRAIN_SURFACE, { toon: new ToonLook(), painterly: new PainterlyLook({ grade: null }), textures: resolve, scope });
    const today = painterlyMaterial(null, { bands: 0.5, rim: 0, shade: 0.85 });
    applyTerrainSurface(today, tex);
    const live = compiled(today).uniforms, fam = compiled(m).uniforms;
    const pairs = [['tMeadow', 'famTBase'], ['tPath', 'famTTrack'], ['tGravel', 'famTGravel'], ['tRock', 'famTRock'], ['tSnow', 'famTSnow'], ['uMeanMeadow', 'famTMeanBase'], ['uMeanRock', 'famTMeanRock'], ['uTexScale', 'famTScale'], ['uSnowScale', 'famTSnowScale'], ['uPRim', 'famPaintRim'], ['uPBands', 'famPaintBands'], ['uPShadeAmt', 'famPaintShadeAmt']] as const;
    for (const [a, b] of pairs) expect([b, fam[b]?.value]).toEqual([b, live[a]?.value]);
    const u = paintedTerrainUniforms(m);
    expect(u?.famTSnowLine.value.x).toBe(SNOW_LINE);
    expect(u?.famTIce.value.toArray()).toEqual([GLACIER.x0, GLACIER.z0, GLACIER.x1 - GLACIER.x0, GLACIER.z1 - GLACIER.z0]);
    expect(u?.famTIceInfo.value.x).toBe(GLACIER.half);
    expect(NALATI_TERRAIN_SURFACE.terrain.metres.base).toBe(TEX_METRES.meadow);
    expect(NALATI_TERRAIN_SURFACE.terrain.means.rock).toEqual([...TEX_MEAN.rock]);
    // the same albedo program shape: today's fragment and the layer's, identifiers mapped, differ only where a number became a uniform
    const norm = (src: string): string => src.replaceAll(/\s+/gu, ' ');
    expect(norm(compiled(m).fragmentShader)).toContain(norm('float detailAmt = 0.9 - 0.45 * smoothstep( 60.0, 260.0, dist );'));
    scope.dispose();
  });
});
