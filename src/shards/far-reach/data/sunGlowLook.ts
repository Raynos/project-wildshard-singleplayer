import type { GraphIr, GraphNode, GraphRef } from '@wildshard/format/materialGraph';
import type { CardGroupRow } from '@wildshard/sdk/looks/cardField';
import { SKY_CARDS } from './skyCards';
import { fieldCards } from './skyCardsLook';

/** The sun's three card programs and each one's weights in the glow graph's mix (`aMix`: bloom, wide, shaft). */
export const SUN_GLOW_PROGRAMS = { sunBloom: [1, 0, 0], sunWide: [0, 1, 0], sunShaft: [0, 0, 1] } as const;
export type SunGlowProgram = keyof typeof SUN_GLOW_PROGRAMS;

/**
 * The sun's glow (E392; the judge every loop: "no visible sun, no god rays") as one SF59 material graph over one instanced
 * draw (`SUN_GLOW_FIELD`: the baked cards as instance rows): every card camera-relative at `distance` along the
 * sun's direction `sun`, its plane scaled by `aCard.xy`, lifted by `aCard.w` (a shaft's foot on the sun) and turned by
 * `aCard.z` in the view plane; its colour the three programs' mixed by `aMix`: the bloom (loop 20, mockup A: one hot gold
 * disc about the painted one's 1.5 deg, a tight amber glow, a faint wide halo; round 6 / E399: gold, not white, no pink
 * ring), the wide gold air, and a light shaft fading along its length, pulsing `aPulse.x + aPulse.y · sin(t · aPulse.z +
 * aPulse.w)`. Additive, double-sided, unfogged, no depth write: drawn after the cumulus and before the world, so the low
 * sun burns through a cloud bank while the isles (depth) still hide it.
 */
export function sunGlowGraph(sun: readonly [number, number, number], distance: number): GraphIr {
  const nodes: Record<string, GraphNode> = {};
  // the builder: each `op` adds one node and returns its id
  let next = 0;
  const op = (name: string, inputs?: readonly GraphRef[], extra?: Omit<GraphNode, 'op' | 'in'>): string => {
    const id = `g${String(next++)}`; nodes[id] = { op: name, ...(inputs === undefined ? {} : { in: inputs }), ...extra }; return id;
  };
  const add = (a: GraphRef, b: GraphRef): string => op('add', [a, b]), mul = (a: GraphRef, b: GraphRef): string => op('mul', [a, b]);
  const sub = (a: GraphRef, b: GraphRef): string => op('sub', [a, b]), swz = (a: string, mask: string): string => op('swizzle', [a], { mask });
  const smooth = (e0: number, e1: number, x: GraphRef): string => op('smoothstep', [e0, e1, x]), exp = (x: GraphRef): string => op('exp', [x]);
  const attr = (name: string, type: 'vec3' | 'vec4'): string => op('attribute', undefined, { name, type });
  // the vertex: the card's plane point, scaled, lifted, turned about the sun, placed camera-relative at the sun
  const card = attr('aCard', 'vec4'), at = op('positionGeometry');
  const px = mul(swz(at, 'x'), swz(card, 'x')), py = mul(add(swz(at, 'y'), swz(card, 'w')), swz(card, 'y'));
  const c = op('cos', [swz(card, 'z')]), s = op('sin', [swz(card, 'z')]);
  const local = op('combine', [sub(mul(c, px), mul(s, py)), add(mul(s, px), mul(c, py))]);
  const placed = op('cameraRelativeBillboard', [[...sun], distance, local]);
  // the fragment: distance from the card's centre (0 at the centre, 1 at its edge), its across and along for a shaft
  const uv = op('uv'), d = mul(op('length', [sub(uv, [0.5, 0.5])]), 2);
  const disc = op('oneMinus', [smooth(0.085, 0.115, d)]), halo = mul(exp(mul(d, -3.2)), op('oneMinus', [smooth(0.7, 1, d)]));
  const bloom = add(mul([1, 0.95, 0.82], mul(disc, 6)), mul([1, 0.62, 0.26], add(mul(exp(mul(mul(d, d), -140)), 1.2), mul(halo, 0.1))));
  const wide = mul([1, 0.78, 0.46], mul(mul(exp(mul(d, -2.4)), op('oneMinus', [smooth(0.75, 1, d)])), 0.06));
  const pulseRow = attr('aPulse', 'vec4');
  const pulse = add(swz(pulseRow, 'x'), mul(swz(pulseRow, 'y'), op('sin', [add(mul(op('time'), swz(pulseRow, 'z')), swz(pulseRow, 'w'))])));
  const across = op('oneMinus', [mul(op('abs', [sub(swz(uv, 'x'), 0.5)]), 2)]), along = swz(uv, 'y');
  const shaftA = mul(mul(mul(mul(smooth(0, 1, across), op('oneMinus', [along])), smooth(0, 0.08, along)), 0.13), pulse);
  const shaft = mul([1, 0.82, 0.55], shaftA);
  const weights = attr('aMix', 'vec3');
  const colour = add(add(mul(bloom, swz(weights, 'x')), mul(wide, swz(weights, 'y'))), mul(shaft, swz(weights, 'z')));
  return { version: 1, kind: 'material', model: 'unlit', doubleSided: true, nodes,
    stages: { 'vertex.position': { position: placed }, surface: { colour } },
    effectState: { blend: 'additive', depthWrite: false, fog: false } };
}

/** the float32 bytes of `values`, base64 (a card field's attribute) */
function floats(values: readonly number[]): string {
  const bytes = new Uint8Array(Float32Array.from(values).buffer);
  let out = '';
  for (const byte of bytes) out += String.fromCodePoint(byte);
  return btoa(out);
}
type GlowCard = CardGroupRow<SunGlowProgram>['cards'][number];
/** a card's number uniform (its row's), else `fallback` */
const num = (card: GlowCard, name: string, fallback: number): number => { const row = card.uniforms?.[name]; return typeof row === 'number' ? row : fallback; };
/** a card's 2-vector uniform (`{ v2 }`), else `fallback` */
const pair = (card: GlowCard, name: string): readonly [number, number] => { const row = card.uniforms?.[name]; return typeof row === 'object' && 'v2' in row ? row.v2 : [1, 1]; };

/**
 * The baked sun cards (generators/skyCards.ts: the disc and bloom, the wide gold air, the fan of light shafts) as one card
 * field for the glow graph: each card's size, angle and lift (`aCard`; a shaft's foot stands on the sun, a bloom card is
 * centred on it), its pulse (`aPulse`: base, amplitude, rate, phase) and its program's weights (`aMix`).
 */
function glowField(row: CardGroupRow<SunGlowProgram>): CardGroupRow<'sunGlow'> & { readonly distance: number } {
  const card = row.cards.flatMap((c) => { const [w, h] = pair(c, 'uSize'); return [w, h, num(c, 'uAngle', 0), h > w ? 0.5 : 0]; });
  const pulse = row.cards.flatMap((c) => (c.pulse === undefined ? [num(c, 'uPulse', 1), 0, 0, 0] : [c.pulse.base, c.pulse.amp, c.pulse.rate, c.pulse.phase]));
  const mix = row.cards.flatMap((c) => SUN_GLOW_PROGRAMS[c.program]);
  const first = row.cards[0];
  return { ...fieldCards({ name: row.name, order: row.order, plane: [1, 1], program: 'sunGlow',
    attributes: { aCard: { size: 4, float32: floats(card) }, aPulse: { size: 4, float32: floats(pulse) }, aMix: { size: 3, float32: floats(mix) } } }), distance: first === undefined ? 820 : num(first, 'uDist', 820) };
}
/** The sun's glow field (its graph: `sunGlowGraph(SKY_SUN, SUN_GLOW_FIELD.distance)`). */
export const SUN_GLOW_FIELD = glowField(SKY_CARDS.sunGlow);
