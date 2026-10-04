import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { legacyDouble } from './fake/FakeGame';
import { MEASURE_SLOT, measureUv, parseFamilyMaterial } from '../src/engine/render/families/params';
import { MEASURE_PROGRAM_KEY } from '../src/engine/render/families/measure';
import { compilePbr, pbrFillers } from '../src/engine/render/families/pbr';
import { measureBox } from '../src/shards/_template/generators/world';
import { TEMPLATE_LOOK } from '../src/shards/_template/data/look';

/** the shader's decode of a measure UV, mirrored */
function decode(x: number, y: number): { role: number; u: number; v: number; w: number; h: number } {
  const code = Math.floor(x / MEASURE_SLOT), hq = Math.floor(y / MEASURE_SLOT);
  return { role: code % 4, w: Math.floor(code / 4) / 2, h: hq / 2, u: x - code * MEASURE_SLOT - 1, v: y - hq * MEASURE_SLOT - 1 };
}
function compiled(m: THREE.Material): THREE.WebGLProgramParametersWithUniforms {
  const lib = THREE.ShaderLib.physical;
  const shader = legacyDouble<THREE.WebGLProgramParametersWithUniforms>({ uniforms: THREE.UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader });
  m.onBeforeCompile(shader, legacyDouble<THREE.WebGLRenderer>({}));
  return shader;
}
const parsePbr = (entry: object) => { const p = parseFamilyMaterial({ family: 'pbr', ...entry }); if (p.family !== 'pbr') throw new Error('pbr'); return p; };

describe('SF56 measure layer', () => {
  it('packs role, face metres and size into one UV pair the shader decodes exactly', () => {
    for (const [role, u, v, w, h] of [[1, 0, 0, 6, 3], [2, 6, 3, 6, 3], [1, 2.25, 0.1, 31.5, 0.3], [2, 40, 1, 62, 2]] as const) {
      const d = decode(...measureUv(role, u, v, w, h));
      expect(d.role).toBe(role);
      expect(d.u).toBeCloseTo(u, 3); expect(d.v).toBeCloseTo(v, 3);
      // a size is labelled only when it is a whole or half metre within 31.5 m: a label never rounds
      expect(d.w).toBe(w <= 31.5 && Number.isInteger(w * 2) ? w : 0); expect(d.h).toBe(Number.isInteger(h * 2) ? h : 0);
    }
    expect(() => measureUv(1, 7, 0, 6, 3)).toThrow(/62 m/);
  });

  it('gives every box face its own metres from its corner and its size', () => {
    const uv = measureBox(6, 3, 0.3, 1).getAttribute('uv'), faces: { w: number; h: number; maxU: number; maxV: number }[] = [];
    for (let i = 0; i < uv.count; i++) {
      const d = decode(uv.getX(i), uv.getY(i)), face = Math.floor(i / 4);
      expect(d.role).toBe(1);
      const f = faces[face] ?? { w: d.w, h: d.h, maxU: 0, maxV: 0 }; f.maxU = Math.max(f.maxU, d.u); f.maxV = Math.max(f.maxV, d.v); faces[face] = f;
    }
    // ±x: depth × height; ±y: width × depth; ±z: width × height (0.3 m is no half metre: unlabelled; the shader labels only ≥ 1 m)
    expect(faces.map((f) => [f.maxU, f.maxV].map((n) => Math.round(n * 100) / 100))).toEqual([[0.3, 3], [0.3, 3], [6, 0.3], [6, 0.3], [6, 3], [6, 3]]);
    expect(faces[4]).toMatchObject({ w: 6, h: 3 }); expect(faces[0]).toMatchObject({ w: 0, h: 3 });
  });

  it('compiles to the measure program on the PBR family and always draws the dev map (G163: no off switch)', () => {
    const m = compilePbr(parsePbr({ vertexColours: true, metalness: 0, faceted: true, measure: {} }), () => pbrFillers().white);
    expect(m.customProgramCacheKey()).toContain(MEASURE_PROGRAM_KEY);
    const shader = compiled(m);
    expect(shader.fragmentShader).toContain('famMGlyph(');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb = famMOut;');
    expect(shader.fragmentShader).not.toContain('famMOn');
    expect(shader.uniforms).not.toHaveProperty('famMOn');
    expect(shader.vertexShader).toContain('vFamMUv = uv;');
    expect(() => compilePbr(parsePbr({ measure: {}, ground: {} }), () => pbrFillers().white)).toThrow(/ground or a measure/);
  });

  it('opts a shardfile in only through its look data, and Template 1 declares it', () => {
    expect(parsePbr({}).measure).toBeNull();
    expect(compilePbr(parsePbr({ vertexColours: true }), () => pbrFillers().white).customProgramCacheKey()).not.toContain(MEASURE_PROGRAM_KEY);
    expect(parsePbr(TEMPLATE_LOOK.materials.pbr).measure).not.toBeNull();
  });
});
