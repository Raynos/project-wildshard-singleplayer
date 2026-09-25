import { Effect, BlendFunction } from 'postprocessing';
import { Uniform, Vector3 } from 'three';
import type { ChunkGrade } from '../chunks/ChunkDef';

export type GradeOptions = Pick<ChunkGrade, 'shadowTint' | 'highTint' | 'lift' | 'gain' | 'gamma'>;
const DEFAULTS: GradeOptions = { shadowTint: [0.9, 0.95, 1.08], highTint: [1.06, 1.0, 0.92], lift: [-0.01, -0.008, 0.0], gain: [1.03, 1.02, 1.0], gamma: 1.0 };

/** the look layer (see the constructor): its uniforms and the two steps, on the display-referred colour */
const LOOK_PARS = /* glsl */`
      uniform float uCurve; uniform float uVibrance;`;
const LOOK_MAIN = /* glsl */`
        // S-curve in a perceptual (gamma 2.2) domain: deeper shadows, fuller mids, the highlights held
        vec3 pc = pow(max(c, 0.0), vec3(1.0 / 2.2));
        pc = mix(pc, pc * pc * (3.0 - 2.0 * pc), uCurve);
        c = pow(max(pc, 0.0), vec3(2.2));
        // vibrance: the muted colours lifted more than the saturated ones
        float vmx = max(c.r, max(c.g, c.b)), vmn = min(c.r, min(c.g, c.b));
        float vsat = (vmx - vmn) / max(vmx, 1e-4);
        float vlum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = max(mix(vec3(vlum), c, 1.0 + uVibrance * (1.0 - vsat)), 0.0);`;

/**
 * Final colour grade (runs after tone mapping, in display space): cool shadows / warm highlights
 * split-toning, gentle lift-gamma-gain, and a touch of desaturation in the deepest shadows —
 * the "golden hour film" look of the art/ mockups.
 */
export class GradeEffect extends Effect {
  /** the uniforms, held directly (the Effect's own Map is typed loosely) */
  private readonly u: { shadowTint: Uniform<Vector3>; highTint: Uniform<Vector3>; lift: Uniform<Vector3>; gain: Uniform<Vector3>; gamma: Uniform<number> };

  /**
   * `look` (a shard's look-loop layer, PINE-HOLLOW PH-L1 / L4; `?grade=v1` passes none): after the split-tone, an
   * S-curve around mid grey and a vibrance lift, both live uniforms (`uCurve`, `uVibrance`). Without it the program is
   * the one it always was (Driftwood's source, byte for byte).
   */
  constructor(opts: Partial<GradeOptions> = {}, look: { curve: number; vibrance: number } | null = null) {
    const o = { ...DEFAULTS, ...opts };
    const u = {
      shadowTint: new Uniform(new Vector3(...o.shadowTint)), highTint: new Uniform(new Vector3(...o.highTint)),
      lift: new Uniform(new Vector3(...o.lift)), gain: new Uniform(new Vector3(...o.gain)), gamma: new Uniform(o.gamma),
    };
    super('GradeEffect', /* glsl */`
      uniform vec3 uShadowTint; uniform vec3 uHighTint; uniform vec3 uLift; uniform vec3 uGain; uniform float uGamma;${look ? LOOK_PARS : ''}
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c *= mix(uShadowTint, uHighTint, smoothstep(0.05, 0.75, l));
        c = max(c * uGain + uLift, 0.0);
        c = pow(c, vec3(1.0 / uGamma));
        // deep shadows lose a little saturation, like film
        float ds = smoothstep(0.18, 0.0, l);
        c = mix(c, vec3(dot(c, vec3(0.3333))), ds * 0.25);${look ? LOOK_MAIN : ''}
        outputColor = vec4(c, inputColor.a);
      }`, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([
        ['uShadowTint', u.shadowTint],
        ['uHighTint', u.highTint],
        ['uLift', u.lift],
        ['uGain', u.gain],
        ['uGamma', u.gamma],
        ...(look ? [['uCurve', new Uniform(look.curve)], ['uVibrance', new Uniform(look.vibrance)]] as [string, Uniform][] : []),
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

/**
 * The painterly shard's colour (Nalati, look pass lever 8; look-director) — runs after the split-tone grade, in display
 * space. What separates the mockups' palette from a plain graded render:
 *   · greens lean warm: the grass hue is pulled toward yellow-olive / gold (`greenShift`), the neon goes (`greenSat`)
 *   · vibrance, not saturation: dull colours gain the most, already-rich ones (the red felt bands, the sky) hold
 *   · value is compressed toward the mid-tones a touch (`paint`): a painted image has few pure blacks and no clipped whites
 * All uniforms — the day/night rig may lerp them (`set`).
 */
export interface PaintGradeOptions { greenShift: number; greenSat: number; vibrance: number; paint: number }
/** the Nalati defaults */
export const PAINT_GRADE: PaintGradeOptions = { greenShift: 0.035, greenSat: 0.86, vibrance: 0.22, paint: 0.06 };
export class PaintGradeEffect extends Effect {
  private readonly u: { greenShift: Uniform<number>; greenSat: Uniform<number>; vibrance: Uniform<number>; paint: Uniform<number> };
  constructor(o: PaintGradeOptions = PAINT_GRADE) {
    const u = { greenShift: new Uniform(o.greenShift), greenSat: new Uniform(o.greenSat), vibrance: new Uniform(o.vibrance), paint: new Uniform(o.paint) };
    super('PaintGradeEffect', /* glsl */`
      uniform float uGreenShift; uniform float uGreenSat; uniform float uVibrance; uniform float uPaint;
      vec3 pRgb2hsv(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
      }
      vec3 pHsv2rgb(vec3 c) {
        vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
        return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
      }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = clamp(inputColor.rgb, 0.0, 1.0);
        vec3 h = pRgb2hsv(c);
        // greens (hue ~0.2–0.45) lean toward yellow; the pull fades out before the teals and the yellows
        float g = smoothstep(0.17, 0.25, h.x) * (1.0 - smoothstep(0.4, 0.48, h.x));
        h.x -= uGreenShift * g;
        h.y *= mix(1.0, uGreenSat, g);                    // and lose the neon
        // vibrance: low-saturation colours gain the most
        h.y = clamp(h.y + uVibrance * h.y * (1.0 - h.y) * 1.6, 0.0, 1.0);
        c = pHsv2rgb(h);
        // painted value range: lift the darkest a hair, round off the brightest
        c = mix(c, c * (1.0 - uPaint) + uPaint * 0.5 * (c + vec3(0.12)), 1.0);
        outputColor = vec4(c, inputColor.a);
      }`, {
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, Uniform>([['uGreenShift', u.greenShift], ['uGreenSat', u.greenSat], ['uVibrance', u.vibrance], ['uPaint', u.paint]]),
    });
    this.u = u;
  }

  set(o: Partial<PaintGradeOptions>): void {
    if (o.greenShift !== undefined) this.u.greenShift.value = o.greenShift;
    if (o.greenSat !== undefined) this.u.greenSat.value = o.greenSat;
    if (o.vibrance !== undefined) this.u.vibrance.value = o.vibrance;
    if (o.paint !== undefined) this.u.paint.value = o.paint;
  }
}
