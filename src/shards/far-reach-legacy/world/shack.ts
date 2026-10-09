import { MeshStandardMaterial } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';

/**
 * The weathered-timber surfaces of Sky Reach's small buildings (E392, round 18): the four procedural shaders that draw a
 * baked shack part from the metre coordinates on its faces (`shk`: u along, v up, a seed). The geometry is built at bake
 * time (`generators/shackKit.ts`, SHARD-PLATFORM SF72); the client only draws it.
 * - `plank`: vertical boards (~24 cm), each its own tone and length, dark seams and butt joints, grain, rain streaks;
 * - `shingle`: staggered rows of wooden shingles with ragged butts, a shadow under each row, moss toward the eave;
 * - `stone`: coursed rubble blocks with mortar, bevelled edges, mixed warm and cool stones, moss at the foot;
 * - `beam`: trim and posts, the grain running along the piece's longest side, the odd check.
 */
export type ShackKind = 'plank' | 'shingle' | 'stone' | 'beam';

const MODE: Record<ShackKind, number> = { plank: 0, shingle: 1, stone: 2, beam: 3 };

const SHARED = /* glsl */ `
varying vec3 vShk;
varying float vShkY;
float shkH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float shkN(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(shkH(i), shkH(i + vec2(1.0, 0.0)), f.x), mix(shkH(i + vec2(0.0, 1.0)), shkH(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

const PATTERN = /* glsl */ `
{
  vec2 q = vShk.xy; float sd = vShk.z;
#if SHK_MODE == 0
  // planks: vertical boards, each its own tone and length; seams and butt joints; grain; rain streaks; dark at the sill
  float bx = q.x / 0.24; float bi = floor(bx); float fx = fract(bx);
  float len = 2.4 + 1.8 * shkH(vec2(bi, sd + 1.0));
  float by = q.y / len + shkH(vec2(bi, sd + 3.1)); float si = floor(by); float fy = fract(by);
  float t = shkH(vec2(bi * 1.7 + si * 5.3, sd));
  float ax = fwidth(bx), ay = fwidth(by);
  float seam = smoothstep(0.0, 0.05 + ax, fx) * smoothstep(1.0, 0.95 - ax, fx);
  float butt = smoothstep(0.0, 0.01 + ay, fy) * smoothstep(1.0, 0.99 - ay, fy);
  float grain = (0.84 + 0.16 * shkN(vec2(fx * 5.0 + bi * 7.0, q.y * 1.4))) * (0.93 + 0.07 * shkN(vec2(fx * 28.0 + bi, q.y * 0.6)));
  float rnd = 0.88 + 0.12 * smoothstep(0.0, 0.3, min(fx, 1.0 - fx));
  float streak = 0.74 + 0.26 * shkN(vec2(q.x * 1.7, q.y * 0.12 + sd));
  float silver = smoothstep(0.35, 0.9, shkN(vec2(q.x * 0.6 + sd, q.y * 0.4)));
  float grime = 1.0 - 0.3 * (1.0 - smoothstep(0.9, 1.7, vShkY));
  vec3 board = diffuseColor.rgb * mix(0.72, 1.12, t) * grain * rnd * streak * grime;
  board = mix(board, vec3(dot(board, vec3(0.33))) * vec3(1.02, 1.0, 0.97) * 1.08, silver * 0.45);
  // seams fade out where a board spans only a few pixels (else the far wall reads as zebra stripes)
  float near = clamp(1.6 - ax * 4.0, 0.0, 1.0);
  diffuseColor.rgb = board * mix(1.0, mix(0.38, 1.0, seam * butt), near);
#elif SHK_MODE == 1
  // shingles: staggered rows from the eave up, ragged butts, a shadow under each row's butt, moss toward the eave
  float r0 = q.y / 0.30;
  float sx = q.x / 0.33 + shkH(vec2(floor(r0), sd)) * 0.9 + floor(r0) * 0.5; float si = floor(sx); float fx = fract(sx);
  float r = r0 + (shkH(vec2(si, floor(r0) + sd)) - 0.5) * 0.16; float ri = floor(r); float fr = fract(r);
  float t = shkH(vec2(si * 1.3, ri * 2.1 + sd));
  float ax = fwidth(sx);
  float gap = smoothstep(0.0, 0.05 + ax, fx) * smoothstep(1.0, 0.95 - ax, fx);
  float near = clamp(1.6 - ax * 4.0, 0.0, 1.0);
  float shade = mix(1.0, mix(1.0, 0.6, smoothstep(0.6, 1.0, fr)) * (1.0 + 0.12 * (1.0 - smoothstep(0.0, 0.12, fr))), mix(0.5, 1.0, near));
  float grain = 0.88 + 0.12 * shkN(vec2(fx * 6.0 + si, q.y * 8.0));
  vec3 sh = diffuseColor.rgb * mix(0.72, 1.14, t) * (0.9 + 0.2 * shkN(vec2(q.x * 0.5, q.y * 0.35) + sd)) * grain * shade * mix(1.0, mix(0.5, 1.0, gap), near);
  float moss = smoothstep(0.6, 0.9, shkN(q * 0.9 + sd)) * (1.0 - smoothstep(0.2, 1.6, q.y)) * 0.6 + 0.3 * step(0.95, t);
  diffuseColor.rgb = mix(sh, vec3(0.16, 0.19, 0.08) * shade, clamp(moss, 0.0, 0.6));
#elif SHK_MODE == 2
  // stone: coursed blocks of mixed tone, mortar, bevelled edges, speckle, grime and moss at the foot
  float ch = 0.36; float r = q.y / ch; float ri = floor(r); float fr = fract(r);
  float L = 0.5 + 0.38 * shkH(vec2(ri, sd));
  float s = q.x / L + shkH(vec2(ri * 3.1, sd + 2.0)); float si = floor(s); float fs = fract(s);
  float t = shkH(vec2(si, ri + sd * 2.0));
  float d = min(min(fr, 1.0 - fr) * ch, min(fs, 1.0 - fs) * L);
  float mortar = smoothstep(0.01, 0.035 + fwidth(q.x) * 1.5, d);
  float bevel = mix(0.72, 1.0, smoothstep(0.015, 0.11, d));
  vec3 hue = mix(vec3(1.04, 0.97, 0.88), vec3(0.88, 0.92, 1.0), shkH(vec2(si + 7.0, ri)));
  float speck = 0.86 + 0.14 * shkN(q * 11.0) * shkN(q * 3.0 + 5.0);
  vec3 st = mix(vec3(0.22, 0.2, 0.19), diffuseColor.rgb * hue * mix(0.62, 1.18, t) * bevel * speck, mortar);
  float foot = 1.0 - smoothstep(0.0, 0.7, vShkY);
  float moss = foot * smoothstep(0.35, 0.7, shkN(q * 2.3 + sd));
  diffuseColor.rgb = mix(st * (1.0 - 0.3 * foot), vec3(0.17, 0.22, 0.07), moss * 0.8);
#else
  // beams: grain along the piece, a tone per piece, the odd check (crack)
  float g = shkN(vec2(q.x * 0.9 + sd * 3.0, q.y * 22.0 + sd * 13.0));
  float g2 = shkN(vec2(q.x * 4.0, q.y * 55.0));
  float check = smoothstep(0.88, 0.96, shkN(vec2(q.x * 0.45 + sd, q.y * 36.0)));
  diffuseColor.rgb *= (0.78 + 0.28 * g) * (0.92 + 0.08 * g2) * (1.0 - 0.5 * check) * mix(0.85, 1.12, shkH(vec2(sd, 1.0)));
#endif
}
`;

/** The material for a kind: vertex-coloured, the kind's pattern patched in. */
export function shackMaterial(kind: ShackKind): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: kind === 'stone' ? 0.95 : 0.88, metalness: 0 });
  material.defines = { SHK_MODE: MODE[kind] };
  patchShader(material, `far.shack.${kind}`, PATCH_ORDER.material, (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec3 shk;\nvarying vec3 vShk;\nvarying float vShkY;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvShk = shk; vShkY = position.y;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SHARED}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${PATTERN}`);
  }, { key: (prior) => `${prior}|far.shack.${kind}` });
  return material;
}
