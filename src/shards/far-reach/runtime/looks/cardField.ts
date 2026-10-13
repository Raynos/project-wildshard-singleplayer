import { Group, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, type ShaderMaterial } from 'three';
import { uniformsFrom, type ShaderFamily, type UniformMap } from '@wildshard/game/plugin/shaderFamily';
import type { CardFieldRow, CardGroupRow, CardPulseRow } from '../../data/skyCardsLook';

/**
 * Camera-facing cards drawn by the shard's own programs, from baked rows (SHARD-PLATFORM M3, look-family rows; the rows'
 * types are data/skyCardsLook.ts, the bake data/skyCards.ts, typed at compile time): a sun's bloom and its fan of light
 * shafts, a field of painted cloud puffs, any billboard the vertex program turns to face the camera.
 *
 * - `cardGroup` builds a group of unit cards (one shared 1 × 1 plane), one mesh and material per card, unculled (the
 *   program places the card), all at the row's render order, in the row's order.
 * - `cardField` builds one instanced draw over a `plane`-sized quad: the per-instance attributes are baked float32 bytes
 *   (base64, the platform's byte order), the instance count the first attribute's.
 */

/** What `cardGroup` builds: the group, the shared plane, every card's material and the pulse update. */
export interface CardGroup {
  readonly group: Group;
  readonly geometry: PlaneGeometry;
  readonly materials: readonly ShaderMaterial[];
  /** writes every card's pulse for look time `t` (seconds) */
  update: (t: number) => void;
}

/** A group of camera-facing unit cards from a row: one mesh per card on one shared 1 × 1 plane. */
export function cardGroup<P extends string>(family: ShaderFamily<P>, row: CardGroupRow<P>, shared: UniformMap): CardGroup {
  const group = new Group(); group.name = row.name;
  const plane = new PlaneGeometry(1, 1), materials: ShaderMaterial[] = [];
  const pulses: { readonly material: ShaderMaterial; readonly pulse: CardPulseRow }[] = [];
  for (const card of row.cards) {
    const material = family.material(card.program, shared, card.uniforms === undefined ? {} : { uniforms: uniformsFrom(card.uniforms) });
    const mesh = new Mesh(plane, material); mesh.frustumCulled = false; mesh.renderOrder = row.order; group.add(mesh);
    materials.push(material);
    if (card.pulse !== undefined) pulses.push({ material, pulse: card.pulse });
  }
  return { group, geometry: plane, materials, update: (t) => {
    for (const { material, pulse } of pulses) { const u = material.uniforms[pulse.uniform]; if (u) u.value = pulse.base + pulse.amp * Math.sin(t * pulse.rate + pulse.phase); }
  } };
}

function floats(base64: string): Float32Array {
  const bytes = Uint8Array.from(atob(base64), (c) => c.codePointAt(0) ?? 0);
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

/** An instanced card field from a row, one draw: `uniforms` adds the caller's (a texture) over the program's. */
export function cardField<P extends string>(family: ShaderFamily<P>, row: CardFieldRow<P>, shared: UniformMap, uniforms?: UniformMap): Mesh<InstancedBufferGeometry, ShaderMaterial> {
  const base = new PlaneGeometry(row.plane[0], row.plane[1]), g = new InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
  let count = -1;
  for (const [name, attribute] of Object.entries(row.attributes)) {
    const values = floats(attribute.float32);
    if (count < 0) count = values.length / attribute.size;
    g.setAttribute(name, new InstancedBufferAttribute(values, attribute.size));
  }
  g.instanceCount = Math.max(count, 0);
  const material = family.material(row.program, shared, uniforms === undefined ? {} : { uniforms });
  const mesh = new Mesh(g, material); mesh.frustumCulled = false; mesh.renderOrder = row.order; mesh.name = row.name;
  return mesh;
}
