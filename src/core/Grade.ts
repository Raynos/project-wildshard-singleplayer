import { Effect, BlendFunction } from 'postprocessing';
import { Uniform, Vector3 } from 'three';
import type { ChunkGrade } from '../chunks/ChunkDef';

export type GradeOptions = Pick<ChunkGrade, 'shadowTint' | 'highTint' | 'lift' | 'gain' | 'gamma'>;
const DEFAULTS: GradeOptions = { shadowTint: [0.9, 0.95, 1.08], highTint: [1.06, 1.0, 0.92], lift: [-0.01, -0.008, 0.0], gain: [1.03, 1.02, 1.0], gamma: 1.0 };

/**
 * Final colour grade (runs after tone mapping, in display space): cool shadows / warm highlights
 * split-toning, gentle lift-gamma-gain, and a touch of desaturation in the deepest shadows —
 * the "golden hour film" look of the art/ mockups.
 */
export class GradeEffect extends Effect {
  /** the uniforms, held directly (the Effect's own Map is typed loosely) */
  private readonly u: { shadowTint: Uniform<Vector3>; highTint: Uniform<Vector3>; lift: Uniform<Vector3>; gain: Uniform<Vector3>; gamma: Uniform<number> };

  constructor(opts: Partial<GradeOptions> = {}) {
    const o = { ...DEFAULTS, ...opts };
    const u = {
      shadowTint: new Uniform(new Vector3(...o.shadowTint)), highTint: new Uniform(new Vector3(...o.highTint)),
      lift: new Uniform(new Vector3(...o.lift)), gain: new Uniform(new Vector3(...o.gain)), gamma: new Uniform(o.gamma),
    };
    super('GradeEffect', /* glsl */`
      uniform vec3 uShadowTint; uniform vec3 uHighTint; uniform vec3 uLift; uniform vec3 uGain; uniform float uGamma;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c *= mix(uShadowTint, uHighTint, smoothstep(0.05, 0.75, l));
        c = max(c * uGain + uLift, 0.0);
        c = pow(c, vec3(1.0 / uGamma));
        // deep shadows lose a little saturation, like film
        float ds = smoothstep(0.18, 0.0, l);
        c = mix(c, vec3(dot(c, vec3(0.3333))), ds * 0.25);
        outputColor = vec4(c, inputColor.a);
      }`, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ['uShadowTint', u.shadowTint],
        ['uHighTint', u.highTint],
        ['uLift', u.lift],
        ['uGain', u.gain],
        ['uGamma', u.gamma],
      ]),
    });
    this.u = u;
  }

  /** Retune at runtime (the day/night clock, a storm's slate grade): any subset of the options; unchanged fields keep their value. */
  set(opts: Partial<GradeOptions>): void {
    const { u } = this;
    if (opts.shadowTint) u.shadowTint.value.fromArray(opts.shadowTint);
    if (opts.highTint) u.highTint.value.fromArray(opts.highTint);
    if (opts.lift) u.lift.value.fromArray(opts.lift);
    if (opts.gain) u.gain.value.fromArray(opts.gain);
    if (opts.gamma !== undefined) u.gamma.value = opts.gamma;
  }
}
