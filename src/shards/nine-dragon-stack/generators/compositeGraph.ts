import { validateGraph, type GraphIr, type GraphNode, type GraphRef } from '@wildshard/format/materialGraph';
import type { ScaledPostRow } from '@wildshard/format/scaledPost';
import { LUT_SIZE } from '@wildshard/engine/render/lut';
import fog from '../data/lookGraphs.json' with { type: 'json' };
import { Screen } from './screenGraph';

/**
 * The Jiehua composite (compositeProgram.ts JIEHUA_FS: the ruled ink silhouette over the silk fog, the 晕染 bleed, window
 * glow, drizzle, the shoulder, the blue-hour toe, vignette, the learned LUT and grain) as the scaled post host's graph
 * programs, behind Debug ▸ Look ▸ "Nine composite" (look/render.ts). The silhouette's fog is the admitted `nine-silk-fog`
 * program inlined at the reconstructed point (the material looks' fog), not the GLSL splice.
 */

/** Inline the silk fog stage at a point and eye in the root's frame: its colour for `input` (input · T + inscatter) and T. */
function silkFog(g: Screen, world: GraphRef, eye: GraphRef, input: GraphRef): { readonly colour: GraphRef; readonly transmission: GraphRef } {
  const checked = validateGraph(fog['nine-silk-fog'], { trustedBudget: true });
  if (!checked.ok) throw new Error([...new Set(checked.errors)].slice(0, 12).join('\n'));
  const graph = checked.graph, output = graph.stages.fog?.colour;
  if (typeof output !== 'string') throw new Error('Missing silk fog output');
  const fogInput = Object.entries(graph.nodes).find(([, row]) => row.op === 'fogInput')?.[0];
  const product = graph.nodes[output]?.in?.map(ref => typeof ref === 'string' ? graph.nodes[ref] : undefined).find(row => row?.op === 'mul' && row.in?.includes(fogInput ?? ''));
  const transmission = product?.in?.find(ref => ref !== fogInput);
  if (typeof transmission !== 'string') throw new Error('Missing silk transmission');
  const rename = (ref: GraphRef): GraphRef => typeof ref === 'string' && graph.nodes[ref] !== undefined ? `sf_${ref}` : ref;
  const rewrite = (row: GraphNode): GraphNode => ({ ...row, ...(row.in === undefined ? {} : { in: row.in.map(rename) }),
    ...(row.body === undefined ? {} : { body: { nodes: Object.fromEntries(Object.entries(row.body.nodes).map(([id, child]) => [id, rewrite(child)])), out: rename(row.body.out) } }) });
  // the fog reads positionWorld − rootAt and cameraPosition − rootAt: in the root's frame, rootAt is the origin
  for (const [id, row] of Object.entries(graph.nodes)) {
    g.nodes[`sf_${id}`] = row.op === 'fogScale' ? { op: 'const', value: 1 } : row.op === 'positionWorld' ? { op: 'add', in: [world, [0, 0, 0]] }
      : row.op === 'cameraPosition' ? { op: 'add', in: [eye, [0, 0, 0]] } : row.op === 'fogInput' ? { op: 'add', in: [input, [0, 0, 0]] }
      : row.op === 'param' && row.param === 'rootAt' ? { op: 'add', in: [[0, 0, 0], [0, 0, 0]] } : rewrite(row);
  }
  for (const [name, param] of Object.entries(graph.params ?? {})) if (name !== 'rootAt') g.params[name] = param;
  Object.assign(g.arrays, graph.arrays);
  return { colour: rename(output), transmission: rename(transmission) };
}

/** The arithmetic every program shares, on one graph. */
function screen() {
  const g = new Screen(), sw = g.sw.bind(g), add = g.add.bind(g), sub = g.sub.bind(g), mul = g.mul.bind(g), div = g.div.bind(g), max = g.max.bind(g);
  const uv = g.uv, texel = g.v2('uTexel');
  return { g, sw, add, sub, mul, div, max, min: g.min.bind(g), mix: g.mix.bind(g), smooth: g.smooth.bind(g), clamp: g.clamp.bind(g), choose: g.choose.bind(g),
    gt: g.gt.bind(g), lt: g.lt.bind(g), uv, texel, time: g.scalar('uTime'), frag: div(uv, texel),
    lum: (c: GraphRef): string => g.dot(c, [0.2126, 0.7152, 0.0722]),
    peak: (c: GraphRef): string => max(sw(c, 'x'), max(sw(c, 'y'), sw(c, 'z'))) };
}

/** The ruled ink silhouette over the silk fog: rgb its fogged line colour, a its coverage (0 where no line). */
function silhouette(): GraphIr {
  const { g, sw, add, sub, mul, div, max, min, mix, smooth, clamp, choose, gt, lt, uv, texel } = screen();
  // the depth's folds toward the eye at radius r px (its inverse depth's most negative second difference of four)
  const fold = (wc: GraphRef, r: GraphRef): string => {
    const taps = [[1, 0], [0, 1], [0.7071, 0.7071], [0.7071, -0.7071]].map(([x, y]) => {
      const o = mul(mul([x ?? 0, y ?? 0], r), texel);
      return div(sub(add(g.inv(add(uv, o)), g.inv(sub(uv, o))), mul(wc, 2)), wc);
    });
    return g.neg(min(min(taps[0] ?? 0, taps[1] ?? 0), min(taps[2] ?? 0, taps[3] ?? 0)));
  };
  const wc = g.inv(uv), z = div(1, max(wc, 1e-6)), silPx = g.v2('uSilPx', [2.1, 1.2]), silFade = g.v2('uSilFade', [60, 170]), gain = g.scalar('uSilGain', 0.35);
  const near = lt(z, 1.6), r = mul(mul(mul(mix(sw(silPx, 'x'), sw(silPx, 'y'), smooth(4, 60, z)), g.scalar('uDpr', 1)), choose(near, 1.6, 1)), g.scalar('uLineScale', 1));
  let e: GraphRef = mul(0.5, add(clamp(div(fold(wc, sub(r, 0.5)), gain)), clamp(div(fold(wc, add(r, 0.5)), gain))));
  e = mul(max(e, clamp(div(fold(wc, max(mul(r, 0.5), 1)), gain))), sub(1, smooth(sw(silFade, 'x'), sw(silFade, 'y'), z)));
  const vr = g.matrix('invProj', g.vec(sub(mul(uv, 2), 1), 1, 1)), pv0 = div(sw(vr, 'xyz'), sw(vr, 'w'));
  const pv = mul(pv0, div(z, max(g.neg(sw(pv0, 'z')), 1e-4))), wp = sw(g.matrix('world', g.vec(pv, 1)), 'xyz');
  const ink = mix(g.v3('uInk'), g.v3('uInk1'), smooth(4, g.scalar('uInkMid', 30), z));
  // the nearest lines (under 1.6 m) skip the fog: its scale 0 there
  const fogged = silkFog(g, wp, g.v3('uCam'), ink), lineC = choose(near, ink, fogged.colour), transmission = choose(near, 1, fogged.transmission);
  const lineOn = g.and(g.and(gt(wc, 1e-5), gt(g.scalar('uLines', 1), 0.5)), gt(e, 0.002));
  const edge = choose(lineOn, mul(e, g.pow(max(transmission, 1e-4), sub(g.scalar('uLineFog', 1), 1))), 0);
  return g.finishScreen(choose(lineOn, lineC, [0, 0, 0]), edge);
}

/** The rest of the Jiehua frame over the scene colour and the silhouette's line, before its grade. */
function composite(): GraphIr {
  const { g, sw, add, sub, mul, div, max, min, mix, smooth, clamp, choose, gt, lt, uv, texel, time, frag, lum, peak } = screen();
  const rain = g.v4('uRain');
  const rainLayer = (fc: GraphRef, scale: number, speed: GraphRef, density: number, seed: number): string => {
    const angle = sw(rain, 'y'), cos = g.op('cos', [angle]), sin = g.op('sin', [angle]);
    const q = div(fc, sw(rain, 'w')), p0 = g.vec(add(mul(cos, sw(q, 'x')), mul(sin, sw(q, 'y'))), sub(mul(cos, sw(q, 'y')), mul(sin, sw(q, 'x'))));
    const p = add(p0, g.vec(0, mul(time, speed))), cell = mul([7, 70], scale), id = g.floor(div(p, cell)), f = sub(p, mul(id, cell));
    const x0 = mul(add(0.15, mul(0.7, g.hash(add(id, seed + 3.1)))), sw(cell, 'x')), len = mul(sw(cell, 'y'), add(0.25, mul(0.45, g.hash(add(id, seed + 7.7)))));
    const y0 = mul(g.hash(add(id, seed + 1.3)), sub(sw(cell, 'y'), len)), t = div(sub(sw(f, 'y'), y0), len);
    const along = mul(mul(g.op('step', [0, t]), g.op('step', [t, 1])), g.op('sin', [mul(clamp(t), 3.14159)]));
    const dx = mul(g.abs(sub(sw(f, 'x'), x0)), sw(rain, 'w'));
    return choose(gt(g.hash(add(id, seed)), density), 0, mul(along, sub(1, smooth(0.35, 1.1, dx))));
  };
  const input = g.tex('tSrc', uv);
  let c: GraphRef = sw(input, 'xyz');
  // the wet floor's streaked reflection (0 off the floor), then the light unsharp mask the phone's 2× needs
  c = add(c, mul(sw(g.tex('tRefl', uv), 'xyz'), g.scalar('uReflK')));
  const nb = g.sum(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(o => sw(g.tex('tSrc', add(uv, mul(texel, o))), 'xyz')));
  c = max(add(c, mul(sub(c, mul(nb, 0.25)), g.scalar('uSharp'))), [0, 0, 0]);
  // the ruled ink silhouette (silhouette(): its line colour and coverage)
  const line = g.tex('tLine', uv), edge = sw(line, 'w'), wc = g.inv(uv), z = div(1, max(wc, 1e-6));
  c = mix(c, sw(line, 'xyz'), edge);
  // the 晕染 bleed: the pyramid's tight and wide light soaked through the silk, its stain glazing the paper
  const bleed = g.v4('uBleed'), bleed2 = g.v4('uBleed2'), hasBleed = gt(g.scalar('uHasBleed'), 0.5);
  const warp = mul(sub(g.vec(g.noise(mul(uv, [9, 18])), g.noise(add(mul(uv, [9, 18]), 5.3))), 0.5), sw(bleed2, 'y'));
  const tight4 = choose(hasBleed, g.tex('tTight', add(uv, mul(warp, 0.5))), [0, 0, 0, 0]), wide4 = choose(hasBleed, g.tex('tWide', add(uv, warp)), [0, 0, 0, 0]);
  const tight = sw(tight4, 'xyz'), wide = sw(wide4, 'xyz');
  const weave = sw(g.tex('uSilk', div(frag, div(mul(300, sw(rain, 'w')), 3))), 'x'), soak = add(1, mul(sub(weave, 0.5), sw(bleed2, 'x')));
  const wl = peak(wide), hue = div(wide, max(wl, 1e-4));
  let amt: GraphRef = mul(mul(sub(1, g.op('exp', [g.neg(mul(wl, sw(bleed, 'w')))])), sw(bleed, 'z')), soak);
  amt = add(amt, mul(mul(smooth(0.05, 0.25, amt), sub(1, smooth(0.25, 0.6, amt))), sw(bleed2, 'z')));
  c = mul(c, mix([1, 1, 1], mix([1, 1, 1], hue, clamp(amt)), smooth(0.04, 0.35, lum(c))));
  c = add(c, mul(add(mul(tight, sw(bleed, 'x')), mul(wide, sw(bleed, 'y'))), soak));
  // the windows' glow (look/light.ts glowUniforms), kept where the pixel is far enough
  const glow2 = g.v4('uGlow2'), zPixel = choose(gt(wc, 1e-5), z, 1e4), keep = smooth(mul(sw(glow2, 'z'), 0.6), sw(glow2, 'z'), zPixel);
  const glow = choose(lt(sw(glow2, 'w'), 0.5), [0, 0, 0], mul(mul(g.v3('uGlowCol'), add(mul(sw(tight4, 'w'), sw(glow2, 'x')), mul(mul(sw(wide4, 'w'), 0.25), sw(glow2, 'y')))), keep));
  c = add(c, mul(glow, soak));
  // the drizzle, lit by the haze march's in-scatter where a drop crosses a light's halo
  const rn = add(rainLayer(frag, 1, sw(rain, 'z'), 0.28, 0), mul(0.6, rainLayer(add(frag, 37), 0.55, mul(sw(rain, 'z'), 0.7), 0.3, 11)));
  const rc = add(add(mul([0.86, 0.9, 0.97], 0.55), mul(add(tight, wide), 1.6)), mul(sw(g.tex('tHaze', uv), 'xyz'), g.scalar('uRainHaze')));
  c = choose(gt(sw(rain, 'x'), 0), mix(c, rc, mul(clamp(mul(rn, sw(rain, 'x'))), 0.55)), c);
  // exposure, the highlight shoulder, the blue-hour toe, vibrance, the warm / ink-blue split, the weave, the vignette
  c = mul(c, sw(bleed2, 'w'));
  const m = peak(c), shoulder = choose(lt(m, 0.72), m, add(0.72, mul(0.28, sub(1, g.op('exp', [g.neg(div(sub(m, 0.72), 0.28))])))));
  c = mul(c, div(shoulder, max(m, 1e-5)));
  const tone = g.v4('uTone'), look = g.v3('uGrade');
  let l: GraphRef = lum(c);
  const tk = mix(sw(tone, 'x'), 1, smooth(0, sw(tone, 'y'), l));
  c = mul(c, tk); l = mul(l, tk);
  const cmx = peak(c), sat0 = div(sub(cmx, min(sw(c, 'x'), min(sw(c, 'y'), sw(c, 'z')))), max(cmx, 1e-5));
  c = max(mix(g.vec(l, l, l), c, add(1, mul(sw(tone, 'z'), sub(1, sat0)))), [0, 0, 0]);
  c = mul(c, mix([1, 1, 1], g.vec(add(1, sw(tone, 'w')), 1, sub(1, sw(tone, 'w'))), smooth(0.06, 0.4, l)));
  c = mix(c, mul(c, [0.9, 0.96, 1.1]), mul(sub(1, smooth(0.02, 0.25, l)), sw(look, 'z')));
  c = mul(c, add(1, mul(sub(weave, 0.5), 0.035)));
  const q = sub(uv, 0.5);
  c = mul(c, sub(1, mul(g.dot(q, q), sw(look, 'x'))));
  c = choose(gt(g.scalar('uLines', 1), 1.5), mix([1, 1, 1], [0, 0, 0], edge), c);
  return g.finishScreen(c, sw(input, 'w'));
}

/** The frame's last colour step: the learned LUT in sRGB, the grain, back to linear (its own draw: the sampler budget). */
function grade(): GraphIr {
  const { g, sw, add, sub, mul, div, mix, clamp, choose, gt, uv, time, frag } = screen();
  const look = g.v3('uGrade'), input = g.tex('tFrame', uv), lutAmt = g.scalar('uLutAmt');
  const toSRGB = (x: GraphRef): string => { const k = clamp(x); return mix(mul(k, 12.92), sub(mul(1.055, g.pow(k, 1 / 2.4)), 0.055), g.op('step', [0.0031308, k])); };
  const fromSRGB = (x: GraphRef): string => { const k = clamp(x); return mix(div(k, 12.92), g.pow(div(add(k, 0.055), 1.055), 2.4), g.op('step', [0.04045, k])); };
  const srgb = toSRGB(sw(input, 'xyz'));
  const lut = sw(g.tex('uLut', add(mul(clamp(srgb), (LUT_SIZE - 1) / LUT_SIZE), 0.5 / LUT_SIZE), true), 'xyz');
  let o: GraphRef = choose(gt(lutAmt, 0), mix(srgb, lut, lutAmt), srgb);
  o = add(o, div(mul(sub(g.hash(add(frag, mul(g.fract(mul(time, 7.13)), 91))), 0.5), sw(look, 'y')), 255));
  return g.finishScreen(fromSRGB(o), sw(input, 'w'));
}

/** The composite on the scaled post host: the silhouette, the frame over the scene colour, depth and that line, then its
 *  grade, each a full-size draw (one graph would pass the 64 KB admission cap and the 8-sampler budget), every live uniform
 *  linked; two full-size targets. */
export function compositeRow(): ScaledPostRow {
  // every param but the host's own: the draws' textures and texel, the depth and the camera's near / far
  const own = new Set(['tSrc', 'tDepth', 'tLine', 'tFrame', 'uTexel', 'uNF']);
  const line = silhouette(), frame = composite(), graded = grade(), linked = (graph: GraphIr): string[] => Object.keys(graph.params ?? {}).filter(name => !own.has(name));
  return { name: 'NdJiehuaGraph', programs: {
    silhouette: { graph: line, links: linked(line), depth: 'tDepth', camera: { uNF: 'nearFar', invProj: 'projectionInverse', world: 'world' } },
    jiehua: { graph: frame, links: linked(frame), depth: 'tDepth', camera: { uNF: 'nearFar' } },
    grade: { graph: graded, links: linked(graded) } },
  targets: { line: { name: 'NdJiehua.line', of: 'input', scale: 1, filter: 'nearest' }, frame: { name: 'NdJiehua.frame', of: 'input', scale: 1, filter: 'nearest' } },
  draws: [{ program: 'silhouette', to: 'line', texel: { uniform: 'uTexel', of: 'input' } },
    { program: 'jiehua', to: 'frame', textures: { tSrc: 'input', tLine: 'line' }, texel: { uniform: 'uTexel', of: 'input' } },
    // the line target is free once the frame read it: the graded frame reuses it
    { program: 'grade', to: 'line', textures: { tFrame: 'frame' }, texel: { uniform: 'uTexel', of: 'input' } }],
  settings: {}, outputs: { composite: 'line' } };
}
