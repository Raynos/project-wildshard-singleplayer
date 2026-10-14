import { InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, type Material } from 'three';
import type { PaintedDressingContext } from '@wildshard/engine/render/dataLook';
import type { CardGroupRow } from '@wildshard/sdk/looks/cardField';
import { SUN_GLOW_PROGRAMS, sunGlowGraph, type SunGlowProgram } from '../data/sunGlowLook';

/** a card's number uniform (its row's), else `fallback` */
function num(card: CardGroupRow<SunGlowProgram>['cards'][number], name: string, fallback: number): number {
  const row = card.uniforms?.[name];
  return typeof row === 'number' ? row : fallback;
}
/** a card's 2-vector uniform (`{ v2 }`), else `fallback` */
function pair(card: CardGroupRow<SunGlowProgram>['cards'][number], name: string, fallback: readonly [number, number]): readonly [number, number] {
  const row = card.uniforms?.[name];
  return typeof row === 'object' && 'v2' in row ? row.v2 : fallback;
}

/**
 * The sun's glow as one instanced draw of its material graph (data/sunGlowLook.ts `sunGlowGraph`): the baked card rows
 * (generators/skyCards.ts: the disc and bloom, the wide gold air, the fan of light shafts) become per-instance rows, each
 * card's size, angle and lift (`aCard`), its pulse (`aPulse`: base, amplitude, rate, phase) and its program's weights
 * (`aMix`). Camera-relative at the painted sun, additive, at the row's render order; the graph material is the dressing's.
 */
export async function sunGlow(ctx: PaintedDressingContext, row: CardGroupRow<SunGlowProgram>, sun: readonly [number, number, number]): Promise<Mesh<InstancedBufferGeometry, Material>> {
  const cards = row.cards, n = cards.length, card = new Float32Array(n * 4), pulse = new Float32Array(n * 4), mix = new Float32Array(n * 3);
  cards.forEach((c, i) => {
    const [w, h] = pair(c, 'uSize', [1, 1]);
    // a shaft card stands on the sun (its foot at the centre), a bloom card is centred on it
    card.set([w, h, num(c, 'uAngle', 0), h > w ? 0.5 : 0], i * 4);
    pulse.set(c.pulse === undefined ? [num(c, 'uPulse', 1), 0, 0, 0] : [c.pulse.base, c.pulse.amp, c.pulse.rate, c.pulse.phase], i * 4);
    mix.set(SUN_GLOW_PROGRAMS[c.program], i * 3);
  });
  const first = cards[0], distance = first === undefined ? 820 : num(first, 'uDist', 820);
  const plane = new PlaneGeometry(1, 1), geometry = new InstancedBufferGeometry();
  geometry.index = plane.index; geometry.setAttribute('position', plane.getAttribute('position')); geometry.setAttribute('uv', plane.getAttribute('uv'));
  geometry.setAttribute('aCard', new InstancedBufferAttribute(card, 4));
  geometry.setAttribute('aPulse', new InstancedBufferAttribute(pulse, 4));
  geometry.setAttribute('aMix', new InstancedBufferAttribute(mix, 3));
  geometry.instanceCount = n;
  const mesh = new Mesh<InstancedBufferGeometry, Material>(geometry, await ctx.graph(sunGlowGraph(sun, distance)));
  mesh.name = row.name; mesh.frustumCulled = false; mesh.renderOrder = row.order;
  return mesh;
}
