import { Effect, BlendFunction } from 'postprocessing';
import { Uniform, Vector3 } from 'three';

/**
 * Final colour grade (runs after tone mapping, in display space): cool shadows / warm highlights
 * split-toning, gentle lift-gamma-gain, and a touch of desaturation in the deepest shadows —
 * the "golden hour film" look of the art/ mockups.
 */
export class GradeEffect extends Effect {
  constructor() {
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
        ['uShadowTint', new Uniform(new Vector3(0.9, 0.95, 1.08))],
        ['uHighTint', new Uniform(new Vector3(1.06, 1.0, 0.92))],
        ['uLift', new Uniform(new Vector3(-0.01, -0.008, 0.0))],
        ['uGain', new Uniform(new Vector3(1.03, 1.02, 1.0))],
        ['uGamma', new Uniform(1.0)],
      ]),
    });
  }
}
