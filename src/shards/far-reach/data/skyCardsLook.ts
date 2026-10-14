import type { GraphIr } from '@wildshard/format/materialGraph';
import type { CardFieldRow, CardGroupRow } from '@wildshard/sdk/looks/cardField';
import { graphKit } from './graphKit';
import type { SunGlowProgram } from './sunGlowLook';

/**
 * Sky Reach's camera-facing cards (SHARD-PLATFORM M3: SF59 material graphs over fields built by
 * @wildshard/sdk/looks/cardField; the cards' numbers are the bake in data/skyCards.ts, generators/skyCards.ts).
 *
 * The sun's glow and light shafts (E392) are baked here too (`sunGlow`), drawn by their material graph (data/sunGlowLook.ts).
 *
 * The cumulus over the cloud sea (E392; the targets: the islands rise out of a sea of sunlit billowing cloud): each card
 * shows one of eight painted golden-hour cumulus puffs from the atlas (`public/assets/far-reach/tex/clouds.webp`, codex
 * image_gen, `art/far-reach/round-17-mockup-loop/textures/`: puffs on black, so the brightness is the alpha), a 3:4 cell of
 * the 4 x 2 sheet, thinning out with distance (520 -> 820 m, a bank's distance stretched by its `aFar`) into the painted
 * panorama's sea; the dark matte fringe cut by alpha, lavender in the shaded bellies, the lit crowns warm, a touch of rim
 * gold when the sun is behind the cloud. Without the atlas (offline, a test page) the field is not built.
 */

/**
 * The cumulus puff as one SF59 material graph over the baked field's one instanced draw (`aAt` [x, y, z, size], `aCell` the
 * atlas cell, `aFar` a bank's fade stretch): each card faces the camera at its puff, a 3:4 cell of the 4 × 2 sheet (row 0
 * the sheet's top row), fading 520 → 820 m; the atlas's brightness is its alpha (the dark matte fringe cut), lavender in the
 * shaded bellies, the lit crowns warm, a touch of rim gold when the sun is behind the cloud. Alpha-blended, unfogged, no
 * depth write. `atlas` names the painted sheet the dressing hands the compiler.
 */
export function cumulusGraph(sun: readonly [number, number, number], atlas: string): GraphIr {
  const k = graphKit(), { op, add, sub, mul, swz, smooth } = k;
  // the vertex: the card at its puff, turned to the camera (right = up × toCam, up' = toCam × right)
  const row = k.attr('aAt', 'vec4'), cell = k.attr('aCell', 'vec2'), far = k.attr('aFar', 'float'), at = swz(row, 'xyz'), cam = op('cameraPosition');
  const toCam = op('normalize', [sub(cam, at)]), tx = swz(toCam, 'x'), ty = swz(toCam, 'y'), tz = swz(toCam, 'z');
  const right = op('normalize', [op('combine', [tz, 0, op('negate', [tx])])]), rx = swz(right, 'x'), rz = swz(right, 'z');
  const up = op('combine', [mul(ty, rz), sub(mul(tz, rx), mul(tx, rz)), op('negate', [mul(ty, rx)])]);
  const geo = op('positionGeometry'), gx = swz(geo, 'x'), gy = swz(geo, 'y');
  const world = add(at, mul(add(mul(right, mul(gx, 0.75)), mul(up, gy)), swz(row, 'w')));
  const placed = sub(world, op('objectOrigin'));
  const inX = add(mul(gx, 0.5), 0.5), inY = add(mul(gy, 0.5), 0.5);
  const uv = k.varying(op('combine', [mul(add(swz(cell, 'x'), inX), 0.25), op('oneMinus', [mul(sub(add(swz(cell, 'y'), 1), inY), 0.5)])]));
  const d = op('length', [sub(swz(row, 'xz'), swz(cam, 'xz'))]);
  const fade = k.varying(op('oneMinus', [smooth(520, 820, mul(d, far))]));
  const toSun = k.varying(op('max', [op('dot', [op('negate', [toCam]), [...sun]]), 0]));
  // the fragment: the painted puff, its brightness the alpha
  const t = swz(k.tex('atlas', uv), 'xyz'), lum = op('dot', [t, [0.3, 0.59, 0.11]]);
  const alpha = mul(smooth(0.24, 0.5, lum), fade);
  const lit = smooth(0.35, 0.85, lum);
  const base = k.mix(mul(t, [0.78, 0.76, 1.02]), mul(t, [1.18, 1.12, 1.02]), lit);
  const colour = add(base, mul([1, 0.78, 0.45], mul(mul(op('pow', [toSun, 6]), op('oneMinus', [smooth(0.3, 0.7, lum)])), 0.5)));
  return { version: 1, kind: 'material', model: 'unlit', params: { atlas: { type: 'texture', value: atlas } }, nodes: k.nodes,
    stages: { 'vertex.position': { position: placed }, surface: { colour, alpha, discard: op('lt', [alpha, 0.01]) } },
    effectState: { blend: 'alpha', depthWrite: false, fog: false } };
}

/** The baked cards (generators/skyCards.ts → data/skyCards.ts): the cumulus field and the sun's glow. */
export interface SkyCardRows {
  readonly cumulus: CardFieldRow<'cumulus'>;
  readonly sunGlow: CardGroupRow<SunGlowProgram>;
}
