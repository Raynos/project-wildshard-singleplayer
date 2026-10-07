import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { legacyDouble } from './fake/FakeGame';
import { parseFamilyMaterial, parseGroundLayer, parsePainterlyLook, parseToonLook } from '../src/engine/render/families/params';
import { compileEmissive, EMISSIVE_PROGRAM_KEY, EmissiveLook, injectEmissive } from '../src/engine/render/families/emissive';
import { GROUND_POOLS, GROUND_PROGRAM_KEY, setGroundPools, updateGround } from '../src/engine/render/families/ground';
import { compilePainterly, gradeRgb, PAINTERLY_PROGRAM_KEY, PainterlyLook } from '../src/engine/render/families/painterly';
import { ungrade } from '../src/shards/nalati-grasslands/look/grade';
import { compilePbr, pbrFillers, type TextureUse } from '../src/engine/render/families/pbr';
import { familyCompileJobs, familyMaterial, liveFamilyMaterials } from '../src/engine/render/families/registry';
import { compileToon, injectToon, TOON_PROGRAM_KEY, ToonLook } from '../src/engine/render/families/toon';

/** run a material's onBeforeCompile on three's physical source, as WebGLPrograms would */
function compiled(m: THREE.Material): THREE.WebGLProgramParametersWithUniforms {
  const lib = THREE.ShaderLib.physical;
  const shader = legacyDouble<THREE.WebGLProgramParametersWithUniforms>({ uniforms: THREE.UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader });
  m.onBeforeCompile(shader, legacyDouble<THREE.WebGLRenderer>({}));
  return shader;
}

describe('material family parameters (renderer-neutral)', () => {
  it('fills every family default from a bare entry', () => {
    expect(parseFamilyMaterial({ family: 'toon' })).toEqual({ family: 'toon', colour: [1, 1, 1], vertexColours: true, faceted: true, doubleSided: true, roughness: 0.88, metalness: 0 });
    const pbr = parseFamilyMaterial({ family: 'pbr', maps: { colour: 'a', normal: null, orm: 'b' } });
    expect(pbr).toMatchObject({ family: 'pbr', roughness: 1, metalness: 1, occlusion: 1, envStrength: 1, doubleSided: false, alphaCutoff: 0 });
    expect(parseToonLook({})).toMatchObject({ faceEdge: [0.14, 0.2], shadowEdge: [0.25, 0.75], litGrade: 0.2, glossBelow: 0.72, caustics: { level: null } });
  });

  it('round-trips through JSON unchanged (plain data, no renderer objects)', () => {
    const p = parseFamilyMaterial({ family: 'pbr', colour: [0.5, 0.25, 1], maps: { colour: 'commons:'.concat('a'.repeat(64)), normal: 'n', orm: null } });
    const wire = JSON.stringify(p);
    expect(parseFamilyMaterial(JSON.parse(wire) as unknown)).toEqual(p);
  });

  it('rejects unknown families, unknown keys, out-of-range values and reversed edges', () => {
    expect(() => parseFamilyMaterial({ family: 'glass' })).toThrow(/material family/);
    expect(() => parseFamilyMaterial({ family: 'toon', shader: 'void main(){}' })).toThrow(/shader/);
    expect(() => parseFamilyMaterial({ family: 'toon', colour: [1.2, 0, 0] })).toThrow();
    expect(() => parseFamilyMaterial({ family: 'pbr', roughness: Number.NaN })).toThrow();
    expect(() => parseFamilyMaterial({ family: 'pbr', maps: { colour: '', normal: null, orm: null } })).toThrow();
    expect(() => parseToonLook({ faceEdge: [0.3, 0.2] })).toThrow(/edge low < high/);
    expect(() => parseToonLook({ lift: [-0.1, 0, 0] })).toThrow();
  });
});

describe('the toon family', () => {
  it('injects its light model after three\'s physical lights chunk and shares one program key', () => {
    const look = new ToonLook({ lift: [0.1, 0.05, 0.2] });
    const a = compileToon(parseToonMaterial({}), look), b = compileToon(parseToonMaterial({ colour: [0.2, 0.4, 0.6], roughness: 0.3 }), new ToonLook());
    expect(a.customProgramCacheKey()).toBe(TOON_PROGRAM_KEY);
    expect(b.customProgramCacheKey()).toBe(a.customProgramCacheKey());
    const shader = compiled(a);
    const at = shader.fragmentShader.indexOf('#include <lights_physical_pars_fragment>');
    expect(at).toBeGreaterThan(-1);
    expect(shader.fragmentShader.indexOf('#define RE_Direct				RE_Direct_FamToon')).toBeGreaterThan(at);
    expect(shader.uniforms['famToonLift']).toBe(look.uniforms.famToonLift);
    expect(look.uniforms.famToonLift.value.r).toBeCloseTo(0.1);
  });

  it('maps material parameters to program flags and the look to shared uniforms', () => {
    const look = new ToonLook();
    const m = compileToon(parseToonMaterial({ doubleSided: false, faceted: false, vertexColours: false }), look);
    expect([m.side, m.flatShading, m.vertexColors]).toEqual([THREE.FrontSide, false, false]);
    look.set({ rim: [2, 1, 0.5], caustics: { level: 1.5, strength: 0.4 } });
    expect(look.uniforms.famToonRim.value.toArray()).toEqual([2, 1, 0.5]);
    expect(look.uniforms.famToonWater.value.toArray()).toEqual([1.5, 0.4]);
    look.set({ caustics: { level: null, strength: 0.4 } });
    expect(look.uniforms.famToonWater.value.x).toBeLessThan(-1000);
    expect(() => { look.set({ litGrade: 2 }); }).toThrow();
  });

  it('refuses a source without the physical lights chunk', () => {
    expect(() => injectToon('void main() {}')).toThrow(/lights_physical_pars_fragment/);
  });
});

describe('the PBR family', () => {
  it('fills missing maps so every PBR surface shares one program', () => {
    const asked: [string, TextureUse][] = [];
    const tex = new THREE.Texture();
    const m = compilePbr(parsePbr({ maps: { colour: 'c', normal: null, orm: 'o' }, occlusion: 0, normalScale: 0.5 }), (ref, use) => { asked.push([ref, use]); return tex; });
    expect(asked).toEqual([['o', 'data'], ['c', 'colour']]);
    expect(m.normalMap).toBe(pbrFillers().flatNormal);
    expect([m.map, m.aoMap, m.roughnessMap, m.metalnessMap]).toEqual([tex, tex, tex, tex]);
    // the flat filler (128 / 255) is not exactly zero: with no normal map the scale is zero, so the geometry normal stands (SF50)
    expect([m.aoMapIntensity, m.normalScale.x, m.normalScale.y]).toEqual([0, 0, 0]);
    const mapped = compilePbr(parsePbr({ maps: { colour: null, normal: 'n', orm: null }, normalScale: 0.5 }), () => tex);
    expect([mapped.normalScale.x, mapped.normalScale.y]).toEqual([0.5, -0.5]);
    const bare = compilePbr(parsePbr({}), () => tex);
    expect([bare.map, bare.aoMap, bare.aoMapIntensity]).toEqual([pbrFillers().white, pbrFillers().white, 0]);
  });
});

describe('the family registry and the shader step', () => {
  it('compiles one stand-in per live program variant and forgets a disposed scope', () => {
    const scope = new Scope('families-test');
    const ctx = { toon: new ToonLook(), textures: () => new THREE.Texture(), scope };
    expect(familyCompileJobs(null, null)).toEqual([]);
    const toonA = familyMaterial({ family: 'toon' }, ctx);
    familyMaterial({ family: 'toon', colour: [0.3, 0.3, 0.3] }, ctx); // same program as toonA
    familyMaterial({ family: 'toon', doubleSided: false }, ctx);     // another side: another program
    familyMaterial({ family: 'pbr' }, ctx);
    expect(liveFamilyMaterials().get(toonA)?.family).toBe('toon');
    const meshes = (jobs: ReturnType<typeof familyCompileJobs>): THREE.Mesh[] => jobs.flatMap((j) => j.root.children).filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    expect(meshes(familyCompileJobs(null, null))).toHaveLength(3);
    expect(() => familyMaterial({ family: 'toon', roughness: 3 }, ctx)).toThrow();
    scope.dispose();
    expect(liveFamilyMaterials().size).toBe(0);
    expect(familyCompileJobs(null, null)).toEqual([]);
  });
});

function parseToonMaterial(entry: object): Extract<ReturnType<typeof parseFamilyMaterial>, { family: 'toon' }> {
  const p = parseFamilyMaterial({ ...entry, family: 'toon' });
  if (p.family !== 'toon') throw new Error('not toon');
  return p;
}
function parsePbr(entry: object): Extract<ReturnType<typeof parseFamilyMaterial>, { family: 'pbr' }> {
  const p = parseFamilyMaterial({ ...entry, family: 'pbr' });
  if (p.family !== 'pbr') throw new Error('not pbr');
  return p;
}

/** run a material's onBeforeCompile on one of three's ShaderLib sources */
function compiledFrom(m: THREE.Material, lib: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }): THREE.WebGLProgramParametersWithUniforms {
  const shader = legacyDouble<THREE.WebGLProgramParametersWithUniforms>({ uniforms: THREE.UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader });
  m.onBeforeCompile(shader, legacyDouble<THREE.WebGLRenderer>({}));
  return shader;
}
const noTextures = (): THREE.Texture => { throw new Error('no textures expected'); };

describe('the painterly family', () => {
  it('fills its defaults and keeps Nalati\'s grade as the look default', () => {
    expect(parseFamilyMaterial({ family: 'painterly' })).toEqual({ family: 'painterly', colour: [1, 1, 1], rim: 0.35, bands: 0.8, shade: 1, floor: 1, sway: 0, emissive: [0, 0, 0], emissiveIntensity: 1, map: null, vertexColours: true, doubleSided: false, alphaCutoff: 0 });
    const look = parsePainterlyLook({});
    expect(look.grade).toEqual({ exposure: 1, gain: 1.12, shoulder: 9, saturation: 1.05, shadowTint: [0.92, 0.96, 1.05], lightTint: [1.07, 0.99, 0.84], split: [0.05, 0.6], contrast: 0.35, lookSaturation: 1 });
    expect(parsePainterlyLook({ grade: null }).grade).toBeNull();
    expect(() => parsePainterlyLook({ grade: { split: [0.6, 0.05] } })).toThrow(/edge low < high/);
    expect(() => parseFamilyMaterial({ family: 'painterly', rim: 2 })).toThrow();
  });

  it('injects the painted light model, the rim and the per-pixel grade; one program per graded look', () => {
    const look = new PainterlyLook();
    const a = compilePainterly(parsePainterly({}), look, noTextures), b = compilePainterly(parsePainterly({ rim: 0.8, colour: [0.2, 0.3, 0.4] }), look, noTextures);
    expect(a.customProgramCacheKey()).toBe(`${PAINTERLY_PROGRAM_KEY}|g`);
    expect(b.customProgramCacheKey()).toBe(a.customProgramCacheKey());
    expect(a.toneMapped).toBe(false);
    const sh = compiledFrom(a, THREE.ShaderLib.lambert);
    expect(sh.fragmentShader).toContain('#define RE_Direct RE_Direct_Lambert');
    expect(sh.fragmentShader).not.toContain('#include <envmap_fragment>');
    const graded = sh.fragmentShader.indexOf('gl_FragColor.rgb = famPaintGrade( gl_FragColor.rgb );');
    expect(graded).toBeGreaterThan(sh.fragmentShader.indexOf('#include <opaque_fragment>'));
    expect(graded).toBeLessThan(sh.fragmentShader.indexOf('#include <tonemapping_fragment>'));
    expect(sh.vertexShader).toContain('famPaintSway');
    expect(sh.uniforms['famPaintShade']).toBe(look.uniforms.famPaintShade);
    expect(sh.uniforms['famPaintRim']?.value).toBe(0.35);
    const plain = new PainterlyLook({ grade: null });
    const c = compilePainterly(parsePainterly({}), plain, noTextures);
    expect([c.customProgramCacheKey(), c.toneMapped]).toEqual([PAINTERLY_PROGRAM_KEY, true]);
    expect(compiledFrom(c, THREE.ShaderLib.lambert).fragmentShader).not.toContain('famPaintGrade(');
  });

  it('moves the look by uniforms, refuses to toggle the grade, and resolves a map as colour', () => {
    const look = new PainterlyLook();
    look.set({ shade: [0.2, 0.1, 0.05], wind: { direction: [3, 4], strength: 2 }, grade: { ...parsePainterlyLook({}).grade ?? (() => { throw new Error('graded'); })(), exposure: 2 } });
    expect(look.uniforms.famPaintShade.value.toArray()).toEqual([0.2, 0.1, 0.05]);
    expect(look.uniforms.famPaintWind.value.toArray()).toEqual([0.6, 0.8, 2]);
    expect(look.uniforms.famPaintGradeA.value.x).toBeCloseTo(2.24);
    expect(() => { look.set({ grade: null }); }).toThrow(/fixed/);
    const asked: [string, TextureUse][] = [];
    const m = compilePainterly(parsePainterly({ map: 'atlas', doubleSided: true }), look, (ref, use) => { asked.push([ref, use]); return new THREE.Texture(); });
    expect(asked).toEqual([['atlas', 'colour']]);
    expect(m.side).toBe(THREE.DoubleSide);
  });

  it('grades on the CPU exactly as Nalati\'s grade, which its own inverse undoes', () => {
    const g = parsePainterlyLook({}).grade;
    if (g === null) throw new Error('graded');
    for (const rgb of [[0.05, 0.08, 0.12], [0.4, 0.35, 0.2], [0.9, 0.7, 0.5]] as const) {
      const shown = gradeRgb(g, rgb);
      const back = ungrade([...shown]);
      back.forEach((v, k) => { expect(v).toBeCloseTo(rgb[k] ?? Number.NaN, 2); });
    }
  });
});

describe('the emissive family', () => {
  it('fills its defaults and refuses a tube that is also a sky', () => {
    expect(parseFamilyMaterial({ family: 'emissive' })).toEqual({ family: 'emissive', colour: [1, 1, 1], intensity: 1, vertexColours: false, map: null, blend: 'opaque', doubleSided: false, fog: 1, flicker: 0, tube: null, sky: null });
    const tube = { field: 'sdf', fillSpread: 0.25, skeletonSpread: 0.3 };
    expect(parseFamilyMaterial({ family: 'emissive', tube })).toMatchObject({ tube: { mono: 0, radius: 0.05, haloGain: 0.22, core: 0.5, rimShade: 0.62 } });
    expect(() => parseFamilyMaterial({ family: 'emissive', tube, sky: { maps: ['a', null] } })).toThrow(/tube or a sky/);
    expect(() => parseFamilyMaterial({ family: 'emissive', blend: 'multiply' })).toThrow();
    expect(() => parseFamilyMaterial({ family: 'emissive', sky: { maps: ['a', 'b'], elevation: [45, -8] } })).toThrow(/elevation/);
  });

  it('compiles each shape to its own program with the right blending, and shares the look', () => {
    const look = new EmissiveLook({ gain: 2 });
    const tex = new THREE.Texture();
    const asked: [string, TextureUse][] = [];
    const textures = (ref: string, use: TextureUse): THREE.Texture => { asked.push([ref, use]); return tex; };
    const surface = compileEmissive(parseEmissive({ intensity: 3 }), look, textures);
    const tube = compileEmissive(parseEmissive({ blend: 'additive', vertexColours: true, flicker: 4, fog: 0.5, tube: { field: 'sdf', fillSpread: 0.25, skeletonSpread: 0.3 } }), look, textures);
    const sky = compileEmissive(parseEmissive({ sky: { maps: ['early', 'late'], firstGain: [0.64, 1] } }), look, textures);
    expect([surface, tube, sky].map((m) => m.customProgramCacheKey())).toEqual([`${EMISSIVE_PROGRAM_KEY}|surface`, `${EMISSIVE_PROGRAM_KEY}|tube|add`, `${EMISSIVE_PROGRAM_KEY}|sky`]);
    expect([tube.blending, tube.transparent, tube.depthWrite]).toEqual([THREE.AdditiveBlending, true, false]);
    expect([sky.side, sky.depthTest, sky.depthWrite, sky.fog]).toEqual([THREE.BackSide, false, false, false]);
    expect(asked).toEqual([['sdf', 'data'], ['early', 'colour'], ['late', 'colour']]);
    const st = compiledFrom(tube, THREE.ShaderLib.basic);
    expect(st.vertexShader).toContain('vFamEmitUv = uv;');
    expect(st.fragmentShader).toContain('outgoingLight = famEmitTube( outgoingLight ) * famEmitIntensity * famEmitGain * famEmitFlick( famEmitFlicker );');
    // additive: the fog only dims (no inscatter term); opaque surfaces take the fog's colour share too
    expect(st.fragmentShader).toContain('gl_FragColor.rgb = famEmitC * famEmitTk;');
    expect(compiledFrom(surface, THREE.ShaderLib.basic).fragmentShader).toContain('famEmitZero * ( 1.0 - famEmitTk )');
    expect(st.uniforms['famEmitGain']).toBe(look.uniforms.famEmitGain);
    expect(st.uniforms['famEmitFlicker']?.value).toBe(4);
    const ss = compiledFrom(sky, THREE.ShaderLib.basic);
    expect(ss.vertexShader).toContain('vFamEmitDir = position;');
    expect(ss.uniforms['famEmitSkyB4']?.value).toEqual(new THREE.Vector4(0, 1, 0.64, 1));
    look.set({ blend: 0.7 });
    expect(look.uniforms.famEmitBlend.value).toBe(0.7);
    expect(() => injectEmissive('void main(){}', 'void main(){}', 'surface', false)).toThrow(/emissive family/);
  });
});

describe('the PBR family\'s ground layer', () => {
  it('compiles to the ground program, resolves its maps as data, and moves by uniforms', () => {
    const asked: [string, TextureUse][] = [];
    const tex = new THREE.Texture();
    const ground = { wind: [3, 4], grain: { map: 'grain', mean: 0.48, glintMean: 0.01, strength: 1 }, keyShadow: { map: 'shadow', rect: [-520, -520, 520, 520], edge: [0.25, 0.75], floor: 0.28 } };
    const m = compilePbr(parsePbr({ vertexColours: true, roughness: 0.88, metalness: 0, ground }), (ref, use) => { asked.push([ref, use]); return tex; });
    expect(m.customProgramCacheKey()).toBe(GROUND_PROGRAM_KEY);
    expect(asked).toEqual([['grain', 'data'], ['shadow', 'data']]);
    const sh = compiled(m);
    expect(sh.vertexShader).toContain('vFamGPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;');
    expect(sh.fragmentShader.indexOf('famGRip1')).toBeGreaterThan(sh.fragmentShader.indexOf('#include <color_fragment>'));
    expect(sh.uniforms['famGWind']?.value).toEqual(new THREE.Vector2(0.6, 0.8));
    expect(vec3(sh.uniforms['famGK']).x).toBeCloseTo(7);
    expect(sh.uniforms['famGShadowK']?.value).toEqual(new THREE.Vector4(0.25, 0.75, 0.28, 1));
    expect(sh.uniforms['famGTrailK']?.value).toEqual(new THREE.Vector4(1, 0, 0, 0));
    const contrast = sh.uniforms['famGContrastK'];
    updateGround(m, { contrast: { near: 0.52, far: 0.26, window: [4, 26], strength: 0.45 }, away: { from: [0.2, -0.98], amount: 0.3 } });
    expect(contrast?.value).toBe(0.45);
    expect(vec3(sh.uniforms['famGAway']).z).toBe(0.3);
    expect(() => { updateGround(m, { sheen: -1 }); }).toThrow();
    expect(() => { updateGround(new THREE.MeshStandardMaterial(), {}); }).toThrow(/ground layer/);
    expect(compilePbr(parsePbr({}), () => tex).customProgramCacheKey()).not.toBe(GROUND_PROGRAM_KEY);
    expect(() => parseGroundLayer({ trail: { map: 't', rect: [1, 0, 0, 1], ripples: 0.5, tint: [1, 1, 1], amount: 0.6 } })).toThrow(/rect/);
  });

  it('lights up to four pools (SF50: Signal Dunes\' fires) by uniforms, kept live across updateGround', () => {
    const tex = new THREE.Texture();
    const m = compilePbr(parsePbr({ ground: { pools: { low: [1, 0.72, 0.32], high: [1, 0.42, 0.14], split: 0.5, radius: 10, gain: 0.17 } } }), () => tex);
    expect(m.customProgramCacheKey()).toBe(GROUND_PROGRAM_KEY);
    const sh = compiled(m);
    expect(sh.fragmentShader.indexOf('famGPools[ i ]')).toBeGreaterThan(sh.fragmentShader.indexOf('famGShadeFloor;\n'));
    expect(sh.fragmentShader.indexOf('famGPools[ i ]')).toBeLessThan(sh.fragmentShader.indexOf('float away ='));
    expect(vec3(sh.uniforms['famGPoolK'])).toEqual(new THREE.Vector3(0.5, 10, 0.17));
    const pools: unknown = sh.uniforms['famGPools']?.value;
    if (!Array.isArray(pools)) throw new Error('famGPools is an array');
    expect(pools).toHaveLength(GROUND_POOLS);
    setGroundPools(m, [{ x: 1, y: 2, z: 3, w: 1 }, new THREE.Vector4(4, 5, 6, 0.3)]);
    expect(pools[0]).toEqual(new THREE.Vector4(1, 2, 3, 1));
    expect(pools[1]).toEqual(new THREE.Vector4(4, 5, 6, 0.3));
    expect(pools[2]).toEqual(new THREE.Vector4(0, 0, 0, 0));
    updateGround(m, { sheen: 0.2 });
    expect(sh.uniforms['famGPools']?.value).toBe(pools);
    expect(pools[0]).toEqual(new THREE.Vector4(1, 2, 3, 1));
    setGroundPools(m, []);
    expect(pools[0]).toEqual(new THREE.Vector4(0, 0, 0, 0));
    expect(() => { setGroundPools(m, [{ x: Number.NaN, y: 0, z: 0, w: 1 }]); }).toThrow(RangeError);
    expect(() => { setGroundPools(new THREE.MeshStandardMaterial(), []); }).toThrow(/ground layer/);
    const plain = compiled(compilePbr(parsePbr({ ground: {} }), () => tex));
    expect(vec3(plain.uniforms['famGPoolK']).z).toBe(0);
  });
});

describe('the registry with all four families', () => {
  it('needs each look only for its own family and compiles one stand-in per program', () => {
    const scope = new Scope('families-test-4');
    const base = { toon: new ToonLook(), textures: () => new THREE.Texture(), scope };
    expect(() => familyMaterial({ family: 'painterly' }, base)).toThrow(/painterly look/);
    expect(() => familyMaterial({ family: 'emissive' }, base)).toThrow(/emissive look/);
    const ctx = { ...base, painterly: new PainterlyLook(), emissive: new EmissiveLook() };
    familyMaterial({ family: 'painterly' }, ctx);
    familyMaterial({ family: 'painterly', rim: 0.9 }, ctx);                  // same program
    familyMaterial({ family: 'emissive', blend: 'additive' }, ctx);
    familyMaterial({ family: 'emissive', sky: { maps: ['a', null] } }, ctx);
    familyMaterial({ family: 'pbr', ground: {} }, ctx);
    const meshes = familyCompileJobs(null, null).flatMap((j) => j.root.children);
    expect(meshes).toHaveLength(4);
    scope.dispose();
    expect(liveFamilyMaterials().size).toBe(0);
  });
});

function parsePainterly(entry: object): Extract<ReturnType<typeof parseFamilyMaterial>, { family: 'painterly' }> {
  const p = parseFamilyMaterial({ ...entry, family: 'painterly' });
  if (p.family !== 'painterly') throw new Error('not painterly');
  return p;
}
function parseEmissive(entry: object): Extract<ReturnType<typeof parseFamilyMaterial>, { family: 'emissive' }> {
  const p = parseFamilyMaterial({ ...entry, family: 'emissive' });
  if (p.family !== 'emissive') throw new Error('not emissive');
  return p;
}
function vec3(u: THREE.IUniform | undefined): THREE.Vector3 {
  const v: unknown = u?.value;
  if (!(v instanceof THREE.Vector3)) throw new Error('not a vec3 uniform');
  return v;
}
