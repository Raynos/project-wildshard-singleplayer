import type { GraphIr } from '@wildshard/format/materialGraph';
import type { PostGraphLookRow } from '@wildshard/format/postGraphLook';
import * as THREE from 'three';
import { PANO_FOG_SRGB } from './panoramaData';

const LUM = [0.2126, 0.7152, 0.0722] as const;

/**
 * The painted grade (look/grade.ts) as a post graph: a gentle filmic shoulder x(1 + x/9)/(1 + x) on 1.12 × exposure, the
 * saturation, the cool-shadow / golden-light split, a mild S-curve and the look's saturation, over the scene colour.
 */
function gradeGraph(shadow: readonly number[], light: readonly number[], uniforms: { readonly uV2Exposure: number; readonly uV2Sat: number; readonly uV2LookSat: number }, bloom: number): GraphIr {
  const third = (id: string): readonly [string, string, string] => [id, id, id];
  return { version: 1, kind: 'post', params: {
    tSrc: { type: 'texture', role: 'lent', value: 'tSrc' }, tBloom: { type: 'texture', role: 'lent', value: 'tBloom' }, uBloomIntensity: { type: 'float', value: bloom }, uV2Exposure: { type: 'float', value: uniforms.uV2Exposure },
    uV2Sat: { type: 'float', value: uniforms.uV2Sat }, uV2LookSat: { type: 'float', value: uniforms.uV2LookSat } },
  nodes: {
    uv: { op: 'screenUV' }, src: { op: 'texture', in: ['uv'], param: 'tSrc' }, scene: { op: 'swizzle', in: ['src'], mask: 'xyz' }, a: { op: 'swizzle', in: ['src'], mask: 'w' },
    // the desktop bloom's light (black where it does not draw), screen-blended as the bloom effect blends: a + b − min(ab, 1)
    glow: { op: 'texture', in: ['uv'], param: 'tBloom' }, glowRgb: { op: 'swizzle', in: ['glow'], mask: 'xyz' }, gain: { op: 'param', param: 'uBloomIntensity' },
    b: { op: 'mul', in: ['glowRgb', 'gain'] }, ab: { op: 'mul', in: ['scene', 'b'] }, abMin: { op: 'min', in: ['ab', [1, 1, 1]] }, sum: { op: 'add', in: ['scene', 'b'] },
    rgb: { op: 'sub', in: ['sum', 'abMin'] },
    exposure: { op: 'param', param: 'uV2Exposure' }, sat: { op: 'param', param: 'uV2Sat' }, lookSat: { op: 'param', param: 'uV2LookSat' },
    x0: { op: 'max', in: ['rgb', [0, 0, 0]] }, x1: { op: 'mul', in: ['x0', 1.12] }, x: { op: 'mul', in: ['x1', 'exposure'] },
    x9: { op: 'div', in: ['x', 9] }, num: { op: 'mul', in: ['x', 'x9p'] }, x9p: { op: 'add', in: ['x9', [1, 1, 1]] }, den: { op: 'add', in: ['x', [1, 1, 1]] },
    c0: { op: 'div', in: ['num', 'den'] }, l0: { op: 'dot', in: ['c0', [...LUM]] }, l0v: { op: 'combine', in: [...third('l0')] },
    c1: { op: 'mix', in: ['l0v', 'c0', 'sat'] }, split: { op: 'smoothstep', in: [0.05, 0.6, 'l0'] }, tone: { op: 'mix', in: [[...shadow], [...light], 'split'] },
    c2: { op: 'mul', in: ['c1', 'tone'] }, c3: { op: 'clamp', in: ['c2', 0, 1] },
    sq: { op: 'mul', in: ['c3', 'c3'] }, c32: { op: 'mul', in: ['c3', 2] }, knee: { op: 'sub', in: [[3, 3, 3], 'c32'] },
    s1: { op: 'mul', in: ['sq', 'knee'] }, s2: { op: 'mul', in: ['s1', 0.35] }, s3: { op: 'mul', in: ['c3', 0.65] }, c4: { op: 'add', in: ['s2', 's3'] },
    l1: { op: 'dot', in: ['c4', [...LUM]] }, l1v: { op: 'combine', in: [...third('l1')] }, out: { op: 'mix', in: ['l1v', 'c4', 'lookSat'] },
  },
  stages: { post: { colour: 'out', alpha: 'a' } } };
}

/** Author the painted grade as a post-graph look (G600 L1, game/looks/postGraphLook): the scene pass, the desktop bloom blur
 *  and the grade (which blends that bloom) over the live grade uniforms the world lends ('nalati-grade'); the client only
 *  binds them. The grid cell carries the same chain, its bloom included. */
export function postChainRows(): { readonly postGraph: PostGraphLookRow; readonly paintedFog: { readonly haze: readonly number[]; readonly order: number }; readonly world: { readonly grade: { readonly lend: string; readonly uniforms: { readonly uV2Exposure: number; readonly uV2Sat: number; readonly uV2LookSat: number }; readonly saturation: string }; readonly tint: Readonly<Record<string, string>> }; readonly shadow: readonly number[]; readonly light: readonly number[]; readonly lum: readonly number[]; readonly uniforms: { readonly uV2Exposure: number; readonly uV2Sat: number; readonly uV2LookSat: number }; readonly fogLut: readonly number[] } {
  const shadow = [0.92, 0.96, 1.05], light = [1.07, 0.99, 0.84], lum = [...LUM];
  const uniforms = { uV2Exposure: 1, uV2Sat: 1.05, uV2LookSat: 1 };
  const bloom = 0.28, postGraph = {
    passes: { grade: { name: 'GradeV2Graph', programs: { grade: { graph: gradeGraph(shadow, light, uniforms, bloom), links: ['tBloom', 'uBloomIntensity', 'uV2Exposure', 'uV2Sat', 'uV2LookSat'] } },
      targets: { frame: { name: 'GradeV2.frame', of: 'input', scale: 1, filter: 'nearest' } }, draws: [{ program: 'grade', to: 'frame', textures: { tSrc: 'input' } }],
      settings: {}, outputs: { frame: 'frame' } } },
    sides: [{ bloom: 'bloom', tiers: ['desktop'], threshold: 0.95, smoothing: 0.3, radius: 0.7 }], composite: { pass: 'grade', output: 'frame' },
    inputs: { tBloom: { side: 'bloom', output: 'bloom' } }, uniforms: { uBloomIntensity: bloom }, live: 'nalati-grade', scene: {},
  } satisfies PostGraphLookRow;
  // the painted world's grade (game/looks/paintedWorld `world.grade`, lent for the grade graph) and the panorama's names for
  // the engine's panorama tint
  const world = { grade: { lend: 'nalati-grade', uniforms, saturation: 'uV2LookSat' },
    tint: { uV2KeyTint: 'key', uV2Moon: 'moon', uV2Light: 'light', uV2Veil: 'veil', uV2VeilCol: 'veilColour', uV2Flash: 'flash' } };
  // the panorama fog's near / zenith haze and its fog slot (game/looks/paintedWorld `fog`)
  const paintedFog = { haze: [0.2, 0.21, 0.26], order: 300 };
  return { postGraph, world, paintedFog, shadow, light, lum, uniforms, fogLut: ungradedFog(shadow, light, lum, uniforms.uV2Exposure, uniforms.uV2Sat) };
}

/**
 * The painted fog LUT (panoramaData.ts) taken back through the grade's exact inverse (`v2Ungrade`), so the fog writes the
 * scene-linear value the grade maps back onto the painting. Stored as sRGB again: the page's heading texture decodes sRGB.
 */
function ungradedFog(shadow: readonly number[], light: readonly number[], lum: readonly number[], e: number, s: number): number[] {
  const luma = (c: readonly number[]): number => (c[0] ?? 0) * (lum[0] ?? 0) + (c[1] ?? 0) * (lum[1] ?? 0) + (c[2] ?? 0) * (lum[2] ?? 0);
  const smoothstep = (a: number, b: number, x: number): number => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const split = (l: number, k: number): number => (shadow[k] ?? 1) + ((light[k] ?? 1) - (shadow[k] ?? 1)) * smoothstep(0.05, 0.6, l);
  const colour = new THREE.Color(), out: number[] = [];
  for (let i = 0; i < PANO_FOG_SRGB.length; i += 3) {
    colour.setRGB(PANO_FOG_SRGB[i] ?? 0, PANO_FOG_SRGB[i + 1] ?? 0, PANO_FOG_SRGB[i + 2] ?? 0, THREE.SRGBColorSpace);
    const c = [colour.r, colour.g, colour.b].map(y => {
      const yk = Math.min(1, Math.max(0, y)); let v = yk;
      for (let n = 0; n < 3; n++) v = Math.min(1, Math.max(0, v - (v * v * (3 - 2 * v) * 0.35 + v * 0.65 - yk) / (2.1 * v * (1 - v) + 0.65)));
      return v;
    });
    let l = luma(c), b = c.map((ck, k) => ck / split(l, k));
    l = luma(b); b = c.map((ck, k) => ck / split(l, k)); l = luma(b);
    const x = b.map(bk => { const d = Math.max(0, l + (bk - l) / s); return (4.5 * (-(1 - d) + Math.sqrt((1 - d) * (1 - d) + (4 * d) / 9))) / (1.12 * e); });
    colour.setRGB(x[0] ?? 0, x[1] ?? 0, x[2] ?? 0);
    const srgb = colour.getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
    out.push(...[srgb.r, srgb.g, srgb.b].map(value => Math.round(value * 1e6) / 1e6));
  }
  return out;
}
