import type { GraphIr, GraphRef } from '@wildshard/format/materialGraph';
import { graphKit } from './graphKit';
import { KNOLLS } from './layout';
import { SKY_SUN } from './skyLook';
import { SWARD_ATLAS, SWARD_ATLAS_FILE } from './swardAtlas';

/**
 * The near meadow (loop 4; the targets' foreground is knee-deep golden grass, not a green plane): single tuft cards and
 * flowers over every island top, baked (generators/meadowBlades.ts → baked/meadow-blades.bin: where each blade stands and
 * what its place decided) and drawn by the `meadow` material graph below (world/meadow.ts: an 8 m chunk of blades per
 * mesh, its near copies close by, nothing beyond `range`). Unlit-by-the-rig, painted in the graph (E407 row 4): three
 * grasses, dark green roots to warm lit tips, some strands catching the low sun, the sun through the blades when you look
 * toward it. No colliders; the island dressing's clumps carry the far view.
 */
export const MEADOW = {
  /** the blades' seed (every bake grows the same field) */
  seed: 6417,
  /** a chunk's side (metres): the old camera tile's lattice */
  tile: 8,
  /** a tile's seeded blades (desktop), and the phone's share of them (the first ones: each chunk's prefix) */
  blades: 3200, phone: 1600,
  /** where the blades have shrunk to nothing (metres from the camera) */
  range: 24,
  /**
   * E392 foreground: each near blade is drawn `layers` more times, shifted within its baked room and turned, so the near
   * field is (1 + layers) × as dense with no more blades in the buffer; the copies shrink away by `near` metres
   */
  layers: 4, near: 7.5,
  /** a chunk's level switches (metres from the chunk's centre to the camera): its copies to `lods[0]`, its blades to `lods[1]` */
  lods: [14, 31] as const,
  /** an island's grass height scale (1 when absent): the crown's arena a little shorter, so the dais reads (E399: mockup D's meadow is lush to the dais) */
  // (round 6: the seats: 'cut to 0.42 against mockup D's lush meadow'; from the rise's top the dais clears ~0.9 m of grass)
  grass: { crown: 0.85 } as Readonly<Record<string, number>>,
  /** the share of blades an island keeps (1 when absent): the crown a little thinner (round 2's carpet of chips was the old wide blades) */
  keep: { crown: 1 } as Readonly<Record<string, number>>,
} as const;

/** A baked blade's 8 bytes (aBladeA: x, z across the chunk; y over the chunk's base; height. aBladeB: random, tone,
 *  grass + 4 × flower kind, room): the metres per step of the scaled ones, and the near copies' most room. */
export const MEADOW_BLADES = { y: 0.01, h: 0.005, safe: 0.01, room: 1 } as const;

/**
 * The sward (E407 row 4, a green, varied meadow): three grasses (data/swardAtlas.ts), each its own height (metres, at the
 * tuft's full size) and body green, on one root-to-tip ramp (sRGB): dark roots, green bodies, warm tips. `light`: the
 * shade floor deep in the sward, the gain up the blade, the sun through the blades when you look toward it and the
 * sun-side edge of a broad blade. `share`: where the noise field turns lawn into broad blades, and broad blades into the wild grass.
 */
export const SWARD = {
  height: { lawn: [0.2, 0.38], broad: [0.34, 0.6], wild: [0.5, 0.9] },
  share: [0.3, 0.62],
  root: 0x141c18, low: 0x2a4234, lawn: 0x6a845c, broad: 0x5e7c56, wild: 0x7e805c, tip: 0xdcc887, sun: 0xf0d8b8,
  light: { floor: 0.03, gain: 0.36, through: 1.8, edge: 0.8, top: 0.45 },
  // how far the bodies of the warm-toned patches, and every blade's tip, turn toward `tip` (round 14 prep: at 0.45 / 0.5
  // with a peach tip the near sward read pale straw where the mockups' is green with gold-lit tips)
  straw: { body: 0.25, tip: 0.3 },
  // the colour light takes through a blade (a leaf passes yellow-green): the backlit sward glows green-gold, not cream
  leaf: 0xc8e070,
} as const;

/**
 * One blade = 7 vertices, 5 triangles. A tuft card uses them as its bottom, middle and top pairs (the tip folds onto the
 * top right corner); a flower as a thin stem (the root pair to the head's bottom pair), then a kite head whose round
 * middle is the flower (its corners are drawn as green sepals). Each vertex: [across, up] of the card, [x, y] of the kite.
 */
const CARD: readonly (readonly [number, number, number, number])[] = [
  [-1, 0, -0.1, -3], [1, 0, 0.1, -3], [-1, 0.5, -0.16, -0.97], [1, 0.5, 0.16, -0.97], [-1, 1, -1.05, -0.05], [1, 1, 1.05, -0.05], [1, 1, 0, 1.05],
];
const TRIANGLES = [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6];

/** The blade outline `copies` times (aCard per vertex, aLayer the copy) with its triangles: the far mesh draws one, the near one 1 + `layers`. */
export function meadowCard(copies: number): { card: Float32Array; layer: Float32Array; index: Uint16Array } {
  const card = new Float32Array(copies * CARD.length * 4), layer = new Float32Array(copies * CARD.length), index = new Uint16Array(copies * TRIANGLES.length);
  for (let c = 0; c < copies; c++) {
    CARD.forEach((v, i) => { card.set(v, (c * CARD.length + i) * 4); layer[c * CARD.length + i] = c; });
    index.set(TRIANGLES.map((k) => k + c * CARD.length), c * TRIANGLES.length);
  }
  return { card, layer, index };
}

/**
 * The rises as caps (data/layout.ts KNOLLS) and the hole and rock discs that touch them: on a rise the bake's room is cut
 * short by the slope (a copy shifted flat would float or sink), so the graph lets the copies there spread as far as on
 * the flat and lifts each onto the rise where it lands. Rises sit well inside their islands' rims, so only the rock discs bound them.
 */
const RISES = KNOLLS.map((k) => ({ x: k.x, z: k.z, base: k.base, R: (k.base * k.base + k.h * k.h) / (2 * k.h), h: k.h }));
// (x, z, radius: data/dressing.json's rock discs within 1.5 m of a rise; placements.json has no hole there)
const RISE_DISCS: readonly (readonly [number, number, number])[] = [
  [7.13, 5.02, 0.49], [4.69, 4.76, 0.44],
  [-5.8, -172.6, 0.68], [-5.8, -175.9, 0.83], [-3.6, -181.4, 0.75], [-4.8, -183.2, 0.45], [3.9, -182, 0.6], [-2.4, -186, 0.87], [-2.44, -175.89, 0.44],
];

const linear = (hex: number): [number, number, number] => [16, 8, 0].map((s) => { const c = ((hex >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }) as [number, number, number];

/**
 * The meadow as one SF59 material graph (`meadow` in look.materials; world/meadow.ts draws the chunks in it). Only what
 * moves with the camera and the clock is here: the copies' shift, the cards facing you and leaning back when seen from
 * above, the wind, the distance fades, the flower heads, the atlas (`atlas`, data role: its channels are a strand's
 * shade, how far along it, where across it, coverage) and the paint. A blade whose fade has taken it collapses to its root.
 */
export function meadowGraph(): GraphIr {
  const k = graphKit(), { op, add, sub, mul, div, swz, smooth, clamp, mix } = k;
  const fr = (x: GraphRef): string => op('fract', [x]), one = (x: GraphRef): string => op('oneMinus', [x]);
  const sel = (c: string, a: GraphRef, b: GraphRef): string => op('select', [c, a, b]);
  const lt = (a: GraphRef, b: GraphRef): string => op('lt', [a, b]), gt = (a: GraphRef, b: GraphRef): string => op('gt', [a, b]);
  const A = k.attr('aBladeA', 'vec4'), B = k.attr('aBladeB', 'vec4'), card = k.attr('aCard', 'vec4'), layer = k.attr('aLayer', 'float');
  const { tile, range, near } = MEADOW;
  // the blade: its random (turned per copy), tone, grass, flower kind and room
  const r0 = swz(B, 'x'), tone = swz(B, 'y'), code = op('floor', [add(mul(swz(B, 'z'), 255), 0.5)]), room = mul(swz(B, 'w'), 255 * MEADOW_BLADES.safe);
  const species = op('mod', [code, 4]), kind = op('floor', [div(code, 4)]);
  const copy = op('step', [0.5, layer]), r = fr(add(r0, mul(layer, 0.2718)));
  const origin = op('objectOrigin'), cam = op('cameraPosition'), camXZ = swz(cam, 'xz');
  const bL = mul(swz(A, 'xy'), tile), bW = add(bL, swz(origin, 'xz'));
  // the rises' height at a world xz (RISES: sphere caps)
  const riseAt = (p: GraphRef): GraphRef => {
    let y: GraphRef = 0;
    for (const rise of RISES) { const d = op('length', [sub(p, [rise.x, rise.z])]); y = add(y, sel(lt(d, rise.base), sub(op('pow', [op('max', [sub(rise.R * rise.R, mul(d, d)), 0]), 0.5]), rise.R - rise.h), 0)); }
    return y;
  };
  // on a rise the bake's room is the slope's (a few cm): there a copy may spread as on the flat, clear of the discs, and is lifted onto the rise
  const onRise = RISES.map((rise) => lt(op('length', [sub(bW, [rise.x, rise.z])]), rise.base + 0.5)).reduce((a, b) => op('or', [a, b]));
  let discRoom: GraphRef = MEADOW_BLADES.room;
  for (const [x, z, rr] of RISE_DISCS) discRoom = op('min', [discRoom, sub(op('length', [sub(bW, [x, z])]), rr + 0.05)]);
  const roomCopy = sel(onRise, op('max', [room, clamp(discRoom, 0, MEADOW_BLADES.room)]), room);
  // a copy stands within its blade's room (never over a rim or into a hole)
  const sa = mul(fr(add(mul(r0, 7.31), mul(layer, 0.381966))), 6.2832), sm = mul(mul(roomCopy, op('pow', [fr(add(mul(r0, 23.1), mul(layer, 0.618))), 0.5])), copy);
  const pL = add(bL, mul(op('combine', [op('cos', [sa]), op('sin', [sa])]), sm));
  const pW = add(pL, swz(origin, 'xz')), yL = add(mul(swz(A, 'z'), 255 * MEADOW_BLADES.y), mul(sub(riseAt(pW), riseAt(bW)), copy)), yW = add(yL, swz(origin, 'y'));
  const dist = op('length', [sub(pW, camXZ)]);
  // shrinking away: the blades by `range`, the copies by `near` (raggedly); each copy a little shorter or taller than its blade
  const fade = mix(one(smooth(range * 0.55, range, dist)), one(smooth(near - 2.5, near, add(dist, mul(fr(mul(r0, 7.77)), 1.5)))), copy);
  // where a rim, a hole or a rock cuts the room short, a copy shifted toward it shortens as the blades there do (the old
  // field's clearing round a disc), so a rock never stands in a full-height ring of copies
  const edge = sel(lt(roomCopy, MEADOW_BLADES.room - 0.01), mix(1, 0.35, smooth(0.35, 1, div(sm, op('max', [roomCopy, 0.01])))), 1);
  const h = mul(mul(mul(swz(A, 'w'), 255 * MEADOW_BLADES.h), fade), mix(1, mul(edge, mix(0.8, 1.05, fr(add(mul(r0, 17.3), mul(layer, 0.37))))), copy));
  const isFlower = op('and', [gt(kind, 0.5), op('gte', [dist, 0.6])]);
  const ang = mul(r, 40), dir = op('combine', [op('cos', [ang]), op('sin', [ang])]);
  const toCam = op('normalize', [add(sub(camXZ, pW), 0.001)]), wind: [number, number] = [0.6, 0.8], t = op('time');
  const sway = add(add(0.16, mul(0.1, op('sin', [add(mul(t, 1.3), mul(op('dot', [pW, wind]), 0.35))]))), mul(0.05, op('sin', [add(mul(t, 4.1), mul(r, 30))])));
  const cx = swz(card, 'x'), cy = swz(card, 'y'), q = swz(card, 'zw'), qx = swz(q, 'x'), qy = swz(q, 'y');
  const px = swz(pL, 'x'), pz = swz(pL, 'y'), root = op('combine', [px, yL, pz]);
  // a tuft card: a quad of the sward atlas facing you, leaning with the wind, its top back from you when you look down on it
  const wLo = sel(lt(species, 0.5), 0.5, sel(lt(species, 1.5), 0.4, 0.36)), wHi = sel(lt(species, 0.5), 0.75, sel(lt(species, 1.5), 0.62, 0.55));
  const wCard = mul(mix(wLo, wHi, fr(mul(r, 13.7))), mix(0.9, 1.25, smooth(2, 12, dist)));
  const face = op('normalize', [mix(dir, toCam, 0.85)]), side = op('combine', [op('negate', [swz(face, 'y')]), swz(face, 'x')]);
  const lean = add(mul(dir, add(0.1, mul(0.25, fr(mul(r, 7.1))))), mul(wind, sway));
  const hc = mul(h, mix(0.8, 1, smooth(0.5, 3, dist)));
  const down = clamp(sub(div(sub(swz(cam, 'y'), yW), op('max', [dist, 0.5])), 0.15), 0, 1.2);
  const cxz = sub(add(mul(side, mul(cx, mul(wCard, 0.5))), mul(lean, mul(hc, mul(cy, cy)))), mul(toCam, mul(mul(hc, cy), mul(down, 0.8))));
  const cardPos = op('combine', [add(px, swz(cxz, 'x')), add(yL, sub(mul(hc, cy), 0.04)), add(pz, swz(cxz, 'y'))]);
  // a flower: a stem in the grass, the head a kite tilted half up, half to you (a daisy reads round, a buttercup a cup)
  const stem = mix(0.07, 0.18, fr(mul(r, 5.7)));
  const R = mul(mul(sel(gt(kind, 1.5), 0.017, 0.021), mix(0.8, 1.2, fr(mul(r, 7.9)))), clamp(div(dist, 6), 1, 1.4));
  const tx = swz(toCam, 'x'), tz = swz(toCam, 'y');
  const sideV = op('combine', [op('negate', [tz]), 0, tx]), upV = op('normalize', [op('combine', [mul(tx, -0.5), 0.5, mul(tz, -0.5)])]);
  const nod = add(mul(dir, mul(stem, 0.12)), mul(wind, mul(sway, mul(stem, 0.3))));
  const head = add(root, op('combine', [swz(nod, 'x'), stem, swz(nod, 'y')])), across = mul(sideV, mul(qx, R));
  const flowerPos = sel(lt(cy, 0.25), add(root, across), add(add(head, across), mul(upV, mul(qy, R))));
  const position = sel(op('gte', [h, 0.04]), sel(isFlower, flowerPos, cardPos), root);
  // the atlas cell: the grass's two tufts, mirrored by half the blades
  const c01 = add(mul(cx, 0.5), 0.5), u = add(add(mul(species, SWARD_ATLAS.perSpecies), op('floor', [mul(fr(mul(r, 29.3)), SWARD_ATLAS.perSpecies)])), sel(gt(fr(mul(r, 5.1)), 0.5), c01, one(c01)));
  const v1 = k.varying(op('combine', [div(u, SWARD_ATLAS.variants), cy, dist, add(0.55, mul(0.45, fr(mul(r, 3.3))))]));
  const v2 = k.varying(op('combine', [tone, species, sel(isFlower, kind, 0), 0])), petal = k.varying(q), world = k.varying(add(position, origin));
  const vUv = swz(v1, 'xy'), vH = swz(v1, 'y'), vDist = swz(v1, 'z'), vShade = swz(v1, 'w'), vTone = swz(v2, 'x'), vSpecies = swz(v2, 'y'), vFlower = swz(v2, 'z');
  // the fragment: the sun through a blade, a tight forward-scattering lobe (one term at every distance)
  const sun = [...SKY_SUN], sd = op('max', [op('dot', [op('normalize', [sub(world, cam)]), sun]), 0]);
  const back = op('pow', [sd, 3]), through = op('pow', [sd, 8]);
  // a flower's stem and the kite's corners round the head: a thin dark green, lit like the blades round it
  const stemC = add(mul([0.1022, 0.1946, 0.0194], mul(add(0.55, mul(0.25, vH)), vShade)), mul([0.5841, 0.7157, 0.107], mul(back, 0.2)));
  // the head: a daisy's white petal ring round a gold eye, a buttercup's glossy yellow cup, an orange wildflower
  const pd = div(op('length', [petal]), 0.74), pa = op('atan', [swz(petal, 'y'), swz(petal, 'x')]), big = gt(vFlower, 1.5);
  let petalC = sel(gt(vFlower, 2.5), [0.8714, 0.2542, 0.0116], sel(big, [0.9047, 0.5395, 0.0137], [0.9647, 0.9301, 0.855]));
  petalC = mul(petalC, add(0.82, mul(mul(0.18, op('cos', [mul(pa, sel(big, 5, 13))])), smooth(0.25, 0.6, pd))));
  petalC = mul(petalC, one(mul(0.25, smooth(0.75, 1.05, pd))));
  const headC = mul(mix(sel(big, [0.7454, 0.3564, 0.007], [0.807, 0.4621, 0.0232]), petalC, smooth(0.24, 0.34, pd)), add(0.95, mul(0.2, back)));
  // the tuft: each strand's own shade (R), how far along it (G), where across it (B); a filtered texel holds them scaled by
  // its coverage, so divide it back out (E407 row 4); thin strands thin out in the far mips, so the cut-off eases with distance
  const tex = k.tex('atlas', vUv), cover = swz(tex, 'w');
  const dat = op('min', [div(swz(tex, 'xyz'), op('max', [cover, 0.004])), [1, 1, 1]]), along = swz(dat, 'y'), sh = swz(dat, 'x'), acr = swz(dat, 'z');
  const s = SWARD, L = s.light, tipC = linear(s.tip), sunC = linear(s.sun);
  let body = sel(lt(vSpecies, 0.5), linear(s.lawn), sel(lt(vSpecies, 1.5), linear(s.broad), linear(s.wild)));
  body = mix(body, mul(tipC, [0.78, 0.74, 0.5]), mul(smooth(0.5, 1, add(vTone, mul(sub(vShade, 0.8), 0.4))), s.straw.body));
  const up = mul(along, mix(0.55, 1, vH));
  let c = mix(linear(s.root), linear(s.low), smooth(0, 0.25, up));
  c = mix(c, body, smooth(0.2, 0.6, up));
  c = mix(c, tipC, mul(smooth(0.8, 1, up), s.straw.tip));
  let lit = mul(mul(mul(c, add(L.floor, mul(L.gain, up))), add(0.3, sh)), add(0.85, mul(0.3, vTone)));
  lit = mul(lit, add(1, mul(mul(L.edge, smooth(0.62, 1, acr)), up)));
  // the low sun on the sward's top layer, caught by only some strands: green blades and gold blades side by side
  const catchS = smooth(0.62, 0.95, sh);
  lit = add(lit, mul([sunC[0] * tipC[0], sunC[1] * tipC[1], sunC[2] * tipC[2]], mul(mul(smooth(0.3, 0.9, up), catchS), L.top)));
  // the light through a blade glows at its thin edges and tip (the mockups' backlit sward: dark bodies, gold rims)
  const rimB = smooth(0.5, 1, op('abs', [sub(mul(acr, 2), 1)])), leaf = linear(s.leaf);
  lit = add(lit, mul([sunC[0] * leaf[0], sunC[1] * leaf[1], sunC[2] * leaf[2]], mul(mul(mul(mul(through, mul(up, up)), add(0.2, mul(0.8, catchS))), L.through), add(0.3, mul(0.7, rimB)))));
  const flower = gt(vFlower, 0.5), stemPart = op('or', [lt(swz(petal, 'y'), -0.96), gt(op('length', [petal]), 0.74)]);
  const colour = mul(sel(flower, sel(stemPart, stemC, headC), lit), [1.1, 1.0138, 0.9227]);
  const discard = op('and', [op('not', [flower]), lt(cover, mix(0.5, 0.22, smooth(3, 16, vDist)))]);
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, budget: { nodes: 480, samplers: 1, instructions: 1600 },
    params: { atlas: { type: 'texture', value: SWARD_ATLAS_FILE.hash, role: 'data' } }, nodes: k.nodes,
    stages: { 'vertex.position': { position }, surface: { colour, discard } }, effectState: { fog: false } };
}

/** The meadow's look (look.materials `meadow`). */
export const MEADOW_GRAPH = meadowGraph();
