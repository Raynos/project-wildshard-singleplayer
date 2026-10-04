/**
 * The trail dressing's models (E306 / E315 M1: models on the contract, src/engine/models/model.ts; they were built inside
 * src/shards/driftwood-isle/world/Trailside.ts): the rope-fence POST (a thick weathered piling with a rope lashing under its cap), the
 * SIGNPOST (a post with an arrow board per direction, stacked, each lettered with the place it points to — E318) and the
 * PLANK STEP let into a climb. Flat-shaded vertex colour, per-face jitter from the stream they are handed.
 *
 * Each builds in its own space, its foot at the origin: the trail (src/shards/driftwood-isle/world/Trailside.ts) builds them in its layout's
 * order from ONE rng stream, between the geometry that is the trail's own (the ropes sagging between the posts, the
 * steps' side rails, the trestle stairs), welds everything into one mesh (one draw, as before) and places each model
 * `drawnInto` it. The posts and signposts collide as the boxes they always had (own space, carried to each placement).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '@wildshard/engine/core/rng';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';

const C = {
  post: new THREE.Color('#6f5638'), postTop: new THREE.Color('#8a6d48'), rope: new THREE.Color('#d2bd85'),
  plank: new THREE.Color('#a07c53'), plankDark: new THREE.Color('#7d5f3f'), board: new THREE.Color('#b8925f'), boardEdge: new THREE.Color('#6a4e33'),
  letter: new THREE.Color('#3b2716'),
};
export const TRAIL_COLOURS = C;

/** the trail's one material (the dressing and the trail's own geometry share it: one draw) */
export function trailMaterial(ctx: ModelContext): THREE.MeshStandardMaterial {
  return ctx.once('driftwood-isle/trail:material', () => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0, side: THREE.DoubleSide });
    ctx.sky.setupMaterial(mat);
    return mat;
  });
}

/** paint a part one colour (per-face jitter from the stream) and keep it: the trail's own `add` */
export function trailPart(parts: THREE.BufferGeometry[], rng: Rng): (g: THREE.BufferGeometry, col: THREE.Color, jitter?: number) => void {
  return (g, col, jitter = 0.06) => {
    g.deleteAttribute('uv'); g.deleteAttribute('normal');
    const ni = g.index ? g.toNonIndexed() : g;
    const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) { const k = 1 - jitter + rng.next() * jitter * 2; for (let j = 0; j < 3; j++) { c[(i + j) * 3] = col.r * k; c[(i + j) * 3 + 1] = col.g * k; c[(i + j) * 3 + 2] = col.b * k; } }
    ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
    parts.push(ni);
  };
}

const one = (ctx: ModelContext, parts: THREE.BufferGeometry[]): ModelPart[] =>
  [{ geometry: parts.length === 1 && parts[0] ? parts[0] : mergeGeometries(parts, false), material: trailMaterial(ctx), castShadow: true, receiveShadow: true }];

export const fencePost = defineModel<Record<string, never>>({
  id: 'driftwood-isle/fence-post', name: 'Fence post', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/trailside.ts', surface: 'wood',
  defaults: {},
  seed: 0x5ea1 ^ 0x7a11,
  build: (ctx, _p, rng) => {
    const parts: THREE.BufferGeometry[] = [], add = trailPart(parts, rng);
    const tilt = rng.range(-0.06, 0.06);
    add(new THREE.CylinderGeometry(0.13, 0.16, 1.55, 6).rotateZ(tilt).translate(0, 0.45, 0), C.post, 0.08);
    add(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 6).translate(0, 1.22, 0), C.postTop, 0.04);
    for (let r = 0; r < 3; r++) add(new THREE.CylinderGeometry(0.175, 0.175, 0.07, 6).translate(0, 1.0 - r * 0.08, 0), r === 1 ? C.postTop : C.rope, 0.04);
    return one(ctx, parts);
  },
  // from 1 m under the ground to its cap (the legacy box)
  colliders: () => [{ kind: 'box', x: 0, y: 0.1, z: 0, hx: 0.16, hy: 1.1, hz: 0.16 }],
});

export interface SignpostParams {
  /** the arrow boards, top down: each points this way (radians about +Y, 0 = +z: world (sin, cos)) */
  readonly arrows: readonly number[];
  /** each board's lettering, top down (E318: Jake, "letter them" — a blank board is a placeholder); '' or none = blank */
  readonly labels?: readonly string[];
}

/** the lettering's block font: 5 × 7 cells, '#' painted (the island's faceted look: the letters are flat quads in the
 *  weld's vertex colour, so a lettered sign costs no texture and no draw) */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
};
/** one font cell, metres: letters 0.18 m tall on a 0.3 m board (readable from ~10 m on a phone) */
const CELL = 0.026;
const textWidth = (text: string): number => Math.max(0, text.length * 6 - 1) * CELL;

/** the lettering's quads on one face (`side` +1: the board's +z face, reading left → right from the post; −1: the back,
 *  laid mirrored so it reads left → right from there too), centred on `cx`, in the board's own frame */
function lettering(text: string, cx: number, side: 1 | -1): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [], w = textWidth(text), x0 = cx - (side * w) / 2, z = side * 0.034;
  text.toUpperCase().split('').forEach((ch, k) => { // the font is plain ASCII capitals
    const rows = GLYPHS[ch];
    if (!rows) return; // a space (or a letter the font lacks) is a gap
    rows.forEach((row, r) => {
      // one quad per run of painted cells in the row
      for (let c = 0; c < 5;) {
        if (row[c] !== '#') { c++; continue; }
        let e = c; while (e < 5 && row[e] === '#') e++;
        const a = (k * 6 + c) * CELL, b = (k * 6 + e) * CELL, y = (3.5 - r) * CELL - CELL / 2;
        const q = new THREE.PlaneGeometry(b - a, CELL);
        if (side < 0) q.rotateY(Math.PI);
        q.translate(x0 + side * (a + b) / 2, y, z);
        out.push(q);
        c = e;
      }
    });
  });
  return out;
}

export const signpost = defineModel<SignpostParams>({
  id: 'driftwood-isle/signpost', name: 'Signpost', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/trailside.ts', surface: 'wood',
  defaults: { arrows: [-1.27, 0.35], labels: ['HUT', 'LOOKOUT'] },
  variants: [{ id: 'two', label: 'Two arrows', params: {} }, { id: 'one', label: 'One arrow', params: { arrows: [1.2], labels: ['WRECK'] } }, { id: 'three', label: 'Three arrows', params: { arrows: [0.45, 0.75, -0.87], labels: ['LOOKOUT', 'WRECK', 'SHRINE'] } }],
  seed: 0x5ea1 ^ 0x7a11,
  build: (ctx, p, rng) => {
    const parts: THREE.BufferGeometry[] = [], add = trailPart(parts, rng);
    add(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 6).translate(0, 1.1, 0), C.post, 0.06);
    p.arrows.forEach((toward, i) => {
      const by = 2.1 - i * 0.42, text = p.labels?.[i] ?? '';
      // an arrow board: a box with a wedge tip, pointing along `toward`; as long as its lettering needs (0.9 m at least)
      const len = Math.max(0.9, textWidth(text) + 0.24);
      const board = new THREE.BoxGeometry(len, 0.3, 0.06); board.translate(len / 2 + 0.1, 0, 0);
      const tip = new THREE.ConeGeometry(0.19, 0.3, 4); tip.rotateZ(-Math.PI / 2); tip.rotateX(Math.PI / 4); tip.translate(len + 0.25, 0, 0);
      for (const g of [board, tip]) { g.rotateY(toward - Math.PI / 2); g.translate(0, by, 0); add(g, C.board, 0.05); }
      const edge = new THREE.BoxGeometry(len + 0.02, 0.04, 0.08); edge.translate(len / 2 + 0.1, -0.16, 0); edge.rotateY(toward - Math.PI / 2); edge.translate(0, by, 0); add(edge, C.boardEdge, 0.04);
      // the place's name, burnt dark into both faces
      for (const side of [1, -1] as const) for (const g of lettering(text, len / 2 + 0.1, side)) { g.rotateY(toward - Math.PI / 2); g.translate(0, by, 0); add(g, C.letter, 0.03); }
    });
    return one(ctx, parts);
  },
  colliders: () => [{ kind: 'box', x: 0, y: 0.7, z: 0, hx: 0.12, hy: 1.7, hz: 0.12 }],
});

export interface PlankStepParams {
  /** width across the climb, metres */
  readonly w: number;
  /** its roll with the ground across it, radians (E118) */
  readonly roll: number;
  /** which way the climb runs, radians about +Y */
  readonly yaw: number;
  readonly dark: boolean;
}

export const plankStep = defineModel<PlankStepParams>({
  id: 'driftwood-isle/plank-step', name: 'Plank step', category: 'props', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/trailside.ts', surface: 'wood',
  defaults: { w: 2.4, roll: 0, yaw: 0, dark: false },
  variants: [{ id: 'light', label: 'Light', params: {} }, { id: 'dark', label: 'Dark', params: { dark: true } }],
  seed: 0x5ea1 ^ 0x7a11,
  build: (ctx, p, rng) => {
    const parts: THREE.BufferGeometry[] = [], add = trailPart(parts, rng);
    const g = new THREE.BoxGeometry(p.w, 0.14, 0.42); g.rotateZ(p.roll); g.rotateY(p.yaw); g.translate(0, 0.02, 0);
    add(g, p.dark ? C.plankDark : C.plank, 0.05);
    return one(ctx, parts);
  },
});
