import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial, Vector3, Vector4, type ShaderMaterial, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three';
import { legacyDouble } from '../../fake/FakeGame';
import { applySurfaceLooks, type SurfaceLook } from '../../../src/game/systems/looks/surfaceLooks';
import { duskDomeFragment, duskDomeMaterial, DUSK_DOME_VERTEX, type DuskDomeStyle } from '../../../src/game/systems/looks/duskDome';
import { BRAZIER_SURFACE, CAMP_SURFACE, COIL_SURFACE, GLOVE_SURFACE } from '../../../src/shards/sunscar-dunes/data/surfaces';
import { SKY_STYLE } from '../../../src/shards/sunscar-dunes/data/sky';
// The hero models' shader patches and the procedural dome as Signal Dunes' own code built them before they became rows
// (HEAD ba62c96f2, world/meshes.ts warmByFire / viewerLit / leatherDetail / fieldstoneBase / greyed, look/sky.ts), each
// patch chain run over a skeleton of the standard material's include points.
import before from './surface-shaders.json' with { type: 'json' };

/** GLSL as the compiler reads it: comments dropped, whitespace collapsed, each float literal in one spelling (0.580 = 0.58). */
const glsl = (source: string): string => source.replaceAll(/\/\/[^\n]*/gu, '').replaceAll(/\s+/gu, ' ').trim()
  .replaceAll(/\b\d+\.\d+\b/gu, (n) => { const v = Number(n); return Number.isInteger(v) ? v.toFixed(1) : String(v); });

const inputs = { lights: { value: [0, 1, 2, 3].map(() => new Vector4()) }, dusk: { value: 0.3 } };
interface Compiled { vertexShader: string; fragmentShader: string; uniforms: string[]; key: string }
function compiled(looks: readonly SurfaceLook[]): Compiled {
  const m = new MeshStandardMaterial(); applySurfaceLooks(m, looks, inputs);
  // a fake program: the patches only edit the source and add uniforms
  const shader = legacyDouble<WebGLProgramParametersWithUniforms>({ vertexShader: before.skeleton.vertexShader, fragmentShader: before.skeleton.fragmentShader, uniforms: {} });
  m.onBeforeCompile(shader, legacyDouble<WebGLRenderer>({}));
  return { vertexShader: shader.vertexShader, fragmentShader: shader.fragmentShader, uniforms: Object.keys(shader.uniforms), key: m.customProgramCacheKey() };
}

/** A second look on the same families: a ranger's cold-lit oiled leather and a moss-banded slate plinth by blue spirit fires. */
const SPIRIT_FIRE: SurfaceLook = { kind: 'firelight', colour: [0.2, 0.5, 1], reach: 7, falloff: 1.5, gain: 1.2 };
const RANGER_LIGHT: SurfaceLook = { kind: 'viewerLight', gain: [0.2, 0.3, 0.45], facing: [0.35, 0.65], dusk: 0, sheen: 0.4, sheenColour: [0.6, 0.8, 1], sheenPower: 2, sheenDamp: 0.3 };
const RANGER: readonly SurfaceLook[] = [RANGER_LIGHT, { kind: 'leather', crease: [4, 12, 4], sharpness: 3, grain: 80, mix: [0.3, 0.7], albedo: [0.9, 0.2], depth: 0.001 }];
const SLATE: readonly SurfaceLook[] = [
  { kind: 'stoneBand', below: [0.1, 0.3], rows: 6, wave: [3, 0.1], perRow: [5, 2], mortar: [0.02, 0.08], aspect: 1.2,
    dark: [0.04, 0.06, 0.05], light: [0.1, 0.16, 0.12], speckle: [0.9, 0.2], speckleScale: 3, mortarColour: [0.08, 0.12, 0.06] },
  { kind: 'desaturate', amount: 0.3 }, SPIRIT_FIRE,
];
/** A second dome: a clear teal-and-violet alien dusk, no cloud deck. */
const ALIEN_DUSK: DuskDomeStyle = {
  ...SKY_STYLE, sun: [-0.5, -0.1, 0.8], band: { away: [0.2, 0.5, 0.45], toward: [0.3, 0.8, 0.6], power: 2, gain: [0.6, 0.2] },
  rose: { early: [0.3, 0.3, 0.5], late: [0.2, 0.25, 0.5] }, clouds: null, stars: { colour: [1, 0.8, 0.7], density: 0.99, gain: [1, 1] },
};

describe('surface looks and the dusk dome run a shard\'s look from rows (SHARD-PLATFORM SF72, look-family rows)', () => {
  it('Signal Dunes\' surface rows compile to exactly the shaders its own patches built (pixel parity by construction)', () => {
    const rows = [['glove', GLOVE_SURFACE], ['brazier', BRAZIER_SURFACE], ['camp', CAMP_SURFACE], ['coil', COIL_SURFACE]] as const;
    for (const [name, looks] of rows) {
      const got = compiled(looks), want = before[name];
      expect([glsl(got.vertexShader), glsl(got.fragmentShader), got.uniforms], name).toEqual([glsl(want.vertexShader), glsl(want.fragmentShader), want.uniforms]);
    }
  });

  it('Signal Dunes\' dome row compiles to exactly the old dome, and its material is the old one\'s', () => {
    expect([glsl(DUSK_DOME_VERTEX), glsl(duskDomeFragment(SKY_STYLE))]).toEqual([glsl(before.sky.vertexShader), glsl(before.sky.fragmentShader)]);
    const dusk = { value: 0.5 }, m: ShaderMaterial = duskDomeMaterial(SKY_STYLE, dusk);
    expect([m.depthTest, m.depthWrite, m.fog, m.side, m.uniforms['uDusk'] === dusk]).toEqual([false, false, false, 1, true]);
    const sun: unknown = m.uniforms['uSun']?.value;
    expect(sun instanceof Vector3 ? sun.toArray() : null).toEqual(new Vector3(0.2, -0.07, -0.98).normalize().toArray());
  });

  it('second looks draw in their own numbers, and two rows of one family never share a program', () => {
    const ranger = compiled(RANGER), slate = compiled(SLATE);
    expect(ranger.fragmentShader).toContain('vec3(0.2, 0.3, 0.45)');
    expect(ranger.fragmentShader).toContain('vLeatherP * vec3(4.0, 12.0, 4.0)');
    expect(slate.fragmentShader).toContain('vec3(0.2, 0.5, 1.0) * uFireLights[i].w * pow(max(0.0, 1.0 - fireD / 7.0), 1.5) * 1.2');
    expect(slate.fragmentShader).toContain('smoothstep(0.1, 0.3, vStoneP.y)');
    expect(compiled(COIL_SURFACE).key).not.toBe(compiled([RANGER_LIGHT]).key);
    expect(compiled([SPIRIT_FIRE]).key).not.toBe(compiled(CAMP_SURFACE).key);
    const alien = duskDomeFragment(ALIEN_DUSK);
    expect(alien).toContain('float cov = 0.0;');
    expect(alien).not.toContain('cBelow');
    expect(alien).toContain('mix(vec3(0.2, 0.5, 0.45), vec3(0.3, 0.8, 0.6), pow(toward, 2.0))');
  });

  it('a row that reads a shared input refuses a material without it', () => {
    expect(() => { applySurfaceLooks(new MeshStandardMaterial(), CAMP_SURFACE); }).toThrow(/lights/u);
    expect(() => { applySurfaceLooks(new MeshStandardMaterial(), COIL_SURFACE); }).toThrow(/dusk/u);
  });
});
