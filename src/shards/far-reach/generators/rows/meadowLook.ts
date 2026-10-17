/**
 * The near meadow (loop 4; the targets' foreground is knee-deep golden grass, not a green plane): single tuft cards and
 * flowers over every island top, baked (generators/meadowBlades.ts → baked/meadow-blades.bin: where each blade stands and
 * what its place decided) and drawn by the `meadow` material graph (data/lookGraphs.json) (world/meadow.ts: an 8 m chunk of blades per
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
 *  grass + 4 × flower kind, room): the metres per step of the scaled ones, the near copies' most room, and the room byte's
 *  flag for a room the island's rim cut short (its copies keep their height: only a hole or a rock clears a ring). */
export const MEADOW_BLADES = { y: 0.01, h: 0.005, safe: 0.01, room: 1, rimCut: 128 } as const;

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
