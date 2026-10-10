import { SlashTrail } from '@wildshard/engine/combat/view/slashTrail';
// The brush trail (SHARD-PLATFORM M3), 飞白 "flying white": a held blade's slash ribbon on the engine's slash trail (a ring
// of blade samples, an inner point on the blade and the tip, each gap subdivided on a Catmull-Rom curve so a fast slash
// reads as an arc, alpha by age), drawn as a brush:
//   - the ribbon is a dry-brush stroke: parallel hair streaks along the motion (fine noise across the ribbon), gaps that
//     open as the brush runs dry toward the tail (the threshold rises with age), a ragged inner edge, a loaded tip edge;
//   - two looks on one program: `ink` (ink-indigo pigment with the paper showing through the streaks, and a thin neon
//     thread on the leading tip edge) and `light` (pale silk-white streaks, additive, cyan core) — uMode;
//   - the blending never touches the target's alpha (a renderer may keep inverse depth there): CustomBlending with the
//     alpha factors Zero / One.
import {
  AddEquation, Color, CustomBlending, DoubleSide, Mesh, OneFactor, OneMinusSrcAlphaFactor,
  ShaderMaterial, SrcAlphaFactor, type Vector3, ZeroFactor,
} from 'three';

const SAMPLES = 28;
const SUB = 4;

const VS = /* glsl */ `
attribute vec2 aUv;
attribute float aAge;
varying vec2 vUv;
varying float vAge;
void main() { vUv = aUv; vAge = aAge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FS = /* glsl */ `
uniform float uMode;
uniform vec3 uInk;
uniform vec3 uLight;
uniform vec3 uNeon;
uniform float uAlpha;
uniform float uSeed;
varying vec2 vUv;
varying float vAge;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // vUv.x across the ribbon: 0 inner edge → 1 tip edge; vUv.y along the stroke in metres from its start; vAge 0 new → 1 gone
  float x = vUv.x, s = vUv.y;
  float age = clamp(vAge, 0.0, 1.0);
  // hair streaks: fine noise across, stretched along the stroke (the bristles), two octaves
  float hair = vn(vec2(x * 46.0 + uSeed, s * 3.0)) * 0.65 + vn(vec2(x * 130.0 + uSeed * 1.7, s * 7.0)) * 0.35;
  // the brush runs dry toward the tail and toward the inner edge
  float dry = mix(0.18, 0.78, age) + (1.0 - x) * 0.28;
  float body = smoothstep(dry - 0.08, dry + 0.08, hair);
  // a ragged inner edge that eats in with age, a loaded tip edge
  float inner = smoothstep(age * 0.55, age * 0.55 + 0.25 + 0.2 * vn(vec2(s * 9.0, uSeed)), x);
  float tipEdge = smoothstep(0.86, 0.97, x) * (1.0 - smoothstep(0.985, 1.0, x));
  float fade = (1.0 - age) * (1.0 - age);
  float a = body * inner * fade * uAlpha;
  if (uMode < 0.5) {
    // ink: pigment where the hair holds ink, the neon thread on the tip edge
    vec3 c = mix(uInk, uInk * 1.8, hair * 0.5);
    float neon = tipEdge * (1.0 - age) * 1.2;
    gl_FragColor = vec4(mix(c, uNeon * 3.0, clamp(neon, 0.0, 1.0)), clamp(max(min(a * 1.6, 0.92), neon), 0.0, 1.0));
  } else {
    // light: pale streaks, additive, a cyan core on the tip edge
    vec3 c = uLight * a * 0.9 + uNeon * tipEdge * fade * 2.2;
    gl_FragColor = vec4(c, 1.0);
  }
}
`;

export type BrushTrailLook = 'ink' | 'light';

export class BrushTrail {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly ribbon = new SlashTrail({ samples: SAMPLES, subdivisions: SUB, movementSq: 1e-6, channel: 'age' });
  private time = 0;
  private life = 0.32;

  constructor() {
    this.mat = new ShaderMaterial({
      uniforms: {
        uMode: { value: 0 }, uInk: { value: new Color(0x252c4a) }, uLight: { value: new Color(0xe9f2ff) }, uNeon: { value: new Color(0x9fe9ff) },
        uAlpha: { value: 0.9 }, uSeed: { value: 0 },
      },
      vertexShader: VS,
      fragmentShader: FS,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.setLook('light');
    this.mesh = new Mesh(this.ribbon.geometry, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }

  setLook(look: BrushTrailLook): void {
    const m = this.mat;
    m.blending = CustomBlending;
    m.blendEquation = AddEquation;
    m.blendEquationAlpha = AddEquation;
    m.blendSrcAlpha = ZeroFactor;
    m.blendDstAlpha = OneFactor;
    if (look === 'ink') {
      m.blendSrc = SrcAlphaFactor;
      m.blendDst = OneMinusSrcAlphaFactor;
    } else {
      m.blendSrc = OneFactor;
      m.blendDst = OneFactor;
    }
    const mode = m.uniforms['uMode'];
    if (mode !== undefined) mode.value = look === 'ink' ? 0 : 1;
    m.needsUpdate = true;
  }

  /** start a new stroke (a new swing): clears the ring, sets the sample life (s) */
  begin(life: number, seed: number): void {
    this.ribbon.reset();
    this.life = life;
    const s = this.mat.uniforms['uSeed'];
    if (s !== undefined) s.value = seed;
  }

  /** a blade sample (vm scene space): the inner point and the tip */
  sample(inner: Vector3, tip: Vector3): void { this.ribbon.sample(inner, tip, this.time); }

  /** advance the clock and rebuild the ribbon */
  update(dt: number): void {
    this.time += dt;
    this.mesh.visible = this.ribbon.rebuild(this.time, this.life);
  }
}
