/**
 * The sea (src/world/Ocean.ts, DRIFTWOOD-REMASTER W1–W4) in TSL — a faithful port: the look-agent's Ocean.ts owns the
 * look, and every term here mirrors its GLSL (the port reads Ocean's own uniforms and sea-floor texture through
 * `harvest`, and the waves come from waves.ts' WAVES table, the same one the boat and the swimmer ride).
 *
 *   registerOcean();   // GpuPath → port for the 'ocean-v2' program key
 *
 * - vertex: the four Gerstner waves damped over the sand + the per-vertex lateral wobble; the crest height for the caps
 * - colour (→ the toon lighting as albedo): Beer–Lambert opacity from the view path through the water column, the
 *   lagoon → cobalt ramp, the facet grade, the moonlit tint, the lace / ring / cap foam
 * - after lighting: the sky reflection (fresnel) + the facet-by-facet glint, premultiplied over the seabed; Snell's
 *   window from below. The fog is applied here (before premultiplying), as the GLSL chunk order does.
 */
import type * as THREE from 'three';
import {
  abs, attribute, cameraPosition, clamp, cos, cross, dFdx, dFdy, dot, exp, float, floor, frontFacing, length, max, mix,
  modelWorldMatrix, normalize, output, positionLocal, pow, reflect, select, sin, smoothstep, step, texture, varying, vec2, vec3, vec4, fract,
} from 'three/tsl';
import type { Node } from 'three/webgpu';
import { WAVES } from '../world/waves';
import { gpuUniforms } from './bridge';
import { fogAt, sceneFogColor } from './fog';
import { harvest, hFloat, hVec3, need, registerPort, toonCopy } from './ports';
import { ToonStandardNodeMaterial, toonNoise } from './toon';

const TAU = Math.PI * 2;

/** waves.ts WAVES_GLSL `gerstner(p, t, damp)` → displacement */
function gerstner(p: Node<'vec2'>, t: Node<'float'>, damp: Node<'float'>): Node<'vec3'> {
  let d: Node<'vec3'> = vec3(0);
  for (const [wx, wz, a, len, speed, q] of WAVES) {
    const k = TAU / len, qa = (q / (k * a * WAVES.length)) * a;
    const ph = p.x.mul(wx).add(p.y.mul(wz)).sub(t.mul(speed)).mul(k).toVar();
    const c = cos(ph);
    d = d.add(vec3(c.mul(wx * qa), sin(ph).mul(a), c.mul(wz * qa)));
  }
  return d.mul(damp);
}

/** stylize-style hash21 (Ocean's own copy) */
function hash21(pIn: Node<'vec2'>): Node<'float'> {
  const p0 = fract(pIn.mul(vec2(123.34, 456.21)));
  const p = p0.add(dot(p0, p0.add(45.32)));
  return fract(p.x.mul(p.y));
}

export function registerOcean(): void {
  registerPort('ocean-v2', (src) => {
    const h = harvest(src);
    const uTime = hFloat(h, 'uTime'), uDeepDepth = hFloat(h, 'uDeepDepth'), uLevel = hFloat(h, 'uLevel'), uChunkHalf = hFloat(h, 'uChunkHalf');
    const uShallow = hVec3(h, 'uShallow'), uDeep = hVec3(h, 'uDeep');
    const tSea = need(h, 'tSea').value as THREE.Texture;
    const T = gpuUniforms().toon, F = gpuUniforms().fog;
    const fogColor = sceneFogColor();

    const m = toonCopy(src, ToonStandardNodeMaterial);
    m.fog = false;               // applied by hand below, before the premultiply (Ocean's GLSL chunk order)
    m.premultipliedAlpha = false; // (the shader output is premultiplied by hand; the pipeline's blend state is the WebGL material's)

    // ── vertex ──
    const depth = attribute<'float'>('depth', 'float'), seed = attribute<'float'>('seed', 'float');
    const damp = smoothstep(0, 1.5, depth).mul(0.65).add(0.35).toVar();
    const g = gerstner(positionLocal.xz, uTime, damp).toVar();
    const wob = vec3(sin(uTime.mul(0.7).add(seed.mul(6.2831))).mul(0.3), 0, cos(uTime.mul(0.6).add(seed.mul(6.2831)).add(1.7)).mul(0.3));
    const transformed = positionLocal.add(g).add(wob);
    m.positionNode = transformed;
    const vCrest = varying(g.y.div(max(damp, 0.35)), 'vCrest');
    const W = varying(modelWorldMatrix.mul(vec4(transformed, 1)).xyz, 'vOceanW').toVar();

    // ── colour ──
    const suv = W.xz.add(uChunkHalf).div(uChunkHalf.mul(2));
    const outD = length(max(abs(W.xz).sub(uChunkHalf), vec2(0))).toVar();
    const inC = step(outD, 0);
    const cuv = clamp(suv, 0.001, 0.999).toVar();
    const sea = texture(tSea, cuv).rg.toVar();
    const floorY = mix(sea.r, uLevel.sub(30), smoothstep(0, 260, outD));
    const still = uLevel.sub(floorY).toVar();
    const col = max(W.y.sub(floorY), 0);
    const tx = uChunkHalf.mul(2).div(512);
    const hx = texture(tSea, cuv.add(vec2(1 / 512, 0))).r, hz = texture(tSea, cuv.add(vec2(0, 1 / 512))).r;
    const slope = length(vec2(hx.sub(sea.r), hz.sub(sea.r))).div(tx);
    const shoreD = still.div(max(slope, 0.012)).toVar();
    const V = normalize(cameraPosition.sub(W)).toVar();
    const fn0 = normalize(cross(dFdx(W), dFdy(W)));
    const fn = fn0.mul(select(fn0.y.lessThan(0), float(-1), float(1))).toVar();
    const path = col.div(max(abs(V.y), 0.22));
    const opac = float(1).sub(exp(path.mul(-0.85)));
    const tt = smoothstep(0, 1, pow(clamp(still.div(uDeepDepth), 0, 1), 0.9));
    const water0 = mix(uShallow, uDeep, tt).mul(clamp(fn.x.mul(4.2).add(fn.z.mul(2.6)).add(1), 0.58, 1.48));
    const water = mix(water0, water0.mul(vec3(0.12, 0.3, 0.75)), T.uToonNight);
    // foam
    const n = toonNoise(W.xz.mul(0.55).add(uTime.mul(0.15))).toVar();
    const d0 = shoreD.add(sin(uTime.mul(1.1).add(dot(W.xz, vec2(0.07, 0.05)))).mul(0.3)).sub(vCrest.mul(0.8)).toVar();
    const l1 = smoothstep(-0.05, 0.05, d0).mul(float(1).sub(smoothstep(0.22, 0.36, d0))).mul(step(0.34, toonNoise(W.xz.mul(1.7).add(vec2(uTime.mul(0.3), 0)))));
    const ph = fract(uTime.mul(0.16).add(n.mul(0.15))).toVar();
    const p2 = mix(float(3), float(0.9), ph);
    const l2 = float(1).sub(smoothstep(0.1, 0.28, abs(d0.sub(p2)))).mul(step(0.42, toonNoise(W.xz.mul(0.9).add(7)))).mul(float(1).sub(ph.mul(0.6)));
    const p3 = mix(float(5), float(2.2), fract(ph.add(0.5)));
    const l3 = float(1).sub(smoothstep(0.08, 0.22, abs(d0.sub(p3)))).mul(step(0.55, toonNoise(W.xz.mul(0.7).add(13)))).mul(0.8);
    const lace = max(l1, max(l2, l3)).mul(inC).mul(float(1).sub(smoothstep(6, 9, shoreD))).mul(step(0, still));
    const ring = smoothstep(0.45, 0.65, sea.g.add(n.sub(0.5).mul(0.3))).mul(step(0.25, n)).mul(sin(uTime.mul(2.4).add(sea.g.mul(9))).mul(0.25).add(0.75)).mul(inC);
    const cap = smoothstep(0.2, 0.26, vCrest).mul(step(0.62, toonNoise(W.xz.mul(0.2).add(3.1)))).mul(smoothstep(2.5, 8, still)).mul(0.85);
    const foam = clamp(max(max(lace, ring), cap), 0, 1).toVar();
    m.colorNode = vec4(mix(water, vec3(1), foam), 1);

    // ── reflection + glint, added after lighting ──
    const R = reflect(V.negate(), fn).toVar();
    const e = max(R.y, 0);
    const skyR = mix(fogColor, T.uFogZenith, pow(smoothstep(0, 0.75, e), 0.62).mul(0.6).add(0.4));
    const fres = pow(float(1).sub(max(dot(fn, V), 0)), 5).mul(0.98).add(0.02).toVar();
    const sd = max(dot(R, F.fogSunDir), 0);
    const sparkle = step(0.92, hash21(floor(W.xz.mul(1.3)).add(floor(uTime.mul(3)))));
    const glint = smoothstep(0.994, 0.998, sd).mul(sparkle).add(pow(sd, 60).mul(0.08));
    const addTop = skyR.mul(fres).mul(0.14).add(F.fogSunColor.mul(glint)).mul(float(1).sub(foam)).add(F.fogSunColor.mul(foam).mul(0.5));
    const aTop = max(max(opac, foam), fres.mul(0.3));
    // from below: Snell's window (inside ~49° of straight up the sky shows through), a mirror of the deep outside it
    const win = smoothstep(0.6, 0.7, abs(dot(fn, V)));
    const skyU = mix(fogColor, T.uFogZenith, 0.5).mul(1.4);
    const addBelow = mix(uDeep.mul(1.6).add(uShallow.mul(0.15)), skyU, win);
    const waterA = clamp(select(frontFacing, aTop, float(1)), 0, 1).toVar();
    const waterAdd = select(frontFacing, addTop, addBelow);
    const lit = select(frontFacing, output.rgb, vec3(0)); // below: diffuseColor is black in the GLSL
    const straight = lit.mul(waterA).add(waterAdd).div(max(waterA, 1e-3));
    const { col: fc, factor } = fogAt(W);
    const fogged = mix(straight, fc, factor);
    m.outputNode = vec4(fogged.mul(waterA), waterA);
    return m;
  });
}

