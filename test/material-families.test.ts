import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Scope } from '../src/engine/app/scope';
import { legacyDouble } from './fake/FakeGame';
import { parseFamilyMaterial, parseToonLook } from '../src/engine/render/families/params';
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
    expect([m.aoMapIntensity, m.normalScale.x, m.normalScale.y]).toEqual([0, 0.5, -0.5]);
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
