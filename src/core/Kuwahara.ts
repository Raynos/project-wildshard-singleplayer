import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';
import { Uniform } from 'three';

/**
 * The painterly filter (Nalati, look pass lever 8 experiment; look-director): a single-pass anisotropic Kuwahara
 * (Kyprianidis et al., polynomial sector weights). Per pixel: the local structure tensor (Sobel on the graded
 * image) gives an orientation and anisotropy; an ellipse aligned with the edges is split into 8 sectors, and the
 * output is the mean of the sectors weighted toward the flattest (lowest-variance) one. Flat areas turn into dabs,
 * edges into strokes that follow the form — polygon edges and shimmering blades read as brushwork.
 *
 * It runs on the tone-mapped, graded image (its own EffectPass after the colour chain, before SMAA), desktop only.
 *   radius    the filter half-size in px (the loop is fixed at ±RMAX; radius scales the ellipse inside it)
 *   strength  0 = off (the pass copies), 1 = full; mixes with the source so fine detail can survive
 *   sharpness how hard the flattest sector wins (q; 8 = classic)
 */
const RMAX = 4;

export interface KuwaharaOptions { radius: number; strength: number; sharpness: number }
export const KUWAHARA_DEFAULTS: KuwaharaOptions = { radius: 2.5, strength: 0.85, sharpness: 8 };

export class KuwaharaEffect extends Effect {
  private readonly u: { radius: Uniform<number>; strength: Uniform<number>; sharpness: Uniform<number> };

  constructor(o: KuwaharaOptions = KUWAHARA_DEFAULTS) {
    const u = { radius: new Uniform(o.radius), strength: new Uniform(o.strength), sharpness: new Uniform(o.sharpness) };
    super('KuwaharaEffect', /* glsl */`
      uniform float uRadius; uniform float uStrength; uniform float uSharp;
      vec3 kTap(vec2 uv) { return texture2D(inputBuffer, uv).rgb; }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        if (uStrength <= 0.0) { outputColor = inputColor; return; }
        vec2 px = texelSize;
        // structure tensor (Sobel, 3×3, on RGB)
        vec3 a = kTap(uv + px * vec2(-1.0, -1.0)), b = kTap(uv + px * vec2(0.0, -1.0)), c = kTap(uv + px * vec2(1.0, -1.0));
        vec3 d = kTap(uv + px * vec2(-1.0, 0.0)), f = kTap(uv + px * vec2(1.0, 0.0));
        vec3 g = kTap(uv + px * vec2(-1.0, 1.0)), h = kTap(uv + px * vec2(0.0, 1.0)), i = kTap(uv + px * vec2(1.0, 1.0));
        vec3 gx = (c + 2.0 * f + i) - (a + 2.0 * d + g);
        vec3 gy = (g + 2.0 * h + i) - (a + 2.0 * b + c);
        float E = dot(gx, gx), F = dot(gx, gy), G = dot(gy, gy);
        float disc = sqrt(max(0.0, (E - G) * (E - G) + 4.0 * F * F));
        float l1 = 0.5 * (E + G + disc), l2 = 0.5 * (E + G - disc);
        vec2 t = vec2(l1 - E, -F);
        t = dot(t, t) > 1e-10 ? normalize(t) : vec2(0.0, 1.0);
        float phi = -atan(t.y, t.x);
        float A = (l1 + l2) > 1e-6 ? (l1 - l2) / (l1 + l2) : 0.0;
        const float ALPHA = 1.0;
        float ea = uRadius * clamp((ALPHA + A) / ALPHA, 0.1, 2.0);
        float eb = uRadius * clamp(ALPHA / (ALPHA + A), 0.1, 2.0);
        float cp = cos(phi), sp = sin(phi);
        mat2 SR = mat2(0.5 / ea, 0.0, 0.0, 0.5 / eb) * mat2(cp, -sp, sp, cp);
        // 8 sectors, polynomial weights
        vec4 m[8]; vec3 s[8];
        for (int k = 0; k < 8; k++) { m[k] = vec4(0.0); s[k] = vec3(0.0); }
        float zeta = 2.0 / uRadius;
        const float ZC = 0.58;
        float eta = (zeta + cos(ZC)) / (sin(ZC) * sin(ZC));
        float w[8];
        for (int j = -${RMAX}; j <= ${RMAX}; j++) {
          for (int k2 = -${RMAX}; k2 <= ${RMAX}; k2++) {
            vec2 v = SR * vec2(float(k2), float(j));
            if (dot(v, v) > 0.25) continue;
            vec3 col = kTap(uv + vec2(float(k2), float(j)) * px);
            vec3 cc = col * col;
            float sum = 0.0, z, vxx, vyy;
            vxx = zeta - eta * v.x * v.x; vyy = zeta - eta * v.y * v.y;
            z = max(0.0, v.y + vxx); w[0] = z * z; sum += w[0];
            z = max(0.0, -v.x + vyy); w[2] = z * z; sum += w[2];
            z = max(0.0, -v.y + vxx); w[4] = z * z; sum += w[4];
            z = max(0.0, v.x + vyy); w[6] = z * z; sum += w[6];
            vec2 r = 0.70710678 * vec2(v.x - v.y, v.x + v.y);
            vxx = zeta - eta * r.x * r.x; vyy = zeta - eta * r.y * r.y;
            z = max(0.0, r.y + vxx); w[1] = z * z; sum += w[1];
            z = max(0.0, -r.x + vyy); w[3] = z * z; sum += w[3];
            z = max(0.0, -r.y + vxx); w[5] = z * z; sum += w[5];
            z = max(0.0, r.x + vyy); w[7] = z * z; sum += w[7];
            float gw = exp(-3.125 * dot(v, v)) / max(sum, 1e-6);
            for (int k = 0; k < 8; k++) { float wk = w[k] * gw; m[k] += vec4(col * wk, wk); s[k] += cc * wk; }
          }
        }
        vec4 o = vec4(0.0);
        for (int k = 0; k < 8; k++) {
          if (m[k].w <= 1e-6) continue;
          vec3 mu = m[k].rgb / m[k].w;
          vec3 var = abs(s[k] / m[k].w - mu * mu);
          float sigma2 = var.r + var.g + var.b;
          float wk = 1.0 / (1.0 + pow(255.0 * sigma2, 0.5 * uSharp));
          o += vec4(mu * wk, wk);
        }
        vec3 painted = o.w > 0.0 ? o.rgb / o.w : inputColor.rgb;
        outputColor = vec4(mix(inputColor.rgb, painted, uStrength), inputColor.a);
      }`, {
      blendFunction: BlendFunction.SRC,
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, Uniform>([['uRadius', u.radius], ['uStrength', u.strength], ['uSharp', u.sharpness]]),
    });
    this.u = u;
  }

  set(o: Partial<KuwaharaOptions>): void {
    if (o.radius !== undefined) this.u.radius.value = Math.min(o.radius, RMAX);
    if (o.strength !== undefined) this.u.strength.value = o.strength;
    if (o.sharpness !== undefined) this.u.sharpness.value = o.sharpness;
  }
}
